import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut, User } from 'firebase/auth';
import {
  auth,
  buildGmailWebComposeUrl,
  buildMailtoUrl,
  getAccessToken,
  getSavedGmailAppPassword,
  googleSignIn,
  initAuth,
  logout,
  saveGmailAppPassword,
  sendGmailMessage,
} from '../firebase';
import {
  AccessRequestRecord,
  approveRequestAndCreateLicense,
  buildWelcomeFeaturesEmailContent,
  createDirectSoftwareLicense,
  CURRENT_SOFTWARE_VERSION,
  deleteSoftwareLicenseAdmin,
  deleteSoftwareReleaseAdmin,
  generateOnePcLicenseKey,
  getLocalMasterPcBypass,
  getOrGeneratePcHardwareId,
  getStoredAdminCredentials,
  MASTER_ADMIN_DEFAULT_EMAIL,
  MasterPcRecord,
  publishSoftwareUpdateRelease,
  refreshAdminLicensingDataFromCloud,
  registerInstantUserAndLogin,
  rejectAccessRequestAdmin,
  removeMasterPcAuthorization,
  sanitizeIdentifier,
  setMasterPcAuthorization,
  SoftwareLicenseRecord,
  SoftwareReleaseRecord,
  subscribeAdminLicensingData,
  syncGithubRepoConfigToCloud,
  updateSoftwareLicenseAdmin,
  updateStoredAdminCredentials,
} from '../engine/softwareLicensingEngine';
import {
  downloadGithubActionsExeWorkflowYml,
  downloadMasterAndroidApk,
  downloadMasterEditionDesktopExe,
  downloadUserAndroidApk,
  downloadUserEditionDesktopExe,
  getCachedAndroidApkBlobUrl,
  getConfiguredGithubRepo,
  getGithubMasterExeDownloadUrl,
  getGithubUserAndroidApkDownloadUrl,
  getGithubUserExeDownloadUrl,
  getMasterAndroidAppShareUrl,
  getUserAndroidAppShareUrl,
  getUserEditionShareUrl,
  normalizeGithubRepoSlug,
  prepareAndroidApkBlobUrl,
} from '../engine/windowsDesktopEngine';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Code,
  Compass,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  FileSpreadsheet,
  Filter,
  KeyRound,
  Laptop,
  Layers,
  Lock,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  deleteAiTrainingTelemetryRecord,
  exportGeminiFineTuningJsonl,
  exportGeotechDatasetBundle,
  fetchAiTrainingTelemetryRecords,
  flushOfflineAiTelemetryQueue,
  MASTER_ADMIN_TARGET_EMAIL,
  syncMappingForAiTraining,
} from '../engine/userCloudAndPackageEngine';
import { AiTrainingTelemetryRecord } from '../types/tunnel';

interface MasterAdminPortalWebsiteProps {
  onSwitchToSoftware: () => void;
  onPreviewUserSoftware?: () => void;
  onMasterPcStatusChanged: (isMaster: boolean) => void;
}

const ADMIN_SESSION_STORAGE_KEY = 'eswa_master_admin_web_logged_in_v1';

