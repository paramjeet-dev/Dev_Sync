import { useCallback, useRef } from 'react';

const CLIENT_THROTTLE_MS = 40;

export function useCursorEmitter(socket, canvasRef) {
  const lastSent = useRef(0);

  const emitCursor = useCallback(
    (clientX, clientY) => {
      if (!socket || !canvasRef.current) return;
      const now = Date.now();
      if (now - lastSent.current < CLIENT_THROTTLE_MS) return;
      lastSent.current = now;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;

      socket.emit('cursor:move', { x, y });
    },
    [socket, canvasRef]
  );

  return emitCursor;
}
