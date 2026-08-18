import { Schema, ArraySchema, type } from "@colyseus/schema";
import { PlayerStatus } from "../schema/BookCricketState";

export enum FriendGameStatus {
  WAITING_FOR_OPPONENT = "WAITING_FOR_OPPONENT",
  READY = "READY",
  PLAYER_1_BATTING = "PLAYER_1_BATTING",
  PLAYER_2_BATTING = "PLAYER_2_BATTING",
  SUPER_OVER_P1 = "SUPER_OVER_P1",
  SUPER_OVER_P2 = "SUPER_OVER_P2",
  GAME_OVER = "GAME_OVER",
}

export class FriendPlayer extends Schema {
  @type("number") score: number = 0;
  @type("number") balls: number = 0;
  @type("string") status: PlayerStatus = PlayerStatus.BATTING;
  @type("string") name: string = "";
  @type(["string"]) history = new ArraySchema<string>();
}

export class FriendBookCricketState extends Schema {
  @type("string") gameStatus: FriendGameStatus = FriendGameStatus.WAITING_FOR_OPPONENT;

  @type(FriendPlayer) player1 = new FriendPlayer();
  @type(FriendPlayer) player2 = new FriendPlayer();

  @type("string") player1SessionId: string = "";
  @type("string") player2SessionId: string = "";

  // Super Over tracking
  @type("number") superOverP1Score: number = 0;
  @type("number") superOverP1Balls: number = 0;
  @type("string") superOverP1Status: PlayerStatus = PlayerStatus.BATTING;

  @type("number") superOverP2Score: number = 0;
  @type("number") superOverP2Balls: number = 0;
  @type("string") superOverP2Status: PlayerStatus = PlayerStatus.BATTING;

  @type("number") superOverRound: number = 0;

  @type("number") currentPage: number = 0;
  @type("number") lastRuns: number = 0;
  @type("string") lastResult: string = "";
  @type("string") winner: string = "";
  @type("string") currentTurn: string = ""; // "player1" or "player2"
  @type("number") countdown: number = 0;
  @type("string") challengeId: string = "";
  @type("boolean") isForfeit: boolean = false;
}
