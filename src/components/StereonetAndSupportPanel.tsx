import React, { useMemo, useState } from 'react';
import {
  GsiCalculationResult,
  Joint,
  JointSet,
  QIndexParameters,
  RmrCalculationResult,
  RockMassClassificationMethodId,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { ValidatedQSystemResult } from '../engine/rockMassClassificationEngine';
import {
  buildLongitudinalChainageStrip,
  calculateEmpiricalSupportDesign,
  computeStereonetPlaneProjection,
  evaluateKinematicWedges,
  exportMappedGeologicalSheetToDXF,
} from '../engine/stereonetAndSupportEngine';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Download,
  Droplets,
  Layers,
  Shield,
  TrendingUp,
} from 'lucide-react';

interface StereonetAndSupportPanelProps {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  qParams: QIndexParameters;
  qResult: ValidatedQSystemResult;
  rmrResult: RmrCalculationResult;
  gsiResult: GsiCalculationResult;
  selectedMethod: RockMassClassificationMethodId;
  savedProjects?: SavedProjectRecord[];
  compact?: boolean;
}

const StereonetAndSupportPanelComponent: React.FC<StereonetAndSupportPanelProps> = ({
  geometry,
  settings,
  joints,
  jointSets,
  qParams,
  qResult,
  rmrResult,
  gsiResult,
  selectedMethod,
  savedProjects = [],
  compact = false,
}) => {
  const [frictionAngleDeg, setFrictionAngleDeg] = useState<number>(32);

  // Build stereonet planes from active joint sets (or individual joints if no sets yet)
  const stereonetPlanes = useMemo(() => {
    const activeSets = jointSets.filter((js) => {
      const count = joints.filter((j) => j.set === js.id).length;
      return count > 0 || js.id === 'J1' || js.id === 'J2' || js.id === 'J3';
    });

    return activeSets.map((js) =>
      computeStereonetPlaneProjection(
        js.id,
        `${js.id} (${js.orientation})`,
        js.color || '#38BDF8',
        js.avgDip || 60,
        js.avgDipDirection || 130,
        settings.driveDirection || 70
      )
    );
  }, [jointSets, joints, settings.driveDirection]);

  // Evaluate pairwise kinematic wedges
  const wedges = useMemo(
    () =>
      evaluateKinematicWedges(
        stereonetPlanes,
        settings.driveDirection || 70,
        frictionAngleDeg
      ),
    [stereonetPlanes, settings.driveDirection, frictionAngleDeg]
  );

  // Empirical support design (Barton Q & RMR89)
  const supportRec = useMemo(
    () =>
      calculateEmpiricalSupportDesign(
        qParams,
        qResult,
        rmrResult,
        geometry,
        selectedMethod
      ),
    [qParams, qResult, rmrResult, geometry, selectedMethod]
  );

  // Longitudinal chainage strip log
  const chainageStrip = useMemo(
    () => buildLongitudinalChainageStrip(savedProjects, settings, qResult, rmrResult),
    [savedProjects, settings, qResult, rmrResult]
  );

  // Stereonet SVG helper: unit [-1, 1] -> pixel [cx, cy]
  const netSize = 260;
  const cx0 = netSize / 2;
  const cy0 = netSize / 2;
  const radiusPx = 104;

  const toNetPx = (pt: { x: number; y: number }) => ({
    x: cx0 + pt.x * radiusPx,
    y: cy0 - pt.y * radiusPx,
  });

  // Drive azimuth endpoints on stereonet
  const driveRad = ((settings.driveDirection || 0) * Math.PI) / 180;
  const driveTip = {
    x: cx0 + Math.sin(driveRad) * (radiusPx + 8),
    y: cy0 - Math.cos(driveRad) * (radiusPx + 8),
  };
  const driveTail = {
    x: cx0 - Math.sin(driveRad) * radiusPx,
    y: cy0 + Math.cos(driveRad) * radiusPx,
  };

  // Friction circle radius on Equal-Area Schmidt net (plunge = frictionAngleDeg)
  const frictionZenithRad = ((90 - frictionAngleDeg) * Math.PI) / 180;
  const frictionRadiusPx = Math.SQRT2 * Math.sin(frictionZenithRad / 2) * radiusPx;

  // Barton Q-Chart SVG coordinates: X = log10(Q) in [-3, 3] -> [0.001 .. 1000], Y = log10(De) in [0, 1.8] -> [1 .. 63m]
  const chartW = 340;
  const chartH = 195;
  const padL = 42;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const qToChartX = (q: number) => {
    const logQ = Math.max(-3, Math.min(3, Math.log10(Math.max(0.001, q))));
    return padL + ((logQ + 3) / 6) * plotW;
  };

  const deToChartY = (de: number) => {
    const logDe = Math.max(0, Math.min(1.8, Math.log10(Math.max(1, de))));
    return padT + plotH - (logDe / 1.8) * plotH;
  };

  const activeQx = qToChartX(qResult.qValue || 4.0);
  const activeDeY = deToChartY(supportRec.equivalentDimensionDe);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* ====================================================================
          HEADER BAR WITH ONE-CLICK DXF SHEET EXPORT
         ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/95 border border-slate-700/80">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="font-bold text-white text-xs sm:text-sm">
              KINEMATIC STEREONET, EMPIRICAL SUPPORT &amp; CHAINAGE LOG
            </div>
            <div className="text-[10px] text-slate-400">
              Equal-Area Lower-Hemisphere Schmidt Net · Wedge Stability · Barton Q &amp; RMR89 Support · AutoCAD DXF Export
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            exportMappedGeologicalSheetToDXF(
              geometry,
              settings,
              joints,
              jointSets,
              qResult,
              rmrResult,
              gsiResult,
              selectedMethod
            )
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Mapped Sheet (.DXF)
        </button>
      </div>

      {/* ====================================================================
          ROW 1: STEREONET & KINEMATIC WEDGES (LEFT) + EMPIRICAL SUPPORT (RIGHT)
         ==================================================================== */}
      <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2'} gap-4`}>
        {/* 1. LOWER-HEMISPHERE SCHMIDT STEREONET & WEDGE KINEMATICS */}
        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              1. SCHMIDT STEREONET &amp; KEYBLOCK WEDGE CHECK
            </span>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span>Joint Friction φ:</span>
              <input
                type="number"
                min={15}
                max={50}
                value={frictionAngleDeg}
                onChange={(e) =>
                  setFrictionAngleDeg(Math.max(15, Math.min(50, Number(e.target.value) || 32)))
                }
                className="w-12 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-bold"
              />
              <span>°</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Stereonet SVG */}
            <div className="flex flex-col items-center justify-center bg-[#070B12] border border-slate-800 rounded p-2">
              <svg viewBox={`0 0 ${netSize} ${netSize}`} className="w-full max-w-[240px] h-auto">
                {/* Outer Primitive Circle */}
                <circle
                  cx={cx0}
                  cy={cy0}
                  r={radiusPx}
                  fill="#0B111E"
                  stroke="#475569"
                  strokeWidth="1.6"
                />
                {/* 30 deg and 60 deg plunge reference rings */}
                <circle
                  cx={cx0}
                  cy={cy0}
                  r={radiusPx * 0.707}
                  fill="none"
                  stroke="#1E293B"
                  strokeDasharray="3,3"
                />
                <circle
                  cx={cx0}
                  cy={cy0}
                  r={radiusPx * 0.38}
                  fill="none"
                  stroke="#1E293B"
                  strokeDasharray="3,3"
                />
                {/* Friction Cone Circle */}
                <circle
                  cx={cx0}
                  cy={cy0}
                  r={frictionRadiusPx}
                  fill="rgba(245, 158, 11, 0.06)"
                  stroke="#F59E0B"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                />
                {/* N-S and E-W Crosshairs */}
                <line
                  x1={cx0}
                  y1={cy0 - radiusPx}
                  x2={cx0}
                  y2={cy0 + radiusPx}
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <line
                  x1={cx0 - radiusPx}
                  y1={cy0}
                  x2={cx0 + radiusPx}
                  y2={cy0}
                  stroke="#1E293B"
                  strokeWidth="1"
                />

                {/* Cardinal Labels */}
                <text x={cx0} y={16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8">
                  N (000°)
                </text>
                <text
                  x={cx0}
                  y={netSize - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748B"
                >
                  S (180°)
                </text>
                <text
                  x={netSize - 10}
                  y={cy0 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748B"
                >
                  E
                </text>
                <text x={10} y={cy0 + 3} textAnchor="middle" fontSize="9" fill="#64748B">
                  W
                </text>

                {/* Tunnel Drive Direction Axis */}
                <line
                  x1={driveTail.x}
                  y1={driveTail.y}
                  x2={driveTip.x}
                  y2={driveTip.y}
                  stroke="#22D3EE"
                  strokeWidth="1.8"
                  strokeDasharray="5,3"
                />
                <circle cx={driveTip.x} cy={driveTip.y} r="4" fill="#22D3EE" />
                <text
                  x={driveTip.x}
                  y={driveTip.y - 6}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#22D3EE"
                >
                  DRIVE {settings.driveDirection.toFixed(0)}°
                </text>

                {/* Great Circles & Poles for Joint Sets */}
                {stereonetPlanes.map((pl) => {
                  const pathCmd = pl.greatCirclePoints
                    .map((pt, idx) => {
                      const p = toNetPx(pt);
                      return `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                    })
                    .join(' ');
                  const polePx = toNetPx(pl.polePoint);

                  return (
                    <g key={pl.id}>
                      <path
                        d={pathCmd}
                        fill="none"
                        stroke={pl.color}
                        strokeWidth="2"
                        opacity="0.9"
                      />
                      <circle
                        cx={polePx.x}
                        cy={polePx.y}
                        r="4"
                        fill={pl.color}
                        stroke="#0F172A"
                        strokeWidth="1.2"
                      />
                      <text
                        x={polePx.x + 6}
                        y={polePx.y + 3}
                        fontSize="8.5"
                        fontWeight="700"
                        fill={pl.color}
                      >
                        {pl.id}
                      </text>
                    </g>
                  );
                })}

                {/* Wedge Intersection Points (I_ij) */}
                {wedges.map((w) => {
                  const ipx = toNetPx(w.schmidtPoint);
                  const fillCol =
                    w.riskLevel === 'CRITICAL'
                      ? '#EF4444'
                      : w.riskLevel === 'MODERATE'
                      ? '#F59E0B'
                      : '#10B981';
                  return (
                    <g key={w.id}>
                      <polygon
                        points={`${ipx.x},${ipx.y - 5} ${ipx.x + 5},${ipx.y + 4} ${ipx.x - 5},${
                          ipx.y + 4
                        }`}
                        fill={fillCol}
                        stroke="#FFFFFF"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="text-[10px] text-slate-400 text-center mt-1">
                ▲ Triangles = Wedge Intersections · Dashed Circle = φ ({frictionAngleDeg}°)
              </div>
            </div>

            {/* Kinematic Wedge Table & Unfolded Continuity */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-200">
                Wedge Intersections ({wedges.length})
              </div>
              {wedges.length === 0 ? (
                <div className="p-2.5 rounded bg-slate-900 text-slate-400 text-[11px]">
                  At least 2 joint sets are needed to compute wedge intersections.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                  {wedges.map((w) => (
                    <div
                      key={w.id}
                      className={`p-2 rounded border text-[10px] space-y-1 ${
                        w.riskLevel === 'CRITICAL'
                          ? 'bg-rose-950/40 border-rose-600/60 text-rose-100'
                          : w.riskLevel === 'MODERATE'
                          ? 'bg-amber-950/40 border-amber-600/60 text-amber-100'
                          : 'bg-emerald-950/30 border-emerald-700/50 text-emerald-100'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          {w.setALabel.split(' ')[0]} × {w.setBLabel.split(' ')[0]}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/40">
                          Plunge {w.plungeDeg}° / Trend {w.trendDeg}° (FS≈{w.factorOfSafetyEstimate})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold">
                        {w.riskLevel === 'CRITICAL' ? (
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                        <span>{w.kinematicMode.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-slate-300 leading-snug">{w.engineeringNote}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unfolded Perimeter Continuity & Groundwater Inflow */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-cyan-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Unfolded Perimeter Projection &amp; Seepage Inflow
              </span>
              <span className="flex items-center gap-1 text-sky-300">
                <Droplets className="w-3.5 h-3.5" />
                {supportRec.seepageInflowEstimateLpm}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {stereonetPlanes.map((pl) => (
                <div
                  key={pl.id}
                  className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px]"
                >
                  <div className="font-bold" style={{ color: pl.color }}>
                    {pl.label} — Strike {pl.strikeDeg.toFixed(0)}°
                  </div>
                  <div className="text-slate-300 mt-0.5">{pl.perimeterContinuitySummary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. EMPIRICAL SUPPORT RECOMMENDATION CHART & SCHEDULE */}
        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              2. EMPIRICAL SUPPORT DESIGN ({supportRec.methodBasis})
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px]">
              Span={supportRec.spanMeters.toFixed(2)}m · ESR={supportRec.esr} · De=
              {supportRec.equivalentDimensionDe}m
            </span>
          </div>

          {/* Barton Q vs De Support Chart SVG */}
          <div className="bg-[#070B12] border border-slate-800 rounded p-2">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
              {/* Background Support Category Zones */}
              <rect
                x={padL}
                y={padT}
                width={plotW * 0.33}
                height={plotH}
                fill="rgba(239, 68, 68, 0.12)"
              />
              <rect
                x={padL + plotW * 0.33}
                y={padT}
                width={plotW * 0.33}
                height={plotH}
                fill="rgba(245, 158, 11, 0.10)"
              />
              <rect
                x={padL + plotW * 0.66}
                y={padT}
                width={plotW * 0.34}
                height={plotH}
                fill="rgba(16, 185, 129, 0.10)"
              />

              {/* No-Support Boundary Line: De = 2 * Q^0.4 */}
              <path
                d={[-2, -1, 0, 1, 2, 3]
                  .map((lq, i) => {
                    const qv = Math.pow(10, lq);
                    const deLim = 2 * Math.pow(qv, 0.4);
                    return `${i === 0 ? 'M' : 'L'} ${qToChartX(qv).toFixed(1)} ${deToChartY(
                      deLim
                    ).toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#10B981"
                strokeWidth="1.6"
                strokeDasharray="4,3"
              />

              {/* Axes */}
              <line
                x1={padL}
                y1={padT + plotH}
                x2={padL + plotW}
                y2={padT + plotH}
                stroke="#64748B"
                strokeWidth="1.2"
              />
              <line
                x1={padL}
                y1={padT}
                x2={padL}
                y2={padT + plotH}
                stroke="#64748B"
                strokeWidth="1.2"
              />

              {/* Log Q X-Ticks */}
              {[0.001, 0.01, 0.1, 1, 10, 100, 1000].map((qv) => {
                const tx = qToChartX(qv);
                return (
                  <g key={`qtick-${qv}`}>
                    <line
                      x1={tx}
                      y1={padT}
                      x2={tx}
                      y2={padT + plotH}
                      stroke="#1E293B"
                      strokeWidth="0.8"
                    />
                    <text
                      x={tx}
                      y={chartH - 12}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="#94A3B8"
                    >
                      {qv}
                    </text>
                  </g>
                );
              })}

              {/* Log De Y-Ticks */}
              {[1, 2, 5, 10, 20, 50].map((dev) => {
                const ty = deToChartY(dev);
                return (
                  <g key={`detick-${dev}`}>
                    <line
                      x1={padL}
                      y1={ty}
                      x2={padL + plotW}
                      y2={ty}
                      stroke="#1E293B"
                      strokeWidth="0.8"
                    />
                    <text
                      x={padL - 5}
                      y={ty + 3}
                      textAnchor="end"
                      fontSize="8.5"
                      fill="#94A3B8"
                    >
                      {dev}m
                    </text>
                  </g>
                );
              })}

              {/* Zone Labels */}
              <text x={padL + 10} y={padT + 14} fontSize="8.5" fontWeight="700" fill="#FCA5A5">
                Cat 7–9: RRS / Ribs + SFRS
              </text>
              <text
                x={padL + plotW * 0.36}
                y={padT + 14}
                fontSize="8.5"
                fontWeight="700"
                fill="#FDE68A"
              >
                Cat 4–6: Bolts + SFRS
              </text>
              <text
                x={padL + plotW * 0.7}
                y={padT + 14}
                fontSize="8.5"
                fontWeight="700"
                fill="#6EE7B7"
              >
                Cat 1–3: Spot / Bolts
              </text>

              {/* Current Station Operating Point (Q, De) */}
              <line
                x1={activeQx}
                y1={padT}
                x2={activeQx}
                y2={padT + plotH}
                stroke="#38BDF8"
                strokeWidth="1.2"
                strokeDasharray="3,2"
              />
              <line
                x1={padL}
                y1={activeDeY}
                x2={padL + plotW}
                y2={activeDeY}
                stroke="#38BDF8"
                strokeWidth="1.2"
                strokeDasharray="3,2"
              />
              <circle
                cx={activeQx}
                cy={activeDeY}
                r="6"
                fill="#22D3EE"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <text
                x={Math.min(chartW - 75, Math.max(padL + 10, activeQx + 8))}
                y={Math.max(padT + 24, activeDeY - 8)}
                fontSize="9"
                fontWeight="700"
                fill="#FFFFFF"
              >
                Station (Q={qResult.qValue.toFixed(2)}, De={supportRec.equivalentDimensionDe}m)
              </text>

              <text
                x={padL + plotW / 2}
                y={chartH - 2}
                textAnchor="middle"
                fontSize="8.5"
                fill="#64748B"
              >
                Rock Mass Quality Q (Log Scale) vs. Equivalent Span De = Span / ESR
              </text>
            </svg>
          </div>

          {/* Support Schedule Grid */}
          <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-700/50 text-emerald-200 font-bold text-xs">
            {supportRec.supportCategoryLabel}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Crown / Wall Bolt Length</div>
              <div className="text-cyan-300 font-bold">
                Crown: {supportRec.crownBoltLengthMeters} m · Wall: {supportRec.wallBoltLengthMeters} m
              </div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Rockbolt Pattern Spacing</div>
              <div className="text-white font-bold">{supportRec.boltSpacingMeters}</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Shotcrete (SFRS) Thickness</div>
              <div className="text-amber-300 font-bold">{supportRec.shotcreteThicknessMm}</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Steel Ribs / Girders</div>
              <div className="text-white font-bold">{supportRec.steelRibsOrGirderSpec}</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Recommended Pull / Round</div>
              <div className="text-emerald-300 font-bold">{supportRec.excavationRoundLengthRec}</div>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800">
              <div className="text-slate-400 text-[10px]">Max Unsupported Span</div>
              <div className="text-cyan-300 font-bold">
                Dmax = {supportRec.maxUnsupportedSpanMeters} m ({supportRec.standUpTimeEstimate})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          ROW 2: LONGITUDINAL CHAINAGE STRIP LOG (MULTI-ROUND COMPARISON)
         ==================================================================== */}
      <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-cyan-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            3. LONGITUDINAL CHAINAGE STRIP LOG ({settings.tunnelName} — {chainageStrip.length}{' '}
            Station{chainageStrip.length === 1 ? '' : 's'})
          </span>
          <span className="text-[10px] text-slate-400">
            Compares RMR, Q-Value, RQD &amp; Support Class along Tunnel Alignment
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <th className="py-1.5 px-2.5">Chainage / RD</th>
                <th className="py-1.5 px-2.5">RQD (%)</th>
                <th className="py-1.5 px-2.5">RMR Score</th>
                <th className="py-1.5 px-2.5">Barton Q</th>
                <th className="py-1.5 px-2.5">Quality / Support Class</th>
                <th className="py-1.5 px-2.5 w-44">Visual Quality Bar</th>
              </tr>
            </thead>
            <tbody>
              {chainageStrip.map((st) => {
                const qualityPct =
                  st.rmrValue !== null
                    ? Math.max(5, Math.min(100, st.rmrValue))
                    : st.qValue !== null
                    ? Math.max(5, Math.min(100, ((Math.log10(st.qValue) + 2) / 5) * 100))
                    : st.rqdValue;
                return (
                  <tr
                    key={st.id}
                    className={`border-b border-slate-800/70 ${
                      st.isCurrentStation ? 'bg-cyan-950/40 font-bold' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="py-1.5 px-2.5 text-cyan-300">
                      {st.chainageLabel}{' '}
                      {st.isCurrentStation && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-cyan-600 text-white text-[9px]">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2.5 text-white">{st.rqdValue}%</td>
                    <td className="py-1.5 px-2.5 text-emerald-300">
                      {st.rmrValue !== null ? st.rmrValue : '—'}
                    </td>
                    <td className="py-1.5 px-2.5 text-amber-300">
                      {st.qValue !== null ? st.qValue.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-200">{st.supportClassShort}</td>
                    <td className="py-1.5 px-2.5">
                      <div className="w-full h-2.5 bg-slate-800 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            qualityPct >= 60
                              ? 'bg-emerald-500'
                              : qualityPct >= 35
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${qualityPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const StereonetAndSupportPanel = React.memo(StereonetAndSupportPanelComponent);
