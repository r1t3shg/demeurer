/**
 * Snapshot tests for the compile pipeline.
 *
 * Each fixture (hand-written JSON under ./fixtures) is fed through
 * `compilePage` and the resulting artifact is matched against a
 * snapshot under ./__snapshots__. The artifact's `compiledAt` and the
 * top-level `metrics` object are stripped before snapshotting because
 * they vary per run.
 *
 * One extra test asserts determinism explicitly: compile the same
 * fixture twice and check that every file's `contentHash` matches.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compilePage } from "../compile.ts";
import { migrateDocument } from "../../editor/types.ts";
import { matchSnapshot } from "./snapshot.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = [
  "empty-landing",
  "hero-only",
  "hero-with-overrides",
  "kitchen-sink",
  "kitchen-sink-responsive",
] as const;

function loadFixture(name: string) {
  const json = JSON.parse(
    readFileSync(join(HERE, "fixtures", `${name}.json`), "utf8"),
  );
  return migrateDocument(json);
}

const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

function pageInput(name: string, type: "landing" | "product" = "landing") {
  return {
    id: `page_${name}`,
    handle: name,
    type,
    source: loadFixture(name),
    updatedAt: FIXED_UPDATED_AT,
    // Product pages require a productId post-segment-5; landing pages
    // ignore the field. Provide a stub productId for product fixtures.
    ...(type === "product"
      ? { productId: "gid://shopify/Product/1" }
      : {}),
  };
}

/** Strip per-run fields so snapshots are stable. */
function snapshottable(result: Awaited<ReturnType<typeof compilePage>>) {
  const { metrics: _metrics, ...rest } = result;
  void _metrics;
  const { compiledAt: _compiledAt, ...artifactRest } = rest.artifact;
  void _compiledAt;
  return { ...rest, artifact: artifactRest };
}

describe("compilePage — snapshots", () => {
  for (const name of FIXTURES) {
    it(`fixture: ${name}`, async () => {
      const result = await compilePage(pageInput(name));
      matchSnapshot(name, snapshottable(result));
    });
  }
});

describe("compilePage — determinism", () => {
  it("two compiles of the same source produce identical contentHashes", async () => {
    const a = await compilePage(pageInput("kitchen-sink"));
    const b = await compilePage(pageInput("kitchen-sink"));
    assert.strictEqual(a.artifact.files.length, b.artifact.files.length);
    for (let i = 0; i < a.artifact.files.length; i++) {
      assert.strictEqual(
        a.artifact.files[i].contentHash,
        b.artifact.files[i].contentHash,
        `mismatch at ${a.artifact.files[i].path}`,
      );
      assert.strictEqual(
        a.artifact.files[i].content,
        b.artifact.files[i].content,
        `content mismatch at ${a.artifact.files[i].path}`,
      );
    }
  });

  it("kitchen-sink-responsive bakes overrides into per-block style settings", async () => {
    const result = await compilePage(pageInput("kitchen-sink-responsive"));
    const tpl = result.artifact.files.find((f) => f.purpose === "template");
    assert.ok(tpl);
    const json = JSON.parse(tpl.content);
    const heroEntry = json.sections["main-blk_hero"];
    assert.ok(heroEntry, "expected hero section in page template");
    // Hero has a tablet padding override → non-empty tablet_styles.
    assert.ok(
      typeof heroEntry.settings.tablet_styles === "string" &&
        heroEntry.settings.tablet_styles.length > 0,
      `expected tablet_styles; got: ${heroEntry.settings.tablet_styles}`,
    );
    // Hero has a desktop alignment override → non-empty desktop_styles.
    assert.ok(
      typeof heroEntry.settings.desktop_styles === "string" &&
        heroEntry.settings.desktop_styles.length > 0,
    );
  });

  it("empty page emits exactly one file (the page template)", async () => {
    const result = await compilePage(pageInput("empty-landing"));
    assert.strictEqual(result.artifact.files.length, 1);
    assert.strictEqual(result.artifact.files[0].purpose, "template");
  });

  it("section files are shared (one per used type, not one per block)", async () => {
    // Build a fixture-like input with TWO heros — should still emit a
    // single sections/demeurer-hero.liquid file.
    const source = migrateDocument({
      version: 2,
      blocks: [
        { id: "blk_hero_a", type: "hero", props: { mobile: {} }, children: [] },
        { id: "blk_hero_b", type: "hero", props: { mobile: {} }, children: [] },
      ],
    });
    const result = await compilePage({
      id: "p1",
      handle: "two-heros",
      type: "landing",
      source,
      updatedAt: FIXED_UPDATED_AT,
    });
    const sectionFiles = result.artifact.files.filter((f) => f.purpose === "section");
    assert.strictEqual(sectionFiles.length, 1);
    assert.strictEqual(sectionFiles[0].path, "sections/demeurer-hero.liquid");
  });

  it("product page type writes to templates/product.demeurer-{handle}.json", async () => {
    const result = await compilePage(pageInput("hero-only", "product"));
    const tpl = result.artifact.files.find((f) => f.purpose === "template");
    assert.ok(tpl);
    assert.match(tpl.path, /^templates\/product\.demeurer-hero-only\.json$/);
    assert.strictEqual(result.artifact.pageType, "product");
  });
});
