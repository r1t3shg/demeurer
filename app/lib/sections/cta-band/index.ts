import { contrastRatio } from "../_shared/quality";
import type { SectionDefinition, SectionQualityIssue } from "../types";
import { CtaBandRender } from "./Render";
import { CTA_BAND_TYPE, coerceCtaBandProps, ctaBandDefaults, ctaBandSchema } from "./schema";
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
  qualityCheck: (props) => {
    const p = coerceCtaBandProps(props);
    const issues: SectionQualityIssue[] = [];
    // Auto-contrast picks white or black against the band background;
    // warn only if neither pairs to AA — vanishingly rare for hex
    // but possible for mid-grey backgrounds (#777-ish).
    const whiteR = contrastRatio("#ffffff", p.background);
    const blackR = contrastRatio("#0a0a0a", p.background);
    const best = Math.max(whiteR ?? 0, blackR ?? 0);
    if (best > 0 && best < 4.5) {
      issues.push({
        severity: "warning",
        message: `Background color ${p.background} doesn't reach WCAG AA contrast with either light or dark text (best ${best.toFixed(2)}:1).`,
      });
    }
    return issues;
  },
};
