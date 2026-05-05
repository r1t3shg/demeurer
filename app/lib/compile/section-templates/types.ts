/**
 * SectionTemplate — the per-section interface the compile pipeline calls.
 *
 * The shared section file (`sections/demeurer-{type}.liquid`) is built
 * once by `buildSectionTemplate()` and the same bytes are used for every
 * merchant. Per-page customization rides in the page template JSON,
 * which calls the section once per block and supplies values via
 * `section.settings`.
 *
 * Each per-section module under this directory exports one
 * `SectionTemplate` for the registry. The registry is keyed by section
 * type (matching `SectionDefinition.type` from
 * `app/lib/sections/registry.ts`).
 */

import type { SectionSchema } from "../../sections/types.ts";
import type { CssPropMap } from "../../sections/_shared/responsive-css.ts";

/** One Shopify section block, used inside a page template's section entry. */
export interface ShopifyBlock {
  type: string;
  settings: Record<string, unknown>;
}

/** Output of `toBlocks` — Shopify section block map + ordering. */
export interface SectionTemplateBlocks {
  blocks: Record<string, ShopifyBlock>;
  block_order: string[];
}

export interface SectionTemplate {
  /** The editor section type. Matches `SectionDefinition.type`. */
  type: string;
  /** Editor schema, used to derive `{% schema %}` JSON. */
  schema: SectionSchema;
  /**
   * Mirrors `SectionDefinition.productAware`. When true, the page
   * template builder runs `replaceProductTokens` on every text and
   * richtext setting so `{{product.title}}` etc. become real Liquid
   * in the published output.
   */
  productAware?: boolean;
  /**
   * Build the parameterless `sections/demeurer-{type}.liquid` content.
   * Pure: same bytes for every compile.
   */
  buildSectionTemplate(): string;
  /**
   * Map of (propKey → CSS property + transform) used by
   * `responsive-settings.ts` to produce mobile/tablet/desktop CSS
   * strings. Empty array means the section has no responsive CSS to
   * bake (e.g. Custom HTML, where the merchant owns the markup).
   */
  propMap: CssPropMap[];
  /**
   * Convert mobile-resolved props → flat Shopify settings record.
   * Excludes list fields (those become Shopify blocks via `toBlocks`).
   *
   * `mobileProps` is the canonical mobile layer with defaults applied
   * by the section's coerce function.
   */
  toSettings(mobileProps: Record<string, unknown>): Record<string, unknown>;
  /**
   * Optional. For sections whose schema declares a list field, map list
   * items to Shopify section blocks. Returned `block` keys are stable
   * per item id (or `"item-{i}"` if no id).
   */
  toBlocks?(mobileProps: Record<string, unknown>): SectionTemplateBlocks;
}
