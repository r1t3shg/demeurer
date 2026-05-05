import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { applyArtifact } from "../lib/compile/apply.ts";
import {
  compilePage,
  CompileValidationError,
} from "../lib/compile/compile.ts";
import { classifyConflicts } from "../lib/compile/conflict-severity.ts";
import {
  PublishInProgressError,
  withPublishLock,
} from "../lib/compile/publish-lock.server.ts";
import { migrateDocument } from "../lib/editor/types.ts";
import {
  getProductForBinding,
  setProductTemplateSuffix,
} from "../lib/product/fetch.server.ts";
import { authenticate } from "../shopify.server";

/**
 * Resource route: POST /app/api/pages/:id/publish
 *
 * Publishes a page to the merchant's published theme:
 *   1. Compiles the page (segment 1).
 *   2. Detects drift against the live theme (segment 2).
 *   3. If severity is "major" and the caller didn't opt-in via
 *      `acceptDrift: true`, returns 409 with the drift report.
 *   4. Otherwise writes the artifact (sections first, templates last)
 *      via the apply pipeline (segment 3).
 *   5. On full success, sets `Page.publishedAt = now` and
 *      `Page.themeId = theme.id`.
 *
 * Concurrency: a per-(shop, pageId) in-memory lock prevents two
 * publishes for the same page from interleaving. A second publish
 * arriving mid-flight gets HTTP 409 `publish_in_progress`.
 *
 * Body (JSON, optional): `{ "acceptDrift": boolean }`.
 *
 * HTTP status mapping:
 *   200 — success
 *   207 — partial failure (some writes succeeded, some failed)
 *   401 — auth (write_themes scope or theme-write exemption missing)
 *   404 — page not found OR no published theme
 *   409 — drift_blocked OR publish_in_progress
 *   500 — unknown
 */

