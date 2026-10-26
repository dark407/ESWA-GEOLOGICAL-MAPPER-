// ============================================================================
// ESWA UNDERGROUND MINING & EXPLORATION — MAIN WINDOW
// Built to match the high-grade NATM and TBM Welcome Windows:
// Top bar with Google Login, Reviews & Device ID (Isolated to Mining), Settings
// Main Window with 3 Primary Pillars:
// 1. Underground Mining Mapping (with Resume)
// 2. Exploration & Production Core Logging (with Resume)
// 3. Mining Data & Storage / Vault
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Pickaxe,
  Layers,
  Database,
  ArrowRight,
  Play,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  RefreshCw,
  Settings,
  Shield,
  CheckCircle2,
  HardDrive,
  Download,
  FolderOpen,
  Box,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo, playEswaWelcomeChime } from '../EswaBrandIdentity';
import { ThemeToggleButton, useTheme } from '../../context/ThemeContext';
import { IndustryMode } from '../../types/tunnel';
import { GoogleUserAccountInfo, GeologistUserProfile } from '../../engine/userCloudAndPackageEngine';
import { DeviceIdAndNotificationHeaderWidget } from '../DeviceIdReviewAndNotificationCenter';
import {
  loadMiningProjects,
  loadMiningStopes,
  loadMiningDrillHoles,
  getActiveMiningProjectId,
  getActiveMiningStopeId,
  getActiveMiningDrillHoleId,
} from '../../engine/miningStorageEngine';
import { MiningDataStorageModal } from './MiningDataStorageModal';
import { MiningMappingWorkspace } from './MiningMappingWorkspace';
import { MiningCoreLoggingWorkspace } from './MiningCoreLoggingWorkspace';
import { MiningFaceSetupWizard } from './MiningFaceSetupWizard';

export interface MiningMainWindowProps {
  industryMode: IndustryMode;
  onChangeIndustryMode: (mode: IndustryMode) => void;
  googleUser?: GoogleUserAccountInfo | null;
  activeGeologist?: GeologistUserProfile | null;
  onOpenGlobalSettings: () => void;
  onOpenContinuousTunnelLog?: () => void;
  onOpenCoreLogging?: () => void;
  isAuthBusy?: boolean;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
}

