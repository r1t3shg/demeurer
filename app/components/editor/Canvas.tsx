// Canvas — placeholder, P1.B segment 1.
//
// Renders each block by looking up its section definition in the registry
// and calling its <Render> component with current props + theme tokens.
// Click a section to select it; clicking empty space clears selection.
//
// Theme tokens are stubbed for now. Segment 3 swaps this for the iframe
// theme preview, at which point real tokens flow in from the storefront.

import { getSection } from "../../lib/sections";
import type { ThemeTokens } from "../../lib/sections";
import { useEditorStore } from "../../lib/editor/store";
import type { Block, EditorDocument } from "../../lib/editor/types";

const STUB_TOKENS: ThemeTokens = {
  colors: {
    background: "#ffffff",
    text: "#1a1a1a",
    accent: "#1a73e8",
  },
  typography: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    scale: 1,
  },
  spacing: { unit: 8 },
};

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
            <SectionFrame
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

interface SectionFrameProps {
  block: Block;
  isSelected: boolean;
  /** Omit to render the section as non-interactive (preview mode). */
  onSelect?: () => void;
}

/**
 * Wraps a section's <Render> output with selection chrome (border on
 * hover/select) and click handling. The section's own markup goes
 * inside, untouched.
 */
function SectionFrame({ block, isSelected, onSelect }: SectionFrameProps) {
  const interactive = !!onSelect;
  const def = getSection(block.type);

  if (!def) {
    return (
      <div className="demeurer-section-unknown">
        <strong>Unknown section:</strong> {block.type}
        <p>This block type isn't registered. Was the section folder added but not imported in <code>app/lib/sections/index.ts</code>?</p>
      </div>
    );
  }

  const { Render } = def;

  return (
    <div
      className={
        "demeurer-section-frame" +
        (isSelected ? " demeurer-section-frame-selected" : "") +
        (!interactive ? " demeurer-section-frame-readonly" : "")
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
      aria-label={interactive ? `Select ${def.label} section` : undefined}
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
      <Render props={block.props} themeTokens={STUB_TOKENS} />
    </div>
  );
}
