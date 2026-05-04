/**
 * CTA band — Liquid compiler.
 *
 * The auto text-color is computed at compile time from the merchant's
 * canvas color, then re-derived at runtime via a small Liquid `if`
 * over the hex value. We baking a fallback into the template lets
 * the section render correctly even if the merchant's theme editor
 * picks a wildly different background later.
 */

import type { PropsByBreakpoint } from "../../editor/types.ts";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types.ts";
import { liquidString } from "../_shared/coerce.ts";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  textAlignLogical,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css.ts";
import { coerceCtaBandProps, ctaBandDefaults } from "./schema.ts";

export function ctaBandToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceCtaBandProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "CTA band",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: ctaBandDefaults.heading },
      { type: "richtext", id: "subheading", label: "Subheading", default: ctaBandDefaults.subheading },
      { type: "text", id: "cta_label", label: "Primary CTA label", default: ctaBandDefaults.ctaLabel },
      { type: "url", id: "cta_url", label: "Primary CTA link" },
      { type: "text", id: "secondary_cta_label", label: "Secondary CTA label" },
      { type: "url", id: "secondary_cta_url", label: "Secondary CTA link" },
      {
        type: "color",
        id: "background",
        label: "Background color",
        default: ctaBandDefaults.background,
      },
      {
        type: "select",
        id: "alignment",
        label: "Text alignment",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ],
        default: ctaBandDefaults.alignment,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: ctaBandDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: ctaBandDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: ctaBandDefaults.padding.left },
    ],
    presets: [{ name: "CTA band" }],
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
    {
      propKey: "alignment",
      cssProperty: "text-align",
      toCss: textAlignLogical,
    },
    {
      propKey: "background",
      cssProperty: "background",
      toCss: (v) => (typeof v === "string" ? v : ctaBandDefaults.background),
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  // Liquid auto-contrast: parse the hex into r/g/b and apply Rec. 709
  // luma — same formula as the canvas. Liquid has no `color_brightness`
  // filter on every theme, so we hand-roll it with `color_extract`,
  // which is a Shopify-supported filter.
  const template = `
{%- liquid
  assign bg = section.settings.background | default: ${liquidString(props.background)}
  assign r = bg | color_extract: 'red' | default: 0
  assign g = bg | color_extract: 'green' | default: 0
  assign b = bg | color_extract: 'blue' | default: 0
  assign luma = r | times: 0.2126
  assign luma = g | times: 0.7152 | plus: luma
  assign luma = b | times: 0.0722 | plus: luma
  assign text_color = '#0a0a0a'
  if luma < 140
    assign text_color = '#ffffff'
  endif
  assign text_align_logical = 'center'
  if section.settings.alignment == 'left'
    assign text_align_logical = 'start'
  elsif section.settings.alignment == 'right'
    assign text_align_logical = 'end'
  endif
-%}

${styleBlock}
<div
  class="${scope} demeurer-cta-band demeurer-cta-band--{{ section.settings.alignment }}"
  style="
    background: {{ bg }};
    color: {{ text_color }};
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
    text-align: {{ text_align_logical }};
  "
>
  <div class="demeurer-cta-band__inner" style="max-width: 720px; {% if section.settings.alignment == 'center' %}margin-inline: auto;{% endif %}">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-cta-band__heading" style="margin: 0; line-height: 1.2;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-cta-band__subheading" style="margin-top: 16px; line-height: 1.5; opacity: 0.85;">{{ section.settings.subheading }}</div>
    {%- endif -%}
    {%- if section.settings.cta_label != blank or section.settings.secondary_cta_label != blank -%}
      <div
        class="demeurer-cta-band__buttons"
        style="
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
          {%- if section.settings.alignment == 'center' %} justify-content: center;{% endif -%}
        "
      >
        {%- if section.settings.cta_label != blank -%}
          <a
            class="demeurer-cta-band__cta"
            href="{{ section.settings.cta_url | default: '#' }}"
            style="display: inline-block; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 4px; text-decoration: none; font-weight: 600;"
          >
            {{ section.settings.cta_label | escape }}
          </a>
        {%- endif -%}
        {%- if section.settings.secondary_cta_label != blank -%}
          <a
            class="demeurer-cta-band__cta-secondary"
            href="{{ section.settings.secondary_cta_url | default: '#' }}"
            style="display: inline-block; padding: 12px 24px; background: transparent; color: {{ text_color }}; border: 1px solid {{ text_color }}; border-radius: 4px; text-decoration: none; font-weight: 600;"
          >
            {{ section.settings.secondary_cta_label | escape }}
          </a>
        {%- endif -%}
      </div>
    {%- endif -%}
  </div>
</div>
`.trim();

  return { schema, template };
}
