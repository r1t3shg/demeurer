/**
 * Spacer / divider — Liquid compiler.
 *
 * One div + an optional `<hr>`. No JS, no images, no fonts. The
 * trivial section that lets the rest of the page breathe.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import type { LiquidOutput, ToLiquidContext } from "../types";
import { dividerThicknessPx, spacerDefaults } from "./schema";

export function spacerToLiquid(
  _propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  // TODO P1.C segment 4: emit responsive CSS from tablet/desktop overrides.
  const schema = {
    name: "Spacer",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      {
        type: "range",
        id: "height",
        label: "Height",
        min: 0,
        max: 400,
        step: 4,
        unit: "px",
        default: spacerDefaults.height,
      },
      {
        type: "checkbox",
        id: "show_divider",
        label: "Show divider line",
        default: spacerDefaults.showDivider,
      },
      {
        type: "color",
        id: "divider_color",
        label: "Divider color",
        default: spacerDefaults.dividerColor,
      },
      {
        type: "select",
        id: "divider_width",
        label: "Divider thickness",
        options: [
          { value: "thin", label: "Thin" },
          { value: "medium", label: "Medium" },
          { value: "thick", label: "Thick" },
        ],
        default: spacerDefaults.dividerWidth,
      },
    ],
    presets: [{ name: "Spacer" }],
  };

  const template = `
{%- liquid
  assign h = section.settings.height | default: ${spacerDefaults.height}
  assign thickness = ${dividerThicknessPx("thin")}
  if section.settings.divider_width == 'medium'
    assign thickness = ${dividerThicknessPx("medium")}
  elsif section.settings.divider_width == 'thick'
    assign thickness = ${dividerThicknessPx("thick")}
  endif
-%}
<div aria-hidden="true" style="height: {{ h }}px; display: flex; align-items: center; justify-content: center;">
  {%- if section.settings.show_divider -%}
    <hr style="width: 100%; max-width: 720px; height: {{ thickness }}px; background: {{ section.settings.divider_color | default: '${spacerDefaults.dividerColor}' }}; border: 0; margin: 0;">
  {%- endif -%}
</div>
`.trim();

  return { schema, template };
}
