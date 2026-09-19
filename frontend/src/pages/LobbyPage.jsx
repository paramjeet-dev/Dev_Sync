import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, fetchSession } from '../services/chatApi';
import { useAuth } from '../context/AuthContext';

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
        <strong>Dev-Sync</strong>
        <div>
          <span className="current-user">{user?.username}</span>
          <button onClick={handleLogout} className="danger">
            Log out
          </button>
        </div>
      </header>

      <div className="lobby-cards">
        <form className="lobby-card" onSubmit={handleCreate}>
          <h2>Create a room</h2>
          <input
            type="text"
            placeholder="Room name (optional)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create & join'}
          </button>
        </form>

        <form className="lobby-card" onSubmit={handleJoin}>
          <h2>Join a room</h2>
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
