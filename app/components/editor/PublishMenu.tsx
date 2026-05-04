/**
 * Action menu for the "Published" state.
 *
 * A small popover (no Polaris s-menu in current types). Closes on
 * outside click + Escape.
 */

import { useEffect, useRef } from "react";

export interface PublishMenuProps {
  open: boolean;
  storefrontUrl: string;
  themeEditorUrl: string;
  onClose: () => void;
  onCopyUrl: () => void;
  onShowHistory: () => void;
  onUnpublish: () => void;
}

export function PublishMenu({
  open,
  storefrontUrl,
  themeEditorUrl,
  onClose,
  onCopyUrl,
  onShowHistory,
  onUnpublish,
}: PublishMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="demeurer-publish-menu" ref={ref} role="menu">
      <a
        className="demeurer-publish-menu__item"
        href={storefrontUrl}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={onClose}
      >
        View page on storefront
      </a>
      <button
        type="button"
        className="demeurer-publish-menu__item"
        role="menuitem"
        onClick={() => {
          onCopyUrl();
          onClose();
        }}
      >
        Copy page URL
      </button>
      <a
        className="demeurer-publish-menu__item"
        href={themeEditorUrl}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={onClose}
      >
        Show files in theme editor
      </a>
      <button
        type="button"
        className="demeurer-publish-menu__item"
        role="menuitem"
        onClick={() => {
          onShowHistory();
          onClose();
        }}
      >
        Show publish history
      </button>
      <hr className="demeurer-publish-menu__divider" />
      <button
        type="button"
        className="demeurer-publish-menu__item demeurer-publish-menu__item--critical"
        role="menuitem"
        onClick={() => {
          onUnpublish();
          onClose();
        }}
      >
        Unpublish page
      </button>
    </div>
  );
}
