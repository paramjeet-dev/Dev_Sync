import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

/**
 * Returns a single shared Socket.IO client instance, created lazily once a
 * token is available. A central abstraction is preferred over creating
 * independent sockets throughout the UI (IMPLEMENTATION_FLOW.md Phase 3).
 */
export function getSocket(token) {
  if (socketInstance) return socketInstance;

  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: { token },
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
