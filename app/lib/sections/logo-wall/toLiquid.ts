/**
 * Logo wall — Liquid compiler.
 *
 * Marquee animation is implemented with pure CSS keyframes — we
 * duplicate the logo row in the markup and translate by -50% over a
 * linear infinite loop, so the seam is invisible. No JS, no
 * IntersectionObserver, no dependencies. Respects
 * `prefers-reduced-motion` by pausing the animation.
 *
 * Logos are merchant blocks so they're re-orderable inside the theme
 * editor, matching how Shopify's own logo-list section is authored.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";
import { logoHeightPx, logoWallDefaults } from "./schema";

export function logoWallToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const scope = scopeClass(ctx.sectionType, ctx.blockId);
  const small = logoHeightPx("small");
  const medium = logoHeightPx("medium");
  const large = logoHeightPx("large");

  const schema = {
    name: "Logo wall",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: logoWallDefaults.heading },
      {
        type: "select",
        id: "layout",
        label: "Layout",
        options: [
          { value: "grid", label: "Grid" },
          { value: "marquee", label: "Marquee" },
        ],
        default: logoWallDefaults.layout,
      },
      {
        type: "select",
        id: "logo_size",
        label: "Logo size",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        default: logoWallDefaults.logoSize,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: logoWallDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: logoWallDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: logoWallDefaults.padding.left },
    ],
    blocks: [
      {
        type: "logo",
        name: "Logo",
        settings: [
          { type: "image_picker", id: "image", label: "Logo image" },
          { type: "text", id: "alt", label: "Alt text" },
          { type: "url", id: "link", label: "Link (optional)" },
        ],
      },
    ],
    max_blocks: 12,
    presets: [{ name: "Logo wall", blocks: [{ type: "logo" }, { type: "logo" }, { type: "logo" }, { type: "logo" }] }],
  };

  const propMap: CssPropMap[] = [
    {
      propKey: "padding",
      cssProperty: "padding",
      toCss: (v) => {
        const p = v as SpacingValue;
        return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
      },
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  const template = `
${styleBlock}
{%- liquid
  assign size = section.settings.logo_size | default: '${logoWallDefaults.logoSize}'
  assign h = ${medium}
  if size == 'small'
    assign h = ${small}
  elsif size == 'large'
    assign h = ${large}
  endif
  assign is_marquee = false
  if section.settings.layout == 'marquee'
    assign is_marquee = true
  endif
-%}

<div
  class="${scope} demeurer-logo-wall"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  {%- if section.settings.heading != blank -%}
    <div
      class="demeurer-logo-wall__heading"
      style="
        text-align: center;
        font-size: 0.85rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
        margin: 0 0 24px;
      "
    >{{ section.settings.heading | escape }}</div>
  {%- endif -%}

  {%- if is_marquee -%}
    <style>
      .demeurer-marquee-{{ section.id }} { overflow: hidden; }
      .demeurer-marquee-{{ section.id }} .demeurer-logo-wall__track {
        display: flex;
        gap: 40px;
        align-items: center;
        width: max-content;
        animation: demeurer-marquee-{{ section.id }} 30s linear infinite;
      }
      @keyframes demeurer-marquee-{{ section.id }} {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .demeurer-marquee-{{ section.id }} .demeurer-logo-wall__track { animation: none; }
      }
    </style>
    <div class="demeurer-marquee-{{ section.id }}">
      <div class="demeurer-logo-wall__track">
        {%- for i in (1..2) -%}
          {%- for block in section.blocks -%}
            {%- if block.type == 'logo' -%}
              {%- render 'demeurer-logo-wall-item', block: block, h: h -%}
            {%- endif -%}
          {%- endfor -%}
        {%- endfor -%}
      </div>
    </div>
  {%- else -%}
    <div
      class="demeurer-logo-wall__row"
      style="
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 40px;
      "
    >
      {%- for block in section.blocks -%}
        {%- if block.type == 'logo' -%}
          {%- render 'demeurer-logo-wall-item', block: block, h: h -%}
        {%- endif -%}
      {%- endfor -%}
    </div>
  {%- endif -%}
</div>
`.trim();

  // The item snippet renders an <a> when a link is set, otherwise a
  // bare wrapper — keeps the marquee duplicate path identical to the
  // grid path.
  const itemSnippet = `
{%- liquid
  assign img = block.settings.image
  assign alt = block.settings.alt | default: img.alt | default: ''
  assign link = block.settings.link
-%}
{%- capture inner -%}
  {%- if img != blank -%}
    {{ img | image_url: width: 360 | image_tag:
        loading: 'lazy',
        widths: '120, 180, 240, 360',
        sizes: '180px',
        alt: alt,
        style: 'height: ' | append: h | append: 'px; width: auto; max-width: 180px; object-fit: contain; opacity: 0.85;'
    }}
  {%- endif -%}
{%- endcapture -%}
{%- if link != blank -%}
  <a href="{{ link }}" style="display: inline-flex; align-items: center; height: {{ h }}px;" {{ block.shopify_attributes }}>{{ inner }}</a>
{%- else -%}
  <div style="display: inline-flex; align-items: center; height: {{ h }}px;" {{ block.shopify_attributes }}>{{ inner }}</div>
{%- endif -%}
`.trim();

  return {
    schema,
    template,
    assets: [{ filename: "demeurer-logo-wall-item.liquid", content: itemSnippet }],
  };
}
