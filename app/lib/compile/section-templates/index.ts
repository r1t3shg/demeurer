/**
 * Section template registry. Keyed by section type.
 *
 * The compile orchestrator (`compile.ts`) looks up the matching template
 * for each block in the page and uses it to (a) emit the shared section
 * file and (b) build the per-block settings + blocks for the page
 * template JSON.
 *
 * Adding a new section to the registry: write a new module under this
 * directory exporting a `SectionTemplate`, then import it here.
 */

import { ctaBandTemplate } from "./cta-band.ts";
import { faqTemplate } from "./faq.ts";
import { featureListTemplate } from "./feature-list.ts";
import { formTemplate } from "./form.ts";
import { heroTemplate } from "./hero.ts";
import { htmlTemplate } from "./html.ts";
import { imageTextTemplate } from "./image-text.ts";
import { logoWallTemplate } from "./logo-wall.ts";
import { pricingTemplate } from "./pricing.ts";
import { spacerTemplate } from "./spacer.ts";
import { testimonialTemplate } from "./testimonial.ts";
import { videoTemplate } from "./video.ts";
import type { SectionTemplate } from "./types.ts";

const ALL: SectionTemplate[] = [
  heroTemplate,
  ctaBandTemplate,
  imageTextTemplate,
  featureListTemplate,
  logoWallTemplate,
  testimonialTemplate,
  faqTemplate,
  pricingTemplate,
  videoTemplate,
  formTemplate,
  spacerTemplate,
  htmlTemplate,
];

export const SECTION_TEMPLATES: Readonly<Record<string, SectionTemplate>> = (() => {
  const map: Record<string, SectionTemplate> = {};
  for (const t of ALL) map[t.type] = t;
  return map;
})();

export type { SectionTemplate };
