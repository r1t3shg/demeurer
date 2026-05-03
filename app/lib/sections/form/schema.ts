/**
 * Form — schema, defaults, metadata.
 *
 * Architectural commitment: this section uses Shopify's NATIVE form
 * handlers (`{% form 'contact' %}`, `{% form 'customer' %}`).
 * Submissions go to the merchant's Shopify admin, not to Demeurer.
 * That's the whole point — the form keeps working after uninstall
 * because Shopify owns the submission path. Do not rewrite this to
 * POST to a Demeurer endpoint.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceBoolean,
  coerceEnum,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const FORM_TYPE = "form";

export type FormType = "contact" | "customer" | "newsletter";
const FORM_TYPES: FormType[] = ["contact", "customer", "newsletter"];

export type FieldKind = "text" | "email" | "tel" | "textarea" | "select";
const FIELD_KINDS: FieldKind[] = ["text", "email", "tel", "textarea", "select"];

export interface FormFieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: string;
}

export interface FormProps {
  heading: string;
  subheading: string;
  formType: FormType;
  fields: FormFieldSpec[];
  submitLabel: string;
  successMessage: string;
  padding: SpacingValue;
}

export const formSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading" },
    { kind: "richtext", key: "subheading", label: "Subheading" },
    {
      kind: "select",
      key: "formType",
      label: "Form type",
      options: [
        { value: "contact", label: "Contact" },
        { value: "customer", label: "Customer (account)" },
        { value: "newsletter", label: "Newsletter signup" },
      ],
      default: "contact",
      // Form submission target — different per breakpoint would mean a
      // mobile contact form and a desktop newsletter signup on the same
      // section. Semantically wrong; structural.
      responsive: false,
    },
    {
      kind: "list",
      key: "fields",
      label: "Fields",
      maxItems: 8,
      // The set of fields IS the form. Per-breakpoint variations would
      // mean different submitted payloads per device — structural, not
      // presentational.
      responsive: false,
      itemSchema: [
        { kind: "text", key: "name", label: "Field name (no spaces)", max: 40 },
        { kind: "text", key: "label", label: "Label" },
        {
          kind: "select",
          key: "kind",
          label: "Type",
          options: [
            { value: "text", label: "Text" },
            { value: "email", label: "Email" },
            { value: "tel", label: "Telephone" },
            { value: "textarea", label: "Long text" },
            { value: "select", label: "Dropdown" },
          ],
          default: "text",
        },
        { kind: "boolean", key: "required", label: "Required" },
        {
          kind: "text",
          key: "options",
          label: "Options (comma-separated, dropdown only)",
        },
      ],
    },
    { kind: "text", key: "submitLabel", label: "Submit button label" },
    { kind: "richtext", key: "successMessage", label: "Success message" },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export const formDefaults: FormProps = {
  heading: "Get in touch",
  subheading: "<p>We usually respond within a day.</p>",
  formType: "contact",
  fields: [
    { name: "name", label: "Your name", kind: "text", required: true, options: "" },
    { name: "email", label: "Email", kind: "email", required: true, options: "" },
    {
      name: "body",
      label: "Message",
      kind: "textarea",
      required: true,
      options: "",
    },
  ],
  submitLabel: "Send",
  successMessage: "<p>Thanks — we'll be in touch shortly.</p>",
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

function coerceField(item: Record<string, unknown>): FormFieldSpec {
  return {
    name: coerceString(item.name, ""),
    label: coerceString(item.label, ""),
    kind: coerceEnum<FieldKind>(item.kind, FIELD_KINDS, "text"),
    required: coerceBoolean(item.required, false),
    options: coerceString(item.options, ""),
  };
}

export function coerceFormProps(input: Record<string, unknown>): FormProps {
  return {
    heading: coerceString(input.heading, formDefaults.heading),
    subheading: coerceString(input.subheading, formDefaults.subheading),
    formType: coerceEnum<FormType>(input.formType, FORM_TYPES, formDefaults.formType),
    fields: coerceList<FormFieldSpec>(
      input.fields,
      coerceField,
      8,
      formDefaults.fields,
    ),
    submitLabel: coerceString(input.submitLabel, formDefaults.submitLabel),
    successMessage: coerceString(input.successMessage, formDefaults.successMessage),
    padding: coerceSpacing(input.padding, formDefaults.padding),
  };
}

/** Newline-safe split of dropdown options. */
export function splitOptions(s: string): string[] {
  return s
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** Sanitize a field name for HTML id/name attribute use. */
export function fieldHtmlName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}
