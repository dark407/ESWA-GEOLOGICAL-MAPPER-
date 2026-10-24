// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 6: POOR ROCK MASS PROPORTIONS ESTIMATOR
// Domain Segments, Gaussian erf() Integration, Fault Core + Damage Halo Crossings,
// Rock Classes I to V Breakdown, P10/P50/P90 Confidence Bounds & Strip Chart
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Layers,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Sliders,
  CheckCircle2,
  BarChart3,
  DollarSign,
  HelpCircle,
} from 'lucide-react';
import {
  AlignmentDomainSegment,
  FaultZoneCrossing,
  estimatePoorRockMassProportions,
  PoorRockProportionResult,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface PoorRockProportionsEstimatorViewProps {
  totalLengthDefault?: number;
  initialDomains?: AlignmentDomainSegment[];
  initialFaults?: FaultZoneCrossing[];
}

export const PoorRockProportionsEstimatorView: React.FC<PoorRockProportionsEstimatorViewProps> = ({
  totalLengthDefault = 1600,
  initialDomains = [
    {
      id: 'dom-1',
      name: 'Domain 1: Massive Quartzite Host',
      startChainage: 0,
      endChainage: 450,
      lengthM: 450,
      meanRmr: 68,
      stdDevRmr: 8.5,
      meanQ: 12.5,
      lithology: 'Quartzite',
    },
    {
      id: 'dom-2',
      name: 'Domain 2: Foliated Pelitic Schist Band',
      startChainage: 450,
      endChainage: 950,
      lengthM: 500,
      meanRmr: 42,
      stdDevRmr: 11.0,
      meanQ: 3.2,
      lithology: 'Schist',
    },
    {
      id: 'dom-3',
      name: 'Domain 3: Fault Damage & Shear Halo',
      startChainage: 950,
      endChainage: 1250,
      lengthM: 300,
      meanRmr: 34,
      stdDevRmr: 9.5,
      meanQ: 0.8,
      lithology: 'Cataclasite / Gouge',
    },
    {
      id: 'dom-4',
      name: 'Domain 4: Jointed Gneiss Complex',
      startChainage: 1250,
      endChainage: 1600,
      lengthM: 350,
      meanRmr: 56,
      stdDevRmr: 7.0,
      meanQ: 6.0,
      lithology: 'Biotite Gneiss',
    },
  ],
  initialFaults = [
    {
      id: 'flt-1',
      name: 'Major Thrust Fault F-1',
      coreThicknessM: 2.2,
      damageHaloMultiplier: 2.5,
      intersectionAnglePsiDeg: 40,
    },
    {
      id: 'flt-2',
      name: 'Regional Contact Shear F-2',
      coreThicknessM: 1.4,
      damageHaloMultiplier: 2.0,
      intersectionAnglePsiDeg: 55,
    },
  ],
}) => {
  const [totalLength, setTotalLength] = useState<number>(totalLengthDefault);
  const [domains, setDomains] = useState<AlignmentDomainSegment[]>(initialDomains);
  const [faults, setFaults] = useState<FaultZoneCrossing[]>(initialFaults);
  const [poorRmrThreshold, setPoorRmrThreshold] = useState<number>(40);

  const result: PoorRockProportionResult = useMemo(() => {
    return estimatePoorRockMassProportions(totalLength, domains, faults, poorRmrThreshold);
  }, [totalLength, domains, faults, poorRmrThreshold]);

  // Handle tweaking domain mean RMR
  const handleUpdateDomainRmr = (domainId: string, delta: number) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, meanRmr: Math.max(10, Math.min(95, d.meanRmr + delta)) } : d))
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <BarChart3 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              Poor Rock Mass Proportions Estimator &amp; Confidence Bounds
            </h3>
            <p className="text-xs text-slate-400">
              Probabilistic Gaussian erf() integration, Fault Core + Damage Halos, and P10 / P50 / P90 Lengths
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Threshold:</span>
          <select
            value={poorRmrThreshold}
            onChange={(e) => setPoorRmrThreshold(Number(e.target.value))}
            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-amber-300 font-bold"
          >
            <option value={40}>RMR &lt; 40 (Class IV &amp; V - Poor / Squeezing)</option>
            <option value={30}>RMR &lt; 30 (Very Severe Ground)</option>
            <option value={50}>RMR &lt; 50 (Fair to Poor)</option>
          </select>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* TOP KPI CARDS: P10 / P50 / P90 & ADVANCE IMPACT */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">P10 (Optimistic Bound)</span>
            <strong className="text-emerald-400 text-base">{result.p10OptimisticLengthM} m</strong>
            <span className="text-[9px] text-slate-500 block">
              {((result.p10OptimisticLengthM / totalLength) * 100).toFixed(1)}% of alignment
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 ring-1 ring-amber-500/50">
            <span className="text-[10px] text-slate-400 block">P50 (Expected Poor Rock)</span>
            <strong className="text-amber-300 text-lg">{result.totalExpectedPoorRockLengthM} m</strong>
            <span className="text-[9px] text-amber-400 font-bold block">{result.poorRockPercentage}% of alignment</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">P90 (Conservative Bound)</span>
            <strong className="text-rose-400 text-base">{result.p90ConservativeLengthM} m</strong>
            <span className="text-[9px] text-slate-500 block">
              {((result.p90ConservativeLengthM / totalLength) * 100).toFixed(1)}% of alignment
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Fault Zone + Damage Halo</span>
            <strong className="text-cyan-300 text-base">{result.faultZoneCrossingLengthM} m</strong>
            <span className="text-[9px] text-slate-500 block">Core + 2.5× halo factor</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Support Cost Multiplier</span>
            <strong className="text-indigo-300 text-base">{result.costImpactMultiplier}× Baseline</strong>
            <span className="text-[9px] text-slate-500 block">~{result.advanceRateDaysEstimate} mining days</span>
          </div>
        </div>

        {/* LONGITUDINAL ROCK CLASS STRIP CHART (CLASSES I TO V) */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" /> Longitudinal Rock Mass Class Proportions Strip Chart (0m ➔ {totalLength}m)
            </span>
            <span className="text-[11px] text-slate-400">Bieniawski RMR89 Classes I to V Distribution</span>
          </div>

          {/* Stacked Proportional Bar */}
          <div className="w-full h-8 rounded-lg overflow-hidden flex border border-slate-700 shadow-inner">
            <div
              style={{ width: `${(result.classDistributions.classI_Good / totalLength) * 100}%` }}
              className="bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`Class I (Very Good, RMR 81-100): ${result.classDistributions.classI_Good}m`}
            >
              {result.classDistributions.classI_Good > 80 && `I: ${result.classDistributions.classI_Good}m`}
            </div>
            <div
              style={{ width: `${(result.classDistributions.classII_Good / totalLength) * 100}%` }}
              className="bg-teal-600 hover:bg-teal-500 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`Class II (Good, RMR 61-80): ${result.classDistributions.classII_Good}m`}
            >
              {result.classDistributions.classII_Good > 80 && `II: ${result.classDistributions.classII_Good}m`}
            </div>
            <div
              style={{ width: `${(result.classDistributions.classIII_Fair / totalLength) * 100}%` }}
              className="bg-sky-600 hover:bg-sky-500 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`Class III (Fair, RMR 41-60): ${result.classDistributions.classIII_Fair}m`}
            >
              {result.classDistributions.classIII_Fair > 80 && `III: ${result.classDistributions.classIII_Fair}m`}
            </div>
            <div
              style={{ width: `${(result.classDistributions.classIV_Poor / totalLength) * 100}%` }}
              className="bg-amber-500 hover:bg-amber-400 transition-all flex items-center justify-center text-[10px] text-slate-950 font-bold"
              title={`Class IV (Poor, RMR 21-40): ${result.classDistributions.classIV_Poor}m`}
            >
              {result.classDistributions.classIV_Poor > 60 && `IV: ${result.classDistributions.classIV_Poor}m`}
            </div>
            <div
              style={{ width: `${(result.classDistributions.classV_VeryPoor / totalLength) * 100}%` }}
              className="bg-rose-600 hover:bg-rose-500 transition-all flex items-center justify-center text-[10px] text-white font-bold"
              title={`Class V (Very Poor, RMR <= 20): ${result.classDistributions.classV_VeryPoor}m`}
            >
              {result.classDistributions.classV_VeryPoor > 40 && `V: ${result.classDistributions.classV_VeryPoor}m`}
            </div>
          </div>

          {/* Legend and Length Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 bg-emerald-600 rounded-xs inline-block shrink-0" />
              <span>Class I: <strong>{result.classDistributions.classI_Good}m</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-teal-300">
              <span className="w-3 h-3 bg-teal-600 rounded-xs inline-block shrink-0" />
              <span>Class II: <strong>{result.classDistributions.classII_Good}m</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-3 bg-sky-600 rounded-xs inline-block shrink-0" />
              <span>Class III: <strong>{result.classDistributions.classIII_Fair}m</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300">
              <span className="w-3 h-3 bg-amber-500 rounded-xs inline-block shrink-0" />
              <span>Class IV: <strong>{result.classDistributions.classIV_Poor}m</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-3 h-3 bg-rose-600 rounded-xs inline-block shrink-0" />
              <span>Class V: <strong>{result.classDistributions.classV_VeryPoor}m</strong></span>
            </div>
          </div>
        </div>

        {/* DOMAIN SEGMENTS & FAULTS TABLE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 font-mono text-xs">
          {/* DOMAINS */}
          <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="font-bold text-slate-200 uppercase tracking-wider">
                Geological Domain Segments ({domains.length})
              </span>
              <span className="text-[10px] text-slate-400">Gaussian ~ N(μ, σ²)</span>
            </div>

            <div className="space-y-2">
              {domains.map((dom) => (
                <div key={dom.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-[11px]">{dom.name}</span>
                    <span className="text-slate-400 text-[10px]">
                      {dom.startChainage}m ➔ {dom.endChainage}m ({dom.lengthM}m)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Lithology: <strong className="text-cyan-300">{dom.lithology}</strong></span>
                    <div className="flex items-center gap-2">
                      <span>Mean RMR: <strong className="text-amber-300">{dom.meanRmr}</strong> (±{dom.stdDevRmr})</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateDomainRmr(dom.id, -2)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        >
                          -2
                        </button>
                        <button
                          onClick={() => handleUpdateDomainRmr(dom.id, +2)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        >
                          +2
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAULTS & DAMAGE HALOS */}
          <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="font-bold text-slate-200 uppercase tracking-wider">
                Intersected Faults ({faults.length})
              </span>
              <span className="text-[10px] text-rose-400">Core + Halo</span>
            </div>

            <div className="space-y-2">
              {faults.map((flt) => (
                <div key={flt.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-rose-300 text-[11px]">{flt.name}</span>
                    <span className="text-slate-400 text-[10px]">ψ: {flt.intersectionAnglePsiDeg}°</span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex justify-between">
                    <span>Core: <strong>{flt.coreThicknessM}m</strong></span>
                    <span>Halo Multiplier: <strong>{flt.damageHaloMultiplier}×</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2.5 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Total Tunnel Alignment:</span>
                <strong className="text-white">{totalLength} m</strong>
              </div>
              <div className="flex justify-between">
                <span>Domain Poor Rock (RMR &lt; {poorRmrThreshold}):</span>
                <strong className="text-amber-300">{result.domainPoorRockLengthM} m</strong>
              </div>
              <div className="flex justify-between">
                <span>Fault Core + Damage Zone:</span>
                <strong className="text-rose-400">{result.faultZoneCrossingLengthM} m</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
