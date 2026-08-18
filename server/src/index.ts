import "dotenv/config";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { SkeletonRoom } from "./rooms/SkeletonRoom";
import { BookCricketRoom } from "./rooms/BookCricketRoom";
import { FriendBookCricketRoom } from "./rooms/book-cricket/FriendBookCricketRoom";
import challengeRoutes from "./challenges/challengeRoutes";

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/challenges", challengeRoutes);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const port = Number(process.env.PORT) || 2567;

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: createServer(app),
  }),
});

// Register the walking skeleton room
gameServer.define("skeleton", SkeletonRoom);

// Register the Book Cricket room (Solo)
gameServer.define("book-cricket", BookCricketRoom);

// Register the Friend Book Cricket room (PvP)
gameServer.define("friend-book-cricket", FriendBookCricketRoom);

gameServer.listen(port).then(() => {
  console.log(`\n🎮 Backbench server listening on ws://localhost:${port}`);
  console.log(`   Health check: http://localhost:${port}/health\n`);
});

