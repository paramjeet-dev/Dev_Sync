import { useCallback, useEffect, useRef } from 'react';

const BROADCAST_DEBOUNCE_MS = 80;
const SNAPSHOT_SAVE_INTERVAL_MS = 15000;

// Mirrors the backend's audio upload posture (see backend/middleware/
// uploadAudio.js) — apply the same "validate before it enters the system"
// discipline to whiteboard images. Excalidraw itself imposes no size limit
// on pasted/dropped images, and nothing was checking this before: a large
// image got embedded as a base64 dataURL and then re-sent on every scene
// broadcast (see the file-diffing fix below), persisted into MongoDB, and
// counted against the 10MB Socket.IO payload ceiling and MongoDB's 16MB
// per-document limit — all without ever having been validated.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);

// A dataURL's base64 payload is ~4/3 the size of the decoded bytes; this is
// an estimate (no padding correction) but well within the margin needed to
// catch obviously-oversized images without decoding the whole string.
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
 *
 * Sync strategy (mirrors Excalidraw's own reference collaboration approach):
 * - Every scene change fires `onChange(elements, appState, files)`.
 * - We diff against the last-broadcast version per element id and only
 *   send elements that are new or whose `version` increased — not the
 *   whole scene — to keep payloads small on a busy board.
 * - Files (images) are diffed the same way, by fileId, so an embedded
 *   image is only ever broadcast once — not re-sent on every subsequent
 *   scene change for the rest of the session.
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
  const sentFileIdsRef = useRef(new Set()); // fileIds already broadcast this session
  const applyingRemoteRef = useRef(false); // guards against re-broadcasting remote-applied changes
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
        if (sentFileIdsRef.current.has(file.id)) return; // already broadcast — see class comment
        if (!isAcceptableImageFile(file)) {
          // Mark as "handled" so we don't keep re-evaluating (and
          // re-notifying about) the same rejected file on every change.
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
      if (applyingRemoteRef.current) return; // this change came from a remote merge, don't echo it back

      pendingFilesRef.current = files;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        broadcastNow(elements, pendingFilesRef.current);
      }, BROADCAST_DEBOUNCE_MS);
    },
    [broadcastNow]
  );

  /** Registers a callback fired when a locally-added image is rejected (too large/wrong type). */
  const setOnRejectedFile = useCallback((cb) => {
    onRejectedFileRef.current = cb;
  }, []);

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

  // Periodic snapshot persistence so a reconnecting/late-joining client can
  // restore the board (server merges by version — see backend sessionService).
  // Uses getSceneElementsIncludingDeleted, not getSceneElements: Excalidraw
  // represents a deletion as the same element with isDeleted:true and a
  // bumped version, not by removal from the array. getSceneElements()
  // filters those out, so persisting from it would mean a deleted shape's
  // last *visible* version stays in MongoDB forever and reappears the next
  // time anyone restores the snapshot. Sending the tombstoned element
  // itself is what lets the version-merge on the backend correctly record
  // the deletion.
  useEffect(() => {
    if (!socket || !connected || !excalidrawAPI) return undefined;

    const interval = setInterval(() => {
      const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
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
    sentFileIdsRef.current.clear();
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
          // These came from the persisted snapshot (already validated
          // before they were ever stored — see backend sessionController),
          // so mark them sent to avoid immediately re-broadcasting the
          // whole restored image set on the next local scene change.
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
