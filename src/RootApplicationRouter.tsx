import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import App from './App';
import { MasterAdminPortalWebsite } from './components/MasterAdminPortalWebsite';
import { ProductDownloadWebsite } from './components/ProductDownloadWebsite';
import {
  SoftwareAccessGate,
  SoftwareLiveUpdateNotifier,
} from './components/SoftwareAccessGateAndUpdater';
import {
  ActivatedClientSession,
  getLocalActivatedSession,
  getOrGeneratePcHardwareId,
  sanitizeIdentifier,
  saveLocalActivatedSession,
  setLocalMasterPcBypass,
  SoftwareLicenseRecord,
  subscribeUserAccountStatus,
  syncGithubRepoConfigToCloud,
} from './engine/softwareLicensingEngine';
import {
  downloadMasterAndroidApk,
  downloadMasterEditionDesktopExe,
  downloadUserAndroidApk,
  downloadUserEditionDesktopExe,
  getConfiguredGithubRepo,
  prepareAndroidApkBlobUrl,
} from './engine/windowsDesktopEngine';
import { db } from './firebase';

function isStandalonePublicWebsiteRoute(): boolean {
  if (import.meta.env.VITE_STANDALONE_WEBSITE === 'true') {
    return true;
  }
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const siteParam = (params.get('site') || '').toLowerCase();
    if (
      path === '/website' ||
      path.startsWith('/website/') ||
      hash === '#website' ||
      hash === '#/website' ||
      siteParam === 'website' ||
      siteParam === 'download'
    ) {
      return true;
    }
  }
  return false;
}

