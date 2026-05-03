/**
 * FAQ accordion — schema, defaults, metadata.
 *
 * Native <details>/<summary> elements drive the accordion in both
 * canvas and Liquid. This is a deliberate choice: zero JS, native
 * keyboard support, screen-reader friendly out of the box, and free
 * progressive enhancement on every browser since 2014.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceEnum,
  coerceList,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const FAQ_TYPE = "faq";

export type Alignment = "left" | "center";
const ALIGNMENTS: Alignment[] = ["left", "center"];

export const faqSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    {
      kind: "select",
      key: "alignment",
      label: "Heading alignment",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
      default: "left",
    },
    {
      kind: "list",
      key: "questions",
      label: "Questions",
      maxItems: 20,
      itemSchema: [
        { kind: "text", key: "question", label: "Question", max: 200 },
        { kind: "richtext", key: "answer", label: "Answer" },
      ],
    },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqProps {
  heading: string;
  alignment: Alignment;
  questions: FaqItem[];
  padding: SpacingValue;
}

export const faqDefaults: FaqProps = {
  heading: "Frequently asked questions",
  alignment: "left",
  questions: [
    {
      question: "How long does shipping take?",
      answer:
        "<p>Standard orders ship within one business day and typically arrive within 3–5 business days in the continental US.</p>",
    },
    {
      question: "What's your return policy?",
      answer:
        "<p>You can return any unworn item within 30 days for a full refund. Returns are free in the US.</p>",
    },
    {
      question: "Can I change my order after placing it?",
      answer:
        "<p>Yes — email <a href=\"mailto:hi@example.com\">hi@example.com</a> within an hour of ordering and we'll do our best.</p>",
    },
  ],
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

function coerceFaqItem(item: Record<string, unknown>): FaqItem {
  return {
    question: coerceString(item.question, ""),
    answer: coerceString(item.answer, ""),
  };
}

export function coerceFaqProps(input: Record<string, unknown>): FaqProps {
  return {
    heading: coerceString(input.heading, faqDefaults.heading),
    alignment: coerceEnum<Alignment>(
      input.alignment,
      ALIGNMENTS,
      faqDefaults.alignment,
    ),
    questions: coerceList<FaqItem>(
      input.questions,
      coerceFaqItem,
      20,
      faqDefaults.questions,
    ),
    padding: coerceSpacing(input.padding, faqDefaults.padding),
  };
}
