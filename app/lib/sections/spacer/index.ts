import type { SectionDefinition } from "../types.ts";
import { SpacerRender } from "./Render.tsx";
import { SPACER_TYPE, spacerDefaults, spacerSchema } from "./schema.ts";
import { spacerToLiquid } from "./toLiquid.ts";

export const spacerDefinition: SectionDefinition = {
  type: SPACER_TYPE,
  label: "Spacer",
  description:
    "Vertical breathing room between sections. Optional thin/medium/thick horizontal divider line if you want a visual break.",
  icon: "Minus",
  category: "layout",
  schema: spacerSchema,
  defaults: { ...spacerDefaults },
  Render: SpacerRender,
  toLiquid: spacerToLiquid,
};
