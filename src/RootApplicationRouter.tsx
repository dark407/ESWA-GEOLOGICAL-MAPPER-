import React, { useEffect, useState } from 'react';
import App from './App';
import { MasterAdminPortalWebsite } from './components/MasterAdminPortalWebsite';
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
import {
  getStoredGeologistProfiles,
  syncGeologistProfileFromRegisteredUser,
} from './engine/userCloudAndPackageEngine';

export const RootApplicationRouter: React.FC = () => {

  // Detect whether this instance is the Normal User App:
  // - FALSE by default (Master Software for Master Owner on both PC and Android)
  // - TRUE only when compiled inside User APK (__ESWA_EDITION__='user') or opened explicitly with ?edition=user or ?download=user-apk
  const [isUserEdition, setIsUserEdition] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __ESWA_EDITION__?: string;
        __ESWA_NATIVE_ANDROID_APK__?: boolean;
        __ESWA_MASTER_ANDROID_APK__?: boolean;
        eswaDesktop?: { edition?: string };
        akashDesktop?: { edition?: string };
      };
      const desktopEdition = (
        win.eswaDesktop?.edition ||
        win.akashDesktop?.edition ||
        ''
      ).toLowerCase();
      if (
        win.__ESWA_MASTER_ANDROID_APK__ === true ||
        win.__ESWA_EDITION__ === 'master' ||
        desktopEdition === 'master'
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
      if (
        win.__ESWA_EDITION__ === 'user' ||
        desktopEdition === 'user' ||
        win.__ESWA_NATIVE_ANDROID_APK__ === true
      ) {
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

  // Check if URL or saved Master state points to Master Admin Portal or Geological Mapping Software
  const [viewMode, setViewMode] = useState<'software' | 'admin_website'>(() => {
    if (typeof window !== 'undefined') {
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
        if (savedView === 'admin_website' || savedView === 'software') {
          return savedView;
        }
      } catch {
        // Ignore
      }
    }
    return 'software';
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
  const [revokedNoticeText, setRevokedNoticeText] = useState<string | null>(null);

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
    // If running in Master Software mode (default for Master Owner), ensure Master PC status & Akash Dhanush Eswar profile are active
    if (!isUserEdition) {
      setLocalMasterPcBypass(true);
      getStoredGeologistProfiles();
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

    // Keep User Settings Geologist Profile synced with the first-time registered user's Name, Email & Position
    syncGeologistProfileFromRegisteredUser({
      userId: currentSession.userId,
      fullName: currentSession.fullName,
      email: currentSession.email,
      position: currentSession.roleTitle,
      phone: currentSession.phone,
    });

    const unsub = subscribeUserAccountStatus(
      currentSession.userId,
      (status, lic) => {
        if (status === 'SUSPENDED' || status === 'REVOKED') {
          setSuspendedLicenseInfo(
            lic || {
              userId: currentSession.userId,
              portalScope: 'ESWA_GLOBAL',
              password: '',
              licenseKey: currentSession.licenseKey || '',
              fullName: currentSession.fullName,
              email: currentSession.email || '',
              phone: currentSession.phone || '',
              organization: currentSession.organization || '',
              boundPcHardwareId: currentSession.pcHardwareId,
              boundPcName: currentSession.roleTitle || 'Geologist',
              status: 'REVOKED',
              installedVersion: '1.0.0',
              lastSeenAtIso: new Date().toISOString(),
              createdAtIso: currentSession.activatedAtIso,
              adminAuthSig: '',
            }
          );
          setRevokedNoticeText(
            lic
              ? `Your software access has been revoked by the Master Administrator.`
              : `Your user account (${currentSession.fullName}) was removed by the Master Administrator.`
          );
          saveLocalActivatedSession(null);
          setActiveSession(null);
        } else if (status === 'ACTIVE' && lic) {
          setSuspendedLicenseInfo(null);
          setRevokedNoticeText(null);
        }
      }
    );

    return () => {
      unsub();
    };
  }, [isUserEdition, activeSession?.userId]);

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

  const handleExitPreviewUserEdition = () => {
    setIsOwnerPreviewingUserEdition(false);
    setIsUserEdition(false);
    setViewMode('admin_website');
  };

  // 1. Standalone Master Admin Licensing & Update Control Website (Only for Master Owner)
  if (viewMode === 'admin_website' && (!isUserEdition || isOwnerPreviewingUserEdition)) {
    return (
      <MasterAdminPortalWebsite
        onSwitchToSoftware={handleSwitchToSoftware}
        onPreviewUserSoftware={handleStartPreviewUserEdition}
        onMasterPcStatusChanged={() => {}}
      />
    );
  }

  // 2. First-Time User Registration & Access Control Gate for User APK / User Software Edition
  if (isUserEdition && (!activeSession || suspendedLicenseInfo || revokedNoticeText)) {
    return (
      <SoftwareAccessGate
        onAuthorizedSession={(session) => {
          setSuspendedLicenseInfo(null);
          setRevokedNoticeText(null);
          setActiveSession(session);
          syncGeologistProfileFromRegisteredUser({
            userId: session.userId,
            fullName: session.fullName,
            email: session.email,
            position: session.roleTitle,
            phone: session.phone,
          });
        }}
        suspendedLicense={suspendedLicenseInfo}
        revokedMessage={revokedNoticeText}
        isOwnerPreview={isOwnerPreviewingUserEdition}
        onExitOwnerPreview={
          isOwnerPreviewingUserEdition ? handleExitPreviewUserEdition : undefined
        }
      />
    );
  }

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden"
      data-window="root-application-shell"
      data-element-id="root-application-container"
    >
      <SoftwareLiveUpdateNotifier
        isMasterSoftware={!isUserEdition}
        activeSession={activeSession}
        onOpenAdminPortal={handleOpenAdminWebsite}
      />
      <div className="flex-1 min-h-0 w-full relative overflow-hidden">
        <App
          isMasterSoftware={!isUserEdition}
          onOpenAdminPortal={handleOpenAdminWebsite}
        />
      </div>
    </div>
  );
};
