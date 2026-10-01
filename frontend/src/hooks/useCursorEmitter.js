import { useCallback, useRef } from 'react';

const CLIENT_THROTTLE_MS = 40;

/**
 * Wraps Excalidraw's onPointerUpdate callback, which reports pointer position
 * in *scene* coordinates — so remote clients only apply their own zoom/pan.
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
