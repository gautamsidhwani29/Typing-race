import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import UsernameScreen from './components/UsernameScreen';
import Lobby from './components/Lobby';
import FindingMatch from './components/FindingMatch';
import CountdownOverlay from './components/CountdownOverlay';
import GameOver from './components/GameOver';
import TypingRace from './games/TypingRace';
import TriviaBattle from './games/TriviaBattle';
import MathSprint from './games/MathSprint';
import MinesweeperRace from './games/MinesweeperRace';
import {
  AppPhase, GameType, QueueCounts, GameOverResult,
  TypingGameData, TriviaGameData, MathGameData, MinesweeperGameData,
} from './types';
import './App.css';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const socketRef = useRef<Socket | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<AppPhase>('username');
  const [username, setUsername] = useState('');
  const [queueCounts, setQueueCounts] = useState<QueueCounts>({ typing: 0, trivia: 0, math: 0, minesweeper: 0 });
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [matchId, setMatchId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [gameData, setGameData] = useState<any>(null);
  const [gameResult, setGameResult] = useState<GameOverResult | null>(null);
  const [myId, setMyId] = useState('');

  // ── Socket — created once, never recreated ─────────────────────────────────
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    // socket.id is available after 'connect'
    socket.on('connect', () => {
      setMyId(socket.id ?? '');
    });

    socket.on('queue_counts', (counts: QueueCounts) => {
      setQueueCounts(counts);
    });

    socket.on('match_found', ({ matchId: mid, gameType, opponent: opp }: {
      matchId: string; gameType: GameType; opponent: string;
    }) => {
      setMatchId(mid);
      setSelectedGame(gameType);
      setOpponent(opp);
      // Don't set phase here — wait for the first countdown tick
      // so the countdown value is already set before we render the overlay
    });

    socket.on('countdown', ({ count }: { count: number }) => {
      setCountdown(count);
      // Transition to countdown phase on first tick (count === 3)
      setPhase((prev) => (prev === 'finding' || prev === 'countdown') ? 'countdown' : prev);
    });

    socket.on('game_start', ({ gameData: gd }: { gameData: any }) => {
      setGameData(gd);
      setPhase('playing');
    });

    socket.on('game_over', (result: GameOverResult) => {
      setGameResult(result);
      setPhase('gameover');
    });

    socket.on('opponent_disconnected', () => {
      // Use functional update so we always have the latest socket.id
      setMyId((id) => {
        setGameResult({
          winnerId: id,
          winnerName: '',   // filled below
          players: [],
        });
        return id;
      });
      setUsername((name) => {
        setGameResult((prev) => prev ? { ...prev, winnerName: name } : prev);
        return name;
      });
      setPhase('gameover');
    });

    return () => {
      socket.disconnect();
    };
  }, []); // ← empty deps: socket is created exactly once

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUsernameSubmit = useCallback((name: string) => {
    setUsername(name);
    // Emit on the already-connected socket
    socketRef.current?.emit('set_username', { username: name });
    setPhase('lobby');
  }, []);

  const handlePlayGame = useCallback((gameType: GameType) => {
    setSelectedGame(gameType);
    setCountdown(3); // reset so overlay doesn't flash stale number
    socketRef.current?.emit('join_queue', { gameType });
    setPhase('finding');
  }, []);

  const handleCancelSearch = useCallback(() => {
    socketRef.current?.emit('leave_queue');
    setSelectedGame(null);
    setPhase('lobby');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameResult(null);
    setGameData(null);
    setMatchId('');
    setOpponent('');
    setCountdown(3);
    setPhase('lobby');
  }, []);

  const socket = socketRef.current;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {phase === 'username' && (
        <UsernameScreen onSubmit={handleUsernameSubmit} />
      )}

      {phase === 'lobby' && (
        <Lobby
          username={username}
          queueCounts={queueCounts}
          onPlay={handlePlayGame}
        />
      )}

      {phase === 'finding' && selectedGame && (
        <FindingMatch
          gameType={selectedGame}
          onCancel={handleCancelSearch}
        />
      )}

      {phase === 'countdown' && selectedGame && (
        <CountdownOverlay
          count={countdown}
          gameType={selectedGame}
          opponent={opponent}
        />
      )}

      {phase === 'playing' && selectedGame && socket && gameData && (
        <>
          {selectedGame === 'typing' && (
            <TypingRace
              socket={socket}
              matchId={matchId}
              myId={myId}
              username={username}
              opponent={opponent}
              gameData={gameData as TypingGameData}
            />
          )}
          {selectedGame === 'trivia' && (
            <TriviaBattle
              socket={socket}
              matchId={matchId}
              myId={myId}
              username={username}
              opponent={opponent}
              gameData={gameData as TriviaGameData}
            />
          )}
          {selectedGame === 'math' && (
            <MathSprint
              socket={socket}
              matchId={matchId}
              myId={myId}
              username={username}
              opponent={opponent}
              gameData={gameData as MathGameData}
            />
          )}
          {selectedGame === 'minesweeper' && (
            <MinesweeperRace
              socket={socket}
              matchId={matchId}
              myId={myId}
              username={username}
              opponent={opponent}
              gameData={gameData as MinesweeperGameData}
            />
          )}
        </>
      )}

      {phase === 'gameover' && gameResult && (
        <GameOver
          result={gameResult}
          myId={myId}
          username={username}
          gameType={selectedGame}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
