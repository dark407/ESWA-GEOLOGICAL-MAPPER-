import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoundaryZoneRole,
  CustomTunnelProfileDefinition,
  ProfileControlPoint,
  ProfileSegment,
  TunnelGeometry,
} from '../types/tunnel';
import {
  buildAuthoritativeCustomTunnelGeometry,
  computeBulgeFromArcLength,
  evaluateArcSegment,
  evaluateCustomProfileGeometry,
  solveCircularArcFromCurveLengthAndHeight,
} from '../engine/customProfileEngine';
import { getEswaApiSecurityHeaders } from '../engine/softwareLicensingEngine';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Compass,
  Eraser,
  Info,
  Layers,
  Lock,
  Move,
  Pencil,
  RefreshCw,
  RotateCcw,
  Ruler,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  Split,
  Tag,
  Unlock,
  X,
} from 'lucide-react';

export interface QuickSketchShapeSolverProps {
  initialGeometry?: TunnelGeometry;
  initialWidth?: number;
  initialHeight?: number;
  tunnelName?: string;
  onApplyProfile: (profile: CustomTunnelProfileDefinition, geometry: TunnelGeometry) => void;
  onCancel?: () => void;
}

export type StarterArchetype =
  | 'horseshoe'
  | 'd_shaped'
  | 'modified_horseshoe'
  | 'circular'
  | 'box_portal'
  | 'open_slashing_drift';

export interface SketchStroke {
  id: string;
  points: { x: number; y: number }[];
}

export interface DimensionAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

export type SegmentPortionChoice = 'leftWall' | 'crown' | 'rightWall' | 'invert' | 'open';

export interface CadBuilderSegment {
  id: string;
  strokeId?: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: 'line' | 'arc';
  // For line: exact length (m). For arc: exact Length of Curve C (m).
  lengthM: number;
  // Angle in degrees (-180..360, 0 = Right +X, 90 = Up +Y, 180 = Left -X, -90 = Down -Y)
  angleDeg: number;
  // For curve / arc: exact perpendicular Height from Center (sagitta h, m)
  heightFromCenterM: number;
  arcDirection: 'outward' | 'inward';
  arcBulge: number;
  chordLengthM: number;
  portion: SegmentPortionChoice;
  isPortionOpen: boolean;
}

export interface PendingSegmentDraft {
  strokeId?: string;
  editingSegmentId?: string;
  drawnStart: { x: number; y: number };
  drawnEnd: { x: number; y: number };
  connectMode: 'chain_prev' | 'drawn_start' | 'close_to_first';
  startX: number;
  startY: number;
  type: 'line' | 'arc';
  lengthInput: string; // Line Length (m) or Curve Length C (m)
  angleInput: string; // Angle (°)
  heightFromCenterInput: string; // Height from Center h (m) for curve
  arcDirection: 'outward' | 'inward';
  arcEndpointMode: 'from_curve_and_height' | 'keep_drawn_chord';
  portion: SegmentPortionChoice;
  isPortionOpen: boolean;
}

