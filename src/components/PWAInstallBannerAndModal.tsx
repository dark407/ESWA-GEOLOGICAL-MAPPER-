import React, { useState } from 'react';
import {
  downloadOfflineBatchInstaller,
  downloadUserAndroidApk,
  downloadWindowsInstallerBatchScript,
  getConfiguredGithubRepo,
  getGithubUserAndroidApkDownloadUrl,
  getUserAndroidAppShareUrl,
  useOnlineStatus,
  usePWAInstall,
} from '../engine/windowsDesktopEngine';
import {
  CheckCircle2,
  Copy,
  Download,
  Monitor,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';

interface PWAInstallButtonProps {
  compact?: boolean;
  variant?: 'primary' | 'secondary' | 'header';
  alwaysShowModalTrigger?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  variant = 'primary',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [downloadingApk, setDownloadingApk] = useState<boolean>(false);
  const [oneTapInstalling, setOneTapInstalling] = useState<boolean>(false);

  // If already running inside the native Android APK, hide the "Download APK" button
  if (
    typeof window !== 'undefined' &&
    ((window as unknown as { __ESWA_NATIVE_ANDROID_APK__?: boolean })
      .__ESWA_NATIVE_ANDROID_APK__ ||
      (window as unknown as { AndroidNativeApp?: unknown }).AndroidNativeApp)
  ) {
    return null;
  }

  const apkDirectUrl = getUserAndroidAppShareUrl();
  const githubApkUrl = getGithubUserAndroidApkDownloadUrl();
  const hasGithubRepo = Boolean(getConfiguredGithubRepo());

  const handleOneTapZeroWarningInstall = async () => {
    if (isInstallable) {
      setOneTapInstalling(true);
      try {
        await install();
      } finally {
        setOneTapInstalling(false);
      }
      return;
    }
    setShowModal(true);
  };

  const handleDownloadRealApk = () => {
    setDownloadingApk(true);
    downloadUserAndroidApk('ESWA-TUNNEL-MAPPER-User-Android.apk');
    window.setTimeout(() => setDownloadingApk(false), 2500);
  };

  const handleCopyApkLink = () => {
    navigator.clipboard?.writeText(apkDirectUrl).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'ESWA Tunnel Mapper — Android & PC App',
          text: 'Install ESWA Tunnel Mapper (1-Tap Zero-Warning Install or Standalone Android .APK):',
          url: apkDirectUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    handleCopyApkLink();
  };

  const buttonClasses =
    variant === 'header'
      ? 'inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap'
      : variant === 'secondary'
      ? 'inline-flex items-center justify-center gap-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-600/50 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap'
      : 'inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer whitespace-nowrap';

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={buttonClasses}
        title="Install ESWA Tunnel Mapper with Zero Security Warnings (1-Tap Verified Install or Standalone Android 14 .APK)"
      >
        <img
          src="/pwa-192x192.png"
          alt="ESWA App Icon"
          className="w-5 h-5 rounded-md shrink-0 object-contain"
        />
        <span>
          {compact
            ? 'Install App / .APK'
            : 'Install App (Zero Warnings) & Android .APK'}
        </span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 text-slate-100 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto touch-pan-y overscroll-contain">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-512x512.png"
                  alt="ESWA Tunnel Mapper App Icon"
                  className="w-12 h-12 rounded-xl border border-emerald-500/40 shrink-0 shadow-md object-contain"
                />
                <div className="text-left">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    ZERO-WARNING INSTALL CENTER · ANDROID &amp; WINDOWS PC
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Install ESWA Tunnel Mapper (No Warnings / No Blocks)
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* METHOD 1: 1-TAP VERIFIED HTTPS DIRECT APP INSTALL (100% ZERO WARNINGS) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-cyan-950/80 border-2 border-emerald-500/80 space-y-3 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono font-bold text-[10px] uppercase tracking-wider">
                  RECOMMENDED · 100% ZERO WARNINGS
                </span>
                <span className="text-[11px] font-mono text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SSL Verified App
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Method 1: 1-Tap Direct App Install (No Play Protect / No SmartScreen)</span>
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Installs <strong>ESWA Tunnel Mapper</strong> directly to your Android App Drawer / Home Screen or Windows Desktop / Start Menu using your browser&apos;s verified SSL engine — <strong>zero &ldquo;Unknown Sources&rdquo; blocks, zero Play Protect warnings, and zero Windows SmartScreen alerts</strong>. Works 100% offline!
                </p>
              </div>

              {isInstalled ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-900/70 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Already Installed as a Native App on This Device!</span>
                </div>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={handleOneTapZeroWarningInstall}
                  disabled={oneTapInstalling}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {oneTapInstalling
                      ? 'Opening 1-Tap Verified Installer...'
                      : '1-Tap Instant Install Now (Zero Warnings)'}
                  </span>
                </button>
              ) : isIOS ? (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-700/50 text-xs text-slate-200 space-y-1">
                  <div className="font-bold text-emerald-300">
                    To Install on iPhone / iPad with Zero Warnings:
                  </div>
                  <div>
                    1. Tap the <strong>Share</strong> button in Safari toolbar.
                    <br />
                    2. Tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-700/50 text-xs text-slate-200 space-y-1.5">
                    <div className="font-bold text-emerald-300">
                      How to Install in 1 Tap with Zero Security Warnings:
                    </div>
                    <div>
                      • <strong>On Android (Chrome / Edge):</strong> Tap the <strong>⋮ Menu</strong> (top-right of browser) → tap <strong>Add to Home screen / Install app</strong>.
                    </div>
                    <div>
                      • <strong>On Windows PC (Chrome / Edge):</strong> Click the <strong>Install icon (+)</strong> in the right side of the address bar, or click the button below to create your Desktop &amp; Start Menu shortcut:
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadWindowsInstallerBatchScript()}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Create Windows Desktop &amp; Start Menu App Shortcut (.BAT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadOfflineBatchInstaller()}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download 100% Offline Standalone PC Installer (.BAT / HTML)</span>
                  </button>
                </div>
              )}
            </div>

            {/* METHOD 2: STANDALONE ANDROID 14 (API 34) .APK PACKAGE (ZERO DANGEROUS PERMISSIONS) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono font-bold text-[10px]">
                  METHOD 2 · STANDALONE .APK FILE (ANDROID 14 API 34)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  Zero Dangerous Permissions
                </span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed">
                Want the standalone <code className="text-emerald-300">ESWA-TUNNEL-MAPPER-User-Android.apk</code> binary to share via WhatsApp, USB, or offline field tablets? We upgraded our APK to <strong>Android 14 (targetSdkVersion 34)</strong> and removed all legacy storage/camera permissions so Android 14/15 never blocks it as an &ldquo;older Android version&rdquo; app.
              </div>

              <button
                type="button"
                onClick={handleDownloadRealApk}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>
                  {downloadingApk
                    ? 'Downloading ESWA-TUNNEL-MAPPER-User-Android.apk...'
                    : 'Download Standalone Android 14 .APK (ESWA-TUNNEL-MAPPER-User-Android.apk)'}
                </span>
              </button>

              <div className="text-[11px] font-mono text-center text-slate-400">
                Package: <span className="text-emerald-300">com.eswa.tunnelmapper.user</span> · Target SDK: <span className="text-emerald-300">Android 14 (API 34)</span> · Signed v1 + v2
              </div>

              {/* QR Code & Share Links */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
                <div className="w-28 h-28 rounded-xl bg-white p-2 flex items-center justify-center shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      apkDirectUrl
                    )}`}
                    alt="Scan to download ESWA-TUNNEL-MAPPER-User-Android.apk"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="text-[11px] text-slate-300 font-semibold">
                    Scan QR with Android Phone or Share Direct Link:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyApkLink}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share App</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-400 truncate">
                    {hasGithubRepo ? githubApkUrl : apkDirectUrl}
                  </div>
                </div>
              </div>
            </div>

            {/* WHY OS WARNINGS HAPPEN & 2-TAP BYPASS GUIDE */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-600/50 space-y-2 text-left">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Why Android / Windows Shows a Prompt for Direct .APK / .EXE Files &amp; 2-Tap Solution:</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong>Want 0 Warnings?</strong> Use <strong>Method 1 (1-Tap Direct App Install)</strong> above — it uses your browser&apos;s verified HTTPS certificate so Android and Windows install it immediately with zero prompts.
                </li>
                <li>
                  <strong>If Installing the .APK File Directly on Android:</strong> Because it is downloaded directly (outside the Google Play Store), tap <strong>&ldquo;Download anyway&rdquo;</strong> in Chrome, and if Play Protect asks to scan, tap <strong>&ldquo;More details&rdquo; → &ldquo;Install anyway&rdquo;</strong>.
                </li>
                <li>
                  <strong>If Installing the .EXE File on Windows PC:</strong> If Windows SmartScreen appears, click <strong>&ldquo;More info&rdquo; → &ldquo;Run anyway&rdquo;</strong> (our installer runs in User-Space and never asks for Administrator passwords).
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-3 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Field Mode — Local Drafts &amp; Standalone App Active</span>
    </div>
  );
};

export const PWAInstallBannerAndModal: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Hide banner if already inside the native Android APK or already installed as standalone PWA
  const isInsideNativeApk =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { __ESWA_NATIVE_ANDROID_APK__?: boolean })
        .__ESWA_NATIVE_ANDROID_APK__ ||
        (window as unknown as { AndroidNativeApp?: unknown }).AndroidNativeApp
    );

  return (
    <>
      <OfflineIndicator />
      {!isInsideNativeApk && !isInstalled && !dismissed && (
        <div className="md:hidden fixed bottom-3 inset-x-3 z-50 p-3 rounded-2xl bg-slate-900/95 border border-emerald-500/70 shadow-2xl flex items-center justify-between gap-2.5 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                ESWA Tunnel Mapper — Android App
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {isInstallable
                  ? '1-Tap Instant Install (Zero Warnings) or .APK'
                  : 'Download Android 14 .APK (Zero Permissions)'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Tap Install</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadUserAndroidApk('ESWA-TUNNEL-MAPPER-User-Android.apk')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/50 text-xs font-bold cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.APK</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
