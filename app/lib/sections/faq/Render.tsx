/**
 * FAQ — canvas preview.
 *
 * Pure <details>/<summary>. The first item starts open so the canvas
 * shows what the answer styling will look like without forcing the
 * merchant to expand it.
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceFaqProps } from "./schema";

export function FaqRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceFaqProps(props);

  const containerStyle: React.CSSProperties = {
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
    paddingTop: p.padding.top,
    paddingRight: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingLeft: p.padding.left,
    fontFamily: themeTokens.typography.bodyFont,
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 800,
    margin: "0 auto",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.875 * themeTokens.typography.scale}rem`,
    margin: `0 0 ${themeTokens.spacing.unit * 4}px 0`,
    textAlign: p.alignment,
  };

  const detailsStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,0,0,0.1)",
    padding: `${themeTokens.spacing.unit * 2}px 0`,
  };

  const summaryStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.05 * themeTokens.typography.scale}rem`,
    fontWeight: 600,
    cursor: "pointer",
    listStyle: "none",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: themeTokens.spacing.unit,
  };

  const answerStyle: React.CSSProperties = {
    marginTop: themeTokens.spacing.unit,
    color: themeTokens.colors.text,
    opacity: 0.9,
    lineHeight: 1.6,
  };

  return (
    <section style={containerStyle}>
      <div style={innerStyle}>
        {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
        {p.questions.map((q, i) => (
          <details key={i} style={detailsStyle} open={i === 0}>
            <summary style={summaryStyle}>
              <span>{q.question}</span>
              <span aria-hidden style={{ opacity: 0.5 }}>+</span>
            </summary>
            {q.answer ? (
              <div
                style={answerStyle}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(q.answer) }}
              />
            ) : null}
          </details>
        ))}
      </div>
    </section>
  );
}
