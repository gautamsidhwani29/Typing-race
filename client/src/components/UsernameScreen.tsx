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
      <div className="username-screen__content nes-container is-dark with-title">
        <p className="title">Game Arena</p>
        <div className="username-screen__icon">
          <i className="nes-icon logo is-large"></i>
        </div>
        <p className="username-screen__subtitle">Enter username to start</p>
        <form onSubmit={handleSubmit} className="username-screen__form">
          <div className="nes-field">
            <input
              type="text"
              id="name_field"
              className="username-screen__input nes-input is-dark"
              placeholder="Your username..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className={`username-screen__btn nes-btn ${!value.trim() ? 'is-disabled' : 'is-primary'}`}
            disabled={!value.trim()}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
