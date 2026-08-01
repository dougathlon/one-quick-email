import { randomInterruptionInterval, type RandomSource } from './random';

export class InterruptionScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private paused = false;

  constructor(
    private readonly callback: () => void,
    private readonly random: RandomSource = Math.random,
  ) {}

  get active(): boolean {
    return this.started && !this.paused;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.paused = false;
    this.scheduleFreshInterval();
  }

  pause(): void {
    if (!this.started) {
      return;
    }

    this.paused = true;
    this.clearTimer();
  }

  resumeWithFreshInterval(): void {
    // Visibility/phase changes must not start the scheduler before the editor's
    // first printable character has caused the controller to call start().
    if (!this.started) {
      return;
    }

    this.paused = false;
    this.clearTimer();
    this.scheduleFreshInterval();
  }

  stop(): void {
    this.clearTimer();
    this.started = false;
    this.paused = false;
  }

  private scheduleFreshInterval(): void {
    if (!this.active || this.timer !== undefined) {
      return;
    }

    const delay = randomInterruptionInterval(this.random);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      try {
        this.callback();
      } finally {
        this.scheduleFreshInterval();
      }
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer === undefined) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
