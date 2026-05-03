import { nanoid } from "nanoid";

/**
 * Generate a new opaque block id.
 *
 * 12 chars of nanoid alphabet (~71 bits of entropy) — collision-safe for
 * any realistic page size while staying short enough to read in URLs and
 * logs. Block ids are local to a document; they don't need to be globally
 * unique across shops.
 */
export function newBlockId(): string {
  return nanoid(12);
}
