import type { DragEndEvent } from "@dnd-kit/core";

import { useEditorStore } from "./store";

/**
 * Drag-end handler for the outline.
 *
 * For P1.A we only support reordering at the top level — nested children
 * stay put. Cross-level drag (re-parenting a block into a container) is
 * a P1.B concern once we have real section types with explicit child
 * slots.
 *
 * The reorder is funneled through `store.moveBlock`, so it shows up in
 * undo/redo and triggers the autosave just like any other mutation.
 */
export function handleOutlineDragEnd(event: DragEndEvent): void {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const { document, moveBlock } = useEditorStore.getState();
  const blocks = document.blocks;

  const fromIndex = blocks.findIndex((b) => b.id === active.id);
  const toIndex = blocks.findIndex((b) => b.id === over.id);

  // Bail if either id isn't a top-level block. This protects against
  // future cross-level drags accidentally rearranging the top level.
  if (fromIndex === -1 || toIndex === -1) return;

  // moveBlock takes the FINAL index (after the drag-out). dnd-kit's
  // dragEnd reports the over.id at the position the dragged item is
  // hovering — translating that to a final index requires accounting
  // for the drag direction:
  //   - dragging down (fromIndex < toIndex): the item displaces
  //     downward; the final index in the post-removal list is toIndex.
  //   - dragging up (fromIndex > toIndex): final index is just toIndex.
  // moveBlock removes first, then inserts, so passing toIndex directly
  // matches dnd-kit's semantics.
  moveBlock(active.id as string, null, toIndex);
}
