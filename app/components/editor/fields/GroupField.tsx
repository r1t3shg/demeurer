import { useState } from "react";

import type { GroupField as GroupFieldDef } from "../../../lib/sections";
import { FieldRenderer } from "./FieldRenderer";
import type { FieldRendererProps } from "./types";

/**
 * Collapsible labelled fieldset. The group's value is a Record keyed by
 * the inner field keys; mutating one key shallow-merges back into the
 * group bag — same shape rule as the top-level props bag.
 */
export function GroupField({
  field,
  value,
  onChange,
}: FieldRendererProps<GroupFieldDef>) {
  const [open, setOpen] = useState(true);
  const bag =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const handleChild = (key: string, next: unknown) => {
    onChange({ ...bag, [key]: next });
  };

  return (
    <div className="demeurer-field-group">
      <button
        type="button"
        className="demeurer-field-group-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="demeurer-field-group-caret">{open ? "▾" : "▸"}</span>
        <span className="demeurer-field-group-label">{field.label}</span>
      </button>
      {open ? (
        <div className="demeurer-field-group-body">
          {field.fields.map((child) => (
            <FieldRenderer
              key={child.key}
              field={child}
              value={bag[child.key]}
              onChange={(next) => handleChild(child.key, next)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
