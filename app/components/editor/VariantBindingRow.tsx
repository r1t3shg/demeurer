/**
 * Per-variant content binding control for the Properties panel.
 *
 * Renders only when:
 *   - the page's `type === "product"`, AND
 *   - the bound section's definition is `productAware`, AND
 *   - a product is loaded (useProduct() !== null).
 *
 * Two states:
 *   - "All variants" (default) — block renders on every variant.
 *   - "Specific variants" — checklist of variants; checked = render.
 *
 * Mutates via `setVariantBinding` on the editor store. History-tracked.
 */

import type { Block, VariantBinding } from "../../lib/editor/types";
import { useEditorStore } from "../../lib/editor/store";
import { useProduct } from "./ProductContext";

export interface VariantBindingRowProps {
  block: Block;
}

export function VariantBindingRow({ block }: VariantBindingRowProps) {
  const product = useProduct();
  const setVariantBinding = useEditorStore((s) => s.setVariantBinding);

  if (!product || product.variants.length === 0) return null;

  const binding: VariantBinding =
    block.variantBinding ?? { mode: "all" };
  const isSpecific = binding.mode === "specific";
  const selected = new Set(binding.variantIds ?? []);

  const handleModeChange = (mode: "all" | "specific") => {
    if (mode === "all") {
      setVariantBinding(block.id, null);
      return;
    }
    // Switching to "specific" — pre-select every variant so the
    // merchant unchecks the ones they don't want.
    setVariantBinding(block.id, {
      mode: "specific",
      variantIds: product.variants.map((v) => v.id),
    });
  };

  const toggleVariant = (variantId: string) => {
    const next = new Set(selected);
    if (next.has(variantId)) {
      next.delete(variantId);
    } else {
      next.add(variantId);
    }
    setVariantBinding(block.id, {
      mode: "specific",
      variantIds: Array.from(next),
    });
  };

  return (
    <details className="demeurer-variant-binding" open={isSpecific}>
      <summary className="demeurer-variant-binding__summary">
        Variant visibility
        {isSpecific ? (
          <span className="demeurer-variant-binding__count">
            {selected.size} of {product.variants.length}
          </span>
        ) : null}
      </summary>
      <div className="demeurer-variant-binding__body">
        <label className="demeurer-variant-binding__radio">
          <input
            type="radio"
            name={`variant-binding-${block.id}`}
            checked={!isSpecific}
            onChange={() => handleModeChange("all")}
          />
          <span>All variants</span>
        </label>
        <label className="demeurer-variant-binding__radio">
          <input
            type="radio"
            name={`variant-binding-${block.id}`}
            checked={isSpecific}
            onChange={() => handleModeChange("specific")}
          />
          <span>Specific variants</span>
        </label>

        {isSpecific ? (
          <ul className="demeurer-variant-binding__list">
            {product.variants.map((v) => {
              const title = variantLabel(v);
              const checked = selected.has(v.id);
              return (
                <li key={v.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleVariant(v.id)}
                    />
                    <span>{title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function variantLabel(variant: {
  title: string;
  selectedOptions: Array<{ name: string; value: string }>;
}): string {
  if (variant.selectedOptions.length > 0) {
    return variant.selectedOptions.map((o) => o.value).join(" / ");
  }
  return variant.title || "Default";
}
