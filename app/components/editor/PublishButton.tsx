/**
 * Publish button + status line for the editor toolbar.
 *
 * Three button shapes:
 *   - Unpublished:                primary "Publish page"
 *   - Published, no unsaved:      outline "Published" + ▾ menu
 *   - Published, dirty:           primary "Update page" + ▾ menu
 *
 * Status line below shows publishedAt / unsaved-count / flow stage.
 */

import { useEffect, useState } from "react";

import type { PublishFlow, PublishStage } from "../../lib/editor/publish-flow";
import { useEditorStore } from "../../lib/editor/store";

export interface PublishButtonProps {
  publishedAt: string | null;
  updatedAt: string;
  flow: PublishFlow;
  onClickPublish: () => void;
  onToggleMenu: () => void;
  menuOpen: boolean;
}

export function PublishButton({
  publishedAt,
  updatedAt,
  flow,
  onClickPublish,
  onToggleMenu,
  menuOpen,
}: PublishButtonProps) {
  const isDirty = useEditorStore((s) => s.isDirty);
  const [stage, setStage] = useState<PublishStage>(flow.state);

  useEffect(() => {
    return flow.subscribe(setStage);
  }, [flow]);

  const inFlight =
    stage.stage === "saving" ||
    stage.stage === "checking_drift" ||
    stage.stage === "publishing";

  const isPublished = !!publishedAt;

  let buttonNode: React.ReactNode;
  if (!isPublished) {
    buttonNode = (
      <s-button
        variant="primary"
        onClick={onClickPublish}
        {...(inFlight ? { disabled: true } : {})}
      >
        {inFlight ? labelForStage(stage) : "Publish page"}
      </s-button>
    );
  } else if (isDirty) {
    buttonNode = (
      <div className="demeurer-publish-button-group">
        <s-button
          variant="primary"
          onClick={onClickPublish}
          {...(inFlight ? { disabled: true } : {})}
        >
          {inFlight ? labelForStage(stage) : "Update page"}
        </s-button>
        <s-button onClick={onToggleMenu} aria-expanded={menuOpen}>
          {menuOpen ? "▴" : "▾"}
        </s-button>
      </div>
    );
  } else {
    buttonNode = (
      <div className="demeurer-publish-button-group">
        <s-button onClick={onClickPublish} {...(inFlight ? { disabled: true } : {})}>
          {inFlight ? labelForStage(stage) : "Published"}
        </s-button>
        <s-button onClick={onToggleMenu} aria-expanded={menuOpen}>
          {menuOpen ? "▴" : "▾"}
        </s-button>
      </div>
    );
  }

  return (
    <div className="demeurer-publish-cluster">
      {buttonNode}
      <div className="demeurer-publish-status" role="status" aria-live="polite">
        {statusLine({
          isPublished,
          publishedAt,
          updatedAt,
          isDirty,
          stage,
        })}
      </div>
    </div>
  );
}

function labelForStage(stage: PublishStage): string {
  switch (stage.stage) {
    case "saving":
      return "Saving…";
    case "checking_drift":
      return "Checking…";
    case "publishing":
      return "Publishing…";
    default:
      return "";
  }
}

function statusLine(args: {
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  isDirty: boolean;
  stage: PublishStage;
}): string {
  const { isPublished, publishedAt, updatedAt, isDirty, stage } = args;
  if (stage.stage === "saving") return "Saving…";
  if (stage.stage === "checking_drift") return "Checking theme…";
  if (stage.stage === "publishing") return "Publishing…";
  if (!isPublished) return "Not published";
  if (isDirty) {
    const updatedAgo = formatRelativeTime(new Date(updatedAt));
    return `Updated ${updatedAgo} · unsaved changes`;
  }
  if (publishedAt) {
    return `Published ${formatRelativeTime(new Date(publishedAt))}`;
  }
  return "Published";
}

/**
 * Tiny relative-time helper (~20 lines, no deps). Returns strings
 * like "2 minutes ago", "5 hours ago", "yesterday", "3 days ago",
 * "on Mar 12".
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `on ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
