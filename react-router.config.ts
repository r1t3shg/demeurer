import type { Config } from "@react-router/dev/config";

/**
 * Demeurer is a Shopify embedded admin app — installed merchants reach
 * it through admin.shopify.com, which iframes the app. There is no
 * SEO surface, no public landing page, and no perceived-perf benefit
 * from SSR (the outer Shopify admin shell already paints first).
 *
 * SSR was actively harmful here because browser extensions (Grammarly
 * Desktop, password managers, dark-mode add-ons, ...) frequently
 * mutate <html> and <body> after page load, injecting attributes and
 * even custom elements like <grammarly-desktop-integration>. React's
 * hydration sees those mutations as server/client mismatches and
 * tears down the entire root tree, falling back to client rendering
 * — which presents as a flash of unstyled HTML before the editor
 * reappears.
 *
 * Disabling SSR turns the app into a pure SPA: server returns a
 * minimal HTML shell, the client does all rendering, and there is
 * never a hydration step that can fail. Loaders run on the client
 * (clientLoader) — the existing `loader` exports on routes still work
 * because React Router treats them as a single source of truth.
 */
export default {
  ssr: false,
} satisfies Config;
