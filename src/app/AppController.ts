import { AudioManager } from '../audio/AudioManager';
import { INBOX_MESSAGES } from '../data/inbox';
import { SCENARIOS } from '../data/scenarios';
import { attachEditorGuards } from '../game/editorGuards';
import { selectFinalReply } from '../game/evaluation';
import { InterruptionScheduler } from '../game/InterruptionScheduler';
import { SeededRandom, selectMiniGame, selectScenario, type RandomSource } from '../game/random';
import type {
  DraftSnapshot,
  EmailScenario,
  GamePhase,
  InboxMessage,
  MiniGameId,
  MiniGameOutcome,
} from '../game/types';
import { canSend, countWords } from '../game/wordCount';
import {
  hasPhysicallyHeldMiniGameKeys,
  MiniGameHost,
  retainMiniGamePhysicalKeyTracking,
} from '../phaser/MiniGameHost';
import { AppView } from '../ui/AppView';

const LAST_SCENARIO_KEY = 'one-quick-email:last-scenario';
const REPLY_DELAY_MS = 12_000;

const MINI_GAMES: readonly MiniGameId[] = [
  'calendar-collision',
  'reply-all-intercept',
  'paper-jam',
  'hold-music-hero',
  'stamp-of-approval',
  'expense-triage',
  'quick-question',
  'phone-transfer',
  'badge-scan',
  'attachment-hunt',
];

const MINI_GAME_LABELS: Readonly<Record<MiniGameId, string>> = {
  'calendar-collision': 'CALENDAR COLLISION',
  'reply-all-intercept': 'REPLY-ALL INTERCEPT',
  'paper-jam': 'PAPER JAM',
  'hold-music-hero': 'HOLD MUSIC HERO',
  'stamp-of-approval': 'STAMP OF APPROVAL',
  'expense-triage': 'EXPENSE TRIAGE',
  'quick-question': 'QUICK QUESTION',
  'phone-transfer': 'PHONE TRANSFER',
  'badge-scan': 'BADGE SCAN',
  'attachment-hunt': 'ATTACHMENT HUNT',
};

interface ApplicationState {
  phase: GamePhase;
  scenario: EmailScenario | null;
  draft: string;
  wordCount: number;
  snapshot: DraftSnapshot;
  interruptionStarted: boolean;
  miniGameHistory: MiniGameId[];
  activeMiniGame: MiniGameId | null;
  inboxMessages: InboxMessage[];
  finalReply: string;
  recipientReplyArrived: boolean;
}

export class AppController {
  private readonly audio = new AudioManager();
  private readonly releaseMiniGamePhysicalKeyTracking = retainMiniGamePhysicalKeyTracking();
  private readonly random: RandomSource;
  private readonly view: AppView;
  private readonly scheduler: InterruptionScheduler;
  private state: ApplicationState = this.freshState();
  private editor: HTMLTextAreaElement | null = null;
  private removeEditorGuards: (() => void) | null = null;
  private miniGameHost: MiniGameHost | null = null;
  private inboxTimer: ReturnType<typeof setTimeout> | null = null;
  private inboxRemaining = REPLY_DELAY_MS;
  private inboxLastTick = 0;
  private pendingPrintableInput = false;
  private readonly heldMiniGameKeys = new Set<string>();
  private miniGameInputShieldInstalled = false;
  private pendingEditorRestore = false;
  private destroyed = false;

