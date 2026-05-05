/**
 * Product details — section definition export.
 *
 * The reference product-aware section. The Canvas passes the bound
 * Shopify product as the `product` prop because `productAware: true`.
 */

import type { SectionDefinition } from "../types.ts";
import { ProductDetailsRender } from "./Render.tsx";
import {
  PRODUCT_DETAILS_TYPE,
  productDetailsDefaults,
  productDetailsSchema,
} from "./schema.ts";
import { productDetailsToLiquid } from "./toLiquid.ts";

export const productDetailsDefinition: SectionDefinition = {
  type: PRODUCT_DETAILS_TYPE,
  label: "Product details",
  description:
    "The full product page experience — image gallery, variant picker, price, and add-to-cart. Variant interactions are powered by your theme's existing JavaScript.",
  icon: "Package",
  category: "content",
  schema: productDetailsSchema,
  defaults: { ...productDetailsDefaults },
  Render: ProductDetailsRender,
  toLiquid: productDetailsToLiquid,
  productAware: true,
};
