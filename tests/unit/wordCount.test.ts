import { describe, expect, it } from 'vitest';

import { canSend, countWords, DEFAULT_SEND_WORD_MINIMUM, tokenizeWords } from '../../src/game/wordCount';

describe('word counting', () => {
  it('counts lexical tokens across whitespace and punctuation', () => {
    expect(countWords('  One,\ttwo...\nthree!  ')).toBe(3);
    expect(countWords('— … 🎉')).toBe(0);
  });

  it('keeps contractions and hyphenated compounds as single words', () => {
    expect(tokenizeWords("don't re-enter mother–in–law")).toEqual([
      "don't",
      're-enter',
      'mother–in–law',
    ]);
  });

  it('supports Unicode letters and numbers', () => {
    expect(countWords('naïve café 東京 08:30')).toBe(5);
  });

  it('enables sending at exactly the configured threshold', () => {
    expect(DEFAULT_SEND_WORD_MINIMUM).toBe(100);
    const below = Array.from({ length: DEFAULT_SEND_WORD_MINIMUM - 1 }, () => 'word').join(' ');
    const exact = `${below} final`;

    expect(canSend(below)).toBe(false);
    expect(canSend(exact)).toBe(true);
    expect(canSend('one two three', 3)).toBe(true);
  });

  it('rejects invalid thresholds', () => {
    expect(() => canSend('text', -1)).toThrow(RangeError);
    expect(() => canSend('text', 1.5)).toThrow(RangeError);
  });
});
