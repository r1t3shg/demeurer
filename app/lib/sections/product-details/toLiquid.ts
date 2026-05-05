/**
 * Product details — Liquid compiler.
 *
 * Architectural note: variant interaction on the published storefront
 * relies on the theme implementing `<variant-radios>` /
 * `<variant-selects>` custom elements (Dawn, Sense, Studio, Refresh,
 * Spotlight all do as of 2025). Older themes that don't may need a
 * page reload for variant changes — acceptable degradation.
 *
 * We do NOT inject any JavaScript. The form action posts to
 * `/cart/add` (Shopify's standard route). The variants JSON inside
 * `<script type="application/json">` is the convention themes
 * already parse for variant pricing/availability/image data.
 *
 * Theme compatibility matrix: scripts/p2-theme-compatibility.md
 * (built in P2 — private beta).
 *
 * The whole template is wrapped in `{% if product %}` so the section
 * is safe if accidentally placed on a non-product template (renders
 * nothing instead of erroring on an undefined `product`).
 */

import type { PropsByBreakpoint } from "../../editor/types.ts";
import type { LiquidOutput, SpacingValue, ToLiquidContext } from "../types.ts";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css.ts";
import {
  coerceProductDetailsProps,
  productDetailsDefaults,
} from "./schema.ts";

export function productDetailsToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceProductDetailsProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "Product details",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "checkbox", id: "showImage", label: "Show product image", default: productDetailsDefaults.showImage },
      {
        type: "select",
        id: "imageLayout",
        label: "Image layout",
        options: [
          { value: "single", label: "Single" },
          { value: "gallery", label: "Gallery" },
          { value: "carousel", label: "Carousel" },
        ],
        default: productDetailsDefaults.imageLayout,
      },
      {
        type: "select",
        id: "imageSize",
        label: "Image size",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
        default: productDetailsDefaults.imageSize,
      },
      { type: "checkbox", id: "showPrice", label: "Show price", default: productDetailsDefaults.showPrice },
      {
        type: "select",
        id: "priceLayout",
        label: "Price layout",
        options: [
          { value: "stacked", label: "Stacked" },
          { value: "inline", label: "Inline" },
        ],
        default: productDetailsDefaults.priceLayout,
      },
      { type: "checkbox", id: "showSku", label: "Show SKU", default: productDetailsDefaults.showSku },
      { type: "checkbox", id: "showVendor", label: "Show vendor", default: productDetailsDefaults.showVendor },
      { type: "checkbox", id: "showVariantPicker", label: "Show variant picker", default: productDetailsDefaults.showVariantPicker },
      {
        type: "select",
        id: "variantPickerStyle",
        label: "Variant picker style",
        options: [
          { value: "dropdown", label: "Dropdown" },
          { value: "buttons", label: "Buttons" },
          { value: "swatches", label: "Swatches" },
        ],
        default: productDetailsDefaults.variantPickerStyle,
      },
      { type: "checkbox", id: "showQuantity", label: "Show quantity", default: productDetailsDefaults.showQuantity },
      { type: "checkbox", id: "showAddToCart", label: "Show add-to-cart", default: productDetailsDefaults.showAddToCart },
      { type: "text", id: "addToCartLabel", label: "Add-to-cart label", default: productDetailsDefaults.addToCartLabel },
      { type: "checkbox", id: "showDescription", label: "Show description", default: productDetailsDefaults.showDescription },
      {
        type: "select",
        id: "descriptionPosition",
        label: "Description position",
        options: [
          { value: "below-buy-button", label: "Below buy button" },
          { value: "beside-image", label: "Beside image" },
          { value: "accordion-below", label: "Accordion below" },
        ],
        default: productDetailsDefaults.descriptionPosition,
      },
      {
        type: "select",
        id: "layout",
        label: "Layout",
        options: [
          { value: "image-left-content-right", label: "Image left, content right" },
          { value: "image-right-content-left", label: "Image right, content left" },
          { value: "image-top-content-bottom", label: "Image top, content bottom" },
        ],
        default: productDetailsDefaults.layout,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: productDetailsDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: productDetailsDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: productDetailsDefaults.padding.left },
    ],
    presets: [{ name: "Product details" }],
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
{%- if product -%}
${styleBlock}
{%- assign current_variant = product.selected_or_first_available_variant -%}
{%- assign picker_tag = 'variant-radios' -%}
{%- if section.settings.variantPickerStyle == 'dropdown' -%}
  {%- assign picker_tag = 'variant-selects' -%}
{%- endif -%}

<section
  class="${scope} demeurer-section demeurer-product-details demeurer-product-details--{{ section.settings.layout }}"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
    display: flex;
    flex-wrap: wrap;
    gap: 48px;
    align-items: flex-start;
    flex-direction:
    {%- if section.settings.layout == 'image-top-content-bottom' %} column
    {%- elsif section.settings.layout == 'image-right-content-left' %} row-reverse
    {%- else %} row
    {%- endif -%};
  "
