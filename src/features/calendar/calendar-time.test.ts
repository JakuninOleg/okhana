import { describe, expect, it } from 'vitest';
import {
  buildMonthVisibleRange,
  buildUpcomingRange,
  parseAbsoluteDateTime,
  parseClientNowParts,
} from '@/features/calendar/calendar-time';

describe('parseClientNowParts', () => {
  it('reads Moscow offset calendar day', () => {
    expect(parseClientNowParts('2026-09-06T01:30:00+03:00')).toEqual({
      year: 2026,
      month: 9,
      day: 6,
      offsetMinutes: 180,
    });
  });

  it('treats Z as UTC', () => {
    expect(parseClientNowParts('2026-09-06T22:00:00Z')?.offsetMinutes).toBe(0);
  });

  it('rejects bare datetime-local', () => {
    expect(parseClientNowParts('2026-09-06T18:00')).toBeNull();
  });
});

describe('buildUpcomingRange', () => {
  it('anchors to client local midnight, not server UTC', () => {
    // 06 Sep 01:30 MSK = 05 Sep 22:30 UTC — "today" for the user is still 6 Sep.
    const { from, to } = buildUpcomingRange({
      daysAhead: 90,
      clientNowIso: '2026-09-06T01:30:00+03:00',
    });
    expect(from.toISOString()).toBe('2026-09-05T21:00:00.000Z'); // midnight MSK
    expect(to.toISOString()).toBe('2026-12-04T21:00:00.000Z');
  });

  it('falls back to runtime-local day when clientNow missing', () => {
    const now = new Date(2026, 8, 6, 15, 0, 0); // local Sep 6
    const { from, to } = buildUpcomingRange({ daysAhead: 2, now });
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(8);
    expect(from.getDate()).toBe(6);
    expect(to.getDate()).toBe(8);
  });
});

describe('buildMonthVisibleRange', () => {
  it('covers September 2026 with pad in Moscow offset', () => {
    const { from, to } = buildMonthVisibleRange({
      year: 2026,
      month: 9,
      padDays: 7,
      clientNowIso: '2026-09-06T12:00:00+03:00',
    });
    // Sep 1 00:00 MSK minus 7 days = Aug 25 00:00 MSK
    expect(from.toISOString()).toBe('2026-08-24T21:00:00.000Z');
    // Oct 1 00:00 MSK plus 7 days = Oct 8 00:00 MSK
    expect(to.toISOString()).toBe('2026-10-07T21:00:00.000Z');
  });
});

describe('parseAbsoluteDateTime', () => {
  it('accepts offset ISO', () => {
    expect(parseAbsoluteDateTime('2026-09-10T18:00:00+03:00')?.toISOString()).toBe(
      '2026-09-10T15:00:00.000Z',
    );
  });

  it('rejects datetime-local without zone', () => {
    expect(parseAbsoluteDateTime('2026-09-10T18:00')).toBeNull();
  });
});

describe('interpretEventDateTime', () => {
  it('maps bare local time using client offset', async () => {
    const { interpretEventDateTime } = await import('./calendar-time');
    expect(
      interpretEventDateTime('2026-09-10T18:00', '2026-09-06T12:00:00+03:00')?.toISOString(),
    ).toBe('2026-09-10T15:00:00.000Z');
  });

  it('returns null for bare time without clientNow', async () => {
    const { interpretEventDateTime } = await import('./calendar-time');
    expect(interpretEventDateTime('2026-09-10T18:00', null)).toBeNull();
  });
});
