import { useState, useEffect } from "react";
import SkeletonGame from "./SkeletonGame";
import BookCricketGame from "./BookCricketGame";
import FriendBookCricketGame from "./FriendBookCricketGame";
import { INK, INK_2, INK_3, TIN, PAPER, HAND, STAMP, slip } from "./designTokens";
import { trackEvent } from "./analytics";

export default function App() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [challengeIdFromUrl, setChallengeIdFromUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const challenge = params.get("challenge");
    if (challenge) {
      setChallengeIdFromUrl(challenge);
      setSelectedGame("friend-challenge");
    }
  }, []);

  if (selectedGame === "skeleton") {
    return <SkeletonGame />;
  }

  if (selectedGame === "book-cricket") {
    return <BookCricketGame onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === "friend-challenge") {
    return <FriendBookCricketGame challengeId={challengeIdFromUrl} onBack={() => {
      // Clear URL params
      window.history.pushState({}, document.title, window.location.pathname);
      setSelectedGame(null);
      setChallengeIdFromUrl(null);
    }} />;
  }

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      background: "#404a37",
      backgroundImage: "radial-gradient(ellipse 78% 72% at 50% 56%, transparent 52%, rgba(26,20,14,0.42) 100%)",
      fontFamily: HAND
    }}>
      <div style={{ 
        ...slip(-1.5), 
        padding: "40px 5vw 50px", 
        textAlign: "center", 
        maxWidth: 420,
        width: "90%",
        boxSizing: "border-box",
        position: "relative"
      }}>
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 60, height: 16, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 2, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }} />
        
        <div style={{ fontFamily: STAMP, fontSize: 13, letterSpacing: "0.25em", color: INK_3, textTransform: "uppercase", marginBottom: 12 }}>
          BackBench
        </div>
        
        <div style={{ fontFamily: HAND, fontSize: 48, lineHeight: 1, color: INK, marginBottom: 8, textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}>
          Book Cricket
        </div>
        
        <div style={{ fontFamily: HAND, fontSize: 18, color: INK_2, marginBottom: 40 }}>
          "Remember opening a textbook just to check the last digit?"
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <button 
            onClick={() => {
              trackEvent("play_book_cricket", { mode: "practice" });
              setSelectedGame("book-cricket");
            }}
            style={{ 
              padding: "16px 24px", 
              fontSize: 22, 
              fontFamily: HAND, 
              cursor: "pointer", 
              backgroundColor: INK, 
              color: PAPER, 
              border: "none", 
              borderRadius: 4,
              boxShadow: "0 4px 0 #152755, 0 6px 10px rgba(0,0,0,0.2)",
              transition: "transform 0.1s, box-shadow 0.1s"
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "translateY(4px)"; e.currentTarget.style.boxShadow = "0 0 0 #152755, 0 2px 4px rgba(0,0,0,0.2)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 0 #152755, 0 6px 10px rgba(0,0,0,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 0 #152755, 0 6px 10px rgba(0,0,0,0.2)"; }}
          >
            Play Book Cricket
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Play against the computer</div>
          </button>

          <button 
            onClick={() => { 
              trackEvent("challenge_friend_clicked");
              setChallengeIdFromUrl(null); 
              setSelectedGame("friend-challenge"); 
            }}
            style={{ 
              padding: "16px 24px", 
              fontSize: 22, 
              fontFamily: HAND, 
              cursor: "pointer", 
              backgroundColor: TIN, 
              color: PAPER, 
              border: "none", 
              borderRadius: 4,
              boxShadow: "0 4px 0 #8f4c12, 0 6px 10px rgba(0,0,0,0.2)",
              transition: "transform 0.1s, box-shadow 0.1s"
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "translateY(4px)"; e.currentTarget.style.boxShadow = "0 0 0 #8f4c12, 0 2px 4px rgba(0,0,0,0.2)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 0 #8f4c12, 0 6px 10px rgba(0,0,0,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 0 #8f4c12, 0 6px 10px rgba(0,0,0,0.2)"; }}
          >
            Challenge a Friend
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Send a challenge to your benchmate</div>
          </button>
        </div>

        <div style={{ fontFamily: HAND, fontSize: 14, color: INK_3, marginTop: 32 }}>
          "Games we played when the teacher wasn't looking."
        </div>
      </div>
    </div>
  );
}
