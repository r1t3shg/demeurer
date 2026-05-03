/**
 * Hero — canvas preview.
 *
 * Renders the hero with inline styles so it has no CSS-module dependency.
 * The output is intentionally close to what `toLiquid` will emit on the
 * storefront, but it does NOT need to be identical — small differences
 * (e.g. richtext is shown as raw HTML here, sanitized server-side later)
 * are fine. The merchant sees this in the canvas for "is the layout
 * roughly right?" feedback; the published page is what matters.
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceHeroProps } from "./schema";

export function HeroRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceHeroProps(props);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
    paddingTop: p.padding.top,
    paddingRight: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingLeft: p.padding.left,
    overflow: "hidden",
    textAlign: p.alignment,
    minHeight: 240,
    display: "flex",
    alignItems: "center",
    justifyContent:
      p.alignment === "center" ? "center" : "flex-start",
  };

  const bgStyle: React.CSSProperties = p.backgroundImage
    ? {
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${p.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        zIndex: 0,
      }
    : {
        position: "absolute",
        inset: 0,
        backgroundColor: "#e5e7eb",
        zIndex: 0,
      };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: p.overlayColor,
    zIndex: 1,
    pointerEvents: "none",
  };

  const contentStyle: React.CSSProperties = {
    position: "relative",
    zIndex: 2,
    maxWidth: 720,
    width: "100%",
    margin: p.alignment === "center" ? "0 auto" : undefined,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${2.5 * themeTokens.typography.scale}rem`,
    lineHeight: 1.15,
    margin: 0,
    color: p.backgroundImage ? "#fff" : themeTokens.colors.text,
  };

  const subheadingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.bodyFont,
    fontSize: `${1.125 * themeTokens.typography.scale}rem`,
    lineHeight: 1.5,
    marginTop: themeTokens.spacing.unit * 2,
    color: p.backgroundImage ? "#f5f5f5" : themeTokens.colors.text,
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-block",
    marginTop: themeTokens.spacing.unit * 3,
    padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 3}px`,
    backgroundColor: themeTokens.colors.accent,
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontFamily: themeTokens.typography.bodyFont,
    fontSize: `${1 * themeTokens.typography.scale}rem`,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };

  return (
    <section style={containerStyle}>
      <div style={bgStyle} />
      {p.overlayColor && p.backgroundImage ? <div style={overlayStyle} /> : null}
      <div style={contentStyle}>
        <h1 style={headingStyle}>{p.heading}</h1>
        {p.subheading ? (
          // Canvas-side allowlist sanitization (P/STRONG/EM/A/BR with safe
          // hrefs). The published Liquid output gets its own sanitization
          // pass in toLiquid.
          <div
            style={subheadingStyle}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.subheading) }}
          />
        ) : null}
        {p.ctaLabel ? (
          <a
            href={p.ctaUrl || "#"}
            style={buttonStyle}
            // Canvas links don't navigate — the editor is read-only for
            // navigation. Real anchors are emitted by toLiquid.
            onClick={(e) => e.preventDefault()}
          >
            {p.ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
