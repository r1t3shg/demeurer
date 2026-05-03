import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as LucideIcons from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { handleOutlineDragEnd } from "../../lib/editor/dnd";
import { newBlockId } from "../../lib/editor/ids";
import { useEditorStore } from "../../lib/editor/store";
import type { Block } from "../../lib/editor/types";
import { wrapMobileProps } from "../../lib/editor/types";
import { listSectionsByCategory } from "../../lib/sections";
import type { SectionCategory, SectionDefinition } from "../../lib/sections";

/**
 * Outline panel — a tree view of the document's block hierarchy.
 *
 * Top-level blocks are sortable via @dnd-kit. The drag handle (six-dot
 * icon on the left) is the only activator — clicking the row body still
 * selects the block. Nested children are not sortable in P1.A; that lands
 * with the section system in P1.B.
 *
 * Tree rendering caps at 2 levels (top-level + their direct children).
 */

const CATEGORY_LABELS: Record<SectionCategory, string> = {
  layout: "Layout",
  content: "Content",
  media: "Media",
  form: "Form",
  advanced: "Advanced",
};

/** Build a fresh Block from a section definition with its declared defaults. */
function buildBlockFromSection(def: SectionDefinition): Block {
  // Section authors declare flat defaults; wrap them as the canonical
  // mobile layer so the document invariant holds. (The store also
  // defends against flat props, but wrapping here keeps the contract
  // local to the call site.)
  return {
    id: newBlockId(),
    type: def.type,
    props: wrapMobileProps(def.defaults),
    children: [],
  };
}

export function Outline() {
  const blocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const removeBlock = useEditorStore((s) => s.removeBlock);

  // PointerSensor with a 5px activation distance lets a click on the
  // drag handle still register as a click (e.g. for keyboard focus)
  // while a real drag motion picks the item up.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  return (
    <div className="demeurer-editor-pane demeurer-outline">
      <div className="demeurer-pane-header">Outline</div>
      <div className="demeurer-outline-list">
        {blocks.length === 0 ? (
          <div className="demeurer-outline-empty">
            No blocks yet. Use “Add block” below.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleOutlineDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block) => (
                <SortableOutlineNode
                  key={block.id}
                  block={block}
                  selectedBlockId={selectedBlockId}
                  onSelect={selectBlock}
                  onDelete={removeBlock}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
      <div className="demeurer-outline-footer">
        <AddBlockMenu onAdd={(b) => addBlock(b)} />
      </div>
    </div>
  );
}

interface SortableOutlineNodeProps {
  block: Block;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableOutlineNode({
  block,
  selectedBlockId,
  onSelect,
  onDelete,
}: SortableOutlineNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 6px 16px rgba(0, 0, 0, 0.15)" : undefined,
    // Lift the dragged row above the rest so its shadow isn't clipped
    // by the next row's background.
    zIndex: isDragging ? 2 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <OutlineNode
        block={block}
        depth={0}
        selectedBlockId={selectedBlockId}
        onSelect={onSelect}
        onDelete={onDelete}
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
        isOver={isOver}
      />
    </div>
  );
}

interface OutlineNodeProps {
  block: Block;
  depth: number;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  // Top-level rows receive dnd-kit handle wiring; nested rows don't.
  dragHandleRef?: (node: HTMLElement | null) => void;
  dragHandleProps?: Record<string, unknown>;
  isOver?: boolean;
}

function OutlineNode({
  block,
  depth,
  selectedBlockId,
  onSelect,
  onDelete,
  dragHandleRef,
  dragHandleProps,
  isOver,
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
          (isSelected ? " demeurer-outline-row-selected" : "") +
          (isOver ? " demeurer-outline-row-over" : "")
        }
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(block.id)}
      >
        <span
          ref={dragHandleRef}
          className="demeurer-drag-handle"
          aria-label={dragHandleRef ? "Drag to reorder" : undefined}
          // Don't let the drag handle's mousedown bubble into the row
          // and trigger a selection — the click selection only fires
          // when the user actually clicks (no drag occurred).
          onClick={(e) => e.stopPropagation()}
          {...(dragHandleProps ?? {})}
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
  // Labels read from the canonical mobile layer — they don't change
  // per breakpoint, and showing a different label depending on the
  // editor's active breakpoint would be more confusing than useful.
  const props = block.props.mobile;
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

  // Re-read the registry every render — sections register at module load
  // so this is stable, but doing it inline keeps the picker honest as
  // sections are added in later segments.
  const grouped = listSectionsByCategory();
  const orderedCategories: SectionCategory[] = [
    "layout",
    "content",
    "media",
    "form",
    "advanced",
  ];

  return (
    <div className="demeurer-add-menu" ref={containerRef}>
      <button
        type="button"
        className="demeurer-add-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        + Add section
      </button>
      {open ? (
        <div role="menu" className="demeurer-add-popover">
          {orderedCategories.map((cat) => {
            const sections = grouped[cat];
            if (sections.length === 0) return null;
            return (
              <div key={cat} className="demeurer-add-group">
                <div className="demeurer-add-group-label">
                  {CATEGORY_LABELS[cat]}
                </div>
                {sections.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    role="menuitem"
                    className="demeurer-add-item"
                    onClick={() => {
                      onAdd(buildBlockFromSection(def));
                      setOpen(false);
                    }}
                  >
                    <SectionIcon name={def.icon} />
                    <span className="demeurer-add-item-label">{def.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Look up a lucide-react icon by name. Falls back to the `Box` icon if
 * the name isn't found, since a missing icon shouldn't break the picker.
 */
function SectionIcon({ name }: { name: string }) {
  // The lucide-react module exposes every icon as a named export. We
  // index it by string here; the cast is unavoidable because the export
  // map is too large to enumerate in types.
  const icons = LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> | undefined
  >;
  const Icon = icons[name] ?? icons.Box;
  if (!Icon) return null;
  return <Icon size={16} aria-hidden />;
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
