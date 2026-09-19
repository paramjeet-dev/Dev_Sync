import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChatHistory } from '../../services/chatApi';
import { useAuth } from '../../context/AuthContext';

export default function ChatPanel({ socket, sessionId, connected }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ hasMore: false, nextCursor: null });
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendError, setSendError] = useState(null);
  const scrollRef = useRef(null);
  const shouldStickToBottom = useRef(true);

  // Initial page load.
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      setLoadingHistory(true);
      try {
        const { messages: initial, pagination: pageInfo } = await fetchChatHistory(sessionId);
        if (cancelled) return;
        setMessages(initial);
        setPagination(pageInfo);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Scroll to bottom on new messages (only if user was already at bottom).
  useEffect(() => {
    if (shouldStickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for realtime incoming chat messages.
  useEffect(() => {
    if (!socket) return undefined;
    function handleIncoming(message) {
      setMessages((prev) => [...prev, message]);
    }
    socket.on('chat:message', handleIncoming);
    return () => socket.off('chat:message', handleIncoming);
  }, [socket]);

  const loadOlder = useCallback(async () => {
    if (!pagination.hasMore || loadingMore) return;
    setLoadingMore(true);
    shouldStickToBottom.current = false;
    try {
      const { messages: older, pagination: pageInfo } = await fetchChatHistory(sessionId, {
        before: pagination.nextCursor,
      });
      setMessages((prev) => [...older, ...prev]);
      setPagination(pageInfo);
    } finally {
      setLoadingMore(false);
    }
  }, [sessionId, pagination, loadingMore]);

  function handleScroll(e) {
    const el = e.target;
    shouldStickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 60) {
      loadOlder();
    }
  }

  function handleSend(e) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !socket || !connected) return;

    setSendError(null);
    socket.emit('chat:send', { message: trimmed }, (response) => {
      if (!response?.ok) {
        setSendError(response?.error || 'Failed to send message.');
      }
    });
    setDraft('');
    shouldStickToBottom.current = true;
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">Chat</div>

      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
        {loadingHistory && <div className="chat-loading">Loading messages…</div>}
        {!loadingHistory && pagination.hasMore && (
          <button className="load-older-btn" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.userId === user?.id ? 'own' : ''} ${
              msg.metadata?.type === 'transcript' ? 'transcript' : ''
            }`}
          >
            <div className="chat-message-meta">
              <span className="chat-username">{msg.username}</span>
              <span className="chat-time">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="chat-message-body">{msg.message}</div>
          </div>
        ))}
      </div>

      {sendError && <div className="chat-error">{sendError}</div>}

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? 'Type a message…' : 'Connecting…'}
          disabled={!connected}
          maxLength={2000}
        />
        <button type="submit" disabled={!connected || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
