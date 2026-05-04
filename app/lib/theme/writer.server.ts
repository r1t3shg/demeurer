/**
 * Theme writer — Shopify GraphQL `themeFilesUpsert` mutation.
 *
 * The write side of P1.D segment 3. Reads (segment 2's `client.server.ts`)
 * tell us what's currently in the theme; the writer pushes new bytes in.
 * Both sides go through the same `withRateLimit` per-shop limiter so we
 * play nice with Shopify's cost-based rate limits.
 *
 * Architectural notes:
 *
 *   - Shopify accepts up to 50 files per upsert call. We use 10 per
 *     batch (cost-conservative) — the cost of one big mutation can
 *     exceed the per-shop bucket. Multiple smaller calls feed back into
 *     `withRateLimit`'s preemptive backoff.
 *   - The mutation requires `write_themes` AND (per Shopify docs) "an
 *     exemption from Shopify to modify theme files." If the app
 *     doesn't have the exemption, every call returns 401 — classified
 *     as `auth` and surfaced to the caller.
 *   - On success Shopify returns `checksumMd5` for the stored bytes.
 *     We record THAT in `ThemeWrite` (not a locally-computed md5),
 *     because Shopify is the source of truth for what's actually in
 *     the theme.
 *   - This module knows nothing about pages, drift, or apply phases.
 *     It's a thin wrapper over the mutation. The orchestration lives
 *     in `app/lib/compile/apply.ts`.
 */

import { md5Hex } from "../compile/md5.ts";
import type { AdminClient } from "./client.server.ts";
import { withRateLimit } from "./rate-limiter.server.ts";

/** How many files we send in a single `themeFilesUpsert` call. */
const BATCH_SIZE = 10;

export type WriteErrorCode =
  | "throttled"
  | "bad_content"
  | "auth"
  | "network"
  | "unknown";

export interface WriteResult {
  path: string;
  success: boolean;
  /** md5 hex Shopify returned (or computed locally if Shopify omitted it). */
  writtenHash?: string;
  error?: string;
  errorCode?: WriteErrorCode;
}

const UPSERT_MUTATION = /* GraphQL */ `
  mutation DemeurerWriteThemeFiles($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles {
        filename
        checksumMd5
        size
      }
      userErrors {
        code
        filename
        field
        message
      }
    }
  }
`;

interface UpsertResponse {
  data?: {
    themeFilesUpsert?: {
      upsertedThemeFiles?: Array<{
        filename?: string;
        checksumMd5?: string | null;
        size?: number | string | null;
      }>;
      userErrors?: Array<{
        code?: string | null;
        filename?: string | null;
        field?: string[] | null;
        message?: string;
      }>;
    };
  };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

export interface WriteableFile {
  path: string;
  content: string;
}

/**
 * Write a single theme file. Convenience wrapper around `writeThemeFiles`.
 */
export async function writeThemeFile(
  admin: AdminClient,
  themeId: string,
  shop: string,
  path: string,
  content: string,
): Promise<WriteResult> {
  const [result] = await writeThemeFiles(admin, themeId, shop, [{ path, content }]);
  return result;
}

/**
 * Batch upsert. Chunks input into groups of `BATCH_SIZE` and runs each
 * chunk through `withRateLimit`. The rate limiter handles throttle
 * retries; per-file failures from Shopify's `userErrors` are returned
 * as `WriteResult { success: false }`.
 *
 * Returns a `WriteResult` for every input file in input order.
 */
export async function writeThemeFiles(
  admin: AdminClient,
  themeId: string,
  shop: string,
  files: WriteableFile[],
): Promise<WriteResult[]> {
  if (files.length === 0) return [];

  const out: WriteResult[] = [];
  // Run batches sequentially. Parallelism would buy little here — the
  // rate limiter already caps shop concurrency at 4, and writes are
  // cost-heavy.
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const chunk = files.slice(i, i + BATCH_SIZE);
    const results = await writeChunk(admin, themeId, shop, chunk);
    out.push(...results);
  }
  return out;
}

