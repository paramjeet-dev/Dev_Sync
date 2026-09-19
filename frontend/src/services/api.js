import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the httpOnly auth cookie
});

// Also attach the token as a bearer header for environments where the
// cookie isn't available (e.g. cross-site setups), sourced from localStorage.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dev_sync_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
