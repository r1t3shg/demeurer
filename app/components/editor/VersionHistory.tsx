import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorStore } from "../../lib/editor/store";
import type { EditorDocument } from "../../lib/editor/types";
import { isDocument } from "../../lib/editor/types";

/**
 * Version history modal.
 *
 * Lists the page's PageVersion rows (newest 50 from the server) with
 * Preview and Restore actions, plus a "Save named snapshot" button at
 * the top.
 *
 * Preview is purely client-side: it sets a state in the parent route
 * that swaps the live Canvas for a read-only render of the version's
 * source. The store is NOT touched during preview, so the user can
 * exit preview without losing in-progress edits.
 *
 * Restore loads the version into the store (new history baseline) and
 * relies on the autosave hook to persist it.
 */

export interface VersionRecord {
  id: string;
  label: string | null;
  createdAt: string;
  source: unknown;
}

export interface VersionHistoryProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
  /**
   * Toggle preview mode in the parent route. Pass `null` to exit
   * preview. The parent renders a read-only canvas for the document.
   */
  onPreview: (doc: EditorDocument | null, version: VersionRecord | null) => void;
  previewVersionId: string | null;
}

export function VersionHistory({
  pageId,
  open,
  onClose,
  onPreview,
  previewVersionId,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  // Polaris s-modal opens via the native invoker pattern (or imperative
  // .show()/.hide()). We control visibility from React state, so call
  // the imperative API in an effect when `open` toggles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modalRef = useRef<any>(null);
  useEffect(() => {
    const el = modalRef.current as
      | { show?: () => void; hide?: () => void }
      | null;
    if (!el) return;
    if (open) el.show?.();
    else el.hide?.();
  }, [open]);

  const loadDocument = useEditorStore((s) => s.loadDocument);
  const markDirty = () => useEditorStore.setState({ isDirty: true });

  const fetchVersions = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/app/api/pages/${pageId}/versions`);
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const json = (await res.json()) as { versions: VersionRecord[] };
      setVersions(json.versions);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Load failed");
    }
  }, [pageId]);

  useEffect(() => {
    if (!open) return;
    void fetchVersions();
  }, [open, fetchVersions]);

  const handlePreview = (v: VersionRecord) => {
    if (!isDocument(v.source)) {
      // Defensive: a malformed version row shouldn't crash the editor.
      // Skip preview and surface the issue.
      setLoadError("This version's source is malformed and can't be previewed.");
      return;
    }
    if (previewVersionId === v.id) {
      onPreview(null, null);
    } else {
      onPreview(v.source, v);
    }
  };

  const handleRestore = async (v: VersionRecord) => {
    if (!isDocument(v.source)) {
      setLoadError("This version's source is malformed and can't be restored.");
      return;
    }
    const confirmed = window.confirm(
      `Restore version from ${formatTimestamp(v.createdAt)}? Your current state goes into history (Cmd+Z to undo).`,
    );
    if (!confirmed) return;
    setBusyId(v.id);
    try {
      // Exit preview if we were previewing this same version.
      onPreview(null, null);
      // loadDocument resets the history stack and isDirty; re-flip dirty
      // so the autosave hook persists the restore as the new server state.
      loadDocument(v.source);
      markDirty();
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const handleSnapshot = async () => {
    const label = window.prompt(
      "Name this snapshot (e.g. 'Pre-launch v1', 'Before redesign'):",
    );
    if (label === null) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    setSnapshotting(true);
    setLoadError(null);
    try {
      const res = await fetch(`/app/api/pages/${pageId}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Snapshot failed: ${res.status}`);
      }
      await fetchVersions();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Snapshot failed");
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <s-modal
      id="version-history-modal"
      heading="Version history"
      ref={modalRef}
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={handleSnapshot}
            {...(snapshotting ? { loading: true } : {})}
          >
            Save named snapshot
          </s-button>
          <s-button onClick={() => void fetchVersions()}>Refresh</s-button>
        </s-stack>

        {loadError ? (
          <s-banner tone="critical">{loadError}</s-banner>
        ) : null}

        {versions === null ? (
          <s-paragraph>Loading…</s-paragraph>
        ) : versions.length === 0 ? (
          <s-paragraph>
            No versions yet. Edit the page or save a named snapshot.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {versions.map((v) => {
              const isPreviewing = previewVersionId === v.id;
              return (
                <div
                  key={v.id}
                  className={
                    "demeurer-version-row" +
                    (isPreviewing ? " demeurer-version-row-active" : "")
                  }
                >
                  <div className="demeurer-version-meta">
                    <div className="demeurer-version-time">
                      {formatTimestamp(v.createdAt)}
                    </div>
                    {v.label ? (
                      <div className="demeurer-version-label">{v.label}</div>
                    ) : (
                      <div className="demeurer-version-label demeurer-version-label-auto">
                        auto-snapshot
                      </div>
                    )}
                  </div>
                  <div className="demeurer-version-actions">
                    <s-button
                      onClick={() => handlePreview(v)}
                      {...(isPreviewing ? { variant: "primary" } : {})}
                    >
                      {isPreviewing ? "Exit preview" : "Preview"}
                    </s-button>
                    <s-button
                      tone="critical"
                      onClick={() => void handleRestore(v)}
                      {...(busyId === v.id ? { loading: true } : {})}
                    >
                      Restore
                    </s-button>
                  </div>
                </div>
              );
            })}
          </s-stack>
        )}
      </s-stack>
      <s-button
        slot="primary-action"
        onClick={() => {
          // Closing the drawer also exits preview — staying in preview
          // without the drawer open would be confusing UI.
          onPreview(null, null);
          onClose();
        }}
      >
        Close
      </s-button>
    </s-modal>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);

  if (diffMs < 60_000) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  // Older than a day — show the absolute time.
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
