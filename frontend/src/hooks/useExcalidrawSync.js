import { useCallback, useEffect, useRef } from 'react';

const BROADCAST_DEBOUNCE_MS = 80;

// Mirrors the backend's validation (backend/services/sessionService.js).
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);

function estimateDecodedBytes(dataURL) {
  const commaIndex = dataURL.indexOf(',');
  const base64Length = commaIndex === -1 ? dataURL.length : dataURL.length - commaIndex - 1;
  return Math.floor(base64Length * 0.75);
}

function isAcceptableImageFile(file) {
  if (!file || !file.mimeType || !file.dataURL) return false;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimeType)) return false;
  if (estimateDecodedBytes(file.dataURL) > MAX_IMAGE_BYTES) return false;
  return true;
}

/**
 * Bridges an Excalidraw instance to the Socket.IO `scene:*` events.
 * - onChange is diffed against the last-broadcast version per element id; only changed elements are sent.
 * - Files (images) are diffed by fileId so each is broadcast once.
 * - The server persists every delta it relays; clients no longer upload snapshots.
 * - Incoming batches merge element-by-element keeping the higher `version`
 *   (last-writer-wins per element; not a CRDT).
 */
export function useExcalidrawSync({ socket, connected, excalidrawAPI }) {
  const lastVersionsRef = useRef(new Map());
  const sentFileIdsRef = useRef(new Set());
  const applyingRemoteRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const pendingFilesRef = useRef({});
  const onRejectedFileRef = useRef(null);

  const broadcastNow = useCallback(
    (elements, files) => {
      if (!socket || !connected) return;

      const changed = elements.filter((el) => {
        const lastVersion = lastVersionsRef.current.get(el.id);
        return lastVersion === undefined || el.version > lastVersion;
      });

      const newFiles = {};
      Object.values(files || {}).forEach((file) => {
        if (sentFileIdsRef.current.has(file.id)) return;
        if (!isAcceptableImageFile(file)) {
          sentFileIdsRef.current.add(file.id);
          onRejectedFileRef.current?.(file);
          return;
        }
        newFiles[file.id] = file;
        sentFileIdsRef.current.add(file.id);
      });

      if (changed.length === 0 && Object.keys(newFiles).length === 0) return;

      changed.forEach((el) => lastVersionsRef.current.set(el.id, el.version));

      socket.emit('scene:update', { elements: changed, files: newFiles });
    },
    [socket, connected]
  );

  const handleChange = useCallback(
    (elements, appState, files) => {
      if (applyingRemoteRef.current) return;

      pendingFilesRef.current = files;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        broadcastNow(elements, pendingFilesRef.current);
      }, BROADCAST_DEBOUNCE_MS);
    },
    [broadcastNow]
  );

  const setOnRejectedFile = useCallback((cb) => {
    onRejectedFileRef.current = cb;
  }, []);

  useEffect(() => {
    if (!socket || !excalidrawAPI) return undefined;

    function mergeElements(incoming) {
      // Include deleted elements: a remote tombstone must beat a stale visible copy, and a stale
      // visible copy must not resurrect something we already deleted.
      const current = excalidrawAPI.getSceneElementsIncludingDeleted();
      const byId = new Map(current.map((el) => [el.id, el]));

      incoming.forEach((el) => {
        const existing = byId.get(el.id);
        if (!existing || el.version > existing.version) {
          byId.set(el.id, el);
          lastVersionsRef.current.set(el.id, el.version);
        }
      });

      return Array.from(byId.values());
    }

    function handleSceneUpdate({ elements, files }) {
      applyingRemoteRef.current = true;
      try {
        const merged = mergeElements(elements);
        excalidrawAPI.updateScene({ elements: merged });
        if (files && Object.keys(files).length > 0) {
          excalidrawAPI.addFiles(Object.values(files));
        }
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    }

    function handleSceneClear() {
      applyingRemoteRef.current = true;
      try {
        excalidrawAPI.resetScene();
        lastVersionsRef.current.clear();
        sentFileIdsRef.current.clear();
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    }

    socket.on('scene:update', handleSceneUpdate);
    socket.on('scene:clear', handleSceneClear);

    return () => {
      socket.off('scene:update', handleSceneUpdate);
      socket.off('scene:clear', handleSceneClear);
    };
  }, [socket, excalidrawAPI]);

  const clearScene = useCallback(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.resetScene();
    lastVersionsRef.current.clear();
    sentFileIdsRef.current.clear();
    socket?.emit('scene:clear');
  }, [excalidrawAPI, socket]);

  // Merges the persisted snapshot into whatever is already on the board (live updates may have
  // arrived while the snapshot was loading), keeping the higher version of each element.
  const loadInitialScene = useCallback(
    (elements, files) => {
      if (!excalidrawAPI || !elements || elements.length === 0) return;
      applyingRemoteRef.current = true;
      try {
        const byId = new Map(excalidrawAPI.getSceneElementsIncludingDeleted().map((el) => [el.id, el]));
        elements.forEach((el) => {
          const existing = byId.get(el.id);
          if (!existing || el.version > existing.version) {
            byId.set(el.id, el);
            lastVersionsRef.current.set(el.id, el.version); // already persisted — don't re-broadcast
          }
        });
        excalidrawAPI.updateScene({ elements: Array.from(byId.values()) });
        if (files && Object.keys(files).length > 0) {
          excalidrawAPI.addFiles(Object.values(files));
          Object.keys(files).forEach((fileId) => sentFileIdsRef.current.add(fileId));
        }
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    },
    [excalidrawAPI]
  );

  return { handleChange, clearScene, loadInitialScene, setOnRejectedFile };
}
