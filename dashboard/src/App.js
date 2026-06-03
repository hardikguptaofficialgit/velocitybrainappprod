import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppErrorBoundary from './components/AppErrorBoundary';
import AuthShell, { ProtectedRouteShell, OnboardingRouteShell } from './components/AuthShell';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ApiKeys from './pages/ApiKeys';
import Onboarding from './pages/Onboarding';
import BlobLoader from './components/BlobLoader';
import { isBackendUnavailable } from './lib/network';
import './App.css';

const Agents = lazy(() => import('./pages/Agents'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Usage = lazy(() => import('./pages/Usage'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Landing = lazy(() => import('./pages/Landing'));
const CompanyBrain = lazy(() => import('./pages/CompanyBrain'));
const Documentation = lazy(() => import('./pages/Documentation'));
const Research = lazy(() => import('./pages/Research'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));

const AppShellFallback = () => (
  <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6 text-center text-sm text-zinc-500">
    <div className="space-y-4">
      <BlobLoader size={72} label="Loading VelocityBrain..." />
      <p className="max-w-xs text-xs leading-5 text-zinc-500">
        Opening your workspace. If this takes more than a few seconds, refresh the page.
      </p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !isBackendUnavailable(error) && failureCount < 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000
    },
    mutations: {
      retry: false
    }
  }
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen">
              <AppErrorBoundary>
                <Suspense fallback={<AppShellFallback />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/company-brain" element={<CompanyBrain />} />
                    <Route path="/docs" element={<Documentation />} />
                    <Route path="/research" element={<Research />} />
                    <Route path="/research/:slug" element={<Research />} />
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
                    <Route element={<AuthShell />}>
                      <Route path="/login" element={<Login />} />
                      <Route path="/oauth-callback" element={<OAuthCallback />} />
                      <Route element={<ProtectedRouteShell />}>
                        <Route element={<OnboardingRouteShell />}>
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/dashboard" element={<Layout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="agents" element={<Agents />} />
                            <Route path="integrations" element={<Integrations />} />
                            <Route path="api-keys" element={<ApiKeys />} />
                            <Route path="billing" element={<Navigate to="/dashboard" replace />} />
                            <Route path="usage" element={<Usage />} />
                            <Route path="settings" element={<Settings />} />
                          </Route>
                        </Route>
                      </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </AppErrorBoundary>
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
  </ThemeProvider>
  );
}

export default App;
