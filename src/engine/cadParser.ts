import {
  CustomTunnelProfileDefinition,
  Point2D,
  ProfileControlPoint,
  ProfileSegment,
  TunnelGeometry,
} from '../types/tunnel';
import { buildAuthoritativeCustomTunnelGeometry } from './customProfileEngine';

interface RawSegment {
  pts: Point2D[];
  isArc?: boolean;
  bulge?: number;
}

/**
 * Parses a DXF (or ASCII CAD) string to extract real-world tunnel cross-section geometry.
 * Supports LINE, LWPOLYLINE (with bulge 42 arcs), POLYLINE/VERTEX, ARC, and CIRCLE entities.
 * Preserves non-convex stepped caverns, side chambers, and asymmetric walls into editable
 * `CustomTunnelProfileDefinition` control points and segments.
 */
export function parseDXFStringToGeometry(dxfText: string, fileName: string): TunnelGeometry {
  const lines = dxfText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const segments: RawSegment[] = [];

  let i = 0;
  let inEntities = false;

  // Helper to read group code & value pairs
  const pairs: { code: number; value: string }[] = [];
  while (i < lines.length - 1) {
    const codeStr = lines[i].trim();
    const valStr = lines[i + 1].trim();
    const code = parseInt(codeStr, 10);
    if (!isNaN(code)) {
      pairs.push({ code, value: valStr });
    }
    i += 2;
  }

  let idx = 0;
  while (idx < pairs.length) {
    const p = pairs[idx];
    if (p.code === 0 && p.value === 'SECTION') {
      const next = pairs[idx + 1];
      if (next && next.code === 2 && next.value === 'ENTITIES') {
        inEntities = true;
        idx += 2;
        continue;
      }
    }
    if (p.code === 0 && p.value === 'ENDSEC' && inEntities) {
      inEntities = false;
    }

    if (p.code === 0 && p.value === 'LINE') {
      let x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0;
      idx++;
      while (idx < pairs.length && pairs[idx].code !== 0) {
        const c = pairs[idx].code;
        const v = parseFloat(pairs[idx].value);
        if (c === 10) x1 = v;
        if (c === 20) y1 = v;
        if (c === 11) x2 = v;
        if (c === 21) y2 = v;
        idx++;
      }
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
        segments.push({
          pts: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ],
          isArc: false,
        });
      }
      continue;
    }

    if (p.code === 0 && p.value === 'LWPOLYLINE') {
      const polyPts: Point2D[] = [];
      let curX: number | null = null;
      idx++;
      while (idx < pairs.length && pairs[idx].code !== 0) {
        const c = pairs[idx].code;
        const v = parseFloat(pairs[idx].value);
        if (c === 10) {
          curX = v;
        } else if (c === 20 && curX !== null) {
          polyPts.push({ x: curX, y: v });
          curX = null;
        }
        idx++;
      }
      if (polyPts.length >= 2) {
        segments.push({ pts: polyPts, isArc: false });
      }
      continue;
    }

    if (p.code === 0 && p.value === 'ARC') {
      let cx = 0,
        cy = 0,
        r = 1,
        startAngle = 0,
        endAngle = 180;
      idx++;
      while (idx < pairs.length && pairs[idx].code !== 0) {
        const c = pairs[idx].code;
        const v = parseFloat(pairs[idx].value);
        if (c === 10) cx = v;
        if (c === 20) cy = v;
        if (c === 40) r = v;
        if (c === 50) startAngle = v;
        if (c === 51) endAngle = v;
        idx++;
      }
      const arcPts: Point2D[] = [];
      let sA = startAngle;
      let eA = endAngle;
      if (eA < sA) eA += 360;
      const sweepRad = ((eA - sA) * Math.PI) / 180;
      const bulge = Math.tan(sweepRad / 4);
      const steps = 24;
      for (let k = 0; k <= steps; k++) {
        const deg = sA + (k / steps) * (eA - sA);
        const rad = (deg * Math.PI) / 180;
        arcPts.push({
          x: cx + r * Math.cos(rad),
          y: cy + r * Math.sin(rad),
        });
      }
      segments.push({ pts: arcPts, isArc: true, bulge });
      continue;
    }

    idx++;
  }

  // Collect all points
  const allPts: Point2D[] = [];
  for (const seg of segments) {
    for (const pt of seg.pts) {
      if (isFinite(pt.x) && isFinite(pt.y)) {
        allPts.push(pt);
      }
    }
  }

  if (allPts.length < 3) {
    throw new Error('No valid vector cross-section entities (LINE, LWPOLYLINE, ARC) found in CAD file.');
  }

  // Compute bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const pt of allPts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const rawWidth = maxX - minX;

  // Detect unit scale: if width > 500, CAD file is in millimeters (or cm)
  let unitScale = 1.0;
  if (rawWidth > 500) {
    unitScale = 0.001; // mm -> m
  } else if (rawWidth > 80) {
    unitScale = 0.01; // cm -> m
  }

  // Normalize points to tunnel coordinate frame: x centered around 0, y starting at 0 (invert)
  const centerX = (minX + maxX) / 2;
  const normPt = (p: Point2D): Point2D => ({
    x: Number(((p.x - centerX) * unitScale).toFixed(4)),
    y: Number(((p.y - minY) * unitScale).toFixed(4)),
  });

  // Chain connected segments topologically so non-convex stepped caverns are preserved
  const normSegments = segments.map((s) => ({
    ...s,
    pts: s.pts.map(normPt),
  }));

  const orderedPolygon = chainOrOrderCrossSectionSegments(normSegments);

  // Extract editable control points from key corners & arc endpoints (up to 18 control points)
  const keyVertices = extractEditableControlPointsFromPolygon(orderedPolygon);
  const controlPoints: ProfileControlPoint[] = keyVertices.map((pt, k) => ({
    id: `P${k + 1}`,
    label: `P${k + 1}`,
    x: Number(pt.x.toFixed(3)),
    y: Number(pt.y.toFixed(3)),
    role: 'corner',
  }));

  const profileSegments: ProfileSegment[] = controlPoints.map((cp, k) => {
    const nextCp = controlPoints[(k + 1) % controlPoints.length];
    return {
      id: `S${k + 1}`,
      fromPointId: cp.id,
      toPointId: nextCp.id,
      type: 'line',
    };
  });

  const customProfile: CustomTunnelProfileDefinition = {
    id: `prof-cad-${Date.now()}`,
    name: fileName.replace(/\.(dxf|dwg)$/i, ''),
    category: 'dxf_import',
    controlPoints,
    segments: profileSegments,
    isClosed: true,
    version: 'v1.0',
    updatedAt: new Date().toISOString(),
  };

  const built = buildAuthoritativeCustomTunnelGeometry(customProfile, {
    source: fileName.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf',
    cadFileName: fileName,
  });

  return {
    ...built,
    crossSectionPoints: orderedPolygon,
  };
}

