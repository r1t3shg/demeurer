/**
 * Product context for the editor canvas.
 *
 * On a product page, the editor loader fetches the bound Shopify
 * product (title, images, variants, options, vendor) and exposes it
 * here. Sections marked `productAware: true` in their definition
 * receive this data as the `product` prop on their Render component.
 *
 * `null` means: this is a landing page, OR this is a product page
 * but the fetch failed (no product, missing scope, network error).
 * The editor surfaces a banner in that case; sections render
 * placeholders.
 *
 * Mirrors the `ThemeTokensContext` pattern.
 */

import { createContext, useContext } from "react";

import type { ProductData } from "../../lib/product/fetch.server";

export const ProductContext = createContext<ProductData | null>(null);

export function useProduct(): ProductData | null {
  return useContext(ProductContext);
}
