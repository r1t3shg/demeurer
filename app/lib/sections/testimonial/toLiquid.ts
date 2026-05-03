/**
 * Testimonial — Liquid compiler.
 *
 * Each testimonial is a section block (`testimonial`), so the merchant
 * can re-order them in Shopify's theme editor too. Single/grid emit
 * pure HTML; carousel falls back to a CSS scroll-snap row — fully JS-
 * free, swipeable on touch devices, and gracefully degrades on browsers
 * that don't honor scroll-snap. Honoring the page-speed commitment
 * means we don't ship a carousel framework just for arrows. If/when a
 * theme already provides a carousel JS, P1.D's compile pipeline can
 * detect and adapt — out of scope here.
 */

import type { LiquidOutput, ToLiquidContext } from "../types";
import { coerceTestimonialProps, testimonialDefaults } from "./schema";

export function testimonialToLiquid(
  rawProps: Record<string, unknown>,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceTestimonialProps(rawProps);

  const schema = {
    name: "Testimonials",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: testimonialDefaults.heading },
      {
        type: "select",
        id: "layout",
        label: "Layout",
        options: [
          { value: "single", label: "Single" },
          { value: "carousel", label: "Carousel (CSS scroll-snap)" },
          { value: "grid", label: "Grid" },
        ],
        default: testimonialDefaults.layout,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: testimonialDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: testimonialDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: testimonialDefaults.padding.left },
    ],
    blocks: [
      {
        type: "testimonial",
        name: "Testimonial",
        limit: 6,
        settings: [
          { type: "richtext", id: "quote", label: "Quote" },
          { type: "text", id: "author_name", label: "Author name" },
          { type: "text", id: "author_title", label: "Author title" },
          { type: "image_picker", id: "author_image", label: "Author photo" },
          {
            type: "range",
            id: "rating",
            label: "Rating",
            min: 0,
            max: 5,
            step: 0.5,
            default: 5,
          },
        ],
      },
    ],
    presets: [
      {
        name: "Testimonials",
        blocks: props.testimonials.map((t) => ({
          type: "testimonial",
          settings: {
            quote: t.quote,
            author_name: t.authorName,
            author_title: t.authorTitle,
            rating: t.rating ?? 5,
          },
        })),
      },
    ],
  };

  // Single layout container vs carousel/grid — switch via Liquid.
  const template = `
{%- liquid
  assign layout = section.settings.layout
  assign is_carousel = false
  if layout == 'carousel'
    assign is_carousel = true
  endif
-%}

<div
  class="demeurer-testimonial demeurer-testimonial--{{ layout }}"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  <div class="demeurer-testimonial__inner" style="max-width: 1200px; margin-inline: auto; text-align: center;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-testimonial__heading" style="margin: 0 0 32px 0;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}

    {%- if layout == 'single' -%}
      {%- assign first = section.blocks | first -%}
      {%- if first -%}
        <div style="max-width: 720px; margin-inline: auto;">
          {%- render 'demeurer-testimonial-card', block: first -%}
        </div>
      {%- endif -%}
    {%- elsif is_carousel -%}
      <div
        class="demeurer-testimonial__carousel"
        role="region"
        aria-label="Testimonials"
        style="
          display: flex;
          gap: 24px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px;
        "
      >
        {%- for block in section.blocks -%}
          <div style="flex: 0 0 min(720px, 90%); scroll-snap-align: start;" {{ block.shopify_attributes }}>
            {%- render 'demeurer-testimonial-card', block: block -%}
          </div>
        {%- endfor -%}
      </div>
    {%- else -%}
      <div
        class="demeurer-testimonial__grid"
        style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;"
      >
        {%- for block in section.blocks -%}
          <div {{ block.shopify_attributes }}>
            {%- render 'demeurer-testimonial-card', block: block -%}
          </div>
        {%- endfor -%}
      </div>
    {%- endif -%}
  </div>
</div>
`.trim();

  // Card snippet — extracted so single/grid/carousel all share markup.
  const cardSnippet = `
{%- liquid
  assign rating = block.settings.rating | default: 0
  assign full = rating | floor
  assign half_check = rating | minus: full
  assign has_half = false
  if half_check >= 0.5
    assign has_half = true
  endif
-%}

<div class="demeurer-testimonial__card" style="background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 24px; text-align: start; height: 100%;">
  {%- if rating > 0 -%}
    <div class="demeurer-testimonial__rating" aria-label="Rating: {{ rating }} out of 5" style="font-size: 14px; margin-bottom: 8px;">
      {%- for i in (1..5) -%}
        {%- if i <= full -%}★{%- elsif i == full | plus: 1 and has_half -%}⯨{%- else -%}☆{%- endif -%}
      {%- endfor -%}
    </div>
  {%- endif -%}

  {%- if block.settings.quote != blank -%}
    <div class="demeurer-testimonial__quote" style="font-size: 18px; line-height: 1.5; font-style: italic;">{{ block.settings.quote }}</div>
  {%- endif -%}

  <div class="demeurer-testimonial__meta" style="display: flex; align-items: center; gap: 12px; margin-top: 16px;">
    {%- if block.settings.author_image != blank -%}
      {{ block.settings.author_image | image_url: width: 80 | image_tag:
        loading: 'lazy',
        widths: '40, 80, 120',
        sizes: '40px',
        class: 'demeurer-testimonial__avatar',
        style: 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover;'
      }}
    {%- else -%}
      <div style="width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb;"></div>
    {%- endif -%}
    <div>
      {%- if block.settings.author_name != blank -%}
        <div style="font-weight: 600;">{{ block.settings.author_name | escape }}</div>
      {%- endif -%}
      {%- if block.settings.author_title != blank -%}
        <div style="font-size: 12px; opacity: 0.7;">{{ block.settings.author_title | escape }}</div>
      {%- endif -%}
    </div>
  </div>
</div>
`.trim();

  return {
    schema,
    template,
    assets: [
      { filename: "demeurer-testimonial-card.liquid", content: cardSnippet },
    ],
  };
}
