/**
 * Hero — Liquid compiler.
 *
 * Architectural commitment recap: the published page is pure Liquid.
 * This compiler produces output that a Shopify theme reviewer would
 * recognize as standard section code — no Demeurer runtime, no embedded
 * external scripts, no inlined fonts. Images go through the `image_url`
 * filter so Shopify CDN sizing/optimization works.
 *
 * Responsive output (P1.C segment 4):
 *  - Mobile values render via inline `style="…"` driven by Liquid
 *    `section.settings.*` so theme-editor edits stay live for mobile.
 *  - Tablet/desktop overrides bake compile-time and emit `@media` rules
 *    inside a `{% style %}` block scoped to a unique class
 *    (`demeurer-hero-<blockId>`). Override declarations use `!important`
 *    to win over the inline mobile styles.
 *  - `_visibility: false` at tablet/desktop emits a `display: none`
 *    rule at the matching breakpoint.
 *  - All of the above is pure CSS — no JavaScript injected.
 */

import type { PropsByBreakpoint } from "../../editor/types.ts";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types.ts";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  textAlignLogical,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css.ts";
import { coerceHeroProps, heroDefaults } from "./schema.ts";

export function heroToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceHeroProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "Hero",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      {
        type: "text",
        id: "heading",
        label: "Heading",
        default: heroDefaults.heading,
      },
      {
        type: "richtext",
        id: "subheading",
        label: "Subheading",
        default: heroDefaults.subheading,
      },
      {
        type: "image_picker",
        id: "background_image",
        label: "Background image",
      },
      {
        type: "select",
        id: "alignment",
        label: "Text alignment",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ],
        default: heroDefaults.alignment,
      },
      {
        type: "url",
        id: "cta_url",
        label: "CTA link",
        default: heroDefaults.ctaUrl,
      },
      {
        type: "text",
        id: "cta_label",
        label: "CTA button text",
        default: heroDefaults.ctaLabel,
      },
      {
        type: "color",
        id: "overlay_color",
        label: "Image overlay",
        default: heroDefaults.overlayColor,
      },
      {
        type: "range",
        id: "padding_top",
        label: "Padding top",
        min: 0,
        max: 240,
        step: 4,
        unit: "px",
        default: heroDefaults.padding.top,
      },
      {
        type: "range",
        id: "padding_bottom",
        label: "Padding bottom",
        min: 0,
        max: 240,
        step: 4,
        unit: "px",
        default: heroDefaults.padding.bottom,
      },
      {
        type: "range",
        id: "padding_x",
        label: "Padding (sides)",
        min: 0,
        max: 96,
        step: 4,
        unit: "px",
        default: heroDefaults.padding.left,
      },
    ],
    presets: [{ name: "Hero" }],
  };

  // Map breakpoint-overridable props to CSS declarations. The shared
  // helper diffs these against the cascade and emits @media rules only
  // for actual overrides.
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
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  // Defaults injected via Liquid `default:` filter so a freshly published
  // page renders correctly even if the merchant edits the section in
  // Shopify's theme editor and clears a value. Use Liquid string
  // concatenation rather than embedding our prop values directly — the
  // canvas's current props are useful as defaults, but `section.settings`
  // is the source of truth at runtime.
  const template = `
${styleBlock}
{%- liquid
  assign heading = section.settings.heading | default: ${liquidString(props.heading)}
  assign cta_url = section.settings.cta_url | default: ${liquidString(props.ctaUrl)}
  assign cta_label = section.settings.cta_label | default: ${liquidString(props.ctaLabel)}
  assign alignment = section.settings.alignment | default: ${liquidString(props.alignment)}
  assign overlay_color = section.settings.overlay_color | default: ${liquidString(props.overlayColor)}
  assign padding_top = section.settings.padding_top | default: ${props.padding.top}
  assign padding_bottom = section.settings.padding_bottom | default: ${props.padding.bottom}
  assign padding_x = section.settings.padding_x | default: ${props.padding.left}
  assign text_align_logical = 'center'
  if alignment == 'left'
    assign text_align_logical = 'start'
  elsif alignment == 'right'
    assign text_align_logical = 'end'
  endif
-%}

<div
  class="${scope} demeurer-hero demeurer-hero--{{ alignment }}"
  style="
    padding-top: {{ padding_top }}px;
    padding-inline-end: {{ padding_x }}px;
    padding-bottom: {{ padding_bottom }}px;
    padding-inline-start: {{ padding_x }}px;
    text-align: {{ text_align_logical }};
    position: relative;
    overflow: hidden;
    min-height: 240px;
  "
>
  {%- if section.settings.background_image != blank -%}
    <div
      class="demeurer-hero__bg"
      style="
        position: absolute; inset: 0; z-index: 0;
        background-image: url('{{ section.settings.background_image | image_url: width: 2400 }}');
        background-size: cover; background-position: center;
      "
      role="presentation"
    ></div>
    <div
      class="demeurer-hero__overlay"
      style="
        position: absolute; inset: 0; z-index: 1;
        background-color: {{ overlay_color }};
        pointer-events: none;
      "
      aria-hidden="true"
    ></div>
  {%- endif -%}

  <div class="demeurer-hero__content" style="position: relative; z-index: 2; max-width: 720px; margin-inline: auto;">
    <h1 class="demeurer-hero__heading">{{ heading | escape }}</h1>
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-hero__subheading">{{ section.settings.subheading }}</div>
    {%- endif -%}
    {%- if cta_label != blank -%}
      <a class="demeurer-hero__cta" href="{{ cta_url }}">{{ cta_label | escape }}</a>
    {%- endif -%}
  </div>
</div>
`.trim();

  return { schema, template };
}

/**
 * Wrap a JS string as a Liquid string literal. Liquid uses ' or " for
 * strings; we use single quotes and escape any embedded single quotes.
 * Backslashes are not interpreted by Liquid the way they are in JS, so
 * we don't escape them — but we do strip control characters that would
 * make the source invalid.
 */
function liquidString(s: string): string {
  const cleaned = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return `'${cleaned.replace(/'/g, "\\'")}'`;
}
