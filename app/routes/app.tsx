import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

/**
 * Polaris web components (`<s-button>`, `<s-page>`, ...) mutate
 * themselves in their `connectedCallback` — they inject inline styles
 * once they're attached to the DOM. SSR renders them without those
 * styles; on first hydration React sees a mismatch and tears down the
 * entire server tree to fall back to client rendering. The visible
 * effect is a flash of unstyled HTML before the editor reappears.
 *
 * Embedded admin apps render inside an iframe on admin.shopify.com,
 * so SSR has no SEO/perceived-perf benefit here. Skip SSR for the
 * /app/* tree by rendering nothing on the server, then mount on the
 * client. Both passes return the same null/placeholder, so React
 * never sees a mismatch.
 */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    // Catalog is an internal/dev tool — surface in nav only when not in
    // a production build. Mirrors the gate inside `app.catalog.tsx`.
    // eslint-disable-next-line no-undef
    showCatalog: process.env.NODE_ENV !== "production",
  };
};

export default function App() {
  const { apiKey, showCatalog } = useLoaderData<typeof loader>();
  const hydrated = useHydrated();

  if (!hydrated) {
    // Stable null placeholder for the server pass + the first client
    // render. Avoids hydration mismatch caused by Polaris web
    // components mutating themselves post-mount.
    return null;
  }

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Pages</s-link>
        {showCatalog ? <s-link href="/app/catalog">Catalog</s-link> : null}
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
