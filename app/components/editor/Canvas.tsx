/**
 * Canvas — iframe theme preview.
 *
 * The canvas is a same-origin iframe that loads `/preview/<pageId>`,
 * which SSR-renders each block via its registered <Render> with the
 * merchant's theme stylesheets attached. Visual fidelity comes from
 * sharing the section's Render function and the theme's CSS; runtime
 * fidelity comes from being an iframe with the merchant's full theme
 * loaded.
 *
 * Reload model: cacheKey = `lastSavedAt`. The store's autosave hook
 * (~400 ms debounce) is the source of truth. When autosave completes,
 * lastSavedAt advances → iframe URL changes → iframe reloads with
 * fresh server state. This is strictly better than a parallel
 * 600 ms debounce (which would race autosave) and the result is the
 * same: the canvas reflects every committed edit within ~half a second.
 *
 * Architectural commitment: nothing rendered here ships to the live
 * storefront. The shell CSS, bridge JS, and editor outlines live only
 * inside the iframe. The published Liquid output is what the merchant's
 * theme renders directly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getSection } from "../../lib/sections";
import { useProduct } from "./ProductContext";
import type { ThemeTokens } from "../../lib/sections";
import { BREAKPOINT_META } from "../../lib/editor/breakpoints";
import { resolveProps } from "../../lib/editor/resolve";
import { useEditorStore } from "../../lib/editor/store";
import type { Block, Breakpoint, EditorDocument } from "../../lib/editor/types";

/**
 * Skeleton-loader debounce. Fast breakpoint switches that complete
 * within this window never flash the spinner — they swap one rendered
 * iframe for another with no intermediate "loading" UI. Slower loads
 * (cold paint, network blip) still show the skeleton normally.
 */
const SKELETON_DELAY_MS = 100;

interface PreviewMessage {
  type: string;
  blockId?: string;
  y?: number;
}

export interface CanvasProps {
  /** Live theme tokens. Used by the inline (version-history) preview path. */
  themeTokens: ThemeTokens;
  /** Page id for the iframe URL. */
  pageId: string;
  /**
   * Pre-built query string from `buildPreviewQuery(signPreviewToken(...))`,
   * passed in by the route loader. Includes the HMAC-signed token, the
   * shop, expiry, and pageId — everything the preview route needs to
   * authenticate the request.
   */
  previewQuery: string;
  /**
   * If provided, renders this document inline (no iframe). Used by the
   * version-history preview path so the merchant can compare an older
   * snapshot against the live edit without a round-trip through the
   * preview endpoint. Non-interactive.
   */
  previewDocument?: EditorDocument;
  /** Optional banner shown above the canvas (e.g. version-preview chrome). */
  banner?: React.ReactNode;
}

export function Canvas({
  themeTokens,
  pageId,
  previewQuery,
  previewDocument,
  banner,
}: CanvasProps) {
  const isPreview = !!previewDocument;

  if (isPreview) {
    return (
      <InlinePreview
        themeTokens={themeTokens}
        document={previewDocument!}
        banner={banner}
      />
    );
  }

  return (
    <IframeCanvas
      pageId={pageId}
      previewQuery={previewQuery}
      banner={banner}
    />
  );
}

/* ------------------------------ Iframe path ------------------------------ */

interface IframeCanvasProps {
  pageId: string;
  previewQuery: string;
  banner?: React.ReactNode;
}

