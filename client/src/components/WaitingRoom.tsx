import { useState } from 'react';
import { Player, PublicRoom } from '../types';
import './WaitingRoom.css';

interface WaitingRoomProps {
  room: PublicRoom | null;
  players: Player[];
  playerId: string | null;
}

export default function WaitingRoom({ room, players, playerId }: WaitingRoomProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const copyCode = () => {
    navigator.clipboard.writeText(room?.code ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const me = players.find((p) => p.id === playerId);
  const opponent = players.find((p) => p.id !== playerId);

  return (
    <div className="waiting">
      <h2 className="waiting__title">Waiting for opponent...</h2>
      <p className="waiting__hint">Share the room code with a friend</p>

      <div className="waiting__code-box" onClick={copyCode} title="Click to copy">
        <span className="waiting__code">{room?.code}</span>
        <span className="waiting__copy-icon">{copied ? '✓' : '⎘'}</span>
      </div>
      {copied && <p className="waiting__copied">Copied to clipboard!</p>}

      <div className="waiting__players">
        <div className="waiting__player waiting__player--you">
          <div className="waiting__avatar">
            {me?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="waiting__player-name">{me?.name ?? 'You'}</span>
          <span className="waiting__badge waiting__badge--you">You</span>
        </div>

        <div className="waiting__vs">VS</div>

        <div className={`waiting__player ${opponent ? '' : 'waiting__player--empty'}`}>
          {opponent ? (
            <>
              <div className="waiting__avatar waiting__avatar--opp">
                {opponent.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="waiting__player-name">{opponent.name}</span>
              <span className="waiting__badge waiting__badge--opp">Opponent</span>
            </>
          ) : (
            <>
              <div className="waiting__avatar waiting__avatar--empty">?</div>
              <span className="waiting__player-name waiting__player-name--muted">Waiting...</span>
            </>
          )}
        </div>
      </div>

      {!opponent && (
        <div className="waiting__spinner-wrap">
          <div className="waiting__spinner" />
          <p className="waiting__spinner-text">Race starts automatically when opponent joins</p>
        </div>
      )}
    </div>
  );
}
