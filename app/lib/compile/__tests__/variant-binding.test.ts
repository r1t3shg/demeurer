/**
 * Per-variant content binding tests (P1.E segment 2).
 *
 * Covers:
 *   - Block with no variantBinding → bound_variant_ids is "" on
 *     productAware sections; absent on non-productAware sections.
 *   - Block with mode "all" → bound_variant_ids is "" (mode "all"
 *     is normalized to no field by the store, but we test the
 *     compile path defensively).
 *   - Block with mode "specific" + GIDs → numeric ids comma-
 *     separated in bound_variant_ids.
 *   - The shared section file for productAware sections includes
 *     the should_render guard; non-productAware files don't.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { compilePage } from "../compile.ts";
import { migrateDocument } from "../../editor/types.ts";

const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

function buildPage(opts: {
  blocks: Array<{
    id: string;
    type: string;
    props?: Record<string, unknown>;
    variantBinding?: { mode: "all" | "specific"; variantIds?: string[] };
  }>;
  type?: "landing" | "product";
  productId?: string | null;
}) {
  const source = migrateDocument({
    version: 2,
    blocks: opts.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      props: { mobile: b.props ?? {} },
      children: [],
      ...(b.variantBinding ? { variantBinding: b.variantBinding } : {}),
    })),
  });
  return {
    id: "page_test",
    handle: "sample-tee",
    type: opts.type ?? "product",
    source,
    updatedAt: FIXED_UPDATED_AT,
    productId: opts.productId === null ? null : (opts.productId ?? "gid://shopify/Product/1"),
  };
}

function getTemplateJson(result: Awaited<ReturnType<typeof compilePage>>) {
  const tpl = result.artifact.files.find((f) => f.purpose === "template")!;
  return JSON.parse(tpl.content);
}

function getSectionFile(
  result: Awaited<ReturnType<typeof compilePage>>,
  type: string,
) {
  return result.artifact.files.find(
    (f) => f.purpose === "section" && f.path.endsWith(`demeurer-${type}.liquid`),
  )!;
}

describe("variantBinding compile output", () => {
  it("non-productAware section: no bound_variant_ids in settings", async () => {
    const result = await compilePage(
      buildPage({
        blocks: [
          { id: "blk_html_aaaaaaaa", type: "html", props: { html: "<p>hi</p>" } },
        ],
      }),
    );
    const json = getTemplateJson(result);
    const entry = json.sections["main-blk_html"];
    assert.ok(entry);
    assert.strictEqual(
      "bound_variant_ids" in entry.settings,
      false,
      "non-productAware section should NOT carry bound_variant_ids",
    );
  });

  it("productAware section, no variantBinding: bound_variant_ids is empty string", async () => {
    const result = await compilePage(
      buildPage({
        blocks: [{ id: "blk_hero_bbbbbbbb", type: "hero" }],
      }),
    );
    const json = getTemplateJson(result);
    const entry = json.sections["main-blk_hero"];
    assert.strictEqual(entry.settings.bound_variant_ids, "");
  });

  it("productAware section, variantBinding mode 'all': empty string (defensive)", async () => {
    const result = await compilePage(
      buildPage({
        blocks: [
          {
            id: "blk_hero_cccccccc",
            type: "hero",
            variantBinding: { mode: "all" },
          },
        ],
      }),
    );
    const json = getTemplateJson(result);
    const entry = json.sections["main-blk_hero"];
    assert.strictEqual(entry.settings.bound_variant_ids, "");
  });

  it("productAware section, variantBinding 'specific': comma-separated numeric ids (GID stripped)", async () => {
    const result = await compilePage(
      buildPage({
        blocks: [
          {
            id: "blk_hero_dddddddd",
            type: "hero",
            variantBinding: {
              mode: "specific",
              variantIds: [
                "gid://shopify/ProductVariant/123",
                "gid://shopify/ProductVariant/456",
              ],
            },
          },
        ],
      }),
    );
    const json = getTemplateJson(result);
    const entry = json.sections["main-blk_hero"];
    assert.strictEqual(entry.settings.bound_variant_ids, "123,456");
  });

  it("productAware shared section file contains the variant guard", async () => {
    const result = await compilePage(
      buildPage({ blocks: [{ id: "blk_hero_eeeeeeee", type: "hero" }] }),
    );
    const heroFile = getSectionFile(result, "hero");
    assert.match(heroFile.content, /should_render/);
    assert.match(
      heroFile.content,
      /product\.selected_or_first_available_variant\.id/,
    );
    assert.match(heroFile.content, /bound_variant_ids/);
  });

  it("non-productAware shared section file lacks the variant guard", async () => {
    // Use HTML as a representative non-productAware section.
    const result = await compilePage(
      buildPage({
        blocks: [
          { id: "blk_html_ffffffff", type: "html", props: { html: "<p>x</p>" } },
        ],
      }),
    );
    const htmlFile = getSectionFile(result, "html");
    assert.doesNotMatch(htmlFile.content, /should_render/);
    assert.doesNotMatch(htmlFile.content, /bound_variant_ids/);
  });

  it("variantBinding survives migrateDocument round-trip", () => {
    const doc = migrateDocument({
      version: 2,
      blocks: [
        {
          id: "blk_test",
          type: "hero",
          props: { mobile: {} },
          children: [],
          variantBinding: {
            mode: "specific",
            variantIds: ["gid://shopify/ProductVariant/789"],
          },
        },
      ],
    });
    assert.strictEqual(doc.blocks[0].variantBinding?.mode, "specific");
    assert.deepStrictEqual(doc.blocks[0].variantBinding?.variantIds, [
      "gid://shopify/ProductVariant/789",
    ]);
  });
});
