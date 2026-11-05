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

// Suppress transient Firestore WebChannel background stream assertion failures (ca9 / b815) and permission fallbacks
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || event.error?.message || '');
      if (
        (msg.includes('FIRESTORE') &&
          (msg.includes('ca9') ||
            msg.includes('b815') ||
            msg.includes('INTERNAL ASSERTION FAILED') ||
            msg.includes('Unexpected state'))) ||
        msg.includes('Missing or insufficient permissions') ||
        msg.includes('permission-denied')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
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
        (msg.includes('FIRESTORE') &&
          (msg.includes('ca9') ||
            msg.includes('b815') ||
            msg.includes('INTERNAL ASSERTION FAILED') ||
            msg.includes('Unexpected state'))) ||
        msg.includes('Missing or insufficient permissions') ||
        msg.includes('permission-denied')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
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
      (msg.includes('FIRESTORE') &&
        (msg.includes('ca9') ||
          msg.includes('b815') ||
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Unexpected state'))) ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('permission-denied')
    ) {
      // Do not crash application on transient Firestore background stream or permission error
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

// Application Version Synchronization, Factory Zeroing & Cache Purge Guard
if (typeof window !== 'undefined') {
  try {
    // One-time Factory Zeroing Reset so the software opens like a brand-new installation with zero pre-fed data
    if (localStorage.getItem('eswa_fresh_install_zeroed_v1') !== 'true') {
      const preservedKeys = [
        'eswa_pc_hardware_fingerprint_v1',
        'eswa_master_pc_bypass_v1',
        'eswa_1pc_activated_session_v1',
        'eswa_installed_software_version_v1',
        'eswa_master_admin_credentials_v1',
        'eswa_deleted_user_tombstones_v1',
        'eswa_geologist_user_profiles_v1',
        'eswa_active_geologist_profile_id_v1',
      ];
      const preservedEntries: Array<[string, string]> = [];
      for (const k of preservedKeys) {
        const val = localStorage.getItem(k);
        if (val !== null) {
          preservedEntries.push([k, val]);
        }
      }
      localStorage.clear();
      for (const [k, val] of preservedEntries) {
        localStorage.setItem(k, val);
      }
      localStorage.setItem('eswa_fresh_install_zeroed_v1', 'true');
      // Note: fastAsyncStorageEngine.preloadAllPhotosIntoMemoryAsync() will also clear IndexedDB stores
    }

    // Purge any legacy pre-seeded dummy geologist profiles ('R. K. Sharma', 'Vikram Malhotra', 'Dr. Amit Roy')
    const rawProfiles = localStorage.getItem('eswa_geologist_user_profiles_v1');
    if (rawProfiles) {
      try {
        const parsedProfiles = JSON.parse(rawProfiles);
        if (Array.isArray(parsedProfiles)) {
          const legacyIds = new Set(['prof_contractor_lead', 'prof_pmc_reviewer', 'prof_client_rep']);
          const legacyNames = new Set(['r. k. sharma', 'vikram malhotra', 'dr. amit roy']);
          const cleanedProfiles = parsedProfiles.filter(
            (p) =>
              p &&
              !legacyIds.has(String(p.id || '')) &&
              !legacyNames.has(String(p.name || '').trim().toLowerCase())
          );
          if (cleanedProfiles.length !== parsedProfiles.length) {
            if (cleanedProfiles.length > 0) {
              localStorage.setItem('eswa_geologist_user_profiles_v1', JSON.stringify(cleanedProfiles));
              localStorage.setItem('eswa_active_geologist_profile_id_v1', cleanedProfiles[0].id);
            } else {
              localStorage.removeItem('eswa_geologist_user_profiles_v1');
              localStorage.removeItem('eswa_active_geologist_profile_id_v1');
            }
          }
        }
      } catch {
        // Ignore malformed profile list
      }
    }

    // Purge deprecated geological modelling storage and stale mode references
    if (localStorage.getItem('eswa_active_industry_mode') === 'GEOLOGICAL_MODELLING') {
      localStorage.setItem('eswa_active_industry_mode', 'NATM');
    }
    if (localStorage.getItem('eswa_default_industry_mode') === 'GEOLOGICAL_MODELLING') {
      localStorage.setItem('eswa_default_industry_mode', 'NATM');
    }
    localStorage.removeItem('eswa_geological_modelling_suite_db_db_v1');
    localStorage.removeItem('eswa_geological_modelling_suite_db_v1');
    localStorage.removeItem('eswa_isolated_db_GEOLOGICAL_MODELLING');

    // Clean up stale or deprecated cache keys and legacy OTP verification token
    const staleKeys = [
      'eswa_active_industry_mode_v1',
      'eswa_temp_modelling_cache',
      'eswa_master_verified_session_v1',
    ];
    staleKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage access restrictions
  }
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        if (import.meta.env.DEV) {
          registration.unregister().catch(() => {});
        } else {
          registration.update().catch(() => {});
        }
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