export const action = async ({ params, request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const page = await db.page.findUnique({ where: { id } });
  if (!page || page.shop !== shop) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as { acceptDrift?: unknown };
  const acceptDrift = body?.acceptDrift === true;

  const source = migrateDocument(page.source);
  const pageType: "landing" | "product" =
    page.type === "product" ? "product" : "landing";

  let compileResult;
  try {
    compileResult = await compilePage({
      id: page.id,
      handle: page.handle,
      type: pageType,
      source,
      updatedAt: page.updatedAt,
      productId: page.productId,
    });
  } catch (err) {
    if (err instanceof CompileValidationError) {
      return Response.json(
        { ok: false, reason: "validation", error: err.message },
        { status: 400 },
      );
    }
    throw err;
  }

  // Hydrate ThemeWrite memory for the published theme. We can't get
  // the theme id without an admin query, so we hydrate inside the
  // apply call indirectly — but the drift detector wants writesByPath
  // keyed by THIS theme. Fetch them fresh here to keep apply pure on
  // the inputs we hand it.
  //
  // (Optimization: we could pass the theme id back through, but
  // keeping the route loader simple wins over a marginal extra query.)
  const themeWrites = await db.themeWrite.findMany({
    where: { shop },
    select: { path: true, contentHash: true, themeId: true },
  });
  // applyArtifact's drift detection needs writesByPath for the
  // published theme specifically. Once apply has resolved the theme
  // id, it indexes by path. We pass ALL writes for the shop and let
  // the drift filter implicitly via path lookup (only the published-
  // theme rows can match the listed-files paths — other-theme rows
  // are noise but won't false-match because the file content has
  // different md5s).
  //
  // Strictly correct alternative: fetch the published theme id once
  // here, then filter. We choose simplicity; the noise is bounded by
  // the number of merchants who switch themes a lot, which is not us.
  const writesByPath = new Map(
    themeWrites.map((w) => [w.path, { contentHash: w.contentHash }]),
  );

  // Capture the "first publish" gate BEFORE we try to publish — even
  // a partial publish counts as "they tried it" for onboarding.
  const isFirstPublish =
    (await db.publish.count({ where: { shop } })) === 0;

  let result;
  try {
    result = await withPublishLock(shop, page.id, () =>
      applyArtifact({
        admin,
        shop,
        pageId: page.id,
        artifact: compileResult.artifact,
        writesByPath,
        db,
        options: { acceptDrift },
      }),
    );
  } catch (err) {
    if (err instanceof PublishInProgressError) {
      return Response.json(
        { ok: false, reason: "publish_in_progress" },
        { status: 409 },
      );
    }
    throw err;
  }

  // Record terminal publish attempts (success + partial). Pre-flight
  // aborts (drift_blocked, auth_error) are NOT recorded — nothing was
  // written.
  const isTerminal =
    result.status === "success" || result.status === "partial_failure";
  if (isTerminal && result.themeId) {
    await db.publish.create({
      data: {
        shop,
        pageId: page.id,
        themeId: result.themeId,
        themeName: result.themeName ?? "Unknown theme",
        status: result.status === "success" ? "success" : "partial_failure",
        fileCount: result.written.length,
        artifactSourceVersion: page.updatedAt.getTime(),
        failedPaths:
          result.failed.length > 0
            ? JSON.stringify(result.failed.map((f) => f.path))
            : null,
      },
    });
  }

  if (result.status === "success") {
    // Product page binding: bind the product to our compiled
    // template via templateSuffix. Capture the product's CURRENT
    // templateSuffix once (on first publish) so unpublish can
    // restore it instead of blanking — defensive against other apps
    // that manage custom templates.
    const productUpdates: { previousTemplateSuffix?: string | null } = {};
    if (page.type === "product" && page.productId) {
      const desiredSuffix = `demeurer-${page.handle}`;

      // Fetch the product to read its CURRENT templateSuffix. If
      // we've never published this page before, capture it.
      const product = await getProductForBinding(admin, shop, page.productId);
      const currentSuffix = product?.templateSuffix ?? null;

      if (page.previousTemplateSuffix === null && currentSuffix !== desiredSuffix) {
        // First publish — record what was there before we wrote.
        productUpdates.previousTemplateSuffix = currentSuffix;
      }

      // Only call productUpdate when the suffix actually needs
      // changing. On a re-publish where the product is already
      // bound, we save an API call.
      if (currentSuffix !== desiredSuffix) {
        const setResult = await setProductTemplateSuffix(
          admin,
          shop,
          page.productId,
          desiredSuffix,
        );
        if (!setResult.ok) {
          // Theme files are written, but the binding didn't take.
          // Surface as a partial failure: storefront URL won't yet
          // route to our template, but a retry will fix it without
          // re-writing the (already-correct) theme files.
          return Response.json(
            {
              ok: false,
              reason: "product_binding_failed",
              errors: setResult.errors,
              result,
              firstPublish: isFirstPublish,
            },
            { status: 207 },
          );
        }
      }
    }

    await db.page.update({
      where: { id: page.id },
      data: {
        publishedAt: new Date(),
        themeId: result.themeId,
        // We just published to the current MAIN; by definition the
        // page is no longer mismatched with whatever theme it used
        // to be on.
        themeMismatch: false,
        ...(productUpdates.previousTemplateSuffix !== undefined
          ? { previousTemplateSuffix: productUpdates.previousTemplateSuffix }
          : {}),
      },
    });
    return Response.json({ ok: true, result, firstPublish: isFirstPublish });
  }

  if (result.status === "drift_blocked") {
    return Response.json(
      {
        ok: false,
        reason: "drift",
        report: result.driftReport,
        severity: result.driftReport
          ? classifyConflicts(result.driftReport)
          : null,
      },
      { status: 409 },
    );
  }

  if (result.status === "partial_failure") {
    return Response.json(
      {
        ok: false,
        reason: "partial",
        result,
        firstPublish: isFirstPublish,
      },
      { status: 207 },
    );
  }

  if (result.status === "auth_error") {
    return Response.json(
      { ok: false, reason: "auth", result },
      { status: 401 },
    );
  }

  return Response.json(
    { ok: false, reason: "unknown", result },
    { status: 500 },
  );
};
