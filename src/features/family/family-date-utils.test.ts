import { describe, expect, it } from 'vitest';
import {
  daysUntilNextOccurrence,
  isValidMonthDay,
  nextOccurrenceIso,
} from '@/features/family/family-date-utils';

describe('family-date-utils', () => {
  it('accepts leap-day as a recurring month/day', () => {
    expect(isValidMonthDay(2, 29)).toBe(true);
    expect(isValidMonthDay(2, 30)).toBe(false);
    expect(isValidMonthDay(4, 31)).toBe(false);
  });

  it('computes next occurrence later this year', () => {
    const from = new Date(2026, 2, 1); // 1 Mar 2026
    expect(nextOccurrenceIso(12, 25, from)).toBe('2026-12-25');
    expect(daysUntilNextOccurrence(12, 25, from)).toBeGreaterThan(200);
  });

  it('rolls to next year when the date already passed', () => {
    const from = new Date(2026, 11, 26); // 26 Dec 2026
    expect(nextOccurrenceIso(12, 25, from)).toBe('2027-12-25');
  });

  it('treats today as zero days away', () => {
    const from = new Date(2026, 5, 15);
    expect(daysUntilNextOccurrence(6, 15, from)).toBe(0);
    expect(nextOccurrenceIso(6, 15, from)).toBe('2026-06-15');
  });
});
