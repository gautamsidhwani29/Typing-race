import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { TypingGameData } from '../types';
import GameHeader from '../components/GameHeader';
import './TypingRace.css';

interface Props {
  socket: Socket;
  matchId: string;
  myId: string;
  username: string;
  opponent: string;
  gameData: TypingGameData;
}

interface PlayerState {
  id: string;
  username: string;
  score: number;
  finished: boolean;
}

export default function TypingRace({ socket, myId, username, opponent, gameData }: Props) {
  const [typed, setTyped] = useState('');
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [finished, setFinished] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(gameData.duration);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const keystrokesRef = useRef({ total: 0, correct: 0 });
  const startTimeRef = useRef(Date.now());
  const lastUpdateRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { paragraph } = gameData;
  const timeUp = timeRemaining <= 0;

  useEffect(() => {
    startTimeRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 100);

    socket.on('typing_update', ({ players: ps }) => setPlayers(ps));
    socket.on('typing_timer', ({ remaining }) => setTimeRemaining(remaining));

    return () => {
      socket.off('typing_update');
      socket.off('typing_timer');
    };
  }, [socket]);

  const calcWpm = useCallback((text: string) => {
    const elapsed = (Date.now() - startTimeRef.current) / 60000;
    if (elapsed < 0.01) return 0;
    return Math.round(text.trim().split(/\s+/).filter(Boolean).length / elapsed);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (finished || timeUp) return;
    const value = e.target.value;
    if (value.length > paragraph.length) return;

    if (value.length > typed.length) {
      keystrokesRef.current.total++;
      if (value[value.length - 1] === paragraph[value.length - 1]) {
        keystrokesRef.current.correct++;
      }
    }

    setTyped(value);
    const progress = Math.round((value.length / paragraph.length) * 100);
    const currentWpm = calcWpm(value);
    const currentAcc = keystrokesRef.current.total === 0
      ? 100
      : Math.round((keystrokesRef.current.correct / keystrokesRef.current.total) * 100);

    setWpm(currentWpm);
    setAccuracy(currentAcc);

    const isDone = value === paragraph;
    const now = Date.now();
    if (now - lastUpdateRef.current > 100 || isDone) {
      lastUpdateRef.current = now;
      socket.emit('typing_progress', { progress, wpm: currentWpm, accuracy: currentAcc, finished: isDone });
    }
    if (isDone) setFinished(true);
  }, [finished, timeUp, typed, paragraph, calcWpm, socket]);

  const opp = players.find((p) => p.id !== myId);
  const myProgress = Math.round((typed.length / paragraph.length) * 100);
  const oppProgress = opp ? Math.round((opp.score / 100) * 100) : 0;

  const timerColor = timeRemaining > 15 ? 'var(--green)' : timeRemaining > 8 ? 'var(--accent)' : 'var(--red)';

  return (
    <div className="typing-race">
      <GameHeader
        title="Typing Race"
        myName={username}
        myScore={`${wpm} WPM`}
        oppName={opponent}
        oppScore={`${opp?.score ?? 0} WPM`}
        extra={
          <div className="typing-race__timer" style={{ color: timerColor }}>
            {timeRemaining}s
          </div>
        }
      />

      <div className="typing-race__progress-section nes-container is-dark with-title">
        <p className="title">Progress</p>
        <ProgressBar label={username} progress={myProgress} type="is-success" />
        <ProgressBar label={opponent} progress={oppProgress} type="is-primary" />
      </div>

      <div
        className={`typing-race__textbox nes-container is-dark ${timeUp || finished ? 'typing-race__textbox--disabled' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <p className="typing-race__paragraph">
          {paragraph.split('').map((char, i) => {
            let cls = 'tc';
            if (i < typed.length) cls += typed[i] === char ? ' tc--ok' : ' tc--err';
            else if (i === typed.length && !timeUp && !finished) cls += ' tc--cursor';
            return <span key={i} className={cls}>{char}</span>;
          })}
        </p>
      </div>

      <input
        ref={inputRef}
        className="typing-race__input"
        value={typed}
        onChange={handleInput}
        disabled={finished || timeUp}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type here"
      />

      <div className="typing-race__stats">
        <span>WPM: <span className="nes-text is-warning">{wpm}</span></span>
        <span>ACC: <span className="nes-text is-warning">{accuracy}%</span></span>
      </div>

      {finished && <div className="typing-race__banner nes-text is-success">✓ Mission Complete!</div>}
      {timeUp && !finished && <div className="typing-race__banner nes-text is-error">⏱ Time Expired!</div>}
    </div>
  );
}

function ProgressBar({ label, progress, type }: { label: string; progress: number; type: string }) {
  return (
    <div className="typing-pb">
      <div className="typing-pb__meta">
        <span className="typing-pb__label">{label}</span>
        <span className="typing-pb__pct">{progress}%</span>
      </div>
      <progress className={`nes-progress ${type}`} value={progress} max="100"></progress>
    </div>
  );
}
