/**
 * Image + text — shared section template + per-block adapters.
 */

import {
  coerceImageTextProps,
  imageTextSchema,
  IMAGE_TEXT_TYPE,
} from "../../sections/image-text/schema.ts";
import { buildSharedSectionFile, decomposeSpacing, paddingPropMap } from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- liquid
  assign image_pct = section.settings.imageWidth | plus: 0
  assign text_pct = 100 | minus: image_pct
  assign flex_dir = 'row'
  if section.settings.imagePosition == 'right'
    assign flex_dir = 'row-reverse'
  endif
-%}

<section class="{{ scope }} demeurer-section demeurer-image-text">
  <div class="demeurer-image-text__inner" style="max-width: 1200px; margin-inline: auto; display: flex; flex-direction: {{ flex_dir }}; flex-wrap: wrap; align-items: center; gap: 48px;">
    <div class="demeurer-image-text__image" style="flex: 1 1 {{ image_pct }}%; min-width: 240px;">
      {%- if section.settings.image != blank -%}
        {%- assign alt = section.settings.imageAlt | default: section.settings.image.alt | default: '' -%}
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
      {%- if section.settings.ctaLabel != blank -%}
        <a class="demeurer-image-text__cta" href="{{ section.settings.ctaUrl | default: '#' }}" style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 4px; text-decoration: none; font-weight: 600;">{{ section.settings.ctaLabel | escape }}</a>
      {%- endif -%}
    </div>
  </div>
</section>
`;

export const imageTextTemplate: SectionTemplate = {
  type: IMAGE_TEXT_TYPE,
  schema: imageTextSchema,
  productAware: true,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: IMAGE_TEXT_TYPE,
      name: "Demeurer Image + text",
      body: BODY,
      schema: imageTextSchema,
      presets: [{ name: "Demeurer Image + text" }],
      productAware: true,
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceImageTextProps(mobileProps);
    return {
      image: p.image,
      imageAlt: p.imageAlt,
      imagePosition: p.imagePosition,
      imageWidth: p.imageWidth,
      heading: p.heading,
      body: p.body,
      ctaLabel: p.ctaLabel,
      ctaUrl: p.ctaUrl,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
