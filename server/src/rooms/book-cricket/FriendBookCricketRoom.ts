import { Room, Client } from "colyseus";
import { FriendBookCricketState, FriendGameStatus, FriendPlayer } from "./FriendBookCricketState";
import { PlayerStatus } from "../schema/BookCricketState";
import { generatePage, calculateFlipResult, resolveNewStatus } from "./bookCricketRules";
import { updateChallengeStatus, completeChallenge } from "../../challenges/challengeRepository";

export class FriendBookCricketRoom extends Room<FriendBookCricketState> {
  maxClients = 2;

  // Exposed for tests
  public testForcePage: number | null = null;

  onCreate(options: any): void {
    this.setState(new FriendBookCricketState());
    
    if (options.challengeId) {
      this.state.challengeId = options.challengeId;
    }

    this.onMessage("flip", (client: Client) => {
      this.handleFlipCommand(client);
    });

    console.log(`[FriendBookCricketRoom] Room ${this.roomId} created for challenge ${this.state.challengeId}`);
  }

  onJoin(client: Client, options: any): void {
    const name = options.name || "Player";

    console.log(`\n[FRIEND ROOM JOIN]`);
    console.log(`roomId: ${this.roomId}`);
    console.log(`sessionId: ${client.sessionId}`);
    console.log(`existing player1SessionId: ${this.state.player1SessionId}`);
    console.log(`existing player2SessionId: ${this.state.player2SessionId}`);
    console.log(`current gameStatus: ${this.state.gameStatus}`);

    let assignedRole = "";

    if (!this.state.player1SessionId) {
      // First player joins
      this.state.player1SessionId = client.sessionId;
      this.state.player1.name = name;
      this.state.gameStatus = FriendGameStatus.WAITING_FOR_OPPONENT;
      assignedRole = "Player 1";
    } else if (!this.state.player2SessionId) {
      // Second player joins
      this.state.player2SessionId = client.sessionId;
      this.state.player2.name = name;
      this.state.gameStatus = FriendGameStatus.READY;
      assignedRole = "Player 2";

      // Start match sequence
      this.startCountdown();
    }

    console.log(`\n[FRIEND ROOM ASSIGNED]`);
    console.log(`sessionId: ${client.sessionId}`);
    console.log(`assignedRole: ${assignedRole}`);
    console.log(`player1SessionId: ${this.state.player1SessionId}`);
    console.log(`player2SessionId: ${this.state.player2SessionId}`);
    console.log(`gameStatus: ${this.state.gameStatus}`);

    if (this.state.player1SessionId && this.state.player2SessionId) {
      console.log(`\n[FRIEND ROOM READY]`);
      console.log(`player1SessionId: ${this.state.player1SessionId}`);
      console.log(`player2SessionId: ${this.state.player2SessionId}`);
      console.log(`gameStatus: ${this.state.gameStatus}`);
    }
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    console.log(`\n[FriendBookCricketRoom] Player ${client.sessionId} left.`);

    if (this.state.gameStatus !== FriendGameStatus.GAME_OVER && 
        this.state.gameStatus !== FriendGameStatus.WAITING_FOR_OPPONENT) {
      // Forfeit
      if (client.sessionId === this.state.player1SessionId) {
        this.state.winner = "PLAYER_2";
      } else {
        this.state.winner = "PLAYER_1";
      }
      this.state.gameStatus = FriendGameStatus.GAME_OVER;
      this.state.isForfeit = true;
      
      await this.saveChallengeResult();
    }
  }

  private startCountdown() {
    this.state.countdown = 3;
    
    // Using Colyseus clock for countdown
    this.clock.setInterval(() => {
      this.state.countdown--;
      
      if (this.state.countdown <= 0) {
        this.clock.clear();
        this.state.gameStatus = FriendGameStatus.PLAYER_1_BATTING;
        
        // Update DB status to active
        if (this.state.challengeId) {
          updateChallengeStatus(this.state.challengeId, "ACTIVE").catch(console.error);
        }
      }
    }, 1000);
  }

  private handleFlipCommand(client: Client): void {
    const isPlayer1 = client.sessionId === this.state.player1SessionId;
    const isPlayer2 = client.sessionId === this.state.player2SessionId;
    const role = isPlayer1 ? "Player 1" : isPlayer2 ? "Player 2" : "Unknown";

    console.log(`\n[FRIEND ROOM FLIP]`);
    console.log(`sessionId: ${client.sessionId}`);
    console.log(`playerRole: ${role}`);
    console.log(`currentTurn: ${this.state.gameStatus}`);

    let accepted = false;

    if (this.state.gameStatus === FriendGameStatus.PLAYER_1_BATTING && isPlayer1) {
      accepted = true;
      this.resolveFlip("player1");
    } else if (this.state.gameStatus === FriendGameStatus.PLAYER_2_BATTING && isPlayer2) {
      accepted = true;
      this.resolveFlip("player2");
    } else if (this.state.gameStatus === FriendGameStatus.SUPER_OVER_P1 && isPlayer1) {
      accepted = true;
      this.resolveFlip("player1");
    } else if (this.state.gameStatus === FriendGameStatus.SUPER_OVER_P2 && isPlayer2) {
      accepted = true;
      this.resolveFlip("player2");
    }

    console.log(`accepted/rejected: ${accepted ? "accepted" : "rejected"}\n`);
  }

