/**
 * Logo wall — schema, defaults, metadata.
 *
 * A row of partner / press / customer logos. Two layouts: a static grid
 * and a CSS-only marquee (a smooth horizontal scroll, no JS, no
 * IntersectionObserver). Defaults to an empty list because the logos
 * here are merchant-specific — Lorem-style placeholders would just be
 * noise.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceEnum,
  coerceImageUrl,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const LOGO_WALL_TYPE = "logo-wall";

export type LogoSize = "small" | "medium" | "large";
const SIZES: LogoSize[] = ["small", "medium", "large"];

export type Layout = "grid" | "marquee";
const LAYOUTS: Layout[] = ["grid", "marquee"];

export const logoWallSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "grid", label: "Grid" },
        { value: "marquee", label: "Marquee" },
      ],
      default: "grid",
    },
    {
      kind: "select",
      key: "logoSize",
      label: "Logo size",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      default: "medium",
    },
    {
      kind: "list",
      key: "logos",
      label: "Logos",
      maxItems: 12,
      itemSchema: [
        { kind: "image", key: "image", label: "Logo image" },
        { kind: "text", key: "alt", label: "Alt text", max: 120 },
        { kind: "url", key: "link", label: "Link (optional)" },
      ],
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface Logo {
  image: string;
  alt: string;
  link: string;
}

export interface LogoWallProps {
  heading: string;
  layout: Layout;
  logoSize: LogoSize;
  logos: Logo[];
  padding: SpacingValue;
}

export const logoWallDefaults: LogoWallProps = {
  heading: "Trusted by",
  layout: "grid",
  logoSize: "medium",
  logos: [],
  padding: { top: 56, right: 24, bottom: 56, left: 24 },
};

function coerceLogo(item: Record<string, unknown>): Logo {
  return {
    image: coerceImageUrl(item.image),
    alt: coerceString(item.alt, ""),
    link: coerceString(item.link, ""),
  };
}

export function coerceLogoWallProps(
  input: Record<string, unknown>,
): LogoWallProps {
  return {
    heading: coerceString(input.heading, logoWallDefaults.heading),
    layout: coerceEnum<Layout>(input.layout, LAYOUTS, logoWallDefaults.layout),
    logoSize: coerceEnum<LogoSize>(
      input.logoSize,
      SIZES,
      logoWallDefaults.logoSize,
    ),
    logos: coerceList<Logo>(input.logos, coerceLogo, 12, logoWallDefaults.logos),
    padding: coerceSpacing(input.padding, logoWallDefaults.padding),
  };
}

/** Pixel height for each logo size — shared between Render and toLiquid. */
export function logoHeightPx(size: LogoSize): number {
  switch (size) {
    case "small":
      return 28;
    case "large":
      return 56;
    case "medium":
    default:
      return 40;
  }
}