export const QuickSketchShapeSolver: React.FC<QuickSketchShapeSolverProps> = ({
  initialGeometry,
  initialWidth = 8.5,
  initialHeight = 7.5,
  tunnelName = 'Custom Tunnel Location',
  onApplyProfile,
  onCancel,
}) => {
  // Flag indicating whether the sketch has been analyzed into an authoritative CAD shape.
  // Initially false so canvas is completely empty as requested.
  const [hasAnalyzedShape, setHasAnalyzedShape] = useState<boolean>(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [analysisSource, setAnalysisSource] = useState<'GEMINI_AI_VISION' | 'LOCAL_SOLVER' | null>(null);
  const [analysisExplanation, setAnalysisExplanation] = useState<string | null>(null);

  // Open Tunnel / Slashing / Drift support: 'none' | 'left' | 'right'
  const [openWall, setOpenWall] = useState<'none' | 'left' | 'right'>(() => {
    if (initialGeometry?.hasLeftWall === false) return 'left';
    if (initialGeometry?.hasRightWall === false) return 'right';
    return 'none';
  });

  // Explicit Open Portion flags so any portion marked Open does NOT reflect on the Face Mapping Canvas
  const [openPortions, setOpenPortions] = useState<{
    leftWall: boolean;
    crown: boolean;
    rightWall: boolean;
    invert: boolean;
  }>(() => ({
    leftWall: initialGeometry?.hasLeftWall === false,
    crown: initialGeometry?.hasCrown === false,
    rightWall: initialGeometry?.hasRightWall === false,
    invert: (initialGeometry as any)?.hasInvert === false,
  }));

  // Step-by-step Accurate CAD Segments & Active Segment Parameter Modal Draft
  const [cadSegments, setCadSegments] = useState<CadBuilderSegment[]>([]);
  const [pendingSegmentDraft, setPendingSegmentDraft] = useState<PendingSegmentDraft | null>(null);

  // Canvas Pan & Zoom state for accurate drawing & inspection
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState<number>(1.0);
  const [isPanningCanvas, setIsPanningCanvas] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Multi-stroke drawing & annotations state
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [textAnnotations, setTextAnnotations] = useState<DimensionAnnotation[]>([]);
  const [canvasTool, setCanvasTool] = useState<'pencil' | 'pan' | 'dimension_pin' | 'eraser'>('pencil');
  const [newAnnotationInput, setNewAnnotationInput] = useState<string>('');
  const [showAnnotationModal, setShowAnnotationModal] = useState<boolean>(false);
  const [pendingAnnotationPos, setPendingAnnotationPos] = useState<{ x: number; y: number } | null>(null);

  // Solved CAD Dimension & Angle parameters
  const [widthM, setWidthM] = useState<number>(() => initialGeometry?.width || initialWidth || 8.5);
  const [leftSpanM, setLeftSpanM] = useState<number>(() => {
    const totalW = initialGeometry?.width || initialWidth || 8.5;
    return Number((totalW / 2).toFixed(2));
  });
  const [rightSpanM, setRightSpanM] = useState<number>(() => {
    const totalW = initialGeometry?.width || initialWidth || 8.5;
    return Number((totalW / 2).toFixed(2));
  });
  const [heightM, setHeightM] = useState<number>(() => initialGeometry?.height || initialHeight || 7.5);
  const [crownApexOffsetXM, setCrownApexOffsetXM] = useState<number>(0);
  const [leftWallHeightM, setLeftWallHeightM] = useState<number>(() => {
    return Number((initialGeometry?.leftWallHeight || initialGeometry?.wallHeight || 3.8).toFixed(2));
  });
  const [rightWallHeightM, setRightWallHeightM] = useState<number>(() => {
    return Number((initialGeometry?.rightWallHeight || initialGeometry?.wallHeight || 3.8).toFixed(2));
  });
  const [leftWallAngleDeg, setLeftWallAngleDeg] = useState<number>(90); // 90 = vertical, <90 = inward batter, >90 = flared
  const [rightWallAngleDeg, setRightWallAngleDeg] = useState<number>(90);
  const [crownSagittaM, setCrownSagittaM] = useState<number>(() => {
    const defaultSagitta = Math.max(0.5, (initialGeometry?.height || 7.5) - (initialGeometry?.wallHeight || 3.8));
    return Number(defaultSagitta.toFixed(2));
  });
  // Curve / Arc length support (e.g. c 10.2m or c 10.6m -> exact curved arc portion)
  const [crownArcLengthM, setCrownArcLengthM] = useState<number | null>(null);
  const [crownType, setCrownType] = useState<'circular_arc' | 'basket_handle_3arc' | 'flat'>('circular_arc');
  const [invertType, setInvertType] = useState<'flat' | 'curved_dish'>('flat');
  const [invertSagittaM, setInvertSagittaM] = useState<number>(0.3); // dish depth if curved
  // Default to false (Exact Sketch Mode) so drawn shapes (symmetric or non-symmetric, triangles, polygons, arches) are never forcibly mirrored unless the user explicitly clicks Symmetric!
  const [isSymmetric, setIsSymmetric] = useState<boolean>(false);
  const [selectedArchetype, setSelectedArchetype] = useState<StarterArchetype>('horseshoe');

  const [activeHandle, setActiveHandle] = useState<
    'left_wall' | 'right_wall' | 'crown_apex' | 'left_invert' | 'right_invert' | null
  >(null);
  const [activeVertexId, setActiveVertexId] = useState<string | null>(null);
  const [customVertexOverrides, setCustomVertexOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Palm Rejection state for touchscreen tablets and stylus drawing
  const [palmRejectionEnabled, setPalmRejectionEnabled] = useState<boolean>(true);

  // Track which parameters the user explicitly modified in the UI so AI/stroke analysis respects them
  const userLockedParamsRef = useRef<Set<string>>(new Set());
  const markParamLocked = useCallback((...keys: string[]) => {
    keys.forEach((k) => userLockedParamsRef.current.add(k));
  }, []);

  // Direct CAD Vectorizer + Geometric Stroke Analyzer for ANY drawn shape:
  // Triangles, Rectangles/Trapezoids, Pentagons/Gables, Multi-Vertex Polygons, Horseshoes, D-Shapes, Circles, and Open Slashing Drifts
  const analyzeStrokesGeometrically = useCallback(
    (forceNonSymmetricMode?: boolean, customStrokes?: SketchStroke[]) => {
      const sourceStrokes = customStrokes ?? strokes;
      const validStrokes: { x: number; y: number }[][] = [];
      sourceStrokes.forEach((s) => {
        if (s.points.length >= 2) {
          validStrokes.push(s.points);
        }
      });
      if (!customStrokes && currentStroke.length >= 2) {
        validStrokes.push(currentStroke);
      }

      if (validStrokes.length === 0) return null;

      // 1. Chain multiple strokes by nearest endpoint so multi-stroke drawings (e.g. 3 separate lines of a triangle) form one continuous ordered boundary
      const remaining = validStrokes.map((pts) => [...pts]);
      let orderedRaw: { x: number; y: number }[] = [...remaining.shift()!];

      while (remaining.length > 0) {
        const head = orderedRaw[0];
        const tail = orderedRaw[orderedRaw.length - 1];
        let bestIdx = 0;
        let bestDist = Infinity;
        let bestMode: 'append_normal' | 'append_rev' | 'prepend_normal' | 'prepend_rev' =
          'append_normal';

        for (let i = 0; i < remaining.length; i++) {
          const cand = remaining[i];
          const cStart = cand[0];
          const cEnd = cand[cand.length - 1];

          const dTailStart = Math.hypot(tail.x - cStart.x, tail.y - cStart.y);
          const dTailEnd = Math.hypot(tail.x - cEnd.x, tail.y - cEnd.y);
          const dHeadEnd = Math.hypot(head.x - cEnd.x, head.y - cEnd.y);
          const dHeadStart = Math.hypot(head.x - cStart.x, head.y - cStart.y);

          if (dTailStart < bestDist) {
            bestDist = dTailStart;
            bestIdx = i;
            bestMode = 'append_normal';
          }
          if (dTailEnd < bestDist) {
            bestDist = dTailEnd;
            bestIdx = i;
            bestMode = 'append_rev';
          }
          if (dHeadEnd < bestDist) {
            bestDist = dHeadEnd;
            bestIdx = i;
            bestMode = 'prepend_normal';
          }
          if (dHeadStart < bestDist) {
            bestDist = dHeadStart;
            bestIdx = i;
            bestMode = 'prepend_rev';
          }
        }

        const chosen = remaining.splice(bestIdx, 1)[0];
        if (bestMode === 'append_normal') {
          orderedRaw = [...orderedRaw, ...chosen];
        } else if (bestMode === 'append_rev') {
          orderedRaw = [...orderedRaw, ...chosen.slice().reverse()];
        } else if (bestMode === 'prepend_normal') {
          orderedRaw = [...chosen, ...orderedRaw];
        } else {
          orderedRaw = [...chosen.slice().reverse(), ...orderedRaw];
        }
      }

      // Deduplicate consecutive near-identical points
      const allPts: { x: number; y: number }[] = [];
      for (const p of orderedRaw) {
        if (
          allPts.length === 0 ||
          Math.hypot(p.x - allPts[allPts.length - 1].x, p.y - allPts[allPts.length - 1].y) >= 0.04
        ) {
          allPts.push(p);
        }
      }

      if (allPts.length < 3) return null;

      const xs = allPts.map((p) => p.x);
      const ys = allPts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const diag = Math.max(1.0, Math.hypot(maxX - minX, maxY - minY));

      // Trim any tail overshoot near start point when user draws a closed shape in 1 stroke
      if (allPts.length >= 8) {
        const startPt = allPts[0];
        const searchStart = Math.floor(allPts.length * 0.75);
        let closestEndIdx = allPts.length - 1;
        let closestEndDist = Math.hypot(
          allPts[allPts.length - 1].x - startPt.x,
          allPts[allPts.length - 1].y - startPt.y
        );
        for (let i = searchStart; i < allPts.length; i++) {
          const d = Math.hypot(allPts[i].x - startPt.x, allPts[i].y - startPt.y);
          if (d < closestEndDist) {
            closestEndDist = d;
            closestEndIdx = i;
          }
        }
        if (closestEndDist < diag * 0.16 && closestEndIdx < allPts.length - 1) {
          allPts.splice(closestEndIdx + 1);
        }
        while (
          allPts.length > 4 &&
          Math.hypot(
            allPts[allPts.length - 1].x - allPts[0].x,
            allPts[allPts.length - 1].y - allPts[0].y
          ) < Math.max(0.18, diag * 0.04)
        ) {
          allPts.pop();
        }
      }

      // Ensure clockwise winding order in Y-up coordinate space (signed shoelace area < 0)
      let signedArea2 = 0;
      for (let i = 0; i < allPts.length; i++) {
        const p1 = allPts[i];
        const p2 = allPts[(i + 1) % allPts.length];
        signedArea2 += p1.x * p2.y - p2.x * p1.y;
      }
      if (signedArea2 > 0) {
        allPts.reverse();
      }

      // Helper: Perpendicular distance from point p to segment a->b
      const ptToSegDist = (
        p: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number }
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-8) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      };

      // Standard Ramer-Douglas-Peucker on an open slice of points
      const rdpIndices = (
        pts: { x: number; y: number }[],
        startIdx: number,
        endIdx: number,
        eps: number
      ): number[] => {
        if (endIdx <= startIdx + 1) return [startIdx, endIdx];
        let maxD = -1;
        let split = startIdx;
        const pStart = pts[startIdx];
        const pEnd = pts[endIdx];
        for (let i = startIdx + 1; i < endIdx; i++) {
          const d = ptToSegDist(pts[i], pStart, pEnd);
          if (d > maxD) {
            maxD = d;
            split = i;
          }
        }
        if (maxD > eps && split > startIdx && split < endIdx) {
          const left = rdpIndices(pts, startIdx, split, eps);
          const right = rdpIndices(pts, split, endIdx, eps);
          return [...left.slice(0, -1), ...right];
        }
        return [startIdx, endIdx];
      };

      // 2. Closed-Loop & Open-Path Corner Detection
      const endGap = Math.hypot(
        allPts[0].x - allPts[allPts.length - 1].x,
        allPts[0].y - allPts[allPts.length - 1].y
      );
      const isDrawnClosedLoop = endGap < Math.max(1.1, diag * 0.24);
      const rdpEps = Math.max(0.15, diag * 0.042);

      let workPts = [...allPts];
      let cornerIdxs: number[] = [];

      if (!isDrawnClosedLoop) {
        // Open path (e.g. user drew '/\' 2 sides of a triangle without bottom line)
        cornerIdxs = rdpIndices(workPts, 0, workPts.length - 1, rdpEps);
      } else {
        // Closed loop: rotate workPts so index 0 is the point furthest from centroid (a guaranteed true corner!)
        const cx = workPts.reduce((acc, p) => acc + p.x, 0) / workPts.length;
        const cy = workPts.reduce((acc, p) => acc + p.y, 0) / workPts.length;
        let idxA = 0;
        let maxDistA = -1;
        for (let i = 0; i < workPts.length; i++) {
          const d = Math.hypot(workPts[i].x - cx, workPts[i].y - cy);
          if (d > maxDistA) {
            maxDistA = d;
            idxA = i;
          }
        }
        workPts = [...workPts.slice(idxA), ...workPts.slice(0, idxA)];

        // Find opposite extreme corner idxB furthest from workPts[0]
        let idxB = Math.floor(workPts.length / 2);
        let maxDistB = -1;
        for (let i = 1; i < workPts.length; i++) {
          const d = Math.hypot(workPts[i].x - workPts[0].x, workPts[i].y - workPts[0].y);
          if (d > maxDistB) {
            maxDistB = d;
            idxB = i;
          }
        }

        const closedWithEnd = [...workPts, workPts[0]];
        const half1 = rdpIndices(closedWithEnd, 0, idxB, rdpEps);
        const half2 = rdpIndices(closedWithEnd, idxB, closedWithEnd.length - 1, rdpEps);
        cornerIdxs = [...half1.slice(0, -1), ...half2.slice(0, -1)];
      }

      // Helper: Get cyclic raw points between two indices in workPts
      const getCyclicSlice = (iFrom: number, iTo: number): { x: number; y: number }[] => {
        if (iFrom === iTo) return [workPts[iFrom]];
        if (iFrom < iTo) return workPts.slice(iFrom, iTo + 1);
        return [...workPts.slice(iFrom), ...workPts.slice(0, iTo + 1)];
      };

      // Helper: Max deviation ratio d_max / chord for raw points between iFrom and iTo
      const getSliceMaxDevRatio = (
        iFrom: number,
        iTo: number,
        pA: { x: number; y: number },
        pB: { x: number; y: number }
      ) => {
        const chord = Math.hypot(pB.x - pA.x, pB.y - pA.y);
        if (chord < 1e-4) return 0;
        // If this is the un-drawn closing base edge of an open stroke, it is a straight line
        if (!isDrawnClosedLoop && iFrom > iTo) return 0;
        const slice = getCyclicSlice(iFrom, iTo);
        let maxD = 0;
        for (const p of slice) {
          const d = ptToSegDist(p, pA, pB);
          if (d > maxD) maxD = d;
        }
        return maxD / chord;
      };

      // Build mutable corner list with coordinates and original indices
      let corners = cornerIdxs.map((idx) => ({
        idx,
        x: workPts[idx].x,
        y: workPts[idx].y,
      }));

      // 3. Cyclic Corner Refinement:
      //    (a) Collapse short rounded-corner bevels into sharp line-line intersections
      //    (b) Remove collinear / shallow-angle pseudo-corners along straight edges
      const lineIntersection = (
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number },
        p4: { x: number; y: number }
      ): { x: number; y: number } | null => {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        const denom = d1x * d2y - d1y * d2x;
        if (Math.abs(denom) < 1e-4) return null;
        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
        return { x: p1.x + t * d1x, y: p1.y + t * d1y };
      };

      for (let pass = 0; pass < 3; pass++) {
        // Step A: Collapse short corner bevels (e.g. 2 points placed right next to the same corner)
        let changed = true;
        while (changed && corners.length > 3) {
          changed = false;
          for (let i = 0; i < corners.length; i++) {
            const m = corners.length;
            if (m <= 3) break;
            const prev = corners[(i - 1 + m) % m];
            const cur = corners[i];
            const nxt = corners[(i + 1) % m];
            const afterNxt = corners[(i + 2) % m];

            const bevelLen = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
            const prevLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            const nextLen = Math.hypot(afterNxt.x - nxt.x, afterNxt.y - nxt.y);

            if (
              bevelLen < Math.max(0.55, diag * 0.14) &&
              prevLen > bevelLen * 1.6 &&
              nextLen > bevelLen * 1.6
            ) {
              const prevDev = getSliceMaxDevRatio(prev.idx, cur.idx, prev, cur);
              const nextDev = getSliceMaxDevRatio(nxt.idx, afterNxt.idx, nxt, afterNxt);
              if (prevDev < 0.095 && nextDev < 0.095) {
                const inter = lineIntersection(prev, cur, afterNxt, nxt);
                const midX = (cur.x + nxt.x) / 2;
                const midY = (cur.y + nxt.y) / 2;
                const sharpPt =
                  inter && Math.hypot(inter.x - midX, inter.y - midY) < diag * 0.22
                    ? inter
                    : { x: midX, y: midY };
                const mergedCorner = {
                  idx: cur.idx,
                  x: sharpPt.x,
                  y: sharpPt.y,
                };
                if ((i + 1) % m > i) {
                  corners.splice(i, 2, mergedCorner);
                } else {
                  corners.splice(i, 1, mergedCorner);
                  corners.splice(0, 1);
                }
                changed = true;
                break;
              }
            }
          }
        }

        // Step B: Remove collinear / shallow-angle pseudo-corners along straight edges
        let pruned = true;
        while (pruned && corners.length > 3) {
          pruned = false;
          for (let i = 0; i < corners.length; i++) {
            const m = corners.length;
            if (m <= 3) break;
            const prev = corners[(i - 1 + m) % m];
            const cur = corners[i];
            const nxt = corners[(i + 1) % m];

            const uX = cur.x - prev.x;
            const uY = cur.y - prev.y;
            const vX = nxt.x - cur.x;
            const vY = nxt.y - cur.y;
            const uLen = Math.hypot(uX, uY);
            const vLen = Math.hypot(vX, vY);

            if (uLen < 0.22 || vLen < 0.22) {
              corners.splice(i, 1);
              pruned = true;
              break;
            }

            const dot = (uX * vX + uY * vY) / (uLen * vLen);
            const turnAngleDeg =
              (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
            const mergedDev = getSliceMaxDevRatio(prev.idx, nxt.idx, prev, nxt);

            if (
              (turnAngleDeg < 32 && mergedDev < 0.088) ||
              mergedDev < 0.052
            ) {
              corners.splice(i, 1);
              pruned = true;
              break;
            }
          }
        }
      }

      // Rotate corners so P1 (index 0) is the bottom-left corner (minimizes y * 2.0 + x)
      if (corners.length >= 3) {
        let startCornerIdx = 0;
        let bestScore = Infinity;
        for (let i = 0; i < corners.length; i++) {
          const score = (corners[i].y - minY) * 2.2 + (corners[i].x - minX);
          if (score < bestScore) {
            bestScore = score;
            startCornerIdx = i;
          }
        }
        corners = [
          ...corners.slice(startCornerIdx),
          ...corners.slice(0, startCornerIdx),
        ];
      }

      // 4. Classify each edge between consecutive corners as straight 'line' or circular 'arc'
      //    (and consolidate consecutive curved upper arch edges when appropriate)
      const evaluateEdgeCurvature = (
        cFrom: { idx: number; x: number; y: number },
        cTo: { idx: number; x: number; y: number }
      ): { isArc: boolean; bulge: number; maxDevRatio: number } => {
        const dx = cTo.x - cFrom.x;
        const dy = cTo.y - cFrom.y;
        const chord = Math.hypot(dx, dy);
        if (chord < 0.5 || (!isDrawnClosedLoop && cFrom.idx > cTo.idx)) {
          return { isArc: false, bulge: 0, maxDevRatio: 0 };
        }
        const slice = getCyclicSlice(cFrom.idx, cTo.idx);
        if (slice.length < 5) {
          return { isArc: false, bulge: 0, maxDevRatio: 0 };
        }
        // Unit normal pointing left of directed chord (outward for clockwise loop)
        const nx = -dy / chord;
        const ny = dx / chord;

        let posCount = 0;
        let negCount = 0;
        let maxAbsD = 0;
        let sumSqLine = 0;
        const midSignedDists: number[] = [];

        for (const p of slice) {
          const relX = p.x - cFrom.x;
          const relY = p.y - cFrom.y;
          const along = (relX * dx + relY * dy) / (chord * chord);
          const signedD = relX * nx + relY * ny;
          const absD = Math.abs(signedD);
          if (absD > maxAbsD) maxAbsD = absD;
          sumSqLine += signedD * signedD;
          if (signedD > 0.04) posCount++;
          else if (signedD < -0.04) negCount++;
          if (along >= 0.3 && along <= 0.7) {
            midSignedDists.push(signedD);
          }
        }

        const maxDevRatio = maxAbsD / chord;
        const rmseLine = Math.sqrt(sumSqLine / slice.length);
        const totalNonZero = Math.max(1, posCount + negCount);
        const unidirectionRatio = Math.max(posCount, negCount) / totalNonZero;

        // Straight line check: if deviation is under 9.5% of chord or under 0.18m, it is a straight line!
        if (maxDevRatio < 0.095 || rmseLine < 0.16 || unidirectionRatio < 0.78) {
          return { isArc: false, bulge: 0, maxDevRatio };
        }

        // Estimate circular arc sagitta from middle third of points
        const sortedMid =
          midSignedDists.length > 0
            ? [...midSignedDists].sort((a, b) => a - b)
            : [posCount >= negCount ? maxAbsD * 0.85 : -maxAbsD * 0.85];
        const medSagitta = sortedMid[Math.floor(sortedMid.length / 2)];
        const sign = medSagitta >= 0 ? 1 : -1;
        const absSagitta = Math.max(Math.abs(medSagitta), maxAbsD * 0.88);
        const bulge = Number(
          Math.max(-1.6, Math.min(1.6, (sign * 2 * absSagitta) / chord)).toFixed(4)
        );

        // Compare circular arc fit RMSE vs straight line RMSE
        const absB = Math.abs(bulge);
        const sag = ( absB * chord ) / 2;
        const radius = (chord * (1 + bulge * bulge)) / (4 * Math.max(1e-4, absB));
        const centerOffset = radius - sag;
        const midX = (cFrom.x + cTo.x) / 2;
        const midY = (cFrom.y + cTo.y) / 2;
        const arcCx = midX - nx * sign * centerOffset;
        const arcCy = midY - ny * sign * centerOffset;

        let sumSqArc = 0;
        for (const p of slice) {
          const distToCenter = Math.hypot(p.x - arcCx, p.y - arcCy);
          const err = distToCenter - radius;
          sumSqArc += err * err;
        }
        const rmseArc = Math.sqrt(sumSqArc / slice.length);

        if (rmseArc < rmseLine * 0.58) {
          return { isArc: true, bulge, maxDevRatio };
        }
        return { isArc: false, bulge: 0, maxDevRatio };
      };

      // If polygon has >= 4 vertices and consecutive upper vertices form a single smooth circular arch
      // (while NOT being two straight polygon lines like a triangle or gable roof!), consolidate them into 1 arc:
      if (corners.length >= 4) {
        let mergedArch = true;
        while (mergedArch && corners.length >= 4) {
          mergedArch = false;
          for (let i = 0; i < corners.length; i++) {
            const m = corners.length;
            if (m < 4) break;
            const cPrev = corners[i];
            const cMid = corners[(i + 1) % m];
            const cNext = corners[(i + 2) % m];

            // Only consider merging upper/side arch vertices, never merge the two bottom floor corners
            if (cMid.y < minY + (maxY - minY) * 0.35) continue;

            const e1 = evaluateEdgeCurvature(cPrev, cMid);
            const e2 = evaluateEdgeCurvature(cMid, cNext);

            // Protect sharp straight-edged polygons (Triangles, Boxes, Pentagons/Gables):
            // If both edges are straight lines (maxDevRatio < 0.075), NEVER round off their corner!
            if (!e1.isArc && !e2.isArc && e1.maxDevRatio < 0.075 && e2.maxDevRatio < 0.075) {
              continue;
            }

            const combined = evaluateEdgeCurvature(cPrev, cNext);
            if (combined.isArc && Math.abs(combined.bulge) >= 0.14) {
              corners.splice((i + 1) % m, 1);
              mergedArch = true;
              break;
            }
          }
        }
      }

      // Snap near-horizontal base corners to equal Y if within 4.5 degrees so drawn triangles/boxes sit level
      if (corners.length >= 3) {
        const cFirst = corners[0];
        const cLast = corners[corners.length - 1];
        const baseDx = Math.abs(cLast.x - cFirst.x);
        const baseDy = Math.abs(cLast.y - cFirst.y);
        if (
          baseDx > (maxX - minX) * 0.45 &&
          baseDy / Math.max(0.5, baseDx) < 0.08 &&
          Math.max(cFirst.y, cLast.y) <= minY + (maxY - minY) * 0.25
        ) {
          const avgBaseY =
            Math.abs(((cFirst.y + cLast.y) / 2)) <= 0.45
              ? 0
              : Number(((cFirst.y + cLast.y) / 2).toFixed(3));
          cFirst.y = avgBaseY;
          cLast.y = avgBaseY;
        }
      }

      // Build final CAD controlPoints and segments directly from the vectorized corners
      const vMinX = Math.min(...corners.map((c) => c.x));
      const vMaxX = Math.max(...corners.map((c) => c.x));
      const vMinY = Math.min(...corners.map((c) => c.y));
      const vMaxY = Math.max(...corners.map((c) => c.y));

      const vectorizedControlPoints: ProfileControlPoint[] = corners.map((c, idx) => {
        const isHighest = Math.abs(c.y - vMaxY) < 0.05;
        const isBottomLeft = idx === 0;
        const isBottomRight = idx === corners.length - 1 && c.y <= vMinY + (vMaxY - vMinY) * 0.35;
        const role = isBottomLeft
          ? 'left_invert'
          : isBottomRight
          ? 'right_invert'
          : isHighest
          ? 'crown_apex'
          : c.x < (vMinX + vMaxX) / 2
          ? 'left_wall_top'
          : 'right_wall_top';
        return {
          id: `v_pt_${idx + 1}`,
          label: `P${idx + 1}`,
          x: Number(c.x.toFixed(3)),
          y: Number(c.y.toFixed(3)),
          role,
        };
      });

      const vectorizedSegments: ProfileSegment[] = [];
      let arcSegCount = 0;
      for (let i = 0; i < corners.length; i++) {
        const cFrom = corners[i];
        const cTo = corners[(i + 1) % corners.length];
        const pFrom = vectorizedControlPoints[i];
        const pTo = vectorizedControlPoints[(i + 1) % corners.length];
        const curv = evaluateEdgeCurvature(cFrom, cTo);
        if (curv.isArc) arcSegCount++;

        const midXSeg = (pFrom.x + pTo.x) / 2;
        const midYSeg = (pFrom.y + pTo.y) / 2;
        const dxSeg = Math.abs(pTo.x - pFrom.x);
        const dySeg = Math.abs(pTo.y - pFrom.y);
        const totalHV = Math.max(0.5, vMaxY - vMinY);

        let zoneRole: 'leftWall' | 'crown' | 'rightWall' | 'invert' = 'crown';
        if (
          i === corners.length - 1 &&
          midYSeg <= vMinY + totalHV * 0.28 &&
          dxSeg >= dySeg * 0.8
        ) {
          zoneRole = 'invert';
        } else if (curv.isArc && midYSeg >= vMinY + totalHV * 0.25) {
          zoneRole = 'crown';
        } else if (
          corners.length >= 4 &&
          dySeg >= dxSeg * 0.85 &&
          Math.min(pFrom.y, pTo.y) <= vMinY + totalHV * 0.3
        ) {
          zoneRole = midXSeg <= (vMinX + vMaxX) / 2 ? 'leftWall' : 'rightWall';
        } else if (midYSeg <= vMinY + totalHV * 0.2) {
          zoneRole = 'invert';
        } else {
          zoneRole = 'crown';
        }

        vectorizedSegments.push({
          id: `v_seg_${i + 1}`,
          fromPointId: pFrom.id,
          toPointId: pTo.id,
          type: curv.isArc ? 'arc' : 'line',
          zoneRole,
          arcBulge: curv.isArc ? curv.bulge : undefined,
        });
      }

      const detectedShapeKind:
        | 'triangle'
        | 'quadrilateral'
        | 'pentagon_gable'
        | 'polygon'
        | 'arched_tunnel'
        | 'open_slashing_drift' =
        corners.length === 3 && arcSegCount === 0
          ? 'triangle'
          : corners.length === 4 && arcSegCount === 0
          ? 'quadrilateral'
          : corners.length === 5 && arcSegCount === 0
          ? 'pentagon_gable'
          : arcSegCount === 0
          ? 'polygon'
          : 'arched_tunnel';

      const baseY = Math.abs(vMinY) <= 0.45 ? 0 : vMinY;
      const span = Number(Math.max(1.0, Math.min(30.0, vMaxX - vMinX)).toFixed(2));
      const totalH = Number(Math.max(1.0, Math.min(30.0, vMaxY - baseY)).toFixed(2));
      const midX = (vMinX + vMaxX) / 2;

      const splitX = Math.abs(midX) <= span * 0.25 ? 0 : midX;
      const leftSpan = Number(Math.max(0.5, splitX - vMinX).toFixed(2));
      const rightSpan = Number(Math.max(0.5, vMaxX - splitX).toFixed(2));

      // Compute side angles and wall heights from vectorized vertices
      const pFirst = vectorizedControlPoints[0];
      const pSecond = vectorizedControlPoints[1];
      const pPenult = vectorizedControlPoints[vectorizedControlPoints.length - 2];
      const pLast = vectorizedControlPoints[vectorizedControlPoints.length - 1];

      const leftAngle = Math.round(
        Math.min(
          135,
          Math.max(
            45,
            90 - (Math.atan2(pSecond.x - pFirst.x, Math.max(0.1, pSecond.y - pFirst.y)) * 180) / Math.PI
          )
        )
      );
      const rightAngle = Math.round(
        Math.min(
          135,
          Math.max(
            45,
            90 + (Math.atan2(pPenult.x - pLast.x, Math.max(0.1, pPenult.y - pLast.y)) * 180) / Math.PI
          )
        )
      );

      const leftWallH =
        detectedShapeKind === 'triangle'
          ? 0
          : Number(Math.max(0, pSecond.y - vMinY).toFixed(2));
      const rightWallH =
        detectedShapeKind === 'triangle'
          ? 0
          : Number(Math.max(0, pPenult.y - vMinY).toFixed(2));

      const highestPt = vectorizedControlPoints.reduce(
        (best, p) => (p.y > best.y ? p : best),
        vectorizedControlPoints[0]
      );
      const rawApexOffset = Number((highestPt.x - midX).toFixed(2));

      const isShapeSymmetric =
        !forceNonSymmetricMode &&
        Math.abs(leftWallH - rightWallH) <= totalH * 0.1 &&
        Math.abs(leftAngle - rightAngle) <= 5 &&
        Math.abs(rawApexOffset) <= span * 0.08;

      const detectedCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' =
        arcSegCount > 0 ? 'circular_arc' : 'flat';

      return {
        shapeKind: detectedShapeKind,
        controlPoints: vectorizedControlPoints,
        segments: vectorizedSegments,
        minX: vMinX,
        maxX: vMaxX,
        minY: vMinY,
        maxY: vMaxY,
        span,
        totalH,
        leftSpan,
        rightSpan,
        leftWallH,
        rightWallH,
        leftAngle,
        rightAngle,
        apexOffsetX: rawApexOffset,
        crownType: detectedCrownType,
        invertType: 'flat' as 'flat' | 'curved_dish',
        invertSagittaM: 0.3,
        openWall: 'none' as 'none' | 'left' | 'right',
        isSymmetric: isShapeSymmetric,
      };
    },
    [strokes, currentStroke]
  );

  // Spatial + Keyword Parser for Dimension Pins
  const parseAnnotationsWithSpatialContext = useCallback(
    (
      annotations: DimensionAnnotation[],
      geom: ReturnType<typeof analyzeStrokesGeometrically>
    ) => {
      const refSpan = geom?.span ?? widthM;
      const refH = geom?.totalH ?? heightM;
      const refLeftWall = geom?.leftWallH ?? leftWallHeightM;
      const refRightWall = geom?.rightWallH ?? rightWallHeightM;

      let ovrWidth: number | null = null;
      let ovrLeftSpan: number | null = null;
      let ovrRightSpan: number | null = null;
      let ovrHeight: number | null = null;
      let ovrLeftWallH: number | null = null;
      let ovrRightWallH: number | null = null;
      let ovrLeftAngle: number | null = null;
      let ovrRightAngle: number | null = null;
      let ovrCrownArcLength: number | null = null;
      let ovrInvertDish: number | null = null;
      let ovrOpenWall: 'none' | 'left' | 'right' | null = null;
      let ovrCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' | null = null;
      let ovrInvertType: 'flat' | 'curved_dish' | null = null;

      for (const a of annotations) {
        const txt = a.text.trim();
        if (!txt) continue;

        if (/(?:^|\b)open\b/i.test(txt) || /slashing|drift/i.test(txt)) {
          if (/right/i.test(txt) || (!/left/i.test(txt) && a.x > 0.5)) {
            ovrOpenWall = 'right';
          } else {
            ovrOpenWall = 'left';
          }
        }
        if (/flat\s*(?:roof|crown|back)/i.test(txt) || /box|rectangular/i.test(txt)) {
          ovrCrownType = 'flat';
        } else if (/basket|3\s*-?\s*arc/i.test(txt)) {
          ovrCrownType = 'basket_handle_3arc';
        }
        if (/dish|curved\s*invert/i.test(txt)) {
          ovrInvertType = 'curved_dish';
        } else if (/flat\s*(?:invert|floor)/i.test(txt)) {
          ovrInvertType = 'flat';
        }

        const matchC =
          txt.match(/(?:^|\b)c\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i) ||
          txt.match(/(?:^|\b)(?:arc|curve)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i);
        if (matchC) {
          ovrCrownArcLength = Number(matchC[1]);
          ovrCrownType = 'circular_arc';
          continue;
        }

        const matchDeg =
          txt.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:°|deg|degrees)\b/i) ||
          (/(?:angle|batter|incline)/i.test(txt) ? txt.match(/([0-9]+(?:\.[0-9]+)?)/) : null);
        if (matchDeg) {
          const deg = Math.max(45, Math.min(135, Number(matchDeg[1])));
          if (/right|r-wall|r\s*wall/i.test(txt)) {
            ovrRightAngle = deg;
          } else if (/left|l-wall|l\s*wall/i.test(txt)) {
            ovrLeftAngle = deg;
          } else if (a.x > refSpan * 0.15) {
            ovrRightAngle = deg;
          } else if (a.x < -refSpan * 0.15) {
            ovrLeftAngle = deg;
          } else {
            ovrLeftAngle = deg;
            ovrRightAngle = deg;
          }
        }

        const txtWithoutDeg = txt.replace(/[0-9]+(?:\.[0-9]+)?\s*(?:°|deg|degrees)/gi, '');
        const matchM = txtWithoutDeg.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i);
        if (matchM) {
          const val = Number(matchM[1]);
          if (val <= 0) continue;

          if (/dish|invert\s*depth|sagitta/i.test(txt)) {
            ovrInvertDish = val;
            ovrInvertType = 'curved_dish';
          } else if (/left\s*span|l-span/i.test(txt)) {
            ovrLeftSpan = val;
          } else if (/right\s*span|r-span/i.test(txt)) {
            ovrRightSpan = val;
          } else if (/width|span|\bw\b|floor|invert|base/i.test(txt)) {
            ovrWidth = val;
          } else if (/height|\bh\b|total|apex|crown\s*h/i.test(txt)) {
            ovrHeight = val;
          } else if (/right\s*wall|r-wall|r\s*wall|\brw\b/i.test(txt)) {
            ovrRightWallH = val;
          } else if (/left\s*wall|l-wall|l\s*wall|\blw\b/i.test(txt)) {
            ovrLeftWallH = val;
          } else if (/wall|shoulder|wh|springline/i.test(txt)) {
            const effOpen = ovrOpenWall ?? openWall;
            if (effOpen === 'left') {
              ovrRightWallH = val;
            } else if (effOpen === 'right') {
              ovrLeftWallH = val;
            } else if (a.x > refSpan * 0.15) {
              ovrRightWallH = val;
            } else if (a.x < -refSpan * 0.15) {
              ovrLeftWallH = val;
            } else {
              ovrLeftWallH = val;
              ovrRightWallH = val;
            }
          } else {
            // Bare number (e.g. "6m", "8m", "3.2m") — use spatial (x, y) pin position!
            const effOpen = ovrOpenWall ?? openWall;
            const isNearFloor = a.y <= Math.max(0.9, refH * 0.22);
            const isNearRoof = a.y >= refH * 0.75;
            const isLeftFlank = a.x < -refSpan * 0.18;
            const isRightFlank = a.x > refSpan * 0.18;

            if (isNearFloor && !isLeftFlank && !isRightFlank) {
              ovrWidth = val;
            } else if (isNearRoof && !isLeftFlank && !isRightFlank) {
              ovrHeight = val;
            } else if (isLeftFlank) {
              if (effOpen === 'left' && val > refRightWall) {
                ovrHeight = val;
              } else {
                ovrLeftWallH = val;
              }
            } else if (isRightFlank) {
              if (effOpen === 'right' && val > refLeftWall) {
                ovrHeight = val;
              } else {
                ovrRightWallH = val;
              }
            } else {
              if (ovrWidth === null && Math.abs(val - refSpan) <= Math.abs(val - refH)) {
                ovrWidth = val;
              } else if (ovrHeight === null) {
                ovrHeight = val;
              } else if (ovrLeftWallH === null) {
                ovrLeftWallH = val;
                ovrRightWallH = val;
              }
            }
          }
        }
      }

      return {
        ovrWidth,
        ovrLeftSpan,
        ovrRightSpan,
        ovrHeight,
        ovrLeftWallH,
        ovrRightWallH,
        ovrLeftAngle,
        ovrRightAngle,
        ovrCrownArcLength,
        ovrInvertDish,
        ovrOpenWall,
        ovrCrownType,
        ovrInvertType,
      };
    },
    [widthM, heightM, leftWallHeightM, rightWallHeightM, openWall]
  );

  // Synchronize when symmetry is enabled
  const handleLeftWallHeightChange = (val: number) => {
    markParamLocked('leftWallHeightM');
    setLeftWallHeightM(val);
    if (isSymmetric) {
      markParamLocked('rightWallHeightM');
      setRightWallHeightM(val);
    }
  };

  const handleLeftWallAngleChange = (val: number) => {
    markParamLocked('leftWallAngleDeg');
    setLeftWallAngleDeg(val);
    if (isSymmetric) {
      markParamLocked('rightWallAngleDeg');
      setRightWallAngleDeg(val);
    }
  };

  const handleRightWallAngleChange = (val: number) => {
    markParamLocked('rightWallAngleDeg');
    setRightWallAngleDeg(val);
    if (isSymmetric) {
      markParamLocked('leftWallAngleDeg');
      setLeftWallAngleDeg(val);
    }
  };

  const handleTotalWidthChange = (val: number) => {
    markParamLocked('widthM', 'leftSpanM', 'rightSpanM');
    setWidthM(val);
    if (isSymmetric) {
      const half = Number((val / 2).toFixed(2));
      setLeftSpanM(half);
      setRightSpanM(half);
    } else {
      const ratio = val / Math.max(0.1, leftSpanM + rightSpanM);
      setLeftSpanM(Number((leftSpanM * ratio).toFixed(2)));
      setRightSpanM(Number((rightSpanM * ratio).toFixed(2)));
    }
  };

  const handleLeftSpanChange = (val: number) => {
    markParamLocked('leftSpanM', 'widthM');
    setLeftSpanM(val);
    if (isSymmetric) {
      markParamLocked('rightSpanM');
      setRightSpanM(val);
      setWidthM(Number((val * 2).toFixed(2)));
    } else {
      setWidthM(Number((val + rightSpanM).toFixed(2)));
    }
  };

  const handleRightSpanChange = (val: number) => {
    markParamLocked('rightSpanM', 'widthM');
    setRightSpanM(val);
    if (isSymmetric) {
      markParamLocked('leftSpanM');
      setLeftSpanM(val);
      setWidthM(Number((val * 2).toFixed(2)));
    } else {
      setWidthM(Number((leftSpanM + val).toFixed(2)));
    }
  };

  // Preset archetype applicator
  const applyArchetype = (type: StarterArchetype) => {
    setSelectedArchetype(type);
    markParamLocked(
      'archetypePreset',
      'openWall',
      'widthM',
      'leftSpanM',
      'rightSpanM',
      'heightM',
      'leftWallHeightM',
      'rightWallHeightM',
      'leftWallAngleDeg',
      'rightWallAngleDeg',
      'crownType',
      'invertType'
    );
    switch (type) {
      case 'open_slashing_drift':
        setOpenWall('left');
        setWidthM(6.0);
        setLeftSpanM(3.0);
        setRightSpanM(3.0);
        setHeightM(8.0);
        setRightWallHeightM(3.2);
        setLeftWallHeightM(0);
        setLeftWallAngleDeg(80);
        setRightWallAngleDeg(90);
        setCrownArcLengthM(10.2);
        markParamLocked('crownArcLengthM');
        setCrownType('circular_arc');
        setInvertType('flat');
        setIsSymmetric(false);
        setHasAnalyzedShape(true);
        setAnalysisExplanation(
          'Applied Open Slashing Drift (Left Wall Open to Void, Span 6m, Height 8m, Right Wall 3.2m, Curve Arc C 10.2m, 80° angle).'
        );
        return;
      case 'd_shaped':
        setOpenWall('none');
        setWidthM(8.4);
        setLeftSpanM(4.2);
        setRightSpanM(4.2);
        setHeightM(7.2);
        setLeftWallHeightM(4.2);
        setRightWallHeightM(4.2);
        setLeftWallAngleDeg(90);
        setRightWallAngleDeg(90);
        setCrownSagittaM(3.0);
        setCrownArcLengthM(null);
        setCrownType('circular_arc');
        setInvertType('flat');
        setIsSymmetric(true);
        break;
      case 'horseshoe':
        setOpenWall('none');
        setWidthM(8.5);
        setLeftSpanM(4.25);
        setRightSpanM(4.25);
        setHeightM(7.5);
        setLeftWallHeightM(3.8);
        setRightWallHeightM(3.8);
        setLeftWallAngleDeg(88);
        setRightWallAngleDeg(88);
        setCrownSagittaM(3.7);
        setCrownArcLengthM(null);
        setCrownType('circular_arc');
        setInvertType('flat');
        setIsSymmetric(true);
        break;
      case 'modified_horseshoe':
        setOpenWall('none');
        setWidthM(9.2);
        setLeftSpanM(4.6);
        setRightSpanM(4.6);
        setHeightM(7.8);
        setLeftWallHeightM(3.9);
        setRightWallHeightM(3.9);
        setLeftWallAngleDeg(86);
        setRightWallAngleDeg(86);
        setCrownSagittaM(3.9);
        setCrownArcLengthM(null);
        setCrownType('basket_handle_3arc');
        setInvertType('curved_dish');
        setInvertSagittaM(0.4);
        setIsSymmetric(true);
        break;
      case 'circular':
        setOpenWall('none');
        setWidthM(7.6);
        setLeftSpanM(3.8);
        setRightSpanM(3.8);
        setHeightM(7.6);
        setLeftWallHeightM(3.8);
        setRightWallHeightM(3.8);
        setLeftWallAngleDeg(90);
        setRightWallAngleDeg(90);
        setCrownSagittaM(3.8);
        setCrownArcLengthM(null);
        setCrownType('circular_arc');
        setInvertType('curved_dish');
        setInvertSagittaM(3.8);
        setIsSymmetric(true);
        break;
      case 'box_portal':
        setOpenWall('none');
        setWidthM(8.0);
        setLeftSpanM(4.0);
        setRightSpanM(4.0);
        setHeightM(6.0);
        setLeftWallHeightM(6.0);
        setRightWallHeightM(6.0);
        setLeftWallAngleDeg(90);
        setRightWallAngleDeg(90);
        setCrownSagittaM(0);
        setCrownArcLengthM(null);
        setCrownType('flat');
        setInvertType('flat');
        setIsSymmetric(true);
        break;
    }
    setHasAnalyzedShape(true);
    setAnalysisExplanation(
      `Populated from standard ${type.replace(/_/g, ' ').toUpperCase()} engineering archetype.`
    );
  };

  // SVG coordinate transformation helpers with Pan & Zoom support
  const scale = Number((36 * canvasZoom).toFixed(2)); // px per meter
  const originX = 400 + canvasPan.x;
  const originY = 380 + canvasPan.y;
  const toSvgX = useCallback((mX: number) => originX + mX * scale, [originX, scale]);
  const toSvgY = useCallback((mY: number) => originY - mY * scale, [originY, scale]);

  // Convert mouse/touch event to profile meters (origin (0,0) at centerline invert).
  // Uses browser SVG matrix transform (getScreenCTM) to ensure ZERO GAP between touch/mouse and trace.
  const clientToMeters = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = svgRef.current;
      if (!el) return null;
      const ctm = el.getScreenCTM();
      if (!ctm) return null;
      const pt = el.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());

      const mX = (svgPt.x - originX) / scale;
      const mY = (originY - svgPt.y) / scale; // Y is up positive
      return { x: Number(mX.toFixed(3)), y: Number(Math.max(-6.0, mY).toFixed(3)) };
    },
    [originX, originY, scale]
  );

  // Measure a single drawn stroke to pre-populate the Accurate Segment Parameter Modal
  const buildDraftFromStrokePoints = useCallback(
    (pts: { x: number; y: number }[], strokeId?: string): PendingSegmentDraft => {
      const pStart = pts[0];
      const pEnd = pts[pts.length - 1];
      const prevSeg = cadSegments.length > 0 ? cadSegments[cadSegments.length - 1] : null;
      const connectMode: 'chain_prev' | 'drawn_start' | 'close_to_first' = prevSeg
        ? 'chain_prev'
        : 'drawn_start';
      const effStart = prevSeg ? prevSeg.to : pStart;

      // Drawn vector & path length
      const drawnDx = pEnd.x - pStart.x;
      const drawnDy = pEnd.y - pStart.y;
      const drawnChord = Math.max(0.2, Math.hypot(drawnDx, drawnDy));
      let pathLen = 0;
      for (let i = 1; i < pts.length; i++) {
        pathLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      pathLen = Math.max(drawnChord, pathLen);

      // Maximum perpendicular distance from chord (sagitta h from center)
      const ux = drawnDx / drawnChord;
      const uy = drawnDy / drawnChord;
      // Normal pointing outward/upward for left-to-right arch: (-uy, ux)
      const nx = -uy;
      const ny = ux;
      let maxPosSagitta = 0;
      let maxNegSagitta = 0;
      for (const p of pts) {
        const vx = p.x - pStart.x;
        const vy = p.y - pStart.y;
        const signedPerp = vx * nx + vy * ny;
        if (signedPerp > maxPosSagitta) maxPosSagitta = signedPerp;
        if (-signedPerp > maxNegSagitta) maxNegSagitta = -signedPerp;
      }
      const peakSagitta = Math.max(maxPosSagitta, maxNegSagitta);
      const isCurve =
        pts.length >= 5 && (peakSagitta / drawnChord > 0.11 || pathLen / drawnChord > 1.06);
      const arcDirection: 'outward' | 'inward' =
        maxPosSagitta >= maxNegSagitta ? 'outward' : 'inward';

      // Angle in degrees (-180..180)
      const rawAngleDeg = Number(((Math.atan2(drawnDy, drawnDx) * 180) / Math.PI).toFixed(1));

      // Infer default portion from stroke position/orientation
      const midX = (pStart.x + pEnd.x) / 2;
      const midY = (pStart.y + pEnd.y) / 2;
      let defaultPortion: SegmentPortionChoice = 'crown';
      if (isCurve && midY >= 1.0) {
        defaultPortion = 'crown';
      } else if (Math.abs(drawnDy) >= Math.abs(drawnDx) * 0.85) {
        defaultPortion = midX <= 0 ? 'leftWall' : 'rightWall';
      } else if (midY <= 1.2 && !isCurve) {
        defaultPortion = 'invert';
      } else {
        defaultPortion = 'crown';
      }

      const defaultLen = Number((isCurve ? pathLen : drawnChord).toFixed(2));
      const defaultHeightFromCenter = Number(
        (isCurve ? Math.max(0.25, peakSagitta) : Math.max(0.5, Number((drawnChord * 0.22).toFixed(2)))).toFixed(2)
      );

      return {
        strokeId,
        drawnStart: { x: Number(pStart.x.toFixed(2)), y: Number(pStart.y.toFixed(2)) },
        drawnEnd: { x: Number(pEnd.x.toFixed(2)), y: Number(pEnd.y.toFixed(2)) },
        connectMode,
        startX: Number(effStart.x.toFixed(2)),
        startY: Number(effStart.y.toFixed(2)),
        type: isCurve ? 'arc' : 'line',
        lengthInput: String(defaultLen),
        angleInput: String(rawAngleDeg),
        heightFromCenterInput: String(defaultHeightFromCenter),
        arcDirection,
        arcEndpointMode: 'from_curve_and_height',
        portion: defaultPortion,
        isPortionOpen: false,
      };
    },
    [cadSegments]
  );

  // Pointer event handlers for drawing, panning, and dragging with pointer capture
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Palm Rejection: filter accidental palm or wrist contact on touchscreen devices
    if (palmRejectionEnabled && e.pointerType === 'touch') {
      if ((e.width && e.width > 24) || (e.height && e.height > 24) || (e.pressure && e.pressure > 0.85)) {
        return;
      }
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer capture not supported
    }

    // Pan tool or middle-mouse button or Shift+drag -> Pan Canvas
    if (canvasTool === 'pan' || e.button === 1 || e.shiftKey) {
      setIsPanningCanvas(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: canvasPan.x,
        panY: canvasPan.y,
      };
      return;
    }

    const pt = clientToMeters(e.clientX, e.clientY);
    if (!pt) return;

    if (canvasTool === 'dimension_pin') {
      setPendingAnnotationPos(pt);
      setShowAnnotationModal(true);
      return;
    }

    if (canvasTool === 'eraser') {
      // Check if clicking near a confirmed CAD segment first
      const segIdx = cadSegments.findIndex((seg) => {
        const mx = (seg.from.x + seg.to.x) / 2;
        const my = (seg.from.y + seg.to.y) / 2;
        return (
          Math.hypot(seg.from.x - pt.x, seg.from.y - pt.y) < 0.65 ||
          Math.hypot(seg.to.x - pt.x, seg.to.y - pt.y) < 0.65 ||
          Math.hypot(mx - pt.x, my - pt.y) < 0.75
        );
      });
      if (segIdx !== -1) {
        const removed = cadSegments[segIdx];
        setCadSegments((prev) => prev.filter((_, i) => i !== segIdx));
        if (removed.strokeId) {
          setStrokes((prev) => prev.filter((s) => s.id !== removed.strokeId));
        }
        return;
      }
      // Find nearest stroke or annotation to erase
      const strokeIdx = strokes.findIndex((s) =>
        s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.6)
      );
      if (strokeIdx !== -1) {
        const removedStroke = strokes[strokeIdx];
        setStrokes((prev) => prev.filter((_, i) => i !== strokeIdx));
        setCadSegments((prev) => prev.filter((seg) => seg.strokeId !== removedStroke.id));
        return;
      }
      const annIdx = textAnnotations.findIndex(
        (a) => Math.hypot(a.x - pt.x, a.y - pt.y) < 0.8
      );
      if (annIdx !== -1) {
        setTextAnnotations((prev) => prev.filter((_, i) => i !== annIdx));
        return;
      }
      return;
    }

    // Default pencil mode
    if (!activeHandle && !activeVertexId) {
      setIsDrawing(true);
      setCurrentStroke([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (palmRejectionEnabled && e.pointerType === 'touch') {
      if ((e.width && e.width > 24) || (e.height && e.height > 24)) {
        return;
      }
    }

    if (isPanningCanvas && panStartRef.current) {
      const el = svgRef.current;
      const rect = el ? el.getBoundingClientRect() : { width: 800, height: 480 };
      const svgScaleX = 800 / Math.max(1, rect.width);
      const svgScaleY = 480 / Math.max(1, rect.height);
      const dxSvg = (e.clientX - panStartRef.current.clientX) * svgScaleX;
      const dySvg = (e.clientY - panStartRef.current.clientY) * svgScaleY;
      setCanvasPan({
        x: Number((panStartRef.current.panX + dxSvg).toFixed(1)),
        y: Number((panStartRef.current.panY + dySvg).toFixed(1)),
      });
      return;
    }

    if (!isDrawing && !activeHandle && !activeVertexId) return;
    const pt = clientToMeters(e.clientX, e.clientY);
    if (!pt) return;

    if (isDrawing) {
      setCurrentStroke((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.hypot(last.x - pt.x, last.y - pt.y) < 0.06) return prev;
        return [...prev, pt];
      });
      return;
    }

    if (activeVertexId) {
      setCustomVertexOverrides((prev) => ({
        ...prev,
        [activeVertexId]: {
          x: Number(pt.x.toFixed(2)),
          y: Number(Math.max(-4.0, pt.y).toFixed(2)),
        },
      }));
      return;
    }

    if (activeHandle === 'crown_apex') {
      const minWallH = Math.min(leftWallHeightM, rightWallHeightM);
      const newH = Math.max(minWallH + 0.2, pt.y);
      markParamLocked('heightM');
      setHeightM(Number(newH.toFixed(2)));
      setCrownSagittaM(Number((newH - minWallH).toFixed(2)));
      setCrownArcLengthM(null);
      if (!isSymmetric) {
        const maxOffset = widthM * 0.45;
        const newOffset = Math.max(-maxOffset, Math.min(maxOffset, pt.x));
        markParamLocked('apexOffsetXM');
        setCrownApexOffsetXM(Number(newOffset.toFixed(2)));
      }
    } else if (activeHandle === 'left_wall') {
      const newWallH = Math.max(0.5, Math.min(heightM - 0.2, pt.y));
      handleLeftWallHeightChange(Number(newWallH.toFixed(2)));
      const newSpan = Math.max(1.0, Math.abs(pt.x));
      handleLeftSpanChange(Number(newSpan.toFixed(2)));
    } else if (activeHandle === 'right_wall') {
      const newWallH = Math.max(0.5, Math.min(heightM - 0.2, pt.y));
      if (isSymmetric) {
        handleLeftWallHeightChange(Number(newWallH.toFixed(2)));
      } else {
        markParamLocked('rightWallHeightM');
        setRightWallHeightM(Number(newWallH.toFixed(2)));
      }
      const newSpan = Math.max(1.0, Math.abs(pt.x));
      handleRightSpanChange(Number(newSpan.toFixed(2)));
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
      panStartRef.current = null;
      return;
    }
    if (isDrawing && currentStroke.length >= 2) {
      const firstPt = currentStroke[0];
      const lastPt = currentStroke[currentStroke.length - 1];
      let strokeLen = 0;
      for (let i = 1; i < currentStroke.length; i++) {
        strokeLen += Math.hypot(
          currentStroke[i].x - currentStroke[i - 1].x,
          currentStroke[i].y - currentStroke[i - 1].y
        );
      }
      // Only trigger the Accurate Segment Parameter Modal if the user actually drew a line/curve (>= 0.15m)
      if (strokeLen >= 0.15 || Math.hypot(lastPt.x - firstPt.x, lastPt.y - firstPt.y) >= 0.15) {
        const newStrokeId = `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newStroke: SketchStroke = {
          id: newStrokeId,
          points: currentStroke,
        };
        setStrokes((prev) => [...prev, newStroke]);
        // Open Accurate Segment Parameter Modal (NO live shape guessing!)
        const draft = buildDraftFromStrokePoints(currentStroke, newStrokeId);
        setPendingSegmentDraft(draft);
      }
    }
    setIsDrawing(false);
    setCurrentStroke([]);
    setActiveHandle(null);
    setActiveVertexId(null);
  };

  // Render clean offscreen 800x480 PNG containing ONLY the grid, datum axes, user strokes, and user pins
  // (never polluted by stale blue CAD overlays) for Gemini multimodal vision analysis
  const captureCanvasPngBase64 = async (): Promise<string> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 800, 480);

      // 1-meter minor grid (36px) & 5-meter major grid (180px)
      for (let x = 0; x <= 800; x += scale) {
        ctx.strokeStyle = x % (scale * 5) === 0 ? '#334155' : '#1e293b';
        ctx.lineWidth = x % (scale * 5) === 0 ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 0; y <= 480; y += scale) {
        ctx.strokeStyle = y % (scale * 5) === 0 ? '#334155' : '#1e293b';
        ctx.lineWidth = y % (scale * 5) === 0 ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // Centerline (X=400) & Invert Datum (Y=380)
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(400, 20);
      ctx.lineTo(400, 460);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 380);
      ctx.lineTo(760, 380);
      ctx.stroke();

      // User drawn strokes
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const allStrokes = [...strokes.map((s) => s.points)];
      if (currentStroke.length >= 2) allStrokes.push(currentStroke);

      for (const pts of allStrokes) {
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(toSvgX(pts[0].x), toSvgY(pts[0].y));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(toSvgX(pts[i].x), toSvgY(pts[i].y));
        }
        ctx.stroke();
      }

      // User pinned dimension annotations
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const ann of textAnnotations) {
        const px = toSvgX(ann.x);
        const py = toSvgY(ann.y);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(px - 50, py - 13, 100, 26);
        ctx.strokeRect(px - 50, py - 13, 100, 26);
        ctx.fillStyle = '#fcd34d';
        ctx.fillText(ann.text, px, py);
      }

      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  };

  // Build locked user parameters object to send to backend solver
  const getLockedUserParametersPayload = useCallback(() => {
    const locked = userLockedParamsRef.current;
    const payload: Record<string, any> = {};
    if (locked.has('widthM')) payload.widthM = widthM;
    if (locked.has('leftSpanM')) payload.leftSpanM = leftSpanM;
    if (locked.has('rightSpanM')) payload.rightSpanM = rightSpanM;
    if (locked.has('heightM')) payload.heightM = heightM;
    if (locked.has('leftWallHeightM')) payload.leftWallHeightM = leftWallHeightM;
    if (locked.has('rightWallHeightM')) payload.rightWallHeightM = rightWallHeightM;
    if (locked.has('leftWallAngleDeg')) payload.leftWallAngleDeg = leftWallAngleDeg;
    if (locked.has('rightWallAngleDeg')) payload.rightWallAngleDeg = rightWallAngleDeg;
    if (locked.has('crownArcLengthM') && crownArcLengthM) payload.crownArcLengthM = crownArcLengthM;
    if (locked.has('crownType')) payload.crownType = crownType;
    if (locked.has('invertType')) payload.invertType = invertType;
    if (locked.has('invertSagittaM')) payload.invertSagittaM = invertSagittaM;
    if (locked.has('openWall')) payload.openWall = openWall;
    if (locked.has('apexOffsetXM')) payload.apexOffsetXM = crownApexOffsetXM;
    return payload;
  }, [
    widthM,
    leftSpanM,
    rightSpanM,
    heightM,
    leftWallHeightM,
    rightWallHeightM,
    leftWallAngleDeg,
    rightWallAngleDeg,
    crownArcLengthM,
    crownType,
    invertType,
    invertSagittaM,
    openWall,
    crownApexOffsetXM,
  ]);

  // Deterministic local solver (also used to validate/reconcile parameters)
  const solveLocallyFromStrokes = useCallback(() => {
    const geom = analyzeStrokesGeometrically(!isSymmetric);
    const parsedPins = parseAnnotationsWithSpatialContext(textAnnotations, geom);
    const locked = userLockedParamsRef.current;

    const detectedOpen: 'none' | 'left' | 'right' =
      parsedPins.ovrOpenWall ??
      (locked.has('openWall') ? openWall : geom?.openWall ?? openWall);

    const nextIsSymmetric: boolean =
      detectedOpen !== 'none'
        ? false
        : !isSymmetric
        ? false
        : parsedPins.ovrLeftWallH !== null &&
          parsedPins.ovrRightWallH !== null &&
          Math.abs(parsedPins.ovrLeftWallH - parsedPins.ovrRightWallH) > 0.05
        ? false
        : parsedPins.ovrLeftAngle !== null &&
          parsedPins.ovrRightAngle !== null &&
          Math.abs(parsedPins.ovrLeftAngle - parsedPins.ovrRightAngle) >= 1
        ? false
        : geom
        ? geom.isSymmetric
        : isSymmetric;

    const calcW = Number(
      (
        parsedPins.ovrWidth ??
        (locked.has('widthM') ? widthM : geom ? geom.span : widthM)
      ).toFixed(2)
    );

    const calcLeftSpan = nextIsSymmetric
      ? Number((calcW / 2).toFixed(2))
      : Number(
          (
            parsedPins.ovrLeftSpan ??
            (locked.has('leftSpanM') ? leftSpanM : geom ? geom.leftSpan : calcW / 2)
          ).toFixed(2)
        );
    const calcRightSpan = nextIsSymmetric
      ? Number((calcW / 2).toFixed(2))
      : Number(
          (
            parsedPins.ovrRightSpan ??
            (locked.has('rightSpanM') ? rightSpanM : geom ? geom.rightSpan : calcW / 2)
          ).toFixed(2)
        );
    const finalW = nextIsSymmetric ? calcW : Number((calcLeftSpan + calcRightSpan).toFixed(2));

    let calcH = Number(
      (
        parsedPins.ovrHeight ??
        (locked.has('heightM') ? heightM : geom ? geom.totalH : heightM)
      ).toFixed(2)
    );

    let calcLeftWallH =
      detectedOpen === 'left'
        ? 0
        : Number(
            (
              parsedPins.ovrLeftWallH ??
              (locked.has('leftWallHeightM')
                ? leftWallHeightM
                : geom
                ? geom.leftWallH
                : leftWallHeightM)
            ).toFixed(2)
          );

    let calcRightWallH =
      detectedOpen === 'right'
        ? 0
        : nextIsSymmetric
        ? calcLeftWallH
        : Number(
            (
              parsedPins.ovrRightWallH ??
              (locked.has('rightWallHeightM')
                ? rightWallHeightM
                : geom
                ? geom.rightWallH
                : rightWallHeightM)
            ).toFixed(2)
          );

    const calcCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' =
      parsedPins.ovrCrownType ??
      (locked.has('crownType') ? crownType : geom ? geom.crownType : crownType);

    if (geom?.shapeKind === 'triangle' && !parsedPins.ovrLeftWallH && !locked.has('leftWallHeightM')) {
      calcLeftWallH = 0;
      calcRightWallH = 0;
    } else if (calcCrownType === 'flat' && detectedOpen === 'none' && !parsedPins.ovrLeftWallH && !locked.has('leftWallHeightM')) {
      calcLeftWallH = calcH;
      calcRightWallH = calcH;
    } else {
      if (detectedOpen !== 'left') {
        calcLeftWallH = Number(Math.max(0.4, Math.min(calcH - 0.1, calcLeftWallH)).toFixed(2));
      }
      if (detectedOpen !== 'right') {
        calcRightWallH = Number(Math.max(0.4, Math.min(calcH - 0.1, calcRightWallH)).toFixed(2));
      }
    }

    const calcLeftAngle =
      parsedPins.ovrLeftAngle ??
      (locked.has('leftWallAngleDeg') ? leftWallAngleDeg : geom ? geom.leftAngle : leftWallAngleDeg);
    const calcRightAngle = nextIsSymmetric
      ? calcLeftAngle
      : parsedPins.ovrRightAngle ??
        (locked.has('rightWallAngleDeg')
          ? rightWallAngleDeg
          : geom
          ? geom.rightAngle
          : rightWallAngleDeg);

    const calcInvertType: 'flat' | 'curved_dish' =
      parsedPins.ovrInvertType ??
      (locked.has('invertType') ? invertType : geom ? geom.invertType : invertType);
    const calcInvertDish = Number(
      (
        parsedPins.ovrInvertDish ??
        (locked.has('invertSagittaM')
          ? invertSagittaM
          : geom
          ? geom.invertSagittaM
          : invertSagittaM)
      ).toFixed(2)
    );

    const calcCrownArc =
      parsedPins.ovrCrownArcLength ??
      (locked.has('crownArcLengthM') ? crownArcLengthM : null);

    const calcApexOffset = nextIsSymmetric
      ? 0
      : locked.has('apexOffsetXM')
      ? crownApexOffsetXM
      : geom
      ? geom.apexOffsetX
      : crownApexOffsetXM;

    // If Crown Arc Length C is specified, compute exact resulting sagitta and update heightM if height was not pinned
    const leftRad = ((90 - calcLeftAngle) * Math.PI) / 180;
    const rightRad = ((90 - calcRightAngle) * Math.PI) / 180;
    const lTopX = -calcLeftSpan + Math.tan(leftRad) * (detectedOpen === 'left' ? calcH : calcLeftWallH);
    const rTopX = calcRightSpan - Math.tan(rightRad) * (detectedOpen === 'right' ? calcH : calcRightWallH);
    const lTopY = detectedOpen === 'left' ? calcH : calcLeftWallH;
    const rTopY = detectedOpen === 'right' ? calcH : calcRightWallH;
    const chord = Math.max(0.5, Math.hypot(rTopX - lTopX, rTopY - lTopY));
    const midShoulderY = (lTopY + rTopY) / 2;

    let calcSagitta = Number(Math.max(0, calcH - Math.min(lTopY, rTopY)).toFixed(2));
    if (calcCrownArc && calcCrownArc > chord * 1.001) {
      const bulge = computeBulgeFromArcLength(chord, calcCrownArc, 1);
      calcSagitta = Number(((chord * Math.abs(bulge)) / 2).toFixed(2));
      if (detectedOpen === 'none' && parsedPins.ovrHeight === null && !locked.has('heightM')) {
        calcH = Number((midShoulderY + calcSagitta).toFixed(2));
      }
    }

    setOpenWall(detectedOpen);
    setIsSymmetric(nextIsSymmetric);
    setWidthM(finalW);
    setLeftSpanM(calcLeftSpan);
    setRightSpanM(calcRightSpan);
    setHeightM(calcH);
    setLeftWallHeightM(calcLeftWallH);
    setRightWallHeightM(calcRightWallH);
    setLeftWallAngleDeg(calcLeftAngle);
    setRightWallAngleDeg(calcRightAngle);
    setCrownApexOffsetXM(calcApexOffset);
    setCrownType(calcCrownType);
    setInvertType(calcInvertType);
    setInvertSagittaM(calcInvertDish);
    setCrownSagittaM(calcSagitta);
    if (calcCrownArc) {
      setCrownArcLengthM(calcCrownArc);
    }

    setHasAnalyzedShape(true);
    setAnalysisSource('LOCAL_SOLVER');
    const shapeLabel =
      geom?.shapeKind === 'triangle'
        ? `Triangle CAD Profile (${geom.controlPoints.length} vertices)`
        : geom?.shapeKind === 'quadrilateral'
        ? `Quadrilateral CAD Profile (${geom.controlPoints.length} vertices)`
        : geom?.shapeKind === 'pentagon_gable'
        ? `Pentagonal/Gable CAD Profile (${geom.controlPoints.length} vertices)`
        : geom?.shapeKind === 'polygon'
        ? `Polygonal CAD Profile (${geom.controlPoints.length} vertices)`
        : `${nextIsSymmetric ? 'Symmetric' : 'Non-Symmetric'} CAD Profile`;
    setAnalysisExplanation(
      detectedOpen !== 'none'
        ? `Solved Open Slashing Profile (${detectedOpen} wall open): Span ${finalW.toFixed(2)}m, Height ${calcH.toFixed(2)}m${
            calcCrownArc ? `, Curve Arc C=${calcCrownArc.toFixed(2)}m` : ''
          }.`
        : geom?.shapeKind === 'triangle'
        ? `Solved ${shapeLabel}: Span ${finalW.toFixed(2)}m × Height ${calcH.toFixed(2)}m (Flank angles: L ${calcLeftAngle}°, R ${calcRightAngle}°).`
        : `Solved ${shapeLabel}: Span ${finalW.toFixed(2)}m × Height ${calcH.toFixed(2)}m (L-Wall: ${calcLeftWallH.toFixed(2)}m @ ${calcLeftAngle}°, R-Wall: ${calcRightWallH.toFixed(2)}m @ ${calcRightAngle}°${
            calcCrownArc ? `, Curve Arc C=${calcCrownArc.toFixed(2)}m` : ''
          }).`
    );
  }, [
    analyzeStrokesGeometrically,
    parseAnnotationsWithSpatialContext,
    textAnnotations,
    isSymmetric,
    openWall,
    widthM,
    leftSpanM,
    rightSpanM,
    heightM,
    leftWallHeightM,
    rightWallHeightM,
    leftWallAngleDeg,
    rightWallAngleDeg,
    crownType,
    invertType,
    invertSagittaM,
    crownArcLengthM,
    crownApexOffsetXM,
  ]);

  // AI & Computer Vision Shape Solver Trigger
  const handleRunAiAnalysis = async () => {
    setIsAnalyzingAi(true);
    setAnalysisExplanation(null);

    try {
      const imageBase64 = await captureCanvasPngBase64();
      const geomMetrics = analyzeStrokesGeometrically(!isSymmetric);
      const userParameters = getLockedUserParametersPayload();

      const res = await fetch('/api/ai/analyze-sketch-shape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getEswaApiSecurityHeaders(),
        },
        body: JSON.stringify({
          imageBase64,
          strokes: strokes.map((s) => s.points),
          textAnnotations: textAnnotations.map((a) => ({ text: a.text, x: a.x, y: a.y })),
          clientMetrics: geomMetrics,
          userParameters,
          tunnelName,
          userSymmetryPreference: isSymmetric ? 'symmetric' : 'non-symmetric',
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.result) {
        const r = data.result;
        // Preserve Exact Sketch Mode (non-symmetric) when strokes exist unless user explicitly toggled symmetry
        const nextSym = userLockedParamsRef.current.has('isSymmetric')
          ? isSymmetric
          : strokes.length > 0
          ? false
          : typeof r.isSymmetric === 'boolean'
          ? r.isSymmetric
          : isSymmetric;
        setIsSymmetric(nextSym);

        if (r.openWall === 'left' || r.openWall === 'right' || r.openWall === 'none') {
          setOpenWall(r.openWall);
        } else if (r.hasLeftWall === false) {
          setOpenWall('left');
        } else if (r.hasRightWall === false) {
          setOpenWall('right');
        }

        if (typeof r.widthM === 'number') setWidthM(Number(r.widthM.toFixed(2)));
        if (typeof r.leftSpanM === 'number') {
          setLeftSpanM(Number(r.leftSpanM.toFixed(2)));
        } else if (typeof r.widthM === 'number') {
          setLeftSpanM(Number((r.widthM / 2).toFixed(2)));
        }
        if (typeof r.rightSpanM === 'number') {
          setRightSpanM(Number(r.rightSpanM.toFixed(2)));
        } else if (typeof r.widthM === 'number') {
          setRightSpanM(Number((r.widthM / 2).toFixed(2)));
        }
        if (typeof r.heightM === 'number') setHeightM(Number(r.heightM.toFixed(2)));
        if (typeof r.apexOffsetXM === 'number') {
          setCrownApexOffsetXM(nextSym ? 0 : Number(r.apexOffsetXM.toFixed(2)));
        }
        if (typeof r.leftWallHeightM === 'number') {
          setLeftWallHeightM(Number(r.leftWallHeightM.toFixed(2)));
        }
        if (typeof r.rightWallHeightM === 'number') {
          setRightWallHeightM(Number(r.rightWallHeightM.toFixed(2)));
        }
        if (typeof r.leftWallAngleDeg === 'number') {
          setLeftWallAngleDeg(Number(r.leftWallAngleDeg.toFixed(1)));
        }
        if (typeof r.rightWallAngleDeg === 'number') {
          setRightWallAngleDeg(Number(r.rightWallAngleDeg.toFixed(1)));
        }
        if (typeof r.crownSagittaM === 'number') {
          setCrownSagittaM(Number(r.crownSagittaM.toFixed(2)));
        }
        if (typeof r.crownArcLengthM === 'number' && r.crownArcLengthM > 0) {
          setCrownArcLengthM(Number(r.crownArcLengthM.toFixed(2)));
          setCrownType('circular_arc');
        }
        if (
          r.crownType === 'circular_arc' ||
          r.crownType === 'basket_handle_3arc' ||
          r.crownType === 'flat'
        ) {
          setCrownType(r.crownType);
        }
        if (r.invertType === 'flat' || r.invertType === 'curved_dish') {
          setInvertType(r.invertType);
        }
        if (typeof r.invertSagittaM === 'number') {
          setInvertSagittaM(Number(r.invertSagittaM.toFixed(2)));
        }
        if (r.archetype) setSelectedArchetype(r.archetype as StarterArchetype);

        setAnalysisSource(data.source === 'GEMINI_AI_VISION' ? 'GEMINI_AI_VISION' : 'LOCAL_SOLVER');
        setAnalysisExplanation(
          r.explanation ||
            `Analyzed sketch: ${r.archetype || 'tunnel'} profile (${r.widthM}m W × ${r.heightM}m H${
              r.crownArcLengthM ? `, Curve Arc C=${r.crownArcLengthM}m` : ''
            }${r.openWall && r.openWall !== 'none' ? `, ${r.openWall.toUpperCase()} WALL OPEN` : ''}).`
        );
        setHasAnalyzedShape(true);
      } else {
        throw new Error('Invalid analysis response');
      }
    } catch {
      solveLocallyFromStrokes();
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Immediately apply a newly placed annotation pin to live parameters
  const applyAnnotationPinToLiveState = useCallback(
    (ann: DimensionAnnotation, allAnns: DimensionAnnotation[]) => {
      const geom = analyzeStrokesGeometrically(!isSymmetric);
      const parsed = parseAnnotationsWithSpatialContext(allAnns, geom);
      if (parsed.ovrOpenWall) {
        setOpenWall(parsed.ovrOpenWall);
        setIsSymmetric(false);
        setSelectedArchetype('open_slashing_drift');
        markParamLocked('openWall');
      }
      if (parsed.ovrCrownType) {
        setCrownType(parsed.ovrCrownType);
        markParamLocked('crownType');
      }
      if (parsed.ovrInvertType) {
        setInvertType(parsed.ovrInvertType);
        markParamLocked('invertType');
      }
      if (parsed.ovrInvertDish !== null) {
        setInvertSagittaM(parsed.ovrInvertDish);
        markParamLocked('invertSagittaM');
      }
      if (parsed.ovrCrownArcLength !== null) {
        setCrownArcLengthM(parsed.ovrCrownArcLength);
        setCrownType('circular_arc');
        markParamLocked('crownArcLengthM', 'crownType');
      }
      if (parsed.ovrWidth !== null) {
        handleTotalWidthChange(parsed.ovrWidth);
      }
      if (parsed.ovrLeftSpan !== null) {
        handleLeftSpanChange(parsed.ovrLeftSpan);
      }
      if (parsed.ovrRightSpan !== null) {
        handleRightSpanChange(parsed.ovrRightSpan);
      }
      if (parsed.ovrHeight !== null) {
        setHeightM(parsed.ovrHeight);
        markParamLocked('heightM');
      }
      if (parsed.ovrLeftWallH !== null) {
        setLeftWallHeightM(parsed.ovrLeftWallH);
        markParamLocked('leftWallHeightM');
        if (isSymmetric && parsed.ovrRightWallH === null) {
          setRightWallHeightM(parsed.ovrLeftWallH);
          markParamLocked('rightWallHeightM');
        }
      }
      if (parsed.ovrRightWallH !== null) {
        setRightWallHeightM(parsed.ovrRightWallH);
        markParamLocked('rightWallHeightM');
        if (
          parsed.ovrLeftWallH !== null &&
          Math.abs(parsed.ovrLeftWallH - parsed.ovrRightWallH) > 0.05
        ) {
          setIsSymmetric(false);
        }
      }
      if (parsed.ovrLeftAngle !== null) {
        setLeftWallAngleDeg(parsed.ovrLeftAngle);
        markParamLocked('leftWallAngleDeg');
        if (isSymmetric && parsed.ovrRightAngle === null) {
          setRightWallAngleDeg(parsed.ovrLeftAngle);
          markParamLocked('rightWallAngleDeg');
        }
      }
      if (parsed.ovrRightAngle !== null) {
        setRightWallAngleDeg(parsed.ovrRightAngle);
        markParamLocked('rightWallAngleDeg');
      }
    },
    [
      analyzeStrokesGeometrically,
      parseAnnotationsWithSpatialContext,
      isSymmetric,
      markParamLocked,
    ]
  );

  // Add annotation pin
  const handleAddAnnotationConfirm = () => {
    if (!newAnnotationInput.trim() || !pendingAnnotationPos) {
      setShowAnnotationModal(false);
      return;
    }
    const newPin: DimensionAnnotation = {
      id: `ann-${Date.now()}`,
      text: newAnnotationInput.trim(),
      x: pendingAnnotationPos.x,
      y: pendingAnnotationPos.y,
    };
    const nextAnns = [...textAnnotations, newPin];
    setTextAnnotations(nextAnns);
    applyAnnotationPinToLiveState(newPin, nextAnns);

    setNewAnnotationInput('');
    setPendingAnnotationPos(null);
    setShowAnnotationModal(false);
  };

  // Clear / Redraw: Resets canvas back to COMPLETELY EMPTY
  const handleRedrawClearAll = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setCadSegments([]);
    setPendingSegmentDraft(null);
    setTextAnnotations([]);
    setCustomVertexOverrides({});
    setCrownArcLengthM(null);
    setOpenWall('none');
    setOpenPortions({ leftWall: false, crown: false, rightWall: false, invert: false });
    setIsSymmetric(false);
    userLockedParamsRef.current.clear();
    setHasAnalyzedShape(false);
    setAnalysisExplanation(null);
  };

  // Compute live preview geometry for the active PendingSegmentDraft
  const computeSegmentFromDraft = useCallback(
    (draft: PendingSegmentDraft): CadBuilderSegment => {
      const prevSeg =
        draft.editingSegmentId
          ? (() => {
              const idx = cadSegments.findIndex((s) => s.id === draft.editingSegmentId);
              return idx > 0 ? cadSegments[idx - 1] : null;
            })()
          : cadSegments.length > 0
          ? cadSegments[cadSegments.length - 1]
          : null;

      const startPt =
        draft.connectMode === 'chain_prev' && prevSeg
          ? { x: prevSeg.to.x, y: prevSeg.to.y }
          : {
              x: Number.isFinite(Number(draft.startX)) ? Number(draft.startX) : draft.drawnStart.x,
              y: Number.isFinite(Number(draft.startY)) ? Number(draft.startY) : draft.drawnStart.y,
            };

      const parsedLen = Math.max(0.1, parseFloat(draft.lengthInput) || 1.0);
      const parsedAngle = Number.isFinite(parseFloat(draft.angleInput))
        ? parseFloat(draft.angleInput)
        : 0;
      const parsedHeight = Math.max(0, parseFloat(draft.heightFromCenterInput) || 0);
      const rad = (parsedAngle * Math.PI) / 180;

      if (draft.type === 'line') {
        let endPt = {
          x: Number((startPt.x + parsedLen * Math.cos(rad)).toFixed(3)),
          y: Number((startPt.y + parsedLen * Math.sin(rad)).toFixed(3)),
        };
        let finalLen = parsedLen;
        let finalAngle = parsedAngle;
        if (draft.connectMode === 'close_to_first' && cadSegments.length > 0) {
          const firstPt = cadSegments[0].from;
          endPt = { x: firstPt.x, y: firstPt.y };
          finalLen = Number(Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y).toFixed(3));
          finalAngle = Number(
            ((Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x) * 180) / Math.PI).toFixed(1)
          );
        }
        return {
          id: draft.editingSegmentId || `cad-seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          strokeId: draft.strokeId,
          from: startPt,
          to: endPt,
          type: 'line',
          lengthM: Number(finalLen.toFixed(3)),
          angleDeg: Number(finalAngle.toFixed(1)),
          heightFromCenterM: 0,
          arcDirection: 'outward',
          arcBulge: 0,
          chordLengthM: Number(finalLen.toFixed(3)),
          portion: draft.portion,
          isPortionOpen: draft.isPortionOpen || draft.portion === 'open',
        };
      }

      // Curve / Arc segment: solved from Length of Curve (C) and Height from Center (h)
      const dirSign: 1 | -1 = draft.arcDirection === 'inward' ? -1 : 1;
      if (draft.connectMode === 'close_to_first' && cadSegments.length > 0) {
        const endPt = { x: cadSegments[0].from.x, y: cadSegments[0].from.y };
        const chord = Math.max(0.1, Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y));
        const bulge =
          parsedHeight > 0.01
            ? Number((dirSign * ((2 * parsedHeight) / chord)).toFixed(5))
            : computeBulgeFromArcLength(chord, Math.max(chord * 1.01, parsedLen), dirSign);
        const evalArc = evaluateArcSegment(startPt, endPt, bulge, 24);
        return {
          id: draft.editingSegmentId || `cad-seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          strokeId: draft.strokeId,
          from: startPt,
          to: endPt,
          type: 'arc',
          lengthM: Number(evalArc.arcLength.toFixed(3)),
          angleDeg: Number(
            ((Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x) * 180) / Math.PI).toFixed(1)
          ),
          heightFromCenterM: Number(parsedHeight.toFixed(3)),
          arcDirection: draft.arcDirection,
          arcBulge: bulge,
          chordLengthM: Number(chord.toFixed(3)),
          portion: draft.portion,
          isPortionOpen: draft.isPortionOpen || draft.portion === 'open',
        };
      }

      if (draft.arcEndpointMode === 'keep_drawn_chord') {
        const endPt = { x: draft.drawnEnd.x, y: draft.drawnEnd.y };
        const chord = Math.max(0.1, Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y));
        const bulge =
          parsedHeight > 0.01
            ? Number((dirSign * ((2 * parsedHeight) / chord)).toFixed(5))
            : computeBulgeFromArcLength(chord, Math.max(chord * 1.01, parsedLen), dirSign);
        const evalArc = evaluateArcSegment(startPt, endPt, bulge, 24);
        return {
          id: draft.editingSegmentId || `cad-seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          strokeId: draft.strokeId,
          from: startPt,
          to: endPt,
          type: 'arc',
          lengthM: Number(evalArc.arcLength.toFixed(3)),
          angleDeg: Number(
            ((Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x) * 180) / Math.PI).toFixed(1)
          ),
          heightFromCenterM: Number(((Math.abs(bulge) * chord) / 2).toFixed(3)),
          arcDirection: draft.arcDirection,
          arcBulge: bulge,
          chordLengthM: Number(chord.toFixed(3)),
          portion: draft.portion,
          isPortionOpen: draft.isPortionOpen || draft.portion === 'open',
        };
      }

      // Default: Exact circular arc from Length of Curve (C) and Height from Center (h) along Angle (°)
      const solvedArc = solveCircularArcFromCurveLengthAndHeight(parsedLen, parsedHeight, dirSign);
      const chord = solvedArc.chordLength;
      const endPt = {
        x: Number((startPt.x + chord * Math.cos(rad)).toFixed(3)),
        y: Number((startPt.y + chord * Math.sin(rad)).toFixed(3)),
      };
      return {
        id: draft.editingSegmentId || `cad-seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        strokeId: draft.strokeId,
        from: startPt,
        to: endPt,
        type: 'arc',
        lengthM: Number(parsedLen.toFixed(3)),
        angleDeg: Number(parsedAngle.toFixed(1)),
        heightFromCenterM: Number(parsedHeight.toFixed(3)),
        arcDirection: draft.arcDirection,
        arcBulge: solvedArc.bulge,
        chordLengthM: Number(chord.toFixed(3)),
        portion: draft.portion,
        isPortionOpen: draft.isPortionOpen || draft.portion === 'open',
      };
    },
    [cadSegments]
  );

  // Confirm & Add/Update the segment from the Accurate Segment Parameter Modal
  const handleConfirmSegmentDraft = useCallback(() => {
    if (!pendingSegmentDraft) return;
    const built = computeSegmentFromDraft(pendingSegmentDraft);

    setCadSegments((prev) => {
      if (pendingSegmentDraft.editingSegmentId) {
        const idx = prev.findIndex((s) => s.id === pendingSegmentDraft.editingSegmentId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = built;
          // Chain subsequent connected segments if endpoint moved
          for (let k = idx + 1; k < next.length; k++) {
            const prevEnd = next[k - 1].to;
            const dx = next[k].to.x - next[k].from.x;
            const dy = next[k].to.y - next[k].from.y;
            next[k] = {
              ...next[k],
              from: { x: prevEnd.x, y: prevEnd.y },
              to: {
                x: Number((prevEnd.x + dx).toFixed(3)),
                y: Number((prevEnd.y + dy).toFixed(3)),
              },
            };
          }
          return next;
        }
      }
      return [...prev, built];
    });

    // Update openPortions if the user marked this portion as Open or Mapped
    if (built.portion !== 'open') {
      setOpenPortions((prev) => ({
        ...prev,
        [built.portion]: built.isPortionOpen,
      }));
      if (built.portion === 'leftWall') {
        setOpenWall(built.isPortionOpen ? 'left' : openWall === 'left' ? 'none' : openWall);
      } else if (built.portion === 'rightWall') {
        setOpenWall(built.isPortionOpen ? 'right' : openWall === 'right' ? 'none' : openWall);
      }
    }

    userLockedParamsRef.current.delete('archetypePreset');
    setHasAnalyzedShape(true);
    setAnalysisSource('LOCAL_SOLVER');
    setAnalysisExplanation(
      built.type === 'line'
        ? `Added exact ${built.portion.toUpperCase()} Straight Line: Length = ${built.lengthM.toFixed(2)}m, Angle = ${built.angleDeg.toFixed(1)}°${built.isPortionOpen ? ' (OPEN — Not reflected on Face Mapping Canvas)' : ''}.`
        : `Added exact ${built.portion.toUpperCase()} Curve: Length of Curve = ${built.lengthM.toFixed(2)}m, Height from Center = ${built.heightFromCenterM.toFixed(2)}m${built.isPortionOpen ? ' (OPEN — Not reflected on Face Mapping Canvas)' : ''}.`
    );
    setPendingSegmentDraft(null);
  }, [pendingSegmentDraft, computeSegmentFromDraft, openWall]);

  // Cancel the modal (and remove the unconfirmed raw stroke if it was just drawn)
  const handleCancelSegmentDraft = useCallback(() => {
    if (pendingSegmentDraft?.strokeId && !pendingSegmentDraft.editingSegmentId) {
      const sid = pendingSegmentDraft.strokeId;
      setStrokes((prev) => prev.filter((s) => s.id !== sid));
    }
    setPendingSegmentDraft(null);
  }, [pendingSegmentDraft]);

  // Open an existing CAD segment in the modal for editing
  const handleOpenSegmentForEdit = useCallback((seg: CadBuilderSegment) => {
    setPendingSegmentDraft({
      strokeId: seg.strokeId,
      editingSegmentId: seg.id,
      drawnStart: { ...seg.from },
      drawnEnd: { ...seg.to },
      connectMode: 'drawn_start',
      startX: seg.from.x,
      startY: seg.from.y,
      type: seg.type,
      lengthInput: String(seg.lengthM),
      angleInput: String(seg.angleDeg),
      heightFromCenterInput: String(seg.heightFromCenterM || 1.2),
      arcDirection: seg.arcDirection || 'outward',
      arcEndpointMode: 'from_curve_and_height',
      portion: seg.portion,
      isPortionOpen: seg.isPortionOpen,
    });
  }, []);

  // Helper: Solve circular arc bulge from p1=(x1,y1) to p2=(x2,y2) so the highest point on the arc reaches targetMaxY
  const solveArcBulgeForTargetApexY = useCallback(
    (x1: number, y1: number, x2: number, y2: number, targetMaxY: number): number => {
      const chord = Math.hypot(x2 - x1, y2 - y1);
      if (chord < 1e-4) return 0;
      const maxEndpointY = Math.max(y1, y2);
      if (targetMaxY <= maxEndpointY + 0.01) {
        return 0.02;
      }
      // Binary search bulge in [0.005, 2.5] so highest y on circular arc from (x1,y1) to (x2,y2) equals targetMaxY
      const dx = x2 - x1;
      const dy = y2 - y1;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      // Unit normal pointing upward (since x2 > x1, (-dy, dx)/chord points up-left/up-right)
      const nx = -dy / chord;
      const ny = dx / chord;

      let low = 0.005;
      let high = 2.5;
      for (let iter = 0; iter < 36; iter++) {
        const b = (low + high) / 2;
        const theta = 4 * Math.atan(b);
        const radius = chord / (2 * Math.sin(theta / 2));
        const sagitta = (chord * b) / 2;
        const distToCenter = radius - sagitta;
        // For clockwise roof traversal from left shoulder to right shoulder, center is below midpoint:
        const cx = mx - nx * distToCenter;
        const cy = my - ny * distToCenter;
        // Highest point of circle is (cx, cy + radius) if angle pi/2 is within the arc span, else arc midpoint
        const midArcY = my + ny * sagitta;
        const a1 = Math.atan2(y1 - cy, x1 - cx);
        const a2 = Math.atan2(y2 - cy, x2 - cx);
        const minA = Math.min(a1, a2);
        const maxA = Math.max(a1, a2);
        const includesTop = minA <= Math.PI / 2 && maxA >= Math.PI / 2;
        const peakY = includesTop ? cy + radius : Math.max(y1, y2, midArcY);
        if (peakY < targetMaxY) low = b;
        else high = b;
      }
      return Number(((low + high) / 2).toFixed(4));
    },
    []
  );

  // Helper: Solve non-overshooting two-half-arch bulges (pLeft -> pApex -> pRight) that either:
  // 1) Match an exact target total crown arc length C (when targetArcLen > chordL + chordR), or
  // 2) Meet at pApex with a smooth horizontal tangent and never exceed pApex.y vertically or [pLeft.x, pRight.x] horizontally.
  const solveTwoArcCrownBulges = useCallback(
    (
      pLeft: { x: number; y: number },
      pApex: { x: number; y: number },
      pRight: { x: number; y: number },
      targetArcLen: number | null
    ): { bulgeL: number; bulgeR: number } => {
      const dxL = Math.max(0.05, pApex.x - pLeft.x);
      const dyL = Math.max(0, pApex.y - pLeft.y);
      const chordL = Math.hypot(dxL, dyL);
      const alphaL = Math.atan2(dyL, dxL);
      // Max bulge on left half-arch that neither overshoots pApex.y nor bulges left of pLeft.x
      const maxNoOvershootL = Math.max(
        0.02,
        Math.min(Math.tan(alphaL / 2), Math.tan(Math.max(0.04, (Math.PI / 2 - alphaL) / 2)))
      );

      const dxR = Math.max(0.05, pRight.x - pApex.x);
      const dyR = Math.max(0, pApex.y - pRight.y);
      const chordR = Math.hypot(dxR, dyR);
      const alphaR = Math.atan2(dyR, dxR);
      // Max bulge on right half-arch that neither overshoots pApex.y nor bulges right of pRight.x
      const maxNoOvershootR = Math.max(
        0.02,
        Math.min(Math.tan(alphaR / 2), Math.tan(Math.max(0.04, (Math.PI / 2 - alphaR) / 2)))
      );

      const arcLenFor = (chord: number, b: number) => {
        if (chord < 1e-4 || b < 1e-4) return chord;
        return chord * ((1 + b * b) / b) * Math.atan(b);
      };

      if (!targetArcLen || targetArcLen <= (chordL + chordR) * 1.0005) {
        return {
          bulgeL: Number(maxNoOvershootL.toFixed(4)),
          bulgeR: Number(maxNoOvershootR.toFixed(4)),
        };
      };

      // Binary search scale factor s so arcLenFor(chordL, bL) + arcLenFor(chordR, bR) === targetArcLen
      let low = 0.002;
      let high = 3.5;
      for (let iter = 0; iter < 36; iter++) {
        const mid = 0.5 * (low + high);
        const bL = Math.min(2.2, maxNoOvershootL * mid);
        const bR = Math.min(2.2, maxNoOvershootR * mid);
        const totalArc = arcLenFor(chordL, bL) + arcLenFor(chordR, bR);
        if (totalArc < targetArcLen) low = mid;
        else high = mid;
      }
      const bestScale = 0.5 * (low + high);
      return {
        bulgeL: Number(Math.min(2.2, Math.max(0.005, maxNoOvershootL * bestScale)).toFixed(4)),
        bulgeR: Number(Math.min(2.2, Math.max(0.005, maxNoOvershootR * bestScale)).toFixed(4)),
      };
    },
    []
  );

  // Construct authoritatively solved CAD Profile Definition
  const solvedProfileDefinition: CustomTunnelProfileDefinition = useMemo(() => {
    const locked = userLockedParamsRef.current;

    // 1. PRIORITY 1: Exact Step-by-Step CAD Segments drawn & confirmed by the user (`cadSegments`)
    if (cadSegments.length > 0 && !locked.has('archetypePreset')) {
      const pts: ProfileControlPoint[] = [];
      const segments: ProfileSegment[] = [];

      const findOrAddPt = (pt: { x: number; y: number }, roleHint?: ProfileControlPoint['role']): string => {
        const existing = pts.find((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.04);
        if (existing) return existing.id;
        const idx = pts.length + 1;
        const id = `p_cad_${idx}`;
        const override = customVertexOverrides[id];
        pts.push({
          id,
          label: `P${idx}`,
          x: Number((override ? override.x : pt.x).toFixed(3)),
          y: Number((override ? override.y : pt.y).toFixed(3)),
          role: roleHint || 'corner',
        });
        return id;
      };

      for (let i = 0; i < cadSegments.length; i++) {
        const cSeg = cadSegments[i];
        const fromId = findOrAddPt(cSeg.from);
        const toId = findOrAddPt(cSeg.to, cSeg.portion === 'crown' ? 'crown_apex' : 'corner');
        const effectiveZoneRole: BoundaryZoneRole = cSeg.isPortionOpen
          ? 'open'
          : (cSeg.portion as BoundaryZoneRole);

        segments.push({
          id: cSeg.id,
          fromPointId: fromId,
          toPointId: toId,
          type: cSeg.type,
          zoneRole: effectiveZoneRole,
          arcBulge: cSeg.type === 'arc' ? cSeg.arcBulge : undefined,
          lockedLengthMeters: cSeg.lengthM,
          includeInTopStrip: !cSeg.isPortionOpen && cSeg.portion !== 'open',
        });
      }

      // Ensure at least 2 control points exist
      if (pts.length >= 2) {
        const firstPt = pts[0];
        const lastSeg = cadSegments[cadSegments.length - 1];
        const closesLoop =
          pts.length >= 3 && Math.hypot(lastSeg.to.x - firstPt.x, lastSeg.to.y - firstPt.y) < 0.25;

        const hasActiveLeftWall =
          !openPortions.leftWall &&
          cadSegments.some((s) => s.portion === 'leftWall' && !s.isPortionOpen);
        const hasActiveCrown =
          !openPortions.crown &&
          cadSegments.some((s) => s.portion === 'crown' && !s.isPortionOpen);
        const hasActiveRightWall =
          !openPortions.rightWall &&
          cadSegments.some((s) => s.portion === 'rightWall' && !s.isPortionOpen);
        const hasActiveInvert =
          !openPortions.invert &&
          cadSegments.some((s) => s.portion === 'invert' && !s.isPortionOpen);

        const allY = pts.map((p) => p.y);
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);
        const leftWallLen = cadSegments
          .filter((s) => s.portion === 'leftWall' && !s.isPortionOpen)
          .reduce((acc, s) => acc + s.lengthM, 0);
        const rightWallLen = cadSegments
          .filter((s) => s.portion === 'rightWall' && !s.isPortionOpen)
          .reduce((acc, s) => acc + s.lengthM, 0);
        const crownLen = cadSegments
          .filter((s) => s.portion === 'crown' && !s.isPortionOpen)
          .reduce((acc, s) => acc + s.lengthM, 0);

        const allPortionsSolid =
          closesLoop &&
          hasActiveLeftWall &&
          hasActiveCrown &&
          hasActiveRightWall &&
          hasActiveInvert &&
          !cadSegments.some((s) => s.isPortionOpen || s.portion === 'open');

        return {
          id: `profile-cad-segments-${Date.now()}`,
          name: `${tunnelName} (Accurate CAD Profile)`,
          category: 'asymmetric_section',
          isClosed: allPortionsSolid,
          controlPoints: pts,
          segments,
          surfaceConfig: {
            hasCrown: hasActiveCrown,
            hasLeftWall: hasActiveLeftWall,
            hasRightWall: hasActiveRightWall,
            hasInvert: hasActiveInvert,
            fullSectionTotalHeightMeters: Number(Math.max(0.5, maxY - minY).toFixed(2)),
            fullSectionWallHeightMeters: hasActiveLeftWall ? Number(leftWallLen.toFixed(2)) : 0,
            fullSectionRightWallHeightMeters: hasActiveRightWall ? Number(rightWallLen.toFixed(2)) : 0,
            overrideLeftWallLength: hasActiveLeftWall ? Number(leftWallLen.toFixed(2)) : 0,
            overrideRightWallLength: hasActiveRightWall ? Number(rightWallLen.toFixed(2)) : 0,
            overrideCrownLength: hasActiveCrown ? Number(crownLen.toFixed(2)) : 0,
          },
          version: '1.0',
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const geom = analyzeStrokesGeometrically(!isSymmetric);

    // 2. Direct vectorized strokes fallback (when AI/Click Analysis is used on multi-stroke sketches)
    const hasManualWallOverride =
      locked.has('archetypePreset') ||
      locked.has('openWall') ||
      locked.has('leftWallHeightM') ||
      locked.has('rightWallHeightM') ||
      locked.has('leftWallAngleDeg') ||
      locked.has('rightWallAngleDeg');

    if (geom && geom.controlPoints.length >= 3 && !hasManualWallOverride) {
      const origSpan = Math.max(0.2, geom.maxX - geom.minX);
      const origH = Math.max(0.2, geom.maxY - geom.minY);
      const origCenterX = (geom.minX + geom.maxX) / 2;

      const scaleX = locked.has('widthM') ? widthM / origSpan : 1.0;
      const scaleY = locked.has('heightM') ? heightM / origH : 1.0;
      const shiftToOriginY = locked.has('heightM') ? 0 : geom.minY;

      const pts: ProfileControlPoint[] = geom.controlPoints.map((cp) => {
        const override = customVertexOverrides[cp.id];
        if (override) {
          return { ...cp, x: override.x, y: override.y };
        }
        const scaledX = locked.has('widthM')
          ? (cp.x - origCenterX) * scaleX
          : isSymmetric
          ? cp.x - origCenterX
          : cp.x;
        const scaledY = (cp.y - geom.minY) * scaleY + shiftToOriginY;
        return {
          ...cp,
          x: Number(scaledX.toFixed(3)),
          y: Number(scaledY.toFixed(3)),
        };
      });

      if (isSymmetric && pts.length >= 3) {
        const n = pts.length;
        for (let i = 0; i < Math.floor(n / 2); i++) {
          const j = n - 1 - i;
          const avgHalfX = (Math.abs(pts[i].x) + Math.abs(pts[j].x)) / 2;
          const avgY = (pts[i].y + pts[j].y) / 2;
          pts[i] = { ...pts[i], x: Number((-avgHalfX).toFixed(3)), y: Number(avgY.toFixed(3)) };
          pts[j] = { ...pts[j], x: Number(avgHalfX.toFixed(3)), y: Number(avgY.toFixed(3)) };
        }
        if (n % 2 === 1) {
          const midIdx = Math.floor(n / 2);
          pts[midIdx] = { ...pts[midIdx], x: 0 };
        }
      }

      const ptMap = new Map(pts.map((p) => [p.id, p]));
      const segments: ProfileSegment[] = geom.segments.map((seg) => {
        const pFrom = ptMap.get(seg.fromPointId);
        const pTo = ptMap.get(seg.toPointId);
        if (
          seg.zoneRole === 'crown' &&
          crownArcLengthM &&
          crownArcLengthM > 0 &&
          pFrom &&
          pTo
        ) {
          const chord = Math.hypot(pTo.x - pFrom.x, pTo.y - pFrom.y);
          if (crownArcLengthM > chord * 1.001) {
            return {
              ...seg,
              type: 'arc',
              arcBulge: computeBulgeFromArcLength(chord, crownArcLengthM, 1),
            };
          }
        }
        if (seg.zoneRole === 'invert' && invertType === 'curved_dish' && pFrom && pTo) {
          const chord = Math.max(0.5, Math.hypot(pTo.x - pFrom.x, pTo.y - pFrom.y));
          return {
            ...seg,
            type: 'arc',
            arcBulge: Number(((2 * invertSagittaM) / chord).toFixed(4)),
          };
        }
        return { ...seg };
      });

      const finalMaxY = Math.max(...pts.map((p) => p.y));
      const finalMinY = Math.min(...pts.map((p) => p.y));
      const hasLeftWallSeg = !openPortions.leftWall && segments.some((s) => s.zoneRole === 'leftWall');
      const hasRightWallSeg = !openPortions.rightWall && segments.some((s) => s.zoneRole === 'rightWall');
      const hasCrownSeg = !openPortions.crown && segments.some((s) => s.zoneRole === 'crown');

      return {
        id: `profile-vectorized-${Date.now()}`,
        name: `${tunnelName} (${geom.shapeKind.replace(/_/g, ' ').toUpperCase()})`,
        category: isSymmetric ? 'freeform' : 'asymmetric_section',
        isClosed: !openPortions.leftWall && !openPortions.rightWall && !openPortions.crown && !openPortions.invert,
        controlPoints: pts,
        segments,
        surfaceConfig: {
          hasCrown: hasCrownSeg,
          hasLeftWall: hasLeftWallSeg,
          hasRightWall: hasRightWallSeg,
          hasInvert: !openPortions.invert,
          fullSectionTotalHeightMeters: Number((finalMaxY - finalMinY).toFixed(2)),
          fullSectionWallHeightMeters: hasLeftWallSeg ? geom.leftWallH : 0,
          fullSectionRightWallHeightMeters: hasRightWallSeg ? geom.rightWallH : 0,
        },
        version: '1.0',
        updatedAt: new Date().toISOString(),
      };
    }

    const effLeftSpan = isSymmetric ? widthM / 2 : leftSpanM;
    const effRightSpan = isSymmetric ? widthM / 2 : rightSpanM;
    const totalSpan = Math.max(0.5, effLeftSpan + effRightSpan);
    // When invert is a curved dish, place the lower wall corners at y = invertSagittaM so the dish bottom touches RL 0.00m
    // and total tunnel height (maxY - minY) equals heightM to 0.00m!
    const invertY =
      invertType === 'curved_dish' ? Math.min(heightM * 0.25, Math.max(0, invertSagittaM)) : 0;
    const leftRad = ((90 - leftWallAngleDeg) * Math.PI) / 180;
    const rightRad = ((90 - rightWallAngleDeg) * Math.PI) / 180;

    let pts: ProfileControlPoint[] = [];
    let segments: ProfileSegment[] = [];

    if (openWall === 'left') {
      // OPEN LEFT WALL (Slashing / Drift Heading: Left wall is open void, rock right wall + sweeping curved roof)
      const pInvLeft: ProfileControlPoint = {
        id: 'p_inv_left',
        label: 'P1-InvertL',
        x: Number((-effLeftSpan).toFixed(3)),
        y: invertY,
        role: 'left_invert',
      };
      const rightWallTopX = Math.min(
        effRightSpan,
        Math.max(-effLeftSpan + 0.4, effRightSpan - Math.tan(rightRad) * rightWallHeightM)
      );
      const pWallRight: ProfileControlPoint = {
        id: 'p_wall_right',
        label: 'P4-ShoulderR',
        x: Number(rightWallTopX.toFixed(3)),
        y: rightWallHeightM,
        role: 'right_wall_top',
      };
      const pInvRight: ProfileControlPoint = {
        id: 'p_inv_right',
        label: 'P5-InvertR',
        x: Number(effRightSpan.toFixed(3)),
        y: invertY,
        role: 'right_invert',
      };

      if (crownType !== 'flat' && crownArcLengthM && crownArcLengthM > 0) {
        // Use 5-point open-left profile with dedicated P3-CrownApex at y = heightM so Width, Height, Right Wall, AND Curve Arc C all match 100% simultaneously!
        const openLeftTopY = Number(
          Math.max(rightWallHeightM, Math.min(heightM - 0.15, heightM * 0.78)).toFixed(3)
        );
        const topLeftX = Math.max(
          -effLeftSpan,
          Math.min(effRightSpan - 0.5, -effLeftSpan + Math.tan(leftRad) * openLeftTopY)
        );
        const pTopLeft: ProfileControlPoint = {
          id: 'p_open_top_left',
          label: 'P2-OpenTopL',
          x: Number(topLeftX.toFixed(3)),
          y: openLeftTopY,
          role: 'left_wall_top',
        };
        const defaultApexX = Number(((topLeftX + rightWallTopX) * 0.35).toFixed(3));
        const pCrownApex: ProfileControlPoint = {
          id: 'p_crown_apex',
          label: 'P3-Apex',
          x: Math.abs(crownApexOffsetXM) > 0.05 ? Number(crownApexOffsetXM.toFixed(3)) : defaultApexX,
          y: heightM,
          role: 'crown_apex',
        };

        const { bulgeL, bulgeR } = solveTwoArcCrownBulges(
          pTopLeft,
          pCrownApex,
          pWallRight,
          crownArcLengthM
        );

        pts = [pInvLeft, pTopLeft, pCrownApex, pWallRight, pInvRight];
        segments = [
          {
            id: 'seg_open_left',
            fromPointId: 'p_inv_left',
            toPointId: 'p_open_top_left',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: false,
          },
          {
            id: 'seg_crown_left',
            fromPointId: 'p_open_top_left',
            toPointId: 'p_crown_apex',
            type: 'arc',
            zoneRole: 'crown',
            arcBulge: bulgeL,
          },
          {
            id: 'seg_crown_right',
            fromPointId: 'p_crown_apex',
            toPointId: 'p_wall_right',
            type: 'arc',
            zoneRole: 'crown',
            arcBulge: bulgeR,
          },
          {
            id: 'seg_right_wall',
            fromPointId: 'p_wall_right',
            toPointId: 'p_inv_right',
            type: 'line',
            zoneRole: 'rightWall',
          },
          {
            id: 'seg_invert_floor',
            fromPointId: 'p_inv_right',
            toPointId: 'p_inv_left',
            type: invertType === 'curved_dish' ? 'arc' : 'line',
            zoneRole: 'invert',
            arcBulge:
              invertType === 'curved_dish'
                ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
                : undefined,
          },
        ];
      } else {
        const topLeftApexX = Math.max(
          -effLeftSpan,
          Math.min(effRightSpan - 0.4, -effLeftSpan + Math.tan(leftRad) * heightM)
        );
        const pTopLeft: ProfileControlPoint = {
          id: 'p_open_top_left',
          label: 'P2-ApexL(Open)',
          x: Number(topLeftApexX.toFixed(3)),
          y: heightM,
          role: 'crown_apex',
        };
        pts = [pInvLeft, pTopLeft, pWallRight, pInvRight];

        const dx = Math.max(0.1, pWallRight.x - pTopLeft.x);
        const dy = Math.max(0, pTopLeft.y - pWallRight.y);
        const alpha = Math.atan2(dy, dx);
        const naturalBulge = Number(
          Math.max(
            0.03,
            Math.min(Math.tan(alpha / 2), Math.tan(Math.max(0.05, (Math.PI / 2 - alpha) / 2)))
          ).toFixed(4)
        );

        segments = [
          {
            id: 'seg_open_left',
            fromPointId: 'p_inv_left',
            toPointId: 'p_open_top_left',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: false,
          },
          {
            id: 'seg_crown_arch',
            fromPointId: 'p_open_top_left',
            toPointId: 'p_wall_right',
            type: crownType === 'flat' ? 'line' : 'arc',
            zoneRole: 'crown',
            arcBulge: crownType === 'flat' ? undefined : naturalBulge,
          },
          {
            id: 'seg_right_wall',
            fromPointId: 'p_wall_right',
            toPointId: 'p_inv_right',
            type: 'line',
            zoneRole: 'rightWall',
          },
          {
            id: 'seg_invert_floor',
            fromPointId: 'p_inv_right',
            toPointId: 'p_inv_left',
            type: invertType === 'curved_dish' ? 'arc' : 'line',
            zoneRole: 'invert',
            arcBulge:
              invertType === 'curved_dish'
                ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
                : undefined,
          },
        ];
      }

      return {
        id: `profile-sketch-slashing-left-${Date.now()}`,
        name: `${tunnelName} Slashing Heading (Left Open)`,
        category: 'asymmetric_section',
        isClosed: true,
        controlPoints: pts,
        segments,
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: false,
          hasRightWall: true,
          fullSectionTotalHeightMeters: heightM,
          fullSectionWallHeightMeters: 0,
          fullSectionRightWallHeightMeters: rightWallHeightM,
          portionLabel: 'Slashing Heading (Left Open Void)',
        },
        version: '1.0',
        updatedAt: new Date().toISOString(),
      };
    }

    if (openWall === 'right') {
      // OPEN RIGHT WALL (Slashing / Drift Heading: Right wall is open void)
      const pInvLeft: ProfileControlPoint = {
        id: 'p_inv_left',
        label: 'P1-InvertL',
        x: Number((-effLeftSpan).toFixed(3)),
        y: invertY,
        role: 'left_invert',
      };
      const leftWallTopX = Math.max(
        -effLeftSpan,
        Math.min(effRightSpan - 0.4, -effLeftSpan + Math.tan(leftRad) * leftWallHeightM)
      );
      const pWallLeft: ProfileControlPoint = {
        id: 'p_wall_left',
        label: 'P2-ShoulderL',
        x: Number(leftWallTopX.toFixed(3)),
        y: leftWallHeightM,
        role: 'left_wall_top',
      };
      const pInvRight: ProfileControlPoint = {
        id: 'p_inv_right',
        label: 'P5-InvertR',
        x: Number(effRightSpan.toFixed(3)),
        y: invertY,
        role: 'right_invert',
      };

      if (crownType !== 'flat' && crownArcLengthM && crownArcLengthM > 0) {
        const openRightTopY = Number(
          Math.max(leftWallHeightM, Math.min(heightM - 0.15, heightM * 0.78)).toFixed(3)
        );
        const topRightX = Math.min(
          effRightSpan,
          Math.max(-effLeftSpan + 0.5, effRightSpan - Math.tan(rightRad) * openRightTopY)
        );
        const defaultApexX = Number(((leftWallTopX + topRightX) * 0.35).toFixed(3));
        const pCrownApex: ProfileControlPoint = {
          id: 'p_crown_apex',
          label: 'P3-Apex',
          x: Math.abs(crownApexOffsetXM) > 0.05 ? Number(crownApexOffsetXM.toFixed(3)) : defaultApexX,
          y: heightM,
          role: 'crown_apex',
        };
        const pTopRight: ProfileControlPoint = {
          id: 'p_open_top_right',
          label: 'P4-OpenTopR',
          x: Number(topRightX.toFixed(3)),
          y: openRightTopY,
          role: 'right_wall_top',
        };

        const { bulgeL, bulgeR } = solveTwoArcCrownBulges(
          pWallLeft,
          pCrownApex,
          pTopRight,
          crownArcLengthM
        );

        pts = [pInvLeft, pWallLeft, pCrownApex, pTopRight, pInvRight];
        segments = [
          {
            id: 'seg_left_wall',
            fromPointId: 'p_inv_left',
            toPointId: 'p_wall_left',
            type: 'line',
            zoneRole: 'leftWall',
          },
          {
            id: 'seg_crown_left',
            fromPointId: 'p_wall_left',
            toPointId: 'p_crown_apex',
            type: 'arc',
            zoneRole: 'crown',
            arcBulge: bulgeL,
          },
          {
            id: 'seg_crown_right',
            fromPointId: 'p_crown_apex',
            toPointId: 'p_open_top_right',
            type: 'arc',
            zoneRole: 'crown',
            arcBulge: bulgeR,
          },
          {
            id: 'seg_open_right',
            fromPointId: 'p_open_top_right',
            toPointId: 'p_inv_right',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: false,
          },
          {
            id: 'seg_invert_floor',
            fromPointId: 'p_inv_right',
            toPointId: 'p_inv_left',
            type: invertType === 'curved_dish' ? 'arc' : 'line',
            zoneRole: 'invert',
            arcBulge:
              invertType === 'curved_dish'
                ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
                : undefined,
          },
        ];
      } else {
        const topRightApexX = Math.min(
          effRightSpan,
          Math.max(-effLeftSpan + 0.4, effRightSpan - Math.tan(rightRad) * heightM)
        );
        const pTopRight: ProfileControlPoint = {
          id: 'p_open_top_right',
          label: 'P3-ApexR(Open)',
          x: Number(topRightApexX.toFixed(3)),
          y: heightM,
          role: 'crown_apex',
        };
        pts = [pInvLeft, pWallLeft, pTopRight, pInvRight];

        const dx = Math.max(0.1, pTopRight.x - pWallLeft.x);
        const dy = Math.max(0, pTopRight.y - pWallLeft.y);
        const alpha = Math.atan2(dy, dx);
        const naturalBulge = Number(
          Math.max(
            0.03,
            Math.min(Math.tan(alpha / 2), Math.tan(Math.max(0.05, (Math.PI / 2 - alpha) / 2)))
          ).toFixed(4)
        );

        segments = [
          {
            id: 'seg_left_wall',
            fromPointId: 'p_inv_left',
            toPointId: 'p_wall_left',
            type: 'line',
            zoneRole: 'leftWall',
          },
          {
            id: 'seg_crown_arch',
            fromPointId: 'p_wall_left',
            toPointId: 'p_open_top_right',
            type: crownType === 'flat' ? 'line' : 'arc',
            zoneRole: 'crown',
            arcBulge: crownType === 'flat' ? undefined : naturalBulge,
          },
          {
            id: 'seg_open_right',
            fromPointId: 'p_open_top_right',
            toPointId: 'p_inv_right',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: false,
          },
          {
            id: 'seg_invert_floor',
            fromPointId: 'p_inv_right',
            toPointId: 'p_inv_left',
            type: invertType === 'curved_dish' ? 'arc' : 'line',
            zoneRole: 'invert',
            arcBulge:
              invertType === 'curved_dish'
                ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
                : undefined,
          },
        ];
      }

      return {
        id: `profile-sketch-slashing-right-${Date.now()}`,
        name: `${tunnelName} Slashing Heading (Right Open)`,
        category: 'asymmetric_section',
        isClosed: true,
        controlPoints: pts,
        segments,
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: false,
          fullSectionTotalHeightMeters: heightM,
          fullSectionWallHeightMeters: leftWallHeightM,
          fullSectionRightWallHeightMeters: 0,
          portionLabel: 'Slashing Heading (Right Open Void)',
        },
        version: '1.0',
        updatedAt: new Date().toISOString(),
      };
    }

    // STANDARD CLOSED PROFILE
    const leftWallTopX = Math.max(
      -effLeftSpan,
      Math.min(effRightSpan - 0.2, -effLeftSpan + Math.tan(leftRad) * leftWallHeightM)
    );
    const rightWallTopX = Math.min(
      effRightSpan,
      Math.max(-effLeftSpan + 0.2, effRightSpan - Math.tan(rightRad) * rightWallHeightM)
    );
    const chordLtoR = Math.max(
      0.2,
      Math.hypot(rightWallTopX - leftWallTopX, rightWallHeightM - leftWallHeightM)
    );
    const isFlatCrown =
      crownType === 'flat' || heightM <= Math.max(leftWallHeightM, rightWallHeightM) + 0.02;

    // Determine whether a single circular arc between shoulders can hit both heightM and crownArcLengthM without bulging past shoulders
    const archRise = Math.max(0, heightM - (leftWallHeightM + rightWallHeightM) / 2);
    const singleArcBulge =
      crownArcLengthM && crownArcLengthM > chordLtoR * 1.001
        ? computeBulgeFromArcLength(chordLtoR, crownArcLengthM, 1)
        : solveArcBulgeForTargetApexY(
            leftWallTopX,
            leftWallHeightM,
            rightWallTopX,
            rightWallHeightM,
            heightM
          );

    // Use 5-point profile (with explicit P3-CrownApex at y = heightM) whenever:
    // - Non-symmetric mode is active, OR
    // - Crown Arc Length C is locked (so BOTH Height = heightM and Arc C = crownArcLengthM are satisfied simultaneously!), OR
    // - The arch rise exceeds half the shoulder span (so a single arc would balloon horizontally past widthM).
    const useFivePointApex =
      !isFlatCrown &&
      (!isSymmetric ||
        Boolean(crownArcLengthM && crownArcLengthM > chordLtoR * 1.001) ||
        archRise > chordLtoR * 0.5 ||
        Math.abs(singleArcBulge) > 1.0);

    if (useFivePointApex) {
      const pInvLeft: ProfileControlPoint = {
        id: 'p_inv_left',
        label: 'P1-InvertL',
        x: Number((-effLeftSpan).toFixed(3)),
        y: invertY,
        role: 'left_invert',
      };
      const pWallLeft: ProfileControlPoint = {
        id: 'p_wall_left',
        label: 'P2-ShoulderL',
        x: Number(leftWallTopX.toFixed(3)),
        y: leftWallHeightM,
        role: 'left_wall_top',
      };
      const apexX = isSymmetric
        ? Number(((leftWallTopX + rightWallTopX) / 2).toFixed(3))
        : Number(crownApexOffsetXM.toFixed(3));
      const pCrownApex: ProfileControlPoint = {
        id: 'p_crown_apex',
        label: 'P3-Apex',
        x: apexX,
        y: heightM,
        role: 'crown_apex',
      };
      const pWallRight: ProfileControlPoint = {
        id: 'p_wall_right',
        label: 'P4-ShoulderR',
        x: Number(rightWallTopX.toFixed(3)),
        y: rightWallHeightM,
        role: 'right_wall_top',
      };
      const pInvRight: ProfileControlPoint = {
        id: 'p_inv_right',
        label: 'P5-InvertR',
        x: Number(effRightSpan.toFixed(3)),
        y: invertY,
        role: 'right_invert',
      };

      pts = [pInvLeft, pWallLeft, pCrownApex, pWallRight, pInvRight];

      const { bulgeL, bulgeR } = solveTwoArcCrownBulges(
        pWallLeft,
        pCrownApex,
        pWallRight,
        crownArcLengthM
      );

      segments = [
        {
          id: 'seg_left_wall',
          fromPointId: 'p_inv_left',
          toPointId: 'p_wall_left',
          type: 'line',
          zoneRole: 'leftWall',
        },
        {
          id: 'seg_crown_left',
          fromPointId: 'p_wall_left',
          toPointId: 'p_crown_apex',
          type: 'arc',
          zoneRole: 'crown',
          arcBulge: bulgeL,
        },
        {
          id: 'seg_crown_right',
          fromPointId: 'p_crown_apex',
          toPointId: 'p_wall_right',
          type: 'arc',
          zoneRole: 'crown',
          arcBulge: bulgeR,
        },
        {
          id: 'seg_right_wall',
          fromPointId: 'p_wall_right',
          toPointId: 'p_inv_right',
          type: 'line',
          zoneRole: 'rightWall',
        },
        {
          id: 'seg_invert_floor',
          fromPointId: 'p_inv_right',
          toPointId: 'p_inv_left',
          type: invertType === 'curved_dish' ? 'arc' : 'line',
          zoneRole: 'invert',
          arcBulge:
            invertType === 'curved_dish'
              ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
              : undefined,
        },
      ];

      return {
        id: `profile-sketch-${Date.now()}`,
        name: `${tunnelName} ${isSymmetric ? 'Sketch' : 'Asymmetric'} Profile`,
        category: isSymmetric ? 'freeform' : 'asymmetric_section',
        isClosed: true,
        controlPoints: pts,
        segments,
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
          fullSectionTotalHeightMeters: heightM,
          fullSectionWallHeightMeters: leftWallHeightM,
          fullSectionRightWallHeightMeters: rightWallHeightM,
        },
        version: '1.0',
        updatedAt: new Date().toISOString(),
      };
    }

    // 4-Point Closed Profile (Symmetric arched or flat roof)
    const crownBulge = isFlatCrown ? 0 : singleArcBulge;

    pts = [
      {
        id: 'p_inv_left',
        label: 'P1-InvertL',
        x: Number((-effLeftSpan).toFixed(3)),
        y: invertY,
        role: 'left_invert',
      },
      {
        id: 'p_wall_left',
        label: 'P2-ShoulderL',
        x: Number(leftWallTopX.toFixed(3)),
        y: isFlatCrown && isSymmetric ? heightM : leftWallHeightM,
        role: 'left_wall_top',
      },
      {
        id: 'p_wall_right',
        label: 'P3-ShoulderR',
        x: Number(rightWallTopX.toFixed(3)),
        y: isFlatCrown && isSymmetric ? heightM : rightWallHeightM,
        role: 'right_wall_top',
      },
      {
        id: 'p_inv_right',
        label: 'P4-InvertR',
        x: Number(effRightSpan.toFixed(3)),
        y: invertY,
        role: 'right_invert',
      },
    ];

    segments = [
      {
        id: 'seg_left_wall',
        fromPointId: 'p_inv_left',
        toPointId: 'p_wall_left',
        type: 'line',
        zoneRole: 'leftWall',
      },
      {
        id: 'seg_crown_arch',
        fromPointId: 'p_wall_left',
        toPointId: 'p_wall_right',
        type: isFlatCrown ? 'line' : 'arc',
        zoneRole: 'crown',
        arcBulge: isFlatCrown ? undefined : crownBulge,
      },
      {
        id: 'seg_right_wall',
        fromPointId: 'p_wall_right',
        toPointId: 'p_inv_right',
        type: 'line',
        zoneRole: 'rightWall',
      },
      {
        id: 'seg_invert_floor',
        fromPointId: 'p_inv_right',
        toPointId: 'p_inv_left',
        type: invertType === 'curved_dish' ? 'arc' : 'line',
        zoneRole: 'invert',
        arcBulge:
          invertType === 'curved_dish'
            ? Number(((2 * invertSagittaM) / totalSpan).toFixed(4))
            : undefined,
      },
    ];

    return {
      id: `profile-sketch-${Date.now()}`,
      name: `${tunnelName} ${isSymmetric ? 'Sketch' : 'Asymmetric'} Profile`,
      category: isSymmetric ? 'freeform' : 'asymmetric_section',
      isClosed: !openPortions.leftWall && !openPortions.rightWall && !openPortions.crown && !openPortions.invert,
      controlPoints: pts,
      segments,
      surfaceConfig: {
        hasCrown: !openPortions.crown,
        hasLeftWall: !openPortions.leftWall,
        hasRightWall: !openPortions.rightWall,
        hasInvert: !openPortions.invert,
        fullSectionTotalHeightMeters: heightM,
        fullSectionWallHeightMeters: !openPortions.leftWall
          ? isFlatCrown && isSymmetric
            ? heightM
            : leftWallHeightM
          : 0,
        fullSectionRightWallHeightMeters: !openPortions.rightWall
          ? isFlatCrown && isSymmetric
            ? heightM
            : rightWallHeightM
          : 0,
      },
      version: '1.0',
      updatedAt: new Date().toISOString(),
    };
  }, [
    cadSegments,
    openPortions,
    openWall,
    widthM,
    leftSpanM,
    rightSpanM,
    crownApexOffsetXM,
    isSymmetric,
    heightM,
    leftWallHeightM,
    rightWallHeightM,
    leftWallAngleDeg,
    rightWallAngleDeg,
    crownSagittaM,
    crownArcLengthM,
    crownType,
    invertType,
    invertSagittaM,
    tunnelName,
    solveArcBulgeForTargetApexY,
    solveTwoArcCrownBulges,
    analyzeStrokesGeometrically,
    customVertexOverrides,
  ]);

  const evaluated = useMemo(() => {
    return evaluateCustomProfileGeometry(solvedProfileDefinition);
  }, [solvedProfileDefinition]);

  const authoritativeGeometry: TunnelGeometry = useMemo(() => {
    return buildAuthoritativeCustomTunnelGeometry(solvedProfileDefinition, {
      cadFileName: `${tunnelName}.dxf`,
    });
  }, [solvedProfileDefinition, tunnelName]);

  // SVG path for solved accurate geometry (respecting open segments / open portions)
  const solvedSvgPath = useMemo(() => {
    if (!evaluated || evaluated.segmentMetrics.length === 0) return '';
    const subpaths: string[] = [];
    for (const seg of evaluated.segmentMetrics) {
      if (seg.zoneRole === 'open') continue;
      if (seg.zoneRole === 'leftWall' && !evaluated.hasLeftWall) continue;
      if (seg.zoneRole === 'crown' && !evaluated.hasCrown) continue;
      if (seg.zoneRole === 'rightWall' && !evaluated.hasRightWall) continue;
      if (seg.zoneRole === 'invert' && !evaluated.hasInvert) continue;
      if (seg.sampledPoints.length < 2) continue;
      const d = seg.sampledPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
        .join(' ');
      subpaths.push(d);
    }
    return subpaths.join(' ');
  }, [evaluated, toSvgX, toSvgY]);

  // Closed interior fill path for shaded preview
  const solvedFillPath = useMemo(() => {
    if (!evaluated || evaluated.crossSectionPoints.length < 2) return '';
    const pts = evaluated.crossSectionPoints;
    if (pts.length < 3) return '';
    let d = `M ${toSvgX(pts[0].x)} ${toSvgY(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${toSvgX(pts[i].x)} ${toSvgY(pts[i].y)}`;
    }
    d += ' Z';
    return d;
  }, [evaluated, toSvgX, toSvgY]);

  // Live preview of the segment currently being configured in the Accurate Segment Parameter Modal
  const liveDraftSegmentPreview = useMemo(() => {
    if (!pendingSegmentDraft) return null;
    const seg = computeSegmentFromDraft(pendingSegmentDraft);
    const pts =
      seg.type === 'arc' && Math.abs(seg.arcBulge) > 1e-4
        ? evaluateArcSegment(seg.from, seg.to, seg.arcBulge, 24).points
        : [seg.from, seg.to];
    const pathD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
      .join(' ');
    return { seg, pts, pathD };
  }, [pendingSegmentDraft, computeSegmentFromDraft, toSvgX, toSvgY]);

  const effLeftSpan = isSymmetric ? widthM / 2 : leftSpanM;
  const effRightSpan = isSymmetric ? widthM / 2 : rightSpanM;

  const detectedUserRequirements = useMemo(() => {
    const geom = analyzeStrokesGeometrically(!isSymmetric);
    const parsed = parseAnnotationsWithSpatialContext(textAnnotations, geom);
    return {
      width: parsed.ovrWidth ?? (geom ? geom.span : null),
      height: parsed.ovrHeight ?? (geom ? geom.totalH : null),
    };
  }, [textAnnotations, analyzeStrokesGeometrically, parseAnnotationsWithSpatialContext, isSymmetric]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-950 text-white select-none">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Pencil className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              Accurate CAD Line &amp; Curve Tunnel Builder
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Draw 1 Line (Length &amp; Angle) or 1 Curve (Curve Length &amp; Height from Center) → Choose Portion (Crown / Left Wall / Right Wall / Open)
            </p>
          </div>
        </div>

        {/* Actions Button Group (Target of CSS Selector 1) */}
        <div className="flex items-center gap-2">
          {/* Manual Add Segment Button */}
          <button
            type="button"
            onClick={() => {
              const prevEnd =
                cadSegments.length > 0 ? cadSegments[cadSegments.length - 1].to : { x: -4.0, y: 0 };
              setPendingSegmentDraft({
                drawnStart: prevEnd,
                drawnEnd: { x: prevEnd.x, y: prevEnd.y + 4.0 },
                connectMode: cadSegments.length > 0 ? 'chain_prev' : 'drawn_start',
                startX: prevEnd.x,
                startY: prevEnd.y,
                type: 'line',
                lengthInput: '4.0',
                angleInput: cadSegments.length === 0 ? '90' : cadSegments.length === 1 ? '0' : '-90',
                heightFromCenterInput: '1.8',
                arcDirection: 'outward',
                arcEndpointMode: 'from_curve_and_height',
                portion:
                  cadSegments.length === 0
                    ? 'leftWall'
                    : cadSegments.length === 1
                    ? 'crown'
                    : 'rightWall',
                isPortionOpen: false,
              });
            }}
            className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            title="Add exact Line (Length & Angle) or Curve (Length of Curve & Height from Center) directly"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>+ Add Exact Line / Curve</span>
          </button>

          {/* Main Action Button (Target of CSS Selector 1) */}
          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={isAnalyzingAi}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50 transition-all"
            title="Analyze rough sketch, curves, and written dimensions with AI"
          >
            {isAnalyzingAi ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI Shape Solver</span>
              </>
            )}
          </button>

          {/* Apply Accurate Shape Button */}
          {(hasAnalyzedShape || cadSegments.length > 0 || strokes.length > 0 || textAnnotations.length > 0) && (
            <button
              type="button"
              onClick={() => onApplyProfile(solvedProfileDefinition, authoritativeGeometry)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Accurate Shape to Tunnel</span>
            </button>
          )}

          {/* Cancel button */}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Left CAD / Interactive Sketch Canvas + Right Dimensions & Angles Panel */}
      <div className="flex-1 h-full min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left Column (8 cols): Interactive Canvas (Target of CSS Selector 1) */}
        <div className="lg:col-span-8 flex flex-col min-h-0 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-inner relative">
          {/* Canvas Floating Top Toolbar */}
          <div className="p-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 z-10 shrink-0">
            {/* Tool Selection: Draw Line/Curve, Pan Canvas, Dimension Pin, Eraser */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-amber-400 mr-1 flex items-center gap-1">
                Tool:
              </span>
              <button
                type="button"
                onClick={() => setCanvasTool('pencil')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  canvasTool === 'pencil'
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Draw 1 Line or Curve on canvas -> immediately prompts for exact Length & Angle or Curve Length & Height from Center"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Draw Line / Curve</span>
              </button>

              <button
                type="button"
                onClick={() => setCanvasTool('pan')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                  canvasTool === 'pan'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Pan / Move Canvas: Drag anywhere on canvas to pan around your tunnel drawing"
              >
                <Move className="w-3.5 h-3.5" />
                <span>Pan Canvas</span>
              </button>

              {/* Zoom & Center Controls */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setCanvasZoom((z) => Number(Math.max(0.4, z - 0.15).toFixed(2)))}
                  className="px-2 py-0.5 rounded text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCanvasZoom(1.0);
                    setCanvasPan({ x: 0, y: 0 });
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-cyan-300 hover:bg-slate-800 cursor-pointer"
                  title="Reset Pan & Zoom to Center (100%)"
                >
                  {Math.round(canvasZoom * 100)}% ⌖
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasZoom((z) => Number(Math.min(3.0, z + 0.15).toFixed(2)))}
                  className="px-2 py-0.5 rounded text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCanvasTool('dimension_pin')}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                  canvasTool === 'dimension_pin'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Click canvas to pin length or angle annotation"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Pin</span>
              </button>

              <button
                type="button"
                onClick={() => setCanvasTool('eraser')}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                  canvasTool === 'eraser'
                    ? 'bg-rose-500 text-white border-rose-400 shadow font-black'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Click on any segment, stroke, or annotation to erase"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>

              <button
                type="button"
                onClick={() => setPalmRejectionEnabled((v) => !v)}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                  palmRejectionEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm font-black'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
                title="Palm Rejection: Rejects accidental palm or wrist contacts on touchscreen tablets and styluses"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Palm: {palmRejectionEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Quick Actions: Clear / Redraw & Undo */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRedrawClearAll}
                className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all"
                title="Clear canvas back to completely empty state"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear All</span>
              </button>

              {(cadSegments.length > 0 || strokes.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    if (cadSegments.length > 0) {
                      const lastSeg = cadSegments[cadSegments.length - 1];
                      setCadSegments((prev) => prev.slice(0, -1));
                      if (lastSeg.strokeId) {
                        setStrokes((prev) => prev.filter((s) => s.id !== lastSeg.strokeId));
                      }
                    } else {
                      setStrokes((prev) => prev.slice(0, -1));
                    }
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-bold cursor-pointer"
                  title="Undo last segment or stroke"
                >
                  Undo Segment
                </button>
              )}
            </div>
          </div>

          {/* SVG Canvas (Target of CSS Selector 1) */}
          <div
            className={`flex-1 min-h-0 relative flex items-center justify-center overflow-hidden touch-none ${
              canvasTool === 'pan' || isPanningCanvas ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            }`}
          >
            {/* Palm Rejection Active Indicator */}
            {palmRejectionEnabled && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-emerald-500/30 text-[9.5px] font-mono text-emerald-300 pointer-events-none backdrop-blur-sm z-10">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Palm Rejection Active</span>
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox="0 0 800 480"
              className="w-full h-full select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={(e) => {
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                setCanvasZoom((z) => Number(Math.max(0.4, Math.min(3.0, z + delta)).toFixed(2)));
              }}
            >
              <defs>
                {/* Engineering Grid aligned with pan & zoom */}
                <pattern
                  id="sketchGridMeters"
                  x={((originX % scale) + scale) % scale}
                  y={((originY % scale) + scale) % scale}
                  width={scale}
                  height={scale}
                  patternUnits="userSpaceOnUse"
                >
                  <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#1e293b" strokeWidth="0.8" />
                </pattern>
                {/* 5-Meter Major Grid aligned with pan & zoom */}
                <pattern
                  id="sketchMajorGrid"
                  x={((originX % (scale * 5)) + scale * 5) % (scale * 5)}
                  y={((originY % (scale * 5)) + scale * 5) % (scale * 5)}
                  width={scale * 5}
                  height={scale * 5}
                  patternUnits="userSpaceOnUse"
                >
                  <rect width={scale * 5} height={scale * 5} fill="url(#sketchGridMeters)" />
                  <path d={`M ${scale * 5} 0 L 0 0 0 ${scale * 5}`} fill="none" stroke="#334155" strokeWidth="1.2" />
                </pattern>
                {/* Gradient Fill for Solved Tunnel */}
                <linearGradient id="tunnelInteriorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.5" />
                </linearGradient>
              </defs>

              {/* Background & Grid */}
              <rect width="800" height="480" fill="#020617" />
              <rect width="800" height="480" fill="url(#sketchMajorGrid)" />

              {/* Centerline & Invert Datum Lines (follow pan & zoom) */}
              <line x1={originX} y1="0" x2={originX} y2="480" stroke="#f59e0b" strokeWidth="1" strokeDasharray="6,4" opacity="0.45" />
              <line x1="0" y1={originY} x2="800" y2={originY} stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
              <text x={originX + 8} y="24" fill="#f59e0b" fontSize="9" fontFamily="monospace" opacity="0.7">CL ℄ (X=0.0m)</text>
              <text x="16" y={originY - 6} fill="#10b981" fontSize="9" fontFamily="monospace" opacity="0.7">INVERT DATUM (RL 0.00m)</text>

              {/* EMPTY CANVAS PLACEHOLDER WATERMARK: Shown when not yet analyzed and no segments/strokes */}
              {!hasAnalyzedShape && cadSegments.length === 0 && strokes.length === 0 && currentStroke.length === 0 && (
                <g className="pointer-events-none select-none opacity-85">
                  <rect x="145" y="135" width="510" height="175" rx="16" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                  <text x="400" y="175" textAnchor="middle" fill="#f59e0b" fontSize="14" fontWeight="bold">
                    ✏️ Draw One Line or Curve at a Time (Accurate CAD Mode)
                  </text>
                  <text x="400" y="205" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="sans-serif">
                    1. Draw a <tspan fill="#34d399" fontWeight="bold">Straight Line</tspan> → Enter exact <tspan fill="#34d399" fontWeight="bold">Length (m) &amp; Angle (°)</tspan>.
                  </text>
                  <text x="400" y="228" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="sans-serif">
                    2. Draw a <tspan fill="#fcd34d" fontWeight="bold">Curve / Arch</tspan> → Enter exact <tspan fill="#fcd34d" fontWeight="bold">Length of Curve (m) &amp; Height from Center (m)</tspan>.
                  </text>
                  <text x="400" y="251" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="sans-serif">
                    3. Choose Portion: <tspan fill="#38bdf8" fontWeight="bold">Crown, Left Wall, Right Wall, Invert, or Open</tspan>.
                  </text>
                  <text x="400" y="282" textAnchor="middle" fill="#94a3b8" fontSize="10.5" fontFamily="monospace">
                    Use &quot;Pan Canvas&quot; tool (or mouse wheel) to pan &amp; zoom anytime. Open portions do not reflect on Face Canvas!
                  </text>
                </g>
              )}

              {/* User Freehand Rough Sketch Strokes (faint reference once converted to accurate CAD segment) */}
              {strokes.map((s) => {
                const isConvertedToCad = cadSegments.some((cs) => cs.strokeId === s.id);
                return (
                  <polyline
                    key={s.id}
                    points={s.points.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
                    fill="none"
                    stroke={isConvertedToCad || hasAnalyzedShape ? '#475569' : '#fbbf24'}
                    strokeWidth={isConvertedToCad || hasAnalyzedShape ? '1.5' : '3.2'}
                    strokeDasharray={isConvertedToCad || hasAnalyzedShape ? '3,3' : undefined}
                    opacity={isConvertedToCad ? 0.25 : hasAnalyzedShape ? 0.45 : 0.95}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* Live Preview of Pending Segment Draft while modal is open */}
              {liveDraftSegmentPreview && (
                <g className="pointer-events-none">
                  <path
                    d={liveDraftSegmentPreview.pathD}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray="6,3"
                  />
                  <circle
                    cx={toSvgX(liveDraftSegmentPreview.seg.from.x)}
                    cy={toSvgY(liveDraftSegmentPreview.seg.from.y)}
                    r="5"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={toSvgX(liveDraftSegmentPreview.seg.to.x)}
                    cy={toSvgY(liveDraftSegmentPreview.seg.to.y)}
                    r="5"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Currently Active Drawing Stroke (Zero-Gap cursor tracking) */}
              {currentStroke.length >= 2 && (
                <polyline
                  points={currentStroke.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                />
              )}

              {/* User Pinned Dimension & Angle Annotations */}
              {textAnnotations.map((ann) => (
                <g key={ann.id} transform={`translate(${toSvgX(ann.x)}, ${toSvgY(ann.y)})`}>
                  <rect
                    x="-48"
                    y="-13"
                    width="96"
                    height="26"
                    rx="6"
                    fill="#0f172a"
                    stroke={/c\s*[:=]?\s*[0-9]/i.test(ann.text) ? '#f59e0b' : '#38bdf8'}
                    strokeWidth="1.6"
                    className="filter drop-shadow-[0_2px_6px_rgba(56,189,248,0.3)]"
                  />
                  <text
                    x="0"
                    y="4.5"
                    textAnchor="middle"
                    fill={/c\s*[:=]?\s*[0-9]/i.test(ann.text) ? '#fcd34d' : '#38bdf8'}
                    fontSize="10.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {ann.text}
                  </text>
                </g>
              ))}

              {/* Solved Accurate CAD Geometry Profile (Shown ONLY after Analysis or when populated) */}
              {(hasAnalyzedShape || cadSegments.length > 0) && (solvedSvgPath || solvedFillPath) && (
                <>
                  {solvedFillPath && (
                    <path
                      d={solvedFillPath}
                      fill="url(#tunnelInteriorGrad)"
                      stroke="none"
                    />
                  )}
                  {solvedSvgPath && (
                    <path
                      d={solvedSvgPath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3.4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className="filter drop-shadow-[0_0_14px_rgba(56,189,248,0.4)]"
                    />
                  )}

                  {/* Open Wall Boundary Visual Indication (Slashing / Sluicing / Drift Heading) */}
                  {openWall === 'left' && (
                    <g className="text-cyan-400">
                      <line
                        x1={toSvgX(-effLeftSpan)}
                        y1={toSvgY(0)}
                        x2={toSvgX(-effLeftSpan + Math.tan(((90 - leftWallAngleDeg) * Math.PI) / 180) * heightM)}
                        y2={toSvgY(heightM)}
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                      />
                      {/* Open Void Badge */}
                      <g
                        transform={`translate(${
                          toSvgX(-effLeftSpan + (Math.tan(((90 - leftWallAngleDeg) * Math.PI) / 180) * heightM) / 2) - 45
                        }, ${toSvgY(heightM / 2)})`}
                      >
                        <rect
                          x="-65"
                          y="-12"
                          width="130"
                          height="24"
                          rx="6"
                          fill="#020617"
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="4,2"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          OPEN VOID / DRIFT
                        </text>
                      </g>
                      {/* Left Wall Angle Arc indicator */}
                      <g className="text-amber-400 font-mono text-[9.5px]">
                        <path
                          d={`M ${toSvgX(-effLeftSpan) + 20} ${toSvgY(0)} A 20 20 0 0 0 ${
                            toSvgX(-effLeftSpan) + 20 * Math.cos((leftWallAngleDeg * Math.PI) / 180)
                          } ${toSvgY(0) - 20 * Math.sin((leftWallAngleDeg * Math.PI) / 180)}`}
                          fill="none"
                          stroke="#fcd34d"
                          strokeWidth="1.5"
                        />
                        <text x={toSvgX(-effLeftSpan) + 26} y={toSvgY(0) - 12} fill="#fcd34d" fontWeight="black">
                          {leftWallAngleDeg}°
                        </text>
                      </g>
                    </g>
                  )}

                  {openWall === 'right' && (
                    <g className="text-cyan-400">
                      <line
                        x1={toSvgX(effRightSpan)}
                        y1={toSvgY(0)}
                        x2={toSvgX(effRightSpan - Math.tan(((90 - rightWallAngleDeg) * Math.PI) / 180) * heightM)}
                        y2={toSvgY(heightM)}
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                      />
                      {/* Open Void Badge */}
                      <g
                        transform={`translate(${
                          toSvgX(effRightSpan - (Math.tan(((90 - rightWallAngleDeg) * Math.PI) / 180) * heightM) / 2) + 45
                        }, ${toSvgY(heightM / 2)})`}
                      >
                        <rect
                          x="-65"
                          y="-12"
                          width="130"
                          height="24"
                          rx="6"
                          fill="#020617"
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="4,2"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          OPEN VOID / DRIFT
                        </text>
                      </g>
                      {/* Right Wall Angle Arc indicator */}
                      <g className="text-amber-400 font-mono text-[9.5px]">
                        <text x={toSvgX(effRightSpan) - 34} y={toSvgY(0) - 12} fill="#fcd34d" fontWeight="black">
                          {rightWallAngleDeg}°
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Dimension Annotations on Solved CAD Profile (Works for ANY shape: Triangle, Polygon, Arch, or Open Drift) */}
                  {/* 1. Overall Width Arrow at Base */}
                  <g className="text-amber-400 font-mono text-[10px] pointer-events-none">
                    <line
                      x1={toSvgX(evaluated.minX)}
                      y1={toSvgY(evaluated.minY) + 24}
                      x2={toSvgX(evaluated.maxX)}
                      y2={toSvgY(evaluated.minY) + 24}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <circle cx={toSvgX(evaluated.minX)} cy={toSvgY(evaluated.minY) + 24} r="3" fill="#f59e0b" />
                    <circle cx={toSvgX(evaluated.maxX)} cy={toSvgY(evaluated.minY) + 24} r="3" fill="#f59e0b" />
                    <rect
                      x={toSvgX((evaluated.minX + evaluated.maxX) / 2) - 55}
                      y={toSvgY(evaluated.minY) + 14}
                      width="110"
                      height="18"
                      rx="4"
                      fill="#020617"
                      stroke="#f59e0b"
                      strokeWidth="1"
                    />
                    <text
                      x={toSvgX((evaluated.minX + evaluated.maxX) / 2)}
                      y={toSvgY(evaluated.minY) + 27}
                      textAnchor="middle"
                      fill="#f59e0b"
                      fontWeight="bold"
                    >
                      W = {evaluated.width.toFixed(2)} m
                    </text>
                  </g>

                  {/* 2. Total Height Arrow */}
                  <g className="text-cyan-400 font-mono text-[10px] pointer-events-none">
                    <line
                      x1={openWall === 'left' ? toSvgX(evaluated.minX) - 28 : toSvgX(evaluated.maxX) + 28}
                      y1={toSvgY(evaluated.maxY)}
                      x2={openWall === 'left' ? toSvgX(evaluated.minX) - 28 : toSvgX(evaluated.maxX) + 28}
                      y2={toSvgY(evaluated.minY)}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={openWall === 'left' ? toSvgX(evaluated.minX) - 28 : toSvgX(evaluated.maxX) + 28}
                      cy={toSvgY(evaluated.maxY)}
                      r="3"
                      fill="#38bdf8"
                    />
                    <circle
                      cx={openWall === 'left' ? toSvgX(evaluated.minX) - 28 : toSvgX(evaluated.maxX) + 28}
                      cy={toSvgY(evaluated.minY)}
                      r="3"
                      fill="#38bdf8"
                    />
                    <rect
                      x={openWall === 'left' ? toSvgX(evaluated.minX) - 70 : toSvgX(evaluated.maxX) + 12}
                      y={toSvgY((evaluated.minY + evaluated.maxY) / 2) - 9}
                      width="72"
                      height="18"
                      rx="4"
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                    <text
                      x={openWall === 'left' ? toSvgX(evaluated.minX) - 34 : toSvgX(evaluated.maxX) + 48}
                      y={toSvgY((evaluated.minY + evaluated.maxY) / 2) + 4}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontWeight="bold"
                    >
                      H = {evaluated.height.toFixed(2)} m
                    </text>
                  </g>

                  {/* 3. Segment Length / Angle / Arc Badges for every CAD edge (Click badge to edit exact parameters) */}
                  {evaluated.segmentMetrics.map((seg) => {
                    const mx = toSvgX(seg.midHandlePoint.x);
                    const my = toSvgY(seg.midHandlePoint.y);
                    const isArc = seg.type === 'arc';
                    const matchingCadSeg = cadSegments.find((cs) => cs.id === seg.segmentId);
                    const isOpenSeg = seg.zoneRole === 'open' || matchingCadSeg?.isPortionOpen;
                    const dx = seg.toPoint.x - seg.fromPoint.x;
                    const dy = seg.toPoint.y - seg.fromPoint.y;
                    const angleFromHoriz = Math.round(
                      Math.abs((Math.atan2(dy, dx) * 180) / Math.PI)
                    );
                    const displayDeg =
                      angleFromHoriz > 90 ? 180 - angleFromHoriz : angleFromHoriz;
                    const sagittaH = matchingCadSeg?.heightFromCenterM
                      ? matchingCadSeg.heightFromCenterM
                      : seg.bulge
                      ? (Math.abs(seg.bulge) * seg.chordLength) / 2
                      : 0;
                    const roleTag =
                      seg.zoneRole === 'leftWall'
                        ? 'LW'
                        : seg.zoneRole === 'rightWall'
                        ? 'RW'
                        : seg.zoneRole === 'crown'
                        ? 'CR'
                        : seg.zoneRole === 'invert'
                        ? 'INV'
                        : 'OPEN';
                    const labelText = isOpenSeg
                      ? `${roleTag} [OPEN] ${seg.arcLength.toFixed(2)}m`
                      : isArc
                      ? `${roleTag}: C=${seg.arcLength.toFixed(2)}m · h=${sagittaH.toFixed(2)}m`
                      : `${roleTag}: L=${seg.arcLength.toFixed(2)}m (${displayDeg}°)`;
                    const boxW = isArc ? 168 : 132;

                    return (
                      <g
                        key={seg.segmentId}
                        className="font-mono text-[9.5px] cursor-pointer"
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          if (matchingCadSeg) {
                            handleOpenSegmentForEdit(matchingCadSeg);
                          }
                        }}
                      >
                        <rect
                          x={mx - boxW / 2}
                          y={my - 10}
                          width={boxW}
                          height="18"
                          rx="4"
                          fill="#020617"
                          fillOpacity="0.92"
                          stroke={isOpenSeg ? '#f43f5e' : isArc ? '#f59e0b' : '#34d399'}
                          strokeWidth="1.2"
                          strokeDasharray={isOpenSeg ? '3,2' : undefined}
                        />
                        <text
                          x={mx}
                          y={my + 2.5}
                          textAnchor="middle"
                          fill={isOpenSeg ? '#fda4af' : isArc ? '#fcd34d' : '#6ee7b7'}
                          fontWeight="bold"
                        >
                          {labelText}
                        </text>
                      </g>
                    );
                  })}

                  {/* 4. Draggable CAD Control Vertex Nodes (P1, P2, P3...) */}
                  {solvedProfileDefinition.controlPoints.map((cp) => (
                    <g key={cp.id}>
                      <circle
                        cx={toSvgX(cp.x)}
                        cy={toSvgY(cp.y)}
                        r="6"
                        fill={cp.role === 'crown_apex' ? '#f59e0b' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-move hover:scale-125 transition-transform"
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          setActiveVertexId(cp.id);
                        }}
                      />
                      <text
                        x={toSvgX(cp.x)}
                        y={toSvgY(cp.y) - 10}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                        className="pointer-events-none"
                      >
                        {cp.label}
                      </text>
                    </g>
                  ))}
                </>
              )}
            </svg>

            {/* In-Canvas Bottom Status Bar */}
            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-300 backdrop-blur-sm pointer-events-none">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Span (W): <strong className="text-amber-300">{evaluated.width.toFixed(2)}m</strong>
                </span>
                <span>
                  Height (H): <strong className="text-cyan-300">{evaluated.height.toFixed(2)}m</strong>
                </span>
                <span>
                  Crown:{' '}
                  <strong className={evaluated.hasCrown ? 'text-purple-300' : 'text-rose-400'}>
                    {evaluated.hasCrown ? `${evaluated.crownArcLength.toFixed(2)}m` : 'OPEN (Hidden)'}
                  </strong>
                </span>
                <span>
                  Left Wall:{' '}
                  <strong className={evaluated.hasLeftWall ? 'text-emerald-300' : 'text-rose-400'}>
                    {evaluated.hasLeftWall ? `${evaluated.leftWallArcLength.toFixed(2)}m` : 'OPEN (Hidden)'}
                  </strong>
                </span>
                <span>
                  Right Wall:{' '}
                  <strong className={evaluated.hasRightWall ? 'text-sky-300' : 'text-rose-400'}>
                    {evaluated.hasRightWall ? `${evaluated.rightWallArcLength.toFixed(2)}m` : 'OPEN (Hidden)'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Perimeter: <strong className="text-white">{evaluated.totalPerimeterMeters.toFixed(2)}m</strong>
                </span>
                <span>
                  Area:{' '}
                  <strong className="text-emerald-400">{evaluated.designAreaSqMeters.toFixed(2)}m²</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): ESWA Shape Creator AI Advanced */}
        <div className="lg:col-span-4 flex flex-col h-full min-h-0 max-h-full bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Scrollable Content Body with Ample Space & Direct Clean Access */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 pr-2 custom-scrollbar overscroll-contain select-text">
            {/* SECTION 0: ACCURATE DRAWN CAD SEGMENTS & PORTION REFLECTION ON FACE CANVAS */}
            <div className="p-3 rounded-xl bg-slate-950/95 border-2 border-amber-500/40 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-black uppercase text-amber-300 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-amber-400" />
                  <span>Drawn Segments &amp; Face Canvas Portions</span>
                </span>
                <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  {cadSegments.length} {cadSegments.length === 1 ? 'Segment' : 'Segments'}
                </span>
              </div>

              {/* Portion Reflection Toggles: Open portions do NOT reflect on Face Mapping Canvas */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[9.5px] text-slate-400 font-mono block">
                  Portion Status on Face Mapping Canvas (Click to Toggle Mapped vs Open):
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { key: 'leftWall', label: 'Left Wall' },
                      { key: 'crown', label: 'Crown / Arch' },
                      { key: 'rightWall', label: 'Right Wall' },
                      { key: 'invert', label: 'Floor / Invert' },
                    ] as const
                  ).map((item) => {
                    const isOpen = openPortions[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          const nextOpen = !isOpen;
                          setOpenPortions((prev) => ({ ...prev, [item.key]: nextOpen }));
                          setCadSegments((prev) =>
                            prev.map((s) =>
                              s.portion === item.key ? { ...s, isPortionOpen: nextOpen } : s
                            )
                          );
                          if (item.key === 'leftWall') {
                            markParamLocked('openWall');
                            setOpenWall(nextOpen ? 'left' : openWall === 'left' ? 'none' : openWall);
                          } else if (item.key === 'rightWall') {
                            markParamLocked('openWall');
                            setOpenWall(nextOpen ? 'right' : openWall === 'right' ? 'none' : openWall);
                          }
                          setHasAnalyzedShape(true);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between border cursor-pointer transition-all ${
                          isOpen
                            ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                            : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        }`}
                        title={
                          isOpen
                            ? `${item.label} is OPEN — Will NOT reflect on Face Mapping Canvas`
                            : `${item.label} is MAPPED — Active on Face Mapping Canvas`
                        }
                      >
                        <span className="text-[10px] font-bold">{item.label}</span>
                        <span
                          className={`text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded ${
                            isOpen
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {isOpen ? 'OPEN (HIDDEN)' : 'MAPPED'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of Drawn CAD Segments */}
              {cadSegments.length > 0 ? (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
                  {cadSegments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-[10px] font-mono"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleOpenSegmentForEdit(seg)}
                        title="Click to edit Length, Angle, Curve Height, or Portion"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-black text-white uppercase">
                            {seg.portion === 'leftWall'
                              ? 'Left Wall'
                              : seg.portion === 'rightWall'
                              ? 'Right Wall'
                              : seg.portion === 'crown'
                              ? 'Crown'
                              : seg.portion === 'invert'
                              ? 'Invert'
                              : 'Open Void'}
                          </span>
                          {seg.isPortionOpen && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[8.5px] font-bold">
                              OPEN (No Face Canvas)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-300 mt-1">
                          {seg.type === 'line' ? (
                            <span>
                              Line: <strong className="text-emerald-300">L = {seg.lengthM.toFixed(2)}m</strong> · Angle ={' '}
                              <strong className="text-cyan-300">{seg.angleDeg.toFixed(1)}°</strong>
                            </span>
                          ) : (
                            <span>
                              Curve: <strong className="text-amber-300">C = {seg.lengthM.toFixed(2)}m</strong> · Center Height ={' '}
                              <strong className="text-purple-300">h = {seg.heightFromCenterM.toFixed(2)}m</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenSegmentForEdit(seg)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-bold text-[9px] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCadSegments((prev) => prev.filter((s) => s.id !== seg.id));
                            if (seg.strokeId) {
                              setStrokes((prev) => prev.filter((st) => st.id !== seg.strokeId));
                            }
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white cursor-pointer"
                          title="Delete segment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300 leading-relaxed">
                  Draw any line or curve on the canvas (or click <strong>+ Add Exact Line / Curve</strong>) to enter exact{' '}
                  <strong className="text-emerald-300">Length &amp; Angle</strong> or{' '}
                  <strong className="text-amber-300">Curve Length &amp; Height from Center</strong> and assign its portion.
                </div>
              )}
            </div>

            {/* SECTION 1: PROFILE SYMMETRY & EXCAVATION BOUNDARIES */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                    <span>Profile Symmetry Mode</span>
                  </span>
                  <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSymmetric(true);
                        const avgSpan = Number(((leftSpanM + rightSpanM) / 2).toFixed(2));
                        setLeftSpanM(avgSpan);
                        setRightSpanM(avgSpan);
                        setWidthM(Number((avgSpan * 2).toFixed(2)));
                        setRightWallHeightM(leftWallHeightM);
                        setRightWallAngleDeg(leftWallAngleDeg);
                        setCrownApexOffsetXM(0);
                        if (openWall !== 'none') setOpenWall('none');
                        setHasAnalyzedShape(true);
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        isSymmetric
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Both sidewalls, half-spans and curvature are perfectly symmetric"
                    >
                      ⚖️ Symmetric
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSymmetric(false);
                        const geom = analyzeStrokesGeometrically(true);
                        if (geom) {
                          setLeftSpanM(Number(geom.leftSpan.toFixed(2)));
                          setRightSpanM(Number(geom.rightSpan.toFixed(2)));
                          setWidthM(Number((geom.leftSpan + geom.rightSpan).toFixed(2)));
                          setHeightM(Number(geom.totalH.toFixed(2)));
                          setLeftWallHeightM(Number(geom.leftWallH.toFixed(2)));
                          setRightWallHeightM(Number(geom.rightWallH.toFixed(2)));
                          setLeftWallAngleDeg(geom.leftAngle);
                          setRightWallAngleDeg(geom.rightAngle);
                          setCrownApexOffsetXM(geom.apexOffsetX);
                          setAnalysisExplanation(
                            `Extracted genuine non-symmetric profile from sketch: Left Wall ${geom.leftWallH.toFixed(2)}m @ ${geom.leftAngle}°, Right Wall ${geom.rightWallH.toFixed(2)}m @ ${geom.rightAngle}°, Left Span ${geom.leftSpan.toFixed(2)}m, Right Span ${geom.rightSpan.toFixed(2)}m, Apex Offset ${geom.apexOffsetX.toFixed(2)}m.`
                          );
                        } else {
                          if (Math.abs(leftWallHeightM - rightWallHeightM) < 0.05) {
                            setRightWallHeightM(Number(Math.max(1.0, leftWallHeightM * 0.78).toFixed(2)));
                          }
                        }
                        setHasAnalyzedShape(true);
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        !isSymmetric
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Independent left and right wall heights, spans, and batter angles (slashing, drifts, fault zones, shanty)"
                    >
                      📐 Non-Symmetric
                    </button>
                  </div>
                </div>

                {/* Excavation Wall Boundary Configuration */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] font-black uppercase text-cyan-300 flex items-center gap-1">
                      <Split className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Excavation Abutments</span>
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-black tracking-wide border ${
                        openWall === 'none'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {openWall === 'none' ? 'Closed (2 Walls)' : `${openWall.toUpperCase()} OPEN (DRIFT)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        markParamLocked('openWall');
                        setOpenWall('none');
                        setIsSymmetric(true);
                        setHasAnalyzedShape(true);
                      }}
                      className={`py-2 px-1 rounded-lg text-center flex flex-col items-center justify-center border cursor-pointer transition-all ${
                        openWall === 'none'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-bold">Closed</span>
                      <span className="text-[8.5px] opacity-75">2 Solid Walls</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        markParamLocked('openWall', 'leftWallHeightM');
                        setOpenWall('left');
                        setIsSymmetric(false);
                        setLeftWallHeightM(0);
                        setHasAnalyzedShape(true);
                      }}
                      className={`py-2 px-1 rounded-lg text-center flex flex-col items-center justify-center border cursor-pointer transition-all ${
                        openWall === 'left'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-bold">Left Open</span>
                      <span className="text-[8.5px] opacity-75">Slashing Stope</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        markParamLocked('openWall', 'rightWallHeightM');
                        setOpenWall('right');
                        setIsSymmetric(false);
                        setRightWallHeightM(0);
                        setHasAnalyzedShape(true);
                      }}
                      className={`py-2 px-1 rounded-lg text-center flex flex-col items-center justify-center border cursor-pointer transition-all ${
                        openWall === 'right'
                          ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-[10px] font-bold">Right Open</span>
                      <span className="text-[8.5px] opacity-75">Drift Heading</span>
                    </button>
                  </div>

                  {/* Quick Preset Button */}
                  <button
                    type="button"
                    onClick={() => applyArchetype('open_slashing_drift')}
                    className="w-full py-1.5 px-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-200 text-[9.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>⚡ Load Slashing Reference Preset (6m × 8m, c 10.2m, 80°)</span>
                  </button>
                </div>
              </div>

            {/* SECTION 2: REQUIREMENTS RECONCILIATION TABLE (Clean Non-Overlapping List) */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Requirements Reconciliation</span>
                  </span>
                  <span className="text-[9px] font-mono text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                    Fidelity: 100% Exact
                  </span>
                </div>

                {/* Structured Inspection Rows: Zero Overlap */}
                <div className="space-y-1.5 text-[10px]">
                  {/* Row: Span */}
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[9.5px]">Span (Baseline Width):</span>
                      <span className="text-slate-200 font-mono font-bold">
                        User: {detectedUserRequirements.width ? `${detectedUserRequirements.width}m` : `${widthM.toFixed(2)}m`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 font-mono font-bold block">{evaluated.width.toFixed(2)}m</span>
                      <span className="text-[8.5px] font-mono text-emerald-400 font-bold">Exact CAD Match</span>
                    </div>
                  </div>

                  {/* Row: Height */}
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[9.5px]">Apex Elevation (Height):</span>
                      <span className="text-slate-200 font-mono font-bold">
                        User: {detectedUserRequirements.height ? `${detectedUserRequirements.height}m` : `${heightM.toFixed(2)}m`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-mono font-bold block">{evaluated.height.toFixed(2)}m</span>
                      <span className="text-[8.5px] font-mono text-emerald-400 font-bold">Datum Calibrated</span>
                    </div>
                  </div>

                  {/* Row: Arc */}
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[9.5px]">Crown Curve Arc (C):</span>
                      <span className="text-slate-200 font-mono font-bold">
                        User: {crownArcLengthM ? `c ${crownArcLengthM}m` : 'Natural Curvature'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-purple-400 font-mono font-bold block">
                        C = {evaluated.crownArcLength.toFixed(2)}m
                      </span>
                      <span className="text-[8.5px] font-mono text-amber-400 font-bold">
                        {crownArcLengthM ? 'Exact Arc Applied' : 'Auto Arch'}
                      </span>
                    </div>
                  </div>

                  {/* Row: Boundary */}
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[9.5px]">Excavation Boundary:</span>
                      <span className="text-slate-200 font-mono font-bold">
                        {openWall === 'none' ? '2 Solid Abutments' : `${openWall.toUpperCase()} Boundary OPEN`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-300 font-mono font-bold block text-[9.5px]">
                        {openWall === 'none' ? 'Standard NATM' : 'Slashing Drift'}
                      </span>
                      <span className="text-[8.5px] font-mono text-emerald-400 font-bold">Active Profile</span>
                    </div>
                  </div>
                </div>
              </div>

            {/* SECTION 3: RE-ENSURE CONTROLS (Slide Bars & Direct Inputs with Dedicated Rows) */}

            {/* 1. Span / Total Width */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-300">
                    1. Baseline Span / Width (W)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                    Total: {widthM.toFixed(2)}m {!isSymmetric ? '(Non-Symmetric)' : ''}
                  </span>
                </div>

                {/* Rationale / Reason */}
                <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                  <strong className="text-amber-400 font-bold">Reason: </strong>
                  {!isSymmetric
                    ? `Independent left span (${leftSpanM.toFixed(2)}m) and right span (${rightSpanM.toFixed(2)}m) from centerline CL to sidewall footings.`
                    : 'Symmetric baseline chord directly calibrated to floor datum sketch.'}
                </p>

                {isSymmetric ? (
                  <>
                    {/* Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                        <span>Slide total span:</span>
                        <span className="text-amber-300 font-bold font-mono text-[10px]">{widthM.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min={2.0}
                        max={25.0}
                        step={0.1}
                        value={widthM}
                        onChange={(e) => {
                          handleTotalWidthChange(Number(e.target.value));
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Direct Entry: Dedicated Row */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step={0.1}
                          min={1.0}
                          max={30.0}
                          value={widthM}
                          onChange={(e) => {
                            handleTotalWidthChange(Number(e.target.value));
                            setHasAnalyzedShape(true);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                          m
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    {/* Left Span */}
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-emerald-400 font-bold">Left Half-Span (CL to Left Wall):</span>
                        <span className="font-mono text-emerald-300 font-bold">{leftSpanM.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={15.0}
                        step={0.05}
                        value={leftSpanM}
                        onChange={(e) => {
                          handleLeftSpanChange(Number(e.target.value));
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Right Span */}
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-purple-400 font-bold">Right Half-Span (CL to Right Wall):</span>
                        <span className="font-mono text-purple-300 font-bold">{rightSpanM.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={15.0}
                        step={0.05}
                        value={rightSpanM}
                        onChange={(e) => {
                          handleRightSpanChange(Number(e.target.value));
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full accent-purple-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

            {/* 2. Total Height (Apex Elevation) */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-cyan-300">
                    2. Total Height (Apex Datum)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                    {heightM.toFixed(2)}m
                  </span>
                </div>

                {/* Rationale / Reason */}
                <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                  <strong className="text-cyan-400 font-bold">Reason: </strong>
                  Total elevation measured from invert datum RL 0.00m to highest roof apex point.
                </p>

                {/* Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>Slide height:</span>
                    <span className="text-cyan-300 font-bold font-mono text-[10px]">{heightM.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min={2.0}
                    max={25.0}
                    step={0.1}
                    value={heightM}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      markParamLocked('heightM');
                      setHeightM(val);
                      setCrownSagittaM(Number(Math.max(0.2, val - Math.min(leftWallHeightM, rightWallHeightM)).toFixed(2)));
                      setCrownArcLengthM(null);
                      setHasAnalyzedShape(true);
                    }}
                    className="w-full accent-cyan-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Direct Entry: Dedicated Row */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                  <div className="relative w-28 shrink-0">
                    <input
                      type="number"
                      step={0.1}
                      min={1.0}
                      max={30.0}
                      value={heightM}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        markParamLocked('heightM');
                        setHeightM(val);
                        setCrownSagittaM(Number(Math.max(0.2, val - Math.min(leftWallHeightM, rightWallHeightM)).toFixed(2)));
                        setCrownArcLengthM(null);
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                      m
                    </span>
                  </div>
                </div>

                {/* Crown Apex CL Offset in Non-Symmetric mode */}
                {!isSymmetric && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[9.5px]">
                      <span className="text-cyan-300 font-bold">Crown Apex Peak Offset from CL:</span>
                      <span className="font-mono text-cyan-200 font-bold">
                        {crownApexOffsetXM === 0
                          ? 'Centered (0.00m)'
                          : crownApexOffsetXM < 0
                          ? `${Math.abs(crownApexOffsetXM).toFixed(2)}m Left`
                          : `${crownApexOffsetXM.toFixed(2)}m Right`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-Math.min(5, leftSpanM * 0.8)}
                      max={Math.min(5, rightSpanM * 0.8)}
                      step={0.05}
                      value={crownApexOffsetXM}
                      onChange={(e) => {
                        markParamLocked('apexOffsetXM');
                        setCrownApexOffsetXM(Number(e.target.value));
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[8.5px] text-slate-500 font-mono">
                      <span>← Left Peak</span>
                      <button
                        type="button"
                        onClick={() => {
                          markParamLocked('apexOffsetXM');
                          setCrownApexOffsetXM(0);
                          setHasAnalyzedShape(true);
                        }}
                        className="text-[8.5px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        Center (0m)
                      </button>
                      <span>Right Peak →</span>
                    </div>
                  </div>
                )}
              </div>

            {/* 3. Crown Curve Arc C (Slide Bar + Presets in Separate Rows) */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-300">
                    3. Crown Curve Arc Length (C)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    {crownArcLengthM ? `C = ${crownArcLengthM.toFixed(2)}m (CAD Arc)` : `Auto: ${evaluated.crownArcLength.toFixed(2)}m`}
                  </span>
                </div>

                {/* Rationale / Reason */}
                <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-950/70 p-2 rounded-lg border border-amber-500/20">
                  <strong className="text-amber-300 font-bold">Reason: </strong>
                  {crownArcLengthM
                    ? `Applied circular arc sagitta theorem: calculated radius R=${(evaluated.effectiveCrownRadius || 5.84).toFixed(2)}m so the curved roof perimeter matches ${crownArcLengthM.toFixed(2)}m with 0.00m error.`
                    : `Solved circular arch with rise ${crownSagittaM.toFixed(2)}m matching standard NATM curvature profile.`}
                </p>

                {/* Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-amber-300 font-mono">
                    <span>Slide arc length:</span>
                    <span className="font-bold text-[10px]">{evaluated.crownArcLength.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min={2.0}
                    max={35.0}
                    step={0.1}
                    value={crownArcLengthM ?? Number(evaluated.crownArcLength.toFixed(2))}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      markParamLocked('crownArcLengthM', 'crownType');
                      setCrownArcLengthM(val > 0 ? val : null);
                      setCrownType('circular_arc');
                      setHasAnalyzedShape(true);
                    }}
                    className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Direct Number Input Row */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
                  <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Arc Input:</span>
                  <div className="relative w-28 shrink-0">
                    <input
                      type="number"
                      step={0.1}
                      min={1.0}
                      max={40.0}
                      value={crownArcLengthM ?? Number(evaluated.crownArcLength.toFixed(2))}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        markParamLocked('crownArcLengthM', 'crownType');
                        setCrownArcLengthM(val > 0 ? val : null);
                        setCrownType('circular_arc');
                        setHasAnalyzedShape(true);
                      }}
                      placeholder="e.g. 10.2"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-1.5 text-[10px] text-amber-400 font-mono pointer-events-none font-bold">
                      m
                    </span>
                  </div>
                </div>

                {/* Quick Presets Row: Separate Row so it Never Collides */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase shrink-0">Arc Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      markParamLocked('crownArcLengthM', 'crownType');
                      setCrownArcLengthM(10.2);
                      setCrownType('circular_arc');
                      setHasAnalyzedShape(true);
                    }}
                    className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[9.5px] font-mono font-bold border border-amber-500/40 cursor-pointer"
                  >
                    + C 10.2m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markParamLocked('crownArcLengthM', 'crownType');
                      setCrownArcLengthM(10.6);
                      setCrownType('circular_arc');
                      setHasAnalyzedShape(true);
                    }}
                    className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[9.5px] font-mono font-bold border border-amber-500/40 cursor-pointer"
                  >
                    + C 10.6m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      userLockedParamsRef.current.delete('crownArcLengthM');
                      setCrownArcLengthM(null);
                      setCrownType('circular_arc');
                      setHasAnalyzedShape(true);
                    }}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9.5px] font-mono cursor-pointer"
                  >
                    Auto Arch
                  </button>
                </div>
              </div>

            {/* 4. Left Sidewall Controls */}
            {openWall !== 'left' ? (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-400">
                      4. Left Sidewall Height
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-300 font-bold">
                      {leftWallHeightM.toFixed(2)}m @ {leftWallAngleDeg}°
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <strong className="text-emerald-400 font-bold">Reason: </strong>
                    Solid left rock abutment pillar height calibrated to geotechnical contact.
                  </p>
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(1, heightM - 0.1)}
                      step={0.1}
                      value={leftWallHeightM}
                      onChange={(e) => {
                        handleLeftWallHeightChange(Number(e.target.value));
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        step={0.1}
                        value={leftWallHeightM}
                        onChange={(e) => {
                          handleLeftWallHeightChange(Number(e.target.value));
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-emerald-400 focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                        m
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold">
                    <span>4. Left Boundary: OPEN VOID (Slashing)</span>
                    <span className="font-mono text-cyan-400">0.00m</span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 leading-relaxed">
                    <strong className="text-cyan-300">Reason: </strong>
                    Left wall omitted for slashing drill-and-blast heading into adjacent stope void.
                  </p>
                </div>
              )}

            {/* 5. Right Sidewall Controls */}
            {openWall !== 'right' ? (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-purple-400">
                      5. Right Sidewall Height
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-300 font-bold">
                      {rightWallHeightM.toFixed(2)}m @ {rightWallAngleDeg}°
                    </span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                    <strong className="text-purple-400 font-bold">Reason: </strong>
                    Rock bench height constrained to {rightWallHeightM.toFixed(2)}m per abutment geotechnical contact.
                  </p>
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(1, heightM - 0.1)}
                      step={0.1}
                      value={rightWallHeightM}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (isSymmetric) {
                          handleLeftWallHeightChange(val);
                        } else {
                          markParamLocked('rightWallHeightM');
                          setRightWallHeightM(val);
                        }
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full accent-purple-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        step={0.1}
                        value={rightWallHeightM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (isSymmetric) {
                            handleLeftWallHeightChange(val);
                          } else {
                            markParamLocked('rightWallHeightM');
                            setRightWallHeightM(val);
                          }
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-purple-400 focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                        m
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/50 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold">
                    <span>5. Right Boundary: OPEN VOID (Drift)</span>
                    <span className="font-mono text-cyan-400">0.00m</span>
                  </div>
                  <p className="text-[9.5px] text-slate-300 leading-relaxed">
                    <strong className="text-cyan-300">Reason: </strong>
                    Right wall omitted for drift heading extension into adjacent vein/stope.
                  </p>
                </div>
              )}

            {/* 6. Wall Incline / Batter Angle */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-300">
                    6. Wall Incline / Batter Angle {isSymmetric ? '' : '(Left Sidewall)'}
                  </span>
                  <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                    {leftWallAngleDeg}° ({leftWallAngleDeg < 90 ? `${90 - leftWallAngleDeg}° Inward Batter` : leftWallAngleDeg > 90 ? `${leftWallAngleDeg - 90}° Flared` : 'Vertical 90°'})
                  </span>
                </div>

                <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                  <strong className="text-amber-400 font-bold">Reason: </strong>
                  {leftWallAngleDeg !== 90
                    ? `${leftWallAngleDeg}° inward batter slope accommodates geotechnical discontinuity dip.`
                    : 'Standard vertical 90° sidewall profile.'}
                </p>

                <div className="space-y-1">
                  <input
                    type="range"
                    min={70}
                    max={110}
                    step={1}
                    value={leftWallAngleDeg}
                    onChange={(e) => {
                      handleLeftWallAngleChange(Number(e.target.value));
                      setHasAnalyzedShape(true);
                    }}
                    className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>70° (Inward)</span>
                    <span>90° (Vertical)</span>
                    <span>110° (Flared)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                  <div className="relative w-28 shrink-0">
                    <input
                      type="number"
                      step={1}
                      min={60}
                      max={120}
                      value={leftWallAngleDeg}
                      onChange={(e) => {
                        handleLeftWallAngleChange(Number(e.target.value));
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                      °
                    </span>
                  </div>
                </div>

                {!isSymmetric && openWall !== 'right' && (
                  <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-300">
                        Right Sidewall Incline Angle
                      </span>
                      <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                        {rightWallAngleDeg}° ({rightWallAngleDeg < 90 ? `${90 - rightWallAngleDeg}° Inward Batter` : rightWallAngleDeg > 90 ? `${rightWallAngleDeg - 90}° Flared` : 'Vertical 90°'})
                      </span>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="range"
                        min={70}
                        max={110}
                        step={1}
                        value={rightWallAngleDeg}
                        onChange={(e) => {
                          handleRightWallAngleChange(Number(e.target.value));
                          setHasAnalyzedShape(true);
                        }}
                        className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                      />
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                        <span>70° (Inward)</span>
                        <span>90° (Vertical)</span>
                        <span>110° (Flared)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step={1}
                          min={60}
                          max={120}
                          value={rightWallAngleDeg}
                          onChange={(e) => {
                            handleRightWallAngleChange(Number(e.target.value));
                            setHasAnalyzedShape(true);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                          °
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* 7. Floor / Invert Profile */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-200">
                    7. Invert / Floor Profile
                  </span>
                  <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">
                    {invertType === 'curved_dish' ? `Dish: ${invertSagittaM.toFixed(2)}m` : 'Flat Invert'}
                  </span>
                </div>

                <p className="text-[9.5px] text-slate-300 leading-relaxed bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                  <strong className="text-slate-200 font-bold">Reason: </strong>
                  {invertType === 'flat'
                    ? 'Flat floor base specified for heavy haulage wheel path and trackless equipment.'
                    : `Curved invert dish (${invertSagittaM.toFixed(2)}m) resists floor heave in squeezing rock mass.`}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      markParamLocked('invertType');
                      setInvertType('flat');
                      setHasAnalyzedShape(true);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      invertType === 'flat'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Flat Floor Base
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markParamLocked('invertType');
                      setInvertType('curved_dish');
                      setHasAnalyzedShape(true);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                      invertType === 'curved_dish'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Curved Invert Dish
                  </button>
                </div>

                {invertType === 'curved_dish' && (
                  <div className="pt-2 space-y-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>Dish Depth:</span>
                      <span className="text-amber-300 font-bold font-mono text-[10px]">{invertSagittaM.toFixed(2)} m</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={2.0}
                      step={0.05}
                      value={invertSagittaM}
                      onChange={(e) => {
                        markParamLocked('invertSagittaM', 'invertType');
                        setInvertSagittaM(Number(e.target.value));
                        setHasAnalyzedShape(true);
                      }}
                      className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-slate-300 font-semibold shrink-0">Direct Number Input:</span>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step={0.05}
                          value={invertSagittaM}
                          onChange={(e) => {
                            markParamLocked('invertSagittaM', 'invertType');
                            setInvertSagittaM(Number(e.target.value));
                            setHasAnalyzedShape(true);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-xs text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-mono pointer-events-none">
                          m
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* SECTION 4: 1-Click Dimension Pins categorized with clean spacing */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2.5 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                1-Click Add Dimension Pins
              </span>

              {/* Excavation & Curve Pins */}
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-mono uppercase block">Boundary &amp; Arcs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { text: 'open (Left)', color: 'cyan' },
                    { text: 'open (Right)', color: 'cyan' },
                    { text: 'c 10.2m', color: 'amber' },
                    { text: 'c 10.6m', color: 'amber' },
                  ].map((pin) => (
                    <button
                      key={pin.text}
                      type="button"
                      onClick={() => {
                        const txt = pin.text;
                        const isCurve = txt.startsWith('c ');
                        const isOpen = txt.startsWith('open');
                        const newPin: DimensionAnnotation = {
                          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                          text: txt,
                          x: isOpen ? (txt.includes('Right') ? 3.0 : -3.0) : isCurve ? 0 : 0,
                          y: isOpen ? heightM * 0.5 : isCurve ? heightM * 0.9 : 2.0,
                        };
                        const nextAnns = [...textAnnotations, newPin];
                        setTextAnnotations(nextAnns);
                        applyAnnotationPinToLiveState(newPin, nextAnns);
                        setHasAnalyzedShape(true);
                      }}
                      className={`px-2.5 py-1 rounded-md font-mono text-[9.5px] font-bold border cursor-pointer transition-all ${
                        pin.color === 'cyan'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                      }`}
                    >
                      +{pin.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard Dimension Pins */}
              <div className="space-y-1 pt-1.5 border-t border-slate-800/60">
                <span className="text-[9px] text-slate-500 font-mono uppercase block">Dimensions &amp; Angles:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'W = 6.0m',
                    'H = 8.0m',
                    'Wall = 3.2m',
                    'Angle = 80°',
                    'W = 9.5m',
                    'H = 7.8m',
                    'Dish = 0.35m',
                  ].map((txt) => (
                    <button
                      key={txt}
                      type="button"
                      onClick={() => {
                        const newPin: DimensionAnnotation = {
                          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                          text: txt,
                          x: txt.startsWith('W') || txt.startsWith('Dish')
                            ? 0
                            : txt.startsWith('H')
                            ? 0
                            : 3.0,
                          y: txt.startsWith('W') || txt.startsWith('Dish')
                            ? 0.4
                            : txt.startsWith('H')
                            ? heightM * 0.9
                            : 2.0,
                        };
                        const nextAnns = [...textAnnotations, newPin];
                        setTextAnnotations(nextAnns);
                        applyAnnotationPinToLiveState(newPin, nextAnns);
                        setHasAnalyzedShape(true);
                      }}
                      className="px-2.5 py-1 rounded-md font-mono text-[9.5px] font-bold border cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 transition-all"
                    >
                      +{txt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accurate Segment Parameter Modal: Prompts immediately after drawing 1 Line or 1 Curve */}
      {pendingSegmentDraft && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 shadow-2xl space-y-3.5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 block">
                    {pendingSegmentDraft.editingSegmentId
                      ? 'Edit Exact CAD Segment Parameters'
                      : 'Enter Exact Parameters for Drawn Segment'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {pendingSegmentDraft.type === 'line'
                      ? 'Straight Line: Specify Exact Length (m) & Angle (°)'
                      : 'Curve / Arch: Specify Exact Length of Curve (m) & Height from Center (m)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelSegmentDraft}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Choose Segment Geometry Type: Straight Line vs Curve / Arc */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                1. Segment Geometry Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPendingSegmentDraft((prev) => (prev ? { ...prev, type: 'line' } : prev))
                  }
                  className={`py-2 px-3 rounded-xl text-xs font-black border cursor-pointer flex items-center justify-center gap-2 transition-all ${
                    pendingSegmentDraft.type === 'line'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>📏 Straight Line (Length &amp; Angle)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPendingSegmentDraft((prev) => (prev ? { ...prev, type: 'arc' } : prev))
                  }
                  className={`py-2 px-3 rounded-xl text-xs font-black border cursor-pointer flex items-center justify-center gap-2 transition-all ${
                    pendingSegmentDraft.type === 'arc'
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>⌒ Curve / Arc (Curve Length &amp; Center Height)</span>
                </button>
              </div>
            </div>

            {/* 2. Exact Dimensions Input: Line (Length & Angle) OR Curve (Length of Curve & Height from Center) */}
            {pendingSegmentDraft.type === 'line' ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-black uppercase text-emerald-300 mb-1">
                      Line Length (m)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={pendingSegmentDraft.lengthInput}
                      onChange={(e) =>
                        setPendingSegmentDraft((prev) =>
                          prev ? { ...prev, lengthInput: e.target.value } : prev
                        )
                      }
                      className="w-full bg-slate-900 border-2 border-emerald-500/50 rounded-lg px-3 py-2 text-sm font-mono font-black text-white focus:border-emerald-400 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-black uppercase text-cyan-300 mb-1">
                      Line Angle (°)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={pendingSegmentDraft.angleInput}
                      onChange={(e) =>
                        setPendingSegmentDraft((prev) =>
                          prev ? { ...prev, angleInput: e.target.value } : prev
                        )
                      }
                      className="w-full bg-slate-900 border-2 border-cyan-500/50 rounded-lg px-3 py-2 text-sm font-mono font-black text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Angle Presets */}
                <div className="space-y-1">
                  <span className="text-[9.5px] text-slate-400 font-mono block">
                    Quick Direction / Batter Angle Presets:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: '↑ Up 90°', deg: '90' },
                      { label: '↗ 80° Wall', deg: '80' },
                      { label: '↗ 60° Gable', deg: '60' },
                      { label: '↗ 45°', deg: '45' },
                      { label: '→ Right 0°', deg: '0' },
                      { label: '↘ -45°', deg: '-45' },
                      { label: '↘ -60° Gable', deg: '-60' },
                      { label: '↓ Down -90°', deg: '-90' },
                      { label: '← Left 180°', deg: '180' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setPendingSegmentDraft((prev) =>
                            prev ? { ...prev, angleInput: preset.deg } : prev
                          )
                        }
                        className={`px-2 py-1 rounded text-[9.5px] font-mono font-bold border cursor-pointer ${
                          pendingSegmentDraft.angleInput === preset.deg
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-black uppercase text-amber-300 mb-1">
                      Length of Curve (C, m)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.2"
                      value={pendingSegmentDraft.lengthInput}
                      onChange={(e) =>
                        setPendingSegmentDraft((prev) =>
                          prev ? { ...prev, lengthInput: e.target.value } : prev
                        )
                      }
                      className="w-full bg-slate-900 border-2 border-amber-500/60 rounded-lg px-3 py-2 text-sm font-mono font-black text-white focus:border-amber-400 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-black uppercase text-purple-300 mb-1">
                      Height from Center (h, m)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={pendingSegmentDraft.heightFromCenterInput}
                      onChange={(e) =>
                        setPendingSegmentDraft((prev) =>
                          prev ? { ...prev, heightFromCenterInput: e.target.value } : prev
                        )
                      }
                      className="w-full bg-slate-900 border-2 border-purple-500/60 rounded-lg px-3 py-2 text-sm font-mono font-black text-white focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Curve Direction & Chord Orientation */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-400 mb-1 font-mono">
                      Curve Rise Direction
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingSegmentDraft((prev) =>
                            prev ? { ...prev, arcDirection: 'outward' } : prev
                          )
                        }
                        className={`py-1.5 rounded text-[10px] font-bold border cursor-pointer ${
                          pendingSegmentDraft.arcDirection === 'outward'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        ⌒ Arch Up/Out
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingSegmentDraft((prev) =>
                            prev ? { ...prev, arcDirection: 'inward' } : prev
                          )
                        }
                        className={`py-1.5 rounded text-[10px] font-bold border cursor-pointer ${
                          pendingSegmentDraft.arcDirection === 'inward'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        ⌣ Dish Down/In
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-400 mb-1 font-mono">
                      Chord Angle (°) (0° = Horizontal)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="1"
                        value={pendingSegmentDraft.angleInput}
                        onChange={(e) =>
                          setPendingSegmentDraft((prev) =>
                            prev ? { ...prev, angleInput: e.target.value } : prev
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingSegmentDraft((prev) =>
                            prev ? { ...prev, angleInput: '0' } : prev
                          )
                        }
                        className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 font-bold cursor-pointer shrink-0"
                        title="Set horizontal chord (0°)"
                      >
                        0° Horiz
                      </button>
                    </div>
                  </div>
                </div>

                {liveDraftSegmentPreview && (
                  <div className="text-[10px] font-mono text-slate-300 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>
                      Solved Span: <strong className="text-emerald-300">{liveDraftSegmentPreview.seg.chordLengthM.toFixed(2)}m</strong>
                    </span>
                    <span>
                      Curve Length: <strong className="text-amber-300">{liveDraftSegmentPreview.seg.lengthM.toFixed(2)}m</strong>
                    </span>
                    <span>
                      Center Height: <strong className="text-purple-300">{liveDraftSegmentPreview.seg.heightFromCenterM.toFixed(2)}m</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Choose Tunnel Portion (Crown, Left Wall, Right Wall, Invert, or Open) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                2. Choose Tunnel Portion
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { id: 'leftWall', label: 'Left Wall' },
                    { id: 'crown', label: 'Crown' },
                    { id: 'rightWall', label: 'Right Wall' },
                    { id: 'invert', label: 'Invert / Floor' },
                    { id: 'open', label: 'Open Void' },
                  ] as const
                ).map((p) => {
                  const active = pendingSegmentDraft.portion === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPendingSegmentDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                portion: p.id,
                                isPortionOpen: p.id === 'open' ? true : prev.isPortionOpen,
                              }
                            : prev
                        )
                      }
                      className={`py-2 px-1.5 rounded-xl text-[10.5px] font-black border cursor-pointer transition-all text-center ${
                        active
                          ? p.id === 'open'
                            ? 'bg-rose-500 text-white border-rose-300 shadow-md'
                            : 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Checkbox to mark selected portion as OPEN (Does NOT reflect on Face Mapping Canvas) */}
              <label className="flex items-center justify-between gap-2 p-2.5 mt-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-rose-500/40">
                <div>
                  <span className="text-xs font-bold text-rose-300 block">
                    Mark this Portion as OPEN (Do Not Reflect on Face Mapping Canvas)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    When checked, this portion is omitted from the Face Mapping Canvas &amp; Unfolded Strip panels.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={pendingSegmentDraft.isPortionOpen || pendingSegmentDraft.portion === 'open'}
                  onChange={(e) =>
                    setPendingSegmentDraft((prev) =>
                      prev ? { ...prev, isPortionOpen: e.target.checked } : prev
                    )
                  }
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer shrink-0"
                />
              </label>
            </div>

            {/* 4. Start Point Chaining / Connection Mode */}
            {cadSegments.length > 0 && !pendingSegmentDraft.editingSegmentId && (
              <div className="space-y-1">
                <label className="text-[9.5px] font-mono uppercase text-slate-400 block">
                  3. Segment Connection
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingSegmentDraft((prev) =>
                        prev ? { ...prev, connectMode: 'chain_prev' } : prev
                      )
                    }
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      pendingSegmentDraft.connectMode === 'chain_prev'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🔗 Connect to Prev End
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingSegmentDraft((prev) =>
                        prev ? { ...prev, connectMode: 'close_to_first' } : prev
                      )
                    }
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      pendingSegmentDraft.connectMode === 'close_to_first'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🔄 Close to First Point
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingSegmentDraft((prev) =>
                        prev ? { ...prev, connectMode: 'drawn_start' } : prev
                      )
                    }
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      pendingSegmentDraft.connectMode === 'drawn_start'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    📍 Use Drawn Start
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCancelSegmentDraft}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSegmentDraft}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {pendingSegmentDraft.editingSegmentId
                    ? 'Update Accurate Segment'
                    : 'Confirm & Draw Accurate Segment'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding text annotation */}
      {showAnnotationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                Add Dimension or Curve Pin
              </span>
              <button
                type="button"
                onClick={() => setShowAnnotationModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Enter length, angle, or curve arc (e.g. <strong className="text-amber-300">&quot;c 10.6m&quot;</strong>, &quot;9.5m&quot;, &quot;Wall: 4.2m&quot;, &quot;85°&quot;):
            </p>
            <input
              type="text"
              value={newAnnotationInput}
              onChange={(e) => setNewAnnotationInput(e.target.value)}
              placeholder="e.g. c 10.6m, 9.5m, 85 deg, Wh=4.2m"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddAnnotationConfirm();
              }}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAnnotationModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAnnotationConfirm}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
              >
                Place Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
