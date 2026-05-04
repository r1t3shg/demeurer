/**
 * Custom HTML — schema, defaults, metadata.
 *
 * The escape hatch. Merchants can paste arbitrary HTML — no
 * sanitization, no allowlist. The trade is documented in the
 * inspector's warning banner: "This section renders your HTML
 * directly. Don't paste untrusted content. Avoid <script> tags from
 * external domains for security and page speed."
 *
 * `notes` is editor-only metadata: it never appears in the rendered
 * output, just helps the merchant remember what a given block does
 * three months from now.
 */

import type { SectionSchema, SpacingValue } from "../types.ts";
import { coerceSpacing, coerceString } from "../_shared/coerce.ts";

export const HTML_TYPE = "html";

export interface HtmlProps {
  html: string;
  notes: string;
  padding: SpacingValue;
}

export const htmlSchema: SectionSchema = {
  fields: [
    // Per-breakpoint HTML would mean four parallel content trees in
    // the same section. The merchant intent for "different markup on
    // mobile" is to use Custom HTML twice with breakpoint-level
    // visibility, not to fork the markup.
    { kind: "richtext", key: "html", label: "Custom HTML", responsive: false },
    {
      kind: "text",
      key: "notes",
      label: "Notes (editor only — not rendered)",
      responsive: false,
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export const htmlDefaults: HtmlProps = {
  html: "",
  notes: "",
  padding: { top: 32, right: 24, bottom: 32, left: 24 },
};

export function coerceHtmlProps(input: Record<string, unknown>): HtmlProps {
  return {
    html: coerceString(input.html, htmlDefaults.html),
    notes: coerceString(input.notes, htmlDefaults.notes),
    padding: coerceSpacing(input.padding, htmlDefaults.padding),
  };
}

/** Used by the properties panel to surface the trust contract. */
export const HTML_WARNING_TEXT =
  "This section renders your HTML directly. Don't paste untrusted content. Avoid <script> tags from external domains for security and page speed.";
