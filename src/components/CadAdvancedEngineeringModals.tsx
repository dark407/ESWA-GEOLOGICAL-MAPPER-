import React, { useMemo, useState } from 'react';
import {
  Joint,
  JointSet,
  OverbreakUndercutAnalysis,
  Point2D,
  QIndexParameters,
  RmrParameters,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  Download,
  FileSpreadsheet,
  Layers,
  Printer,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

// ============================================================================
// 1. ROCK SUPPORT DESIGN CONFIGURATION & OVERLAY COMPUTATION ENGINE
// ============================================================================

export interface RockSupportDesignConfig {
  enabledOnCanvas: boolean;
  autoSyncFromQAndRmr: boolean;
  boltType: 'SN Grouted Rebar Ø25mm' | 'Swellex / Split-Set Ø28mm' | 'CT-Bolt Tensioned Ø25mm' | 'Self-Drilling IBO Ø32mm';
  boltLengthMeters: number;       // e.g. 3.0m, 4.0m
  inPlaneSpacingMeters: number;   // e.g. 1.5m c/c around arch
  longitudinalSpacingMeters: number; // e.g. 1.5m c/c along tunnel drive
  includeSidewallBolts: boolean;
  includeSpotBoltsForWedges: boolean;
  sfrsThicknessMm: number;        // e.g. 50, 75, 100, 150, 200 mm
  wireMeshReinforced: boolean;
  steelRibsEnabled: boolean;
  steelRibSection: 'ISMB 150' | 'ISMB 200' | 'TH 29 Lattice Girder';
  steelRibSpacingMeters: number;  // e.g. 1.0m, 1.5m
}

export interface ComputedBoltElement {
  id: string;
  collar: Point2D;       // On tunnel boundary (m)
  toe: Point2D;          // Inside rock mass along outward normal (m)
  angleDeg: number;
  lengthMeters: number;
  zone: 'CROWN' | 'LEFT_WALL' | 'RIGHT_WALL' | 'WEDGE_SPOT';
  label: string;
}

export interface ComputedSupportOverlayResult {
  bolts: ComputedBoltElement[];
  sfrsInnerPolygon: Point2D[];
  sfrsOuterPolygon: Point2D[];
  supportCategoryLabel: string;
  boltsPerRing: number;
  ringsPerRound: number;
  totalBoltsPerRound: number;
  totalBoltMeteragePerRound: number;
  sfrsVolumePerRoundM3: number;
  steelRibWeightPerRoundKg: number;
}

export function deriveRecommendedSupportFromQ(
  qValue: number,
  spanMeters: number
): Partial<RockSupportDesignConfig> {
  const safeQ = Math.max(0.01, qValue);
  // Barton ESR = 1.0 for hydro/civil tunnels -> Bolt length L = 2 + 0.15 * B / ESR
  const recBoltLen = Number(Math.max(2.5, Math.min(5.5, 2.0 + 0.15 * spanMeters)).toFixed(1));

  if (safeQ >= 40) {
    return {
      boltLengthMeters: recBoltLen,
      inPlaneSpacingMeters: 2.5,
      longitudinalSpacingMeters: 2.5,
      sfrsThicknessMm: 0,
      wireMeshReinforced: false,
      steelRibsEnabled: false,
      includeSidewallBolts: false,
    };
  } else if (safeQ >= 10) {
    return {
      boltLengthMeters: recBoltLen,
      inPlaneSpacingMeters: 2.0,
      longitudinalSpacingMeters: 2.0,
      sfrsThicknessMm: 50,
      wireMeshReinforced: false,
      steelRibsEnabled: false,
      includeSidewallBolts: true,
    };
  } else if (safeQ >= 4) {
    return {
      boltLengthMeters: recBoltLen,
      inPlaneSpacingMeters: 1.5,
      longitudinalSpacingMeters: 1.5,
      sfrsThicknessMm: 75,
      wireMeshReinforced: true,
      steelRibsEnabled: false,
      includeSidewallBolts: true,
    };
  } else if (safeQ >= 1) {
    return {
      boltLengthMeters: recBoltLen,
      inPlaneSpacingMeters: 1.3,
      longitudinalSpacingMeters: 1.3,
      sfrsThicknessMm: 100,
      wireMeshReinforced: true,
      steelRibsEnabled: false,
      includeSidewallBolts: true,
    };
  } else if (safeQ >= 0.1) {
    return {
      boltLengthMeters: Number((recBoltLen + 0.5).toFixed(1)),
      inPlaneSpacingMeters: 1.2,
      longitudinalSpacingMeters: 1.2,
      sfrsThicknessMm: 150,
      wireMeshReinforced: true,
      steelRibsEnabled: true,
      steelRibSection: 'ISMB 150',
      steelRibSpacingMeters: 1.5,
      includeSidewallBolts: true,
    };
  } else {
    return {
      boltLengthMeters: Number((recBoltLen + 1.0).toFixed(1)),
      inPlaneSpacingMeters: 1.0,
      longitudinalSpacingMeters: 1.0,
      sfrsThicknessMm: 200,
      wireMeshReinforced: true,
      steelRibsEnabled: true,
      steelRibSection: 'ISMB 200',
      steelRibSpacingMeters: 1.0,
      includeSidewallBolts: true,
    };
  }
}

export function createDefaultRockSupportConfig(
  geometry: TunnelGeometry,
  qValue = 6.5
): RockSupportDesignConfig {
  const rec = deriveRecommendedSupportFromQ(qValue, geometry.width);
  return {
    enabledOnCanvas: false,
    autoSyncFromQAndRmr: true,
    boltType: 'SN Grouted Rebar Ø25mm',
    boltLengthMeters: rec.boltLengthMeters ?? 3.5,
    inPlaneSpacingMeters: rec.inPlaneSpacingMeters ?? 1.5,
    longitudinalSpacingMeters: rec.longitudinalSpacingMeters ?? 1.5,
    includeSidewallBolts: rec.includeSidewallBolts ?? true,
    includeSpotBoltsForWedges: true,
    sfrsThicknessMm: rec.sfrsThicknessMm ?? 75,
    wireMeshReinforced: rec.wireMeshReinforced ?? true,
    steelRibsEnabled: rec.steelRibsEnabled ?? false,
    steelRibSection: rec.steelRibSection ?? 'ISMB 150',
    steelRibSpacingMeters: rec.steelRibSpacingMeters ?? 1.5,
  };
}

/**
 * Computes radial rock bolts, SFRS lining ring polygon, and Support BOQ quantities
 * directly from authoritative tunnel cross-section geometry.
 */
export function computeRockSupportPatternOverlay(
  geometry: TunnelGeometry,
  config: RockSupportDesignConfig,
  roundLengthMeters = 3.5,
  qValue = 6.5
): ComputedSupportOverlayResult {
  const pts = geometry.crossSectionPoints || [];
  const center: Point2D = {
    x: 0,
    y: Math.max(1.2, geometry.wallHeight * 0.65),
  };

  // Collect arch + wall segments (skip flat bottom invert segments where y <= 0.15m)
  const archSegments: { p1: Point2D; p2: Point2D; len: number; nx: number; ny: number }[] = [];
  let totalArchPerim = 0;

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) continue;

    // Skip bottom invert floor
    if (midY < 0.18 && Math.abs(dx) > Math.abs(dy) * 1.5) continue;

    // If sidewall bolts disabled, skip lower vertical walls below springline * 0.75
    if (!config.includeSidewallBolts && midY < geometry.wallHeight * 0.75) continue;

    // Compute outward normal pointing away from tunnel center
    let nx = -dy / len;
    let ny = dx / len;
    const midX = (p1.x + p2.x) / 2;
    const toOutX = midX - center.x;
    const toOutY = midY - center.y;
    if (nx * toOutX + ny * toOutY < 0) {
      nx = -nx;
      ny = -ny;
    }

    archSegments.push({ p1, p2, len, nx, ny });
    totalArchPerim += len;
  }

  const spacing = Math.max(0.6, config.inPlaneSpacingMeters);
  const bolts: ComputedBoltElement[] = [];
  let accum = spacing * 0.5;
  let boltIndex = 1;

  for (const seg of archSegments) {
    let segPos = 0;
    while (segPos + accum <= seg.len) {
      segPos += accum;
      accum = spacing;
      const t = segPos / seg.len;
      const cx = seg.p1.x + (seg.p2.x - seg.p1.x) * t;
      const cy = seg.p1.y + (seg.p2.y - seg.p1.y) * t;

      // Radial outward direction blended with segment normal for smooth arch fan
      const radDx = cx - center.x;
      const radDy = cy - center.y;
      const radLen = Math.hypot(radDx, radDy) || 1;
      const ux = seg.nx * 0.65 + (radDx / radLen) * 0.35;
      const uy = seg.ny * 0.65 + (radDy / radLen) * 0.35;
      const uLen = Math.hypot(ux, uy) || 1;
      const fnx = ux / uLen;
      const fny = uy / uLen;

      const tx = cx + fnx * config.boltLengthMeters;
      const ty = cy + fny * config.boltLengthMeters;
      const zone: ComputedBoltElement['zone'] =
        cy >= geometry.wallHeight * 0.92
          ? 'CROWN'
          : cx < 0
          ? 'LEFT_WALL'
          : 'RIGHT_WALL';

      bolts.push({
        id: `RB-${boltIndex}`,
        collar: { x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) },
        toe: { x: Number(tx.toFixed(3)), y: Number(ty.toFixed(3)) },
        angleDeg: Number(((Math.atan2(fny, fnx) * 180) / Math.PI).toFixed(1)),
        lengthMeters: config.boltLengthMeters,
        zone,
        label: `B${boltIndex}`,
      });
      boltIndex++;
    }
    accum -= seg.len - segPos;
  }

  // SFRS outer thickness band polygon
  const sfrsThickM = Math.max(0, config.sfrsThicknessMm / 1000);
  const sfrsInnerPolygon: Point2D[] = [];
  const sfrsOuterPolygon: Point2D[] = [];

  for (const pt of pts) {
    if (pt.y <= 0.08) continue;
    const dx = pt.x - center.x;
    const dy = pt.y - center.y;
    const d = Math.hypot(dx, dy) || 1;
    sfrsInnerPolygon.push({ x: pt.x, y: pt.y });
    sfrsOuterPolygon.push({
      x: Number((pt.x + (dx / d) * sfrsThickM).toFixed(3)),
      y: Number((pt.y + (dy / d) * sfrsThickM).toFixed(3)),
    });
  }

  const pull = Math.max(0.5, roundLengthMeters);
  const ringsPerRound = Math.max(1, Math.round(pull / Math.max(0.5, config.longitudinalSpacingMeters)));
  const boltsPerRing = bolts.length;
  const totalBoltsPerRound = boltsPerRing * ringsPerRound;
  const totalBoltMeteragePerRound = Number((totalBoltsPerRound * config.boltLengthMeters).toFixed(1));
  // Shotcrete volume including 20% rebound & roughness factor
  const sfrsVolumePerRoundM3 = Number((totalArchPerim * pull * sfrsThickM * 1.2).toFixed(2));

  const ribUnitWeightKgPerM =
    config.steelRibSection === 'ISMB 200'
      ? 25.4
      : config.steelRibSection === 'TH 29 Lattice Girder'
      ? 29.0
      : 14.9;
  const ribCountPerRound = config.steelRibsEnabled
    ? Math.max(1, Math.ceil(pull / Math.max(0.5, config.steelRibSpacingMeters)))
    : 0;
  const steelRibWeightPerRoundKg = Number(
    (ribCountPerRound * totalArchPerim * ribUnitWeightKgPerM).toFixed(0)
  );

  const supportCategoryLabel =
    qValue >= 10
      ? 'Category I–II: Spot / Systematic Bolting + 50mm SFRS'
      : qValue >= 4
      ? 'Category III: Systematic Bolting + 75mm SFRS'
      : qValue >= 1
      ? 'Category IV: Systematic Bolting + 100mm SFRS + Mesh'
      : 'Category V–VI: Heavy Support (Bolts + 150–200mm SFRS + Steel Ribs)';

  return {
    bolts,
    sfrsInnerPolygon,
    sfrsOuterPolygon,
    supportCategoryLabel,
    boltsPerRing,
    ringsPerRound,
    totalBoltsPerRound,
    totalBoltMeteragePerRound,
    sfrsVolumePerRoundM3,
    steelRibWeightPerRoundKg,
  };
}

