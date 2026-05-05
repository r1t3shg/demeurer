import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Resource route: POST /app/api/pages/:id/acknowledge-mismatch
 *
 * Dismisses the theme-mismatch banner for one page by clearing
 * `Page.themeMismatch`. Semantics: "I've seen the warning and I'm
 * deliberately leaving this page on the previous theme; stop
 * showing the banner." If the merchant later switches themes
 * AGAIN, the `themes/publish` webhook re-flags the page and the
 * banner returns.
 *
 * Does NOT touch `Page.themeId` — the page is still recorded as
 * published to whatever theme it last published to.
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
    data: { themeMismatch: false },
  });

  return Response.json({ ok: true });
};
