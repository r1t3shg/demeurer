/**
 * Feature list — Liquid compiler.
 *
 * Each feature is emitted as a Shopify section *block* (`{% schema %}`'s
 * `blocks` array). That gives the merchant — if they ever drop Demeurer —
 * the same drag-to-reorder + add/remove-block UX inside Shopify's theme
 * editor that they had in our canvas. Commitment #3 in action.
 *
 * Icons are emitted as inline SVG paths so the published page stays
 * pure HTML/CSS — no `<script src=...>`, no font-icon downloads. The
 * SVG paths are sourced from lucide.dev (ISC license, attribution in
 * the lucide package itself).
 */

import type { LiquidOutput, ToLiquidContext } from "../types";
import { liquidString } from "../_shared/coerce";
import { FEATURE_ICONS, coerceFeatureListProps, featureListDefaults } from "./schema";

/**
 * Inline SVG path data for the curated icon set. Sourced from lucide.dev
 * (lucide-icons, ISC license). Only the inner `<path>`/`<line>`/`<circle>`
 * markup; the outer `<svg>` is templated below so we can apply size/color
 * uniformly.
 */
const ICON_PATHS: Record<(typeof FEATURE_ICONS)[number], string> = {
  Sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  Zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  Shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  Heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  Star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  Award:
    '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  Rocket:
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  Globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  ThumbsUp:
    '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-1-12 1.94-6.59A1.93 1.93 0 0 1 9.94 2h.06a2 2 0 0 1 2 2v.88a4 4 0 0 1-.06 1z"/>',
};

function liquidIconCase(): string {
  // Build a `case`/`when` chain in Liquid that emits the right SVG path
  // for the current block's icon setting.
  const cases = FEATURE_ICONS.map(
    (name) => `        {%- when '${name}' -%}\n          ${ICON_PATHS[name]}`,
  ).join("\n");
  return `{%- case block.settings.icon -%}\n${cases}\n        {%- else -%}\n          ${ICON_PATHS.Sparkles}\n        {%- endcase -%}`;
}

export function featureListToLiquid(
  rawProps: Record<string, unknown>,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceFeatureListProps(rawProps);

  const iconOptions = FEATURE_ICONS.map((v) => ({ value: v, label: v }));

  const schema = {
    name: "Feature list",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: featureListDefaults.heading },
      { type: "richtext", id: "subheading", label: "Subheading" },
      {
        type: "select",
        id: "layout",
        label: "Layout",
        options: [
          { value: "grid-3", label: "3-column grid" },
          { value: "grid-2", label: "2-column grid" },
          { value: "grid-4", label: "4-column grid" },
          { value: "list", label: "Vertical list" },
        ],
        default: featureListDefaults.layout,
      },
      {
        type: "select",
        id: "alignment",
        label: "Text alignment",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ],
        default: featureListDefaults.alignment,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: featureListDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: featureListDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: featureListDefaults.padding.left },
    ],
    blocks: [
      {
        type: "feature",
        name: "Feature",
        limit: 12,
        settings: [
          {
            type: "select",
            id: "icon",
            label: "Icon",
            options: iconOptions,
            default: "Sparkles",
          },
          { type: "text", id: "title", label: "Title", default: "Feature title" },
          { type: "richtext", id: "description", label: "Description" },
        ],
      },
    ],
    presets: [
      {
        name: "Feature list",
        blocks: props.features.map((f) => ({
          type: "feature",
          settings: { icon: f.icon, title: f.title, description: f.description },
        })),
      },
    ],
  };

  const colsLiquid = `
{%- liquid
  case section.settings.layout
    when 'grid-2'
      assign cols = 2
    when 'grid-4'
      assign cols = 4
    when 'list'
      assign cols = 1
    else
      assign cols = 3
  endcase
  assign text_align_logical = 'center'
  if section.settings.alignment == 'left'
    assign text_align_logical = 'start'
  elsif section.settings.alignment == 'right'
    assign text_align_logical = 'end'
  endif
-%}`.trim();

  const template = `
${colsLiquid}
<div
  class="demeurer-feature-list demeurer-feature-list--{{ section.settings.alignment }}"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
    text-align: {{ text_align_logical }};
  "
>
  <div class="demeurer-feature-list__inner" style="max-width: 1200px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-feature-list__heading">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-feature-list__subheading">{{ section.settings.subheading }}</div>
    {%- endif -%}
    <div
      class="demeurer-feature-list__grid"
      style="
        display: grid;
        grid-template-columns: repeat({{ cols }}, minmax(0, 1fr));
        gap: 32px;
        margin-top: 32px;
      "
    >
      {%- for block in section.blocks -%}
        <div class="demeurer-feature-list__item" {{ block.shopify_attributes }} style="display: flex; flex-direction: column; gap: 12px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
${liquidIconCase()}
          </svg>
          {%- if block.settings.title != blank -%}
            <h3 class="demeurer-feature-list__title" style="margin: 0; font-weight: 600;">{{ block.settings.title | escape }}</h3>
          {%- endif -%}
          {%- if block.settings.description != blank -%}
            <div class="demeurer-feature-list__desc">{{ block.settings.description }}</div>
          {%- endif -%}
        </div>
      {%- endfor -%}
    </div>
  </div>
</div>
`.trim();

  // Default heading injected via Liquid `default:` filter is already
  // covered by the schema's `default:` keys above. We use liquidString
  // here only when we need a JS string baked into the template; this
  // section doesn't (everything reads from settings/blocks).
  void liquidString;

  return { schema, template };
}
