export type GamePhase = 'title' | 'compose' | 'minigame' | 'inbox';

export type MiniGameId =
  | 'calendar-collision'
  | 'reply-all-intercept'
  | 'paper-jam'
  | 'hold-music-hero'
  | 'stamp-of-approval'
  | 'expense-triage'
  | 'quick-question'
  | 'phone-transfer'
  | 'badge-scan'
  | 'attachment-hunt';

export type MiniGameOutcome = 'success' | 'timeout';

export interface EmailScenario {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  body: readonly string[];
}

export interface DraftSnapshot {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface InboxMessage {
  id: string;
  sender: string;
  subject: string;
  time: string;
  unread: boolean;
}

export interface TestHooks {
  forceInterruption?: (id?: MiniGameId) => void;
  completeMiniGame?: (outcome?: MiniGameOutcome) => void;
  setDraft?: (text: string, caret?: number) => void;
  skipInboxDelay?: () => void;
  getState?: () => Readonly<{
    phase: GamePhase;
    draft: string;
    scenarioId: string | null;
    activeMiniGame: MiniGameId | null;
  }>;
}

declare global {
  interface Window {
    __ONE_QUICK_EMAIL_TEST__?: TestHooks;
  }
}
