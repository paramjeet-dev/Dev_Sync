import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Authenticates purely via the httpOnly cookie the backend sets on
// signup/login (withCredentials sends it automatically on every request).
// Deliberately no Authorization header sourced from localStorage/JS-
// readable storage — see AuthContext.jsx for the reasoning.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default api;
