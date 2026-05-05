import { contrastRatio } from "../_shared/quality.ts";
import type { SectionDefinition, SectionQualityIssue } from "../types.ts";
import { CtaBandRender } from "./Render.tsx";
import { CTA_BAND_TYPE, coerceCtaBandProps, ctaBandDefaults, ctaBandSchema } from "./schema.ts";
import { ctaBandToLiquid } from "./toLiquid.ts";

export const ctaBandDefinition: SectionDefinition = {
  type: CTA_BAND_TYPE,
  label: "CTA band",
  description:
    "A bold full-width band with one or two call-to-action buttons. Use it to push a single decision near the top or bottom of a page.",
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
