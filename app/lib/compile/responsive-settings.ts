/**
 * Compile-time responsive CSS → four section settings:
 *   mobile_styles, tablet_styles, desktop_styles, visibility_styles
 *
 * The shared section file (`sections/demeurer-{type}.liquid`) renders
 * those settings inside a `{% style %}` block:
 *
 *   {% style %}
 *     {{ section.settings.mobile_styles }}
 *     {%- if section.settings.tablet_styles != blank -%}
 *       @media (min-width: 768px) { .{{ scope }} { {{ section.settings.tablet_styles }} } }
 *     {%- endif -%}
 *     {%- if section.settings.desktop_styles != blank -%}
 *       @media (min-width: 1280px) { .{{ scope }} { {{ section.settings.desktop_styles }} } }
 *     {%- endif -%}
 *     {{ section.settings.visibility_styles }}
 *   {% endstyle %}
 *
 * So:
 *   - mobile_styles is a complete CSS rule with selector and braces.
 *   - tablet_styles / desktop_styles are JUST declarations (the section
 *     template wraps them in selector + @media).
 *   - visibility_styles is a complete CSS string with its own rules /
 *     media queries (passed straight through from `emitVisibilityCSS`).
 *
 * All four are "" when there's nothing to emit so the section template's
 * `{%- if … != blank -%}` guards skip empty branches and the published
 * Liquid stays minimal.
 *
 * Reuses P1.C primitives from `app/lib/sections/_shared/responsive-css.ts`
 * — `diffOverrides` and `emitVisibilityCSS`. Does NOT call
 * `emitResponsiveCSS` because that returns a single concatenated string
 * with @media wrappers; we need each breakpoint separately.
 *
 * Note on `mobileLiquid`: existing P1.B/P1.C `CssPropMap` entries can
 * carry a `mobileLiquid` string for live theme-editor edits. The compile
 * pipeline IGNORES that field — every CSS value is baked compile-time.
 * Theme-editor edits to text/image/url settings remain live (those flow
 * through `{{ section.settings.X }}` in the section template), but
 * spacing/colors that affect responsive behavior require a republish
 * from Demeurer. Documented in `docs/compile.md`.
 */

import {
  diffOverrides,
  emitVisibilityCSS,
  type CssPropMap,
} from "../sections/_shared/responsive-css.ts";
import type { PropsByBreakpoint } from "../editor/types.ts";

export interface ResponsiveStyleSettings {
  mobile_styles: string;
  tablet_styles: string;
  desktop_styles: string;
  visibility_styles: string;
}

export function buildResponsiveStyles(
  scope: string,
  propsByBreakpoint: PropsByBreakpoint,
  propMap: CssPropMap[],
): ResponsiveStyleSettings {
  return {
    mobile_styles: buildMobile(scope, propsByBreakpoint, propMap),
    tablet_styles: buildOverrideDecls(propsByBreakpoint, "tablet", propMap),
    desktop_styles: buildOverrideDecls(propsByBreakpoint, "desktop", propMap),
    visibility_styles: emitVisibilityCSS(scope, propsByBreakpoint),
  };
}

/**
 * Mobile baseline: a complete `.scope { … }` rule with one declaration
 * per propMap entry. No `!important` — mobile is the unconditional
 * baseline, nothing needs to win over it.
 *
 * Empty propMap → empty string.
 */
function buildMobile(
  scope: string,
  propsByBreakpoint: PropsByBreakpoint,
  propMap: CssPropMap[],
): string {
  if (propMap.length === 0) return "";
  const decls = propMap.map(
    (m) => `  ${m.cssProperty}: ${m.toCss(propsByBreakpoint.mobile[m.propKey])};`,
  );
  return `.${scope} {\n${decls.join("\n")}\n}`;
}

/**
 * Tablet/desktop: declarations only (no selector, no @media wrapper, no
 * braces). The shared section template wraps them. Only emit declarations
 * for actual overrides — `diffOverrides` strips redundant ones.
 *
 * Each declaration uses `!important` because in published Liquid these
 * decls compete with the mobile rule above on the same selector — at
 * tablet, both `.scope { padding: 96px… }` and (inside @media) the same
 * selector match. CSS resolves in source order: the @media rule wins
 * because it's later. But we keep `!important` to defend against future
 * changes (e.g. a theme that injects its own `.scope { … }` block via
 * theme settings).
 */
function buildOverrideDecls(
  propsByBreakpoint: PropsByBreakpoint,
  breakpoint: "tablet" | "desktop",
  propMap: CssPropMap[],
): string {
  if (propMap.length === 0) return "";
  const keys = propMap.map((m) => m.propKey);
  const overrides = diffOverrides(propsByBreakpoint, breakpoint, keys);
  if (Object.keys(overrides).length === 0) return "";
  const decls = propMap
    .filter((m) => m.propKey in overrides)
    .map((m) => `  ${m.cssProperty}: ${m.toCss(overrides[m.propKey])} !important;`);
  return decls.join("\n");
}
