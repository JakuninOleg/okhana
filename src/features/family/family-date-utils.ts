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

/** Days from `from` until next month/day (0 = today). */
export function daysUntilNextOccurrence(
  month: number,
  day: number,
  from: Date = new Date(),
): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = new Date(start.getFullYear(), month - 1, day);
  if (candidate < start) {
    candidate = new Date(start.getFullYear() + 1, month - 1, day);
  }
  return Math.round((candidate.getTime() - start.getTime()) / 86_400_000);
}

export function nextOccurrenceIso(
  month: number,
  day: number,
  from: Date = new Date(),
): string {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = new Date(start.getFullYear(), month - 1, day);
  if (candidate < start) {
    candidate = new Date(start.getFullYear() + 1, month - 1, day);
  }
  const y = candidate.getFullYear();
  const m = String(candidate.getMonth() + 1).padStart(2, '0');
  const d = String(candidate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
