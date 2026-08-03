import Phaser from 'phaser';

import {
  connectorJoinsRoute,
  isPhoneTransferPathComplete,
  type PhoneConnectorKind,
  type PhoneConnectorRoute,
} from '../../game/phoneTransferPath';
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

interface Connector {
  readonly kind: PhoneConnectorKind;
  readonly route: PhoneConnectorRoute;
  readonly container: Phaser.GameObjects.Container;
  readonly surface: Phaser.GameObjects.Rectangle;
  readonly pipe: Phaser.GameObjects.Graphics;
  rotation: number;
}

type ConnectorLayout = readonly [number, number, PhoneConnectorKind, PhoneConnectorRoute];

const CONNECTOR_LAYOUT: readonly ConnectorLayout[] = [
  [340, 355, 'straight', { entry: 'left', exit: 'right' }],
  [500, 355, 'corner', { entry: 'left', exit: 'down' }],
  [500, 515, 'straight', { entry: 'up', exit: 'down' }],
  [500, 675, 'corner', { entry: 'up', exit: 'right' }],
  [660, 675, 'straight', { entry: 'left', exit: 'right' }],
  [820, 675, 'straight', { entry: 'left', exit: 'right' }],
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
    this.clearDebugState();
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

    const connectorLayout: readonly ConnectorLayout[] = this.isPortrait
      ? [
          [175, 430, 'straight', { entry: 'left', exit: 'right' }],
          [305, 430, 'corner', { entry: 'left', exit: 'down' }],
          [305, 570, 'straight', { entry: 'up', exit: 'down' }],
          [305, 710, 'corner', { entry: 'up', exit: 'right' }],
          [435, 710, 'corner', { entry: 'left', exit: 'down' }],
          [435, 850, 'straight', { entry: 'up', exit: 'down' }],
        ]
      : CONNECTOR_LAYOUT;
    connectorLayout.forEach(([x, y, kind, route], index) => {
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
      if (index < 2 && connectorJoinsRoute({ kind, rotation }, route)) rotation = (rotation + 1) % 4;
      pipe.angle = rotation * 90;
      container.add([surface, pipe, number]);
      container.setSize(tileSize, tileSize).setInteractive({ useHandCursor: true });
      this.gameLayer.add(container);

      const connector: Connector = { kind, route, container, surface, pipe, rotation };
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
    this.publishDebugState();
  }

  private rotateSelected(): void {
    if (!this.isPlaying) return;
    const connector = this.connectors[this.selectedIndex];
    if (!connector) return;
    connector.rotation = (connector.rotation + 1) % 4;
    this.tweens.killTweensOf(connector.pipe);
    this.tweens.add({
      targets: connector.pipe,
      angle: connector.rotation * 90,
      duration: 100,
      ease: 'Cubic.easeOut',
      onComplete: () => this.checkForSuccess(),
    });
    this.refreshSelection();
    this.publishDebugState();
  }

  private refreshSelection(): void {
    this.connectors.forEach((connector, index) => {
      connector.surface.setStrokeStyle(index === this.selectedIndex ? 7 : 4, index === this.selectedIndex ? PALETTE.yellow : PALETTE.ink);
    });
  }

  private checkForSuccess(): void {
    if (!this.isPlaying) return;
    const logicalConnected = this.isLogicalPathComplete();
    const visualRotations = this.connectors.map((connector) => this.settledRotation(connector.pipe.angle));
    const visualConnected = visualRotations.every((rotation) => rotation !== null)
      && isPhoneTransferPathComplete(
        this.connectors.map((connector, index) => ({
          kind: connector.kind,
          rotation: visualRotations[index] ?? Number.NaN,
        })),
        this.connectors.map((connector) => connector.route),
      );
    this.publishDebugState(visualConnected);
    if (!logicalConnected || !visualConnected) return;
    if (import.meta.env.DEV) this.game.canvas.dataset.phoneTransferSuccessVisualConnected = 'true';
    this.succeed();
  }

  private isLogicalPathComplete(): boolean {
    return isPhoneTransferPathComplete(
      this.connectors,
      this.connectors.map((connector) => connector.route),
    );
  }

  private settledRotation(angle: number): number | null {
    const quarterTurns = Math.round(angle / 90);
    return Math.abs(angle - quarterTurns * 90) <= 0.01
      ? ((quarterTurns % 4) + 4) % 4
      : null;
  }

  private clearDebugState(): void {
    if (!import.meta.env.DEV) return;
    delete this.game.canvas.dataset.phoneTransferRotations;
    delete this.game.canvas.dataset.phoneTransferLogicalConnected;
    delete this.game.canvas.dataset.phoneTransferVisualConnected;
    delete this.game.canvas.dataset.phoneTransferSuccessVisualConnected;
  }

  private publishDebugState(visualConnected?: boolean): void {
    if (!import.meta.env.DEV) return;
    this.game.canvas.dataset.phoneTransferRotations = this.connectors
      .map((connector) => connector.rotation)
      .join(',');
    this.game.canvas.dataset.phoneTransferLogicalConnected = String(this.isLogicalPathComplete());
    if (visualConnected !== undefined) {
      this.game.canvas.dataset.phoneTransferVisualConnected = String(visualConnected);
    }
  }
}
