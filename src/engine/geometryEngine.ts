import {
  CameraCalibration,
  Joint,
  MasterSurfaceCategory,
  Point2D,
  Point3D,
  ProfileType,
  SurfaceTransform,
  SurfaceType,
  TraceFitMode,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { undistortNormalizedUV } from './cameraCalibration';

/**
 * Canonical fixed perimeter ratio (Sum of Side Wall Lengths + Crown Arc Length) / (Width + Height)
 * Derived from standard D-shaped tunnel reference: W = 8.40m, H = 7.20m, Wall = 4.20m, Arch Rise = 3.00m
 * -> R = 4.44m, Crown Arc = 11.02m, Total Perimeter = 2*4.20 + 11.02 = 19.42m, Ratio = 19.42 / 15.60 = 1.2449
 */
export const FIXED_TUNNEL_PERIMETER_RATIO = 1.2449;
export const CANONICAL_WALL_TO_HEIGHT_RATIO = 7 / 12; // 4.20 / 7.20 = 0.583333

/**
 * Computes the exact analytical circular arch radius R and arc length L_crown
 * for a tunnel of span W and arch rise h_arch = H - H_w.
 */
export function computeAnalyticalArchMetrics(
  width: number,
  archRise: number
): { radius: number; arcLength: number } {
  const halfW = Math.max(0.5, width / 2);
  const clampedRise = Math.max(0.15, Math.min(halfW, archRise));
  const radius = (halfW * halfW + clampedRise * clampedRise) / (2 * clampedRise);
  const halfAngle = Math.asin(Math.min(1, halfW / radius));
  const arcLength = 2 * radius * halfAngle;
  return {
    radius: Number(radius.toFixed(4)),
    arcLength: Number(arcLength.toFixed(4)),
  };
}

/**
 * Enforces a strict geometric constraint on tunnel dimensions (Width, Height, Wall Height, Crown Radius)
 * so that:
 * 1. The arch rise (Height - WallHeight) never exceeds Width/2 (preventing bulb distortion) or flattens out.
 * 2. The sum of the side wall lengths (2 * WallHeight) and Crown Arc Length (L_crown) maintains a strict,
 *    distortion-free perimeter ratio relative to Width and Height when resizing tunnel dimensions.
 */
export function enforceStrictTunnelGeometryConstraints(
  width: number,
  height: number,
  rawWallHeight?: number,
  profileType: ProfileType = 'd_shaped',
  _rawCrownRadius?: number
): {
  width: number;
  height: number;
  wallHeight: number;
  crownRadius: number;
  crownArcLength: number;
  totalPerimeter: number;
  perimeterRatio: number;
} {
  const safeWidth = Math.max(1.5, width);
  const safeHeight = Math.max(1.5, height);
  const halfW = safeWidth / 2;

  if (profileType === 'circular') {
    const wallHeight = Number((safeHeight * 0.5).toFixed(2));
    const rX = halfW;
    const rY = safeHeight / 2;
    // Ramanujan ellipse semi-perimeter for upper crown arch
    const hParam = Math.pow(rX - rY, 2) / Math.pow(rX + rY, 2);
    const crownArcLength = Number(
      ((Math.PI * (rX + rY) * (1 + (3 * hParam) / (10 + Math.sqrt(4 - 3 * hParam)))) / 2).toFixed(2)
    );
    const crownRadius = Number(((rX + rY) / 2).toFixed(2));
    const totalPerimeter = Number((2 * wallHeight + crownArcLength).toFixed(2));
    return {
      width: Number(safeWidth.toFixed(2)),
      height: Number(safeHeight.toFixed(2)),
      wallHeight,
      crownRadius,
      crownArcLength,
      totalPerimeter,
      perimeterRatio: Number((totalPerimeter / (safeWidth + safeHeight)).toFixed(4)),
    };
  }

  // Sequential Excavation — Top Heading Only (Lower Bench Part Removed):
  // Only the upper Top Heading arch (plus optional short upper heading wall, default 0.00m) is mapped.
  if (profileType === 'top_heading') {
    const maxTopWall = Math.max(0, safeHeight - 0.6);
    const finalWallHeight =
      typeof rawWallHeight === 'number' && Number.isFinite(rawWallHeight) && rawWallHeight >= 0
        ? Number(Math.min(maxTopWall, Math.max(0, rawWallHeight)).toFixed(2))
        : 0;
    const archRise = Math.max(0.35, Math.min(halfW * 0.99, safeHeight - finalWallHeight));
    const topHeadingHeight = Number((finalWallHeight + archRise).toFixed(2));
    const { radius: exactRadius, arcLength: baseArcLen } = computeAnalyticalArchMetrics(
      safeWidth,
      archRise
    );
    const crownArcLength = Number(baseArcLen.toFixed(2));
    const crownRadius = Number(exactRadius.toFixed(2));
    const totalPerimeter = Number((2 * finalWallHeight + crownArcLength).toFixed(2));
    return {
      width: Number(safeWidth.toFixed(2)),
      height: topHeadingHeight,
      wallHeight: finalWallHeight,
      crownRadius,
      crownArcLength,
      totalPerimeter,
      perimeterRatio: Number((totalPerimeter / (safeWidth + topHeadingHeight)).toFixed(4)),
    };
  }

  // Geometric arch-rise bounds to prevent any distortion when resizing Width or Height:
  // Arch rise h_arch = H - H_w must not exceed halfW (semicircle limit) and must be >= 0.22 * min(W, H)
  const maxArchRise = Math.min(halfW * 0.98, safeHeight * 0.55);
  const minArchRise = Math.min(maxArchRise, Math.max(0.35, Math.min(safeWidth * 0.22, safeHeight * 0.25)));

  // Target total perimeter P_target = FIXED_TUNNEL_PERIMETER_RATIO * (W + H)
  const targetPerimeter = FIXED_TUNNEL_PERIMETER_RATIO * (safeWidth + safeHeight);

  // Solve for archRise within [minArchRise, maxArchRise] that satisfies P(h_arch) = 2*(H - h_arch) + L_crown(W, h_arch) = targetPerimeter
  // Note: dP/dh_arch = -2 + dL_crown/dh_arch < 0 because 2*wallHeight decreases faster than arc length increases.
  let bestRise = Math.max(minArchRise, Math.min(maxArchRise, safeHeight * (1 - CANONICAL_WALL_TO_HEIGHT_RATIO)));
  let low = minArchRise;
  let high = maxArchRise;
  for (let iter = 0; iter < 24; iter++) {
    const mid = 0.5 * (low + high);
    const { arcLength } = computeAnalyticalArchMetrics(safeWidth, mid);
    const perim = 2 * (safeHeight - mid) + arcLength;
    if (perim > targetPerimeter) {
      low = mid; // Need larger archRise (smaller wallHeight) to reduce perimeter
    } else {
      high = mid;
    }
    bestRise = 0.5 * (low + high);
  }

  // If the caller supplied an explicit rawWallHeight that is already within the non-distorted structural envelope
  // (within ±8% of the fixed-perimeter-ratio wall height and not violating arch rise limits), blend/clamp it safely
  const constrainedWallHeightIdeal = safeHeight - bestRise;
  let finalWallHeight = constrainedWallHeightIdeal;
  if (typeof rawWallHeight === 'number' && Number.isFinite(rawWallHeight)) {
    const userRise = safeHeight - rawWallHeight;
    const minValidWallH = safeHeight - maxArchRise;
    const maxValidWallH = safeHeight - minArchRise;
    const deviationRatio = Math.abs(rawWallHeight - constrainedWallHeightIdeal) / Math.max(1, safeHeight);
    if (userRise >= minArchRise && userRise <= maxArchRise && deviationRatio <= 0.08) {
      finalWallHeight = Math.max(minValidWallH, Math.min(maxValidWallH, rawWallHeight));
    } else {
      finalWallHeight = constrainedWallHeightIdeal;
    }
  }

  finalWallHeight = Number(finalWallHeight.toFixed(2));
  const finalArchRise = Math.max(0.25, safeHeight - finalWallHeight);
  const { radius: exactRadius, arcLength: baseArcLen } = computeAnalyticalArchMetrics(
    safeWidth,
    finalArchRise
  );

  const shapeArcFactor = profileType === 'flat_arch' ? 1.025 : 1.0;
  const crownArcLength = Number((baseArcLen * shapeArcFactor).toFixed(2));
  const crownRadius = Number(exactRadius.toFixed(2));
  const totalPerimeter = Number((2 * finalWallHeight + crownArcLength).toFixed(2));

  return {
    width: Number(safeWidth.toFixed(2)),
    height: Number(safeHeight.toFixed(2)),
    wallHeight: finalWallHeight,
    crownRadius,
    crownArcLength,
    totalPerimeter,
    perimeterRatio: Number((totalPerimeter / (safeWidth + safeHeight)).toFixed(4)),
  };
}

/**
 * Generates real-world cross-section boundary polygon in meters.
 * Coordinate convention for Face cross-section:
 * x = 0 is tunnel centerline, x in [-width/2, +width/2]
 * y = 0 is tunnel floor/invert, y = height is crown apex.
 */
export function buildTunnelCrossSection(
  width: number,
  height: number,
  wallHeight: number,
  profileType: ProfileType,
  crownRadius?: number,
  customPoints?: Point2D[]
): {
  crossSectionPoints: Point2D[];
  crownArcLength: number;
  effectiveCrownRadius: number;
  constrainedWallHeight: number;
} {
  const constrained = enforceStrictTunnelGeometryConstraints(
    width,
    height,
    wallHeight,
    profileType,
    crownRadius
  );
  const safeWidth = constrained.width;
  const safeHeight = constrained.height;
  const safeWallHeight = constrained.wallHeight;
  const halfW = safeWidth / 2;
  const archRise = Math.max(0.25, safeHeight - safeWallHeight);

  const isCustomProfileType =
    profileType === 'custom_cad' ||
    profileType === 'freeform_custom' ||
    profileType === 'powerhouse_cavern' ||
    profileType === 'transformer_hall' ||
    profileType === 'cavern_junction' ||
    profileType === 'asymmetric_cavern';

  if (isCustomProfileType && customPoints && customPoints.length >= 3) {
    const xs = customPoints.map((p) => p.x);
    const ys = customPoints.map((p) => p.y);
    const actualW = Math.max(1.0, Math.max(...xs) - Math.min(...xs));
    const actualH = Math.max(1.0, Math.max(...ys) - Math.min(...ys));
    const safeWallH = Math.max(0.5, Math.min(actualH * 0.92, wallHeight || actualH * 0.58));
    const crownArcLength = computeCrownArcLength(customPoints, safeWallH);
    return {
      crossSectionPoints: customPoints,
      crownArcLength: Number(crownArcLength.toFixed(2)),
      effectiveCrownRadius: Number((crownRadius || actualW * 0.55).toFixed(2)),
      constrainedWallHeight: Number(safeWallH.toFixed(2)),
    };
  }

  const pts: Point2D[] = [];
  const numArchSteps = 48;

  if (profileType === 'circular') {
    const rX = halfW;
    const rY = safeHeight / 2;
    const cY = safeHeight / 2;
    for (let i = 0; i <= 64; i++) {
      const theta = -Math.PI / 2 + (i / 64) * 2 * Math.PI;
      pts.push({
        x: Number((rX * Math.cos(theta)).toFixed(4)),
        y: Number((cY + rY * Math.sin(theta)).toFixed(4)),
      });
    }
    return {
      crossSectionPoints: pts,
      crownArcLength: constrained.crownArcLength,
      effectiveCrownRadius: constrained.crownRadius,
      constrainedWallHeight: safeWallHeight,
    };
  }

  // Exact circular arch geometry above springline y = safeWallHeight
  const R = (halfW * halfW + archRise * archRise) / (2 * archRise);
  const centerY = safeHeight - R;
  const startAngle = Math.atan2(safeWallHeight - centerY, -halfW);
  const endAngle = Math.atan2(safeWallHeight - centerY, halfW);

  if (profileType === 'horseshoe') {
    const invertHalfW = halfW * 0.88;
    pts.push({ x: -invertHalfW, y: 0 });
    const wallSteps = 14;
    for (let i = 1; i <= wallSteps; i++) {
      const t = i / wallSteps;
      const x = -invertHalfW - (halfW - invertHalfW) * Math.sin((t * Math.PI) / 2);
      const y = t * safeWallHeight;
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    for (let i = 1; i < numArchSteps; i++) {
      const t = i / numArchSteps;
      const theta = startAngle + t * (endAngle - startAngle);
      const x = R * Math.cos(theta);
      const y = centerY + R * Math.sin(theta);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    for (let i = 0; i <= wallSteps; i++) {
      const t = 1 - i / wallSteps;
      const x = invertHalfW + (halfW - invertHalfW) * Math.sin((t * Math.PI) / 2);
      const y = t * safeWallHeight;
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
  } else if (profileType === 'flat_arch') {
    pts.push({ x: -halfW, y: 0 });
    pts.push({ x: -halfW, y: safeWallHeight });
    for (let i = 1; i < numArchSteps; i++) {
      const t = i / numArchSteps;
      const angle = Math.PI * (1 - t);
      const x = halfW * Math.cos(angle);
      const sinVal = Math.pow(Math.max(0, Math.sin(angle)), 0.78);
      const y = safeWallHeight + archRise * sinVal;
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    pts.push({ x: halfW, y: safeWallHeight });
    pts.push({ x: halfW, y: 0 });
  } else if (profileType === 'top_heading') {
    // Sequential Excavation — Top Heading Only (Lower Bench Part Removed)
    pts.push({ x: -halfW, y: 0 });
    if (safeWallHeight > 0.02) {
      pts.push({ x: -halfW, y: safeWallHeight });
    }
    for (let i = 1; i < numArchSteps; i++) {
      const t = i / numArchSteps;
      const theta = startAngle + t * (endAngle - startAngle);
      const x = R * Math.cos(theta);
      const y = centerY + R * Math.sin(theta);
      pts.push({ x: Number(x.toFixed(4)), y: Number(Math.max(0, y).toFixed(4)) });
    }
    if (safeWallHeight > 0.02) {
      pts.push({ x: halfW, y: safeWallHeight });
    }
    pts.push({ x: halfW, y: 0 });
  } else {
    pts.push({ x: -halfW, y: 0 });
    pts.push({ x: -halfW, y: safeWallHeight });

    for (let i = 1; i < numArchSteps; i++) {
      const t = i / numArchSteps;
      const theta = startAngle + t * (endAngle - startAngle);
      const x = R * Math.cos(theta);
      const y = centerY + R * Math.sin(theta);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }

    pts.push({ x: halfW, y: safeWallHeight });
    pts.push({ x: halfW, y: 0 });
  }

  const polyCrownArc = computeCrownArcLength(pts, safeWallHeight);
  const exactCrownArc =
    profileType === 'flat_arch' ? Number(polyCrownArc.toFixed(2)) : constrained.crownArcLength;

  return {
    crossSectionPoints: pts,
    crownArcLength: exactCrownArc,
    effectiveCrownRadius: Number(R.toFixed(2)),
    constrainedWallHeight: safeWallHeight,
  };
}

export function computeCrownArcLength(points: Point2D[], wallHeight: number): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1.y >= wallHeight - 0.02 && p2.y >= wallHeight - 0.02 && (p1.y > wallHeight + 0.001 || p2.y > wallHeight + 0.001)) {
      length += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
  }
  if (length < 1) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(0.3, Math.max(...ys) - wallHeight);
    return computeAnalyticalArchMetrics(w, h).arcLength;
  }
  return length;
}

export function createTunnelGeometry(
  width: number,
  height: number,
  wallHeight: number,
  crownGeometry: ProfileType,
  crownRadius?: number,
  source: TunnelGeometry['source'] = 'manual',
  cadFileName?: string,
  customPoints?: Point2D[]
): TunnelGeometry {
  const {
    crossSectionPoints,
    crownArcLength,
    effectiveCrownRadius,
    constrainedWallHeight,
  } = buildTunnelCrossSection(
    width,
    height,
    wallHeight,
    crownGeometry,
    crownRadius,
    customPoints
  );

  const xs = crossSectionPoints.map((p) => p.x);
  const ys = crossSectionPoints.map((p) => p.y);
  const minX = xs.length > 0 ? Number(Math.min(...xs).toFixed(3)) : -width / 2;
  const maxX = xs.length > 0 ? Number(Math.max(...xs).toFixed(3)) : width / 2;
  const minY = ys.length > 0 ? Number(Math.min(...ys).toFixed(3)) : 0;
  const maxY = ys.length > 0 ? Number(Math.max(...ys).toFixed(3)) : height;

  // Compute exact closed perimeter and Shoelace area from crossSectionPoints
  let totalPerimeter = 0;
  let shoelaceSum = 0;
  for (let i = 0; i < crossSectionPoints.length; i++) {
    const a = crossSectionPoints[i];
    const b = crossSectionPoints[(i + 1) % crossSectionPoints.length];
    totalPerimeter += Math.hypot(b.x - a.x, b.y - a.y);
    shoelaceSum += a.x * b.y - b.x * a.y;
  }

  const isTopHeading = crownGeometry === 'top_heading';

  return {
    width: Number(Math.max(1.5, maxX - minX || width).toFixed(3)),
    height: Number(Math.max(1.0, maxY - minY || height).toFixed(3)),
    wallHeight: Number(constrainedWallHeight.toFixed(3)),
    leftWallHeight: Number(constrainedWallHeight.toFixed(3)),
    rightWallHeight: Number(constrainedWallHeight.toFixed(3)),
    leftWallArcLength: Number(constrainedWallHeight.toFixed(3)),
    rightWallArcLength: Number(constrainedWallHeight.toFixed(3)),
    hasCrown: true,
    hasLeftWall: true,
    hasRightWall: true,
    excavationStage: isTopHeading ? 'TOP_HEADING' : 'FULL_FACE',
    totalPerimeterMeters: Number(totalPerimeter.toFixed(3)),
    designAreaSqMeters: Number((Math.abs(shoelaceSum) * 0.5).toFixed(3)),
    minX,
    maxX,
    minY,
    maxY,
    crownGeometry,
    crownRadius: effectiveCrownRadius,
    units: 'm',
    source,
    cadFileName,
    crossSectionPoints,
    crownArcLength,
  };
}

export interface TopHeadingBenchingOptions {
  benchHeightMeters?: number;          // Lower bench height to remove from the shape (m)
  leftBenchHeightMeters?: number;      // Optional left bench height to remove (m)
  rightBenchHeightMeters?: number;     // Optional right bench height to remove (m)
  topHeadingHeightMeters?: number;     // Optional target Top Heading total height (m)
  topHeadingLeftWallMeters?: number;   // Optional explicit Top Heading Left Wall height (m)
  topHeadingRightWallMeters?: number;  // Optional explicit Top Heading Right Wall height (m)
  keepUpperWallMeters?: number;        // Legacy alias for explicit Top Heading wall height
}

/**
 * Slices a closed 2D tunnel cross-section polygon horizontally at the bench cut elevation
 * and shifts the remaining Top Heading polygon down so y = 0 is the Top Heading floor (bench top).
 */
function clipCrossSectionPolygonAboveBench(
  fullPoints: Point2D[],
  leftBenchCutY: number,
  rightBenchCutY: number
): Point2D[] {
  if (!fullPoints || fullPoints.length < 3) return fullPoints;
  const xs = fullPoints.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = Math.max(0.5, maxX - minX);

  const getCutYAtX = (x: number) => {
    const t = Math.max(0, Math.min(1, (x - minX) / spanX));
    return leftBenchCutY + (rightBenchCutY - leftBenchCutY) * t;
  };

  // Standard polygon clipping against half-plane: y >= getCutYAtX(x)
  const clippedRaw: Point2D[] = [];
  const n = fullPoints.length;
  for (let i = 0; i < n; i++) {
    const curr = fullPoints[i];
    const next = fullPoints[(i + 1) % n];
    const currCut = getCutYAtX(curr.x);
    const nextCut = getCutYAtX(next.x);
    const currInside = curr.y >= currCut - 1e-4;
    const nextInside = next.y >= nextCut - 1e-4;

    if (currInside && nextInside) {
      clippedRaw.push(next);
    } else if (currInside && !nextInside) {
      const dCurr = curr.y - currCut;
      const dNext = next.y - nextCut;
      const denom = dCurr - dNext;
      const t = Math.abs(denom) > 1e-6 ? Math.max(0, Math.min(1, dCurr / denom)) : 0.5;
      const ix = curr.x + t * (next.x - curr.x);
      const iy = getCutYAtX(ix);
      clippedRaw.push({ x: ix, y: iy });
    } else if (!currInside && nextInside) {
      const dCurr = curr.y - currCut;
      const dNext = next.y - nextCut;
      const denom = dCurr - dNext;
      const t = Math.abs(denom) > 1e-6 ? Math.max(0, Math.min(1, dCurr / denom)) : 0.5;
      const ix = curr.x + t * (next.x - curr.x);
      const iy = getCutYAtX(ix);
      clippedRaw.push({ x: ix, y: iy });
      clippedRaw.push(next);
    }
  }

  if (clippedRaw.length < 3) {
    return fullPoints;
  }

  const baseDatumY = Math.min(leftBenchCutY, rightBenchCutY);
  // Deduplicate adjacent identical points and shift down so y = 0 is the Top Heading bench floor
  const shifted: Point2D[] = [];
  for (const pt of clippedRaw) {
    const shiftedPt: Point2D = {
      x: Number(pt.x.toFixed(4)),
      y: Number(Math.max(0, pt.y - baseDatumY).toFixed(4)),
    };
    if (
      shifted.length === 0 ||
      Math.hypot(
        shiftedPt.x - shifted[shifted.length - 1].x,
        shiftedPt.y - shifted[shifted.length - 1].y
      ) > 1e-3
    ) {
      shifted.push(shiftedPt);
    }
  }
  return shifted.length >= 3 ? shifted : fullPoints;
}

/**
 * Converts any Full-Face `TunnelGeometry` into a **Top Heading** geometry by removing the
 * lower Bench Portion (`benchHeightMeters`) from the bottom of the tunnel shape while
 * preserving the Top Heading Left Wall, Top Heading Right Wall, and Crown Arch!
 */
export function convertTunnelGeometryToSequentialTopHeading(
  geometry: TunnelGeometry,
  options?: TopHeadingBenchingOptions
): TunnelGeometry {
  const isAlreadyTopHeading =
    geometry.excavationStage === 'TOP_HEADING' ||
    geometry.excavationStage === 'top_heading';

  const prevBenchRemoved =
    isAlreadyTopHeading && geometry.benchHeightRemovedMeters
      ? geometry.benchHeightRemovedMeters
      : 0;
  const prevLeftBenchRemoved =
    isAlreadyTopHeading && geometry.leftBenchHeightMeters !== undefined
      ? geometry.leftBenchHeightMeters
      : prevBenchRemoved;
  const prevRightBenchRemoved =
    isAlreadyTopHeading && geometry.rightBenchHeightMeters !== undefined
      ? geometry.rightBenchHeightMeters
      : prevBenchRemoved;

  const fullW = Math.max(1.5, geometry.width || 8.4);
  const fullH = Math.max(
    2.0,
    geometry.fullSectionHeightMeters ||
      geometry.fullSectionTotalHeightMeters ||
      geometry.height + prevBenchRemoved ||
      7.2
  );
  const fullLeftWallH = Math.max(
    0.8,
    geometry.fullSectionWallHeightMeters ||
      (geometry.leftWallHeight ?? geometry.wallHeight) + prevLeftBenchRemoved ||
      fullH * 0.58
  );
  const fullRightWallH = Math.max(
    0.8,
    geometry.fullSectionRightWallHeightMeters ||
      (geometry.rightWallHeight ?? geometry.wallHeight) + prevRightBenchRemoved ||
      fullLeftWallH
  );

  const baseProfileType: ProfileType =
    geometry.crownGeometry === 'top_heading' ? 'd_shaped' : geometry.crownGeometry;

  // Recover or build the authoritative Full-Face cross-section polygon prior to bench removal
  const fullSectionPoints: Point2D[] =
    geometry.fullSectionCrossSectionPoints && geometry.fullSectionCrossSectionPoints.length >= 3
      ? geometry.fullSectionCrossSectionPoints
      : !isAlreadyTopHeading && geometry.crossSectionPoints && geometry.crossSectionPoints.length >= 3
      ? geometry.crossSectionPoints
      : buildTunnelCrossSection(
          fullW,
          fullH,
          fullLeftWallH,
          baseProfileType,
          geometry.crownRadius
        ).crossSectionPoints;

  // Default bench height = ~60% of the full wall height (so e.g. 4.2m wall -> 2.5m bench removed, 1.7m Top Heading wall remaining)
  const defaultBenchH = Number(
    Math.max(0.8, Math.min(fullLeftWallH - 0.6, fullLeftWallH * 0.6)).toFixed(2)
  );

  let benchRemoved =
    typeof options?.benchHeightMeters === 'number' && Number.isFinite(options.benchHeightMeters)
      ? options.benchHeightMeters
      : typeof options?.topHeadingHeightMeters === 'number' &&
        Number.isFinite(options.topHeadingHeightMeters)
      ? fullH - options.topHeadingHeightMeters
      : typeof options?.keepUpperWallMeters === 'number' &&
        options.keepUpperWallMeters > 0
      ? fullLeftWallH - options.keepUpperWallMeters
      : prevBenchRemoved > 0.2
      ? prevBenchRemoved
      : defaultBenchH;

  benchRemoved = Number(
    Math.max(0.2, Math.min(fullH - 1.0, benchRemoved)).toFixed(2)
  );

  const leftBenchRemoved = Number(
    Math.max(
      0.2,
      Math.min(
        fullH - 1.0,
        options?.leftBenchHeightMeters !== undefined ? options.leftBenchHeightMeters : benchRemoved
      )
    ).toFixed(2)
  );
  const rightBenchRemoved = Number(
    Math.max(
      0.2,
      Math.min(
        fullH - 1.0,
        options?.rightBenchHeightMeters !== undefined
          ? options.rightBenchHeightMeters
          : benchRemoved
      )
    ).toFixed(2)
  );

  const rawMinY =
    fullSectionPoints.length > 0 ? Math.min(...fullSectionPoints.map((p) => p.y)) : 0;
  const clippedPoints = clipCrossSectionPolygonAboveBench(
    fullSectionPoints,
    rawMinY + leftBenchRemoved,
    rawMinY + rightBenchRemoved
  );

  const xs = clippedPoints.map((p) => p.x);
  const ys = clippedPoints.map((p) => p.y);
  const minX = Number(Math.min(...xs).toFixed(3));
  const maxX = Number(Math.max(...xs).toFixed(3));
  const minY = Number(Math.min(...ys).toFixed(3));
  const maxY = Number(Math.max(...ys).toFixed(3));

  const topHeadingWidth = Number(Math.max(1.5, maxX - minX).toFixed(3));
  const topHeadingHeight = Number(Math.max(1.0, maxY - minY).toFixed(3));

  // Top Heading Left Wall & Right Wall Heights (remaining wall above bench cut, always >= 0.40m so walls exist on Top Heading)
  const topLeftWallH = Number(
    Math.max(
      0.4,
      options?.topHeadingLeftWallMeters !== undefined
        ? options.topHeadingLeftWallMeters
        : fullLeftWallH - leftBenchRemoved
    ).toFixed(2)
  );
  const topRightWallH = Number(
    Math.max(
      0.4,
      options?.topHeadingRightWallMeters !== undefined
        ? options.topHeadingRightWallMeters
        : fullRightWallH - rightBenchRemoved
    ).toFixed(2)
  );
  const topWallH = Number(Math.max(topLeftWallH, topRightWallH).toFixed(2));

  let perim = 0;
  let area2 = 0;
  for (let i = 0; i < clippedPoints.length; i++) {
    const a = clippedPoints[i];
    const b = clippedPoints[(i + 1) % clippedPoints.length];
    perim += Math.hypot(b.x - a.x, b.y - a.y);
    area2 += a.x * b.y - b.x * a.y;
  }

  const crownArc =
    geometry.crownArcLength && geometry.crownArcLength > 1
      ? geometry.crownArcLength
      : Number(computeCrownArcLength(clippedPoints, topWallH).toFixed(2));

  const cleanBaseName = (geometry.profileName || baseProfileType.replace(/_/g, ' ').toUpperCase())
    .replace(/\s*·\s*Top Heading.*$/i, '')
    .replace(/\s*\(Top Heading.*$/i, '');

  return {
    ...geometry,
    width: topHeadingWidth,
    height: topHeadingHeight,
    wallHeight: topWallH,
    leftWallHeight: topLeftWallH,
    rightWallHeight: topRightWallH,
    leftWallArcLength: topLeftWallH,
    rightWallArcLength: topRightWallH,
    hasCrown: true,
    hasLeftWall: true,
    hasRightWall: true,
    excavationStage: 'TOP_HEADING',
    benchHeightRemovedMeters: benchRemoved,
    leftBenchHeightMeters: leftBenchRemoved,
    rightBenchHeightMeters: rightBenchRemoved,
    fullSectionHeightMeters: Number(fullH.toFixed(2)),
    fullSectionTotalHeightMeters: Number(fullH.toFixed(2)),
    fullSectionWallHeightMeters: Number(fullLeftWallH.toFixed(2)),
    fullSectionRightWallHeightMeters: Number(fullRightWallH.toFixed(2)),
    fullSectionCrossSectionPoints: fullSectionPoints,
    minX,
    maxX,
    minY,
    maxY,
    crownGeometry: baseProfileType,
    crownArcLength: crownArc,
    totalPerimeterMeters: Number(perim.toFixed(3)),
    designAreaSqMeters: Number((Math.abs(area2) * 0.5).toFixed(3)),
    crossSectionPoints: clippedPoints,
    profileName: `${cleanBaseName} · Top Heading (Bench ${benchRemoved.toFixed(2)}m Removed)`,
  };
}

/**
 * Restores a Full-Face `TunnelGeometry` (Top Heading + Lower Bench) from a Top-Heading section.
 */
export function restoreFullFaceFromTopHeading(geometry: TunnelGeometry): TunnelGeometry {
  const fullW = Math.max(1.5, geometry.width || 8.4);
  const benchRemoved = geometry.benchHeightRemovedMeters || 2.5;
  const fullH = Math.max(
    2.0,
    geometry.fullSectionHeightMeters ||
      geometry.fullSectionTotalHeightMeters ||
      geometry.height + benchRemoved
  );
  const fullLeftWallH = Math.max(
    0.8,
    geometry.fullSectionWallHeightMeters ||
      (geometry.leftWallHeight ?? geometry.wallHeight) +
        (geometry.leftBenchHeightMeters ?? benchRemoved)
  );
  const fullRightWallH = Math.max(
    0.8,
    geometry.fullSectionRightWallHeightMeters ||
      (geometry.rightWallHeight ?? geometry.wallHeight) +
        (geometry.rightBenchHeightMeters ?? benchRemoved)
  );
  const nextProfileType: ProfileType =
    geometry.crownGeometry === 'top_heading' ? 'd_shaped' : geometry.crownGeometry;

  if (
    geometry.fullSectionCrossSectionPoints &&
    geometry.fullSectionCrossSectionPoints.length >= 3
  ) {
    const pts = geometry.fullSectionCrossSectionPoints;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    let perim = 0;
    let area2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      perim += Math.hypot(b.x - a.x, b.y - a.y);
      area2 += a.x * b.y - b.x * a.y;
    }
    const cleanName = (geometry.profileName || '')
      .replace(/\s*·\s*Top Heading.*$/i, '')
      .replace(/\s*\(Top Heading.*$/i, '');

    return {
      ...geometry,
      width: Number((Math.max(...xs) - Math.min(...xs)).toFixed(3)),
      height: Number((Math.max(...ys) - Math.min(...ys)).toFixed(3)),
      wallHeight: Number(Math.max(fullLeftWallH, fullRightWallH).toFixed(2)),
      leftWallHeight: Number(fullLeftWallH.toFixed(2)),
      rightWallHeight: Number(fullRightWallH.toFixed(2)),
      leftWallArcLength: Number(fullLeftWallH.toFixed(2)),
      rightWallArcLength: Number(fullRightWallH.toFixed(2)),
      hasCrown: true,
      hasLeftWall: true,
      hasRightWall: true,
      excavationStage: 'FULL_FACE',
      benchHeightRemovedMeters: 0,
      leftBenchHeightMeters: 0,
      rightBenchHeightMeters: 0,
      minX: Number(Math.min(...xs).toFixed(3)),
      maxX: Number(Math.max(...xs).toFixed(3)),
      minY: Number(Math.min(...ys).toFixed(3)),
      maxY: Number(Math.max(...ys).toFixed(3)),
      crownGeometry: nextProfileType,
      totalPerimeterMeters: Number(perim.toFixed(3)),
      designAreaSqMeters: Number((Math.abs(area2) * 0.5).toFixed(3)),
      crossSectionPoints: pts,
      profileName: cleanName || `Full Face Tunnel (${fullW.toFixed(2)}m × ${fullH.toFixed(2)}m)`,
    };
  }

  const built = createTunnelGeometry(
    fullW,
    fullH,
    fullLeftWallH,
    nextProfileType,
    geometry.crownRadius,
    geometry.source,
    geometry.cadFileName
  );

  return {
    ...built,
    leftWallHeight: Number(fullLeftWallH.toFixed(2)),
    rightWallHeight: Number(fullRightWallH.toFixed(2)),
    leftWallArcLength: Number(fullLeftWallH.toFixed(2)),
    rightWallArcLength: Number(fullRightWallH.toFixed(2)),
    excavationStage: 'FULL_FACE',
    benchHeightRemovedMeters: 0,
    leftBenchHeightMeters: 0,
    rightBenchHeightMeters: 0,
    fullSectionHeightMeters: fullH,
    fullSectionWallHeightMeters: fullLeftWallH,
    fullSectionRightWallHeightMeters: fullRightWallH,
    hasCrown: true,
    hasLeftWall: true,
    hasRightWall: true,
    profileName: geometry.profileName
      ? geometry.profileName
          .replace(/\s*·\s*Top Heading.*$/i, '')
          .replace(/\s*\(Top Heading.*$/i, '')
      : `Full Face Tunnel (${fullW.toFixed(2)}m × ${fullH.toFixed(2)}m)`,
  };
}

export function getSurfaceBoundsMeters(
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  const roundLen = Math.max(1.0, settings.roundLength || 3.5);
  switch (surface) {
    case 'face': {
      const minX =
        typeof geometry.minX === 'number' && Number.isFinite(geometry.minX)
          ? geometry.minX
          : -geometry.width / 2;
      const maxX =
        typeof geometry.maxX === 'number' && Number.isFinite(geometry.maxX)
          ? geometry.maxX
          : geometry.width / 2;
      const minY =
        typeof geometry.minY === 'number' && Number.isFinite(geometry.minY)
          ? geometry.minY
          : 0;
      const maxY =
        typeof geometry.maxY === 'number' && Number.isFinite(geometry.maxY)
          ? geometry.maxY
          : geometry.height;
      return {
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(1.0, maxX - minX),
        height: Math.max(1.0, maxY - minY),
      };
    }
    case 'crown': {
      // Unfolded Crown surface width strictly equals the actual developed Crown Arc Length (geometry.crownArcLength)
      const span = Math.max(0.5, geometry.crownArcLength || geometry.width);
      return {
        minX: -span / 2,
        maxX: span / 2,
        minY: 0,
        maxY: roundLen,
        width: span,
        height: roundLen,
      };
    }
    case 'leftWall': {
      const leftWallH = Math.max(
        0.5,
        geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2
      );
      return {
        minX: 0,
        maxX: roundLen,
        minY: 0,
        maxY: leftWallH,
        width: roundLen,
        height: leftWallH,
      };
    }
    case 'rightWall': {
      const rightWallH = Math.max(
        0.5,
        geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2
      );
      return {
        minX: 0,
        maxX: roundLen,
        minY: 0,
        maxY: rightWallH,
        width: roundLen,
        height: rightWallH,
      };
    }
  }
}

export function isPointInsidePolygon(pt: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInsideSurface(
  pt: Point2D,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  marginMeters = 0.08
): boolean {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);
  if (surface === 'face') {
    if (
      pt.x < bounds.minX - marginMeters ||
      pt.x > bounds.maxX + marginMeters ||
      pt.y < bounds.minY - marginMeters ||
      pt.y > bounds.maxY + marginMeters
    ) {
      return false;
    }
    if (isPointInsidePolygon(pt, geometry.crossSectionPoints)) return true;
    return distanceToPolygonBoundary(pt, geometry.crossSectionPoints) <= marginMeters;
  }

  return (
    pt.x >= bounds.minX - marginMeters &&
    pt.x <= bounds.maxX + marginMeters &&
    pt.y >= bounds.minY - marginMeters &&
    pt.y <= bounds.maxY + marginMeters
  );
}

export function distanceToPolygonBoundary(pt: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const d = pointToSegmentDistance(pt, p1, p2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

export function pointToSegmentDistance(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/**
 * Projects any 2D point outside the active tunnel portion onto the nearest point
 * on the active tunnel portion boundary (exact cross-section polygon for Face, or
 * exact developed rectangle for Crown / Left Wall / Right Wall).
 */
export function clampPointToSurface(
  pt: Point2D,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): Point2D {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);
  if (surface !== 'face') {
    return {
      x: Number(Math.max(bounds.minX, Math.min(bounds.maxX, pt.x)).toFixed(4)),
      y: Number(Math.max(bounds.minY, Math.min(bounds.maxY, pt.y)).toFixed(4)),
    };
  }

  const poly = geometry.crossSectionPoints;
  if (!poly || poly.length < 3) {
    return {
      x: Number(Math.max(bounds.minX, Math.min(bounds.maxX, pt.x)).toFixed(4)),
      y: Number(Math.max(bounds.minY, Math.min(bounds.maxY, pt.y)).toFixed(4)),
    };
  }

  if (isPointInsidePolygon(pt, poly)) {
    return {
      x: Number(pt.x.toFixed(4)),
      y: Number(pt.y.toFixed(4)),
    };
  }

  // Find closest point on the crossSectionPoints polygon perimeter
  let bestX = pt.x;
  let bestY = pt.y;
  let minDist = Infinity;

  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    const w = poly[(i + 1) % poly.length];
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    let t = l2 > 1e-12 ? ((pt.x - v.x) * (w.x - v.x) + (pt.y - v.y) * (w.y - v.y)) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    const d = Math.hypot(pt.x - projX, pt.y - projY);
    if (d < minDist) {
      minDist = d;
      bestX = projX;
      bestY = projY;
    }
  }

  return {
    x: Number(bestX.toFixed(4)),
    y: Number(bestY.toFixed(4)),
  };
}

export function clipPolylineToSurface(
  points: Point2D[],
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): Point2D[] {
  if (points.length < 2) return points;
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);
  const poly = geometry.crossSectionPoints;

  const checkInside = (cand: Point2D): boolean => {
    if (surface === 'face' && poly && poly.length >= 3) {
      return (
        isPointInsidePolygon(cand, poly) ||
        distanceToPolygonBoundary(cand, poly) <= 0.025
      );
    }
    return (
      cand.x >= bounds.minX - 0.01 &&
      cand.x <= bounds.maxX + 0.01 &&
      cand.y >= bounds.minY - 0.01 &&
      cand.y <= bounds.maxY + 0.01
    );
  };

  // Clip every consecutive segment [pA, pB] to the active tunnel portion boundary
  // handling both entry (outside -> inside) and exit (inside -> outside) intersections.
  const clipped: Point2D[] = [];
  const SUBDIV = 32;

  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];
    const inA = checkInside(pA);
    const inB = checkInside(pB);

    if (inA && inB) {
      if (clipped.length === 0) {
        clipped.push(clampPointToSurface(pA, surface, geometry, settings));
      }
      clipped.push(clampPointToSurface(pB, surface, geometry, settings));
    } else {
      // Sample along segment [pA, pB] to find exact entry/exit points inside the boundary
      for (let s = 0; s <= SUBDIV; s++) {
        const t = s / SUBDIV;
        const cand = {
          x: pA.x + t * (pB.x - pA.x),
          y: pA.y + t * (pB.y - pA.y),
        };
        if (checkInside(cand)) {
          const clampedCand = clampPointToSurface(cand, surface, geometry, settings);
          if (
            clipped.length === 0 ||
            Math.hypot(
              clampedCand.x - clipped[clipped.length - 1].x,
              clampedCand.y - clipped[clipped.length - 1].y
            ) > 0.015
          ) {
            clipped.push(clampedCand);
          }
        }
      }
    }
  }

  if (clipped.length < 2) return [];
  return preserveGeologicalPolyline(clipped);
}

/**
 * CRITICAL GEOLOGICAL REALISM RULE (Sections 1, 2, 3):
 * Never straighten a real rock discontinuity into a 2-point CAD line.
 * Preserves multi-vertex polylines (P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7...)
 * including slight/strong curvature, stepped geometry, local bends, and undulations,
 * while removing only duplicate coincident pixel noise.
 */
export function preserveGeologicalPolyline(points: Point2D[], maxVertices = 18): Point2D[] {
  if (points.length <= 2) return points;

  // 1. Remove zero-length duplicate adjacent vertices
  const deduped: Point2D[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= 0.004) {
      deduped.push(points[i]);
    }
  }
  if (deduped.length <= 2) return deduped;

  // 2. Apply very gentle 3-point Chaikin/moving-window de-pixelation (0.15 weight on neighbors)
  // so 1-pixel raster stair-stepping is smoothed while every real geological bend, step, and undulation is kept.
  const smoothed: Point2D[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const pPrev = deduped[i - 1];
    const pCurr = deduped[i];
    const pNext = deduped[i + 1];
    smoothed.push({
      x: Number((0.14 * pPrev.x + 0.72 * pCurr.x + 0.14 * pNext.x).toFixed(4)),
      y: Number((0.14 * pPrev.y + 0.72 * pCurr.y + 0.14 * pNext.y).toFixed(4)),
    });
  }
  smoothed.push(deduped[deduped.length - 1]);

  if (smoothed.length <= maxVertices) {
    return smoothed;
  }

  // 3. Downsample along arc-length while always preserving local high-curvature bends/steps
  const result: Point2D[] = [smoothed[0]];
  const step = (smoothed.length - 1) / (maxVertices - 1);
  for (let k = 1; k < maxVertices - 1; k++) {
    const idx = Math.round(k * step);
    result.push(smoothed[idx]);
  }
  result.push(smoothed[smoothed.length - 1]);
  return result;
}

export function simplifyPolyline(points: Point2D[], _epsilon = 0.002): Point2D[] {
  return preserveGeologicalPolyline(points, 16);
}

/**
 * Solves a 3x3 Projective Homography Matrix H (row-major 9 numbers, H[8] = 1)
 * mapping unit square [(0,0), (1,0), (1,1), (0,1)] to target perspective quadrilateral
 * defined by 4 corner offsets [cTL, cTR, cBR, cBL].
 */
export function solveProjectiveHomography3x3(
  corners: [Point2D, Point2D, Point2D, Point2D]
): number[] {
  const src: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const dst: [number, number][] = [
    [0 + corners[0].x, 0 + corners[0].y],
    [1 + corners[1].x, 0 + corners[1].y],
    [1 + corners[2].x, 1 + corners[2].y],
    [0 + corners[3].x, 1 + corners[3].y],
  ];

  // Build 8x8 linear system A * h = b for H = [h0, h1, h2; h3, h4, h5; h6, h7, 1]
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }

  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) {
        maxRow = row;
      }
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];

    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-10) {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    for (let j = col; j < n; j++) A[col][j] /= pivot;
    b[col] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = A[row][col];
        for (let j = col; j < n; j++) {
          A[row][j] -= factor * A[col][j];
        }
        b[row] -= factor * b[col];
      }
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}

