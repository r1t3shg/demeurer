/**
 * md5 hex helper.
 *
 * Why md5 instead of sha256: Shopify's GraphQL Theme API returns
 * `checksumMd5` per file. Drift detection compares hashes string-wise,
 * so we compute md5 over our compile artifact's content to match.
 *
 * The compile artifact's `contentHash` (sha256, in `hash.ts`) stays as
 * is — that's our internal idempotency primitive (snapshot tests, the
 * "compile twice, hashes match" assertion). md5 here is purely the
 * Shopify-compat layer for theme reads/writes.
 *
 * Yes, md5 is cryptographically broken. Doesn't matter — it's a content
 * fingerprint for drift comparison, not an integrity guarantee.
 */

import { createHash } from "node:crypto";

export function md5Hex(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}