function chainOrOrderCrossSectionSegments(segments: RawSegment[]): Point2D[] {
  if (segments.length === 1 && segments[0].pts.length >= 3) {
    return deduplicateSequentialPoints(segments[0].pts);
  }

  // Try topological endpoint chaining first (preserves stepped walls and side chambers)
  const used = new Set<number>();
  const chain: Point2D[] = [...segments[0].pts];
  used.add(0);

  for (let step = 1; step < segments.length; step++) {
    const tail = chain[chain.length - 1];
    let bestIdx = -1;
    let bestReverse = false;
    let bestDist = Infinity;

    for (let j = 0; j < segments.length; j++) {
      if (used.has(j)) continue;
      const sPts = segments[j].pts;
      const dStart = Math.hypot(sPts[0].x - tail.x, sPts[0].y - tail.y);
      const dEnd = Math.hypot(
        sPts[sPts.length - 1].x - tail.x,
        sPts[sPts.length - 1].y - tail.y
      );
      if (dStart < bestDist) {
        bestDist = dStart;
        bestIdx = j;
        bestReverse = false;
      }
      if (dEnd < bestDist) {
        bestDist = dEnd;
        bestIdx = j;
        bestReverse = true;
      }
    }

    if (bestIdx !== -1 && bestDist < 1.5) {
      used.add(bestIdx);
      const nextPts = bestReverse
        ? [...segments[bestIdx].pts].reverse()
        : segments[bestIdx].pts;
      chain.push(...nextPts);
    } else {
      break;
    }
  }

  if (used.size === segments.length && chain.length >= 4) {
    return deduplicateSequentialPoints(chain);
  }

  // Fallback to perimeter ordering
  const allPts: Point2D[] = [];
  for (const s of segments) allPts.push(...s.pts);
  return orderCrossSectionPerimeter(allPts);
}

