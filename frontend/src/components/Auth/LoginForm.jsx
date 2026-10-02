import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from './AuthLayout';
import { getErrorMessage } from '../../services/errors';

export default function LoginForm() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ identifier, password });
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sketch it out together"
      subtitle="An infinite whiteboard your whole team can draw on, talk over, and pick back up right where they left it."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="auth-form-subtitle">Log in to pick up your sessions.</p>
        {sessionExpired && !error && (
          <div className="auth-notice">Your session expired. Please log in again.</div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <label>
          Username or email
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
