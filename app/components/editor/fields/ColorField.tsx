import type { ColorField as ColorFieldDef } from "../../../lib/sections";
import { useThemeTokens } from "../ThemeTokensContext";
import type { FieldRendererProps } from "./types";

/**
 * Hex color editor with three controls:
 *  - swatch button (native picker, #RRGGBB only)
 *  - hex text input (source of truth, accepts #RRGGBB or #RRGGBBAA)
 *  - row of theme color swatches for one-click brand colors
 *  - "Reset to theme" link if the field has a theme-reference default
 *
 * Theme references (e.g. `theme.colors.accent`) live in the field's
 * default. We don't resolve them at storage time — clicking a swatch
 * stores the resolved hex so published Liquid renders the same color
 * even after the merchant uninstalls the app.
 */
export function ColorField({
  field,
  value,
  onChange,
}: FieldRendererProps<ColorFieldDef>) {
  const themeTokens = useThemeTokens();
  const current = typeof value === "string" ? value : "";
  const pickerValue = current.length >= 7 ? current.slice(0, 7) : "#000000";

  const swatches = Object.entries(themeTokens.colors);
  const themeRef = parseThemeRef(field.default);
  const themeRefValue = themeRef
    ? themeTokens.colors[themeRef] ?? null
    : null;

  return (
    <div className="demeurer-field-color">
      <div className="demeurer-field-color-row">
        <input
          type="color"
          aria-label={`${field.label} color picker`}
          value={pickerValue}
          onChange={(e) => {
            const alpha = current.length === 9 ? current.slice(7) : "";
            onChange(e.target.value + alpha);
          }}
          className="demeurer-field-color-swatch"
        />
        <s-text-field
          label={field.label}
          value={current}
          placeholder="#000000 or #00000040"
          onInput={(e: Event) => {
            const target = e.target as HTMLInputElement;
            onChange(target.value);
          }}
        />
      </div>
      {swatches.length > 0 ? (
        <div className="demeurer-field-color-theme">
          <span className="demeurer-field-color-theme-label">Theme:</span>
          <div className="demeurer-field-color-theme-swatches">
            {swatches.map(([key, hex]) => (
              <button
                key={key}
                type="button"
                title={`${key} (${hex})`}
                aria-label={`Use theme ${key} color`}
                className="demeurer-field-color-theme-swatch"
                style={{ backgroundColor: hex }}
                onClick={() => onChange(hex)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {themeRef && themeRefValue ? (
        <button
          type="button"
          className="demeurer-field-color-reset"
          onClick={() => onChange(themeRefValue)}
        >
          Reset to theme ({themeRef})
        </button>
      ) : null}
    </div>
  );
}

function parseThemeRef(input: string | undefined): string | null {
  if (!input) return null;
  const m = input.match(/^theme\.colors\.([a-zA-Z0-9_]+)$/);
  return m ? m[1] : null;
}
