import api from './api';

export async function fetchChatHistory(sessionId, { before, limit } = {}) {
  const { data } = await api.get(`/chat/${sessionId}/messages`, {
    params: { before, limit },
  });
  return data; // { messages, pagination }
}

export async function createSession(name) {
  const { data } = await api.post('/sessions', { name });
  return data.session;
}

export async function fetchSession(sessionId) {
  const { data } = await api.get(`/sessions/${sessionId}`);
  return data.session;
}

export async function fetchMySessions() {
  const { data } = await api.get('/sessions');
  return data.sessions;
}

// Creator: deletes the board for everyone. Others: removes it from their list.
// Resolves to 'deleted' | 'removed'.
export async function deleteSession(sessionId) {
  const { data } = await api.delete(`/sessions/${sessionId}`);
  return data.result;
}

export async function fetchSnapshot(sessionId) {
  const { data } = await api.get(`/sessions/${sessionId}/snapshot`);
  return data.snapshot;
}

export async function transcribeAudio(blob, language) {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  if (language) formData.append('language', language);

  const { data } = await api.post('/transcription', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // { text, language, sizeBytes }
}
