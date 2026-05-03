/**
 * Form — canvas preview.
 *
 * Renders a real-looking form. Submitting it doesn't POST anywhere —
 * the canvas is read-only — but the success-message preview swaps in
 * so the merchant can see how that copy reads.
 *
 * Field labels are bound to inputs via `htmlFor`/`id` for screen
 * reader correctness, both in the canvas and the published Liquid.
 */

import { useId, useState } from "react";
import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import {
  coerceFormProps,
  fieldHtmlName,
  splitOptions,
  type FormFieldSpec,
} from "./schema";

export function FormRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceFormProps(props);
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();

  const containerStyle: React.CSSProperties = {
    paddingTop: p.padding.top,
    paddingBottom: p.padding.bottom,
    paddingInlineStart: p.padding.left,
    paddingInlineEnd: p.padding.right,
    fontFamily: themeTokens.typography.bodyFont,
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 540,
    marginInline: "auto",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.75 * themeTokens.typography.scale}rem`,
    margin: 0,
  };

  return (
    <section style={containerStyle}>
      <div style={innerStyle}>
        {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
        {p.subheading ? (
          <div
            style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.5 }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.subheading) }}
          />
        ) : null}

        {submitted ? (
          <div
            style={{
              marginTop: themeTokens.spacing.unit * 3,
              padding: themeTokens.spacing.unit * 2,
              backgroundColor: "rgba(0, 128, 0, 0.08)",
              border: "1px solid rgba(0, 128, 0, 0.2)",
              borderRadius: 6,
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: sanitizeRichText(p.successMessage),
            }}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            style={{
              marginTop: themeTokens.spacing.unit * 3,
              display: "flex",
              flexDirection: "column",
              gap: themeTokens.spacing.unit * 2,
            }}
          >
            {p.fields.map((field, i) => (
              <FieldInput
                key={i}
                field={field}
                idPrefix={`${formId}-${i}`}
                themeTokens={themeTokens}
              />
            ))}
            <button
              type="submit"
              style={{
                padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 3}px`,
                backgroundColor: themeTokens.colors.accent,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              {p.submitLabel || "Submit"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function FieldInput({
  field,
  idPrefix,
  themeTokens,
}: {
  field: FormFieldSpec;
  idPrefix: string;
  themeTokens: SectionRenderProps["themeTokens"];
}) {
  const inputId = `${idPrefix}-${fieldHtmlName(field.name, "field")}`;
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: `${themeTokens.spacing.unit * 1.25}px ${themeTokens.spacing.unit * 1.5}px`,
    border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 4,
    fontFamily: "inherit",
    fontSize: 14,
    boxSizing: "border-box",
    backgroundColor: "transparent",
    color: "inherit",
  };

  return (
    <div>
      <label htmlFor={inputId} style={labelStyle}>
        {field.label || field.name}
        {field.required ? (
          <span aria-hidden="true" style={{ color: "#c00", marginInlineStart: 4 }}>
            *
          </span>
        ) : null}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          id={inputId}
          name={field.name}
          rows={4}
          required={field.required}
          style={inputStyle}
        />
      ) : field.kind === "select" ? (
        <select
          id={inputId}
          name={field.name}
          required={field.required}
          style={inputStyle}
          defaultValue=""
        >
          <option value="" disabled>
            Choose…
          </option>
          {splitOptions(field.options).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          name={field.name}
          type={field.kind}
          required={field.required}
          style={inputStyle}
        />
      )}
    </div>
  );
}
