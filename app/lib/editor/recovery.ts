import { useEffect, useState } from "react";

import { useEditorStore } from "./store.ts";
import type { EditorDocument } from "./types.ts";
import { isDocument } from "./types.ts";

/**
 * Crash recovery via localStorage.
 *
 * The autosave hook handles the normal case — the user types, we POST
 * every 400ms, the server is the source of truth. localStorage is the
 * safety net for the catastrophic case: browser crash, tab close, kernel
 * panic between debounce and POST.
 *
 * Key shape: `demeurer:draft:<pageId>`
 * Value:    `{ document, savedAt, dirtyAt }`
 *   - savedAt: server's `updatedAt` at the time of the last successful
 *     save (ISO string). Used to decide if the draft is "newer than the
 *     server" on next mount.
 *   - dirtyAt: Date.now() at the moment we wrote the draft. This is the
 *     timestamp shown in the recovery banner ("from 12 seconds ago").
 */

const KEY_PREFIX = "demeurer:draft:";

interface DraftRecord {
  document: EditorDocument;
  savedAt: string | null;
  dirtyAt: number;
}

const draftKey = (pageId: string) => `${KEY_PREFIX}${pageId}`;

function safeStorage(): Storage | null {
  // SSR-safe access — loaders never call these helpers, but the
  // `useEditorStore.subscribe` mirror runs in module scope, and we want
  // to be defensive against odd environments (private mode quotas, etc.).
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function writeDraft(
  pageId: string,
  document: EditorDocument,
  savedAt: string | null,
): void {
  const storage = safeStorage();
  if (!storage) return;
  const record: DraftRecord = {
    document,
    savedAt,
    dirtyAt: Date.now(),
  };
  try {
    storage.setItem(draftKey(pageId), JSON.stringify(record));
  } catch {
    // Quota exceeded or storage disabled — swallow. Autosave still wins.
  }
}

export function readDraft(pageId: string): DraftRecord | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(draftKey(pageId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const r = parsed as Record<string, unknown>;
    if (
      isDocument(r.document) &&
      (r.savedAt === null || typeof r.savedAt === "string") &&
      typeof r.dirtyAt === "number"
    ) {
      return {
        document: r.document,
        savedAt: r.savedAt,
        dirtyAt: r.dirtyAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraft(pageId: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(pageId));
  } catch {
    // Ignore — best-effort cleanup.
  }
}

/**
 * Decision returned to the editor route on mount:
 *  - "none": no draft (or draft is older than the server) — load server doc.
 *  - "stale": draft exists but server is newer — clear draft, load server.
 *  - "recoverable": draft is newer than server — show banner, let user pick.
 */
export type RecoveryStatus =
  | { kind: "none" }
  | { kind: "stale" }
  | { kind: "recoverable"; draft: DraftRecord };

export function inspectDraft(
  pageId: string,
  serverUpdatedAtIso: string,
): RecoveryStatus {
  const draft = readDraft(pageId);
  if (!draft) return { kind: "none" };

  const serverMs = Date.parse(serverUpdatedAtIso);
  // If the server has saved more recently than our draft was dirtied, the
  // draft is stale — almost certainly the user successfully saved on
  // another tab/device and this localStorage entry is leftover.
  if (Number.isFinite(serverMs) && serverMs >= draft.dirtyAt) {
    return { kind: "stale" };
  }
  return { kind: "recoverable", draft };
}

/**
 * Subscribe to store changes and mirror the document to localStorage.
 * Mount this once in the editor route. Cleans up its subscription on
 * unmount.
 *
 * We intentionally write on every document change (not debounced) — the
 * write is a single setItem call (sub-millisecond for our doc sizes) and
 * we want it to survive a crash that happens between keystrokes.
 */
export function useDraftMirror(pageId: string | null): void {
  useEffect(() => {
    if (!pageId) return;
    const unsub = useEditorStore.subscribe((state, prev) => {
      // Only mirror when the document actually changes — selection,
      // dirty-flag flips, and lastSavedAt updates don't need a write.
      if (state.document === prev.document) return;
      if (!state.isDirty) {
        // markSaved() was just called: the autosave succeeded, so the
        // server now matches in-memory — drop the safety net.
        clearDraft(pageId);
        return;
      }
      writeDraft(
        pageId,
        state.document,
        state.lastSavedAt
          ? new Date(state.lastSavedAt).toISOString()
          : null,
      );
    });
    return unsub;
  }, [pageId]);
}

/**
 * One-shot recovery decision for the editor route.
 * Returns the status and a function to clear the draft (used by the
 * Discard action and after a successful Restore).
 */
export function useDraftInspection(
  pageId: string,
  serverUpdatedAtIso: string,
): {
  status: RecoveryStatus;
  dismiss: () => void;
} {
  const [status, setStatus] = useState<RecoveryStatus>(() =>
    inspectDraft(pageId, serverUpdatedAtIso),
  );

  // Re-inspect whenever the page id or server timestamp changes (e.g.
  // route param swap). We don't subscribe to the store here — the banner
  // is purely a mount-time decision.
  useEffect(() => {
    setStatus(inspectDraft(pageId, serverUpdatedAtIso));
  }, [pageId, serverUpdatedAtIso]);

  const dismiss = () => {
    clearDraft(pageId);
    setStatus({ kind: "stale" });
  };

  return { status, dismiss };
}
