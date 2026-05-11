import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finishTime: number | null;
}

interface Room {
  code: string;
  paragraph: string;
  players: Record<string, Player>;
  started: boolean;
  ended: boolean;
  startTime: number | null;
  roundTimer: ReturnType<typeof setInterval> | null;
  rematchVotes: Set<string>;
}

interface PublicRoom {
  code: string;
  paragraph: string;
  started: boolean;
  players: Player[];
}

interface WinResult {
  winnerId: string | null;
  winnerName: string | null;
  reason: 'wpm' | 'accuracy' | 'draw';
  isDraw: boolean;
}

// ── Socket event maps ─────────────────────────────────────────────────────────

interface ClientToServerEvents {
  create_room: (data: { playerName: string }) => void;
  join_room: (data: { roomCode: string; playerName: string }) => void;
  progress_update: (data: {
    progress: number;
    wpm: number;
    accuracy: number;
    finished: boolean;
  }) => void;
  rematch_vote: () => void;
}

interface ServerToClientEvents {
  room_joined: (data: { room: PublicRoom; playerId: string }) => void;
  countdown: (data: { count: number }) => void;
  race_start: (data: { startTime: number; paragraph: string; duration: number }) => void;
  timer_tick: (data: { remaining: number }) => void;
  room_update: (data: { players: Player[] }) => void;
  race_over: (data: WinResult & { players: Player[] }) => void;
  rematch_votes: (data: { count: number; total: number }) => void;
  rematch_start: (data: { room: PublicRoom }) => void;
  player_left: (data: { playerId: string }) => void;
  error: (data: { message: string }) => void;
}

interface SocketData {
  roomCode?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const ROUND_DURATION = 30; // seconds

// ── Paragraphs ────────────────────────────────────────────────────────────────

const PARAGRAPHS: string[] = [
  'The quick brown fox jumps over the lazy dog near the riverbank while the sun sets behind the mountains casting long shadows across the valley floor.',
  'Programming is the art of telling another human what one wants the computer to do. It requires patience, logic, and a deep understanding of how systems work together.',
  'In the middle of difficulty lies opportunity. Every challenge we face is a chance to grow stronger, think deeper, and emerge with a better understanding of ourselves.',
  'The universe is under no obligation to make sense to you. Science is not a collection of facts but a method of asking and answering questions about the natural world.',
  'Success is not final, failure is not fatal: it is the courage to continue that counts. Every step forward, no matter how small, brings you closer to your destination.',
  'Technology is best when it brings people together. The internet has connected billions of minds across the globe, enabling collaboration on a scale never before imagined.',
  'A journey of a thousand miles begins with a single step. The hardest part of any endeavor is simply starting, pushing past the inertia of comfort and routine.',
  'The only way to do great work is to love what you do. Find your passion, nurture it daily, and let it guide every decision you make in your professional life.',
];

// ── In-memory rooms ───────────────────────────────────────────────────────────

const rooms: Record<string, Room> = {};

function randomParagraph(): string {
  return PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function freshPlayer(id: string, name: string): Player {
  return { id, name, progress: 0, wpm: 0, accuracy: 100, finished: false, finishTime: null };
}

function getPublicRoom(room: Room): PublicRoom {
  return {
    code: room.code,
    paragraph: room.paragraph,
    started: room.started,
    players: Object.values(room.players),
  };
}

/**
 * Determine winner by WPM, tiebreak by accuracy.
 */
function determineWinner(players: Player[]): WinResult {
  const [a, b] = players;

  if (a.wpm > b.wpm) return { winnerId: a.id, winnerName: a.name, reason: 'wpm', isDraw: false };
  if (b.wpm > a.wpm) return { winnerId: b.id, winnerName: b.name, reason: 'wpm', isDraw: false };

  if (a.accuracy > b.accuracy)
    return { winnerId: a.id, winnerName: a.name, reason: 'accuracy', isDraw: false };
  if (b.accuracy > a.accuracy)
    return { winnerId: b.id, winnerName: b.name, reason: 'accuracy', isDraw: false };

  return { winnerId: null, winnerName: null, reason: 'draw', isDraw: true };
}

function endRound(code: string): void {
  const room = rooms[code];
  if (!room || room.ended) return;
  room.ended = true;

  if (room.roundTimer) {
    clearInterval(room.roundTimer);
    room.roundTimer = null;
  }

  const players = Object.values(room.players);
  const result = determineWinner(players);

  io.to(code).emit('race_over', { ...result, players });
  console.log(`Room ${code} round ended — winner: ${result.winnerName ?? 'DRAW'} (${result.reason})`);
}

function startRound(code: string): void {
  const room = rooms[code];
  if (!room) return;

  room.started = true;
  room.ended = false;
  room.startTime = Date.now();

  io.to(code).emit('race_start', {
    startTime: room.startTime,
    paragraph: room.paragraph,
    duration: ROUND_DURATION,
  });

  let remaining = ROUND_DURATION;
  room.roundTimer = setInterval(() => {
    remaining -= 1;
    io.to(code).emit('timer_tick', { remaining });
    if (remaining <= 0) {
      clearInterval(room.roundTimer!);
      room.roundTimer = null;
      endRound(code);
    }
  }, 1000);
}

function startCountdown(code: string): void {
  const room = rooms[code];
  if (!room) return;

  let countdown = 3;
  io.to(code).emit('countdown', { count: countdown });

  const interval = setInterval(() => {
    countdown -= 1;
    if (countdown > 0) {
      io.to(code).emit('countdown', { count: countdown });
    } else {
      clearInterval(interval);
      startRound(code);
    }
  }, 1000);
}

// ── Express + Socket.io setup ─────────────────────────────────────────────────

const app = express();
app.use(cors());

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: '*', methods: ['GET', 'POST'] } }
);

