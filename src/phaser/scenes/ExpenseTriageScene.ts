import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const EXPENSE_TRIAGE: MiniGameDefinition = {
  id: 'expense-triage',
  sceneKey: 'mini-game-expense-triage',
  title: 'Expense Triage',
  instruction: 'Drag all three receipts into the correct broad category.',
  durationMs: 7_000,
  theme: {
    background: 0xe0f0e9,
    surface: 0xfafff8,
    ink: 0x123c34,
    accent: 0x1f9d75,
    secondary: 0xff9f1c,
    backdrop: 'ledger',
    fontFamily: 'Courier New, monospace',
    cabinetLabel: 'EXPENSE LEDGER // THREE ITEMS UNFILED',
  },
};

type Category = 'TRAVEL' | 'MEALS' | 'SUPPLIES';

interface Receipt {
  readonly category: Category;
  readonly container: Phaser.GameObjects.Container;
  readonly homeX: number;
  readonly homeY: number;
  filed: boolean;
}

const CATEGORY_X: Readonly<Record<Category, number>> = {
  TRAVEL: 400,
  MEALS: 720,
  SUPPLIES: 1040,
};

interface CategoryTarget {
  readonly x: number;
  readonly y: number;
}

const RECEIPT_COPY: Readonly<Record<Category, readonly string[]>> = {
  TRAVEL: ['RAIL TICKET\n£24.80', 'TAXI\n£18.40', 'PARKING\n£9.50'],
  MEALS: ['TEAM LUNCH\n£31.20', 'COFFEE\n£8.60', 'SANDWICHES\n£14.10'],
  SUPPLIES: ['PRINTER INK\n£29.00', 'NOTEPADS\n£12.70', 'CABLES\n£16.25'],
};

export class ExpenseTriageScene extends BaseMiniGameScene {
  private receipts: Receipt[] = [];
  private filedCount = 0;
  private categoryTargets: Readonly<Record<Category, CategoryTarget>> = {
    TRAVEL: { x: 400, y: 625 },
    MEALS: { x: 720, y: 625 },
    SUPPLIES: { x: 1040, y: 625 },
  };

  constructor() {
    super(EXPENSE_TRIAGE);
  }

  protected buildGame(): void {
    this.receipts = [];
    this.filedCount = 0;
    const categories: Category[] = ['TRAVEL', 'MEALS', 'SUPPLIES'];
    this.categoryTargets = this.isPortrait
      ? {
          TRAVEL: { x: 450, y: 420 },
          MEALS: { x: 450, y: 690 },
          SUPPLIES: { x: 450, y: 960 },
        }
      : {
          TRAVEL: { x: CATEGORY_X.TRAVEL, y: 625 },
          MEALS: { x: CATEGORY_X.MEALS, y: 625 },
          SUPPLIES: { x: CATEGORY_X.SUPPLIES, y: 625 },
        };

    for (const category of categories) {
      const target = this.categoryTargets[category];
      this.addPanel(
        target.x,
        target.y,
        this.isPortrait ? 240 : 270,
        this.isPortrait ? 210 : 220,
        category === 'TRAVEL' ? 0xbdebf0 : category === 'MEALS' ? 0xffeaa1 : 0xbfead1,
      );
      this.addText(target.x, target.y + (this.isPortrait ? 68 : 75), category, this.isPortrait ? 24 : 26, '#14213d')
        .setOrigin(0.5);
    }

    Phaser.Utils.Array.Shuffle(categories);
    categories.forEach((category, index) => {
      const homeX = this.isPortrait ? 150 : 400 + index * 320;
      const homeY = this.isPortrait ? 420 + index * 270 : 330 + Phaser.Math.Between(-12, 12);
      const receiptContainer = this.add.container(homeX, homeY);
      const paper = this.add.rectangle(0, 0, this.isPortrait ? 250 : 235, this.isPortrait ? 170 : 155, PALETTE.white)
        .setStrokeStyle(4, PALETTE.ink);
      const heading = this.add.text(0, -50, 'RECEIPT', {
        color: '#7a8499',
        fontFamily: 'Courier New, monospace',
        fontSize: this.isPortrait ? '20px' : '18px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const options = RECEIPT_COPY[category];
      const copy = options[Phaser.Math.Between(0, options.length - 1)] ?? options[0] ?? category;
      const detail = this.add.text(0, 18, copy, {
        align: 'center',
        color: '#14213d',
        fontFamily: 'Courier New, monospace',
        fontSize: this.isPortrait ? '23px' : '21px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      receiptContainer.add([paper, heading, detail]);
      receiptContainer.setSize(this.isPortrait ? 250 : 235, this.isPortrait ? 170 : 155)
        .setInteractive({ useHandCursor: true });
      this.gameLayer.add(receiptContainer);

      const receipt: Receipt = { category, container: receiptContainer, homeX, homeY, filed: false };
      this.receipts.push(receipt);
      this.enableDirectPointerDrag(receiptContainer, {
        start: () => {
          if (receipt.filed) return;
          this.gameLayer.bringToTop(receiptContainer);
          receiptContainer.angle = 0;
        },
        move: (pointer) => {
          if (receipt.filed) return;
          const local = this.pointerToGame(pointer);
          receiptContainer.setPosition(
            Phaser.Math.Clamp(local.x, 40, this.viewWidth - 40),
            Phaser.Math.Clamp(local.y, 280, this.viewHeight - 60),
          );
        },
        end: () => this.fileReceipt(receipt),
      });
    });
  }

  private fileReceipt(receipt: Receipt): void {
    if (!this.isPlaying || receipt.filed) return;
    const target = this.categoryTargets[receipt.category];
    const insideTarget = Math.abs(receipt.container.x - target.x) <= (this.isPortrait ? 125 : 135)
      && Math.abs(receipt.container.y - target.y) <= (this.isPortrait ? 115 : 150);
    if (insideTarget) {
      receipt.filed = true;
      this.filedCount += 1;
      receipt.container.disableInteractive();
      receipt.container.setPosition(target.x, target.y).setScale(this.isPortrait ? 0.72 : 0.66).setAlpha(0.82);
      this.flashMessage(`${receipt.category} FILED`, PALETTE.green);
      if (this.filedCount === this.receipts.length) this.succeed();
      return;
    }

    receipt.container.setPosition(receipt.homeX, receipt.homeY);
    this.flashMessage('WRONG PILE', PALETTE.orange);
  }
}
