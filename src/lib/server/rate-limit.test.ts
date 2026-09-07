import { describe, expect, it } from 'vitest';
import { consumeRateLimit } from '@/lib/server/rate-limit';

describe('consumeRateLimit', () => {
  it('allows up to the limit then blocks until window reset', () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const windowMs = 60_000;
    const now = 1_000_000;

    expect(consumeRateLimit({ key, limit: 2, windowMs, nowMs: now }).ok).toBe(true);
    expect(consumeRateLimit({ key, limit: 2, windowMs, nowMs: now + 1 }).ok).toBe(true);
    const blocked = consumeRateLimit({ key, limit: 2, windowMs, nowMs: now + 2 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    expect(consumeRateLimit({ key, limit: 2, windowMs, nowMs: now + windowMs }).ok).toBe(true);
  });
});
