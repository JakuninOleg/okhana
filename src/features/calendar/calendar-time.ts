/**
 * Calendar day windows relative to the user's device clock.
 * Never use bare `new Date()` + setHours on the server for "today" —
 * Vercel hosts run in UTC and would shift family evenings across midnight.
 */

export type CalendarDayParts = {
  year: number;
  month: number;
  day: number;
  /** Minutes east of UTC (Moscow = +180). */
  offsetMinutes: number;
};

/** Parse `2026-09-06T18:30:00+03:00` / `...Z` into calendar parts in that offset. */
export function parseClientNowParts(iso: string): CalendarDayParts | null {
  const match = iso.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const zone = match[4];

  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }

  return { year, month, day, offsetMinutes };
}

/**
 * Inclusive-start / exclusive-end range covering `daysAhead` local calendar days
 * beginning at local midnight of `clientNowIso` (or runtime-local midnight).
 */
export function buildUpcomingRange(input: {
  daysAhead: number;
  clientNowIso?: string | null;
  /** Injected for tests. */
  now?: Date;
}): { from: Date; to: Date } {
  const daysAhead = Math.min(Math.max(Math.trunc(input.daysAhead), 1), 180);
  const parts = input.clientNowIso ? parseClientNowParts(input.clientNowIso) : null;

  if (parts) {
    const fromUtcMs =
      Date.UTC(parts.year, parts.month - 1, parts.day)
      - parts.offsetMinutes * 60_000;
    return {
      from: new Date(fromUtcMs),
      to: new Date(fromUtcMs + daysAhead * 86_400_000),
    };
  }

  const now = input.now ?? new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + daysAhead);
  return { from, to };
}

/** Require an absolute instant (Z or ±HH:MM). Rejects bare `datetime-local` strings. */
export function parseAbsoluteDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    return null;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse event datetime for AI/UI:
 * - ISO with Z/offset → absolute instant
 * - bare `YYYY-MM-DDTHH:mm` → interpret in the client's offset from `clientNowIso`
 */
export function interpretEventDateTime(
  value: string,
  clientNowIso?: string | null,
): Date | null {
  const absolute = parseAbsoluteDateTime(value);
  if (absolute) {
    return absolute;
  }

  const bare = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!bare || !clientNowIso) {
    return null;
  }

  const parts = parseClientNowParts(clientNowIso);
  if (!parts) {
    return null;
  }

  const year = Number(bare[1]);
  const month = Number(bare[2]);
  const day = Number(bare[3]);
  const hour = Number(bare[4]);
  const minute = Number(bare[5]);
  const second = Number(bare[6] ?? 0);
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, second)
    - parts.offsetMinutes * 60_000;
  return new Date(utcMs);
}

/** Local calendar Y-M-D from a clientNow ISO (for memorable-date “today”). */
export function calendarYmdFromClientNow(clientNowIso?: string | null): {
  year: number;
  month: number;
  day: number;
} | null {
  const parts = clientNowIso ? parseClientNowParts(clientNowIso) : null;
  if (!parts) {
    return null;
  }
  return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * Inclusive-start / exclusive-end window for a month grid, including `padDays`
 * of outside cells (react-day-picker showOutsideDays).
 */
export function buildMonthVisibleRange(input: {
  year: number;
  /** 1–12 */
  month: number;
  padDays?: number;
  clientNowIso?: string | null;
}): { from: Date; to: Date } {
  const year = Math.trunc(input.year);
  const month = Math.trunc(input.month);
  const pad = Math.min(Math.max(Math.trunc(input.padDays ?? 7), 0), 14);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    const now = new Date();
    return buildMonthVisibleRange({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      padDays: pad,
      clientNowIso: input.clientNowIso,
    });
  }

  const parts = input.clientNowIso ? parseClientNowParts(input.clientNowIso) : null;
  if (parts) {
    const monthStartUtcMs =
      Date.UTC(year, month - 1, 1) - parts.offsetMinutes * 60_000;
    const nextMonthStartUtcMs =
      Date.UTC(year, month, 1) - parts.offsetMinutes * 60_000;
    return {
      from: new Date(monthStartUtcMs - pad * 86_400_000),
      to: new Date(nextMonthStartUtcMs + pad * 86_400_000),
    };
  }

  const from = new Date(year, month - 1, 1 - pad);
  const to = new Date(year, month, 1 + pad);
  return { from, to };
}

/** Client helper: local midnight → +N days as ISO instants for the server. */
export function clientUpcomingRangeIso(daysAhead = 90): { from: string; to: string } {
  const { from, to } = buildUpcomingRange({ daysAhead });
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Local ISO-8601 with numeric offset (for calendar load + AI tools). */
export function formatClientNowIso(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return `${local.toISOString().slice(0, 19)}${sign}${hours}:${minutes}`;
}
