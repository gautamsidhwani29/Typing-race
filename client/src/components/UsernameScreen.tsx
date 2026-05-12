import { useState } from 'react';
import './UsernameScreen.css';

interface Props {
  onSubmit: (username: string) => void;
}

export default function UsernameScreen({ onSubmit }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="username-screen">
      <div className="username-screen__content">
        <h1 className="username-screen__title">
          <span className="username-screen__emoji">🎮</span>
          Game Arena
        </h1>
        <p className="username-screen__subtitle">Enter your username to start</p>
        <form onSubmit={handleSubmit} className="username-screen__form">
          <input
            type="text"
            className="username-screen__input"
            placeholder="Your username..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button
            type="submit"
            className="username-screen__btn"
            disabled={!value.trim()}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
