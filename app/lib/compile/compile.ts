/**
 * Compile orchestrator.
 *
 * `compilePage(page)` is the single entry point. Pure-functional in all
 * the ways that matter — no theme reads, no theme writes, no Shopify
 * API calls. Two compiles of an unchanged page produce byte-identical
 * file content (the segment 3 idempotency check depends on this).
 *
 * The only non-deterministic data lives on the artifact wrapper, never
 * inside any file: `compiledAt` (ISO timestamp) and `metrics.compileMs`.
 *
 * Steps:
 *   1. For each unique block.type, emit the shared
 *      `sections/demeurer-{type}.liquid` via the registry.
 *   2. Build the page template JSON via `buildPageTemplate`.
 *   3. Hash every file's content (sha256 hex).
 *   4. Sort files by path for stable order.
 *   5. Wrap into a `CompileResult` with diagnostics + metrics.
 */

import type { EditorDocument } from "../editor/types.ts";
import { sha256Hex } from "./hash.ts";
import { buildPageTemplate, type PageInput } from "./page-template.ts";
import { SECTION_TEMPLATES } from "./section-templates/index.ts";
import type {
  CompileArtifact,
  CompileMetrics,
  CompileResult,
  CompiledFile,
  Diagnostic,
} from "./types.ts";

export interface CompilePageInput {
  id: string;
  handle: string;
  type: "landing" | "product";
  source: EditorDocument;
  /**
   * Used to derive `sourceVersion` deterministically from the source
   * row. Initial implementation: `updatedAt.getTime()`.
   */
  updatedAt: Date;
  /**
   * Required when `type === "product"`. Cached on Page.productHandle
   * (separate from the page's own handle, which can diverge — e.g.
   * two Demeurer pages for the same product as A/B variants).
   */
  productId?: string | null;
}

export class CompileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileValidationError";
  }
}

export async function compilePage(page: CompilePageInput): Promise<CompileResult> {
  const startedAt = Date.now();
  const diagnostics: Diagnostic[] = [];

  // Application-layer validation: product pages must be bound to a
  // product. The Prisma schema keeps `productId` optional so existing
  // landing pages stay valid; we enforce the requirement here.
  if (page.type === "product" && !page.productId) {
    throw new CompileValidationError(
      "Product pages must be bound to a product before compile (productId is missing on the Page row).",
    );
  }

  // Validate by feeding each block through the section's coerce path.
  // The coerce calls happen inside `template.toSettings` (per-section),
  // so unknown / wrong-typed fields fall back to defaults silently.
  // Diagnostics for unknown section types are emitted by `buildPageTemplate`.

  const files: CompiledFile[] = [];

  // 1. Section files for every used type.
  const usedTypes = new Set<string>();
  for (const block of page.source.blocks) {
    usedTypes.add(block.type);
  }
  for (const type of usedTypes) {
    const template = SECTION_TEMPLATES[type];
    if (!template) continue; // diagnostic emitted in buildPageTemplate
    const content = template.buildSectionTemplate();
    files.push({
      path: `sections/demeurer-${type}.liquid`,
      content,
      contentHash: sha256Hex(content),
      purpose: "section",
      sectionType: type,
    });
  }

  // 2. Page template JSON.
  const pageInput: PageInput = {
    id: page.id,
    handle: page.handle,
    type: page.type,
    source: page.source,
  };
  const pageTemplateContent = buildPageTemplate(pageInput, SECTION_TEMPLATES, diagnostics);
  const pageTemplatePath =
    page.type === "product"
      ? `templates/product.demeurer-${page.handle}.json`
      : `templates/page.demeurer-${page.handle}.json`;
  files.push({
    path: pageTemplatePath,
    content: pageTemplateContent,
    contentHash: sha256Hex(pageTemplateContent),
    purpose: "template",
    pageHandle: page.handle,
  });

  // 3. Sort by path for stable order. Determinism guarantee.
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // 4. Metrics.
  const compileMs = Date.now() - startedAt;
  const totalBytes = files.reduce((acc, f) => acc + Buffer.byteLength(f.content, "utf8"), 0);
  const metrics: CompileMetrics = {
    compileMs,
    fileCount: files.length,
    totalBytes,
  };

  // 5. Artifact.
  const artifact: CompileArtifact = {
    pageId: page.id,
    pageHandle: page.handle,
    pageType: page.type,
    sourceVersion: page.updatedAt.getTime(),
    compiledAt: new Date().toISOString(),
    files,
  };

  return { artifact, diagnostics, metrics };
}
