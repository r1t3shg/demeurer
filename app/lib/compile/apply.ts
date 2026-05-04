/**
 * Apply pipeline.
 *
 * Reads (segment 2) tell us what's currently in the theme. Drift
 * detection classifies each artifact file. The apply pipeline takes
 * the artifact + drift classification and writes the necessary files
 * via `themeFilesUpsert` (segment 3's writer).
 *
 * The Themes API has NO multi-file transaction. We approximate
 * transactional safety with three primitives:
 *
 *   1. Determinism (segment 1) — re-running publish recovers state.
 *   2. Per-file write tracking — `ThemeWrite` rows let drift
 *      classify retries correctly.
 *   3. Phase ordering — section files first, page templates LAST.
 *      If a section write fails mid-publish, the old page template
 *      still references its (still-present) sections and the
 *      storefront stays renderable. The new page template is never
 *      written until every section it references is in place.
 *
 * The orchestration is wrapped in `withPublishLock` at the route
 * layer, so two concurrent publishes for the same page can't
 * interleave.
 */

import {
  classifyConflicts,
  type ConflictAssessment,
} from "./conflict-severity.ts";
import { detectDrift, type DriftReport } from "./drift.ts";
import { md5Hex } from "./md5.ts";
import type { CompileArtifact, CompiledFile } from "./types.ts";
import type { AdminClient } from "../theme/client.server.ts";
import {
  clearListDemeurerFilesCache,
  getPublishedTheme,
} from "../theme/client.server.ts";
import {
  writeThemeFiles,
  type WriteResult,
} from "../theme/writer.server.ts";

export type ApplyStatus =
  | "success"
  | "partial_failure"
  | "drift_blocked"
  | "auth_error";

export interface ApplyResult {
  status: ApplyStatus;
  themeId: string | null;
  themeName: string | null;
  written: WriteResult[];
  failed: WriteResult[];
  skipped: CompiledFile[];
  driftReport?: DriftReport;
  severity?: ConflictAssessment;
  completedAt: string;
}

/**
 * Minimal `ThemeWrite` table surface needed by the apply pipeline.
 * Production passes the real prisma client; tests pass a stub.
 */
export interface ThemeWriteStore {
  themeWrite: {
    upsert(args: {
      where: { shop_themeId_path: { shop: string; themeId: string; path: string } };
      update: {
        contentHash: string;
        pageId: string | null;
        writtenAt: Date;
      };
      create: {
        shop: string;
        themeId: string;
        path: string;
        contentHash: string;
        pageId: string | null;
        writtenAt: Date;
      };
    }): Promise<unknown>;
  };
}

export interface ApplyArtifactInput {
  admin: AdminClient;
  shop: string;
  pageId: string;
  artifact: CompileArtifact;
  /** Last-written-hash records keyed by path (md5 hex). */
  writesByPath: Map<string, { contentHash: string }>;
  /**
   * Persistence layer for `ThemeWrite` rows. Defaults to the global
   * prisma client at the route layer; tests inject a stub.
   */
  db: ThemeWriteStore;
  options?: { acceptDrift?: boolean };
}

