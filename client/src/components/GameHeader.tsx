import './GameHeader.css';

interface Props {
  title: string;
  myName: string;
  myScore: number | string;
  oppName: string;
  oppScore: number | string;
  extra?: React.ReactNode;
}

export default function GameHeader({ title, myName, myScore, oppName, oppScore, extra }: Props) {
  return (
    <div className="game-header">
      <div className="game-header__player game-header__player--you">
        <span className="game-header__name">{myName}</span>
        <span className="game-header__score">{myScore}</span>
      </div>
      <div className="game-header__center">
        <span className="game-header__title">{title}</span>
        {extra}
      </div>
      <div className="game-header__player game-header__player--opp">
        <span className="game-header__score">{oppScore}</span>
        <span className="game-header__name">{oppName}</span>
      </div>
    </div>
  );
}
