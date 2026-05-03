import type { ColorField as ColorFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

/**
 * Hex-color text input. A native <input type="color"> sits next to it
 * for picking; the text input is the source of truth (it accepts
 * #RRGGBB and #RRGGBBAA so an alpha overlay like #00000040 round-trips
 * without truncation).
 */
export function ColorField({
  field,
  value,
  onChange,
}: FieldRendererProps<ColorFieldDef>) {
  const current = typeof value === "string" ? value : "";
  // The <input type="color"> only understands #RRGGBB. Strip alpha for
  // the picker but never push the truncated value back through onChange.
  const pickerValue = current.length >= 7 ? current.slice(0, 7) : "#000000";

  return (
    <div className="demeurer-field-color">
      <s-text-field
        label={field.label}
        value={current}
        placeholder="#000000 or #00000040"
        onInput={(e: Event) => {
          const target = e.target as HTMLInputElement;
          onChange(target.value);
        }}
      />
      <input
        type="color"
        aria-label={`${field.label} color picker`}
        value={pickerValue}
        onChange={(e) => {
          // Preserve any alpha suffix the user typed in the text input.
          const alpha = current.length === 9 ? current.slice(7) : "";
          onChange(e.target.value + alpha);
        }}
      />
    </div>
  );
}
