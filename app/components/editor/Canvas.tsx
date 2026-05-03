// PLACEHOLDER CANVAS — replaced in P1.B by iframe theme preview.
// The selection model and layout in this file are the contracts the
// real canvas must honor: clicking a block fires store.selectBlock(id),
// the selected block visually distinguishes itself, and the outer pane
// scrolls (the iframe will be drop-in inside this same scroll container).

import { useEditorStore } from "../../lib/editor/store";
import type { Block, EditorDocument } from "../../lib/editor/types";

export interface CanvasProps {
  /**
   * If provided, the canvas renders this document instead of the live
   * store. Used by the version-history preview path. When set, the
   * canvas is non-interactive (clicks don't change selection).
   */
  previewDocument?: EditorDocument;
  /** Optional banner shown above the page-frame, e.g. during preview. */
  banner?: React.ReactNode;
}

export function Canvas({ previewDocument, banner }: CanvasProps) {
  const liveBlocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);

  const isPreview = !!previewDocument;
  const blocks = isPreview ? previewDocument!.blocks : liveBlocks;

  const handleEmptyClick = () => {
    if (isPreview) return;
    selectBlock(null);
  };

  return (
    <div
      className={
        "demeurer-editor-pane demeurer-canvas" +
        (isPreview ? " demeurer-canvas-preview" : "")
      }
      onClick={handleEmptyClick}
    >
      {banner ? <div className="demeurer-canvas-banner">{banner}</div> : null}
      <div
        className="demeurer-canvas-page"
        onClick={(e) => e.stopPropagation()}
      >
        {blocks.length === 0 ? (
          <div className="demeurer-canvas-empty">
            <p>This page has no blocks{isPreview ? " in this version" : " yet"}.</p>
            {!isPreview ? (
              <p className="demeurer-canvas-empty-sub">
                Use the outline on the left to add one.
              </p>
            ) : null}
          </div>
        ) : (
          blocks.map((block) => (
            <BlockPlaceholder
              key={block.id}
              block={block}
              isSelected={!isPreview && selectedBlockId === block.id}
              onSelect={isPreview ? undefined : () => selectBlock(block.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface BlockPlaceholderProps {
  block: Block;
  isSelected: boolean;
  /** Omit to render the placeholder as non-interactive (preview mode). */
  onSelect?: () => void;
}

function BlockPlaceholder({
  block,
  isSelected,
  onSelect,
}: BlockPlaceholderProps) {
  const interactive = !!onSelect;
  return (
    <div
      className={
        "demeurer-block-placeholder" +
        (isSelected ? " demeurer-block-placeholder-selected" : "") +
        (!interactive ? " demeurer-block-placeholder-readonly" : "")
      }
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <div className="demeurer-block-placeholder-header">
        <span className="demeurer-block-placeholder-type">{block.type}</span>
        <span className="demeurer-block-placeholder-id">
          {block.id.slice(-6)}
        </span>
      </div>
      <pre className="demeurer-block-placeholder-props">
        {previewProps(block.props)}
      </pre>
    </div>
  );
}

/**
 * Render a short, single-line preview of props. Full JSON would blow up
 * the placeholder — this is just enough for the user to recognize the
 * block. The right-side properties panel shows full props.
 */
function previewProps(props: Record<string, unknown>): string {
  const entries = Object.entries(props).slice(0, 3);
  if (entries.length === 0) return "{}";
  const inner = entries
    .map(([k, v]) => {
      const val =
        typeof v === "string"
          ? `"${v.length > 30 ? `${v.slice(0, 29)}…` : v}"`
          : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join(", ");
  return `{ ${inner}${Object.keys(props).length > 3 ? ", …" : ""} }`;
}
