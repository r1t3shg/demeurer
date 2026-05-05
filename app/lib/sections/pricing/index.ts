import type { SectionDefinition, SectionQualityIssue } from "../types.ts";
import { PricingRender } from "./Render.ts";
import {
  PRICING_TYPE,
  coercePricingProps,
  pricingDefaults,
  pricingSchema,
} from "./schema.ts";
import { pricingToLiquid } from "./toLiquid.ts";

export const pricingDefinition: SectionDefinition = {
  type: PRICING_TYPE,
  label: "Pricing",
  description:
    "Up to 5 pricing tiers with monthly/yearly toggle. Highlight one tier as recommended. The toggle is the only section that ships ~15 lines of inline JavaScript.",
  icon: "Tag",
  category: "content",
  schema: pricingSchema,
  defaults: { ...pricingDefaults },
  Render: PricingRender,
  toLiquid: pricingToLiquid,
  qualityCheck: (props) => {
    const p = coercePricingProps(props);
    const issues: SectionQualityIssue[] = [];
    if (p.tiers.length >= 2) {
      const firstName = p.tiers[0].name;
      const allSame = p.tiers.every((t) => t.name === firstName);
      if (allSame && firstName) {
        issues.push({
          severity: "warning",
          message:
            "All pricing tiers have the same name. Customize each tier's name and price before publishing.",
        });
      }
    }
    return issues;
  },
};
