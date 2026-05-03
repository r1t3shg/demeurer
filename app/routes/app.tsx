import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

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
