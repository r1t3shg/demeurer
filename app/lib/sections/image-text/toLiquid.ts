/**
 * Image + text — Liquid compiler.
 *
 * Image is a Shopify `image_picker` setting, which exposes a full Image
 * object. We render via `image_url: width: 1600` for a 2x crop on
 * 800px-wide containers and use `image_tag` so Shopify emits a
 * responsive `<img srcset>` — same behavior the merchant's other native
 * sections get.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types";
import { liquidString } from "../_shared/coerce";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";
import { coerceImageTextProps, imageTextDefaults } from "./schema";

export function imageTextToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceImageTextProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "Image + text",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "image_picker", id: "image", label: "Image" },
      { type: "text", id: "image_alt", label: "Image alt text", default: imageTextDefaults.imageAlt },
      {
        type: "select",
        id: "image_position",
        label: "Image position",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
        default: imageTextDefaults.imagePosition,
      },
      {
        type: "select",
        id: "image_width",
        label: "Image width",
        options: [
          { value: "40", label: "40%" },
          { value: "50", label: "50%" },
          { value: "60", label: "60%" },
        ],
        default: imageTextDefaults.imageWidth,
      },
      { type: "text", id: "heading", label: "Heading", default: imageTextDefaults.heading },
      { type: "richtext", id: "body", label: "Body", default: imageTextDefaults.body },
      { type: "text", id: "cta_label", label: "CTA label", default: imageTextDefaults.ctaLabel },
      { type: "url", id: "cta_url", label: "CTA link" },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: imageTextDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: imageTextDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: imageTextDefaults.padding.left },
    ],
    presets: [{ name: "Image + text" }],
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

  const template = `${styleBlock}
{%- liquid
  assign image_pct = section.settings.image_width | plus: 0
  assign text_pct = 100 | minus: image_pct
  assign flex_dir = 'row'
  if section.settings.image_position == 'right'
    assign flex_dir = 'row-reverse'
  endif
  assign cta_label = section.settings.cta_label | default: ${liquidString(props.ctaLabel)}
-%}

<div
  class="${scope} demeurer-image-text"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  <div
    class="demeurer-image-text__inner"
    style="
      max-width: 1200px;
      margin-inline: auto;
      display: flex;
      flex-direction: {{ flex_dir }};
      flex-wrap: wrap;
      align-items: center;
      gap: 48px;
    "
  >
    <div class="demeurer-image-text__image" style="flex: 1 1 {{ image_pct }}%; min-width: 240px;">
      {%- if section.settings.image != blank -%}
        {%- assign alt = section.settings.image_alt | default: section.settings.image.alt | default: '' -%}
        {{ section.settings.image | image_url: width: 1600 | image_tag:
          loading: 'lazy',
          widths: '400, 600, 800, 1200, 1600',
          sizes: '(min-width: 768px) 50vw, 100vw',
          alt: alt,
          class: 'demeurer-image-text__img',
          style: 'width: 100%; height: auto; border-radius: 8px; display: block;'
        }}
      {%- else -%}
        <div style="aspect-ratio: 4 / 3; background: #e5e7eb; border-radius: 8px;"></div>
      {%- endif -%}
    </div>
    <div class="demeurer-image-text__text" style="flex: 1 1 {{ text_pct }}%; min-width: 240px;">
      {%- if section.settings.heading != blank -%}
        <h2 class="demeurer-image-text__heading" style="margin: 0;">{{ section.settings.heading | escape }}</h2>
      {%- endif -%}
      {%- if section.settings.body != blank -%}
        <div class="demeurer-image-text__body" style="margin-top: 16px; line-height: 1.6;">{{ section.settings.body }}</div>
      {%- endif -%}
      {%- if cta_label != blank -%}
        <a
          class="demeurer-image-text__cta"
          href="{{ section.settings.cta_url | default: '#' }}"
          style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 4px; text-decoration: none; font-weight: 600;"
        >
          {{ cta_label | escape }}
        </a>
      {%- endif -%}
    </div>
  </div>
</div>
`.trim();

  return { schema, template };
}
