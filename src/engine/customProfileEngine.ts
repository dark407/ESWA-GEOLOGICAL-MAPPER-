import {
  BoundaryZoneRole,
  ChainageProfileSegmentRecord,
  CustomSegmentType,
  CustomTunnelProfileDefinition,
  Point2D,
  ProfileControlPoint,
  ProfileSegment,
  ProfileType,
  SurveyControlPoint,
  TunnelGeometry,
} from '../types/tunnel';

const CHAINAGE_PROFILE_SCHEDULE_KEY = 'eswa_tunnel_chainage_profile_schedule_v20_fresh';

// ============================================================================
// 1. MULTI-SPACE COORDINATE SYSTEM FOR CUSTOM PROFILE EDITOR
//    SCREEN <-> CANVAS <-> LOCAL PROFILE <-> TUNNEL/WORLD COORDINATES
// ============================================================================

export interface ProfileEditorStageMetrics {
  viewW: number;
  viewH: number;
  padPx: number;
  pxPerMeter: number;
  originCanvasX: number; // Canvas X corresponding to Local Profile x = 0m
  originCanvasY: number; // Canvas Y corresponding to Local Profile y = 0m
  zoom: number;
  panX: number;
  panY: number;
}

export function computeProfileEditorStage(
  points: Point2D[],
  zoom = 1,
  panX = 0,
  panY = 0,
  viewW = 860,
  viewH = 580,
  padPx = 68
): ProfileEditorStageMetrics {
  let minX = -6;
  let maxX = 6;
  let minY = -0.5;
  let maxY = 10;

  if (points.length >= 2) {
    minX = Math.min(...points.map((p) => p.x));
    maxX = Math.max(...points.map((p) => p.x));
    minY = Math.min(0, ...points.map((p) => p.y));
    maxY = Math.max(...points.map((p) => p.y));
  }

  const spanW = Math.max(4, maxX - minX);
  const spanH = Math.max(4, maxY - minY);

  const availW = Math.max(200, viewW - padPx * 2);
  const availH = Math.max(200, viewH - padPx * 2);
  const basePxPerMeter = Math.min(availW / spanW, availH / spanH);
  const pxPerMeter = basePxPerMeter * Math.max(0.2, Math.min(8, zoom));

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const originCanvasX = viewW / 2 - midX * pxPerMeter + panX;
  const originCanvasY = viewH / 2 + midY * pxPerMeter + panY;

  return {
    viewW,
    viewH,
    padPx,
    pxPerMeter,
    originCanvasX,
    originCanvasY,
    zoom,
    panX,
    panY,
  };
}

/**
 * LOCAL PROFILE / TUNNEL WORLD METERS (x, y) -> SVG CANVAS COORDINATES (cx, cy)
 */
export function profileMetersToCanvasPx(
  pt: Point2D,
  stage: ProfileEditorStageMetrics
): { cx: number; cy: number } {
  return {
    cx: Number((stage.originCanvasX + pt.x * stage.pxPerMeter).toFixed(2)),
    cy: Number((stage.originCanvasY - pt.y * stage.pxPerMeter).toFixed(2)),
  };
}

/**
 * SVG CANVAS COORDINATES (cx, cy) -> LOCAL PROFILE / TUNNEL WORLD METERS (x, y)
 */
export function canvasPxToProfileMeters(
  cx: number,
  cy: number,
  stage: ProfileEditorStageMetrics
): Point2D {
  return {
    x: Number(((cx - stage.originCanvasX) / stage.pxPerMeter).toFixed(3)),
    y: Number(((stage.originCanvasY - cy) / stage.pxPerMeter).toFixed(3)),
  };
}

/**
 * SCREEN PIXELS (clientX, clientY) -> SVG CANVAS COORDINATES (cx, cy) -> PROFILE METERS (x, y)
 */
export function screenClientToProfileMeters(
  clientX: number,
  clientY: number,
  svgEl: SVGSVGElement,
  stage: ProfileEditorStageMetrics
): { cx: number; cy: number; x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  const safeW = Math.max(1, rect.width);
  const safeH = Math.max(1, rect.height);
  const scaleX = safeW / stage.viewW;
  const scaleY = safeH / stage.viewH;
  const meetScale = Math.min(scaleX, scaleY);
  const renderedW = stage.viewW * meetScale;
  const renderedH = stage.viewH * meetScale;
  const left = rect.left + (safeW - renderedW) / 2;
  const top = rect.top + (safeH - renderedH) / 2;

  const cx = (clientX - left) / meetScale;
  const cy = (clientY - top) / meetScale;
  const meters = canvasPxToProfileMeters(cx, cy, stage);

  return {
    cx,
    cy,
    x: meters.x,
    y: meters.y,
  };
}

// ============================================================================
// 2. ANALYTICAL ARC & BEZIER CURVE MATHEMATICS
// ============================================================================

export interface EvaluatedArcGeometry {
  points: Point2D[];
  chordLength: number;
  arcLength: number;
  radius: number;
  bulge: number;
  center: Point2D;
  midApexPoint: Point2D;
}

/**
 * Evaluates a circular arc between `p1` and `p2` defined by bulge `b = tan(theta / 4)`.
 * Note: For clockwise boundary traversal (left wall -> crown -> right wall -> invert),
 * a positive bulge curves outward/convex (to the left of vector p1->p2 in Y-up coords).
 */
export function evaluateArcSegment(
  p1: Point2D,
  p2: Point2D,
  rawBulge = 0.35,
  numSteps = 24
): EvaluatedArcGeometry {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);

  if (chord < 1e-5 || Math.abs(rawBulge) < 1e-4) {
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return {
      points: [p1, p2],
      chordLength: Number(chord.toFixed(4)),
      arcLength: Number(chord.toFixed(4)),
      radius: 9999,
      bulge: 0,
      center: mid,
      midApexPoint: mid,
    };
  }

  const b = Math.max(-2.5, Math.min(2.5, rawBulge));
  const absB = Math.abs(b);
  const sign = b >= 0 ? 1 : -1;

  // Outward normal (left of directed chord p1->p2 in Y-up coordinates is (-dy, dx)/chord)
  const nx = (-dy / chord) * sign;
  const ny = (dx / chord) * sign;

  // Sagitta (arc rise from chord midpoint) s = |b| * (chord / 2)
  const sagitta = absB * (chord / 2);
  const radius = (chord * (1 + b * b)) / (4 * absB);
  const halfTheta = 2 * Math.atan(absB);
  const arcLength = radius * (2 * halfTheta);

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  // Apex midpoint on the arc
  const midApexPoint: Point2D = {
    x: Number((midX + nx * sagitta).toFixed(4)),
    y: Number((midY + ny * sagitta).toFixed(4)),
  };

  // Circle center is at distance (radius - sagitta) in the opposite direction of normal
  const centerOffset = radius - sagitta;
  const centerX = midX - nx * centerOffset;
  const centerY = midY - ny * centerOffset;

  const startAngle = Math.atan2(p1.y - centerY, p1.x - centerX);
  // Directed sweep angle from p1 to p2:
  // Since normal is (-dy, dx) * sign, sweeping from p1 to p2 goes clockwise when sign > 0
  const totalSweep = -sign * (2 * halfTheta);

  const points: Point2D[] = [];
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const ang = startAngle + t * totalSweep;
    points.push({
      x: Number((centerX + radius * Math.cos(ang)).toFixed(4)),
      y: Number((centerY + radius * Math.sin(ang)).toFixed(4)),
    });
  }

  return {
    points,
    chordLength: Number(chord.toFixed(4)),
    arcLength: Number(arcLength.toFixed(4)),
    radius: Number(radius.toFixed(4)),
    bulge: Number(b.toFixed(4)),
    center: { x: Number(centerX.toFixed(4)), y: Number(centerY.toFixed(4)) },
    midApexPoint,
  };
}

/**
 * Computes arc bulge `b = tan(theta/4)` from a user-specified radius `R` (m) and chord length `c` (m).
 */
export function computeBulgeFromRadius(
  chordLength: number,
  radiusMeters: number,
  sign = 1
): number {
  if (chordLength < 1e-4) return 0;
  const minR = chordLength / 2 + 0.001;
  const safeR = Math.max(minR, radiusMeters);
  const sagitta = safeR - Math.sqrt(Math.max(0, safeR * safeR - (chordLength * chordLength) / 4));
  const absB = (2 * sagitta) / chordLength;
  return Number(((sign >= 0 ? 1 : -1) * absB).toFixed(4));
}

/**
 * Solves for arc bulge `b` given chord length `c` and exact user-specified arc length `L_arc` (m).
 */
export function computeBulgeFromArcLength(
  chordLength: number,
  targetArcLength: number,
  sign = 1
): number {
  if (chordLength < 1e-4 || targetArcLength <= chordLength * 1.0002) {
    return 0.02 * (sign >= 0 ? 1 : -1);
  }
  const maxArc = chordLength * 2.4;
  const clampedTarget = Math.min(maxArc, targetArcLength);

  // L(b) = chord * ((1 + b^2) / b) * atan(b) is monotonically increasing for b in (0, 2.0]
  let low = 0.001;
  let high = 2.0;
  for (let iter = 0; iter < 32; iter++) {
    const mid = 0.5 * (low + high);
    const arcLen = chordLength * ((1 + mid * mid) / mid) * Math.atan(mid);
    if (arcLen < clampedTarget) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const b = 0.5 * (low + high);
  return Number(((sign >= 0 ? 1 : -1) * b).toFixed(4));
}

/**
 * Computes arc bulge `b` when the user drags the arc midpoint handle to `dragPt` on the canvas.
 */
export function computeBulgeFromMidpointHandle(
  p1: Point2D,
  p2: Point2D,
  dragPt: Point2D
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-4) return 0;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  // Unit outward normal (-dy, dx) / chord
  const nx = -dy / chord;
  const ny = dx / chord;
  const signedSagitta = (dragPt.x - midX) * nx + (dragPt.y - midY) * ny;
  const b = (2 * signedSagitta) / chord;
  return Number(Math.max(-1.8, Math.min(1.8, b)).toFixed(4));
}

/**
 * Evaluates a cubic Bezier curve segment from `p1` to `p2` with control points `cp1` and `cp2`.
 */
