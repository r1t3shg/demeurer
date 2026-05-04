/**
 * Spacer / divider — Liquid compiler.
 *
 * One div + an optional `<hr>`. No JS, no images, no fonts. The
 * trivial section that lets the rest of the page breathe.
 *
 * Responsive: only `height` flows through the responsive helpers.
 * `showDivider`, `dividerColor`, and `dividerWidth` are structural —
 * they don't make sense to differ per breakpoint.
 */

import type { PropsByBreakpoint } from "../../editor/types.ts";
import type { LiquidOutput, ToLiquidContext } from "../types.ts";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  pxValue,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css.ts";
import { dividerThicknessPx, spacerDefaults } from "./schema.ts";

export function spacerToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const scope = scopeClass(ctx.sectionType, ctx.blockId);
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

  const propMap: CssPropMap[] = [
    {
      propKey: "height",
      cssProperty: "height",
      toCss: pxValue,
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  const template = `
${styleBlock}
{%- liquid
  assign h = section.settings.height | default: ${spacerDefaults.height}
  assign thickness = ${dividerThicknessPx("thin")}
  if section.settings.divider_width == 'medium'
    assign thickness = ${dividerThicknessPx("medium")}
  elsif section.settings.divider_width == 'thick'
    assign thickness = ${dividerThicknessPx("thick")}
  endif
-%}
<div class="${scope}" aria-hidden="true" style="height: {{ h }}px; display: flex; align-items: center; justify-content: center;">
  {%- if section.settings.show_divider -%}
    <hr style="width: 100%; max-width: 720px; height: {{ thickness }}px; background: {{ section.settings.divider_color | default: '${spacerDefaults.dividerColor}' }}; border: 0; margin: 0;">
  {%- endif -%}
</div>
`.trim();

  return { schema, template };
}
