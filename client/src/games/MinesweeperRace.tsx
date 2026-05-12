import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { MinesweeperGameData } from '../types';
import GameHeader from '../components/GameHeader';
import './MinesweeperRace.css';

interface Props {
  socket: Socket;
  matchId: string;
  myId: string;
  username: string;
  opponent: string;
  gameData: MinesweeperGameData;
}

type CellState = 'hidden' | 'revealed' | 'flagged' | 'mine';

export default function MinesweeperRace({ socket, myId, username, opponent, gameData }: Props) {
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [board, setBoard] = useState<CellState[][]>(() =>
    Array(gameData.size).fill(null).map(() => Array(gameData.size).fill('hidden'))
  );
  const [gameOver, setGameOver] = useState(false);

  const { size, mineCount } = gameData;
  const totalSafe = size * size - mineCount;

  useEffect(() => {
    socket.on('minesweeper_update', ({ playerId, revealedCount, hitMine }) => {
      if (playerId === myId) {
        setMyScore(revealedCount);
        if (hitMine) setGameOver(true);
      }
    });

    socket.on('minesweeper_progress', ({ players }) => {
      const me = players.find((p: any) => p.id === myId);
      const opp = players.find((p: any) => p.id !== myId);
      if (me) setMyScore(me.score);
      if (opp) setOppScore(opp.score);
    });

    return () => {
      socket.off('minesweeper_update');
      socket.off('minesweeper_progress');
    };
  }, [socket, myId]);

  const handleReveal = (row: number, col: number) => {
    if (gameOver || board[row][col] !== 'hidden') return;
    socket.emit('minesweeper_reveal', { row, col });
    
    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = 'revealed';
    setBoard(newBoard);
  };

  const handleFlag = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    if (gameOver || board[row][col] === 'revealed') return;
    
    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = board[row][col] === 'flagged' ? 'hidden' : 'flagged';
    setBoard(newBoard);
  };

  const myPct = Math.round((myScore / totalSafe) * 100);
  const oppPct = Math.round((oppScore / totalSafe) * 100);

  return (
    <div className="minesweeper">
      <GameHeader
        title="Minesweeper Race"
        myName={username}
        myScore={`${myPct}%`}
        oppName={opponent}
        oppScore={`${oppPct}%`}
        extra={<span className="minesweeper__info">{myScore} / {totalSafe} safe cells</span>}
      />

      <div className="minesweeper__board">
        {board.map((row, r) => (
          <div key={r} className="minesweeper__row">
            {row.map((cell, c) => (
              <button
                key={c}
                className={`minesweeper__cell minesweeper__cell--${cell}`}
                onClick={() => handleReveal(r, c)}
                onContextMenu={(e) => handleFlag(e, r, c)}
                disabled={gameOver}
              >
                {cell === 'flagged' && '🚩'}
                {cell === 'mine' && '💣'}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="minesweeper__progress">
        <div className="minesweeper__progress-bar">
          <div className="minesweeper__progress-label">{username}</div>
          <div className="minesweeper__progress-track">
            <div className="minesweeper__progress-fill minesweeper__progress-fill--you" style={{ width: `${myPct}%` }} />
          </div>
          <div className="minesweeper__progress-pct">{myPct}%</div>
        </div>
        <div className="minesweeper__progress-bar">
          <div className="minesweeper__progress-label">{opponent}</div>
          <div className="minesweeper__progress-track">
            <div className="minesweeper__progress-fill minesweeper__progress-fill--opp" style={{ width: `${oppPct}%` }} />
          </div>
          <div className="minesweeper__progress-pct">{oppPct}%</div>
        </div>
      </div>

      <p className="minesweeper__hint">Left-click to reveal • Right-click to flag</p>
    </div>
  );
}
