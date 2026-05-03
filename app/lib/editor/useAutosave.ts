import { useEffect, useRef, useState } from "react";

import { useEditorStore } from "./store";
import type { EditorDocument } from "./types";

/**
 * Autosave: subscribe to document edits, debounce, POST, retry.
 *
 * Flow:
 *   document changes + isDirty=true
 *     → wait 400ms (coalesce rapid edits)
 *     → POST /app/api/pages/:id/save
 *     → on 200: store.markSaved(), status = "saved"
 *     → on failure: status = "error", retry with exponential backoff
 *
 * The 400ms debounce is deliberate: fast enough that a tab-close mid-edit
 * loses at most ~half a second of work (and localStorage covers even
 * that), slow enough to coalesce e.g. typing into a text field.
 *
 * Backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped). Resets on the next
 * successful save or when the document changes (a new edit gives the
 * server a new request to try, no point waiting on the old retry timer).
 */

const DEBOUNCE_MS = 400;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
}

export function useAutosave(pageId: string): AutosaveResult {
  const document = useEditorStore((s) => s.document);
  const isDirty = useEditorStore((s) => s.isDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs for timers + retry bookkeeping. We don't want re-renders to
  // restart the debounce or wipe the retry counter.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  // AbortController so a fresh edit cancels an in-flight request whose
  // payload is now stale.
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    // A fresh edit invalidates any pending retry — we have a newer
    // version of the doc to try saving.
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const docToSave = document;
    debounceTimer.current = setTimeout(() => {
      void saveDocument(pageId, docToSave);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, isDirty, pageId]);

  // Cleanup on unmount: cancel timers and any in-flight request.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (inflight.current) inflight.current.abort();
    };
  }, []);

  async function saveDocument(id: string, doc: EditorDocument): Promise<void> {
    // Cancel any prior in-flight request — its payload is stale.
    if (inflight.current) inflight.current.abort();
    const controller = new AbortController();
    inflight.current = controller;

    setSaveStatus("saving");

    try {
      const res = await fetch(`/app/api/pages/${id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: doc }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      // Success — clear retry state and mark the store clean.
      retryCount.current = 0;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      markSaved();
      setSaveStatus("saved");
    } catch (err) {
      // Aborted requests are not failures — a newer edit already kicked
      // off a fresh save, so don't flip to "error".
      if (controller.signal.aborted) return;

      setSaveStatus("error");
      const delay = Math.min(
        BACKOFF_BASE_MS * 2 ** retryCount.current,
        BACKOFF_CAP_MS,
      );
      retryCount.current += 1;
      retryTimer.current = setTimeout(() => {
        // Use the latest document at retry time, not the stale closure.
        // If the user kept editing, the debounce effect will have already
        // scheduled a save with newer content — saveDocument cancels the
        // prior in-flight request, so racing here is safe.
        const latest = useEditorStore.getState().document;
        void saveDocument(id, latest);
      }, delay);
    }
  }

  return {
    saveStatus,
    lastSavedAt: lastSavedAt ? new Date(lastSavedAt) : null,
  };
}
