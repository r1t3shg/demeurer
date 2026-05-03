/**
 * Pricing — Liquid compiler.
 *
 * Tiers become Shopify section blocks (re-orderable in the theme
 * editor). Features are stored as a newline-separated text setting on
 * each block — Shopify schemas don't support nested-list settings, so
 * we serialize/deserialize at this boundary. The Liquid template splits
 * the lines and renders one <li> per non-blank entry.
 *
 * Billing toggle (commitment #2 carve-out): when enabled, ~15 lines of
 * dependency-free inline JS swap a class on the section root, which
 * CSS uses to flip which <span> shows the price. The script is
 * scoped to `section.id` so multiple pricing sections on one page
 * don't collide. When the toggle is OFF, no JS is emitted at all.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import { liquidString } from "../_shared/coerce";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";
import { coercePricingProps, pricingDefaults } from "./schema";

export function pricingToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coercePricingProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const schema = {
    name: "Pricing",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: pricingDefaults.heading },
      {
        type: "richtext",
        id: "subheading",
        label: "Subheading",
        default: pricingDefaults.subheading,
      },
      {
        type: "checkbox",
        id: "billing_toggle",
        label: "Show monthly/yearly toggle",
        default: pricingDefaults.billingToggle,
      },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: pricingDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: pricingDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: pricingDefaults.padding.left },
    ],
    blocks: [
      {
        type: "tier",
        name: "Tier",
        settings: [
          { type: "text", id: "name", label: "Tier name" },
          { type: "text", id: "description", label: "Short description" },
          { type: "text", id: "price_monthly", label: "Price (monthly)" },
          { type: "text", id: "price_yearly", label: "Price (yearly)" },
          {
            type: "textarea",
            id: "features",
            label: "Features (one per line)",
          },
          { type: "text", id: "cta_label", label: "CTA label" },
          { type: "url", id: "cta_url", label: "CTA link" },
          { type: "checkbox", id: "highlighted", label: "Highlighted" },
          { type: "text", id: "badge", label: "Badge" },
        ],
      },
    ],
    max_blocks: 5,
    presets: [
      {
        name: "Pricing",
        blocks: [{ type: "tier" }, { type: "tier" }, { type: "tier" }],
      },
    ],
  };

  const fallbackHeading = liquidString(props.heading);
  const fallbackSub = liquidString(props.subheading);

  const propMap: CssPropMap[] = [
    {
      propKey: "padding",
      cssProperty: "padding",
      toCss: (v) => {
        const p = v as SpacingValue;
        return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
      },
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  const template = `
${styleBlock}
{%- liquid
  assign heading = section.settings.heading | default: ${fallbackHeading}
  assign subheading = section.settings.subheading | default: ${fallbackSub}
  assign show_toggle = section.settings.billing_toggle
-%}

<div
  class="${scope} demeurer-pricing"
  data-section-id="{{ section.id }}"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  {%- if heading != blank or subheading != blank -%}
    <div class="demeurer-pricing__header" style="text-align: center; max-width: 720px; margin-inline: auto; margin-bottom: 40px;">
      {%- if heading != blank -%}
        <h2 style="margin: 0; line-height: 1.2;">{{ heading | escape }}</h2>
      {%- endif -%}
      {%- if subheading != blank -%}
        <div style="margin-top: 12px; opacity: 0.8; line-height: 1.5;">{{ subheading }}</div>
      {%- endif -%}
    </div>
  {%- endif -%}

  {%- if show_toggle -%}
    <div class="demeurer-pricing__toggle" role="tablist" aria-label="Billing period" style="display: flex; justify-content: center; gap: 8px; margin: 0 0 24px;">
      <button
        type="button"
        role="tab"
        aria-selected="true"
        data-period="monthly"
        class="demeurer-pricing__toggle-btn is-active"
        style="padding: 8px 16px; border-radius: 999px; border: 1px solid currentColor; cursor: pointer; font-weight: 600;"
      >Monthly</button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        data-period="yearly"
        class="demeurer-pricing__toggle-btn"
        style="padding: 8px 16px; border-radius: 999px; border: 1px solid currentColor; cursor: pointer; font-weight: 600;"
      >Yearly</button>
    </div>
  {%- endif -%}

  <div
    class="demeurer-pricing__grid"
    style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 24px;
      max-width: 1200px;
      margin-inline: auto;
    "
  >
    {%- for block in section.blocks -%}
      {%- if block.type == 'tier' -%}
        {%- liquid
          assign accent = '#1a73e8'
          assign card_border = '1px solid rgba(0,0,0,0.12)'
          assign card_bg = 'transparent'
          assign card_shadow = 'none'
          if block.settings.highlighted
            assign card_border = '2px solid '  | append: accent
            assign card_bg = 'rgba(0,0,0,0.02)'
            assign card_shadow = '0 4px 16px rgba(0,0,0,0.06)'
          endif
        -%}
        <article
          class="demeurer-pricing__tier"
          style="
            position: relative;
            border: {{ card_border }};
            border-radius: 12px;
            padding: 24px;
            background: {{ card_bg }};
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: {{ card_shadow }};
          "
          {{ block.shopify_attributes }}
        >
          {%- if block.settings.badge != blank -%}
            <span style="position: absolute; top: -12px; inset-inline-start: 16px; background: {{ accent }}; color: #fff; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">{{ block.settings.badge | escape }}</span>
          {%- endif -%}
          {%- if block.settings.name != blank -%}
            <h3 style="margin: 0;">{{ block.settings.name | escape }}</h3>
          {%- endif -%}
          {%- if block.settings.description != blank -%}
            <p style="margin: 0; opacity: 0.75; line-height: 1.5;">{{ block.settings.description | escape }}</p>
          {%- endif -%}
          {%- if block.settings.price_monthly != blank or block.settings.price_yearly != blank -%}
            <div class="demeurer-pricing__price" style="font-size: 2rem; font-weight: 700; line-height: 1; margin: 0;">
              <span class="demeurer-pricing__price-monthly">{{ block.settings.price_monthly | escape }}</span>
              {%- if show_toggle and block.settings.price_yearly != blank -%}
                <span class="demeurer-pricing__price-yearly" hidden>{{ block.settings.price_yearly | escape }}</span>
              {%- endif -%}
            </div>
          {%- endif -%}
          {%- assign feature_lines = block.settings.features | newline_to_br | split: '<br />' -%}
          {%- if feature_lines.size > 0 -%}
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
              {%- for line in feature_lines -%}
                {%- assign trimmed = line | strip -%}
                {%- if trimmed != blank -%}
                  <li style="display: flex; gap: 8px; align-items: flex-start;">
                    <span aria-hidden="true" style="color: {{ accent }};">✓</span>
                    <span>{{ trimmed | escape }}</span>
                  </li>
                {%- endif -%}
              {%- endfor -%}
            </ul>
          {%- endif -%}
          {%- if block.settings.cta_label != blank -%}
            <a
              href="{{ block.settings.cta_url | default: '#' }}"
              style="
                display: inline-block;
                text-align: center;
                padding: 12px 16px;
                background: {% if block.settings.highlighted %}{{ accent }}{% else %}transparent{% endif %};
                color: {% if block.settings.highlighted %}#fff{% else %}inherit{% endif %};
                border: {% if block.settings.highlighted %}none{% else %}1px solid currentColor{% endif %};
                border-radius: 6px;
                font-weight: 600;
                text-decoration: none;
                margin-top: auto;
              "
            >{{ block.settings.cta_label | escape }}</a>
          {%- endif -%}
        </article>
      {%- endif -%}
    {%- endfor -%}
  </div>
</div>

{%- if show_toggle -%}
<style>
  [data-section-id="{{ section.id }}"].is-yearly .demeurer-pricing__price-monthly { display: none; }
  [data-section-id="{{ section.id }}"].is-yearly .demeurer-pricing__price-yearly { display: inline; }
  [data-section-id="{{ section.id }}"] .demeurer-pricing__toggle-btn.is-active { background: currentColor; color: #fff; }
  [data-section-id="{{ section.id }}"] .demeurer-pricing__toggle-btn.is-active * { color: inherit; }
</style>
<script>
  (function () {
    var root = document.querySelector('[data-section-id="{{ section.id }}"]');
    if (!root) return;
    var btns = root.querySelectorAll('.demeurer-pricing__toggle-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var period = btn.getAttribute('data-period');
        root.classList.toggle('is-yearly', period === 'yearly');
        btns.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      });
    });
  })();
</script>
{%- endif -%}
`.trim();

  return { schema, template };
}
