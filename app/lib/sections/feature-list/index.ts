import type { SectionDefinition } from "../types.ts";
import { FeatureListRender } from "./Render.tsx";
import {
  FEATURE_LIST_TYPE,
  featureListDefaults,
  featureListSchema,
} from "./schema.ts";
import { featureListToLiquid } from "./toLiquid.ts";

export const featureListDefinition: SectionDefinition = {
  type: FEATURE_LIST_TYPE,
  label: "Feature list",
  description:
    "A grid or list of icon + title + description items. Good for product capabilities, benefits, or a 3-step \u201chow it works\u201d.",
  icon: "List",
  category: "content",
  schema: featureListSchema,
  defaults: { ...featureListDefaults },
  Render: FeatureListRender,
  toLiquid: featureListToLiquid,
};
