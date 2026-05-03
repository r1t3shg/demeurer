/**
 * Editor document types — the in-memory shape of `Page.source`.
 *
 * The editor's source-of-truth is a tree of blocks. Each block has a stable
 * id, a string `type` discriminator, an opaque `props` bag, and an array of
 * child blocks. The compile pipeline (later segment) walks this tree to emit
 * a Liquid section file. We deliberately keep `props` loose (`Record<string,
 * unknown>`) here — concrete prop schemas will live alongside each block's
 * renderer/inspector.
 */

export type BlockId = string;

export interface Block {
  id: BlockId;
  type: string;
  props: Record<string, unknown>;
  children: Block[];
}

export interface EditorDocument {
  /** Schema version. Bump when the persisted shape changes incompatibly. */
  version: 1;
  /** Top-level block tree. Empty array = blank page. */
  blocks: Block[];
}

/** Returns a fresh, empty document. */
export function emptyDocument(): EditorDocument {
  return { version: 1, blocks: [] };
}

/** Narrowing guard for unknown JSON values pulled from the DB. */
export function isBlock(value: unknown): value is Block {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.type === "string" &&
    typeof v.props === "object" &&
    v.props !== null &&
    Array.isArray(v.children) &&
    v.children.every(isBlock)
  );
}

/**
 * Narrowing guard for unknown JSON values pulled from `Page.source`. Use
 * this at the loader boundary before handing data to the store, since
 * Prisma's `Json` column gives us `unknown` and we can't trust the shape.
 */
export function isDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 && Array.isArray(v.blocks) && v.blocks.every(isBlock)
  );
}
