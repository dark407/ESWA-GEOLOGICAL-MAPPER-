import React from 'react';
import {
  Shield,
  ArrowLeft,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
  Sparkles,
} from 'lucide-react';
import { calculateLaubscherMrmr, evaluateMathewsStability } from '../../engine/miningFaceEngine';

export interface MiningGeotechWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  stopeWidth: number;
  stopeHeight: number;
  mrmrBaseRmr: number;
  setMrmrBaseRmr: (v: number) => void;
  mrmrWeatheringPct: number;
  setMrmrWeatheringPct: (v: number) => void;
  mrmrStressPct: number;
  setMrmrStressPct: (v: number) => void;
  mrmrOrientationPct: number;
  setMrmrOrientationPct: (v: number) => void;
  mrmrBlastingPct: number;
  setMrmrBlastingPct: (v: number) => void;
  mrmrResult: ReturnType<typeof calculateLaubscherMrmr>;
  miningRqd: number;
  setMiningRqd: (v: number) => void;
  miningJn: number;
  setMiningJn: (v: number) => void;
  miningJr: number;
  setMiningJr: (v: number) => void;
  miningJa: number;
  setMiningJa: (v: number) => void;
  stressFactorA: number;
  setStressFactorA: (v: number) => void;
  jointFactorB: number;
  setJointFactorB: (v: number) => void;
  gravityFactorC: number;
  setGravityFactorC: (v: number) => void;
  mathewsResult: ReturnType<typeof evaluateMathewsStability>;
  hydraulicRadiusM: number;
  onReturnToCanvas: () => void;
}

