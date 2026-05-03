/**
 * Best-effort fetch of the merchant's theme stylesheet URLs for the
 * canvas iframe.
 *
 * Approach: GET the storefront homepage (`https://<shop>/`) and pluck
 * `<link rel="stylesheet" href="…">` URLs out of the response. This is
 * theme-agnostic — Dawn, Debut, third-party themes, all expose their
 * CSS the same way. We resolve relative URLs to absolute and only keep
 * `https://*.shopify.com` / `https://cdn.shopify.com` so a hostile
 * theme can't get us to embed unrelated origins.
 *
 * Cache: 5-minute in-memory per shop. Fine for single-process dev;
 * revisit on horizontal scale.
 *
 * Architectural commitment: never throws. A blocked storefront, network
 * blip, or absent home page just yields `[]` and the canvas falls back
 * to its inline-styled rendering.
 */

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  urls: string[];
}

const cache = new Map<string, CacheEntry>();

export async function getThemeStylesheets(shop: string): Promise<string[]> {
  const cached = cache.get(shop);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.urls;
  }

  try {
    const urls = await fetchStylesheets(shop);
    cache.set(shop, { expiresAt: Date.now() + TTL_MS, urls });
    return urls;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[demeurer] getThemeStylesheets failed", err);
    cache.set(shop, { expiresAt: Date.now() + 60 * 1000, urls: [] });
    return [];
  }
}

export function clearThemeStylesheetsCache(shop?: string): void {
  if (shop) cache.delete(shop);
  else cache.clear();
}

async function fetchStylesheets(shop: string): Promise<string[]> {
  const url = `https://${shop}/`;
  const res = await fetch(url, {
    headers: { "user-agent": "Demeurer-Preview/1.0" },
    redirect: "follow",
  });
  if (!res.ok) return [];
  const html = await res.text();
  return extractStylesheetHrefs(html, url);
}

const LINK_RE = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi;
const HREF_RE = /\bhref\s*=\s*["']([^"']+)["']/i;

function extractStylesheetHrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex defensively in case the regex object is reused.
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(html)) !== null) {
    const tag = match[0];
    const hrefMatch = HREF_RE.exec(tag);
    if (!hrefMatch) continue;
    const raw = hrefMatch[1];
    const abs = resolveAbsolute(raw, base);
    if (!abs) continue;
    if (!isAllowedOrigin(abs)) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

function resolveAbsolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isAllowedOrigin(absolute: string): boolean {
  try {
    const u = new URL(absolute);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    return (
      h === "cdn.shopify.com" ||
      h.endsWith(".shopify.com") ||
      h.endsWith(".shopifycdn.com") ||
      h.endsWith(".myshopify.com")
    );
  } catch {
    return false;
  }
}
