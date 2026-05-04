/**
 * Theme GraphQL client wrappers.
 *
 * Read-only operations against the Shopify Admin GraphQL Themes API.
 * No writes here — those land in segment 3's writer.
 *
 * All calls go through `withRateLimit` so we play nice with Shopify's
 * cost-based rate limits.
 *
 * The hash convention: Shopify returns `checksumMd5` per file. Our
 * drift detector computes md5 of the artifact content on the fly to
 * compare. The artifact's `contentHash` (sha256) is a separate
 * primitive used for snapshot tests / determinism — see
 * `app/lib/compile/hash.ts` vs `app/lib/compile/md5.ts`.
 */

import { withRateLimit } from "./rate-limiter.server.ts";

/**
 * Loose-typed admin client surface — same shape used by
 * `tokens.server.ts`. We only call `.graphql(query, options?)` and
 * read JSON. Loose typing avoids coupling to either copy of
 * `@shopify/shopify-api` that the React Router adapter and root
 * package both bring in (their Session types collide).
 */
export interface AdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ status: number; json: () => Promise<unknown> }>;
}

/**
 * Filename patterns this app owns. Shopify's `files(filenames: [...])`
 * accepts `*` wildcards and filters server-side, so we never pull
 * unrelated files into our drift report.
 */
export const DEMEURER_FILENAME_PATTERNS = [
  "sections/demeurer-*",
  "templates/page.demeurer-*",
  "templates/product.demeurer-*",
  "snippets/demeurer-*",
];

export interface PublishedTheme {
  id: string; // gid://shopify/OnlineStoreTheme/...
  name: string;
  role: string;
}

export interface ThemeFileInfo {
  path: string;
  contentMd5: string;
  size: number;
  updatedAt: string;
}

export interface ThemeFileContent {
  path: string;
  content: string;
  contentMd5: string;
}

/* ----------------------------- getPublishedTheme ----------------------------- */

const PUBLISHED_THEME_QUERY = /* GraphQL */ `
  query DemeurerPublishedTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
        role
      }
    }
  }
`;

interface PublishedThemeResponse {
  data?: {
    themes?: { nodes?: Array<{ id?: string; name?: string; role?: string }> };
  };
}

export async function getPublishedTheme(
  admin: AdminClient,
  shop: string,
): Promise<PublishedTheme | null> {
  const { body } = await withRateLimit(shop, () => admin.graphql(PUBLISHED_THEME_QUERY));
  const node = (body as PublishedThemeResponse).data?.themes?.nodes?.[0];
  if (!node || !node.id) return null;
  return {
    id: node.id,
    name: node.name ?? "Unnamed theme",
    role: node.role ?? "MAIN",
  };
}

/* ----------------------------- listDemeurerFiles ----------------------------- */

const LIST_FILES_QUERY = /* GraphQL */ `
  query DemeurerListThemeFiles($themeId: ID!, $filenames: [String!], $first: Int!, $after: String) {
    theme(id: $themeId) {
      id
      files(filenames: $filenames, first: $first, after: $after) {
        edges {
          cursor
          node {
            filename
            checksumMd5
            size
            updatedAt
          }
        }
        pageInfo { endCursor hasNextPage }
        userErrors { code filename }
      }
    }
  }
`;

interface ListFilesResponse {
  data?: {
    theme?: {
      files?: {
        edges?: Array<{
          cursor?: string;
          node?: {
            filename?: string;
            checksumMd5?: string | null;
            size?: number | string | null;
            updatedAt?: string;
          };
        }>;
        pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
        userErrors?: Array<{ code?: string; filename?: string }>;
      };
    };
  };
}

interface ListCacheEntry {
  expiresAt: number;
  files: ThemeFileInfo[];
}
const LIST_CACHE_TTL_MS = 30 * 1000;
const listCache = new Map<string, ListCacheEntry>();

function listCacheKey(shop: string, themeId: string): string {
  return `${shop}::${themeId}`;
}

/**
 * List Demeurer-owned files in the merchant's theme. Metadata only
 * (filename + checksum + size + updatedAt) — content is fetched
 * separately by `readThemeFile` / `readThemeFiles` when needed.
 *
 * Cached 30 seconds per (shop, themeId). Drift checks within one
 * publish-flow UI session reuse the cache.
 */