export function applyProjectiveHomography3x3(u: number, v: number, H: number[]): { u: number; v: number } {
  const denom = H[6] * u + H[7] * v + H[8];
  if (Math.abs(denom) < 1e-8) return { u, v };
  return {
    u: (H[0] * u + H[1] * v + H[2]) / denom,
    v: (H[3] * u + H[4] * v + H[5]) / denom,
  };
}

/**
 * Pipeline Step (Section 11):
 * IMAGE COORDINATES (u, v)
 * -> LENS UNDISTORTION
 * -> PROJECTIVE HOMOGRAPHY (H_3x3)
 * -> TUNNEL SURFACE COORDINATES (x, y in meters)
 */
/**
 * Pipeline Step (Section 11):
 * IMAGE COORDINATES (u, v in [0..1] on the active displayed/warped photograph)
 * -> TUNNEL SURFACE COORDINATES (x, y in meters)
 *
 * Guaranteed to match `photoUVToTunnelMeters` and the SVG `<g transform={photoSvgTransform}>`
 * rendering transform so that any feature at (u, v) in the photograph lands at the exact
 * same pixel on the mapping canvas.
 */
export function imageUVToSurfaceMeters(
  u: number,
  v: number,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  transform: SurfaceTransform,
  _calibration?: CameraCalibration,
  isAlreadyWarpedImage = true
): Point2D {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);

  let warpedU = u;
  let warpedV = v;

  if (!isAlreadyWarpedImage) {
    // Apply flip if set
    const uFlip = transform.flipH ? 1 - u : u;
    const vFlip = transform.flipV ? 1 - v : v;

    // Exact 3x3 Projective Homography Transformation
    const H =
      transform.homographyMatrix && transform.homographyMatrix.length === 9
        ? transform.homographyMatrix
        : solveProjectiveHomography3x3(transform.perspectiveCorners);

    const hom = applyProjectiveHomography3x3(uFlip, vFlip, H);
    warpedU = hom.u;
    warpedV = hom.v;

    // Apply piecewise mesh control point displacement if present
    if (transform.meshControlPoints && transform.meshControlPoints.length > 0) {
      let sumW = 0;
      let sumDu = 0;
      let sumDv = 0;
      for (const cp of transform.meshControlPoints) {
        const d2 = (uFlip - cp.srcU) * (uFlip - cp.srcU) + (vFlip - cp.srcV) * (vFlip - cp.srcV);
        if (d2 < 1e-7) {
          sumW = 1;
          sumDu = cp.dstU - cp.srcU;
          sumDv = cp.dstV - cp.srcV;
          break;
        }
        const w = 1 / Math.pow(d2 + 0.008, 1.35);
        sumW += w;
        sumDu += w * (cp.dstU - cp.srcU);
        sumDv += w * (cp.dstV - cp.srcV);
      }
      if (sumW > 1e-9) {
        warpedU += sumDu / sumW;
        warpedV += sumDv / sumW;
      }
    }
  }

  const zoom = transform.zoom ?? 1;
  let dx = (warpedU - 0.5) * bounds.width * (transform.scaleX || 1) * zoom;
  let dy = (0.5 - warpedV) * bounds.height * (transform.scaleY || 1) * zoom;

  if (Math.abs(transform.rotation) > 0.01) {
    // Note: in SVG Y-down space, clockwise rotation by +theta corresponds to
    // rotating (dx, dy) in Y-up meters by -theta
    const rad = (-transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: Number((centerX + dx + (transform.offsetX || 0)).toFixed(4)),
    y: Number((centerY + dy + (transform.offsetY || 0)).toFixed(4)),
  };
}

