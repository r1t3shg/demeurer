/**
 * Product page compile tests.
 *
 * Exercises the compile pipeline against a product-page fixture:
 *   - product validation enforces productId
 *   - emits sections/demeurer-product-details.liquid + product template
 *   - section file has the {% if product %} guard
 *   - page template's section entry uses the product-details type
 *   - determinism (compile twice, identical hashes)
 *   - product-token replacement for productAware sections (hero
 *     using {{product.title}})
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  compilePage,
  CompileValidationError,
} from "../compile.ts";
import { migrateDocument } from "../../editor/types.ts";

const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

function pageInput(opts: {
  blocks: Array<{ id: string; type: string; props?: Record<string, unknown> }>;
  type?: "landing" | "product";
  productId?: string | null;
  handle?: string;
}) {
  const source = migrateDocument({
    version: 2,
    blocks: opts.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      props: { mobile: b.props ?? {} },
      children: [],
    })),
  });
  return {
    id: "page_test",
    handle: opts.handle ?? "sample-tee",
    type: opts.type ?? "product",
    source,
    updatedAt: FIXED_UPDATED_AT,
    productId:
      opts.productId === null
        ? null
        : (opts.productId ?? "gid://shopify/Product/123"),
  };
}

describe("compilePage — product pages", () => {
  it("emits section + product template files", async () => {
    const result = await compilePage(
      pageInput({
        blocks: [{ id: "blk_pd_aaaa", type: "product-details" }],
      }),
    );
    const sectionFile = result.artifact.files.find(
      (f) => f.purpose === "section",
    );
    const tplFile = result.artifact.files.find(
      (f) => f.purpose === "template",
    );
    assert.ok(sectionFile);
    assert.ok(tplFile);
    assert.strictEqual(
      sectionFile.path,
      "sections/demeurer-product-details.liquid",
    );
    assert.strictEqual(
      tplFile.path,
      "templates/product.demeurer-sample-tee.json",
    );
  });

  it("section file contains the {% if product %} guard", async () => {
    const result = await compilePage(
      pageInput({
        blocks: [{ id: "blk_pd_bbbb", type: "product-details" }],
      }),
    );
    const sectionFile = result.artifact.files.find(
      (f) => f.purpose === "section",
    )!;
    assert.match(sectionFile.content, /\{%-?\s*if product\s*-?%\}/);
  });

  it("page template's section entry has the product-details type", async () => {
    const result = await compilePage(
      pageInput({
        blocks: [{ id: "blk_pd_cccc", type: "product-details" }],
      }),
    );
    const tpl = result.artifact.files.find((f) => f.purpose === "template")!;
    const json = JSON.parse(tpl.content);
    const entry = json.sections["main-blk_pd_c"];
    assert.ok(entry);
    assert.strictEqual(entry.type, "demeurer-product-details");
  });

  it("compile twice → identical contentHash arrays", async () => {
    const a = await compilePage(
      pageInput({ blocks: [{ id: "blk_pd_dddd", type: "product-details" }] }),
    );
    const b = await compilePage(
      pageInput({ blocks: [{ id: "blk_pd_dddd", type: "product-details" }] }),
    );
    assert.strictEqual(a.artifact.files.length, b.artifact.files.length);
    for (let i = 0; i < a.artifact.files.length; i++) {
      assert.strictEqual(
        a.artifact.files[i].contentHash,
        b.artifact.files[i].contentHash,
      );
    }
  });

  it("rejects product page without productId via CompileValidationError", async () => {
    let err: unknown = null;
    try {
      await compilePage(
        pageInput({
          blocks: [{ id: "blk_pd_eeee", type: "product-details" }],
          productId: null,
        }),
      );
    } catch (e) {
      err = e;
    }
    assert.ok(err instanceof CompileValidationError);
  });

  it("hero {{product.title}} token expands in productAware section settings", async () => {
    const result = await compilePage(
      pageInput({
        blocks: [
          {
            id: "blk_hero_ffff",
            type: "hero",
            props: {
              heading: "Buy {{product.title}}",
            },
          },
        ],
      }),
    );
    const tpl = result.artifact.files.find((f) => f.purpose === "template")!;
    const json = JSON.parse(tpl.content);
    const heroEntry = json.sections["main-blk_hero"];
    assert.ok(heroEntry);
    assert.strictEqual(heroEntry.settings.heading, "Buy {{ product.title }}");
  });

  it("token replacement does NOT run for landing pages", async () => {
    const result = await compilePage(
      pageInput({
        blocks: [
          {
            id: "blk_hero_gggg",
            type: "hero",
            props: { heading: "Hi {{product.title}}" },
          },
        ],
        type: "landing",
        productId: null,
        handle: "about",
      }),
    );
    const tpl = result.artifact.files.find((f) => f.purpose === "template")!;
    const json = JSON.parse(tpl.content);
    const heroEntry = json.sections["main-blk_hero"];
    // Literal token preserved on landing page (no product context exists).
    assert.match(heroEntry.settings.heading, /\{\{product\.title\}\}/);
  });
});
