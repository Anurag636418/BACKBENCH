import { Room, Client } from "colyseus";
import { SkeletonState, Player } from "./schema/SkeletonState";

/** Movement step size in pixels per keypress. */
const MOVE_STEP = 20;

/** Bounds for the play area (server-enforced). */
const AREA_WIDTH = 760;
const AREA_HEIGHT = 460;

/** Valid movement directions the client can request. */
const VALID_DIRECTIONS = new Set(["up", "down", "left", "right"]);

/**
 * SkeletonRoom — a minimal Colyseus room that demonstrates
 * authoritative state synchronization between two clients.
 *
 * Clients send movement INTENTS (direction only).
 * The server validates, computes the new position, and updates state.
 * Clients never directly set their own x/y.
 */
export class SkeletonRoom extends Room<SkeletonState> {
  maxClients = 2;

  onCreate(): void {
    this.setState(new SkeletonState());

    // Handle "move" messages: client sends a direction intent, server applies it.
    this.onMessage("move", (client: Client, data: { direction: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const direction = data?.direction;
      if (!direction || !VALID_DIRECTIONS.has(direction)) return;

      // Server computes the new position (authoritative)
      let newX = player.x;
      let newY = player.y;

      switch (direction) {
        case "up":    newY -= MOVE_STEP; break;
        case "down":  newY += MOVE_STEP; break;
        case "left":  newX -= MOVE_STEP; break;
        case "right": newX += MOVE_STEP; break;
      }

      // Server enforces bounds (authoritative validation)
      player.x = Math.max(0, Math.min(AREA_WIDTH, newX));
      player.y = Math.max(0, Math.min(AREA_HEIGHT, newY));
    });

    console.log(`[SkeletonRoom] Room ${this.roomId} created.`);
  }

  onJoin(client: Client): void {
    const player = new Player();
    // Server assigns initial position (not the client)
    player.x = 100 + this.state.players.size * 200;
    player.y = 200;
    this.state.players.set(client.sessionId, player);

    console.log(`[SkeletonRoom] Player ${client.sessionId} joined. Total: ${this.state.players.size}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[SkeletonRoom] Player ${client.sessionId} left. Total: ${this.state.players.size}`);
  }

  onDispose(): void {
    console.log(`[SkeletonRoom] Room ${this.roomId} disposed.`);
  }
}
