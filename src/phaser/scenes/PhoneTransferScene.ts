import Phaser from 'phaser';

import { BaseMiniGameScene, PALETTE } from '../BaseMiniGameScene';
import type { MiniGameDefinition } from '../types';

export const PHONE_TRANSFER: MiniGameDefinition = {
  id: 'phone-transfer',
  sceneKey: 'mini-game-phone-transfer',
  title: 'Phone Transfer',
  instruction: 'Tap connectors to rotate. Use ← → to select and ↑ ↓ or SPACE to rotate.',
  durationMs: 7_000,
  theme: {
    background: 0x08172a,
    surface: 0x102f4f,
    ink: 0xd7f9ff,
    accent: 0x42d9c8,
    secondary: 0xffc857,
    backdrop: 'switchboard',
    fontFamily: 'Courier New, monospace',
    cabinetLabel: 'SWITCHBOARD // ROUTE CALL TO 204',
  },
};

type ConnectorKind = 'straight' | 'corner';

interface Connector {
  readonly kind: ConnectorKind;
  readonly required: number;
  readonly container: Phaser.GameObjects.Container;
  readonly surface: Phaser.GameObjects.Rectangle;
  readonly pipe: Phaser.GameObjects.Graphics;
  rotation: number;
}

const CONNECTOR_LAYOUT: ReadonlyArray<readonly [number, number, ConnectorKind, number]> = [
  [340, 355, 'straight', 0],
  [500, 355, 'corner', 1],
  [500, 515, 'straight', 1],
  [500, 675, 'corner', 3],
  [660, 675, 'straight', 0],
  [820, 675, 'straight', 0],
];

export class PhoneTransferScene extends BaseMiniGameScene {
  private connectors: Connector[] = [];
  private selectedIndex = 0;

  constructor() {
    super(PHONE_TRANSFER);
  }

  protected buildGame(): void {
    this.connectors = [];
    this.selectedIndex = 0;
    const centerX = this.isPortrait ? 300 : 720;
    this.addPanel(centerX, this.isPortrait ? 700 : 510, this.isPortrait ? 550 : 1080, this.isPortrait ? 850 : 540, 0xe9edf5);

    const callerX = this.isPortrait ? 72 : 205;
    const callerY = this.isPortrait ? 430 : 355;
    const extensionX = this.isPortrait ? 435 : 1040;
    const extensionY = this.isPortrait ? 1040 : 675;
    this.addPanel(callerX, callerY, this.isPortrait ? 100 : 130, this.isPortrait ? 120 : 130, PALETTE.cyan);
    this.addText(callerX, callerY - 30, 'CALLER', this.isPortrait ? 16 : 19, '#14213d').setOrigin(0.5);
    this.addText(callerX, callerY + 22, '☎', this.isPortrait ? 40 : 48, '#14213d').setOrigin(0.5);
    this.addPanel(extensionX, extensionY, this.isPortrait ? 240 : 220, this.isPortrait ? 150 : 130, PALETTE.green);
    this.addText(extensionX, extensionY - 28, 'EXTENSION', this.isPortrait ? 22 : 19, '#14213d').setOrigin(0.5);
    this.addText(extensionX, extensionY + 30, '204', this.isPortrait ? 38 : 35, '#14213d').setOrigin(0.5);

    const finalLink = this.isPortrait
      ? this.add.rectangle(435, 934, 18, 62, PALETTE.blue)
      : this.add.rectangle(906, 675, 48, 18, PALETTE.blue);
    this.gameLayer.add(finalLink);

    const connectorLayout: ReadonlyArray<readonly [number, number, ConnectorKind, number]> = this.isPortrait
      ? [
          [175, 430, 'straight', 0],
          [305, 430, 'corner', 1],
          [305, 570, 'straight', 1],
          [305, 710, 'corner', 3],
          [435, 710, 'corner', 1],
          [435, 850, 'straight', 1],
        ]
      : CONNECTOR_LAYOUT;
    connectorLayout.forEach(([x, y, kind, required], index) => {
      const container = this.add.container(x, y);
      const tileSize = this.isPortrait ? 108 : 124;
      const pipeRadius = tileSize / 2;
      const surface = this.add.rectangle(0, 0, tileSize, tileSize, PALETTE.white).setStrokeStyle(4, PALETTE.ink);
      const pipe = this.add.graphics();
      pipe.lineStyle(18, PALETTE.blue, 1).beginPath();
      if (kind === 'straight') {
        pipe.moveTo(-pipeRadius, 0).lineTo(pipeRadius, 0);
      } else {
        pipe.moveTo(0, pipeRadius).lineTo(0, 0).lineTo(pipeRadius, 0);
      }
      pipe.strokePath();
      pipe.fillStyle(PALETTE.yellow).fillCircle(0, 0, 13);
      const number = this.add.text(-tileSize / 2 + 13, -tileSize / 2 + 12, String(index + 1), {
        color: '#14213d',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: this.isPortrait ? '18px' : '16px',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      let rotation = Phaser.Math.Between(0, 3);
      if (index < 2 && this.orientationMatches(kind, rotation, required)) rotation = (rotation + 1) % 4;
      pipe.angle = rotation * 90;
      container.add([surface, pipe, number]);
      container.setSize(tileSize, tileSize).setInteractive({ useHandCursor: true });
      this.gameLayer.add(container);

      const connector: Connector = { kind, required, container, surface, pipe, rotation };
      this.connectors.push(connector);
      this.listen(container, Phaser.Input.Events.POINTER_UP, () => {
        this.selectedIndex = index;
        this.rotateSelected();
      });
    });

    this.onKey('keydown', (event) => {
      if (!this.isPlaying) return;
      if (event.key === 'ArrowLeft') {
        this.selectedIndex = (this.selectedIndex + this.connectors.length - 1) % this.connectors.length;
        this.refreshSelection();
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        this.selectedIndex = (this.selectedIndex + 1) % this.connectors.length;
        this.refreshSelection();
        event.preventDefault();
      } else if (
        event.code === 'Space'
        || event.key === 'Enter'
        || event.key === 'ArrowUp'
        || event.key === 'ArrowDown'
      ) {
        this.rotateSelected();
        event.preventDefault();
      }
    });
    this.refreshSelection();
  }

  private rotateSelected(): void {
    if (!this.isPlaying) return;
    const connector = this.connectors[this.selectedIndex];
    if (!connector) return;
    connector.rotation = (connector.rotation + 1) % 4;
    this.tweens.add({
      targets: connector.pipe,
      angle: connector.rotation * 90,
      duration: 100,
      ease: 'Cubic.easeOut',
    });
    this.refreshSelection();
    if (this.connectors.every((item) => this.orientationMatches(item.kind, item.rotation, item.required))) {
      this.succeed();
    }
  }

  private refreshSelection(): void {
    this.connectors.forEach((connector, index) => {
      connector.surface.setStrokeStyle(index === this.selectedIndex ? 7 : 4, index === this.selectedIndex ? PALETTE.yellow : PALETTE.ink);
    });
  }

  private orientationMatches(kind: ConnectorKind, rotation: number, required: number): boolean {
    return kind === 'straight' ? rotation % 2 === required % 2 : rotation % 4 === required % 4;
  }
}
