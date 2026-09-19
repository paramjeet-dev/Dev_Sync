import { useEffect, useRef } from 'react';

export default function Canvas({ canvasApi, socket, connected }) {
  const { canvasRef, startStroke, continueStroke, endStroke, applyRemoteEvent, applyRemoteClear } =
    canvasApi;
  const isPointerDown = useRef(false);

  // Listen for remote drawing events and apply them to the local canvas.
  useEffect(() => {
    if (!socket) return undefined;

    function handleRemoteDrawing(event) {
      applyRemoteEvent(event);
    }
    function handleRemoteClear() {
      applyRemoteClear();
    }

    socket.on('drawing:event', handleRemoteDrawing);
    socket.on('drawing:clear', handleRemoteClear);

    return () => {
      socket.off('drawing:event', handleRemoteDrawing);
      socket.off('drawing:clear', handleRemoteClear);
    };
  }, [socket, applyRemoteEvent, applyRemoteClear]);

  function handlePointerDown(e) {
    if (!connected) return;
    isPointerDown.current = true;
    e.target.setPointerCapture(e.pointerId);
    startStroke(e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (!isPointerDown.current) return;
    continueStroke(e.clientX, e.clientY);
  }

  function handlePointerUp() {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    endStroke();
  }

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
