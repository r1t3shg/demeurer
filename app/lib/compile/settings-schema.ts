/**
 * Editor `Field` → Shopify `{% schema %}` setting mapping.
 *
 * The shared section file declares EVERY editable prop as a Shopify
 * section setting so the section can be rendered standalone (e.g. if the
 * merchant ever opens it in the theme editor) and so the page-level JSON
 * template can supply per-block values via `settings`.
 *
 * Plus the five compile-only settings every section carries:
 *   scope_id, mobile_styles, tablet_styles, desktop_styles, visibility_styles
 *
 * These five carry the per-block scope class and the baked CSS produced
 * by `responsive-settings.ts`. Their `info: ""` keeps them present in
 * code but unobtrusive in the theme editor — the values are written by
 * the page template, never by a human.
 *
 * This module is generic across all twelve sections. Section-specific
 * quirks (Pricing's `billing_toggle`, list fields → blocks) are handled
 * by the per-section modules under `./section-templates/`.
 */

import type { Field, ListField, SectionSchema } from "../sections/types.ts";

/** A Shopify schema setting JSON object. Loose typing — Shopify accepts a wide variety of shapes. */
export type ShopifySetting = Record<string, unknown>;

/** A Shopify section block declaration (for sections with list sub-items). */
export interface ShopifyBlockSchema {
  type: string;
  name: string;
  settings: ShopifySetting[];
  limit?: number;
}

/**
 * The five compile-only settings, in fixed order. Appended to every
 * section's settings array AFTER the schema-derived settings.
 */
export const COMPILE_ONLY_SETTING_KEYS = [
  "scope_id",
  "mobile_styles",
  "tablet_styles",
  "desktop_styles",
  "visibility_styles",
] as const;

export function compileOnlySettings(): ShopifySetting[] {
  return [
    { type: "text", id: "scope_id", label: "Scope id", info: "" },
    { type: "textarea", id: "mobile_styles", label: "Mobile styles", info: "" },
    { type: "textarea", id: "tablet_styles", label: "Tablet styles", info: "" },
    { type: "textarea", id: "desktop_styles", label: "Desktop styles", info: "" },
    {
      type: "textarea",
      id: "visibility_styles",
      label: "Visibility styles",
      info: "",
    },
  ];
}

/**
 * Build the settings array for a section's `{% schema %}`. Walks the
 * editor schema and emits one or more Shopify settings per field, then
 * appends the compile-only block.
 *
 * `list` fields produce no top-level settings — they map to Shopify
 * `blocks` and are handled separately via `buildBlockSchemas`.
 */
export function buildSectionSettings(schema: SectionSchema): ShopifySetting[] {
  const out: ShopifySetting[] = [];
  for (const field of schema.fields) {
    if (field.kind === "list") continue;
    out.push(...fieldToSettings(field, ""));
  }
  out.push(...compileOnlySettings());
  return out;
}

/**
 * Build the `blocks` array for a section's `{% schema %}` from any list
 * fields in the editor schema. Most sections have at most one list
 * field; the one Shopify block type per list keeps the JSON template
 * structure simple.
 */
export function buildBlockSchemas(schema: SectionSchema): ShopifyBlockSchema[] {
  const out: ShopifyBlockSchema[] = [];
  for (const field of schema.fields) {
    if (field.kind !== "list") continue;
    out.push(listFieldToBlockSchema(field));
  }
  return out;
}

function listFieldToBlockSchema(field: ListField): ShopifyBlockSchema {
  const settings: ShopifySetting[] = [];
  for (const child of field.itemSchema) {
    if (child.kind === "list") continue; // Shopify schema doesn't nest lists.
    settings.push(...fieldToSettings(child, ""));
  }
  const block: ShopifyBlockSchema = {
    type: field.key,
    name: field.label,
    settings,
  };
  if (typeof field.maxItems === "number") block.limit = field.maxItems;
  return block;
}

/**
 * One editor field → 1+ Shopify settings. `keyPrefix` carries the
 * group-flatten prefix (e.g. for a future GroupField with key "cta"
 * containing `label`, the resulting setting id is `cta_label`).
 */
function fieldToSettings(field: Field, keyPrefix: string): ShopifySetting[] {
  const id = keyPrefix ? `${keyPrefix}_${field.key}` : field.key;

  switch (field.kind) {
    case "text": {
      const useTextarea =
        typeof field.max !== "number" || field.max > 80;
      const setting: ShopifySetting = {
        type: useTextarea ? "textarea" : "text",
        id,
        label: field.label,
      };
      if (typeof field.default === "string") setting.default = field.default;
      if (field.placeholder) setting.placeholder = field.placeholder;
      return [setting];
    }
    case "richtext": {
      const setting: ShopifySetting = { type: "richtext", id, label: field.label };
      if (typeof field.default === "string") setting.default = field.default;
      return [setting];
    }
    case "image": {
      // Shopify `image_picker` returns an image object at runtime; our
      // editor stores a CDN URL string. The shared section template uses
      // `{{ section.settings.X }}` which resolves to either form (Shopify
      // coerces a URL string acceptably for `<img src=…>`).
      return [{ type: "image_picker", id, label: field.label }];
    }
    case "url":
      return [{ type: "url", id, label: field.label }];
    case "select": {
      const setting: ShopifySetting = {
        type: "select",
        id,
        label: field.label,
        options: field.options.map((o) => ({ value: o.value, label: o.label })),
      };
      if (typeof field.default === "string") setting.default = field.default;
      return [setting];
    }
    case "color": {
      const setting: ShopifySetting = { type: "color", id, label: field.label };
      if (typeof field.default === "string") setting.default = field.default;
      return [setting];
    }
    case "number": {
      const setting: ShopifySetting = { type: "number", id, label: field.label };
      if (typeof field.default === "number") setting.default = field.default;
      return [setting];
    }
    case "boolean": {
      const setting: ShopifySetting = { type: "checkbox", id, label: field.label };
      if (typeof field.default === "boolean") setting.default = field.default;
      return [setting];
    }
    case "spacing": {
      // Decompose into four numeric settings. The shared section template
      // composes them back into a `padding: top right bottom left` string
      // when needed (or just uses the four individually).
      const def = field.default;
      const make = (suffix: "top" | "right" | "bottom" | "left"): ShopifySetting => {
        const setting: ShopifySetting = {
          type: "number",
          id: `${id}_${suffix}`,
          label: `${field.label} (${suffix})`,
        };
        if (def) setting.default = def[suffix];
        return setting;
      };
      return [make("top"), make("right"), make("bottom"), make("left")];
    }
    case "group": {
      // Flatten — a group of N fields becomes N settings with prefixed keys.
      const childPrefix = id;
      const out: ShopifySetting[] = [];
      for (const child of field.fields) {
        if (child.kind === "list") continue;
        out.push(...fieldToSettings(child, childPrefix));
      }
      return out;
    }
    case "list":
      // Lists become blocks, handled by `buildBlockSchemas`.
      return [];
  }
}
