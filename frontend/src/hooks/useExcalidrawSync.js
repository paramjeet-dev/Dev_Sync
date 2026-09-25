import { useCallback, useEffect, useRef } from 'react';

const BROADCAST_DEBOUNCE_MS = 80;
const SNAPSHOT_SAVE_INTERVAL_MS = 15000;

/**
 * Bridges an Excalidraw instance to the Socket.IO `scene:*` events.
 *
 * Sync strategy (mirrors Excalidraw's own reference collaboration approach):
 * - Every scene change fires `onChange(elements, appState, files)`.
 * - We diff against the last-broadcast version per element id and only
 *   send elements that are new or whose `version` increased — not the
 *   whole scene — to keep payloads small on a busy board.
 * - Incoming remote batches are merged element-by-element, keeping
 *   whichever copy has the higher `version`. This is a simple
 *   last-writer-wins-per-element model: fine for shape edits where a
 *   whole element is replaced atomically, not a true CRDT, so two users
 *   editing the exact same shape at the same instant may still have one
 *   edit silently overwrite the other. Acceptable for this app's scale;
 *   called out explicitly rather than left implicit.
 */
export function useExcalidrawSync({ socket, connected, excalidrawAPI }) {
  const lastVersionsRef = useRef(new Map()); // elementId -> last broadcast version
  const applyingRemoteRef = useRef(false); // guards against re-broadcasting remote-applied changes
  const debounceTimerRef = useRef(null);
  const pendingFilesRef = useRef({});

  const broadcastNow = useCallback(
    (elements, files) => {
      if (!socket || !connected) return;

      const changed = elements.filter((el) => {
        const lastVersion = lastVersionsRef.current.get(el.id);
        return lastVersion === undefined || el.version > lastVersion;
      });
      if (changed.length === 0) return;

      changed.forEach((el) => lastVersionsRef.current.set(el.id, el.version));

      socket.emit('scene:update', { elements: changed, files });
    },
    [socket, connected]
  );

  const handleChange = useCallback(
    (elements, appState, files) => {
      if (applyingRemoteRef.current) return; // this change came from a remote merge, don't echo it back

      pendingFilesRef.current = files;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        broadcastNow(elements, pendingFilesRef.current);
      }, BROADCAST_DEBOUNCE_MS);
    },
    [broadcastNow]
  );

  // Apply an incoming remote scene update by merging into the local scene.
  useEffect(() => {
    if (!socket || !excalidrawAPI) return undefined;

    function mergeElements(incoming) {
      const current = excalidrawAPI.getSceneElements();
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
        // Release on next tick so Excalidraw's own onChange for this
        // programmatic update fires and is correctly suppressed.
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

  // Periodic snapshot persistence so a reconnecting/late-joining client can
  // restore the board (server merges by version — see backend sessionService).
  useEffect(() => {
    if (!socket || !connected || !excalidrawAPI) return undefined;

    const interval = setInterval(() => {
      const elements = excalidrawAPI.getSceneElements();
      const files = excalidrawAPI.getFiles();
      if (elements.length > 0) {
        socket.emit('scene:snapshot:save', { elements, files });
      }
    }, SNAPSHOT_SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, connected, excalidrawAPI]);

  const clearScene = useCallback(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.resetScene();
    lastVersionsRef.current.clear();
    socket?.emit('scene:clear');
  }, [excalidrawAPI, socket]);

  const loadInitialScene = useCallback(
    (elements, files) => {
      if (!excalidrawAPI || !elements || elements.length === 0) return;
      applyingRemoteRef.current = true;
      try {
        excalidrawAPI.updateScene({ elements });
        elements.forEach((el) => lastVersionsRef.current.set(el.id, el.version));
        if (files && Object.keys(files).length > 0) {
          excalidrawAPI.addFiles(Object.values(files));
        }
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      }
    },
    [excalidrawAPI]
  );

  return { handleChange, clearScene, loadInitialScene };
}
