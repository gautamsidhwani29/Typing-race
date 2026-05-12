import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import axios from 'axios';

// ── Types ─────────────────────────────────────────────────────────────────────

type GameType = 'typing' | 'trivia' | 'math' | 'minesweeper';

interface QueuedPlayer {
  socketId: string;
  username: string;
  gameType: GameType;
}

interface MatchPlayer {
  id: string;
  username: string;
  score: number;
  finished: boolean;
}

interface Match {
  matchId: string;
  gameType: GameType;
  players: Record<string, MatchPlayer>;
  gameData: any;
  started: boolean;
  ended: boolean;
}

interface ClientToServerEvents {
  set_username:       (data: { username: string }) => void;
  join_queue:         (data: { gameType: GameType }) => void;
  leave_queue:        () => void;
  typing_progress:    (data: { progress: number; wpm: number; accuracy: number; finished: boolean }) => void;
  trivia_answer:      (data: { questionIndex: number; answer: string }) => void;
  math_answer:        (data: { questionIndex: number; answer: number }) => void;
  minesweeper_reveal: (data: { row: number; col: number }) => void;
  minesweeper_flag:   (data: { row: number; col: number }) => void;
}

interface MathQuestionResult {
  questionIndex: number;
  winnerId: string | null;   // null = tie or both wrong
  scores: Record<string, number>; // socketId → points earned this question
  correctIds: string[];           // who answered correctly
}

interface ServerToClientEvents {
  queue_counts:          (data: { typing: number; trivia: number; math: number; minesweeper: number }) => void;
  match_found:           (data: { matchId: string; gameType: GameType; opponent: string }) => void;
  countdown:             (data: { count: number }) => void;
  game_start:            (data: { gameData: any }) => void;
  opponent_disconnected: () => void;
  typing_update:         (data: { players: MatchPlayer[] }) => void;
  typing_timer:          (data: { remaining: number }) => void;
  trivia_question:       (data: { questionIndex: number; question: string; options: string[]; timeLimit: number }) => void;
  trivia_answer_result:  (data: { playerId: string; correct: boolean }) => void;
  trivia_scores:         (data: { players: MatchPlayer[] }) => void;
  // Math — all 5 questions sent at once; server resolves each after both answer or timeout
  math_problem:          (data: { problemIndex: number; problem: string; timeLimit: number }) => void;
  math_question_result:  (data: MathQuestionResult & { players: MatchPlayer[] }) => void;
  math_time_up:          (data: { questionIndex: number; players: MatchPlayer[] }) => void;
  minesweeper_update:    (data: { playerId: string; revealedCount: number; hitMine: boolean }) => void;
  minesweeper_progress:  (data: { players: MatchPlayer[] }) => void;
  game_over:             (data: { winnerId: string; winnerName: string; players: MatchPlayer[] }) => void;
  error:                 (data: { message: string }) => void;
}

interface SocketData {
  username?: string;
  matchId?: string;
  gameType?: GameType;
}

// ── In-memory state ───────────────────────────────────────────────────────────

const queues: Record<GameType, QueuedPlayer[]> = {
  typing: [], trivia: [], math: [], minesweeper: [],
};

// Track which games are currently being set up to prevent double-matching
const matchingInProgress = new Set<GameType>();

const matches: Record<string, Match> = {};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateMatchId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getQueueCounts() {
  return {
    typing:      queues.typing.length,
    trivia:      queues.trivia.length,
    math:        queues.math.length,
    minesweeper: queues.minesweeper.length,
  };
}

function removeFromAllQueues(socketId: string) {
  for (const gt of Object.keys(queues) as GameType[]) {
    queues[gt] = queues[gt].filter((p) => p.socketId !== socketId);
  }
}

// ── Game data generators ──────────────────────────────────────────────────────

