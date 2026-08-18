import { Router } from "express";
import { createChallenge, getChallenge, setChallengeRoomId } from "./challengeRepository";

const router = Router();

// Create a new live challenge
router.post("/", async (req, res) => {
  try {
    const { gameType } = req.body;

    if (gameType !== "BOOK_CRICKET") {
      return res.status(400).json({ error: "Invalid gameType. Must be BOOK_CRICKET" });
    }

    const challenge = await createChallenge(gameType);

    res.status(201).json({
      id: challenge.id,
      gameType: challenge.game_type,
      status: challenge.status
    });
  } catch (err) {
    console.error("Failed to create challenge:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get challenge details (for friend joining)
router.get('/:id', async (req, res) => {
  try {
    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    console.log(`\n[CHALLENGE LOOKUP]`);
    console.log(`challengeId: ${challenge.id}`);
    console.log(`roomId: ${challenge.room_id}`);

    res.json({
      id: challenge.id,
      gameType: challenge.game_type,
      status: challenge.status,
      roomId: challenge.room_id || null
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Associate a Colyseus room with the challenge
router.put("/:id/room", async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }
    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    await setChallengeRoomId(req.params.id, roomId);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to set room:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
