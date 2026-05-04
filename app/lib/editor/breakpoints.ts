/**
 * Breakpoint metadata — single source of truth for editor preview
 * widths, labels, and icons.
 *
 * Two roles:
 *  - `width` — the canonical breakpoint value. Liquid output (segment 4)
 *    emits media queries at these values: tablet at min-width 768,
 *    desktop at min-width 1280. Mobile is the implicit baseline.
 *  - `editorMaxWidth` / `centered` — how the editor canvas iframe is
 *    sized for this breakpoint. Mobile/tablet present a simulated
 *    device frame (centered, fixed width, darker backdrop visible
 *    around it). Desktop stretches the full canvas up to a wide cap
 *    so on a 27" monitor the iframe doesn't balloon to absurd widths.
 *
 * The data lives here, not in `types.ts`, to keep the data-model
 * module free of UI-flavoured constants. The runtime guard array
 * `BREAKPOINTS` stays in `types.ts` since it's used by data-shape
 * validation (`isBlock` / `migrateDocument`).
 */

import type { Breakpoint } from "./types.ts";

export interface BreakpointMeta {
  label: string;
  /**
   * Canonical breakpoint width. The Liquid compiler uses this as the
   * `min-width` for the corresponding media query. Diagnostic-only at
   * the editor preview level — actual frame sizing comes from
   * `editorMaxWidth` below.
   */
  width: number;
  /** lucide-react icon name. */
  icon: string;
  /**
   * Max-width applied to the iframe frame in the canvas. Differs from
   * `width` for desktop, where we want the iframe to stretch wide on
   * big monitors without exceeding readable line-lengths.
   */
  editorMaxWidth: number;
  /**
   * If true, the iframe is centered and the canvas stage shows a
   * darker backdrop around it (suggests "this is the editor, not a
   * real device"). If false, the iframe takes the full stage width.
   */
  centered: boolean;
}

export const BREAKPOINT_META: Record<Breakpoint, BreakpointMeta> = {
  mobile: {
    label: "Mobile",
    width: 390,
    icon: "Smartphone",
    editorMaxWidth: 390,
    centered: true,
  },
  tablet: {
    label: "Tablet",
    width: 768,
    icon: "Tablet",
    editorMaxWidth: 768,
    centered: true,
  },
  desktop: {
    label: "Desktop",
    width: 1280,
    icon: "Monitor",
    editorMaxWidth: 1440,
    centered: false,
  },
};

/**
 * Stable display order — the order rendered in the breakpoint
 * switcher and used by Cmd+1 / Cmd+2 / Cmd+3 shortcuts.
 */
export const BREAKPOINT_ORDER: Breakpoint[] = ["mobile", "tablet", "desktop"];
