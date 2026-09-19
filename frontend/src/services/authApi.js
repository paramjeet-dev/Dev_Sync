import api from './api';

export async function signup({ username, email, password }) {
  const { data } = await api.post('/auth/signup', { username, email, password });
  return data;
}

export async function login({ identifier, password }) {
  const { data } = await api.post('/auth/login', { identifier, password });
  return data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}