  constructor(root: HTMLElement, phaserLayer: HTMLElement) {
    this.random = this.createRandomSource();
    this.scheduler = new InterruptionScheduler(() => this.startMiniGame(), this.random);
    this.view = new AppView(root, phaserLayer, {
      onStartWork: () => this.startWork(),
      onToggleMute: () => this.toggleMute(),
      onSend: () => this.sendEmail(),
      onOpenReply: () => this.openRecipientReply(),
      onPlayAgain: () => this.beginScenario(),
      onViewSent: () => this.viewSentEmail(),
      onBackToReply: () => this.renderFinalReply(),
    });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  start(): void {
    this.view.renderTitle(this.audio.isMuted);
    this.installDevelopmentHooks();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scheduler.stop();
    this.clearInboxTimer();
    this.removeMiniGameInputShield();
    this.detachEditor();
    this.view.showMiniGame(false);
    this.miniGameHost?.destroy();
    this.miniGameHost = null;
    this.releaseMiniGamePhysicalKeyTracking();
    this.audio.destroy();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (import.meta.env.DEV) delete window.__ONE_QUICK_EMAIL_TEST__;
  }

  private startWork(): void {
    void this.audio.unlock().catch(() => {
      // Audio is optional; the complete game remains playable if a browser refuses it.
    });
    this.beginScenario();
  }

  private beginScenario(): void {
    this.scheduler.stop();
    this.clearInboxTimer();
    this.removeMiniGameInputShield();
    this.detachEditor();
    if (this.state.phase === 'minigame') {
      this.miniGameHost?.forceComplete('timeout');
      this.view.showMiniGame(false);
    }

    const lastScenarioId = this.readLastScenarioId();
    const scenario = selectScenario(SCENARIOS, lastScenarioId, this.random);
    this.writeLastScenarioId(scenario.id);
    this.state = {
      ...this.freshState(),
      phase: 'compose',
      scenario,
    };
    this.renderCompose();
  }

  private renderCompose(): void {
    const scenario = this.requireScenario();
    this.editor = this.view.renderCompose(scenario, this.state.draft, this.state.wordCount, this.audio.isMuted);
    this.removeEditorGuards = attachEditorGuards(this.editor);
    this.editor.addEventListener('beforeinput', this.handleEditorBeforeInput);
    this.editor.addEventListener('input', this.handleEditorInput);
    this.editor.addEventListener('keyup', this.captureEditorPosition);
    this.editor.addEventListener('pointerup', this.captureEditorPosition);
    this.editor.addEventListener('scroll', this.captureEditorPosition);
    this.editor.focus({ preventScroll: true });
    this.restoreEditorSnapshot();
  }

  private detachEditor(): void {
    if (this.editor) {
      this.editor.removeEventListener('beforeinput', this.handleEditorBeforeInput);
      this.editor.removeEventListener('input', this.handleEditorInput);
      this.editor.removeEventListener('keyup', this.captureEditorPosition);
      this.editor.removeEventListener('pointerup', this.captureEditorPosition);
      this.editor.removeEventListener('scroll', this.captureEditorPosition);
    }
    this.removeEditorGuards?.();
    this.removeEditorGuards = null;
    this.editor = null;
  }

  private readonly handleEditorBeforeInput = (event: InputEvent): void => {
    this.pendingPrintableInput = event.inputType === 'insertText'
      && typeof event.data === 'string'
      && /\S| /u.test(event.data);
  };

  private readonly handleEditorInput = (): void => {
    if (!this.editor) return;
    this.state.draft = this.editor.value;
    this.state.wordCount = countWords(this.state.draft);
    this.captureEditorPosition();
    this.view.updateComposeStatus(this.state.wordCount);
    this.audio.typing();
    if (this.pendingPrintableInput && !this.state.interruptionStarted) {
      this.state.interruptionStarted = true;
      this.scheduler.start();
    }
    this.pendingPrintableInput = false;
  };

  private readonly captureEditorPosition = (): void => {
    if (!this.editor) return;
    this.state.snapshot = {
      text: this.editor.value,
      selectionStart: this.editor.selectionStart,
      selectionEnd: this.editor.selectionEnd,
      scrollTop: this.editor.scrollTop,
      scrollLeft: this.editor.scrollLeft,
    };
  };

  private startMiniGame(forcedId?: MiniGameId): void {
    if (this.state.phase !== 'compose' || !this.editor) return;
    if (document.hidden) {
      this.scheduler.pause();
      return;
    }
    this.captureEditorPosition();
    const id = forcedId ?? selectMiniGame(MINI_GAMES, this.state.miniGameHistory, this.random);
    this.state.miniGameHistory.push(id);
    this.state.miniGameHistory = this.state.miniGameHistory.slice(-2);
    this.state.activeMiniGame = id;
    this.state.phase = 'minigame';
    this.scheduler.pause();
    this.installMiniGameInputShield();
    this.editor.blur();
    this.view.showMiniGame(true, MINI_GAME_LABELS[id]);
    this.ensureMiniGameHost();
    this.miniGameHost?.start(id, (outcome) => this.finishMiniGame(outcome));
  }

  private finishMiniGame(_outcome: MiniGameOutcome): void {
    if (this.state.phase !== 'minigame') return;
    this.state.phase = 'compose';
    this.state.activeMiniGame = null;
    this.view.showMiniGame(false);
    this.pendingEditorRestore = true;
    requestAnimationFrame(() => {
      this.completeMiniGameReturnWhenKeysAreReleased();
    });
  }

  private installMiniGameInputShield(): void {
    this.removeMiniGameInputShield();
    this.miniGameInputShieldInstalled = true;
    document.addEventListener('keydown', this.handleMiniGameKeyDown, true);
    document.addEventListener('keyup', this.handleMiniGameKeyUp, true);
    window.addEventListener('blur', this.handleMiniGameWindowBlur, true);
  }

  private removeMiniGameInputShield(): void {
    if (this.miniGameInputShieldInstalled) {
      document.removeEventListener('keydown', this.handleMiniGameKeyDown, true);
      document.removeEventListener('keyup', this.handleMiniGameKeyUp, true);
      window.removeEventListener('blur', this.handleMiniGameWindowBlur, true);
    }
    this.miniGameInputShieldInstalled = false;
    this.pendingEditorRestore = false;
    this.heldMiniGameKeys.clear();
  }

  private readonly handleMiniGameKeyDown = (event: KeyboardEvent): void => {
    if (this.state.phase === 'minigame') {
      this.heldMiniGameKeys.add(event.code || event.key);
      return;
    }

    if (this.pendingEditorRestore) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private readonly handleMiniGameKeyUp = (event: KeyboardEvent): void => {
    const wasHeld = this.heldMiniGameKeys.delete(event.code || event.key);
    if (!this.pendingEditorRestore) return;
    if (wasHeld) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (this.heldMiniGameKeys.size === 0) {
      requestAnimationFrame(() => this.completeMiniGameReturnWhenKeysAreReleased());
    }
  };

  private readonly handleMiniGameWindowBlur = (): void => {
    this.heldMiniGameKeys.clear();
    if (this.pendingEditorRestore) {
      requestAnimationFrame(() => this.completeMiniGameReturnWhenKeysAreReleased());
    }
  };

  private completeMiniGameReturnWhenKeysAreReleased(): void {
    if (
      !this.pendingEditorRestore
      || this.heldMiniGameKeys.size > 0
      || hasPhysicallyHeldMiniGameKeys()
      || this.state.phase !== 'compose'
    ) return;
    this.pendingEditorRestore = false;
    this.removeMiniGameInputShield();
    this.restoreEditorSnapshot();
    if (this.state.interruptionStarted && !document.hidden) {
      this.scheduler.resumeWithFreshInterval();
    }
  }

  private ensureMiniGameHost(): void {
    if (this.miniGameHost) return;
    const layer = document.querySelector<HTMLElement>('#phaser-layer');
    if (!layer) throw new Error('Missing Phaser layer');
    this.miniGameHost = new MiniGameHost(layer, {
      entrance: (id) => this.audio.miniGameEntrance(id),
      countdown: () => this.audio.countdown(),
      success: () => this.audio.success(),
      timeout: () => this.audio.timeout(),
    });
  }

  private restoreEditorSnapshot(): void {
    if (!this.editor) return;
    const snapshot = this.state.snapshot;
    if (this.editor.value !== snapshot.text) this.editor.value = snapshot.text;
    this.editor.focus({ preventScroll: true });
    this.editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    this.editor.scrollTop = snapshot.scrollTop;
    this.editor.scrollLeft = snapshot.scrollLeft;
  }

  private sendEmail(): void {
    if (this.state.phase !== 'compose' || !this.editor) return;
    this.state.draft = this.editor.value;
    this.state.wordCount = countWords(this.state.draft);
    if (!canSend(this.state.draft)) return;
    this.captureEditorPosition();
    this.state.finalReply = selectFinalReply(this.requireScenario(), this.state.draft);
    this.state.phase = 'inbox';
    this.scheduler.stop();
    this.detachEditor();
    this.audio.send();
    this.state.inboxMessages = [...INBOX_MESSAGES];
    this.view.renderInbox(this.state.inboxMessages, this.audio.isMuted);
    this.startInboxTimer();
  }

  private startInboxTimer(): void {
    this.clearInboxTimer();
    this.inboxRemaining = REPLY_DELAY_MS;
    this.inboxLastTick = performance.now();
    const tick = (): void => {
      if (this.state.phase !== 'inbox' || this.state.recipientReplyArrived) return;
      const now = performance.now();
      if (!document.hidden) this.inboxRemaining -= now - this.inboxLastTick;
      this.inboxLastTick = now;
      if (this.inboxRemaining <= 0) {
        this.deliverRecipientReply();
        return;
      }
      this.inboxTimer = setTimeout(tick, Math.min(125, this.inboxRemaining));
    };
    this.inboxTimer = setTimeout(tick, 100);
  }

  private deliverRecipientReply(): void {
    if (this.state.phase !== 'inbox' || this.state.recipientReplyArrived) return;
    this.clearInboxTimer();
    this.state.recipientReplyArrived = true;
    const scenario = this.requireScenario();
    const replyMessage: InboxMessage = {
      id: 'recipient-reply',
      sender: scenario.senderName,
      subject: `Re: ${scenario.subject}`,
      time: 'Now',
      unread: true,
    };
    this.state.inboxMessages = [replyMessage, ...this.state.inboxMessages];
    this.view.insertRecipientReply(replyMessage);
    this.audio.newMessage();
  }

  private openRecipientReply(): void {
    if (this.state.phase !== 'inbox' || !this.state.recipientReplyArrived) return;
    this.state.phase = 'reply';
    this.renderFinalReply();
  }

  private renderFinalReply(): void {
    this.state.phase = 'reply';
    this.view.renderReply(this.requireScenario(), this.state.finalReply, this.audio.isMuted);
  }

  private viewSentEmail(): void {
    if (this.state.phase !== 'reply') return;
    this.state.phase = 'sent';
    this.view.renderSentEmail(this.requireScenario(), this.state.draft, this.audio.isMuted);
  }

  private toggleMute(): void {
    const muted = this.audio.toggleMute();
    this.view.updateMuteButton(muted);
  }

  private clearInboxTimer(): void {
    if (this.inboxTimer !== null) clearTimeout(this.inboxTimer);
    this.inboxTimer = null;
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.state.phase === 'inbox') {
      this.inboxLastTick = performance.now();
      return;
    }
    if (this.state.phase !== 'compose' || !this.state.interruptionStarted) return;
    if (document.hidden) this.scheduler.pause();
    else this.scheduler.resumeWithFreshInterval();
  };

  private requireScenario(): EmailScenario {
    if (!this.state.scenario) throw new Error('No email scenario selected');
    return this.state.scenario;
  }

  private freshState(): ApplicationState {
    return {
      phase: 'title',
      scenario: null,
      draft: '',
      wordCount: 0,
      snapshot: { text: '', selectionStart: 0, selectionEnd: 0, scrollTop: 0, scrollLeft: 0 },
      interruptionStarted: false,
      miniGameHistory: [],
      activeMiniGame: null,
      inboxMessages: [],
      finalReply: '',
      recipientReplyArrived: false,
    };
  }

  private createRandomSource(): RandomSource {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('test') === '1') {
        return new SeededRandom(params.get('seed') ?? 'one-quick-email-test');
      }
    }
    return Math.random;
  }

  private readLastScenarioId(): string | null {
    try {
      return sessionStorage.getItem(LAST_SCENARIO_KEY);
    } catch {
      return null;
    }
  }

  private writeLastScenarioId(id: string): void {
    try {
      sessionStorage.setItem(LAST_SCENARIO_KEY, id);
    } catch {
      // The selection remains valid for this playthrough when storage is unavailable.
    }
  }

  private installDevelopmentHooks(): void {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('test') !== '1') return;
    window.__ONE_QUICK_EMAIL_TEST__ = {
      forceInterruption: (id) => this.startMiniGame(id),
      completeMiniGame: (outcome = 'success') => this.miniGameHost?.forceComplete(outcome),
      setDraft: (text, caret = text.length) => {
        if (this.state.phase !== 'compose' || !this.editor) return;
        this.editor.value = text;
        this.state.draft = text;
        this.state.wordCount = countWords(text);
        this.editor.setSelectionRange(caret, caret);
        this.captureEditorPosition();
        this.view.updateComposeStatus(this.state.wordCount);
      },
      skipInboxDelay: () => this.deliverRecipientReply(),
      getState: () => ({
        phase: this.state.phase,
        draft: this.state.draft,
        scenarioId: this.state.scenario?.id ?? null,
        activeMiniGame: this.state.activeMiniGame,
      }),
    };
  }
}
