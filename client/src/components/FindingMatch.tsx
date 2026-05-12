import { GameType } from '../types';
import './FindingMatch.css';

interface Props {
  gameType: GameType;
  onCancel: () => void;
}

const GAME_NAMES: Record<GameType, string> = {
  typing: 'Typing Race',
  trivia: 'Trivia Battle',
  math: 'Math Sprint',
  minesweeper: 'Minesweeper Race',
};

export default function FindingMatch({ gameType, onCancel }: Props) {
  return (
    <div className="finding-match">
      <div className="finding-match__content">
        <div className="finding-match__spinner" />
        <h2 className="finding-match__title">Finding opponent...</h2>
        <p className="finding-match__game">{GAME_NAMES[gameType]}</p>
        <button className="finding-match__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
