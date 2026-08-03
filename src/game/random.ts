import type { EmailScenario, MiniGameId } from './types';

export type RandomSource = (() => number) | Pick<SeededRandom, 'next'>;

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new RangeError('seed must be finite');
    }

    return seed >>> 0;
  }

  // FNV-1a produces a stable 32-bit seed without relying on platform hashing.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = hashSeed(seed);
  }

  next(): number {
    // Mulberry32: compact, deterministic, and adequate for gameplay selection.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }
}

function readRandom(source: RandomSource): number {
  const value = typeof source === 'function' ? source() : source.next();
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('random source must return a number between 0 and 1');
  }
  return value;
}

function selectIndex(length: number, source: RandomSource): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('cannot select from an empty collection');
  }

  // Accept an injected value of exactly 1 so boundary tests can select the last
  // item, while ordinary random sources continue to use the [0, 1) convention.
  return Math.min(length - 1, Math.floor(readRandom(source) * length));
}

export function randomInterruptionInterval(source: RandomSource = Math.random): number {
  const minimum = 10_000;
  const possibleValues = 5_001;
  return minimum + selectIndex(possibleValues, source);
}

export function selectScenario<T extends Pick<EmailScenario, 'id'>>(
  scenarios: readonly T[],
  lastId: string | null | undefined,
  source: RandomSource = Math.random,
): T {
  if (scenarios.length === 0) {
    throw new RangeError('cannot select a scenario from an empty collection');
  }

  const eligible = scenarios.length > 1
    ? scenarios.filter((scenario) => scenario.id !== lastId)
    : scenarios;
  const pool = eligible.length > 0 ? eligible : scenarios;
  const selected = pool[selectIndex(pool.length, source)];

  // selectIndex and the non-empty checks above make this unreachable; the guard
  // keeps the function sound under noUncheckedIndexedAccess.
  if (selected === undefined) {
    throw new Error('scenario selection failed');
  }

  return selected;
}

export class MiniGameShuffleBag<T extends MiniGameId> {
  private readonly ids: readonly T[];
  private remaining: T[] = [];
  private previous: T | undefined;

  constructor(
    ids: readonly T[],
    private readonly source: RandomSource = Math.random,
  ) {
    if (ids.length === 0) {
      throw new RangeError('cannot create a mini-game bag from an empty collection');
    }
    if (new Set(ids).size !== ids.length) {
      throw new RangeError('mini-game bag ids must be unique');
    }
    this.ids = [...ids];
  }

  next(): T {
    if (this.remaining.length === 0) this.refill();

    const selected = this.remaining.shift();
    if (selected === undefined) {
      throw new Error('mini-game bag selection failed');
    }
    this.previous = selected;
    return selected;
  }

  reset(): void {
    this.remaining = [];
    this.previous = undefined;
  }

  private refill(): void {
    const bag = [...this.ids];

    // Fisher-Yates gives each new group an independent deterministic shuffle
    // when the caller supplies a seeded source.
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swapIndex = selectIndex(index + 1, this.source);
      const current = bag[index];
      const replacement = bag[swapIndex];
      if (current === undefined || replacement === undefined) {
        throw new Error('mini-game bag shuffle failed');
      }
      bag[index] = replacement;
      bag[swapIndex] = current;
    }

    // Preserve the complete shuffled bag while preventing the last game of one
    // group from immediately becoming the first game of the next group.
    if (bag.length > 1 && bag[0] === this.previous) {
      const replacementIndex = bag.findIndex((id) => id !== this.previous);
      const first = bag[0];
      const replacement = bag[replacementIndex];
      if (first === undefined || replacement === undefined) {
        throw new Error('mini-game bag boundary adjustment failed');
      }
      bag[0] = replacement;
      bag[replacementIndex] = first;
    }

    this.remaining = bag;
  }
}
