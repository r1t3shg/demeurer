/**
 * Show drift — dev-only modal.
 *
 * Hits `/app/api/pages/{id}/drift` for the report, renders a
 * categorized file list (new / modified-drifted / modified-tracked /
 * modified-stale / unchanged / orphan), and lazy-loads file content
 * via `/app/api/pages/{id}/drift/diff?path=...` when the dev clicks
 * "Show diff" on a modified entry.
 *
 * Mirrors the CompiledOutput modal pattern.
 */

import { useEffect, useState } from "react";

import { SimpleDiff } from "./SimpleDiff";

interface CompiledFile {
  path: string;
  content: string;
  contentHash: string;
  purpose: "section" | "template" | "snippet";
}

type DriftClassification = "drifted" | "tracked" | "stale";

interface ModifiedFile {
  path: string;
  artifact: CompiledFile;
  current: { contentMd5: string; size: number; updatedAt: string };
  classification: DriftClassification;
}

interface OrphanFile {
  path: string;
  contentMd5: string;
}

interface DriftReport {
  themeId: string;
  themeName: string;
  newFiles: CompiledFile[];
  unchangedFiles: CompiledFile[];
  modifiedFiles: ModifiedFile[];
  orphanFiles: OrphanFile[];
  hasDrift: boolean;
  totalBytes: number;
  estimatedWriteCount: number;
}

interface ConflictAssessment {
  severity: "none" | "minor" | "major";
  summary: string;
  actionable: string[];
}

interface DriftResponse {
  drift: DriftReport;
  severity: ConflictAssessment;
}

interface DiffResponse {
  themeContent: string | null;
  artifactContent: string | null;
}

export interface DriftPanelProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
}

export function DriftPanel({ pageId, open, onClose }: DriftPanelProps) {
  const [report, setReport] = useState<DriftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<{
    path: string;
    theme: string;
    artifact: string;
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff(null);
    fetch(`/app/api/pages/${pageId}/drift`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Drift fetch failed: HTTP ${r.status}`);
        }
        return r.json() as Promise<DriftResponse>;
      })
      .then((r) => {
        if (cancelled) return;
        setReport(r);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  async function openDiff(path: string) {
    setDiffLoading(true);
    setDiff(null);
    try {
      const r = await fetch(
        `/app/api/pages/${pageId}/drift/diff?path=${encodeURIComponent(path)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as DiffResponse;
      setDiff({
        path,
        theme: body.themeContent ?? "",
        artifact: body.artifactContent ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiffLoading(false);
    }
  }

  if (!open) return null;

  const drift = report?.drift ?? null;
  const severity = report?.severity ?? null;
  const drifted = drift?.modifiedFiles.filter((m) => m.classification === "drifted") ?? [];
  const tracked = drift?.modifiedFiles.filter((m) => m.classification === "tracked") ?? [];
  const stale = drift?.modifiedFiles.filter((m) => m.classification === "stale") ?? [];

  return (
    <div className="demeurer-compiled-modal" role="dialog" aria-label="Drift report">
      <div className="demeurer-compiled-modal__backdrop" onClick={onClose} />
      <div className="demeurer-compiled-modal__panel">
        <header className="demeurer-compiled-modal__header">
          <h2 style={{ margin: 0 }}>Drift report (dev)</h2>
          <s-button onClick={onClose}>Close</s-button>
        </header>

        <div className="demeurer-compiled-modal__body">
          {loading ? <p>Checking theme…</p> : null}
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

          {drift && severity ? (
            <>
              <section className={`demeurer-drift__summary demeurer-drift__summary--${severity.severity}`}>
                <strong className="demeurer-drift__severity">
                  {severity.severity.toUpperCase()}
                </strong>
                <span> — </span>
                <span>{severity.summary}</span>
                <ul className="demeurer-drift__actionable">
                  {severity.actionable.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <div className="demeurer-drift__theme">
                  Theme: <code>{drift.themeName}</code>
                </div>
              </section>

              {diff ? (
                <section className="demeurer-drift__diff">
                  <header>
                    <strong>{diff.path}</strong>
                    <s-button onClick={() => setDiff(null)}>Close diff</s-button>
                  </header>
                  <SimpleDiff left={diff.theme} right={diff.artifact} />
                </section>
              ) : (
                <>
                  <FileGroup
                    title={`+ New (${drift.newFiles.length})`}
                    items={drift.newFiles.map((f) => ({ path: f.path }))}
                    sigil="+"
                  />
                  <FileGroup
                    title={`~ Modified — drifted (${drifted.length})`}
                    items={drifted.map((m) => ({ path: m.path, onShowDiff: () => openDiff(m.path) }))}
                    sigil="!"
                  />
                  <FileGroup
                    title={`~ Modified — tracked (${tracked.length})`}
                    items={tracked.map((m) => ({ path: m.path, onShowDiff: () => openDiff(m.path) }))}
                    sigil="~"
                  />
                  <FileGroup
                    title={`~ Modified — stale (${stale.length})`}
                    items={stale.map((m) => ({ path: m.path, onShowDiff: () => openDiff(m.path) }))}
                    sigil="~"
                  />
                  <FileGroup
                    title={`= Unchanged (${drift.unchangedFiles.length})`}
                    items={drift.unchangedFiles.map((f) => ({ path: f.path }))}
                    sigil="="
                  />
                  <FileGroup
                    title={`? Orphan (${drift.orphanFiles.length})`}
                    items={drift.orphanFiles.map((f) => ({ path: f.path }))}
                    sigil="?"
                  />
                </>
              )}

              {diffLoading ? <p>Loading diff…</p> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FileGroup({
  title,
  items,
  sigil,
}: {
  title: string;
  items: Array<{ path: string; onShowDiff?: () => void }>;
  sigil: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className="demeurer-drift__group" open={items.length > 0 && items.length < 10}>
      <summary>{title}</summary>
      <ul>
        {items.map((item) => (
          <li key={item.path}>
            <span className="demeurer-drift__sigil">{sigil}</span>
            <code>{item.path}</code>
            {item.onShowDiff ? (
              <button
                type="button"
                className="demeurer-drift__show-diff"
                onClick={item.onShowDiff}
              >
                Show diff
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
