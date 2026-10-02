import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';
import { AUTH_EXPIRED_EVENT } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Establishes the Socket.IO connection and joins the given collaboration
 * session. Returns the socket, connection/join status, and participant list.
 */
export function useSocket(sessionId) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false); // true once the server has acknowledged our session:join
  const [joinError, setJoinError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selfSocketId, setSelfSocketId] = useState(null);

  useEffect(() => {
    // sessionId is null until the workspace has been granted access over HTTP.
    if (!isAuthenticated || !sessionId) return undefined;
    setJoined(false);

    const socket = getSocket();
    socketRef.current = socket;

    function handleConnect() {
      setConnected(true);
      setSelfSocketId(socket.id);
      socket.emit('session:join', { sessionId }, (response) => {
        if (!response?.ok) {
          setJoinError(response?.error || 'Failed to join session.');
          return;
        }
        setJoinError(null);
        setJoined(true);
        setParticipants(response.participants || []);
      });
    }

    function handleDisconnect() {
      setConnected(false);
      setJoined(false);
    }

    function handlePresenceUpdate({ participants: updated }) {
      setParticipants(updated || []);
    }

    function handleConnectError(err) {
      if (err.message === 'Authentication required.' || err.message === 'Invalid or expired token.') {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
      setJoinError(err.message || 'Connection failed.');
      setConnected(false);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit('session:leave');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('connect_error', handleConnectError);
    };
  }, [isAuthenticated, sessionId]);

  return { socket: socketRef.current, connected, joined, joinError, participants, selfSocketId };
}
