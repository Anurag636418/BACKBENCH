import { query } from "../db";
import { nanoid } from "nanoid";

export async function createChallenge(gameType: string) {
  const id = nanoid(6);
  const result = await query(
    `INSERT INTO challenges (id, game_type, status) VALUES ($1, $2, 'WAITING') RETURNING *`,
    [id, gameType]
  );
  return result.rows[0];
}

export async function getChallenge(id: string) {
  const result = await query(`SELECT * FROM challenges WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function setChallengeRoomId(challengeId: string, roomId: string) {
  await query(`UPDATE challenges SET room_id = $1 WHERE id = $2`, [roomId, challengeId]);
}

export async function updateChallengeStatus(id: string, status: string) {
  await query(`UPDATE challenges SET status = $1 WHERE id = $2`, [status, id]);
}

export async function completeChallenge(id: string, winner: string, p1Score: number, p2Score: number) {
  await query(
    `UPDATE challenges SET status = 'COMPLETED', winner = $1, player1_score = $2, player2_score = $3, completed_at = NOW() WHERE id = $4`,
    [winner, p1Score, p2Score, id]
  );
}
