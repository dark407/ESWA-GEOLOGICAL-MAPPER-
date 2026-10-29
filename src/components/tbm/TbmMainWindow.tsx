// ============================================================================
// ESWA TBM MECHANIZED TUNNELING — MAIN WINDOW
// Built to match the high-grade NATM welcome window:
// Top bar with Google Login, Reviews & Device ID (Isolated to TBM), Settings
// Main Window with ONLY TWO OPTIONS:
// 1. TBM Data Analysis & Engineering Workflow (with Resume button)
// 2. Data & Storage / Import & Export
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  CircleDot,
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
  Layers,
  CheckCircle2,
  HardDrive,
  Download,
  FolderOpen,
  Box,
  MessageSquare,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo, playEswaWelcomeChime } from '../EswaBrandIdentity';
import { ThemeToggleButton, useTheme } from '../../context/ThemeContext';
import { IndustryMode } from '../../types/tunnel';
import { GoogleUserAccountInfo, GeologistUserProfile } from '../../engine/userCloudAndPackageEngine';
import { DeviceIdAndNotificationHeaderWidget } from '../DeviceIdReviewAndNotificationCenter';
import {
  loadTbmProjects,
  loadTbmLocations,
  loadTbmExcavationRecords,
  getActiveTbmProjectId,
  getActiveTbmLocationId,
  getActiveTbmRecordId,
  getDefaultStartupMode,
  setDefaultStartupMode,
} from '../../engine/tbmStorageEngine';
import { TbmDataStorageModal } from './TbmDataStorageModal';
import { TbmWorkflowShell, TbmWorkflowStage } from './TbmWorkflowShell';

interface TbmMainWindowProps {
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
  isMasterSoftware?: boolean;
  onOpenFeedback?: () => void;
}

