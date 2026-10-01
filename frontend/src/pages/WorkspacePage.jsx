import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Whiteboard from '../components/Canvas/Whiteboard';
import PresenceList from '../components/Presence/PresenceList';
import ChatPanel from '../components/Chat/ChatPanel';
import TranscriptionControl from '../components/Transcription/TranscriptionControl';

export default function WorkspacePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [rightTab, setRightTab] = useState('chat'); // 'chat' | 'voice'

  const { socket, connected, joinError, participants, selfSocketId } = useSocket(sessionId);

  // If the creator deletes this board while we're in it, send everyone back to the lobby.
  useEffect(() => {
    if (!socket) return undefined;
    function handleDeleted({ sessionId: deletedId }) {
      if (deletedId === sessionId) {
        window.alert('This board was deleted by its creator.');
        navigate('/lobby');
      }
    }
    socket.on('session:deleted', handleDeleted);
    return () => socket.off('session:deleted', handleDeleted);
  }, [socket, sessionId, navigate]);

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
          <span className="workspace-wordmark">Dev-Sync</span>
          <span className="session-code">{sessionId}</span>
          <span className={`connection-badge ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>
        <div className="workspace-header-actions">
          <PresenceList participants={participants} selfSocketId={selfSocketId} />
          <button onClick={toggleDarkMode} title="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
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
          <Whiteboard socket={socket} connected={connected} sessionId={sessionId} darkMode={darkMode} />
        </div>

        <aside className="workspace-sidebar">
          <div className="sidebar-tabs">
            <button className={rightTab === 'chat' ? 'active' : ''} onClick={() => setRightTab('chat')}>
              Chat
            </button>
            <button className={rightTab === 'voice' ? 'active' : ''} onClick={() => setRightTab('voice')}>
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
