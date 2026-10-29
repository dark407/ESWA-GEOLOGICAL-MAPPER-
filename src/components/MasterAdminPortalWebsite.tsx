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
  clearMasterLocalVerification,
  deleteFeedbackItem,
  isMasterLocallyVerified,
  requestMasterEmailCode,
  subscribeToAllFeedback,
  TARGET_MASTER_EMAIL,
  updateFeedbackStatus,
  UserFeedbackItem,
  verifyMasterEmailCode,
} from '../engine/userFeedbackEngine';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
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
  // 1. One-Time Master Login Gate State
  const [isVerified, setIsVerified] = useState<boolean>(() => isMasterLocallyVerified());
  const [emailInput, setEmailInput] = useState<string>(TARGET_MASTER_EMAIL);
  const [codeInput, setCodeInput] = useState<string>('');
  const [codeRequested, setCodeRequested] = useState<boolean>(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string>('');
  const [isAuthBusy, setIsAuthBusy] = useState<boolean>(false);

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

  // Request 6-digit code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim().toLowerCase() !== TARGET_MASTER_EMAIL.toLowerCase()) {
      setAuthStatusMessage(`Access restricted to master administrator (${TARGET_MASTER_EMAIL}).`);
      return;
    }

    setIsAuthBusy(true);
    setAuthStatusMessage('Sending 6-digit verification code to your email...');
    const res = await requestMasterEmailCode();
    setIsAuthBusy(false);

    setCodeRequested(true);
    setAuthStatusMessage(res.message);
  };

  // Verify entered code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim().length !== 6) {
      setAuthStatusMessage('Please enter the complete 6-digit code.');
      return;
    }

    setIsAuthBusy(true);
    const valid = await verifyMasterEmailCode(codeInput.trim());
    setIsAuthBusy(false);

    if (valid) {
      setIsVerified(true);
      setAuthStatusMessage('');
    } else {
      setAuthStatusMessage('Invalid or expired code. Please check your email or request a new one.');
    }
  };

  // Sign out master (clears persistent token)
  const handleMasterSignOut = () => {
    clearMasterLocalVerification();
    setIsVerified(false);
    setCodeRequested(false);
    setCodeInput('');
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
  const handleRevokeUser = async (lic: SoftwareLicenseRecord) => {
    setActionBusyId(lic.userId);
    try {
      await updateSoftwareLicenseAdmin(lic.userId, {
        status: 'REVOKED',
      });
    } finally {
      setActionBusyId(null);
    }
  };

  // User Actions: Delete User / License
  const handleDeleteUser = async (id: string, isReq: boolean) => {
    if (!confirm('Are you sure you want to remove this user authorization record?')) return;
    setActionBusyId(id);
    try {
      if (isReq) {
        await rejectAccessRequestAdmin(id);
      } else {
        await deleteSoftwareLicenseAdmin(id);
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    type UnifiedUser = {
      id: string;
      isRequest: boolean;
      name: string;
      email: string;
      organization: string;
      hardwareId: string;
      status: 'pending' | 'approved' | 'revoked';
      date: string;
      rawReq?: AccessRequestRecord;
      rawLic?: SoftwareLicenseRecord;
    };

    const list: UnifiedUser[] = [];

    // Pending requests
    requests.forEach((r) => {
      list.push({
        id: r.requestId,
        isRequest: true,
        name: r.fullName || 'Unnamed User',
        email: r.email || '',
        organization: r.organization || 'Mine Site',
        hardwareId: r.pcHardwareId || 'N/A',
        status: r.status === 'APPROVED' ? 'approved' : r.status === 'REJECTED' ? 'revoked' : 'pending',
        date: r.createdAtIso,
        rawReq: r,
      });
    });

    // Approved or Revoked licenses
    licenses.forEach((l) => {
      // Avoid duplicate if request ID matches or hardware matches
      if (!list.some((item) => (l.boundPcHardwareId && item.hardwareId === l.boundPcHardwareId) || item.id === l.userId)) {
        list.push({
          id: l.userId,
          isRequest: false,
          name: l.fullName || 'Licensed User',
          email: l.email || '',
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
  // VIEW: MASTER LOGIN GATE (Simple one-time 6-digit code)
  // =========================================================================
  if (!isVerified) {
    return (
      <div className="min-h-dvh h-dvh w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              ESWA Software Access Control
            </h1>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              One-time Master Owner verification for installation on this machine.
            </p>
          </div>

          {!codeRequested ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-300">Master Email Address</span>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </label>

              {authStatusMessage && (
                <p className="text-xs font-mono text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/60 leading-relaxed">
                  {authStatusMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isAuthBusy}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAuthBusy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Send 6-Digit Email Code</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white">Verification Code Sent</p>
                <p className="text-slate-400">
                  A 6-digit verification code has been dispatched to{' '}
                  <span className="text-amber-400 font-mono font-bold">{emailInput}</span>.
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-300">Enter 6-Digit Code</span>
                <input
                  type="text"
                  maxLength={6}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                  required
                  className="w-full py-3 text-center tracking-[0.5em] font-mono text-xl font-black rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
                />
              </label>

              {authStatusMessage && (
                <p className="text-xs font-mono text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/60 leading-relaxed">
                  {authStatusMessage}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCodeRequested(false);
                    setAuthStatusMessage('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isAuthBusy || codeInput.length !== 6}
                  className="flex-[2] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isAuthBusy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Enter</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

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

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs border border-amber-500/30">
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

        {/* Master Log Out Button */}
        <button
          type="button"
          onClick={handleMasterSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors cursor-pointer"
          title="Sign out master session on this device"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Lock</span>
        </button>
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
                            <span className="text-slate-500">Device ID:</span>{' '}
                            <span className="text-slate-300 font-bold">{u.hardwareId}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Organization:</span>{' '}
                            <span className="text-slate-300">{u.organization}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Date:</span>{' '}
                            <span className="text-slate-300">
                              {new Date(u.date).toLocaleDateString()}
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
                              if (u.rawReq) handleApproveUser(u.rawReq);
                              else if (u.rawLic) {
                                updateSoftwareLicenseAdmin(u.rawLic.userId, { status: 'ACTIVE' });
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
                              if (u.rawLic) handleRevokeUser(u.rawLic);
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
                          onClick={() => handleDeleteUser(u.id, u.isRequest)}
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
                            if (confirm('Delete this feedback item?')) {
                              deleteFeedbackItem(fb.id);
                            }
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
