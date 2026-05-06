import type { LoaderFunctionArgs } from "react-router";

import db from "../db.server";
import { compilePage } from "../lib/compile/compile.ts";
import { migrateDocument } from "../lib/editor/types.ts";
import { authenticate } from "../shopify.server";
import {
  getPublishedTheme,
  readThemeFile,
} from "../lib/theme/client.server.ts";

/**
 * Resource route: GET /app/api/pages/:id/drift/diff?path=...
 *
 * Lazy-loads the content of one specific theme file + the matching
 * artifact file content for the SimpleDiff renderer. Called only when
 * the dev opens "Show diff" on a modified file in the DriftPanel.
 *
 * Returns: { themeContent: string | null, artifactContent: string | null }
 */

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) return Response.json({ error: "Missing path" }, { status: 400 });

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

  const artifactFile = compileResult.artifact.files.find((f) => f.path === path);
  const artifactContent = artifactFile?.content ?? null;

  const theme = await getPublishedTheme(admin, shop);
  let themeContent: string | null = null;
  if (theme) {
    const file = await readThemeFile(admin, theme.id, path, shop);
    themeContent = file?.content ?? null;
  }

  return Response.json({ path, themeContent, artifactContent });
};
