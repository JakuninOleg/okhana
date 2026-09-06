import { describe, expect, it } from 'vitest';
import {
  formatDateNumeric,
  formatIsoYmd,
  intlLocale,
  parseIsoYmdLocal,
} from '@/lib/format-date';

describe('format-date', () => {
  it('maps app locales to Europe/CIS Intl locales', () => {
    expect(intlLocale('ru')).toBe('ru-RU');
    expect(intlLocale('en')).toBe('en-GB');
  });

  it('formats numeric as day-month-year', () => {
    const date = new Date(2027, 5, 15);
    expect(formatDateNumeric(date, 'ru')).toMatch(/15\.06\.2027/);
    expect(formatDateNumeric(date, 'en')).toMatch(/15\/06\/2027/);
  });

  it('formats ISO YMD without UTC shift', () => {
    expect(parseIsoYmdLocal('2027-06-15')).toEqual(new Date(2027, 5, 15));
    expect(formatIsoYmd('2027-06-15', 'ru')).toMatch(/15\.06\.2027/);
  });
});
