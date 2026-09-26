import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

/**
 * Returns a single shared Socket.IO client instance. A central abstraction
 * is preferred over creating independent sockets throughout the UI
 * (IMPLEMENTATION_FLOW.md Phase 3).
 *
 * Authenticates via the httpOnly auth cookie (withCredentials: true) —
 * deliberately not via an `auth: { token }` payload, since that would
 * require the frontend to hold the raw JWT somewhere JS can read it
 * (e.g. localStorage), defeating the purpose of the cookie being httpOnly.
 * See backend/sockets/socketAuth.js for the matching server-side read.
 */
export function getSocket() {
  if (socketInstance) return socketInstance;

  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
