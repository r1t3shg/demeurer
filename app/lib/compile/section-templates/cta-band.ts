/**
 * CTA band — shared section template + per-block adapters.
 *
 * Auto text-color via Liquid `color_extract` + Rec. 709 luma — same
 * formula as the existing per-block compiler. Lives in the shared
 * template so the section is fully self-contained.
 */

import {
  coerceCtaBandProps,
  ctaBandDefaults,
  ctaBandSchema,
  CTA_BAND_TYPE,
} from "../../sections/cta-band/schema.ts";
import {
  alignmentPropMap,
  backgroundPropMap,
  buildSharedSectionFile,
  decomposeSpacing,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- liquid
  assign bg = section.settings.background
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
-%}

<section class="{{ scope }} demeurer-section demeurer-cta-band demeurer-cta-band--{{ section.settings.alignment }}" style="color: {{ text_color }};">
  <div class="demeurer-cta-band__inner" style="max-width: 720px; {% if section.settings.alignment == 'center' %}margin-inline: auto;{% endif %}">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-cta-band__heading" style="margin: 0; line-height: 1.2;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-cta-band__subheading" style="margin-top: 16px; line-height: 1.5; opacity: 0.85;">{{ section.settings.subheading }}</div>
    {%- endif -%}
    {%- if section.settings.ctaLabel != blank or section.settings.secondaryCtaLabel != blank -%}
      <div class="demeurer-cta-band__buttons" style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px;{% if section.settings.alignment == 'center' %} justify-content: center;{% endif %}">
        {%- if section.settings.ctaLabel != blank -%}
          <a class="demeurer-cta-band__cta" href="{{ section.settings.ctaUrl | default: '#' }}" style="display: inline-block; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 4px; text-decoration: none; font-weight: 600;">{{ section.settings.ctaLabel | escape }}</a>
        {%- endif -%}
        {%- if section.settings.secondaryCtaLabel != blank -%}
          <a class="demeurer-cta-band__cta-secondary" href="{{ section.settings.secondaryCtaUrl | default: '#' }}" style="display: inline-block; padding: 12px 24px; background: transparent; color: {{ text_color }}; border: 1px solid {{ text_color }}; border-radius: 4px; text-decoration: none; font-weight: 600;">{{ section.settings.secondaryCtaLabel | escape }}</a>
        {%- endif -%}
      </div>
    {%- endif -%}
  </div>
</section>
`;

export const ctaBandTemplate: SectionTemplate = {
  type: CTA_BAND_TYPE,
  schema: ctaBandSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: CTA_BAND_TYPE,
      name: "Demeurer CTA band",
      body: BODY,
      schema: ctaBandSchema,
      presets: [{ name: "Demeurer CTA band" }],
    }),
  propMap: [
    paddingPropMap(),
    alignmentPropMap(),
    backgroundPropMap("background", ctaBandDefaults.background),
  ],
  toSettings(mobileProps) {
    const p = coerceCtaBandProps(mobileProps);
    return {
      heading: p.heading,
      subheading: p.subheading,
      ctaLabel: p.ctaLabel,
      ctaUrl: p.ctaUrl,
      secondaryCtaLabel: p.secondaryCtaLabel,
      secondaryCtaUrl: p.secondaryCtaUrl,
      background: p.background,
      alignment: p.alignment,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
