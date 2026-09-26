import { useEffect, useState } from 'react';

// Matches PresenceList's curated palette — the same user gets the same
// color in both their avatar and their cursor label, and both sit
// comfortably next to the app's own violet/teal accents.
const CURSOR_COLORS = ['#E56399', '#E8823C', '#D4A72C', '#5FA85C', '#3FAE9A', '#4A9FD8', '#6E56CF', '#9257C9'];

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Renders remote cursors as a fixed overlay positioned in *screen* space,
 * converted each render from the sender's *scene*-space coordinates using
 * this client's own current zoom/pan (excalidrawAPI.getAppState()). Cursor
 * positions are sent in scene coordinates (see useCursorEmitter) precisely
 * so that each viewer's own zoom/pan is what determines their screen
 * position — a cursor at the same drawn point looks correct regardless of
 * how far each participant has independently zoomed/panned.
 */
export default function RemoteCursors({ socket, excalidrawAPI }) {
  const [cursors, setCursors] = useState({}); // socketId -> { x, y, username, userId }
  const [, forceRerender] = useState(0);

  // Re-render on pan/zoom so cursor screen positions stay correct even
  // when the local user's own viewport changes without a new cursor event.
  useEffect(() => {
    if (!excalidrawAPI) return undefined;
    const interval = setInterval(() => forceRerender((n) => n + 1), 100);
    return () => clearInterval(interval);
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleCursorUpdate({ socketId, userId, username, x, y }) {
      setCursors((prev) => ({ ...prev, [socketId]: { userId, username, x, y } }));
    }

    function handlePresenceUpdate({ participants }) {
      const activeIds = new Set(participants.map((p) => p.socketId));
      setCursors((prev) => {
        const next = {};
        Object.entries(prev).forEach(([id, val]) => {
          if (activeIds.has(id)) next[id] = val;
        });
        return next;
      });
    }

    function handleUserLeft({ socketId }) {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }

    socket.on('cursor:update', handleCursorUpdate);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:user-left', handleUserLeft);

    return () => {
      socket.off('cursor:update', handleCursorUpdate);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:user-left', handleUserLeft);
    };
  }, [socket]);

  if (!excalidrawAPI) return null;

  const appState = excalidrawAPI.getAppState();
  const { scrollX, scrollY, zoom } = appState;

  return (
    <div className="remote-cursors-layer">
      {Object.entries(cursors).map(([socketId, cursor]) => {
        // Scene coordinates -> screen coordinates, using this viewer's own
        // current scroll/zoom (same transform Excalidraw applies to its
        // own elements when rendering).
        const screenX = (cursor.x + scrollX) * zoom.value;
        const screenY = (cursor.y + scrollY) * zoom.value;

        return (
          <div key={socketId} className="remote-cursor" style={{ left: screenX, top: screenY }}>
            <div className="cursor-dot" style={{ backgroundColor: colorForUser(cursor.userId) }} />
            <span className="cursor-label" style={{ backgroundColor: colorForUser(cursor.userId) }}>
              {cursor.username}
            </span>
          </div>
        );
      })}
    </div>
  );
}
