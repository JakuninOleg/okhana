import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunDailyBriefings = vi.hoisted(() => vi.fn());

vi.mock('@/features/notifications/run-daily-briefings', () => ({
  runDailyBriefings: (...args: unknown[]) => mockRunDailyBriefings(...args),
}));

describe('GET /api/cron/daily-briefing', () => {
  beforeEach(() => {
    mockRunDailyBriefings.mockReset();
    delete process.env.CRON_SECRET;
    vi.resetModules();
  });

  it('returns 401 without bearer secret', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const { GET } = await import('@/app/api/cron/daily-briefing/route');
    const response = await GET(new Request('http://localhost/api/cron/daily-briefing'));
    expect(response.status).toBe(401);
  });

  it('runs evening briefing when authorized', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockRunDailyBriefings.mockResolvedValue({
      slot: 'evening',
      planned: 2,
      sent: 2,
      skippedDuplicate: 0,
      skippedEmpty: 3,
      membersScanned: 5,
    });
    const { GET } = await import('@/app/api/cron/daily-briefing/route');
    const response = await GET(
      new Request('http://localhost/api/cron/daily-briefing', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      briefing: {
        slot: 'evening',
        planned: 2,
        sent: 2,
        skippedDuplicate: 0,
        skippedEmpty: 3,
        membersScanned: 5,
      },
    });
    expect(mockRunDailyBriefings).toHaveBeenCalledWith({ slot: 'evening' });
  });
});
