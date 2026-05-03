import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";

import type {
  Field,
  ListField as ListFieldDef,
} from "../../../lib/sections";
import { FieldRenderer } from "./FieldRenderer";
import type { FieldRendererProps } from "./types";

/**
 * Repeating-item field with drag-to-reorder, add, and remove.
 *
 * Each item is a Record keyed by the inner field keys; mutating one
 * key shallow-merges back into the item bag (mirrors GroupField).
 *
 * dnd-kit needs stable IDs across renders, so we keep a parallel
 * `ids` array in component state. It only resets when the length
 * disagrees with the incoming value (undo/redo, version restore).
 */
export function ListField({
  field,
  value,
  onChange,
}: FieldRendererProps<ListFieldDef>) {
  const items = Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : field.default ?? [];

  const idsRef = useRef<string[]>([]);
  const [, force] = useState(0);

  // Keep ID array in sync with item count. We don't try to track
  // identity across re-orders coming from outside this component
  // (e.g. undo) — restoring the array drops to fresh IDs and that's
  // fine because dnd-kit just re-mounts items on the next drag.
  if (idsRef.current.length !== items.length) {
    idsRef.current = items.map((_, i) => idsRef.current[i] ?? newId());
  }
  const ids = idsRef.current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const setItems = (next: Record<string, unknown>[], nextIds: string[]) => {
    idsRef.current = nextIds;
    onChange(next);
    // Force re-render so the new ids are reflected immediately.
    force((n) => n + 1);
  };

  const handleAdd = () => {
    if (typeof field.maxItems === "number" && items.length >= field.maxItems) {
      return;
    }
    const fresh = buildItemDefaults(field.itemSchema);
    setItems([...items, fresh], [...ids, newId()]);
  };

  const handleRemove = (index: number) => {
    const nextItems = items.slice();
    nextItems.splice(index, 1);
    const nextIds = ids.slice();
    nextIds.splice(index, 1);
    setItems(nextItems, nextIds);
  };

  const handleItemChange = (index: number, next: Record<string, unknown>) => {
    const nextItems = items.slice();
    nextItems[index] = next;
    setItems(nextItems, ids);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setItems(
      arrayMove(items, oldIndex, newIndex),
      arrayMove(ids, oldIndex, newIndex),
    );
  };

  const atMax =
    typeof field.maxItems === "number" && items.length >= field.maxItems;

  return (
    <div className="demeurer-field-list">
      <div className="demeurer-field-list-header">
        <span className="demeurer-field-list-label">{field.label}</span>
        <span className="demeurer-field-list-count">
          {items.length}
          {typeof field.maxItems === "number" ? `/${field.maxItems}` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="demeurer-field-list-empty">No items yet.</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="demeurer-field-list-items">
              {items.map((item, index) => (
                <SortableListItem
                  key={ids[index]}
                  id={ids[index]}
                  index={index}
                  itemSchema={field.itemSchema}
                  item={item}
                  onChange={(next) => handleItemChange(index, next)}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <s-button
        onClick={handleAdd}
        {...(atMax ? { disabled: true } : {})}
      >
        Add item
      </s-button>
    </div>
  );
}

interface SortableListItemProps {
  id: string;
  index: number;
  itemSchema: Field[];
  item: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onRemove: () => void;
}

function SortableListItem({
  id,
  index,
  itemSchema,
  item,
  onChange,
  onRemove,
}: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const [open, setOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleChild = (key: string, next: unknown) => {
    onChange({ ...item, [key]: next });
  };

  const summary = buildItemSummary(itemSchema, item, index);

  return (
    <div ref={setNodeRef} style={style} className="demeurer-field-list-item">
      <div className="demeurer-field-list-item-header">
        <button
          type="button"
          className="demeurer-field-list-handle"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          className="demeurer-field-list-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="demeurer-field-list-caret">{open ? "▾" : "▸"}</span>
          <span className="demeurer-field-list-summary">{summary}</span>
        </button>
        <button
          type="button"
          className="demeurer-field-list-remove"
          aria-label="Remove item"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
      {open ? (
        <div className="demeurer-field-list-item-body">
          {itemSchema.map((child) => (
            <FieldRenderer
              key={child.key}
              field={child}
              value={item[child.key]}
              onChange={(next) => handleChild(child.key, next)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildItemDefaults(schema: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema) {
    out[f.key] = defaultForField(f);
  }
  return out;
}

function defaultForField(f: Field): unknown {
  switch (f.kind) {
    case "text":
    case "richtext":
    case "image":
    case "url":
    case "color":
      return f.default ?? "";
    case "select":
      return f.default ?? f.options[0]?.value ?? "";
    case "number":
      return f.default ?? 0;
    case "boolean":
      return f.default ?? false;
    case "spacing":
      return f.default ?? { top: 0, right: 0, bottom: 0, left: 0 };
    case "group":
      return buildItemDefaults(f.fields);
    case "list":
      return f.default ?? [];
  }
}

function buildItemSummary(
  schema: Field[],
  item: Record<string, unknown>,
  index: number,
): string {
  // Use the first text-shaped field's value as the summary, truncated.
  const textField = schema.find(
    (f) => f.kind === "text" || f.kind === "richtext",
  );
  if (textField) {
    const raw = item[textField.key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      const stripped = raw.replace(/<[^>]*>/g, "").trim();
      if (stripped.length > 60) return `${stripped.slice(0, 60)}…`;
      if (stripped.length > 0) return stripped;
    }
  }
  return `Item ${index + 1}`;
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `li_${Date.now().toString(36)}_${counter}`;
}

