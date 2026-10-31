// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 2: PROJECTING WEAK ZONES BEYOND HEADINGS
// Longitudinal Profile Diagram, Crown/Invert Entry Chainage,
// Total Exposure Length, and Ahead-of-Face Blast Round Forecasting
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Compass,
  Ruler,
  Sliders,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  projectWeakZoneBeyondHeading,
  WeakZoneProjectionResult,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface WeakZoneAheadProjectorViewProps {
  zFaceDefault?: number;
  alphaDriveDefault?: number;
  hTunnelDefault?: number;
  betaDefault?: number;
  thetaDipDefault?: number;
  tTrueDefault?: number;
  lPullDefault?: number;
  lithologyName?: string;
}

export const WeakZoneAheadProjectorView: React.FC<WeakZoneAheadProjectorViewProps> = ({
  zFaceDefault = 102.5,
  alphaDriveDefault = 45,
  hTunnelDefault = 7.2,
  betaDefault = 68,
  thetaDipDefault = 140,
  tTrueDefault = 1.6,
  lPullDefault = 3.0,
  lithologyName = 'Crushed Quartzite Fault Gouge',
}) => {
  const [zFace, setZFace] = useState<number>(zFaceDefault);
  const [alphaDrive, setAlphaDrive] = useState<number>(alphaDriveDefault);
  const [gammaDrive, setGammaDrive] = useState<number>(0);
  const [beta, setBeta] = useState<number>(betaDefault);
  const [thetaDip, setThetaDip] = useState<number>(thetaDipDefault);
  const [tTrue, setTTrue] = useState<number>(tTrueDefault);
  const [yObs, setYObs] = useState<number>(3.6);
  const [hTunnel, setHTunnel] = useState<number>(hTunnelDefault);
  const [lPull, setLPull] = useState<number>(lPullDefault);
  const [zoneType, setZoneType] = useState<string>('Fault / Mylonite Shear Band');

  const projection: WeakZoneProjectionResult = useMemo(() => {
    return projectWeakZoneBeyondHeading({
      zFace,
      alphaDrive,
      gammaDrive,
      beta,
      thetaDip,
      tTrue,
      yObs,
      hTunnel,
      lPull,
      zoneType,
    });
  }, [zFace, alphaDrive, gammaDrive, beta, thetaDip, tTrue, yObs, hTunnel, lPull, zoneType]);

  // Diagram scaling for SVG Longitudinal Profile
  const zMin = zFace - 4;
  const zMax = Math.max(zFace + 28, projection.exitChainage + 6);
  const zSpan = zMax - zMin;
  const svgWidth = 820;
  const svgHeight = 260;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const toPxX = (z: number) => padLeft + ((z - zMin) / zSpan) * plotWidth;
  const toPxY = (y: number) => padTop + plotHeight - (y / hTunnel) * plotHeight;

  // Longitudinal Profile Coordinates
  const xFace = toPxX(zFace);
  const xCrown = toPxX(projection.zCrown);
  const xInvert = toPxX(projection.zInvert);

  // Fault band polygon projected onto longitudinal section (HW and FW)
  // Perpendicular offset in longitudinal profile = t_true / sin(psi)
  const lExposureHalf = projection.lTunnelExposure * 0.5;
  const centerEntry = (projection.zCrown + projection.zInvert) * 0.5;
  const xEntryHwCrown = toPxX(projection.zCrown);
  const xEntryHwInvert = toPxX(projection.zInvert);
  const deltaLongitudinal = projection.tTrue / Math.max(0.1, projection.sinPsi);
  const xExitFwCrown = toPxX(projection.zCrown + deltaLongitudinal);
  const xExitFwInvert = toPxX(projection.zInvert + deltaLongitudinal);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              Weak Zone Beyond-Heading Projector &amp; Daylighting Solver
            </h3>
            <p className="text-xs text-slate-400">
              Forward spatial projection of 3D Fault/Shear planes ahead of current heading (Z &gt; Z_face)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-cyan-300">
            Z_face: <strong>RD {zFace.toFixed(1)}m</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-amber-300">
            Azimuth: <strong>N {Math.round(alphaDrive)}° E</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 flex-1 overflow-y-auto">
        {/* LEFT COLUMN: INTERACTIVE GEOMETRICAL & STRUCTURAL CONTROLS */}
        <div className="lg:col-span-4 space-y-3 bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Discontinuity &amp; Drive Controls
            </span>
            <span className="text-[10px] text-emerald-400">Fed from NATM Live</span>
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Feature Category</label>
            <input
              type="text"
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">True Dip (β): {beta}°</label>
              <input
                type="range"
                min={10}
                max={88}
                value={beta}
                onChange={(e) => setBeta(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">True Dip Dir (θ): {thetaDip}°</label>
              <input
                type="range"
                min={0}
                max={360}
                value={thetaDip}
                onChange={(e) => setThetaDip(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">True Thickness (t_true): {tTrue.toFixed(1)}m</label>
              <input
                type="range"
                min={0.2}
                max={6.0}
                step={0.1}
                value={tTrue}
                onChange={(e) => setTTrue(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">Observed Height (Y_obs): {yObs.toFixed(1)}m</label>
              <input
                type="range"
                min={0.5}
                max={hTunnel - 0.5}
                step={0.1}
                value={yObs}
                onChange={(e) => setYObs(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <div>
              <label className="text-slate-400 text-[10px] block mb-0.5">Tunnel Drive Az (α): {alphaDrive}°</label>
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
              <label className="text-slate-400 text-[10px] block mb-0.5">Pull Length (L_pull): {lPull.toFixed(1)}m</label>
              <input
                type="range"
                min={1.0}
                max={4.5}
                step={0.5}
                value={lPull}
                onChange={(e) => setLPull(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* KEY MATHEMATICAL OUTPUT CARD */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>Relative Strike Angle (δ):</span>
              <strong className="text-amber-300">{projection.deltaDeg}°</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Acute Intersect Angle (ψ):</span>
              <strong className="text-cyan-300">{projection.acuteIntersectionAnglePsiDeg}° (sin ψ = {projection.sinPsi})</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Crown Entry Chainage:</span>
              <strong className="text-rose-400">RD {projection.zCrown.toFixed(2)}m</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Invert Entry Chainage:</span>
              <strong className="text-indigo-300">RD {projection.zInvert.toFixed(2)}m</strong>
            </div>
            <div className="flex justify-between text-slate-300 font-bold border-t border-slate-800 pt-1">
              <span>Total Fault Exposure:</span>
              <span className="text-emerald-400">{projection.lTunnelExposure.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Ahead Blast Rounds:</span>
              <span className="text-amber-400 font-bold">{projection.nRounds} rounds inside zone</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SVG LONGITUDINAL PROFILE DIAGRAM & HAZARD ADVISORY */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-rose-400" /> Longitudinal Profile: Heading &amp; Weak Zone Forward Daylighting
              </span>
              <span className="text-slate-400 text-[11px]">
                {projection.isApproachingFromCrown ? 'Daylights at CROWN First ➔ INVERT' : 'Daylights at INVERT First ➔ CROWN'}
              </span>
            </div>

            {/* SVG LONGITUDINAL SECTION (WHITE ENGINEERING CANVAS) */}
            <div className="w-full flex-1 min-h-[220px] flex items-center justify-center overflow-x-auto py-2 bg-white border border-slate-300 rounded-lg">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-h-[300px] bg-white">
                <rect width={svgWidth} height={svgHeight} fill="#ffffff" />
                {/* Background Grid */}
                <defs>
                  <pattern id="longGrid" width="40" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.9" />
                  </pattern>
                  <linearGradient id="faultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#be123c" stopOpacity="0.14" />
                  </linearGradient>
                </defs>
                <rect x={padLeft} y={padTop} width={plotWidth} height={plotHeight} fill="url(#longGrid)" stroke="#cbd5e1" strokeWidth="1" />

                {/* Tunnel Crown Line (Top) & Invert Line (Bottom) */}
                <line x1={padLeft} y1={padTop} x2={padLeft + plotWidth} y2={padTop} stroke="#0284c7" strokeWidth="2.5" />
                <line x1={padLeft} y1={padTop + plotHeight} x2={padLeft + plotWidth} y2={padTop + plotHeight} stroke="#0369a1" strokeWidth="2.5" />
                <text x={padLeft + 8} y={padTop - 8} fill="#0369a1" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  Crown Apex (Y = {hTunnel}m)
                </text>
                <text x={padLeft + 8} y={padTop + plotHeight + 16} fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  Invert Datum (Y = 0.0m)
                </text>

                {/* Excavated Tunnel Body (to left of Z_face) */}
                <rect
                  x={padLeft}
                  y={padTop}
                  width={Math.max(0, xFace - padLeft)}
                  height={plotHeight}
                  fill="rgba(2, 132, 199, 0.08)"
                />

                {/* Unexcavated Ahead Ground (to right of Z_face) */}
                <rect
                  x={xFace}
                  y={padTop}
                  width={plotWidth - (xFace - padLeft)}
                  height={plotHeight}
                  fill="rgba(241, 245, 249, 0.55)"
                />

                {/* PROJECTED WEAK ZONE BAND (HW to FW) */}
                <polygon
                  points={`${xEntryHwCrown},${padTop} ${xExitFwCrown},${padTop} ${xExitFwInvert},${padTop + plotHeight} ${xEntryHwInvert},${padTop + plotHeight}`}
                  fill="url(#faultGrad)"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />

                {/* CURRENT TUNNEL FACE BULKHEAD AT Z_face */}
                <line
                  x1={xFace}
                  y1={padTop}
                  x2={xFace}
                  y2={padTop + plotHeight}
                  stroke="#d97706"
                  strokeWidth="3.5"
                />
                <circle cx={xFace} cy={toPxY(yObs)} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="1.5" />
                <text x={xFace - 6} y={padTop - 12} textAnchor="end" fill="#b45309" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  Current Face (Z = {zFace.toFixed(1)}m)
                </text>

                {/* Crown Intersection Marker */}
                <circle cx={xCrown} cy={padTop} r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                <text x={xCrown} y={padTop - 10} textAnchor="middle" fill="#b91c1c" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  Z_crown ({projection.zCrown.toFixed(1)}m)
                </text>

                {/* Invert Intersection Marker */}
                <circle cx={xInvert} cy={padTop + plotHeight} r="4.5" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
                <text x={xInvert} y={padTop + plotHeight + 18} textAnchor="middle" fill="#3730a3" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  Z_invert ({projection.zInvert.toFixed(1)}m)
                </text>

                {/* UPCOMING BLAST ROUNDS GRID AHEAD */}
                {Array.from({ length: 8 }, (_, rIdx) => {
                  const rZ = zFace + (rIdx + 1) * lPull;
                  const rx = toPxX(rZ);
                  if (rx > padLeft + plotWidth) return null;
                  const isInsideWeakZone = rZ >= projection.entryChainage && rZ <= projection.exitChainage;
                  return (
                    <g key={rIdx}>
                      <line
                        x1={rx}
                        y1={padTop}
                        x2={rx}
                        y2={padTop + plotHeight}
                        stroke={isInsideWeakZone ? '#dc2626' : '#94a3b8'}
                        strokeWidth={isInsideWeakZone ? '1.8' : '1'}
                        strokeDasharray={isInsideWeakZone ? '2 2' : '3 3'}
                      />
                      <text x={rx - 2} y={padTop + plotHeight - 6} textAnchor="end" fill={isInsideWeakZone ? '#b91c1c' : '#475569'} fontSize="9" fontFamily="monospace" fontWeight="bold">
                        R{rIdx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Chainage Axis ticks */}
                {Array.from({ length: 7 }, (_, idx) => {
                  const zVal = zMin + (idx * zSpan) / 6;
                  const xPos = toPxX(zVal);
                  return (
                    <g key={idx}>
                      <line x1={xPos} y1={padTop + plotHeight} x2={xPos} y2={padTop + plotHeight + 6} stroke="#475569" strokeWidth="1.2" />
                      <text x={xPos} y={padTop + plotHeight + 30} textAnchor="middle" fill="#1e293b" fontSize="10" fontFamily="monospace" fontWeight="bold">
                        {zVal.toFixed(0)}m
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* HAZARD ADVISORY CARD */}
          <div className="bg-slate-950/90 border border-rose-500/40 rounded-xl p-3 text-xs font-mono">
            <div className="flex items-center gap-2 mb-1.5 text-rose-400 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Forward Geological Hazard Advisory &amp; Recommended NATM Support Adaptation:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {projection.hazardSummary}
            </p>
            <div className="mt-2.5 pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Crown Intersect Distance:</span>
                <strong className="text-rose-400">
                  {Math.abs(projection.zCrown - zFace).toFixed(1)}m ahead of face
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Invert Intersect Distance:</span>
                <strong className="text-indigo-400">
                  {Math.abs(projection.zInvert - zFace).toFixed(1)}m ahead of face
                </strong>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Pre-Support Protocol:</span>
                <strong className="text-amber-300">
                  {projection.lTunnelExposure > 10 ? 'Forepoling Canopy + Invert Arch' : 'Spiling Bolts + 150mm SFRS'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
