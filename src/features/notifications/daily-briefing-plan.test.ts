import { describe, expect, it } from 'vitest';
import {
  briefingDedupeKey,
  buildBriefingPushContent,
  formatEventBriefingLine,
  formatRecurringBriefingLine,
} from '@/features/notifications/daily-briefing-plan';

describe('daily-briefing-plan', () => {
  const today = { year: 2026, month: 9, day: 7 };

  it('builds morning body from tasks events and dates', () => {
    expect(
      buildBriefingPushContent({
        slot: 'morning',
        openTaskTitles: ['Купить молоко', 'Позвонить'],
        eventLines: ['завтра: Врач'],
        dateLines: ['через 3 дня: ДР Саша'],
      }),
    ).toEqual({
      title: 'Okhana · утро',
      body: '2 поручения · завтра: Врач · через 3 дня: ДР Саша',
    });
  });

  it('returns null when there is nothing to report', () => {
    expect(
      buildBriefingPushContent({
        slot: 'evening',
        openTaskTitles: [],
        eventLines: [],
        dateLines: [],
      }),
    ).toBeNull();
  });

  it('formats today/tomorrow events only', () => {
    expect(
      formatEventBriefingLine({
        title: 'Врач',
        startTime: new Date('2026-09-08T07:00:00.000Z'),
        today,
        offsetMinutes: 180,
      }),
    ).toBe('завтра: Врач');

    expect(
      formatEventBriefingLine({
        title: 'Позже',
        startTime: new Date('2026-09-10T07:00:00.000Z'),
        today,
        offsetMinutes: 180,
      }),
    ).toBeNull();
  });

  it('formats recurring dates in the next week', () => {
    expect(
      formatRecurringBriefingLine({
        label: 'ДР Саша',
        month: 9,
        day: 10,
        today,
      }),
    ).toBe('через 3 дня: ДР Саша');

    expect(
      formatRecurringBriefingLine({
        label: 'Свадьба',
        month: 9,
        day: 7,
        today,
      }),
    ).toBeNull();
  });

  it('builds stable per-user dedupe keys', () => {
    expect(
      briefingDedupeKey({ slot: 'evening', userId: 9, today }),
    ).toBe('briefing:evening:9:2026-09-07');
  });
});
