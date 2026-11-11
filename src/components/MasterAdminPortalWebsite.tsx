import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessRequestRecord,
  approveRequestAndCreateLicense,
  CURRENT_SOFTWARE_VERSION,
  deleteSoftwareLicenseAdmin,
  deleteSoftwareReleaseAdmin,
  extractGoogleDriveFileId,
  generateOnePcLicenseKey,
  getGoogleDriveSyncConfig,
  GoogleDrivePermanentSyncConfig,
  overwriteAllGoogleDriveInstallersInPlace,
  publishSoftwareUpdateRelease,
  recallAllLiveSoftwareBroadcastsAdmin,
  rejectAccessRequestAdmin,
  saveGoogleDriveSyncConfig,
  SoftwareLicenseRecord,
  SoftwareReleaseRecord,
  subscribeAdminLicensingData,
  updateSoftwareLicenseAdmin,
} from '../engine/softwareLicensingEngine';
import {
  ALLOWED_MASTER_EMAILS,
  clearMasterLocalVerification,
  deleteFeedbackItem,
  isAllowedMasterEmail,
  isMasterLocallyVerified,
  saveMasterLocallyVerified,
  subscribeToAllFeedback,
  TARGET_MASTER_EMAIL,
  updateFeedbackStatus,
  UserFeedbackItem,
  verifyMasterFixedCredentials,
} from '../engine/userFeedbackEngine';
import {
  downloadMasterAndroidApk,
  downloadMasterEditionDesktopExe,
  downloadUserAndroidApk,
  downloadUserEditionDesktopExe,
  prepareAndroidApkBlobUrl,
  prepareWindowsExeBlobUrl,
} from '../engine/windowsDesktopEngine';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout as googleLogout,
} from '../firebase';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';

interface MasterAdminPortalWebsiteProps {
  onSwitchToSoftware: () => void;
  onPreviewUserSoftware?: () => void;
  onMasterPcStatusChanged?: () => void;
}

