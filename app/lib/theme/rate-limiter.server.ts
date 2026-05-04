/**
 * Per-shop in-memory rate limiter for Shopify Admin GraphQL calls.
 *
 * Best-effort, NOT SLA-grade. The goals are:
 *   - Don't hammer Shopify with bursts (cap concurrency per shop).
 *   - Survive transient throttle responses with exponential backoff.
 *   - Read cost / throttle status from successful responses to slow
 *     ourselves down before Shopify does.
 *
 * Real production rate-limiting wants per-tenant queues + observability;
 * this layer just prevents the worst failures.
 *
 * Used internally by `app/lib/theme/client.server.ts` to wrap every
 * `admin.graphql(...)` call.
 */

interface ShopState {
  /** Currently in-flight requests; blocks at MAX_CONCURRENCY. */
  inFlight: number;
  /** Resolvers waiting for a slot. */
  queue: Array<() => void>;
  /**
   * Earliest time at which we should issue another request, in ms epoch.
   * Set when Shopify's `currentlyAvailable` drops below the threshold;
   * cleared once enough time has passed.
   */
  delayUntil: number;
}

const MAX_CONCURRENCY = 4;
const MAX_RETRIES = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const BACKOFF_CAP_MS = 30000;
/** If `currentlyAvailable` drops below this we slow down. */
const COST_FLOOR = 100;

const state = new Map<string, ShopState>();

function getState(shop: string): ShopState {
  let s = state.get(shop);
  if (!s) {
    s = { inFlight: 0, queue: [], delayUntil: 0 };
    state.set(shop, s);
  }
  return s;
}

async function acquire(shop: string): Promise<void> {
  const s = getState(shop);
  if (s.inFlight < MAX_CONCURRENCY) {
    s.inFlight++;
    return;
  }
  await new Promise<void>((resolve) => s.queue.push(resolve));
  s.inFlight++;
}

function release(shop: string): void {
  const s = getState(shop);
  s.inFlight--;
  const next = s.queue.shift();
  if (next) next();
}

async function waitForDelay(shop: string): Promise<void> {
  const s = getState(shop);
  const wait = s.delayUntil - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ResponseLike {
  status: number;
  json(): Promise<unknown>;
  /**
   * The Shopify graphql-client returns a Response-like object that has
   * already been consumed; we re-fetch via the caller. We can't call
   * `.json()` twice. So callers pass us a function that produces the
   * Response fresh on each retry.
   */
}

/**
 * Run a GraphQL operation through the limiter. The `fn` is invoked once
 * per attempt (so retries get a fresh Response). `fn` should NOT call
 * `.json()` itself — we'll do that internally to inspect throttle
 * status, then return the same response object so the caller can call
 * `.json()` once. (Concretely: we cache the parsed body and return a
 * shim Response.)
 */
export async function withRateLimit(
  shop: string,
  fn: () => Promise<ResponseLike>,
): Promise<{ status: number; body: unknown }> {
  await acquire(shop);
  try {
    let attempt = 0;
    while (true) {
      await waitForDelay(shop);
      const res = await fn();
      const body = await res.json();

      // 429 — back off and retry.
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) {
          throw new Error(
            `Shopify rate limit (HTTP 429) — exhausted ${MAX_RETRIES} retries for shop ${shop}`,
          );
        }
        await sleep(backoffDelay(attempt));
        attempt++;
        continue;
      }

      // GraphQL THROTTLED error — same treatment.
      if (isThrottled(body)) {
        if (attempt >= MAX_RETRIES) {
          throw new Error(
            `Shopify GraphQL THROTTLED — exhausted ${MAX_RETRIES} retries for shop ${shop}`,
          );
        }
        await sleep(backoffDelay(attempt));
        attempt++;
        continue;
      }

      // Read cost info to slow ourselves down preemptively.
      maybeBackoffOnCost(shop, body);

      return { status: res.status, body };
    }
  } finally {
    release(shop);
  }
}

function backoffDelay(attempt: number): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? BACKOFF_CAP_MS;
  return Math.min(base, BACKOFF_CAP_MS);
}

function isThrottled(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => {
    if (!e || typeof e !== "object") return false;
    const code = (e as { extensions?: { code?: string } }).extensions?.code;
    return code === "THROTTLED";
  });
}

function maybeBackoffOnCost(shop: string, body: unknown): void {
  if (!body || typeof body !== "object") return;
  const ext = (body as { extensions?: { cost?: unknown } }).extensions?.cost;
  if (!ext || typeof ext !== "object") return;
  const ts = (ext as { throttleStatus?: { currentlyAvailable?: number; restoreRate?: number } })
    .throttleStatus;
  if (!ts) return;
  const available = ts.currentlyAvailable;
  const restoreRate = ts.restoreRate;
  if (typeof available !== "number" || typeof restoreRate !== "number") return;
  if (available >= COST_FLOOR) return;
  // How many points do we need to refill back to the floor? Each
  // restoreRate point = 1 second of recovery.
  const deficit = COST_FLOOR - available;
  const waitMs = Math.ceil((deficit / Math.max(1, restoreRate)) * 1000);
  const s = getState(shop);
  s.delayUntil = Math.max(s.delayUntil, Date.now() + Math.min(waitMs, BACKOFF_CAP_MS));
}

/** Test/dev helper. */
export function clearRateLimiterState(shop?: string): void {
  if (shop) state.delete(shop);
  else state.clear();
}
