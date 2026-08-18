import { Schema, type } from "@colyseus/schema";

export enum GameStatus {
  WAITING = "WAITING",
  PLAYER_TURN = "PLAYER_TURN",
  COMPUTER_TURN = "COMPUTER_TURN",
  RESOLVING = "RESOLVING",
  SUPER_OVER = "SUPER_OVER",
  GAME_OVER = "GAME_OVER",
}

export enum PlayerStatus {
  BATTING = "BATTING",
  OUT = "OUT",
  FINISHED = "FINISHED",
}

export class Player extends Schema {
  @type("number") score: number = 0;
  @type("number") balls: number = 0;
  @type("string") status: PlayerStatus = PlayerStatus.BATTING;
}

export class BookCricketState extends Schema {
  @type("string") gameStatus: GameStatus = GameStatus.WAITING;

  @type(Player) player = new Player();
  @type(Player) computer = new Player();

  // Super Over tracking
  @type("number") superOverPlayerScore: number = 0;
  @type("number") superOverPlayerBalls: number = 0;
  @type("string") superOverPlayerStatus: PlayerStatus = PlayerStatus.BATTING;

  @type("number") superOverComputerScore: number = 0;
  @type("number") superOverComputerBalls: number = 0;
  @type("string") superOverComputerStatus: PlayerStatus = PlayerStatus.BATTING;

  @type("number") superOverRound: number = 0;

  @type("number") currentPage: number = 0;
  @type("number") lastRuns: number = 0;
  @type("string") lastResult: string = "";
  @type("string") winner: string = "";
}
