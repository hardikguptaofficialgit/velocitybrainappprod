import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Github, Google } from '../components/Icons';
import Logo from '../components/Logo';
import BlobLoader from '../components/BlobLoader';
import loginIllustration from '../assets/authillu.png';

const OAUTH_TIMEOUT_MS = 45_000;
const OAUTH_TIMEOUT_MESSAGE = 'Sign-in timed out. Please try again.';

const initialForm = {
  twoFactorCode: ''
};

export default function Login() {
  const {
    loginWithGithub,
    loginWithGoogle,
    completeTwoFactor,
    error,
    user,
    loading,
    oauthPending
  } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [oauthAction, setOauthAction] = useState(null);
  const [formAction, setFormAction] = useState(null);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [localError, setLocalError] = useState(null);
  const oauthTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  const startOauthTimeout = () => {
    clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = setTimeout(() => {
      setOauthAction(null);
      setLocalError(OAUTH_TIMEOUT_MESSAGE);
    }, OAUTH_TIMEOUT_MS);
  };

  const clearOauthTimeout = () => {
    clearTimeout(oauthTimeoutRef.current);
  };

  const routeAfterAuth = (nextUser) => {
    navigate(nextUser?.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
  };

  const resetAuthHandoff = () => {
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    localStorage.removeItem('velocitybrain_oauth_pending');
    localStorage.removeItem('velocitybrain_oauth_provider');
    localStorage.removeItem('velocitybrain_oauth_pending_started_at');
    sessionStorage.clear();
    window.location.assign('/login');
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleOauth = async (provider) => {
    const action = provider === 'github' ? loginWithGithub : loginWithGoogle;
    const providerLabel = provider === 'github' ? 'GitHub' : 'Google';
    setLocalError(null);
    setOauthAction(provider);
    startOauthTimeout();

    try {
      const result = await action();
      if (result?.success) {
        routeAfterAuth(result.user);
      } else if (result?.requiresTwoFactor) {
        setTwoFactorChallenge({
          token: result.challengeToken,
          user: result.user
        });
        setLocalError(null);
      } else if (!result?.pendingRedirect && !error) {
        setLocalError(result?.error || `${providerLabel} sign-in failed. Please try again.`);
      }
    } finally {
      clearOauthTimeout();
      setOauthAction(null);
    }
  };

  const handleTwoFactorSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);

    if (!twoFactorChallenge?.token) {
      setLocalError('Two-factor challenge expired. Please sign in again.');
      setTwoFactorChallenge(null);
      return;
    }

    const token = form.twoFactorCode.trim();
    if (!/^\d{6}$/.test(token)) {
      setLocalError('Enter the 6-digit authenticator code.');
      return;
    }

    setFormAction('2fa');
    try {
      const result = await completeTwoFactor({
        challengeToken: twoFactorChallenge.token,
        token
      });

      if (result?.success) {
        routeAfterAuth(result.user);
        return;
      }

      setLocalError(result?.error || 'Could not verify that code. Please try again.');
    } finally {
      setFormAction(null);
    }
  };

  const oauthDisabled = Boolean(oauthAction || formAction);
  const formDisabled = Boolean(formAction);

  if (user) {
    return <Navigate to={user.onboardingCompleted ? '/dashboard' : '/onboarding'} replace />;
  }

  if ((loading && !formAction) || oauthPending) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-6 text-center text-white">
        <div className="space-y-4">
          <BlobLoader
            size={84}
            label={oauthPending ? 'Completing secure sign in...' : 'Checking your session...'}
          />
          <button
            type="button"
            onClick={resetAuthHandoff}
            className="rounded-md border border-[#2a2a2a] px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-[#EA803A] hover:text-white"
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0A0A0B] text-white font-sans p-4 lg:p-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
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
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-[#0A0A0B]">
        <div className="lg:hidden w-full max-w-md mb-12 flex items-center justify-center">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
          </Link>
        </div>

        <div className="w-full max-w-md relative z-10 flex flex-col justify-center">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
              {twoFactorChallenge ? 'Verify your account' : 'Welcome back'}
            </h2>
            <p className="text-zinc-400 text-base font-light">
              {twoFactorChallenge
                ? `Enter the code for ${twoFactorChallenge.user?.email || 'your account'}.`
                : 'Sign in with Google or GitHub to access your workspace.'}
            </p>
          </div>

          {displayError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{displayError}</p>
            </div>
          )}

          {!twoFactorChallenge && (
            <>
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={() => handleOauth('github')}
                  disabled={oauthDisabled}
                  className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white bg-[#161618] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1d] shadow-lg shadow-black/40"
                >
                  <Github className="h-6 w-6 text-white" />
                  {oauthAction === 'github' ? 'Continuing with GitHub...' : 'Continue with GitHub'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOauth('google')}
                  disabled={oauthDisabled}
                  className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white bg-[#161618] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1d] shadow-lg shadow-black/40"
                >
                  <Google className="h-6 w-6 text-[#EA803A]" alt="" aria-hidden="true" />
                  {oauthAction === 'google' ? 'Continuing with Google...' : 'Continue with Google'}
                </button>
              </div>
            </>
          )}

          {twoFactorChallenge && (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase text-zinc-500">Authenticator code</span>
                <input
                  name="twoFactorCode"
                  inputMode="numeric"
                  value={form.twoFactorCode}
                  onChange={updateForm}
                  disabled={formDisabled}
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-white/10 bg-[#111113] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#EA803A]"
                  placeholder="123456"
                />
              </label>

              <button
                type="submit"
                disabled={formDisabled}
                className="w-full rounded-2xl bg-[#EA803A] px-5 py-4 text-sm font-bold text-black transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 hover:bg-[#f0965a]"
              >
                {formAction === '2fa' ? 'Verifying...' : 'Verify and continue'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTwoFactorChallenge(null);
                  setForm((current) => ({ ...current, twoFactorCode: '' }));
                }}
                className="w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
              >
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-center text-sm text-zinc-500 mt-8 font-light" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
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
