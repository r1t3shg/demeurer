import type { SectionDefinition } from "../types";
import { FormRender } from "./Render";
import { FORM_TYPE, formDefaults, formSchema } from "./schema";
import { formToLiquid } from "./toLiquid";

export const formDefinition: SectionDefinition = {
  type: FORM_TYPE,
  label: "Form",
  description:
    "Contact, customer signup, or newsletter form. Submissions go through Shopify\u2019s native {% form %} handlers \u2014 they keep working even if Demeurer is uninstalled.",
  icon: "Mail",
  category: "form",
  schema: formSchema,
  defaults: { ...formDefaults },
  Render: FormRender,
  toLiquid: formToLiquid,
};
