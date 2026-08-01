import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InterruptionScheduler } from '../../src/game/InterruptionScheduler';

describe('InterruptionScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires repeatedly on fresh inclusive intervals', () => {
    const callback = vi.fn();
    const scheduler = new InterruptionScheduler(callback, () => 0);

    scheduler.start();
    expect(scheduler.active).toBe(true);
    vi.advanceTimersByTime(9_999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('uses the maximum 15-second boundary', () => {
    const callback = vi.fn();
    const scheduler = new InterruptionScheduler(callback, () => 1);
    scheduler.start();

    vi.advanceTimersByTime(14_999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('pauses and resumes with a new full interval', () => {
    const callback = vi.fn();
    const scheduler = new InterruptionScheduler(callback, () => 0);
    scheduler.start();
    vi.advanceTimersByTime(7_000);

    scheduler.pause();
    expect(scheduler.active).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();

    scheduler.resumeWithFreshInterval();
    expect(scheduler.active).toBe(true);
    vi.advanceTimersByTime(9_999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not start when asked to resume before the controller starts it', () => {
    const callback = vi.fn();
    const scheduler = new InterruptionScheduler(callback, () => 0);

    scheduler.resumeWithFreshInterval();
    expect(scheduler.active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('makes start idempotent and stop final', () => {
    const callback = vi.fn();
    const scheduler = new InterruptionScheduler(callback, () => 0);

    scheduler.start();
    scheduler.start();
    expect(vi.getTimerCount()).toBe(1);
    scheduler.stop();
    expect(scheduler.active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('respects pause or stop calls made by the callback', () => {
    let scheduler: InterruptionScheduler;
    const callback = vi.fn(() => scheduler.pause());
    scheduler = new InterruptionScheduler(callback, () => 0);
    scheduler.start();

    vi.advanceTimersByTime(10_000);
    expect(callback).toHaveBeenCalledOnce();
    expect(scheduler.active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
