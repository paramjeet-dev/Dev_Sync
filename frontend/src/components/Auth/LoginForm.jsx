import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm() {
  const { login } = useAuth();
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
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Log in to Dev-Sync</h1>
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
      <button type="submit" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </button>
      <p className="auth-switch">
        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </form>
  );
}
