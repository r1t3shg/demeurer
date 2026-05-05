import * as LucideIcons from "lucide-react";

import type { RichtextField as RichtextFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

/**
 * Plain textarea for richtext authoring. The canvas previews via
 * `sanitizeRichText` (allowlist of <p>/<strong>/<em>/<a>/<br>) so the
 * floor here can be a textarea — no WYSIWYG dependency.
 *
 * The placeholder advertises the supported tags so the merchant
 * doesn't have to discover them by experimenting.
 */
export function RichTextField({
  field,
  value,
  onChange,
}: FieldRendererProps<RichtextFieldDef>) {
  const current = typeof value === "string" ? value : "";
  return (
    <div className="demeurer-field-richtext">
      <div className="demeurer-field-richtext-label">
        <span>{field.label}</span>
        <span
          className="demeurer-field-translatable"
          title="Translatable via Shopify's free Translate & Adapt app. See docs/translate-and-adapt.md."
        >
          <LucideIcons.Globe2 size={14} aria-hidden="true" />
        </span>
      </div>
      <textarea
        className="demeurer-field-richtext-input"
        value={current}
        rows={5}
        placeholder="Supports basic HTML: <p>, <strong>, <em>, <a>"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
