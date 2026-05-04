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

    const sectionEntry = buildSectionEntry(block, template);
    sections[key] = sectionEntry;
    order.push(key);
  }

  const root = { sections, order };
  return stableStringify(root, 2) + "\n";
}

function buildSectionEntry(
  block: Block,
  template: SectionTemplate,
): Record<string, unknown> {
  const scope = scopeClass(template.type, block.id);
  const baseSettings = template.toSettings(block.props.mobile);
  const styles = buildResponsiveStyles(scope, block.props, template.propMap);

  const fullSettings: Record<string, unknown> = {
    ...baseSettings,
    scope_id: scope,
    mobile_styles: styles.mobile_styles,
    tablet_styles: styles.tablet_styles,
    desktop_styles: styles.desktop_styles,
    visibility_styles: styles.visibility_styles,
  };

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

function sanitize(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}