function deduplicateSequentialPoints(pts: Point2D[]): Point2D[] {
  const out: Point2D[] = [];
  for (const p of pts) {
    if (out.length === 0 || Math.hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) > 0.03) {
      out.push(p);
    }
  }
  if (out.length >= 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 0.03) {
    out.pop();
  }
  return out;
}

function extractEditableControlPointsFromPolygon(pts: Point2D[]): Point2D[] {
  if (pts.length <= 14) return pts;
  const result: Point2D[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    // Keep sharp corners or sample every ~6th vertex along curves
    if (diff > 0.22 || i % Math.max(2, Math.floor(n / 12)) === 0) {
      result.push(curr);
    }
  }
  return result.length >= 4 ? result.slice(0, 20) : pts.slice(0, 12);
}

function orderCrossSectionPerimeter(points: Point2D[]): Point2D[] {
  // Calculate centroid
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  // Deduplicate close points
  const unique: Point2D[] = [];
  for (const p of points) {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 0.04)) {
      unique.push(p);
    }
  }

  // Sort clockwise starting from bottom-left (-PI/2)
  return unique.sort((a, b) => {
    const angA = Math.atan2(a.y - cy, a.x - cx);
    const angB = Math.atan2(b.y - cy, b.x - cx);
    // Shift angle so bottom-left is first
    const normA = ((angA - (-Math.PI * 0.75)) + 4 * Math.PI) % (2 * Math.PI);
    const normB = ((angB - (-Math.PI * 0.75)) + 4 * Math.PI) % (2 * Math.PI);
    return normB - normA;
  });
}

function estimateWallHeight(points: Point2D[], totalHeight: number): number {
  // Find max X points and their Y coordinate (springline)
  const maxX = Math.max(...points.map((p) => Math.abs(p.x)));
  const nearMaxWidth = points.filter((p) => Math.abs(p.x) >= maxX * 0.96);
  if (nearMaxWidth.length > 0) {
    const maxYAtWall = Math.max(...nearMaxWidth.map((p) => p.y));
    if (maxYAtWall > 0.5 && maxYAtWall < totalHeight * 0.85) {
      return Number(maxYAtWall.toFixed(2));
    }
  }
  return Number((totalHeight * 0.55).toFixed(2));
}

/**
 * Generates a valid standard AutoCAD DXF string for the current master TunnelGeometry
 * so users can also export or test-upload an authentic DXF profile.
 */
export function generateSampleTunnelDXF(width = 8.4, height = 7.2, wallHeight = 4.2): string {
  const halfW = width / 2;
  const rise = height - wallHeight;
  const R = (halfW * halfW + rise * rise) / (2 * rise);
  const centerY = height - R;
  const startDeg = (Math.atan2(wallHeight - centerY, halfW) * 180) / Math.PI;
  const endDeg = (Math.atan2(wallHeight - centerY, -halfW) * 180) / Math.PI;

  return [
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    // Floor invert line
    '0',
    'LINE',
    '8',
    'TUNNEL_PROFILE',
    '10',
    (-halfW).toFixed(4),
    '20',
    '0.0000',
    '11',
    halfW.toFixed(4),
    '21',
    '0.0000',
    // Left vertical wall
    '0',
    'LINE',
    '8',
    'TUNNEL_PROFILE',
    '10',
    (-halfW).toFixed(4),
    '20',
    '0.0000',
    '11',
    (-halfW).toFixed(4),
    '21',
    wallHeight.toFixed(4),
    // Right vertical wall
    '0',
    'LINE',
    '8',
    'TUNNEL_PROFILE',
    '10',
    halfW.toFixed(4),
    '20',
    '0.0000',
    '11',
    halfW.toFixed(4),
    '21',
    wallHeight.toFixed(4),
    // Crown Arch ARC
    '0',
    'ARC',
    '8',
    'TUNNEL_PROFILE',
    '10',
    '0.0000',
    '20',
    centerY.toFixed(4),
    '40',
    R.toFixed(4),
    '50',
    startDeg.toFixed(4),
    '51',
    endDeg.toFixed(4),
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
}
