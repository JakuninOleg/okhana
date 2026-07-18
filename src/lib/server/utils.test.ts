import { describe, it, expect } from 'vitest';
import { generateInviteCode, generateId } from './utils';

describe('generateInviteCode', () => {
  // The alphabet deliberately excludes ambiguous characters so codes can be
  // read aloud or typed by hand between family members.
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  it('produces an 8-character code', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
  });

  it('only uses characters from the unambiguous alphabet', () => {
    // Run multiple times — nanoid is random, a single sample could pass by luck.
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(ALPHABET).toContain(char);
      }
    }
  });

  it('never contains ambiguous characters (0, O, 1, I, l)', () => {
    const forbidden = ['0', 'O', '1', 'I', 'l'];
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      for (const char of forbidden) {
        expect(code).not.toContain(char);
      }
    }
  });

  it('is uppercase only', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toBe(code.toUpperCase());
    }
  });

  it('generates different codes across calls (uniqueness sanity check)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // With 32^8 possible codes, collisions across 100 draws are astronomically
    // unlikely — a collision here would indicate a seeding bug.
    expect(codes.size).toBe(100);
  });
});

describe('generateId', () => {
  it('produces a non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('respects a custom length', () => {
    const id = generateId(10);
    expect(id).toHaveLength(10);
  });
});
