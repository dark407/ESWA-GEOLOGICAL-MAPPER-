import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessRequestRecord,
  acknowledgeClientUpdateInstalled,
  ActivatedClientSession,
  getAccessRequestById,
  getInstalledSoftwareVersion,
  getOrGeneratePcHardwareId,
  getSoftwareLicenseById,
  MASTER_ADMIN_DEFAULT_EMAIL,
  performInAppOtaAutoUpdate,
  registerInstantUserAndLogin,
  clearTamperViolationLockout,
  isTamperViolationLockoutActive,
  saveLocalActivatedSession,
  SoftwareLicenseRecord,
  SoftwareReleaseRecord,
  subscribeAccessRequestById,
  subscribeAdminLicensingData,
  subscribeClientSoftwareUpdates,
  verifyAndActivateOnePcLogin,
} from '../engine/softwareLicensingEngine';
import {
  downloadMasterAndroidApk,
  downloadUserAndroidApk,
  downloadUserEditionDesktopExe,
  getCachedAndroidApkBlobUrl,
  getConfiguredGithubRepo,
  getGithubUserExeDownloadUrl,
  getUserAndroidAppShareUrl,
  isAndroidOrMobileDevice,
  isRunningInsideNativeAndroidApk,
  prepareAndroidApkBlobUrl,
} from '../engine/windowsDesktopEngine';
import { EswaTunnelLogo } from './EswaBrandIdentity';
import { useTheme, ThemeToggleButton } from '../context/ThemeContext';
import {
  PWAInstallBannerAndModal,
  PWAInstallButton,
} from './PWAInstallBannerAndModal';
import {
  Bell,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';

interface SoftwareAccessGateProps {
  onAuthorizedSession: (session: ActivatedClientSession) => void;
  suspendedLicense?: SoftwareLicenseRecord | null;
  isOwnerPreview?: boolean;
  onExitOwnerPreview?: () => void;
}

/**
 * Normal User Software & Android App Instant Registration & Login Gate:
 * - Freshly installed users simply enter their details (Name, Email, Phone, Organization, Role)
 *   and immediately log into the App / Software without waiting for manual Master activation.
 * - Automatically sends their profile & device info (Android App or PC Software) to the Master App & Master Software
 *   so the Master can view all users and Suspend / Reactivate any user in real time.
 * - Automatically sends a Welcome Email with ESWA Tunnel Mapper App & Software Features.
 */
export const SoftwareAccessGate: React.FC<SoftwareAccessGateProps> = ({
  onAuthorizedSession,
  suspendedLicense = null,
  isOwnerPreview = false,
  onExitOwnerPreview,
}) => {
  const { palette } = useTheme();
  const pcInfo = useMemo(() => getOrGeneratePcHardwareId(), []);
  const isMobileApp = useMemo(() => isAndroidOrMobileDevice(), []);
  const [gateMode, setGateMode] = useState<'instant_register' | 'login'>(
    'instant_register'
  );

  // Instant Registration & Login Form State (Default for Fresh Install)
  const [fullName, setFullName] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [roleTitle, setRoleTitle] = useState<string>('Tunnel Geologist / Engineer');
  const [purposeNotes, setPurposeNotes] = useState<string>('');
  const [submittingReq, setSubmittingReq] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Existing User ID / Master Admin Login Form State
  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [loginBusy, setLoginBusy] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Runtime Cryptographic Tamper Lockout State
  const [tamperLockout, setTamperLockout] = useState<boolean>(() => isTamperViolationLockoutActive());

  useEffect(() => {
    const handleTamper = () => setTamperLockout(true);
    window.addEventListener('eswa-security-tamper-detected', handleTamper);
    return () => window.removeEventListener('eswa-security-tamper-detected', handleTamper);
  }, []);

  // Legacy Request Access Status Support
  const [submittedRequest, setSubmittedRequest] = useState<AccessRequestRecord | null>(
    null
  );
  const [approvedLicenseDetails, setApprovedLicenseDetails] =
    useState<SoftwareLicenseRecord | null>(null);
  const [showApprovalNotificationModal, setShowApprovalNotificationModal] =
    useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const notifiedApprovalIdRef = useRef<string | null>(null);

  // Restore last submitted request ID if user previously submitted from this PC
  useEffect(() => {
    try {
      const lastReqId = localStorage.getItem('eswa_last_submitted_request_id');
      if (lastReqId) {
        getAccessRequestById(lastReqId)
          .then((rec) => {
            if (rec) setSubmittedRequest(rec);
          })
          .catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, []);

  // Real-time listener on submitted request ID so user gets instant notification if using legacy request
  useEffect(() => {
    if (!submittedRequest?.requestId) return;
    const unsub = subscribeAccessRequestById(
      submittedRequest.requestId,
      (updatedReq, lic) => {
        setSubmittedRequest(updatedReq);
        if (lic) {
          setApprovedLicenseDetails(lic);
        }
        if (updatedReq.status === 'APPROVED' && updatedReq.assignedUserId) {
          setUserId(updatedReq.assignedUserId);
          setLicenseKey(updatedReq.assignedLicenseKey);
          if (lic?.password) {
            setPassword(lic.password);
          }
          if (notifiedApprovalIdRef.current !== updatedReq.requestId) {
            notifiedApprovalIdRef.current = updatedReq.requestId;
            setShowApprovalNotificationModal(true);
          }
        }
      }
    );
    return () => unsub();
  }, [submittedRequest?.requestId]);

  const handleInstantRegisterAndEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !organization.trim()) {
      setRegisterError('Please enter your Full Name, Email, Phone, and Organization.');
      return;
    }
    setRegisterError(null);
    setSubmittingReq(true);
    try {
      try {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'default'
        ) {
          void Notification.requestPermission();
        }
      } catch {
        // Ignore
      }
      const result = await registerInstantUserAndLogin({
        fullName,
        email,
        phone,
        organization,
        roleTitle,
        purposeNotes,
      });
      onAuthorizedSession(result.session);
    } catch (err: unknown) {
      setRegisterError(
        err instanceof Error
          ? err.message
          : 'Could not complete registration. Please try again.'
      );
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleCheckSuspendedStatus = async () => {
    if (!suspendedLicense?.userId) return;
    setCheckingStatus(true);
    try {
      const fresh = await getSoftwareLicenseById(suspendedLicense.userId);
      if (fresh && fresh.status === 'ACTIVE') {
        const restoredSession: ActivatedClientSession = {
          userId: fresh.userId,
          fullName: fresh.fullName,
          organization: fresh.organization,
          licenseKey: fresh.licenseKey,
          pcHardwareId: pcInfo.pcHardwareId,
          activatedAtIso: new Date().toISOString(),
        };
        saveLocalActivatedSession(restoredSession);
        onAuthorizedSession(restoredSession);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      const res = await verifyAndActivateOnePcLogin({
        userId,
        password,
        licenseKey,
      });
      if (!res.ok || !res.session) {
        setLoginError(res.message);
      } else {
        onAuthorizedSession(res.session);
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login verification failed.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleOneClickUnlockApproved = async () => {
    const targetUser = submittedRequest?.assignedUserId || userId;
    const targetPass = approvedLicenseDetails?.password || password;
    const targetKey = submittedRequest?.assignedLicenseKey || licenseKey;
    if (!targetUser || !targetPass || !targetKey) {
      setShowApprovalNotificationModal(false);
      setGateMode('login');
      return;
    }
    setLoginError(null);
    setLoginBusy(true);
    try {
      const res = await verifyAndActivateOnePcLogin({
        userId: targetUser,
        password: targetPass,
        licenseKey: targetKey,
      });
      if (res.ok && res.session) {
        setShowApprovalNotificationModal(false);
        onAuthorizedSession(res.session);
      } else {
        setShowApprovalNotificationModal(false);
        setGateMode('login');
        setLoginError(res.message);
      }
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#070A0F] text-slate-100 flex flex-col justify-between p-3.5 sm:p-6 overflow-y-auto">
      {/* Owner Preview Strip (only visible when Master Owner clicks "Preview User Software") */}
      {isOwnerPreview && onExitOwnerPreview && (
        <div className="max-w-5xl w-full mx-auto mb-3 px-4 py-2 rounded-xl bg-cyan-950/90 border border-cyan-500/60 flex items-center justify-between gap-3 text-xs">
          <span className="text-cyan-200 font-medium">
            Previewing <strong>Normal User App / Software Edition</strong> (1-Step Instant Registration &amp; Login)
          </span>
          <button
            type="button"
            onClick={onExitOwnerPreview}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer shrink-0"
          >
            Back to My Master Software
          </button>
        </div>
      )}

      {/* Top Bar: Software Branding & Zero-Warning 1-Tap Install */}
      <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
        <div className="flex items-center gap-2.5">
          <EswaTunnelLogo size="sm" />
          <div>
            <div className="font-display font-bold text-sm sm:text-base tracking-wide text-white">
              ESWA TUNNEL MAPPER
            </div>
            <div className="text-[11px] text-slate-400">
              {isMobileApp
                ? 'Android Mobile App · Instant Registration & Login'
                : 'PC Workstation & Mobile App · Instant Registration & Login'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton compact />
          <PWAInstallButton compact variant="header" />
        </div>
      </header>
      <PWAInstallBannerAndModal />

      {/* Main Gate Card */}
      <main className="max-w-xl w-full mx-auto my-auto py-4 sm:py-6">
        <div className="bg-[#0F141C] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5">
          {/* Cryptographic Tamper Violation Lockout Alert */}
          {tamperLockout && (
            <div className="p-4 rounded-xl bg-red-950/90 border-2 border-red-500/90 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>TAMPER VIOLATION LOCKOUT — ENTERPRISE IP SHIELD ACTIVE</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearTamperViolationLockout();
                    setTamperLockout(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-800 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  Reset / Recheck
                </button>
              </div>
              <p className="text-xs text-red-200 leading-relaxed">
                Unauthorized token manipulation or machine hardware ID mismatch was detected on this device. Offline licensing is cryptographically locked to prevent cracking or unauthorized duplication.
              </p>
              <div className="text-[11px] text-red-300 font-mono">
                Hardware ID: <span className="text-white font-bold">{pcInfo.pcHardwareId}</span>
              </div>
            </div>
          )}

          {/* Suspended Account Alert (if Master Admin suspended this user) */}
          {suspendedLicense && (
            <div className="p-4 rounded-xl bg-rose-950/90 border-2 border-rose-500/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>ACCOUNT SUSPENDED BY MASTER ADMINISTRATOR</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckSuspendedStatus}
                  disabled={checkingStatus}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${checkingStatus ? 'animate-spin' : ''}`}
                  />
                  <span>{checkingStatus ? 'Checking...' : 'Check Status'}</span>
                </button>
              </div>
              <p className="text-xs text-rose-100 leading-relaxed">
                Hello <strong>{suspendedLicense.fullName}</strong> (
                <span className="font-mono">{suspendedLicense.userId}</span>), your access on this device has been temporarily suspended by the Master Administrator (
                <span className="font-mono text-cyan-300">
                  {MASTER_ADMIN_DEFAULT_EMAIL}
                </span>
                ). Once reactivated by the administrator, tap <strong>Check Status</strong> to enter immediately.
              </p>
            </div>
          )}

          {/* Mode Switcher Tabs: 1-Step Instant Registration & Login (Default) + Existing User ID Login */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setGateMode('instant_register')}
              className="flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              style={{
                backgroundColor: gateMode === 'instant_register' ? palette.primaryHex : 'transparent',
                color: gateMode === 'instant_register' ? palette.buttonTextColor : '#94A3B8',
                border: gateMode === 'instant_register' ? `1px solid ${palette.accentHex}` : '1px solid transparent',
              }}
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>1. Instant Register &amp; Login</span>
            </button>
            <button
              type="button"
              onClick={() => setGateMode('login')}
              className="flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              style={{
                backgroundColor: gateMode === 'login' ? palette.primaryHex : 'transparent',
                color: gateMode === 'login' ? palette.buttonTextColor : '#94A3B8',
                border: gateMode === 'login' ? `1px solid ${palette.accentHex}` : '1px solid transparent',
              }}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>2. Existing ID / Master Login</span>
            </button>
          </div>

          {gateMode === 'instant_register' ? (
            <div className="space-y-4">
              {registerError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/70 text-xs text-rose-200">
                  {registerError}
                </div>
              )}

              <form onSubmit={handleInstantRegisterAndEnter} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Full Name *</span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full px-3 py-2.5 rounded-lg border text-xs focus:outline-none"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: palette.accentHex + '60',
                        color: '#FFFFFF',
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">
                      Organization / Project *
                    </span>
                    <input
                      type="text"
                      required
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Company or Tunnel Project"
                      className="w-full px-3 py-2.5 rounded-lg border text-xs focus:outline-none"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: palette.accentHex + '60',
                        color: '#FFFFFF',
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">
                      Email Address (For Welcome &amp; Update Emails) *
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-3 py-2.5 rounded-lg border text-xs focus:outline-none"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: palette.accentHex + '60',
                        color: '#FFFFFF',
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">
                      Phone / WhatsApp Number *
                    </span>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 ..."
                      className="w-full px-3 py-2.5 rounded-lg border text-xs focus:outline-none"
                      style={{
                        backgroundColor: '#0F172A',
                        borderColor: palette.accentHex + '60',
                        color: '#FFFFFF',
                      }}
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-300">Role / Designation</span>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
                    style={{
                      backgroundColor: '#0F172A',
                      borderColor: palette.accentHex + '60',
                      color: '#FFFFFF',
                    }}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-300">
                    Project Site / Notes (Optional)
                  </span>
                  <input
                    type="text"
                    value={purposeNotes}
                    onChange={(e) => setPurposeNotes(e.target.value)}
                    placeholder="Tunnel project site or chainage..."
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
                    style={{
                      backgroundColor: '#0F172A',
                      borderColor: palette.accentHex + '60',
                      color: '#FFFFFF',
                    }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={submittingReq}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                  style={{
                    backgroundColor: palette.primaryHex,
                    color: palette.buttonTextColor,
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submittingReq
                      ? 'Logging In & Sending Welcome Email...'
                      : isMobileApp
                      ? 'Register Details & Enter Android App Now'
                      : 'Register Details & Enter Software Now'}
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/70 text-xs text-rose-200">
                  {loginError}
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  User ID (or Master Admin Email)
                </span>
                <input
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your User ID or Master Email"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-mono focus:outline-none"
                  style={{
                    backgroundColor: '#0F172A',
                    borderColor: palette.accentHex + '60',
                    color: '#FFFFFF',
                  }}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Password"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm font-mono focus:outline-none"
                  style={{
                    backgroundColor: '#0F172A',
                    borderColor: palette.accentHex + '60',
                    color: '#FFFFFF',
                  }}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  1-Device / 1-PC License Key (Optional for Master Admin)
                </span>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="ESWA-1PC-XXXX-XXXX-XXXX"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border text-sm font-mono focus:outline-none"
                  style={{
                    backgroundColor: '#0F172A',
                    borderColor: palette.accentHex + '60',
                    color: '#34D399',
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
                style={{
                  backgroundColor: palette.primaryHex,
                  color: palette.buttonTextColor,
                }}
              >
                <Lock className="w-4 h-4" />
                <span>
                  {loginBusy ? 'Verifying Login...' : 'Login & Unlock This Device'}
                </span>
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-900 pt-3">
        <span>ESWA Tunnel Mapper · Instant Registration &amp; 1-Tap Auto-Update</span>
        <span className="font-mono">Device ID: {pcInfo.pcHardwareId}</span>
      </footer>

      {/* Legacy Approval Modal if triggered */}
      {showApprovalNotificationModal &&
        submittedRequest &&
        submittedRequest.status === 'APPROVED' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="max-w-md w-full bg-slate-900 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-emerald-400 font-bold">
                      LIVE IN-APP &amp; EMAIL NOTIFICATION
                    </div>
                    <h3 className="text-base font-bold text-white">
                      Greetings! Your Software Access is Approved
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApprovalNotificationModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOneClickUnlockApproved}
                  disabled={loginBusy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loginBusy ? 'Unlocking...' : 'Unlock Software Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

interface SoftwareLiveUpdateNotifierProps {
  isMasterSoftware: boolean;
  isOwnerPreview?: boolean;
  activeSession: ActivatedClientSession | null;
  onOpenAdminPortal: () => void;
  onPreviewUserSoftware?: () => void;
  onExitOwnerPreview?: () => void;
}

/**
 * Top Workstation Status & 1-Tap In-App Auto-Updater Strip:
 * - In MASTER SOFTWARE / MASTER APP (for Owner):
 *   - Shows live count of All Registered Users (Android App + PC Software) and any Pending Requests.
 * - In USER APP / USER SOFTWARE (after 1-step registration):
 *   - Shows live update notifications. When the user touches the notification and presses
 *     "Install Update Now", it updates the app & software automatically in-app (0% -> 100%)
 *     without needing to download and install any package manually.
 */
export const SoftwareLiveUpdateNotifier: React.FC<SoftwareLiveUpdateNotifierProps> = ({
  isMasterSoftware,
  activeSession,
  onOpenAdminPortal,
}) => {
  const [availableRelease, setAvailableRelease] =
    useState<SoftwareReleaseRecord | null>(null);
  const [dismissedReleaseId, setDismissedReleaseId] = useState<string | null>(null);
  const [installedVer, setInstalledVer] = useState<string>(() =>
    getInstalledSoftwareVersion()
  );
  const [copiedUpdateLink, setCopiedUpdateLink] = useState<boolean>(false);

  // In-App Auto-Updater Progress State
  const [otaUpdating, setOtaUpdating] = useState<boolean>(false);
  const [otaProgressPct, setOtaProgressPct] = useState<number>(0);
  const [otaStatusText, setOtaStatusText] = useState<string>('');
  const [otaCompletedBanner, setOtaCompletedBanner] = useState<string | null>(null);

  // Master Software / Master App: live watch for all registered users (Android + PC) & requests
  const [pendingRequests, setPendingRequests] = useState<AccessRequestRecord[]>([]);
  const [allRegisteredLicenses, setAllRegisteredLicenses] = useState<
    SoftwareLicenseRecord[]
  >([]);
  const [apkDownloadBanner, setApkDownloadBanner] = useState<{
    status: 'downloading' | 'completed';
    fileName: string;
    sizeMb?: string;
    blobUrl?: string;
  } | null>(null);
  const [readyMasterApk, setReadyMasterApk] = useState<{
    blobUrl: string;
    sizeMb: string;
  } | null>(() => getCachedAndroidApkBlobUrl('master'));
  const [readyUserApk, setReadyUserApk] = useState<{
    blobUrl: string;
    sizeMb: string;
  } | null>(() => getCachedAndroidApkBlobUrl('user'));

  useEffect(() => {
    const onBlobReady = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        edition: 'master' | 'user';
        blobUrl: string;
        sizeMb: string;
      };
      if (!detail) return;
      if (detail.edition === 'master') {
        setReadyMasterApk({ blobUrl: detail.blobUrl, sizeMb: detail.sizeMb });
      } else if (detail.edition === 'user') {
        setReadyUserApk({ blobUrl: detail.blobUrl, sizeMb: detail.sizeMb });
      }
    };

    const onDlStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        status: 'downloading' | 'completed';
        fileName: string;
        sizeMb?: string;
        blobUrl?: string;
      };
      if (!detail) return;
      setApkDownloadBanner(detail);
      if (detail.status === 'completed') {
        window.setTimeout(() => setApkDownloadBanner(null), 12000);
      }
    };
    window.addEventListener('eswa-apk-blob-ready', onBlobReady);
    window.addEventListener('eswa-binary-download-status', onDlStatus);
    return () => {
      window.removeEventListener('eswa-apk-blob-ready', onBlobReady);
      window.removeEventListener('eswa-binary-download-status', onDlStatus);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeClientSoftwareUpdates((rel) => {
      setAvailableRelease(rel);
    });
    return () => unsub();
  }, [installedVer]);

  // Also automatically check GitHub Releases ("latest") if a GitHub repository is configured
  useEffect(() => {
    if (isMasterSoftware) return;
    let cancelled = false;
    const checkGithubLatestRelease = async () => {
      const repo = getConfiguredGithubRepo();
      if (!repo) return;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/releases/tags/latest`,
          { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          id?: number;
          published_at?: string;
          body?: string;
          assets?: Array<{ name?: string; browser_download_url?: string }>;
        };
        if (!data || !data.published_at || cancelled) return;
        const userAsset = (data.assets || []).find((a) =>
          (a.name || '').toLowerCase().includes('user')
        );
        const userDownloadUrl =
          userAsset?.browser_download_url || getGithubUserExeDownloadUrl(repo);
        const releaseStamp = `gh-${String(data.id || data.published_at).slice(0, 16)}`;
        const currentInstalled = getInstalledSoftwareVersion();
        if (currentInstalled === releaseStamp) return;

        setAvailableRelease((prev) => {
          if (prev) return prev;
          return {
            releaseId: `github_auto_${releaseStamp}`,
            portalScope: 'ESWA_GLOBAL',
            version: releaseStamp,
            title: 'ESWA TUNNEL MAPPER — New Live Update Available',
            releaseNotes:
              data.body ||
              'A new update is ready! Touch "Install Update Now" below to automatically update your app and software in-place without downloading any installer package.',
            downloadUrl: userDownloadUrl,
            targetScope: 'ALL_PCS',
            targetIdentifierCsv: 'ALL',
            isMandatory: false,
            status: 'PUBLISHED',
            publishedAtIso: data.published_at || new Date().toISOString(),
            adminAuthSig: 'GITHUB_AUTO',
          };
        });
      } catch {
        // Ignore network errors
      }
    };

    checkGithubLatestRelease();
    const timer = window.setInterval(checkGithubLatestRelease, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isMasterSoftware, installedVer]);

  useEffect(() => {
    if (!isMasterSoftware) return;
    const unsub = subscribeAdminLicensingData({
      onRequests: (all) => {
        setPendingRequests(all.filter((r) => r.status === 'PENDING'));
      },
      onLicenses: (allLics) => {
        setAllRegisteredLicenses(allLics);
      },
      onReleases: () => {},
      onMasterPcs: () => {},
    });
    return () => unsub();
  }, [isMasterSoftware]);

  const getUpdateLinkForRelease = (rel: SoftwareReleaseRecord): string => {
    if (
      !rel.downloadUrl ||
      rel.downloadUrl === 'BUILTIN_WINDOWS_EXE' ||
      rel.downloadUrl === 'USER_SOFTWARE_EXE' ||
      rel.downloadUrl === 'GITHUB_USER_EXE'
    ) {
      return getGithubUserExeDownloadUrl();
    }
    return rel.downloadUrl;
  };

  /**
   * 1-Tap In-App Auto-Update (No package download or manual installation required):
   */
  const handleOneTapInAppAutoUpdate = async (rel: SoftwareReleaseRecord) => {
    if (otaUpdating) return;
    setOtaUpdating(true);
    setOtaProgressPct(5);
    setOtaStatusText(`Starting automatic in-app update to v${rel.version}...`);
    try {
      await performInAppOtaAutoUpdate(rel, (pct, msg) => {
        setOtaProgressPct(pct);
        setOtaStatusText(msg);
      });
      setInstalledVer(rel.version);
      setAvailableRelease(null);
      setOtaCompletedBanner(
        `App & Software automatically updated to v${rel.version}! All features are now live.`
      );
      window.setTimeout(() => setOtaCompletedBanner(null), 9000);
    } finally {
      setOtaUpdating(false);
    }
  };

  const handleDownloadAndApplyUpdate = async (rel: SoftwareReleaseRecord) => {
    const resolvedLink = getUpdateLinkForRelease(rel);
    if (
      resolvedLink.includes('github.com/') &&
      resolvedLink.toLowerCase().endsWith('.exe')
    ) {
      const link = document.createElement('a');
      link.href = resolvedLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = 'AKASH-TUNNEL-MAPPER-User-Setup.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (
      !rel.downloadUrl ||
      rel.downloadUrl === 'BUILTIN_WINDOWS_EXE' ||
      rel.downloadUrl === 'USER_SOFTWARE_EXE' ||
      rel.downloadUrl.toLowerCase().endsWith('.exe')
    ) {
      downloadUserEditionDesktopExe(`AKASH-TUNNEL-MAPPER-User-Setup-v${rel.version}.exe`);
    } else {
      const link = document.createElement('a');
      link.href = resolvedLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `AKASH-TUNNEL-MAPPER-User-Setup-v${rel.version}.exe`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    await acknowledgeClientUpdateInstalled(rel.version);
    setInstalledVer(rel.version);
    setAvailableRelease(null);
  };

  const notifiedReleaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      isMasterSoftware ||
      !availableRelease ||
      availableRelease.version === installedVer ||
      notifiedReleaseIdRef.current === availableRelease.releaseId
    ) {
      return;
    }
    notifiedReleaseIdRef.current = availableRelease.releaseId;
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const showSysNotification = () => {
          const n = new Notification(
            `ESWA Tunnel Mapper Update v${availableRelease.version} Ready`,
            {
              body: `Click to automatically update your App/Software to v${availableRelease.version} (No previous data deleted).`,
            }
          );
          n.onclick = () => {
            window.focus();
            void handleOneTapInAppAutoUpdate(availableRelease);
          };
        };
        if (Notification.permission === 'granted') {
          showSysNotification();
        } else if (Notification.permission !== 'denied') {
          void Notification.requestPermission().then((perm) => {
            if (perm === 'granted') showSysNotification();
          });
        }
      }
    } catch {
      // Ignore notification permission errors
    }
  }, [isMasterSoftware, availableRelease, installedVer]);

  const showUpdatePrompt =
    !isMasterSoftware &&
    availableRelease &&
    availableRelease.version !== installedVer &&
    (availableRelease.isMandatory ||
      dismissedReleaseId !== availableRelease.releaseId);

  return (
    <>
      {apkDownloadBanner && (
        <div
          className={`px-3.5 py-2 text-xs font-mono font-semibold flex flex-wrap items-center justify-between gap-2 shrink-0 z-50 ${
            apkDownloadBanner.status === 'downloading'
              ? 'bg-sky-600 text-white'
              : 'bg-emerald-700 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {apkDownloadBanner.status === 'downloading' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {apkDownloadBanner.status === 'downloading'
                ? `Preparing standalone ${apkDownloadBanner.fileName}...`
                : `Ready: ${apkDownloadBanner.fileName}${
                    apkDownloadBanner.sizeMb ? ` (${apkDownloadBanner.sizeMb} MB)` : ''
                  }! Check your Downloads folder or tap the button on the right ->`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {apkDownloadBanner.blobUrl && (
              <a
                href={apkDownloadBanner.blobUrl}
                download={apkDownloadBanner.fileName}
                className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm no-underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save {apkDownloadBanner.fileName} Now</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setApkDownloadBanner(null)}
              className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 text-white text-[10px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Completed In-App Auto-Update Banner */}
      {otaCompletedBanner && (
        <div className="bg-emerald-700 text-white px-4 py-2 text-xs font-mono font-bold flex items-center justify-between gap-2 shrink-0 z-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{otaCompletedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setOtaCompletedBanner(null)}
            className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 text-white text-[10px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Persistent User Notification Strip when an Update is Available: Touch & Press Update to Auto-Update with Zero Data Deletion */}
      {!isMasterSoftware &&
        availableRelease &&
        availableRelease.version !== installedVer && (
          <div className="bg-emerald-950/95 text-emerald-100 border-b border-emerald-500/80 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 z-40">
            <div
              onClick={() => handleOneTapInAppAutoUpdate(availableRelease)}
              className="flex items-center gap-2 min-w-0 cursor-pointer"
              title="Click to automatically update your app/software with zero previous data deletion"
            >
              <Bell className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
              <span className="font-semibold truncate">
                New Update <strong className="font-mono text-white">v{availableRelease.version}</strong> Available! Click here or press <strong>Update Now (Keep All Data)</strong> for automatic update with no previous data deletion.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOneTapInAppAutoUpdate(availableRelease)}
                disabled={otaUpdating}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-mono text-[11px] font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${otaUpdating ? 'animate-spin' : ''}`}
                />
                <span>
                  {otaUpdating
                    ? `Updating (${otaProgressPct}%)...`
                    : `Update Now (v${availableRelease.version} · Keep All Data)`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedReleaseId(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] font-semibold cursor-pointer"
              >
                Details
              </button>
            </div>
          </div>
        )}

      {/* Live 1-Tap In-App Auto-Update Modal for Users */}
      {showUpdatePrompt && availableRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="max-w-lg w-full bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 font-bold">
                    AUTOMATIC IN-APP UPDATE · ZERO DATA DELETION
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {availableRelease.title} (v{availableRelease.version})
                  </h3>
                </div>
              </div>

              {!availableRelease.isMandatory && !otaUpdating && (
                <button
                  type="button"
                  onClick={() => setDismissedReleaseId(availableRelease.releaseId)}
                  className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed space-y-2">
              <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>
                  Warm Greetings
                  {activeSession?.fullName ? `, ${activeSession.fullName}` : ''} — New Update Ready!
                </span>
              </div>
              <div>{availableRelease.releaseNotes}</div>
            </div>

            {/* Live In-App Auto-Update Progress Bar */}
            {otaUpdating ? (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {otaStatusText}
                  </span>
                  <span className="text-white font-bold">{otaProgressPct}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-emerald-700/60">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${otaProgressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-700/50 space-y-1.5 text-[11px]">
                <div className="text-emerald-300 font-semibold">
                  ✓ Zero Data Deletion Guaranteed: All your previous tunnel projects, 4-portion photos, joint traces, and 1-time login session remain 100% intact.
                </div>
                <div className="text-slate-300">
                  ✓ Press &ldquo;Update Now (Keep All Data)&rdquo; below to automatically update your app/software in-place.
                </div>
                <div className="text-slate-400 font-mono flex items-center justify-between pt-1">
                  <span>
                    Installed: v{installedVer} → New:{' '}
                    <strong className="text-emerald-400">
                      v{availableRelease.version}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const link = getUpdateLinkForRelease(availableRelease);
                      navigator.clipboard?.writeText(link).catch(() => {});
                      setCopiedUpdateLink(true);
                      window.setTimeout(() => setCopiedUpdateLink(false), 2500);
                    }}
                    className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedUpdateLink ? 'Copied Link' : 'Copy Direct Link'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadAndApplyUpdate(availableRelease)}
                disabled={otaUpdating}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium cursor-pointer flex items-center gap-1"
                title="Optional: Download full standalone installer file if needed"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Optional: Download Package</span>
              </button>

              <div className="flex items-center gap-2">
                {!availableRelease.isMandatory && !otaUpdating && (
                  <button
                    type="button"
                    onClick={() => setDismissedReleaseId(availableRelease.releaseId)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Later
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOneTapInAppAutoUpdate(availableRelease)}
                  disabled={otaUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-lg"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${otaUpdating ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {otaUpdating
                      ? `Updating to v${availableRelease.version} (${otaProgressPct}%)...`
                      : `Update Now (v${availableRelease.version} · Keep All Data)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

