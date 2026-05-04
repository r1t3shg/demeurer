/**
 * Compile pipeline — public type surface.
 *
 * P1.D segment 1 produces a `CompileArtifact`: a deterministic in-memory
 * file set derived from a `Page` row. The artifact is what segment 2 will
 * write to the merchant's theme via the Asset API. Segment 1 itself does
 * NOT touch any theme — `compilePage` is pure-functional.
 *
 * Architectural commitments this segment upholds:
 *   1. Pages survive uninstall — because they ARE theme files. Every file
 *      we emit is a standalone, hand-readable Liquid section or JSON
 *      template. Demeurer can disappear and the merchant's storefront
 *      keeps rendering.
 *   2. No runtime JS injection from our servers — every responsive
 *      override is baked compile-time CSS inside the section's
 *      `{% style %}` block.
 *   3. Pages survive theme updates — we always write to `sections/` and
 *      `templates/` of the current published theme; never a sandboxed
 *      copy.
 *
 * Determinism is non-negotiable. Two compiles of an unchanged page MUST
 * produce byte-identical files (same `contentHash` arrays). Segment 3's
 * idempotent theme-write check relies on this.
 */

/** Diagnostic surfaced from compile — never fatal in this segment. */
export interface Diagnostic {
  level: "info" | "warning";
  message: string;
  /** Block id the diagnostic relates to, when applicable. */
  blockId?: string;
  /** Field key the diagnostic relates to, when applicable. */
  field?: string;
}

export type CompiledFilePurpose = "section" | "template" | "snippet";

export interface CompiledFile {
  /** e.g. "sections/demeurer-hero.liquid" or "templates/page.demeurer-home.json". */
  path: string;
  /** Full file contents as a string. */
  content: string;
  /** sha256 hex of `content`. Powers segment 3's idempotency check. */
  contentHash: string;
  purpose: CompiledFilePurpose;
  /** For section files. */
  sectionType?: string;
  /** For template files. */
  pageHandle?: string;
}

export interface CompileArtifact {
  pageId: string;
  pageHandle: string;
  pageType: "landing" | "product";
  /**
   * Monotonic per source mutation. Initial implementation derives this
   * from `page.updatedAt.getTime()`. If segment 2 needs a stricter
   * per-compile counter, add a column.
   */
  sourceVersion: number;
  /**
   * ISO timestamp of the compile. Lives on the artifact, NEVER inside
   * any file's content — that would break determinism.
   */
  compiledAt: string;
  /** Files sorted by path for stable inspection and diffing. */
  files: CompiledFile[];
}

export interface CompileMetrics {
  compileMs: number;
  fileCount: number;
  totalBytes: number;
}

export interface CompileResult {
  artifact: CompileArtifact;
  diagnostics: Diagnostic[];
  metrics: CompileMetrics;
}
