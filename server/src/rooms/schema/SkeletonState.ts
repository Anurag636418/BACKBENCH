import { Schema, MapSchema, type } from "@colyseus/schema";

/**
 * Represents a single connected player.
 * This state is OWNED by the server — clients cannot mutate it directly.
 */
export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

/**
 * The authoritative room state.
 * Contains a map of all connected players, keyed by their Colyseus sessionId.
 */
export class SkeletonState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
