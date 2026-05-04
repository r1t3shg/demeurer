/**
 * Responsive CSS emission helpers.
 *
 * Every section's `toLiquid` calls these to convert the merchant's
 * mobile-first cascade (`PropsByBreakpoint`) into media-query CSS that
 * lives inside the published Liquid section's `{% style %}` block.
 *
 * Architectural commitment recap: the published page is pure Liquid +
 * CSS. We emit no JavaScript for responsive behavior — three fixed
 * breakpoints (mobile=base, tablet ≥ 768px, desktop ≥ 1280px) and pure
 * `@media` rules. Container queries / fluid scales are intentionally
 * NOT supported here — three breakpoints, period, matching the editor's
 * mental model.
 *
 * Output shape produced by `emitResponsiveCSS`:
 *
 *     .demeurer-hero-<blockId> {
 *       /* mobile rules — present only when `includeMobile` is set *\/
 *     }
 *     @media (min-width: 768px) {
 *       .demeurer-hero-<blockId> {
 *         /* tablet override declarations only, with !important *\/
 *       }
 *     }
 *     @media (min-width: 1280px) {
 *       .demeurer-hero-<blockId> {
 *         /* desktop override declarations only, with !important *\/
 *       }
 *     }
 *
 * Why `!important` on overrides: Demeurer sections render their mobile
 * values via inline `style="…"` attributes (Shopify-section convention
 * — keeps the merchant's theme-editor edits live without a recompile).
 * Inline styles win over class selectors by specificity, so override
 * rules MUST use `!important` to actually override at tablet/desktop.
 * The mobile rules in the `{% style %}` block are documentation /
 * fallback only and never use `!important`.
 *
 * If the merchant has no overrides at all (the common case for a
 * freshly built page), the helpers return an empty string. The caller
 * skips the `{% style %}` block entirely so the published Liquid is
 * indistinguishable from a hand-written section.
 */

import type { Breakpoint, PropsByBreakpoint } from "../../editor/types.ts";

/**
 * One mapping from a section prop to a CSS declaration. The section's
 * `toLiquid` builds an array of these and hands it to `emitResponsiveCSS`.
 *
 * `toCss` is called with whatever the prop's value is at the relevant
 * breakpoint. Sections own the value→CSS conversion because the shape
 * varies (numbers → "16px", `SpacingValue` → "16px 24px", select strings
 * → CSS keywords, etc.).
 *
 * `mobileLiquid` lets a section opt mobile rules into runtime Shopify
 * settings: e.g. `{{ section.settings.padding_top | append: 'px' }}`.
 * That keeps theme-editor edits live for mobile while overrides stay
 * baked at compile time. When omitted, the mobile rule (if emitted)
 * uses the baked compile-time value via `toCss`.
 */
export interface CssPropMap {
  propKey: string;
  cssProperty: string;
  toCss(value: unknown): string;
  mobileLiquid?: string;
}

/** Standard breakpoint widths. Documented + reused everywhere. */
export const TABLET_MIN_PX = 768;
export const DESKTOP_MIN_PX = 1280;

/**
 * Returns only the keys at `breakpoint` whose value differs from the
 * cascaded value (i.e. is an actual override that should emit CSS).
 *
 * The cascade is mobile → tablet → desktop. So at "tablet", a key is
 * an override iff `tablet[key]` differs from `mobile[key]`. At
 * "desktop", a key is an override iff `desktop[key]` differs from the
 * tablet-resolved value (mobile if no tablet override, otherwise
 * tablet's value).
 *
 * Equality is structural (`JSON.stringify`) so SpacingValue / object
 * props compare correctly. Functions and `undefined` would round-trip
 * inconsistently — we don't store either in props.
 */