const TYPING_PARAGRAPHS = [
  'The quick brown fox jumps over the lazy dog near the riverbank while the sun sets behind the mountains casting long shadows across the valley floor.',
  'Programming is the art of telling another human what one wants the computer to do. It requires patience, logic, and a deep understanding of how systems work together.',
  'In the middle of difficulty lies opportunity. Every challenge we face is a chance to grow stronger, think deeper, and emerge with a better understanding of ourselves.',
  'Technology is best when it brings people together. The internet has connected billions of minds across the globe, enabling collaboration on a scale never before imagined.',
  'Success is not final, failure is not fatal: it is the courage to continue that counts. Every step forward, no matter how small, brings you closer to your destination.',
];

function generateTypingData() {
  return {
    paragraph: TYPING_PARAGRAPHS[Math.floor(Math.random() * TYPING_PARAGRAPHS.length)],
    duration: 30,
  };
}

async function generateTriviaData() {
  try {
    const res = await axios.get(
      'https://opentdb.com/api.php?amount=10&type=multiple',
      { timeout: 5000 }
    );
    const questions = res.data.results.map((q: any) => ({
      question: q.question,
      correct:  q.correct_answer,
      options:  [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
    }));
    return { questions, currentQuestion: 0 };
  } catch {
    // Fallback so the game still works offline
    return {
      questions: [
        { question: 'What is the capital of France?',    correct: 'Paris',    options: ['London', 'Berlin', 'Paris', 'Madrid'] },
        { question: 'How many sides does a hexagon have?', correct: '6',      options: ['5', '6', '7', '8'] },
        { question: 'What is 7 × 8?',                    correct: '56',       options: ['48', '54', '56', '64'] },
        { question: 'Which planet is closest to the Sun?', correct: 'Mercury', options: ['Venus', 'Earth', 'Mercury', 'Mars'] },
        { question: 'What is the chemical symbol for water?', correct: 'H₂O', options: ['CO₂', 'H₂O', 'O₂', 'NaCl'] },
      ],
      currentQuestion: 0,
    };
  }
}

const MATH_QUESTION_COUNT = 5;
const MATH_TIME_PER_Q    = 15; // seconds per question

function generateMathData() {
  const questions: { problem: string; answer: number }[] = [];
  for (let i = 0; i < MATH_QUESTION_COUNT; i++) {
    const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
    let problem: string, answer: number;
    if (op === '*') {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = Math.floor(Math.random() * 12) + 1;
      problem = `${a} × ${b}`;
      answer  = a * b;
    } else if (op === '+') {
      const a = Math.floor(Math.random() * 99) + 1;
      const b = Math.floor(Math.random() * 99) + 1;
      problem = `${a} + ${b}`;
      answer  = a + b;
    } else {
      const a = Math.floor(Math.random() * 99) + 1;
      const b = Math.floor(Math.random() * a) + 1;
      problem = `${a} - ${b}`;
      answer  = a - b;
    }
    questions.push({ problem, answer });
  }
  return { questions, timePerQuestion: MATH_TIME_PER_Q };
}

function generateMinesweeperData() {
  const size = 10, mineCount = 15;
  const board: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (!board[r][c]) { board[r][c] = true; placed++; }
  }
  return { board, size, mineCount };
}

// ── Matchmaking ───────────────────────────────────────────────────────────────

/**
 * Try to pair two players from the queue.
 * Uses a lock per game type to prevent concurrent async calls from
 * double-consuming the same players.
 */
