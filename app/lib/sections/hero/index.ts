/**
 * Hero — section definition export.
 *
 * Pulls together schema/Render/toLiquid into the SectionDefinition that
 * the registry consumes. Imported by `app/lib/sections/index.ts`.
 */

import { contrastRatio } from "../_shared/quality.ts";
import type { SectionDefinition, SectionQualityIssue } from "../types.ts";
import { HeroRender } from "./Render.ts";
import { HERO_TYPE, coerceHeroProps, heroDefaults, heroSchema } from "./schema.ts";
import { heroToLiquid } from "./toLiquid.ts";

export const heroDefinition: SectionDefinition = {
  type: HERO_TYPE,
  label: "Hero",
  description:
    "A full-width banner with a heading, subheading, and a call-to-action — usually the first thing visitors see on a landing page.",
  icon: "Sparkles",
  category: "content",
  schema: heroSchema,
  defaults: { ...heroDefaults },
  Render: HeroRender,
  toLiquid: heroToLiquid,
  qualityCheck: (props, themeTokens) => {
    const p = coerceHeroProps(props);
    const issues: SectionQualityIssue[] = [];
    // Hero with no background image: theme text vs theme background.
    if (!p.backgroundImage) {
      const ratio = contrastRatio(
        themeTokens.colors.text,
        themeTokens.colors.background,
      );
      if (ratio !== null && ratio < 4.5) {
        issues.push({
          severity: "error",
          message: `Heading text contrast is ${ratio.toFixed(2)}:1 against the theme background — needs 4.5:1 for WCAG AA. Try a darker text color or a different background.`,
        });
      }
    }
    if (p.backgroundImage && !p.heading) {
      issues.push({
        severity: "warning",
        message: "Background image is set but the hero has no heading — screen reader users won't know what this section is about.",
      });
    }
    return issues;
  },
};
