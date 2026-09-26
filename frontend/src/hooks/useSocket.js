import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

/**
 * Establishes the Socket.IO connection and joins the given collaboration
 * session. Returns the socket ref, connection status, and current
 * participant list from the join acknowledgement.
 */
export function useSocket(sessionId) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selfSocketId, setSelfSocketId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) return undefined;

    // Authenticates via the httpOnly cookie (see services/socket.js) —
    // nothing token-related to pass or refresh here.
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
        setParticipants(response.participants || []);
      });
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handlePresenceUpdate({ participants: updated }) {
      setParticipants(updated || []);
    }

    function handleConnectError(err) {
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

  return { socket: socketRef.current, connected, joinError, participants, selfSocketId };
}
