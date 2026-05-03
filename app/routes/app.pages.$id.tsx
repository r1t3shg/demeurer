import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import { getShopFromRequest } from "../lib/shop.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shop = await getShopFromRequest(request);

  const id = params.id;
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }

  const page = await db.page.findUnique({
    where: { id },
    select: {
      id: true,
      shop: true,
      title: true,
      type: true,
      handle: true,
      source: true,
      publishedAt: true,
      themeId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 404 on not-found OR cross-shop access. Don't leak existence to other
  // shops with a different status code.
  if (!page || page.shop !== shop) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    page: {
      id: page.id,
      title: page.title,
      type: page.type,
      handle: page.handle,
      source: page.source,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      themeId: page.themeId,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    },
  };
};

export default function PageEditor() {
  const { page } = useLoaderData<typeof loader>();

  return (
    <s-page heading={page.title}>
      <s-button slot="primary-action" href="/app">
        Back to pages
      </s-button>

      <s-section heading="Editor">
        <s-stack direction="block" gap="base">
          <s-banner>
            Editor coming in next segment. The page is saved — refresh to
            confirm it persists.
          </s-banner>
          <s-paragraph>
            <s-text>Handle: </s-text>
            <s-text>{page.handle}</s-text>
          </s-paragraph>
          <s-paragraph>
            <s-text>Type: </s-text>
            <s-text>{page.type}</s-text>
          </s-paragraph>
          <s-paragraph>
            <s-text>Status: </s-text>
            {page.publishedAt ? (
              <s-badge tone="success">Published</s-badge>
            ) : (
              <s-badge>Draft</s-badge>
            )}
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
