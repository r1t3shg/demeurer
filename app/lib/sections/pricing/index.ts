import type { SectionDefinition } from "../types";
import { PricingRender } from "./Render";
import { PRICING_TYPE, pricingDefaults, pricingSchema } from "./schema";
import { pricingToLiquid } from "./toLiquid";

export const pricingDefinition: SectionDefinition = {
  type: PRICING_TYPE,
  label: "Pricing",
  icon: "Tag",
  category: "content",
  schema: pricingSchema,
  defaults: { ...pricingDefaults },
  Render: PricingRender,
  toLiquid: pricingToLiquid,
};