// ============================================================================
// 2. ROCK SUPPORT PATTERN & BOQ DESIGNER MODAL
// ============================================================================

interface RockSupportPatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  qParams: QIndexParameters;
  rmrParams: RmrParameters;
  supportConfig: RockSupportDesignConfig;
  onUpdateSupportConfig: (next: RockSupportDesignConfig) => void;
}

export const RockSupportPatternModal: React.FC<RockSupportPatternModalProps> = ({
  isOpen,
  onClose,
  geometry,
  settings,
  qParams,
  supportConfig,
  onUpdateSupportConfig,
}) => {
  if (!isOpen) return null;

  const qVal = useMemo(() => {
    const rqdJn = (qParams.rqd || 70) / Math.max(0.5, qParams.jn || 9);
    const jrJa = (qParams.jr || 1.5) / Math.max(0.5, qParams.ja || 2);
    const jwSrf = (qParams.jw || 1.0) / Math.max(0.5, qParams.srf || 1.0);
    return Number((rqdJn * jrJa * jwSrf).toFixed(2));
  }, [qParams]);

  const overlay = useMemo(
    () =>
      computeRockSupportPatternOverlay(
        geometry,
        supportConfig,
        settings.roundLength || 3.5,
        qVal
      ),
    [geometry, supportConfig, settings.roundLength, qVal]
  );

  // SVG preview scaling
  const viewW = 620;
  const viewH = 440;
  const maxSpan = Math.max(geometry.width + supportConfig.boltLengthMeters * 2.3, 14);
  const maxH = Math.max(geometry.height + supportConfig.boltLengthMeters * 1.4, 11);
  const pxPerM = Math.min((viewW - 80) / maxSpan, (viewH - 70) / maxH);
  const origX = viewW / 2;
  const origY = viewH - 45;
  const toSvg = (p: Point2D) => ({
    x: origX + p.x * pxPerM,
    y: origY - p.y * pxPerM,
  });

  const boundaryPath =
    geometry.crossSectionPoints
      .map((p, i) => {
        const s = toSvg(p);
        return `${i === 0 ? 'M' : 'L'} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
      })
      .join(' ') + ' Z';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-mono">
      <div className="w-full max-w-6xl max-h-[94dvh] bg-[#0C111C] border border-[#2A3956] rounded-xs shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top AutoCAD Dialog Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#131C2E] border-b border-[#2A3956]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
              AUTOCAD ROCK SUPPORT PATTERN &amp; BOQ DESIGNER — {settings.tunnelName} ({settings.faceChainage})
            </span>
            <span className="px-2 py-0.5 rounded-xs bg-cyan-950 text-cyan-300 border border-cyan-600/50 text-[10px] font-bold">
              Q = {qVal} · {overlay.supportCategoryLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateSupportConfig({
                  ...supportConfig,
                  enabledOnCanvas: !supportConfig.enabledOnCanvas,
                })
              }
              className={`px-3 py-1 rounded-xs text-xs font-bold border cursor-pointer ${
                supportConfig.enabledOnCanvas
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-[#1A253A] text-cyan-300 border-cyan-500/50 hover:bg-cyan-950'
              }`}
            >
              {supportConfig.enabledOnCanvas
                ? '✓ Displayed on Main CAD Canvas'
                : 'Show Pattern on Main CAD Canvas'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Left CAD Preview + Right Support Parameters & BOQ Table */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* Left 7 Cols: Cross-Section Support CAD Drawing */}
          <div className="lg:col-span-7 p-4 bg-[#070A11] border-b lg:border-b-0 lg:border-r border-[#222E46] flex flex-col items-center justify-center">
            <svg
              viewBox={`0 0 ${viewW} ${viewH}`}
              className="w-full h-auto max-h-[60dvh] bg-[#05080E] border border-[#1E293B] rounded-xs"
            >
              {/* Grid lines */}
              <line x1={origX} y1={15} x2={origX} y2={viewH - 15} stroke="#1E293B" strokeDasharray="4 4" />
              <line x1={20} y1={origY} x2={viewW - 20} y2={origY} stroke="#1E293B" strokeDasharray="4 4" />

              {/* SFRS Shotcrete Lining Arc */}
              {supportConfig.sfrsThicknessMm > 0 && overlay.sfrsOuterPolygon.length > 2 && (
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={Math.max(3, (supportConfig.sfrsThicknessMm / 1000) * pxPerM)}
                  strokeOpacity={0.55}
                  points={overlay.sfrsInnerPolygon
                    .map((p) => {
                      const s = toSvg(p);
                      return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Tunnel Design Cross-Section Boundary */}
              <path
                d={boundaryPath}
                fill="rgba(14, 165, 233, 0.05)"
                stroke="#38BDF8"
                strokeWidth="2"
              />

              {/* Steel Ribs (if enabled) */}
              {supportConfig.steelRibsEnabled && (
                <path
                  d={boundaryPath}
                  fill="none"
                  stroke="#A855F7"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />
              )}

              {/* Radial Rock Bolts */}
              {overlay.bolts.map((b) => {
                const c = toSvg(b.collar);
                const t = toSvg(b.toe);
                return (
                  <g key={b.id}>
                    <line
                      x1={c.x}
                      y1={c.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="#10B981"
                      strokeWidth="2"
                    />
                    {/* Bearing Plate at Collar */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="3.2"
                      fill="#059669"
                      stroke="#A7F3D0"
                      strokeWidth="1"
                    />
                    {/* Bolt Label */}
                    <text
                      x={t.x + (t.x >= origX ? 5 : -18)}
                      y={t.y - 3}
                      fontSize="9"
                      fill="#6EE7B7"
                      fontWeight="700"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

              {/* Legend & Dimension Callout inside SVG */}
              <text x="16" y="24" fontSize="11" fill="#38BDF8" fontWeight="700">
                SPAN: {geometry.width.toFixed(2)}m × HEIGHT: {geometry.height.toFixed(2)}m
              </text>
              <text x="16" y="40" fontSize="10" fill="#10B981">
                ROCK BOLTS: {overlay.boltsPerRing} Nos/Ring (L={supportConfig.boltLengthMeters.toFixed(1)}m @{' '}
                {supportConfig.inPlaneSpacingMeters.toFixed(2)}m × {supportConfig.longitudinalSpacingMeters.toFixed(2)}m c/c)
              </text>
              <text x="16" y="55" fontSize="10" fill="#FBBF24">
                SHOTCRETE: SFRS {supportConfig.sfrsThicknessMm}mm{' '}
                {supportConfig.wireMeshReinforced ? '+ Weld Mesh 100×100×4mm' : ''}
              </text>
            </svg>
          </div>

          {/* Right 5 Cols: Support Controls + BOQ Table */}
          <div className="lg:col-span-5 p-4 space-y-4 text-xs overflow-y-auto">
            <div className="flex items-center justify-between bg-[#141D2F] border border-[#293856] rounded-xs p-2.5">
              <div>
                <div className="font-bold text-cyan-300 text-[11px]">
                  AUTO-CALCULATE FROM Q-SYSTEM (Q = {qVal})
                </div>
                <div className="text-[10px] text-slate-400">
                  Grimstad &amp; Barton (1993) Grimstad Support Chart
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rec = deriveRecommendedSupportFromQ(qVal, geometry.width);
                  onUpdateSupportConfig({
                    ...supportConfig,
                    ...rec,
                  });
                }}
                className="px-2.5 py-1 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Auto-Design Support
              </button>
            </div>

            {/* Bolt Parameters */}
            <div className="border border-[#24324C] rounded-xs p-3 bg-[#101726] space-y-2.5">
              <div className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                1. Systematic Rock Bolting Parameters
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">Rock Bolt Type</span>
                  <select
                    value={supportConfig.boltType}
                    onChange={(e) =>
                      onUpdateSupportConfig({
                        ...supportConfig,
                        boltType: e.target.value as RockSupportDesignConfig['boltType'],
                      })
                    }
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-[11px]"
                  >
                    <option value="SN Grouted Rebar Ø25mm">SN Grouted Rebar Ø25mm</option>
                    <option value="Swellex / Split-Set Ø28mm">Swellex / Split-Set Ø28mm</option>
                    <option value="CT-Bolt Tensioned Ø25mm">CT-Bolt Tensioned Ø25mm</option>
                    <option value="Self-Drilling IBO Ø32mm">Self-Drilling IBO Ø32mm</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">Bolt Length L (m)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1.5"
                    max="8.0"
                    value={supportConfig.boltLengthMeters}
                    onChange={(e) =>
                      onUpdateSupportConfig({
                        ...supportConfig,
                        boltLengthMeters: Math.max(1.5, parseFloat(e.target.value) || 3.5),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-emerald-300 font-bold"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">In-Plane Spacing (m)</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.75"
                    max="3.5"
                    value={supportConfig.inPlaneSpacingMeters}
                    onChange={(e) =>
                      onUpdateSupportConfig({
                        ...supportConfig,
                        inPlaneSpacingMeters: Math.max(0.75, parseFloat(e.target.value) || 1.5),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">Longitudinal Spacing (m)</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.75"
                    max="3.5"
                    value={supportConfig.longitudinalSpacingMeters}
                    onChange={(e) =>
                      onUpdateSupportConfig({
                        ...supportConfig,
                        longitudinalSpacingMeters: Math.max(0.75, parseFloat(e.target.value) || 1.5),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-white"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportConfig.includeSidewallBolts}
                  onChange={(e) =>
                    onUpdateSupportConfig({
                      ...supportConfig,
                      includeSidewallBolts: e.target.checked,
                    })
                  }
                />
                <span className="text-[11px] text-slate-300">
                  Include Left &amp; Right Sidewall Bolts below Springline
                </span>
              </label>
            </div>

            {/* Shotcrete & Steel Ribs */}
            <div className="border border-[#24324C] rounded-xs p-3 bg-[#101726] space-y-2.5">
              <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                2. Shotcrete (SFRS) &amp; Steel Rib Support
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">SFRS Thickness (mm)</span>
                  <input
                    type="number"
                    step="25"
                    min="0"
                    max="300"
                    value={supportConfig.sfrsThicknessMm}
                    onChange={(e) =>
                      onUpdateSupportConfig({
                        ...supportConfig,
                        sfrsThicknessMm: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-amber-300 font-bold"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 text-[10px]">Steel Ribs / Girders</span>
                  <select
                    value={supportConfig.steelRibsEnabled ? supportConfig.steelRibSection : 'NONE'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'NONE') {
                        onUpdateSupportConfig({ ...supportConfig, steelRibsEnabled: false });
                      } else {
                        onUpdateSupportConfig({
                          ...supportConfig,
                          steelRibsEnabled: true,
                          steelRibSection: val as RockSupportDesignConfig['steelRibSection'],
                        });
                      }
                    }}
                    className="w-full px-2 py-1 bg-[#090D16] border border-slate-700 rounded-xs text-[11px]"
                  >
                    <option value="NONE">None (Bolts + SFRS only)</option>
                    <option value="ISMB 150">ISMB 150 Steel Ribs</option>
                    <option value="ISMB 200">ISMB 200 Heavy Steel Ribs</option>
                    <option value="TH 29 Lattice Girder">TH 29 Lattice Girder</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Bill of Quantities (BOQ) Table per Advance Round */}
            <div className="border border-cyan-500/40 rounded-xs overflow-hidden bg-[#0B101B]">
              <div className="px-3 py-1.5 bg-[#162238] text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                <span>BILL OF QUANTITIES (PER {settings.roundLength || 3.5}m ROUND)</span>
                <span className="text-emerald-300">{overlay.ringsPerRound} Rings</span>
              </div>
              <div className="divide-y divide-slate-800 text-[11px]">
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-400">Bolts per Ring</span>
                  <span className="font-bold text-white">{overlay.boltsPerRing} Nos</span>
                </div>
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-400">Total Bolts per Round</span>
                  <span className="font-bold text-emerald-300">{overlay.totalBoltsPerRound} Nos</span>
                </div>
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-400">Total Bolt Drilling Length</span>
                  <span className="font-bold text-cyan-300">
                    {overlay.totalBoltMeteragePerRound.toFixed(1)} m
                  </span>
                </div>
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-400">SFRS Shotcrete Volume (incl. 20% rebound)</span>
                  <span className="font-bold text-amber-300">
                    {overlay.sfrsVolumePerRoundM3.toFixed(2)} m³
                  </span>
                </div>
                <div className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-400">Structural Steel Ribs Weight</span>
                  <span className="font-bold text-purple-300">
                    {overlay.steelRibWeightPerRoundKg} kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. ESWACAD SHEET SET MANAGER (MULTI-CHAINAGE BATCH DXF & REPORT EXPORTER)
// ============================================================================

interface CadSheetSetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  overbreakAnalysis: OverbreakUndercutAnalysis;
  savedProjects: SavedProjectRecord[];
  onLoadProjectRecord: (rec: SavedProjectRecord) => void;
  onOpenExportSheet: (mode: 'GEOLOGICAL_MAPPING_SHEET' | 'ENGINEERING_QUANTITY_SHEET') => void;
}

export const CadSheetSetManagerModal: React.FC<CadSheetSetManagerModalProps> = ({
  isOpen,
  onClose,
  geometry,
  settings,
  joints,
  overbreakAnalysis,
  savedProjects,
  onLoadProjectRecord,
  onOpenExportSheet,
}) => {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Export Multi-Section Master ESWACAD .DXF Package (places each selected chainage cross-section along X axis)
  const handleBatchExportMultiSectionDXF = () => {
    const chosen = savedProjects.filter((p) => selectedIds[p.id]);
    const recordsToExport = chosen.length > 0 ? chosen : savedProjects;

    const lines: string[] = [];
    const push = (code: number, val: string | number) => {
      lines.push(String(code));
      lines.push(String(val));
    };

    push(0, 'SECTION');
    push(2, 'HEADER');
    push(9, '$INSUNITS');
    push(70, 6);
    push(0, 'ENDSEC');

    push(0, 'SECTION');
    push(2, 'ENTITIES');

    const list =
      recordsToExport.length > 0
        ? recordsToExport
        : [
            {
              id: 'current',
              tunnelName: settings.tunnelName,
              faceChainage: settings.faceChainage,
              chainage: settings.chainage,
              date: settings.date,
              geometry,
              joints,
              quantitySummary: {
                designAreaSqM: overbreakAnalysis.designAreaSqMeters,
                surveyedAreaSqM: overbreakAnalysis.surveyedAreaSqMeters,
                overbreakAreaSqM: overbreakAnalysis.overbreakAreaSqMeters,
                undercutAreaSqM: overbreakAnalysis.undercutAreaSqMeters,
                overbreakPct: overbreakAnalysis.overbreakPercentage,
                undercutPct: overbreakAnalysis.undercutPercentage,
              },
            } as unknown as SavedProjectRecord,
          ];

    list.forEach((rec, idx) => {
      const offsetX = idx * Math.max(22, (rec.geometry?.width || 10) * 2.4);
      const pts = rec.geometry?.crossSectionPoints || geometry.crossSectionPoints;

      // Tunnel Design Profile
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        push(0, 'LINE');
        push(8, 'TUNNEL_DESIGN_PROFILE');
        push(62, 4);
        push(10, (a.x + offsetX).toFixed(4));
        push(20, a.y.toFixed(4));
        push(30, '0.0');
        push(11, (b.x + offsetX).toFixed(4));
        push(21, b.y.toFixed(4));
        push(31, '0.0');
      }

      // Mapped Face Joints
      for (const j of rec.joints || []) {
        if (j.surface !== 'face' || !j.geometry || j.geometry.length < 2) continue;
        for (let k = 0; k < j.geometry.length - 1; k++) {
          const p1 = j.geometry[k];
          const p2 = j.geometry[k + 1];
          push(0, 'LINE');
          push(8, `JOINTS_${j.set || 'J1'}`);
          push(62, 1);
          push(10, (p1.x + offsetX).toFixed(4));
          push(20, p1.y.toFixed(4));
          push(30, '0.0');
          push(11, (p2.x + offsetX).toFixed(4));
          push(21, p2.y.toFixed(4));
          push(31, '0.0');
        }
      }

      // Section Title Label
      push(0, 'TEXT');
      push(8, 'SHEET_SET_TITLES');
      push(62, 7);
      push(10, (offsetX - 3.5).toFixed(3));
      push(20, '-1.400');
      push(30, '0.0');
      push(40, '0.35');
      push(
        1,
        `${rec.tunnelName} | ${rec.faceChainage || rec.chainage} | Joints: ${(rec.joints || []).length} | OB: ${(rec.quantitySummary?.overbreakPct ?? 0).toFixed(1)}%`
      );
    });

    push(0, 'ENDSEC');
    push(0, 'EOF');

    const blob = new Blob([lines.join('\n')], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.tunnelName.replace(/\s+/g, '_')}_SheetSet_${list.length}_Sections.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Multi-Chainage Engineering CSV Log
  const handleBatchExportCSV = () => {
    const header = [
      'Section_ID',
      'Tunnel_Name',
      'Chainage',
      'Date',
      'Span_W_m',
      'Height_H_m',
      'Mapped_Joints',
      'RQD_Pct',
      'Design_Area_m2',
      'Overbreak_Area_m2',
      'Overbreak_Pct',
      'Undercut_Area_m2',
    ].join(',');

    const rows = savedProjects.map((rec) =>
      [
        `"${rec.id}"`,
        `"${rec.tunnelName}"`,
        `"${rec.faceChainage || rec.chainage}"`,
        `"${rec.date}"`,
        (rec.geometry?.width || 0).toFixed(2),
        (rec.geometry?.height || 0).toFixed(2),
        (rec.joints || []).length,
        rec.qIndexParams?.rqd ?? 75,
        (rec.quantitySummary?.designAreaSqM ?? 0).toFixed(2),
        (rec.quantitySummary?.overbreakAreaSqM ?? 0).toFixed(2),
        (rec.quantitySummary?.overbreakPct ?? 0).toFixed(2),
        (rec.quantitySummary?.undercutAreaSqM ?? 0).toFixed(2),
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.tunnelName.replace(/\s+/g, '_')}_MultiChainage_SheetSet_Log.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-mono">
      <div className="w-full max-w-5xl max-h-[92dvh] bg-[#0C111D] border border-[#2C3C5B] rounded-xs shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#141E32] border-b border-[#2C3C5B]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
              ESWACAD SHEET SET MANAGER — MULTI-CHAINAGE BATCH DXF &amp; LOG EXPORTER
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 text-xs">
          {/* Batch Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#11192B] border border-[#263552] rounded-xs p-3">
            <div>
              <div className="font-bold text-cyan-300">
                Multi-Section ESWACAD Sheet Set ({savedProjects.length} Saved Chainages + Active Face)
              </div>
              <div className="text-[11px] text-slate-400">
                Export all tunnel cross-sections side-by-side in a single ESWACAD .DXF drawing or multi-section Excel/CSV summary.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBatchExportMultiSectionDXF}
                className="px-3 py-1.5 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Multi-Section ESWACAD .DXF
              </button>
              <button
                type="button"
                onClick={handleBatchExportCSV}
                className="px-3 py-1.5 rounded-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Chainage Summary .CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExportSheet('GEOLOGICAL_MAPPING_SHEET');
                }}
                className="px-3 py-1.5 rounded-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Plot Active Sheet
              </button>
            </div>
          </div>

          {/* Chainage Table */}
          <div className="border border-[#24324C] rounded-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#152036] text-cyan-300 border-b border-[#24324C]">
                  <th className="p-2">Select</th>
                  <th className="p-2">Chainage (RD)</th>
                  <th className="p-2">Tunnel Section</th>
                  <th className="p-2">Span W×H</th>
                  <th className="p-2">Mapped Joints</th>
                  <th className="p-2">RQD %</th>
                  <th className="p-2">Overbreak %</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-[#090D16]">
                {savedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-400">
                      No saved chainages in Project Memory yet. Click &quot;Save Section&quot; in the toolbar to add chainages to the Sheet Set.
                    </td>
                  </tr>
                ) : (
                  savedProjects.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-900/70">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedIds[rec.id])}
                          onChange={(e) =>
                            setSelectedIds((prev) => ({
                              ...prev,
                              [rec.id]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="p-2 font-bold text-amber-300">
                        {rec.faceChainage || rec.chainage}
                      </td>
                      <td className="p-2 text-slate-200">{rec.tunnelName}</td>
                      <td className="p-2 text-emerald-300">
                        {rec.geometry?.width?.toFixed(2)}m × {rec.geometry?.height?.toFixed(2)}m
                      </td>
                      <td className="p-2 text-cyan-300 font-bold">
                        {(rec.joints || []).length} traces
                      </td>
                      <td className="p-2 text-slate-200">{rec.qIndexParams?.rqd ?? 75}%</td>
                      <td className="p-2 text-rose-300 font-semibold">
                        {(rec.quantitySummary?.overbreakPct ?? 0).toFixed(1)}%
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadProjectRecord(rec);
                            onClose();
                          }}
                          className="px-2 py-0.5 rounded-xs bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-600/50 text-[10px] cursor-pointer"
                        >
                          Open Section →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
