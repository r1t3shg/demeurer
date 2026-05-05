/**
 * Hero — shared section template + per-block adapters.
 *
 * The shared file at `sections/demeurer-hero.liquid` is parameterless:
 * same bytes for every merchant. Per-block customization rides in the
 * page template's `section.settings`.
 */

import { coerceHeroProps, heroSchema, HERO_TYPE } from "../../sections/hero/schema.ts";
import { alignmentPropMap, buildSharedSectionFile, decomposeSpacing, paddingPropMap } from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
<section class="{{ scope }} demeurer-section demeurer-hero demeurer-hero--{{ section.settings.alignment }}" style="position: relative; overflow: hidden; min-height: 240px;">
  {%- if section.settings.backgroundImage != blank -%}
    <div class="demeurer-hero__bg" style="position: absolute; inset: 0; z-index: 0; background-image: url('{{ section.settings.backgroundImage | image_url: width: 2400 }}'); background-size: cover; background-position: center;" role="presentation"></div>
    <div class="demeurer-hero__overlay" style="position: absolute; inset: 0; z-index: 1; background-color: {{ section.settings.overlayColor }}; pointer-events: none;" aria-hidden="true"></div>
  {%- endif -%}

  <div class="demeurer-hero__content" style="position: relative; z-index: 2; max-width: 720px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h1 class="demeurer-hero__heading">{{ section.settings.heading | escape }}</h1>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-hero__subheading">{{ section.settings.subheading }}</div>
    {%- endif -%}
    {%- if section.settings.ctaLabel != blank -%}
      <a class="demeurer-hero__cta" href="{{ section.settings.ctaUrl | default: '#' }}">{{ section.settings.ctaLabel | escape }}</a>
    {%- endif -%}
  </div>
</section>
`;

export const heroTemplate: SectionTemplate = {
  type: HERO_TYPE,
  schema: heroSchema,
  productAware: true,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: HERO_TYPE,
      name: "Demeurer Hero",
      body: BODY,
      schema: heroSchema,
      presets: [{ name: "Demeurer Hero" }],
      productAware: true,
    }),
  propMap: [paddingPropMap(), alignmentPropMap()],
  toSettings(mobileProps) {
    const p = coerceHeroProps(mobileProps);
    return {
      heading: p.heading,
      subheading: p.subheading,
      backgroundImage: p.backgroundImage,
      alignment: p.alignment,
      ctaUrl: p.ctaUrl,
      ctaLabel: p.ctaLabel,
      overlayColor: p.overlayColor,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
