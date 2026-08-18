import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BookCricketRoom } from "./BookCricketRoom";
import { GameStatus, PlayerStatus } from "./schema/BookCricketState";

// Mock the colyseus clock
class MockClock {
  setTimeout(callback: Function, time: number) {
    // Just execute it immediately in tests to avoid async headaches, 
    // or we can test synchronous logic directly.
    callback();
  }
}

describe("Book Cricket Game Rules", () => {
  let room: BookCricketRoom;

  beforeEach(() => {
    room = new BookCricketRoom();
    // @ts-ignore
    room.clock = new MockClock();
    // Manually trigger onCreate and onJoin to initialize state
    room.onCreate();
    room.onJoin({ sessionId: "client1" } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Page 147 produces 7 runs", () => {
    room.testForcePage = 147;
    room.handleFlipCommand();

    expect(room.state.currentPage).toBe(147);
    expect(room.state.lastRuns).toBe(7);
    expect(room.state.lastResult).toBe("+7 RUNS");
    expect(room.state.player.score).toBe(7);
    expect(room.state.player.balls).toBe(1);
    expect(room.state.player.status).toBe(PlayerStatus.BATTING);
  });

  it("Page 82 produces 2 runs", () => {
    room.testForcePage = 82;
    room.handleFlipCommand();

    expect(room.state.player.score).toBe(2);
  });

  it("Page 120 produces OUT and immediately ends innings", () => {
    room.testForcePage = 120;
    
    // Prevent computer from taking its turn immediately
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    const resolveSpy = vi.spyOn(room, "resolveFlip");

    room.handleFlipCommand();

    expect(room.state.currentPage).toBe(120);
    expect(room.state.lastRuns).toBe(0);
    expect(room.state.lastResult).toBe("OUT");
    expect(room.state.player.score).toBe(0);
    expect(room.state.player.balls).toBe(1);
    expect(room.state.player.status).toBe(PlayerStatus.OUT);

    // Because player got out, the game should have transitioned to COMPUTER_TURN
    // To check if innings ended, we simply verify the status transition
    expect(room.state.gameStatus).toBe(GameStatus.COMPUTER_TURN);
  });

  it("Maximum 6 normal balls and 7th flip is rejected", () => {
    // Override computer turn so it doesn't interrupt us
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    // Flip 6 times, all scoring 1 run
    for (let i = 0; i < 6; i++) {
      room.testForcePage = 11; // 1 run
      room.handleFlipCommand();
    }

    expect(room.state.player.balls).toBe(6);
    expect(room.state.player.score).toBe(6);
    expect(room.state.player.status).toBe(PlayerStatus.FINISHED);
    
    // The game status should now be COMPUTER_TURN since innings ended
    expect(room.state.gameStatus).toBe(GameStatus.COMPUTER_TURN);

    // Attempt 7th flip
    room.testForcePage = 11;
    room.handleFlipCommand(); // Should be rejected because gameStatus != PLAYER_TURN

    expect(room.state.player.balls).toBe(6); // Still 6
    expect(room.state.player.score).toBe(6); // Still 6
  });

  it("Higher score wins", () => {
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    // Player gets 1 run and OUT
    room.testForcePage = 11; room.handleFlipCommand();
    room.testForcePage = 10; room.handleFlipCommand(); // OUT
    expect(room.state.player.score).toBe(1);

    // Manually transition to computer and flip
    room.state.gameStatus = GameStatus.COMPUTER_TURN;
    
    // Computer gets 5 runs and OUT
    room.testForcePage = 15; room.resolveFlip(false);
    room.testForcePage = 10; room.resolveFlip(false); // OUT
    expect(room.state.computer.score).toBe(5);

    expect(room.state.gameStatus).toBe(GameStatus.GAME_OVER);
    expect(room.state.winner).toBe("COMPUTER");
  });

  it("Tie enters Super Over, each side gets exactly one flip, higher score wins", () => {
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    // Player scores 5 and OUT
    room.testForcePage = 15; room.handleFlipCommand();
    room.testForcePage = 10; room.handleFlipCommand();

    // Computer scores 5 and OUT
    room.state.gameStatus = GameStatus.COMPUTER_TURN;
    room.testForcePage = 15; room.resolveFlip(false);
    room.testForcePage = 10; room.resolveFlip(false);

    // Game should be in SUPER OVER
    expect(room.state.gameStatus).toBe(GameStatus.SUPER_OVER);
    expect(room.state.superOverRound).toBe(1);

    // Check that original scores are preserved
    expect(room.state.player.score).toBe(5);
    expect(room.state.computer.score).toBe(5);

    // SUPER OVER - Player Turn
    room.testForcePage = 16; // 6 runs
    room.handleFlipCommand();
    expect(room.state.superOverPlayerScore).toBe(6);
    expect(room.state.superOverPlayerBalls).toBe(1);
    expect(room.state.superOverPlayerStatus).toBe(PlayerStatus.FINISHED);

    // Attempting another flip should be ignored (1 ball limit)
    room.testForcePage = 14; 
    room.handleFlipCommand();
    expect(room.state.superOverPlayerScore).toBe(6); // unchanged

    // SUPER OVER - Computer Turn
    room.testForcePage = 12; // 2 runs
    room.resolveFlip(false);
    expect(room.state.superOverComputerScore).toBe(2);
    expect(room.state.superOverComputerBalls).toBe(1);
    
    // Game Over
    expect(room.state.gameStatus).toBe(GameStatus.GAME_OVER);
    expect(room.state.winner).toBe("PLAYER");
    
    // Original scores still 5
    expect(room.state.player.score).toBe(5);
  });

  it("Super Over tie creates another Super Over round", () => {
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    // Tie normal match
    room.testForcePage = 10; room.handleFlipCommand();
    room.state.gameStatus = GameStatus.COMPUTER_TURN;
    room.testForcePage = 10; room.resolveFlip(false);
    
    expect(room.state.superOverRound).toBe(1);

    // Tie Super Over 1
    room.testForcePage = 14; room.handleFlipCommand();
    room.testForcePage = 14; room.resolveFlip(false);

    // Should enter Super Over 2
    expect(room.state.gameStatus).toBe(GameStatus.SUPER_OVER);
    expect(room.state.superOverRound).toBe(2);

    // Scores should be reset for new round
    expect(room.state.superOverPlayerScore).toBe(0);
    expect(room.state.superOverComputerScore).toBe(0);
    expect(room.state.superOverPlayerBalls).toBe(0);
  });

  it("FLIP from wrong player (computer turn) is rejected", () => {
    room.state.gameStatus = GameStatus.COMPUTER_TURN;
    room.testForcePage = 15;
    room.handleFlipCommand();

    // Player score should not change because it's not their turn
    expect(room.state.player.score).toBe(0);
    expect(room.state.player.balls).toBe(0);
  });

  it("Computer uses the exact same flip-resolution logic", () => {
    vi.spyOn(room.clock, "setTimeout").mockImplementation(() => { return null as any; });

    room.state.gameStatus = GameStatus.COMPUTER_TURN;
    room.state.player.score = 100; // Prevent instant chase victory
    
    room.testForcePage = 18; // 8 runs
    room.resolveFlip(false);
    expect(room.state.computer.score).toBe(8);
    expect(room.state.computer.balls).toBe(1);

    room.testForcePage = 10; // OUT
    room.resolveFlip(false);
    expect(room.state.computer.status).toBe(PlayerStatus.OUT);
  });
});
