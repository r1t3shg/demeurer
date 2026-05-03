import type { SectionDefinition } from "../types";
import { SpacerRender } from "./Render";
import { SPACER_TYPE, spacerDefaults, spacerSchema } from "./schema";
import { spacerToLiquid } from "./toLiquid";

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
