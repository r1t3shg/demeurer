import type { SectionDefinition } from "../types";
import { PricingRender } from "./Render";
import { PRICING_TYPE, pricingDefaults, pricingSchema } from "./schema";
import { pricingToLiquid } from "./toLiquid";

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
};
