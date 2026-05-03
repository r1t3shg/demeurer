/**
 * HMAC-signed preview token.
 *
 * The preview iframe loads `/preview/<pageId>?...token`. That route is
 * outside the embedded admin layout, so `authenticate.admin(request)`
 * isn't reliable: same-origin iframe requests don't carry the App
 * Bridge session token in the URL, only cookies — and we don't want to
 * gamble on cookie behavior across embedded contexts.
 *
 * Instead we hand the iframe a short-lived HMAC over `(pageId, shop,
 * exp)` signed with `SHOPIFY_API_SECRET`. Verifying it on the preview
 * route gives us the shop without any further auth, and we can do the
 * `page.shop === shop` ownership check before responding.
 *
 * Tokens expire ~10 minutes after issuance — long enough to survive a
 * busy editing session, short enough that a leaked URL is mostly inert.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 10 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SHOPIFY_API_SECRET;
  if (!s) {
    // We deliberately throw here rather than degrade silently — preview
    // auth is the only thing standing between random callers and a
    // page's source tree.
    throw new Error(
      "SHOPIFY_API_SECRET is not set — preview tokens cannot be signed.",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export interface PreviewTokenInput {
  pageId: string;
  shop: string;
}

export interface PreviewTokenFields extends PreviewTokenInput {
  exp: number;
  sig: string;
}

/** Issue a token good for ~10 minutes. */
export function signPreviewToken(input: PreviewTokenInput): PreviewTokenFields {
  const exp = Date.now() + TTL_MS;
  const payload = `${input.pageId}|${input.shop}|${exp}`;
  return {
    pageId: input.pageId,
    shop: input.shop,
    exp,
    sig: sign(payload),
  };
}

export interface VerifiedToken {
  pageId: string;
  shop: string;
}

export type VerifyError =
  | "missing"
  | "expired"
  | "shop-mismatch"
  | "page-mismatch"
  | "bad-sig";

/**
 * Verify a preview token. Returns the shop on success, or a discrim
 * error code so the caller can pick the right response (404 vs 401).
 */
export function verifyPreviewToken(
  expected: { pageId: string },
  query: URLSearchParams,
): { ok: true; verified: VerifiedToken } | { ok: false; reason: VerifyError } {
  const shop = query.get("shop");
  const expRaw = query.get("exp");
  const sig = query.get("sig");
  const tokenPageId = query.get("p");

  if (!shop || !expRaw || !sig || !tokenPageId) {
    return { ok: false, reason: "missing" };
  }
  if (tokenPageId !== expected.pageId) {
    return { ok: false, reason: "page-mismatch" };
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const payload = `${expected.pageId}|${shop}|${exp}`;
  const expectedSig = sign(payload);
  // timingSafeEqual requires equal-length buffers.
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad-sig" };
  }

  return { ok: true, verified: { pageId: expected.pageId, shop } };
}

/** Build the query string suffix the iframe URL appends. */
export function buildPreviewQuery(t: PreviewTokenFields): string {
  const q = new URLSearchParams({
    p: t.pageId,
    shop: t.shop,
    exp: String(t.exp),
    sig: t.sig,
  });
  return q.toString();
}
