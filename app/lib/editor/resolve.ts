/**
 * Property resolution helpers — the cascade logic, isolated.
 *
 * Every consumer of block props (canvas Render, properties panel,
 * preview iframe, qualityCheck callers) must go through these helpers.
 * Direct access to `block.props.tablet` etc. anywhere else in the
 * codebase is a bug — it bypasses the cascade and leaks the responsive
 * model into every consumer.
 *
 * Cascade rules (mobile-first, one-way):
 *   - mobile  → returns block.props.mobile.
 *   - tablet  → mobile spread, then tablet overrides applied on top.
 *   - desktop → mobile spread, then tablet overrides, then desktop
 *               overrides applied on top.
 *
 * These functions are pure and allocation-light. `resolveProp` and
 * `hasOverride` do not allocate at all in the steady state. `resolveProps`
 * allocates one new object per call — unavoidable for a merged view.
 */

import type { Block, Breakpoint } from "./types";

/** The breakpoint a resolved value originated from. */
export type ResolvedSource = Breakpoint;

export interface ResolvedPropEntry {
  value: unknown;
  /**
   * The most-specific layer that has an entry for this key. For a
   * desktop lookup with no desktop or tablet override, this is "mobile";
   * with a tablet override but no desktop override, this is "tablet";
   * with a desktop override, this is "desktop".
   */
  source: ResolvedSource;
}

/**
 * Returns the fully-resolved props bag for a block at the given breakpoint.
 *
 * The returned object is a fresh shallow merge — callers may not mutate it
 * and expect the document to update. Use `mutations.setProp` to change
 * values.
 */
export function resolveProps(
  block: Block,
  breakpoint: Breakpoint,
): Record<string, unknown> {
  const { mobile, tablet, desktop } = block.props;
  if (breakpoint === "mobile") {
    // Return a shallow clone so callers can't accidentally mutate the
    // canonical layer through a returned reference. The cost is one
    // object allocation per call; well below the keystroke budget.
    return { ...mobile };
  }
  if (breakpoint === "tablet") {
    return tablet ? { ...mobile, ...tablet } : { ...mobile };
  }
  // desktop: mobile → tablet → desktop.
  let merged: Record<string, unknown> = { ...mobile };
  if (tablet) merged = { ...merged, ...tablet };
  if (desktop) merged = { ...merged, ...desktop };
  return merged;
}

/**
 * Returns one property's resolved value AND its source breakpoint.
 *
 * `source` is the most-specific layer that has an entry for this key:
 * mobile if neither tablet nor desktop overrides it, tablet if only
 * tablet overrides it, desktop if desktop overrides it. (A `desktop`
 * lookup that finds no desktop override but a tablet override returns
 * source: "tablet", because that's where the value lives.)
 *
 * For a key that exists in mobile and is overridden at desktop with the
 * SAME value, source is still "desktop" — the override is what's
 * authored, even if it's redundant. The properties panel surfaces this
 * via `hasOverride` so the merchant can collapse redundant overrides.
 */
export function resolveProp(
  block: Block,
  breakpoint: Breakpoint,
  key: string,
): ResolvedPropEntry {
  const { mobile, tablet, desktop } = block.props;
  if (breakpoint === "desktop") {
    if (desktop && key in desktop) {
      return { value: desktop[key], source: "desktop" };
    }
    if (tablet && key in tablet) {
      return { value: tablet[key], source: "tablet" };
    }
    return { value: mobile[key], source: "mobile" };
  }
  if (breakpoint === "tablet") {
    if (tablet && key in tablet) {
      return { value: tablet[key], source: "tablet" };
    }
    return { value: mobile[key], source: "mobile" };
  }
  // mobile
  return { value: mobile[key], source: "mobile" };
}

/**
 * True if this breakpoint has an explicit override for this key.
 *
 * Mobile is canonical, so `hasOverride(block, "mobile", key)` always
 * returns true (every key "lives" at mobile in the resolution sense,
 * even if mobile's value is `undefined`). Tablet/desktop return true
 * only if the key is present in that breakpoint's override layer.
 */
export function hasOverride(
  block: Block,
  breakpoint: Breakpoint,
  key: string,
): boolean {
  if (breakpoint === "mobile") return true;
  const layer = block.props[breakpoint];
  return layer ? key in layer : false;
}

/**
 * All keys at this breakpoint.
 *
 * For mobile, returns every key in the canonical layer (the full prop
 * surface). For tablet/desktop, returns ONLY the keys with explicit
 * overrides at that breakpoint. Used by the properties panel to render
 * the "X overrides at this breakpoint" affordance (segment 3).
 */
export function listOverrides(block: Block, breakpoint: Breakpoint): string[] {
  if (breakpoint === "mobile") {
    return Object.keys(block.props.mobile);
  }
  const layer = block.props[breakpoint];
  return layer ? Object.keys(layer) : [];
}
