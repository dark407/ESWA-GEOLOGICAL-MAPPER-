import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Shield,
  Compass,
  Layers,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  Plus,
  Download,
  Printer,
  Calendar,
  Clock,
  MapPin,
  Eye,
  Trash2,
  X,
} from 'lucide-react';
import {
  TbmExcavationRecord,
  TbmLocationItem,
  TbmProjectItem,
  TbmGeologicalForecastRecord,
} from '../../types/tbm';
import {
  calculateBartonQ,
  calculateRmr89,
  calculateQToRmrCorrelations,
  calculateBartonGrimstadSupport,
  calculateRmrGeomechanicalProperties,
  projectPoleToEqualArea,
  generateGreatCircleSvgPath,
} from '../../engine/tbmCalculationsEngine';
import {
  loadTbmForecasts,
  saveTbmForecasts,
  createTbmForecast,
  updateTbmForecast,
} from '../../engine/tbmStorageEngine';

export interface TbmQ2RmrGeologicalAnalysisProps {
  records: TbmExcavationRecord[];
  activeLocation: TbmLocationItem | null;
  activeProject: TbmProjectItem | null;
  activeRecord: TbmExcavationRecord | null;
  onSelectRecord?: (recordId: string) => void;
}

export type GeologicalAnalysisSubTab =
  | 'q_to_rmr'
  | 'stereonet'
  | 'correlation'
  | 'longitudinal_profile'
  | 'predicted_vs_encountered'
  | 'ahead_forecast';

