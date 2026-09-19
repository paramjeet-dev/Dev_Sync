import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Encapsulates the HTML5 Canvas drawing engine: local stroke rendering,
 * coordinate normalization, undo/redo history, and applying remote events.
 * Per IMPLEMENTATION_FLOW.md Phase 2, this layer knows nothing about
 * MongoDB or Socket.IO directly — it only renders strokes and exposes
 * callbacks the parent component wires up to the network layer.
 */
export function useCanvas({ onLocalStroke } = {}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  const [color, setColor] = useState('#1f2937');
  const [lineWidth, setLineWidth] = useState(3);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // All completed strokes, used to fully redraw the canvas (e.g. after undo/resize).
  const strokesRef = useRef([]);

  const getContext = useCallback(() => {
    if (!canvasRef.current) return null;
    if (!ctxRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
    return ctxRef.current;
  }, []);

  const toCanvasCoords = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const redrawAll = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
  }, [getContext]);

  function drawStroke(ctx, stroke) {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
    ctx.restore();
  }

  const startStroke = useCallback(
    (clientX, clientY) => {
      const point = toCanvasCoords(clientX, clientY);
      const stroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tool,
        color,
        lineWidth,
        points: [point],
      };
      currentStrokeRef.current = stroke;
      drawingRef.current = true;

      onLocalStroke?.({ type: 'stroke-start', strokeId: stroke.id, tool, color, lineWidth, point });
    },
    [tool, color, lineWidth, toCanvasCoords, onLocalStroke]
  );

  const continueStroke = useCallback(
    (clientX, clientY) => {
      if (!drawingRef.current || !currentStrokeRef.current) return;
      const point = toCanvasCoords(clientX, clientY);
      const stroke = currentStrokeRef.current;
      stroke.points.push(point);

      const ctx = getContext();
      if (ctx && stroke.points.length >= 2) {
        const prev = stroke.points[stroke.points.length - 2];
        ctx.save();
        ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.restore();
      }

      onLocalStroke?.({ type: 'stroke-update', strokeId: stroke.id, point });
    },
    [getContext, toCanvasCoords, onLocalStroke]
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    drawingRef.current = false;
    currentStrokeRef.current = null;

    strokesRef.current.push(stroke);
    setUndoStack((prev) => [...prev, stroke.id]);
    setRedoStack([]); // new action invalidates redo branch

    onLocalStroke?.({ type: 'stroke-end', strokeId: stroke.id });
  }, [onLocalStroke]);

  const applyRemoteEvent = useCallback(
    (event) => {
      // Remote events reference strokes by id; we reconstruct minimal stroke
      // state incrementally so partial strokes render progressively.
      if (event.type === 'stroke-start') {
        strokesRef.current.push({
          id: event.strokeId,
          tool: event.tool,
          color: event.color,
          lineWidth: event.lineWidth,
          points: [event.point],
        });
        redrawAll();
        return;
      }
      if (event.type === 'stroke-update') {
        const stroke = strokesRef.current.find((s) => s.id === event.strokeId);
        if (stroke) {
          stroke.points.push(event.point);
          redrawAll();
        }
        return;
      }
      if (event.type === 'stroke-end') {
        // No-op: stroke is already complete in local render.
      }
    },
    [redrawAll]
  );

  const clearCanvas = useCallback(
    ({ broadcast = true } = {}) => {
      strokesRef.current = [];
      setUndoStack([]);
      setRedoStack([]);
      redrawAll();
      if (broadcast) onLocalStroke?.({ type: 'clear' });
    },
    [redrawAll, onLocalStroke]
  );

  const applyRemoteClear = useCallback(() => {
    strokesRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
    redrawAll();
  }, [redrawAll]);

  const undo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const lastId = prevUndo[prevUndo.length - 1];
      const idx = strokesRef.current.findIndex((s) => s.id === lastId);
      if (idx !== -1) {
        const [removed] = strokesRef.current.splice(idx, 1);
        setRedoStack((prevRedo) => [...prevRedo, removed]);
        redrawAll();
      }
      return prevUndo.slice(0, -1);
    });
  }, [redrawAll]);

  const redo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const stroke = prevRedo[prevRedo.length - 1];
      strokesRef.current.push(stroke);
      setUndoStack((prevUndo) => [...prevUndo, stroke.id]);
      redrawAll();
      return prevRedo.slice(0, -1);
    });
  }, [redrawAll]);

  const exportSnapshot = useCallback(() => {
    return canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
  }, []);

  const loadSnapshotImage = useCallback(
    (dataUrl) => {
      if (!dataUrl) return;
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = dataUrl;
    },
    [getContext]
  );

  // Handle canvas resizing while preserving drawn content.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    function handleResize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redrawAll();
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawAll]);

  return {
    canvasRef,
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    startStroke,
    continueStroke,
    endStroke,
    applyRemoteEvent,
    clearCanvas,
    applyRemoteClear,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    exportSnapshot,
    loadSnapshotImage,
  };
}
