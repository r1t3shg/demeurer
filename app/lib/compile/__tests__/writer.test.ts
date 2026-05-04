/**
 * Theme writer tests.
 *
 * Exercises `writeThemeFiles` against the mock admin:
 *   - single-file success returns the checksumMd5 from Shopify
 *   - 15 files chunk into two GraphQL calls (10 + 5)
 *   - per-file userErrors map to `success: false` with classification
 *   - HTTP 401 maps every file in the batch to `errorCode: "auth"`
 *   - bad_content classification covers INVALID / TOO_LARGE
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  makeMockAdmin,
  type MockTheme,
} from "../../theme/__mocks__/admin.ts";
import { md5Hex } from "../md5.ts";
import { writeThemeFiles } from "../../theme/writer.server.ts";
import { clearRateLimiterState } from "../../theme/rate-limiter.server.ts";

const SHOP = "writer-test.myshopify.com";
const THEME_ID = "gid://shopify/OnlineStoreTheme/1";

function emptyTheme(): MockTheme {
  return { id: THEME_ID, name: "Test theme", role: "MAIN", files: [] };
}

describe("writeThemeFiles", () => {
  it("success: returns the checksumMd5 from Shopify and mutates the mock theme", async () => {
    clearRateLimiterState();
    const theme = emptyTheme();
    const admin = makeMockAdmin(theme);
    const content = "<!-- hi -->";
    const results = await writeThemeFiles(admin, THEME_ID, SHOP, [
      { path: "sections/demeurer-hero.liquid", content },
    ]);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);
    assert.strictEqual(results[0].writtenHash, md5Hex(content));
    // Mock theme picked up the new file.
    assert.strictEqual(theme.files.length, 1);
    assert.strictEqual(theme.files[0].content, content);
  });

  it("batches 15 files into two GraphQL calls (10 + 5)", async () => {
    clearRateLimiterState();
    const theme = emptyTheme();
    const recordWrites: Array<{ filenames: string[] }> = [];
    const admin = makeMockAdmin(theme, { recordWrites });
    const files = Array.from({ length: 15 }, (_, i) => ({
      path: `sections/demeurer-bulk-${i}.liquid`,
      content: `<!-- ${i} -->`,
    }));
    const results = await writeThemeFiles(admin, THEME_ID, SHOP, files);
    assert.strictEqual(results.length, 15);
    assert.ok(results.every((r) => r.success));
    assert.strictEqual(recordWrites.length, 2);
    assert.strictEqual(recordWrites[0].filenames.length, 10);
    assert.strictEqual(recordWrites[1].filenames.length, 5);
  });

  it("per-file userError marks that file failed; other files in batch succeed", async () => {
    clearRateLimiterState();
    const theme = emptyTheme();
    const admin = makeMockAdmin(theme, {
      simulateFailures: {
        "sections/demeurer-bad.liquid": {
          code: "INVALID",
          message: "Liquid syntax error at line 1",
        },
      },
    });
    const results = await writeThemeFiles(admin, THEME_ID, SHOP, [
      { path: "sections/demeurer-good.liquid", content: "<!-- ok -->" },
      { path: "sections/demeurer-bad.liquid", content: "{% bad %}" },
    ]);
    const ok = results.find((r) => r.path.endsWith("-good.liquid"))!;
    const bad = results.find((r) => r.path.endsWith("-bad.liquid"))!;
    assert.strictEqual(ok.success, true);
    assert.strictEqual(bad.success, false);
    assert.strictEqual(bad.errorCode, "bad_content");
    assert.match(bad.error ?? "", /Liquid syntax error/);
  });

  it("HTTP 401 maps every file in the batch to errorCode 'auth'", async () => {
    clearRateLimiterState();
    const admin = makeMockAdmin(emptyTheme(), { forceHttpStatus: 401 });
    const results = await writeThemeFiles(admin, THEME_ID, SHOP, [
      { path: "sections/demeurer-a.liquid", content: "a" },
      { path: "sections/demeurer-b.liquid", content: "b" },
    ]);
    assert.strictEqual(results.length, 2);
    for (const r of results) {
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.errorCode, "auth");
    }
  });

  it("bad_content classification covers TOO_LARGE", async () => {
    clearRateLimiterState();
    const theme = emptyTheme();
    const admin = makeMockAdmin(theme, {
      simulateFailures: {
        "sections/demeurer-huge.liquid": {
          code: "TOO_LARGE",
          message: "File exceeds size limit",
        },
      },
    });
    const results = await writeThemeFiles(admin, THEME_ID, SHOP, [
      { path: "sections/demeurer-huge.liquid", content: "x".repeat(10) },
    ]);
    assert.strictEqual(results[0].errorCode, "bad_content");
  });
});
