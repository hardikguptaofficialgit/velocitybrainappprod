import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Github, Google } from '../components/Icons';
import Logo from '../components/Logo';
import loginIllustration from '../assets/authillu.png';

const OAUTH_TIMEOUT_MS = 45_000;
const OAUTH_TIMEOUT_MESSAGE = 'Sign-in timed out. Please try again.';

export default function Login() {
  const { loginWithGithub, loginWithGoogle, error, user, loading } = useAuth();
  const [oauthAction, setOauthAction] = useState(null);
  const [localError, setLocalError] = useState(null);
  const oauthTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect after authentication (onboarding first for new accounts)
  useEffect(() => {
    if (!loading && user) {
      navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
    }
  }, [user, loading, navigate]);

  // Clear local error when context error updates
  useEffect(() => {
    if (error) setLocalError(null);
  }, [error]);

  const oauthErrorMessages = {
    oauth_failed: 'OAuth sign-in could not be completed. Please try again.',
    github_failed: 'GitHub sign-in failed. Please try again.',
    google_failed: 'Google sign-in failed. Please try again.'
  };

  const oauthError = oauthErrorMessages[new URLSearchParams(location.search).get('error')] || null;

  const displayError = oauthError || error || localError || null;

  const navigateAfterAuth = (authenticatedUser) => {
    const nextUser = authenticatedUser || user;
    if (!nextUser) return;
    navigate(nextUser.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
  };

  const startOauthTimeout = (provider) => {
    clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = setTimeout(() => {
      setOauthAction(null);
      setLocalError(OAUTH_TIMEOUT_MESSAGE);
    }, OAUTH_TIMEOUT_MS);
  };

  const clearOauthTimeout = () => {
    clearTimeout(oauthTimeoutRef.current);
  };

  const handleGithubLogin = async () => {
    setLocalError(null);
    setOauthAction('github');
    startOauthTimeout('github');
    try {
      const result = await loginWithGithub();
      if (result?.success) {
        navigateAfterAuth(result.user);
      } else if (!result?.pendingRedirect && !error) {
        setLocalError(result?.error || 'GitHub sign-in failed. Please try again.');
      }
    } finally {
      clearOauthTimeout();
      setOauthAction(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setOauthAction('google');
    startOauthTimeout('google');
    try {
      const result = await loginWithGoogle();
      if (result?.success) {
        navigateAfterAuth(result.user);
      } else if (!result?.pendingRedirect && !error) {
        setLocalError(result?.error || 'Google sign-in failed. Please try again.');
      }
    } finally {
      clearOauthTimeout();
      setOauthAction(null);
    }
  };

  const oauthDisabled = Boolean(oauthAction);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0A0A0B] text-white font-sans p-4 lg:p-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      
      {/* LEFT PANEL: illustration background + branding */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative flex-col justify-between overflow-hidden rounded-[3rem] border border-white/5 shadow-2xl min-h-[calc(100vh-3rem)] bg-black"
        style={{
          backgroundImage: `url(${loginIllustration})`,
          backgroundPosition: 'left center',
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B]/90 via-[#0A0A0B]/25 to-[#0A0A0B]/95 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0A0A0B]/40 pointer-events-none" />

        <div className="relative z-10 p-10 xl:p-12">
        
        </div>

      </div>

      {/* RIGHT PANEL: FORM AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-[#0A0A0B]">
        
        {/* Mobile Header */}
        <div className="lg:hidden w-full max-w-md mb-12 flex items-center justify-center">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
          </Link>
        </div>

        <div className="w-full max-w-md relative z-10 flex flex-col justify-center">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
              Welcome back bro...
            </h2>
            <p className="text-zinc-400 text-base font-light">
              Sign in to access your workspace.
            </p>
          </div>

          {displayError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 mb-8">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{displayError}</p>
            </div>
          )}

          {/* Elevated Dark Buttons */}
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={oauthDisabled}
              className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white bg-[#161618] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1d] shadow-lg shadow-black/40"
            >
              <Github className="h-6 w-6 text-white" />
              {oauthAction === 'github' ? 'Continuing with GitHub...' : 'Continue with GitHub'}
            </button>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={oauthDisabled}
              className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white bg-[#161618] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1d] shadow-lg shadow-black/40"
            >
              <Google className="h-6 w-6 text-[#EA803A]" />
              {oauthAction === 'google' ? 'Continuing with Google...' : 'Continue with Google'}
            </button>
          </div>

          <p className="text-center text-sm text-zinc-500 mt-10 font-light" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-[#EA803A] hover:text-[#f0965a] transition-colors">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-[#EA803A] hover:text-[#f0965a] transition-colors">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}