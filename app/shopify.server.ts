/**
 * Demeurer — architectural commitments
 * =====================================
 *
 *   1. When the merchant uninstalls or cancels, pages KEEP RENDERING unchanged.
 *      The editor goes read-only on cancel; pages stay live forever.
 *   2. No runtime JavaScript injection from our servers. Zero page-speed penalty.
 *   3. Pages survive theme updates because they ARE the theme.
 *   4. If you find yourself writing code that violates 1–3, stop.
 *
 * Demeurer compiles pages to native Liquid section files in the merchant's
 * theme. The auth/session layer below must never break that contract — no
 * background workers that mutate themes on uninstall, no server-side
 * rewriting of merchant pages, no shadow runtime that pages depend on.
 */
import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
