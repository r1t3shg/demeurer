import type { ActionFunctionArgs } from "react-router";
import type { Prisma } from "@prisma/client";

import db from "../db.server";
import { getShopFromRequest } from "../lib/shop.server";

/**
 * Resource route: POST /app/api/pages/:id/snapshot
 *
 * Creates a labeled PageVersion of the page's CURRENT `source`. Unlike
 * the autosave's debounced versioning (5-min interval, only on change),
 * a manual snapshot always creates a row — that's the whole point of
 * the user pressing the button.
 *
 * Body: { label: string }   — label is trimmed; max 200 chars.
 */

const MAX_LABEL_LENGTH = 200;

export const action = async ({ params, request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = await getShopFromRequest(request);

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  // Read the page and verify ownership in the same query — the source
  // we're about to snapshot is whatever's currently persisted, so we
  // need the row anyway.
  const page = await db.page.findUnique({
    where: { id },
    select: { shop: true, source: true },
  });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const labelRaw = (body as { label?: unknown } | null)?.label;
  const label =
    typeof labelRaw === "string" ? labelRaw.trim().slice(0, MAX_LABEL_LENGTH) : "";
  if (!label) {
    return Response.json(
      { error: "Label is required." },
      { status: 400 },
    );
  }

  // page.source comes from Prisma's Json column (typed as JsonValue).
  // It's already a JSON-safe value; cast through unknown to satisfy
  // InputJsonValue without restating the schema.
  const created = await db.pageVersion.create({
    data: {
      pageId: id,
      label,
      source: page.source as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, label: true, createdAt: true },
  });

  return Response.json({
    version: {
      id: created.id,
      label: created.label,
      createdAt: created.createdAt.toISOString(),
    },
  });
};
