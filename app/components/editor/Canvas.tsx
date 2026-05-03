// PLACEHOLDER CANVAS — replaced in P1.B by iframe theme preview.
// The selection model and layout in this file are the contracts the
// real canvas must honor: clicking a block fires store.selectBlock(id),
// the selected block visually distinguishes itself, and the outer pane
// scrolls (the iframe will be drop-in inside this same scroll container).

import { useEditorStore } from "../../lib/editor/store";
import type { Block } from "../../lib/editor/types";

export function Canvas() {
  const blocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);

  return (
    <div
      className="demeurer-editor-pane demeurer-canvas"
      // Click on empty canvas (paper background) clears selection. The
      // page-frame absorbs clicks separately so this only fires for
      // outside clicks.
      onClick={() => selectBlock(null)}
    >
      <div
        className="demeurer-canvas-page"
        onClick={(e) => e.stopPropagation()}
      >
        {blocks.length === 0 ? (
          <div className="demeurer-canvas-empty">
            <p>This page has no blocks yet.</p>
            <p className="demeurer-canvas-empty-sub">
              Use the outline on the left to add one.
            </p>
          </div>
        ) : (
          blocks.map((block) => (
            <BlockPlaceholder
              key={block.id}
              block={block}
              isSelected={selectedBlockId === block.id}
              onSelect={() => selectBlock(block.id)}
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
  onSelect: () => void;
}

function BlockPlaceholder({
  block,
  isSelected,
  onSelect,
}: BlockPlaceholderProps) {
  return (
    <div
      className={
        "demeurer-block-placeholder" +
        (isSelected ? " demeurer-block-placeholder-selected" : "")
      }
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
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
