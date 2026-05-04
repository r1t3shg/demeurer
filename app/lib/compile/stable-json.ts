/**
 * Deterministic JSON serializer for compile output.
 *
 * Standard `JSON.stringify` preserves object insertion order, which is
 * usually fine in V8 but not contractually guaranteed across engines or
 * across object spreads. The compile artifact's `contentHash` must be
 * byte-identical for the same input or segment 3's idempotency check
 * fails.
 *
 * Rules:
 *  - Object keys at every level are sorted alphabetically.
 *  - Array order is preserved (template `order` and `block_order` are
 *    user-meaningful sequences).
 *  - Indentation is 2 spaces. Trailing newline added by callers if
 *    required.
 *
 * `preserveKeyOrderFor`: opt-out for objects whose key order is
 * semantically meaningful and stable. Currently unused — included so
 * future callers (e.g. emitting a fixed-order Shopify schema settings
 * array) can avoid round-tripping through arrays. Settings arrays are
 * already arrays so they preserve order naturally.
 */

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(sort(value), null, indent);
}

function sort(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sort);
  if (typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sort(obj[key]);
  }
  return out;
}
