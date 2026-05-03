import db from "../db.server";

/**
 * Slugify a string into a URL-safe handle:
 *   "  Hello World!  " -> "hello-world"
 *   "Café & Co."       -> "cafe-co"
 *
 * Handwritten (no slugify lib) — keeps the dependency surface small. Strips
 * combining diacritics, lowercases, replaces non-alphanumerics with `-`, and
 * collapses/trims runs of `-`.
 */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Generate a handle for a new page that is unique within the shop.
 *
 * If the slugified title is already taken for the shop, append `-2`, `-3`, …
 * until a free handle is found. Falls back to `untitled` if the title
 * slugifies to the empty string.
 */
export async function generateUniqueHandle(
  shop: string,
  title: string,
): Promise<string> {
  const base = slugify(title) || "untitled";

  // Pull existing handles in the shop's namespace once and dedupe in memory.
  // Cheaper than N round-trips for the rare collision case.
  const existing = await db.page.findMany({
    where: { shop, handle: { startsWith: base } },
    select: { handle: true },
  });
  const taken = new Set(existing.map((p) => p.handle));

  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