  private resolveFlip(playerType: "player1" | "player2"): void {
    const isSuperOver = this.state.gameStatus === FriendGameStatus.SUPER_OVER_P1 || 
                        this.state.gameStatus === FriendGameStatus.SUPER_OVER_P2;
    
    let status: PlayerStatus;
    let balls: number;
    let maxBalls = isSuperOver ? 1 : 6;

    if (isSuperOver) {
      status = playerType === "player1" ? this.state.superOverP1Status : this.state.superOverP2Status;
      balls = playerType === "player1" ? this.state.superOverP1Balls : this.state.superOverP2Balls;
    } else {
      status = playerType === "player1" ? this.state.player1.status : this.state.player2.status;
      balls = playerType === "player1" ? this.state.player1.balls : this.state.player2.balls;
    }

    if (status !== PlayerStatus.BATTING) return;
    if (balls >= maxBalls) return;

    // Execute flip
    const { page, consumed } = generatePage(this.testForcePage);
    if (consumed) this.testForcePage = null;
    
    this.state.currentPage = page;
    
    const flipResult = calculateFlipResult(page);
    this.state.lastResult = flipResult.resultText;
    this.state.lastRuns = flipResult.runs;

    if (!isSuperOver) {
      if (playerType === "player1") {
        this.state.player1.history.push(flipResult.resultText);
      } else {
        this.state.player2.history.push(flipResult.resultText);
      }
    }

    const newBalls = balls + 1;
    let newStatus = resolveNewStatus(newBalls, maxBalls, flipResult.isOut);

    // If P2 is batting, check if they chased the target
    if (playerType === "player2" && !flipResult.isOut) {
      if (isSuperOver) {
        if (this.state.superOverP2Score + flipResult.runs > this.state.superOverP1Score) {
          newStatus = PlayerStatus.FINISHED;
        }
      } else {
        if (this.state.player2.score + flipResult.runs > this.state.player1.score) {
          newStatus = PlayerStatus.FINISHED;
        }
      }
    }

    // Apply updates
    if (isSuperOver) {
      if (playerType === "player1") {
        this.state.superOverP1Balls = newBalls;
        this.state.superOverP1Status = newStatus;
        this.state.superOverP1Score += flipResult.runs;
      } else {
        this.state.superOverP2Balls = newBalls;
        this.state.superOverP2Status = newStatus;
        this.state.superOverP2Score += flipResult.runs;
      }
    } else {
      if (playerType === "player1") {
        this.state.player1.balls = newBalls;
        this.state.player1.status = newStatus;
        this.state.player1.score += flipResult.runs;
      } else {
        this.state.player2.balls = newBalls;
        this.state.player2.status = newStatus;
        this.state.player2.score += flipResult.runs;
      }
    }

    // Handle transition
    if (newStatus !== PlayerStatus.BATTING) {
      this.handleInningsEnd(playerType);
    }
  }

  private handleInningsEnd(playerType: "player1" | "player2"): void {
    if (playerType === "player1") {
      if (this.state.gameStatus === FriendGameStatus.SUPER_OVER_P1) {
        this.state.gameStatus = FriendGameStatus.SUPER_OVER_P2;
      } else {
        this.state.gameStatus = FriendGameStatus.PLAYER_2_BATTING;
      }
    } else {
      this.evaluateWinner();
    }
  }

  private async evaluateWinner(): Promise<void> {
    const isSuperOver = this.state.gameStatus === FriendGameStatus.SUPER_OVER_P2;
    
    const p1Score = isSuperOver ? this.state.superOverP1Score : this.state.player1.score;
    const p2Score = isSuperOver ? this.state.superOverP2Score : this.state.player2.score;

    if (p1Score > p2Score) {
      this.state.winner = "PLAYER_1";
      this.state.gameStatus = FriendGameStatus.GAME_OVER;
      await this.saveChallengeResult();
    } else if (p2Score > p1Score) {
      this.state.winner = "PLAYER_2";
      this.state.gameStatus = FriendGameStatus.GAME_OVER;
      await this.saveChallengeResult();
    } else {
      // Tie -> Super Over
      this.state.gameStatus = FriendGameStatus.SUPER_OVER_P1;
      this.state.superOverRound += 1;
      
      this.state.superOverP1Score = 0;
      this.state.superOverP2Score = 0;
      this.state.superOverP1Balls = 0;
      this.state.superOverP2Balls = 0;
      this.state.superOverP1Status = PlayerStatus.BATTING;
      this.state.superOverP2Status = PlayerStatus.BATTING;
    }
  }

  private async saveChallengeResult() {
    if (this.state.challengeId) {
      try {
        const p1Score = this.state.player1.score;
        const p2Score = this.state.player2.score;
        await completeChallenge(this.state.challengeId, this.state.winner, p1Score, p2Score);
      } catch (err) {
        console.error("[FriendBookCricketRoom] Failed to save challenge result:", err);
      }
    }
  }
}
