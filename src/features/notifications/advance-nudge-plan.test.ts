import { describe, expect, it } from 'vitest';
import {
  calendarYmdInOffset,
  daysBetweenYmd,
  planEventNudges,
  planMemberBirthdayNudges,
  planMemorableDateNudges,
} from '@/features/notifications/advance-nudge-plan';

describe('advance-nudge-plan', () => {
  const today = { year: 2026, month: 9, day: 7 };

  it('plans member birthday at 7/3/1 day leads only', () => {
    expect(
      planMemberBirthdayNudges({
        familyId: 1,
        userId: 9,
        displayName: 'Саша',
        birthMonth: 9,
        birthDay: 14,
        today,
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'member_birthday',
        leadDays: 7,
        title: 'День рождения',
        body: 'День рождения Саша — через 7 дней. Не забудьте поздравить.',
        dedupeKey: 'member_birthday:9:2026-09-14:7',
        excludeUserIds: [9],
      }),
    ]);

    expect(
      planMemberBirthdayNudges({
        familyId: 1,
        userId: 9,
        displayName: 'Саша',
        birthMonth: 9,
        birthDay: 10,
        today,
      })[0]?.leadDays,
    ).toBe(3);

    expect(
      planMemberBirthdayNudges({
        familyId: 1,
        userId: 9,
        displayName: 'Саша',
        birthMonth: 9,
        birthDay: 8,
        today,
      })[0]?.leadDays,
    ).toBe(1);

    expect(
      planMemberBirthdayNudges({
        familyId: 1,
        userId: 9,
        displayName: 'Саша',
        birthMonth: 9,
        birthDay: 7,
        today,
      }),
    ).toEqual([]);
  });

  it('plans memorable dates with stable dedupe keys', () => {
    const planned = planMemorableDateNudges({
      familyId: 2,
      dateId: 44,
      title: 'Годовщина свадьбы',
      month: 9,
      day: 10,
      today,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      kind: 'memorable_date',
      leadDays: 3,
      dedupeKey: 'memorable_date:44:2026-09-10:3',
      title: 'Памятная дата',
      body: 'Годовщина свадьбы — через 3 дня',
    });
  });

  it('excludes the birthday person from birthday nudge recipients', () => {
    const planned = planMemberBirthdayNudges({
      familyId: 1,
      userId: 9,
      displayName: 'Саша',
      birthMonth: 9,
      birthDay: 14,
      today,
    });
    expect(planned[0]?.excludeUserIds).toEqual([9]);
  });

  it('plans events using Moscow offset calendar day', () => {
    // 2026-09-10 10:00+03:00 = 07:00Z → local day 10 Sep in +180
    const start = new Date('2026-09-10T07:00:00.000Z');
    const planned = planEventNudges({
      familyId: 3,
      eventId: 12,
      title: 'Врач',
      startTime: start,
      today,
      offsetMinutes: 180,
    });
    expect(planned[0]).toMatchObject({
      kind: 'event',
      leadDays: 3,
      occurrenceIso: '2026-09-10',
      title: 'Календарь',
      body: 'Врач — через 3 дня',
      recipientUserIds: null,
    });
  });

  it('plans targeted event nudges for participants only', () => {
    const start = new Date('2026-09-10T07:00:00.000Z');
    const planned = planEventNudges({
      familyId: 3,
      eventId: 12,
      title: 'Board games',
      startTime: start,
      today,
      offsetMinutes: 180,
      participantUserIds: [2, 5],
    });
    expect(planned[0]).toMatchObject({
      recipientUserIds: [2, 5],
    });
  });

  it('calendarYmdInOffset and daysBetweenYmd stay stable across UTC', () => {
    expect(calendarYmdInOffset(new Date('2026-09-07T21:30:00.000Z'), 180)).toEqual({
      year: 2026,
      month: 9,
      day: 8,
    });
    expect(
      daysBetweenYmd(
        { year: 2026, month: 9, day: 7 },
        { year: 2026, month: 9, day: 14 },
      ),
    ).toBe(7);
  });
});
