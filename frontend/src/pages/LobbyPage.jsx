import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createSession,
  joinSession,
  fetchMySessions,
  deleteSession,
  renameSession,
} from '../services/chatApi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../services/errors';
import BoardCard from '../components/Lobby/BoardCard';
import NameDialog from '../components/ui/NameDialog';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const FILTERS = [
  ['all', 'All'],
  ['mine', 'Created by me'],
  ['shared', 'Shared with me'],
];

// Accepts a bare room code or a pasted invite link (".../workspace/<code>").
function parseRoomCode(input) {
  const withoutQuery = input.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  return withoutQuery.split('/').pop();
}

function EmptyIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <rect x="14" y="14" width="92" height="64" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M30 56 C 38 40, 50 40, 56 52 S 74 66, 90 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="90" cy="38" r="4" fill="currentColor" />
      <path d="M44 88 H76" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [boards, setBoards] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);

  const [menuFor, setMenuFor] = useState(null); // sessionId whose ⋯ menu is open
  const [dialog, setDialog] = useState(null); // { type: 'create' | 'rename' | 'delete', board? }
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  const loadBoards = useCallback(async () => {
    setStatus('loading');
    try {
      setBoards(await fetchMySessions());
      setStatus('ready');
    } catch (err) {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  // Close the ⋯ menu on any outside click or Escape.
  useEffect(() => {
    if (!menuFor) return undefined;
    const close = () => setMenuFor(null);
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuFor]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = boards.filter((b) => {
      const owner = b.createdBy === user?.id;
      if (filter === 'mine' && !owner) return false;
      if (filter === 'shared' && owner) return false;
      if (q && !b.name.toLowerCase().includes(q) && !b.sessionId.toLowerCase().includes(q)) return false;
      return true;
    });
    const byRecent = (a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
    const byCreated = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    const byName = (a, b) => a.name.localeCompare(b.name);
    return [...list].sort(sort === 'name' ? byName : sort === 'created' ? byCreated : byRecent);
  }, [boards, query, filter, sort, user?.id]);

  function closeDialog() {
    setDialog(null);
    setDialogError(null);
    setDialogBusy(false);
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = parseRoomCode(joinInput);
    if (!code) return;
    setJoining(true);
    try {
      await joinSession(code); // grants access (or fails with a friendly error) before navigating
      navigate(`/workspace/${code}`);
    } catch (err) {
      toast(getErrorMessage(err, 'Could not find that board.'), { type: 'error' });
    } finally {
      setJoining(false);
    }
  }

  async function handleCreate(name) {
    setDialogBusy(true);
    setDialogError(null);
    try {
      const session = await createSession(name || undefined);
      navigate(`/workspace/${session.sessionId}`);
    } catch (err) {
      setDialogError(getErrorMessage(err, 'Could not create the board. Please try again.'));
      setDialogBusy(false);
    }
  }

  async function handleRename(name) {
    const { board } = dialog;
    setDialogBusy(true);
    setDialogError(null);
    try {
      await renameSession(board.sessionId, name);
      setBoards((prev) => prev.map((b) => (b.sessionId === board.sessionId ? { ...b, name } : b)));
      closeDialog();
      toast('Board renamed', { type: 'success' });
    } catch (err) {
      setDialogError(getErrorMessage(err, 'Could not rename the board. Please try again.'));
      setDialogBusy(false);
    }
  }

  async function handleDelete() {
    const { board } = dialog;
    const owner = board.createdBy === user?.id;
    setDialogBusy(true);
    setDialogError(null);
    try {
      await deleteSession(board.sessionId);
      setBoards((prev) => prev.filter((b) => b.sessionId !== board.sessionId));
      closeDialog();
      toast(owner ? 'Board deleted' : 'Removed from your list', { type: 'success' });
    } catch (err) {
      setDialogError(getErrorMessage(err));
      setDialogBusy(false);
    }
  }

  async function handleCopyLink(board) {
    setMenuFor(null);
    const url = `${window.location.origin}/workspace/${board.sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied', { type: 'success' });
    } catch (err) {
      toast(`Copy this link: ${url}`, { duration: 8000 });
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const deleteTarget = dialog?.type === 'delete' ? dialog.board : null;
  const deleteIsOwner = deleteTarget?.createdBy === user?.id;

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <span className="lobby-wordmark">Dev-Sync</span>
        <div className="lobby-header-actions">
          <button onClick={toggleDarkMode} title="Toggle dark mode" aria-label="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="lobby-user">
            <span className="lobby-avatar">{user?.username?.slice(0, 1).toUpperCase()}</span>
            <span className="current-user">{user?.username}</span>
          </span>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-top">
          <div className="lobby-title">
            <h1>Welcome back, {user?.username}</h1>
            <p>
              {status === 'ready'
                ? boards.length === 0
                  ? 'Start your first board, or join one with a code.'
                  : `${boards.length} ${boards.length === 1 ? 'board' : 'boards'} — pick up where you left off.`
                : 'Pick up where you left off.'}
            </p>
          </div>

          <div className="lobby-actions">
            <form className="join-form" onSubmit={handleJoin}>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Room code or invite link"
                aria-label="Room code or invite link"
              />
              <button type="submit" disabled={joining || !joinInput.trim()}>
                {joining ? 'Joining…' : 'Join'}
              </button>
            </form>
            <button className="primary" onClick={() => setDialog({ type: 'create' })}>
              + New board
            </button>
          </div>
        </div>

        {status === 'ready' && boards.length > 0 && (
          <div className="lobby-toolbar">
            <input
              type="search"
              className="lobby-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or code"
              aria-label="Search boards"
            />
            <div className="lobby-switch" role="group" aria-label="Filter boards">
              {FILTERS.map(([key, label]) => (
                <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                  {label}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort boards">
              <option value="recent">Recently opened</option>
              <option value="created">Newest created</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        )}

        {status === 'loading' && (
          <div className="board-grid" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="board-card board-skeleton">
                <div className="board-thumb" />
                <div className="board-card-body">
                  <span className="sk-line" />
                  <span className="sk-line short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="lobby-state">
            <h2>Couldn&apos;t load your boards</h2>
            <p>Check your connection and try again.</p>
            <button className="primary" onClick={loadBoards}>
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && boards.length === 0 && (
          <div className="lobby-state">
            <EmptyIllustration />
            <h2>No boards yet</h2>
            <p>Boards you create or join will show up here, ready to reopen any time.</p>
            <button className="primary" onClick={() => setDialog({ type: 'create' })}>
              Create your first board
            </button>
          </div>
        )}

        {status === 'ready' && boards.length > 0 && (
          <div className="board-grid">
            <button className="board-new-tile" onClick={() => setDialog({ type: 'create' })}>
              <span className="board-new-plus">+</span>
              <span>New board</span>
            </button>

            {visible.map((b) => (
              <BoardCard
                key={b.sessionId}
                board={b}
                isOwner={b.createdBy === user?.id}
                menuOpen={menuFor === b.sessionId}
                onToggleMenu={() => setMenuFor((cur) => (cur === b.sessionId ? null : b.sessionId))}
                onRename={() => {
                  setMenuFor(null);
                  setDialog({ type: 'rename', board: b });
                }}
                onCopyLink={() => handleCopyLink(b)}
                onDelete={() => {
                  setMenuFor(null);
                  setDialog({ type: 'delete', board: b });
                }}
              />
            ))}

            {visible.length === 0 && <p className="board-no-match">No boards match your search or filter.</p>}
          </div>
        )}
      </main>

      {dialog?.type === 'create' && (
        <NameDialog
          title="New board"
          description="Give it a name so it's easy to find later. You can leave it blank."
          placeholder="e.g. Sprint planning"
          submitLabel="Create & open"
          busy={dialogBusy}
          error={dialogError}
          onSubmit={handleCreate}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'rename' && (
        <NameDialog
          title="Rename board"
          initial={dialog.board.name}
          placeholder="Board name"
          submitLabel="Save"
          required
          busy={dialogBusy}
          error={dialogError}
          onSubmit={handleRename}
          onClose={closeDialog}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteIsOwner ? 'Delete this board?' : 'Remove from your list?'}
          message={
            deleteIsOwner
              ? `"${deleteTarget.name}" and its chat will be permanently deleted for everyone. This can't be undone.`
              : `"${deleteTarget.name}" will disappear from your list. You can rejoin any time with the code ${deleteTarget.sessionId}.`
          }
          confirmLabel={deleteIsOwner ? 'Delete board' : 'Remove'}
          danger
          busy={dialogBusy}
          error={dialogError}
          onConfirm={handleDelete}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
