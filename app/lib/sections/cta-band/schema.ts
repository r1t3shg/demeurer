/**
 * CTA band — schema, defaults, metadata.
 *
 * Full-width band with a heading, optional subheading, and one or two
 * CTAs. The merchant picks the band background; the secondary CTA is
 * styled as an outlined button to differentiate from the primary.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceEnum,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const CTA_BAND_TYPE = "cta-band";

export type Alignment = "left" | "center";
const ALIGNMENTS: Alignment[] = ["left", "center"];

export const ctaBandSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    { kind: "richtext", key: "subheading", label: "Subheading" },
    { kind: "text", key: "ctaLabel", label: "Primary CTA label" },
    { kind: "url", key: "ctaUrl", label: "Primary CTA link" },
    {
      kind: "text",
      key: "secondaryCtaLabel",
      label: "Secondary CTA label",
    },
    { kind: "url", key: "secondaryCtaUrl", label: "Secondary CTA link" },
    { kind: "color", key: "background", label: "Background color" },
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
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface CtaBandProps {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  background: string;
  alignment: Alignment;
  padding: SpacingValue;
}

export const ctaBandDefaults: CtaBandProps = {
  heading: "Ready to get started?",
  subheading: "<p>Free shipping on your first order. No surprises at checkout.</p>",
  ctaLabel: "Sign up",
  ctaUrl: "/account/register",
  secondaryCtaLabel: "",
  secondaryCtaUrl: "",
  background: "#1a1a1a",
  alignment: "center",
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

export function coerceCtaBandProps(
  input: Record<string, unknown>,
): CtaBandProps {
  return {
    heading: coerceString(input.heading, ctaBandDefaults.heading),
    subheading: coerceString(input.subheading, ctaBandDefaults.subheading),
    ctaLabel: coerceString(input.ctaLabel, ctaBandDefaults.ctaLabel),
    ctaUrl: coerceString(input.ctaUrl, ctaBandDefaults.ctaUrl),
    secondaryCtaLabel: coerceString(
      input.secondaryCtaLabel,
      ctaBandDefaults.secondaryCtaLabel,
    ),
    secondaryCtaUrl: coerceString(
      input.secondaryCtaUrl,
      ctaBandDefaults.secondaryCtaUrl,
    ),
    background: coerceString(input.background, ctaBandDefaults.background),
    alignment: coerceEnum<Alignment>(
      input.alignment,
      ALIGNMENTS,
      ctaBandDefaults.alignment,
    ),
    padding: coerceSpacing(input.padding, ctaBandDefaults.padding),
  };
}
