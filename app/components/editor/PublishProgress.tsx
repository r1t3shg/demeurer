/**
 * In-flight + result feedback for the publish flow.
 *
 * Renders different surfaces based on the current PublishStage:
 *   - publishing: non-dismissable banner at the top of the editor
 *   - success: success banner with "View page" link, auto-dismisses
 *   - partial: modal with failed paths + retry / details buttons
 *   - auth_error: critical banner with refresh
 *   - error: critical banner with retry + technical details
 */

import { useEffect, useRef, useState } from "react";

import type { PublishStage } from "../../lib/editor/publish-flow";

export interface PublishProgressProps {
  stage: PublishStage;
  storefrontUrl: string;
  onRetry: () => void;
  onDismiss: () => void;
}

const SUCCESS_AUTO_DISMISS_MS = 5000;

export function PublishProgress({
  stage,
  storefrontUrl,
  onRetry,
  onDismiss,
}: PublishProgressProps) {
  // Auto-dismiss success banner.
  const [successVisible, setSuccessVisible] = useState(false);
  useEffect(() => {
    if (stage.stage === "success") {
      setSuccessVisible(true);
      const t = setTimeout(() => {
        setSuccessVisible(false);
        onDismiss();
      }, SUCCESS_AUTO_DISMISS_MS);
      return () => clearTimeout(t);
    }
    setSuccessVisible(false);
  }, [stage.stage, onDismiss]);

  // Imperative show/hide for the partial-failure modal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialModalRef = useRef<any>(null);
  useEffect(() => {
    const el = partialModalRef.current as
      | { show?: () => void; hide?: () => void }
      | null;
    if (!el) return;
    if (stage.stage === "partial") el.show?.();
    else el.hide?.();
  }, [stage.stage]);

  if (stage.stage === "publishing") {
    return (
      <s-banner tone="info">
        <s-stack direction="inline" gap="base">
          <span className="demeurer-publish-spinner" aria-hidden="true" />
          <s-text>Publishing… please don't close this tab.</s-text>
        </s-stack>
      </s-banner>
    );
  }

  if (stage.stage === "success" && successVisible) {
    return (
      <s-banner tone="success">
        <s-stack direction="inline" gap="base">
          <s-text>Published successfully.</s-text>
          <a
            className="demeurer-publish-success-link"
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View page
          </a>
        </s-stack>
      </s-banner>
    );
  }

  if (stage.stage === "auth_error") {
    return (
      <s-banner tone="critical">
        <s-stack direction="inline" gap="base">
          <s-text>Your Shopify session expired.</s-text>
          <s-button onClick={() => window.location.reload()}>Refresh</s-button>
        </s-stack>
      </s-banner>
    );
  }

  if (stage.stage === "error") {
    return (
      <s-banner tone="critical">
        <s-stack direction="block" gap="small">
          <s-text>{stage.message}</s-text>
          <s-stack direction="inline" gap="small">
            <s-button onClick={onRetry}>Retry</s-button>
            <s-button onClick={onDismiss}>Dismiss</s-button>
          </s-stack>
        </s-stack>
      </s-banner>
    );
  }

  if (stage.stage === "partial") {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <s-modal
        id="publish-partial-modal"
        heading="Some files couldn't be written"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={partialModalRef as any}
      >
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Your page may not render correctly until these are fixed:
          </s-paragraph>
          <s-stack direction="block" gap="small">
            {stage.result.failed.map((f) => (
              <s-text key={f.path}>
                ✘ <code>{f.path}</code>
                {f.error ? `: ${f.error}` : ""}
              </s-text>
            ))}
          </s-stack>
          <s-stack direction="inline" gap="base">
            <s-button onClick={onDismiss}>Close</s-button>
            <s-button variant="primary" onClick={onRetry}>
              Retry
            </s-button>
          </s-stack>
        </s-stack>
      </s-modal>
    );
  }

  return null;
}
