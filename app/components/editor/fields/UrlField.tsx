import type { UrlField as UrlFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

type UrlKind = "empty" | "internal" | "external" | "invalid";

/**
 * URL/path input with a kind badge:
 *   - "internal" (green) for `/`-prefixed paths (collections, products, …)
 *   - "external" (grey) for http(s):// URLs
 *   - "invalid" (red) for anything else (mailto:, javascript:, bare text, …)
 *
 * Internal links are preferred for landing pages — they keep the
 * shopper inside the merchant's storefront.
 */
export function UrlField({
  field,
  value,
  onChange,
}: FieldRendererProps<UrlFieldDef>) {
  const current = typeof value === "string" ? value : "";
  const kind = classify(current);

  return (
    <div className="demeurer-field-url">
      <s-text-field
        label={field.label}
        value={current}
        placeholder="https://… or /collections/all"
        onInput={(e: Event) => {
          const target = e.target as HTMLInputElement;
          onChange(target.value);
        }}
      />
      {kind !== "empty" ? (
        <div
          className={`demeurer-field-url-badge demeurer-field-url-badge-${kind}`}
          role={kind === "invalid" ? "alert" : undefined}
        >
          {labelFor(kind)}
        </div>
      ) : null}
    </div>
  );
}

function classify(raw: string): UrlKind {
  const v = raw.trim();
  if (v.length === 0) return "empty";
  if (v.startsWith("/")) return "internal";
  if (/^https?:\/\//i.test(v)) {
    try {
      // eslint-disable-next-line no-new
      new URL(v);
      return "external";
    } catch {
      return "invalid";
    }
  }
  return "invalid";
}

function labelFor(kind: Exclude<UrlKind, "empty">): string {
  switch (kind) {
    case "internal":
      return "Internal link";
    case "external":
      return "External link";
    case "invalid":
      return "Invalid URL — must start with / or https://";
  }
}
