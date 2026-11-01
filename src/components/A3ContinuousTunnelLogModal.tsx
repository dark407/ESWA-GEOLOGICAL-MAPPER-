import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Printer,
  Box,
  Layers,
  Sparkles,
  PenTool,
  FolderGit2,
  CheckCircle2,
  Cpu,
  TrendingUp,
  FileText,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { SavedProjectRecord } from '../types/tunnel';
import {
  ContinuousTunnelStripDataset,
  ContinuousStripTrace,
  loadAllContinuousStripDatasets,
  saveAllContinuousStripDatasets,
  getUnifiedContinuousProjectsAndLocations,
  compileContinuousDatasetFromFieldAndSavedRecords,
  extendStripTraceAcrossPull,
  computeContinuous3DJointInspectionSchedule,
  computeContinuousStripFemDemProfile,
  computeContinuousAdvancedGeotechProfile,
  resolveStripTraceColor,
  UnifiedContinuousProjectItem,
  UnifiedContinuousLocationItem,
} from '../engine/continuous3DStripEngine';
import { ContinuousTunnel3DCanvas } from './ContinuousTunnel3DCanvas';
import { EswaCadContinuousStripModal, ROCK_TYPES } from './EswaCadContinuousStripModal';
import { ContinuousFemDem3DViewport } from './ContinuousFemDem3DViewport';

export interface A3ContinuousTunnelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset?: ContinuousTunnelStripDataset;
  onUpdateDataset?: (updated: ContinuousTunnelStripDataset) => void;
  initialCadOpen?: boolean;
  userDeviceId?: string;
  userEmail?: string;
  savedProjects?: SavedProjectRecord[];
  initialDatasetId?: string;
}