export const MiningGeotechWindow: React.FC<MiningGeotechWindowProps> = ({
  driftId,
  chainage,
  mineLevel,
  stopeWidth,
  stopeHeight,
  mrmrBaseRmr,
  setMrmrBaseRmr,
  mrmrWeatheringPct,
  setMrmrWeatheringPct,
  mrmrStressPct,
  setMrmrStressPct,
  mrmrOrientationPct,
  setMrmrOrientationPct,
  mrmrBlastingPct,
  setMrmrBlastingPct,
  mrmrResult,
  miningRqd,
  setMiningRqd,
  miningJn,
  setMiningJn,
  miningJr,
  setMiningJr,
  miningJa,
  setMiningJa,
  stressFactorA,
  setStressFactorA,
  jointFactorB,
  setJointFactorB,
  gravityFactorC,
  setGravityFactorC,
  mathewsResult,
  hydraulicRadiusM,
  onReturnToCanvas,
}) => {
  // Chart dimensions for Mathews Potvin
  const svgW = 420;
  const svgH = 260;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;

  // Log N' scale: 0.1 to 1000 (4 decades)
  // Linear HR scale: 0 to 18 meters
  const hrToPx = (hr: number) => {
    const clampedHr = Math.max(0, Math.min(18, hr));
    return padL + (clampedHr / 18) * (svgW - padL - padR);
  };

  const nToPy = (nVal: number) => {
    const clampedN = Math.max(0.1, Math.min(1000, nVal));
    const logVal = Math.log10(clampedN); // -1 to 3
    const fraction = (logVal - (-1)) / 4; // 0 to 1
    return svgH - padB - fraction * (svgH - padT - padB);
  };

  const currentPtX = hrToPx(hydraulicRadiusM);
  const currentPtY = nToPy(mathewsResult.stabilityNumberN);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto font-mono p-4 sm:p-6 space-y-6">
      {/* Subheader / Window Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToCanvas}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Face Canvas</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-amber-300">
                Geotechnical Engineering &amp; Stope Stability Window
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Working Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Heading: <strong className="text-slate-200">{driftId}</strong> · Chainage:{' '}
              <strong className="text-amber-400">{chainage}</strong> · Level: {mineLevel} · Profile: {stopeWidth}m × {stopeHeight}m (HR: {hydraulicRadiusM.toFixed(2)}m)
            </p>
          </div>
        </div>

        {/* Global Stability Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Rock Quality:</span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black">
            Class {mrmrResult.rockMassClass} ({mrmrResult.designMrmr} MRMR)
          </span>
        </div>
      </div>

      {/* TWO SECTIONS: LAUBSCHER MRMR (LEFT) & MATHEWS-POTVIN STABILITY (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: LAUBSCHER DESIGN MRMR */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Laubscher Modified Rock Mass Rating (MRMR)</span>
            </span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {mrmrResult.designMrmr} / 100
            </span>
          </div>

          {/* Verdict Banner */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <strong className="text-slate-200">Rock Mass Classification:</strong>
              <span className="font-bold text-emerald-400">Class {mrmrResult.rockMassClass} ({mrmrResult.description})</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed">
              <strong className="block text-emerald-400 mb-0.5">Recommended Ground Support:</strong>
              {mrmrResult.recommendedSupport}
            </div>
          </div>

          {/* MRMR Parameter Sliders */}
          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-bold">Base RMR (IRS + RQD + Joints):</span>
                <span className="text-amber-400 font-black">{mrmrBaseRmr} / 100</span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                value={mrmrBaseRmr}
                onChange={(e) => setMrmrBaseRmr(parseInt(e.target.value) || 68)}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Weathering Adjustment Factor:</span>
                <span className="text-cyan-300 font-bold">{mrmrWeatheringPct}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="100"
                value={mrmrWeatheringPct}
                onChange={(e) => setMrmrWeatheringPct(parseInt(e.target.value) || 95)}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Mining Induced Stress Adjustment:</span>
                <span className="text-purple-300 font-bold">{mrmrStressPct}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={mrmrStressPct}
                onChange={(e) => setMrmrStressPct(parseInt(e.target.value) || 85)}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Joint Orientation vs Excavation Axis:</span>
                <span className="text-emerald-300 font-bold">{mrmrOrientationPct}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="100"
                value={mrmrOrientationPct}
                onChange={(e) => setMrmrOrientationPct(parseInt(e.target.value) || 80)}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Blasting Damage Adjustment Factor:</span>
                <span className="text-rose-300 font-bold">{mrmrBlastingPct}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="100"
                value={mrmrBlastingPct}
                onChange={(e) => setMrmrBlastingPct(parseInt(e.target.value) || 90)}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: MATHEWS-POTVIN STOPE STABILITY GRAPH */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Mathews-Potvin Stope Stability Method (N' vs HR)</span>
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                mathewsResult.zone === 'STABLE_UNSUPPORTED' || mathewsResult.zone === 'STABLE_SUPPORTED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : mathewsResult.zone === 'TRANSITION_SLOUGHING'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {mathewsResult.zoneLabel}
            </span>
          </div>

          {/* Interactive Log-Linear Chart */}
          <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden flex flex-col items-center">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-56">
              {/* Stability Zones */}
              {/* Stable Unsupported */}
              <polygon
                points={`${padL},${padT} ${hrToPx(6)},${padT} ${hrToPx(4.5)},${nToPy(20)} ${padL},${nToPy(20)}`}
                fill="#10B981"
                fillOpacity="0.20"
              />
              {/* Stable with Support */}
              <polygon
                points={`${padL},${nToPy(20)} ${hrToPx(4.5)},${nToPy(20)} ${hrToPx(8)},${nToPy(3)} ${padL},${nToPy(3)}`}
                fill="#06B6D4"
                fillOpacity="0.20"
              />
              {/* Transition / Sloughing */}
              <polygon
                points={`${padL},${nToPy(3)} ${hrToPx(8)},${nToPy(3)} ${hrToPx(13)},${nToPy(0.3)} ${padL},${nToPy(0.3)}`}
                fill="#F59E0B"
                fillOpacity="0.20"
              />
              {/* Caving */}
              <polygon
                points={`${padL},${nToPy(0.3)} ${hrToPx(13)},${nToPy(0.3)} ${svgW - padR},${padT} ${svgW - padR},${svgH - padB} ${padL},${svgH - padB}`}
                fill="#EF4444"
                fillOpacity="0.18"
              />

              {/* Grid Lines */}
              {[0.1, 1, 10, 100, 1000].map((nVal) => {
                const py = nToPy(nVal);
                return (
                  <g key={`y-grid-${nVal}`}>
                    <line x1={padL} y1={py} x2={svgW - padR} y2={py} stroke="#334155" strokeWidth="0.8" />
                    <text x={padL - 6} y={py + 3} fill="#94A3B8" fontSize="8" textAnchor="end">
                      {nVal}
                    </text>
                  </g>
                );
              })}

              {[0, 3, 6, 9, 12, 15, 18].map((hrVal) => {
                const px = hrToPx(hrVal);
                return (
                  <g key={`x-grid-${hrVal}`}>
                    <line x1={px} y1={padT} x2={px} y2={svgH - padB} stroke="#334155" strokeWidth="0.8" />
                    <text x={px} y={svgH - padB + 14} fill="#94A3B8" fontSize="8" textAnchor="middle">
                      {hrVal}m
                    </text>
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text x={svgW / 2} y={svgH - 8} fill="#E2E8F0" fontSize="9" fontWeight="bold" textAnchor="middle">
                Hydraulic Radius HR (m) = Area / Perimeter
              </text>
              <text
                x={14}
                y={svgH / 2}
                fill="#E2E8F0"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                transform={`rotate(-90 14 ${svgH / 2})`}
              >
                Stability Number N' (Log)
              </text>

              {/* Zone Annotations */}
              <text x={hrToPx(2.5)} y={nToPy(120)} fill="#34D399" fontSize="8" fontWeight="bold">
                STABLE
              </text>
              <text x={hrToPx(3.5)} y={nToPy(8)} fill="#38BDF8" fontSize="8" fontWeight="bold">
                SUPPORTED
              </text>
              <text x={hrToPx(5)} y={nToPy(0.8)} fill="#FBBF24" fontSize="8" fontWeight="bold">
                TRANSITION
              </text>
              <text x={hrToPx(13)} y={nToPy(10)} fill="#F87171" fontSize="8" fontWeight="bold">
                CAVING
              </text>

              {/* Plotted Stope Operating Point */}
              <circle
                cx={currentPtX}
                cy={currentPtY}
                r="7"
                fill="#F59E0B"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                className="animate-pulse"
              />
              <text
                x={currentPtX + 10}
                y={currentPtY + 3}
                fill="#FFFFFF"
                fontSize="9"
                fontWeight="bold"
              >
                Face Point (HR={hydraulicRadiusM.toFixed(2)}m, N'={mathewsResult.stabilityNumberN.toFixed(1)})
              </text>
            </svg>
          </div>

          {/* Mathews Factor Adjustments */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <label className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block">RQD (%):</span>
              <input
                type="number"
                min="10"
                max="100"
                value={miningRqd}
                onChange={(e) => setMiningRqd(parseInt(e.target.value) || 85)}
                className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 font-bold"
              />
            </label>
            <label className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block">Stress Factor A:</span>
              <input
                type="number"
                step="0.05"
                value={stressFactorA}
                onChange={(e) => setStressFactorA(parseFloat(e.target.value) || 0.85)}
                className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold"
              />
            </label>
            <label className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block">Joint Factor B:</span>
              <input
                type="number"
                step="0.05"
                value={jointFactorB}
                onChange={(e) => setJointFactorB(parseFloat(e.target.value) || 0.5)}
                className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-purple-300 font-bold"
              />
            </label>
            <label className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] block">Gravity Factor C:</span>
              <input
                type="number"
                step="0.5"
                value={gravityFactorC}
                onChange={(e) => setGravityFactorC(parseFloat(e.target.value) || 4.0)}
                className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold"
              />
            </label>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
            <strong className="text-slate-200 block">Stope Recommendation:</strong>
            <p>{mathewsResult.supportRecommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
