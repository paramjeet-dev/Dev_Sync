const AVATAR_COLORS = ['#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA'];

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
            className="presence-avatar"
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
