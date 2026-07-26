import { describe, expect, it } from 'vitest';
import { isConfidentlyEnglish, truncateForTts } from '@/features/ai/english-guard';

describe('isConfidentlyEnglish', () => {
  it('accepts clear English sentences', () => {
    expect(isConfidentlyEnglish('You still have milk on the grocery list.')).toBe(true);
  });

  it('rejects Russian text', () => {
    expect(isConfidentlyEnglish('В списке покупок ещё есть молоко.')).toBe(false);
  });

  it('rejects mixed or indeterminate short text', () => {
    expect(isConfidentlyEnglish('ok')).toBe(false);
    expect(isConfidentlyEnglish('Hello мир and more English words here')).toBe(false);
  });
});

describe('truncateForTts', () => {
  it('keeps short text unchanged', () => {
    expect(truncateForTts('Hello family')).toBe('Hello family');
  });

  it('truncates long text near a word boundary', () => {
    const long = 'word '.repeat(50).trim();
    const result = truncateForTts(long, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith(' ')).toBe(false);
  });
});
