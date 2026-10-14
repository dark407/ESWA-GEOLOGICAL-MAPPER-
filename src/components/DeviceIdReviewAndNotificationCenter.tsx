import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Inbox,
  KeyRound,
  Layers,
  Loader2,
  MailCheck,
  MessageSquareWarning,
  PackageCheck,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  EswaAppNotificationItem,
  EswaDeviceTransferRecord,
  EswaFaceMasterCompletionArchive,
  GoogleUserAccountInfo,
  buildAndStoreFaceMasterArchive,
  downloadStoredFaceMasterArchive,
  extractWordDocFromMasterArchive,
  getLocalUserDeviceId,
  getStoredFaceMasterArchive,
  importTransferPackageToMyWorkspace,
  lookupDeviceDirectoryEntry,
  markNotificationSeen,
  registerOrUpdateUserDeviceId,
  requestBrowserNotificationPermission,
  sendFacePackageToDeviceId,
  signInWithGoogleAccount,
  subscribeToDeviceTransfersAndNotifications,
  submitReviewerDecisionOnTransfer,
} from '../engine/userCloudAndPackageEngine';
import {
  FieldExcavationRound,
  FieldProjectItem,
  FieldTunnelLocationItem,
  exportFieldMappingTwoPagePdfSheet,
  exportFieldMappingTwoPageWordSheet,
} from '../engine/fieldMappingEngine';

export interface DeviceIdHeaderWidgetProps {
  currentUser?: GoogleUserAccountInfo | null;
  onUserChanged?: (user: GoogleUserAccountInfo | null) => void;
  onWorkspaceDataImported?: () => void;
  onDataImported?: () => void;
  compact?: boolean;
}

