import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const BADGE_SCAN: MiniGameDefinition = {
  id: 'badge-scan',
  sceneKey: 'mini-game-badge-scan',
  title: 'Badge Scan',
  instruction: 'Drag the card all the way through the scanner — neither too fast nor too slow.',
  durationMs: 6_500,
  theme: {
    background: 0x101c34,
    surface: 0x1d3154,
    ink: 0xe9f6ff,
    accent: 0x31d8ff,
    secondary: 0xffd447,
    backdrop: 'security',
    fontFamily: 'Arial Narrow, Arial, sans-serif',
    cabinetLabel: 'SECURITY GATE // VELOCITY CHECK',
  },
};

const CARD_HOME_X = 285;
const CARD_HOME_Y = 535;
const SCANNER_X = 850;
const FINISH_X = 1140;
const MIN_SWIPE_MS = 650;
const MAX_SWIPE_MS = 1_250;
const METER_MAX_MS = 1_700;

export class BadgeScanScene extends BaseMiniGameScene {
  private card!: Phaser.GameObjects.Container;
  private meterNeedle!: Phaser.GameObjects.Triangle;
  private swipeStartedAt: number | null = null;
  private keyboardSwipeStartedAt: number | null = null;
  private crossedScanner = false;
  private cardHomeX = CARD_HOME_X;
  private cardHomeY = CARD_HOME_Y;
  private scannerX = SCANNER_X;
  private finishX = FINISH_X;
  private meterStartX = 410;
  private meterEndX = 1030;

  constructor() {
    super(BADGE_SCAN);
  }

  protected buildGame(): void {
    this.swipeStartedAt = null;
    this.keyboardSwipeStartedAt = null;
    this.crossedScanner = false;
    this.cardHomeX = this.isPortrait ? 130 : CARD_HOME_X;
    this.cardHomeY = this.isPortrait ? 720 : CARD_HOME_Y;
    this.scannerX = this.isPortrait ? 350 : SCANNER_X;
    this.finishX = this.isPortrait ? 470 : FINISH_X;
    this.meterStartX = this.isPortrait ? 90 : 410;
    this.meterEndX = this.isPortrait ? 510 : 1030;

    const centerX = this.isPortrait ? 300 : 720;
    this.addPanel(centerX, this.isPortrait ? 700 : 505, this.isPortrait ? 550 : 1120, this.isPortrait ? 850 : 470, 0xe9edf5);
    const lane = this.add.rectangle(centerX, this.cardHomeY, this.isPortrait ? 520 : 970, this.isPortrait ? 230 : 180, 0xd8d0bd)
      .setStrokeStyle(4, PALETTE.ink);
    this.gameLayer.add(lane);

    const scannerBody = this.add.rectangle(this.scannerX, this.cardHomeY, this.isPortrait ? 150 : 180, 310, 0x59657d)
      .setStrokeStyle(7, PALETTE.ink);
    const scannerSlot = this.add.rectangle(this.scannerX, this.cardHomeY, 34, 250, PALETTE.dark).setStrokeStyle(3, PALETTE.ink);
    const scannerLight = this.add.circle(this.scannerX + (this.isPortrait ? 42 : 53), this.cardHomeY - 112, 13, PALETTE.yellow)
      .setStrokeStyle(3, PALETTE.ink);
    this.gameLayer.add([scannerBody, scannerSlot, scannerLight]);
    this.addText(this.scannerX, this.cardHomeY + 205, 'SCANNER', this.isPortrait ? 24 : 21, '#7a8499').setOrigin(0.5);

    const meterY = this.isPortrait ? 355 : 310;
    const meterTrack = this.add.rectangle(centerX, meterY, this.isPortrait ? 430 : 610, 36, 0xd8d0bd).setStrokeStyle(4, PALETTE.ink);
    const targetBandStartX = this.meterXForElapsed(MIN_SWIPE_MS);
    const targetBandEndX = this.meterXForElapsed(MAX_SWIPE_MS);
    const targetBand = this.add.rectangle(
      (targetBandStartX + targetBandEndX) / 2,
      meterY,
      targetBandEndX - targetBandStartX,
      28,
      PALETTE.green,
      0.8,
    );
    this.meterNeedle = this.add.triangle(this.meterStartX, meterY - 35, 0, 0, 22, 0, 11, 24, PALETTE.red);
    this.gameLayer.add([meterTrack, targetBand, this.meterNeedle]);
    this.addText(this.meterStartX, meterY + 35, 'FAST', this.isPortrait ? 19 : 17, '#7a8499').setOrigin(0.5);
    this.addText(this.meterEndX, meterY + 35, 'SLOW', this.isPortrait ? 19 : 17, '#7a8499').setOrigin(0.5);
    this.addText(centerX, meterY + 35, 'TARGET SPEED', this.isPortrait ? 19 : 17, '#24855c').setOrigin(0.5);

    this.card = this.add.container(this.cardHomeX, this.cardHomeY);
    const cardWidth = this.isPortrait ? 210 : 235;
    const cardHeight = this.isPortrait ? 155 : 145;
    const cardSurface = this.add.rectangle(0, 0, cardWidth, cardHeight, PALETTE.cyan).setStrokeStyle(6, PALETTE.ink);
    const portrait = this.add.circle(this.isPortrait ? -62 : -70, 0, this.isPortrait ? 32 : 36, PALETTE.yellow).setStrokeStyle(4, PALETTE.ink);
    const name = this.add.text(this.isPortrait ? -18 : -15, -20, 'A. EMPLOYEE', {
      color: '#14213d',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: this.isPortrait ? '18px' : '20px',
      fontStyle: 'bold',
    });
    const access = this.add.text(this.isPortrait ? -18 : -15, 18, 'ACCESS: YES', {
      color: '#14213d',
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fontStyle: 'bold',
    });
    this.card.add([cardSurface, portrait, name, access]);
    this.card.setSize(cardWidth, cardHeight).setInteractive({ useHandCursor: true });
    this.gameLayer.add(this.card);

    this.enableDirectPointerDrag(this.card, {
      start: () => {
        this.swipeStartedAt = this.time.now;
        this.crossedScanner = false;
      },
      move: (pointer) => {
        if (this.swipeStartedAt === null) return;
        const local = this.pointerToGame(pointer);
        this.card.setPosition(
          Phaser.Math.Clamp(local.x, this.cardHomeX, this.finishX),
          Phaser.Math.Clamp(local.y, this.cardHomeY - 80, this.cardHomeY + 80),
        );
        if (this.card.x >= this.scannerX) this.crossedScanner = true;
        this.updateMeter(this.time.now - this.swipeStartedAt);
      },
      end: () => this.endPointerSwipe(),
    });

    this.onKey('keydown-SPACE', (event) => {
      if (event.repeat || !this.isPlaying || this.keyboardSwipeStartedAt !== null) return;
      event.preventDefault();
      this.keyboardSwipeStartedAt = this.time.now;
    });
    this.onKey('keyup-SPACE', (event) => {
      if (!this.isPlaying || this.keyboardSwipeStartedAt === null) return;
      event.preventDefault();
      const elapsed = this.time.now - this.keyboardSwipeStartedAt;
      this.keyboardSwipeStartedAt = null;
      this.card.x = this.finishX;
      this.evaluateSwipe(elapsed, true);
    });
  }

