export const FAMILY_DATE_KINDS = ['anniversary', 'birthday', 'holiday', 'other'] as const;
export type FamilyDateKind = (typeof FAMILY_DATE_KINDS)[number];

export type FamilyDateRecord = {
  id: number;
  title: string;
  kind: FamilyDateKind;
  month: number;
  day: number;
  year: number | null;
  notes: string | null;
  /** ISO date of the next occurrence (local calendar math). */
  nextOccurrence: string;
};

/** Explicit calendar day — avoids server-TZ bugs when anchoring “today”. */
export type CalendarYmd = {
  year: number;
  month: number;
  day: number;
};

export function calendarYmdFromDate(from: Date): CalendarYmd {
  return {
    year: from.getFullYear(),
    month: from.getMonth() + 1,
    day: from.getDate(),
  };
}

function toYmd(from: Date | CalendarYmd): CalendarYmd {
  return from instanceof Date ? calendarYmdFromDate(from) : from;
}

function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

/** Days from `from` until next month/day (0 = today). */
export function daysUntilNextOccurrence(
  month: number,
  day: number,
  from: Date | CalendarYmd = new Date(),
): number {
  const start = toYmd(from);
  let year = start.year;
  if (utcDay(year, month, day) < utcDay(start.year, start.month, start.day)) {
    year += 1;
  }
  return Math.round(
    (utcDay(year, month, day) - utcDay(start.year, start.month, start.day)) / 86_400_000,
  );
}

export function nextOccurrenceIso(
  month: number,
  day: number,
  from: Date | CalendarYmd = new Date(),
): string {
  const start = toYmd(from);
  let year = start.year;
  if (utcDay(year, month, day) < utcDay(start.year, start.month, start.day)) {
    year += 1;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // Use a leap year so Feb 29 is allowed as a recurring date.
  const probe = new Date(2024, month - 1, day);
  return probe.getMonth() === month - 1 && probe.getDate() === day;
}