export async function applyArtifact({
  admin,
  shop,
  pageId,
  artifact,
  writesByPath,
  db,
  options,
}: ApplyArtifactInput): Promise<ApplyResult> {
  const completedAt = () => new Date().toISOString();

  // 1. Resolve the published theme.
  const theme = await getPublishedTheme(admin, shop);
  if (!theme) {
    return {
      status: "auth_error",
      themeId: null,
      themeName: null,
      written: [],
      failed: [],
      skipped: [],
      completedAt: completedAt(),
    };
  }

  // 2. Run drift detection.
  const driftReport = await detectDrift({
    admin,
    shop,
    themeId: theme.id,
    themeName: theme.name,
    artifact,
    writesByPath,
  });
  const severity = classifyConflicts(driftReport);

  // 3. Block major drift unless caller opts in.
  if (severity.severity === "major" && !options?.acceptDrift) {
    return {
      status: "drift_blocked",
      themeId: theme.id,
      themeName: theme.name,
      written: [],
      failed: [],
      skipped: driftReport.unchangedFiles,
      driftReport,
      severity,
      completedAt: completedAt(),
    };
  }

  // 4. Compute the writeable files.
  const writeable: CompiledFile[] = [
    ...driftReport.newFiles,
    ...driftReport.modifiedFiles.map((m) => m.artifact),
  ];

  // 5. Group by phase. Sections first, snippets second, templates LAST.
  const phaseA = writeable.filter((f) => f.purpose === "section");
  const phaseB = writeable.filter((f) => f.purpose === "snippet");
  const phaseC = writeable.filter((f) => f.purpose === "template");

  const written: WriteResult[] = [];
  const failed: WriteResult[] = [];

  // Helper: write one phase, record successes in `written`, record
  // failures in `failed`. Returns true iff every file in the phase
  // succeeded (or the phase was empty).
  const runPhase = async (phase: CompiledFile[]): Promise<boolean> => {
    if (phase.length === 0) return true;
    const inputs = phase.map((f) => ({ path: f.path, content: f.content }));
    const results = await writeThemeFiles(admin, theme.id, shop, inputs);

    // Index back to CompiledFile for ThemeWrite (purpose) bookkeeping.
    const byPath = new Map(phase.map((f) => [f.path, f]));
    let allOk = true;
    for (const r of results) {
      if (r.success) {
        written.push(r);
        const cf = byPath.get(r.path);
        const isAuthFailure = false;
        void isAuthFailure;
        await persistThemeWrite(db, {
          shop,
          themeId: theme.id,
          path: r.path,
          contentHash: r.writtenHash ?? md5Hex(cf?.content ?? ""),
          pageId: cf?.purpose === "template" ? pageId : null,
        });
      } else {
        failed.push(r);
        allOk = false;
      }
    }
    return allOk;
  };

  // 6. Execute phases sequentially. If A fails, skip B and C; if B
  //    fails, skip C. Phase ordering preserves a renderable theme on
  //    partial failure.
  const aOk = await runPhase(phaseA);
  let bOk = true;
  let cOk = true;
  if (aOk) {
    bOk = await runPhase(phaseB);
    if (bOk) {
      cOk = await runPhase(phaseC);
    }
  }

  // 7. Cache invalidation: any successful write means subsequent drift
  //    checks should not see stale list metadata.
  if (written.length > 0) {
    clearListDemeurerFilesCache(shop, theme.id);
  }

  // 8. Classify outcome. If we saw any auth-coded failure, the whole
  //    publish is auth_error (the caller likely needs to surface an
  //    install / scope / exemption issue).
  const hasAuthFailure = failed.some((f) => f.errorCode === "auth");
  if (hasAuthFailure) {
    return {
      status: "auth_error",
      themeId: theme.id,
      themeName: theme.name,
      written,
      failed,
      skipped: driftReport.unchangedFiles,
      driftReport,
      severity,
      completedAt: completedAt(),
    };
  }

  const fullSuccess = aOk && bOk && cOk && failed.length === 0;
  return {
    status: fullSuccess ? "success" : "partial_failure",
    themeId: theme.id,
    themeName: theme.name,
    written,
    failed,
    skipped: driftReport.unchangedFiles,
    driftReport,
    severity,
    completedAt: completedAt(),
  };
}

async function persistThemeWrite(
  db: ThemeWriteStore,
  args: {
    shop: string;
    themeId: string;
    path: string;
    contentHash: string;
    pageId: string | null;
  },
): Promise<void> {
  const { shop, themeId, path, contentHash, pageId } = args;
  const now = new Date();
  await db.themeWrite.upsert({
    where: { shop_themeId_path: { shop, themeId, path } },
    update: { contentHash, pageId, writtenAt: now },
    create: { shop, themeId, path, contentHash, pageId, writtenAt: now },
  });
}
