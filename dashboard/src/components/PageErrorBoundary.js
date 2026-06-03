import React from 'react';

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary] Page render failure', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 text-sm text-red-100 shadow-inner">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA803A]">Screen recovery</p>
        <h2 className="mt-3 text-xl font-bold text-white">This dashboard screen could not render.</h2>
        <p className="mt-2 max-w-2xl leading-6 text-red-200/80">
          Your session is still active. Refresh this screen or open another dashboard section while we recover.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[#EA803A] px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Refresh screen
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-red-900/40 bg-black/20 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-black/40"
          >
            Open dashboard
          </a>
        </div>
      </div>
    );
  }
}
