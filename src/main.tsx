import React, {Component, ReactNode, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RootApplicationRouter} from './RootApplicationRouter.tsx';
import {ThemeProvider} from './context/ThemeContext.tsx';
import {initializeDesktopRuntimeBridge} from './engine/desktopBridge.ts';
import {initEnterpriseSecurityShield} from './engine/softwareLicensingEngine.ts';
import {initGlobalMouseDragScroll} from './utils/mouseDragScroll.ts';
import './index.css';

// Initialize Enterprise Anti-DevTools & IP Protection Shield
initEnterpriseSecurityShield();

// Initialize PC mouse drag-to-scroll sliding on all scrollable bars and containers
initGlobalMouseDragScroll();

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

// Suppress transient Firestore WebChannel background stream assertion failures (ca9 / b815)
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || event.error?.message || '');
      if (
        msg.includes('FIRESTORE') &&
        (msg.includes('ca9') ||
          msg.includes('b815') ||
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Unexpected state'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        console.warn('Recovered from transient Firestore background stream assertion:', msg);
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const msg = String(event.reason?.message || event.reason || '');
      if (
        msg.includes('FIRESTORE') &&
        (msg.includes('ca9') ||
          msg.includes('b815') ||
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Unexpected state'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        console.warn('Recovered from transient Firestore background stream assertion rejection:', msg);
      }
    },
    true
  );
}

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error || 'Unexpected error');
    if (
      msg.includes('FIRESTORE') &&
      (msg.includes('ca9') ||
        msg.includes('b815') ||
        msg.includes('INTERNAL ASSERTION FAILED') ||
        msg.includes('Unexpected state'))
    ) {
      // Do not crash application on transient Firestore background stream error
      console.warn('Suppressed Firestore internal assertion in RootErrorBoundary:', msg);
      return { hasError: false, errorMessage: '' };
    }
    return {
      hasError: true,
      errorMessage: msg,
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

// Application Version Synchronization & Cache Purge Guard
if (typeof window !== 'undefined') {
  try {
    // Purge deprecated geological modelling storage and stale mode references
    if (localStorage.getItem('eswa_active_industry_mode') === 'GEOLOGICAL_MODELLING') {
      localStorage.setItem('eswa_active_industry_mode', 'NATM');
    }
    if (localStorage.getItem('eswa_default_industry_mode') === 'GEOLOGICAL_MODELLING') {
      localStorage.setItem('eswa_default_industry_mode', 'NATM');
    }
    localStorage.removeItem('eswa_geological_modelling_suite_db_v1');
    localStorage.removeItem('eswa_isolated_db_GEOLOGICAL_MODELLING');

    // Clean up stale or deprecated cache keys
    const staleKeys = ['eswa_active_industry_mode_v1', 'eswa_temp_modelling_cache'];
    staleKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage access restrictions
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
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  // Ensure new releases take control immediately without serving stale bundles
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.info('ESWA Suite updated to the latest version.');
  });
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
