/**
 * Pricing — schema, defaults, metadata.
 *
 * Up to five tiers, each with its own features list. Prices are stored
 * as free-form strings ("$19", "Free", "Contact us") because the
 * merchant's pricing model is none of our business — we don't compute
 * anything off the value, just render it.
 *
 * The billing toggle is the only place in the entire MVP where we ship
 * inline JS in the published Liquid output (commitment #2 carve-out
 * called out explicitly in the spec). It's ~15 lines, dependency-free,
 * scoped to the section, and only emitted when the toggle is enabled.
 */

import type { SectionSchema, SpacingValue } from "../types.ts";
import {
  coerceBoolean,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce.ts";

export const PRICING_TYPE = "pricing";

export interface PricingFeature {
  text: string;
}

export interface PricingTier {
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  features: PricingFeature[];
  ctaLabel: string;
  ctaUrl: string;
  highlighted: boolean;
  badge: string;
}

export interface PricingProps {
  heading: string;
  subheading: string;
  billingToggle: boolean;
  tiers: PricingTier[];
  padding: SpacingValue;
}

export const pricingSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    { kind: "richtext", key: "subheading", label: "Subheading" },
    {
      kind: "boolean",
      key: "billingToggle",
      label: "Show monthly/yearly toggle",
    },
    {
      kind: "list",
      key: "tiers",
      label: "Tiers",
      maxItems: 5,
      itemSchema: [
        { kind: "text", key: "name", label: "Tier name", max: 60 },
        { kind: "text", key: "description", label: "Short description", max: 140 },
        { kind: "text", key: "priceMonthly", label: "Price (monthly)" },
        { kind: "text", key: "priceYearly", label: "Price (yearly)" },
        {
          kind: "list",
          key: "features",
          label: "Features",
          maxItems: 12,
          itemSchema: [{ kind: "text", key: "text", label: "Feature" }],
        },
        { kind: "text", key: "ctaLabel", label: "CTA label" },
        { kind: "url", key: "ctaUrl", label: "CTA link" },
        { kind: "boolean", key: "highlighted", label: "Highlighted" },
        { kind: "text", key: "badge", label: "Badge (e.g. Most popular)" },
      ],
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export const pricingDefaults: PricingProps = {
  heading: "Simple pricing",
  subheading: "<p>Pick the plan that fits — change anytime.</p>",
  billingToggle: false,
  tiers: [
    {
      name: "Free",
      description: "Try the basics, forever.",
      priceMonthly: "$0",
      priceYearly: "$0",
      features: [
        { text: "1 page" },
        { text: "Community support" },
      ],
      ctaLabel: "Get started",
      ctaUrl: "/account/register",
      highlighted: false,
      badge: "",
    },
    {
      name: "Starter",
      description: "Everything most stores need.",
      priceMonthly: "$19",
      priceYearly: "$190",
      features: [
        { text: "Unlimited pages" },
        { text: "Email support" },
        { text: "Basic analytics" },
      ],
      ctaLabel: "Start free trial",
      ctaUrl: "/pages/checkout",
      highlighted: true,
      badge: "Most popular",
    },
    {
      name: "Pro",
      description: "Scale with confidence.",
      priceMonthly: "$49",
      priceYearly: "$490",
      features: [
        { text: "Everything in Starter" },
        { text: "Priority support" },
        { text: "Advanced analytics" },
        { text: "Custom domain" },
      ],
      ctaLabel: "Talk to sales",
      ctaUrl: "/pages/contact",
      highlighted: false,
      badge: "",
    },
  ],
  padding: { top: 80, right: 24, bottom: 80, left: 24 },
};

function coerceFeature(item: Record<string, unknown>): PricingFeature {
  return { text: coerceString(item.text, "") };
}

function coerceTier(item: Record<string, unknown>): PricingTier {
  return {
    name: coerceString(item.name, ""),
    description: coerceString(item.description, ""),
    priceMonthly: coerceString(item.priceMonthly, ""),
    priceYearly: coerceString(item.priceYearly, ""),
    features: coerceList<PricingFeature>(item.features, coerceFeature, 12, []),
    ctaLabel: coerceString(item.ctaLabel, ""),
    ctaUrl: coerceString(item.ctaUrl, ""),
    highlighted: coerceBoolean(item.highlighted, false),
    badge: coerceString(item.badge, ""),
  };
}

export function coercePricingProps(
  input: Record<string, unknown>,
): PricingProps {
  return {
    heading: coerceString(input.heading, pricingDefaults.heading),
    subheading: coerceString(input.subheading, pricingDefaults.subheading),
    billingToggle: coerceBoolean(input.billingToggle, pricingDefaults.billingToggle),
    tiers: coerceList<PricingTier>(input.tiers, coerceTier, 5, pricingDefaults.tiers),
    padding: coerceSpacing(input.padding, pricingDefaults.padding),
  };
}
