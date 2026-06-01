import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BlobLoader from './BlobLoader';

export default function AuthShell() {
  return <Outlet />;
}

function AuthHandoff({ label = 'Completing secure sign in...' }) {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6 text-center text-sm text-zinc-500">
      <div className="space-y-4">
        <BlobLoader size={84} label={label} />
        <p className="mx-auto max-w-xs text-xs leading-5 text-zinc-500">
          Syncing your account and preparing onboarding. This should only take a moment.
        </p>
      </div>
    </div>
  );
}

export function ProtectedRouteShell() {
  const { user, loading, oauthPending } = useAuth();

  if (loading || oauthPending) {
    return <AuthHandoff />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function OnboardingRouteShell() {
  const { user, loading, oauthPending } = useAuth();
  const location = useLocation();

  if (loading || oauthPending) {
    return <AuthHandoff />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
