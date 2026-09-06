/**
 * App locales are ru / en, but both target Europe & CIS — never en-US (MDY).
 */
export function intlLocale(appLocale: string): string {
  return appLocale === 'ru' ? 'ru-RU' : 'en-GB';
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Parse `YYYY-MM-DD` as a local calendar day (no UTC shift). */
export function parseIsoYmdLocal(ymd: string): Date | null {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return new Date(year, month - 1, day);
}

/** Numeric day-month-year: 15.06.2027 (ru) / 15/06/2027 (en-GB). */
export function formatDateNumeric(value: Date | string, appLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(toDate(value));
}

export function formatIsoYmd(ymd: string, appLocale: string): string {
  const date = parseIsoYmdLocal(ymd);
  return date ? formatDateNumeric(date, appLocale) : ymd;
}

/** e.g. 15 June 2027 / 15 июня 2027 */
export function formatDateMedium(value: Date | string, appLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(toDate(value));
}

export function formatDateTimeMedium(value: Date | string, appLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
}

export function formatMonthDay(month: number, day: number, appLocale: string): string {
  const date = new Date(2024, month - 1, day);
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatWeekdayLong(value: Date, appLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(value);
}

export function formatTimeShort(value: Date | string, appLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale(appLocale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value));
}
