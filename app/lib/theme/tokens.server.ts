/**
 * Best-effort fetch of theme tokens (colors, fonts, spacing) for the
 * canvas preview. The merchant's published theme is the source of truth
 * for the live storefront — we just want the canvas to look close
 * enough that "is this hero readable on my brand?" answers itself.
 *
 * Source: Admin GraphQL `themes(roles: [MAIN])` → `files(filenames:
 * ["config/settings_data.json"])`. Settings keys are theme-dependent;
 * we map the well-known Dawn keys (most popular default theme) and
 * fall back to neutral defaults when a key is missing.
 *
 * Architectural commitment: this function MUST never throw. A broken
 * theme fetch must not break the editor. Errors log to console and the
 * caller gets default tokens.
 *
 * Cache: 5-minute in-memory per shop. Process-local — fine for the
 * single-tenant single-region setup; revisit when we scale out.
 */

import type { ThemeTokens } from "../sections";

export interface ThemeTokensResult {
  tokens: ThemeTokens;
  /** Display name of the main theme, or null if we couldn't fetch it. */
  themeName: string | null;
}

interface CacheEntry {
  expiresAt: number;
  result: ThemeTokensResult;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const DEFAULT_TOKENS: ThemeTokens = {
  colors: {
    background: "#ffffff",
    text: "#1a1a1a",
    accent: "#1a73e8",
  },
  typography: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    scale: 1,
  },
  spacing: { unit: 8 },
};

const DEFAULT_RESULT: ThemeTokensResult = {
  tokens: DEFAULT_TOKENS,
  themeName: null,
};

/**
 * Minimal admin client surface we use here. Loose-typed to avoid
 * coupling to either copy of `@shopify/shopify-api` that the React
 * Router adapter and root package both bring in (their Session types
 * collide). We only call `.graphql(query)` and read JSON.
 */
interface AdminClient {
  graphql: (query: string) => Promise<{ json: () => Promise<unknown> }>;
}

export async function getThemeTokens(
  admin: AdminClient,
  shop: string,
): Promise<ThemeTokensResult> {
  const cached = cache.get(shop);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const result = await fetchTokens(admin);
    cache.set(shop, { expiresAt: Date.now() + TTL_MS, result });
    return result;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[demeurer] getThemeTokens failed, using defaults", err);
    // Cache the default briefly so a broken theme doesn't hammer us.
    cache.set(shop, {
      expiresAt: Date.now() + 60 * 1000,
      result: DEFAULT_RESULT,
    });
    return DEFAULT_RESULT;
  }
}

/** Test/dev helper. */
export function clearThemeTokensCache(shop?: string): void {
  if (shop) cache.delete(shop);
  else cache.clear();
}

const QUERY = /* GraphQL */ `
  query DemeurerMainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
        files(filenames: ["config/settings_data.json"]) {
          nodes {
            body {
              ... on OnlineStoreThemeFileBodyText {
                content
              }
            }
          }
        }
      }
    }
  }
`;

interface QueryResponse {
  data?: {
    themes?: {
      nodes?: Array<{
        id?: string;
        name?: string;
        files?: {
          nodes?: Array<{
            body?: { content?: string };
          }>;
        };
      }>;
    };
  };
}

async function fetchTokens(admin: AdminClient): Promise<ThemeTokensResult> {
  const res = await admin.graphql(QUERY);
  const json = (await res.json()) as QueryResponse;
  const theme = json?.data?.themes?.nodes?.[0];
  if (!theme) return DEFAULT_RESULT;

  const themeName = theme.name ?? null;
  const content = theme.files?.nodes?.[0]?.body?.content;
  if (!content) {
    return { tokens: DEFAULT_TOKENS, themeName };
  }

  const settings = parseSettings(content);
  if (!settings) {
    return { tokens: DEFAULT_TOKENS, themeName };
  }

  return {
    tokens: mapSettingsToTokens(settings),
    themeName,
  };
}

function parseSettings(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json) as {
      current?: string | Record<string, unknown>;
      presets?: Record<string, Record<string, unknown>>;
    };
    if (!parsed.current) return null;
    if (typeof parsed.current === "string") {
      return parsed.presets?.[parsed.current] ?? null;
    }
    return parsed.current;
  } catch {
    return null;
  }
}

function mapSettingsToTokens(s: Record<string, unknown>): ThemeTokens {
  return {
    colors: {
      background:
        readColor(s, "colors_background_1") ??
        readColor(s, "colors_background") ??
        DEFAULT_TOKENS.colors.background,
      text:
        readColor(s, "colors_text") ??
        readColor(s, "colors_foreground") ??
        DEFAULT_TOKENS.colors.text,
      accent:
        readColor(s, "colors_solid_button_background") ??
        readColor(s, "colors_accent_1") ??
        readColor(s, "colors_accent") ??
        DEFAULT_TOKENS.colors.accent,
    },
    typography: {
      headingFont:
        readFontFamily(s, "type_header_font") ??
        DEFAULT_TOKENS.typography.headingFont,
      bodyFont:
        readFontFamily(s, "type_body_font") ??
        DEFAULT_TOKENS.typography.bodyFont,
      scale: 1,
    },
    spacing: {
      unit: DEFAULT_TOKENS.spacing.unit,
    },
  };
}

function readColor(
  s: Record<string, unknown>,
  key: string,
): string | null {
  const v = s[key];
  if (typeof v !== "string") return null;
  // Shopify color settings are hex strings; some themes prefix with "#".
  if (/^#?[0-9a-fA-F]{3,8}$/.test(v.trim())) {
    return v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`;
  }
  return null;
}

function readFontFamily(
  s: Record<string, unknown>,
  key: string,
): string | null {
  const v = s[key];
  if (typeof v !== "string") return null;
  // Shopify font settings look like "assistant_n4" — the segment before
  // the first underscore is the family name. We can't load the font,
  // but naming it lets the browser reach for it if it's installed.
  const family = v.split("_")[0];
  if (!family) return null;
  const cleaned = family.charAt(0).toUpperCase() + family.slice(1);
  return `"${cleaned}", system-ui, -apple-system, sans-serif`;
}