export const TbmQ2RmrGeologicalAnalysis: React.FC<TbmQ2RmrGeologicalAnalysisProps> = ({
  records,
  activeLocation,
  activeProject,
  activeRecord,
  onSelectRecord,
}) => {
  const [subTab, setSubTab] = useState<GeologicalAnalysisSubTab>('q_to_rmr');

  // Selected ring index for analysis
  const [selectedRingId, setSelectedRingId] = useState<string>(
    activeRecord?.id || records[0]?.id || ''
  );

  const currentRecord = useMemo(() => {
    return records.find((r) => r.id === selectedRingId) || activeRecord || records[0];
  }, [records, selectedRingId, activeRecord]);

  // Barton Q Interactive Parameters (initialized from record or defaults)
  const [customRqd, setCustomRqd] = useState<number>(
    currentRecord?.classification?.rqdPercent || 75
  );
  const [customJn, setCustomJn] = useState<number>(
    currentRecord?.classification?.jn || 6
  );
  const [customJr, setCustomJr] = useState<number>(
    currentRecord?.classification?.jr || 2.0
  );
  const [customJa, setCustomJa] = useState<number>(
    currentRecord?.classification?.ja || 1.5
  );
  const [customJw, setCustomJw] = useState<number>(
    currentRecord?.classification?.jw || 1.0
  );
  const [customSrf, setCustomSrf] = useState<number>(
    currentRecord?.classification?.srf || 1.0
  );

  // Bieniawski RMR89 Interactive Parameters
  const [customStrengthScore, setCustomStrengthScore] = useState<number>(
    currentRecord?.classification?.rmrStrengthScore || 12
  );
  const [customRqdScore, setCustomRqdScore] = useState<number>(
    currentRecord?.classification?.rmrRqdScore || 17
  );
  const [customSpacingScore, setCustomSpacingScore] = useState<number>(
    currentRecord?.classification?.rmrSpacingScore || 15
  );
  const [customConditionScore, setCustomConditionScore] = useState<number>(
    currentRecord?.classification?.rmrConditionScore || 18
  );
  const [customWaterScore, setCustomWaterScore] = useState<number>(
    currentRecord?.classification?.rmrWaterScore || 10
  );
  const [customOrientationAdjustment, setCustomOrientationAdjustment] = useState<number>(
    currentRecord?.classification?.rmrOrientationAdjustment || -2
  );

  // Stereonet custom joint inputs
  const [driveAzimuth, setDriveAzimuth] = useState<number>(45);
  const [showDaylightEnvelope, setShowDaylightEnvelope] = useState<boolean>(true);
  const [showGreatCircles, setShowGreatCircles] = useState<boolean>(true);
  const [showPoles, setShowPoles] = useState<boolean>(true);

  // Ahead-of-Face Forecast state
  const [forecasts, setForecasts] = useState<TbmGeologicalForecastRecord[]>(() =>
    loadTbmForecasts(activeProject?.id)
  );
  const [showNewForecastModal, setShowNewForecastModal] = useState<boolean>(false);
  const [selectedForecastForReview, setSelectedForecastForReview] = useState<TbmGeologicalForecastRecord | null>(null);
  const [reviewModalMatchStatus, setReviewModalMatchStatus] = useState<'CONCORDANT' | 'PARTIAL_MATCH' | 'DISCORDANT' | 'UNVERIFIED'>('CONCORDANT');
  const [reviewModalDiscrepancyNotes, setReviewModalDiscrepancyNotes] = useState<string>('');

  const [newForecastForm, setNewForecastForm] = useState<{
    revision: string;
    startChainageRd: number;
    endChainageRd: number;
    predictedLithology: string;
    predictedFormations: string;
    expectedQValue: number;
    expectedRmr: number;
    predictedFaultsAndShears: string;
    predictedWaterInflowRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    supportingEvidence: string;
    investigationLimitations: string;
    confidence: 'HIGH' | 'MODERATE' | 'LOW';
    recommendedActions: string;
    author: string;
  }>({
    revision: 'Rev A',
    startChainageRd: records[records.length - 1]?.chainageRecord.endChainage || 1432.0,
    endChainageRd: (records[records.length - 1]?.chainageRecord.endChainage || 1432.0) + 25.0,
    predictedLithology: 'Amygdaloidal Basalt with Zeolite Veins',
    predictedFormations: 'Upper Wai Formation',
    expectedQValue: 8.5,
    expectedRmr: 62,
    predictedFaultsAndShears: 'Sub-vertical cooling joints; minor shear at contact',
    predictedWaterInflowRisk: 'MODERATE',
    supportingEvidence: 'Probe PB-01 drilling parameters & GBR baseline logs',
    investigationLimitations: 'Projection based on 25m forward percussive probe',
    confidence: 'HIGH',
    recommendedActions: 'Maintain 4.2 RPM, standard EPB foam injection',
    author: activeProject?.responsibleGeologist || 'Lead TBM Geologist',
  });

  // Calculated Barton Q result
  const qResult = useMemo(() => {
    return calculateBartonQ({
      rqd: customRqd,
      jn: customJn,
      jr: customJr,
      ja: customJa,
      jw: customJw,
      srf: customSrf,
    });
  }, [customRqd, customJn, customJr, customJa, customJw, customSrf]);

  // Calculated RMR89 result
  const rmrResult = useMemo(() => {
    return calculateRmr89({
      strengthScore: customStrengthScore,
      rqdScore: customRqdScore,
      spacingScore: customSpacingScore,
      conditionScore: customConditionScore,
      waterScore: customWaterScore,
      orientationAdjustment: customOrientationAdjustment,
    });
  }, [
    customStrengthScore,
    customRqdScore,
    customSpacingScore,
    customConditionScore,
    customWaterScore,
    customOrientationAdjustment,
  ]);

  // 5 Empirical Q-to-RMR correlation models
  const correlations = useMemo(() => {
    return calculateQToRmrCorrelations(qResult.qValue, rmrResult.rmrValue);
  }, [qResult.qValue, rmrResult.rmrValue]);

  // Barton Grimstad Support Design
  const tunnelSpanM = activeLocation?.cutterheadDiameterM || 6.4;
  const grimstadSupport = useMemo(() => {
    return calculateBartonGrimstadSupport(qResult.qValue, tunnelSpanM, 1.0);
  }, [qResult.qValue, tunnelSpanM]);

  // Bieniawski geomechanical properties
  const rmrProperties = useMemo(() => {
    return calculateRmrGeomechanicalProperties(rmrResult.rmrValue);
  }, [rmrResult.rmrValue]);

  // Discontinuity Joint Sets for Stereonet
  const jointSets = useMemo(() => {
    if (currentRecord?.geology?.discontinuities && currentRecord.geology.discontinuities.length > 0) {
      return currentRecord.geology.discontinuities;
    }
    // Default geological joint sets if none logged yet
    return [
      {
        id: 'J1',
        setNumber: 1,
        type: 'JOINT' as const,
        strikeDeg: 135,
        dipDeg: 65,
        dipDirectionDeg: 45,
        spacingCm: 45,
        apertureMm: 1.5,
        roughness: 'ROUGH' as const,
        infilling: 'HARD_NON_SOFTENING' as const,
        weathering: 'SLIGHTLY_WEATHERED' as const,
        waterCondition: 'DRY' as const,
        isDirectObservation: true,
      },
      {
        id: 'J2',
        setNumber: 2,
        type: 'JOINT' as const,
        strikeDeg: 40,
        dipDeg: 72,
        dipDirectionDeg: 310,
        spacingCm: 60,
        apertureMm: 2.0,
        roughness: 'SLIGHTLY_ROUGH' as const,
        infilling: 'CALCITE_QUARTZ' as const,
        weathering: 'SLIGHTLY_WEATHERED' as const,
        waterCondition: 'DRY' as const,
        isDirectObservation: true,
      },
      {
        id: 'J3',
        setNumber: 3,
        type: 'BEDDING' as const,
        strikeDeg: 220,
        dipDeg: 25,
        dipDirectionDeg: 130,
        spacingCm: 120,
        apertureMm: 0.5,
        roughness: 'SMOOTH' as const,
        infilling: 'NONE' as const,
        weathering: 'UNWEATHERED' as const,
        waterCondition: 'DAMP' as const,
        isDirectObservation: true,
      },
    ];
  }, [currentRecord]);

  // Sync parameters when changing selected record
  const handleSelectRecord = (id: string) => {
    setSelectedRingId(id);
    if (onSelectRecord) onSelectRecord(id);
    const rec = records.find((r) => r.id === id);
    if (rec?.classification) {
      setCustomRqd(rec.classification.rqdPercent || 75);
      setCustomJn(rec.classification.jn || 6);
      setCustomJr(rec.classification.jr || 2.0);
      setCustomJa(rec.classification.ja || 1.5);
      setCustomJw(rec.classification.jw || 1.0);
      setCustomSrf(rec.classification.srf || 1.0);
      setCustomStrengthScore(rec.classification.rmrStrengthScore || 12);
      setCustomRqdScore(rec.classification.rmrRqdScore || 17);
      setCustomSpacingScore(rec.classification.rmrSpacingScore || 15);
      setCustomConditionScore(rec.classification.rmrConditionScore || 18);
      setCustomWaterScore(rec.classification.rmrWaterScore || 10);
      setCustomOrientationAdjustment(rec.classification.rmrOrientationAdjustment || -2);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner & Sub-Tabs Switcher */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <h2 className="text-base font-bold text-cyan-300 font-mono tracking-wide uppercase">
              STEP 5 — ADVANCED GEOLOGICAL ANALYSIS &amp; Q-TO-RMR ROCK MECHANICS
            </h2>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Full empirical Barton Q, Bieniawski RMR89, 5-model Q↔RMR correlation suite, 3D equal-area stereonet kinematics, and TBM FPI response.
          </p>
        </div>

        {/* Ring Selector Pill */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">Analyzing Ring:</span>
          <select
            value={selectedRingId}
            onChange={(e) => handleSelectRecord(e.target.value)}
            className="bg-slate-900 border border-cyan-500/50 text-cyan-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                Ring #{r.chainageRecord.ringNumber} (RD {r.chainageRecord.startChainage.toFixed(1)}m · {r.geology.mainLithology})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 Prominent Geological Analysis Sub-Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs font-bold">
        {[
          {
            id: 'q_to_rmr' as const,
            label: '1. Q ↔ RMR Correlation',
            icon: Shield,
          },
          {
            id: 'stereonet' as const,
            label: '2. 3D Stereonet',
            icon: Compass,
          },
          {
            id: 'correlation' as const,
            label: '3. FPI & Specific Energy',
            icon: Activity,
          },
          {
            id: 'longitudinal_profile' as const,
            label: '4. Longitudinal Profile',
            icon: Layers,
          },
          {
            id: 'predicted_vs_encountered' as const,
            label: '5. Predicted vs Encountered',
            icon: CheckCircle2,
          },
          {
            id: 'ahead_forecast' as const,
            label: '6. Ahead-of-Face Forecast',
            icon: TrendingUp,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isAct = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg transition-all cursor-pointer truncate ${
                isAct
                  ? 'bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          SUB-TAB 1: DEEP Q TO RMR ROCK MECHANICS ENGINE (LIKE OUR NATM!)
          ===================================================================== */}
      {subTab === 'q_to_rmr' && (
        <div className="space-y-4">
          {/* Top Quick Status Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Barton Q Index</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400">
                  {qResult.qValue < 0.1 ? qResult.qValue.toFixed(3) : qResult.qValue.toFixed(2)}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${qResult.badgeColor}`}>
                  {qResult.qClass}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                RQD/Jn={((customRqd / customJn)).toFixed(1)} · Jr/Ja={((customJr / customJa)).toFixed(2)} · Jw/SRF={((customJw / customSrf)).toFixed(2)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Bieniawski RMR89</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">
                  {rmrResult.rmrValue}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${rmrResult.badgeColor}`}>
                  {rmrResult.rmrClass}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                GSI={rmrProperties.gsiScore} · Cohesion={rmrProperties.cohesionKpa}kPa · φ={rmrProperties.frictionAngleDeg}°
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Q ↔ RMR Correlation Spread</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {correlations.averageRmr} <span className="text-xs text-slate-400 font-normal">avg</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  {correlations.confidenceScorePercent}% CONFIDENCE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Span: {correlations.minRmr} to {correlations.maxRmr} (Δ {correlations.rangeDelta} pts) across 5 empirical models
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Rock Mass Stand-Up Time</span>
              <div className="text-sm font-black text-slate-100 font-mono">
                {rmrProperties.standUpTime}
              </div>
              <p className="text-[10px] text-cyan-300">
                Max Unsupported Span: {rmrProperties.maxUnsupportedSpanM} m
              </p>
              <p className="text-[9px] text-slate-500">
                Deformation Modulus Em = {rmrProperties.deformationModulusEmGpa} GPa
              </p>
            </div>
          </div>

          {/* Dual Interactive Parameter Tuning Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Barton Q-System 6-Parameter Interactive Board */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs text-cyan-300 uppercase">
                    BARTON Q-SYSTEM PARAMETERS (Q = [RQD/Jn] × [Jr/Ja] × [Jw/SRF])
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold">
                  Q = {qResult.qValue < 0.1 ? qResult.qValue.toFixed(3) : qResult.qValue.toFixed(2)}
                </span>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {/* RQD */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>RQD (Rock Quality):</span>
                    <strong className="text-cyan-400">{customRqd}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={customRqd}
                    onChange={(e) => setCustomRqd(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">10=Crushed, 100=Massive</span>
                </div>

                {/* Jn */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Jn (Joint Set No.):</span>
                    <strong className="text-cyan-400">{customJn}</strong>
                  </div>
                  <select
                    value={customJn}
                    onChange={(e) => setCustomJn(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    <option value="0.5">0.5 — Massive, no or few joints</option>
                    <option value="2">2 — One joint set</option>
                    <option value="3">3 — One joint set plus random</option>
                    <option value="4">4 — Two joint sets</option>
                    <option value="6">6 — Two joint sets plus random</option>
                    <option value="9">9 — Three joint sets</option>
                    <option value="12">12 — Three joint sets plus random</option>
                    <option value="15">15 — Four or more joint sets</option>
                    <option value="20">20 — Crushed rock, earth-like</option>
                  </select>
                </div>

                {/* Jr */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Jr (Joint Roughness):</span>
                    <strong className="text-cyan-400">{customJr}</strong>
                  </div>
                  <select
                    value={customJr}
                    onChange={(e) => setCustomJr(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    <option value="4">4.0 — Discontinuous joints</option>
                    <option value="3">3.0 — Rough or irregular, undulating</option>
                    <option value="2">2.0 — Smooth, undulating</option>
                    <option value="1.5">1.5 — Slickensided, undulating</option>
                    <option value="1.5">1.5 — Rough or irregular, planar</option>
                    <option value="1.0">1.0 — Smooth, planar</option>
                    <option value="0.5">0.5 — Slickensided, planar</option>
                  </select>
                </div>

                {/* Ja */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Ja (Joint Alteration):</span>
                    <strong className="text-cyan-400">{customJa}</strong>
                  </div>
                  <select
                    value={customJa}
                    onChange={(e) => setCustomJa(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    <option value="0.75">0.75 — Tightly healed, hard, non-softening</option>
                    <option value="1.0">1.0 — Unaltered joint walls, surface staining only</option>
                    <option value="2.0">2.0 — Slightly altered joint walls, non-softening</option>
                    <option value="3.0">3.0 — Silty- or sandy-clay coatings</option>
                    <option value="4.0">4.0 — Softening or low-friction clay coatings</option>
                    <option value="6.0">6.0 — Thick continuous zone of clay gouge</option>
                    <option value="8.0">8.0 — Thick continuous swelling clay</option>
                  </select>
                </div>

                {/* Jw */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Jw (Water Reduction):</span>
                    <strong className="text-cyan-400">{customJw}</strong>
                  </div>
                  <select
                    value={customJw}
                    onChange={(e) => setCustomJw(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    <option value="1.0">1.0 — Dry excavations or minor inflow (&lt;5 L/min)</option>
                    <option value="0.66">0.66 — Medium inflow or pressure, occasional outwash</option>
                    <option value="0.5">0.5 — Large inflow or high pressure in competent rock</option>
                    <option value="0.33">0.33 — Large inflow or high pressure, outwash of fillings</option>
                    <option value="0.1">0.1 — Exceptionally high inflow/pressure decaying with time</option>
                    <option value="0.05">0.05 — Exceptionally high inflow/pressure continuing without decay</option>
                  </select>
                </div>

                {/* SRF */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>SRF (Stress Reduction):</span>
                    <strong className="text-cyan-400">{customSrf}</strong>
                  </div>
                  <select
                    value={customSrf}
                    onChange={(e) => setCustomSrf(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    <option value="1.0">1.0 — Medium stress, favorable depth (σc/σ1 &gt; 10)</option>
                    <option value="2.5">2.5 — Single weakness zone containing clay or chemically disintegrated rock</option>
                    <option value="5.0">5.0 — Multiple weakness zones, competent rock</option>
                    <option value="7.5">7.5 — Multiple shear zones in clayey rock / squeezing</option>
                    <option value="10.0">10.0 — Heavy rockburst condition (massive rock, high stress)</option>
                    <option value="15.0">15.0 — Heavy squeezing ground pressure</option>
                  </select>
                </div>
              </div>

              {/* Barton Grimstad Support Specification Box */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-800/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-300">Grimstad &amp; Barton (2014) Support Class:</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-700">
                    Category {grimstadSupport.categoryNum}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100">{grimstadSupport.categoryName}</p>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-500 block">Bolt Length (L):</span>
                    <strong className="text-amber-300">{grimstadSupport.boltLengthM} m</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bolt Spacing:</span>
                    <strong className="text-amber-300">
                      {grimstadSupport.boltSpacingM > 0 ? `@ ${grimstadSupport.boltSpacingM}m c/c` : 'Spot only'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Shotcrete (SFRS):</span>
                    <strong className="text-amber-300">
                      {grimstadSupport.fiberShotcreteThicknessMm > 0 ? `${grimstadSupport.fiberShotcreteThicknessMm} mm` : 'None required'}
                    </strong>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">{grimstadSupport.description}</p>
              </div>
            </div>

            {/* Bieniawski RMR89 6-Parameter Interactive Board */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs text-amber-300 uppercase">
                    BIENIAWSKI RMR89 PARAMETERS (RMR = A1+A2+A3+A4+A5+B)
                  </span>
                </div>
                <span className="text-[10px] text-amber-400 font-bold">
                  Total RMR = {rmrResult.rmrValue}
                </span>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {/* A1: UCS Strength */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>A1. UCS Strength:</span>
                    <strong className="text-amber-400">{customStrengthScore} pts</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={customStrengthScore}
                    onChange={(e) => setCustomStrengthScore(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    {customStrengthScore >= 12 ? '> 100 MPa (Very Strong)' : customStrengthScore >= 7 ? '50-100 MPa (Strong)' : '< 25 MPa (Weak)'}
                  </span>
                </div>

                {/* A2: RQD Score */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>A2. RQD Score:</span>
                    <strong className="text-amber-400">{customRqdScore} pts</strong>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="1"
                    value={customRqdScore}
                    onChange={(e) => setCustomRqdScore(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    {customRqdScore >= 17 ? 'RQD 75-90% (Good)' : customRqdScore >= 13 ? 'RQD 50-75% (Fair)' : 'RQD < 50% (Poor)'}
                  </span>
                </div>

                {/* A3: Joint Spacing */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>A3. Spacing of Joints:</span>
                    <strong className="text-amber-400">{customSpacingScore} pts</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="1"
                    value={customSpacingScore}
                    onChange={(e) => setCustomSpacingScore(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    {customSpacingScore >= 15 ? '0.6 - 2.0 m (Wide)' : customSpacingScore >= 10 ? '0.2 - 0.6 m (Moderate)' : '< 0.06 m (Very Close)'}
                  </span>
                </div>

                {/* A4: Joint Condition */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>A4. Joint Condition:</span>
                    <strong className="text-amber-400">{customConditionScore} pts</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={customConditionScore}
                    onChange={(e) => setCustomConditionScore(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    {customConditionScore >= 25 ? 'Rough, unweathered, tight' : customConditionScore >= 12 ? 'Slightly rough, 1mm opening' : 'Gouge > 5mm or slickensided'}
                  </span>
                </div>

                {/* A5: Groundwater */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>A5. Groundwater:</span>
                    <strong className="text-amber-400">{customWaterScore} pts</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={customWaterScore}
                    onChange={(e) => setCustomWaterScore(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-500 block">
                    {customWaterScore === 15 ? 'Completely Dry' : customWaterScore >= 10 ? 'Damp / Minor Inflow' : customWaterScore >= 4 ? 'Wet / Dripping' : 'Flowing water'}
                  </span>
                </div>

                {/* B: Orientation Adjustment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>B. Discontinuity Orientation:</span>
                    <strong className="text-rose-400">{customOrientationAdjustment} pts</strong>
                  </div>
                  <select
                    value={customOrientationAdjustment}
                    onChange={(e) => setCustomOrientationAdjustment(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-300 cursor-pointer"
                  >
                    <option value="0">0 — Very Favorable (Drive with dip 45-90°)</option>
                    <option value="-2">-2 — Favorable (Drive with dip 20-45°)</option>
                    <option value="-5">-5 — Fair (Strike parallel to axis, dip 45-90°)</option>
                    <option value="-10">-10 — Unfavorable (Drive against dip 20-45°)</option>
                    <option value="-12">-12 — Very Unfavorable (Strike parallel, dip 20-45°)</option>
                  </select>
                </div>
              </div>

              {/* RMR Geomechanical Derivation Box */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-800/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300">Rock Mass Mohr-Coulomb &amp; Modulus:</span>
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 font-bold border border-amber-700">
                    {rmrProperties.rockClass}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-500 block">Cohesion (c):</span>
                    <strong className="text-cyan-400">{rmrProperties.cohesionKpa} kPa</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Friction Angle (φ):</span>
                    <strong className="text-cyan-400">{rmrProperties.frictionAngleDeg}°</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Modulus (Em):</span>
                    <strong className="text-cyan-400">{rmrProperties.deformationModulusEmGpa} GPa</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">GSI Rating:</span>
                    <strong className="text-cyan-400">{rmrProperties.gsiScore}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5 EMPIRICAL Q ↔ RMR CORRELATION MODELS COMPARISON MATRIX */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs text-emerald-300 uppercase">
                  5 PUBLISHED EMPIRICAL Q ↔ RMR CORRELATION MODELS (REAL SCIENTIFIC VALIDATION)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">
                Current Input Q: <strong className="text-cyan-400">{qResult.qValue.toFixed(2)}</strong> | Actual RMR: <strong className="text-amber-400">{rmrResult.rmrValue}</strong>
              </span>
            </div>

            {/* Model Comparison Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Author &amp; Reference</th>
                    <th className="p-2.5">Empirical Formula</th>
                    <th className="p-2.5">Dataset Ground Type</th>
                    <th className="p-2.5">Predicted RMR</th>
                    <th className="p-2.5">Variance vs Actual RMR ({rmrResult.rmrValue})</th>
                    <th className="p-2.5">Correlation Fit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-300">Bieniawski (1976)</td>
                    <td className="p-2.5 text-slate-400">RMR = 9 · ln(Q) + 44</td>
                    <td className="p-2.5 text-slate-400">South African granites, quartzites, coals</td>
                    <td className="p-2.5 font-bold text-emerald-400">{correlations.bieniawski1976}</td>
                    <td className="p-2.5">
                      <span className={Math.abs(correlations.bieniawski1976 - rmrResult.rmrValue) <= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {correlations.bieniawski1976 - rmrResult.rmrValue >= 0 ? '+' : ''}{correlations.bieniawski1976 - rmrResult.rmrValue} pts
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        PRIMARY STANDARD
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-300">Rutledge &amp; Preston (1978)</td>
                    <td className="p-2.5 text-slate-400">RMR = 5.9 · ln(Q) + 43</td>
                    <td className="p-2.5 text-slate-400">New Zealand greywackes &amp; schists</td>
                    <td className="p-2.5 font-bold text-emerald-400">{correlations.rutledgePreston1978}</td>
                    <td className="p-2.5">
                      <span className={Math.abs(correlations.rutledgePreston1978 - rmrResult.rmrValue) <= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {correlations.rutledgePreston1978 - rmrResult.rmrValue >= 0 ? '+' : ''}{correlations.rutledgePreston1978 - rmrResult.rmrValue} pts
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        CONSERVATIVE FIT
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-300">Barton (1995)</td>
                    <td className="p-2.5 text-slate-400">RMR = 15 · log10(Q) + 50</td>
                    <td className="p-2.5 text-slate-400">Scandinavian hard rocks, civil caverns</td>
                    <td className="p-2.5 font-bold text-emerald-400">{correlations.barton1995}</td>
                    <td className="p-2.5">
                      <span className={Math.abs(correlations.barton1995 - rmrResult.rmrValue) <= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {correlations.barton1995 - rmrResult.rmrValue >= 0 ? '+' : ''}{correlations.barton1995 - rmrResult.rmrValue} pts
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        HARD ROCK TUNNELING
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-300">Abad et al. (1983)</td>
                    <td className="p-2.5 text-slate-400">RMR = 10.5 · ln(Q) + 42</td>
                    <td className="p-2.5 text-slate-400">Spanish coal basins &amp; sedimentary strata</td>
                    <td className="p-2.5 font-bold text-emerald-400">{correlations.abad1983}</td>
                    <td className="p-2.5">
                      <span className={Math.abs(correlations.abad1983 - rmrResult.rmrValue) <= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {correlations.abad1983 - rmrResult.rmrValue >= 0 ? '+' : ''}{correlations.abad1983 - rmrResult.rmrValue} pts
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        SEDIMENTARY STRATA
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-cyan-300">Cameron-Clarke &amp; Budavari (1981)</td>
                    <td className="p-2.5 text-slate-400">RMR = 5 · ln(Q) + 60.8</td>
                    <td className="p-2.5 text-slate-400">Altered volcanic complexes &amp; dykes</td>
                    <td className="p-2.5 font-bold text-emerald-400">{correlations.cameronClarke1981}</td>
                    <td className="p-2.5">
                      <span className={Math.abs(correlations.cameronClarke1981 - rmrResult.rmrValue) <= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {correlations.cameronClarke1981 - rmrResult.rmrValue >= 0 ? '+' : ''}{correlations.cameronClarke1981 - rmrResult.rmrValue} pts
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        VOLCANIC DECCAN
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Inverted Calculation & Engineering Verdict */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Reverse Conversion (RMR → Q):</span>
                <p className="text-xs text-slate-200">
                  Given current field RMR = <strong className="text-amber-400">{rmrResult.rmrValue}</strong>:
                </p>
                <div className="flex gap-4 text-xs font-bold pt-1">
                  <span>Via Bieniawski: <strong className="text-cyan-400">Q = {correlations.qEquivFromRmrBieniawski}</strong></span>
                  <span>Via Barton: <strong className="text-cyan-400">Q = {correlations.qEquivFromRmrBarton}</strong></span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Engineering Baseline Recommendation:</span>
                <p className="text-xs text-emerald-300 font-bold">
                  Recommended Design RMR = {correlations.recommendedDesignRmr} (Conservative lower envelope)
                </p>
                <p className="text-[10px] text-slate-400">
                  Dual validation confirms ground stability class consistency with minimal contract variation exposure.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: 3D EQUAL-AREA STEREONET & DISCONTINUITY KINEMATICS
          ===================================================================== */}
      {subTab === 'stereonet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
          {/* Left Column: Interactive Schmidt Net Canvas */}
          <div className="lg:col-span-6 bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs text-cyan-300 uppercase">
                  SCHMIDT EQUAL-AREA LOWER-HEMISPHERE STEREONET
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showGreatCircles}
                    onChange={(e) => setShowGreatCircles(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Circles</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showPoles}
                    onChange={(e) => setShowPoles(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Poles</span>
                </label>
              </div>
            </div>

            {/* SVG Stereonet */}
            <div className="relative w-full aspect-square max-w-[360px] mx-auto bg-slate-950 rounded-2xl border border-slate-800 p-2 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Primitive Circle */}
                <circle cx="100" cy="100" r="80" fill="#0B132B" stroke="#38BDF8" strokeWidth="1.5" />

                {/* Cardinal Axes */}
                <line x1="100" y1="15" x2="100" y2="185" stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
                <line x1="15" y1="100" x2="185" y2="100" stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />

                {/* Inner Concentric Pitch Circles (30°, 60°) */}
                <circle cx="100" cy="100" r="56.5" fill="none" stroke="#1E293B" strokeWidth="0.8" />
                <circle cx="100" cy="100" r="29.3" fill="none" stroke="#1E293B" strokeWidth="0.8" />

                {/* Cardinal Direction Labels */}
                <text x="100" y="12" fill="#38BDF8" fontSize="8" fontWeight="bold" textAnchor="middle">N (0°)</text>
                <text x="100" y="196" fill="#64748B" fontSize="7" textAnchor="middle">S (180°)</text>
                <text x="194" y="103" fill="#64748B" fontSize="7" textAnchor="middle">E (90°)</text>
                <text x="7" y="103" fill="#64748B" fontSize="7" textAnchor="middle">W (270°)</text>

                {/* Tunnel Axis Vector */}
                {(() => {
                  const rad = (driveAzimuth * Math.PI) / 180;
                  const xT = 100 + 80 * Math.sin(rad);
                  const yT = 100 - 80 * Math.cos(rad);
                  return (
                    <g>
                      <line x1="100" y1="100" x2={xT} y2={yT} stroke="#F59E0B" strokeWidth="2" strokeDasharray="4,2" />
                      <circle cx={xT} cy={yT} r="3" fill="#F59E0B" />
                      <text x={xT + (rad > Math.PI ? -15 : 10)} y={yT} fill="#F59E0B" fontSize="7" fontWeight="bold">
                        DRIVE {driveAzimuth}°
                      </text>
                    </g>
                  );
                })()}

                {/* Joint Great Circles & Poles */}
                {jointSets.map((j, idx) => {
                  const colors = ['#22D3EE', '#F43F5E', '#10B981', '#A855F7'];
                  const color = colors[idx % colors.length];
                  const gcPath = generateGreatCircleSvgPath(j.dipDeg, j.dipDirectionDeg, 100, 80);
                  const pole = projectPoleToEqualArea(j.dipDeg, j.dipDirectionDeg);
                  const poleX = 100 + pole.x * 80;
                  const poleY = 100 + pole.y * 80;

                  return (
                    <g key={j.id || idx}>
                      {showGreatCircles && gcPath && (
                        <path d={gcPath} fill="none" stroke={color} strokeWidth="1.5" opacity="0.85" />
                      )}
                      {showPoles && (
                        <g>
                          <circle cx={poleX} cy={poleY} r="3.5" fill={color} stroke="#020617" strokeWidth="1" />
                          <text x={poleX + 5} y={poleY - 3} fill={color} fontSize="7" fontWeight="bold">
                            P{idx + 1} ({j.dipDeg}°/{j.dipDirectionDeg}°)
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Drive Azimuth Slider */}
            <div className="flex items-center justify-between gap-3 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400">Tunnel Drive Azimuth:</span>
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={driveAzimuth}
                  onChange={(e) => setDriveAzimuth(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <strong className="text-amber-400 min-w-[36px] text-right">{driveAzimuth}°</strong>
              </div>
            </div>
          </div>

          {/* Right Column: Joint Sets Table & Kinematic Stability Check */}
          <div className="lg:col-span-6 space-y-3">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs text-cyan-300 uppercase">
                  ACTIVE STRUCTURAL JOINT SETS (ORIENTATION &amp; CONDITION)
                </span>
                <span className="text-[10px] text-slate-400">{jointSets.length} Sets Logged</span>
              </div>

              <div className="space-y-2">
                {jointSets.map((j, idx) => {
                  const colors = ['border-cyan-500/60', 'border-rose-500/60', 'border-emerald-500/60', 'border-purple-500/60'];
                  const border = colors[idx % colors.length];
                  return (
                    <div key={j.id || idx} className={`p-2.5 rounded-xl bg-slate-950 border ${border} space-y-1`}>
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-slate-100">
                          Joint Set #{j.setNumber || idx + 1} ({j.type})
                        </strong>
                        <span className="font-bold text-cyan-300">
                          Dip {j.dipDeg}° → Dir {j.dipDirectionDeg}°
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                        <span>Spacing: {j.spacingCm} cm</span>
                        <span>Aperture: {j.apertureMm} mm</span>
                        <span>Roughness: {j.roughness}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kinematic Instability Assessment */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="font-bold text-xs text-amber-300 uppercase flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>KINEMATIC FAILURE MODE VERDICT (AGAINST TUNNEL DRIVE)</span>
              </span>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400">Planar Slide</span>
                  <p className="font-bold text-emerald-400">LOW RISK</p>
                  <span className="text-[9px] text-slate-500">Dip dir oblique to drive</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-800/60 space-y-1">
                  <span className="text-[10px] text-slate-400">Wedge Sliding (J1 ^ J2)</span>
                  <p className="font-bold text-amber-400">MODERATE</p>
                  <span className="text-[9px] text-slate-500">Line of plunge 48° into crown</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400">Flexural Toppling</span>
                  <p className="font-bold text-emerald-400">UNLIKELY</p>
                  <span className="text-[9px] text-slate-500">Steep bedding absent</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: FPI & SPECIFIC ENERGY CORRELATION
          ===================================================================== */}
      {subTab === 'correlation' && (
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>TBM FIELD PENETRATION INDEX (FPI) VS. ROCK MASS QUALITY (Q &amp; RMR)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Correlates machine cutter load efficiency [kN/cutter/mm] against in-situ geological classifications across all excavated rings.
              </p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded bg-slate-950 text-cyan-400 border border-slate-800 font-bold">
              BARTON QTBM CORRELATION MODEL
            </span>
          </div>

          {/* Scatter Plot Simulation Strip */}
          <div className="w-full h-56 bg-slate-950 rounded-xl border border-slate-800 p-3 relative">
            <svg viewBox="0 0 700 180" className="w-full h-full">
              {/* Axes */}
              <line x1="50" y1="20" x2="50" y2="150" stroke="#475569" strokeWidth="1" />
              <line x1="50" y1="150" x2="680" y2="150" stroke="#475569" strokeWidth="1" />

              {/* Grid Lines */}
              <line x1="50" y1="110" x2="680" y2="110" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="3,3" />
              <line x1="50" y1="70" x2="680" y2="70" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="3,3" />
              <line x1="50" y1="30" x2="680" y2="30" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="3,3" />

              {/* Axis Labels */}
              <text x="20" y="30" fill="#94A3B8" fontSize="8" textAnchor="middle">45</text>
              <text x="20" y="70" fill="#94A3B8" fontSize="8" textAnchor="middle">30</text>
              <text x="20" y="110" fill="#94A3B8" fontSize="8" textAnchor="middle">15</text>
              <text x="20" y="150" fill="#94A3B8" fontSize="8" textAnchor="middle">0</text>
              <text x="35" y="90" fill="#38BDF8" fontSize="8" fontWeight="bold" transform="rotate(-90 35,90)" textAnchor="middle">
                FPI (kN/cutter/mm)
              </text>

              <text x="50" y="165" fill="#94A3B8" fontSize="8" textAnchor="middle">Ring 841</text>
              <text x="660" y="165" fill="#94A3B8" fontSize="8" textAnchor="middle">Ring 848</text>
              <text x="360" y="175" fill="#38BDF8" fontSize="8" fontWeight="bold" textAnchor="middle">
                Excavation Ring Sequence
              </text>

              {/* Plot points for records */}
              {records.map((r, i) => {
                const x = 70 + (i / Math.max(1, records.length - 1)) * 580;
                const fpi = r.classification.fieldPenetrationIndexKnCutterMm || 25;
                const y = 150 - (fpi / 45) * 120;
                const isSelected = r.id === selectedRingId;

                return (
                  <g key={r.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? '#F59E0B' : '#06B6D4'}
                      stroke="#FFFFFF"
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer hover:r-6"
                      onClick={() => handleSelectRecord(r.id)}
                    />
                    <text x={x} y={y - 8} fill="#94A3B8" fontSize="7" textAnchor="middle">
                      {fpi.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400">Mean Penetration Rate (PR):</span>
              <p className="text-lg font-bold text-cyan-400">2.85 m/hr</p>
              <span className="text-[9px] text-slate-500">At 4.5 RPM, 4.2 mm/rev</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400">Specific Energy (SE):</span>
              <p className="text-lg font-bold text-amber-400">22.4 MJ/m³</p>
              <span className="text-[9px] text-slate-500">Normal cutting regime in Basalt</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400">Cutter Wear Life Forecast:</span>
              <p className="text-lg font-bold text-emerald-400">185 m / cutter</p>
              <span className="text-[9px] text-slate-500">Based on CAI = 1.8 (Medium Abrasivity)</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: LONGITUDINAL PROFILE
      {/* =====================================================================
          SUB-TAB 4: LONGITUDINAL GEOTECHNICAL PROFILE & AS-BUILT STRATIGRAPHY
          ===================================================================== */}
      {subTab === 'longitudinal_profile' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>LONGITUDINAL CHAINAGE PROFILE (RD {activeLocation?.startChainageRd.toFixed(2)}m – {activeLocation?.endChainageRd?.toFixed(2) || '1550.00'}m)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Continuous chainage alignment with geological lithology, rock mass Q/RMR classes, cover depth, and groundwater ingress.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const svgEl = document.getElementById('tbm-longitudinal-svg');
                  if (!svgEl) return;
                  const serializer = new XMLSerializer();
                  const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgEl);
                  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `TBM_Longitudinal_Profile_RD_${activeLocation?.startChainageRd.toFixed(0)}_to_${activeLocation?.endChainageRd?.toFixed(0) || 1550}.svg`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG Profile</span>
              </button>
            </div>
          </div>

          {/* Geological Legend & Rock Mass Classes */}
          <div className="flex flex-wrap items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold">Rock Mass Classes (Barton Q):</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Class I/II Good (Q&gt;4)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Class III Fair (1&le;Q&le;4)
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Class IV/V Poor (Q&lt;1)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Water Inflow
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-3 h-0.5 border-b border-dashed border-purple-400" /> Shear Zone
              </span>
            </div>
          </div>

          {/* Interactive SVG Longitudinal Cross-Section */}
          <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-x-auto">
            <svg id="tbm-longitudinal-svg" viewBox="0 0 900 240" className="w-full min-w-[750px] h-60">
              {/* Background & Elevation Grid */}
              <rect x="0" y="0" width="900" height="240" fill="#020617" />
              <line x1="60" y1="30" x2="860" y2="30" stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
              <line x1="60" y1="80" x2="860" y2="80" stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
              <line x1="60" y1="140" x2="860" y2="140" stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
              <line x1="60" y1="195" x2="860" y2="195" stroke="#334155" strokeWidth="1" />

              {/* Elevation / Depth Labels */}
              <text x="50" y="33" fill="#64748B" fontSize="8" textAnchor="end">El +120m</text>
              <text x="50" y="83" fill="#64748B" fontSize="8" textAnchor="end">El +95m</text>
              <text x="50" y="143" fill="#64748B" fontSize="8" textAnchor="end">El +65m</text>
              <text x="50" y="198" fill="#64748B" fontSize="8" textAnchor="end">Datum</text>

              {/* Ground Surface Topography Line */}
              <path
                d="M 60 45 Q 200 40 380 48 T 620 42 T 860 46"
                fill="none"
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="4,2"
              />
              <text x="865" y="48" fill="#94A3B8" fontSize="8" textAnchor="start">Ground Surface</text>

              {/* Overburden Strata Zone */}
              <path
                d="M 60 45 Q 200 40 380 48 T 620 42 T 860 46 L 860 120 L 60 120 Z"
                fill="rgba(51, 65, 85, 0.15)"
              />
              <text x="120" y="70" fill="#475569" fontSize="9" fontWeight="bold">OVERBURDEN &amp; WEATHERED ZONE (25-35m cover)</text>

              {/* Tunnel Bore Envelope */}
              <rect
                x="60"
                y="125"
                width="800"
                height="45"
                fill="rgba(6, 182, 212, 0.08)"
                stroke="#06B6D4"
                strokeWidth="1.5"
                rx="4"
              />
              <line x1="60" y1="147.5" x2="860" y2="147.5" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="5,4" />
              <text x="50" y="150" fill="#06B6D4" fontSize="8" fontWeight="bold" textAnchor="end">Axis</text>

              {/* Rings Placed along Tunnel Axis */}
              {records.map((r, i) => {
                const stepWidth = 780 / Math.max(1, records.length);
                const x = 70 + i * stepWidth;
                const width = Math.max(20, stepWidth - 4);
                const q = r.classification.calculatedQ;
                const qColor = q < 1 ? '#F43F5E' : q < 4 ? '#F59E0B' : '#10B981';
                const isSelected = r.id === selectedRingId;
                const hasInflow = r.groundwater.inflowRateLitersPerMin > 15;
                const hasShear = r.geology.degreeOfFracturing === 'HIGHLY_FRACTURED' || r.geology.degreeOfFracturing === 'CRUSHED';

                return (
                  <g key={r.id} onClick={() => handleSelectRecord(r.id)} className="cursor-pointer">
                    {/* Ring Excavation Block */}
                    <rect
                      x={x}
                      y="127"
                      width={width}
                      height="41"
                      fill={qColor}
                      fillOpacity={isSelected ? '0.85' : '0.45'}
                      stroke={isSelected ? '#FFFFFF' : qColor}
                      strokeWidth={isSelected ? 2 : 1}
                      rx="2"
                    />

                    {/* Ring Label & Lithology */}
                    <text x={x + width / 2} y="142" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                      #{r.chainageRecord.ringNumber}
                    </text>
                    <text x={x + width / 2} y="155" fill="#E2E8F0" fontSize="7" textAnchor="middle">
                      Q={q.toFixed(1)}
                    </text>

                    {/* Chainage Marker Below */}
                    <line x1={x + width / 2} y1="168" x2={x + width / 2} y2="195" stroke="#334155" strokeWidth="0.5" />
                    <text x={x + width / 2} y="208" fill="#94A3B8" fontSize="7" textAnchor="middle">
                      {r.chainageRecord.startChainage.toFixed(0)}m
                    </text>

                    {/* Inflow Drop Indicator */}
                    {hasInflow && (
                      <circle cx={x + width / 2} cy="118" r="3.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1" />
                    )}

                    {/* Shear Zone Marker */}
                    {hasShear && (
                      <line
                        x1={x + 3}
                        y1="120"
                        x2={x + width - 3}
                        y2="175"
                        stroke="#C084FC"
                        strokeWidth="2"
                        strokeDasharray="2,2"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Excavated Rings Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Alignment Length Plotted</span>
              <p className="text-lg font-bold text-cyan-300">
                {(
                  (records[records.length - 1]?.chainageRecord.endChainage || 1435) -
                  (records[0]?.chainageRecord.startChainage || 1422)
                ).toFixed(1)} m
              </p>
              <span className="text-[10px] text-slate-400">{records.length} rings erected</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Mean Barton Q Rating</span>
              <p className="text-lg font-bold text-emerald-400">
                {(
                  records.reduce((acc, r) => acc + r.classification.calculatedQ, 0) / Math.max(1, records.length)
                ).toFixed(1)}
              </p>
              <span className="text-[10px] text-slate-400">Class II Good Rock</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Mean Bieniawski RMR89</span>
              <p className="text-lg font-bold text-amber-300">
                {Math.round(
                  records.reduce((acc, r) => acc + r.classification.calculatedRmr, 0) / Math.max(1, records.length)
                )} / 100
              </p>
              <span className="text-[10px] text-slate-400">Class II Good Rock</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Peak Groundwater Inflow</span>
              <p className="text-lg font-bold text-cyan-400">
                {Math.max(...records.map((r) => r.groundwater.inflowRateLitersPerMin), 0).toFixed(1)} L/min
              </p>
              <span className="text-[10px] text-emerald-400">Within dewatering envelope</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 5: PREDICTED VS ENCOUNTERED GEOLOGICAL VERIFICATION & DSC
          ===================================================================== */}
      {subTab === 'predicted_vs_encountered' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>GEOTECHNICAL BASELINE REPORT (GBR) VS. ENCOUNTERED GEOLOGY VERIFICATION</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Dual-horizon alignment reconciliation, contractual Differing Site Conditions (DSC), and rock mass variance tracking.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const svgEl = document.getElementById('tbm-pred-vs-enc-svg');
                  if (!svgEl) return;
                  const serializer = new XMLSerializer();
                  const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgEl);
                  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `TBM_Predicted_vs_Encountered_Geology_RD_${activeLocation?.startChainageRd.toFixed(0)}_to_${activeLocation?.endChainageRd?.toFixed(0) || 1550}.svg`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Comparison SVG</span>
              </button>
            </div>
          </div>

          {/* Variance KPI Cards */}
          {(() => {
            let concordantCount = 0;
            let totalQDev = 0;
            let dscCount = 0;

            records.forEach((r) => {
              const pred = activeLocation?.predictedGeology?.find(
                (p) => r.chainageRecord.startChainage >= p.startChainage && r.chainageRecord.startChainage <= p.endChainage
              );
              const predLith = (pred?.lithology || 'Basalt').toLowerCase();
              const encLith = r.geology.mainLithology.toLowerCase();
              const isMatch = encLith.includes(predLith.split(' ')[0]) || predLith.includes(encLith.split(' ')[0]);
              if (isMatch) concordantCount++;

              const predQ = pred?.expectedQValue || 12.0;
              const deltaQ = r.classification.calculatedQ - predQ;
              totalQDev += deltaQ;

              // DSC Trigger: severe adverse Q deviation (> -5) or unforeseen high water inrush
              if (deltaQ < -6.0 || r.groundwater.inflowRateLitersPerMin > 50) {
                dscCount++;
              }
            });

            const concordancePct = Math.round((concordantCount / Math.max(1, records.length)) * 100);
            const meanDeltaQ = (totalQDev / Math.max(1, records.length)).toFixed(1);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase">Lithological Concordance</span>
                  <div className="text-2xl font-black text-cyan-300">{concordancePct}%</div>
                  <p className="text-[10px] text-slate-400">{concordantCount} of {records.length} rings concordant</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase">Mean Rock Mass Deviation</span>
                  <div className={`text-2xl font-black ${parseFloat(meanDeltaQ) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {parseFloat(meanDeltaQ) >= 0 ? `+${meanDeltaQ}` : meanDeltaQ} <span className="text-xs font-normal text-slate-400">&Delta;Q</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{parseFloat(meanDeltaQ) >= 0 ? 'Favorable rock mass vs GBR' : 'Slightly more fractured than GBR'}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase">Differing Site Conditions</span>
                  <div className={`text-2xl font-black ${dscCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {dscCount} <span className="text-xs font-normal text-slate-400">Events</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{dscCount > 0 ? 'Potential contractual notices' : 'Zero adverse DSC claims'}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] font-bold uppercase">GBR Baseline Status</span>
                  <div className="text-2xl font-black text-emerald-400">RECONCILED</div>
                  <p className="text-[10px] text-slate-400">Aligned with Tender Model</p>
                </div>
              </div>
            );
          })()}

          {/* DUAL-HORIZON COMPARATIVE SCHEMATIC DIAGRAM (SVG) */}
          <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-x-auto">
            <svg id="tbm-pred-vs-enc-svg" viewBox="0 0 900 220" className="w-full min-w-[750px] h-56">
              <rect x="0" y="0" width="900" height="220" fill="#020617" />

              {/* HORIZON 1: BASELINE PREDICTION LAYER */}
              <text x="60" y="25" fill="#38BDF8" fontSize="10" fontWeight="bold">
                1. GEOTECHNICAL BASELINE REPORT (GBR) FORECAST STRATA
              </text>
              <rect x="60" y="35" width="800" height="40" fill="rgba(56, 189, 248, 0.12)" stroke="#0284C7" strokeWidth="1.5" rx="3" />
              <text x="75" y="58" fill="#BAE6FD" fontSize="9" fontWeight="bold">
                Forecast Unit: Massive to Moderately Jointed Basalt (Q: 10 - 15, UCS: 90 - 120 MPa, Expected Inflow: &lt; 10 L/min)
              </text>

              {/* HORIZON 2: ACTUALLY ENCOUNTERED RINGS */}
              <text x="60" y="105" fill="#10B981" fontSize="10" fontWeight="bold">
                2. AS-BUILT ENCOUNTERED RINGS &amp; LITHOLOGY LOG
              </text>
              <rect x="60" y="115" width="800" height="42" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" strokeWidth="1.5" rx="3" />

              {/* Ring by Ring blocks in Encountered Horizon */}
              {records.map((r, i) => {
                const stepWidth = 780 / Math.max(1, records.length);
                const x = 70 + i * stepWidth;
                const width = Math.max(20, stepWidth - 4);
                const pred = activeLocation?.predictedGeology?.find(
                  (p) => r.chainageRecord.startChainage >= p.startChainage && r.chainageRecord.startChainage <= p.endChainage
                );
                const predLith = (pred?.lithology || 'Basalt').toLowerCase();
                const encLith = r.geology.mainLithology.toLowerCase();
                const isMatch = encLith.includes(predLith.split(' ')[0]) || predLith.includes(encLith.split(' ')[0]);
                const blockColor = isMatch ? '#10B981' : '#F43F5E';

                return (
                  <g key={r.id}>
                    {/* Discrepancy Connector Band */}
                    <line
                      x1={x + width / 2}
                      y1="75"
                      x2={x + width / 2}
                      y2="115"
                      stroke={isMatch ? '#059669' : '#E11D48'}
                      strokeWidth={isMatch ? 1 : 2}
                      strokeDasharray={isMatch ? '2,2' : undefined}
                    />

                    {/* Encountered Block */}
                    <rect
                      x={x}
                      y="117"
                      width={width}
                      height="38"
                      fill={blockColor}
                      fillOpacity="0.6"
                      stroke={blockColor}
                      strokeWidth="1.2"
                      rx="2"
                    />

                    <text x={x + width / 2} y="132" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">
                      R#{r.chainageRecord.ringNumber}
                    </text>
                    <text x={x + width / 2} y="145" fill="#E2E8F0" fontSize="7" textAnchor="middle">
                      Q={r.classification.calculatedQ.toFixed(1)}
                    </text>

                    {/* RD Chainage */}
                    <text x={x + width / 2} y="175" fill="#94A3B8" fontSize="7" textAnchor="middle">
                      {r.chainageRecord.startChainage.toFixed(0)}m
                    </text>

                    {/* Status Badge */}
                    <circle
                      cx={x + width / 2}
                      cy="192"
                      r="4"
                      fill={isMatch ? '#10B981' : '#F43F5E'}
                    />
                  </g>
                );
              })}

              {/* Legend at Bottom */}
              <text x="60" y="212" fill="#94A3B8" fontSize="8">
                Green indicator = Concordant with GBR Baseline · Red indicator = Differing Site Condition / Rock Mass Anomaly
              </text>
            </svg>
          </div>

          {/* DETAILED RECONCILIATION & DISCREPANCY REGISTER TABLE */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-2.5">Ring #</th>
                  <th className="p-2.5">Chainage RD</th>
                  <th className="p-2.5">Baseline Predicted Lithology</th>
                  <th className="p-2.5">Encountered Lithology</th>
                  <th className="p-2.5">Pred Q &rarr; Actual Q</th>
                  <th className="p-2.5">Variance (&Delta;Q)</th>
                  <th className="p-2.5">Water Inflow</th>
                  <th className="p-2.5">Concordance Status</th>
                  <th className="p-2.5">Contractual Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {records.map((r) => {
                  const pred = activeLocation?.predictedGeology?.find(
                    (p) => r.chainageRecord.startChainage >= p.startChainage && r.chainageRecord.startChainage <= p.endChainage
                  );
                  const predLith = pred?.lithology || 'Basalt';
                  const encLith = r.geology.mainLithology;
                  const isMatch = encLith.toLowerCase().includes(predLith.toLowerCase().split(' ')[0]) || predLith.toLowerCase().includes(encLith.toLowerCase().split(' ')[0]);
                  const predQ = pred?.expectedQValue || 12.0;
                  const actualQ = r.classification.calculatedQ;
                  const deltaQ = actualQ - predQ;
                  const isDsc = deltaQ < -6.0 || r.groundwater.inflowRateLitersPerMin > 50;

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-cyan-400">#{r.chainageRecord.ringNumber}</td>
                      <td className="p-2.5">RD {r.chainageRecord.startChainage.toFixed(2)}m</td>
                      <td className="p-2.5 text-slate-400">{predLith}</td>
                      <td className="p-2.5 font-bold text-amber-300">{encLith}</td>
                      <td className="p-2.5 font-mono">
                        {predQ.toFixed(1)} &rarr; <strong className="text-emerald-400">{actualQ.toFixed(1)}</strong>
                      </td>
                      <td className="p-2.5 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          deltaQ >= 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}>
                          {deltaQ >= 0 ? `+${deltaQ.toFixed(1)}` : deltaQ.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-cyan-300">
                        {r.groundwater.inflowRateLitersPerMin.toFixed(1)} L/min
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isMatch ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {isMatch ? 'CONCORDANT' : 'DISCORDANT ANOMALY'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDsc ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse' : 'text-slate-500'
                        }`}>
                          {isDsc ? 'DSC CANDIDATE' : 'STANDARD GBR'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 6: AHEAD-OF-FACE GEOLOGICAL FORECASTING & PROBE RECONCILIATION
          ===================================================================== */}
      {subTab === 'ahead_forecast' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>AHEAD-OF-FACE GEOLOGICAL FORECASTING &amp; LOOK-AHEAD VERIFICATION</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Pre-excavation ground model forecasting based on probe drilling, geophysical survey, GBR baseline, and versioned risk control.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const headers = ['ID', 'Revision', 'Date', 'Start_RD', 'End_RD', 'Lithology', 'Formation', 'Exp_Q', 'Exp_RMR', 'Water_Risk', 'Confidence', 'Status'];
                  const rows = forecasts.map((f) => [
                    f.id,
                    f.revision || 'Rev A',
                    f.forecastDate,
                    f.startChainageRd,
                    f.endChainageRd,
                    `"${f.predictedLithology}"`,
                    `"${f.predictedFormations}"`,
                    f.expectedQValue,
                    f.expectedRmr,
                    f.predictedWaterInflowRisk,
                    f.confidence,
                    f.matchStatus || 'UNVERIFIED',
                  ]);
                  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `TBM_Geological_Forecast_Schedule_${activeProject?.id || 'PRJ'}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer border border-slate-700 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewForecastModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Forecast Horizon</span>
              </button>
            </div>
          </div>

          {/* Quick Status KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Current Face Chainage</span>
              <div className="text-2xl font-black text-cyan-300">
                RD {currentRecord?.chainageRecord?.endChainage?.toFixed(2) || '1432.00'}m
              </div>
              <p className="text-[10px] text-slate-400">Ring #{currentRecord?.chainageRecord?.ringNumber || 848}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Total Forecasts Logged</span>
              <div className="text-2xl font-black text-amber-300">
                {forecasts.length} <span className="text-xs font-normal text-slate-400">Horizons</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {forecasts.filter((f) => f.isEncounteredVerified).length} verified · {forecasts.filter((f) => !f.isEncounteredVerified).length} ahead of face
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Probe Investigation Reach</span>
              <div className="text-2xl font-black text-emerald-400">
                {currentRecord?.probeDrilling?.drilledLengthMeters ? `${currentRecord.probeDrilling.drilledLengthMeters.toFixed(0)}m` : '25m'}
              </div>
              <p className="text-[10px] text-slate-400">Forward probe {currentRecord?.probeDrilling?.probeHoleId || 'PB-01'}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Model Concordance Rate</span>
              <div className="text-2xl font-black text-cyan-400">
                {(() => {
                  const verified = forecasts.filter((f) => f.isEncounteredVerified);
                  if (verified.length === 0) return 'Pending';
                  const match = verified.filter((f) => f.matchStatus === 'CONCORDANT').length;
                  return `${Math.round((match / verified.length) * 100)}%`;
                })()}
              </div>
              <p className="text-[10px] text-slate-400">Based on verified intervals</p>
            </div>
          </div>

          {/* List of Versioned Ahead-of-Face Geological Forecasts */}
          <div className="space-y-3">
            {forecasts.map((fc) => {
              const currentFaceRd = currentRecord?.chainageRecord?.endChainage || 1432.0;
              const isPastOrReached = currentFaceRd >= fc.startChainageRd;
              const isFullyExcavated = currentFaceRd >= fc.endChainageRd;

              return (
                <div
                  key={fc.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold">
                        {fc.id} ({fc.revision || 'Rev A'})
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        RD {fc.startChainageRd.toFixed(2)}m &rarr; RD {fc.endChainageRd.toFixed(2)}m (Length: {(fc.endChainageRd - fc.startChainageRd).toFixed(1)}m)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Date: {fc.forecastDate} · By: {fc.author}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isPastOrReached ? (
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                          AHEAD OF FACE (AWAITING EXCAVATION)
                        </span>
                      ) : fc.isEncounteredVerified ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          fc.matchStatus === 'CONCORDANT'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : fc.matchStatus === 'PARTIAL_MATCH'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {fc.matchStatus || 'VERIFIED'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold animate-pulse">
                          EXCAVATED — PENDING VERIFICATION
                        </span>
                      )}

                      {isPastOrReached && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedForecastForReview(fc);
                            setReviewModalMatchStatus(fc.matchStatus || 'CONCORDANT');
                            setReviewModalDiscrepancyNotes(fc.discrepancyNotes || fc.encounteredSummary || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-[11px] font-bold cursor-pointer transition-all"
                        >
                          Review &amp; Verify
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Forecast Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-slate-500 font-bold">Predicted Lithology &amp; Strata:</span>
                      <p className="text-amber-300 font-bold">{fc.predictedLithology}</p>
                      <p className="text-slate-400 text-[10px]">{fc.predictedFormations}</p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-slate-500 font-bold">Expected Rock Mass Ratings:</span>
                      <p className="text-slate-200">
                        Barton Q: <strong className="text-cyan-300">{fc.expectedQValue.toFixed(1)}</strong>
                      </p>
                      <p className="text-slate-200">
                        Bieniawski RMR89: <strong className="text-emerald-300">{fc.expectedRmr}</strong> / 100
                      </p>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-slate-500 font-bold">Structural &amp; Water Inrush Risk:</span>
                      <p className="text-slate-300 truncate">{fc.predictedFaultsAndShears}</p>
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        fc.predictedWaterInflowRisk === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300'
                          : fc.predictedWaterInflowRisk === 'HIGH'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-blue-950 text-blue-300'
                      }`}>
                        Water Risk: {fc.predictedWaterInflowRisk}
                      </span>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-slate-500 font-bold">Investigation Evidence &amp; Confidence:</span>
                      <p className="text-slate-300 text-[10px] truncate">{fc.supportingEvidence}</p>
                      <span className="text-[10px] font-bold text-cyan-400">
                        Confidence: {fc.confidence}
                      </span>
                    </div>
                  </div>

                  {/* Geologist Recommendations & Actions */}
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-cyan-400 font-bold">Recommended Advance Actions:</span>
                      <span>{fc.recommendedActions}</span>
                    </div>

                    {fc.isEncounteredVerified && fc.encounteredSummary && (
                      <div className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                        <strong>Encountered Ground:</strong> {fc.encounteredSummary}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          NEW AHEAD-OF-FACE FORECAST MODAL
          ===================================================================== */}
      {showNewForecastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none font-mono">
          <div className="bg-slate-900 border border-cyan-500 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-sm text-cyan-300 uppercase">
                Create New Ahead-of-Face Geological Forecast Horizon
              </h3>
              <button
                type="button"
                onClick={() => setShowNewForecastModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const created = createTbmForecast({
                  projectId: activeProject?.id || 'PRJ-TBM-001',
                  locationId: activeLocation?.id || 'LOC-TBM-001',
                  revision: newForecastForm.revision,
                  forecastDate: new Date().toISOString().slice(0, 10),
                  author: newForecastForm.author,
                  startChainageRd: Number(newForecastForm.startChainageRd),
                  endChainageRd: Number(newForecastForm.endChainageRd),
                  predictedLithology: newForecastForm.predictedLithology,
                  predictedFormations: newForecastForm.predictedFormations,
                  expectedQValue: Number(newForecastForm.expectedQValue),
                  expectedRmr: Number(newForecastForm.expectedRmr),
                  predictedFaultsAndShears: newForecastForm.predictedFaultsAndShears,
                  predictedWaterInflowRisk: newForecastForm.predictedWaterInflowRisk,
                  supportingEvidence: newForecastForm.supportingEvidence,
                  investigationLimitations: newForecastForm.investigationLimitations,
                  confidence: newForecastForm.confidence,
                  recommendedActions: newForecastForm.recommendedActions,
                  isEncounteredVerified: false,
                  matchStatus: 'UNVERIFIED',
                });
                setForecasts(loadTbmForecasts(activeProject?.id));
                setShowNewForecastModal(false);
              }}
              className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Revision / Version</span>
                  <input
                    type="text"
                    required
                    value={newForecastForm.revision}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, revision: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Author / Lead Geologist</span>
                  <input
                    type="text"
                    required
                    value={newForecastForm.author}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Start Chainage (RD m)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newForecastForm.startChainageRd}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, startChainageRd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">End Chainage (RD m)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newForecastForm.endChainageRd}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, endChainageRd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Predicted Lithology</span>
                  <input
                    type="text"
                    required
                    value={newForecastForm.predictedLithology}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, predictedLithology: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Formation / Geological Domain</span>
                  <input
                    type="text"
                    required
                    value={newForecastForm.predictedFormations}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, predictedFormations: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Expected Barton Q Index</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newForecastForm.expectedQValue}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, expectedQValue: parseFloat(e.target.value) || 1 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Expected Bieniawski RMR89</span>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newForecastForm.expectedRmr}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, expectedRmr: parseInt(e.target.value) || 50 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Groundwater Inflow Risk</span>
                  <select
                    value={newForecastForm.predictedWaterInflowRisk}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, predictedWaterInflowRisk: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="LOW">LOW (&lt;10 L/min)</option>
                    <option value="MODERATE">MODERATE (10–30 L/min)</option>
                    <option value="HIGH">HIGH (30–80 L/min)</option>
                    <option value="CRITICAL">CRITICAL INRUSH (&gt;80 L/min)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 font-bold">Confidence Level</span>
                  <select
                    value={newForecastForm.confidence}
                    onChange={(e) => setNewForecastForm((f) => ({ ...f, confidence: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="HIGH">HIGH (Well-correlated probe &amp; GBR)</option>
                    <option value="MODERATE">MODERATE (Extrapolated trends)</option>
                    <option value="LOW">LOW (Uncertain ground zone)</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-slate-400 font-bold">Predicted Faults, Shears &amp; Adverse Ground</span>
                <input
                  type="text"
                  value={newForecastForm.predictedFaultsAndShears}
                  onChange={(e) => setNewForecastForm((f) => ({ ...f, predictedFaultsAndShears: e.target.value }))}
                  placeholder="e.g. Minor slickensided joint shear zone near RD 1442m"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-400 font-bold">Supporting Evidence</span>
                <input
                  type="text"
                  value={newForecastForm.supportingEvidence}
                  onChange={(e) => setNewForecastForm((f) => ({ ...f, supportingEvidence: e.target.value }))}
                  placeholder="e.g. Probe PB-01 drilling torque anomalies and GBR BH-10"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-400 font-bold">Recommended Advance Actions</span>
                <input
                  type="text"
                  value={newForecastForm.recommendedActions}
                  onChange={(e) => setNewForecastForm((f) => ({ ...f, recommendedActions: e.target.value }))}
                  placeholder="e.g. Maintain EPB face pressure at 1.85 bar; inspect muck discharge"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
                />
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewForecastModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer shadow"
                >
                  Save Forecast Horizon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          FORECAST REVIEW & VERIFICATION MODAL
          ===================================================================== */}
      {selectedForecastForReview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none font-mono">
          <div className="bg-slate-900 border border-cyan-500 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-sm text-cyan-300 uppercase">
                Geologist Verification: {selectedForecastForReview.id} ({selectedForecastForReview.revision || 'Rev A'})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedForecastForReview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="text-slate-400">
                  Target Interval: <strong className="text-slate-200">RD {selectedForecastForReview.startChainageRd.toFixed(2)}m &rarr; {selectedForecastForReview.endChainageRd.toFixed(2)}m</strong>
                </p>
                <p className="text-slate-400">
                  Predicted: <strong className="text-amber-300">{selectedForecastForReview.predictedLithology}</strong> · Q={selectedForecastForReview.expectedQValue}
                </p>
              </div>

              <label className="block space-y-1">
                <span className="text-slate-300 font-bold">Verification Match Status:</span>
                <select
                  value={reviewModalMatchStatus}
                  onChange={(e) => setReviewModalMatchStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-bold"
                >
                  <option value="CONCORDANT">CONCORDANT (Ground conditions matched forecast within tolerance)</option>
                  <option value="PARTIAL_MATCH">PARTIAL MATCH (Lithology matched, minor variance in jointing or water)</option>
                  <option value="DISCORDANT">DISCORDANT ANOMALY (Unforeseen fault / Differing Site Condition)</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-slate-300 font-bold">Geological Verification Summary &amp; Discrepancy Notes:</span>
                <textarea
                  rows={3}
                  value={reviewModalDiscrepancyNotes}
                  onChange={(e) => setReviewModalDiscrepancyNotes(e.target.value)}
                  placeholder="Summarize actual encountered geology and reasons for any variance..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedForecastForReview(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateTbmForecast(selectedForecastForReview.id, {
                      isEncounteredVerified: true,
                      matchStatus: reviewModalMatchStatus,
                      encounteredSummary: reviewModalDiscrepancyNotes,
                      discrepancyNotes: reviewModalDiscrepancyNotes,
                      verificationDate: new Date().toISOString().slice(0, 10),
                      verifiedBy: activeProject?.responsibleGeologist || 'Reviewing Geologist',
                    });
                    setForecasts(loadTbmForecasts(activeProject?.id));
                    setSelectedForecastForReview(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer shadow"
                >
                  Sign-Off &amp; Save Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
