/**
 * Product details — shared section template + per-block adapters.
 *
 * The shared file at `sections/demeurer-product-details.liquid` is
 * parameterless: same bytes for every merchant. Per-page settings
 * carry visual configuration; product data comes from the runtime
 * `{{ product }}` context Shopify provides on product templates.
 *
 * Variant interaction relies on the theme implementing
 * <variant-radios> / <variant-selects> custom elements (Dawn, Sense,
 * Studio, Refresh, Spotlight all do as of 2025). Older themes may
 * need a page reload for variant changes — acceptable degradation.
 *
 * Theme compatibility matrix: scripts/p2-theme-compatibility.md
 * (built in P2 — private beta).
 */

import {
  coerceProductDetailsProps,
  productDetailsSchema,
  PRODUCT_DETAILS_TYPE,
} from "../../sections/product-details/schema.ts";
import {
  buildSharedSectionFile,
  decomposeSpacing,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- if product -%}
{%- assign current_variant = product.selected_or_first_available_variant -%}
{%- assign picker_tag = 'variant-radios' -%}
{%- if section.settings.variantPickerStyle == 'dropdown' -%}
  {%- assign picker_tag = 'variant-selects' -%}
{%- endif -%}

<section class="{{ scope }} demeurer-section demeurer-product-details demeurer-product-details--{{ section.settings.layout }}" style="display: grid; {%- if section.settings.layout == 'image-top-content-bottom' -%} grid-template-columns: 1fr; {%- else -%} grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); {%- endif -%} gap: 48px; align-items: start; {%- if section.settings.layout == 'image-right-content-left' -%} direction: rtl; {%- endif -%}">
  {%- if section.settings.showImage -%}
    <div class="demeurer-product-details__media" style="direction: ltr;">
      {%- if product.featured_image -%}
        {{ product.featured_image | image_url: width: 1600 | image_tag:
          loading: 'lazy',
          widths: '400, 600, 800, 1200, 1600',
          sizes: '(min-width: 768px) 50vw, 100vw',
          alt: product.featured_image.alt | default: product.title,
          style: 'width: 100%; height: auto; border-radius: 8px; display: block;' }}
      {%- else -%}
        <div style="aspect-ratio: 1 / 1; background: #e5e7eb; border-radius: 8px;"></div>
      {%- endif -%}
      {%- if section.settings.imageLayout != 'single' and product.images.size > 1 -%}
        <div class="demeurer-product-details__thumbs" style="display: flex; gap: 6px; margin-top: 8px; overflow-x: auto;">
          {%- for img in product.images limit: 6 -%}
            {{ img | image_url: width: 200 | image_tag: loading: 'lazy', alt: img.alt, style: 'width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb;' }}
          {%- endfor -%}
        </div>
      {%- endif -%}
    </div>
  {%- endif -%}

  <div class="demeurer-product-details__buy-area" style="direction: ltr; display: flex; flex-direction: column; gap: 12px;">
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
      <{{ picker_tag }} data-section="{{ section.id }}" data-url="{{ product.url }}" data-update-url="true" class="demeurer-product-details__variant-picker">
        <form method="post" action="/cart/add" enctype="multipart/form-data" id="product-form-{{ section.id }}" accept-charset="UTF-8" class="form" novalidate="novalidate" data-type="add-to-cart-form">
          <input type="hidden" name="form_type" value="product">
          <input type="hidden" name="utf8" value="✓">

          {%- if section.settings.variantPickerStyle == 'dropdown' -%}
            {%- for option in product.options_with_values -%}
              <div class="product-form__input product-form__input--dropdown">
                <label class="form__label" for="Option-{{ section.id }}-{{ forloop.index0 }}">{{ option.name }}</label>
                <div class="select">
                  <select id="Option-{{ section.id }}-{{ forloop.index0 }}" class="select__select" name="options[{{ option.name | escape }}]" form="product-form-{{ section.id }}">
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
                  <input type="radio" id="{{ section.id }}-{{ option.position }}-{{ forloop.index0 }}" name="options[{{ option.name | escape }}]" value="{{ value | escape }}" form="product-form-{{ section.id }}" {% if option.selected_value == value %}checked{% endif %}>
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
              <input type="number" name="quantity" id="quantity-{{ section.id }}" value="1" min="1" form="product-form-{{ section.id }}" style="width: 64px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px;">
            </div>
          {%- endif -%}

          {%- if section.settings.showAddToCart -%}
            <button type="submit" name="add" form="product-form-{{ section.id }}" class="demeurer-product-details__add-to-cart" {% unless current_variant.available %}disabled="disabled"{% endunless %} style="margin-top: 16px; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border: 0; border-radius: 4px; font-weight: 600; cursor: pointer;">
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
      <div class="demeurer-product-details__description" style="margin-top: 16px; line-height: 1.6;">{{ product.description }}</div>
    {%- endif -%}
  </div>
</section>
{%- else -%}
<!-- demeurer-product-details: no product context; section renders nothing on non-product templates -->
{%- endif -%}
`;

export const productDetailsTemplate: SectionTemplate = {
  type: PRODUCT_DETAILS_TYPE,
  schema: productDetailsSchema,
  productAware: true,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: PRODUCT_DETAILS_TYPE,
      name: "Demeurer Product details",
      body: BODY,
      schema: productDetailsSchema,
      presets: [{ name: "Demeurer Product details" }],
      productAware: true,
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceProductDetailsProps(mobileProps);
    return {
      showImage: p.showImage,
      imageLayout: p.imageLayout,
      imageSize: p.imageSize,
      showPrice: p.showPrice,
      priceLayout: p.priceLayout,
      showSku: p.showSku,
      showVendor: p.showVendor,
      showVariantPicker: p.showVariantPicker,
      variantPickerStyle: p.variantPickerStyle,
      showQuantity: p.showQuantity,
      showAddToCart: p.showAddToCart,
      addToCartLabel: p.addToCartLabel,
      showDescription: p.showDescription,
      descriptionPosition: p.descriptionPosition,
      layout: p.layout,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
