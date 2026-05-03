/**
 * Feature list — schema, defaults, metadata.
 *
 * Curated icon set: 10 lucide icons that cover almost every "value prop"
 * a small-to-mid Shopify merchant will reach for. We intentionally stop
 * at 10 — every extra option is a decision the merchant has to make on
 * a screen they only visit once per page.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceEnum,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const FEATURE_LIST_TYPE = "feature-list";

export const FEATURE_ICONS = [
  "Sparkles",
  "Zap",
  "Shield",
  "Heart",
  "Star",
  "Award",
  "Rocket",
  "Globe",
  "Check",
  "ThumbsUp",
] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];

export type Layout = "grid-3" | "grid-2" | "grid-4" | "list";
const LAYOUTS: Layout[] = ["grid-3", "grid-2", "grid-4", "list"];

export type Alignment = "left" | "center";
const ALIGNMENTS: Alignment[] = ["left", "center"];

const ICON_OPTIONS = FEATURE_ICONS.map((v) => ({ value: v, label: v }));

export const featureListSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 80 },
    { kind: "richtext", key: "subheading", label: "Subheading" },
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "grid-3", label: "3-column grid" },
        { value: "grid-2", label: "2-column grid" },
        { value: "grid-4", label: "4-column grid" },
        { value: "list", label: "Vertical list" },
      ],
      default: "grid-3",
    },
    {
      kind: "select",
      key: "alignment",
      label: "Text alignment",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
      default: "left",
    },
    {
      kind: "list",
      key: "features",
      label: "Features",
      maxItems: 12,
      itemSchema: [
        {
          kind: "select",
          key: "icon",
          label: "Icon",
          options: ICON_OPTIONS,
          default: "Sparkles",
        },
        { kind: "text", key: "title", label: "Title", max: 60 },
        { kind: "richtext", key: "description", label: "Description" },
      ],
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface Feature {
  icon: FeatureIcon;
  title: string;
  description: string;
}

export interface FeatureListProps {
  heading: string;
  subheading: string;
  layout: Layout;
  alignment: Alignment;
  features: Feature[];
  padding: SpacingValue;
}

export const featureListDefaults: FeatureListProps = {
  heading: "Why choose us",
  subheading: "",
  layout: "grid-3",
  alignment: "left",
  features: [
    {
      icon: "Zap",
      title: "Fast shipping",
      description:
        "<p>Orders placed before 2pm ship the same day from our warehouse.</p>",
    },
    {
      icon: "Shield",
      title: "30-day returns",
      description:
        "<p>Not the right fit? Send it back within 30 days for a full refund.</p>",
    },
    {
      icon: "Heart",
      title: "Made with care",
      description:
        "<p>Every product is sourced from makers we've worked with for years.</p>",
    },
  ],
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

function coerceFeature(item: Record<string, unknown>): Feature {
  return {
    icon: coerceEnum<FeatureIcon>(
      item.icon,
      FEATURE_ICONS,
      featureListDefaults.features[0].icon,
    ),
    title: coerceString(item.title, "Untitled feature"),
    description: coerceString(item.description, ""),
  };
}

export function coerceFeatureListProps(
  input: Record<string, unknown>,
): FeatureListProps {
  return {
    heading: coerceString(input.heading, featureListDefaults.heading),
    subheading: coerceString(input.subheading, featureListDefaults.subheading),
    layout: coerceEnum<Layout>(input.layout, LAYOUTS, featureListDefaults.layout),
    alignment: coerceEnum<Alignment>(
      input.alignment,
      ALIGNMENTS,
      featureListDefaults.alignment,
    ),
    features: coerceList<Feature>(
      input.features,
      coerceFeature,
      12,
      featureListDefaults.features,
    ),
    padding: coerceSpacing(input.padding, featureListDefaults.padding),
  };
}
