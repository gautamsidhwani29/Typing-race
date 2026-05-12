import { GameType, QueueCounts } from '../types';
import './Lobby.css';

interface Props {
  username: string;
  queueCounts: QueueCounts;
  onPlay: (gameType: GameType) => void;
}

const GAMES: {
  type: GameType;
  emoji: string;
  name: string;
  description: string;
  color: string;
}[] = [
  {
    type: 'typing',
    emoji: '⌨️',
    name: 'Typing Race',
    description: 'Race to type a paragraph faster than your opponent',
    color: '#e2b714',
  },
  {
    type: 'trivia',
    emoji: '🧠',
    name: 'Trivia Battle',
    description: 'Answer 10 trivia questions — fastest correct answer wins each round',
    color: '#60a5fa',
  },
  {
    type: 'math',
    emoji: '🔢',
    name: 'Math Sprint',
    description: 'Solve 20 math problems before your opponent does',
    color: '#4ade80',
  },
  {
    type: 'minesweeper',
    emoji: '💣',
    name: 'Minesweeper Race',
    description: 'Clear the board without hitting a mine — same board, first to finish wins',
    color: '#f87171',
  },
];

export default function Lobby({ username, queueCounts, onPlay }: Props) {
  return (
    <div className="lobby">
      <header className="lobby__header">
        <h1 className="lobby__title">Game Arena</h1>
        <div className="lobby__user">
          <span className="lobby__user-dot" />
          <span className="lobby__username">{username}</span>
        </div>
      </header>

      <p className="lobby__subtitle">Choose a game and get matched instantly</p>

      <div className="lobby__grid">
        {GAMES.map((game) => (
          <div
            key={game.type}
            className="game-card"
            style={{ '--card-color': game.color } as React.CSSProperties}
          >
            <div className="game-card__emoji">{game.emoji}</div>
            <h2 className="game-card__name">{game.name}</h2>
            <p className="game-card__desc">{game.description}</p>
            <div className="game-card__footer">
              <div className="game-card__waiting">
                <span className="game-card__waiting-dot" />
                <span>{queueCounts[game.type]} waiting</span>
              </div>
              <button
                className="game-card__btn"
                onClick={() => onPlay(game.type)}
              >
                Play
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
