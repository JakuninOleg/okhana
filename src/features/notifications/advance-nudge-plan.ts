import {
  daysUntilNextOccurrence,
  nextOccurrenceIso,
  type CalendarYmd,
} from '@/features/family/family-date-utils';

/** Default CIS “today” for cron until families store their own TZ. */
export const DEFAULT_NUDGE_OFFSET_MINUTES = 180; // Europe/Moscow

/** Lead windows from the roadmap: remind 7 / 3 / 1 day(s) ahead. */
export const ADVANCE_NUDGE_LEAD_DAYS = [7, 3, 1] as const;
export type AdvanceNudgeLeadDays = (typeof ADVANCE_NUDGE_LEAD_DAYS)[number];

export type AdvanceNudgeKind = 'member_birthday' | 'memorable_date' | 'event';

export type PlannedAdvanceNudge = {
  kind: AdvanceNudgeKind;
  familyId: number;
  /** Unique per occurrence + lead window — used for DB idempotency. */
  dedupeKey: string;
  tag: string;
  body: string;
  leadDays: AdvanceNudgeLeadDays;
  occurrenceIso: string;
};

function isLeadDay(days: number): days is AdvanceNudgeLeadDays {
  return (ADVANCE_NUDGE_LEAD_DAYS as readonly number[]).includes(days);
}

/** Calendar Y-M-D of an instant in a fixed UTC offset (minutes east of UTC). */
export function calendarYmdInOffset(
  instant: Date,
  offsetMinutes: number,
): CalendarYmd {
  const shifted = new Date(instant.getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function utcDayMs(ymd: CalendarYmd): number {
  return Date.UTC(ymd.year, ymd.month - 1, ymd.day);
}

/** Whole calendar days from `from` to `to` (0 = same day). */
export function daysBetweenYmd(from: CalendarYmd, to: CalendarYmd): number {
  return Math.round((utcDayMs(to) - utcDayMs(from)) / 86_400_000);
}

function leadPhraseRu(leadDays: AdvanceNudgeLeadDays): string {
  if (leadDays === 1) {
    return 'завтра';
  }
  if (leadDays === 7) {
    return 'через 7 дней';
  }
  return `через ${leadDays} дня`;
}

/**
 * Plan member-birthday nudges for one family.
 * `birthMonth`/`birthDay` are 1-based calendar parts from profile `birth_date`.
 */
export function planMemberBirthdayNudges(input: {
  familyId: number;
  userId: number;
  displayName: string;
  birthMonth: number;
  birthDay: number;
  today: CalendarYmd;
}): PlannedAdvanceNudge[] {
  const days = daysUntilNextOccurrence(
    input.birthMonth,
    input.birthDay,
    input.today,
  );
  if (!isLeadDay(days)) {
    return [];
  }
  const occurrenceIso = nextOccurrenceIso(
    input.birthMonth,
    input.birthDay,
    input.today,
  );
  return [
    {
      kind: 'member_birthday',
      familyId: input.familyId,
      leadDays: days,
      occurrenceIso,
      dedupeKey: `member_birthday:${input.userId}:${occurrenceIso}:${days}`,
      tag: `nudge-bday-${input.userId}-${occurrenceIso}-${days}`,
      body: `🎂 День рождения: ${input.displayName} — ${leadPhraseRu(days)}`,
    },
  ];
}

export function planMemorableDateNudges(input: {
  familyId: number;
  dateId: number;
  title: string;
  month: number;
  day: number;
  today: CalendarYmd;
}): PlannedAdvanceNudge[] {
  const days = daysUntilNextOccurrence(input.month, input.day, input.today);
  if (!isLeadDay(days)) {
    return [];
  }
  const occurrenceIso = nextOccurrenceIso(input.month, input.day, input.today);
  return [
    {
      kind: 'memorable_date',
      familyId: input.familyId,
      leadDays: days,
      occurrenceIso,
      dedupeKey: `memorable_date:${input.dateId}:${occurrenceIso}:${days}`,
      tag: `nudge-date-${input.dateId}-${occurrenceIso}-${days}`,
      body: `💝 ${input.title} — ${leadPhraseRu(days)}`,
    },
  ];
}

export function planEventNudges(input: {
  familyId: number;
  eventId: number;
  title: string;
  startTime: Date;
  today: CalendarYmd;
  offsetMinutes?: number;
}): PlannedAdvanceNudge[] {
  const eventDay = calendarYmdInOffset(
    input.startTime,
    input.offsetMinutes ?? DEFAULT_NUDGE_OFFSET_MINUTES,
  );
  const days = daysBetweenYmd(input.today, eventDay);
  if (!isLeadDay(days)) {
    return [];
  }
  const occurrenceIso = `${eventDay.year}-${String(eventDay.month).padStart(2, '0')}-${String(eventDay.day).padStart(2, '0')}`;
  return [
    {
      kind: 'event',
      familyId: input.familyId,
      leadDays: days,
      occurrenceIso,
      dedupeKey: `event:${input.eventId}:${occurrenceIso}:${days}`,
      tag: `nudge-event-${input.eventId}-${occurrenceIso}-${days}`,
      body: `📅 ${input.title} — ${leadPhraseRu(days)}`,
    },
  ];
}
