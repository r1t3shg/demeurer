/**
 * Tests for the `themes/publish` webhook handler.
 *
 * Targets the pure `applyThemePublishWebhook` function with an
 * in-memory db stub that mimics Prisma's `updateMany` semantics for
 * the single query the handler issues.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyThemePublishWebhook,
  type ThemePublishDb,
} from "../webhook-themes-publish.ts";

interface MockPage {
  id: string;
  shop: string;
  publishedAt: Date | null;
  themeId: string | null;
  themeMismatch: boolean;
}

function makeDb(pages: MockPage[]): {
  db: ThemePublishDb;
  pages: MockPage[];
} {
  const db: ThemePublishDb = {
    page: {
      async updateMany(args) {
        let count = 0;
        for (const p of pages) {
          if (p.shop !== args.where.shop) continue;
          // Translate the loose typing on the where clause for the test.
          const wherePublished = args.where.publishedAt as { not: null };
          if (wherePublished.not === null && p.publishedAt === null) continue;
          // themeId filter: `not: <gid>` matches when actual !== gid AND
          // actual is not null (Prisma's null semantics — null doesn't
          // match "not equal to a value").
          const wt = args.where.themeId as { not: string };
          if (typeof wt.not === "string") {
            if (p.themeId === null) continue;
            if (p.themeId === wt.not) continue;
          }
          p.themeMismatch = true;
          count++;
        }
        return { count };
      },
    },
  };
  return { db, pages };
}

const SHOP = "themepub.myshopify.com";

describe("applyThemePublishWebhook", () => {
  it("scenario 1: two stale pages → both flagged", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
      {
        id: "b",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
    ]);
    const result = await applyThemePublishWebhook(db, SHOP, { id: 2 });
    assert.strictEqual(result.flaggedCount, 2);
    assert.strictEqual(result.newThemeGid, "gid://shopify/OnlineStoreTheme/2");
    assert.ok(pages.every((p) => p.themeMismatch));
  });

  it("scenario 2: one page on the new theme → that page skipped", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/2", // already on new theme
        themeMismatch: false,
      },
      {
        id: "b",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1", // stale
        themeMismatch: false,
      },
    ]);
    await applyThemePublishWebhook(db, SHOP, { id: 2 });
    assert.strictEqual(pages.find((p) => p.id === "a")!.themeMismatch, false);
    assert.strictEqual(pages.find((p) => p.id === "b")!.themeMismatch, true);
  });

  it("scenario 3: page with no themeId (never published) → not touched", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: null,
        themeId: null,
        themeMismatch: false,
      },
    ]);
    await applyThemePublishWebhook(db, SHOP, { id: 2 });
    assert.strictEqual(pages[0].themeMismatch, false);
  });

  it("scenario 4: unpublished page → not touched even if themeId set", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: null,
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
    ]);
    await applyThemePublishWebhook(db, SHOP, { id: 2 });
    assert.strictEqual(pages[0].themeMismatch, false);
  });

  it("scenario 5: malformed payload (no id) → no-op, returns null gid", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
    ]);
    const result = await applyThemePublishWebhook(db, SHOP, { name: "Sense" });
    assert.strictEqual(result.flaggedCount, 0);
    assert.strictEqual(result.newThemeGid, null);
    assert.strictEqual(pages[0].themeMismatch, false);
  });

  it("scenario 6: numeric-string id is accepted defensively", async () => {
    const { db } = makeDb([]);
    const result = await applyThemePublishWebhook(db, SHOP, { id: "42" });
    assert.strictEqual(result.newThemeGid, "gid://shopify/OnlineStoreTheme/42");
  });

  it("scenario 7: only flags pages on the same shop", async () => {
    const { db, pages } = makeDb([
      {
        id: "a",
        shop: SHOP,
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
      {
        id: "b",
        shop: "other.myshopify.com",
        publishedAt: new Date(),
        themeId: "gid://shopify/OnlineStoreTheme/1",
        themeMismatch: false,
      },
    ]);
    await applyThemePublishWebhook(db, SHOP, { id: 2 });
    assert.strictEqual(pages.find((p) => p.id === "a")!.themeMismatch, true);
    assert.strictEqual(pages.find((p) => p.id === "b")!.themeMismatch, false);
  });

  it("scenario 8: null payload → no-op", async () => {
    const { db } = makeDb([]);
    const result = await applyThemePublishWebhook(db, SHOP, null);
    assert.strictEqual(result.flaggedCount, 0);
    assert.strictEqual(result.newThemeGid, null);
  });
});
