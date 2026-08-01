import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const STAMP_OF_APPROVAL: MiniGameDefinition = {
  id: 'stamp-of-approval',
  sceneKey: 'mini-game-stamp-of-approval',
  title: 'Stamp of Approval',
  instruction: 'Tap, click, or press SPACE when the stamp crosses the signature box.',
  durationMs: 5_000,
  theme: {
    background: 0xe8ddc4,
    surface: 0xfff8e7,
    ink: 0x3f2a24,
    accent: 0xb61f2e,
    secondary: 0xc49a44,
    backdrop: 'dossier',
    fontFamily: 'Georgia, Times New Roman, serif',
    cabinetLabel: 'FORM 27-B // AUTHORISATION REQUIRED',
  },
};

export class StampOfApprovalScene extends BaseMiniGameScene {
  private stamp!: Phaser.GameObjects.Container;
  private targetX = 720;
  private elapsed = 0;
  private swingSpeed = 0.004;
  private swingCenterX = 720;
  private swingAmplitude = 390;
  private signatureY = 655;

  constructor() {
    super(STAMP_OF_APPROVAL);
  }

  protected buildGame(): void {
    this.elapsed = Phaser.Math.Between(0, 900);
    this.swingCenterX = this.isPortrait ? 300 : 720;
    this.swingAmplitude = this.isPortrait ? 210 : 390;
    this.signatureY = this.isPortrait ? 955 : 655;
    this.targetX = this.isPortrait ? Phaser.Math.Between(155, 445) : Phaser.Math.Between(590, 850);
    this.swingSpeed = Phaser.Math.FloatBetween(0.0035, 0.0045);

    const panelY = this.isPortrait ? 700 : 515;
    this.addPanel(this.swingCenterX, panelY, this.isPortrait ? 530 : 1000, this.isPortrait ? 830 : 450, PALETTE.white);
    this.addText(
      this.isPortrait ? 58 : 320,
      this.isPortrait ? 300 : 340,
      'FORM 27-B / ROUTINE EXISTENTIAL CLEARANCE',
      this.isPortrait ? 22 : 21,
      '#7a8499',
      { wordWrap: { width: this.isPortrait ? 480 : 900 } },
    );
    for (let y = this.isPortrait ? 380 : 405; y <= (this.isPortrait ? 850 : 590); y += this.isPortrait ? 70 : 46) {
      const line = this.add.rectangle(this.swingCenterX, y, this.isPortrait ? 450 : 700, 5, 0xc8c1b1);
      this.gameLayer.add(line);
    }

    const signature = this.add.rectangle(this.targetX, this.signatureY, this.isPortrait ? 180 : 190, this.isPortrait ? 112 : 92, PALETTE.green, 0.2)
      .setStrokeStyle(5, PALETTE.green);
    const signatureLabel = this.add.text(this.targetX, this.signatureY, 'SIGN HERE', {
      color: '#24855c',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: this.isPortrait ? '24px' : '21px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gameLayer.add([signature, signatureLabel]);

    this.stamp = this.add.container(this.swingCenterX, this.isPortrait ? 570 : 455);
    const handle = this.add.rectangle(0, -62, 72, 110, PALETTE.orange).setStrokeStyle(5, PALETTE.ink);
    const neck = this.add.rectangle(0, -5, 38, 48, PALETTE.ink);
    const base = this.add.rectangle(0, 45, 180, 62, PALETTE.red).setStrokeStyle(6, PALETTE.ink);
    const label = this.add.text(0, 45, 'APPROVED', {
      color: '#fffaf0',
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.stamp.add([handle, neck, base, label]);
    this.gameLayer.add(this.stamp);

    const clickCatcher = this.add.rectangle(this.swingCenterX, panelY, this.isPortrait ? 530 : 1000, this.isPortrait ? 830 : 450, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    this.gameLayer.add(clickCatcher);
    this.listen(clickCatcher, Phaser.Input.Events.POINTER_UP, () => this.stampNow());
    this.onKey('keydown-SPACE', (event) => {
      event.preventDefault();
      this.stampNow();
    });
    this.onKey('keydown-ENTER', (event) => {
      event.preventDefault();
      this.stampNow();
    });
  }

  protected updateGame(delta: number): void {
    this.elapsed += delta;
    this.stamp.x = this.swingCenterX + Math.sin(this.elapsed * this.swingSpeed) * this.swingAmplitude;
    this.stamp.angle = Math.sin(this.elapsed * this.swingSpeed) * 7;
  }

  private stampNow(): void {
    if (!this.isPlaying) return;
    if (Math.abs(this.stamp.x - this.targetX) <= 82) {
      this.stamp.setPosition(this.targetX, this.signatureY - 100);
      this.succeed();
      return;
    }
    this.flashMessage('MISSED — TRY AGAIN', PALETTE.orange);
    this.pulse(this.stamp);
  }
}
