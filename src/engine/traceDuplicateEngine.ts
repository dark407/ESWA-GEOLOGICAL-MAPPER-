import { Joint, Point2D, SurfaceType } from '../types/tunnel';
import { formatJointTraceLineLabel } from './orientationEngine';

/**
 * Calculates Euclidean distance from point P to line segment AB in meters.
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates shortest distance between two 2D line segments (A1-A2) and (B1-B2) in meters.
 */
export function segmentToSegmentDistance(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D
): number {
  // Check if segments intersect
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) > 1e-9) {
    const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
    const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return 0; // segments intersect
    }
  }

  // Otherwise, distance is the minimum distance from endpoints to opposite segments
  const d1 = pointToSegmentDistance(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y);
  const d2 = pointToSegmentDistance(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
  const d3 = pointToSegmentDistance(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y);
  const d4 = pointToSegmentDistance(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y);

  return Math.min(d1, d2, d3, d4);
}

/**
 * Calculates total polyline length in meters.
 */
export function calculatePolylineLengthMeters(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

export interface TraceOverlapResult {
  isOverlap: boolean;
  closestJoint: Joint | null;
  minDistanceMeters: number;
  minDistanceCm: number;
  angleDiffDeg: number;
  warningMessage: string | null;
}

/**
 * Real-time Duplicate and Proximity Detection for Underground Photogrammetric Face Logging.
 * Evaluates candidate draft polyline against existing joints on the same surface.
 * Returns overlap status, minimum distance, and human-readable proximity warning.
 */
export function detectTraceOverlap(
  draftPoints: Point2D[],
  existingJoints: Joint[],
  activeSurface: SurfaceType,
  allJoints: Joint[],
  thresholdMeters: number = 0.18 // 18 centimeters threshold
): TraceOverlapResult {
  if (draftPoints.length < 2) {
    return {
      isOverlap: false,
      closestJoint: null,
      minDistanceMeters: Infinity,
      minDistanceCm: 999,
      angleDiffDeg: 0,
      warningMessage: null,
    };
  }

  const surfaceJoints = existingJoints.filter(
    (j) => j.surface === activeSurface && j.geometry && j.geometry.length >= 2
  );

  if (surfaceJoints.length === 0) {
    return {
      isOverlap: false,
      closestJoint: null,
      minDistanceMeters: Infinity,
      minDistanceCm: 999,
      angleDiffDeg: 0,
      warningMessage: null,
    };
  }

  // Draft chord angle
  const draftStart = draftPoints[0];
  const draftEnd = draftPoints[draftPoints.length - 1];
  const draftAngle = (Math.atan2(draftEnd.y - draftStart.y, draftEnd.x - draftStart.x) * 180) / Math.PI;

  let overallMinDist = Infinity;
  let closestJoint: Joint | null = null;
  let closestAngleDiff = 0;

  for (const ej of surfaceJoints) {
    let jointMinDist = Infinity;

    for (let i = 0; i < draftPoints.length - 1; i++) {
      const dp1 = draftPoints[i];
      const dp2 = draftPoints[i + 1];

      for (let k = 0; k < ej.geometry.length - 1; k++) {
        const ep1 = ej.geometry[k];
        const ep2 = ej.geometry[k + 1];

        const d = segmentToSegmentDistance(dp1, dp2, ep1, ep2);
        if (d < jointMinDist) {
          jointMinDist = d;
        }
        if (jointMinDist === 0) break;
      }
      if (jointMinDist === 0) break;
    }

    if (jointMinDist < overallMinDist) {
      overallMinDist = jointMinDist;
      closestJoint = ej;

      // Compute angle diff with this joint
      const ejStart = ej.geometry[0];
      const ejEnd = ej.geometry[ej.geometry.length - 1];
      const ejAngle = (Math.atan2(ejEnd.y - ejStart.y, ejEnd.x - ejStart.x) * 180) / Math.PI;
      let diff = Math.abs(draftAngle - ejAngle) % 180;
      if (diff > 90) diff = 180 - diff;
      closestAngleDiff = Math.round(diff);
    }
  }

  const minDistanceCm = Math.round(overallMinDist * 100);
  const isOverlap = overallMinDist <= thresholdMeters;

  let warningMessage: string | null = null;
  if (isOverlap && closestJoint) {
    const jName = formatJointTraceLineLabel(closestJoint, allJoints);
    const dipInfo =
      closestJoint.dip && closestJoint.dipDirection
        ? ` (Dip ${Math.round(closestJoint.dip)}° / ${Math.round(closestJoint.dipDirection)}°)`
        : '';
    warningMessage = `Duplicate / Overlap Warning: Trace is within ${minDistanceCm}cm of existing ${jName}${dipInfo}. Confirm with OK or Retrace.`;
  }

  return {
    isOverlap,
    closestJoint,
    minDistanceMeters: overallMinDist,
    minDistanceCm,
    angleDiffDeg: closestAngleDiff,
    warningMessage,
  };
}
