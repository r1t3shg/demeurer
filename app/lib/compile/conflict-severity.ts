/**
 * Conflict severity classifier.
 *
 * Reduces a `DriftReport` to a single severity bucket and a short
 * actionable summary. Drives segment 4's publish UI:
 *   - `none`   → publish silently
 *   - `minor`  → publish with a soft warning
 *   - `major`  → require the merchant to acknowledge before publish
 */

import type { DriftReport } from "./drift.ts";

export type ConflictSeverity = "none" | "minor" | "major";

export interface ConflictAssessment {
  severity: ConflictSeverity;
  summary: string;
  /** Short imperative suggestions for the merchant. */
  actionable: string[];
}

export function classifyConflicts(report: DriftReport): ConflictAssessment {
  const drifted = report.modifiedFiles.filter((m) => m.classification === "drifted");
  const stale = report.modifiedFiles.filter((m) => m.classification === "stale");
  // `tracked` modifications are the normal publish path — the theme
  // reflects what we last wrote and the artifact is just newer. They
  // don't contribute to severity.
  const orphans = report.orphanFiles.length;

  let severity: ConflictSeverity;
  if (drifted.length > 0) severity = "major";
  else if (stale.length > 0 || orphans > 0) severity = "minor";
  else severity = "none";

  const summary = buildSummary(severity, report, drifted.length, stale.length, orphans);
  const actionable = buildActionable(report, drifted.length, stale.length, orphans);

  return { severity, summary, actionable };
}

function buildSummary(
  severity: ConflictSeverity,
  report: DriftReport,
  drifted: number,
  stale: number,
  orphans: number,
): string {
  if (severity === "none") {
    return `Ready to publish ${report.estimatedWriteCount} ${report.estimatedWriteCount === 1 ? "file" : "files"}. No drift detected.`;
  }
  if (severity === "minor") {
    const parts: string[] = [];
    if (stale > 0) parts.push(`${stale} ${stale === 1 ? "file has" : "files have"} no write history`);
    if (orphans > 0) parts.push(`${orphans} ${orphans === 1 ? "orphan file" : "orphan files"} from another page`);
    return `${parts.join("; ")}. Review before publishing.`;
  }
  return `${drifted} ${drifted === 1 ? "file was" : "files were"} edited outside Demeurer since the last publish. Review the diffs before overwriting.`;
}

function buildActionable(
  report: DriftReport,
  drifted: number,
  stale: number,
  orphans: number,
): string[] {
  const out: string[] = [];
  if (report.estimatedWriteCount > 0) {
    out.push(
      `Apply ${report.estimatedWriteCount} ${report.estimatedWriteCount === 1 ? "write" : "writes"} (${formatBytes(report.totalBytes)}).`,
    );
  }
  if (drifted > 0) {
    out.push(`Review ${drifted} drifted ${drifted === 1 ? "file" : "files"} — manual edits will be overwritten.`);
  }
  if (stale > 0) {
    out.push(`Review ${stale} stale ${stale === 1 ? "file" : "files"} — we have no record of writing it.`);
  }
  if (orphans > 0) {
    out.push(
      `${orphans} orphan ${orphans === 1 ? "file" : "files"} will be left alone (Demeurer never deletes).`,
    );
  }
  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