// ── Socket handlers ───────────────────────────────────────────────────────────

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>) => {
  console.log('connected:', socket.id);

  socket.on('create_room', ({ playerName }) => {
    const code = generateCode();
    rooms[code] = {
      code,
      paragraph: randomParagraph(),
      players: { [socket.id]: freshPlayer(socket.id, playerName || 'Player 1') },
      started: false,
      ended: false,
      startTime: null,
      roundTimer: null,
      rematchVotes: new Set(),
    };
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room_joined', { room: getPublicRoom(rooms[code]), playerId: socket.id });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) { socket.emit('error', { message: 'Room not found.' }); return; }
    if (Object.keys(room.players).length >= 2) { socket.emit('error', { message: 'Room is full.' }); return; }
    if (room.started) { socket.emit('error', { message: 'Race already in progress.' }); return; }

    room.players[socket.id] = freshPlayer(socket.id, playerName || 'Player 2');
    socket.join(code);
    socket.data.roomCode = code;

    io.to(code).emit('room_joined', { room: getPublicRoom(room), playerId: socket.id });

    if (Object.keys(room.players).length === 2) {
      startCountdown(code);
    }
  });

  socket.on('progress_update', ({ progress, wpm, accuracy, finished }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms[code];
    if (!room || !room.players[socket.id] || room.ended) return;

    const player = room.players[socket.id];
    player.progress = progress;
    player.wpm = wpm;
    player.accuracy = accuracy ?? player.accuracy;

    if (finished && !player.finished) {
      player.finished = true;
      player.finishTime = Date.now();
    }

    io.to(code).emit('room_update', { players: Object.values(room.players) });

    const allFinished = Object.values(room.players).every((p) => p.finished);
    if (allFinished) endRound(code);
  });

  socket.on('rematch_vote', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms[code];
    if (!room) return;

    room.rematchVotes.add(socket.id);
    io.to(code).emit('rematch_votes', {
      count: room.rematchVotes.size,
      total: Object.keys(room.players).length,
    });

    if (room.rematchVotes.size === Object.keys(room.players).length) {
      room.paragraph = randomParagraph();
      room.started = false;
      room.ended = false;
      room.startTime = null;
      room.rematchVotes = new Set();
      if (room.roundTimer) { clearInterval(room.roundTimer); room.roundTimer = null; }
      Object.values(room.players).forEach((p) => {
        p.progress = 0; p.wpm = 0; p.accuracy = 100; p.finished = false; p.finishTime = null;
      });

      io.to(code).emit('rematch_start', { room: getPublicRoom(room) });
      startCountdown(code);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    delete room.players[socket.id];

    if (Object.keys(room.players).length === 0) {
      if (room.roundTimer) clearInterval(room.roundTimer);
      delete rooms[code];
      console.log(`Room ${code} deleted`);
    } else {
      io.to(code).emit('player_left', { playerId: socket.id });
      io.to(code).emit('room_update', { players: Object.values(room.players) });
    }
    console.log('disconnected:', socket.id);
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
