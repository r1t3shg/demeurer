/**
 * Unpublish confirmation modal.
 *
 * Confirms the unpublish action. The copy makes the architectural
 * commitment explicit: theme files are NOT deleted. The page goes
 * back to draft, but the artifact stays in the theme until the
 * merchant manually removes it.
 */

import { useEffect, useRef } from "react";

export interface UnpublishConfirmProps {
  pageTitle: string;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UnpublishConfirm({
  pageTitle,
  open,
  busy,
  onCancel,
  onConfirm,
}: UnpublishConfirmProps) {
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
      id="unpublish-confirm-modal"
      heading={`Unpublish "${pageTitle}"?`}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={modalRef as any}
    >
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Unpublishing this page hides it from your storefront, but the
          theme files Demeurer created will remain in your theme. You
          can re-publish at any time, or remove them manually via the
          theme editor.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={onCancel} {...(busy ? { disabled: true } : {})}>
            Cancel
          </s-button>
          <s-button
            tone="critical"
            onClick={onConfirm}
            {...(busy ? { disabled: true } : {})}
          >
            {busy ? "Unpublishing…" : "Unpublish page"}
          </s-button>
        </s-stack>
      </s-stack>
    </s-modal>
  );
}
