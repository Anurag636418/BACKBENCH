import React, { useState, useEffect, useRef } from "react";
import { Client, Room } from "@colyseus/sdk";
import { ClassroomScene } from "./game/book-cricket/ClassroomScene";
import { INK, INK_2, INK_3, PAPER, TIN, RED, slip, HAND, STAMP } from "./designTokens";
import { useIsMobile } from "./hooks/useIsMobile";
import { trackEvent } from "./analytics";

interface FriendBookCricketProps {
  onBack: () => void;
  challengeId?: string | null;
}

const SERVER_URL = "ws://localhost:2567";

export default function FriendBookCricketGame({ onBack, challengeId }: FriendBookCricketProps) {
  const isMobile = useIsMobile();
  // Lifecycle
  const [status, setStatus] = useState<"loading" | "name_entry" | "connecting" | "connected" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Player info
  const [myName, setMyName] = useState("");

  // Challenge
  const [myChallenge, setMyChallenge] = useState<string | null>(challengeId || null);
  const [copied, setCopied] = useState(false);

  // Game state
  const [gameState, setGameState] = useState<any>(null);
  const [presentationState, setPresentationState] = useState<any>(null);
  const [isBookAnimating, setIsBookAnimating] = useState(false);

  // Audio
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  // Refs
  const roomRef = useRef<Room | null>(null);
  const sceneRef = useRef<ClassroomScene | null>(null);
  const gameStateRef = useRef<any>(null);
  const isBookAnimatingRef = useRef(false);
  const animatingForRef = useRef<"p1" | "p2" | null>(null);
  const mySessionIdRef = useRef<string>("");

  // Analytics Guards
  const hasTrackedOpenedRef = useRef(false);
  const hasTrackedJoinedRef = useRef(false);
  const hasTrackedStartRef = useRef(false);
  const hasTrackedCompleteRef = useRef(false);
  const hasTrackedForfeitRef = useRef(false);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Audio init
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

  // If friend is joining via URL, load challenge info first
  useEffect(() => {
    if (challengeId && status === "loading") {
      (async () => {
        try {
          const res = await fetch(`${SERVER_URL.replace("ws://", "http://")}/api/challenges/${challengeId}`);
          const data = await res.json();
          if (!res.ok) {
            setErrorMsg(data.error || "Challenge not found");
            setStatus("error");
            return;
          }
          if (data.status === "COMPLETED") {
            setErrorMsg("This challenge has already been played.");
            setStatus("error");
            return;
          }
          if (!data.roomId) {
            setErrorMsg("This challenge room is not ready yet. Try again in a moment.");
            setStatus("error");
            return;
          }
          if (!hasTrackedOpenedRef.current) {
            trackEvent("challenge_opened", { game_type: "BOOK_CRICKET" });
            hasTrackedOpenedRef.current = true;
          }
          setStatus("name_entry");
        } catch {
          setErrorMsg("Could not reach the server.");
          setStatus("error");
        }
      })();
    } else if (!challengeId && status === "loading") {
      setStatus("name_entry");
    }
  }, [challengeId, status]);

  const initScene = () => {
    if (sceneRef.current) return;
    const scene = new ClassroomScene(
      "three-container-friend",
      () => {
        if (roomRef.current && !isBookAnimatingRef.current) {
          roomRef.current.send("flip");
        }
      },
      (_page, _resultMsg) => {
        setPresentationState(gameStateRef.current);
      },
      () => {
        animatingForRef.current = null;
        isBookAnimatingRef.current = false;
        setIsBookAnimating(false);
      }
    );
    sceneRef.current = scene;
  };

  const setupRoomListeners = (room: Room) => {
    roomRef.current = room;
    mySessionIdRef.current = room.sessionId;

    room.onStateChange((state: any) => {
      const ns = state.toJSON();
      setGameState(ns);

      setPresentationState((prev: any) => {
        if (!prev) return ns;

        // Init scene when match actually starts
        if ((ns.gameStatus === "PLAYER_1_BATTING" || ns.gameStatus === "READY") && !sceneRef.current) {
          setTimeout(() => initScene(), 50);
        }

        // Detect page flip
        if (ns.currentPage !== prev.currentPage && ns.currentPage !== 0) {
          isBookAnimatingRef.current = true;
          setIsBookAnimating(true);

          const wasP1Turn = prev.gameStatus === "PLAYER_1_BATTING" || prev.gameStatus === "SUPER_OVER_P1";
          animatingForRef.current = wasP1Turn ? "p1" : "p2";

          if (sceneRef.current) {
            sceneRef.current.playInteractionSequence(ns.currentPage, ns.lastResult);
          }
          return prev;
        }

        if (!isBookAnimatingRef.current) {
          return ns;
        }
        return prev;
      });
    });

    room.onLeave(() => {
      setStatus("error");
      setErrorMsg("Disconnected from the game.");
    });
  };

  const handleStartChallenge = async () => {
    if (!myName.trim()) return;
    const trimmedName = myName.trim();

    if (challengeId) {
      // I am the FRIEND joining
      setStatus("connecting");
      try {
        const res = await fetch(`${SERVER_URL.replace("ws://", "http://")}/api/challenges/${challengeId}`);
        const data = await res.json();
        if (!res.ok || !data.roomId) {
          setErrorMsg("Could not find the challenge room.");
          setStatus("error");
          return;
        }
        console.log(`[JOIN FRIEND ROOM]`);
        console.log(`challengeId: ${challengeId}`);
        console.log(`roomId: ${data.roomId}`);
        const client = new Client(SERVER_URL);
        const room = await client.joinById(data.roomId, { name: trimmedName });
        setupRoomListeners(room);
        setStatus("connected");
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes("locked")) {
          setErrorMsg("This challenge is full. Two players are already in this match.");
        } else {
          setErrorMsg(err.message || "Failed to join challenge.");
        }
        setStatus("error");
      }
    } else {
      // I am the CREATOR
      setStatus("connecting");
      try {
        // 1. Create challenge in DB
        const cRes = await fetch(`${SERVER_URL.replace("ws://", "http://")}/api/challenges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "BOOK_CRICKET" })
        });
        const cData = await cRes.json();
        if (!cRes.ok) throw new Error(cData.error);

        // 2. Create Colyseus room
        const client = new Client(SERVER_URL);
        const room = await client.create("friend-book-cricket", { name: trimmedName, challengeId: cData.id });

        // 3. Map challenge to room
        await fetch(`${SERVER_URL.replace("ws://", "http://")}/api/challenges/${cData.id}/room`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.roomId })
        });

        trackEvent("challenge_created", { game_type: "BOOK_CRICKET" });
        setMyChallenge(cData.id);
        setupRoomListeners(room);
        setStatus("connected");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to create challenge.");
        setStatus("error");
      }
    }
  };

  const handleCopy = () => {
    const url = `${window.location.origin}/?challenge=${myChallenge}`;
    navigator.clipboard.writeText(url);
    trackEvent("challenge_link_shared", { share_method: "copy_link" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derived state
  const gs = presentationState?.gameStatus || "";
  const p1 = presentationState?.player1;
  const p2 = presentationState?.player2;
  const p1Name = p1?.name || "Player 1";
  const p2Name = p2?.name || "Player 2";
  
  const isPlayer1 = presentationState?.player1SessionId === mySessionIdRef.current;
  const isPlayer2 = presentationState?.player2SessionId === mySessionIdRef.current;
  
  const myLabel = isPlayer1 ? p1Name : isPlayer2 ? p2Name : "Observer";
  const oppLabel = isPlayer1 ? p2Name : isPlayer2 ? p1Name : "Players";
  const myScore = isPlayer1 ? (p1?.score ?? 0) : (p2?.score ?? 0);
  const oppScore = isPlayer1 ? (p2?.score ?? 0) : (p1?.score ?? 0);
  const myBalls = isPlayer1 ? (p1?.balls ?? 0) : (p2?.balls ?? 0);
  const oppBalls = isPlayer1 ? (p2?.balls ?? 0) : (p1?.balls ?? 0);
  const myStatus = isPlayer1 ? (p1?.status ?? "BATTING") : (p2?.status ?? "BATTING");
  const oppStatus = isPlayer1 ? (p2?.status ?? "BATTING") : (p1?.status ?? "BATTING");

  const isMyTurn = (isPlayer1 && (gs === "PLAYER_1_BATTING" || gs === "SUPER_OVER_P1")) ||
                   (isPlayer2 && (gs === "PLAYER_2_BATTING" || gs === "SUPER_OVER_P2"));

  const countdown = presentationState?.countdown ?? 0;
  const isSuperOver = gs === "SUPER_OVER_P1" || gs === "SUPER_OVER_P2";

  // Analytics Watcher
  useEffect(() => {
    // 1. Challenge Joined (I am player 2 and successfully connected)
    if (status === "connected" && isPlayer2 && !hasTrackedJoinedRef.current) {
      trackEvent("challenge_joined", { game_type: "BOOK_CRICKET" });
      hasTrackedJoinedRef.current = true;
    }

    // 2. Match Started
    if ((gs === "PLAYER_1_BATTING" || gs === "PLAYER_2_BATTING") && !hasTrackedStartRef.current) {
      trackEvent("friend_match_started");
      hasTrackedStartRef.current = true;
    }

    // 3. Match Completed & Forfeit
    if (gs === "GAME_OVER" && !hasTrackedCompleteRef.current) {
      const p1Final = p1?.score ?? 0;
      const p2Final = p2?.score ?? 0;
      const myFinal = isPlayer1 ? p1Final : p2Final;
      const oppFinal = isPlayer1 ? p2Final : p1Final;
      
      let resResult = "tie";
      if (presentationState.winner === (isPlayer1 ? "PLAYER_1" : "PLAYER_2") || presentationState.winner === (isPlayer1 ? "player1" : "player2")) {
        resResult = "win";
      } else if (presentationState.winner !== "tie") {
        resResult = "loss";
      }

      if (presentationState.isForfeit && !hasTrackedForfeitRef.current) {
        trackEvent("friend_match_forfeit", { result: resResult });
        hasTrackedForfeitRef.current = true;
      }

      trackEvent("friend_match_completed", {
        result: resResult,
        score: myFinal,
        opponent_score: oppFinal
      });
      hasTrackedCompleteRef.current = true;
    }
  }, [status, isPlayer1, isPlayer2, gs, presentationState?.winner, presentationState?.isForfeit, p1?.score, p2?.score]);

  // ── NAME ENTRY / WAITING / ERROR SCREENS ──
  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#404a37" }}>
        <div style={{ ...slip(0), padding: "24px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: HAND, fontSize: 20, color: INK }}>Loading challenge...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#404a37" }}>
        <div style={{ ...slip(-2), padding: "24px 40px", textAlign: "center", maxWidth: 340 }}>
          <div style={{ fontFamily: STAMP, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: RED, marginBottom: 12 }}>Oops</div>
          <div style={{ fontFamily: HAND, fontSize: 18, color: INK }}>{errorMsg}</div>
          <button onClick={onBack} style={{
            marginTop: 20, padding: "10px 24px", fontFamily: HAND, fontSize: 16, cursor: "pointer",
            backgroundColor: INK, color: PAPER, border: "none", borderRadius: 4
          }}>Back to Menu</button>
        </div>
      </div>
    );
  }

  if (status === "name_entry" || status === "connecting") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#404a37" }}>
        <div style={{ ...slip(1.5), padding: "28px 40px 32px", textAlign: "center", maxWidth: 340 }}>
          <div style={{ fontFamily: STAMP, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: INK_3, marginBottom: 6 }}>
            {challengeId ? "Join Challenge" : "Challenge a Friend"}
          </div>
          <div style={{ fontFamily: HAND, fontSize: 22, color: INK, marginBottom: 20 }}>
            {challengeId ? "Your benchmate challenged you!" : "Who's sitting at this desk?"}
          </div>
          <input
            type="text"
            placeholder="Your name"
            value={myName}
            onChange={e => setMyName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === "Enter" && handleStartChallenge()}
            style={{
              width: "100%", padding: "10px 14px", fontFamily: HAND, fontSize: 18,
              border: `1.5px solid ${INK_3}`, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)",
              color: INK, outline: "none", boxSizing: "border-box", textAlign: "center"
            }}
          />
          <button
            onClick={handleStartChallenge}
            disabled={!myName.trim() || status !== "name_entry"}
            style={{
              marginTop: 16, padding: "10px 24px", fontFamily: HAND, fontSize: 18, cursor: myName.trim() ? "pointer" : "not-allowed",
              backgroundColor: TIN, color: PAPER, border: "none", borderRadius: 4, width: "100%",
              opacity: myName.trim() ? 1 : 0.5
            }}
          >
            {status === "connecting" ? (challengeId ? "Joining..." : "Creating...") : challengeId ? "Join Game" : "Create Challenge"}
          </button>
          <button onClick={onBack} style={{
            marginTop: 10, padding: "8px", fontFamily: HAND, fontSize: 14, cursor: "pointer",
            background: "none", border: "none", color: INK_2, textDecoration: "underline"
          }}>Back</button>
        </div>
      </div>
    );
  }

  // ── ACTIVE GAME ──
  return (
    <div className="app" style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Three.js Canvas */}
      <div id="three-container-friend" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }} />

      {/* Vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "radial-gradient(ellipse 78% 72% at 50% 56%, transparent 52%, rgba(26,20,14,0.42) 100%)"
      }}/>

      {/* UI Overlay */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10, pointerEvents: "none" }}>
        
        {(!gs || gs === "WAITING_FOR_OPPONENT") && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <div style={{ ...slip(-1), padding: "28px 5vw 32px", textAlign: "center", maxWidth: 380, width: "90%", boxSizing: "border-box", pointerEvents: "auto" }}>
              <div style={{ fontFamily: STAMP, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: INK, marginBottom: 16 }}>
                Your Challenge is Ready
              </div>
              <div style={{
                backgroundColor: "rgba(255,255,255,0.35)", border: `1.5px dashed ${INK_3}`,
                padding: "12px", fontSize: 22, fontFamily: HAND, color: INK, letterSpacing: "0.15em",
                marginBottom: 16, borderRadius: 4
              }}>
                {myChallenge}
              </div>
              <div style={{ fontFamily: HAND, fontSize: 16, color: INK_2, marginBottom: 16 }}>
                Waiting for your benchmate...
              </div>
              <div style={{
                backgroundColor: "rgba(255,255,255,0.4)", border: `1px dashed ${INK_3}`,
                padding: "8px", fontSize: 13, wordBreak: "break-all", marginBottom: 16,
                borderRadius: 4, fontFamily: HAND, color: INK_2
              }}>
                {window.location.origin}/?challenge={myChallenge}
              </div>
              <button onClick={handleCopy} style={{
                padding: "10px 20px", fontSize: 16, fontFamily: HAND, cursor: "pointer",
                backgroundColor: copied ? "#4CAF50" : INK, color: PAPER, border: "none", borderRadius: 4, width: "100%"
              }}>
                {copied ? "Copied!" : "Copy Challenge Link"}
              </button>
              <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 12 }}>
                Send this to the person sitting next to you.
              </div>
            </div>
          </div>
        )}

        {gs === "READY" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <div style={{ ...slip(-1), padding: "28px 5vw 32px", textAlign: "center", maxWidth: 380, width: "90%", boxSizing: "border-box", pointerEvents: "auto" }}>
              <div style={{ fontFamily: STAMP, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: INK, marginBottom: 16 }}>
                Your friend joined!
              </div>
              {countdown > 0 ? (
                <div style={{ fontFamily: HAND, fontSize: 72, color: TIN, lineHeight: 1, margin: "20px 0" }}>
                  {countdown}
                </div>
              ) : (
                <div style={{ fontFamily: HAND, fontSize: 28, color: INK, margin: "16px 0" }}>Match Starting...</div>
              )}
            </div>
          </div>
        )}

        {(gs !== "" && gs !== "WAITING_FOR_OPPONENT" && gs !== "READY") && presentationState && (
          <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>

            {/* TOP ROW */}
            <div style={{ display: "flex", justifyContent: isMobile ? "center" : "space-between", alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
              
              {!isMobile && (
                <div style={{ ...slip(1.8), minWidth: 140, padding: "11px 18px 13px", pointerEvents: "auto" }}>
                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.2em", color: INK_3, textTransform: "uppercase", marginBottom: 4 }}>{myLabel} (You)</div>
                  <div style={{ fontFamily: HAND, fontSize: 32, lineHeight: 1, color: INK }}>{myScore}</div>
                  <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 2 }}>{myBalls}/6 balls</div>
                  <div style={{
                    fontFamily: STAMP, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 5,
                    color: myStatus === "OUT" ? RED : myStatus === "FINISHED" ? TIN : INK_2
                  }}>{myStatus}</div>
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

                <div style={{ textAlign: "center", pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ ...slip(0), padding: "8px 24px 10px", marginTop: -8 }}>
                    {isMobile ? (
                      <>
                        <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.22em", color: INK_3, textTransform: "uppercase" as const }}>YOU {myScore} ({myBalls}) VS {oppScore} ({oppBalls}) {oppLabel}</div>
                        <div style={{ fontFamily: HAND, fontSize: 15, color: INK, marginTop: 2 }}>
                          {isMyTurn ? "Your turn!" : gs === "GAME_OVER" ? "Game Over" : `${isPlayer1 ? p2Name : p1Name}'s turn...`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: STAMP, fontSize: 12, letterSpacing: "0.15em", color: INK }}>Match {myChallenge}</div>
                        <div style={{ fontFamily: HAND, fontSize: 15, color: INK, marginTop: 2 }}>
                          {isMyTurn ? "Your turn — tap the book!" : 
                           gs === "GAME_OVER" ? "Game Over" :
                           `${isPlayer1 ? p2Name : p1Name}'s turn...`}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!isMobile && (
                <div style={{ ...slip(-2), minWidth: 140, padding: "11px 18px 13px", textAlign: "right", pointerEvents: "auto" }}>
                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.2em", color: INK_3, textTransform: "uppercase", marginBottom: 4 }}>{oppLabel}</div>
                  <div style={{ fontFamily: HAND, fontSize: 32, lineHeight: 1, color: INK }}>{oppScore}</div>
                  <div style={{ fontFamily: HAND, fontSize: 13, color: INK_2, marginTop: 2 }}>{oppBalls}/6 balls</div>
                  <div style={{
                    fontFamily: STAMP, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 5,
                    color: oppStatus === "OUT" ? RED : oppStatus === "FINISHED" ? TIN : INK_2
                  }}>{oppStatus}</div>
                </div>
              )}
            </div>

            {/* BOTTOM ROW */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              {/* Super Over */}
              <div>
                {isSuperOver && (
                  <div style={{ ...slip(-3), padding: "12px 18px 14px", borderTop: `3px solid ${TIN}`, pointerEvents: "auto" }}>
                    <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.18em", color: TIN, textTransform: "uppercase", marginBottom: 4 }}>
                      Super Over — Rd {presentationState.superOverRound}
                    </div>
                    <div style={{ fontFamily: HAND, fontSize: 15, color: INK }}>
                      {p1Name}: <b>{presentationState.superOverP1Score}</b>&nbsp;&nbsp;
                      {p2Name}: <b>{presentationState.superOverP2Score}</b>
                    </div>
                  </div>
                )}
              </div>

              {/* Scorecard */}
              {!isMobile && (
                <div style={{
                  position: "relative", width: 210, backgroundColor: PAPER,
                  borderRadius: "3px 6px 6px 3px", padding: "10px 12px 16px 22px",
                  fontFamily: HAND, color: INK,
                  backgroundImage: `repeating-linear-gradient(transparent 0 23px, rgba(36,66,143,0.18) 23px 24px)`,
                  backgroundPosition: "0 30px",
                  boxShadow: `0 2px 0 #ddd4bd, 0 4px 0 #cec5ae, 0 6px 0 #beb59f, 0 18px 36px rgba(0,0,0,0.48)`,
                  transform: "rotate(2.5deg)", pointerEvents: "auto", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 16, background: "linear-gradient(90deg, rgba(60,38,16,0.35), rgba(60,38,16,0.08) 60%, transparent)", borderRadius: "3px 0 0 3px" }}/>
                  <div style={{ position: "absolute", left: 7, top: 16, bottom: 16, width: 2, background: "repeating-linear-gradient(180deg, rgba(36,66,143,0.45) 0 8px, transparent 8px 17px)" }}/>

                  <div style={{ fontFamily: STAMP, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#5a6788", marginBottom: 10, textAlign: "center" }}>Scorecard</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: STAMP, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_3, marginBottom: 6 }}>
                    <span>{p1Name}</span><span>{p2Name}</span>
                  </div>

                  {[0,1,2,3,4,5].map(i => {
                    const p1HistArr = p1?.history ? Array.from(p1.history) : [];
                    const p2HistArr = p2?.history ? Array.from(p2.history) : [];
                    const ph = p1HistArr[i] as string | undefined;
                    const ch = p2HistArr[i] as string | undefined;
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
                    <span>{p1?.score ?? 0}</span><span>{p2?.score ?? 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* GAME OVER */}
            {gs === "GAME_OVER" && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%) rotate(-4deg)",
                ...slip(-4), textAlign: "center", padding: "24px 5vw 28px",
                pointerEvents: "auto", zIndex: 50, maxWidth: 340,
                width: "90%", boxSizing: "border-box"
              }}>
                <div style={{ fontFamily: STAMP, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: INK_3, marginBottom: 8 }}>Match Result</div>
                <div style={{ fontFamily: HAND, fontSize: 42, lineHeight: 1, color: INK }}>
                  {presentationState.winner === "PLAYER_1"
                    ? (isPlayer1 ? "You Win!" : `${p1Name} Wins!`)
                    : presentationState.winner === "PLAYER_2"
                    ? (!isPlayer1 ? "You Win!" : `${p2Name} Wins!`)
                    : "Match Tied!"}
                </div>
                {presentationState.isForfeit && (
                  <div style={{ fontFamily: HAND, fontSize: 18, color: INK_2, marginTop: 8 }}>
                    {isPlayer1 ? p2Name : p1Name} disconnected or forfeit.
                  </div>
                )}
                <button onClick={onBack} style={{
                  marginTop: 24, padding: "10px 24px", fontFamily: HAND, fontSize: 18, cursor: "pointer",
                  backgroundColor: INK, color: PAPER, border: "none", borderRadius: 4, width: "100%"
                }}>Back to Menu</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
