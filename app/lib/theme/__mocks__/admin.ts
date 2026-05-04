/**
 * Mock AdminClient for tests.
 *
 * The drift tests can't hit a real Shopify dev store. This stub returns
 * canned GraphQL responses based on the operation it sees in the query
 * string. Three operations are supported (matches the surface in
 * `client.server.ts`):
 *
 *   - DemeurerPublishedTheme  → themes(roles: [MAIN])
 *   - DemeurerListThemeFiles  → theme(id).files(filenames, first, after)
 *   - DemeurerReadThemeFiles  → theme(id).files(filenames, first) with body
 *
 * Switching on operation name in the query string is fragile; works for
 * our small surface. If theme-client grows we'll move to a typed
 * handler map keyed by operation name.
 */

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

export function makeMockAdmin(theme: MockTheme | null): AdminClient {
  return {
    async graphql(query, options) {
      const body = handle(query, options?.variables ?? {}, theme);
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
