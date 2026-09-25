import { useCallback, useRef } from 'react';

const CLIENT_THROTTLE_MS = 40;

/**
 * Wraps Excalidraw's onPointerUpdate callback, which already reports
 * pointer position in *scene* coordinates (i.e. already accounting for the
 * user's own zoom/pan) — so remote clients only need their own zoom/pan
 * applied on render, not the sender's. This is why cursor sync moved off
 * raw DOM pointer events onto Excalidraw's own coordinate system when the
 * whiteboard switched to an infinite/zoomable canvas.
 */
export function useCursorEmitter(socket) {
  const lastSent = useRef(0);

  const handlePointerUpdate = useCallback(
    ({ pointer }) => {
      if (!socket || !pointer) return;
      const now = Date.now();
      if (now - lastSent.current < CLIENT_THROTTLE_MS) return;
      lastSent.current = now;

      socket.emit('cursor:move', { x: pointer.x, y: pointer.y });
    },
    [socket]
  );

  return handlePointerUpdate;
}