function IframeCanvas({ pageId, previewQuery, banner }: IframeCanvasProps) {
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);

  // cacheKey = lastSavedAt. Initial null becomes "init".
  const cacheKey = lastSavedAt ?? 0;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const scrollYRef = useRef<number>(0);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Stable token that we bump only when we want to force-reload (e.g.
  // user clicks Retry).
  const [retryNonce, setRetryNonce] = useState(0);
  // Whether the loading overlay is actually visible — gates the spinner
  // behind a 100 ms debounce so quick reloads (e.g. tapping through the
  // breakpoint switcher) don't flash a skeleton.
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    if (loadStatus !== "loading") {
      setShowSkeleton(false);
      return;
    }
    const t = window.setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [loadStatus]);

  const previewSrc = useMemo(() => {
    return `/preview/${encodeURIComponent(pageId)}?${previewQuery}&v=${cacheKey}&r=${retryNonce}&bp=${activeBreakpoint}`;
  }, [pageId, previewQuery, cacheKey, retryNonce, activeBreakpoint]);

  // Capture scroll just before the src changes so we can restore after
  // reload. We watch the URL itself rather than each input so any
  // change (cacheKey, retry) gets the same treatment.
  const lastSrcRef = useRef(previewSrc);
  useEffect(() => {
    if (previewSrc === lastSrcRef.current) return;
    const win = iframeRef.current?.contentWindow;
    try {
      scrollYRef.current = win?.scrollY ?? 0;
    } catch {
      // Same-origin should make this safe, but guard anyway.
      scrollYRef.current = 0;
    }
    lastSrcRef.current = previewSrc;
    setLoadStatus("loading");
  }, [previewSrc]);

  // Listen for messages from the iframe.
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as PreviewMessage | null;
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "demeurer:select-block" && typeof msg.blockId === "string") {
        selectBlock(msg.blockId);
      } else if (msg.type === "demeurer:ready") {
        // The iframe just finished loading. Sync the current selection
        // and restore the scroll position.
        post({
          type: "demeurer:set-selection",
          blockId: selectedBlockId ?? undefined,
        });
        if (scrollYRef.current > 0) {
          post({ type: "demeurer:restore-scroll", y: scrollYRef.current });
        }
        setLoadStatus("ready");
      }
    },
    // selectedBlockId intentionally read fresh on each event: capture
    // via ref pattern would obscure the simple deps story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectBlock, selectedBlockId],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Push selection changes from the editor into the iframe.
  useEffect(() => {
    if (loadStatus !== "ready") return;
    post({
      type: "demeurer:set-selection",
      blockId: selectedBlockId ?? undefined,
    });
  }, [selectedBlockId, loadStatus]);

  function post(msg: PreviewMessage) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(msg, window.location.origin);
    } catch {
      // Cross-origin guard — shouldn't fire, but don't crash if it does.
    }
  }

  // The iframe load event fires for both successful and error responses.
  // For error responses (4xx/5xx HTML body), the bridge script still
  // runs and posts demeurer:ready, so loadStatus moves to "ready".
  // Distinguishing a real error currently relies on watching for an
  // explicit error response payload — out of scope for MVP. Network
  // failures (no response at all) leave loadStatus stuck on "loading"
  // until the user hits Retry.
  const handleIframeError = () => {
    setLoadStatus("error");
    setErrorMsg("The preview iframe failed to load.");
  };

  const handleRetry = () => {
    setErrorMsg(null);
    setLoadStatus("loading");
    setRetryNonce((n) => n + 1);
  };

  const meta = BREAKPOINT_META[activeBreakpoint];

  return (
    <div
      className={
        "demeurer-editor-pane demeurer-canvas" +
        (meta.centered ? " demeurer-canvas--device" : " demeurer-canvas--desk")
      }
      data-bp={activeBreakpoint}
    >
      {banner ? <div className="demeurer-canvas-banner">{banner}</div> : null}
      <div className="demeurer-canvas-stage">
        <div
          className="demeurer-canvas-frame-wrap"
          style={{ maxWidth: meta.editorMaxWidth }}
        >
          <iframe
            ref={iframeRef}
            src={previewSrc}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Page preview"
            className="demeurer-canvas-iframe"
            onError={handleIframeError}
          />
          {loadStatus === "loading" && showSkeleton ? (
            <div className="demeurer-canvas-loading" aria-live="polite">
              <s-spinner accessibilityLabel="Loading preview" size="large" />
            </div>
          ) : null}
          {loadStatus === "error" ? (
            <div className="demeurer-canvas-error" role="alert">
              <h3>Couldn't render preview</h3>
              {errorMsg ? <p>{errorMsg}</p> : null}
              <s-button onClick={handleRetry}>Retry</s-button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Inline (version preview) ----------------------- */

interface InlinePreviewProps {
  themeTokens: ThemeTokens;
  document: EditorDocument;
  banner?: React.ReactNode;
}

function InlinePreview({ themeTokens, document, banner }: InlinePreviewProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  return (
    <div className="demeurer-editor-pane demeurer-canvas demeurer-canvas-preview">
      {banner ? <div className="demeurer-canvas-banner">{banner}</div> : null}
      <div className="demeurer-canvas-page">
        {document.blocks.length === 0 ? (
          <div className="demeurer-canvas-empty">
            <p>This page has no blocks in this version.</p>
          </div>
        ) : (
          document.blocks.map((block) => (
            <InlineBlock
              key={block.id}
              block={block}
              themeTokens={themeTokens}
              breakpoint={activeBreakpoint}
            />
          ))
        )}
      </div>
    </div>
  );
}

function InlineBlock({
  block,
  themeTokens,
  breakpoint,
}: {
  block: Block;
  themeTokens: ThemeTokens;
  breakpoint: Breakpoint;
}) {
  const def = getSection(block.type);
  const product = useProduct();
  if (!def) {
    return (
      <div className="demeurer-section-unknown">
        <strong>Unknown section:</strong> {block.type}
      </div>
    );
  }
  const { Render } = def;
  const resolved = resolveProps(block, breakpoint);
  // Visibility (P1.C segment 3): hidden blocks render as a faded
  // placeholder so the merchant can still see + re-enable them.
  if (resolved._visibility === false) {
    return (
      <div className="demeurer-section-frame demeurer-section-frame-readonly demeurer-preview-hidden">
        <span className="demeurer-preview-hidden__label">
          {def.label ?? block.type}
        </span>
        <span className="demeurer-preview-hidden__hint">
          Hidden at this breakpoint
        </span>
      </div>
    );
  }
  // Pass `product` only to sections whose definition opted in via
  // `productAware: true`. Keeps non-product-aware Render functions
  // pure (their type signature doesn't accept product anyway, but
  // omitting the prop is the cleaner contract).
  const renderProps = def.productAware
    ? { props: resolved, themeTokens, product }
    : { props: resolved, themeTokens };
  return (
    <div className="demeurer-section-frame demeurer-section-frame-readonly">
      <Render {...renderProps} />
    </div>
  );
}
