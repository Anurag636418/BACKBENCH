import { Room, Client } from "colyseus";
import { BookCricketState, GameStatus, PlayerStatus } from "./schema/BookCricketState";
import { generatePage, calculateFlipResult, resolveNewStatus } from "./book-cricket/bookCricketRules";

export class BookCricketRoom extends Room<BookCricketState> {
  maxClients = 1;

  // Exposed for tests so we can mock the random page generation
  public testForcePage: number | null = null;

  onCreate(): void {
    this.setState(new BookCricketState());

    this.onMessage("flip", (client: Client) => {
      this.handleFlipCommand(client);
    });

    console.log(`[BookCricketRoom] Room ${this.roomId} created.`);
  }

  onJoin(client: Client): void {
    if (this.state.gameStatus === GameStatus.WAITING) {
      this.state.gameStatus = GameStatus.PLAYER_TURN;
    }
    console.log(`[BookCricketRoom] Player ${client.sessionId} joined.`);
  }

  onLeave(client: Client): void {
    console.log(`[BookCricketRoom] Player ${client.sessionId} left.`);
  }

  onDispose(): void {
    console.log(`[BookCricketRoom] Room ${this.roomId} disposed.`);
  }

  public handleFlipCommand(client?: Client): void {
    if (this.state.gameStatus === GameStatus.PLAYER_TURN) {
      this.resolveFlip(true);
    } else if (this.state.gameStatus === GameStatus.SUPER_OVER) {
      // Check if it's the player's turn in the Super Over
      if (this.state.superOverPlayerStatus === PlayerStatus.BATTING) {
        this.resolveFlip(true);
      }
    }
  }

  public resolveFlip(isPlayer: boolean): void {
    const isSuperOver = this.state.gameStatus === GameStatus.SUPER_OVER;
    
    // Get the active entity state based on context
    const status = isSuperOver 
      ? (isPlayer ? this.state.superOverPlayerStatus : this.state.superOverComputerStatus)
      : (isPlayer ? this.state.player.status : this.state.computer.status);
      
    const balls = isSuperOver
      ? (isPlayer ? this.state.superOverPlayerBalls : this.state.superOverComputerBalls)
      : (isPlayer ? this.state.player.balls : this.state.computer.balls);

    if (status !== PlayerStatus.BATTING) return;
    
    const maxBalls = isSuperOver ? 1 : 6;
    if (balls >= maxBalls) return;

    // Execute flip
    const { page, consumed } = generatePage(this.testForcePage);
    if (consumed) this.testForcePage = null;
    
    this.state.currentPage = page;
    
    const flipResult = calculateFlipResult(page);
    this.state.lastResult = flipResult.resultText;
    this.state.lastRuns = flipResult.runs;

    const newBalls = balls + 1;
    let newStatus = resolveNewStatus(newBalls, maxBalls, flipResult.isOut);

    // Apply updates
    if (isSuperOver) {
      if (isPlayer) {
        this.state.superOverPlayerBalls = newBalls;
        this.state.superOverPlayerStatus = newStatus;
        this.state.superOverPlayerScore += flipResult.runs;
      } else {
        this.state.superOverComputerBalls = newBalls;
        this.state.superOverComputerScore += flipResult.runs;
        if (this.state.superOverComputerScore > this.state.superOverPlayerScore) {
          newStatus = PlayerStatus.FINISHED;
        }
        this.state.superOverComputerStatus = newStatus;
      }
    } else {
      if (isPlayer) {
        this.state.player.balls = newBalls;
        this.state.player.status = newStatus;
        this.state.player.score += flipResult.runs;
      } else {
        this.state.computer.balls = newBalls;
        this.state.computer.score += flipResult.runs;
        if (this.state.computer.score > this.state.player.score) {
          newStatus = PlayerStatus.FINISHED;
        }
        this.state.computer.status = newStatus;
      }
    }

    // Handle transition
    if (newStatus !== PlayerStatus.BATTING) {
      this.handleInningsEnd(isPlayer);
    } else if (!isPlayer) {
      // Continue computer turn
      this.clock.setTimeout(() => this.resolveFlip(false), 4500);
    }
  }

  private handleInningsEnd(isPlayer: boolean): void {
    if (isPlayer) {
      if (this.state.gameStatus !== GameStatus.SUPER_OVER) {
        this.state.gameStatus = GameStatus.COMPUTER_TURN;
      }
      this.clock.setTimeout(() => this.resolveFlip(false), 4500);
    } else {
      this.evaluateWinner();
    }
  }

  private evaluateWinner(): void {
    const isSuperOver = this.state.gameStatus === GameStatus.SUPER_OVER;
    
    const pScore = isSuperOver ? this.state.superOverPlayerScore : this.state.player.score;
    const cScore = isSuperOver ? this.state.superOverComputerScore : this.state.computer.score;

    if (pScore > cScore) {
      this.state.winner = "PLAYER";
      this.state.gameStatus = GameStatus.GAME_OVER;
    } else if (cScore > pScore) {
      this.state.winner = "COMPUTER";
      this.state.gameStatus = GameStatus.GAME_OVER;
    } else {
      // Tie -> Super Over
      this.state.gameStatus = GameStatus.SUPER_OVER;
      this.state.superOverRound += 1;
      
      this.state.superOverPlayerScore = 0;
      this.state.superOverComputerScore = 0;
      this.state.superOverPlayerBalls = 0;
      this.state.superOverComputerBalls = 0;
      this.state.superOverPlayerStatus = PlayerStatus.BATTING;
      this.state.superOverComputerStatus = PlayerStatus.BATTING;
    }
  }
}
