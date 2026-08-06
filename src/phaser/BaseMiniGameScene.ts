import Phaser from 'phaser';

import type { MiniGameOutcome } from '../game/types';
import type {
  MiniGameAudioCallbacks,
  MiniGameDefinition,
  MiniGameSceneData,
} from './types';
import {
  canvasPointToMiniGame,
  fitMiniGameViewport,
  NO_SAFE_AREA,
  type MiniGameSafeAreaInsets,
  type MiniGameViewportTransform,
} from './layout';

export const DESIGN_WIDTH = 1440;
export const DESIGN_HEIGHT = 900;
export const PORTRAIT_DESIGN_WIDTH = 600;
export const PORTRAIT_DESIGN_HEIGHT = 1200;
export const MINI_GAME_PLAY_STARTED_EVENT = 'mini-game-play-started';

const BRIEFING_MINIMUM_MS = 1_800;

export const PALETTE = {
  ink: 0x14213d,
  paper: 0xf7f1df,
  white: 0xfffcf5,
  cyan: 0x35c6d8,
  yellow: 0xffd447,
  orange: 0xff8c42,
  red: 0xef476f,
  green: 0x4bc98b,
  blue: 0x3867d6,
  muted: 0x7a8499,
  dark: 0x0b132b,
} as const;

type ScenePhase = 'briefing' | 'playing' | 'ending' | 'complete' | 'cancelled';

type EventEmitterLike = Phaser.Events.EventEmitter | Phaser.GameObjects.GameObject;

interface DirectPointerDragHandlers {
  readonly start?: (pointer: Phaser.Input.Pointer) => void;
  readonly move: (pointer: Phaser.Input.Pointer) => void;
  readonly end?: (pointer: Phaser.Input.Pointer) => void;
}

export abstract class BaseMiniGameScene extends Phaser.Scene {
  readonly definition: MiniGameDefinition;

  protected world!: Phaser.GameObjects.Container;
  protected gameLayer!: Phaser.GameObjects.Container;

  private bridge!: MiniGameSceneData;
  private phase: ScenePhase = 'briefing';
  private deadline = 0;
  private timerText!: Phaser.GameObjects.Text;
  private timerFill!: Phaser.GameObjects.Rectangle;
  private timerFillWidth = 232;
  private lastCountdownSecond = Number.POSITIVE_INFINITY;
  private cleanupCallbacks: Array<() => void> = [];
  private completionDelivered = false;
  private briefingCard: Phaser.GameObjects.Container | null = null;
  private briefingReadyText: Phaser.GameObjects.Text | null = null;
  private briefingMinimumElapsed = false;
  private readonly briefingHeldKeys = new Set<string>();
  private readonly primedBriefingHeldKeys = new Set<string>();
  private readonly primedBriefingHeldPointers = new Set<number>();
  private stopBriefingKeyTracking: (() => void) | null = null;
  private stopBriefingPointerTracking: (() => void) | null = null;
  private readonly briefingHeldPointers = new Set<number>();
  private keyboardInputQuarantined = false;
  private keyboardReleaseFrame: number | null = null;
  private pointerInputQuarantined = false;
  private pointerReleaseFrame: number | null = null;
  private portraitLayout = false;
  private logicalWidth = DESIGN_WIDTH;
  private logicalHeight = DESIGN_HEIGHT;
  private safeAreaInsets: MiniGameSafeAreaInsets = NO_SAFE_AREA;
  private viewportTransform: MiniGameViewportTransform = { scale: 1, x: 0, y: 0 };

  protected constructor(definition: MiniGameDefinition) {
    super({ key: definition.sceneKey });
    this.definition = definition;
  }

  init(data: MiniGameSceneData): void {
    this.stopBriefingKeyTracking?.();
    this.stopBriefingPointerTracking?.();
    this.bridge = data;
    this.phase = 'briefing';
    this.lastCountdownSecond = Number.POSITIVE_INFINITY;
    this.cleanupCallbacks = [];
    this.completionDelivered = false;
    this.briefingCard = null;
    this.briefingReadyText = null;
    this.briefingMinimumElapsed = false;
    this.briefingHeldKeys.clear();
    for (const key of this.primedBriefingHeldKeys) this.briefingHeldKeys.add(key);
    this.primedBriefingHeldKeys.clear();
    this.stopBriefingKeyTracking = null;
    this.stopBriefingPointerTracking = null;
    this.briefingHeldPointers.clear();
    for (const pointerId of this.primedBriefingHeldPointers) {
      this.briefingHeldPointers.add(pointerId);
    }
    this.primedBriefingHeldPointers.clear();
    this.keyboardInputQuarantined = false;
    this.cancelKeyboardReleaseFrame();
    this.pointerInputQuarantined = false;
    this.cancelPointerReleaseFrame();
    this.portraitLayout = data.portraitLayout;
    this.safeAreaInsets = data.safeAreaInsets;
  }

