/**
 * Product token replacement.
 *
 * Merchants on a product page can author text like:
 *
 *   Welcome to {{product.title}} — only {{product.price}}!
 *
 * The compile pipeline runs this through `replaceProductTokens` for
 * every text/richtext setting on a `productAware` section. The output
 * is real Liquid that Shopify renders at runtime against the bound
 * product:
 *
 *   Welcome to {{ product.title }} — only {{ product.price | money }}!
 *
 * Documented at `docs/product-tokens.md`.
 *
 * Scope: text and richtext fields ONLY. URL, select, color, number,
 * boolean, image, and spacing fields are not scanned (deliberate
 * narrow allowlist; prevents accidental tokenization of color hex
 * strings or URL paths).
 *
 * Unrecognized tokens (`{{product.something_else}}`) are left in
 * place verbatim; one warning diagnostic is emitted per occurrence so
 * the compile output flags the typo to the merchant.
 */

import type { Diagnostic } from "./types.ts";

/**
 * Map: editor token (left side, no spaces) → Liquid output (right
 * side, properly spaced for Shopify Liquid). Order doesn't matter
 * (we replace by exact key match).
 */
export const PRODUCT_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  "{{product.title}}": "{{ product.title }}",
  "{{product.handle}}": "{{ product.handle }}",
  "{{product.vendor}}": "{{ product.vendor }}",
  "{{product.type}}": "{{ product.type }}",
  "{{product.price}}": "{{ product.price | money }}",
  "{{product.compare_at_price}}": "{{ product.compare_at_price | money }}",
  "{{product.description}}": "{{ product.description }}",
  "{{product.url}}": "{{ product.url }}",
  "{{product.featured_image}}":
    "{{ product.featured_image | image_url: width: 2400 }}",
});

/**
 * The set of token keys (for use by the editor's "Insert product
 * data" affordance). Stable order matches the documented set.
 */
export const PRODUCT_TOKEN_KEYS: readonly string[] = Object.freeze(
  Object.keys(PRODUCT_TOKENS),
);

const UNKNOWN_TOKEN_RE = /\{\{\s*product\.([a-zA-Z0-9_]+)\s*\}\}/g;
const KNOWN_TOKEN_RE = /\{\{product\.[a-zA-Z0-9_]+\}\}/g;

/**
 * Replace recognized tokens in `value`. Pushes a warning diagnostic
 * for any `{{product.X}}` occurrence that isn't in the documented
 * map. Returns the transformed string.
 *
 * `blockId` and `field` flow into diagnostics for traceability.
 */
export function replaceProductTokens(
  value: string,
  diagnostics: Diagnostic[],
  blockId?: string,
  field?: string,
): string {
  if (!value || typeof value !== "string") return value;
  // First, swap recognized tokens.
  let out = value;
  for (const [from, to] of Object.entries(PRODUCT_TOKENS)) {
    if (out.includes(from)) {
      // Replace all occurrences. Use split/join to avoid regex special
      // chars in the search string.
      out = out.split(from).join(to);
    }
  }
  // Second, scan the result for any remaining `{{product.X}}` /
  // `{{ product.X }}` that wasn't replaced. Those are typos or new
  // tokens we don't support.
  //
  // We deliberately match BOTH our editor-token form (no spaces) and
  // the Liquid-spaced form, because:
  //   - The editor-token form means "merchant tried to insert a token
  //     we don't recognize" (typo).
  //   - The Liquid-spaced form means "merchant wrote raw Liquid in a
  //     text field" — also worth flagging.
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  KNOWN_TOKEN_RE.lastIndex = 0;
  while ((m = KNOWN_TOKEN_RE.exec(out)) !== null) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    diagnostics.push({
      level: "warning",
      message: `Unrecognized product token: ${m[0]}. See docs/product-tokens.md for supported tokens.`,
      blockId,
      field,
    });
  }
  // Don't flag Liquid-spaced unknowns inside richtext — too noisy
  // (HTML attributes can contain `{{ }}` from theme contexts in
  // pasted content). We only flag the editor-token form for now.
  void UNKNOWN_TOKEN_RE;
  return out;
}
