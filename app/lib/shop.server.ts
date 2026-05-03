import { authenticate } from "../shopify.server";

/**
 * Authenticate the request as an admin and return the shop's myshopify domain.
 *
 * Centralized so loaders/actions don't sprinkle `authenticate.admin(...)` and
 * `session.shop` lookups across the codebase. Throws (or redirects, per the
 * Shopify React Router adapter) if the request isn't authenticated.
 */
export async function getShopFromRequest(request: Request): Promise<string> {
  const { session } = await authenticate.admin(request);
  return session.shop;
}
