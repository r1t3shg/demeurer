/**
 * Shared utilities for the per-section template modules.
 *
 * Every shared section file wraps section-specific markup in a fixed
 * skeleton: scope assignment, `{% style %}` block reading the four
 * compile-only CSS settings, the section-specific body, then the
 * `{% schema %}` block.
 *
 * This module also provides:
 *  - `padPropMap`: the standard `padding` propMap entry shared by every
 *    section that exposes a `padding` SpacingValue field.
 *  - `alignPropMap`: the standard `alignment` propMap entry that maps
 *    "left"/"center" to logical `text-align`.
 *  - `decomposeSpacing` / `composeSpacing`: helpers for converting a
 *    SpacingValue into four numeric settings (`{key}_top` etc.).
 */

import { textAlignLogical, type CssPropMap } from "../../sections/_shared/responsive-css.ts";
import type { SpacingValue } from "../../sections/types.ts";
import { stableStringify } from "../stable-json.ts";
import { buildBlockSchemas, buildSectionSettings } from "../settings-schema.ts";
import type { SectionSchema } from "../../sections/types.ts";

/**
 * Compose the full `sections/demeurer-{type}.liquid` content. The body
 * goes inside the wrapper. The schema is serialized via `stableStringify`
 * so byte-output is deterministic.
 */
export function buildSharedSectionFile(opts: {
  type: string;
  name: string;
  body: string;
  schema: SectionSchema;
  /** Optional — when present, included in the `{% schema %}` block. */
  presets?: Array<{ name: string; settings?: Record<string, unknown> }>;
  /** Section-level extras like `tag`. Defaults to `tag: "section"`. */
  tag?: string;
}): string {
  const settings = buildSectionSettings(opts.schema);
  const blocks = buildBlockSchemas(opts.schema);
  const schemaJson: Record<string, unknown> = {
    name: opts.name,
    tag: opts.tag ?? "section",
    class: `demeurer-section demeurer-${opts.type}`,
    settings,
  };
  if (blocks.length > 0) schemaJson.blocks = blocks;
  if (opts.presets && opts.presets.length > 0) schemaJson.presets = opts.presets;

  const schemaStr = stableStringify(schemaJson, 2);

  // The skeleton: header (liquid scope assignment + style block), body,
  // schema. Bodies are responsible for their own outer `<section>` tag
  // with `class="{{ scope }} demeurer-section demeurer-{type}"`.
  return [
    `{%- liquid`,
    `  assign scope = section.settings.scope_id | default: 'demeurer-${opts.type}'`,
    `-%}`,
    `{%- style -%}`,
    `  {{ section.settings.mobile_styles }}`,
    `  {%- if section.settings.tablet_styles != blank -%}`,
    `    @media (min-width: 768px) { .{{ scope }} { {{ section.settings.tablet_styles }} } }`,
    `  {%- endif -%}`,
    `  {%- if section.settings.desktop_styles != blank -%}`,
    `    @media (min-width: 1280px) { .{{ scope }} { {{ section.settings.desktop_styles }} } }`,
    `  {%- endif -%}`,
    `  {{ section.settings.visibility_styles }}`,
    `{%- endstyle -%}`,
    ``,
    opts.body.trim(),
    ``,
    `{% schema %}`,
    schemaStr,
    `{% endschema %}`,
    ``,
  ].join("\n");
}

/** Standard `padding: top right bottom left` propMap entry. */
export function paddingPropMap(): CssPropMap {
  return {
    propKey: "padding",
    cssProperty: "padding",
    toCss: (v) => {
      if (!v || typeof v !== "object") return "0";
      const p = v as SpacingValue;
      return `${num(p.top)}px ${num(p.right)}px ${num(p.bottom)}px ${num(p.left)}px`;
    },
  };
}

/** Standard `alignment` (left/center) → logical `text-align` propMap entry. */
export function alignmentPropMap(): CssPropMap {
  return {
    propKey: "alignment",
    cssProperty: "text-align",
    toCss: textAlignLogical,
  };
}

/** Background color propMap entry — passes the hex through verbatim. */
export function backgroundPropMap(propKey: string, fallback: string): CssPropMap {
  return {
    propKey,
    cssProperty: "background",
    toCss: (v) => (typeof v === "string" && v.length > 0 ? v : fallback),
  };
}

/**
 * Decompose a SpacingValue into four numeric settings keyed
 * `{key}_top` / `{key}_right` / `{key}_bottom` / `{key}_left`.
 */
export function decomposeSpacing(
  key: string,
  value: SpacingValue | undefined,
  fallback: SpacingValue,
): Record<string, number> {
  const v = value ?? fallback;
  return {
    [`${key}_top`]: num(v.top),
    [`${key}_right`]: num(v.right),
    [`${key}_bottom`]: num(v.bottom),
    [`${key}_left`]: num(v.left),
  };
}

function num(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Build the `block_order` + `blocks` from a list of items with stable
 * keys. Each item gets a key `"item-{index}"` (deterministic; preserves
 * the editor's drag-reorder).
 */
export function listItemsToBlocks<T>(
  blockType: string,
  items: readonly T[],
  toSettings: (item: T, index: number) => Record<string, unknown>,
): { blocks: Record<string, { type: string; settings: Record<string, unknown> }>; block_order: string[] } {
  const blocks: Record<string, { type: string; settings: Record<string, unknown> }> = {};
  const block_order: string[] = [];
  items.forEach((item, i) => {
    const key = `${blockType}-${i}`;
    blocks[key] = { type: blockType, settings: toSettings(item, i) };
    block_order.push(key);
  });
  return { blocks, block_order };
}