/**
 * Exact inverse of `imageUVToSurfaceMeters`:
 * Converts real-world surface coordinates (x, y in meters) back to normalized image UV [0, 1]
 * on the active displayed photograph so Computer Vision geodesic ridge snapping & seed tracking
 * sample the exact pixel under the user's cursor.
 */
export function surfaceMetersToImageUV(
  pt: Point2D,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  transform: SurfaceTransform
): { u: number; v: number } {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  let dx = pt.x - centerX - (transform.offsetX || 0);
  let dy = pt.y - centerY - (transform.offsetY || 0);

  if (Math.abs(transform.rotation) > 0.01) {
    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }

  const zoom = transform.zoom ?? 1;
  const u = 0.5 + dx / Math.max(0.05, bounds.width * (transform.scaleX || 1) * zoom);
  const v = 0.5 - dy / Math.max(0.05, bounds.height * (transform.scaleY || 1) * zoom);

  return {
    u: Math.max(0.005, Math.min(0.995, u)),
    v: Math.max(0.005, Math.min(0.995, v)),
  };
}

/**
 * Pipeline Step (Section 11):
 * TUNNEL SURFACE COORDINATES (x_s, y_s in meters)
 * -> TUNNEL 3D COORDINATES (East, North, Up in meters)
 *
 * Uses the master TunnelGeometry cross-section and Tunnel Drive Direction (Azimuth)
 * to project every 2D surface point onto the true 3D underground excavation shell:
 * - Local tunnel axes:
 *   X_local = Transverse Right [-width/2, +width/2]
 *   Y_local = Distance along Drive Direction (0 at current face, negative behind face along roundLength)
 *   Z_local = Elevation above invert [0, height]
 * - Then rotated by Tunnel Drive Azimuth alpha_d into geographic 3D (East, North, Up).
 */
