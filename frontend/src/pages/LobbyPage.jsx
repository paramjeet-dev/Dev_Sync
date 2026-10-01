import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, fetchSession, fetchMySessions, deleteSession } from '../services/chatApi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [boards, setBoards] = useState([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchMySessions()
      .then(setBoards)
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false));
  }, []);

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

  async function handleDelete(board) {
    const isOwner = board.createdBy === user?.id;
    const message = isOwner
      ? `Permanently delete "${board.name}"? This removes the board and its chat for everyone, and can't be undone.`
      : `Remove "${board.name}" from your list? You can rejoin later with the room code (${board.sessionId}).`;
    if (!window.confirm(message)) return;

    setError(null);
    setDeletingId(board.sessionId);
    try {
      await deleteSession(board.sessionId);
      setBoards((prev) => prev.filter((b) => b.sessionId !== board.sessionId));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete that board. Please try again.');
    } finally {
      setDeletingId(null);
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
          <h1>Where&apos;s the board?</h1>
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

        <section className="board-history">
          <h2>Your boards</h2>
          {boardsLoading && <p className="board-history-empty">Loading…</p>}
          {!boardsLoading && boards.length === 0 && (
            <p className="board-history-empty">Boards you create or join will show up here.</p>
          )}
          <div className="board-grid">
            {boards.map((b) => {
              const isOwner = b.createdBy === user?.id;
              return (
                <div key={b.sessionId} className="board-card">
                  <button className="board-card-open" onClick={() => navigate(`/workspace/${b.sessionId}`)}>
                    <span className="board-card-name">{b.name}</span>
                    <span className="board-card-meta">
                      <code>{b.sessionId}</code> · {b.elementCount} objects
                    </span>
                    <span className="board-card-meta">Opened {timeAgo(b.lastActivityAt)}</span>
                  </button>
                  <button
                    className="board-card-delete danger"
                    onClick={() => handleDelete(b)}
                    disabled={deletingId === b.sessionId}
                    title={isOwner ? 'Delete this board for everyone' : 'Remove from my list'}
                    aria-label={isOwner ? `Delete board ${b.name}` : `Remove board ${b.name} from my list`}
                  >
                    {deletingId === b.sessionId ? '…' : isOwner ? '🗑 Delete' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
