/**
 * Custom HTML — shared section template + per-block adapters.
 *
 * Renders the merchant's HTML verbatim. No sanitization — the merchant
 * trust contract is documented at `HTML_WARNING_TEXT` (and surfaced in
 * the editor as an always-on yellow warning).
 *
 * `notes` is editor-only and never rendered.
 */

import { coerceHtmlProps, htmlSchema, HTML_TYPE } from "../../sections/html/schema.ts";
import { buildSharedSectionFile, decomposeSpacing, paddingPropMap } from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
<section class="{{ scope }} demeurer-section demeurer-html">
  {{ section.settings.html }}
</section>
`;

export const htmlTemplate: SectionTemplate = {
  type: HTML_TYPE,
  schema: htmlSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: HTML_TYPE,
      name: "Demeurer Custom HTML",
      body: BODY,
      schema: htmlSchema,
      presets: [{ name: "Demeurer Custom HTML" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceHtmlProps(mobileProps);
    return {
      html: p.html,
      notes: p.notes,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
