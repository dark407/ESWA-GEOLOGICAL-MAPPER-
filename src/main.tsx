import React, {Component, ReactNode, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RootApplicationRouter} from './RootApplicationRouter.tsx';
import {ThemeProvider} from './context/ThemeContext.tsx';
import {initializeDesktopRuntimeBridge} from './engine/desktopBridge.ts';
import './index.css';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error || 'Unexpected error'),
    };
  }

  componentDidCatch(error: unknown) {
    console.warn('Recovered from application render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-cyan-400 mb-2">Workspace Reload Required</h2>
            <p className="text-xs text-slate-400 mb-4 font-mono break-words">
              {this.state.errorMessage || 'A temporary rendering issue occurred.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({hasError: false, errorMessage: ''});
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    })
    .catch(() => {});
}

initializeDesktopRuntimeBridge()
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <RootErrorBoundary>
          <ThemeProvider>
            <RootApplicationRouter />
          </ThemeProvider>
        </RootErrorBoundary>
      </StrictMode>
    );
  });
