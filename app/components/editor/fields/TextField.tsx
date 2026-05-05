import * as LucideIcons from "lucide-react";

import type { TextField as TextFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

export function TextField({
  field,
  value,
  onChange,
}: FieldRendererProps<TextFieldDef>) {
  const current = typeof value === "string" ? value : "";
  return (
    <div className="demeurer-field-translatable-row">
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
      <span
        className="demeurer-field-translatable"
        title="Translatable via Shopify's free Translate & Adapt app. See docs/translate-and-adapt.md."
      >
        <LucideIcons.Globe2 size={14} aria-hidden="true" />
      </span>
    </div>
  );
}
