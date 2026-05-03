/**
 * CTA band — canvas preview.
 *
 * Text color flips automatically based on the band background's
 * relative luminance — keeps the canvas readable when the merchant
 * picks anything from black to a pastel.
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceCtaBandProps } from "./schema";

export function CtaBandRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceCtaBandProps(props);
  const isDark = isColorDark(p.background);
  const textColor = isDark ? "#ffffff" : "#0a0a0a";

  const containerStyle: React.CSSProperties = {
    backgroundColor: p.background,
    color: textColor,
    paddingTop: p.padding.top,
    paddingInlineEnd: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingInlineStart: p.padding.left,
    fontFamily: themeTokens.typography.bodyFont,
    textAlign: p.alignment === "left" ? "start" : "center",
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 720,
    marginInline: p.alignment === "center" ? "auto" : undefined,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${2 * themeTokens.typography.scale}rem`,
    margin: 0,
    lineHeight: 1.2,
  };

  const subheadingStyle: React.CSSProperties = {
    fontSize: `${1.05 * themeTokens.typography.scale}rem`,
    lineHeight: 1.5,
    marginTop: themeTokens.spacing.unit * 2,
    opacity: 0.85,
  };

  const ctaRowStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: themeTokens.spacing.unit * 1.5,
    marginTop: themeTokens.spacing.unit * 3,
    justifyContent: p.alignment === "center" ? "center" : "flex-start",
  };

  const primaryStyle: React.CSSProperties = {
    display: "inline-block",
    padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 3}px`,
    backgroundColor: themeTokens.colors.accent,
    color: "#fff",
    borderRadius: 4,
    fontWeight: 600,
    textDecoration: "none",
  };

  const secondaryStyle: React.CSSProperties = {
    display: "inline-block",
    padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 3}px`,
    backgroundColor: "transparent",
    color: textColor,
    border: `1px solid ${textColor}`,
    borderRadius: 4,
    fontWeight: 600,
    textDecoration: "none",
  };

  return (
    <section style={containerStyle}>
      <div style={innerStyle}>
        {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
        {p.subheading ? (
          <div
            style={subheadingStyle}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.subheading) }}
          />
        ) : null}
        {p.ctaLabel || p.secondaryCtaLabel ? (
          <div style={ctaRowStyle}>
            {p.ctaLabel ? (
              <a
                href={p.ctaUrl || "#"}
                style={primaryStyle}
                onClick={(e) => e.preventDefault()}
              >
                {p.ctaLabel}
              </a>
            ) : null}
            {p.secondaryCtaLabel ? (
              <a
                href={p.secondaryCtaUrl || "#"}
                style={secondaryStyle}
                onClick={(e) => e.preventDefault()}
              >
                {p.secondaryCtaLabel}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Cheap perceived-luminance check. Hex / hex-with-alpha only; anything
 * else is treated as dark to be safe (white text on unknown bg is
 * usually readable on common admin choices).
 */
function isColorDark(color: string): boolean {
  const hex = color.replace(/^#/, "");
  const rgb =
    hex.length === 3
      ? hex.split("").map((c) => parseInt(c + c, 16))
      : hex.length >= 6
        ? [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ]
        : null;
  if (!rgb || rgb.some((v) => Number.isNaN(v))) return true;
  // Rec. 709 luma.
  const luma = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luma < 140;
}
