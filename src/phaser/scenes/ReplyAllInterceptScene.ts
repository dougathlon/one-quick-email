import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const REPLY_ALL_INTERCEPT: MiniGameDefinition = {
  id: 'reply-all-intercept',
  sceneKey: 'mini-game-reply-all-intercept',
  title: 'Reply-All Intercept',
  instruction: 'Stop on the named recipient: tap, click, or press SPACE.',
  durationMs: 5_500,
  theme: {
    background: 0x07150d,
    surface: 0x102a1b,
    ink: 0xa5ffba,
    accent: 0x38f278,
    secondary: 0xff3b5c,
    backdrop: 'terminal',
    fontFamily: 'Courier New, monospace',
    cabinetLabel: 'MAIL ROUTER // RECIPIENT OVERRIDE',
  },
};

export class ReplyAllInterceptScene extends BaseMiniGameScene {
  private selector!: Phaser.GameObjects.Rectangle;
  private targetIndex = 1;
  private selectorPosition = 160;
  private selectorSpeed = 0.19;
  private recipientPositions: readonly number[] = [265, 560, 855, 1150];

  constructor() {
    super(REPLY_ALL_INTERCEPT);
  }

  protected buildGame(): void {
    const centerX = this.isPortrait ? 300 : 720;
    const panelY = this.isPortrait ? 700 : 500;
    this.recipientPositions = this.isPortrait ? [430, 600, 770, 940] : [265, 560, 855, 1150];
    this.selectorPosition = this.isPortrait ? 340 : 160;
    const companyPosition = this.recipientPositions[3] ?? (this.isPortrait ? 940 : 1150);
    this.selectorSpeed = (companyPosition - 16 - this.selectorPosition) / this.definition.durationMs;
    this.addPanel(centerX, panelY, this.isPortrait ? 540 : 1160, this.isPortrait ? 820 : 430, PALETTE.white);
    const names = ['YOU', 'MARA / FINANCE', 'DEV / LEGAL', 'ENTIRE COMPANY'] as const;
    this.targetIndex = Phaser.Math.Between(1, 2);
    this.addText(
      centerX,
      this.isPortrait ? 292 : 298,
      `INTENDED RECIPIENT: ${names[this.targetIndex]}`,
      this.isPortrait ? 24 : 27,
      '#14213d',
      {
        backgroundColor: '#ffd447',
        padding: { x: this.isPortrait ? 12 : 18, y: 10 },
        align: 'center',
        wordWrap: { width: this.isPortrait ? 500 : 900 },
      },
    ).setOrigin(0.5);

    names.forEach((name, index) => {
      const dangerous = index === names.length - 1;
      const target = index === this.targetIndex;
      this.addPanel(
        this.isPortrait ? centerX : this.recipientPositions[index] ?? 265,
        this.isPortrait ? this.recipientPositions[index] ?? 430 : 525,
        this.isPortrait ? 440 : 240,
        this.isPortrait ? 120 : 150,
        dangerous ? PALETTE.red : target ? PALETTE.green : 0xe8e4d8,
        PALETTE.ink,
        4,
      );
      this.addText(
        this.isPortrait ? centerX : this.recipientPositions[index] ?? 265,
        this.isPortrait ? this.recipientPositions[index] ?? 430 : 525,
        name,
        this.isPortrait ? 25 : dangerous ? 21 : 23,
        '#14213d',
        { align: 'center', wordWrap: { width: this.isPortrait ? 390 : 205 } },
      ).setOrigin(0.5);
    });

    const rail = this.isPortrait
      ? this.add.rectangle(64, 685, 12, 650, PALETTE.ink)
      : this.add.rectangle(708, 658, 1120, 12, PALETTE.ink).setOrigin(0.5);
    this.selector = this.add.rectangle(
      this.isPortrait ? centerX : this.selectorPosition,
      this.isPortrait ? this.selectorPosition : 525,
      this.isPortrait ? 456 : 252,
      this.isPortrait ? 132 : 166,
      PALETTE.cyan,
      0.18,
    )
      .setStrokeStyle(8, PALETTE.cyan);
    const clickCatcher = this.add.rectangle(centerX, panelY, this.isPortrait ? 540 : 1160, this.isPortrait ? 820 : 430, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    this.gameLayer.add([rail, this.selector, clickCatcher]);
    this.listen(clickCatcher, Phaser.Input.Events.POINTER_UP, () => this.tryIntercept());
    this.onKey('keydown-SPACE', (event) => {
      event.preventDefault();
      this.tryIntercept();
    });
    this.onKey('keydown-ENTER', (event) => {
      event.preventDefault();
      this.tryIntercept();
    });
  }

  protected updateGame(delta: number): void {
    this.selectorPosition += delta * this.selectorSpeed;
    if (this.isPortrait) this.selector.y = this.selectorPosition;
    else this.selector.x = this.selectorPosition;
    const companyPosition = this.recipientPositions[3] ?? (this.isPortrait ? 940 : 1150);
    if (this.selectorPosition >= companyPosition - 16) this.forceComplete('timeout');
  }

  private tryIntercept(): void {
    if (!this.isPlaying) return;
    const targetPosition = this.recipientPositions[this.targetIndex] ?? (this.isPortrait ? 600 : 560);
    if (Math.abs(this.selectorPosition - targetPosition) <= (this.isPortrait ? 62 : 112)) {
      this.selectorPosition = targetPosition;
      if (this.isPortrait) this.selector.y = targetPosition;
      else this.selector.x = targetPosition;
      this.succeed();
      return;
    }
    this.flashMessage('WRONG RECIPIENT', PALETTE.orange);
  }
}
