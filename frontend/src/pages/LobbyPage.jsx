import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, fetchSession } from '../services/chatApi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await createSession(roomName || undefined);
      navigate(`/workspace/${session.sessionId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create session.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmed = joinCode.trim();
      if (!trimmed) throw new Error('Enter a room code.');
      await fetchSession(trimmed); // verify it exists before navigating
      navigate(`/workspace/${trimmed}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Session not found.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <span className="lobby-wordmark">Dev-Sync</span>
        <div className="lobby-header-actions">
          <button onClick={toggleDarkMode} title="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="current-user">{user?.username}</span>
          <button onClick={handleLogout} className="danger">
            Log out
          </button>
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-hero">
          <h1>Where's the board?</h1>
          <p>Start a fresh session, or drop in on one your team already has open.</p>
        </div>

        <div className="lobby-switch">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
            Create
          </button>
          <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
            Join
          </button>
        </div>

        {mode === 'create' ? (
          <form className="lobby-panel" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Room name (optional)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create & join'}
            </button>
          </form>
        ) : (
          <form className="lobby-panel" onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Joining…' : 'Join'}
            </button>
          </form>
        )}

        {error && <div className="auth-error">{error}</div>}
      </main>
    </div>
  );
}
