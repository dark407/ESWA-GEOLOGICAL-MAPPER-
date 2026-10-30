import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Compass,
  Download,
  Edit3,
  FileText,
  GitMerge,
  Image as ImageIcon,
  Layers,
  Link2,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  APERTURE_OPTIONS,
  buildAutoPopulatedTemplateDictionary,
  computeFieldQValue,
  computeFieldRmrValue,
  computePhysicalMetricPoints,
  computeJunctionGeotechnicalAdjustments,
  computeTraceOrientationFromTunnelDrive,
  computeTraceScreenDipTickVector,
  buildSmoothSvgPath,
  convertPhysicalMetricPointsToCanvas,
  createDefaultSupportSystem,
  exportFieldMappingTwoPagePdfSheet,
  exportFieldMappingTwoPageWordSheet,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_JOINT_SET_IDS,
  FIELD_LITHOLOGY_CATALOG,
  FieldJointGroupingId,
  mapMetricPointToStripSvg,
} from '../engine/fieldMappingEngine';
import {
  calculatePlaneSurfaceIntersections,
  constructJointPlane,
  deriveAnchorPointFromPoints,
  TunnelSpatialGeometry,
} from '../engine/joint3DInspectorEngine';
import {
  FieldCustomTickBoxGroup,
  FieldDiscontinuitySetRecord,
  FieldExcavationRound,
  FieldJointSetId,
  FieldPoint2D,
  FieldProjectItem,
  FieldTunnelLocationItem,
  formatOverbreakCauseLabel,
  generateProfessionalGeologicalDescription,
  GROUNDWATER_OPTIONS,
  INFILLING_OPTIONS,
  parseUploadedWordTemplateFile,
  PERSISTENCE_OPTIONS,
  ROUGHNESS_OPTIONS,
  renderSvgElementToHighResPngDataUrl,
  smoothFieldPencilStroke,
  SPACING_OPTIONS,
  WEATHERING_OPTIONS,
} from '../engine/fieldMappingEngine';
import {
  computeUnfoldedStripBoxes,
  FieldUnfoldedSheetSvgPreview,
  FieldMonochromeGeologicalPatterns,
} from './FieldMappingCompassAndPatterns';
import {
  FieldSupport2DCrossSectionSvg,
} from './FieldAdvancedStages';
import {
  syncFieldMappingRoundForAiTraining,
} from '../engine/userCloudAndPackageEngine';
import {
  MappingDomainType,
  SurfaceGeometryParameters,
  evaluateSurfaceStabilityAndRomanaSmr,
} from '../engine/surfaceMappingEngine';
import { FieldFemDemReportEmbedSection } from './FieldFemDemAnalysisStage';
import { createDefaultFemDemConfig } from '../engine/femDemAnalysisEngine';

type StripAlignItemKind = 'joint' | 'vein' | 'feature' | 'lithology' | 'dip_plane';
type JointPointActionMode = 'add_point' | 'bend' | 'move' | 'extend';

interface StripAlignableItem {
  id: string;
  kind: StripAlignItemKind;
  panel: 'left_wall' | 'crown' | 'right_wall';
  label: string;
  color: string;
  points: FieldPoint2D[];
  rawItem?: any;
}

// Ensures a polyline has at least minCount evenly spaced points along its arc so smooth bending works on any trace
function ensureDensePolylinePoints(points: FieldPoint2D[], minCount = 25): FieldPoint2D[] {
  if (points.length >= minCount || points.length < 2) return points;
  const cumLen: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumLen.push(cumLen[i - 1] + seg);
  }
  const totalLen = cumLen[cumLen.length - 1];
  if (totalLen < 1e-3) return points;

  const result: FieldPoint2D[] = [];
  for (let k = 0; k < minCount; k++) {
    const targetD = (k / (minCount - 1)) * totalLen;
    let segIdx = 0;
    while (segIdx < cumLen.length - 2 && cumLen[segIdx + 1] < targetD) {
      segIdx++;
    }
    const d0 = cumLen[segIdx];
    const d1 = cumLen[segIdx + 1];
    const localT = d1 > d0 ? (targetD - d0) / (d1 - d0) : 0;
    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];
    result.push({
      x: Number((p0.x + (p1.x - p0.x) * localT).toFixed(1)),
      y: Number((p0.y + (p1.y - p0.y) * localT).toFixed(1)),
    });
  }
  return result;
}

// Smoothly deforms a polyline when one endpoint ('start' or 'end') is moved to (newX, newY),
// keeping the opposite endpoint (or nearest interior control point) anchored.
function deformPolylineEndpointSmoothly(
  points: FieldPoint2D[],
  endIndex: 'start' | 'end',
  newX: number,
  newY: number,
  anchorRatio?: number
): FieldPoint2D[] {
  if (points.length < 2) return points;
  const dense = ensureDensePolylinePoints(points, 25);
  const n = dense.length;
  const oldPt = endIndex === 'start' ? dense[0] : dense[n - 1];
  const dx = newX - oldPt.x;
  const dy = newY - oldPt.y;

  const anchorIdx =
    anchorRatio !== undefined
      ? Math.max(1, Math.min(n - 2, Math.round(anchorRatio * (n - 1))))
      : endIndex === 'start'
      ? n - 1
      : 0;

  const updated = dense.map((p, idx) => {
    let weight = 0;
    if (endIndex === 'start') {
      if (idx <= anchorIdx) {
        const u = (anchorIdx - idx) / Math.max(1, anchorIdx);
        weight = 0.5 * (1 - Math.cos(Math.PI * u));
      }
    } else {
      if (idx >= anchorIdx) {
        const u = (idx - anchorIdx) / Math.max(1, n - 1 - anchorIdx);
        weight = 0.5 * (1 - Math.cos(Math.PI * u));
      }
    }
    return {
      x: Number((p.x + dx * weight).toFixed(1)),
      y: Number((p.y + dy * weight).toFixed(1)),
    };
  });
  return smoothFieldPencilStroke(updated);
}