async function tryMatch(gameType: GameType): Promise<void> {
  // Prevent re-entrant calls while we await trivia fetch
  if (matchingInProgress.has(gameType)) return;
  if (queues[gameType].length < 2) return;

  matchingInProgress.add(gameType);
  try {
    // Re-check after acquiring lock
    if (queues[gameType].length < 2) return;

    const [p1, p2] = queues[gameType].splice(0, 2);
    const matchId  = generateMatchId();

    // Generate game data (may be async for trivia)
    let gameData: any;
    if (gameType === 'typing')      gameData = generateTypingData();
    else if (gameType === 'trivia') gameData = await generateTriviaData();
    else if (gameType === 'math')   gameData = generateMathData();
    else                            gameData = generateMinesweeperData();

    // Verify both sockets are still connected
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);

    if (!s1 || !s2) {
      // One player disconnected while we were fetching — put the live one back
      if (s1) queues[gameType].unshift(p1);
      if (s2) queues[gameType].unshift(p2);
      console.log(`Match aborted — a player disconnected during setup (${gameType})`);
      return;
    }

    matches[matchId] = {
      matchId,
      gameType,
      players: {
        [p1.socketId]: { id: p1.socketId, username: p1.username, score: 0, finished: false },
        [p2.socketId]: { id: p2.socketId, username: p2.username, score: 0, finished: false },
      },
      gameData,
      started: false,
      ended:   false,
    };

    // Attach match metadata to sockets
    s1.data.matchId   = matchId;
    s1.data.gameType  = gameType;
    s2.data.matchId   = matchId;
    s2.data.gameType  = gameType;

    s1.join(matchId);
    s2.join(matchId);

    console.log(`Match ${matchId}: ${p1.username} vs ${p2.username} (${gameType})`);

    // Tell each player who they're facing
    s1.emit('match_found', { matchId, gameType, opponent: p2.username });
    s2.emit('match_found', { matchId, gameType, opponent: p1.username });

    // Countdown: 3 → 2 → 1 → game_start
    // Delay the first tick slightly so clients have time to handle match_found
    let count = 3;
    const sendTick = () => {
      io.to(matchId).emit('countdown', { count });
      if (count > 1) {
        count--;
        setTimeout(sendTick, 1000);
      } else {
        // count === 1 was just sent; wait 1 more second then start
        setTimeout(() => {
          if (!matches[matchId]) return; // match was cleaned up (disconnect)
          matches[matchId].started = true;
          io.to(matchId).emit('game_start', { gameData });

          if (gameType === 'typing')      startTypingGame(matchId);
          else if (gameType === 'trivia') startTriviaGame(matchId);
          else if (gameType === 'math')   startMathGame(matchId);
          // minesweeper is fully client-driven; server just reacts to reveals
        }, 1000);
      }
    };
    // Small initial delay so match_found is processed first
    setTimeout(sendTick, 200);

  } finally {
    matchingInProgress.delete(gameType);
    // If more players queued up while we were busy, try again
    if (queues[gameType].length >= 2) tryMatch(gameType);
  }
}

// ── Game engines ──────────────────────────────────────────────────────────────

function startTypingGame(matchId: string) {
  const match = matches[matchId];
  if (!match) return;

  let remaining = match.gameData.duration as number;
  const timer = setInterval(() => {
    if (!matches[matchId]) { clearInterval(timer); return; }
    remaining--;
    io.to(matchId).emit('typing_timer', { remaining });
    if (remaining <= 0) {
      clearInterval(timer);
      endTypingGame(matchId);
    }
  }, 1000);
}

function endTypingGame(matchId: string) {
  const match = matches[matchId];
  if (!match || match.ended) return;
  match.ended = true;

  const players = Object.values(match.players);
  // Highest WPM wins; tie → both get same score so pick first
  const winner = players.reduce((a, b) => (a.score >= b.score ? a : b));
  io.to(matchId).emit('game_over', { winnerId: winner.id, winnerName: winner.username, players });
}

function startTriviaGame(matchId: string) {
  sendNextTriviaQuestion(matchId);
}

// Per-match answer tracking: questionIndex → Set of socketIds that answered
const triviaAnswered: Record<string, Record<number, Set<string>>> = {};

