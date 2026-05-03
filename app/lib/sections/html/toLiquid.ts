/**
 * Custom HTML — Liquid compiler.
 *
 * Output is the merchant's HTML, verbatim. No sanitization, no
 * escaping. A `{%- comment -%}` block in the published file flags this
 * to anyone reading the theme code.
 *
 * The HTML field is exposed in the published Shopify schema as
 * `type: 'html'` so merchants can keep editing it from the theme
 * editor after Demeurer is uninstalled.
 */

import type { LiquidOutput, ToLiquidContext } from "../types";
import { coerceHtmlProps, htmlDefaults } from "./schema";

export function htmlToLiquid(
  rawProps: Record<string, unknown>,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceHtmlProps(rawProps);

  const schema = {
    name: "Custom HTML",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      {
        type: "html",
        id: "custom_html",
        label: "Custom HTML",
        default: props.html,
      },
      {
        type: "paragraph",
        content:
          "This section renders your HTML directly. Don't paste untrusted content.",
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: htmlDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: htmlDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: htmlDefaults.padding.left },
    ],
    presets: [{ name: "Custom HTML" }],
  };

  const template = `
{%- comment -%}
  Custom HTML section. Output is merchant-authored and rendered as-is
  with no sanitization. Edit the "Custom HTML" setting in the theme
  editor to change.
{%- endcomment -%}
<div
  class="demeurer-html-section"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  {{ section.settings.custom_html }}
</div>
`.trim();

  return { schema, template };
}
