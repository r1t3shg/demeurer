/**
 * Hero section — schema, defaults, metadata.
 *
 * The reference section. Subsequent sections clone this folder structure:
 *   schema.ts   — field definitions + defaults
 *   Render.tsx  — canvas preview
 *   toLiquid.ts — compiles to a native Shopify section
 *   index.ts    — exports the SectionDefinition
 */

import type { SectionSchema, SpacingValue } from "../types";

export const HERO_TYPE = "hero";

export const heroSchema: SectionSchema = {
  fields: [
    {
      kind: "text",
      key: "heading",
      label: "Heading",
      max: 100,
    },
    {
      kind: "richtext",
      key: "subheading",
      label: "Subheading",
    },
    {
      kind: "image",
      key: "backgroundImage",
      label: "Background image",
    },
    {
      kind: "select",
      key: "alignment",
      label: "Text alignment",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
      default: "center",
    },
    {
      kind: "url",
      key: "ctaUrl",
      label: "CTA link",
    },
    {
      kind: "text",
      key: "ctaLabel",
      label: "CTA button text",
    },
    {
      kind: "color",
      key: "overlayColor",
      label: "Image overlay",
    },
    {
      kind: "spacing",
      key: "padding",
      label: "Section padding",
    },
  ],
};

export interface HeroProps {
  heading: string;
  subheading: string;
  backgroundImage: string;
  alignment: "left" | "center";
  ctaUrl: string;
  ctaLabel: string;
  overlayColor: string;
  padding: SpacingValue;
}

export const heroDefaults: HeroProps = {
  heading: "Welcome to your store",
  subheading: "<p>Your subheading here</p>",
  backgroundImage: "",
  alignment: "center",
  ctaUrl: "/collections/all",
  ctaLabel: "Shop now",
  overlayColor: "#00000040",
  padding: { top: 96, right: 24, bottom: 96, left: 24 },
};

/**
 * Coerce an unknown props bag (from the document JSON) into HeroProps,
 * falling back to defaults for missing or wrong-typed fields. Defensive
 * because the document is user-editable JSON and may predate schema
 * tightening.
 */
export function coerceHeroProps(input: Record<string, unknown>): HeroProps {
  const heading = typeof input.heading === "string" ? input.heading : heroDefaults.heading;
  const subheading =
    typeof input.subheading === "string" ? input.subheading : heroDefaults.subheading;
  const backgroundImage =
    typeof input.backgroundImage === "string"
      ? input.backgroundImage
      : heroDefaults.backgroundImage;
  const alignment =
    input.alignment === "left" || input.alignment === "center"
      ? input.alignment
      : heroDefaults.alignment;
  const ctaUrl = typeof input.ctaUrl === "string" ? input.ctaUrl : heroDefaults.ctaUrl;
  const ctaLabel =
    typeof input.ctaLabel === "string" ? input.ctaLabel : heroDefaults.ctaLabel;
  const overlayColor =
    typeof input.overlayColor === "string" ? input.overlayColor : heroDefaults.overlayColor;
  const padding = coerceSpacing(input.padding) ?? heroDefaults.padding;

  return {
    heading,
    subheading,
    backgroundImage,
    alignment,
    ctaUrl,
    ctaLabel,
    overlayColor,
    padding,
  };
}

function coerceSpacing(value: unknown): SpacingValue | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const num = (k: string): number | null =>
    typeof v[k] === "number" && Number.isFinite(v[k]) ? (v[k] as number) : null;
  const top = num("top");
  const right = num("right");
  const bottom = num("bottom");
  const left = num("left");
  if (top === null || right === null || bottom === null || left === null) return null;
  return { top, right, bottom, left };
}
