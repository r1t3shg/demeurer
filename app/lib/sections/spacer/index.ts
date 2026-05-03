import type { SectionDefinition } from "../types";
import { SpacerRender } from "./Render";
import { SPACER_TYPE, spacerDefaults, spacerSchema } from "./schema";
import { spacerToLiquid } from "./toLiquid";

export const spacerDefinition: SectionDefinition = {
  type: SPACER_TYPE,
  label: "Spacer",
  icon: "Minus",
  category: "layout",
  schema: spacerSchema,
  defaults: { ...spacerDefaults },
  Render: SpacerRender,
  toLiquid: spacerToLiquid,
};
