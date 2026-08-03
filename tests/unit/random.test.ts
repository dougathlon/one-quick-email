import { describe, expect, it } from 'vitest';

import {
  MiniGameShuffleBag,
  randomInterruptionInterval,
  SeededRandom,
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

});

const MINI_GAME_IDS = [
  'calendar-collision',
  'reply-all-intercept',
  'paper-jam',
  'hold-music-hero',
  'stamp-of-approval',
  'expense-triage',
  'quick-question',
  'phone-transfer',
  'badge-scan',
] satisfies MiniGameId[];

describe('MiniGameShuffleBag', () => {
  it('plays every mini-game exactly once in each consecutive group of nine', () => {
    const rotation = new MiniGameShuffleBag(MINI_GAME_IDS, new SeededRandom('three-bags'));
    const draws = Array.from({ length: MINI_GAME_IDS.length * 3 }, () => rotation.next());
    const expected = [...MINI_GAME_IDS].sort();

    for (let start = 0; start < draws.length; start += MINI_GAME_IDS.length) {
      const group = draws.slice(start, start + MINI_GAME_IDS.length);
      expect(group).toHaveLength(MINI_GAME_IDS.length);
      expect([...group].sort()).toEqual(expected);
    }
  });

  it('does not repeat a mini-game at bag boundaries', () => {
    const rotation = new MiniGameShuffleBag(MINI_GAME_IDS, new SeededRandom('many-bags'));
    const draws = Array.from({ length: MINI_GAME_IDS.length * 20 }, () => rotation.next());

    for (let index = MINI_GAME_IDS.length; index < draws.length; index += MINI_GAME_IDS.length) {
      expect(draws[index]).not.toBe(draws[index - 1]);
    }
  });

  it('is deterministic for a seeded source', () => {
    const first = new MiniGameShuffleBag(MINI_GAME_IDS, new SeededRandom('rotation-seed'));
    const second = new MiniGameShuffleBag(MINI_GAME_IDS, new SeededRandom('rotation-seed'));

    expect(Array.from({ length: 25 }, () => first.next()))
      .toEqual(Array.from({ length: 25 }, () => second.next()));
  });

  it('discards a partial bag when reset for a new playthrough', () => {
    const rotation = new MiniGameShuffleBag(MINI_GAME_IDS, new SeededRandom('reset-seed'));
    Array.from({ length: 4 }, () => rotation.next());

    rotation.reset();
    const newPlaythroughBag = Array.from({ length: MINI_GAME_IDS.length }, () => rotation.next());

    expect([...newPlaythroughBag].sort()).toEqual([...MINI_GAME_IDS].sort());
  });

  it('supports a one-game bag and rejects invalid collections', () => {
    const single = new MiniGameShuffleBag(['paper-jam'], () => 0);
    expect([single.next(), single.next()]).toEqual(['paper-jam', 'paper-jam']);
    expect(() => new MiniGameShuffleBag([], () => 0)).toThrow(RangeError);
    expect(() => new MiniGameShuffleBag(['paper-jam', 'paper-jam'], () => 0)).toThrow(RangeError);
  });
});
