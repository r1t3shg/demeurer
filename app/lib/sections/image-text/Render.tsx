/**
 * Image + text — canvas preview.
 *
 * Two-column flex with the image's flex-basis driven by `imageWidth`.
 * The iframe doesn't pass through media queries (yet) so we use inline
 * styles only — viewport stacking is handled in toLiquid via a small
 * CSS rule embedded in the section's style attribute trick is not
 * available, so we bake stack-on-mobile into the published CSS class
 * (which the canvas mimics by stacking on narrow widths via flexWrap).
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceImageTextProps } from "./schema";

const PLACEHOLDER_BG = "#e5e7eb";

export function ImageTextRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceImageTextProps(props);

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
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    flexDirection: p.imagePosition === "right" ? "row-reverse" : "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: themeTokens.spacing.unit * 6,
  };

  const imagePct = Number(p.imageWidth);
  const imageStyle: React.CSSProperties = {
    flex: `1 1 ${imagePct}%`,
    minWidth: 240,
    aspectRatio: "4 / 3",
    backgroundColor: PLACEHOLDER_BG,
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: 8,
    backgroundImage: p.image ? `url(${p.image})` : undefined,
  };

  const textStyle: React.CSSProperties = {
    flex: `1 1 ${100 - imagePct}%`,
    minWidth: 240,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.875 * themeTokens.typography.scale}rem`,
    lineHeight: 1.2,
    margin: 0,
  };

  const bodyStyle: React.CSSProperties = {
    fontSize: `${1 * themeTokens.typography.scale}rem`,
    lineHeight: 1.6,
    marginTop: themeTokens.spacing.unit * 2,
    color: themeTokens.colors.text,
    opacity: 0.9,
  };

  const ctaStyle: React.CSSProperties = {
    display: "inline-block",
    marginTop: themeTokens.spacing.unit * 3,
    padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 3}px`,
    backgroundColor: themeTokens.colors.accent,
    color: "#fff",
    borderRadius: 4,
    fontWeight: 600,
    textDecoration: "none",
  };

  return (
    <section style={containerStyle}>
      <div style={innerStyle}>
        <div style={imageStyle} role="img" aria-label={p.heading || "Section image"} />
        <div style={textStyle}>
          {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
          {p.body ? (
            <div
              style={bodyStyle}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.body) }}
            />
          ) : null}
          {p.ctaLabel ? (
            <a
              href={p.ctaUrl || "#"}
              style={ctaStyle}
              onClick={(e) => e.preventDefault()}
            >
              {p.ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
