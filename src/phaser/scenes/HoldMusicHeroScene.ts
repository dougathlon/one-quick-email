import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const HOLD_MUSIC_HERO: MiniGameDefinition = {
  id: 'hold-music-hero',
  sceneKey: 'mini-game-hold-music-hero',
  title: 'Hold Music Hero',
  instruction: 'Tap the arrow pads or use arrow keys to enter the sequence.',
  durationMs: 6_000,
  theme: {
    background: 0x170b35,
    surface: 0x29165b,
    ink: 0xffffff,
    accent: 0x00f5d4,
    secondary: 0xff2cc3,
    backdrop: 'neon',
    fontFamily: 'Arial Black, Arial, sans-serif',
    cabinetLabel: 'HOLD LOOP // BONUS STAGE',
  },
};

type Direction = 'ArrowLeft' | 'ArrowUp' | 'ArrowDown' | 'ArrowRight';

const DIRECTIONS: readonly Direction[] = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
const GLYPH: Readonly<Record<Direction, string>> = {
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowRight: '→',
};

export class HoldMusicHeroScene extends BaseMiniGameScene {
  private sequence: Direction[] = [];
  private sequenceTiles: Phaser.GameObjects.Container[] = [];
  private entered = 0;
  private waveform!: Phaser.GameObjects.Graphics;
  private waveTime = 0;

  constructor() {
    super(HOLD_MUSIC_HERO);
  }

  protected buildGame(): void {
    this.entered = 0;
    this.waveTime = 0;
    this.sequence = Array.from({ length: 6 }, () => DIRECTIONS[Phaser.Math.Between(0, DIRECTIONS.length - 1)] ?? 'ArrowLeft');
    this.sequenceTiles = [];
    this.setDevCanvasData('holdMusicSequence', this.sequence.join(','));

    const centerX = this.isPortrait ? 300 : 720;
    this.addPanel(centerX, this.isPortrait ? 700 : 485, this.isPortrait ? 540 : 1120, this.isPortrait ? 850 : 420, PALETTE.white);
    this.addText(
      centerX,
      this.isPortrait ? 292 : 312,
      '♫  YOUR CALL IS VERY IMPORTANT TO US  ♫',
      this.isPortrait ? 22 : 26,
      '#3867d6',
      { align: 'center', wordWrap: { width: this.isPortrait ? 500 : 1000 } },
    ).setOrigin(0.5);

    this.waveform = this.add.graphics();
    this.gameLayer.add(this.waveform);

    this.sequence.forEach((direction, index) => {
      const x = this.isPortrait ? 150 + (index % 3) * 150 : 395 + index * 130;
      const y = this.isPortrait ? 500 + Math.floor(index / 3) * 150 : 490;
      const tile = this.add.container(x, y);
      const surface = this.add.rectangle(0, 0, this.isPortrait ? 116 : 96, this.isPortrait ? 118 : 104, 0xe8e4d8)
        .setStrokeStyle(5, PALETTE.ink);
      const glyph = this.add.text(0, -3, GLYPH[direction], {
        color: '#14213d',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: this.isPortrait ? '68px' : '60px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      tile.add([surface, glyph]);
      this.gameLayer.add(tile);
      this.sequenceTiles.push(tile);
    });

    const buttons: Array<readonly [Direction, number, number]> = [
      ['ArrowLeft', this.isPortrait ? 180 : 525, this.isPortrait ? 840 : 676],
      ['ArrowUp', this.isPortrait ? 420 : 655, this.isPortrait ? 840 : 676],
      ['ArrowDown', this.isPortrait ? 180 : 785, this.isPortrait ? 1010 : 676],
      ['ArrowRight', this.isPortrait ? 420 : 915, this.isPortrait ? 1010 : 676],
    ];
    for (const [direction, x, y] of buttons) {
      this.makeButton(
        x,
        y,
        this.isPortrait ? 180 : 118,
        this.isPortrait ? 130 : 96,
        GLYPH[direction],
        PALETTE.cyan,
        () => this.enter(direction),
      );
    }

    this.onKey('keydown', (event) => {
      if (event.repeat || !this.isPlaying) return;
      if (DIRECTIONS.includes(event.key as Direction)) {
        event.preventDefault();
        this.enter(event.key as Direction);
      }
    });
  }

  protected updateGame(delta: number): void {
    this.waveTime += delta;
    this.waveform.clear().lineStyle(4, PALETTE.blue, 0.7);
    const startX = this.isPortrait ? 55 : 255;
    const endX = this.isPortrait ? 545 : 1185;
    const waveY = this.isPortrait ? 385 : 390;
    this.waveform.beginPath().moveTo(startX, waveY);
    for (let x = startX; x <= endX; x += 12) {
      const amplitude = 12 + 18 * Math.sin((x + this.waveTime) * 0.018) ** 2;
      this.waveform.lineTo(x, waveY + Math.sin(x * 0.052 + this.waveTime * 0.009) * amplitude);
    }
    this.waveform.strokePath();
  }

  protected onPlayStarted(): void {
    this.refreshTiles();
  }

  private enter(direction: Direction): void {
    if (!this.isPlaying) return;
    const expected = this.sequence[this.entered];
    if (direction !== expected) {
      this.entered = 0;
      this.refreshTiles();
      this.flashMessage('LOOP RESTARTED', PALETTE.orange);
      return;
    }

    this.entered += 1;
    this.refreshTiles();
    if (this.entered >= this.sequence.length) this.succeed();
  }

  private refreshTiles(): void {
    this.sequenceTiles.forEach((tile, index) => {
      const surface = tile.first as Phaser.GameObjects.Rectangle | null;
      if (!surface) return;
      surface.setFillStyle(index < this.entered ? PALETTE.green : index === this.entered ? PALETTE.yellow : 0xe8e4d8);
    });
  }
}
