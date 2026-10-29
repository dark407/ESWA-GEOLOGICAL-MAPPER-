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
  solveTrueOrientationFromSurfaceTrace,
  solveTrueOrientationFromTwoSurfaces,
  TrueOrientationSolution,
  TwoSurfaceOrientationSolution,
} from '../engine/orientationEngine';
import {
  evaluateDetailedWedgeAndSupportAdequacy,
  DetailedWedgeEvaluationReport,
  DetailedWedgeAdequacyItem,
} from '../engine/kinematicsSupportAndDxfEngine';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Compass,
  Download,
  Droplets,
  Info,
  Layers,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  Wrench,
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
  const [activeTab, setActiveTab] = useState<
    'stereonet_barton' | 'apparent_dip' | 'wedge_adequacy' | 'chainage_strip'
  >('stereonet_barton');

  const [frictionAngleDeg, setFrictionAngleDeg] = useState<number>(32);

  // --------------------------------------------------------------------------
  // STATE: 4-SURFACE APPARENT-TO-TRUE DIP SOLVER
  // --------------------------------------------------------------------------
  const [apparentSurface, setApparentSurface] = useState<
    'FACE' | 'LEFT_WALL' | 'CROWN' | 'RIGHT_WALL' | 'TWO_SURFACES'
  >('FACE');
  const [apparentTraceAngle, setApparentTraceAngle] = useState<number>(45);
  const [apparentTiltAngle, setApparentTiltAngle] = useState<number>(60);
  const [cornerSurface1, setCornerSurface1] = useState<
    'FACE' | 'LEFT_WALL' | 'CROWN' | 'RIGHT_WALL'
  >('FACE');
  const [cornerTrace1, setCornerTrace1] = useState<number>(35);
  const [cornerSurface2, setCornerSurface2] = useState<
    'FACE' | 'LEFT_WALL' | 'CROWN' | 'RIGHT_WALL'
  >('LEFT_WALL');
  const [cornerTrace2, setCornerTrace2] = useState<number>(55);

  // --------------------------------------------------------------------------
  // STATE: 3D WEDGE SUPPORT ADEQUACY TESTER ("IS IT ENOUGH?")
  // --------------------------------------------------------------------------
  const [boltLengthM, setBoltLengthM] = useState<number>(3.0);
  const [boltSpacingM, setBoltSpacingM] = useState<number>(1.5);
  const [boltCapacityKN, setBoltCapacityKN] = useState<number>(180);
  const [extraSpotBolts, setExtraSpotBolts] = useState<number>(0);
  const [shotcreteThicknessMm, setShotcreteThicknessMm] = useState<number>(75);
  const [shotcreteShearMPa, setShotcreteShearMPa] = useState<number>(1.2);
  const [hasSteelRibs, setHasSteelRibs] = useState<boolean>(false);
  const [steelRibSpacingM, setSteelRibSpacingM] = useState<number>(1.2);
  const [activeWedgeZone, setActiveWedgeZone] = useState<string>('CROWN');

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

  // --------------------------------------------------------------------------
  // CALCULATIONS: APPARENT-TO-TRUE DIP SOLVER
  // --------------------------------------------------------------------------
  const singleSurfaceSolution = useMemo<TrueOrientationSolution>(() => {
    return solveTrueOrientationFromSurfaceTrace({
      surface: apparentSurface === 'TWO_SURFACES' ? 'FACE' : apparentSurface,
      traceAngle2D: apparentTraceAngle,
      surfaceTiltAngle: apparentTiltAngle,
      driveAzimuth: settings.driveDirection || 70,
    });
  }, [apparentSurface, apparentTraceAngle, apparentTiltAngle, settings.driveDirection]);

  const twoSurfaceSolution = useMemo<TwoSurfaceOrientationSolution>(() => {
    return solveTrueOrientationFromTwoSurfaces(
      cornerSurface1,
      cornerTrace1,
      cornerSurface2,
      cornerTrace2,
      settings.driveDirection || 70
    );
  }, [cornerSurface1, cornerTrace1, cornerSurface2, cornerTrace2, settings.driveDirection]);

  const activeOrientationSolution =
    apparentSurface === 'TWO_SURFACES'
      ? {
          dipAngle: twoSurfaceSolution.trueDip,
          dipDirection: twoSurfaceSolution.dipDirection,
          strike: twoSurfaceSolution.strike,
          apparentDipOnFace: twoSurfaceSolution.apparentDipOnFace,
          apparentDipOnLeftWall: twoSurfaceSolution.apparentDipOnLeftWall,
          apparentDipOnRightWall: twoSurfaceSolution.apparentDipOnRightWall,
          crownStrikeTraceAngle: twoSurfaceSolution.crownStrikeTraceAngle,
          rhrFormat: twoSurfaceSolution.rhrFormat,
          quadrantStrikeDip: `${twoSurfaceSolution.rhrFormat} (Calculated from Corner Link)`,
          confidence: twoSurfaceSolution.collinearWarning ? 'ESTIMATED' : 'HIGH',
        }
      : singleSurfaceSolution;

  // 4-Surface breakdown for all active joint sets
  const jointBreakdowns = useMemo(() => {
    const list =
      jointSets.length > 0
        ? jointSets
        : [
            { id: 'J1', orientation: '65°/140°', avgDip: 65, avgDipDirection: 140, color: '#38BDF8' },
            { id: 'J2', orientation: '75°/230°', avgDip: 75, avgDipDirection: 230, color: '#F59E0B' },
            { id: 'J3', orientation: '80°/310°', avgDip: 80, avgDipDirection: 310, color: '#10B981' },
          ];

    return list.map((js) => {
      const sol = solveTrueOrientationFromSurfaceTrace({
        surface: 'FACE',
        traceAngle2D: 0,
        dip: js.avgDip || 60,
        dipDirection: js.avgDipDirection || 130,
        driveAzimuth: settings.driveDirection || 70,
      });
      return {
        id: js.id,
        label: `${js.id}`,
        color: js.color || '#38BDF8',
        sol,
      };
    });
  }, [jointSets, settings.driveDirection]);

  // --------------------------------------------------------------------------
  // CALCULATIONS: 3D WEDGE SUPPORT ADEQUACY REPORT
  // --------------------------------------------------------------------------
  const detailedWedgeReport = useMemo<DetailedWedgeEvaluationReport>(() => {
    return evaluateDetailedWedgeAndSupportAdequacy({
      joints,
      geometry,
      settings,
      supportParams: {
        boltLengthM,
        boltSpacingM,
        boltCapacityKN,
        extraSpotBolts,
        shotcreteThicknessMm,
        shotcreteShearMPa,
        steelRibSpacingM: hasSteelRibs ? steelRibSpacingM : 0,
        frictionAngleDeg,
      },
    });
  }, [
    joints,
    geometry,
    settings,
    boltLengthM,
    boltSpacingM,
    boltCapacityKN,
    extraSpotBolts,
    shotcreteThicknessMm,
    shotcreteShearMPa,
    hasSteelRibs,
    steelRibSpacingM,
    frictionAngleDeg,
  ]);

  const selectedWedgeItem = useMemo(() => {
    return (
      detailedWedgeReport.wedges.find((w) => w.zone === activeWedgeZone) ||
      detailedWedgeReport.wedges[0]
    );
  }, [detailedWedgeReport, activeWedgeZone]);

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
    <div
      className="space-y-4 font-mono text-xs"
      data-window="stereonet-panel"
      data-element-id="stereonet-support-panel-root"
      data-tool="stereonet"
      data-role="region"
    >
      {/* ====================================================================
          HEADER BAR WITH ONE-CLICK DXF SHEET EXPORT
         ==================================================================== */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-900/95 border border-slate-700/80"
        data-element-id="stereonet-header-bar"
      >
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="font-bold text-white text-xs sm:text-sm">
              KINEMATIC STEREONET, EMPIRICAL SUPPORT &amp; CHAINAGE LOG
            </div>
            <div className="text-[10px] text-slate-400">
              Equal-Area Lower-Hemisphere Schmidt Net · 3D Wedge Support Adequacy · 4-Surface Apparent Dip Solver · DXF Export
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow cursor-pointer transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export Mapped Sheet (.DXF)
        </button>
      </div>

      {/* ====================================================================
          TOP NAVIGATION TABS
         ==================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('stereonet_barton')}
          className={`py-2 px-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'stereonet_barton'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-cyan-300" />
          <span>1. Stereonet &amp; Barton Q</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('apparent_dip')}
          className={`py-2 px-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'apparent_dip'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-cyan-300" />
          <span>2. 4-Surface Apparent Dip</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wedge_adequacy')}
          className={`py-2 px-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'wedge_adequacy'
              ? 'bg-amber-600 text-white shadow'
              : 'text-amber-400 hover:text-amber-200 hover:bg-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-amber-300" />
          <span>3. 3D Wedge Support (&ldquo;Is It Enough?&rdquo;)</span>
          {detailedWedgeReport.governingVerdict === 'CRITICAL_UNSAFE' && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chainage_strip')}
          className={`py-2 px-2.5 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'chainage_strip'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-cyan-300" />
          <span>4. Alignment Chainage Log</span>
        </button>
      </div>

      {/* ====================================================================
          TAB 1: STEREONET & KINEMATICS + EMPIRICAL SUPPORT CHART
         ==================================================================== */}
      {activeTab === 'stereonet_barton' && (
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
                  <circle
                    cx={cx0}
                    cy={cy0}
                    r={radiusPx}
                    fill="#0B111E"
                    stroke="#475569"
                    strokeWidth="1.6"
                  />
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
                  <circle
                    cx={cx0}
                    cy={cy0}
                    r={frictionRadiusPx}
                    fill="rgba(245, 158, 11, 0.06)"
                    stroke="#F59E0B"
                    strokeWidth="1"
                    strokeDasharray="4,3"
                  />
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
                  <text x={cx0} y={16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94A3B8">
                    N (000°)
                  </text>
                  <text x={cx0} y={netSize - 6} textAnchor="middle" fontSize="9" fill="#64748B">
                    S (180°)
                  </text>
                  <text x={netSize - 10} y={cy0 + 3} textAnchor="middle" fontSize="9" fill="#64748B">
                    E
                  </text>
                  <text x={10} y={cy0 + 3} textAnchor="middle" fontSize="9" fill="#64748B">
                    W
                  </text>
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

              {/* Kinematic Wedge Table */}
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
                <span className="text-[10px] text-slate-400">
                  Drive: N{settings.driveDirection.toFixed(0)}°E · Pull: {settings.roundLength || 3.5}m
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300 leading-relaxed flex items-start gap-2">
                <Droplets className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  Perimeter continuity active across <strong>Face &lt;-&gt; Left Wall &lt;-&gt; Crown &lt;-&gt; Right Wall</strong>.
                  Joint traces auto-project using 3D plane equations: <span className="text-cyan-300 font-mono">nx(X-X0) + ny(Y-Y0) + nz(Z-Z0) = 0</span>.
                </div>
              </div>
            </div>
          </div>

          {/* 2. BARTON Q-CHART (GRIMSTAD & BARTON 1993) & EMPIRICAL SUPPORT */}
          <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                2. BARTON Q SUPPORT CHART &amp; PRESCRIPTION
              </span>
              <span className="text-[10px] text-slate-400">
                De = Span {geometry.width.toFixed(1)}m / ESR {qParams.esr || 1.0} ={' '}
                {supportRec.equivalentDimensionDe}m
              </span>
            </div>

            {/* Barton Q-Chart SVG */}
            <div className="bg-[#070B12] border border-slate-800 rounded p-2 flex flex-col items-center">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-[340px] h-auto">
                <rect x={padL} y={padT} width={plotW} height={plotH} fill="#0B111E" stroke="#334155" />
                <rect
                  x={padL}
                  y={padT}
                  width={plotW * 0.33}
                  height={plotH}
                  fill="rgba(239, 68, 68, 0.08)"
                />
                <rect
                  x={padL + plotW * 0.33}
                  y={padT}
                  width={plotW * 0.34}
                  height={plotH}
                  fill="rgba(245, 158, 11, 0.08)"
                />
                <rect
                  x={padL + plotW * 0.67}
                  y={padT}
                  width={plotW * 0.33}
                  height={plotH}
                  fill="rgba(16, 185, 129, 0.08)"
                />
                <line
                  x1={padL + plotW * 0.33}
                  y1={padT}
                  x2={padL + plotW * 0.33}
                  y2={padT + plotH}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />
                <line
                  x1={padL + plotW * 0.67}
                  y1={padT}
                  x2={padL + plotW * 0.67}
                  y2={padT + plotH}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />

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
      )}

      {/* ====================================================================
          TAB 2: 4-SURFACE APPARENT-TO-TRUE DIP SOLVER & VERIFIER
         ==================================================================== */}
      {activeTab === 'apparent_dip' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-sm">
                <Calculator className="w-4 h-4" />
                4-Surface Apparent-to-True Dip Solver &amp; Corner-Link (No Compass Needed)
              </span>
              <span className="text-[10px] text-slate-400">
                Drive Azimuth Reference: <strong className="text-cyan-300">N {settings.driveDirection.toFixed(0)}° E</strong>
              </span>
            </div>

            {/* Surface Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold mr-1">Input Surface:</span>
              {(
                [
                  { id: 'FACE', label: 'Tunnel Face (Z=0)' },
                  { id: 'LEFT_WALL', label: 'Left Sidewall' },
                  { id: 'CROWN', label: 'Crown Arch (Roof)' },
                  { id: 'RIGHT_WALL', label: 'Right Sidewall' },
                  { id: 'TWO_SURFACES', label: '2-Surface Corner Link (Compass-Free)' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setApparentSurface(s.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    apparentSurface === s.id
                      ? 'bg-cyan-600 text-white shadow'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Calculator Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {apparentSurface !== 'TWO_SURFACES' ? (
                /* Single Surface Input */
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-3">
                  <div className="font-bold text-cyan-200 text-xs flex items-center justify-between">
                    <span>1. Surface Trace &amp; Rock Tilt Input</span>
                    <span className="text-[10px] text-slate-400">{apparentSurface} Plane</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Apparent Trace Angle on Surface (αapp):</span>
                      <span className="text-cyan-300 font-bold">{apparentTraceAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min={-90}
                      max={180}
                      value={apparentTraceAngle}
                      onChange={(e) => setApparentTraceAngle(Number(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>-90° (Vertical Down)</span>
                      <span>0° (Horizontal)</span>
                      <span>+90° (Vertical Up)</span>
                      <span>180°</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Acute Penetration Tilt Angle into Rock (βtilt):</span>
                      <span className="text-amber-300 font-bold">{apparentTiltAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={apparentTiltAngle}
                      onChange={(e) => setApparentTiltAngle(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>10° (Shallow Break)</span>
                      <span>45° (Shear Fracture)</span>
                      <span>90° (Perpendicular to Wall)</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 bg-black/30 p-2 rounded border border-slate-800/80 leading-relaxed">
                    Geotechnical rule: Traces on a vertical wall show <strong>apparent pitch</strong>.
                    Using the tunnel drive azimuth ({settings.driveDirection.toFixed(0)}°), the 3D normal is reconstructed in true geographic space.
                  </div>
                </div>
              ) : (
                /* Two-Surface Corner Link Input */
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-3">
                  <div className="font-bold text-cyan-200 text-xs flex items-center justify-between">
                    <span>2-Surface Corner Link (Compass-Free Vector Cross-Product)</span>
                    <span className="text-[10px] text-emerald-400 font-bold">100% Mathematical Exact</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Surface 1:</label>
                      <select
                        value={cornerSurface1}
                        onChange={(e) => setCornerSurface1(e.target.value as any)}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-300 font-bold"
                      >
                        <option value="FACE">FACE</option>
                        <option value="LEFT_WALL">LEFT WALL</option>
                        <option value="CROWN">CROWN</option>
                        <option value="RIGHT_WALL">RIGHT WALL</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Trace Angle 1 (°):</label>
                      <input
                        type="number"
                        value={cornerTrace1}
                        onChange={(e) => setCornerTrace1(Number(e.target.value))}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-cyan-300 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Surface 2:</label>
                      <select
                        value={cornerSurface2}
                        onChange={(e) => setCornerSurface2(e.target.value as any)}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                      >
                        <option value="LEFT_WALL">LEFT WALL</option>
                        <option value="CROWN">CROWN</option>
                        <option value="RIGHT_WALL">RIGHT WALL</option>
                        <option value="FACE">FACE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Trace Angle 2 (°):</label>
                      <input
                        type="number"
                        value={cornerTrace2}
                        onChange={(e) => setCornerTrace2(Number(e.target.value))}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold"
                      />
                    </div>
                  </div>

                  {twoSurfaceSolution.collinearWarning && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-600/60 text-rose-200 text-[10px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Warning: Traces are nearly parallel (angle {twoSurfaceSolution.angleBetweenTracesDeg}°). Cross product may have reduced geometric confidence.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Solution Output Card */}
              <div className="p-3 bg-gradient-to-br from-slate-900 to-[#0A1220] border border-cyan-800/60 rounded space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Solved True 3D Orientation
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-200 font-bold text-[10px]">
                    RHR {activeOrientationSolution.rhrFormat}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">True Dip (0°..90°)</div>
                    <div className="text-xl font-bold text-white">
                      {activeOrientationSolution.dipAngle.toFixed(1)}°
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">True Dip Direction (Azimuth)</div>
                    <div className="text-xl font-bold text-cyan-300">
                      {String(Math.round(activeOrientationSolution.dipDirection)).padStart(3, '0')}°
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Strike (RHR)</div>
                    <div className="text-sm font-bold text-emerald-300">
                      {String(Math.round(activeOrientationSolution.strike)).padStart(3, '0')}°
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Quadrant Format</div>
                    <div className="text-sm font-bold text-amber-300 truncate">
                      {activeOrientationSolution.quadrantStrikeDip}
                    </div>
                  </div>
                </div>

                {/* 4-Surface Simultaneous Apparent Projections */}
                <div className="p-2.5 rounded bg-black/40 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                    Simultaneous 4-Surface Apparent Traces:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="p-1 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Tunnel Face</div>
                      <div className="text-cyan-300 font-bold">{activeOrientationSolution.apparentDipOnFace}°</div>
                    </div>
                    <div className="p-1 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Left Wall</div>
                      <div className="text-amber-300 font-bold">{activeOrientationSolution.apparentDipOnLeftWall}°</div>
                    </div>
                    <div className="p-1 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Crown Arch</div>
                      <div className="text-emerald-300 font-bold">{activeOrientationSolution.crownStrikeTraceAngle}°</div>
                    </div>
                    <div className="p-1 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Right Wall</div>
                      <div className="text-amber-300 font-bold">{activeOrientationSolution.apparentDipOnRightWall}°</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table: 4-Surface Breakdown for all Mapped Joint Sets */}
          <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5" />
                Active Discontinuity Sets — 4-Surface Apparent Angle Schedule
              </span>
              <span className="text-[10px] text-slate-400">
                Drive Direction: {settings.driveDirection.toFixed(0)}°
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <th className="py-1.5 px-2.5">Joint Set</th>
                    <th className="py-1.5 px-2.5">True Orientation (Dip / Dir)</th>
                    <th className="py-1.5 px-2.5">RHR Strike</th>
                    <th className="py-1.5 px-2.5">Apparent on Face (Z=0)</th>
                    <th className="py-1.5 px-2.5">Apparent on Left Wall</th>
                    <th className="py-1.5 px-2.5">Apparent on Crown</th>
                    <th className="py-1.5 px-2.5">Apparent on Right Wall</th>
                  </tr>
                </thead>
                <tbody>
                  {jointBreakdowns.map((jb) => (
                    <tr
                      key={jb.id}
                      className="border-b border-slate-800/70 hover:bg-slate-900/40"
                    >
                      <td className="py-1.5 px-2.5 font-bold" style={{ color: jb.color }}>
                        {jb.label}
                      </td>
                      <td className="py-1.5 px-2.5 text-white font-bold">
                        {jb.sol.dipAngle.toFixed(0)}° / {String(Math.round(jb.sol.dipDirection)).padStart(3, '0')}°
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-300">
                        {String(Math.round(jb.sol.strike)).padStart(3, '0')}°
                      </td>
                      <td className="py-1.5 px-2.5 text-cyan-300 font-bold">
                        {jb.sol.apparentDipOnFace}°
                      </td>
                      <td className="py-1.5 px-2.5 text-amber-300">
                        {jb.sol.apparentDipOnLeftWall}°
                      </td>
                      <td className="py-1.5 px-2.5 text-emerald-300 font-bold">
                        {jb.sol.crownStrikeTraceAngle}°
                      </td>
                      <td className="py-1.5 px-2.5 text-amber-300">
                        {jb.sol.apparentDipOnRightWall}°
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: 3D WEDGE FAILURE & SUPPORT ADEQUACY TESTER ("IS IT ENOUGH?")
         ==================================================================== */}
      {activeTab === 'wedge_adequacy' && (
        <div className="space-y-4">
          {/* Executive Verdict Banner */}
          <div
            className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
              detailedWedgeReport.governingVerdict === 'SAFE'
                ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-100'
                : detailedWedgeReport.governingVerdict === 'MARGINAL_ADD_SPOT_BOLTS'
                ? 'bg-amber-950/40 border-amber-600/60 text-amber-100'
                : 'bg-rose-950/50 border-rose-600 text-rose-100 animate-pulse'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {detailedWedgeReport.governingVerdict === 'SAFE' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <div className="font-bold text-xs sm:text-sm">
                  GOVERNING 3D WEDGE STATUS: {detailedWedgeReport.governingVerdict.replace(/_/g, ' ')}
                </div>
                <div className="text-[10px] opacity-90">{detailedWedgeReport.executiveSummary}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-black/40 text-xs font-bold border border-white/20">
                Safe: {detailedWedgeReport.safeWedgesCount} · Marginal: {detailedWedgeReport.marginalWedgesCount} · Critical: {detailedWedgeReport.criticalWedgesCount}
              </span>
            </div>
          </div>

          {/* Interactive Engineering Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Control Panel: Support Parameters */}
            <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-cyan-300 text-xs">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Live Support Parameters
                </span>
                <span className="text-[10px] text-slate-400">Interactive Tester</span>
              </div>

              {/* Bolt Length */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Rockbolt Length (Lbolt):</span>
                  <span className="text-cyan-300 font-bold">{boltLengthM.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={6.0}
                  step={0.25}
                  value={boltLengthM}
                  onChange={(e) => setBoltLengthM(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Bolt Spacing */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Pattern Spacing (Sx × Sz):</span>
                  <span className="text-white font-bold">{boltSpacingM.toFixed(1)}m × {boltSpacingM.toFixed(1)}m</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={2.5}
                  step={0.1}
                  value={boltSpacingM}
                  onChange={(e) => setBoltSpacingM(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Bolt Capacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Bolt Type &amp; Yield Capacity:</span>
                  <span className="text-emerald-300 font-bold">{boltCapacityKN} kN</span>
                </div>
                <select
                  value={boltCapacityKN}
                  onChange={(e) => setBoltCapacityKN(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-bold text-[11px]"
                >
                  <option value={120}>Swellex Inflatable (120 kN)</option>
                  <option value={180}>SN Grouted Rebar dia 25mm (180 kN)</option>
                  <option value={220}>Resin Anchored Rebar (220 kN)</option>
                  <option value={250}>Self-Drilling Anchor SDA (250 kN)</option>
                </select>
              </div>

              {/* Extra Spot Bolts */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Extra Spot Bolts on Wedge:</span>
                  <span className="text-amber-300 font-bold">+{extraSpotBolts} Nos</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={extraSpotBolts}
                  onChange={(e) => setExtraSpotBolts(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Shotcrete Thickness */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Shotcrete (SFRS) Thickness:</span>
                  <span className="text-cyan-300 font-bold">{shotcreteThicknessMm} mm</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={250}
                  step={25}
                  value={shotcreteThicknessMm}
                  onChange={(e) => setShotcreteThicknessMm(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Steel Ribs Toggle */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={hasSteelRibs}
                    onChange={(e) => setHasSteelRibs(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Include Steel Ribs / Girders</span>
                </label>
                {hasSteelRibs && (
                  <span className="text-cyan-300 font-bold">@ {steelRibSpacingM}m c/c</span>
                )}
              </div>
            </div>

            {/* Middle Panel: Mini 2D Cross-Section SVG Diagram */}
            <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-cyan-300 text-xs">
                <span>Tunnel Cross-Section &amp; Block Diagram</span>
                <span className="text-[10px] text-slate-400">Scale 1:100</span>
              </div>

              <div className="bg-[#070B12] border border-slate-800 rounded p-2 flex flex-col items-center justify-center flex-1">
                <svg viewBox="0 0 320 220" className="w-full max-w-[280px] h-auto">
                  {/* Outer host rock background */}
                  <rect x="0" y="0" width="320" height="220" fill="#0A0E17" />

                  {/* Excavation Tunnel Profile (Horseshoe Arch) */}
                  <path
                    d="M 60 190 L 60 110 C 60 50, 100 20, 160 20 C 220 20, 260 50, 260 110 L 260 190 Z"
                    fill="#0F172A"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                  />

                  {/* Shotcrete layer */}
                  {shotcreteThicknessMm > 0 && (
                    <path
                      d="M 64 190 L 64 112 C 64 54, 102 24, 160 24 C 218 24, 256 54, 256 112 L 256 190"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth={Math.max(1.5, Math.min(6, shotcreteThicknessMm / 35))}
                      opacity="0.8"
                    />
                  )}

                  {/* Crown Wedge Block (Apex depth h_apex) */}
                  {selectedWedgeItem && (
                    <g>
                      {selectedWedgeItem.zone === 'CROWN' ? (
                        <polygon
                          points={`120,28 200,28 160,${Math.max(
                            4,
                            28 - selectedWedgeItem.apexHeightM * 14
                          )}`}
                          fill="rgba(239, 68, 68, 0.45)"
                          stroke="#EF4444"
                          strokeWidth="2"
                        />
                      ) : selectedWedgeItem.zone === 'LEFT_SHOULDER' ? (
                        <polygon
                          points="62,105 105,45 50,60"
                          fill="rgba(245, 158, 11, 0.45)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                        />
                      ) : selectedWedgeItem.zone === 'RIGHT_SHOULDER' ? (
                        <polygon
                          points="258,105 215,45 270,60"
                          fill="rgba(245, 158, 11, 0.45)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                        />
                      ) : selectedWedgeItem.zone === 'LEFT_WALL' ? (
                        <polygon
                          points="60,120 60,180 30,150"
                          fill="rgba(245, 158, 11, 0.45)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                        />
                      ) : (
                        <polygon
                          points="260,120 260,180 290,150"
                          fill="rgba(245, 158, 11, 0.45)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  )}

                  {/* Rockbolts penetrating perimeter */}
                  <line
                    x1="160"
                    y1="20"
                    x2="160"
                    y2={Math.max(2, 20 - boltLengthM * 14)}
                    stroke={selectedWedgeItem && selectedWedgeItem.isBoltLongEnough ? '#10B981' : '#EF4444'}
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="160"
                    cy={Math.max(2, 20 - boltLengthM * 14)}
                    r="3.5"
                    fill={selectedWedgeItem && selectedWedgeItem.isBoltLongEnough ? '#10B981' : '#EF4444'}
                  />

                  {/* Shoulder bolts */}
                  <line x1="110" y1="45" x2="85" y2="15" stroke="#10B981" strokeWidth="2" />
                  <line x1="210" y1="45" x2="235" y2="15" stroke="#10B981" strokeWidth="2" />

                  {/* Clock Sector Labels */}
                  <text x="160" y="14" textAnchor="middle" fontSize="8" fontWeight="700" fill="#94A3B8">
                    12:00
                  </text>
                  <text x="278" y="115" fontSize="8" fontWeight="700" fill="#94A3B8">
                    03:00
                  </text>
                  <text x="160" y="205" textAnchor="middle" fontSize="8" fontWeight="700" fill="#94A3B8">
                    06:00
                  </text>
                  <text x="42" y="115" textAnchor="end" fontSize="8" fontWeight="700" fill="#94A3B8">
                    09:00
                  </text>
                </svg>
              </div>

              <div className="text-[10px] text-center text-slate-400">
                Red polygon = Block / Wedge (Apex = {selectedWedgeItem ? selectedWedgeItem.apexHeightM : 1.8}m) · Green lines = Installed Bolts ({boltLengthM}m)
              </div>
            </div>

            {/* Right Panel: FoS Before vs After & Anchorage Depth Check */}
            <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-cyan-300 text-xs">
                <span>Active Wedge FoS Gauges</span>
                <select
                  value={activeWedgeZone}
                  onChange={(e) => setActiveWedgeZone(e.target.value)}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-bold text-[10px]"
                >
                  <option value="CROWN">Crown (11:00-01:00)</option>
                  <option value="LEFT_SHOULDER">Left Shoulder</option>
                  <option value="RIGHT_SHOULDER">Right Shoulder</option>
                  <option value="LEFT_WALL">Left Wall</option>
                  <option value="RIGHT_WALL">Right Wall</option>
                </select>
              </div>

              {/* ANCHORAGE DEPTH VERIFICATION ALERT */}
              {selectedWedgeItem && !selectedWedgeItem.isBoltLongEnough ? (
                <div className="p-2.5 rounded bg-rose-950/50 border border-rose-600 text-rose-100 text-[10px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    ANCHORAGE FAILURE DETECTED!
                  </div>
                  <p className="leading-snug">
                    Installed bolt length ({boltLengthM}m) is shorter than Wedge Apex Depth ({selectedWedgeItem.apexHeightM}m) + 0.8m anchor. Bolts are anchored inside the falling block!
                  </p>
                  <div className="text-cyan-300 font-bold">
                    Action: Increase bolt length to ≥ {selectedWedgeItem.minRequiredBoltLengthM}m!
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-950/30 border border-emerald-600/50 text-emerald-200 text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Anchorage OK: Bolt length ({boltLengthM}m) penetrates past wedge apex ({selectedWedgeItem?.apexHeightM}m) into stable rock.</span>
                </div>
              )}

              {/* Side-by-Side FoS Progress Gauges */}
              {selectedWedgeItem && (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-400">Unsupported FoS (Gravity / Slip):</span>
                      <span className="text-rose-400 font-bold font-mono">
                        {selectedWedgeItem.fosBeforeSupport.toFixed(2)} (UNSAFE)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-rose-600"
                        style={{
                          width: `${Math.min(100, (selectedWedgeItem.fosBeforeSupport / 2.0) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-200">Supported FoS (Target ≥ 1.50):</span>
                      <span
                        className={`font-bold font-mono text-sm ${
                          selectedWedgeItem.fosAfterSupport >= 1.5
                            ? 'text-emerald-400'
                            : selectedWedgeItem.fosAfterSupport >= 1.15
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {selectedWedgeItem.fosAfterSupport.toFixed(2)}{' '}
                        {selectedWedgeItem.fosAfterSupport >= 1.5 ? '[SAFE]' : '[INADEQUATE]'}
                      </span>
                    </div>
                    <div className="w-full h-3.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          selectedWedgeItem.fosAfterSupport >= 1.5
                            ? 'bg-emerald-500'
                            : selectedWedgeItem.fosAfterSupport >= 1.15
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (selectedWedgeItem.fosAfterSupport / 2.5) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Wedge Metrics Box */}
              {selectedWedgeItem && (
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Wedge Dead Weight:</span>
                    <strong className="text-white text-xs">{selectedWedgeItem.weightTonnes} Tonnes</strong> ({selectedWedgeItem.weightKN} kN)
                  </div>
                  <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Apex Depth (h_apex):</span>
                    <strong className="text-cyan-300 text-xs">{selectedWedgeItem.apexHeightM} m</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Wedge Schedule & Remedial Spot Bolt Prescriptions */}
          <div className="p-3.5 rounded-lg bg-slate-950/95 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
                <Wrench className="w-3.5 h-3.5" />
                Kinematic Perimeter Wedges &amp; Remedial Spot Bolt Schedule
              </span>
              <span className="text-[10px] text-slate-400">
                Recommended Spot Bolts Required: <strong className="text-amber-300">{detailedWedgeReport.totalRecommendedSpotBolts} Nos</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {detailedWedgeReport.wedges.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setActiveWedgeZone(w.zone)}
                  className={`p-2.5 rounded border text-[11px] space-y-1.5 cursor-pointer transition-colors ${
                    activeWedgeZone === w.zone
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : w.verdict === 'CRITICAL_UNSAFE'
                      ? 'border-rose-700/60 bg-rose-950/20 hover:bg-rose-950/30'
                      : w.verdict === 'MARGINAL_ADD_SPOT_BOLTS'
                      ? 'border-amber-700/60 bg-amber-950/20 hover:bg-amber-950/30'
                      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white">
                      {w.zone} ({w.clockSector})
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] ${
                        w.verdict === 'SAFE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : w.verdict === 'MARGINAL_ADD_SPOT_BOLTS'
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      FoS {w.fosAfterSupport.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-300">
                    Weight: <strong>{w.weightTonnes}t</strong> · Apex: <strong>{w.apexHeightM}m</strong> · Capacity: <strong>{w.totalSupportCapacityKN} kN</strong>
                  </div>

                  <div className="text-[10px] text-slate-400 leading-snug">
                    {w.recommendedExtraSpotBolts > 0 ? (
                      <span className="text-amber-300 font-bold">
                        ⚠️ Add {w.recommendedExtraSpotBolts} spot bolt(s) at {w.clockSector} (L≥{w.minRequiredBoltLengthM}m)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        ✓ Support pattern is adequate (FoS ≥ 1.50)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: LONGITUDINAL CHAINAGE STRIP LOG (MULTI-ROUND COMPARISON)
         ==================================================================== */}
      {(activeTab === 'chainage_strip' || activeTab === 'stereonet_barton') && (
        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {activeTab === 'chainage_strip' ? 'ALIGNMENT CHAINAGE STRIP LOG' : '3. LONGITUDINAL CHAINAGE STRIP LOG'} ({settings.tunnelName} — {chainageStrip.length}{' '}
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
      )}
    </div>
  );
};

export const StereonetAndSupportPanel = React.memo(StereonetAndSupportPanelComponent);
