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

// Joining with the room code is what grants access to a board (chat, scene, realtime).
export async function joinSession(sessionId) {
  const { data } = await api.post(`/sessions/${sessionId}/join`);
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

export async function renameSession(sessionId, name) {
  const { data } = await api.patch(`/sessions/${sessionId}`, { name });
  return data.session;
}

export async function saveThumbnail(sessionId, thumbnail) {
  await api.put(`/sessions/${sessionId}/thumbnail`, { thumbnail });
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

// Whisper identifies the format from the filename, so it must match what the browser recorded
// (Chrome/Firefox: webm, Safari: mp4).
const AUDIO_EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
};

export async function transcribeAudio(blob, language) {
  const baseType = (blob.type || '').split(';')[0].trim().toLowerCase();
  const formData = new FormData();
  formData.append('audio', blob, `recording.${AUDIO_EXTENSIONS[baseType] || 'webm'}`);
  if (language) formData.append('language', language);

  const { data } = await api.post('/transcription', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // { text, language, sizeBytes }
}
