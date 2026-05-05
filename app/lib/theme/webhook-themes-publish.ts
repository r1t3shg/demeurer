/**
 * Pure handler for the `themes/publish` webhook.
 *
 * Extracted from the route into a dependency-injected function so
 * tests can target the logic directly without mocking
 * `authenticate.webhook`. Same pattern segment 3 used for
 * `applyArtifact` + `ThemeWriteStore`.
 *
 * Behavior:
 *   - Parses the new MAIN theme's id from the payload (numeric, per
 *     Shopify REST webhook convention) and converts to the gid form
 *     `gid://shopify/OnlineStoreTheme/{id}` so it matches what
 *     `getPublishedTheme` returns from GraphQL.
 *   - Marks `themeMismatch = true` on every published page in the
 *     shop whose `themeId` is set AND differs from the new gid.
 *   - Defensive: malformed payload → no-op, returns the count of
 *     pages flagged (zero in that case).
 */

/** Minimal db surface needed by the handler. */
export interface ThemePublishDb {
  page: {
    updateMany(args: {
      where: {
        shop: string;
        publishedAt: { not: null };
        themeId: { not: null } | { not: string } | { notIn: string[] };
      };
      data: { themeMismatch: true };
    }): Promise<{ count: number }>;
  };
}

export interface ThemePublishPayload {
  id?: unknown;
  name?: unknown;
  role?: unknown;
}

export interface ApplyThemePublishResult {
  /** Number of pages newly flagged. May be 0. */
  flaggedCount: number;
  /** The gid we resolved (or null if payload was unparseable). */
  newThemeGid: string | null;
}

export async function applyThemePublishWebhook(
  db: ThemePublishDb,
  shop: string,
  payload: ThemePublishPayload | null,
): Promise<ApplyThemePublishResult> {
  if (!payload || typeof payload !== "object") {
    return { flaggedCount: 0, newThemeGid: null };
  }
  // Shopify's REST webhook payload for theme topics carries `id` as a
  // numeric value. Coerce defensively.
  const rawId = payload.id;
  const numericId =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? String(rawId)
      : typeof rawId === "string" && /^\d+$/.test(rawId)
        ? rawId
        : null;
  if (!numericId) {
    return { flaggedCount: 0, newThemeGid: null };
  }
  const newThemeGid = `gid://shopify/OnlineStoreTheme/${numericId}`;

  // Mark every published page on a different theme as mismatched.
  // Prisma's `not` filter on a nullable column matches non-null rows
  // whose value differs — exactly what we want.
  const res = await db.page.updateMany({
    where: {
      shop,
      publishedAt: { not: null },
      themeId: { not: newThemeGid },
    },
    data: { themeMismatch: true },
  });

  return { flaggedCount: res.count, newThemeGid };
}
