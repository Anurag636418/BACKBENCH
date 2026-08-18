import { PlayerStatus } from "../schema/BookCricketState";

export function generatePage(testForcePage: number | null): { page: number; consumed: boolean } {
  if (testForcePage !== null) {
    return { page: testForcePage, consumed: true };
  }
  return { page: Math.floor(Math.random() * 200) + 1, consumed: false };
}

export interface FlipResult {
  page: number;
  lastDigit: number;
  runs: number;
  isOut: boolean;
  resultText: string;
}

export function calculateFlipResult(page: number): FlipResult {
  const lastDigit = page % 10;
  if (lastDigit === 0) {
    return { page, lastDigit, runs: 0, isOut: true, resultText: "OUT" };
  }
  return { page, lastDigit, runs: lastDigit, isOut: false, resultText: `+${lastDigit} RUNS` };
}

export function resolveNewStatus(currentBalls: number, maxBalls: number, isOut: boolean): PlayerStatus {
  if (isOut) return PlayerStatus.OUT;
  if (currentBalls >= maxBalls) return PlayerStatus.FINISHED;
  return PlayerStatus.BATTING;
}