export const MasterAdminPortalWebsite: React.FC<MasterAdminPortalWebsiteProps> = ({
  onSwitchToSoftware,
}) => {
  // 1. Direct Master Gmail + Fixed Password Login Gate State (Asked only once per calendar day)
  const [isVerified, setIsVerified] = useState<boolean>(() => isMasterLocallyVerified());
  const [emailInput, setEmailInput] = useState<string>(TARGET_MASTER_EMAIL);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string>('');
  const [isAuthBusy, setIsAuthBusy] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.removeItem('eswa_master_verified_session_v1');
    } catch {
      // Ignore
    }
  }, []);

  // 2. Navigation Tabs: Manage Users, User Feedback, and Auto-Updates & Google Drive Sync
  const [activeTab, setActiveTab] = useState<'users' | 'feedback' | 'updates_drive'>('users');

  // 3. User Access Management State
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [licenses, setLicenses] = useState<SoftwareLicenseRecord[]>([]);
  const [releases, setReleases] = useState<SoftwareReleaseRecord[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userFilterStatus, setUserFilterStatus] = useState<'all' | 'pending' | 'approved' | 'revoked'>('all');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    hardwareId: string;
    rawReq?: AccessRequestRecord;
    rawLic?: SoftwareLicenseRecord;
  } | null>(null);
  const [newUserAlert, setNewUserAlert] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
    date: string;
  } | null>(null);

  // 4. Feedback Management State
  const [feedbackItems, setFeedbackItems] = useState<UserFeedbackItem[]>([]);
  const [feedbackSearchTerm, setFeedbackSearchTerm] = useState<string>('');
  const [feedbackFilterStatus, setFeedbackFilterStatus] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // 5. 1-Click Auto-Update Broadcast & Permanent Google Drive Sync State
  const [newRelVersion, setNewRelVersion] = useState<string>(() => {
    const parts = CURRENT_SOFTWARE_VERSION.split('.').map((n) => parseInt(n, 10) || 0);
    return `${parts[0] || 2}.${parts[1] || 8}.${(parts[2] || 0) + 1}`;
  });
  const [newRelTitle, setNewRelTitle] = useState<string>(
    '3D Joint Trace Hinge Precision & Live Auto-Update Release'
  );
  const [newRelNotes, setNewRelNotes] = useState<string>(
    '• Restored 3D Joint Inspection stationary trace hinge with pre-change Dip/Strike warning modal\n• Added Main Screen Update Notification Toggle & 1-Click In-Place Auto-Updater'
  );
  const [publishingRel, setPublishingRel] = useState<boolean>(false);
  const [recallingRel, setRecallingRel] = useState<boolean>(false);
  const [driveCfg, setDriveCfg] = useState<GoogleDrivePermanentSyncConfig>(() =>
    getGoogleDriveSyncConfig()
  );
  const [driveAccessToken, setDriveAccessToken] = useState<string>('');
  const [driveConnectedEmail, setDriveConnectedEmail] = useState<string>('');
  const [driveAuthBusy, setDriveAuthBusy] = useState<boolean>(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<string>('');
  const [driveSyncBusy, setDriveSyncBusy] = useState<boolean>(false);
  const [confirmDriveOverwriteOpen, setConfirmDriveOverwriteOpen] = useState<boolean>(false);
  const [binaryDownloadInfo, setBinaryDownloadInfo] = useState<{
    status: 'downloading' | 'completed';
    fileName: string;
    sizeMb?: string;
    blobUrl?: string;
  } | null>(null);

  useEffect(() => {
    const unsubAuth = initAuth(
      (user, token) => {
        setDriveConnectedEmail(user.email || '');
        setDriveAccessToken(token);
      },
      () => {
        setDriveConnectedEmail('');
      }
    );
    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!isVerified) return;
    void prepareWindowsExeBlobUrl('user');
    void prepareWindowsExeBlobUrl('master');
    void prepareAndroidApkBlobUrl('user');
    const onBinaryStatus = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          status: 'downloading' | 'completed';
          fileName: string;
          sizeMb?: string;
          blobUrl?: string;
        }>
      ).detail;
      if (detail) {
        setBinaryDownloadInfo(detail);
      }
    };
    window.addEventListener('eswa-binary-download-status', onBinaryStatus);
    return () => {
      window.removeEventListener('eswa-binary-download-status', onBinaryStatus);
    };
  }, [isVerified]);

  // Subscribe to Licensing, User Access requests & Published Releases
  useEffect(() => {
    if (!isVerified) return;
    const unsub = subscribeAdminLicensingData({
      onRequests: (reqList) => setRequests(reqList || []),
      onLicenses: (licList) => setLicenses(licList || []),
      onReleases: (relList) => {
        const list = relList || [];
        setReleases(list);
        const latestGd = getGoogleDriveSyncConfig();
        setDriveCfg((prev) =>
          !prev.userApkFileId &&
          !prev.userExeFileId &&
          (latestGd.userApkFileId || latestGd.userExeFileId)
            ? latestGd
            : prev
        );
        // Auto-increment target version above highest published release so each broadcast is a fresh version
        const highestPublished = list.find(
          (r) =>
            r.status === 'PUBLISHED' &&
            r.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1' &&
            !r.releaseId.startsWith('rel_ci_')
        );
        if (highestPublished?.version) {
          const parts = highestPublished.version.replace(/^[vV]+/, '').split('.');
          const lastNum = Number.parseInt(parts[parts.length - 1] || '105', 10);
          if (Number.isFinite(lastNum)) {
            const nextVer = [...parts.slice(0, -1), String(lastNum + 1)].join('.');
            setNewRelVersion((prev) =>
              prev.replace(/^[vV]+/, '') === highestPublished.version.replace(/^[vV]+/, '')
                ? nextVer
                : prev
            );
          }
        }
      },
      onMasterPcs: () => {},
    });
    return () => unsub();
  }, [isVerified]);

  // Subscribe to Feedback reports
  useEffect(() => {
    if (!isVerified) return;
    const unsub = subscribeToAllFeedback((items) => {
      setFeedbackItems(items);
    });
    return () => unsub();
  }, [isVerified]);

  // Direct Master Gmail ID + Fixed Password Login (No OTP)
  const handleMasterPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (!isAllowedMasterEmail(cleanEmail)) {
      setAuthStatusMessage(
        `Invalid Gmail Username. Access restricted to Master Owner (${ALLOWED_MASTER_EMAILS[0]}).`
      );
      return;
    }

    setIsAuthBusy(true);
    const valid = verifyMasterFixedCredentials(cleanEmail, cleanPass);
    setIsAuthBusy(false);

    if (valid) {
      saveMasterLocallyVerified(cleanEmail);
      setIsVerified(true);
      setAuthStatusMessage('');
      setPasswordInput('');
    } else {
      setAuthStatusMessage('Invalid Master Password. Please enter your fixed Master password.');
    }
  };

  // Sign out master (clears persistent token)
  const handleMasterSignOut = () => {
    clearMasterLocalVerification();
    setIsVerified(false);
    setPasswordInput('');
    setAuthStatusMessage('');
  };

  // User Actions: Approve Request
  const handleApproveUser = async (req: AccessRequestRecord) => {
    setActionBusyId(req.requestId);
    try {
      const generatedUserId =
        (req.email.split('@')[0] || req.fullName.replace(/\s+/g, ''))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || `user_${Date.now()}`;
      const tempPassword = Math.random().toString(36).slice(-8);
      const licenseKey = generateOnePcLicenseKey(generatedUserId, req.pcHardwareId);

      await approveRequestAndCreateLicense({
        request: req,
        userId: generatedUserId,
        password: tempPassword,
        licenseKey,
        lockToRequestedPcImmediately: true,
      });
    } finally {
      setActionBusyId(null);
    }
  };

  // User Actions: Revoke License
  const handleRevokeUser = async (lic?: SoftwareLicenseRecord, req?: AccessRequestRecord) => {
    const busyKey = lic?.userId || req?.requestId || '';
    if (!busyKey) return;
    setActionBusyId(busyKey);
    try {
      const targetUserId =
        lic?.userId || req?.assignedUserId || (req?.requestId || '').replace(/^req_/, '');
      if (targetUserId) {
        await updateSoftwareLicenseAdmin(targetUserId, {
          status: 'REVOKED',
        });
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // User Actions: Permanently Delete User (removes both Access Request & License across Local, Server & Firestore)
  const handleDeleteUser = async (u: {
    id: string;
    rawReq?: AccessRequestRecord;
    rawLic?: SoftwareLicenseRecord;
  }) => {
    setActionBusyId(u.id);
    try {
      const idsToPurge = Array.from(
        new Set(
          [
            u.rawLic?.userId,
            u.rawReq?.assignedUserId,
            u.rawReq?.requestId,
            u.id,
          ].filter((x): x is string => Boolean(x))
        )
      );
      const targetEmail = (u.rawLic?.email || u.rawReq?.email || '').trim().toLowerCase();
      const targetHw = (
        u.rawLic?.boundPcHardwareId ||
        u.rawReq?.pcHardwareId ||
        ''
      )
        .trim()
        .toLowerCase();

      // Immediately remove from React state so the card disappears in 0ms
      setLicenses((prev) =>
        prev.filter(
          (l) =>
            !idsToPurge.includes(l.userId) &&
            (!targetEmail || (l.email || '').trim().toLowerCase() !== targetEmail) &&
            (!targetHw || (l.boundPcHardwareId || '').trim().toLowerCase() !== targetHw)
        )
      );
      setRequests((prev) =>
        prev.filter(
          (r) =>
            !idsToPurge.includes(r.requestId) &&
            (!r.assignedUserId || !idsToPurge.includes(r.assignedUserId)) &&
            (!targetEmail || (r.email || '').trim().toLowerCase() !== targetEmail) &&
            (!targetHw || (r.pcHardwareId || '').trim().toLowerCase() !== targetHw)
        )
      );

      for (const targetId of idsToPurge) {
        await deleteSoftwareLicenseAdmin(targetId);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // Filtered Users List (merges matching AccessRequestRecord + SoftwareLicenseRecord into a single card)
  const filteredUsers = useMemo(() => {
    type UnifiedUser = {
      id: string;
      isRequest: boolean;
      name: string;
      email: string;
      phone: string;
      position: string;
      organization: string;
      hardwareId: string;
      status: 'pending' | 'approved' | 'revoked';
      date: string;
      rawReq?: AccessRequestRecord;
      rawLic?: SoftwareLicenseRecord;
    };

    const list: UnifiedUser[] = [];

    const extractPosition = (lic?: SoftwareLicenseRecord, req?: AccessRequestRecord): string => {
      if (req?.roleTitle && req.roleTitle.trim()) return req.roleTitle.trim();
      if (lic?.boundPcName && lic.boundPcName.includes('·')) {
        return lic.boundPcName.split('·').slice(1).join('·').trim();
      }
      if (lic?.password && lic.password.trim()) return lic.password.trim();
      return 'Geologist';
    };

    const pickNewestDate = (...dates: Array<string | undefined>): string => {
      const valid = dates.filter((d): d is string => Boolean(d && d.trim()));
      if (valid.length === 0) return new Date().toISOString();
      return valid.reduce((newest, cur) => (cur > newest ? cur : newest), valid[0]);
    };

    // 1. Add requests and link any matching license strictly by userId or exact device hardwareId
    requests.forEach((r) => {
      if (!r) return;
      const reqIdStr = String(r.requestId || '');
      const matchedLic = licenses.find(
        (l) =>
          l &&
          ((r.assignedUserId && l.userId === r.assignedUserId) ||
            (reqIdStr && l.userId === reqIdStr.replace(/^req_/, '')) ||
            (r.pcHardwareId &&
              r.pcHardwareId !== 'N/A' &&
              l.boundPcHardwareId &&
              l.boundPcHardwareId !== 'N/A' &&
              r.pcHardwareId.toLowerCase() === l.boundPcHardwareId.toLowerCase() &&
              (!r.email || !l.email || r.email.toLowerCase() === l.email.toLowerCase())))
      );

      const resolvedStatus: 'pending' | 'approved' | 'revoked' = matchedLic
        ? (matchedLic.status === 'REVOKED' || matchedLic.status === 'SUSPENDED') &&
          matchedLic.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1'
          ? 'revoked'
          : 'approved'
        : r.status === 'REJECTED'
        ? 'revoked'
        : 'approved';

      list.push({
        id: matchedLic?.userId || reqIdStr || `req_${ list.length }`,
        isRequest: !matchedLic,
        name: matchedLic?.fullName || r.fullName || 'Unnamed User',
        email: matchedLic?.email || r.email || '',
        phone: matchedLic?.phone || r.phone || 'Not provided',
        position: extractPosition(matchedLic, r),
        organization: matchedLic?.organization || r.organization || 'Tunnel Project',
        hardwareId: matchedLic?.boundPcHardwareId || r.pcHardwareId || 'N/A',
        status: resolvedStatus,
        date: pickNewestDate(
          matchedLic?.lastSeenAtIso,
          matchedLic?.createdAtIso,
          r.createdAtIso
        ),
        rawReq: r,
        rawLic: matchedLic,
      });
    });

    // 2. Add licenses that did not have a matching request entry
    licenses.forEach((l) => {
      if (!l) return;
      const alreadyIncluded = list.some(
        (item) =>
          item.rawLic?.userId === l.userId ||
          item.id === l.userId ||
          (l.boundPcHardwareId &&
            l.boundPcHardwareId !== 'N/A' &&
            item.hardwareId &&
            item.hardwareId !== 'N/A' &&
            item.hardwareId.toLowerCase() === l.boundPcHardwareId.toLowerCase() &&
            (!l.email || !item.email || item.email.toLowerCase() === l.email.toLowerCase()))
      );
      if (!alreadyIncluded) {
        list.push({
          id: l.userId || `lic_${list.length}`,
          isRequest: false,
          name: l.fullName || 'Licensed User',
          email: l.email || '',
          phone: l.phone || 'Not provided',
          position: extractPosition(l, undefined),
          organization: l.organization || 'Field Office',
          hardwareId: l.boundPcHardwareId || 'N/A',
          status:
            (l.status === 'REVOKED' || l.status === 'SUSPENDED') &&
            l.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1'
              ? 'revoked'
              : 'approved',
          date: pickNewestDate(l.lastSeenAtIso, l.createdAtIso),
          rawLic: l,
        });
      }
    });

    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return list.filter((u) => {
      if (userFilterStatus !== 'all' && u.status !== userFilterStatus) return false;
      if (userSearchTerm.trim()) {
        const q = userSearchTerm.toLowerCase();
        return (
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.position || '').toLowerCase().includes(q) ||
          (u.hardwareId || '').toLowerCase().includes(q) ||
          (u.organization || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, licenses, userFilterStatus, userSearchTerm]);

  // Detect newly registered (or newly re-registered) users and show a live notification alert
  useEffect(() => {
    if (!isVerified || filteredUsers.length === 0) return;
    const SEEN_KEY = 'eswa_master_seen_user_registrations_v1';
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const seenMap: Record<string, string> = raw ? JSON.parse(raw) : {};
      const hadExistingMap = Boolean(raw);
      let newestUnseen: (typeof filteredUsers)[number] | null = null;
      let changed = false;

      for (const u of filteredUsers) {
        const prevSeenDate = seenMap[u.id];
        if (!prevSeenDate || (u.date && u.date > prevSeenDate)) {
          seenMap[u.id] = u.date || new Date().toISOString();
          changed = true;
          const ageMs = u.date ? Date.now() - new Date(u.date).getTime() : Infinity;
          if (hadExistingMap || ageMs <= 15 * 60 * 1000) {
            if (!newestUnseen || (u.date || '') > (newestUnseen.date || '')) {
              newestUnseen = u;
            }
          }
        }
      }

      if (changed) {
        localStorage.setItem(SEEN_KEY, JSON.stringify(seenMap));
      }
      if (newestUnseen) {
        setNewUserAlert({
          id: newestUnseen.id,
          name: newestUnseen.name,
          email: newestUnseen.email,
          phone: newestUnseen.phone,
          position: newestUnseen.position,
          date: newestUnseen.date,
        });
      }
    } catch {
      // Ignore storage errors
    }
  }, [isVerified, filteredUsers]);

  // Filtered Feedback List
  const filteredFeedback = useMemo(() => {
    return feedbackItems.filter((f) => {
      if (feedbackFilterStatus !== 'all' && f.status !== feedbackFilterStatus) return false;
      if (feedbackSearchTerm.trim()) {
        const q = feedbackSearchTerm.toLowerCase();
        return (
          f.userName.toLowerCase().includes(q) ||
          (f.userEmail && f.userEmail.toLowerCase().includes(q)) ||
          f.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [feedbackItems, feedbackFilterStatus, feedbackSearchTerm]);

  // =========================================================================
  // VIEW: MASTER LOGIN GATE (Direct Gmail ID + Fixed Password — No OTP)
  // =========================================================================
  if (!isVerified) {
    return (
      <div className="min-h-dvh h-dvh w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none overflow-y-auto">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-auto">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              ESWA Software Access Control
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Master Owner Sign-In (Direct Gmail Username &amp; Fixed Password — No OTP Required)
            </p>
          </div>

          <form onSubmit={handleMasterPasswordLogin} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-300">Username (Gmail ID)</span>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (authStatusMessage) setAuthStatusMessage('');
                  }}
                  placeholder="akashdhanusheswar@gmail.com"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-300">Master Password</span>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authStatusMessage) setAuthStatusMessage('');
                  }}
                  placeholder="Enter Master Password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {authStatusMessage && (
              <p className="text-xs font-mono text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/60 leading-relaxed">
                {authStatusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthBusy || !passwordInput.trim()}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthBusy ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Login to Master Access Control</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-800">
            <button
              type="button"
              onClick={onSwitchToSoftware}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Return to Mapping Application
            </button>
          </div>
        </div>
      </div>
    );
  }


  // =========================================================================
  // VIEW: MAIN MASTER ACCESS CONTROL & FEEDBACK PORTAL (Clean 2-Tab Layout)
  // =========================================================================
  return (
    <div className="min-h-dvh h-dvh w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Navigation Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToSoftware}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Return to Geological Mapping Workspace"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to App</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm">
              M
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                ESWA Software Access Control
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Master: {TARGET_MASTER_EMAIL}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Primary Tabs: Users, Feedback & Auto-Update / Google Drive Sync */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Users</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'users' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {filteredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'feedback'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>User Feedback</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'feedback' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {filteredFeedback.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('updates_drive')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'updates_drive'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-emerald-300 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Updates &amp; Drive Sync</span>
          </button>
        </div>

        {/* Lock Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleMasterSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Sign out master session on this device"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-4">
        {/* Live New User Registration Alert inside Master Portal */}
        {newUserAlert && (
          <div className="bg-emerald-950/90 border-2 border-emerald-500/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  New User Registered ({new Date(newUserAlert.date).toLocaleString()})
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  {newUserAlert.name} ·{' '}
                  <span className="text-amber-300">{newUserAlert.position}</span> ·{' '}
                  <span className="text-cyan-300 font-mono">{newUserAlert.phone}</span>
                  {newUserAlert.email ? ` (${newUserAlert.email})` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab !== 'users' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  View User
                </button>
              )}
              <button
                type="button"
                onClick={() => setNewUserAlert(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1: MANAGE USERS */}
        {/* =================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or device ID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Segmented Filter */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {(['all', 'pending', 'approved', 'revoked'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setUserFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                      userFilterStatus === st
                        ? 'bg-slate-800 text-amber-400 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-300">No User Records Found</h4>
                <p className="text-xs text-slate-500">
                  When new users install the app on PC or Android, their access requests will appear here for 1-click approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredUsers.map((u) => {
                  const isBusy = actionBusyId === u.id;
                  return (
                    <div
                      key={u.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-slate-700 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide">{u.name}</h4>
                            <p className="text-xs text-slate-400">{u.email || 'No email provided'}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                              u.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : u.status === 'pending'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 space-y-0.5 pt-1 border-t border-slate-800/60">
                          <div>
                            <span className="text-slate-500">Position:</span>{' '}
                            <span className="text-amber-300 font-semibold">{u.position}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Mobile Number:</span>{' '}
                            <span className="text-cyan-300 font-bold">{u.phone}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Device ID:</span>{' '}
                            <span className="text-slate-300 font-bold">{u.hardwareId}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Organization:</span>{' '}
                            <span className="text-slate-300">{u.organization}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Registered:</span>{' '}
                            <span className="text-slate-300">
                              {new Date(u.date).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        {u.status !== 'approved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              if (u.rawLic) {
                                void updateSoftwareLicenseAdmin(u.rawLic.userId, { status: 'ACTIVE' });
                              } else if (u.rawReq) {
                                void handleApproveUser(u.rawReq);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Approve Access</span>
                          </button>
                        )}

                        {u.status === 'approved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              void handleRevokeUser(u.rawLic, u.rawReq);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setPendingDeleteUser({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              phone: u.phone,
                              hardwareId: u.hardwareId,
                              rawReq: u.rawReq,
                              rawLic: u.rawLic,
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete user record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: USER FEEDBACK INBOX */}
        {/* =================================================================== */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search feedback message text or geologist..."
                  value={feedbackSearchTerm}
                  onChange={(e) => setFeedbackSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {(['all', 'new', 'reviewed', 'resolved'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFeedbackFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                      feedbackFilterStatus === st
                        ? 'bg-slate-800 text-amber-400 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Cards */}
            {filteredFeedback.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-300">No Feedback Received Yet</h4>
                <p className="text-xs text-slate-500">
                  When geologists submit suggestions, notes, or excavation photos from the field app, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{fb.userName}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {fb.userEmail || 'No Email'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Device: {fb.deviceId || 'Unknown'} · Mode: {fb.industryMode || 'NATM'} ·{' '}
                          {new Date(fb.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Status Badges & Quick Toggle */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                            fb.status === 'new'
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                              : fb.status === 'reviewed'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {fb.status}
                        </span>

                        <select
                          value={fb.status}
                          onChange={(e) =>
                            updateFeedbackStatus(
                              fb.id,
                              e.target.value as 'new' | 'reviewed' | 'resolved'
                            )
                          }
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
                        >
                          <option value="new">Mark New</option>
                          <option value="reviewed">Mark Reviewed</option>
                          <option value="resolved">Mark Resolved</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            deleteFeedbackItem(fb.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete feedback"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Message Body */}
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {fb.message}
                    </p>

                    {/* Photo Attachment (If present) */}
                    {fb.photoUrl && (
                      <div className="pt-2">
                        <div
                          onClick={() => setPreviewPhotoUrl(fb.photoUrl || null)}
                          className="inline-flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/60 cursor-pointer transition-all group"
                        >
                          <img
                            src={fb.photoUrl}
                            alt="Attachment"
                            className="w-16 h-16 object-cover rounded-lg border border-slate-800 group-hover:scale-105 transition-transform"
                          />
                          <div className="text-left pr-2">
                            <span className="text-xs font-semibold text-slate-300 group-hover:text-amber-300 flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> View Attached Photo
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Click to view full size
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: TWO-CHANNEL UPDATE CONTROL (MASTER LIVE BROADCAST vs DRIVE)  */}
        {/* =================================================================== */}
        {activeTab === 'updates_drive' && (
          <div className="space-y-5">
            {driveSyncStatus && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center justify-between gap-2">
                <span>{driveSyncStatus}</span>
                <button
                  type="button"
                  onClick={() => setDriveSyncStatus('')}
                  className="text-emerald-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* CHANNEL 1: LIVE USERS IN-APP BROADCAST (Master Application Controlled Only) */}
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-emerald-300 tracking-wide">
                    01. Channel 1 — Live Users In-App Update Broadcast (Master Controlled Only)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Existing live users on Android phones and Windows PCs receive an in-app update notification <strong>only</strong> when you click <strong>Broadcast Live Update to Existing Users</strong> below. Users can install in 1 click (keeping 100% of their data) or click <strong>Later (Use Current)</strong> to keep working on their current version.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadUserAndroidApk()}
                    disabled={
                      binaryDownloadInfo?.status === 'downloading' &&
                      binaryDownloadInfo.fileName.includes('User-Android.apk')
                    }
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60"
                    title="Download standalone User Android App (.APK)"
                  >
                    {binaryDownloadInfo?.status === 'downloading' &&
                    binaryDownloadInfo.fileName.includes('User-Android.apk') ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {binaryDownloadInfo?.status === 'downloading' &&
                      binaryDownloadInfo.fileName.includes('User-Android.apk')
                        ? 'Preparing User .APK...'
                        : 'Download User .APK'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadUserEditionDesktopExe()}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/50 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    title="Download standalone User Windows Desktop Software (.EXE)"
                  >
                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download User .EXE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMasterAndroidApk()}
                    disabled={
                      binaryDownloadInfo?.status === 'downloading' &&
                      binaryDownloadInfo.fileName.includes('Master-Android.apk')
                    }
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-60"
                    title="Download standalone Master Android App (.APK)"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Master .APK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMasterEditionDesktopExe()}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    title="Download standalone Master Windows Desktop Software (.EXE)"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" />
                    <span>Master .EXE</span>
                  </button>
                  {binaryDownloadInfo?.status === 'completed' && binaryDownloadInfo.blobUrl && (
                    <a
                      href={binaryDownloadInfo.blobUrl}
                      download={binaryDownloadInfo.fileName}
                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save {binaryDownloadInfo.fileName}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Target Live Version (e.g. 2.8.105)
                  </label>
                  <input
                    type="text"
                    value={newRelVersion}
                    onChange={(e) => setNewRelVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Update Headline Shown on Live User Screen
                  </label>
                  <input
                    type="text"
                    value={newRelTitle}
                    onChange={(e) => setNewRelTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Release Notes / What&apos;s New for Live Users
                </label>
                <textarea
                  rows={2}
                  value={newRelNotes}
                  onChange={(e) => setNewRelNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {(() => {
                const activeMasterReleases = releases.filter(
                  (r) =>
                    r.status === 'PUBLISHED' &&
                    r.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1' &&
                    !r.releaseId.startsWith('rel_ci_')
                );
                const latestActive = activeMasterReleases[0] || null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="text-xs font-mono tabular-nums text-slate-300">
                      {latestActive ? (
                        <span>
                          Active Live Broadcast:{' '}
                          <strong className="text-emerald-300">v{latestActive.version}</strong> ·{' '}
                          <span className="text-slate-400">{latestActive.title}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          No Active Live Broadcast · Live users are working uninterrupted
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeMasterReleases.length > 0 && (
                        <button
                          type="button"
                          disabled={recallingRel}
                          onClick={async () => {
                            setRecallingRel(true);
                            try {
                              const count = await recallAllLiveSoftwareBroadcastsAdmin();
                              setDriveSyncStatus(
                                `Stopped ${count} active live broadcast(s). Live users will not see any update popup until you broadcast again.`
                              );
                            } finally {
                              setRecallingRel(false);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          {recallingRel ? 'Stopping Broadcast...' : 'Stop / Recall Active Broadcast'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={publishingRel || !newRelVersion.trim()}
                        onClick={async () => {
                          setPublishingRel(true);
                          try {
                            const targetVer = newRelVersion.trim();
                            const rec = await publishSoftwareUpdateRelease({
                              version: targetVer,
                              title: newRelTitle.trim() || `ESWA Update v${targetVer}`,
                              releaseNotes: newRelNotes.trim(),
                              downloadUrl: driveCfg.userExeFileId
                                ? `https://drive.google.com/uc?export=download&id=${driveCfg.userExeFileId}`
                                : 'GITHUB_USER_EXE',
                              targetScope: 'ALL_PCS',
                              targetIdentifierCsv: 'ALL',
                              isMandatory: false,
                            });
                            const parts = targetVer.replace(/^[vV]+/, '').split('.');
                            const lastNum = Number.parseInt(parts[parts.length - 1] || '105', 10);
                            if (Number.isFinite(lastNum)) {
                              setNewRelVersion([...parts.slice(0, -1), String(lastNum + 1)].join('.'));
                            }
                            setDriveSyncStatus(
                              `✓ Channel 1 Live Broadcast v${rec.version} sent to all existing live users! Every active user on Android or PC will see the 1-click in-app update banner within 4 seconds (with Zero Data Loss and zero re-login).`
                            );
                          } finally {
                            setPublishingRel(false);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${publishingRel ? 'animate-spin' : ''}`} />
                        <span>Broadcast Live Update v{newRelVersion} to Existing Users</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {releases.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400">
                    Master Broadcast History &amp; Live User Version Status
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {releases.slice(0, 5).map((r) => {
                      const isMasterLive =
                        r.status === 'PUBLISHED' &&
                        r.adminAuthSig === 'ESWA_MASTER_ADMIN_SIG_v1' &&
                        !r.releaseId.startsWith('rel_ci_');
                      const usersOnThisVer = licenses.filter(
                        (l) => (l.installedVersion || '').replace(/^[vV]+/, '') === r.version.replace(/^[vV]+/, '')
                      ).length;
                      return (
                        <div
                          key={r.releaseId}
                          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate font-mono tabular-nums">
                            <span className="font-bold text-emerald-300">v{r.version}</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="font-sans text-slate-200 font-semibold">{r.title}</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className={isMasterLive ? 'text-emerald-400' : 'text-slate-500'}>
                              {isMasterLive ? 'Active Master Broadcast' : 'Archived'}
                            </span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="text-cyan-300">{usersOnThisVer} user(s) on version</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void deleteSoftwareReleaseAdmin(r.releaseId)}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                            title="Delete release record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* CHANNEL 2: CONTINUOUS GOOGLE DRIVE INSTALLER SYNC FOR NEW USERS (No Live Popup) */}
            <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-cyan-300 tracking-wide">
                  02. Channel 2 — Continuous Google Drive Installer Updates (For New Users Only · Zero Live Popups)
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Your permanent <strong>User Android App (.APK)</strong> and <strong>User Windows Software (.EXE)</strong> Google Drive File IDs below are automatically updated in-place on regular builds and when you click <strong>Sync Installers to Google Drive Only</strong>. New users downloading from LinkedIn or your website always get the latest installer, while existing live users are <strong>never</strong> interrupted by popups.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    User Android App (.APK) — Drive Link or File ID
                  </label>
                  <input
                    type="text"
                    value={driveCfg.userApkFileId}
                    onChange={(e) =>
                      setDriveCfg((prev) => ({
                        ...prev,
                        userApkFileId: extractGoogleDriveFileId(e.target.value),
                      }))
                    }
                    placeholder="Paste Drive link or File ID (GDRIVE_USER_APK_FILE_ID)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                  {driveCfg.userApkFileId && (
                    <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
                      Permanent Link: https://drive.google.com/file/d/{driveCfg.userApkFileId}/view?usp=sharing
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    User Windows Software (.EXE) — Drive Link or File ID
                  </label>
                  <input
                    type="text"
                    value={driveCfg.userExeFileId}
                    onChange={(e) =>
                      setDriveCfg((prev) => ({
                        ...prev,
                        userExeFileId: extractGoogleDriveFileId(e.target.value),
                      }))
                    }
                    placeholder="Paste Drive link or File ID (GDRIVE_USER_EXE_FILE_ID)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                  {driveCfg.userExeFileId && (
                    <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
                      Permanent Link: https://drive.google.com/file/d/{driveCfg.userExeFileId}/view?usp=sharing
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
                <div className="lg:col-span-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-[11px] font-bold text-slate-300">
                      Google Drive Authorization (1-Click Sign In or Paste Token)
                    </label>
                    {driveConnectedEmail ? (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300">
                        <span>Connected: {driveConnectedEmail}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await googleLogout();
                            setDriveConnectedEmail('');
                            setDriveAccessToken('');
                          }}
                          className="text-slate-400 hover:text-rose-300 underline cursor-pointer"
                        >
                          Sign out
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={driveAuthBusy}
                        onClick={async () => {
                          setDriveAuthBusy(true);
                          try {
                            const res = await googleSignIn();
                            if (res?.accessToken) {
                              setDriveAccessToken(res.accessToken);
                              setDriveConnectedEmail(res.user.email || 'Google Drive Connected');
                              setDriveSyncStatus(
                                `Google Drive connected (${res.user.email || 'Authorized'})! Your OAuth token is ready — click "Sync to Drive Only (New Users)" to update your Drive files in-place.`
                              );
                            } else {
                              setDriveSyncStatus(
                                'Google Sign-In popup did not return a token. You can try again or paste a token below.'
                              );
                            }
                          } finally {
                            setDriveAuthBusy(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                      >
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          className="w-4 h-4 shrink-0"
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                        </svg>
                        <span>
                          {driveAuthBusy ? 'Connecting Google Drive...' : 'Sign in with Google Drive (1-Click Token)'}
                        </span>
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={driveAccessToken}
                    onChange={(e) => setDriveAccessToken(e.target.value)}
                    placeholder="Auto-filled when you click 'Sign in with Google Drive' above (or paste OAuth token)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const saved = saveGoogleDriveSyncConfig(driveCfg);
                      setDriveCfg(saved);
                      setDriveSyncStatus(
                        'Saved Permanent User Google Drive File IDs (.APK & .EXE) to Cloud! Continuous builds will update these Drive files automatically for new users without popping up on live users.'
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    Save Drive File IDs
                  </button>
                  <button
                    type="button"
                    disabled={driveSyncBusy}
                    onClick={() => setConfirmDriveOverwriteOpen(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${driveSyncBusy ? 'animate-spin' : ''}`} />
                    <span>Sync to Drive Only (New Users)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Confirmation Modal before mutating/overwriting Google Drive installer files */}
            {confirmDriveOverwriteOpen && (
              <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
                <div className="max-w-md w-full bg-slate-900 border border-cyan-500/60 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Confirm Google Drive Installer Overwrite
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        This will update your permanent Google Drive installer file(s) in-place for new users downloading v{newRelVersion} without sending any update popup to existing live users.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDriveOverwriteOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                    <div>
                      User .APK File ID:{' '}
                      <span className="text-cyan-300">{driveCfg.userApkFileId || 'Not set'}</span>
                    </div>
                    <div>
                      User .EXE File ID:{' '}
                      <span className="text-cyan-300">{driveCfg.userExeFileId || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDriveOverwriteOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmDriveOverwriteOpen(false);
                        setDriveSyncBusy(true);
                        try {
                          const saved = saveGoogleDriveSyncConfig({
                            ...driveCfg,
                            lastSyncedVersion: newRelVersion,
                            lastSyncedAtIso: new Date().toISOString(),
                          });
                          setDriveCfg(saved);

                          let activeToken =
                            driveAccessToken.trim() || (await getAccessToken()) || '';
                          if (!activeToken && (saved.userApkFileId || saved.userExeFileId)) {
                            const signInRes = await googleSignIn();
                            if (signInRes?.accessToken) {
                              activeToken = signInRes.accessToken;
                              setDriveAccessToken(signInRes.accessToken);
                              setDriveConnectedEmail(
                                signInRes.user.email || 'Google Drive Connected'
                              );
                            }
                          }

                          if (activeToken) {
                            const res = await overwriteAllGoogleDriveInstallersInPlace({
                              config: saved,
                              accessToken: activeToken,
                              version: newRelVersion.trim(),
                            });
                            setDriveSyncStatus(
                              `${res.summary} (Updated Google Drive for new users only — no popup sent to live users).`
                            );
                          } else {
                            setDriveSyncStatus(
                              `Saved permanent Google Drive File IDs for v${newRelVersion} to Cloud (click "Sign in with Google Drive" above to overwrite the Drive binaries directly from your browser).`
                            );
                          }
                        } finally {
                          setDriveSyncBusy(false);
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer shadow-lg"
                    >
                      Confirm Drive Sync
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirm Delete User Modal (Ask OK Button before deleting user) */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/70 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Confirm User Deletion
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Please press OK to permanently delete this user
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-white font-bold text-sm">{pendingDeleteUser.name}</div>
              <div className="text-slate-400">
                Email: <span className="text-slate-200">{pendingDeleteUser.email || 'N/A'}</span>
              </div>
              <div className="text-slate-400">
                Mobile: <span className="text-cyan-300">{pendingDeleteUser.phone}</span>
              </div>
              <div className="text-slate-400">
                Device ID: <span className="text-amber-300">{pendingDeleteUser.hardwareId}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingDeleteUser;
                  setPendingDeleteUser(null);
                  void handleDeleteUser(target);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer shadow-lg"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Photo Preview Lightbox */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-slate-300 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Feedback full size"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
