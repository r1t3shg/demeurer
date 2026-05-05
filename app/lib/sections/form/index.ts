import type { SectionDefinition, SectionQualityIssue } from "../types.ts";
import { FormRender } from "./Render.tsx";
import { FORM_TYPE, coerceFormProps, formDefaults, formSchema } from "./schema.ts";
import { formToLiquid } from "./toLiquid.ts";

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
  qualityCheck: (props) => {
    const p = coerceFormProps(props);
    const issues: SectionQualityIssue[] = [];
    if (p.fields.length === 0) {
      issues.push({
        severity: "error",
        message: "Form has no fields. Add at least one field (e.g., Email) for the form to work.",
      });
    }
    return issues;
  },
};