/**
 * Samples the exact 2D cross-section coordinate (x = localRight, y = localUp) and inward 2D unit normal (nx, ny)
 * along the actual tunnel profile boundary (supporting custom freeform, asymmetric walls, transformer halls, and CAD profiles).
 */
export function sampleCrossSectionZoneArcLength(
  zone: 'leftWall' | 'crown' | 'rightWall',
  ratio01: number,
  geometry: TunnelGeometry
): { x: number; y: number; nx: number; ny: number } | null {
  const pts = geometry.crossSectionPoints;
  if (!pts || pts.length < 4) return null;

  const t = Math.max(0, Math.min(1, ratio01));
  const leftSpringH = geometry.leftWallHeight ?? geometry.wallHeight ?? geometry.height * 0.58;
  const rightSpringH = geometry.rightWallHeight ?? geometry.wallHeight ?? geometry.height * 0.58;

  // Separate perimeter points into Left Wall (bottom->top), Crown (left->right), Right Wall (bottom->top)
  const leftPts: Point2D[] = [];
  const crownPts: Point2D[] = [];
  const rightPts: Point2D[] = [];

  for (const p of pts) {
    if (p.x <= 0 && p.y <= leftSpringH + 0.08) {
      leftPts.push(p);
    }
    if (p.y >= Math.min(leftSpringH, rightSpringH) - 0.08 && (geometry.hasCrown !== false)) {
      crownPts.push(p);
    }
    if (p.x >= 0 && p.y <= rightSpringH + 0.08) {
      rightPts.push(p);
    }
  }

  leftPts.sort((a, b) => a.y - b.y);
  crownPts.sort((a, b) => a.x - b.x);
  rightPts.sort((a, b) => a.y - b.y);

  const targetPoly =
    zone === 'leftWall' ? leftPts : zone === 'crown' ? crownPts : rightPts;
  if (targetPoly.length < 2) return null;

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < targetPoly.length - 1; i++) {
    const d = Math.hypot(
      targetPoly[i + 1].x - targetPoly[i].x,
      targetPoly[i + 1].y - targetPoly[i].y
    );
    segLengths.push(d);
    totalLen += d;
  }
  if (totalLen < 1e-4) return null;

  const targetDist = t * totalLen;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const sl = segLengths[i];
    if (acc + sl >= targetDist || i === segLengths.length - 1) {
      const localT = sl > 1e-6 ? Math.max(0, Math.min(1, (targetDist - acc) / sl)) : 0;
      const p0 = targetPoly[i];
      const p1 = targetPoly[i + 1];
      const x = p0.x + localT * (p1.x - p0.x);
      const y = p0.y + localT * (p1.y - p0.y);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const mag = Math.max(1e-6, Math.hypot(dx, dy));
      // Point inward toward tunnel centerline (0, wallH/2)
      let nx = dy / mag;
      let ny = -dx / mag;
      const toCenterX = 0 - x;
      const toCenterY = Math.max(1.0, geometry.wallHeight * 0.5) - y;
      if (nx * toCenterX + ny * toCenterY < 0) {
        nx = -nx;
        ny = -ny;
      }
      return { x, y, nx, ny };
    }
    acc += sl;
  }
  return null;
}

