import Phaser from 'phaser';

import type { MiniGameId, MiniGameOutcome } from '../game/types';
import {
  BaseMiniGameScene,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  MINI_GAME_PLAY_STARTED_EVENT,
} from './BaseMiniGameScene';
import { AttachmentHuntScene, ATTACHMENT_HUNT } from './scenes/AttachmentHuntScene';
import { BadgeScanScene, BADGE_SCAN } from './scenes/BadgeScanScene';
import { CalendarCollisionScene, CALENDAR_COLLISION } from './scenes/CalendarCollisionScene';
import { ExpenseTriageScene, EXPENSE_TRIAGE } from './scenes/ExpenseTriageScene';
import { HoldMusicHeroScene, HOLD_MUSIC_HERO } from './scenes/HoldMusicHeroScene';
import { PaperJamScene, PAPER_JAM } from './scenes/PaperJamScene';
import { PhoneTransferScene, PHONE_TRANSFER } from './scenes/PhoneTransferScene';
import { QuickQuestionScene, QUICK_QUESTION } from './scenes/QuickQuestionScene';
import { ReplyAllInterceptScene, REPLY_ALL_INTERCEPT } from './scenes/ReplyAllInterceptScene';
import { StampOfApprovalScene, STAMP_OF_APPROVAL } from './scenes/StampOfApprovalScene';
import type { MiniGameAudioCallbacks, MiniGameDefinition, MiniGameSceneData } from './types';
import {
  NO_SAFE_AREA,
  shouldUsePortraitMiniGameLayout,
  type MiniGameSafeAreaInsets,
} from './layout';

const DEFINITIONS: Readonly<Record<MiniGameId, MiniGameDefinition>> = {
  'calendar-collision': CALENDAR_COLLISION,
  'reply-all-intercept': REPLY_ALL_INTERCEPT,
  'paper-jam': PAPER_JAM,
  'hold-music-hero': HOLD_MUSIC_HERO,
  'stamp-of-approval': STAMP_OF_APPROVAL,
  'expense-triage': EXPENSE_TRIAGE,
  'quick-question': QUICK_QUESTION,
  'phone-transfer': PHONE_TRANSFER,
  'badge-scan': BADGE_SCAN,
  'attachment-hunt': ATTACHMENT_HUNT,
};

const SCENES = [
  CalendarCollisionScene,
  ReplyAllInterceptScene,
  PaperJamScene,
  HoldMusicHeroScene,
  StampOfApprovalScene,
  ExpenseTriageScene,
  QuickQuestionScene,
  PhoneTransferScene,
  BadgeScanScene,
  AttachmentHuntScene,
] as const;

const physicallyHeldKeys = new Set<string>();
let physicalKeyTrackingActive = false;
let physicalKeyTrackingLeaseCount = 0;

const trackPhysicalKeyDown = (event: KeyboardEvent): void => {
  physicallyHeldKeys.add(event.code || event.key);
};

const trackPhysicalKeyUp = (event: KeyboardEvent): void => {
  physicallyHeldKeys.delete(event.code || event.key);
};

const clearPhysicalKeys = (): void => {
  physicallyHeldKeys.clear();
};

function startPhysicalKeyTracking(): void {
  if (physicalKeyTrackingActive || typeof window === 'undefined') return;
  physicalKeyTrackingActive = true;
  window.addEventListener('keydown', trackPhysicalKeyDown, true);
  window.addEventListener('keyup', trackPhysicalKeyUp, true);
  window.addEventListener('blur', clearPhysicalKeys);
}

function retainPhysicalKeyTracking(): void {
  physicalKeyTrackingLeaseCount += 1;
  startPhysicalKeyTracking();
}

function releasePhysicalKeyTracking(): void {
  physicalKeyTrackingLeaseCount = Math.max(0, physicalKeyTrackingLeaseCount - 1);
  if (
    physicalKeyTrackingLeaseCount > 0
    || !physicalKeyTrackingActive
    || typeof window === 'undefined'
  ) return;
  window.removeEventListener('keydown', trackPhysicalKeyDown, true);
  window.removeEventListener('keyup', trackPhysicalKeyUp, true);
  window.removeEventListener('blur', clearPhysicalKeys);
  physicallyHeldKeys.clear();
  physicalKeyTrackingActive = false;
}

export function retainMiniGamePhysicalKeyTracking(): () => void {
  retainPhysicalKeyTracking();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releasePhysicalKeyTracking();
  };
}

export function hasPhysicallyHeldMiniGameKeys(): boolean {
  return physicallyHeldKeys.size > 0;
}

interface StartRequest {
  readonly id: MiniGameId;
  readonly onComplete: (outcome: MiniGameOutcome) => void;
  readonly portraitLayout: boolean;
  readonly token: number;
  forcedOutcome?: MiniGameOutcome;
}

interface LaunchingScene {
  readonly request: StartRequest;
  readonly scene: BaseMiniGameScene;
  readonly onPlayStarted: () => void;
}

