import type { SpacingField as SpacingFieldDef, SpacingValue } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

const SIDES: (keyof SpacingValue)[] = ["top", "right", "bottom", "left"];

export function SpacingField({
  field,
  value,
  onChange,
}: FieldRendererProps<SpacingFieldDef>) {
  const current = coerce(value, field.default);

  const handleSide = (side: keyof SpacingValue, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange({ ...current, [side]: n });
  };

  return (
    <div className="demeurer-field-spacing">
      <div className="demeurer-field-spacing-label">{field.label}</div>
      <div className="demeurer-field-spacing-grid">
        {SIDES.map((side) => (
          <s-text-field
            key={side}
            label={side}
            value={String(current[side])}
            onInput={(e: Event) => {
              const target = e.target as HTMLInputElement;
              handleSide(side, target.value);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function coerce(value: unknown, fallback: SpacingValue | undefined): SpacingValue {
  const base: SpacingValue = fallback ?? { top: 0, right: 0, bottom: 0, left: 0 };
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    top: typeof v.top === "number" ? v.top : base.top,
    right: typeof v.right === "number" ? v.right : base.right,
    bottom: typeof v.bottom === "number" ? v.bottom : base.bottom,
    left: typeof v.left === "number" ? v.left : base.left,
  };
}
