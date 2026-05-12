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
        extra={<span className="trivia__qnum">Q {questionNum} / 10</span>}
      />

      {currentQ ? (
        <div className="trivia__card">
          <div className="trivia__timer-bar">
            <div
              className="trivia__timer-fill"
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>
          <div className="trivia__timer-num" style={{ color: timerColor }}>{timeLeft}s</div>

          <p
            className="trivia__question"
            dangerouslySetInnerHTML={{ __html: currentQ.question }}
          />

          <div className="trivia__options">
            {currentQ.options.map((opt) => {
              let cls = 'trivia__option';
              if (selected) {
                if (opt === selected) {
                  cls += result?.correct ? ' trivia__option--correct' : ' trivia__option--wrong';
                } else if (result && !result.correct && opt === currentQ.options.find(o => o !== selected)) {
                  // don't highlight others
                }
              }
              return (
                <button
                  key={opt}
                  className={cls}
                  onClick={() => handleAnswer(opt)}
                  disabled={!!selected}
                  dangerouslySetInnerHTML={{ __html: opt }}
                />
              );
            })}
          </div>

          {result && (
            <div className={`trivia__feedback ${result.correct ? 'trivia__feedback--correct' : 'trivia__feedback--wrong'}`}>
              {result.correct ? '✓ Correct!' : '✗ Wrong!'}
            </div>
          )}
        </div>
      ) : (
        <div className="trivia__waiting">
          <div className="trivia__spinner" />
          <p>Loading question...</p>
        </div>
      )}
    </div>
  );
}
