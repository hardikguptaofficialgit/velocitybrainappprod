import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ApiKeys from './pages/ApiKeys';
import Agents from './pages/Agents';
import Usage from './pages/Usage';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Documentation from './pages/Documentation';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import OAuthCallback from './pages/OAuthCallback';
import './App.css';

// Create a client for React Query
const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/docs" element={<Documentation />} />
                <Route path="/docs/cli" element={<Documentation />} />
                <Route path="/docs/mcp" element={<Documentation />} />
                <Route path="/docs/integrations" element={<Documentation />} />
                <Route path="/docs/token-efficiency" element={<Documentation />} />
                <Route path="/docs/security" element={<Documentation />} />
                <Route path="/docs/api" element={<Documentation />} />
                <Route path="/docs/architecture" element={<Documentation />} />
                <Route path="/docs/advanced" element={<Documentation />} />
                <Route path="/docs/skills" element={<Documentation />} />
                <Route path="/docs/agent" element={<Documentation />} />
                <Route path="/docs/production" element={<Documentation />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/oauth-callback" element={<OAuthCallback />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="api-keys" element={<ApiKeys />} />
                  <Route path="billing" element={<Navigate to="/dashboard" replace />} />
                  <Route path="usage" element={<Usage />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
}

export default App;
