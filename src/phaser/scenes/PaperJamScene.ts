import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const PAPER_JAM: MiniGameDefinition = {
  id: 'paper-jam',
  sceneKey: 'mini-game-paper-jam',
  title: 'Paper Jam',
  instruction: 'Alternate the two handles by tap/click — or use A and D.',
  durationMs: 5_500,
  theme: {
    background: 0xd6d3cc,
    surface: 0xf4f1e8,
    ink: 0x171717,
    accent: 0xff3b30,
    secondary: 0x171717,
    backdrop: 'xerox',
    fontFamily: 'Impact, Arial Black, sans-serif',
    cabinetLabel: 'PRINTER ERROR // MANUAL EXTRACTION',
  },
};

export class PaperJamScene extends BaseMiniGameScene {
  private printer!: Phaser.GameObjects.Container;
  private paper!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progress = 0;
  private expected: 'left' | 'right' = 'left';
  private shakeTime = 0;
  private printerHomeX = 720;

  constructor() {
    super(PAPER_JAM);
  }

  protected buildGame(): void {
    this.progress = 0;
    this.expected = Phaser.Math.Between(0, 1) === 0 ? 'left' : 'right';
    this.shakeTime = 0;
    this.printerHomeX = this.isPortrait ? 300 : 720;

    const printerY = this.isPortrait ? 610 : 505;
    this.printer = this.add.container(this.printerHomeX, printerY);
    const printerBody = this.add.rectangle(0, 0, this.isPortrait ? 500 : 560, 280, 0x59657d).setStrokeStyle(7, PALETTE.ink);
    const top = this.add.rectangle(0, -138, this.isPortrait ? 390 : 430, 74, 0x7a8499).setStrokeStyle(5, PALETTE.ink);
    const mouth = this.add.rectangle(0, 68, this.isPortrait ? 330 : 350, 42, PALETTE.dark).setStrokeStyle(4, PALETTE.ink);
    const light = this.add.circle(this.isPortrait ? 186 : 216, -84, 12, PALETTE.red).setStrokeStyle(3, PALETTE.ink);
    this.paper = this.add.rectangle(0, 100, this.isPortrait ? 255 : 285, 220, PALETTE.white).setStrokeStyle(4, PALETTE.ink);
    this.printer.add([this.paper, printerBody, top, mouth, light]);
    this.gameLayer.add(this.printer);

    for (let y = 28; y <= 150; y += 31) {
      const line = this.add.rectangle(this.printerHomeX, printerY + 100 + y, this.isPortrait ? 185 : 205, 5, 0xb9bfd0);
      this.gameLayer.add(line);
    }

    const progressY = this.isPortrait ? 1085 : 748;
    const progressWidth = this.isPortrait ? 500 : 620;
    const progressTrack = this.add.rectangle(this.printerHomeX, progressY, progressWidth, 26, 0xd8d0bd).setStrokeStyle(4, PALETTE.ink);
    this.progressFill = this.add.rectangle(this.printerHomeX - progressWidth / 2, progressY, progressWidth, 18, PALETTE.green)
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    this.gameLayer.add([progressTrack, this.progressFill]);

    this.makeButton(
      this.isPortrait ? 145 : 390,
      this.isPortrait ? 925 : 505,
      this.isPortrait ? 220 : 150,
      this.isPortrait ? 130 : 104,
      this.isPortrait ? 'A / LEFT\nPULL' : 'A\nPULL',
      PALETTE.cyan,
      () => this.pull('left'),
    );
    this.makeButton(
      this.isPortrait ? 455 : 1050,
      this.isPortrait ? 925 : 505,
      this.isPortrait ? 220 : 150,
      this.isPortrait ? 130 : 104,
      this.isPortrait ? 'D / RIGHT\nPULL' : 'D\nPULL',
      PALETTE.yellow,
      () => this.pull('right'),
    );

    this.onKey('keydown', (event) => {
      if (event.repeat || !this.isPlaying) return;
      if (event.key.toLowerCase() === 'a' || event.key === 'ArrowLeft') {
        event.preventDefault();
        this.pull('left');
      } else if (event.key.toLowerCase() === 'd' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.pull('right');
      }
    });
  }

  protected updateGame(delta: number): void {
    this.shakeTime += delta;
    this.printer.x = this.printerHomeX + Math.sin(this.shakeTime * 0.095) * 8 + Phaser.Math.Between(-3, 3);
    this.printer.angle = Math.sin(this.shakeTime * 0.071) * 1.4;
  }

  private pull(side: 'left' | 'right'): void {
    if (!this.isPlaying) return;
    if (side !== this.expected) {
      this.progress = Math.max(0, this.progress - 1);
      this.flashMessage(`NO — ${this.expected === 'left' ? 'A' : 'D'} NEXT`, PALETTE.orange);
    } else {
      this.progress += 1;
      this.expected = side === 'left' ? 'right' : 'left';
      this.paper.y += 12;
    }
    this.progressFill.scaleX = this.progress / 10;
    if (this.progress >= 10) this.succeed();
  }
}