  create(): void {
    this.logicalWidth = this.portraitLayout ? PORTRAIT_DESIGN_WIDTH : DESIGN_WIDTH;
    this.logicalHeight = this.portraitLayout ? PORTRAIT_DESIGN_HEIGHT : DESIGN_HEIGHT;
    this.input.enabled = false;
    this.startBriefingKeyTracking();
    this.startBriefingPointerTracking();
    this.cameras.main.setBackgroundColor(PALETTE.dark);

    this.world = this.add.container(0, 0);
    this.drawBackdrop();
    this.drawChrome();

    this.gameLayer = this.add.container(0, 0);
    this.world.add(this.gameLayer);
    this.buildGame();

    this.drawBriefingCard();
    this.layoutWorld(this.scale.gameSize);

    const resizeHandler = (gameSize: Phaser.Structs.Size): void => {
      this.layoutWorld(gameSize);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, resizeHandler);
    this.cleanupCallbacks.push(() => {
      this.scale.off(Phaser.Scale.Events.RESIZE, resizeHandler);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.safeAudio((audio) => audio.entrance(this.definition.id));

    this.time.delayedCall(BRIEFING_MINIMUM_MS, () => {
      if (this.phase !== 'briefing') return;
      this.briefingMinimumElapsed = true;
      this.updateBriefingReadyCue();
      this.tryBeginPlay();
    });
  }

  update(_time: number, delta: number): void {
    if (this.phase !== 'playing') return;

    const remaining = Math.max(0, this.deadline - this.time.now);
    this.timerText.setText(`${(remaining / 1000).toFixed(1)}s`);
    this.timerFill.displayWidth = this.timerFillWidth * (remaining / this.definition.durationMs);

    const countdownSecond = Math.ceil(remaining / 1000);
    if (countdownSecond > 0 && countdownSecond <= 3 && countdownSecond !== this.lastCountdownSecond) {
      this.lastCountdownSecond = countdownSecond;
      this.safeAudio((audio) => audio.countdown());
      this.tweens.add({
        targets: this.timerText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 80,
        yoyo: true,
      });
    }

    this.updateGame(delta, remaining);
    if (remaining <= 0) this.finish('timeout');
  }

  forceComplete(outcome: MiniGameOutcome = 'success'): void {
    this.finish(outcome);
  }

  primeBriefingHeldKeys(keys: Iterable<string>): void {
    this.primedBriefingHeldKeys.clear();
    for (const key of keys) this.primedBriefingHeldKeys.add(key);
  }

  primeBriefingHeldPointers(pointerIds: Iterable<number>): void {
    this.primedBriefingHeldPointers.clear();
    for (const pointerId of pointerIds) this.primedBriefingHeldPointers.add(pointerId);
  }

  get canRestartForViewportChange(): boolean {
    return this.phase === 'briefing' || this.phase === 'playing';
  }

  updateViewportSafeArea(safeAreaInsets: MiniGameSafeAreaInsets): void {
    this.safeAreaInsets = safeAreaInsets;
    if (this.world) this.layoutWorld(this.scale.gameSize);
  }

  cancel(): void {
    if (this.phase === 'complete' || this.phase === 'cancelled') return;
    this.phase = 'cancelled';
    this.completionDelivered = true;
    this.input.enabled = false;
    this.stopBriefingKeyTracking?.();
    this.stopBriefingKeyTracking = null;
    this.stopBriefingPointerTracking?.();
    this.stopBriefingPointerTracking = null;
    this.briefingHeldPointers.clear();
    this.keyboardInputQuarantined = false;
    this.cancelKeyboardReleaseFrame();
    this.pointerInputQuarantined = false;
    this.cancelPointerReleaseFrame();
  }

  protected abstract buildGame(): void;

  protected onPlayStarted(): void {}

  protected updateGame(_delta: number, _remainingMs: number): void {}

  protected succeed(): void {
    this.finish('success');
  }

  protected get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  protected get theme(): MiniGameDefinition['theme'] {
    return this.definition.theme;
  }

  protected get isPortrait(): boolean {
    return this.portraitLayout;
  }

  protected get viewWidth(): number {
    return this.logicalWidth;
  }

  protected get viewHeight(): number {
    return this.logicalHeight;
  }

  /** Expose deterministic scene state to development browser tests only. */
  protected setDevCanvasData(key: string, value: string): void {
    if (!import.meta.env.DEV) return;
    this.game.canvas.dataset[key] = value;
    this.cleanupCallbacks.push(() => {
      delete this.game.canvas.dataset[key];
    });
  }

  protected pointerToGame(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const point = canvasPointToMiniGame(pointer, this.viewportTransform);
    return new Phaser.Math.Vector2(point.x, point.y);
  }

  protected addText(
    x: number,
    y: number,
    text: string,
    size: number,
    color = '#14213d',
    options: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
  ): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      color,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      ...options,
    });
    this.gameLayer.add(label);
    return label;
  }

  protected addPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number = PALETTE.white,
    strokeColor: number = PALETTE.ink,
    strokeWidth: number = 4,
  ): Phaser.GameObjects.Rectangle {
    const panel = this.add.rectangle(x, y, width, height, fillColor);
    panel.setStrokeStyle(strokeWidth, strokeColor);
    this.gameLayer.add(panel);
    return panel;
  }

  protected makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor: number,
    onActivate: () => void,
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const surface = this.add.rectangle(0, 0, width, height, fillColor).setStrokeStyle(4, PALETTE.ink);
    const text = this.add.text(0, 0, label, {
      color: '#14213d',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    surface.setInteractive({ useHandCursor: true });
    this.listen(surface, Phaser.Input.Events.POINTER_OVER, () => {
      surface.setScale(1.03);
    });
    this.listen(surface, Phaser.Input.Events.POINTER_OUT, () => {
      surface.setScale(1);
    });
    this.listen(surface, Phaser.Input.Events.POINTER_UP, () => {
      if (this.isPlaying) onActivate();
    });
    button.add([surface, text]);
    this.gameLayer.add(button);
    return button;
  }

  protected onKey(eventName: string, handler: (event: KeyboardEvent) => void): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const guardedHandler = (event: KeyboardEvent): void => {
      if (!this.isPlaying) {
        event.preventDefault();
        return;
      }
      handler(event);
    };
    keyboard.on(eventName, guardedHandler);
    this.cleanupCallbacks.push(() => keyboard.off(eventName, guardedHandler));
  }

  protected listen(
    emitter: EventEmitterLike,
    eventName: string,
    handler: (...args: never[]) => void,
  ): void {
    const guardedHandler = (...args: never[]): void => {
      if (this.isPlaying) handler(...args);
    };
    emitter.on(eventName, guardedHandler);
    this.cleanupCallbacks.push(() => emitter.off(eventName, guardedHandler));
  }

  /** Track one mouse or touch pointer from press through release. */
  protected enableDirectPointerDrag(
    target: Phaser.GameObjects.GameObject,
    handlers: DirectPointerDragHandlers,
  ): void {
    let activePointerId: number | null = null;

    const handleDown = (pointer: Phaser.Input.Pointer): void => {
      if (!this.isPlaying || activePointerId !== null) return;
      activePointerId = pointer.id;
      handlers.start?.(pointer);
      handlers.move(pointer);
      this.reportPointerDrag(pointer);
    };
    const handleMove = (pointer: Phaser.Input.Pointer): void => {
      if (!this.isPlaying || pointer.id !== activePointerId || !pointer.isDown) return;
      handlers.move(pointer);
      this.reportPointerDrag(pointer);
    };
    const handleUp = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;
      activePointerId = null;
      if (this.isPlaying) handlers.end?.(pointer);
    };

    target.on(Phaser.Input.Events.POINTER_DOWN, handleDown);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, handleMove);
    this.input.on(Phaser.Input.Events.POINTER_UP, handleUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, handleUp);
    this.cleanupCallbacks.push(() => {
      target.off(Phaser.Input.Events.POINTER_DOWN, handleDown);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, handleMove);
      this.input.off(Phaser.Input.Events.POINTER_UP, handleUp);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, handleUp);
      activePointerId = null;
    });
  }

  private reportPointerDrag(pointer: Phaser.Input.Pointer): void {
    if (!import.meta.env.DEV) return;
    const point = this.pointerToGame(pointer);
    this.game.canvas.dataset.miniGamePointerDrag = [
      this.definition.id,
      pointer.id,
      Math.round(point.x),
      Math.round(point.y),
    ].join(':');
  }

  protected pulse(target: Phaser.GameObjects.GameObject): void {
    this.tweens.add({
      targets: target,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      yoyo: true,
    });
  }

  protected flashMessage(message: string, color: number): void {
    const chip = this.add.container(this.viewWidth / 2, this.isPortrait ? 1080 : 700);
    const surface = this.add.rectangle(0, 0, this.isPortrait ? 520 : 500, this.isPortrait ? 78 : 62, color)
      .setStrokeStyle(4, PALETTE.ink);
    const label = this.add.text(0, 0, message, {
      color: '#14213d',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: this.isPortrait ? '28px' : '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    chip.add([surface, label]);
    this.world.add(chip);
    this.tweens.add({
      targets: chip,
      alpha: 0,
      y: this.isPortrait ? 1045 : 680,
      delay: 220,
      duration: 180,
      onComplete: () => chip.destroy(true),
    });
  }

  private beginPlay(): void {
    if (this.phase !== 'briefing') return;
    if (import.meta.env.DEV) delete this.game.canvas.dataset.miniGamePointerDrag;
    this.keyboardInputQuarantined = this.briefingHeldKeys.size > 0;
    this.pointerInputQuarantined = this.briefingHeldPointers.size > 0;
    this.phase = 'playing';
    if (!this.keyboardInputQuarantined) {
      this.stopBriefingKeyTracking?.();
      this.stopBriefingKeyTracking = null;
    }
    if (!this.pointerInputQuarantined) {
      this.stopBriefingPointerTracking?.();
      this.stopBriefingPointerTracking = null;
    }
    this.briefingCard?.destroy(true);
    this.briefingCard = null;
    this.briefingReadyText = null;
    this.input.resetPointers();
    this.input.enabled = !this.pointerInputQuarantined;
    if (this.input.keyboard) {
      this.input.keyboard.resetKeys();
      this.input.keyboard.enabled = !this.keyboardInputQuarantined;
    }
    this.reportKeyboardQuarantine();
    this.reportPointerQuarantine();
    this.deadline = this.time.now + this.definition.durationMs;
    this.timerText.setText(`${(this.definition.durationMs / 1000).toFixed(1)}s`);
    this.lastCountdownSecond = Math.ceil(this.definition.durationMs / 1000);
    this.events.emit(MINI_GAME_PLAY_STARTED_EVENT);
    this.onPlayStarted();
  }

  private tryBeginPlay(): void {
    if (
      this.phase === 'briefing'
      && this.briefingMinimumElapsed
      && !document.hidden
    ) {
      this.beginPlay();
    }
  }

  private finish(outcome: MiniGameOutcome): void {
    if (this.phase === 'ending' || this.phase === 'complete' || this.phase === 'cancelled') return;

    this.phase = 'ending';
    this.input.enabled = false;
    this.stopBriefingKeyTracking?.();
    this.stopBriefingKeyTracking = null;
    this.stopBriefingPointerTracking?.();
    this.stopBriefingPointerTracking = null;
    this.keyboardInputQuarantined = false;
    this.cancelKeyboardReleaseFrame();
    if (this.input.keyboard) {
      this.input.keyboard.resetKeys();
      this.input.keyboard.enabled = true;
    }
    this.pointerInputQuarantined = false;
    this.cancelPointerReleaseFrame();
    this.tweens.killAll();
    this.safeAudio((audio) => (outcome === 'success' ? audio.success() : audio.timeout()));

    const color = outcome === 'success' ? PALETTE.green : PALETTE.red;
    const message = outcome === 'success' ? 'HANDLED' : 'TIME\'S UP';
    const flash = this.add.container(0, 0);
    const cover = this.add.rectangle(0, 0, this.viewWidth, this.viewHeight, color, 0.96).setOrigin(0);
    const label = this.add.text(this.viewWidth / 2, this.viewHeight / 2, message, {
      color: '#14213d',
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: this.isPortrait ? '74px' : '104px',
      fontStyle: 'bold',
      stroke: '#fffaf0',
      strokeThickness: 8,
      align: 'center',
      wordWrap: { width: this.viewWidth - 60 },
    }).setOrigin(0.5);
    flash.add([cover, label]);
    this.world.add(flash);

    this.time.delayedCall(380, () => {
      if (this.completionDelivered || this.phase === 'cancelled') return;
      this.completionDelivered = true;
      this.phase = 'complete';
      this.bridge.onComplete(outcome);
    });
  }

  private drawBackdrop(): void {
    const theme = this.definition.theme;
    const width = this.viewWidth;
    const height = this.viewHeight;
    const playTop = this.isPortrait ? 220 : 160;
    const background = this.add.rectangle(0, 0, width, height, theme.background).setOrigin(0);
    this.world.add(background);

    const graphics = this.add.graphics();
    switch (theme.backdrop) {
      case 'planner':
        graphics.lineStyle(2, theme.ink, 0.15);
        for (let x = this.isPortrait ? 42 : 80; x <= width; x += this.isPortrait ? 86 : 170) {
          graphics.lineBetween(x, playTop, x, height);
        }
        for (let y = playTop; y <= height; y += this.isPortrait ? 74 : 58) {
          graphics.lineBetween(0, y, width, y);
        }
        graphics.fillStyle(theme.accent, 0.2).fillRect(0, playTop, width, this.isPortrait ? 74 : 58);
        break;
      case 'terminal':
        graphics.lineStyle(1, theme.accent, 0.12);
        for (let y = 0; y <= height; y += 8) graphics.lineBetween(0, y, width, y);
        graphics.lineStyle(2, theme.accent, 0.35).strokeRect(20, 20, width - 40, height - 40);
        break;
      case 'xerox':
        graphics.fillStyle(theme.ink, 0.08);
        for (let index = 0; index < 220; index += 1) {
          graphics.fillRect((index * 97) % width, (index * 53) % height, 3 + (index % 4), 2);
        }
        graphics.lineStyle(12, theme.secondary, 0.8);
        for (let x = -160; x < width + 160; x += 72) {
          graphics.lineBetween(x, height, x + 180, height - (this.isPortrait ? 180 : 140));
        }
        break;
      case 'neon':
        graphics.lineStyle(3, theme.accent, 0.28);
        for (let y = this.isPortrait ? 300 : 240; y < height; y += 70) graphics.lineBetween(0, y, width, y);
        for (let x = 0; x < width; x += this.isPortrait ? 64 : 96) {
          graphics.lineBetween(width / 2, playTop, x, height);
        }
        graphics.fillStyle(theme.secondary, 0.12).fillCircle(width / 2, height * 0.62, Math.min(width, height) * 0.3);
        break;
      case 'dossier':
        graphics.lineStyle(3, theme.ink, 0.12);
        for (let y = this.isPortrait ? 250 : 190; y < height; y += 34) graphics.lineBetween(40, y, width - 40, y);
        graphics.lineStyle(8, theme.accent, 0.45)
          .strokeCircle(width - (this.isPortrait ? 100 : 220), height - 200, this.isPortrait ? 82 : 130)
          .strokeCircle(width - (this.isPortrait ? 100 : 220), height - 200, this.isPortrait ? 58 : 96);
        break;
      case 'ledger':
        graphics.lineStyle(2, theme.ink, 0.18);
        for (let x = this.isPortrait ? 60 : 100; x < width; x += this.isPortrait ? 120 : 205) {
          graphics.lineBetween(x, playTop, x, height);
        }
        for (let y = playTop; y < height; y += this.isPortrait ? 62 : 48) graphics.lineBetween(0, y, width, y);
        graphics.fillStyle(theme.accent, 0.16).fillRect(0, playTop, width, this.isPortrait ? 62 : 48);
        break;
      case 'geometric':
        graphics.fillStyle(theme.accent, 0.24).fillCircle(this.isPortrait ? 60 : 130, height - 180, this.isPortrait ? 150 : 250);
        graphics.fillStyle(theme.secondary, 0.26).fillTriangle(width - 260, height, width, height - 380, width, height);
        graphics.lineStyle(18, theme.ink, 0.1).strokeCircle(width - 150, this.isPortrait ? 330 : 280, this.isPortrait ? 110 : 180);
        break;
      case 'switchboard':
        graphics.lineStyle(3, theme.accent, 0.25);
        for (let y = playTop; y < height - 50; y += 115) {
          graphics.lineBetween(0, y, width, y);
          for (let x = 40; x < width; x += this.isPortrait ? 110 : 170) graphics.strokeCircle(x + (y % 90), y, 8);
        }
        break;
      case 'security':
        graphics.lineStyle(2, theme.accent, 0.25);
        for (let x = -300; x <= width + 300; x += 130) graphics.lineBetween(width / 2, this.isPortrait ? 320 : 280, x, height);
        for (let y = this.isPortrait ? 520 : 470; y < height; y += 60) graphics.lineBetween(0, y, width, y);
        graphics.fillStyle(theme.secondary, 0.12).fillRect(0, 0, width, playTop);
        break;
      case 'desktop':
        graphics.fillStyle(theme.accent, 0.11);
        for (let y = playTop; y < height; y += 32) {
          for (let x = (y / 32) % 2 === 0 ? 0 : 32; x < width; x += 64) graphics.fillRect(x, y, 32, 32);
        }
        graphics.lineStyle(5, theme.ink, 0.3).strokeRect(24, playTop, width - 48, height - playTop - 24);
        break;
    }
    this.world.add(graphics);
  }

  private drawChrome(): void {
    const theme = this.definition.theme;
    if (this.isPortrait) {
      const titlePlate = this.add.rectangle(24, 24, 552, 174, theme.surface, 0.97)
        .setOrigin(0)
        .setStrokeStyle(theme.backdrop === 'terminal' || theme.backdrop === 'desktop' ? 5 : 0, theme.accent);
      const title = this.add.text(44, 42, this.definition.title.toUpperCase(), {
        color: this.toCssColor(theme.ink),
        fontFamily: theme.fontFamily,
        fontSize: this.definition.title.length > 16 ? '29px' : '35px',
        fontStyle: 'bold',
        stroke: theme.backdrop === 'neon' ? this.toCssColor(theme.secondary) : undefined,
        strokeThickness: theme.backdrop === 'neon' ? 4 : 0,
      });
      const instruction = this.add.text(44, 96, this.definition.instruction, {
        color: this.toCssColor(theme.ink),
        fontFamily: theme.fontFamily,
        fontSize: '22px',
        fontStyle: 'bold',
        lineSpacing: 2,
        wordWrap: { width: 410 },
      });
      const timerPanel = this.add.rectangle(510, 96, 112, 112, theme.surface).setStrokeStyle(5, theme.ink);
      this.timerText = this.add.text(510, 53, `${(this.definition.durationMs / 1000).toFixed(1)}s`, {
        color: this.toCssColor(theme.ink),
        fontFamily: theme.fontFamily,
        fontSize: '27px',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.timerFillWidth = 82;
      const timerTrack = this.add.rectangle(469, 132, this.timerFillWidth, 12, theme.ink, 0.22).setOrigin(0, 0.5);
      this.timerFill = this.add.rectangle(469, 132, this.timerFillWidth, 12, theme.accent).setOrigin(0, 0.5);
      this.world.add([titlePlate, title, instruction, timerPanel, timerTrack, this.timerFill, this.timerText]);
      return;
    }

    this.timerFillWidth = 232;
    const titlePlate = this.add.rectangle(48, 36, 930, 118, theme.surface, 0.96)
      .setOrigin(0)
      .setStrokeStyle(theme.backdrop === 'terminal' || theme.backdrop === 'desktop' ? 5 : 0, theme.accent);
    const title = this.add.text(74, 54, this.definition.title.toUpperCase(), {
      color: this.toCssColor(theme.ink),
      fontFamily: theme.fontFamily,
      fontSize: '42px',
      fontStyle: 'bold',
      stroke: theme.backdrop === 'neon' ? this.toCssColor(theme.secondary) : undefined,
      strokeThickness: theme.backdrop === 'neon' ? 5 : 0,
    });
    const instruction = this.add.text(76, 112, this.definition.instruction, {
      color: this.toCssColor(theme.ink),
      fontFamily: theme.fontFamily,
      fontSize: '19px',
      fontStyle: 'bold',
      wordWrap: { width: 870 },
    });

    const timerPanel = this.add.rectangle(1198, 89, 340, 100, theme.surface).setStrokeStyle(5, theme.ink);
    this.timerText = this.add.text(1324, 68, `${(this.definition.durationMs / 1000).toFixed(1)}s`, {
      color: this.toCssColor(theme.ink),
      fontFamily: theme.fontFamily,
      fontSize: '30px',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const timerTrack = this.add.rectangle(1078, 117, this.timerFillWidth, 12, theme.ink, 0.22).setOrigin(0, 0.5);
    this.timerFill = this.add.rectangle(1078, 117, this.timerFillWidth, 12, theme.accent).setOrigin(0, 0.5);
    this.world.add([titlePlate, title, instruction, timerPanel, timerTrack, this.timerFill, this.timerText]);
  }

  private drawBriefingCard(): void {
    const theme = this.definition.theme;
    const centerX = this.viewWidth / 2;
    const width = this.viewWidth;
    const height = this.viewHeight;
    const portrait = this.isPortrait;
    const briefing = this.add.container(0, 0);
    const cover = this.add.rectangle(0, 0, width, height, theme.ink).setOrigin(0);
    const stripe = this.add.rectangle(0, 0, theme.backdrop === 'terminal' ? 18 : portrait ? 28 : 46, height, theme.accent).setOrigin(0);
    const eyebrow = this.add.text(centerX, portrait ? 230 : 250, theme.cabinetLabel, {
      color: this.toCssColor(theme.accent),
      fontFamily: theme.fontFamily,
      fontSize: portrait ? '22px' : '24px',
      fontStyle: 'bold',
      letterSpacing: portrait ? 4 : 8,
      align: 'center',
      wordWrap: { width: portrait ? 510 : 1240 },
    }).setOrigin(0.5);
    const title = this.add.text(centerX, portrait ? 390 : 365, this.definition.title.toUpperCase(), {
      color: this.toCssColor(theme.surface),
      fontFamily: theme.fontFamily,
      fontSize: portrait ? '56px' : '76px',
      fontStyle: 'bold',
      align: 'center',
      stroke: theme.backdrop === 'neon' || theme.backdrop === 'desktop' ? this.toCssColor(theme.secondary) : undefined,
      strokeThickness: theme.backdrop === 'neon' || theme.backdrop === 'desktop' ? 6 : 0,
      wordWrap: { width: portrait ? 520 : 1240 },
    }).setOrigin(0.5);
    const instruction = this.add.text(centerX, portrait ? 555 : 495, this.definition.instruction, {
      color: this.toCssColor(theme.surface),
      fontFamily: theme.fontFamily,
      fontSize: portrait ? '30px' : '27px',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: portrait ? 500 : 1_120 },
    }).setOrigin(0.5);
    const lockPanel = this.add.rectangle(centerX, portrait ? 745 : 625, portrait ? 500 : 620, portrait ? 98 : 76, theme.accent)
      .setStrokeStyle(5, theme.surface);
    const lockText = this.add.text(centerX, portrait ? 745 : 625, 'INPUT PAUSED — GET READY', {
      color: this.toCssColor(theme.background),
      fontFamily: theme.fontFamily,
      fontSize: portrait ? '27px' : '29px',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.briefingReadyText = this.add.text(
      centerX,
      portrait ? 845 : 695,
      'GET READY · PLAY STARTS AUTOMATICALLY',
      {
        color: this.toCssColor(theme.surface),
        fontFamily: theme.fontFamily,
        fontSize: portrait ? '22px' : '21px',
        fontStyle: 'bold',
        letterSpacing: portrait ? 1 : 3,
        align: 'center',
        wordWrap: { width: portrait ? 510 : 900 },
      },
    ).setOrigin(0.5);
    const progressWidth = portrait ? 480 : 620;
    const progressY = portrait ? 930 : 750;
    const progressTrack = this.add.rectangle(centerX, progressY, progressWidth, 12, theme.surface, 0.24);
    const progressFill = this.add.rectangle(centerX - progressWidth / 2, progressY, progressWidth, 12, theme.accent)
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    briefing.add([
      cover,
      stripe,
      eyebrow,
      title,
      instruction,
      lockPanel,
      lockText,
      this.briefingReadyText,
      progressTrack,
      progressFill,
    ]);
    this.world.add(briefing);
    this.briefingCard = briefing;
    this.updateBriefingReadyCue();

    this.tweens.add({
      targets: progressFill,
      scaleX: 1,
      duration: BRIEFING_MINIMUM_MS,
      ease: 'Linear',
    });
  }

  private startBriefingKeyTracking(): void {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const trackingQuarantine = this.phase === 'playing' && this.keyboardInputQuarantined;
      if (this.phase !== 'briefing' && !trackingQuarantine) return;
      event.preventDefault();
      this.briefingHeldKeys.add(event.code || event.key);
      this.updateBriefingReadyCue();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const trackingQuarantine = this.phase === 'playing' && this.keyboardInputQuarantined;
      if (this.phase !== 'briefing' && !trackingQuarantine) return;
      event.preventDefault();
      this.briefingHeldKeys.delete(event.code || event.key);
      this.updateBriefingReadyCue();
      this.continueAfterKeyboardRelease();
    };
    const releaseAllKeys = (): void => {
      const trackingQuarantine = this.phase === 'playing' && this.keyboardInputQuarantined;
      if (this.phase !== 'briefing' && !trackingQuarantine) return;
      this.briefingHeldKeys.clear();
      this.updateBriefingReadyCue();
      this.continueAfterKeyboardRelease();
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) releaseAllKeys();
      else this.continueAfterKeyboardRelease();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', releaseAllKeys);
    window.addEventListener('pagehide', releaseAllKeys);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const stop = (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', releaseAllKeys);
      window.removeEventListener('pagehide', releaseAllKeys);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    this.stopBriefingKeyTracking = stop;
    this.cleanupCallbacks.push(stop);
  }

  private continueAfterKeyboardRelease(): void {
    if (this.phase === 'briefing') {
      this.tryBeginPlay();
      return;
    }
    if (
      this.phase !== 'playing'
      || !this.keyboardInputQuarantined
      || this.briefingHeldKeys.size > 0
      || this.keyboardReleaseFrame !== null
    ) return;

    this.keyboardReleaseFrame = window.requestAnimationFrame(() => {
      this.keyboardReleaseFrame = null;
      if (
        this.phase !== 'playing'
        || !this.keyboardInputQuarantined
        || this.briefingHeldKeys.size > 0
      ) return;
      this.keyboardInputQuarantined = false;
      if (this.input.keyboard) {
        this.input.keyboard.resetKeys();
        this.input.keyboard.enabled = true;
      }
      this.reportKeyboardQuarantine();
      this.stopBriefingKeyTracking?.();
      this.stopBriefingKeyTracking = null;
    });
  }

  private cancelKeyboardReleaseFrame(): void {
    if (this.keyboardReleaseFrame === null) return;
    window.cancelAnimationFrame(this.keyboardReleaseFrame);
    this.keyboardReleaseFrame = null;
  }

  private reportKeyboardQuarantine(): void {
    if (!import.meta.env.DEV) return;
    this.game.canvas.dataset.miniGameKeyboardInputQuarantined = String(this.keyboardInputQuarantined);
  }

  private startBriefingPointerTracking(): void {
    const isGamePointer = (event: PointerEvent): boolean => event.composedPath().includes(this.game.canvas);
    const handlePointerDown = (event: PointerEvent): void => {
      const trackingQuarantine = this.phase === 'playing' && this.pointerInputQuarantined;
      if ((this.phase !== 'briefing' && !trackingQuarantine) || !isGamePointer(event)) return;
      event.preventDefault();
      this.briefingHeldPointers.add(event.pointerId);
      this.updateBriefingReadyCue();
    };
    const releasePointer = (event: PointerEvent): void => {
      const trackingQuarantine = this.phase === 'playing' && this.pointerInputQuarantined;
      if ((this.phase !== 'briefing' && !trackingQuarantine) || !this.briefingHeldPointers.delete(event.pointerId)) return;
      event.preventDefault();
      this.updateBriefingReadyCue();
      this.continueAfterPointerRelease();
    };
    const releaseAllPointers = (): void => {
      const trackingQuarantine = this.phase === 'playing' && this.pointerInputQuarantined;
      if (this.phase !== 'briefing' && !trackingQuarantine) return;
      this.briefingHeldPointers.clear();
      this.updateBriefingReadyCue();
      this.continueAfterPointerRelease();
    };
    const handleTouchEnd = (event: TouchEvent): void => {
      if (event.touches.length === 0) releaseAllPointers();
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) releaseAllPointers();
      else this.continueAfterPointerRelease();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', releasePointer, true);
    window.addEventListener('pointercancel', releasePointer, true);
    window.addEventListener('lostpointercapture', releasePointer, true);
    window.addEventListener('touchend', handleTouchEnd, true);
    window.addEventListener('touchcancel', handleTouchEnd, true);
    window.addEventListener('blur', releaseAllPointers);
    window.addEventListener('pagehide', releaseAllPointers);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const stop = (): void => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', releasePointer, true);
      window.removeEventListener('pointercancel', releasePointer, true);
      window.removeEventListener('lostpointercapture', releasePointer, true);
      window.removeEventListener('touchend', handleTouchEnd, true);
      window.removeEventListener('touchcancel', handleTouchEnd, true);
      window.removeEventListener('blur', releaseAllPointers);
      window.removeEventListener('pagehide', releaseAllPointers);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    this.stopBriefingPointerTracking = stop;
    this.cleanupCallbacks.push(stop);
  }

  private continueAfterPointerRelease(): void {
    if (this.phase === 'briefing') {
      this.tryBeginPlay();
      return;
    }
    if (
      this.phase !== 'playing'
      || !this.pointerInputQuarantined
      || this.briefingHeldPointers.size > 0
      || this.pointerReleaseFrame !== null
    ) return;

    this.pointerReleaseFrame = window.requestAnimationFrame(() => {
      this.pointerReleaseFrame = null;
      if (
        this.phase !== 'playing'
        || !this.pointerInputQuarantined
        || this.briefingHeldPointers.size > 0
      ) return;
      this.pointerInputQuarantined = false;
      this.input.resetPointers();
      this.input.enabled = true;
      this.reportPointerQuarantine();
      this.stopBriefingPointerTracking?.();
      this.stopBriefingPointerTracking = null;
    });
  }

  private cancelPointerReleaseFrame(): void {
    if (this.pointerReleaseFrame === null) return;
    window.cancelAnimationFrame(this.pointerReleaseFrame);
    this.pointerReleaseFrame = null;
  }

  private reportPointerQuarantine(): void {
    if (!import.meta.env.DEV) return;
    this.game.canvas.dataset.miniGameInputQuarantined = String(this.pointerInputQuarantined);
  }

  private updateBriefingReadyCue(): void {
    if (!this.briefingReadyText) return;
    const heldPointerCount = this.briefingHeldPointers.size;
    if (heldPointerCount > 0) {
      this.briefingReadyText.setText(`HELD INPUT IGNORED · ${heldPointerCount} TOUCH ${heldPointerCount === 1 ? 'POINT' : 'POINTS'}`);
      return;
    }
    const heldKeyCount = this.briefingHeldKeys.size;
    if (heldKeyCount > 0) {
      const noun = heldKeyCount === 1 ? 'KEY' : 'KEYS';
      this.briefingReadyText.setText(`HELD INPUT IGNORED · ${heldKeyCount} ${noun}`);
      return;
    }
    this.briefingReadyText.setText('GET READY · PLAY STARTS AUTOMATICALLY');
  }

  private layoutWorld(gameSize: Phaser.Structs.Size): void {
    this.viewportTransform = fitMiniGameViewport(
      gameSize,
      { width: this.viewWidth, height: this.viewHeight },
      this.safeAreaInsets,
    );
    this.world.setScale(this.viewportTransform.scale);
    this.world.setPosition(this.viewportTransform.x, this.viewportTransform.y);
  }

  private safeAudio(callback: (audio: MiniGameAudioCallbacks) => void): void {
    try {
      callback(this.bridge.audio);
    } catch {
      // Audio must never be able to strand an otherwise playable interruption.
    }
  }

  private toCssColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private handleShutdown(): void {
    this.stopBriefingKeyTracking?.();
    this.stopBriefingKeyTracking = null;
    this.stopBriefingPointerTracking?.();
    this.stopBriefingPointerTracking = null;
    this.briefingHeldKeys.clear();
    this.briefingHeldPointers.clear();
    this.keyboardInputQuarantined = false;
    this.cancelKeyboardReleaseFrame();
    if (this.input.keyboard) {
      this.input.keyboard.resetKeys();
      this.input.keyboard.enabled = true;
    }
    this.pointerInputQuarantined = false;
    this.cancelPointerReleaseFrame();
    if (import.meta.env.DEV) delete this.game.canvas.dataset.miniGameInputQuarantined;
    if (import.meta.env.DEV) delete this.game.canvas.dataset.miniGameKeyboardInputQuarantined;
    for (const cleanup of this.cleanupCallbacks.splice(0)) cleanup();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.enabled = false;
  }
}
