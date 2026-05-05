/**
 * Product details — schema, defaults, metadata.
 *
 * The reference product-aware section. Renders product image
 * gallery, price, variant picker, and add-to-cart. Configuration
 * here is purely VISUAL — product data comes from the page's
 * binding (Page.productId).
 *
 * Variant interaction on the published storefront is handled by the
 * theme's `<variant-radios>` / `<variant-selects>` custom elements
 * (Dawn, Sense, Studio, Refresh, Spotlight all implement them). We
 * emit the same markup pattern those themes already understand.
 * In the editor canvas, variant clicks don't update price/image —
 * see `Render.tsx` for the "Variant interactions activate on the
 * live page" banner.
 */

import type { SectionSchema, SpacingValue } from "../types.ts";
import {
  coerceBoolean,
  coerceEnum,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce.ts";

export const PRODUCT_DETAILS_TYPE = "product-details";

export type ImageLayout = "single" | "gallery" | "carousel";
const IMAGE_LAYOUTS: ImageLayout[] = ["single", "gallery", "carousel"];

export type ImageSize = "small" | "medium" | "large";
const IMAGE_SIZES: ImageSize[] = ["small", "medium", "large"];

export type PriceLayout = "stacked" | "inline";
const PRICE_LAYOUTS: PriceLayout[] = ["stacked", "inline"];

export type VariantPickerStyle = "dropdown" | "buttons" | "swatches";
const VARIANT_PICKER_STYLES: VariantPickerStyle[] = [
  "dropdown",
  "buttons",
  "swatches",
];

export type DescriptionPosition =
  | "below-buy-button"
  | "beside-image"
  | "accordion-below";
const DESCRIPTION_POSITIONS: DescriptionPosition[] = [
  "below-buy-button",
  "beside-image",
  "accordion-below",
];

export type Layout =
  | "image-left-content-right"
  | "image-right-content-left"
  | "image-top-content-bottom";
const LAYOUTS: Layout[] = [
  "image-left-content-right",
  "image-right-content-left",
  "image-top-content-bottom",
];

export const productDetailsSchema: SectionSchema = {
  fields: [
    { kind: "boolean", key: "showImage", label: "Show product image" },
    {
      kind: "select",
      key: "imageLayout",
      label: "Image layout",
      options: [
        { value: "single", label: "Single" },
        { value: "gallery", label: "Gallery" },
        { value: "carousel", label: "Carousel" },
      ],
      default: "gallery",
    },
    {
      kind: "select",
      key: "imageSize",
      label: "Image size",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      default: "large",
    },
    { kind: "boolean", key: "showPrice", label: "Show price" },
    {
      kind: "select",
      key: "priceLayout",
      label: "Price layout",
      options: [
        { value: "stacked", label: "Stacked" },
        { value: "inline", label: "Inline" },
      ],
      default: "stacked",
    },
    { kind: "boolean", key: "showSku", label: "Show SKU" },
    { kind: "boolean", key: "showVendor", label: "Show vendor" },
    { kind: "boolean", key: "showVariantPicker", label: "Show variant picker" },
    {
      kind: "select",
      key: "variantPickerStyle",
      label: "Variant picker style",
      options: [
        { value: "dropdown", label: "Dropdown" },
        { value: "buttons", label: "Buttons" },
        { value: "swatches", label: "Swatches" },
      ],
      default: "buttons",
    },
    { kind: "boolean", key: "showQuantity", label: "Show quantity" },
    { kind: "boolean", key: "showAddToCart", label: "Show add-to-cart button" },
    { kind: "text", key: "addToCartLabel", label: "Add-to-cart label" },
    { kind: "boolean", key: "showDescription", label: "Show description" },
    {
      kind: "select",
      key: "descriptionPosition",
      label: "Description position",
      options: [
        { value: "below-buy-button", label: "Below buy button" },
        { value: "beside-image", label: "Beside image" },
        { value: "accordion-below", label: "Accordion below" },
      ],
      default: "below-buy-button",
    },
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "image-left-content-right", label: "Image left, content right" },
        { value: "image-right-content-left", label: "Image right, content left" },
        { value: "image-top-content-bottom", label: "Image top, content bottom" },
      ],
      default: "image-left-content-right",
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface ProductDetailsProps {
  showImage: boolean;
  imageLayout: ImageLayout;
  imageSize: ImageSize;
  showPrice: boolean;
  priceLayout: PriceLayout;
  showSku: boolean;
  showVendor: boolean;
  showVariantPicker: boolean;
  variantPickerStyle: VariantPickerStyle;
  showQuantity: boolean;
  showAddToCart: boolean;
  addToCartLabel: string;
  showDescription: boolean;
  descriptionPosition: DescriptionPosition;
  layout: Layout;
  padding: SpacingValue;
}

export const productDetailsDefaults: ProductDetailsProps = {
  showImage: true,
  imageLayout: "gallery",
  imageSize: "large",
  showPrice: true,
  priceLayout: "stacked",
  showSku: false,
  showVendor: false,
  showVariantPicker: true,
  variantPickerStyle: "buttons",
  showQuantity: true,
  showAddToCart: true,
  addToCartLabel: "Add to cart",
  showDescription: true,
  descriptionPosition: "below-buy-button",
  layout: "image-left-content-right",
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

export function coerceProductDetailsProps(
  input: Record<string, unknown>,
): ProductDetailsProps {
  return {
    showImage: coerceBoolean(input.showImage, productDetailsDefaults.showImage),
    imageLayout: coerceEnum<ImageLayout>(
      input.imageLayout,
      IMAGE_LAYOUTS,
      productDetailsDefaults.imageLayout,
    ),
    imageSize: coerceEnum<ImageSize>(
      input.imageSize,
      IMAGE_SIZES,
      productDetailsDefaults.imageSize,
    ),
    showPrice: coerceBoolean(input.showPrice, productDetailsDefaults.showPrice),
    priceLayout: coerceEnum<PriceLayout>(
      input.priceLayout,
      PRICE_LAYOUTS,
      productDetailsDefaults.priceLayout,
    ),
    showSku: coerceBoolean(input.showSku, productDetailsDefaults.showSku),
    showVendor: coerceBoolean(input.showVendor, productDetailsDefaults.showVendor),
    showVariantPicker: coerceBoolean(
      input.showVariantPicker,
      productDetailsDefaults.showVariantPicker,
    ),
    variantPickerStyle: coerceEnum<VariantPickerStyle>(
      input.variantPickerStyle,
      VARIANT_PICKER_STYLES,
      productDetailsDefaults.variantPickerStyle,
    ),
    showQuantity: coerceBoolean(
      input.showQuantity,
      productDetailsDefaults.showQuantity,
    ),
    showAddToCart: coerceBoolean(
      input.showAddToCart,
      productDetailsDefaults.showAddToCart,
    ),
    addToCartLabel: coerceString(
      input.addToCartLabel,
      productDetailsDefaults.addToCartLabel,
    ),
    showDescription: coerceBoolean(
      input.showDescription,
      productDetailsDefaults.showDescription,
    ),
    descriptionPosition: coerceEnum<DescriptionPosition>(
      input.descriptionPosition,
      DESCRIPTION_POSITIONS,
      productDetailsDefaults.descriptionPosition,
    ),
    layout: coerceEnum<Layout>(
      input.layout,
      LAYOUTS,
      productDetailsDefaults.layout,
    ),
    padding: coerceSpacing(input.padding, productDetailsDefaults.padding),
  };
}
