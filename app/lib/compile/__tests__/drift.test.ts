/**
 * Drift detection tests.
 *
 * Uses a mocked admin client (`app/lib/theme/__mocks__/admin.ts`) so
 * tests don't hit a real Shopify dev store. The compile pipeline runs
 * for real over a small fixture and feeds its artifact into
 * `detectDrift`.
 *
 * Covers the seven scenarios from the segment 2 plan:
 *   1. empty theme → all artifact files are "new"
 *   2. all hashes match → all "unchanged"
 *   3. one differs, no ThemeWrite record → modified+stale
 *   4. one differs, ThemeWrite hash !== theme hash → modified+drifted
 *   5. one differs, ThemeWrite hash === theme hash → modified+tracked
 *   6. theme has extra demeurer files → those become orphans
 *   7. line-ending difference is currently flagged as drift (no
 *      normalization yet) — documents the trade-off
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { compilePage } from "../compile.ts";
import {
  classifyConflicts,
  type ConflictSeverity,
} from "../conflict-severity.ts";
import { detectDrift } from "../drift.ts";
import { md5Hex } from "../md5.ts";
import { migrateDocument } from "../../editor/types.ts";
import {
  clearListDemeurerFilesCache,
} from "../../theme/client.server.ts";
import {
  makeMockAdmin,
  type MockTheme,
  type MockThemeFile,
} from "../../theme/__mocks__/admin.ts";

const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

async function compileHeroFixture() {
  const source = migrateDocument({
    version: 2,
    blocks: [
      {
        id: "blk_hero_aaaaaaaa",
        type: "hero",
        props: { mobile: {} },
        children: [],
      },
    ],
  });
  return compilePage({
    id: "page_hero",
    handle: "hero-only",
    type: "landing",
    source,
    updatedAt: FIXED_UPDATED_AT,
  });
}

function makeFile(path: string, content: string): MockThemeFile {
  return {
    path,
    content,
    contentMd5: md5Hex(content),
    size: content.length,
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function makeTheme(files: MockThemeFile[]): MockTheme {
  return {
    id: "gid://shopify/OnlineStoreTheme/1",
    name: "Dawn (test)",
    role: "MAIN",
    files,
  };
}

/** Always clear the 30s list cache between tests so each scenario is fresh. */
function clearCaches() {
  clearListDemeurerFilesCache();
}

