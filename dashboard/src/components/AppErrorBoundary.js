import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] Render failure', error, info);
  }

  handleClearSession = () => {
    localStorage.removeItem('velocitybrain_token');
    localStorage.removeItem('velocitybrain_user');
    localStorage.removeItem('velocitybrain_oauth_pending');
    localStorage.removeItem('velocitybrain_oauth_provider');
    sessionStorage.clear();
    window.location.assign('/login');
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div className="w-full max-w-md rounded-2xl bg-[#121212] p-6 text-center shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#EA803A]">Setup interrupted</p>
          <h1 className="mt-3 text-2xl font-bold">We could not open this screen.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Refresh the app, or clear the saved session and sign in again.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={this.handleClearSession}
              className="flex-1 rounded-lg bg-[#EA803A] px-4 py-2.5 text-sm font-bold text-black"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
