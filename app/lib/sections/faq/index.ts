import type { SectionDefinition } from "../types.ts";
import { FaqRender } from "./Render.tsx";
import { FAQ_TYPE, faqDefaults, faqSchema } from "./schema.ts";
import { faqToLiquid } from "./toLiquid.ts";

export const faqDefinition: SectionDefinition = {
  type: FAQ_TYPE,
  label: "FAQ",
  description:
    "An accordion of questions and answers, built on native <details> \u2014 zero JavaScript, screen-reader friendly out of the box.",
  icon: "HelpCircle",
  category: "content",
  schema: faqSchema,
  defaults: { ...faqDefaults },
  Render: FaqRender,
  toLiquid: faqToLiquid,
};
