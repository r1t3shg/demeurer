/**
 * Show compiled output — dev-only modal.
 *
 * Hits `/app/api/pages/{id}/compile` and renders the resulting
 * CompileResult across three tabs:
 *
 *   Files       — sorted file tree with a content viewer
 *   Diagnostics — warnings/info from the compile step
 *   Metrics     — compileMs / fileCount / totalBytes
 *
 * No syntax highlighting (would pull in a dep for a dev tool).
 *
 * Replaces the per-block "Show Liquid (dev)" tool from P1.B/P1.C.
 */

import { useEffect, useState } from "react";

interface CompiledFile {
  path: string;
  content: string;
  contentHash: string;
  purpose: "section" | "template" | "snippet";
  sectionType?: string;
  pageHandle?: string;
}

interface Diagnostic {
  level: "info" | "warning";
  message: string;
  blockId?: string;
  field?: string;
}

interface CompileResult {
  artifact: {
    pageId: string;
    pageHandle: string;
    pageType: "landing" | "product";
    sourceVersion: number;
    compiledAt: string;
    files: CompiledFile[];
  };
  diagnostics: Diagnostic[];
  metrics: { compileMs: number; fileCount: number; totalBytes: number };
}

type Tab = "files" | "diagnostics" | "metrics";

export interface CompiledOutputProps {
  pageId: string;
  open: boolean;
  onClose: () => void;
}

export function CompiledOutput({ pageId, open, onClose }: CompiledOutputProps) {
  const [tab, setTab] = useState<Tab>("files");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/app/api/pages/${pageId}/compile`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Compile failed: HTTP ${r.status}`);
        return r.json() as Promise<CompileResult>;
      })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setSelectedPath(r.artifact.files[0]?.path ?? null);
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

  if (!open) return null;

  const file = result?.artifact.files.find((f) => f.path === selectedPath) ?? null;

  return (
    <div className="demeurer-compiled-modal" role="dialog" aria-label="Compiled output">
      <div className="demeurer-compiled-modal__backdrop" onClick={onClose} />
      <div className="demeurer-compiled-modal__panel">
        <header className="demeurer-compiled-modal__header">
          <h2 style={{ margin: 0 }}>Compiled output (dev)</h2>
          <s-button onClick={onClose}>Close</s-button>
        </header>

        <nav className="demeurer-compiled-modal__tabs">
          <button
            type="button"
            className={tab === "files" ? "is-active" : ""}
            onClick={() => setTab("files")}
          >
            Files {result ? `(${result.artifact.files.length})` : ""}
          </button>
          <button
            type="button"
            className={tab === "diagnostics" ? "is-active" : ""}
            onClick={() => setTab("diagnostics")}
          >
            Diagnostics {result ? `(${result.diagnostics.length})` : ""}
          </button>
          <button
            type="button"
            className={tab === "metrics" ? "is-active" : ""}
            onClick={() => setTab("metrics")}
          >
            Metrics
          </button>
        </nav>

        <div className="demeurer-compiled-modal__body">
          {loading ? <p>Compiling…</p> : null}
          {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

          {result && tab === "files" ? (
            <div className="demeurer-compiled-modal__files">
              <ul className="demeurer-compiled-modal__file-list">
                {result.artifact.files.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      className={f.path === selectedPath ? "is-active" : ""}
                      onClick={() => setSelectedPath(f.path)}
                      title={`sha256: ${f.contentHash.slice(0, 16)}…`}
                    >
                      {f.path}
                    </button>
                  </li>
                ))}
              </ul>
              <pre className="demeurer-compiled-modal__file-content">
                {file ? file.content : "Select a file."}
              </pre>
            </div>
          ) : null}

          {result && tab === "diagnostics" ? (
            result.diagnostics.length === 0 ? (
              <p>No diagnostics — clean compile.</p>
            ) : (
              <ul className="demeurer-compiled-modal__diagnostics">
                {result.diagnostics.map((d, i) => (
                  <li key={i} className={`level-${d.level}`}>
                    <strong>{d.level.toUpperCase()}</strong> {d.message}
                    {d.blockId ? <span> (block {d.blockId})</span> : null}
                    {d.field ? <span> [{d.field}]</span> : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {result && tab === "metrics" ? (
            <dl className="demeurer-compiled-modal__metrics">
              <dt>Compile time</dt>
              <dd>{result.metrics.compileMs} ms</dd>
              <dt>File count</dt>
              <dd>{result.metrics.fileCount}</dd>
              <dt>Total bytes</dt>
              <dd>{result.metrics.totalBytes.toLocaleString()}</dd>
              <dt>Source version</dt>
              <dd>{result.artifact.sourceVersion}</dd>
              <dt>Compiled at</dt>
              <dd>{new Date(result.artifact.compiledAt).toLocaleString()}</dd>
            </dl>
          ) : null}
        </div>
      </div>
    </div>
  );
}
