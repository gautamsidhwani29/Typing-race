import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, PublicRoom, ProgressUpdate, Phase } from '../types';
import './Race.css';

interface RaceProps {
  paragraph: string;
  players: Player[];
  playerId: string | null;
  countdown: number | null;
  phase: Phase;
  onProgressUpdate: (data: ProgressUpdate) => void;
  room: PublicRoom | null;
  timeRemaining: number;
  roundDuration: number;
}

interface ProgressBarProps {
  label: string;
  progress: number;
  wpm: number;
  accuracy: number;
  isYou: boolean;
}

interface KeystrokeTracker {
  total: number;
  correct: number;
}

export default function Race({
  paragraph,
  players,
  playerId,
  countdown,
  phase,
  onProgressUpdate,
  room,
  timeRemaining,
  roundDuration,
}: RaceProps) {
  const [typed, setTyped] = useState<string>('');
  const [wpm, setWpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [finished, setFinished] = useState<boolean>(false);

  const keystrokesRef = useRef<KeystrokeTracker>({ total: 0, correct: 0 });
  const startTimeRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = players.find((p) => p.id === playerId);
  const opponent = players.find((p) => p.id !== playerId);
  const timeUp = phase === 'racing' && timeRemaining <= 0;

  useEffect(() => {
    if (phase === 'racing') {
      setTyped('');
      setWpm(0);
      setAccuracy(100);
      setFinished(false);
      keystrokesRef.current = { total: 0, correct: 0 };
      startTimeRef.current = Date.now();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

  const calcWpm = useCallback((typedText: string): number => {
    const start = startTimeRef.current;
    if (!start) return 0;
    const elapsed = (Date.now() - start) / 1000 / 60;
    if (elapsed < 0.01) return 0;
    const words = typedText.trim().split(/\s+/).filter(Boolean).length;
    return Math.round(words / elapsed);
  }, []);

  const calcAccuracy = useCallback((total: number, correct: number): number => {
    if (total === 0) return 100;
    return Math.round((correct / total) * 100);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (finished || phase !== 'racing' || timeUp) return;
      const value = e.target.value;
      if (value.length > paragraph.length) return;

      if (value.length > typed.length) {
        const newCharIndex = value.length - 1;
        keystrokesRef.current.total += 1;
        if (value[newCharIndex] === paragraph[newCharIndex]) {
          keystrokesRef.current.correct += 1;
        }
      }

      setTyped(value);

      const progress = Math.round((value.length / paragraph.length) * 100);
      const currentWpm = calcWpm(value);
      const currentAccuracy = calcAccuracy(
        keystrokesRef.current.total,
        keystrokesRef.current.correct
      );

      setWpm(currentWpm);
      setAccuracy(currentAccuracy);

      const isDone = value === paragraph;
      const now = Date.now();

      if (now - lastUpdateRef.current > 100 || isDone) {
        lastUpdateRef.current = now;
        onProgressUpdate({ progress, wpm: currentWpm, accuracy: currentAccuracy, finished: isDone });
      }

      if (isDone) setFinished(true);
    },
    [finished, phase, paragraph, typed, timeUp, calcWpm, calcAccuracy, onProgressUpdate]
  );

  const renderText = (): React.ReactNode[] => {
    return paragraph.split('').map((char, i) => {
      let cls = 'char';
      if (i < typed.length) {
        cls += typed[i] === char ? ' char--correct' : ' char--wrong';
      } else if (i === typed.length && !timeUp && !finished) {
        cls += ' char--cursor';
      }
      return <span key={i} className={cls}>{char}</span>;
    });
  };

  const timerColor =
    timeRemaining > 15 ? 'var(--green)' : timeRemaining > 8 ? 'var(--yellow)' : 'var(--red)';
  const timerPct = roundDuration > 0 ? (timeRemaining / roundDuration) * 100 : 0;

  return (
    <div className="race">
      <div className="race__header">
        <div className="race__room-code">
          Room: <span>{room?.code}</span>
        </div>

        <div className="race__timer" style={{ '--timer-color': timerColor } as React.CSSProperties}>
          <svg className="race__timer-ring" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="18" className="race__timer-ring-bg" />
            <circle
              cx="22" cy="22" r="18"
              className="race__timer-ring-fill"
              style={{
                strokeDashoffset: `${113 - (113 * timerPct) / 100}`,
                stroke: timerColor,
              }}
            />
          </svg>
          <span className="race__timer-num">{timeRemaining}</span>
        </div>

        <div className="race__stats-badge">
          <div className="race__stat">
            <span className="race__stat-num">{wpm}</span>
            <span className="race__stat-label">WPM</span>
          </div>
          <div className="race__stat-divider" />
          <div className="race__stat">
            <span className="race__stat-num">{accuracy}%</span>
            <span className="race__stat-label">ACC</span>
          </div>
        </div>
      </div>

      {phase === 'countdown' && countdown !== null && (
        <div className="race__countdown">
          <div className="race__countdown-num">{countdown}</div>
          <p className="race__countdown-text">Get ready...</p>
        </div>
      )}

      <div className="race__progress-section">
        <ProgressBar
          label={me?.name ?? 'You'}
          progress={me?.progress ?? 0}
          wpm={me?.wpm ?? 0}
          accuracy={me?.accuracy ?? 100}
          isYou
        />
        <ProgressBar
          label={opponent?.name ?? 'Opponent'}
          progress={opponent?.progress ?? 0}
          wpm={opponent?.wpm ?? 0}
          accuracy={opponent?.accuracy ?? 100}
          isYou={false}
        />
      </div>

      <div
        className={`race__text-box ${timeUp || finished ? 'race__text-box--disabled' : ''}`}
        onClick={() => { if (!timeUp && !finished) inputRef.current?.focus(); }}
        role="button"
        tabIndex={-1}
        aria-label="Click to focus typing area"
      >
        <p className="race__paragraph">{renderText()}</p>
      </div>

      <input
        ref={inputRef}
        className="race__hidden-input"
        value={typed}
        onChange={handleInput}
        disabled={finished || phase !== 'racing' || timeUp}
        aria-label="Type here"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {timeUp && !finished && (
        <div className="race__banner race__banner--timeout">
          ⏱ Time's up! Waiting for results...
        </div>
      )}
      {finished && (
        <div className="race__banner race__banner--done">
          ✓ You finished! Waiting for opponent...
        </div>
      )}
      {phase === 'racing' && !finished && !timeUp && (
        <p className="race__click-hint">Click the text box or start typing</p>
      )}
    </div>
  );
}

function ProgressBar({ label, progress, wpm, accuracy, isYou }: ProgressBarProps) {
  return (
    <div className="progress-bar">
      <div className="progress-bar__meta">
        <div className="progress-bar__left">
          <div className={`progress-bar__dot ${isYou ? 'progress-bar__dot--you' : 'progress-bar__dot--opp'}`} />
          <span className="progress-bar__label">{label}</span>
          {isYou && <span className="progress-bar__you-tag">You</span>}
        </div>
        <div className="progress-bar__right">
          <span className="progress-bar__wpm">{wpm} WPM</span>
          <span className="progress-bar__acc">{accuracy}% acc</span>
          <span className="progress-bar__pct">{progress}%</span>
        </div>
      </div>
      <div className="progress-bar__track">
        <div
          className={`progress-bar__fill ${isYou ? 'progress-bar__fill--you' : 'progress-bar__fill--opp'}`}
          style={{ width: `${progress}%` }}
        />
        <div
          className={`progress-bar__car ${isYou ? 'progress-bar__car--you' : 'progress-bar__car--opp'}`}
          style={{ left: `${Math.min(progress, 98)}%` }}
          aria-hidden="true"
        >
          {isYou ? '🚀' : '🏎️'}
        </div>
      </div>
    </div>
  );
}
