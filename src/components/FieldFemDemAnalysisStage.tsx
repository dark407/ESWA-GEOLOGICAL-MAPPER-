import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Columns,
  Download,
  FileText,
  Maximize2,
  Printer,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  FieldExcavationRound,
  FieldProjectItem,
  FieldTunnelLocationItem,
  MappingDomainType,
} from '../engine/fieldMappingEngine';
import { SurfaceGeometryParameters } from '../engine/surfaceMappingEngine';
import {
  CompleteFemDemAnalysisResult,
  createDefaultFemDemConfig,
  exportStandaloneFemDemWordReport,
  FemDemAnalysisMode,
  FemDemParameterKey,
  FemMeshElement2D,
  ParameterProvenanceType,
  ResolvedGeotechParameter,
  runCompleteFemDemAnalysis,
} from '../engine/femDemAnalysisEngine';
import { FieldTunnelBenchHatchAndLineSvg } from './FieldMappingCompassAndPatterns';

export interface FieldFemDemAnalysisStageProps {
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToSupport: () => void;
  onContinueToNextStage: () => void;
  nextStageLabel?: string;
}

type FemFieldContourMode = 'displacement' | 'sigma_theta' | 'strain' | 'fos' | 'lithology';
type CanvasViewportLayout = 'split' | 'before_only' | 'after_only';

// High-Contrast LIGHT Theme Provenance Styles for Crystal-Clear Parameter Visibility
const LIGHT_PROVENANCE_STYLE_MAP: Record<
  ParameterProvenanceType,
  {
    cardBg: string;
    cardBorder: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  SITE_TEST: {
    cardBg: 'bg-white',
    cardBorder: 'border-emerald-300',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-400',
  },
  ESWA_RECORDED: {
    cardBg: 'bg-white',
    cardBorder: 'border-sky-300',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    badgeBorder: 'border-sky-400',
  },
  REFERENCE_ESTIMATED: {
    cardBg: 'bg-amber-50/70',
    cardBorder: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-400',
  },
  ENGINEER_OVERRIDE: {
    cardBg: 'bg-violet-50/80',
    cardBorder: 'border-violet-400',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-950',
    badgeBorder: 'border-violet-400',
  },
  MISSING_INPUT: {
    cardBg: 'bg-rose-50/80',
    cardBorder: 'border-rose-300',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-950',
    badgeBorder: 'border-rose-400',
  },
};

// High-contrast 8-stop scientific colour ramp (RS2 / Plaxis Geotechnical Scale)
const CONTOUR_RAMP_COLORS = [
  '#1d4ed8', // 0.00 - Deep Royal Blue (Low)
  '#0284c7', // 0.16 - Cerulean Blue
  '#06b6d4', // 0.32 - Cyan
  '#10b981', // 0.48 - Emerald
  '#84cc16', // 0.62 - Lime Green
  '#eab308', // 0.76 - Amber Yellow
  '#f97316', // 0.88 - Deep Orange
  '#ef4444', // 1.00 - Crimson Red (High / Peak)
];

const FOS_RAMP_COLORS = [
  '#ef4444', // < 1.00 Unstable
  '#f97316', // 1.00 - 1.15 Marginal
  '#eab308', // 1.15 - 1.35 Moderate
  '#84cc16', // 1.35 - 1.60 Adequate
  '#10b981', // 1.60 - 2.00 Stable
  '#06b6d4', // > 2.00 Very Stable
];

function sampleColorRamp(ratio: number, palette: string[]): string {
  const clamped = Math.max(0, Math.min(0.999, ratio));
  const idx = Math.floor(clamped * palette.length);
  return palette[idx] || palette[0];
}

function getElementFillColor(
  el: FemMeshElement2D,
  stageType: 'before' | 'after',
  contourMode: FemFieldContourMode,
  maxDispRef: number,
  maxStressRef: number
): string {
  if (contourMode === 'lithology') {
    return el.lithologyColor;
  }
  if (contourMode === 'displacement') {
    const val = stageType === 'before' ? el.displacementBeforeMm : el.displacementAfterMm;
    const ratio = val / Math.max(0.5, maxDispRef);
    return sampleColorRamp(ratio, CONTOUR_RAMP_COLORS);
  }
  if (contourMode === 'sigma_theta') {
    const val = stageType === 'before' ? el.sigmaThetaBeforeMpa : el.sigmaThetaAfterMpa;
    const ratio = val / Math.max(0.5, maxStressRef);
    return sampleColorRamp(ratio, CONTOUR_RAMP_COLORS);
  }
  if (contourMode === 'strain') {
    const val = stageType === 'before' ? el.strainBeforePct : el.strainAfterPct;
    const ratio = val / 1.2;
    return sampleColorRamp(ratio, CONTOUR_RAMP_COLORS);
  }
  // Factor of Safety (FoS)
  const fos = stageType === 'before' ? el.localFosBefore : el.localFosAfter;
  const fosRatio = (fos - 0.8) / 1.6;
  return sampleColorRamp(fosRatio, FOS_RAMP_COLORS);
}

