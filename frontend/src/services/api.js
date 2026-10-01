import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Authenticates purely via the httpOnly cookie (withCredentials sends it automatically).
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default api;