export const DeviceIdAndNotificationHeaderWidget: React.FC<DeviceIdHeaderWidgetProps> = ({
  currentUser,
  onUserChanged,
  onWorkspaceDataImported,
  compact = false,
}) => {
  const [deviceInfo, setDeviceInfo] = useState(() =>
    getLocalUserDeviceId(currentUser?.uid, currentUser?.email)
  );
  const [copiedId, setCopiedId] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'incoming' | 'outgoing' | 'device_id'>('notifications');

  const [incomingTransfers, setIncomingTransfers] = useState<EswaDeviceTransferRecord[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<EswaDeviceTransferRecord[]>([]);
  const [notifications, setNotifications] = useState<EswaAppNotificationItem[]>([]);
  const [liveToast, setLiveToast] = useState<EswaAppNotificationItem | null>(null);
  const [inspectingTransfer, setInspectingTransfer] = useState<EswaDeviceTransferRecord | null>(null);

  const [aliasInput, setAliasInput] = useState(deviceInfo.customAlias || '');
  const [savingAlias, setSavingAlias] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported'
  );

  useEffect(() => {
    const info = getLocalUserDeviceId(currentUser?.uid, currentUser?.email);
    setDeviceInfo(info);
    setAliasInput(info.customAlias || '');
    registerOrUpdateUserDeviceId(currentUser, info.customAlias).catch(() => {});
  }, [currentUser?.uid, currentUser?.email]);

  useEffect(() => {
    const unsubscribe = subscribeToDeviceTransfersAndNotifications({
      myDeviceId: deviceInfo.deviceId,
      myCustomAlias: deviceInfo.customAlias,
      myUid: currentUser?.uid,
      onUpdate: (data) => {
        setIncomingTransfers(data.incomingTransfers);
        setOutgoingTransfers(data.outgoingTransfers);
        setNotifications(data.notifications);
        if (data.newBannerNotification) {
          setLiveToast(data.newBannerNotification);
          if (onWorkspaceDataImported) {
            onWorkspaceDataImported();
          }
        }
      },
    });
    return unsubscribe;
  }, [deviceInfo.deviceId, deviceInfo.customAlias, currentUser?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const pendingReviewCount = useMemo(
    () => incomingTransfers.filter((t) => t.status === 'PENDING').length,
    [incomingTransfers]
  );

  const handleCopyDeviceId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(deviceInfo.deviceId).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const handleSaveCustomAlias = async () => {
    setSavingAlias(true);
    setStatusMsg(null);
    try {
      const entry = await registerOrUpdateUserDeviceId(currentUser, aliasInput);
      setDeviceInfo({
        deviceId: entry.deviceId,
        customAlias: entry.customAlias,
      });
      setStatusMsg(`Saved Device ID [${entry.deviceId}]${entry.customAlias ? ` & Alias [${entry.customAlias}]` : ''}.`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to update alias.');
    } finally {
      setSavingAlias(false);
    }
  };

  const handleEnableBrowserNotifications = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifPerm(res);
    if (res === 'granted') {
      setStatusMsg('System OS / Browser notifications enabled.');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* 6-Character Device ID Badge */}
        <div
          onClick={() => {
            setActiveTab('device_id');
            setModalOpen(true);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setActiveTab('device_id');
              setModalOpen(true);
            }
          }}
          title="Your 6-Character ESWA Device ID for receiving & sending Face Reviews and Data Packages"
          className={`group flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-slate-900/90 hover:bg-slate-800/90 text-cyan-200 cursor-pointer transition-all select-none ${
            compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-400 font-medium hidden sm:inline">ID:</span>
          <span className="font-mono font-bold tracking-wider text-cyan-300">
            {deviceInfo.deviceId}
          </span>
          {deviceInfo.customAlias && (
            <span className="hidden md:inline text-[9px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-1 py-0.5 rounded">
              {deviceInfo.customAlias}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyDeviceId}
            title="Copy Device ID"
            className="p-0.5 rounded hover:bg-cyan-500/20 text-cyan-300 transition-colors"
          >
            {copiedId ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 opacity-75 group-hover:opacity-100" />
            )}
          </button>
        </div>

        {/* Notification Bell & Review Inbox Trigger */}
        <button
          type="button"
          onClick={() => {
            setActiveTab(unreadCount > 0 ? 'notifications' : pendingReviewCount > 0 ? 'incoming' : 'notifications');
            setModalOpen(true);
          }}
          title="Peer Review Inbox & Approval Notifications"
          className={`relative flex items-center gap-1.5 rounded-lg border transition-all ${
            unreadCount > 0 || pendingReviewCount > 0
              ? 'border-amber-500/60 bg-amber-950/50 hover:bg-amber-900/50 text-amber-200 shadow-sm shadow-amber-500/10'
              : 'border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-200'
          } ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'}`}
        >
          <Bell className={`w-3.5 h-3.5 ${unreadCount > 0 ? 'text-amber-400 animate-bounce' : 'text-cyan-400'}`} />
          <span className="font-semibold hidden md:inline">Review & Alerts</span>
          {(unreadCount > 0 || pendingReviewCount > 0) && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] leading-tight">
              {unreadCount || pendingReviewCount}
            </span>
          )}
        </button>
      </div>

      {/* Live Floating In-App Notification Banner */}
      {liveToast && (
        <div className="fixed top-14 right-4 z-[9998] max-w-md w-full bg-slate-900/95 border-2 border-cyan-500/70 rounded-xl shadow-2xl p-3.5 text-slate-100 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  liveToast.kind === 'review_approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : liveToast.kind === 'review_changes_requested'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {liveToast.kind === 'review_approved' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : liveToast.kind === 'review_changes_requested' ? (
                  <MessageSquareWarning className="w-5 h-5" />
                ) : (
                  <Inbox className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{liveToast.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {liveToast.message}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationSeen(liveToast.id);
                      setInspectingTransfer(liveToast.transfer);
                      setModalOpen(true);
                      setLiveToast(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    {liveToast.kind === 'incoming_review'
                      ? 'Inspect & Approve / Review'
                      : 'View Details & Package'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationSeen(liveToast.id);
                      setLiveToast(null);
                    }}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                markNotificationSeen(liveToast.id);
                setLiveToast(null);
              }}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Device ID, Notifications & Peer Review Center Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9995] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>ESWA Device ID & Peer Review Hub</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/40 font-mono text-xs text-cyan-300">
                      {deviceInfo.deviceId}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Receive & approve face mapping packages by 6-character Device ID with inside-app & OS notifications
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleEnableBrowserNotifications}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Enable Outside App Alerts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 pt-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'notifications'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications ({notifications.length})</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px]">
                    {unreadCount} new
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('incoming')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'incoming'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Incoming Reviews & Imports ({incomingTransfers.length})</span>
                {pendingReviewCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 font-mono text-[10px]">
                    {pendingReviewCount} pending
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('outgoing')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'outgoing'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Sent for Review ({outgoingTransfers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('device_id')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'device_id'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>My Device ID & Account</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {statusMsg && (
                <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between">
                  <span>{statusMsg}</span>
                  <button
                    type="button"
                    onClick={() => setStatusMsg(null)}
                    className="text-cyan-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TAB 1: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Real-Time Approval & Review Notifications
                    </h3>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          notifications.forEach((n) => markNotificationSeen(n.id));
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, read: true }))
                          );
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="p-8 rounded-xl border border-slate-800 bg-slate-950/50 text-center space-y-2">
                      <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                      <div className="text-sm font-semibold text-slate-300">
                        No notifications yet
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Share your Device ID{' '}
                        <span className="font-mono text-cyan-300 font-bold">
                          {deviceInfo.deviceId}
                        </span>{' '}
                        with colleagues to receive face mapping packages for review, or send your own faces for review from the final report stage.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            !notif.read
                              ? 'bg-slate-800/90 border-cyan-500/50 shadow-md'
                              : 'bg-slate-950/60 border-slate-800/90'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                notif.kind === 'review_approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : notif.kind === 'review_changes_requested'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {notif.kind === 'review_approved' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : notif.kind === 'review_changes_requested' ? (
                                <MessageSquareWarning className="w-4 h-4" />
                              ) : (
                                <ClipboardCheck className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white">
                                  {notif.title}
                                </span>
                                {!notif.read && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold">
                                    NEW
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-slate-400">
                                  {new Date(notif.createdAtIso).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationSeen(notif.id);
                                setNotifications((prev) =>
                                  prev.map((n) =>
                                    n.id === notif.id ? { ...n, read: true } : n
                                  )
                                );
                                setInspectingTransfer(notif.transfer);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {notif.kind === 'incoming_review'
                                ? 'Review & Approve'
                                : 'Inspect Package'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INCOMING REVIEWS & IMPORTS */}
              {activeTab === 'incoming' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Packages Sent to Your Device ID ({deviceInfo.deviceId})
                  </h3>
                  {incomingTransfers.length === 0 ? (
                    <div className="p-8 rounded-xl border border-slate-800 bg-slate-950/50 text-center space-y-2">
                      <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                      <div className="text-sm font-semibold text-slate-300">
                        No incoming review packages yet
                      </div>
                      <p className="text-xs text-slate-500">
                        When another geologist sends a face for review to{' '}
                        <span className="font-mono text-cyan-300 font-bold">
                          {deviceInfo.deviceId}
                        </span>
                        , it appears here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {incomingTransfers.map((trf) => (
                        <div
                          key={trf.transferId}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-cyan-300 font-bold">
                                From: {trf.senderName} ({trf.senderDeviceId})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  trf.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : trf.status === 'CHANGES_REQUESTED'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {trf.status === 'APPROVED'
                                  ? '✓ APPROVED'
                                  : trf.status === 'CHANGES_REQUESTED'
                                  ? '↺ CHANGES REQUESTED'
                                  : '⏳ PENDING REVIEW'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {trf.mappingDomain} •{' '}
                                {trf.mappingMethod === 'photo_mapping'
                                  ? 'Photogrammetry'
                                  : 'Field Mapping'}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white">
                              {trf.projectTitle} — {trf.locationTitle} ({trf.chainageLabel})
                            </div>
                            {trf.senderNotes && (
                              <p className="text-xs text-slate-300 italic">
                                Note: "{trf.senderNotes}"
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setInspectingTransfer(trf)}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Inspect & Review
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: OUTGOING SENT FOR REVIEW */}
              {activeTab === 'outgoing' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Faces Sent by You for Review / Export
                  </h3>
                  {outgoingTransfers.length === 0 ? (
                    <div className="p-8 rounded-xl border border-slate-800 bg-slate-950/50 text-center space-y-2">
                      <Send className="w-8 h-8 text-slate-600 mx-auto" />
                      <div className="text-sm font-semibold text-slate-300">
                        No outgoing review requests yet
                      </div>
                      <p className="text-xs text-slate-500">
                        Use the "Review Required" button at the end of face mapping to send a face package to a reviewer's Device ID.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {outgoingTransfers.map((trf) => (
                        <div
                          key={trf.transferId}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-cyan-300 font-bold">
                                To Reviewer ID: {trf.recipientDeviceId}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  trf.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : trf.status === 'CHANGES_REQUESTED'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {trf.status === 'APPROVED'
                                  ? '✓ APPROVED (COMPLETED)'
                                  : trf.status === 'CHANGES_REQUESTED'
                                  ? '↺ CHANGES REQUESTED'
                                  : '⏳ AWAITING REVIEW'}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white">
                              {trf.projectTitle} — {trf.locationTitle} ({trf.chainageLabel})
                            </div>
                            {trf.reviewerRemarks && (
                              <p className="text-xs text-emerald-300">
                                Reviewer ({trf.reviewerName || trf.recipientDeviceId}) Remarks: "{trf.reviewerRemarks}"
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setInspectingTransfer(trf)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Package
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MY DEVICE ID & ACCOUNT */}
              {activeTab === 'device_id' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                          Your Simple 6-Character ESWA Device ID
                        </div>
                        <div className="text-2xl font-mono font-extrabold text-white mt-1 flex items-center gap-3">
                          <span>{deviceInfo.deviceId}</span>
                          <button
                            type="button"
                            onClick={handleCopyDeviceId}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-sans font-semibold flex items-center gap-1.5"
                          >
                            {copiedId ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Device ID
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Anyone can send a Face Review Request or Export Package directly to your app by entering{' '}
                          <span className="font-mono text-cyan-300 font-bold">
                            {deviceInfo.deviceId}
                          </span>
                          {deviceInfo.customAlias ? ` or ${deviceInfo.customAlias}` : ''}.
                        </p>
                      </div>
                    </div>

                    {/* Custom Alias Editor */}
                    <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Optional Custom Alias (e.g. CHIEF-GEO or REVIEWER-01)
                        </label>
                        <input
                          type="text"
                          value={aliasInput}
                          onChange={(e) => setAliasInput(e.target.value.toUpperCase())}
                          placeholder="e.g. CHIEF-GEO"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveCustomAlias}
                        disabled={savingAlias}
                        className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        {savingAlias ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Save Alias
                      </button>
                    </div>
                  </div>

                  {/* Email Account Binding Section */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white">
                        Linked Email Account for Permanent Device ID
                      </div>
                      {currentUser ? (
                        <div className="text-xs text-emerald-300 mt-0.5">
                          Signed in as <span className="font-semibold">{currentUser.displayName}</span> ({currentUser.email}) — Your Device ID <span className="font-mono font-bold">{deviceInfo.deviceId}</span> is permanently bound to your email across devices.
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Sign in with Google Email so your 6-character Device ID stays identical on every PC, tablet, or phone you use.
                        </div>
                      )}
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await signInWithGoogleAccount();
                            if (res.user && onUserChanged) onUserChanged(res.user);
                            if (res.error) setStatusMsg(res.error);
                          } catch (err: any) {
                            setStatusMsg(err?.message || 'Sign-in cancelled or failed.');
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shrink-0"
                      >
                        Sign In with Google Email
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Inspection & Approval Modal */}
      {inspectingTransfer && (
        <ReviewerInspectionAndDecisionModal
          transfer={inspectingTransfer}
          currentUser={currentUser}
          onClose={() => setInspectingTransfer(null)}
          onDecisionSubmitted={(updated) => {
            setInspectingTransfer(updated);
            if (onWorkspaceDataImported) onWorkspaceDataImported();
          }}
          onImportedToWorkspace={() => {
            if (onWorkspaceDataImported) onWorkspaceDataImported();
          }}
        />
      )}
    </>
  );
};

export interface ReviewerInspectionAndDecisionModalProps {
  transfer: EswaDeviceTransferRecord;
  currentUser: GoogleUserAccountInfo | null;
  onClose: () => void;
  onDecisionSubmitted?: (updated: EswaDeviceTransferRecord) => void;
  onImportedToWorkspace?: () => void;
}

export const ReviewerInspectionAndDecisionModal: React.FC<ReviewerInspectionAndDecisionModalProps> = ({
  transfer,
  currentUser,
  onClose,
  onDecisionSubmitted,
  onImportedToWorkspace,
}) => {
  const parsedArchive = useMemo<EswaFaceMasterCompletionArchive | null>(() => {
    try {
      return JSON.parse(transfer.packageJson) as EswaFaceMasterCompletionArchive;
    } catch {
      return null;
    }
  }, [transfer.packageJson]);

  const [reviewerName, setReviewerName] = useState(
    transfer.reviewerName || currentUser?.displayName || 'Senior Engineering Geologist'
  );
  const [reviewerSign, setReviewerSign] = useState(
    transfer.reviewerSign || currentUser?.displayName || 'Verified & Approved'
  );
  const [reviewerRemarks, setReviewerRemarks] = useState(
    transfer.reviewerRemarks || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'summary' | 'report_preview' | 'photos'>('summary');

  const round = parsedArchive?.round;
  const project = parsedArchive?.project;
  const location = parsedArchive?.location;

  const handleDecision = async (decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    setSubmitting(true);
    setActionBanner(null);
    try {
      const updated = await submitReviewerDecisionOnTransfer({
        transfer,
        decision,
        reviewerRemarks,
        reviewerName,
        reviewerSign,
      });
      setActionBanner(
        decision === 'APPROVED'
          ? `✓ Face ${transfer.chainageLabel} Approved! Notification sent back to ${transfer.senderName} (${transfer.senderDeviceId}).`
          : `↺ Changes requested on ${transfer.chainageLabel}. Notification sent to ${transfer.senderName} (${transfer.senderDeviceId}).`
      );
      if (onDecisionSubmitted) onDecisionSubmitted(updated);
    } catch (err: any) {
      setActionBanner(err?.message || 'Failed to submit review decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportToWorkspace = () => {
    try {
      const sum = importTransferPackageToMyWorkspace(transfer);
      setActionBanner(
        `Imported into your local workspace (${sum.fieldProjectsImported} project, ${sum.fieldRoundsImported} face, ${sum.photosImportedCount} photos). You can now open it in 2D/3D Workspace.`
      );
      if (onImportedToWorkspace) onImportedToWorkspace();
    } catch (err: any) {
      setActionBanner(err?.message || 'Failed to import package.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!project || !location || !round) return;
    await exportFieldMappingTwoPagePdfSheet(
      project,
      location,
      round,
      parsedArchive?.reports?.sketchPngDataUrl || null,
      parsedArchive?.reports?.support2DPngDataUrl || null
    );
  };

  const handleDownloadWord = () => {
    if (!parsedArchive) return;
    extractWordDocFromMasterArchive(parsedArchive);
  };

  const handleDownloadMasterBundle = () => {
    const blob = new Blob([transfer.packageJson], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESWA_Review_Package_${transfer.chainageLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.eswa.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
                {transfer.transferType === 'REVIEW_REQUEST' ? 'PEER REVIEW PACKAGE' : 'EXPORTED FACE PACKAGE'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                From {transfer.senderName} ({transfer.senderDeviceId}) → {transfer.recipientDeviceId}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {transfer.projectTitle} • {transfer.locationTitle} • {transfer.chainageLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              2-Page PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              className="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Word (.doc)
            </button>
            <button
              type="button"
              onClick={handleDownloadMasterBundle}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              Master .eswa.json
            </button>
            <button
              type="button"
              onClick={handleImportToWorkspace}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Import to Workspace
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="px-5 pt-2 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('summary')}
            className={`px-3 py-2 text-xs font-bold border-b-2 ${
              activeView === 'summary'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            1. Geological & Structural Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveView('report_preview')}
            className={`px-3 py-2 text-xs font-bold border-b-2 ${
              activeView === 'report_preview'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            2. Embedded 2-Page Report Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveView('photos')}
            className={`px-3 py-2 text-xs font-bold border-b-2 ${
              activeView === 'photos'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            3. Original & Fitted Photos ({parsedArchive?.originalPhotos?.length || 0})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {actionBanner && (
            <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-semibold">
              {actionBanner}
            </div>
          )}

          {activeView === 'summary' && round && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2 columns: Face Parameters & Discontinuities */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Chainage</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {round.chainageFrom}m – {round.chainageTo}m
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Mapping Method</div>
                    <div className="text-sm font-bold text-cyan-300 mt-0.5">
                      {round.mappingMethod === 'photo_mapping'
                        ? 'Photogrammetry (3D/2D)'
                        : 'Field Mapping'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Q-Value / Rock Class</div>
                    <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                      Q = {round.qParams ? ((round.qParams.rqd / round.qParams.jn) * (round.qParams.jr / round.qParams.ja) * (round.qParams.jw / round.qParams.srs)).toFixed(2) : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Rock Type</div>
                    <div className="text-sm font-bold text-white mt-0.5 truncate">
                      {round.rockType || 'Granitic Gneiss'}
                    </div>
                  </div>
                </div>

                {/* Joint Sets Table */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs font-bold text-slate-300 mb-2">
                    Recorded Joint Sets & Structural Features ({round.jointSets?.length || 0} sets, {round.drawnFeatures?.length || 0} traced polylines)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                          <th className="py-1.5 px-2">Set</th>
                          <th className="py-1.5 px-2">Dip Dir (°)</th>
                          <th className="py-1.5 px-2">Dip (°)</th>
                          <th className="py-1.5 px-2">Spacing</th>
                          <th className="py-1.5 px-2">Persistence</th>
                          <th className="py-1.5 px-2">Roughness</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(round.jointSets || []).map((js) => (
                          <tr key={js.id} className="border-b border-slate-900 font-mono">
                            <td className="py-1.5 px-2 font-bold text-cyan-300">{js.setCode}</td>
                            <td className="py-1.5 px-2">{js.dipDirection}°</td>
                            <td className="py-1.5 px-2">{js.dipAngle}°</td>
                            <td className="py-1.5 px-2 font-sans">{js.spacing}</td>
                            <td className="py-1.5 px-2 font-sans">{js.continuity}</td>
                            <td className="py-1.5 px-2 font-sans">{js.roughness}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Geological Description */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-xs font-bold text-slate-300">
                    Geologist Field Observations & Support Notes
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {round.geologicalDescription || round.remarks || 'No additional remarks entered.'}
                  </p>
                </div>
              </div>

              {/* Right column: Reviewer Approval & Decision Box */}
              <div className="p-4 rounded-xl bg-slate-950 border-2 border-cyan-500/40 space-y-3 self-start">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Reviewer Sign-Off & Action
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      transfer.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : transfer.status === 'CHANGES_REQUESTED'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {transfer.status}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Reviewer / Client Geologist Name
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Digital Signature / Stamp Text
                  </label>
                  <input
                    type="text"
                    value={reviewerSign}
                    onChange={(e) => setReviewerSign(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Reviewer Technical Remarks / Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={reviewerRemarks}
                    onChange={(e) => setReviewerRemarks(e.target.value)}
                    placeholder="Add review remarks, support adjustments, or approval notes..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('APPROVED')}
                    className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve Face & Mark Completed (✓)
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('CHANGES_REQUESTED')}
                    className="w-full py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Request Changes / Revision
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeView === 'report_preview' && (
            <div className="rounded-xl overflow-hidden border border-slate-700 bg-white">
              {parsedArchive?.reports?.twoPageReportHtml ? (
                <iframe
                  title="Embedded 2-Page Report Preview"
                  srcDoc={parsedArchive.reports.twoPageReportHtml}
                  className="w-full h-[540px] border-0"
                />
              ) : (
                <div className="p-8 text-center text-slate-600 text-xs">
                  Report HTML preview not embedded in this package. Use the 2-Page PDF or Word buttons above to generate it.
                </div>
              )}
            </div>
          )}

          {activeView === 'photos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(parsedArchive?.originalPhotos || []).length === 0 ? (
                <div className="col-span-2 p-8 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                  No field photos attached to this face package.
                </div>
              ) : (
                (parsedArchive?.originalPhotos || []).map((ph) => (
                  <div
                    key={ph.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>{ph.label}</span>
                      <a
                        href={ph.dataUrl}
                        download={`${ph.id}.jpg`}
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Save Original Photo
                      </a>
                    </div>
                    <img
                      src={ph.dataUrl}
                      alt={ph.label}
                      className="w-full h-56 object-contain rounded-lg bg-slate-900 border border-slate-800"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface FaceCompletionAndReviewBarProps {
  project?: FieldProjectItem;
  location?: FieldTunnelLocationItem;
  round?: FieldExcavationRound;
  activeProject?: FieldProjectItem;
  activeLocation?: FieldTunnelLocationItem;
  activeRound?: FieldExcavationRound;
  mappingDomain?: any;
  sketchPngDataUrl?: string | null;
  support2DPngDataUrl?: string | null;
  onUpdateRound: (
    updaterOrPatch:
      | ((r: FieldExcavationRound) => FieldExcavationRound)
      | Partial<FieldExcavationRound>
  ) => void;
  onSaveRoundToProject?: () => void;
  onReturnToFaceList?: () => void;
}

export const FaceCompletionAndReviewBar: React.FC<FaceCompletionAndReviewBarProps> = (props) => {
  const project = props.project || props.activeProject;
  const location = props.location || props.activeLocation;
  const round = props.round || props.activeRound;
  const {
    sketchPngDataUrl,
    support2DPngDataUrl,
    onUpdateRound,
    onSaveRoundToProject,
    onReturnToFaceList,
  } = props;

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCompletedBundleModal, setShowCompletedBundleModal] = useState(false);
  const [recipientDeviceId, setRecipientDeviceId] = useState(
    round?.reviewMetadata?.reviewerDeviceId || ''
  );
  const [senderNotes, setSenderNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [latestArchive, setLatestArchive] = useState<EswaFaceMasterCompletionArchive | null>(
    () => (round?.id ? getStoredFaceMasterArchive(round.id) : null)
  );

  if (!round || !project || !location) {
    return null;
  }

  const currentStatus = round.completionStatus || 'draft';

  const handleMarkCompletedAndBundle = () => {
    const nowIso = new Date().toISOString();
    const updatedRound: FieldExcavationRound = {
      ...round,
      savedToProject: true,
      completionStatus: 'completed',
      completedAtIso: nowIso,
      masterPackageReady: true,
      updatedAt: nowIso,
    };

    const dispatchUpdateRound = (updated: FieldExcavationRound) => {
      try {
        (onUpdateRound as any)((prev: any) => {
          if (typeof prev === 'function') {
            return updated;
          }
          return { ...(prev || round), ...updated };
        });
      } catch {
        (onUpdateRound as any)(updated);
      }
    };

    dispatchUpdateRound(updatedRound);

    if (onSaveRoundToProject) {
      onSaveRoundToProject();
    }

    const archive = buildAndStoreFaceMasterArchive({
      project,
      location,
      round: updatedRound,
      sketchPngDataUrl,
      support2DPngDataUrl,
      completionStatus: 'completed',
      downloadFileNow: true,
    });
    setLatestArchive(archive);
    setShowCompletedBundleModal(true);
    setFeedbackBanner(
      `✓ Face CH ${round.chainageFrom}m–${round.chainageTo}m marked as COMPLETED! Unified master file (.eswa.json) containing all reports, original photos & JSON details has been generated and downloaded.`
    );
  };

  const handleSendForReview = async () => {
    if (!recipientDeviceId.trim()) {
      setFeedbackBanner('Please enter the Reviewer Device ID (e.g. ESWA-742).');
      return;
    }
    setSending(true);
    setFeedbackBanner(null);
    try {
      const nowIso = new Date().toISOString();
      const updatedRound: FieldExcavationRound = {
        ...round,
        savedToProject: true,
        completionStatus: 'review_required',
        masterPackageReady: true,
        reviewMetadata: {
          reviewerDeviceId: recipientDeviceId.trim().toUpperCase(),
          status: 'pending',
          remarks: senderNotes.trim(),
          sentAtIso: nowIso,
        },
        updatedAt: nowIso,
      };

      const dispatchUpdateRound = (updated: FieldExcavationRound) => {
        try {
          (onUpdateRound as any)((prev: any) => {
            if (typeof prev === 'function') {
              return updated;
            }
            return { ...(prev || round), ...updated };
          });
        } catch {
          (onUpdateRound as any)(updated);
        }
      };

      dispatchUpdateRound(updatedRound);

      if (onSaveRoundToProject) {
        onSaveRoundToProject();
      }

      const res = await sendFacePackageToDeviceId({
        recipientDeviceId,
        transferType: 'REVIEW_REQUEST',
        project,
        location,
        round: updatedRound,
        senderNotes,
        sketchPngDataUrl,
        support2DPngDataUrl,
      });

      setShowReviewModal(false);
      setFeedbackBanner(`⏳ ${res.message}`);
    } catch (err: any) {
      setFeedbackBanner(err?.message || 'Failed to send review request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="my-3 p-4 rounded-xl bg-slate-900/95 border-2 border-cyan-500/40 shadow-xl text-slate-100 print:hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-cyan-400" />
              Final Face Completion, Master Archive & Peer Review
            </span>
            {currentStatus === 'completed' || currentStatus === 'approved' ? (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-extrabold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {currentStatus === 'approved' ? '✓ APPROVED & COMPLETED' : '✓ COMPLETED'}
              </span>
            ) : currentStatus === 'review_required' ? (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-extrabold">
                ⏳ REVIEW REQUIRED (Sent to {round.reviewMetadata?.reviewerDeviceId || 'Reviewer'})
              </span>
            ) : currentStatus === 'changes_requested' ? (
              <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-300 font-mono text-xs font-extrabold">
                ↺ CHANGES REQUESTED
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
                Status: In-Progress / Draft
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300">
            Mark this face as <strong>Completed (✓)</strong> to generate a single master file (<code className="text-cyan-300">.eswa.json</code>) containing all reports, original photos, and JSON data, or click <strong>Review Required</strong> to send to a Reviewer's Device ID.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleMarkCompletedAndBundle}
            className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save & Completed (✓ Create Master File)
          </button>

          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Send className="w-4 h-4" />
            Review Required (Send by Device ID)
          </button>

          {(latestArchive || round.masterPackageReady) && (
            <button
              type="button"
              onClick={() => {
                const arch = buildAndStoreFaceMasterArchive({
                  project,
                  location,
                  round,
                  sketchPngDataUrl,
                  support2DPngDataUrl,
                  completionStatus:
                    round.completionStatus === 'review_required'
                      ? 'review_required'
                      : 'completed',
                  downloadFileNow: false,
                });
                setLatestArchive(arch);
                setShowCompletedBundleModal(true);
              }}
              className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold text-xs flex items-center gap-1.5"
            >
              <FolderArchive className="w-4 h-4" />
              Inspect Master File
            </button>
          )}

          {onReturnToFaceList && (
            <button
              type="button"
              onClick={onReturnToFaceList}
              className="px-3 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Return to Face List
            </button>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="mt-3 p-2.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between gap-2">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-cyan-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Send for Review via Device ID Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                Send Face for Review via Device ID
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter the Reviewer's 6-character Device ID (e.g. <span className="font-mono text-cyan-300 font-bold">ESWA-742</span>) or custom alias. The complete face package (Reports + Original Photos + JSON data) will be delivered to their Review Inbox with an instant notification.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Reviewer Device ID or Alias *
              </label>
              <input
                type="text"
                value={recipientDeviceId}
                onChange={(e) => setRecipientDeviceId(e.target.value.toUpperCase())}
                placeholder="e.g. ESWA-742 or CHIEF-GEO"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-cyan-300 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Notes for Reviewer (Optional)
              </label>
              <textarea
                rows={3}
                value={senderNotes}
                onChange={(e) => setSenderNotes(e.target.value)}
                placeholder="e.g. Please verify Q-value and Crown W2 wedge support before shotcrete..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={handleSendForReview}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Mark Review Required & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Master File (.eswa.json) Inspector & One-Click Extractor Modal */}
      {showCompletedBundleModal && latestArchive && (
        <div className="fixed inset-0 z-[9996] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Unified Master Face Package (.eswa.json) Ready
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletedBundleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Project / Location:</span>
                <span className="font-bold text-white">
                  {latestArchive.summary.projectTitle} • {latestArchive.summary.locationTitle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chainage / Face:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {latestArchive.summary.chainageLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stored Inside Master File:</span>
                <span className="text-emerald-300 font-semibold">
                  2-Page Report + {latestArchive.originalPhotos.length} Original Photos + Full JSON Data
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => downloadStoredFaceMasterArchive(round.id)}
                className="p-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
              >
                <FolderArchive className="w-4 h-4" />
                Download Master (.eswa.json)
              </button>
              <button
                type="button"
                onClick={() =>
                  exportFieldMappingTwoPagePdfSheet(
                    project,
                    location,
                    round,
                    sketchPngDataUrl,
                    support2DPngDataUrl
                  )
                }
                className="p-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                Extract 2-Page PDF Report
              </button>
              <button
                type="button"
                onClick={() => extractWordDocFromMasterArchive(latestArchive)}
                className="p-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Extract Word Report (.doc)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompletedBundleModal(false);
                  setShowReviewModal(true);
                }}
                className="p-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Send to Device ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
