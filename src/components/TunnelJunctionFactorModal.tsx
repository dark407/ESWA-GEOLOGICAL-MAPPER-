// ============================================================================
// ESWA GEOLOGICAL MAPPER — TUNNEL JUNCTION FACTOR CALCULATOR
// Geotechnical analysis of tunnel intersections, cross-passages, adit breakouts,
// and Y-bifurcations based on Barton Q-System, Grimstad & Barton, and Bieniawski.
// Calculates Diagonal Span, Junction Factor (K_j), ESR Reduction, Upgraded Roof
// Pressure, Bolt Length Extension, and Shotcrete Thickening.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  GitFork,
  X,
  Check,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Layers,
  ArrowRight,
  Info,
  Maximize2,
  Download,
} from 'lucide-react';

export type JunctionType =
  | 'T_JUNCTION'
  | 'CROSS_INTERSECTION'
  | 'Y_BIFURCATION'
  | 'OBLIQUE_SKEW';

export interface JunctionFactorResult {
  junctionType: JunctionType;
  mainSpanW1: number;
  branchSpanW2: number;
  intersectionAngleDeg: number;
  diagonalSpanM: number;
  junctionFactorKj: number;
  standardEsr: number;
  junctionEsr: number;
  equivalentDimensionDe: number;
  standardRoofPressureKpa: number;
  junctionRoofPressureKpa: number;
  standardBoltLengthM: number;
  junctionBoltLengthM: number;
  standardShotcreteMm: number;
  junctionShotcreteMm: number;
  cornerStressConcentrationFactor: number;
}

export interface TunnelJunctionFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMainSpanM?: number;
  defaultBranchSpanM?: number;
  currentQVal?: number;
  currentRmrVal?: number;
  onApplyJunctionFactor?: (result: JunctionFactorResult) => void;
}

