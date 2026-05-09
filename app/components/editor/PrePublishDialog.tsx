/**
 * Pre-publish confirmation dialog.
 *
 * Two branches by severity:
 *   - "none" / "minor": brief confirm summarizing what will happen.
 *   - "major":          drift warning with inline diff links per file.
 *
 * Both render inside a Polaris `<s-modal>` with imperative show/hide
 * via ref (mirrors the VersionHistory pattern).
 */

import { useEffect, useRef, useState } from "react";

import type {
  FlowConflictAssessment,
  FlowDriftReport,
} from "../../lib/editor/publish-flow";
import { SimpleDiff } from "./SimpleDiff";

export interface PrePublishDialogProps {
  pageId: string;
  open: boolean;
  report: FlowDriftReport | null;
  severity: FlowConflictAssessment | null;
  onCancel: () => void;
  onConfirm: (acceptDrift: boolean) => void;
}

interface DiffPayload {
  themeContent: string;
  artifactContent: string;
}

export function PrePublishDialog({
  pageId,
  open,
  report,
  severity,
  onCancel,
  onConfirm,
}: PrePublishDialogProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modalRef = useRef<any>(null);
  const [showThemeNote, setShowThemeNote] = useState(false);
  const [openDiff, setOpenDiff] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<DiffPayload | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    const el = modalRef.current as
      | { show?: () => void; hide?: () => void }
      | null;
    if (!el) return;
    if (open) el.show?.();
    else el.hide?.();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowThemeNote(false);
      setOpenDiff(null);
      setDiffData(null);
    }
  }, [open]);

  // Polaris <s-modal> fires a `close` event on any dismiss path
  // (X button, Escape, click-outside). Without this listener, those
  // dismissals leave publishStage.stage === "confirm" stuck, which
  // makes the Publish button silently no-op on the next click
  // (handleClickPublish guards on idle|success|error).
  useEffect(() => {
    const el = modalRef.current as
      | (EventTarget & { addEventListener: typeof EventTarget.prototype.addEventListener })
      | null;
    if (!el) return;
    const handler = () => onCancel();
    el.addEventListener("close", handler);
    return () => el.removeEventListener("close", handler);
  }, [onCancel]);

  async function fetchDiff(path: string) {
    setDiffLoading(true);
    setDiffData(null);
    try {
      const r = await fetch(
        `/app/api/pages/${pageId}/drift/diff?path=${encodeURIComponent(path)}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as {
        themeContent: string | null;
        artifactContent: string | null;
      };
      setDiffData({
        themeContent: body.themeContent ?? "",
        artifactContent: body.artifactContent ?? "",
      });
    } finally {
      setDiffLoading(false);
    }
  }

  function handleShowDiff(path: string) {
    if (openDiff === path) {
      setOpenDiff(null);
      setDiffData(null);
      return;
    }
    setOpenDiff(path);
    void fetchDiff(path);
  }

  if (!report || !severity) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <s-modal id="pre-publish-modal" heading="Publish" ref={modalRef as any} />
    );
  }

  const isMajor = severity.severity === "major";
  const sectionsCount = report.newFiles.filter((f) => f.path.startsWith("sections/")).length
    + report.modifiedFiles.filter((m) => m.path.startsWith("sections/")).length;
  const templatesCount = report.newFiles.filter((f) => f.path.startsWith("templates/")).length
    + report.modifiedFiles.filter((m) => m.path.startsWith("templates/")).length;
  const newCount = report.newFiles.length;
  const modifiedCount = report.modifiedFiles.length;
  const orphansCount = report.orphanFiles.length;

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <s-modal
      id="pre-publish-modal"
      heading={isMajor ? "Drift detected" : "Publish page"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={modalRef as any}
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small">
          <s-text>
            Publishing to your live theme: <strong>{report.themeName}</strong>
          </s-text>
          <s-link onClick={() => setShowThemeNote((v) => !v)}>
            Change…
          </s-link>
        </s-stack>
        {showThemeNote ? (
          <s-banner tone="info">
            Publishing to a different theme is coming soon. Currently
            Demeurer publishes only to your live theme.
          </s-banner>
        ) : null}

        {!isMajor ? (
          <>
            <s-paragraph>
              Publishing will write {report.estimatedWriteCount}{" "}
              {report.estimatedWriteCount === 1 ? "file" : "files"}:
            </s-paragraph>
            <s-stack direction="block" gap="small">
              {templatesCount > 0 ? (
                <s-text>
                  • {templatesCount} page template{templatesCount === 1 ? "" : "s"}
                </s-text>
              ) : null}
              {sectionsCount > 0 ? (
                <s-text>
                  • {sectionsCount} section file{sectionsCount === 1 ? "" : "s"}
                </s-text>
              ) : null}
              {newCount === 0 && modifiedCount === 0 ? (
                <s-text>
                  • Nothing to write — your page already matches the
                  theme.
                </s-text>
              ) : null}
            </s-stack>
            {orphansCount > 0 ? (
              <s-banner tone="warning">
                {orphansCount} Demeurer file{orphansCount === 1 ? " is" : "s are"} in
                your theme but not in this page. They won't be touched.
              </s-banner>
            ) : null}
          </>
        ) : (
          <>
            <s-paragraph>
              Some Demeurer files in your theme have been edited outside
              Demeurer. Publishing will overwrite these changes:
            </s-paragraph>
            <s-stack direction="block" gap="small">
              {report.modifiedFiles
                .filter((m) => m.classification === "drifted")
                .map((m) => (
                  <div key={m.path} className="demeurer-prepublish-driftrow">
                    <s-stack direction="inline" gap="small">
                      <s-text>
                        ⚠ <code>{m.path}</code>
                      </s-text>
                      <s-link onClick={() => handleShowDiff(m.path)}>
                        {openDiff === m.path ? "Hide changes" : "View changes"}
                      </s-link>
                    </s-stack>
                    {openDiff === m.path ? (
                      <div className="demeurer-prepublish-diff">
                        {diffLoading ? (
                          <s-text>Loading diff…</s-text>
                        ) : diffData ? (
                          <SimpleDiff
                            left={diffData.themeContent}
                            right={diffData.artifactContent}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
            </s-stack>
            <s-paragraph>
              <strong>What would you like to do?</strong>
            </s-paragraph>
          </>
        )}

        <s-stack direction="inline" gap="base">
          <s-button onClick={onCancel}>Cancel</s-button>
          {isMajor ? (
            <>
              <s-button onClick={onCancel}>Keep theme version, abort</s-button>
              <s-button variant="primary" onClick={() => onConfirm(true)}>
                Replace with my Demeurer version
              </s-button>
            </>
          ) : (
            <s-button variant="primary" onClick={() => onConfirm(false)}>
              Publish to live store
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </s-modal>
  );
}