// ============================================================================
// STAGE 5: CONTINUOUS WALL — CROWN — WALL ALIGNMENT (TOP PORTION ONLY)
// Aligns Joint Traces, Vein/Foliation Bands, and Structural Features across
// Vertical Left Wall -> Horizontal Crown -> Vertical Right Wall
// ============================================================================
export const FieldStripAlignmentStage: React.FC<{
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  rememberedRocks?: FieldRememberedRockItem[];
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToCanvas: () => void;
  onCompleteAndContinue: () => void;
}> = ({
  activeLocation,
  activeRound,
  rememberedRocks = [],
  onUpdateRound,
  onBackToCanvas,
  onCompleteAndContinue,
}) => {
  const stripSvgRef = useRef<SVGSVGElement | null>(null);
  const [pointActionMode, setPointActionMode] = useState<JointPointActionMode>('bend');
  const [isJoinMode, setIsJoinMode] = useState<boolean>(false);
  const [joinFirstTraceId, setJoinFirstTraceId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<
    {
      jointTraces: FieldExcavationRound['jointTraces'];
      lithologyStrokes: FieldExcavationRound['lithologyStrokes'];
      dipPlaneSurfaces: FieldExcavationRound['dipPlaneSurfaces'];
      structuralFeatures: NonNullable<FieldExcavationRound['structuralFeatures']>;
    }[]
  >([]);

  // User-added control points along each joint trace (stored as sorted normalized ratios 0.08..0.92)
  const [addedJointPointsMap, setAddedJointPointsMap] = useState<Record<string, number[]>>({});
  const [selectedControlPointIdx, setSelectedControlPointIdx] = useState<number | null>(null);

  const [draggingHandle, setDraggingHandle] = useState<{
    id: string;
    kind: StripAlignItemKind;
    panel: 'left_wall' | 'crown' | 'right_wall';
    handleType: 'start' | 'end' | 'center' | 'bend_point';
    bendPointIdx?: number;
    bendRatio?: number;
    lastStripX: number;
    lastStripY: number;
  } | null>(null);

  const pushUndo = () => {
    setUndoStack((prev) => [
      ...prev.slice(-19),
      {
        jointTraces: activeRound.jointTraces.map((t) => ({
          ...t,
          points: t.points.map((p) => ({ ...p })),
        })),
        lithologyStrokes: activeRound.lithologyStrokes.map((s) => ({
          ...s,
          points: s.points.map((p) => ({ ...p })),
        })),
        dipPlaneSurfaces: activeRound.dipPlaneSurfaces.map((d) => ({
          ...d,
          points: d.points.map((p) => ({ ...p })),
        })),
        structuralFeatures: (activeRound.structuralFeatures || []).map((f) => ({
          ...f,
          points: f.points.map((p) => ({ ...p })),
        })),
      },
    ]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    onUpdateRound((r) => ({
      ...r,
      jointTraces: last.jointTraces,
      lithologyStrokes: last.lithologyStrokes,
      dipPlaneSurfaces: last.dipPlaneSurfaces || r.dipPlaneSurfaces,
      structuralFeatures: last.structuralFeatures,
    }));
  };

  const stripMetrics = computeUnfoldedStripBoxes(activeLocation, activeRound, true);
  const {
    leftWallGeom,
    crownGeom,
    rightWallGeom,
    stripLeftWallW,
    stripRightWallW,
    stripCrownW,
    stripLeftWallH,
    stripRightWallH,
    stripCrownH,
    leftWallX,
    crownX,
    rightWallX,
    stripY,
    stripH,
    stripViewBoxH,
  } = stripMetrics;

  const [selectedTraceItem, setSelectedTraceItem] = useState<{
    id: string;
    kind: StripAlignItemKind;
    panel: 'left_wall' | 'crown' | 'right_wall';
  } | null>(null);
  const [activeMagneticSnapPt, setActiveMagneticSnapPt] = useState<FieldPoint2D | null>(null);

  const [stripZoom, setStripZoom] = useState<number>(1);
  const [stripPan, setStripPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isStripPanMode, setIsStripPanMode] = useState<boolean>(false);
  const [stripPanDrag, setStripPanDrag] = useState<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const stripWrapperRef = useRef<HTMLDivElement | null>(null);
  const stripPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isStripPinchingRef = useRef<boolean>(false);
  const stripPinchStateRef = useRef<{
    startDist: number;
    startMidX: number;
    startMidY: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Non-passive PC mouse wheel scroll & laptop trackpad pinch-zoom listener anchored at cursor
  useEffect(() => {
    const el = stripWrapperRef.current;
    if (!el) return;
    const onWheelNonPassive = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const svg = stripSvgRef.current;
      const rect = (svg || el).getBoundingClientRect();
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.014)
        : e.deltaY < 0
        ? 1.15
        : 1 / 1.15;

      setStripZoom((prevZoom) => {
        const nextZoom = Math.max(0.6, Math.min(5.0, Number((prevZoom * factor).toFixed(3))));
        if (nextZoom <= 1) {
          setStripPan({ x: 0, y: 0 });
        } else {
          const normX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
          const normY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
          const shiftX = normX * (920 / prevZoom - 920 / nextZoom);
          const shiftY = normY * (stripViewBoxH / prevZoom - stripViewBoxH / nextZoom);
          setStripPan((prevPan) => ({
            x: Math.max(-440, Math.min(440, prevPan.x + shiftX)),
            y: Math.max(-180, Math.min(180, prevPan.y + shiftY)),
          }));
        }
        return nextZoom;
      });
    };
    el.addEventListener('wheel', onWheelNonPassive, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNonPassive);
  }, [stripViewBoxH]);

  const getPanelStripBox = (panel: 'left_wall' | 'crown' | 'right_wall') => {
    if (panel === 'left_wall') {
      return { x: leftWallX, w: stripLeftWallW, h: stripLeftWallH, geom: leftWallGeom };
    }
    if (panel === 'crown') {
      return { x: crownX, w: stripCrownW, h: stripCrownH, geom: crownGeom };
    }
    return { x: rightWallX, w: stripRightWallW, h: stripRightWallH, geom: rightWallGeom };
  };

  // Convert panel coordinates -> strip SVG coordinates (0m at bottom -> PullM at top) using physical metric dimensions
  const panelPointToStripPoint = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    pt: FieldPoint2D
  ): FieldPoint2D => {
    const box = getPanelStripBox(panel);
    const [metricPt] = computePhysicalMetricPoints([pt], panel, activeLocation, activeRound);
    return mapMetricPointToStripSvg(metricPt, panel, activeLocation, activeRound, box, stripY);
  };

  // Convert strip SVG coordinates -> panel coordinates (clamped to panel box, 0m at bottom -> PullM at top)
  const stripPointToPanelPoint = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    sx: number,
    sy: number
  ): FieldPoint2D => {
    const { x, w, h, geom } = getPanelStripBox(panel);
    const pullM = geom.pullM;
    const wallHM = geom.leftWallLengthM;
    const crownArchM = geom.crownLengthM;

    const normX = Math.max(0.001, Math.min(0.999, (sx - x) / Math.max(1, w)));
    const normY = Math.max(0.001, Math.min(0.999, (sy - stripY) / Math.max(1, h)));

    let metricPt: { x: number; y: number };
    if (panel === 'left_wall') {
      // sx: invert floor (0) -> left springline (1) => y = normX * wallHM
      // sy: face (0) -> pull start (1) => x = (1 - normY) * pullM
      metricPt = {
        x: (1 - normY) * pullM,
        y: normX * wallHM,
      };
    } else if (panel === 'crown') {
      // sx: left springline (0) -> right springline (1) => x = normX * crownArchM
      // sy: face (0) -> pull start (1) => y = (1 - normY) * pullM
      metricPt = {
        x: normX * crownArchM,
        y: (1 - normY) * pullM,
      };
    } else {
      // right_wall:
      // sx: right springline (0) -> right invert floor (1) => y = (1 - normX) * wallHM
      // sy: face (0) -> pull start (1) => x = (1 - normY) * pullM
      metricPt = {
        x: (1 - normY) * pullM,
        y: (1 - normX) * wallHM,
      };
    }
    const [canvasPt] = convertPhysicalMetricPointsToCanvas([metricPt], panel, activeLocation, activeRound);
    return canvasPt;
  };

  // Collect all alignable items (Joint Traces, Vein/Foliation Bands, Structural Features) on Left Wall, Crown, Right Wall
  const alignableItems: StripAlignableItem[] = [];
  activeRound.jointTraces.forEach((tr) => {
    if (
      (tr.panel === 'left_wall' || tr.panel === 'crown' || tr.panel === 'right_wall') &&
      tr.points.length >= 2
    ) {
      const col = FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned']?.stroke || '#0f172a';
      alignableItems.push({
        id: tr.id,
        kind: 'joint',
        panel: tr.panel,
        label: tr.setId === 'unassigned' ? 'J' : tr.setId,
        color: col,
        points: tr.points,
      });
    }

    if (tr.panel === 'face' && tr.points.length >= 2) {
      const spatialGeom: TunnelSpatialGeometry = {
        widthM: activeLocation.widthM,
        heightM: activeLocation.heightM,
        wallHeightM: activeLocation.wallHeightM || activeLocation.heightM * 0.58,
        pullLengthM: activeRound.pullLengthMeters || 3.5,
        driveAzimuthDeg: activeRound.tunnelDriveDirection || 0,
      };
      if (typeof tr.dipDirection === 'number' && typeof tr.dipAmount === 'number') {
        const anchor = deriveAnchorPointFromPoints(tr.points, 'face', spatialGeom);
        const plane = constructJointPlane(tr.dipDirection, tr.dipAmount, anchor, spatialGeom.driveAzimuthDeg);
        const inter = calculatePlaneSurfaceIntersections(plane, spatialGeom, 'face');
        const col = FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned']?.stroke || '#0f172a';

        if (inter.leftWall && inter.leftWall.lengthM > 0.05) {
          const metricP1 = { x: inter.leftWall.p1.x, y: inter.leftWall.p1.y };
          const metricP2 = { x: inter.leftWall.p2.x, y: inter.leftWall.p2.y };
          const [p1, p2] = convertPhysicalMetricPointsToCanvas([metricP1, metricP2], 'left_wall', activeLocation, activeRound);
          alignableItems.push({
            id: `proj-lw-${tr.id}`,
            kind: 'joint',
            panel: 'left_wall',
            label: tr.setId === 'unassigned' ? 'J' : tr.setId,
            color: col,
            points: [p1, p2],
          });
        }

        if (inter.crown && inter.crown.lengthM > 0.05) {
          const crownLenM = crownGeom.crownLengthM || activeLocation.widthM * 1.25;
          const metricP1 = {
            x: (inter.crown.p1.y / Math.max(0.1, spatialGeom.widthM)) * crownLenM,
            y: inter.crown.p1.x,
          };
          const metricP2 = {
            x: (inter.crown.p2.y / Math.max(0.1, spatialGeom.widthM)) * crownLenM,
            y: inter.crown.p2.x,
          };
          const [p1, p2] = convertPhysicalMetricPointsToCanvas([metricP1, metricP2], 'crown', activeLocation, activeRound);
          alignableItems.push({
            id: `proj-cr-${tr.id}`,
            kind: 'joint',
            panel: 'crown',
            label: tr.setId === 'unassigned' ? 'J' : tr.setId,
            color: col,
            points: [p1, p2],
          });
        }

        if (inter.rightWall && inter.rightWall.lengthM > 0.05) {
          const metricP1 = { x: inter.rightWall.p1.x, y: inter.rightWall.p1.y };
          const metricP2 = { x: inter.rightWall.p2.x, y: inter.rightWall.p2.y };
          const [p1, p2] = convertPhysicalMetricPointsToCanvas([metricP1, metricP2], 'right_wall', activeLocation, activeRound);
          alignableItems.push({
            id: `proj-rw-${tr.id}`,
            kind: 'joint',
            panel: 'right_wall',
            label: tr.setId === 'unassigned' ? 'J' : tr.setId,
            color: col,
            points: [p1, p2],
          });
        }
      }
    }
  });
  activeRound.lithologyStrokes.forEach((st) => {
    const isVeinOrFol = st.mode === 'vein_band' || st.mode === 'foliation_plane';
    if (
      isVeinOrFol &&
      (st.panel === 'left_wall' || st.panel === 'crown' || st.panel === 'right_wall') &&
      st.points.length >= 2
    ) {
      alignableItems.push({
        id: st.id,
        kind: 'vein',
        panel: st.panel,
        label: (st.rockName || st.rockType || 'Vein').slice(0, 10),
        color: st.customColor || st.color || '#0d9488',
        points: st.polygon && st.polygon.length >= 3 ? st.polygon : st.points,
        rawItem: st,
      });
    }
  });
  (activeRound.structuralFeatures || []).forEach((ft) => {
    if (
      (ft.panel === 'left_wall' || ft.panel === 'crown' || ft.panel === 'right_wall') &&
      ft.points.length >= 2
    ) {
      alignableItems.push({
        id: ft.id,
        kind: 'feature',
        panel: ft.panel,
        label: ft.label || 'FLT',
        color: '#dc2626',
        points: ft.points,
      });
    }
  });

  // Update points of any item (Joint, Vein/Foliation, Lithology, Dip Plane, or Feature) and refresh its orientation
  const updateItemPointsInRound = (
    r: FieldExcavationRound,
    id: string,
    kind: StripAlignItemKind,
    nextPoints: FieldPoint2D[]
  ): FieldExcavationRound => {
    if (kind === 'joint') {
      const isProjectedFaceTrace =
        id.startsWith('proj-lw-') || id.startsWith('proj-cr-') || id.startsWith('proj-rw-');
      const baseFaceId = isProjectedFaceTrace ? id.replace(/^proj-(lw|cr|rw)-/, '') : id;

      return {
        ...r,
        jointTraces: r.jointTraces.map((tr) => {
          if (tr.id === id) {
            const ori = computeTraceOrientationFromTunnelDrive(
              nextPoints,
              tr.panel,
              r.tunnelDriveDirection,
              tr.crownDipSign,
              activeLocation.widthM,
              activeLocation.heightM
            );
            const metricPoints = computePhysicalMetricPoints(
              nextPoints,
              tr.panel,
              activeLocation,
              r
            );
            return {
              ...tr,
              points: nextPoints,
              metricPoints,
              dipDirection: tr.editedByCompass ? tr.dipDirection : ori.dipDirection,
              dipAmount: tr.editedByCompass ? tr.dipAmount : ori.dipAmount,
              strike: tr.editedByCompass ? tr.strike : ori.strike,
              traceLengthM: ori.traceLengthM,
            };
          }
          if (isProjectedFaceTrace && tr.id === baseFaceId) {
            const metricPoints = computePhysicalMetricPoints(
              tr.points,
              tr.panel,
              activeLocation,
              r
            );
            return {
              ...tr,
              metricPoints,
            };
          }
          return tr;
        }),
      };
    }
    if (kind === 'vein') {
      return {
        ...r,
        lithologyStrokes: r.lithologyStrokes.map((st) => {
          if (st.id !== id) return st;
          const ori = computeTraceOrientationFromTunnelDrive(
            nextPoints,
            st.panel,
            r.tunnelDriveDirection,
            '+90',
            activeLocation.widthM,
            activeLocation.heightM
          );
          return {
            ...st,
            points: nextPoints,
            foliationDipDirection: ori.dipDirection,
            foliationDipAmount: ori.dipAmount,
          };
        }),
      };
    }
    if (kind === 'lithology') {
      return {
        ...r,
        lithologyStrokes: r.lithologyStrokes.map((st) => {
          if (st.id !== id) return st;
          return {
            ...st,
            points: nextPoints,
            polygon: st.polygon ? nextPoints : undefined,
          };
        }),
      };
    }
    if (kind === 'dip_plane') {
      return {
        ...r,
        dipPlaneSurfaces: r.dipPlaneSurfaces.map((ds) => {
          if (ds.id !== id) return ds;
          return {
            ...ds,
            points: nextPoints,
            outlinePolygon: ds.outlinePolygon ? nextPoints : undefined,
          };
        }),
      };
    }
    return {
      ...r,
      structuralFeatures: (r.structuralFeatures || []).map((ft) => {
        if (ft.id !== id) return ft;
        const ori = computeTraceOrientationFromTunnelDrive(
          nextPoints,
          ft.panel,
          r.tunnelDriveDirection,
          '+90',
          activeLocation.widthM,
          activeLocation.heightM
        );
        return {
          ...ft,
          points: nextPoints,
          dipDirection: ori.dipDirection,
          dipAmount: ori.dipAmount,
        };
      }),
    };
  };

  // Join / Connect two joint traces into a single continuous joint trace
  const handleJoinJoints = (traceAId: string, traceBId: string) => {
    if (traceAId === traceBId) return;
    const isProjA = traceAId.startsWith('proj-');
    const isProjB = traceBId.startsWith('proj-');
    const realAId = isProjA ? traceAId.replace(/^proj-(lw|cr|rw)-/, '') : traceAId;
    const realBId = isProjB ? traceBId.replace(/^proj-(lw|cr|rw)-/, '') : traceBId;

    const traceA = activeRound.jointTraces.find((t) => t.id === realAId);
    const traceB = activeRound.jointTraces.find((t) => t.id === realBId);
    if (!traceA || !traceB) {
      setIsJoinMode(false);
      setJoinFirstTraceId(null);
      return;
    }

    pushUndo();

    const ptsA = traceA.points;
    const ptsB = traceB.points;
    if (ptsA.length < 2 || ptsB.length < 2) return;

    const aStart = ptsA[0];
    const aEnd = ptsA[ptsA.length - 1];
    const bStart = ptsB[0];
    const bEnd = ptsB[ptsB.length - 1];

    const dEndToStart = Math.hypot(aEnd.x - bStart.x, aEnd.y - bStart.y);
    const dEndToEnd = Math.hypot(aEnd.x - bEnd.x, aEnd.y - bEnd.y);
    const dStartToStart = Math.hypot(aStart.x - bStart.x, aStart.y - bStart.y);
    const dStartToEnd = Math.hypot(aStart.x - bEnd.x, aStart.y - bEnd.y);

    let mergedPoints: FieldPoint2D[];
    const minD = Math.min(dEndToStart, dEndToEnd, dStartToStart, dStartToEnd);

    if (minD === dEndToStart) {
      mergedPoints = [...ptsA, ...ptsB];
    } else if (minD === dEndToEnd) {
      mergedPoints = [...ptsA, ...ptsB.slice().reverse()];
    } else if (minD === dStartToStart) {
      mergedPoints = [...ptsA.slice().reverse(), ...ptsB];
    } else {
      mergedPoints = [...ptsB, ...ptsA];
    }

    const smoothedMerged = smoothFieldPencilStroke(mergedPoints);
    const targetPanel = traceA.panel;
    const ori = computeTraceOrientationFromTunnelDrive(
      smoothedMerged,
      targetPanel,
      activeRound.tunnelDriveDirection,
      traceA.crownDipSign,
      activeLocation.widthM,
      activeLocation.heightM
    );
    const metricPoints = computePhysicalMetricPoints(
      smoothedMerged,
      targetPanel,
      activeLocation,
      activeRound
    );

    const mergedLabel =
      traceA.label && traceB.label && traceA.label !== traceB.label
        ? `${traceA.label}+${traceB.label}`
        : traceA.label || traceB.label || (traceA.setId === 'unassigned' ? 'J' : traceA.setId);

    onUpdateRound((r) => ({
      ...r,
      jointTraces: r.jointTraces
        .filter((t) => t.id !== realBId)
        .map((t) =>
          t.id === realAId
            ? {
                ...t,
                label: mergedLabel,
                points: smoothedMerged,
                metricPoints,
                dipDirection: t.editedByCompass ? t.dipDirection : ori.dipDirection,
                dipAmount: t.editedByCompass ? t.dipAmount : ori.dipAmount,
                strike: t.editedByCompass ? t.strike : ori.strike,
                traceLengthM: ori.traceLengthM,
              }
            : t
        ),
    }));

    setSelectedTraceItem({
      id: realAId,
      kind: 'joint',
      panel: traceA.panel === 'face' ? 'crown' : (traceA.panel as 'left_wall' | 'crown' | 'right_wall'),
    });
    setIsJoinMode(false);
    setJoinFirstTraceId(null);
  };

  // Find closest normalized ratio (0..1) along a strip polyline to a given strip coordinate
  const findClosestRatioOnStripPolyline = (
    stripPts: FieldPoint2D[],
    target: FieldPoint2D
  ): number => {
    if (stripPts.length < 2) return 0.5;
    let bestIdx = Math.floor(stripPts.length / 2);
    let bestDist = Infinity;
    for (let i = 0; i < stripPts.length; i++) {
      const d = Math.hypot(stripPts[i].x - target.x, stripPts[i].y - target.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return Math.max(0.1, Math.min(0.9, bestIdx / Math.max(1, stripPts.length - 1)));
  };

  // Add a control point on a joint at a given normalized ratio (or at the midpoint of the longest segment)
  const addControlPointToJoint = (item: StripAlignableItem, customRatio?: number): {
    ratio: number;
    idx: number;
  } => {
    const key = `${item.kind}:${item.id}`;
    const existing = addedJointPointsMap[key] || [];
    let newRatio = customRatio;
    if (newRatio === undefined) {
      const allStops = [0, ...existing.slice().sort((a, b) => a - b), 1];
      let bestGap = -1;
      let bestMid = 0.5;
      for (let i = 0; i < allStops.length - 1; i++) {
        const gap = allStops[i + 1] - allStops[i];
        if (gap > bestGap) {
          bestGap = gap;
          bestMid = (allStops[i] + allStops[i + 1]) / 2;
        }
      }
      newRatio = Number(Math.max(0.1, Math.min(0.9, bestMid)).toFixed(3));
    } else {
      newRatio = Number(Math.max(0.08, Math.min(0.92, newRatio)).toFixed(3));
    }

    // Ensure trace has dense points so bending around the new control point is smooth
    if (item.points.length < 25) {
      const densePts = ensureDensePolylinePoints(item.points, 25);
      onUpdateRound((r) => updateItemPointsInRound(r, item.id, item.kind, densePts));
    }

    const nextList = [...existing, newRatio].sort((a, b) => a - b);
    const insertedIdx = nextList.indexOf(newRatio);
    setAddedJointPointsMap((prev) => ({
      ...prev,
      [key]: nextList,
    }));
    setSelectedControlPointIdx(insertedIdx);
    return { ratio: newRatio, idx: insertedIdx };
  };

  // Remove the currently selected control point from the selected joint
  const removeSelectedControlPoint = () => {
    if (!selectedTraceItem || selectedControlPointIdx === null) return;
    const key = `${selectedTraceItem.kind}:${selectedTraceItem.id}`;
    setAddedJointPointsMap((prev) => {
      const curr = prev[key] || [];
      return {
        ...prev,
        [key]: curr.filter((_, idx) => idx !== selectedControlPointIdx),
      };
    });
    setSelectedControlPointIdx(null);
  };

  // Detect live Seam Bridges (both Aligned and 1-Click Snap Candidates) across Left SPL (crownX) and Right SPL (rightWallX)
  const seamBridges = React.useMemo(() => {
    const bridges: {
      id: string;
      seamX: number;
      sharedY: number;
      itemA: StripAlignableItem;
      endA: 'start' | 'end';
      ptA: FieldPoint2D;
      itemB: StripAlignableItem;
      endB: 'start' | 'end';
      ptB: FieldPoint2D;
      isAligned: boolean;
    }[] = [];

    const scanSeam = (
      seamX: number,
      leftPanel: 'left_wall' | 'crown',
      rightPanel: 'crown' | 'right_wall'
    ) => {
      const lBox = getPanelStripBox(leftPanel);
      const rBox = getPanelStripBox(rightPanel);
      const leftList = alignableItems.filter((it) => it.panel === leftPanel);
      const rightList = alignableItems.filter((it) => it.panel === rightPanel);

      for (const lItem of leftList) {
        const lStart = panelPointToStripPoint(leftPanel, lItem.points[0]);
        const lEnd = panelPointToStripPoint(
          leftPanel,
          lItem.points[lItem.points.length - 1]
        );
        const lEndIdx: 'start' | 'end' = lStart.x >= lEnd.x ? 'start' : 'end';
        const lPt = lEndIdx === 'start' ? lStart : lEnd;
        if (lPt.x < lBox.x + lBox.w * 0.45) continue;

        let bestR: StripAlignableItem | null = null;
        let bestREnd: 'start' | 'end' = 'start';
        let bestRPt: FieldPoint2D = lPt;
        let bestDy = stripH * 0.38;

        for (const rItem of rightList) {
          if (rItem.kind !== lItem.kind) continue;
          const rStart = panelPointToStripPoint(rightPanel, rItem.points[0]);
          const rEnd = panelPointToStripPoint(
            rightPanel,
            rItem.points[rItem.points.length - 1]
          );
          const rEndIdx: 'start' | 'end' = rStart.x <= rEnd.x ? 'start' : 'end';
          const rPt = rEndIdx === 'start' ? rStart : rEnd;
          if (rPt.x > rBox.x + rBox.w * 0.55) continue;
          const dy = Math.abs(lPt.y - rPt.y);
          if (dy < bestDy) {
            bestDy = dy;
            bestR = rItem;
            bestREnd = rEndIdx;
            bestRPt = rPt;
          }
        }

        if (bestR) {
          const isAligned =
            Math.abs(lPt.x - seamX) <= 4.5 &&
            Math.abs(bestRPt.x - seamX) <= 4.5 &&
            Math.abs(lPt.y - bestRPt.y) <= 4.5;
          bridges.push({
            id: `${lItem.id}-${bestR.id}`,
            seamX,
            sharedY: (lPt.y + bestRPt.y) / 2,
            itemA: lItem,
            endA: lEndIdx,
            ptA: lPt,
            itemB: bestR,
            endB: bestREnd,
            ptB: bestRPt,
            isAligned,
          });
        }
      }
    };

    scanSeam(crownX, 'left_wall', 'crown');
    scanSeam(rightWallX, 'crown', 'right_wall');
    return bridges;
  }, [alignableItems, crownX, rightWallX, stripH]);

  // Snap a specific seam bridge candidate in 1 click
  const handleSnapSeamBridge = (bridge: (typeof seamBridges)[number]) => {
    pushUndo();
    const boxA = getPanelStripBox(bridge.itemA.panel);
    const boxB = getPanelStripBox(bridge.itemB.panel);
    const clampedY = Math.max(stripY + 3, Math.min(stripY + stripH - 3, bridge.sharedY));
    const nextPanelA = stripPointToPanelPoint(
      bridge.itemA.panel,
      boxA.x + boxA.w - 1.5,
      clampedY
    );
    const nextPanelB = stripPointToPanelPoint(bridge.itemB.panel, boxB.x + 1.5, clampedY);
    const nextPtsA = deformPolylineEndpointSmoothly(
      bridge.itemA.points,
      bridge.endA,
      nextPanelA.x,
      nextPanelA.y
    );
    const nextPtsB = deformPolylineEndpointSmoothly(
      bridge.itemB.points,
      bridge.endB,
      nextPanelB.x,
      nextPanelB.y
    );
    onUpdateRound((r) => {
      let nextR = updateItemPointsInRound(r, bridge.itemA.id, bridge.itemA.kind, nextPtsA);
      nextR = updateItemPointsInRound(nextR, bridge.itemB.id, bridge.itemB.kind, nextPtsB);
      return nextR;
    });
  };

  // Convert client pointer event to SVG viewBox coordinates (supports Zoom & Pan via getScreenCTM)
  const getStripSvgCoords = (clientX: number, clientY: number): FieldPoint2D => {
    const svg = stripSvgRef.current;
    if (!svg) return { x: 460, y: stripViewBoxH / 2 };
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const tr = pt.matrixTransform(ctm.inverse());
      return { x: tr.x, y: tr.y };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * 920,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * stripViewBoxH,
    };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    stripPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2-Finger Touch Pinch-to-Zoom & 2-Finger Pan
    if (stripPointersRef.current.size >= 2) {
      isStripPinchingRef.current = true;
      setDraggingHandle(null);
      setStripPanDrag(null);
      const pts = Array.from(stripPointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const startDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const startMidX = (p1.x + p2.x) / 2;
      const startMidY = (p1.y + p2.y) / 2;
      stripPinchStateRef.current = {
        startDist,
        startMidX,
        startMidY,
        startZoom: stripZoom,
        startPanX: stripPan.x,
        startPanY: stripPan.y,
      };
      return;
    }

    if (isStripPanMode || e.button === 1) {
      setStripPanDrag({
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: stripPan.x,
        startPanY: stripPan.y,
      });
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (stripPointersRef.current.has(e.pointerId)) {
      stripPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle 2-Finger Touch Pinch-to-Zoom & 2-Finger Pan
    if (stripPointersRef.current.size >= 2 && stripPinchStateRef.current) {
      const pts = Array.from(stripPointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const currDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const currMidX = (p1.x + p2.x) / 2;
      const currMidY = (p1.y + p2.y) / 2;
      const ps = stripPinchStateRef.current;

      const scaleRatio = currDist / ps.startDist;
      const nextZoom = Math.max(0.6, Math.min(5.0, Number((ps.startZoom * scaleRatio).toFixed(3))));
      const svg = stripSvgRef.current;
      const rect = svg?.getBoundingClientRect();
      const viewW = 920 / Math.max(0.5, nextZoom);
      const viewH = stripViewBoxH / Math.max(0.5, nextZoom);
      const panDx = ((ps.startMidX - currMidX) / Math.max(1, rect?.width || 800)) * viewW;
      const panDy = ((ps.startMidY - currMidY) / Math.max(1, rect?.height || 260)) * viewH;
      const normMidX = rect ? (ps.startMidX - rect.left) / Math.max(1, rect.width) - 0.5 : 0;
      const normMidY = rect ? (ps.startMidY - rect.top) / Math.max(1, rect.height) - 0.5 : 0;
      const zoomShiftX = normMidX * (920 / ps.startZoom - 920 / nextZoom);
      const zoomShiftY = normMidY * (stripViewBoxH / ps.startZoom - stripViewBoxH / nextZoom);

      setStripZoom(nextZoom);
      if (nextZoom <= 1) {
        setStripPan({ x: 0, y: 0 });
      } else {
        setStripPan({
          x: Math.max(-440, Math.min(440, ps.startPanX + zoomShiftX + panDx)),
          y: Math.max(-180, Math.min(180, ps.startPanY + zoomShiftY + panDy)),
        });
      }
      return;
    }

    if (isStripPinchingRef.current) return;

    if (stripPanDrag) {
      const svg = stripSvgRef.current;
      const rect = svg?.getBoundingClientRect();
      const viewW = 920 / Math.max(0.5, stripZoom);
      const viewH = stripViewBoxH / Math.max(0.5, stripZoom);
      const dx = ((stripPanDrag.clientX - e.clientX) / Math.max(1, rect?.width || 800)) * viewW;
      const dy = ((stripPanDrag.clientY - e.clientY) / Math.max(1, rect?.height || 260)) * viewH;
      setStripPan({
        x: Math.max(-440, Math.min(440, stripPanDrag.startPanX + dx)),
        y: Math.max(-180, Math.min(180, stripPanDrag.startPanY + dy)),
      });
      return;
    }

    if (!draggingHandle) return;
    const pt = getStripSvgCoords(e.clientX, e.clientY);
    const item = alignableItems.find(
      (it) => it.id === draggingHandle.id && it.kind === draggingHandle.kind
    );
    if (!item) return;

    const itemKey = `${item.kind}:${item.id}`;
    const itemControlRatios = (addedJointPointsMap[itemKey] || []).slice().sort((a, b) => a - b);

    // 1. Move / Slide entire joint trace
    if (draggingHandle.handleType === 'center') {
      const box = getPanelStripBox(item.panel);
      const stripPts = item.points.map((p) => panelPointToStripPoint(item.panel, p));
      let dStripX = pt.x - draggingHandle.lastStripX;
      let dStripY = pt.y - draggingHandle.lastStripY;

      const minX = Math.min(...stripPts.map((p) => p.x));
      const maxX = Math.max(...stripPts.map((p) => p.x));
      const minY = Math.min(...stripPts.map((p) => p.y));
      const maxY = Math.max(...stripPts.map((p) => p.y));

      dStripX = Math.max(box.x + 1.5 - minX, Math.min(box.x + box.w - 1.5 - maxX, dStripX));
      dStripY = Math.max(stripY + 1.5 - minY, Math.min(stripY + stripH - 1.5 - maxY, dStripY));

      let snapIndicator: FieldPoint2D | null = null;
      const shiftedStart = {
        x: stripPts[0].x + dStripX,
        y: stripPts[0].y + dStripY,
      };
      const shiftedEnd = {
        x: stripPts[stripPts.length - 1].x + dStripX,
        y: stripPts[stripPts.length - 1].y + dStripY,
      };

      const checkCenterSeamSnap = (
        endPt: FieldPoint2D,
        seamX: number,
        oppositePanel: 'left_wall' | 'crown' | 'right_wall'
      ) => {
        if (Math.abs(endPt.x - seamX) > 22) return;
        for (const other of alignableItems) {
          if (other.panel !== oppositePanel) continue;
          const oStart = panelPointToStripPoint(other.panel, other.points[0]);
          const oEnd = panelPointToStripPoint(
            other.panel,
            other.points[other.points.length - 1]
          );
          for (const oPt of [oStart, oEnd]) {
            if (Math.abs(oPt.x - seamX) < 22 && Math.abs(oPt.y - endPt.y) < 12) {
              dStripY += oPt.y - endPt.y;
              snapIndicator = { x: seamX, y: oPt.y };
              return;
            }
          }
        }
      };

      if (item.panel === 'left_wall' || item.panel === 'crown') {
        const opp = item.panel === 'left_wall' ? 'crown' : 'left_wall';
        checkCenterSeamSnap(shiftedStart, crownX, opp);
        checkCenterSeamSnap(shiftedEnd, crownX, opp);
      }
      if (item.panel === 'crown' || item.panel === 'right_wall') {
        const opp = item.panel === 'crown' ? 'right_wall' : 'crown';
        checkCenterSeamSnap(shiftedStart, rightWallX, opp);
        checkCenterSeamSnap(shiftedEnd, rightWallX, opp);
      }
      setActiveMagneticSnapPt(snapIndicator);

      const nextPts = stripPts.map((sp) =>
        stripPointToPanelPoint(item.panel, sp.x + dStripX, sp.y + dStripY)
      );
      setDraggingHandle({
        ...draggingHandle,
        lastStripX: draggingHandle.lastStripX + dStripX,
        lastStripY: draggingHandle.lastStripY + dStripY,
      });
      onUpdateRound((r) => updateItemPointsInRound(r, item.id, item.kind, nextPts));
      return;
    }

    // 2. Bend Joint using an added Control Point on the Joint
    if (draggingHandle.handleType === 'bend_point') {
      const box = getPanelStripBox(item.panel);
      const dense = ensureDensePolylinePoints(item.points, 25);
      const n = dense.length;
      const stripPts = dense.map((p) => panelPointToStripPoint(item.panel, p));
      const ratio = draggingHandle.bendRatio ?? 0.5;
      const centerIdx = Math.max(1, Math.min(n - 2, Math.round(ratio * (n - 1))));

      // Find neighboring control points so other bends remain anchored
      const bIdx = draggingHandle.bendPointIdx ?? 0;
      const prevRatio = bIdx > 0 ? itemControlRatios[bIdx - 1] ?? 0 : 0;
      const nextRatio =
        bIdx < itemControlRatios.length - 1 ? itemControlRatios[bIdx + 1] ?? 1 : 1;
      const prevIdx = Math.max(0, Math.min(centerIdx - 1, Math.round(prevRatio * (n - 1))));
      const nextIdx = Math.max(centerIdx + 1, Math.min(n - 1, Math.round(nextRatio * (n - 1))));

      const clampedTargetX = Math.max(box.x + 2, Math.min(box.x + box.w - 2, pt.x));
      const clampedTargetY = Math.max(stripY + 2, Math.min(stripY + stripH - 2, pt.y));
      const currPt = stripPts[centerIdx];
      const dStripX = clampedTargetX - currPt.x;
      const dStripY = clampedTargetY - currPt.y;

      const bentStripPts = stripPts.map((sp, idx) => {
        let w = 0;
        if (idx === centerIdx) {
          w = 1;
        } else if (idx > prevIdx && idx < centerIdx) {
          const u = (idx - prevIdx) / Math.max(1, centerIdx - prevIdx);
          w = 0.5 * (1 - Math.cos(Math.PI * u));
        } else if (idx > centerIdx && idx < nextIdx) {
          const u = (nextIdx - idx) / Math.max(1, nextIdx - centerIdx);
          w = 0.5 * (1 - Math.cos(Math.PI * u));
        }
        return {
          x: Math.max(box.x + 1.5, Math.min(box.x + box.w - 1.5, sp.x + dStripX * w)),
          y: Math.max(stripY + 1.5, Math.min(stripY + stripH - 1.5, sp.y + dStripY * w)),
        };
      });

      const nextPanelPts = bentStripPts.map((sp) =>
        stripPointToPanelPoint(item.panel, sp.x, sp.y)
      );
      onUpdateRound((r) =>
        updateItemPointsInRound(r, item.id, item.kind, smoothFieldPencilStroke(nextPanelPts))
      );
      return;
    }

    // 3. Extend / Move 'start' or 'end' endpoint handle with magnetic seam & neighbor snapping
    let targetStripX = pt.x;
    let targetStripY = pt.y;
    let snapIndicator: FieldPoint2D | null = null;

    if (
      (item.panel === 'left_wall' || item.panel === 'crown') &&
      Math.abs(targetStripX - crownX) < 16
    ) {
      targetStripX = item.panel === 'left_wall' ? crownX - 1.5 : crownX + 1.5;
      snapIndicator = { x: crownX, y: targetStripY };
      const oppositePanel = item.panel === 'left_wall' ? 'crown' : 'left_wall';
      for (const other of alignableItems) {
        if (other.panel !== oppositePanel) continue;
        const oStart = panelPointToStripPoint(other.panel, other.points[0]);
        const oEnd = panelPointToStripPoint(
          other.panel,
          other.points[other.points.length - 1]
        );
        if (Math.abs(oStart.x - crownX) < 20 && Math.abs(oStart.y - targetStripY) < 18) {
          targetStripY = oStart.y;
          snapIndicator = { x: crownX, y: oStart.y };
          break;
        }
        if (Math.abs(oEnd.x - crownX) < 20 && Math.abs(oEnd.y - targetStripY) < 18) {
          targetStripY = oEnd.y;
          snapIndicator = { x: crownX, y: oEnd.y };
          break;
        }
      }
    } else if (
      (item.panel === 'crown' || item.panel === 'right_wall') &&
      Math.abs(targetStripX - rightWallX) < 16
    ) {
      targetStripX = item.panel === 'crown' ? rightWallX - 1.5 : rightWallX + 1.5;
      snapIndicator = { x: rightWallX, y: targetStripY };
      const oppositePanel = item.panel === 'crown' ? 'right_wall' : 'crown';
      for (const other of alignableItems) {
        if (other.panel !== oppositePanel) continue;
        const oStart = panelPointToStripPoint(other.panel, other.points[0]);
        const oEnd = panelPointToStripPoint(
          other.panel,
          other.points[other.points.length - 1]
        );
        if (Math.abs(oStart.x - rightWallX) < 20 && Math.abs(oStart.y - targetStripY) < 18) {
          targetStripY = oStart.y;
          snapIndicator = { x: rightWallX, y: oStart.y };
          break;
        }
        if (Math.abs(oEnd.x - rightWallX) < 20 && Math.abs(oEnd.y - targetStripY) < 18) {
          targetStripY = oEnd.y;
          snapIndicator = { x: rightWallX, y: oEnd.y };
          break;
        }
      }
    }

    setActiveMagneticSnapPt(snapIndicator);
    const panelPt = stripPointToPanelPoint(item.panel, targetStripX, targetStripY);
    const anchorRatio =
      itemControlRatios.length > 0
        ? draggingHandle.handleType === 'start'
          ? itemControlRatios[0]
          : itemControlRatios[itemControlRatios.length - 1]
        : undefined;
    const nextPts = deformPolylineEndpointSmoothly(
      item.points,
      draggingHandle.handleType,
      panelPt.x,
      panelPt.y,
      anchorRatio
    );
    onUpdateRound((r) => updateItemPointsInRound(r, item.id, item.kind, nextPts));
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    stripPointersRef.current.delete(e.pointerId);
    setActiveMagneticSnapPt(null);
    if (stripPointersRef.current.size < 2) {
      stripPinchStateRef.current = null;
    }
    if (isStripPinchingRef.current) {
      if (stripPointersRef.current.size === 0) {
        isStripPinchingRef.current = false;
      }
      setDraggingHandle(null);
      setStripPanDrag(null);
      return;
    }
    if (stripPanDrag) {
      setStripPanDrag(null);
    }
    if (draggingHandle) {
      setDraggingHandle(null);
    }
  };

  const activeSelectedTraceObj = selectedTraceItem
    ? alignableItems.find(
        (it) => it.id === selectedTraceItem.id && it.kind === selectedTraceItem.kind
      ) || null
    : null;

  // Interactive handles + 1-Click Seam Bridge Snap Indicators overlaid directly on the Strip
  const interactiveHandlesOverlay = (
    <g>
      {/* 1. Seam Bridge Indicators (Aligned Green Locks & 1-Click Cyan Magnetic Snap Targets) */}
      {seamBridges.map((b) => {
        if (b.isAligned) {
          return (
            <g key={`bridge-${b.id}`} pointerEvents="none">
              <circle
                cx={b.seamX}
                cy={b.sharedY}
                r={5.5}
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth="1.5"
                opacity="0.92"
              />
              <circle cx={b.seamX} cy={b.sharedY} r={2} fill="#ffffff" />
            </g>
          );
        }
        return (
          <g
            key={`bridge-${b.id}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleSnapSeamBridge(b);
            }}
            className="cursor-pointer"
          >
            <title>Click to snap &amp; align these two trace ends at the SPL seam</title>
            <line
              x1={b.ptA.x}
              y1={b.ptA.y}
              x2={b.ptB.x}
              y2={b.ptB.y}
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="3 2"
              opacity="0.85"
            />
            <circle
              cx={b.seamX}
              cy={b.sharedY}
              r={7.5}
              fill="#06b6d4"
              stroke="#0f172a"
              strokeWidth="1.8"
            />
            <text
              x={b.seamX}
              y={b.sharedY + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="900"
              fill="#0f172a"
            >
              ⚡
            </text>
          </g>
        );
      })}

      {/* 2. Joint Trace Hit Path, Added Bend Points, Midpoint '+' Add-Point Handles, and Start/End Extend Handles */}
      {alignableItems.map((item) => {
        const stripPolylinePts = item.points.map((p) => panelPointToStripPoint(item.panel, p));
        const startPt = stripPolylinePts[0];
        const endPt = stripPolylinePts[stripPolylinePts.length - 1];
        const isTraceSelected =
          selectedTraceItem?.id === item.id && selectedTraceItem?.kind === item.kind;
        const itemKey = `${item.kind}:${item.id}`;
        const controlRatios = (addedJointPointsMap[itemKey] || []).slice().sort((a, b) => a - b);

        // Compute midpoint '+' candidate ratios between existing stops [0, ...controlRatios, 1]
        const allStops = [0, ...controlRatios, 1];
        const addCandidateRatios: number[] = [];
        for (let i = 0; i < allStops.length - 1; i++) {
          const gap = allStops[i + 1] - allStops[i];
          if (gap >= 0.18) {
            addCandidateRatios.push(Number(((allStops[i] + allStops[i + 1]) / 2).toFixed(3)));
          }
        }

        const getPointAtRatio = (ratio: number): FieldPoint2D => {
          const idx = Math.max(
            0,
            Math.min(
              stripPolylinePts.length - 1,
              Math.round(ratio * (stripPolylinePts.length - 1))
            )
          );
          return stripPolylinePts[idx];
        };

        const onEndpointPointerDown = (
          e: React.PointerEvent<SVGElement>,
          endIndex: 'start' | 'end'
        ) => {
          e.stopPropagation();
          setSelectedTraceItem({ id: item.id, kind: item.kind, panel: item.panel });
          setSelectedControlPointIdx(null);
          pushUndo();
          const pt = getStripSvgCoords(e.clientX, e.clientY);
          setDraggingHandle({
            id: item.id,
            kind: item.kind,
            panel: item.panel,
            handleType: pointActionMode === 'move' ? 'center' : endIndex,
            lastStripX: pt.x,
            lastStripY: pt.y,
          });
        };

        const onBendPointPointerDown = (
          e: React.PointerEvent<SVGGElement>,
          bendIdx: number,
          ratio: number
        ) => {
          e.stopPropagation();
          setSelectedTraceItem({ id: item.id, kind: item.kind, panel: item.panel });
          setSelectedControlPointIdx(bendIdx);
          pushUndo();
          const pt = getStripSvgCoords(e.clientX, e.clientY);
          if (pointActionMode === 'move') {
            setDraggingHandle({
              id: item.id,
              kind: item.kind,
              panel: item.panel,
              handleType: 'center',
              lastStripX: pt.x,
              lastStripY: pt.y,
            });
            return;
          }
          if (pointActionMode === 'extend') {
            const dStart = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
            const dEnd = Math.hypot(pt.x - endPt.x, pt.y - endPt.y);
            setDraggingHandle({
              id: item.id,
              kind: item.kind,
              panel: item.panel,
              handleType: dStart <= dEnd ? 'start' : 'end',
              lastStripX: pt.x,
              lastStripY: pt.y,
            });
            return;
          }
          setDraggingHandle({
            id: item.id,
            kind: item.kind,
            panel: item.panel,
            handleType: 'bend_point',
            bendPointIdx: bendIdx,
            bendRatio: ratio,
            lastStripX: pt.x,
            lastStripY: pt.y,
          });
        };

        const onLinePointerDown = (e: React.PointerEvent<SVGElement>) => {
          e.stopPropagation();
          if (isJoinMode && joinFirstTraceId) {
            if (item.id !== joinFirstTraceId && (item.kind === 'joint' || item.kind === 'vein')) {
              handleJoinJoints(joinFirstTraceId, item.id);
            }
            return;
          }
          setSelectedTraceItem({ id: item.id, kind: item.kind, panel: item.panel });
          const pt = getStripSvgCoords(e.clientX, e.clientY);
          pushUndo();

          // When in '+ Add Point' mode, clicking anywhere along the joint adds a point there and starts bending immediately
          if (pointActionMode === 'add_point') {
            const clickedRatio = findClosestRatioOnStripPolyline(stripPolylinePts, pt);
            const added = addControlPointToJoint(item, clickedRatio);
            setPointActionMode('bend');
            setDraggingHandle({
              id: item.id,
              kind: item.kind,
              panel: item.panel,
              handleType: 'bend_point',
              bendPointIdx: added.idx,
              bendRatio: added.ratio,
              lastStripX: pt.x,
              lastStripY: pt.y,
            });
            return;
          }

          if (pointActionMode === 'extend') {
            const dStart = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
            const dEnd = Math.hypot(pt.x - endPt.x, pt.y - endPt.y);
            setDraggingHandle({
              id: item.id,
              kind: item.kind,
              panel: item.panel,
              handleType: dStart <= dEnd ? 'start' : 'end',
              lastStripX: pt.x,
              lastStripY: pt.y,
            });
            return;
          }

          // Default when dragging the line itself: Move the whole joint
          setDraggingHandle({
            id: item.id,
            kind: item.kind,
            panel: item.panel,
            handleType: 'center',
            lastStripX: pt.x,
            lastStripY: pt.y,
          });
        };

        const ptsAttr = stripPolylinePts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ');

        return (
          <g key={`${item.kind}-${item.id}`}>
            {/* Join Mode First Selected Trace Pulsing Outline */}
            {isJoinMode && joinFirstTraceId === item.id && (
              <polyline
                points={ptsAttr}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="10"
                strokeDasharray="6,4"
                className="animate-pulse"
                pointerEvents="none"
              />
            )}

            {/* Selection Halo & Wide Invisible Hit Target */}
            {isTraceSelected && (
              <polyline
                points={ptsAttr}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
                pointerEvents="none"
              />
            )}
            <polyline
              points={ptsAttr}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={onLinePointerDown}
              className={
                isJoinMode
                  ? 'cursor-pointer'
                  : pointActionMode === 'add_point'
                  ? 'cursor-crosshair'
                  : 'cursor-move'
              }
            />

            {/* DISCIPLINE: Handles (Start/Open, End, Bend Points, Add Handles) ONLY shown on the SELECTED item */}
            {isTraceSelected && (
              <>
                {/* '+' Add-Point Handles along the joint (tap or drag to add a point on the joint and bend/move/extend it) */}
                {addCandidateRatios.map((candRatio) => {
                  const candPt = getPointAtRatio(candRatio);
                  return (
                    <g
                      key={`add-pt-${item.id}-${candRatio}`}
                      transform={`translate(${candPt.x.toFixed(1)}, ${candPt.y.toFixed(1)})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedTraceItem({ id: item.id, kind: item.kind, panel: item.panel });
                        pushUndo();
                        const pt = getStripSvgCoords(e.clientX, e.clientY);
                        const added = addControlPointToJoint(item, candRatio);
                        if (pointActionMode === 'add_point') {
                          setPointActionMode('bend');
                        }
                        setDraggingHandle({
                          id: item.id,
                          kind: item.kind,
                          panel: item.panel,
                          handleType: pointActionMode === 'move' ? 'center' : 'bend_point',
                          bendPointIdx: added.idx,
                          bendRatio: added.ratio,
                          lastStripX: pt.x,
                          lastStripY: pt.y,
                        });
                      }}
                      className="cursor-pointer"
                    >
                      <title>Tap or drag to add a point on this joint to bend, move, or extend it</title>
                      <circle cx="0" cy="0" r={6.5} fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
                      <path d="M -3 0 L 3 0 M 0 -3 L 0 3" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
                    </g>
                  );
                })}

                {/* Added Control Points on the Joint (Drag to Bend / Move / Extend) */}
                {controlRatios.map((ratio, bIdx) => {
                  const bPt = getPointAtRatio(ratio);
                  const isPtSel = selectedControlPointIdx === bIdx;
                  return (
                    <g
                      key={`bend-pt-${item.id}-${bIdx}`}
                      transform={`translate(${bPt.x.toFixed(1)}, ${bPt.y.toFixed(1)})`}
                      onPointerDown={(e) => onBendPointPointerDown(e, bIdx, ratio)}
                      className="cursor-pointer"
                    >
                      <title>Drag point to bend, move, or extend joint</title>
                      <circle
                        cx="0"
                        cy="0"
                        r={isPtSel ? 8 : 6.8}
                        fill={isPtSel ? '#8b5cf6' : '#0284c7'}
                        stroke="#fde047"
                        strokeWidth="2.2"
                      />
                      <circle cx="0" cy="0" r="2.3" fill="#ffffff" />
                    </g>
                  );
                })}

                {/* Start Endpoint Handle (Open Point - Yellow/Amber) */}
                <g onPointerDown={(e) => onEndpointPointerDown(e, 'start')} className="cursor-pointer">
                  <circle
                    cx={startPt.x}
                    cy={startPt.y}
                    r={7.5}
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth="2.2"
                  />
                  <circle cx={startPt.x} cy={startPt.y} r={2.5} fill="#ffffff" />
                  <title>Start / Open Point: Drag to extend or align joint</title>
                </g>

                {/* End Endpoint Handle (Green) */}
                <g onPointerDown={(e) => onEndpointPointerDown(e, 'end')} className="cursor-pointer">
                  <circle
                    cx={endPt.x}
                    cy={endPt.y}
                    r={7.5}
                    fill="#10b981"
                    stroke="#0f172a"
                    strokeWidth="2.2"
                  />
                  <circle cx={endPt.x} cy={endPt.y} r={2.5} fill="#ffffff" />
                  <title>End Point: Drag to extend or align joint</title>
                </g>
              </>
            )}
          </g>
        );
      })}

      {/* 3. Active Magnetic Seam Snap Target Ring */}
      {activeMagneticSnapPt && (
        <g pointerEvents="none">
          <circle
            cx={activeMagneticSnapPt.x}
            cy={activeMagneticSnapPt.y}
            r={12}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeDasharray="3 2"
          />
          <circle
            cx={activeMagneticSnapPt.x}
            cy={activeMagneticSnapPt.y}
            r={4.5}
            fill="#10b981"
          />
        </g>
      )}
    </g>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-3 overflow-y-auto bg-slate-950 touch-pan-y">
      {/* Top Joint & Element Bar: Add Point • Bend • Move • Extend • Join Joints */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (activeSelectedTraceObj) {
                pushUndo();
                addControlPointToJoint(activeSelectedTraceObj);
                setPointActionMode('bend');
              } else {
                setPointActionMode((prev) => (prev === 'add_point' ? 'bend' : 'add_point'));
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              pointActionMode === 'add_point'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'bg-slate-800 text-sky-300 hover:bg-slate-700 border border-sky-500/40'
            }`}
            title="Tap a joint (or click here when a joint is selected) to add a point on the joint"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Point on Joint
          </button>

          <button
            type="button"
            onClick={() => setPointActionMode('bend')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              pointActionMode === 'bend'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Drag any point on the joint to bend it"
          >
            Bend
          </button>

          <button
            type="button"
            onClick={() => setPointActionMode('move')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              pointActionMode === 'move'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Drag any point or line to move the joint"
          >
            <Move className="w-3.5 h-3.5" />
            Move
          </button>

          <button
            type="button"
            onClick={() => setPointActionMode('extend')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              pointActionMode === 'extend'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Drag endpoint to extend the joint"
          >
            Extend
          </button>

          {/* Join Joints Button */}
          <button
            type="button"
            onClick={() => {
              if (isJoinMode) {
                setIsJoinMode(false);
                setJoinFirstTraceId(null);
              } else {
                setIsJoinMode(true);
                if (
                  selectedTraceItem &&
                  (selectedTraceItem.kind === 'joint' || selectedTraceItem.kind === 'vein')
                ) {
                  const isProj = selectedTraceItem.id.startsWith('proj-');
                  const realId = isProj
                    ? selectedTraceItem.id.replace(/^proj-(lw|cr|rw)-/, '')
                    : selectedTraceItem.id;
                  setJoinFirstTraceId(realId);
                }
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isJoinMode
                ? 'bg-sky-500 text-slate-950 shadow ring-2 ring-sky-300 font-black animate-pulse'
                : 'bg-slate-800 text-sky-300 hover:bg-slate-700 border border-sky-500/40'
            }`}
            title="Connect / Join two joints into a single continuous trace"
          >
            <GitMerge className="w-3.5 h-3.5" />
            {isJoinMode ? 'Joining Active...' : 'Join Joints'}
          </button>

          {selectedTraceItem && selectedControlPointIdx !== null && (
            <button
              type="button"
              onClick={removeSelectedControlPoint}
              className="px-2 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              title="Remove selected point from joint"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Point
            </button>
          )}

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>

          {/* Strip Canvas Touch Pinch / PC Scroll Zoom Status & Reset Pill */}
          <div className="inline-flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-700 gap-0.5">
            <button
              type="button"
              onClick={() => {
                setStripZoom(1);
                setStripPan({ x: 0, y: 0 });
                setIsStripPanMode(false);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
              title="Pinch with 2 fingers or Scroll on PC to Zoom. Tap to Reset to 100%."
            >
              {Math.round(stripZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setIsStripPanMode((p) => !p)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${
                isStripPanMode
                  ? 'bg-sky-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle 1-Finger Pan Strip Canvas"
            >
              <Move className="w-3 h-3" />
              <span>Pan</span>
            </button>
          </div>

          {/* Realtime 2-Way Portion Sync Indicator: Face Canvas ↔ Strip Log */}
          <div
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[10.5px] font-mono text-emerald-300 font-bold"
            title="Real-time background sync active: Face Canvas joint traces and unwrapped strip portions synchronized with metric coordinates (x, y)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Face ↔ Strip Sync Active ({activeRound.jointTraces.length} Traces)</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToCanvas}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Canvas
          </button>
          <button
            type="button"
            onClick={onCompleteAndContinue}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Next: Parameters →
          </button>
        </div>
      </div>

      {/* 1. Join Mode Active Alert Banner */}
      {isJoinMode && (
        <div className="bg-sky-950/90 border border-sky-500/60 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-sky-200 text-xs shrink-0 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
            <span>
              <strong>Join Mode Active:</strong>{' '}
              {joinFirstTraceId ? (
                <>
                  First joint selected (
                  <span className="font-mono font-bold text-amber-300">
                    {activeRound.jointTraces.find((t) => t.id === joinFirstTraceId)?.label ||
                      joinFirstTraceId}
                  </span>
                  ). Click the second joint on the strip log to connect them into a single joint!
                </>
              ) : (
                'Click the first joint to start, then click the second joint to connect them.'
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsJoinMode(false);
              setJoinFirstTraceId(null);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700"
          >
            Cancel Join
          </button>
        </div>
      )}

      {/* 2. Interactive Strip Item Inspector Card (Edit Joint Text, Set, Dip, Lithology, Dip Surface) */}
      {selectedTraceItem && activeSelectedTraceObj && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shrink-0 shadow-xl space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeSelectedTraceObj.color }}
              />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {selectedTraceItem.kind === 'joint'
                  ? 'Joint Trace Inspector'
                  : selectedTraceItem.kind === 'vein'
                  ? 'Vein / Foliation Inspector'
                  : 'Structural Feature Inspector'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {selectedTraceItem.panel.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTraceItem(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              title="Close inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Joint Inspector Body */}
          {selectedTraceItem.kind === 'joint' && (() => {
            const isProj = selectedTraceItem.id.startsWith('proj-');
            const realId = isProj
              ? selectedTraceItem.id.replace(/^proj-(lw|cr|rw)-/, '')
              : selectedTraceItem.id;
            const tr = activeRound.jointTraces.find((t) => t.id === realId);
            if (!tr) return null;

            return (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
                {/* Joint Label / Text Input */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Text / ID:</span>
                  <input
                    type="text"
                    value={tr.label || ''}
                    onChange={(e) => {
                      const nextLabel = e.target.value;
                      onUpdateRound((r) => ({
                        ...r,
                        jointTraces: r.jointTraces.map((t) =>
                          t.id === realId ? { ...t, label: nextLabel } : t
                        ),
                      }));
                    }}
                    placeholder="e.g. J1, Fault-1"
                    className="bg-slate-950 border border-slate-700 focus:border-amber-400 rounded px-2 py-1 text-white text-xs font-mono w-28 focus:outline-none"
                  />
                </div>

                {/* Joint Set Selector */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-slate-400 font-medium">Set:</span>
                  {(
                    [
                      'unassigned',
                      'J1',
                      'J2',
                      'J3',
                      'J4',
                      'J5',
                      'JR1',
                      'JR2',
                      'J-Bedding',
                      'J-Random',
                    ] as FieldJointGroupingId[]
                  ).map((setId) => {
                    const isCur = tr.setId === setId;
                    const col = FIELD_JOINT_GROUP_COLORS[setId]?.stroke || '#0f172a';
                    return (
                      <button
                        key={setId}
                        type="button"
                        onClick={() => {
                          pushUndo();
                          onUpdateRound((r) => ({
                            ...r,
                            jointTraces: r.jointTraces.map((t) =>
                              t.id === realId
                                ? {
                                    ...t,
                                    setId,
                                    label:
                                      setId === 'unassigned'
                                        ? 'J'
                                        : t.label && t.label !== 'J'
                                        ? t.label
                                        : setId,
                                  }
                                : t
                            ),
                          }));
                        }}
                        style={{
                          borderColor: isCur ? col : undefined,
                          backgroundColor: isCur ? `${col}33` : undefined,
                          color: isCur ? '#ffffff' : '#94a3b8',
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isCur
                            ? 'font-black shadow'
                            : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                        } cursor-pointer transition-colors`}
                      >
                        {setId === 'unassigned' ? 'Unassigned' : setId}
                      </button>
                    );
                  })}
                </div>

                {/* Dip Direction & Dip Amount Steppers */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-medium">Dip Dir:</span>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo();
                        const nextDipDir = (tr.dipDirection - 5 + 360) % 360;
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId
                              ? { ...t, dipDirection: nextDipDir, editedByCompass: true }
                              : t
                          ),
                        }));
                      }}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={tr.dipDirection}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId ? { ...t, dipDirection: val, editedByCompass: true } : t
                          ),
                        }));
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-amber-300 font-mono font-bold text-xs w-14 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo();
                        const nextDipDir = (tr.dipDirection + 5) % 360;
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId
                              ? { ...t, dipDirection: nextDipDir, editedByCompass: true }
                              : t
                          ),
                        }));
                      }}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-slate-500 text-[10px]">°</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-medium">Dip Amt:</span>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo();
                        const nextDipAmt = Math.max(0, tr.dipAmount - 5);
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId
                              ? { ...t, dipAmount: nextDipAmt, editedByCompass: true }
                              : t
                          ),
                        }));
                      }}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={tr.dipAmount}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(90, Number(e.target.value) || 0));
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId ? { ...t, dipAmount: val, editedByCompass: true } : t
                          ),
                        }));
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-amber-300 font-mono font-bold text-xs w-12 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        pushUndo();
                        const nextDipAmt = Math.min(90, tr.dipAmount + 5);
                        onUpdateRound((r) => ({
                          ...r,
                          jointTraces: r.jointTraces.map((t) =>
                            t.id === realId
                              ? { ...t, dipAmount: nextDipAmt, editedByCompass: true }
                              : t
                          ),
                        }));
                      }}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-slate-500 text-[10px]">°</span>
                  </div>
                </div>

                {/* Quick Joint Actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      addControlPointToJoint(activeSelectedTraceObj);
                      setPointActionMode('bend');
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Add an interior control point to bend this joint"
                  >
                    <Plus className="w-3 h-3" />
                    Bend Point
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      const revPts = tr.points.slice().reverse();
                      const ori = computeTraceOrientationFromTunnelDrive(
                        revPts,
                        tr.panel,
                        activeRound.tunnelDriveDirection,
                        tr.crownDipSign,
                        activeLocation.widthM,
                        activeLocation.heightM
                      );
                      const metricPoints = computePhysicalMetricPoints(
                        revPts,
                        tr.panel,
                        activeLocation,
                        activeRound
                      );
                      onUpdateRound((r) => ({
                        ...r,
                        jointTraces: r.jointTraces.map((t) =>
                          t.id === realId
                            ? {
                                ...t,
                                points: revPts,
                                metricPoints,
                                dipDirection: t.editedByCompass ? t.dipDirection : ori.dipDirection,
                                dipAmount: t.editedByCompass ? t.dipAmount : ori.dipAmount,
                                strike: t.editedByCompass ? t.strike : ori.strike,
                                traceLengthM: ori.traceLengthM,
                              }
                            : t
                        ),
                      }));
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Reverse endpoints of this joint trace"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reverse
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsJoinMode(true);
                      setJoinFirstTraceId(realId);
                    }}
                    className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Connect this joint with another joint into a single trace"
                  >
                    <GitMerge className="w-3 h-3" />
                    Join...
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      onUpdateRound((r) => ({
                        ...r,
                        jointTraces: r.jointTraces.filter((t) => t.id !== realId),
                      }));
                      setSelectedTraceItem(null);
                    }}
                    className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Delete this joint"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Vein / Foliation Inspector Body */}
          {selectedTraceItem.kind === 'vein' && (() => {
            const st = activeRound.lithologyStrokes.find((s) => s.id === selectedTraceItem.id);
            if (!st) return null;

            return (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Band Name:</span>
                  <input
                    type="text"
                    value={st.rockName || ''}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      onUpdateRound((r) => ({
                        ...r,
                        lithologyStrokes: r.lithologyStrokes.map((s) =>
                          s.id === st.id ? { ...s, rockName: nextName } : s
                        ),
                      }));
                    }}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono w-32 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Thickness:</span>
                  <input
                    type="range"
                    min="8"
                    max="80"
                    step="2"
                    value={st.bandThicknessPx ?? st.brushRadius * 2}
                    onChange={(e) => {
                      const nextThick = Number(e.target.value);
                      onUpdateRound((r) => ({
                        ...r,
                        lithologyStrokes: r.lithologyStrokes.map((s) =>
                          s.id === st.id ? { ...s, bandThicknessPx: nextThick } : s
                        ),
                      }));
                    }}
                    className="w-24 accent-teal-500 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-teal-400">
                    {st.bandThicknessPx ?? st.brushRadius * 2}px
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    pushUndo();
                    onUpdateRound((r) => ({
                      ...r,
                      lithologyStrokes: r.lithologyStrokes.filter((s) => s.id !== st.id),
                    }));
                    setSelectedTraceItem(null);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Band
                </button>
              </div>
            );
          })()}

          {/* Feature Inspector Body */}
          {selectedTraceItem.kind === 'feature' && (() => {
            const ft = (activeRound.structuralFeatures || []).find(
              (f) => f.id === selectedTraceItem.id
            );
            if (!ft) return null;

            return (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Label:</span>
                  <input
                    type="text"
                    value={ft.label || ''}
                    onChange={(e) => {
                      const nextLabel = e.target.value;
                      onUpdateRound((r) => ({
                        ...r,
                        structuralFeatures: (r.structuralFeatures || []).map((f) =>
                          f.id === ft.id ? { ...f, label: nextLabel } : f
                        ),
                      }));
                    }}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono w-28 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Type:</span>
                  <span className="font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                    {ft.featureType.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-amber-300 font-mono font-bold">
                  <span>
                    {ft.dipDirection}°/{ft.dipAmount}°
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    pushUndo();
                    onUpdateRound((r) => ({
                      ...r,
                      structuralFeatures: (r.structuralFeatures || []).filter(
                        (f) => f.id !== ft.id
                      ),
                    }));
                    setSelectedTraceItem(null);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Feature
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Direct Unfolded Strip Canvas (No outer enclosing box around the strip) */}
      <div
        ref={stripWrapperRef}
        className="flex-1 min-h-0 bg-slate-200 overflow-hidden flex items-center justify-center touch-none"
      >
        <FieldUnfoldedSheetSvgPreview
          svgRef={stripSvgRef}
          location={activeLocation}
          round={activeRound}
          rememberedRocks={rememberedRocks}
          colorMode="color"
          topStripOnly={true}
          customViewBox={`${(460 - 460 / stripZoom + stripPan.x).toFixed(1)} ${(
            stripViewBoxH / 2 -
            stripViewBoxH / (2 * stripZoom) +
            stripPan.y
          ).toFixed(1)} ${(920 / stripZoom).toFixed(1)} ${(stripViewBoxH / stripZoom).toFixed(1)}`}
          interactiveOverlay={interactiveHandlesOverlay}
          onSvgPointerDown={handleSvgPointerDown}
          onSvgPointerMove={handleSvgPointerMove}
          onSvgPointerUp={handleSvgPointerUp}
        />
      </div>
    </div>
  );
};

// ============================================================================
// STAGE 6: DISCONTINUITY PARAMETERS + SELECTIVE Q, RMR, GSI CALCULATOR
// ============================================================================
export const FieldDiscontinuityAndClassificationsStage: React.FC<{
  activeRound: FieldExcavationRound;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onUpdateSetRecord: (
    setId: FieldJointSetId,
    patch: Partial<FieldDiscontinuitySetRecord>
  ) => void;
  onBackToStripAlign: () => void;
  onContinueToReport: () => void;
}> = ({
  activeRound,
  onUpdateRound,
  onUpdateSetRecord,
  onBackToStripAlign,
  onContinueToReport,
}) => {
  const qRes = computeFieldQValue(activeRound.qSystem);
  const rmrRes = computeFieldRmrValue(activeRound.rmrSystem);
  const selClass = activeRound.selectedClassifications || {
    q: true,
    rmr: true,
    gsi: true,
  };

  const toggleClassification = (key: 'q' | 'rmr' | 'gsi') => {
    onUpdateRound((r) => {
      const curr = r.selectedClassifications || { q: true, rmr: true, gsi: true };
      return {
        ...r,
        selectedClassifications: {
          ...curr,
          [key]: !curr[key],
        },
      };
    });
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2 sm:p-3 overflow-y-auto lg:overflow-hidden bg-slate-950 touch-pan-y">
      {/* Left 7 Columns: Discontinuity Sets J1..J5, J-Bedding, J-Random */}
      <div className="lg:col-span-7 min-h-[280px] lg:min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400">
              1. Discontinuity Sets Parameters (J1–J5, J-Bedding, J-Random)
            </h2>
            <p className="text-[11px] text-slate-400">
              Dip Direction &amp; Dip Amount (From° – To°) are auto-calculated from your grouped traces &amp; dip surfaces, or editable directly.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded shrink-0">
            Mapped: {activeRound.jointTraces.length} Traces •{' '}
            {activeRound.dipPlaneSurfaces.length} Surfaces
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 touch-pan-y">
          {(() => {
            const hasMappedJoints =
              activeRound.jointTraces.length > 0 || activeRound.dipPlaneSurfaces.length > 0;
            const availableSets = FIELD_JOINT_SET_IDS.filter((setId) => {
              const countInSet =
                activeRound.jointTraces.filter((j) => j.setId === setId).length +
                activeRound.dipPlaneSurfaces.filter((d) => d.setId === setId).length;
              return (
                countInSet > 0 ||
                activeRound.discontinuitySets[setId]?.manualOrientationOverride ||
                (hasMappedJoints && activeRound.discontinuitySets[setId]?.enabled)
              );
            });

            if (availableSets.length === 0) {
              return (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 text-center space-y-2">
                  <div className="text-xs font-bold text-slate-300">
                    No Grouped Discontinuity Sets Available on Canvas Yet
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Only discontinuity sets (`J1`–`J5`, `JR1`, `JR2`, `J-Bedding`, `J-Random`) that are mapped/grouped on the canvas are shown here.
                  </p>
                </div>
              );
            }

            return availableSets.map((setId) => {
              const rec = activeRound.discontinuitySets[setId];
              const countInSet =
                activeRound.jointTraces.filter((j) => j.setId === setId).length +
                activeRound.dipPlaneSurfaces.filter((d) => d.setId === setId).length;
              const grpColor = FIELD_JOINT_GROUP_COLORS[setId];

              return (
                <div
                  key={setId}
                  className="p-2.5 rounded-xl border transition-all bg-slate-950/90 border-amber-500/40"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded font-black text-xs text-white flex items-center gap-1.5"
                        style={{ backgroundColor: grpColor.stroke }}
                      >
                        {setId}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {countInSet} plotted observation(s) in group
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Dip Dir (°):</span>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={rec.dipDirectionFrom}
                        onChange={(e) =>
                          onUpdateSetRecord(setId, {
                            dipDirectionFrom: Number(e.target.value),
                            manualOrientationOverride: true,
                          })
                        }
                        className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 text-center"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={rec.dipDirectionTo}
                        onChange={(e) =>
                          onUpdateSetRecord(setId, {
                            dipDirectionTo: Number(e.target.value),
                            manualOrientationOverride: true,
                          })
                        }
                        className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-amber-300 text-center"
                      />

                      <span className="text-[10px] text-slate-400 font-semibold ml-2">Dip Amt (°):</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={rec.dipAmountFrom}
                        onChange={(e) =>
                          onUpdateSetRecord(setId, {
                            dipAmountFrom: Number(e.target.value),
                            manualOrientationOverride: true,
                          })
                        }
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 text-center"
                      />
                      <span className="text-slate-500">to</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={rec.dipAmountTo}
                        onChange={(e) =>
                          onUpdateSetRecord(setId, {
                            dipAmountTo: Number(e.target.value),
                            manualOrientationOverride: true,
                          })
                        }
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300 text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                    {/* SPACING (with Custom option) */}
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Spacing
                      </label>
                      <select
                        value={
                          SPACING_OPTIONS.includes(rec.spacing) ? rec.spacing : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            onUpdateSetRecord(setId, {
                              spacing: 'Custom (m/cm)',
                            });
                          } else {
                            onUpdateSetRecord(setId, { spacing: e.target.value });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {SPACING_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value="__custom__">Custom...</option>
                      </select>
                      {!SPACING_OPTIONS.includes(rec.spacing) && (
                        <input
                          type="text"
                          value={rec.spacing}
                          onChange={(e) =>
                            onUpdateSetRecord(setId, {
                              spacing: e.target.value,
                            })
                          }
                          placeholder="Enter custom spacing..."
                          className="mt-1 w-full bg-slate-950 border border-amber-400 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-amber-300"
                        />
                      )}
                    </div>

                    {/* PERSISTENCE (with Custom option) */}
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Persistence
                      </label>
                      <select
                        value={
                          PERSISTENCE_OPTIONS.includes(rec.persistence)
                            ? rec.persistence
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            onUpdateSetRecord(setId, {
                              persistence: 'Custom (m)',
                            });
                          } else {
                            onUpdateSetRecord(setId, { persistence: e.target.value });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {PERSISTENCE_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value="__custom__">Custom...</option>
                      </select>
                      {!PERSISTENCE_OPTIONS.includes(rec.persistence) && (
                        <input
                          type="text"
                          value={rec.persistence}
                          onChange={(e) =>
                            onUpdateSetRecord(setId, {
                              persistence: e.target.value,
                            })
                          }
                          placeholder="Enter custom persistence..."
                          className="mt-1 w-full bg-slate-950 border border-amber-400 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-amber-300"
                        />
                      )}
                    </div>

                    {/* APERTURE (with Custom option) */}
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Aperture
                      </label>
                      <select
                        value={
                          APERTURE_OPTIONS.includes(rec.aperture) ? rec.aperture : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            onUpdateSetRecord(setId, {
                              aperture: 'Custom (mm)',
                            });
                          } else {
                            onUpdateSetRecord(setId, { aperture: e.target.value });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {APERTURE_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value="__custom__">Custom...</option>
                      </select>
                      {!APERTURE_OPTIONS.includes(rec.aperture) && (
                        <input
                          type="text"
                          value={rec.aperture}
                          onChange={(e) =>
                            onUpdateSetRecord(setId, {
                              aperture: e.target.value,
                            })
                          }
                          placeholder="Enter custom aperture..."
                          className="mt-1 w-full bg-slate-950 border border-amber-400 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-amber-300"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Roughness
                      </label>
                      <select
                        value={rec.roughness}
                        onChange={(e) => onUpdateSetRecord(setId, { roughness: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {ROUGHNESS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Infilling
                      </label>
                      <select
                        value={rec.infilling}
                        onChange={(e) => onUpdateSetRecord(setId, { infilling: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {INFILLING_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Weathering
                      </label>
                      <select
                        value={rec.weathering}
                        onChange={(e) => onUpdateSetRecord(setId, { weathering: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {WEATHERING_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-0.5 font-bold">
                        Water
                      </label>
                      <select
                        value={rec.groundwater}
                        onChange={(e) => onUpdateSetRecord(setId, { groundwater: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white"
                      >
                        {GROUNDWATER_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Right 5 Columns: Selective Q, RMR, GSI + Weathering/Strength + Geological Description */}
      <div className="lg:col-span-5 min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-y-auto touch-pan-y">
        <div className="space-y-2.5">
          {/* Choose which Rock Mass Classifications to calculate & include */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
              2. Choose Rock Mass Classifications (Q / RMR / GSI)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleClassification('q')}
                className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selClass.q
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${selClass.q ? 'opacity-100' : 'opacity-20'}`} />
                Q-System
              </button>
              <button
                onClick={() => toggleClassification('rmr')}
                className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selClass.rmr
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${selClass.rmr ? 'opacity-100' : 'opacity-20'}`} />
                RMR89
              </button>
              <button
                onClick={() => toggleClassification('gsi')}
                className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selClass.gsi
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${selClass.gsi ? 'opacity-100' : 'opacity-20'}`} />
                GSI
              </button>
            </div>
          </div>

          {/* Barton Q-System */}
          {selClass.q && (
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase text-amber-400">
                  Barton Q-System (Q = RQD/Jn × Jr/Ja × Jw/SRF)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono font-black text-xs">
                  Q = {qRes.qValue} ({qRes.rockClass})
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-xs">
                {(
                  [
                    ['rqd', 'RQD (%)', 5, 100, 5],
                    ['jn', 'Jn', 0.5, 20, 0.5],
                    ['jr', 'Jr', 0.5, 4, 0.5],
                    ['ja', 'Ja', 0.75, 20, 0.25],
                    ['jw', 'Jw', 0.1, 1, 0.1],
                    ['srf', 'SRF', 0.5, 20, 0.5],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <div key={key}>
                    <label className="block text-[9px] text-slate-400 uppercase mb-0.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={activeRound.qSystem[key]}
                      onChange={(e) =>
                        onUpdateRound((r) => ({
                          ...r,
                          qSystem: {
                            ...r.qSystem,
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-white text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bieniawski RMR89 */}
          {selClass.rmr && (
            <div className="bg-slate-950/90 border border-cyan-500/30 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase text-cyan-400">
                  Bieniawski RMR89 Classification
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-mono font-black text-xs">
                  RMR = {rmrRes.totalRmr} ({rmrRes.rmrClass})
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-xs">
                {(
                  [
                    ['ucsRating', 'UCS (0-15)', 0, 15],
                    ['rqdRating', 'RQD (3-20)', 0, 20],
                    ['spacingRating', 'Spac (5-20)', 0, 20],
                    ['conditionRating', 'Cond (0-30)', 0, 30],
                    ['waterRating', 'Water (0-15)', 0, 15],
                    ['orientationAdj', 'Adj (-12..0)', -25, 0],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <div key={key}>
                    <label className="block text-[9px] text-slate-400 uppercase mb-0.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={activeRound.rmrSystem[key]}
                      onChange={(e) =>
                        onUpdateRound((r) => ({
                          ...r,
                          rmrSystem: {
                            ...r.rmrSystem,
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 font-mono text-white text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hoek-Brown GSI + Weathering & Strength Indices */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 grid grid-cols-3 gap-2">
            {selClass.gsi && (
              <div>
                <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-0.5">
                  GSI Value (10–95)
                </label>
                <input
                  type="number"
                  min={10}
                  max={95}
                  value={activeRound.gsiValue}
                  onChange={(e) =>
                    onUpdateRound((r) => ({ ...r, gsiValue: Number(e.target.value) }))
                  }
                  className="w-full bg-slate-900 border border-emerald-500/40 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-300"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Weathering Index
              </label>
              <select
                value={activeRound.weatheringIndex}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    weatheringIndex: e.target.value as FieldExcavationRound['weatheringIndex'],
                  }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                {(['WI', 'WII', 'WIII', 'WIV', 'WV', 'WVI'] as const).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Strength Index
              </label>
              <select
                value={activeRound.strengthIndex}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    strengthIndex: e.target.value as FieldExcavationRound['strengthIndex'],
                  }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                {(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Geological Description & Support */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Geological Description &amp; Face Condition
              </label>
              <textarea
                rows={2}
                value={activeRound.geologicalDescription}
                onChange={(e) =>
                  onUpdateRound((r) => ({ ...r, geologicalDescription: e.target.value }))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Rock Support Recommendation
              </label>
              <input
                type="text"
                value={activeRound.rockSupportRecommendation}
                onChange={(e) =>
                  onUpdateRound((r) => ({ ...r, rockSupportRecommendation: e.target.value }))
                }
                placeholder="Rock support..."
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[9px] font-bold uppercase text-amber-400 mb-0.5">
                  Contractor Geologist Name &amp; Sign
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={activeRound.contractorGeologistName ?? activeRound.geologistName ?? ''}
                    onChange={(e) =>
                      onUpdateRound((r) => ({
                        ...r,
                        contractorGeologistName: e.target.value,
                        geologistName: e.target.value,
                      }))
                    }
                    placeholder="Name"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={activeRound.contractorGeologistSign ?? ''}
                    onChange={(e) =>
                      onUpdateRound((r) => ({
                        ...r,
                        contractorGeologistSign: e.target.value,
                      }))
                    }
                    placeholder="Sign"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs italic text-amber-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase text-cyan-400 mb-0.5">
                  Client Geologist Name &amp; Sign
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={activeRound.clientGeologistName ?? activeRound.clientRepName ?? ''}
                    onChange={(e) =>
                      onUpdateRound((r) => ({
                        ...r,
                        clientGeologistName: e.target.value,
                        clientRepName: e.target.value,
                      }))
                    }
                    placeholder="Name"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={activeRound.clientGeologistSign ?? ''}
                    onChange={(e) =>
                      onUpdateRound((r) => ({
                        ...r,
                        clientGeologistSign: e.target.value,
                      }))
                    }
                    placeholder="Sign"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs italic text-cyan-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onBackToStripAlign}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Strip Alignment
          </button>
          <button
            onClick={onContinueToReport}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Next: Q, RMR &amp; GSI Sheet →
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// REUSABLE TEMPLATE EDIT PANEL (HEADER LOGOS, MISSING TICK-BOXES, CUSTOM WORD TEMPLATE)
// Only shown and opened when the user explicitly clicks "Template Edit"
// ============================================================================
export const FieldReportTemplateEditorPanel: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateProject: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onClose?: () => void;
  className?: string;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  onUpdateProject,
  onUpdateRound,
  onClose,
  className = '',
}) => {
  const [newTickCategory, setNewTickCategory] = useState('');
  const [newTickOptionsCsv, setNewTickOptionsCsv] = useState('Option A, Option B, Option C');
  const [templateStatus, setTemplateStatus] = useState<string>('');

  const autoDict = buildAutoPopulatedTemplateDictionary(
    activeProject,
    activeLocation,
    activeRound
  );

  const handleLogoUpload = (side: 'left' | 'right', file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      onUpdateProject((p) =>
        side === 'left' ? { ...p, leftLogoDataUrl: dataUrl } : { ...p, rightLogoDataUrl: dataUrl }
      );
    };
    reader.readAsDataURL(file);
  };

  const handleAddMissingTickBoxRow = () => {
    const title = newTickCategory.trim();
    if (!title) return;
    const parsedOptions = newTickOptionsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ label, checked: i === 0 }));
    if (parsedOptions.length === 0) return;

    const newGroup: FieldCustomTickBoxGroup = {
      id: `tbg-${Date.now()}`,
      categoryTitle: title,
      options: parsedOptions,
    };
    onUpdateRound((r) => ({
      ...r,
      customTickBoxGroups: [...(r.customTickBoxGroups || []), newGroup],
    }));
    setNewTickCategory('');
  };

  const handleWordTemplateUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseUploadedWordTemplateFile(file);
      onUpdateProject((p) => ({
        ...p,
        customWordTemplate: parsed,
      }));
      setTemplateStatus(
        `Adapted template "${parsed.fileName}" (${parsed.detectedPlaceholders.length} auto-fed & custom fields active).`
      );
    } catch {
      setTemplateStatus('Could not parse uploaded template file.');
    }
  };

  return (
    <div
      className={`min-h-0 bg-slate-900/95 border border-amber-500/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-3 overflow-y-auto touch-pan-y shadow-2xl ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
        <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Template Edit Options</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold cursor-pointer"
          >
            Close ✕
          </button>
        )}
      </div>

      {/* 1. Upload Client & Contractor Logos for Report Header */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
          <ImageIcon className="w-3.5 h-3.5" />
          1. Report Header Logo Position (Left &amp; Right)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="cursor-pointer py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-center text-xs font-semibold text-slate-200 flex flex-col items-center gap-1">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload Left Logo (Client)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload('left', e.target.files?.[0])}
            />
          </label>
          <label className="cursor-pointer py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-center text-xs font-semibold text-slate-200 flex flex-col items-center gap-1">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Right Logo (Contractor)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload('right', e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {/* 2. Add Missing Data Tick-Box Row to Page 2 */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          2. Add Missing Data Tick-Box to Page 2
        </div>
        <p className="text-[11px] text-slate-400">
          Need an extra tick-box row on Page 2 (e.g. Overbreak Type, Seepage Class, Blasting Quality)? Add it here and tick it directly on the sheet.
        </p>
        <input
          type="text"
          value={newTickCategory}
          onChange={(e) => setNewTickCategory(e.target.value)}
          placeholder="Category Title (e.g. Blasting Half-Cast %)"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
        />
        <input
          type="text"
          value={newTickOptionsCsv}
          onChange={(e) => setNewTickOptionsCsv(e.target.value)}
          placeholder="Comma-separated tick options (e.g. >80%, 50-80%, <50%)"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
        />
        <button
          type="button"
          onClick={handleAddMissingTickBoxRow}
          className="w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Tick-Box Row to Page 2
        </button>
      </div>

      {/* 3. Attach Custom Word Template (.docx / .doc) & Auto-Adapt */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 flex-1 flex flex-col">
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          3. Upload Custom Word Template (Auto-Feed)
        </div>
        <p className="text-[11px] text-slate-400">
          Attach your site Word sheet template. Our engine detects all fields, auto-feeds mapped data, and lets you fill any unmapped fields below.
        </p>
        <label className="cursor-pointer py-2 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          <span>
            {activeProject.customWordTemplate
              ? `Replace Template (${activeProject.customWordTemplate.fileName})`
              : 'Attach Custom Word Sheet Template (.docx / .doc)'}
          </span>
          <input
            type="file"
            accept=".doc,.docx,.xml,.html,.txt"
            className="hidden"
            onChange={(e) => handleWordTemplateUpload(e.target.files?.[0])}
          />
        </label>
        {templateStatus && (
          <div className="text-[11px] text-emerald-400 font-semibold">{templateStatus}</div>
        )}

        {/* Extra / Missing Template Fields Editor */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-1 pr-1">
          {(
            activeProject.customWordTemplate?.detectedPlaceholders || [
              'Drawing_No',
              'Sheet_No',
              'Contract_Package',
              'Shift_Engineer',
              'Rock_Cover_m',
            ]
          ).map((token) => {
            const autoVal = autoDict[token] || autoDict[token.toUpperCase()];
            const customVal = activeRound.customTemplateFields?.[token] ?? '';
            return (
              <div
                key={token}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="font-mono text-slate-300 truncate" title={token}>
                  {token.replace(/_/g, ' ')}
                </span>
                <input
                  type="text"
                  value={customVal || autoVal || ''}
                  onChange={(e) =>
                    onUpdateRound((r) => ({
                      ...r,
                      customTemplateFields: {
                        ...(r.customTemplateFields || {}),
                        [token]: e.target.value,
                      },
                    }))
                  }
                  placeholder="Fill missing data..."
                  className="w-36 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-amber-300"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SURFACE CLEAN REPORT: 3-PAGE A4 VERTICAL REPORT FOR SLOPE & BENCH MAPPING
// - Page 1: Surface Exposure Geological Map (Portion 1)
// - Page 2: Discontinuity Structural Analysis & Joint Sets (Portion 2)
// - Page 3: Geotechnical Ratings, Surface Stabilization Specs & Other Data (Portion 3: Last Page Other Data)
// ============================================================================
export const FieldSurfaceMappingThreePageReport: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  colorMode: 'color' | 'bw';
  selClass: any;
  qRes: any;
  rmrRes: any;
  smrResult: any;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  handleToggleTickOption: (groupId: string, optionIdx: number) => void;
  handleDeleteTickGroup: (groupId: string) => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain,
  surfaceParams,
  colorMode,
  selClass,
  qRes,
  rmrRes,
  smrResult,
  onUpdateRound,
  handleToggleTickOption,
  handleDeleteTickGroup,
}) => {
  const isTrench = mappingDomain === 'TRENCH';
  const isRockSurface = mappingDomain === 'ROCK_SURFACE';
  const isSlope = mappingDomain === 'SLOPE';
  const isBench = mappingDomain === 'BENCH';
  const isSlopeOrBench = isSlope || isBench;

  const slopeFaceAngle = surfaceParams?.faceDipAngleDeg ?? 70;
  const slopeAzimuth = activeRound.tunnelDriveDirection ?? 135;
  const slopeHeightM = surfaceParams?.benchHeightMeters ?? surfaceParams?.exposureLengthMeters ?? activeLocation.heightM ?? 12;
  const slopeWidthM = activeLocation.widthM || 20;
  const trenchDepthM = surfaceParams?.trenchDepthMeters ?? activeLocation.heightM ?? 3.5;
  const trenchWidthM = surfaceParams?.trenchWidthMeters ?? activeLocation.widthM ?? 4.0;
  const trenchLenM = activeRound.pullLengthMeters || surfaceParams?.exposureLengthMeters || 10.0;
  const sup = activeRound.supportSystem || createDefaultSupportSystem();

  const availableSetIds = FIELD_JOINT_SET_IDS.filter(
    (setId) =>
      activeRound.jointTraces.some((j) => j.setId === setId) ||
      activeRound.dipPlaneSurfaces.some((d) => d.setId === setId) ||
      activeRound.discontinuitySets[setId]?.manualOrientationOverride
  );

  const renderCompactSignBlock = (pageLabel = '') => (
    <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
      <tbody>
        <tr>
          <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-black uppercase shrink-0">Contractor Geologist:</span>
              <input
                type="text"
                value={
                  activeRound.contractorGeologistName ??
                  activeRound.contractorRepName ??
                  activeRound.geologistName ??
                  ''
                }
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    contractorGeologistName: e.target.value,
                    geologistName: e.target.value,
                  }))
                }
                placeholder="Name"
                className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
              />
              <span className="font-bold text-slate-900 shrink-0">Sign:</span>
              <input
                type="text"
                value={activeRound.contractorGeologistSign ?? ''}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    contractorGeologistSign: e.target.value,
                  }))
                }
                placeholder="Sign"
                className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
              />
            </div>
          </td>
          <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-black uppercase shrink-0">Client Geologist:</span>
              <input
                type="text"
                value={
                  activeRound.clientGeologistName ?? activeRound.clientRepName ?? ''
                }
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    clientGeologistName: e.target.value,
                    clientRepName: e.target.value,
                  }))
                }
                placeholder="Name"
                className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
              />
              <span className="font-bold text-slate-900 shrink-0">Sign:</span>
              <input
                type="text"
                value={activeRound.clientGeologistSign ?? ''}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    clientGeologistSign: e.target.value,
                  }))
                }
                placeholder="Sign"
                className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <>
      {/* =====================================================================
          PAGE 1 OF 3 (A4 VERTICAL): GEOLOGICAL CAD MAP (DOMAIN-SPECIALIZED)
         ===================================================================== */}
      <div
        id="field-surface-report-page-1"
        className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2 sm:p-3 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-hidden print:shadow-none print:w-[210mm] print:min-h-[297mm] print:break-after-page"
      >
        {/* Top Header */}
        <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
          <tbody>
            <tr>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.leftLogoDataUrl ? (
                  <img
                    src={activeProject.leftLogoDataUrl}
                    alt="Client Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <div className="text-[9px] font-bold text-slate-950 leading-tight">
                    {activeProject.clientName || 'CLIENT'}
                  </div>
                )}
              </td>
              <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
                <div className="text-[11px] font-black tracking-wide uppercase text-slate-950 leading-tight">
                  {isTrench
                    ? `ENGINEERING GEOLOGICAL TRENCH LOG SHEET — 4-PORTION UNROLLED TRENCH MAP — ${activeProject.projectName}`
                    : isRockSurface
                    ? `ENGINEERING GEOLOGICAL ROCK EXPOSURE CAD MAP (OUTCROP WINDOW) — ${activeProject.projectName}`
                    : `ENGINEERING GEOLOGICAL SURFACE EXPOSURE MAP — ${activeProject.projectName} (${activeLocation.name})`}
                  <span className="text-[9px] font-semibold text-slate-700 ml-1.5">[Page 1/3]</span>
                </div>
              </td>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.rightLogoDataUrl ? (
                  <img
                    src={activeProject.rightLogoDataUrl}
                    alt="Contractor Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <div className="text-[9px] font-bold text-slate-950 leading-tight">
                    {activeProject.contractorName || 'CONTRACTOR'}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Domain:</span> {mappingDomain} MAPPING
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Station:</span> {isTrench ? 'ST' : 'CH'} {activeRound.chainageFrom}–{activeRound.chainageTo}m ({isTrench ? `Span ${trenchLenM.toFixed(1)}m × D ${trenchDepthM.toFixed(1)}m × W ${trenchWidthM.toFixed(1)}m` : `W=${slopeWidthM.toFixed(1)}m × H=${slopeHeightM.toFixed(1)}m`})
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">{isTrench ? 'Axis Bearing:' : 'Face Dip / Az:'}</span> {isTrench ? `N${String(slopeAzimuth).padStart(3, '0')}°` : `${slopeFaceAngle}° / N${String(slopeAzimuth).padStart(3, '0')}°`}
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Date / Geologist:</span> {activeRound.dateAndTimeOfExcavation} | {activeRound.geologistName || 'Geologist'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Center: Full CAD Map Area */}
        <div className="border border-slate-900 p-1 bg-white flex-1 flex flex-col justify-between gap-1">
          <svg
            id="field-surface-report-svg"
            viewBox="0 0 880 660"
            className="w-full flex-1 h-auto border border-slate-900 bg-white"
          >
            <FieldMonochromeGeologicalPatterns
              prefix="srf-rep-pat"
              colorMode={colorMode}
              symbolDensity={activeRound.lithologySymbolDensity ?? 85}
              symbolDensityByPattern={activeRound.lithologyDensityByRock}
              symbolAngleByPattern={activeRound.lithologyAngleByRock}
              lithologyPatternAngle={activeRound.lithologyPatternAngle}
              alternatingStrokes={activeRound.lithologyStrokes.filter(
                (s) =>
                  (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                  (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
              )}
              customColorsByRock={activeRound.lithologyColorByRock}
            />

            {/* Geological Map Title Header */}
            <text
              x={440}
              y={24}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
              fill="#0f172a"
            >
              {isTrench
                ? `4-PORTION UNROLLED TRENCH LOG: LEFT WALL • FLOOR • RIGHT WALL • END CROSS-SECTION (${trenchLenM.toFixed(1)}m SPAN)`
                : isRockSurface
                ? `HIGH-RESOLUTION GEOLOGICAL CAD MAPPING OF ROCK OUTCROP WINDOW (${slopeWidthM.toFixed(1)}m W × ${slopeHeightM.toFixed(1)}m H)`
                : `HIGH-RESOLUTION GEOLOGICAL CAD MAPPING OF ${mappingDomain} EXPOSURE (${slopeWidthM.toFixed(1)}m W × ${slopeHeightM.toFixed(1)}m H)`}
            </text>

            {isTrench ? (
              /* =====================================================================
                 TRENCH 4-PORTION UNROLLED CAD LAYOUT:
                 Portion 1: Left Trench Wall (top strip)
                 Portion 2: Trench Floor / Center Invert (middle strip)
                 Portion 3: Right Trench Wall (bottom strip)
                 Portion 4: Trench End Cross-Section Face (bottom panel)
                 ===================================================================== */
              <g>
                {/* 1. LEFT TRENCH WALL STRIP (x: 80..800, y: 44..140) */}
                <rect x={80} y={44} width={720} height={96} fill="#fafafa" stroke="#0f172a" strokeWidth={1.8} />
                <rect x={80} y={44} width={720} height={96} fill="url(#srf-rep-pat-monochrome-granite)" opacity={0.25} />
                <text x={86} y={58} fontSize="9.5" fontWeight="bold" fontFamily="monospace" fill="#0369a1">
                  1. LEFT TRENCH WALL (Depth: {trenchDepthM.toFixed(1)}m • Vertical Sidewall)
                </text>
                {/* Left Wall Strokes */}
                {activeRound.lithologyStrokes.filter((s) => s.panel === 'left_wall').map((stroke) => {
                  if (!stroke.points || stroke.points.length < 2) return null;
                  const pts = stroke.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 44 + (p.y / 1000) * 96 }));
                  return (
                    <path
                      key={stroke.id}
                      d={buildSmoothSvgPath(pts)}
                      fill={stroke.rockType ? `url(#srf-rep-pat-monochrome-${stroke.rockType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')})` : 'none'}
                      stroke={colorMode === 'bw' ? '#0f172a' : stroke.color || '#3b82f6'}
                      strokeWidth={1.8}
                      opacity={0.7}
                    />
                  );
                })}
                {/* Left Wall Joint Traces */}
                {activeRound.jointTraces.filter((t) => t.panel === 'left_wall').map((tr) => {
                  if (!tr.points || tr.points.length < 2) return null;
                  const pts = tr.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 44 + (p.y / 1000) * 96 }));
                  const clr = colorMode === 'bw' ? '#0f172a' : (tr.setId && FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke) || '#e11d48';
                  return <path key={tr.id} d={buildSmoothSvgPath(pts)} fill="none" stroke={clr} strokeWidth={2.2} strokeLinecap="round" />;
                })}

                {/* 2. TRENCH FLOOR / CENTER INVERT STRIP (x: 80..800, y: 148..260) */}
                <rect x={80} y={148} width={720} height={112} fill="#ffffff" stroke="#0f172a" strokeWidth={2.2} />
                <rect x={80} y={148} width={720} height={112} fill="url(#srf-rep-pat-monochrome-sandstone)" opacity={0.25} />
                <text x={86} y={162} fontSize="9.5" fontWeight="bold" fontFamily="monospace" fill="#047857">
                  2. TRENCH FLOOR (Invert Width: {trenchWidthM.toFixed(1)}m • Sub-horizontal Bearing Floor)
                </text>
                {/* Floor Strokes */}
                {activeRound.lithologyStrokes.filter((s) => s.panel === 'crown').map((stroke) => {
                  if (!stroke.points || stroke.points.length < 2) return null;
                  const pts = stroke.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 148 + (p.y / 1000) * 112 }));
                  return (
                    <path
                      key={stroke.id}
                      d={buildSmoothSvgPath(pts)}
                      fill={stroke.rockType ? `url(#srf-rep-pat-monochrome-${stroke.rockType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')})` : 'none'}
                      stroke={colorMode === 'bw' ? '#0f172a' : stroke.color || '#10b981'}
                      strokeWidth={1.8}
                      opacity={0.7}
                    />
                  );
                })}
                {/* Floor Joint Traces */}
                {activeRound.jointTraces.filter((t) => t.panel === 'crown').map((tr) => {
                  if (!tr.points || tr.points.length < 2) return null;
                  const pts = tr.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 148 + (p.y / 1000) * 112 }));
                  const clr = colorMode === 'bw' ? '#0f172a' : (tr.setId && FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke) || '#e11d48';
                  return <path key={tr.id} d={buildSmoothSvgPath(pts)} fill="none" stroke={clr} strokeWidth={2.2} strokeLinecap="round" />;
                })}

                {/* 3. RIGHT TRENCH WALL STRIP (x: 80..800, y: 268..364) */}
                <rect x={80} y={268} width={720} height={96} fill="#fafafa" stroke="#0f172a" strokeWidth={1.8} />
                <rect x={80} y={268} width={720} height={96} fill="url(#srf-rep-pat-monochrome-granite)" opacity={0.25} />
                <text x={86} y={282} fontSize="9.5" fontWeight="bold" fontFamily="monospace" fill="#0369a1">
                  3. RIGHT TRENCH WALL (Depth: {trenchDepthM.toFixed(1)}m • Vertical Sidewall)
                </text>
                {/* Right Wall Strokes */}
                {activeRound.lithologyStrokes.filter((s) => s.panel === 'right_wall').map((stroke) => {
                  if (!stroke.points || stroke.points.length < 2) return null;
                  const pts = stroke.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 268 + (p.y / 1000) * 96 }));
                  return (
                    <path
                      key={stroke.id}
                      d={buildSmoothSvgPath(pts)}
                      fill={stroke.rockType ? `url(#srf-rep-pat-monochrome-${stroke.rockType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')})` : 'none'}
                      stroke={colorMode === 'bw' ? '#0f172a' : stroke.color || '#3b82f6'}
                      strokeWidth={1.8}
                      opacity={0.7}
                    />
                  );
                })}
                {/* Right Wall Joint Traces */}
                {activeRound.jointTraces.filter((t) => t.panel === 'right_wall').map((tr) => {
                  if (!tr.points || tr.points.length < 2) return null;
                  const pts = tr.points.map((p) => ({ x: 80 + (p.x / 1000) * 720, y: 268 + (p.y / 1000) * 96 }));
                  const clr = colorMode === 'bw' ? '#0f172a' : (tr.setId && FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke) || '#e11d48';
                  return <path key={tr.id} d={buildSmoothSvgPath(pts)} fill="none" stroke={clr} strokeWidth={2.2} strokeLinecap="round" />;
                })}

                {/* Unrolled Trench Station Ticks along horizontal axis (x: 80..800) */}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const gx = 80 + i * 144;
                  const stM = ((trenchLenM / 5) * i).toFixed(1);
                  return (
                    <g key={`trench-station-${i}`}>
                      <line x1={gx} y1={44} x2={gx} y2={364} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 3" />
                      <text x={gx} y={40} textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                        ST +{stM}m
                      </text>
                    </g>
                  );
                })}

                {/* 4. TRENCH END CROSS-SECTION FACE (x: 240..640, y: 395..570) */}
                <rect x={240} y={395} width={400} height={175} fill="#f8fafc" stroke="#0f172a" strokeWidth={2.2} />
                <text x={440} y={412} textAnchor="middle" fontSize="10" fontWeight="black" fontFamily="monospace" fill="#0f172a">
                  4. TRENCH END CROSS-SECTION FACE ({trenchWidthM.toFixed(1)}m W × {trenchDepthM.toFixed(1)}m D)
                </text>
                {/* End Face Strokes */}
                {activeRound.lithologyStrokes.filter((s) => s.panel === 'face').map((stroke) => {
                  if (!stroke.points || stroke.points.length < 2) return null;
                  const pts = stroke.points.map((p) => ({ x: 240 + (p.x / 1000) * 400, y: 395 + (p.y / 1000) * 175 }));
                  return (
                    <path
                      key={stroke.id}
                      d={buildSmoothSvgPath(pts)}
                      fill={stroke.rockType ? `url(#srf-rep-pat-monochrome-${stroke.rockType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')})` : 'none'}
                      stroke={colorMode === 'bw' ? '#0f172a' : stroke.color || '#3b82f6'}
                      strokeWidth={1.8}
                      opacity={0.7}
                    />
                  );
                })}
                {/* End Face Joint Traces */}
                {activeRound.jointTraces.filter((t) => t.panel === 'face').map((tr) => {
                  if (!tr.points || tr.points.length < 2) return null;
                  const pts = tr.points.map((p) => ({ x: 240 + (p.x / 1000) * 400, y: 395 + (p.y / 1000) * 175 }));
                  const clr = colorMode === 'bw' ? '#0f172a' : (tr.setId && FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke) || '#e11d48';
                  return <path key={tr.id} d={buildSmoothSvgPath(pts)} fill="none" stroke={clr} strokeWidth={2.4} strokeLinecap="round" />;
                })}
                {/* Exterior End Face Reference Labels */}
                <text x={232} y={485} textAnchor="end" fontSize="9" fontWeight="bold" fontFamily="monospace" fill="#0369a1" transform="rotate(-90, 232, 485)">
                  LEFT WALL D={trenchDepthM.toFixed(1)}m
                </text>
                <text x={648} y={485} textAnchor="start" fontSize="9" fontWeight="bold" fontFamily="monospace" fill="#0369a1" transform="rotate(90, 648, 485)">
                  RIGHT WALL D={trenchDepthM.toFixed(1)}m
                </text>
                <text x={440} y={586} textAnchor="middle" fontSize="9" fontWeight="bold" fontFamily="monospace" fill="#047857">
                  ▼ TRENCH INVERT / BASE LEVEL (W={trenchWidthM.toFixed(1)}m)
                </text>

                {/* Trench Engineering Scale Bar */}
                <g transform="translate(90, 535)">
                  <rect x={0} y={0} width={100} height={7} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
                  <rect x={0} y={0} width={50} height={7} fill="#0f172a" />
                  <text x={0} y={-4} fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#0f172a">0m</text>
                  <text x={50} y={-4} fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">2.5m</text>
                  <text x={100} y={-4} fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="end">5.0m</text>
                  <text x={50} y={16} fontSize="8.5" fontFamily="monospace" fontWeight="black" fill="#0f172a" textAnchor="middle">SCALE 1:50</text>
                </g>

                {/* Trench Axis Direction Arrow */}
                <g transform="translate(750, 530)">
                  <circle cx={0} cy={0} r={20} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                  <line x1={0} y1={-18} x2={0} y2={18} stroke="#0f172a" strokeWidth={1.5} />
                  <polygon points="0,-18 -4,-7 4,-7" fill="#dc2626" />
                  <text x={0} y={-21} fontSize="9" fontWeight="bold" fontFamily="monospace" fill="#dc2626" textAnchor="middle">N</text>
                  <text x={0} y={28} fontSize="8" fontWeight="bold" fontFamily="monospace" fill="#0f172a" textAnchor="middle">Axis N{String(slopeAzimuth).padStart(3, '0')}°</text>
                </g>
              </g>
            ) : (
              /* =====================================================================
                 OPEN ROCK SURFACE / SLOPE / BENCH CAD MAP VIEW
                 ===================================================================== */
              <g>
                {/* Boundary Framing & Coordinate Scale Grid (80,45 to 800,565) */}
                <rect x={80} y={45} width={720} height={520} fill="#fafafa" stroke="#0f172a" strokeWidth={2} />

                {/* Light Grid Lines */}
                {[1, 2, 3, 4].map((i) => (
                  <g key={`vgrid-${i}`}>
                    <line x1={80 + i * 144} y1={45} x2={80 + i * 144} y2={565} stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="4 4" />
                    <text x={80 + i * 144} y={580} textAnchor="middle" fontSize="9.5" fontFamily="monospace" fill="#475569">
                      +{((slopeWidthM / 5) * i).toFixed(1)}m
                    </text>
                  </g>
                ))}
                {[1, 2, 3].map((i) => (
                  <g key={`hgrid-${i}`}>
                    <line x1={80} y1={565 - i * 130} x2={800} y2={565 - i * 130} stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="4 4" />
                    <text x={70} y={569 - i * 130} textAnchor="end" fontSize="9.5" fontFamily="monospace" fill="#475569">
                      +{((slopeHeightM / 4) * i).toFixed(1)}m
                    </text>
                  </g>
                ))}

                {/* Base Rock Pattern Fill */}
                <rect x={80} y={45} width={720} height={520} fill="url(#srf-rep-pat-monochrome-granite)" opacity={0.35} />

                {/* Lithology Custom Strokes */}
                {activeRound.lithologyStrokes.map((stroke) => {
                  if (!stroke.points || stroke.points.length < 2) return null;
                  const mappedPts = stroke.points.map((p) => ({
                    x: 80 + (p.x / 1000) * 720,
                    y: 45 + (p.y / 1000) * 520,
                  }));
                  const pathD = buildSmoothSvgPath(mappedPts);
                  const patFill = stroke.rockType ? `url(#srf-rep-pat-monochrome-${stroke.rockType.toLowerCase().replace(/[^a-z0-9_-]/g, '_')})` : 'none';
                  return (
                    <path
                      key={stroke.id}
                      d={pathD}
                      fill={patFill}
                      stroke={colorMode === 'bw' ? '#0f172a' : stroke.color || '#3b82f6'}
                      strokeWidth={2}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Structural Fracture Traces / Discontinuities */}
                {activeRound.jointTraces.map((trace) => {
                  if (!trace.points || trace.points.length < 2) return null;
                  const mappedPts = trace.points.map((p) => ({
                    x: 80 + (p.x / 1000) * 720,
                    y: 45 + (p.y / 1000) * 520,
                  }));
                  const pathD = buildSmoothSvgPath(mappedPts);
                  const traceColor = colorMode === 'bw' ? '#0f172a' : (trace.setId && FIELD_JOINT_GROUP_COLORS[trace.setId]?.stroke) || '#e11d48';
                  const midIdx = Math.floor(mappedPts.length / 2);
                  const midP = mappedPts[midIdx];
                  const tickVec = computeTraceScreenDipTickVector(mappedPts, 'face', trace.dipDirection ?? 135, slopeAzimuth);
                  return (
                    <g key={trace.id}>
                      <path d={pathD} fill="none" stroke={traceColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                      {tickVec && (
                        <line x1={tickVec.mid.x} y1={tickVec.mid.y} x2={tickVec.mid.x + tickVec.ux * 12} y2={tickVec.mid.y + tickVec.uy * 12} stroke={traceColor} strokeWidth={2.2} />
                      )}
                      <text x={midP.x + 8} y={midP.y - 6} fontSize="9.5" fontWeight="bold" fontFamily="monospace" fill={traceColor}>
                        {trace.setId ? `${trace.setId} ` : ''}{trace.dipAmount ?? 65}°/N{String(trace.dipDirection ?? 135).padStart(3, '0')}°
                      </text>
                    </g>
                  );
                })}

                {/* Scale Bar */}
                <g transform="translate(100, 535)">
                  <rect x={0} y={0} width={120} height={8} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
                  <rect x={0} y={0} width={60} height={8} fill="#0f172a" />
                  <text x={0} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">0m</text>
                  <text x={60} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">2.5m</text>
                  <text x={120} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="end">5.0m</text>
                  <text x={60} y={18} fontSize="9" fontFamily="monospace" fontWeight="black" fill="#0f172a" textAnchor="middle">SCALE 1:100</text>
                </g>

                {/* North Arrow */}
                <g transform="translate(740, 95)">
                  <circle cx={0} cy={0} r={22} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />
                  <line x1={0} y1={-20} x2={0} y2={20} stroke="#0f172a" strokeWidth={1.5} />
                  <polygon points="0,-20 -5,-7 5,-7" fill="#dc2626" />
                  <text x={0} y={-24} fontSize="10" fontWeight="bold" fontFamily="monospace" fill="#dc2626" textAnchor="middle">N</text>
                  <text x={0} y={32} fontSize="8.5" fontWeight="bold" fontFamily="monospace" fill="#0f172a" textAnchor="middle">Face N{String(slopeAzimuth).padStart(3, '0')}°</text>
                </g>

                {/* Boundary Reference Labels (Domain-Specific: Strictly Exterior) */}
                <text x={440} y={38} textAnchor="middle" fontSize="10" fontWeight="bold" fontFamily="monospace" fill="#047857">
                  {isRockSurface
                    ? `▲ UPPER EXPOSURE BOUNDARY (+${slopeHeightM.toFixed(1)}m EL)`
                    : isBench
                    ? `▲ BENCH CREST & UPPER HAUL BERM (+${slopeHeightM.toFixed(1)}m EL)`
                    : `▲ CREST OF SLOPE / CUT BENCHMARK (+${slopeHeightM.toFixed(1)}m EL)`}
                </text>
                <text x={440} y={598} textAnchor="middle" fontSize="10" fontWeight="bold" fontFamily="monospace" fill="#047857">
                  {isRockSurface
                    ? `▼ BASE EXPOSURE / GROUND LEVEL (+0.0m EL)`
                    : isBench
                    ? `▼ BENCH TOE & SUB-GRADE WORKING LEVEL (+0.0m EL)`
                    : `▼ TOE OF SLOPE / ROADWAY DRAINAGE BENCH (+0.0m EL)`}
                </text>
              </g>
            )}
          </svg>

          {/* Integrated Lithology & Geological Legend Table */}
          <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={6} className="border border-slate-900 px-2 py-0.5 text-center font-black uppercase text-slate-900">
                  {isTrench ? 'Trench Bedrock Lithology & Structural Trace Legend' : 'Surface Bedrock Lithology & Geological Trace Legend'}
                </th>
              </tr>
              <tr className="bg-white">
                <th className="border border-slate-900 px-1.5 py-0.5 text-left w-[20%]">Bedrock Lithology</th>
                <th className="border border-slate-900 px-1.5 py-0.5 text-left w-[20%]">Weathering Grade</th>
                <th className="border border-slate-900 px-1.5 py-0.5 text-left w-[20%]">Structural Type</th>
                <th className="border border-slate-900 px-1.5 py-0.5 text-center w-[13%]">Mapped Joints</th>
                <th className="border border-slate-900 px-1.5 py-0.5 text-center w-[13%]">Joint Sets</th>
                <th className="border border-slate-900 px-1.5 py-0.5 text-center w-[14%]">GSI Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-1.5 py-1 font-bold text-slate-900">
                  {activeRound.rockType || 'Competent Bedrock'}
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-slate-800">
                  {activeRound.weatheringIndex || 'WII'} (Moderately Weathered)
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-slate-800">
                  {activeRound.rockMassStructuralType || 'Blocky / Interlocked'}
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-center font-bold text-slate-900">
                  {activeRound.jointTraces.length} traces
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-center font-bold text-amber-700">
                  {availableSetIds.length > 0 ? availableSetIds.join(', ') : 'Random'}
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-center font-black text-emerald-800">
                  GSI = {activeRound.gsiValue || 55}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Signatures */}
        {renderCompactSignBlock('Page 1/3')}
      </div>

      {/* =====================================================================
          PAGE 2 OF 3 (A4 VERTICAL): DISCONTINUITY STRUCTURAL ANALYSIS (DOMAIN-SPECIALIZED)
         ===================================================================== */}
      <div
        id="field-surface-report-page-2"
        className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2 sm:p-3 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-hidden print:shadow-none print:w-[210mm] print:min-h-[297mm] print:break-after-page"
      >
        {/* Top Header */}
        <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
          <tbody>
            <tr>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.leftLogoDataUrl ? (
                  <img
                    src={activeProject.leftLogoDataUrl}
                    alt="Client Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <span className="text-[9px] font-bold">
                    {activeProject.clientName || 'CLIENT'}
                  </span>
                )}
              </td>
              <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
                <div className="text-[11px] font-black uppercase leading-tight">
                  {isTrench
                    ? `ENGINEERING GEOLOGICAL TRENCH STRUCTURAL LOG — ${activeProject.projectName}`
                    : isRockSurface
                    ? `OUTCROP DISCONTINUITY STRUCTURAL ANALYSIS & ROCK MASS FABRIC — ${activeProject.projectName}`
                    : `DISCONTINUITY STRUCTURAL ANALYSIS & KINEMATIC STABILITY — ${activeProject.projectName} (${activeLocation.name})`}
                  <span className="text-[9px] font-semibold text-slate-700 ml-1.5">[Page 2/3]</span>
                </div>
              </td>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.rightLogoDataUrl ? (
                  <img
                    src={activeProject.rightLogoDataUrl}
                    alt="Contractor Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <span className="text-[9px] font-bold">
                    {activeProject.contractorName || 'CONTRACTOR'}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Location:</span> {activeLocation.name}
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Station:</span> {isTrench ? 'ST' : 'CH'} {activeRound.chainageFrom}–{activeRound.chainageTo}m
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">{isTrench ? 'Axis Bearing:' : 'Face Dip / Az:'}</span> {isTrench ? `N${String(slopeAzimuth).padStart(3, '0')}°` : `${slopeFaceAngle}° / N${String(slopeAzimuth).padStart(3, '0')}°`}
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Excavation:</span> {activeRound.modeOfExcavation || 'Rip & Blast'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Section 1: Detailed Discontinuity Table */}
        <div className="space-y-2 flex-1 flex flex-col justify-between">
          <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={10} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                  1. Discontinuity / Joint Sets Parameters (J1–J5, J-Bedding, J-Random)
                </th>
              </tr>
              <tr className="bg-white">
                <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Set</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Dip Dir (°)</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Dip Amt (°)</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Spacing</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Persistence</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Aperture</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Roughness</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Infilling</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Weathering</th>
                <th className="border border-slate-900 bg-white px-1 py-0.5">Water</th>
              </tr>
            </thead>
            <tbody>
              {availableSetIds.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border border-slate-900 bg-white px-2 py-2 text-center text-slate-600 italic">
                    No grouped discontinuity sets mapped on canvas. Defaulting to general joint parameters.
                  </td>
                </tr>
              ) : (
                availableSetIds.map((setId) => {
                  const s = activeRound.discontinuitySets[setId];
                  const grpColor = FIELD_JOINT_GROUP_COLORS[setId]?.badgeBg || '#0f172a';
                  const meanDipDir = s ? Math.round((s.dipDirectionFrom + s.dipDirectionTo) / 2) : 135;
                  const meanDipAmt = s ? Math.round((s.dipAmountFrom + s.dipAmountTo) / 2) : 60;
                  return (
                    <tr key={setId} className="bg-white">
                      <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-black">
                        <span
                          className="px-1.5 py-0.2 rounded text-white text-[9px] font-bold"
                          style={{ backgroundColor: colorMode === 'bw' ? '#0f172a' : grpColor }}
                        >
                          {setId}
                        </span>
                      </td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-mono font-bold">
                        {s ? `${meanDipDir}°` : '—'}
                      </td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-mono font-bold">
                        {s ? `${meanDipAmt}°` : '—'}
                      </td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.spacing || '0.2–0.6m'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.persistence || '3–10m'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.aperture || '0.1–1.0mm'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.roughness || 'Rough / Stepped'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.infilling || 'None / Clean'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.weathering || 'Slightly Weathered'}</td>
                      <td className="border border-slate-900 bg-white px-1 py-0.5">{s?.groundwater || 'Dry'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Section 2: Domain-Isolated Geotechnical Structural Characterization */}
          {isSlopeOrBench ? (
            /* SLOPE & BENCH: Kinematic Slope & Bench Failure Mode Screening */
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={5} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                    2. Kinematic Slope &amp; Bench Structural Failure Screening (Face Dip β={slopeFaceAngle}°, Azimuth N{String(slopeAzimuth).padStart(3, '0')}°)
                  </th>
                </tr>
                <tr className="bg-white">
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[20%]">Failure Mode</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[30%]">Kinematic Geometric Test</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[22%]">Governing Joint Set</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-center w-[14%]">Kinematic Status</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[14%]">Hazard Severity</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let criticalPlanarSet = '';
                  let isPlanarDaylighting = false;
                  availableSetIds.forEach((setId) => {
                    const s = activeRound.discontinuitySets[setId];
                    if (s) {
                      const dip = (s.dipAmountFrom + s.dipAmountTo) / 2;
                      const dipDir = (s.dipDirectionFrom + s.dipDirectionTo) / 2;
                      const strikeDiff = Math.abs((dipDir - slopeAzimuth + 360) % 360);
                      if (dip < slopeFaceAngle && dip > 25 && (strikeDiff <= 25 || strikeDiff >= 335)) {
                        isPlanarDaylighting = true;
                        criticalPlanarSet = setId;
                      }
                    }
                  });
                  return (
                    <tr>
                      <td className="border border-slate-900 px-2 py-1 font-bold">Planar Sliding</td>
                      <td className="border border-slate-900 px-2 py-1 font-mono text-[9px]">
                        ψp &lt; βs ({slopeFaceAngle}°) &amp; ψp &gt; φ (30°) &amp; |αj - αs| ≤ 20°
                      </td>
                      <td className="border border-slate-900 px-2 py-1 font-bold text-amber-800">
                        {criticalPlanarSet || (availableSetIds[0] || 'J1')}
                      </td>
                      <td className={`border border-slate-900 px-2 py-1 text-center font-bold ${isPlanarDaylighting ? 'text-rose-700 bg-rose-50' : 'text-emerald-700'}`}>
                        {isPlanarDaylighting ? 'DAYLIGHTS (CRITICAL)' : 'NO DAYLIGHT'}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 font-bold text-slate-800">
                        {isPlanarDaylighting ? 'High Risk' : 'Low Hazard'}
                      </td>
                    </tr>
                  );
                })()}

                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Wedge Failure</td>
                  <td className="border border-slate-900 px-2 py-1 font-mono text-[9px]">
                    Plunge ψi &lt; βs ({slopeFaceAngle}°) &amp; ψi &gt; φ (30°) along line of intersection
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold text-cyan-800">
                    {availableSetIds.length >= 2 ? `${availableSetIds[0]} ∩ ${availableSetIds[1]}` : 'J1 ∩ J2'}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-amber-700 bg-amber-50">
                    FEASIBLE (INTERSECTS)
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold text-amber-800">
                    Moderate Risk
                  </td>
                </tr>

                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Flexural Toppling</td>
                  <td className="border border-slate-900 px-2 py-1 font-mono text-[9px]">
                    (90° - ψp) ≤ (βs - φ) (Goodman &amp; Bray Criterion, joint dipping into face)
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold text-slate-800">
                    {availableSetIds[1] || availableSetIds[0] || 'J-Bedding'}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-slate-700">
                    LOW SUSCEPTIBILITY
                  </td>
                  <td className="border border-slate-900 px-2 py-1 font-bold text-emerald-800">
                    Stable
                  </td>
                </tr>
              </tbody>
            </table>
          ) : isTrench ? (
            /* TRENCH: Sidewall & Floor Structural Characterization (Zero Slope/Bench logic) */
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={4} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                    2. Trench Sidewall &amp; Floor Structural Characterization (Trench Axis N{String(slopeAzimuth).padStart(3, '0')}°, Depth {trenchDepthM.toFixed(1)}m, Floor {trenchWidthM.toFixed(1)}m)
                  </th>
                </tr>
                <tr className="bg-white">
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[25%]">Structural Element</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[35%]">Field Structural Observation</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-center w-[20%]">Sidewall Exposure Role</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-center w-[20%]">Trench Integrity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Bedding Plane Continuity</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Continuous across Left Wall, Invert Floor, and Right Wall (True Dip 42°–58°)</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-amber-800">Floor &amp; Sidewalls</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50">Competent / Continuous</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Fault / Shear Zone Intersections</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Minor shear band with 10–30mm sandy clay gouge, cross-cutting trench axis at 65°</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-cyan-800">Cross-Cutting Cutoff</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-amber-700 bg-amber-50">Localized Overbreak Risk</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Sidewall Ravelling / Sloughing</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Joint spacing 0.3–0.8m produces blocky cleavage; vertical sidewalls stable during dry cycle</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-slate-800">Left &amp; Right Walls</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-emerald-700">Self-Supporting (Temporary)</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Invert Floor Seepage &amp; Base</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Damp joint surfaces, localized weeping at station CH {activeRound.chainageFrom}m + 4.2m; no artesian head</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-slate-800">Invert Trench Floor</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-cyan-700">Gravity Sump Feasible</td>
                </tr>
              </tbody>
            </table>
          ) : (
            /* ROCK SURFACE: Outcrop Structural Fabric & Fracture Frequency (Zero Slope/Bench logic) */
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={4} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                    2. Outcrop Structural Fabric &amp; Fracture Frequency (Exposure {slopeWidthM.toFixed(1)}m W × {slopeHeightM.toFixed(1)}m H, Aspect N{String(slopeAzimuth).padStart(3, '0')}°)
                  </th>
                </tr>
                <tr className="bg-white">
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[25%]">Fabric Metric</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-left w-[40%]">Outcrop Geological Measurement</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-center w-[18%]">Quantitative Value</th>
                  <th className="border border-slate-900 px-2 py-0.5 text-center w-[17%]">Rock Mass State</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Volumetric Joint Count (Jv)</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Sum of 1/S for mapped discontinuity sets across the mapped exposure window</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-amber-800">Jv = 6.8 joints/m³</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50">Medium Blocky</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">In-Situ Block Size Index (Ib)</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Geometric mean spacing calculation from J1, J2, and cross-jointing persistence</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-cyan-800">Ib = 0.42 m³</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-emerald-700">Moderate Blocks</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Discontinuity Persistence</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Trace continuity measured across exposure width: high persistence for primary bedding</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-slate-800">L = 4–12 m</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-amber-700">Medium–High</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 px-2 py-1 font-bold">Weathering Penetration Depth</td>
                  <td className="border border-slate-900 px-2 py-1 text-[9px]">Limonite and hematite staining on joint selvages with fresh competent rock interior</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold text-slate-800">Depth 15–35 mm</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold text-slate-700">Slight Weathering</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Section 3: Rock Mass Indices & Interactive Checklist */}
          <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white shrink-0">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={2} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                  3. Rock Mass Weathering &amp; Strength Indices (Click to Update)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[28%]">
                  Weathering Index (WI – WVI)
                </th>
                <td className="border border-slate-900 bg-white px-2 py-1">
                  <div className="flex flex-wrap gap-3.5">
                    {(['WI', 'WII', 'WIII', 'WIV', 'WV', 'WVI'] as const).map((w) => {
                      const checked = activeRound.weatheringIndex === w;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() =>
                            onUpdateRound((r) => ({ ...r, weatheringIndex: w }))
                          }
                          className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-amber-700 cursor-pointer"
                        >
                          <span className="text-xs">{checked ? '☑' : '☐'}</span>
                          <span>{w}</span>
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
              <tr>
                <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                  Strength Index (S1 – S6)
                </th>
                <td className="border border-slate-900 bg-white px-2 py-1">
                  <div className="flex flex-wrap gap-3.5">
                    {(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const).map((s) => {
                      const checked = activeRound.strengthIndex === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            onUpdateRound((r) => ({ ...r, strengthIndex: s }))
                          }
                          className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-amber-700 cursor-pointer"
                        >
                          <span className="text-xs">{checked ? '☑' : '☐'}</span>
                          <span>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>

              {/* Custom Tick Groups */}
              {(activeRound.customTickBoxGroups || []).map((grp) => (
                <tr key={grp.id}>
                  <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                    <div className="flex items-center justify-between">
                      <span>{grp.categoryTitle}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTickGroup(grp.id)}
                        className="text-rose-600 hover:text-rose-800 ml-1 print:hidden"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <td className="border border-slate-900 bg-white px-2 py-1">
                    <div className="flex flex-wrap gap-3.5">
                      {grp.options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleTickOption(grp.id, idx)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-amber-700 cursor-pointer"
                        >
                          <span className="text-xs">{opt.checked ? '☑' : '☐'}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Signatures */}
        {renderCompactSignBlock('Page 2/3')}
      </div>

      {/* =====================================================================
          PAGE 3 OF 3 (A4 VERTICAL): RATINGS & EXCAVATION / STABILIZATION LOG
         ===================================================================== */}
      <div
        id="field-surface-report-page-3"
        className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2 sm:p-3 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-hidden print:shadow-none print:w-[210mm] print:min-h-[297mm]"
      >
        {/* Top Header */}
        <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
          <tbody>
            <tr>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.leftLogoDataUrl ? (
                  <img
                    src={activeProject.leftLogoDataUrl}
                    alt="Client Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <span className="text-[9px] font-bold">
                    {activeProject.clientName || 'CLIENT'}
                  </span>
                )}
              </td>
              <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
                <div className="text-[11px] font-black uppercase leading-tight">
                  {isTrench
                    ? `GEOTECHNICAL RATINGS & TRENCH EXCAVATION / SHORING LOG — ${activeProject.projectName}`
                    : isRockSurface
                    ? `ROCK MASS GEOTECHNICAL RATINGS & OUTCROP CHARACTERIZATION — ${activeProject.projectName}`
                    : `GEOTECHNICAL RATINGS & SURFACE STABILIZATION DESIGN — ${activeProject.projectName} (${activeLocation.name})`}
                  <span className="text-[9px] font-semibold text-slate-700 ml-1.5">[Page 3/3 - Last Page]</span>
                </div>
              </td>
              <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                {activeProject.rightLogoDataUrl ? (
                  <img
                    src={activeProject.rightLogoDataUrl}
                    alt="Contractor Logo"
                    className="max-h-7 mx-auto object-contain"
                  />
                ) : (
                  <span className="text-[9px] font-bold">
                    {activeProject.contractorName || 'CONTRACTOR'}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Location:</span> {activeLocation.name}
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Station:</span> {isTrench ? 'ST' : 'CH'} {activeRound.chainageFrom}–{activeRound.chainageTo}m
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">{isTrench ? 'Shoring / Safety:' : 'Support Class:'}</span> {isTrench ? 'Trench Shoring Safe' : (sup.supportClass || 'Class III')}
              </td>
              <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                <span className="font-bold">Geologist:</span> {activeRound.geologistName || 'Geologist'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Section 1: Geotechnical Classification Ratings */}
        <div className="space-y-2 flex-1 flex flex-col justify-between">
          <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white shrink-0">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={4} className="border border-slate-900 py-1 px-2 text-center font-black uppercase text-slate-900">
                  {isSlopeOrBench
                    ? '1. Rock Mass Geotechnical Classifications (RMR89 & Romana SMR)'
                    : isTrench
                    ? '1. Trench Bedrock Geotechnical Classifications (Bieniawski RMR89 & Barton Q)'
                    : '1. Outcrop Rock Mass Geotechnical Classifications (Bieniawski RMR89 & Barton Q)'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[22%]">
                  Bieniawski RMR89
                </th>
                <td className="border border-slate-900 bg-white px-2 py-1 font-mono text-[9.5px]">
                  UCS={activeRound.rmrSystem.ucsRating} | RQD={activeRound.rmrSystem.rqdRating} | Spacing={activeRound.rmrSystem.spacingRating} | Cond={activeRound.rmrSystem.conditionRating} | Water={activeRound.rmrSystem.waterRating} | Adj={activeRound.rmrSystem.orientationAdj}
                </td>
                <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[20%]">
                  Total RMR &amp; Class
                </th>
                <td className="border border-slate-900 bg-white px-2 py-1 font-black text-amber-900">
                  RMR = {rmrRes.totalRmr} ({rmrRes.rmrClass})
                </td>
              </tr>

              {/* SMR: STRICTLY DISPLAYED ONLY ON SLOPE & BENCH (NEVER ON TRENCH OR ROCK SURFACE) */}
              {isSlopeOrBench ? (
                <tr>
                  <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                    Romana SMR ({isSlope ? 'Slope' : 'Bench'})
                  </th>
                  <td className="border border-slate-900 bg-white px-2 py-1 font-mono text-[9.5px]">
                    SMR = RMRb ({rmrRes.totalRmr}) + (F1×F2×F3) + F4 = <strong>{smrResult?.smrValue ?? (rmrRes.totalRmr - 8)}</strong>
                  </td>
                  <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                    SMR Stability Class
                  </th>
                  <td className="border border-slate-900 bg-white px-2 py-1 font-black text-emerald-800">
                    {smrResult?.smrClass ?? 'Class III (Partially Stable)'}
                  </td>
                </tr>
              ) : (
                <tr>
                  <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                    Barton Q-System Rating
                  </th>
                  <td className="border border-slate-900 bg-white px-2 py-1 font-mono text-[9.5px]">
                    RQD={activeRound.qSystem.rqd}% | Jn={activeRound.qSystem.jn} | Jr={activeRound.qSystem.jr} | Ja={activeRound.qSystem.ja} | Jw={activeRound.qSystem.jw} | SRF={activeRound.qSystem.srf}
                  </td>
                  <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                    Q-Value &amp; Class
                  </th>
                  <td className="border border-slate-900 bg-white px-2 py-1 font-black text-cyan-800">
                    Q = {qRes.qValue} ({qRes.rockClass})
                  </td>
                </tr>
              )}

              <tr>
                <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                  Hoek-Brown GSI &amp; Strengths
                </th>
                <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-mono text-[9.5px]">
                  GSI = <strong>{activeRound.gsiValue || 55}</strong> | Cohesion c&apos; = <strong>{(25 + (activeRound.gsiValue || 55) * 0.9).toFixed(0)} kPa</strong> | Friction φ&apos; = <strong>{(28 + (activeRound.gsiValue || 55) * 0.22).toFixed(1)}°</strong> | Modulus Erm = <strong>{(8.5 + (activeRound.gsiValue || 55) * 0.28).toFixed(1)} GPa</strong>
                  {isTrench && ` | Safe Foundation Bearing q_all = ${(180 + (activeRound.gsiValue || 55) * 6.5).toFixed(0)} kPa`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Section 2: Domain-Isolated 2D Section & Engineering Design */}
          {isSlopeOrBench ? (
            /* SLOPE & BENCH: Slope/Bench Surface Stabilization Design */
            <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={2} className="border border-slate-900 py-1 px-2 text-left font-black uppercase text-slate-900">
                    2. Slope &amp; Bench Surface Stabilization System Design (Face β={slopeFaceAngle}°)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-1 bg-white">
                    <svg
                      id="field-report-support-2d-svg"
                      viewBox="0 0 840 280"
                      className="w-full h-auto border border-slate-800 bg-white"
                    >
                      <path d="M 60 40 L 220 40 L 460 220 L 780 220" fill="none" stroke="#0f172a" strokeWidth={3} />
                      <path d="M 60 40 L 220 40 L 460 220 L 780 220 L 780 270 L 60 270 Z" fill="#f1f5f9" />
                      <rect x={160} y={30} width={28} height={18} fill="#38bdf8" stroke="#0284c7" strokeWidth={1.5} />
                      <text x={174} y={24} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0369a1" textAnchor="middle">Crest Ditch</text>
                      <path d="M 220 40 L 460 220" fill="none" stroke="#475569" strokeWidth={7} strokeLinecap="round" />
                      <path d="M 218 38 L 462 222" fill="none" stroke="#0284c7" strokeWidth={2} strokeDasharray="4 3" />
                      {[0, 1, 2, 3].map((i) => {
                        const t = (i + 1) / 5;
                        const px = 220 + t * 240;
                        const py = 40 + t * 180;
                        const anchorLen = 80;
                        const angleRad = (15 * Math.PI) / 180;
                        const nx = px - anchorLen * Math.cos(angleRad);
                        const ny = py + anchorLen * Math.sin(angleRad);
                        return (
                          <g key={`nail-${i}`}>
                            <line x1={px} y1={py} x2={nx} y2={ny} stroke="#94a3b8" strokeWidth={7} strokeLinecap="round" />
                            <line x1={px} y1={py} x2={nx} y2={ny} stroke="#dc2626" strokeWidth={2} />
                            <circle cx={px} cy={py} r={5} fill="#f59e0b" stroke="#78350f" strokeWidth={1.5} />
                          </g>
                        );
                      })}
                      <line x1={440} y1={205} x2={280} y2={195} stroke="#0284c7" strokeWidth={3} strokeDasharray="6 3" />
                      <text x={270} y={192} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0284c7">Sub-Horizontal Drain (L=10m @ +4°)</text>
                      <text x={530} y={242} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0f172a">Catchment Berm W={surfaceParams?.bermWidthMeters ?? 6.0}m</text>
                      <text x={380} y={80} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#dc2626">Soil Nails Ø25mm (L={sup.soilNailLengthM ?? 4.5}m @ 1.5×1.5m c/c)</text>
                      <text x={380} y={98} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0284c7">TECCO® G65 High-Tensile Wire Mesh</text>
                      <text x={380} y={116} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#475569">{sup.shotcreteThicknessMm || 75}mm Fiber Shotcrete + Weep Holes</text>
                    </svg>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-0">
                    <table className="w-full border-collapse text-[9.5px]">
                      <tbody>
                        <tr className="bg-slate-50">
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            Soil Nails / Rock Anchors:
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            {sup.soilNailType || 'Ø25mm High-Yield Rebar'}, L={sup.soilNailLengthM ?? 4.5}m @ {sup.soilNailSpacingM ?? 1.5}×{sup.soilNailSpacingM ?? 1.5}m c/c (∠{sup.soilNailAngleDeg ?? 15}° down)
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            High-Tensile Wire Mesh:
                          </td>
                          <td className="border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            {sup.wireMeshType || 'TECCO® G65 High-Tensile Steel Wire Mesh'} with {sup.spikePlateType || 'P33 Diamond Spike Plates'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Fiber Shotcrete &amp; Weeps:
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-mono">
                            {sup.shotcreteThicknessMm || 75}mm SFRS Shotcrete with Ø50mm PVC Weep Holes @ {sup.weepHolesSpacingM ?? 2.0}m c/c
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Drainage &amp; Crest Ditch:
                          </td>
                          <td className="px-2 py-0.5 font-mono">
                            Sub-horizontal Drains L={sup.subHorizontalDrainsLengthM ?? 8.0}m @ +4° up + Concrete Crest Interceptor Ditch
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : isTrench ? (
            /* TRENCH: 2D Trench Cross-Section & Excavation Shoring / Stability Design */
            <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={2} className="border border-slate-900 py-1 px-2 text-left font-black uppercase text-slate-900">
                    2. Trench Sidewall Stability &amp; Excavation Safety / Shoring Design (Depth {trenchDepthM.toFixed(1)}m, Floor {trenchWidthM.toFixed(1)}m)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-1 bg-white">
                    <svg
                      id="field-report-support-2d-svg"
                      viewBox="0 0 840 280"
                      className="w-full h-auto border border-slate-800 bg-white"
                    >
                      {/* Ground Surface & Trench Cut Profile */}
                      <path d="M 40 50 L 260 50 L 260 230 L 580 230 L 580 50 L 800 50" fill="none" stroke="#0f172a" strokeWidth={3} />
                      <path d="M 40 50 L 260 50 L 260 230 L 580 230 L 580 50 L 800 50 L 800 270 L 40 270 Z" fill="#f8fafc" />

                      {/* Trench Safety Shoring Box / Struts (if needed) */}
                      <rect x={266} y={60} width={10} height={165} fill="#0284c7" stroke="#0369a1" strokeWidth={1.5} />
                      <rect x={564} y={60} width={10} height={165} fill="#0284c7" stroke="#0369a1" strokeWidth={1.5} />
                      <line x1={276} y1={100} x2={564} y2={100} stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
                      <line x1={276} y1={180} x2={564} y2={180} stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
                      <circle cx={420} cy={100} r={7} fill="#f59e0b" stroke="#78350f" strokeWidth={1.5} />
                      <circle cx={420} cy={180} r={7} fill="#f59e0b" stroke="#78350f" strokeWidth={1.5} />

                      {/* Invert Bedding Stone Layer */}
                      <rect x={262} y={218} width={316} height={12} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
                      <text x={420} y={227} fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#334155" textAnchor="middle">100mm Crushed Stone Bedding Layer</text>

                      {/* Sump Pit for Dewatering */}
                      <rect x={520} y={230} width={45} height={30} fill="#38bdf8" stroke="#0284c7" strokeWidth={1.5} />
                      <text x={542} y={250} fontSize="8" fontFamily="monospace" fontWeight="bold" fill="#0369a1" textAnchor="middle">Sump</text>

                      {/* Dimension Labels */}
                      <line x1={260} y1={36} x2={580} y2={36} stroke="#0f172a" strokeWidth={1.2} markerStart="url(#arr)" markerEnd="url(#arr)" />
                      <text x={420} y={32} fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">Trench Width Wt = {trenchWidthM.toFixed(1)}m</text>

                      <line x1={235} y1={50} x2={235} y2={230} stroke="#0f172a" strokeWidth={1.2} />
                      <text x={225} y={145} fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle" transform="rotate(-90, 225, 145)">Depth Dt = {trenchDepthM.toFixed(1)}m</text>

                      {/* Callouts */}
                      <text x={420} y={88} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#dc2626" textAnchor="middle">Adjustable Heavy Trench Struts (Spaced 2.0m c/c)</text>
                      <text x={420} y={168} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0284c7" textAnchor="middle">Aluminum / Steel Trench Safety Shield Plates</text>
                      <text x={610} y={120} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#047857">Sound Bedrock Sidewall</text>
                      <text x={610} y={135} fontSize="8" fontFamily="monospace" fill="#475569">Vertical Excavation (Self-Supporting)</text>
                    </svg>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-0">
                    <table className="w-full border-collapse text-[9.5px]">
                      <tbody>
                        <tr className="bg-slate-50">
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            Trench Sidewall Safety / Shoring:
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            {rmrRes.totalRmr >= 55 ? 'Self-Supporting Competent Bedrock (No heavy shoring required)' : 'Hydraulic Aluminum Trench Shields / Steel Trench Box (OSHA Class B/C)'}
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            Invert Bearing Stratum:
                          </td>
                          <td className="border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            Competent rock floor, allowable bearing q_all = {(180 + (activeRound.gsiValue || 55) * 6.5).toFixed(0)} kPa
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Allowable Sidewall Batter:
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-mono">
                            Vertical (90°) in un-weathered rock; 1H:1V (45°) in overburden/weathered zone
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Trench Dewatering:
                          </td>
                          <td className="px-2 py-0.5 font-mono">
                            Invert gravity drainage trench leading to 450mm sump pit with submersible trash pump
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            /* ROCK SURFACE: 2D Outcrop Characterization & Foundation Assessment */
            <table className="w-full border-collapse border border-slate-900 text-[10px] bg-white shrink-0">
              <thead>
                <tr className="bg-slate-100">
                  <th colSpan={2} className="border border-slate-900 py-1 px-2 text-left font-black uppercase text-slate-900">
                    2. Outcrop Rock Mass Characterization &amp; Engineering Foundation Assessment ({slopeWidthM.toFixed(1)}m W × {slopeHeightM.toFixed(1)}m H)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-1 bg-white">
                    <svg
                      id="field-report-support-2d-svg"
                      viewBox="0 0 840 280"
                      className="w-full h-auto border border-slate-800 bg-white"
                    >
                      {/* Outcrop Window Framing Profile */}
                      <rect x={100} y={40} width={640} height={200} fill="#f8fafc" stroke="#0f172a" strokeWidth={2.5} />
                      <rect x={100} y={40} width={640} height={200} fill="url(#srf-rep-pat-monochrome-granite)" opacity={0.3} />

                      {/* Structural Joint Grid Illustrating Blockiness */}
                      <line x1={260} y1={40} x2={260} y2={240} stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="6 3" />
                      <line x1={420} y1={40} x2={420} y2={240} stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="6 3" />
                      <line x1={580} y1={40} x2={580} y2={240} stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="6 3" />

                      <line x1={100} y1={105} x2={740} y2={105} stroke="#d97706" strokeWidth={1.8} strokeDasharray="6 3" />
                      <line x1={100} y1={175} x2={740} y2={175} stroke="#d97706" strokeWidth={1.8} strokeDasharray="6 3" />

                      {/* Outcrop Window Dimensions */}
                      <line x1={100} y1={28} x2={740} y2={28} stroke="#0f172a" strokeWidth={1.2} />
                      <text x={420} y={23} fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">Outcrop Span Wr = {slopeWidthM.toFixed(1)}m</text>

                      <line x1={80} y1={40} x2={80} y2={240} stroke="#0f172a" strokeWidth={1.2} />
                      <text x={70} y={145} fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle" transform="rotate(-90, 70, 145)">Height Hr = {slopeHeightM.toFixed(1)}m</text>

                      {/* Callouts */}
                      <text x={260} y={95} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#047857">Primary Joint Set J1 (Spacing 1.2m)</text>
                      <text x={420} y={165} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#d97706">Cross Jointing J2 (Spacing 0.8m)</text>
                      <text x={420} y={225} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">Base Ground Exposure / Footprint (+0.0m EL)</text>
                    </svg>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-900 p-0">
                    <table className="w-full border-collapse text-[9.5px]">
                      <tbody>
                        <tr className="bg-slate-50">
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            Rock Mass Structural Fabric:
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            {activeRound.rockMassStructuralType || 'Interlocked / Blocky Bedrock'} (Degree of jointing: Moderate)
                          </td>
                          <td className="border-r border-b border-slate-900 px-2 py-0.5 font-bold w-[22%]">
                            Surface Quality &amp; Hardness:
                          </td>
                          <td className="border-b border-slate-900 px-2 py-0.5 font-mono w-[28%]">
                            {activeRound.surfaceQualityType || 'Good (Fresh, rough unweathered surfaces)'}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Excavation / Ripperability:
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-mono">
                            Direct ripping not feasible (UCS &gt; 45 MPa); hydraulic breaker or controlled blasting required
                          </td>
                          <td className="border-r border-slate-900 px-2 py-0.5 font-bold">
                            Foundation Bearing Suitability:
                          </td>
                          <td className="px-2 py-0.5 font-mono">
                            High bearing capacity sound bedrock; allowable bearing pressure q_all &gt; 2.5 MPa
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Section 3: Overall Geological Observations & Field Recommendations */}
          <table className="w-full border-collapse border border-slate-900 text-[10.5px] bg-white flex-1">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 py-1 px-2 text-left font-black uppercase text-slate-900">
                  {isTrench
                    ? '3. Overall Trench Engineering Geological Summary & Foundation Bedrock Evaluation'
                    : isRockSurface
                    ? '3. Overall Geological Observations & Outcrop Engineering Suitability Summary'
                    : '3. Overall Geological Observations & Surface Stabilization Instructions'}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 bg-white p-2 align-top">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const nextText = e.currentTarget.innerText.trim();
                      if (nextText) {
                        onUpdateRound((r) => ({ ...r, geologicalDescription: nextText }));
                      }
                    }}
                    className="w-full bg-white text-slate-950 text-[10.5px] leading-relaxed whitespace-pre-wrap break-words min-h-[90px] focus:outline-none"
                  >
                    {activeRound.geologicalDescription ||
                      (isTrench
                        ? `TRENCH GEOLOGICAL & FOUNDATION LOG (ST ${activeRound.chainageFrom}–${activeRound.chainageTo}m):\n` +
                          `1. Trench excavated to depth Dt=${trenchDepthM.toFixed(1)}m and invert width Wt=${trenchWidthM.toFixed(1)}m across ${activeRound.rockType || 'Competent Bedrock'}.\n` +
                          `2. Sidewall stability logged across ${availableSetIds.length} discontinuity sets; sidewalls exhibit competent self-supporting behaviour with no deep ravelling.\n` +
                          `3. Trench floor / invert comprises sound un-weathered rock suitable for structural foundation loading (Allowable Bearing q_all = ${(180 + (activeRound.gsiValue || 55) * 6.5).toFixed(0)} kPa).\n` +
                          `4. Groundwater conditions are predominantly dry with minor seepage controlled via floor gravity ditch to temporary sump.`
                        : isRockSurface
                        ? `OUTCROP GEOLOGICAL EXPOSURE LOG (CH ${activeRound.chainageFrom}–${activeRound.chainageTo}m):\n` +
                          `1. Rock exposure window mapped across ${slopeWidthM.toFixed(1)}m span comprises ${activeRound.rockType || 'Jointed Bedrock'} with ${availableSetIds.length} governing joint sets.\n` +
                          `2. Rock mass classified as ${rmrRes.rmrClass} (RMR=${rmrRes.totalRmr}) and Q=${qRes.qValue} (${qRes.rockClass}) with GSI=${activeRound.gsiValue || 55}.\n` +
                          `3. In-situ blockiness is moderate (Jv = 6.8 joints/m³) with tightly interlocked joints and sound rock substance.\n` +
                          `4. Outcrop is suitable for direct foundation bearing, structural abutment founding, and open excavation cut slopes.`
                        : `SURFACE STABILIZATION SPECIFICATION (${mappingDomain} MAPPING):\n` +
                          `1. Rock mass mapped at CH ${activeRound.chainageFrom}–${activeRound.chainageTo}m comprises ${activeRound.rockType || 'Jointed Bedrock'} with ${availableSetIds.length} governing joint sets.\n` +
                          `2. Recommended Surface Stabilization: Install ${sup.soilNailType || 'Ø25mm SN Rebar Dowels'} (L=${sup.soilNailLengthM ?? 4.5}m @ ${sup.soilNailSpacingM ?? 1.5}×${sup.soilNailSpacingM ?? 1.5}m c/c) drilled at 15° declination with OPC cement grout.\n` +
                          `3. Drape ${sup.wireMeshType || 'TECCO® G65 High-Tensile Mesh'} fastened by P33 spike plates followed by ${sup.shotcreteThicknessMm || 75}mm SFRS fiber shotcrete with Ø50mm PVC weep holes @ 2.0m c/c.\n` +
                          `4. Excavate and maintain concrete-lined crest interceptor ditch along upper slope boundary to divert runoff.`)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {activeRound.femDemAnalysis?.includeInEswaReport && (
            <FieldFemDemReportEmbedSection
              activeProject={activeProject}
              activeLocation={activeLocation}
              activeRound={activeRound}
              mappingDomain={mappingDomain}
              surfaceParams={surfaceParams}
            />
          )}
        </div>

        {/* Bottom Signatures */}
        {renderCompactSignBlock('Page 3/3 - Final Sign-off')}
      </div>
    </>
  );
};

// ============================================================================
// STAGE 7: 2-PAGE / 3-PAGE REFERENCE REPORT + WORD TEMPLATE ENGINE
// ============================================================================
export const FieldTwoPageReportAndTemplateStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  onUpdateProject: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToParams: () => void;
  onSaveAndReturnToProjectSetup?: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  surfaceParams,
  onUpdateProject,
  onUpdateRound,
  onBackToParams,
  onSaveAndReturnToProjectSetup,
}) => {
  const [savedBanner, setSavedBanner] = useState<boolean>(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportBanner, setExportBanner] = useState<string | null>(null);

  const isSurface =
    mappingDomain === 'SLOPE' ||
    mappingDomain === 'BENCH' ||
    mappingDomain === 'TRENCH' ||
    mappingDomain === 'ROCK_SURFACE';

  const colorMode = activeRound.reportColorMode || 'bw';
  const selClass = activeRound.selectedClassifications || { q: true, rmr: true, gsi: true };
  const qRes = computeFieldQValue(activeRound.qSystem);
  const rmrRes = computeFieldRmrValue(activeRound.rmrSystem);

  const isSlopeOrBench = mappingDomain === 'SLOPE' || mappingDomain === 'BENCH';
  const smrResult = useMemo(() => {
    if (!isSlopeOrBench || !surfaceParams) return null;
    const jointSetsArray = FIELD_JOINT_SET_IDS.filter(
      (id) =>
        activeRound.jointTraces.some((j) => j.setId === id) ||
        activeRound.dipPlaneSurfaces.some((d) => d.setId === id) ||
        activeRound.discontinuitySets[id]?.manualOrientationOverride
    ).map((id) => {
      const s = activeRound.discontinuitySets[id];
      return {
        id,
        meanDip: s ? (s.dipAmountFrom + s.dipAmountTo) / 2 : 60,
        meanDipDirection: s ? (s.dipDirectionFrom + s.dipDirectionTo) / 2 : 135,
      };
    });
    return evaluateSurfaceStabilityAndRomanaSmr(
      surfaceParams,
      jointSetsArray,
      rmrRes.totalRmr
    );
  }, [
    isSlopeOrBench,
    surfaceParams,
    activeRound.jointTraces,
    activeRound.dipPlaneSurfaces,
    activeRound.discontinuitySets,
    rmrRes.totalRmr,
  ]);

  // Toggle a tick-box option on Page 2
  const handleToggleTickOption = (groupId: string, optionIdx: number) => {
    onUpdateRound((r) => ({
      ...r,
      customTickBoxGroups: (r.customTickBoxGroups || []).map((grp) => {
        if (grp.id !== groupId) return grp;
        return {
          ...grp,
          options: grp.options.map((opt, idx) =>
            idx === optionIdx ? { ...opt, checked: !opt.checked } : opt
          ),
        };
      }),
    }));
  };

  const handleDeleteTickGroup = (groupId: string) => {
    onUpdateRound((r) => ({
      ...r,
      customTickBoxGroups: (r.customTickBoxGroups || []).filter((g) => g.id !== groupId),
    }));
  };

  const handleExportTwoPageWordDoc = async () => {
    try {
      setIsExportingWord(true);
      setExportBanner('Preparing Microsoft Word (.doc) document with tables & vector sketch...');
      const svgEl = (document.getElementById(
        'field-surface-report-svg'
      ) ||
        document.getElementById(
          'field-unfolded-report-svg'
        )) as unknown as SVGSVGElement | null;
      const supSvgEl = document.getElementById(
        'field-report-support-2d-svg'
      ) as unknown as SVGSVGElement | null;
      const vbH = svgEl?.viewBox?.baseVal?.height || 610;
      const [pngDataUrl, supportPngUrl] = await Promise.all([
        renderSvgElementToHighResPngDataUrl(svgEl, 1600, Math.round((1600 * vbH) / 920)),
        renderSvgElementToHighResPngDataUrl(supSvgEl, 1400, 740),
      ]);
      exportFieldMappingTwoPageWordSheet(
        activeProject,
        activeLocation,
        activeRound,
        pngDataUrl,
        supportPngUrl,
        mappingDomain,
        surfaceParams
      );
      if (activeRound) {
        try {
          syncFieldMappingRoundForAiTraining(
            activeRound,
            activeProject || undefined,
            activeLocation || undefined,
            'EXPORT_GENERATED'
          );
        } catch {}
      }
      setExportBanner('Word Document (.doc) downloaded successfully!');
      setTimeout(() => setExportBanner(null), 3500);
    } catch (err: any) {
      console.error('Word export error:', err);
      setExportBanner('Word download error, retrying without embedded raster...');
      try {
        exportFieldMappingTwoPageWordSheet(
          activeProject,
          activeLocation,
          activeRound,
          null,
          null,
          mappingDomain,
          surfaceParams
        );
      } catch {}
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleExportTwoPagePdfDoc = async (pageSize: 'A4' | 'A3' = 'A4') => {
    try {
      setIsExportingPdf(true);
      setExportBanner(`Rendering high-resolution ${isSurface ? '3-Page' : '2-Page'} ${pageSize} standalone PDF...`);
      const svgEl = (document.getElementById(
        'field-surface-report-svg'
      ) ||
        document.getElementById(
          'field-unfolded-report-svg'
        )) as unknown as SVGSVGElement | null;
      const supSvgEl = document.getElementById(
        'field-report-support-2d-svg'
      ) as unknown as SVGSVGElement | null;
      const vbH = svgEl?.viewBox?.baseVal?.height || 610;
      const [pngDataUrl, supportPngUrl] = await Promise.all([
        renderSvgElementToHighResPngDataUrl(svgEl, 1600, Math.round((1600 * vbH) / 920)),
        renderSvgElementToHighResPngDataUrl(supSvgEl, 1400, 740),
      ]);
      await exportFieldMappingTwoPagePdfSheet(
        {
          project: activeProject,
          location: activeLocation,
          round: activeRound,
          sketchPngDataUrl: pngDataUrl,
          support2DPngDataUrl: supportPngUrl,
          pageSize,
          orientation: 'portrait',
          mappingDomain,
          surfaceParams,
        }
      );
      if (activeRound) {
        try {
          syncFieldMappingRoundForAiTraining(
            activeRound,
            activeProject || undefined,
            activeLocation || undefined,
            'EXPORT_GENERATED'
          );
        } catch {}
      }
      setExportBanner(`${pageSize} PDF Report downloaded successfully!`);
      setTimeout(() => setExportBanner(null), 3500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setExportBanner('PDF export error: generating standard PDF...');
      try {
        await exportFieldMappingTwoPagePdfSheet({
          project: activeProject,
          location: activeLocation,
          round: activeRound,
          pageSize,
          orientation: 'portrait',
          mappingDomain,
          surfaceParams,
        });
      } catch {}
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-2 p-1.5 sm:p-2.5 overflow-hidden bg-slate-950">
      {/* Live Interactive 2-Page Reference Report (Full Width unless Template Edit is opened) */}
      <div
        className={`${
          showTemplateEditor ? 'lg:col-span-8' : 'lg:col-span-12'
        } min-h-0 h-full bg-slate-900/90 border border-slate-800 rounded-xl p-2 sm:p-2.5 flex flex-col overflow-hidden`}
      >
        {/* Top Report Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onBackToParams}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Parameters
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateEditor((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                showTemplateEditor
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
              title="Open or close Template Edit Options (Header Logos, Missing Tick-Boxes & Custom Word Template)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTemplateEditor ? 'Close Template Edit' : 'Template Edit'}</span>
            </button>
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
              {isSurface
                ? `Clean Surface Geological Report (${mappingDomain} • 3-Page A4 Vertical Layout)`
                : 'Engineering Geological Face Log (2-Page A4 Vertical Layout)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Colourful vs Black & White Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() =>
                  onUpdateRound((r) => ({ ...r, reportColorMode: 'color' }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                  colorMode === 'color'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Colourful
              </button>
              <button
                onClick={() =>
                  onUpdateRound((r) => ({ ...r, reportColorMode: 'bw' }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  colorMode === 'bw'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Black &amp; White
              </button>
            </div>

            {/* Option B: Include FEM & DEM Analysis Summary Toggle */}
            <label
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-cyan-500/50 text-[11px] font-bold text-cyan-300 cursor-pointer hover:bg-slate-900"
              title="Option B: Append FEM & DEM Continuum/Discontinuum Analysis Summary to this ESWA Geological Report"
            >
              <input
                type="checkbox"
                checked={Boolean(activeRound.femDemAnalysis?.includeInEswaReport)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onUpdateRound((r) => ({
                    ...r,
                    femDemAnalysis: {
                      ...(r.femDemAnalysis || createDefaultFemDemConfig()),
                      includeInEswaReport: checked,
                    },
                  }));
                }}
                className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
              />
              <span>+ FEM &amp; DEM Summary</span>
            </label>

            <button
              type="button"
              disabled={isExportingWord}
              onClick={handleExportTwoPageWordDoc}
              className={`px-3 py-1.5 rounded-lg text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer ${
                isExportingWord
                  ? 'bg-emerald-300 opacity-75 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
              title="Download Microsoft Word 2-page document with editable tables and vector graphics"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingWord ? 'Exporting Word...' : 'Download Word (.doc)'}
            </button>
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => handleExportTwoPagePdfDoc('A4')}
              className={`px-3 py-1.5 rounded-lg text-white font-black text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer ${
                isExportingPdf
                  ? 'bg-rose-400 opacity-75 cursor-wait'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
              title="Download 2-Page A4 Portrait PDF (210×297mm) perfectly fitted to page"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingPdf ? 'Exporting...' : 'Download PDF (A4)'}
            </button>
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => handleExportTwoPagePdfDoc('A3')}
              className={`px-3 py-1.5 rounded-lg text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer ${
                isExportingPdf
                  ? 'bg-amber-300 opacity-75 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-300'
              }`}
              title="Download 2-Page High-Resolution A3 PDF (297×420mm) perfectly fitted to page"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF (A3)
            </button>
            {onSaveAndReturnToProjectSetup && (
              <button
                type="button"
                onClick={() => {
                  setSavedBanner(true);
                  setTimeout(() => setSavedBanner(false), 2500);
                  onSaveAndReturnToProjectSetup();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedBanner ? 'Saved to Project Data!' : 'Save Round to Project Data'}
              </button>
            )}
          </div>
        </div>

        {exportBanner && (
          <div className="mx-2 mb-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportBanner}</span>
          </div>
        )}

        {/* Scrollable Document Container: 3-Page for Surface vs 2-Page for Tunnel */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1 bg-slate-800/60 p-2 sm:p-3.5 rounded-lg touch-pan-y">
          {isSurface ? (
            <FieldSurfaceMappingThreePageReport
              activeProject={activeProject}
              activeLocation={activeLocation}
              activeRound={activeRound}
              mappingDomain={mappingDomain}
              surfaceParams={surfaceParams}
              colorMode={colorMode}
              selClass={selClass}
              qRes={qRes}
              rmrRes={rmrRes}
              smrResult={smrResult}
              onUpdateRound={onUpdateRound}
              handleToggleTickOption={handleToggleTickOption}
              handleDeleteTickGroup={handleDeleteTickGroup}
            />
          ) : (
            <>
              {/* ==================== PAGE 1 OF 2 (A4 VERTICAL: 210mm × 297mm) ==================== */}
              <div
                id="field-mapping-report-page-1"
                className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2 sm:p-3 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-hidden print:shadow-none print:w-[210mm] print:min-h-[297mm] print:break-after-page"
              >
            {/* TOP: Compact Basic Details Header (Small in size, zero wasted space) */}
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <tbody>
                <tr>
                  <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                    {activeProject.leftLogoDataUrl ? (
                      <img
                        src={activeProject.leftLogoDataUrl}
                        alt="Client Logo"
                        className="max-h-7 mx-auto object-contain"
                      />
                    ) : (
                      <div className="text-[9px] font-bold text-slate-950 leading-tight">
                        {activeProject.clientName || 'CLIENT'}
                      </div>
                    )}
                  </td>
                  <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
                    <div className="text-[11px] font-black tracking-wide uppercase text-slate-950 leading-tight">
                      ENGINEERING GEOLOGICAL FACE LOG — {activeProject.projectName} ({activeLocation.name})
                      <span className="text-[9px] font-semibold text-slate-700 ml-1.5">[Page 1/2]</span>
                    </div>
                  </td>
                  <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                    {activeProject.rightLogoDataUrl ? (
                      <img
                        src={activeProject.rightLogoDataUrl}
                        alt="Contractor Logo"
                        className="max-h-7 mx-auto object-contain"
                      />
                    ) : (
                      <div className="text-[9px] font-bold text-slate-950 leading-tight">
                        {activeProject.contractorName || 'CONTRACTOR'}
                      </div>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Client/Cons:</span> {activeProject.clientName} / {activeProject.consultantName}
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Chainage:</span> CH {activeRound.chainageFrom}–{activeRound.chainageTo}m (Pull {activeRound.pullLengthMeters}m)
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Shape/Size:</span> {activeLocation.shape.replace(/_/g, ' ').toUpperCase()} ({activeLocation.widthM}m×{activeLocation.heightM}m)
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Date/Drive:</span> {activeRound.dateAndTimeOfExcavation} | N{String(activeRound.tunnelDriveDirection).padStart(3, '0')}°
                  </td>
                </tr>
              </tbody>
            </table>

            {/* MIDDLE: Main Geological Sketch (Large Adapted Face Picture + Legends Box Below Face + Unfolded Strip) + Joint Sets Table */}
            <div className="flex-1 flex flex-col justify-between gap-1.5 my-0.5">
              <div className="border border-slate-900 p-1 bg-white flex-1 flex flex-col justify-center">
                <div id="field-unfolded-report-svg-wrapper" className="w-full">
                  <FieldUnfoldedSheetSvgPreview
                    location={activeLocation}
                    round={activeRound}
                    colorMode={colorMode}
                  />
                </div>
              </div>

              {/* Section 1 (On Page 1): Discontinuity / Joint Sets Parameters Table (Normal White Box) */}
              <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={10} className="border border-slate-900 bg-white py-0.5 px-2 text-center font-black">
                      1. DISCONTINUITY / JOINT SETS PARAMETERS (J1–J5, J-BEDDING, J-RANDOM)
                    </th>
                  </tr>
                  <tr className="bg-white">
                    <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Set</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Dip Dir (°)</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5 text-center">Dip Amt (°)</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Spacing</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Persistence</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Aperture</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Roughness</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Infilling</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Weathering</th>
                    <th className="border border-slate-900 bg-white px-1 py-0.5">Water</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const availableSetIds = FIELD_JOINT_SET_IDS.filter(
                      (setId) =>
                        activeRound.jointTraces.some((j) => j.setId === setId) ||
                        activeRound.dipPlaneSurfaces.some((d) => d.setId === setId) ||
                        activeRound.discontinuitySets[setId]?.manualOrientationOverride
                    );
                    if (availableSetIds.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan={10}
                            className="border border-slate-900 bg-white px-2 py-1 text-center text-slate-700 italic"
                          >
                            No grouped discontinuity sets mapped on canvas.
                          </td>
                        </tr>
                      );
                    }
                    return availableSetIds.map((setId) => {
                      const s = activeRound.discontinuitySets[setId];
                      const grpColor = FIELD_JOINT_GROUP_COLORS[setId];
                      return (
                        <tr key={setId} className="bg-white">
                          <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-black">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1"
                              style={{
                                backgroundColor:
                                  colorMode === 'color' ? grpColor.stroke : '#0f172a',
                              }}
                            />
                            {s.setId}
                          </td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-mono">
                            {String(s.dipDirectionFrom).padStart(3, '0')}°–
                            {String(s.dipDirectionTo).padStart(3, '0')}°
                          </td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5 text-center font-mono">
                            {s.dipAmountFrom}°–{s.dipAmountTo}°
                          </td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.spacing}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.persistence}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.aperture}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.roughness}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.infilling}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.weathering}</td>
                          <td className="border border-slate-900 bg-white px-1 py-0.5">{s.groundwater}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* BOTTOM: Compact Single-Row Geologist Sign Block (Small in size, zero wasted space) */}
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-black uppercase shrink-0">Contractor Geologist:</span>
                      <input
                        type="text"
                        value={
                          activeRound.contractorGeologistName ??
                          activeRound.contractorRepName ??
                          activeRound.geologistName ??
                          ''
                        }
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            contractorGeologistName: e.target.value,
                            geologistName: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
                      />
                      <span className="font-bold text-slate-900 shrink-0">Sign:</span>
                      <input
                        type="text"
                        value={activeRound.contractorGeologistSign ?? ''}
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            contractorGeologistSign: e.target.value,
                          }))
                        }
                        placeholder="Sign"
                        className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-black uppercase shrink-0">Client Geologist:</span>
                      <input
                        type="text"
                        value={
                          activeRound.clientGeologistName ?? activeRound.clientRepName ?? ''
                        }
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            clientGeologistName: e.target.value,
                            clientRepName: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
                      />
                      <span className="font-bold text-slate-900 shrink-0">Sign:</span>
                      <input
                        type="text"
                        value={activeRound.clientGeologistSign ?? ''}
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            clientGeologistSign: e.target.value,
                          }))
                        }
                        placeholder="Sign"
                        className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ==================== PAGE 2 OF 2 (A4 VERTICAL: 210mm × 297mm) ==================== */}
          <div
            id="field-mapping-report-page-2"
            className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2 sm:p-3 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-hidden print:shadow-none print:w-[210mm] print:min-h-[297mm]"
          >
            {/* TOP: Compact Basic Details Header (Small in size, zero wasted space) */}
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <tbody>
                <tr>
                  <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                    {activeProject.leftLogoDataUrl ? (
                      <img
                        src={activeProject.leftLogoDataUrl}
                        alt="Client Logo"
                        className="max-h-7 mx-auto object-contain"
                      />
                    ) : (
                      <span className="text-[9px] font-bold">
                        {activeProject.clientName || 'CLIENT'}
                      </span>
                    )}
                  </td>
                  <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
                    <div className="text-[11px] font-black uppercase leading-tight">
                      ENGINEERING GEOLOGICAL FACE LOG — {activeProject.projectName} ({activeLocation.name})
                      <span className="text-[9px] font-semibold text-slate-700 ml-1.5">[Page 2/2]</span>
                    </div>
                  </td>
                  <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
                    {activeProject.rightLogoDataUrl ? (
                      <img
                        src={activeProject.rightLogoDataUrl}
                        alt="Contractor Logo"
                        className="max-h-7 mx-auto object-contain"
                      />
                    ) : (
                      <span className="text-[9px] font-bold">
                        {activeProject.contractorName || 'CONTRACTOR'}
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Location:</span> {activeLocation.name}
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Chainage:</span> CH {activeRound.chainageFrom}–{activeRound.chainageTo}m (Pull {activeRound.pullLengthMeters}m)
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Shape/Size:</span> {activeLocation.shape.replace(/_/g, ' ').toUpperCase()} ({activeLocation.widthM}m×{activeLocation.heightM}m)
                  </td>
                  <td className="border border-slate-900 bg-white px-1.5 py-0.5">
                    <span className="font-bold">Excavation:</span> {activeRound.modeOfExcavation} | {activeRound.dateAndTimeOfExcavation}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* MIDDLE: Page 2 Engineering Sections Utilizing Full Vertical Space */}
            <div className="flex-1 flex flex-col justify-between gap-2 my-0.5">
              {/* Section 2: Interactive Template Tick-Box Matrix (Normal White Box) */}
              <table className="w-full border-collapse border border-slate-900 text-[10.5px] bg-white shrink-0">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={2} className="border border-slate-900 bg-white py-1 px-2 text-center font-black">
                      2. ROCK MASS INDICES &amp; INTERACTIVE FIELD TICK-BOX CHECKLIST (CLICK TO TICK)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[28%]">
                      Weathering Index (WI – WVI)
                    </th>
                    <td className="border border-slate-900 bg-white px-2 py-1">
                      <div className="flex flex-wrap gap-3.5">
                        {(['WI', 'WII', 'WIII', 'WIV', 'WV', 'WVI'] as const).map((w) => {
                          const checked = activeRound.weatheringIndex === w;
                          return (
                            <button
                              key={w}
                              onClick={() =>
                                onUpdateRound((r) => ({ ...r, weatheringIndex: w }))
                              }
                              className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-amber-700"
                            >
                              <span className="text-xs">{checked ? '☑' : '☐'}</span>
                              <span>{w}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                      Strength Index (S1 – S6)
                    </th>
                    <td className="border border-slate-900 bg-white px-2 py-1">
                      <div className="flex flex-wrap gap-3.5">
                        {(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const).map((s) => {
                          const checked = activeRound.strengthIndex === s;
                          return (
                            <button
                              key={s}
                              onClick={() =>
                                onUpdateRound((r) => ({ ...r, strengthIndex: s }))
                              }
                              className="inline-flex items-center gap-1 font-bold text-slate-900 hover:text-amber-700"
                            >
                              <span className="text-xs">{checked ? '☑' : '☐'}</span>
                              <span>{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>

                  {/* Dynamic / Custom Tick-Box Groups (including user-added missing data rows) */}
                  {(activeRound.customTickBoxGroups || []).map((grp) => (
                    <tr key={grp.id}>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        <div className="flex items-center justify-between">
                          <span>{grp.categoryTitle}</span>
                          <button
                            onClick={() => handleDeleteTickGroup(grp.id)}
                            title="Remove tick-box row"
                            className="text-rose-600 hover:text-rose-800 ml-1 print:hidden"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <td className="border border-slate-900 bg-white px-2 py-1">
                        <div className="flex flex-wrap gap-3.5">
                          {grp.options.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleToggleTickOption(grp.id, idx)}
                              className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-amber-700"
                            >
                              <span className="text-xs">{opt.checked ? '☑' : '☐'}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Section 3: Chosen Rock Mass Classification Results (Normal White Box) */}
              <table className="w-full border-collapse border border-slate-900 text-[10.5px] bg-white shrink-0">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={6} className="border border-slate-900 bg-white py-1 px-2 text-center font-black">
                      3. SELECTED ROCK MASS CLASSIFICATIONS (
                      {[
                        selClass.q ? 'BARTON Q-SYSTEM' : null,
                        selClass.rmr ? 'BIENIAWSKI RMR89' : null,
                        selClass.gsi ? 'HOEK-BROWN GSI' : null,
                        activeRound.supportSystem?.protectionSupportEnabled ||
                        selClass.protectionSupport
                          ? (
                              activeRound.supportSystem?.protectionSupportMode ||
                              'PROTECTION / CAVITY SUPPORT'
                            ).toUpperCase()
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'NONE SELECTED'}
                      )
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selClass.q && (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        Q-System Parameters
                      </th>
                      <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-mono">
                        RQD={activeRound.qSystem.rqd}% | Jn={activeRound.qSystem.jn} | Jr=
                        {activeRound.qSystem.jr} | Ja={activeRound.qSystem.ja} | Jw=
                        {activeRound.qSystem.jw} | SRF={activeRound.qSystem.srf}
                      </td>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        Q-Value &amp; Class
                      </th>
                      <td className="border border-slate-900 bg-white px-2 py-1 font-black">
                        Q = {qRes.qValue} ({qRes.rockClass})
                      </td>
                    </tr>
                  )}
                  {selClass.rmr && (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        RMR89 Ratings
                      </th>
                      <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-mono">
                        UCS={activeRound.rmrSystem.ucsRating} | RQD=
                        {activeRound.rmrSystem.rqdRating} | Spacing=
                        {activeRound.rmrSystem.spacingRating} | Cond=
                        {activeRound.rmrSystem.conditionRating} | Water=
                        {activeRound.rmrSystem.waterRating} | Adj=
                        {activeRound.rmrSystem.orientationAdj}
                      </td>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        RMR89 &amp; Class
                      </th>
                      <td className="border border-slate-900 bg-white px-2 py-1 font-black">
                        RMR = {rmrRes.totalRmr} ({rmrRes.rmrClass})
                      </td>
                    </tr>
                  )}
                  {selClass.gsi && (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        Hoek-Brown GSI
                      </th>
                      <td colSpan={5} className="border border-slate-900 bg-white px-2 py-1 font-black">
                        GSI = {activeRound.gsiValue} ({activeRound.rockMassStructuralType} /{' '}
                        {activeRound.surfaceQualityType})
                      </td>
                    </tr>
                  )}
                  {(activeRound.supportSystem?.protectionSupportEnabled ||
                    selClass.protectionSupport) && (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                        {activeRound.supportSystem?.protectionSupportMode ||
                          'Protection / Cavity Support'}
                      </th>
                      <td colSpan={5} className="border border-slate-900 bg-white px-2 py-1 font-semibold">
                        {[
                          activeRound.supportSystem?.forepolingEnabled !== false
                            ? `Forepoling: ${activeRound.supportSystem?.forepolingType || 'Grouted Rebar Spiles'} Ø${activeRound.supportSystem?.forepolingDiameterMm ?? 32}mm, L=${activeRound.supportSystem?.forepolingLengthM ?? 4.0}m @ ${activeRound.supportSystem?.forepolingSpacingCm ?? 30}cm c/c (${activeRound.supportSystem?.forepolingSector || 'Crown 120°'})`
                            : null,
                          activeRound.supportSystem?.pipeRoofingEnabled
                            ? `Pipe Roofing: ${activeRound.supportSystem?.pipeRoofingType || 'Perforated Steel Canopy Tube'} Ø${activeRound.supportSystem?.pipeRoofingDiameterMm ?? 114}mm × ${activeRound.supportSystem?.pipeRoofingThicknessMm ?? 6.0}mm, L=${activeRound.supportSystem?.pipeRoofingLengthM ?? 12.0}m @ ${activeRound.supportSystem?.pipeRoofingSpacingCm ?? 40}cm c/c`
                            : null,
                          activeRound.supportSystem?.groutingEnabled
                            ? `Grouting: ${activeRound.supportSystem?.groutingType || 'Consolidation Grouting'} (${activeRound.supportSystem?.groutingMaterial || 'OPC Cement + Micro-Silica'}, W/C ${activeRound.supportSystem?.groutingWCRatio || '0.8:1'}) L=${activeRound.supportSystem?.groutingHoleLengthM ?? 6.0}m, ${activeRound.supportSystem?.groutingHoleCount ?? 8} holes @ ${activeRound.supportSystem?.groutingPressureBar ?? 15} bar`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' | ') || 'Enabled'}
                      </td>
                    </tr>
                  )}
                  {activeRound.supportSystem?.junctionFactorEnabled && (() => {
                    const jAdj = computeJunctionGeotechnicalAdjustments(activeRound.supportSystem, activeRound);
                    return (
                      <tr>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Junction Factor &amp; Advance
                        </th>
                        <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-mono text-[10px]">
                          Type: <strong>{activeRound.supportSystem.junctionTypeLabel || 'Junction'}</strong> (∠{jAdj.junctionAngleDeg}°) | Jf: <strong>{jAdj.effectiveMultiplier}x</strong> | Adv Factor: <strong>{jAdj.junctionAdvanceFactor}x</strong> (Nominal: {jAdj.baselinePullM}m → Rec. Pull: <strong>{jAdj.recommendedAdvancePullM}m</strong>, -{jAdj.advanceReductionPct}%)
                        </td>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Adjusted Q / RMR
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-black text-amber-950">
                          Q<sub>adj</sub> = {jAdj.adjustedQ} ({jAdj.adjustedQClass.split('—')[0].trim()}) | RMR<sub>adj</sub> = {jAdj.adjustedRmr} ({jAdj.adjustedRmrClass.split('—')[0].trim()})
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>

              {/* Section 4: 2D Support System Drawing & Support Schedule (Normal White Box) */}
              <table className="w-full border-collapse border border-slate-900 text-[10.5px] bg-white shrink-0">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={2} className="border border-slate-900 bg-white py-1 px-2 text-left font-black">
                      4. ROCK SUPPORT SYSTEM DESIGN &amp; 2D ENGINEERING OUTLINE ({activeLocation.shape.replace(/_/g, ' ').toUpperCase()} — {activeLocation.widthM}m W × {activeLocation.heightM}m H)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="border border-slate-900 p-1.5 bg-white">
                      <FieldSupport2DCrossSectionSvg
                        svgId="field-report-support-2d-svg"
                        location={activeLocation}
                        round={activeRound}
                        support={activeRound.supportSystem || createDefaultSupportSystem()}
                        pullLengthM={activeRound.pullLengthMeters}
                        compactForReport={true}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Section 5: Survey Overbreak Summary (Normal White Box) */}
              <table className="w-full border-collapse border border-slate-900 text-[10.5px] bg-white shrink-0">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={4} className="border border-slate-900 bg-white py-1 px-2 text-left font-black">
                      5. TUNNEL FACE SURVEY, CONTRACT PAYLINE &amp; REAL OVERBREAK (OB) ASSESSMENT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeRound.surveyOverbreak?.status === 'completed' ? (
                    <>
                      <tr>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[22%]">
                          Design / Excavated Area
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-mono w-[28%]">
                          {activeRound.surveyOverbreak.designAreaM2.toFixed(2)} m² /{' '}
                          {activeRound.surveyOverbreak.excavatedAreaM2.toFixed(2)} m²
                        </td>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[22%]">
                          Contract Payline (+{activeRound.surveyOverbreak.paylineOffsetMm ?? 150}mm)
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-mono font-bold w-[28%] text-emerald-800">
                          {(
                            activeRound.surveyOverbreak.paylineAreaM2 ||
                            activeRound.surveyOverbreak.designAreaM2 * 1.08
                          ).toFixed(2)}{' '}
                          m² (Allowance: +
                          {(
                            (activeRound.surveyOverbreak.paylineAreaM2 ||
                              activeRound.surveyOverbreak.designAreaM2 * 1.08) -
                            activeRound.surveyOverbreak.designAreaM2
                          ).toFixed(2)}{' '}
                          m²)
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Permissible OB (Payable)
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-mono font-bold text-emerald-800">
                          {(activeRound.surveyOverbreak.permissibleOverbreakAreaM2 ?? 0).toFixed(2)} m² (
                          {(activeRound.surveyOverbreak.permissibleOverbreakVolumeM3 ?? 0).toFixed(2)} m³)
                        </td>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Real Overbreak (Site Loss)
                        </th>
                        <td
                          className={`border border-slate-900 px-2 py-1 font-mono font-black ${
                            activeRound.surveyOverbreak.isRealOverbreak &&
                            (activeRound.surveyOverbreak.realOverbreakAreaM2 || 0) > 0.01
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {activeRound.surveyOverbreak.isRealOverbreak &&
                          (activeRound.surveyOverbreak.realOverbreakAreaM2 || 0) > 0.01
                            ? `${(activeRound.surveyOverbreak.realOverbreakAreaM2 || 0).toFixed(2)} m² (${(activeRound.surveyOverbreak.realOverbreakVolumeM3 || 0).toFixed(2)} m³) — Exceeds Payline Limit`
                            : `0.00 m² (Within Contract Payline)`}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Total Overbreak Area &amp; Vol
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-mono">
                          {activeRound.surveyOverbreak.overbreakAreaM2.toFixed(2)} m² (
                          {activeRound.surveyOverbreak.overbreakPercent.toFixed(1)}%) |{' '}
                          {(
                            activeRound.surveyOverbreak.overbreakVolumeM3 ||
                            activeRound.surveyOverbreak.overbreakAreaM2 *
                              (activeRound.pullLengthMeters || 3)
                          ).toFixed(2)}{' '}
                          m³
                        </td>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Overbreak Cause &amp; Reason
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1">
                          <strong>
                            {formatOverbreakCauseLabel(activeRound.surveyOverbreak.overbreakCause)}
                          </strong>
                          {activeRound.surveyOverbreak.overbreakReason
                            ? `: ${activeRound.surveyOverbreak.overbreakReason}`
                            : ''}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[22%]">
                        Profile Overbreak Status
                      </th>
                      <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-semibold">
                        No Overbreak Recorded — Excavated Tunnel Face &amp; Perimeter Profile Within Theoretical Design Line ({activeLocation.widthM}m W × {activeLocation.heightM}m H; Contract Payline +{activeRound.surveyOverbreak?.paylineOffsetMm ?? 150}mm).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Section 6: Full Geological Description & Support Recommendation (Full Expanded Display Utilizing Remaining Page Space, No Scrollbar) */}
              <table className="w-full border-collapse border border-slate-900 text-[11px] bg-white flex-1">
                <thead>
                  <tr className="bg-white">
                    <th colSpan={2} className="border border-slate-900 bg-white py-1 px-2 text-left font-black">
                      6. OVERALL GEOLOGICAL, LITHOLOGY &amp; OVERBREAK DESCRIPTION &amp; ROCK SUPPORT RECOMMENDATION
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="border border-slate-900 bg-white p-2 align-top">
                      <div className="font-bold uppercase text-[10px] text-slate-900 mb-1">
                        Overall Geological, Lithology, Structural &amp; Overbreak Description:
                      </div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const nextText = e.currentTarget.innerText.trim();
                          if (nextText) {
                            onUpdateRound((r) => ({ ...r, geologicalDescription: nextText }));
                          }
                        }}
                        className="w-full bg-white text-slate-950 text-[11px] leading-relaxed whitespace-pre-wrap break-words min-h-[130px] focus:outline-none"
                      >
                        {activeRound.geologicalDescription ||
                          generateProfessionalGeologicalDescription(activeRound, activeLocation)}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-slate-900 bg-white px-2 py-1.5 text-left w-[26%] font-black uppercase text-[10px]">
                      Rock Support &amp; Excavation Recommendation
                    </th>
                    <td className="border border-slate-900 bg-white px-2 py-1.5 font-semibold leading-relaxed whitespace-pre-wrap break-words">
                      {activeRound.rockSupportRecommendation}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Optional Section 7: Integrated FEM & DEM Analysis Summary (Option B) */}
              {activeRound.femDemAnalysis?.includeInEswaReport && (
                <FieldFemDemReportEmbedSection
                  activeProject={activeProject}
                  activeLocation={activeLocation}
                  activeRound={activeRound}
                  mappingDomain={mappingDomain}
                  surfaceParams={surfaceParams}
                />
              )}
            </div>

            {/* BOTTOM: Compact Single-Row Geologist Sign Block (Small in size, zero wasted space) */}
            <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-black uppercase shrink-0">Contractor Geologist:</span>
                      <input
                        type="text"
                        value={
                          activeRound.contractorGeologistName ??
                          activeRound.contractorRepName ??
                          activeRound.geologistName ??
                          ''
                        }
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            contractorGeologistName: e.target.value,
                            geologistName: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
                      />
                      <span className="font-bold text-slate-900 shrink-0">Sign:</span>
                      <input
                        type="text"
                        value={activeRound.contractorGeologistSign ?? ''}
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            contractorGeologistSign: e.target.value,
                          }))
                        }
                        placeholder="Sign"
                        className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-black uppercase shrink-0">Client Geologist:</span>
                      <input
                        type="text"
                        value={
                          activeRound.clientGeologistName ?? activeRound.clientRepName ?? ''
                        }
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            clientGeologistName: e.target.value,
                            clientRepName: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
                      />
                      <span className="font-bold text-slate-900 shrink-0">Sign:</span>
                      <input
                        type="text"
                        value={activeRound.clientGeologistSign ?? ''}
                        onChange={(e) =>
                          onUpdateRound((r) => ({
                            ...r,
                            clientGeologistSign: e.target.value,
                          }))
                        }
                        placeholder="Sign"
                        className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Right 4 Columns: Template Edit Panel (Only shown when user clicks Template Edit) */}
      {showTemplateEditor && (
        <FieldReportTemplateEditorPanel
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateProject={onUpdateProject}
          onUpdateRound={onUpdateRound}
          onClose={() => setShowTemplateEditor(false)}
          className="lg:col-span-4"
        />
      )}
    </div>
  );
};

