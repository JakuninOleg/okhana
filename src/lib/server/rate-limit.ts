/**
 * Simple per-isolate sliding-window rate limit (no Redis).
 * Good enough for friend-test / single-region; multi-instance still multiplies capacity.
 */
type Bucket = {
  count: number;
  resetAt: number;
};

type GlobalRateLimit = typeof globalThis & {
  __okhanaRateLimit?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  const g = globalThis as GlobalRateLimit;
  if (!g.__okhanaRateLimit) {
    g.__okhanaRateLimit = new Map();
  }
  return g.__okhanaRateLimit;
}

export type RateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
};

export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}): RateLimitResult {
  const now = input.nowMs ?? Date.now();
  const map = store();
  const current = map.get(input.key);

  if (!current || now >= current.resetAt) {
    map.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (current.count >= input.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  map.set(input.key, current);
  return { ok: true, retryAfterSec: 0 };
}
