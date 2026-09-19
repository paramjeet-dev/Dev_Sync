import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function SignupForm() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ username, email, password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Create your Dev-Sync account</h1>
      {error && <div className="auth-error">{error}</div>}
      <label>
        Username
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_.-]+"
          title="Letters, numbers, underscores, dots, and hyphens only"
          autoComplete="username"
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Sign up'}
      </button>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
