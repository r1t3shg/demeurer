import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { MAX_HISTORY, snapshotDocument } from "./history";
import type { Block, BlockId, EditorDocument } from "./types";
import { emptyDocument, isDocument } from "./types";

/**
 * Editor store — in-memory state for one open page.
 *
 * Source-of-truth for the editing session. The route loads `Page.source`
 * from the DB, calls `loadDocument`, and from there the store owns the
 * tree until the user navigates away or `markSaved()` is called by the
 * autosave hook on a successful POST to /app/api/pages/:id/save.
 *
 * Every mutation:
 *  - flips `isDirty` to true (so the autosave hook fires),
 *  - pushes the *previous* document state onto `history` and clears
 *    `future` (so a fresh edit invalidates redo).
 *
 * Undo/redo are first-class: see `undo` / `redo` below. They mark the
 * document dirty so the autosave hook treats them like any other edit
 * and persists the result.
 *
 * `markSaved()` is the only path back to clean.
 */

export interface EditorState {
  document: EditorDocument;
  selectedBlockId: BlockId | null;
  isDirty: boolean;
  lastSavedAt: number | null;

  history: EditorDocument[];
  future: EditorDocument[];
  /**
   * Bookkeeping value equal to `history.length`. Useful for triggering
   * effects that should fire on any history change (e.g. localStorage
   * mirroring) without subscribing to the whole history array.
   */
  historyCursor: number;

  loadDocument: (source: unknown) => void;
  selectBlock: (id: BlockId | null) => void;
  addBlock: (block: Block, parentId?: BlockId | null, index?: number) => void;
  updateBlock: (id: BlockId, patch: BlockPatch) => void;
  /**
   * Replace a block's props WITHOUT pushing onto the history stack.
   * Used by the temporary JSON textarea in the properties panel — it
   * fires on every keystroke, so funneling each character through the
   * undo system would shred history. P1.B replaces the textarea with
   * proper per-block forms; this action goes away with it.
   */
  replaceBlockProps: (id: BlockId, props: Record<string, unknown>) => void;
  removeBlock: (id: BlockId) => void;
  moveBlock: (id: BlockId, newParentId: BlockId | null, newIndex: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
  immer((set, get) => {
    /**
     * Push a snapshot of the document onto history and reset future.
     * Call this from inside a `set((state) => ...)` block, AFTER you've
     * confirmed the mutation will go through (so we don't push no-op
     * entries that would make Cmd+Z a no-op the first time).
     */
    const recordHistory = (state: EditorState, before: EditorDocument) => {
      state.history.push(before);
      if (state.history.length > MAX_HISTORY) state.history.shift();
      state.future = [];
      state.historyCursor = state.history.length;
    };

    return {
      document: emptyDocument(),
      selectedBlockId: null,
      isDirty: false,
      lastSavedAt: null,
      history: [],
      future: [],
      historyCursor: 0,

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
          // Loading a new document discards undo history — you can't
          // undo "into" a different page.
          state.history = [];
          state.future = [];
          state.historyCursor = 0;
        }),

      selectBlock: (id) =>
        set((state) => {
          state.selectedBlockId = id;
          // Selection alone doesn't dirty the document or push history.
        }),

      addBlock: (block, parentId, index) => {
        const before = snapshotDocument(get().document);
        set((state) => {
          const target =
            parentId == null
              ? state.document.blocks
              : findBlock(state.document.blocks, parentId)?.children;
          if (!target) return;
          recordHistory(state, before);
          const insertAt = index ?? target.length;
          target.splice(insertAt, 0, block);
          state.isDirty = true;
        });
      },

      updateBlock: (id, patch) => {
        const before = snapshotDocument(get().document);
        set((state) => {
          const block = findBlock(state.document.blocks, id);
          if (!block) return;
          recordHistory(state, before);
          if (patch.type !== undefined) block.type = patch.type;
          if (patch.props !== undefined) block.props = patch.props;
          state.isDirty = true;
        });
      },

      replaceBlockProps: (id, props) =>
        set((state) => {
          const block = findBlock(state.document.blocks, id);
          if (!block) return;
          block.props = props;
          state.isDirty = true;
          // Deliberately NOT calling recordHistory — see the action's
          // doc comment in the EditorState interface.
        }),

      removeBlock: (id) => {
        const before = snapshotDocument(get().document);
        set((state) => {
          const found = findContainerAndIndex(state.document.blocks, id);
          if (!found) return;
          recordHistory(state, before);
          found.container.splice(found.index, 1);
          if (state.selectedBlockId === id) state.selectedBlockId = null;
          state.isDirty = true;
        });
      },

      moveBlock: (id, newParentId, newIndex) => {
        const before = snapshotDocument(get().document);
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
          recordHistory(state, before);
          const clamped = Math.max(0, Math.min(newIndex, target.length));
          target.splice(clamped, 0, block);
          state.isDirty = true;
        });
      },

      undo: () => {
        const before = snapshotDocument(get().document);
        set((state) => {
          if (state.history.length === 0) return;
          const prev = state.history.pop();
          if (!prev) return;
          state.future.push(before);
          state.document = prev;
          state.historyCursor = state.history.length;
          // Treat the undo as a normal edit so the autosave hook persists
          // it — that way, an undo survives a page refresh.
          state.isDirty = true;
        });
      },

      redo: () => {
        const before = snapshotDocument(get().document);
        set((state) => {
          if (state.future.length === 0) return;
          const next = state.future.pop();
          if (!next) return;
          state.history.push(before);
          if (state.history.length > MAX_HISTORY) state.history.shift();
          state.document = next;
          state.historyCursor = state.history.length;
          state.isDirty = true;
        });
      },

      canUndo: () => get().history.length > 0,
      canRedo: () => get().future.length > 0,

      markSaved: () =>
        set((state) => {
          state.isDirty = false;
          state.lastSavedAt = Date.now();
        }),
    };
  }),
);