export function surfacePointTo3DTunnelCoords(
  pt: Point2D,
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): Point3D {
  const halfW = Math.max(0.5, geometry.width / 2);
  const wallH = geometry.wallHeight;
  const totalH = geometry.height;
  const archRise = Math.max(0.3, totalH - wallH);
  const R = Math.max(halfW, geometry.crownRadius || (halfW * halfW + archRise * archRise) / (2 * archRise));
  const isCustomOrAsymmetric =
    Boolean(geometry.isAuthoritativeCustom || geometry.customProfile) ||
    geometry.crownGeometry === 'freeform_custom' ||
    geometry.crownGeometry === 'custom_cad' ||
    Math.abs((geometry.leftWallArcLength ?? wallH) - (geometry.rightWallArcLength ?? wallH)) > 0.05;

  let localRight = 0; // Master X: Tunnel Transverse direction (m)
  let localUp = 0;    // Master Y: Tunnel Vertical direction (m)
  let localDrive = 0; // Master Z: Tunnel Drive / Chainage direction (m)
  let normal = { nx: 0, ny: 0, nz: -1 };
  let surfaceCategory: MasterSurfaceCategory = 'FACE';

  if (surface === 'face') {
    localRight = pt.x;
    localUp = pt.y;
    // Slight 3D concavity/arch relief near crown perimeter of excavated face
    const radialNorm = Math.min(1, Math.hypot(pt.x / halfW, Math.max(0, pt.y - wallH) / archRise));
    localDrive = -0.12 * (1 - radialNorm * radialNorm);
    normal = { nx: 0, ny: 0, nz: -1 };
    surfaceCategory =
      geometry.crownGeometry === 'custom_cad' || geometry.crownGeometry === 'freeform_custom'
        ? 'OTHER_CUSTOM_SURFACE'
        : 'FACE';
  } else if (surface === 'crown') {
    const crownSpan = Math.max(0.5, geometry.crownArcLength || geometry.width);
    const roundLen = Math.max(0.5, settings.roundLength || 4.0);
    // 2D unwrapped coordinates (u2d horizontal left-to-right, v2d vertical top-to-bottom)
    const u2d = Math.max(0, Math.min(1, (pt.x + crownSpan / 2) / crownSpan));
    const v2d = Math.max(0, Math.min(1, 1 - pt.y / roundLen));
    // Rotate 90 degrees clockwise: u3d = 1 - v2d (along drive), v3d = u2d (across crown arch)
    const u3d = 1 - v2d;
    const v3d = u2d;
    const customSample = isCustomOrAsymmetric
      ? sampleCrossSectionZoneArcLength('crown', v3d, geometry)
      : null;

    if (customSample) {
      localRight = customSample.x;
      localUp = customSample.y;
      localDrive = -u3d * roundLen;
      normal = {
        nx: Number(customSample.nx.toFixed(4)),
        ny: Number(customSample.ny.toFixed(4)),
        nz: 0,
      };
    } else {
      // Section 14: Crown is NOT a flat rectangle in 3D — intersect with curved crown profile
      const arcPos = (v3d - 0.5) * crownSpan;
      const phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, arcPos / R));
      localRight = R * Math.sin(phi);
      localDrive = -u3d * roundLen; // behind face along Z axis
      const centerY = totalH - R;
      localUp = Math.max(wallH, centerY + R * Math.cos(phi));
      // Inward unit normal to curved crown arch
      normal = {
        nx: Number((-Math.sin(phi)).toFixed(4)),
        ny: Number((-Math.cos(phi)).toFixed(4)),
        nz: 0,
      };
    }
    surfaceCategory = 'CROWN';
  } else if (surface === 'leftWall') {
    const leftSpan = Math.max(
      0.5,
      geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2
    );
    const roundLen = Math.max(0.5, settings.roundLength || 4.0);
    // 2D unwrapped coordinates (u2d horizontal left-to-right, v2d vertical top-to-bottom)
    const u2d = Math.max(0, Math.min(1, pt.x / roundLen));
    const v2d = Math.max(0, Math.min(1, 1 - pt.y / leftSpan));
    // Rotate 90 degrees clockwise: u3d = 1 - v2d (along drive), v3d = u2d (invert to springline)
    const u3d = 1 - v2d;
    const v3d = u2d;
    const customSample = isCustomOrAsymmetric
      ? sampleCrossSectionZoneArcLength('leftWall', v3d, geometry)
      : null;

    if (customSample) {
      localRight = customSample.x;
      localUp = customSample.y;
      localDrive = -u3d * roundLen;
      normal = {
        nx: Number(customSample.nx.toFixed(4)),
        ny: Number(customSample.ny.toFixed(4)),
        nz: 0,
      };
    } else {
      // Section 13: Left wall surface in Master Tunnel Coordinate System
      localRight = geometry.minX ?? -halfW;
      localDrive = -u3d * roundLen;
      localUp = v3d * leftSpan;
      normal = { nx: 1, ny: 0, nz: 0 };
    }
    surfaceCategory = 'LEFT_WALL';
  } else {
    const rightSpan = Math.max(
      0.5,
      geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2
    );
    const roundLen = Math.max(0.5, settings.roundLength || 4.0);
    // 2D unwrapped coordinates (u2d horizontal left-to-right, v2d vertical top-to-bottom)
    const u2d = Math.max(0, Math.min(1, pt.x / roundLen));
    const v2d = Math.max(0, Math.min(1, 1 - pt.y / rightSpan));
    // Rotate 90 degrees clockwise: u3d = 1 - v2d (along drive), v3d = u2d (springline to invert)
    const u3d = 1 - v2d;
    const v3d = u2d;
    const customSample = isCustomOrAsymmetric
      ? sampleCrossSectionZoneArcLength('rightWall', 1 - v3d, geometry)
      : null;

    if (customSample) {
      localRight = customSample.x;
      localUp = customSample.y;
      localDrive = -u3d * roundLen;
      normal = {
        nx: Number(customSample.nx.toFixed(4)),
        ny: Number(customSample.ny.toFixed(4)),
        nz: 0,
      };
    } else {
      // Section 13: Right wall surface in Master Tunnel Coordinate System
      localRight = geometry.maxX ?? halfW;
      localDrive = -u3d * roundLen;
      localUp = (1 - v3d) * rightSpan;
      normal = { nx: -1, ny: 0, nz: 0 };
    }
    surfaceCategory = 'RIGHT_WALL';
  }

  // Rotate (localRight, localDrive) by Tunnel Drive Azimuth (clockwise from North)
  const azRad = (settings.driveDirection * Math.PI) / 180;
  const sinAz = Math.sin(azRad);
  const cosAz = Math.cos(azRad);

  const east = localRight * cosAz + localDrive * sinAz;
  const north = -localRight * sinAz + localDrive * cosAz;

  return {
    x: Number(localRight.toFixed(4)),
    y: Number(localUp.toFixed(4)),
    z: Number(localDrive.toFixed(4)),
    east: Number(east.toFixed(4)),
    north: Number(north.toFixed(4)),
    up: Number(localUp.toFixed(4)),
    normal,
    surfaceCategory,
  };
}

