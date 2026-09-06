import { describe, expect, it } from 'vitest';
import { isInQuietHours, localHourInOffset } from '@/features/notifications/quiet-hours';

describe('quiet-hours', () => {
  it('detects Moscow overnight window', () => {
    // 2026-09-07 23:30+03 = 20:30Z
    expect(isInQuietHours(new Date('2026-09-07T20:30:00.000Z'), 180)).toBe(true);
    // 2026-09-07 07:30+03 = 04:30Z
    expect(isInQuietHours(new Date('2026-09-07T04:30:00.000Z'), 180)).toBe(true);
    // 2026-09-07 12:00+03 = 09:00Z
    expect(isInQuietHours(new Date('2026-09-07T09:00:00.000Z'), 180)).toBe(false);
    expect(localHourInOffset(new Date('2026-09-07T09:00:00.000Z'), 180)).toBe(12);
  });
});
