import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const CALENDAR_COLLISION: MiniGameDefinition = {
  id: 'calendar-collision',
  sceneKey: 'mini-game-calendar-collision',
  title: 'Calendar Collision',
  instruction: 'Drag or use ← →. Release or press SPACE inside the green slot.',
  durationMs: 6_000,
  theme: {
    background: 0xf4efe3,
    surface: 0xffffff,
    ink: 0x26324a,
    accent: 0x2eb7c5,
    secondary: 0xffd447,
    backdrop: 'planner',
    fontFamily: 'Arial Black, Arial, sans-serif',
    cabinetLabel: 'CALENDAR SERVICE // CONFLICT DETECTED',
  },
};

export class CalendarCollisionScene extends BaseMiniGameScene {
  private meeting!: Phaser.GameObjects.Container;
  private targetX = 0;
  private trackMinX = 220;
  private trackMaxX = 1220;
  private trackY = 510;

  constructor() {
    super(CALENDAR_COLLISION);
  }

  protected buildGame(): void {
    const centerX = this.isPortrait ? 300 : 720;
    this.trackMinX = this.isPortrait ? 70 : 220;
    this.trackMaxX = this.isPortrait ? 530 : 1220;
    this.trackY = this.isPortrait ? 650 : 510;
    this.addPanel(centerX, this.isPortrait ? 675 : 480, this.isPortrait ? 540 : 1120, this.isPortrait ? 710 : 360, PALETTE.white);
    this.addText(this.isPortrait ? 48 : 202, this.isPortrait ? 342 : 316, 'TUESDAY · SHARED CALENDAR', this.isPortrait ? 24 : 22, '#7a8499');

    const track = this.add.rectangle(centerX, this.trackY, this.isPortrait ? 500 : 1000, this.isPortrait ? 156 : 120, 0xe8e4d8)
      .setStrokeStyle(4, PALETTE.ink);
    this.gameLayer.add(track);

    const possibleTargets = this.isPortrait ? [135, 245, 355, 465] : [460, 650, 840, 1030];
    this.targetX = possibleTargets[Phaser.Math.Between(0, possibleTargets.length - 1)] ?? 650;

    for (const x of possibleTargets) {
      if (x === this.targetX) continue;
      const busy = this.add.rectangle(x, this.trackY, this.isPortrait ? 98 : 145, this.isPortrait ? 112 : 88, PALETTE.red, 0.78)
        .setStrokeStyle(3, PALETTE.ink);
      const label = this.add.text(x, this.trackY, Phaser.Utils.Array.GetRandom(['REVIEW', 'SYNC', 'CALL', '1:1']), {
        color: '#14213d',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: this.isPortrait ? '18px' : '19px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.gameLayer.add([busy, label]);
    }

    const target = this.add.rectangle(this.targetX, this.trackY, this.isPortrait ? 100 : 132, this.isPortrait ? 120 : 96, PALETTE.green, 0.35)
      .setStrokeStyle(5, PALETTE.green);
    const targetLabel = this.add.text(this.targetX, this.trackY + (this.isPortrait ? 100 : 70), 'FREE', {
      color: '#24855c',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: this.isPortrait ? '22px' : '20px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gameLayer.add([target, targetLabel]);

    const startsOnLeft = this.targetX > centerX;
    this.meeting = this.add.container(startsOnLeft ? this.trackMinX + 15 : this.trackMaxX - 15, this.isPortrait ? 960 : 690);
    const meetingSurface = this.add.rectangle(0, 0, this.isPortrait ? 150 : 126, this.isPortrait ? 112 : 96, PALETTE.yellow)
      .setStrokeStyle(5, PALETTE.ink);
    const meetingLabel = this.add.text(0, 0, 'YOUR\nMEETING', {
      align: 'center',
      color: '#14213d',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: this.isPortrait ? '22px' : '19px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.meeting.add([meetingSurface, meetingLabel]);
    this.meeting.setSize(this.isPortrait ? 150 : 126, this.isPortrait ? 112 : 96)
      .setInteractive({ useHandCursor: true });
    this.gameLayer.add(this.meeting);

    this.enableDirectPointerDrag(this.meeting, {
      move: (pointer) => {
        const local = this.pointerToGame(pointer);
        this.meeting.setPosition(Phaser.Math.Clamp(local.x, this.trackMinX, this.trackMaxX), this.trackY);
      },
      end: () => this.checkLock(),
    });

    this.onKey('keydown', (event) => {
      if (!this.isPlaying) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        this.moveMeeting(-34);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault();
        this.moveMeeting(34);
      } else if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        this.checkLock();
      }
    });
  }

  private moveMeeting(distance: number): void {
    if (this.meeting.y !== this.trackY) this.meeting.y = this.trackY;
    this.meeting.x = Phaser.Math.Clamp(this.meeting.x + distance, this.trackMinX, this.trackMaxX);
  }

  private checkLock(): void {
    if (Math.abs(this.meeting.x - this.targetX) <= (this.isPortrait ? 52 : 48) && Math.abs(this.meeting.y - this.trackY) <= 65) {
      this.meeting.setPosition(this.targetX, this.trackY);
      this.succeed();
      return;
    }
    this.flashMessage('COLLISION — KEEP LOOKING', PALETTE.orange);
  }
}
