/**
 * Logo wall — shared section template + per-block adapters.
 *
 * Marquee layout uses a CSS-only horizontal scroll — no JS, no
 * IntersectionObserver, no external libraries.
 */

import {
  coerceLogoWallProps,
  logoHeightPx,
  logoWallSchema,
  LOGO_WALL_TYPE,
} from "../../sections/logo-wall/schema.ts";
import {
  buildSharedSectionFile,
  decomposeSpacing,
  listItemsToBlocks,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- liquid
  case section.settings.logoSize
    when 'small'
      assign logo_h = ${logoHeightPx("small")}
    when 'large'
      assign logo_h = ${logoHeightPx("large")}
    else
      assign logo_h = ${logoHeightPx("medium")}
  endcase
-%}

<section class="{{ scope }} demeurer-section demeurer-logo-wall">
  <div class="demeurer-logo-wall__inner" style="max-width: 1200px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h3 class="demeurer-logo-wall__heading" style="margin: 0 0 24px; text-align: center; font-size: 14px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7;">{{ section.settings.heading | escape }}</h3>
    {%- endif -%}

    {%- if section.settings.layout == 'marquee' -%}
      <div class="demeurer-logo-wall__marquee" style="overflow: hidden; mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);">
        <div class="demeurer-logo-wall__track" style="display: flex; gap: 48px; animation: demeurer-logo-marquee 30s linear infinite; align-items: center; width: max-content;">
          {%- for block in section.blocks -%}
            {%- if block.settings.image != blank -%}
              {%- if block.settings.link != blank -%}
                <a href="{{ block.settings.link }}" {{ block.shopify_attributes }}>
                  {{ block.settings.image | image_url: height: logo_h | image_tag:
                    height: logo_h, alt: block.settings.alt, loading: 'lazy',
                    style: 'height: 100%; width: auto; display: block;' }}
                </a>
              {%- else -%}
                <span {{ block.shopify_attributes }}>
                  {{ block.settings.image | image_url: height: logo_h | image_tag:
                    height: logo_h, alt: block.settings.alt, loading: 'lazy',
                    style: 'height: 100%; width: auto; display: block;' }}
                </span>
              {%- endif -%}
            {%- endif -%}
          {%- endfor -%}
        </div>
      </div>
      <style>
        @keyframes demeurer-logo-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      </style>
    {%- else -%}
      <div class="demeurer-logo-wall__grid" style="display: flex; flex-wrap: wrap; gap: 48px; align-items: center; justify-content: center;">
        {%- for block in section.blocks -%}
          {%- if block.settings.image != blank -%}
            {%- if block.settings.link != blank -%}
              <a href="{{ block.settings.link }}" {{ block.shopify_attributes }}>
                {{ block.settings.image | image_url: height: logo_h | image_tag:
                  height: logo_h, alt: block.settings.alt, loading: 'lazy',
                  style: 'height: 100%; width: auto; display: block; opacity: 0.75;' }}
              </a>
            {%- else -%}
              <span {{ block.shopify_attributes }}>
                {{ block.settings.image | image_url: height: logo_h | image_tag:
                  height: logo_h, alt: block.settings.alt, loading: 'lazy',
                  style: 'height: 100%; width: auto; display: block; opacity: 0.75;' }}
              </span>
            {%- endif -%}
          {%- endif -%}
        {%- endfor -%}
      </div>
    {%- endif -%}
  </div>
</section>
`;

export const logoWallTemplate: SectionTemplate = {
  type: LOGO_WALL_TYPE,
  schema: logoWallSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: LOGO_WALL_TYPE,
      name: "Demeurer Logo wall",
      body: BODY,
      schema: logoWallSchema,
      presets: [{ name: "Demeurer Logo wall" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceLogoWallProps(mobileProps);
    return {
      heading: p.heading,
      layout: p.layout,
      logoSize: p.logoSize,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
  toBlocks(mobileProps) {
    const p = coerceLogoWallProps(mobileProps);
    return listItemsToBlocks("logos", p.logos, (item) => ({
      image: item.image,
      alt: item.alt,
      link: item.link,
    }));
  },
};
