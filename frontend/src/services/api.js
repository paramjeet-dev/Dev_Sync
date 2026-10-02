import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const AUTH_EXPIRED_EVENT = 'auth:expired';

// Authenticates purely via the httpOnly cookie (withCredentials sends it automatically).
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// If any non-auth request comes back 401, the login cookie has expired or been revoked.
// Tell the app so it can send the person to the login page instead of failing silently.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
