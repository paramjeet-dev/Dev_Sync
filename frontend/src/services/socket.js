import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

/**
 * Single shared Socket.IO client. Authenticates via the httpOnly auth cookie
 * (withCredentials: true) — no token is held by frontend JS.
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
