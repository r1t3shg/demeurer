import type { ActionFunctionArgs } from "react-router";
import type { Prisma } from "@prisma/client";

import db from "../db.server";
import { isDocument } from "../lib/editor/types";
import { getShopFromRequest } from "../lib/shop.server";

/**
 * Resource route: POST /app/api/pages/:id/save
 *
 * Persists the editor's in-memory document to `Page.source`. Versioning is
 * debounced (per-page, ~5 minutes) so we don't spam `PageVersion` rows on
 * every keystroke — the autosave hook fires every 400ms during active
 * editing.
 *
 * No loader / no UI — action only. The autosave hook calls this directly.
 */

const VERSION_INTERVAL_MS = 5 * 60 * 1000;

export const action = async ({ params, request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = await getShopFromRequest(request);

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  // Verify ownership before parsing body — keeps malformed-body errors
  // from leaking page existence to other shops.
  const owner = await db.page.findUnique({
    where: { id },
    select: { shop: true },
  });
  if (!owner || owner.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = (body as { source?: unknown } | null)?.source;
  if (!isDocument(source)) {
    return Response.json(
      { error: "Malformed source (expected { version, blocks })" },
      { status: 400 },
    );
  }

  // Update the page row first. `updatedAt` advances automatically via the
  // Prisma `@updatedAt` directive — that's the timestamp clients use to
  // decide whether localStorage drafts are stale.
  // EditorDocument is a structural type without an index signature; cast
  // through unknown to Prisma's InputJsonValue. The runtime shape is
  // already validated by isDocument() above.
  const sourceJson = source as unknown as Prisma.InputJsonValue;
  const updated = await db.page.update({
    where: { id },
    data: { source: sourceJson },
    select: { updatedAt: true },
  });

  // Debounced versioning: snapshot to PageVersion only if either
  //   (a) the most recent version's source differs from this one, OR
  //   (b) it's been more than VERSION_INTERVAL_MS since the last version.
  // Hashing would be cheaper than JSON.stringify equality, but at the
  // expected document sizes (a few KB) stringify is fine and keeps the
  // dependency surface small.
  const latestVersion = await db.pageVersion.findFirst({
    where: { pageId: id },
    orderBy: { createdAt: "desc" },
    select: { source: true, createdAt: true },
  });

  const now = Date.now();
  const stale =
    !latestVersion || now - latestVersion.createdAt.getTime() > VERSION_INTERVAL_MS;
  const changed =
    !latestVersion ||
    JSON.stringify(latestVersion.source) !== JSON.stringify(source);

  if (changed && stale) {
    await db.pageVersion.create({
      data: { pageId: id, source: sourceJson },
    });
  }

  return Response.json({ savedAt: updated.updatedAt.toISOString() });
};