export function evaluateBezierSegment(
  p1: Point2D,
  p2: Point2D,
  cp1?: Point2D,
  cp2?: Point2D,
  numSteps = 24
): { points: Point2D[]; arcLength: number; c1: Point2D; c2: Point2D } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy) || 1;
  const nx = -dy / chord;
  const ny = dx / chord;

  const c1: Point2D = cp1 || {
    x: Number((p1.x + dx * 0.33 + nx * chord * 0.15).toFixed(3)),
    y: Number((p1.y + dy * 0.33 + ny * chord * 0.15).toFixed(3)),
  };
  const c2: Point2D = cp2 || {
    x: Number((p1.x + dx * 0.67 + nx * chord * 0.15).toFixed(3)),
    y: Number((p1.y + dy * 0.67 + ny * chord * 0.15).toFixed(3)),
  };

  const points: Point2D[] = [];
  let arcLength = 0;

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p1.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * p2.x;
    const y =
      mt * mt * mt * p1.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * p2.y;
    const pt = { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
    if (points.length > 0) {
      const prev = points[points.length - 1];
      arcLength += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    }
    points.push(pt);
  }

  return {
    points,
    arcLength: Number(arcLength.toFixed(4)),
    c1,
    c2,
  };
}

// ============================================================================
// 3. EVALUATE CUSTOM PROFILE DEFINITION -> AUTHORITATIVE TUNNEL GEOMETRY
// ============================================================================

export interface EvaluatedSegmentMetrics {
  segmentId: string;
  fromPoint: ProfileControlPoint;
  toPoint: ProfileControlPoint;
  type: CustomSegmentType;
  zoneRole: BoundaryZoneRole;
  chordLength: number;
  arcLength: number;
  radiusMeters?: number;
  bulge?: number;
  midHandlePoint: Point2D;
  cp1?: Point2D;
  cp2?: Point2D;
  sampledPoints: Point2D[];
}

export interface EvaluatedCustomProfileResult {
  crossSectionPoints: Point2D[];
  segmentMetrics: EvaluatedSegmentMetrics[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  leftWallHeight: number;
  rightWallHeight: number;
  wallHeight: number;
  leftWallArcLength: number;
  rightWallArcLength: number;
  crownArcLength: number;
  invertLength: number;
  totalPerimeterMeters: number;
  designAreaSqMeters: number;
  crownSlopeDeg: number;
  effectiveCrownRadius: number;
  hasLeftWall: boolean;
  hasRightWall: boolean;
  hasCrown: boolean;
  hasInvert: boolean;
  isClosed: boolean;
}

/**
 * Automatically classifies a segment into `leftWall | crown | rightWall | invert`
 * if the segment doesn't have an explicit `zoneRole`.
 */
export function inferSegmentZoneRole(
  p1: Point2D,
  p2: Point2D,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  segType?: CustomSegmentType
): BoundaryZoneRole {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const totalH = Math.max(0.1, maxY - minY);
  const spanX = Math.abs(maxX - minX);
  const centerX = spanX > 0.1 ? (minX + maxX) / 2 : 0;

  // Bottom invert segment: near the floor with low vertical elevation change
  if (midY <= minY + totalH * 0.22 && dy <= dx * 0.75 && segType !== 'arc') {
    return 'invert';
  }

  // Curved crown/roof segment
  if (segType === 'arc' && midY >= minY + totalH * 0.22) {
    return 'crown';
  }

  // True vertical or near-vertical sidewalls:
  // Must have substantial vertical component AND lower end must extend down towards invert (<= 35% height)
  // This distinguishes true sidewalls from sloped roof rafters in a triangle or pentagon!
  const lowerY = Math.min(p1.y, p2.y);
  const reachesLowerWall = lowerY <= minY + totalH * 0.35;

  if (dy >= dx * 0.95 && reachesLowerWall) {
    return midX <= centerX ? 'leftWall' : 'rightWall';
  }

  // Upper arch, roof rafters, sloped gable/peak of triangle:
  // If segment is in upper portion or reaches peak (maxY - 15%):
  const upperY = Math.max(p1.y, p2.y);
  if (upperY >= maxY - totalH * 0.15 || midY >= minY + totalH * 0.35) {
    // Only classify as side wall if it's strictly vertical (dy > 3*dx) and on the far periphery
    const isPeriphery = (minX + spanX * 0.15 >= Math.min(p1.x, p2.x)) || (maxX - spanX * 0.15 <= Math.max(p1.x, p2.x));
    if (dy > dx * 3.0 && reachesLowerWall && isPeriphery) {
      return midX <= centerX ? 'leftWall' : 'rightWall';
    }
    return 'crown';
  }

  // Near invert
  if (midY <= minY + totalH * 0.25) {
    return 'invert';
  }

  // Default fallback based on horizontal position
  if (dy > dx * 0.75 && reachesLowerWall) {
    return midX <= centerX ? 'leftWall' : 'rightWall';
  }

  return 'crown';
}

/**
 * Solves exact circular arc chord span (d), bulge (b = 2h/d), and radius (R)
 * given the user's exact Length of Curve (C, meters) and Height from Center / Sagitta (h, meters).
 */
export function solveCircularArcFromCurveLengthAndHeight(
  curveLengthM: number,
  heightFromCenterM: number,
  directionSign: 1 | -1 = 1
): { chordLength: number; bulge: number; radiusMeters: number } {
  const C = Math.max(0.05, curveLengthM);
  const h = Math.max(0, Math.abs(heightFromCenterM));
  if (h < 1e-4) {
    return {
      chordLength: Number(C.toFixed(4)),
      bulge: 0,
      radiusMeters: 9999,
    };
  }
  // For a circular arc: C = 2*h * ((1 + b^2) / b^2) * atan(b), where b = 2*h / d in (0, 2.4].
  // Note that g(b) = ((1 + b^2) / b^2) * atan(b) is strictly decreasing with b.
  const targetG = C / (2 * h);
  let bestB = 0.001;
  if (targetG >= ((1 + 0.001 * 0.001) / (0.001 * 0.001)) * Math.atan(0.001)) {
    bestB = 0.001;
  } else {
    let low = 0.001;
    let high = 2.4;
    for (let iter = 0; iter < 40; iter++) {
      const mid = 0.5 * (low + high);
      const g = ((1 + mid * mid) / (mid * mid)) * Math.atan(mid);
      if (g > targetG) {
        low = mid;
      } else {
        high = mid;
      }
    }
    bestB = 0.5 * (low + high);
  }
  const chordLength = (2 * h) / bestB;
  const radiusMeters = (chordLength * (1 + bestB * bestB)) / (4 * bestB);
  return {
    chordLength: Number(chordLength.toFixed(4)),
    bulge: Number((directionSign * bestB).toFixed(5)),
    radiusMeters: Number(radiusMeters.toFixed(4)),
  };
}

export function evaluateCustomProfileGeometry(
  profile: CustomTunnelProfileDefinition
): EvaluatedCustomProfileResult {
  const pts = profile.controlPoints;
  if (pts.length < 2) {
    return {
      crossSectionPoints: [
        { x: -4.2, y: 0 },
        { x: -4.2, y: 4.2 },
        { x: 0, y: 7.2 },
        { x: 4.2, y: 4.2 },
        { x: 4.2, y: 0 },
      ],
      segmentMetrics: [],
      minX: -4.2,
      maxX: 4.2,
      minY: 0,
      maxY: 7.2,
      width: 8.4,
      height: 7.2,
      leftWallHeight: 4.2,
      rightWallHeight: 4.2,
      wallHeight: 4.2,
      leftWallArcLength: 4.2,
      rightWallArcLength: 4.2,
      crownArcLength: 11.02,
      invertLength: 8.4,
      totalPerimeterMeters: 27.82,
      designAreaSqMeters: 53.8,
      crownSlopeDeg: 0,
      effectiveCrownRadius: 4.35,
      hasLeftWall: true,
      hasRightWall: true,
      hasCrown: true,
      hasInvert: true,
      isClosed: true,
    };
  }

  const ptMap = new Map<string, ProfileControlPoint>();
  for (const p of pts) ptMap.set(p.id, p);

  // If explicit segments are provided and valid, preserve their exact order and connectivity;
  // otherwise build consecutive segments across controlPoints.
  const activeSegments: ProfileSegment[] = [];
  const validExplicitSegments = (profile.segments || []).filter(
    (s) => ptMap.has(s.fromPointId) && ptMap.has(s.toPointId)
  );
  if (validExplicitSegments.length > 0 && validExplicitSegments.length >= pts.length - 1) {
    activeSegments.push(...validExplicitSegments);
  } else {
    const segCount = profile.isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const pFrom = pts[i];
      const pTo = pts[(i + 1) % pts.length];
      const existingSeg = profile.segments.find(
        (s) => s.fromPointId === pFrom.id && s.toPointId === pTo.id
      );
      if (existingSeg) {
        activeSegments.push(existingSeg);
      } else {
        activeSegments.push({
          id: `seg-${pFrom.id}-${pTo.id}`,
          fromPointId: pFrom.id,
          toPointId: pTo.id,
          type: 'line',
        });
      }
    }
  }

  const rawMinX = Math.min(...pts.map((p) => p.x));
  const rawMaxX = Math.max(...pts.map((p) => p.x));
  const rawMinY = Math.min(...pts.map((p) => p.y));
  const rawMaxY = Math.max(...pts.map((p) => p.y));

  const crossSectionPoints: Point2D[] = [];
  const segmentMetrics: EvaluatedSegmentMetrics[] = [];

  let leftWallArcLength = 0;
  let rightWallArcLength = 0;
  let crownArcLength = 0;
  let invertLength = 0;
  let hasDrawnLeftWallSeg = false;
  let hasDrawnRightWallSeg = false;
  let hasDrawnCrownSeg = false;
  let hasDrawnInvertSeg = false;
  let leftWallMaxY = rawMinY;
  let leftWallMinY = rawMaxY;
  let rightWallMaxY = rawMinY;
  let rightWallMinY = rawMaxY;
  const crownRadii: number[] = [];

