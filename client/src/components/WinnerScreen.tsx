import { Player, RaceResult, RematchVotes, PublicRoom, WinReason } from '../types';
import './WinnerScreen.css';

interface WinnerScreenProps {
  result: RaceResult | null;
  playerId: string | null;
  rematchVotes: RematchVotes;
  hasVoted: boolean;
  onRematch: () => void;
  room: PublicRoom | null;
}

interface StatCardProps {
  label: string;
  wpm: number;
  accuracy: number;
  progress: number;
  isYou: boolean;
  isWinner: boolean;
}

const REASON_LABEL: Record<WinReason, string> = {
  wpm: 'Higher WPM',
  accuracy: 'Better accuracy (WPM tied)',
  draw: 'Perfect tie',
};

export default function WinnerScreen({
  result,
  playerId,
  rematchVotes,
  hasVoted,
  onRematch,
  room,
}: WinnerScreenProps) {
  if (!result) return null;

  const { winnerId, winnerName, reason, isDraw, players } = result;
  const isWinner = !isDraw && winnerId === playerId;
  const me = players?.find((p: Player) => p.id === playerId);
  const opponent = players?.find((p: Player) => p.id !== playerId);

  let trophy: string;
  let headline: string;
  let headlineClass: string;
  let subText: string;

  if (isDraw) {
    trophy = '🤝';
    headline = "It's a Draw!";
    headlineClass = 'winner__headline--draw';
    subText = 'Both players are equally matched';
  } else if (isWinner) {
    trophy = '🏆';
    headline = 'You Win!';
    headlineClass = 'winner__headline--win';
    subText = `Won by ${REASON_LABEL[reason]}`;
  } else {
    trophy = '💀';
    headline = 'You Lose!';
    headlineClass = 'winner__headline--lose';
    subText = `${winnerName} won by ${REASON_LABEL[reason]}`;
  }

  return (
    <div className="winner">
      <div className="winner__card">
        <div className="winner__trophy">{trophy}</div>
        <h1 className={`winner__headline ${headlineClass}`}>{headline}</h1>
        <p className="winner__sub">{subText}</p>

        <div className={`winner__reason winner__reason--${reason}`}>
          {reason === 'wpm' && '⚡ Decided by WPM'}
          {reason === 'accuracy' && '🎯 WPM tied — decided by accuracy'}
          {reason === 'draw' && '⚖️ Same WPM & accuracy'}
        </div>

        <div className="winner__stats">
          <StatCard
            label={me?.name ?? 'You'}
            wpm={me?.wpm ?? 0}
            accuracy={me?.accuracy ?? 100}
            progress={me?.progress ?? 0}
            isYou
            isWinner={!isDraw && me?.id === winnerId}
          />
          <div className="winner__vs">VS</div>
          <StatCard
            label={opponent?.name ?? 'Opponent'}
            wpm={opponent?.wpm ?? 0}
            accuracy={opponent?.accuracy ?? 100}
            progress={opponent?.progress ?? 0}
            isYou={false}
            isWinner={!isDraw && opponent?.id === winnerId}
          />
        </div>

        <div className="winner__rematch-section">
          <button
            className={`winner__rematch-btn ${hasVoted ? 'winner__rematch-btn--voted' : ''}`}
            onClick={onRematch}
            disabled={hasVoted}
          >
            {hasVoted
              ? `Waiting... (${rematchVotes.count}/${rematchVotes.total})`
              : '🔄 Rematch'}
          </button>
          {rematchVotes.count > 0 && (
            <p className="winner__vote-status">
              {rematchVotes.count}/{rematchVotes.total} players want a rematch
            </p>
          )}
        </div>

        <div className="winner__room-code">
          Room: <span>{room?.code}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, wpm, accuracy, progress, isYou, isWinner }: StatCardProps) {
  return (
    <div className={`stat-card ${isWinner ? 'stat-card--winner' : ''}`}>
      {isWinner && <div className="stat-card__crown">👑</div>}
      <div className={`stat-card__avatar ${isYou ? 'stat-card__avatar--you' : 'stat-card__avatar--opp'}`}>
        {label?.[0]?.toUpperCase() ?? '?'}
      </div>
      <p className="stat-card__name">{label}</p>
      <div className="stat-card__stats-row">
        <div className="stat-card__stat">
          <span className="stat-card__num">{wpm}</span>
          <span className="stat-card__unit">WPM</span>
        </div>
        <div className="stat-card__stat-divider" />
        <div className="stat-card__stat">
          <span className="stat-card__num">{accuracy}%</span>
          <span className="stat-card__unit">ACC</span>
        </div>
      </div>
      <div className="stat-card__progress-row">
        <span className="stat-card__progress-label">Progress</span>
        <div className="stat-card__progress-track">
          <div
            className={`stat-card__progress-fill ${isYou ? 'stat-card__progress-fill--you' : 'stat-card__progress-fill--opp'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="stat-card__progress-pct">{progress}%</span>
      </div>
    </div>
  );
}