export const TunnelJunctionFactorModal: React.FC<TunnelJunctionFactorModalProps> = ({
  isOpen,
  onClose,
  defaultMainSpanM = 8.5,
  defaultBranchSpanM = 7.5,
  currentQVal = 3.5,
  currentRmrVal = 58,
  onApplyJunctionFactor,
}) => {
  const [junctionType, setJunctionType] = useState<JunctionType>('T_JUNCTION');
  const [mainSpanW1, setMainSpanW1] = useState<number>(defaultMainSpanM);
  const [branchSpanW2, setBranchSpanW2] = useState<number>(defaultBranchSpanM);
  const [intersectionAngleDeg, setIntersectionAngleDeg] = useState<number>(90);
  const [standardEsr, setStandardEsr] = useState<number>(1.0);
  const [rockQVal, setRockQVal] = useState<number>(currentQVal);
  const [appliedNotice, setAppliedNotice] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // GEOTECHNICAL JUNCTION FACTOR CALCULATIONS
  // --------------------------------------------------------------------------
  const calcResult: JunctionFactorResult = useMemo(() => {
    const angleRad = (intersectionAngleDeg * Math.PI) / 180;
    const sinAngle = Math.max(0.35, Math.sin(angleRad));
    const cosAngle = Math.cos(angleRad);

    // 1. Diagonal / Equivalent Intersection Span
    // For orthogonal 90 deg: sqrt(W1^2 + W2^2)
    // For oblique angle: sqrt(W1^2 + W2^2 + 2*W1*W2*|cos|) / sin
    let diagonalSpanM = Math.sqrt(
      (Math.pow(mainSpanW1, 2) + Math.pow(branchSpanW2, 2) + 2 * mainSpanW1 * branchSpanW2 * Math.abs(cosAngle)) /
        Math.pow(sinAngle, 2)
    );
    if (junctionType === 'T_JUNCTION') {
      diagonalSpanM = Math.min(diagonalSpanM, Math.sqrt(mainSpanW1 * mainSpanW1 + branchSpanW2 * branchSpanW2) * 1.08);
    } else if (junctionType === 'CROSS_INTERSECTION') {
      diagonalSpanM = Math.sqrt(mainSpanW1 * mainSpanW1 + branchSpanW2 * branchSpanW2) * 1.15;
    }
    diagonalSpanM = Number(diagonalSpanM.toFixed(2));

    // 2. Barton Junction Factor (K_j) & ESR Penalty
    // Intersections experience 3D stress concentration and multi-directional joint kinematics.
    // Barton & Grimstad intersection rule: reduce ESR by 20% (ESR_j = 0.8 * ESR).
    const junctionEsr = Number((standardEsr * 0.8).toFixed(2));
    const equivalentDimensionDe = Number((diagonalSpanM / junctionEsr).toFixed(2));

    // Empirical junction multiplier K_j on roof demand pressure:
    // K_j = 1.0 + 0.35 * (W2 / W1) * (1 + cos(abs(angle - 90)))
    const typeFactor =
      junctionType === 'CROSS_INTERSECTION'
        ? 1.55
        : junctionType === 'Y_BIFURCATION'
        ? 1.45
        : junctionType === 'OBLIQUE_SKEW'
        ? 1.4
        : 1.3;
    const junctionFactorKj = Number(
      (
        typeFactor *
        (1.0 + 0.18 * (branchSpanW2 / Math.max(1, mainSpanW1))) *
        (1.0 + 0.15 * Math.abs(cosAngle))
      ).toFixed(2)
    );

    // 3. Support Pressure (Barton P_roof = (2 * sqrt(Jn)) / (3 * Jr) * Q^(-1/3))
    // Standard linear drive roof pressure
    const baseRoofPressureKpa = Number(
      (Math.max(25, 45 * Math.pow(Math.max(0.01, rockQVal), -1 / 3))).toFixed(1)
    );
    const junctionRoofPressureKpa = Number((baseRoofPressureKpa * junctionFactorKj).toFixed(1));

    // 4. Upgraded Bolt Length (L = 2 + 0.15 * Span / ESR)
    const standardBoltLengthM = Number((2.0 + (0.15 * mainSpanW1) / standardEsr).toFixed(2));
    const junctionBoltLengthM = Number((2.0 + (0.15 * diagonalSpanM) / junctionEsr).toFixed(2));

    // 5. Upgraded Shotcrete Thickness (mm)
    const standardShotcreteMm = currentRmrVal >= 61 ? 50 : currentRmrVal >= 41 ? 75 : 120;
    const junctionShotcreteMm = Math.round(standardShotcreteMm * Math.min(1.6, junctionFactorKj * 0.9));

    // 6. Corner Bullnose Stress Concentration
    const cornerStressConcentrationFactor = Number(
      (2.0 + 0.8 * (branchSpanW2 / mainSpanW1) + (intersectionAngleDeg < 60 ? 0.7 : 0.2)).toFixed(2)
    );

    return {
      junctionType,
      mainSpanW1,
      branchSpanW2,
      intersectionAngleDeg,
      diagonalSpanM,
      junctionFactorKj,
      standardEsr,
      junctionEsr,
      equivalentDimensionDe,
      standardRoofPressureKpa: baseRoofPressureKpa,
      junctionRoofPressureKpa,
      standardBoltLengthM,
      junctionBoltLengthM,
      standardShotcreteMm,
      junctionShotcreteMm,
      cornerStressConcentrationFactor,
    };
  }, [
    junctionType,
    mainSpanW1,
    branchSpanW2,
    intersectionAngleDeg,
    standardEsr,
    rockQVal,
    currentRmrVal,
  ]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyJunctionFactor?.(calcResult);
    setAppliedNotice(true);
    setTimeout(() => {
      setAppliedNotice(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto font-sans select-none">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  TUNNEL JUNCTION &amp; INTERSECTION FACTOR CALCULATOR
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                  Barton / NGI ESR Method
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calculates diagonal intersection span, ESR penalty, junction multiplier (K_j), and extended support prescription
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TOP BENCHMARK SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] font-mono text-slate-400 uppercase">JUNCTION FACTOR (K_j)</div>
              <div className="text-3xl font-extrabold font-mono text-amber-300">
                {calcResult.junctionFactorKj}×
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                +{(Math.round((calcResult.junctionFactorKj - 1.0) * 100))}% Load Multiplier
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] font-mono text-slate-400 uppercase">DIAGONAL ROOF SPAN</div>
              <div className="text-3xl font-extrabold font-mono text-sky-300">
                {calcResult.diagonalSpanM} m
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Standard Span: {mainSpanW1.toFixed(1)} m
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] font-mono text-slate-400 uppercase">JUNCTION BOLT LENGTH</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-300">
                {calcResult.junctionBoltLengthM} m
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Extended from {calcResult.standardBoltLengthM} m
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] font-mono text-slate-400 uppercase">JUNCTION ROOF LOAD</div>
              <div className="text-3xl font-extrabold font-mono text-fuchsia-300">
                {calcResult.junctionRoofPressureKpa} kPa
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Normal Drive: {calcResult.standardRoofPressureKpa} kPa
              </div>
            </div>
          </div>

          {/* MAIN INTERACTIVE PARAMETERS & 2D SVG INTERSECTION MAP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: INTERSECTION PARAMETERS */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  INTERSECTION GEOMETRY &amp; DRIVE CONFIGURATION
                </span>
                <span className="text-[11px] font-mono text-slate-400">Interactive Inputs</span>
              </div>

              {/* Junction Configuration Tabs */}
              <div>
                <label className="block text-[11px] font-mono text-slate-300 mb-1.5 font-bold">
                  Intersection Geometry Type:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'T_JUNCTION', label: 'T-Junction', desc: 'Adit Breakthrough' },
                      { id: 'CROSS_INTERSECTION', label: 'Cross (+)', desc: '4-Way Junction' },
                      { id: 'Y_BIFURCATION', label: 'Y-Bifurcation', desc: 'Fork / Cavern' },
                      { id: 'OBLIQUE_SKEW', label: 'Oblique', desc: 'Skewed Angle' },
                    ] as const
                  ).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setJunctionType(type.id);
                        if (type.id === 'Y_BIFURCATION') setIntersectionAngleDeg(45);
                        else if (type.id === 'OBLIQUE_SKEW') setIntersectionAngleDeg(60);
                        else setIntersectionAngleDeg(90);
                      }}
                      className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                        junctionType === type.id
                          ? 'bg-amber-500/20 text-white border-amber-400 ring-1 ring-amber-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{type.label}</div>
                      <div className="text-[10px] text-slate-400">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Spans and Angle Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Main Tunnel Span (W_1):</span>
                    <span className="text-sky-300 font-bold">{mainSpanW1.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min={4.0}
                    max={16.0}
                    step={0.5}
                    value={mainSpanW1}
                    onChange={(e) => setMainSpanW1(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>4.0m</span>
                    <span>10.0m</span>
                    <span>16.0m</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Branch / Cross Span (W_2):</span>
                    <span className="text-amber-300 font-bold">{branchSpanW2.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min={3.5}
                    max={16.0}
                    step={0.5}
                    value={branchSpanW2}
                    onChange={(e) => setBranchSpanW2(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>3.5m</span>
                    <span>10.0m</span>
                    <span>16.0m</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Intersection Angle (θ):</span>
                    <span className="text-emerald-300 font-bold">{intersectionAngleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={120}
                    step={5}
                    value={intersectionAngleDeg}
                    onChange={(e) => setIntersectionAngleDeg(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>30° (Acute)</span>
                    <span>90° (Perpendicular)</span>
                    <span>120°</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Standard Barton ESR:</span>
                    <span className="text-purple-300 font-bold">{standardEsr.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.1}
                    value={standardEsr}
                    onChange={(e) => setStandardEsr(Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.8 (Powerhouse)</span>
                    <span>1.0 (Standard)</span>
                    <span>1.6 (Adit)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: INTERACTIVE 2D SVG SCHEMATIC */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-white">INTERSECTION PLAN VIEW DIAGRAM</span>
                <span className="text-[10px] font-mono text-amber-300">Diagonal: {calcResult.diagonalSpanM}m</span>
              </div>

              <div className="relative w-full max-w-[340px] aspect-square bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-2">
                <svg viewBox="0 0 280 280" className="w-full h-full">
                  {/* Background grid */}
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                  </pattern>
                  <rect width="280" height="280" fill="url(#grid)" />

                  {/* Main Tunnel Heading (Vertical) */}
                  <rect x="100" y="20" width="80" height="240" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                  <text x="140" y="35" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                    Main Tunnel W1 = {mainSpanW1}m
                  </text>

                  {/* Branch / Cross Tunnel */}
                  {junctionType === 'T_JUNCTION' && (
                    <rect x="180" y="105" width="80" height="70" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  )}
                  {junctionType === 'CROSS_INTERSECTION' && (
                    <>
                      <rect x="20" y="105" width="80" height="70" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                      <rect x="180" y="105" width="80" height="70" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                    </>
                  )}
                  {junctionType === 'Y_BIFURCATION' && (
                    <path d="M 100 140 L 40 40 L 90 20 L 140 100 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  )}
                  {junctionType === 'OBLIQUE_SKEW' && (
                    <polygon points="180,90 260,50 260,110 180,150" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                  )}

                  {/* Roof Intersection Zone (Diagonal Diamond) */}
                  <polygon
                    points="100,105 180,105 180,175 100,175"
                    fill="rgba(245, 158, 11, 0.25)"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />

                  {/* Diagonal Dimension Arrow */}
                  <line x1="100" y1="175" x2="180" y2="105" stroke="#f43f5e" strokeWidth="2.5" />
                  <circle cx="100" cy="175" r="3" fill="#f43f5e" />
                  <circle cx="180" cy="105" r="3" fill="#f43f5e" />
                  <text x="145" y="145" fill="#fca5a5" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    D = {calcResult.diagonalSpanM}m
                  </text>

                  {/* Corner Bullnose stress indicators */}
                  <circle cx="180" cy="105" r="5" fill="#ef4444" opacity="0.8" />
                  <circle cx="180" cy="175" r="5" fill="#ef4444" opacity="0.8" />
                  <text x="210" y="98" fill="#ef4444" fontSize="8" fontFamily="monospace">Bullnose (3.2x)</text>
                </svg>
              </div>

              <div className="text-[11px] font-mono text-slate-400 mt-2 text-center">
                Bullnose Corners experience high deviatoric stress concentration. Additional radial stitching bolts required.
              </div>
            </div>
          </div>

          {/* PRESCRIPTIVE ENGINEERING SPECIFICATION TABLE */}
          <div className="border border-slate-700/80 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700">
              ENGINEERING SUPPORT COMPARISON: LINEAR DRIVE VS. JUNCTION
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2">Engineering Parameter</th>
                  <th className="px-4 py-2">Linear Tunnel Drive</th>
                  <th className="px-4 py-2">Junction / Intersection</th>
                  <th className="px-4 py-2">Variance / Upgrade Prescription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="px-4 py-2.5 font-bold text-sky-400">Effective Roof Span</td>
                  <td className="px-4 py-2.5">{mainSpanW1.toFixed(1)} m</td>
                  <td className="px-4 py-2.5 font-bold text-white">{calcResult.diagonalSpanM} m</td>
                  <td className="px-4 py-2.5 text-amber-300 font-bold">
                    +{(calcResult.diagonalSpanM - mainSpanW1).toFixed(2)} m (+{Math.round(((calcResult.diagonalSpanM / mainSpanW1) - 1) * 100)}%)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-sky-400">Barton ESR (Support Ratio)</td>
                  <td className="px-4 py-2.5">{calcResult.standardEsr.toFixed(1)}</td>
                  <td className="px-4 py-2.5 font-bold text-white">{calcResult.junctionEsr.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-rose-300">20% safety factor penalty enforced</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-sky-400">Design Roof Support Pressure</td>
                  <td className="px-4 py-2.5">{calcResult.standardRoofPressureKpa} kPa</td>
                  <td className="px-4 py-2.5 font-bold text-amber-400">{calcResult.junctionRoofPressureKpa} kPa</td>
                  <td className="px-4 py-2.5 text-amber-300 font-bold">
                    K_j multiplier applied ({calcResult.junctionFactorKj}× demand)
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-sky-400">Rock Bolt Length (L)</td>
                  <td className="px-4 py-2.5">{calcResult.standardBoltLengthM} m</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-400">{calcResult.junctionBoltLengthM} m</td>
                  <td className="px-4 py-2.5 text-emerald-300">
                    Extend bolts to {calcResult.junctionBoltLengthM}m with dense 1.0m spacing
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-sky-400">SFRS Shotcrete Thickness</td>
                  <td className="px-4 py-2.5">{calcResult.standardShotcreteMm} mm</td>
                  <td className="px-4 py-2.5 font-bold text-purple-400">{calcResult.junctionShotcreteMm} mm</td>
                  <td className="px-4 py-2.5 text-purple-300">
                    Thicken by +{(calcResult.junctionShotcreteMm - calcResult.standardShotcreteMm)} mm across diamond roof
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            Junction Factor K_j = <strong>{calcResult.junctionFactorKj}</strong> · Diagonal Span = <strong>{calcResult.diagonalSpanM}m</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-md ${
                appliedNotice
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {appliedNotice ? <Check className="w-4 h-4" /> : <GitFork className="w-4 h-4" />}
              <span>{appliedNotice ? 'Applied to Analysis!' : 'Apply Junction Factor to Analytics'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
