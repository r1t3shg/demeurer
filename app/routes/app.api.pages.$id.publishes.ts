import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Resource route: GET /app/api/pages/:id/publishes
 *
 * Returns the last 50 `Publish` rows for the page, newest first.
 * Powers the publish-history drawer in the editor.
 */

const HISTORY_LIMIT = 50;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const page = await db.page.findUnique({
    where: { id },
    select: { shop: true },
  });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const publishes = await db.publish.findMany({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      themeName: true,
      status: true,
      fileCount: true,
      failedPaths: true,
      createdAt: true,
    },
  });

  return Response.json({
    publishes: publishes.map((p) => ({
      id: p.id,
      themeName: p.themeName,
      status: p.status,
      fileCount: p.fileCount,
      failedPaths: p.failedPaths ? JSON.parse(p.failedPaths) : null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
};