async function writeChunk(
  admin: AdminClient,
  themeId: string,
  shop: string,
  chunk: WriteableFile[],
): Promise<WriteResult[]> {
  const variables = {
    themeId,
    files: chunk.map((f) => ({
      filename: f.path,
      body: { type: "TEXT", value: f.content },
    })),
  };

  let response: { status: number; body: unknown };
  try {
    response = await withRateLimit(shop, () =>
      admin.graphql(UPSERT_MUTATION, { variables }),
    );
  } catch (err) {
    // The rate limiter exhausts its retries on persistent throttle; any
    // other thrown error is a network/transport failure.
    const message = err instanceof Error ? err.message : String(err);
    const code: WriteErrorCode = /THROTTLED|429/.test(message) ? "throttled" : "network";
    return chunk.map((f) => ({
      path: f.path,
      success: false,
      error: message,
      errorCode: code,
    }));
  }

  if (response.status === 401 || response.status === 403) {
    return chunk.map((f) => ({
      path: f.path,
      success: false,
      error: `HTTP ${response.status} — write_themes scope or theme-write exemption missing`,
      errorCode: "auth",
    }));
  }

  if (response.status >= 500) {
    return chunk.map((f) => ({
      path: f.path,
      success: false,
      error: `HTTP ${response.status} from Shopify`,
      errorCode: "network",
    }));
  }

  const body = response.body as UpsertResponse;

  // Top-level GraphQL errors (e.g. THROTTLED on the mutation itself, or
  // a malformed query). Treat as a batch failure with classification.
  if (body.errors && body.errors.length > 0) {
    const message = body.errors.map((e) => e.message ?? "unknown").join("; ");
    const isThrottle = body.errors.some((e) => e.extensions?.code === "THROTTLED");
    return chunk.map((f) => ({
      path: f.path,
      success: false,
      error: message,
      errorCode: isThrottle ? "throttled" : "unknown",
    }));
  }

  const upserted = body.data?.themeFilesUpsert?.upsertedThemeFiles ?? [];
  const userErrors = body.data?.themeFilesUpsert?.userErrors ?? [];

  // Index for O(1) lookup.
  const upsertedByName = new Map<string, { checksumMd5?: string | null }>();
  for (const u of upserted) {
    if (u.filename) upsertedByName.set(u.filename, { checksumMd5: u.checksumMd5 });
  }
  const errorsByName = new Map<string, { code: WriteErrorCode; message: string }>();
  for (const e of userErrors) {
    if (!e.filename) continue;
    errorsByName.set(e.filename, {
      code: classifyUserErrorCode(e.code ?? null),
      message: e.message ?? `Shopify error code: ${e.code ?? "unknown"}`,
    });
  }

  return chunk.map((f) => {
    const err = errorsByName.get(f.path);
    if (err) {
      return {
        path: f.path,
        success: false,
        error: err.message,
        errorCode: err.code,
      };
    }
    const upsertedEntry = upsertedByName.get(f.path);
    if (upsertedEntry) {
      return {
        path: f.path,
        success: true,
        writtenHash: upsertedEntry.checksumMd5 ?? md5Hex(f.content),
      };
    }
    // Defensive: file not in upserted AND not in errors. Treat as unknown failure.
    return {
      path: f.path,
      success: false,
      error: "Shopify did not report success or error for this file",
      errorCode: "unknown",
    };
  });
}

/**
 * Map Shopify's `OnlineStoreThemeFilesUserErrorsCode` strings to our
 * internal classification. Defensive — unknown codes default to
 * `unknown` so the merchant still sees the message.
 */
function classifyUserErrorCode(code: string | null): WriteErrorCode {
  if (!code) return "unknown";
  switch (code) {
    case "ACCESS_DENIED":
    case "THEME_LIMIT_REACHED":
      return "auth";
    case "INVALID":
    case "TOO_LARGE":
    case "FILE_VALIDATION_ERROR":
    case "TEMPLATE_VALIDATION_ERROR":
      return "bad_content";
    case "THROTTLED":
      return "throttled";
    default:
      return "unknown";
  }
}
