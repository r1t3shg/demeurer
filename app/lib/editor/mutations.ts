/**
 * Breakpoint-aware mutations.
 *
 * Wrapper around the editor store's history-pushing mutations that
 * understands `PropsByBreakpoint`. Every UI surface that changes a block
 * prop should call into these helpers rather than poking
 * `block.props.tablet` etc. directly.
 *
 * Mutations record a history snapshot the same way `updateBlock` does
 * (P1.A segment 3 wired the history through Zustand's middleware) — so
 * undo/redo, autosave, and crash recovery all keep working unchanged.
 *
 * For the keystroke-fast path (per-character writes from the properties
 * panel) we still expose `store.replaceBlockProps`, which writes to the
 * mobile layer without pushing history. Discrete, intentional mutations
 * — drag-reorder, "promote to default", "remove override" — go through
 * the helpers in this file.
 */

import type { Block, BlockId, Breakpoint } from "./types.ts";
import { useEditorStore } from "./store.ts";

interface SetPropOptions {
  /**
   * If true and `breakpoint` is tablet/desktop, the value is written to
   * the mobile (canonical) layer instead of as an override at the
   * current breakpoint. Any existing override for this key at ANY
   * non-mobile breakpoint is removed so the new mobile value flows
   * through to every breakpoint. Used by the "Apply to all breakpoints"
   * inline confirmation in the properties panel.
   *
   * Ignored when `breakpoint` is "mobile" (mobile already IS the
   * canonical layer).
   */
  applyToMobile?: boolean;
}

/**
 * Set a single property at a breakpoint.
 *
 *  - `breakpoint === "mobile"`: writes block.props.mobile[key] = value.
 *  - `breakpoint === "tablet" | "desktop"` with `applyToMobile: true`:
 *       writes block.props.mobile[key] = value AND removes any existing
 *       override for this key at the current breakpoint (so the value
 *       cascades from mobile naturally).
 *  - `breakpoint === "tablet" | "desktop"` otherwise:
 *       writes block.props[breakpoint][key] = value as an override.
 *       Initializes block.props[breakpoint] = {} if not present.
 */
export function setProp(
  blockId: BlockId,
  breakpoint: Breakpoint,
  key: string,
  value: unknown,
  options?: SetPropOptions,
): void {
  useEditorStore.getState().mutateBlockProps(blockId, (props) => {
    if (breakpoint === "mobile") {
      props.mobile[key] = value;
      return;
    }
    if (options?.applyToMobile) {
      props.mobile[key] = value;
      // Clear the override for this key at BOTH non-mobile breakpoints
      // so the new mobile value flows through everywhere. "Apply to all
      // breakpoints" means exactly that — no stale overrides left behind.
      for (const bp of ["tablet", "desktop"] as const) {
        const layer = props[bp];
        if (layer && key in layer) {
          delete layer[key];
          if (Object.keys(layer).length === 0) {
            delete props[bp];
          }
        }
      }
      return;
    }
    const existing = props[breakpoint];
    if (existing) {
      existing[key] = value;
    } else {
      props[breakpoint] = { [key]: value };
    }
  });
}

/**
 * Remove the override for `key` at `breakpoint`, letting the value
 * cascade from a higher layer (tablet falls back to mobile; desktop
 * falls back to tablet → mobile).
 *
 * No-op for mobile — mobile values are reset by setting them to a
 * default, not by removing them. (Removing the canonical value would
 * leave the section without a baseline at any breakpoint.)
 *
 * If removing the last override empties block.props[breakpoint], the
 * layer is deleted entirely so the persisted JSON stays minimal.
 */
export function removeOverride(
  blockId: BlockId,
  breakpoint: Breakpoint,
  key: string,
): void {
  if (breakpoint === "mobile") return;
  useEditorStore.getState().mutateBlockProps(blockId, (props) => {
    const layer = props[breakpoint];
    if (!layer) return;
    if (!(key in layer)) return;
    delete layer[key];
    if (Object.keys(layer).length === 0) {
      delete props[breakpoint];
    }
  });
}

/**
 * Promote an override from `fromBreakpoint` to mobile.
 *
 * Copies the override value into mobile and removes the override at
 * `fromBreakpoint`, AND any override for the same key at the other
 * non-mobile breakpoint — the goal is "this value is the default at
 * every breakpoint", so all override layers are cleared for this key.
 *
 * Used by the "Make this the default everywhere" UI in segment 3. The
 * `toMobile` parameter is reserved for symmetry with future "demote"
 * operations; today it must always be `true` (we don't support
 * promoting to a non-mobile layer yet).
 */
export function promoteOverride(
  blockId: BlockId,
  fromBreakpoint: Breakpoint,
  toMobile: boolean,
  key: string,
): void {
  if (!toMobile) return;
  if (fromBreakpoint === "mobile") return;
  useEditorStore.getState().mutateBlockProps(blockId, (props) => {
    const layer = props[fromBreakpoint];
    if (!layer || !(key in layer)) return;
    props.mobile[key] = layer[key];
    // Strip the key from BOTH non-mobile layers — promoting means
    // there should be no overrides anywhere for this key.
    for (const bp of ["tablet", "desktop"] as const) {
      const l = props[bp];
      if (l && key in l) {
        delete l[key];
        if (Object.keys(l).length === 0) {
          delete props[bp];
        }
      }
    }
  });
}

/**
 * Re-export the read helpers so callers can import everything from one
 * module. Resolution stays in `resolve.ts` to keep the cascade math out
 * of the mutation file.
 */
export { resolveProps, resolveProp, hasOverride, listOverrides } from "./resolve.ts";

/**
 * Block lookup helper used by tests and one-off callers that have a
 * blocks array in hand. Production code should prefer the store. Walks
 * children depth-first; first match wins.
 */
export function findBlock(blocks: Block[], id: BlockId): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inner = findBlock(b.children, id);
    if (inner) return inner;
  }
  return null;
}
