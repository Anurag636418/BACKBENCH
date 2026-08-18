# BackBench

A nostalgic browser-based game platform for students and working professionals. Built with React, Colyseus, Three.js, and TypeScript, this project brings the classic school-days game of **Book Cricket** to life.

> **Current Status: MVP Production Ready** 🚀
> Complete implementation of single-player and live 1v1 multiplayer Book Cricket, fully deployed to Render and Cloudflare.

---

## Features

- 🏏 **3D Book Cricket Experience:** Interactive physical textbook powered by Three.js and GSAP animations.
- 🤖 **Practice Mode:** Play against an automated computer opponent.
- 🤝 **Live Friend Challenges:** Generate shareable links and play real-time 1v1 multiplayer over WebSockets.
- 🔥 **Super Overs:** Built-in tiebreaker logic if a match ends in a draw.
- 🎨 **Nostalgic UI/UX:** Torn paper scorecards, stamp-styled fonts, and classroom ambient audio.
- 📱 **Fully Responsive:** Optimized camera and interface layouts for both desktop and mobile devices.
- 📊 **Product Analytics:** Integrated Google Analytics 4 (GA4) funnel tracking.

---

## Architecture & Tech Stack

### Frontend (Client)
- **Framework:** React + Vite
- **3D Engine:** Three.js
- **Animations:** GSAP
- **Multiplayer Client:** `@colyseus/sdk`
- **Deployment:** Cloudflare Workers (Static Assets) using `wrangler.toml` to serve Vite's `dist/` output.

### Backend (Server)
- **Framework:** Node.js + Express
- **Authoritative Multiplayer:** Colyseus Game Server
- **Database:** PostgreSQL (using `pg`)
- **Deployment:** Render Web Services & Render PostgreSQL

---

## Project Structure

```
backbench/
├── client/          👉 React + Vite frontend
│   ├── src/
│   │   ├── game/    👉 Three.js ClassroomScene logic
│   │   ├── hooks/   👉 Custom React hooks (e.g., useIsMobile)
│   │   └── *.tsx    👉 Main components (App, BookCricketGame, FriendBookCricketGame)
│   ├── .env         👉 VITE_SERVER_URL, VITE_GA_MEASUREMENT_ID
│   ├── wrangler.toml👉 Cloudflare Workers static deployment configuration
│   └── dist/        👉 Production static output
│
├── server/          👉 Node.js + Colyseus backend
│   ├── src/
│   │   ├── rooms/   👉 Authoritative Room logic (BookCricketRoom, FriendBookCricketRoom)
│   │   ├── challenges/ 👉 Express REST routes & DB controllers
│   │   └── index.ts 👉 Server entry point
│   ├── database/    👉 Migration SQL scripts
│   ├── migrate.js   👉 Custom script to run SQL migrations
│   └── .env         👉 PORT, DATABASE_URL
```

---

## Local Development Setup

### Prerequisites
- **Node.js** >= 18
- **PostgreSQL** running locally

### 1. Database Setup
1. Create a local database: `createdb backbench`
2. Create `server/.env` and add:
   ```env
   DATABASE_URL=postgres://username:password@localhost:5432/backbench
   ```
3. Run the migrations to build the tables:
   ```bash
   cd server
   npm run migrate
   ```

### 2. Start the Backend
```bash
cd server
npm install
npm run dev
```
*Server runs on `http://localhost:2567`*

### 3. Start the Frontend
```bash
cd client
npm install
npm run dev
```
*Client runs on `http://localhost:5173`*

---

## Environment Variables

### Client (`client/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:2567` | URL of the backend (handles both HTTP and WebSocket). |
| `VITE_GA_MEASUREMENT_ID` | (empty) | Google Analytics 4 Measurement ID for event tracking. |

### Server (`server/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `2567` | Port for the Colyseus game server. |
| `DATABASE_URL` | - | Connection string to the PostgreSQL database. |

---

## Production Deployment

### Backend (Render)
1. **Database:** Deploy a PostgreSQL instance on Render.
2. **Web Service:** Deploy the `server` directory as a Node Web Service.
   - **Build Command:** `npm install && npm run build && npm run migrate`
   - **Start Command:** `npm start` (or `node dist/index.js`)
3. Connect the Web Service to the Database via the `DATABASE_URL` environment variable.

### Frontend (Cloudflare)
The frontend is deployed to Cloudflare Workers as Static Assets.
- **Wrangler Configuration:** `client/wrangler.toml` explicitly routes the `dist` directory and enforces SPA routing (`not_found_handling = "single-page-application"`). This safely bypasses Cloudflare's Vite 6+ auto-detection.
- **Deployment Command:** `npm run build` followed by `npx wrangler deploy`.
- **Environment:** Ensure `VITE_SERVER_URL` is configured in Cloudflare to point to your Render backend URL during the build.
