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
      <div className="game-over__card nes-container is-dark with-title">
        <p className="title">{isWinner ? 'Victory!' : 'Defeat'}</p>
        <div className="game-over__trophy">
          <i className={`nes-icon ${isWinner ? 'trophy' : 'close'} is-large`}></i>
        </div>
        <h1 className={`game-over__title ${isWinner ? 'nes-text is-success' : 'nes-text is-error'}`}>
          {isWinner ? 'YOU WIN' : 'YOU LOSE'}
        </h1>
        <p className="game-over__subtitle nes-text is-disabled">
          {isWinner ? `${result.winnerName} is the champion` : `${result.winnerName} took the win`}
        </p>

        <div className="game-over__stats">
          <div className={`game-over__player nes-container is-dark ${isWinner ? 'is-rounded' : ''}`}>
            <div className="game-over__player-name">{me?.username ?? username}</div>
            <div className="game-over__player-score nes-text is-warning">{me?.score ?? 0}</div>
            <div className="game-over__player-label">Score</div>
          </div>
          <div className="game-over__vs">VS</div>
          <div className={`game-over__player nes-container is-dark ${!isWinner ? 'is-rounded' : ''}`}>
            <div className="game-over__player-name">{opponent?.username ?? 'Opponent'}</div>
            <div className="game-over__player-score nes-text is-warning">{opponent?.score ?? 0}</div>
            <div className="game-over__player-label">Score</div>
          </div>
        </div>

        <button className="game-over__btn nes-btn is-primary" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
