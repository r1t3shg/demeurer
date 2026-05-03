import type { SectionDefinition } from "../types";
import { ImageTextRender } from "./Render";
import {
  IMAGE_TEXT_TYPE,
  imageTextDefaults,
  imageTextSchema,
} from "./schema";
import { imageTextToLiquid } from "./toLiquid";

export const imageTextDefinition: SectionDefinition = {
  type: IMAGE_TEXT_TYPE,
  label: "Image + text",
  icon: "Image",
  category: "content",
  schema: imageTextSchema,
  defaults: { ...imageTextDefaults },
  Render: ImageTextRender,
  toLiquid: imageTextToLiquid,
};
