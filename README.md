# Dev-Sync

Real-time collaborative whiteboard: infinite canvas (Excalidraw), live cursors, presence,
persistent chat (MongoDB), voice-to-text (OpenAI Whisper), JWT auth, dark mode, and a
dashboard of your past boards.

- React (Vite) frontend · Node.js + Express + Socket.IO backend · MongoDB · Docker Compose

## Features

- **Auth**: signup/login/logout with JWT in an httpOnly cookie, bcrypt hashing, rate-limited auth routes.
- **Boards ("sessions")**: create a board (short shareable code) or join one by code.
- **Board history**: the lobby lists every board you created or joined, newest activity first. Reopen any
  of them days later — the whiteboard is restored from its saved snapshot (saved every 5s while open).
- **Delete boards**: the creator can permanently delete a board (and its chat) for everyone; anyone else
  can remove it from their own list and rejoin later with the code. People inside a board that gets
  deleted are sent back to the lobby.
- **Realtime whiteboard**: element-diff sync over Socket.IO (last-writer-wins per element by `version`).
- **Cursors**: rendered through Excalidraw's native `collaborators` map (correct zoom/pan, idle timeout).
- **Chat**: persisted, real-time, cursor-paginated history.
- **Voice**: record → backend → Whisper → editable transcript → send to chat. Provider errors are logged
  server-side only; the browser sees friendly messages.

## Run with Docker

```bash
export JWT_SECRET="a-long-random-string"
export OPENAI_API_KEY="sk-..."   # optional; leave unset to disable voice
docker compose up --build
```
Frontend http://localhost:5173 · Backend http://localhost:5000 · MongoDB localhost:27017

## Run locally

```bash
# MongoDB: docker run -d -p 27017:27017 mongo:7
cd backend  && cp .env.example .env && npm install && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev
```

Test collaboration with two **different** users in separate browser profiles (or one in incognito) —
tabs in the same profile share the auth cookie and so are the same user.

## API additions

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/sessions/:sessionId/join` | Join with the room code (grants membership) |
| GET | `/api/sessions` | Boards you created/joined (no canvas payload) |
| PATCH | `/api/sessions/:sessionId` | Rename a board (creator only) |
| PUT | `/api/sessions/:sessionId/thumbnail` | Save the board's small preview image (members only) |
| DELETE | `/api/sessions/:sessionId` | Creator: delete for everyone. Others: remove from own list |

Socket event `session:deleted` is emitted to a board's room when its creator deletes it.

## Access control & persistence

- **The room code is the invite.** Joining a board (`POST /api/sessions/:id/join`, done automatically when you open
  an invite link) adds you to its members. Everything else — chat history, scene snapshot, the realtime socket —
  requires membership and answers 404 otherwise. Failed join attempts are rate-limited (20 per 10 min per user),
  and new codes are 12 hex characters.
- **"Remove from my list" is not a ban.** Anyone who still has the code can rejoin.
- **The server persists the board.** Every `scene:update` it relays is also written to MongoDB with atomic,
  version-gated upserts (one document per element in `SceneElement`, images in `SceneFile`). Clients no longer
  upload snapshots, so nothing is read-modify-written and the old 16MB per-board ceiling is gone.
- **Migration:** boards saved by earlier versions (scene stored inside the `Session` document) are moved to the
  new collections automatically at server start. It is idempotent.

## Error handling

- Every failed request goes through `getErrorMessage()`: the server's sanitized message when there is one,
  a clear "can't reach the server" / "server problem" message otherwise — never axios or provider text.
- A 401 on any API call or socket handshake means the login expired: the app returns to the login page with
  a notice instead of failing silently.
- Loading failures (boards list, chat history, saved whiteboard) show an inline message with **Retry** rather
  than looking like an empty state. A React error boundary catches render crashes.
- Destructive actions use dialogs (delete/remove board, clear board); results use toasts.
- Chat sends time out after 8s and give the text back instead of losing it.

## Known limitations

- Undo/redo is per-client (Excalidraw's local history), not collaborative.
- Per-element last-writer-wins, not a CRDT.
- Presence lives in one process's memory; scaling horizontally needs a shared store (e.g. Redis).
- Deleted-element tombstones and images are kept forever; there is no per-board size cap or pruning yet.
- Boards created before the `members` field existed show only for their creator until others rejoin.

Design docs are in `docs/`.
