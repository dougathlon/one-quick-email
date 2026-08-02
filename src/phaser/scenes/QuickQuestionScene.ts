import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const QUICK_QUESTION: MiniGameDefinition = {
  id: 'quick-question',
  sceneKey: 'mini-game-quick-question',
  title: 'Quick Question',
  instruction: 'Use the arrow keys, WASD, or drag the marker. Avoid every expanding bubble.',
  durationMs: 5_200,
  theme: {
    background: 0xffc857,
    surface: 0xfff7df,
    ink: 0x183153,
    accent: 0xef476f,
    secondary: 0x35c6d8,
    backdrop: 'geometric',
    fontFamily: 'Trebuchet MS, Arial, sans-serif',
    cabinetLabel: 'ONE TINY THING // DODGE MODE',
  },
};

interface SpeechBubble {
  readonly container: Phaser.GameObjects.Container;
  readonly baseRadius: number;
  readonly velocityX: number;
  readonly velocityY: number;
  age: number;
}

export class QuickQuestionScene extends BaseMiniGameScene {
  private marker!: Phaser.GameObjects.Arc;
  private bubbles: SpeechBubble[] = [];
  private spawnAccumulator = 0;
  private readonly movement = { left: false, right: false, up: false, down: false };
  private arenaBounds = { left: 200, right: 1240, top: 270, bottom: 750 };

  constructor() {
    super(QUICK_QUESTION);
  }

  protected buildGame(): void {
    this.bubbles = [];
    this.spawnAccumulator = 0;
    this.movement.left = false;
    this.movement.right = false;
    this.movement.up = false;
    this.movement.down = false;
    this.arenaBounds = this.isPortrait
      ? { left: 52, right: 548, top: 300, bottom: 1115 }
      : { left: 200, right: 1240, top: 270, bottom: 750 };

    const arena = this.addPanel(
      this.isPortrait ? 300 : 720,
      this.isPortrait ? 705 : 510,
      this.isPortrait ? 540 : 1080,
      this.isPortrait ? 850 : 520,
      0xe9edf5,
    );
    arena.setInteractive({ useHandCursor: true });
    this.addText(
      this.isPortrait ? 300 : 720,
      this.isPortrait ? 255 : 270,
      this.isPortrait ? 'DRAG THE YELLOW MARKER · SURVIVE' : 'SURVIVE THE “QUICK” FOLLOW-UPS',
      this.isPortrait ? 21 : 22,
      '#7a8499',
      { align: 'center', wordWrap: { width: this.isPortrait ? 510 : 1000 } },
    ).setOrigin(0.5);

    this.marker = this.add.circle(this.isPortrait ? 300 : 720, this.isPortrait ? 710 : 520, this.isPortrait ? 25 : 19, PALETTE.yellow)
      .setStrokeStyle(6, PALETTE.ink);
    this.gameLayer.add(this.marker);
    this.tweens.add({ targets: this.marker, scaleX: 1.18, scaleY: 1.18, duration: 240, yoyo: true, repeat: -1 });

    const moveMarkerToPointer = (pointer: Phaser.Input.Pointer): void => {
      const local = this.pointerToGame(pointer);
      this.marker.setPosition(
        Phaser.Math.Clamp(local.x, this.arenaBounds.left, this.arenaBounds.right),
        Phaser.Math.Clamp(local.y, this.arenaBounds.top, this.arenaBounds.bottom),
      );
    };
    this.enableDirectPointerDrag(arena, {
      move: moveMarkerToPointer,
    });

    this.onKey('keydown', (event) => this.setMovement(event, true));
    this.onKey('keyup', (event) => this.setMovement(event, false));
    const clearMovement = (): void => {
      this.movement.left = false;
      this.movement.right = false;
      this.movement.up = false;
      this.movement.down = false;
    };
    window.addEventListener('blur', clearMovement);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('blur', clearMovement);
      clearMovement();
    });
  }

  protected onPlayStarted(): void {
    this.spawnBubble();
    this.spawnBubble();
  }

  protected updateGame(delta: number, remainingMs: number): void {
    const horizontal = Number(this.movement.right) - Number(this.movement.left);
    const vertical = Number(this.movement.down) - Number(this.movement.up);
    const length = Math.hypot(horizontal, vertical) || 1;
    this.marker.x = Phaser.Math.Clamp(
      this.marker.x + (horizontal / length) * delta * (this.isPortrait ? 0.36 : 0.48),
      this.arenaBounds.left,
      this.arenaBounds.right,
    );
    this.marker.y = Phaser.Math.Clamp(
      this.marker.y + (vertical / length) * delta * (this.isPortrait ? 0.36 : 0.48),
      this.arenaBounds.top,
      this.arenaBounds.bottom,
    );

    this.spawnAccumulator += delta;
    if (this.spawnAccumulator >= 560) {
      this.spawnAccumulator -= 560;
      this.spawnBubble();
    }

    for (const bubble of this.bubbles) {
      bubble.age += delta;
      bubble.container.x += bubble.velocityX * delta;
      bubble.container.y += bubble.velocityY * delta;
      const scale = Math.min(2.25, 0.42 + bubble.age / 900);
      bubble.container.setScale(scale);

      const radius = bubble.baseRadius * scale;
      if (
        Phaser.Math.Distance.Between(this.marker.x, this.marker.y, bubble.container.x, bubble.container.y)
        < radius + (this.isPortrait ? 24 : 18)
      ) {
        this.forceComplete('timeout');
        return;
      }
    }

    if (remainingMs <= 0) this.succeed();
  }

  private setMovement(event: KeyboardEvent, pressed: boolean): void {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') this.movement.left = pressed;
    else if (key === 'arrowright' || key === 'd') this.movement.right = pressed;
    else if (key === 'arrowup' || key === 'w') this.movement.up = pressed;
    else if (key === 'arrowdown' || key === 's') this.movement.down = pressed;
    else return;
    event.preventDefault();
  }

  private spawnBubble(): void {
    let x = Phaser.Math.Between(this.arenaBounds.left + 30, this.arenaBounds.right - 30);
    let y = Phaser.Math.Between(this.arenaBounds.top + 30, this.arenaBounds.bottom - 30);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (Phaser.Math.Distance.Between(x, y, this.marker.x, this.marker.y) > 260) break;
      x = Phaser.Math.Between(this.arenaBounds.left + 30, this.arenaBounds.right - 30);
      y = Phaser.Math.Between(this.arenaBounds.top + 30, this.arenaBounds.bottom - 30);
    }

    const container = this.add.container(x, y).setScale(0.42);
    const ellipse = this.add.ellipse(0, 0, 118, 78, PALETTE.white).setStrokeStyle(4, PALETTE.ink);
    const tail = this.add.triangle(-42, 35, 0, 0, 25, 0, 4, 22, PALETTE.white).setStrokeStyle(3, PALETTE.ink);
    const copy = this.add.text(0, -2, Phaser.Utils.Array.GetRandom(['quick one?', 'got a sec?', 'tiny ask', 'ping?', 'one thing']), {
      color: '#14213d',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add([tail, ellipse, copy]);
    this.gameLayer.add(container);
    this.bubbles.push({
      container,
      baseRadius: this.isPortrait ? 43 : 50,
      velocityX: Phaser.Math.FloatBetween(-0.025, 0.025),
      velocityY: Phaser.Math.FloatBetween(-0.018, 0.018),
      age: 0,
    });
  }
}
