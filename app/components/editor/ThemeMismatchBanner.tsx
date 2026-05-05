/**
 * Theme-mismatch banner.
 *
 * Renders at the top of the editor when `page.themeMismatch === true`.
 * Surfaces the architectural commitment: pages survive theme switches.
 * The merchant can re-publish to migrate this page to the current
 * MAIN theme (a normal publish targeting the new theme — segment 4
 * flow), or dismiss the warning.
 */

import { useState } from "react";

export interface ThemeMismatchBannerProps {
  pageId: string;
  /** Called when the merchant clicks "Re-publish to current theme". */
  onRepublish: () => void;
  /** Called after the dismiss API succeeds. */
  onDismissed: () => void;
}

export function ThemeMismatchBanner({
  pageId,
  onRepublish,
  onDismissed,
}: ThemeMismatchBannerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `/app/api/pages/${pageId}/acknowledge-mismatch`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onDismissed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dismiss failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-banner tone="warning">
      <s-stack direction="block" gap="base">
        <s-text>
          ⚠ This page was published to a theme that's no longer your
          live theme. Re-publish to apply it to your current theme.
        </s-text>
        {error ? <s-text>{error}</s-text> : null}
        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            onClick={onRepublish}
            {...(busy ? { disabled: true } : {})}
          >
            Re-publish to current theme
          </s-button>
          <s-button onClick={handleDismiss} {...(busy ? { disabled: true } : {})}>
            {busy ? "Dismissing…" : "Dismiss"}
          </s-button>
        </s-stack>
      </s-stack>
    </s-banner>
  );
}