function sendNextTriviaQuestion(matchId: string) {
  const match = matches[matchId];
  if (!match || match.ended) return;

  const { questions, currentQuestion } = match.gameData;
  if (currentQuestion >= questions.length) {
    endTriviaGame(matchId);
    return;
  }

  // Init answer tracker for this question
  if (!triviaAnswered[matchId]) triviaAnswered[matchId] = {};
  triviaAnswered[matchId][currentQuestion] = new Set();

  const q = questions[currentQuestion];
  io.to(matchId).emit('trivia_question', {
    questionIndex: currentQuestion,
    question:      q.question,
    options:       q.options,
    timeLimit:     15,
  });

  // Auto-advance after time limit even if no one answers
  setTimeout(() => {
    const m = matches[matchId];
    if (!m || m.ended) return;
    if (m.gameData.currentQuestion === currentQuestion) {
      m.gameData.currentQuestion++;
      sendNextTriviaQuestion(matchId);
    }
  }, 16000); // 15s + 1s buffer
}

function endTriviaGame(matchId: string) {
  const match = matches[matchId];
  if (!match || match.ended) return;
  match.ended = true;
  delete triviaAnswered[matchId];

  const players = Object.values(match.players);
  const winner  = players.reduce((a, b) => (a.score >= b.score ? a : b));
  io.to(matchId).emit('game_over', { winnerId: winner.id, winnerName: winner.username, players });
}

// Per-match math state
interface MathMatchState {
  currentQuestion: number;
  questionStartTime: number;
  // socketId → { answeredAt, correct }
  answers: Record<string, { answeredAt: number; correct: boolean } | null>;
  questionTimer: ReturnType<typeof setTimeout> | null;
  // per-player correct count (separate from score which is points)
  correctCount: Record<string, number>;
}
const mathState: Record<string, MathMatchState> = {};

function startMathGame(matchId: string) {
  const match = matches[matchId];
  if (!match) return;

  const playerIds = Object.keys(match.players);
  mathState[matchId] = {
    currentQuestion:   0,
    questionStartTime: Date.now(),
    answers:           Object.fromEntries(playerIds.map((id) => [id, null])),
    questionTimer:     null,
    correctCount:      Object.fromEntries(playerIds.map((id) => [id, 0])),
  };

  sendMathQuestion(matchId);
}

function sendMathQuestion(matchId: string) {
  const match = matches[matchId];
  const state = mathState[matchId];
  if (!match || !state || match.ended) return;

  const { questions, timePerQuestion } = match.gameData;
  const qi = state.currentQuestion;

  if (qi >= questions.length) {
    endMathGame(matchId);
    return;
  }

  // Reset answers for this question
  for (const id of Object.keys(state.answers)) state.answers[id] = null;
  state.questionStartTime = Date.now();

  // Broadcast the question to both players
  io.to(matchId).emit('math_problem', {
    problemIndex: qi,
    problem:      questions[qi].problem,
    timeLimit:    timePerQuestion,
  });

  // Auto-resolve after time limit
  state.questionTimer = setTimeout(() => {
    resolveMathQuestion(matchId, true);
  }, timePerQuestion * 1000);
}

function resolveMathQuestion(matchId: string, timedOut: boolean) {
  const match = matches[matchId];
  const state = mathState[matchId];
  if (!match || !state || match.ended) return;

  if (state.questionTimer) {
    clearTimeout(state.questionTimer);
    state.questionTimer = null;
  }

  const qi      = state.currentQuestion;
  const answers = state.answers;
  const players = Object.values(match.players);

  // Determine points for this question
  // Fastest correct → 2pts, slower correct → 1pt, wrong/no answer → 0pt
  const correct = players.filter((p) => answers[p.id]?.correct);

  const questionScores: Record<string, number> = {};
  for (const p of players) questionScores[p.id] = 0;

  if (correct.length === 2) {
    // Both correct — faster gets 2, slower gets 1
    const [faster, slower] = correct.sort(
      (a, b) => answers[a.id]!.answeredAt - answers[b.id]!.answeredAt
    );
    const timeDiff = answers[slower.id]!.answeredAt - answers[faster.id]!.answeredAt;
    if (timeDiff < 50) {
      // Essentially simultaneous — both get 1pt
      questionScores[faster.id] = 1;
      questionScores[slower.id] = 1;
    } else {
      questionScores[faster.id] = 2;
      questionScores[slower.id] = 1;
    }
  } else if (correct.length === 1) {
    questionScores[correct[0].id] = 2;
  }
  // wrong.length === 2 → both get 0

  // Apply scores and correct counts
  for (const p of players) {
    match.players[p.id].score += questionScores[p.id];
    if (answers[p.id]?.correct) state.correctCount[p.id]++;
  }

  const winnerId = correct.length === 1
    ? correct[0].id
    : correct.length === 2
      ? (questionScores[correct[0].id] > questionScores[correct[1].id]
          ? correct[0].id
          : questionScores[correct[1].id] > questionScores[correct[0].id]
            ? correct[1].id
            : null)
      : null;

  const resultPayload = {
    questionIndex: qi,
    winnerId,
    scores:     questionScores,
    correctIds: correct.map((p) => p.id),
    players:    Object.values(match.players),
  };

  if (timedOut) {
    io.to(matchId).emit('math_time_up', { questionIndex: qi, players: Object.values(match.players) });
  }
  io.to(matchId).emit('math_question_result', resultPayload);

  // Advance to next question after a short pause
  state.currentQuestion++;
  if (state.currentQuestion < match.gameData.questions.length) {
    setTimeout(() => sendMathQuestion(matchId), 2000);
  } else {
    setTimeout(() => endMathGame(matchId), 2000);
  }
}

