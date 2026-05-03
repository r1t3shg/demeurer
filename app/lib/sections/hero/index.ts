/**
 * Hero — section definition export.
 *
 * Pulls together schema/Render/toLiquid into the SectionDefinition that
 * the registry consumes. Imported by `app/lib/sections/index.ts`.
 */

import type { SectionDefinition } from "../types";
import { HeroRender } from "./Render";
import { HERO_TYPE, heroDefaults, heroSchema } from "./schema";
import { heroToLiquid } from "./toLiquid";

export const heroDefinition: SectionDefinition = {
  type: HERO_TYPE,
  label: "Hero",
  icon: "Sparkles",
  category: "content",
  schema: heroSchema,
  defaults: { ...heroDefaults },
  Render: HeroRender,
  toLiquid: heroToLiquid,
};
