import type { SectionDefinition } from "../types";
import { FormRender } from "./Render";
import { FORM_TYPE, formDefaults, formSchema } from "./schema";
import { formToLiquid } from "./toLiquid";

export const formDefinition: SectionDefinition = {
  type: FORM_TYPE,
  label: "Form",
  icon: "Mail",
  category: "form",
  schema: formSchema,
  defaults: { ...formDefaults },
  Render: FormRender,
  toLiquid: formToLiquid,
};
