/**
 * Publish history drawer.
 *
 * Fetches /app/api/pages/{id}/publishes (last 50 entries, newest
 * first). Each entry shows status, file count, theme; partial
 * failures expand to show the failed paths.
 */

import { useEffect, useRef, useState } from "react";

interface PublishRecord {
  id: string;
  themeName: string;
  status: "success" | "partial_failure" | string;
  fileCount: number;
  failedPaths: string[] | null;
  createdAt: string;
}

export interface PublishHistoryProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
}

export function PublishHistory({ pageId, open, onClose }: PublishHistoryProps) {
  const [records, setRecords] = useState<PublishRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setRecords(null);
    fetch(`/app/api/pages/${pageId}/publishes`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ publishes: PublishRecord[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setRecords(body.publishes);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <s-modal
      id="publish-history-modal"
      heading="Publish history"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={modalRef as any}
    >
      <s-stack direction="block" gap="base">
        {error ? <s-banner tone="critical">{error}</s-banner> : null}
        {!records && !error ? <s-text>Loading…</s-text> : null}
        {records && records.length === 0 ? (
          <s-text>No publishes yet.</s-text>
        ) : null}
        {records && records.length > 0 ? (
          <s-stack direction="block" gap="small">
            {records.map((r) => (
              <div key={r.id} className="demeurer-publish-history__row">
                <s-stack direction="inline" gap="base">
                  <s-text>{formatTimestamp(r.createdAt)}</s-text>
                  <s-text>
                    {r.status === "success" ? "✓" : "⚠"}{" "}
                    {r.status === "success" ? "Success" : "Partial"}
                  </s-text>
                  <s-text>
                    — {r.fileCount} file{r.fileCount === 1 ? "" : "s"} to “
                    {r.themeName}”
                  </s-text>
                  {r.failedPaths && r.failedPaths.length > 0 ? (
                    <s-link onClick={() => toggleExpand(r.id)}>
                      {expanded.has(r.id) ? "Hide details" : "Show details"}
                    </s-link>
                  ) : null}
                </s-stack>
                {expanded.has(r.id) && r.failedPaths ? (
                  <div className="demeurer-publish-history__failed">
                    <s-text>Failed:</s-text>
                    <ul>
                      {r.failedPaths.map((p) => (
                        <li key={p}>
                          <code>{p}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </s-stack>
        ) : null}
        <s-stack direction="inline" gap="base">
          <s-button onClick={onClose}>Close</s-button>
        </s-stack>
      </s-stack>
    </s-modal>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
