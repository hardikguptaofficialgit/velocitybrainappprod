import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));
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
const AuthShell = lazy(() => import('./components/AuthShell'));
const ProtectedRouteShell = lazy(() =>
  import('./components/AuthShell').then((module) => ({ default: module.ProtectedRouteShell }))
);
const OnboardingRouteShell = lazy(() =>
  import('./components/AuthShell').then((module) => ({ default: module.OnboardingRouteShell }))
);
const Onboarding = lazy(() => import('./pages/Onboarding'));

const AppShellFallback = () => (
  <div className="min-h-screen bg-[#080808] flex items-center justify-center text-sm text-zinc-500">
    Loading...
  </div>
);

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen">
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
            </div>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
  </ThemeProvider>
  );
}

export default App;
