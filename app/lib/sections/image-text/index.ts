import type { SectionDefinition, SectionQualityIssue } from "../types.ts";
import { ImageTextRender } from "./Render.ts";
import {
  IMAGE_TEXT_TYPE,
  coerceImageTextProps,
  imageTextDefaults,
  imageTextSchema,
} from "./schema.ts";
import { imageTextToLiquid } from "./toLiquid.ts";

export const imageTextDefinition: SectionDefinition = {
  type: IMAGE_TEXT_TYPE,
  label: "Image + text",
  description:
    "An image paired with a heading, body, and CTA. Choose left- or right-aligned layouts; the image takes 40\u201360% of the width.",
  icon: "Image",
  category: "content",
  schema: imageTextSchema,
  defaults: { ...imageTextDefaults },
  Render: ImageTextRender,
  toLiquid: imageTextToLiquid,
  productAware: true,
  qualityCheck: (props) => {
    const p = coerceImageTextProps(props);
    const issues: SectionQualityIssue[] = [];
    if (p.image && !p.imageAlt.trim()) {
      issues.push({
        severity: "warning",
        message: "Image alt text is empty. Add a description so screen readers can convey the image.",
      });
    }
    return issues;
  },
};
