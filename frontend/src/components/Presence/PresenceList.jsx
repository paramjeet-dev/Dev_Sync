// A curated set of hues chosen to sit comfortably alongside the app's
// violet accent and teal "live" color, rather than a generic rainbow —
// avoids a returning user's avatar color clashing with the UI's own palette.
const AVATAR_COLORS = ['#E56399', '#E8823C', '#D4A72C', '#5FA85C', '#3FAE9A', '#4A9FD8', '#6E56CF', '#9257C9'];

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function PresenceList({ participants, selfSocketId }) {
  return (
    <div className="presence-list">
      <span className="presence-label">
        {participants.length} online
      </span>
      <div className="presence-avatars">
        {participants.map((p) => (
          <div
            key={p.socketId}
            className={`presence-avatar ${p.socketId === selfSocketId ? 'is-self' : ''}`}
            style={{ backgroundColor: colorForUser(p.userId) }}
            title={p.username + (p.socketId === selfSocketId ? ' (you)' : '')}
          >
            {p.username.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