export function diffOverrides(
  propsByBreakpoint: PropsByBreakpoint,
  breakpoint: "tablet" | "desktop",
  keys: string[],
): Record<string, unknown> {
  const layer = propsByBreakpoint[breakpoint];
  if (!layer) return {};
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in layer)) continue;
    const overrideValue = layer[key];
    const cascadedValue = resolveCascade(propsByBreakpoint, breakpoint, key, /* exclusive */ true);
    if (!structuralEqual(overrideValue, cascadedValue)) {
      out[key] = overrideValue;
    }
  }
  return out;
}

/**
 * The value `key` would resolve to at `breakpoint` IGNORING the layer
 * AT that breakpoint (so we can compare an override against what would
 * cascade to that breakpoint without it).
 *
 * exclusive=true means: skip the layer at `breakpoint` itself. For
 * tablet that means use mobile. For desktop it means use the tablet
 * layer if present, else mobile.
 */
function resolveCascade(
  props: PropsByBreakpoint,
  breakpoint: Breakpoint,
  key: string,
  exclusive: boolean,
): unknown {
  if (breakpoint === "mobile") return props.mobile[key];
  if (breakpoint === "tablet") {
    if (!exclusive && props.tablet && key in props.tablet) return props.tablet[key];
    return props.mobile[key];
  }
  // desktop
  if (!exclusive && props.desktop && key in props.desktop) return props.desktop[key];
  if (props.tablet && key in props.tablet) return props.tablet[key];
  return props.mobile[key];
}

function structuralEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Cheap path for primitives that are !== — they're not equal.
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;
  // Use JSON canonicalization for object structural equality. Both prop
  // values come from the document JSON so this round-trips reliably.
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export interface EmitResponsiveOptions {
  /**
   * If true, emit a base `.scope { … }` block with the mobile values
   * for every mapped prop. Default `false` — sections currently render
   * mobile values via inline `style="…"` attributes, so duplicating
   * them in `{% style %}` is noise.
   */
  includeMobile?: boolean;
}

/**
 * Build the responsive CSS string for one block's scope. Returns "" if
 * there are no overrides AND `includeMobile` is false — caller can
 * cleanly skip the `{% style %}` block entirely in that case.
 */
export function emitResponsiveCSS(
  scope: string,
  propsByBreakpoint: PropsByBreakpoint,
  propMap: CssPropMap[],
  options: EmitResponsiveOptions = {},
): string {
  const selector = `.${scope}`;
  const keys = propMap.map((m) => m.propKey);

  const tabletOverrides = diffOverrides(propsByBreakpoint, "tablet", keys);
  const desktopOverrides = diffOverrides(propsByBreakpoint, "desktop", keys);

  const blocks: string[] = [];

  if (options.includeMobile) {
    const decls = propMap.map((m) => {
      const liquid = m.mobileLiquid;
      const value = liquid ?? m.toCss(propsByBreakpoint.mobile[m.propKey]);
      return `  ${m.cssProperty}: ${value};`;
    });
    blocks.push(`${selector} {\n${decls.join("\n")}\n}`);
  }

  if (Object.keys(tabletOverrides).length > 0) {
    const decls = propMap
      .filter((m) => m.propKey in tabletOverrides)
      .map((m) => `    ${m.cssProperty}: ${m.toCss(tabletOverrides[m.propKey])} !important;`);
    blocks.push(
      `@media (min-width: ${TABLET_MIN_PX}px) {\n  ${selector} {\n${decls.join("\n")}\n  }\n}`,
    );
  }

  if (Object.keys(desktopOverrides).length > 0) {
    const decls = propMap
      .filter((m) => m.propKey in desktopOverrides)
      .map((m) => `    ${m.cssProperty}: ${m.toCss(desktopOverrides[m.propKey])} !important;`);
    blocks.push(
      `@media (min-width: ${DESKTOP_MIN_PX}px) {\n  ${selector} {\n${decls.join("\n")}\n  }\n}`,
    );
  }

  return blocks.join("\n");
}

