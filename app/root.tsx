import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    // suppressHydrationWarning on <html> and <body>: browser extensions
    // (Grammarly injects data-gr-ext-installed / data-new-gr-c-s-check-loaded,
    // password managers, dark-mode add-ons, etc.) frequently mutate these two
    // root elements after the page loads, causing React to see attributes
    // it didn't render on the server. The mismatch tears down the entire
    // hydrated tree and falls back to client rendering, which presents as
    // a flash of unstyled HTML. Suppressing the warning here only affects
    // direct attribute checks on these elements; descendant mismatches still
    // fail loudly.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
