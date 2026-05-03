import type { SectionDefinition, SectionQualityIssue } from "../types";
import { HtmlRender } from "./Render";
import { HTML_TYPE, HTML_WARNING_TEXT, htmlDefaults, htmlSchema } from "./schema";
import { htmlToLiquid } from "./toLiquid";

export const htmlDefinition: SectionDefinition = {
  type: HTML_TYPE,
  label: "Custom HTML",
  icon: "Code",
  category: "advanced",
  schema: htmlSchema,
  defaults: { ...htmlDefaults },
  Render: HtmlRender,
  toLiquid: htmlToLiquid,
  qualityCheck: () => {
    // Custom HTML is always flagged warning — the trust contract.
    // The merchant accepts the risk by choosing this section type.
    const issues: SectionQualityIssue[] = [
      { severity: "warning", message: HTML_WARNING_TEXT },
    ];
    return issues;
  },
};
