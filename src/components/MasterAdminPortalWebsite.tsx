import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessRequestRecord,
  approveRequestAndCreateLicense,
  deleteSoftwareLicenseAdmin,
  generateOnePcLicenseKey,
  rejectAccessRequestAdmin,
  SoftwareLicenseRecord,
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
} from '../engine/windowsDesktopEngine';
import {
  ArrowLeft,
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
  // 1. Direct Master Gmail + Fixed Password Login Gate State (No OTP — Always loads when opening Software Access Control)
  const [isVerified, setIsVerified] = useState<boolean>(false);
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

  // 2. Navigation Tabs: ONLY 2 tabs (Manage Users & Read Feedback)
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');

  // 3. User Access Management State
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [licenses, setLicenses] = useState<SoftwareLicenseRecord[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userFilterStatus, setUserFilterStatus] = useState<'all' | 'pending' | 'approved' | 'revoked'>('all');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // 4. Feedback Management State
  const [feedbackItems, setFeedbackItems] = useState<UserFeedbackItem[]>([]);
  const [feedbackSearchTerm, setFeedbackSearchTerm] = useState<string>('');
  const [feedbackFilterStatus, setFeedbackFilterStatus] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Subscribe to Licensing & User Access requests
  useEffect(() => {
    if (!isVerified) return;
    const unsub = subscribeAdminLicensingData({
      onRequests: (reqList) => setRequests(reqList || []),
      onLicenses: (licList) => setLicenses(licList || []),
      onReleases: () => {},
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
        lic?.userId || req?.assignedUserId || req?.requestId.replace(/^req_/, '');
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

    // 1. Add requests and link any matching license
    requests.forEach((r) => {
      const matchedLic = licenses.find(
        (l) =>
          (r.assignedUserId && l.userId === r.assignedUserId) ||
          l.userId === r.requestId.replace(/^req_/, '') ||
          (r.pcHardwareId &&
            l.boundPcHardwareId &&
            r.pcHardwareId.toLowerCase() === l.boundPcHardwareId.toLowerCase()) ||
          (r.email && l.email && r.email.toLowerCase() === l.email.toLowerCase())
      );

      const resolvedStatus: 'pending' | 'approved' | 'revoked' = matchedLic
        ? matchedLic.status === 'ACTIVE'
          ? 'approved'
          : 'revoked'
        : r.status === 'APPROVED'
        ? 'approved'
        : r.status === 'REJECTED'
        ? 'revoked'
        : 'pending';

      list.push({
        id: matchedLic?.userId || r.requestId,
        isRequest: !matchedLic,
        name: matchedLic?.fullName || r.fullName || 'Unnamed User',
        email: matchedLic?.email || r.email || '',
        phone: matchedLic?.phone || r.phone || 'Not provided',
        position: extractPosition(matchedLic, r),
        organization: matchedLic?.organization || r.organization || 'Tunnel Project',
        hardwareId: matchedLic?.boundPcHardwareId || r.pcHardwareId || 'N/A',
        status: resolvedStatus,
        date: matchedLic?.createdAtIso || r.createdAtIso,
        rawReq: r,
        rawLic: matchedLic,
      });
    });

    // 2. Add licenses that did not have a matching request entry
    licenses.forEach((l) => {
      const alreadyIncluded = list.some(
        (item) =>
          item.rawLic?.userId === l.userId ||
          item.id === l.userId ||
          (l.boundPcHardwareId &&
            item.hardwareId.toLowerCase() === l.boundPcHardwareId.toLowerCase()) ||
          (l.email && item.email && item.email.toLowerCase() === l.email.toLowerCase())
      );
      if (!alreadyIncluded) {
        list.push({
          id: l.userId,
          isRequest: false,
          name: l.fullName || 'Licensed User',
          email: l.email || '',
          phone: l.phone || 'Not provided',
          position: extractPosition(l, undefined),
          organization: l.organization || 'Field Office',
          hardwareId: l.boundPcHardwareId || 'N/A',
          status: l.status === 'ACTIVE' ? 'approved' : 'revoked',
          date: l.createdAtIso,
          rawLic: l,
        });
      }
    });

    return list.filter((u) => {
      if (userFilterStatus !== 'all' && u.status !== userFilterStatus) return false;
      if (userSearchTerm.trim()) {
        const q = userSearchTerm.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.position.toLowerCase().includes(q) ||
          u.hardwareId.toLowerCase().includes(q) ||
          u.organization.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, licenses, userFilterStatus, userSearchTerm]);

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

        {/* 2 Primary Tabs: Users & Feedback */}
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
        </div>

        {/* Master Only APK & EXE Update Controls + Lock Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadMasterAndroidApk()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer"
            title="Download Updated Master Android App (ESWA-GEOLOGICAL-MAPPER-Master-Android.apk)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <Download className="w-3 h-3" />
            <span>Master .APK</span>
          </button>

          <button
            type="button"
            onClick={() => downloadMasterEditionDesktopExe()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer"
            title="Download Updated Master Windows Software (ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <Download className="w-3 h-3" />
            <span>Master .EXE</span>
          </button>

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
                          onClick={() => void handleDeleteUser(u)}
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
      </main>

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
