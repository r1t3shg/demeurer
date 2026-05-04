/**
 * Client-side publish flow — a small state machine.
 *
 * Drives the merchant-facing publish UI. Each stage maps to a distinct
 * UI surface (button label, dialog, banner, toast). Components
 * subscribe via a tiny observer pattern.
 *
 * Flow:
 *
 *   idle → saving → checking_drift → confirm → publishing → success
 *                                          ↓
 *                                          └→ partial / auth_error / error
 *
 * Cancel from `confirm` returns to `idle`. Retry on `partial` / `error`
 * re-runs `confirm(true)` (acceptDrift, since the partial state is
 * effectively drift on retry).
 *
 * Pure JS — no React imports. The component layer wraps with
 * `useState` + `useEffect` to react to state changes.
 */

// Loose-typed mirror of the server's DriftReport / ConflictAssessment /
// ApplyResult. We don't import the server types directly because they
// pull in node-specific modules; the route serializes them to JSON
// anyway.
export interface FlowDriftReport {
  themeId: string;
  themeName: string;
  newFiles: Array<{ path: string; purpose: string }>;
  unchangedFiles: Array<{ path: string }>;
  modifiedFiles: Array<{
    path: string;
    classification: "drifted" | "tracked" | "stale";
    artifact: { content: string };
  }>;
  orphanFiles: Array<{ path: string }>;
  hasDrift: boolean;
  totalBytes: number;
  estimatedWriteCount: number;
}

export interface FlowConflictAssessment {
  severity: "none" | "minor" | "major";
  summary: string;
  actionable: string[];
}

export interface FlowApplyResult {
  status: "success" | "partial_failure" | "drift_blocked" | "auth_error";
  themeId: string | null;
  themeName: string | null;
  written: Array<{ path: string; writtenHash?: string }>;
  failed: Array<{ path: string; error?: string; errorCode?: string }>;
  skipped: Array<{ path: string }>;
}

export type PublishStage =
  | { stage: "idle" }
  | { stage: "saving" }
  | { stage: "checking_drift" }
  | {
      stage: "confirm";
      report: FlowDriftReport;
      severity: FlowConflictAssessment;
    }
  | { stage: "publishing" }
  | {
      stage: "success";
      result: FlowApplyResult;
      firstPublish: boolean;
    }
  | { stage: "partial"; result: FlowApplyResult; firstPublish: boolean }
  | { stage: "auth_error" }
  | { stage: "error"; message: string };

export type Listener = (state: PublishStage) => void;

export interface PublishFlow {
  state: PublishStage;
  subscribe(listener: Listener): () => void;
  start(): Promise<void>;
  confirm(acceptDrift: boolean): Promise<void>;
  cancel(): void;
  retry(): Promise<void>;
}

export interface PublishFlowDeps {
  pageId: string;
  /** Flush pending autosave; reject if save fails. */
  saveNow: () => Promise<void>;
  /** Optional override for tests. Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

export function createPublishFlow(deps: PublishFlowDeps): PublishFlow {
  const fetcher = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const listeners = new Set<Listener>();
  let state: PublishStage = { stage: "idle" };

  function setState(next: PublishStage) {
    state = next;
    for (const l of listeners) l(state);
  }

  async function start(): Promise<void> {
    if (state.stage !== "idle") return;
    setState({ stage: "saving" });
    try {
      await deps.saveNow();
    } catch (err) {
      setState({
        stage: "error",
        message:
          err instanceof Error
            ? `Couldn't save before publishing: ${err.message}`
            : "Couldn't save before publishing.",
      });
      return;
    }
    setState({ stage: "checking_drift" });
    try {
      const res = await fetcher(`/app/api/pages/${deps.pageId}/drift`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          stage: "error",
          message: body.error ?? `Drift check failed: HTTP ${res.status}`,
        });
        return;
      }
      const body = (await res.json()) as {
        drift: FlowDriftReport;
        severity: FlowConflictAssessment;
      };
      setState({
        stage: "confirm",
        report: body.drift,
        severity: body.severity,
      });
    } catch (err) {
      setState({
        stage: "error",
        message:
          err instanceof Error ? err.message : "Drift check network error",
      });
    }
  }

  async function confirm(acceptDrift: boolean): Promise<void> {
    if (state.stage !== "confirm" && state.stage !== "partial" && state.stage !== "error") {
      return;
    }
    setState({ stage: "publishing" });
    try {
      const res = await fetcher(`/app/api/pages/${deps.pageId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptDrift }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: FlowApplyResult;
        firstPublish?: boolean;
        reason?: string;
        error?: string;
      };
      if (res.status === 401 || body.reason === "auth") {
        setState({ stage: "auth_error" });
        return;
      }
      if (res.status === 409 && body.reason === "drift") {
        // Drift surfaced after the merchant already confirmed. Bounce
        // back to confirm with the latest report so they can re-evaluate.
        const driftBody = body as unknown as {
          report?: FlowDriftReport;
          severity?: FlowConflictAssessment;
        };
        if (driftBody.report && driftBody.severity) {
          setState({
            stage: "confirm",
            report: driftBody.report,
            severity: driftBody.severity,
          });
          return;
        }
        setState({
          stage: "error",
          message: "Drift detected during publish.",
        });
        return;
      }
      if (res.status === 409 && body.reason === "publish_in_progress") {
        setState({
          stage: "error",
          message: "Another publish is already in progress for this page.",
        });
        return;
      }
      if (res.status === 207 || body.reason === "partial") {
        if (body.result) {
          setState({
            stage: "partial",
            result: body.result,
            firstPublish: body.firstPublish === true,
          });
          return;
        }
      }
      if (res.ok && body.ok && body.result) {
        setState({
          stage: "success",
          result: body.result,
          firstPublish: body.firstPublish === true,
        });
        return;
      }
      setState({
        stage: "error",
        message:
          body.error ?? `Publish failed: HTTP ${res.status}`,
      });
    } catch (err) {
      setState({
        stage: "error",
        message: err instanceof Error ? err.message : "Publish network error",
      });
    }
  }

  function cancel(): void {
    setState({ stage: "idle" });
  }

  async function retry(): Promise<void> {
    // Retry from a partial / error state with acceptDrift: true. Files
    // we partially wrote are now `tracked` (recorded in ThemeWrite,
    // theme matches our last write); the failed ones are `stale`. The
    // drift severity will be at most "minor" so the publish proceeds.
    await confirm(true);
  }

  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    confirm,
    cancel,
    retry,
  };
}

/**
 * React hook glue — small `useSyncExternalStore`-style observer.
 * Lives here so the consumer doesn't need to wire subscribe manually.
 *
 * NOTE: This module is plain TS (no JSX). The hook lives in this file
 * because it's a one-liner that only needs `useSyncExternalStore`.
 * It's not "pure JS" anymore but stays dependency-free.
 */
export function getCurrentState(flow: PublishFlow): PublishStage {
  return flow.state;
}
