# TypeRace — 1v1 Real-Time Typing Race

A real-time 1v1 typing race built with React + Socket.io.

## Project Structure

```
Typing-race/
├── server/                    # Node.js + Express + Socket.io backend
│   ├── server.js
│   ├── package.json
│   └── node_modules/
│
└── client/                    # Vite + React frontend
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── Lobby.jsx / .css        — Create or join a room
            ├── WaitingRoom.jsx / .css  — Waiting for opponent, shows room code
            ├── Race.jsx / .css         — Live typing race with progress bars & timer
            └── WinnerScreen.jsx / .css — Results + rematch
```

## How to Run Locally

### 1. Start the backend

```bash
cd server
npm install
node server.js        # → http://localhost:3001
```

Or with auto-reload during development:
```bash
npm run dev
```

### 2. Start the frontend

```bash
cd client
npm install
npm run dev           # → http://localhost:5173
```

### 3. Play

1. Open **http://localhost:5173** in two browser tabs (or two different browsers)
2. In tab 1: enter a name → **Create Room** → copy the 5-letter room code
3. In tab 2: enter a name → **Join Room** → paste the code → join
4. A 3-second countdown starts automatically
5. You have **30 seconds** — type as fast and accurately as you can
6. Winner is decided by **WPM**; if tied, by **accuracy**; if both tied, it's a draw

## Features

- 30-second timed rounds with a live circular countdown timer
- Winner decided by WPM → accuracy tiebreaker → draw
- Room codes — share a 5-character code to connect two players
- Real-time progress bars with emoji racers (🚀 vs 🏎️)
- Character-level highlighting — green for correct, red for wrong
- Live WPM + accuracy counter for both players
- 3-second countdown before each race
- Winner screen with tiebreaker reason and per-player stats
- Rematch system — both players must vote to restart
- Clean dark theme with JetBrains Mono for the typing area