export const TbmMainWindow: React.FC<TbmMainWindowProps> = React.memo(({
  industryMode,
  onChangeIndustryMode,
  googleUser,
  activeGeologist,
  onOpenGlobalSettings,
  onOpenFeedback,
  onOpenContinuousTunnelLog,
  onOpenCoreLogging,
  isAuthBusy = false,
  onGoogleSignIn,
  onGoogleSignOut,
  isMasterSoftware = false,
}) => {
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<TbmWorkflowStage | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const { palette } = useTheme();

  // Load isolated TBM state
  const projects = useMemo(() => loadTbmProjects(), [activeWorkflowStage, isStorageModalOpen]);
  const locations = useMemo(() => loadTbmLocations(), [activeWorkflowStage, isStorageModalOpen]);
  const records = useMemo(() => loadTbmExcavationRecords(), [activeWorkflowStage, isStorageModalOpen]);

  const activeProjId = getActiveTbmProjectId() || projects[0]?.id;
  const activeLocId = getActiveTbmLocationId() || locations[0]?.id;
  const activeRecId = getActiveTbmRecordId() || records[0]?.id;

  const currentProject = projects.find((p) => p.id === activeProjId) || projects[0];
  const currentLocation = locations.find((l) => l.id === activeLocId) || locations[0];
  const currentRecord = records.find((r) => r.id === activeRecId) || records[0];

  // If a workflow stage is open, render the full 7-stage workflow shell!
  if (activeWorkflowStage !== null) {
    return (
      <TbmWorkflowShell
        initialStage={activeWorkflowStage}
        onBackToMainWindow={() => setActiveWorkflowStage(null)}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenSettings={onOpenGlobalSettings}
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
          className="flex items-center p-0.5 rounded-xl bg-slate-900/90 backdrop-blur-md shadow-lg border"
          style={{ borderColor: palette.primaryHex + '50' }}
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
                    ? m === 'TBM'
                      ? 'font-black shadow-md'
                      : m === 'MINING'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                style={
                  isAct && m === 'TBM'
                    ? {
                        backgroundColor: palette.primaryHex,
                        color: '#020617',
                        boxShadow: `0 4px 14px ${palette.primaryHex}45`,
                      }
                    : undefined
                }
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

      {/* Top-Right Header: Feedback & Settings */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-6 flex flex-wrap items-center justify-end gap-2 z-20">
        {onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900/90 border border-slate-700 hover:border-cyan-500 text-slate-200 shadow-sm transition-all cursor-pointer active:scale-95"
            title="Send Feedback, Geological Suggestions, or Issue Report"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">Feedback</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenGlobalSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900/90 border border-slate-700 hover:border-cyan-500 text-slate-200 shadow-sm transition-all cursor-pointer active:scale-95"
          title="Open Settings (Google Account, Device ID, Theme Colors, Projects & Profiles)"
        >
          <Settings className="w-4 h-4 text-cyan-400 hover:rotate-90 transition-transform duration-300" />
          <span className="font-semibold">Settings</span>
        </button>
      </div>

      {/* Main Center Content: Strict 2 Options (Data Analysis & Storage) */}
      <div className="relative z-10 w-full max-w-[650px] my-auto shrink-0 flex flex-col items-center text-center justify-center p-2 sm:p-3 gap-3 sm:gap-4">
        {/* Animated Emblem */}
        <div
          onClick={() => playEswaWelcomeChime(true)}
          className="cursor-pointer transition-transform hover:scale-[1.02] flex flex-col items-center"
          title="ESWA TBM Mechanized Tunneling System"
        >
          <EswaTunnelLogo
            size="xl"
            variant="emblem"
            animated
            showBadge={false}
            isMasterEdition={isMasterSoftware}
          />
          <div className="mt-2 text-center select-none">
            <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase drop-shadow-sm font-display flex items-center justify-center gap-2">
              {isMasterSoftware ? (
                <>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-xs sm:text-sm font-black tracking-widest uppercase shadow">
                    MASTER
                  </span>
                  <span className="text-white font-black">ESWA GEOLOGICAL MAPPER</span>
                </>
              ) : (
                <span className="text-white font-black">ESWA GEOLOGICAL MAPPER</span>
              )}
            </h1>
            <p className="text-xs font-mono text-cyan-400 font-semibold tracking-wider mt-0.5">
              TBM Mechanized Shield Suite
            </p>
          </div>
        </div>

        {/* ONLY TWO MAIN OPTIONS: 1. TBM Data Analysis & 2. Data & Storage */}
        <div className="w-full space-y-2.5 pt-1">
          {/* OPTION 1: TBM Data Analysis & Engineering Workflow */}
          <div className="flex items-stretch gap-2 w-full">
            <button
              type="button"
              onClick={() => setActiveWorkflowStage('projects')}
              className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900 hover:bg-slate-850 border-2 transition-all cursor-pointer group"
              style={{
                borderColor: palette.primaryHex + '55',
                boxShadow: `0 8px 25px -4px ${palette.primaryHex}35`,
                color: palette.accentHex,
              }}
            >
              <span className="flex items-center gap-2.5">
                <div
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: palette.primaryHex + '25',
                    color: palette.accentHex,
                  }}
                >
                  <CircleDot className="w-4 h-4" />
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-slate-100 transition-colors">
                    TBM Data Analysis &amp; Engineering
                  </div>
                </div>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform" style={{ color: palette.accentHex }} />
            </button>

            {/* Resume Button to jump right where left off */}
            <button
              type="button"
              onClick={() => setActiveWorkflowStage('collection')}
              className="px-4 py-2.5 rounded-xl font-black text-xs font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
              style={{
                backgroundColor: palette.primaryHex,
                color: '#020617',
                boxShadow: `0 8px 25px -4px ${palette.primaryHex}45`,
              }}
              title={
                currentRecord
                  ? `Resume TBM excavation logging at Ring #${currentRecord.chainageRecord.ringNumber} (RD ${currentRecord.chainageRecord.startChainage.toFixed(2)}m)`
                  : 'Resume TBM Data Collection'
              }
            >
              <Play className="w-3.5 h-3.5 fill-slate-950 shrink-0" />
              <span>Resume</span>
            </button>
          </div>

          {/* OPTION 2: Data & Storage / Import & Export */}
          <div className="w-full">
            <button
              type="button"
              onClick={() => setIsStorageModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-2 border-slate-700 hover:border-slate-500 shadow-md transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-slate-700 transition-colors">
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-slate-100">
                    Data &amp; Storage / Import &amp; Export
                  </div>
                </div>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* OPTION 3: Continuous 3D Tunnel Mapping & Strip CAD */}
          {onOpenContinuousTunnelLog && (
            <div className="w-full">
              <button
                type="button"
                onClick={onOpenContinuousTunnelLog}
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900 hover:bg-slate-850 border-2 border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer group shadow-lg shadow-cyan-500/10 text-cyan-300"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Box className="w-4 h-4" />
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-bold text-slate-100">
                      3. Continuous 3D Tunnel Mapping &amp; Strip CAD Log
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Multi-ring longitudinal 3D tunnel strip log, unrolled crown &amp; walls CAD
                    </div>
                  </div>
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-bold group-hover:underline flex items-center gap-1">
                  <span>Launch 3D Log</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          )}

          {/* OPTION 4: Geotechnical Core Logging */}
          {onOpenCoreLogging && (
            <div className="w-full">
              <button
                type="button"
                onClick={onOpenCoreLogging}
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-slate-900 hover:bg-slate-850 border-2 border-emerald-500/40 hover:border-emerald-400 transition-all cursor-pointer group shadow-lg shadow-emerald-500/10 text-emerald-300"
              >
                <span className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-bold text-slate-100">
                      4. Geological &amp; Geotechnical Core Logging
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Borehole core runs, RQD %, TCR/SCR, weathering &amp; strip log export
                    </div>
                  </div>
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold group-hover:underline flex items-center gap-1">
                  <span>Core Logging</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Compact Site Status Strip */}
        {currentProject && (
          <div className="w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Project: <strong className="text-cyan-300">{currentProject.projectName}</strong></span>
            </div>
            {currentRecord && (
              <div>
                <span>Latest: <strong className="text-emerald-400">Ring #{currentRecord.chainageRecord.ringNumber}</strong> (RD {currentRecord.chainageRecord.startChainage.toFixed(2)}m)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TBM Isolated Data Storage Modal */}
      <TbmDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onLoadProject={(projId) => {
          setActiveWorkflowStage('locations');
        }}
        onLoadLocation={(locId) => {
          setActiveWorkflowStage('collection');
        }}
        onLoadRecord={(recId) => {
          setActiveWorkflowStage('collection');
        }}
      />
    </main>
  );
});
TbmMainWindow.displayName = 'TbmMainWindow';
