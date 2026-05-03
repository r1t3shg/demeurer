import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { SaveIndicator } from "../components/SaveIndicator";
import { Canvas } from "../components/editor/Canvas";
import { Outline } from "../components/editor/Outline";
import { Properties } from "../components/editor/Properties";
import { ThemeTokensContext } from "../components/editor/ThemeTokensContext";
import {
  VersionHistory,
  type VersionRecord,
} from "../components/editor/VersionHistory";
import db from "../db.server";
import { useDraftInspection, useDraftMirror } from "../lib/editor/recovery";
import { useEditorStore } from "../lib/editor/store";
import type { Block, EditorDocument } from "../lib/editor/types";
import { useAutosave } from "../lib/editor/useAutosave";
import { authenticate } from "../shopify.server";
import { getThemeTokens } from "../lib/theme/tokens.server";
import "../styles/editor.css";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

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

  if (!page || page.shop !== shop) {
    throw new Response("Not found", { status: 404 });
  }

  // Theme tokens for the canvas preview. Never throws — defaults are
  // returned on error so a broken theme fetch doesn't break the editor.
  const theme = await getThemeTokens(admin, shop);

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
    theme,
  };
};

export default function PageEditor() {
  const { page, theme } = useLoaderData<typeof loader>();

  const isDirty = useEditorStore((s) => s.isDirty);
  const historyCursor = useEditorStore((s) => s.historyCursor);
  const futureLength = useEditorStore((s) => s.future.length);
  const blocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const { saveStatus, lastSavedAt } = useAutosave(page.id);
  const { status: recovery, dismiss: dismissRecovery } = useDraftInspection(
    page.id,
    page.updatedAt,
  );
  useDraftMirror(page.id);

  const [searchParams, setSearchParams] = useSearchParams();

  const [recoveryDecided, setRecoveryDecided] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from the server doc unless we're waiting on a recovery
  // decision. After hydration, the URL ?b= sync below will pick up any
  // selection from the URL.
  useEffect(() => {
    if (recovery.kind === "recoverable" && !recoveryDecided) return;
    loadDocument(page.source);
    setHydrated(true);
  }, [page.id, page.source, recovery.kind, recoveryDecided, loadDocument]);

  // Restore selection from ?b= on first render after hydration. We do
  // this only once per page-id load — subsequent URL changes are driven
  // by selectBlock below, not the other way around.
  const initialBlockParam = searchParams.get("b");
  useEffect(() => {
    if (!hydrated) return;
    if (!initialBlockParam) return;
    if (blocks.length === 0) return;
    if (!findBlockId(blocks, initialBlockParam)) return;
    selectBlock(initialBlockParam);
    // We deliberately depend only on `hydrated` so this fires once after
    // hydration, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Mirror the current selection into the URL. Use replace so the back
  // button doesn't fill up with selection states.
  useEffect(() => {
    if (!hydrated) return;
    const current = searchParams.get("b");
    if (selectedBlockId && current !== selectedBlockId) {
      const next = new URLSearchParams(searchParams);
      next.set("b", selectedBlockId);
      setSearchParams(next, { replace: true });
    } else if (!selectedBlockId && current) {
      const next = new URLSearchParams(searchParams);
      next.delete("b");
      setSearchParams(next, { replace: true });
    }
  }, [selectedBlockId, hydrated, searchParams, setSearchParams]);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y)
  // = redo. Skip when focus is in an editable element so the browser's
  // native text-undo wins inside inputs / textareas / contenteditable.
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

  const canUndo = historyCursor > 0;
  const canRedo = futureLength > 0;

  // Version history modal + preview state. Preview is purely a parent-
  // level swap on the Canvas — the store never sees the previewed doc,
  // so exiting preview returns to live edits unchanged.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<EditorDocument | null>(null);
  const [previewVersion, setPreviewVersion] = useState<VersionRecord | null>(
    null,
  );

  const handlePreview = (
    doc: EditorDocument | null,
    version: VersionRecord | null,
  ) => {
    setPreviewDoc(doc);
    setPreviewVersion(version);
  };

  const handleRestore = () => {
    if (recovery.kind !== "recoverable") return;
    loadDocument(recovery.draft.document);
    // Mark dirty so autosave persists the restored draft.
    useEditorStore.setState({ isDirty: true });
    setRecoveryDecided(true);
  };

  const handleDiscard = () => {
    dismissRecovery();
    setRecoveryDecided(true);
  };

  // Manual QA helper for crash recovery. Re-enabled in dev for the
  // P1.A chaos test (scripts/p1a-chaos-test.md). Strips in-memory state
  // without calling markSaved, then reloads — the localStorage draft
  // remains and the recovery banner should appear on the next mount.
  // Vite replaces import.meta.env.PROD at build time, so this branch
  // is dead-code-eliminated from production bundles.
  const isDev = !import.meta.env.PROD;
  const simulateCrash = () => {
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
    <ThemeTokensContext.Provider value={theme.tokens}>
    <s-page heading={page.title}>
      <s-button slot="primary-action" href="/app">
        Back to pages
      </s-button>

      <div className="demeurer-editor-toolbar">
        <SaveIndicator
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          isDirty={isDirty}
        />
        <span className="demeurer-theme-indicator" title="Canvas tokens are read from this theme.">
          Theme: {theme.themeName ?? "—"}
        </span>
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
        <s-button onClick={() => setHistoryOpen(true)}>History</s-button>
        {isDev ? (
          <s-button tone="critical" onClick={simulateCrash}>
            Simulate crash (dev)
          </s-button>
        ) : null}
      </div>

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

      <div className="demeurer-editor-grid">
        <Outline />
        <Canvas
          themeTokens={theme.tokens}
          previewDocument={previewDoc ?? undefined}
          banner={
            previewDoc && previewVersion ? (
              <>
                <span>
                  Previewing version from{" "}
                  {new Date(previewVersion.createdAt).toLocaleString()}
                  {previewVersion.label ? ` — “${previewVersion.label}”` : ""}.
                </span>
                <s-button onClick={() => handlePreview(null, null)}>
                  Exit preview
                </s-button>
              </>
            ) : undefined
          }
        />
        <Properties />
      </div>

      <VersionHistory
        pageId={page.id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onPreview={handlePreview}
        previewVersionId={previewVersion?.id ?? null}
      />
    </s-page>
    </ThemeTokensContext.Provider>
  );
}

function findBlockId(blocks: Block[], id: string): string | null {
  for (const b of blocks) {
    if (b.id === id) return id;
    const inner = findBlockId(b.children, id);
    if (inner) return inner;
  }
  return null;
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
