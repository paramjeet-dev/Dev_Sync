import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchChatHistory } from '../../services/chatApi';
import { getErrorMessage } from '../../services/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const SEND_TIMEOUT_MS = 8000;

// A live message can also be present in a history page that was fetched around the same time.
function mergeById(existing, incoming) {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !seen.has(m.id))];
}

export default function ChatPanel({ socket, sessionId, connected }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ hasMore: false, nextCursor: null });
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendError, setSendError] = useState(null);
  const scrollRef = useRef(null);
  const shouldStickToBottom = useRef(true);

  const loadInitial = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const { messages: initial, pagination: pageInfo } = await fetchChatHistory(sessionId);
      // Keep anything that arrived live while the request was in flight.
      setMessages((live) => mergeById(initial, live));
      setPagination(pageInfo);
    } catch (err) {
      setHistoryError(getErrorMessage(err, "Couldn't load the chat history."));
    } finally {
      setLoadingHistory(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setMessages([]);
    loadInitial();
  }, [loadInitial]);

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
      setMessages((prev) => mergeById(prev, [message]));
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
      setMessages((prev) => mergeById(older, prev));
      setPagination(pageInfo);
    } catch (err) {
      toast(getErrorMessage(err, "Couldn't load older messages."), { type: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }, [sessionId, pagination, loadingMore, toast]);

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
    // timeout(): if the server never answers (dropped connection), the callback still fires with an
    // error instead of the message silently vanishing.
    socket.timeout(SEND_TIMEOUT_MS).emit('chat:send', { message: trimmed }, (err, response) => {
      if (err || !response?.ok) {
        setSendError(err ? "Message not sent — couldn't reach the server." : response?.error || 'Failed to send message.');
        setDraft((current) => current || trimmed); // give the text back so nothing is lost
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
        {historyError && (
          <div className="chat-history-error">
            <span>{historyError}</span>
            <button onClick={loadInitial}>Retry</button>
          </div>
        )}
        {!loadingHistory && pagination.hasMore && (
          <button className="load-older-btn" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        )}
        {!loadingHistory && !historyError && messages.length === 0 && (
          <div className="chat-loading">No messages yet. Say hello 👋</div>
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
