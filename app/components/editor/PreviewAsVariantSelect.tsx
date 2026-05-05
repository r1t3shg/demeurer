/**
 * "Preview as variant" toolbar dropdown.
 *
 * Visible only on product pages with a loaded product. Drives
 * `previewVariantId` on the editor store. The Canvas reads that
 * state and fades blocks whose `variantBinding` excludes the
 * selected variant.
 *
 * `""` (Default variant) means previewVariantId === null —
 * no fade, all blocks visible. Switching to a specific variant
 * applies the conditional preview.
 */

import { useEditorStore } from "../../lib/editor/store";
import type { ProductData } from "../../lib/sections/types";

export interface PreviewAsVariantSelectProps {
  product: ProductData;
}

export function PreviewAsVariantSelect({ product }: PreviewAsVariantSelectProps) {
  const previewVariantId = useEditorStore((s) => s.previewVariantId);
  const setPreviewVariantId = useEditorStore((s) => s.setPreviewVariantId);

  if (product.variants.length <= 1) return null;

  return (
    <s-select
      label="Preview as"
      value={previewVariantId ?? ""}
      onChange={(event) => {
        const target = event.target as unknown as { value?: string };
        const v = target.value ?? "";
        setPreviewVariantId(v === "" ? null : v);
      }}
    >
      <s-option value="">Default variant</s-option>
      {product.variants.map((variant) => (
        <s-option key={variant.id} value={variant.id}>
          {variantLabel(variant)}
        </s-option>
      ))}
    </s-select>
  );
}

function variantLabel(variant: ProductData["variants"][number]): string {
  if (variant.selectedOptions.length > 0) {
    return variant.selectedOptions.map((o) => o.value).join(" / ");
  }
  return variant.title || "Default";
}
