import { useState, useEffect, useRef } from 'react';
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

export default function MathSprint({ socket, myId, username, opponent }: Props) {
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [currentProblem, setCurrentProblem] = useState('');
  const [problemIndex, setProblemIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socket.on('math_problem', ({ problemIndex: idx, problem }) => {
      setCurrentProblem(problem);
      setProblemIndex(idx);
      setAnswer('');
      setTimeout(() => inputRef.current?.focus(), 50);
    });

    socket.on('math_correct', ({ playerId }) => {
      if (playerId === myId) setMyScore((s) => s + 1);
    });

    socket.on('math_scores', ({ players }) => {
      const me = players.find((p: any) => p.id === myId);
      const opp = players.find((p: any) => p.id !== myId);
      if (me) setMyScore(me.score);
      if (opp) setOppScore(opp.score);
    });

    return () => {
      socket.off('math_problem');
      socket.off('math_correct');
      socket.off('math_scores');
    };
  }, [socket, myId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(answer, 10);
    if (!isNaN(num)) {
      socket.emit('math_answer', { problemIndex, answer: num });
    }
  };

  return (
    <div className="math">
      <GameHeader
        title="Math Sprint"
        myName={username}
        myScore={`${myScore} / 20`}
        oppName={opponent}
        oppScore={`${oppScore} / 20`}
      />

      <div className="math__card">
        <div className="math__problem">{currentProblem || 'Loading...'}</div>
        <form onSubmit={handleSubmit} className="math__form">
          <input
            ref={inputRef}
            type="number"
            className="math__input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer..."
            autoFocus
          />
          <button type="submit" className="math__btn">Submit</button>
        </form>
      </div>

      <div className="math__progress">
        <div className="math__progress-bar">
          <div className="math__progress-fill math__progress-fill--you" style={{ width: `${(myScore / 20) * 100}%` }} />
        </div>
        <div className="math__progress-bar">
          <div className="math__progress-fill math__progress-fill--opp" style={{ width: `${(oppScore / 20) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
