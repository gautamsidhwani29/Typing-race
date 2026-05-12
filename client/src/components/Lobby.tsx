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
    color: '#00ff00', // Neon Green
  },
  {
    type: 'trivia',
    emoji: '🧠',
    name: 'Trivia Battle',
    description: 'Answer 10 trivia questions — fastest correct answer wins each round',
    color: '#00ccff', // Neon Blue
  },
  {
    type: 'math',
    emoji: '🔢',
    name: 'Math Sprint',
    description: 'Solve 20 math problems before your opponent does',
    color: '#ffff00', // Neon Yellow
  },
  {
    type: 'minesweeper',
    emoji: '💣',
    name: 'Minesweeper Race',
    description: 'Clear the board without hitting a mine — same board, first to finish wins',
    color: '#ff0033', // Neon Red
  },
];

export default function Lobby({ username, queueCounts, onPlay }: Props) {
  return (
    <div className="lobby">
      <header className="lobby__header nes-container is-dark with-title">
        <p className="title">Game Arena</p>
        <div className="lobby__header-content">
          <div className="lobby__user">
            <i className="nes-bcrikko"></i>
            <span className="lobby__username">{username}</span>
          </div>
          <p className="lobby__subtitle">Select a mission to begin</p>
        </div>
      </header>

      <div className="lobby__grid">
        {GAMES.map((game) => (
          <div
            key={game.type}
            className={`game-card nes-container is-dark with-title`}
          >
            <p className="title" style={{ color: game.color }}>{game.name}</p>
            <div className="game-card__content">
              <div className="game-card__emoji">{game.emoji}</div>
              <p className="game-card__desc">{game.description}</p>
            </div>
            <div className="game-card__footer">
              <div className="game-card__waiting">
                <span className="nes-text is-warning">{queueCounts[game.type]} waiting</span>
              </div>
              <button
                className="game-card__btn nes-btn is-success"
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
