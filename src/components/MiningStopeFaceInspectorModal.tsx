import React, { useMemo, useState } from 'react';
import {
  X,
  Pickaxe,
  TrendingUp,
  Layers,
  Shield,
  Activity,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Gauge,
  Compass,
} from 'lucide-react';
import {
  FaceChannelSampleRecord,
  Joint,
  LaubscherMrmrParameters,
  MathewsStabilityParameters,
  MineralizedVeinRecord,
  MiningExcavationType,
  MiningMethodType,
  MiningStopeSettings,
  OreZoneCategory,
  QIndexParameters,
  RmrParameters,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  calculateLaubscherMrmr,
  calculateMathewsStability,
} from '../engine/rockMassClassificationEngine';

interface MiningStopeFaceInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TunnelSettings;
  geometry: TunnelGeometry;
  joints: Joint[];
  qIndexParams: QIndexParameters;
  rmrParams?: RmrParameters;
  miningSettings?: MiningStopeSettings;
  onUpdateMiningSettings: (next: MiningStopeSettings) => void;
}

const EXCAVATION_TYPES: { id: MiningExcavationType; label: string; desc: string }[] = [
  { id: 'STOPE', label: 'Production Stope', desc: 'Active primary or secondary ore extraction excavation' },
  { id: 'DRIFT', label: 'Drift / Level Drive', desc: 'Horizontal mine opening along the strike of the orebody' },
  { id: 'DECLINE', label: 'Ramp / Decline', desc: 'Inclined spiral access roadway between mine levels' },
  { id: 'CROSS_CUT', label: 'Cross-Cut', desc: 'Horizontal development driven across the strike of the orebody' },
  { id: 'RAISE', label: 'Raise / Ore Pass', desc: 'Vertical or steeply inclined opening driven upward' },
  { id: 'SHAFT', label: 'Vertical Shaft', desc: 'Main hoisting or ventilation vertical opening' },
  { id: 'DRAWPOINT', label: 'Drawpoint', desc: 'Opening under a stope through which broken ore is extracted' },
  { id: 'SILL_PILLAR', label: 'Sill Pillar', desc: 'Horizontal rock block left directly below an upper level' },
  { id: 'CROWN_PILLAR', label: 'Crown Pillar', desc: 'Rock pillar left above a stope below the surface or upper level' },
];

const MINING_METHODS: { id: MiningMethodType; label: string }[] = [
  { id: 'CUT_AND_FILL', label: 'Overhand / Underhand Cut & Fill' },
  { id: 'SUBLEVEL_OPEN_STOPING', label: 'Sublevel Open Stoping (SLOS)' },
  { id: 'ROOM_AND_PILLAR', label: 'Room & Pillar Mining' },
  { id: 'VCR', label: 'Vertical Crater Retreat (VCR)' },
  { id: 'BLOCK_CAVING', label: 'Block / Panel Caving' },
  { id: 'SHRINKAGE', label: 'Shrinkage Stoping' },
  { id: 'BENCH_STOPING', label: 'Sublevel Bench Stoping' },
];

const ORE_ZONE_COLORS: Record<OreZoneCategory, { bg: string; text: string; border: string; label: string }> = {
  HIGH_GRADE_ORE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500', label: 'High Grade Ore' },
  MEDIUM_GRADE_ORE: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500', label: 'Medium Grade Ore' },
  LOW_GRADE_ORE: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500', label: 'Low Grade Ore' },
  INTERNAL_DILUTION: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500', label: 'Internal Dilution' },
  WASTE_ROCK: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500', label: 'Waste Rock' },
};

