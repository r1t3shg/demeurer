import { useState } from "react";

import type { ImageField as ImageFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

/**
 * Image picker backed by App Bridge `resourcePicker({ type: "file" })`.
 *
 * Architectural commitment: every image must live on `cdn.shopify.com`.
 * If the merchant somehow ends up with another origin (legacy data,
 * picker quirk), we reject it loudly so a non-CDN URL never reaches the
 * compiled Liquid output — that would break post-uninstall rendering.
 */
export function ImageField({
  field,
  value,
  onChange,
}: FieldRendererProps<ImageFieldDef>) {
  const current = typeof value === "string" ? value : "";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openPicker = async () => {
    setError(null);
    const bridge = getShopifyBridge();
    if (!bridge?.resourcePicker) {
      setError("Image picker isn't available outside the Shopify admin.");
      return;
    }

    try {
      setBusy(true);
      const result = (await bridge.resourcePicker({
        type: "file",
        multiple: false,
        filter: { contentType: "IMAGE" },
      })) as PickerResult | undefined | null;

      if (!result || result.length === 0) return;

      const url = extractUrl(result[0]);
      if (!url) {
        setError("Selected file has no preview URL.");
        return;
      }
      if (!isShopifyCdnUrl(url)) {
        setError(
          "Image must be hosted on cdn.shopify.com. Upload it to Files first.",
        );
        return;
      }
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Picker failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setError(null);
    onChange("");
  };

  return (
    <div className="demeurer-field-image">
      <div className="demeurer-field-image-label">{field.label}</div>
      {current ? (
        <div className="demeurer-field-image-preview">
          <img
            src={current}
            alt=""
            className="demeurer-field-image-thumb"
          />
          <div className="demeurer-field-image-actions">
            <s-button onClick={openPicker} {...(busy ? { disabled: true } : {})}>
              Replace
            </s-button>
            <s-button tone="critical" onClick={remove}>
              Remove
            </s-button>
          </div>
        </div>
      ) : (
        <s-button onClick={openPicker} {...(busy ? { disabled: true } : {})}>
          Pick image
        </s-button>
      )}
      {error ? (
        <div className="demeurer-field-image-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

interface PickerSelection {
  image?: { originalSrc?: string; url?: string };
  preview?: { image?: { url?: string } };
  url?: string;
  originalSrc?: string;
}
type PickerResult = PickerSelection[];

interface ShopifyBridge {
  resourcePicker?: (opts: {
    type: "file";
    multiple?: boolean;
    filter?: { contentType?: string };
  }) => Promise<unknown>;
}

function getShopifyBridge(): ShopifyBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { shopify?: ShopifyBridge };
  return w.shopify ?? null;
}

function extractUrl(sel: PickerSelection): string | null {
  return (
    sel.image?.originalSrc ??
    sel.image?.url ??
    sel.preview?.image?.url ??
    sel.originalSrc ??
    sel.url ??
    null
  );
}

function isShopifyCdnUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.hostname === "cdn.shopify.com" || u.hostname.endsWith(".cdn.shopify.com");
  } catch {
    return false;
  }
}
