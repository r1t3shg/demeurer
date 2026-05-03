import { useEffect, useState } from "react";

import type { SaveStatus } from "../lib/editor/useAutosave";

/**
 * Inline save-status indicator for the editor title bar.
 *
 * State machine (driven by useAutosave + the store's isDirty flag):
 *   isDirty && status === "idle"     → "Unsaved changes"     (debounce window)
 *   status === "saving"              → "Saving…"             (request in flight)
 *   status === "saved"               → "Saved · 2s ago"      (steady state)
 *   status === "error"               → "Save failed — retrying"
 *
 * The "Unsaved changes" branch only flashes briefly under normal latency;
 * if it sticks around the user's network is degraded.
 */

export interface SaveIndicatorProps {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;
}

export function SaveIndicator({
  saveStatus,
  lastSavedAt,
  isDirty,
}: SaveIndicatorProps) {
  // Re-render every 30s so "Saved · X ago" stays accurate without a
  // store-driven trigger. Cheap — one component, one timer.
  const [, force] = useState(0);
  useEffect(() => {
    if (saveStatus !== "saved" || !lastSavedAt) return;
    const interval = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, [saveStatus, lastSavedAt]);

  if (saveStatus === "error") {
    return (
      <s-text tone="critical">Save failed — retrying</s-text>
    );
  }

  if (saveStatus === "saving") {
    return <s-text tone="neutral">Saving…</s-text>;
  }

  if (isDirty) {
    return <s-text tone="neutral">Unsaved changes</s-text>;
  }

  if (saveStatus === "saved" && lastSavedAt) {
    return <s-text tone="neutral">Saved · {formatRelative(lastSavedAt)}</s-text>;
  }

  // Initial mount before any save has happened. Stay quiet — no message
  // is better than a misleading "Saved" for an unsaved doc.
  return null;
}

function formatRelative(date: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
