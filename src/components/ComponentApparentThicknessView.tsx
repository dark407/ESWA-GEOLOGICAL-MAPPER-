// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 4: COMPONENT-SPECIFIC APPARENT THICKNESS & SPACING
// 6 Distinct Tunnel Components (Axis, Horizontal Face, Vertical, 2D Face, 2D Sidewall, Borehole)
// Terzaghi Blind-Zone Warning (< 0.25) & Bidirectional Forward/Reverse Solver
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Compass,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Info,
  Sliders,
  ArrowRightLeft,
  Eye,
} from 'lucide-react';
import {
  computeAllComponentApparentThicknessAndSpacing,
  solveTrueFromApparent,
  ComponentApparentResult,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface ComponentApparentThicknessViewProps {
  tTrueDefault?: number;
  sTrueDefault?: number;
  betaDefault?: number;
  thetaDipDefault?: number;
  alphaDriveDefault?: number;
  gammaDriveDefault?: number;
}

export const ComponentApparentThicknessView: React.FC<ComponentApparentThicknessViewProps> = ({
  tTrueDefault = 0.85,
  sTrueDefault = 0.45,
  betaDefault = 65,
  thetaDipDefault = 135,
  alphaDriveDefault = 45,
  gammaDriveDefault = 0,
}) => {
  const [solverMode, setSolverMode] = useState<'FORWARD_TRUE_TO_APPARENT' | 'REVERSE_APPARENT_TO_TRUE'>('FORWARD_TRUE_TO_APPARENT');

  // Forward Mode Inputs
  const [tTrue, setTTrue] = useState<number>(tTrueDefault);
  const [sTrue, setSTrue] = useState<number>(sTrueDefault);
  const [beta, setBeta] = useState<number>(betaDefault);
  const [thetaDip, setThetaDip] = useState<number>(thetaDipDefault);
  const [alphaDrive, setAlphaDrive] = useState<number>(alphaDriveDefault);
  const [gammaDrive, setGammaDrive] = useState<number>(gammaDriveDefault);
  const [phiBh, setPhiBh] = useState<number>(45);
  const [thetaBh, setThetaBh] = useState<number>(15);

  // Reverse Mode Inputs
  const [reverseComponentIdx, setReverseComponentIdx] = useState<0 | 1 | 2 | 3 | 4 | 5>(3); // 2D Face Plane
  const [measuredApparentThickness, setMeasuredApparentThickness] = useState<number>(1.25);
  const [measuredApparentSpacing, setMeasuredApparentSpacing] = useState<number>(0.65);

  const forwardResult = useMemo(() => {
    return computeAllComponentApparentThicknessAndSpacing({
      tTrue,
      sTrue,
      beta,
      thetaDip,
      alphaDrive,
      gammaDrive,
      phiBh,
      thetaBh,
    });
  }, [tTrue, sTrue, beta, thetaDip, alphaDrive, gammaDrive, phiBh, thetaBh]);

  const reverseResult = useMemo(() => {
    const solvedT = solveTrueFromApparent(
      measuredApparentThickness,
      reverseComponentIdx,
      beta,
      thetaDip,
      alphaDrive,
      gammaDrive,
      phiBh,
      thetaBh
    );
    const solvedS = solveTrueFromApparent(
      measuredApparentSpacing,
      reverseComponentIdx,
      beta,
      thetaDip,
      alphaDrive,
      gammaDrive,
      phiBh,
      thetaBh
    );
    return {
      trueThicknessM: solvedT.trueValue,
      trueSpacingM: solvedS.trueValue,
      factor: solvedT.directionalFactor,
    };
  }, [
    measuredApparentThickness,
    measuredApparentSpacing,
    reverseComponentIdx,
    beta,
    thetaDip,
    alphaDrive,
    gammaDrive,
    phiBh,
    thetaBh,
  ]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Ruler className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              Component-Specific Apparent Thickness &amp; Joint Spacing Calculator
            </h3>
            <p className="text-xs text-slate-400">
              Rigorous 3D Directional Cosines across 6 excavation surfaces + Terzaghi orientation correction
            </p>
          </div>
        </div>

        {/* MODE SWITCHER */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono text-xs">
          <button
            onClick={() => setSolverMode('FORWARD_TRUE_TO_APPARENT')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold cursor-pointer transition-all ${
              solverMode === 'FORWARD_TRUE_TO_APPARENT'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Forward: True ➔ Apparent
          </button>
          <button
            onClick={() => setSolverMode('REVERSE_APPARENT_TO_TRUE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold cursor-pointer transition-all ${
              solverMode === 'REVERSE_APPARENT_TO_TRUE'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Reverse: Apparent ➔ True
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 flex-1 overflow-y-auto">
        {/* LEFT COLUMN: INTERACTIVE SLIDERS */}
        <div className="lg:col-span-4 space-y-3 bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Structure &amp; Heading Parameters
            </span>
            <span className="text-[10px] text-cyan-400">Fed from NATM Live</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">True Dip (β): {beta}°</label>
              <input
                type="range"
                min={5}
                max={89}
                value={beta}
                onChange={(e) => setBeta(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">Dip Direction (θ): {thetaDip}°</label>
              <input
                type="range"
                min={0}
                max={360}
                value={thetaDip}
                onChange={(e) => setThetaDip(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">Drive Azimuth (α): {alphaDrive}°</label>
              <input
                type="range"
                min={0}
                max={360}
                value={alphaDrive}
                onChange={(e) => setAlphaDrive(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">Tunnel Gradient (γ): {gammaDrive}°</label>
              <input
                type="range"
                min={-15}
                max={15}
                value={gammaDrive}
                onChange={(e) => setGammaDrive(Number(e.target.value))}
                className="w-full accent-slate-400"
              />
            </div>
          </div>

          {solverMode === 'FORWARD_TRUE_TO_APPARENT' ? (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-0.5">True Thickness (t_true): {tTrue.toFixed(2)}m</label>
                  <input
                    type="range"
                    min={0.05}
                    max={4.0}
                    step={0.05}
                    value={tTrue}
                    onChange={(e) => setTTrue(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-0.5">True Joint Spacing (S_true): {sTrue.toFixed(2)}m</label>
                  <input
                    type="range"
                    min={0.05}
                    max={3.0}
                    step={0.05}
                    value={sTrue}
                    onChange={(e) => setSTrue(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800 space-y-2 bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <span className="font-bold text-cyan-300 block text-[11px]">
                Reverse Mode: Component Measurement
              </span>
              <div>
                <label className="text-slate-400 text-[10px] block mb-1">Measured Surface Component:</label>
                <select
                  value={reverseComponentIdx}
                  onChange={(e) => setReverseComponentIdx(Number(e.target.value) as any)}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200"
                >
                  <option value={0}>0: Longitudinal Tunnel Axis</option>
                  <option value={1}>1: Horizontal Face Scanline</option>
                  <option value={2}>2: Vertical Face Scanline</option>
                  <option value={3}>3: 2D Face Plane (Photo Trace Width)</option>
                  <option value={4}>4: 2D Sidewall Plane</option>
                  <option value={5}>5: Inclined Borehole Core Scanline</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-0.5">Measured Apparent Thickness (m):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={measuredApparentThickness}
                    onChange={(e) => setMeasuredApparentThickness(Math.max(0.01, Number(e.target.value)))}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-0.5">Measured Apparent Spacing (m):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={measuredApparentSpacing}
                    onChange={(e) => setMeasuredApparentSpacing(Math.max(0.01, Number(e.target.value)))}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div className="mt-2 p-2 rounded bg-cyan-950/60 border border-cyan-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">True Thickness (t_true):</span>
                  <strong className="text-emerald-400 text-sm">{reverseResult.trueThicknessM} m</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">True Joint Spacing (S_true):</span>
                  <strong className="text-emerald-400 text-sm">{reverseResult.trueSpacingM} m</strong>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Component Cosine Factor:</span>
                  <span>{reverseResult.factor.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}

          {/* BOREHOLE SCANLINE SETTINGS */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-slate-400 text-[10px] block mb-1">
              Component 6: Ahead Borehole Orientation
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 text-[9px] block">BH Azimuth: {phiBh}°</label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={phiBh}
                  onChange={(e) => setPhiBh(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-500 text-[9px] block">BH Plunge: {thetaBh}°</label>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={thetaBh}
                  onChange={(e) => setThetaBh(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 6 COMPONENT BREAKDOWN CARDS & VISUAL DILATION BARS */}
        <div className="lg:col-span-8 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {forwardResult.components.map((comp, idx) => {
              const isSelectedReverse = solverMode === 'REVERSE_APPARENT_TO_TRUE' && reverseComponentIdx === idx;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border font-mono transition-all ${
                    isSelectedReverse
                      ? 'bg-cyan-950/50 border-cyan-500 shadow-md ring-1 ring-cyan-400'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-cyan-300">
                        {idx + 1}
                      </span>
                      {comp.component}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      cos = {comp.directionalCosine}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 mb-2">{comp.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Apparent Thickness</span>
                      <strong className="text-amber-300">{comp.apparentThicknessM} m</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Apparent Spacing</span>
                      <strong className="text-cyan-300">{comp.apparentSpacingM} m</strong>
                    </div>
                  </div>

                  {/* Dilation progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Dilation Multiplier:</span>
                      <strong className={comp.dilationMultiplier > 3 ? 'text-rose-400' : 'text-slate-300'}>
                        {comp.dilationMultiplier}× True
                      </strong>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          comp.dilationMultiplier > 4
                            ? 'bg-rose-500'
                            : comp.dilationMultiplier > 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (comp.dilationMultiplier / 5) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {comp.isBlindZoneWarning && (
                    <div className="mt-2 p-1.5 rounded bg-rose-950/80 border border-rose-600/70 text-[10px] text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>Terzaghi Blind-Zone Warning (cos α &lt; 0.25). Severe sub-sampling of discontinuity!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SUMMARY TERZAGHI & NORMAL VECTOR BANNER */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">3D Plane Normal in Tunnel Space:</span>
              <strong className="text-cyan-300">
                n = [{forwardResult.normalVector.nx}, {forwardResult.normalVector.ny}, {forwardResult.normalVector.nz}]
              </strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Borehole Terzaghi Weighting Factor:</span>
              <strong className="text-emerald-400">{forwardResult.terzaghiWeight}×</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">True Linear Frequency:</span>
              <strong className="text-amber-300">{forwardResult.trueLinearFrequencyPerMeter} joints/m</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
