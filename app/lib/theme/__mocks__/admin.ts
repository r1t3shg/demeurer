/**
 * Mock AdminClient for tests.
 *
 * The drift / writer tests can't hit a real Shopify dev store. This
 * stub returns canned GraphQL responses based on the operation it
 * sees in the query string. Operations supported:
 *
 *   - DemeurerPublishedTheme    → themes(roles: [MAIN])
 *   - DemeurerListThemeFiles    → theme(id).files(filenames, first, after)
 *   - DemeurerReadThemeFiles    → theme(id).files(filenames, first) with body
 *   - DemeurerWriteThemeFiles   → themeFilesUpsert(themeId, files)
 *
 * Switching on operation name in the query string is fragile; works
 * for our small surface. The mock is stateful — `themeFilesUpsert`
 * mutates the in-memory file map, so subsequent list/read calls see
 * the new bytes. This lets apply tests assert end-to-end behavior.
 */

import { md5Hex } from "../../compile/md5.ts";
import type { AdminClient } from "../client.server.ts";

export interface MockThemeFile {
  path: string;
  content: string;
  contentMd5: string;
  size?: number;
  updatedAt?: string;
}

export interface MockTheme {
  id: string;
  name: string;
  role: string;
  files: MockThemeFile[];
}

/** Per-test failure injection: simulate a Shopify userError for a path. */
export interface MockSimulateFailure {
  /** Shopify error code, e.g. "INVALID", "ACCESS_DENIED". */
  code: string;
  message: string;
}

export interface MockOptions {
  /**
   * If set, every graphql() call returns this HTTP status. Used by the
   * writer tests to simulate 401 / 5xx.
   */
  forceHttpStatus?: number;
  /**
   * Map of path → failure to simulate when that path is in a
   * themeFilesUpsert call. Other paths in the same batch succeed.
   */
  simulateFailures?: Record<string, MockSimulateFailure>;
  /**
   * Records every theme-write request (in order) for assertions about
   * batching and phase ordering.
   */
  recordWrites?: Array<{ filenames: string[] }>;
}

export function makeMockAdmin(
  theme: MockTheme | null,
  options: MockOptions = {},
): AdminClient {
  return {
    async graphql(query, callOpts) {
      if (options.forceHttpStatus && options.forceHttpStatus !== 200) {
        const status = options.forceHttpStatus;
        return {
          status,
          async json() {
            return { errors: [{ message: `HTTP ${status}` }] };
          },
        };
      }
      const body = handle(query, callOpts?.variables ?? {}, theme, options);
      return {
        status: 200,
        async json() {
          return body;
        },
      };
    },
  };
}

function handle(
  query: string,
  variables: Record<string, unknown>,
  theme: MockTheme | null,
  options: MockOptions = {},
): unknown {
  // Match by operation name embedded in the query.
  if (query.includes("DemeurerPublishedTheme")) {
    if (!theme) return { data: { themes: { nodes: [] } } };
    return {
      data: {
        themes: {
          nodes: [{ id: theme.id, name: theme.name, role: theme.role }],
        },
      },
    };
  }

  if (query.includes("DemeurerListThemeFiles")) {
    const filenames = (variables.filenames as string[] | undefined) ?? [];
    const matched = theme
      ? theme.files.filter((f) => matchesAnyPattern(f.path, filenames))
      : [];
    return {
      data: {
        theme: theme
          ? {
              id: theme.id,
              files: {
                edges: matched.map((f) => ({
                  cursor: f.path,
                  node: {
                    filename: f.path,
                    checksumMd5: f.contentMd5,
                    size: f.size ?? f.content.length,
                    updatedAt: f.updatedAt ?? "2026-01-01T00:00:00Z",
                  },
                })),
                pageInfo: { endCursor: null, hasNextPage: false },
                userErrors: [],
              },
            }
          : null,
      },
    };
  }

  if (query.includes("DemeurerReadThemeFiles")) {
    const filenames = (variables.filenames as string[] | undefined) ?? [];
    const matched = theme
      ? theme.files.filter((f) => filenames.includes(f.path))
      : [];
    return {
      data: {
        theme: theme
          ? {
              files: {
                nodes: matched.map((f) => ({
                  filename: f.path,
                  checksumMd5: f.contentMd5,
                  body: { content: f.content },
                })),
                userErrors: [],
              },
            }
          : null,
      },
    };
  }

  if (query.includes("DemeurerWriteThemeFiles")) {
    const inputFiles = (variables.files as Array<{
      filename?: string;
      body?: { type?: string; value?: string };
    }>) ?? [];
    if (options.recordWrites) {
      options.recordWrites.push({
        filenames: inputFiles.map((f) => f.filename ?? "?"),
      });
    }
    if (!theme) {
      return {
        data: {
          themeFilesUpsert: {
            upsertedThemeFiles: [],
            userErrors: inputFiles.map((f) => ({
              code: "ACCESS_DENIED",
              filename: f.filename ?? null,
              field: ["themeId"],
              message: "No theme to write to",
            })),
          },
        },
      };
    }

    const upserted: Array<{ filename: string; checksumMd5: string; size: number }> = [];
    const userErrors: Array<{ code: string; filename: string; field: string[]; message: string }> = [];

    for (const f of inputFiles) {
      const path = f.filename;
      const value = f.body?.value;
      if (!path || typeof value !== "string") {
        userErrors.push({
          code: "INVALID",
          filename: path ?? "",
          field: ["body"],
          message: "Missing filename or body",
        });
        continue;
      }
      const sim = options.simulateFailures?.[path];
      if (sim) {
        userErrors.push({
          code: sim.code,
          filename: path,
          field: ["files"],
          message: sim.message,
        });
        continue;
      }
      // Mutate the in-memory map. New file → push; existing → replace.
      const md5 = md5Hex(value);
      const existing = theme.files.findIndex((tf) => tf.path === path);
      const now = new Date().toISOString();
      if (existing >= 0) {
        theme.files[existing] = {
          path,
          content: value,
          contentMd5: md5,
          size: value.length,
          updatedAt: now,
        };
      } else {
        theme.files.push({
          path,
          content: value,
          contentMd5: md5,
          size: value.length,
          updatedAt: now,
        });
      }
      upserted.push({ filename: path, checksumMd5: md5, size: value.length });
    }

    return {
      data: {
        themeFilesUpsert: {
          upsertedThemeFiles: upserted,
          userErrors,
        },
      },
    };
  }

  // Unknown operation — return an empty data envelope. Tests should
  // never hit this branch; if they do, the failing assertion will
  // surface the missing handler.
  return { data: null };
}

function matchesAnyPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(path, pattern)) return true;
  }
  return false;
}

/** Minimal `*` glob — Shopify's filenames argument supports `*`. */
function matchesPattern(path: string, pattern: string): boolean {
  if (!pattern.includes("*")) return path === pattern;
  // Escape regex specials except *, then replace * with .*.
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      "$",
  );
  return re.test(path);
}
