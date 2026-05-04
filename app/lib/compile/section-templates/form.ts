/**
 * Form — shared section template + per-block adapters.
 *
 * Uses Shopify's NATIVE form handlers (`{% form 'contact' %}` etc.).
 * Submissions go to the merchant's Shopify admin, never to Demeurer.
 * Survives uninstall — commitment #1.
 */

import {
  coerceFormProps,
  fieldHtmlName,
  formSchema,
  FORM_TYPE,
  splitOptions,
} from "../../sections/form/schema.ts";
import {
  buildSharedSectionFile,
  decomposeSpacing,
  listItemsToBlocks,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

void splitOptions;
void fieldHtmlName;

const BODY = `
{%- liquid
  assign form_target = 'contact'
  case section.settings.formType
    when 'customer'
      assign form_target = 'customer'
    when 'newsletter'
      assign form_target = 'customer'
  endcase
-%}

<section class="{{ scope }} demeurer-section demeurer-form">
  <div class="demeurer-form__inner" style="max-width: 600px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-form__heading" style="margin: 0 0 12px;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-form__subheading" style="margin: 0 0 24px; opacity: 0.75;">{{ section.settings.subheading }}</div>
    {%- endif -%}

    {%- form form_target -%}
      {%- if form.posted_successfully? -%}
        <div class="demeurer-form__success" style="padding: 16px; background: #ecfdf5; color: #065f46; border-radius: 6px;">{{ section.settings.successMessage }}</div>
      {%- else -%}
        {%- if form.errors -%}
          <div class="demeurer-form__errors" style="padding: 16px; background: #fef2f2; color: #991b1b; border-radius: 6px; margin-bottom: 16px;">{{ form.errors | default_errors }}</div>
        {%- endif -%}
        <div class="demeurer-form__fields" style="display: flex; flex-direction: column; gap: 16px;">
          {%- for block in section.blocks -%}
            {%- assign field_name = block.settings.name | default: 'field_' | append: forloop.index -%}
            {%- assign field_label = block.settings.label | default: field_name -%}
            <label class="demeurer-form__field" {{ block.shopify_attributes }} style="display: flex; flex-direction: column; gap: 6px;">
              <span class="demeurer-form__label" style="font-weight: 600; font-size: 0.9em;">{{ field_label | escape }}{% if block.settings.required %} <span aria-hidden="true">*</span>{% endif %}</span>
              {%- if block.settings.kind == 'textarea' -%}
                <textarea name="contact[{{ field_name }}]" rows="4" {% if block.settings.required %}required{% endif %} style="padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font: inherit;"></textarea>
              {%- elsif block.settings.kind == 'select' -%}
                <select name="contact[{{ field_name }}]" {% if block.settings.required %}required{% endif %} style="padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font: inherit;">
                  {%- assign opts = block.settings.options | split: ',' -%}
                  {%- for o in opts -%}
                    {%- assign trimmed = o | strip -%}
                    {%- if trimmed != blank -%}
                      <option value="{{ trimmed }}">{{ trimmed }}</option>
                    {%- endif -%}
                  {%- endfor -%}
                </select>
              {%- else -%}
                <input type="{{ block.settings.kind | default: 'text' }}" name="contact[{{ field_name }}]" {% if block.settings.required %}required{% endif %} style="padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 4px; font: inherit;" />
              {%- endif -%}
            </label>
          {%- endfor -%}
        </div>
        <button type="submit" class="demeurer-form__submit" style="margin-top: 24px; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border: 0; border-radius: 4px; font-weight: 600; cursor: pointer;">{{ section.settings.submitLabel | default: 'Submit' | escape }}</button>
      {%- endif -%}
    {%- endform -%}
  </div>
</section>
`;

export const formTemplate: SectionTemplate = {
  type: FORM_TYPE,
  schema: formSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: FORM_TYPE,
      name: "Demeurer Form",
      body: BODY,
      schema: formSchema,
      presets: [{ name: "Demeurer Form" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceFormProps(mobileProps);
    return {
      heading: p.heading,
      subheading: p.subheading,
      formType: p.formType,
      submitLabel: p.submitLabel,
      successMessage: p.successMessage,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
  toBlocks(mobileProps) {
    const p = coerceFormProps(mobileProps);
    return listItemsToBlocks("fields", p.fields, (item) => ({
      name: item.name,
      label: item.label,
      kind: item.kind,
      required: item.required,
      options: item.options,
    }));
  },
};
