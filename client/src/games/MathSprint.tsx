import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { MathGameData } from '../types';
import GameHeader from '../components/GameHeader';
import './MathSprint.css';

interface Props {
  socket: Socket;
  matchId: string;
  myId: string;
  username: string;
  opponent: string;
  gameData: MathGameData;
}

interface QuestionResult {
  questionIndex: number;
  winnerId: string | null;
  scores: Record<string, number>;
  correctIds: string[];
  players: { id: string; username: string; score: number }[];
}

type QuestionPhase = 'answering' | 'waiting' | 'result';

export default function MathSprint({ socket, myId, username, opponent, gameData }: Props) {
  const totalQuestions = gameData.questions.length;

  // Current question state
  const [questionIndex, setQuestionIndex]   = useState(0);
  const [problem, setProblem]               = useState('');
  const [timeLeft, setTimeLeft]             = useState(0);
  const [timeLimit, setTimeLimit]           = useState(15);
  const [answer, setAnswer]                 = useState('');
  const [phase, setPhase]                   = useState<QuestionPhase>('answering');
  const [hasAnswered, setHasAnswered]       = useState(false);

  // Scores
  const [myPoints, setMyPoints]             = useState(0);
  const [oppPoints, setOppPoints]           = useState(0);
  const [myCorrect, setMyCorrect]           = useState(0);
  const [oppCorrect, setOppCorrect]         = useState(0);

  // Last result feedback
  const [lastResult, setLastResult]         = useState<QuestionResult | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((limit: number) => {
    stopTimer();
    setTimeLeft(limit);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { stopTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    socket.on('math_problem', ({ problemIndex, problem: prob, timeLimit: tl }) => {
      setQuestionIndex(problemIndex);
      setProblem(prob);
      setTimeLimit(tl);
      setAnswer('');
      setHasAnswered(false);
      setLastResult(null);
      setPhase('answering');
      startTimer(tl);
      setTimeout(() => inputRef.current?.focus(), 50);
    });

    socket.on('math_time_up', ({ players }: { questionIndex: number; players: { id: string; score: number }[] }) => {
      stopTimer();
      setPhase('waiting');
      // Update scores from server
      const me  = players.find((p: { id: string }) => p.id === myId);
      const opp = players.find((p: { id: string }) => p.id !== myId);
      if (me)  setMyPoints((me as any).score);
      if (opp) setOppPoints((opp as any).score);
    });

    socket.on('math_question_result', (result: QuestionResult) => {
      stopTimer();
      setPhase('result');
      setLastResult(result);
      const me  = result.players.find((p) => p.id === myId);
      const opp = result.players.find((p) => p.id !== myId);
      if (me)  { setMyPoints(me.score); setMyCorrect((c) => result.correctIds.includes(myId) ? c + 1 : c); }
      if (opp) { setOppPoints(opp.score); setOppCorrect((c) => result.correctIds.includes(opp.id) ? c + 1 : c); }
    });

    return () => {
      socket.off('math_problem');
      socket.off('math_time_up');
      socket.off('math_question_result');
      stopTimer();
    };
  }, [socket, myId, startTimer, stopTimer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnswered || phase !== 'answering') return;
    const num = parseInt(answer, 10);
    if (isNaN(num)) return;
    setHasAnswered(true);
    setPhase('waiting');
    stopTimer();
    socket.emit('math_answer', { questionIndex, answer: num });
  };

  // Derived
  const timerPct   = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0;
  const timerColor = timeLeft > 8 ? 'var(--green)' : timeLeft > 4 ? 'var(--accent)' : 'var(--red)';

  const myResultPoints  = lastResult?.scores[myId]  ?? null;
  const oppResultPoints = lastResult ? Object.entries(lastResult.scores).find(([id]) => id !== myId)?.[1] ?? null : null;
  const iAnsweredCorrect = lastResult?.correctIds.includes(myId) ?? false;
  const oppAnsweredCorrect = lastResult ? lastResult.correctIds.some((id) => id !== myId) : false;

  return (
    <div className="math">
      <GameHeader
        title="Math Sprint"
        myName={username}
        myScore={myPoints}
        oppName={opponent}
        oppScore={oppPoints}
        extra={
          <span className="math__qnum">
            Q {questionIndex + 1} / {totalQuestions}
          </span>
        }
      />

      <div className="math__card">
        {/* Timer bar */}
        <div className="math__timer-bar">
          <div
            className="math__timer-fill"
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
        </div>
        <div className="math__timer-num" style={{ color: timerColor }}>
          {phase === 'answering' ? `${timeLeft}s` : phase === 'waiting' ? 'Waiting...' : ''}
        </div>

        {/* Problem */}
        <div className="math__problem">{problem || '...'}</div>

        {/* Input */}
        {phase === 'answering' && (
          <form onSubmit={handleSubmit} className="math__form">
            <input
              ref={inputRef}
              type="number"
              className="math__input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer..."
              autoFocus
            />
            <button type="submit" className="math__btn">Submit</button>
          </form>
        )}

        {phase === 'waiting' && (
          <div className="math__waiting">
            <div className="math__spinner" />
            <p>{hasAnswered ? 'Waiting for opponent...' : "Time's up!"}</p>
          </div>
        )}

        {/* Per-question result */}
        {phase === 'result' && lastResult && (
          <div className="math__result">
            <div className={`math__result-row ${iAnsweredCorrect ? 'math__result-row--correct' : 'math__result-row--wrong'}`}>
              <span>{username}</span>
              <span>{iAnsweredCorrect ? '✓' : '✗'}</span>
              <span className="math__result-pts">+{myResultPoints ?? 0} pts</span>
            </div>
            <div className={`math__result-row ${oppAnsweredCorrect ? 'math__result-row--correct' : 'math__result-row--wrong'}`}>
              <span>{opponent}</span>
              <span>{oppAnsweredCorrect ? '✓' : '✗'}</span>
              <span className="math__result-pts">+{oppResultPoints ?? 0} pts</span>
            </div>
          </div>
        )}
      </div>

      {/* Running totals */}
      <div className="math__totals">
        <div className="math__total-row">
          <span className="math__total-name">{username}</span>
          <span className="math__total-detail">{myCorrect} correct · {myPoints} pts</span>
        </div>
        <div className="math__total-row">
          <span className="math__total-name">{opponent}</span>
          <span className="math__total-detail">{oppCorrect} correct · {oppPoints} pts</span>
        </div>
      </div>

      <p className="math__hint">Fastest correct answer earns 2 pts · Slower correct earns 1 pt</p>
    </div>
  );
}
