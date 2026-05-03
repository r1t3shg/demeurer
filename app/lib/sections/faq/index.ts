import type { SectionDefinition } from "../types";
import { FaqRender } from "./Render";
import { FAQ_TYPE, faqDefaults, faqSchema } from "./schema";
import { faqToLiquid } from "./toLiquid";

export const faqDefinition: SectionDefinition = {
  type: FAQ_TYPE,
  label: "FAQ",
  icon: "HelpCircle",
  category: "content",
  schema: faqSchema,
  defaults: { ...faqDefaults },
  Render: FaqRender,
  toLiquid: faqToLiquid,
};