/**
 * Returns the joint geometry points according to the active toolbar TraceFitMode:
 * - 'smart_fit': preserves all detected natural irregularities, curvature, local bends, and undulations (P1..Pn).
 * - 'linear': returns a geometrically simplified straight segment [P1, Pn] between the trace endpoints without mutating the underlying natural trace.
 */
export function getDisplayedJointGeometry(
  joint: Pick<Joint, 'geometry'>,
  fitMode: TraceFitMode = 'smart_fit'
): Point2D[] {
  if (!joint.geometry || joint.geometry.length < 2) return joint.geometry || [];
  if (fitMode === 'linear') {
    return [joint.geometry[0], joint.geometry[joint.geometry.length - 1]];
  }
  return joint.geometry;
}

export function createDefaultSurfaceTransform(): SurfaceTransform {
  const defaultCorners: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const defaultEdges: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const meshPts = [];
  let idx = 1;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const u = Number((c / 2).toFixed(4));
      const v = Number((r / 2).toFixed(4));
      meshPts.push({
        id: `cp-${r}-${c}`,
        label: `C${idx++}`,
        srcU: u,
        srcV: v,
        dstU: u,
        dstV: v,
      });
    }
  }
  return {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    skewX: 0,
    skewY: 0,
    perspH: 0,
    perspV: 0,
    perspectiveCorners: defaultCorners,
    edgeOffsets: defaultEdges,
    meshControlPoints: meshPts,
    useCustomMask: false,
    customMaskPoints: [],
    homographyMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    cropToGeometry: true,
  };
}
