import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunAdvanceNudges = vi.hoisted(() => vi.fn());
const mockRunDailyBriefings = vi.hoisted(() => vi.fn());
const mockRunTaskReminders = vi.hoisted(() => vi.fn());

vi.mock('@/features/notifications/run-advance-nudges', () => ({
  runAdvanceNudges: (...args: unknown[]) => mockRunAdvanceNudges(...args),
}));

vi.mock('@/features/notifications/run-daily-briefings', () => ({
  runDailyBriefings: (...args: unknown[]) => mockRunDailyBriefings(...args),
}));

vi.mock('@/features/notifications/run-task-reminders', () => ({
  runTaskReminders: (...args: unknown[]) => mockRunTaskReminders(...args),
}));

describe('GET /api/cron/advance-nudges', () => {
  beforeEach(() => {
    mockRunAdvanceNudges.mockReset();
    mockRunDailyBriefings.mockReset();
    mockRunTaskReminders.mockReset();
    delete process.env.CRON_SECRET;
    vi.resetModules();
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

  it('runs nudges and morning briefing when authorized', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockRunAdvanceNudges.mockResolvedValue({
      planned: 2,
      sent: 1,
      skippedDuplicate: 1,
      familiesScanned: 3,
    });
    mockRunDailyBriefings.mockResolvedValue({
      slot: 'morning',
      planned: 4,
      sent: 3,
      skippedDuplicate: 0,
      skippedEmpty: 1,
      membersScanned: 5,
    });
    mockRunTaskReminders.mockResolvedValue({
      pendingSeenSent: 1,
      dueSent: 2,
      skippedDuplicate: 0,
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
      nudges: {
        planned: 2,
        sent: 1,
        skippedDuplicate: 1,
        familiesScanned: 3,
      },
      taskReminders: {
        pendingSeenSent: 1,
        dueSent: 2,
        skippedDuplicate: 0,
      },
      briefing: {
        slot: 'morning',
        planned: 4,
        sent: 3,
        skippedDuplicate: 0,
        skippedEmpty: 1,
        membersScanned: 5,
      },
    });
    expect(mockRunAdvanceNudges).toHaveBeenCalledOnce();
    expect(mockRunTaskReminders).toHaveBeenCalledOnce();
    expect(mockRunDailyBriefings).toHaveBeenCalledWith({ slot: 'morning' });
  });
});
