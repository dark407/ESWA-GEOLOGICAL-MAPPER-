import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Edit2,
  ExternalLink,
  FileCheck2,
  FolderPlus,
  HelpCircle,
  KeyRound,
  Layers,
  Link2,
  Lock,
  LogIn,
  LogOut,
  PenTool,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AllocatedDeviceRecord,
  allocateDeviceToProjectRole,
  createSharedCollaborationProject,
  deleteGeologistUserProfile,
  getActiveGeologistProfile,
  getActiveSharedProject,
  getLocalUserDeviceId,
  getStoredGeologistProfiles,
  GoogleUserAccountInfo,
  joinProjectByCode,
  listStoredSharedProjects,
  ProjectOrganizationRole,
  registerOrUpdateUserDeviceId,
  removeAllocatedDeviceFromProject,
  saveGeologistUserProfile,
  setActiveGeologistProfileDirect,
  setActiveSharedProject,
  SharedProjectCollaborationRecord,
  signInWithGoogleAccount,
  signOutGoogleAccount,
  subscribeToSharedProject,
  verifyAndSetActiveProfile,
  GeologistUserProfile,
} from '../engine/userCloudAndPackageEngine';
import { ThemeToggleButton } from '../context/ThemeContext';

export interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: GoogleUserAccountInfo | null;
  onUserChanged?: (user: GoogleUserAccountInfo | null) => void;
  onActiveProfileChanged?: (profile: GeologistUserProfile) => void;
  initialTab?: 'account' | 'projects' | 'profiles';
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  onActiveProfileChanged,
  initialTab = 'account',
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'projects' | 'profiles'>(initialTab);

  // Device Info
  const [deviceInfo, setDeviceInfo] = useState(() =>
    getLocalUserDeviceId(currentUser?.uid, currentUser?.email)
  );
  const [aliasInput, setAliasInput] = useState(deviceInfo.customAlias || '');
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active Shared Project
  const [sharedProjects, setSharedProjects] = useState<SharedProjectCollaborationRecord[]>(() =>
    listStoredSharedProjects()
  );
  const [activeProject, setActiveProject] = useState<SharedProjectCollaborationRecord | null>(() =>
    getActiveSharedProject()
  );
  const [copiedJoinCode, setCopiedJoinCode] = useState(false);

  // Project Creation State
  const [newProjectName, setNewProjectName] = useState('');
  const [newTunnelLocation, setNewTunnelLocation] = useState('');
  const [newChainageBounds, setNewChainageBounds] = useState('RD 1200.0m – RD 1280.0m');
  const [newCreatorRole, setNewCreatorRole] = useState<ProjectOrganizationRole>('Contractor');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Join Project State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinRoleInput, setJoinRoleInput] = useState<ProjectOrganizationRole>('Contractor');
  const [isJoiningProject, setIsJoiningProject] = useState(false);

  // Allocate Device State
  const [allocDeviceId, setAllocDeviceId] = useState('');
  const [allocAlias, setAllocAlias] = useState('');
  const [allocRole, setAllocRole] = useState<ProjectOrganizationRole>('Contractor');
  const [isAllocatingDevice, setIsAllocatingDevice] = useState(false);

  // Profiles State
  const [profiles, setProfiles] = useState<GeologistUserProfile[]>(() =>
    getStoredGeologistProfiles()
  );
  const [activeProfile, setActiveProfile] = useState<GeologistUserProfile | null>(() =>
    getActiveGeologistProfile()
  );

  // PIN Switcher Modal
  const [pinModalProfile, setPinModalProfile] = useState<GeologistUserProfile | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Create / Edit Profile Form
  const [showAddProfileForm, setShowAddProfileForm] = useState(false);
  const [profileFormName, setProfileFormName] = useState('');
  const [profileFormRole, setProfileFormRole] = useState<ProjectOrganizationRole>('Contractor');
  const [profileFormDesignation, setProfileFormDesignation] = useState('');
  const [profileFormPin, setProfileFormPin] = useState('1234');
  const [profileFormSignatureDataUrl, setProfileFormSignatureDataUrl] = useState<string>('');

  // Interactive Signature Canvas Ref
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Device Info on user change
  useEffect(() => {
    const info = getLocalUserDeviceId(currentUser?.uid, currentUser?.email);
    setDeviceInfo(info);
    setAliasInput(info.customAlias || '');
  }, [currentUser?.uid, currentUser?.email]);

  // Sync Projects
  const refreshProjects = useCallback(() => {
    const list = listStoredSharedProjects();
    setSharedProjects(list);
    const curr = getActiveSharedProject();
    setActiveProject(curr);
  }, []);

  useEffect(() => {
    window.addEventListener('eswa-shared-projects-updated', refreshProjects);
    return () => {
      window.removeEventListener('eswa-shared-projects-updated', refreshProjects);
    };
  }, [refreshProjects]);

  // Subscribe to active project if exists
  useEffect(() => {
    if (!activeProject?.id) return;
    const unsub = subscribeToSharedProject(activeProject.id, (updated) => {
      if (updated) {
        setActiveProject(updated);
        setSharedProjects(listStoredSharedProjects());
      }
    });
    return () => unsub();
  }, [activeProject?.id]);

  // Refresh Profiles
  const refreshProfiles = useCallback(() => {
    const list = getStoredGeologistProfiles();
    setProfiles(list);
    const curr = getActiveGeologistProfile();
    setActiveProfile(curr);
    if (curr && onActiveProfileChanged) {
      onActiveProfileChanged(curr);
    }
  }, [onActiveProfileChanged]);

  useEffect(() => {
    window.addEventListener('eswa-geologist-profile-changed', refreshProfiles);
    return () => {
      window.removeEventListener('eswa-geologist-profile-changed', refreshProfiles);
    };
  }, [refreshProfiles]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Status message auto-clear
  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // Copy Device ID
  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceInfo.deviceId);
    setCopiedDeviceId(true);
    setTimeout(() => setCopiedDeviceId(false), 2000);
  };

  // Save Device Alias
  const handleSaveAlias = async () => {
    setSavingAlias(true);
    try {
      const res = await registerOrUpdateUserDeviceId(currentUser, aliasInput);
      setDeviceInfo(res);
      setStatusMessage({ text: 'Device nickname updated successfully!', type: 'success' });
    } catch {
      setStatusMessage({ text: 'Failed to update device alias.', type: 'error' });
    } finally {
      setSavingAlias(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await signInWithGoogleAccount();
      if (res.user) {
        if (onUserChanged) onUserChanged(res.user);
        setStatusMessage({ text: `Signed in as ${res.user.displayName || res.user.email}`, type: 'success' });
      } else if (res.error) {
        setStatusMessage({ text: res.error, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Google Sign-In failed', type: 'error' });
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOutGoogleAccount();
      if (onUserChanged) onUserChanged(null);
      setStatusMessage({ text: 'Signed out of Google account', type: 'info' });
    } catch {
      setStatusMessage({ text: 'Sign-Out failed', type: 'error' });
    }
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setStatusMessage({ text: 'Please enter a project name', type: 'error' });
      return;
    }
    setIsCreatingProject(true);
    try {
      const proj = await createSharedCollaborationProject({
        projectName: newProjectName,
        tunnelLocation: newTunnelLocation || 'Main Tunnel',
        chainageBounds: newChainageBounds,
        creatorRole: newCreatorRole,
        user: currentUser,
      });
      refreshProjects();
      setIsCreatingProject(false);
      setNewProjectName('');
      setNewTunnelLocation('');
      setStatusMessage({
        text: `Project "${proj.projectName}" created! Join Code: ${proj.joinCode}`,
        type: 'success',
      });
    } catch (err: any) {
      setIsCreatingProject(false);
      setStatusMessage({ text: err?.message || 'Failed to create project', type: 'error' });
    }
  };

  // Join Project
  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) {
      setStatusMessage({ text: 'Please enter a 6-character Project Code', type: 'error' });
      return;
    }
    setIsJoiningProject(true);
    try {
      const res = await joinProjectByCode({
        joinCode: joinCodeInput,
        userRole: joinRoleInput,
        user: currentUser,
      });
      setIsJoiningProject(false);
      if (res.success && res.project) {
        refreshProjects();
        setJoinCodeInput('');
        setStatusMessage({ text: res.message, type: 'success' });
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setIsJoiningProject(false);
      setStatusMessage({ text: err?.message || 'Failed to join project', type: 'error' });
    }
  };

  // Allocate Device to Active Project
  const handleAllocateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) {
      setStatusMessage({ text: 'No active project selected', type: 'error' });
      return;
    }
    if (!allocDeviceId.trim()) {
      setStatusMessage({ text: 'Please enter a target Device ID', type: 'error' });
      return;
    }
    setIsAllocatingDevice(true);
    try {
      const updated = await allocateDeviceToProjectRole({
        projectId: activeProject.id,
        targetDeviceId: allocDeviceId,
        alias: allocAlias,
        role: allocRole,
        allocatedBy: activeProfile?.name || currentUser?.displayName || deviceInfo.deviceId,
      });
      setActiveProject(updated);
      setAllocDeviceId('');
      setAllocAlias('');
      setIsAllocatingDevice(false);
      setStatusMessage({
        text: `Device ${allocDeviceId} allocated as ${allocRole}!`,
        type: 'success',
      });
    } catch (err: any) {
      setIsAllocatingDevice(false);
      setStatusMessage({ text: err?.message || 'Failed to allocate device', type: 'error' });
    }
  };

  // Remove Device from Active Project
  const handleRemoveDevice = async (targetDeviceId: string) => {
    if (!activeProject) return;
    try {
      const updated = await removeAllocatedDeviceFromProject({
        projectId: activeProject.id,
        targetDeviceId,
      });
      setActiveProject(updated);
      setStatusMessage({ text: `Device ${targetDeviceId} removed from project`, type: 'info' });
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to remove device', type: 'error' });
    }
  };

  // Copy Project Join Code
  const handleCopyJoinCode = () => {
    if (!activeProject?.joinCode) return;
    navigator.clipboard.writeText(activeProject.joinCode);
    setCopiedJoinCode(true);
    setTimeout(() => setCopiedJoinCode(false), 2000);
  };

  // Profile PIN Verification and Switch
  const handleOpenPinModal = (profile: GeologistUserProfile) => {
    if (activeProfile?.id === profile.id) return;
    setPinModalProfile(profile);
    setEnteredPin('');
    setPinError(null);
  };

  const handleVerifyAndSwitchProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalProfile) return;
    const res = verifyAndSetActiveProfile(pinModalProfile.id, enteredPin);
    if (res.success && res.profile) {
      setActiveProfile(res.profile);
      if (onActiveProfileChanged) onActiveProfileChanged(res.profile);
      setPinModalProfile(null);
      setEnteredPin('');
      setStatusMessage({
        text: `Active geologist switched to ${res.profile.name} (${res.profile.role})`,
        type: 'success',
      });
    } else {
      setPinError(res.error || 'Incorrect PIN code');
    }
  };

  // Signature Canvas Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawingSignature(true);
    setHasDrawnStroke(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0284c7'; // crisp geological blueprint ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const drawStroke = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingSignature) return;
    setIsDrawingSignature(false);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setProfileFormSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnStroke(false);
    setProfileFormSignatureDataUrl('');
  };

  // Upload PNG Signature File
  const handleUploadSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('png') && !file.type.includes('image')) {
      setStatusMessage({ text: 'Please upload a transparent PNG image', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setProfileFormSignatureDataUrl(dataUrl);
        setStatusMessage({ text: 'Signature PNG loaded successfully!', type: 'success' });
      }
    };
    reader.readAsDataURL(file);
  };

  // Save New Profile
  const handleSaveNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFormName.trim()) {
      setStatusMessage({ text: 'Please enter the geologist name', type: 'error' });
      return;
    }
    const newProf = saveGeologistUserProfile({
      name: profileFormName,
      role: profileFormRole,
      designation: profileFormDesignation || `${profileFormRole} Geologist`,
      pin: profileFormPin,
      pngSignatureDataUrl: profileFormSignatureDataUrl || undefined,
    });

    setProfiles(getStoredGeologistProfiles());
    setActiveProfile(newProf);
    if (onActiveProfileChanged) onActiveProfileChanged(newProf);

    setShowAddProfileForm(false);
    setProfileFormName('');
    setProfileFormDesignation('');
    setProfileFormPin('1234');
    setProfileFormSignatureDataUrl('');
    setStatusMessage({
      text: `Profile "${newProf.name}" registered and activated!`,
      type: 'success',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[94vh] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===================== MODAL TOP BAR ===================== */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  ESWA Global Settings & Collaboration Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Google Account • Device ID • Project Sync • PIN User Switcher • PNG Signatures
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggleButton compact />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close Settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================== STATUS TOAST ===================== */}
        {statusMessage && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/80 border-rose-800/80 text-rose-300'
                : 'bg-sky-950/80 border-sky-800/80 text-sky-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4" />}
              {statusMessage.type === 'info' && <HelpCircle className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ×
            </button>
          </div>
        )}

        {/* ===================== NAVIGATION TABS ===================== */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 bg-slate-900/40 border-b border-slate-800/70 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'account'
                ? 'border-orange-500 text-orange-400 bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Account & Device ID</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {deviceInfo.deviceId}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'projects'
                ? 'border-orange-500 text-orange-400 bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Projects & Multi-Device Sync</span>
            {activeProject && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {activeProject.joinCode}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'profiles'
                ? 'border-orange-500 text-orange-400 bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Geologist Profiles & PNG Signatures</span>
            {activeProfile && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  activeProfile.role === 'Contractor'
                    ? 'bg-amber-500/20 text-amber-300'
                    : activeProfile.role === 'PMC'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {activeProfile.name.split(' ')[0]}
              </span>
            )}
          </button>
        </div>

        {/* ===================== TAB BODY ===================== */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ==================== TAB 1: ACCOUNT & DEVICE ID ==================== */}
          {activeTab === 'account' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Google Account Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Google User'}
                        className="w-12 h-12 rounded-full border-2 border-orange-500 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          {currentUser ? currentUser.displayName || 'Signed In Engineer' : 'Google Account Sync'}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            currentUser
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {currentUser ? 'Cloud Sync Active' : 'Offline / Local Only'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {currentUser?.email ||
                          'Sign in to sync excavation logs, face reports, and team reviews across mobile and PC devices.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={handleGoogleLogout}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-2 shadow transition-all cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5 text-orange-600" />
                        <span>Sign in with Google</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Hardware Device ID Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Field Tablet / Device Hardware Identity</h3>
                      <p className="text-xs text-slate-400">
                        This unique hardware code identifies this device for peer-to-peer data transfers and project allocations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    {isOnline ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Wifi className="w-3.5 h-3.5" /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <WifiOff className="w-3.5 h-3.5" /> Offline
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Device ID display */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Your Unique Device ID
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xl sm:text-2xl font-black text-orange-400 tracking-wider">
                          {deviceInfo.deviceId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyDeviceId}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copy Device ID"
                        >
                          {copiedDeviceId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Share this Device ID with your Project Administrator (Contractor / PMC / Client) to whitelist this device.
                    </p>
                  </div>

                  {/* Device Nickname editor */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Device Nickname / Station Alias
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={aliasInput}
                          onChange={(e) => setAliasInput(e.target.value)}
                          placeholder="e.g. Face Tablet #01 (North Portal)"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                        <button
                          type="button"
                          onClick={handleSaveAlias}
                          disabled={savingAlias}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingAlias ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Helps team members recognize this device in review logs and transfer notifications.
                    </p>
                  </div>
                </div>
              </div>

              {/* Local Storage & Connectivity Info */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Offline Resilience: All maps, sketches, and logs are automatically cached in local storage for 100% offline tunnel face mapping.
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 shrink-0">
                  Storage Engine: IndexedDB + LocalStorage
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: PROJECTS & MULTI-DEVICE SYNC ==================== */}
          {activeTab === 'projects' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Active Project Banner */}
              {activeProject ? (
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border-2 border-orange-500/40 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-slate-950">
                          Active Shared Project
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          {activeProject.projectName}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                        <span>📍 {activeProject.tunnelLocation}</span>
                        {activeProject.chainageBounds && (
                          <span className="font-mono text-slate-400">• {activeProject.chainageBounds}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">6-Char Join Code:</span>
                        <span className="font-mono text-base font-black text-amber-400 tracking-wider">
                          {activeProject.joinCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyJoinCode}
                          className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Copy Join Code"
                        >
                          {copiedJoinCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const code = prompt(
                            'Share this 6-Character Project Join Code with Contractor, PMC, or Client engineers:\n\n' +
                              activeProject.joinCode +
                              '\n\nThey can enter this code in Settings -> Projects -> Join Project to sync.'
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Sync status pills */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>
                        Contractor Devices: <strong className="text-white">{activeProject.contractorDevices?.length || 0}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        PMC Devices: <strong className="text-white">{activeProject.pmcDevices?.length || 0}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Client Devices: <strong className="text-white">{activeProject.clientDevices?.length || 0}</strong>
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Last Synced: {new Date(activeProject.lastSyncTimestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-6 text-center">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No Shared Project Connected</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Join an existing excavation project using a 6-character code, or create a new project and invite Contractor, PMC, and Client devices.
                  </p>
                </div>
              )}

              {/* Two Column Layout: Join by Code vs Create Project */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Join Project by 6-Char Code */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <KeyRound className="w-4 h-4 text-orange-400" />
                      <h4 className="text-sm font-bold text-white">Join Existing Project</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Enter the 6-character Project Join Code provided by the Project Lead or Resident Engineer.
                    </p>
                  </div>

                  <form onSubmit={handleJoinProject} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        6-Character Project Code
                      </label>
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="e.g. TN9481"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-amber-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Your Organization Role
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['Contractor', 'PMC', 'Client'] as ProjectOrganizationRole[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setJoinRoleInput(r)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              joinRoleInput === r
                                ? r === 'Contractor'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                  : r === 'PMC'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isJoiningProject}
                      className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      {isJoiningProject ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Join & Sync Project</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* 2. Create New Shared Project */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FolderPlus className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-white">Create New Project</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Creates a synchronized project database and generates a unique 6-character Join Code.
                    </p>
                  </div>

                  <form onSubmit={handleCreateProject} className="space-y-2.5">
                    <div>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Project Name (e.g. Rohtang Tunnel Link)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newTunnelLocation}
                        onChange={(e) => setNewTunnelLocation(e.target.value)}
                        placeholder="Tunnel Location / Adit (e.g. South Portal Heading 1)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Contractor', 'PMC', 'Client'] as ProjectOrganizationRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNewCreatorRole(r)}
                          className={`py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            newCreatorRole === r
                              ? 'bg-slate-800 text-orange-400 border-orange-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          As {r}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingProject}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      {isCreatingProject ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Project...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Project & Get Join Code</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Team Device Allocation Management (Contractor, PMC, Client) */}
              {activeProject && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-400" />
                        <span>Allocate Team Devices (Contractor, PMC, Client)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Whitelist remote tablets or workstations by Device ID into their organizational group.
                      </p>
                    </div>
                  </div>

                  {/* Allocate Device Form */}
                  <form onSubmit={handleAllocateDevice} className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Target Device ID
                      </label>
                      <input
                        type="text"
                        value={allocDeviceId}
                        onChange={(e) => setAllocDeviceId(e.target.value.toUpperCase())}
                        placeholder="e.g. ESWA-8F2"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Station Nickname
                      </label>
                      <input
                        type="text"
                        value={allocAlias}
                        onChange={(e) => setAllocAlias(e.target.value)}
                        placeholder="e.g. PMC Lead Reviewer"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Role Group
                      </label>
                      <select
                        value={allocRole}
                        onChange={(e) => setAllocRole(e.target.value as ProjectOrganizationRole)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="Contractor">Contractor (Face Mapping)</option>
                        <option value="PMC">PMC (Consultant Review)</option>
                        <option value="Client">Client (Owner Sign-off)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isAllocatingDevice}
                        className="w-full py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Allocate</span>
                      </button>
                    </div>
                  </form>

                  {/* 3 Role Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* Contractor Devices */}
                    <div className="bg-slate-950/80 border border-amber-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Contractor
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300">
                          {activeProject.contractorDevices?.length || 0}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(activeProject.contractorDevices || []).length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-2 text-center">No devices added</p>
                        ) : (
                          activeProject.contractorDevices.map((d) => (
                            <div
                              key={d.deviceId}
                              className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-white">{d.deviceId}</div>
                                <div className="text-[10px] text-slate-400">{d.alias || 'Contractor Station'}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDevice(d.deviceId)}
                                className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                title="Remove device"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* PMC Devices */}
                    <div className="bg-slate-950/80 border border-blue-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-500/20">
                        <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> PMC / Consultant
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300">
                          {activeProject.pmcDevices?.length || 0}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(activeProject.pmcDevices || []).length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-2 text-center">No devices added</p>
                        ) : (
                          activeProject.pmcDevices.map((d) => (
                            <div
                              key={d.deviceId}
                              className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-white">{d.deviceId}</div>
                                <div className="text-[10px] text-slate-400">{d.alias || 'PMC Station'}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDevice(d.deviceId)}
                                className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                title="Remove device"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Client Devices */}
                    <div className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Client / Owner
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300">
                          {activeProject.clientDevices?.length || 0}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(activeProject.clientDevices || []).length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-2 text-center">No devices added</p>
                        ) : (
                          activeProject.clientDevices.map((d) => (
                            <div
                              key={d.deviceId}
                              className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-white">{d.deviceId}</div>
                                <div className="text-[10px] text-slate-400">{d.alias || 'Client Station'}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDevice(d.deviceId)}
                                className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                title="Remove device"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: GEOLOGIST PROFILES & PNG SIGNATURES ==================== */}
          {activeTab === 'profiles' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Active Profile Banner */}
              {activeProfile && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md ${
                        activeProfile.role === 'Contractor'
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                          : activeProfile.role === 'PMC'
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      }`}
                    >
                      {activeProfile.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Active User on this Device:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            activeProfile.role === 'Contractor'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : activeProfile.role === 'PMC'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {activeProfile.role}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white">{activeProfile.name}</h3>
                      <p className="text-xs text-slate-400">{activeProfile.designation}</p>
                    </div>
                  </div>

                  {/* Active Signature Preview */}
                  <div className="flex items-center gap-3">
                    <div className="bg-white/95 rounded-lg p-2 border border-slate-300 shadow-inner flex flex-col items-center justify-center min-w-[140px] h-14">
                      {activeProfile.pngSignatureDataUrl ? (
                        <img
                          src={activeProfile.pngSignatureDataUrl}
                          alt="Digital Signature"
                          className="max-h-10 max-w-[130px] object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 italic">No signature file</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddProfileForm(true)}
                      className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Geologist</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Shared Device User Switcher List */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-orange-400" />
                      <span>Switch Active Geologist (PIN Protected)</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      When multiple engineers share this tablet across shifts, select a profile and enter your 4-digit PIN to switch.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {profiles.map((p) => {
                    const isActive = activeProfile?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-3 ${
                          isActive
                            ? 'bg-slate-850 border-orange-500/80 shadow-md ring-1 ring-orange-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold ${
                                p.role === 'Contractor'
                                  ? 'bg-amber-600'
                                  : p.role === 'PMC'
                                  ? 'bg-blue-600'
                                  : 'bg-emerald-600'
                              }`}
                            >
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white line-clamp-1">{p.name}</h5>
                              <span
                                className={`text-[10px] font-semibold ${
                                  p.role === 'Contractor'
                                    ? 'text-amber-400'
                                    : p.role === 'PMC'
                                    ? 'text-blue-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {p.role}
                              </span>
                            </div>
                          </div>

                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500 text-slate-950 uppercase">
                              Active
                            </span>
                          )}
                        </div>

                        {/* Signature Preview thumbnail */}
                        <div className="bg-white/95 rounded px-2 py-1 flex items-center justify-center h-8 border border-slate-300">
                          {p.pngSignatureDataUrl ? (
                            <img
                              src={p.pngSignatureDataUrl}
                              alt="Signature"
                              className="max-h-6 max-w-[120px] object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-slate-400 font-mono">No Signature PNG</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-850">
                          <span className="text-[10px] font-mono text-slate-500">
                            PIN: {p.pin ? '••••' : 'None'}
                          </span>
                          {isActive ? (
                            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Using Now
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenPinModal(p)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Switch</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add / Register Geologist Profile Form */}
              {showAddProfileForm && (
                <div className="bg-slate-900 border-2 border-orange-500/50 rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-orange-400" />
                      <span>Register Geologist Profile & Digital Signature</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddProfileForm(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSaveNewProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={profileFormName}
                          onChange={(e) => setProfileFormName(e.target.value)}
                          placeholder="e.g. Anand K. Verma"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={profileFormDesignation}
                          onChange={(e) => setProfileFormDesignation(e.target.value)}
                          placeholder="e.g. Lead Geologist"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Organization Role *
                        </label>
                        <select
                          value={profileFormRole}
                          onChange={(e) => setProfileFormRole(e.target.value as ProjectOrganizationRole)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                        >
                          <option value="Contractor">Contractor</option>
                          <option value="PMC">PMC / Consultant</option>
                          <option value="Client">Client / Owner</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          4-Digit Security PIN (for device sharing) *
                        </label>
                        <input
                          type="password"
                          maxLength={6}
                          value={profileFormPin}
                          onChange={(e) => setProfileFormPin(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="1234"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-center tracking-widest text-amber-300 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                          Upload Transparent PNG Signature File
                        </label>
                        <input
                          type="file"
                          accept="image/png,image/*"
                          onChange={handleUploadSignatureFile}
                          className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Interactive Touch / Stylus Signature Pad */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <PenTool className="w-3.5 h-3.5 text-orange-400" />
                          <span>Or Draw Digital Signature (Stylus / Finger)</span>
                        </label>
                        <button
                          type="button"
                          onClick={clearSignatureCanvas}
                          className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          Clear Ink
                        </button>
                      </div>

                      <div className="w-full h-24 bg-white rounded-lg border border-slate-300 relative overflow-hidden touch-none flex items-center justify-center">
                        <canvas
                          ref={signatureCanvasRef}
                          width={480}
                          height={120}
                          className="w-full h-full cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={drawStroke}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={drawStroke}
                          onTouchEnd={stopDrawing}
                        />
                        {!hasDrawnStroke && !profileFormSignatureDataUrl && (
                          <div className="absolute pointer-events-none text-slate-400 text-xs font-mono">
                            ✍ Sign here with stylus or finger
                          </div>
                        )}
                      </div>

                      {profileFormSignatureDataUrl && (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Transparent PNG signature ready to stamp on official sheets</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProfileForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow cursor-pointer"
                      >
                        Save & Activate Profile
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================== PIN PROMPT MODAL ===================== */}
        {pinModalProfile && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Enter 4-Digit Security PIN</h4>
                    <p className="text-[11px] text-slate-400">Switching to {pinModalProfile.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPinModalProfile(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleVerifyAndSwitchProfile} className="space-y-4">
                <div>
                  <input
                    type="password"
                    autoFocus
                    maxLength={6}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value.replace(/[^0-9]/g, ''));
                      setPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono text-2xl tracking-[0.5em] text-amber-300 focus:outline-none focus:border-orange-500"
                  />
                  {pinError && (
                    <p className="text-xs text-rose-400 text-center mt-1.5 font-medium">{pinError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPinModalProfile(null)}
                    className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm & Switch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
