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

      {/* Top-Right Controls: Settings (Google Account, Device ID, Theme Color inside) & Master Software Access Control */}
      {!isContinuous3DLoggerOpen && !isProjectMemoryModalOpen && (
        <div className="absolute top-3 right-3 sm:top-5 sm:right-6 flex flex-wrap items-center justify-end gap-2 z-20">
          <button
            type="button"
            onClick={() => setIsGlobalSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/95 border text-slate-800 shadow-sm transition-all cursor-pointer active:scale-95 hover:bg-stone-50"
            style={{ borderColor: palette.primaryHex + '45' }}
            title="Open Settings (Google Account, Device ID, Theme Colors, Projects & Profiles)"
          >
            <Settings
              className="w-4 h-4 hover:rotate-90 transition-transform duration-300"
              style={{ color: palette.accentIconColor }}
            />
            <span className="font-semibold">Settings</span>
          </button>

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
          className="cursor-pointer transition-transform hover:scale-[1.02] flex flex-col items-center"
          title="Click to replay ESWA Welcome Chime"
        >
          <EswaTunnelLogo
            size={responsive.isShortLandscape ? 'lg' : responsive.isCompactHeight ? 'xl' : '2xl'}
            variant="emblem"
            animated
            showBadge={false}
            isMasterEdition={isMasterSoftware}
          />
        </div>

        {/* Main Window: Core Geological & Geotechnical Suite Options */}
        <div className="w-full space-y-2.5">
          {/* 1. Underground Face Mapping */}
          <div
            className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 transition-colors"
            style={{
              borderColor: palette.primaryHex,
            }}
          >
            <div className="flex items-center justify-between gap-2">
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

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleSwitchMappingDomain('TUNNEL');
                    setActiveFieldWorkflowMode('field_mapping');
                    setResumeFieldAtLastStage(false);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-all cursor-pointer active:scale-95"
                  title="Open Underground Face Mapping (Start Fresh)"
                >
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleSwitchMappingDomain('TUNNEL');
                    setActiveFieldWorkflowMode('field_mapping');
                    setResumeFieldAtLastStage(true);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                  style={{
                    backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                    borderColor: palette.accentHex,
                    color: palette.isLightBg ? '#FFFFFF' : '#000000',
                  }}
                  title={
                    fieldResumeMeta
                      ? `Resume Underground Face Mapping where you stopped (${fieldResumeMeta.stage})`
                      : 'Resume Last Active Underground Face Mapping Session'
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
          </div>

          {/* 2. Geological & Geotechnical Core Logging */}
          <div
            className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 transition-colors"
            style={{
              borderColor: palette.primaryHex,
            }}
          >
            <div className="flex items-center justify-between gap-2">
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

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    setIsCoreLoggingOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-all cursor-pointer active:scale-95"
                  title="Open Core Logging Workspace"
                >
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    setIsCoreLoggingOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                  style={{
                    backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                    borderColor: palette.accentHex,
                    color: palette.isLightBg ? '#FFFFFF' : '#000000',
                  }}
                  title="Resume Active Core Logging Borehole"
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
          </div>

          {/* 3. Surface Mapping (Bench, Trench, Slope, Outcrop) */}
          <div
            className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 space-y-2 transition-colors"
            style={{
              borderColor: palette.primaryHex,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5 text-left">
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

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleSwitchMappingDomain(selectedSurfaceSubType);
                    setActiveFieldWorkflowMode('field_mapping');
                    setResumeFieldAtLastStage(false);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-all cursor-pointer active:scale-95"
                  title="Open Surface Mapping (Start Fresh)"
                >
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleSwitchMappingDomain(selectedSurfaceSubType);
                    setActiveFieldWorkflowMode('field_mapping');
                    setResumeFieldAtLastStage(true);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                  style={{
                    backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                    borderColor: palette.accentHex,
                    color: palette.isLightBg ? '#FFFFFF' : '#000000',
                  }}
                  title={
                    surfaceResumeMeta
                      ? `Resume Surface Mapping where you stopped (${surfaceResumeMeta.stage || 'Active Session'})`
                      : 'Resume Last Active Surface Mapping Session'
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
          </div>

          {/* 4. Continuous 3D Tunnel Mapping & Strip CAD Log */}
          <div
            className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 transition-colors"
            style={{
              borderColor: palette.primaryHex,
            }}
          >
            <div className="flex items-center justify-between gap-2">
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
                <span className="text-black font-extrabold text-sm sm:text-base">
                  Continuous 3D Tunnel Log
                </span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    setIsContinuousLogSetupOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-all cursor-pointer active:scale-95"
                  title="Open Continuous 3D Tunnel Log Setup"
                >
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    setIsContinuousLogSetupOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                  style={{
                    backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                    borderColor: palette.accentHex,
                    color: palette.isLightBg ? '#FFFFFF' : '#000000',
                  }}
                  title="Resume Continuous 3D Tunnel Log"
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

      {isBootLoading && (
        <EswaLoadingScreen
          onComplete={() => setIsBootLoading(false)}
          isMasterEdition={isMasterSoftware}
        />
      )}
      {projectMemoryModalNode}
      {natmRockMechanicsModalNode}
      {continuousLoggingModalsNode}
      {globalSettingsModalNode}
      {modeSwitchConfirmationModalNode}
      {bottomThreeTogglesNode}
    </main>
  );
};
