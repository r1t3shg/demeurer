/**
 * Product details — canvas preview.
 *
 * Renders a faithful preview using the bound product's data when
 * available. When no product is bound (landing page) or the fetch
 * failed, renders placeholders.
 *
 * The variant picker shows real variant options but does NOT update
 * price/image on click — that's theme-JS-driven and only runs on
 * the published storefront. A small banner at the top of the
 * preview makes this explicit.
 */

import type { ProductData, SectionRenderProps } from "../types.ts";
import { coerceProductDetailsProps } from "./schema.ts";

export function ProductDetailsRender({ props, product }: SectionRenderProps) {
  const p = coerceProductDetailsProps(props);

  const placeholder = !product;
  const data: ProductData = product ?? PLACEHOLDER_PRODUCT;

  const flexDirection =
    p.layout === "image-right-content-left"
      ? "row-reverse"
      : p.layout === "image-top-content-bottom"
        ? "column"
        : "row";

  const currentVariant = data.variants[0] ?? null;

  return (
    <section
      className="demeurer-product-details-preview"
      style={{
        padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: "#e0f2fe",
          borderLeft: "3px solid #0284c7",
          borderRadius: 4,
          marginBottom: 16,
          fontSize: 13,
          color: "#075985",
        }}
      >
        {placeholder
          ? "No product bound — preview shows placeholder data."
          : "Variant interactions activate on the live page."}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: flexDirection as React.CSSProperties["flexDirection"],
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        {p.showImage ? (
          <div style={{ flex: "1 1 50%", minWidth: 240 }}>
            <ImageGallery
              layout={p.imageLayout}
              images={data.images}
              featured={data.featuredImage}
              size={p.imageSize}
            />
          </div>
        ) : null}

        <div style={{ flex: "1 1 50%", minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
          {p.showVendor && data.vendor ? (
            <p style={{ margin: 0, opacity: 0.7, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.05 }}>
              {data.vendor}
            </p>
          ) : null}

          <h1 style={{ margin: 0 }}>{data.title}</h1>

          {p.showPrice && currentVariant ? (
            <div
              style={{
                display: p.priceLayout === "inline" ? "inline-flex" : "flex",
                gap: 8,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <span>{formatPrice(currentVariant.price)}</span>
              {currentVariant.compareAtPrice &&
              parseFloat(currentVariant.compareAtPrice) > parseFloat(currentVariant.price) ? (
                <s style={{ opacity: 0.6 }}>{formatPrice(currentVariant.compareAtPrice)}</s>
              ) : null}
            </div>
          ) : null}

          {p.showSku && currentVariant ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
              SKU: {currentVariant.title}
            </p>
          ) : null}

          {p.showVariantPicker && data.options.length > 0 ? (
            <VariantPicker
              style={p.variantPickerStyle}
              options={data.options}
              selected={currentVariant?.selectedOptions ?? []}
            />
          ) : null}

          {p.showQuantity ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 13 }}>Quantity</label>
              <input
                type="number"
                defaultValue={1}
                min={1}
                style={{
                  width: 64,
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                }}
                disabled
              />
            </div>
          ) : null}

          {p.showAddToCart ? (
            <button
              type="button"
              style={{
                padding: "12px 24px",
                background: "#1a73e8",
                color: "#fff",
                border: 0,
                borderRadius: 4,
                fontWeight: 600,
                cursor: "default",
              }}
              disabled
            >
              {p.addToCartLabel || "Add to cart"}
            </button>
          ) : null}

          {p.showDescription ? (
            <div style={{ marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
              {placeholder
                ? "Product description will appear here on the live page."
                : "(Product description rendered on the live page from Shopify.)"}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ImageGallery({
  layout,
  images,
  featured,
  size,
}: {
  layout: "single" | "gallery" | "carousel";
  images: ProductData["images"];
  featured: ProductData["featuredImage"];
  size: "small" | "medium" | "large";
}) {
  const all = featured ? [featured, ...images.filter((i) => i.url !== featured.url)] : images;
  const main = all[0];
  const thumbs = all.slice(1, 5);
  const aspectMain = size === "small" ? 240 : size === "medium" ? 360 : 480;

  if (!main) {
    return (
      <div
        style={{
          aspectRatio: "1 / 1",
          maxHeight: aspectMain,
          background: "#e5e7eb",
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        No product image
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <img
        src={main.url}
        alt={main.altText ?? ""}
        style={{
          width: "100%",
          maxHeight: aspectMain,
          objectFit: "cover",
          borderRadius: 8,
        }}
      />
      {layout !== "single" && thumbs.length > 0 ? (
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {thumbs.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.altText ?? ""}
              style={{
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: 4,
                border: "1px solid #e5e7eb",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantPicker({
  style,
  options,
  selected,
}: {
  style: "dropdown" | "buttons" | "swatches";
  options: ProductData["options"];
  selected: Array<{ name: string; value: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {options.map((option) => {
        const sel = selected.find((s) => s.name === option.name)?.value;
        if (style === "dropdown") {
          return (
            <label key={option.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{option.name}</span>
              <select disabled defaultValue={sel} style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 4 }}>
                {option.optionValues.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return (
          <div key={option.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{option.name}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {option.optionValues.map((v) => {
                const isSelected = v.name === sel;
                return (
                  <span
                    key={v.id}
                    style={{
                      padding: style === "swatches" ? "8px 12px" : "6px 12px",
                      border: `1px solid ${isSelected ? "#1a73e8" : "#d1d5db"}`,
                      background: isSelected ? "#eff6ff" : "#fff",
                      color: isSelected ? "#1a73e8" : "#202223",
                      borderRadius: style === "swatches" ? 999 : 4,
                      fontSize: 13,
                      cursor: "default",
                    }}
                  >
                    {v.name}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatPrice(value: string): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `$${n.toFixed(2)}`;
}

const PLACEHOLDER_PRODUCT: ProductData = {
  id: "placeholder",
  handle: "sample-tee",
  title: "Sample T-Shirt",
  templateSuffix: null,
  vendor: "Sample Vendor",
  featuredImage: null,
  images: [],
  variants: [
    {
      id: "v1",
      title: "Small",
      availableForSale: true,
      price: "29.99",
      compareAtPrice: null,
      selectedOptions: [{ name: "Size", value: "Small" }],
      image: null,
    },
  ],
  options: [
    {
      id: "o1",
      name: "Size",
      optionValues: [
        { id: "v-s", name: "Small" },
        { id: "v-m", name: "Medium" },
        { id: "v-l", name: "Large" },
      ],
    },
  ],
};
