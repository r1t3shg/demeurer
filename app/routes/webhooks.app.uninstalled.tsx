import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * APP UNINSTALL WEBHOOK — INTENTIONALLY NON-DESTRUCTIVE.
 *
 * Demeurer's four architectural commitments:
 *
 *   1. When the merchant uninstalls or cancels, pages KEEP RENDERING unchanged.
 *      The editor goes read-only on cancel; pages stay live forever.
 *   2. No runtime JavaScript injection from our servers. Zero page-speed penalty.
 *   3. Pages survive theme updates because they ARE the theme.
 *   4. If you find yourself writing code that violates 1–3, stop.
 *
 * Because pages are compiled to native Liquid section files that live INSIDE
 * the merchant's theme, an uninstall must NOT:
 *   - delete or modify any files in the merchant's theme (no Asset API writes/deletes)
 *   - delete `Page` rows (the editor source-of-truth for re-install / re-publish)
 *   - delete `PageVersion` rows (version history must outlive the install lifecycle)
 *   - touch any merchant data — period.
 *
 * The ONLY thing we drop is our own OAuth session record. The merchant's
 * theme keeps rendering Demeurer pages exactly as they were on the day of
 * uninstall, with no dependency on our servers.
 *
 * If a future change to this handler ever needs to touch theme files or
 * page/version rows, that change is wrong. Stop and re-read commitments 1–4.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop} — non-destructive uninstall ` +
      `(theme files, Page rows, and PageVersion rows are intentionally preserved)`,
  );

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
