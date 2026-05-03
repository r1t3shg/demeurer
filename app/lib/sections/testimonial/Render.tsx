/**
 * Testimonial — canvas preview.
 *
 * Carousel layout shows the first slide statically (interactive carousel
 * is post-MVP). Grid uses 2 columns on wide viewports, 1 on narrow.
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { coerceTestimonialProps, describeRating, type Testimonial } from "./schema";

export function TestimonialRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceTestimonialProps(props);

  const containerStyle: React.CSSProperties = {
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
    paddingTop: p.padding.top,
    paddingInlineEnd: p.padding.right,
    paddingBottom: p.padding.bottom,
    paddingInlineStart: p.padding.left,
    fontFamily: themeTokens.typography.bodyFont,
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 1200,
    marginInline: "auto",
    textAlign: "center",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.headingFont,
    fontSize: `${1.875 * themeTokens.typography.scale}rem`,
    margin: `0 0 ${themeTokens.spacing.unit * 4}px 0`,
  };

  const items =
    p.layout === "single" || p.layout === "carousel"
      ? p.testimonials.slice(0, 1)
      : p.testimonials;

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      p.layout === "single" || p.layout === "carousel"
        ? "1fr"
        : "repeat(auto-fit, minmax(280px, 1fr))",
    gap: themeTokens.spacing.unit * 3,
    maxWidth: p.layout === "single" || p.layout === "carousel" ? 720 : "100%",
    marginInline: "auto",
  };

  return (
    <section style={containerStyle}>
      <div style={innerStyle}>
        {p.heading ? <h2 style={headingStyle}>{p.heading}</h2> : null}
        <div style={gridStyle}>
          {items.map((t, i) => (
            <TestimonialCard key={i} t={t} themeTokens={themeTokens} />
          ))}
        </div>
        {p.layout === "carousel" && p.testimonials.length > 1 ? (
          <div
            style={{
              marginTop: themeTokens.spacing.unit * 2,
              fontSize: 12,
              opacity: 0.5,
            }}
          >
            Carousel preview shows the first slide. The published page
            will render all {p.testimonials.length} slides.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TestimonialCard({
  t,
  themeTokens,
}: {
  t: Testimonial;
  themeTokens: import("../types").ThemeTokens;
}) {
  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 8,
    padding: themeTokens.spacing.unit * 3,
    textAlign: "start",
  };
  const quoteStyle: React.CSSProperties = {
    fontFamily: themeTokens.typography.bodyFont,
    fontSize: `${1.125 * themeTokens.typography.scale}rem`,
    lineHeight: 1.5,
    fontStyle: "italic",
    color: themeTokens.colors.text,
  };
  const metaStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: themeTokens.spacing.unit * 1.5,
    marginTop: themeTokens.spacing.unit * 2,
  };
  const avatarStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#e5e7eb",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundImage: t.authorImage ? `url(${t.authorImage})` : undefined,
    flexShrink: 0,
  };
  const nameStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: `${0.95 * themeTokens.typography.scale}rem`,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
  };
  const ratingStyle: React.CSSProperties = {
    color: themeTokens.colors.accent,
    fontSize: 14,
    marginBottom: themeTokens.spacing.unit,
  };

  return (
    <div style={cardStyle}>
      {t.rating !== null ? (
        <div style={ratingStyle} aria-label={describeRating(t.rating)}>
          {renderStars(t.rating)}
        </div>
      ) : null}
      <div
        style={quoteStyle}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(t.quote) }}
      />
      <div style={metaStyle}>
        <div style={avatarStyle} role="img" aria-label={t.authorName} />
        <div>
          {t.authorName ? <div style={nameStyle}>{t.authorName}</div> : null}
          {t.authorTitle ? <div style={titleStyle}>{t.authorTitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

function renderStars(rating: number): string {
  // Render full stars for the integer part. Half-step shown via "half"
  // glyph sequence; this is a canvas approximation, the published Liquid
  // uses the same character set so they look identical.
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const total = 5;
  let out = "";
  for (let i = 0; i < full; i++) out += "★";
  if (hasHalf) out += "⯨";
  for (let i = full + (hasHalf ? 1 : 0); i < total; i++) out += "☆";
  return out;
}
