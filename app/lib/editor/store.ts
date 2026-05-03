import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { MAX_HISTORY, snapshotDocument } from "./history.ts";
import type {
  Block,
  BlockId,
  Breakpoint,
  EditorDocument,
  PropsByBreakpoint,
} from "./types";
import { emptyDocument, migrateDocument, wrapMobileProps } from "./types.ts";

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
 *
 * Responsive model (P1.C):
 *  - `activeBreakpoint` tracks which breakpoint the editor UI is
 *    currently showing. It's editor UI state, NOT a per-document
 *    property — the document is breakpoint-agnostic. We persist it to
 *    localStorage so the editor remembers the merchant's last choice
 *    across reloads.
 *  - Every block's props is now a `PropsByBreakpoint` (mobile +
 *    optional tablet/desktop overrides). Read via `resolveProps` from
 *    `./resolve.ts`; mutate via `setProp` etc. from `./mutations.ts`.
 *  - `addBlock` auto-wraps a flat props bag into the canonical shape so
 *    section authors who write `{ ...defaults }` Just Work.
 */

const ACTIVE_BREAKPOINT_KEY = "demeurer:editor:activeBreakpoint";
const DEFAULT_BREAKPOINT: Breakpoint = "mobile";

function loadStoredBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return DEFAULT_BREAKPOINT;
  try {
    const raw = window.localStorage.getItem(ACTIVE_BREAKPOINT_KEY);
    if (raw === "mobile" || raw === "tablet" || raw === "desktop") {
      return raw;
    }
  } catch {
    // private mode / quota — fall through to default.
  }
  return DEFAULT_BREAKPOINT;
}

function persistBreakpoint(bp: Breakpoint): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_BREAKPOINT_KEY, bp);
  } catch {
    // Best effort — autosave still fires, the editor still works, the
    // merchant just loses cross-reload memory of their breakpoint.
  }
}

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

  /**
   * Active editor breakpoint. Drives Canvas resolution + iframe URL.
   * Editor UI state — never written to the document.
   */
  activeBreakpoint: Breakpoint;

  loadDocument: (source: unknown) => void;
  selectBlock: (id: BlockId | null) => void;
  addBlock: (block: Block, parentId?: BlockId | null, index?: number) => void;
  /**
   * @deprecated Prefer `setProp` from `./mutations.ts` for breakpoint-
   * aware writes. Kept for compatibility: when `patch.props` is
   * provided, the value is treated as a MOBILE-LAYER replacement (the
   * existing call sites all expect "current behavior", which is now
   * mobile-canonical).
   */
  updateBlock: (id: BlockId, patch: BlockPatch) => void;
  /**
   * Replace a block's mobile-layer props WITHOUT pushing onto the
   * history stack. Used by the properties-panel keystroke path — it
   * fires on every character, so funneling each through the undo
   * system would shred history.
   *
   * Tablet/desktop overrides on the block are left untouched.
   *
   * Segment 3 (override badges + per-breakpoint editing UI) will route
   * keystroke writes through `mutations.setProp` with the active
   * breakpoint; this action will likely shrink to mobile-only at that
   * point.
   */
  replaceBlockProps: (id: BlockId, mobileProps: Record<string, unknown>) => void;
  /**
   * Low-level helper: apply a recipe function to a block's
   * `PropsByBreakpoint` under immer. Used by the breakpoint-aware
   * mutation helpers in `./mutations.ts`. Pushes history.
   */
  mutateBlockProps: (
    id: BlockId,
    recipe: (props: PropsByBreakpoint) => void,
  ) => void;
  removeBlock: (id: BlockId) => void;
  moveBlock: (id: BlockId, newParentId: BlockId | null, newIndex: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markSaved: () => void;
  setActiveBreakpoint: (bp: Breakpoint) => void;
}

/** Fields a caller may patch on a block. `id` and `children` are not patchable here. */
export type BlockPatch = {
  type?: string;
  /**
   * Flat mobile-layer props. Treated as a replacement of
   * `block.props.mobile`; tablet/desktop overrides are untouched.
   */
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

/**
 * Detect whether an arbitrary `props` value is already in the canonical
 * `PropsByBreakpoint` shape. Used by `addBlock` to auto-wrap section
 * authors' flat default bags without forcing every call site to know
 * about the breakpoint shape.
 */
function isPropsByBreakpoint(value: unknown): value is PropsByBreakpoint {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return !!v.mobile && typeof v.mobile === "object";
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
      activeBreakpoint: loadStoredBreakpoint(),

      loadDocument: (source) =>
        set((state) => {
          // Loader hands us `unknown` from Prisma's Json column. Run
          // `migrateDocument` to upgrade any v1 (flat-props) document
          // to the current v2 (PropsByBreakpoint) shape. Idempotent on
          // already-v2 documents. Brand-new pages with `{ blocks: [] }`
          // pass through to an empty v2 doc.
          state.document = migrateDocument(source);
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
        // Defensive auto-wrap: section authors write `{ ...defaults }`
        // when constructing new blocks, which is a flat object, not a
        // PropsByBreakpoint. Wrap it so the document invariant holds.
        const normalized: Block = {
          ...block,
          props: isPropsByBreakpoint(block.props)
            ? block.props
            : wrapMobileProps(block.props as unknown as Record<string, unknown>),
        };
        set((state) => {
          const target =
            parentId == null
              ? state.document.blocks
              : findBlock(state.document.blocks, parentId)?.children;
          if (!target) return;
          recordHistory(state, before);
          const insertAt = index ?? target.length;
          target.splice(insertAt, 0, normalized);
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
          if (patch.props !== undefined) {
            // Treat patch.props as the new MOBILE layer. Existing
            // tablet/desktop overrides are preserved.
            block.props.mobile = patch.props;
          }
          state.isDirty = true;
        });
      },

      replaceBlockProps: (id, mobileProps) =>
        set((state) => {
          const block = findBlock(state.document.blocks, id);
          if (!block) return;
          block.props.mobile = mobileProps;
          state.isDirty = true;
          // Deliberately NOT calling recordHistory — see the action's
          // doc comment in the EditorState interface.
        }),

      mutateBlockProps: (id, recipe) => {
        const before = snapshotDocument(get().document);
        set((state) => {
          const block = findBlock(state.document.blocks, id);
          if (!block) return;
          recordHistory(state, before);
          recipe(block.props);
          state.isDirty = true;
        });
      },

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

      setActiveBreakpoint: (bp) => {
        set((state) => {
          state.activeBreakpoint = bp;
        });
        persistBreakpoint(bp);
      },
    };
  }),
);
