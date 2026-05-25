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

  // Reusable Claymorphism Style for Dark Mode
  const clayStyle = {
    backgroundColor: '#121214',
    boxShadow: `
      8px 8px 16px rgba(0, 0, 0, 0.6), 
      -8px -8px 16px rgba(255, 255, 255, 0.03), 
      inset 2px 2px 6px rgba(255, 255, 255, 0.04), 
      inset -2px -2px 6px rgba(0, 0, 0, 0.4)
    `
  };

  const clayButtonStyle = {
    backgroundColor: '#161618',
    boxShadow: `
      6px 6px 12px rgba(0, 0, 0, 0.5), 
      -6px -6px 12px rgba(255, 255, 255, 0.02), 
      inset 2px 2px 4px rgba(255, 255, 255, 0.05), 
      inset -2px -2px 4px rgba(0, 0, 0, 0.5)
    `
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0A0A0B] text-white font-sans p-4 lg:p-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      
      {/* LEFT PANEL: BRANDING (Hidden on Mobile) */}
      <div 
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative p-12 flex-col justify-between overflow-hidden rounded-3xl transition-all"
        style={clayStyle}
      >
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-4 hover:opacity-80 transition-opacity">
            <Logo size={40} />
            <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>VelocityBrain</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-[#EA803A] text-[11px] font-bold uppercase tracking-widest mb-6 opacity-90" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {'// Memory & Execution Engine'}
          </p>
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.15] mb-8" style={{ fontFamily: 'Syne, sans-serif' }}>
            Give your agent a real brain.
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed font-light">
            Local-first memory, deterministic workflows, and enterprise-grade execution. Stop guessing context and start building reliable AI systems.
          </p>
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

          {(oauthError || error) && (
            <div 
              className="p-4 bg-[#1A1111] rounded-2xl flex items-start gap-3 mb-8"
              style={{
                boxShadow: 'inset 2px 2px 6px rgba(255, 0, 0, 0.05), inset -2px -2px 6px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <p className="text-sm text-red-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{oauthError || error}</p>
            </div>
          )}

          <div className="space-y-5">
            <button
              type="button"
              onClick={loginWithGithub}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white"
              style={clayButtonStyle}
            >
              <Github className="h-6 w-6 text-[#EA803A]" />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 px-8 py-4 rounded-2xl font-semibold text-zinc-200 text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:text-white"
              style={clayButtonStyle}
            >
              <Google className="h-6 w-6 text-[#EA803A]" />
              Continue with Google
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