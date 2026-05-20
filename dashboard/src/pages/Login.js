import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Github, Google } from '../components/Icons';
import Logo from '../components/Logo';

export default function Login() {
  const { loginWithGithub, loginWithGoogle, error, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Also redirect if localStorage has token (backup check)
  useEffect(() => {
    const token = localStorage.getItem('velocitybrain_token');
    if (token && !loading && !user) {
      // Token exists but user not loaded yet, wait for auth context
      return;
    }
  }, [loading, user]);

  const oauthErrorMessages = {
    oauth_failed: 'OAuth sign-in could not be completed. Please try again.',
    github_failed: 'GitHub sign-in failed. Please try again.',
    google_failed: 'Google sign-in failed. Please try again.'
  };

  const oauthError = oauthErrorMessages[new URLSearchParams(location.search).get('error')] || null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#080808] text-white font-sans" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* LEFT PANEL: BRANDING (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative bg-[#040404] border-r border-[#1a1a1a] p-12 flex-col justify-between overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#EA803A] rounded-full blur-[150px] opacity-[0.08] pointer-events-none z-0" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size={40} className="" />
            <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-[#EA803A] text-[11px] font-bold uppercase tracking-widest mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {'// Memory & Execution Engine'}
          </p>
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
            Give your agent a real brain.
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Local-first memory, deterministic workflows, and enterprise-grade execution. Stop guessing context and start building reliable AI systems.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111] border border-[#2a2a2a]">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Systems Normal</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111] border border-[#2a2a2a]">
            <span className="text-xs text-zinc-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>MCP-ready</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: FORM AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-[#080808]">
        <div className="lg:hidden w-full max-w-md mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} className="" />
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
          </Link>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Welcome back bro...
            </h2>
            <p className="text-zinc-500 text-sm">
              Sign in to access your workspace.
            </p>
          </div>

          {(oauthError || error) && (
            <div className="p-3 border border-red-900/40 bg-red-900/10 rounded-xl flex items-start gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-xs text-red-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{oauthError || error}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={loginWithGithub}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-bold text-black text-base transition-all disabled:opacity-50"
              style={{ 
                fontFamily: 'Syne, sans-serif',
                background: '#EA803A',
                boxShadow: '4px 4px 0 #c4612a'
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#f0965a')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = '#EA803A')}
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-bold text-black text-base transition-all disabled:opacity-50"
              style={{ 
                fontFamily: 'Syne, sans-serif',
                background: '#EA803A',
                boxShadow: '4px 4px 0 #c4612a'
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#f0965a')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = '#EA803A')}
            >
              <Google className="h-5 w-5" />
              Continue with Google
            </button>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-[#EA803A] hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-[#EA803A] hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
