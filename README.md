# Backbench

A nostalgic browser-based game platform for students and working professionals. Built with React, Colyseus, and TypeScript.

> **Current status: Walking Skeleton** — Proving the multiplayer architecture works before implementing any games.

---

## Project Structure

```
backbench/
├── client/          → React + Vite frontend
│   ├── src/
│   │   ├── App.tsx        → Main component: connects to Colyseus, renders players
│   │   ├── App.css        → Dark-themed UI styles
│   │   ├── main.tsx       → React entry point
│   │   └── vite-env.d.ts  → Vite type definitions
│   ├── .env               → VITE_SERVER_URL (WebSocket endpoint)
│   ├── index.html         → HTML entry point
│   ├── vite.config.ts     → Vite configuration
│   ├── tsconfig.json      → TypeScript config (references)
│   └── tsconfig.app.json  → TypeScript config (app source)
│
├── server/          → Node.js + Colyseus authoritative server
│   ├── src/
│   │   ├── index.ts                      → Server entry point
│   │   ├── rooms/
│   │   │   ├── SkeletonRoom.ts           → Room logic: handles join/leave/move
│   │   │   └── schema/
│   │   │       └── SkeletonState.ts      → Authoritative state schema (Player, SkeletonState)
│   ├── .env               → PORT (default 2567)
│   └── tsconfig.json      → TypeScript config (decorators enabled)
│
└── database/        → Reserved for future PostgreSQL setup
    └── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

---

## Install Dependencies

Open **two terminals**.

**Terminal 1 — Server:**
```bash
cd server
npm install
```

**Terminal 2 — Client:**
```bash
cd client
npm install
```

---

## Start the Application

**Terminal 1 — Start the server:**
```bash
cd server
npm run dev
```

You should see:
```
🎮 Backbench server listening on ws://localhost:2567
   Health check: http://localhost:2567/health
```

**Terminal 2 — Start the client:**
```bash
cd client
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

## Test Multiplayer Synchronization

1. Open **http://localhost:5173** in Browser Tab A.
2. Open **http://localhost:5173** in Browser Tab B.
3. Both tabs should show:
   - **Status:** Connected
   - **Same Room ID**
   - **Two players** listed in the sidebar
   - **Two colored squares** in the arena

### Test Movement
4. Click inside Tab A to focus it, then press **arrow keys** or **WASD**.
5. Your purple square moves. **Tab B sees the same movement** in real-time.
6. Do the same in Tab B — Tab A reflects the changes.

### Test Disconnect
7. Close Tab A.
8. Tab B immediately shows only one player remaining.

---

## What the Walking Skeleton Proves

| Requirement | How It's Demonstrated |
|---|---|
| Client → Server connection | React client connects to Colyseus via WebSocket |
| Room joining | `joinOrCreate("skeleton")` puts both players in the same room |
| Unique player IDs | Each client receives a unique `sessionId` from Colyseus |
| **Server-authoritative state** | `Player.x`/`y` live in server-side `Schema`. Clients send direction intents, server validates bounds and applies movement |
| State synchronization | Colyseus auto-syncs `Schema` changes to all connected clients |
| Bi-directional sync | Player A's movements appear in Player B's browser and vice versa |
| Disconnect handling | `onLeave` removes the player from state; other clients see the removal instantly |
| No client authority | Client sends `{ direction: "up" }`, never `{ x: 100, y: 200 }`. Server decides the resulting position |

### Architecture Flow

```
Browser A                    Colyseus Server                Browser B
    │                              │                            │
    ├─ "move" { direction } ──────→│                            │
    │                              ├── validate bounds          │
    │                              ├── update Player.x/y        │
    │ ←──── state sync ───────────┤──── state sync ──────────→ │
    │                              │                            │
    │                              │ ←── "move" { direction } ──┤
    │                              ├── validate bounds          │
    │                              ├── update Player.x/y        │
    │ ←──── state sync ───────────┤──── state sync ──────────→ │
```

---

## What Is NOT Implemented Yet

The following are **intentionally excluded** from the walking skeleton:

- ❌ Book Cricket game
- ❌ Paper Plane game
- ❌ Phaser game rendering
- ❌ Computer AI opponents
- ❌ PostgreSQL / database
- ❌ Authentication / accounts
- ❌ Challenge links / friend invites
- ❌ Matchmaking
- ❌ Leaderboards
- ❌ Redis / caching
- ❌ Production deployment (Docker, Kubernetes, etc.)
- ❌ Analytics

These will be built incrementally once the walking skeleton is confirmed working.

---

## Environment Variables

| Variable | Location | Default | Purpose |
|---|---|---|---|
| `PORT` | `server/.env` | `2567` | Colyseus server port |
| `VITE_SERVER_URL` | `client/.env` | `http://localhost:2567` | Server URL the client connects to |