export const MiningMainWindow: React.FC<MiningMainWindowProps> = React.memo(({
  industryMode,
  onChangeIndustryMode,
  googleUser,
  activeGeologist,
  onOpenGlobalSettings,
  onOpenContinuousTunnelLog,
  onOpenCoreLogging,
  isAuthBusy = false,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [activeMiningView, setActiveMiningView] = useState<'MAIN' | 'MAPPING' | 'CORE_LOGGING'>('MAIN');
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isFaceWizardOpen, setIsFaceWizardOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { palette } = useTheme();

  // Load isolated Mining state
  const projects = useMemo(() => loadMiningProjects(), [activeMiningView, isStorageModalOpen]);
  const stopes = useMemo(() => loadMiningStopes(), [activeMiningView, isStorageModalOpen]);
  const drillHoles = useMemo(() => loadMiningDrillHoles(), [activeMiningView, isStorageModalOpen]);

  const activeProjId = getActiveMiningProjectId() || projects[0]?.id;
  const activeStopeId = getActiveMiningStopeId() || stopes[0]?.id;
  const activeDrillHoleId = getActiveMiningDrillHoleId() || drillHoles[0]?.id;

  const currentProject = projects.find((p) => p.id === activeProjId) || projects[0];
  const currentStope = stopes.find((s) => s.id === activeStopeId) || stopes[0];
  const currentDrillHole = drillHoles.find((h) => h.id === activeDrillHoleId) || drillHoles[0];

  // If Underground Mining Mapping workspace is active:
  if (activeMiningView === 'MAPPING') {
    return (
      <MiningMappingWorkspace
        onBackToMainWindow={() => setActiveMiningView('MAIN')}
        onChangeIndustryMode={onChangeIndustryMode}
      />
    );
  }

  // If Exploration & Production Core Logging workspace is active:
  if (activeMiningView === 'CORE_LOGGING') {
    return (
      <MiningCoreLoggingWorkspace
        onBackToMainWindow={() => setActiveMiningView('MAIN')}
        onChangeIndustryMode={onChangeIndustryMode}
      />
    );
  }

  return (
    <main
      className="min-h-dvh h-dvh w-full flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden no-scrollbar mouse-scrollable p-2 sm:p-4 select-none"
      style={{
        backgroundColor: '#030712',
        color: '#F8FAFC',
      }}
    >
      {/* Background Graphic Watermark */}
      <EswaAppBackgroundWatermark visible showLogoWatermark={true} />

      {/* Top-Left Mode Indicator & Switcher (NATM | TBM | MINING) */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-6 flex items-center gap-2 z-20">
        <div
          className="flex items-center p-0.5 rounded-xl bg-slate-900/90 backdrop-blur-md shadow-lg border border-amber-500/40"
        >
          {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
            const isAct = industryMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChangeIndustryMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isAct
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={
                  m === 'NATM'
                    ? 'NATM: New Austrian Tunnelling Method / Conventional D&B'
                    : m === 'TBM'
                    ? 'TBM: Shield Tunnel Boring Machine Suite'
                    : 'MINING: Underground Hardrock Mining Stope & Grade Control'
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top-Right Header: Google Login ID, ISOLATED Reviews/Device ID, Settings */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-6 flex flex-wrap items-center justify-end gap-2 z-20">
        {/* Google Email Login & Cloud Workspace Sync */}
        <div className="relative">
          {googleUser ? (
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/90 border border-amber-500/30 text-amber-300 hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              title={`Logged in as ${googleUser.email}`}
            >
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="truncate max-w-[120px] font-mono">{googleUser.email.split('@')[0]}</span>
              <Cloud className="w-3 h-3 text-emerald-400" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isAuthBusy}
              onClick={onGoogleSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Sign in with Google"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isAuthBusy ? 'Connecting...' : 'Sign In'}</span>
            </button>
          )}

          {/* Account Dropdown */}
          {isAccountMenuOpen && googleUser && (
            <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 space-y-2 z-50 text-xs font-mono">
              <div className="pb-2 border-b border-slate-800">
                <p className="font-bold text-slate-200 truncate">{googleUser.displayName || 'Mining Geologist'}</p>
                <p className="text-[11px] text-slate-400 truncate">{googleUser.email}</p>
              </div>

              {onGoogleSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onGoogleSignOut();
                    setIsAccountMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ISOLATED MINING REVIEWS, NOTIFICATIONS & DEVICE ID */}
        <DeviceIdAndNotificationHeaderWidget
          onDataImported={() => {
            // refresh data
          }}
        />

        {/* Active Geologist Profile */}
        {activeGeologist && (
          <button
            type="button"
            onClick={onOpenGlobalSettings}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-slate-900/90 text-amber-300 border-amber-500/30 hover:bg-slate-800 transition-all cursor-pointer"
            title={`Active Mine Geologist: ${activeGeologist.name} (${activeGeologist.role})`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold">[{activeGeologist.role}]</span>
            <span className="truncate max-w-[110px]">{activeGeologist.name}</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenGlobalSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900/90 border border-slate-700 hover:border-amber-500 text-slate-200 shadow-sm transition-all cursor-pointer active:scale-95"
          title="Open Global Settings (Default Startup Mode, Device ID, Profiles)"
        >
          <Settings className="w-4 h-4 text-amber-400 hover:rotate-90 transition-transform duration-300" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        <ThemeToggleButton compact />
      </div>

      {/* Main Center Content: Strict 3 Options */}
      <div className="relative z-10 w-full max-w-[650px] my-auto shrink-0 flex flex-col items-center text-center justify-center p-2 sm:p-3 gap-3 sm:gap-4">
        {/* Animated Emblem */}
        <div
          onClick={() => playEswaWelcomeChime(true)}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          title="ESWA Underground Mining & Exploration Suite"
        >
          <EswaTunnelLogo size="xl" variant="emblem" animated showBadge={false} />
        </div>

        {/* 3 PRIMARY MAIN OPTIONS */}
        <div className="w-full space-y-2.5 pt-1">
          {/* OPTION 1: Underground Mining Face Mapping */}
          <div className="w-full">
            <button
              type="button"
              onClick={() => setIsFaceWizardOpen(true)}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-3 bg-slate-900 hover:bg-slate-850 border-2 border-amber-500/60 hover:border-amber-400 transition-all cursor-pointer group shadow-lg shadow-amber-500/10 text-amber-300 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Pickaxe className="w-5 h-5" />
                </div>
                <div className="text-left font-mono">
                  <div className="font-black text-slate-100 text-sm sm:text-base">
                    1. Underground Mining Face Mapping
                  </div>
                </div>
              </span>
              <div className="flex items-center gap-2 bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs shadow-md group-hover:bg-amber-400 transition-colors shrink-0">
                <span>Start / Select Face</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>

          {/* OPTION 2: Exploration & Production Core Logging */}
          <div className="flex items-stretch gap-2 w-full">
            <button
              type="button"
              onClick={() => setActiveMiningView('CORE_LOGGING')}
              className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900 hover:bg-slate-850 border-2 border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer group shadow-lg shadow-cyan-500/10 text-cyan-300"
            >
              <span className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-slate-100">
                    2. Exploration &amp; Production Core Logging
                  </div>
                </div>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0 text-cyan-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Resume Core Logging */}
            <button
              type="button"
              onClick={() => setActiveMiningView('CORE_LOGGING')}
              className="px-4 py-2.5 rounded-xl font-black text-xs font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400"
              title={
                currentDrillHole
                  ? `Resume core logging at ${currentDrillHole.holeId} (${currentDrillHole.coreDiameter} Core)`
                  : 'Resume Core Logging'
              }
            >
              <Play className="w-3.5 h-3.5 fill-slate-950 shrink-0" />
              <span>Resume</span>
            </button>
          </div>

          {/* OPTION 3: Mining Data & Storage / Vault */}
          <div className="w-full">
            <button
              type="button"
              onClick={() => setIsStorageModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-slate-500 transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400">
                  <Database className="w-4 h-4" />
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-slate-200">
                    3. Mining Data &amp; Storage / Vault
                  </div>
                </div>
              </span>
              <span className="text-[11px] font-mono text-amber-400 font-bold group-hover:underline flex items-center gap-1">
                <span>Open Vault</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mining Face Setup Wizard */}
      {isFaceWizardOpen && (
        <MiningFaceSetupWizard
          onCancel={() => setIsFaceWizardOpen(false)}
          onEnterFaceMapping={(newStope) => {
            setIsFaceWizardOpen(false);
            setActiveMiningView('MAPPING');
          }}
          initialStope={currentStope}
        />
      )}

      {/* Mining Data & Storage Modal */}
      <MiningDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />
    </main>
  );
});
MiningMainWindow.displayName = 'MiningMainWindow';
