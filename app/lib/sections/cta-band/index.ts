import type { SectionDefinition } from "../types";
import { CtaBandRender } from "./Render";
import { CTA_BAND_TYPE, ctaBandDefaults, ctaBandSchema } from "./schema";
import { ctaBandToLiquid } from "./toLiquid";

export const ctaBandDefinition: SectionDefinition = {
  type: CTA_BAND_TYPE,
  label: "CTA band",
  icon: "Megaphone",
  category: "content",
  schema: ctaBandSchema,
  defaults: { ...ctaBandDefaults },
  Render: CtaBandRender,
  toLiquid: ctaBandToLiquid,
};
