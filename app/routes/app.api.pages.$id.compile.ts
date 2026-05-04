import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { compilePage } from "../lib/compile/compile";
import { migrateDocument } from "../lib/editor/types";
import { getShopFromRequest } from "../lib/shop.server";

/**
 * Resource route: GET /app/api/pages/:id/compile
 *
 * Runs the pure-functional compile pipeline against the page's current
 * source and returns the resulting CompileResult. NEVER writes to a
 * theme — this endpoint is for editor preview and engineer inspection
 * only. The actual theme write lives in P1.D segment 2.
 *
 * Verifies shop ownership before doing anything, same as every other
 * page-scoped API.
 */

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shop = await getShopFromRequest(request);

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const page = await db.page.findUnique({ where: { id } });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Page.source is JSON in the DB. Run the v1→v2 migration defensively
  // so old documents compile correctly.
  const source = migrateDocument(page.source);

  const pageType: "landing" | "product" =
    page.type === "product" ? "product" : "landing";

  const result = await compilePage({
    id: page.id,
    handle: page.handle,
    type: pageType,
    source,
    updatedAt: page.updatedAt,
  });

  return Response.json(result);
};