>
  {%- if section.settings.showImage -%}
    <div class="demeurer-product-details__media" style="flex: 1 1 320px; min-width: 240px;">
      {%- if product.featured_image -%}
        {{ product.featured_image | image_url: width: 1600 | image_tag:
          loading: 'lazy',
          widths: '400, 600, 800, 1200, 1600',
          sizes: '(min-width: 768px) 50vw, 100vw',
          alt: product.featured_image.alt | default: product.title,
          style: 'width: 100%; height: auto; border-radius: 8px; display: block;'
        }}
      {%- else -%}
        <div style="aspect-ratio: 1 / 1; background: #e5e7eb; border-radius: 8px;"></div>
      {%- endif -%}
      {%- if section.settings.imageLayout != 'single' and product.images.size > 1 -%}
        <div class="demeurer-product-details__thumbs" style="display: flex; gap: 6px; margin-top: 8px; overflow-x: auto;">
          {%- for img in product.images limit: 6 -%}
            {{ img | image_url: width: 200 | image_tag:
              loading: 'lazy',
              alt: img.alt,
              style: 'width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb;'
            }}
          {%- endfor -%}
        </div>
      {%- endif -%}
    </div>
  {%- endif -%}

  <div class="demeurer-product-details__buy-area" style="flex: 1 1 320px; min-width: 240px; display: flex; flex-direction: column; gap: 12px;">
    {%- if section.settings.showVendor and product.vendor != blank -%}
      <p class="demeurer-product-details__vendor" style="margin: 0; opacity: 0.7; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em;">{{ product.vendor }}</p>
    {%- endif -%}

    <h1 class="demeurer-product-details__title" style="margin: 0;">{{ product.title }}</h1>

    {%- if section.settings.showPrice -%}
      <div class="demeurer-product-details__price" style="font-size: 24px; font-weight: 600; {%- if section.settings.priceLayout == 'inline' -%}display: inline-flex; gap: 8px;{%- else -%}display: flex; gap: 8px;{%- endif -%}">
        <span data-price>{{ current_variant.price | money }}</span>
        {%- if current_variant.compare_at_price > current_variant.price -%}
          <s data-compare-price style="opacity: 0.6;">{{ current_variant.compare_at_price | money }}</s>
        {%- endif -%}
      </div>
    {%- endif -%}

    {%- if section.settings.showSku and current_variant.sku != blank -%}
      <p class="demeurer-product-details__sku" style="margin: 0; opacity: 0.7; font-size: 13px;">SKU: <span data-sku>{{ current_variant.sku }}</span></p>
    {%- endif -%}

    {%- if section.settings.showVariantPicker and product.variants.size > 1 -%}
      <{{ picker_tag }}
        data-section="{{ section.id }}"
        data-url="{{ product.url }}"
        data-update-url="true"
        class="demeurer-product-details__variant-picker"
      >
        <form
          method="post"
          action="/cart/add"
          enctype="multipart/form-data"
          id="product-form-{{ section.id }}"
          accept-charset="UTF-8"
          class="form"
          novalidate="novalidate"
          data-type="add-to-cart-form"
        >
          <input type="hidden" name="form_type" value="product">
          <input type="hidden" name="utf8" value="✓">

          {%- if section.settings.variantPickerStyle == 'dropdown' -%}
            {%- for option in product.options_with_values -%}
              <div class="product-form__input product-form__input--dropdown">
                <label class="form__label" for="Option-{{ section.id }}-{{ forloop.index0 }}">{{ option.name }}</label>
                <div class="select">
                  <select
                    id="Option-{{ section.id }}-{{ forloop.index0 }}"
                    class="select__select"
                    name="options[{{ option.name | escape }}]"
                    form="product-form-{{ section.id }}"
                  >
                    {%- for value in option.values -%}
                      <option value="{{ value | escape }}" {% if option.selected_value == value %}selected="selected"{% endif %}>{{ value }}</option>
                    {%- endfor -%}
                  </select>
                </div>
              </div>
            {%- endfor -%}
          {%- else -%}
            {%- for option in product.options_with_values -%}
              <fieldset class="js product-form__input">
                <legend class="form__label">{{ option.name }}</legend>
                {%- for value in option.values -%}
                  <input
                    type="radio"
                    id="{{ section.id }}-{{ option.position }}-{{ forloop.index0 }}"
                    name="options[{{ option.name | escape }}]"
                    value="{{ value | escape }}"
                    form="product-form-{{ section.id }}"
                    {% if option.selected_value == value %}checked{% endif %}
                  >
                  <label for="{{ section.id }}-{{ option.position }}-{{ forloop.index0 }}">{{ value }}</label>
                {%- endfor -%}
              </fieldset>
            {%- endfor -%}
          {%- endif -%}

          <script type="application/json" data-selected-variant>
            {{ current_variant | json }}
          </script>
          <script type="application/json">
            {{ product.variants | json }}
          </script>

          <input type="hidden" name="id" value="{{ current_variant.id }}">

          {%- if section.settings.showQuantity -%}
            <div class="product-form__quantity" style="display: flex; gap: 8px; align-items: center;">
              <label for="quantity-{{ section.id }}">Quantity</label>
              <input
                type="number"
                name="quantity"
                id="quantity-{{ section.id }}"
                value="1"
                min="1"
                form="product-form-{{ section.id }}"
                style="width: 64px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px;"
              >
            </div>
          {%- endif -%}

          {%- if section.settings.showAddToCart -%}
            <button
              type="submit"
              name="add"
              form="product-form-{{ section.id }}"
              class="demeurer-product-details__add-to-cart"
              {% unless current_variant.available %}disabled="disabled"{% endunless %}
              style="margin-top: 16px; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border: 0; border-radius: 4px; font-weight: 600; cursor: pointer;"
            >
              {%- if current_variant.available -%}
                {{ section.settings.addToCartLabel | default: 'Add to cart' | escape }}
              {%- else -%}
                Sold out
              {%- endif -%}
            </button>
          {%- endif -%}
        </form>
      </{{ picker_tag }}>
    {%- endif -%}

    {%- if section.settings.showDescription and product.description != blank -%}
      <div class="demeurer-product-details__description" style="margin-top: 16px; line-height: 1.6;">
        {{ product.description }}
      </div>
    {%- endif -%}
  </div>
</section>
{%- else -%}
<!-- demeurer-product-details: no product context; section renders nothing on non-product templates -->
{%- endif -%}
`.trim();

  return { schema, template };
}
