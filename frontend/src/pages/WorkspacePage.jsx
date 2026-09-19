import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useCanvas } from '../hooks/useCanvas';
import { useCursorEmitter } from '../hooks/useCursorEmitter';
import { useAuth } from '../context/AuthContext';
import Canvas from '../components/Canvas/Canvas';
import Toolbar from '../components/Toolbar/Toolbar';
import PresenceList from '../components/Presence/PresenceList';
import RemoteCursors from '../components/RemoteCursors/RemoteCursors';
import ChatPanel from '../components/Chat/ChatPanel';
import TranscriptionControl from '../components/Transcription/TranscriptionControl';
import { fetchSnapshot } from '../services/chatApi';

export default function WorkspacePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rightTab, setRightTab] = useState('chat'); // 'chat' | 'voice'

  const { socket, connected, joinError, participants, selfSocketId } = useSocket(sessionId);

  const canvasApi = useCanvas({
    onLocalStroke: (payload) => {
      if (!socket || !connected) return;
      if (payload.type === 'clear') {
        socket.emit('drawing:clear');
      } else {
        socket.emit('drawing:event', payload);
      }
    },
  });

  const emitCursor = useCursorEmitter(socket, canvasApi.canvasRef);

  // Restore any previously saved whiteboard snapshot on join.
  useEffect(() => {
    let cancelled = false;
    async function restoreSnapshot() {
      try {
        const snapshot = await fetchSnapshot(sessionId);
        if (!cancelled && snapshot) {
          canvasApi.loadSnapshotImage(snapshot);
        }
      } catch (err) {
        // Non-fatal: workspace still usable without a restored snapshot.
      }
    }
    restoreSnapshot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Periodically persist a snapshot so reconnecting clients can restore state
  // (APP_FLOW.md section 13).
  useEffect(() => {
    if (!socket || !connected) return undefined;
    const interval = setInterval(() => {
      const dataUrl = canvasApi.exportSnapshot();
      if (dataUrl) socket.emit('drawing:snapshot:save', { dataUrl });
    }, 15000);
    return () => clearInterval(interval);
  }, [socket, connected, canvasApi]);

  function handlePointerMoveForCursor(e) {
    emitCursor(e.clientX, e.clientY);
  }

  function handleLeave() {
    navigate('/lobby');
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <div className="workspace-title">
          <strong>Dev-Sync</strong>
          <span className="session-code">Room: {sessionId}</span>
          <span className={`connection-badge ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>
        <div className="workspace-header-actions">
          <PresenceList participants={participants} selfSocketId={selfSocketId} />
          <span className="current-user">{user?.username}</span>
          <button onClick={handleLeave}>Leave</button>
          <button onClick={handleLogout} className="danger">
            Log out
          </button>
        </div>
      </header>

      {joinError && <div className="join-error-banner">{joinError}</div>}

      <div className="workspace-body">
        <div className="workspace-main">
          <Toolbar
            tool={canvasApi.tool}
            setTool={canvasApi.setTool}
            color={canvasApi.color}
            setColor={canvasApi.setColor}
            lineWidth={canvasApi.lineWidth}
            setLineWidth={canvasApi.setLineWidth}
            onUndo={canvasApi.undo}
            onRedo={canvasApi.redo}
            canUndo={canvasApi.canUndo}
            canRedo={canvasApi.canRedo}
            onClear={() => canvasApi.clearCanvas({ broadcast: true })}
          />
          <div className="canvas-area" onPointerMove={handlePointerMoveForCursor}>
            <Canvas canvasApi={canvasApi} socket={socket} connected={connected} />
            <RemoteCursors socket={socket} canvasRef={canvasApi.canvasRef} />
          </div>
        </div>

        <aside className="workspace-sidebar">
          <div className="sidebar-tabs">
            <button
              className={rightTab === 'chat' ? 'active' : ''}
              onClick={() => setRightTab('chat')}
            >
              Chat
            </button>
            <button
              className={rightTab === 'voice' ? 'active' : ''}
              onClick={() => setRightTab('voice')}
            >
              Voice
            </button>
          </div>
          {rightTab === 'chat' ? (
            <ChatPanel socket={socket} sessionId={sessionId} connected={connected} />
          ) : (
            <TranscriptionControl socket={socket} connected={connected} />
          )}
        </aside>
      </div>
    </div>
  );
}
