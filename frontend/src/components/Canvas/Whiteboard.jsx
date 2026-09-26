import { useCallback, useEffect, useState } from 'react';
import { Excalidraw, exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import { useExcalidrawSync } from '../../hooks/useExcalidrawSync';
import { useCursorEmitter } from '../../hooks/useCursorEmitter';
import RemoteCursors from '../RemoteCursors/RemoteCursors';
import { fetchSnapshot } from '../../services/chatApi';

/**
 * Thin wrapper around Excalidraw. Excalidraw itself provides the infinite
 * canvas, zoom/pan, shape tools, hand-drawn rendering, arrow-binding,
 * image support, shape libraries, and PNG/SVG/clipboard export — all of
 * which are out of scope to reimplement (see project discussion). This
 * component's job is strictly the realtime + persistence integration.
 */
export default function Whiteboard({ socket, connected, sessionId, darkMode }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [restored, setRestored] = useState(false);
  const [imageWarning, setImageWarning] = useState(null);

  const { handleChange, clearScene, loadInitialScene, setOnRejectedFile } = useExcalidrawSync({
    socket,
    connected,
    excalidrawAPI,
  });

  useEffect(() => {
    setOnRejectedFile((file) => {
      setImageWarning(
        `"${file?.mimeType || 'image'}" wasn't synced — images must be under 3MB and a common format (PNG/JPEG/GIF/WebP/SVG). It's still visible on your own screen but other participants won't see it.`
      );
    });
  }, [setOnRejectedFile]);

  const handlePointerUpdate = useCursorEmitter(socket);

  // Restore any previously saved scene once both the API and a session are ready.
  useEffect(() => {
    if (!excalidrawAPI || restored) return;
    let cancelled = false;

    async function restore() {
      try {
        const snapshot = await fetchSnapshot(sessionId);
        if (!cancelled && snapshot?.elements?.length) {
          const filesMap = {};
          Object.values(snapshot.files || {}).forEach((f) => {
            filesMap[f.id] = f;
          });
          loadInitialScene(snapshot.elements, filesMap);
        }
      } catch (err) {
        // Non-fatal — board still usable without a restored snapshot.
      } finally {
        if (!cancelled) setRestored(true);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [excalidrawAPI, restored, sessionId, loadInitialScene]);

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
      // Clipboard API may be unavailable (permissions/browser support) —
      // fail silently rather than surfacing a confusing error for a
      // non-critical convenience feature.
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
        <button onClick={clearScene} className="danger" title="Clear board for everyone">
          🗑 Clear
        </button>
      </div>

      {imageWarning && (
        <div className="image-warning-banner">
          {imageWarning}
          <button onClick={() => setImageWarning(null)} title="Dismiss">
            ✕
          </button>
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
