/**
 * Product fetcher for the editor preview.
 *
 * Reads a product's title / handle / images / variants / options
 * from Shopify's Admin GraphQL so the canvas can render a faithful
 * preview of a product page (title, gallery, variant picker shell,
 * price, etc.). The variant picker doesn't actually update on click
 * in the canvas — that's theme-JS-driven on the published storefront.
 *
 * Architectural note on deprecated fields:
 * Shopify's GraphQL schema marks `Product.featuredImage`,
 * `Product.images`, and `ProductVariant.image` as deprecated in
 * favor of `media`. We stay on the simpler shape for MVP. Migration
 * to `media` (with the union-type handling for video / 3D / external
 * video) is a follow-up post-P1.E.
 *
 * Caching: 60s TTL per (shop, productId). Editor responsiveness
 * matters more than freshness for preview data — the live storefront
 * always has the canonical data anyway.
 *
 * Error handling: never throws. Returns null on failure; the editor
 * surfaces a banner and renders placeholders. Pattern mirrors
 * `app/lib/theme/tokens.server.ts`.
 */

import type { AdminClient } from "../theme/client.server.ts";
import { withRateLimit } from "../theme/rate-limiter.server.ts";

export interface ProductImage {
  url: string;
  altText: string | null;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: string;
  compareAtPrice: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  image: { url: string; altText: string | null } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  optionValues: Array<{ id: string; name: string }>;
}

export interface ProductData {
  id: string;
  handle: string;
  title: string;
  templateSuffix: string | null;
  vendor: string | null;
  featuredImage: { url: string; altText: string | null } | null;
  images: ProductImage[];
  variants: ProductVariant[];
  options: ProductOption[];
}

interface CacheEntry {
  expiresAt: number;
  product: ProductData | null;
}

const TTL_MS = 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(shop: string, productId: string): string {
  return `${shop}::${productId}`;
}

const PRODUCT_QUERY = /* GraphQL */ `
  query DemeurerGetProductForBinding($id: ID!) {
    product(id: $id) {
      id
      handle
      title
      templateSuffix
      vendor
      featuredImage { url altText }
      images(first: 10) { nodes { url altText width height } }
      variants(first: 100) {
        nodes {
          id
          title
          availableForSale
          price
          compareAtPrice
          selectedOptions { name value }
          image { url altText }
        }
      }
      options { id name optionValues { id name } }
    }
  }
`;

interface QueryResponse {
  data?: {
    product?: {
      id?: string;
      handle?: string;
      title?: string;
      templateSuffix?: string | null;
      vendor?: string | null;
      featuredImage?: { url?: string; altText?: string | null } | null;
      images?: { nodes?: Array<{ url?: string; altText?: string | null; width?: number; height?: number }> };
      variants?: {
        nodes?: Array<{
          id?: string;
          title?: string;
          availableForSale?: boolean;
          price?: string;
          compareAtPrice?: string | null;
          selectedOptions?: Array<{ name?: string; value?: string }>;
          image?: { url?: string; altText?: string | null } | null;
        }>;
      };
      options?: Array<{
        id?: string;
        name?: string;
        optionValues?: Array<{ id?: string; name?: string }>;
      }>;
    } | null;
  };
}

export async function getProductForBinding(
  admin: AdminClient,
  shop: string,
  productId: string,
): Promise<ProductData | null> {
  const key = cacheKey(shop, productId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.product;
  }

  let product: ProductData | null = null;
  try {
    const { body } = await withRateLimit(shop, () =>
      admin.graphql(PRODUCT_QUERY, { variables: { id: productId } }),
    );
    const node = (body as QueryResponse).data?.product;
    if (node && typeof node.id === "string") {
      product = {
        id: node.id,
        handle: node.handle ?? "",
        title: node.title ?? "Untitled product",
        templateSuffix: node.templateSuffix ?? null,
        vendor: node.vendor ?? null,
        featuredImage:
          node.featuredImage && node.featuredImage.url
            ? {
                url: node.featuredImage.url,
                altText: node.featuredImage.altText ?? null,
              }
            : null,
        images: (node.images?.nodes ?? [])
          .filter((n): n is { url: string; altText?: string | null; width?: number; height?: number } =>
            typeof n?.url === "string",
          )
          .map((n) => ({
            url: n.url,
            altText: n.altText ?? null,
            width: n.width,
            height: n.height,
          })),
        variants: (node.variants?.nodes ?? [])
          .filter((v): v is NonNullable<typeof v> & { id: string } =>
            typeof v?.id === "string",
          )
          .map((v) => ({
            id: v.id,
            title: v.title ?? "",
            availableForSale: v.availableForSale ?? false,
            price: v.price ?? "0.00",
            compareAtPrice: v.compareAtPrice ?? null,
            selectedOptions: (v.selectedOptions ?? [])
              .filter((o): o is { name: string; value: string } =>
                typeof o?.name === "string" && typeof o?.value === "string",
              ),
            image:
              v.image && v.image.url
                ? { url: v.image.url, altText: v.image.altText ?? null }
                : null,
          })),
        options: (node.options ?? [])
          .filter((o): o is NonNullable<typeof o> & { id: string; name: string } =>
            typeof o?.id === "string" && typeof o?.name === "string",
          )
          .map((o) => ({
            id: o.id,
            name: o.name,
            optionValues: (o.optionValues ?? [])
              .filter((v): v is { id: string; name: string } =>
                typeof v?.id === "string" && typeof v?.name === "string",
              ),
          })),
      };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[demeurer] getProductForBinding failed", err);
  }

  cache.set(key, { expiresAt: Date.now() + TTL_MS, product });
  return product;
}

/** Test/dev helper. */
export function clearProductCache(shop?: string, productId?: string): void {
  if (shop && productId) {
    cache.delete(cacheKey(shop, productId));
    return;
  }
  cache.clear();
}

/* ----------------------------- productUpdate templateSuffix ----------------------------- */

const SET_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation DemeurerSetProductTemplate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id templateSuffix }
      userErrors { field message }
    }
  }
`;

export interface SetTemplateResult {
  ok: boolean;
  templateSuffix: string | null;
  errors: string[];
}

/**
 * Set (or clear) a product's templateSuffix. Pass `null` for
 * `templateSuffix` to clear and return to the default product
 * template. Used by:
 *   - apply pipeline on first publish to bind our template
 *   - unpublish route to restore the previous templateSuffix
 */
export async function setProductTemplateSuffix(
  admin: AdminClient,
  shop: string,
  productId: string,
  templateSuffix: string | null,
): Promise<SetTemplateResult> {
  try {
    const { body } = await withRateLimit(shop, () =>
      admin.graphql(SET_TEMPLATE_MUTATION, {
        variables: {
          product: {
            id: productId,
            // Shopify treats empty string as "default template".
            templateSuffix: templateSuffix ?? "",
          },
        },
      }),
    );
    const data = (body as {
      data?: {
        productUpdate?: {
          product?: { id?: string; templateSuffix?: string | null };
          userErrors?: Array<{ field?: string[] | null; message?: string }>;
        };
      };
    }).data?.productUpdate;
    const errors = (data?.userErrors ?? []).map(
      (e) => e.message ?? "Shopify userError (no message)",
    );
    if (errors.length > 0) {
      return { ok: false, templateSuffix: null, errors };
    }
    return {
      ok: true,
      templateSuffix: data?.product?.templateSuffix ?? null,
      errors: [],
    };
  } catch (err) {
    return {
      ok: false,
      templateSuffix: null,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}
