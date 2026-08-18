import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Room } from 'colyseus';
import { FriendBookCricketRoom } from './FriendBookCricketRoom';
import { FriendGameStatus } from './FriendBookCricketState';
import { PlayerStatus } from '../schema/BookCricketState';

vi.mock('../../challenges/challengeRepository', () => ({
  updateChallengeStatus: vi.fn().mockResolvedValue(true),
  completeChallenge: vi.fn().mockResolvedValue(true)
}));

describe('FriendBookCricketRoom', () => {
  let room: FriendBookCricketRoom;

  beforeEach(() => {
    room = new FriendBookCricketRoom();
    // mock the clock
    (room as any).clock = {
      setInterval: vi.fn((cb) => {
        // simulate the 3 second countdown immediately
        cb(); cb(); cb();
      }),
      clear: vi.fn(),
      setTimeout: vi.fn()
    };
    room.onCreate({ challengeId: 'test1234' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets up correctly', () => {
    expect(room.maxClients).toBe(2);
    expect(room.state.gameStatus).toBe(FriendGameStatus.WAITING_FOR_OPPONENT);
    expect(room.state.challengeId).toBe('test1234');
  });

  it('assigns player roles correctly', () => {
    const client1 = { sessionId: 'client1' } as any;
    const client2 = { sessionId: 'client2' } as any;

    room.onJoin(client1, { name: 'Alice' });
    expect(room.state.player1SessionId).toBe('client1');
    expect(room.state.player1.name).toBe('Alice');
    expect(room.state.gameStatus).toBe(FriendGameStatus.WAITING_FOR_OPPONENT);

    room.onJoin(client2, { name: 'Bob' });
    expect(room.state.player2SessionId).toBe('client2');
    expect(room.state.player2.name).toBe('Bob');
    // Countdown finishes immediately via mock
    expect(room.state.gameStatus).toBe(FriendGameStatus.PLAYER_1_BATTING);
  });

  it('handles player 1 innings and transition to player 2', () => {
    const client1 = { sessionId: 'client1' } as any;
    const client2 = { sessionId: 'client2' } as any;
    
    room.onJoin(client1, { name: 'Alice' });
    room.onJoin(client2, { name: 'Bob' });

    // Player 1 flips OUT
    room.testForcePage = 120; // Last digit 0 -> OUT
    room['handleFlipCommand'](client1);

    expect(room.state.player1.status).toBe(PlayerStatus.OUT);
    expect(room.state.player1.balls).toBe(1);
    expect(room.state.player1.score).toBe(0);
    expect(room.state.gameStatus).toBe(FriendGameStatus.PLAYER_2_BATTING);
  });

  it('prevents player 2 from flipping during player 1 turn', () => {
    const client1 = { sessionId: 'client1' } as any;
    const client2 = { sessionId: 'client2' } as any;
    
    room.onJoin(client1, { name: 'Alice' });
    room.onJoin(client2, { name: 'Bob' });

    // Player 2 tries to flip during P1 turn -> should be ignored
    room.testForcePage = 147;
    room['handleFlipCommand'](client2);

    expect(room.state.player1.balls).toBe(0);
    expect(room.state.player2.balls).toBe(0);
  });

  it('declares winner and ends game', async () => {
    const client1 = { sessionId: 'client1' } as any;
    const client2 = { sessionId: 'client2' } as any;
    
    room.onJoin(client1, { name: 'Alice' });
    room.onJoin(client2, { name: 'Bob' });

    // P1 gets 7 runs
    room.testForcePage = 147;
    room['handleFlipCommand'](client1);
    
    // P1 gets OUT -> Transition to P2
    room.testForcePage = 120;
    room['handleFlipCommand'](client1);

    expect(room.state.player1.score).toBe(7);
    expect(room.state.gameStatus).toBe(FriendGameStatus.PLAYER_2_BATTING);

    // P2 gets 8 runs (chases and wins immediately)
    room.testForcePage = 148;
    await room['handleFlipCommand'](client2);

    expect(room.state.player2.score).toBe(8);
    expect(room.state.gameStatus).toBe(FriendGameStatus.GAME_OVER);
    expect(room.state.winner).toBe('PLAYER_2');
  });
});
