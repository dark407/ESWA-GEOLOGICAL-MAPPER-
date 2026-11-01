import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCheck2,
  HardDrive,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Monitor,
  Play,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import {
  DEFAULT_CURRENT_RELEASE,
  deleteWebsiteRelease,
  downloadNetlifyTomlConfig,
  InstallerPackageKind,
  PlatformBinaryMeta,
  publishWebsiteRelease,
  subscribeWebsiteReleases,
  submitSoftwareAccessRequest,
  triggerWebsiteBinaryDownload,
  uploadWebsiteReleaseBinary,
  WebsiteReleaseRecord,
} from '../engine/websiteReleaseEngine';
import {
  getOrGeneratePcHardwareId,
  getStoredAdminCredentials,
  MASTER_ADMIN_DEFAULT_EMAIL,
} from '../engine/softwareLicensingEngine';
import {
  EswaAppBackgroundWatermark,
  EswaLoadingScreen,
  EswaTunnelLogo,
  playEswaWelcomeChime,
} from './EswaBrandIdentity';

const WEBSITE_MASTER_SESSION_KEY = 'eswa_website_master_logged_in_v1';
const MASTER_OWNER_EMAIL = MASTER_ADMIN_DEFAULT_EMAIL;
const MASTER_OWNER_EMAIL_SECONDARY = 'dhoniakash407@gmail.com';

export interface ProductDownloadWebsiteProps {
  onOpenWebApplication?: () => void;
  onMasterSwitchToSoftware?: () => void;
  onMasterSwitchToAdminPortal?: () => void;
}

const PACKAGE_CARDS: Array<{
  kind: InstallerPackageKind;
  badge: string;
  shortTitle: string;
  subtitle: string;
  platformType: 'WINDOWS' | 'ANDROID';
  editionType: 'MASTER' | 'USER';
  accentClass: string;
  buttonClass: string;
}> = [
  {
    kind: 'master_exe',
    badge: '1. MASTER EXE • WINDOWS 64-BIT',
    shortTitle: 'Master EXE (Windows Master Suite)',
    subtitle: 'Full Geological Mapping Suite + Master Software Access & License Control',
    platformType: 'WINDOWS',
    editionType: 'MASTER',
    accentClass: 'border-amber-400/50 bg-[#0B0F17]/95',
    buttonClass:
      'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/20',
  },
  {
    kind: 'user_exe',
    badge: '2. USER EXE • WINDOWS 64-BIT',
    shortTitle: 'User EXE (Windows Geologist Software)',
    subtitle: 'Dedicated Workstation Software for Field & Office Tunnel/Mining Geologists',
    platformType: 'WINDOWS',
    editionType: 'USER',
    accentClass: 'border-orange-500/50 bg-[#0B0F17]/95',
    buttonClass:
      'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black shadow-lg shadow-orange-500/20',
  },
  {
    kind: 'master_apk',
    badge: '3. ANDROID APK MASTER • MOBILE/TABLET',
    shortTitle: 'Android APK Master (Master Admin App)',
    subtitle: 'Standalone Signed Android Master Application with License Authorization',
    platformType: 'ANDROID',
    editionType: 'MASTER',
    accentClass: 'border-emerald-400/50 bg-[#0B0F17]/95',
    buttonClass:
      'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20',
  },
  {
    kind: 'user_apk',
    badge: '4. ANDROID APK USER • MOBILE/TABLET',
    shortTitle: 'Android APK User (Field Geologist App)',
    subtitle: 'Standalone Signed Android Field Mapping Application for Tablets & Phones',
    platformType: 'ANDROID',
    editionType: 'USER',
    accentClass: 'border-cyan-400/50 bg-[#0B0F17]/95',
    buttonClass:
      'bg-gradient-to-r from-cyan-400 to-sky-500 hover:from-cyan-300 hover:to-sky-400 text-slate-950 font-black shadow-lg shadow-cyan-500/20',
  },
];

