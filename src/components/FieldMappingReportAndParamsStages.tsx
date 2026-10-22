import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Move,
  Palette,
  Plus,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  APERTURE_OPTIONS,
  buildAutoPopulatedTemplateDictionary,
  computeFieldQValue,
  computeFieldRmrValue,
  computeTraceOrientationFromTunnelDrive,
  createDefaultSupportSystem,
  exportFieldMappingTwoPagePdfSheet,
  exportFieldMappingTwoPageWordSheet,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_JOINT_SET_IDS,
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
} from './FieldMappingCompassAndPatterns';
import {
  FieldSupport2DCrossSectionSvg,
} from './FieldAdvancedStages';
import {
  syncFieldMappingRoundForAiTraining,
} from '../engine/userCloudAndPackageEngine';

type StripAlignItemKind = 'joint' | 'vein' | 'feature';
type JointPointActionMode = 'add_point' | 'bend' | 'move' | 'extend';

interface StripAlignableItem {
  id: string;
  kind: StripAlignItemKind;
  panel: 'left_wall' | 'crown' | 'right_wall';
  label: string;
  color: string;
  points: FieldPoint2D[];
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
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToCanvas: () => void;
  onCompleteAndContinue: () => void;
}> = ({
  activeLocation,
  activeRound,
  onUpdateRound,
  onBackToCanvas,
  onCompleteAndContinue,
}) => {
  const stripSvgRef = useRef<SVGSVGElement | null>(null);
  const [pointActionMode, setPointActionMode] = useState<JointPointActionMode>('bend');
  const [undoStack, setUndoStack] = useState<
    {
      jointTraces: FieldExcavationRound['jointTraces'];
      lithologyStrokes: FieldExcavationRound['lithologyStrokes'];
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

  // Convert panel coordinates -> strip SVG coordinates (0m at bottom -> PullM at top)
  const panelPointToStripPoint = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    pt: FieldPoint2D
  ): FieldPoint2D => {
    const { x, w, h, geom } = getPanelStripBox(panel);
    const u = Math.max(0.003, Math.min(0.997, (pt.x - geom.boxX) / Math.max(1, geom.boxW)));
    const v = Math.max(0.003, Math.min(0.997, (pt.y - geom.boxY) / Math.max(1, geom.boxH)));
    if (panel === 'left_wall') {
      return {
        x: x + v * w,
        y: stripY + (1 - u) * h,
      };
    }
    if (panel === 'crown') {
      return {
        x: x + v * w,
        y: stripY + (1 - u) * h,
      };
    }
    return {
      x: x + v * w,
      y: stripY + u * h,
    };
  };

  // Convert strip SVG coordinates -> panel coordinates (clamped to panel box, 0m at bottom -> PullM at top)
  const stripPointToPanelPoint = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    sx: number,
    sy: number
  ): FieldPoint2D => {
    const { x, w, h, geom } = getPanelStripBox(panel);
    const normX = Math.max(0.003, Math.min(0.997, (sx - x) / Math.max(1, w)));
    const normY = Math.max(0.003, Math.min(0.997, (sy - stripY) / Math.max(1, h)));
    let u = normX;
    let v = normY;
    if (panel === 'left_wall') {
      u = 1 - normY;
      v = normX;
    } else if (panel === 'crown') {
      u = 1 - normY;
      v = normX;
    } else {
      u = normY;
      v = normX;
    }
    return {
      x: Number((geom.boxX + u * geom.boxW).toFixed(1)),
      y: Number((geom.boxY + v * geom.boxH).toFixed(1)),
    };
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
          const p1 = {
            x: leftWallGeom.boxX + (inter.leftWall.p1.x / spatialGeom.pullLengthM) * leftWallGeom.boxW,
            y: leftWallGeom.boxY + (1 - inter.leftWall.p1.y / spatialGeom.wallHeightM) * leftWallGeom.boxH,
          };
          const p2 = {
            x: leftWallGeom.boxX + (inter.leftWall.p2.x / spatialGeom.pullLengthM) * leftWallGeom.boxW,
            y: leftWallGeom.boxY + (1 - inter.leftWall.p2.y / spatialGeom.wallHeightM) * leftWallGeom.boxH,
          };
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
          const p1 = {
            x: crownGeom.boxX + (inter.crown.p1.y / spatialGeom.widthM) * crownGeom.boxW,
            y: crownGeom.boxY + (1 - inter.crown.p1.x / spatialGeom.pullLengthM) * crownGeom.boxH,
          };
          const p2 = {
            x: crownGeom.boxX + (inter.crown.p2.y / spatialGeom.widthM) * crownGeom.boxW,
            y: crownGeom.boxY + (1 - inter.crown.p2.x / spatialGeom.pullLengthM) * crownGeom.boxH,
          };
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
          const p1 = {
            x: rightWallGeom.boxX + (inter.rightWall.p1.x / spatialGeom.pullLengthM) * rightWallGeom.boxW,
            y: rightWallGeom.boxY + (1 - inter.rightWall.p1.y / spatialGeom.wallHeightM) * rightWallGeom.boxH,
          };
          const p2 = {
            x: rightWallGeom.boxX + (inter.rightWall.p2.x / spatialGeom.pullLengthM) * rightWallGeom.boxW,
            y: rightWallGeom.boxY + (1 - inter.rightWall.p2.y / spatialGeom.wallHeightM) * rightWallGeom.boxH,
          };
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
    if (
      (st.panel === 'left_wall' || st.panel === 'crown' || st.panel === 'right_wall') &&
      (st.mode === 'vein_band' || st.mode === 'foliation_plane') &&
      st.points.length >= 2
    ) {
      alignableItems.push({
        id: st.id,
        kind: 'vein',
        panel: st.panel,
        label: st.rockName.slice(0, 8),
        color: '#0d9488',
        points: st.points,
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

  // Update points of any item (Joint, Vein/Foliation, or Structural Feature) and refresh its orientation
  const updateItemPointsInRound = (
    r: FieldExcavationRound,
    id: string,
    kind: StripAlignItemKind,
    nextPoints: FieldPoint2D[]
  ): FieldExcavationRound => {
    if (kind === 'joint') {
      return {
        ...r,
        jointTraces: r.jointTraces.map((tr) => {
          if (tr.id !== id) return tr;
          const ori = computeTraceOrientationFromTunnelDrive(
            nextPoints,
            tr.panel,
            r.tunnelDriveDirection,
            tr.crownDipSign,
            activeLocation.widthM,
            activeLocation.heightM
          );
          return {
            ...tr,
            points: nextPoints,
            dipDirection: tr.editedByCompass ? tr.dipDirection : ori.dipDirection,
            dipAmount: tr.editedByCompass ? tr.dipAmount : ori.dipAmount,
            strike: tr.editedByCompass ? tr.strike : ori.strike,
            traceLengthM: ori.traceLengthM,
          };
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
          e: React.PointerEvent<SVGCircleElement>,
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
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={onLinePointerDown}
              className={pointActionMode === 'add_point' ? 'cursor-crosshair' : 'cursor-move'}
            />

            {/* '+' Add-Point Handles along the joint (tap or drag to add a point on the joint and bend/move/extend it) */}
            {(isTraceSelected || controlRatios.length === 0) &&
              addCandidateRatios.map((candRatio, cIdx) => {
                if (!isTraceSelected && cIdx !== Math.floor(addCandidateRatios.length / 2)) {
                  return null;
                }
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
                    <circle
                      cx="0"
                      cy="0"
                      r={isTraceSelected ? 6.5 : 5.5}
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M -3 0 L 3 0 M 0 -3 L 0 3"
                      stroke="#38bdf8"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

            {/* Added Control Points on the Joint (Drag to Bend / Move / Extend) */}
            {controlRatios.map((ratio, bIdx) => {
              const bPt = getPointAtRatio(ratio);
              const isPtSel = isTraceSelected && selectedControlPointIdx === bIdx;
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

            {/* Start Endpoint Handle (Drag to Extend / Align Start) */}
            <circle
              cx={startPt.x}
              cy={startPt.y}
              r={6.8}
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth="2"
              onPointerDown={(e) => onEndpointPointerDown(e, 'start')}
              className="cursor-pointer"
            >
              <title>Drag endpoint to extend or align joint</title>
            </circle>

            {/* End Endpoint Handle (Drag to Extend / Align End) */}
            <circle
              cx={endPt.x}
              cy={endPt.y}
              r={6.8}
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth="2"
              onPointerDown={(e) => onEndpointPointerDown(e, 'end')}
              className="cursor-pointer"
            >
              <title>Drag endpoint to extend or align joint</title>
            </circle>
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
      {/* Simple Top Joint Point Bar: Add Point on Joint • Bend • Move • Extend */}
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

      {/* Direct Unfolded Strip Canvas (No outer enclosing box around the strip) */}
      <div
        ref={stripWrapperRef}
        className="flex-1 min-h-0 bg-slate-200 overflow-hidden flex items-center justify-center touch-none"
      >
        <FieldUnfoldedSheetSvgPreview
          svgRef={stripSvgRef}
          location={activeLocation}
          round={activeRound}
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
// STAGE 7: 2-PAGE REFERENCE REPORT (PAGE 1 & PAGE 2) + WORD TEMPLATE ENGINE
// ============================================================================
export const FieldTwoPageReportAndTemplateStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateProject: (updater: (prev: FieldProjectItem) => FieldProjectItem) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToParams: () => void;
  onSaveAndReturnToProjectSetup?: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  onUpdateProject,
  onUpdateRound,
  onBackToParams,
  onSaveAndReturnToProjectSetup,
}) => {
  const [savedBanner, setSavedBanner] = useState<boolean>(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(false);

  const colorMode = activeRound.reportColorMode || 'bw';
  const selClass = activeRound.selectedClassifications || { q: true, rmr: true, gsi: true };
  const qRes = computeFieldQValue(activeRound.qSystem);
  const rmrRes = computeFieldRmrValue(activeRound.rmrSystem);

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
    const svgEl = document.getElementById(
      'field-unfolded-report-svg'
    ) as unknown as SVGSVGElement | null;
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
      supportPngUrl
    );
    if (activeRound) {
      syncFieldMappingRoundForAiTraining(
        activeRound,
        activeProject || undefined,
        activeLocation || undefined,
        'EXPORT_GENERATED'
      );
    }
  };

  const handleExportTwoPagePdfDoc = async () => {
    const svgEl = document.getElementById(
      'field-unfolded-report-svg'
    ) as unknown as SVGSVGElement | null;
    const supSvgEl = document.getElementById(
      'field-report-support-2d-svg'
    ) as unknown as SVGSVGElement | null;
    const vbH = svgEl?.viewBox?.baseVal?.height || 610;
    const [pngDataUrl, supportPngUrl] = await Promise.all([
      renderSvgElementToHighResPngDataUrl(svgEl, 1600, Math.round((1600 * vbH) / 920)),
      renderSvgElementToHighResPngDataUrl(supSvgEl, 1400, 740),
    ]);
    await exportFieldMappingTwoPagePdfSheet(
      activeProject,
      activeLocation,
      activeRound,
      pngDataUrl,
      supportPngUrl
    );
    if (activeRound) {
      syncFieldMappingRoundForAiTraining(
        activeRound,
        activeProject || undefined,
        activeLocation || undefined,
        'EXPORT_GENERATED'
      );
    }
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2 sm:p-3 overflow-y-auto lg:overflow-hidden bg-slate-950 touch-pan-y">
      {/* Live Interactive 2-Page Reference Report (Full Width unless Template Edit is opened) */}
      <div
        className={`${
          showTemplateEditor ? 'lg:col-span-8' : 'lg:col-span-12'
        } min-h-[340px] lg:min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col overflow-hidden`}
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
              Engineering Geological Face Log (2-Page A4 Vertical Layout)
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

            <button
              type="button"
              onClick={handleExportTwoPageWordDoc}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Word (.doc)
            </button>
            <button
              type="button"
              onClick={handleExportTwoPagePdfDoc}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF (.pdf)
            </button>
            {onSaveAndReturnToProjectSetup && (
              <button
                type="button"
                onClick={() => {
                  setSavedBanner(true);
                  setTimeout(() => setSavedBanner(false), 2500);
                  onSaveAndReturnToProjectSetup();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedBanner ? 'Saved to Project Data!' : 'Save Round to Project Data'}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable 2-Page A4 Vertical Document Sheet Container */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1 bg-slate-800/60 p-2 sm:p-4 rounded-lg touch-pan-y">
          {/* ==================== PAGE 1 OF 2 (A4 VERTICAL: 210mm × 297mm) ==================== */}
          <div className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2.5 sm:p-3.5 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-1.5 overflow-x-auto print:shadow-none print:w-[210mm] print:min-h-[297mm] print:break-after-page">
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
          <div className="bg-white text-slate-950 shadow-xl border-2 border-slate-900 p-2.5 sm:p-3.5 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between gap-2 overflow-x-auto print:shadow-none print:w-[210mm] print:min-h-[297mm]">
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
                      5. TUNNEL FACE SURVEY &amp; OVERBREAK (OB) ASSESSMENT
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
                          Overbreak Area &amp; Volume
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-mono font-bold w-[28%]">
                          {activeRound.surveyOverbreak.overbreakAreaM2.toFixed(2)} m² (
                          {activeRound.surveyOverbreak.overbreakPercent.toFixed(1)}%) |{' '}
                          {(
                            activeRound.surveyOverbreak.overbreakAreaM2 *
                            (activeRound.pullLengthMeters || 3)
                          ).toFixed(2)}{' '}
                          m³
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Overbreak Cause Category
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1 font-bold">
                          {formatOverbreakCauseLabel(activeRound.surveyOverbreak.overbreakCause)}
                        </td>
                        <th className="border border-slate-900 bg-white px-2 py-1 text-left">
                          Overbreak Reason
                        </th>
                        <td className="border border-slate-900 bg-white px-2 py-1">
                          {activeRound.surveyOverbreak.overbreakReason || '—'}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th className="border border-slate-900 bg-white px-2 py-1 text-left w-[22%]">
                        Profile Overbreak Status
                      </th>
                      <td colSpan={3} className="border border-slate-900 bg-white px-2 py-1 font-semibold">
                        No Overbreak Recorded — Excavated Tunnel Face &amp; Perimeter Profile Within Theoretical Design Line ({activeLocation.widthM}m W × {activeLocation.heightM}m H).
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

