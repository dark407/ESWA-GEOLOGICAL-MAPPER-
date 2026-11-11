import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Minus,
  Spline,
  Move,
  Trash2,
  Undo2,
  RotateCcw,
  CheckCircle2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import {
  BoundaryZoneRole,
  CustomTunnelProfileDefinition,
  ProfileControlPoint,
  ProfileSegment,
  TunnelGeometry,
} from '../types/tunnel';
import {
  buildAuthoritativeCustomTunnelGeometry,
  computeBulgeFromMidpointHandle,
  evaluateArcSegment,
} from '../engine/customProfileEngine';

export type SimpleCadPortionRole = 'leftWall' | 'crown' | 'rightWall' | 'invert';

export interface SimpleCadSegment {
  id: string;
  type: 'line' | 'arc';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Arc bulge (tan(theta/4)): 0 for straight line, non-zero for circular arc */
  bulge: number;
  /** Optional manual override if the user clicks the segment role tag on canvas; otherwise auto-detected */
  roleOverride?: SimpleCadPortionRole;
}

interface SimpleCadShapeBuilderProps {
  initialProfile?: CustomTunnelProfileDefinition | null;
  onApplyProfile: (
    profileDef: CustomTunnelProfileDefinition,
    resolvedGeom: TunnelGeometry
  ) => void;
}

type CadTool = 'line' | 'arc' | 'move' | 'delete';

const ROLE_COLORS: Record<SimpleCadPortionRole, string> = {
  leftWall: '#38bdf8',   // sky-400
  crown: '#a855f7',      // purple-500
  rightWall: '#34d399',  // emerald-400
  invert: '#f59e0b',     // amber-500
};

const ROLE_LABELS: Record<SimpleCadPortionRole, string> = {
  leftWall: 'LEFT WALL',
  crown: 'CROWN',
  rightWall: 'RIGHT WALL',
  invert: 'INVERT',
};

const ROLE_CYCLE: SimpleCadPortionRole[] = ['leftWall', 'crown', 'rightWall', 'invert'];

/**
 * Convert an existing CustomTunnelProfileDefinition into SimpleCadSegments
 * if it has valid controlPoints & segments.
 */
function convertProfileToSimpleCadSegments(
  profile?: CustomTunnelProfileDefinition | null
): SimpleCadSegment[] {
  if (!profile || !profile.controlPoints || !profile.segments || profile.segments.length === 0) {
    return [];
  }
  const vMap = new Map<string, ProfileControlPoint>();
  for (const v of profile.controlPoints) {
    vMap.set(v.id, v);
  }
  const out: SimpleCadSegment[] = [];
  for (const seg of profile.segments) {
    if (seg.zoneRole === 'open') continue;
    const vStart = vMap.get(seg.fromPointId);
    const vEnd = vMap.get(seg.toPointId);
    if (!vStart || !vEnd) continue;
    const len = Math.hypot(vEnd.x - vStart.x, vEnd.y - vStart.y);
    if (len < 1e-3) continue;
    const bulgeVal = seg.type === 'arc' ? Number((seg.arcBulge || 0).toFixed(4)) : 0;
    const validRole: SimpleCadPortionRole | undefined =
      seg.zoneRole === 'leftWall' ||
      seg.zoneRole === 'crown' ||
      seg.zoneRole === 'rightWall' ||
      seg.zoneRole === 'invert'
        ? seg.zoneRole
        : undefined;
    out.push({
      id: seg.id || `cad_seg_${out.length + 1}`,
      type: seg.type === 'arc' && Math.abs(bulgeVal) > 0.005 ? 'arc' : 'line',
      x1: Number(vStart.x.toFixed(3)),
      y1: Number(vStart.y.toFixed(3)),
      x2: Number(vEnd.x.toFixed(3)),
      y2: Number(vEnd.y.toFixed(3)),
      bulge: bulgeVal,
      roleOverride: validRole,
    });
  }
  return out;
}

/**
 * Compute points along a SimpleCadSegment in world (x, y) meters.
 */
function sampleCadSegmentPoints(seg: SimpleCadSegment, numSteps = 24): Array<{ x: number; y: number }> {
  if (seg.type === 'line' || Math.abs(seg.bulge) < 0.005) {
    return [
      { x: seg.x1, y: seg.y1 },
      { x: seg.x2, y: seg.y2 },
    ];
  }
  const evaluated = evaluateArcSegment(
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
    seg.bulge,
    numSteps
  );
  return evaluated.points;
}

/**
 * Compute exact arc length of a SimpleCadSegment in meters.
 */
function computeCadSegmentLength(seg: SimpleCadSegment): number {
  const chord = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  if (seg.type === 'line' || Math.abs(seg.bulge) < 0.005) {
    return chord;
  }
  const evaluated = evaluateArcSegment(
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
    seg.bulge,
    24
  );
  return evaluated.arcLength;
}

/**
 * Auto-detect portion role ('leftWall' | 'crown' | 'rightWall' | 'invert') from spatial position & orientation
 * across all drawn segments. Any role that has no segment assigned stays OPEN.
 */
