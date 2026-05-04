import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import { getShopFromRequest } from "../lib/shop.server";
import { generateUniqueHandle } from "../lib/slug.server";

const PAGE_TYPES = ["landing", "product"] as const;
type PageType = (typeof PAGE_TYPES)[number];

const TYPE_LABELS: Record<PageType, string> = {
  landing: "Landing",
  product: "Product",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const shop = await getShopFromRequest(request);

  const pages = await db.page.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      handle: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return {
    shop,
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      handle: p.handle,
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    })),
  };
};

function storefrontUrl(
  shop: string,
  page: { type: string; handle: string },
): string {
  return page.type === "product"
    ? `https://${shop}/products/${page.handle}`
    : `https://${shop}/pages/${page.handle}`;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const shop = await getShopFromRequest(request);

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  // Handwritten validation — no zod yet, per scope.
  if (!title) {
    return { error: "Title is required.", field: "title" as const };
  }
  if (title.length > 200) {
    return {
      error: "Title must be 200 characters or fewer.",
      field: "title" as const,
    };
  }
  if (!PAGE_TYPES.includes(type as PageType)) {
    return {
      error: 'Type must be "landing" or "product".',
      field: "type" as const,
    };
  }

  const handle = await generateUniqueHandle(shop, title);

  const page = await db.page.create({
    data: {
      shop,
      title,
      type,
      handle,
      // Empty initial source. Editor schema will fill this in later segments.
      source: { blocks: [] },
    },
    select: { id: true },
  });

  return redirect(`/app/pages/${page.id}`);
};

function formatUpdated(iso: string): string {
  // Lightweight, locale-aware "Mon DD, YYYY HH:MM" format. We can swap in a
  // relative-time formatter later; for now stable absolute timestamps are
  // fine and easier to reason about.
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PagesIndex() {
  const { pages, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const error = fetcher.data && "error" in fetcher.data ? fetcher.data : null;
  const isSubmitting = fetcher.state === "submitting";

  const submitCreate = () => {
    const form = document.getElementById(
      "create-page-form",
    ) as HTMLFormElement | null;
    if (form) fetcher.submit(form);
  };

  return (
    <s-page heading="Pages">
      <s-button
        slot="primary-action"
        // Native HTML invoker: opens the s-modal below without imperative refs.
        // See https://shopify.dev/docs/api/app-home/using-polaris-components for
        // the command/commandFor pattern.
        command="--show"
        commandFor="create-page-modal"
      >
        Create page
      </s-button>

      {pages.length === 0 ? (
        <s-section heading="No pages yet">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Create your first landing or product page. Pages compile to
              native Liquid sections in your theme — they keep rendering even
              if you uninstall Demeurer.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                command="--show"
                commandFor="create-page-modal"
              >
                Create page
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      ) : (
        <s-section heading={`${pages.length} page${pages.length === 1 ? "" : "s"}`}>
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Handle</s-table-header>
              <s-table-header>Updated</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {pages.map((page) => (
                <s-table-row key={page.id}>
                  <s-table-cell>
                    <s-link href={`/app/pages/${page.id}`}>{page.title}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    {TYPE_LABELS[page.type as PageType] ?? page.type}
                  </s-table-cell>
                  <s-table-cell>
                    <s-text>{page.handle}</s-text>
                  </s-table-cell>
                  <s-table-cell>{formatUpdated(page.updatedAt)}</s-table-cell>
                  <s-table-cell>
                    {page.publishedAt ? (
                      <s-stack direction="inline" gap="small">
                        <s-badge tone="success">Published</s-badge>
                        <a
                          className="demeurer-view-live-link"
                          href={storefrontUrl(shop, page)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View live ↗
                        </a>
                      </s-stack>
                    ) : (
                      <s-badge>Draft</s-badge>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-modal id="create-page-modal" heading="Create page">
        <fetcher.Form method="post" id="create-page-form">
          <s-stack direction="block" gap="base">
            <s-text-field
              name="title"
              label="Page title"
              required
              autocomplete="off"
              {...(error?.field === "title" ? { error: error.error } : {})}
            />
            {/* No defaultValue — s-select uses the first non-disabled option
                (`landing`) as the default when no value is set. */}
            <s-select name="type" label="Page type">
              <s-option value="landing">Landing page</s-option>
              <s-option value="product">Product page</s-option>
            </s-select>
            {error && error.field === "type" && (
              <s-banner tone="critical">{error.error}</s-banner>
            )}
          </s-stack>
        </fetcher.Form>
        <s-button
          slot="primary-action"
          variant="primary"
          // s-button doesn't expose the HTML `form` attribute, so we trigger
          // the form submission imperatively via the fetcher. Stays on the
          // same page on validation errors (modal remains open); follows the
          // action's redirect to /app/pages/:id on success.
          onClick={submitCreate}
          {...(isSubmitting ? { loading: true } : {})}
        >
          Create
        </s-button>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor="create-page-modal"
        >
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
