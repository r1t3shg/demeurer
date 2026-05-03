import type { BooleanField as BooleanFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

export function BooleanField({
  field,
  value,
  onChange,
}: FieldRendererProps<BooleanFieldDef>) {
  const current =
    typeof value === "boolean" ? value : field.default ?? false;
  return (
    <s-checkbox
      label={field.label}
      {...(current ? { checked: true } : {})}
      onChange={(e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.checked);
      }}
    />
  );
}