export const RootApplicationRouter: React.FC = () => {
  const [isStrictStandaloneRoute] = useState<boolean>(() =>
    isStandalonePublicWebsiteRoute()
  );

  // Detect whether this instance is the Normal User App:
  // - FALSE by default (Master Software for Master Owner on both PC and Android)
  // - TRUE only when compiled inside User APK (__ESWA_EDITION__='user') or opened explicitly with ?edition=user or ?download=user-apk
  const [isUserEdition, setIsUserEdition] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __ESWA_EDITION__?: string;
        __ESWA_NATIVE_ANDROID_APK__?: boolean;
        __ESWA_MASTER_ANDROID_APK__?: boolean;
      };
      if (
        win.__ESWA_MASTER_ANDROID_APK__ === true ||
        win.__ESWA_EDITION__ === 'master'
      ) {
        return false;
      }
      const params = new URLSearchParams(window.location.search);
      const dlParam = params.get('download')?.toLowerCase() || '';
      if (
        params.get('edition')?.toLowerCase() === 'master' ||
        params.get('portal')?.toLowerCase() === 'admin' ||
        dlParam === 'master-apk' ||
        dlParam === 'master-exe'
      ) {
        return false;
      }
      if (win.__ESWA_EDITION__ === 'user' || win.__ESWA_NATIVE_ANDROID_APK__ === true) {
        return true;
      }
      if (
        params.get('edition')?.toLowerCase() === 'user' ||
        params.get('platform')?.toLowerCase() === 'android' ||
        dlParam === 'user-apk' ||
        dlParam === 'user-exe'
      ) {
        return true;
      }
    }
    if (import.meta.env.VITE_SOFTWARE_EDITION === 'user') {
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Allow dynamic rotation between vertical and horizontal orientations
    try {
      const scr = window.screen as unknown as {
        orientation?: { unlock?: () => void };
      };
      if (scr?.orientation?.unlock) {
        scr.orientation.unlock();
      }
    } catch {
      // Ignore
    }

    // If running inside a GitHub Actions build with VITE_GITHUB_REPO / edition.json repo, automatically sync it to Cloud
    const detectedRepo = getConfiguredGithubRepo();
    if (detectedRepo) {
      void syncGithubRepoConfigToCloud(detectedRepo);
    }

    const params = new URLSearchParams(window.location.search);
    const dlParam = params.get('download')?.toLowerCase() || '';
    if (dlParam === 'master-apk') {
      downloadMasterAndroidApk();
    } else if (dlParam === 'user-apk') {
      downloadUserAndroidApk();
    } else if (dlParam === 'user-exe') {
      downloadUserEditionDesktopExe();
    } else if (dlParam === 'master-exe') {
      downloadMasterEditionDesktopExe();
    }
  }, []);

  // Track if the Master Owner is temporarily previewing the User Software inside the same window
  const [isOwnerPreviewingUserEdition, setIsOwnerPreviewingUserEdition] =
    useState<boolean>(false);

  // Check if URL or saved Master state points to the Standalone Download Website, Master Admin Portal, or Geological Mapping Software
  const [viewMode, setViewMode] = useState<
    'public_website' | 'software' | 'admin_website'
  >(() => {
    if (typeof window !== 'undefined') {
      if (isStandalonePublicWebsiteRoute()) {
        return 'public_website';
      }
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (path.startsWith('/admin') || search.includes('portal=admin')) {
        return 'admin_website';
      }
      if (search.includes('view=software') || search.includes('edition=user')) {
        return 'software';
      }
      try {
        const savedView = localStorage.getItem('eswa_master_active_view_mode_v2');
        if (
          savedView === 'public_website' ||
          savedView === 'admin_website' ||
          savedView === 'software'
        ) {
          return savedView;
        }
      } catch {
        // Ignore
      }
    }
    return 'public_website';
  });

  useEffect(() => {
    if (!isUserEdition) {
      try {
        localStorage.setItem('eswa_master_active_view_mode_v2', viewMode);
      } catch {
        // Ignore
      }
    }
  }, [viewMode, isUserEdition]);

  // 1-Time Login Session for Normal User Software (saved permanently on their 1 PC / Android phone)
  const [activeSession, setActiveSession] =
    useState<ActivatedClientSession | null>(() => getLocalActivatedSession());
  const [suspendedLicenseInfo, setSuspendedLicenseInfo] =
    useState<SoftwareLicenseRecord | null>(null);

  useEffect(() => {
    const onHydrated = () => {
      const hydrated = getLocalActivatedSession();
      if (hydrated) {
        setActiveSession(hydrated);
      }
    };
    window.addEventListener('eswa-desktop-storage-hydrated', onHydrated);
    return () => window.removeEventListener('eswa-desktop-storage-hydrated', onHydrated);
  }, []);

  useEffect(() => {
    // If running in Master Software mode (default for Master Owner), ensure Master PC status is active
    if (!isUserEdition) {
      setLocalMasterPcBypass(true);
      return;
    }

    const currentSession = activeSession || getLocalActivatedSession();
    if (
      !currentSession ||
      currentSession.userId === 'standalone_user' ||
      currentSession.userId === 'MASTER_OWNER'
    ) {
      return;
    }

    const unsub = subscribeUserAccountStatus(
      currentSession.userId,
      (status, lic) => {
        if (status === 'SUSPENDED' || status === 'REVOKED') {
          setSuspendedLicenseInfo(lic);
          saveLocalActivatedSession(null);
          setActiveSession(null);
        } else if (status === 'ACTIVE' && lic) {
          setSuspendedLicenseInfo(null);
        }
      }
    );

    return () => {
      unsub();
    };
  }, [isUserEdition, activeSession?.userId]);

  const handleOpenPublicWebsite = () => {
    setViewMode('public_website');
  };

  const handleOpenAdminWebsite = () => {
    setViewMode('admin_website');
  };

  const handleSwitchToSoftware = () => {
    setViewMode('software');
  };

  const handleStartPreviewUserEdition = () => {
    setIsOwnerPreviewingUserEdition(true);
    setIsUserEdition(true);
    setViewMode('software');
  };

  // 0. Standalone Public Product Showcase & Software Distribution Website (/website, Netlify deployment, or active Website View)
  // Public visitors have zero navigation or UI connection back to the mapping software.
  // Only the authenticated Master Owner (inside the password/OTP-protected Master Release Console) can switch views in AI Studio preview.
  if (isStrictStandaloneRoute || (viewMode === 'public_website' && !isUserEdition)) {
    return (
      <ProductDownloadWebsite
        onMasterSwitchToSoftware={
          import.meta.env.VITE_STANDALONE_WEBSITE === 'true'
            ? undefined
            : handleSwitchToSoftware
        }
        onMasterSwitchToAdminPortal={
          import.meta.env.VITE_STANDALONE_WEBSITE === 'true'
            ? undefined
            : handleOpenAdminWebsite
        }
      />
    );
  }

  // 1. Standalone Master Admin Licensing & Update Control Website (Only for Master Owner)
  if (viewMode === 'admin_website' && (!isUserEdition || isOwnerPreviewingUserEdition)) {
    return (
      <MasterAdminPortalWebsite
        onSwitchToSoftware={handleSwitchToSoftware}
        onOpenPublicWebsite={handleOpenPublicWebsite}
        onPreviewUserSoftware={handleStartPreviewUserEdition}
        onMasterPcStatusChanged={() => {}}
      />
    );
  }

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden"
      data-window="root-application-shell"
      data-element-id="root-application-container"
    >
      <div className="flex-1 min-h-0 w-full relative overflow-hidden">
        <App
          isMasterSoftware={!isUserEdition}
          onOpenAdminPortal={handleOpenAdminWebsite}
        />
      </div>
    </div>
  );
};
