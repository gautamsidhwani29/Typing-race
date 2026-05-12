import { GameOverResult, GameType } from '../types';
import './GameOver.css';

interface Props {
  result: GameOverResult;
  myId: string;
  username: string;
  gameType: GameType | null;
  onPlayAgain: () => void;
}

export default function GameOver({ result, myId, username, onPlayAgain }: Props) {
  const isWinner = result.winnerId === myId;
  const me = result.players.find((p) => p.id === myId);
  const opponent = result.players.find((p) => p.id !== myId);

  return (
    <div className="game-over">
      <div className="game-over__card">
        <div className="game-over__trophy">{isWinner ? '🏆' : '💀'}</div>
        <h1 className={`game-over__title ${isWinner ? 'game-over__title--win' : 'game-over__title--lose'}`}>
          {isWinner ? 'Victory!' : 'Defeat'}
        </h1>
        <p className="game-over__subtitle">
          {isWinner ? `You defeated ${result.winnerName}` : `${result.winnerName} won`}
        </p>

        <div className="game-over__stats">
          <div className={`game-over__player ${isWinner ? 'game-over__player--winner' : ''}`}>
            <div className="game-over__player-name">{me?.username ?? username}</div>
            <div className="game-over__player-score">{me?.score ?? 0}</div>
            <div className="game-over__player-label">Score</div>
          </div>
          <div className="game-over__vs">VS</div>
          <div className={`game-over__player ${!isWinner ? 'game-over__player--winner' : ''}`}>
            <div className="game-over__player-name">{opponent?.username ?? 'Opponent'}</div>
            <div className="game-over__player-score">{opponent?.score ?? 0}</div>
            <div className="game-over__player-label">Score</div>
          </div>
        </div>

        <button className="game-over__btn" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
