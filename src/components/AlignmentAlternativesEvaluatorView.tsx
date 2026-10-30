// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 5: EVALUATING TUNNEL ALIGNMENT ALTERNATIVES
// Alignments A, B, C Comparison, Fault Crossing Lengths, Bieniawski RMR89 R6 (0 to -12),
// Maximum Horizontal In-Situ Stress Alignment, Composite Risk Ranking, and 0°-180° Rose Curve
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Activity,
  Layers,
  Award,
  Sliders,
  BarChart3,
} from 'lucide-react';
import {
  AlignmentCandidate,
  MappedFaultInput,
  MappedJointInput,
  evaluateAlignmentOption,
  sweepAzimuthOptimization,
  AlignmentEvaluationResult,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface AlignmentAlternativesEvaluatorViewProps {
  currentDriveAzimuth?: number;
  faults?: MappedFaultInput[];
  controllingJoint?: MappedJointInput;
  sigmaHAzDefault?: number;
}

export const AlignmentAlternativesEvaluatorView: React.FC<AlignmentAlternativesEvaluatorViewProps> = ({
  currentDriveAzimuth = 45,
  faults = [],
  controllingJoint = { id: 'j-ctrl', beta: 65, thetaDip: 135, frictionAngle: 32 },
  sigmaHAzDefault = 110,
}) => {
  // 3 Candidate alignments (A, B, C)
  const [candidateA, setCandidateA] = useState<AlignmentCandidate>({
    id: 'align-A',
    name: 'Alignment A (Current Baseline)',
    alphaDrive: Math.round(currentDriveAzimuth),
    designLengthM: 1200,
  });
  const [candidateB, setCandidateB] = useState<AlignmentCandidate>({
    id: 'align-B',
    name: 'Alignment B (North Shift +30°)',
    alphaDrive: (Math.round(currentDriveAzimuth) + 30) % 360,
    designLengthM: 1260,
  });
  const [candidateC, setCandidateC] = useState<AlignmentCandidate>({
    id: 'align-C',
    name: 'Alignment C (East Shift -35°)',
    alphaDrive: (Math.round(currentDriveAzimuth) - 35 + 360) % 360,
    designLengthM: 1180,
  });

  const [sigmaHAz, setSigmaHAz] = useState<number>(sigmaHAzDefault);
  const [activeFaults, setActiveFaults] = useState<MappedFaultInput[]>(faults);

  // Evaluate candidate alignments
  const evaluatedCandidates: AlignmentEvaluationResult[] = useMemo(() => {
    const raw = [
      evaluateAlignmentOption(candidateA, activeFaults, controllingJoint, sigmaHAz),
      evaluateAlignmentOption(candidateB, activeFaults, controllingJoint, sigmaHAz),
      evaluateAlignmentOption(candidateC, activeFaults, controllingJoint, sigmaHAz),
    ];
    // Sort by composite risk ascending
    const sorted = [...raw].sort((a, b) => a.compositeRiskScore - b.compositeRiskScore);
    return sorted.map((res, i) => ({ ...res, rank: i + 1 }));
  }, [candidateA, candidateB, candidateC, activeFaults, controllingJoint, sigmaHAz]);

  // 0° to 180° Azimuth Optimization Rose / Sweep
  const sweepCurve = useMemo(() => {
    return sweepAzimuthOptimization(activeFaults, controllingJoint, sigmaHAz, 5);
  }, [activeFaults, controllingJoint, sigmaHAz]);

  // Best azimuth from sweep
  const bestSweep = useMemo(() => {
    let min = sweepCurve[0];
    for (const pt of sweepCurve) {
      if (pt.compositeRisk < min.compositeRisk) min = pt;
    }
    return min;
  }, [sweepCurve]);

  // SVG dimensions for 0-180 sweep curve
  const svgW = 760;
  const svgH = 180;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 30;
  const pw = svgW - padL - padR;
  const ph = svgH - padT - padB;

  const toSweepX = (az: number) => padL + (az / 180) * pw;
  const toSweepY = (risk: number) => padT + ph - (risk / 100) * ph;

  const curvePolyline = sweepCurve.map((pt) => `${toSweepX(pt.azimuth)},${toSweepY(pt.compositeRisk)}`).join(' ');

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              Tunnel Alignment Alternatives &amp; Geological Optimization Evaluator
            </h3>
            <p className="text-xs text-slate-400">
              Comparative multi-criteria ranking: Fault Crossing Exposure, Bieniawski R6 [0 to -12], and σ_H Stress Alignment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-amber-300">
            σ_H Max Stress Az: <strong>{sigmaHAz}°</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold">
            Sweet Spot Azimuth: N {bestSweep?.azimuth}° E
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* TOP: 3 CANDIDATE ALIGNMENT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {evaluatedCandidates.map((cand) => {
            const isRank1 = cand.rank === 1;
            return (
              <div
                key={cand.candidateId}
                className={`p-3.5 rounded-xl border font-mono transition-all relative flex flex-col justify-between ${
                  isRank1
                    ? 'bg-emerald-950/30 border-emerald-500 shadow-lg ring-1 ring-emerald-400'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                    <span className="font-bold text-xs text-white truncate">{cand.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isRank1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      RANK #{cand.rank}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Drive Azimuth</span>
                      <strong className="text-amber-300 text-sm">N {cand.alphaDrive}° E</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Total Design Length</span>
                      <strong className="text-slate-200 text-sm">{cand.designLengthM} m</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Fault Crossing:</span>
                      <strong className={cand.faultCrossingLengthM > 25 ? 'text-rose-400' : 'text-slate-300'}>
                        {cand.faultCrossingLengthM} m
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bieniawski R6 Rating:</span>
                      <strong className={cand.rmr89R6Adjustment >= -2 ? 'text-emerald-400' : 'text-amber-300'}>
                        {cand.rmr89R6Adjustment} ({cand.rmr89Favorability})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Angle to σ_H Max Stress:</span>
                      <strong className="text-cyan-300">{cand.stressAngleDeltaDeg}° (Score: {cand.stressPenaltyScore})</strong>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800 mb-2">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="text-slate-300 font-bold">Composite Risk Score:</span>
                      <strong
                        className={`text-sm ${
                          cand.compositeRiskScore < 35
                            ? 'text-emerald-400'
                            : cand.compositeRiskScore < 60
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {cand.compositeRiskScore} / 100
                      </strong>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cand.compositeRiskScore < 35
                            ? 'bg-emerald-500'
                            : cand.compositeRiskScore < 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${cand.compositeRiskScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 leading-normal">
                  {cand.recommendationNote}
                </p>
              </div>
            );
          })}
        </div>

        {/* MIDDLE: 0° TO 180° AZIMUTH OPTIMIZATION ROSE / CURVE SWEEP */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> 0° to 180° Alignment Azimuth Optimization Sweep (Sweet Spot Curve)
            </span>
            <span className="text-[11px] text-slate-400">
              Evaluates every 5° heading against intersecting faults and regional stress
            </span>
          </div>

          <div className="w-full overflow-x-auto py-2 flex justify-center">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[190px]">
              {/* Sweep Grid */}
              <rect x={padL} y={padT} width={pw} height={ph} fill="#0b1120" stroke="#1e293b" />
              <line x1={padL} y1={toSweepY(35)} x2={padL + pw} y2={toSweepY(35)} stroke="#065f46" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={padL} y1={toSweepY(60)} x2={padL + pw} y2={toSweepY(60)} stroke="#9a3412" strokeWidth="1" strokeDasharray="3 3" />
              <text x={padL + 6} y={toSweepY(35) - 4} fill="#10b981" fontSize="9">
                Low Risk Zone (&lt; 35)
              </text>
              <text x={padL + 6} y={toSweepY(60) - 4} fill="#f97316" fontSize="9">
                Moderate Risk Zone (35-60)
              </text>

              {/* Optimization Curve */}
              <polyline points={curvePolyline} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

              {/* Marker for Candidate Alignments */}
              {evaluatedCandidates.map((c, i) => {
                const cx = toSweepX(c.alphaDrive % 180);
                const cy = toSweepY(c.compositeRiskScore);
                return (
                  <g key={i}>
                    <line x1={cx} y1={padT} x2={cx} y2={padT + ph} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx={cx} cy={cy} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    <text x={cx} y={cy - 8} textAnchor="middle" fill="#fcd34d" fontSize="9" fontWeight="bold">
                      {c.name.split(' ')[1]} ({c.compositeRiskScore})
                    </text>
                  </g>
                );
              })}

              {/* Sweet spot marker */}
              {bestSweep && (
                <g>
                  <circle cx={toSweepX(bestSweep.azimuth)} cy={toSweepY(bestSweep.compositeRisk)} r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  <text x={toSweepX(bestSweep.azimuth)} y={toSweepY(bestSweep.compositeRisk) + 16} textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="bold">
                    Optimal: {bestSweep.azimuth}°
                  </text>
                </g>
              )}

              {/* Ticks */}
              {Array.from({ length: 7 }, (_, i) => {
                const az = i * 30;
                const x = toSweepX(az);
                return (
                  <g key={i}>
                    <line x1={x} y1={padT + ph} x2={x} y2={padT + ph + 5} stroke="#64748b" />
                    <text x={x} y={padT + ph + 18} textAnchor="middle" fill="#94a3b8" fontSize="10">
                      {az}°
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* BOTTOM: INTERACTIVE TUNNEL AZIMUTH SLIDERS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl font-mono text-xs">
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">
              Alignment A Azimuth: <strong>N {candidateA.alphaDrive}° E</strong>
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={candidateA.alphaDrive}
              onChange={(e) => setCandidateA((prev) => ({ ...prev, alphaDrive: Number(e.target.value) }))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">
              Alignment B Azimuth: <strong>N {candidateB.alphaDrive}° E</strong>
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={candidateB.alphaDrive}
              onChange={(e) => setCandidateB((prev) => ({ ...prev, alphaDrive: Number(e.target.value) }))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-slate-400 text-[11px] block mb-1">
              Regional σ_H Azimuth: <strong>{sigmaHAz}°</strong>
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={sigmaHAz}
              onChange={(e) => setSigmaHAz(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
