import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Edit3,
  FileSpreadsheet,
  Layers,
  MapPin,
  X,
} from 'lucide-react';
import {
  ContinuousTunnelStripDataset,
  createFreshDefaultStripDataset,
  createPowerTunnelReferenceDataset,
  loadAllContinuousStripDatasets,
  parsePullIntervalFromRecord,
  saveAllContinuousStripDatasets,
  syncSavedProjectsIntoStripDatasets,
} from '../engine/continuous3DStripEngine';

import {
  SavedProjectRecord,
} from '../types/tunnel';

export interface ContinuousTunnelLogSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: SavedProjectRecord[];
  allProjectsList: string[];
  projectDirectory: Record<string, string[]>;
  onOpenA3Window: (dataset: ContinuousTunnelStripDataset, openInCad?: boolean) => void;
  onOpenCadWindow?: (dataset: ContinuousTunnelStripDataset) => void;
}

export interface ExcavationFaceItem {
  id: string;
  roundNumber: number;
  title: string;
  fromRd: number;
  toRd: number;
  advanceM: number;
  date: string;
  rockType: string;
  rockClass: string;
  qValue?: number;
  rmrValue?: number;
  geologist?: string;
  isBenchmark?: boolean;
  rawRecord?: SavedProjectRecord;
}

export const ContinuousTunnelLogSetupModal: React.FC<ContinuousTunnelLogSetupModalProps> = ({
  isOpen,
  onClose,
  savedProjects,
  allProjectsList,
  projectDirectory,
  onOpenA3Window,
  onOpenCadWindow,
}) => {
  // 1. Projects available STRICTLY from Underground Face Mapping
  const undergroundFaceProjects = useMemo(() => {
    const projSet = new Set<string>();
    for (const sp of savedProjects) {
      const pName = (sp.projectName || sp.settings?.projectName || '').trim();
      if (pName) projSet.add(pName);
    }
    for (const p of allProjectsList) {
      if (p.trim()) projSet.add(p.trim());
    }
    if (projSet.size === 0) {
      projSet.add('POWER TUNNEL EXCAVATION (NHPC)');
    }
    return Array.from(projSet);
  }, [savedProjects, allProjectsList]);

  const [selectedProject, setSelectedProject] = useState<string>(() => {
    return undergroundFaceProjects[0] || 'POWER TUNNEL EXCAVATION (NHPC)';
  });

  useEffect(() => {
    if (undergroundFaceProjects.length > 0 && !undergroundFaceProjects.includes(selectedProject)) {
      setSelectedProject(undergroundFaceProjects[0]);
    }
  }, [undergroundFaceProjects, selectedProject]);

  // 2. Locations available for selected project
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    const normProj = selectedProject.trim().toLowerCase();

    for (const sp of savedProjects) {
      const spProj = (sp.projectName || sp.settings?.projectName || '').trim().toLowerCase();
      if (spProj === normProj) {
        const loc = (sp.tunnelName || sp.location || sp.settings?.tunnelName || sp.settings?.locationName || '').trim();
        if (loc) locSet.add(loc);
      }
    }

    const dirLocs = projectDirectory[selectedProject] || [];
    for (const l of dirLocs) {
      if (l.trim()) locSet.add(l.trim());
    }

    if (locSet.size === 0) {
      locSet.add('Power Tunnel Heading 1 (Chainage 250m - 300m)');
    }

    return Array.from(locSet);
  }, [selectedProject, savedProjects, projectDirectory]);

  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
    return availableLocations[0] || 'Power Tunnel Heading 1 (Chainage 250m - 300m)';
  });

  useEffect(() => {
    if (availableLocations.length > 0 && !availableLocations.includes(selectedLocation)) {
      setSelectedLocation(availableLocations[0]);
    }
  }, [availableLocations, selectedLocation]);

  // 3. Find face mapping rounds matching this project & location
  const matchingFaceRounds = useMemo(() => {
    const normProj = selectedProject.trim().toLowerCase();
    const normLoc = selectedLocation.trim().toLowerCase();

    return savedProjects.filter((sp) => {
      const spProj = (sp.projectName || sp.settings?.projectName || '').trim().toLowerCase();
      const spLoc = (sp.tunnelName || sp.location || sp.settings?.tunnelName || sp.settings?.locationName || '').trim().toLowerCase();
      return spProj === normProj && (spLoc === normLoc || normLoc.includes(spLoc) || spLoc.includes(normLoc));
    });
  }, [selectedProject, selectedLocation, savedProjects]);

  // 4. Generate/Parse All Faces for this location
  const allAvailableFaces = useMemo<ExcavationFaceItem[]>(() => {
    if (matchingFaceRounds.length > 0) {
      const items: ExcavationFaceItem[] = matchingFaceRounds.map((r, idx) => {
        const parsed = parsePullIntervalFromRecord(
          r.chainage || '',
          r.faceChainage || '',
          r.settings?.roundLength || 3.0
        );
        const fromRd = parsed.fromRd;
        const toRd = parsed.toRd;
        const rockType = r.lithologyRegions?.[0]?.rockType || r.rockMassSummary?.generalRockType || 'Quartzite';
        const rockClass = r.rockMassSummary?.qRatingRockClass || (r.qIndexParams ? 'II' : 'II');
        const qVal = r.qIndexParams?.qValue;
        const rmrVal = r.rmrParams?.rmrTotal;

        return {
          id: r.id || `face-${idx}`,
          roundNumber: idx + 1,
          title: `Face Round #${idx + 1} (${r.chainage || r.faceChainage || `CH ${fromRd}m`})`,
          fromRd,
          toRd,
          advanceM: Math.max(0.5, +(toRd - fromRd).toFixed(1)),
          date: r.date || new Date(r.savedAt || Date.now()).toLocaleDateString(),
          rockType,
          rockClass: `Class ${rockClass}`,
          qValue: qVal,
          rmrValue: rmrVal,
          geologist: r.settings?.geologistName || 'Field Geologist',
          isBenchmark: false,
          rawRecord: r,
        };
      });

      return items.sort((a, b) => a.fromRd - b.fromRd);
    }

    // If no matching face records logged yet, strictly keep empty without auto-feeding fake data
    return [];
  }, [matchingFaceRounds, selectedProject, selectedLocation]);

  // Selected face IDs state
  const [selectedFaceIds, setSelectedFaceIds] = useState<string[]>([]);

  // Chainage inputs
  const [fromChainage, setFromChainage] = useState<number>(0);
  const [toChainage, setToChainage] = useState<number>(30);

  // Initialize selected faces and chainage when faces change
  useEffect(() => {
    if (allAvailableFaces.length > 0) {
      // Default select all faces
      setSelectedFaceIds(allAvailableFaces.map((f) => f.id));
      const minCh = Math.min(...allAvailableFaces.map((f) => f.fromRd));
      const maxCh = Math.max(...allAvailableFaces.map((f) => f.toRd));
      setFromChainage(minCh);
      setToChainage(maxCh);
    }
  }, [allAvailableFaces]);

  // Handle toggling individual face
  const handleToggleFace = (faceId: string) => {
    let updated: string[];
    if (selectedFaceIds.includes(faceId)) {
      updated = selectedFaceIds.filter((id) => id !== faceId);
    } else {
      updated = [...selectedFaceIds, faceId];
    }
    setSelectedFaceIds(updated);

    // If there are selected faces, update fromChainage and toChainage to match
    const selectedFaces = allAvailableFaces.filter((f) => updated.includes(f.id));
    if (selectedFaces.length > 0) {
      const minCh = Math.min(...selectedFaces.map((f) => f.fromRd));
      const maxCh = Math.max(...selectedFaces.map((f) => f.toRd));
      setFromChainage(minCh);
      setToChainage(maxCh);
    }
  };

  const handleSelectAllFaces = () => {
    const allIds = allAvailableFaces.map((f) => f.id);
    setSelectedFaceIds(allIds);
    if (allAvailableFaces.length > 0) {
      const minCh = Math.min(...allAvailableFaces.map((f) => f.fromRd));
      const maxCh = Math.max(...allAvailableFaces.map((f) => f.toRd));
      setFromChainage(minCh);
      setToChainage(maxCh);
    }
  };

  const handleClearFaceSelection = () => {
    setSelectedFaceIds([]);
  };

  // Helper to compile dataset from selected setup options
  const prepareTargetDataset = (): ContinuousTunnelStripDataset => {
    let dataset: ContinuousTunnelStripDataset;

    if (matchingFaceRounds.length > 0) {
      const existingDatasets = loadAllContinuousStripDatasets();
      const synced = syncSavedProjectsIntoStripDatasets(existingDatasets, matchingFaceRounds);

      let target = synced.find(
        (d) =>
          d.projectName.toLowerCase() === selectedProject.toLowerCase() &&
          d.tunnelLocationName.toLowerCase() === selectedLocation.toLowerCase()
      );

      if (!target) {
        target = createFreshDefaultStripDataset();
        target.projectName = selectedProject;
        target.tunnelLocationName = selectedLocation;
        target.viewFromRd = fromChainage;
        target.viewToRd = toChainage;
      } else {
        target.viewFromRd = fromChainage;
        target.viewToRd = toChainage;
      }
      dataset = target;
    } else {
      // Data not available: keep empty without auto-feeding fake data
      dataset = createFreshDefaultStripDataset();
      dataset.projectName = selectedProject;
      dataset.tunnelLocationName = selectedLocation;
      dataset.viewFromRd = fromChainage;
      dataset.viewToRd = toChainage;
      dataset.pulls = [];
      dataset.traces = [];
      dataset.lithologyZones = [];
    }

    const all = loadAllContinuousStripDatasets();
    const idx = all.findIndex((d) => d.id === dataset.id);
    if (idx >= 0) {
      all[idx] = dataset;
    } else {
      all.unshift(dataset);
    }
    saveAllContinuousStripDatasets(all);
    return dataset;
  };

  // Launch directly to ESWA CAD canvas editor
  const handleLaunchCad = () => {
    const dataset = prepareTargetDataset();
    if (onOpenCadWindow) {
      onOpenCadWindow(dataset);
    } else {
      onOpenA3Window(dataset, true);
    }
    onClose();
  };

  // Launch continuous log A3 window
  const handleLaunchContinuousLog = () => {
    const dataset = prepareTargetDataset();
    onOpenA3Window(dataset, false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FFFBF8] border-2 border-orange-300 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col text-stone-900 max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FFF4E8] border-b border-orange-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-600 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-stone-900 tracking-wide">
                Continuous Tunnel Logging Setup
              </h2>
              <p className="text-xs text-stone-600 font-medium">
                Choose Location → Inspect &amp; Select Excavation Faces → Configure Chainage Scope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-orange-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Step 1 & 2: Project & Location Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-orange-600" />
                Step 1: Select Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2.5 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-sm"
              >
                {undergroundFaceProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                Step 2: Select Location / Heading
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2.5 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-sm"
              >
                {availableLocations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: ALL FACES DISPLAY FOR SELECTED LOCATION */}
          <div className="bg-white border border-orange-200 rounded-xl p-3.5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    Excavation Faces for this Location ({allAvailableFaces.length} Faces Found)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Select faces to include in the continuous strip, or click a face to set chainage bounds.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Select All / Clear */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                  {selectedFaceIds.length} of {allAvailableFaces.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllFaces}
                  className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearFaceSelection}
                  className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Scrollable Faces List */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {allAvailableFaces.length === 0 ? (
                <div className="p-5 text-center border-2 border-dashed border-stone-200 rounded-xl bg-stone-50/50 text-stone-500 my-2">
                  <div className="text-xs font-bold text-stone-700">No Face Rounds Logged for this Location</div>
                  <p className="text-[11px] text-stone-500 mt-1 max-w-md mx-auto">
                    Only mapped data from Underground Face Mapping is synced here. Map excavation faces to see continuous 3D tunnel logs.
                  </p>
                </div>
              ) : (
                allAvailableFaces.map((face) => {
                const isSelected = selectedFaceIds.includes(face.id);
                const isStart = fromChainage === face.fromRd;
                const isEnd = toChainage === face.toRd;

                return (
                  <div
                    key={face.id}
                    onClick={() => handleToggleFace(face.id)}
                    className={`p-2.5 rounded-xl border text-xs transition cursor-pointer flex flex-wrap items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-orange-50/70 border-orange-300 ring-1 ring-orange-400/40 shadow-xs'
                        : 'bg-stone-50/70 border-stone-200 hover:border-orange-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-white border-stone-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-stone-900 font-bold text-xs">{face.title}</strong>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-700 font-bold">
                            CH {face.fromRd.toFixed(1)}m – {face.toRd.toFixed(1)}m ({face.advanceM.toFixed(1)}m)
                          </span>
                          {face.isBenchmark && (
                            <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1 rounded">
                              Benchmark
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600 mt-0.5">
                          <span>{face.rockType}</span>
                          <span>•</span>
                          <span className="font-semibold text-orange-800">{face.rockClass}</span>
                          {face.qValue && (
                            <>
                              <span>•</span>
                              <span className="font-mono">Q: {face.qValue}</span>
                            </>
                          )}
                          {face.rmrValue && (
                            <>
                              <span>•</span>
                              <span className="font-mono">RMR: {face.rmrValue}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{face.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Start / End Buttons */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setFromChainage(face.fromRd)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                          isStart
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-orange-50'
                        }`}
                        title="Set as From Chainage"
                      >
                        {isStart ? 'Start Point ✓' : 'Set Start'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setToChainage(face.toRd)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                          isEnd
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-orange-50'
                        }`}
                        title="Set as To Chainage"
                      >
                        {isEnd ? 'End Point ✓' : 'Set End'}
                      </button>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Step 4: Chainage Bounds Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-600" />
                Step 4: Chainage Scope for Continuous Strip (m):
              </span>
              <span className="text-[11px] font-mono font-semibold text-orange-800 bg-orange-100/70 border border-orange-200 px-2 py-0.5 rounded">
                Total Length: {(toChainage - fromChainage).toFixed(1)} m
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50/40 border border-orange-200 rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-bold text-stone-700 block mb-1">
                  From Chainage (m):
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={fromChainage}
                  onChange={(e) => setFromChainage(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-inner"
                />
              </div>

              <div className="bg-orange-50/40 border border-orange-200 rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-bold text-stone-700 block mb-1">
                  To Chainage (m):
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={toChainage}
                  onChange={(e) => setToChainage(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            <span className="text-stone-500 font-semibold text-[11px]">Quick Bounds:</span>
            {allAvailableFaces.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const minCh = Math.min(...allAvailableFaces.map((f) => f.fromRd));
                  const maxCh = Math.max(...allAvailableFaces.map((f) => f.toRd));
                  setFromChainage(minCh);
                  setToChainage(maxCh);
                }}
                className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-stone-800 border border-orange-300 transition cursor-pointer text-[11px] font-bold shadow-2xs"
              >
                Fit All Faces ({Math.min(...allAvailableFaces.map((f) => f.fromRd))}m – {Math.max(...allAvailableFaces.map((f) => f.toRd))}m)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFromChainage(250);
                setToChainage(280);
              }}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 text-stone-700 border border-stone-200 transition cursor-pointer text-[11px] font-medium shadow-2xs"
            >
              Power Tunnel (250m - 280m)
            </button>
            <button
              type="button"
              onClick={() => {
                setFromChainage(0);
                setToChainage(30);
              }}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 text-stone-700 border border-stone-200 transition cursor-pointer text-[11px] font-medium shadow-2xs"
            >
              Portal Start (0.0m - 30.0m)
            </button>
          </div>
        </div>

        {/* Modal Footer Actions - AutoCAD 2026 Dark Slate Theme */}
        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition cursor-pointer font-mono"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleLaunchContinuousLog}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-sky-500/60 transition cursor-pointer flex items-center gap-2 shadow-md font-mono group"
              title="Open full A3 Continuous Engineering Log View"
            >
              <span>View A3 Template</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              type="button"
              onClick={handleLaunchCad}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 active:scale-[0.99] text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-sky-600/30 ring-1 ring-sky-300/50 transition cursor-pointer font-mono"
              title="Launch ESWACAD 2026 Continuous 3D Strip Canvas"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Canvas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
