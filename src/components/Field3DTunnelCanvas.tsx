import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Check,
  Compass,
  CornerDownRight,
  Crosshair,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Maximize2,
  Move,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  buildDipSurfacePolygonWithOutlineSnap,
  buildSmoothSvgPath,
  computeFaceTunnelOutlineDetails,
  computePanelCanvasGeometry,
  estimateTraceOrientationFromGeometry,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_STRUCTURAL_FEATURE_CATALOG,
  FieldDipPlaneSurface,
  FieldExcavationRound,
  FieldJointGroupingId,
  FieldJointTrace,
  FieldLithologyId,
  FieldLithologyStroke,
  FieldPanelId,
  FieldPoint2D,
  FieldRememberedRockItem,
  FieldStructuralFeature,
  FieldStructuralFeatureType,
  FieldTunnelLocationItem,
  FieldWaterCondition,
  FieldWaterMark,
  FieldFaultSubType,
  FieldFaultElementRole,
  FieldFoldSubType,
  FieldFoldElementRole,
  pruneFullyErasedLithologyStrokes,
  resolveRockDisplayInfo,
  smoothFieldTracePoints,
} from '../engine/fieldMappingEngine';
import {
  computeUnfoldedStripBoxes,
  FieldMonochromeGeologicalPatterns,
  FieldStructuralFeatureSvgRenderer,
  FieldVeinFoliationBandSvgElement,
  FieldWaterSymbolSvgRenderer,
} from './FieldMappingCompassAndPatterns';

export type Field3DViewSubMode = 'open_heading' | 'origami_fold';

function isPointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const dy = yj - yi;
    if (Math.abs(dy) > 1e-7) {
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / dy + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

/**
 * Multi-pass pen smoothing filter for 3D & 2D traces based on user-selected smoothing level.
 */
function smoothTraceWithLevel(
  rawPoints: FieldPoint2D[],
  level: 'off' | 'normal' | 'high'
): FieldPoint2D[] {
  if (rawPoints.length <= 2 || level === 'off') {
    return rawPoints;
  }
  let pts = smoothFieldTracePoints(rawPoints);
  if (level === 'high' && pts.length >= 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    let curr = pts.map((p) => ({ ...p }));
    for (let pass = 0; pass < 3; pass++) {
      const next: FieldPoint2D[] = [first];
      for (let i = 1; i < curr.length - 1; i++) {
        next.push({
          x: Number((0.25 * curr[i - 1].x + 0.5 * curr[i].x + 0.25 * curr[i + 1].x).toFixed(1)),
          y: Number((0.25 * curr[i - 1].y + 0.5 * curr[i].y + 0.25 * curr[i + 1].y).toFixed(1)),
        });
      }
      next.push(last);
      curr = next;
    }
    pts = curr;
  }
  return pts;
}

/**
 * Densifies a polyline so point-based brush erasing cleanly carves out the middle of long segments.
 */
function densifyPolylinePoints(points: FieldPoint2D[], maxStepPx = 8): FieldPoint2D[] {
  if (points.length < 2) return points;
  const out: FieldPoint2D[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const steps = Math.max(1, Math.ceil(dist / maxStepPx));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({
        x: Number((p0.x + (p1.x - p0.x) * t).toFixed(1)),
        y: Number((p0.y + (p1.y - p0.y) * t).toFixed(1)),
      });
    }
  }
  return out;
}

export interface Field3DSyncTraceSample {
  panel: FieldPanelId;
  panelPt: FieldPoint2D;
  u: number;
  v: number;
  pullMeter: number;
  perimMeter: number;
}

export interface Field3DSyncTraceState {
  isDrawing: boolean;
  liveSamples: Field3DSyncTraceSample[];
  latestCompletedIds: string[];
  hoverInfo: {
    panel: FieldPanelId;
    u: number;
    v: number;
    pullMeter: number;
    perimMeter: number;
  } | null;
}

type FieldCanvasTool =
  | '1_lithology'
  | '2_vein_foliation'
  | '3_joint_trace'
  | '4_dip_surface'
  | '5_geo_feature'
  | '6_water_mark'
  | 'eraser'
  | 'litho_eraser';

/**
 * Generates an inline SVG cursor data URI for each active Field Mapping Tool
 * (Eraser, Lithology Brush, Pencil Joint Trace, Dip Surface, Vein, Fault/Fold Feature, Water Droplet)
 * based on active tool requirements.
 */
export function getFieldToolCursorDataUri(
  activeTool: string,
  lithologySubMode: 'paint' | 'erase_area' = 'paint',
  extraOpts?: {
    jointColor?: string;
    rockColor?: string;
    geoFeatureType?: FieldStructuralFeatureType;
  }
): string {
  const isErase =
    activeTool === 'eraser' ||
    activeTool === 'litho_eraser' ||
    (activeTool === '1_lithology' && lithologySubMode === 'erase_area');
  if (isErase) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="5" cy="27" r="4" fill="rgba(239,68,68,0.35)" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="2 1.5"/><path d="M16 4 L28 16 L15 29 L4 29 L3 18 Z" fill="#fca5a5" stroke="#991b1b" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 10 L22 22 L15 29 L4 29 L3 18 Z" fill="#fee2e2" stroke="#991b1b" stroke-width="1.5" stroke-linejoin="round"/><circle cx="5" cy="27" r="1.5" fill="#dc2626"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 5 27, crosshair`;
  }
  if (activeTool === '1_lithology') {
    const brushCol = extraOpts?.rockColor || '#10b981';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="4" cy="28" r="3.5" fill="none" stroke="${brushCol}" stroke-width="1.5" stroke-dasharray="2 1.5"/><path d="M23 3 L29 9 L16 22 L10 16 Z" fill="#f59e0b" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 16 L16 22 C13 26 9 28 3 29 C4 23 6 19 10 16 Z" fill="${brushCol}" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="3.5" cy="28.5" r="1.4" fill="#0f172a"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 28, crosshair`;
  }
  if (activeTool === '3_joint_trace') {
    const jCol = extraOpts?.jointColor || '#0284c7';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><line x1="2" y1="30" x2="10" y2="22" stroke="${jCol}" stroke-width="2.4" stroke-linecap="round"/><path d="M22 3 L29 10 L12 27 L5 27 L5 20 Z" fill="${jCol}" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><polygon points="5,20 12,27 3,29" fill="#fde68a" stroke="#0f172a" stroke-width="1.3"/><circle cx="3" cy="29" r="1.6" fill="${jCol}"/><text x="19" y="29" font-family="monospace" font-size="8.5" font-weight="900" fill="${jCol}" stroke="#ffffff" stroke-width="2" paint-order="stroke">J</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 29, crosshair`;
  }
  if (activeTool === '2_vein_foliation') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M22 3 L29 10 L12 27 L5 27 L5 20 Z" fill="#d97706" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><polygon points="5,20 12,27 3,29" fill="#fde68a" stroke="#0f172a" stroke-width="1.3"/><circle cx="3" cy="29" r="1.5" fill="#b45309"/><text x="17" y="29" font-family="monospace" font-size="8" font-weight="900" fill="#b45309" stroke="#ffffff" stroke-width="2" paint-order="stroke">VN</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 29, crosshair`;
  }
  if (activeTool === '4_dip_surface') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M22 3 L29 10 L12 27 L5 27 L5 20 Z" fill="#0d9488" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><polygon points="5,20 12,27 3,29" fill="#fde68a" stroke="#0f172a" stroke-width="1.3"/><circle cx="3" cy="29" r="1.5" fill="#0f766e"/><text x="16" y="29" font-family="monospace" font-size="7.5" font-weight="900" fill="#0f766e" stroke="#ffffff" stroke-width="2" paint-order="stroke">DIP</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 29, crosshair`;
  }
  if (activeTool === '5_geo_feature') {
    const isFold = extraOpts?.geoFeatureType === 'fold_axis';
    const fCol = isFold ? '#9333ea' : '#dc2626';
    const tag = isFold ? 'FD' : 'FLT';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M22 3 L29 10 L12 27 L5 27 L5 20 Z" fill="${fCol}" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><polygon points="5,20 12,27 3,29" fill="#fde68a" stroke="#0f172a" stroke-width="1.3"/><circle cx="3" cy="29" r="1.5" fill="${fCol}"/><text x="14" y="29" font-family="monospace" font-size="7.5" font-weight="900" fill="${fCol}" stroke="#ffffff" stroke-width="2" paint-order="stroke">${tag}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 29, crosshair`;
  }
  if (activeTool === '6_water_mark') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 4 C16 4 25 15 25 21 C25 26 21 29 16 29 C11 29 7 26 7 21 C7 15 16 4 16 4 Z" fill="#0ea5e9" stroke="#0f172a" stroke-width="1.6"/><circle cx="13" cy="20" r="2" fill="#e0f2fe"/><circle cx="4" cy="28" r="2" fill="#0284c7" stroke="#ffffff" stroke-width="1"/></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 4 28, crosshair`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M22 3 L29 10 L12 27 L5 27 L5 20 Z" fill="#fbbf24" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/><polygon points="5,20 12,27 3,29" fill="#fde68a" stroke="#0f172a" stroke-width="1.3"/><circle cx="3" cy="29" r="1.5" fill="#0f172a"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 29, crosshair`;
}

interface Field3DTunnelCanvasProps {
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  activeTool: FieldCanvasTool;
  selectedRockType: FieldLithologyId;
  lithologySubMode: 'paint' | 'erase_area';
  veinOrFoliationSubMode: 'vein_band' | 'foliation_plane';
  selectedVeinRockId: string;
  selectedGeoFeatureType: FieldStructuralFeatureType;
  selectedFaultSubType?: FieldFaultSubType;
  selectedFaultElementRole?: FieldFaultElementRole;
  showHwFwBadges?: boolean;
  selectedFoldSubType?: FieldFoldSubType;
  selectedFoldElementRole?: FieldFoldElementRole;
  showFoldLimbCrestBadges?: boolean;
  alternatingBandMode?: boolean | string;
  alternatingRockIds?: string[];
  alternatingSpacingPx?: number;
  selectedWaterCondition: FieldWaterCondition;
  activeGroupingSet: FieldJointGroupingId;
  brushRadius: number;
  lithologySymbolDensity: number;
  veinBandSymbolDensity: number;
  veinBandSymbolSize?: number;
  veinBandThicknessPx: number;
  jointPencilSizePx?: number;
  geoFeaturePencilSizePx?: number;
  geoFeatureSymbolSize?: number;
  geoFeatureSymbolDensity?: number;
  pencilLineMode?: 'smooth' | 'linear';
  onChangePencilLineMode?: (mode: 'smooth' | 'linear') => void;
  liveDipDirection: number;
  liveDipAmount: number;
  liveCrownSign: '+90' | '-90';
  rememberedRocksList: FieldRememberedRockItem[];
  selectedTraceId: string | null;
  onSelectTraceId: (id: string | null, panel?: FieldPanelId) => void;
  onSetLiveOrientation: (dipDir: number, dipAmt: number) => void;
  onPushUndo: () => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onSyncTraceStateChange?: (state: Field3DSyncTraceState) => void;
  onOpen3DJointInspector?: (id: string) => void;
  sharedCameraState?: any;
  onCameraChange?: (state: any) => void;
  syncedHoverCoord?: any;
  onHoverCoordChange?: (coord: any) => void;
}

interface PerimeterSampleNode {
  /** Normalized face X in [-0.5, +0.5] (left = -0.5, right = +0.5) */
  nx: number;
  /** Normalized face Y in [0, 1] (top crown apex = 0, invert = 1) */
  ny: number;
  /** Panel role ('left_wall' | 'crown' | 'right_wall') */
  panel: 'left_wall' | 'crown' | 'right_wall';
  /** Parameter v in [0, 1] matching canonical 2D panel & Strip Align */
  v: number;
  /** Distance in meters from the outer starting edge of the panel */
  edgeMeterFromStart: number;
  /** Outward unit normal in 2D face plane */
  outX: number;
  outY: number;
}

/**
 * Builds dense 3D tunnel perimeter nodes for Left Wall, Crown, and Right Wall
 * from the authoritative tunnel outline (`computeFaceTunnelOutlineDetails`),
 * preserving exact v-parameterization so 3D strokes match 2D panels and Strip Align 100%.
 */
function build3DTunnelPerimeterNodes(
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound
): {
  nodes: PerimeterSampleNode[];
  facePolygonNorm: { nx: number; ny: number }[];
  hasLeftWall: boolean;
  hasCrown: boolean;
  hasRightWall: boolean;
  leftWallLenM: number;
  crownLenM: number;
  rightWallLenM: number;
} {
  const faceGeom = computePanelCanvasGeometry('face', location, round);
  const details = computeFaceTunnelOutlineDetails(location, 0, 0, 1000, 1000);
  const lwPoly = details.leftWallPoly || [];
  const crPoly = details.crownPoly || [];
  const rwPoly = details.rightWallPoly || [];

  const rawFacePts: { x: number; y: number }[] = [
    ...lwPoly,
    ...crPoly,
    ...rwPoly.slice().reverse(),
  ];
  const fallbackFacePts =
    rawFacePts.length >= 3
      ? rawFacePts
      : [
          { x: 0, y: 1000 },
          { x: 0, y: 400 },
          { x: 500, y: 0 },
          { x: 1000, y: 400 },
          { x: 1000, y: 1000 },
        ];

  const facePolygonNorm = fallbackFacePts.map((p) => ({
    nx: (p.x - 500) / 1000,
    ny: p.y / 1000,
  }));

  // Dense arc-length resampling so every wall & crown has smooth continuous geometry
  const resamplePolyUniform = (poly: { x: number; y: number }[], targetCount = 48) => {
    if (poly.length < 2) return [];
    const cum: number[] = [0];
    for (let i = 1; i < poly.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y));
    }
    const total = Math.max(1e-6, cum[cum.length - 1]);
    const out: { nx: number; ny: number }[] = [];
    for (let s = 0; s <= targetCount; s++) {
      const targetD = (s / targetCount) * total;
      let seg = 0;
      while (seg < cum.length - 2 && cum[seg + 1] < targetD) {
        seg++;
      }
      const segLen = Math.max(1e-6, cum[seg + 1] - cum[seg]);
      const t = Math.max(0, Math.min(1, (targetD - cum[seg]) / segLen));
      const px = poly[seg].x + (poly[seg + 1].x - poly[seg].x) * t;
      const py = poly[seg].y + (poly[seg + 1].y - poly[seg].y) * t;
      out.push({
        nx: (px - 500) / 1000,
        ny: py / 1000,
      });
    }
    return out;
  };

  const leftWallLenM = details.leftWallLengthM || faceGeom.splHeightM || 4.2;
  const crownLenM = details.crownLengthM || faceGeom.crownLengthM || 10.5;
  const rightWallLenM = details.rightWallLengthM || faceGeom.splHeightM || 4.2;

  const nodes: PerimeterSampleNode[] = [];
  (['left_wall', 'crown', 'right_wall'] as const).forEach((panelId) => {
    if (panelId === 'left_wall' && !faceGeom.hasLeftWall) return;
    if (panelId === 'crown' && !faceGeom.hasCrown) return;
    if (panelId === 'right_wall' && !faceGeom.hasRightWall) return;

    const srcPoly =
      panelId === 'left_wall' ? lwPoly : panelId === 'crown' ? crPoly : rwPoly;
    const panelPts = resamplePolyUniform(srcPoly, panelId === 'crown' ? 64 : 44);
    if (panelPts.length < 2) return;

    const ordered = [...panelPts];
    if (panelId === 'left_wall' && ordered[0].ny < ordered[ordered.length - 1].ny) {
      ordered.reverse();
    } else if (panelId === 'crown' && ordered[0].nx > ordered[ordered.length - 1].nx) {
      ordered.reverse();
    } else if (panelId === 'right_wall' && ordered[0].ny > ordered[ordered.length - 1].ny) {
      ordered.reverse();
    }

    const cumDist: number[] = [0];
    for (let i = 1; i < ordered.length; i++) {
      const d = Math.hypot(
        ordered[i].nx - ordered[i - 1].nx,
        ordered[i].ny - ordered[i - 1].ny
      );
      cumDist.push(cumDist[i - 1] + d);
    }
    const totalLen = Math.max(1e-5, cumDist[cumDist.length - 1]);
    const panelLenM =
      panelId === 'left_wall'
        ? leftWallLenM
        : panelId === 'crown'
        ? crownLenM
        : rightWallLenM;

    for (let i = 0; i < ordered.length; i++) {
      const frac = cumDist[i] / totalLen;
      // Canonical v: on left_wall v=0 is outer starting edge (0m) & v=1 is L-SPL;
      // on crown v=0 is L-SPL (0m) & v=1 is R-SPL;
      // on right_wall v=0 is R-SPL (0m) & v=1 is right invert.
      const v = frac;
      const edgeMeterFromStart = frac * panelLenM;

      const rx = ordered[i].nx - 0;
      const ry = ordered[i].ny - 0.55;
      const rLen = Math.hypot(rx, ry) || 1;

      nodes.push({
        nx: ordered[i].nx,
        ny: ordered[i].ny,
        panel: panelId,
        v: Math.max(0.001, Math.min(0.999, v)),
        edgeMeterFromStart: Number(edgeMeterFromStart.toFixed(2)),
        outX: rx / rLen,
        outY: ry / rLen,
      });
    }
  });

  return {
    nodes,
    facePolygonNorm,
    hasLeftWall: faceGeom.hasLeftWall,
    hasCrown: faceGeom.hasCrown,
    hasRightWall: faceGeom.hasRightWall,
    leftWallLenM,
    crownLenM,
    rightWallLenM,
  };
}

