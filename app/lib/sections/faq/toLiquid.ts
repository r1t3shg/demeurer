/**
 * FAQ — Liquid compiler.
 *
 * Each question is a section block. Pure <details>/<summary> markup —
 * no JS dependency on the live storefront. Honoring commitment #2:
 * "no runtime JavaScript injection from our servers" is trivially true
 * here because there is none to inject.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import type { LiquidOutput, ToLiquidContext } from "../types";
import { coerceFaqProps, faqDefaults } from "./schema";

export function faqToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  // TODO P1.C segment 4: emit responsive CSS from tablet/desktop overrides.
  const props = coerceFaqProps(propsByBreakpoint.mobile);

  const schema = {
    name: "FAQ",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: faqDefaults.heading },
      {
        type: "select",
        id: "alignment",
        label: "Heading alignment",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ],
        default: faqDefaults.alignment,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: faqDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: faqDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: faqDefaults.padding.left },
    ],
    blocks: [
      {
        type: "question",
        name: "Question",
        limit: 20,
        settings: [
          { type: "text", id: "question", label: "Question" },
          { type: "richtext", id: "answer", label: "Answer" },
        ],
      },
    ],
    presets: [
      {
        name: "FAQ",
        blocks: props.questions.map((q) => ({
          type: "question",
          settings: { question: q.question, answer: q.answer },
        })),
      },
    ],
  };

  const template = `
{%- liquid
  assign text_align_logical = 'center'
  if section.settings.alignment == 'left'
    assign text_align_logical = 'start'
  elsif section.settings.alignment == 'right'
    assign text_align_logical = 'end'
  endif
-%}
<div
  class="demeurer-faq"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  <div class="demeurer-faq__inner" style="max-width: 800px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-faq__heading" style="text-align: {{ text_align_logical }}; margin: 0 0 32px 0;">
        {{ section.settings.heading | escape }}
      </h2>
    {%- endif -%}

    {%- for block in section.blocks -%}
      <details
        class="demeurer-faq__item"
        style="border-bottom: 1px solid rgba(0,0,0,0.1); padding: 16px 0;"
        {%- if forloop.first %} open{% endif -%}
        {{ block.shopify_attributes }}
      >
        <summary
          class="demeurer-faq__question"
          style="
            font-weight: 600;
            cursor: pointer;
            list-style: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          "
        >
          <span>{{ block.settings.question | escape }}</span>
          <span aria-hidden="true" style="opacity: 0.5;">+</span>
        </summary>
        {%- if block.settings.answer != blank -%}
          <div class="demeurer-faq__answer" style="margin-top: 8px; line-height: 1.6;">
            {{ block.settings.answer }}
          </div>
        {%- endif -%}
      </details>
    {%- endfor -%}
  </div>
</div>
`.trim();

  return { schema, template };
}
