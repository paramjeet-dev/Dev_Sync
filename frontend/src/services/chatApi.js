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
