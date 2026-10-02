// Curated hues that sit comfortably alongside the app's violet accent and teal "live" color.
const AVATAR_COLORS = ['#E56399', '#E8823C', '#D4A72C', '#5FA85C', '#3FAE9A', '#4A9FD8', '#6E56CF', '#9257C9'];

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function PresenceList({ participants, selfSocketId }) {
  // Presence is tracked per connection, but people think in users: collapse several tabs/devices of
  // the same user into one avatar.
  const selfUserId = participants.find((p) => p.socketId === selfSocketId)?.userId;
  const byUser = new Map();
  participants.forEach((p) => {
    const entry = byUser.get(p.userId) || { ...p, connections: 0 };
    entry.connections += 1;
    byUser.set(p.userId, entry);
  });
  const people = Array.from(byUser.values());

  return (
    <div className="presence-list">
      <span className="presence-label">{people.length} online</span>
      <div className="presence-avatars">
        {people.map((p) => {
          const isSelf = p.userId === selfUserId;
          const tabs = p.connections > 1 ? ` · ${p.connections} tabs` : '';
          return (
            <div
              key={p.userId}
              className={`presence-avatar ${isSelf ? 'is-self' : ''}`}
              style={{ backgroundColor: colorForUser(p.userId) }}
              title={`${p.username}${isSelf ? ' (you)' : ''}${tabs}`}
            >
              {p.username.slice(0, 1).toUpperCase()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
