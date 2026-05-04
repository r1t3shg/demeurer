/**
 * Apply pipeline tests.
 *
 * Exercises `applyArtifact` end-to-end with the mock admin client.
 * Uses a tiny in-memory `ThemeWriteStore` stub to keep tests pure
 * (no real DB).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { applyArtifact, type ThemeWriteStore } from "../apply.ts";
import { compilePage } from "../compile.ts";
import { md5Hex } from "../md5.ts";
import { migrateDocument } from "../../editor/types.ts";
import {
  makeMockAdmin,
  type MockSimulateFailure,
  type MockTheme,
  type MockThemeFile,
} from "../../theme/__mocks__/admin.ts";
import { clearListDemeurerFilesCache } from "../../theme/client.server.ts";
import { clearRateLimiterState } from "../../theme/rate-limiter.server.ts";
import {
  clearPublishLocks,
  isPublishLocked,
  PublishInProgressError,
  withPublishLock,
} from "../publish-lock.server.ts";

const SHOP = "apply-test.myshopify.com";
const THEME_ID = "gid://shopify/OnlineStoreTheme/1";
const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

interface MockWriteRow {
  shop: string;
  themeId: string;
  path: string;
  contentHash: string;
  pageId: string | null;
  writtenAt: Date;
}

function makeStore(initial: MockWriteRow[] = []): {
  db: ThemeWriteStore;
  rows: MockWriteRow[];
} {
  const rows: MockWriteRow[] = [...initial];
  const db: ThemeWriteStore = {
    themeWrite: {
      async upsert(args) {
        const { shop, themeId, path } = args.where.shop_themeId_path;
        const idx = rows.findIndex(
          (r) => r.shop === shop && r.themeId === themeId && r.path === path,
        );
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...args.update };
        } else {
          rows.push({ ...args.create });
        }
        return rows[idx >= 0 ? idx : rows.length - 1];
      },
    },
  };
  return { db, rows };
}

function emptyTheme(): MockTheme {
  return { id: THEME_ID, name: "Dawn (test)", role: "MAIN", files: [] };
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

function clearAll() {
  clearListDemeurerFilesCache();
  clearRateLimiterState();
  clearPublishLocks();
}

describe("applyArtifact", () => {
  it("scenario 1: empty theme + new page → all files written, ThemeWrite rows created", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    const theme = emptyTheme();
    const admin = makeMockAdmin(theme);
    const { db, rows } = makeStore();

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath: new Map(),
      db,
    });

    assert.strictEqual(result.status, "success");
    assert.strictEqual(result.failed.length, 0);
    assert.strictEqual(result.written.length, compileResult.artifact.files.length);
    assert.strictEqual(rows.length, compileResult.artifact.files.length);
    // Section file gets pageId=null; template gets pageId set.
    const sectionRow = rows.find((r) => r.path.startsWith("sections/"))!;
    const templateRow = rows.find((r) => r.path.startsWith("templates/"))!;
    assert.strictEqual(sectionRow.pageId, null);
    assert.strictEqual(templateRow.pageId, "page_hero");
    // Mock theme reflects the writes.
    assert.strictEqual(theme.files.length, compileResult.artifact.files.length);
  });

  it("scenario 2: re-publish unchanged page → 0 writes, all skipped", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    // Pre-populate the theme with the artifact's bytes.
    const theme: MockTheme = {
      id: THEME_ID,
      name: "Dawn (test)",
      role: "MAIN",
      files: compileResult.artifact.files.map((f) => makeFile(f.path, f.content)),
    };
    const admin = makeMockAdmin(theme);
    const { db, rows } = makeStore();

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath: new Map(),
      db,
    });

    assert.strictEqual(result.status, "success");
    assert.strictEqual(result.written.length, 0);
    assert.strictEqual(result.failed.length, 0);
    assert.strictEqual(result.skipped.length, compileResult.artifact.files.length);
    assert.strictEqual(rows.length, 0); // no writes means no ThemeWrite rows
  });

  it("scenario 3: drift on a section, no acceptDrift → drift_blocked, nothing written", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    const sectionFile = compileResult.artifact.files.find(
      (f) => f.purpose === "section",
    )!;
    // Theme has the section file with EDITED content; no ThemeWrite
    // record means classification is "stale" — but spec says we should
    // simulate drifted (record exists, mismatched). Set up writesByPath
    // so the section file becomes "drifted".
    const themeContent = sectionFile.content + "\n<!-- merchant edit -->";
    const theme: MockTheme = {
      id: THEME_ID,
      name: "Dawn (test)",
      role: "MAIN",
      files: compileResult.artifact.files.map((f) =>
        f.path === sectionFile.path ? makeFile(f.path, themeContent) : makeFile(f.path, f.content),
      ),
    };
    const admin = makeMockAdmin(theme);
    const { db, rows } = makeStore();
    // Pretend we wrote the original artifact bytes earlier; theme now
    // has different bytes → drifted.
    const writesByPath = new Map([
      [sectionFile.path, { contentHash: md5Hex(sectionFile.content) }],
    ]);

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath,
      db,
    });

    assert.strictEqual(result.status, "drift_blocked");
    assert.strictEqual(result.written.length, 0);
    assert.ok(result.driftReport);
    assert.strictEqual(rows.length, 0);
    // Theme contents unchanged.
    assert.strictEqual(
      theme.files.find((f) => f.path === sectionFile.path)?.content,
      themeContent,
    );
  });

  it("scenario 4: drift on a section + acceptDrift: true → overwrite, ThemeWrite updated", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    const sectionFile = compileResult.artifact.files.find(
      (f) => f.purpose === "section",
    )!;
    const themeContent = sectionFile.content + "\n<!-- merchant edit -->";
    const theme: MockTheme = {
      id: THEME_ID,
      name: "Dawn (test)",
      role: "MAIN",
      files: compileResult.artifact.files.map((f) =>
        f.path === sectionFile.path ? makeFile(f.path, themeContent) : makeFile(f.path, f.content),
      ),
    };
    const admin = makeMockAdmin(theme);
    const oldHash = md5Hex(sectionFile.content);
    const { db, rows } = makeStore([
      {
        shop: SHOP,
        themeId: THEME_ID,
        path: sectionFile.path,
        contentHash: oldHash,
        pageId: null,
        writtenAt: new Date("2025-12-01"),
      },
    ]);
    const writesByPath = new Map([
      [sectionFile.path, { contentHash: oldHash }],
    ]);

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath,
      db,
      options: { acceptDrift: true },
    });

    assert.strictEqual(result.status, "success");
    // Theme now reflects the artifact's bytes again.
    assert.strictEqual(
      theme.files.find((f) => f.path === sectionFile.path)?.content,
      sectionFile.content,
    );
    // ThemeWrite row's hash updated to the artifact's md5.
    const updated = rows.find((r) => r.path === sectionFile.path)!;
    assert.strictEqual(updated.contentHash, md5Hex(sectionFile.content));
  });

  it("scenario 5: section write fails → phase B + C skipped, partial_failure", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    const sectionFile = compileResult.artifact.files.find(
      (f) => f.purpose === "section",
    )!;
    const templateFile = compileResult.artifact.files.find(
      (f) => f.purpose === "template",
    )!;
    const theme = emptyTheme();
    const failures: Record<string, MockSimulateFailure> = {
      [sectionFile.path]: { code: "INVALID", message: "Boom" },
    };
    const admin = makeMockAdmin(theme, { simulateFailures: failures });
    const { db, rows } = makeStore();

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath: new Map(),
      db,
    });

    assert.strictEqual(result.status, "partial_failure");
    assert.strictEqual(result.failed.length, 1);
    assert.strictEqual(result.failed[0].path, sectionFile.path);
    // Template MUST NOT have been attempted — the theme should have
    // no template file.
    assert.strictEqual(
      theme.files.some((f) => f.path === templateFile.path),
      false,
    );
    // No ThemeWrite row for the failed section either.
    assert.strictEqual(
      rows.some((r) => r.path === sectionFile.path),
      false,
    );
  });

  it("scenario 6: lock contention rejects the second concurrent publish", async () => {
    clearAll();
    let releaseFirst: () => void = () => {};
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstHold = new Promise<void>((resolve) => {
      // Used to release the lock — first call awaits this.
      void resolve;
    });
    let releaseHold: () => void = () => {};
    const holdLock = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    void firstHold;

    const first = withPublishLock(SHOP, "page_hero", async () => {
      // Signal we have the lock, then wait until released.
      releaseFirst();
      await holdLock;
      return "first done";
    });

    await firstStarted;
    assert.strictEqual(isPublishLocked(SHOP, "page_hero"), true);

    let secondError: unknown = null;
    try {
      await withPublishLock(SHOP, "page_hero", async () => "second");
    } catch (err) {
      secondError = err;
    }
    assert.ok(secondError instanceof PublishInProgressError);

    releaseHold();
    await first;
    assert.strictEqual(isPublishLocked(SHOP, "page_hero"), false);
  });

  it("scenario 7: phase ordering — sections written before templates", async () => {
    clearAll();
    const compileResult = await compileHeroFixture();
    const recordWrites: Array<{ filenames: string[] }> = [];
    const theme = emptyTheme();
    const admin = makeMockAdmin(theme, { recordWrites });
    const { db } = makeStore();

    const result = await applyArtifact({
      admin,
      shop: SHOP,
      pageId: "page_hero",
      artifact: compileResult.artifact,
      writesByPath: new Map(),
      db,
    });

    assert.strictEqual(result.status, "success");
    // Two upsert calls: phase A (sections) then phase C (templates).
    assert.strictEqual(recordWrites.length, 2);
    // Phase A only contains section files.
    for (const filename of recordWrites[0].filenames) {
      assert.ok(filename.startsWith("sections/"), `phase A had non-section: ${filename}`);
    }
    // Phase C only contains template files.
    for (const filename of recordWrites[1].filenames) {
      assert.ok(filename.startsWith("templates/"), `phase C had non-template: ${filename}`);
    }
  });
});
