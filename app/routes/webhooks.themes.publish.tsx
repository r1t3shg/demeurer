import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { applyThemePublishWebhook } from "../lib/theme/webhook-themes-publish";
import { authenticate } from "../shopify.server";

/**
 * Webhook: themes/publish
 *
 * Fires when the merchant changes their MAIN theme. The new theme
 * doesn't have any Demeurer-owned files yet, so any Page that was
 * published to a previous theme will render broken (or not at all)
 * until the merchant re-publishes.
 *
 * We don't auto-republish — the architectural commitment is that we
 * never surprise the merchant. Instead we mark `Page.themeMismatch
 * = true` on every published page whose `themeId` differs from the
 * new MAIN. The editor banner and pages-list indicator surface the
 * issue; the merchant chooses to re-publish (or dismiss).
 *
 * Defense in depth: even if this webhook misses or has a payload
 * shape change, segment 2's drift detection on the next publish
 * will surface the same condition.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const result = await applyThemePublishWebhook(
    db,
    shop,
    payload as Parameters<typeof applyThemePublishWebhook>[2],
  );

  // eslint-disable-next-line no-console
  console.log(
    `Received ${topic} webhook for ${shop} — flagged ${result.flaggedCount} ` +
      `page(s) with themeMismatch (new theme: ${result.newThemeGid ?? "unparseable"})`,
  );

  return new Response();
};
