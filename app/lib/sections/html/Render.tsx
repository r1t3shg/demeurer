/**
 * Custom HTML — canvas preview.
 *
 * Renders the HTML directly via dangerouslySetInnerHTML. NO
 * sanitization — this is the explicit escape hatch. The properties
 * panel surfaces a warning banner so merchants understand the trust
 * contract before they paste anything in.
 *
 * Wrapped in a contained div so a runaway `<style>` from the pasted
 * HTML can't easily bleed into the rest of the editor (best-effort
 * containment — `<style>` without scoping is still a foot-gun).
 */

import type { SectionRenderProps } from "../types";
import { coerceHtmlProps } from "./schema";

export function HtmlRender({ props }: SectionRenderProps) {
  const p = coerceHtmlProps(props);

  const containerStyle: React.CSSProperties = {
    paddingTop: p.padding.top,
    paddingBottom: p.padding.bottom,
    paddingInlineStart: p.padding.left,
    paddingInlineEnd: p.padding.right,
  };

  if (!p.html) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            border: "1px dashed rgba(0,0,0,0.2)",
            padding: 24,
            borderRadius: 6,
            textAlign: "center",
            color: "rgba(0,0,0,0.55)",
            fontSize: 14,
          }}
        >
          Paste any HTML in the inspector to preview it here.
        </div>
      </div>
    );
  }

  return (
    <div
      className="demeurer-html-section"
      style={containerStyle}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: p.html }}
    />
  );
}
