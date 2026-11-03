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
  Settings,
  Layers,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo, playEswaWelcomeChime } from '../EswaBrandIdentity';
import { useTheme } from '../../context/ThemeContext';
import { IndustryMode } from '../../types/tunnel';
import type { GoogleUserAccountInfo, GeologistUserProfile } from '../../engine/userCloudAndPackageEngine';
import {
  loadTbmProjects,
  loadTbmLocations,
  loadTbmExcavationRecords,
  getActiveTbmProjectId,
  getActiveTbmLocationId,
  getActiveTbmRecordId,
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
  onOpenAdminPortal?: () => void;
  pendingRequestCount?: number;
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
  onOpenAdminPortal,
  pendingRequestCount = 0,
}) => {
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<TbmWorkflowStage | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
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
        {isMasterSoftware && onOpenAdminPortal && (
          <button
            type="button"
            onClick={onOpenAdminPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded-lg border border-cyan-500/50 bg-slate-900/95 hover:bg-slate-800 text-cyan-300 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Open Software Access Control (Master Admin)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Software Access Control</span>
            {pendingRequestCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-cyan-500 text-slate-950">
                {pendingRequestCount}
              </span>
            )}
          </button>
        )}
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

          {/* OPTION 3: Geotechnical Core Logging */}
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
                      Geological &amp; Geotechnical Core Logging
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
