import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { TriviaGameData } from '../types';
import GameHeader from '../components/GameHeader';
import './TriviaBattle.css';

interface Props {
  socket: Socket;
  matchId: string;
  myId: string;
  username: string;
  opponent: string;
  gameData: TriviaGameData;
}

interface QuestionState {
  questionIndex: number;
  question: string;
  options: string[];
  timeLimit: number;
}

interface AnswerResult {
  playerId: string;
  correct: boolean;
}

export default function TriviaBattle({ socket, myId, username, opponent }: Props) {
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [currentQ, setCurrentQ] = useState<QuestionState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [questionNum, setQuestionNum] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    socket.on('trivia_question', (data) => {
      setCurrentQ(data);
      setSelected(null);
      setResult(null);
      setTimeLeft(data.timeLimit);
      setQuestionNum(data.questionIndex + 1);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    });

    socket.on('trivia_answer_result', (data: AnswerResult) => {
      setResult(data);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('trivia_scores', ({ players }) => {
      const me = players.find((p: any) => p.id === myId);
      const opp = players.find((p: any) => p.id !== myId);
      if (me) setMyScore(me.score);
      if (opp) setOppScore(opp.score);
    });

    return () => {
      socket.off('trivia_question');
      socket.off('trivia_answer_result');
      socket.off('trivia_scores');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, myId]);

  const handleAnswer = (option: string) => {
    if (selected || !currentQ) return;
    setSelected(option);
    socket.emit('trivia_answer', { questionIndex: currentQ.questionIndex, answer: option });
  };

  const timerPct = (timeLeft / 15) * 100;
  const timerColor = timeLeft > 8 ? 'var(--green)' : timeLeft > 4 ? 'var(--accent)' : 'var(--red)';

  return (
    <div className="trivia">
      <GameHeader
        title="Trivia Battle"
        myName={username}
        myScore={myScore}
        oppName={opponent}
        oppScore={oppScore}
        extra={<span className="trivia__qnum nes-text is-primary">Q {questionNum} / 10</span>}
      />

      {currentQ ? (
        <div className="trivia__card nes-container is-dark with-title">
          <p className="title">Round {questionNum}</p>
          <div className="trivia__timer-section">
            <progress className={`nes-progress ${timeLeft > 8 ? 'is-success' : timeLeft > 4 ? 'is-warning' : 'is-error'}`} value={timeLeft} max="15"></progress>
            <div className="trivia__timer-num">{timeLeft}s</div>
          </div>

          <p
            className="trivia__question"
            dangerouslySetInnerHTML={{ __html: currentQ.question }}
          />

          <div className="trivia__options">
            {currentQ.options.map((opt, idx) => {
              const colors = ['is-primary', 'is-success', 'is-warning', 'is-error'];
              let type = colors[idx % colors.length];
              if (selected === opt) {
                type = result?.correct ? 'is-success' : 'is-error';
              }
              return (
                <button
                  key={opt}
                  className={`trivia__option nes-btn ${type} ${selected && selected !== opt ? 'is-disabled' : ''}`}
                  onClick={() => handleAnswer(opt)}
                  disabled={!!selected}
                  dangerouslySetInnerHTML={{ __html: opt }}
                />
              );
            })}
          </div>

          {result && (
            <div className={`trivia__feedback nes-text ${result.correct ? 'is-success' : 'is-error'}`}>
              {result.correct ? '✓ Correct!' : '✗ Wrong!'}
            </div>
          )}
        </div>
      ) : (
        <div className="trivia__waiting">
          <i className="nes-icon coin is-large"></i>
          <p>Loading question...</p>
        </div>
      )}
    </div>
  );
}
