import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunAdvanceNudges = vi.hoisted(() => vi.fn());

vi.mock('@/features/notifications/run-advance-nudges', () => ({
  runAdvanceNudges: (...args: unknown[]) => mockRunAdvanceNudges(...args),
}));

describe('GET /api/cron/advance-nudges', () => {
  beforeEach(() => {
    mockRunAdvanceNudges.mockReset();
    delete process.env.CRON_SECRET;
  });

  it('returns 503 when CRON_SECRET is unset', async () => {
    const { GET } = await import('@/app/api/cron/advance-nudges/route');
    const response = await GET(new Request('http://localhost/api/cron/advance-nudges'));
    expect(response.status).toBe(503);
    expect(mockRunAdvanceNudges).not.toHaveBeenCalled();
  });

  it('returns 401 without bearer secret', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const { GET } = await import('@/app/api/cron/advance-nudges/route');
    const response = await GET(new Request('http://localhost/api/cron/advance-nudges'));
    expect(response.status).toBe(401);
    expect(mockRunAdvanceNudges).not.toHaveBeenCalled();
  });

  it('runs nudges when authorized', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockRunAdvanceNudges.mockResolvedValue({
      planned: 2,
      sent: 1,
      skippedDuplicate: 1,
      familiesScanned: 3,
    });
    const { GET } = await import('@/app/api/cron/advance-nudges/route');
    const response = await GET(
      new Request('http://localhost/api/cron/advance-nudges', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      planned: 2,
      sent: 1,
      skippedDuplicate: 1,
      familiesScanned: 3,
    });
    expect(mockRunAdvanceNudges).toHaveBeenCalledOnce();
  });
});
