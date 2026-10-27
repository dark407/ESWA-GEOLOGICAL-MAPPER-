import React from 'react';
import {
  ArrowRight,
  Cloud,
  Compass,
  Database,
  FileSpreadsheet,
  Layers,
  LogIn,
  LogOut,
  Mountain,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import {
  IndustryMode,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
} from '../../types/tunnel';
import {
  GeologistUserProfile,
  GoogleUserAccountInfo,
  loadFieldMappingResumeState,
  loadPhotogrammetryResumeState,
  pullUserWorkspaceFromCloud,
  signInWithGoogleAccount,
  signOutGoogleAccount,
  syncUserWorkspaceToCloud,
} from '../../engine/userCloudAndPackageEngine';
import {
  loadSavedDesignGeometries,
  loadSavedProjectsFromMemory,
} from '../../engine/projectMemoryEngine';
import {
  MappingDomainType,
  SurfaceMappingSubType,
  loadSurfaceMappingResumeState,
} from '../../engine/surfaceMappingEngine';
import { DataStorageTabId } from '../OverbreakAndProjectMemoryPanel';
import {
  EswaAppBackgroundWatermark,
  EswaLoadingScreen,
  EswaTunnelLogo,
  playEswaWelcomeChime,
} from '../EswaBrandIdentity';
import { DeviceIdAndNotificationHeaderWidget } from '../DeviceIdReviewAndNotificationCenter';
import { ThemeToggleButton } from '../../context/ThemeContext';

export interface WelcomeScreenProps {
  industryMode: IndustryMode;
  handleSwitchIndustryMode: (m: IndustryMode) => void;
  palette: {
    primaryHex: string;
    onBaseTextColor: string;
    buttonTextColor: string;
    accentIconColor: string;
    accentColorOnLight: string;
    isLightBg: boolean;
    accentHex: string;
  };
  isContinuous3DLoggerOpen: boolean;
  isProjectMemoryModalOpen: boolean;
  googleUser: GoogleUserAccountInfo | null;
  isAccountMenuOpen: boolean;
  setIsAccountMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAuthBusy: boolean;
  setIsAuthBusy: (b: boolean) => void;
  cloudSyncStatus: string;
  setCloudSyncStatus: (msg: string) => void;
  setGoogleUser: (user: GoogleUserAccountInfo | null) => void;
  setSavedProjects: (p: SavedProjectRecord[]) => void;
  setSavedGeometries: (g: SavedDesignGeometryRecord[]) => void;
  setIsGlobalSettingsOpen: (v: boolean) => void;
  activeGeologist: GeologistUserProfile | null;
  isMasterSoftware?: boolean;
  onOpenAdminPortal?: () => void;
  pendingRequestCount: number;
  responsive: {
    isMobile: boolean;
    isTouchDevice: boolean;
    isShortLandscape?: boolean;
    isCompactHeight?: boolean;
  };
  setIsFirstOpening: (v: boolean) => void;
  handleSwitchMappingDomain: (domain: MappingDomainType) => void;
  setActiveFieldWorkflowMode: (mode: any) => void;
  setResumeFieldAtLastStage: (v: boolean) => void;
  setIsFieldMappingModeOpen: (v: boolean) => void;
  setIsCoreLoggingOpen: (v: boolean) => void;
  selectedSurfaceSubType: SurfaceMappingSubType;
  setSelectedSurfaceSubType: (v: SurfaceMappingSubType) => void;
  setIsContinuousLogSetupOpen: (v: boolean) => void;
  handleOpenProjectMemoryModal: (tab: DataStorageTabId) => void;
  isBootLoading: boolean;
  setIsBootLoading: (v: boolean) => void;
  projectMemoryModalNode?: React.ReactNode;
  natmRockMechanicsModalNode?: React.ReactNode;
  welcomeAiChatbotNode?: React.ReactNode;
  continuousLoggingModalsNode?: React.ReactNode;
  globalSettingsModalNode?: React.ReactNode;
  modeSwitchConfirmationModalNode?: React.ReactNode;
  bottomThreeTogglesNode?: React.ReactNode;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  industryMode,
  handleSwitchIndustryMode,
  palette,
  isContinuous3DLoggerOpen,
  isProjectMemoryModalOpen,
  googleUser,
  isAccountMenuOpen,
  setIsAccountMenuOpen,
  isAuthBusy,
  setIsAuthBusy,
  cloudSyncStatus,
  setCloudSyncStatus,
  setGoogleUser,
  setSavedProjects,
  setSavedGeometries,
  setIsGlobalSettingsOpen,
  activeGeologist,
  isMasterSoftware,
  onOpenAdminPortal,
  pendingRequestCount,
  responsive,
  setIsFirstOpening,
  handleSwitchMappingDomain,
  setActiveFieldWorkflowMode,
  setResumeFieldAtLastStage,
  setIsFieldMappingModeOpen,
  setIsCoreLoggingOpen,
  selectedSurfaceSubType,
  setSelectedSurfaceSubType,
  setIsContinuousLogSetupOpen,
  handleOpenProjectMemoryModal,
  isBootLoading,
  setIsBootLoading,
  projectMemoryModalNode,
  natmRockMechanicsModalNode,
  welcomeAiChatbotNode,
  continuousLoggingModalsNode,
  globalSettingsModalNode,
  modeSwitchConfirmationModalNode,
  bottomThreeTogglesNode,
}) => {
  const fieldResumeMeta = loadFieldMappingResumeState('TUNNEL');
  const surfaceResumeMeta = loadSurfaceMappingResumeState();

  return (
    <main
      className="min-h-dvh h-dvh w-full flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden no-scrollbar mouse-scrollable p-2 sm:p-4 select-none"
      style={{
        backgroundColor: palette.primaryHex,
        color: palette.onBaseTextColor,
      }}
    >
      {/* Dynamic Theme Color Geological Map Backdrop with minute opacity logo */}
      <EswaAppBackgroundWatermark visible showLogoWatermark={true} />

      {/* Top-Left Mode Indicator & Switcher on Welcome Screen */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-6 flex items-center gap-2 z-20">
        <div className="flex items-center p-0.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 shadow-md">
          {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
            const isAct = industryMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSwitchIndustryMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isAct ? 'font-black shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                style={{
                  backgroundColor: isAct
                    ? m === 'NATM'
                      ? palette.primaryHex
                      : m === 'TBM'
                      ? '#06B6D4'
                      : '#10B981'
                    : undefined,
                  color: isAct
                    ? m === 'NATM'
                      ? palette.buttonTextColor
                      : '#020617'
                    : undefined,
                }}
                title={
                  m === 'NATM'
                    ? 'NATM: New Austrian Tunnelling Method / Conventional D&B'
                    : m === 'TBM'
                    ? 'TBM: Shield Tunnel Boring Machine'
                    : 'MINING: Underground Hardrock Mining Stope & Grade Control'
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top-Right Controls: Google Email Login & Master Software Access Control */}
      {!isContinuous3DLoggerOpen && !isProjectMemoryModalOpen && (
        <div className="absolute top-3 right-3 sm:top-5 sm:right-6 flex flex-wrap items-center justify-end gap-2 z-20">
          {/* Google Email Login & Cloud Workspace Sync */}
          <div className="relative">
            {googleUser ? (
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer text-xs font-semibold"
                style={{
                  borderColor: palette.primaryHex + '50',
                }}
                title={`Signed in as ${googleUser.email}. Click to sync or manage your ESWA account & data.`}
              >
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName}
                    className="w-4 h-4 rounded-full object-cover border"
                    style={{ borderColor: palette.primaryHex + '60' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" style={{ color: palette.accentIconColor }} />
                )}
                <span className="max-w-[140px] sm:max-w-[190px] truncate">
                  {googleUser.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isAuthBusy}
                onClick={async () => {
                  setIsAuthBusy(true);
                  const res = await signInWithGoogleAccount();
                  setIsAuthBusy(false);
                  if (res.user) {
                    setGoogleUser(res.user);
                    setSavedProjects(loadSavedProjectsFromMemory());
                    setSavedGeometries(loadSavedDesignGeometries());
                    setCloudSyncStatus('Signed in & loaded your account data');
                  } else if (res.error) {
                    setCloudSyncStatus(res.error);
                    setIsGlobalSettingsOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer text-xs font-semibold whitespace-nowrap active:scale-95"
                style={{
                  borderColor: palette.primaryHex + '50',
                }}
                title="Sign in with your Google Email to access and sync your ESWA Tunnel Mapper app & data"
              >
                <LogIn
                  className={`w-3.5 h-3.5 ${isAuthBusy ? 'animate-spin' : ''}`}
                  style={{ color: palette.accentIconColor }}
                />
                <span>{isAuthBusy ? 'Signing in...' : 'Google Login'}</span>
              </button>
            )}

            {googleUser && isAccountMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-72 rounded-xl border bg-white shadow-xl p-3 text-left z-30 space-y-2.5"
                style={{ borderColor: palette.primaryHex + '40' }}
              >
                <div
                  className="flex items-center gap-2.5 pb-2 border-b"
                  style={{ borderColor: palette.primaryHex + '25' }}
                >
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName}
                      className="w-8 h-8 rounded-full object-cover border"
                      style={{ borderColor: palette.primaryHex + '60' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{
                        backgroundColor: palette.primaryHex + '20',
                        color: palette.accentColorOnLight,
                      }}
                    >
                      {(googleUser.email || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-stone-900 truncate">
                      {googleUser.displayName}
                    </div>
                    <div className="text-[11px] font-mono text-stone-600 truncate">
                      {googleUser.email}
                    </div>
                  </div>
                </div>

                {cloudSyncStatus && (
                  <div
                    className="text-[10px] font-mono px-2 py-1 rounded border"
                    style={{
                      backgroundColor: palette.primaryHex + '15',
                      borderColor: palette.primaryHex + '35',
                      color: palette.isLightBg ? '#0F172A' : '#1E293B',
                    }}
                  >
                    {cloudSyncStatus}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={isAuthBusy}
                    onClick={async () => {
                      setIsAuthBusy(true);
                      const res = await syncUserWorkspaceToCloud();
                      setIsAuthBusy(false);
                      setCloudSyncStatus(res.message);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                    style={{
                      backgroundColor: palette.primaryHex,
                      color: palette.buttonTextColor,
                    }}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Save to Cloud</span>
                  </button>
                  <button
                    type="button"
                    disabled={isAuthBusy}
                    onClick={async () => {
                      setIsAuthBusy(true);
                      const res = await pullUserWorkspaceFromCloud();
                      setIsAuthBusy(false);
                      if (res.pulled) {
                        setSavedProjects(loadSavedProjectsFromMemory());
                        setSavedGeometries(loadSavedDesignGeometries());
                        setCloudSyncStatus('Loaded workspace from Google Cloud');
                      } else {
                        setCloudSyncStatus('No cloud backup found yet');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '15',
                      borderColor: palette.primaryHex + '40',
                      color: palette.isLightBg ? '#0F172A' : '#1C130E',
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Load Cloud</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await signOutGoogleAccount();
                    setGoogleUser(null);
                    setIsAccountMenuOpen(false);
                    setCloudSyncStatus('');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          <DeviceIdAndNotificationHeaderWidget
            onDataImported={() => {
              setSavedProjects(loadSavedProjectsFromMemory());
              setSavedGeometries(loadSavedDesignGeometries());
            }}
          />

          {/* Top Header Settings Gear & Active Geologist Profile Pill */}
          <div className="flex items-center gap-1.5">
            {activeGeologist && (
              <button
                type="button"
                onClick={() => setIsGlobalSettingsOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer bg-white/95 text-stone-900"
                style={{ borderColor: palette.primaryHex + '40' }}
                title={`Active Geologist: ${activeGeologist.name} (${activeGeologist.role}) - Click to switch profile`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold">[{activeGeologist.role}]</span>
                <span className="truncate max-w-[110px]">{activeGeologist.name}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsGlobalSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/95 border text-slate-800 shadow-sm transition-all cursor-pointer active:scale-95"
              style={{ borderColor: palette.primaryHex + '45' }}
              title="Open Global Settings (Google Account, Device ID, Multi-Device Project Sync, Geologist Profiles & Signatures)"
            >
              <Settings
                className="w-4 h-4 hover:rotate-90 transition-transform duration-300"
                style={{ color: palette.accentIconColor }}
              />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>

          <ThemeToggleButton compact />
          {isMasterSoftware && onOpenAdminPortal && (
            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                onOpenAdminPortal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              style={{ borderColor: palette.primaryHex + '50' }}
              title="Open Software Access Control (Master Admin) to manage PC & Mobile App user requests"
            >
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: palette.accentIconColor }} />
              <span>Software Access Control</span>
              {pendingRequestCount > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.2 rounded-full font-bold text-[10px]"
                  style={{ backgroundColor: palette.primaryHex, color: palette.buttonTextColor }}
                >
                  {pendingRequestCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      <div className="relative z-10 w-full max-w-[650px] my-auto shrink-0 flex flex-col items-center text-center justify-center p-2 sm:p-3 gap-2.5 sm:gap-4 eswa-stage-transition">
        <div
          onClick={() => playEswaWelcomeChime(true)}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          title="Click to replay ESWA Welcome Chime"
        >
          <EswaTunnelLogo
            size={responsive.isShortLandscape ? 'lg' : responsive.isCompactHeight ? 'xl' : '2xl'}
            variant="emblem"
            animated
            showBadge={false}
          />
        </div>

        {/* Main Window: Core Geological & Geotechnical Suite Options */}
        <div className="w-full space-y-2.5">
          {/* 1. Underground Face Mapping */}
          <div className="flex items-stretch gap-2 w-full">
            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                handleSwitchMappingDomain('TUNNEL');
                setActiveFieldWorkflowMode('field_mapping');
                setResumeFieldAtLastStage(false);
                setIsFieldMappingModeOpen(true);
              }}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
              style={{
                borderColor: palette.primaryHex,
              }}
            >
              <span className="flex items-center gap-2.5 text-left">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    backgroundColor: palette.primaryHex + '20',
                    color: palette.accentIconColor,
                  }}
                >
                  <Compass className="w-4 h-4 shrink-0" />
                </span>
                <span className="text-black font-extrabold text-sm sm:text-base">
                  Underground Face Mapping
                </span>
              </span>
              <ArrowRight
                className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: palette.accentIconColor }}
              />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                handleSwitchMappingDomain('TUNNEL');
                setResumeFieldAtLastStage(true);
                setIsFieldMappingModeOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
              style={{
                backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                borderColor: palette.accentHex,
                color: palette.isLightBg ? '#FFFFFF' : '#000000',
              }}
              title={
                fieldResumeMeta
                  ? `Resume Underground Face Mapping where you stopped (${fieldResumeMeta.stage})`
                  : 'Resume Underground Face Mapping where you stopped'
              }
            >
              <Play
                className="w-3.5 h-3.5 shrink-0"
                style={{
                  color: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                  fill: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                }}
              />
              <span>Resume</span>
            </button>
          </div>

          {/* 2. Geological & Geotechnical Core Logging */}
          <div className="flex items-stretch gap-2 w-full">
            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                setIsCoreLoggingOpen(true);
              }}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.22)] transition-all cursor-pointer hover:shadow-xl active:scale-99 group"
              style={{
                borderColor: palette.primaryHex,
              }}
            >
              <span className="flex items-center gap-2.5 text-left">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    backgroundColor: palette.primaryHex + '25',
                    color: palette.accentIconColor,
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                </span>
                <span className="text-black font-extrabold text-sm sm:text-base tracking-tight">
                  Geological &amp; Geotechnical Core Logging
                </span>
              </span>
              <ArrowRight
                className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: palette.accentIconColor }}
              />
            </button>
          </div>

          {/* 3. Surface Mapping (Bench, Trench, Slope, Outcrop) */}
          <div
            className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 space-y-2 transition-colors"
            style={{
              borderColor: palette.primaryHex,
            }}
          >
            <div className="flex items-stretch gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  handleSwitchMappingDomain(selectedSurfaceSubType);
                  setActiveFieldWorkflowMode('field_mapping');
                  setResumeFieldAtLastStage(false);
                  setIsFieldMappingModeOpen(true);
                }}
                className="flex-1 py-1 px-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 text-stone-900 transition-all cursor-pointer group"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '20',
                      color: palette.accentIconColor,
                    }}
                  >
                    <Mountain className="w-3.5 h-3.5 shrink-0" />
                  </span>
                  <span className="text-black font-extrabold text-sm sm:text-base">Surface Mapping</span>
                  <span
                    className="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
                    style={{
                      backgroundColor: palette.primaryHex + '25',
                      color: palette.accentColorOnLight,
                    }}
                  >
                    {selectedSurfaceSubType}
                  </span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: palette.accentIconColor }}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  const resumeSubType = surfaceResumeMeta?.subType || selectedSurfaceSubType;
                  setSelectedSurfaceSubType(resumeSubType);
                  handleSwitchMappingDomain(resumeSubType);
                  setActiveFieldWorkflowMode(
                    surfaceResumeMeta?.workflowMode === 'PHOTOGRAMMETRY'
                      ? 'photo_mapping'
                      : 'field_mapping'
                  );
                  setResumeFieldAtLastStage(true);
                  setIsFieldMappingModeOpen(true);
                }}
                className="px-4 py-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.25)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                style={{
                  backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                  borderColor: palette.accentHex,
                  color: palette.isLightBg ? '#FFFFFF' : '#000000',
                }}
                title={
                  surfaceResumeMeta
                    ? `Resume Surface Mapping where you stopped (${surfaceResumeMeta.subType})`
                    : 'Resume Surface Mapping where you stopped'
                }
              >
                <Play
                  className="w-3.5 h-3.5 shrink-0"
                  style={{
                    color: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                    fill: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                  }}
                />
                <span>Resume</span>
              </button>
            </div>
          </div>

          {/* 4. Continuous 3D Tunnel Mapping & Strip CAD Log */}
          <div className="w-full">
            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                setIsContinuousLogSetupOpen(true);
              }}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
              style={{
                borderColor: palette.primaryHex,
              }}
            >
              <span className="flex items-center gap-2.5 text-left">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    backgroundColor: palette.primaryHex + '20',
                    color: palette.accentIconColor,
                  }}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                </span>
                <div>
                  <span className="text-black font-extrabold text-sm sm:text-base block">
                    Continuous 3D Tunnel Log
                  </span>
                  <span className="text-[10px] font-mono text-stone-500 font-normal">
                    Multi-pull 3D unfolded shell &amp; AutoCAD 2026 strip log
                  </span>
                </div>
              </span>
              <span
                className="text-xs font-mono font-bold flex items-center gap-1"
                style={{ color: palette.accentIconColor }}
              >
                <span className="hidden sm:inline">Launch 3D Log</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          {/* 5. Data Storage, Import & Export */}
          <div className="grid grid-cols-1 gap-2.5 w-full">
            <button
              type="button"
              onClick={() => {
                setIsFirstOpening(false);
                handleOpenProjectMemoryModal('field_data');
              }}
              className="w-full py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
              style={{
                borderColor: palette.primaryHex,
              }}
            >
              <span className="flex items-center gap-2.5 text-left">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    backgroundColor: palette.primaryHex + '20',
                    color: palette.accentIconColor,
                  }}
                >
                  <Database className="w-4 h-4 shrink-0" />
                </span>
                <span className="text-black font-extrabold text-sm sm:text-base">
                  Data Storage, Import &amp; Export
                </span>
              </span>
              <ArrowRight
                className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: palette.accentIconColor }}
              />
            </button>
          </div>
        </div>
      </div>

      {isBootLoading && <EswaLoadingScreen onComplete={() => setIsBootLoading(false)} />}
      {projectMemoryModalNode}
      {natmRockMechanicsModalNode}
      {welcomeAiChatbotNode}
      {continuousLoggingModalsNode}
      {globalSettingsModalNode}
      {modeSwitchConfirmationModalNode}
      {bottomThreeTogglesNode}
    </main>
  );
};
