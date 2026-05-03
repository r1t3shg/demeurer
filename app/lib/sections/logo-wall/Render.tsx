/**
 * Logo wall — canvas preview.
 *
 * The marquee layout renders as a static row in the canvas; the actual
 * scrolling animation only kicks in on the published storefront, where
 * `toLiquid` emits the keyframes. Editor sees a stable layout that
 * doesn't visually distract during authoring.
 */

import type { SectionRenderProps } from "../types";
import { coerceLogoWallProps, logoHeightPx } from "./schema";

export function LogoWallRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceLogoWallProps(props);
  const h = logoHeightPx(p.logoSize);

  const containerStyle: React.CSSProperties = {
    paddingTop: p.padding.top,
    paddingRight: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingLeft: p.padding.left,
    fontFamily: themeTokens.typography.bodyFont,
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${0.85 * themeTokens.typography.scale}rem`,
    textAlign: "center",
    margin: 0,
    marginBottom: themeTokens.spacing.unit * 3,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.7,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: p.layout === "marquee" ? "nowrap" : "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: themeTokens.spacing.unit * 5,
    overflow: "hidden",
  };

  const itemStyle: React.CSSProperties = {
    flex: "0 0 auto",
    height: h,
    display: "inline-flex",
    alignItems: "center",
  };

  const imgStyle: React.CSSProperties = {
    height: h,
    width: "auto",
    maxWidth: 180,
    objectFit: "contain",
    opacity: 0.85,
  };

  const placeholderStyle: React.CSSProperties = {
    height: h,
    width: 120,
    border: "1px dashed rgba(0,0,0,0.2)",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "rgba(0,0,0,0.4)",
  };

  return (
    <section style={containerStyle}>
      {p.heading ? <div style={headingStyle}>{p.heading}</div> : null}
      {p.logos.length === 0 ? (
        <div style={{ ...rowStyle, opacity: 0.6 }}>
          <div style={placeholderStyle}>Logo</div>
          <div style={placeholderStyle}>Logo</div>
          <div style={placeholderStyle}>Logo</div>
          <div style={placeholderStyle}>Logo</div>
        </div>
      ) : (
        <div style={rowStyle}>
          {p.logos.map((logo, i) => (
            <div key={i} style={itemStyle}>
              {logo.image ? (
                <img src={logo.image} alt={logo.alt} style={imgStyle} />
              ) : (
                <div style={placeholderStyle}>{logo.alt || "Logo"}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
