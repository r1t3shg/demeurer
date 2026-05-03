/**
 * Preview render endpoint.
 *
 * The editor canvas is an iframe pointed at this route. It returns a
 * full HTML page that loads the merchant's theme stylesheets, then SSR-
 * renders each block by calling its registered `<Render>` component.
 * That gives us WYSIWYG without injecting Demeurer JS into the live
 * storefront — the same Render function powers the canvas preview now,
 * and the same `toLiquid` will compile the published version later
 * (P1.D). Visual fidelity falls out of sharing the React component;
 * runtime fidelity falls out of the merchant's theme CSS.
 *
 * Auth: this route is NOT under `/app/*`, so it doesn't go through
 * App Bridge. Instead, the editor route hands the iframe an HMAC-
 * signed query token. We verify it here before reading anything.
 *
 * Architectural commitment: this route is editor-only. Nothing
 * generated here ships to the published page. The bridge script and
 * shell CSS live under `/public/` and are loaded only inside this
 * iframe — they will never be referenced from the compiled Liquid.
 */

import type { LoaderFunctionArgs } from "react-router";
import { renderToString } from "react-dom/server";

import db from "../db.server";
import type { Block, EditorDocument } from "../lib/editor/types";
import { isDocument } from "../lib/editor/types";
import { verifyPreviewToken } from "../lib/preview/token.server";
import { getSection } from "../lib/sections";
import type { ThemeTokens } from "../lib/sections";
import { getCachedThemeTokensOrDefault } from "../lib/theme/tokens.server";
import { getThemeStylesheets } from "../lib/theme/stylesheets.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const pageId = params.pageId;
  if (!pageId) return errorPage(404, "Missing page id");

  const url = new URL(request.url);
  const verify = verifyPreviewToken({ pageId }, url.searchParams);
  if (!verify.ok) {
    return errorPage(401, `Invalid preview token (${verify.reason})`);
  }
  const { shop } = verify.verified;

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, shop: true, source: true, title: true },
  });

  if (!page || page.shop !== shop) {
    return errorPage(404, "Page not found");
  }

  const doc: EditorDocument = isDocument(page.source)
    ? page.source
    : { version: 1, blocks: [] };

  const { tokens } = getCachedThemeTokensOrDefault(shop);
  // Stylesheets are best-effort and cached separately — they don't
  // depend on admin auth so they're safe to fetch from this route.
  const stylesheetUrls = await getThemeStylesheets(shop);

  let html: string;
  try {
    html = renderHtml({
      title: page.title,
      blocks: doc.blocks,
      tokens,
      stylesheetUrls,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[demeurer] preview render crashed", err);
    return errorPage(
      500,
      err instanceof Error ? err.message : "Render failed",
    );
  }

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Tight CSP-ish defaults via headers we can set without breaking
      // theme CSS. The route is iframed inside the embedded admin so
      // we explicitly opt into being framed.
      "x-frame-options": "SAMEORIGIN",
      // Editor reads must always be fresh.
      "cache-control": "no-store",
    },
  });
};

interface RenderInput {
  title: string;
  blocks: Block[];
  tokens: ThemeTokens;
  stylesheetUrls: string[];
}

function renderHtml({
  title,
  blocks,
  tokens,
  stylesheetUrls,
}: RenderInput): string {
  const blocksHtml = blocks
    .map((b) => renderBlock(b, tokens))
    .join("\n");

  const themeLinks = stylesheetUrls
    .map((u) => `<link rel="stylesheet" href="${escapeAttr(u)}">`)
    .join("\n    ");

  const empty = blocks.length === 0
    ? `<div class="demeurer-preview-empty">This page has no blocks yet. Use the outline on the left to add one.</div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeText(title)} — Demeurer Preview</title>
    ${themeLinks}
    <link rel="stylesheet" href="/preview-shell.css">
    <script src="/preview-bridge.js" defer></script>
  </head>
  <body class="demeurer-preview">
    <main id="demeurer-canvas">
${blocksHtml}
${empty}
    </main>
  </body>
</html>`;
}

function renderBlock(block: Block, tokens: ThemeTokens): string {
  const def = getSection(block.type);
  if (!def) {
    return wrapBlock(
      block,
      `<div class="demeurer-preview-unknown">Unknown section: ${escapeText(block.type)}</div>`,
    );
  }

  const { Render } = def;
  let inner: string;
  try {
    inner = renderToString(
      <Render props={block.props} themeTokens={tokens} />,
    );
  } catch (err) {
    inner = `<div class="demeurer-preview-error">Block crashed: ${escapeText(
      err instanceof Error ? err.message : String(err),
    )}</div>`;
  }
  return wrapBlock(block, inner);
}

function wrapBlock(block: Block, inner: string): string {
  return `      <div data-demeurer-block-id="${escapeAttr(block.id)}" data-demeurer-block-type="${escapeAttr(block.type)}" class="demeurer-block">${inner}</div>`;
}

function errorPage(status: number, reason: string): Response {
  const body = `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview error</title>
<link rel="stylesheet" href="/preview-shell.css"></head>
<body class="demeurer-preview demeurer-preview-error-page">
<div class="demeurer-preview-error-card">
  <h1>Couldn't render preview</h1>
  <p>${escapeText(reason)}</p>
</div>
</body></html>`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "SAMEORIGIN",
      "cache-control": "no-store",
    },
  });
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