export const MiningStopeFaceInspectorModal: React.FC<MiningStopeFaceInspectorModalProps> = ({
  isOpen,
  onClose,
  settings,
  geometry,
  joints,
  qIndexParams,
  rmrParams,
  miningSettings,
  onUpdateMiningSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'stope_info' | 'grade_control' | 'laubscher_mrmr' | 'mathews_graph'>('stope_info');

  // Initialize or fallback default state
  const state: MiningStopeSettings = useMemo(() => {
    return {
      mineName: miningSettings?.mineName || settings.projectName || 'Underground Hardrock Mine',
      mineLevel: miningSettings?.mineLevel || 'Level -450m',
      stopeOrDriftId: miningSettings?.stopeOrDriftId || settings.tunnelName || 'Stope 450-East-01',
      excavationType: miningSettings?.excavationType || 'STOPE',
      miningMethod: miningSettings?.miningMethod || 'SUBLEVEL_OPEN_STOPING',
      oreBodyName: miningSettings?.oreBodyName || 'Main Quartz-Sulfide Reef',
      primaryCommodity: miningSettings?.primaryCommodity || 'Gold (Au)',
      gradeUnits: miningSettings?.gradeUnits || 'g/t',
      targetCutoffGrade: miningSettings?.targetCutoffGrade || '2.5',
      hangingwallDipDeg: miningSettings?.hangingwallDipDeg ?? 65,
      footwallDipDeg: miningSettings?.footwallDipDeg ?? 60,
      veins: miningSettings?.veins || [
        {
          id: 'vein_1',
          name: 'V1 Main Sulfide Quartz Lode',
          oreZone: 'HIGH_GRADE_ORE',
          strikeDeg: Math.round((settings.driveDirection + 90) % 360),
          dipDeg: 68,
          dipDirectionDeg: Math.round((settings.driveDirection + 180) % 360),
          trueThicknessMeters: 1.85,
          apparentThicknessMeters: 2.1,
          estimatedGrade: '5.8 g/t Au',
          mineralogyNotes: 'Visible electrum, auriferous pyrite, arsenopyrite with smokey quartz matrix',
        },
      ],
      channelSamples: miningSettings?.channelSamples || [
        {
          id: 'cs_1',
          sampleNumber: 'CH-450-01-A',
          fromMeter: 0.0,
          toMeter: 1.0,
          sampleLengthMeters: 1.0,
          lithologyOrVein: 'Footwall Metasediments',
          gradeValue: '0.4 g/t',
          sampledBy: settings.mappedBy || 'Mine Geologist',
          date: settings.date || new Date().toISOString().slice(0, 10),
        },
        {
          id: 'cs_2',
          sampleNumber: 'CH-450-01-B',
          fromMeter: 1.0,
          toMeter: 2.8,
          sampleLengthMeters: 1.8,
          lithologyOrVein: 'V1 High Grade Quartz Reef',
          gradeValue: '6.4 g/t',
          sampledBy: settings.mappedBy || 'Mine Geologist',
          date: settings.date || new Date().toISOString().slice(0, 10),
        },
        {
          id: 'cs_3',
          sampleNumber: 'CH-450-01-C',
          fromMeter: 2.8,
          toMeter: 4.5,
          sampleLengthMeters: 1.7,
          lithologyOrVein: 'Hangingwall Basalt Waste',
          gradeValue: '0.1 g/t',
          sampledBy: settings.mappedBy || 'Mine Geologist',
          date: settings.date || new Date().toISOString().slice(0, 10),
        },
      ],
      mrmr: miningSettings?.mrmr || calculateLaubscherMrmr({ baseRmr: rmrParams ? 65 : 60 }),
      mathews: miningSettings?.mathews || calculateMathewsStability({
        rqd: qIndexParams.rqd || 75,
        jn: qIndexParams.jn || 6,
        jr: qIndexParams.jr || 2,
        ja: qIndexParams.ja || 2,
        stopeDipAngleDeg: miningSettings?.hangingwallDipDeg ?? 65,
        stopeSurfaceAreaSqM: Math.round(geometry.width * (geometry.height || 4.5) * 4),
        stopeSurfacePerimeterMeters: Math.round((geometry.width + (geometry.height || 4.5)) * 4),
      }),
    };
  }, [miningSettings, settings, geometry, qIndexParams, rmrParams]);

  const liveMrmr = useMemo(() => {
    return calculateLaubscherMrmr(state.mrmr);
  }, [state.mrmr]);

  const liveMathews = useMemo(() => {
    return calculateMathewsStability(state.mathews);
  }, [state.mathews]);

  if (!isOpen) return null;

  const handleUpdate = (patch: Partial<MiningStopeSettings>) => {
    onUpdateMiningSettings({
      ...state,
      ...patch,
    });
  };

  const handleAddVein = () => {
    const nextVein: MineralizedVeinRecord = {
      id: `vein_${Date.now()}`,
      name: `Vein V${state.veins.length + 1}`,
      oreZone: 'MEDIUM_GRADE_ORE',
      strikeDeg: Math.round((settings.driveDirection + 85) % 360),
      dipDeg: 65,
      dipDirectionDeg: Math.round((settings.driveDirection + 175) % 360),
      trueThicknessMeters: 0.8,
      apparentThicknessMeters: 0.95,
      estimatedGrade: `3.0 ${state.gradeUnits}`,
      mineralogyNotes: 'Massive sulfides in quartz vein stringers',
    };
    handleUpdate({ veins: [...state.veins, nextVein] });
  };

  const handleRemoveVein = (id: string) => {
    handleUpdate({ veins: state.veins.filter((v) => v.id !== id) });
  };

  const handleAddChannelSample = () => {
    const lastSample = state.channelSamples[state.channelSamples.length - 1];
    const fromM = lastSample ? lastSample.toMeter : 0.0;
    const toM = fromM + 1.0;
    const nextSample: FaceChannelSampleRecord = {
      id: `cs_${Date.now()}`,
      sampleNumber: `CH-${state.stopeOrDriftId.slice(-3)}-0${state.channelSamples.length + 1}`,
      fromMeter: Number(fromM.toFixed(2)),
      toMeter: Number(toM.toFixed(2)),
      sampleLengthMeters: 1.0,
      lithologyOrVein: 'Mineralized Zone',
      gradeValue: `2.0 ${state.gradeUnits}`,
      sampledBy: settings.mappedBy || 'Mine Geologist',
      date: settings.date || new Date().toISOString().slice(0, 10),
    };
    handleUpdate({ channelSamples: [...state.channelSamples, nextSample] });
  };

  const handleRemoveChannelSample = (id: string) => {
    handleUpdate({ channelSamples: state.channelSamples.filter((s) => s.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 shadow-sm">
              <Pickaxe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  MINING MODE · UNDERGROUND HARDROCK
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {state.mineLevel} · {state.stopeOrDriftId}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Underground Mining Face & Stope Inspector</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2 bg-slate-950/80 border-b border-slate-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('stope_info')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'stope_info'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Stope & Excavation Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grade_control')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'grade_control'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>2. Grade Control & Veins ({state.veins.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('laubscher_mrmr')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'laubscher_mrmr'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>3. Laubscher MRMR ({liveMrmr.totalMrmr})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mathews_graph')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'mathews_graph'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>4. Mathews Potvin Stability (N&apos;={liveMathews.modifiedStabilityNumberNPrime})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: STOPE SETUP */}
          {activeTab === 'stope_info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                    Mine / Project Name
                  </label>
                  <input
                    type="text"
                    value={state.mineName}
                    onChange={(e) => handleUpdate({ mineName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                    Mine Level / Elevation
                  </label>
                  <input
                    type="text"
                    value={state.mineLevel}
                    onChange={(e) => handleUpdate({ mineLevel: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono focus:border-amber-500 focus:outline-none"
                    placeholder="e.g. Level -450m"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                    Stope / Heading ID
                  </label>
                  <input
                    type="text"
                    value={state.stopeOrDriftId}
                    onChange={(e) => handleUpdate({ stopeOrDriftId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Excavation Type Selector */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                  Excavation Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {EXCAVATION_TYPES.map((t) => {
                    const isSelected = state.excavationType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleUpdate({ excavationType: t.id })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{t.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mining Method Selector */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                  Stoping / Mining Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {MINING_METHODS.map((m) => {
                    const isSelected = state.miningMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleUpdate({ miningMethod: m.id })}
                        className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stope Dip & Wall Angles */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Compass className="w-4 h-4" />
                  <span>Stope Wall Dips & Orebody Geometry</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400 uppercase">
                      Hangingwall (HW) Dip Angle (0°–90°)
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={state.hangingwallDipDeg}
                        onChange={(e) => handleUpdate({ hangingwallDipDeg: Number(e.target.value) })}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="font-mono text-sm font-bold w-12 text-right">
                        {state.hangingwallDipDeg}°
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400 uppercase">
                      Footwall (FW) Dip Angle (0°–90°)
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={state.footwallDipDeg}
                        onChange={(e) => handleUpdate({ footwallDipDeg: Number(e.target.value) })}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="font-mono text-sm font-bold w-12 text-right">
                        {state.footwallDipDeg}°
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GRADE CONTROL & VEINS */}
          {activeTab === 'grade_control' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/70 border border-amber-500/30 rounded-xl">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Primary Commodity</label>
                  <input
                    type="text"
                    value={state.primaryCommodity}
                    onChange={(e) => handleUpdate({ primaryCommodity: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                    placeholder="e.g. Gold (Au)"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Grade Units</label>
                  <input
                    type="text"
                    value={state.gradeUnits}
                    onChange={(e) => handleUpdate({ gradeUnits: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                    placeholder="e.g. g/t, %, ppm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Target Cut-Off Grade</label>
                  <input
                    type="text"
                    value={state.targetCutoffGrade}
                    onChange={(e) => handleUpdate({ targetCutoffGrade: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-amber-400"
                    placeholder="e.g. 2.5"
                  />
                </div>
              </div>

              {/* Mineralized Veins Tracing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-mono uppercase font-bold text-slate-200">
                      Mineralized Veins & Ore Lodes
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVein}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Vein</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {state.veins.map((vein, index) => {
                    const zoneStyle = ORE_ZONE_COLORS[vein.oreZone] || ORE_ZONE_COLORS.MEDIUM_GRADE_ORE;
                    return (
                      <div
                        key={vein.id}
                        className={`p-3 rounded-xl border bg-slate-950/80 ${zoneStyle.border} space-y-2`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-400">
                              #{index + 1}
                            </span>
                            <input
                              type="text"
                              value={vein.name}
                              onChange={(e) => {
                                const nextVeins = [...state.veins];
                                nextVeins[index].name = e.target.value;
                                handleUpdate({ veins: nextVeins });
                              }}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-bold text-slate-100"
                            />
                            <select
                              value={vein.oreZone}
                              onChange={(e) => {
                                const nextVeins = [...state.veins];
                                nextVeins[index].oreZone = e.target.value as OreZoneCategory;
                                handleUpdate({ veins: nextVeins });
                              }}
                              className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                            >
                              {Object.entries(ORE_ZONE_COLORS).map(([key, val]) => (
                                <option key={key} value={key}>
                                  {val.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveVein(vein.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-400">Strike / Dip:</span>
                            <span className="ml-1 font-bold">
                              {vein.strikeDeg}° / {vein.dipDeg}°
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">True Thk:</span>
                            <span className="ml-1 font-bold text-teal-400">
                              {vein.trueThicknessMeters} m
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Est. Grade:</span>
                            <span className="ml-1 font-bold text-amber-400">
                              {vein.estimatedGrade}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Dip Dir:</span>
                            <span className="ml-1 font-bold">
                              {vein.dipDirectionDeg}°
                            </span>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={vein.mineralogyNotes}
                          onChange={(e) => {
                            const nextVeins = [...state.veins];
                            nextVeins[index].mineralogyNotes = e.target.value;
                            handleUpdate({ veins: nextVeins });
                          }}
                          placeholder="Mineralogy & texture notes (e.g. pyrite, chalcopyrite, quartz stringers)"
                          className="w-full px-2 py-1 bg-slate-900/60 border border-slate-800 rounded text-[11px] font-mono text-slate-300"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Face Channel Samples */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-teal-400" />
                    <h3 className="text-xs font-mono uppercase font-bold text-slate-200">
                      Face Channel Assay Samples
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChannelSample}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-teal-600 hover:bg-teal-500 text-white rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Sample</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Sample ID</th>
                        <th className="p-2">Interval (m)</th>
                        <th className="p-2">Length (m)</th>
                        <th className="p-2">Lithology / Unit</th>
                        <th className="p-2">Assay Grade</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                      {state.channelSamples.map((sample, idx) => (
                        <tr key={sample.id}>
                          <td className="p-2 font-bold text-amber-400">{sample.sampleNumber}</td>
                          <td className="p-2">
                            {sample.fromMeter.toFixed(2)} – {sample.toMeter.toFixed(2)}
                          </td>
                          <td className="p-2">{sample.sampleLengthMeters.toFixed(2)}</td>
                          <td className="p-2">{sample.lithologyOrVein}</td>
                          <td className="p-2 font-bold text-emerald-400">{sample.gradeValue}</td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveChannelSample(sample.id)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAUBSCHER MRMR */}
          {activeTab === 'laubscher_mrmr' && (
            <div className="space-y-6">
              {/* Score Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-950/60 to-slate-950 border border-amber-500/40 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-400">
                    Mining Rock Mass Rating (Laubscher 1990)
                  </span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    MRMR = <span className="text-amber-400">{liveMrmr.totalMrmr}</span> / 100
                  </div>
                  <div className="text-xs text-slate-300 mt-1">{liveMrmr.rockClassDescription}</div>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold">
                    {liveMrmr.rockClass.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Sliders for Adjustment Factors */}
              <div className="space-y-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Base RMR (Bieniawski 1989):</span>
                    <span className="font-bold text-amber-400">{liveMrmr.baseRmr}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={liveMrmr.baseRmr}
                    onChange={(e) => {
                      const baseRmr = Number(e.target.value);
                      handleUpdate({ mrmr: calculateLaubscherMrmr({ ...state.mrmr, baseRmr }) });
                    }}
                    className="w-full mt-1 accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Weathering Factor (Rw):</span>
                    <span className="font-bold text-teal-400">
                      {(liveMrmr.weatheringFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="100"
                    value={Math.round(liveMrmr.weatheringFactor * 100)}
                    onChange={(e) => {
                      const weatheringFactor = Number(e.target.value) / 100;
                      handleUpdate({ mrmr: calculateLaubscherMrmr({ ...state.mrmr, weatheringFactor }) });
                    }}
                    className="w-full mt-1 accent-teal-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">
                    100% = Completely fresh rock; 70% = Moderately to highly weathered stope walls
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Joint Orientation vs Stope Face (Rj):</span>
                    <span className="font-bold text-teal-400">
                      {(liveMrmr.jointOrientationFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="100"
                    value={Math.round(liveMrmr.jointOrientationFactor * 100)}
                    onChange={(e) => {
                      const jointOrientationFactor = Number(e.target.value) / 100;
                      handleUpdate({ mrmr: calculateLaubscherMrmr({ ...state.mrmr, jointOrientationFactor }) });
                    }}
                    className="w-full mt-1 accent-teal-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Mining Induced Stress Factor (Rs):</span>
                    <span className="font-bold text-teal-400">
                      {(liveMrmr.miningInducedStressFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="125"
                    value={Math.round(liveMrmr.miningInducedStressFactor * 100)}
                    onChange={(e) => {
                      const miningInducedStressFactor = Number(e.target.value) / 100;
                      handleUpdate({ mrmr: calculateLaubscherMrmr({ ...state.mrmr, miningInducedStressFactor }) });
                    }}
                    className="w-full mt-1 accent-teal-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">
                    &lt;100% = High abutment stress relaxation or bursting; &gt;100% = Favorable confining clamp
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Blasting Damage Factor (Rb):</span>
                    <span className="font-bold text-teal-400">
                      {(liveMrmr.blastingDamageFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="100"
                    value={Math.round(liveMrmr.blastingDamageFactor * 100)}
                    onChange={(e) => {
                      const blastingDamageFactor = Number(e.target.value) / 100;
                      handleUpdate({ mrmr: calculateLaubscherMrmr({ ...state.mrmr, blastingDamageFactor }) });
                    }}
                    className="w-full mt-1 accent-teal-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">
                    100% = Smooth wall / pre-split; 80% = Heavy production blasting vibration damage
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MATHEWS-POTVIN STABILITY GRAPH */}
          {activeTab === 'mathews_graph' && (
            <div className="space-y-6">
              {/* Output Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Modified Barton Q&apos;</span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                    {liveMathews.modifiedQPrime}
                  </div>
                  <span className="text-[9px] text-slate-500">(RQD/Jn) × (Jr/Ja)</span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Factors (A × B × C)</span>
                  <div className="text-lg font-bold font-mono text-teal-400 mt-1">
                    {liveMathews.stressFactorA} × {liveMathews.jointOrientationFactorB} × {liveMathews.gravityFactorC}
                  </div>
                  <span className="text-[9px] text-slate-500">Stress · Joint · Gravity</span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Hydraulic Radius (HR)</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    {liveMathews.hydraulicRadiusMeters} m
                  </div>
                  <span className="text-[9px] text-slate-500">Area / Perimeter</span>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    liveMathews.stabilityZone === 'STABLE'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : liveMathews.stabilityZone === 'TRANSITION'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                      : 'bg-rose-950/60 border-rose-500 text-rose-300'
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase font-bold">Stope Stability</span>
                  <div className="text-sm font-bold font-mono mt-1">
                    {liveMathews.stabilityZone.replace('_', ' ')}
                  </div>
                  <span className="text-[9px]">
                    {liveMathews.stabilityZone === 'STABLE'
                      ? 'Stable Span'
                      : liveMathews.stabilityZone === 'TRANSITION'
                      ? 'Cable bolting required'
                      : 'Caving prone'}
                  </span>
                </div>
              </div>

              {/* Mathews Graph Canvas Visualizer */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-amber-400">Mathews-Potvin Open Stope Stability Graph</span>
                  <span className="text-slate-400">
                    Point (HR={liveMathews.hydraulicRadiusMeters}, N&apos;={liveMathews.modifiedStabilityNumberNPrime})
                  </span>
                </div>

                <div className="relative w-full h-56 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 500 220" preserveAspectRatio="none">
                    {/* Background Zones */}
                    {/* Caved zone */}
                    <path d="M 40,200 L 480,200 L 480,160 C 350,175 200,188 40,200 Z" fill="#EF4444" fillOpacity="0.2" />
                    {/* Transition zone */}
                    <path d="M 40,200 L 480,160 L 480,90 C 320,110 180,140 40,200 Z" fill="#F59E0B" fillOpacity="0.25" />
                    {/* Stable zone */}
                    <path d="M 40,20 L 480,20 L 480,90 C 320,110 180,140 40,200 L 40,20 Z" fill="#10B981" fillOpacity="0.2" />

                    {/* Boundary Lines */}
                    <path d="M 40,200 C 180,140 320,110 480,90" stroke="#10B981" strokeWidth="2.5" fill="none" />
                    <path d="M 40,200 C 200,188 350,175 480,160" stroke="#EF4444" strokeWidth="2.5" fill="none" />

                    {/* Axes */}
                    <line x1="40" y1="20" x2="40" y2="200" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="40" y1="200" x2="480" y2="200" stroke="#64748B" strokeWidth="1.5" />

                    {/* Zone Labels */}
                    <text x="250" y="55" fill="#34D399" fontSize="12" fontWeight="bold" fontFamily="monospace">
                      STABLE ZONE
                    </text>
                    <text x="260" y="130" fill="#FBBF24" fontSize="11" fontWeight="bold" fontFamily="monospace">
                      TRANSITION (CABLE BOLTED)
                    </text>
                    <text x="320" y="185" fill="#F87171" fontSize="11" fontWeight="bold" fontFamily="monospace">
                      CAVED ZONE
                    </text>

                    {/* Current Point Plotted */}
                    {(() => {
                      // Map HR (0..25) to X (40..480)
                      const hrClamped = Math.max(1, Math.min(25, liveMathews.hydraulicRadiusMeters));
                      const ptX = 40 + ((hrClamped - 1) / 24) * 440;
                      // Map log10(N') (0.1..100) to Y (200..20)
                      const nClamped = Math.max(0.1, Math.min(200, liveMathews.modifiedStabilityNumberNPrime));
                      const logN = Math.log10(nClamped);
                      const normY = Math.max(0, Math.min(1, (logN - (-1)) / (2.3 - (-1))));
                      const ptY = 200 - normY * 180;

                      return (
                        <g>
                          <circle cx={ptX} cy={ptY} r="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" className="animate-pulse" />
                          <circle cx={ptX} cy={ptY} r="14" stroke="#F59E0B" strokeWidth="1" fill="none" opacity="0.6" />
                          <text x={ptX + 10} y={ptY - 8} fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="monospace">
                            Stope ({liveMathews.hydraulicRadiusMeters}m, N&apos;={liveMathews.modifiedStabilityNumberNPrime})
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs font-mono">
          <div className="text-slate-400">
            ESWA Mining Mode · Changes sync continuously with current project
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
