import type { EditorDocument } from "./types";

/**
 * Cap on the undo stack. Each entry is a deep snapshot of the document;
 * 100 entries is generous for a normal editing session while bounding
 * memory growth on very long sessions.
 */
export const MAX_HISTORY = 100;

/**
 * Take a deep, structurally-independent snapshot of the document.
 *
 * `structuredClone` is built into modern Node and the browser; it handles
 * arrays/objects/Date/JSON-safe values correctly without us pulling in a
 * deep-clone library. Immer drafts are plain JS once produced, so this is
 * safe to call inside or outside an immer `produce`.
 */
export function snapshotDocument(doc: EditorDocument): EditorDocument {
  return structuredClone(doc);
}
