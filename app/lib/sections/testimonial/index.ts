import type { SectionDefinition } from "../types";
import { TestimonialRender } from "./Render";
import {
  TESTIMONIAL_TYPE,
  testimonialDefaults,
  testimonialSchema,
} from "./schema";
import { testimonialToLiquid } from "./toLiquid";

export const testimonialDefinition: SectionDefinition = {
  type: TESTIMONIAL_TYPE,
  label: "Testimonial",
  description:
    "Customer quotes with optional star ratings, author name, title, and avatar. Render as single, grid, or scroll-snap carousel.",
  icon: "Quote",
  category: "content",
  schema: testimonialSchema,
  defaults: { ...testimonialDefaults },
  Render: TestimonialRender,
  toLiquid: testimonialToLiquid,
};
