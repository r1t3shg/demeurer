/**
 * BreakpointSwitcher — three-segment toggle for the editor's active
 * breakpoint. Lives in the page-editor title bar; can also drop to a
 * full-width row above the canvas when the editor stacks vertically.
 *
 * Cmd/Ctrl+1/2/3 shortcuts are wired by the parent route (so two
 * instances of this switcher don't install the listener twice). The
 * active state is stored in the editor store and persisted to
 * localStorage so it survives reloads (see `store.ts`).
 */

import * as LucideIcons from "lucide-react";

import { BREAKPOINT_META, BREAKPOINT_ORDER } from "../../lib/editor/breakpoints";
import { useEditorStore } from "../../lib/editor/store";
import type { Breakpoint } from "../../lib/editor/types";

interface BreakpointSwitcherProps {
  /**
   * When true, the switcher renders full-width with each segment
   * sharing the available row evenly. Used by the responsive layout
   * below ~1024px where the switcher drops out of the title bar to
   * its own row above the canvas.
   */
  fullWidth?: boolean;
}

export function BreakpointSwitcher({ fullWidth = false }: BreakpointSwitcherProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const setActiveBreakpoint = useEditorStore((s) => s.setActiveBreakpoint);

  return (
    <div
      role="group"
      aria-label="Active breakpoint"
      className={
        "demeurer-bp-switcher" +
        (fullWidth ? " demeurer-bp-switcher--fullwidth" : "")
      }
    >
      {BREAKPOINT_ORDER.map((bp, i) => {
        const meta = BREAKPOINT_META[bp];
        const isActive = activeBreakpoint === bp;
        return (
          <button
            key={bp}
            type="button"
            aria-pressed={isActive}
            className={
              "demeurer-bp-switcher__segment" +
              (isActive ? " is-active" : "")
            }
            title={`${meta.label} (${meta.width}px) — ${shortcutHint(i)}`}
            onClick={() => setActiveBreakpoint(bp)}
          >
            <BreakpointIcon name={meta.icon} />
            <span className="demeurer-bp-switcher__label">{meta.label}</span>
            <span className="demeurer-bp-switcher__width">{meta.width}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Read the breakpoint label out of the store. Useful in places like
 * the outline's "Editing: <breakpoint>" line where pulling in the
 * full meta map would be overkill.
 */
export function useActiveBreakpointLabel(): string {
  const bp = useEditorStore((s) => s.activeBreakpoint);
  return BREAKPOINT_META[bp].label;
}

function shortcutHint(index: number): string {
  // Approximation — `navigator.platform` is deprecated; userAgent
  // sniffing for Mac is heavier than this is worth. The tooltip is
  // a hint, not authoritative.
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";
  return `${mod}${index + 1}`;
}

function BreakpointIcon({ name }: { name: string }) {
  const icons = LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> | undefined
  >;
  const Icon = icons[name] ?? icons.Box;
  if (!Icon) return null;
  return <Icon size={14} aria-hidden />;
}

/**
 * Re-export for parent components that want to render a label alongside
 * a `Breakpoint` value without wiring up the meta map themselves.
 */
export function breakpointLabel(bp: Breakpoint): string {
  return BREAKPOINT_META[bp].label;
}
