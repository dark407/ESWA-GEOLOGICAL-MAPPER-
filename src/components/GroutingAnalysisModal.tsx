import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  Droplets,
  FileText,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  GroutHoleLog,
  GroutMixType,
  GroutRingRecord,
  GroutSchemeType,
  LugeonPressureStep,
  buildSampleGroutRing,
  calculateLugeonStepValue,
  diagnoseLugeonFlowRegime,
  evaluateGinPointStatus,
  loadSavedGroutRings,
  saveGroutRingsToStorage,
} from '../engine/probeHoleAndGroutingEngine';

export interface GroutingAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectName?: string;
  defaultTunnelName?: string;
  defaultChainage?: string;
  defaultEngineerName?: string;
  onOpenProbeHoleWindow?: () => void;
}

export const GroutingAnalysisModal: React.FC<GroutingAnalysisModalProps> = ({
  isOpen,
  onClose,
  defaultProjectName = 'Himalayan Hydro Headrace Tunnel',
  defaultTunnelName = 'Headrace Tunnel (HRT-01)',
  defaultChainage = 'CH 12+450.50 m',
  defaultEngineerName = 'Senior Geotechnical Engineer',
  onOpenProbeHoleWindow,
}) => {
  const [rings, setRings] = useState<GroutRingRecord[]>(() => loadSavedGroutRings());
  const [selectedRingId, setSelectedRingId] = useState<string>(() => {
    const initial = loadSavedGroutRings();
    return initial[0]?.id || 'grout-ring-sample-1';
  });
  const [activeTab, setActiveTab] = useState<
    'RING_AND_HOLE_LOG' | 'LUGEON_AND_GIN_ANALYSIS' | 'PRINTABLE_REPORT'
  >('RING_AND_HOLE_LOG');
  const [highlightedHoleId, setHighlightedHoleId] = useState<string | null>(null);

  const activeRing = useMemo(
    () => rings.find((r) => r.id === selectedRingId) || rings[0] || null,
    [rings, selectedRingId]
  );

  const ringStats = useMemo(() => {
    if (!activeRing) {
      return {
        totalVolumeLiters: 0,
        totalCementBags: 0,
        avgFinalPressureBar: 0,
        preWaterTotal: 0,
        postWaterTotal: 0,
        waterReductionPct: 0,
        refusalCount: 0,
      };
    }
    const totalVolumeLiters = activeRing.holes.reduce(
      (acc, h) => acc + (h.groutVolumeLiters || 0),
      0
    );
    const totalCementBags = Number(
      activeRing.holes
        .reduce((acc, h) => acc + (h.cementBagsConsumed || 0), 0)
        .toFixed(1)
    );
    const avgFinalPressureBar =
      activeRing.holes.length > 0
        ? Number(
            (
              activeRing.holes.reduce((acc, h) => acc + h.finalGaugePressureBar, 0) /
              activeRing.holes.length
            ).toFixed(1)
          )
        : 0;
    const preWaterTotal = activeRing.holes.reduce(
      (acc, h) => acc + (h.preGroutWaterInflowLMin || 0),
      0
    );
    const postWaterTotal = activeRing.holes.reduce(
      (acc, h) => acc + (h.postGroutWaterInflowLMin || 0),
      0
    );
    const waterReductionPct =
      preWaterTotal > 0
        ? Number((((preWaterTotal - postWaterTotal) / preWaterTotal) * 100).toFixed(1))
        : 100;
    const refusalCount = activeRing.holes.filter((h) => h.refusalAchieved).length;

    return {
      totalVolumeLiters,
      totalCementBags,
      avgFinalPressureBar,
      preWaterTotal: Number(preWaterTotal.toFixed(1)),
      postWaterTotal: Number(postWaterTotal.toFixed(1)),
      waterReductionPct,
      refusalCount,
    };
  }, [activeRing]);

  const activeLugeonTest = activeRing?.lugeonTests?.[0] || null;
  const lugeonDiagnosis = useMemo(
    () =>
      activeLugeonTest
        ? diagnoseLugeonFlowRegime(activeLugeonTest.steps)
        : diagnoseLugeonFlowRegime([]),
    [activeLugeonTest]
  );

  if (!isOpen) return null;

  const updateRingsAndPersist = (nextRings: GroutRingRecord[]) => {
    setRings(nextRings);
    saveGroutRingsToStorage(nextRings);
  };

  const handleUpdateActiveRing = (patch: Partial<GroutRingRecord>) => {
    if (!activeRing) return;
    const next = rings.map((r) =>
      r.id === activeRing.id
        ? { ...r, ...patch, updatedAt: new Date().toISOString() }
        : r
    );
    updateRingsAndPersist(next);
  };

  const handleAddNewGroutRing = () => {
    const nextIdx = rings.length + 1;
    const sample = buildSampleGroutRing(
      defaultProjectName,
      defaultTunnelName,
      defaultChainage
    );
    const newRing: GroutRingRecord = {
      ...sample,
      id: `grout-ring-${Date.now()}`,
      ringId: `GR-RING-0${nextIdx} (${defaultChainage})`,
      engineerName: defaultEngineerName,
      updatedAt: new Date().toISOString(),
    };
    const next = [...rings, newRing];
    updateRingsAndPersist(next);
    setSelectedRingId(newRing.id);
  };

  const handleAddGroutHole = () => {
    if (!activeRing) return;
    const nextNum = activeRing.holes.length + 1;
    const holeNumber = `GH-${String(nextNum).padStart(2, '0')}`;
    const newHole: GroutHoleLog = {
      id: `gh-${Date.now()}`,
      holeNumber,
      clockPosition: '12:00 Crown Arch',
      angleAroundArchDeg: ((nextNum % 7) - 3) * 22,
      lengthMeters: 18,
      stageFromMeters: 0,
      stageToMeters: 18,
      mixType: 'OPC Cement (W:C 0.8:1)',
      wcRatio: 0.8,
      initialPressureBar: 6,
      finalGaugePressureBar: 22,
      targetMaxPressureBar: activeRing.maxPressureLimitBar,
      groutVolumeLiters: 950,
      cementBagsConsumed: 14.8,
      injectionDurationMin: 28,
      refusalAchieved: true,
      refusalCriterion: 'Target Pressure Reached',
      preGroutWaterInflowLMin: 15,
      postGroutWaterInflowLMin: 0.8,
      remarks: 'Standard umbrella consolidation stage.',
    };
    handleUpdateActiveRing({
      holes: [...activeRing.holes, newHole],
    });
  };

  const handleUpdateGroutHole = (holeId: string, patch: Partial<GroutHoleLog>) => {
    if (!activeRing) return;
    const nextHoles = activeRing.holes.map((h) => {
      if (h.id !== holeId) return h;
      const merged = { ...h, ...patch };
      // Automatically update estimated 50kg cement bags when volume or W:C ratio changes
      if (patch.groutVolumeLiters !== undefined || patch.wcRatio !== undefined) {
        const volLiters = merged.groutVolumeLiters || 0;
        const wc = Math.max(0.4, merged.wcRatio || 0.8);
        // 1 kg cement occupies ~0.32 L + water wc L -> kg cement = volLiters / (wc + 0.32)
        const cementKg = volLiters / (wc + 0.32);
        merged.cementBagsConsumed = Number((cementKg / 50).toFixed(1));
      }
      return merged;
    });
    handleUpdateActiveRing({ holes: nextHoles });
  };

  const handleDeleteGroutHole = (holeId: string) => {
    if (!activeRing || activeRing.holes.length <= 1) return;
    handleUpdateActiveRing({
      holes: activeRing.holes.filter((h) => h.id !== holeId),
    });
  };

  const handleUpdateLugeonStep = (
    stepNum: 1 | 2 | 3 | 4 | 5,
    patch: Partial<LugeonPressureStep>
  ) => {
    if (!activeRing || !activeLugeonTest) return;
    const nextSteps = activeLugeonTest.steps.map((s) =>
      s.stepNumber === stepNum ? { ...s, ...patch } : s
    );
    const nextTest = { ...activeLugeonTest, steps: nextSteps };
    handleUpdateActiveRing({
      lugeonTests: [nextTest],
    });
  };

  const handleResetSampleGroutRing = () => {
    const sample = buildSampleGroutRing(
      defaultProjectName,
      defaultTunnelName,
      defaultChainage
    );
    updateRingsAndPersist([sample]);
    setSelectedRingId(sample.id);
  };

  const handleExportGroutJson = () => {
    const blob = new Blob([JSON.stringify({ rings, ringStats, lugeonDiagnosis }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NATM_Grouting_${(activeRing?.chainage || 'CH').replace(/\s+/g, '_')}.json`;
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
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  NATM Pre-Excavation &amp; Consolidation Grouting Workspace
                </h2>
                <span className="text-xs font-mono text-emerald-300">
                  · {activeRing?.chainage || defaultChainage}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Umbrella Arch &amp; Consolidation Fan Layout · Hole-by-Hole Mix/Pressure/Volume Log · Lugeon &amp; GIN Refusal Curves
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('RING_AND_HOLE_LOG')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'RING_AND_HOLE_LOG'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Umbrella Fan &amp; Injection Log
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LUGEON_AND_GIN_ANALYSIS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'LUGEON_AND_GIN_ANALYSIS'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Lugeon Water Test &amp; GIN Curve
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PRINTABLE_REPORT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'PRINTABLE_REPORT'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                3. Printable Engineering Report
              </button>
            </div>

            {onOpenProbeHoleWindow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProbeHoleWindow();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Switch directly to Separate Probe Hole Drilling Window"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Open Probe Hole Window</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetSampleGroutRing}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              title="Reset Sample Grout Ring"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sample Ring</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              title="Close Grouting Window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI SUMMARY STRIP */}
        <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
          <div className="flex items-center gap-2 text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Water Ingress Cutoff Efficiency:{' '}
              <strong className="text-white">{ringStats.waterReductionPct}%</strong> (Pre-Grout{' '}
              {ringStats.preWaterTotal} L/min → Post-Grout {ringStats.postWaterTotal} L/min)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <span>
              Total Grout Take:{' '}
              <strong className="text-emerald-300">
                {ringStats.totalVolumeLiters.toLocaleString()} L
              </strong>
            </span>
            <span>·</span>
            <span>
              Cement Consumed:{' '}
              <strong className="text-amber-300">{ringStats.totalCementBags} Bags (50kg)</strong>
            </span>
            <span>·</span>
            <span>
              Mean Final Pressure:{' '}
              <strong className="text-cyan-300">{ringStats.avgFinalPressureBar} bar</strong>
            </span>
            <span>·</span>
            <span>
              Refusal Verified:{' '}
              <strong className="text-white">
                {ringStats.refusalCount}/{activeRing?.holes.length || 0} Holes
              </strong>
            </span>
          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* RING SELECTOR BAR */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {rings.map((r) => {
                const isSelected = activeRing?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRingId(r.id)}
                    className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold">{r.ringId}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {r.schemeType.replace(/_/g, ' ')} · {r.holes.length} Holes · GIN {r.targetGinBarLitersPerM}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddNewGroutRing}
                className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Grout Ring</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportGroutJson}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          {activeTab === 'RING_AND_HOLE_LOG' && activeRing && (
            <div className="space-y-4">
              {/* TOP ROW: GROUT RING CONFIGURATION + UMBRELLA ARCH VISUALIZATION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400">
                      Pre-Excavation Umbrella &amp; Consolidation Fan Layout
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Look-Out {activeRing.lookOutAngleDeg}° · Overlap {activeRing.overlapMeters}m
                    </span>
                  </div>

                  <div className="w-full h-64 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2">
                    <svg viewBox="0 0 360 280" className="w-full h-full">
                      {/* Outer Grouted Consolidation Halo */}
                      <path
                        d="M 40 250 L 40 140 A 140 140 0 0 1 320 140 L 320 250 Z"
                        fill="#064E3B"
                        opacity="0.25"
                        stroke="#10B981"
                        strokeDasharray="5 4"
                      />

                      {/* Inner Tunnel Excavation Profile */}
                      <path
                        d="M 75 250 L 75 148 A 105 105 0 0 1 285 148 L 285 250 Z"
                        fill="#0F172A"
                        stroke="#E2E8F0"
                        strokeWidth="2.5"
                      />

                      {/* Render Grout Holes around Arch */}
                      {activeRing.holes.map((h) => {
                        const rad = ((h.angleAroundArchDeg - 90) * Math.PI) / 180;
                        const xCollar = 180 + Math.cos(rad) * 105;
                        const yCollar = 148 + Math.sin(rad) * 105;
                        const takeScale = Math.min(48, Math.max(18, (h.groutVolumeLiters / 1800) * 45));
                        const xTip = 180 + Math.cos(rad) * (105 + takeScale);
                        const yTip = 148 + Math.sin(rad) * (105 + takeScale);
                        const isHi = highlightedHoleId === h.id;

                        return (
                          <g
                            key={h.id}
                            onClick={() => setHighlightedHoleId(h.id)}
                            className="cursor-pointer"
                          >
                            {/* Grout Bulb around Hole */}
                            <line
                              x1={xCollar}
                              y1={yCollar}
                              x2={xTip}
                              y2={yTip}
                              stroke={h.refusalAchieved ? '#10B981' : '#F59E0B'}
                              strokeWidth={isHi ? 5 : 3}
                              strokeLinecap="round"
                            />
                            <circle
                              cx={xTip}
                              cy={yTip}
                              r={Math.max(4, Math.min(11, h.groutVolumeLiters / 180))}
                              fill="#10B981"
                              opacity="0.38"
                            />
                            <circle
                              cx={xCollar}
                              cy={yCollar}
                              r={isHi ? 6 : 4.5}
                              fill={isHi ? '#FBBF24' : '#34D399'}
                              stroke="#020617"
                              strokeWidth="1.5"
                            />
                            <text
                              x={180 + Math.cos(rad) * (120 + takeScale)}
                              y={148 + Math.sin(rad) * (120 + takeScale)}
                              fill="#A7F3D0"
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {h.holeNumber} ({h.groutVolumeLiters}L)
                            </text>
                          </g>
                        );
                      })}

                      <text
                        x="180"
                        y="205"
                        fill="#94A3B8"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {activeRing.ringId}
                      </text>
                      <text
                        x="180"
                        y="220"
                        fill="#34D399"
                        fontSize="9.5"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        Total Grout Halo: {ringStats.totalVolumeLiters} L ({ringStats.totalCementBags} Bags)
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                      Grout Ring Design &amp; Lombardi GIN Refusal Parameters
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">Ring Identifier</span>
                      <input
                        type="text"
                        value={activeRing.ringId}
                        onChange={(e) => handleUpdateActiveRing({ ringId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">Grouting Scheme</span>
                      <select
                        value={activeRing.schemeType}
                        onChange={(e) =>
                          handleUpdateActiveRing({
                            schemeType: e.target.value as GroutSchemeType,
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                      >
                        <option value="PRE_EXCAVATION_UMBRELLA">
                          Pre-Excavation Umbrella Curtain
                        </option>
                        <option value="RADIAL_CONSOLIDATION_RING">
                          Radial Consolidation Ring
                        </option>
                        <option value="WATER_CUTOFF_FAN">
                          High-Pressure Water Cutoff Fan
                        </option>
                        <option value="CONTACT_BACKFILL_GROUTING">
                          Crown Contact / Backfill Grouting
                        </option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">Station Chainage</span>
                      <input
                        type="text"
                        value={activeRing.chainage}
                        onChange={(e) => handleUpdateActiveRing({ chainage: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-white"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">
                        Target GIN (bar·L/m)
                      </span>
                      <input
                        type="number"
                        step="50"
                        value={activeRing.targetGinBarLitersPerM}
                        onChange={(e) =>
                          handleUpdateActiveRing({
                            targetGinBarLitersPerM: Math.max(
                              300,
                              parseFloat(e.target.value) || 1500
                            ),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-emerald-300 font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">
                        Max Pressure P_max (bar)
                      </span>
                      <input
                        type="number"
                        step="1"
                        value={activeRing.maxPressureLimitBar}
                        onChange={(e) =>
                          handleUpdateActiveRing({
                            maxPressureLimitBar: Math.max(
                              5,
                              parseFloat(e.target.value) || 25
                            ),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 font-medium block">
                        Max Volume V_max (L/m)
                      </span>
                      <input
                        type="number"
                        step="10"
                        value={activeRing.maxVolumeLimitLitersPerM}
                        onChange={(e) =>
                          handleUpdateActiveRing({
                            maxVolumeLimitLitersPerM: Math.max(
                              20,
                              parseFloat(e.target.value) || 180
                            ),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-amber-300 font-bold"
                      />
                    </label>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="font-mono font-bold text-emerald-400">
                      GIN (Grouting Intensity Number) Control Principle:
                    </div>
                    <p>
                      Limits the product of final injection pressure <span className="font-mono">P (bar)</span> and normalized volume take{' '}
                      <span className="font-mono">V (L/m)</span> so wide open fissures are capped by volume while tight joints reach full refusal pressure without hydrojacking the tunnel arch.
                    </p>
                  </div>
                </div>
              </div>

              {/* HOLE-BY-HOLE INJECTION SCHEDULE TABLE */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400">
                      Hole-by-Hole Grout Mix W:C Ratio, Pressure &amp; Volume Take Log
                    </h3>
                    <p className="text-xs text-slate-400">
                      Log hole length, grout mix W:C ratio, final gauge pressure, volume injected, cement bags, and refusal status.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddGroutHole}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Grout Hole</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                        <th className="py-2 px-2">Hole #</th>
                        <th className="py-2 px-2">Clock Sector</th>
                        <th className="py-2 px-2">Angle (°)</th>
                        <th className="py-2 px-2">Length (m)</th>
                        <th className="py-2 px-2">Grout Mix Type</th>
                        <th className="py-2 px-2">W:C Ratio</th>
                        <th className="py-2 px-2">Final P (bar)</th>
                        <th className="py-2 px-2">Take (Liters)</th>
                        <th className="py-2 px-2">Bags (50kg)</th>
                        <th className="py-2 px-2">Pre/Post Q (L/m)</th>
                        <th className="py-2 px-2">Refusal Criterion</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRing.holes.map((h) => {
                        const volPerM = h.groutVolumeLiters / Math.max(1, h.lengthMeters);
                        const ginEval = evaluateGinPointStatus(
                          h.finalGaugePressureBar,
                          volPerM,
                          activeRing.targetGinBarLitersPerM,
                          activeRing.maxPressureLimitBar,
                          activeRing.maxVolumeLimitLitersPerM
                        );
                        return (
                          <tr
                            key={h.id}
                            onClick={() => setHighlightedHoleId(h.id)}
                            className={`border-b border-slate-800/80 ${
                              highlightedHoleId === h.id
                                ? 'bg-emerald-950/30'
                                : 'hover:bg-slate-900/40'
                            }`}
                          >
                            <td className="py-2 px-1.5">
                              <input
                                type="text"
                                value={h.holeNumber}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    holeNumber: e.target.value,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="text"
                                value={h.clockPosition}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    clockPosition: e.target.value,
                                  })
                                }
                                className="w-32 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="5"
                                value={h.angleAroundArchDeg}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    angleAroundArchDeg: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={h.lengthMeters}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    lengthMeters: Math.max(1, parseFloat(e.target.value) || 12),
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={h.mixType}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    mixType: e.target.value as GroutMixType,
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              >
                                <option value="OPC Cement (W:C 1.0:1)">OPC Cement (W:C 1.0:1)</option>
                                <option value="OPC Cement (W:C 0.8:1)">OPC Cement (W:C 0.8:1)</option>
                                <option value="OPC Cement (W:C 0.6:1 + Superplasticizer)">
                                  OPC Cement (W:C 0.6:1 + SP)
                                </option>
                                <option value="Microfine Cement (W:C 1.0:1)">
                                  Microfine Cement (W:C 1.0:1)
                                </option>
                                <option value="Cement-Bentonite Suspension">
                                  Cement-Bentonite Suspension
                                </option>
                                <option value="Two-Component Polyurethane (PU) Resin">
                                  Polyurethane (PU) Resin
                                </option>
                                <option value="Colloidal Silica Gel">Colloidal Silica Gel</option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.1"
                                value={h.wcRatio}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    wcRatio: Math.max(0.4, parseFloat(e.target.value) || 0.8),
                                  })
                                }
                                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={h.finalGaugePressureBar}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    finalGaugePressureBar: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className={`w-16 px-2 py-1 rounded bg-slate-900 border font-bold ${
                                  ginEval.status === 'EXCEEDED_HYDROJACKING_RISK'
                                    ? 'border-rose-500 text-rose-300'
                                    : 'border-slate-700 text-cyan-300'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="10"
                                value={h.groutVolumeLiters}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    groutVolumeLiters: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-bold"
                              />
                            </td>
                            <td className="py-2 px-1.5 text-slate-300 font-bold">
                              {h.cementBagsConsumed}
                            </td>
                            <td className="py-2 px-1.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="1"
                                  value={h.preGroutWaterInflowLMin}
                                  onChange={(e) =>
                                    handleUpdateGroutHole(h.id, {
                                      preGroutWaterInflowLMin: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-12 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-rose-300"
                                  title="Pre-grouting water inflow (L/min)"
                                />
                                <span>→</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={h.postGroutWaterInflowLMin}
                                  onChange={(e) =>
                                    handleUpdateGroutHole(h.id, {
                                      postGroutWaterInflowLMin: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-12 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300"
                                  title="Post-grouting residual water inflow (L/min)"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={h.refusalCriterion}
                                onChange={(e) =>
                                  handleUpdateGroutHole(h.id, {
                                    refusalCriterion: e.target.value as GroutHoleLog['refusalCriterion'],
                                    refusalAchieved: e.target.value !== 'In Progress',
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                              >
                                <option value="Target Pressure Reached">
                                  Target Pressure Reached
                                </option>
                                <option value="Volume Limit (GIN) Reached">
                                  Volume Limit (GIN) Reached
                                </option>
                                <option value="Surface Leakage / Caulked">
                                  Surface Leakage / Caulked
                                </option>
                                <option value="In Progress">In Progress</option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5">
                              {activeRing.holes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGroutHole(h.id)}
                                  className="p-1 rounded hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 cursor-pointer"
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
            </div>
          )}

          {activeTab === 'LUGEON_AND_GIN_ANALYSIS' && activeRing && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT 6 COLS: 5-STEP LUGEON WATER PRESSURE TEST */}
              <div className="lg:col-span-6 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400 block">
                      1. 5-Stage Lugeon Water Permeability Test (Houlsby Method)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      1 Lugeon = 1 L/min/m at 10 bar effective injection pressure
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-black text-cyan-300">
                      {lugeonDiagnosis.representativeLugeon} Lu
                    </div>
                    <div className="text-[11px] text-amber-300">
                      {lugeonDiagnosis.flowRegime}
                    </div>
                  </div>
                </div>

                {activeLugeonTest && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                          <th className="py-2 px-2">Stage</th>
                          <th className="py-2 px-2">P_eff (bar)</th>
                          <th className="py-2 px-2">Water Take Q (L/min)</th>
                          <th className="py-2 px-2">Test Length (m)</th>
                          <th className="py-2 px-2">Calculated Lugeon (Lu)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLugeonTest.steps.map((step) => {
                          const lu = calculateLugeonStepValue(step);
                          return (
                            <tr key={step.stepNumber} className="border-b border-slate-800/80">
                              <td className="py-2 px-2 font-bold text-slate-200">
                                Step {step.stepNumber}: {step.stepLabel}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={step.effectivePressureBar}
                                  onChange={(e) =>
                                    handleUpdateLugeonStep(step.stepNumber, {
                                      effectivePressureBar: Math.max(
                                        0.5,
                                        parseFloat(e.target.value) || 1
                                      ),
                                    })
                                  }
                                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="1"
                                  value={step.waterTakeLitersPerMin}
                                  onChange={(e) =>
                                    handleUpdateLugeonStep(step.stepNumber, {
                                      waterTakeLitersPerMin: Math.max(
                                        0,
                                        parseFloat(e.target.value) || 0
                                      ),
                                    })
                                  }
                                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={step.testSectionLengthMeters}
                                  onChange={(e) =>
                                    handleUpdateLugeonStep(step.stepNumber, {
                                      testSectionLengthMeters: Math.max(
                                        0.5,
                                        parseFloat(e.target.value) || 5
                                      ),
                                    })
                                  }
                                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                                />
                              </td>
                              <td className="py-2 px-2 font-black text-emerald-300">
                                {lu.toFixed(2)} Lu
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-400">
                      Equivalent Hydraulic Conductivity (k):
                    </span>
                    <strong className="text-cyan-300">
                      {lugeonDiagnosis.permeabilityCmPerSec} cm/s
                    </strong>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-400">Houlsby Flow Regime Diagnosis:</span>
                    <strong className="text-amber-300">{lugeonDiagnosis.flowRegime}</strong>
                  </div>
                  <div className="pt-1 text-slate-300 border-t border-slate-800">
                    {lugeonDiagnosis.groutingActionRequired}
                  </div>
                </div>
              </div>

              {/* RIGHT 6 COLS: LOMBARDI GIN HYPERBOLIC REFUSAL ENVELOPE CURVE */}
              <div className="lg:col-span-6 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400 block">
                      2. Lombardi GIN Refusal Curve (P × V = {activeRing.targetGinBarLitersPerM} bar·L/m)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Plots each hole&apos;s Final Pressure (bar) vs. Specific Take (L/m) against the GIN limit
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-300">
                    P_max={activeRing.maxPressureLimitBar} bar · V_max={activeRing.maxVolumeLimitLitersPerM} L/m
                  </span>
                </div>

                <div className="w-full h-64 bg-slate-900 rounded-xl border border-slate-800 p-3">
                  <svg viewBox="0 0 460 215" className="w-full h-full">
                    {/* Axes */}
                    <line x1="45" y1="20" x2="45" y2="180" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="45" y1="180" x2="430" y2="180" stroke="#64748B" strokeWidth="1.5" />

                    {/* Hyperbolic GIN Envelope Path */}
                    {(() => {
                      const pScale = activeRing.maxPressureLimitBar * 1.25;
                      const vScale = activeRing.maxVolumeLimitLitersPerM * 1.25;
                      const pts: string[] = [];

                      for (let v = 5; v <= activeRing.maxVolumeLimitLitersPerM; v += 5) {
                        const pEnv = Math.min(
                          activeRing.maxPressureLimitBar,
                          activeRing.targetGinBarLitersPerM / v
                        );
                        const x = 45 + (v / vScale) * 375;
                        const y = 180 - (pEnv / pScale) * 150;
                        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                      }
                      // Vertical drop at V_max
                      const xVmax = 45 + (activeRing.maxVolumeLimitLitersPerM / vScale) * 375;
                      pts.push(`${xVmax.toFixed(1)},180`);

                      return (
                        <>
                          <polygon
                            points={`45,180 ${pts.join(' ')}`}
                            fill="#10B981"
                            opacity="0.14"
                          />
                          <polyline
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            points={pts.join(' ')}
                          />

                          {/* Plot Grout Holes on P-V Diagram */}
                          {activeRing.holes.map((h) => {
                            const vPerM = h.groutVolumeLiters / Math.max(1, h.lengthMeters);
                            const x = 45 + Math.min(1, vPerM / vScale) * 375;
                            const y =
                              180 - Math.min(1, h.finalGaugePressureBar / pScale) * 150;
                            const evalRes = evaluateGinPointStatus(
                              h.finalGaugePressureBar,
                              vPerM,
                              activeRing.targetGinBarLitersPerM,
                              activeRing.maxPressureLimitBar,
                              activeRing.maxVolumeLimitLitersPerM
                            );
                            const dotColor =
                              evalRes.status === 'EXCEEDED_HYDROJACKING_RISK'
                                ? '#F43F5E'
                                : evalRes.status === 'REFUSAL_ENVELOPE_REACHED'
                                ? '#FBBF24'
                                : '#38BDF8';

                            return (
                              <g key={h.id}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="5"
                                  fill={dotColor}
                                  stroke="#020617"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={x}
                                  y={y - 8}
                                  fill="#E2E8F0"
                                  fontSize="9"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {h.holeNumber}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}

                    <text
                      x="235"
                      y="202"
                      fill="#94A3B8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      Normalized Grout Take Volume V (Liters / m of borehole)
                    </text>
                    <text
                      x="15"
                      y="105"
                      fill="#94A3B8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                      transform="rotate(-90 15 105)"
                    >
                      Pressure P (bar)
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PRINTABLE_REPORT' && activeRing && (
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-5 max-w-5xl mx-auto">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-bold">
                    NATM Pre-Excavation &amp; Consolidation Grouting Engineering Report
                  </div>
                  <h3 className="text-xl font-black text-slate-950 mt-0.5">
                    {activeRing.projectName} — {activeRing.tunnelName}
                  </h3>
                  <div className="text-xs font-mono text-slate-700 mt-1">
                    Ring ID: <strong>{activeRing.ringId}</strong> · Station:{' '}
                    <strong>{activeRing.chainage}</strong> · Date:{' '}
                    <strong>{activeRing.date}</strong> · Engineer:{' '}
                    <strong>{activeRing.engineerName}</strong>
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
                  <span className="text-slate-500 block">Total Grout Volume</span>
                  <strong className="text-slate-950 text-sm">
                    {ringStats.totalVolumeLiters.toLocaleString()} Liters
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Cement Consumed</span>
                  <strong className="text-slate-950 text-sm">
                    {ringStats.totalCementBags} Bags (50kg)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Water Cutoff Reduction</span>
                  <strong className="text-emerald-700 text-sm">
                    {ringStats.waterReductionPct}% ({ringStats.preWaterTotal} →{' '}
                    {ringStats.postWaterTotal} L/min)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Representative Lugeon</span>
                  <strong className="text-sky-700 text-sm">
                    {lugeonDiagnosis.representativeLugeon} Lu ({lugeonDiagnosis.flowRegime})
                  </strong>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs font-mono border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="py-2 px-2">Hole #</th>
                    <th className="py-2 px-2">Clock Sector</th>
                    <th className="py-2 px-2">Length (m)</th>
                    <th className="py-2 px-2">Grout Mix</th>
                    <th className="py-2 px-2">W:C</th>
                    <th className="py-2 px-2">Final P (bar)</th>
                    <th className="py-2 px-2">Volume (L)</th>
                    <th className="py-2 px-2">Bags</th>
                    <th className="py-2 px-2">Pre→Post Q</th>
                    <th className="py-2 px-2">Refusal Criterion</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRing.holes.map((h) => (
                    <tr key={h.id} className="border-b border-slate-200">
                      <td className="py-1.5 px-2 font-bold">{h.holeNumber}</td>
                      <td className="py-1.5 px-2">{h.clockPosition}</td>
                      <td className="py-1.5 px-2">{h.lengthMeters}m</td>
                      <td className="py-1.5 px-2">{h.mixType}</td>
                      <td className="py-1.5 px-2">{h.wcRatio}</td>
                      <td className="py-1.5 px-2">{h.finalGaugePressureBar}</td>
                      <td className="py-1.5 px-2 font-bold">{h.groutVolumeLiters}</td>
                      <td className="py-1.5 px-2">{h.cementBagsConsumed}</td>
                      <td className="py-1.5 px-2">
                        {h.preGroutWaterInflowLMin}→{h.postGroutWaterInflowLMin} L/m
                      </td>
                      <td className="py-1.5 px-2">{h.refusalCriterion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-slate-800">
                <strong>Quality Assurance &amp; Excavation Clearance:</strong>{' '}
                {lugeonDiagnosis.groutingActionRequired} All {ringStats.refusalCount} grout holes achieved target refusal criteria with {ringStats.waterReductionPct}% groundwater inflow reduction.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
