/**
 * Per-page publish lock — best-effort, in-memory, single-process.
 *
 * Two publishes for the same page running concurrently would race on
 * `themeFilesUpsert` AND on `ThemeWrite` rows. The lock serializes
 * them at the route level: the second arrival gets a `409
 * publish_in_progress` and we never let two flows interleave.
 *
 * Limitations (documented for the Redis-backed replacement):
 *   - Single process only. Multi-region or multi-instance deployments
 *     can still race across processes.
 *   - Survival across crashes is irrelevant — a crashed publish that
 *     held the lock just frees it on process restart, which is fine
 *     because the new state is recoverable via segment 2's drift.
 */

const locks = new Set<string>();

function key(shop: string, pageId: string): string {
  return `${shop}::${pageId}`;
}

export class PublishInProgressError extends Error {
  constructor() {
    super("Publish already in progress for this page");
    this.name = "PublishInProgressError";
  }
}

export async function withPublishLock<T>(
  shop: string,
  pageId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const k = key(shop, pageId);
  if (locks.has(k)) {
    throw new PublishInProgressError();
  }
  locks.add(k);
  try {
    return await fn();
  } finally {
    locks.delete(k);
  }
}

/** Test/dev helper. */
export function clearPublishLocks(): void {
  locks.clear();
}

/** Test helper for inspecting current lock state. */
export function isPublishLocked(shop: string, pageId: string): boolean {
  return locks.has(key(shop, pageId));
}
