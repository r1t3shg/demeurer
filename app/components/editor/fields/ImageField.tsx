import { useState } from "react";

import type { ImageField as ImageFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

/**
 * Image input — paste a Shopify CDN URL.
 *
 * Why no in-app picker: modern App Bridge `shopify.resourcePicker` only
 * supports `type: "product" | "collection" | "variant"`. Calling it
 * with `type: "file"` triggers a postMessage flood between the embedded
 * iframe and the admin host that freezes the tab. Shopify's documented
 * pattern for files is to open Files admin, upload/pick, copy the CDN
 * URL, paste it back.
 *
 * Architectural commitment: every image must live on `cdn.shopify.com`.
 * The compiled Liquid output references these URLs directly, so a
 * non-CDN URL would break post-uninstall rendering.
 */
export function ImageField({
  field,
  value,
  onChange,
}: FieldRendererProps<ImageFieldDef>) {
  const current = typeof value === "string" ? value : "";
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>(current);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(null);
      onChange("");
      return;
    }
    if (!isShopifyCdnUrl(trimmed)) {
      setError(
        "URL must be on cdn.shopify.com. Upload to Files first, then paste the URL.",
      );
      return;
    }
    setError(null);
    onChange(trimmed);
  };

  const remove = () => {
    setError(null);
    setDraft("");
    onChange("");
  };

  const openFilesAdmin = () => {
    // shopify:admin/<path> is resolved by the embedded admin to the
    // merchant's own admin URL. _blank opens a new tab so the editor
    // tab stays put.
    window.open("shopify:admin/content/files", "_blank", "noopener");
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
            <s-button tone="critical" onClick={remove}>
              Remove
            </s-button>
          </div>
        </div>
      ) : null}

      <div className="demeurer-field-image-url">
        <s-text-field
          label="Image URL"
          labelAccessibilityVisibility="exclusive"
          placeholder="https://cdn.shopify.com/..."
          value={draft}
          onChange={(event) => {
            const target = event.target as unknown as { value?: string };
            setDraft(target.value ?? "");
          }}
          onBlur={() => commit(draft)}
        />
        <div className="demeurer-field-image-actions">
          <s-button onClick={openFilesAdmin}>
            Open Files admin
          </s-button>
          {draft && draft !== current ? (
            <s-button variant="primary" onClick={() => commit(draft)}>
              Use URL
            </s-button>
          ) : null}
        </div>
        <div className="demeurer-field-image-hint">
          Upload your image in Shopify Admin → Content → Files, copy the
          file URL, and paste it here.
        </div>
      </div>

      {error ? (
        <div className="demeurer-field-image-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function isShopifyCdnUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return (
      u.hostname === "cdn.shopify.com" || u.hostname.endsWith(".cdn.shopify.com")
    );
  } catch {
    return false;
  }
}