  protected updateGame(_delta: number): void {
    if (this.swipeStartedAt !== null) {
      this.updateMeter(this.time.now - this.swipeStartedAt);
    }
    if (this.keyboardSwipeStartedAt !== null) {
      const elapsed = this.time.now - this.keyboardSwipeStartedAt;
      this.card.x = Phaser.Math.Linear(this.cardHomeX, this.finishX, Phaser.Math.Clamp(elapsed / 1_500, 0, 1));
      this.updateMeter(elapsed);
    }
  }

  private endPointerSwipe(): void {
    if (!this.isPlaying || this.swipeStartedAt === null) return;
    const elapsed = this.time.now - this.swipeStartedAt;
    this.swipeStartedAt = null;
    const completedPath = this.crossedScanner && this.card.x >= this.finishX - (this.isPortrait ? 30 : 55);
    this.evaluateSwipe(elapsed, completedPath);
  }

  private evaluateSwipe(elapsed: number, completedPath: boolean): void {
    if (completedPath && elapsed >= MIN_SWIPE_MS && elapsed <= MAX_SWIPE_MS) {
      this.succeed();
      return;
    }

    const message = !completedPath ? 'SWIPE ALL THE WAY THROUGH' : elapsed < MIN_SWIPE_MS ? 'TOO FAST' : 'TOO SLOW';
    this.flashMessage(message, PALETTE.orange);
    this.card.setPosition(this.cardHomeX, this.cardHomeY);
    this.meterNeedle.x = this.meterStartX;
    this.crossedScanner = false;
  }

  private updateMeter(elapsed: number): void {
    this.meterNeedle.x = this.meterXForElapsed(elapsed);
  }

  private meterXForElapsed(elapsed: number): number {
    return Phaser.Math.Linear(
      this.meterStartX,
      this.meterEndX,
      Phaser.Math.Clamp(elapsed / METER_MAX_MS, 0, 1),
    );
  }
}
