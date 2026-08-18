import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import challengeRoutes from './challengeRoutes';

// Mock DB
vi.mock('../db', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

import { query } from '../db';

const app = express();
app.use(express.json());
app.use('/api/challenges', challengeRoutes);

describe('Challenge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a valid Book Cricket challenge', async () => {
    (query as any).mockResolvedValueOnce({
      rows: [{ id: 'X9R2M1', game_type: 'BOOK_CRICKET', status: 'WAITING' }]
    });

    const res = await request(app)
      .post('/api/challenges')
      .send({ gameType: 'BOOK_CRICKET' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 'X9R2M1',
      gameType: 'BOOK_CRICKET',
      status: 'WAITING'
    });
    expect(query).toHaveBeenCalledTimes(1);
    const queryCall = (query as any).mock.calls[0];
    expect(queryCall[0]).toContain('INSERT INTO challenges');
    expect(queryCall[1][1]).toBe('BOOK_CRICKET');
  });

  it('rejects invalid game type', async () => {
    const res = await request(app)
      .post('/api/challenges')
      .send({ gameType: 'UNKNOWN_GAME' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid gameType');
  });

  it('returns 500 on database failure', async () => {
    (query as any).mockRejectedValueOnce(new Error('DB Error'));

    const res = await request(app)
      .post('/api/challenges')
      .send({ gameType: 'BOOK_CRICKET' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });

  it('gets a challenge', async () => {
    (query as any).mockResolvedValueOnce({
      rows: [{ id: 'X9R2M1', game_type: 'BOOK_CRICKET', status: 'WAITING', room_id: 'colyseus123' }]
    });

    const res = await request(app).get('/api/challenges/X9R2M1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'X9R2M1',
      gameType: 'BOOK_CRICKET',
      status: 'WAITING',
      roomId: 'colyseus123'
    });
  });

  it('updates room id', async () => {
    (query as any).mockResolvedValueOnce({
      rows: [{ id: 'X9R2M1' }] // getChallenge
    });
    (query as any).mockResolvedValueOnce({}); // update

    const res = await request(app)
      .put('/api/challenges/X9R2M1/room')
      .send({ roomId: 'newroom123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
