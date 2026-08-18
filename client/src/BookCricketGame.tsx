import { useEffect, useRef, useState } from "react";
import { Client, Room } from "@colyseus/sdk";
import { ClassroomScene } from "./game/book-cricket/ClassroomScene";
import { INK, INK_2, INK_3, RED, TIN, PAPER, HAND, STAMP, slip } from "./designTokens";
import { useIsMobile } from "./hooks/useIsMobile";
import { trackEvent } from "./analytics";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:2567";

export default function BookCricketGame({ onBack }: { onBack?: () => void }) {
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState<string>("");
  
  const [gameState, setGameState] = useState<any>(null);
  const [presentationState, setPresentationState] = useState<any>(null);
  const [isBookAnimating, setIsBookAnimating] = useState<boolean>(false);
  
  const [playerHistory, setPlayerHistory] = useState<string[]>([]);
  const [computerHistory, setComputerHistory] = useState<string[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);

  // Challenge States
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const sceneRef = useRef<ClassroomScene | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  
  const gameStateRef = useRef<any>(null);
  const isBookAnimatingRef = useRef<boolean>(false);
  const animatingForRef = useRef<"player" | "computer" | null>(null);

  const hasTrackedStartRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);

  // Keep ref up to date
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Analytics Tracking
  useEffect(() => {
    if (status === "connected" && !hasTrackedStartRef.current) {
      trackEvent("practice_game_started");
      hasTrackedStartRef.current = true;
    }

    if (presentationState?.gameStatus === "GAME_OVER" && !hasTrackedCompleteRef.current) {
      trackEvent("practice_game_completed", {
        result: presentationState.winner === "PLAYER" ? "win" : presentationState.winner === "COMPUTER" ? "loss" : "tie",
        score: presentationState.player?.score || 0,
        opponent_score: presentationState.computer?.score || 0
      });
      hasTrackedCompleteRef.current = true;
    }
  }, [status, presentationState?.gameStatus, presentationState?.winner, presentationState?.player?.score, presentationState?.computer?.score]);

  // Init audio
  useEffect(() => {
    ambienceRef.current = new Audio("/assets/classroom.mp3");
    ambienceRef.current.loop = true;
    ambienceRef.current.volume = 0.5;

    bellRef.current = new Audio("/assets/bell.mp3");
    bellRef.current.volume = 0.8;
  }, []);

  useEffect(() => {
    if (isAudioEnabled && presentationState?.gameStatus !== "GAME_OVER") {
      ambienceRef.current?.play().catch(() => {});
    } else {
      ambienceRef.current?.pause();
    }
  }, [isAudioEnabled, presentationState?.gameStatus]);

  useEffect(() => {
    if (isAudioEnabled && presentationState?.gameStatus === "GAME_OVER") {
      bellRef.current?.play().catch(() => {});
    }
  }, [presentationState?.gameStatus, isAudioEnabled]);

  useEffect(() => {
    // 1. Initialize Three.js Classroom
    const scene = new ClassroomScene(
      "three-container",
      () => {
        // on book click
        if (roomRef.current && !isBookAnimatingRef.current) {
          roomRef.current.send("flip");
        }
      },
      (page, resultMsg) => {
        // on result reveal (halfway through animation)
        // Update the presentation state so the UI shows the result while the book is still open
        const newState = gameStateRef.current;
        setPresentationState(newState);
      },
      () => {
        // on anim complete (book is closed again)
        const side = animatingForRef.current;
        animatingForRef.current = null;
        isBookAnimatingRef.current = false;
        setIsBookAnimating(false);
        
        const newState = gameStateRef.current;
        if (side === "player") {
          setPlayerHistory(h => [...h, newState.lastResult]);
        } else if (side === "computer") {
          setComputerHistory(h => [...h, newState.lastResult]);
        }
        // State is already updated during reveal, so we don't need to set it here again
      }
    );
    sceneRef.current = scene;

    // 2. Connect Colyseus
    const client = new Client(SERVER_URL);
    let room: Room;
    let isMounted = true;

    const connect = async () => {
      try {
        room = await client.joinOrCreate("book-cricket");
        if (!isMounted) {
          room.leave();
          return;
        }

        roomRef.current = room;
        setStatus("connected");

        room.onStateChange((state) => {
          const newState = state.toJSON();
          setGameState(newState);

          setPresentationState((prev: any) => {
            if (!prev) return newState; // initial sync

            // Detect page flip
            if (newState.currentPage !== prev.currentPage && newState.currentPage !== 0) {
              isBookAnimatingRef.current = true;
              setIsBookAnimating(true);
              // Determine whose turn it is from the state at the moment of the flip
              const isComputerTurn = prev.gameStatus === "COMPUTER_TURN" ||
                (prev.gameStatus === "SUPER_OVER" && prev.superOverPlayerStatus !== "BATTING");
              animatingForRef.current = isComputerTurn ? "computer" : "player";
              
              if (sceneRef.current) {
                sceneRef.current.playInteractionSequence(newState.currentPage, newState.lastResult);
              }
              return prev; // hold presentation state until reveal callback
            }

            if (!isBookAnimatingRef.current) {
               if (newState.player.balls === 0 && newState.computer.balls === 0) {
                 setPlayerHistory([]);
                 setComputerHistory([]);
               }
               return newState;
            }

            return prev;
          });
        });

        room.onLeave(() => {
          if (isMounted) setStatus("disconnected");
        });

        room.onError((code, message) => {
          if (isMounted) setError(`Room error (${code}): ${message}`);
        });
      } catch (err) {
        if (isMounted) {
          setStatus("disconnected");
          setError(err instanceof Error ? err.message : "Failed to connect to server");
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (roomRef.current) roomRef.current.leave();
      if (sceneRef.current) sceneRef.current.dispose();
    };
  }, []);

  const handleReconnect = () => {
    window.location.reload();
  };

  const handleCreateChallenge = async () => {
    setChallengeLoading(true);
    setChallengeError(null);
    try {
      const res = await fetch("http://localhost:2567/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "BOOK_CRICKET", creatorScore: pScore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create challenge");
      setChallengeId(data.id);
    } catch (err: any) {
      setChallengeError(err.message);
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleCopy = () => {
    const url = `${window.location.origin}/?challenge=${challengeId}`;
    navigator.clipboard.writeText(url);
    setChallengeCopied(true);
    setTimeout(() => setChallengeCopied(false), 2000);
  };

  const handleFlip = () => {
    if (roomRef.current && !isBookAnimating) {
      roomRef.current.send("flip");
    }
  };

  const isSuperOver = presentationState?.gameStatus === "SUPER_OVER";
  
  const pScore = presentationState?.player?.score ?? 0;
  const cScore = presentationState?.computer?.score ?? 0;

  const pBalls = presentationState?.player?.balls ?? 0;
  const cBalls = presentationState?.computer?.balls ?? 0;
  
  const pStatus = presentationState?.player?.status ?? "BATTING";
  const cStatus = presentationState?.computer?.status ?? "BATTING";
  
  const isPlayerTurn = presentationState?.gameStatus === "PLAYER_TURN" || 
      (isSuperOver && presentationState?.superOverPlayerStatus === "BATTING");

  const canFlip = isPlayerTurn && !isBookAnimating;

  return (
    <div className="app" style={{ 
      fontFamily: "monospace", 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh", 
      overflow: "hidden" 
    }}>
      {/* Three.js Canvas Layer */}
      <div id="three-container" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }} />

      {/* Vignette — deepens the desk atmosphere */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "radial-gradient(ellipse 78% 72% at 50% 56%, transparent 52%, rgba(26,20,14,0.42) 100%)"
      }}/>

      {/* React UI Overlay Layer */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10, pointerEvents: "none" }}>
        
        {status === "connecting" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", ...slip(0), pointerEvents: "auto", padding: "12px 24px 14px" }}>
            <span style={{ fontFamily: HAND, color: INK, fontSize: 18 }}>Connecting to server…</span>
          </div>
        )}
        {status === "disconnected" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", ...slip(0), pointerEvents: "auto", padding: "12px 24px 14px" }}>
            <span style={{ fontFamily: HAND, color: RED, fontSize: 18 }}>Disconnected. Reload to try again.</span>
          </div>
        )}

        {status === "connected" && presentationState && (
          <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
            
            {/* ── TOP ROW ── */}
            <div style={{ display: "flex", justifyContent: isMobile ? "center" : "space-between", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
              
              {!isMobile && (
                <div style={{
                  ...slip(1.8),
                  minWidth: 140, padding: "11px 18px 13px",
                  pointerEvents: "auto",
                }}>
                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.2em", color: INK_3, textTransform: "uppercase" as const, marginBottom: 4 }}>You</div>
                  <div style={{ fontFamily: HAND, fontSize: 32, lineHeight: 1, color: INK }}>{pScore}</div>
                  <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 2 }}>{pBalls}/6 balls</div>
                  <div style={{
                    fontFamily: STAMP, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginTop: 5,
                    color: pStatus === "OUT" ? RED : pStatus === "FINISHED" ? TIN : INK_2
                  }}>{pStatus}</div>
                </div>
              )}

              {/* CENTER — status chit & Audio toggle */}
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", margin: isMobile ? "0 auto" : 0 }}>
                {/* Audio Toggle */}
                <button 
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  style={{
                    ...slip(-4),
                    padding: "8px", cursor: "pointer", pointerEvents: "auto",
                    background: "none", border: "none", outline: "none",
                    fontFamily: HAND, fontSize: 16, color: isAudioEnabled ? INK : TIN,
                  }}
                  title="Toggle Ambience"
                >
                  {isAudioEnabled ? "🔊" : "🔇"}
                </button>

                <div style={{
                  ...slip(-1.5),
                  textAlign: "center" as const, padding: "9px 20px 11px",
                }}>
                  {isMobile ? (
                    <>
                      <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.22em", color: INK_3, textTransform: "uppercase" as const }}>YOU {pScore} ({pBalls}) VS {cScore} ({cBalls}) COMP</div>
                      <div style={{ fontFamily: HAND, fontSize: 15, color: INK, marginTop: 2 }}>
                        {isPlayerTurn ? "Your turn!" : presentationState.gameStatus === "GAME_OVER" ? "Game Over" : "Computer is thinking..."}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.22em", color: INK_3, textTransform: "uppercase" as const }}>Book Cricket</div>
                      <div style={{ fontFamily: HAND, fontSize: 17, color: INK, marginTop: 2 }}>
                        {isPlayerTurn ? "Your turn — tap the book!" : presentationState.gameStatus === "GAME_OVER" ? "Game Over" : "Computer is thinking..."}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!isMobile && (
                <div style={{
                  ...slip(-2.5),
                  minWidth: 140, padding: "11px 18px 13px",
                  textAlign: "right", pointerEvents: "auto",
                }}>
                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.2em", color: INK_3, textTransform: "uppercase" as const, marginBottom: 4 }}>Computer</div>
                  <div style={{ fontFamily: HAND, fontSize: 32, lineHeight: 1, color: INK }}>{cScore}</div>
                  <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 2 }}>{cBalls}/6 balls</div>
                  <div style={{
                    fontFamily: STAMP, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginTop: 5,
                    color: cStatus === "OUT" ? RED : cStatus === "FINISHED" ? TIN : INK_2
                  }}>{cStatus}</div>
                </div>
              )}
            </div>

            {/* ── BOTTOM ROW ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>

              {/* SUPER OVER chit — bottom-left (only when active) */}
              <div>
                {isSuperOver && (
                  <div style={{
                    ...slip(-3), padding: "12px 18px 14px",
                    borderTop: `3px solid ${TIN}`, pointerEvents: "auto"
                  }}>
                    <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.18em", color: TIN, textTransform: "uppercase", marginBottom: 4 }}>
                      Super Over — Rd {presentationState.superOverRound}
                    </div>
                    <div style={{ fontFamily: HAND, fontSize: 15, color: INK }}>
                      You: <b>{presentationState.superOverPlayerScore}</b>&nbsp;&nbsp; Comp: <b>{presentationState.superOverComputerScore}</b>
                    </div>
                  </div>
                )}
              </div>

              {/* SCORECARD — exercise book bottom-right */}
              {!isMobile && (
                <div style={{
                  position: "relative",
                  width: 210,
                  backgroundColor: PAPER,
                  borderRadius: "3px 6px 6px 3px",
                  padding: "10px 12px 16px 22px",
                  fontFamily: HAND,
                  color: INK,
                  backgroundImage: `repeating-linear-gradient(transparent 0 23px, rgba(36,66,143,0.18) 23px 24px)`,
                  backgroundPosition: "0 30px",
                  boxShadow: `0 2px 0 #ddd4bd, 0 4px 0 #cec5ae, 0 6px 0 #beb59f, 0 18px 36px rgba(0,0,0,0.48)`,
                  transform: "rotate(2.5deg)",
                  pointerEvents: "auto",
                  overflow: "hidden",
                }}>
                  {/* Spine shadow */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 16, background: "linear-gradient(90deg, rgba(60,38,16,0.35), rgba(60,38,16,0.08) 60%, transparent)", borderRadius: "3px 0 0 3px" }}/>
                  {/* Stitching */}
                  <div style={{ position: "absolute", left: 7, top: 16, bottom: 16, width: 2, background: "repeating-linear-gradient(180deg, rgba(36,66,143,0.45) 0 8px, transparent 8px 17px)" }}/>

                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#5a6788", marginBottom: 10, textAlign: "center" }}>Scorecard</div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: STAMP, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_3, marginBottom: 6 }}>
                    <span>You</span><span>Comp</span>
                  </div>

                  {[0,1,2,3,4,5].map(i => {
                    const ph = playerHistory[i];
                    const ch = computerHistory[i];
                    const pVal = ph ? ph.replace(" RUNS","").replace("+","") : "—";
                    const cVal = ch ? ch.replace(" RUNS","").replace("+","") : "—";
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", lineHeight: "24px", fontSize: 17 }}>
                        <span style={{ color: ph === "OUT" ? RED : ph ? INK : INK_3 }}>{pVal}</span>
                        <span style={{ color: ch === "OUT" ? RED : ch ? INK : INK_3 }}>{cVal}</span>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1.5px solid ${INK_3}`, marginTop: 6, paddingTop: 6, fontSize: 20, fontWeight: "bold" }}>
                    <span>{pScore}</span><span>{cScore}</span>
                  </div>
                </div>
              )}

            </div>

            {/* ── GAME OVER — centre torn paper overlay ── */}
            {presentationState.gameStatus === "GAME_OVER" && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%) rotate(-4deg)",
                ...slip(-4),
                textAlign: "center", padding: "24px 5vw 28px",
                pointerEvents: "auto", zIndex: 50,
                maxWidth: 340, width: "90%", boxSizing: "border-box"
              }}>
                {challengeId ? (
                  <>
                    <div style={{ fontFamily: STAMP, fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: INK, marginBottom: 12 }}>Challenge Created</div>
                    <div style={{ fontFamily: HAND, fontSize: 18, color: INK_2 }}>Score to beat</div>
                    <div style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1, color: INK, marginBottom: 16 }}>{pScore}</div>
                    
                    <div style={{
                      backgroundColor: "rgba(255,255,255,0.4)", border: `1px dashed ${INK_3}`, 
                      padding: "8px", fontSize: 14, wordBreak: "break-all", marginBottom: 16,
                      borderRadius: 4
                    }}>
                      {window.location.origin}/?challenge={challengeId}
                    </div>

                    <button 
                      onClick={handleCopy}
                      style={{
                        padding: "10px 20px", fontSize: 16, fontFamily: HAND, cursor: "pointer",
                        backgroundColor: challengeCopied ? "#4CAF50" : INK, color: PAPER, border: "none", borderRadius: 4,
                        width: "100%"
                      }}
                    >
                      {challengeCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 12 }}>
                      Share this with your friend
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: STAMP, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: INK_3, marginBottom: 8 }}>Match Result</div>
                    <div style={{ fontFamily: HAND, fontSize: 48, lineHeight: 1, color: INK }}>
                      {presentationState.winner === "PLAYER" ? "You Win" : "Computer Wins"}
                    </div>
                    <div style={{ fontFamily: HAND, fontSize: 18, color: INK_2, marginTop: 8 }}>
                      {pScore} — {cScore}
                    </div>
                    
                    {challengeError && (
                      <div style={{ fontFamily: HAND, fontSize: 14, color: RED, marginTop: 12 }}>
                        Error: {challengeError}
                      </div>
                    )}
                    
                    <div style={{ marginTop: 24, borderTop: `1px dashed ${INK_3}`, paddingTop: 16 }}>
                      {onBack && (
                        <button 
                          onClick={onBack}
                          style={{
                            padding: "10px 20px", fontSize: 18, fontFamily: HAND, cursor: "pointer",
                            backgroundColor: TIN, color: PAPER, border: "none", borderRadius: 4, width: "100%"
                          }}
                        >
                          Back to Menu
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}


