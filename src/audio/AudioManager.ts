import type { MiniGameId } from '../game/types';

const MUTE_KEY = 'one-quick-email:muted';

type OscillatorShape = OscillatorType | 'noise';

interface ToneOptions {
  at?: number;
  duration?: number;
  frequency: number;
  endFrequency?: number;
  gain?: number;
  type?: OscillatorShape;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private muted = this.loadMutePreference();
  private lastTypeSoundAt = 0;

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.createGraph();
    }
    if (this.context?.state === 'suspended' && !document.hidden) {
      await this.context.resume();
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? 'true' : 'false');
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
    this.applyMute();
    if (!this.muted && this.context?.state === 'suspended' && !document.hidden) {
      void this.context.resume();
    }
    return this.muted;
  }

  typing(): void {
    const now = performance.now();
    if (now - this.lastTypeSoundAt < 38) return;
    this.lastTypeSoundAt = now;
    const pitch = 1180 + Math.random() * 170;
    this.tone({ frequency: pitch, endFrequency: pitch * 0.78, duration: 0.025, gain: 0.018, type: 'square' });
  }

  send(): void {
    this.sequence([
      { frequency: 330, endFrequency: 520, duration: 0.09, gain: 0.055, type: 'sine' },
      { at: 0.08, frequency: 520, endFrequency: 880, duration: 0.16, gain: 0.07, type: 'sine' },
    ]);
  }

  newMessage(): void {
    this.sequence([
      { frequency: 880, duration: 0.08, gain: 0.07, type: 'triangle' },
      { at: 0.11, frequency: 1175, duration: 0.16, gain: 0.075, type: 'triangle' },
    ]);
  }

  miniGameEntrance(id: MiniGameId): void {
    const index = MINI_GAME_PITCHES[id];
    this.sequence([
      { frequency: index, endFrequency: index * 1.8, duration: 0.12, gain: 0.08, type: 'sawtooth' },
      { at: 0.1, frequency: index * 0.72, endFrequency: index * 2.2, duration: 0.2, gain: 0.07, type: 'square' },
      { at: 0.23, frequency: index * 2.4, duration: 0.09, gain: 0.055, type: 'triangle' },
    ]);
  }

  countdown(): void {
    this.tone({ frequency: 760, duration: 0.035, gain: 0.045, type: 'square' });
  }

  success(): void {
    this.sequence([
      { frequency: 520, duration: 0.07, gain: 0.06, type: 'square' },
      { at: 0.07, frequency: 780, duration: 0.09, gain: 0.06, type: 'square' },
      { at: 0.15, frequency: 1040, duration: 0.13, gain: 0.065, type: 'square' },
    ]);
  }

  timeout(): void {
    this.sequence([
      { frequency: 210, endFrequency: 145, duration: 0.18, gain: 0.07, type: 'sawtooth' },
      { at: 0.16, frequency: 120, endFrequency: 76, duration: 0.22, gain: 0.06, type: 'square' },
    ]);
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.ambienceSource?.stop();
    this.ambienceSource = null;
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private createGraph(): void {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.context.destination);
    this.startAmbience();
  }

  private startAmbience(): void {
    if (!this.context || !this.master || this.ambienceSource) return;
    const frameCount = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < data.length; index += 1) {
      brown = (brown + (Math.random() * 2 - 1) * 0.035) * 0.985;
      data[index] = brown;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 430;
    gain.gain.value = 0.018;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.ambienceSource = source;
  }

  private tone(options: ToneOptions): void {
    if (!this.context || !this.master || this.muted || this.context.state !== 'running') return;
    const start = this.context.currentTime + (options.at ?? 0);
    const duration = options.duration ?? 0.1;
    if (options.type === 'noise') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.05, start + Math.min(0.012, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private sequence(tones: readonly ToneOptions[]): void {
    tones.forEach((tone) => this.tone(tone));
  }

  private applyMute(): void {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.context.currentTime, 0.015);
  }

  private loadMutePreference(): boolean {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private readonly handleVisibility = (): void => {
    if (!this.context) return;
    if (document.hidden) {
      void this.context.suspend();
    } else if (!this.muted) {
      void this.context.resume();
    }
  };
}

const MINI_GAME_PITCHES: Readonly<Record<MiniGameId, number>> = {
  'calendar-collision': 180,
  'reply-all-intercept': 215,
  'paper-jam': 255,
  'hold-music-hero': 300,
  'stamp-of-approval': 345,
  'expense-triage': 390,
  'quick-question': 435,
  'phone-transfer': 480,
  'badge-scan': 525,
};
