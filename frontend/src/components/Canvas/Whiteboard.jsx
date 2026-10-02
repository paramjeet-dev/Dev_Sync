import { useCallback, useEffect, useState } from 'react';
import { Excalidraw, exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import { useExcalidrawSync } from '../../hooks/useExcalidrawSync';
import { useCursorEmitter } from '../../hooks/useCursorEmitter';
import RemoteCursors from '../RemoteCursors/RemoteCursors';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { fetchSnapshot, saveThumbnail } from '../../services/chatApi';

const THUMB_INTERVAL_MS = 10000;
const THUMB_WIDTH = 320;
const THUMB_MAX_CHARS = 75000; // server rejects > 80000

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Thin wrapper around Excalidraw. This component's job is strictly the
 * realtime + persistence integration.
 */
export default function Whiteboard({ socket, connected, joined, sessionId, darkMode }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const { toast } = useToast();

  const { handleChange, clearScene, loadInitialScene, setOnRejectedFile } = useExcalidrawSync({
    socket,
    connected,
    excalidrawAPI,
  });

  useEffect(() => {
    setOnRejectedFile(() => {
      toast(
        "An image wasn't shared: images must be under 3MB and PNG, JPEG, GIF, WebP or SVG. You can still see it, but other people can't.",
        { type: 'error', duration: 8000 }
      );
    });
  }, [setOnRejectedFile, toast]);

  // Someone else cleared the board — say so, otherwise the drawing just vanishes.
  useEffect(() => {
    if (!socket) return undefined;
    function handleRemoteClear({ username } = {}) {
      toast(`${username || 'Someone'} cleared the board`);
    }
    socket.on('scene:clear', handleRemoteClear);
    return () => socket.off('scene:clear', handleRemoteClear);
  }, [socket, toast]);

  const handlePointerUpdate = useCursorEmitter(socket);

  // Restore the saved scene only AFTER the server has acknowledged our join: from that moment live
  // updates reach us, and the snapshot is merged (by version) with anything that arrived meanwhile.
  // If loading fails the board stays "not restored" (so no misleading thumbnail is saved) and a
  // banner offers a retry — a blank canvas must never be mistaken for an empty board.
  useEffect(() => {
    if (!excalidrawAPI || !joined || restored) return undefined;
    let cancelled = false;

    async function restore() {
      setRestoreError(false);
      try {
        const snapshot = await fetchSnapshot(sessionId);
        if (cancelled) return;
        if (snapshot?.elements?.length) {
          const filesMap = {};
          Object.values(snapshot.files || {}).forEach((f) => {
            filesMap[f.id] = f;
          });
          loadInitialScene(snapshot.elements, filesMap);
        }
        setRestored(true);
      } catch (err) {
        if (!cancelled) setRestoreError(true);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [excalidrawAPI, joined, restored, sessionId, loadInitialScene, restoreAttempt]);

  // Keeps the lobby preview fresh: render a small JPEG whenever the scene has changed,
  // every few seconds, when the tab is hidden, and when leaving the board.
  useEffect(() => {
    if (!excalidrawAPI || !restored || !connected) return undefined;
    let lastSignature = null;
    let busy = false;

    async function capture() {
      if (busy) return;
      busy = true;
      try {
        const elements = excalidrawAPI.getSceneElements();
        if (elements.length === 0) return;
        const signature = `${elements.length}:${elements.reduce((sum, el) => sum + el.version, 0)}`;
        if (signature === lastSignature) return;

        const blob = await exportToBlob({
          elements,
          appState: {
            ...excalidrawAPI.getAppState(),
            exportBackground: true,
            viewBackgroundColor: '#ffffff',
            exportWithDarkMode: false,
          },
          files: excalidrawAPI.getFiles(),
          mimeType: 'image/jpeg',
          quality: 0.6,
          getDimensions: (w, h) => {
            const scale = Math.min(1, THUMB_WIDTH / w);
            return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
          },
        });
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > THUMB_MAX_CHARS) return;
        await saveThumbnail(sessionId, dataUrl);
        lastSignature = signature;
      } catch (err) {
        // Thumbnails are cosmetic — never surface failures (also covers Excalidraw already unmounted).
      } finally {
        busy = false;
      }
    }

    const interval = setInterval(capture, THUMB_INTERVAL_MS);
    const onVisibility = () => document.visibilityState === 'hidden' && capture();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      capture();
    };
  }, [excalidrawAPI, restored, connected, sessionId]);

  const handleExportPNG = useCallback(async () => {
    if (!excalidrawAPI) return;
    const blob = await exportToBlob({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      mimeType: 'image/png',
    });
    downloadBlob(blob, `dev-sync-${sessionId}.png`);
  }, [excalidrawAPI, sessionId]);

  const handleExportSVG = useCallback(async () => {
    if (!excalidrawAPI) return;
    const svg = await exportToSvg({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, `dev-sync-${sessionId}.svg`);
  }, [excalidrawAPI, sessionId]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!excalidrawAPI) return;
    const blob = await exportToBlob({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      mimeType: 'image/png',
    });
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (err) {
      // Clipboard API may be unavailable — fail silently for a non-critical feature.
    }
  }, [excalidrawAPI]);

  return (
    <div className="whiteboard-wrapper">
      <div className="export-bar">
        <button onClick={handleExportPNG} title="Export as PNG">
          🖼️ PNG
        </button>
        <button onClick={handleExportSVG} title="Export as SVG">
          📐 SVG
        </button>
        <button onClick={handleCopyToClipboard} title="Copy to clipboard">
          📋 Copy
        </button>
        <button onClick={() => setConfirmClear(true)} className="danger" title="Clear board for everyone">
          🗑 Clear
        </button>
      </div>

      {restoreError && (
        <div className="board-banner">
          <span>Couldn&apos;t load the saved board, so what you see may be incomplete.</span>
          <button onClick={() => setRestoreAttempt((n) => n + 1)}>Retry</button>
        </div>
      )}

      <div className="excalidraw-container">
        <Excalidraw
          excalidrawAPI={setExcalidrawAPI}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          theme={darkMode ? 'dark' : 'light'}
          initialData={{ appState: { viewBackgroundColor: darkMode ? '#121212' : '#ffffff' } }}
        />
        <RemoteCursors socket={socket} excalidrawAPI={excalidrawAPI} />
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear the whole board?"
          message="This removes everything on the board for everyone, including what's saved. It can't be undone."
          confirmLabel="Clear board"
          danger
          onConfirm={() => {
            clearScene();
            setConfirmClear(false);
            toast('Board cleared', { type: 'success' });
          }}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
