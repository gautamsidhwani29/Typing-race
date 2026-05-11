import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Lobby from "./components/Lobby";
import WaitingRoom from "./components/WaitingRoom";
import Race from "./components/Race";
import WinnerScreen from "./components/WinnerScreen";
import {
  Phase,
  Player,
  PublicRoom,
  RaceResult,
  RematchVotes,
  ProgressUpdate,
} from "./types";
import "./App.css";

const SOCKET_URL = "http://192.168.1.252:3001";

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [paragraph, setParagraph] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [rematchVotes, setRematchVotes] = useState<RematchVotes>({
    count: 0,
    total: 2,
  });
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [roundDuration, setRoundDuration] = useState<number>(30);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL); 
    socketRef.current = socket;

    socket.on(
      "room_joined",
      ({ room: r, playerId: pid }: { room: PublicRoom; playerId: string }) => {
        setRoom(r);
        setPlayers(r.players);
        setParagraph(r.paragraph);
        setPlayerId((prev) => prev ?? pid);
        setError("");
        setPhase("waiting");
      },
    );

    socket.on("countdown", ({ count }: { count: number }) => {
      setCountdown(count);
      setPhase("countdown");
    });

    socket.on(
      "race_start",
      ({
        paragraph: p,
        duration,
      }: {
        paragraph: string;
        startTime: number;
        duration: number;
      }) => {
        setParagraph(p);
        setCountdown(null);
        setRoundDuration(duration);
        setTimeRemaining(duration);
        setPhase("racing");
      },
    );

    socket.on("timer_tick", ({ remaining }: { remaining: number }) => {
      setTimeRemaining(remaining);
    });

    socket.on("room_update", ({ players: ps }: { players: Player[] }) => {
      setPlayers(ps);
    });

    socket.on("race_over", (result: RaceResult) => {
      setRaceResult(result);
      setPlayers(result.players);
      setPhase("finished");
    });

    socket.on("rematch_votes", (votes: RematchVotes) => {
      setRematchVotes(votes);
    });

    socket.on("rematch_start", ({ room: r }: { room: PublicRoom }) => {
      setRoom(r);
      setPlayers(r.players);
      setParagraph(r.paragraph);
      setRaceResult(null);
      setRematchVotes({ count: 0, total: 2 });
      setHasVoted(false);
      setPhase("waiting");
    });

    socket.on("player_left", () => {
      setError("Your opponent left the room.");
      setPhase("lobby");
      setRoom(null);
      setPlayers([]);
    });

    socket.on("error", ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreate = useCallback((name: string) => {
    setError("");
    socketRef.current?.emit("create_room", { playerName: name });
  }, []);

  const handleJoin = useCallback((name: string, code: string) => {
    setError("");
    socketRef.current?.emit("join_room", { playerName: name, roomCode: code });
  }, []);

  const handleProgressUpdate = useCallback((data: ProgressUpdate) => {
    socketRef.current?.emit("progress_update", data);
  }, []);

  const handleRematch = useCallback(() => {
    socketRef.current?.emit("rematch_vote");
    setHasVoted(true);
  }, []);

  return (
    <div className="app">
      {phase === "lobby" && (
        <Lobby onCreate={handleCreate} onJoin={handleJoin} error={error} />
      )}
      {phase === "waiting" && (
        <WaitingRoom room={room} players={players} playerId={playerId} />
      )}
      {(phase === "countdown" || phase === "racing") && (
        <Race
          paragraph={paragraph}
          players={players}
          playerId={playerId}
          countdown={countdown}
          phase={phase}
          onProgressUpdate={handleProgressUpdate}
          room={room}
          timeRemaining={timeRemaining}
          roundDuration={roundDuration}
        />
      )}
      {phase === "finished" && (
        <WinnerScreen
          result={raceResult}
          playerId={playerId}
          rematchVotes={rematchVotes}
          hasVoted={hasVoted}
          onRematch={handleRematch}
          room={room}
        />
      )}
    </div>
  );
}
