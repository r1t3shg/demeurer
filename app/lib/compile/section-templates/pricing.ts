/**
 * Pricing — shared section template + per-block adapters.
 *
 * Tiers are Shopify section blocks; tier features are flattened into a
 * single `features` setting (newline-separated text) because Shopify
 * schemas don't support nested lists.
 *
 * The billing toggle is the ONE place in the entire MVP where we ship
 * inline JS in the published Liquid — ~15 lines, scoped to this section,
 * dependency-free, gated by `{% if section.settings.billingToggle %}`.
 * It swaps a class on the section root; CSS does the show/hide.
 */

import {
  coercePricingProps,
  pricingSchema,
  PRICING_TYPE,
} from "../../sections/pricing/schema.ts";
import {
  buildSharedSectionFile,
  decomposeSpacing,
  listItemsToBlocks,
  paddingPropMap,
} from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
<section class="{{ scope }} demeurer-section demeurer-pricing demeurer-pricing--monthly">
  <div class="demeurer-pricing__inner" style="max-width: 1200px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-pricing__heading" style="text-align: center; margin: 0;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-pricing__subheading" style="text-align: center; margin: 12px auto 0; max-width: 600px;">{{ section.settings.subheading }}</div>
    {%- endif -%}

    {%- if section.settings.billingToggle -%}
      <div class="demeurer-pricing__toggle" style="display: flex; justify-content: center; gap: 8px; margin-top: 24px;">
        <button type="button" class="demeurer-pricing__toggle-btn" data-billing="monthly" aria-pressed="true" style="padding: 8px 16px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 4px; cursor: pointer;">Monthly</button>
        <button type="button" class="demeurer-pricing__toggle-btn" data-billing="yearly" aria-pressed="false" style="padding: 8px 16px; border: 1px solid #d1d5db; background: transparent; border-radius: 4px; cursor: pointer;">Yearly</button>
      </div>
    {%- endif -%}

    <div class="demeurer-pricing__tiers" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-top: 32px;">
      {%- for block in section.blocks -%}
        <article class="demeurer-pricing__tier{% if block.settings.highlighted %} demeurer-pricing__tier--highlighted{% endif %}" {{ block.shopify_attributes }} style="padding: 24px; border: 1px solid {% if block.settings.highlighted %}var(--demeurer-accent, #1a73e8){% else %}#e5e7eb{% endif %}; border-radius: 8px; display: flex; flex-direction: column; gap: 16px;">
          {%- if block.settings.badge != blank -%}
            <div class="demeurer-pricing__badge" style="display: inline-block; padding: 4px 8px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 12px; font-size: 0.75em; align-self: flex-start;">{{ block.settings.badge | escape }}</div>
          {%- endif -%}
          {%- if block.settings.name != blank -%}
            <h3 class="demeurer-pricing__name" style="margin: 0; font-size: 1.25rem;">{{ block.settings.name | escape }}</h3>
          {%- endif -%}
          {%- if block.settings.description != blank -%}
            <p class="demeurer-pricing__description" style="margin: 0; opacity: 0.75;">{{ block.settings.description | escape }}</p>
          {%- endif -%}
          <div class="demeurer-pricing__price" style="font-size: 2rem; font-weight: 700;">
            <span class="demeurer-pricing__price-monthly">{{ block.settings.priceMonthly | escape }}</span>
            <span class="demeurer-pricing__price-yearly" style="display: none;">{{ block.settings.priceYearly | escape }}</span>
          </div>
          {%- if block.settings.features != blank -%}
            <ul class="demeurer-pricing__features" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
              {%- assign feature_lines = block.settings.features | newline_to_br | split: '<br />' -%}
              {%- for line in feature_lines -%}
                {%- assign trimmed = line | strip -%}
                {%- if trimmed != blank -%}
                  <li style="display: flex; gap: 8px; align-items: flex-start;"><span aria-hidden="true">✓</span><span>{{ trimmed | escape }}</span></li>
                {%- endif -%}
              {%- endfor -%}
            </ul>
          {%- endif -%}
          {%- if block.settings.ctaLabel != blank -%}
            <a class="demeurer-pricing__cta" href="{{ block.settings.ctaUrl | default: '#' }}" style="display: inline-block; padding: 12px 24px; background: var(--demeurer-accent, #1a73e8); color: #fff; border-radius: 4px; text-decoration: none; font-weight: 600; text-align: center; margin-top: auto;">{{ block.settings.ctaLabel | escape }}</a>
          {%- endif -%}
        </article>
      {%- endfor -%}
    </div>
  </div>
</section>

{%- if section.settings.billingToggle -%}
  <style>
    .demeurer-pricing--yearly .demeurer-pricing__price-monthly { display: none; }
    .demeurer-pricing--yearly .demeurer-pricing__price-yearly { display: inline; }
  </style>
  <script>
    (function () {
      var section = document.getElementById('shopify-section-{{ section.id }}');
      if (!section) return;
      var root = section.querySelector('.demeurer-pricing');
      if (!root) return;
      var btns = section.querySelectorAll('.demeurer-pricing__toggle-btn');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var billing = btn.getAttribute('data-billing');
          root.classList.toggle('demeurer-pricing--monthly', billing === 'monthly');
          root.classList.toggle('demeurer-pricing--yearly', billing === 'yearly');
          btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        });
      });
    })();
  </script>
{%- endif -%}
`;

export const pricingTemplate: SectionTemplate = {
  type: PRICING_TYPE,
  schema: pricingSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: PRICING_TYPE,
      name: "Demeurer Pricing",
      body: BODY,
      schema: pricingSchema,
      presets: [{ name: "Demeurer Pricing" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coercePricingProps(mobileProps);
    return {
      heading: p.heading,
      subheading: p.subheading,
      billingToggle: p.billingToggle,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
  toBlocks(mobileProps) {
    const p = coercePricingProps(mobileProps);
    return listItemsToBlocks("tiers", p.tiers, (tier) => ({
      name: tier.name,
      description: tier.description,
      priceMonthly: tier.priceMonthly,
      priceYearly: tier.priceYearly,
      // Shopify schemas don't support nested lists. Newline-separate.
      features: tier.features.map((f: { text: string }) => f.text).join("\n"),
      ctaLabel: tier.ctaLabel,
      ctaUrl: tier.ctaUrl,
      highlighted: tier.highlighted,
      badge: tier.badge,
    }));
  },
};
