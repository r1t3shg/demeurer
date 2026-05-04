/**
 * Spacer — shared section template + per-block adapters.
 *
 * Empty box with configurable height; optional centered horizontal rule.
 */

import {
  coerceSpacerProps,
  dividerThicknessPx,
  spacerSchema,
  SPACER_TYPE,
} from "../../sections/spacer/schema.ts";
import { buildSharedSectionFile } from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- liquid
  case section.settings.dividerWidth
    when 'medium'
      assign thickness = ${dividerThicknessPx("medium")}
    when 'thick'
      assign thickness = ${dividerThicknessPx("thick")}
    else
      assign thickness = ${dividerThicknessPx("thin")}
  endcase
-%}

<section class="{{ scope }} demeurer-section demeurer-spacer" style="height: {{ section.settings.height }}px; display: flex; align-items: center; justify-content: center;">
  {%- if section.settings.showDivider -%}
    <hr style="width: 100%; max-width: 1024px; margin: 0; border: 0; border-top: {{ thickness }}px solid {{ section.settings.dividerColor }};" />
  {%- endif -%}
</section>
`;

export const spacerTemplate: SectionTemplate = {
  type: SPACER_TYPE,
  schema: spacerSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: SPACER_TYPE,
      name: "Demeurer Spacer",
      body: BODY,
      schema: spacerSchema,
      presets: [{ name: "Demeurer Spacer" }],
    }),
  // Spacer has no responsive CSS overrides — `height` is a plain number
  // setting and not in the propMap (theme-editor live edits are fine for it).
  propMap: [],
  toSettings(mobileProps) {
    const p = coerceSpacerProps(mobileProps);
    return {
      height: p.height,
      showDivider: p.showDivider,
      dividerColor: p.dividerColor,
      dividerWidth: p.dividerWidth,
    };
  },
};