function autoClassifySegments(
  segments: SimpleCadSegment[]
): Array<SimpleCadSegment & { resolvedRole: SimpleCadPortionRole; lengthM: number }> {
  if (segments.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const segMeta = segments.map((seg) => {
    const pts = sampleCadSegmentPoints(seg, 16);
    let sx = 0;
    let sy = 0;
    let sMinY = Infinity;
    let sMaxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.y < sMinY) sMinY = p.y;
      if (p.y > sMaxY) sMaxY = p.y;
      sx += p.x;
      sy += p.y;
    }
    const midPt = pts[Math.floor(pts.length / 2)] || {
      x: (seg.x1 + seg.x2) * 0.5,
      y: (seg.y1 + seg.y2) * 0.5,
    };
    const dx = Math.abs(seg.x2 - seg.x1);
    const dy = Math.abs(seg.y2 - seg.y1);
    const angleFromHorizontalDeg = (Math.atan2(dy, Math.max(1e-6, dx)) * 180) / Math.PI;
    return {
      seg,
      midX: sx / pts.length,
      midY: sy / pts.length,
      peakMidPt: midPt,
      sMinY,
      sMaxY,
      dx,
      dy,
      angleFromHorizontalDeg,
      lengthM: computeCadSegmentLength(seg),
    };
  });

  const spanH = Math.max(0.1, maxY - minY);
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  return segMeta.map((m) => {
    if (m.seg.roleOverride) {
      return {
        ...m.seg,
        resolvedRole: m.seg.roleOverride,
        lengthM: m.lengthM,
      };
    }

    // Single segment case: classify strictly by angle and position relative to X=0 / Y=0
    if (segments.length === 1) {
      if (m.seg.type === 'arc' && m.peakMidPt.y >= Math.max(m.seg.y1, m.seg.y2) - 0.05) {
        return { ...m.seg, resolvedRole: 'crown', lengthM: m.lengthM };
      }
      if (m.angleFromHorizontalDeg >= 45) {
        const side: SimpleCadPortionRole = m.midX <= 0 ? 'leftWall' : 'rightWall';
        return { ...m.seg, resolvedRole: side, lengthM: m.lengthM };
      } else {
        const horizRole: SimpleCadPortionRole = m.midY > 1.0 ? 'crown' : 'invert';
        return { ...m.seg, resolvedRole: horizRole, lengthM: m.lengthM };
      }
    }

    // Multi-segment classification:
    // 1. Arcs that arch over the upper half are Crown; arcs near the bottom are Invert
    if (m.seg.type === 'arc' && Math.abs(m.seg.bulge) > 0.02) {
      if (m.midY >= centerY - spanH * 0.15) {
        return { ...m.seg, resolvedRole: 'crown', lengthM: m.lengthM };
      }
      if (m.midY <= minY + spanH * 0.25 && m.angleFromHorizontalDeg < 45) {
        return { ...m.seg, resolvedRole: 'invert', lengthM: m.lengthM };
      }
    }

    // 2. Predominantly vertical / steep segments (angle >= 50 deg from horizontal)
    if (m.angleFromHorizontalDeg >= 50) {
      const wallRole: SimpleCadPortionRole = m.midX <= centerX ? 'leftWall' : 'rightWall';
      return { ...m.seg, resolvedRole: wallRole, lengthM: m.lengthM };
    }

    // 3. Predominantly horizontal / shallow segments (angle <= 35 deg from horizontal)
    if (m.angleFromHorizontalDeg <= 35) {
      if (m.midY >= centerY) {
        return { ...m.seg, resolvedRole: 'crown', lengthM: m.lengthM };
      } else {
        const hasHigherSegment = segMeta.some(
          (other) => other.seg.id !== m.seg.id && other.midY > m.midY + 0.25
        );
        return {
          ...m.seg,
          resolvedRole: hasHigherSegment ? 'invert' : 'crown',
          lengthM: m.lengthM,
        };
      }
    }

    // 4. Diagonal / haunch / pitched roof segments (35..50 deg):
    if (m.sMaxY >= maxY - 0.15 * spanH && m.sMinY >= minY + 0.35 * spanH) {
      return { ...m.seg, resolvedRole: 'crown', lengthM: m.lengthM };
    }

    return {
      ...m.seg,
      resolvedRole: m.midX <= centerX ? 'leftWall' : 'rightWall',
      lengthM: m.lengthM,
    };
  });
}

