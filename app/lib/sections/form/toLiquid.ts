/**
 * Form — Liquid compiler.
 *
 * Emits a `{% form 'contact' %}` or `{% form 'customer' %}` block.
 * Submissions are handled by Shopify, not by Demeurer — the form
 * keeps working after our app is uninstalled. Newsletter signup uses
 * `{% form 'customer', customer %}` with a hidden tags field
 * "newsletter", which is Shopify's documented pattern.
 *
 * Field labels are bound to inputs via `for=`/`id=` for screen
 * readers. The `id` includes `section.id` so multiple form sections
 * on one page don't collide.
 *
 * Inline JS: NONE. Form submission is a native browser POST.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import { liquidString } from "../_shared/coerce";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";
import { coerceFormProps, fieldHtmlName, formDefaults, splitOptions } from "./schema";

export function formToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceFormProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "Form",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: props.heading },
      { type: "richtext", id: "subheading", label: "Subheading", default: props.subheading },
      { type: "text", id: "submit_label", label: "Submit label", default: props.submitLabel },
      { type: "richtext", id: "success_message", label: "Success message", default: props.successMessage },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: formDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: formDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: formDefaults.padding.left },
    ],
    presets: [{ name: "Form" }],
  };

  // The shopify form tag — newsletter uses 'customer' with hidden tags.
  let formOpen: string;
  let hiddenFields: string;
  let successCheck: string;
  if (props.formType === "newsletter") {
    formOpen = `{% form 'customer' %}`;
    hiddenFields = `<input type="hidden" name="contact[tags]" value="newsletter">`;
    successCheck = `{% if form.posted_successfully? %}`;
  } else if (props.formType === "customer") {
    formOpen = `{% form 'create_customer' %}`;
    hiddenFields = "";
    successCheck = `{% if form.posted_successfully? %}`;
  } else {
    formOpen = `{% form 'contact' %}`;
    hiddenFields = "";
    successCheck = `{% if form.posted_successfully? %}`;
  }

  const fieldsLiquid = props.fields
    .map((f, i) => {
      const id = `demeurer-form-{{ section.id }}-${fieldHtmlName(f.name, `field${i}`)}`;
      const baseName = fieldHtmlName(f.name, `field${i}`);
      // Shopify contact form expects fields under `contact[*]` for the
      // contact form, customer form under `contact[*]` for create_customer
      // (legacy convention) — keep them all under contact[*].
      const submitName = `contact[${baseName}]`;
      const required = f.required ? " required" : "";
      const labelHtml = `<label for="${id}" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">${escapeHtml(
        f.label || f.name,
      )}${f.required ? ' <span aria-hidden="true" style="color:#c00;">*</span>' : ""}</label>`;
      const fieldStyle =
        'style="width: 100%; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px; font-family: inherit; font-size: 14px; box-sizing: border-box;"';
      let inputHtml: string;
      if (f.kind === "textarea") {
        inputHtml = `<textarea id="${id}" name="${submitName}" rows="4"${required} ${fieldStyle}></textarea>`;
      } else if (f.kind === "select") {
        const opts = splitOptions(f.options)
          .map((o) => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`)
          .join("");
        inputHtml = `<select id="${id}" name="${submitName}"${required} ${fieldStyle}><option value="" disabled selected>Choose…</option>${opts}</select>`;
      } else {
        const type = f.kind === "email" || f.kind === "tel" ? f.kind : "text";
        inputHtml = `<input id="${id}" name="${submitName}" type="${type}"${required} ${fieldStyle}>`;
      }
      return `<div style="margin-bottom: 16px;">${labelHtml}${inputHtml}</div>`;
    })
    .join("\n");

  const fallbackHeading = liquidString(props.heading);
  const fallbackSub = liquidString(props.subheading);
  const fallbackSubmit = liquidString(props.submitLabel);
  const fallbackSuccess = liquidString(props.successMessage);

  // formType + fields are non-responsive (structural). Only padding +
  // visibility flow through the responsive helpers.
  const propMap: CssPropMap[] = [
    {
      propKey: "padding",
      cssProperty: "padding",
      toCss: (v) => {
        const p = v as SpacingValue;
        return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
      },
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  const template = `
${styleBlock}
{%- comment -%}
  Form uses Shopify's native ${props.formType} handler. Submissions
  are managed in Shopify admin, not by Demeurer — this form keeps
  working after the Demeurer app is uninstalled.
{%- endcomment -%}

{%- liquid
  assign heading = section.settings.heading | default: ${fallbackHeading}
  assign subheading = section.settings.subheading | default: ${fallbackSub}
  assign submit_label = section.settings.submit_label | default: ${fallbackSubmit}
  assign success_message = section.settings.success_message | default: ${fallbackSuccess}
-%}

<div
  class="${scope} demeurer-form"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  <div style="max-width: 540px; margin-inline: auto;">
    {%- if heading != blank -%}
      <h2 style="margin: 0; line-height: 1.2;">{{ heading | escape }}</h2>
    {%- endif -%}
    {%- if subheading != blank -%}
      <div style="margin-top: 8px; opacity: 0.8; line-height: 1.5;">{{ subheading }}</div>
    {%- endif -%}

    ${formOpen}
      ${successCheck}
        <div style="margin-top: 24px; padding: 16px; background: rgba(0,128,0,0.08); border: 1px solid rgba(0,128,0,0.2); border-radius: 6px;">
          {{ success_message }}
        </div>
      {% else %}
        ${hiddenFields}
        <div style="margin-top: 24px;">
          ${fieldsLiquid}
          <button type="submit" style="padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">{{ submit_label | escape }}</button>
        </div>
      {% endif %}
    {% endform %}
  </div>
</div>
`.trim();

  return { schema, template };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
