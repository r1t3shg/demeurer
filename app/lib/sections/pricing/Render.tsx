/**
 * Pricing — canvas preview.
 *
 * Tiers laid out in a responsive grid. The highlighted tier sits on a
 * raised card with a subtle accent border and an optional badge above
 * the name. The billing toggle, if enabled, switches the displayed
 * price using local React state — the published Liquid version uses
 * inline JS for the same effect.
 */

import { useState } from "react";
import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coercePricingProps, type PricingTier } from "./schema";

export function PricingRender({ props, themeTokens }: SectionRenderProps) {
  const p = coercePricingProps(props);
  const [yearly, setYearly] = useState(false);

  const containerStyle: React.CSSProperties = {
    paddingTop: p.padding.top,
    paddingInlineStart: p.padding.left,
    paddingInlineEnd: p.padding.right,
    paddingBottom: p.padding.bottom,
    fontFamily: themeTokens.typography.bodyFont,
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    maxWidth: 720,
    marginInline: "auto",
    marginBottom: themeTokens.spacing.unit * 5,
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${2 * themeTokens.typography.scale}rem`,
    margin: 0,
    lineHeight: 1.2,
  };

  const subheadingStyle: React.CSSProperties = {
    marginTop: themeTokens.spacing.unit * 1.5,
    opacity: 0.8,
    lineHeight: 1.5,
  };

  const toggleRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    margin: `${themeTokens.spacing.unit * 3}px 0`,
    fontSize: 14,
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 999,
    border: `1px solid ${active ? themeTokens.colors.accent : "rgba(0,0,0,0.15)"}`,
    backgroundColor: active ? themeTokens.colors.accent : "transparent",
    color: active ? "#fff" : themeTokens.colors.text,
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: "inherit",
  });

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
    gap: themeTokens.spacing.unit * 3,
    maxWidth: 1200,
    marginInline: "auto",
  };

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
        {p.subheading ? (
          <div
            style={subheadingStyle}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.subheading) }}
          />
        ) : null}
      </div>

      {p.billingToggle ? (
        <div style={toggleRowStyle} role="tablist" aria-label="Billing period">
          <button
            type="button"
            role="tab"
            aria-selected={!yearly}
            onClick={() => setYearly(false)}
            style={toggleBtnStyle(!yearly)}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={yearly}
            onClick={() => setYearly(true)}
            style={toggleBtnStyle(yearly)}
          >
            Yearly
          </button>
        </div>
      ) : null}

      <div style={gridStyle}>
        {p.tiers.map((tier, i) => (
          <TierCard
            key={i}
            tier={tier}
            yearly={yearly}
            themeTokens={themeTokens}
          />
        ))}
      </div>
    </section>
  );
}

function TierCard({
  tier,
  yearly,
  themeTokens,
}: {
  tier: PricingTier;
  yearly: boolean;
  themeTokens: SectionRenderProps["themeTokens"];
}) {
  const cardStyle: React.CSSProperties = {
    position: "relative",
    border: tier.highlighted
      ? `2px solid ${themeTokens.colors.accent}`
      : "1px solid rgba(0,0,0,0.12)",
    borderRadius: 12,
    padding: themeTokens.spacing.unit * 3,
    backgroundColor: tier.highlighted ? "rgba(0,0,0,0.02)" : "transparent",
    display: "flex",
    flexDirection: "column",
    gap: themeTokens.spacing.unit * 2,
    boxShadow: tier.highlighted ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: -12,
    insetInlineStart: 16,
    backgroundColor: themeTokens.colors.accent,
    color: "#fff",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  const nameStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.25 * themeTokens.typography.scale}rem`,
    margin: 0,
  };

  const priceStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${2 * themeTokens.typography.scale}rem`,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1,
  };

  const priceShown =
    yearly && tier.priceYearly ? tier.priceYearly : tier.priceMonthly;

  return (
    <article style={cardStyle}>
      {tier.badge ? <span style={badgeStyle}>{tier.badge}</span> : null}
      <h3 style={nameStyle}>{tier.name}</h3>
      {tier.description ? (
        <p style={{ margin: 0, opacity: 0.75, lineHeight: 1.5 }}>
          {tier.description}
        </p>
      ) : null}
      {priceShown ? <div style={priceStyle}>{priceShown}</div> : null}
      {tier.features.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {tier.features.map((f, j) => (
            <li
              key={j}
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <span aria-hidden="true" style={{ color: themeTokens.colors.accent }}>
                ✓
              </span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {tier.ctaLabel ? (
        <a
          href={tier.ctaUrl || "#"}
          onClick={(e) => e.preventDefault()}
          style={{
            display: "inline-block",
            textAlign: "center",
            padding: `${themeTokens.spacing.unit * 1.5}px ${themeTokens.spacing.unit * 2}px`,
            backgroundColor: tier.highlighted
              ? themeTokens.colors.accent
              : "transparent",
            color: tier.highlighted ? "#fff" : themeTokens.colors.text,
            border: tier.highlighted
              ? "none"
              : `1px solid ${themeTokens.colors.text}`,
            borderRadius: 6,
            fontWeight: 600,
            textDecoration: "none",
            marginTop: "auto",
          }}
        >
          {tier.ctaLabel}
        </a>
      ) : null}
    </article>
  );
}
