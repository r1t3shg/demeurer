/**
 * sha256-hex helper for compile artifact `contentHash` values.
 *
 * Uses Node's built-in `crypto`. The compile pipeline is server-side
 * only — never imported from a browser bundle. (The "Show compiled
 * output" dev tool fetches the API endpoint; it never calls `compilePage`
 * directly.)
 */

import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
