import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Block, BlockId, EditorDocument } from "./types";
import { emptyDocument, isDocument } from "./types";

/**
 * Editor store — in-memory state for one open page.
 *
 * Source-of-truth for the editing session. The route loads `Page.source`
 * from the DB, calls `loadDocument`, and from there the store owns the
 * tree until the user navigates away or `markSaved()` is called by the
 * persistence layer (next segment).
 *
 * Every mutation flips `isDirty` to true so we can show unsaved-changes
 * UI and gate navigation. `markSaved()` is the only path back to clean.
 */

export interface EditorState {
  document: EditorDocument;
  selectedBlockId: BlockId | null;
  isDirty: boolean;
  lastSavedAt: number | null;

  loadDocument: (source: unknown) => void;
  selectBlock: (id: BlockId | null) => void;
  addBlock: (block: Block, parentId?: BlockId | null, index?: number) => void;
  updateBlock: (id: BlockId, patch: BlockPatch) => void;
  removeBlock: (id: BlockId) => void;
  moveBlock: (id: BlockId, newParentId: BlockId | null, newIndex: number) => void;
  markSaved: () => void;
}

/** Fields a caller may patch on a block. `id` and `children` are not patchable here. */
export type BlockPatch = {
  type?: string;
  props?: Record<string, unknown>;
};

/**
 * Find a block and its containing array (parent's children, or the doc's
 * top-level blocks). Returns null if not found. Used by mutators below.
 */
function findContainerAndIndex(
  blocks: Block[],
  id: BlockId,
): { container: Block[]; index: number } | null {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) return { container: blocks, index: i };
    const inChild = findContainerAndIndex(blocks[i].children, id);
    if (inChild) return inChild;
  }
  return null;
}

/** Find a block by id (depth-first). Returns null if not found. */
function findBlock(blocks: Block[], id: BlockId): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inChild = findBlock(b.children, id);
    if (inChild) return inChild;
  }
  return null;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    document: emptyDocument(),
    selectedBlockId: null,
    isDirty: false,
    lastSavedAt: null,

    loadDocument: (source) =>
      set((state) => {
        // Loader hands us `unknown` from Prisma's Json column. Validate
        // shape before trusting it; fall back to an empty doc otherwise.
        // This also covers brand-new pages where source is `{ blocks: [] }`
        // (missing the `version` field) — we coerce to a valid v1 doc.
        if (isDocument(source)) {
          state.document = source;
        } else if (
          source &&
          typeof source === "object" &&
          Array.isArray((source as { blocks?: unknown }).blocks)
        ) {
          state.document = { version: 1, blocks: [] };
        } else {
          state.document = emptyDocument();
        }
        state.selectedBlockId = null;
        state.isDirty = false;
        state.lastSavedAt = null;
      }),

    selectBlock: (id) =>
      set((state) => {
        state.selectedBlockId = id;
        // Selection alone doesn't dirty the document.
      }),

    addBlock: (block, parentId, index) =>
      set((state) => {
        const target =
          parentId == null
            ? state.document.blocks
            : findBlock(state.document.blocks, parentId)?.children;
        if (!target) return;
        const insertAt = index ?? target.length;
        target.splice(insertAt, 0, block);
        state.isDirty = true;
      }),

    updateBlock: (id, patch) =>
      set((state) => {
        const block = findBlock(state.document.blocks, id);
        if (!block) return;
        if (patch.type !== undefined) block.type = patch.type;
        if (patch.props !== undefined) block.props = patch.props;
        state.isDirty = true;
      }),

    removeBlock: (id) =>
      set((state) => {
        const found = findContainerAndIndex(state.document.blocks, id);
        if (!found) return;
        found.container.splice(found.index, 1);
        if (state.selectedBlockId === id) state.selectedBlockId = null;
        state.isDirty = true;
      }),

    moveBlock: (id, newParentId, newIndex) =>
      set((state) => {
        const found = findContainerAndIndex(state.document.blocks, id);
        if (!found) return;
        const [block] = found.container.splice(found.index, 1);
        const target =
          newParentId == null
            ? state.document.blocks
            : findBlock(state.document.blocks, newParentId)?.children;
        if (!target) {
          // Couldn't find the new parent — restore the block to avoid
          // silently losing it. Caller passed a bad id.
          found.container.splice(found.index, 0, block);
          return;
        }
        // Disallow moving a block into its own descendant. Walk children.
        const wouldCycle = (b: Block): boolean =>
          b.id === newParentId || b.children.some(wouldCycle);
        if (newParentId != null && wouldCycle(block)) {
          found.container.splice(found.index, 0, block);
          return;
        }
        const clamped = Math.max(0, Math.min(newIndex, target.length));
        target.splice(clamped, 0, block);
        state.isDirty = true;
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false;
        state.lastSavedAt = Date.now();
      }),
  })),
);