interface ActiveScene {
  readonly request: StartRequest;
  readonly scene: BaseMiniGameScene;
  readonly onPlayStarted: () => void;
}

interface SavedParentAttributes {
  readonly ariaLabel: string | null;
  readonly miniGame: string | undefined;
  readonly miniGameStatus: string | undefined;
  readonly miniGameLayout: string | undefined;
  readonly role: string | null;
  readonly tabIndex: string | null;
}

/**
 * Disposable Phaser boundary for one interruption at a time. The host owns no
 * email or progression state; it reports only the current scene's outcome.
 */
export class MiniGameHost {
  private readonly game: Phaser.Game;
  private readonly savedAttributes: SavedParentAttributes;
  private readonly releasePhysicalKeyTracking: () => void;
  private readonly removeParentInputShield: () => void;
  private booted = false;
  private destroyed = false;
  private nextToken = 0;
  private pendingRequest: StartRequest | null = null;
  private launching: LaunchingScene | null = null;
  private active: ActiveScene | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly audio: MiniGameAudioCallbacks,
  ) {
    this.releasePhysicalKeyTracking = retainMiniGamePhysicalKeyTracking();
    this.savedAttributes = {
      ariaLabel: parent.getAttribute('aria-label'),
      miniGame: parent.dataset.miniGame,
      miniGameStatus: parent.dataset.miniGameStatus,
      miniGameLayout: parent.dataset.miniGameLayout,
      role: parent.getAttribute('role'),
      tabIndex: parent.getAttribute('tabindex'),
    };
    parent.setAttribute('role', 'application');
    parent.setAttribute('tabindex', '0');
    parent.setAttribute('aria-label', 'Office interruption mini-game');
    parent.dataset.miniGameStatus = 'idle';
    this.removeParentInputShield = this.installParentInputShield();

    const initialWidth = Math.max(1, parent.clientWidth || DESIGN_WIDTH);
    const initialHeight = Math.max(1, parent.clientHeight || DESIGN_HEIGHT);
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent,
      width: initialWidth,
      height: initialHeight,
      backgroundColor: '#0b132b',
      scene: [],
      audio: { noAudio: true },
      banner: false,
      transparent: false,
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: initialWidth,
        height: initialHeight,
      },
      callbacks: {
        postBoot: (game) => {
          game.canvas.style.touchAction = 'none';
          game.canvas.style.overscrollBehavior = 'contain';
          for (const SceneClass of SCENES) {
            const scene = new SceneClass();
            game.scene.add(scene.definition.sceneKey, scene, false);
          }
          queueMicrotask(() => this.handleBoot(game));
        },
      },
    });
  }

  start(id: MiniGameId, onComplete: (outcome: MiniGameOutcome) => void): void {
    this.assertUsable();
    const definition = DEFINITIONS[id];
    if (!definition) throw new RangeError(`Unknown mini-game id: ${String(id)}`);

    this.cancelCurrentRun();
    const portraitLayout = shouldUsePortraitMiniGameLayout({
      width: this.parent.clientWidth,
      height: this.parent.clientHeight,
    });
    const request: StartRequest = {
      id,
      onComplete,
      portraitLayout,
      token: ++this.nextToken,
    };
    this.pendingRequest = request;
    this.setParentStatus(definition, 'briefing', portraitLayout);
    if (this.booted) this.launchPending();
  }

  forceComplete(outcome: MiniGameOutcome = 'success'): void {
    if (this.destroyed) return;
    if (this.active) {
      this.active.scene.forceComplete(outcome);
      return;
    }
    if (this.launching) {
      this.launching.request.forcedOutcome = outcome;
      return;
    }
    if (this.pendingRequest) this.pendingRequest.forcedOutcome = outcome;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.nextToken += 1;
    this.pendingRequest = null;
    this.cancelCurrentRun();
    this.game.destroy(true);
    this.restoreParentAttributes();
    this.removeParentInputShield();
    this.releasePhysicalKeyTracking();
  }

  private handleBoot(game: Phaser.Game): void {
    if (this.destroyed || game !== this.game) return;
    this.booted = true;
    this.launchPending();
  }

  private launchPending(): void {
    const request = this.pendingRequest;
    if (!request || this.destroyed) return;
    this.pendingRequest = null;

    const definition = DEFINITIONS[request.id];
    const scene = this.game.scene.getScene(definition.sceneKey);
    if (!(scene instanceof BaseMiniGameScene)) {
      throw new Error(`Mini-game scene is not registered: ${definition.sceneKey}`);
    }
    scene.primeBriefingHeldKeys(physicallyHeldKeys);

    const onPlayStarted = (): void => {
      if (this.destroyed || request.token !== this.nextToken) return;
      this.parent.dataset.miniGameStatus = 'playing';
      this.parent.setAttribute('aria-label', `${definition.title}. ${definition.instruction}`);
    };
    scene.events.once(MINI_GAME_PLAY_STARTED_EVENT, onPlayStarted);
    this.launching = { request, scene, onPlayStarted };
    scene.events.once(Phaser.Scenes.Events.CREATE, () => {
      if (this.destroyed || request.token !== this.nextToken) {
        scene.events.off(MINI_GAME_PLAY_STARTED_EVENT, onPlayStarted);
        scene.cancel();
        this.game.scene.stop(definition.sceneKey);
        return;
      }
      this.launching = null;
      this.active = { request, scene, onPlayStarted };
      this.parent.dataset.miniGameStatus = 'briefing';
      if (request.forcedOutcome) scene.forceComplete(request.forcedOutcome);
    });

    const data: MiniGameSceneData = {
      audio: this.audio,
      onComplete: (outcome) => this.completeRun(request, definition, outcome),
      portraitLayout: request.portraitLayout,
      safeAreaInsets: measureSafeAreaInsets(this.parent),
    };
    this.game.scene.start(definition.sceneKey, data);
  }

  private completeRun(
    request: StartRequest,
    definition: MiniGameDefinition,
    outcome: MiniGameOutcome,
  ): void {
    if (this.destroyed || request.token !== this.nextToken) return;
    const current = this.active ?? this.launching;
    if (current?.request.token === request.token) {
      current.scene.events.off(MINI_GAME_PLAY_STARTED_EVENT, current.onPlayStarted);
    }
    this.active = null;
    this.launching = null;
    this.game.scene.stop(definition.sceneKey);
    this.parent.dataset.miniGameStatus = outcome;
    this.parent.setAttribute('aria-label', `${definition.title}: ${outcome}`);
    request.onComplete(outcome);
  }

  private cancelCurrentRun(): void {
    const current = this.active ?? this.launching;
    if (current) {
      current.scene.events.off(MINI_GAME_PLAY_STARTED_EVENT, current.onPlayStarted);
      current.scene.cancel();
      this.game.scene.stop(DEFINITIONS[current.request.id].sceneKey);
    }
    this.active = null;
    this.launching = null;
    this.pendingRequest = null;
  }

  private setParentStatus(
    definition: MiniGameDefinition,
    status: string,
    portraitLayout: boolean,
  ): void {
    this.parent.dataset.miniGame = definition.id;
    this.parent.dataset.miniGameStatus = status;
    this.parent.dataset.miniGameLayout = portraitLayout ? 'portrait' : 'landscape';
    this.parent.setAttribute('aria-label', `${definition.title}. ${definition.instruction}`);
    this.parent.focus({ preventScroll: true });
  }

  private assertUsable(): void {
    if (this.destroyed) throw new Error('Cannot start a destroyed MiniGameHost');
  }

  private restoreParentAttributes(): void {
    this.restoreAttribute('aria-label', this.savedAttributes.ariaLabel);
    this.restoreAttribute('role', this.savedAttributes.role);
    this.restoreAttribute('tabindex', this.savedAttributes.tabIndex);
    this.restoreDataset('miniGame', this.savedAttributes.miniGame);
    this.restoreDataset('miniGameStatus', this.savedAttributes.miniGameStatus);
    this.restoreDataset('miniGameLayout', this.savedAttributes.miniGameLayout);
  }

  private restoreAttribute(name: string, value: string | null): void {
    if (value === null) this.parent.removeAttribute(name);
    else this.parent.setAttribute(name, value);
  }

  private restoreDataset(key: 'miniGame' | 'miniGameStatus' | 'miniGameLayout', value: string | undefined): void {
    if (value === undefined) delete this.parent.dataset[key];
    else this.parent.dataset[key] = value;
  }

  private installParentInputShield(): () => void {
    const eventNames = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'mousedown',
      'mousemove',
      'mouseup',
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
      'click',
      'contextmenu',
      'wheel',
      'dragstart',
      'selectstart',
    ] as const;
    const blockLeak = (event: Event): void => {
      if (!this.pendingRequest && !this.launching && !this.active) return;
      const isMousePointerEvent = event.type.startsWith('pointer')
        && (event as PointerEvent).pointerType === 'mouse';
      if (event.cancelable && !isMousePointerEvent) event.preventDefault();
      event.stopPropagation();
      if (event.type === 'pointerdown' || event.type === 'touchstart') {
        this.parent.focus({ preventScroll: true });
      }
    };
    const options: AddEventListenerOptions = { passive: false };
    for (const eventName of eventNames) this.parent.addEventListener(eventName, blockLeak, options);
    return () => {
      for (const eventName of eventNames) this.parent.removeEventListener(eventName, blockLeak, options);
    };
  }
}

function measureSafeAreaInsets(parent: HTMLElement): MiniGameSafeAreaInsets {
  if (typeof document === 'undefined') return NO_SAFE_AREA;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
  });
  parent.append(probe);
  const style = getComputedStyle(probe);
  const read = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const insets = {
    top: read(style.paddingTop),
    right: read(style.paddingRight),
    bottom: read(style.paddingBottom),
    left: read(style.paddingLeft),
  };
  probe.remove();
  return insets;
}

export type { MiniGameAudioCallbacks } from './types';