export const MasterAdminPortalWebsite: React.FC<MasterAdminPortalWebsiteProps> = ({
  onSwitchToSoftware,
  onPreviewUserSoftware,
  onMasterPcStatusChanged,
}) => {
  const currentPc = useMemo(() => getOrGeneratePcHardwareId(), []);

  // Admin Login State (Unlocked automatically in Master Software & Master Android App)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(true);
  const [readyMasterApk, setReadyMasterApk] = useState<{
    blobUrl: string;
    sizeMb: string;
  } | null>(() => getCachedAndroidApkBlobUrl('master'));
  const [readyUserApk, setReadyUserApk] = useState<{
    blobUrl: string;
    sizeMb: string;
  } | null>(() => getCachedAndroidApkBlobUrl('user'));

  useEffect(() => {
    const onApkBlobReady = (e: Event) => {
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
    const onBinaryDownloadStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        status: 'downloading' | 'completed';
        fileName: string;
        sizeMb?: string;
      };
      if (!detail) return;
      if (detail.status === 'downloading') {
        showToast(
          `Preparing & downloading standalone package: ${detail.fileName}...`
        );
      } else if (detail.status === 'completed') {
        showToast(
          `Downloading: ${detail.fileName}${
            detail.sizeMb ? ` (${detail.sizeMb} MB)` : ''
          }!`
        );
      }
    };
    const onRepoNeeded = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        edition?: 'master' | 'user';
        fileName?: string;
      };
      showToast(
        `Please enter your GitHub repository (e.g. dhoniakash/your-repo) in the GitHub Repository box below and click Save to download ${
          detail?.fileName || 'AKASH-TUNNEL-MAPPER-User-Setup.exe'
        } (~80 MB from GitHub Actions).`
      );
      const inputEl = document.getElementById('eswa-github-repo-input-box');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    window.addEventListener('eswa-apk-blob-ready', onApkBlobReady);
    window.addEventListener('eswa-binary-download-status', onBinaryDownloadStatus);
    window.addEventListener('eswa-github-repo-needed', onRepoNeeded);
    return () => {
      window.removeEventListener('eswa-apk-blob-ready', onApkBlobReady);
      window.removeEventListener('eswa-binary-download-status', onBinaryDownloadStatus);
      window.removeEventListener('eswa-github-repo-needed', onRepoNeeded);
    };
  }, []);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Portal Navigation (Default to 'licenses' = Unified All Users: Android App + PC Software)
  const [activeTab, setActiveTab] = useState<
    'requests' | 'licenses' | 'updates' | 'master_pc' | 'ai_telemetry'
  >('licenses');
  const [userPlatformFilter, setUserPlatformFilter] = useState<
    'ALL' | 'ANDROID' | 'PC' | 'ACTIVE' | 'SUSPENDED'
  >('ALL');

  // AI Training Telemetry Hub State
  const [telemetryRecords, setTelemetryRecords] = useState<AiTrainingTelemetryRecord[]>([]);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [inspectingTelemetry, setInspectingTelemetry] =
    useState<AiTrainingTelemetryRecord | null>(null);
  const [telemetrySearch, setTelemetrySearch] = useState<string>('');
  const [telemetryModeFilter, setTelemetryModeFilter] = useState<
    'ALL' | 'FIELD' | 'PHOTOGRAMMETRY' | 'CORE_LOG'
  >('ALL');
  const [telemetryRockClassFilter, setTelemetryRockClassFilter] = useState<string>('ALL');
  const [telemetryShapeFilter, setTelemetryShapeFilter] = useState<string>('ALL');

  // Real-time Firestore state
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [licenses, setLicenses] = useState<SoftwareLicenseRecord[]>([]);
  const [releases, setReleases] = useState<SoftwareReleaseRecord[]>([]);
  const [masterPcs, setMasterPcs] = useState<MasterPcRecord[]>([]);
  const [isThisPcMaster, setIsThisPcMaster] = useState<boolean>(() =>
    getLocalMasterPcBypass()
  );

  // Approval Form State per request
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);
  const [draftUserId, setDraftUserId] = useState<string>('');
  const [draftPassword, setDraftPassword] = useState<string>('');
  const [draftLicenseKey, setDraftLicenseKey] = useState<string>('');
  const [lockImmediatelyToApplicantPc, setLockImmediatelyToApplicantPc] =
    useState<boolean>(true);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  // Direct Create License Form
  const [newLicUserId, setNewLicUserId] = useState<string>('');
  const [newLicPassword, setNewLicPassword] = useState<string>('');
  const [newLicKey, setNewLicKey] = useState<string>('');
  const [newLicFullName, setNewLicFullName] = useState<string>('');
  const [newLicOrg, setNewLicOrg] = useState<string>('');
  const [newLicEmail, setNewLicEmail] = useState<string>('');
  const [newLicPhone, setNewLicPhone] = useState<string>('');
  const [newLicPcId, setNewLicPcId] = useState<string>('');

  // GitHub Repository Configuration for Dual Master & User .EXE Releases
  const [githubRepoSlug, setGithubRepoSlug] = useState<string>(() =>
    getConfiguredGithubRepo()
  );
  const [githubRepoInput, setGithubRepoInput] = useState<string>(() =>
    getConfiguredGithubRepo()
  );
  const [githubTokenInput, setGithubTokenInput] = useState<string>(() => {
    try {
      return localStorage.getItem('eswa_github_pat_token_v1') || '';
    } catch {
      return '';
    }
  });
  const [ghActionsRuns, setGhActionsRuns] = useState<
    Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      htmlUrl: string;
      createdAt: string;
      headSha: string;
    }>
  >([]);
  const [ghPushBusy, setGhPushBusy] = useState<boolean>(false);
  const [ghStatusBusy, setGhStatusBusy] = useState<boolean>(false);

  // Publish Software Update Form
  const [relVersion, setRelVersion] = useState<string>('1.1.0');
  const [relTitle, setRelTitle] = useState<string>(
    'ESWA GEOLOGICAL MAPPER v1.1.0 — Official GitHub Update'
  );
  const [relNotes, setRelNotes] = useState<string>(
    '1. Latest software update pushed from Google AI Studio & GitHub.\n2. Download the updated Normal User Software (.EXE) using the link below.\n3. Automatic 1-PC license preservation (no need to re-enter credentials).'
  );
  const [relDownloadUrl, setRelDownloadUrl] = useState<string>(() =>
    getGithubUserExeDownloadUrl()
  );
  const [relTargetScope, setRelTargetScope] = useState<'ALL_PCS' | 'SPECIFIC_PCS'>(
    'ALL_PCS'
  );
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<string[]>([]);
  const [customTargetPcInput, setCustomTargetPcInput] = useState<string>('');
  const [relIsMandatory, setRelIsMandatory] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Admin Password Customization
  const [newAdminPassInput, setNewAdminPassInput] = useState<string>('');

  // Gmail OAuth & Auto-SMTP Connection State (for sending automatic approval & update emails from akashdhanusheswar@gmail.com)
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailUser, setGmailUser] = useState<User | null>(null);
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [gmailAppPassword, setGmailAppPassword] = useState<string>(() =>
    getSavedGmailAppPassword()
  );
  const [showAppPassSetup, setShowAppPassSetup] = useState<boolean>(false);

  // Mandatory User Confirmation Dialog State before sending emails via Gmail API
  const [emailConfirmModal, setEmailConfirmModal] = useState<{
    mode: 'APPROVE_REQUEST' | 'RESEND_LICENSE' | 'PUBLISH_UPDATE';
    request?: AccessRequestRecord;
    userId?: string;
    password?: string;
    licenseKey?: string;
    lockToPc?: boolean;
    recipients: Array<{ name: string; email: string; userId?: string }>;
    subject: string;
    greetingAndBody: string;
    updatePayload?: {
      version: string;
      title: string;
      releaseNotes: string;
      downloadUrl: string;
      targetScope: 'ALL_PCS' | 'SPECIFIC_PCS';
      targetIdentifierCsv: string;
      isMandatory: boolean;
    };
  } | null>(null);
  const [sendingEmailsBusy, setSendingEmailsBusy] = useState<boolean>(false);

  useEffect(() => {
    const unsub = initAuth(
      (u, tok) => {
        setGmailUser(u);
        setGmailToken(tok);
        setNeedsAuth(false);
      },
      () => {
        setGmailToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, []);

  const handleConnectGmailAccount = async () => {
    setIsLoggingInGmail(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailToken(result.accessToken);
        setGmailUser(result.user);
        setNeedsAuth(false);
        showToast(
          `Connected Gmail (${result.user.email || MASTER_ADMIN_DEFAULT_EMAIL}) for automatic approval & update emails!`
        );
      }
    } catch (err: unknown) {
      setShowAppPassSetup(true);
      showToast(
        err instanceof Error
          ? `${err.message} — You can also use a 1-time Gmail App Password or 1-Click Gmail Web Compose below.`
          : 'Google OAuth popup could not open. Use Gmail App Password or 1-Click Gmail Compose.'
      );
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleSaveGmailAppPasswordInput = (val: string) => {
    setGmailAppPassword(val);
    saveGmailAppPassword(val);
  };

  const formatHtmlEmailWithClickableLinks = (
    rawText: string,
    headingText: string,
    borderColor = '#0ea5e9',
    headingColor = '#38bdf8'
  ): string => {
    const escaped = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const linked = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 600;">$1</a>'
    );
    return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 14px; border: 1px solid ${borderColor};">
      <h2 style="color: ${headingColor}; margin-top: 0;">${headingText}</h2>
      <div style="color: #e2e8f0; line-height: 1.65; white-space: pre-line; font-family: 'Consolas', 'Segoe UI', monospace; font-size: 13px;">${linked}</div>
    </div>`;
  };

  const triggerExternalUrlOpen = (url: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = url;
    }
  };

  const [syncingCloudBusy, setSyncingCloudBusy] = useState<boolean>(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString()
  );

  const handleManualSyncFromCloud = async () => {
    setSyncingCloudBusy(true);
    try {
      const synced = await refreshAdminLicensingDataFromCloud();
      setRequests(synced.requests);
      setLicenses(synced.licenses);
      setReleases(
        synced.releases.filter((r) => r.releaseId !== 'GITHUB_REPO_CONFIG')
      );
      setMasterPcs(synced.masterPcs);
      const nowStr = new Date().toLocaleTimeString();
      setLastCloudSyncTime(nowStr);
      showToast(
        `Synced from Cloud (${nowStr}): ${synced.requests.filter((r) => r.status === 'PENDING').length} Pending / ${synced.requests.length} Total Requests.`
      );
    } finally {
      setSyncingCloudBusy(false);
    }
  };

  const handleCreateTestUserRequest = async () => {
    setSyncingCloudBusy(true);
    try {
      const testRes = await registerInstantUserAndLogin({
        fullName: 'Site Tunnel Engineer (Test User)',
        email: 'engineer.test@tunnelproject.com',
        phone: '+91 9876543210',
        organization: 'Underground Tunnel Project Site',
        roleTitle: 'Senior Site Geologist',
        purposeNotes:
          'Instant registration test user to verify unified Android + PC user list & automatic Welcome Email.',
      });
      const synced = await refreshAdminLicensingDataFromCloud();
      setRequests(synced.requests);
      setLicenses(synced.licenses);
      setLastCloudSyncTime(new Date().toLocaleTimeString());
      showToast(
        `Registered Test User (${testRes.licenseRecord.userId}) & synced across Master Android App + Master PC Software!`
      );
    } finally {
      setSyncingCloudBusy(false);
    }
  };

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    const unsub = subscribeAdminLicensingData({
      onRequests: (list) => {
        setRequests(list);
        setLastCloudSyncTime(new Date().toLocaleTimeString());
      },
      onLicenses: setLicenses,
      onReleases: setReleases,
      onMasterPcs: (list) => {
        setMasterPcs(list);
        const match = list.find(
          (m) =>
            sanitizeIdentifier(m.pcHardwareId) ===
            sanitizeIdentifier(currentPc.pcHardwareId)
        );
        if (match) {
          setIsThisPcMaster(match.bypassLogin);
          onMasterPcStatusChanged(match.bypassLogin);
        }
      },
    });
    return () => unsub();
  }, [isAdminAuthenticated, currentPc.pcHardwareId, onMasterPcStatusChanged]);

  useEffect(() => {
    const syncRepoState = () => {
      const configured = getConfiguredGithubRepo();
      setGithubRepoSlug(configured);
      setGithubRepoInput((prev) => prev || configured);
      setRelDownloadUrl(getGithubUserExeDownloadUrl(configured));
    };
    window.addEventListener('eswa-github-repo-updated', syncRepoState);
    return () => window.removeEventListener('eswa-github-repo-updated', syncRepoState);
  }, []);

  const handleSaveGithubRepo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      if (githubTokenInput.trim()) {
        localStorage.setItem('eswa_github_pat_token_v1', githubTokenInput.trim());
      } else {
        localStorage.removeItem('eswa_github_pat_token_v1');
      }
    } catch {
      // Ignore storage error
    }
    const saved = await syncGithubRepoConfigToCloud(githubRepoInput);
    setGithubRepoSlug(saved);
    setGithubRepoInput(saved);
    const userExeLink = getGithubUserExeDownloadUrl(saved);
    setRelDownloadUrl(userExeLink);
    showToast(
      saved
        ? `Saved GitHub Repository (${saved})${githubTokenInput.trim() ? ' & GitHub Token' : ''}! Direct .EXE Link: ${userExeLink}`
        : 'Cleared custom GitHub Repository slug.'
    );
    if (saved) {
      handleCheckGithubActionsStatus(saved);
    }
  };

  const handleCheckGithubActionsStatus = async (customRepo?: string) => {
    const targetRepo = (customRepo ?? githubRepoSlug) || githubRepoInput;
    if (!targetRepo || !targetRepo.includes('/')) return;
    setGhStatusBusy(true);
    try {
      const tokenParam = githubTokenInput.trim()
        ? `&token=${encodeURIComponent(githubTokenInput.trim())}`
        : '';
      const resp = await fetch(
        `/api/github/actions-status?repo=${encodeURIComponent(targetRepo)}${tokenParam}`
      );
      const data = await resp.json();
      if (data.ok && Array.isArray(data.runs)) {
        setGhActionsRuns(data.runs);
      }
    } catch {
      // Ignore network errors
    } finally {
      setGhStatusBusy(false);
    }
  };

  const handleDirectServerPushAndTriggerActions = async () => {
    const targetRepo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
    if (!targetRepo || !targetRepo.includes('/')) {
      showToast('Please enter your GitHub repository (username/repository) in the box below first.');
      const repoEl = document.getElementById('eswa-github-repo-input-box') as HTMLInputElement | null;
      if (repoEl) {
        repoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        repoEl.focus();
      }
      return;
    }
    const cleanToken = githubTokenInput.trim();
    if (!cleanToken) {
      showToast(
        'Please paste your GitHub Personal Access Token (ghp_... with repo & workflow permissions) in the GitHub Token box below to push directly!'
      );
      const tokenEl = document.getElementById('eswa-github-token-input-box') as HTMLInputElement | null;
      if (tokenEl) {
        tokenEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tokenEl.focus();
      }
      return;
    }
    try {
      localStorage.setItem('eswa_github_pat_token_v1', cleanToken);
    } catch {
      // Ignore
    }
    const saved = await syncGithubRepoConfigToCloud(targetRepo);
    setGithubRepoSlug(saved);
    setGithubRepoInput(saved);
    setGhPushBusy(true);
    try {
      const resp = await fetch('/api/github/push-and-build-exe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoSlug: targetRepo,
          githubToken: cleanToken,
          commitMessage: `Update ESWA GEOLOGICAL MAPPER (${new Date().toISOString().slice(0, 16)}) + Trigger .EXE Build`,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        showToast(
          `Pushed ${data.filesCount} files${data.pushedWorkflows ? ' + .github/workflows/build-installer.yml' : ''} to ${data.repo}@${data.branch} and triggered GitHub Actions (~80 MB .EXE build)!`
        );
        handleCheckGithubActionsStatus(targetRepo);
      } else {
        showToast(data.error || 'GitHub push failed.');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'GitHub push error.');
    } finally {
      setGhPushBusy(false);
    }
  };

  const bumpPatchVersion = (ver: string): string => {
    const parts = ver
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((n) => parseInt(n, 10));
    if (parts.length >= 3 && !Number.isNaN(parts[2])) {
      return `${parts[0] || 1}.${parts[1] || 0}.${parts[2] + 1}`;
    }
    if (parts.length === 2 && !Number.isNaN(parts[1])) {
      return `${parts[0] || 1}.${parts[1] + 1}.0`;
    }
    return '1.1.0';
  };

  const buildWelcomeApprovalEmailText = (params: {
    fullName: string;
    organization: string;
    userId: string;
    password: string;
    licenseKey: string;
    pcHardwareId: string;
  }) => {
    const exeLink = getGithubUserExeDownloadUrl(githubRepoSlug);
    const apkLink = getUserAndroidAppShareUrl(githubRepoSlug);
    return `Warm Greetings from ESWA Geological Mapper Software Team (${MASTER_ADMIN_DEFAULT_EMAIL})!

Dear ${params.fullName} (${params.organization}),

We are pleased to inform you that your software access request for ESWA GEOLOGICAL MAPPER has been APPROVED! Your 1-Device / 1-PC login credentials have been activated and are also notified directly inside your app/software:

============================================================
ESWA GEOLOGICAL MAPPER — REQUIRED LOGIN DETAILS
============================================================
• Assigned User ID      : ${params.userId}
• Assigned Password     : ${params.password}
• 1-PC / Device Key     : ${params.licenseKey}
• Authorized Device ID  : ${params.pcHardwareId || 'Locks on 1st Login'}
============================================================

OFFICIAL DOWNLOAD LINKS:
• Windows PC Software (.EXE) : ${exeLink}
• Android Mobile App (.APK)  : ${apkLink}

How to Unlock:
1. Open ESWA Geological Mapper on your PC or Android device.
2. Your app automatically receives this approval notification (or open Tab 1: "One-Time Login").
3. Enter your User ID, Password, and 1-PC Key once to permanently unlock your device.

Best Regards,
ESWA Geological Mapper Administration
Email: ${MASTER_ADMIN_DEFAULT_EMAIL}`;
  };

  const buildSoftwareUpdateEmailText = (params: {
    version: string;
    title: string;
    releaseNotes: string;
    downloadUrl: string;
  }) => {
    const apkLink = getUserAndroidAppShareUrl(githubRepoSlug);
    return `Warm Greetings from ESWA Geological Mapper Software Team (${MASTER_ADMIN_DEFAULT_EMAIL})!

Dear Valued Engineer / Geologist,

We are excited to share that a new version of ESWA GEOLOGICAL MAPPER (v${params.version}) is now live! You have also received an instant update notification inside your Android App and PC Software.

============================================================
NEW UPDATE: ${params.title} (v${params.version})
============================================================
${params.releaseNotes}

HOW TO UPDATE AUTOMATICALLY IN 1 TAP (NO PACKAGE DOWNLOAD NEEDED):
1. Open your ESWA Geological Mapper Android App or PC Software.
2. Touch the top Update Notification banner and press "Install Update Now (v${params.version})".
3. Your App / Software will automatically update in-place in 2 seconds while keeping you logged in!

OPTIONAL DIRECT LINKS:
• Windows PC Software (.EXE) : ${params.downloadUrl}
• Android Mobile App (.APK)  : ${apkLink}
============================================================

Best Regards,
ESWA Tunnel Mapper Administration
Email: ${MASTER_ADMIN_DEFAULT_EMAIL}`;
  };

  const handleOneClickPushGithubUpdateToUsers = async () => {
    const latestPublished = releases[0]?.version || CURRENT_SOFTWARE_VERSION;
    const nextVer =
      releases.some((r) => r.version === relVersion.trim())
        ? bumpPatchVersion(latestPublished)
        : relVersion.trim() || bumpPatchVersion(latestPublished);
    const userGithubExeUrl = getGithubUserExeDownloadUrl(githubRepoSlug);
    const title = `ESWA GEOLOGICAL MAPPER v${nextVer} — Official GitHub Update`;
    const notes =
      relNotes.trim() ||
      `New software update v${nextVer} pushed via GitHub Releases. Click Download to get the latest ESWA-GEOLOGICAL-MAPPER-User-Setup.exe.`;

    const recipientList = licenses
      .filter((l) => l.status === 'ACTIVE' && l.email && l.email.includes('@'))
      .map((l) => ({
        name: l.fullName || l.userId,
        email: l.email.trim(),
        userId: l.userId,
      }));

    setEmailConfirmModal({
      mode: 'PUBLISH_UPDATE',
      recipients: recipientList,
      subject: `Greetings from ESWA Tunnel Mapper — New Update v${nextVer} & Download Link`,
      greetingAndBody: buildSoftwareUpdateEmailText({
        version: nextVer,
        title,
        releaseNotes: notes,
        downloadUrl: userGithubExeUrl,
      }),
      updatePayload: {
        version: nextVer,
        title,
        releaseNotes: notes,
        downloadUrl: userGithubExeUrl,
        targetScope: 'ALL_PCS',
        targetIdentifierCsv: 'ALL',
        isMandatory: true,
      },
    });
  };

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'PENDING'),
    [requests]
  );

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => setStatusToast(null), 5000);
  };

  const loadTelemetryData = useCallback(async () => {
    setIsTelemetryLoading(true);
    setTelemetryError(null);
    try {
      const email = auth.currentUser?.email || MASTER_ADMIN_TARGET_EMAIL;
      const records = await fetchAiTrainingTelemetryRecords(email);
      setTelemetryRecords(records);
    } catch (err: any) {
      console.warn('Telemetry load failed:', err);
      setTelemetryError(err?.message || 'Failed to load telemetry from Firestore.');
    } finally {
      setIsTelemetryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai_telemetry') {
      loadTelemetryData();
    }
  }, [activeTab, loadTelemetryData]);

  const handleFlushTelemetryQueue = async () => {
    try {
      const flushed = await flushOfflineAiTelemetryQueue();
      showToast(
        flushed > 0
          ? `Flushed ${flushed} offline telemetry record(s) to Firestore!`
          : 'No pending offline telemetry records in local queue.'
      );
      await loadTelemetryData();
    } catch (err: any) {
      showToast('Error syncing offline queue: ' + (err?.message || 'Network error'));
    }
  };

  const handleDeleteTelemetryItem = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this ground-truth AI telemetry record?')) {
      return;
    }
    try {
      const email = auth.currentUser?.email || MASTER_ADMIN_TARGET_EMAIL;
      await deleteAiTrainingTelemetryRecord(recordId, email);
      setTelemetryRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (inspectingTelemetry?.id === recordId) {
        setInspectingTelemetry(null);
      }
      showToast('Telemetry record successfully deleted.');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete telemetry record.');
    }
  };

  const handleSeedSampleTelemetry = async () => {
    try {
      showToast('Generating & uploading sample ground-truth telemetry record...');
      await syncMappingForAiTraining({
        mappingMethod: 'FIELD',
        triggerEvent: 'MANUAL_TRACE_SAVED',
        projectName: 'Himalayan Head Race Tunnel (HRT)',
        locationName: 'Heading 04 - Face Mapping Station',
        chainageLabel: 'CH 12+450m',
        tunnelGeometry: {
          shape: 'd_shaped',
          spanM: 8.4,
          heightM: 7.2,
          chainageM: 12450,
          driveAzimuthDeg: 285,
        },
        structuralJoints: [
          {
            setId: 'J1',
            pointsNorm: [
              { u: 0.15, v: 0.35 },
              { u: 0.35, v: 0.52 },
              { u: 0.55, v: 0.68 },
            ],
            strikeDeg: 275,
            dipDeg: 65,
            dipDirectionDeg: 5,
            roughnessJrc: 'Rough / Stepped (JRC 12-14)',
            apertureMm: '0.5 - 2.5 mm',
            infilling: 'Calcite + Chlorite slickensides',
            waterCondition: 'Damp / Seeping (0.2 L/min)',
            persistenceM: 5.2,
          },
          {
            setId: 'J2',
            pointsNorm: [
              { u: 0.65, v: 0.25 },
              { u: 0.72, v: 0.58 },
              { u: 0.78, v: 0.85 },
            ],
            strikeDeg: 5,
            dipDeg: 78,
            dipDirectionDeg: 95,
            roughnessJrc: 'Smooth / Undulating (JRC 8-10)',
            apertureMm: '< 0.5 mm tight',
            infilling: 'None / Clean hard walls',
            waterCondition: 'Dry',
            persistenceM: 4.8,
          },
        ],
        geotechRatings: {
          qSystem: {
            rqd: 75,
            jn: 6,
            jr: 2,
            ja: 1,
            jw: 1,
            srf: 1,
            finalQ: 25,
            classification: 'Good Rock Mass (Class B)',
          },
          rmr89: {
            strengthScore: 12,
            rqdScore: 17,
            spacingScore: 15,
            conditionScore: 22,
            waterScore: 10,
            orientationAdjustment: -5,
            totalRmr: 71,
            rockClass: 'Class II — Good Rock',
          },
          gsi: 65,
          smr: 68,
        },
        overbreakData: {
          overbreakAreaM2: 1.85,
          overbreakVolumeM3PerM: 2.25,
          maxRadialOverbreakM: 0.32,
          dominantCategory: 'GEOLOGICAL',
          primaryDiagnosis: 'Structural wedge slip along J1/J2 intersection at Left Crown',
        },
      });
      setTimeout(() => {
        loadTelemetryData();
        showToast('Sample ground-truth telemetry record created!');
      }, 700);
    } catch (err: any) {
      showToast('Error seeding telemetry: ' + (err?.message || 'Error'));
    }
  };

  const filteredTelemetry = useMemo(() => {
    return telemetryRecords.filter((rec) => {
      if (telemetryModeFilter !== 'ALL' && rec.mappingMethod !== telemetryModeFilter) {
        return false;
      }
      if (telemetryShapeFilter !== 'ALL') {
        const shape = (rec.tunnelGeometry?.shape || '').toLowerCase();
        if (telemetryShapeFilter === 'd_shaped' && !shape.includes('d_shape')) return false;
        if (telemetryShapeFilter === 'horse_shoe' && !shape.includes('horse')) return false;
        if (telemetryShapeFilter === 'circular' && !shape.includes('circ')) return false;
        if (telemetryShapeFilter === 'box' && !shape.includes('box')) return false;
        if (telemetryShapeFilter === 'borehole_core' && !shape.includes('borehole') && !shape.includes('core')) return false;
      }
      if (telemetryRockClassFilter !== 'ALL') {
        const qClass = (rec.geotechRatings?.qSystem?.classification || '').toLowerCase();
        const rmrClass = (rec.geotechRatings?.rmr89?.rockClass || '').toLowerCase();
        const target = telemetryRockClassFilter.toLowerCase();
        if (!qClass.includes(target) && !rmrClass.includes(target)) {
          return false;
        }
      }
      if (telemetrySearch.trim()) {
        const q = telemetrySearch.toLowerCase();
        const str = `${rec.userEmail || ''} ${rec.projectName || ''} ${rec.locationName || ''} ${rec.chainageLabel || ''} ${rec.boundPcHardwareId || ''} ${rec.id || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [telemetryRecords, telemetryModeFilter, telemetryShapeFilter, telemetryRockClassFilter, telemetrySearch]);

  const telemetryStats = useMemo(() => {
    const totalFaces = telemetryRecords.length;
    const totalJoints = telemetryRecords.reduce(
      (acc, r) => acc + (r.structuralJoints?.length || 0),
      0
    );
    const uniqueDevices = new Set(telemetryRecords.map((r) => r.boundPcHardwareId)).size;

    const rmrClasses = {
      'Class I': 0,
      'Class II': 0,
      'Class III': 0,
      'Class IV': 0,
      'Class V': 0,
    };
    telemetryRecords.forEach((r) => {
      const cls = r.geotechRatings?.rmr89?.rockClass || '';
      if (cls.includes('Class I') && !cls.includes('Class II') && !cls.includes('Class III') && !cls.includes('Class IV') && !cls.includes('Class V')) {
        rmrClasses['Class I']++;
      } else if (cls.includes('Class II')) {
        rmrClasses['Class II']++;
      } else if (cls.includes('Class III')) {
        rmrClasses['Class III']++;
      } else if (cls.includes('Class IV')) {
        rmrClasses['Class IV']++;
      } else if (cls.includes('Class V')) {
        rmrClasses['Class V']++;
      } else {
        rmrClasses['Class III']++;
      }
    });

    return { totalFaces, totalJoints, uniqueDevices, rmrClasses };
  }, [telemetryRecords]);

  const handleAdminEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const stored = getStoredAdminCredentials();
    const enteredEmail = loginEmail.trim().toLowerCase();
    const enteredPass = loginPassword.trim();

    if (
      enteredEmail === stored.email.toLowerCase() &&
      enteredPass === stored.password
    ) {
      setIsAdminAuthenticated(true);
      try {
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
        sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
      } catch {
        // Ignore
      }
      return;
    }
    setLoginError(
      `Access Denied: Only the Master Admin (${stored.email}) with the valid Master Password can sign in to this website.`
    );
  };

  const handleGoogleAdminLogin = async () => {
    setLoginError(null);
    try {
      const res = await googleSignIn();
      const email = (res?.user.email || '').toLowerCase();
      if (email === MASTER_ADMIN_DEFAULT_EMAIL.toLowerCase()) {
        setGmailUser(res?.user || null);
        setGmailToken(res?.accessToken || null);
        setNeedsAuth(false);
        setIsAdminAuthenticated(true);
        try {
          localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
          sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
        } catch {
          // Ignore
        }
      } else {
        await logout();
        setLoginError(
          `Access Denied: ${email} is not the Master Owner (${MASTER_ADMIN_DEFAULT_EMAIL}).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed';
      setLoginError(msg);
    }
  };

  const handleAdminLogout = async () => {
    setIsAdminAuthenticated(false);
    try {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      await logout();
    } catch {
      // Ignore
    }
  };

  const startApprovingRequest = (req: AccessRequestRecord) => {
    const baseName = req.fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);
    const suggestedUser = `${baseName || 'geologist'}_${req.pcHardwareId
      .slice(-4)
      .toLowerCase()}`;
    const suggestedPass = `Eswa@${Math.floor(1000 + Math.random() * 9000)}`;
    const suggestedKey = generateOnePcLicenseKey(suggestedUser, req.pcHardwareId);

    setApprovingReqId(req.requestId);
    setDraftUserId(suggestedUser);
    setDraftPassword(suggestedPass);
    setDraftLicenseKey(suggestedKey);
    setLockImmediatelyToApplicantPc(true);
  };

  const handleConfirmApproveRequest = async (req: AccessRequestRecord) => {
    if (!draftUserId.trim() || !draftPassword.trim() || !draftLicenseKey.trim()) return;
    setEmailConfirmModal({
      mode: 'APPROVE_REQUEST',
      request: req,
      userId: draftUserId.trim(),
      password: draftPassword.trim(),
      licenseKey: draftLicenseKey.trim(),
      lockToPc: lockImmediatelyToApplicantPc,
      recipients: [
        {
          name: req.fullName,
          email: req.email,
          userId: draftUserId.trim(),
        },
      ],
      subject: `Greetings from ESWA Tunnel Mapper — Your Access Request is Approved & Login Details Inside`,
      greetingAndBody: buildWelcomeApprovalEmailText({
        fullName: req.fullName,
        organization: req.organization,
        userId: draftUserId.trim(),
        password: draftPassword.trim(),
        licenseKey: draftLicenseKey.trim(),
        pcHardwareId: lockImmediatelyToApplicantPc
          ? req.pcHardwareId
          : 'Locks on First Login',
      }),
    });
  };

  const isAndroidLicenseRecord = (lic: SoftwareLicenseRecord): boolean => {
    const hw = (lic.boundPcHardwareId || '').toUpperCase();
    const name = (lic.boundPcName || '').toLowerCase();
    const key = (lic.licenseKey || '').toUpperCase();
    return (
      hw.startsWith('AND') ||
      hw.startsWith('MOB') ||
      name.includes('android') ||
      key.includes('ANDROID')
    );
  };

  const androidUsersCount = useMemo(
    () => licenses.filter((l) => isAndroidLicenseRecord(l)).length,
    [licenses]
  );
  const pcUsersCount = useMemo(
    () => licenses.filter((l) => !isAndroidLicenseRecord(l)).length,
    [licenses]
  );
  const activeUsersCount = useMemo(
    () => licenses.filter((l) => l.status === 'ACTIVE').length,
    [licenses]
  );
  const suspendedUsersCount = useMemo(
    () => licenses.filter((l) => l.status !== 'ACTIVE').length,
    [licenses]
  );

  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      if (userPlatformFilter === 'ANDROID') return isAndroidLicenseRecord(l);
      if (userPlatformFilter === 'PC') return !isAndroidLicenseRecord(l);
      if (userPlatformFilter === 'ACTIVE') return l.status === 'ACTIVE';
      if (userPlatformFilter === 'SUSPENDED') return l.status !== 'ACTIVE';
      return true;
    });
  }, [licenses, userPlatformFilter]);

  // Automatic background Welcome + App Features Email sender for newly registered users
  useEffect(() => {
    if (!gmailToken && !gmailAppPassword.trim()) return;
    const unmailedNewUsers = licenses.filter(
      (l) =>
        l.status === 'ACTIVE' &&
        l.email &&
        l.email.includes('@') &&
        (l.licenseKey === 'ESWA-ANDROID_APP-ACTIVE' ||
          l.licenseKey === 'ESWA-PC_SOFTWARE-ACTIVE')
    );
    if (unmailedNewUsers.length === 0) return;

    let cancelled = false;
    const sendPendingWelcomeEmails = async () => {
      for (const lic of unmailedNewUsers) {
        if (cancelled) break;
        const isAndroid = isAndroidLicenseRecord(lic);
        const platformTag = isAndroid ? 'ANDROID_APP' : 'PC_SOFTWARE';
        const platformLabel = isAndroid
          ? 'Android Mobile App'
          : 'PC Workstation Software';
        const welcomeContent = buildWelcomeFeaturesEmailContent({
          fullName: lic.fullName || lic.userId,
          email: lic.email,
          organization: lic.organization || 'Tunnel Engineering Project',
          roleTitle: lic.password || 'Tunnel Engineer',
          deviceId: lic.boundPcHardwareId || 'Registered Device',
          platformLabel,
          userId: lic.userId,
        });
        const res = await sendGmailMessage({
          to: lic.email,
          subject: welcomeContent.subject,
          textBody: welcomeContent.textBody,
          htmlBody: welcomeContent.htmlBody,
          fromEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
          smtpAppPassword: gmailAppPassword,
          skipInteractivePopup: true,
        });
        if (res.ok && !cancelled) {
          await updateSoftwareLicenseAdmin(lic.userId, {
            licenseKey: `ESWA-${platformTag}-MAILED`,
          });
          showToast(
            `Automatically sent Welcome & App Features email to new user ${lic.fullName} (${lic.email})!`
          );
        }
      }
    };
    void sendPendingWelcomeEmails();
    return () => {
      cancelled = true;
    };
  }, [licenses, gmailToken, gmailAppPassword, gmailUser?.email]);

  const handleOpenResendLicenseEmailModal = (lic: SoftwareLicenseRecord) => {
    const isAndroid = isAndroidLicenseRecord(lic);
    const platformLabel = isAndroid
      ? 'Android Mobile App'
      : 'PC Workstation Software';
    const welcome = buildWelcomeFeaturesEmailContent({
      fullName: lic.fullName || lic.userId,
      email: lic.email,
      organization: lic.organization || 'Tunnel Engineering Project',
      roleTitle: lic.password || 'Tunnel Engineer',
      deviceId: lic.boundPcHardwareId || 'Registered Device',
      platformLabel,
      userId: lic.userId,
    });
    setEmailConfirmModal({
      mode: 'RESEND_LICENSE',
      userId: lic.userId,
      password: lic.password,
      licenseKey: lic.licenseKey,
      recipients: [
        {
          name: lic.fullName || lic.userId,
          email: lic.email,
          userId: lic.userId,
        },
      ],
      subject: welcome.subject,
      greetingAndBody: welcome.textBody,
    });
  };

  const handleExecuteConfirmedEmailAndNotification = async () => {
    if (!emailConfirmModal) return;
    setSendingEmailsBusy(true);
    try {
      if (
        emailConfirmModal.mode === 'APPROVE_REQUEST' &&
        emailConfirmModal.request &&
        emailConfirmModal.userId &&
        emailConfirmModal.password &&
        emailConfirmModal.licenseKey
      ) {
        const req = emailConfirmModal.request;
        const lic = await approveRequestAndCreateLicense({
          request: req,
          userId: emailConfirmModal.userId,
          password: emailConfirmModal.password,
          licenseKey: emailConfirmModal.licenseKey,
          lockToRequestedPcImmediately: Boolean(emailConfirmModal.lockToPc),
        });
        setApprovingReqId(null);
        const summaryText = `ESWA GEOLOGICAL MAPPER — 1-PC LICENSE CREDENTIALS\nUser Name: ${lic.fullName}\nUser ID: ${lic.userId}\nPassword: ${lic.password}\n1-PC License Key: ${lic.licenseKey}\nLocked PC ID: ${lic.boundPcHardwareId || 'Locks on First Login'}`;
        navigator.clipboard?.writeText(summaryText).catch(() => {});
        setCopiedBanner(summaryText);

        if (req.email && req.email.includes('@')) {
          const htmlBody = formatHtmlEmailWithClickableLinks(
            emailConfirmModal.greetingAndBody,
            'Warm Greetings from ESWA Geological Mapper!',
            '#0ea5e9',
            '#38bdf8'
          );
          const mailRes = await sendGmailMessage({
            to: req.email,
            subject: emailConfirmModal.subject,
            textBody: emailConfirmModal.greetingAndBody,
            htmlBody,
            fromEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
            smtpAppPassword: gmailAppPassword,
          });
          const tok = await getAccessToken();
          setGmailToken(tok);
          setNeedsAuth(!tok && !gmailAppPassword.trim());
          if (mailRes.ok) {
            showToast(
              `Approved ${req.fullName}, pushed real-time in-app notification & automatically emailed credentials to ${req.email} from ${gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL}!`
            );
          } else {
            if (mailRes.gmailComposeUrl) {
              triggerExternalUrlOpen(mailRes.gmailComposeUrl);
            }
            showToast(
              `Approved ${req.fullName} & pushed live in-app notification! Opened pre-filled Gmail Compose for ${req.email}.`
            );
          }
        } else {
          showToast(
            `Approved ${req.fullName} & pushed real-time in-app notification!`
          );
        }
        setEmailConfirmModal(null);
        return;
      }

      if (emailConfirmModal.mode === 'RESEND_LICENSE') {
        const recipient = emailConfirmModal.recipients[0];
        if (recipient?.email && recipient.email.includes('@')) {
          const htmlBody = formatHtmlEmailWithClickableLinks(
            emailConfirmModal.greetingAndBody,
            'Warm Greetings from ESWA Geological Mapper!',
            '#0ea5e9',
            '#38bdf8'
          );
          const mailRes = await sendGmailMessage({
            to: recipient.email,
            subject: emailConfirmModal.subject,
            textBody: emailConfirmModal.greetingAndBody,
            htmlBody,
            fromEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
            smtpAppPassword: gmailAppPassword,
          });
          const tok = await getAccessToken();
          setGmailToken(tok);
          setNeedsAuth(!tok && !gmailAppPassword.trim());
          if (mailRes.ok) {
            showToast(
              `Sent login credentials & greetings email to ${recipient.name} (${recipient.email})!`
            );
          } else {
            if (mailRes.gmailComposeUrl) {
              triggerExternalUrlOpen(mailRes.gmailComposeUrl);
            }
            showToast(
              `Opened pre-filled Gmail Compose for ${recipient.name} (${recipient.email}).`
            );
          }
        }
        setEmailConfirmModal(null);
        return;
      }

      if (
        emailConfirmModal.mode === 'PUBLISH_UPDATE' &&
        emailConfirmModal.updatePayload
      ) {
        const p = emailConfirmModal.updatePayload;
        const rel = await publishSoftwareUpdateRelease({
          version: p.version,
          title: p.title,
          releaseNotes: emailConfirmModal.greetingAndBody.slice(0, 1950),
          downloadUrl: p.downloadUrl,
          targetScope: p.targetScope,
          targetIdentifierCsv: p.targetIdentifierCsv,
          isMandatory: p.isMandatory,
        });

        const nextFormVer = bumpPatchVersion(p.version);
        setRelVersion(nextFormVer);
        setRelTitle(`ESWA GEOLOGICAL MAPPER v${nextFormVer} — Official GitHub Update`);
        navigator.clipboard?.writeText(p.downloadUrl).catch(() => {});

        let sentCount = 0;
        let firstFailedComposeUrl = '';
        for (let i = 0; i < emailConfirmModal.recipients.length; i++) {
          const rec = emailConfirmModal.recipients[i];
          if (!rec.email || !rec.email.includes('@')) continue;
          const personalizedText = emailConfirmModal.greetingAndBody.replace(
            'Dear Valued Engineer / Geologist,',
            `Dear ${rec.name},`
          );
          const htmlBody = formatHtmlEmailWithClickableLinks(
            personalizedText,
            `New Software & App Update v${p.version} — ESWA Tunnel Mapper`,
            '#10b981',
            '#34d399'
          );
          const res = await sendGmailMessage({
            to: rec.email,
            subject: emailConfirmModal.subject,
            textBody: personalizedText,
            htmlBody,
            fromEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
            smtpAppPassword: gmailAppPassword,
            skipInteractivePopup: i > 0,
          });
          if (res.ok) {
            sentCount++;
          } else if (!firstFailedComposeUrl && res.gmailComposeUrl) {
            const allEmailsCsv = emailConfirmModal.recipients
              .map((r) => r.email.trim())
              .filter((e) => e.includes('@'))
              .join(',');
            firstFailedComposeUrl = buildGmailWebComposeUrl({
              to: allEmailsCsv,
              subject: emailConfirmModal.subject,
              body: emailConfirmModal.greetingAndBody,
              authUserEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
            });
          }
        }
        const tok = await getAccessToken();
        setGmailToken(tok);
        setNeedsAuth(!tok && !gmailAppPassword.trim());

        if (sentCount > 0) {
          showToast(
            `Published Update v${rel.version}! In-app notifications pushed to all users AND emailed update link + greetings to ${sentCount} user(s) from ${gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL}!`
          );
        } else if (emailConfirmModal.recipients.length === 0) {
          showToast(
            `Published Update v${rel.version}! In-app notifications pushed to all users.`
          );
        } else {
          if (firstFailedComposeUrl) {
            triggerExternalUrlOpen(firstFailedComposeUrl);
          }
          showToast(
            `Published Update v${rel.version} to all users in-app & opened pre-filled Gmail Compose for ${emailConfirmModal.recipients.length} user(s)!`
          );
        }
        setEmailConfirmModal(null);
      }
    } finally {
      setSendingEmailsBusy(false);
    }
  };

  const handleCreateDirectLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLicUserId.trim() || !newLicPassword.trim()) return;
    const finalKey =
      newLicKey.trim() || generateOnePcLicenseKey(newLicUserId, newLicPcId);
    const lic = await createDirectSoftwareLicense({
      userId: newLicUserId,
      password: newLicPassword,
      licenseKey: finalKey,
      fullName: newLicFullName || newLicUserId,
      email: newLicEmail,
      phone: newLicPhone,
      organization: newLicOrg,
      boundPcHardwareId: newLicPcId,
    });
    setNewLicUserId('');
    setNewLicPassword('');
    setNewLicKey('');
    setNewLicFullName('');
    setNewLicOrg('');
    setNewLicEmail('');
    setNewLicPhone('');
    setNewLicPcId('');
    showToast(`Created 1-PC License for ${lic.userId} (${lic.licenseKey}).`);
    if (lic.email && lic.email.includes('@')) {
      handleOpenResendLicenseEmailModal(lic);
    }
  };

  const handleToggleThisPcMaster = async (enable: boolean) => {
    await setMasterPcAuthorization(
      currentPc.pcHardwareId,
      `Master Owner Workstation (${currentPc.pcName})`,
      enable
    );
    setIsThisPcMaster(enable);
    onMasterPcStatusChanged(enable);
    showToast(
      enable
        ? `This PC (${currentPc.pcHardwareId}) is now set as MASTER PC — No login required when opening the software!`
        : `Removed Master PC bypass from this PC.`
    );
  };

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relVersion.trim() || !relTitle.trim()) return;
    const combinedTargets = [
      ...selectedTargetUsers,
      ...customTargetPcInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ].join(', ');

    const targetTokens = combinedTargets
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const matchingLicenses = licenses.filter((l) => {
      if (l.status !== 'ACTIVE' || !l.email || !l.email.includes('@')) return false;
      if (relTargetScope === 'ALL_PCS') return true;
      return (
        targetTokens.includes(l.userId.toLowerCase()) ||
        (l.boundPcHardwareId &&
          targetTokens.includes(l.boundPcHardwareId.toLowerCase()))
      );
    });

    setEmailConfirmModal({
      mode: 'PUBLISH_UPDATE',
      recipients: matchingLicenses.map((l) => ({
        name: l.fullName || l.userId,
        email: l.email.trim(),
        userId: l.userId,
      })),
      subject: `Greetings from ESWA Tunnel Mapper — New Update v${relVersion.trim()} & Download Link`,
      greetingAndBody: buildSoftwareUpdateEmailText({
        version: relVersion.trim(),
        title: relTitle.trim(),
        releaseNotes: relNotes.trim(),
        downloadUrl: relDownloadUrl.trim(),
      }),
      updatePayload: {
        version: relVersion.trim(),
        title: relTitle.trim(),
        releaseNotes: relNotes.trim(),
        downloadUrl: relDownloadUrl.trim(),
        targetScope: relTargetScope,
        targetIdentifierCsv: relTargetScope === 'ALL_PCS' ? 'ALL' : combinedTargets,
        isMandatory: relIsMandatory,
      },
    });
  };

  // ============================================================================
  // VIEW 1: MASTER ADMIN LOGIN GATE (ONLY MASTER OWNER CAN SIGN IN)
  // ============================================================================
  if (!isAdminAuthenticated) {
    const storedCreds = getStoredAdminCredentials();
    return (
      <div className="min-h-dvh w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 overflow-y-auto">
        {/* Top Website Bar */}
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                ESWA Control Center — Master Admin Website
              </h1>
              <p className="text-xs text-slate-400">
                1-PC Software Licensing, Access Approval &amp; Live Update Distribution Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchToSoftware}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            Back to Tunnel Software
          </button>
        </header>

        {/* Center Login Card */}
        <main className="max-w-md w-full mx-auto my-auto py-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <div className="text-xs font-mono text-cyan-400">
                RESTRICTED MASTER OWNER PORTAL
              </div>
              <h2 className="text-xl font-bold text-white">Master Admin Sign In</h2>
              <p className="text-xs text-slate-400">
                Sign in with your Master Email ID and Password to approve software downloads, issue 1-PC keys, configure Master PC bypass, and push software updates.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/70 text-xs text-rose-200">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminEmailLogin} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Master Admin Email ID
                </span>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={storedCreds.email}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Master Admin Password
                </span>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter Master Password"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Login to Master Admin Website
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="shrink mx-3 text-[11px] text-slate-500">OR</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Verify with Google Owner Account ({MASTER_ADMIN_DEFAULT_EMAIL})
            </button>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/90 text-[11px] font-mono text-slate-400 space-y-1">
              <div className="text-slate-300 font-semibold">
                Default Owner Credentials (changeable inside portal):
              </div>
              <div>Email: {storedCreds.email}</div>
              <div>Password: {storedCreds.password}</div>
            </div>
          </div>
        </main>

        <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500 border-t border-slate-900 pt-4">
          ESWA License &amp; Update Management Website · This PC Hardware ID:{' '}
          <span className="font-mono text-slate-400">{currentPc.pcHardwareId}</span>
        </footer>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: AUTHENTICATED MASTER ADMIN CONTROL WEBSITE
  // ============================================================================
  return (
    <div className="h-dvh w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Website Header */}
      <header className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">
                ESWA Master Licensing &amp; Update Website
              </h1>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono text-emerald-400">
                Owner: {MASTER_ADMIN_DEFAULT_EMAIL}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage download access requests, 1-PC hardware-locked login credentials, Master PC bypass, and live software updates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Gmail Auto-Mailer Connection Status / Sign in with Google Button */}
          {needsAuth && !gmailToken && !gmailAppPassword.trim() ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleConnectGmailAccount}
                disabled={isLoggingInGmail}
                className="gsi-material-button flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold border border-slate-300 shadow-xs cursor-pointer"
                title={`Connect Google Account (${MASTER_ADMIN_DEFAULT_EMAIL}) to send automatic approval & update emails via Gmail`}
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper flex items-center gap-2">
                  <div className="gsi-material-button-icon w-4 h-4 shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block', width: '16px', height: '16px' }}
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
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingInGmail ? 'Connecting Gmail...' : 'Connect Gmail Auto-Sender'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setShowAppPassSetup((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                title="Configure 1-Time Gmail App Password for background server email sending without popups"
              >
                SMTP Key
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-600/60 text-xs font-mono text-emerald-300">
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Gmail Auto-Sender Ready ({gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL})
              </span>
              <button
                type="button"
                onClick={() => setShowAppPassSetup((v) => !v)}
                className="ml-1 px-1.5 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-[10px] text-emerald-200 cursor-pointer"
              >
                Config
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => downloadMasterAndroidApk('ESWA-TUNNEL-MAPPER-Master-Android.apk')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            title="Download Full Standalone Master Android App (.APK) from our software"
          >
            <Download className="w-4 h-4" />
            <span>
              Master Standalone .APK
              {readyMasterApk ? ` (${readyMasterApk.sizeMb} MB)` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadUserAndroidApk('ESWA-TUNNEL-MAPPER-User-Android.apk')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            title="Download Full Standalone User Android App (.APK) from our software"
          >
            <Download className="w-4 h-4" />
            <span>
              User Standalone .APK
              {readyUserApk ? ` (${readyUserApk.sizeMb} MB)` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
              if (repo && repo !== githubRepoSlug) {
                void syncGithubRepoConfigToCloud(repo);
                setGithubRepoSlug(repo);
              }
              downloadUserEditionDesktopExe(repo);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            title="Download Direct GitHub Actions User Windows .EXE (~80 MB — AKASH-TUNNEL-MAPPER-User-Setup.exe)"
          >
            <Download className="w-4 h-4" />
            <span>User .EXE (GitHub Actions ~80 MB)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
              if (repo && repo !== githubRepoSlug) {
                void syncGithubRepoConfigToCloud(repo);
                setGithubRepoSlug(repo);
              }
              downloadMasterEditionDesktopExe(repo);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
            title="Download Direct GitHub Actions Master Windows .EXE (~80 MB — AKASH-TUNNEL-MAPPER-Master-Setup.exe)"
          >
            <Download className="w-4 h-4" />
            <span>Master .EXE (GitHub Actions ~80 MB)</span>
          </button>

          {onPreviewUserSoftware && (
            <button
              type="button"
              onClick={onPreviewUserSoftware}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
              title="Preview the Normal User Software (Login & Request Access only)"
            >
              <Eye className="w-4 h-4" />
              <span>Preview User Software</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSwitchToSoftware}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Back to My Master Software
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Collapsible Zero-Popup Gmail Auto-Sender Configuration Strip */}
      {showAppPassSetup && (
        <div className="px-6 py-2.5 bg-slate-900 border-b border-cyan-500/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-cyan-200">
            <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Gmail Auto-Sender ({MASTER_ADMIN_DEFAULT_EMAIL}):</strong> Enter a 16-character Google App Password for 100% automatic background email delivery without any OAuth popups (works in Browser, PC .EXE &amp; Android .APK):
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="password"
              value={gmailAppPassword}
              onChange={(e) => handleSaveGmailAppPasswordInput(e.target.value)}
              placeholder="16-digit Google App Password (optional)"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setShowAppPassSetup(false);
                if (gmailAppPassword.trim()) {
                  showToast(
                    `Saved Gmail App Password for ${MASTER_ADMIN_DEFAULT_EMAIL}! Emails will now be sent automatically in the background.`
                  );
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Live Notification Banner when Pending Access Requests Exist */}
      {pendingRequests.length > 0 && (
        <div className="px-6 py-2.5 bg-amber-950/80 border-b border-amber-700/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-200 font-medium">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{pendingRequests.length} New Software Access Request(s)</strong> waiting for your approval! Review their submitted details below and generate their 1-PC User ID, Password &amp; Key.
            </span>
          </div>
          {activeTab !== 'requests' && (
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Review Requests ({pendingRequests.length})
            </button>
          )}
        </div>
      )}

      {statusToast && (
        <div className="px-6 py-2 bg-emerald-950/90 border-b border-emerald-700 text-xs text-emerald-200 font-mono shrink-0">
          {statusToast}
        </div>
      )}

      {/* Navigation Bar: Unified Across Both Master Android App & Master PC Software */}
      <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('licenses')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'licenses'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>
            01. All Users — Android App &amp; PC Software ({licenses.length} Total · 📱 {androidUsersCount} · 💻 {pcUsersCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('updates')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'updates'
              ? 'border-cyan-500 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>02. Push Auto-Updates &amp; Email Users ({releases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'requests'
              ? 'border-cyan-500 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>
            03. Registration Log ({requests.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('master_pc')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'master_pc'
              ? 'border-cyan-500 text-cyan-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>04. My Master Device Settings</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ai_telemetry');
            loadTelemetryData();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ai_telemetry'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>05. AI Training &amp; Global Field Data Hub</span>
          {telemetryRecords.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono font-bold">
              {telemetryRecords.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Dual GitHub Executables (.EXE) & 1-Click Auto Update Broadcast Box */}
          <div className="p-5 rounded-xl bg-slate-900 border border-emerald-600/50 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1 max-w-2xl">
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  GITHUB DUAL .EXE &amp; DUAL .APK PIPELINE (MASTER &amp; USER WINDOWS .EXE + MASTER &amp; USER ANDROID .APK)
                </div>
                <h3 className="text-sm font-bold text-white">
                  Every Push to GitHub Builds Two Windows Executables &amp; Two Android APKs (Master &amp; User)
                </h3>
                <p className="text-xs text-slate-400">
                  Every time you push to GitHub, GitHub Actions automatically compiles two Windows executables (<strong>AKASH-TUNNEL-MAPPER-Master-Setup.exe</strong> &amp; <strong>AKASH-TUNNEL-MAPPER-User-Setup.exe</strong>) and two standalone Android apps (<strong>ESWA-TUNNEL-MAPPER-Master-Android.apk</strong> &amp; <strong>ESWA-TUNNEL-MAPPER-User-Android.apk</strong>) in the cloud with zero load on your live app.
                </p>
              </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    downloadGithubActionsExeWorkflowYml();
                    showToast('Downloaded GitHub Action workflow file: build-installer.yml');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                  title="Download the direct .github/workflows/build-installer.yml GitHub Action file that builds the ~80 MB User & Master .EXE"
                >
                  <Download className="w-4 h-4" />
                  <span>Download GitHub Action .YML File (for .EXE)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectServerPushAndTriggerActions}
                  disabled={ghPushBusy}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-lg"
                  title="Pushes workspace files + .github/workflows/build-installer.yml to GitHub and triggers the ~80 MB Windows .EXE GitHub Actions workflow"
                >
                  <RefreshCw className={`w-4 h-4 ${ghPushBusy ? 'animate-spin' : ''}`} />
                  <span>
                    {ghPushBusy
                      ? 'Pushing Code + Triggering GitHub Actions...'
                      : '1. Push Code & Trigger GitHub Actions (.EXE)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOneClickPushGithubUpdateToUsers}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer shadow-lg"
                  title="Broadcasts a new update notification to all users with the GitHub User Software .EXE link"
                >
                  <Send className="w-4 h-4" />
                  <span>2. Notify All Users of New .EXE Update</span>
                </button>
              </div>
            </div>

            {/* Live GitHub Actions Workflow Status & Direct Quick Links */}
            {githubRepoSlug && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-slate-400">GitHub Actions (.EXE Builder):</span>
                  {ghActionsRuns.length > 0 ? (
                    <a
                      href={ghActionsRuns[0].htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-cyan-300 font-bold"
                    >
                      {ghActionsRuns[0].name} · {ghActionsRuns[0].status.toUpperCase()}{' '}
                      {ghActionsRuns[0].conclusion
                        ? `(${ghActionsRuns[0].conclusion.toUpperCase()})`
                        : ''}{' '}
                      [{ghActionsRuns[0].headSha}]
                    </a>
                  ) : (
                    <span className="text-slate-400">
                      Workflow ready in <code className="text-emerald-400">.github/workflows/build-installer.yml</code>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCheckGithubActionsStatus()}
                    disabled={ghStatusBusy}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    {ghStatusBusy ? 'Checking...' : 'Check Actions Status'}
                  </button>
                  <a
                    href={`https://github.com/${githubRepoSlug}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                  >
                    Open GitHub Actions (.EXE Artifacts) ↗
                  </a>
                  <a
                    href={`https://github.com/${githubRepoSlug}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700"
                  >
                    Open GitHub .EXE Releases ↗
                  </a>
                </div>
              </div>
            )}

            {/* GitHub Repository Slug & Personal Access Token Configuration Row */}
            <form
              onSubmit={handleSaveGithubRepo}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-200">
                    Direct GitHub Push &amp; ~80 MB .EXE Builder Configuration (Works Even If AI Studio Settings Push Fails):
                  </div>
                  <div className="text-[11px] text-slate-400">
                    • <strong>Why AI Studio Settings Push Failed &amp; Fix:</strong> Google AI Studio&apos;s OAuth app blocks <code className="text-amber-300">.github/workflows</code> and large <code className="text-amber-300">.apk</code> binaries. We moved both out of the workspace so <strong>Google AI Studio Settings &rarr; Push changes to GitHub now works!</strong>{' '}
                    • <strong>Or Push Directly From Here (Recommended):</strong> Enter your GitHub repo + Personal Access Token below and click <strong>1. Push Code &amp; Trigger GitHub Actions (.EXE)</strong> to push all code + <code className="text-emerald-400">.github/workflows/build-installer.yml</code> in 1 click!
                  </div>
                </div>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=AKASH-Tunnel-Mapper-EXE-Builder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-[11px] font-semibold shrink-0"
                >
                  Get GitHub Token (repo + workflow) ↗
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">
                    1. GITHUB REPOSITORY (username/repository)
                  </label>
                  <input
                    id="eswa-github-repo-input-box"
                    type="text"
                    value={githubRepoInput}
                    onChange={(e) => setGithubRepoInput(e.target.value)}
                    placeholder="e.g. dhoniakash/akash-tunnel-mapper"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-5">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">
                    2. GITHUB PERSONAL ACCESS TOKEN (ghp_... for Direct In-App Push)
                  </label>
                  <input
                    id="eswa-github-token-input-box"
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="Paste ghp_... token (with repo + workflow scopes)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex items-end pt-4 md:pt-5">
                  <button
                    type="submit"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Save Config
                  </button>
                </div>
              </div>
            </form>

            {/* Four Packages Side-by-Side: 1. User Android .APK (Our Software), 2. Master Android .APK (Our Software), 3. User .EXE (GitHub Actions ~80 MB), 4. Master .EXE (GitHub Actions ~80 MB) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* PACKAGE 1: USER STANDALONE ANDROID APP (.APK — OUR SOFTWARE) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-600/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-emerald-400 font-bold">
                    1. USER STANDALONE ANDROID APP (.APK{readyUserApk ? ` · ${readyUserApk.sizeMb} MB` : ' · 7.0 MB'})
                  </div>
                  <div className="text-xs font-bold text-white font-mono break-all">
                    ESWA-TUNNEL-MAPPER-User-Android.apk
                  </div>
                  <p className="text-xs text-slate-400">
                    100% Standalone Offline Android App for mobile users. Directly downloadable from our Master Software.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadUserAndroidApk('ESWA-TUNNEL-MAPPER-User-Android.apk')}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      Download User Standalone .APK
                      {readyUserApk ? ` (${readyUserApk.sizeMb} MB)` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = getUserAndroidAppShareUrl(githubRepoSlug);
                      navigator.clipboard?.writeText(url).catch(() => {});
                      showToast(`Copied Standalone User Android .APK Link: ${url}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy User .APK Share Link</span>
                  </button>
                </div>
              </div>

              {/* PACKAGE 2: MASTER STANDALONE ANDROID APP (.APK — OUR SOFTWARE) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-600/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-amber-400 font-bold">
                    2. MASTER STANDALONE ANDROID APP (.APK{readyMasterApk ? ` · ${readyMasterApk.sizeMb} MB` : ' · 7.0 MB'})
                  </div>
                  <div className="text-xs font-bold text-white font-mono break-all">
                    ESWA-TUNNEL-MAPPER-Master-Android.apk
                  </div>
                  <p className="text-xs text-slate-400">
                    100% Standalone Offline Master Android App (Owner Only) with built-in User Access Control &amp; Approval.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadMasterAndroidApk('ESWA-TUNNEL-MAPPER-Master-Android.apk')}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      Download Master Standalone .APK
                      {readyMasterApk ? ` (${readyMasterApk.sizeMb} MB)` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = getMasterAndroidAppShareUrl(githubRepoSlug);
                      navigator.clipboard?.writeText(url).catch(() => {});
                      showToast(`Copied Standalone Master Android .APK Link: ${url}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Master .APK Link</span>
                  </button>
                </div>
              </div>

              {/* PACKAGE 3: USER PC SOFTWARE (.EXE — DIRECT GITHUB ACTIONS ~80 MB FILE) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-teal-600/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-teal-400 font-bold">
                    3. USER PC SOFTWARE (.EXE · ~80 MB GITHUB ACTIONS)
                  </div>
                  <div className="text-xs font-bold text-white font-mono break-all">
                    AKASH-TUNNEL-MAPPER-User-Setup.exe
                  </div>
                  <p className="text-xs text-slate-400">
                    Direct GitHub Actions ~80 MB Windows PC Software (.EXE) for users with 1-PC Login &amp; Request Access.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
                      if (repo && repo !== githubRepoSlug) {
                        void syncGithubRepoConfigToCloud(repo);
                        setGithubRepoSlug(repo);
                      }
                      downloadUserEditionDesktopExe(repo);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download User .EXE (GitHub Actions)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
                      const url = getGithubUserExeDownloadUrl(repo);
                      navigator.clipboard?.writeText(url).catch(() => {});
                      showToast(`Copied GitHub User .EXE Link: ${url}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy GitHub User .EXE Link</span>
                  </button>
                </div>
              </div>

              {/* PACKAGE 4: MASTER PC SOFTWARE (.EXE — DIRECT GITHUB ACTIONS ~80 MB FILE) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-600/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-cyan-400 font-bold">
                    4. MASTER PC SOFTWARE (.EXE · ~80 MB GITHUB ACTIONS)
                  </div>
                  <div className="text-xs font-bold text-white font-mono break-all">
                    AKASH-TUNNEL-MAPPER-Master-Setup.exe
                  </div>
                  <p className="text-xs text-slate-400">
                    Direct GitHub Actions ~80 MB Master Windows PC Software (.EXE) for Owner with built-in Access Control.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
                      if (repo && repo !== githubRepoSlug) {
                        void syncGithubRepoConfigToCloud(repo);
                        setGithubRepoSlug(repo);
                      }
                      downloadMasterEditionDesktopExe(repo);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Master .EXE (GitHub Actions)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const repo = normalizeGithubRepoSlug(githubRepoSlug || githubRepoInput);
                      const url = getGithubMasterExeDownloadUrl(repo);
                      navigator.clipboard?.writeText(url).catch(() => {});
                      showToast(`Copied GitHub Master .EXE Link: ${url}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy GitHub Master .EXE Link</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Copied Credentials Banner */}
          {copiedBanner && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-300">
                  Issued 1-PC Login Credentials (Ready to Send to User)
                </div>
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap">
                  {copiedBanner}
                </pre>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(copiedBanner).catch(() => {});
                    showToast('Copied credentials to clipboard!');
                  }}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Again
                </button>
                <button
                  type="button"
                  onClick={() => setCopiedBanner(null)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 1: ACCESS REQUESTS SUBMITTED AFTER DOWNLOAD
              ==================================================================== */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      Submitted Software Access Requests
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-600/60 text-[10px] font-mono text-emerald-300">
                      Live Cloud Sync Active · {lastCloudSyncTime}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    When someone downloads the PC software or Android app and submits their details, it syncs across Dual-Cloud Firestore + Server Relay automatically every 4 seconds.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSyncFromCloud}
                    disabled={syncingCloudBusy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${syncingCloudBusy ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {syncingCloudBusy ? 'Syncing Cloud...' : 'Sync Cloud Requests Now'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateTestUserRequest}
                    disabled={syncingCloudBusy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                    title="Submit a sample user request to verify live cloud delivery to Master App & Software"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Send Test Request</span>
                  </button>
                </div>
              </div>

              {requests.length === 0 ? (
                <div className="p-10 rounded-xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                  <div className="text-sm font-semibold text-slate-300">
                    No Access Requests Submitted Yet
                  </div>
                  <div className="text-xs text-slate-500 max-w-md mx-auto">
                    When a user downloads the software and submits the registration form on their PC, their request and PC Hardware ID will appear here immediately.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => {
                    const isApproving = approvingReqId === req.requestId;
                    return (
                      <div
                        key={req.requestId}
                        className={`p-5 rounded-xl border transition-colors ${
                          req.status === 'PENDING'
                            ? 'bg-slate-900 border-amber-500/50'
                            : req.status === 'APPROVED'
                            ? 'bg-slate-900/60 border-emerald-700/50'
                            : 'bg-slate-900/40 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                              <span>{req.fullName}</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-cyan-400">{req.organization}</span>
                              <span className="text-slate-500">·</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                  req.pcHardwareId?.startsWith('AND-')
                                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/50'
                                    : 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/50'
                                }`}
                              >
                                {req.pcHardwareId?.startsWith('AND-')
                                  ? '📱 ANDROID USER APP'
                                  : '💻 PC USER SOFTWARE'}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span
                                className={`text-xs font-mono ${
                                  req.status === 'PENDING'
                                    ? 'text-amber-400'
                                    : req.status === 'APPROVED'
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            <div className="text-xs font-mono text-slate-300">
                              Email: {req.email} · Phone/WhatsApp: {req.phone} · Role:{' '}
                              {req.roleTitle}
                            </div>

                            <div className="text-xs font-mono text-slate-400">
                              Applicant Device Hardware ID:{' '}
                              <span className="text-amber-300 font-semibold">
                                {req.pcHardwareId}
                              </span>{' '}
                              ({req.pcName}) · Submitted:{' '}
                              {new Date(req.createdAtIso).toLocaleString()}
                            </div>

                            {req.purposeNotes && (
                              <div className="text-xs text-slate-300 pt-1">
                                Notes: &ldquo;{req.purposeNotes}&rdquo;
                              </div>
                            )}

                            {req.status === 'APPROVED' && req.assignedUserId && (
                              <div className="pt-1 text-xs font-mono text-emerald-300">
                                Issued User ID: <strong>{req.assignedUserId}</strong> · 1-PC
                                Key: <strong>{req.assignedLicenseKey}</strong>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {req.status === 'PENDING' && !isApproving && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startApprovingRequest(req)}
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                                >
                                  <UserCheck className="w-4 h-4" />
                                  Create User ID, Password &amp; 1-PC Key
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectAccessRequestAdmin(req.requestId)}
                                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-medium cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline Approval & Credential Generator Drawer */}
                        {isApproving && (
                          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                            <div className="text-xs font-semibold text-cyan-300">
                              Generate 1-PC Login Credentials for {req.fullName} (Locked to PC:{' '}
                              {req.pcHardwareId})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="space-y-1">
                                <span className="text-[11px] text-slate-400">
                                  Assign User ID
                                </span>
                                <input
                                  type="text"
                                  value={draftUserId}
                                  onChange={(e) => setDraftUserId(e.target.value)}
                                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] text-slate-400">
                                  Assign Password
                                </span>
                                <input
                                  type="text"
                                  value={draftPassword}
                                  onChange={(e) => setDraftPassword(e.target.value)}
                                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] text-slate-400">
                                  1-PC License Key
                                </span>
                                <input
                                  type="text"
                                  value={draftLicenseKey}
                                  onChange={(e) => setDraftLicenseKey(e.target.value)}
                                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-300"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={lockImmediatelyToApplicantPc}
                                  onChange={(e) =>
                                    setLockImmediatelyToApplicantPc(e.target.checked)
                                  }
                                  className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                                />
                                <span>
                                  Lock immediately to applicant&apos;s PC Hardware ID (
                                  <span className="font-mono text-amber-300">
                                    {req.pcHardwareId}
                                  </span>
                                  ) — usable ONLY on that single PC
                                </span>
                              </label>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmApproveRequest(req)}
                                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span>
                                    Approve, Notify in App &amp; Email Credentials
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setApprovingReqId(null)}
                                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              TAB 1 (LICENSES): UNIFIED ALL REGISTERED USERS (ANDROID APP + PC SOFTWARE)
              ==================================================================== */}
          {activeTab === 'licenses' && (
            <div className="space-y-6">
              {/* Unified User Management Header + Sync + Platform Filter Bar */}
              <div className="p-5 rounded-xl bg-slate-900 border border-emerald-600/60 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <span>
                          All Registered Users — Android App &amp; PC Software ({licenses.length})
                        </span>
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-600/60 text-[10px] font-mono text-emerald-300">
                        Unified Cloud Sync · {lastCloudSyncTime}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 pt-1">
                      Every user who registers on either the <strong>Android App (.APK)</strong> or <strong>PC Software (.EXE)</strong> appears here automatically in both your Master App and Master Software. You can <strong>Suspend</strong> or <strong>Reactivate</strong> any user in 1 click.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleManualSyncFromCloud}
                      disabled={syncingCloudBusy}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingCloudBusy ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {syncingCloudBusy ? 'Syncing All Users...' : 'Sync All Users Now'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateTestUserRequest}
                      disabled={syncingCloudBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                      title="Simulate a new user registering to verify instant appearance and Welcome Email"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Simulate New User Login</span>
                    </button>
                  </div>
                </div>

                {/* Platform & Status Filter Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUserPlatformFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      userPlatformFilter === 'ALL'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    All Users ({licenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPlatformFilter('ANDROID')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      userPlatformFilter === 'ANDROID'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-emerald-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    📱 Android App Users ({androidUsersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPlatformFilter('PC')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      userPlatformFilter === 'PC'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-950 text-sky-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    💻 PC Software Users ({pcUsersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPlatformFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      userPlatformFilter === 'ACTIVE'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-950 text-teal-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Active ({activeUsersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPlatformFilter('SUSPENDED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      userPlatformFilter === 'SUSPENDED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-950 text-rose-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Suspended ({suspendedUsersCount})
                  </button>
                </div>

                {/* Unified Users Table */}
                {filteredLicenses.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                    No registered users match this filter yet. When a user installs the Android App or PC Software and enters their details, they will appear here immediately.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3">User Details &amp; Contact</th>
                          <th className="py-2.5 px-3">Platform (App / PC)</th>
                          <th className="py-2.5 px-3">Device ID &amp; Role</th>
                          <th className="py-2.5 px-3">Version</th>
                          <th className="py-2.5 px-3">Account Status</th>
                          <th className="py-2.5 px-3 text-right">
                            Master Actions (Suspend / Welcome Mail)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredLicenses.map((lic) => {
                          const isAndroid = isAndroidLicenseRecord(lic);
                          return (
                            <tr
                              key={lic.userId}
                              className={`hover:bg-slate-950/60 ${
                                lic.status !== 'ACTIVE' ? 'bg-rose-950/20' : ''
                              }`}
                            >
                              <td className="py-3 px-3">
                                <div className="font-bold text-white text-sm font-sans">
                                  {lic.fullName || lic.userId}
                                </div>
                                <div className="text-[11px] text-cyan-300">
                                  {lic.organization}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {lic.email || 'No email'} · {lic.phone || 'No phone'}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                    isAndroid
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                                      : 'bg-sky-950 text-sky-300 border border-sky-600/60'
                                  }`}
                                >
                                  {isAndroid ? '📱 ANDROID APP' : '💻 PC SOFTWARE'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-amber-300 font-semibold">
                                  {lic.boundPcHardwareId || 'Unbound'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {lic.boundPcName || lic.password}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  ID: {lic.userId}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-300">
                                v{lic.installedVersion || '1.0.0'}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    lic.status === 'ACTIVE'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/60'
                                      : 'bg-rose-950 text-rose-400 border border-rose-600/60'
                                  }`}
                                >
                                  {lic.status === 'ACTIVE' ? '● ACTIVE' : '⛔ SUSPENDED'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextStatus =
                                        lic.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                                      void updateSoftwareLicenseAdmin(lic.userId, {
                                        status: nextStatus,
                                      });
                                      showToast(
                                        nextStatus === 'SUSPENDED'
                                          ? `Suspended ${lic.fullName} (${lic.userId})! Their ${isAndroid ? 'Android App' : 'PC Software'} is now locked in real time.`
                                          : `Reactivated ${lic.fullName} (${lic.userId})! Their ${isAndroid ? 'Android App' : 'PC Software'} is now unlocked.`
                                      );
                                    }}
                                    className={`px-3 py-1.5 rounded-lg font-sans font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs ${
                                      lic.status === 'ACTIVE'
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                                  >
                                    {lic.status === 'ACTIVE' ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Suspend User</span>
                                      </>
                                    ) : (
                                      <>
                                        <Unlock className="w-3.5 h-3.5" />
                                        <span>Reactivate User</span>
                                      </>
                                    )}
                                  </button>

                                  {lic.email && lic.email.includes('@') && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenResendLicenseEmailModal(lic)}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] flex items-center gap-1 cursor-pointer"
                                      title={`Send Welcome & App Features Email to ${lic.email}`}
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>Welcome Mail</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setLicenses((prev) =>
                                        prev.filter((u) => u.userId !== lic.userId)
                                      );
                                      setRequests((prev) =>
                                        prev.filter(
                                          (r) =>
                                            r.requestId !== `req_${lic.userId}` &&
                                            r.assignedUserId !== lic.userId
                                        )
                                      );
                                      await deleteSoftwareLicenseAdmin(lic.userId);
                                      showToast(
                                        `Deleted user ${lic.fullName || lic.userId} permanently from Android App & PC Software!`
                                      );
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-700 text-rose-200 hover:text-white border border-rose-700/70 font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer"
                                    title={`Permanently delete ${lic.fullName || lic.userId}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Optional Manual User Creation Card */}
              <form
                onSubmit={handleCreateDirectLicense}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-cyan-400" />
                      Manually Add User (Optional)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Users are added automatically when they open the app/software and enter their details, or you can manually add a user below.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">User ID *</span>
                    <input
                      type="text"
                      required
                      value={newLicUserId}
                      onChange={(e) => {
                        setNewLicUserId(e.target.value);
                        if (!newLicKey) {
                          setNewLicKey(
                            generateOnePcLicenseKey(e.target.value, newLicPcId)
                          );
                        }
                      }}
                      placeholder="e.g. site_eng_01"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Role / Password *</span>
                    <input
                      type="text"
                      required
                      value={newLicPassword}
                      onChange={(e) => setNewLicPassword(e.target.value)}
                      placeholder="e.g. Tunnel Geologist"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">
                      Full Name / Engineer
                    </span>
                    <input
                      type="text"
                      value={newLicFullName}
                      onChange={(e) => setNewLicFullName(e.target.value)}
                      placeholder="Engineer Name"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">
                      Organization / Project
                    </span>
                    <input
                      type="text"
                      value={newLicOrg}
                      onChange={(e) => setNewLicOrg(e.target.value)}
                      placeholder="Company Name"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Email</span>
                    <input
                      type="text"
                      value={newLicEmail}
                      onChange={(e) => setNewLicEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">Phone</span>
                    <input
                      type="text"
                      value={newLicPhone}
                      onChange={(e) => setNewLicPhone(e.target.value)}
                      placeholder="+91 ..."
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-slate-400">
                      Device ID (Optional)
                    </span>
                    <input
                      type="text"
                      value={newLicPcId}
                      onChange={(e) => setNewLicPcId(e.target.value)}
                      placeholder="AND-... or PC-..."
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer"
                    >
                      + Add User &amp; Send Welcome Mail
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ====================================================================
              TAB 3: MY MASTER PC OPTION (BYPASS LOGIN ON OWNER'S PC)
              ==================================================================== */}
          {activeTab === 'master_pc' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-cyan-400">
                      MASTER WORKSTATION PRIVILEGE
                    </div>
                    <h2 className="text-lg font-bold text-white">
                      Master Option for Your PC (No Login Required)
                    </h2>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      Enable the Master Option on your PC below so that whenever you open ESWA Tunnel Mapper on this computer, it automatically bypasses the login &amp; license screen and opens the full software directly.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleThisPcMaster(!isThisPcMaster)}
                    className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      isThisPcMaster
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isThisPcMaster
                        ? 'Master Option Active on This PC (Click to Disable)'
                        : 'Enable Master Option on This PC (No Login Needed)'}
                    </span>
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5">
                  <div>
                    This PC Hardware ID:{' '}
                    <span className="text-cyan-300 font-bold">
                      {currentPc.pcHardwareId}
                    </span>
                  </div>
                  <div>Workstation Profile: {currentPc.pcName}</div>
                  <div>
                    Current Software Login Bypass Status:{' '}
                    <span
                      className={
                        isThisPcMaster
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {isThisPcMaster
                        ? 'MASTER PC ENABLED — Opens Software Directly Without Login'
                        : 'Standard Client Mode (Requires 1-PC User ID & Key)'}
                    </span>
                  </div>
                </div>

                {/* Registered Master PCs List */}
                {masterPcs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Authorized Master PCs ({masterPcs.length})
                    </div>
                    <div className="space-y-2">
                      {masterPcs.map((mpc) => (
                        <div
                          key={mpc.pcHardwareId}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                        >
                          <div>
                            <span className="font-bold text-emerald-300">
                              {mpc.pcHardwareId}
                            </span>{' '}
                            · <span className="text-slate-300">{mpc.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMasterPcAuthorization(mpc.pcHardwareId)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white text-[11px] cursor-pointer"
                          >
                            Remove Master Status
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Website Password Update */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Update Master Admin Website Password
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="password"
                    value={newAdminPassInput}
                    onChange={(e) => setNewAdminPassInput(e.target.value)}
                    placeholder="Enter new Master Admin Password"
                    className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white w-72"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAdminPassInput.trim().length < 4) return;
                      updateStoredAdminCredentials(
                        MASTER_ADMIN_DEFAULT_EMAIL,
                        newAdminPassInput
                      );
                      setNewAdminPassInput('');
                      showToast('Updated Master Admin Website password!');
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                  >
                    Save New Admin Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 4: PUBLISH SOFTWARE UPDATE & NOTIFY TARGET PCS / ANDROID APPS
              ==================================================================== */}
          {activeTab === 'updates' && (
            <div className="space-y-6">
              {/* 4 Compiled GitHub Executables + Live OTA Bundle Overview */}
              <div className="p-5 rounded-xl bg-slate-900 border border-emerald-600/60 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-emerald-400 font-bold">
                      GITHUB CI/CD PIPELINE · 4 EXECUTABLES + ZERO-DATA-DELETION OTA BUNDLE
                    </div>
                    <h2 className="text-base font-bold text-white pt-0.5">
                      Compiled GitHub Executables &amp; Automatic In-Place User Update
                    </h2>
                    <p className="text-xs text-slate-400 pt-1">
                      Every time you push from Google AI Studio to GitHub, GitHub Actions automatically compiles all <strong>4 executables</strong> plus the <strong>Live OTA Update Bundle</strong> (<code className="text-cyan-300">user-ota-bundle.json</code>). When you click <strong>Publish Update</strong> below from your Master Software or Master App, all User Apps &amp; User Software receive an instant notification and update automatically in 1 click with <strong>no previous data deletion</strong>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const cleanRepo = githubRepoSlug.trim() || 'dhoniakash407-create/Eswa';
                      showToast(`Checking latest compiled build on GitHub (${cleanRepo})...`);
                      try {
                        const resp = await fetch(
                          `https://api.github.com/repos/${cleanRepo}/releases/latest`,
                          { headers: { Accept: 'application/vnd.github+json' } }
                        );
                        if (resp.ok) {
                          const data = (await resp.json()) as {
                            id?: number;
                            name?: string;
                            body?: string;
                            published_at?: string;
                          };
                          const matchBuild = String(data.name || '').match(/Build #(\d+)/i);
                          const nextVer = matchBuild
                            ? `1.0.${matchBuild[1]}`
                            : `2.${new Date().getMonth() + 1}.${new Date().getDate()}`;
                          setRelVersion(nextVer);
                          setRelTitle(
                            `ESWA Tunnel Mapper v${nextVer} — Automatic App & Software Update`
                          );
                          setRelNotes(
                            '• Latest Geological AI & 3D Stereonet / 4-Portion Mapping Update.\n• 1-Click Automatic In-Place Update (100% of your previous tunnel projects, photos, joint traces & login session are preserved).'
                          );
                          showToast(
                            `Synced latest GitHub build v${nextVer}! Click "Publish Update & Notify All Users" below.`
                          );
                        } else {
                          showToast(
                            'GitHub release check completed — ready to publish update below.'
                          );
                        }
                      } catch {
                        showToast('Ready to publish update below.');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Latest GitHub Build</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-amber-400 font-bold">
                      1. MASTER SOFTWARE (.EXE)
                    </div>
                    <div className="text-white font-semibold truncate">
                      AKASH-TUNNEL-MAPPER-Master-Setup.exe
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      Owner PC · Direct open + Software Access Control
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-cyan-400 font-bold">
                      2. USER SOFTWARE (.EXE)
                    </div>
                    <div className="text-white font-semibold truncate">
                      AKASH-TUNNEL-MAPPER-User-Setup.exe
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      User PC · 1-Click Auto-Update (No Data Deleted)
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-amber-300 font-bold">
                      3. MASTER APP (.APK)
                    </div>
                    <div className="text-white font-semibold truncate">
                      ESWA-TUNNEL-MAPPER-Master-Android.apk
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      Owner Phone · Direct open + Software Access Control
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] text-emerald-400 font-bold">
                      4. USER APP (.APK)
                    </div>
                    <div className="text-white font-semibold truncate">
                      ESWA-TUNNEL-MAPPER-User-Android.apk
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      User Phone · 1-Click Auto-Update (No Data Deleted)
                    </div>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handlePublishUpdate}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
              >
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-cyan-400" />
                    Publish Update to User App (.APK) &amp; User Software (.EXE) — Zero Data Deletion
                  </h2>
                  <p className="text-xs text-slate-400">
                    When you publish a new update here from your Master Software or Master App, all active users on both the <strong>Android App (.APK)</strong> and <strong>PC Software (.EXE)</strong> immediately receive an update notification and email. Once they click the notification and choose to update, their app/software updates automatically in-place without deleting any previous projects, photos, or login data.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">New Version Number *</span>
                    <input
                      type="text"
                      required
                      value={relVersion}
                      onChange={(e) => setRelVersion(e.target.value)}
                      placeholder="e.g. 2.6.0"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs text-slate-300">Update Headline *</span>
                    <input
                      type="text"
                      required
                      value={relTitle}
                      onChange={(e) => setRelTitle(e.target.value)}
                      placeholder="e.g. ESWA Tunnel Mapper v2.6.0 Update"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-300">
                    What&apos;s New / Release Notes *
                  </span>
                  <textarea
                    rows={3}
                    required
                    value={relNotes}
                    onChange={(e) => setRelNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">
                      Target Users to Notify (Android App + PC Software)
                    </span>
                    <select
                      value={relTargetScope}
                      onChange={(e) =>
                        setRelTargetScope(e.target.value as 'ALL_PCS' | 'SPECIFIC_PCS')
                      }
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="ALL_PCS">
                        Notify All Users — Android App (.APK) &amp; PC Software (.EXE)
                      </option>
                      <option value="SPECIFIC_PCS">
                        Select Specific Users / Devices Only
                      </option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">
                      GitHub Release / OTA Update Channel *
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={relDownloadUrl}
                        onChange={(e) => setRelDownloadUrl(e.target.value)}
                        placeholder={getGithubUserExeDownloadUrl(githubRepoSlug)}
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRelDownloadUrl(getGithubUserExeDownloadUrl(githubRepoSlug))
                        }
                        className="px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold shrink-0 cursor-pointer"
                        title="Use GitHub Release Channel"
                      >
                        GitHub Release
                      </button>
                    </div>
                  </label>
                </div>

                {relTargetScope === 'SPECIFIC_PCS' && (
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-semibold text-amber-300">
                      Choose Specific Users (Android App or PC Software) to Receive This Update:
                    </div>
                    {licenses.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {licenses.map((lic) => {
                          const checked = selectedTargetUsers.includes(lic.userId);
                          return (
                            <label
                              key={lic.userId}
                              className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTargetUsers((prev) => [
                                      ...prev,
                                      lic.userId,
                                    ]);
                                  } else {
                                    setSelectedTargetUsers((prev) =>
                                      prev.filter((u) => u !== lic.userId)
                                    );
                                  }
                                }}
                                className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                              />
                              <span className="truncate font-mono">
                                {lic.fullName || lic.userId} ({lic.boundPcHardwareId || 'Device'})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <input
                      type="text"
                      value={customTargetPcInput}
                      onChange={(e) => setCustomTargetPcInput(e.target.value)}
                      placeholder="Or enter additional User IDs / Device IDs separated by commas..."
                      className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={relIsMandatory}
                      onChange={(e) => setRelIsMandatory(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-rose-500"
                    />
                    <span>
                      Open full-screen 1-Click Auto-Update prompt immediately on User App &amp; User Software
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    Publish Update &amp; Notify All Users (No Data Deletion)
                  </button>
                </div>
              </form>

              {/* Published Update Releases History */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  Published Software Releases ({releases.length})
                </h3>
                {releases.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No software updates published yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {releases.map((rel) => (
                      <div
                        key={rel.releaseId}
                        className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            <span className="text-emerald-400 font-mono">
                              v{rel.version}
                            </span>
                            <span>·</span>
                            <span>{rel.title}</span>
                            {rel.isMandatory && (
                              <span className="text-rose-400 font-mono">
                                · MANDATORY
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 whitespace-pre-line">
                            {rel.releaseNotes}
                          </div>
                          <div className="text-[11px] font-mono text-emerald-400 break-all">
                            Update Link:{' '}
                            {rel.downloadUrl === 'BUILTIN_WINDOWS_EXE'
                              ? `${getUserEditionShareUrl()}&update=v${rel.version}`
                              : rel.downloadUrl}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Target:{' '}
                            <span className="text-cyan-300">
                              {rel.targetScope === 'ALL_PCS'
                                ? 'All Licensed PCs'
                                : rel.targetIdentifierCsv}
                            </span>{' '}
                            · Published: {new Date(rel.publishedAtIso).toLocaleString()}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSoftwareReleaseAdmin(rel.releaseId)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white cursor-pointer"
                          title="Remove Release Notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 5: AI TRAINING & GLOBAL FIELD DATA HUB
              ==================================================================== */}
          {activeTab === 'ai_telemetry' && (
            <div className="space-y-6">
              {/* Header Box & Verification Banner */}
              <div className="p-6 rounded-xl bg-slate-900 border border-indigo-500/50 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        RESTRICTED: MASTER ADMIN AI REPOSITORY
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        akashdhanusheswar@gmail.com
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      AI Training &amp; Global Field Data Hub
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Continuous, non-blocking telemetry automatically aggregated from all field mapping, photogrammetry &amp; borehole core logging operations worldwide. Records are paired as ground-truth geometry + joint polylines for Gemini model fine-tuning.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={loadTelemetryData}
                      disabled={isTelemetryLoading}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer disabled:opacity-50"
                      title="Reload latest telemetry from Firestore"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTelemetryLoading ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>{isTelemetryLoading ? 'Syncing...' : 'Refresh'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFlushTelemetryQueue}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                      title="Flush offline queued telemetry records"
                    >
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Flush Offline Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSeedSampleTelemetry}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold border border-indigo-700/60 cursor-pointer"
                      title="Seed a sample tunnel mapping ground-truth record for AI training"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Seed Test Record</span>
                    </button>
                  </div>
                </div>

                {/* 1-Click Exporters Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-950/80 border border-indigo-900/60">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-indigo-400" />
                      <span>1-Click AI Training Dataset Exporter</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Export active dataset ({filteredTelemetry.length} records) formatted for Google Gemini Fine-Tuning or Machine Learning CSV/JSON bundle.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportGeminiFineTuningJsonl(filteredTelemetry)}
                      disabled={filteredTelemetry.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      <FileJson className="w-4 h-4" />
                      <span>Export Gemini Fine-Tuning JSONL</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportGeotechDatasetBundle(filteredTelemetry)}
                      disabled={filteredTelemetry.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Geotech CSV / JSON Bundle</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Live Telemetry Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Total Tunnel Faces</span>
                    <Layers className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {telemetryStats.totalFaces}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Ground-truth tunnel mapping snapshots
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Traced Discontinuity Joints</span>
                    <Compass className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-cyan-300">
                    {telemetryStats.totalJoints}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Normalized 3D polylines &amp; orientation vectors
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Contributing Workstations</span>
                    <Laptop className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {telemetryStats.uniqueDevices}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Unique hardware IDs synced
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Rock Mass Classes (RMR89)</span>
                    <Database className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-900/60 text-blue-200">
                      I: {telemetryStats.rmrClasses['Class I']}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-900/60 text-emerald-200">
                      II: {telemetryStats.rmrClasses['Class II']}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-900/60 text-amber-200">
                      III: {telemetryStats.rmrClasses['Class III']}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-900/60 text-orange-200">
                      IV: {telemetryStats.rmrClasses['Class IV']}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-900/60 text-rose-200">
                      V: {telemetryStats.rmrClasses['Class V']}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Multi-class ground-truth distribution
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[240px] relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={telemetrySearch}
                    onChange={(e) => setTelemetrySearch(e.target.value)}
                    placeholder="Search by user email, project name, location, chainage, hardware ID..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-400">Mode:</span>
                    <select
                      value={telemetryModeFilter}
                      onChange={(e) => setTelemetryModeFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-medium"
                    >
                      <option value="ALL">All Modes</option>
                      <option value="FIELD">Field Mapping</option>
                      <option value="PHOTOGRAMMETRY">Photogrammetry</option>
                      <option value="CORE_LOG">Core Log</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Shape:</span>
                    <select
                      value={telemetryShapeFilter}
                      onChange={(e) => setTelemetryShapeFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-medium"
                    >
                      <option value="ALL">All Shapes</option>
                      <option value="d_shaped">D-Shaped</option>
                      <option value="horse_shoe">Horse-Shoe</option>
                      <option value="circular">Circular</option>
                      <option value="box">Box / Cavern</option>
                      <option value="borehole_core">Borehole Core</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Rock Class:</span>
                    <select
                      value={telemetryRockClassFilter}
                      onChange={(e) => setTelemetryRockClassFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-medium"
                    >
                      <option value="ALL">All Classes</option>
                      <option value="Class I">Class I (Very Good)</option>
                      <option value="Class II">Class II (Good)</option>
                      <option value="Class III">Class III (Fair)</option>
                      <option value="Class IV">Class IV (Poor)</option>
                      <option value="Class V">Class V (Very Poor)</option>
                    </select>
                  </div>

                  {(telemetrySearch || telemetryModeFilter !== 'ALL' || telemetryShapeFilter !== 'ALL' || telemetryRockClassFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setTelemetrySearch('');
                        setTelemetryModeFilter('ALL');
                        setTelemetryShapeFilter('ALL');
                        setTelemetryRockClassFilter('ALL');
                      }}
                      className="px-2.5 py-1.5 rounded text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Telemetry Error Banner */}
              {telemetryError && (
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{telemetryError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadTelemetryData}
                    className="px-3 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Telemetry Snapshots Table */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>Global Ground-Truth Telemetry Records ({filteredTelemetry.length})</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Displaying verified AI training pairs
                  </span>
                </div>

                {isTelemetryLoading && telemetryRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                    <div>Loading live ground-truth telemetry from Firestore...</div>
                  </div>
                ) : filteredTelemetry.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-3">
                    <div className="text-slate-500">No telemetry records match the current filters.</div>
                    <button
                      type="button"
                      onClick={handleSeedSampleTelemetry}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Seed Sample Telemetry Record Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="py-2.5 px-3">Date / ID</th>
                          <th className="py-2.5 px-3">User &amp; Device</th>
                          <th className="py-2.5 px-3">Method &amp; Trigger</th>
                          <th className="py-2.5 px-3">Project &amp; Chainage</th>
                          <th className="py-2.5 px-3">Geometry</th>
                          <th className="py-2.5 px-3 text-center">Joints</th>
                          <th className="py-2.5 px-3">Geotech Classification</th>
                          <th className="py-2.5 px-3">Overbreak</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {filteredTelemetry.map((rec) => {
                          const jointCount = (rec.structuralJoints || []).length;
                          const hasPhoto = Boolean(rec.facePhotoData?.photoUrl);
                          const rmrClass = rec.geotechRatings?.rmr89?.rockClass || '—';
                          const qScore = rec.geotechRatings?.qSystem?.finalQ !== undefined
                            ? Number(rec.geotechRatings.qSystem.finalQ).toFixed(2)
                            : '—';

                          return (
                            <tr
                              key={rec.id}
                              className="hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3 px-3">
                                <div className="font-mono text-white text-[11px]">
                                  {new Date(rec.timestamp).toLocaleDateString()}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                                  {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {rec.id.replace('telemetry_', '')}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-200 truncate max-w-[170px]" title={rec.userEmail}>
                                  {rec.userEmail}
                                </div>
                                <div className="text-[10px] font-mono text-cyan-400 truncate max-w-[170px]">
                                  {rec.boundPcHardwareId}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      rec.mappingMethod === 'FIELD'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                        : rec.mappingMethod === 'PHOTOGRAMMETRY'
                                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                        : 'bg-purple-950 text-purple-300 border border-purple-800'
                                    }`}
                                  >
                                    {rec.mappingMethod}
                                  </span>
                                  {hasPhoto && (
                                    <span className="text-[10px] text-amber-400 font-mono" title="Calibrated face photo attached">
                                      📷
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 pt-0.5">
                                  {rec.metadata?.triggerEvent || 'MANUAL_TRACE'}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="font-medium text-white truncate max-w-[160px]" title={rec.projectName}>
                                  {rec.projectName || 'Tunnel Project'}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {rec.locationName} · {rec.chainageLabel || `CH ${rec.tunnelGeometry?.chainageM}m`}
                                </div>
                              </td>

                              <td className="py-3 px-3 font-mono text-[11px]">
                                <div className="text-slate-300 capitalize">
                                  {(rec.tunnelGeometry?.shape || 'd_shaped').replace('_', ' ')}
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                  {rec.tunnelGeometry?.spanM}m × {rec.tunnelGeometry?.heightM}m · {rec.tunnelGeometry?.driveAzimuthDeg}°
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                                  jointCount > 0
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'bg-slate-800 text-slate-500'
                                }`}>
                                  {jointCount}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                  <span className="text-cyan-300 font-bold">Q: {qScore}</span>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-emerald-300 font-bold">RMR: {rec.geotechRatings?.rmr89?.totalRmr ?? '—'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                  {rmrClass}
                                </div>
                              </td>

                              <td className="py-3 px-3 font-mono text-[11px]">
                                {rec.overbreakData?.overbreakVolumeM3PerM !== undefined ? (
                                  <div>
                                    <span className="text-amber-300 font-bold">
                                      {rec.overbreakData.overbreakVolumeM3PerM} m³/m
                                    </span>
                                    <div className="text-[10px] text-slate-500 capitalize">
                                      {rec.overbreakData.dominantCategory?.toLowerCase() || 'Geological'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setInspectingTelemetry(rec)}
                                    className="p-1.5 rounded bg-indigo-950 hover:bg-indigo-800 text-indigo-300 hover:text-white cursor-pointer border border-indigo-800/80"
                                    title="Open Visual Inspector (Photo, Traced Joints, Q/RMR &amp; Overbreak)"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTelemetryItem(rec.id)}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white cursor-pointer"
                                    title="Delete Telemetry Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mandatory Confirmation Modal before Sending Emails & Pushing Live In-App Notifications */}
      {emailConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="max-w-2xl w-full max-h-[92dvh] bg-slate-900 border-2 border-cyan-500/80 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 text-slate-100 overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-mono text-cyan-400 font-bold">
                    CONFIRM GMAIL SEND &amp; IN-APP NOTIFICATION
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {emailConfirmModal.mode === 'APPROVE_REQUEST'
                      ? `Approve Access Request & Email Credentials to ${emailConfirmModal.recipients[0]?.name}`
                      : emailConfirmModal.mode === 'RESEND_LICENSE'
                      ? `Send Login Credentials & Greetings Email to ${emailConfirmModal.recipients[0]?.name}`
                      : `Publish Update v${emailConfirmModal.updatePayload?.version}, Notify in App & Email ${emailConfirmModal.recipients.length} User(s)`}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailConfirmModal(null)}
                disabled={sendingEmailsBusy}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400">From Gmail Account: </span>
                    <strong className="text-emerald-400">
                      {gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!gmailToken && (
                      <button
                        type="button"
                        onClick={handleConnectGmailAccount}
                        disabled={isLoggingInGmail}
                        className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-900 font-sans font-bold text-[11px] cursor-pointer"
                      >
                        {isLoggingInGmail ? 'Connecting...' : 'Sign in with Google'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAppPassSetup((v) => !v)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-sans font-semibold text-[11px] border border-slate-700 cursor-pointer"
                    >
                      {gmailAppPassword.trim()
                        ? 'Gmail SMTP App Key Saved ✓'
                        : 'Use Gmail App Password (No Popup)'}
                    </button>
                  </div>
                </div>

                {(showAppPassSetup || Boolean(gmailAppPassword.trim())) && (
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-cyan-500/40 space-y-1.5 font-sans">
                    <div className="text-[11px] text-cyan-300 font-semibold">
                      Zero-Popup Background Gmail Auto-Sender (Optional 16-Character Google App Password for {MASTER_ADMIN_DEFAULT_EMAIL}):
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={gmailAppPassword}
                        onChange={(e) => handleSaveGmailAppPasswordInput(e.target.value)}
                        placeholder="Paste 16-digit Google App Password (sends automatically without any browser popup)"
                        className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                      />
                      {gmailAppPassword.trim() && (
                        <span className="text-[11px] text-emerald-400 font-mono font-bold shrink-0">
                          Ready
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-slate-400">
                    Recipients ({emailConfirmModal.recipients.length}):{' '}
                  </span>
                  {emailConfirmModal.recipients.length > 0 ? (
                    <span className="text-cyan-300">
                      {emailConfirmModal.recipients
                        .map((r) => `${r.name} <${r.email}>`)
                        .join(', ')}
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      In-App Notification to All Users (No licensed user emails registered yet)
                    </span>
                  )}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-slate-300 font-semibold">Email Subject:</span>
                <input
                  type="text"
                  value={emailConfirmModal.subject}
                  onChange={(e) =>
                    setEmailConfirmModal((prev) =>
                      prev ? { ...prev, subject: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-300 font-semibold">
                  Greeting Message &amp; Required Details / Update Link (Sent via Email &amp; In-App Notification):
                </span>
                <textarea
                  rows={11}
                  value={emailConfirmModal.greetingAndBody}
                  onChange={(e) =>
                    setEmailConfirmModal((prev) =>
                      prev ? { ...prev, greetingAndBody: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono leading-relaxed"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 pt-3 shrink-0">
              {emailConfirmModal.recipients.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildGmailWebComposeUrl({
                      to: emailConfirmModal.recipients.map((r) => r.email).join(','),
                      subject: emailConfirmModal.subject,
                      body: emailConfirmModal.greetingAndBody,
                      authUserEmail: gmailUser?.email || MASTER_ADMIN_DEFAULT_EMAIL,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold no-underline"
                    title="Open pre-filled email directly in Gmail Web (mail.google.com)"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Open in Gmail Web</span>
                  </a>
                  <a
                    href={buildMailtoUrl({
                      to: emailConfirmModal.recipients.map((r) => r.email).join(','),
                      subject: emailConfirmModal.subject,
                      body: emailConfirmModal.greetingAndBody,
                    })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold no-underline"
                    title="Open pre-filled email in your PC or Android default Mail app"
                  >
                    <span>Mail App</span>
                  </a>
                </div>
              ) : (
                <div />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailConfirmModal(null)}
                  disabled={sendingEmailsBusy}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConfirmedEmailAndNotification}
                  disabled={sendingEmailsBusy}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {sendingEmailsBusy
                      ? 'Sending Email & In-App Notification...'
                      : emailConfirmModal.mode === 'APPROVE_REQUEST'
                      ? 'Confirm: Approve, Notify in App & Send Email'
                      : emailConfirmModal.mode === 'RESEND_LICENSE'
                      ? 'Confirm: Send Credentials Email Now'
                      : 'Confirm: Publish Update, Notify in App & Send Emails'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Visual Inspector Modal for Telemetry Ground-Truth Records */}
      {inspectingTelemetry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="max-w-6xl w-full max-h-[94dvh] bg-slate-900 border-2 border-indigo-500/80 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      GROUND-TRUTH TELEMETRY INSPECTOR
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {inspectingTelemetry.mappingMethod}
                    </span>
                    <span className="text-xs text-slate-400">
                      · {new Date(inspectingTelemetry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{inspectingTelemetry.projectName}</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-cyan-300">{inspectingTelemetry.locationName}</span>
                    <span className="text-slate-500 font-mono text-xs">
                      ({inspectingTelemetry.chainageLabel || `CH ${inspectingTelemetry.tunnelGeometry.chainageM}m`})
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportGeminiFineTuningJsonl([inspectingTelemetry])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
                  title="Export this record as Gemini Fine-Tuning JSONL"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Export Gemini JSONL</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectingTelemetry(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content Grid */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: Visual Face & Joint Polylines Overlay */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span>Tunnel Face Canvas &amp; Traced Joint Polylines</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {(inspectingTelemetry.structuralJoints || []).length} Traced Polyline(s)
                      </span>
                    </div>

                    {/* Canvas / Photo Viewer */}
                    <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                      {inspectingTelemetry.facePhotoData?.photoUrl ? (
                        <>
                          <img
                            src={inspectingTelemetry.facePhotoData.photoUrl}
                            alt="Tunnel Face Calibration"
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                          <svg
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="none"
                            className="absolute inset-0 w-full h-full pointer-events-none"
                          >
                            {(inspectingTelemetry.structuralJoints || []).map((joint, jIdx) => {
                              const pts = joint.pointsNorm || [];
                              if (pts.length < 2) return null;
                              const pointsStr = pts
                                .map((p) => `${p.u * 1000},${p.v * 1000}`)
                                .join(' ');
                              const colors = [
                                '#38bdf8', // cyan
                                '#34d399', // emerald
                                '#f59e0b', // amber
                                '#f43f5e', // rose
                                '#a855f7', // purple
                                '#3b82f6', // blue
                              ];
                              const color = colors[jIdx % colors.length];
                              const mid = pts[Math.floor(pts.length / 2)];

                              return (
                                <g key={jIdx}>
                                  <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke="#000"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.7"
                                  />
                                  <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  {mid && (
                                    <text
                                      x={mid.u * 1000 + 10}
                                      y={mid.v * 1000 - 8}
                                      fill="#ffffff"
                                      fontSize="24"
                                      fontWeight="bold"
                                      filter="drop-shadow(0px 1px 3px rgba(0,0,0,0.9))"
                                    >
                                      {joint.setId} ({joint.strikeDeg ?? 0}°/{joint.dipDeg ?? 0}°)
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </>
                      ) : (
                        <div className="relative w-full h-full p-6 flex flex-col items-center justify-center">
                          <svg
                            viewBox="0 0 800 650"
                            className="w-full h-full max-h-[340px]"
                          >
                            {/* Profile Arch Vector Representation */}
                            <path
                              d="M 120 540 L 120 320 A 280 280 0 0 1 680 320 L 680 540 Z"
                              fill="#090d16"
                              stroke="#6366f1"
                              strokeWidth="3"
                              strokeDasharray="4 4"
                            />
                            {/* Ground floor line */}
                            <line
                              x1="100"
                              y1="540"
                              x2="700"
                              y2="540"
                              stroke="#475569"
                              strokeWidth="2"
                            />

                            {/* Render Polylines inside cross-section */}
                            {(inspectingTelemetry.structuralJoints || []).map((joint, jIdx) => {
                              const pts = joint.pointsNorm || [];
                              if (pts.length < 2) return null;
                              const pointsStr = pts
                                .map((p) => `${120 + p.u * 560},${80 + p.v * 460}`)
                                .join(' ');
                              const colors = [
                                '#38bdf8',
                                '#34d399',
                                '#f59e0b',
                                '#f43f5e',
                                '#a855f7',
                              ];
                              const color = colors[jIdx % colors.length];
                              const mid = pts[Math.floor(pts.length / 2)];

                              return (
                                <g key={jIdx}>
                                  <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                  />
                                  {mid && (
                                    <text
                                      x={120 + mid.u * 560 + 8}
                                      y={80 + mid.v * 460 - 6}
                                      fill="#ffffff"
                                      fontSize="18"
                                      fontWeight="bold"
                                    >
                                      {joint.setId} ({joint.strikeDeg ?? 0}°/{joint.dipDeg ?? 0}°)
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                          <div className="text-[11px] font-mono text-slate-400 pt-1">
                            Vector Tunnel Arch Representation · {inspectingTelemetry.tunnelGeometry.spanM}m Span × {inspectingTelemetry.tunnelGeometry.heightM}m Height
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Joint Traces List Table */}
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-bold text-slate-300">
                        Traced Discontinuities &amp; Geotechnical Attributes
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-slate-950 text-slate-400 text-[10px]">
                            <tr>
                              <th className="py-2 px-2.5">Set</th>
                              <th className="py-2 px-2.5">Strike</th>
                              <th className="py-2 px-2.5">Dip / Dir</th>
                              <th className="py-2 px-2.5">Roughness (JRC)</th>
                              <th className="py-2 px-2.5">Aperture</th>
                              <th className="py-2 px-2.5">Infill / Water</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-[11px]">
                            {(inspectingTelemetry.structuralJoints || []).map((j, i) => (
                              <tr key={i} className="hover:bg-slate-800/40">
                                <td className="py-2 px-2.5 text-cyan-300 font-bold">{j.setId}</td>
                                <td className="py-2 px-2.5 text-slate-200">{j.strikeDeg ?? '—'}°</td>
                                <td className="py-2 px-2.5 text-slate-200">
                                  {j.dipDeg ?? '—'}° / {j.dipDirectionDeg ?? '—'}°
                                </td>
                                <td className="py-2 px-2.5 text-slate-300 truncate max-w-[130px]" title={String(j.roughnessJrc || '')}>
                                  {j.roughnessJrc || 'Smooth'}
                                </td>
                                <td className="py-2 px-2.5 text-slate-300 truncate max-w-[100px]">
                                  {j.apertureMm || 'Tight'}
                                </td>
                                <td className="py-2 px-2.5 text-slate-400 truncate max-w-[130px]">
                                  {j.infilling || 'Clean'} / {j.waterCondition || 'Dry'}
                                </td>
                              </tr>
                            ))}
                            {(inspectingTelemetry.structuralJoints || []).length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-slate-500">
                                  No structural joint traces recorded for this snapshot.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Parameters, Ratings, Overbreak & Metadata */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Tunnel Geometry Card */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span>Tunnel Geometry &amp; Alignment</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Shape</span>
                        <span className="text-white font-bold capitalize">
                          {(inspectingTelemetry.tunnelGeometry.shape || 'd_shaped').replace('_', ' ')}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Span × Height</span>
                        <span className="text-cyan-300 font-bold">
                          {inspectingTelemetry.tunnelGeometry.spanM}m × {inspectingTelemetry.tunnelGeometry.heightM}m
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Chainage</span>
                        <span className="text-white font-bold">
                          {inspectingTelemetry.chainageLabel || `CH ${inspectingTelemetry.tunnelGeometry.chainageM}m`}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Drive Azimuth</span>
                        <span className="text-amber-300 font-bold">
                          {inspectingTelemetry.tunnelGeometry.driveAzimuthDeg}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Geotechnical Ratings: Barton Q & Bieniawski RMR89 */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>Geotechnical Classifications (Q &amp; RMR89)</span>
                    </div>

                    {/* Barton Q-System */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 font-mono">Barton Q-System</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-200 border border-cyan-800">
                          {inspectingTelemetry.geotechRatings.qSystem?.classification || 'Q Classified'}
                        </span>
                      </div>
                      {inspectingTelemetry.geotechRatings.qSystem ? (
                        <>
                          <div className="grid grid-cols-6 gap-1 text-center font-mono text-[10px] text-slate-300">
                            <div className="bg-slate-950 p-1 rounded">RQD: {inspectingTelemetry.geotechRatings.qSystem.rqd}</div>
                            <div className="bg-slate-950 p-1 rounded">Jn: {inspectingTelemetry.geotechRatings.qSystem.jn}</div>
                            <div className="bg-slate-950 p-1 rounded">Jr: {inspectingTelemetry.geotechRatings.qSystem.jr}</div>
                            <div className="bg-slate-950 p-1 rounded">Ja: {inspectingTelemetry.geotechRatings.qSystem.ja}</div>
                            <div className="bg-slate-950 p-1 rounded">Jw: {inspectingTelemetry.geotechRatings.qSystem.jw}</div>
                            <div className="bg-slate-950 p-1 rounded">SRF: {inspectingTelemetry.geotechRatings.qSystem.srf}</div>
                          </div>
                          <div className="text-xs font-mono text-cyan-400 font-bold pt-1">
                            Final Barton Q Score: {Number(inspectingTelemetry.geotechRatings.qSystem.finalQ).toFixed(3)}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-500">No Barton Q parameters recorded.</div>
                      )}
                    </div>

                    {/* Bieniawski RMR89 */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300 font-mono">Bieniawski RMR89</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-200 border border-emerald-800">
                          {inspectingTelemetry.geotechRatings.rmr89?.rockClass || 'RMR Classified'}
                        </span>
                      </div>
                      {inspectingTelemetry.geotechRatings.rmr89 ? (
                        <>
                          <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] text-slate-300">
                            <div className="bg-slate-950 p-1 rounded">Strength: {inspectingTelemetry.geotechRatings.rmr89.strengthScore}</div>
                            <div className="bg-slate-950 p-1 rounded">RQD: {inspectingTelemetry.geotechRatings.rmr89.rqdScore}</div>
                            <div className="bg-slate-950 p-1 rounded">Spacing: {inspectingTelemetry.geotechRatings.rmr89.spacingScore}</div>
                            <div className="bg-slate-950 p-1 rounded">Cond: {inspectingTelemetry.geotechRatings.rmr89.conditionScore}</div>
                            <div className="bg-slate-950 p-1 rounded">Water: {inspectingTelemetry.geotechRatings.rmr89.waterScore}</div>
                            <div className="bg-slate-950 p-1 rounded">Adj: {inspectingTelemetry.geotechRatings.rmr89.orientationAdjustment}</div>
                          </div>
                          <div className="text-xs font-mono text-emerald-400 font-bold pt-1">
                            Total RMR89 Score: {inspectingTelemetry.geotechRatings.rmr89.totalRmr} / 100
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-500">No RMR89 parameters recorded.</div>
                      )}
                    </div>
                  </div>

                  {/* Overbreak & Cavity Analysis */}
                  {inspectingTelemetry.overbreakData && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Overbreak &amp; Cavity Diagnosis</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Overbreak Volume</span>
                          <span className="text-amber-300 font-bold">
                            {inspectingTelemetry.overbreakData.overbreakVolumeM3PerM} m³/m
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Dominant Category</span>
                          <span className="text-white font-bold capitalize">
                            {inspectingTelemetry.overbreakData.dominantCategory}
                          </span>
                        </div>
                      </div>
                      {inspectingTelemetry.overbreakData.primaryDiagnosis && (
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                          <span className="text-slate-500 font-bold">Diagnosis: </span>
                          {inspectingTelemetry.overbreakData.primaryDiagnosis}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hardware & Telemetry Provenance */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono text-slate-400">
                    <div className="text-slate-300 font-bold text-[11px] pb-1 border-b border-slate-800">
                      Workstation Provenance &amp; Verification
                    </div>
                    <div>User Email: <span className="text-slate-200">{inspectingTelemetry.userEmail}</span></div>
                    <div>Bound Hardware ID: <span className="text-cyan-400">{inspectingTelemetry.boundPcHardwareId}</span></div>
                    <div>Record ID: <span className="text-slate-500">{inspectingTelemetry.id}</span></div>
                    <div>Trigger Event: <span className="text-indigo-400">{inspectingTelemetry.metadata?.triggerEvent || 'MANUAL_TRACE_SAVED'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteTelemetryItem(inspectingTelemetry.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-900 text-rose-300 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Telemetry Record</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportGeotechDatasetBundle([inspectingTelemetry])}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Record JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectingTelemetry(null)}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
