import type { SelectField as SelectFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

export function SelectField({
  field,
  value,
  onChange,
}: FieldRendererProps<SelectFieldDef>) {
  const current =
    typeof value === "string" ? value : field.default ?? field.options[0]?.value ?? "";
  return (
    <s-select
      label={field.label}
      value={current}
      onChange={(e: Event) => {
        const target = e.target as HTMLSelectElement;
        onChange(target.value);
      }}
    >
      {field.options.map((opt) => (
        <s-option key={opt.value} value={opt.value}>
          {opt.label}
        </s-option>
      ))}
    </s-select>
  );
}
