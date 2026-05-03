/**
 * Section quality — accessibility / readability heuristics surfaced
 * to the merchant in the Properties panel.
 *
 * Goals: surface issues, not gatekeep. The merchant can publish a
 * section flagged red. The point is to make problems visible.
 *
 * Implements WCAG 2.1 contrast computation per the official formula:
 *  - sRGB → linearised luminance
 *  - relative luminance L = 0.2126·R + 0.7152·G + 0.0722·B
 *  - contrast ratio (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter
 *  - AA pass: 4.5 for normal text, 3.0 for large text (we use 4.5)
 */

export type Severity = "info" | "warning" | "error";

export interface QualityIssue {
  severity: Severity;
  message: string;
}

export interface QualityResult {
  issues: QualityIssue[];
  worst: Severity | null;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parse `#rgb` / `#rrggbb` / `#rrggbbaa` into [r, g, b] in 0–255. */
export function parseHex(input: string): [number, number, number] | null {
  if (typeof input !== "string") return null;
  const m = input.match(HEX_RE);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return [r, g, b];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const linear = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * WCAG 2.1 contrast ratio. Returns `null` if either color cannot be
 * parsed as hex (e.g. CSS keywords, gradients). Range: 1.0 (identical)
 * to 21.0 (white-on-black).
 */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const la = relLuminance(ca);
  const lb = relLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the foreground/background pair clears WCAG AA (4.5:1). */
export function meetsAA(foreground: string, background: string): boolean {
  const r = contrastRatio(foreground, background);
  return r !== null && r >= 4.5;
}

/** Reduce a list of issues to the single worst severity present. */
export function worstSeverity(issues: QualityIssue[]): Severity | null {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  if (issues.some((i) => i.severity === "info")) return "info";
  return null;
}

/** Convenience: build a QualityResult from raw issues. */
export function buildQualityResult(issues: QualityIssue[]): QualityResult {
  return { issues, worst: worstSeverity(issues) };
}
