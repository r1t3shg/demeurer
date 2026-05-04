/**
 * First-publish onboarding modal.
 *
 * Shown automatically after the merchant's very first successful
 * publish in this shop. The single emoji in the entire app appears
 * here — it's the architectural payoff moment, surfaced as a tiny
 * piece of delight.
 *
 * Gated by the count of `Publish` rows for the shop being zero
 * BEFORE the publish that just succeeded (see
 * `app.api.pages.$id.publish.ts`).
 */

import { useEffect, useRef } from "react";

export interface FirstPublishModalProps {
  open: boolean;
  onClose: () => void;
}

export function FirstPublishModal({ open, onClose }: FirstPublishModalProps) {
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

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <s-modal
      id="first-publish-modal"
      heading="🎉  Your page is live!"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={modalRef as any}
    >
      <s-stack direction="block" gap="base">
        <s-paragraph>Here's something we want you to know:</s-paragraph>
        <s-paragraph>
          The page you just published is now part of your theme. That
          means if you cancel Demeurer, your page keeps working. No
          vendor lock-in. The pages you create with Demeurer are yours
          to keep.
        </s-paragraph>
        <s-paragraph>
          You can audit the files Demeurer created at any time:
        </s-paragraph>
        <s-paragraph>
          <s-text>
            Online Store → Themes → Edit code → look for files starting
            with <code>demeurer-</code>.
          </s-text>
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={onClose}>
            Got it
          </s-button>
        </s-stack>
      </s-stack>
    </s-modal>
  );
}
