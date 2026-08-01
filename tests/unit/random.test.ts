import { describe, expect, it } from 'vitest';

import {
  randomInterruptionInterval,
  SeededRandom,
  selectMiniGame,
  selectScenario,
} from '../../src/game/random';
import type { MiniGameId } from '../../src/game/types';

describe('SeededRandom', () => {
  it('repeats a sequence for identical numeric or string seeds', () => {
    const first = new SeededRandom('session-42');
    const second = new SeededRandom('session-42');
    const different = new SeededRandom('session-43');

    const firstSequence = Array.from({ length: 6 }, () => first.next());
    const secondSequence = Array.from({ length: 6 }, () => second.next());
    const differentSequence = Array.from({ length: 6 }, () => different.next());

    expect(firstSequence).toEqual(secondSequence);
    expect(differentSequence).not.toEqual(firstSequence);
    expect(firstSequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('rejects non-finite numeric seeds', () => {
    expect(() => new SeededRandom(Number.NaN)).toThrow(RangeError);
  });
});

describe('random selection', () => {
  it('produces inclusive interruption interval endpoints', () => {
    expect(randomInterruptionInterval(() => 0)).toBe(10_000);
    expect(randomInterruptionInterval(() => 0.5)).toBe(12_500);
    expect(randomInterruptionInterval(() => 1)).toBe(15_000);
  });

  it('accepts a seeded random object and rejects invalid random output', () => {
    const random = new SeededRandom(9);
    expect(randomInterruptionInterval(random)).toBeGreaterThanOrEqual(10_000);
    expect(() => randomInterruptionInterval(() => -0.01)).toThrow(RangeError);
    expect(() => randomInterruptionInterval(() => 1.01)).toThrow(RangeError);
  });

  it('avoids immediately repeating a scenario without mutating the input', () => {
    const scenarios = [{ id: 'one' }, { id: 'two' }, { id: 'three' }] as const;
    const original = [...scenarios];

    expect(selectScenario(scenarios, 'one', () => 0).id).toBe('two');
    expect(selectScenario(scenarios, 'two', () => 1).id).toBe('three');
    expect(scenarios).toEqual(original);
  });

  it('returns the only scenario and rejects an empty list', () => {
    expect(selectScenario([{ id: 'only' }], 'only', () => 0).id).toBe('only');
    expect(() => selectScenario([], null)).toThrow(RangeError);
  });

  it('excludes the previous two mini-games from rotation', () => {
    const ids = [
      'calendar-collision',
      'reply-all-intercept',
      'paper-jam',
      'hold-music-hero',
    ] satisfies MiniGameId[];

    expect(selectMiniGame(ids, ['calendar-collision', 'reply-all-intercept'], () => 0))
      .toBe('paper-jam');
    expect(selectMiniGame(ids, ['calendar-collision', 'reply-all-intercept'], () => 1))
      .toBe('hold-music-hero');
  });

  it('degrades safely for tiny mini-game pools', () => {
    const pair = ['calendar-collision', 'reply-all-intercept'] satisfies MiniGameId[];
    expect(selectMiniGame(pair, pair, () => 0)).toBe('calendar-collision');
    expect(selectMiniGame(['paper-jam'], ['paper-jam'], () => 0)).toBe('paper-jam');
    expect(() => selectMiniGame([], [])).toThrow(RangeError);
  });
});
