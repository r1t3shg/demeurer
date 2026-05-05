/**
 * Product picker — wraps Shopify App Bridge ResourcePicker.
 *
 * Used by the create-page flow when the merchant selects "Product
 * page". Calling `open()` triggers the App Bridge picker; the
 * promise resolves with the selected product (id, handle, title,
 * featuredImage). The caller fills hidden form fields and the form
 * submits.
 *
 * If App Bridge isn't available (running outside the embedded
 * admin context — e.g. local-only dev without a tunnel), the
 * `open()` Promise rejects. Caller surfaces a small banner.
 */

import { useCallback } from "react";

export interface PickedProduct {
  id: string;
  handle: string;
  title: string;
  featuredImage?: { url: string; altText: string | null } | null;
}

export function useProductPicker() {
  const open = useCallback(async (): Promise<PickedProduct | null> => {
    // Prefer the Polaris-app-home `app.shopify.com.resourcePicker` API
    // exposed on the global `shopify` object inside the embedded
    // admin. This is the modern entry point as of 2024-10.
    const sw = window as unknown as {
      shopify?: {
        resourcePicker?: (args: {
          type: "product";
          multiple?: boolean;
        }) => Promise<
          Array<{
            id: string;
            handle?: string;
            title?: string;
            images?: Array<{ originalSrc?: string; altText?: string | null }>;
          }> | undefined
        >;
      };
    };
    if (sw.shopify?.resourcePicker) {
      try {
        const selected = await sw.shopify.resourcePicker({
          type: "product",
          multiple: false,
        });
        if (!selected || selected.length === 0) return null;
        const p = selected[0];
        return {
          id: p.id,
          handle: p.handle ?? "",
          title: p.title ?? "Untitled product",
          featuredImage:
            p.images && p.images[0]?.originalSrc
              ? {
                  url: p.images[0].originalSrc,
                  altText: p.images[0].altText ?? null,
                }
              : null,
        };
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes("cancel")) {
          return null;
        }
        throw err;
      }
    }
    throw new Error(
      "Shopify App Bridge resource picker is unavailable. Open this page from the Shopify admin.",
    );
  }, []);

  return { open };
}
