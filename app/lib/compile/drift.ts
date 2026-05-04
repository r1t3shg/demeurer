/**
 * Drift detection.
 *
 * Compares a fresh `CompileArtifact` (from segment 1) against the
 * Demeurer-owned files currently in the merchant's published theme.
 * Classifies each file into one of:
 *
 *   - `new`        — artifact has it; theme doesn't. Safe to write.
 *   - `unchanged`  — artifact and theme hashes match. Skip on publish.
 *   - `modified`   — hashes differ. Sub-classify:
 *       - `drifted` — `ThemeWrite` says we last wrote hash X but theme
 *                      now has hash Y ≠ X. The merchant (or another
 *                      tool) edited the file after we last wrote.
 *       - `tracked` — `ThemeWrite` record exists AND its hash matches
 *                      the theme. The artifact is just newer than the
 *                      published version — this is the normal publish
 *                      path. No warning needed.
 *       - `stale`   — no `ThemeWrite` record. We can't prove the
 *                      merchant didn't edit, so we err conservative
 *                      (soft warning). Common on the very first
 *                      publish before segment 3 populates records.
 *   - `orphan`     — theme has a Demeurer-prefixed file that's not in
 *                    the artifact. We never delete orphans.
 *
 * Hash convention: md5 (Shopify's `checksumMd5`). The compile
 * artifact's `contentHash` (sha256) is not used here — we recompute
 * md5 of each file's content for comparison.
 */

import { md5Hex } from "./md5.ts";
import type { AdminClient } from "../theme/client.server.ts";
import { listDemeurerFiles } from "../theme/client.server.ts";
import type { CompileArtifact, CompiledFile } from "./types.ts";

export type DriftClassification = "drifted" | "tracked" | "stale";

export interface ModifiedFile {
  path: string;
  artifact: CompiledFile;
  current: { contentMd5: string; size: number; updatedAt: string };
  classification: DriftClassification;
}

export interface OrphanFile {
  path: string;
  contentMd5: string;
}

export interface DriftReport {
  themeId: string;
  themeName: string;
  newFiles: CompiledFile[];
  unchangedFiles: CompiledFile[];
  modifiedFiles: ModifiedFile[];
  orphanFiles: OrphanFile[];
  hasDrift: boolean;
  totalBytes: number;
  estimatedWriteCount: number;
}

export interface DetectDriftInput {
  admin: AdminClient;
  shop: string;
  themeId: string;
  themeName: string;
  artifact: CompileArtifact;
  /**
   * Last-written-hash records keyed by path. Hydrated by the route
   * loader from `db.themeWrite`. Tests pass a hand-built Map directly.
   * Map values' `contentHash` must be md5 hex (matches the column
   * convention defined in `prisma/schema.prisma`).
   */
  writesByPath: Map<string, { contentHash: string }>;
}

export async function detectDrift({
  admin,
  shop,
  themeId,
  themeName,
  artifact,
  writesByPath,
}: DetectDriftInput): Promise<DriftReport> {
  const themeFiles = await listDemeurerFiles(admin, themeId, shop);
  const themeByPath = new Map(themeFiles.map((f) => [f.path, f]));

  const newFiles: CompiledFile[] = [];
  const unchangedFiles: CompiledFile[] = [];
  const modifiedFiles: ModifiedFile[] = [];
  const seenInArtifact = new Set<string>();

  for (const file of artifact.files) {
    seenInArtifact.add(file.path);
    const current = themeByPath.get(file.path);
    if (!current) {
      newFiles.push(file);
      continue;
    }
    const artifactMd5 = md5Hex(file.content);
    if (current.contentMd5 === artifactMd5) {
      unchangedFiles.push(file);
      continue;
    }
    // Hashes differ → modified. Classify by what we know about the
    // theme's history (via ThemeWrite records).
    const lastWritten = writesByPath.get(file.path);
    let classification: DriftClassification;
    if (!lastWritten) {
      classification = "stale";
    } else if (lastWritten.contentHash === current.contentMd5) {
      // Theme reflects exactly what we last wrote; artifact has newer
      // bytes. Normal publish path.
      classification = "tracked";
    } else {
      // Theme has changed since our last write — drift.
      classification = "drifted";
    }
    modifiedFiles.push({
      path: file.path,
      artifact: file,
      current: {
        contentMd5: current.contentMd5,
        size: current.size,
        updatedAt: current.updatedAt,
      },
      classification,
    });
  }

  const orphanFiles: OrphanFile[] = [];
  for (const tf of themeFiles) {
    if (seenInArtifact.has(tf.path)) continue;
    orphanFiles.push({ path: tf.path, contentMd5: tf.contentMd5 });
  }

  const hasDrift = modifiedFiles.some((m) => m.classification === "drifted");
  const totalBytes =
    newFiles.reduce((acc, f) => acc + Buffer.byteLength(f.content, "utf8"), 0) +
    modifiedFiles.reduce(
      (acc, m) => acc + Buffer.byteLength(m.artifact.content, "utf8"),
      0,
    );
  const estimatedWriteCount = newFiles.length + modifiedFiles.length;

  return {
    themeId,
    themeName,
    newFiles,
    unchangedFiles,
    modifiedFiles,
    orphanFiles,
    hasDrift,
    totalBytes,
    estimatedWriteCount,
  };
}
