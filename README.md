# Dev-Sync

Real-time collaborative whiteboard: canvas drawing, live cursors, presence,
persistent chat (MongoDB), and voice-to-text transcription (OpenAI Whisper),
with full JWT-based authentication.

Built to satisfy the PRD/TRD/App-Flow/Implementation-Flow docs for this project:
- React (Vite) frontend
- Node.js + Express + Socket.IO backend
- MongoDB for persistent chat + session metadata
- OpenAI Whisper for voice transcription
- Docker Compose for local orchestration

## Features implemented

- **Auth**: signup/login/logout with JWT (httpOnly cookie + bearer token), bcrypt password hashing, protected routes on both REST and Socket.IO.
- **Rooms/Sessions**: create a room (gets a short shareable code) or join an existing one.
- **Collaborative whiteboard**: HTML5 Canvas, pen/eraser tools, color + line width, realtime stroke sync via Socket.IO, periodic whiteboard snapshot persistence so a reconnecting client can restore state.
- **Undo/redo**: local per-client history stack.
- **Presence**: live list of connected participants, join/leave broadcasts.
- **Cursor tracking**: throttled (client + server side) real-time cursor overlay, colored/labeled per user.
- **Chat**: persisted to MongoDB, broadcast in real time, paginated history with "load older messages".
- **Voice transcription**: record audio in-browser, upload to backend, backend forwards to Whisper API (key stays server-side), transcript editable and insertable into chat.
- **Error handling**: client-side validation, server-side validation, rate limiting on auth, centralized error middleware.
- **Docker Compose**: frontend, backend, and MongoDB containers wired together.

## Project structure

```
dev-sync/
├── backend/            Express + Socket.IO + MongoDB API
│   ├── config/          env + DB connection
│   ├── controllers/     HTTP request handlers
│   ├── middleware/      auth, error handling, file upload
│   ├── models/          Mongoose schemas (User, ChatMessage, Session)
│   ├── routes/          REST route definitions
│   ├── services/        business logic (auth, chat, sessions, transcription)
│   ├── sockets/         Socket.IO auth + event handlers, in-memory presence store
│   └── server.js        entry point
├── frontend/            React (Vite) client
│   └── src/
│       ├── components/  Canvas, Toolbar, Chat, Presence, RemoteCursors, Transcription, Auth
│       ├── context/     AuthContext
│       ├── hooks/       useSocket, useCanvas, useAudioRecorder, useCursorEmitter
│       ├── pages/       LobbyPage, WorkspacePage
│       └── services/    API + socket clients
└── docker-compose.yml
```

## Running locally (without Docker)

### 1. MongoDB
Run a local MongoDB instance (or use Docker just for the DB: `docker run -d -p 27017:27017 mongo:7`).

### 2. Backend
```bash
cd backend
cp .env.example .env
# edit .env: set MONGODB_URI, JWT_SECRET, OPENAI_API_KEY
npm install
npm run dev      # nodemon, or `npm start` for plain node
```
Backend runs on `http://localhost:5000`.

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

Open two browser windows (or use incognito for the second) to test real-time
collaboration between two different logged-in users.

## Running with Docker Compose

From the project root:

```bash
# Optionally export secrets first (or create a .env file at the root with these keys)
export JWT_SECRET="a-long-random-string"
export OPENAI_API_KEY="sk-..."

docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- MongoDB: localhost:27017 (containerized, persisted via the `mongo-data` volume)

To stop: `docker compose down` (add `-v` to also wipe the MongoDB volume).

## Environment variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 5000) |
| `CLIENT_ORIGIN` | Allowed CORS origin for the frontend |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens — **change in production** |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `COOKIE_NAME` | Name of the httpOnly auth cookie |
| `OPENAI_API_KEY` | Required for voice transcription; never sent to the browser |
| `MAX_AUDIO_SIZE_MB` | Max upload size for recorded audio |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL for REST calls, e.g. `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Base URL for the Socket.IO connection |

## Key architectural notes

- **Persist-then-broadcast for chat**: every chat message is written to MongoDB
  before being broadcast, so the database is always the source of truth
  (see `backend/sockets/chatHandlers.js`).
- **Transient vs persistent data**: cursor position and presence are kept
  in an in-memory store (`backend/sockets/presenceStore.js`) and are never
  written to MongoDB — only chat and session metadata are persisted.
- **Sender exclusion on drawing broadcast**: the client that draws a stroke
  renders it locally immediately; the server broadcasts only to *other*
  clients in the room to avoid duplicate rendering.
- **Whisper key stays server-side**: the frontend only ever talks to the
  Dev-Sync backend; the backend is the only thing that calls the OpenAI API.
- **JWT auth on both transports**: the same token is validated for REST
  requests (`middleware/requireAuth.js`) and for Socket.IO connections
  (`sockets/socketAuth.js`), so a socket can't join a session without a
  valid, logged-in user.

## Testing the full flow

1. Sign up two different users (two browser profiles/incognito windows).
2. User A creates a room from the Lobby — note the room code shown in the workspace header.
3. User B joins using that room code.
4. Draw on the canvas from either user — both should see strokes appear in real time.
5. Move the mouse — both should see each other's labeled cursor.
6. Send chat messages — verify they persist across a page refresh, and that scrolling up loads older pages.
7. Click "Record" in the Voice tab, speak, stop — verify a transcript appears and can be sent to chat.
8. Disconnect/reconnect (e.g. refresh) — verify presence updates and the whiteboard snapshot restores.
