import { useEffect, useRef, useState, useCallback } from "react";
import { Client, Room, Callbacks } from "@colyseus/sdk";

/** Shape of a player received from server state. */
interface PlayerData {
  x: number;
  y: number;
}

/** Colors assigned to players in join order. */
const PLAYER_COLORS = ["#6c5ce7", "#00cec9"];
const PLAYER_LABELS = ["Player A", "Player B"];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:2567";

function App() {
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [roomId, setRoomId] = useState<string>("");
  const [mySessionId, setMySessionId] = useState<string>("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState<string>("");

  const roomRef = useRef<Room | null>(null);

  // Connect to Colyseus on mount
  useEffect(() => {
    const client = new Client(SERVER_URL);

    let room: Room;
    let isMounted = true;

    const connect = async () => {
      try {
        room = await client.joinOrCreate("skeleton");
        
        // If component unmounted while connection was pending, leave immediately
        if (!isMounted) {
          room.leave();
          return;
        }

        roomRef.current = room;
        setRoomId(room.roomId);
        setMySessionId(room.sessionId);
        setStatus("connected");

        // Use the Colyseus 0.17 Callbacks API for state change listening
        const $ = Callbacks.get(room);

        // Listen for players being added to the authoritative state
        $.onAdd("players", (player: any, sessionId: any) => {
          setPlayers((prev) => {
            const next = new Map(prev);
            next.set(sessionId, { x: player.x, y: player.y });
            return next;
          });

          // Listen for changes to this player's properties
          $.onChange(player, () => {
            setPlayers((prev) => {
              const next = new Map(prev);
              next.set(sessionId, { x: player.x, y: player.y });
              return next;
            });
          });
        });

        // Listen for players being removed from authoritative state
        $.onRemove("players", (_player: any, sessionId: any) => {
          setPlayers((prev) => {
            const next = new Map(prev);
            next.delete(sessionId);
            return next;
          });
        });

        room.onLeave(() => {
          setStatus("disconnected");
        });

        room.onError((code, message) => {
          setError(`Room error (${code}): ${message}`);
        });
      } catch (err) {
        setStatus("disconnected");
        setError(err instanceof Error ? err.message : "Failed to connect to server");
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  // Send movement INTENT to server (not position — server is authoritative)
  const sendMove = useCallback((direction: string) => {
    if (roomRef.current) {
      roomRef.current.send("move", { direction });
    }
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
          sendMove("up");
          break;
        case "ArrowDown":
        case "s":
          sendMove("down");
          break;
        case "ArrowLeft":
        case "a":
          sendMove("left");
          break;
        case "ArrowRight":
        case "d":
          sendMove("right");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sendMove]);

  // Convert players map to array for rendering, preserving join order
  const playerEntries = Array.from(players.entries());

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">BACKBENCH</h1>
        <p className="subtitle">Walking Skeleton</p>
      </header>

      <div className="info-bar">
        <div className="info-item">
          <span className="info-label">Status</span>
          <span className={`status-badge status-${status}`}>
            {status === "connected" ? "● Connected" : status === "connecting" ? "◌ Connecting…" : "○ Disconnected"}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Room ID</span>
          <span className="info-value">{roomId || "—"}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Your ID</span>
          <span className="info-value mono">{mySessionId ? mySessionId.slice(0, 8) : "—"}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="main-content">
        <div className="players-panel">
          <h2 className="panel-title">Players ({playerEntries.length}/2)</h2>
          {playerEntries.length === 0 && (
            <p className="empty-text">No players connected</p>
          )}
          {playerEntries.map(([sessionId, data], index) => (
            <div
              key={sessionId}
              className={`player-card ${sessionId === mySessionId ? "player-card--you" : ""}`}
            >
              <div
                className="player-dot"
                style={{ backgroundColor: PLAYER_COLORS[index] || "#888" }}
              />
              <div className="player-info">
                <span className="player-name">
                  {PLAYER_LABELS[index] || `Player ${index + 1}`}
                  {sessionId === mySessionId && <span className="you-tag"> (You)</span>}
                </span>
                <span className="player-pos">
                  x: {Math.round(data.x)}, y: {Math.round(data.y)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="arena-panel">
          <h2 className="panel-title">Arena</h2>
          <p className="hint-text">Use arrow keys or WASD to move your square</p>
          <div className="arena">
            {playerEntries.map(([sessionId, data], index) => (
              <div
                key={sessionId}
                className={`player-square ${sessionId === mySessionId ? "player-square--you" : ""}`}
                style={{
                  backgroundColor: PLAYER_COLORS[index] || "#888",
                  left: data.x,
                  top: data.y,
                }}
              >
                <span className="player-square-label">
                  {sessionId === mySessionId ? "You" : PLAYER_LABELS[index]?.[7] || "?"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>
          Walking skeleton — proving client ↔ Colyseus ↔ authoritative server synchronization.
          <br />
          Open this page in two browser windows to test multiplayer.
        </p>
      </footer>
    </div>
  );
}

export default App;
