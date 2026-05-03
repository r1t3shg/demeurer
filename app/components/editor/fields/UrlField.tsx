import type { UrlField as UrlFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

export function UrlField({
  field,
  value,
  onChange,
}: FieldRendererProps<UrlFieldDef>) {
  const current = typeof value === "string" ? value : "";
  return (
    <s-text-field
      label={field.label}
      value={current}
      placeholder="https://… or /collections/all"
      onInput={(e: Event) => {
        const target = e.target as HTMLInputElement;
        onChange(target.value);
      }}
    />
  );
}