describe("detectDrift", () => {
  it("scenario 1: empty theme → every artifact file is new", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const admin = makeMockAdmin(makeTheme([]));
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    assert.strictEqual(drift.newFiles.length, result.artifact.files.length);
    assert.strictEqual(drift.unchangedFiles.length, 0);
    assert.strictEqual(drift.modifiedFiles.length, 0);
    assert.strictEqual(drift.orphanFiles.length, 0);
    assert.strictEqual(drift.hasDrift, false);
    const severity = classifyConflicts(drift);
    assert.strictEqual<ConflictSeverity>(severity.severity, "none");
  });

  it("scenario 2: theme matches artifact for every file → all unchanged", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const themeFiles = result.artifact.files.map((f) => makeFile(f.path, f.content));
    const admin = makeMockAdmin(makeTheme(themeFiles));
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    assert.strictEqual(drift.newFiles.length, 0);
    assert.strictEqual(drift.modifiedFiles.length, 0);
    assert.strictEqual(drift.unchangedFiles.length, result.artifact.files.length);
    assert.strictEqual(drift.hasDrift, false);
  });

  it("scenario 3: one differs, no ThemeWrite record → stale", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const sectionFile = result.artifact.files.find((f) => f.purpose === "section")!;
    // Theme has the section file but with different content; templates
    // and any other files match.
    const themeFiles = result.artifact.files.map((f) =>
      f.path === sectionFile.path
        ? makeFile(f.path, f.content + "\n<!-- merchant edit -->")
        : makeFile(f.path, f.content),
    );
    const admin = makeMockAdmin(makeTheme(themeFiles));
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath: new Map(), // no records yet
    });
    assert.strictEqual(drift.modifiedFiles.length, 1);
    const mod = drift.modifiedFiles[0];
    assert.strictEqual(mod.path, sectionFile.path);
    assert.strictEqual(mod.classification, "stale");
    assert.strictEqual(drift.hasDrift, false);
    const severity = classifyConflicts(drift);
    assert.strictEqual<ConflictSeverity>(severity.severity, "minor");
  });

  it("scenario 4: ThemeWrite hash !== theme hash → drifted (major severity)", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const sectionFile = result.artifact.files.find((f) => f.purpose === "section")!;
    const themeContent = sectionFile.content + "\n<!-- merchant edit -->";
    const themeFiles = result.artifact.files.map((f) =>
      f.path === sectionFile.path ? makeFile(f.path, themeContent) : makeFile(f.path, f.content),
    );
    const admin = makeMockAdmin(makeTheme(themeFiles));
    // Pretend we wrote a different hash earlier (the original artifact
    // content). Theme has been edited since.
    const writesByPath = new Map([
      [sectionFile.path, { contentHash: md5Hex(sectionFile.content) }],
    ]);
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath,
    });
    assert.strictEqual(drift.modifiedFiles.length, 1);
    assert.strictEqual(drift.modifiedFiles[0].classification, "drifted");
    assert.strictEqual(drift.hasDrift, true);
    const severity = classifyConflicts(drift);
    assert.strictEqual<ConflictSeverity>(severity.severity, "major");
  });

  it("scenario 5: ThemeWrite hash === theme hash, artifact differs → tracked (none severity)", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const tplFile = result.artifact.files.find((f) => f.purpose === "template")!;
    // Theme has older content; the artifact reflects new edits the
    // merchant made in Demeurer. ThemeWrite recorded the previous
    // publish (= what's in the theme today).
    const olderThemeContent = '{"sections":{},"order":[]}\n';
    const themeFiles = result.artifact.files.map((f) =>
      f.path === tplFile.path ? makeFile(f.path, olderThemeContent) : makeFile(f.path, f.content),
    );
    const admin = makeMockAdmin(makeTheme(themeFiles));
    const writesByPath = new Map([
      [tplFile.path, { contentHash: md5Hex(olderThemeContent) }],
    ]);
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath,
    });
    assert.strictEqual(drift.modifiedFiles.length, 1);
    assert.strictEqual(drift.modifiedFiles[0].classification, "tracked");
    assert.strictEqual(drift.hasDrift, false);
    const severity = classifyConflicts(drift);
    // Tracked is the normal publish path — should be `none` severity.
    assert.strictEqual<ConflictSeverity>(severity.severity, "none");
  });

  it("scenario 6: theme has extra demeurer-* files → orphans (minor severity)", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const themeFiles = result.artifact.files.map((f) => makeFile(f.path, f.content));
    themeFiles.push(makeFile("sections/demeurer-cta-band.liquid", "<!-- old -->"));
    themeFiles.push(makeFile("templates/page.demeurer-old-page.json", "{}"));
    const admin = makeMockAdmin(makeTheme(themeFiles));
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    assert.strictEqual(drift.orphanFiles.length, 2);
    assert.strictEqual(drift.modifiedFiles.length, 0);
    const severity = classifyConflicts(drift);
    assert.strictEqual<ConflictSeverity>(severity.severity, "minor");
  });

  it("scenario 7: identical content but with \\r\\n line endings is flagged as drift (no normalization)", async () => {
    clearCaches();
    const result = await compileHeroFixture();
    const sectionFile = result.artifact.files.find((f) => f.purpose === "section")!;
    // Same logical content, different line endings.
    const crlfContent = sectionFile.content.replace(/\n/g, "\r\n");
    const themeFiles = result.artifact.files.map((f) =>
      f.path === sectionFile.path ? makeFile(f.path, crlfContent) : makeFile(f.path, f.content),
    );
    const admin = makeMockAdmin(makeTheme(themeFiles));
    const drift = await detectDrift({
      admin,
      shop: "test.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "Dawn (test)",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    assert.strictEqual(drift.modifiedFiles.length, 1);
    assert.strictEqual(drift.modifiedFiles[0].path, sectionFile.path);
    // Documents the current behavior — we DON'T normalize line endings,
    // so this is "stale" drift. If we add normalization later, this
    // assertion flips to "unchanged" and the test serves as the gate.
  });
});

describe("detectDrift caching", () => {
  it("listDemeurerFiles cache is per-(shop, themeId)", async () => {
    clearCaches();
    let calls = 0;
    const admin = {
      async graphql(query: string, _options?: { variables?: Record<string, unknown> }) {
        calls++;
        if (query.includes("DemeurerListThemeFiles")) {
          return {
            status: 200,
            async json() {
              return {
                data: {
                  theme: {
                    id: "gid://shopify/OnlineStoreTheme/1",
                    files: {
                      edges: [],
                      pageInfo: { endCursor: null, hasNextPage: false },
                      userErrors: [],
                    },
                  },
                },
              };
            },
          };
        }
        return { status: 200, async json() { return { data: {} }; } };
      },
    };
    const result = await compileHeroFixture();
    await detectDrift({
      admin,
      shop: "shop-a.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "T",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    const callsAfterFirst = calls;
    await detectDrift({
      admin,
      shop: "shop-a.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/1",
      themeName: "T",
      artifact: result.artifact,
      writesByPath: new Map(),
    });
    // Second call hits the 30s cache — no new admin.graphql.
    assert.strictEqual(calls, callsAfterFirst);
  });
});
