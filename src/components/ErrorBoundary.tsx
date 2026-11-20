import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'An unexpected error occurred while loading the application.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    try {
      console.error('Kundu Enterprise runtime error:', error, info.componentStack);
    } catch {
      // Ignore console errors in restricted environments
    }
  }

  handleReload = (): void => {
    try {
      window.location.reload();
    } catch {
      this.setState({ hasError: false, errorMessage: '' });
    }
  };

  handleResetAndReload = (): void => {
    try {
      window.localStorage.removeItem('kundu_enterprise_pwa_v1');
    } catch {
      // Ignore storage errors
    }
    this.handleReload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-[#0B2C6F]">
                  Something went wrong
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kundu Enterprise hit an unexpected error instead of loading normally.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-rose-800 break-words">
              {this.state.errorMessage || 'Unknown rendering error'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="min-h-[44px] px-4 rounded-xl bg-[#0B2C6F] text-white text-sm font-bold hover:bg-[#082052] inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="min-h-[44px] px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100"
              >
                Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
