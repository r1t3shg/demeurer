import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import db from "../db.server";
import { newBlockId } from "../lib/editor/ids";
import { useEditorStore } from "../lib/editor/store";
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

  const document = useEditorStore((s) => s.document);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const addBlock = useEditorStore((s) => s.addBlock);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const markSaved = useEditorStore((s) => s.markSaved);

  // Hydrate the store from the page row on mount and whenever the route
  // switches to a different page id. Resets dirty state too.
  useEffect(() => {
    loadDocument(page.source);
  }, [page.id, page.source, loadDocument]);

  const blockCount = document.blocks.length;
  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString()
    : "never";

  return (
    <s-page heading={page.title}>
      <s-button slot="primary-action" href="/app">
        Back to pages
      </s-button>

      <s-section heading="Editor">
        <s-stack direction="block" gap="base">
          <s-banner>
            Editor canvas coming next. The Zustand store is live — the debug
            panel below reflects in-memory state.
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

      <s-section heading="Editor state (debug)">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Selected block: </s-text>
            <s-text>{selectedBlockId ?? "(none)"}</s-text>
          </s-paragraph>
          <s-paragraph>
            <s-text>Dirty: </s-text>
            {isDirty ? (
              <s-badge tone="warning">Unsaved</s-badge>
            ) : (
              <s-badge tone="success">Clean</s-badge>
            )}
          </s-paragraph>
          <s-paragraph>
            <s-text>Last saved: </s-text>
            <s-text>{lastSavedLabel}</s-text>
          </s-paragraph>
          <s-paragraph>
            <s-text>Top-level blocks: </s-text>
            <s-text>{String(blockCount)}</s-text>
          </s-paragraph>
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() =>
                addBlock({
                  id: newBlockId(),
                  type: "hero",
                  props: { heading: "Stub hero", body: "Lorem ipsum." },
                  children: [],
                })
              }
            >
              Add stub hero block
            </s-button>
            <s-button onClick={() => selectBlock(null)}>
              Clear selection
            </s-button>
            <s-button onClick={() => markSaved()}>Mark saved</s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
