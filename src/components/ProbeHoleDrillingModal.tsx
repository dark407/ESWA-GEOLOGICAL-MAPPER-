import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Crosshair,
  Download,
  Droplets,
  FileText,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  ProbeHoleRecord,
  ProbeRunInterval,
  buildSampleProbeHoles,
  computeMwdProfileForHole,
  evaluateProbeFanLookAhead,
  loadSavedProbeHoles,
  saveProbeHolesToStorage,
} from '../engine/probeHoleAndGroutingEngine';

export interface ProbeHoleDrillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectName?: string;
  defaultTunnelName?: string;
  defaultFaceChainage?: string;
  defaultLoggedBy?: string;
  tunnelWidthMeters?: number;
  tunnelHeightMeters?: number;
  onOpenGroutingWindow?: () => void;
}

export const ProbeHoleDrillingModal: React.FC<ProbeHoleDrillingModalProps> = ({
  isOpen,
  onClose,
  defaultProjectName = 'Himalayan Hydro Headrace Tunnel',
  defaultTunnelName = 'Headrace Tunnel (HRT-01)',
  defaultFaceChainage = 'CH 12+450.50 m',
  defaultLoggedBy = 'Senior Tunnel Geologist',
  tunnelWidthMeters = 8.5,
  tunnelHeightMeters = 8.5,
  onOpenGroutingWindow,
}) => {
  const [holes, setHoles] = useState<ProbeHoleRecord[]>(() =>
    loadSavedProbeHoles()
  );
  const [selectedHoleId, setSelectedHoleId] = useState<string>(() => {
    const initial = loadSavedProbeHoles();
    return initial[0]?.id || 'ph-sample-1';
  });
  const [activeTab, setActiveTab] = useState<'SIMPLE_LOGGING' | 'ADVANCED_MWD_AND_3D'>('SIMPLE_LOGGING');
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);
  const faceSvgRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingCollar, setIsDraggingCollar] = useState<boolean>(false);

  const activeHole = useMemo(
    () => holes.find((h) => h.id === selectedHoleId) || holes[0] || null,
    [holes, selectedHoleId]
  );

  const mwdProfile = useMemo(
    () => (activeHole ? computeMwdProfileForHole(activeHole) : []),
    [activeHole]
  );

  const fanSummary = useMemo(() => evaluateProbeFanLookAhead(holes), [holes]);

  if (!isOpen) return null;

  const updateHolesAndPersist = (nextHoles: ProbeHoleRecord[]) => {
    setHoles(nextHoles);
    saveProbeHolesToStorage(nextHoles);
  };

  const handleUpdateActiveHole = (patch: Partial<ProbeHoleRecord>) => {
    if (!activeHole) return;
    const next = holes.map((h) =>
      h.id === activeHole.id
        ? { ...h, ...patch, updatedAt: new Date().toISOString() }
        : h
    );
    updateHolesAndPersist(next);
  };

  const handleAddProbeHole = () => {
    const nextIdx = holes.length + 1;
    const today = new Date().toISOString().slice(0, 10);
    const newHole: ProbeHoleRecord = {
      id: `ph-${Date.now()}`,
      holeId: `PH-0${nextIdx} (Face Probe)`,
      projectName: activeHole?.projectName || defaultProjectName,
      tunnelName: activeHole?.tunnelName || defaultTunnelName,
      faceChainage: activeHole?.faceChainage || defaultFaceChainage,
      date: today,
      loggedBy: activeHole?.loggedBy || defaultLoggedBy,
      positionLabel: 'Face Center',
      collarX: 0,
      collarY: Number((tunnelHeightMeters * 0.55).toFixed(2)),
      holeDiameterMm: 76,
      totalLengthMeters: 24,
      overlapLengthMeters: 5,
      azimuthDeg: 42,
      lookOutAngleDeg: 5,
      dipAngleDeg: 5,
      updatedAt: new Date().toISOString(),
      intervals: [
        {
          id: `int-${Date.now()}-1`,
          fromMeters: 0,
          toMeters: 6,
          ropMetersPerMin: 0.9,
          feedPressureBar: 65,
          rotationPressureBar: 52,
          flushWaterColor: 'Clear',
          waterInflowLMin: 4,
          waterPressureBar: 0.5,
          estimatedRqdPct: 80,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Competent rock mass ahead of face.',
        },
        {
          id: `int-${Date.now()}-2`,
          fromMeters: 6,
          toMeters: 15,
          ropMetersPerMin: 1.1,
          feedPressureBar: 60,
          rotationPressureBar: 48,
          flushWaterColor: 'Slightly Milky',
          waterInflowLMin: 9,
          waterPressureBar: 1.1,
          estimatedRqdPct: 72,
          rockMassClass: 'Class III (Fair)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Moderately jointed rock, minor seepage.',
        },
        {
          id: `int-${Date.now()}-3`,
          fromMeters: 15,
          toMeters: 24,
          ropMetersPerMin: 0.95,
          feedPressureBar: 64,
          rotationPressureBar: 50,
          flushWaterColor: 'Clear',
          waterInflowLMin: 5,
          waterPressureBar: 0.8,
          estimatedRqdPct: 78,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Fresh blocky rock to end of hole.',
        },
      ],
    };
    const next = [...holes, newHole];
    updateHolesAndPersist(next);
    setSelectedHoleId(newHole.id);
  };

  const handleDeleteActiveHole = () => {
    if (!activeHole || holes.length <= 1) return;
    const next = holes.filter((h) => h.id !== activeHole.id);
    updateHolesAndPersist(next);
    setSelectedHoleId(next[0].id);
  };

  const handleAddInterval = () => {
    if (!activeHole) return;
    const last = activeHole.intervals[activeHole.intervals.length - 1];
    const fromM = last ? last.toMeters : 0;
    const toM = Number((fromM + 6).toFixed(1));
    const newIntv: ProbeRunInterval = {
      id: `int-${Date.now()}`,
      fromMeters: fromM,
      toMeters: toM,
      ropMetersPerMin: 1.0,
      feedPressureBar: 62,
      rotationPressureBar: 50,
      flushWaterColor: 'Clear',
      waterInflowLMin: 5,
      waterPressureBar: 0.8,
      estimatedRqdPct: 75,
      rockMassClass: 'Class II (Good)',
      cavityOrFaultDetected: false,
      geologicalRemarks: 'Logged probe interval.',
    };
    const nextIntervals = [...activeHole.intervals, newIntv];
    handleUpdateActiveHole({
      intervals: nextIntervals,
      totalLengthMeters: Math.max(activeHole.totalLengthMeters, toM),
    });
  };

  const handleUpdateInterval = (intvId: string, patch: Partial<ProbeRunInterval>) => {
    if (!activeHole) return;
    const nextIntervals = activeHole.intervals.map((item) =>
      item.id === intvId ? { ...item, ...patch } : item
    );
    const maxTo = nextIntervals.reduce((acc, i) => Math.max(acc, i.toMeters), activeHole.totalLengthMeters);
    handleUpdateActiveHole({
      intervals: nextIntervals,
      totalLengthMeters: maxTo,
    });
  };

  const handleRemoveInterval = (intvId: string) => {
    if (!activeHole || activeHole.intervals.length <= 1) return;
    const nextIntervals = activeHole.intervals.filter((i) => i.id !== intvId);
    handleUpdateActiveHole({ intervals: nextIntervals });
  };

  const handleLoadSampleFan = () => {
    const sample = buildSampleProbeHoles(
      defaultProjectName,
      defaultTunnelName,
      defaultFaceChainage
    );
    updateHolesAndPersist(sample);
    setSelectedHoleId(sample[0].id);
  };

  // Interactive Tunnel Face Collar placement handler
  const updateCollarFromPointer = (clientX: number, clientY: number) => {
    if (!faceSvgRef.current || !activeHole) return;
    const rect = faceSvgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const halfW = tunnelWidthMeters / 2;
    const rawX = (normX - 0.5) * (tunnelWidthMeters * 1.15);
    const rawY = (1 - normY) * (tunnelHeightMeters * 1.15);

    const clampedX = Number(Math.max(-halfW * 0.92, Math.min(halfW * 0.92, rawX)).toFixed(2));
    const clampedY = Number(Math.max(0.4, Math.min(tunnelHeightMeters * 0.95, rawY)).toFixed(2));

    let posLabel: ProbeHoleRecord['positionLabel'] = 'Face Center';
    if (clampedY > tunnelHeightMeters * 0.75) posLabel = 'Crown Arch';
    else if (clampedX < -halfW * 0.35) posLabel = clampedY < tunnelHeightMeters * 0.3 ? 'Left Invert' : 'Left Wall / Springline';
    else if (clampedX > halfW * 0.35) posLabel = clampedY < tunnelHeightMeters * 0.3 ? 'Right Invert' : 'Right Wall / Springline';

    handleUpdateActiveHole({
      collarX: clampedX,
      collarY: clampedY,
      positionLabel: posLabel,
    });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify({ holes, fanSummary }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NATM_Probe_Holes_${(activeHole?.faceChainage || 'CH').replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[1440px] max-h-[95dvh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* TOP HEADER BAR */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  NATM Probe Hole Drilling &amp; Look-Ahead Analysis
                </h2>
                <span className="text-xs font-mono text-amber-300">
                  · {activeHole?.faceChainage || defaultFaceChainage}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Forward Geotechnical Exploration · Simple Field Logging &amp; Advanced MWD / 3D Probe Fan Analysis
              </p>
            </div>
          </div>

          {/* MODE SWITCHER: SIMPLE vs ADVANCED + ACTIONS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('SIMPLE_LOGGING');
                  setShowReportPreview(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'SIMPLE_LOGGING' && !showReportPreview
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Simple &amp; Effective Logging
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ADVANCED_MWD_AND_3D');
                  setShowReportPreview(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'ADVANCED_MWD_AND_3D' && !showReportPreview
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Advanced Analysis (Face Collar, MWD &amp; 3D Fan)
              </button>
            </div>

            {onOpenGroutingWindow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGroutingWindow();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Switch directly to Separate Grouting Window"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Open Grouting Window</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowReportPreview((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                showReportPreview
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showReportPreview ? 'Back to Workspace' : 'Engineering Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleFan}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              title="Reset / Load 3-Hole Himalayan Headrace Sample Probe Fan"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sample Fan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              title="Close Probe Hole Drilling Window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOP LOOK-AHEAD SAFETY & SUMMARY BANNER */}
        <div
          className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            fanSummary.overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-100'
              : fanSummary.overallStatus === 'CAUTION_FRACTURED'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {fanSummary.overallStatus === 'SAFE_COMPETENT' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  fanSummary.overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              />
            )}
            <span className="text-xs font-medium leading-snug">
              {fanSummary.engineeringRecommendation}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono shrink-0">
            <span>
              Safe Excavation Ahead:{' '}
              <strong className="text-white">{fanSummary.safeAdvanceLengthMeters} m</strong>
            </span>
            <span>·</span>
            <span>
              Total Probe Inflow:{' '}
              <strong className="text-cyan-300">{fanSummary.totalWaterInflowLMin} L/min</strong>
            </span>
            <span>·</span>
            <span>
              Avg Look-Ahead RQD:{' '}
              <strong className="text-amber-300">{fanSummary.averageRqdPct}%</strong>
            </span>
            <span>·</span>
            <span>
              Avg MWD Energy:{' '}
              <strong className="text-emerald-300">
                {fanSummary.averageSpecificEnergyMjM3} MJ/m³
              </strong>
            </span>
          </div>
        </div>

        {/* MAIN SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* PROBE HOLE SELECTOR BAR */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {holes.map((h) => {
                const isSelected = activeHole?.id === h.id;
                const peakInflow = h.intervals.reduce(
                  (acc, i) => Math.max(acc, i.waterInflowLMin),
                  0
                );
                const hasCavity = h.intervals.some((i) => i.cavityOrFaultDetected);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHoleId(h.id)}
                    className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold flex items-center gap-1.5">
                        <span>{h.holeId}</span>
                        {hasCavity && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {h.positionLabel} · L={h.totalLengthMeters}m · Q={peakInflow} L/min
                      </div>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddProbeHole}
                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Probe Hole</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
              {holes.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteActiveHole}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-mono text-rose-200 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Hole</span>
                </button>
              )}
            </div>
          </div>

          {/* PRINTABLE ENGINEERING REPORT PREVIEW */}
          {showReportPreview && activeHole ? (
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-5 max-w-5xl mx-auto">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-bold">
                    NATM Forward Probe Drilling &amp; Look-Ahead Geotechnical Report
                  </div>
                  <h3 className="text-xl font-black text-slate-950 mt-0.5">
                    {activeHole.projectName} — {activeHole.tunnelName}
                  </h3>
                  <div className="text-xs font-mono text-slate-700 mt-1">
                    Face Chainage: <strong>{activeHole.faceChainage}</strong> · Date:{' '}
                    <strong>{activeHole.date}</strong> · Logged By:{' '}
                    <strong>{activeHole.loggedBy}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer print:hidden"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF Report</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-slate-100 p-3.5 rounded-xl border border-slate-300">
                <div>
                  <span className="text-slate-500 block">Overall Look-Ahead Status</span>
                  <strong className="text-slate-950 text-sm">
                    {fanSummary.overallStatus.replace(/_/g, ' ')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Safe Advance Distance</span>
                  <strong className="text-emerald-700 text-sm">
                    {fanSummary.safeAdvanceLengthMeters} m
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Fan Water Inflow</span>
                  <strong className="text-sky-700 text-sm">
                    {fanSummary.totalWaterInflowLMin} L/min
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Weighted Mean RQD / DSE</span>
                  <strong className="text-slate-900 text-sm">
                    {fanSummary.averageRqdPct}% · {fanSummary.averageSpecificEnergyMjM3} MJ/m³
                  </strong>
                </div>
              </div>

              {holes.map((hole) => {
                const holeMwd = computeMwdProfileForHole(hole);
                return (
                  <div key={hole.id} className="space-y-2 border border-slate-300 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <strong className="text-sm font-mono text-slate-900">
                        {hole.holeId} — {hole.positionLabel} (Collar X={hole.collarX}m, Y={hole.collarY}m)
                      </strong>
                      <span className="text-xs font-mono text-slate-600">
                        Ø {hole.holeDiameterMm}mm · Length {hole.totalLengthMeters}m · Overlap {hole.overlapLengthMeters}m · Azimuth {hole.azimuthDeg}° · Dip {hole.dipAngleDeg}°
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-700">
                          <th className="py-1.5 px-2">Depth (m)</th>
                          <th className="py-1.5 px-2">ROP (m/min)</th>
                          <th className="py-1.5 px-2">Feed/Rot (bar)</th>
                          <th className="py-1.5 px-2">MWD DSE (MJ/m³)</th>
                          <th className="py-1.5 px-2">Inflow (L/min)</th>
                          <th className="py-1.5 px-2">RQD (%)</th>
                          <th className="py-1.5 px-2">Rock Class</th>
                          <th className="py-1.5 px-2">Geological Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hole.intervals.map((intv, idx) => {
                          const m = holeMwd[idx];
                          return (
                            <tr
                              key={intv.id}
                              className={`border-b border-slate-200 ${
                                m?.isHazardZone ? 'bg-rose-50 font-semibold' : ''
                              }`}
                            >
                              <td className="py-1.5 px-2">
                                {intv.fromMeters.toFixed(1)}–{intv.toMeters.toFixed(1)}
                              </td>
                              <td className="py-1.5 px-2">{intv.ropMetersPerMin.toFixed(2)}</td>
                              <td className="py-1.5 px-2">
                                {intv.feedPressureBar}/{intv.rotationPressureBar}
                              </td>
                              <td className="py-1.5 px-2">{m?.specificEnergyMjPerM3}</td>
                              <td className="py-1.5 px-2">{intv.waterInflowLMin}</td>
                              <td className="py-1.5 px-2">{intv.estimatedRqdPct}%</td>
                              <td className="py-1.5 px-2">{intv.rockMassClass}</td>
                              <td className="py-1.5 px-2">{intv.geologicalRemarks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-slate-800">
                <strong>Engineering Decision &amp; Sign-Off Recommendation:</strong>{' '}
                {fanSummary.engineeringRecommendation}
              </div>
            </div>
          ) : activeTab === 'SIMPLE_LOGGING' && activeHole ? (
            /* ============================================================================
               MODE 1: SIMPLE & EFFECTIVE FIELD LOGGING
               ============================================================================ */
            <div className="space-y-4">
              {/* HOLE COLLAR & DRILLING SETUP PARAMETERS */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                    Probe Hole Collar &amp; Setup Parameters
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Mandatory Overlap: {activeHole.overlapLengthMeters} m · Effective Reach:{' '}
                    {(
                      activeHole.totalLengthMeters *
                      Math.cos(((activeHole.dipAngleDeg || 0) * Math.PI) / 180)
                    ).toFixed(1)}{' '}
                    m
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-slate-400 font-medium block">Probe Hole ID</span>
                    <input
                      type="text"
                      value={activeHole.holeId}
                      onChange={(e) => handleUpdateActiveHole({ holeId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Face Position</span>
                    <select
                      value={activeHole.positionLabel}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          positionLabel: e.target.value as ProbeHoleRecord['positionLabel'],
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    >
                      <option value="Crown Arch">Crown Arch</option>
                      <option value="Face Center">Face Center</option>
                      <option value="Left Wall / Springline">Left Wall / Springline</option>
                      <option value="Right Wall / Springline">Right Wall / Springline</option>
                      <option value="Left Invert">Left Invert</option>
                      <option value="Right Invert">Right Invert</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Face Chainage</span>
                    <input
                      type="text"
                      value={activeHole.faceChainage}
                      onChange={(e) => handleUpdateActiveHole({ faceChainage: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Hole Length (m)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={activeHole.totalLengthMeters}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          totalLengthMeters: Math.max(1, parseFloat(e.target.value) || 20),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Bit Ø (mm)</span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.holeDiameterMm}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          holeDiameterMm: Math.max(38, parseFloat(e.target.value) || 76),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Look-Out (°)</span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.lookOutAngleDeg}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          lookOutAngleDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Inclination Dip (°)</span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.dipAngleDeg}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          dipAngleDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                    />
                  </label>
                </div>
              </div>

              {/* RUN-BY-RUN DEPTH INTERVAL FIELD LOGGING TABLE */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                      Simple &amp; Effective Depth Interval Log (ROP, Water Inflow, RQD &amp; Rock Class)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Record drilling penetration rate, water ingress, flush color, and rock mass quality along the probe hole.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInterval}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Depth Run</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                        <th className="py-2 px-2">From (m)</th>
                        <th className="py-2 px-2">To (m)</th>
                        <th className="py-2 px-2">ROP (m/min)</th>
                        <th className="py-2 px-2">Feed (bar)</th>
                        <th className="py-2 px-2">Flush Return</th>
                        <th className="py-2 px-2">Water (L/min)</th>
                        <th className="py-2 px-2">Est. RQD (%)</th>
                        <th className="py-2 px-2">Rock Class</th>
                        <th className="py-2 px-2">Cavity/Fault</th>
                        <th className="py-2 px-2 min-w-[200px]">Geological Notes</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHole.intervals.map((intv, idx) => {
                        const mwd = mwdProfile[idx];
                        return (
                          <tr
                            key={intv.id}
                            className={`border-b border-slate-800/80 ${
                              mwd?.isHazardZone
                                ? 'bg-rose-950/30'
                                : 'hover:bg-slate-900/40'
                            }`}
                          >
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={intv.fromMeters}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    fromMeters: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={intv.toMeters}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    toMeters: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.05"
                                value={intv.ropMetersPerMin}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    ropMetersPerMin: parseFloat(e.target.value) || 0.1,
                                  })
                                }
                                className={`w-18 px-2 py-1 rounded bg-slate-900 border font-bold ${
                                  intv.ropMetersPerMin >= 2.0
                                    ? 'border-rose-500 text-rose-300'
                                    : 'border-slate-700 text-amber-300'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={intv.feedPressureBar}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    feedPressureBar: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={intv.flushWaterColor}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    flushWaterColor: e.target.value as ProbeRunInterval['flushWaterColor'],
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              >
                                <option value="Clear">Clear</option>
                                <option value="Slightly Milky">Slightly Milky</option>
                                <option value="Muddy Brown">Muddy Brown</option>
                                <option value="Red/Ochre">Red/Ochre</option>
                                <option value="Black/Graphitic">Black/Graphitic</option>
                                <option value="Total Water Loss">Total Water Loss</option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={intv.waterInflowLMin}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    waterInflowLMin: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className={`w-16 px-2 py-1 rounded bg-slate-900 border font-bold ${
                                  intv.waterInflowLMin >= 25
                                    ? 'border-cyan-400 text-cyan-300'
                                    : 'border-slate-700 text-white'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={intv.estimatedRqdPct}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    estimatedRqdPct: Math.min(
                                      100,
                                      Math.max(0, parseFloat(e.target.value) || 0)
                                    ),
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-bold"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={intv.rockMassClass}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    rockMassClass: e.target.value as ProbeRunInterval['rockMassClass'],
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              >
                                <option value="Class I (Very Good)">Class I (Very Good)</option>
                                <option value="Class II (Good)">Class II (Good)</option>
                                <option value="Class III (Fair)">Class III (Fair)</option>
                                <option value="Class IV (Poor)">Class IV (Poor)</option>
                                <option value="Class V (Shear/Fault)">Class V (Shear/Fault)</option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={intv.cavityOrFaultDetected}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    cavityOrFaultDetected: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 accent-rose-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="text"
                                value={intv.geologicalRemarks}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    geologicalRemarks: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              {activeHole.intervals.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInterval(intv.id)}
                                  className="p-1 rounded hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 cursor-pointer"
                                  title="Remove Interval"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VISUAL STRIP PROFILE OF ACTIVE PROBE HOLE */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300 uppercase">
                    Visual Look-Ahead Strip Profile — {activeHole.holeId} (0 m to {activeHole.totalLengthMeters} m)
                  </span>
                  <span className="text-slate-400">
                    Green = Competent · Amber = Fractured · Red = Shear / High Water Hazard
                  </span>
                </div>
                <div className="w-full h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex">
                  {activeHole.intervals.map((intv, idx) => {
                    const m = mwdProfile[idx];
                    const span = Math.max(0.5, intv.toMeters - intv.fromMeters);
                    const widthPct = (span / Math.max(1, activeHole.totalLengthMeters)) * 100;
                    const bgClass = m?.isHazardZone
                      ? 'bg-rose-600/80 border-r border-rose-400'
                      : intv.estimatedRqdPct < 60
                      ? 'bg-amber-600/75 border-r border-amber-400'
                      : 'bg-emerald-600/75 border-r border-emerald-400';
                    return (
                      <div
                        key={intv.id}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full flex flex-col items-center justify-center px-1 text-[10px] font-mono text-white truncate ${bgClass}`}
                        title={`${intv.fromMeters}–${intv.toMeters}m: RQD ${intv.estimatedRqdPct}%, Q=${intv.waterInflowLMin} L/min, ROP=${intv.ropMetersPerMin} m/min`}
                      >
                        <span className="font-bold">
                          {intv.fromMeters}–{intv.toMeters}m
                        </span>
                        <span>
                          RQD {intv.estimatedRqdPct}% · {intv.waterInflowLMin}L/m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================================
               MODE 2: ADVANCED MWD SPECIFIC ENERGY, FACE COLLAR CANVAS & 3D PROBE FAN
               ============================================================================ */
            activeHole && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LEFT COLUMN (5 COLS): INTERACTIVE TUNNEL FACE COLLAR PLACEMENT CANVAS */}
                <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400 block">
                        1. Interactive Tunnel Face Probe Collar Map
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Click or drag on the tunnel face cross-section to position {activeHole.holeId}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-cyan-300">
                      X={activeHole.collarX}m, Y={activeHole.collarY}m
                    </span>
                  </div>

                  <div className="flex-1 min-h-[290px] bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2 select-none">
                    <svg
                      ref={faceSvgRef}
                      viewBox="0 0 360 320"
                      className="w-full h-full max-h-[310px] cursor-crosshair touch-none"
                      onPointerDown={(e) => {
                        setIsDraggingCollar(true);
                        updateCollarFromPointer(e.clientX, e.clientY);
                      }}
                      onPointerMove={(e) => {
                        if (isDraggingCollar) {
                          updateCollarFromPointer(e.clientX, e.clientY);
                        }
                      }}
                      onPointerUp={() => setIsDraggingCollar(false)}
                      onPointerLeave={() => setIsDraggingCollar(false)}
                    >
                      {/* Coordinate Grid */}
                      <line x1="180" y1="20" x2="180" y2="290" stroke="#334155" strokeDasharray="4 4" />
                      <line x1="30" y1="280" x2="330" y2="280" stroke="#475569" strokeWidth="2" />
                      <line x1="30" y1="160" x2="330" y2="160" stroke="#334155" strokeDasharray="4 4" />

                      {/* Horseshoe Tunnel Face Profile */}
                      <path
                        d="M 55 280 L 55 155 A 125 125 0 0 1 305 155 L 305 280 Z"
                        fill="#0F172A"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                      />

                      {/* Look-Ahead Perimeter Envelope (Dashed Outer Ring) */}
                      <path
                        d="M 42 286 L 42 150 A 138 138 0 0 1 318 150 L 318 286 Z"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.2"
                        strokeDasharray="5 4"
                        opacity="0.65"
                      />

                      {/* Render All Probe Hole Collars & Look-Out Vectors */}
                      {holes.map((h) => {
                        const cx = 180 + (h.collarX / (tunnelWidthMeters / 2)) * 120;
                        const cy = 280 - (h.collarY / tunnelHeightMeters) * 240;
                        const isAct = h.id === activeHole.id;
                        const radOut = ((h.lookOutAngleDeg || 5) * Math.PI) / 180;
                        const dirX = h.collarX >= 0 ? 1 : -1;
                        const tipX = cx + dirX * Math.sin(radOut) * 42;
                        const tipY = cy - Math.sin(((h.dipAngleDeg || 4) * Math.PI) / 180) * 42;

                        return (
                          <g
                            key={h.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedHoleId(h.id);
                            }}
                            className="cursor-pointer"
                          >
                            {/* Trajectory Vector Arrow */}
                            <line
                              x1={cx}
                              y1={cy}
                              x2={tipX}
                              y2={tipY}
                              stroke={isAct ? '#22D3EE' : '#94A3B8'}
                              strokeWidth={isAct ? 2.5 : 1.5}
                              strokeDasharray="3 2"
                            />
                            <circle
                              cx={tipX}
                              cy={tipY}
                              r={3}
                              fill={isAct ? '#22D3EE' : '#94A3B8'}
                            />
                            {/* Collar Ring */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isAct ? 10 : 7}
                              fill={isAct ? '#F59E0B' : '#1E293B'}
                              stroke={isAct ? '#FFFFFF' : '#F59E0B'}
                              strokeWidth={isAct ? 2.5 : 1.5}
                            />
                            <text
                              x={cx}
                              y={cy - 13}
                              fill={isAct ? '#FDE68A' : '#CBD5E1'}
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {h.holeId.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}

                      <text x="180" y="305" fill="#94A3B8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                        Tunnel Centerline (0.0 m) · Span {tunnelWidthMeters.toFixed(1)}m × Height {tunnelHeightMeters.toFixed(1)}m
                      </text>
                    </svg>
                  </div>
                </div>

                {/* RIGHT COLUMN (7 COLS): MWD SPECIFIC ENERGY CHART & 3D PROBE FAN PROJECTION */}
                <div className="lg:col-span-7 space-y-4">
                  {/* MWD DRILLING SPECIFIC ENERGY & ROP PROFILE VS DEPTH */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                          2. MWD Drilling Specific Energy (DSE) &amp; Penetration Profile — {activeHole.holeId}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Teale (1965) Specific Energy (MJ/m³) vs. ROP (m/min) &amp; Water Inflow
                      </span>
                    </div>

                    <div className="w-full h-52 bg-slate-900 rounded-xl border border-slate-800 p-3">
                      <svg viewBox="0 0 600 175" className="w-full h-full">
                        {/* Horizontal Reference Lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                          const y = 18 + t * 125;
                          return (
                            <line
                              key={i}
                              x1="45"
                              y1={y}
                              x2="575"
                              y2={y}
                              stroke="#1E293B"
                              strokeWidth="1"
                            />
                          );
                        })}

                        {/* Plot Hazard Bars, DSE Line (Cyan), and ROP Line (Amber) */}
                        {(() => {
                          const maxDepth = Math.max(10, activeHole.totalLengthMeters);
                          const dsePoints: string[] = [];
                          const ropPoints: string[] = [];

                          return (
                            <>
                              {mwdProfile.map((m) => {
                                const x1 = 45 + (m.fromMeters / maxDepth) * 530;
                                const x2 = 45 + (m.toMeters / maxDepth) * 530;
                                const xm = (x1 + x2) * 0.5;
                                const yDse =
                                  143 - Math.min(1, m.specificEnergyMjPerM3 / 400) * 120;
                                const yRop =
                                  143 - Math.min(1, m.ropMetersPerMin / 3.5) * 120;
                                dsePoints.push(`${xm.toFixed(1)},${yDse.toFixed(1)}`);
                                ropPoints.push(`${xm.toFixed(1)},${yRop.toFixed(1)}`);

                                return (
                                  <g key={m.intervalId}>
                                    {m.isHazardZone && (
                                      <rect
                                        x={x1}
                                        y={18}
                                        width={Math.max(6, x2 - x1)}
                                        height={125}
                                        fill="#F43F5E"
                                        opacity="0.22"
                                      />
                                    )}
                                    <circle cx={xm} cy={yDse} r="4" fill="#22D3EE" />
                                    <circle cx={xm} cy={yRop} r="4" fill="#F59E0B" />
                                    <text
                                      x={xm}
                                      y={162}
                                      fill="#94A3B8"
                                      fontSize="9"
                                      fontFamily="monospace"
                                      textAnchor="middle"
                                    >
                                      {m.fromMeters}-{m.toMeters}m
                                    </text>
                                  </g>
                                );
                              })}
                              {dsePoints.length > 1 && (
                                <polyline
                                  fill="none"
                                  stroke="#22D3EE"
                                  strokeWidth="2.5"
                                  points={dsePoints.join(' ')}
                                />
                              )}
                              {ropPoints.length > 1 && (
                                <polyline
                                  fill="none"
                                  stroke="#F59E0B"
                                  strokeWidth="2.5"
                                  strokeDasharray="4 3"
                                  points={ropPoints.join(' ')}
                                />
                              )}
                            </>
                          );
                        })()}

                        {/* Legend */}
                        <circle cx="65" cy="10" r="4" fill="#22D3EE" />
                        <text x="74" y="13" fill="#22D3EE" fontSize="9.5" fontFamily="monospace">
                          Specific Energy (MJ/m³)
                        </text>
                        <circle cx="235" cy="10" r="4" fill="#F59E0B" />
                        <text x="244" y="13" fill="#F59E0B" fontSize="9.5" fontFamily="monospace">
                          Penetration Rate ROP (m/min)
                        </text>
                        <rect x="425" y="5" width="10" height="10" fill="#F43F5E" opacity="0.5" />
                        <text x="440" y="13" fill="#FDA4AF" fontSize="9.5" fontFamily="monospace">
                          Detected Fault / Water Hazard Zone
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* 3D LOOK-AHEAD LONGITUDINAL & FAN PROJECTION */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400">
                          3. 3D Look-Ahead Probe Fan &amp; Hazard Projection Ahead of Tunnel Face
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Safe Advance Gate: +{fanSummary.safeAdvanceLengthMeters} m
                      </span>
                    </div>

                    <div className="w-full h-56 bg-slate-900 rounded-xl border border-slate-800 p-3">
                      <svg viewBox="0 0 620 190" className="w-full h-full">
                        {/* Excavated Tunnel Left of Face */}
                        <rect
                          x="15"
                          y="42"
                          width="95"
                          height="108"
                          fill="#1E293B"
                          stroke="#94A3B8"
                          strokeWidth="2"
                        />
                        <text
                          x="62"
                          y="95"
                          fill="#E2E8F0"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          EXCAVATED
                        </text>
                        <text
                          x="62"
                          y="109"
                          fill="#94A3B8"
                          fontSize="8.5"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {activeHole.faceChainage}
                        </text>

                        {/* Future Planned Tunnel Excavation Envelope */}
                        <rect
                          x="110"
                          y="42"
                          width="485"
                          height="108"
                          fill="#0F172A"
                          stroke="#475569"
                          strokeDasharray="5 4"
                        />

                        {/* Active Tunnel Face Plane */}
                        <line
                          x1="110"
                          y1="25"
                          x2="110"
                          y2="165"
                          stroke="#F59E0B"
                          strokeWidth="3"
                        />
                        <text
                          x="110"
                          y="18"
                          fill="#FBBF24"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ACTIVE FACE (0m)
                        </text>

                        {/* Safe Advance Gate Line */}
                        {(() => {
                          const maxReach = 28;
                          const safeX =
                            110 + (fanSummary.safeAdvanceLengthMeters / maxReach) * 475;
                          return (
                            <g>
                              <line
                                x1={safeX}
                                y1="28"
                                x2={safeX}
                                y2="165"
                                stroke="#10B981"
                                strokeWidth="2"
                                strokeDasharray="4 3"
                              />
                              <text
                                x={safeX}
                                y="180"
                                fill="#34D399"
                                fontSize="9.5"
                                fontFamily="monospace"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                Safe Advance Limit (+{fanSummary.safeAdvanceLengthMeters}m)
                              </text>
                            </g>
                          );
                        })()}

                        {/* Render All Probe Holes & Interval Segments Ahead of Face */}
                        {holes.map((h) => {
                          const maxReach = 28;
                          const startY =
                            148 - (h.collarY / Math.max(1, tunnelHeightMeters)) * 102;
                          const dipRad = ((h.dipAngleDeg || 0) * Math.PI) / 180;
                          const hMwd = computeMwdProfileForHole(h);

                          return (
                            <g key={h.id}>
                              {h.intervals.map((intv, idx) => {
                                const m = hMwd[idx];
                                const x1 =
                                  110 +
                                  ((intv.fromMeters * Math.cos(dipRad)) / maxReach) * 475;
                                const y1 =
                                  startY -
                                  ((intv.fromMeters * Math.sin(dipRad)) / maxReach) * 140;
                                const x2 =
                                  110 +
                                  ((intv.toMeters * Math.cos(dipRad)) / maxReach) * 475;
                                const y2 =
                                  startY -
                                  ((intv.toMeters * Math.sin(dipRad)) / maxReach) * 140;

                                const segColor = m?.isHazardZone
                                  ? '#F43F5E'
                                  : intv.estimatedRqdPct < 60
                                  ? '#F59E0B'
                                  : '#22D3EE';

                                return (
                                  <g key={intv.id}>
                                    <line
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke={segColor}
                                      strokeWidth={h.id === activeHole.id ? 5 : 3}
                                      strokeLinecap="round"
                                    />
                                    {m?.isHazardZone && (
                                      <ellipse
                                        cx={(x1 + x2) * 0.5}
                                        cy={(y1 + y2) * 0.5}
                                        rx={Math.max(10, (x2 - x1) * 0.5)}
                                        ry="18"
                                        fill="#F43F5E"
                                        opacity="0.24"
                                        stroke="#FDA4AF"
                                        strokeDasharray="3 2"
                                      />
                                    )}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
