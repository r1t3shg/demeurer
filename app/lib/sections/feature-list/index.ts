import type { SectionDefinition } from "../types";
import { FeatureListRender } from "./Render";
import {
  FEATURE_LIST_TYPE,
  featureListDefaults,
  featureListSchema,
} from "./schema";
import { featureListToLiquid } from "./toLiquid";

export const featureListDefinition: SectionDefinition = {
  type: FEATURE_LIST_TYPE,
  label: "Feature list",
  icon: "List",
  category: "content",
  schema: featureListSchema,
  defaults: { ...featureListDefaults },
  Render: FeatureListRender,
  toLiquid: featureListToLiquid,
};
