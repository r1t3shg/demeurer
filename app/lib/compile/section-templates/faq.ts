/**
 * FAQ — shared section template + per-block adapters.
 *
 * Native <details>/<summary> accordion — zero JS, free keyboard support.
 */

import { coerceFaqProps, faqSchema, FAQ_TYPE } from "../../sections/faq/schema.ts";
import {
  alignmentPropMap,
  buildSharedSectionFile,
  decomposeSpacing,
  listItemsToBlocks,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
<section class="{{ scope }} demeurer-section demeurer-faq">
  <div class="demeurer-faq__inner" style="max-width: 720px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-faq__heading" style="margin: 0 0 24px;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    <div class="demeurer-faq__list" style="display: flex; flex-direction: column; gap: 12px;">
      {%- for block in section.blocks -%}
        <details class="demeurer-faq__item" {{ block.shopify_attributes }} style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
          <summary class="demeurer-faq__question" style="cursor: pointer; font-weight: 600; list-style: none;">{{ block.settings.question | escape }}</summary>
          {%- if block.settings.answer != blank -%}
            <div class="demeurer-faq__answer" style="margin-top: 12px; line-height: 1.5;">{{ block.settings.answer }}</div>
          {%- endif -%}
        </details>
      {%- endfor -%}
    </div>
  </div>
</section>
`;

export const faqTemplate: SectionTemplate = {
  type: FAQ_TYPE,
  schema: faqSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: FAQ_TYPE,
      name: "Demeurer FAQ",
      body: BODY,
      schema: faqSchema,
      presets: [{ name: "Demeurer FAQ" }],
    }),
  propMap: [paddingPropMap(), alignmentPropMap()],
  toSettings(mobileProps) {
    const p = coerceFaqProps(mobileProps);
    return {
      heading: p.heading,
      alignment: p.alignment,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
  toBlocks(mobileProps) {
    const p = coerceFaqProps(mobileProps);
    return listItemsToBlocks("questions", p.questions, (item) => ({
      question: item.question,
      answer: item.answer,
    }));
  },
};