  for (let idx = 0; idx < activeSegments.length; idx++) {
    const seg = activeSegments[idx];
    const pFrom = ptMap.get(seg.fromPointId) || pts[idx];
    const pTo = ptMap.get(seg.toPointId) || pts[(idx + 1) % pts.length];
    const chordLength = Number(Math.hypot(pTo.x - pFrom.x, pTo.y - pFrom.y).toFixed(4));

    const zoneRole: BoundaryZoneRole =
      seg.zoneRole ||
      inferSegmentZoneRole(pFrom, pTo, rawMinX, rawMaxX, rawMinY, rawMaxY, seg.type);

    let sampled: Point2D[] = [
      { x: pFrom.x, y: pFrom.y },
      { x: pTo.x, y: pTo.y },
    ];
    let segArcLength = chordLength;
    let radiusMeters: number | undefined;
    let bulge: number | undefined;
    let midHandlePoint: Point2D = {
      x: Number(((pFrom.x + pTo.x) / 2).toFixed(4)),
      y: Number(((pFrom.y + pTo.y) / 2).toFixed(4)),
    };
    let cp1Out = seg.cp1;
    let cp2Out = seg.cp2;

    if (seg.type === 'arc') {
      const effectiveBulge =
        typeof seg.arcBulge === 'number' && Math.abs(seg.arcBulge) > 1e-4
          ? seg.arcBulge
          : typeof seg.arcRadiusMeters === 'number' && seg.arcRadiusMeters > chordLength / 2
          ? computeBulgeFromRadius(
              chordLength,
              seg.arcRadiusMeters,
              seg.arcConvexOutward === false ? -1 : 1
            )
          : 0.32;
      const evalArc = evaluateArcSegment(pFrom, pTo, effectiveBulge, 24);
      sampled = evalArc.points;
      segArcLength = evalArc.arcLength;
      radiusMeters = evalArc.radius;
      bulge = evalArc.bulge;
      midHandlePoint = evalArc.midApexPoint;
      if (zoneRole === 'crown' && evalArc.radius < 500) {
        crownRadii.push(evalArc.radius);
      }
    } else if (seg.type === 'bezier') {
      const evalBez = evaluateBezierSegment(pFrom, pTo, seg.cp1, seg.cp2, 24);
      sampled = evalBez.points;
      segArcLength = evalBez.arcLength;
      cp1Out = evalBez.c1;
      cp2Out = evalBez.c2;
      midHandlePoint = evalBez.points[Math.floor(evalBez.points.length / 2)];
    }

    // Append sampled vertices (avoid duplicating shared start vertex when chained)
    for (let k = 0; k < sampled.length; k++) {
      if (idx > 0 && k === 0) {
        const prevPt = crossSectionPoints[crossSectionPoints.length - 1];
        if (prevPt && Math.hypot(prevPt.x - sampled[0].x, prevPt.y - sampled[0].y) < 0.05) {
          continue;
        }
      }
      if (idx === activeSegments.length - 1 && profile.isClosed && k === sampled.length - 1) {
        const firstPt = crossSectionPoints[0];
        if (firstPt && Math.hypot(firstPt.x - sampled[k].x, firstPt.y - sampled[k].y) < 0.05) {
          continue;
        }
      }
      crossSectionPoints.push(sampled[k]);
    }

    const isIncludedInTopStrip = seg.includeInTopStrip !== false && zoneRole !== 'open';

    if (zoneRole === 'leftWall' && isIncludedInTopStrip) {
      hasDrawnLeftWallSeg = true;
      leftWallArcLength += segArcLength;
      leftWallMaxY = Math.max(leftWallMaxY, pFrom.y, pTo.y);
      leftWallMinY = Math.min(leftWallMinY, pFrom.y, pTo.y);
    } else if (zoneRole === 'rightWall' && isIncludedInTopStrip) {
      hasDrawnRightWallSeg = true;
      rightWallArcLength += segArcLength;
      rightWallMaxY = Math.max(rightWallMaxY, pFrom.y, pTo.y);
      rightWallMinY = Math.min(rightWallMinY, pFrom.y, pTo.y);
    } else if (zoneRole === 'crown' && isIncludedInTopStrip) {
      hasDrawnCrownSeg = true;
      crownArcLength += segArcLength;
    } else if (zoneRole === 'invert' && isIncludedInTopStrip) {
      hasDrawnInvertSeg = true;
      invertLength += segArcLength;
    }

    segmentMetrics.push({
      segmentId: seg.id,
      fromPoint: pFrom,
      toPoint: pTo,
      type: seg.type,
      zoneRole,
      chordLength,
      arcLength: Number(segArcLength.toFixed(3)),
      radiusMeters: radiusMeters ? Number(radiusMeters.toFixed(3)) : undefined,
      bulge,
      midHandlePoint,
      cp1: cp1Out,
      cp2: cp2Out,
      sampledPoints: sampled,
    });
  }

  const allEvalPts = crossSectionPoints.length >= 2 ? crossSectionPoints : pts;
  const minX = Number(Math.min(...allEvalPts.map((p) => p.x)).toFixed(3));
  const maxX = Number(Math.max(...allEvalPts.map((p) => p.x)).toFixed(3));
  const minY = Number(Math.min(...allEvalPts.map((p) => p.y)).toFixed(3));
  const maxY = Number(Math.max(...allEvalPts.map((p) => p.y)).toFixed(3));

  const width = Number(Math.max(1.0, maxX - minX).toFixed(3));
  const height = Number(Math.max(1.0, maxY - minY).toFixed(3));

  const surfCfg = profile.surfaceConfig;
  const isClosed = profile.isClosed !== false;
  // If the surfaceConfig explicitly defines presence, respect that configuration.
  // Otherwise, determine presence from the actual drawn segments for that zone.
  // Closed non-symmetric shapes (such as triangles or asymmetric arches) must NOT force a non-existent wall to true!
  const hasLeftWall =
    surfCfg?.hasLeftWall !== undefined
      ? surfCfg.hasLeftWall
      : hasDrawnLeftWallSeg ||
        (typeof surfCfg?.overrideLeftWallLength === 'number' &&
          surfCfg.overrideLeftWallLength > 0);
  const hasRightWall =
    surfCfg?.hasRightWall !== undefined
      ? surfCfg.hasRightWall
      : hasDrawnRightWallSeg ||
        (typeof surfCfg?.overrideRightWallLength === 'number' &&
          surfCfg.overrideRightWallLength > 0);
  const hasCrown =
    surfCfg?.hasCrown !== undefined
      ? surfCfg.hasCrown
      : hasDrawnCrownSeg ||
        (typeof surfCfg?.overrideCrownLength === 'number' &&
          surfCfg.overrideCrownLength > 0);
  const hasInvert =
    surfCfg?.hasInvert !== undefined
      ? surfCfg.hasInvert
      : hasDrawnInvertSeg || (isClosed && invertLength > 0.01);

  // Preserve true drawn Left Wall, Right Wall, and Crown lengths independently!
  // Never force Left Wall and Right Wall to an equal average length.
  let computedLeftWallArc = hasLeftWall ? Number(leftWallArcLength.toFixed(3)) : 0;
  let computedRightWallArc = hasRightWall ? Number(rightWallArcLength.toFixed(3)) : 0;
  let computedCrownArc = hasCrown ? Number(crownArcLength.toFixed(3)) : 0;

  let computedLeftWallH = hasLeftWall
    ? leftWallMaxY > leftWallMinY
      ? Number((leftWallMaxY - leftWallMinY).toFixed(3))
      : computedLeftWallArc > 0
      ? computedLeftWallArc
      : isClosed
      ? Number((height * 0.58).toFixed(3))
      : 0
    : 0;

  let computedRightWallH = hasRightWall
    ? rightWallMaxY > rightWallMinY
      ? Number((rightWallMaxY - rightWallMinY).toFixed(3))
      : computedRightWallArc > 0
      ? computedRightWallArc
      : isClosed
      ? Number((height * 0.58).toFixed(3))
      : 0
    : 0;

  if (hasLeftWall && computedLeftWallArc <= 0) {
    computedLeftWallArc = computedLeftWallH;
  }
  if (hasRightWall && computedRightWallArc <= 0) {
    computedRightWallArc = computedRightWallH;
  }
  if (hasCrown && computedCrownArc <= 0 && isClosed) {
    computedCrownArc = Number(width.toFixed(3));
  }

  // Apply explicit user length overrides if specified in surfaceConfig
  if (
    hasLeftWall &&
    typeof surfCfg?.overrideLeftWallLength === 'number' &&
    surfCfg.overrideLeftWallLength > 0
  ) {
    computedLeftWallArc = Number(surfCfg.overrideLeftWallLength.toFixed(3));
    computedLeftWallH = computedLeftWallArc;
  }
  if (
    hasRightWall &&
    typeof surfCfg?.overrideRightWallLength === 'number' &&
    surfCfg.overrideRightWallLength > 0
  ) {
    computedRightWallArc = Number(surfCfg.overrideRightWallLength.toFixed(3));
    computedRightWallH = computedRightWallArc;
  }
  if (
    hasCrown &&
    typeof surfCfg?.overrideCrownLength === 'number' &&
    surfCfg.overrideCrownLength >= 0
  ) {
    computedCrownArc = Number(surfCfg.overrideCrownLength.toFixed(3));
  }

  const leftWallHeight = computedLeftWallH;
  const rightWallHeight = computedRightWallH;
  leftWallArcLength = computedLeftWallArc;
  rightWallArcLength = computedRightWallArc;
  crownArcLength = computedCrownArc;

  const wallHeight = Number(
    Math.max(
      0.5,
      hasLeftWall && hasRightWall
        ? Math.max(leftWallHeight, rightWallHeight)
        : hasLeftWall
        ? leftWallHeight
        : hasRightWall
        ? rightWallHeight
        : height
    ).toFixed(3)
  );

  const totalPerimeterMeters = Number(
    segmentMetrics.reduce((s, m) => s + m.arcLength, 0).toFixed(3)
  );

  // Shoelace area
  let areaSum = 0;
  for (let i = 0; i < allEvalPts.length; i++) {
    const a = allEvalPts[i];
    const b = allEvalPts[(i + 1) % allEvalPts.length];
    areaSum += a.x * b.y - b.x * a.y;
  }
  const designAreaSqMeters = Number((Math.abs(areaSum) * 0.5).toFixed(3));

  // Crown slope angle between left wall top and right wall top
  const crownSlopeDeg = Number(
    ((Math.atan2(rightWallHeight - leftWallHeight, Math.max(0.5, width)) * 180) / Math.PI).toFixed(2)
  );

  const avgCrownRadius =
    crownRadii.length > 0
      ? Number((crownRadii.reduce((a, b) => a + b, 0) / crownRadii.length).toFixed(3))
      : Number((width * 0.55).toFixed(3));

  return {
    crossSectionPoints: allEvalPts,
    segmentMetrics,
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    leftWallHeight,
    rightWallHeight,
    wallHeight,
    leftWallArcLength: Number(leftWallArcLength.toFixed(3)),
    rightWallArcLength: Number(rightWallArcLength.toFixed(3)),
    crownArcLength: Number(crownArcLength.toFixed(3)),
    invertLength: Number(invertLength.toFixed(3)),
    totalPerimeterMeters,
    designAreaSqMeters,
    crownSlopeDeg,
    effectiveCrownRadius: avgCrownRadius,
    hasLeftWall,
    hasRightWall,
    hasCrown,
    hasInvert,
    isClosed,
  };
}

/**
 * Converts a `CustomTunnelProfileDefinition` into the authoritative `TunnelGeometry`
 * used across Face Mapping, Crown, Left/Right Walls, Developed Perimeter, Photo Fitting,
 * Survey Control Points, Overbreak/Undercut, and the Final Engineering Sheet.
 */
