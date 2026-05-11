import React, { useState } from 'react';
import './Lobby.css';

interface LobbyProps {
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  error: string;
}

type Tab = 'create' | 'join';

export default function Lobby({ onCreate, onJoin, error }: LobbyProps) {
  const [name, setName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [tab, setTab] = useState<Tab>('create');

  const handleCreate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  };

  const handleJoin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim()) return;
    onJoin(name.trim(), joinCode.trim());
  };

  return (
    <div className="lobby">
      <div className="lobby__hero">
        <div className="lobby__logo">⌨️</div>
        <h1 className="lobby__title">TypeRace</h1>
        <p className="lobby__subtitle">1v1 real-time typing battle</p>
      </div>

      <div className="lobby__card">
        <div className="lobby__tabs">
          <button
            className={`lobby__tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => setTab('create')}
          >
            Create Room
          </button>
          <button
            className={`lobby__tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => setTab('join')}
          >
            Join Room
          </button>
        </div>

        <div className="lobby__form-wrap">
          <div className="lobby__field">
            <label className="lobby__label">Your Name</label>
            <input
              className="lobby__input"
              type="text"
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          {tab === 'join' && (
            <div className="lobby__field">
              <label className="lobby__label">Room Code</label>
              <input
                className="lobby__input lobby__input--code"
                type="text"
                placeholder="e.g. AB3XY"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>
          )}

          {error && <p className="lobby__error">{error}</p>}

          {tab === 'create' ? (
            <button className="lobby__btn" onClick={handleCreate} disabled={!name.trim()}>
              Create Room
            </button>
          ) : (
            <button
              className="lobby__btn"
              onClick={handleJoin}
              disabled={!name.trim() || !joinCode.trim()}
            >
              Join Room
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
