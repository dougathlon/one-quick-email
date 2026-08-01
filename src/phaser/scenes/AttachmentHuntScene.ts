import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const ATTACHMENT_HUNT: MiniGameDefinition = {
  id: 'attachment-hunt',
  sceneKey: 'mini-game-attachment-hunt',
  title: 'Attachment Hunt',
  instruction: 'Track the named file as the windows shuffle, then tap or click it.',
  durationMs: 6_000,
  theme: {
    background: 0x147fa3,
    surface: 0xd8d8d8,
    ink: 0x071d2b,
    accent: 0xffffff,
    secondary: 0x244cff,
    backdrop: 'desktop',
    fontFamily: 'Courier New, monospace',
    cabinetLabel: 'FILE MANAGER // LOCATE ATTACHMENT',
  },
};

interface FileWindow {
  readonly container: Phaser.GameObjects.Container;
  readonly surface: Phaser.GameObjects.Rectangle;
  readonly filename: string;
  readonly target: boolean;
}

const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [380, 400],
  [720, 400],
  [1060, 400],
  [380, 650],
  [720, 650],
  [1060, 650],
];

const FILE_SETS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Q3_budget_FINAL.xlsx', ['Q3_budget_v4.xlsx', 'Q3_budget_FINAL2.xlsx', 'Q2_budget_FINAL.xlsx', 'Q3_budegt_FINAL.xlsx', 'Q3_budget_notes.docx']],
  ['board_pack_SIGNED.pdf', ['board_pack_final.pdf', 'board_pack_SIGNED2.pdf', 'board_pack_draft.pdf', 'board_pack_SIGNED.docx', 'board_pack_old.pdf']],
  ['venue_contract_2026.pdf', ['venue_contract_2025.pdf', 'venue_contract_2026_v2.pdf', 'venue_contacts_2026.pdf', 'venue_contract_notes.docx', 'venue_contract.pdf']],
];

const FILENAME_LINE_LENGTH = 17;

function wrapFilename(filename: string, lineLength = FILENAME_LINE_LENGTH): string {
  if (filename.length <= lineLength) return filename;

  const firstLineWindow = filename.slice(0, lineLength);
  const lastSeparator = firstLineWindow.lastIndexOf('_');
  const breakAt = lastSeparator >= 7 ? lastSeparator + 1 : lineLength;
  return `${filename.slice(0, breakAt)}\n${filename.slice(breakAt)}`;
}

export class AttachmentHuntScene extends BaseMiniGameScene {
  private files: FileWindow[] = [];
  private selectedIndex = 0;
  private slots: ReadonlyArray<readonly [number, number]> = SLOTS;

  constructor() {
    super(ATTACHMENT_HUNT);
  }

  protected buildGame(): void {
    this.files = [];
    this.selectedIndex = 0;
    this.slots = this.isPortrait
      ? [
          [165, 410],
          [435, 410],
          [165, 680],
          [435, 680],
          [165, 950],
          [435, 950],
        ]
      : SLOTS;
    const selectedSet = FILE_SETS[Phaser.Math.Between(0, FILE_SETS.length - 1)] ?? FILE_SETS[0];
    const targetName = selectedSet?.[0] ?? 'Q3_budget_FINAL.xlsx';
    const decoys = selectedSet?.[1] ?? [];
    const filenames = Phaser.Utils.Array.Shuffle([targetName, ...decoys]);

    this.addText(this.isPortrait ? 300 : 720, this.isPortrait ? 255 : 248, `FIND: ${targetName}`, this.isPortrait ? 23 : 28, '#14213d', {
      backgroundColor: '#ffd447',
      padding: { x: this.isPortrait ? 12 : 20, y: 11 },
      align: 'center',
      wordWrap: { width: this.isPortrait ? 520 : 1000 },
    }).setOrigin(0.5);

    filenames.forEach((filename, index) => {
      const slot = this.slots[index] ?? this.slots[0] ?? [380, 400];
      const container = this.add.container(slot[0], slot[1]);
      const windowWidth = this.isPortrait ? 250 : 286;
      const windowHeight = this.isPortrait ? 190 : 178;
      const barY = -windowHeight / 2 + 19;
      const surface = this.add.rectangle(0, 0, windowWidth, windowHeight, PALETTE.white).setStrokeStyle(5, PALETTE.ink);
      const bar = this.add.rectangle(0, barY, windowWidth, 38, 0x59657d);
      const dotA = this.add.circle(-windowWidth / 2 + 25, barY, 7, PALETTE.red);
      const dotB = this.add.circle(-windowWidth / 2 + 49, barY, 7, PALETTE.yellow);
      const iconX = this.isPortrait ? -78 : -92;
      const icon = this.add.rectangle(iconX, 16, 58, 70, PALETTE.cyan).setStrokeStyle(3, PALETTE.ink);
      const fold = this.add.triangle(iconX + 29, -19, 0, 0, 24, 0, 24, 24, PALETTE.white).setStrokeStyle(2, PALETTE.ink);
      const label = this.add.text(this.isPortrait ? -38 : -45, 17, wrapFilename(filename, this.isPortrait ? 13 : FILENAME_LINE_LENGTH), {
        color: '#14213d',
        fontFamily: 'Courier New, monospace',
        fontSize: this.isPortrait ? '17px' : '15px',
        fontStyle: 'bold',
        lineSpacing: 2,
      }).setOrigin(0, 0.5);
      container.add([surface, bar, dotA, dotB, icon, fold, label]);
      container.setSize(windowWidth, windowHeight).setInteractive({ useHandCursor: true });
      this.gameLayer.add(container);

      const file: FileWindow = { container, surface, filename, target: filename === targetName };
      this.files.push(file);
      this.listen(container, Phaser.Input.Events.POINTER_UP, () => this.choose(file));
    });

    this.onKey('keydown', (event) => {
      if (!this.isPlaying) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        this.selectedIndex = (this.selectedIndex + this.files.length - 1) % this.files.length;
        this.refreshSelection();
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        this.selectedIndex = (this.selectedIndex + 1) % this.files.length;
        this.refreshSelection();
        event.preventDefault();
      } else if (event.key === 'Enter' || event.code === 'Space') {
        const file = this.files[this.selectedIndex];
        if (file) this.choose(file);
        event.preventDefault();
      }
    });
    this.refreshSelection();
  }

  protected onPlayStarted(): void {
    this.shuffleWindows();
    this.time.addEvent({ delay: 640, loop: true, callback: () => this.shuffleWindows() });
  }

  private choose(file: FileWindow): void {
    if (!this.isPlaying) return;
    if (file.target) {
      this.succeed();
      return;
    }
    this.flashMessage(`NOT ${file.filename}`, PALETTE.orange);
    this.pulse(file.container);
  }

  private shuffleWindows(): void {
    if (!this.isPlaying) return;
    const positions = Phaser.Utils.Array.Shuffle([...this.slots]);
    this.files.forEach((file, index) => {
      const position = positions[index] ?? this.slots[index] ?? [this.viewWidth / 2, this.viewHeight / 2];
      this.tweens.add({
        targets: file.container,
        x: position[0],
        y: position[1],
        angle: Phaser.Math.Between(-2, 2),
        duration: 460,
        ease: 'Cubic.easeInOut',
      });
    });
  }

  private refreshSelection(): void {
    this.files.forEach((file, index) => {
      file.surface.setStrokeStyle(index === this.selectedIndex ? 7 : 5, index === this.selectedIndex ? PALETTE.yellow : PALETTE.ink);
    });
  }
}