export function buildAuthoritativeCustomTunnelGeometry(
  profile: CustomTunnelProfileDefinition,
  options?: {
    source?: TunnelGeometry['source'];
    cadFileName?: string;
    rdStartMeters?: number;
    rdEndMeters?: number;
  }
): TunnelGeometry {
  const evaluated = evaluateCustomProfileGeometry(profile);

  const profileTypeMap: Record<CustomTunnelProfileDefinition['category'], ProfileType> = {
    freeform: 'freeform_custom',
    freeform_polygon: 'freeform_custom',
    powerhouse_cavern: 'powerhouse_cavern',
    transformer_hall: 'transformer_hall',
    cavern_junction: 'cavern_junction',
    enlarged_chamber: 'cavern_junction',
    asymmetric_section: 'asymmetric_cavern',
    stepped_wall: 'powerhouse_cavern',
    traced_drawing: 'freeform_custom',
    dxf_import: 'custom_cad',
  };

  const isTopHeading =
    profile.surfaceConfig?.excavationStage === 'TOP_HEADING' ||
    profile.surfaceConfig?.excavationStage === 'top_heading';

  return {
    width: evaluated.width,
    height: evaluated.height,
    wallHeight: evaluated.wallHeight,
    leftWallHeight: evaluated.leftWallHeight,
    rightWallHeight: evaluated.rightWallHeight,
    leftWallArcLength: evaluated.leftWallArcLength,
    rightWallArcLength: evaluated.rightWallArcLength,
    hasCrown: evaluated.hasCrown,
    hasLeftWall: evaluated.hasLeftWall,
    hasRightWall: evaluated.hasRightWall,
    excavationStage: isTopHeading ? 'TOP_HEADING' : 'FULL_FACE',
    benchHeightRemovedMeters: profile.surfaceConfig?.benchHeightRemovedMeters,
    leftBenchHeightMeters: profile.surfaceConfig?.leftBenchHeightMeters,
    rightBenchHeightMeters: profile.surfaceConfig?.rightBenchHeightMeters,
    fullSectionHeightMeters: profile.surfaceConfig?.fullSectionTotalHeightMeters,
    fullSectionTotalHeightMeters: profile.surfaceConfig?.fullSectionTotalHeightMeters,
    fullSectionWallHeightMeters: profile.surfaceConfig?.fullSectionWallHeightMeters,
    fullSectionRightWallHeightMeters: profile.surfaceConfig?.fullSectionRightWallHeightMeters,
    customPortionLabel:
      profile.surfaceConfig?.portionLabel ||
      (isTopHeading
        ? `Top Heading (Bench ${(profile.surfaceConfig?.benchHeightRemovedMeters ?? 0).toFixed(2)}m Removed)`
        : undefined),
    invertLength: evaluated.invertLength,
    totalPerimeterMeters: evaluated.totalPerimeterMeters,
    designAreaSqMeters: evaluated.designAreaSqMeters,
    minX: evaluated.minX,
    maxX: evaluated.maxX,
    minY: evaluated.minY,
    maxY: evaluated.maxY,
    crownSlopeDeg: evaluated.crownSlopeDeg,
    crownGeometry: profileTypeMap[profile.category] || 'freeform_custom',
    crownRadius: evaluated.effectiveCrownRadius,
    units: 'm',
    source:
      options?.source ||
      (profile.category === 'traced_drawing'
        ? 'traced_image'
        : profile.category === 'dxf_import'
        ? 'dxf'
        : 'freeform'),
    cadFileName: options?.cadFileName || profile.name,
    profileId: profile.id,
    profileName: profile.name,
    profileVersion: profile.version,
    rdStartMeters: options?.rdStartMeters,
    rdEndMeters: options?.rdEndMeters,
    isAuthoritativeCustom: true,
    customProfile: profile,
    crossSectionPoints: evaluated.crossSectionPoints,
    crownArcLength: evaluated.crownArcLength,
  };
}

/**
 * Reconstructs or clones an editable `CustomTunnelProfileDefinition` from the active `TunnelGeometry`
 * so opening "Edit Tunnel Shape" ALWAYS loads the existing shape instead of resetting to a blank canvas.
 */
export function deriveEditableCustomProfileFromGeometry(
  geometry: TunnelGeometry,
  defaultName = 'Custom Tunnel Shape'
): CustomTunnelProfileDefinition {
  if (geometry.customProfile && geometry.customProfile.controlPoints.length > 0) {
    return {
      ...geometry.customProfile,
      controlPoints: geometry.customProfile.controlPoints.map((cp) => ({ ...cp })),
      segments: geometry.customProfile.segments.map((s) => ({
        ...s,
        cp1: s.cp1 ? { ...s.cp1 } : undefined,
        cp2: s.cp2 ? { ...s.cp2 } : undefined,
      })),
      surfaceConfig: {
        hasCrown: geometry.customProfile.surfaceConfig?.hasCrown ?? geometry.hasCrown ?? true,
        hasLeftWall:
          geometry.customProfile.surfaceConfig?.hasLeftWall ?? geometry.hasLeftWall ?? true,
        hasRightWall:
          geometry.customProfile.surfaceConfig?.hasRightWall ?? geometry.hasRightWall ?? true,
        overrideLeftWallLength:
          geometry.customProfile.surfaceConfig?.overrideLeftWallLength ?? null,
        overrideRightWallLength:
          geometry.customProfile.surfaceConfig?.overrideRightWallLength ?? null,
        overrideCrownLength: geometry.customProfile.surfaceConfig?.overrideCrownLength ?? null,
      },
    };
  }

  // Convert current parametric/CAD geometry into a clean 4-point editable custom profile (Left Wall, Crown Arc/Line, Right Wall, Invert)
  const w = Math.max(1.5, geometry.width || 8.4);
  const h = Math.max(1.5, geometry.height || 7.2);
  const leftH = Math.max(
    0.5,
    geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2
  );
  const rightH = Math.max(
    0.5,
    geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2
  );
  const halfW = Number((w / 2).toFixed(2));
  const hasCrown = geometry.hasCrown !== false;

  const controlPoints: ProfileControlPoint[] = [
    { id: 'cp-1', label: 'P1', x: -halfW, y: 0, role: 'left_invert' },
    { id: 'cp-2', label: 'P2', x: -halfW, y: Number(leftH.toFixed(2)), role: 'left_wall_top' },
    { id: 'cp-3', label: 'P3', x: halfW, y: Number(rightH.toFixed(2)), role: 'right_wall_top' },
    { id: 'cp-4', label: 'P4', x: halfW, y: 0, role: 'right_invert' },
  ];

  const chord = Math.hypot(w, rightH - leftH);
  const targetArchRise = Math.max(0, h - Math.max(leftH, rightH));
  const isArchedCrown = hasCrown && targetArchRise > 0.15 && geometry.crownArcLength > chord + 0.05;
  const bulge = isArchedCrown
    ? computeBulgeFromArcLength(chord, Math.max(chord * 1.04, geometry.crownArcLength), 1)
    : 0;

  const segments: ProfileSegment[] = [
    {
      id: 'seg-cp-1-cp-2',
      fromPointId: 'cp-1',
      toPointId: 'cp-2',
      type: 'line',
      zoneRole: 'leftWall',
    },
    {
      id: 'seg-cp-2-cp-3',
      fromPointId: 'cp-2',
      toPointId: 'cp-3',
      type: isArchedCrown ? 'arc' : 'line',
      arcBulge: isArchedCrown ? bulge : undefined,
      arcConvexOutward: true,
      zoneRole: hasCrown ? 'crown' : 'invert',
    },
    {
      id: 'seg-cp-3-cp-4',
      fromPointId: 'cp-3',
      toPointId: 'cp-4',
      type: 'line',
      zoneRole: 'rightWall',
    },
    {
      id: 'seg-cp-4-cp-1',
      fromPointId: 'cp-4',
      toPointId: 'cp-1',
      type: 'line',
      zoneRole: 'invert',
    },
  ];

  return {
    id: geometry.profileId || `custom-prof-${Date.now()}`,
    name: geometry.profileName || defaultName,
    category: 'freeform_polygon',
    controlPoints,
    segments,
    isClosed: true,
    version: geometry.profileVersion || 'v1.0',
    updatedAt: new Date().toISOString(),
    surfaceConfig: {
      hasCrown: geometry.hasCrown !== false,
      hasLeftWall: geometry.hasLeftWall !== false,
      hasRightWall: geometry.hasRightWall !== false,
      overrideLeftWallLength: null,
      overrideRightWallLength: null,
      overrideCrownLength: null,
    },
  };
}

// ============================================================================
// 4. PARAMETRIC DIMENSION SCALING & SEGMENT DIMENSION SOLVER
// ============================================================================

