import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signup as signupApi, login as loginApi, logout as logoutApi, fetchMe } from '../services/authApi';
import { disconnectSocket } from '../services/socket';
import { AUTH_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext(null);

/**
 * Auth state is derived entirely from the httpOnly cookie the backend sets on
 * signup/login — no token is held in React state or localStorage. "Am I logged
 * in" is answered by GET /api/auth/me.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // A request (or the socket handshake) was rejected as unauthenticated while we thought we were
  // logged in: drop the stale user so ProtectedRoute sends us to the login page.
  useEffect(() => {
    function handleExpired() {
      if (!userRef.current) return;
      disconnectSocket();
      setSessionExpired(true);
      setUser(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      try {
        const { user: me } = await fetchMe();
        setUser(me);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const signup = useCallback(async (payload) => {
    const { user: newUser } = await signupApi(payload);
    setSessionExpired(false);
    setUser(newUser);
    return newUser;
  }, []);

  const login = useCallback(async (payload) => {
    const { user: loggedInUser } = await loginApi(payload);
    setSessionExpired(false);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      disconnectSocket();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signup, login, logout, sessionExpired, isAuthenticated: !!user }),
    [user, loading, sessionExpired, signup, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
