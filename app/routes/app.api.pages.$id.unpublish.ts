import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Resource route: POST /app/api/pages/:id/unpublish
 *
 * Marks the page as unpublished by clearing `Page.publishedAt`.
 *
 * INTENTIONALLY does NOT delete any theme files. The architectural
 * commitment (commitment #1) says: when the merchant uninstalls or
 * cancels, pages KEEP RENDERING. Same logic applies on unpublish — we
 * don't destroy. The page template stays in the theme, harmless and
 * unrouted unless the merchant manually points at it. The merchant
 * can delete via the theme code editor if they want; we don't.
 *
 * `Page.themeId` is intentionally PRESERVED so we remember where the
 * page lives if the merchant re-publishes (or if segment 4's webhook
 * handler needs to reconcile after a theme switch).
 */

export const action = async ({ params, request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const page = await db.page.findUnique({ where: { id } });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.page.update({
    where: { id: page.id },
    data: { publishedAt: null },
    // NOTE: themeId is intentionally not cleared.
  });

  return Response.json({ ok: true });
};