function endMathGame(matchId: string) {
  const match = matches[matchId];
  const state = mathState[matchId];
  if (!match || match.ended) return;
  match.ended = true;

  const players = Object.values(match.players);

  // Primary: most points. Tiebreak: most correct answers.
  const [p1, p2] = players;
  let winner: MatchPlayer;

  if (p1.score > p2.score) {
    winner = p1;
  } else if (p2.score > p1.score) {
    winner = p2;
  } else {
    // Tiebreak by correct count
    const c1 = state?.correctCount[p1.id] ?? 0;
    const c2 = state?.correctCount[p2.id] ?? 0;
    winner = c1 >= c2 ? p1 : p2;
  }

  delete mathState[matchId];

  io.to(matchId).emit('game_over', {
    winnerId:   winner.id,
    winnerName: winner.username,
    players,
  });
}

// ── Express + Socket.io setup ─────────────────────────────────────────────────

const app = express();
app.use(cors());

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: '*', methods: ['GET', 'POST'] } }
);

// Broadcast live queue counts every 2 seconds
setInterval(() => io.emit('queue_counts', getQueueCounts()), 2000);

// ── Socket event handlers ─────────────────────────────────────────────────────

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>) => {
  console.log('connected:', socket.id);

  // Send current counts immediately on connect
  socket.emit('queue_counts', getQueueCounts());

  socket.on('set_username', ({ username }) => {
    socket.data.username = username.trim().slice(0, 20) || 'Player';
    console.log(`${socket.id} → username: ${socket.data.username}`);
  });

  socket.on('join_queue', ({ gameType }) => {
    const username = socket.data.username;
    if (!username) {
      socket.emit('error', { message: 'Set a username first.' });
      return;
    }

    // Remove from any existing queue first
    removeFromAllQueues(socket.id);

    queues[gameType].push({ socketId: socket.id, username, gameType });
    console.log(`Queue [${gameType}]: ${queues[gameType].map(p => p.username).join(', ')}`);

    tryMatch(gameType);
  });

  socket.on('leave_queue', () => {
    removeFromAllQueues(socket.id);
  });

  // ── Typing Race ─────────────────────────────────────────────────────────────

  socket.on('typing_progress', ({ wpm, finished }) => {
    const { matchId } = socket.data;
    if (!matchId) return;
    const match = matches[matchId];
    if (!match || match.ended || !match.players[socket.id]) return;

    match.players[socket.id].score    = wpm;
    match.players[socket.id].finished = finished;

    io.to(matchId).emit('typing_update', { players: Object.values(match.players) });

    if (Object.values(match.players).every((p) => p.finished)) {
      endTypingGame(matchId);
    }
  });

  // ── Trivia ──────────────────────────────────────────────────────────────────

  socket.on('trivia_answer', ({ questionIndex, answer }) => {
    const { matchId } = socket.data;
    if (!matchId) return;
    const match = matches[matchId];
    if (!match || match.ended || !match.players[socket.id]) return;

    // Ignore duplicate answers for the same question
    const answered = triviaAnswered[matchId]?.[questionIndex];
    if (!answered || answered.has(socket.id)) return;
    answered.add(socket.id);

    const q       = match.gameData.questions[questionIndex];
    const correct = answer === q.correct;
    if (correct) match.players[socket.id].score++;

    io.to(matchId).emit('trivia_answer_result', { playerId: socket.id, correct });
    io.to(matchId).emit('trivia_scores', { players: Object.values(match.players) });

    // Advance question once both players have answered
    const totalPlayers = Object.keys(match.players).length;
    if (answered.size >= totalPlayers) {
      match.gameData.currentQuestion++;
      setTimeout(() => sendNextTriviaQuestion(matchId), 1500);
    }
  });

  // ── Math Sprint ─────────────────────────────────────────────────────────────

  socket.on('math_answer', ({ questionIndex, answer }) => {
    const { matchId } = socket.data;
    if (!matchId) return;
    const match = matches[matchId];
    const state = mathState[matchId];
    if (!match || match.ended || !state || !match.players[socket.id]) return;

    // Only accept answer for the current active question
    if (questionIndex !== state.currentQuestion) return;

    // Only accept first answer per player per question
    if (state.answers[socket.id] !== null) return;

    const correct = answer === match.gameData.questions[questionIndex].answer;
    state.answers[socket.id] = { answeredAt: Date.now(), correct };

    // If both players have answered, resolve immediately
    const allAnswered = Object.values(state.answers).every((a) => a !== null);
    if (allAnswered) {
      resolveMathQuestion(matchId, false);
    }
  });

  // ── Minesweeper ─────────────────────────────────────────────────────────────

  socket.on('minesweeper_reveal', ({ row, col }) => {
    const { matchId } = socket.data;
    if (!matchId) return;
    const match = matches[matchId];
    if (!match || match.ended || !match.players[socket.id]) return;

    const hitMine  = match.gameData.board[row][col] as boolean;
    const player   = match.players[socket.id];
    const totalSafe = (match.gameData.size ** 2) - match.gameData.mineCount;

    if (hitMine) {
      player.finished = true;
      io.to(matchId).emit('minesweeper_update', {
        playerId: socket.id, revealedCount: player.score, hitMine: true,
      });

      if (!match.ended) {
        match.ended = true;
        const other = Object.values(match.players).find((p) => p.id !== socket.id);
        if (other) {
          io.to(matchId).emit('game_over', {
            winnerId: other.id, winnerName: other.username, players: Object.values(match.players),
          });
        }
      }
    } else {
      player.score++;
      io.to(matchId).emit('minesweeper_update', {
        playerId: socket.id, revealedCount: player.score, hitMine: false,
      });
      io.to(matchId).emit('minesweeper_progress', { players: Object.values(match.players) });

      if (player.score >= totalSafe && !match.ended) {
        match.ended = true;
        io.to(matchId).emit('game_over', {
          winnerId: socket.id, winnerName: player.username, players: Object.values(match.players),
        });
      }
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    removeFromAllQueues(socket.id);

    const { matchId } = socket.data;
    if (matchId && matches[matchId] && !matches[matchId].ended) {
      matches[matchId].ended = true;
      io.to(matchId).emit('opponent_disconnected');
      // Clean up game-specific state
      if (mathState[matchId]?.questionTimer) clearTimeout(mathState[matchId].questionTimer!);
      delete mathState[matchId];
      delete triviaAnswered[matchId];
      delete matches[matchId];
    }

    console.log('disconnected:', socket.id);
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
httpServer.listen(PORT, '0.0.0.0', () =>
  console.log(`🎮 Game server running on http://localhost:${PORT}`)
);
