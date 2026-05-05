import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

/**
 * Webhook: themes/update
 *
 * Fires when a theme's metadata changes (name, role) and sometimes
 * on file changes. We intentionally take NO action here: drift
 * detection on the next publish is the catch-all. Acting eagerly on
 * every update would be noisy and could trigger writes the merchant
 * didn't ask for.
 *
 * The handler exists so Shopify gets a 200 response and stops
 * retrying; the subscription is in `shopify.app.toml` to be a good
 * citizen of the webhook fabric (some operational tooling expects
 * us to acknowledge subscribed topics).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  // eslint-disable-next-line no-console
  console.log(
    `Received ${topic} webhook for ${shop} — no action; drift detection ` +
      `on next publish will reconcile any divergence.`,
  );

  return new Response();
};