export const FieldFemDemAnalysisStage: React.FC<FieldFemDemAnalysisStageProps> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  surfaceParams,
  onUpdateRound,
  onBackToSupport,
  onContinueToNextStage,
  nextStageLabel = 'Next: Survey Overbreak',
}) => {
  const femDemCfg = activeRound.femDemAnalysis || createDefaultFemDemConfig();
  const activeMode: FemDemAnalysisMode = femDemCfg.mode || 'combined';

  const [contourMode, setContourMode] = useState<FemFieldContourMode>('displacement');
  const [viewportLayout, setViewportLayout] = useState<CanvasViewportLayout>('split');
  const [showMeshWireframe, setShowMeshWireframe] = useState<boolean>(true);
  const [showMeshNodes, setShowMeshNodes] = useState<boolean>(true);
  const [showPlasticBoundary, setShowPlasticBoundary] = useState<boolean>(true);
  const [showDeformedBoundary, setShowDeformedBoundary] = useState<boolean>(true);
  const [showJointNetwork, setShowJointNetwork] = useState<boolean>(true);
  const [showKeyBlocks, setShowKeyBlocks] = useState<boolean>(true);
  const [showDeformationVectors, setShowDeformationVectors] = useState<boolean>(true);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('KB-CROWN');
  const [isParametersSectionExpanded, setIsParametersSectionExpanded] = useState<boolean>(true);
  const [isParametersModalOpen, setIsParametersModalOpen] = useState<boolean>(false);
  const [selectedParamCategory, setSelectedParamCategory] = useState<
    'ALL' | ResolvedGeotechParameter['category']
  >('ALL');
  const [isStandaloneReportOpen, setIsStandaloneReportOpen] = useState<boolean>(false);

  const analysisResult: CompleteFemDemAnalysisResult = useMemo(
    () =>
      runCompleteFemDemAnalysis(
        activeProject,
        activeLocation,
        activeRound,
        mappingDomain,
        surfaceParams
      ),
    [activeProject, activeLocation, activeRound, mappingDomain, surfaceParams]
  );

  const handleSetMode = (mode: FemDemAnalysisMode) => {
    onUpdateRound((r) => ({
      ...r,
      femDemAnalysis: {
        ...(r.femDemAnalysis || createDefaultFemDemConfig()),
        mode,
        lastUpdatedIso: new Date().toISOString(),
      },
    }));
  };

  const handleOverrideParameter = (key: FemDemParameterKey, rawVal: string) => {
    const num = parseFloat(rawVal);
    onUpdateRound((r) => {
      const prevCfg = r.femDemAnalysis || createDefaultFemDemConfig();
      const nextOverrides = { ...(prevCfg.parameterOverrides || {}) };
      if (rawVal.trim() === '' || isNaN(num)) {
        delete nextOverrides[key];
      } else {
        nextOverrides[key] = num;
      }
      return {
        ...r,
        femDemAnalysis: {
          ...prevCfg,
          overburdenDepthM:
            key === 'overburdenDepthM' && !isNaN(num) ? num : prevCfg.overburdenDepthM,
          horizontalStressRatioK0:
            key === 'horizontalStressRatioK0' && !isNaN(num)
              ? num
              : prevCfg.horizontalStressRatioK0,
          blastDamageFactorD:
            key === 'blastDamageFactorD' && !isNaN(num) ? num : prevCfg.blastDamageFactorD,
          parameterOverrides: nextOverrides,
          lastUpdatedIso: new Date().toISOString(),
        },
      };
    });
  };

  const handleResetAllOverrides = () => {
    onUpdateRound((r) => ({
      ...r,
      femDemAnalysis: {
        ...(r.femDemAnalysis || createDefaultFemDemConfig()),
        overburdenDepthM: undefined,
        horizontalStressRatioK0: undefined,
        blastDamageFactorD: undefined,
        parameterOverrides: {},
        lastUpdatedIso: new Date().toISOString(),
      },
    }));
  };

  const handleToggleIncludeInEswaReport = (checked: boolean) => {
    onUpdateRound((r) => ({
      ...r,
      femDemAnalysis: {
        ...(r.femDemAnalysis || createDefaultFemDemConfig()),
        includeInEswaReport: checked,
        lastUpdatedIso: new Date().toISOString(),
      },
    }));
  };

  const selectedElement = useMemo(
    () => (analysisResult.meshElements || []).find((e) => e.id === selectedElementId) || null,
    [analysisResult.meshElements, selectedElementId]
  );

  const selectedBlock = useMemo(
    () =>
      (analysisResult.demKeyBlocks || []).find((b) => b.id === selectedBlockId) ||
      analysisResult.criticalBlockBefore,
    [analysisResult.demKeyBlocks, analysisResult.criticalBlockBefore, selectedBlockId]
  );

  const filteredParameters = useMemo(() => {
    const allParams = analysisResult.parameters || [];
    if (selectedParamCategory === 'ALL') return allParams;
    return allParams.filter((p) => p.category === selectedParamCategory);
  }, [analysisResult.parameters, selectedParamCategory]);

  const overburdenParam = (analysisResult.parameters || []).find(
    (p) => p.key === 'overburdenDepthM'
  );
  const k0Param = (analysisResult.parameters || []).find(
    (p) => p.key === 'horizontalStressRatioK0'
  );
  const ermParam = (analysisResult.parameters || []).find(
    (p) => p.key === 'rockMassModulusErmGpa'
  );
  const ucsParam = (analysisResult.parameters || []).find(
    (p) => p.key === 'intactUcsMpa'
  );

  // Render High-Visibility 2D Triangular FEM & DEM Cross-Section Canvas with Exact Fed Tunnel Shape
  const renderCrossSectionSvg = (stageType: 'before' | 'after') => {
    const isAfter = stageType === 'after';
    const femState = isAfter ? analysisResult.femAfter : analysisResult.femBefore;
    const sup = activeRound.supportSystem;
    const isSupportInstalled = analysisResult.supportBreakdown.isSupportConfirmedInstalled;

    const svgW = 560;
    const svgH = 440;
    const cx = svgW / 2;
    const cy = svgH * 0.54;
    const boxW = 184;
    const boxH = Math.round(
      boxW *
        Math.min(
          1.25,
          Math.max(0.72, analysisResult.totalHeightM / Math.max(1, analysisResult.spanWidthM))
        )
    );
    const scalePxPerM = boxW / Math.max(1, analysisResult.spanWidthM);

    const showFemLayers = activeMode === 'fem' || activeMode === 'combined';
    const showDemLayers = activeMode === 'dem' || activeMode === 'combined';

    const maxDispRef = Math.max(2, analysisResult.femBefore.maxDisplacementMm);
    const maxStressRef = Math.max(2, analysisResult.femBefore.maxTangentialStressMpa);

    // Exaggerated deformed boundary polygon inside the exact fed tunnel shape
    const dispExaggerationPx = isAfter
      ? Math.min(20, Math.max(3.5, (femState.maxDisplacementMm / maxDispRef) * 18))
      : Math.min(24, Math.max(8, 20));

    const deformedBoundaryPoints = (analysisResult.tunnelOutlineSvgPoints || [])
      .map((pt) => {
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        // Crown arch sags inward; vertical walls converge inward; flat invert has minimal heave
        const dirScale = dy < 0 ? 1.15 : dy > boxH * 0.35 ? 0.3 : 0.92;
        const inwardShift = dispExaggerationPx * dirScale;
        const nx = pt.x - (dx / dist) * inwardShift;
        const ny = pt.y - (dy / dist) * inwardShift;
        return `${nx.toFixed(1)},${ny.toFixed(1)}`;
      })
      .join(' ');

    const plasticPolyPts = (
      isAfter
        ? analysisResult.plasticZonePolygonAfterSvg
        : analysisResult.plasticZonePolygonBeforeSvg
    ) || [];

    const legendMeta =
      contourMode === 'displacement'
        ? {
            title: 'u_r (mm)',
            minLabel: '0.0',
            midLabel: (maxDispRef * 0.5).toFixed(1),
            maxLabel: maxDispRef.toFixed(1),
            colors: CONTOUR_RAMP_COLORS,
          }
        : contourMode === 'sigma_theta'
        ? {
            title: 'σ_θ (MPa)',
            minLabel: '0.0',
            midLabel: (maxStressRef * 0.5).toFixed(1),
            maxLabel: maxStressRef.toFixed(1),
            colors: CONTOUR_RAMP_COLORS,
          }
        : contourMode === 'strain'
        ? {
            title: 'γ (%)',
            minLabel: '0.00',
            midLabel: '0.60',
            maxLabel: '1.20+',
            colors: CONTOUR_RAMP_COLORS,
          }
        : contourMode === 'fos'
        ? {
            title: 'FoS',
            minLabel: '<1.0',
            midLabel: '1.5',
            maxLabel: '2.4+',
            colors: FOS_RAMP_COLORS,
          }
        : {
            title: 'Lithology',
            minLabel: '',
            midLabel: '',
            maxLabel: '',
            colors: [analysisResult.meshElements[0]?.lithologyColor || '#38bdf8'],
          };

    return (
      <div className="relative w-full h-[470px] xl:h-[540px] min-h-[450px] shrink-0 bg-[#060A12] rounded-xl border border-slate-700/90 overflow-hidden shadow-inner">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block select-none"
        >
          <defs>
            <radialGradient id={`rock-halo-${stageType}`} cx="50%" cy="54%" r="50%">
              <stop
                offset="0%"
                stopColor={isAfter ? '#0ea5e9' : '#f43f5e'}
                stopOpacity="0.18"
              />
              <stop offset="68%" stopColor="#0f172a" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#060A12" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={`legend-grad-${stageType}`} x1="0%" y1="100%" x2="0%" y2="0%">
              {legendMeta.colors.map((c, idx) => (
                <stop
                  key={idx}
                  offset={`${Math.round((idx / Math.max(1, legendMeta.colors.length - 1)) * 100)}%`}
                  stopColor={c}
                />
              ))}
            </linearGradient>

            <marker
              id={`vec-arrow-${stageType}`}
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1 L 10 5 L 0 9 z"
                fill={isAfter ? '#34d399' : '#fb7185'}
              />
            </marker>

            <marker
              id={`stress-arrow-${stageType}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Rock Mass Domain Background */}
          <rect x="0" y="0" width={svgW} height={svgH} fill="#060A12" />
          <circle cx={cx} cy={cy} r={245} fill={`url(#rock-halo-${stageType})`} />

          {/* Background Engineering Coordinate Grid */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const x = 24 + idx * 46;
            return (
              <line
                key={`gx-${idx}`}
                x1={x}
                y1={16}
                x2={x}
                y2={svgH - 16}
                stroke="#1e293b"
                strokeWidth="0.7"
                strokeDasharray="2 3"
              />
            );
          })}
          {Array.from({ length: 10 }).map((_, idx) => {
            const y = 20 + idx * 44;
            return (
              <line
                key={`gy-${idx}`}
                x1={16}
                y1={y}
                x2={svgW - 16}
                y2={y}
                stroke="#1e293b"
                strokeWidth="0.7"
                strokeDasharray="2 3"
              />
            );
          })}

          {/* Far-Field In-Situ Stress Boundary Arrows (σv Top & σh Left/Right) */}
          <g pointerEvents="none" opacity="0.88">
            {[-90, -45, 0, 45, 90].map((dx, i) => (
              <line
                key={`sv-${i}`}
                x1={cx + dx}
                y1={14}
                x2={cx + dx}
                y2={31}
                stroke="#38bdf8"
                strokeWidth="1.5"
                markerEnd={`url(#stress-arrow-${stageType})`}
              />
            ))}
            <text
              x={cx}
              y={11}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="bold"
              fill="#38bdf8"
            >
              σv = {analysisResult.inSituVerticalStressMpa} MPa (H={overburdenParam?.value ?? 85}m)
            </text>

            {[-70, -25, 20, 65].map((dy, i) => (
              <React.Fragment key={`sh-${i}`}>
                <line
                  x1={14}
                  y1={cy + dy}
                  x2={31}
                  y2={cy + dy}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  markerEnd={`url(#stress-arrow-${stageType})`}
                />
                <line
                  x1={svgW - 46}
                  y1={cy + dy}
                  x2={svgW - 63}
                  y2={cy + dy}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  markerEnd={`url(#stress-arrow-${stageType})`}
                />
              </React.Fragment>
            ))}
          </g>

          {/* 1. 3-NODE TRIANGULAR FINITE ELEMENT MESH (432 CST Triangles Conforming to Fed Tunnel Shape) */}
          {showFemLayers &&
            (analysisResult.meshElements || []).map((el) => {
              const fill = getElementFillColor(
                el,
                stageType,
                contourMode,
                maxDispRef,
                maxStressRef
              );
              const isSelected = selectedElementId === el.id;
              const isYielded = isAfter ? el.isYieldedAfter : el.isYieldedBefore;
              return (
                <g
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  className="cursor-pointer"
                >
                  <polygon
                    points={(el.pointsSvg || []).map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={fill}
                    fillOpacity={activeMode === 'combined' ? 0.76 : 0.9}
                    stroke={
                      isSelected
                        ? '#ffffff'
                        : showMeshWireframe
                        ? '#090D16'
                        : fill
                    }
                    strokeWidth={isSelected ? '2.2' : showMeshWireframe ? '0.75' : '0.25'}
                    strokeLinejoin="round"
                  />
                  {/* Plastic Shear Yield Marker (×) on Yielded Triangular Elements */}
                  {isYielded && showPlasticBoundary && (
                    <g
                      transform={`translate(${el.centroidSvg.x}, ${el.centroidSvg.y})`}
                      pointerEvents="none"
                    >
                      <line
                        x1="-1.9"
                        y1="-1.9"
                        x2="1.9"
                        y2="1.9"
                        stroke="#ffe4e6"
                        strokeWidth="1.0"
                      />
                      <line
                        x1="-1.9"
                        y1="1.9"
                        x2="1.9"
                        y2="-1.9"
                        stroke="#ffe4e6"
                        strokeWidth="1.0"
                      />
                    </g>
                  )}
                </g>
              );
            })}

          {/* Triangular FEM Mesh Nodal Vertices */}
          {showFemLayers &&
            showMeshNodes &&
            (analysisResult.meshNodes || []).map((nd) => (
              <circle
                key={nd.id}
                cx={nd.xSvg}
                cy={nd.ySvg}
                r="1.15"
                fill="#f8fafc"
                opacity="0.65"
                pointerEvents="none"
              />
            ))}

          {/* 2. Boundary-Fitted Plastic Yield Zone Envelope (R_p) following Fed Tunnel Shape */}
          {showFemLayers &&
            showPlasticBoundary &&
            femState.plasticZoneDepthMeters > 0.04 &&
            plasticPolyPts.length > 3 && (
              <g pointerEvents="none">
                <polygon
                  points={plasticPolyPts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={isAfter ? '#fde047' : '#fb7185'}
                  strokeWidth="2.4"
                  strokeDasharray="7 4"
                />
                <rect
                  x={cx + 42}
                  y={cy - boxH * 0.78 - 14}
                  width="132"
                  height="16"
                  rx="4"
                  fill="#090D16"
                  fillOpacity="0.92"
                  stroke={isAfter ? '#fde047' : '#fb7185'}
                  strokeWidth="1"
                />
                <text
                  x={cx + 108}
                  y={cy - boxH * 0.78 - 3}
                  textAnchor="middle"
                  fontSize="8.2"
                  fontFamily="IBM Plex Mono, monospace"
                  fontWeight="bold"
                  fill={isAfter ? '#fde047' : '#fda4af'}
                >
                  Rp={femState.plasticZoneRadiusMeters.toFixed(2)}m (dp=
                  {femState.plasticZoneDepthMeters.toFixed(2)}m)
                </text>
              </g>
            )}

          {/* 3. DEM Discontinuity / Joint Traces in Surrounding Rock Mass */}
          {showDemLayers &&
            showJointNetwork &&
            (analysisResult.demJointPlanes || []).map((jp) => {
              const isSliding = (isAfter ? jp.jointFosAfter : jp.jointFosBefore) < 1.15;
              return (
                <g key={jp.id} pointerEvents="none">
                  <line
                    x1={jp.x1Svg}
                    y1={jp.y1Svg}
                    x2={jp.x2Svg}
                    y2={jp.y2Svg}
                    stroke="#020617"
                    strokeWidth={isSliding ? '4.0' : '3.0'}
                    opacity="0.75"
                  />
                  <line
                    x1={jp.x1Svg}
                    y1={jp.y1Svg}
                    x2={jp.x2Svg}
                    y2={jp.y2Svg}
                    stroke={jp.color}
                    strokeWidth={isSliding ? '2.4' : '1.7'}
                    strokeDasharray={isSliding ? '5 2.5' : undefined}
                  />
                </g>
              );
            })}

          {/* 4. DEM Discrete Key Blocks & Wedges around Excavation Boundary */}
          {showDemLayers &&
            showKeyBlocks &&
            (analysisResult.demKeyBlocks || []).map((kb) => {
              const fos = isAfter ? kb.fosAfter : kb.fosBefore;
              const isSelected = selectedBlock?.id === kb.id;
              const blockColor =
                fos < 1.05
                  ? '#f43f5e'
                  : fos < 1.45
                  ? '#f59e0b'
                  : '#10b981';

              const shiftScale = !isAfter && fos < 1.15 ? 0.24 : 0.05;
              const tx = kb.moveVectorSvg.dx * shiftScale;
              const ty = kb.moveVectorSvg.dy * shiftScale;

              return (
                <g
                  key={kb.id}
                  transform={`translate(${tx.toFixed(1)}, ${ty.toFixed(1)})`}
                  onClick={() => setSelectedBlockId(kb.id)}
                  className="cursor-pointer"
                >
                  <polygon
                    points={(kb.polygonSvg || []).map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={blockColor}
                    fillOpacity={isSelected ? 0.72 : 0.52}
                    stroke={isSelected ? '#ffffff' : blockColor}
                    strokeWidth={isSelected ? '2.5' : '1.9'}
                  />
                  {showDeformationVectors && (
                    <line
                      x1={kb.centroidSvg.x}
                      y1={kb.centroidSvg.y}
                      x2={kb.centroidSvg.x + kb.moveVectorSvg.dx * (isAfter ? 0.55 : 1.05)}
                      y2={kb.centroidSvg.y + kb.moveVectorSvg.dy * (isAfter ? 0.55 : 1.05)}
                      stroke={isAfter ? '#34d399' : '#fb7185'}
                      strokeWidth="2.1"
                      markerEnd={`url(#vec-arrow-${stageType})`}
                    />
                  )}
                  <rect
                    x={kb.centroidSvg.x - 33}
                    y={kb.centroidSvg.y - 8}
                    width="66"
                    height="14"
                    rx="3"
                    fill="#020617"
                    fillOpacity="0.88"
                    stroke={blockColor}
                    strokeWidth="0.9"
                  />
                  <text
                    x={kb.centroidSvg.x}
                    y={kb.centroidSvg.y + 1.5}
                    textAnchor="middle"
                    fontSize="7.8"
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    {kb.id.replace('KB-', '')} FoS:{fos.toFixed(2)}
                  </text>
                </g>
              );
            })}

          {/* 5. EXACT FED TUNNEL PROFILE CAVITY MASK (D-Shaped, Horseshoe, Circular, Rectangular, or Custom) */}
          <path
            d={analysisResult.tunnelClosedPathD}
            fill="#04070E"
            stroke={isAfter && isSupportInstalled ? '#38bdf8' : '#e2e8f0'}
            strokeWidth={isAfter && isSupportInstalled ? '3.0' : '2.2'}
            strokeLinejoin="round"
          />

          {/* 5B. Dotted Bench Line & Hatched Bench / Top Heading Portion inside FEM/DEM Tunnel Cavity */}
          {mappingDomain === 'TUNNEL' && (
            <FieldTunnelBenchHatchAndLineSvg
              location={activeLocation}
              round={activeRound}
              boxX={cx - boxW / 2}
              boxY={cy - boxH / 2}
              boxW={boxW}
              boxH={boxH}
              clipPathD={analysisResult.tunnelClosedPathD}
              darkBackground
              idSuffix={`fem-${stageType}-${activeRound.id}`}
            />
          )}

          {/* Springing Line (SPL) Reference inside Fed Tunnel Cavity */}
          {mappingDomain === 'TUNNEL' && activeLocation.shape !== 'circular' && (
            <g pointerEvents="none" opacity="0.7">
              <line
                x1={cx - boxW / 2 + 3}
                y1={analysisResult.tunnelSplY}
                x2={cx + boxW / 2 - 3}
                y2={analysisResult.tunnelSplY}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text
                x={cx - boxW / 2 + 8}
                y={analysisResult.tunnelSplY - 3}
                fontSize="7"
                fontFamily="IBM Plex Mono, monospace"
                fontWeight="bold"
                fill="#64748b"
              >
                SPL
              </text>
              <text
                x={cx + boxW / 2 - 22}
                y={analysisResult.tunnelSplY - 3}
                fontSize="7"
                fontFamily="IBM Plex Mono, monospace"
                fontWeight="bold"
                fill="#64748b"
              >
                SPL
              </text>
            </g>
          )}

          {/* 5B. Deformed Excavation Profile (Exaggerated Radial Convergence Curve inside Fed Tunnel Cavity) */}
          {showDeformedBoundary && (
            <polygon
              points={deformedBoundaryPoints}
              fill={isAfter ? 'rgba(52, 211, 153, 0.05)' : 'rgba(244, 63, 94, 0.08)'}
              stroke={isAfter ? '#34d399' : '#fb7185'}
              strokeWidth="1.8"
              strokeDasharray="5 3"
              pointerEvents="none"
            />
          )}

          {/* 6. AFTER SUPPORT ONLY: Render Actual Recorded ESWA Support on Exact Fed Tunnel Shape */}
          {isAfter && isSupportInstalled && (
            <g pointerEvents="none">
              {/* Shotcrete Arch / Wall Lining Ring */}
              {sup?.shotcreteEnabled && (
                <path
                  d={analysisResult.tunnelClosedPathD}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={Math.max(
                    3.8,
                    Math.min(7.5, (analysisResult.supportBreakdown.shotcreteThicknessMm || 100) / 22)
                  )}
                  strokeLinejoin="round"
                  opacity="0.92"
                />
              )}

              {/* Steel Rib / Lattice Girder Inner Ring */}
              {(sup?.latticeGirderEnabled || sup?.ismbEnabled) && (
                <polygon
                  points={(analysisResult.tunnelOutlineSvgPoints || [])
                    .map((p) => {
                      const dx = p.x - cx;
                      const dy = p.y - cy;
                      return `${(cx + dx * 0.95).toFixed(1)},${(cy + dy * 0.95).toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="2.4"
                  strokeDasharray="5 2.5"
                />
              )}

              {/* Boundary-Fitted Rock Bolts / Soil Nails Anchored on Exact Fed Tunnel Walls & Crown */}
              {(sup?.rockBoltsEnabled || sup?.soilNailsEnabled) &&
                (analysisResult.supportBoltVectorsSvg || []).map((bv, bIdx) => (
                  <g key={`rb-${bIdx}`}>
                    <line
                      x1={bv.x1}
                      y1={bv.y1}
                      x2={bv.x2}
                      y2={bv.y2}
                      stroke="#020617"
                      strokeWidth="3.6"
                      strokeLinecap="round"
                    />
                    <line
                      x1={bv.x1}
                      y1={bv.y1}
                      x2={bv.x2}
                      y2={bv.y2}
                      stroke="#38bdf8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={bv.x1}
                      cy={bv.y1}
                      r="3.2"
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth="1"
                    />
                  </g>
                ))}
            </g>
          )}

          {/* 7. Radial Convergence Vectors at Crown & Vertical Sidewalls */}
          {showDeformationVectors && (
            <g pointerEvents="none">
              {/* Crown top vertical sag vector */}
              <line
                x1={cx}
                y1={cy - boxH / 2 + 3}
                x2={cx}
                y2={cy - boxH / 2 + (isAfter ? 18 : 30)}
                stroke={isAfter ? '#34d399' : '#fb7185'}
                strokeWidth="2.1"
                markerEnd={`url(#vec-arrow-${stageType})`}
              />
              {/* Left vertical wall inward vector */}
              <line
                x1={cx - boxW / 2 + 3}
                y1={(analysisResult.tunnelSplY + (cy + boxH / 2)) / 2}
                x2={cx - boxW / 2 + (isAfter ? 18 : 28)}
                y2={(analysisResult.tunnelSplY + (cy + boxH / 2)) / 2}
                stroke={isAfter ? '#34d399' : '#fb7185'}
                strokeWidth="2.1"
                markerEnd={`url(#vec-arrow-${stageType})`}
              />
              {/* Right vertical wall inward vector */}
              <line
                x1={cx + boxW / 2 - 3}
                y1={(analysisResult.tunnelSplY + (cy + boxH / 2)) / 2}
                x2={cx + boxW / 2 - (isAfter ? 18 : 28)}
                y2={(analysisResult.tunnelSplY + (cy + boxH / 2)) / 2}
                stroke={isAfter ? '#34d399' : '#fb7185'}
                strokeWidth="2.1"
                markerEnd={`url(#vec-arrow-${stageType})`}
              />
            </g>
          )}

          {/* Compact Telemetry Readout Inside Fed Tunnel Cavity */}
          <g pointerEvents="none">
            <rect
              x={cx - 74}
              y={cy - 18}
              width="148"
              height="44"
              rx="6"
              fill="#090D16"
              fillOpacity="0.92"
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              fontSize="8.2"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="bold"
              fill="#94a3b8"
            >
              {analysisResult.excavationShapeLabel} ({analysisResult.spanWidthM}×
              {analysisResult.totalHeightM}m)
            </text>
            <text
              x={cx}
              y={cy + 7}
              textAnchor="middle"
              fontSize="9.2"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="bold"
              fill={isAfter ? '#34d399' : '#fda4af'}
            >
              u_max = {femState.maxDisplacementMm.toFixed(2)} mm
            </text>
            <text
              x={cx}
              y={cy + 20}
              textAnchor="middle"
              fontSize="8.2"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="bold"
              fill="#e2e8f0"
            >
              FoS(FEM):{femState.continuumFactorOfSafety.toFixed(2)} | DEM:
              {(isAfter
                ? analysisResult.minBlockFosAfter
                : analysisResult.minBlockFosBefore
              ).toFixed(2)}
            </text>
          </g>

          {/* 8. On-Canvas Vertical Colorbar Legend (Right Edge) */}
          {showFemLayers && contourMode !== 'lithology' && (
            <g transform={`translate(${svgW - 42}, 52)`} pointerEvents="none">
              <rect
                x="-8"
                y="-16"
                width="44"
                height="182"
                rx="6"
                fill="#090D16"
                fillOpacity="0.92"
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x="14"
                y="-4"
                textAnchor="middle"
                fontSize="7.5"
                fontFamily="IBM Plex Mono, monospace"
                fontWeight="bold"
                fill="#f8fafc"
              >
                {legendMeta.title}
              </text>
              <rect
                x="2"
                y="4"
                width="10"
                height="148"
                rx="2"
                fill={`url(#legend-grad-${stageType})`}
                stroke="#64748b"
                strokeWidth="0.8"
              />
              <text
                x="15"
                y="12"
                fontSize="7.2"
                fontFamily="IBM Plex Mono, monospace"
                fontWeight="bold"
                fill="#ffffff"
              >
                {legendMeta.maxLabel}
              </text>
              <text
                x="15"
                y="80"
                fontSize="7.2"
                fontFamily="IBM Plex Mono, monospace"
                fill="#e2e8f0"
              >
                {legendMeta.midLabel}
              </text>
              <text
                x="15"
                y="151"
                fontSize="7.2"
                fontFamily="IBM Plex Mono, monospace"
                fill="#cbd5e1"
              >
                {legendMeta.minLabel}
              </text>
            </g>
          )}

          {/* 9. Bottom Scale Bar & Mesh Badge */}
          <g transform={`translate(18, ${svgH - 20})`} pointerEvents="none">
            <line
              x1="0"
              y1="0"
              x2={Math.round(scalePxPerM * 2)}
              y2="0"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#cbd5e1" strokeWidth="1.5" />
            <line
              x1={Math.round(scalePxPerM * 2)}
              y1="-4"
              x2={Math.round(scalePxPerM * 2)}
              y2="4"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            <text
              x={Math.round(scalePxPerM)}
              y="-5"
              textAnchor="middle"
              fontSize="7.8"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="bold"
              fill="#f8fafc"
            >
              2.0 m
            </text>
            <text
              x={Math.round(scalePxPerM * 2) + 10}
              y="3"
              fontSize="8"
              fontFamily="IBM Plex Mono, monospace"
              fill="#cbd5e1"
            >
              3-Node Triangular Mesh ({analysisResult.meshElements.length} CST Elements) • K0=
              {k0Param?.value ?? 1.15}
            </text>
          </g>
        </svg>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-2.5 sm:p-3.5 bg-[#0B0F19] text-slate-100 overflow-y-auto">
      {/* 1. ATTRACTIVE PROFESSIONAL HEADER BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-lg shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/40">
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
              FEM &amp; DEM Suite
            </span>
          </div>

          {/* 3 Analysis Mode Tabs */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-1">
            {(
              [
                ['fem', '1. FEM Continuum (Triangular Mesh)'],
                ['dem', '2. DEM Discontinuum (Key-Blocks)'],
                ['combined', '3. FEM + DEM Coupled'],
              ] as [FemDemAnalysisMode, string][]
            ).map(([mKey, mLabel]) => (
              <button
                key={mKey}
                type="button"
                onClick={() => handleSetMode(mKey)}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeMode === mKey
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mLabel}
              </button>
            ))}
          </div>

          {/* Present Scenario Context Pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-700 text-[11px] font-mono">
            <span className="text-amber-300 font-bold">{analysisResult.projectName}</span>
            <span className="text-slate-500">•</span>
            <span className="text-cyan-300 font-bold">{analysisResult.locationName}</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-300 font-bold">{analysisResult.chainageLabel}</span>
            <span className="text-slate-500">•</span>
            <span className="text-white font-semibold">
              {analysisResult.excavationShapeLabel} ({analysisResult.spanWidthM}m ×{' '}
              {analysisResult.totalHeightM}m)
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsParametersModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Open Full Parameters & Common Reference Values Window"
          >
            <Sliders className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Parameters ({analysisResult.parameters.length})</span>
          </button>

          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-slate-300 text-[11px] font-extrabold cursor-pointer shadow-sm hover:bg-slate-100"
            title="Append FEM & DEM Analysis Summary section to the ESWA Geological Report"
          >
            <input
              type="checkbox"
              checked={Boolean(femDemCfg.includeInEswaReport)}
              onChange={(e) => handleToggleIncludeInEswaReport(e.target.checked)}
              className="w-3.5 h-3.5 accent-sky-600 cursor-pointer"
            />
            <span>Include in ESWA Report</span>
          </label>

          <button
            type="button"
            onClick={() => setIsStandaloneReportOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Report</span>
          </button>

          <button
            type="button"
            onClick={onBackToSupport}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Support</span>
          </button>

          <button
            type="button"
            onClick={onContinueToNextStage}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-md"
          >
            <span>{nextStageLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. HIGH-CONTRAST LIGHT-THEMED QUICK PARAMETERS & CONTOUR CONTROLS BAR (SOLVES DARK VISIBILITY ISSUE) */}
      <div className="bg-white text-slate-900 border-2 border-slate-300 rounded-2xl px-3.5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Viewport Layout & Contour Field Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-0.5">
            {(
              [
                ['split', 'Split View'],
                ['before_only', 'Before Support'],
                ['after_only', 'After Support'],
              ] as [CanvasViewportLayout, string][]
            ).map(([vKey, vLabel]) => (
              <button
                key={vKey}
                type="button"
                onClick={() => setViewportLayout(vKey)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  viewportLayout === vKey
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                {vKey === 'split' ? (
                  <Columns className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span>{vLabel}</span>
              </button>
            ))}
          </div>

          {(activeMode === 'fem' || activeMode === 'combined') && (
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 border border-slate-300 rounded-xl p-0.5">
              <span className="text-[10.5px] font-black uppercase text-slate-700 px-2">
                Contour:
              </span>
              {(
                [
                  ['displacement', 'Displacement (ur)'],
                  ['sigma_theta', 'Stress (σθ)'],
                  ['strain', 'Shear Strain (γ)'],
                  ['fos', 'Strength / Stress FoS'],
                  ['lithology', 'Lithology'],
                ] as [FemFieldContourMode, string][]
              ).map(([cKey, cLabel]) => (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => setContourMode(cKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    contourMode === cKey
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {cLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: High-Contrast Parameter Inputs & Layer Checkboxes on Bright Background */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 border border-slate-300 rounded-xl px-3 py-1 text-[11px] font-mono">
            <label className="flex items-center gap-1 font-bold text-slate-800">
              <span>Cover H(m):</span>
              <input
                type="number"
                step="5"
                value={overburdenParam?.value ?? 85}
                onChange={(e) => handleOverrideParameter('overburdenDepthM', e.target.value)}
                className="w-16 px-1.5 py-0.5 rounded-md bg-white border-2 border-slate-400 text-slate-950 font-black text-right focus:border-sky-600 focus:outline-none"
              />
            </label>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 font-bold text-slate-800">
              <span>K0:</span>
              <input
                type="number"
                step="0.05"
                value={k0Param?.value ?? 1.15}
                onChange={(e) =>
                  handleOverrideParameter('horizontalStressRatioK0', e.target.value)
                }
                className="w-14 px-1.5 py-0.5 rounded-md bg-white border-2 border-slate-400 text-slate-950 font-black text-right focus:border-sky-600 focus:outline-none"
              />
            </label>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 font-bold text-slate-800">
              <span>UCS(MPa):</span>
              <input
                type="number"
                step="5"
                value={ucsParam?.value ?? 75}
                onChange={(e) => handleOverrideParameter('intactUcsMpa', e.target.value)}
                className="w-16 px-1.5 py-0.5 rounded-md bg-white border-2 border-slate-400 text-slate-950 font-black text-right focus:border-sky-600 focus:outline-none"
              />
            </label>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 font-bold text-slate-800">
              <span>Erm(GPa):</span>
              <input
                type="number"
                step="0.5"
                value={ermParam?.value ?? 6.5}
                onChange={(e) =>
                  handleOverrideParameter('rockMassModulusErmGpa', e.target.value)
                }
                className="w-16 px-1.5 py-0.5 rounded-md bg-white border-2 border-slate-400 text-slate-950 font-black text-right focus:border-sky-600 focus:outline-none"
              />
            </label>
          </div>

          {/* Layer Toggles on Crisp Light Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-800">
            {(activeMode === 'fem' || activeMode === 'combined') && (
              <>
                <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200">
                  <input
                    type="checkbox"
                    checked={showMeshWireframe}
                    onChange={(e) => setShowMeshWireframe(e.target.checked)}
                    className="accent-sky-600"
                  />
                  <span>Tri-Mesh</span>
                </label>
                <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200">
                  <input
                    type="checkbox"
                    checked={showPlasticBoundary}
                    onChange={(e) => setShowPlasticBoundary(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <span>Yield (Rp)</span>
                </label>
              </>
            )}
            <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200">
              <input
                type="checkbox"
                checked={showDeformedBoundary}
                onChange={(e) => setShowDeformedBoundary(e.target.checked)}
                className="accent-amber-600"
              />
              <span>Deformed Profile</span>
            </label>
            {(activeMode === 'dem' || activeMode === 'combined') && (
              <>
                <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200">
                  <input
                    type="checkbox"
                    checked={showJointNetwork}
                    onChange={(e) => setShowJointNetwork(e.target.checked)}
                    className="accent-amber-600"
                  />
                  <span>Joints</span>
                </label>
                <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200">
                  <input
                    type="checkbox"
                    checked={showKeyBlocks}
                    onChange={(e) => setShowKeyBlocks(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>Key-Blocks</span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. STRICT GEOTECHNICAL PREREQUISITE GATE OR HERO 2D TRIANGULAR FEM & DEM CANVAS VIEWPORTS */}
      {!analysisResult.prerequisites.isBeforeAnalysisReady ? (
        <div className="bg-rose-950/90 border-2 border-rose-500 rounded-2xl p-5 shadow-2xl space-y-4 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rose-500/40 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider">
                  Solver Blocked — Missing Geotechnical Data
                </span>
                <span className="text-sm font-black uppercase tracking-wider text-rose-100">
                  FEM &amp; DEM Analysis Cannot Run Without Required Field &amp; Classification Inputs
                </span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed max-w-4xl">
                Professional numerical stability modeling requires real site inputs. The solver will not fabricate or pre-fill unassessed classifications, rock strength, or overburden stress. Please complete the missing requirements below to unlock the FEM &amp; DEM solver:
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToSupport}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Return to Previous Stages to Complete Data</span>
            </button>
          </div>

          {/* Checklist of Required Geotechnical Prerequisites */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div
              className={`rounded-xl p-3 border ${
                analysisResult.prerequisites.hasClassification
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                  : 'bg-slate-950/80 border-rose-500/60 text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between font-black uppercase text-[11px] mb-1">
                <span>1. Rock Mass Classification</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                    analysisResult.prerequisites.hasClassification
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {analysisResult.prerequisites.hasClassification ? 'READY' : 'MISSING'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 font-mono">
                RMR89: {analysisResult.rmrValue ?? 'Not Assessed'} | Q:{' '}
                {analysisResult.qValue ?? 'Not Assessed'} | GSI:{' '}
                {analysisResult.gsiValue ?? 'Not Assessed'}
              </p>
            </div>

            <div
              className={`rounded-xl p-3 border ${
                analysisResult.prerequisites.hasRockStrengthOrLithology
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                  : 'bg-slate-950/80 border-rose-500/60 text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between font-black uppercase text-[11px] mb-1">
                <span>2. Lithology &amp; Intact Strength</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                    analysisResult.prerequisites.hasRockStrengthOrLithology
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {analysisResult.prerequisites.hasRockStrengthOrLithology ? 'READY' : 'MISSING'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 font-mono">
                Lithology: {analysisResult.dominantLithology} • Weathering:{' '}
                {analysisResult.weatheringGrade}
              </p>
            </div>

            <div
              className={`rounded-xl p-3 border ${
                analysisResult.prerequisites.hasOverburden
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                  : 'bg-slate-950/80 border-rose-500/60 text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between font-black uppercase text-[11px] mb-1">
                <span>3. Overburden Cover Depth (H)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                    analysisResult.prerequisites.hasOverburden
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {analysisResult.prerequisites.hasOverburden ? 'READY' : 'MISSING'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 font-mono">
                {analysisResult.prerequisites.hasOverburden
                  ? `H = ${overburdenParam?.value} m (σv = ${analysisResult.inSituVerticalStressMpa} MPa)`
                  : 'Enter Overburden Depth H(m) below'}
              </p>
            </div>

            <div
              className={`rounded-xl p-3 border ${
                analysisResult.supportBreakdown.isSupportConfirmedInstalled
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                  : 'bg-amber-950/70 border-amber-500/60 text-amber-100'
              }`}
            >
              <div className="flex items-center justify-between font-black uppercase text-[11px] mb-1">
                <span>4. Installed Support (Stage B)</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                    analysisResult.supportBreakdown.isSupportConfirmedInstalled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {analysisResult.supportBreakdown.isSupportConfirmedInstalled
                    ? 'CONFIGURED'
                    : 'NOT CONFIGURED'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 font-mono">
                {analysisResult.supportBreakdown.isSupportConfirmedInstalled
                  ? analysisResult.supportBreakdown.activeSystemsSummary.join(' + ')
                  : 'Stage B (After Support) requires Support System'}
              </p>
            </div>
          </div>

          {/* Detailed Missing Items List + Direct Quick Entry for Overburden & UCS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
            <div className="lg:col-span-7 bg-slate-950/90 border border-rose-500/40 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-black uppercase text-rose-300">
                Missing Prerequisite Items Blocking Analysis:
              </div>
              <ul className="space-y-1.5 text-xs text-rose-100 list-disc list-inside">
                {analysisResult.prerequisites.missingBeforeRequirements.map((req, idx) => (
                  <li key={idx} className="leading-snug">
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-5 bg-slate-950/90 border border-amber-500/50 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-black uppercase text-amber-300">
                Quick Field Entry for Stress &amp; Intact Rock Parameters:
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <label className="block space-y-1">
                  <span className="text-[10.5px] font-bold text-slate-300">
                    Overburden Depth H (m):
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    placeholder="e.g. 120"
                    value={
                      femDemCfg.overburdenDepthM ??
                      femDemCfg.parameterOverrides?.overburdenDepthM ??
                      ''
                    }
                    onChange={(e) => handleOverrideParameter('overburdenDepthM', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/60 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10.5px] font-bold text-slate-300">
                    Intact UCS σci (MPa):
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    placeholder="e.g. 75"
                    value={femDemCfg.parameterOverrides?.intactUcsMpa ?? ''}
                    onChange={(e) => handleOverrideParameter('intactUcsMpa', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/60 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-3 shrink-0 ${
            viewportLayout === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {/* VIEWPORT 1: BEFORE SUPPORT (UNSUPPORTED EXCAVATION) */}
          {(viewportLayout === 'split' || viewportLayout === 'before_only') && (
            <div className="bg-slate-900 border-2 border-rose-500/45 rounded-2xl p-3 flex flex-col gap-2.5 shadow-xl shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  <span className="text-xs font-black uppercase tracking-wider text-rose-200">
                    Stage A: Before Support (Unreinforced • {analysisResult.excavationShapeLabel})
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black border ${
                    analysisResult.combinedInteraction.combinedStabilityStatusBefore === 'STABLE'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : analysisResult.combinedInteraction.combinedStabilityStatusBefore ===
                        'MARGINAL / YIELDING'
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-rose-500 text-white border-rose-300'
                  }`}
                >
                  {analysisResult.combinedInteraction.combinedStabilityStatusBefore}
                </span>
              </div>

              {renderCrossSectionSvg('before')}

              {/* High-Contrast KPI Strip below Before-Support Canvas */}
              <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                    Max Disp (u_max)
                  </div>
                  <div className="text-rose-700 font-black text-xs">
                    {analysisResult.femBefore.maxDisplacementMm.toFixed(2)} mm
                  </div>
                </div>
                <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                    Yield Depth (dp)
                  </div>
                  <div className="text-rose-700 font-black text-xs">
                    {analysisResult.femBefore.plasticZoneDepthMeters.toFixed(2)} m
                  </div>
                </div>
                <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                    FEM Continuum FoS
                  </div>
                  <div className="text-amber-700 font-black text-xs">
                    {analysisResult.femBefore.continuumFactorOfSafety.toFixed(2)}
                  </div>
                </div>
                <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                  <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                    DEM Key-Block FoS
                  </div>
                  <div className="text-rose-700 font-black text-xs">
                    {analysisResult.minBlockFosBefore.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEWPORT 2: AFTER SUPPORT (REINFORCED WITH ESWA INSTALLED SUPPORT) */}
          {(viewportLayout === 'split' || viewportLayout === 'after_only') && (
            <div className="bg-slate-900 border-2 border-emerald-500/45 rounded-2xl p-3 flex flex-col gap-2.5 shadow-xl shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      analysisResult.supportBreakdown.isSupportConfirmedInstalled
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                    }`}
                  />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
                    {analysisResult.supportBreakdown.isSupportConfirmedInstalled
                      ? `Stage B: After ESWA Support (pi = ${analysisResult.femAfter.internalSupportPressureMpa.toFixed(3)} MPa)`
                      : 'Stage B: After ESWA Support — Blocked (No Support Configured)'}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black border ${
                    !analysisResult.supportBreakdown.isSupportConfirmedInstalled
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : analysisResult.combinedInteraction.combinedStabilityStatusAfter === 'STABLE'
                      ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                      : analysisResult.combinedInteraction.combinedStabilityStatusAfter ===
                        'MARGINAL / YIELDING'
                      ? 'bg-amber-400 text-slate-950 border-amber-200'
                      : 'bg-rose-500 text-white border-rose-300'
                  }`}
                >
                  {!analysisResult.supportBreakdown.isSupportConfirmedInstalled
                    ? 'NO SUPPORT CONFIGURED'
                    : analysisResult.combinedInteraction.combinedStabilityStatusAfter}
                </span>
              </div>

              {!analysisResult.supportBreakdown.isSupportConfirmedInstalled ? (
                <div className="w-full h-[470px] xl:h-[540px] min-h-[450px] bg-slate-950/95 rounded-xl border-2 border-dashed border-amber-500/60 p-6 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-xl">
                    !
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <div className="text-sm font-black uppercase tracking-wider text-amber-300">
                      Stage B (After Support) Blocked — No Support System Installed
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Before/After support comparison cannot be simulated when no support system is configured. Please configure Rock Bolts, Shotcrete, Wire Mesh, Lattice Girders, or Steel Ribs in the Support System stage first.
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-left text-[11px] text-amber-200/90 max-w-md w-full space-y-1">
                    <div className="font-black uppercase text-[10px] text-amber-400">
                      Missing Stage B Requirements:
                    </div>
                    {analysisResult.prerequisites.missingAfterRequirements.map((req, i) => (
                      <div key={i}>• {req}</div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onBackToSupport}
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                    <span>Go to Support System Stage to Configure Support</span>
                  </button>
                </div>
              ) : (
                <>
                  {renderCrossSectionSvg('after')}

                  {/* High-Contrast KPI Strip below After-Support Canvas */}
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                        Max Disp (u_max)
                      </div>
                      <div className="text-emerald-700 font-black text-xs">
                        {analysisResult.femAfter.maxDisplacementMm.toFixed(2)} mm
                      </div>
                    </div>
                    <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                        Yield Depth (dp)
                      </div>
                      <div className="text-emerald-700 font-black text-xs">
                        {analysisResult.femAfter.plasticZoneDepthMeters.toFixed(2)} m
                      </div>
                    </div>
                    <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                        FEM Continuum FoS
                      </div>
                      <div className="text-emerald-700 font-black text-xs">
                        {analysisResult.femAfter.continuumFactorOfSafety.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white text-slate-900 border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <div className="text-slate-600 font-sans font-bold text-[9.5px] uppercase">
                        DEM Key-Block FoS
                      </div>
                      <div className="text-emerald-700 font-black text-xs">
                        {analysisResult.minBlockFosAfter.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. CRYSTAL-CLEAR LIGHT-THEMED GEOTECHNICAL PARAMETERS & INSPECTOR SECTION (NO DARK BACKGROUND VISIBILITY PROBLEM) */}
      <div className="bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-2xl p-3.5 shadow-lg space-y-3 shrink-0">
        {/* Top Row: Selected Element / Block Inspector + Ground Reaction Curve on Crisp White Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Inspector Card (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-300 rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2">
            {selectedElement ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-sky-800">
                    Inspected 3-Node Triangle Element: {selectedElement.id} (
                    {selectedElement.lithologyName} • r/Req={selectedElement.radiusNorm} @{' '}
                    {selectedElement.sectorAngleDeg}°)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedElementId(null)}
                    className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10.5px] font-bold cursor-pointer"
                  >
                    Switch to Key-Block Inspector
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Tangential Stress σθ
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedElement.sigmaThetaBeforeMpa} →{' '}
                      <span className="text-emerald-700">
                        {selectedElement.sigmaThetaAfterMpa} MPa
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Radial Stress σr
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedElement.sigmaRadialBeforeMpa} →{' '}
                      <span className="text-emerald-700">
                        {selectedElement.sigmaRadialAfterMpa} MPa
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Radial Disp ur
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedElement.displacementBeforeMm} →{' '}
                      <span className="text-emerald-700">
                        {selectedElement.displacementAfterMm} mm
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Element FoS
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedElement.localFosBefore} →{' '}
                      <span className="text-emerald-700">{selectedElement.localFosAfter}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedBlock ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-slate-900">
                    DEM Key-Block Inspector: {selectedBlock.label} (
                    {selectedBlock.controllingSets.join(' × ')} • {selectedBlock.failureMode})
                  </span>
                  <div className="flex items-center gap-1">
                    {(analysisResult.demKeyBlocks || []).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBlockId(b.id)}
                        className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black cursor-pointer ${
                          selectedBlock.id === b.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {b.id.replace('KB-', '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Apex / Weight
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedBlock.apexDepthMeters.toFixed(2)}m /{' '}
                      {selectedBlock.weightKnPerM.toFixed(0)} kN/m
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Driving vs Resist
                    </div>
                    <div className="text-slate-900 font-black">
                      {selectedBlock.drivingForceKn.toFixed(0)} vs{' '}
                      <span className="text-emerald-700">
                        {selectedBlock.resistingForceAfterKn.toFixed(0)} kN
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Block FoS (Before→After)
                    </div>
                    <div className="text-rose-700 font-black">
                      {selectedBlock.fosBefore.toFixed(2)} →{' '}
                      <span className="text-emerald-700">
                        {selectedBlock.fosAfter.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                    <div className="text-slate-600 font-sans font-bold text-[10px]">
                      Active ESWA Support
                    </div>
                    <div className="text-sky-800 font-black truncate">
                      +{selectedBlock.supportForceAddedKn.toFixed(0)} kN/m (
                      {selectedBlock.boltsIntersectingCount} bolts)
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Ground Reaction Curve (GRC) Card (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-300 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <svg
              viewBox="0 0 280 110"
              className="w-48 sm:w-56 h-24 shrink-0 bg-slate-900 rounded-lg border border-slate-700"
            >
              <line x1="28" y1="10" x2="28" y2="92" stroke="#64748b" strokeWidth="1" />
              <line x1="28" y1="92" x2="268" y2="92" stroke="#64748b" strokeWidth="1" />
              {(() => {
                const grcPts = analysisResult.grcCurve || [];
                const maxU = Math.max(5, analysisResult.femBefore.maxDisplacementMm * 1.15);
                const maxP = Math.max(0.5, analysisResult.inSituHydrostaticStressMpa);
                const polyPts = grcPts
                  .map((pt) => {
                    const x = 28 + (pt.radialDisplacementMm / maxU) * 228;
                    const y = 92 - (pt.supportPressureMpa / maxP) * 76;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');
                const eqX =
                  28 + (analysisResult.femAfter.maxDisplacementMm / maxU) * 228;
                const eqY =
                  92 -
                  (analysisResult.femAfter.internalSupportPressureMpa / maxP) * 76;
                return (
                  <>
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.4"
                      points={polyPts}
                    />
                    {analysisResult.supportBreakdown.isSupportConfirmedInstalled && (
                      <>
                        <line
                          x1={28 + ((analysisResult.femBefore.maxDisplacementMm * 0.3) / maxU) * 228}
                          y1={92}
                          x2={eqX}
                          y2={eqY}
                          stroke="#10b981"
                          strokeWidth="2.2"
                          strokeDasharray="3 2"
                        />
                        <circle
                          cx={eqX}
                          cy={eqY}
                          r="4.2"
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth="1.2"
                        />
                      </>
                    )}
                  </>
                );
              })()}
              <text
                x="148"
                y="106"
                textAnchor="middle"
                fontSize="7.5"
                fill="#cbd5e1"
                fontFamily="monospace"
              >
                Radial Displacement ur (mm)
              </text>
              <text x="34" y="18" fontSize="7.5" fill="#38bdf8" fontFamily="monospace" fontWeight="bold">
                GRC: pi vs ur
              </text>
            </svg>
            <div className="flex-1 min-w-0 space-y-1 text-xs">
              <div className="font-black uppercase text-slate-900">
                Ground–Support Equilibrium
              </div>
              <div className="text-slate-700 font-mono">
                p_cr ={' '}
                <span className="text-amber-700 font-black">
                  {analysisResult.criticalSupportPressureMpa} MPa
                </span>
              </div>
              <div className="text-slate-700 font-mono">
                p_eq ={' '}
                <span className="text-emerald-700 font-black">
                  {analysisResult.femAfter.internalSupportPressureMpa} MPa
                </span>
              </div>
              <div
                className="text-slate-600 font-semibold text-[11px] truncate"
                title={analysisResult.supportBreakdown.activeSystemsSummary.join(' + ')}
              >
                {analysisResult.supportBreakdown.activeSystemsSummary.length > 0
                  ? analysisResult.supportBreakdown.activeSystemsSummary.join(' • ')
                  : 'No support enabled in Stage 8'}
              </div>
            </div>
          </div>
        </div>

        {/* High-Contrast Light-Themed Parameters & Reference Values Section */}
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                Geotechnical Parameters &amp; Common Reference Values ({analysisResult.dominantLithology} •{' '}
                {analysisResult.weatheringGrade})
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                {analysisResult.estimatedParametersCount} ESTIMATED / REFERENCE
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['ALL', 'All (20)'],
                  ['stress_hydraulic', 'Stress & Water'],
                  ['intact_rock', 'Intact Rock'],
                  ['rock_mass_fem', 'Rock Mass (FEM)'],
                  ['joint_dem', 'Joints (DEM)'],
                ] as const
              ).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    setSelectedParamCategory(catKey);
                    setIsParametersSectionExpanded(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer transition-all ${
                    selectedParamCategory === catKey
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {catLabel}
                </button>
              ))}

              <button
                type="button"
                onClick={handleResetAllOverrides}
                className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={() => setIsParametersSectionExpanded((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
              >
                {isParametersSectionExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isParametersSectionExpanded && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/60">
              {filteredParameters.map((param) => {
                const lStyle = LIGHT_PROVENANCE_STYLE_MAP[param.provenance];
                const isOverridden = param.provenance === 'ENGINEER_OVERRIDE';
                return (
                  <div
                    key={param.key}
                    className={`rounded-xl p-2.5 border-2 ${lStyle.cardBg} ${lStyle.cardBorder} shadow-sm flex flex-col justify-between gap-1.5`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-black text-slate-900 leading-tight">
                          {param.label}{' '}
                          <span className="text-sky-700 font-mono">({param.symbol})</span>
                        </div>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${lStyle.badgeBg} ${lStyle.badgeText} ${lStyle.badgeBorder}`}
                        >
                          {param.provenanceBadge}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={
                            femDemCfg.parameterOverrides?.[param.key] !== undefined
                              ? femDemCfg.parameterOverrides[param.key]
                              : param.value
                          }
                          onChange={(e) => handleOverrideParameter(param.key, e.target.value)}
                          className={`w-20 px-2 py-1 rounded-lg bg-white border-2 text-xs font-mono font-black text-right focus:outline-none ${
                            isOverridden
                              ? 'border-violet-600 text-violet-950 bg-violet-50'
                              : 'border-slate-400 text-slate-950 focus:border-sky-600'
                          }`}
                        />
                        <span className="text-[10.5px] font-mono font-bold text-slate-700">
                          {param.unit}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-700 font-mono font-semibold flex items-center justify-between border-t border-slate-200/80 pt-1">
                      <span>Range: {param.applicableRange}</span>
                      <span>
                        Ref: {param.defaultReferenceValue} {param.unit}
                      </span>
                    </div>
                    <div
                      className="text-[10px] text-slate-600 font-medium truncate"
                      title={param.referenceSource}
                    >
                      Ref: {param.referenceSource}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* HIGH-CONTRAST LIGHT-THEMED PARAMETERS MODAL (When opened via Top Bar "Parameters" Button) */}
      {isParametersModalOpen && (
        <div
          onClick={() => setIsParametersModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full max-h-[88vh] bg-white text-slate-900 border-2 border-slate-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Geotechnical Parameters &amp; Common Reference Values ({analysisResult.dominantLithology})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAllOverrides}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Overrides</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsParametersModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['ALL', 'All Parameters (20)'],
                    ['stress_hydraulic', 'Stress & Water'],
                    ['intact_rock', 'Intact Rock'],
                    ['rock_mass_fem', 'Rock Mass (FEM)'],
                    ['joint_dem', 'Joints (DEM)'],
                  ] as const
                ).map(([catKey, catLabel]) => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedParamCategory(catKey)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                      selectedParamCategory === catKey
                        ? 'bg-slate-900 text-white shadow'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    {catLabel}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md font-bold">
                All estimated values are badged as ESTIMATED / COMMON REFERENCE VALUE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50">
              {filteredParameters.map((param) => {
                const lStyle = LIGHT_PROVENANCE_STYLE_MAP[param.provenance];
                const isOverridden = param.provenance === 'ENGINEER_OVERRIDE';
                return (
                  <div
                    key={param.key}
                    className={`rounded-xl p-3 border-2 ${lStyle.cardBg} ${lStyle.cardBorder} shadow-sm flex flex-col justify-between gap-2`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          {param.label}{' '}
                          <span className="text-sky-700 font-mono">({param.symbol})</span>
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-[9.5px] font-black uppercase border ${lStyle.badgeBg} ${lStyle.badgeText} ${lStyle.badgeBorder}`}
                        >
                          {param.provenanceBadge}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={
                            femDemCfg.parameterOverrides?.[param.key] !== undefined
                              ? femDemCfg.parameterOverrides[param.key]
                              : param.value
                          }
                          onChange={(e) => handleOverrideParameter(param.key, e.target.value)}
                          className={`w-24 px-2.5 py-1 rounded-lg bg-white border-2 text-xs font-mono font-black text-right ${
                            isOverridden
                              ? 'border-violet-600 text-violet-950 bg-violet-50'
                              : 'border-slate-400 text-slate-950'
                          }`}
                        />
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {param.unit}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-800 font-mono font-semibold flex items-center justify-between border-t border-slate-200 pt-1.5">
                      <span>Valid Range: {param.applicableRange}</span>
                      <span>
                        Default Ref: {param.defaultReferenceValue} {param.unit}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 leading-snug">
                      <strong>Reference Source:</strong> {param.referenceSource}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STANDALONE REPORT PREVIEW & EXPORT MODAL */}
      {isStandaloneReportOpen && (
        <div
          onClick={() => setIsStandaloneReportOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Standalone FEM &amp; DEM Geotechnical Analysis Report —{' '}
                  {analysisResult.chainageLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportStandaloneFemDemWordReport(analysisResult, activeRound)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Word (.DOC)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStandaloneReportOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-white text-slate-900 space-y-4 text-xs">
              <div className="border-b-2 border-slate-900 pb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-black uppercase text-slate-900">
                    ESWA GEOLOGICAL MAPPER — FEM &amp; DEM GEOTECHNICAL ANALYSIS REPORT
                  </h2>
                  <p className="text-xs text-slate-600 font-mono">
                    Project: {analysisResult.projectName} | Location: {analysisResult.locationName}{' '}
                    | Section: {analysisResult.chainageLabel}
                  </p>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-700">
                  <div>Mode: {activeMode.toUpperCase()}</div>
                  <div>
                    Q={analysisResult.qValue ?? 'Not Assessed'} | RMR=
                    {analysisResult.rmrValue ?? 'Not Assessed'} | GSI=
                    {analysisResult.gsiValue ?? 'Not Assessed'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-100 p-3 rounded-lg border border-slate-300">
                <div>
                  <div className="font-black uppercase text-[10px] text-slate-600">
                    Before Support (Unreinforced)
                  </div>
                  {!analysisResult.prerequisites.isBeforeAnalysisReady ? (
                    <div className="font-mono mt-1 text-rose-700 font-bold">
                      Prerequisite Geotechnical Data Incomplete
                    </div>
                  ) : (
                    <>
                      <div className="font-mono mt-1">
                        Max Displacement:{' '}
                        <strong>{analysisResult.femBefore.maxDisplacementMm} mm</strong> | Yield
                        Depth: <strong>{analysisResult.femBefore.plasticZoneDepthMeters} m</strong>
                      </div>
                      <div className="font-mono">
                        FoS (FEM):{' '}
                        <strong>{analysisResult.femBefore.continuumFactorOfSafety}</strong> | FoS
                        (DEM): <strong>{analysisResult.minBlockFosBefore}</strong>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <div className="font-black uppercase text-[10px] text-slate-600">
                    After Support (ESWA Installed Support)
                  </div>
                  {!analysisResult.supportBreakdown.isSupportConfirmedInstalled ? (
                    <div className="font-mono mt-1 text-amber-800 font-bold">
                      Not Simulated — No Support System Configured in Stage 8
                    </div>
                  ) : (
                    <>
                      <div className="font-mono mt-1">
                        Max Displacement:{' '}
                        <strong>{analysisResult.femAfter.maxDisplacementMm} mm</strong> | Yield
                        Depth: <strong>{analysisResult.femAfter.plasticZoneDepthMeters} m</strong>
                      </div>
                      <div className="font-mono">
                        FoS (FEM):{' '}
                        <strong>{analysisResult.femAfter.continuumFactorOfSafety}</strong> | FoS
                        (DEM): <strong>{analysisResult.minBlockFosAfter}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const FieldFemDemReportEmbedSection: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  surfaceParams,
}) => {
  const result = useMemo(
    () =>
      runCompleteFemDemAnalysis(
        activeProject,
        activeLocation,
        activeRound,
        mappingDomain,
        surfaceParams
      ),
    [activeProject, activeLocation, activeRound, mappingDomain, surfaceParams]
  );

  return (
    <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white">
      <thead>
        <tr className="bg-white">
          <th
            colSpan={4}
            className="border border-slate-900 bg-white py-1 px-2 text-left font-black uppercase"
          >
            7. INTEGRATED FEM &amp; DEM NUMERICAL STABILITY SUMMARY (BEFORE VS. AFTER SUPPORT)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th className="border border-slate-900 px-2 py-1 text-left w-[24%]">
            Before Support (pi = 0 MPa)
          </th>
          <td className="border border-slate-900 px-2 py-1 font-mono w-[26%]">
            u_max = {result.femBefore.maxDisplacementMm.toFixed(2)} mm | dp ={' '}
            {result.femBefore.plasticZoneDepthMeters.toFixed(2)} m | FoS(FEM) ={' '}
            {result.femBefore.continuumFactorOfSafety.toFixed(2)} | FoS(DEM) ={' '}
            {result.minBlockFosBefore.toFixed(2)}
          </td>
          <th className="border border-slate-900 px-2 py-1 text-left w-[24%]">
            After Support (pi = {result.femAfter.internalSupportPressureMpa.toFixed(3)} MPa)
          </th>
          <td className="border border-slate-900 px-2 py-1 font-mono font-bold w-[26%]">
            {result.supportBreakdown.isSupportConfirmedInstalled ? (
              <>
                u_max = {result.femAfter.maxDisplacementMm.toFixed(2)} mm | dp ={' '}
                {result.femAfter.plasticZoneDepthMeters.toFixed(2)} m | FoS(FEM) ={' '}
                {result.femAfter.continuumFactorOfSafety.toFixed(2)} | FoS(DEM) ={' '}
                {result.minBlockFosAfter.toFixed(2)}
              </>
            ) : (
              'Not Applicable — No Support System Installed'
            )}
          </td>
        </tr>
        <tr>
          <th className="border border-slate-900 px-2 py-1 text-left">
            Installed ESWA Support &amp; Reference Basis
          </th>
          <td colSpan={3} className="border border-slate-900 px-2 py-1">
            <strong>Support:</strong>{' '}
            {result.supportBreakdown.activeSystemsSummary.join(' + ') || 'Unreinforced'} |{' '}
            <strong>Status:</strong> {result.combinedInteraction.combinedStabilityStatusAfter} (
            {result.estimatedParametersCount} parameters badged as ESTIMATED / COMMON REFERENCE
            VALUE for {result.dominantLithology}, {result.weatheringGrade}).
          </td>
        </tr>
      </tbody>
    </table>
  );
};
