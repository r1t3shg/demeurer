/**
 * Testimonial — schema, defaults, metadata.
 *
 * Carousel layout renders the first slide statically in the canvas
 * (interactive carousels are post-MVP and a page-speed risk if done
 * naively). On the published storefront, `toLiquid` falls back to a
 * grid + a tiny CSS-only horizontal scroll snap as the most-correct
 * "carousel without JS" — see toLiquid.ts for the comment.
 */

import type { SectionSchema, SpacingValue } from "../types.ts";
import {
  coerceEnum,
  coerceImageUrl,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce.ts";

export const TESTIMONIAL_TYPE = "testimonial";

export type Layout = "single" | "carousel" | "grid";
const LAYOUTS: Layout[] = ["single", "carousel", "grid"];

export const testimonialSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    {
      kind: "select",
      key: "layout",
      label: "Layout",
      options: [
        { value: "single", label: "Single" },
        { value: "carousel", label: "Carousel" },
        { value: "grid", label: "Grid" },
      ],
      default: "single",
    },
    {
      kind: "list",
      key: "testimonials",
      label: "Testimonials",
      maxItems: 6,
      itemSchema: [
        { kind: "richtext", key: "quote", label: "Quote" },
        { kind: "text", key: "authorName", label: "Author name", max: 80 },
        { kind: "text", key: "authorTitle", label: "Author title", max: 80 },
        { kind: "image", key: "authorImage", label: "Author photo" },
        {
          kind: "number",
          key: "rating",
          label: "Rating (0–5)",
          min: 0,
          max: 5,
          step: 0.5,
        },
      ],
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface Testimonial {
  quote: string;
  authorName: string;
  authorTitle: string;
  authorImage: string;
  rating: number | null;
}

export interface TestimonialProps {
  heading: string;
  layout: Layout;
  testimonials: Testimonial[];
  padding: SpacingValue;
}

export const testimonialDefaults: TestimonialProps = {
  heading: "What customers are saying",
  layout: "single",
  testimonials: [
    {
      quote:
        "<p>The fit is exactly what I'd been searching for. I bought one in every color and they've held up beautifully wash after wash.</p>",
      authorName: "Maya R.",
      authorTitle: "Verified buyer",
      authorImage: "",
      rating: 5,
    },
    {
      quote:
        "<p>Customer service walked me through sizing on a Sunday evening. That kind of attention has stopped being normal — I appreciate it.</p>",
      authorName: "Daniel K.",
      authorTitle: "Verified buyer",
      authorImage: "",
      rating: 5,
    },
  ],
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

function coerceTestimonial(item: Record<string, unknown>): Testimonial {
  const ratingRaw = item.rating;
  let rating: number | null = null;
  if (typeof ratingRaw === "number" && Number.isFinite(ratingRaw)) {
    rating = Math.max(0, Math.min(5, ratingRaw));
  }
  return {
    quote: coerceString(item.quote, ""),
    authorName: coerceString(item.authorName, ""),
    authorTitle: coerceString(item.authorTitle, ""),
    authorImage: coerceImageUrl(item.authorImage),
    rating,
  };
}

export function coerceTestimonialProps(
  input: Record<string, unknown>,
): TestimonialProps {
  return {
    heading: coerceString(input.heading, testimonialDefaults.heading),
    layout: coerceEnum<Layout>(input.layout, LAYOUTS, testimonialDefaults.layout),
    testimonials: coerceList<Testimonial>(
      input.testimonials,
      coerceTestimonial,
      6,
      testimonialDefaults.testimonials,
    ),
    padding: coerceSpacing(input.padding, testimonialDefaults.padding),
  };
}

/** Used by both Render and toLiquid for consistent star rendering. */
export function describeRating(rating: number | null): string {
  if (rating === null) return "";
  return `${rating.toFixed(rating % 1 === 0 ? 0 : 1)} / 5`;
}
