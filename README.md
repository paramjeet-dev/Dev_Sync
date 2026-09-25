# Dev-Sync

Real-time collaborative whiteboard: infinite canvas with hand-drawn style,
shape tools, image and arrow-binding support (via Excalidraw), live cursors,
presence, persistent chat (MongoDB), and voice-to-text transcription
(OpenAI Whisper) — with full JWT-based authentication and dark mode.

Built to satisfy the PRD/TRD/App-Flow/Implementation-Flow docs for this project:
- React (Vite) frontend, whiteboard powered by [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT licensed)
- Node.js + Express + Socket.IO backend
- MongoDB for persistent chat + session metadata (including whiteboard scene snapshots)
- OpenAI Whisper for voice transcription
- Docker Compose for local orchestration

## Features implemented

- **Auth**: signup/login/logout with JWT (httpOnly cookie + bearer token), bcrypt password hashing, protected routes on both REST and Socket.IO.
- **Rooms/Sessions**: create a room (gets a short shareable code) or join an existing one.
- **Collaborative whiteboard** (via Excalidraw): infinite pannable/zoomable canvas, hand-drawn rendering style, full shape toolkit (rectangle, ellipse, diamond, arrow, line, freedraw, eraser, text), arrow-binding to shapes, image insertion, shape libraries, dark mode, PNG/SVG/clipboard export.
- **Realtime whiteboard sync**: scene changes are diffed by element id + version and broadcast as small deltas (not the whole scene) over Socket.IO; remote updates are merged element-by-element, keeping the higher-version copy. Periodic snapshot persistence lets a reconnecting or late-joining client restore the board.
- **Undo/redo**: local per-client history (Excalidraw's built-in Ctrl+Z/Ctrl+Shift+Z) — intentionally *not* synced across clients; see "Known limitations" below.
- **Presence**: live list of connected participants, join/leave broadcasts.
- **Cursor tracking**: throttled (client + server side) real-time cursor overlay in scene coordinates, so cursors render correctly regardless of each viewer's own zoom/pan.
- **Chat**: persisted to MongoDB, broadcast in real time, paginated history with "load older messages".
- **Voice transcription**: record audio in-browser, upload to backend, backend forwards to Whisper API (key stays server-side), transcript editable and insertable into chat.
- **Dark mode**: app-wide theme toggle (persisted to localStorage), including the whiteboard itself via Excalidraw's own theme prop.
- **Error handling**: client-side validation, server-side validation, rate limiting on auth, centralized error middleware.
- **Docker Compose**: frontend, backend, and MongoDB containers wired together.

## Project structure

```
dev-sync/
├── backend/            Express + Socket.IO + MongoDB API
│   ├── config/          env + DB connection
│   ├── controllers/     HTTP request handlers
│   ├── middleware/      auth, error handling, file upload
│   ├── models/          Mongoose schemas (User, ChatMessage, Session — Session now stores Excalidraw scene elements + files)
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
  written to MongoDB — only chat and whiteboard/session data are persisted.
- **Whiteboard sync is element-diff based, not raster**: the whiteboard is
  an Excalidraw scene (a vector element array), not a bitmap. Every scene
  change is diffed by element `id` + `version`; only changed/new elements
  are broadcast (`scene:update`), and remote updates are merged
  element-by-element, keeping whichever copy has the higher version. This
  is a simple last-writer-wins-per-element model — not a true CRDT — so two
  users editing the *exact same* shape at the *exact same instant* can have
  one edit silently overwritten by the other. Fine at this app's scale;
  called out explicitly rather than left as a hidden gap. See
  `frontend/src/hooks/useExcalidrawSync.js`.
- **Undo/redo is intentionally local-only**: Excalidraw's built-in undo/redo
  operates on each client's own local history and is never broadcast or
  synced. If user A undoes their own last shape, it disappears from A's
  view but remains for everyone else — there is no shared/collaborative
  undo. This was a deliberate scope decision, not an oversight; a truly
  shared undo would require operation-based history (each undo broadcasting
  which change to reverse) rather than local state rollback, since a plain
  "send my new scene state" undo can silently clobber other users' work
  that happened after the action being undone.
- **Whiteboard snapshot persistence uses the same version-merge rule**: periodic
  snapshot saves (`scene:snapshot:save`) are safe to call concurrently from
  multiple clients because the backend merges into the stored element list
  by version rather than overwriting wholesale (`sessionService.saveSnapshot`).
- **Whisper key stays server-side**: the frontend only ever talks to the
  Dev-Sync backend; the backend is the only thing that calls the OpenAI API.
- **JWT auth on both transports**: the same token is validated for REST
  requests (`middleware/requireAuth.js`) and for Socket.IO connections
  (`sockets/socketAuth.js`), so a socket can't join a session without a
  valid, logged-in user.

## Known limitations (by design, not oversight)

- **Undo/redo is not collaborative** — see above. Making it collaborative
  is a real architectural change (operation-based undo), not a small patch.
- **Scene merge is last-writer-wins per element, not a CRDT** — acceptable
  for a small-group whiteboard; would need real conflict-free replication
  for larger concurrent editing scale.
- **Presence/cursor/scene state lives in a single process's memory**
  (`presenceStore.js`) — this backend cannot yet be horizontally scaled
  across multiple instances without adding a shared store (e.g. Redis) for
  that state, since Socket.IO's default adapter only broadcasts within one
  process.
- **MongoDB's 16MB per-document limit** bounds how large a single session's
  `canvasElements` array (plus embedded image `canvasFiles`) can grow. Fine
  for typical whiteboard sessions; a very long-lived, image-heavy session
  could theoretically approach it.

## Testing the full flow

1. Sign up two different users (two browser profiles/incognito windows).
2. User A creates a room from the Lobby — note the room code shown in the workspace header.
3. User B joins using that room code.
4. Draw/add shapes on the whiteboard from either user — both should see changes appear in real time.
5. Move the mouse — both should see each other's labeled cursor, correctly positioned regardless of each user's own zoom/pan.
6. Try the shape tools, image insert, and shape library — verify they sync to the other client.
7. Toggle dark mode — verify it applies to the whole app, including the whiteboard.
8. Export to PNG/SVG/clipboard — verify the downloaded/copied file matches the board.
9. Send chat messages — verify they persist across a page refresh, and that scrolling up loads older pages.
10. Click "Record" in the Voice tab, speak, stop — verify a transcript appears and can be sent to chat.
11. Disconnect/reconnect (e.g. refresh) — verify presence updates and the whiteboard restores from the last snapshot.
