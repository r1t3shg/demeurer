import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { SaveIndicator } from "../components/SaveIndicator";
import db from "../db.server";
import { newBlockId } from "../lib/editor/ids";
import {
  clearDraft,
  useDraftInspection,
  useDraftMirror,
} from "../lib/editor/recovery";
import { useEditorStore } from "../lib/editor/store";
import { useAutosave } from "../lib/editor/useAutosave";
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
  const lastSavedAtMs = useEditorStore((s) => s.lastSavedAt);
  const historyCursor = useEditorStore((s) => s.historyCursor);
  const futureLength = useEditorStore((s) => s.future.length);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const addBlock = useEditorStore((s) => s.addBlock);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const markSaved = useEditorStore((s) => s.markSaved);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const { saveStatus, lastSavedAt } = useAutosave(page.id);
  const { status: recovery, dismiss: dismissRecovery } = useDraftInspection(
    page.id,
    page.updatedAt,
  );
  useDraftMirror(page.id);

  // Track whether the user dismissed the recovery banner (Restore or
  // Discard) so we only hydrate from the server once we know what to do.
  const [recoveryDecided, setRecoveryDecided] = useState(false);

  // Hydrate from the server doc unless we're waiting on a recovery
  // decision. Re-runs when route swaps to a different page id.
  useEffect(() => {
    if (recovery.kind === "recoverable" && !recoveryDecided) return;
    loadDocument(page.source);
  }, [page.id, page.source, recovery.kind, recoveryDecided, loadDocument]);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y)
  // = redo. Skip when focus is in an editable element so the browser's
  // native text-undo wins inside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const blockCount = document.blocks.length;
  const lastSavedLabel = lastSavedAtMs
    ? new Date(lastSavedAtMs).toLocaleTimeString()
    : "never";
  const canUndo = historyCursor > 0;
  const canRedo = futureLength > 0;

  const handleRestore = () => {
    if (recovery.kind !== "recoverable") return;
    loadDocument(recovery.draft.document);
    // Mark dirty so autosave persists the restored draft to the server.
    // loadDocument resets isDirty to false; we re-flip it by performing
    // a no-op edit path: easiest is to call the store's internal dirty
    // setter via a marker mutation. Since we don't have one, we add
    // then immediately undo the marker — but that'd push history. The
    // simplest robust path is to call a private set; but cleaner: just
    // tell autosave to do its job by updating the doc through the store.
    // We achieve "dirty after restore" by directly setting state:
    useEditorStore.setState({ isDirty: true });
    setRecoveryDecided(true);
  };

  const handleDiscard = () => {
    dismissRecovery();
    setRecoveryDecided(true);
  };

  // Manual QA helper: dropping in-memory state and reloading should
  // surface the recovery banner on next mount (because writeDraft fires
  // on every doc change, and lastSavedAt < dirtyAt unless a save has
  // succeeded since the last edit).
  //
  // Manual smoke test:
  //   1. Add 1+ blocks (don't wait for autosave).
  //   2. Click "Simulate browser crash" before the save indicator says "Saved".
  //   3. Page reloads. Recovery banner shows. Restore → state returns.
  const simulateCrash = () => {
    // Drop in-memory state without markSaved; the localStorage entry
    // remains because the autosave never confirmed.
    useEditorStore.setState({
      document: { version: 1, blocks: [] },
      isDirty: false,
      lastSavedAt: null,
      history: [],
      future: [],
      historyCursor: 0,
      selectedBlockId: null,
    });
    window.location.reload();
  };

  return (
    <s-page heading={page.title}>
      <s-button slot="primary-action" href="/app">
        Back to pages
      </s-button>

      <s-section heading="Save status">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <SaveIndicator
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              isDirty={isDirty}
            />
          </s-stack>
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() => undo()}
              {...(canUndo ? {} : { disabled: true })}
            >
              Undo
            </s-button>
            <s-button
              onClick={() => redo()}
              {...(canRedo ? {} : { disabled: true })}
            >
              Redo
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      {recovery.kind === "recoverable" && !recoveryDecided ? (
        <s-section heading="Unsaved changes detected">
          <s-stack direction="block" gap="base">
            <s-banner tone="warning">
              We found unsaved changes from{" "}
              {formatAge(recovery.draft.dirtyAt)} ago. Restore them?
            </s-banner>
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={handleRestore}>
                Restore
              </s-button>
              <s-button onClick={handleDiscard}>Discard</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      ) : null}

      <s-section heading="Editor">
        <s-stack direction="block" gap="base">
          <s-banner>
            Editor canvas coming next. Autosave + undo/redo + crash
            recovery are wired — try Cmd+Z, or use the chaos button below.
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
          <s-paragraph>
            <s-text>History / future: </s-text>
            <s-text>
              {historyCursor} / {futureLength}
            </s-text>
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
            <s-button
              variant="primary"
              tone="critical"
              onClick={simulateCrash}
            >
              Simulate browser crash
            </s-button>
            <s-button
              onClick={() => {
                clearDraft(page.id);
              }}
            >
              Clear draft (debug)
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

function formatAge(dirtyAtMs: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - dirtyAtMs) / 1000));
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
