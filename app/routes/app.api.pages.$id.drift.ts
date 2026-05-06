import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { compilePage } from "../lib/compile/compile.ts";
import { classifyConflicts } from "../lib/compile/conflict-severity.ts";
import { detectDrift } from "../lib/compile/drift.ts";
import { migrateDocument } from "../lib/editor/types.ts";
import { authenticate } from "../shopify.server";
import { getPublishedTheme } from "../lib/theme/client.server.ts";

/**
 * Resource route: GET /app/api/pages/:id/drift
 *
 * Compiles the page (P1.D segment 1), fetches the published theme's
 * current Demeurer-owned files (segment 2), and returns a DriftReport
 * + ConflictAssessment. NEVER writes to a theme — segment 3's job.
 *
 * Hydrates `writesByPath` from `ThemeWrite` so segment 2's drift
 * classification can distinguish:
 *   - drifted (theme changed since we wrote it),
 *   - tracked (theme matches our last write — clean publish),
 *   - stale (no record).
 */

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const page = await db.page.findUnique({ where: { id } });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const source = migrateDocument(page.source);
  const pageType: "landing" | "product" =
    page.type === "product" ? "product" : "landing";

  const compileResult = await compilePage({
    id: page.id,
    handle: page.handle,
    type: pageType,
    source,
    updatedAt: page.updatedAt,
    productId: page.productId,
  });

  const theme = await getPublishedTheme(admin, shop);
  if (!theme) {
    return Response.json({ error: "No published theme" }, { status: 404 });
  }

  // Hydrate writesByPath from the ThemeWrite table for this shop+theme.
  const writes = await db.themeWrite.findMany({
    where: { shop, themeId: theme.id },
    select: { path: true, contentHash: true },
  });
  const writesByPath = new Map(
    writes.map((w) => [w.path, { contentHash: w.contentHash }]),
  );

  const drift = await detectDrift({
    admin,
    shop,
    themeId: theme.id,
    themeName: theme.name,
    artifact: compileResult.artifact,
    writesByPath,
  });

  return Response.json({
    artifact: compileResult.artifact,
    drift,
    severity: classifyConflicts(drift),
  });
};
