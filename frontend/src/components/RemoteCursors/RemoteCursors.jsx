import { useEffect, useRef, useState } from 'react';

const CURSOR_COLORS = ['#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA'];

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// Cursor coordinates are broadcast in canvas pixel space; this component
// scales them into the current rendered canvas size for overlay positioning.
export default function RemoteCursors({ socket, canvasRef }) {
  const [cursors, setCursors] = useState({}); // socketId -> { x, y, username, userId }
  const canvasSizeRef = useRef({ width: 1, height: 1 });

  useEffect(() => {
    function updateCanvasSize() {
      if (canvasRef.current) {
        canvasSizeRef.current = {
          width: canvasRef.current.width,
          height: canvasRef.current.height,
        };
      }
    }
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasRef]);

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

  const canvas = canvasRef.current;
  const rect = canvas ? canvas.getBoundingClientRect() : null;
  const scaleX = rect && canvas ? rect.width / canvas.width : 1;
  const scaleY = rect && canvas ? rect.height / canvas.height : 1;

  return (
    <div className="remote-cursors-layer">
      {Object.entries(cursors).map(([socketId, cursor]) => (
        <div
          key={socketId}
          className="remote-cursor"
          style={{
            left: cursor.x * scaleX,
            top: cursor.y * scaleY,
          }}
        >
          <div className="cursor-dot" style={{ backgroundColor: colorForUser(cursor.userId) }} />
          <span className="cursor-label" style={{ backgroundColor: colorForUser(cursor.userId) }}>
            {cursor.username}
          </span>
        </div>
      ))}
    </div>
  );
}
