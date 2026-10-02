import { Link } from 'react-router-dom';

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlaceholderIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="8" width="28" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 26 L18 18 L23 23 L28 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BoardCard({ board, isOwner, menuOpen, onToggleMenu, onRename, onCopyLink, onDelete }) {
  const people = `${board.memberCount} ${board.memberCount === 1 ? 'person' : 'people'}`;

  return (
    <div className={`board-card ${menuOpen ? 'menu-open' : ''}`}>
      <Link to={`/workspace/${board.sessionId}`} className="board-card-link">
        <div className="board-thumb">
          {board.thumbnail ? (
            <img src={board.thumbnail} alt="" loading="lazy" />
          ) : (
            <div className="board-thumb-empty">
              {board.elementCount === 0 ? <span>Empty board</span> : <PlaceholderIcon />}
            </div>
          )}
          <span className={`board-badge ${isOwner ? 'owner' : 'shared'}`}>{isOwner ? 'Owner' : 'Shared'}</span>
        </div>
        <div className="board-card-body">
          <span className="board-card-name" title={board.name}>
            {board.name}
          </span>
          <span className="board-card-meta">
            <code>{board.sessionId}</code>
            <span aria-hidden="true">·</span>
            {people}
          </span>
          <span className="board-card-meta">Opened {timeAgo(board.lastActivityAt)}</span>
        </div>
      </Link>

      <button
        className="board-menu-btn"
        aria-label={`Options for ${board.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu();
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <div className="board-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {isOwner && (
            <button role="menuitem" onClick={onRename}>
              Rename
            </button>
          )}
          <button role="menuitem" onClick={onCopyLink}>
            Copy invite link
          </button>
          <button role="menuitem" className="menu-danger" onClick={onDelete}>
            {isOwner ? 'Delete board' : 'Remove from my list'}
          </button>
        </div>
      )}
    </div>
  );
}
