import { useEffect, useRef, useState } from "react";

import { newBlockId } from "../../lib/editor/ids";
import { useEditorStore } from "../../lib/editor/store";
import type { Block } from "../../lib/editor/types";

/**
 * Outline panel — a tree view of the document's block hierarchy.
 *
 * Click a row to select; hover to reveal a delete affordance. Drag
 * handle is visual-only this segment (real reorder lands in segment 5).
 *
 * Tree rendering caps at 2 levels (top-level + their direct children).
 * Anything deeper is rare in practice and adds complexity we don't need
 * until we have a real section system.
 */

const STUB_BLOCKS: { kind: string; label: string; build: () => Block }[] = [
  {
    kind: "hero",
    label: "Add stub hero",
    build: () => ({
      id: newBlockId(),
      type: "hero",
      props: { title: "Hero title", body: "Hero body text." },
      children: [],
    }),
  },
  {
    kind: "text",
    label: "Add stub text",
    build: () => ({
      id: newBlockId(),
      type: "text",
      props: { text: "Lorem ipsum dolor sit amet." },
      children: [],
    }),
  },
  {
    kind: "image",
    label: "Add stub image",
    build: () => ({
      id: newBlockId(),
      type: "image",
      props: {
        src: "https://placehold.co/1200x600",
        alt: "Placeholder image",
      },
      children: [],
    }),
  },
];

export function Outline() {
  const blocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const removeBlock = useEditorStore((s) => s.removeBlock);

  return (
    <div className="demeurer-editor-pane demeurer-outline">
      <div className="demeurer-pane-header">Outline</div>
      <div className="demeurer-outline-list">
        {blocks.length === 0 ? (
          <div className="demeurer-outline-empty">
            No blocks yet. Use “Add block” below.
          </div>
        ) : (
          blocks.map((block) => (
            <OutlineNode
              key={block.id}
              block={block}
              depth={0}
              selectedBlockId={selectedBlockId}
              onSelect={selectBlock}
              onDelete={removeBlock}
            />
          ))
        )}
      </div>
      <div className="demeurer-outline-footer">
        <AddBlockMenu onAdd={(b) => addBlock(b)} />
      </div>
    </div>
  );
}

interface OutlineNodeProps {
  block: Block;
  depth: number;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function OutlineNode({
  block,
  depth,
  selectedBlockId,
  onSelect,
  onDelete,
}: OutlineNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedBlockId === block.id;
  const hasChildren = block.children.length > 0;
  const showChildren = depth < 1 && hasChildren && expanded;

  return (
    <>
      <div
        className={
          "demeurer-outline-row" +
          (isSelected ? " demeurer-outline-row-selected" : "")
        }
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(block.id)}
      >
        <span
          className="demeurer-drag-handle"
          aria-hidden="true"
          title="Drag to reorder (coming soon)"
        >
          <DragDots />
        </span>
        {hasChildren && depth < 1 ? (
          <button
            type="button"
            className="demeurer-outline-chevron"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="demeurer-outline-chevron-spacer" />
        )}
        <span className="demeurer-outline-type">{block.type}</span>
        <span className="demeurer-outline-label">{labelFor(block)}</span>
        <button
          type="button"
          className="demeurer-outline-delete"
          aria-label="Delete block"
          title="Delete block"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
        >
          <TrashIcon />
        </button>
      </div>
      {showChildren
        ? block.children.map((child) => (
            <OutlineNode
              key={child.id}
              block={child}
              depth={depth + 1}
              selectedBlockId={selectedBlockId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  );
}

function labelFor(block: Block): string {
  const props = block.props;
  // Prefer the most "title-ish" prop; fall back to a content snippet.
  const candidates = [props.title, props.heading, props.text, props.alt];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return truncate(c.trim(), 40);
    }
  }
  return "(no label)";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface AddBlockMenuProps {
  onAdd: (block: Block) => void;
}

function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="demeurer-add-menu" ref={containerRef}>
      <button
        type="button"
        className="demeurer-add-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        + Add block
      </button>
      {open ? (
        <div role="menu" className="demeurer-add-popover">
          {STUB_BLOCKS.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              role="menuitem"
              className="demeurer-add-item"
              onClick={() => {
                onAdd(entry.build());
                setOpen(false);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DragDots() {
  // Six-dot drag handle, two columns × three rows.
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <circle cx="2" cy="3" r="1.2" fill="currentColor" />
      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
      <circle cx="2" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="2" cy="13" r="1.2" fill="currentColor" />
      <circle cx="8" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 2h6v1h3v2H2V3h3V2zm-1 4h8l-.7 8.1a1 1 0 0 1-1 .9H5.7a1 1 0 0 1-1-.9L4 6z"
        fill="currentColor"
      />
    </svg>
  );
}
