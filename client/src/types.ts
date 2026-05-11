// ── Shared domain types ───────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finishTime: number | null;
}

export interface PublicRoom {
  code: string;
  paragraph: string;
  started: boolean;
  players: Player[];
}

export type WinReason = 'wpm' | 'accuracy' | 'draw';

export interface RaceResult {
  winnerId: string | null;
  winnerName: string | null;
  reason: WinReason;
  isDraw: boolean;
  players: Player[];
}

export interface RematchVotes {
  count: number;
  total: number;
}

export type Phase = 'lobby' | 'waiting' | 'countdown' | 'racing' | 'finished';

export interface ProgressUpdate {
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
}
