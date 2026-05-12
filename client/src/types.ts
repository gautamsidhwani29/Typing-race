export type GameType = 'typing' | 'trivia' | 'math' | 'minesweeper';

export type AppPhase =
  | 'username'
  | 'lobby'
  | 'finding'
  | 'countdown'
  | 'playing'
  | 'gameover';

export interface GamePlayer {
  id: string;
  username: string;
  score: number;
  finished: boolean;
}

export interface GameOverResult {
  winnerId: string;
  winnerName: string;
  players: GamePlayer[];
}

export interface QueueCounts {
  typing: number;
  trivia: number;
  math: number;
  minesweeper: number;
}

// Typing Race
export interface TypingGameData {
  paragraph: string;
  duration: number;
}

export interface TypingProgressUpdate {
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
}

// Trivia
export interface TriviaGameData {
  questions: TriviaQuestion[];
  currentQuestion: number;
}

export interface TriviaQuestion {
  question: string;
  correct: string;
  options: string[];
}

// Math
export interface MathGameData {
  problems: MathProblem[];
  currentProblem: number;
}

export interface MathProblem {
  problem: string;
  answer: number;
}

// Minesweeper
export interface MinesweeperGameData {
  board: boolean[][];
  size: number;
  mineCount: number;
}
