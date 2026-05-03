/**
 * Feature list — canvas preview.
 *
 * Icon resolution mirrors the Outline picker: dynamic lookup against
 * lucide-react's barrel export so adding an icon to the curated list
 * doesn't require a changes-elsewhere pass. Unknown icon names fall
 * back to a generic dot — never crash the canvas.
 */

import * as LucideIcons from "lucide-react";

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceFeatureListProps, type FeatureIcon } from "./schema";

const ICON_FALLBACK = "Sparkles";

export function FeatureListRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceFeatureListProps(props);

  const containerStyle: React.CSSProperties = {
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
    paddingTop: p.padding.top,
    paddingRight: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingLeft: p.padding.left,
    textAlign: p.alignment,
    fontFamily: themeTokens.typography.bodyFont,
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.875 * themeTokens.typography.scale}rem`,
    lineHeight: 1.2,
    margin: 0,
  };

  const subheadingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.bodyFont,
    fontSize: `${1 * themeTokens.typography.scale}rem`,
    lineHeight: 1.5,
    marginTop: themeTokens.spacing.unit,
    color: themeTokens.colors.text,
    opacity: 0.8,
  };

  const columns =
    p.layout === "grid-4" ? 4 : p.layout === "grid-2" ? 2 : p.layout === "list" ? 1 : 3;

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: themeTokens.spacing.unit * 4,
    marginTop: themeTokens.spacing.unit * 4,
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: p.layout === "list" ? "row" : "column",
    alignItems: p.layout === "list" ? "flex-start" : p.alignment === "center" ? "center" : "flex-start",
    gap: themeTokens.spacing.unit * 1.5,
    textAlign: p.layout === "list" ? "left" : p.alignment,
  };

  const iconStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    color: themeTokens.colors.accent,
    flexShrink: 0,
  };

  const featureTitleStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.125 * themeTokens.typography.scale}rem`,
    margin: 0,
    fontWeight: 600,
  };

  const featureDescStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.bodyFont,
    fontSize: `${0.95 * themeTokens.typography.scale}rem`,
    lineHeight: 1.5,
    color: themeTokens.colors.text,
    opacity: 0.85,
    marginTop: 4,
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
        <div style={gridStyle}>
          {p.features.map((f, i) => (
            <div key={i} style={itemStyle}>
              <FeatureIconRender name={f.icon} style={iconStyle} />
              <div style={{ flex: 1 }}>
                <h3 style={featureTitleStyle}>{f.title}</h3>
                {f.description ? (
                  <div
                    style={featureDescStyle}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(f.description),
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureIconRender({
  name,
  style,
}: {
  name: FeatureIcon;
  style: React.CSSProperties;
}) {
  const icons = LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
  >;
  const Icon = icons[name] ?? icons[ICON_FALLBACK];
  if (!Icon) return null;
  return <Icon size={32} style={style} />;
}