export const A3ContinuousTunnelLogModal: React.FC<A3ContinuousTunnelLogModalProps> = ({
  isOpen,
  onClose,
  dataset: propDataset,
  onUpdateDataset,
  initialCadOpen = false,
  savedProjects = [],
  initialDatasetId,
}) => {
  // 6-Stage Unified Pipeline State:
  // 1 = Setup & Range Sync | 2 = ESWA 3D CAD | 3 = 3D Joint Inspection | 4 = Continuous FEM/DEM | 5 = Advanced Analysis | 6 = Final A3 Report
  const [activeWizardStage, setActiveWizardStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(
    initialCadOpen ? 2 : 6
  );

  useEffect(() => {
    if (isOpen) {
      setActiveWizardStage(initialCadOpen ? 2 : 6);
    }
  }, [isOpen, initialCadOpen]);

  const storedDatasets = useMemo(() => loadAllContinuousStripDatasets(), [isOpen, propDataset?.id]);

  const [localDataset, setLocalDataset] = useState<ContinuousTunnelStripDataset>(
    () =>
      propDataset ||
      storedDatasets.find((d) => d.id === initialDatasetId) ||
      storedDatasets[0]
  );

  useEffect(() => {
    if (propDataset) {
      setLocalDataset(propDataset);
    }
  }, [propDataset]);

  // Stage 1 inline sync state
  const [syncExcavationMode, setSyncExcavationMode] = useState<'TUNNEL' | 'SHAFT'>(
    localDataset?.excavationMode || 'TUNNEL'
  );
  const projectList = useMemo<UnifiedContinuousProjectItem[]>(
    () => getUnifiedContinuousProjectsAndLocations(syncExcavationMode, savedProjects),
    [syncExcavationMode, savedProjects, isOpen]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [syncFromRd, setSyncFromRd] = useState<number>(localDataset?.viewFromRd ?? 0);
  const [syncToRd, setSyncToRd] = useState<number>(localDataset?.viewToRd ?? 25);

  useEffect(() => {
    if (projectList.length === 0) {
      setSelectedProjectId('');
      setSelectedLocationId('');
      return;
    }
    const proj =
      projectList.find((p) => p.id === selectedProjectId) ||
      projectList.find(
        (p) => p.projectName.toLowerCase() === (localDataset?.projectName || '').toLowerCase()
      ) ||
      projectList[0];
    setSelectedProjectId(proj.id);

    const loc =
      proj.locations.find((l) => l.id === selectedLocationId) ||
      proj.locations.find(
        (l) => l.name.toLowerCase() === (localDataset?.tunnelLocationName || '').toLowerCase()
      ) ||
      proj.locations[0];
    if (loc) {
      setSelectedLocationId(loc.id);
      if (loc.rounds.length > 0) {
        const minR = Math.min(...loc.rounds.map((r) => r.fromRd));
        const maxR = Math.max(...loc.rounds.map((r) => r.toRd));
        setSyncFromRd(minR);
        setSyncToRd(Math.max(minR + 2, maxR));
      }
    }
  }, [syncExcavationMode, projectList]);

  const activeSyncProject = useMemo<UnifiedContinuousProjectItem | null>(
    () => projectList.find((p) => p.id === selectedProjectId) || projectList[0] || null,
    [projectList, selectedProjectId]
  );

  const activeSyncLocation = useMemo<UnifiedContinuousLocationItem | null>(
    () =>
      activeSyncProject?.locations.find((l) => l.id === selectedLocationId) ||
      activeSyncProject?.locations[0] ||
      null,
    [activeSyncProject, selectedLocationId]
  );

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [showWedgeBlocks3D, setShowWedgeBlocks3D] = useState<boolean>(true);
  const [femViewMode, setFemViewMode] = useState<'3D_AND_2D' | '3D_ONLY' | 'LONGITUDINAL' | 'CROSS_SECTION'>('3D_AND_2D');
  const [selectedFemPullId, setSelectedFemPullId] = useState<string>('');
  const [customOverburdenOverrideM, setCustomOverburdenOverrideM] = useState<string>('');
  const [appliedOverburdenOverrideM, setAppliedOverburdenOverrideM] = useState<number | null>(null);
  const stripSvgRef = useRef<SVGSVGElement | null>(null);

  // Build active dataset (applying optional overburden override in Stage 4)
  const dataset = useMemo<ContinuousTunnelStripDataset>(() => {
    if (appliedOverburdenOverrideM !== null && appliedOverburdenOverrideM > 0) {
      return {
        ...localDataset,
        overburdenDepthM: appliedOverburdenOverrideM,
        pulls: (localDataset.pulls || []).map((p) => ({
          ...p,
          overburdenDepthM: appliedOverburdenOverrideM,
        })),
      };
    }
    return localDataset;
  }, [localDataset, appliedOverburdenOverrideM]);

  // Derived schedules for Stage 3, Stage 4, and Stage 5
  const jointInspectionSchedule = useMemo(
    () => computeContinuous3DJointInspectionSchedule(dataset),
    [dataset]
  );

  const femDemProfile = useMemo(
    () => computeContinuousStripFemDemProfile(dataset),
    [dataset]
  );

  const advancedGeotechProfile = useMemo(
    () => computeContinuousAdvancedGeotechProfile(dataset),
    [dataset]
  );

  useEffect(() => {
    const firstMapped = femDemProfile.find((p) => p.status === 'MAPPED');
    if (firstMapped && (!selectedFemPullId || !femDemProfile.some((p) => p.pullId === selectedFemPullId))) {
      setSelectedFemPullId(firstMapped.pullId);
    }
  }, [femDemProfile, selectedFemPullId]);

  if (!isOpen || !dataset) return null;

  const isShaft = dataset.excavationMode === 'SHAFT';
  const startRd = dataset.viewFromRd ?? 0;
  const endRd = dataset.viewToRd ?? 30;
  const totalRdLength = Math.max(1, endRd - startRd);

  // Match exact ESWA CAD canvas perimeter & zone dimensions
  const leftWallArcM = dataset.leftWallArcLengthM || dataset.leftWallHeightM || 3.75;
  const crownArcM = dataset.crownArcLengthM || dataset.crownWidthM || 7.5;
  const rightWallArcM = dataset.rightWallArcLengthM || dataset.rightWallHeightM || 3.75;
  const shaftQuadArcM = dataset.shaftQuadrantArcLengthM || leftWallArcM;
  const totalUnrolledWidthM = isShaft
    ? shaftQuadArcM * 4
    : (dataset.upperZoneWidthM || 0) + (dataset.lowerZoneWidthM || 0) ||
      leftWallArcM + crownArcM + rightWallArcM;

  // SVG coordinate system for the 2D unrolled strip chart in Stage 6 (A3 Report)
  const svgW = 1100;
  const svgH = 260;
  const padL = 85;
  const padR = 25;
  const padT = 22;
  const padB = 22;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const rdToX = (rd: number) => padL + ((rd - startRd) / totalRdLength) * plotW;
  const yToSvgY = (yM: number) => padT + (yM / totalUnrolledWidthM) * plotH;

  // Tunnel 3-zone divider Y positions
  const yTunnelCrownTop = yToSvgY(leftWallArcM);
  const yTunnelRightWallTop = yToSvgY(leftWallArcM + crownArcM);

  // Shaft 4-quadrant divider Y positions (1. NE 0-90, 2. ES 90-180, 3. SW 180-270, 4. WN 270-360)
  const yShaftQ1 = yToSvgY(shaftQuadArcM);
  const yShaftQ2 = yToSvgY(shaftQuadArcM * 2);
  const yShaftQ3 = yToSvgY(shaftQuadArcM * 3);

  const handleSaveCadEdits = (updated: ContinuousTunnelStripDataset) => {
    setLocalDataset(updated);
    if (onUpdateDataset) {
      onUpdateDataset(updated);
    }
    const all = loadAllContinuousStripDatasets();
    const idx = all.findIndex((d) => d.id === updated.id);
    if (idx >= 0) all[idx] = updated;
    else all.unshift(updated);
    saveAllContinuousStripDatasets(all);
  };

  const handleExtendTraceInStage3 = (
    traceId: string,
    direction: 'start' | 'end' | 'both' | 'full_span',
    distanceM: number
  ) => {
    const updatedTraces: ContinuousStripTrace[] = (dataset.traces || []).map((t) =>
      t.id === traceId
        ? extendStripTraceAcrossPull(
            t,
            direction,
            distanceM,
            totalUnrolledWidthM,
            startRd,
            endRd
          )
        : t
    );
    handleSaveCadEdits({
      ...dataset,
      traces: updatedTraces,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSyncRangeInStage1 = () => {
    const fallbackProject: UnifiedContinuousProjectItem = activeSyncProject || {
      id: `proj-${syncExcavationMode.toLowerCase()}-default`,
      projectName: dataset.projectName || 'NATM Project',
      clientName: dataset.clientName || 'Client',
      contractorName: dataset.contractorName || 'Contractor',
      excavationMode: syncExcavationMode,
      locations: [],
    };
    const fallbackLocation: UnifiedContinuousLocationItem = activeSyncLocation || {
      id: `loc-${syncExcavationMode.toLowerCase()}-default`,
      name: dataset.tunnelLocationName || 'Main Heading',
      excavationMode: syncExcavationMode,
      diameterWidthM: dataset.tunnelDiameterWidthM || 8.0,
      heightM: dataset.tunnelArchHeightM || 6.0,
      driveAzimuthDeg: 45,
      overburdenDepthM: dataset.overburdenDepthM || 110,
      rounds: [],
    };

    const compiled = compileContinuousDatasetFromFieldAndSavedRecords({
      excavationMode: syncExcavationMode,
      projectItem: fallbackProject,
      locationItem: fallbackLocation,
      fromRd: Math.min(syncFromRd, syncToRd),
      toRd: Math.max(syncFromRd + 0.5, syncToRd),
      existingDataset: dataset,
    });
    handleSaveCadEdits(compiled);
    setActiveWizardStage(2);
  };

  const selectedJointScheduleItem =
    jointInspectionSchedule.find((j) => j.traceId === selectedTraceId) ||
    jointInspectionSchedule[0] ||
    null;

  const activeFemSlice =
    femDemProfile.find((r) => r.pullId === selectedFemPullId && r.status === 'MAPPED') ||
    femDemProfile.find((r) => r.status === 'MAPPED') ||
    femDemProfile[0];

  const wizardSteps: Array<{
    stage: 1 | 2 | 3 | 4 | 5 | 6;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      stage: 1,
      title: '1. Setup & RD Sync',
      subtitle: isShaft ? 'Shaft Mode & Depth' : 'Tunnel Mode & RD',
      icon: <FolderGit2 className="w-3.5 h-3.5" />,
    },
    {
      stage: 2,
      title: '2. ESWA 3D CAD',
      subtitle: 'Clean Strip & Edit',
      icon: <PenTool className="w-3.5 h-3.5" />,
    },
    {
      stage: 3,
      title: '3. 3D Joint Inspect',
      subtitle: 'Planes & 3D Wedges',
      icon: <Box className="w-3.5 h-3.5" />,
    },
    {
      stage: 4,
      title: '4. Continuous FEM/DEM',
      subtitle: 'Before vs After Support',
      icon: <Cpu className="w-3.5 h-3.5" />,
    },
    {
      stage: 5,
      title: '5. Advanced Analysis',
      subtitle: 'Q/RMR & Look-Ahead',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      stage: 6,
      title: '6. Final A3 Report',
      subtitle: 'ISO A3 Engineering Sheet',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Top Unified 6-Stage Pipeline Bar (Hidden when printing) */}
      <div className="print:hidden bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Over NATM — Continuous 3D Logging &amp; Engineering Pipeline
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    isShaft
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {isShaft
                    ? `VERTICAL SHAFT (${
                        dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE'
                          ? `Half-Circle • Median ${(dataset.shaftCenterMedianStatus || 'closed').toUpperCase()}`
                          : 'Full 360° Circle'
                      })`
                    : 'HORIZONTAL / INCLINED TUNNEL'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {dataset.projectName} • {dataset.tunnelLocationName} •{' '}
                {isShaft ? 'Depth' : 'RD'} {startRd.toFixed(1)}m to {endRd.toFixed(1)}m (
                {dataset.pulls.filter((p) => p.status === 'MAPPED').length} Mapped Rounds,{' '}
                {dataset.pulls.filter((p) => p.status === 'MISSING_GAP').length} Unlogged Gaps)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Active Dataset Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Active Log:</span>
              <select
                value={dataset.id}
                onChange={(e) => {
                  const found = storedDatasets.find((d) => d.id === e.target.value);
                  if (found) {
                    setLocalDataset(found);
                    if (onUpdateDataset) onUpdateDataset(found);
                    setSelectedTraceId(null);
                  }
                }}
                className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer max-w-[260px] truncate"
              >
                {[dataset, ...storedDatasets.filter((d) => d.id !== dataset.id)].map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    [{d.excavationMode === 'SHAFT' ? 'SHAFT' : 'TUNNEL'}] {d.projectName} —{' '}
                    {d.tunnelLocationName} ({d.viewFromRd}–{d.viewToRd}m)
                  </option>
                ))}
              </select>
            </div>

            {activeWizardStage === 6 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print A3 Landscape PDF
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
              title="Close Continuous 3D Logging Pipeline"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6-Step Wizard Navigation Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 pt-1">
          {wizardSteps.map((s) => {
            const isActive = activeWizardStage === s.stage;
            const isCompleted = activeWizardStage > s.stage;
            return (
              <button
                key={s.stage}
                onClick={() => setActiveWizardStage(s.stage)}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300 hover:bg-slate-800'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1 rounded ${
                      isActive
                        ? 'bg-amber-500 text-slate-950'
                        : isCompleted
                        ? 'bg-emerald-600/30 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.icon}
                  </div>
                  <div className="truncate">
                    <div className="text-[11px] font-black leading-tight truncate">{s.title}</div>
                    <div className="text-[9px] opacity-75 truncate">{s.subtitle}</div>
                  </div>
                </div>
                {isCompleted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================================
          STAGE 1: EXCAVATION MODE, PROJECT, LOCATION & RD / DEPTH RANGE SYNC
         ============================================================================ */}
      {activeWizardStage === 1 && (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Stage 1 of 6 • Underground Face Mapping Synchronization
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Select Excavation Mode, Project, Location &amp; Target{' '}
                    {syncExcavationMode === 'SHAFT' ? 'Depth' : 'Chainage (RD)'} Range
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Directly syncs with all logged Tunnel faces and Vertical Shaft rounds from Underground Face Mapping. Any missing RD/Depth intervals remain blank at true spatial scale.
                  </p>
                </div>

                {/* Excavation Mode Toggle */}
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setSyncExcavationMode('TUNNEL')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                      syncExcavationMode === 'TUNNEL'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tunnel (Horizontal / Inclined)
                  </button>
                  <button
                    onClick={() => setSyncExcavationMode('SHAFT')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                      syncExcavationMode === 'SHAFT'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Vertical Shaft (Circle / Half-Circle)
                  </button>
                </div>
              </div>

              {/* Project & Location Selector + Range Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      1A. Project
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => {
                        const nextProjId = e.target.value;
                        setSelectedProjectId(nextProjId);
                        const pObj = projectList.find((p) => p.id === nextProjId);
                        const firstLoc = pObj?.locations[0];
                        if (firstLoc) {
                          setSelectedLocationId(firstLoc.id);
                          if (firstLoc.rounds.length > 0) {
                            setSyncFromRd(Math.min(...firstLoc.rounds.map((r) => r.fromRd)));
                            setSyncToRd(Math.max(...firstLoc.rounds.map((r) => r.toRd)));
                          }
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white"
                    >
                      {projectList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectName} ({p.locations.length} loc)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      1B. {syncExcavationMode === 'SHAFT' ? 'Shaft Location' : 'Tunnel Heading'}
                    </label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => {
                        const nextLocId = e.target.value;
                        setSelectedLocationId(nextLocId);
                        const lObj = activeSyncProject?.locations.find((l) => l.id === nextLocId);
                        if (lObj && lObj.rounds.length > 0) {
                          setSyncFromRd(Math.min(...lObj.rounds.map((r) => r.fromRd)));
                          setSyncToRd(Math.max(...lObj.rounds.map((r) => r.toRd)));
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white"
                    >
                      {(activeSyncProject?.locations || []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.rounds.length} logged rounds)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      2. Choose {syncExcavationMode === 'SHAFT' ? 'Shaft Depth Range (m)' : 'Chainage Range (From RD to To RD)'}
                    </label>
                    {activeSyncLocation && activeSyncLocation.rounds.length > 0 && (
                      <button
                        onClick={() => {
                          setSyncFromRd(Math.min(...activeSyncLocation.rounds.map((r) => r.fromRd)));
                          setSyncToRd(Math.max(...activeSyncLocation.rounds.map((r) => r.toRd)));
                        }}
                        className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
                      >
                        Reset to Full Logged Span
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        From {syncExcavationMode === 'SHAFT' ? 'Depth (m)' : 'RD (m)'}
                      </span>
                      <input
                        type="number"
                        step="0.5"
                        value={syncFromRd}
                        onChange={(e) => setSyncFromRd(Number(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        To {syncExcavationMode === 'SHAFT' ? 'Depth (m)' : 'RD (m)'}
                      </span>
                      <input
                        type="number"
                        step="0.5"
                        value={syncToRd}
                        onChange={(e) => setSyncToRd(Number(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Logged Rounds Table in Selected Project/Location */}
              {activeSyncLocation && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Logged Face / Shaft Rounds in {activeSyncProject?.projectName} — {activeSyncLocation.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Click Set From / Set To to bound the 3D strip log range
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                          <th className="py-2 px-3">Round</th>
                          <th className="py-2 px-3">
                            {syncExcavationMode === 'SHAFT' ? 'Depth Interval' : 'RD Interval'}
                          </th>
                          <th className="py-2 px-3">Pull Length</th>
                          <th className="py-2 px-3">Rock Class &amp; Q / RMR</th>
                          <th className="py-2 px-3">Rock Type</th>
                          <th className="py-2 px-3">Quick Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSyncLocation.rounds.map((r, idx) => {
                          const inRange =
                            r.toRd > Math.min(syncFromRd, syncToRd) &&
                            r.fromRd < Math.max(syncFromRd, syncToRd);
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-slate-800/60 ${
                                inRange ? 'bg-amber-500/10 text-white' : 'text-slate-400'
                              }`}
                            >
                              <td className="py-2 px-3 font-mono font-bold">#{r.roundNumber}</td>
                              <td className="py-2 px-3 font-mono font-bold text-amber-300">
                                {r.fromRd.toFixed(1)}m – {r.toRd.toFixed(1)}m
                              </td>
                              <td className="py-2 px-3 font-mono">{r.pullLengthM.toFixed(1)}m</td>
                              <td className="py-2 px-3">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-[10px]">
                                  {r.rockClass}
                                </span>{' '}
                                <span className="font-mono text-[11px] text-cyan-300 ml-1">
                                  Q={r.qValue.toFixed(2)} | RMR={r.rmrValue}
                                </span>
                              </td>
                              <td className="py-2 px-3">{r.rockType}</td>
                              <td className="py-2 px-3 space-x-2">
                                <button
                                  onClick={() => setSyncFromRd(r.fromRd)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-600 text-[10px] font-bold text-slate-200 cursor-pointer"
                                >
                                  Set From ({r.fromRd}m)
                                </button>
                                <button
                                  onClick={() => setSyncToRd(r.toRd)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-[10px] font-bold text-slate-200 cursor-pointer"
                                >
                                  Set To ({r.toRd}m)
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-400">
                  Unlogged intervals inside [{Math.min(syncFromRd, syncToRd).toFixed(1)}m –{' '}
                  {Math.max(syncFromRd, syncToRd).toFixed(1)}m] are preserved as clean blank gaps with dashed boundaries.
                </div>
                <button
                  onClick={handleSyncRangeInStage1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync Selected Pulls into Stage 2 (ESWA 3D CAD)
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          STAGE 2: CLEAN ESWA 3D CAD STRIP LOG EDITOR (EMBEDDED)
         ============================================================================ */}
      {activeWizardStage === 2 && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <EswaCadContinuousStripModal
            isOpen={true}
            embeddedMode={true}
            onClose={() => setActiveWizardStage(6)}
            dataset={dataset}
            onSaveDataset={handleSaveCadEdits}
            onNextStage={(updatedDataset) => {
              handleSaveCadEdits(updatedDataset);
              setActiveWizardStage(3);
            }}
          />
        </div>
      )}

      {/* ============================================================================
          STAGE 3: COMPLETE 3D ANALYSIS & HIGH-PRECISION 3D JOINT INSPECTION
         ============================================================================ */}
      {activeWizardStage === 3 && (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-950 text-slate-100">
          {/* Left 7 Cols: Interactive 3D Tunnel / Shaft Viewport */}
          <div className="lg:col-span-7 h-full flex flex-col border-r border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  Stage 3 of 6 • High-Precision 3D Structural &amp; Wedge Inspection
                </span>
                <h3 className="text-sm font-black text-white">
                  3D {isShaft ? 'Vertical Shaft Cylinder / Half-Circle' : 'NATM Tunnel Arch'}{' '}
                  Discontinuity &amp; Tetrahedral Wedge Model
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWedgeBlocks3D((v) => !v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    showWedgeBlocks3D
                      ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {showWedgeBlocks3D ? '3D Wedge Blocks: ON' : '3D Wedge Blocks: OFF'}
                </button>
                <button
                  onClick={() => setActiveWizardStage(4)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Next: Continuous FEM/DEM
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ContinuousTunnel3DCanvas
                dataset={dataset}
                selectedTraceId={selectedTraceId}
                onSelectTrace={(id) => setSelectedTraceId(id)}
                showWedgeBlocks={showWedgeBlocks3D}
                onExtendTrace={handleExtendTraceInStage3}
              />
            </div>
          </div>

          {/* Right 5 Cols: High-Precision 3D Joint Inspection Schedule & Plane Equation Inspector */}
          <div className="lg:col-span-5 h-full flex flex-col overflow-hidden bg-slate-900/70">
            {selectedJointScheduleItem ? (
              <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-black">
                      {selectedJointScheduleItem.label} ({selectedJointScheduleItem.setId})
                    </span>
                    <span className="text-xs font-bold text-white">
                      {selectedJointScheduleItem.structureType} • Dip {selectedJointScheduleItem.dipDeg}° / DipDir{' '}
                      {String(selectedJointScheduleItem.dipDirectionDeg).padStart(3, '0')}°
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      selectedJointScheduleItem.riskRating === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : selectedJointScheduleItem.riskRating === 'MODERATE'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {selectedJointScheduleItem.kinematicMode} ({selectedJointScheduleItem.riskRating})
                  </span>
                </div>

                {/* 3D Plane Equation & Barton-Bandis Shear Parameters */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[9px] uppercase font-bold text-slate-400">
                      True 3D Cutting Plane Equation
                    </div>
                    <div className="font-mono font-bold text-cyan-300 mt-0.5">
                      {selectedJointScheduleItem.planeEquationStr}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Span: {isShaft ? 'Depth' : 'RD'} {selectedJointScheduleItem.fromRd.toFixed(1)}m –{' '}
                      {selectedJointScheduleItem.toRd.toFixed(1)}m (
                      {selectedJointScheduleItem.persistenceLengthM.toFixed(1)}m)
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[9px] uppercase font-bold text-slate-400">
                      Barton-Bandis Roughness &amp; Friction
                    </div>
                    <div className="font-mono font-bold text-amber-300 mt-0.5">
                      JRC = {selectedJointScheduleItem.jrc} | JCS = {selectedJointScheduleItem.jcsMpa} MPa
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Peak Friction φ_p = {selectedJointScheduleItem.bartonFrictionAngleDeg}° •{' '}
                      {selectedJointScheduleItem.apertureMm}mm ({selectedJointScheduleItem.infilling})
                    </div>
                  </div>
                </div>

                {/* 3D Tetrahedral Wedge Block Kinematics */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400">
                      3D Tetrahedral Wedge Block &amp; Sliding Vector
                    </div>
                    <div className="font-mono text-white font-bold mt-0.5">
                      Vol = {selectedJointScheduleItem.wedgeBlockVolumeM3.toFixed(2)} m³ • Apex ={' '}
                      {selectedJointScheduleItem.wedgeApexHeightM.toFixed(2)} m
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Sliding Plunge/Azimuth: {selectedJointScheduleItem.slidingPlungeDeg}° /{' '}
                      {String(selectedJointScheduleItem.slidingDirectionAzimuthDeg).padStart(3, '0')}° • Zones:{' '}
                      {selectedJointScheduleItem.surfaceZones.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-rose-400 font-mono font-bold">
                      FoS Unsup: {selectedJointScheduleItem.fosUnreinforced.toFixed(2)}
                    </div>
                    <div className="text-xs text-emerald-400 font-mono font-black">
                      FoS Sup: {selectedJointScheduleItem.fosReinforced.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Quick 3D Joint Expand / Extend Controls */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Expand / Extrapolate Joint Across Adjacent Pulls:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        handleExtendTraceInStage3(selectedJointScheduleItem.traceId, 'start', 1.5)
                      }
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 text-[10px] font-bold text-slate-200 cursor-pointer"
                    >
                      -1.5m Start
                    </button>
                    <button
                      onClick={() =>
                        handleExtendTraceInStage3(selectedJointScheduleItem.traceId, 'end', 1.5)
                      }
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 text-[10px] font-bold text-slate-200 cursor-pointer"
                    >
                      +1.5m End
                    </button>
                    <button
                      onClick={() =>
                        handleExtendTraceInStage3(selectedJointScheduleItem.traceId, 'both', 2.0)
                      }
                      className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-black text-amber-300 cursor-pointer"
                    >
                      Expand Both (+2.0m)
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Complete 3D Joint Inspection Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
                All Mapped Discontinuities &amp; 3D Wedge Schedule ({jointInspectionSchedule.length})
              </div>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] uppercase">
                    <th className="py-2 px-2">ID / Set</th>
                    <th className="py-2 px-2">Dip / Dir</th>
                    <th className="py-2 px-2">{isShaft ? 'Depth Span' : 'RD Span'}</th>
                    <th className="py-2 px-2">JRC / JCS</th>
                    <th className="py-2 px-2">Wedge Vol</th>
                    <th className="py-2 px-2">FoS (Bef → Aft)</th>
                  </tr>
                </thead>
                <tbody>
                  {jointInspectionSchedule.map((item) => {
                    const isSel = item.traceId === (selectedJointScheduleItem?.traceId || '');
                    return (
                      <tr
                        key={item.traceId}
                        onClick={() => setSelectedTraceId(item.traceId)}
                        className={`border-b border-slate-800/70 cursor-pointer transition-colors ${
                          isSel
                            ? 'bg-cyan-500/15 text-white'
                            : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <td className="py-2 px-2 font-mono font-bold text-cyan-300">
                          {item.label} ({item.setId})
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {item.dipDeg}° / {String(item.dipDirectionDeg).padStart(3, '0')}°
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {item.fromRd.toFixed(1)}–{item.toRd.toFixed(1)}m
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {item.jrc} / {item.jcsMpa}MPa
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {item.wedgeBlockVolumeM3.toFixed(2)} m³
                        </td>
                        <td className="py-2 px-2 font-mono">
                          <span className="text-rose-400 font-bold">
                            {item.fosUnreinforced.toFixed(2)}
                          </span>{' '}
                          →{' '}
                          <span className="text-emerald-400 font-black">
                            {item.fosReinforced.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
          STAGE 4: CONTINUOUS FULL-LENGTH FEM / DEM ANALYSIS (BEFORE VS AFTER SUPPORT)
         ============================================================================ */}
      {activeWizardStage === 4 && (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 text-slate-100 space-y-5">
          {/* Header & Overburden / View Mode Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Stage 4 of 6 • High-Precision Elasto-Plastic FEM &amp; Discrete Wedge DEM Along Full{' '}
                {isShaft ? 'Shaft Depth' : 'Tunnel Length'}
              </span>
              <h3 className="text-base font-black text-white">
                Continuous Before Support (Unreinforced) vs. After Support (Reinforced) Numerical Verification
              </h3>
              <p className="text-xs text-slate-400">
                Evaluates Hoek-Brown / Duncan-Fama elasto-plastic continuum yield and 3D discrete wedge DEM mobilization across every logged pull.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Overburden Override Input with OK button */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Overburden H (m):
                </span>
                <input
                  type="number"
                  placeholder={isShaft ? 'Auto (=Depth)' : 'e.g. 110'}
                  value={customOverburdenOverrideM}
                  onChange={(e) => setCustomOverburdenOverrideM(e.target.value)}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono font-bold text-white"
                />
                <button
                  onClick={() => {
                    const parsed = parseFloat(customOverburdenOverrideM);
                    if (!isNaN(parsed) && parsed > 0) {
                      setAppliedOverburdenOverrideM(parsed);
                    } else {
                      setAppliedOverburdenOverrideM(null);
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer"
                >
                  OK
                </button>
                {appliedOverburdenOverrideM !== null && (
                  <button
                    onClick={() => {
                      setAppliedOverburdenOverrideM(null);
                      setCustomOverburdenOverrideM('');
                    }}
                    className="text-[10px] text-rose-400 hover:underline ml-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(
                  [
                    { id: '3D_AND_2D', label: '3D Before/After + 2D Slices' },
                    { id: '3D_ONLY', label: '3D FEM/DEM Only' },
                    { id: 'LONGITUDINAL', label: 'Longitudinal Profile' },
                    { id: 'CROSS_SECTION', label: 'Per-Round Cross-Section' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setFemViewMode(m.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black uppercase cursor-pointer ${
                      femViewMode === m.id
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveWizardStage(5)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Next: Advanced Analysis
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 0. CONTINUOUS 3D FEM / DEM VIEWPORT (BEFORE SUPPORT VS AFTER SUPPORT IN 3D) */}
          {(femViewMode === '3D_AND_2D' || femViewMode === '3D_ONLY') && (
            <ContinuousFemDem3DViewport
              dataset={dataset}
              femDemProfile={femDemProfile}
              jointSchedule={jointInspectionSchedule}
              selectedPullId={activeFemSlice?.pullId || selectedFemPullId}
              onSelectPullId={(pid) => setSelectedFemPullId(pid)}
            />
          )}

          {/* 1. LONGITUDINAL PROFILE VIEW (BEFORE SUPPORT VS AFTER SUPPORT ALONG FULL LENGTH) */}
          {(femViewMode === '3D_AND_2D' || femViewMode === 'LONGITUDINAL') && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Longitudinal FEM / DEM Profile ({isShaft ? 'Depth' : 'Chainage RD'}{' '}
                    {startRd.toFixed(1)}m to {endRd.toFixed(1)}m)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Click any round column on the profile below to inspect its 2D Before vs. After Support Cross-Section Slice. Unlogged gaps are shown with dashed boundaries.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-0.5 bg-rose-500 inline-block" /> Before Support (Unreinforced)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> After Support (Reinforced)
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto bg-slate-950 border border-slate-800 rounded-lg p-3">
                <svg viewBox="0 0 1000 220" className="w-full h-52">
                  <line x1={60} y1={30} x2={970} y2={30} stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1={60} y1={100} x2={970} y2={100} stroke="#1e293b" strokeDasharray="3,3" />
                  <line x1={60} y1={175} x2={970} y2={175} stroke="#334155" />

                  <text x={10} y={34} fontSize={9} fill="#94a3b8" fontWeight={700}>
                    Disp / FoS
                  </text>
                  <text x={10} y={104} fontSize={9} fill="#94a3b8" fontWeight={700}>
                    Mid-Range
                  </text>
                  <text x={10} y={178} fontSize={9} fill="#94a3b8" fontWeight={700}>
                    0.0 Baseline
                  </text>

                  {femDemProfile.map((p, idx) => {
                    const x1 = 60 + ((p.fromRd - startRd) / totalRdLength) * 910;
                    const x2 = 60 + ((p.toRd - startRd) / totalRdLength) * 910;
                    const cx = (x1 + x2) / 2;
                    const isSelected = p.pullId === activeFemSlice?.pullId;

                    if (p.status === 'MISSING_GAP') {
                      return (
                        <g key={`fem-gap-${p.fromRd}-${idx}`}>
                          <rect
                            x={x1}
                            y={20}
                            width={Math.max(2, x2 - x1)}
                            height={155}
                            fill="#0f172a"
                            stroke="#475569"
                            strokeDasharray="5,4"
                          />
                          <text
                            x={cx}
                            y={100}
                            fontSize={9}
                            fontWeight={800}
                            fill="#64748b"
                            textAnchor="middle"
                          >
                            UNLOGGED GAP ({p.fromRd}–{p.toRd}m)
                          </text>
                        </g>
                      );
                    }

                    const maxDispScale = Math.max(
                      35,
                      ...femDemProfile.map((item) => item.unreinforcedDispMm)
                    );
                    const yBeforeDisp =
                      175 - Math.min(140, (p.unreinforcedDispMm / maxDispScale) * 140);
                    const yAfterDisp =
                      175 - Math.min(140, (p.reinforcedDispMm / maxDispScale) * 140);

                    return (
                      <g
                        key={`fem-col-${p.pullId}`}
                        onClick={() => setSelectedFemPullId(p.pullId)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={x1}
                          y={20}
                          width={Math.max(4, x2 - x1)}
                          height={155}
                          fill={isSelected ? 'rgba(245, 158, 11, 0.14)' : 'transparent'}
                          stroke="#1e293b"
                        />
                        <rect
                          x={cx - 12}
                          y={yBeforeDisp}
                          width={10}
                          height={175 - yBeforeDisp}
                          fill="#f43f5e"
                          opacity={0.8}
                          rx={2}
                        />
                        <rect
                          x={cx + 2}
                          y={yAfterDisp}
                          width={10}
                          height={175 - yAfterDisp}
                          fill="#10b981"
                          opacity={0.9}
                          rx={2}
                        />
                        <text
                          x={cx - 7}
                          y={yBeforeDisp - 4}
                          fontSize={8}
                          fill="#fda4af"
                          textAnchor="middle"
                          fontWeight={700}
                        >
                          {p.unreinforcedDispMm.toFixed(1)}mm
                        </text>
                        <text
                          x={cx + 7}
                          y={yAfterDisp - 4}
                          fontSize={8}
                          fill="#6ee7b7"
                          textAnchor="middle"
                          fontWeight={800}
                        >
                          {p.reinforcedDispMm.toFixed(1)}mm
                        </text>
                        <text
                          x={cx}
                          y={192}
                          fontSize={9}
                          fill={isSelected ? '#fbbf24' : '#cbd5e1'}
                          textAnchor="middle"
                          fontWeight={800}
                        >
                          {p.fromRd}–{p.toRd}m
                        </text>
                        <text
                          x={cx}
                          y={206}
                          fontSize={8}
                          fill="#38bdf8"
                          textAnchor="middle"
                          fontWeight={700}
                        >
                          FoS: {p.unreinforcedContinuumFos.toFixed(2)} →{' '}
                          {p.reinforcedContinuumFos.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* 2. PER-ROUND 2D CROSS-SECTION SLICE VIEW (BEFORE VS AFTER SUPPORT FOR TUNNEL OR VERTICAL SHAFT) */}
          {(femViewMode === '3D_AND_2D' || femViewMode === 'CROSS_SECTION') && activeFemSlice && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 Cols: Side-by-Side Before Support vs After Support 2D Mesh & Plastic Zone Slices */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400">
                      Per-Round Cross-Section Slice (
                      {isShaft ? 'Vertical Shaft Section' : 'Tunnel Arch Section'})
                    </span>
                    <h4 className="text-sm font-black text-white">
                      {isShaft ? 'Depth' : 'RD'} {activeFemSlice.fromRd.toFixed(1)}m –{' '}
                      {activeFemSlice.toRd.toFixed(1)}m • {activeFemSlice.rockClass} (Q=
                      {activeFemSlice.qValue.toFixed(2)}, H=
                      {activeFemSlice.overburdenDepthM.toFixed(0)}m, σ₀=
                      {activeFemSlice.inSituStressMpa.toFixed(2)} MPa)
                    </h4>
                  </div>

                  <select
                    value={activeFemSlice.pullId}
                    onChange={(e) => setSelectedFemPullId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300"
                  >
                    {femDemProfile
                      .filter((r) => r.status === 'MAPPED')
                      .map((r) => (
                        <option key={r.pullId} value={r.pullId}>
                          {isShaft ? 'Depth' : 'RD'} {r.fromRd}–{r.toRd}m — {r.rockClass}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* BEFORE SUPPORT SLICE */}
                  <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-3 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between text-xs font-black text-rose-400 mb-1">
                      <span>A. BEFORE SUPPORT (UNREINFORCED)</span>
                      <span className="font-mono">
                        FoS = {activeFemSlice.unreinforcedContinuumFos.toFixed(2)}
                      </span>
                    </div>
                    <svg viewBox="0 0 260 220" className="w-full h-48">
                      {isShaft ? (
                        dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE' ? (
                          <path
                            d="M 55 140 A 75 75 0 0 1 205 140 Z"
                            fill="rgba(244, 63, 94, 0.22)"
                            stroke="#f43f5e"
                            strokeDasharray="4,3"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <circle
                            cx={130}
                            cy={110}
                            r={Math.min(95, 52 + activeFemSlice.unreinforcedPlasticRadiusM * 8)}
                            fill="rgba(244, 63, 94, 0.22)"
                            stroke="#f43f5e"
                            strokeDasharray="4,3"
                            strokeWidth={1.5}
                          />
                        )
                      ) : (
                        <path
                          d="M 48 175 L 48 105 A 82 82 0 0 1 212 105 L 212 175 Z"
                          fill="rgba(244, 63, 94, 0.22)"
                          stroke="#f43f5e"
                          strokeDasharray="4,3"
                          strokeWidth={1.5}
                        />
                      )}

                      {isShaft ? (
                        dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE' ? (
                          <>
                            <path
                              d="M 78 135 A 52 52 0 0 1 182 135 Z"
                              fill="#020617"
                              stroke="#fb7185"
                              strokeWidth={2.2}
                            />
                            <line
                              x1={78}
                              y1={135}
                              x2={182}
                              y2={135}
                              stroke="#fbbf24"
                              strokeWidth={3}
                              strokeDasharray={
                                dataset.shaftCenterMedianStatus === 'open' ? '6,4' : undefined
                              }
                            />
                          </>
                        ) : (
                          <circle
                            cx={130}
                            cy={110}
                            r={52}
                            fill="#020617"
                            stroke="#fb7185"
                            strokeWidth={2.2}
                          />
                        )
                      ) : (
                        <path
                          d="M 75 162 L 75 105 A 55 55 0 0 1 185 105 L 185 162 Z"
                          fill="#020617"
                          stroke="#fb7185"
                          strokeWidth={2.2}
                        />
                      )}

                      <polygon
                        points={isShaft ? '112,60 148,60 130,32' : '110,52 150,52 130,22'}
                        fill="rgba(244, 63, 94, 0.55)"
                        stroke="#fda4af"
                        strokeWidth={1.5}
                      />
                      <text
                        x={130}
                        y={204}
                        fontSize={9}
                        fill="#fda4af"
                        textAnchor="middle"
                        fontWeight={700}
                      >
                        u_max = {activeFemSlice.unreinforcedDispMm.toFixed(2)} mm | R_p ={' '}
                        {activeFemSlice.unreinforcedPlasticRadiusM.toFixed(2)} m
                      </text>
                    </svg>
                  </div>

                  {/* AFTER SUPPORT SLICE */}
                  <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between text-xs font-black text-emerald-400 mb-1">
                      <span>B. AFTER SUPPORT (REINFORCED)</span>
                      <span className="font-mono">
                        FoS = {activeFemSlice.reinforcedContinuumFos.toFixed(2)}
                      </span>
                    </div>
                    <svg viewBox="0 0 260 220" className="w-full h-48">
                      {isShaft ? (
                        dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE' ? (
                          <path
                            d="M 68 138 A 62 62 0 0 1 192 138 Z"
                            fill="rgba(16, 185, 129, 0.16)"
                            stroke="#10b981"
                            strokeDasharray="4,3"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <circle
                            cx={130}
                            cy={110}
                            r={Math.min(85, 52 + activeFemSlice.reinforcedPlasticRadiusM * 8)}
                            fill="rgba(16, 185, 129, 0.16)"
                            stroke="#10b981"
                            strokeDasharray="4,3"
                            strokeWidth={1.5}
                          />
                        )
                      ) : (
                        <path
                          d="M 64 168 L 64 105 A 66 66 0 0 1 196 105 L 196 168 Z"
                          fill="rgba(16, 185, 129, 0.16)"
                          stroke="#10b981"
                          strokeDasharray="4,3"
                          strokeWidth={1.5}
                        />
                      )}

                      {/* Radial Rock Bolts */}
                      {(isShaft
                        ? dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE'
                          ? [-150, -120, -90, -60, -30]
                          : [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
                        : [-165, -135, -105, -90, -75, -45, -15]
                      ).map((deg, idx) => {
                        const rad = (deg * Math.PI) / 180;
                        const cy =
                          isShaft && dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE'
                            ? 135
                            : 110;
                        const r1 = 52;
                        const r2 = 82;
                        return (
                          <line
                            key={idx}
                            x1={130 + r1 * Math.cos(rad)}
                            y1={cy + r1 * Math.sin(rad)}
                            x2={130 + r2 * Math.cos(rad)}
                            y2={cy + r2 * Math.sin(rad)}
                            stroke="#22d3ee"
                            strokeWidth={2}
                          />
                        );
                      })}

                      {isShaft ? (
                        dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE' ? (
                          <>
                            <path
                              d="M 78 135 A 52 52 0 0 1 182 135 Z"
                              fill="#020617"
                              stroke="#10b981"
                              strokeWidth={4}
                            />
                            <line
                              x1={78}
                              y1={135}
                              x2={182}
                              y2={135}
                              stroke="#10b981"
                              strokeWidth={3.5}
                              strokeDasharray={
                                dataset.shaftCenterMedianStatus === 'open' ? '6,4' : undefined
                              }
                            />
                          </>
                        ) : (
                          <circle
                            cx={130}
                            cy={110}
                            r={52}
                            fill="#020617"
                            stroke="#10b981"
                            strokeWidth={4}
                          />
                        )
                      ) : (
                        <path
                          d="M 75 162 L 75 105 A 55 55 0 0 1 185 105 L 185 162 Z"
                          fill="#020617"
                          stroke="#10b981"
                          strokeWidth={4}
                        />
                      )}

                      <polygon
                        points={isShaft ? '112,60 148,60 130,32' : '110,52 150,52 130,22'}
                        fill="rgba(16, 185, 129, 0.35)"
                        stroke="#6ee7b7"
                        strokeWidth={1.5}
                      />
                      <text
                        x={130}
                        y={204}
                        fontSize={9}
                        fill="#6ee7b7"
                        textAnchor="middle"
                        fontWeight={800}
                      >
                        u_sup = {activeFemSlice.reinforcedDispMm.toFixed(2)} mm (-
                        {activeFemSlice.dispReductionPct}%) | R_p ={' '}
                        {activeFemSlice.reinforcedPlasticRadiusM.toFixed(2)} m
                      </text>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Full-Length FEM/DEM Ledger Table */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                <h4 className="text-xs font-black uppercase tracking-wider text-white mb-2">
                  Continuous Round-by-Round FEM / DEM Verification Ledger
                </h4>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] uppercase">
                        <th className="py-2 px-2">Span ({isShaft ? 'Depth' : 'RD'})</th>
                        <th className="py-2 px-2">H (m) / σ₀</th>
                        <th className="py-2 px-2">Disp (Bef → Aft)</th>
                        <th className="py-2 px-2">Continuum FoS</th>
                        <th className="py-2 px-2">Wedge DEM FoS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {femDemProfile.map((r, idx) => {
                        if (r.status === 'MISSING_GAP') {
                          return (
                            <tr
                              key={`gap-row-${r.fromRd}-${idx}`}
                              className="border-b border-slate-800/70 bg-slate-950/60 text-slate-500 italic"
                            >
                              <td className="py-2 px-2 font-mono">{r.fromRd}–{r.toRd}m</td>
                              <td colSpan={4} className="py-2 px-2">
                                UNLOGGED CHAINAGE / DEPTH GAP — No Synthetic Interpolation
                              </td>
                            </tr>
                          );
                        }
                        const isSel = r.pullId === activeFemSlice.pullId;
                        return (
                          <tr
                            key={r.pullId}
                            onClick={() => setSelectedFemPullId(r.pullId)}
                            className={`border-b border-slate-800/70 cursor-pointer ${
                              isSel
                                ? 'bg-amber-500/15 text-white'
                                : 'hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <td className="py-2 px-2 font-mono font-bold">
                              {r.fromRd}–{r.toRd}m
                            </td>
                            <td className="py-2 px-2 font-mono">
                              {r.overburdenDepthM.toFixed(0)}m / {r.inSituStressMpa.toFixed(1)}MPa
                            </td>
                            <td className="py-2 px-2 font-mono">
                              <span className="text-rose-400">
                                {r.unreinforcedDispMm.toFixed(1)}
                              </span>{' '}
                              →{' '}
                              <span className="text-emerald-400 font-bold">
                                {r.reinforcedDispMm.toFixed(1)}mm
                              </span>
                            </td>
                            <td className="py-2 px-2 font-mono">
                              <span className="text-rose-400">
                                {r.unreinforcedContinuumFos.toFixed(2)}
                              </span>{' '}
                              →{' '}
                              <span className="text-emerald-400 font-black">
                                {r.reinforcedContinuumFos.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-mono">
                              <span className="text-rose-400">
                                {r.unreinforcedDiscreteWedgeFos.toFixed(2)}
                              </span>{' '}
                              →{' '}
                              <span className="text-cyan-300 font-black">
                                {r.reinforcedDiscreteWedgeFos.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
          STAGE 5: CONTINUOUS ADVANCED GEOTECHNICAL & FUTURE PREDICTIVE ANALYSIS
         ============================================================================ */}
      {activeWizardStage === 5 && (() => {
        const mappedAdv = advancedGeotechProfile.perPullAnalytics.filter((a) => a.status === 'MAPPED');
        const repPull = mappedAdv[mappedAdv.length - 1] || mappedAdv[0];
        const p0 = repPull?.inSituStressP0Mpa || 3.2;
        const pCr = repPull?.grcCriticalPressureMpa || 0.85;
        const pEq = repPull?.grcEquilibriumPressureMpa || 0.32;
        const uEq = repPull?.grcEquilibriumDispMm || 4.2;
        const uMax = Math.max(uEq * 2.4, advancedGeotechProfile.maxDispBeforeMm || 11.5);
        const stereo = advancedGeotechProfile.kinematicStereonetSummary;

        // Build Ground Reaction Curve (GRC) points (pi from p0 down to 0)
        const grcPoints: Array<{ u: number; p: number }> = [];
        for (let i = 0; i <= 24; i++) {
          const frac = i / 24;
          const pVal = p0 * (1 - frac);
          let uVal = 0;
          if (pVal >= pCr) {
            uVal = uEq * 0.45 * ((p0 - pVal) / Math.max(0.1, p0 - pCr));
          } else {
            const plastRatio = (pCr - pVal) / Math.max(0.05, pCr);
            uVal = uEq * 0.45 + (uMax - uEq * 0.45) * Math.pow(plastRatio, 1.85);
          }
          grcPoints.push({ u: uVal, p: pVal });
        }

        return (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-950 text-slate-100 space-y-5">
            {/* Stage 5 Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  Stage 5 of 6 • Comprehensive Source-Driven Geotechnical Mechanics &amp; +50m Future Predictive Suite
                </span>
                <h3 className="text-base font-black text-white">
                  Hoek-Brown / Mohr-Coulomb Mechanics • GRC-SCC Convergence • Kinematic Stereonet • Rockburst/Squeezing • Drill &amp; Blast • +50m Future Trajectory
                </h3>
                <p className="text-xs text-slate-400">
                  Synthesized from all logged field inputs ({isShaft ? 'Vertical Shaft Mode' : 'NATM Tunnel Mode'},{' '}
                  Ø{dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8}m, Overburden H ={' '}
                  {dataset.overburdenDepthM || 110}m, {dataset.traces.length} 3D Discontinuities,{' '}
                  {advancedGeotechProfile.mappedPullCount} Mapped Pulls).
                </p>
              </div>
              <button
                onClick={() => setActiveWizardStage(6)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                Next: Final A3 Landscape Report
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 6-Card Source-Driven Executive KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Mean Q / RMR / GSI / RQD
                </div>
                <div className="text-sm font-black text-cyan-300 font-mono mt-1">
                  Q={advancedGeotechProfile.meanQ.toFixed(2)} | RMR={advancedGeotechProfile.meanRmr}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  GSI={advancedGeotechProfile.meanGsi} | RQD={advancedGeotechProfile.meanRqd}%
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Hoek-Brown Rock Mass
                </div>
                <div className="text-sm font-black text-amber-300 font-mono mt-1">
                  σcm = {advancedGeotechProfile.meanSigmaCmMpa} MPa
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Erm = {advancedGeotechProfile.meanErmGpa} GPa | σci = {advancedGeotechProfile.meanUcsMpa} MPa
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Mohr-Coulomb Equivalent
                </div>
                <div className="text-sm font-black text-purple-300 font-mono mt-1">
                  c&apos; = {advancedGeotechProfile.meanCohesionMpa} MPa | φ&apos; = {advancedGeotechProfile.meanFrictionDeg}°
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Barton Joint φr = {stereo.meanFrictionAngleDeg}°
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Min FoS (Before → After)
                </div>
                <div className="text-sm font-black font-mono mt-1">
                  <span className="text-rose-400">
                    {advancedGeotechProfile.minFosBeforeSupport.toFixed(2)}
                  </span>{' '}
                  →{' '}
                  <span className="text-emerald-400">
                    {advancedGeotechProfile.minFosAfterSupport.toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Disp: {advancedGeotechProfile.maxDispBeforeMm} → {advancedGeotechProfile.maxDispAfterMm}mm
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  3D Kinematic Risk Index
                </div>
                <div className="text-sm font-black text-orange-300 font-mono mt-1">
                  Wedge {stereo.wedgeSlidingRiskPct}% | Planar {stereo.planarSlidingRiskPct}%
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Toppling {stereo.topplingBucklingRiskPct}% • Dom: {stereo.dominantSetId}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  +50m Future Horizon Alert
                </div>
                <div className="text-xs font-black text-emerald-300 mt-1">
                  {advancedGeotechProfile.lookAheadZones.some((z) => z.probeDrillingRequired)
                    ? 'Probe Drilling & Pre-Support Active'
                    : 'Controlled Advance Trajectory'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  4 Horizons (+0m to +50m ahead)
                </div>
              </div>
            </div>

            {/* Interactive Analytical Visual Row: GRC-SCC + LDP Chart & Lower-Hemisphere Kinematic Stereonet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Ground Reaction Curve (GRC) & Support Characteristic Curve (SCC) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      Convergence-Confinement Method (CCM) &amp; Vlachopoulos-Diederichs LDP
                    </div>
                    <h4 className="text-xs font-black text-white">
                      Ground Reaction Curve (GRC) vs. Installed Support Characteristic Curve (SCC)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300">
                    Equilibrium peq = {pEq.toFixed(2)} MPa @ ueq = {uEq.toFixed(1)} mm
                  </span>
                </div>

                <svg viewBox="0 0 520 220" className="w-full h-48 bg-slate-950 rounded-lg border border-slate-800">
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map((g, idx) => (
                    <g key={`grc-grid-${idx}`}>
                      <line
                        x1={55}
                        y1={20 + g * 165}
                        x2={495}
                        y2={20 + g * 165}
                        stroke="#1e293b"
                        strokeDasharray="3,3"
                      />
                      <line
                        x1={55 + g * 440}
                        y1={20}
                        x2={55 + g * 440}
                        y2={185}
                        stroke="#1e293b"
                        strokeDasharray="3,3"
                      />
                    </g>
                  ))}
                  {/* Axes */}
                  <line x1={55} y1={20} x2={55} y2={185} stroke="#64748b" strokeWidth={1.5} />
                  <line x1={55} y1={185} x2={495} y2={185} stroke="#64748b" strokeWidth={1.5} />

                  {/* Critical Plastic Pressure Horizontal Line */}
                  {(() => {
                    const yPcr = 185 - Math.min(1, pCr / Math.max(0.5, p0)) * 160;
                    return (
                      <g>
                        <line
                          x1={55}
                          y1={yPcr}
                          x2={495}
                          y2={yPcr}
                          stroke="#f59e0b"
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                        <text x={490} y={yPcr - 4} fontSize={8.5} fill="#fbbf24" textAnchor="end" fontWeight={700}>
                          Plastic Yield Threshold pcr = {pCr.toFixed(2)} MPa
                        </text>
                      </g>
                    );
                  })()}

                  {/* GRC Curve Path */}
                  <path
                    d={grcPoints
                      .map((pt, i) => {
                        const x = 55 + Math.min(1, pt.u / Math.max(1, uMax * 1.15)) * 430;
                        const y = 185 - Math.min(1, pt.p / Math.max(0.5, p0)) * 160;
                        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                  />

                  {/* Support Characteristic Curve (SCC) from u0 to Equilibrium */}
                  {(() => {
                    const u0 = uEq * ((repPull?.facePreRelaxationPct || 28) / 100);
                    const x0 = 55 + Math.min(1, u0 / Math.max(1, uMax * 1.15)) * 430;
                    const xEq = 55 + Math.min(1, uEq / Math.max(1, uMax * 1.15)) * 430;
                    const yEq = 185 - Math.min(1, pEq / Math.max(0.5, p0)) * 160;
                    const pMaxCap = Math.min(p0 * 0.9, pEq * 1.65);
                    const yCap = 185 - Math.min(1, pMaxCap / Math.max(0.5, p0)) * 160;
                    const xCap = Math.min(490, xEq + 38);
                    return (
                      <g>
                        <path
                          d={`M ${x0.toFixed(1)} 185 L ${xEq.toFixed(1)} ${yEq.toFixed(1)} L ${xCap.toFixed(1)} ${yCap.toFixed(1)}`}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={2.5}
                        />
                        <circle cx={xEq} cy={yEq} r={5} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
                        <text x={xEq + 8} y={yEq - 6} fontSize={9} fontWeight={800} fill="#34d399">
                          Equilibrium ({uEq.toFixed(1)}mm, {pEq.toFixed(2)}MPa)
                        </text>
                        <circle cx={x0} cy={185} r={3.5} fill="#a855f7" />
                        <text x={x0 + 4} y={176} fontSize={8} fontWeight={700} fill="#c084fc">
                          u0 ({u0.toFixed(1)}mm @ Face)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Axis Labels */}
                  <text x={275} y={210} fontSize={9.5} fontWeight={700} fill="#94a3b8" textAnchor="middle">
                    Radial Wall / Shaft Convergence Displacement u (mm) [Max Unreinforced = {uMax.toFixed(1)} mm]
                  </text>
                  <text
                    x={16}
                    y={105}
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#94a3b8"
                    textAnchor="middle"
                    transform="rotate(-90 16 105)"
                  >
                    Support Pressure pi (MPa)
                  </text>
                </svg>

                <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] font-mono">
                  <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9px]">IN-SITU STRESS P0</span>
                    <span className="text-white font-bold">{p0.toFixed(2)} MPa</span>
                  </div>
                  <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9px]">CRITICAL PRESSURE Pcr</span>
                    <span className="text-amber-300 font-bold">{pCr.toFixed(2)} MPa</span>
                  </div>
                  <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9px]">FACE PRE-RELAXATION</span>
                    <span className="text-purple-300 font-bold">{repPull?.facePreRelaxationPct || 28}% u/umax</span>
                  </div>
                  <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9px]">EQUILIBRIUM DISP ueq</span>
                    <span className="text-emerald-400 font-bold">{uEq.toFixed(2)} mm</span>
                  </div>
                </div>
              </div>

              {/* Right: Lower-Hemisphere Equal-Angle Kinematic Stereonet & Discontinuity Instability Matrix */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                      Lower-Hemisphere Equal-Angle Stereographic Projection
                    </div>
                    <h4 className="text-xs font-black text-white">
                      3D Discontinuity Poles, Great Circles &amp; Kinematic Instability Susceptibility
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-[10px] font-mono font-bold text-purple-300">
                    {stereo.totalDiscontinuities} Mapped Planes • Dom: {stereo.dominantSetId}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-950 rounded-lg border border-slate-800 p-2.5">
                  <div className="sm:col-span-6 flex justify-center">
                    <svg viewBox="0 0 210 210" className="w-44 h-44">
                      {/* Outer Primitive Circle */}
                      <circle cx={105} cy={105} r={82} fill="#090d16" stroke="#475569" strokeWidth={1.8} />
                      {/* Dip Pitch Circles (30 deg, 60 deg) */}
                      <circle cx={105} cy={105} r={54} fill="none" stroke="#1e293b" strokeDasharray="3,3" />
                      <circle cx={105} cy={105} r={27} fill="none" stroke="#1e293b" strokeDasharray="3,3" />
                      {/* Friction Cone Circle */}
                      <circle
                        cx={105}
                        cy={105}
                        r={Math.max(18, Math.min(75, (stereo.meanFrictionAngleDeg / 90) * 82))}
                        fill="rgba(245, 158, 11, 0.07)"
                        stroke="#f59e0b"
                        strokeWidth={1.1}
                        strokeDasharray="4,2"
                      />
                      {/* Cardinal Crosshairs */}
                      <line x1={105} y1={18} x2={105} y2={192} stroke="#334155" strokeWidth={1} />
                      <line x1={18} y1={105} x2={192} y2={105} stroke="#334155" strokeWidth={1} />
                      <text x={105} y={13} fontSize={9} fontWeight={800} fill="#94a3b8" textAnchor="middle">
                        N (000°)
                      </text>
                      <text x={199} y={108} fontSize={8.5} fontWeight={700} fill="#64748b" textAnchor="middle">
                        E
                      </text>
                      <text x={105} y={203} fontSize={8.5} fontWeight={700} fill="#64748b" textAnchor="middle">
                        S
                      </text>
                      <text x={10} y={108} fontSize={8.5} fontWeight={700} fill="#64748b" textAnchor="middle">
                        W
                      </text>

                      {/* Plot Great Circle Arcs & Poles for each mapped discontinuity */}
                      {stereo.poles.map((pole) => {
                        // Pole azimuth = dipDirection + 180 deg, radial distance proportional to dip
                        const poleAzRad = (((pole.dipDirectionDeg + 180) % 360) * Math.PI) / 180;
                        const rPole = (Math.min(89, Math.max(2, pole.dipDeg)) / 90) * 82;
                        const px = 105 + rPole * Math.sin(poleAzRad);
                        const py = 105 - rPole * Math.cos(poleAzRad);

                        // Great circle strike endpoints + dip apex
                        const strike1Rad = (((pole.dipDirectionDeg - 90 + 360) % 360) * Math.PI) / 180;
                        const strike2Rad = (((pole.dipDirectionDeg + 90) % 360) * Math.PI) / 180;
                        const dipAzRad = (pole.dipDirectionDeg * Math.PI) / 180;
                        const rApex = ((90 - pole.dipDeg) / 90) * 82;
                        const x1 = 105 + 82 * Math.sin(strike1Rad);
                        const y1 = 105 - 82 * Math.cos(strike1Rad);
                        const x2 = 105 + 82 * Math.sin(strike2Rad);
                        const y2 = 105 - 82 * Math.cos(strike2Rad);
                        const xm = 105 + rApex * Math.sin(dipAzRad);
                        const ym = 105 - rApex * Math.cos(dipAzRad);

                        return (
                          <g key={pole.id}>
                            <path
                              d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${xm.toFixed(1)} ${ym.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                              fill="none"
                              stroke={pole.colorHex}
                              strokeWidth={1.1}
                              strokeOpacity={0.55}
                            />
                            <circle
                              cx={px}
                              cy={py}
                              r={pole.isCritical ? 4.2 : 3.2}
                              fill={pole.isCritical ? '#f43f5e' : pole.colorHex}
                              stroke="#ffffff"
                              strokeWidth={1}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="sm:col-span-6 space-y-2.5 pr-1">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-300">Wedge Sliding / Fallout Susceptibility</span>
                        <span className="font-mono text-amber-300">{stereo.wedgeSlidingRiskPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${Math.max(6, stereo.wedgeSlidingRiskPct)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-300">Planar Daylight Sliding Susceptibility</span>
                        <span className="font-mono text-cyan-300">{stereo.planarSlidingRiskPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${Math.max(6, stereo.planarSlidingRiskPct)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-300">Flexural Toppling / Slab Buckling</span>
                        <span className="font-mono text-purple-300">{stereo.topplingBucklingRiskPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${Math.max(6, stereo.topplingBucklingRiskPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block">MEAN ORIENTATION</span>
                        <span className="text-white font-bold">
                          {stereo.meanDipDeg}° / {String(stereo.meanDipDirectionDeg).padStart(3, '0')}°
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block">FRICTION CONE φr</span>
                        <span className="text-amber-300 font-bold">{stereo.meanFrictionAngleDeg}° (Dashed)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MODULE 1: Generalized Hoek-Brown, Equivalent Mohr-Coulomb, Rockburst/Spalling & Squeezing Schedule */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Module 1 — Generalized Hoek-Brown (mb, s, a, σcm, Erm), Mohr-Coulomb (c&apos;, φ&apos;), Brittle Rockburst &amp; Squeezing Strain Schedule
                </span>
                <span className="text-[11px] text-cyan-300 font-mono">
                  Hoek et al. (2002) • Hoek-Diederichs (2006) • Martin-Kaiser Spalling (σθ,max / σci)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Interval</th>
                      <th className="py-2.5 px-3">Lithology &amp; σci</th>
                      <th className="py-2.5 px-3">Hoek-Brown (mb / s / a)</th>
                      <th className="py-2.5 px-3">Rock Mass σcm &amp; Erm</th>
                      <th className="py-2.5 px-3">Mohr-Coulomb (c&apos; / φ&apos;)</th>
                      <th className="py-2.5 px-3">Hoop Stress σθ,max &amp; Spalling Ratio</th>
                      <th className="py-2.5 px-3">Rockburst / Brittle Class</th>
                      <th className="py-2.5 px-3">Squeezing Strain εt (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedGeotechProfile.perPullAnalytics.map((r, idx) => {
                      if (r.status === 'MISSING_GAP') {
                        return (
                          <tr
                            key={`hb-gap-${r.fromRd}-${idx}`}
                            className="border-b border-slate-800/70 bg-slate-950/50 text-slate-500 italic"
                          >
                            <td className="py-2 px-3 font-mono">
                              {r.fromRd.toFixed(1)}–{r.toRd.toFixed(1)}m
                            </td>
                            <td colSpan={7} className="py-2 px-3">
                              UNLOGGED GAP — Blank interval bounded by dashed {isShaft ? 'depth' : 'RD'} lines
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`hb-${r.pullId}`} className="border-b border-slate-800/70 text-slate-200 hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                            {r.fromRd.toFixed(1)}–{r.toRd.toFixed(1)}m
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">{r.rockType}</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              σci = {r.intactUcsMpa} MPa | mi = {r.miConstant}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300">
                            mb={r.mbParam} | s={r.sParam} | a={r.aParam}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-amber-300">σcm = {r.sigmaCmMpa} MPa</span>
                            <span className="block text-[10px] text-slate-400">Erm = {r.ermGpa} GPa</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-purple-300">
                            c&apos; = {r.cohesionMpa} MPa | φ&apos; = {r.frictionAngleDeg}°
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="text-white font-bold">σθ = {r.tangentialStressMaxMpa} MPa</span>
                            <span className="block text-[10px] text-slate-400">
                              σθ/σci = {r.spallingRatio.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.rockburstClass === 'SEVERE_STRAINBURST' || r.rockburstClass === 'MODERATE_SLABBING'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : r.rockburstClass === 'MINOR_SPALLING'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {r.rockburstClass}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-white">{r.squeezingStrainPct.toFixed(2)}%</span>{' '}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                r.squeezePotential !== 'NONE'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {r.squeezePotential}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODULE 2: Empirical Verification & Drill-and-Blast / Excavation Advance Optimization Schedule */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Module 2 — Support Margin, Stand-Up Time, Hydro-Seepage &amp; Drill-and-Blast / Advance Optimization
                </span>
                <span className="text-[11px] text-emerald-300 font-mono">
                  Optimal Pull Length • Powder Factor (kg/m³) • Perimeter Spacing • Overbreak &amp; Shotcrete Rebound Predictor
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Interval</th>
                      <th className="py-2.5 px-3">Q / RMR / GSI / RQD</th>
                      <th className="py-2.5 px-3">Support Margin</th>
                      <th className="py-2.5 px-3">Stand-Up Time &amp; Max Span</th>
                      <th className="py-2.5 px-3">Water Inflow</th>
                      <th className="py-2.5 px-3">Optimal Advance Pull</th>
                      <th className="py-2.5 px-3">Powder Factor &amp; Perim. Spacing</th>
                      <th className="py-2.5 px-3">Predicted Overbreak &amp; SFRS Rebound</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedGeotechProfile.perPullAnalytics.map((r, idx) => {
                      if (r.status === 'MISSING_GAP') {
                        return null;
                      }
                      return (
                        <tr key={`db-${r.pullId}-${idx}`} className="border-b border-slate-800/70 text-slate-200 hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                            {r.fromRd.toFixed(1)}–{r.toRd.toFixed(1)}m
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            Q={r.qValue.toFixed(2)} | RMR={r.rmrValue} | GSI={r.gsiValue} | RQD={r.rqdValue}%
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={
                                r.supportMarginRatio >= 1.2
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-300 font-bold'
                              }
                            >
                              {r.supportMarginRatio.toFixed(2)}x Capacity
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-300">
                            {r.standUpTimeHours >= 24
                              ? `${(r.standUpTimeHours / 24).toFixed(1)} days`
                              : `${r.standUpTimeHours.toFixed(1)} hrs`}{' '}
                            • Span {r.maxUnsupportedSpanM.toFixed(1)}m
                          </td>
                          <td className="py-2.5 px-3 font-mono text-blue-300">
                            {r.waterInflowLMinPer10m.toFixed(1)} L/min/10m
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-300">
                            {r.optimalAdvanceM.toFixed(2)} m / round
                          </td>
                          <td className="py-2.5 px-3 font-mono text-purple-300">
                            {r.powderFactorKgM3.toFixed(2)} kg/m³ • S={r.perimeterHoleSpacingM.toFixed(2)}m
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="text-amber-300 font-bold">OB {r.predictedOverbreakPct}%</span> •{' '}
                            <span className="text-slate-300">Rebound {r.shotcreteReboundPct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODULE 3: Multi-Horizon +50m Future Look-Ahead / Sink-Ahead Trajectory & Predictive Trigger Suite */}
            <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
                    Module 3 — Multi-Horizon +50m Future {isShaft ? 'Sink-Ahead' : 'Look-Ahead'} Predictive Trajectory
                  </span>
                  <h4 className="text-sm font-black text-white">
                    Extrapolated Q / RMR / Water Inflow Trajectory, Structural Intersection Probability &amp; Probe-Drilling / Pre-Grouting Triggers
                  </h4>
                </div>
                <span className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-[11px] font-mono font-bold text-purple-200">
                  Forecast Horizon: {isShaft ? 'Depth' : 'RD'} {dataset.viewToRd.toFixed(1)}m →{' '}
                  {(dataset.viewToRd + 50).toFixed(1)}m (+50m)
                </span>
              </div>

              {/* Longitudinal Mapped + Future Trajectory SVG Chart */}
              {(() => {
                const chartNodes = [
                  ...mappedAdv.map((m) => ({
                    rd: Number(((m.fromRd + m.toRd) / 2).toFixed(1)),
                    label: `${m.fromRd}–${m.toRd}m`,
                    rmr: m.rmrValue,
                    q: m.qValue,
                    water: m.waterInflowLMinPer10m,
                    isFuture: false,
                  })),
                  ...advancedGeotechProfile.lookAheadZones.map((lz) => ({
                    rd: Number(((lz.fromRd + lz.toRd) / 2).toFixed(1)),
                    label: `+${Math.round(lz.fromRd - dataset.viewToRd)}–${Math.round(lz.toRd - dataset.viewToRd)}m`,
                    rmr: lz.predictedRmr,
                    q: lz.predictedQ,
                    water: lz.predictedWaterLMin,
                    isFuture: true,
                  })),
                ];
                if (chartNodes.length < 2) return null;
                const cW = 920;
                const cH = 155;
                const padX = 55;
                const plotCW = cW - padX * 2;
                const xForIdx = (i: number) =>
                  padX + (i / Math.max(1, chartNodes.length - 1)) * plotCW;
                const yForRmr = (rmr: number) => 128 - (Math.min(100, Math.max(0, rmr)) / 100) * 100;
                const yForWater = (w: number) => 128 - (Math.min(40, Math.max(0, w)) / 40) * 100;
                const futureStartIdx = mappedAdv.length;
                const splitX =
                  futureStartIdx > 0 && futureStartIdx < chartNodes.length
                    ? (xForIdx(futureStartIdx - 1) + xForIdx(futureStartIdx)) / 2
                    : padX;

                return (
                  <svg
                    viewBox={`0 0 ${cW} ${cH}`}
                    className="w-full h-40 bg-slate-950 rounded-lg border border-slate-800"
                  >
                    {/* Shaded Future Region */}
                    <rect
                      x={splitX}
                      y={16}
                      width={Math.max(10, cW - padX - splitX)}
                      height={114}
                      fill="rgba(168, 85, 247, 0.08)"
                    />
                    <line
                      x1={splitX}
                      y1={16}
                      x2={splitX}
                      y2={130}
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                    />
                    <text x={splitX + 8} y={28} fontSize={9} fontWeight={800} fill="#d8b4fe">
                      CURRENT FACE ({dataset.viewToRd.toFixed(1)}m) → +50m FUTURE PREDICTIVE ZONE
                    </text>

                    {/* RMR Trajectory Polyline */}
                    <path
                      d={chartNodes
                        .map((n, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForRmr(n.rmr).toFixed(1)}`)
                        .join(' ')}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={2.4}
                    />
                    {/* Water Inflow Trajectory Polyline */}
                    <path
                      d={chartNodes
                        .map((n, i) => `${i === 0 ? 'M' : 'L'} ${xForIdx(i).toFixed(1)} ${yForWater(n.water).toFixed(1)}`)
                        .join(' ')}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth={1.8}
                      strokeDasharray="4,3"
                    />

                    {chartNodes.map((n, i) => {
                      const cx = xForIdx(i);
                      const cy = yForRmr(n.rmr);
                      return (
                        <g key={`traj-node-${i}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill={n.isFuture ? '#a855f7' : '#22d3ee'}
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                          <text
                            x={cx}
                            y={cy - 7}
                            fontSize={8.5}
                            fontWeight={800}
                            fill={n.isFuture ? '#e9d5ff' : '#67e8f9'}
                            textAnchor="middle"
                          >
                            RMR {n.rmr} (Q={n.q})
                          </text>
                          <text
                            x={cx}
                            y={145}
                            fontSize={8.5}
                            fontWeight={700}
                            fill={n.isFuture ? '#c084fc' : '#94a3b8'}
                            textAnchor="middle"
                          >
                            {n.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}

              {/* 4 Multi-Horizon Future Forecast Cards (+0–5m, +5–15m, +15–30m, +30–50m) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {advancedGeotechProfile.lookAheadZones.map((lz) => (
                  <div
                    key={lz.zoneLabel}
                    className="bg-slate-950 border border-purple-500/30 rounded-xl p-3.5 flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-purple-300">
                          {lz.horizonTag}
                        </span>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-300 mt-0.5">
                        {isShaft ? 'Depth' : 'RD'} {lz.fromRd.toFixed(1)}–{lz.toRd.toFixed(1)}m
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-slate-900 p-2 rounded border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[9px]">PREDICTED Q / RMR</span>
                        <span className="text-cyan-300 font-bold">
                          Q={lz.predictedQ.toFixed(2)} | RMR={lz.predictedRmr}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">WATER / FAULT PROB</span>
                        <span className="text-blue-300 font-bold">
                          {lz.predictedWaterLMin} L/m • {lz.faultShearProbabilityPct}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          lz.probeDrillingRequired
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {lz.probeDrillingRequired ? 'Probe Drill: REQUIRED (20m)' : 'Probe Drill: Routine'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          lz.preGroutingRequired
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {lz.preGroutingRequired ? 'Pre-Grouting: ACTIVE' : `Pull: ${lz.recommendedAdvanceM}m`}
                      </span>
                    </div>

                    <div className="text-[11px] text-amber-300 font-bold leading-snug">
                      {lz.recommendedSupportClass}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-relaxed">
                      {lz.hazardAdvisory}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
          STAGE 6: FINAL A3 LANDSCAPE CONTINUOUS ENGINEERING REPORT
         ============================================================================ */}
      {activeWizardStage === 6 && (
        <div className="flex-1 overflow-auto p-4 md:p-6 flex justify-center items-start bg-slate-950 print:p-0 print:bg-white">
          <div
            id="a3-continuous-tunnel-sheet"
            className="w-[1480px] min-w-[1480px] bg-white text-slate-900 shadow-2xl border-2 border-slate-900 p-4 print:shadow-none print:border-slate-900"
          >
            <div className="border-2 border-slate-900 flex flex-col">
              {/* 1. TOP HEADER BAR */}
              <div className="grid grid-cols-12 border-b-2 border-slate-900 bg-slate-100 text-xs">
                <div className="col-span-5 p-2.5 border-r border-slate-900 flex flex-col justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ISO / ISRM Standard Underground Engineering Geological Log (A3 Landscape)
                  </div>
                  <div className="text-base font-black uppercase tracking-tight text-slate-900">
                    {isShaft
                      ? `CONTINUOUS 3D VERTICAL SHAFT GEOLOGICAL LOG & FEM/DEM LEDGER (${
                          dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE'
                            ? `HALF-CIRCLE • MEDIAN ${(dataset.shaftCenterMedianStatus || 'closed').toUpperCase()}`
                            : 'FULL 360° CIRCLE'
                        })`
                      : 'CONTINUOUS 3D EXCAVATION GEOLOGICAL STRIP LOG & FEM/DEM LEDGER'}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700">
                    Project: <span className="font-bold text-slate-950">{dataset.projectName}</span>
                  </div>
                </div>

                <div className="col-span-4 p-2.5 border-r border-slate-900 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-semibold">
                      {isShaft ? 'Shaft Location:' : 'Heading / Adit:'}
                    </span>{' '}
                    <span className="font-bold text-slate-900">{dataset.tunnelLocationName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Client / Contractor:</span>{' '}
                    <span className="font-bold text-slate-900">
                      {dataset.clientName} / {dataset.contractorName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Span / Diameter:</span>{' '}
                    <span className="font-bold text-slate-900">
                      Ø{dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8.0}m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">
                      {isShaft ? 'Depth Interval:' : 'Chainage Interval:'}
                    </span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {isShaft ? 'Depth' : 'RD'} {startRd.toFixed(1)}m – {endRd.toFixed(1)}m
                    </span>
                  </div>
                </div>

                <div className="col-span-3 p-2.5 flex flex-col justify-between text-[11px] bg-slate-50">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Drawing No:</span>
                    <span className="font-mono font-bold text-slate-900">
                      NATM-3D-{dataset.id.slice(0, 12).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Projection Method:</span>
                    <span className="font-bold text-slate-900">
                      {isShaft
                        ? 'Unfolded 4-Quadrant (NE | ES | SW | WN)'
                        : 'Unfolded Arch (LW | Crown | RW)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-500">Mapped / Gaps:</span>
                    <span className="font-bold text-emerald-700">
                      {dataset.pulls.filter((p) => p.status === 'MAPPED').length} Pulls /{' '}
                      {dataset.pulls.filter((p) => p.status === 'MISSING_GAP').length} Blank Gaps
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. CONTINUOUS DEVELOPED GEOLOGICAL MAP (EXACT ESWA CAD 2D STRIP CANVAS VIEW) */}
              <div className="border-b-2 border-slate-900 relative bg-white">
                <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between">
                  <span>
                    Section 1 — ESWA CAD Developed Geological Map: Lithology Zones, Discontinuity Joint Traces, Strike/Dip Ticks &amp; Seepage (
                    {isShaft
                      ? 'Unfolded 4-Quadrant Shaft Wall: 1. NE 0°–90° | 2. ES 90°–180° | 3. SW 180°–270° | 4. WN 270°–360°'
                      : 'Unfolded Tunnel Perimeter: Left Wall | Crown Arch | Right Wall'}
                    )
                  </span>
                  <span className="font-mono text-amber-300">
                    Total Developed Perimeter = {totalUnrolledWidthM.toFixed(1)}m • Synchronized 1:1 with ESWA 3D CAD Canvas
                  </span>
                </div>

                {(() => {
                  const getCadRockDef = (rockType?: string, codeSym?: string) => {
                    const exact =
                      ROCK_TYPES.find((r) => r.id === rockType) ||
                      ROCK_TYPES.find((r) => r.id === codeSym);
                    if (exact) return exact;
                    const rl = (rockType || codeSym || '').toLowerCase();
                    if (rl.includes('granite') || rl === 'gr') return ROCK_TYPES.find((r) => r.id === 'Gr')!;
                    if (rl.includes('gneiss') || rl === 'gn') return ROCK_TYPES.find((r) => r.id === 'Gn')!;
                    if (rl.includes('phyllite') && rl.includes('quartz')) return ROCK_TYPES.find((r) => r.id === 'QP')!;
                    if (rl.includes('schist') || rl === 'sch') return ROCK_TYPES.find((r) => r.id === 'Sch')!;
                    if (rl.includes('phyllite') || rl === 'ph') return ROCK_TYPES.find((r) => r.id === 'Ph')!;
                    if (rl.includes('limestone') || rl.includes('dolomite') || rl === 'ls') return ROCK_TYPES.find((r) => r.id === 'Ls')!;
                    if (rl.includes('basalt') || rl.includes('dolerite') || rl === 'bas') return ROCK_TYPES.find((r) => r.id === 'Bas')!;
                    if (rl.includes('shale') || rl.includes('siltstone') || rl === 'sl') return ROCK_TYPES.find((r) => r.id === 'Sl')!;
                    if (rl.includes('sandstone') || rl === 'ss') return ROCK_TYPES.find((r) => r.id === 'Ss')!;
                    if (rl.includes('fault') || rl.includes('gouge')) return ROCK_TYPES.find((r) => r.id === 'FaultGouge')!;
                    return ROCK_TYPES[0];
                  };

                  const getPatternUrlForRockDef = (rockDef: { id: string; pattern: string }) => {
                    if (rockDef.pattern === 'dots' || rockDef.id === 'Qtz' || rockDef.id === 'Ss') return 'url(#cad-pat-dots)';
                    if (rockDef.pattern === 'cross' || rockDef.id === 'Gr') return 'url(#cad-pat-cross)';
                    if (rockDef.pattern === 'brick' || rockDef.id === 'Ls') return 'url(#cad-pat-brick)';
                    if (rockDef.pattern === 'lines' || rockDef.id === 'Ph' || rockDef.id === 'Sch') return 'url(#cad-pat-lines)';
                    if (rockDef.pattern === 'wavy' || rockDef.id === 'Gn') return 'url(#cad-pat-wavy)';
                    if (rockDef.pattern === 'hatch' || rockDef.id === 'QP') return 'url(#cad-pat-hatch)';
                    if (rockDef.pattern === 'dashes' || rockDef.id === 'Sl') return 'url(#cad-pat-dashes)';
                    if (rockDef.pattern === 'zigzag' || rockDef.id === 'FaultGouge') return 'url(#cad-pat-zigzag)';
                    return 'none';
                  };

                  // Build 1m minor and 5m major vertical grid lines matching ESWA CAD Canvas
                  const gridChList: number[] = [];
                  for (let ch = Math.ceil(startRd); ch <= endRd; ch += 1) {
                    gridChList.push(ch);
                  }

                  return (
                    <svg
                      ref={stripSvgRef}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-[290px] select-none bg-white"
                    >
                      <defs>
                        <clipPath id="eswa-cad-strip-clip">
                          <rect x={padL} y={padT} width={plotW} height={plotH} />
                        </clipPath>
                        {/* Exact ESWA CAD Canvas Procedural Geological Patterns */}
                        <pattern id="cad-pat-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                          <circle cx="3" cy="3" r="1.2" fill="rgba(0,0,0,0.20)" />
                          <circle cx="10" cy="10" r="1.2" fill="rgba(0,0,0,0.20)" />
                        </pattern>
                        <pattern id="cad-pat-cross" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 7 10 L 13 10 M 10 7 L 10 13" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-brick" width="22" height="20" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="0" x2="22" y2="0" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                          <line x1="0" y1="10" x2="22" y2="10" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                          <line x1="11" y1="10" x2="11" y2="20" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-lines" width="14" height="20" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="0" x2="14" y2="20" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-wavy" width="20" height="14" patternUnits="userSpaceOnUse">
                          <path d="M 0 7 Q 5 4 10 7 T 20 7" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-hatch" width="18" height="18" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="0" x2="18" y2="18" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                          <line x1="18" y1="0" x2="0" y2="18" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-dashes" width="14" height="10" patternUnits="userSpaceOnUse">
                          <line x1="2" y1="3" x2="8" y2="3" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                          <line x1="7" y1="8" x2="13" y2="8" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
                        </pattern>
                        <pattern id="cad-pat-zigzag" width="14" height="14" patternUnits="userSpaceOnUse">
                          <polyline points="0,7 4,3 9,11 14,7" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.8" />
                        </pattern>
                      </defs>

                      {/* 1. Pure White Strip Background */}
                      <rect x={padL} y={padT} width={plotW} height={plotH} fill="#ffffff" />

                      {/* 2. CAD Engineering Grid (1m Minor & 5m Major Vertical Chainage/Depth Lines + Top/Bottom Labels) */}
                      {gridChList.map((ch) => {
                        const scrX = rdToX(ch);
                        const isMajor = ch % 5 === 0;
                        const prefix = isShaft ? 'DEPTH' : 'RD';
                        return (
                          <g key={`cad-grid-${ch}`}>
                            <line
                              x1={scrX}
                              y1={padT}
                              x2={scrX}
                              y2={padT + plotH}
                              stroke={isMajor ? '#e2e8f0' : '#f1f5f9'}
                              strokeWidth={isMajor ? 1 : 0.5}
                            />
                            {isMajor && (
                              <>
                                <text
                                  x={scrX}
                                  y={padT - 6}
                                  fontSize={8.5}
                                  fontFamily="monospace"
                                  fontWeight={700}
                                  fill="#ea580c"
                                  textAnchor="middle"
                                >
                                  {prefix} {ch.toFixed(1)}m
                                </text>
                                <text
                                  x={scrX}
                                  y={padT + plotH + 14}
                                  fontSize={8.5}
                                  fontFamily="monospace"
                                  fontWeight={700}
                                  fill="#ea580c"
                                  textAnchor="middle"
                                >
                                  {prefix} {ch.toFixed(1)}m
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}

                      {/* Clipped Interior Layers (Lithology Zones, Pull Boundaries, Joint Traces, Water Symbols, Custom Text) */}
                      <g clipPath="url(#eswa-cad-strip-clip)">
                        {/* 3. Lithology Zones Layer (`dataset.lithologyZones` directly from ESWA CAD) */}
                        {(dataset.lithologyZones || []).map((zone) => {
                          if (!zone.polygon || zone.polygon.length < 3) return null;
                          const rockDef = getCadRockDef(zone.rockType, zone.codeSymbol);
                          const patUrl = getPatternUrlForRockDef(rockDef);
                          const polyPts = zone.polygon
                            .map((pt) => `${rdToX(pt.x).toFixed(1)},${yToSvgY(pt.y).toFixed(1)}`)
                            .join(' ');
                          const avgX =
                            zone.polygon.reduce((sum, p) => sum + p.x, 0) / zone.polygon.length;
                          const avgY =
                            zone.polygon.reduce((sum, p) => sum + p.y, 0) / zone.polygon.length;
                          const lx = rdToX(avgX);
                          const ly = yToSvgY(avgY);
                          const lbl = zone.label || rockDef.label;

                          return (
                            <g key={zone.id}>
                              <polygon
                                points={polyPts}
                                fill={`${rockDef.color}38`}
                                stroke={rockDef.color}
                                strokeWidth={1.2}
                              />
                              {patUrl !== 'none' && <polygon points={polyPts} fill={patUrl} />}
                              <text
                                x={lx}
                                y={ly}
                                fontSize={10}
                                fontWeight={700}
                                fill="#1e293b"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                stroke="rgba(255,255,255,0.95)"
                                strokeWidth={3}
                                paintOrder="stroke"
                              >
                                {lbl}
                              </text>
                            </g>
                          );
                        })}

                        {/* 4. Horizontal Zone Divider Lines (3-Zone Tunnel OR 4-Quadrant Vertical Shaft) */}
                        {isShaft ? (
                          <>
                            <line
                              x1={padL}
                              y1={yShaftQ1}
                              x2={svgW - padR}
                              y2={yShaftQ1}
                              stroke="rgba(2, 132, 199, 0.28)"
                              strokeWidth={1.0}
                              strokeDasharray="6,6"
                            />
                            <line
                              x1={padL}
                              y1={yShaftQ2}
                              x2={svgW - padR}
                              y2={yShaftQ2}
                              stroke="rgba(2, 132, 199, 0.28)"
                              strokeWidth={1.0}
                              strokeDasharray="6,6"
                            />
                            <line
                              x1={padL}
                              y1={yShaftQ3}
                              x2={svgW - padR}
                              y2={yShaftQ3}
                              stroke="rgba(2, 132, 199, 0.28)"
                              strokeWidth={1.0}
                              strokeDasharray="6,6"
                            />
                          </>
                        ) : (
                          <>
                            <line
                              x1={padL}
                              y1={yTunnelCrownTop}
                              x2={svgW - padR}
                              y2={yTunnelCrownTop}
                              stroke="rgba(2, 132, 199, 0.28)"
                              strokeWidth={1.0}
                              strokeDasharray="6,6"
                            />
                            <line
                              x1={padL}
                              y1={yTunnelRightWallTop}
                              x2={svgW - padR}
                              y2={yTunnelRightWallTop}
                              stroke="rgba(2, 132, 199, 0.28)"
                              strokeWidth={1.0}
                              strokeDasharray="6,6"
                            />
                          </>
                        )}

                        {/* 5. Excavation Pull Rounds Layer & True-Scale Blank Unlogged Gaps (`MISSING_GAP`) */}
                        {(dataset.pulls || []).map((pull, idx) => {
                          const pullStartX = rdToX(pull.fromRd);
                          const pullEndX = rdToX(pull.toRd);
                          const isGap = pull.status === 'MISSING_GAP';

                          if (isGap) {
                            return (
                              <g key={`cad-gap-${pull.fromRd}-${pull.toRd}-${idx}`}>
                                <rect
                                  x={pullStartX}
                                  y={padT}
                                  width={Math.max(1, pullEndX - pullStartX)}
                                  height={plotH}
                                  fill="#ffffff"
                                />
                                <line
                                  x1={pullStartX}
                                  y1={padT}
                                  x2={pullStartX}
                                  y2={padT + plotH}
                                  stroke="#64748b"
                                  strokeWidth={1.6}
                                  strokeDasharray="6,4"
                                />
                                <line
                                  x1={pullEndX}
                                  y1={padT}
                                  x2={pullEndX}
                                  y2={padT + plotH}
                                  stroke="#64748b"
                                  strokeWidth={1.6}
                                  strokeDasharray="6,4"
                                />
                                <text
                                  x={(pullStartX + pullEndX) / 2}
                                  y={padT + plotH / 2}
                                  fontSize={9.5}
                                  fontFamily="monospace"
                                  fontWeight={700}
                                  fill="#64748b"
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  UNLOGGED GAP ({pull.fromRd.toFixed(1)}–{pull.toRd.toFixed(1)}m)
                                </text>
                              </g>
                            );
                          }

                          const midX = (pullStartX + pullEndX) / 2;
                          const pullLabel = `${pull.excavationDefiningNo || 'PULL'} (${pull.fromRd.toFixed(1)}–${pull.toRd.toFixed(1)}m)`;
                          return (
                            <g key={`cad-pull-${pull.id}-${idx}`}>
                              <line
                                x1={pullEndX}
                                y1={padT}
                                x2={pullEndX}
                                y2={padT + plotH}
                                stroke="#eab308"
                                strokeWidth={1}
                                strokeDasharray="4,2"
                              />
                              <text
                                x={midX}
                                y={padT + 12}
                                fontSize={9.5}
                                fontFamily="monospace"
                                fontWeight={700}
                                fill="#b45309"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                stroke="rgba(255,255,255,0.9)"
                                strokeWidth={2.5}
                                paintOrder="stroke"
                              >
                                {pullLabel}
                              </text>
                            </g>
                          );
                        })}

                        {/* 6. Discontinuity Joint Traces Layer (`dataset.traces` — Exact ESWA CAD Rendering, No Dip Surface Ribbons) */}
                        {(dataset.traces || []).map((trace) => {
                          const points = trace.points || [];
                          if (points.length < 2) return null;
                          const isSelected = trace.id === selectedTraceId;
                          const color = resolveStripTraceColor(trace);

                          const svgPts = points.map((pt) => ({
                            x: rdToX(pt.x),
                            y: yToSvgY(pt.y),
                          }));
                          const dPath = svgPts
                            .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
                            .join(' ');

                          const dashArray =
                            trace.structureType === 'Shear Zone'
                              ? '7,3'
                              : trace.structureType === 'Bedding/Foliation'
                              ? '3,3'
                              : undefined;

                          // Structural Geology Dip Tick & Dip Angle Label matching ESWA CAD
                          const midIdx = Math.floor(svgPts.length / 2);
                          const p1 = svgPts[Math.max(0, midIdx - 1)];
                          const p2 = svgPts[Math.min(svgPts.length - 1, midIdx + 1)];
                          const midPt = svgPts[midIdx];

                          const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                          const tickSide = trace.dipTickSide === 'left' ? -1 : 1;
                          const tickLen = 10;
                          const tickAngle = segAngle + (Math.PI / 2) * tickSide;

                          const tx = midPt.x + Math.cos(tickAngle) * tickLen;
                          const ty = midPt.y + Math.sin(tickAngle) * tickLen;

                          const lblX = tx + Math.cos(tickAngle) * 12;
                          const lblY = ty + Math.sin(tickAngle) * 12;

                          const displayLabel =
                            trace.customLabel !== undefined ? trace.customLabel : trace.setId;
                          const setBadgeX =
                            midPt.x - Math.cos(tickAngle) * 15 + (trace.labelOffset?.dx || 0);
                          const setBadgeY =
                            midPt.y - Math.sin(tickAngle) * 15 + (trace.labelOffset?.dy || 0);

                          return (
                            <g
                              key={trace.id}
                              onClick={() => setSelectedTraceId(trace.id)}
                              className="cursor-pointer"
                            >
                              {isSelected && (
                                <path
                                  d={dPath}
                                  fill="none"
                                  stroke="rgba(251, 191, 36, 0.35)"
                                  strokeWidth={5}
                                />
                              )}

                              {/* Joint Trace Polyline */}
                              <path
                                d={dPath}
                                fill="none"
                                stroke={isSelected ? '#fbbf24' : color}
                                strokeWidth={
                                  isSelected
                                    ? 2.0
                                    : trace.fillingThickness === 'Thin'
                                    ? 1.1
                                    : 1.5
                                }
                                strokeDasharray={dashArray}
                              />

                              {/* Trace Vertex Points */}
                              {svgPts.map((pt, vIdx) => (
                                <circle
                                  key={`v-${trace.id}-${vIdx}`}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={1.8}
                                  fill={color}
                                />
                              ))}

                              {/* Perpendicular Dip Tick */}
                              <line
                                x1={midPt.x}
                                y1={midPt.y}
                                x2={tx}
                                y2={ty}
                                stroke={isSelected ? '#fbbf24' : color}
                                strokeWidth={1.4}
                              />

                              {/* Dip Angle Text Label */}
                              <text
                                x={lblX}
                                y={lblY}
                                fontSize={9.5}
                                fontFamily="monospace"
                                fontWeight={700}
                                fill={isSelected ? '#ea580c' : '#0f172a'}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                stroke="rgba(255,255,255,0.95)"
                                strokeWidth={2.5}
                                paintOrder="stroke"
                              >
                                {trace.dipDeg}°
                              </text>

                              {/* Joint Set / Custom Text Label */}
                              {!trace.hideLabel && displayLabel && displayLabel.trim() !== '' && (
                                <text
                                  x={setBadgeX}
                                  y={setBadgeY}
                                  fontSize={10.5}
                                  fontWeight={700}
                                  fill={isSelected ? '#ea580c' : color}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  stroke="rgba(255,255,255,0.95)"
                                  strokeWidth={3}
                                  paintOrder="stroke"
                                >
                                  {displayLabel}
                                </text>
                              )}

                              {/* HW / FW Markers when enabled in ESWA CAD */}
                              {trace.showHwFw && (
                                <>
                                  <text
                                    x={midPt.x + Math.cos(tickAngle) * 24}
                                    y={midPt.y + Math.sin(tickAngle) * 24}
                                    fontSize={10}
                                    fontWeight={700}
                                    fill="#ef4444"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    {trace.flipHwFw ? 'FW' : 'HW'}
                                  </text>
                                  <text
                                    x={midPt.x - Math.cos(tickAngle) * 24}
                                    y={midPt.y - Math.sin(tickAngle) * 24}
                                    fontSize={10}
                                    fontWeight={700}
                                    fill="#3b82f6"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    {trace.flipHwFw ? 'HW' : 'FW'}
                                  </text>
                                </>
                              )}
                            </g>
                          );
                        })}

                        {/* 7. Groundwater Inflow Symbols (`dataset.waterSymbols` matching ESWA CAD) */}
                        {(dataset.waterSymbols || []).map((sym) => {
                          const scrX = rdToX(sym.position.x);
                          const scrY = yToSvgY(sym.position.y);
                          return (
                            <g key={sym.id}>
                              <circle cx={scrX} cy={scrY} r={6} fill="#0284c7" />
                              <text
                                x={scrX}
                                y={scrY + 0.5}
                                fontSize={8.5}
                                fontWeight={700}
                                fill="#ffffff"
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                W
                              </text>
                              {sym.label && (
                                <text
                                  x={scrX + 10}
                                  y={scrY + 1}
                                  fontSize={10}
                                  fontFamily="monospace"
                                  fill="#0284c7"
                                  textAnchor="start"
                                  dominantBaseline="middle"
                                  stroke="rgba(255,255,255,0.9)"
                                  strokeWidth={2}
                                  paintOrder="stroke"
                                >
                                  {sym.label}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* 8. Custom Text Annotations (`dataset.customAnnotations`) */}
                        {(dataset.customAnnotations || []).map((ann) => (
                          <text
                            key={ann.id}
                            x={rdToX(ann.x)}
                            y={yToSvgY(ann.y)}
                            fontSize={9}
                            fontWeight={800}
                            fill={ann.color || '#0f172a'}
                            textAnchor="middle"
                            stroke="#ffffff"
                            strokeWidth={2.2}
                            paintOrder="stroke"
                          >
                            {ann.text}
                          </text>
                        ))}
                      </g>

                      {/* Left Zone Labels (matching ESWA CAD Canvas) */}
                      {isShaft ? (
                        <g fontSize={8.5} fontFamily="monospace" fontWeight={700} fill="#334155">
                          <text x={padL - 8} y={(padT + yShaftQ1) / 2} textAnchor="end" dominantBaseline="middle">
                            1. NE (0°–90°)
                          </text>
                          <text x={padL - 8} y={(yShaftQ1 + yShaftQ2) / 2} textAnchor="end" dominantBaseline="middle">
                            2. ES (90°–180°)
                          </text>
                          <text x={padL - 8} y={(yShaftQ2 + yShaftQ3) / 2} textAnchor="end" dominantBaseline="middle">
                            3. SW (180°–270°)
                          </text>
                          <text x={padL - 8} y={(yShaftQ3 + padT + plotH) / 2} textAnchor="end" dominantBaseline="middle">
                            4. WN (270°–360°)
                          </text>
                        </g>
                      ) : (
                        <g fontSize={9} fontFamily="monospace" fontWeight={700} fill="#334155">
                          <text x={padL - 8} y={(padT + yTunnelCrownTop) / 2} textAnchor="end" dominantBaseline="middle">
                            LEFT WALL
                          </text>
                          <text
                            x={padL - 8}
                            y={(yTunnelCrownTop + yTunnelRightWallTop) / 2}
                            textAnchor="end"
                            dominantBaseline="middle"
                          >
                            CROWN ARCH
                          </text>
                          <text
                            x={padL - 8}
                            y={(yTunnelRightWallTop + padT + plotH) / 2}
                            textAnchor="end"
                            dominantBaseline="middle"
                          >
                            RIGHT WALL
                          </text>
                        </g>
                      )}

                      {/* Outer Plot Frame */}
                      <rect
                        x={padL}
                        y={padT}
                        width={plotW}
                        height={plotH}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth={1.5}
                      />
                    </svg>
                  );
                })()}

                {/* Graphical ESWA CAD Legend Bar */}
                <div className="border-t border-slate-900 bg-slate-50 px-3 py-1.5 flex flex-wrap items-center justify-between gap-3 text-[9.5px] font-bold text-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-black uppercase text-slate-950">ESWA CAD LEGEND:</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-2.5 bg-amber-500/25 border border-amber-600 inline-block" />
                      Qtz / Ss (Quartzite / Sandstone)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-2.5 bg-sky-500/25 border border-sky-600 inline-block" />
                      Ph / Sch (Phyllite / Schist)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-2.5 bg-red-500/25 border border-red-600 inline-block" />
                      Gr / Gn (Granite / Gneiss)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-2.5 bg-emerald-500/25 border border-emerald-600 inline-block" />
                      Ls (Limestone)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-4 h-0.5 bg-blue-600 inline-block" />
                      Joint Trace + Strike/Dip Tick (J1 / J2 / J3)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-4 h-0 border-t-2 border-dashed border-rose-600 inline-block" />
                      Shear Zone / Fault Trace
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      ● W — Groundwater Seepage Marker
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      ┆ Pull Boundary (RD / Depth)
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. CONTINUOUS PARAMETER & FEM/DEM LEDGER TABLE */}
              <div className="border-b-2 border-slate-900">
                <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest flex justify-between">
                  <span>
                    Section 2 — Continuous Geotechnical, Rock Mass Classification &amp; Before/After FEM/DEM Verification Ledger
                  </span>
                  <span>
                    ISRM / Barton Q / Bieniawski RMR89 / Hoek-Brown Continuum &amp; Discrete Wedge DEM
                  </span>
                </div>

                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-900 font-black text-slate-900">
                      <th className="p-1.5 border-r border-slate-900 text-left w-[170px]">
                        Parameter / {isShaft ? 'Depth Interval' : 'Chainage RD'}
                      </th>
                      {dataset.pulls.map((p, i) => (
                        <th
                          key={`th-${i}-${p.fromRd}`}
                          className={`p-1.5 border-r border-slate-900 text-center font-mono ${
                            p.status === 'MISSING_GAP' ? 'bg-slate-100 text-slate-500' : ''
                          }`}
                        >
                          {p.status === 'MISSING_GAP' ? (
                            <>
                              <div>UNLOGGED GAP</div>
                              <div className="text-[9px] font-bold">
                                {p.fromRd}–{p.toRd}m
                              </div>
                            </>
                          ) : (
                            <>
                              <div>{p.excavationDefiningNo || `Pull #${i + 1}`}</div>
                              <div className="text-[9px] text-slate-700">
                                {isShaft ? 'D' : 'RD'} {p.fromRd}–{p.toRd}m
                              </div>
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-400">
                      <td className="p-1.5 border-r border-slate-900 font-bold bg-slate-50">
                        Lithology &amp; Weathering
                      </td>
                      {dataset.pulls.map((p, i) => (
                        <td key={i} className="p-1.5 border-r border-slate-300 text-center">
                          {p.status === 'MISSING_GAP' ? (
                            <span className="text-slate-400 italic">— Blank Gap —</span>
                          ) : (
                            <>
                              <div className="font-bold text-slate-900">{p.rockType}</div>
                              <div className="text-[9px] text-slate-600">
                                {p.weatheringCondition}
                              </div>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="border-b border-slate-400">
                      <td className="p-1.5 border-r border-slate-900 font-bold bg-slate-50">
                        RQD (%) / GSI / RMR₈₉ / Q
                      </td>
                      {dataset.pulls.map((p, i) => (
                        <td
                          key={i}
                          className="p-1.5 border-r border-slate-300 text-center font-mono"
                        >
                          {p.status === 'MISSING_GAP' ? (
                            '—'
                          ) : (
                            <span>
                              {p.rqdValue ?? 65}% | GSI {p.gsiValue ?? 55} | RMR {p.rmrValue ?? 58}{' '}
                              | <b>Q={(p.qValue ?? 4.0).toFixed(2)}</b>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="border-b border-slate-400">
                      <td className="p-1.5 border-r border-slate-900 font-bold bg-slate-50">
                        Rock Class &amp; Installed Support
                      </td>
                      {dataset.pulls.map((p, i) => (
                        <td key={i} className="p-1.5 border-r border-slate-300 text-center">
                          {p.status === 'MISSING_GAP' ? (
                            '—'
                          ) : (
                            <div>
                              <span className="font-black">{p.rockClass}</span>
                              <div className="text-[9px] text-slate-700">
                                {p.supportDescription}
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="border-b border-slate-400 bg-rose-50/40">
                      <td className="p-1.5 border-r border-slate-900 font-bold bg-slate-50">
                        FEM Disp: Before → After Support
                      </td>
                      {femDemProfile.map((f, i) => (
                        <td
                          key={i}
                          className="p-1.5 border-r border-slate-300 text-center font-mono"
                        >
                          {f.status === 'MISSING_GAP' ? (
                            '—'
                          ) : (
                            <span>
                              <span className="text-rose-700 font-bold">
                                {f.unreinforcedDispMm.toFixed(1)}mm
                              </span>{' '}
                              →{' '}
                              <span className="text-emerald-700 font-black">
                                {f.reinforcedDispMm.toFixed(1)}mm
                              </span>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    <tr className="border-b border-slate-900 bg-emerald-50/40">
                      <td className="p-1.5 border-r border-slate-900 font-bold bg-slate-50">
                        FEM / DEM FoS (Bef → Aft Support)
                      </td>
                      {femDemProfile.map((f, i) => (
                        <td
                          key={i}
                          className="p-1.5 border-r border-slate-300 text-center font-mono"
                        >
                          {f.status === 'MISSING_GAP' ? (
                            '—'
                          ) : (
                            <div>
                              <div>
                                Cont:{' '}
                                <span className="text-rose-700">
                                  {f.unreinforcedContinuumFos.toFixed(2)}
                                </span>{' '}
                                →{' '}
                                <b className="text-emerald-800">
                                  {f.reinforcedContinuumFos.toFixed(2)}
                                </b>
                              </div>
                              <div className="text-[9px]">
                                Wedge: {f.unreinforcedDiscreteWedgeFos.toFixed(2)} →{' '}
                                <b>{f.reinforcedDiscreteWedgeFos.toFixed(2)}</b>
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. BOTTOM SIGN-OFF & 3D JOINT INSPECTION SUMMARY */}
              <div className="grid grid-cols-12 text-[10px]">
                <div className="col-span-8 p-2.5 border-r border-slate-900">
                  <div className="font-black uppercase text-slate-800 mb-1">
                    Section 3 — High-Precision 3D Discontinuity &amp; Tetrahedral Wedge Summary
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                    {jointInspectionSchedule.slice(0, 6).map((j) => (
                      <div key={j.traceId} className="leading-snug">
                        <span className="font-mono font-bold text-slate-900">
                          {j.label} ({j.setId}): {j.dipDeg}°/
                          {String(j.dipDirectionDeg).padStart(3, '0')}° ({j.persistenceLengthM}m)
                        </span>{' '}
                        <span className="font-mono text-[9px] text-slate-600">
                          — Vol {j.wedgeBlockVolumeM3.toFixed(2)}m³ | FoS {j.fosUnreinforced}→
                          <b>{j.fosReinforced}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-4 p-2.5 flex flex-col justify-between bg-slate-50">
                  <div className="font-black uppercase text-slate-800">
                    Engineering Sign-Off &amp; Quality Assurance
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 text-[10px]">
                    <div className="border-t border-slate-400 pt-1">
                      <div className="font-bold text-slate-800">Contractor Geologist:</div>
                      <div className="text-slate-600">
                        {dataset.geologistContractor || 'Engineering Geologist'}
                      </div>
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <div className="font-bold text-slate-800">Client / Chief Geologist:</div>
                      <div className="text-slate-600">
                        {dataset.geologistClient || 'Approved for NATM / Shaft Construction'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
