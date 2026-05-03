import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { getShopFromRequest } from "../lib/shop.server";

/**
 * Resource route: GET /app/api/pages/:id/versions
 *
 * Lists PageVersion rows for the page, newest first, capped at 50.
 * Verifies shop ownership before returning anything — never leak the
 * existence of a page (or its history) to a different shop.
 *
 * Why 50: history grows indefinitely as the autosave snapshots over
 * time. 50 is enough to cover a long editing session; deeper history
 * is a future concern (pagination + retention policy).
 */

const VERSION_LIMIT = 50;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shop = await getShopFromRequest(request);

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const owner = await db.page.findUnique({
    where: { id },
    select: { shop: true },
  });
  if (!owner || owner.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await db.pageVersion.findMany({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    take: VERSION_LIMIT,
    select: {
      id: true,
      label: true,
      createdAt: true,
      source: true,
    },
  });

  return Response.json({
    versions: versions.map((v) => ({
      id: v.id,
      label: v.label,
      createdAt: v.createdAt.toISOString(),
      source: v.source,
    })),
  });
};
