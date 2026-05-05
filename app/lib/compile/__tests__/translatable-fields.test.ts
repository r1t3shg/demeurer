/**
 * Translate & Adapt verification (P1.E segment 2).
 *
 * Walks every section in `SECTION_TEMPLATES` and asserts that:
 *   - Editor `text` fields → Shopify `text` or `textarea` (T&A
 *     translates both).
 *   - Editor `richtext` fields → Shopify `richtext` (T&A
 *     translates).
 *   - All other field kinds (url, color, number, boolean, select,
 *     spacing, image, group, list) → non-translatable Shopify types.
 *
 * Generative — fails loudly if a future schema-kind change breaks
 * Translate & Adapt compatibility.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildBlockSchemas,
  buildSectionSettings,
} from "../settings-schema.ts";
import { SECTION_TEMPLATES } from "../section-templates/index.ts";
import type { Field } from "../../sections/types.ts";

const TRANSLATABLE_TYPES = new Set(["text", "textarea", "richtext"]);

interface ShopifySetting {
  type: string;
  id?: string;
}

function findSetting(
  settings: ShopifySetting[],
  id: string,
): ShopifySetting | undefined {
  return settings.find((s) => s.id === id);
}

/**
 * Decompose a field into the (id, expected-translatable) pairs
 * that should appear in the Shopify settings array.
 *  - `spacing` produces 4 numeric settings (`{key}_top` etc.); none
 *    translatable.
 *  - `group` flattens children with `{groupKey}_{childKey}`; recurse.
 *  - `list` becomes blocks; tested separately.
 */
function expectedSettingTranslatableMap(
  fields: Field[],
  prefix = "",
): Array<{ id: string; translatable: boolean; kind: string }> {
  const out: Array<{ id: string; translatable: boolean; kind: string }> = [];
  for (const field of fields) {
    const id = prefix ? `${prefix}_${field.key}` : field.key;
    switch (field.kind) {
      case "text":
      case "richtext":
        out.push({ id, translatable: true, kind: field.kind });
        break;
      case "spacing":
        out.push(
          { id: `${id}_top`, translatable: false, kind: "spacing" },
          { id: `${id}_right`, translatable: false, kind: "spacing" },
          { id: `${id}_bottom`, translatable: false, kind: "spacing" },
          { id: `${id}_left`, translatable: false, kind: "spacing" },
        );
        break;
      case "group":
        out.push(...expectedSettingTranslatableMap(field.fields, id));
        break;
      case "list":
        // Lists become Shopify blocks; checked separately.
        break;
      default:
        out.push({ id, translatable: false, kind: field.kind });
    }
  }
  return out;
}

describe("translatable fields — Shopify schema mapping", () => {
  for (const [type, template] of Object.entries(SECTION_TEMPLATES)) {
    it(`${type}: text/richtext → translatable; others → not`, () => {
      const settings = buildSectionSettings(
        template.schema,
        template.productAware,
      ) as unknown as ShopifySetting[];
      const expected = expectedSettingTranslatableMap(template.schema.fields);

      for (const exp of expected) {
        const actual = findSetting(settings, exp.id);
        assert.ok(
          actual,
          `${type}: setting "${exp.id}" missing in compiled schema`,
        );
        const isTranslatable = TRANSLATABLE_TYPES.has(actual.type);
        assert.strictEqual(
          isTranslatable,
          exp.translatable,
          `${type}: setting "${exp.id}" (kind ${exp.kind}) translatable=${exp.translatable} but Shopify type is "${actual.type}"`,
        );
      }
    });

    // List-field → blocks: each block's settings should also follow
    // the rules for its child fields.
    const hasList = template.schema.fields.some((f) => f.kind === "list");
    if (hasList) {
      it(`${type}: list-field block settings translatability`, () => {
        const blockSchemas = buildBlockSchemas(template.schema);
        for (const field of template.schema.fields) {
          if (field.kind !== "list") continue;
          const blockSchema = blockSchemas.find((b) => b.type === field.key);
          assert.ok(blockSchema, `${type}: block schema for ${field.key} missing`);
          const blockSettings = blockSchema.settings as unknown as ShopifySetting[];
          const expected = expectedSettingTranslatableMap(field.itemSchema);
          for (const exp of expected) {
            const actual = findSetting(blockSettings, exp.id);
            if (!actual) continue; // some fields filtered out (lists etc.)
            const isTranslatable = TRANSLATABLE_TYPES.has(actual.type);
            assert.strictEqual(
              isTranslatable,
              exp.translatable,
              `${type}: block "${field.key}" setting "${exp.id}" expected translatable=${exp.translatable}, got Shopify type "${actual.type}"`,
            );
          }
        }
      });
    }
  }
});