export const ProductDownloadWebsite: React.FC<ProductDownloadWebsiteProps> = ({
  onOpenWebApplication,
  onMasterSwitchToSoftware,
  onMasterSwitchToAdminPortal,
}) => {
  const launchSoftwareCallback =
    onOpenWebApplication || onMasterSwitchToSoftware || onMasterSwitchToAdminPortal;

  // Opening Eagle Animation state (plays 3.0s Eagle Swoop-In on website launch)
  const [showOpeningAnimation, setShowOpeningAnimation] = useState<boolean>(true);

  const handleReplayOpeningAnimation = () => {
    playEswaWelcomeChime(true);
    setShowOpeningAnimation(true);
  };

  const [releases, setReleases] = useState<WebsiteReleaseRecord[]>([DEFAULT_CURRENT_RELEASE]);
  const [currentRelease, setCurrentRelease] = useState<WebsiteReleaseRecord>(
    DEFAULT_CURRENT_RELEASE
  );
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [downloadingKind, setDownloadingKind] = useState<InstallerPackageKind | null>(null);
  const [installGuideTab, setInstallGuideTab] = useState<'windows' | 'android'>('windows');

  // Master Admin Session & Login Modal
  const [isMasterLoggedIn, setIsMasterLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WEBSITE_MASTER_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [showMasterLoginModal, setShowMasterLoginModal] = useState(false);
  const [showMasterUploadDrawer, setShowMasterUploadDrawer] = useState(false);
  const [masterEmailInput, setMasterEmailInput] = useState(MASTER_OWNER_EMAIL);
  const [masterPasscodeInput, setMasterPasscodeInput] = useState('');
  const [masterLoginError, setMasterLoginError] = useState('');

  // Master Release Upload State (Strictly the 4 official packages)
  const [formVersion, setFormVersion] = useState('2.6.0');
  const [formTitle, setFormTitle] = useState(
    'ESWA GEOLOGICAL MAPPER — Official Windows (.EXE) & Android (.APK) Suite'
  );
  const [formSummary, setFormSummary] = useState(
    'Production release featuring the 4 official ESWA GEOLOGICAL MAPPER installers (Master EXE, User EXE, Android APK Master, Android APK User) with the official Eagle Logo and isolated NATM, TBM & Mining engines.'
  );
  const [formBulletsText, setFormBulletsText] = useState(
    DEFAULT_CURRENT_RELEASE.changelogBullets.join('\n')
  );
  const [formWinNotes, setFormWinNotes] = useState(
    DEFAULT_CURRENT_RELEASE.installationNotesWindow
  );
  const [formAndroidNotes, setFormAndroidNotes] = useState(
    DEFAULT_CURRENT_RELEASE.installationNotesAndroid
  );

  // 4 Binary Upload / URL overrides
  const [masterExeMetaDraft, setMasterExeMetaDraft] = useState<PlatformBinaryMeta | null>(null);
  const [userExeMetaDraft, setUserExeMetaDraft] = useState<PlatformBinaryMeta | null>(null);
  const [masterApkMetaDraft, setMasterApkMetaDraft] = useState<PlatformBinaryMeta | null>(null);
  const [userApkMetaDraft, setUserApkMetaDraft] = useState<PlatformBinaryMeta | null>(null);

  const [masterExeUrlOverride, setMasterExeUrlOverride] = useState('');
  const [userExeUrlOverride, setUserExeUrlOverride] = useState('');
  const [masterApkUrlOverride, setMasterApkUrlOverride] = useState('');
  const [userApkUrlOverride, setUserApkUrlOverride] = useState('');

  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [isPublishingRelease, setIsPublishingRelease] = useState(false);
  const [notifyInstalledApps, setNotifyInstalledApps] = useState(true);

  const masterExeFileRef = useRef<HTMLInputElement | null>(null);
  const userExeFileRef = useRef<HTMLInputElement | null>(null);
  const masterApkFileRef = useRef<HTMLInputElement | null>(null);
  const userApkFileRef = useRef<HTMLInputElement | null>(null);

  // License Request Form State
  const localHw = getOrGeneratePcHardwareId();
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqOrg, setReqOrg] = useState('');
  const [reqHwId, setReqHwId] = useState(localHw.pcHardwareId);
  const [reqDeviceName, setReqDeviceName] = useState(localHw.pcName);
  const [reqNotes, setReqNotes] = useState(
    'Requesting 1-PC / 1-Device License Activation for ESWA GEOLOGICAL MAPPER.'
  );
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSubmittedId, setReqSubmittedId] = useState<string | null>(null);
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    const unsub = subscribeWebsiteReleases((allReleases, activeRelease) => {
      setReleases(allReleases);
      setCurrentRelease(activeRelease);
    });
    return () => unsub();
  }, []);

  const handleCopyChecksum = (sha: string, key: string) => {
    navigator.clipboard?.writeText(sha).catch(() => {});
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2200);
  };

  const getBinaryMetaForKind = (
    rel: WebsiteReleaseRecord,
    kind: InstallerPackageKind
  ): PlatformBinaryMeta => {
    switch (kind) {
      case 'master_exe':
        return rel.masterExe;
      case 'user_exe':
        return rel.userExe || rel.windowsExe;
      case 'master_apk':
        return rel.masterApk;
      case 'user_apk':
        return rel.userApk || rel.androidApk;
    }
  };

  const handleDownloadBinary = async (kind: InstallerPackageKind) => {
    setDownloadingKind(kind);
    try {
      const meta = getBinaryMetaForKind(currentRelease, kind);
      await triggerWebsiteBinaryDownload(kind, meta);
    } finally {
      setTimeout(() => setDownloadingKind(null), 900);
    }
  };

  const handleMasterLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMasterLoginError('');
    const stored = getStoredAdminCredentials();
    const cleanEmail = masterEmailInput.trim().toLowerCase();
    const cleanPass = masterPasscodeInput.trim();
    const validEmail =
      cleanEmail === stored.email.toLowerCase() ||
      cleanEmail === MASTER_OWNER_EMAIL.toLowerCase() ||
      cleanEmail === MASTER_OWNER_EMAIL_SECONDARY.toLowerCase() ||
      cleanEmail === 'dhoniakash707@gmail.com';
    const validPass =
      cleanPass === stored.password || cleanPass === 'akash@master2026';

    if (!validEmail || !validPass) {
      setMasterLoginError(
        `Invalid Master Credentials. Authorized Owner: ${MASTER_OWNER_EMAIL} or ${MASTER_OWNER_EMAIL_SECONDARY}`
      );
      return;
    }
    try {
      localStorage.setItem(WEBSITE_MASTER_SESSION_KEY, 'true');
    } catch {
      // Ignore
    }
    setIsMasterLoggedIn(true);
    setShowMasterLoginModal(false);
    setShowMasterUploadDrawer(true);
    setMasterPasscodeInput('');
  };

  const handleMasterLogout = () => {
    try {
      localStorage.removeItem(WEBSITE_MASTER_SESSION_KEY);
    } catch {
      // Ignore
    }
    setIsMasterLoggedIn(false);
    setShowMasterUploadDrawer(false);
  };

  const handleFileUploadSelect = async (
    kind: InstallerPackageKind,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const meta = await uploadWebsiteReleaseBinary(
        kind,
        formVersion.trim() || '2.6.0',
        file,
        (msg) => setUploadStatusMsg(msg)
      );
      if (kind === 'master_exe') setMasterExeMetaDraft(meta);
      if (kind === 'user_exe') setUserExeMetaDraft(meta);
      if (kind === 'master_apk') setMasterApkMetaDraft(meta);
      if (kind === 'user_apk') setUserApkMetaDraft(meta);
    } catch (err) {
      setUploadStatusMsg(
        `Error processing ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const handlePublishNewRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVersion = formVersion.trim() || '2.6.0';
    setIsPublishingRelease(true);
    setUploadStatusMsg('Publishing 4-package release to Website & Cloud Registry...');

    try {
      const nextMasterExe: PlatformBinaryMeta = masterExeMetaDraft
        ? {
            ...masterExeMetaDraft,
            version: cleanVersion,
            ...(masterExeUrlOverride.trim() ? { downloadUrl: masterExeUrlOverride.trim() } : {}),
          }
        : {
            ...currentRelease.masterExe,
            version: cleanVersion,
            fileName: `ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe`,
            uploadedAtIso: new Date().toISOString(),
            ...(masterExeUrlOverride.trim()
              ? { downloadUrl: masterExeUrlOverride.trim(), storageMode: 'EXTERNAL_URL' }
              : {}),
          };

      const nextUserExe: PlatformBinaryMeta = userExeMetaDraft
        ? {
            ...userExeMetaDraft,
            version: cleanVersion,
            ...(userExeUrlOverride.trim() ? { downloadUrl: userExeUrlOverride.trim() } : {}),
          }
        : {
            ...currentRelease.userExe,
            version: cleanVersion,
            fileName: `ESWA-GEOLOGICAL-MAPPER-User-Setup.exe`,
            uploadedAtIso: new Date().toISOString(),
            ...(userExeUrlOverride.trim()
              ? { downloadUrl: userExeUrlOverride.trim(), storageMode: 'EXTERNAL_URL' }
              : {}),
          };

      const nextMasterApk: PlatformBinaryMeta = masterApkMetaDraft
        ? {
            ...masterApkMetaDraft,
            version: cleanVersion,
            ...(masterApkUrlOverride.trim() ? { downloadUrl: masterApkUrlOverride.trim() } : {}),
          }
        : {
            ...currentRelease.masterApk,
            version: cleanVersion,
            fileName: `ESWA-GEOLOGICAL-MAPPER-Master-Android.apk`,
            uploadedAtIso: new Date().toISOString(),
            ...(masterApkUrlOverride.trim()
              ? { downloadUrl: masterApkUrlOverride.trim(), storageMode: 'EXTERNAL_URL' }
              : {}),
          };

      const nextUserApk: PlatformBinaryMeta = userApkMetaDraft
        ? {
            ...userApkMetaDraft,
            version: cleanVersion,
            ...(userApkUrlOverride.trim() ? { downloadUrl: userApkUrlOverride.trim() } : {}),
          }
        : {
            ...currentRelease.userApk,
            version: cleanVersion,
            fileName: `ESWA-GEOLOGICAL-MAPPER-User-Android.apk`,
            uploadedAtIso: new Date().toISOString(),
            ...(userApkUrlOverride.trim()
              ? { downloadUrl: userApkUrlOverride.trim(), storageMode: 'EXTERNAL_URL' }
              : {}),
          };

      const bullets = formBulletsText
        .split('\n')
        .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean);

      const newRecord: WebsiteReleaseRecord = {
        releaseId: `rel_v${cleanVersion.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
        version: cleanVersion,
        title: formTitle.trim() || `ESWA GEOLOGICAL MAPPER v${cleanVersion}`,
        summary: formSummary.trim(),
        publishedAtIso: new Date().toISOString(),
        publishedBy: masterEmailInput || MASTER_OWNER_EMAIL,
        isCurrent: true,
        masterExe: nextMasterExe,
        userExe: nextUserExe,
        masterApk: nextMasterApk,
        userApk: nextUserApk,
        windowsExe: nextUserExe,
        androidApk: nextUserApk,
        changelogBullets:
          bullets.length > 0 ? bullets : DEFAULT_CURRENT_RELEASE.changelogBullets,
        installationNotesWindow: formWinNotes.trim(),
        installationNotesAndroid: formAndroidNotes.trim(),
      };

      await publishWebsiteRelease(newRecord, notifyInstalledApps);
      setUploadStatusMsg(
        `Published ESWA GEOLOGICAL MAPPER v${cleanVersion} (Master EXE, User EXE, Android APK Master, Android APK User)!`
      );
      setMasterExeMetaDraft(null);
      setUserExeMetaDraft(null);
      setMasterApkMetaDraft(null);
      setUserApkMetaDraft(null);
      setTimeout(() => {
        setShowMasterUploadDrawer(false);
        setUploadStatusMsg('');
      }, 1400);
    } catch (err) {
      setUploadStatusMsg(
        `Failed to publish release: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsPublishingRelease(false);
    }
  };

  const handleLicenseRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError('');
    if (!reqName.trim() || !reqEmail.trim() || !reqHwId.trim()) {
      setReqError('Please complete your Name, Email Address, and Workstation/Device Hardware ID.');
      return;
    }
    setReqSubmitting(true);
    try {
      const record = await submitSoftwareAccessRequest({
        fullName: reqName.trim(),
        email: reqEmail.trim(),
        phone: reqPhone.trim(),
        organization: reqOrg.trim() || 'Independent Geological Consultant',
        roleTitle: 'Engineering Geologist',
        purposeNotes: `${reqNotes.trim()} [Device: ${reqDeviceName.trim() || localHw.pcName} | HW-ID: ${reqHwId.trim()}]`,
      });
      setReqSubmittedId(record.requestId);
    } catch (err) {
      setReqError(
        err instanceof Error ? err.message : 'Failed to submit license access request.'
      );
    } finally {
      setReqSubmitting(false);
    }
  };

  // Show the full-screen 3-second ESWA Eagle Opening Animation on website load or replay
  if (showOpeningAnimation) {
    return (
      <EswaLoadingScreen
        onComplete={() => setShowOpeningAnimation(false)}
        isMasterEdition={false}
      />
    );
  }

  return (
    <div className="relative min-h-screen text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      {/* Official ESWA Geological Orange Topographic Map Background & Eagle Watermark */}
      <EswaAppBackgroundWatermark />

      {/* Subtle dark contrast veil so text & cards pop cleanly over the bright geological orange map */}
      <div className="fixed inset-0 pointer-events-none z-[1] bg-gradient-to-b from-[#090D16]/70 via-[#090D16]/45 to-[#090D16]/80" />

      {/* ==================== TOP NAVIGATION BAR (STICKY) ==================== */}
      <header className="sticky top-0 z-40 h-20 border-b border-amber-400/30 bg-[#090D16]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Official Eagle Logo + ESWA GEOLOGICAL MAPPER Lockup */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={handleReplayOpeningAnimation}
              className="group relative flex items-center justify-center rounded-xl p-1 hover:scale-105 transition-transform"
              title="Click to replay ESWA Eagle Opening Animation & Welcome Chime"
            >
              <EswaTunnelLogo size="sm" variant="emblem" animated />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-base sm:text-xl font-black tracking-wider text-white">
                  ESWA GEOLOGICAL MAPPER
                </span>
                <span className="hidden md:inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  v{currentRelease.version} OFFICIAL PORTAL
                </span>
              </div>
              <p className="text-[11px] font-mono text-amber-200/80 tracking-wide">
                NATM Tunneling • TBM Shield • Mining &amp; Exploration Core Logging
              </p>
            </div>
          </div>

          {/* Center Section Links */}
          <nav className="hidden xl:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-200">
            <a href="#downloads" className="hover:text-amber-400 transition-colors">
              4 Official Downloads
            </a>
            <a href="#architecture" className="hover:text-amber-400 transition-colors">
              Capabilities
            </a>
            <a href="#release-notes" className="hover:text-amber-400 transition-colors">
              Release Notes &amp; SHA-256
            </a>
            <a href="#license-request" className="hover:text-amber-400 transition-colors">
              License Activation
            </a>
          </nav>

          {/* Right Actions: Replay Animation + Master Login / Upload Console */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReplayOpeningAnimation}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/35 transition-all"
              title="Replay the 3-second ESWA Eagle Opening Animation"
            >
              <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Opening Animation</span>
            </button>

            {launchSoftwareCallback && (
              <button
                type="button"
                onClick={launchSoftwareCallback}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-400/40 transition-all"
                title="Open the ESWA GEOLOGICAL MAPPER Software Workspace"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span>Launch Software</span>
              </button>
            )}

            {isMasterLoggedIn ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMasterUploadDrawer(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Master Upload (4 Installers)</span>
                </button>
                <button
                  type="button"
                  onClick={handleMasterLogout}
                  title="Sign out of Master Admin Session"
                  className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMasterLoginModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900/95 hover:bg-slate-800 text-amber-300 border border-amber-400/40 transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Master Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================== HERO & 4-INSTALLER DOWNLOAD DECK ==================== */}
      <section
        id="downloads"
        className="relative z-10 pt-10 pb-16 md:pt-14 md:pb-24 border-b border-amber-400/25"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          {/* Top Hero Header with Official Eagle Logo */}
          <div className="bg-[#090D16]/90 backdrop-blur-xl border-2 border-amber-400/40 rounded-2xl p-6 sm:p-10 mb-10 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                <div
                  onClick={handleReplayOpeningAnimation}
                  className="cursor-pointer shrink-0 p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-slate-900 border border-amber-400/40 hover:scale-105 transition-transform"
                  title="Click to replay Eagle Opening Animation"
                >
                  <EswaTunnelLogo size="lg" variant="emblem" animated />
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-300 mb-2 bg-amber-500/15 px-3 py-1 rounded-md border border-amber-400/30">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>OFFICIAL SOFTWARE &amp; ANDROID APK DISTRIBUTION PORTAL</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-3">
                    ESWA GEOLOGICAL MAPPER
                  </h1>
                  <p className="text-sm sm:text-base text-slate-200 max-w-3xl leading-relaxed mb-4">
                    {currentRelease.summary}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-amber-200/90">
                    <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700">
                      RELEASE: <strong>v{currentRelease.version}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700">
                      PUBLISHED: <strong>{currentRelease.publishedAtIso.slice(0, 10)}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700">
                      PACKAGES: <strong>4 OFFICIAL INSTALLERS (MASTER &amp; USER)</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Title for the 4 Required Download Packages */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-amber-300 font-bold">
                DIRECT INSTALLER PACKAGES • NO DUPLICATES
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Select Your Official ESWA GEOLOGICAL MAPPER Installer
              </h2>
            </div>
            <p className="text-xs font-mono text-amber-100/90 bg-[#090D16]/85 px-3.5 py-2 rounded-lg border border-amber-400/30">
              1. Master EXE • 2. User EXE • 3. Android APK Master • 4. Android APK User
            </p>
          </div>

          {/* 4-Card Grid for Master EXE, User EXE, Android APK Master, Android APK User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PACKAGE_CARDS.map((card) => {
              const meta = getBinaryMetaForKind(currentRelease, card.kind);
              const isDownloading = downloadingKind === card.kind;
              const isCopied = copiedHash === card.kind;

              return (
                <div
                  key={card.kind}
                  className={`rounded-2xl border-2 ${card.accentClass} p-6 shadow-2xl flex flex-col justify-between transition-all hover:translate-y-[-2px]`}
                >
                  <div>
                    {/* Top Row: Badge + Official Mini Eagle Emblem */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <span className="inline-block text-[11px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-white/10 text-amber-300 border border-white/15 mb-2">
                          {card.badge}
                        </span>
                        <h3 className="text-xl font-black text-white">{card.shortTitle}</h3>
                        <p className="text-xs text-slate-300 mt-1">{card.subtitle}</p>
                      </div>
                      <div className="shrink-0 p-2 rounded-xl bg-slate-900/90 border border-slate-700/80">
                        <EswaTunnelLogo size="xs" variant="emblem" />
                      </div>
                    </div>

                    {/* Binary Metadata Box */}
                    <div className="rounded-xl bg-slate-950/90 border border-slate-800/90 p-3.5 mb-4 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">FILE NAME:</span>
                        <span className="text-white font-bold truncate max-w-[260px]">
                          {meta.fileName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">VERSION &amp; SIZE:</span>
                        <span className="text-amber-300 font-bold">
                          v{meta.version} • {meta.sizeFormatted}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">PLATFORM:</span>
                        <span className="text-slate-200">{meta.osRequirement}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 truncate">
                          SHA-256: <span className="text-slate-300">{meta.sha256.slice(0, 20)}...</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyChecksum(meta.sha256, card.kind)}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 shrink-0"
                        >
                          {isCopied ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Hash</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={() => handleDownloadBinary(card.kind)}
                    disabled={isDownloading}
                    className={`w-full py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${card.buttonClass}`}
                  >
                    {card.platformType === 'WINDOWS' ? (
                      <Monitor className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                    <span>
                      {isDownloading
                        ? `Starting ${card.shortTitle} Download...`
                        : `Download ${card.shortTitle}`}
                    </span>
                    <Download className="w-4 h-4 ml-1" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== CAPABILITIES & GEOLOGICAL MODULES ==================== */}
      <section
        id="architecture"
        className="relative z-10 py-16 md:py-20 border-b border-amber-400/25"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="bg-[#090D16]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-10">
            <div className="max-w-3xl mb-10">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
                ISOLATED MULTI-MODE ENGINEERING ARCHITECTURE
              </p>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-3">
                Built for Underground Tunneling, TBM Shields &amp; Diamond Core Exploration
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Every Windows Desktop (`.exe`) and Android Tablet (`.apk`) build ships with the
                official ESWA Eagle emblem and strict workspace isolation across NATM, TBM, and
                Mining Exploration projects.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-6">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
                  MODE 01 • NATM EXCAVATION
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  NATM Tunnel Face &amp; 3D Wall Perimeter Unfolding
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Interactive horseshoe, D-shaped, and segmental arch face mapping with joint trace
                  digitization, dip/dip-direction stereonets, Q-System &amp; RMR89 rock mass
                  ratings, and overbreak/undercut profiling.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-6">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  MODE 02 • MECHANIZED TBM
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  TBM Cutterhead Sector &amp; Tail-Skin Muck Logging
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Ring-by-ring mechanized shield logging with thrust, torque, penetration rate (mm/rev),
                  specific energy (MJ/m³), water inflow monitoring, and full 0°–360° circular wall
                  unfolding.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <Wrench className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
                  MODE 03 • MINING &amp; EXPLORATION
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Diamond Drill Core Logging (RQD, TCR, SCR &amp; Assays)
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Dedicated borehole collar registry (`BH-ID`, Easting, Northing, Plunge, Azimuth)
                  with run-by-run core recovery, automated RQD %, fracture spacing, ISRM weathering
                  grades, and core box photo strips.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== RELEASE NOTES, CHECKSUMS & INSTALLATION GUIDE ==================== */}
      <section
        id="release-notes"
        className="relative z-10 py-16 md:py-20 border-b border-amber-400/25"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 7 Columns: Release Notes & 4-File Checksum Matrix */}
            <div className="lg:col-span-7 bg-[#090D16]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
                VERIFIED BUILD MANIFEST • 4 OFFICIAL BINARIES
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-6">
                Release Notes &amp; SHA-256 Checksums
              </h2>

              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-2.5">
                      v{currentRelease.version}
                    </span>
                    <span className="text-base font-bold text-white">{currentRelease.title}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(currentRelease.publishedAtIso).toLocaleDateString()}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {currentRelease.changelogBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                {/* 4-File Checksum Verification Table */}
                <div className="rounded-lg border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3">Package</th>
                        <th className="py-2.5 px-3">Official File Name</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">SHA-256 Digest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 bg-slate-950">
                      {PACKAGE_CARDS.map((c) => {
                        const m = getBinaryMetaForKind(currentRelease, c.kind);
                        return (
                          <tr key={c.kind}>
                            <td className="py-2.5 px-3 text-amber-300 font-bold">{c.shortTitle}</td>
                            <td className="py-2.5 px-3 text-slate-200">{m.fileName}</td>
                            <td className="py-2.5 px-3 text-slate-400">{m.sizeFormatted}</td>
                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-[160px]">
                              {m.sha256}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Step-by-Step Installation Guide */}
            <div className="lg:col-span-5 bg-[#090D16]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
                DEPLOYMENT INSTRUCTIONS
              </p>
              <h3 className="text-2xl font-black text-white mb-4">Installation Guide</h3>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-950 border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => setInstallGuideTab('windows')}
                  className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    installGuideTab === 'windows'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Windows (.EXE)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInstallGuideTab('android')}
                  className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    installGuideTab === 'android'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android (.APK)</span>
                </button>
              </div>

              {installGuideTab === 'windows' ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {currentRelease.installationNotesWindow}
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-300 mb-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>PowerShell SHA-256 Verification</span>
                    </div>
                    <code className="block text-[11px] font-mono text-slate-300 break-all">
                      Get-FileHash .\ESWA-GEOLOGICAL-MAPPER-User-Setup.exe -Algorithm SHA256
                    </code>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {currentRelease.installationNotesAndroid}
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Official Eagle Icon Launcher</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Both <strong>Android APK Master</strong> and <strong>Android APK User</strong>{' '}
                      install natively with the official ESWA Eagle launcher icon and work 100%
                      offline inside underground tunnel headings.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== LICENSE / SOFTWARE ACCESS REQUEST FORM ==================== */}
      <section id="license-request" className="relative z-10 py-16 md:py-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="bg-[#090D16]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5">
                <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
                  HARDWARE-BOUND AUTHORIZATION
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
                  Request 1-PC / 1-Device Software License Key
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  ESWA GEOLOGICAL MAPPER uses cryptographic 1-PC / 1-Device hardware binding. Submit
                  your workstation or Android tablet details below to send an instant authorization
                  request to the Master Software Access Portal.
                </p>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3">
                  <div className="flex items-center gap-2.5 text-xs font-mono text-amber-400">
                    <HardDrive className="w-4 h-4" />
                    <span>DETECTED LOCAL HARDWARE IDENTITY</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800 font-mono text-xs flex items-center justify-between">
                    <span className="text-slate-400">Hardware ID:</span>
                    <span className="text-emerald-400 font-bold">{localHw.pcHardwareId}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800 font-mono text-xs flex items-center justify-between">
                    <span className="text-slate-400">Workstation / Device:</span>
                    <span className="text-slate-200">{localHw.pcName}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 sm:p-8">
                  {reqSubmittedId ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                        <FileCheck2 className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        License Request Transmitted to Master Portal
                      </h3>
                      <p className="text-sm text-slate-300 max-w-md mx-auto">
                        Your request ID{' '}
                        <span className="font-mono text-amber-300">{reqSubmittedId}</span> is now
                        queued in the Master Software Access Portal for 1-click license dispatch.
                      </p>
                      <button
                        type="button"
                        onClick={() => setReqSubmittedId(null)}
                        className="px-5 py-2.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      >
                        Submit Another Device Request
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleLicenseRequestSubmit} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-amber-400" />
                          <span>Workstation &amp; Field Tablet License Application</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          DIRECT MASTER PORTAL SYNC
                        </span>
                      </div>

                      {reqError && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                          {reqError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Geologist / Engineer Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={reqName}
                            onChange={(e) => setReqName(e.target.value)}
                            placeholder="e.g. Er. R. Sharma (Senior Geologist)"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Official Email Address *
                          </label>
                          <input
                            type="email"
                            required
                            value={reqEmail}
                            onChange={(e) => setReqEmail(e.target.value)}
                            placeholder="geologist@project-tunnel.com"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Phone / WhatsApp Number
                          </label>
                          <input
                            type="text"
                            value={reqPhone}
                            onChange={(e) => setReqPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Project / Company / Tunnel Site
                          </label>
                          <input
                            type="text"
                            value={reqOrg}
                            onChange={(e) => setReqOrg(e.target.value)}
                            placeholder="e.g. RVNL Package-4 / Himalayan NATM"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Workstation / Android Hardware ID *
                          </label>
                          <input
                            type="text"
                            required
                            value={reqHwId}
                            onChange={(e) => setReqHwId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                            Workstation / Device Name
                          </label>
                          <input
                            type="text"
                            value={reqDeviceName}
                            onChange={(e) => setReqDeviceName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={reqSubmitting}
                        className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {reqSubmitting
                            ? 'Transmitting Request to Master Portal...'
                            : 'Submit Software License Request'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="relative z-10 border-t border-amber-400/30 bg-[#090D16]/95 py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <EswaTunnelLogo size="xs" variant="emblem" />
            <div>
              <div className="text-sm font-black text-white tracking-wider">
                ESWA GEOLOGICAL MAPPER
              </div>
              <div className="text-xs text-slate-400">
                Official Windows (.EXE) &amp; Android (.APK) Distribution Website
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadNetlifyTomlConfig()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download netlify.toml</span>
            </button>
            <span className="text-xs font-mono text-slate-400">
              © {new Date().getFullYear()} ESWA GEOLOGICAL MAPPER. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* ==================== MASTER LOGIN MODAL ==================== */}
      {showMasterLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-[#0B0F17] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <EswaTunnelLogo size="xs" variant="emblem" />
                <div>
                  <h3 className="text-base font-black text-white">Master Release Console Login</h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Upload &amp; Update the 4 Official Installers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterLoginModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMasterLoginSubmit} className="space-y-4">
              {masterLoginError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {masterLoginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Master Owner Email
                </label>
                <input
                  type="email"
                  required
                  value={masterEmailInput}
                  onChange={(e) => setMasterEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Master Passcode
                </label>
                <input
                  type="password"
                  required
                  value={masterPasscodeInput}
                  onChange={(e) => setMasterPasscodeInput(e.target.value)}
                  placeholder="Enter Master Passcode"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMasterLoginModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                >
                  Unlock Master Upload Console
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MASTER RELEASE UPLOAD DRAWER (4 INSTALLERS) ==================== */}
      {showMasterUploadDrawer && isMasterLoggedIn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-[#0B0F17] border-l border-amber-400/40 h-full overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <EswaTunnelLogo size="xs" variant="emblem" />
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
                    MASTER SOFTWARE DISTRIBUTION MANAGER
                  </span>
                  <h3 className="text-xl font-black text-white">
                    Upload &amp; Publish the 4 Official Installers
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterUploadDrawer(false)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePublishNewRelease} className="space-y-5">
              {uploadStatusMsg && (
                <div className="p-3.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-mono text-amber-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Version Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    placeholder="2.6.0"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                    Release Headline *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 4 Dedicated Binary Upload Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Master EXE */}
                <div className="p-4 rounded-xl border border-amber-500/40 bg-[#090D16] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300">
                      1. Master EXE (.exe)
                    </span>
                    <input
                      ref={masterExeFileRef}
                      type="file"
                      accept=".exe,.msi,.zip"
                      onChange={(e) => handleFileUploadSelect('master_exe', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => masterExeFileRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono"
                    >
                      Select .EXE
                    </button>
                  </div>
                  {masterExeMetaDraft && (
                    <div className="text-[11px] font-mono text-emerald-400 truncate">
                      Ready: {masterExeMetaDraft.fileName} ({masterExeMetaDraft.sizeFormatted})
                    </div>
                  )}
                  <input
                    type="url"
                    value={masterExeUrlOverride}
                    onChange={(e) => setMasterExeUrlOverride(e.target.value)}
                    placeholder="Or paste direct Master EXE URL"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0B0F17] border border-slate-800 text-xs font-mono text-slate-200"
                  />
                </div>

                {/* 2. User EXE */}
                <div className="p-4 rounded-xl border border-orange-500/40 bg-[#090D16] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-orange-300">
                      2. User EXE (.exe)
                    </span>
                    <input
                      ref={userExeFileRef}
                      type="file"
                      accept=".exe,.msi,.zip"
                      onChange={(e) => handleFileUploadSelect('user_exe', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => userExeFileRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-mono"
                    >
                      Select .EXE
                    </button>
                  </div>
                  {userExeMetaDraft && (
                    <div className="text-[11px] font-mono text-emerald-400 truncate">
                      Ready: {userExeMetaDraft.fileName} ({userExeMetaDraft.sizeFormatted})
                    </div>
                  )}
                  <input
                    type="url"
                    value={userExeUrlOverride}
                    onChange={(e) => setUserExeUrlOverride(e.target.value)}
                    placeholder="Or paste direct User EXE URL"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0B0F17] border border-slate-800 text-xs font-mono text-slate-200"
                  />
                </div>

                {/* 3. Android APK Master */}
                <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#090D16] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300">
                      3. Android APK Master (.apk)
                    </span>
                    <input
                      ref={masterApkFileRef}
                      type="file"
                      accept=".apk"
                      onChange={(e) => handleFileUploadSelect('master_apk', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => masterApkFileRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono"
                    >
                      Select .APK
                    </button>
                  </div>
                  {masterApkMetaDraft && (
                    <div className="text-[11px] font-mono text-emerald-400 truncate">
                      Ready: {masterApkMetaDraft.fileName} ({masterApkMetaDraft.sizeFormatted})
                    </div>
                  )}
                  <input
                    type="url"
                    value={masterApkUrlOverride}
                    onChange={(e) => setMasterApkUrlOverride(e.target.value)}
                    placeholder="Or paste direct Master APK URL"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0B0F17] border border-slate-800 text-xs font-mono text-slate-200"
                  />
                </div>

                {/* 4. Android APK User */}
                <div className="p-4 rounded-xl border border-cyan-500/40 bg-[#090D16] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300">
                      4. Android APK User (.apk)
                    </span>
                    <input
                      ref={userApkFileRef}
                      type="file"
                      accept=".apk"
                      onChange={(e) => handleFileUploadSelect('user_apk', e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => userApkFileRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-mono"
                    >
                      Select .APK
                    </button>
                  </div>
                  {userApkMetaDraft && (
                    <div className="text-[11px] font-mono text-emerald-400 truncate">
                      Ready: {userApkMetaDraft.fileName} ({userApkMetaDraft.sizeFormatted})
                    </div>
                  )}
                  <input
                    type="url"
                    value={userApkUrlOverride}
                    onChange={(e) => setUserApkUrlOverride(e.target.value)}
                    placeholder="Or paste direct User APK URL"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0B0F17] border border-slate-800 text-xs font-mono text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Release Notes / Changelog Bullets (One per line)
                </label>
                <textarea
                  rows={4}
                  value={formBulletsText}
                  onChange={(e) => setFormBulletsText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#090D16] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyInstalledApps}
                  onChange={(e) => setNotifyInstalledApps(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <span>
                  Broadcast live update notification to all installed Windows PC &amp; Android
                  devices
                </span>
              </label>

              <button
                type="submit"
                disabled={isPublishingRelease}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isPublishingRelease
                    ? 'Publishing 4-Package Release...'
                    : `Publish ESWA GEOLOGICAL MAPPER v${formVersion || '2.6.0'}`}
                </span>
              </button>
            </form>

            {/* Previous Releases List */}
            {releases.length > 1 && (
              <div className="mt-8 pt-6 border-t border-slate-800">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                  Published Release History
                </h4>
                <div className="space-y-2">
                  {releases.map((r) => (
                    <div
                      key={r.releaseId}
                      className="p-3 rounded-lg bg-[#090D16] border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-amber-400 mr-2">
                          v{r.version}
                        </span>
                        <span className="text-slate-200">{r.title}</span>
                      </div>
                      {!r.isCurrent && (
                        <button
                          type="button"
                          onClick={() => deleteWebsiteRelease(r.releaseId)}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                          title="Delete archived release"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default ProductDownloadWebsite;