export const Field3DTunnelCanvas: React.FC<Field3DTunnelCanvasProps> = React.memo(({
  activeLocation,
  activeRound,
  activeTool,
  selectedRockType,
  lithologySubMode,
  veinOrFoliationSubMode,
  selectedVeinRockId,
  selectedGeoFeatureType,
  selectedFaultSubType = 'normal',
  selectedFaultElementRole = 'fault_plane',
  showHwFwBadges = true,
  selectedFoldSubType = 'anticline',
  selectedFoldElementRole = 'fold_axis',
  showFoldLimbCrestBadges = true,
  alternatingBandMode = false,
  alternatingRockIds = [],
  alternatingSpacingPx = 18,
  selectedWaterCondition,
  activeGroupingSet,
  brushRadius,
  lithologySymbolDensity,
  veinBandSymbolDensity,
  veinBandSymbolSize = 100,
  veinBandThicknessPx,
  jointPencilSizePx = 3.8,
  geoFeaturePencilSizePx = 4.2,
  geoFeatureSymbolSize = 100,
  geoFeatureSymbolDensity = 100,
  pencilLineMode = 'smooth',
  onChangePencilLineMode,
  liveDipDirection,
  liveDipAmount,
  liveCrownSign,
  rememberedRocksList,
  selectedTraceId,
  onSelectTraceId,
  onSetLiveOrientation,
  onPushUndo,
  onUpdateRound,
  onSyncTraceStateChange,
  onOpen3DJointInspector,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [subMode, setSubMode] = useState<Field3DViewSubMode>('open_heading');
  const [show1mGrid, setShow1mGrid] = useState<boolean>(true);
  const [showTunnelOutline, setShowTunnelOutline] = useState<boolean>(true);

  // 3D Joint Inspection & Cutting Disc Plane:
  const [show3DSpatialDisc, setShow3DSpatialDisc] = useState<boolean>(true);

  const [localPencilLineMode, setLocalPencilLineMode] = useState<'smooth' | 'linear'>('smooth');
  const rawPencilLineMode = onChangePencilLineMode ? pencilLineMode : localPencilLineMode;
  const effectivePencilLineMode: 'smooth' | 'linear' =
    activeTool === '4_dip_surface' ? 'smooth' : rawPencilLineMode;
  const setEffectivePencilLineMode = (m: 'smooth' | 'linear') => {
    if (onChangePencilLineMode) onChangePencilLineMode(m);
    else setLocalPencilLineMode(m);
  };
  const [showSmartAutoContinuation] = useState<boolean>(true);

  const isPencilTool =
    activeTool === '2_vein_foliation' ||
    activeTool === '3_joint_trace' ||
    activeTool === '4_dip_surface' ||
    activeTool === '5_geo_feature';
  // Only Joint Tracing ('3_joint_trace') uses multi-segment Pause/Continue + "Ask OK to Finish Joint" session
  const isJointTraceTool = activeTool === '3_joint_trace';

  const [headingFlareDepth, setHeadingFlareDepth] = useState<number>(445);
  const [foldPercent, setFoldPercent] = useState<number>(60);

  // 3D Tunnel Camera Rotation, Pan & Two-Finger Zoom State (works across 3D Heading & Inside Tunnel while tracing!)
  const [insideYawDeg, setInsideYawDeg] = useState<number>(0);
  const [insidePitchDeg, setInsidePitchDeg] = useState<number>(0);
  const [viewZoom, setViewZoom] = useState<number>(1.0); // 0.65x .. 3.2x (Two-finger pinch zoom & wheel zoom)
  const [viewPan, setViewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [insideNavMode, setInsideNavMode] = useState<'draw' | 'rotate'>('draw');
  const rotateDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);
  const bottomWheelDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);
  const pendingRotationRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const rotationRafIdRef = useRef<number | null>(null);

  // Butter-smooth 60fps/120fps rotation updater via requestAnimationFrame
  const scheduleRotationUpdate = React.useCallback((nextYaw: number, nextPitch: number) => {
    pendingRotationRef.current = { yaw: nextYaw, pitch: nextPitch };
    if (!rotationRafIdRef.current) {
      rotationRafIdRef.current = requestAnimationFrame(() => {
        rotationRafIdRef.current = null;
        if (pendingRotationRef.current) {
          setInsideYawDeg(pendingRotationRef.current.yaw);
          setInsidePitchDeg(pendingRotationRef.current.pitch);
        }
      });
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (rotationRafIdRef.current) {
        cancelAnimationFrame(rotationRafIdRef.current);
      }
    };
  }, []);

  const activeTouchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchGestureRef = useRef<{
    active: boolean;
    startDist: number;
    startMidX: number;
    startMidY: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);

  // Multi-segment Pause & Resume Joint Trace State:
  // For each 3D joint trace, the joint remains active/continuable across surfaces until the user clicks "OK" to finish!
  const [pendingTraceSession, setPendingTraceSession] = useState<{
    tool: FieldCanvasTool;
    traceIdsByPanel: Partial<Record<FieldPanelId, string>>;
    rawPointsByPanel: Partial<Record<FieldPanelId, FieldPoint2D[]>>;
    lastPanel: FieldPanelId;
    lastPanelPt: FieldPoint2D;
    segmentCount: number;
  } | null>(null);

  const confirmAndFinishPendingJoint = React.useCallback(() => {
    setPendingTraceSession(null);
    emitField3DPendingJointChange(false);
  }, []);

  const cancelPendingJoint = React.useCallback(() => {
    if (!pendingTraceSession) return;
    const idsToRemove = new Set(
      Object.values(pendingTraceSession.traceIdsByPanel).filter(Boolean) as string[]
    );
    if (idsToRemove.size > 0) {
      onUpdateRound((r) => ({
        ...r,
        jointTraces: r.jointTraces.filter((t) => !idsToRemove.has(t.id)),
      }));
    }
    setPendingTraceSession(null);
    setLatestCompletedIds([]);
    emitField3DPendingJointChange(false);
  }, [pendingTraceSession, onUpdateRound]);

  // Allow pressing Enter to finish joint, Escape to cancel
  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        if (pendingTraceSession) {
          ev.preventDefault();
          confirmAndFinishPendingJoint();
        }
      } else if (ev.key === 'Escape') {
        if (pendingTraceSession) {
          ev.preventDefault();
          cancelPendingJoint();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    pendingTraceSession,
    confirmAndFinishPendingJoint,
    cancelPendingJoint,
  ]);

  // Subscribe to external "OK" clicks from the Right-Window SYNC box
  React.useEffect(() => {
    const onExternalConfirm = () => {
      confirmAndFinishPendingJoint();
    };
    field3DConfirmJointListeners.add(onExternalConfirm);
    return () => {
      field3DConfirmJointListeners.delete(onExternalConfirm);
    };
  }, [confirmAndFinishPendingJoint]);

  // Clear pending trace session if user switches active tool away from Joint Trace
  React.useEffect(() => {
    if (pendingTraceSession && (pendingTraceSession.tool !== activeTool || !isJointTraceTool)) {
      setPendingTraceSession(null);
      emitField3DPendingJointChange(false);
    }
  }, [activeTool, isJointTraceTool, pendingTraceSession]);

  const applyLineModeToPendingSession = (nextMode: 'smooth' | 'linear') => {
    setEffectivePencilLineMode(nextMode);
    if (!pendingTraceSession) return;
    onUpdateRound((r) => {
      let nextR = { ...r };
      (Object.keys(pendingTraceSession.traceIdsByPanel) as FieldPanelId[]).forEach((pid) => {
        const tid = pendingTraceSession.traceIdsByPanel[pid];
        const rawPts = pendingTraceSession.rawPointsByPanel[pid];
        if (!tid || !rawPts || rawPts.length < 2) return;
        const shapedPts =
          nextMode === 'linear'
            ? [rawPts[0], rawPts[rawPts.length - 1]]
            : smoothTraceWithLevel(rawPts, 'high');
        if (pendingTraceSession.tool === '3_joint_trace') {
          nextR = {
            ...nextR,
            jointTraces: nextR.jointTraces.map((t) =>
              t.id === tid ? { ...t, points: shapedPts, lineMode: nextMode } : t
            ),
          };
        } else if (pendingTraceSession.tool === '2_vein_foliation') {
          nextR = {
            ...nextR,
            lithologyStrokes: nextR.lithologyStrokes.map((s) =>
              s.id === tid ? { ...s, points: shapedPts, lineMode: nextMode } : s
            ),
          };
        } else if (pendingTraceSession.tool === '5_geo_feature') {
          nextR = {
            ...nextR,
            structuralFeatures: (nextR.structuralFeatures || []).map((f) =>
              f.id === tid ? { ...f, points: shapedPts, lineMode: nextMode } : f
            ),
          };
        } else if (pendingTraceSession.tool === '4_dip_surface') {
          const { outlinePolygon } = buildDipSurfacePolygonWithOutlineSnap(
            shapedPts,
            pid,
            activeLocation,
            nextR
          );
          nextR = {
            ...nextR,
            dipPlaneSurfaces: (nextR.dipPlaneSurfaces || []).map((d) =>
              d.id === tid
                ? { ...d, points: shapedPts, outlinePolygon, lineMode: nextMode }
                : d
            ),
          };
        }
      });
      return nextR;
    });
  };

  // Direct DOM ref for 3D Hover Cursor Ring (eliminates React re-renders on every mouse move!)
  const hoverCursorGroupRef = useRef<SVGGElement | null>(null);
  const updateHoverCursorDom = React.useCallback(
    (
      info: {
        svgX: number;
        svgY: number;
        panel: FieldPanelId;
        pullMeter: number;
        perimMeter: number;
        u: number;
        v: number;
      } | null
    ) => {
      const g = hoverCursorGroupRef.current;
      if (g) {
        if (!info) {
          g.style.display = 'none';
        } else {
          g.style.display = '';
          g.setAttribute('transform', `translate(${info.svgX.toFixed(1)}, ${info.svgY.toFixed(1)})`);
        }
      }
      emitField3DHoverCursor(
        info
          ? {
              panel: info.panel,
              u: info.u,
              v: info.v,
              pullMeter: info.pullMeter,
              perimMeter: info.perimMeter,
            }
          : null
      );
    },
    []
  );

  // Continuous 3D multi-surface stroke state + latest single trace IDs for the Right-Window Unfolded Sync Box
  const [isDrawing3D, setIsDrawing3D] = useState<boolean>(false);
  const [latestCompletedIds, setLatestCompletedIds] = useState<string[]>([]);
  const [liveStrokeSamples, setLiveStrokeSamples] = useState<
    {
      svgX: number;
      svgY: number;
      panel: FieldPanelId;
      panelPt: FieldPoint2D;
      u: number;
      v: number;
      pullMeter: number;
      perimMeter: number;
    }[]
  >([]);

  // Notify Sync Box only when active drawing state or completed trace changes (NOT on mouse hover!)
  React.useEffect(() => {
    const nextState: Field3DSyncTraceState = {
      isDrawing: isDrawing3D,
      liveSamples: liveStrokeSamples.map((s) => ({
        panel: s.panel,
        panelPt: s.panelPt,
        u: s.u,
        v: s.v,
        pullMeter: s.pullMeter,
        perimMeter: s.perimMeter,
      })),
      latestCompletedIds,
      hoverInfo: null,
    };
    emitField3DDrawState(nextState);
    if (onSyncTraceStateChange && !isDrawing3D) {
      onSyncTraceStateChange(nextState);
    }
  }, [isDrawing3D, liveStrokeSamples, latestCompletedIds, onSyncTraceStateChange]);

  const perimeterData = useMemo(
    () => build3DTunnelPerimeterNodes(activeLocation, activeRound),
    [activeLocation, activeRound]
  );

  const pullM = Math.max(
    0.5,
    Number(
      (activeRound as unknown as { pullLengthM?: number }).pullLengthM ??
        activeRound.pullLengthMeters
    ) || 3.0
  );

  const faceGeom = useMemo(
    () => computePanelCanvasGeometry('face', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const leftWallGeom = useMemo(
    () => computePanelCanvasGeometry('left_wall', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const crownGeom = useMemo(
    () => computePanelCanvasGeometry('crown', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const rightWallGeom = useMemo(
    () => computePanelCanvasGeometry('right_wall', activeLocation, activeRound),
    [activeLocation, activeRound]
  );

  const getPanelGeom = (panel: FieldPanelId) => {
    if (panel === 'left_wall') return leftWallGeom;
    if (panel === 'crown') return crownGeom;
    if (panel === 'right_wall') return rightWallGeom;
    return faceGeom;
  };

  // Scale 2D brushRadius into 3D SVG units so brush size slider works accurately for Lithology, Dip Surface, Water & Eraser
  const brushRadius3D = Math.max(10, Math.round(brushRadius * 0.85));
  const brushDiameter3D = brushRadius3D * 2;

  /**
   * Projects a normalized 3D tunnel point `(nx, ny, tPull)` onto the 1000×1000 SVG canvas:
   * - `nx`: [-0.5, +0.5] across tunnel width
   * - `ny`: [0, 1] from crown apex (0) to invert (1)
   * - `tPull`: [0, 1] where:
   *     - `tPull = 1.0` is the FIRST OUTER GRID LINE (`0m` pull throughout!)
   *     - `tPull = 0.0` is the INNER CORE LINE (`pullM` / `3m` pull throughout, meeting the Excavation Face!)
   *     - Pull progresses inward from `0m` (outer line, `tPull=1`) -> `pullM` (inner line, `tPull=0`).
   */
  /**
   * Projects a normalized 3D tunnel point `(nx, ny, tPull)` onto the 1000×1000 canvas.
   * - `nx`: [-0.5, +0.5] across tunnel width (centered at 0)
   * - `ny`: [0, 1] from crown apex (0) to invert floor (1)
   * - `tPull`: [0, 1] where:
   *     - `tPull = 1.0` is the OUTER PORTAL / START RING (`0m` pull throughout)
   *     - `tPull = 0.0` is the EXCAVATION FACE (`pullM` / `3m` pull throughout)
   *
   * Physical 3D Euclidean coordinates:
   * - X: across tunnel width ([-W/2, +W/2] meters)
   * - Y: vertical elevation ([-H/2, +H/2] meters, crown is +H/2, invert floor is -H/2)
   * - Z: along tunnel drive ([-L/2, +L/2] meters, face is +L/2, portal is -L/2)
   *
   * Rigid 3D Euler rotation ensures the tunnel NEVER shrinks, flattens, or expands when rotated!
   */
  const projectTunnel3DPoint = (
    nx: number,
    ny: number,
    tPull: number,
    panelHint?: FieldPanelId
  ): { x: number; y: number } => {
    const W = Math.max(2, activeLocation.widthM);
    const H = Math.max(2, activeLocation.heightM);
    const L = Math.max(1, pullM);

    // 3D physical coordinates (meters)
    const x3d = nx * W;
    const y3d = (0.5 - ny) * H;
    const z3d = (0.5 - tPull) * L;

    // Camera rotation angles in radians
    const yawRad = (insideYawDeg * Math.PI) / 180;
    const pitchRad = (insidePitchDeg * Math.PI) / 180;



    if (subMode === 'origami_fold') {
      const f = foldPercent / 100;
      const maxDim = Math.max(W, H, L);
      const camDist = maxDim * 2.2;
      const x1 = x3d * Math.cos(yawRad) + z3d * Math.sin(yawRad);
      const y1 = y3d;
      const z1 = -x3d * Math.sin(yawRad) + z3d * Math.cos(yawRad);

      const x2 = x1;
      const y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
      const z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);

      const depth = Math.max(maxDim * 0.4, camDist + z2);
      const focal = 1380;
      const x3dProj = 500 + (x2 * focal) / depth;
      const y3dProj = 500 - (y2 * focal) / depth;

      const aspectW = Math.min(1.2, Math.max(0.7, W / H));
      let x2d = 500 + nx * aspectW * 415;
      let y2d = 555 + (ny - 0.5) * 415;
      if (panelHint === 'left_wall') {
        x2d = 500 - 0.5 * aspectW * 415 - tPull * 265;
        y2d = 555 + (ny - 0.5) * 415;
      } else if (panelHint === 'right_wall') {
        x2d = 500 + 0.5 * aspectW * 415 + tPull * 265;
        y2d = 555 + (ny - 0.5) * 415;
      } else if (panelHint === 'crown') {
        x2d = 500 + nx * aspectW * 415;
        y2d = 555 - 0.5 * 415 - tPull * 265;
      }

      return {
        x: x2d * (1 - f) + x3dProj * f,
        y: y2d * (1 - f) + y3dProj * f,
      };
    }

    // =========================================================================
    // 3D TUNNEL ORBIT MODE (OUTSIDE VIEW): Rigid 3D Euclidean Rotation & Perspective!
    // =========================================================================
    const maxDim = Math.max(W, H, L);
    const camDist = maxDim * 2.2;

    // Rigid 3D rotation:
    const x1 = x3d * Math.cos(yawRad) + z3d * Math.sin(yawRad);
    const y1 = y3d;
    const z1 = -x3d * Math.sin(yawRad) + z3d * Math.cos(yawRad);

    const x2 = x1;
    const y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
    const z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);

    const depth = Math.max(maxDim * 0.4, camDist + z2);
    const focal = 1380;

    return {
      x: 500 + (x2 * focal) / depth,
      y: 500 - (y2 * focal) / depth,
    };
  };

  /**
   * Continuous linear interpolation of `(nx, ny)` along a panel's perimeter for any `v in [0, 1]`.
   */
  const interpolatePerimeterAtV = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    v: number
  ): { nx: number; ny: number } => {
    const pNodes = perimeterData.nodes.filter((n) => n.panel === panel);
    if (pNodes.length === 0) return { nx: 0, ny: 0.5 };
    if (pNodes.length === 1) return { nx: pNodes[0].nx, ny: pNodes[0].ny };

    const clampedV = Math.max(0, Math.min(1, v));
    // Sort by v ascending for clean bracketing
    const sorted = [...pNodes].sort((a, b) => a.v - b.v);
    if (clampedV <= sorted[0].v) return { nx: sorted[0].nx, ny: sorted[0].ny };
    if (clampedV >= sorted[sorted.length - 1].v) {
      const last = sorted[sorted.length - 1];
      return { nx: last.nx, ny: last.ny };
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const n0 = sorted[i];
      const n1 = sorted[i + 1];
      if (clampedV >= n0.v && clampedV <= n1.v) {
        const span = Math.max(1e-6, n1.v - n0.v);
        const t = (clampedV - n0.v) / span;
        return {
          nx: n0.nx + (n1.nx - n0.nx) * t,
          ny: n0.ny + (n1.ny - n0.ny) * t,
        };
      }
    }
    return { nx: sorted[0].nx, ny: sorted[0].ny };
  };

  /**
   * Maps a 2D canonical panel point `pt` on `panel` into its 3D projected SVG coordinates `(x, y)`.
   * Canonical 2D conventions (matching computePhysicalMetricPoints & computePanelOrientationReferenceMeta):
   * - Crown: u = 0 (Left SPL) -> 1 (Right SPL) across relative arch curve; v = 0 (Face / pullM) -> 1 (0m pull).
   * - Left Wall: u = 0 (0m pull) -> 1 (Face / pullM); v = 0 (Springline) -> 1 (Invert floor).
   * - Right Wall: u = 0 (Face / pullM) -> 1 (0m pull); v = 0 (Springline) -> 1 (Invert floor).
   * - Face: u = 0 (Left edge) -> 1 (Right edge); v = 0 (Apex) -> 1 (Invert floor).
   */
  const panelPointTo3DSvg = (panel: FieldPanelId, pt: FieldPoint2D): FieldPoint2D => {
    const geom = getPanelGeom(panel);
    const u = Math.max(0.0001, Math.min(0.9999, (pt.x - geom.boxX) / Math.max(1, geom.boxW)));
    const v = Math.max(0.0001, Math.min(0.9999, (pt.y - geom.boxY) / Math.max(1, geom.boxH)));

    if (panel === 'face') {
      return projectTunnel3DPoint(u - 0.5, v, 0, 'face');
    }

    if (panel === 'crown') {
      // u across curved arch perimeter, v along pull advance (0 = face, 1 = 0m pull)
      const { nx, ny } = interpolatePerimeterAtV('crown', u);
      const tPull = v;
      return projectTunnel3DPoint(nx, ny, tPull, 'crown');
    }

    if (panel === 'left_wall') {
      // u along pull (0 = 0m, 1 = face) -> tPull = 1 - u; v from SPL to Invert -> node v is 1 - v
      const { nx, ny } = interpolatePerimeterAtV('left_wall', 1 - v);
      const tPull = 1 - u;
      return projectTunnel3DPoint(nx, ny, tPull, 'left_wall');
    }

    // right_wall: u along pull (0 = face, 1 = 0m) -> tPull = u; v from SPL to Invert -> node v is v
    const { nx, ny } = interpolatePerimeterAtV('right_wall', v);
    const tPull = u;
    return projectTunnel3DPoint(nx, ny, tPull, 'right_wall');
  };

  // Precompute 3D hit-test polygons & panel node lookup tables once per camera/geometry change (instead of every pointermove!)
  const cachedHitPolygons = useMemo(() => {
    const facePolySvg = perimeterData.facePolygonNorm.map((p) =>
      projectTunnel3DPoint(p.nx, p.ny, 0, 'face')
    );
    const fCenter = projectTunnel3DPoint(0, 0.5, 0, 'face');
    const fRight = projectTunnel3DPoint(0.5, 0.5, 0, 'face');
    const fBottom = projectTunnel3DPoint(0, 1.0, 0, 'face');
    const halfSpanX = Math.max(20, Math.abs(fRight.x - fCenter.x));
    const halfSpanY = Math.max(20, Math.abs(fBottom.y - fCenter.y));

    const candidatePanels: ('left_wall' | 'crown' | 'right_wall')[] = [
      ...(perimeterData.hasLeftWall ? (['left_wall'] as const) : []),
      ...(perimeterData.hasCrown ? (['crown'] as const) : []),
      ...(perimeterData.hasRightWall ? (['right_wall'] as const) : []),
    ];

    const panelPolys = candidatePanels.map((pid) => {
      const pNodes = perimeterData.nodes.filter((n) => n.panel === pid);
      const faceRing = pNodes.map((n) => projectTunnel3DPoint(n.nx, n.ny, 0, pid));
      const portalRing = pNodes
        .slice()
        .reverse()
        .map((n) => projectTunnel3DPoint(n.nx, n.ny, 1, pid));
      return {
        pid,
        pNodes,
        poly: [...faceRing, ...portalRing],
      };
    });

    return {
      facePolySvg,
      fCenter,
      halfSpanX,
      halfSpanY,
      panelPolys,
    };
  }, [
    perimeterData,
    subMode,
    foldPercent,
    headingFlareDepth,
    insideYawDeg,
    insidePitchDeg,
    activeLocation.widthM,
    activeLocation.heightM,
  ]);

  /**
   * High-speed inverse hit-test (< 0.05ms): Given an SVG point `(svgX, svgY)` on the 3D canvas,
   * strictly checks if the point is INSIDE one of the 3D tunnel surfaces (`face`, `left_wall`, `crown`, `right_wall`).
   * - First Outer Grid Line (`bestTPull = 1`) -> `pullMeter = 0m` (`pullNorm = 0`)
   * - Inner Core Line (`bestTPull = 0`) -> `pullMeter = pullM` (e.g. `3m`, `pullNorm = 1`)
   * - On Left Wall, starting at the outer starting edge is `0m`!
   */
  const resolve3DSvgPointToSurfaceAndPanelPt = (
    svgX: number,
    svgY: number
  ): {
    panel: FieldPanelId;
    panelPt: FieldPoint2D;
    u: number;
    v: number;
    pullMeter: number;
    perimMeter: number;
  } | null => {
    if (isPointInPolygon(svgX, svgY, cachedHitPolygons.facePolySvg)) {
      // 2-stage grid inverse mapping on the face for millimeter accuracy at any 3D rotation angle
      let bestU = 0.5;
      let bestV = 0.5;
      let bestDistSq = Infinity;
      const coarseN = 8;
      for (let iu = 0; iu <= coarseN; iu++) {
        const testU = iu / coarseN;
        for (let iv = 0; iv <= coarseN; iv++) {
          const testV = iv / coarseN;
          const proj = projectTunnel3DPoint(testU - 0.5, testV, 0, 'face');
          const dSq = (proj.x - svgX) * (proj.x - svgX) + (proj.y - svgY) * (proj.y - svgY);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestU = testU;
            bestV = testV;
          }
        }
      }
      const uMin = Math.max(0.005, bestU - 0.1);
      const uMax = Math.min(0.995, bestU + 0.1);
      const vMin = Math.max(0.005, bestV - 0.1);
      const vMax = Math.min(0.995, bestV + 0.1);
      for (let iu = 0; iu <= 6; iu++) {
        const testU = uMin + ((uMax - uMin) * iu) / 6;
        for (let iv = 0; iv <= 6; iv++) {
          const testV = vMin + ((vMax - vMin) * iv) / 6;
          const proj = projectTunnel3DPoint(testU - 0.5, testV, 0, 'face');
          const dSq = (proj.x - svgX) * (proj.x - svgX) + (proj.y - svgY) * (proj.y - svgY);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestU = testU;
            bestV = testV;
          }
        }
      }
      const u = Math.max(0.005, Math.min(0.995, bestU));
      const v = Math.max(0.005, Math.min(0.995, bestV));
      return {
        panel: 'face',
        panelPt: {
          x: Number((faceGeom.boxX + u * faceGeom.boxW).toFixed(1)),
          y: Number((faceGeom.boxY + v * faceGeom.boxH).toFixed(1)),
        },
        u,
        v,
        pullMeter: Number(((u - 0.5) * activeLocation.widthM).toFixed(2)),
        perimMeter: Number(((1 - v) * activeLocation.heightM).toFixed(2)),
      };
    }

    let matchedEntry: (typeof cachedHitPolygons.panelPolys)[number] | null = null;
    for (const entry of cachedHitPolygons.panelPolys) {
      if (entry.pNodes.length >= 2 && isPointInPolygon(svgX, svgY, entry.poly)) {
        matchedEntry = entry;
        break;
      }
    }

    // Strictly block outside-the-tunnel clicks/hover!
    if (!matchedEntry) {
      return null;
    }

    const panelNodes = matchedEntry.pNodes;
    let bestNode = panelNodes[0];
    let bestTPull = 0.5;
    let bestDistSq = Infinity;

    // Fast 2-stage search (~90 evaluations total instead of 600+)
    const coarseNiStep = Math.max(1, Math.floor(panelNodes.length / 16));
    const coarseSteps = 6;
    for (let ni = 0; ni < panelNodes.length; ni += coarseNiStep) {
      const node = panelNodes[ni];
      for (let s = 0; s <= coarseSteps; s++) {
        const tPull = s / coarseSteps;
        const proj = projectTunnel3DPoint(node.nx, node.ny, tPull, node.panel);
        const dSq = (proj.x - svgX) * (proj.x - svgX) + (proj.y - svgY) * (proj.y - svgY);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestNode = node;
          bestTPull = tPull;
        }
      }
    }

    // Local fine refinement around (bestNode, bestTPull) for sub-pixel accuracy
    const minT = Math.max(0, bestTPull - 0.12);
    const maxT = Math.min(1, bestTPull + 0.12);
    for (let s = 0; s <= 8; s++) {
      const tPull = minT + ((maxT - minT) * s) / 8;
      const proj = projectTunnel3DPoint(bestNode.nx, bestNode.ny, tPull, bestNode.panel);
      const dSq = (proj.x - svgX) * (proj.x - svgX) + (proj.y - svgY) * (proj.y - svgY);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestTPull = tPull;
      }
    }

    if (!bestNode) return null;

    const geom = getPanelGeom(bestNode.panel);
    // pullNorm: 0 at 0m pull (bestTPull = 1) -> 1 at face advance / pullM (bestTPull = 0)
    const pullNorm = Math.max(0.0, Math.min(1.0, 1 - bestTPull));

    let u = 0.5;
    let v = 0.5;
    let perimMeter = bestNode.edgeMeterFromStart;

    if (bestNode.panel === 'crown') {
      // Crown 2D: u across curved arch perimeter, v along pull advance (0 = face, 1 = 0m pull)
      u = Math.max(0.002, Math.min(0.998, bestNode.v));
      v = Math.max(0.002, Math.min(0.998, bestTPull));
      perimMeter = bestNode.edgeMeterFromStart;
    } else if (bestNode.panel === 'left_wall') {
      // Left Wall 2D: u along pull advance (0 = 0m, 1 = face); v from SPL (0) to Invert (1)
      u = Math.max(0.002, Math.min(0.998, 1 - bestTPull));
      v = Math.max(0.002, Math.min(0.998, 1 - bestNode.v));
      perimMeter = Number(((1 - bestNode.v) * geom.leftWallLengthM).toFixed(2));
    } else if (bestNode.panel === 'right_wall') {
      // Right Wall 2D: u along pull advance (0 = face, 1 = 0m); v from SPL (0) to Invert (1)
      u = Math.max(0.002, Math.min(0.998, bestTPull));
      v = Math.max(0.002, Math.min(0.998, bestNode.v));
      perimMeter = bestNode.edgeMeterFromStart;
    }

    return {
      panel: bestNode.panel,
      panelPt: {
        x: Number((geom.boxX + u * geom.boxW).toFixed(1)),
        y: Number((geom.boxY + v * geom.boxH).toFixed(1)),
      },
      u,
      v,
      pullMeter: Number((pullNorm * pullM).toFixed(2)),
      perimMeter: Number(perimMeter.toFixed(2)),
    };
  };

  /**
   * Full 3D Brush Eraser: Uses actual `brushRadius` to erase Joint Traces, Structural Features,
   * Dip Surfaces, Water Marks, and smoothly carve/erase Lithology, Vein & Foliation strokes!
   */
  const erase3DNearPoint = (panel: FieldPanelId, panelPt: FieldPoint2D, svgPt: FieldPoint2D) => {
    const hitSvgR = Math.max(16, brushRadius3D);
    const hitPanelR = Math.max(24, brushRadius * 0.95);

    onUpdateRound((r) => {
      // 1. Joint traces (densify check so clicking middle of long trace always erases it)
      const hitTrace = r.jointTraces.find(
        (t) =>
          t.panel === panel &&
          densifyPolylinePoints(t.points, 10).some((p) => {
            const p3d = panelPointTo3DSvg(t.panel, p);
            return (
              Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) <= hitSvgR ||
              Math.hypot(p.x - panelPt.x, p.y - panelPt.y) <= hitPanelR
            );
          })
      );
      if (hitTrace) {
        return {
          ...r,
          jointTraces: r.jointTraces.filter((t) => t.id !== hitTrace.id),
        };
      }

      // 2. Structural Features
      const hitFeature = (r.structuralFeatures || []).find(
        (f) =>
          f.panel === panel &&
          densifyPolylinePoints(f.points, 10).some((p) => {
            const p3d = panelPointTo3DSvg(f.panel, p);
            return (
              Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) <= hitSvgR ||
              Math.hypot(p.x - panelPt.x, p.y - panelPt.y) <= hitPanelR
            );
          })
      );
      if (hitFeature) {
        return {
          ...r,
          structuralFeatures: (r.structuralFeatures || []).filter((f) => f.id !== hitFeature.id),
        };
      }

      // 3. Dip Plane Surfaces
      const hitDip = (r.dipPlaneSurfaces || []).find((d) => {
        if (d.panel !== panel) return false;
        return d.points.some((p) => {
          const p3d = panelPointTo3DSvg(d.panel, p);
          return (
            Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) <= hitSvgR + 12 ||
            Math.hypot(p.x - panelPt.x, p.y - panelPt.y) <= Math.max(hitPanelR, d.brushRadius || 30)
          );
        });
      });
      if (hitDip) {
        return {
          ...r,
          dipPlaneSurfaces: (r.dipPlaneSurfaces || []).filter((d) => d.id !== hitDip.id),
        };
      }

      // 4. Water Marks
      const hitWater = r.waterMarks.find(
        (w) =>
          w.panel === panel &&
          w.points.some((p) => {
            const p3d = panelPointTo3DSvg(w.panel, p);
            return (
              Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) <= hitSvgR + 10 ||
              Math.hypot(p.x - panelPt.x, p.y - panelPt.y) <= Math.max(hitPanelR, w.brushRadius || 32)
            );
          })
      );
      if (hitWater) {
        return {
          ...r,
          waterMarks: r.waterMarks.filter((w) => w.id !== hitWater.id),
        };
      }

      // Normal eraser NEVER erases rock mass lithology strokes! (Strictly reserved for Litho Eraser)
      return r;
    });
  };

  /**
   * Dedicated 3D Litho Eraser:
   * ONLY erases Rock Lithology ('region_fill' or vein/foliation bands).
   * Leaves all Joint Traces, Structural Features, Dip Surfaces, and Water Marks completely untouched!
   */
  const eraseLithology3DNearPoint = (panel: FieldPanelId, panelPt: FieldPoint2D, svgPt: FieldPoint2D) => {
    const hitSvgR = Math.max(16, brushRadius3D);
    const hitPanelR = Math.max(24, brushRadius * 0.95);

    onUpdateRound((r) => {
      let lithChanged = false;
      const updatedLithology: FieldLithologyStroke[] = [];
      for (const l of r.lithologyStrokes) {
        if (l.panel !== panel || l.mode === 'lithology_erase') {
          updatedLithology.push(l);
          continue;
        }
        const densePts = densifyPolylinePoints(l.points, 8);
        const eraseRadius = Math.max(hitPanelR, (l.brushRadius || 28) * 0.55);
        const hasHit = densePts.some((p) => {
          const p3d = panelPointTo3DSvg(l.panel, p);
          return (
            Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) <= hitSvgR ||
            Math.hypot(p.x - panelPt.x, p.y - panelPt.y) <= eraseRadius
          );
        });
        if (!hasHit) {
          updatedLithology.push(l);
          continue;
        }
        lithChanged = true;
        let currentRun: FieldPoint2D[] = [];
        let segIdx = 0;
        for (const p of densePts) {
          const p3d = panelPointTo3DSvg(l.panel, p);
          if (
            Math.hypot(p3d.x - svgPt.x, p3d.y - svgPt.y) > hitSvgR &&
            Math.hypot(p.x - panelPt.x, p.y - panelPt.y) > eraseRadius
          ) {
            currentRun.push(p);
          } else if (currentRun.length >= 2) {
            updatedLithology.push({
              ...l,
              id: `${l.id}-s${segIdx++}-${Date.now().toString(36).slice(-3)}`,
              points: currentRun,
            });
            currentRun = [];
          } else {
            currentRun = [];
          }
        }
        if (currentRun.length >= 2) {
          updatedLithology.push({
            ...l,
            id: segIdx === 0 ? l.id : `${l.id}-s${segIdx}-${Date.now().toString(36).slice(-3)}`,
            points: currentRun,
          });
        }
      }

      if (lithChanged) {
        return {
          ...r,
          lithologyStrokes: pruneFullyErasedLithologyStrokes(updatedLithology),
        };
      }

      return r;
    });
  };

  /**
   * Computes a 3D geological plane intersection across all 4 tunnel surfaces (`left_wall`, `crown`, `right_wall`, `face`)
   * given a Dip Direction, Dip Angle, and 3D anchor point `(anchorX, anchorY, anchorZ)`.
   */
  const compute3DPlaneIntersectionForAnchor = (
    dipDirDeg: number,
    dipAmtDeg: number,
    anchorX: number,
    anchorY: number,
    anchorZ: number
  ) => {
    const relAzRad =
      (((dipDirDeg - activeRound.tunnelDriveDirection + 360) % 360) * Math.PI) / 180;
    const dipRad = (Math.max(5, Math.min(89, dipAmtDeg)) * Math.PI) / 180;

    const sinDip = Math.sin(dipRad);
    const cosDip = Math.cos(dipRad);
    const nX = sinDip * Math.sin(relAzRad);
    const nZ = -sinDip * Math.cos(relAzRad);
    const nY = -cosDip;

    const byPanel: Record<
      FieldPanelId,
      { svgPt: FieldPoint2D; panelPt: FieldPoint2D; u: number; v: number }[]
    > = {
      left_wall: [],
      crown: [],
      right_wall: [],
      face: [],
    };

    if (Math.abs(nZ) > 0.03) {
      for (const node of perimeterData.nodes) {
        const rhs = nX * (node.nx - anchorX) + nY * (node.ny - anchorY);
        const tPull = anchorZ - rhs / nZ;
        if (tPull >= 0.01 && tPull <= 0.99) {
          const geom = getPanelGeom(node.panel);
          let u = 0.5;
          let v = 0.5;
          if (node.panel === 'crown') {
            u = Math.max(0.002, Math.min(0.998, node.v));
            v = Math.max(0.002, Math.min(0.998, tPull));
          } else if (node.panel === 'left_wall') {
            u = Math.max(0.002, Math.min(0.998, 1 - tPull));
            v = Math.max(0.002, Math.min(0.998, 1 - node.v));
          } else if (node.panel === 'right_wall') {
            u = Math.max(0.002, Math.min(0.998, tPull));
            v = Math.max(0.002, Math.min(0.998, node.v));
          }
          const panelPt = {
            x: Number((geom.boxX + u * geom.boxW).toFixed(1)),
            y: Number((geom.boxY + v * geom.boxH).toFixed(1)),
          };
          const svgPt = projectTunnel3DPoint(node.nx, node.ny, tPull, node.panel);
          byPanel[node.panel].push({ svgPt, panelPt, u, v });
        }
      }
    }

    for (let step = 0; step <= 24; step++) {
      const nx = -0.46 + (step / 24) * 0.92;
      if (Math.abs(nY) > 0.03) {
        const ny = anchorY - (nX * (nx - anchorX) + nZ * (0 - anchorZ)) / nY;
        if (ny >= 0.06 && ny <= 0.94) {
          const u = nx + 0.5;
          const v = ny;
          const panelPt = {
            x: Number((faceGeom.boxX + u * faceGeom.boxW).toFixed(1)),
            y: Number((faceGeom.boxY + v * faceGeom.boxH).toFixed(1)),
          };
          const svgPt = projectTunnel3DPoint(nx, ny, 0, 'face');
          byPanel.face.push({ svgPt, panelPt, u, v });
        }
      }
    }

    return byPanel;
  };

  // Smart 3D Auto-Continuation Ghost Preview for the currently selected (or most recently drawn) Joint Trace
  const smartContinuationPreview = useMemo(() => {
    if (!showSmartAutoContinuation) return null;
    const targetTrace =
      (selectedTraceId
        ? activeRound.jointTraces.find((t) => t.id === selectedTraceId)
        : activeRound.jointTraces[activeRound.jointTraces.length - 1]) || null;
    if (!targetTrace || targetTrace.points.length < 2) return null;

    const geom = getPanelGeom(targetTrace.panel);
    const midPt = targetTrace.points[Math.floor(targetTrace.points.length / 2)];
    const u = Math.max(0.02, Math.min(0.98, (midPt.x - geom.boxX) / Math.max(1, geom.boxW)));
    const v = Math.max(0.02, Math.min(0.98, (midPt.y - geom.boxY) / Math.max(1, geom.boxH)));

    let anchorX = 0;
    let anchorY = 0.5;
    let anchorZ = 0.45;

    if (targetTrace.panel === 'face') {
      anchorX = u - 0.5;
      anchorY = v;
      anchorZ = 0.02;
    } else if (targetTrace.panel === 'crown') {
      const { nx, ny } = interpolatePerimeterAtV('crown', u);
      anchorX = nx;
      anchorY = ny;
      anchorZ = v;
    } else if (targetTrace.panel === 'left_wall') {
      const { nx, ny } = interpolatePerimeterAtV('left_wall', 1 - v);
      anchorX = nx;
      anchorY = ny;
      anchorZ = 1 - u;
    } else if (targetTrace.panel === 'right_wall') {
      const { nx, ny } = interpolatePerimeterAtV('right_wall', v);
      anchorX = nx;
      anchorY = ny;
      anchorZ = u;
    }

    const projected = compute3DPlaneIntersectionForAnchor(
      targetTrace.dipDirection,
      targetTrace.dipAmount,
      anchorX,
      anchorY,
      anchorZ
    );

    const otherPanels = (['left_wall', 'crown', 'right_wall', 'face'] as const).filter(
      (p) => p !== targetTrace.panel && projected[p].length >= 2
    );

    if (otherPanels.length === 0) return null;

    return {
      sourceTrace: targetTrace,
      otherPanels,
      projected,
    };
  }, [
    showSmartAutoContinuation,
    selectedTraceId,
    activeRound.jointTraces,
    activeRound.tunnelDriveDirection,
    perimeterData.nodes,
    subMode,
    foldPercent,
    headingFlareDepth,
  ]);

  const handleAcceptSmart3DContinuation = () => {
    if (!smartContinuationPreview) return;
    const { sourceTrace, otherPanels, projected } = smartContinuationPreview;

    onPushUndo();
    const now = Date.now();
    const createdIds: string[] = [sourceTrace.id];
    onUpdateRound((r) => {
      const added: FieldJointTrace[] = [];
      otherPanels.forEach((panelId, idx) => {
        const rawPts = projected[panelId].map((item) => item.panelPt);
        const pts = smoothTraceWithLevel(rawPts, 'high');
        const est = estimateTraceOrientationFromGeometry(
          pts,
          panelId,
          r.tunnelDriveDirection,
          liveCrownSign,
          activeLocation.widthM,
          activeLocation.heightM
        );
        const id = `jtr-3dcont-${now}-${idx}-${panelId}`;
        createdIds.push(id);
        added.push({
          id,
          panel: panelId,
          setId: sourceTrace.setId,
          label: sourceTrace.label || 'J',
          points: pts,
          dipDirection: sourceTrace.dipDirection,
          dipAmount: sourceTrace.dipAmount,
          strike: sourceTrace.strike,
          crownDipSign: sourceTrace.crownDipSign || liveCrownSign,
          traceLengthM: est.traceLengthM,
          editedByCompass: true,
        });
      });
      return {
        ...r,
        jointTraces: [...r.jointTraces, ...added],
      };
    });
    setLatestCompletedIds(createdIds);
  };

  const getSvgCoords = (e: React.PointerEvent<SVGSVGElement>): FieldPoint2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 500 };
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const tr = pt.matrixTransform(ctm.inverse());
      return { x: tr.x, y: tr.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * 1000,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * 1000,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-Finger Touch Gesture: Pinch-to-Zoom + Two-Finger Pan/Rotate (automatically cancels single-finger stroke startup)
    if (activeTouchPointersRef.current.size >= 2) {
      const pts = Array.from(activeTouchPointersRef.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      const dist = Math.max(12, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      pinchGestureRef.current = {
        active: true,
        startDist: dist,
        startMidX: midX,
        startMidY: midY,
        startZoom: viewZoom,
        startPanX: viewPan.x,
        startPanY: viewPan.y,
        startYaw: insideYawDeg,
        startPitch: insidePitchDeg,
      };
      rotateDragRef.current = null;
      if (isDrawing3D) {
        setIsDrawing3D(false);
        setLiveStrokeSamples([]);
      }
      updateHoverCursorDom(null);
      return;
    }

    // When Hand Rotate mode ('rotate') is active in ANY 3D view (or right/middle mouse button), drag rotates the 3D tunnel!
    if (insideNavMode === 'rotate' || e.button === 1 || e.button === 2) {
      rotateDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startYaw: insideYawDeg,
        startPitch: insidePitchDeg,
      };
      return;
    }

    const pt = getSvgCoords(e);
    const resolved = resolve3DSvgPointToSurfaceAndPanelPt(pt.x, pt.y);

    // Clicking on background / outside tunnel surface starts 3D view rotation!
    if (!resolved) {
      updateHoverCursorDom(null);
      rotateDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startYaw: insideYawDeg,
        startPitch: insidePitchDeg,
      };
      return;
    }

    updateHoverCursorDom({
      svgX: pt.x,
      svgY: pt.y,
      panel: resolved.panel,
      pullMeter: resolved.pullMeter,
      perimMeter: resolved.perimMeter,
      u: resolved.u,
      v: resolved.v,
    });

    const isLithoEraser =
      activeTool === 'litho_eraser' ||
      (activeTool === '1_lithology' && lithologySubMode === 'erase_area');

    // Tool: Dedicated Litho Eraser (erases ONLY rock mass lithology strokes, NEVER joints/features)
    if (isLithoEraser) {
      onPushUndo();
      eraseLithology3DNearPoint(resolved.panel, resolved.panelPt, pt);
      setIsDrawing3D(true);
      setLiveStrokeSamples([
        {
          svgX: pt.x,
          svgY: pt.y,
          panel: resolved.panel,
          panelPt: resolved.panelPt,
          u: resolved.u,
          v: resolved.v,
          pullMeter: resolved.pullMeter,
          perimMeter: resolved.perimMeter,
        },
      ]);
      return;
    }

    // Tool: Normal Eraser (erases ONLY Joint Traces, Structural Features, Dip Surfaces & Water — NEVER Lithology!)
    if (activeTool === 'eraser') {
      onPushUndo();
      erase3DNearPoint(resolved.panel, resolved.panelPt, pt);
      setIsDrawing3D(true);
      setLiveStrokeSamples([
        {
          svgX: pt.x,
          svgY: pt.y,
          panel: resolved.panel,
          panelPt: resolved.panelPt,
          u: resolved.u,
          v: resolved.v,
          pullMeter: resolved.pullMeter,
          perimMeter: resolved.perimMeter,
        },
      ]);
      return;
    }

    if (!pendingTraceSession) {
      setLatestCompletedIds([]);
    }
    setIsDrawing3D(true);
    setLiveStrokeSamples([
      {
        svgX: pt.x,
        svgY: pt.y,
        panel: resolved.panel,
        panelPt: resolved.panelPt,
        u: resolved.u,
        v: resolved.v,
        pullMeter: resolved.pullMeter,
        perimMeter: resolved.perimMeter,
      },
    ]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTouchPointersRef.current.has(e.pointerId)) {
      activeTouchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle active two-finger pinch-to-zoom & pan
    if (pinchGestureRef.current?.active && activeTouchPointersRef.current.size >= 2) {
      const pts = Array.from(activeTouchPointersRef.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      const dist = Math.max(12, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const scaleRatio = dist / Math.max(12, pinchGestureRef.current.startDist);
      const nextZoom = Math.max(
        0.65,
        Math.min(3.2, Number((pinchGestureRef.current.startZoom * scaleRatio).toFixed(2)))
      );
      setViewZoom(nextZoom);

      const dMidX = midX - pinchGestureRef.current.startMidX;
      const dMidY = midY - pinchGestureRef.current.startMidY;
      setViewPan({
        x: Math.max(-320, Math.min(320, Math.round(pinchGestureRef.current.startPanX - dMidX / nextZoom))),
        y: Math.max(-280, Math.min(280, Math.round(pinchGestureRef.current.startPanY - dMidY / nextZoom))),
      });
      return;
    }

    if (rotateDragRef.current?.active) {
      const dx = e.clientX - rotateDragRef.current.startX;
      const dy = e.clientY - rotateDragRef.current.startY;
      // Unrestricted 360° yaw rotation; pitch clamped between -85° and +85° to keep tunnel upright
      const rawYaw = Math.round(rotateDragRef.current.startYaw + dx * 0.45);
      const rawPitch = Math.round(rotateDragRef.current.startPitch + dy * 0.45);
      const wrappedYaw = ((((rawYaw + 180) % 360) + 360) % 360) - 180;
      const clampedPitch = Math.max(-85, Math.min(85, rawPitch));
      scheduleRotationUpdate(wrappedYaw, clampedPitch);
      return;
    }

    // When in rotate mode and not drawing, skip heavy inverse grid solver
    if (insideNavMode === 'rotate' && !isDrawing3D) {
      updateHoverCursorDom(null);
      return;
    }

    const pt = getSvgCoords(e);
    const resolved = resolve3DSvgPointToSurfaceAndPanelPt(pt.x, pt.y);

    if (!resolved) {
      updateHoverCursorDom(null);
      return;
    }

    updateHoverCursorDom({
      svgX: pt.x,
      svgY: pt.y,
      panel: resolved.panel,
      pullMeter: resolved.pullMeter,
      perimMeter: resolved.perimMeter,
      u: resolved.u,
      v: resolved.v,
    });

    if (!isDrawing3D) return;

    const isLithoEraserMove =
      activeTool === 'litho_eraser' ||
      (activeTool === '1_lithology' && lithologySubMode === 'erase_area');

    if (isLithoEraserMove) {
      eraseLithology3DNearPoint(resolved.panel, resolved.panelPt, pt);
      setLiveStrokeSamples((prev) => [
        ...prev.slice(-18),
        {
          svgX: pt.x,
          svgY: pt.y,
          panel: resolved.panel,
          panelPt: resolved.panelPt,
          u: resolved.u,
          v: resolved.v,
          pullMeter: resolved.pullMeter,
          perimMeter: resolved.perimMeter,
        },
      ]);
      return;
    }

    if (activeTool === 'eraser') {
      erase3DNearPoint(resolved.panel, resolved.panelPt, pt);
      setLiveStrokeSamples((prev) => [
        ...prev.slice(-18),
        {
          svgX: pt.x,
          svgY: pt.y,
          panel: resolved.panel,
          panelPt: resolved.panelPt,
          u: resolved.u,
          v: resolved.v,
          pullMeter: resolved.pullMeter,
          perimMeter: resolved.perimMeter,
        },
      ]);
      return;
    }

    const last = liveStrokeSamples[liveStrokeSamples.length - 1];
    if (last && Math.hypot(pt.x - last.svgX, pt.y - last.svgY) < 3.5) return;

    setLiveStrokeSamples((prev) => [
      ...prev,
      {
        svgX: pt.x,
        svgY: pt.y,
        panel: resolved.panel,
        panelPt: resolved.panelPt,
        u: resolved.u,
        v: resolved.v,
        pullMeter: resolved.pullMeter,
        perimMeter: resolved.perimMeter,
      },
    ]);
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) {
      activeTouchPointersRef.current.delete(e.pointerId);
    } else {
      activeTouchPointersRef.current.clear();
    }
    if (pinchGestureRef.current?.active) {
      if (activeTouchPointersRef.current.size < 2) {
        pinchGestureRef.current = null;
      }
      return;
    }
    if (rotateDragRef.current?.active) {
      rotateDragRef.current = null;
      if (rotationRafIdRef.current) {
        cancelAnimationFrame(rotationRafIdRef.current);
        rotationRafIdRef.current = null;
      }
      if (pendingRotationRef.current) {
        setInsideYawDeg(pendingRotationRef.current.yaw);
        setInsidePitchDeg(pendingRotationRef.current.pitch);
        pendingRotationRef.current = null;
      }
      return;
    }

    if (!isDrawing3D) return;
    setIsDrawing3D(false);

    if (activeTool === 'eraser') {
      setLiveStrokeSamples([]);
      return;
    }

    // Calculate total SVG drag distance to block ghost touches / accidental taps!
    let totalDragSvgDist = 0;
    for (let i = 1; i < liveStrokeSamples.length; i++) {
      totalDragSvgDist += Math.hypot(
        liveStrokeSamples[i].svgX - liveStrokeSamples[i - 1].svgX,
        liveStrokeSamples[i].svgY - liveStrokeSamples[i - 1].svgY
      );
    }

    const isTraceOrDipTool =
      activeTool === '3_joint_trace' ||
      activeTool === '2_vein_foliation' ||
      activeTool === '4_dip_surface' ||
      activeTool === '5_geo_feature';

    // Stop Ghost Touch: For trace & dip tools, strictly require an intended drag gesture (>= 18px and >= 3 samples).
    // Accidental single touches will NEVER create traces or alter dip direction / dip amount!
    if (isTraceOrDipTool && (liveStrokeSamples.length < 3 || totalDragSvgDist < 18)) {
      setLiveStrokeSamples([]);
      return;
    }

    // Allow single-tap placement ONLY for Water Mark or Lithology paint if intended
    let effectiveSamples = liveStrokeSamples;
    if (
      effectiveSamples.length === 1 &&
      (activeTool === '1_lithology' || activeTool === '6_water_mark')
    ) {
      const s0 = effectiveSamples[0];
      effectiveSamples = [
        s0,
        {
          ...s0,
          svgX: s0.svgX + 12,
          svgY: s0.svgY + 8,
          panelPt: { x: s0.panelPt.x + 18, y: s0.panelPt.y + 12 },
        },
      ];
    }

    commitEffectiveSamples(effectiveSamples);
    setLiveStrokeSamples([]);
  };

  const commitEffectiveSamples = (effectiveSamples: typeof liveStrokeSamples) => {
    if (effectiveSamples.length < 2) return;

    const runs: { panel: FieldPanelId; points: FieldPoint2D[] }[] = [];
    for (let i = 0; i < effectiveSamples.length; i++) {
      const sample = effectiveSamples[i];
      if (runs.length === 0 || runs[runs.length - 1].panel !== sample.panel) {
        if (runs.length > 0) {
          const prevRun = runs[runs.length - 1];
          const prevLastPt = prevRun.points[prevRun.points.length - 1];
          const prevGeom = getPanelGeom(prevRun.panel);
          const currGeom = getPanelGeom(sample.panel);

          if (
            (prevRun.panel === 'left_wall' && sample.panel === 'crown') ||
            (prevRun.panel === 'crown' && sample.panel === 'left_wall')
          ) {
            // At Left Springline boundary:
            // left_wall: v = 0 (SPL), u in [0, 1] is pull (0 = 0m, 1 = face)
            // crown: u = 0 (Left SPL), v in [0, 1] is pull (0 = face, 1 = 0m)
            const prevU = (prevLastPt.x - prevGeom.boxX) / Math.max(1, prevGeom.boxW);
            const currU = (sample.panelPt.x - currGeom.boxX) / Math.max(1, currGeom.boxW);
            const prevV = (prevLastPt.y - prevGeom.boxY) / Math.max(1, prevGeom.boxH);
            const currV = (sample.panelPt.y - currGeom.boxY) / Math.max(1, currGeom.boxH);

            let pullFrac = 0.5; // 0 = 0m pull, 1 = face advance
            if (prevRun.panel === 'left_wall') {
              pullFrac = Math.max(0.01, Math.min(0.99, (prevU + (1 - currV)) / 2));
            } else {
              pullFrac = Math.max(0.01, Math.min(0.99, ((1 - prevV) + currU) / 2));
            }

            const lwPt = {
              x: Number((getPanelGeom('left_wall').boxX + pullFrac * getPanelGeom('left_wall').boxW).toFixed(1)),
              y: Number((getPanelGeom('left_wall').boxY + 0.004 * getPanelGeom('left_wall').boxH).toFixed(1)),
            };
            const crPt = {
              x: Number((getPanelGeom('crown').boxX + 0.004 * getPanelGeom('crown').boxW).toFixed(1)),
              y: Number((getPanelGeom('crown').boxY + (1 - pullFrac) * getPanelGeom('crown').boxH).toFixed(1)),
            };

            prevRun.points.push(prevRun.panel === 'left_wall' ? lwPt : crPt);
            runs.push({
              panel: sample.panel,
              points: [sample.panel === 'crown' ? crPt : lwPt, sample.panelPt],
            });
            continue;
          }

          if (
            (prevRun.panel === 'crown' && sample.panel === 'right_wall') ||
            (prevRun.panel === 'right_wall' && sample.panel === 'crown')
          ) {
            // At Right Springline boundary:
            // crown: u = 1 (Right SPL), v in [0, 1] is pull (0 = face, 1 = 0m)
            // right_wall: v = 0 (SPL), u in [0, 1] is pull (0 = face, 1 = 0m)
            const prevV = (prevLastPt.y - prevGeom.boxY) / Math.max(1, prevGeom.boxH);
            const currV = (sample.panelPt.y - currGeom.boxY) / Math.max(1, currGeom.boxH);
            const prevU = (prevLastPt.x - prevGeom.boxX) / Math.max(1, prevGeom.boxW);
            const currU = (sample.panelPt.x - currGeom.boxX) / Math.max(1, currGeom.boxW);

            let pullDownFrac = 0.5; // 0 = face advance, 1 = 0m pull
            if (prevRun.panel === 'crown') {
              pullDownFrac = Math.max(0.01, Math.min(0.99, (prevV + currU) / 2));
            } else {
              pullDownFrac = Math.max(0.01, Math.min(0.99, (prevU + currV) / 2));
            }

            const crPt = {
              x: Number((getPanelGeom('crown').boxX + 0.996 * getPanelGeom('crown').boxW).toFixed(1)),
              y: Number((getPanelGeom('crown').boxY + pullDownFrac * getPanelGeom('crown').boxH).toFixed(1)),
            };
            const rwPt = {
              x: Number((getPanelGeom('right_wall').boxX + pullDownFrac * getPanelGeom('right_wall').boxW).toFixed(1)),
              y: Number((getPanelGeom('right_wall').boxY + 0.004 * getPanelGeom('right_wall').boxH).toFixed(1)),
            };

            prevRun.points.push(prevRun.panel === 'crown' ? crPt : rwPt);
            runs.push({
              panel: sample.panel,
              points: [sample.panel === 'right_wall' ? rwPt : crPt, sample.panelPt],
            });
            continue;
          }
        }

        runs.push({
          panel: sample.panel,
          points: [sample.panelPt],
        });
      } else {
        runs[runs.length - 1].points.push(sample.panelPt);
      }
    }

    const validRuns = runs.filter((r) => r.points.length >= 2);
    if (validRuns.length === 0) {
      setLiveStrokeSamples([]);
      return;
    }

    onPushUndo();
    const now = Date.now();
    let lastCreatedTraceId: string | null = null;
    let lastCreatedPanel: FieldPanelId = validRuns[validRuns.length - 1].panel;
    let lastCreatedPanelPt: FieldPoint2D =
      validRuns[validRuns.length - 1].points[validRuns[validRuns.length - 1].points.length - 1];
    const isResumingPending =
      isJointTraceTool && pendingTraceSession && pendingTraceSession.tool === '3_joint_trace';
    const nextTraceIdsByPanel: Partial<Record<FieldPanelId, string>> = isResumingPending
      ? { ...pendingTraceSession.traceIdsByPanel }
      : {};
    const nextRawPointsByPanel: Partial<Record<FieldPanelId, FieldPoint2D[]>> = isResumingPending
      ? { ...pendingTraceSession.rawPointsByPanel }
      : {};
    const newlyCreatedIds: string[] = [];
    let initialOrientationToEmit: { dipDirection: number; dipAmount: number } | null = null;

    onUpdateRound((r) => {
      let nextR = { ...r };

      validRuns.forEach((run, idx) => {
        // Only Joint Trace ('3_joint_trace') accumulates into the current pending joint until the user clicks "OK"!
        const existingIdForPanel = isResumingPending ? nextTraceIdsByPanel[run.panel] : undefined;
        const prevRawPts = isResumingPending ? nextRawPointsByPanel[run.panel] : undefined;
        let fullRawPts = run.points;
        if (prevRawPts && prevRawPts.length >= 2 && run.points.length >= 2) {
          // Connect smoothly in continuous order from whichever endpoint is closer
          const prevEnd = prevRawPts[prevRawPts.length - 1];
          const prevStart = prevRawPts[0];
          const newStart = run.points[0];
          const newEnd = run.points[run.points.length - 1];
          const dEndToStart = Math.hypot(newStart.x - prevEnd.x, newStart.y - prevEnd.y);
          const dEndToEnd = Math.hypot(newEnd.x - prevEnd.x, newEnd.y - prevEnd.y);
          const dStartToEnd = Math.hypot(newEnd.x - prevStart.x, newEnd.y - prevStart.y);
          if (dEndToEnd < dEndToStart && dEndToEnd < dStartToEnd) {
            fullRawPts = [...prevRawPts, ...run.points.slice().reverse()];
          } else if (dStartToEnd < dEndToStart) {
            fullRawPts = [...run.points, ...prevRawPts];
          } else {
            fullRawPts = [...prevRawPts, ...run.points];
          }
        }
        if (isJointTraceTool) {
          nextRawPointsByPanel[run.panel] = fullRawPts;
        }

        const shapePencilPoints = (ptsInput: FieldPoint2D[]): FieldPoint2D[] => {
          return smoothTraceWithLevel(ptsInput, 'high');
        };

        if (activeTool === '1_lithology') {
          const rockMeta = resolveRockDisplayInfo(selectedRockType, rememberedRocksList);
          const id = `lith-3d-${now}-${idx}`;
          newlyCreatedIds.push(id);
          const pts = run.points;
          const isClosedLoop =
            pts.length >= 3 &&
            Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 48;
          const finalPolygon = isClosedLoop ? [...pts, pts[0]] : undefined;
          const stroke: FieldLithologyStroke = {
            id,
            panel: run.panel,
            rockType: selectedRockType,
            rockName: rockMeta.name,
            rockCode: rockMeta.code,
            color: rockMeta.color,
            fillColor: rockMeta.fillColor,
            patternId: rockMeta.patternId,
            mode: lithologySubMode === 'erase_area' ? 'lithology_erase' : 'region_fill',
            points: run.points,
            isClosed: isClosedLoop,
            polygon: finalPolygon,
            brushRadius,
            symbolDensity: r.lithologySymbolDensity ?? lithologySymbolDensity,
          };
          nextR = {
            ...nextR,
            lithologyStrokes: pruneFullyErasedLithologyStrokes([
              ...nextR.lithologyStrokes,
              stroke,
            ]),
          };
        } else if (activeTool === '2_vein_foliation') {
          const vMeta = resolveRockDisplayInfo(selectedVeinRockId, rememberedRocksList);
          const prevStroke = existingIdForPanel
            ? nextR.lithologyStrokes.find((s) => s.id === existingIdForPanel)
            : undefined;
          const combinedPts = shapePencilPoints(fullRawPts);
          const est = estimateTraceOrientationFromGeometry(
            combinedPts,
            run.panel,
            r.tunnelDriveDirection,
            liveCrownSign,
            activeLocation.widthM,
            activeLocation.heightM
          );
          if (idx === 0) initialOrientationToEmit = { dipDirection: est.dipDirection, dipAmount: est.dipAmount };

          const id = prevStroke ? prevStroke.id : `vein-3d-${now}-${idx}`;
          nextTraceIdsByPanel[run.panel] = id;
          newlyCreatedIds.push(id);
          const stroke: FieldLithologyStroke = {
            id,
            panel: run.panel,
            rockType: selectedVeinRockId,
            rockName: vMeta.name,
            rockCode: vMeta.code,
            color: vMeta.color,
            fillColor: vMeta.fillColor,
            patternId: vMeta.patternId,
            mode: veinOrFoliationSubMode,
            points: combinedPts,
            brushRadius: Math.round(veinBandThicknessPx / 2),
            bandThicknessPx: veinBandThicknessPx,
            symbolSize: veinBandSymbolSize,
            symbolDensity: veinBandSymbolDensity,
            lineMode: 'smooth',
            foliationDipDirection: est.dipDirection,
            foliationDipAmount: est.dipAmount,
          };
          nextR = {
            ...nextR,
            lithologyStrokes: prevStroke
              ? nextR.lithologyStrokes.map((s) => (s.id === id ? stroke : s))
              : [...nextR.lithologyStrokes, stroke],
          };
        } else if (activeTool === '4_dip_surface') {
          const prevDs = existingIdForPanel
            ? (nextR.dipPlaneSurfaces || []).find((d) => d.id === existingIdForPanel)
            : undefined;
          // Dip Plane Surface ONLY uses raw points (no smooth or linear mode!)
          const combinedPts = fullRawPts;
          const est = estimateTraceOrientationFromGeometry(
            combinedPts,
            run.panel,
            r.tunnelDriveDirection,
            liveCrownSign,
            activeLocation.widthM,
            activeLocation.heightM
          );
          if (idx === 0) initialOrientationToEmit = { dipDirection: est.dipDirection, dipAmount: est.dipAmount };
          const { outlinePolygon } = buildDipSurfacePolygonWithOutlineSnap(
            combinedPts,
            run.panel,
            activeLocation,
            nextR
          );
          const id = prevDs ? prevDs.id : `dips-3d-${now}-${idx}`;
          nextTraceIdsByPanel[run.panel] = id;
          newlyCreatedIds.push(id);
          const ds: FieldDipPlaneSurface = {
            id,
            label: 'Dip Surface',
            panel: run.panel,
            points: combinedPts,
            outlinePolygon,
            brushRadius: 2,
            dipDirection: est.dipDirection,
            dipAmount: est.dipAmount,
            strike: est.strike,
            setId: activeGroupingSet,
            lineMode: 'linear',
          };
          nextR = {
            ...nextR,
            dipPlaneSurfaces: prevDs
              ? (nextR.dipPlaneSurfaces || []).map((d) => (d.id === id ? ds : d))
              : [...(nextR.dipPlaneSurfaces || []), ds],
          };
        } else if (activeTool === '5_geo_feature') {
          const meta =
            FIELD_STRUCTURAL_FEATURE_CATALOG.find((f) => f.id === selectedGeoFeatureType) ||
            FIELD_STRUCTURAL_FEATURE_CATALOG[0];
          const prevFeat = existingIdForPanel
            ? (nextR.structuralFeatures || []).find((f) => f.id === existingIdForPanel)
            : undefined;
          const combinedPts = shapePencilPoints(fullRawPts);
          const est = estimateTraceOrientationFromGeometry(
            combinedPts,
            run.panel,
            r.tunnelDriveDirection,
            liveCrownSign,
            activeLocation.widthM,
            activeLocation.heightM
          );
          if (idx === 0) initialOrientationToEmit = { dipDirection: est.dipDirection, dipAmount: est.dipAmount };
          const id = prevFeat ? prevFeat.id : `sfeat-3d-${now}-${idx}`;
          nextTraceIdsByPanel[run.panel] = id;
          newlyCreatedIds.push(id);
          const feat: FieldStructuralFeature = {
            id,
            panel: run.panel,
            featureType: selectedGeoFeatureType,
            label: meta.shortCode,
            points: combinedPts,
            dipDirection: est.dipDirection,
            dipAmount: est.dipAmount,
            strokeWidthPx: geoFeaturePencilSizePx,
            symbolSize: geoFeatureSymbolSize,
            symbolDensity: geoFeatureSymbolDensity,
            lineMode: effectivePencilLineMode,
          };
          nextR = {
            ...nextR,
            structuralFeatures: prevFeat
              ? (nextR.structuralFeatures || []).map((f) => (f.id === id ? feat : f))
              : [...(nextR.structuralFeatures || []), feat],
          };
        } else if (activeTool === '6_water_mark') {
          const id = `wtr-3d-${now}-${idx}`;
          newlyCreatedIds.push(id);
          const wm: FieldWaterMark = {
            id,
            panel: run.panel,
            condition: selectedWaterCondition,
            points: run.points,
            brushRadius: Math.max(24, brushRadius),
          };
          nextR = {
            ...nextR,
            waterMarks: [...nextR.waterMarks, wm],
          };
        } else {
          // Tool 3: Joint Trace (supports Smooth / Linear + Confirmation!)
          const prevTr = existingIdForPanel
            ? nextR.jointTraces.find((t) => t.id === existingIdForPanel)
            : undefined;
          const combinedPts = shapePencilPoints(fullRawPts);
          const est = estimateTraceOrientationFromGeometry(
            combinedPts,
            run.panel,
            r.tunnelDriveDirection,
            liveCrownSign,
            activeLocation.widthM,
            activeLocation.heightM
          );
          if (idx === 0) initialOrientationToEmit = { dipDirection: est.dipDirection, dipAmount: est.dipAmount };

          const newId = prevTr ? prevTr.id : `jtr-3d-${now}-${idx}-${run.panel}`;
          nextTraceIdsByPanel[run.panel] = newId;
          newlyCreatedIds.push(newId);
          lastCreatedTraceId = newId;
          lastCreatedPanel = run.panel;
          const tr: FieldJointTrace = {
            id: newId,
            panel: run.panel,
            setId: activeGroupingSet,
            label: activeGroupingSet === 'unassigned' ? 'J' : activeGroupingSet,
            points: combinedPts,
            dipDirection: est.dipDirection,
            dipAmount: est.dipAmount,
            strike: est.strike,
            crownDipSign: liveCrownSign,
            traceLengthM: est.traceLengthM,
            strokeWidthPx: jointPencilSizePx,
            lineMode: effectivePencilLineMode,
          };
          nextR = {
            ...nextR,
            jointTraces: prevTr
              ? nextR.jointTraces.map((t) => (t.id === newId ? tr : t))
              : [...nextR.jointTraces, tr],
          };
        }
      });

      return nextR;
    });

    const allSessionIds = Array.from(
      new Set([...(Object.values(nextTraceIdsByPanel).filter(Boolean) as string[]), ...newlyCreatedIds])
    );
    setLatestCompletedIds(allSessionIds);

    // For 3D Joint Tracing ('3_joint_trace'), ask "OK" for each joint before finishing it!
    if (isJointTraceTool) {
      setPendingTraceSession({
        tool: activeTool,
        traceIdsByPanel: nextTraceIdsByPanel,
        rawPointsByPanel: nextRawPointsByPanel,
        lastPanel: lastCreatedPanel,
        lastPanelPt: lastCreatedPanelPt,
        segmentCount: (pendingTraceSession?.segmentCount || 0) + 1,
      });
      emitField3DPendingJointChange(true);
    }

    if (initialOrientationToEmit) {
      const { dipDirection, dipAmount } = initialOrientationToEmit;
      setTimeout(() => onSetLiveOrientation(dipDirection, dipAmount), 0);
    }

    if (lastCreatedTraceId) {
      onSelectTraceId(lastCreatedTraceId, lastCreatedPanel);
    }

    setLiveStrokeSamples([]);
  };

  const handleAdjustSelectedJointAngle = (field: 'dipDirection' | 'dipAmount', delta: number) => {
    if (!selectedTraceId) return;
    onPushUndo();
    let updatedOrientation: { dipDirection: number; dipAmount: number } | null = null;
    onUpdateRound((r) => {
      const tr = r.jointTraces.find((t) => t.id === selectedTraceId);
      if (!tr) return r;
      const newDipDir =
        field === 'dipDirection'
          ? (tr.dipDirection + delta + 360) % 360
          : tr.dipDirection;
      const newDipAmt =
        field === 'dipAmount'
          ? Math.max(5, Math.min(89, tr.dipAmount + delta))
          : tr.dipAmount;
      const newStrike = (newDipDir + 270) % 360;
      updatedOrientation = { dipDirection: newDipDir, dipAmount: newDipAmt };
      return {
        ...r,
        jointTraces: r.jointTraces.map((t) =>
          t.id === selectedTraceId
            ? {
                ...t,
                dipDirection: newDipDir,
                dipAmount: newDipAmt,
                strike: newStrike,
                editedByCompass: true,
              }
            : t
        ),
      };
    });
    if (updatedOrientation) {
      const { dipDirection, dipAmount } = updatedOrientation;
      setTimeout(() => onSetLiveOrientation(dipDirection, dipAmount), 0);
    }
  };

  const handleDeleteSelectedJoint = (id: string) => {
    onPushUndo();
    onUpdateRound((r) => ({
      ...r,
      jointTraces: r.jointTraces.filter((t) => t.id !== id),
    }));
    onSelectTraceId(null);
  };

  // Currently selected joint trace for 3D inspection
  const selectedJointForInspector = useMemo(() => {
    if (!selectedTraceId) return null;
    return activeRound.jointTraces.find((t) => t.id === selectedTraceId) || null;
  }, [selectedTraceId, activeRound.jointTraces]);

  // 3D Spatial Cutting Disc Plane for currently selected joint
  const inspectedJoint3DDisc = useMemo(() => {
    if (!show3DSpatialDisc || !selectedTraceId) return null;
    const joint = activeRound.jointTraces.find((t) => t.id === selectedTraceId);
    if (!joint || joint.points.length < 2) return null;

    const midPt = joint.points[Math.floor(joint.points.length / 2)];
    const geom = getPanelGeom(joint.panel);
    const u = Math.max(0.01, Math.min(0.99, (midPt.x - geom.boxX) / Math.max(1, geom.boxW)));
    const v = Math.max(0.01, Math.min(0.99, (midPt.y - geom.boxY) / Math.max(1, geom.boxH)));

    let anchorX = 0;
    let anchorY = 0.5;
    let anchorZ = 0.45;

    if (joint.panel === 'face') {
      anchorX = u - 0.5;
      anchorY = v;
      anchorZ = 0.02;
    } else if (joint.panel === 'crown') {
      const { nx, ny } = interpolatePerimeterAtV('crown', u);
      anchorX = nx;
      anchorY = ny;
      anchorZ = v;
    } else if (joint.panel === 'left_wall') {
      const { nx, ny } = interpolatePerimeterAtV('left_wall', 1 - v);
      anchorX = nx;
      anchorY = ny;
      anchorZ = 1 - u;
    } else if (joint.panel === 'right_wall') {
      const { nx, ny } = interpolatePerimeterAtV('right_wall', v);
      anchorX = nx;
      anchorY = ny;
      anchorZ = u;
    }

    const relAzRad =
      (((joint.dipDirection - activeRound.tunnelDriveDirection + 360) % 360) * Math.PI) / 180;
    const isCrown = joint.panel === 'crown';
    const effectiveDip =
      (joint.dipAmount === 0 || joint.dipAmount == null) && isCrown
        ? 90
        : (joint.dipAmount ?? (isCrown ? 90 : 65));
    const dipRad = (Math.max(5, Math.min(90, effectiveDip)) * Math.PI) / 180;

    const sinDip = Math.sin(dipRad);
    const cosDip = Math.cos(dipRad);
    const nX = sinDip * Math.sin(relAzRad);
    const nZ = -sinDip * Math.cos(relAzRad);
    const nY = -cosDip;

    let uX = Math.cos(relAzRad);
    let uY = 0;
    let uZ = Math.sin(relAzRad);

    let vX = nY * uZ - nZ * uY;
    let vY = nZ * uX - nX * uZ;
    let vZ = nX * uY - nY * uX;

    // Hinge-based joint plane rotation for Face and Walls; dip-amount-based tilt for Crown:
    if (joint.points && joint.points.length >= 2) {
      const p1 = joint.points[0];
      const p2 = joint.points[joint.points.length - 1];
      const du = p2.x - p1.x;
      const dv = p2.y - p1.y;
      const len = Math.hypot(du, dv);

      if (len > 0.001) {
        if (joint.panel === 'face') {
          // Face trace hinge:
          const huX = du / len;
          const huY = -dv / len;
          const huZ = 0;

          const hwX = dv / len;
          const hwY = du / len;

          const isHeading = Math.cos(relAzRad) >= 0;
          const zSign = isHeading ? 1 : -1;

          uX = huX;
          uY = huY;
          uZ = huZ;

          vX = hwX * Math.cos(dipRad);
          vY = hwY * Math.cos(dipRad);
          vZ = zSign * Math.sin(dipRad);
        } else if (joint.panel === 'left_wall') {
          // Left wall: hinge axis in (Z, Y) wall plane
          const huZ = du / len;
          const huY = -dv / len;
          const huX = 0;

          const hwZ = dv / len;
          const hwY = du / len;

          const isRockSide = Math.sin(relAzRad) <= 0;
          const xSign = isRockSide ? -1 : 1;

          uX = huX;
          uY = huY;
          uZ = huZ;

          vX = xSign * Math.sin(dipRad);
          vY = hwY * Math.cos(dipRad);
          vZ = hwZ * Math.cos(dipRad);
        } else if (joint.panel === 'right_wall') {
          // Right wall: hinge axis in (Z, Y) wall plane
          const huZ = -du / len;
          const huY = -dv / len;
          const huX = 0;

          const hwZ = dv / len;
          const hwY = -du / len;

          const isRockSide = Math.sin(relAzRad) >= 0;
          const xSign = isRockSide ? 1 : -1;

          uX = huX;
          uY = huY;
          uZ = huZ;

          vX = xSign * Math.sin(dipRad);
          vY = hwY * Math.cos(dipRad);
          vZ = hwZ * Math.cos(dipRad);
        } else if (joint.panel === 'crown') {
          // Crown: mapped trace defines the horizontal strike direction (uX, 0, uZ).
          // The 3D plane dips at dipRad (ideal = 90°) strictly relative to the strike direction downward (+Y) toward the invert.
          const huX = du / len;
          const huZ = dv / len;
          const huY = 0;

          const sideSign = joint.crownDipSign === '-90' ? -1 : 1;
          const hwX = -huZ * sideSign;
          const hwZ = huX * sideSign;

          uX = huX;
          uY = huY;
          uZ = huZ;

          vX = hwX * Math.cos(dipRad);
          vY = Math.sin(dipRad);
          vZ = hwZ * Math.cos(dipRad);
        }
      }
    }

    const radius = 0.32;
    const discSvgPts: FieldPoint2D[] = [];
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = anchorX + radius * (cosT * uX + sinT * vX);
      const py = anchorY + radius * (cosT * uY + sinT * vY);
      const pz = anchorZ + radius * (cosT * uZ + sinT * vZ);
      discSvgPts.push(projectTunnel3DPoint(px, py, pz, joint.panel));
    }

    const centerSvg = projectTunnel3DPoint(anchorX, anchorY, anchorZ, joint.panel);
    const strikeEnd1 = projectTunnel3DPoint(
      anchorX - radius * 0.95 * uX,
      anchorY - radius * 0.95 * uY,
      anchorZ - radius * 0.95 * uZ,
      joint.panel
    );
    const strikeEnd2 = projectTunnel3DPoint(
      anchorX + radius * 0.95 * uX,
      anchorY + radius * 0.95 * uY,
      anchorZ + radius * 0.95 * uZ,
      joint.panel
    );
    const dipArrowEnd = projectTunnel3DPoint(
      anchorX + radius * 0.85 * vX,
      anchorY + radius * 0.85 * vY,
      anchorZ + radius * 0.85 * vZ,
      joint.panel
    );

    return {
      joint: { ...joint, dipAmount: effectiveDip },
      effectiveDip,
      discSvgPts,
      centerSvg,
      strikeEnd1,
      strikeEnd2,
      dipArrowEnd,
    };
  }, [
    show3DSpatialDisc,
    selectedTraceId,
    activeRound.jointTraces,
    activeRound.tunnelDriveDirection,
    interpolatePerimeterAtV,
    projectTunnel3DPoint,
    getPanelGeom,
  ]);

  // Build 3D surface wireframe, 1m × 1m true grid lines (starting at 0m on First Outer Line -> going inward through pull), & auto-fit viewBox
  const surfaceMeshes = useMemo(() => {
    const panels: ('left_wall' | 'crown' | 'right_wall')[] = [
      ...(perimeterData.hasLeftWall ? (['left_wall'] as const) : []),
      ...(perimeterData.hasCrown ? (['crown'] as const) : []),
      ...(perimeterData.hasRightWall ? (['right_wall'] as const) : []),
    ];

    // Exact 1.0m longitudinal pull steps starting from First Outer Line (0m, tPull = 1.0) inward through pull toward Inner Core (pullM, tPull = 0.0)
    const meterPullFracs: { m: number; tPull: number }[] = [];
    const maxPullInt = Math.floor(pullM);
    for (let m = 1; m <= maxPullInt; m++) {
      const pullNorm = m / pullM; // 0m = 0 -> pullM = 1
      const t = 1 - pullNorm; // First Outer Line = 1 -> Inner Core = 0
      if (t > 0.02 && t < 0.98) {
        meterPullFracs.push({ m, tPull: t });
      }
    }

    let minX = 480;
    let maxX = 520;
    let minY = 480;
    let maxY = 520;
    const expandBounds = (pt: { x: number; y: number }) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    };

    const panelStrips = panels.map((panelId) => {
      const pNodes = perimeterData.nodes.filter((n) => n.panel === panelId);
      const faceRing = pNodes.map((n) => {
        const pt = projectTunnel3DPoint(n.nx, n.ny, 0, panelId);
        expandBounds(pt);
        return pt;
      });
      const portalRing = pNodes
        .slice()
        .reverse()
        .map((n) => {
          const pt = projectTunnel3DPoint(n.nx, n.ny, 1, panelId);
          expandBounds(pt);
          return pt;
        });
      const polyPts = [...faceRing, ...portalRing]
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ');

      // 1m longitudinal grid lines along the perimeter (on Left Wall, starting from 0m at the outer invert starting edge v=0!)
      const panelLenM =
        panelId === 'left_wall'
          ? perimeterData.leftWallLenM
          : panelId === 'crown'
          ? perimeterData.crownLenM
          : perimeterData.rightWallLenM;
      const perimMeterSteps = Math.max(1, Math.floor(panelLenM));
      const longitudinalGridLines: {
        m: number;
        p0: { x: number; y: number };
        p1: { x: number; y: number };
      }[] = [];
      for (let m = 1; m <= perimMeterSteps; m++) {
        const fracFromStart = m / Math.max(0.5, panelLenM);
        if (fracFromStart >= 0.98) continue;
        const targetV = fracFromStart;
        const { nx, ny } = interpolatePerimeterAtV(panelId, targetV);
        longitudinalGridLines.push({
          m,
          p0: projectTunnel3DPoint(nx, ny, 0, panelId),
          p1: projectTunnel3DPoint(nx, ny, 1, panelId),
        });
      }

      return {
        panelId,
        polyPts,
        pNodes,
        longitudinalGridLines,
      };
    });

    const facePts = perimeterData.facePolygonNorm
      .map((p) => {
        const pt = projectTunnel3DPoint(p.nx, p.ny, 0, 'face');
        expandBounds(pt);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');

    const crownNodes = perimeterData.nodes.filter((n) => n.panel === 'crown');
    const leftSplFace = crownNodes.length
      ? projectTunnel3DPoint(crownNodes[0].nx, crownNodes[0].ny, 0, 'crown')
      : null;
    const leftSplPortal = crownNodes.length
      ? projectTunnel3DPoint(crownNodes[0].nx, crownNodes[0].ny, 1, 'crown')
      : null;
    const rightSplFace = crownNodes.length
      ? projectTunnel3DPoint(
          crownNodes[crownNodes.length - 1].nx,
          crownNodes[crownNodes.length - 1].ny,
          0,
          'crown'
        )
      : null;
    const rightSplPortal = crownNodes.length
      ? projectTunnel3DPoint(
          crownNodes[crownNodes.length - 1].nx,
          crownNodes[crownNodes.length - 1].ny,
          1,
          'crown'
        )
      : null;

    // Invert Floor mesh (connecting bottom of left wall to bottom of right wall along tunnel drive)
    const lwNodes = perimeterData.nodes.filter((n) => n.panel === 'left_wall');
    const rwNodes = perimeterData.nodes.filter((n) => n.panel === 'right_wall');
    const leftInvertNode = lwNodes[0] || { nx: -0.5, ny: 1.0 };
    const rightInvertNode = rwNodes[rwNodes.length - 1] || { nx: 0.5, ny: 1.0 };

    const invLPortal = projectTunnel3DPoint(leftInvertNode.nx, leftInvertNode.ny, 1, 'left_wall');
    const invLFace = projectTunnel3DPoint(leftInvertNode.nx, leftInvertNode.ny, 0, 'left_wall');
    const invRFace = projectTunnel3DPoint(rightInvertNode.nx, rightInvertNode.ny, 0, 'right_wall');
    const invRPortal = projectTunnel3DPoint(rightInvertNode.nx, rightInvertNode.ny, 1, 'right_wall');
    const invertFloorPts = `${invLPortal.x.toFixed(1)},${invLPortal.y.toFixed(1)} ${invLFace.x.toFixed(1)},${invLFace.y.toFixed(1)} ${invRFace.x.toFixed(1)},${invRFace.y.toFixed(1)} ${invRPortal.x.toFixed(1)},${invRPortal.y.toFixed(1)}`;

    const invCenterPortal = projectTunnel3DPoint(0, 1.0, 1);
    const invCenterFace = projectTunnel3DPoint(0, 1.0, 0);
    const invertRibs = meterPullFracs.map(({ m, tPull }) => ({
      m,
      p0: projectTunnel3DPoint(leftInvertNode.nx, leftInvertNode.ny, tPull, 'left_wall'),
      p1: projectTunnel3DPoint(rightInvertNode.nx, rightInvertNode.ny, tPull, 'right_wall'),
    }));

    // Fixed stable 1000×1000 canvas viewBox scaled ONLY by explicit user zoom/pan:
    // Never resizes on rotation angle, preventing shrinking/expanding rubber-banding!
    const effectiveZoom = Math.max(0.65, Math.min(3.2, viewZoom));
    const zoomedW = 1000 / effectiveZoom;
    const zoomedH = 1000 / effectiveZoom;
    const centerX = 500 + viewPan.x;
    const centerY = 500 + viewPan.y;
    const autoViewBox = `${(centerX - zoomedW / 2).toFixed(1)} ${(centerY - zoomedH / 2).toFixed(1)} ${zoomedW.toFixed(1)} ${zoomedH.toFixed(1)}`;

    const leftWallPts =
      panelStrips.find((s) => s.panelId === 'left_wall')?.polyPts || '';
    const rightWallPts =
      panelStrips.find((s) => s.panelId === 'right_wall')?.polyPts || '';
    const crownPts =
      panelStrips.find((s) => s.panelId === 'crown')?.polyPts || '';

    return {
      panelStrips,
      facePts,
      leftWallPts,
      rightWallPts,
      crownPts,
      meterPullFracs,
      leftSplFace,
      leftSplPortal,
      rightSplFace,
      rightSplPortal,
      invertFloorPts,
      invCenterPortal,
      invCenterFace,
      invertRibs,
      autoViewBox,
    };
  }, [
    perimeterData,
    subMode,
    foldPercent,
    headingFlareDepth,
    insideYawDeg,
    insidePitchDeg,
    viewZoom,
    viewPan.x,
    viewPan.y,
    activeLocation,
    pullM,
  ]);

  const svgCursorStyle = useMemo(
    () =>
      insideNavMode === 'rotate'
        ? 'grab'
        : getFieldToolCursorDataUri(activeTool, lithologySubMode),
    [insideNavMode, activeTool, lithologySubMode]
  );

  const allPanels: FieldPanelId[] = ['left_wall', 'crown', 'right_wall', 'face'];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
      {/* Compact 3D Control Bar: 3D Tunnel Orbit | Inside Tunnel View (360° Look) | 3D↔2D Fold */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSubMode('open_heading');
              setInsideNavMode('rotate');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all duration-150 select-none ${
              subMode === 'open_heading'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md ring-1 ring-amber-300 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
            }`}
            title="3D Tunnel Orbit — full 3D rigid rotation around the tunnel tube from outside (never shrinks or expands)"
          >
            <Box className="w-3.5 h-3.5 text-amber-400" />
            <span>🌐 3D Tunnel Orbit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubMode('origami_fold');
              setInsideNavMode('draw');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all duration-150 select-none ${
              subMode === 'origami_fold'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md ring-1 ring-violet-300 font-black'
                : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80'
            }`}
            title="Smoothly fold/unfold tunnel between 2D flat and 3D heading"
          >
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            <span>3D ↔ 2D Fold</span>
          </button>

          {/* Quick Angle Buttons for 3D Orbit Mode */}
          {subMode === 'open_heading' && (
            <div className="flex items-center gap-1 bg-amber-950/70 border border-amber-500/40 rounded px-1.5 py-0.5">
              <span className="text-[9px] font-mono font-bold text-amber-300">Orbit:</span>
              <button
                type="button"
                onClick={() => { setInsideYawDeg(0); setInsidePitchDeg(0); }}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${insideYawDeg === 0 && insidePitchDeg === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-200 hover:text-white'}`}
                title="Look straight down tunnel heading (Yaw 0°, Pitch 0°)"
              >
                Front 0°
              </button>
              <button
                type="button"
                onClick={() => { setInsideYawDeg(45); setInsidePitchDeg(22); }}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${insideYawDeg === 45 && insidePitchDeg === 22 ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-200 hover:text-white'}`}
                title="Isometric 3D Tunnel Orbit (Yaw 45°, Pitch 22°)"
              >
                Isometric 45°
              </button>
              <button
                type="button"
                onClick={() => { setInsideYawDeg(90); setInsidePitchDeg(0); }}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${insideYawDeg === 90 && insidePitchDeg === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-200 hover:text-white'}`}
                title="Side View of 3D Tunnel Tube (Yaw 90°, Pitch 0°)"
              >
                Side 90°
              </button>
              <button
                type="button"
                onClick={() => { setInsideYawDeg(0); setInsidePitchDeg(55); }}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-all ${insidePitchDeg > 35 ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-200 hover:text-white'}`}
                title="Top-Down Arch View (Pitch +55°)"
              >
                Top 55°
              </button>
            </div>
          )}

          {/* Top Toolbar View Toggle: Click to Rotate Any Side Using Finger */}
          <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/50 rounded-md px-1.5 py-0.5">
            <button
              type="button"
              onClick={() => setInsideNavMode((m) => (m === 'draw' ? 'rotate' : 'draw'))}
              className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all flex items-center gap-1 ${
                insideNavMode === 'rotate'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-200'
                  : 'bg-slate-800 text-cyan-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="View Toggle — click to rotate the 3D tunnel to any side/angle using your finger, then click again to resume tracing!"
            >
              {insideNavMode === 'rotate' ? '🖐 View Rotate: ON' : '🖐 View Rotate'}
            </button>
            {insideNavMode === 'rotate' && (
              <button
                type="button"
                onClick={() => setInsideNavMode('draw')}
                className="px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[9.5px] font-black cursor-pointer"
                title="Switch back to Trace / Draw mode"
              >
                ✏️ Trace
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setInsideYawDeg(0);
                setInsidePitchDeg(0);
                setViewZoom(1.0);
                setViewPan({ x: 0, y: 0 });
              }}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] font-bold text-slate-200 cursor-pointer"
              title="Reset 3D rotation & zoom to center"
            >
              Reset
            </button>
          </div>

          {/* Joint Trace "OK" Finish Button in Top Bar */}
          {isJointTraceTool && pendingTraceSession && (
            <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-400 rounded-md px-1.5 py-0.5 shadow">
              <span className="text-[9.5px] font-mono font-bold text-emerald-200">
                Finish Joint?
              </span>
              <button
                type="button"
                onClick={confirmAndFinishPendingJoint}
                className="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] cursor-pointer shadow"
                title="Click OK to finish this joint trace and start the next joint (Shortcut: Enter)"
              >
                ✓ OK
              </button>
              <button
                type="button"
                onClick={cancelPendingJoint}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-bold text-[9.5px] cursor-pointer"
                title="Cancel and remove this unfinished joint trace (Shortcut: Esc)"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Right Controls: Station / Zoom / Fold Slider + Smart Continue + 1m Graph Grid & Tunnel Outline */}
        <div className="flex flex-wrap items-center gap-1.5">


          {subMode === 'origami_fold' && (
            <div className="flex items-center gap-1 text-[9.5px] font-mono">
              <span className="text-slate-400">2D</span>
              <input
                type="range"
                min={0}
                max={100}
                step={2}
                value={foldPercent}
                onChange={(e) => setFoldPercent(Number(e.target.value))}
                className="w-16 accent-violet-400 cursor-pointer"
              />
              <span className="text-violet-300 font-bold">{foldPercent}%</span>
            </div>
          )}


          <button
            type="button"
            onClick={() => setShow1mGrid((g) => !g)}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold border flex items-center gap-1 cursor-pointer ${
              show1mGrid
                ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Toggle 1m × 1m Graph Grid on top of Lithology & Tunnel Surfaces"
          >
            <Grid className="w-3 h-3" />
            1m Graph
          </button>

          <button
            type="button"
            onClick={() => setShowTunnelOutline((o) => !o)}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold border flex items-center gap-1 cursor-pointer ${
              showTunnelOutline
                ? 'bg-slate-800 text-sky-300 border-sky-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Toggle Tunnel Outline & SPL Seam Reference Lines on top of Lithology"
          >
            <Layers className="w-3 h-3" />
            Outline
          </button>

          {/* B&W vs Colour Mode Toggle in 3D View */}
          <div className="inline-flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700 gap-0.5">
            <button
              type="button"
              onClick={() => onUpdateRound((r) => ({ ...r, reportColorMode: 'bw' }))}
              className={`px-2 py-0.5 rounded text-[9.5px] font-black transition-all cursor-pointer ${
                (activeRound.reportColorMode ?? 'color') === 'bw'
                  ? 'bg-slate-100 text-slate-950 shadow-md ring-1 ring-slate-300 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Switch to Black & White Mode (Independent monochrome canvas — changes will not affect Colour mode)"
            >
              B&amp;W
            </button>
            <button
              type="button"
              onClick={() => onUpdateRound((r) => ({ ...r, reportColorMode: 'color' }))}
              className={`px-2 py-0.5 rounded text-[9.5px] font-black transition-all cursor-pointer ${
                (activeRound.reportColorMode ?? 'color') === 'color'
                  ? 'bg-gradient-to-r from-amber-500 to-cyan-400 text-slate-950 shadow-md ring-1 ring-amber-300 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Switch to Geological Colour Mode (Independent colour canvas — changes will not affect B&W mode)"
            >
              Colour
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Interactive Tunnel Canvas */}
      <div className="flex-1 min-h-0 bg-slate-950 rounded-lg border-2 border-slate-700 overflow-hidden relative flex items-center justify-center touch-none">
        {/* Floating Top-Center "Ask OK to Finish Joint" Banner (Outside SVG pointer capture for instant click/tap!) */}
        {isJointTraceTool && pendingTraceSession && !isDrawing3D && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/95 border-2 border-emerald-400 rounded-xl px-3 py-1.5 shadow-2xl"
          >
            <span className="text-[11px] font-mono font-bold text-white">
              Joint Trace ({activeGroupingSet === 'unassigned' ? 'J' : activeGroupingSet} •{' '}
              {String(liveDipDirection).padStart(3, '0')}°/{liveDipAmount}°) — Continue across walls or finish:
            </span>
            <button
              type="button"
              onClick={confirmAndFinishPendingJoint}
              className="px-3.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md flex items-center gap-1"
            >
              ✓ OK (Finish Joint)
            </button>
            <button
              type="button"
              onClick={cancelPendingJoint}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-bold text-[11px] cursor-pointer"
              title="Cancel this joint trace"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Compact Bottom-Left 3D Spherical Rotator (Trackball Gizmo — unrestricted 360° rotation in any direction while tracing!) */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 left-2.5 z-20 flex flex-col items-center gap-1 select-none"
        >
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              bottomWheelDragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                startYaw: insideYawDeg,
                startPitch: insidePitchDeg,
              };
            }}
            onPointerMove={(e) => {
              if (!bottomWheelDragRef.current?.active) return;
              e.stopPropagation();
              const dx = e.clientX - bottomWheelDragRef.current.startX;
              const dy = e.clientY - bottomWheelDragRef.current.startY;
              // Full 360° unrestricted spherical rotation in any direction
              const rawYaw = Math.round(bottomWheelDragRef.current.startYaw + dx * 1.15);
              const rawPitch = Math.round(bottomWheelDragRef.current.startPitch + dy * 1.15);
              const wrappedYaw = ((((rawYaw + 180) % 360) + 360) % 360) - 180;
              const wrappedPitch = ((((rawPitch + 180) % 360) + 360) % 360) - 180;
              scheduleRotationUpdate(wrappedYaw, wrappedPitch);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              bottomWheelDragRef.current = null;
              if (rotationRafIdRef.current) {
                cancelAnimationFrame(rotationRafIdRef.current);
                rotationRafIdRef.current = null;
              }
              if (pendingRotationRef.current) {
                setInsideYawDeg(pendingRotationRef.current.yaw);
                setInsidePitchDeg(pendingRotationRef.current.pitch);
                pendingRotationRef.current = null;
              }
            }}
            onPointerCancel={() => {
              bottomWheelDragRef.current = null;
              if (rotationRafIdRef.current) {
                cancelAnimationFrame(rotationRafIdRef.current);
                rotationRafIdRef.current = null;
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setInsideYawDeg(0);
              setInsidePitchDeg(0);
              setViewPan({ x: 0, y: 0 });
            }}
            className="w-14 h-14 rounded-full bg-slate-950/90 border-2 border-cyan-400/80 shadow-xl cursor-grab active:cursor-grabbing flex items-center justify-center relative overflow-hidden touch-none"
            title="3D Spherical Rotator — drag in any direction to rotate 360° without limits (double-click to reset)"
          >
            {(() => {
              const yawRad = (insideYawDeg * Math.PI) / 180;
              const pitchRad = (insidePitchDeg * Math.PI) / 180;
              const dotX = 28 + Math.sin(yawRad) * Math.cos(pitchRad * 0.5) * 18;
              const dotY = 28 + Math.sin(pitchRad) * 18;
              const rxMeridian = Math.max(2, Math.abs(Math.cos(yawRad)) * 22);
              const ryEquator = Math.max(2, Math.abs(Math.cos(pitchRad)) * 22);
              return (
                <svg viewBox="0 0 56 56" className="w-full h-full pointer-events-none">
                  <defs>
                    <radialGradient id="sphere-grad-3d" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#1e293b" />
                      <stop offset="65%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#020617" />
                    </radialGradient>
                  </defs>
                  {/* Sphere Body */}
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="url(#sphere-grad-3d)"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                  />
                  {/* Dynamic 3D Equator & Meridian Rings */}
                  <ellipse
                    cx="28"
                    cy="28"
                    rx="22"
                    ry={ryEquator.toFixed(1)}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1.1"
                    strokeDasharray="3 2"
                    opacity="0.75"
                  />
                  <ellipse
                    cx="28"
                    cy="28"
                    rx={rxMeridian.toFixed(1)}
                    ry="22"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.1"
                    strokeDasharray="3 2"
                    opacity="0.75"
                  />
                  {/* Crosshair Center */}
                  <line x1="28" y1="6" x2="28" y2="50" stroke="#475569" strokeWidth="0.7" opacity="0.5" />
                  <line x1="6" y1="28" x2="50" y2="28" stroke="#475569" strokeWidth="0.7" opacity="0.5" />
                  {/* Active 3D Orientation Vector Handle */}
                  <line
                    x1="28"
                    y1="28"
                    x2={dotX.toFixed(1)}
                    y2={dotY.toFixed(1)}
                    stroke="#34d399"
                    strokeWidth="1.6"
                  />
                  <circle
                    cx={dotX.toFixed(1)}
                    cy={dotY.toFixed(1)}
                    r="4.2"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.3"
                  />
                </svg>
              );
            })()}
          </div>

          {/* Compact Angle Readout & 1-Tap Center Reset under the Sphere */}
          <button
            type="button"
            onClick={() => {
              setInsideYawDeg(0);
              setInsidePitchDeg(0);
              setViewPan({ x: 0, y: 0 });
            }}
            className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[8.5px] font-mono font-bold text-cyan-300 cursor-pointer shadow whitespace-nowrap"
            title="Tap to reset 3D rotation to 0°/0°"
          >
            {subMode === 'origami_fold' ? '📐 3D↔2D' : '🌐 Orbit'} {insideYawDeg}°/{insidePitchDeg}°
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={surfaceMeshes.autoViewBox}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            setViewZoom((z) => Math.max(0.65, Math.min(3.2, Number((z * factor).toFixed(2)))));
          }}
          onPointerLeave={() => {
            if (!isDrawing3D) updateHoverCursorDom(null);
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            cursor: svgCursorStyle,
          }}
          className="w-full h-full touch-none select-none"
        >
          {/* SVG Defs: 2D Monochrome Geological Patterns + Strict 3D Surface ClipPaths + Lithology Erase Masks */}
          <defs>
            <FieldMonochromeGeologicalPatterns
              prefix="fpat"
              colorMode={activeRound.reportColorMode ?? 'color'}
              symbolDensity={activeRound.lithologySymbolDensity ?? lithologySymbolDensity}
              symbolDensityByPattern={activeRound.lithologyDensityByRock}
              symbolAngleByPattern={activeRound.lithologyAngleByRock}
              lithologyPatternAngle={activeRound.lithologyPatternAngle}
              alternatingStrokes={activeRound.lithologyStrokes.filter(
                (s) =>
                  (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                  (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
              )}
              bandSymbolDensity={activeRound.veinBandSymbolDensity ?? veinBandSymbolDensity}
            />
            {surfaceMeshes.panelStrips.map((strip) => (
              <clipPath key={`clip-3d-${strip.panelId}`} id={`clip-3d-${strip.panelId}`}>
                <polygon points={strip.polyPts} />
              </clipPath>
            ))}
            <clipPath id="clip-3d-face">
              <polygon points={surfaceMeshes.facePts} />
            </clipPath>

            {/* Per-Panel Lithology Erase Masks so `lithology_erase` carves clean holes without blocking background */}
            {allPanels.map((pid) => {
              const eraseStrokes = activeRound.lithologyStrokes.filter(
                (s) => s.panel === pid && s.mode === 'lithology_erase' && s.points.length >= 2
              );
              return (
                <mask key={`mask-3d-lith-${pid}`} id={`mask-3d-lith-${pid}`}>
                  <rect x="-1000" y="-1000" width="3000" height="3000" fill="#ffffff" />
                  {eraseStrokes.map((er) => {
                    const mapped3D = er.points.map((p) => panelPointTo3DSvg(er.panel, p));
                    const dPath = buildSmoothSvgPath(mapped3D);
                    const sw = Math.max(20, Math.round((er.brushRadius || 28) * 1.7));
                    return (
                      <path
                        key={`m-er-${er.id}`}
                        d={dPath}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </mask>
              );
            })}
          </defs>

          {/* =====================================================================
              LAYER 1: Base 3D Tunnel Surface Fills (Invert Floor, Left Wall, Crown, Right Wall, Face)
             ===================================================================== */}
          {surfaceMeshes.invertFloorPts && (
            <polygon
              points={surfaceMeshes.invertFloorPts}
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="1.2"
              className="pointer-events-none"
            />
          )}
          {surfaceMeshes.panelStrips.map((strip) => (
            <polygon
              key={`base-fill-${strip.panelId}`}
              points={strip.polyPts}
              fill="#ffffff"
              stroke="none"
            />
          ))}
          <polygon
            points={surfaceMeshes.facePts}
            fill="#ffffff"
            stroke="none"
          />

          {/* =====================================================================
              LAYER 1B: Photo underlay disabled — 3D canvas renders pure CAD geometry
             ===================================================================== */}

          {/* =====================================================================
              LAYER 2: Lithology Block Fills (Specified Geological Symbols Only — No Color Change!)
             ===================================================================== */}
          {allPanels.map((pid) => {
            const panelLithFills = activeRound.lithologyStrokes.filter(
              (s) =>
                s.panel === pid &&
                s.mode !== 'lithology_erase' &&
                s.mode !== 'vein_band' &&
                s.mode !== 'foliation_plane' &&
                s.points.length >= 2
            );
            if (panelLithFills.length === 0) return null;
            return (
              <g
                key={`3d-lith-layer-${pid}`}
                clipPath={`url(#clip-3d-${pid})`}
                mask={`url(#mask-3d-lith-${pid})`}
                pointerEvents="none"
              >
                {panelLithFills.map((st) => {
                  const mapped3D = st.points.map((p) => panelPointTo3DSvg(st.panel, p));
                  const dPath = buildSmoothSvgPath(mapped3D);
                  const rockMeta = resolveRockDisplayInfo(st.rockType, rememberedRocksList);
                  const patId = st.patternId || rockMeta.patternId;
                  const midPt = mapped3D[Math.floor(mapped3D.length / 2)];
                  const sw = Math.max(20, Math.round((st.brushRadius || 28) * 1.7));
                  const isColorMode = (activeRound.reportColorMode ?? 'color') === 'color';
                  const bgStrokeCol = isColorMode ? rockMeta.colorTint || '#fef9c3' : '#ffffff';

                  const isStrokeClosed = Boolean(
                    st.isClosed ||
                    (st.polygon && st.polygon.length >= 3) ||
                    (mapped3D.length >= 3 &&
                      Math.hypot(
                        mapped3D[0].x - mapped3D[mapped3D.length - 1].x,
                        mapped3D[0].y - mapped3D[mapped3D.length - 1].y
                      ) < 48)
                  );
                  const closedD = isStrokeClosed
                    ? dPath.endsWith('Z') || dPath.endsWith('z')
                      ? dPath
                      : `${dPath} Z`
                    : dPath;

                  return (
                    <g key={`3d-lith-${st.id}`}>
                      {isStrokeClosed && (
                        <>
                          <path
                            d={closedD}
                            fill={bgStrokeCol}
                            fillOpacity={0.88}
                            stroke="none"
                          />
                          <path
                            d={closedD}
                            fill={`url(#fpat-${patId})`}
                            fillOpacity={0.92}
                            stroke="none"
                          />
                        </>
                      )}
                      <path
                        d={dPath}
                        fill="none"
                        stroke={bgStrokeCol}
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={dPath}
                        fill="none"
                        stroke={`url(#fpat-${patId})`}
                        strokeWidth={sw}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.95}
                      />
                      {midPt && (
                        <text
                          x={midPt.x}
                          y={midPt.y + 3}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="900"
                          fontFamily="IBM Plex Mono, monospace"
                          fill="#0f172a"
                          stroke="#ffffff"
                          strokeWidth="2.4"
                          paintOrder="stroke"
                        >
                          {rockMeta.code}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* =====================================================================
              LAYER 3: 1m × 1m Engineering Graph Grid & Tunnel Outline ON TOP OF LITHOLOGY
              (First Outer Grid Line = 0m -> Going Inward Through Pull = 1m, 2m...)
             ===================================================================== */}
          {surfaceMeshes.panelStrips.map((strip) => {
            return (
              <g key={`grid-outline-${strip.panelId}`} className="pointer-events-none">
                {/* 1m × 1m Graph Grid on Walls & Crown (Always visible over Lithology!) */}
                {show1mGrid && (
                  <g clipPath={`url(#clip-3d-${strip.panelId})`}>
                    {strip.longitudinalGridLines.map((ln, idx) => (
                      <line
                        key={`lgrid-${strip.panelId}-${idx}`}
                        x1={ln.p0.x}
                        y1={ln.p0.y}
                        x2={ln.p1.x}
                        y2={ln.p1.y}
                        stroke="#334155"
                        strokeWidth="1.05"
                        strokeDasharray="3 3"
                        opacity="0.72"
                      />
                    ))}

                    {surfaceMeshes.meterPullFracs.map(({ m, tPull }) => {
                      const ribPts = strip.pNodes
                        .map((n) => {
                          const pt = projectTunnel3DPoint(n.nx, n.ny, tPull, strip.panelId);
                          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                        })
                        .join(' ');
                      return (
                        <polyline
                          key={`mrib-${strip.panelId}-${m}`}
                          points={ribPts}
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="1.25"
                          strokeDasharray="4 3"
                          opacity="0.78"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Crisp Wall & Crown Tunnel Outline on top of Lithology */}
                {showTunnelOutline && (
                  <>
                    <polygon
                      points={strip.polyPts}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.2"
                    />
                    {/* First Outer Grid Line (0m Pull Start — tPull = 1.0) */}
                    <polyline
                      points={strip.pNodes
                        .map((n) => {
                          const pt = projectTunnel3DPoint(n.nx, n.ny, 1.0, strip.panelId);
                          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="3.2"
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* 1m Graph Grid & Center Alignment Line on 3D Invert Floor */}
          {show1mGrid && surfaceMeshes.invertFloorPts && (
            <g className="pointer-events-none">
              <line
                x1={surfaceMeshes.invCenterPortal.x}
                y1={surfaceMeshes.invCenterPortal.y}
                x2={surfaceMeshes.invCenterFace.x}
                y2={surfaceMeshes.invCenterFace.y}
                stroke="#0284c7"
                strokeWidth="1.6"
                strokeDasharray="6 3"
                opacity="0.8"
              />
              {surfaceMeshes.invertRibs.map((rib) => (
                <line
                  key={`inv-rib-${rib.m}`}
                  x1={rib.p0.x}
                  y1={rib.p0.y}
                  x2={rib.p1.x}
                  y2={rib.p1.y}
                  stroke="#64748b"
                  strokeWidth="1.1"
                  strokeDasharray="4 3"
                  opacity="0.7"
                />
              ))}
            </g>
          )}

          {/* 1m × 1m Graph Grid on the 3D Face (On top of Lithology!) */}
          {show1mGrid &&
            (() => {
              const wM = Math.max(1, Math.floor(activeLocation.widthM / 2));
              const hM = Math.max(1, Math.floor(activeLocation.heightM));
              const lines: React.ReactNode[] = [];
              for (let xm = -wM; xm <= wM; xm++) {
                const nx = xm / Math.max(1, activeLocation.widthM);
                const pTop = projectTunnel3DPoint(nx, 0.02, 0, 'face');
                const pBot = projectTunnel3DPoint(nx, 0.99, 0, 'face');
                lines.push(
                  <line
                    key={`fgrid-x-${xm}`}
                    x1={pTop.x}
                    y1={pTop.y}
                    x2={pBot.x}
                    y2={pBot.y}
                    stroke={xm === 0 ? '#0284c7' : '#475569'}
                    strokeWidth={xm === 0 ? '1.4' : '0.95'}
                    strokeDasharray={xm === 0 ? '5 3' : '3 3'}
                    opacity="0.72"
                  />
                );
              }
              for (let ym = 1; ym < hM; ym++) {
                const ny = 1 - ym / Math.max(1, activeLocation.heightM);
                const pL = projectTunnel3DPoint(-0.49, ny, 0, 'face');
                const pR = projectTunnel3DPoint(0.49, ny, 0, 'face');
                lines.push(
                  <line
                    key={`fgrid-y-${ym}`}
                    x1={pL.x}
                    y1={pL.y}
                    x2={pR.x}
                    y2={pR.y}
                    stroke="#475569"
                    strokeWidth="0.95"
                    strokeDasharray="3 3"
                    opacity="0.72"
                  />
                );
              }
              return (
                <g className="pointer-events-none" clipPath="url(#clip-3d-face)">
                  {lines}
                </g>
              );
            })()}

          {/* Inner Excavation Face Tunnel Outline on top of Lithology */}
          {showTunnelOutline && (
            <polygon
              points={surfaceMeshes.facePts}
              fill="none"
              stroke="#0f172a"
              strokeWidth="3.2"
              className="pointer-events-none"
            />
          )}

          {/* Shared SPL Seam 3D Lines (L-SPL & R-SPL) + Outer 0m -> Inward Pull Grid Labels (No Core Clutter!) */}
          {showTunnelOutline && (
            <g className="pointer-events-none select-none" fontFamily="IBM Plex Mono, monospace">
              {surfaceMeshes.leftSplFace && surfaceMeshes.leftSplPortal && (
                <>
                  <line
                    x1={surfaceMeshes.leftSplFace.x}
                    y1={surfaceMeshes.leftSplFace.y}
                    x2={surfaceMeshes.leftSplPortal.x}
                    y2={surfaceMeshes.leftSplPortal.y}
                    stroke="#0284c7"
                    strokeWidth="2.6"
                    strokeDasharray="7 4"
                  />
                  <text
                    x={surfaceMeshes.leftSplPortal.x - 5}
                    y={surfaceMeshes.leftSplPortal.y - 4}
                    textAnchor="end"
                    fontSize="8.5"
                    fontWeight="900"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    paintOrder="stroke"
                  >
                    L-SPL (0m)
                  </text>
                </>
              )}
              {surfaceMeshes.rightSplFace && surfaceMeshes.rightSplPortal && (
                <>
                  <line
                    x1={surfaceMeshes.rightSplFace.x}
                    y1={surfaceMeshes.rightSplFace.y}
                    x2={surfaceMeshes.rightSplPortal.x}
                    y2={surfaceMeshes.rightSplPortal.y}
                    stroke="#0284c7"
                    strokeWidth="2.6"
                    strokeDasharray="7 4"
                  />
                  <text
                    x={surfaceMeshes.rightSplPortal.x + 5}
                    y={surfaceMeshes.rightSplPortal.y - 4}
                    textAnchor="start"
                    fontSize="8.5"
                    fontWeight="900"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                    paintOrder="stroke"
                  >
                    R-SPL (0m)
                  </text>
                </>
              )}

              {/* First Outer Grid = 0m -> Going Inward Through Pull (1m, 2m...) on Left Wall, Crown & Right Wall */}
              {(() => {
                const lwNodes = perimeterData.nodes.filter((n) => n.panel === 'left_wall');
                const rwNodes = perimeterData.nodes.filter((n) => n.panel === 'right_wall');
                const lwStart = lwNodes[0] || { nx: -0.48, ny: 0.98 };
                const rwStart = rwNodes[rwNodes.length - 1] || { nx: 0.48, ny: 0.98 };
                const crOuter = projectTunnel3DPoint(0, 0.02, 1.0, 'crown');
                const lwOuter0 = projectTunnel3DPoint(lwStart.nx, lwStart.ny, 1.0, 'left_wall');
                const rwOuter0 = projectTunnel3DPoint(rwStart.nx, rwStart.ny, 1.0, 'right_wall');

                return (
                  <>
                    {perimeterData.hasCrown && (
                      <text
                        x={crOuter.x}
                        y={crOuter.y - 7}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="900"
                        fill="#0f172a"
                        stroke="#ffffff"
                        strokeWidth="2.4"
                        paintOrder="stroke"
                      >
                        CROWN • 0m (Outer Start)
                      </text>
                    )}

                    {perimeterData.hasLeftWall && (
                      <>
                        <text
                          x={lwOuter0.x - 4}
                          y={lwOuter0.y + 11}
                          textAnchor="end"
                          fontSize="8.5"
                          fontWeight="900"
                          fill="#0f766e"
                          stroke="#ffffff"
                          strokeWidth="2.4"
                          paintOrder="stroke"
                        >
                          0m (L.Wall Start)
                        </text>
                        {show1mGrid &&
                          surfaceMeshes.meterPullFracs.map(({ m, tPull }) => {
                            const pt = projectTunnel3DPoint(
                              lwStart.nx,
                              lwStart.ny,
                              tPull,
                              'left_wall'
                            );
                            return (
                              <text
                                key={`lw-pull-lbl-${m}`}
                                x={pt.x}
                                y={pt.y + 11}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="900"
                                fill="#0f766e"
                                stroke="#ffffff"
                                strokeWidth="2.2"
                                paintOrder="stroke"
                              >
                                {m}m
                              </text>
                            );
                          })}
                      </>
                    )}

                    {perimeterData.hasRightWall && (
                      <>
                        <text
                          x={rwOuter0.x + 4}
                          y={rwOuter0.y + 11}
                          textAnchor="start"
                          fontSize="8.5"
                          fontWeight="900"
                          fill="#4338ca"
                          stroke="#ffffff"
                          strokeWidth="2.4"
                          paintOrder="stroke"
                        >
                          0m (R.Wall Start)
                        </text>
                        {show1mGrid &&
                          surfaceMeshes.meterPullFracs.map(({ m, tPull }) => {
                            const pt = projectTunnel3DPoint(
                              rwStart.nx,
                              rwStart.ny,
                              tPull,
                              'right_wall'
                            );
                            return (
                              <text
                                key={`rw-pull-lbl-${m}`}
                                x={pt.x}
                                y={pt.y + 11}
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="900"
                                fill="#4338ca"
                                stroke="#ffffff"
                                strokeWidth="2.2"
                                paintOrder="stroke"
                              >
                                {m}m
                              </text>
                            );
                          })}
                      </>
                    )}
                  </>
                );
              })()}
            </g>
          )}

          {/* =====================================================================
              LAYER 4: Geological Mapping Elements ON TOP of Lithology, Grid & Outline
             ===================================================================== */}
          {/* 4A. Vein Bands & Foliation Planes */}
          {activeRound.lithologyStrokes.map((st) => {
            if (
              st.points.length < 2 ||
              (st.mode !== 'vein_band' && st.mode !== 'foliation_plane')
            ) {
              return null;
            }
            const mapped3D = st.points.map((p) => panelPointTo3DSvg(st.panel, p));
            return (
              <g
                key={`3d-vein-${st.id}`}
                clipPath={`url(#clip-3d-${st.panel})`}
                pointerEvents="none"
              >
                <FieldVeinFoliationBandSvgElement
                  stroke={{ ...st, points: mapped3D }}
                  round={activeRound}
                  rememberedRocks={rememberedRocksList}
                  colorMode={activeRound.reportColorMode ?? 'color'}
                />
              </g>
            );
          })}

          {/* 4B. Structural Features (Faults, Shear Zones, Dykes, Folds, Contacts, Overbreak) */}
          {(activeRound.structuralFeatures || []).map((ft) => {
            if (ft.points.length < 2) return null;
            const mapped3D = ft.points.map((p) => panelPointTo3DSvg(ft.panel, p));
            return (
              <g
                key={`3d-feat-${ft.id}`}
                clipPath={`url(#clip-3d-${ft.panel})`}
                pointerEvents="none"
              >
                <FieldStructuralFeatureSvgRenderer
                  feature={{ ...ft, points: mapped3D }}
                  scale={1.0}
                  colorMode={activeRound.reportColorMode ?? 'color'}
                  tunnelDriveDirection={activeRound.tunnelDriveDirection}
                />
              </g>
            );
          })}

          {/* 4C. Water Condition Marks (Dry, Damp, Wet, Dripping, Flowing, High Pressure) */}
          {(activeRound.waterMarks || []).map((wm) => {
            if (wm.points.length === 0) return null;
            const mapped3D = wm.points.map((p) => panelPointTo3DSvg(wm.panel, p));
            return (
              <g
                key={`3d-wtr-${wm.id}`}
                clipPath={`url(#clip-3d-${wm.panel})`}
                pointerEvents="none"
              >
                <FieldWaterSymbolSvgRenderer
                  water={{ ...wm, points: mapped3D }}
                  scale={1.0}
                  colorMode={activeRound.reportColorMode ?? 'color'}
                />
              </g>
            );
          })}

          {/* 4D. Tool 4: Dip Plane Surfaces in 3D (Real Pencil Outline Connected to Panel/Face Outline or Joint Trace, No Brush Inflation) */}
          {(activeRound.dipPlaneSurfaces || []).map((ds) => {
            if (ds.points.length === 0) return null;
            const { outlinePolygon: poly2D, centroid: centroid2D } =
              buildDipSurfacePolygonWithOutlineSnap(
                ds.points,
                ds.panel,
                activeLocation,
                activeRound
              );
            const mappedPoly3D = poly2D.map((p) => panelPointTo3DSvg(ds.panel, p));
            const mappedPencil3D = ds.points.map((p) => panelPointTo3DSvg(ds.panel, p));
            const centroid = panelPointTo3DSvg(ds.panel, centroid2D);
            const polyPts = mappedPoly3D
              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(' ');
            const pencilPtsStr = mappedPencil3D
              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(' ');
            const grp =
              FIELD_JOINT_GROUP_COLORS[ds.setId || 'unassigned'] ||
              FIELD_JOINT_GROUP_COLORS.unassigned;
            const tagPrefix = ds.setId && ds.setId !== 'unassigned' ? `${ds.setId} ` : '';

            return (
              <g
                key={`3d-dip-${ds.id}`}
                clipPath={`url(#clip-3d-${ds.panel})`}
                pointerEvents="none"
              >
                <polygon
                  points={polyPts}
                  fill={
                    ds.setId && ds.setId !== 'unassigned'
                      ? `${grp.fill}28`
                      : 'rgba(15, 23, 42, 0.14)'
                  }
                  stroke={grp.stroke}
                  strokeWidth="1.6"
                  strokeDasharray="4,3"
                />
                <polyline
                  points={pencilPtsStr}
                  fill="none"
                  stroke={grp.stroke}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x={centroid.x}
                  y={centroid.y - 2}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="900"
                  fill={grp.stroke}
                  stroke="#ffffff"
                  strokeWidth="2.4"
                  paintOrder="stroke"
                >
                  {tagPrefix}Dip Surface
                </text>
                <text
                  x={centroid.x}
                  y={centroid.y + 9}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="900"
                  fill={grp.stroke}
                  stroke="#ffffff"
                  strokeWidth="2.4"
                  paintOrder="stroke"
                >
                  {String(ds.dipDirection).padStart(3, '0')}°/{ds.dipAmount}°
                </text>
              </g>
            );
          })}

          {/* 4E. Joint Traces in 3D (respecting Smooth/Linear mode and Pencil Size) */}
          {activeRound.jointTraces.map((tr) => {
            if (tr.points.length < 2) return null;
            const mapped3D = tr.points.map((p) => panelPointTo3DSvg(tr.panel, p));
            const pathD =
              tr.lineMode === 'linear'
                ? mapped3D
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ')
                : buildSmoothSvgPath(mapped3D);
            const mid = mapped3D[Math.floor(mapped3D.length / 2)];
            const grpColor =
              FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned'] ||
              FIELD_JOINT_GROUP_COLORS.unassigned;
            const isSel = selectedTraceId === tr.id;
            const tag = !tr.setId || tr.setId === 'unassigned' ? 'J' : tr.setId;
            const baseW = Math.max(1.2, Math.min(16, tr.strokeWidthPx ?? 3.6));

            return (
              <g
                key={`3d-tr-${tr.id}`}
                clipPath={`url(#clip-3d-${tr.panel})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'eraser') return;
                  onSelectTraceId(tr.id, tr.panel);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectTraceId(tr.id, tr.panel);
                  onOpen3DJointInspector?.(tr.id);
                }}
                className="cursor-pointer"
              >
                {/* 3D Selection Glow Halo */}
                {isSel && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={baseW + 5.5}
                    opacity="0.55"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <path
                  d={pathD}
                  fill="none"
                  stroke={grpColor.stroke}
                  strokeWidth={isSel ? baseW + 1.8 : baseW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {mid && (
                  <text
                    x={mid.x}
                    y={mid.y - 6}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="900"
                    fill={isSel ? '#38bdf8' : grpColor.stroke}
                    stroke="#ffffff"
                    strokeWidth="2.8"
                    paintOrder="stroke"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTraceId(tr.id, tr.panel);
                      onOpen3DJointInspector?.(tr.id);
                    }}
                    className="cursor-pointer select-none"
                  >
                    <title>Click or double-click to inspect 3D joint and cutting plane</title>
                    {tag} {String(tr.dipDirection).padStart(3, '0')}°/{tr.dipAmount}°
                  </text>
                )}
              </g>
            );
          })}

          {/* 3D Planar Cutting Disc for currently inspected/selected joint */}
          {inspectedJoint3DDisc && (
            <g pointerEvents="none" className="select-none">
              <polygon
                points={inspectedJoint3DDisc.discSvgPts
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(' ')}
                fill="rgba(56, 189, 248, 0.22)"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <line
                x1={inspectedJoint3DDisc.strikeEnd1.x}
                y1={inspectedJoint3DDisc.strikeEnd1.y}
                x2={inspectedJoint3DDisc.strikeEnd2.x}
                y2={inspectedJoint3DDisc.strikeEnd2.y}
                stroke="#facc15"
                strokeWidth="2.4"
                strokeDasharray="6 3"
              />
              <line
                x1={inspectedJoint3DDisc.centerSvg.x}
                y1={inspectedJoint3DDisc.centerSvg.y}
                x2={inspectedJoint3DDisc.dipArrowEnd.x}
                y2={inspectedJoint3DDisc.dipArrowEnd.y}
                stroke="#f43f5e"
                strokeWidth="2.6"
              />
              <circle
                cx={inspectedJoint3DDisc.centerSvg.x}
                cy={inspectedJoint3DDisc.centerSvg.y}
                r={4.5}
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <text
                x={inspectedJoint3DDisc.centerSvg.x}
                y={inspectedJoint3DDisc.centerSvg.y - 9}
                textAnchor="middle"
                fontSize="9"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="2.4"
                paintOrder="stroke"
              >
                3D Cutting Disc • {String(inspectedJoint3DDisc.joint.dipDirection).padStart(3, '0')}°/{inspectedJoint3DDisc.joint.dipAmount}°
              </text>
            </g>
          )}

          {/* 4F. Smart 3D Auto-Continuation Ghost Traces across adjacent tunnel surfaces */}
          {smartContinuationPreview &&
            smartContinuationPreview.otherPanels.map((panelId) => {
              const list = smartContinuationPreview.projected[panelId];
              if (list.length < 2) return null;
              const smoothD = buildSmoothSvgPath(list.map((item) => item.svgPt));
              const mid = list[Math.floor(list.length / 2)].svgPt;
              return (
                <g
                  key={`smart-cont-${panelId}`}
                  clipPath={`url(#clip-3d-${panelId})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptSmart3DContinuation();
                  }}
                  className="cursor-pointer"
                >
                  <path
                    d={smoothD}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="5.5"
                    opacity="0.25"
                    strokeLinecap="round"
                  />
                  <path
                    d={smoothD}
                    fill="none"
                    stroke="#0891b2"
                    strokeWidth="2.6"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />

                </g>
              );
            })}

          {/* 4G. Active Resumable Joint Trace Stop-Point Indicator & On-Canvas "✓ OK" Button */}
          {isJointTraceTool &&
            pendingTraceSession &&
            !isDrawing3D &&
            (() => {
              const stopSvgPt = panelPointTo3DSvg(
                pendingTraceSession.lastPanel,
                pendingTraceSession.lastPanelPt
              );
              return (
                <g
                  transform={`translate(${stopSvgPt.x.toFixed(1)}, ${stopSvgPt.y.toFixed(1)})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    confirmAndFinishPendingJoint();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmAndFinishPendingJoint();
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={10}
                    fill="rgba(16, 185, 129, 0.28)"
                    stroke="#10b981"
                    strokeWidth="2.4"
                    strokeDasharray="3 2"
                  />
                  <circle cx={0} cy={0} r={4.2} fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  <g transform="translate(0, -22)">
                    <rect
                      x={-44}
                      y={-11}
                      width={88}
                      height={22}
                      rx={6}
                      fill="#10b981"
                      stroke="#0f172a"
                      strokeWidth="1.8"
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#022c22"
                    >
                      ✓ OK (Finish)
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* =====================================================================
              LAYER 5: Tool-Specific Live 3D Drawing Preview (Uses True Brush/Pencil Size & Tool Style!)
             ===================================================================== */}
          {isDrawing3D &&
            liveStrokeSamples.length >= 1 &&
            (() => {
              const raw3DPts = liveStrokeSamples.map((s) => ({ x: s.svgX, y: s.svgY }));
              const isEraserMode =
                activeTool === 'eraser' ||
                (activeTool === '1_lithology' && lithologySubMode === 'erase_area');
              const smoothed3DPts = !isPencilTool
                ? raw3DPts
                : effectivePencilLineMode === 'linear' && raw3DPts.length >= 2
                ? [raw3DPts[0], raw3DPts[raw3DPts.length - 1]]
                : smoothTraceWithLevel(raw3DPts, 'high');
              const livePathD =
                !isPencilTool || effectivePencilLineMode === 'linear'
                  ? smoothed3DPts
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                      .join(' ')
                  : buildSmoothSvgPath(smoothed3DPts);
              const lastPt = raw3DPts[raw3DPts.length - 1];

              if (isEraserMode) {
                return (
                  <g pointerEvents="none">
                    <path
                      d={livePathD}
                      fill="none"
                      stroke="rgba(239, 68, 68, 0.28)"
                      strokeWidth={brushDiameter3D}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={livePathD}
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2.4"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={lastPt.x}
                      cy={lastPt.y}
                      r={brushRadius3D}
                      fill="rgba(239, 68, 68, 0.18)"
                      stroke="#dc2626"
                      strokeWidth="2.2"
                      strokeDasharray="4 2"
                    />
                  </g>
                );
              }

              if (activeTool === '1_lithology') {
                const rockMeta = resolveRockDisplayInfo(selectedRockType, rememberedRocksList);
                const isColorMode = (activeRound.reportColorMode ?? 'color') === 'color';
                const bgStrokeCol = isColorMode ? rockMeta.colorTint || '#fef9c3' : '#ffffff';
                return (
                  <g pointerEvents="none">
                    <path
                      d={livePathD}
                      fill="none"
                      stroke={bgStrokeCol}
                      strokeWidth={brushDiameter3D}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={livePathD}
                      fill="none"
                      stroke={`url(#fpat-${rockMeta.patternId})`}
                      strokeWidth={brushDiameter3D}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                    />
                    <circle
                      cx={lastPt.x}
                      cy={lastPt.y}
                      r={brushRadius3D}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  </g>
                );
              }

              if (activeTool === '2_vein_foliation' && smoothed3DPts.length >= 2) {
                const vMeta = resolveRockDisplayInfo(selectedVeinRockId, rememberedRocksList);
                return (
                  <g pointerEvents="none">
                    <FieldVeinFoliationBandSvgElement
                      stroke={{
                        id: 'live-3d-vein',
                        panel: liveStrokeSamples[0].panel,
                        rockType: selectedVeinRockId,
                        rockName: vMeta.name,
                        rockCode: vMeta.code,
                        color: vMeta.color,
                        fillColor: vMeta.fillColor,
                        patternId: vMeta.patternId,
                        mode: veinOrFoliationSubMode,
                        points: smoothed3DPts,
                        brushRadius: Math.round(veinBandThicknessPx / 2),
                        bandThicknessPx: veinBandThicknessPx,
                        symbolSize: veinBandSymbolSize,
                        symbolDensity: veinBandSymbolDensity,
                        lineMode: effectivePencilLineMode,
                        foliationDipDirection: liveDipDirection,
                        foliationDipAmount: liveDipAmount,
                      }}
                      round={activeRound}
                      rememberedRocks={rememberedRocksList}
                      colorMode={activeRound.reportColorMode ?? 'color'}
                    />
                  </g>
                );
              }

              if (activeTool === '4_dip_surface') {
                const rawPencilPts = raw3DPts
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(' ');
                const grp =
                  FIELD_JOINT_GROUP_COLORS[activeGroupingSet] ||
                  FIELD_JOINT_GROUP_COLORS.unassigned;
                return (
                  <g pointerEvents="none">
                    {raw3DPts.length >= 3 && (
                      <polygon
                        points={rawPencilPts}
                        fill={`${grp.fill}22`}
                        stroke={grp.stroke}
                        strokeWidth="1.4"
                        strokeDasharray="4 3"
                      />
                    )}
                    <polyline
                      points={rawPencilPts}
                      fill="none"
                      stroke={grp.stroke}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              }

              if (activeTool === '5_geo_feature' && smoothed3DPts.length >= 2) {
                const meta =
                  FIELD_STRUCTURAL_FEATURE_CATALOG.find((f) => f.id === selectedGeoFeatureType) ||
                  FIELD_STRUCTURAL_FEATURE_CATALOG[0];
                return (
                  <g pointerEvents="none">
                    <FieldStructuralFeatureSvgRenderer
                      feature={{
                        id: 'live-3d-feat',
                        panel: liveStrokeSamples[0].panel,
                        featureType: selectedGeoFeatureType,
                        label: meta.shortCode,
                        points: smoothed3DPts,
                        dipDirection: liveDipDirection,
                        dipAmount: liveDipAmount,
                        strokeWidthPx: geoFeaturePencilSizePx,
                        symbolSize: geoFeatureSymbolSize,
                        symbolDensity: geoFeatureSymbolDensity,
                        lineMode: effectivePencilLineMode,
                      }}
                      scale={1.0}
                      colorMode={activeRound.reportColorMode ?? 'color'}
                      tunnelDriveDirection={activeRound.tunnelDriveDirection}
                    />
                  </g>
                );
              }

              if (activeTool === '6_water_mark') {
                return (
                  <g pointerEvents="none">
                    <FieldWaterSymbolSvgRenderer
                      water={{
                        id: 'live-3d-wtr',
                        panel: liveStrokeSamples[0].panel,
                        condition: selectedWaterCondition,
                        points: raw3DPts,
                        brushRadius: Math.max(24, brushRadius),
                      }}
                      scale={1.0}
                      colorMode={activeRound.reportColorMode ?? 'color'}
                    />
                  </g>
                );
              }

              // Tool 3: Joint Trace live spline/linear preview + seam crossing indicators
              const grp =
                FIELD_JOINT_GROUP_COLORS[activeGroupingSet] || FIELD_JOINT_GROUP_COLORS.unassigned;
              return (
                <g pointerEvents="none">
                  <path
                    d={livePathD}
                    fill="none"
                    stroke={grp.stroke}
                    strokeWidth={jointPencilSizePx}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {liveStrokeSamples.map((s, idx) => {
                    if (idx === 0 || liveStrokeSamples[idx - 1].panel === s.panel) return null;
                    return (
                      <circle
                        key={`seam-cross-${idx}`}
                        cx={s.svgX}
                        cy={s.svgY}
                        r={6.5}
                        fill="#10b981"
                        stroke="#0f172a"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              );
            })()}

          {/* =====================================================================
              LAYER 6: Live 3D Brush / Eraser / Pen Cursor Ring (Direct DOM Ref — 0 React Re-Renders!)
             ===================================================================== */}
          {(() => {
            const isErase =
              activeTool === 'eraser' ||
              (activeTool === '1_lithology' && lithologySubMode === 'erase_area');
            const usesWideBrush =
              activeTool === '1_lithology' ||
              activeTool === '4_dip_surface' ||
              activeTool === '6_water_mark' ||
              activeTool === 'eraser';
            const cursorR =
              activeTool === '2_vein_foliation'
                ? Math.max(6, Math.round(veinBandThicknessPx * 0.45))
                : usesWideBrush
                ? brushRadius3D
                : 8;

            return (
              <g
                ref={hoverCursorGroupRef}
                style={{ display: 'none' }}
                className="pointer-events-none"
              >
                <circle
                  cx={0}
                  cy={0}
                  r={cursorR}
                  fill={
                    isErase
                      ? 'rgba(239, 68, 68, 0.16)'
                      : usesWideBrush
                      ? 'rgba(2, 132, 199, 0.10)'
                      : 'none'
                  }
                  stroke={isErase ? '#ef4444' : '#0284c7'}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle cx={0} cy={0} r={2.8} fill={isErase ? '#ef4444' : '#0284c7'} />
              </g>
            );
          })()}
        </svg>

        {/* Floating NATM 3D Joint Inspector Card */}
        {selectedJointForInspector && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-3 z-30 w-72 max-w-[calc(100%-24px)] bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-3 shadow-2xl text-slate-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full border border-white/40 shadow-sm"
                  style={{
                    backgroundColor:
                      FIELD_JOINT_GROUP_COLORS[selectedJointForInspector.setId || 'unassigned']?.stroke || '#94a3b8',
                  }}
                />
                <span className="font-bold text-xs text-white">
                  {selectedJointForInspector.setId && selectedJointForInspector.setId !== 'unassigned'
                    ? selectedJointForInspector.setId
                    : 'Joint'}{' '}
                  • {selectedJointForInspector.panel.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShow3DSpatialDisc((s) => !s)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                    show3DSpatialDisc
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle 3D spatial cutting disc in tunnel"
                >
                  3D Disc: {show3DSpatialDisc ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSelectedJoint(selectedJointForInspector.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                  title="Delete this joint trace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTraceId(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer text-xs font-bold leading-none"
                  title="Close inspector"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick 3D Orientation Steppers */}
            <div className="grid grid-cols-2 gap-2 my-2.5 text-[10.5px] font-mono">
              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <div className="text-[9.5px] text-slate-400 uppercase tracking-wider mb-1">Dip Direction</div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedJointAngle('dipDirection', -5)}
                    className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-black text-cyan-300 text-sm">
                    {String(selectedJointForInspector.dipDirection).padStart(3, '0')}°
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedJointAngle('dipDirection', 5)}
                    className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                <div className="text-[9.5px] text-slate-400 uppercase tracking-wider mb-1">Dip Angle</div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedJointAngle('dipAmount', -5)}
                    className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-black text-emerald-300 text-sm">
                    {selectedJointForInspector.dipAmount}°
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustSelectedJointAngle('dipAmount', 5)}
                    className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pb-2 font-mono">
              <span>Strike: <b className="text-slate-200">{String(selectedJointForInspector.strike || ((selectedJointForInspector.dipDirection + 270) % 360)).padStart(3, '0')}°</b></span>
              <span>Length: <b className="text-slate-200">{(selectedJointForInspector.traceLengthM ?? 1.2).toFixed(2)}m</b></span>
            </div>

            {/* Direct Launch Button into full NATM Joint 3D Inspector Modal */}
            {onOpen3DJointInspector && (
              <button
                type="button"
                onClick={() => onOpen3DJointInspector(selectedJointForInspector.id)}
                className="w-full mt-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                Open NATM 3D Inspector Modal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// LIGHTWEIGHT 3D -> SYNC BOX PUB-SUB CHANNEL (ZERO PARENT WORKSPACE RE-RENDERS)
// ============================================================================
type Field3DHoverCursorPayload = {
  panel: FieldPanelId;
  u: number;
  v: number;
  pullMeter: number;
  perimMeter: number;
} | null;

const field3DHoverListeners = new Set<(hover: Field3DHoverCursorPayload) => void>();
const field3DDrawListeners = new Set<(state: Field3DSyncTraceState) => void>();
const field3DPendingJointListeners = new Set<(pending: boolean) => void>();
const field3DConfirmJointListeners = new Set<() => void>();
let currentField3DPendingJoint = false;

function emitField3DHoverCursor(hover: Field3DHoverCursorPayload) {
  field3DHoverListeners.forEach((fn) => fn(hover));
}

function emitField3DDrawState(state: Field3DSyncTraceState) {
  field3DDrawListeners.forEach((fn) => fn(state));
}

function emitField3DPendingJointChange(pending: boolean) {
  currentField3DPendingJoint = pending;
  field3DPendingJointListeners.forEach((fn) => fn(pending));
}

function triggerField3DConfirmJoint() {
  field3DConfirmJointListeners.forEach((fn) => fn());
}

// ============================================================================
// RIGHT-WINDOW TOP: 2D UNFOLDED SYNC BOX (NEW TRACE ONLY + OUTLINE & REFERENCE LINES)
// Rectified: Bottom Strip Line = 0m -> Going Upward to Top Strip Line = 3m (pullM)
// Left Wall Outer Starting Edge = 0m!
// ============================================================================
interface Field3DNewTraceUnfoldedSyncBoxProps {
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  syncState: Field3DSyncTraceState | null;
  onClearNewTraceSync?: () => void;
}

export const Field3DNewTraceUnfoldedSyncBox: React.FC<Field3DNewTraceUnfoldedSyncBoxProps> = React.memo(({
  activeLocation,
  activeRound,
  syncState,
}) => {
  const syncCursorGroupRef = useRef<SVGGElement | null>(null);
  const [liveDrawState, setLiveDrawState] = useState<Field3DSyncTraceState | null>(syncState);
  const [isJointPendingOk, setIsJointPendingOk] = useState<boolean>(currentField3DPendingJoint);

  React.useEffect(() => {
    if (syncState) setLiveDrawState(syncState);
  }, [syncState]);

  const stripMetrics = useMemo(
    () => computeUnfoldedStripBoxes(activeLocation, activeRound, true),
    [activeLocation, activeRound]
  );

  const pullM = Math.max(
    0.5,
    Number(
      (activeRound as unknown as { pullLengthM?: number }).pullLengthM ??
        activeRound.pullLengthMeters
    ) || 3
  );
  const perimeterData = useMemo(
    () => build3DTunnelPerimeterNodes(activeLocation, activeRound),
    [activeLocation, activeRound]
  );

  const leftWallGeom = useMemo(
    () => computePanelCanvasGeometry('left_wall', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const crownGeom = useMemo(
    () => computePanelCanvasGeometry('crown', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const rightWallGeom = useMemo(
    () => computePanelCanvasGeometry('right_wall', activeLocation, activeRound),
    [activeLocation, activeRound]
  );
  const faceGeom = useMemo(
    () => computePanelCanvasGeometry('face', activeLocation, activeRound),
    [activeLocation, activeRound]
  );

  const getPanelGeom = (panel: FieldPanelId) => {
    if (panel === 'left_wall') return leftWallGeom;
    if (panel === 'crown') return crownGeom;
    if (panel === 'right_wall') return rightWallGeom;
    return faceGeom;
  };

  // Strip geometry inside SVG (340 x 192) — EXACT PROPORTIONAL CAD ALIGNMENT MATCHING STRIP LOG:
  // Dynamically computed from physical perimeter development: [ Left Wall | Crown Arch | Right Wall ]
  const leftWallM = Math.max(0.5, stripMetrics.leftWallLengthM || 4.0);
  const crownM = Math.max(0.5, stripMetrics.crownLengthM || 8.5);
  const rightWallM = Math.max(0.5, stripMetrics.rightWallLengthM || 4.0);
  const totalStripMetersW = leftWallM + crownM + rightWallM;

  const marginX = 14;
  const totalAvailW = 340 - marginX * 2; // 312px total strip span
  const lwW = Number(((leftWallM / totalStripMetersW) * totalAvailW).toFixed(1));
  const rwW = Number(((rightWallM / totalStripMetersW) * totalAvailW).toFixed(1));
  const crW = Number((totalAvailW - lwW - rwW).toFixed(1));

  const lwX0 = marginX;
  const crX0 = lwX0 + lwW;
  const rwX0 = crX0 + crW;
  const stripX1 = rwX0 + rwW;

  const stripY0 = 15;
  const stripH = 88;
  const stripY1 = stripY0 + stripH; // 103 (0m collar at bottom, pullM at top)

  const crownCenterlineX = Number((crX0 + crW / 2).toFixed(1));

  // Tunnel Face Canvas Outline positioned symmetrically below Crown Centerline (CL)
  const faceY0 = stripY1 + 12;
  const tunnelW = Math.max(1, activeLocation.widthM || 8.5);
  const tunnelH = Math.max(1, activeLocation.heightM || 7.5);
  const tunnelAspect = tunnelH / tunnelW;
  const maxFaceH = 192 - faceY0 - 4; // 73px max
  const faceH = Number(Math.min(maxFaceH, Math.max(46, 64 * Math.min(1.05, tunnelAspect))).toFixed(1));
  const faceW = Number(Math.min(crW * 1.05, Math.max(50, faceH / tunnelAspect)).toFixed(1));
  const faceX0 = Number((crownCenterlineX - faceW / 2).toFixed(1));

  // Map a canonical panel (u, v) to the 2D Unfolded Sync Box SVG:
  // In the canonical 2D panel coordinate system:
  // - Crown: u across curve (0 = L-SPL, 1 = R-SPL); v along pull (0 = Face / 3m, 1 = 0m collar)
  // - Left Wall: u along pull (0 = 0m collar, 1 = Face / 3m); v from SPL (0) to Invert (1)
  // - Right Wall: u along pull (0 = Face / 3m, 1 = 0m collar); v from SPL (0) to Invert (1)
  // - Face: u across width (0 = left, 1 = right); v down height (0 = apex, 1 = floor)
  // In the Sync Box top strip:
  //   Bottom Strip Line (stripY1) = 0m collar (pullNorm = 0)
  //   Top Strip Line (stripY0) = pullM / Face (pullNorm = 1)
  //   Left Wall: x = lwX0 (Floor / L-INV) -> crX0 (L-SPL)
  //   Crown: x = crX0 (L-SPL) -> rwX0 (R-SPL)
  //   Right Wall: x = rwX0 (R-SPL) -> stripX1 (Floor / R-INV)
  const mapUvToSyncSvg = React.useCallback(
    (panel: FieldPanelId, u: number, v: number): { x: number; y: number } => {
      if (panel === 'face') {
        return {
          x: faceX0 + Math.max(0, Math.min(1, u)) * faceW,
          y: faceY0 + Math.max(0, Math.min(1, v)) * faceH,
        };
      }
      const clampedU = Math.max(0, Math.min(1, u));
      const clampedV = Math.max(0, Math.min(1, v));
      let pullNorm = 0;
      let sx = 0;
      if (panel === 'crown') {
        // Crown: u = L-SPL (0) -> R-SPL (1); v = 0 (Face / 3m) -> 1 (0m collar)
        pullNorm = 1 - clampedV;
        sx = crX0 + clampedU * crW;
      } else if (panel === 'left_wall') {
        // Left Wall: u = 0 (0m collar) -> 1 (Face / 3m); v = 0 (L-SPL) -> 1 (Floor)
        pullNorm = clampedU;
        sx = lwX0 + (1 - clampedV) * lwW;
      } else if (panel === 'right_wall') {
        // Right Wall: u = 0 (Face / 3m) -> 1 (0m collar); v = 0 (R-SPL) -> 1 (Floor)
        pullNorm = 1 - clampedU;
        sx = rwX0 + clampedV * rwW;
      }
      // 0m at bottom (stripY1), pullM at top (stripY0)
      const sy = stripY1 - pullNorm * stripH;
      return { x: sx, y: sy };
    },
    [faceX0, faceW, faceY0, faceH, stripY1, stripH, lwX0, lwW, crX0, crW, rwX0, rwW]
  );

  // Subscribe to zero-lag hover cursor & live draw events directly from 3D canvas
  React.useEffect(() => {
    const onHover = (hover: Field3DHoverCursorPayload) => {
      const g = syncCursorGroupRef.current;
      if (!g) return;
      if (!hover) {
        g.style.display = 'none';
        return;
      }
      const p = mapUvToSyncSvg(hover.panel, hover.u, hover.v);
      g.style.display = '';
      g.setAttribute('transform', `translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    };
    const onDraw = (st: Field3DSyncTraceState) => {
      setLiveDrawState(st);
    };
    const onPending = (p: boolean) => {
      setIsJointPendingOk(p);
    };
    field3DHoverListeners.add(onHover);
    field3DDrawListeners.add(onDraw);
    field3DPendingJointListeners.add(onPending);
    return () => {
      field3DHoverListeners.delete(onHover);
      field3DDrawListeners.delete(onDraw);
      field3DPendingJointListeners.delete(onPending);
    };
  }, [mapUvToSyncSvg]);

  const mapPanelPtToSyncSvg = (panel: FieldPanelId, pt: FieldPoint2D) => {
    const geom = getPanelGeom(panel);
    const u = (pt.x - geom.boxX) / Math.max(1, geom.boxW);
    const v = (pt.y - geom.boxY) / Math.max(1, geom.boxH);
    return mapUvToSyncSvg(panel, u, v);
  };

  const faceOutlinePts = useMemo(() => {
    return perimeterData.facePolygonNorm
      .map((p) => {
        const fx = faceX0 + (p.nx + 0.5) * faceW;
        const fy = faceY0 + p.ny * faceH;
        return `${fx.toFixed(1)},${fy.toFixed(1)}`;
      })
      .join(' ');
  }, [perimeterData, faceX0, faceW, faceY0, faceH]);

  const effectiveState = liveDrawState || syncState;
  const latestIds = new Set(effectiveState?.latestCompletedIds || []);
  const isDrawing = Boolean(effectiveState?.isDrawing);
  const liveSamples = effectiveState?.liveSamples || [];

  // Preserve all drawn Joint Traces + highlight newest joint trace (only joint traces shown in Sync)
  const allJoints = activeRound.jointTraces || [];

  const meterStepCount = Math.max(1, Math.floor(pullM));
  const meterTicks: number[] = [];
  for (let m = 1; m < meterStepCount; m++) {
    meterTicks.push(m);
  }

  // 1m Perimeter Ticks along top edge matching strip log
  const perimeter1mTicks = useMemo(() => {
    const ticks: { x: number }[] = [];
    for (let m = 1; m < Math.floor(leftWallM); m++) {
      ticks.push({ x: Number((lwX0 + (m / leftWallM) * lwW).toFixed(1)) });
    }
    for (let m = 1; m < Math.floor(crownM); m++) {
      ticks.push({ x: Number((crX0 + (m / crownM) * crW).toFixed(1)) });
    }
    for (let m = 1; m < Math.floor(rightWallM); m++) {
      ticks.push({ x: Number((rwX0 + (m / rightWallM) * rwW).toFixed(1)) });
    }
    return ticks;
  }, [leftWallM, crownM, rightWallM, lwX0, crX0, rwX0, lwW, crW, rwW]);

  const faceSplY = faceY0 + (1 - (stripMetrics.splRatio || 0.58)) * faceH;

  return (
    <div className="bg-slate-900 border-2 border-cyan-500/70 rounded-xl p-1 shadow-lg shrink-0 select-none">
      <div className="flex items-center justify-between gap-1 mb-0.5 px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 font-mono">
          SYNC • UNROLLED CAD STRIP
        </span>
        {isJointPendingOk && (
          <button
            type="button"
            onClick={triggerField3DConfirmJoint}
            className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9.5px] cursor-pointer shadow"
            title="Click OK to finish current 3D joint trace"
          >
            ✓ OK (Finish Joint)
          </button>
        )}
      </div>

      <svg
        viewBox="0 0 340 192"
        className="w-full h-[182px] bg-white rounded-lg border border-slate-700 block"
      >
        {/* 1. Unfolded Strip Canvas Panels (Left Wall | Crown | Right Wall) - Arranged exact like strip log */}
        <rect
          x={lwX0}
          y={stripY0}
          width={lwW}
          height={stripH}
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        <rect
          x={crX0}
          y={stripY0}
          width={crW}
          height={stripH}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        <rect
          x={rwX0}
          y={stripY0}
          width={rwW}
          height={stripH}
          fill="#f8fafc"
          stroke="#0f172a"
          strokeWidth="1.5"
        />

        {/* Unified Continuous CAD Strip Perimeter Border */}
        <rect
          x={lwX0}
          y={stripY0}
          width={totalAvailW}
          height={stripH}
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.8"
        />

        {/* 1m Perimeter Ticks along top edge of strip */}
        {perimeter1mTicks.map((tk, idx) => (
          <line
            key={`perim-tk-${idx}`}
            x1={tk.x}
            y1={stripY0}
            x2={tk.x}
            y2={stripY0 + 3.5}
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}

        {/* Pull Reference Grid Lines: 0m at Bottom Line (stripY1) -> going upward to pullM at Top Line (stripY0) */}
        {meterTicks.map((m) => {
          const frac = m / pullM;
          const y = stripY1 - frac * stripH;
          return (
            <g key={`sync-pull-grid-${m}`}>
              <line
                x1={lwX0}
                y1={y}
                x2={stripX1}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="0.9"
                strokeDasharray="3 2"
              />
              <text
                x={lwX0 - 2}
                y={y + 2.5}
                textAnchor="end"
                fontSize="6.5"
                fontWeight="800"
                fontFamily="IBM Plex Mono, monospace"
                fill="#475569"
              >
                {m}m
              </text>
            </g>
          );
        })}

        {/* Longitudinal Seam Lines matching Strip Log: L-SPL, Crown CL, R-SPL */}
        <line
          x1={crX0}
          y1={stripY0}
          x2={crX0}
          y2={stripY1}
          stroke="#0f172a"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
        <line
          x1={crownCenterlineX}
          y1={stripY0}
          x2={crownCenterlineX}
          y2={stripY1}
          stroke="#0284c7"
          strokeWidth="1.3"
          strokeDasharray="6 3 2 3"
        />
        <line
          x1={rwX0}
          y1={stripY0}
          x2={rwX0}
          y2={stripY1}
          stroke="#0f172a"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />

        {/* Top Face Reference Line (pullM) & Bottom 0m Collar Reference Line */}
        <line
          x1={lwX0}
          y1={stripY0}
          x2={stripX1}
          y2={stripY0}
          stroke="#0284c7"
          strokeWidth="2"
        />
        <line
          x1={lwX0}
          y1={stripY1}
          x2={stripX1}
          y2={stripY1}
          stroke="#0f172a"
          strokeWidth="2.2"
        />

        {/* Top = pullM (Face) & Bottom = 0m (Collar) Ruler Labels */}
        <text
          x={lwX0 - 2}
          y={stripY0 + 4}
          textAnchor="end"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0284c7"
        >
          {pullM}m
        </text>
        <text
          x={lwX0 - 2}
          y={stripY1}
          textAnchor="end"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0f172a"
        >
          0m
        </text>
        <text
          x={stripX1 + 2}
          y={stripY0 + 4}
          textAnchor="start"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0284c7"
        >
          {pullM}m
        </text>
        <text
          x={stripX1 + 2}
          y={stripY1}
          textAnchor="start"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0f172a"
        >
          0m
        </text>

        {/* Top Panel Headers matching Strip Log Standard */}
        <text
          x={lwX0 + lwW / 2}
          y={stripY0 - 3.5}
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0f766e"
        >
          L.WALL ({leftWallM.toFixed(1)}m)
        </text>
        <text
          x={crownCenterlineX}
          y={stripY0 - 3.5}
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0369a1"
        >
          CROWN ARCH ({crownM.toFixed(1)}m)
        </text>
        <text
          x={rwX0 + rwW / 2}
          y={stripY0 - 3.5}
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#4338ca"
        >
          R.WALL ({rightWallM.toFixed(1)}m)
        </text>

        {/* Bottom Seam Labels matching Strip Log */}
        <text
          x={lwX0}
          y={stripY1 + 8}
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="800"
          fontFamily="IBM Plex Mono, monospace"
          fill="#64748b"
        >
          L-INV
        </text>
        <text
          x={crX0}
          y={stripY1 + 8}
          textAnchor="middle"
          fontSize="6.8"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0284c7"
        >
          SPL
        </text>
        <text
          x={crownCenterlineX}
          y={stripY1 + 8}
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0369a1"
        >
          CL
        </text>
        <text
          x={rwX0}
          y={stripY1 + 8}
          textAnchor="middle"
          fontSize="6.8"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0284c7"
        >
          SPL
        </text>
        <text
          x={stripX1}
          y={stripY1 + 8}
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="800"
          fontFamily="IBM Plex Mono, monospace"
          fill="#64748b"
        >
          R-INV
        </text>

        {/* 2. Face Canvas Outline & Centerline Aligned with Crown CL below Strip */}
        <rect
          x={faceX0}
          y={faceY0}
          width={faceW}
          height={faceH}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <polygon
          points={faceOutlinePts}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.6"
        />
        {/* Face Vertical Centerline connecting with Crown CL */}
        <line
          x1={crownCenterlineX}
          y1={faceY0}
          x2={crownCenterlineX}
          y2={faceY0 + faceH}
          stroke="#0284c7"
          strokeWidth="1.2"
          strokeDasharray="3 2"
          opacity="0.8"
        />
        {/* Face Horizontal Springline Reference */}
        <line
          x1={faceX0 + 2}
          y1={faceSplY}
          x2={faceX0 + faceW - 2}
          y2={faceSplY}
          stroke="#94a3b8"
          strokeWidth="0.9"
          strokeDasharray="3 2"
          opacity="0.75"
        />
        <text
          x={faceX0 - 4}
          y={faceY0 + faceH / 2 + 2.5}
          textAnchor="end"
          fontSize="7"
          fontWeight="900"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0f172a"
        >
          FACE
        </text>

        {/* 3A. Render All Preserved Drawn Joint Traces + Highlight Newest Joint Trace */}
        {allJoints.map((tr) => {
          if (tr.points.length < 2) return null;
          const mappedPts = tr.points.map((pt) => mapPanelPtToSyncSvg(tr.panel, pt));
          const isLatest = latestIds.has(tr.id);
          const col =
            FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned']?.stroke || '#0f172a';
          return (
            <g key={`sync-jtr-${tr.id}`}>
              {isLatest && (
                <path
                  d={buildSmoothSvgPath(mappedPts)}
                  fill="none"
                  stroke="#fef08a"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <path
                d={buildSmoothSvgPath(mappedPts)}
                fill="none"
                stroke={col}
                strokeWidth={isLatest ? '2.8' : '2.0'}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* 3B. Render Lithology / Vein Bands & Foliation in Sync Box */}
        {(activeRound.lithologyStrokes || []).map((st) => {
          if (
            st.points.length < 2 ||
            (st.mode !== 'vein_band' && st.mode !== 'foliation_plane')
          ) {
            return null;
          }
          const mappedPts = st.points.map((pt) => mapPanelPtToSyncSvg(st.panel, pt));
          const pathD = buildSmoothSvgPath(mappedPts);
          const col = st.mode === 'vein_band' ? '#d97706' : '#64748b';
          return (
            <path
              key={`sync-vein-${st.id}`}
              d={pathD}
              fill="none"
              stroke={col}
              strokeWidth="2.2"
              strokeDasharray={st.mode === 'foliation_plane' ? '3 2' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.88}
            />
          );
        })}

        {/* 3C. Render Structural Features (Faults, Shear Zones, Bedding, Dykes) in Sync Box */}
        {(activeRound.structuralFeatures || []).map((ft) => {
          if (ft.points.length < 2) return null;
          const mappedPts = ft.points.map((pt) => mapPanelPtToSyncSvg(ft.panel, pt));
          const pathD = buildSmoothSvgPath(mappedPts);
          const col =
            ft.featureType === 'fault' || ft.featureType === 'thrust_fault'
              ? '#dc2626'
              : ft.featureType === 'shear_zone'
              ? '#ea580c'
              : ft.featureType === 'fold_axis'
              ? '#7c3aed'
              : '#2563eb';
          return (
            <path
              key={`sync-ft-${ft.id}`}
              d={pathD}
              fill="none"
              stroke={col}
              strokeWidth="2.4"
              strokeDasharray={ft.featureType === 'shear_zone' ? '4 2' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* 3D. Render Dip Plane Surfaces in Sync Box */}
        {(activeRound.dipPlaneSurfaces || []).map((ds) => {
          if (ds.points.length < 2) return null;
          const mappedPts = ds.points.map((pt) => mapPanelPtToSyncSvg(ds.panel, pt));
          const grp =
            FIELD_JOINT_GROUP_COLORS[ds.setId || 'unassigned'] ||
            FIELD_JOINT_GROUP_COLORS.unassigned;
          return (
            <polygon
              key={`sync-dip-${ds.id}`}
              points={mappedPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill={grp.stroke}
              fillOpacity="0.28"
              stroke={grp.stroke}
              strokeWidth="1.2"
            />
          );
        })}

        {/* 4. Render Live Active New Joint Trace being drawn in real time (Continuous Across Unfolded Panels) */}
        {isDrawing &&
          liveSamples.map((s, idx) => {
            const p = mapUvToSyncSvg(s.panel, s.u, s.v);
            const prev = idx > 0 ? liveSamples[idx - 1] : null;
            let prevP: { x: number; y: number } | null = null;
            if (prev) {
              if (prev.panel === s.panel) {
                prevP = mapUvToSyncSvg(prev.panel, prev.u, prev.v);
              } else if (prev.panel !== 'face' && s.panel !== 'face') {
                // Crossing Left Wall <-> Crown or Crown <-> Right Wall on the unfolded strip
                const testP = mapUvToSyncSvg(prev.panel, prev.u, prev.v);
                if (Math.hypot(p.x - testP.x, p.y - testP.y) < 36) {
                  prevP = testP;
                }
              }
            }
            return (
              <g key={`sync-live-seg-${idx}`}>
                {prevP && (
                  <line
                    x1={prevP.x}
                    y1={prevP.y}
                    x2={p.x}
                    y2={p.y}
                    stroke="#f59e0b"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                )}
                <circle cx={p.x} cy={p.y} r={2.2} fill="#f59e0b" />
              </g>
            );
          })}

        {/* 5. Live 3D Cursor Position Indicator on the 2D Unfolded Canvas (Direct DOM Ref — 0 React Re-Renders) */}
        <g ref={syncCursorGroupRef} style={{ display: 'none' }} className="pointer-events-none">
          <circle
            cx={0}
            cy={0}
            r={5.5}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.6"
            strokeDasharray="2 1"
          />
          <circle cx={0} cy={0} r={2.5} fill="#0284c7" />
        </g>
      </svg>
    </div>
  );
});

