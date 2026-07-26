import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnd = vi.hoisted(() => vi.fn(async () => undefined));
const mockPostgres = vi.hoisted(() =>
  vi.fn((_url: unknown, _options?: unknown) => ({ end: mockEnd })),
);

vi.mock('postgres', () => ({
  default: (url: unknown, options?: unknown) => mockPostgres(url, options),
}));

describe('withDbRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete (globalThis as { __okhanaSql?: unknown }).__okhanaSql;
    delete (globalThis as { __okhanaDbInvalid?: unknown }).__okhanaDbInvalid;
    delete (globalThis as { __okhanaSqlReset?: unknown }).__okhanaSqlReset;
    delete (globalThis as { __okhanaSqlCreatedAt?: unknown }).__okhanaSqlCreatedAt;
    delete (globalThis as { __okhanaDbMutex?: unknown }).__okhanaDbMutex;
    vi.stubEnv('NODE_ENV', 'development');
    process.env.DATABASE_URL = 'postgresql://localhost:6543/okhana';
    delete process.env.DIRECT_URL;
    delete process.env.VERCEL;
  });

  it('reconnects once after ECONNRESET', async () => {
    const { getSql, withDbRetry } = await import('./client');
    getSql();

    const dead = Object.assign(new Error('Failed query: select 1'), {
      cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    });
    const operation = vi
      .fn()
      .mockRejectedValueOnce(dead)
      .mockResolvedValueOnce('ok');

    await expect(withDbRetry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-connection Failed query errors', async () => {
    const { withDbRetry } = await import('./client');
    const error = Object.assign(new Error('Failed query: insert'), {
      cause: Object.assign(new Error('duplicate key'), { code: '23505' }),
    });
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withDbRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('uses DATABASE_URL with max 1', async () => {
    process.env.DIRECT_URL = 'postgresql://localhost:5432/direct';
    process.env.DATABASE_URL = 'postgresql://localhost:6543/pooler';
    const { getSql } = await import('./client');
    getSql();
    expect(mockPostgres).toHaveBeenCalledWith(
      'postgresql://localhost:6543/pooler',
      expect.objectContaining({ max: 1, prepare: false }),
    );
  });
});
