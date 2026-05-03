/**
 * Image + text — schema, defaults, metadata.
 *
 * The classic two-column "story" section. Layout collapses to a single
 * stack on narrow viewports; we leave that to CSS in Render/toLiquid.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceEnum,
  coerceImageUrl,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const IMAGE_TEXT_TYPE = "image-text";

export type ImagePosition = "left" | "right";
const POSITIONS: ImagePosition[] = ["left", "right"];

export type ImageWidth = "40" | "50" | "60";
const WIDTHS: ImageWidth[] = ["40", "50", "60"];

export const imageTextSchema: SectionSchema = {
  fields: [
    { kind: "image", key: "image", label: "Image" },
    {
      kind: "select",
      key: "imagePosition",
      label: "Image position",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
      default: "left",
    },
    {
      kind: "select",
      key: "imageWidth",
      label: "Image width",
      options: [
        { value: "40", label: "40%" },
        { value: "50", label: "50%" },
        { value: "60", label: "60%" },
      ],
      default: "50",
    },
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    { kind: "richtext", key: "body", label: "Body" },
    { kind: "text", key: "ctaLabel", label: "CTA label" },
    { kind: "url", key: "ctaUrl", label: "CTA link" },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface ImageTextProps {
  image: string;
  imagePosition: ImagePosition;
  imageWidth: ImageWidth;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  padding: SpacingValue;
}

export const imageTextDefaults: ImageTextProps = {
  image: "",
  imagePosition: "left",
  imageWidth: "50",
  heading: "Our story",
  body:
    "<p>We started in a one-bedroom apartment with a sewing machine and a vision. Today, our pieces are worn in over thirty countries — but the makers, the materials, and the obsession with detail are exactly the same.</p>",
  ctaLabel: "",
  ctaUrl: "",
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

export function coerceImageTextProps(
  input: Record<string, unknown>,
): ImageTextProps {
  return {
    image: coerceImageUrl(input.image),
    imagePosition: coerceEnum<ImagePosition>(
      input.imagePosition,
      POSITIONS,
      imageTextDefaults.imagePosition,
    ),
    imageWidth: coerceEnum<ImageWidth>(
      input.imageWidth,
      WIDTHS,
      imageTextDefaults.imageWidth,
    ),
    heading: coerceString(input.heading, imageTextDefaults.heading),
    body: coerceString(input.body, imageTextDefaults.body),
    ctaLabel: coerceString(input.ctaLabel, imageTextDefaults.ctaLabel),
    ctaUrl: coerceString(input.ctaUrl, imageTextDefaults.ctaUrl),
    padding: coerceSpacing(input.padding, imageTextDefaults.padding),
  };
}
