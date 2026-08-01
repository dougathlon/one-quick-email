import type { MiniGameId, MiniGameOutcome } from '../game/types';
import type { MiniGameSafeAreaInsets } from './layout';

export interface MiniGameAudioCallbacks {
  entrance(id: MiniGameId): void;
  countdown(): void;
  success(): void;
  timeout(): void;
}

export interface MiniGameDefinition {
  readonly id: MiniGameId;
  readonly sceneKey: string;
  readonly title: string;
  readonly instruction: string;
  readonly durationMs: number;
  readonly theme: MiniGameVisualTheme;
}

export type MiniGameBackdrop =
  | 'planner'
  | 'terminal'
  | 'xerox'
  | 'neon'
  | 'dossier'
  | 'ledger'
  | 'geometric'
  | 'switchboard'
  | 'security'
  | 'desktop';

export interface MiniGameVisualTheme {
  readonly background: number;
  readonly surface: number;
  readonly ink: number;
  readonly accent: number;
  readonly secondary: number;
  readonly backdrop: MiniGameBackdrop;
  readonly fontFamily: string;
  readonly cabinetLabel: string;
}

export interface MiniGameSceneData {
  readonly audio: MiniGameAudioCallbacks;
  readonly onComplete: (outcome: MiniGameOutcome) => void;
  readonly safeAreaInsets: MiniGameSafeAreaInsets;
}
