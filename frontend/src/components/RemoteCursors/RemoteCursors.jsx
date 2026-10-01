import { useEffect } from 'react';

const CURSOR_COLORS = ['#E56399', '#E8823C', '#D4A72C', '#5FA85C', '#3FAE9A', '#4A9FD8', '#6E56CF', '#9257C9'];
const IDLE_MS = 8000;

function colorForUser(userId = '') {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Feeds remote pointers into Excalidraw's native `collaborators` map, so
 * Excalidraw renders them itself: correct zoom/pan, no overlay, no polling.
 * Cursor positions arrive in scene coordinates (see useCursorEmitter).
 */
export default function RemoteCursors({ socket, excalidrawAPI }) {
  useEffect(() => {
    if (!socket || !excalidrawAPI) return undefined;

    const collaborators = new Map();
    const lastSeen = new Map();
    let raf = null;

    const flush = () => {
      raf = null;
      excalidrawAPI.updateScene({ collaborators: new Map(collaborators) });
    };
    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(flush);
    };
    const remove = (id) => {
      collaborators.delete(id);
      lastSeen.delete(id);
    };

    function onCursor({ socketId, userId, username, x, y }) {
      const color = colorForUser(userId);
      collaborators.set(socketId, {
        pointer: { x, y, tool: 'pointer' },
        button: 'up',
        username,
        socketId,
        color: { background: color, stroke: '#ffffff' },
      });
      lastSeen.set(socketId, Date.now());
      schedule();
    }

    function onPresence({ participants }) {
      const active = new Set(participants.map((p) => p.socketId));
      [...collaborators.keys()].forEach((id) => {
        if (!active.has(id)) remove(id);
      });
      schedule();
    }

    function onLeft({ socketId }) {
      remove(socketId);
      schedule();
    }

    const sweep = setInterval(() => {
      const now = Date.now();
      let changed = false;
      lastSeen.forEach((t, id) => {
        if (now - t > IDLE_MS) {
          remove(id);
          changed = true;
        }
      });
      if (changed) schedule();
    }, 1000);

    socket.on('cursor:update', onCursor);
    socket.on('presence:update', onPresence);
    socket.on('presence:user-left', onLeft);

    return () => {
      socket.off('cursor:update', onCursor);
      socket.off('presence:update', onPresence);
      socket.off('presence:user-left', onLeft);
      clearInterval(sweep);
      if (raf !== null) cancelAnimationFrame(raf);
      try {
        excalidrawAPI.updateScene({ collaborators: new Map() });
      } catch (e) {
        /* Excalidraw may already be unmounted */
      }
    };
  }, [socket, excalidrawAPI]);

  return null;
}
