import { describe, it, expect } from 'vitest';
import { generateCode } from '../roomCode.js';

const ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

describe('generateCode', () => {
  it('produces a 6-character string', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it('uses only characters from the allowed alphabet', () => {
    const code = generateCode();
    for (const char of code) {
      expect(ALPHABET.has(char)).toBe(true);
    }
  });

  it('generates different codes on subsequent calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    // Probability of all 20 being identical is astronomically small
    expect(codes.size).toBeGreaterThan(1);
  });

  it('never contains ambiguous characters O, I, 0, 1', () => {
    const ambiguous = new Set(['O', 'I', '0', '1']);
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      for (const char of code) {
        expect(ambiguous.has(char)).toBe(false);
      }
    }
  });
});
