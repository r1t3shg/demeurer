/**
 * Spacer / divider — schema, defaults, metadata.
 *
 * Pure layout primitive. A configurable-height div, optionally with
 * a horizontal rule centered inside. Useful as a breath between
 * dense sections; merchants tend to want this once they've stacked
 * five sections in a row.
 */

import type { SectionSchema } from "../types";
import {
  coerceBoolean,
  coerceEnum,
  coerceNumber,
  coerceString,
} from "../_shared/coerce";

export const SPACER_TYPE = "spacer";

export type DividerWidth = "thin" | "medium" | "thick";
const WIDTHS: DividerWidth[] = ["thin", "medium", "thick"];

export interface SpacerProps {
  height: number;
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: DividerWidth;
}

export const spacerSchema: SectionSchema = {
  fields: [
    {
      kind: "number",
      key: "height",
      label: "Height (px)",
      min: 0,
      max: 400,
      step: 4,
    },
    // showDivider toggles structure (line vs. blank space). dividerColor
    // is a structural property of the same — keep them mobile-only.
    {
      kind: "boolean",
      key: "showDivider",
      label: "Show divider line",
      responsive: false,
    },
    {
      kind: "color",
      key: "dividerColor",
      label: "Divider color",
      responsive: false,
    },
    {
      kind: "select",
      key: "dividerWidth",
      label: "Divider thickness",
      options: [
        { value: "thin", label: "Thin" },
        { value: "medium", label: "Medium" },
        { value: "thick", label: "Thick" },
      ],
      default: "thin",
    },
  ],
};

export const spacerDefaults: SpacerProps = {
  height: 48,
  showDivider: false,
  dividerColor: "#e5e7eb",
  dividerWidth: "thin",
};

export function coerceSpacerProps(input: Record<string, unknown>): SpacerProps {
  const heightRaw = coerceNumber(input.height, spacerDefaults.height);
  return {
    height: Math.max(0, Math.min(400, heightRaw)),
    showDivider: coerceBoolean(input.showDivider, spacerDefaults.showDivider),
    dividerColor: coerceString(input.dividerColor, spacerDefaults.dividerColor),
    dividerWidth: coerceEnum<DividerWidth>(
      input.dividerWidth,
      WIDTHS,
      spacerDefaults.dividerWidth,
    ),
  };
}

export function dividerThicknessPx(width: DividerWidth): number {
  switch (width) {
    case "medium":
      return 2;
    case "thick":
      return 4;
    case "thin":
    default:
      return 1;
  }
}
