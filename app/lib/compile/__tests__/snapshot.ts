/**
 * Tiny snapshot helper for `node:test`. Reads the expected output from
 * `__snapshots__/<name>.snap` and asserts equality. Writes the snapshot
 * if `UPDATE_SNAPSHOTS=1` (or if it doesn't exist yet).
 *
 * Why hand-rolled: the spec rules out Jest. node:test has no built-in
 * snapshot support; pulling in a third-party library for a one-off
 * helper isn't worth the dep.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stableStringify } from "../stable-json.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(HERE, "__snapshots__");

export function matchSnapshot(name: string, value: unknown): void {
  const path = join(SNAPSHOT_DIR, `${name}.snap`);
  // Use stableStringify for deterministic formatting independent of
  // V8's object-key insertion order. This makes snapshot diffs
  // meaningful: any non-text change is real, not formatter noise.
  const serialized = stableStringify(value, 2) + "\n";

  if (process.env.UPDATE_SNAPSHOTS === "1" || !existsSync(path)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(path, serialized, "utf8");
    return;
  }

  const expected = readFileSync(path, "utf8");
  assert.strictEqual(
    serialized,
    expected,
    `Snapshot mismatch: ${name}. Re-run with UPDATE_SNAPSHOTS=1 to update.`,
  );
}
