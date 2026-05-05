/**
 * Testimonial — shared section template + per-block adapters.
 *
 * Three layouts: single, carousel (CSS scroll-snap, no JS), grid.
 */

import {
  coerceTestimonialProps,
  describeRating,
  testimonialSchema,
  TESTIMONIAL_TYPE,
} from "../../sections/testimonial/schema.ts";
import {
  buildSharedSectionFile,
  decomposeSpacing,
  listItemsToBlocks,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

void describeRating; // describeRating is rendered in Liquid via filters; helper kept for parity.

const BODY = `
<section class="{{ scope }} demeurer-section demeurer-testimonial">
  <style>
    @media (prefers-reduced-motion: reduce) {
      .{{ scope }} .demeurer-testimonial__carousel { scroll-behavior: auto; }
    }
  </style>
  <div class="demeurer-testimonial__inner" style="max-width: 1200px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-testimonial__heading" style="text-align: center; margin: 0 0 32px;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}

    {%- if section.settings.layout == 'carousel' -%}
      <div class="demeurer-testimonial__carousel" style="display: flex; gap: 24px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 12px;">
        {%- for block in section.blocks -%}
          <article class="demeurer-testimonial__card" {{ block.shopify_attributes }} style="flex: 0 0 80%; scroll-snap-align: start; padding: 24px; background: #fafafa; border-radius: 8px;">
            {%- if block.settings.quote != blank -%}
              <blockquote class="demeurer-testimonial__quote" style="margin: 0; font-size: 1.1rem; line-height: 1.5;">{{ block.settings.quote }}</blockquote>
            {%- endif -%}
            <footer class="demeurer-testimonial__footer" style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              {%- if block.settings.authorImage != blank -%}
                {{ block.settings.authorImage | image_url: width: 80 | image_tag: width: 40, height: 40, loading: 'lazy', alt: block.settings.authorName, style: 'border-radius: 50%; object-fit: cover;' }}
              {%- endif -%}
              <div>
                {%- if block.settings.authorName != blank -%}
                  <div style="font-weight: 600;">{{ block.settings.authorName | escape }}</div>
                {%- endif -%}
                {%- if block.settings.authorTitle != blank -%}
                  <div style="opacity: 0.7; font-size: 0.9em;">{{ block.settings.authorTitle | escape }}</div>
                {%- endif -%}
              </div>
            </footer>
          </article>
        {%- endfor -%}
      </div>
    {%- elsif section.settings.layout == 'grid' -%}
      <div class="demeurer-testimonial__grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
        {%- for block in section.blocks -%}
          <article class="demeurer-testimonial__card" {{ block.shopify_attributes }} style="padding: 24px; background: #fafafa; border-radius: 8px;">
            {%- if block.settings.quote != blank -%}
              <blockquote class="demeurer-testimonial__quote" style="margin: 0; line-height: 1.5;">{{ block.settings.quote }}</blockquote>
            {%- endif -%}
            <footer class="demeurer-testimonial__footer" style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
              {%- if block.settings.authorImage != blank -%}
                {{ block.settings.authorImage | image_url: width: 80 | image_tag: width: 40, height: 40, loading: 'lazy', alt: block.settings.authorName, style: 'border-radius: 50%; object-fit: cover;' }}
              {%- endif -%}
              <div>
                {%- if block.settings.authorName != blank -%}
                  <div style="font-weight: 600;">{{ block.settings.authorName | escape }}</div>
                {%- endif -%}
                {%- if block.settings.authorTitle != blank -%}
                  <div style="opacity: 0.7; font-size: 0.9em;">{{ block.settings.authorTitle | escape }}</div>
                {%- endif -%}
              </div>
            </footer>
          </article>
        {%- endfor -%}
      </div>
    {%- else -%}
      {%- assign first = section.blocks | first -%}
      {%- if first -%}
        <article class="demeurer-testimonial__single" style="max-width: 720px; margin-inline: auto; text-align: center;">
          {%- if first.settings.quote != blank -%}
            <blockquote class="demeurer-testimonial__quote" style="margin: 0; font-size: 1.25rem; line-height: 1.5;">{{ first.settings.quote }}</blockquote>
          {%- endif -%}
          <footer class="demeurer-testimonial__footer" style="margin-top: 24px;">
            {%- if first.settings.authorImage != blank -%}
              {{ first.settings.authorImage | image_url: width: 96 | image_tag: width: 48, height: 48, loading: 'lazy', alt: first.settings.authorName, style: 'border-radius: 50%; object-fit: cover; margin-inline: auto; display: block;' }}
            {%- endif -%}
            {%- if first.settings.authorName != blank -%}
              <div style="font-weight: 600; margin-top: 12px;">{{ first.settings.authorName | escape }}</div>
            {%- endif -%}
            {%- if first.settings.authorTitle != blank -%}
              <div style="opacity: 0.7; font-size: 0.9em;">{{ first.settings.authorTitle | escape }}</div>
            {%- endif -%}
          </footer>
        </article>
      {%- endif -%}
    {%- endif -%}
  </div>
</section>
`;

export const testimonialTemplate: SectionTemplate = {
  type: TESTIMONIAL_TYPE,
  schema: testimonialSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: TESTIMONIAL_TYPE,
      name: "Demeurer Testimonial",
      body: BODY,
      schema: testimonialSchema,
      presets: [{ name: "Demeurer Testimonial" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceTestimonialProps(mobileProps);
    return {
      heading: p.heading,
      layout: p.layout,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
  toBlocks(mobileProps) {
    const p = coerceTestimonialProps(mobileProps);
    return listItemsToBlocks("testimonials", p.testimonials, (item) => ({
      quote: item.quote,
      authorName: item.authorName,
      authorTitle: item.authorTitle,
      authorImage: item.authorImage,
      rating: item.rating ?? 0,
    }));
  },
};
