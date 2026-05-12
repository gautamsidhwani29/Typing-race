import { GameType } from '../types';
import './CountdownOverlay.css';

interface Props {
  count: number;
  gameType: GameType;
  opponent: string;
}

const GAME_NAMES: Record<GameType, string> = {
  typing: 'Typing Race',
  trivia: 'Trivia Battle',
  math: 'Math Sprint',
  minesweeper: 'Minesweeper Race',
};

export default function CountdownOverlay({ count, gameType, opponent }: Props) {
  return (
    <div className="countdown-overlay">
      <p className="countdown-overlay__vs">vs {opponent}</p>
      <div className="countdown-overlay__num" key={count}>{count}</div>
      <p className="countdown-overlay__game">{GAME_NAMES[gameType]}</p>
    </div>
  );
}
