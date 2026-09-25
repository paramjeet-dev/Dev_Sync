import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import SignupForm from './components/Auth/SignupForm';
import LobbyPage from './pages/LobbyPage';
import WorkspacePage from './pages/WorkspacePage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage><LoginForm /></AuthPage>} />
            <Route path="/signup" element={<AuthPage><SignupForm /></AuthPage>} />
            <Route
              path="/lobby"
              element={
                <ProtectedRoute>
                  <LobbyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspace/:sessionId"
              element={
                <ProtectedRoute>
                  <WorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/lobby" replace />} />
            <Route path="*" element={<Navigate to="/lobby" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthPage({ children }) {
  return <div className="auth-page">{children}</div>;
}
