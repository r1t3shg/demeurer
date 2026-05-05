/**
 * Page template builder.
 *
 * Walks `page.source.blocks` and produces the JSON content for
 * `templates/page.demeurer-{handle}.json` (or
 * `templates/product.demeurer-{handle}.json` for product pages).
 *
 * Output structure:
 *   {
 *     "sections": {
 *       "main-{first8}": {
 *         "type": "demeurer-{type}",
 *         "settings": { ... per-block settings + scope_id + style strings },
 *         "blocks": { ... only when section has list sub-items },
 *         "block_order": [ ... ]
 *       },
 *       ...
 *     },
 *     "order": ["main-..", ...]
 *   }
 *
 * Stable section keys: `main-{first8}` derived from `block.id` (cuid).
 * Collisions in the first 8 chars are theoretical at our block counts; if
 * one happens we add a deterministic `-{i}` suffix in encounter order.
 *
 * Determinism: serialized via `stableStringify` (sorted keys at every
 * level). The arrays `order` and `block_order` preserve user-given order
 * — those are sequences, not bags.
 */

import type { Block, EditorDocument } from "../editor/types.ts";
import { scopeClass } from "../sections/_shared/responsive-css.ts";
import type { Field } from "../sections/types.ts";
import { replaceProductTokens } from "./product-tokens.ts";
import { buildResponsiveStyles } from "./responsive-settings.ts";
import type { SectionTemplate } from "./section-templates/index.ts";
import { stableStringify } from "./stable-json.ts";
import type { Diagnostic } from "./types.ts";

export interface PageInput {
  id: string;
  handle: string;
  type: "landing" | "product";
  source: EditorDocument;
}

export function buildPageTemplate(
  page: PageInput,
  registry: Readonly<Record<string, SectionTemplate>>,
  diagnostics: Diagnostic[],
): string {
  const sections: Record<string, unknown> = {};
  const order: string[] = [];
  const usedKeys = new Set<string>();

  for (const block of page.source.blocks) {
    const template = registry[block.type];
    if (!template) {
      diagnostics.push({
        level: "warning",
        message: `Unknown section type "${block.type}" — skipped during compile.`,
        blockId: block.id,
      });
      continue;
    }

    const key = stableSectionKey(block, usedKeys);
    usedKeys.add(key);

    const sectionEntry = buildSectionEntry(block, template, page.type, diagnostics);
    sections[key] = sectionEntry;
    order.push(key);
  }

  const root = { sections, order };
  return stableStringify(root, 2) + "\n";
}

function buildSectionEntry(
  block: Block,
  template: SectionTemplate,
  pageType: "landing" | "product",
  diagnostics: Diagnostic[],
): Record<string, unknown> {
  const scope = scopeClass(template.type, block.id);
  const baseSettings = template.toSettings(block.props.mobile);

  // Apply product-token replacement to text/richtext fields when:
  //   - this is a product page, AND
  //   - the section is productAware.
  //
  // Token replacement on landing pages is intentionally skipped —
  // `{{product.title}}` would Liquid-render as empty on a non-
  // product template anyway, but we leave the literal in place so
  // the merchant sees it and reconsiders.
  const tokenized =
    pageType === "product" && template.productAware
      ? applyTokensToTextFields(baseSettings, template.schema.fields, block.id, diagnostics)
      : baseSettings;

  const styles = buildResponsiveStyles(scope, block.props, template.propMap);

  const fullSettings: Record<string, unknown> = {
    ...tokenized,
    scope_id: scope,
    mobile_styles: styles.mobile_styles,
    tablet_styles: styles.tablet_styles,
    desktop_styles: styles.desktop_styles,
    visibility_styles: styles.visibility_styles,
  };

  // Per-block variant filter (P1.E segment 2). Only emitted for
  // productAware sections. Editor stores GIDs; the shared section
  // file compares against the numeric variant id at runtime, so we
  // strip the GID prefix here.
  if (template.productAware) {
    const binding = block.variantBinding;
    if (binding?.mode === "specific" && binding.variantIds?.length) {
      fullSettings.bound_variant_ids = binding.variantIds
        .map(stripVariantGid)
        .join(",");
    } else {
      // Empty for shape stability: same source → same JSON bytes.
      fullSettings.bound_variant_ids = "";
    }
  }

  const entry: Record<string, unknown> = {
    type: `demeurer-${template.type}`,
    settings: fullSettings,
  };

  if (template.toBlocks) {
    const { blocks, block_order } = template.toBlocks(block.props.mobile);
    if (block_order.length > 0) {
      entry.blocks = blocks;
      entry.block_order = block_order;
    }
  }

  return entry;
}

/**
 * Walk the schema's text/richtext fields and run `replaceProductTokens`
 * on the matching settings entries. Group/list fields aren't recursed
 * into for tokenization — group fields flatten into prefixed setting
 * keys (e.g. `cta_label`) handled by `settings-schema.ts`, and list
 * fields become Shopify blocks (handled separately at the block level
 * via `template.toBlocks`).
 */
function applyTokensToTextFields(
  settings: Record<string, unknown>,
  fields: Field[],
  blockId: string,
  diagnostics: Diagnostic[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...settings };
  for (const field of fields) {
    if (field.kind !== "text" && field.kind !== "richtext") continue;
    const v = out[field.key];
    if (typeof v !== "string") continue;
    out[field.key] = replaceProductTokens(v, diagnostics, blockId, field.key);
  }
  return out;
}

/**
 * `main-{first8 of cuid}`. Deterministic disambiguation if first8
 * collides — at our block counts (≤ ~50 per page) collisions are
 * astronomically unlikely, but the rule is still well-defined.
 */
function stableSectionKey(block: Block, used: Set<string>): string {
  const base = `main-${sanitize(block.id).slice(0, 8) || "block"}`;
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  // Fallback that should never happen at MVP page sizes.
  return `${base}-${used.size}`;
}

/**
 * Strip the Shopify GID prefix from a variant id, returning just the
 * numeric portion. The editor stores variant ids as
 * `gid://shopify/ProductVariant/123`; the storefront's
 * `product.selected_or_first_available_variant.id` returns the
 * numeric `123`. Normalize at compile time so the shared section
 * file's string comparison just works.
 */
function stripVariantGid(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function sanitize(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}
