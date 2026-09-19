import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { signup as signupApi, login as loginApi, logout as logoutApi, fetchMe } from '../services/authApi';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('dev_sync_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await fetchMe();
        setUser(me);
      } catch (err) {
        localStorage.removeItem('dev_sync_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signup = useCallback(async (payload) => {
    const { user: newUser, token: newToken } = await signupApi(payload);
    localStorage.setItem('dev_sync_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const login = useCallback(async (payload) => {
    const { user: loggedInUser, token: newToken } = await loginApi(payload);
    localStorage.setItem('dev_sync_token', newToken);
    setToken(newToken);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      localStorage.removeItem('dev_sync_token');
      disconnectSocket();
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, signup, login, logout, isAuthenticated: !!user }),
    [user, token, loading, signup, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
