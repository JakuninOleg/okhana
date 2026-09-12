import {
  daysUntilNextOccurrence,
  type CalendarYmd,
} from '@/features/family/family-date-utils';
import {
  calendarYmdInOffset,
  daysBetweenYmd,
  DEFAULT_NUDGE_OFFSET_MINUTES,
} from '@/features/notifications/advance-nudge-plan';

export type BriefingSlot = 'morning' | 'evening';

const MAX_PUSH_BODY = 180;

export type BriefingContentInput = {
  slot: BriefingSlot;
  /** Open tasks assigned to this member (pending/seen). */
  openTaskTitles: string[];
  /** Short preformatted lines, e.g. "завтра: Врач". */
  eventLines: string[];
  /** Short preformatted lines, e.g. "через 3 дня: ДР Саша". */
  dateLines: string[];
};

export type BriefingPushContent = {
  title: string;
  body: string;
};

/** Build a compact Web Push payload, or null when there is nothing useful to say. */
export function buildBriefingPushContent(
  input: BriefingContentInput,
): BriefingPushContent | null {
  const parts: string[] = [];

  if (input.openTaskTitles.length === 1) {
    parts.push(`поручение: ${truncate(input.openTaskTitles[0], 40)}`);
  } else if (input.openTaskTitles.length > 1) {
    parts.push(`${input.openTaskTitles.length} поручения`);
  }

  for (const line of input.eventLines.slice(0, 2)) {
    parts.push(line);
  }
  for (const line of input.dateLines.slice(0, 2)) {
    parts.push(line);
  }

  if (parts.length === 0) {
    return null;
  }

  const body = parts.join(' · ');
  return {
    title: input.slot === 'morning' ? 'Доброе утро' : 'Добрый вечер',
    body: body.length <= MAX_PUSH_BODY ? body : `${body.slice(0, MAX_PUSH_BODY - 1)}…`,
  };
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatEventBriefingLine(input: {
  title: string;
  startTime: Date;
  today: CalendarYmd;
  offsetMinutes?: number;
}): string | null {
  const offset = input.offsetMinutes ?? DEFAULT_NUDGE_OFFSET_MINUTES;
  const eventDay = calendarYmdInOffset(input.startTime, offset);
  const days = daysBetweenYmd(input.today, eventDay);
  if (days < 0 || days > 1) {
    return null;
  }
  const when = days === 0 ? 'сегодня' : 'завтра';
  return `${when}: ${truncate(input.title, 36)}`;
}

/**
 * Near memorable date / birthday line for the next 1–7 days
 * (day-of is covered by calendar UX; advance nudges cover 7/3/1).
 */
export function formatRecurringBriefingLine(input: {
  label: string;
  month: number;
  day: number;
  today: CalendarYmd;
}): string | null {
  const days = daysUntilNextOccurrence(input.month, input.day, input.today);
  if (days < 1 || days > 7) {
    return null;
  }
  const when =
    days === 1
      ? 'завтра'
      : days >= 5
        ? `через ${days} дней`
        : `через ${days} дня`;
  return `${when}: ${truncate(input.label, 36)}`;
}

export function briefingDedupeKey(input: {
  slot: BriefingSlot;
  userId: number;
  today: CalendarYmd;
}): string {
  const ymd = `${input.today.year}-${String(input.today.month).padStart(2, '0')}-${String(input.today.day).padStart(2, '0')}`;
  return `briefing:${input.slot}:${input.userId}:${ymd}`;
}