export function applyParametricOverallDimensions(
  profile: CustomTunnelProfileDefinition,
  target: {
    width?: number;
    height?: number;
    leftWallHeight?: number;
    rightWallHeight?: number;
  }
): CustomTunnelProfileDefinition {
  const current = evaluateCustomProfileGeometry(profile);
  const scaleX =
    typeof target.width === 'number' && target.width >= 1.0
      ? target.width / Math.max(0.5, current.width)
      : 1;
  const scaleY =
    typeof target.height === 'number' && target.height >= 1.0
      ? target.height / Math.max(0.5, current.height)
      : 1;

  const centerX = (current.minX + current.maxX) / 2;
  const baseMinY = current.minY;

  const nextPoints = profile.controlPoints.map((pt) => {
    if (pt.locked) return pt;
    let nx = centerX + (pt.x - centerX) * scaleX;
    let ny = baseMinY + (pt.y - baseMinY) * scaleY;

    // If user explicitly set Left Wall Height or Right Wall Height
    if (
      typeof target.leftWallHeight === 'number' &&
      target.leftWallHeight >= 0.5 &&
      pt.x < centerX - 0.1 &&
      Math.abs(pt.y - (baseMinY + current.leftWallHeight)) < 0.45
    ) {
      ny = baseMinY + target.leftWallHeight;
    }
    if (
      typeof target.rightWallHeight === 'number' &&
      target.rightWallHeight >= 0.5 &&
      pt.x > centerX + 0.1 &&
      Math.abs(pt.y - (baseMinY + current.rightWallHeight)) < 0.45
    ) {
      ny = baseMinY + target.rightWallHeight;
    }

    return {
      ...pt,
      x: Number(nx.toFixed(3)),
      y: Number(ny.toFixed(3)),
    };
  });

  const nextSegments = profile.segments.map((seg) => ({
    ...seg,
    arcRadiusMeters:
      typeof seg.arcRadiusMeters === 'number'
        ? Number((seg.arcRadiusMeters * ((scaleX + scaleY) / 2)).toFixed(3))
        : undefined,
    cp1: seg.cp1
      ? {
          x: Number((centerX + (seg.cp1.x - centerX) * scaleX).toFixed(3)),
          y: Number((baseMinY + (seg.cp1.y - baseMinY) * scaleY).toFixed(3)),
        }
      : undefined,
    cp2: seg.cp2
      ? {
          x: Number((centerX + (seg.cp2.x - centerX) * scaleX).toFixed(3)),
          y: Number((baseMinY + (seg.cp2.y - baseMinY) * scaleY).toFixed(3)),
        }
      : undefined,
  }));

  return {
    ...profile,
    controlPoints: nextPoints,
    segments: nextSegments,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Updates a specific segment's exact chord length, arc radius, or arc length in meters.
 */
export function applySegmentExactDimension(
  profile: CustomTunnelProfileDefinition,
  segmentId: string,
  update: {
    chordLengthMeters?: number;
    arcRadiusMeters?: number;
    arcLengthMeters?: number;
  }
): CustomTunnelProfileDefinition {
  const seg = profile.segments.find((s) => s.id === segmentId);
  if (!seg) return profile;

  const pFrom = profile.controlPoints.find((p) => p.id === seg.fromPointId);
  const pTo = profile.controlPoints.find((p) => p.id === seg.toPointId);
  if (!pFrom || !pTo) return profile;

  let nextPoints = [...profile.controlPoints];
  const dx = pTo.x - pFrom.x;
  const dy = pTo.y - pFrom.y;
  const curChord = Math.hypot(dx, dy);

  if (
    typeof update.chordLengthMeters === 'number' &&
    update.chordLengthMeters >= 0.1 &&
    curChord > 1e-4
  ) {
    const ux = dx / curChord;
    const uy = dy / curChord;
    const newLen = update.chordLengthMeters;
    if (!pTo.locked) {
      const nextTo: ProfileControlPoint = {
        ...pTo,
        x: Number((pFrom.x + ux * newLen).toFixed(3)),
        y: Number((pFrom.y + uy * newLen).toFixed(3)),
      };
      nextPoints = nextPoints.map((p) => (p.id === pTo.id ? nextTo : p));
    } else if (!pFrom.locked) {
      const nextFrom: ProfileControlPoint = {
        ...pFrom,
        x: Number((pTo.x - ux * newLen).toFixed(3)),
        y: Number((pTo.y - uy * newLen).toFixed(3)),
      };
      nextPoints = nextPoints.map((p) => (p.id === pFrom.id ? nextFrom : p));
    }
  }

  const updatedFrom = nextPoints.find((p) => p.id === seg.fromPointId)!;
  const updatedTo = nextPoints.find((p) => p.id === seg.toPointId)!;
  const updatedChord = Math.hypot(updatedTo.x - updatedFrom.x, updatedTo.y - updatedFrom.y);

  const nextSegments = profile.segments.map((s) => {
    if (s.id !== segmentId) return s;
    const sign = (s.arcBulge ?? 0.3) >= 0 ? 1 : -1;

    if (typeof update.arcRadiusMeters === 'number' && update.arcRadiusMeters > 0.2) {
      const b = computeBulgeFromRadius(updatedChord, update.arcRadiusMeters, sign);
      return {
        ...s,
        type: 'arc' as CustomSegmentType,
        arcBulge: b,
        arcRadiusMeters: Number(Math.max(updatedChord / 2 + 0.01, update.arcRadiusMeters).toFixed(3)),
      };
    }

    if (typeof update.arcLengthMeters === 'number' && update.arcLengthMeters > 0.1) {
      if (s.type === 'line') {
        return s;
      }
      const b = computeBulgeFromArcLength(updatedChord, update.arcLengthMeters, sign);
      const evalArc = evaluateArcSegment(updatedFrom, updatedTo, b, 16);
      return {
        ...s,
        type: 'arc' as CustomSegmentType,
        arcBulge: b,
        arcRadiusMeters: Number(evalArc.radius.toFixed(3)),
      };
    }

    return s;
  });

  return {
    ...profile,
    controlPoints: nextPoints,
    segments: nextSegments,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Synchronizes any `ProfileControlPoint` linked via `surveyControlPointId` when
 * the user moves a Survey Control Point (CP1, CP2, CP3...) on the mapping canvas.
 */
export function syncCustomProfileWithSurveyControlPoints(
  profile: CustomTunnelProfileDefinition,
  surveyControlPoints: SurveyControlPoint[]
): { updatedProfile: CustomTunnelProfileDefinition; changed: boolean } {
  const cpMap = new Map<string, SurveyControlPoint>();
  for (const cp of surveyControlPoints) {
    cpMap.set(cp.id, cp);
    cpMap.set(cp.label.toUpperCase(), cp);
  }

  let changed = false;
  const nextPoints = profile.controlPoints.map((pt) => {
    if (!pt.surveyControlPointId) return pt;
    const matched =
      cpMap.get(pt.surveyControlPointId) || cpMap.get(pt.surveyControlPointId.toUpperCase());
    if (!matched) return pt;
    if (Math.abs(matched.point.x - pt.x) > 1e-4 || Math.abs(matched.point.y - pt.y) > 1e-4) {
      changed = true;
      return {
        ...pt,
        x: Number(matched.point.x.toFixed(3)),
        y: Number(matched.point.y.toFixed(3)),
      };
    }
    return pt;
  });

  if (!changed) return { updatedProfile: profile, changed: false };
  return {
    updatedProfile: {
      ...profile,
      controlPoints: nextPoints,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}

// ============================================================================
// 5. REAL UNDERGROUND EXCAVATION PROFILE PRESETS (CAVERN & IRREGULAR LIBRARY)
//    All presets are 100% editable control-point + line/arc/bezier vector models.
// ============================================================================

export interface CustomProfilePresetItem {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  createProfile: () => CustomTunnelProfileDefinition;
}

export const CUSTOM_PROFILE_PRESETS: CustomProfilePresetItem[] = [
  {
    id: 'sheet_1_standard_d_8x7',
    label: 'Sheet 1: Standard D-Shaped Tunnel (8.00m W × 7.00m H)',
    subtitle: 'L-Wall 3.00m + Semicircular Crown 12.5664m + R-Wall 3.00m + Invert 8.00m',
    badge: 'SHEET 1 · D-SHAPED',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -4.0, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -4.0, y: 3.0, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: 4.0, y: 3.0, role: 'right_wall_top' },
        { id: 'P4', label: 'P4', x: 4.0, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-sheet-1-d8x7',
        name: 'Sheet 1: Standard D-Shaped (8.00m × 7.00m)',
        category: 'freeform',
        controlPoints: pts,
        segments: [
          {
            id: 'S1',
            fromPointId: 'P1',
            toPointId: 'P2',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: true,
          },
          {
            id: 'S2',
            fromPointId: 'P2',
            toPointId: 'P3',
            type: 'arc',
            arcBulge: 1.0, // Semicircle (R = 4.0m, Arc = 12.5664m)
            arcConvexOutward: true,
            zoneRole: 'crown',
            includeInTopStrip: true,
          },
          {
            id: 'S3',
            fromPointId: 'P3',
            toPointId: 'P4',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: true,
          },
          {
            id: 'S4',
            fromPointId: 'P4',
            toPointId: 'P1',
            type: 'line',
            zoneRole: 'invert',
            includeInTopStrip: false,
          },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
          overrideLeftWallLength: 3.0,
          overrideRightWallLength: 3.0,
          overrideCrownLength: 12.5664,
        },
      };
    },
  },
  {
    id: 'sheet_2_top_heading_8x55',
    label: 'Sheet 2: Top Heading D-Shaped (8.00m W × 5.50m H)',
    subtitle: 'L-Wall 1.50m + Semicircular Crown 12.5664m + R-Wall 1.50m (Lower Bench Removed)',
    badge: 'SHEET 2 · TOP HEADING',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -4.0, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -4.0, y: 1.5, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: 4.0, y: 1.5, role: 'right_wall_top' },
        { id: 'P4', label: 'P4', x: 4.0, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-sheet-2-topheading',
        name: 'Sheet 2: Top Heading D-Shaped (8.00m × 5.50m)',
        category: 'freeform',
        controlPoints: pts,
        segments: [
          {
            id: 'S1',
            fromPointId: 'P1',
            toPointId: 'P2',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: true,
          },
          {
            id: 'S2',
            fromPointId: 'P2',
            toPointId: 'P3',
            type: 'arc',
            arcBulge: 1.0,
            arcConvexOutward: true,
            zoneRole: 'crown',
            includeInTopStrip: true,
          },
          {
            id: 'S3',
            fromPointId: 'P3',
            toPointId: 'P4',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: true,
          },
          {
            id: 'S4',
            fromPointId: 'P4',
            toPointId: 'P1',
            type: 'line',
            zoneRole: 'invert',
            includeInTopStrip: false,
          },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
          excavationStage: 'TOP_HEADING',
          benchHeightRemovedMeters: 1.5,
          fullSectionTotalHeightMeters: 7.0,
          fullSectionWallHeightMeters: 3.0,
          fullSectionRightWallHeightMeters: 3.0,
          overrideLeftWallLength: 1.5,
          overrideRightWallLength: 1.5,
          overrideCrownLength: 12.5664,
        },
      };
    },
  },
  {
    id: 'sheet_3_trapezoid_arch_7x8',
    label: 'Sheet 3: Trapezoidal-Wall Arch (7.00m Base × 8.00m H)',
    subtitle: 'Slanted L-Wall 4.0311m + Crown Arch 10.6734m + Slanted R-Wall 4.0311m',
    badge: 'SHEET 3 · SLANTED WALLS',
    createProfile: () => {
      // Base width = 7.0000m (-3.50 to +3.50), Slanted walls outward to (-4.00, 4.00) & (+4.00, 4.00) -> hypot(0.5, 4.0) = 4.0311m
      const p1: ProfileControlPoint = { id: 'P1', label: 'P1', x: -3.5, y: 0.0, role: 'left_invert' };
      const p2: ProfileControlPoint = { id: 'P2', label: 'P2', x: -4.0, y: 4.0, role: 'left_wall_top' };
      const p3: ProfileControlPoint = { id: 'P3', label: 'P3', x: 4.0, y: 4.0, role: 'right_wall_top' };
      const p4: ProfileControlPoint = { id: 'P4', label: 'P4', x: 3.5, y: 0.0, role: 'right_invert' };
      const chord = 8.0;
      const bulge = computeBulgeFromArcLength(chord, 10.6734, 1);

      return {
        id: 'prof-sheet-3-trap-arch',
        name: 'Sheet 3: Trapezoidal-Wall Arch (7.00m Base × 8.00m H)',
        category: 'freeform_polygon',
        controlPoints: [p1, p2, p3, p4],
        segments: [
          {
            id: 'S1',
            fromPointId: 'P1',
            toPointId: 'P2',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: true,
          },
          {
            id: 'S2',
            fromPointId: 'P2',
            toPointId: 'P3',
            type: 'arc',
            arcBulge: bulge,
            arcConvexOutward: true,
            zoneRole: 'crown',
            includeInTopStrip: true,
          },
          {
            id: 'S3',
            fromPointId: 'P3',
            toPointId: 'P4',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: true,
          },
          {
            id: 'S4',
            fromPointId: 'P4',
            toPointId: 'P1',
            type: 'line',
            zoneRole: 'invert',
            includeInTopStrip: false,
          },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
          overrideLeftWallLength: 4.0311,
          overrideRightWallLength: 4.0311,
          overrideCrownLength: 10.6734,
        },
      };
    },
  },
  {
    id: 'sheet_4_5_asymmetric_stepped_9486',
    label: 'Sheet 4 & 5: Asymmetric Stepped / Slanted Roof (9.4868m × 8.00m)',
    subtitle: 'L-Wall 5.00m + Slanted Roof 3.1623m + Step 2.00m + R-Arch 5.9044m + Floor 9.4868m',
    badge: 'SHEET 4 & 5 · ASYMMETRIC',
    createProfile: () => {
      // Exact dimensions from Sheet 4 & Sheet 5:
      // Left Wall = 5.0000m vertical: (-4.50, 0.00) -> (-4.50, 5.00)
      // Slanted Left Roof = 3.1623m: (-4.50, 5.00) -> (-1.50, 6.00) [dx=3.0, dy=1.0 => sqrt(10) = 3.1623m]
      // Vertical Step = 2.0000m: (-1.50, 6.00) -> (-1.50, 8.00)
      // Right Arch = 5.9044m: (-1.50, 8.00) -> (3.50, 6.00)
      // Slanted Right Lower Wall = 6.1237m: (3.50, 6.00) -> (4.9868, 0.00)
      // Bottom Floor = 9.4868m: (4.9868, 0.00) -> (-4.50, 0.00)
      const p1: ProfileControlPoint = { id: 'P1', label: 'P1', x: -4.5, y: 0.0, role: 'left_invert' };
      const p2: ProfileControlPoint = { id: 'P2', label: 'P2', x: -4.5, y: 5.0, role: 'left_wall_top' };
      const p3: ProfileControlPoint = { id: 'P3', label: 'P3', x: -1.5, y: 6.0, role: 'step_corner' };
      const p4: ProfileControlPoint = { id: 'P4', label: 'P4', x: -1.5, y: 8.0, role: 'crown_apex' };
      const p5: ProfileControlPoint = { id: 'P5', label: 'P5', x: 3.5, y: 6.0, role: 'right_wall_top' };
      const p6: ProfileControlPoint = { id: 'P6', label: 'P6', x: 4.9868, y: 0.0, role: 'right_invert' };

      const chordP4P5 = Math.hypot(p5.x - p4.x, p5.y - p4.y);
      const bulgeP4P5 = computeBulgeFromArcLength(chordP4P5, 5.9044, 1);

      return {
        id: 'prof-sheet-4-5-asym',
        name: 'Sheet 4 & 5: Asymmetric Stepped Section (9.4868m × 8.00m)',
        category: 'asymmetric_section',
        controlPoints: [p1, p2, p3, p4, p5, p6],
        segments: [
          {
            id: 'S1',
            fromPointId: 'P1',
            toPointId: 'P2',
            type: 'line',
            zoneRole: 'leftWall',
            includeInTopStrip: true,
          },
          {
            id: 'S2',
            fromPointId: 'P2',
            toPointId: 'P3',
            type: 'line',
            zoneRole: 'crown',
            includeInTopStrip: true,
          },
          {
            id: 'S3',
            fromPointId: 'P3',
            toPointId: 'P4',
            type: 'line',
            zoneRole: 'crown',
            includeInTopStrip: false, // Step 2.00m excluded from top strip by default (matches Sheet 4: 5.00 + 3.1623 + 5.9044)
          },
          {
            id: 'S4',
            fromPointId: 'P4',
            toPointId: 'P5',
            type: 'arc',
            arcBulge: bulgeP4P5,
            arcConvexOutward: true,
            zoneRole: 'crown',
            includeInTopStrip: true,
          },
          {
            id: 'S5',
            fromPointId: 'P5',
            toPointId: 'P6',
            type: 'line',
            zoneRole: 'rightWall',
            includeInTopStrip: true,
          },
          {
            id: 'S6',
            fromPointId: 'P6',
            toPointId: 'P1',
            type: 'line',
            zoneRole: 'invert',
            includeInTopStrip: false,
          },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
        surfaceConfig: {
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
        },
      };
    },
  },
  {
    id: 'asymmetric_sloping_crown',
    label: 'Asymmetric Tunnel / Sloping Crown (9.486m × 8.000m)',
    subtitle: 'Different Left/Right wall heights + curved transition + sloping crown + large arc',
    badge: 'IRREGULAR ASYMMETRIC',
    createProfile: () => {
      // Exact engineering example from specification:
      // Width = 9.486 m (-4.743m to +4.743m), Height = 8.000 m
      // Straight left wall (4.20m) -> curved haunch transition -> sloping crown -> large right arc (Arc = 5.904m) -> inclined right wall -> bottom invert
      const p1: ProfileControlPoint = { id: 'P1', label: 'P1', x: -4.743, y: 0.0, role: 'left_invert' };
      const p2: ProfileControlPoint = { id: 'P2', label: 'P2', x: -4.743, y: 4.2, role: 'left_wall_top' };
      const p3: ProfileControlPoint = { id: 'P3', label: 'P3', x: -2.95, y: 6.85, role: 'smooth_tangent' };
      const p4: ProfileControlPoint = { id: 'P4', label: 'P4', x: 0.35, y: 8.0, role: 'crown_apex' };
      const p5: ProfileControlPoint = { id: 'P5', label: 'P5', x: 4.743, y: 5.15, role: 'right_wall_top' };
      const p6: ProfileControlPoint = { id: 'P6', label: 'P6', x: 4.38, y: 0.0, role: 'right_invert' };

      // Chord P4->P5 is hypot(4.393, -2.85) = 5.2367m; compute exact bulge for Arc Length = 5.904m
      const chordP4P5 = Math.hypot(p5.x - p4.x, p5.y - p4.y);
      const bulgeP4P5 = computeBulgeFromArcLength(chordP4P5, 5.904, 1);

      return {
        id: 'prof-asym-9486',
        name: 'Asymmetric Sloping-Crown Profile (9.486m × 8.000m)',
        category: 'asymmetric_section',
        controlPoints: [p1, p2, p3, p4, p5, p6],
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'arc', arcBulge: 0.28, zoneRole: 'crown' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'line', zoneRole: 'crown' },
          {
            id: 'S4',
            fromPointId: 'P4',
            toPointId: 'P5',
            type: 'arc',
            arcBulge: bulgeP4P5,
            zoneRole: 'crown',
          },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P6', type: 'line', zoneRole: 'rightWall' },
          { id: 'S6', fromPointId: 'P6', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'powerhouse_cavern',
    label: 'Underground Powerhouse Cavern (24.0m W × 38.5m H)',
    subtitle: 'Mushroom vaulted arch crown + crane-beam rock steps + deep turbine pit walls',
    badge: 'POWERHOUSE CAVERN',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -10.2, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -10.2, y: 14.0, role: 'step_corner' },
        { id: 'P3', label: 'P3', x: -12.0, y: 15.5, role: 'step_corner' },
        { id: 'P4', label: 'P4', x: -12.0, y: 28.5, role: 'left_wall_top' },
        { id: 'P5', label: 'P5', x: -7.5, y: 35.8, role: 'smooth_tangent' },
        { id: 'P6', label: 'P6', x: 0.0, y: 38.5, role: 'crown_apex' },
        { id: 'P7', label: 'P7', x: 7.5, y: 35.8, role: 'smooth_tangent' },
        { id: 'P8', label: 'P8', x: 12.0, y: 28.5, role: 'right_wall_top' },
        { id: 'P9', label: 'P9', x: 12.0, y: 15.5, role: 'step_corner' },
        { id: 'P10', label: 'P10', x: 10.2, y: 14.0, role: 'step_corner' },
        { id: 'P11', label: 'P11', x: 10.2, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-powerhouse-cavern',
        name: 'Underground Powerhouse Cavern (24.0m × 38.5m)',
        category: 'powerhouse_cavern',
        controlPoints: pts,
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'line', zoneRole: 'leftWall' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'line', zoneRole: 'leftWall' },
          { id: 'S4', fromPointId: 'P4', toPointId: 'P5', type: 'arc', arcBulge: 0.24, zoneRole: 'crown' },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P6', type: 'arc', arcBulge: 0.18, zoneRole: 'crown' },
          { id: 'S6', fromPointId: 'P6', toPointId: 'P7', type: 'arc', arcBulge: 0.18, zoneRole: 'crown' },
          { id: 'S7', fromPointId: 'P7', toPointId: 'P8', type: 'arc', arcBulge: 0.24, zoneRole: 'crown' },
          { id: 'S8', fromPointId: 'P8', toPointId: 'P9', type: 'line', zoneRole: 'rightWall' },
          { id: 'S9', fromPointId: 'P9', toPointId: 'P10', type: 'line', zoneRole: 'rightWall' },
          { id: 'S10', fromPointId: 'P10', toPointId: 'P11', type: 'line', zoneRole: 'rightWall' },
          { id: 'S11', fromPointId: 'P11', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'transformer_hall',
    label: 'Transformer Hall Cavern (16.5m W × 21.5m H)',
    subtitle: 'High vertical walls + compound 3-arc vaulted roof + drainage trench invert',
    badge: 'TRANSFORMER HALL',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -8.25, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -8.25, y: 15.2, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: -4.8, y: 19.8, role: 'smooth_tangent' },
        { id: 'P4', label: 'P4', x: 0.0, y: 21.5, role: 'crown_apex' },
        { id: 'P5', label: 'P5', x: 4.8, y: 19.8, role: 'smooth_tangent' },
        { id: 'P6', label: 'P6', x: 8.25, y: 15.2, role: 'right_wall_top' },
        { id: 'P7', label: 'P7', x: 8.25, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-transformer-hall',
        name: 'Transformer Hall Cavern (16.5m × 21.5m)',
        category: 'transformer_hall',
        controlPoints: pts,
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'arc', arcBulge: 0.25, zoneRole: 'crown' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'arc', arcBulge: 0.16, zoneRole: 'crown' },
          { id: 'S4', fromPointId: 'P4', toPointId: 'P5', type: 'arc', arcBulge: 0.16, zoneRole: 'crown' },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P6', type: 'arc', arcBulge: 0.25, zoneRole: 'crown' },
          { id: 'S6', fromPointId: 'P6', toPointId: 'P7', type: 'line', zoneRole: 'rightWall' },
          { id: 'S7', fromPointId: 'P7', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'cavern_junction_chamber',
    label: 'Cavern Junction / Enlarged Side-Chamber (14.8m × 10.5m)',
    subtitle: 'Main tunnel with right-side adit/busduct junction opening & stepped bench',
    badge: 'CAVERN JUNCTION',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -5.6, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -5.6, y: 6.2, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: 0.0, y: 10.5, role: 'crown_apex' },
        { id: 'P4', label: 'P4', x: 5.8, y: 7.4, role: 'right_wall_top' },
        { id: 'P5', label: 'P5', x: 9.2, y: 6.8, role: 'step_corner' },
        { id: 'P6', label: 'P6', x: 9.2, y: 2.2, role: 'step_corner' },
        { id: 'P7', label: 'P7', x: 6.2, y: 2.2, role: 'step_corner' },
        { id: 'P8', label: 'P8', x: 6.2, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-cavern-junction',
        name: 'Cavern Junction & Side Chamber (14.8m × 10.5m)',
        category: 'cavern_junction',
        controlPoints: pts,
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'arc', arcBulge: 0.34, zoneRole: 'crown' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'arc', arcBulge: 0.28, zoneRole: 'crown' },
          { id: 'S4', fromPointId: 'P4', toPointId: 'P5', type: 'line', zoneRole: 'crown' },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P6', type: 'line', zoneRole: 'rightWall' },
          { id: 'S6', fromPointId: 'P6', toPointId: 'P7', type: 'line', zoneRole: 'rightWall' },
          { id: 'S7', fromPointId: 'P7', toPointId: 'P8', type: 'line', zoneRole: 'rightWall' },
          { id: 'S8', fromPointId: 'P8', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'flat_sloping_crown_cavern',
    label: 'Curved-Haunch Flat/Sloping Crown Chamber (12.0m × 9.0m)',
    subtitle: 'Vertical left wall + inclined right wall + curved haunches + flat/sloping roof',
    badge: 'CHAMBER / HAUNCH',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -6.0, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -6.0, y: 6.4, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: -4.0, y: 8.8, role: 'smooth_tangent' },
        { id: 'P4', label: 'P4', x: 3.6, y: 9.0, role: 'crown_apex' },
        { id: 'P5', label: 'P5', x: 6.0, y: 6.2, role: 'right_wall_top' },
        { id: 'P6', label: 'P6', x: 5.2, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-flat-crown-chamber',
        name: 'Curved-Haunch Flat/Sloping Crown Chamber (12.0m × 9.0m)',
        category: 'enlarged_chamber',
        controlPoints: pts,
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'arc', arcBulge: 0.28, zoneRole: 'crown' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'line', zoneRole: 'crown' },
          { id: 'S4', fromPointId: 'P4', toPointId: 'P5', type: 'arc', arcBulge: 0.28, zoneRole: 'crown' },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P6', type: 'line', zoneRole: 'rightWall' },
          { id: 'S6', fromPointId: 'P6', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'editable_d_tunnel',
    label: 'Regular Tunnel (Editable Control Points, 8.40m × 7.20m)',
    subtitle: 'Standard D-tunnel converted to editable control points & modifiable segments',
    badge: 'EDITABLE TUNNEL',
    createProfile: () => {
      const pts: ProfileControlPoint[] = [
        { id: 'P1', label: 'P1', x: -4.2, y: 0.0, role: 'left_invert' },
        { id: 'P2', label: 'P2', x: -4.2, y: 4.2, role: 'left_wall_top' },
        { id: 'P3', label: 'P3', x: 0.0, y: 7.2, role: 'crown_apex' },
        { id: 'P4', label: 'P4', x: 4.2, y: 4.2, role: 'right_wall_top' },
        { id: 'P5', label: 'P5', x: 4.2, y: 0.0, role: 'right_invert' },
      ];
      return {
        id: 'prof-regular-editable',
        name: 'Regular Tunnel Section (8.40m × 7.20m)',
        category: 'freeform',
        controlPoints: pts,
        segments: [
          { id: 'S1', fromPointId: 'P1', toPointId: 'P2', type: 'line', zoneRole: 'leftWall' },
          { id: 'S2', fromPointId: 'P2', toPointId: 'P3', type: 'arc', arcBulge: 0.31, zoneRole: 'crown' },
          { id: 'S3', fromPointId: 'P3', toPointId: 'P4', type: 'arc', arcBulge: 0.31, zoneRole: 'crown' },
          { id: 'S4', fromPointId: 'P4', toPointId: 'P5', type: 'line', zoneRole: 'rightWall' },
          { id: 'S5', fromPointId: 'P5', toPointId: 'P1', type: 'line', zoneRole: 'invert' },
        ],
        isClosed: true,
        version: 'v1.0',
        updatedAt: new Date().toISOString(),
      };
    },
  },
];

// ============================================================================
// 6. PROFILE TRANSITIONS & MULTI-PROFILE CHAINAGE / RD SCHEDULE ENGINE
//    (Sections 7 & 8: RD 100-120 Regular -> RD 120-150 Transition -> RD 150-200 Powerhouse -> RD 200-230 Transformer Hall)
// ============================================================================

/**
 * Resamples any closed polygon boundary to `targetCount` equispaced stations along its perimeter,
 * starting from the bottom-left invert corner, so two completely different profiles (e.g. Regular Tunnel
 * and Powerhouse Cavern) can be smoothly interpolated at any transition chainage!
 */
export function resampleClosedBoundaryEquispaced(
  poly: Point2D[],
  targetCount = 72
): Point2D[] {
  if (poly.length < 3) return poly;

  // Rotate array so index 0 is closest to bottom-left corner (min X + Y)
  let startIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const sc = poly[i].x * 1.2 + poly[i].y;
    if (sc < bestScore) {
      bestScore = sc;
      startIdx = i;
    }
  }

  const ordered: Point2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    ordered.push(poly[(startIdx + i) % poly.length]);
  }
  ordered.push(ordered[0]); // close loop

  const cumDist: number[] = [0];
  for (let i = 1; i < ordered.length; i++) {
    const d = Math.hypot(ordered[i].x - ordered[i - 1].x, ordered[i].y - ordered[i - 1].y);
    cumDist.push(cumDist[i - 1] + d);
  }
  const totalLen = cumDist[cumDist.length - 1];
  if (totalLen < 1e-4) return poly;

  const resampled: Point2D[] = [];
  for (let k = 0; k < targetCount; k++) {
    const targetS = (k / targetCount) * totalLen;
    let segIdx = 0;
    while (segIdx < cumDist.length - 2 && cumDist[segIdx + 1] < targetS) {
      segIdx++;
    }
    const s0 = cumDist[segIdx];
    const s1 = cumDist[segIdx + 1];
    const localT = s1 > s0 ? (targetS - s0) / (s1 - s0) : 0;
    const a = ordered[segIdx];
    const b = ordered[segIdx + 1];
    resampled.push({
      x: Number((a.x + localT * (b.x - a.x)).toFixed(4)),
      y: Number((a.y + localT * (b.y - a.y)).toFixed(4)),
    });
  }

  return resampled;
}

/**
 * Interpolates a transition tunnel/cavern geometry at normalized factor `t` in [0, 1]
 * between `fromGeom` (at RD_start) and `toGeom` (at RD_end).
 */
export function interpolateTransitionTunnelGeometry(
  fromGeom: TunnelGeometry,
  toGeom: TunnelGeometry,
  t: number,
  transitionName?: string
): TunnelGeometry {
  const clampedT = Math.max(0, Math.min(1, t));
  const ptsA = resampleClosedBoundaryEquispaced(fromGeom.crossSectionPoints, 72);
  const ptsB = resampleClosedBoundaryEquispaced(toGeom.crossSectionPoints, 72);

  const interpPts: Point2D[] = ptsA.map((pa, idx) => {
    const pb = ptsB[idx] || pa;
    return {
      x: Number((pa.x + clampedT * (pb.x - pa.x)).toFixed(4)),
      y: Number((pa.y + clampedT * (pb.y - pa.y)).toFixed(4)),
    };
  });

  const minX = Number(Math.min(...interpPts.map((p) => p.x)).toFixed(3));
  const maxX = Number(Math.max(...interpPts.map((p) => p.x)).toFixed(3));
  const minY = Number(Math.min(...interpPts.map((p) => p.y)).toFixed(3));
  const maxY = Number(Math.max(...interpPts.map((p) => p.y)).toFixed(3));
  const width = Number((maxX - minX).toFixed(3));
  const height = Number((maxY - minY).toFixed(3));

  const lerp = (a: number, b: number) => Number((a + clampedT * (b - a)).toFixed(3));
  const leftWH = lerp(
    fromGeom.leftWallHeight ?? fromGeom.wallHeight,
    toGeom.leftWallHeight ?? toGeom.wallHeight
  );
  const rightWH = lerp(
    fromGeom.rightWallHeight ?? fromGeom.wallHeight,
    toGeom.rightWallHeight ?? toGeom.wallHeight
  );
  const wallHeight = Number(((leftWH + rightWH) / 2).toFixed(3));
  const crownArc = lerp(fromGeom.crownArcLength, toGeom.crownArcLength);
  const leftArc = lerp(
    fromGeom.leftWallArcLength ?? fromGeom.wallHeight,
    toGeom.leftWallArcLength ?? toGeom.wallHeight
  );
  const rightArc = lerp(
    fromGeom.rightWallArcLength ?? fromGeom.wallHeight,
    toGeom.rightWallArcLength ?? toGeom.wallHeight
  );

  // Compute exact area and perimeter of the interpolated transition boundary
  let areaSum = 0;
  let perimSum = 0;
  for (let i = 0; i < interpPts.length; i++) {
    const a = interpPts[i];
    const b = interpPts[(i + 1) % interpPts.length];
    areaSum += a.x * b.y - b.x * a.y;
    perimSum += Math.hypot(b.x - a.x, b.y - a.y);
  }

  return {
    width,
    height,
    wallHeight,
    leftWallHeight: leftWH,
    rightWallHeight: rightWH,
    leftWallArcLength: leftArc,
    rightWallArcLength: rightArc,
    crownArcLength: crownArc,
    totalPerimeterMeters: Number(perimSum.toFixed(3)),
    designAreaSqMeters: Number((Math.abs(areaSum) * 0.5).toFixed(3)),
    minX,
    maxX,
    minY,
    maxY,
    crownGeometry: 'freeform_custom',
    crownRadius: lerp(fromGeom.crownRadius, toGeom.crownRadius),
    units: 'm',
    source: 'freeform',
    cadFileName:
      transitionName ||
      `Transition (${Math.round(clampedT * 100)}% ${fromGeom.profileName || 'Start'} → ${
        toGeom.profileName || 'End'
      })`,
    profileId: `trans-${Date.now()}`,
    profileName:
      transitionName ||
      `Transition (${Math.round(clampedT * 100)}% ${fromGeom.profileName || 'Section A'} → ${
        toGeom.profileName || 'Section B'
      })`,
    profileVersion: 'v1.0',
    isAuthoritativeCustom: true,
    crossSectionPoints: interpPts,
  };
}

export function createDefaultChainageProfileSchedule(
  tunnelName = 'Main Underground Complex'
): ChainageProfileSegmentRecord[] {
  const regProf = CUSTOM_PROFILE_PRESETS.find((p) => p.id === 'editable_d_tunnel')!.createProfile();
  const phProf = CUSTOM_PROFILE_PRESETS.find((p) => p.id === 'powerhouse_cavern')!.createProfile();
  const thProf = CUSTOM_PROFILE_PRESETS.find((p) => p.id === 'transformer_hall')!.createProfile();

  const regGeom = buildAuthoritativeCustomTunnelGeometry(regProf, {
    rdStartMeters: 100,
    rdEndMeters: 120,
  });
  const phGeom = buildAuthoritativeCustomTunnelGeometry(phProf, {
    rdStartMeters: 150,
    rdEndMeters: 200,
  });
  const thGeom = buildAuthoritativeCustomTunnelGeometry(thProf, {
    rdStartMeters: 200,
    rdEndMeters: 230,
  });
  const transGeom = interpolateTransitionTunnelGeometry(
    regGeom,
    phGeom,
    0.5,
    'Expansion Transition (Regular Tunnel → Powerhouse Cavern)'
  );

  const today = new Date().toISOString().slice(0, 10);

  return [
    {
      id: 'ch-seg-100-120',
      profileId: regProf.id,
      profileName: 'Regular Access / HRT Tunnel',
      tunnelName,
      location: 'Main Approach Heading',
      rdStartMeters: 100,
      rdEndMeters: 120,
      sectionType: 'REGULAR_TUNNEL',
      isTransition: false,
      geometry: regGeom,
      version: 'v1.0',
      date: today,
      notes: 'Standard 8.40m × 7.20m excavation profile',
    },
    {
      id: 'ch-seg-120-150',
      profileId: 'prof-transition-120-150',
      profileName: 'Transition Expansion Section (Tunnel → Cavern)',
      tunnelName,
      location: 'Cavern Approach Transition',
      rdStartMeters: 120,
      rdEndMeters: 150,
      sectionType: 'TRANSITION',
      isTransition: true,
      transitionFromProfileId: 'ch-seg-100-120',
      transitionToProfileId: 'ch-seg-150-200',
      geometry: {
        ...transGeom,
        rdStartMeters: 120,
        rdEndMeters: 150,
      },
      version: 'v1.0',
      date: today,
      notes: 'Gradual flare from 8.4m×7.2m tunnel to 24.0m×38.5m Powerhouse Cavern',
    },
    {
      id: 'ch-seg-150-200',
      profileId: phProf.id,
      profileName: 'Powerhouse Cavern (Machine Hall)',
      tunnelName,
      location: 'Underground Powerhouse Complex',
      rdStartMeters: 150,
      rdEndMeters: 200,
      sectionType: 'POWERHOUSE_CAVERN',
      isTransition: false,
      geometry: phGeom,
      version: 'v1.0',
      date: today,
      notes: 'Mushroom crown + stepped crane-beam walls + turbine pit',
    },
    {
      id: 'ch-seg-200-230',
      profileId: thProf.id,
      profileName: 'Transformer Hall Cavern',
      tunnelName,
      location: 'Underground Transformer Complex',
      rdStartMeters: 200,
      rdEndMeters: 230,
      sectionType: 'TRANSFORMER_HALL',
      isTransition: false,
      geometry: thGeom,
      version: 'v1.0',
      date: today,
      notes: '16.5m × 21.5m cavern with compound 3-arc roof',
    },
  ];
}

export function loadChainageProfileSchedule(): ChainageProfileSegmentRecord[] {
  try {
    const raw = localStorage.getItem(CHAINAGE_PROFILE_SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function saveChainageProfileSchedule(
  records: ChainageProfileSegmentRecord[]
): ChainageProfileSegmentRecord[] {
  const sorted = [...records].sort((a, b) => a.rdStartMeters - b.rdStartMeters);
  try {
    localStorage.setItem(CHAINAGE_PROFILE_SCHEDULE_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage errors
  }
  return sorted;
}

/**
 * Resolves the authoritative `TunnelGeometry` for any numeric chainage RD (m) from the
 * project's Chainage Profile Schedule. If the chainage falls inside a TRANSITION segment,
 * automatically interpolates the exact cross-section at `(rd - rdStart) / (rdEnd - rdStart)`.
 */
export function resolveGeometryForChainageMeters(
  rdMeters: number,
  schedule: ChainageProfileSegmentRecord[]
): {
  matchedRecord: ChainageProfileSegmentRecord;
  resolvedGeometry: TunnelGeometry;
  interpolationRatio?: number;
} | null {
  const match = schedule.find(
    (seg) => rdMeters >= seg.rdStartMeters && rdMeters <= seg.rdEndMeters
  );
  if (!match) return null;

  if (match.isTransition) {
    const fromRec =
      schedule.find((s) => s.id === match.transitionFromProfileId) ||
      schedule.find((s) => Math.abs(s.rdEndMeters - match.rdStartMeters) < 1);
    const toRec =
      schedule.find((s) => s.id === match.transitionToProfileId) ||
      schedule.find((s) => Math.abs(s.rdStartMeters - match.rdEndMeters) < 1);

    if (fromRec && toRec) {
      const span = Math.max(0.1, match.rdEndMeters - match.rdStartMeters);
      const ratio = Math.max(0, Math.min(1, (rdMeters - match.rdStartMeters) / span));
      const interp = interpolateTransitionTunnelGeometry(
        fromRec.geometry,
        toRec.geometry,
        ratio,
        `${match.profileName} @ RD ${rdMeters.toFixed(2)}m (${Math.round(ratio * 100)}%)`
      );
      return {
        matchedRecord: match,
        resolvedGeometry: {
          ...interp,
          rdStartMeters: match.rdStartMeters,
          rdEndMeters: match.rdEndMeters,
        },
        interpolationRatio: ratio,
      };
    }
  }

  return {
    matchedRecord: match,
    resolvedGeometry: match.geometry,
  };
}

/**
 * Slices a CustomTunnelProfileDefinition into a Top Heading profile by removing
 * the lower bench portion (`benchHeightRemovedMeters`) and shifting all remaining
 * upper control points down so y = 0 is the Top Heading floor, while preserving
 * the Top Heading Left Wall, Right Wall, and Crown Arch!
 */
export function sliceCustomProfileToTopHeading(
  profile: CustomTunnelProfileDefinition,
  options?: {
    topHeadingHeightMeters?: number;
    benchHeightRemovedMeters?: number;
    leftBenchHeightMeters?: number;
    rightBenchHeightMeters?: number;
  }
): CustomTunnelProfileDefinition {
  const evalCurrent = evaluateCustomProfileGeometry(profile);
  const fullH = Math.max(
    2.0,
    profile.surfaceConfig?.fullSectionTotalHeightMeters || evalCurrent.height
  );
  const fullLeftW = Math.max(
    0.8,
    profile.surfaceConfig?.fullSectionWallHeightMeters || evalCurrent.leftWallHeight || evalCurrent.wallHeight
  );
  const fullRightW = Math.max(
    0.8,
    profile.surfaceConfig?.fullSectionRightWallHeightMeters || evalCurrent.rightWallHeight || evalCurrent.wallHeight
  );
  const defaultBenchCut = Number(
    Math.max(0.8, Math.min(fullLeftW - 0.6, fullLeftW * 0.6)).toFixed(2)
  );

  let benchRemoved =
    typeof options?.benchHeightRemovedMeters === 'number' && options.benchHeightRemovedMeters >= 0.2
      ? options.benchHeightRemovedMeters
      : typeof options?.topHeadingHeightMeters === 'number' && options.topHeadingHeightMeters >= 1.0
      ? Math.max(0.2, fullH - options.topHeadingHeightMeters)
      : defaultBenchCut;

  benchRemoved = Math.min(fullH - 1.0, Math.max(0.2, Number(benchRemoved.toFixed(2))));
  const cutY = evalCurrent.minY + benchRemoved;

  const nextPoints: ProfileControlPoint[] = profile.controlPoints.map((pt) => {
    const clampedY = Math.max(cutY, pt.y);
    return {
      ...pt,
      y: Number((clampedY - cutY).toFixed(3)),
    };
  });

  // Preserve leftWall, rightWall, crown, and invert zoneRoles!
  const nextSegments: ProfileSegment[] = profile.segments.map((seg) => ({
    ...seg,
    cp1: seg.cp1
      ? {
          x: seg.cp1.x,
          y: Number(Math.max(0, seg.cp1.y - cutY).toFixed(3)),
        }
      : undefined,
    cp2: seg.cp2
      ? {
          x: seg.cp2.x,
          y: Number(Math.max(0, seg.cp2.y - cutY).toFixed(3)),
        }
      : undefined,
  }));

  const cleanName = profile.name.replace(/\s*—\s*Top Heading.*$/i, '').replace(/\s*·\s*Top Heading.*$/i, '');

  return {
    ...profile,
    name: `${cleanName} · Top Heading (Bench ${benchRemoved.toFixed(2)}m Removed)`,
    controlPoints: nextPoints,
    segments: nextSegments,
    updatedAt: new Date().toISOString(),
    surfaceConfig: {
      ...profile.surfaceConfig,
      hasCrown: true,
      hasLeftWall: true,
      hasRightWall: true,
      excavationStage: 'TOP_HEADING',
      benchHeightRemovedMeters: benchRemoved,
      leftBenchHeightMeters: options?.leftBenchHeightMeters ?? benchRemoved,
      rightBenchHeightMeters: options?.rightBenchHeightMeters ?? benchRemoved,
      fullSectionTotalHeightMeters: Number(fullH.toFixed(2)),
      fullSectionWallHeightMeters: Number(fullLeftW.toFixed(2)),
      fullSectionRightWallHeightMeters: Number(fullRightW.toFixed(2)),
      portionLabel: `Top Heading (Bench ${benchRemoved.toFixed(2)}m Removed)`,
    },
  };
}