export const SimpleCadShapeBuilder: React.FC<SimpleCadShapeBuilderProps> = ({
  initialProfile,
  onApplyProfile,
}) => {
  const [segments, setSegments] = useState<SimpleCadSegment[]>(() =>
    convertProfileToSimpleCadSegments(initialProfile)
  );
  const [history, setHistory] = useState<SimpleCadSegment[][]>([]);
  const [activeTool, setActiveTool] = useState<CadTool>('line');
  const [snapStepM, setSnapStepM] = useState<number>(0.5);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);

  // Viewport pan & zoom (in SVG pixels vs world meters)
  const [zoom, setZoom] = useState<number>(42); // pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 110 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Active drawing state for Line & 3-Point Arc
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftArcEnd, setDraftArcEnd] = useState<{ x: number; y: number } | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number; snappedToVertex?: boolean }>({
    x: 0,
    y: 0,
  });

  // Active vertex drag state for Move tool
  const [draggingEndpoint, setDraggingEndpoint] = useState<{
    matches: Array<{ segId: string; end: 'start' | 'end' }>;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 960, h: 600 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSvgSize({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cancel active chaining on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftStart(null);
        setDraftArcEnd(null);
        setDraggingEndpoint(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pushHistory = useCallback((prevSegments: SimpleCadSegment[]) => {
    setHistory((h) => [...h.slice(-29), prevSegments]);
  }, []);

  const handleUndo = useCallback(() => {
    if (draftArcEnd) {
      setDraftArcEnd(null);
      return;
    }
    if (draftStart) {
      setDraftStart(null);
      return;
    }
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setSegments(last);
      return h.slice(0, -1);
    });
  }, [draftStart, draftArcEnd]);

  const handleClear = useCallback(() => {
    if (segments.length > 0) {
      pushHistory(segments);
    }
    setSegments([]);
    setDraftStart(null);
    setDraftArcEnd(null);
  }, [segments, pushHistory]);

  // Coordinate conversions between World (m) and SVG screen pixels
  const worldToScreen = useCallback(
    (wx: number, wy: number) => {
      const cx = svgSize.w * 0.5 + pan.x;
      const cy = svgSize.h * 0.55 + pan.y;
      return {
        sx: cx + wx * zoom,
        sy: cy - wy * zoom,
      };
    },
    [svgSize, pan, zoom]
  );

  // Collect all unique vertices for magnetic endpoint snapping
  const existingVertices = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];
    for (const s of segments) {
      if (!pts.some((p) => Math.hypot(p.x - s.x1, p.y - s.y1) < 1e-3)) {
        pts.push({ x: s.x1, y: s.y1 });
      }
      if (!pts.some((p) => Math.hypot(p.x - s.x2, p.y - s.y2) < 1e-3)) {
        pts.push({ x: s.x2, y: s.y2 });
      }
    }
    return pts;
  }, [segments]);

  const screenToSnappedWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0, snappedToVertex: false };
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      const cx = svgSize.w * 0.5 + pan.x;
      const cy = svgSize.h * 0.55 + pan.y;

      const rawX = (px - cx) / zoom;
      const rawY = (cy - py) / zoom;

      // 1. Magnetic snap to existing endpoints within 14px screen radius
      const vertexSnapRadiusM = 14 / zoom;
      for (const v of existingVertices) {
        if (Math.hypot(rawX - v.x, rawY - v.y) <= vertexSnapRadiusM) {
          return { x: v.x, y: v.y, snappedToVertex: true };
        }
      }

      // 2. Grid snap if enabled
      if (snapEnabled && snapStepM > 0) {
        const sx = Math.round(rawX / snapStepM) * snapStepM;
        const sy = Math.round(rawY / snapStepM) * snapStepM;
        return {
          x: Number(sx.toFixed(3)),
          y: Number(sy.toFixed(3)),
          snappedToVertex: false,
        };
      }

      return {
        x: Number(rawX.toFixed(2)),
        y: Number(rawY.toFixed(2)),
        snappedToVertex: false,
      };
    },
    [svgSize, pan, zoom, existingVertices, snapEnabled, snapStepM]
  );

  // Auto-classified segments & portion metrics
  const classifiedSegments = useMemo(() => autoClassifySegments(segments), [segments]);

  const portionSummary = useMemo(() => {
    const totals: Record<SimpleCadPortionRole, { count: number; lengthM: number }> = {
      leftWall: { count: 0, lengthM: 0 },
      crown: { count: 0, lengthM: 0 },
      rightWall: { count: 0, lengthM: 0 },
      invert: { count: 0, lengthM: 0 },
    };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const seg of classifiedSegments) {
      totals[seg.resolvedRole].count += 1;
      totals[seg.resolvedRole].lengthM += seg.lengthM;
      const pts = sampleCadSegmentPoints(seg, 16);
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const widthM = classifiedSegments.length > 0 ? Math.max(0, maxX - minX) : 0;
    const heightM = classifiedSegments.length > 0 ? Math.max(0, maxY - minY) : 0;

    // Count near-miss endpoint gaps (0.02m .. 0.65m) that can be auto-snapped
    let nearGapCount = 0;
    const endpoints: Array<{ segIdx: number; end: 'start' | 'end'; x: number; y: number }> = [];
    classifiedSegments.forEach((seg, idx) => {
      endpoints.push({ segIdx: idx, end: 'start', x: seg.x1, y: seg.y1 });
      endpoints.push({ segIdx: idx, end: 'end', x: seg.x2, y: seg.y2 });
    });
    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        if (endpoints[i].segIdx === endpoints[j].segIdx) continue;
        const d = Math.hypot(endpoints[i].x - endpoints[j].x, endpoints[i].y - endpoints[j].y);
        if (d > 0.015 && d <= 0.65) {
          nearGapCount += 1;
        }
      }
    }

    const isValidDimensions = widthM >= 0.5 && heightM >= 0.5;
    const activePortionsCount =
      (totals.leftWall.count > 0 ? 1 : 0) +
      (totals.crown.count > 0 ? 1 : 0) +
      (totals.rightWall.count > 0 ? 1 : 0) +
      (totals.invert.count > 0 ? 1 : 0);

    return {
      totals,
      widthM,
      heightM,
      hasLeftWall: totals.leftWall.count > 0,
      hasCrown: totals.crown.count > 0,
      hasRightWall: totals.rightWall.count > 0,
      hasInvert: totals.invert.count > 0,
      nearGapCount,
      isValidDimensions,
      activePortionsCount,
    };
  }, [classifiedSegments]);

  const handleAutoSnapNearGaps = useCallback(() => {
    if (segments.length < 2) return;
    pushHistory(segments);
    const next = segments.map((s) => ({ ...s }));
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const pairs: Array<['start' | 'end', 'start' | 'end']> = [
          ['start', 'start'],
          ['start', 'end'],
          ['end', 'start'],
          ['end', 'end'],
        ];
        for (const [e1, e2] of pairs) {
          const x1 = e1 === 'start' ? next[i].x1 : next[i].x2;
          const y1 = e1 === 'start' ? next[i].y1 : next[i].y2;
          const x2 = e2 === 'start' ? next[j].x1 : next[j].x2;
          const y2 = e2 === 'start' ? next[j].y1 : next[j].y2;
          const d = Math.hypot(x1 - x2, y1 - y2);
          if (d > 0.01 && d <= 0.65) {
            if (e2 === 'start') {
              next[j].x1 = x1;
              next[j].y1 = y1;
            } else {
              next[j].x2 = x1;
              next[j].y2 = y1;
            }
          }
        }
      }
    }
    setSegments(next);
  }, [segments, pushHistory]);

  // Cycle a segment's role if the user clicks its on-canvas role tag
  const handleCycleSegmentRole = useCallback(
    (segId: string, currentRole: SimpleCadPortionRole, e: React.MouseEvent) => {
      e.stopPropagation();
      pushHistory(segments);
      const nextIdx = (ROLE_CYCLE.indexOf(currentRole) + 1) % ROLE_CYCLE.length;
      const nextRole = ROLE_CYCLE[nextIdx];
      setSegments((prev) =>
        prev.map((s) => (s.id === segId ? { ...s, roleOverride: nextRole } : s))
      );
    },
    [segments, pushHistory]
  );

  // Pointer handlers on CAD SVG
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button === 1 || e.button === 2) {
        if (draftStart || draftArcEnd) {
          setDraftStart(null);
          setDraftArcEnd(null);
          return;
        }
        setIsPanning(true);
        panStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
        return;
      }

      if (e.button !== 0) return;

      const pt = screenToSnappedWorld(e.clientX, e.clientY);

      if (activeTool === 'line') {
        if (!draftStart) {
          setDraftStart({ x: pt.x, y: pt.y });
        } else {
          const len = Math.hypot(pt.x - draftStart.x, pt.y - draftStart.y);
          if (len >= 0.05) {
            pushHistory(segments);
            const newSeg: SimpleCadSegment = {
              id: `cad_seg_${Date.now()}_${segments.length + 1}`,
              type: 'line',
              x1: draftStart.x,
              y1: draftStart.y,
              x2: pt.x,
              y2: pt.y,
              bulge: 0,
            };
            setSegments((prev) => [...prev, newSeg]);
            const closedLoop =
              segments.length >= 2 &&
              existingVertices.some((v) => Math.hypot(v.x - pt.x, v.y - pt.y) < 1e-3);
            setDraftStart(closedLoop ? null : { x: pt.x, y: pt.y });
          }
        }
        return;
      }

      if (activeTool === 'arc') {
        if (!draftStart) {
          setDraftStart({ x: pt.x, y: pt.y });
          setDraftArcEnd(null);
        } else if (!draftArcEnd) {
          const chord = Math.hypot(pt.x - draftStart.x, pt.y - draftStart.y);
          if (chord >= 0.1) {
            setDraftArcEnd({ x: pt.x, y: pt.y });
          }
        } else {
          const bulge = computeBulgeFromMidpointHandle(draftStart, draftArcEnd, pt);
          pushHistory(segments);
          const newSeg: SimpleCadSegment = {
            id: `cad_seg_${Date.now()}_${segments.length + 1}`,
            type: Math.abs(bulge) >= 0.01 ? 'arc' : 'line',
            x1: draftStart.x,
            y1: draftStart.y,
            x2: draftArcEnd.x,
            y2: draftArcEnd.y,
            bulge: Math.abs(bulge) >= 0.01 ? bulge : 0,
          };
          setSegments((prev) => [...prev, newSeg]);
          setDraftStart({ x: draftArcEnd.x, y: draftArcEnd.y });
          setDraftArcEnd(null);
        }
        return;
      }

      if (activeTool === 'move') {
        const hitRadiusM = 16 / zoom;
        const matches: Array<{ segId: string; end: 'start' | 'end' }> = [];
        for (const s of segments) {
          if (Math.hypot(s.x1 - pt.x, s.y1 - pt.y) <= hitRadiusM) {
            matches.push({ segId: s.id, end: 'start' });
          }
          if (Math.hypot(s.x2 - pt.x, s.y2 - pt.y) <= hitRadiusM) {
            matches.push({ segId: s.id, end: 'end' });
          }
        }
        if (matches.length > 0) {
          pushHistory(segments);
          setDraggingEndpoint({ matches });
        } else {
          setIsPanning(true);
          panStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }
      }
    },
    [
      activeTool,
      draftStart,
      draftArcEnd,
      pan,
      zoom,
      segments,
      existingVertices,
      screenToSnappedWorld,
      pushHistory,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        });
        return;
      }

      const pt = screenToSnappedWorld(e.clientX, e.clientY);
      setCursorWorld(pt);

      if (draggingEndpoint) {
        setSegments((prev) =>
          prev.map((s) => {
            let next = s;
            for (const m of draggingEndpoint.matches) {
              if (m.segId === s.id) {
                if (m.end === 'start') {
                  next = { ...next, x1: pt.x, y1: pt.y };
                } else {
                  next = { ...next, x2: pt.x, y2: pt.y };
                }
              }
            }
            return next;
          })
        );
      }
    },
    [isPanning, draggingEndpoint, screenToSnappedWorld]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
    setDraggingEndpoint(null);
  }, []);

  const handleSegmentClick = useCallback(
    (segId: string, e: React.MouseEvent) => {
      if (activeTool === 'delete') {
        e.stopPropagation();
        pushHistory(segments);
        setSegments((prev) => prev.filter((s) => s.id !== segId));
      }
    },
    [activeTool, segments, pushHistory]
  );

  // Build authoritative CustomTunnelProfileDefinition & TunnelGeometry when applying
  const handleApplyToCanvas = useCallback(() => {
    if (classifiedSegments.length === 0) return;

    // Order segments spatially along perimeter (leftWall bottom-up -> crown left-to-right -> rightWall top-down -> invert right-to-left)
    const roleOrder: Record<SimpleCadPortionRole, number> = {
      leftWall: 0,
      crown: 1,
      rightWall: 2,
      invert: 3,
    };
    const orderedSegs = [...classifiedSegments].sort((a, b) => {
      if (roleOrder[a.resolvedRole] !== roleOrder[b.resolvedRole]) {
        return roleOrder[a.resolvedRole] - roleOrder[b.resolvedRole];
      }
      const midAx = (a.x1 + a.x2) * 0.5;
      const midAy = (a.y1 + a.y2) * 0.5;
      const midBx = (b.x1 + b.x2) * 0.5;
      const midBy = (b.y1 + b.y2) * 0.5;
      if (a.resolvedRole === 'leftWall') return midAy - midBy;
      if (a.resolvedRole === 'crown') return midAx - midBx;
      if (a.resolvedRole === 'rightWall') return midBy - midAy;
      return midBx - midAx;
    });

    const controlPoints: ProfileControlPoint[] = [];
    const findOrCreatePoint = (x: number, y: number): string => {
      const existing = controlPoints.find((v) => Math.hypot(v.x - x, v.y - y) < 0.03);
      if (existing) return existing.id;
      const id = `pt_${controlPoints.length + 1}`;
      controlPoints.push({
        id,
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        label: `P${controlPoints.length + 1}`,
      });
      return id;
    };

    const profileSegments: ProfileSegment[] = orderedSegs.map((seg, idx) => {
      // Ensure segment orientation follows perimeter progression (Left Wall up, Crown right, Right Wall down)
      let sx1 = seg.x1;
      let sy1 = seg.y1;
      let sx2 = seg.x2;
      let sy2 = seg.y2;
      let sBulge = seg.type === 'arc' ? seg.bulge : 0;

      if (
        (seg.resolvedRole === 'leftWall' && sy1 > sy2) ||
        (seg.resolvedRole === 'crown' && sx1 > sx2) ||
        (seg.resolvedRole === 'rightWall' && sy1 < sy2) ||
        (seg.resolvedRole === 'invert' && sx1 < sx2)
      ) {
        sx1 = seg.x2;
        sy1 = seg.y2;
        sx2 = seg.x1;
        sy2 = seg.y1;
        sBulge = -sBulge;
      }

      const fromPointId = findOrCreatePoint(sx1, sy1);
      const toPointId = findOrCreatePoint(sx2, sy2);
      const zoneRole: BoundaryZoneRole = seg.resolvedRole;
      return {
        id: seg.id || `seg_${idx + 1}`,
        fromPointId,
        toPointId,
        type: seg.type,
        arcBulge: sBulge,
        zoneRole,
        includeInTopStrip: zoneRole !== 'invert',
      };
    });

    const isClosed =
      portionSummary.hasLeftWall &&
      portionSummary.hasCrown &&
      portionSummary.hasRightWall &&
      portionSummary.hasInvert;

    const profileDef: CustomTunnelProfileDefinition = {
      id: initialProfile?.id || `simple_cad_${Date.now()}`,
      name: initialProfile?.name || 'Simple CAD Profile',
      category: 'freeform_polygon',
      isClosed,
      controlPoints,
      segments: profileSegments,
      surfaceConfig: {
        hasLeftWall: portionSummary.hasLeftWall,
        hasCrown: portionSummary.hasCrown,
        hasRightWall: portionSummary.hasRightWall,
        hasInvert: portionSummary.hasInvert,
      },
      version: 'v1.0',
      updatedAt: new Date().toISOString(),
    };

    const resolvedGeom = buildAuthoritativeCustomTunnelGeometry(profileDef, {
      source: 'custom_profile',
    });
    onApplyProfile(profileDef, resolvedGeom);
  }, [classifiedSegments, portionSummary, initialProfile, onApplyProfile]);

  // Grid lines calculation in world meters
  const gridRangeM = 20;
  const gridLines = useMemo(() => {
    const lines: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isAxis: boolean;
      isMajor: boolean;
      label?: string;
      worldVal?: number;
      axisType?: 'x' | 'y';
    }> = [];

    for (let x = -gridRangeM; x <= gridRangeM; x += 0.5) {
      const isInteger = Math.abs(x - Math.round(x)) < 1e-4;
      if (!isInteger && zoom < 28) continue;
      const p1 = worldToScreen(x, -gridRangeM);
      const p2 = worldToScreen(x, gridRangeM);
      lines.push({
        x1: p1.sx,
        y1: p1.sy,
        x2: p2.sx,
        y2: p2.sy,
        isAxis: Math.abs(x) < 1e-4,
        isMajor: isInteger,
        label: isInteger ? `${x}m` : undefined,
        worldVal: x,
        axisType: 'x',
      });
    }

    for (let y = -gridRangeM; y <= gridRangeM; y += 0.5) {
      const isInteger = Math.abs(y - Math.round(y)) < 1e-4;
      if (!isInteger && zoom < 28) continue;
      const p1 = worldToScreen(-gridRangeM, y);
      const p2 = worldToScreen(gridRangeM, y);
      lines.push({
        x1: p1.sx,
        y1: p1.sy,
        x2: p2.sx,
        y2: p2.sy,
        isAxis: Math.abs(y) < 1e-4,
        isMajor: isInteger,
        label: isInteger ? `${y}m` : undefined,
        worldVal: y,
        axisType: 'y',
      });
    }

    return lines;
  }, [worldToScreen, zoom]);

  // Live preview segment while drawing Line or Arc
  const liveDraftPreview = useMemo(() => {
    if (!draftStart) return null;

    if (activeTool === 'line') {
      const p1 = worldToScreen(draftStart.x, draftStart.y);
      const p2 = worldToScreen(cursorWorld.x, cursorWorld.y);
      const dx = cursorWorld.x - draftStart.x;
      const dy = cursorWorld.y - draftStart.y;
      const lengthM = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      return {
        mode: 'line' as const,
        svgPath: `M ${p1.sx} ${p1.sy} L ${p2.sx} ${p2.sy}`,
        midScreen: { sx: (p1.sx + p2.sx) * 0.5, sy: (p1.sy + p2.sy) * 0.5 },
        label: `${lengthM.toFixed(2)}m  ∠${angleDeg.toFixed(1)}°`,
      };
    }

    if (activeTool === 'arc') {
      if (!draftArcEnd) {
        const p1 = worldToScreen(draftStart.x, draftStart.y);
        const p2 = worldToScreen(cursorWorld.x, cursorWorld.y);
        const chordM = Math.hypot(cursorWorld.x - draftStart.x, cursorWorld.y - draftStart.y);
        return {
          mode: 'arc_chord' as const,
          svgPath: `M ${p1.sx} ${p1.sy} L ${p2.sx} ${p2.sy}`,
          midScreen: { sx: (p1.sx + p2.sx) * 0.5, sy: (p1.sy + p2.sy) * 0.5 },
          label: `Chord ${chordM.toFixed(2)}m (Click Arc End)`,
        };
      } else {
        const bulge = computeBulgeFromMidpointHandle(draftStart, draftArcEnd, cursorWorld);
        const tempSeg: SimpleCadSegment = {
          id: 'draft_arc',
          type: Math.abs(bulge) >= 0.01 ? 'arc' : 'line',
          x1: draftStart.x,
          y1: draftStart.y,
          x2: draftArcEnd.x,
          y2: draftArcEnd.y,
          bulge,
        };
        const pts = sampleCadSegmentPoints(tempSeg, 28);
        const screenPts = pts.map((p) => worldToScreen(p.x, p.y));
        const svgPath = screenPts
          .map((sp, i) => `${i === 0 ? 'M' : 'L'} ${sp.sx.toFixed(1)} ${sp.sy.toFixed(1)}`)
          .join(' ');
        const arcLen = computeCadSegmentLength(tempSeg);
        const midSp = screenPts[Math.floor(screenPts.length / 2)] || { sx: 0, sy: 0 };
        const chord = Math.hypot(draftArcEnd.x - draftStart.x, draftArcEnd.y - draftStart.y);
        const riseM = Math.abs(bulge * chord * 0.5);
        return {
          mode: 'arc_curve' as const,
          svgPath,
          midScreen: midSp,
          label: `Arc ${arcLen.toFixed(2)}m | Rise ${riseM.toFixed(2)}m`,
        };
      }
    }

    return null;
  }, [activeTool, draftStart, draftArcEnd, cursorWorld, worldToScreen]);

  const originScreen = worldToScreen(0, 0);
  const cursorScreen = worldToScreen(cursorWorld.x, cursorWorld.y);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-120px)] min-h-[580px] bg-slate-950 select-none overflow-hidden">
      {/* Compact Single-Row CAD Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 flex-wrap">
        {/* Left: Core CAD Drawing Tools */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTool('line');
              setDraftStart(null);
              setDraftArcEnd(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'line'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-900/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Draw straight line segments on grid (Click start, click end)"
          >
            <Minus className="w-3.5 h-3.5" />
            Line
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('arc');
              setDraftStart(null);
              setDraftArcEnd(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'arc'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Draw curved arc (1. Click start -> 2. Click end -> 3. Move cursor to curve & click)"
          >
            <Spline className="w-3.5 h-3.5" />
            Arc (3-Point)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('move');
              setDraftStart(null);
              setDraftArcEnd(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'move'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Drag any vertex on grid or pan view"
          >
            <Move className="w-3.5 h-3.5" />
            Move Vertex
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('delete');
              setDraftStart(null);
              setDraftArcEnd(null);
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'delete'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Click any drawn line or arc to delete it"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Line
          </button>

          {(draftStart || draftArcEnd) && (
            <button
              type="button"
              onClick={() => {
                setDraftStart(null);
                setDraftArcEnd(null);
              }}
              className="ml-1 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer"
            >
              Stop Chain (Esc)
            </button>
          )}
        </div>

        {/* Center: Grid Snap & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/90 rounded p-0.5 border border-slate-700/70">
            <button
              type="button"
              onClick={() => setSnapEnabled((v) => !v)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                snapEnabled ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle grid & endpoint magnetic snap"
            >
              <Magnet className="w-3 h-3" />
              Snap
            </button>
            {[0.5, 0.25, 0.1].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  setSnapEnabled(true);
                  setSnapStepM(step);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                  snapEnabled && snapStepM === step
                    ? 'bg-slate-700 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {step}m
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-800/90 rounded p-0.5 border border-slate-700/70">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(100, Math.round(z * 1.2)))}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(18, Math.round(z / 1.2)))}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(42);
                setPan({ x: 0, y: 110 });
              }}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Reset CAD View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Undo, Clear & Apply Shape CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0 && !draftStart}
            className="px-2.5 py-1.5 rounded text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={segments.length === 0 && !draftStart}
            className="px-2.5 py-1.5 rounded text-xs font-bold bg-slate-800 text-rose-300 hover:bg-rose-950/60 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            type="button"
            onClick={handleApplyToCanvas}
            disabled={classifiedSegments.length === 0}
            className="px-4 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-md shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Apply Shape to Canvas
          </button>
        </div>
      </div>

      {/* Main Full-Width 1m CAD Coordinate Grid Canvas */}
      <div className="relative flex-1 w-full h-full bg-[#070b14] overflow-hidden">
        <svg
          ref={svgRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full h-full block ${
            activeTool === 'delete'
              ? 'cursor-pointer'
              : activeTool === 'move'
              ? 'cursor-move'
              : 'cursor-crosshair'
          }`}
        >
          {/* 1m & 0.5m Coordinate Grid */}
          <g>
            {gridLines.map((gl, idx) => (
              <line
                key={idx}
                x1={gl.x1}
                y1={gl.y1}
                x2={gl.x2}
                y2={gl.y2}
                stroke={gl.isAxis ? '#334155' : gl.isMajor ? '#1e293b' : '#0f172a'}
                strokeWidth={gl.isAxis ? 1.6 : gl.isMajor ? 1 : 0.6}
                strokeDasharray={gl.isAxis ? '5,3' : undefined}
              />
            ))}

            {/* 1m Grid Axis Labels */}
            {gridLines
              .filter((gl) => gl.isMajor && gl.label && gl.worldVal !== 0)
              .map((gl, idx) => {
                if (gl.axisType === 'x') {
                  return (
                    <text
                      key={`lbl_x_${idx}`}
                      x={gl.x1}
                      y={Math.min(svgSize.h - 10, Math.max(18, originScreen.sy + 14))}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {gl.label}
                    </text>
                  );
                }
                return (
                  <text
                    key={`lbl_y_${idx}`}
                    x={Math.min(svgSize.w - 28, Math.max(8, originScreen.sx + 6))}
                    y={gl.y1 + 3}
                    textAnchor="start"
                    fill="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {gl.label}
                  </text>
                );
              })}

            {/* Origin (0,0) Marker */}
            <circle
              cx={originScreen.sx}
              cy={originScreen.sy}
              r={4}
              fill="#0ea5e9"
              fillOpacity={0.35}
              stroke="#38bdf8"
              strokeWidth={1.2}
            />
            <text
              x={originScreen.sx + 7}
              y={originScreen.sy + 13}
              fill="#38bdf8"
              fontSize={10}
              fontFamily="monospace"
              fontWeight="bold"
            >
              (0,0) Center Invert
            </text>
          </g>

          {/* Drawn CAD Segments */}
          <g>
            {classifiedSegments.map((seg) => {
              const pts = sampleCadSegmentPoints(seg, 28);
              const screenPts = pts.map((p) => worldToScreen(p.x, p.y));
              const pathD = screenPts
                .map((sp, i) => `${i === 0 ? 'M' : 'L'} ${sp.sx.toFixed(1)} ${sp.sy.toFixed(1)}`)
                .join(' ');
              const strokeColor = ROLE_COLORS[seg.resolvedRole];
              const midPt = screenPts[Math.floor(screenPts.length / 2)] || screenPts[0];

              return (
                <g key={seg.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    onClick={(e) => handleSegmentClick(seg.id, e)}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    onClick={(e) => handleSegmentClick(seg.id, e)}
                  />

                  {/* Segment Length + Clickable Portion Role Tag */}
                  {midPt && (
                    <g
                      transform={`translate(${midPt.sx}, ${midPt.sy - 10})`}
                      onClick={(e) =>
                        activeTool === 'delete'
                          ? handleSegmentClick(seg.id, e)
                          : handleCycleSegmentRole(seg.id, seg.resolvedRole, e)
                      }
                      className="cursor-pointer"
                    >
                      <rect
                        x={-54}
                        y={-12}
                        width={108}
                        height={18}
                        rx={4}
                        fill="#0f172a"
                        fillOpacity={0.92}
                        stroke={strokeColor}
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize={9.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {ROLE_LABELS[seg.resolvedRole]} {seg.lengthM.toFixed(2)}m
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Drawn Vertex Handles */}
          <g>
            {existingVertices.map((v, i) => {
              const sp = worldToScreen(v.x, v.y);
              return (
                <g key={`v_${i}`}>
                  <circle
                    cx={sp.sx}
                    cy={sp.sy}
                    r={5}
                    fill="#0f172a"
                    stroke="#f8fafc"
                    strokeWidth={2}
                  />
                  <text
                    x={sp.sx + 8}
                    y={sp.sy - 6}
                    fill="#94a3b8"
                    fontSize={9.5}
                    fontFamily="monospace"
                  >
                    ({v.x.toFixed(2)}, {v.y.toFixed(2)})
                  </text>
                </g>
              );
            })}
          </g>

          {/* Live Rubber-Band Line / Arc Preview */}
          {liveDraftPreview && (
            <g>
              <path
                d={liveDraftPreview.svgPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2.4}
                strokeDasharray="6,4"
              />
              <g
                transform={`translate(${liveDraftPreview.midScreen.sx}, ${
                  liveDraftPreview.midScreen.sy - 14
                })`}
              >
                <rect x={-75} y={-12} width={150} height={20} rx={4} fill="#0284c7" />
                <text
                  x={0}
                  y={2}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {liveDraftPreview.label}
                </text>
              </g>
            </g>
          )}

          {/* Snapped Cursor Crosshair */}
          {(activeTool === 'line' || activeTool === 'arc' || activeTool === 'move') && (
            <g pointerEvents="none">
              <circle
                cx={cursorScreen.sx}
                cy={cursorScreen.sy}
                r={cursorWorld.snappedToVertex ? 7 : 4.5}
                fill="none"
                stroke={cursorWorld.snappedToVertex ? '#22c55e' : '#38bdf8'}
                strokeWidth={2}
              />
              <text
                x={cursorScreen.sx + 10}
                y={cursorScreen.sy + 16}
                fill={cursorWorld.snappedToVertex ? '#4ade80' : '#7dd3fc'}
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
              >
                X:{cursorWorld.x.toFixed(2)}m Y:{cursorWorld.y.toFixed(2)}m
                {cursorWorld.snappedToVertex ? ' [SNAP]' : ''}
              </text>
            </g>
          )}
        </svg>

        {/* Minimal Bottom-Left CAD Status HUD: Drawn Size, Validation Status & Open vs Active Sides */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-slate-900/95 border border-slate-800 text-xs font-mono pointer-events-auto flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-300 font-bold">
              SPAN W:{' '}
              <span className="text-sky-400">{portionSummary.widthM.toFixed(2)}m</span>
            </span>
            <span className="text-slate-300 font-bold">
              HEIGHT H:{' '}
              <span className="text-sky-400">{portionSummary.heightM.toFixed(2)}m</span>
            </span>
            {classifiedSegments.length > 0 && (
              <span
                className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                  portionSummary.isValidDimensions
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                }`}
              >
                {portionSummary.isValidDimensions
                  ? `3D PROFILE VALIDATED (${portionSummary.activePortionsCount}/4 SIDES ACTIVE)`
                  : 'MIN 0.5m SPAN/HEIGHT REQUIRED'}
              </span>
            )}
            {portionSummary.nearGapCount > 0 && (
              <button
                type="button"
                onClick={handleAutoSnapNearGaps}
                className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                title="Automatically snap nearby unconnected endpoints within 0.65m"
              >
                Auto-Snap {portionSummary.nearGapCount} Gap(s)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {ROLE_CYCLE.map((role) => {
              const info = portionSummary.totals[role];
              const isOpen = info.count === 0;
              return (
                <span
                  key={role}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isOpen ? '#475569' : ROLE_COLORS[role] }}
                  />
                  <span className="text-slate-300 font-semibold">{ROLE_LABELS[role]}:</span>
                  {isOpen ? (
                    <span className="text-amber-400 font-bold">OPEN (No Line)</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">
                      {info.lengthM.toFixed(2)}m
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