export async function listDemeurerFiles(
  admin: AdminClient,
  themeId: string,
  shop: string,
): Promise<ThemeFileInfo[]> {
  const key = listCacheKey(shop, themeId);
  const cached = listCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.files;

  const out: ThemeFileInfo[] = [];
  let after: string | null = null;
  // Hard cap to prevent runaway pagination on a hostile / corrupt response.
  const MAX_PAGES = 20;
  for (let page = 0; page < MAX_PAGES; page++) {
    const variables: Record<string, unknown> = {
      themeId,
      filenames: DEMEURER_FILENAME_PATTERNS,
      first: 250,
    };
    if (after) variables.after = after;
    const { body } = await withRateLimit(shop, () =>
      admin.graphql(LIST_FILES_QUERY, { variables }),
    );
    const files = (body as ListFilesResponse).data?.theme?.files;
    const edges = files?.edges ?? [];
    for (const edge of edges) {
      const node = edge.node;
      if (!node?.filename || !node.checksumMd5) continue;
      out.push({
        path: node.filename,
        contentMd5: node.checksumMd5,
        size: typeof node.size === "string" ? Number(node.size) : (node.size ?? 0),
        updatedAt: node.updatedAt ?? "",
      });
    }
    if (!files?.pageInfo?.hasNextPage) break;
    after = files.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  listCache.set(key, { expiresAt: Date.now() + LIST_CACHE_TTL_MS, files: out });
  return out;
}

/** Test/dev helper. */
export function clearListDemeurerFilesCache(shop?: string, themeId?: string): void {
  if (shop && themeId) {
    listCache.delete(listCacheKey(shop, themeId));
    return;
  }
  listCache.clear();
}

/* ----------------------------- readThemeFile / readThemeFiles ----------------------------- */

const READ_FILES_QUERY = /* GraphQL */ `
  query DemeurerReadThemeFiles($themeId: ID!, $filenames: [String!]!, $first: Int!) {
    theme(id: $themeId) {
      files(filenames: $filenames, first: $first) {
        nodes {
          filename
          checksumMd5
          body {
            ... on OnlineStoreThemeFileBodyText { content }
          }
        }
        userErrors { code filename }
      }
    }
  }
`;

interface ReadFilesResponse {
  data?: {
    theme?: {
      files?: {
        nodes?: Array<{
          filename?: string;
          checksumMd5?: string | null;
          body?: { content?: string };
        }>;
        userErrors?: Array<{ code?: string; filename?: string }>;
      };
    };
  };
}

/**
 * Fetch one file's content. Not cached — used by the dev "Show diff"
 * action where freshness matters.
 */
export async function readThemeFile(
  admin: AdminClient,
  themeId: string,
  path: string,
  shop: string,
): Promise<ThemeFileContent | null> {
  const result = await readThemeFiles(admin, themeId, [path], shop);
  return result.get(path) ?? null;
}

/**
 * Batch read of file contents. Chunks `paths` into groups of 50
 * (Shopify's default `first`) and runs them in parallel through the
 * rate limiter.
 */
export async function readThemeFiles(
  admin: AdminClient,
  themeId: string,
  paths: string[],
  shop: string,
): Promise<Map<string, ThemeFileContent>> {
  const out = new Map<string, ThemeFileContent>();
  if (paths.length === 0) return out;

  const CHUNK = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += CHUNK) {
    chunks.push(paths.slice(i, i + CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { body } = await withRateLimit(shop, () =>
        admin.graphql(READ_FILES_QUERY, {
          variables: { themeId, filenames: chunk, first: chunk.length },
        }),
      );
      return (body as ReadFilesResponse).data?.theme?.files?.nodes ?? [];
    }),
  );

  for (const nodes of results) {
    for (const node of nodes) {
      if (!node?.filename) continue;
      const content = node.body?.content;
      if (typeof content !== "string") continue;
      out.set(node.filename, {
        path: node.filename,
        content,
        contentMd5: node.checksumMd5 ?? "",
      });
    }
  }
  return out;
}