/**
 * Read `_visibility` overrides off the props bag and emit `display`
 * rules for breakpoints where the block should be hidden.
 *
 * Mobile-default visibility is "shown" — we never emit `display: block`
 * unconditionally because that would clobber the section's intrinsic
 * display (e.g. `display: grid` on the inner). We only emit
 * `display: none !important` at breakpoints flagged hidden.
 *
 * Returns "" if visibility is true (or unset) at every breakpoint.
 */
export function emitVisibilityCSS(
  scope: string,
  propsByBreakpoint: PropsByBreakpoint,
): string {
  const selector = `.${scope}`;
  const mobileVisible = propsByBreakpoint.mobile._visibility !== false;

  // Whether each non-mobile layer EXPLICITLY overrides _visibility, and
  // to what. `null` = no explicit override at that breakpoint.
  const tabletOverride = readVisibilityOverride(propsByBreakpoint.tablet);
  const desktopOverride = readVisibilityOverride(propsByBreakpoint.desktop);

  const blocks: string[] = [];

  // Track the cascaded visibility state as we walk mobile → tablet →
  // desktop. We emit a CSS rule only at the breakpoint where the
  // visibility CHANGES — anything else is redundant given CSS's own
  // cascade (a `min-width: 768px` rule already applies at desktop).
  let currentlyVisible = mobileVisible;

  if (!mobileVisible) {
    blocks.push(`${selector} { display: none !important; }`);
  }

  // Tablet
  let tabletVisible = currentlyVisible;
  if (tabletOverride !== null) tabletVisible = tabletOverride;
  if (tabletVisible !== currentlyVisible) {
    const decl = tabletVisible ? "display: revert !important" : "display: none !important";
    blocks.push(
      `@media (min-width: ${TABLET_MIN_PX}px) { ${selector} { ${decl}; } }`,
    );
    currentlyVisible = tabletVisible;
  }

  // Desktop
  let desktopVisible = currentlyVisible;
  if (desktopOverride !== null) desktopVisible = desktopOverride;
  if (desktopVisible !== currentlyVisible) {
    const decl = desktopVisible ? "display: revert !important" : "display: none !important";
    blocks.push(
      `@media (min-width: ${DESKTOP_MIN_PX}px) { ${selector} { ${decl}; } }`,
    );
  }

  return blocks.join("\n");
}

function readVisibilityOverride(
  layer: Record<string, unknown> | undefined,
): boolean | null {
  if (!layer || !("_visibility" in layer)) return null;
  return layer._visibility !== false;
}

/**
 * Wrap a CSS string in a Shopify `{% style %}` tag. Returns "" for an
 * empty/whitespace-only input so the caller doesn't emit a vacuous
 * style block. The Shopify-recommended `{% style %}` (over a raw
 * `<style>`) lets the storefront concatenate stylesheets and protects
 * against double-injection if the section renders multiple times.
 */
export function wrapStyle(css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  return `{%- style -%}\n${trimmed}\n{%- endstyle -%}`;
}

/**
 * Build the canonical scope class name for a block. Stable per
 * (sectionType, blockId) — used by every section's `toLiquid` so the
 * editor's responsive overrides can target exactly one element.
 */
export function scopeClass(sectionType: string, blockId: string): string {
  return `demeurer-${sectionType}-${sanitizeId(blockId)}`;
}

/**
 * Block ids come from cuid (alphanumeric, safe). Defensive sanitize
 * anyway — old documents may have hand-edited ids; keep the class
 * name to `[a-z0-9_-]` so it's a valid CSS identifier.
 */
function sanitizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

/* ---------------------- Common transform helpers ----------------------- */

/** `(value) => "<n>px"` for numeric props. Falls back to "0px" for non-numbers. */
export function pxValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  return "0px";
}

/** Map `text-align` editor values (left/center/right) to logical CSS. */
export function textAlignLogical(value: unknown): string {
  if (value === "left") return "start";
  if (value === "right") return "end";
  return "center";
}
