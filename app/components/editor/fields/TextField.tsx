import type { TextField as TextFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

export function TextField({
  field,
  value,
  onChange,
}: FieldRendererProps<TextFieldDef>) {
  const current = typeof value === "string" ? value : "";
  return (
    <s-text-field
      label={field.label}
      value={current}
      placeholder={field.placeholder}
      maxLength={field.max}
      onInput={(e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.value);
      }}
    />
  );
}
