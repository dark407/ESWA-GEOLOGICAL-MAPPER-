import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Compass,
  FolderOpen,
  Layers,
  MapPin,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { SavedProjectRecord, TunnelGeometry } from '../types/tunnel';
import {
  compileContinuousDatasetFromFieldAndSavedRecords,
  ContinuousTunnelStripDataset,
  getUnifiedContinuousProjectsAndLocations,
  loadAllContinuousStripDatasets,
  saveAllContinuousStripDatasets,
  UnifiedContinuousLocationItem,
  UnifiedContinuousProjectItem,
} from '../engine/continuous3DStripEngine';

export interface ContinuousTunnelLogSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: SavedProjectRecord[];
  allProjectsList?: string[];
  projectDirectory?: unknown;
  defaultProjectName?: string;
  defaultLocationName?: string;
  defaultGeometry?: TunnelGeometry;
  onLaunchContinuousWorkspace?: (selectedDatasetId: string) => void;
  onOpenA3Window?: (dataset: ContinuousTunnelStripDataset, openInCad?: boolean) => void;
  onOpenCadWindow?: (dataset: ContinuousTunnelStripDataset) => void;
}

export const ContinuousTunnelLogSetupModal: React.FC<ContinuousTunnelLogSetupModalProps> = ({
  isOpen,
  onClose,
  savedProjects,
  defaultProjectName = '',
  defaultLocationName = '',
  onLaunchContinuousWorkspace,
  onOpenA3Window,
  onOpenCadWindow,
}) => {
  const [excavationMode, setExcavationMode] = useState<'TUNNEL' | 'SHAFT'>('TUNNEL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [fromRd, setFromRd] = useState<number>(0);
  const [toRd, setToRd] = useState<number>(20);

  // Discover all projects & locations from Underground Face Mapping (FieldStore) + SavedProjects
  const projectList = useMemo<UnifiedContinuousProjectItem[]>(() => {
    if (!isOpen) return [];
    return getUnifiedContinuousProjectsAndLocations(excavationMode, savedProjects);
  }, [isOpen, excavationMode, savedProjects]);

  // Select default project when mode or projectList changes
  useEffect(() => {
    if (!isOpen) return;
    if (projectList.length === 0) {
      setSelectedProjectId('');
      setSelectedLocationId('');
      return;
    }
    const matchedProj =
      projectList.find(
        (p) =>
          p.id === selectedProjectId ||
          (defaultProjectName &&
            p.projectName.toLowerCase() === defaultProjectName.trim().toLowerCase())
      ) || projectList[0];

    setSelectedProjectId(matchedProj.id);

    const locs = matchedProj.locations || [];
    if (locs.length > 0) {
      const matchedLoc =
        locs.find(
          (l) =>
            l.id === selectedLocationId ||
            (defaultLocationName &&
              l.name.toLowerCase() === defaultLocationName.trim().toLowerCase())
        ) || locs[0];
      setSelectedLocationId(matchedLoc.id);
    } else {
      setSelectedLocationId('');
    }
  }, [isOpen, excavationMode, projectList]);

  const activeProject = useMemo<UnifiedContinuousProjectItem | null>(() => {
    return projectList.find((p) => p.id === selectedProjectId) || projectList[0] || null;
  }, [projectList, selectedProjectId]);

  const activeLocation = useMemo<UnifiedContinuousLocationItem | null>(() => {
    if (!activeProject) return null;
    return (
      activeProject.locations.find((l) => l.id === selectedLocationId) ||
      activeProject.locations[0] ||
      null
    );
  }, [activeProject, selectedLocationId]);

  // Auto-update From RD / To RD bounds when activeLocation changes
  useEffect(() => {
    if (!activeLocation) return;
    const rounds = activeLocation.rounds || [];
    if (rounds.length > 0) {
      const minR = Math.min(...rounds.map((r) => r.fromRd));
      const maxR = Math.max(...rounds.map((r) => r.toRd));
      setFromRd(Number(minR.toFixed(2)));
      setToRd(Number(Math.max(minR + 2, maxR).toFixed(2)));
    } else {
      setFromRd(0);
      setToRd(20);
    }
  }, [activeLocation?.id]);

  // Compute preview of rounds & unlogged gaps within [fromRd, toRd]
  const rangeAnalysis = useMemo(() => {
    const start = Math.min(fromRd, toRd);
    const end = Math.max(fromRd, toRd);
    const roundsInRange = (activeLocation?.rounds || []).filter(
      (r) => r.toRd > start + 0.01 && r.fromRd < end - 0.01
    );

    const gaps: Array<{ from: number; to: number; length: number }> = [];
    let cursor = start;
    for (const r of roundsInRange) {
      const rStart = Math.max(start, r.fromRd);
      const rEnd = Math.min(end, r.toRd);
      if (rStart - cursor > 0.08) {
        gaps.push({
          from: Number(cursor.toFixed(2)),
          to: Number(rStart.toFixed(2)),
          length: Number((rStart - cursor).toFixed(2)),
        });
      }
      cursor = Math.max(cursor, rEnd);
    }
    if (end - cursor > 0.08 && roundsInRange.length > 0) {
      gaps.push({
        from: Number(cursor.toFixed(2)),
        to: Number(end.toFixed(2)),
        length: Number((end - cursor).toFixed(2)),
      });
    }

    return {
      start,
      end,
      totalSpanM: Number(Math.max(0, end - start).toFixed(2)),
      roundsInRange,
      gaps,
    };
  }, [activeLocation, fromRd, toRd]);

  if (!isOpen) return null;

  const isShaft = excavationMode === 'SHAFT';
  const unitLabel = isShaft ? 'Depth (m)' : 'RD / Chainage (m)';

  const handleSyncAndLaunch = () => {
    const fallbackProject: UnifiedContinuousProjectItem = activeProject || {
      id: `proj-${excavationMode.toLowerCase()}-default`,
      projectName: defaultProjectName || (isShaft ? 'Vertical Shaft Project' : 'NATM Tunnel Project'),
      clientName: 'Project Client',
      contractorName: 'Engineering Contractor',
      excavationMode,
      locations: [],
    };

    const fallbackLocation: UnifiedContinuousLocationItem = activeLocation || {
      id: `loc-${excavationMode.toLowerCase()}-default`,
      name: defaultLocationName || (isShaft ? 'Main Ventilation Shaft' : 'Main Head Race Tunnel'),
      excavationMode,
      diameterWidthM: 8.5,
      heightM: 6.5,
      driveAzimuthDeg: isShaft ? 0 : 45,
      overburdenDepthM: 110,
      excavationApproach: 'full_face',
      rounds: [],
    };

    const existingDatasets = loadAllContinuousStripDatasets();
    const targetId = `dataset-unified-${excavationMode.toLowerCase()}-${fallbackProject.id}-${fallbackLocation.id}`;
    const existingMatch = existingDatasets.find((d) => d.id === targetId);

    const compiled = compileContinuousDatasetFromFieldAndSavedRecords({
      excavationMode,
      projectItem: fallbackProject,
      locationItem: fallbackLocation,
      fromRd: Math.min(fromRd, toRd),
      toRd: Math.max(fromRd + 0.5, toRd),
      existingDataset: existingMatch,
    });

    const nextList = [
      compiled,
      ...existingDatasets.filter((d) => d.id !== compiled.id),
    ];
    saveAllContinuousStripDatasets(nextList);
    if (onOpenCadWindow) {
      onOpenCadWindow(compiled);
    } else if (onOpenA3Window) {
      onOpenA3Window(compiled, true);
    }
    if (onLaunchContinuousWorkspace) {
      onLaunchContinuousWorkspace(compiled.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl w-full max-w-5xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  OVER NATM • STAGE 1 OF 6
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Continuous 3D Logging — Underground Face Mapping Sync
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose Tunnel or Vertical Shaft mode, select your logged Project &amp; Location, and pick the From–To {isShaft ? 'Depth' : 'RD'} range to sync into ESWA 3D CAD, 3D Joint Inspection, Continuous FEM/DEM, Advanced Analysis &amp; A3 Report.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Tunnel vs Vertical Shaft Mode Toggle */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-400" />
                <span>1. Select Underground Excavation Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Synchronizes directly with rounds logged in Underground Face Mapping for the chosen mode.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-700/80 shrink-0">
              <button
                type="button"
                onClick={() => setExcavationMode('TUNNEL')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  !isShaft
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-4 h-4" />
                <span>Tunnel Excavation (3-Zone Arch)</span>
              </button>
              <button
                type="button"
                onClick={() => setExcavationMode('SHAFT')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  isShaft
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Vertical Shaft (4-Quadrant Cylinder)</span>
              </button>
            </div>
          </div>

          {/* STEP 2: Project & Location Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>2. Select Logged Project</span>
              </label>
              {projectList.length > 0 ? (
                <select
                  value={activeProject?.id || ''}
                  onChange={(e) => {
                    const nextProj = projectList.find((p) => p.id === e.target.value);
                    setSelectedProjectId(e.target.value);
                    if (nextProj && nextProj.locations.length > 0) {
                      setSelectedLocationId(nextProj.locations[0].id);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:border-sky-500 focus:outline-none"
                >
                  {projectList.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.projectName} ({proj.locations.length} location{proj.locations.length === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  No saved {isShaft ? 'Vertical Shaft' : 'Tunnel'} projects found yet — default workspace will be initialized.
                </div>
              )}
              {activeProject && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Client: <strong className="text-slate-200">{activeProject.clientName}</strong></span>
                  <span>Contractor: <strong className="text-slate-200">{activeProject.contractorName}</strong></span>
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>3. Select {isShaft ? 'Shaft Collar / Location' : 'Tunnel Heading / Location'}</span>
              </label>
              {activeProject && activeProject.locations.length > 0 ? (
                <select
                  value={activeLocation?.id || ''}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                >
                  {activeProject.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} — {loc.rounds.length} logged face/round(s) ({isShaft ? `Ø${loc.diameterWidthM}m` : `${loc.diameterWidthM}m × ${loc.heightM}m`})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  No locations found in this project.
                </div>
              )}
              {activeLocation && (
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1 font-mono">
                  <span>
                    {isShaft ? 'Diameter' : 'Span'}: <strong className="text-emerald-300">{activeLocation.diameterWidthM}m</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Method:{' '}
                    <strong className="text-amber-300">
                      {(activeLocation.excavationApproach || 'full_face').replace(/_/g, ' ').toUpperCase()}
                    </strong>
                  </span>
                  {isShaft && activeLocation.excavationApproach === 'half_face' && (
                    <>
                      <span>•</span>
                      <span>
                        Median:{' '}
                        <strong className="text-sky-300">
                          {(activeLocation.shaftCenterMedianStatus || 'closed').toUpperCase()}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: Logged Faces / Rounds Table & Range Picker */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>4. Logged Faces &amp; {unitLabel} Range Selection</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select From {isShaft ? 'Depth' : 'RD'} and To {isShaft ? 'Depth' : 'RD'}. Any unlogged interval between logged rounds will remain a clean blank gap bounded by dashed RD lines.
                </p>
              </div>

              {/* Quick Range Presets */}
              {activeLocation && activeLocation.rounds.length > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const rds = activeLocation.rounds;
                      const minR = Math.min(...rds.map((r) => r.fromRd));
                      const maxR = Math.max(...rds.map((r) => r.toRd));
                      setFromRd(minR);
                      setToRd(maxR);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-mono font-bold cursor-pointer"
                  >
                    Select Full Logged Span
                  </button>
                </div>
              )}
            </div>

            {/* From RD / To RD Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  From {unitLabel}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fromRd}
                  onChange={(e) => setFromRd( parseFloat(e.target.value) || 0 )}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  To {unitLabel}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={toRd}
                  onChange={(e) => setToRd( parseFloat(e.target.value) || 0 )}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-bold text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Selected Range Span</span>
                  <strong className="text-amber-300 text-sm">{rangeAnalysis.totalSpanM} m</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Synced Rounds / Gaps</span>
                  <strong className="text-emerald-400">
                    {rangeAnalysis.roundsInRange.length} Pulls
                  </strong>
                  {rangeAnalysis.gaps.length > 0 && (
                    <span className="text-amber-400 ml-1.5">
                      ({rangeAnalysis.gaps.length} Gap{rangeAnalysis.gaps.length === 1 ? '' : 's'})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Unlogged Gap Notice */}
            {rangeAnalysis.gaps.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 flex items-center gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{rangeAnalysis.gaps.length} Unlogged Interval(s) Detected:</strong>{' '}
                  {rangeAnalysis.gaps.map((g) => `${g.from}–${g.to}m (${g.length}m)`).join(', ')}. These intervals will be preserved at true scale as clean blank gaps with dashed boundary lines in ESWA 3D CAD and the A3 Report.
                </span>
              </div>
            )}

            {/* Logged Faces Table */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/70">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[10.5px] uppercase sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Round</th>
                    <th className="py-2 px-3">{isShaft ? 'Depth From–To' : 'RD From–To'}</th>
                    <th className="py-2 px-3">Pull</th>
                    <th className="py-2 px-3">Lithology / Class</th>
                    <th className="py-2 px-3">Q / RMR / GSI</th>
                    <th className="py-2 px-3">Joints</th>
                    <th className="py-2 px-3">Installed Support</th>
                    <th className="py-2 px-3 text-right">Quick Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono text-[11px]">
                  {activeLocation && activeLocation.rounds.length > 0 ? (
                    activeLocation.rounds.map((r) => {
                      const inRange =
                        r.toRd > rangeAnalysis.start + 0.01 &&
                        r.fromRd < rangeAnalysis.end - 0.01;
                      return (
                        <tr
                          key={r.id}
                          className={`transition ${
                            inRange ? 'bg-sky-950/30 text-slate-100' : 'text-slate-500 hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2 px-3 font-bold text-amber-300">
                            RD-{r.roundNumber}
                          </td>
                          <td className="py-2 px-3 font-bold">
                            {r.fromRd.toFixed(1)}m – {r.toRd.toFixed(1)}m
                          </td>
                          <td className="py-2 px-3">{r.pullLengthM.toFixed(1)}m</td>
                          <td className="py-2 px-3 font-sans">
                            <span className="font-semibold text-white">{r.rockType}</span>{' '}
                            <span className="text-[10px] text-slate-400">({r.rockClass})</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-sky-300">Q={r.qValue}</span> •{' '}
                            <span className="text-emerald-300">RMR={r.rmrValue}</span> •{' '}
                            <span className="text-amber-300">GSI={r.gsiValue}</span>
                          </td>
                          <td className="py-2 px-3">{r.traceCount} traces</td>
                          <td className="py-2 px-3 font-sans text-[10.5px] text-slate-300 truncate max-w-[180px]">
                            {r.supportSummary}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFromRd(r.fromRd)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                                title="Set as From RD/Depth"
                              >
                                Set Start
                              </button>
                              <button
                                type="button"
                                onClick={() => setToRd(r.toRd)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                                title="Set as To RD/Depth"
                              >
                                Set End
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                        No logged rounds in this location yet. Clicking &ldquo;Sync &amp; Launch 6-Stage Pipeline&rdquo; will open a clean continuous strip workspace for {fromRd.toFixed(1)}m – {toRd.toFixed(1)}m.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6-Stage Pipeline Overview Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
            {[
              { step: '1', title: 'Setup & Sync', desc: isShaft ? 'Shaft Depth Range' : 'Tunnel RD Range', active: true },
              { step: '2', title: 'ESWA 3D CAD', desc: 'Clean Strip Editor', active: false },
              { step: '3', title: '3D Joint Inspect', desc: 'Planes & 3D Wedges', active: false },
              { step: '4', title: 'FEM / DEM', desc: 'Before & After Support', active: false },
              { step: '5', title: 'Adv. Analysis', desc: 'Support & Look-Ahead', active: false },
              { step: '6', title: 'A3 Report', desc: 'ISO Print Sheet', active: false },
            ].map((item) => (
              <div
                key={item.step}
                className={`p-2.5 rounded-xl border text-left ${
                  item.active
                    ? 'bg-sky-950/60 border-sky-500/60 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-amber-400">
                  <span>STAGE {item.step}</span>
                  {item.active && <CheckCircle2 className="w-3 h-3 text-sky-400" />}
                </div>
                <div className="text-xs font-bold text-slate-100 mt-0.5">{item.title}</div>
                <div className="text-[10px] text-slate-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSyncAndLaunch}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Sync {rangeAnalysis.roundsInRange.length} Pull(s) ({rangeAnalysis.start.toFixed(1)}–{rangeAnalysis.end.toFixed(1)}m) &amp; Launch 6-Stage Pipeline
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
