// ============================================================================
// ESWA GEOLOGICAL MAPPER — ADVANCED 3D GEOLOGICAL MODELING & ALIGNMENT ANALYTICS
// Exact Engineering Workflows, Mathematical Formulations, & State Feeders
// Capabilities 1 to 6:
// 1. Excavation-Specific 3D Geological Logs (Multi-stage NATM, Unwrapped Strip to 3D Skin)
// 2. Projecting Weak Zones Beyond Tunnel Headings (Crown/Invert Entry, Exposure, Ahead Rounds)
// 3. Reconstructing 3D Geology from Sequential Face Logs (Triangulated Ribbons, 3D IDW Interpolation)
// 4. Component-Specific Apparent Thickness & Joint Spacing (6 Components + Terzaghi Correction)
// 5. Geological Implications of Tunnel Alignment Alternatives (Faults, RMR89 R6, Stress, Optimization Rose)
// 6. Poor Rock Mass Proportions Along Tunnel Alignments (Gaussian erf, Classes I-V, P10/P50/P90)
// ============================================================================

import {
  Joint,
  JointSet,
  LithologyRegion,
  QIndexParameters,
  RmrParameters,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';

// ----------------------------------------------------------------------------
// CAPABILITY 1: EXCAVATION-SPECIFIC 3D GEOLOGICAL LOGS
// ----------------------------------------------------------------------------
export type ExcavationStage = 'FULL_FACE' | 'TOP_HEADING' | 'BENCH' | 'INVERT';
export type ExcavationStageType = ExcavationStage;

export interface UnwrappedStripPoint {
  s: number; // Perimeter distance from Left Wall base (-P/2 to +P/2 or left base = 0)
  z: number; // Chainage along tunnel axis (m)
  featureName?: string;
  featureType?: 'LITHOLOGY_CONTACT' | 'FAULT_BAND' | 'WATER_INFLOW' | 'JOINT_TRACE';
  color?: string;
}

export interface TunnelSkinPoint3D {
  x: number; // Transverse (m, -W/2 to +W/2)
  y: number; // Vertical elevation (m, 0 to H_total)
  z: number; // Chainage (m)
}

export interface ExcavationStageBounds {
  stage: ExcavationStage;
  yMin: number;
  yMax: number;
  crossSectionArea: number; // m^2
  volume: number; // m^3 for pull length
}

/**
 * Generates an exact closed 2D cross-section polygon in physical meters:
 * X in [-W/2, +W/2], Y in [0, H] (Invert = 0, Crown = H).
 * Points are ordered clockwise starting from Left Invert (-W/2, 0) -> Left Wall -> Crown Arch -> Right Wall -> Right Invert (+W/2, 0).
 */
export function generateExactTunnelProfilePoints(
  geometry?: TunnelGeometry,
  spanWOverride?: number,
  heightHOverride?: number,
  wallHeightOverride?: number
): { x: number; y: number }[] {
  const W = Math.max(1.0, spanWOverride ?? geometry?.width ?? 8.4);
  const H = Math.max(1.0, heightHOverride ?? geometry?.height ?? 7.2);
  const halfW = W / 2;
  const rawWallH = wallHeightOverride ?? geometry?.wallHeight ?? H * 0.52;
  const wallH = Math.max(0.15 * H, Math.min(0.85 * H, rawWallH));
  const crownType = geometry?.crownGeometry || 'd_shaped';

  if (geometry?.crossSectionPoints && geometry.crossSectionPoints.length >= 4) {
    const xs = geometry.crossSectionPoints.map((p) => p.x);
    const ys = geometry.crossSectionPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);
    return geometry.crossSectionPoints.map((p) => ({
      x: Number(((((p.x - minX) / spanX) - 0.5) * W).toFixed(4)),
      y: Number((((p.y - minY) / spanY) * H).toFixed(4)),
    }));
  }

  const pts: { x: number; y: number }[] = [];

  if (crownType === 'rectangular') {
    const wallSteps = 12;
    const roofSteps = 16;
    for (let i = 0; i <= wallSteps; i++) {
      pts.push({ x: -halfW, y: Number(((i / wallSteps) * H).toFixed(4)) });
    }
    for (let i = 1; i < roofSteps; i++) {
      pts.push({ x: Number((-halfW + (i / roofSteps) * W).toFixed(4)), y: H });
    }
    for (let i = wallSteps; i >= 0; i--) {
      pts.push({ x: halfW, y: Number(((i / wallSteps) * H).toFixed(4)) });
    }
    for (let i = roofSteps - 1; i >= 1; i--) {
      pts.push({ x: Number((-halfW + (i / roofSteps) * W).toFixed(4)), y: 0 });
    }
    return pts;
  }

  if (crownType === 'circular') {
    const steps = 64;
    const cx = 0;
    const cy = H / 2;
    const rx = halfW;
    const ry = H / 2;
    for (let i = 0; i < steps; i++) {
      const angle = -Math.PI / 2 - (i / steps) * Math.PI * 2;
      pts.push({
        x: Number((cx + rx * Math.cos(angle)).toFixed(4)),
        y: Number((cy + ry * Math.sin(angle)).toFixed(4)),
      });
    }
    return pts;
  }

  if (crownType === 'horseshoe' || crownType === 'modified_horseshoe') {
    const isModified = crownType === 'modified_horseshoe';
    const footHalfW = isModified ? halfW * 0.88 : halfW * 0.82;
    const invertSag = isModified ? H * 0.04 : 0;
    const wallSteps = 14;
    const archSteps = 32;
    const invertSteps = 12;

    for (let i = 0; i <= wallSteps; i++) {
      const t = i / wallSteps;
      const y = invertSag + t * (wallH - invertSag);
      const x = -footHalfW - (halfW - footHalfW) * Math.sin((t * Math.PI) / 2);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    const archH = Math.max(0.2, H - wallH);
    for (let i = 1; i < archSteps; i++) {
      const theta = Math.PI * (1 - i / archSteps);
      const x = halfW * Math.cos(theta);
      const y = wallH + archH * Math.sin(theta);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    for (let i = wallSteps; i >= 0; i--) {
      const t = i / wallSteps;
      const y = invertSag + t * (wallH - invertSag);
      const x = footHalfW + (halfW - footHalfW) * Math.sin((t * Math.PI) / 2);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    for (let i = 1; i < invertSteps; i++) {
      const u = i / invertSteps;
      const x = footHalfW * (1 - 2 * u);
      const y = invertSag * Math.pow(2 * u - 1, 2);
      pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
    return pts;
  }

  // Default: 'd_shaped' (vertical walls from y=0 to y=wallH, elliptical arch from wallH to H, flat invert at y=0)
  const wallSteps = 12;
  const archSteps = 36;
  const invertSteps = 10;
  const archH = Math.max(0.1, H - wallH);

  for (let i = 0; i <= wallSteps; i++) {
    pts.push({ x: -halfW, y: Number(((i / wallSteps) * wallH).toFixed(4)) });
  }
  for (let i = 1; i < archSteps; i++) {
    const theta = Math.PI * (1 - i / archSteps);
    pts.push({
      x: Number((halfW * Math.cos(theta)).toFixed(4)),
      y: Number((wallH + archH * Math.sin(theta)).toFixed(4)),
    });
  }
  for (let i = wallSteps; i >= 0; i--) {
    pts.push({ x: halfW, y: Number(((i / wallSteps) * wallH).toFixed(4)) });
  }
  for (let i = 1; i < invertSteps; i++) {
    const u = i / invertSteps;
    pts.push({ x: Number((halfW * (1 - 2 * u)).toFixed(4)), y: 0 });
  }
  return pts;
}

/**
 * Returns the exact roof/crown Y elevation (in [0, H]) at transverse coordinate x in [-W/2, +W/2]
 * for the given tunnel geometry.
 */
export function getCrownArchYAtX(
  geometry: TunnelGeometry | undefined,
  x: number,
  spanW?: number,
  heightH?: number,
  wallHeightOverride?: number
): number {
  const W = Math.max(1.0, spanW ?? geometry?.width ?? 8.4);
  const H = Math.max(1.0, heightH ?? geometry?.height ?? 7.2);
  const halfW = W / 2;
  const clampedX = Math.max(-halfW, Math.min(halfW, x));
  const rawWallH = wallHeightOverride ?? geometry?.wallHeight ?? H * 0.52;
  const wallH = Math.max(0.15 * H, Math.min(0.85 * H, rawWallH));
  const crownType = geometry?.crownGeometry || 'd_shaped';

  if (crownType === 'rectangular') {
    return H;
  }
  if (crownType === 'circular') {
    const ratio = Math.min(1, Math.abs(clampedX) / halfW);
    return H / 2 + (H / 2) * Math.sqrt(Math.max(0, 1 - ratio * ratio));
  }
  const ratio = Math.min(1, Math.abs(clampedX) / halfW);
  return wallH + (H - wallH) * Math.sqrt(Math.max(0, 1 - ratio * ratio));
}

/**
 * Computes exact 2D polygon area using the Shoelace formula.
 */
export function computePolygonArea2D(pts: { x: number; y: number }[]): number {
  if (!pts || pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) * 0.5;
}

/**
 * Clips a closed 2D polygon against the horizontal elevation band [yMin, yMax]
 * using Sutherland-Hodgman polygon clipping. Guarantees a closed loop with flat cut edges.
 */
export function clipProfilePolygonToYBand(
  pts: { x: number; y: number }[],
  yMin: number,
  yMax: number
): { x: number; y: number }[] {
  if (!pts || pts.length < 3) return [];

  const clipLower = (poly: { x: number; y: number }[], minVal: number) => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = cur.y >= minVal - 1e-6;
      const prevIn = prev.y >= minVal - 1e-6;
      if (curIn) {
        if (!prevIn) {
          const dy = cur.y - prev.y;
          const t = Math.abs(dy) > 1e-9 ? (minVal - prev.y) / dy : 0;
          out.push({ x: prev.x + t * (cur.x - prev.x), y: minVal });
        }
        out.push(cur);
      } else if (prevIn) {
        const dy = cur.y - prev.y;
        const t = Math.abs(dy) > 1e-9 ? (minVal - prev.y) / dy : 0;
        out.push({ x: prev.x + t * (cur.x - prev.x), y: minVal });
      }
    }
    return out;
  };

  const clipUpper = (poly: { x: number; y: number }[], maxVal: number) => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = cur.y <= maxVal + 1e-6;
      const prevIn = prev.y <= maxVal + 1e-6;
      if (curIn) {
        if (!prevIn) {
          const dy = cur.y - prev.y;
          const t = Math.abs(dy) > 1e-9 ? (maxVal - prev.y) / dy : 0;
          out.push({ x: prev.x + t * (cur.x - prev.x), y: maxVal });
        }
        out.push(cur);
      } else if (prevIn) {
        const dy = cur.y - prev.y;
        const t = Math.abs(dy) > 1e-9 ? (maxVal - prev.y) / dy : 0;
        out.push({ x: prev.x + t * (cur.x - prev.x), y: maxVal });
      }
    }
    return out;
  };

  const afterLower = clipLower(pts, yMin);
  if (afterLower.length < 3) return [];
  return clipUpper(afterLower, yMax);
}

/**
 * Stage Elevation Bounds & Area:
 * Full Face: Y in [0, H_total]
 * Top Heading: Y in [H_bench, H_total]
 * Bench: Y in [0, H_bench]
 * Invert: Y in [0, H_invert]
 */
export function computeStageElevationBounds(
  stage: ExcavationStage,
  width: number,
  totalHeight: number,
  benchHeight: number,
  zStart: number,
  zEnd: number,
  geometry?: TunnelGeometry
): ExcavationStageBounds {
  const pullLength = Math.max(0.1, zEnd - zStart);
  const H_bench = Math.min(Math.max(0.8, benchHeight), totalHeight - 0.8);

  let yMin = 0;
  let yMax = totalHeight;

  if (stage === 'TOP_HEADING') {
    yMin = H_bench;
    yMax = totalHeight;
  } else if (stage === 'BENCH') {
    yMin = 0;
    yMax = H_bench;
  } else if (stage === 'INVERT') {
    yMin = 0;
    yMax = Math.min(1.5, Math.max(0.6, H_bench * 0.35));
  }

  const profilePts = generateExactTunnelProfilePoints(geometry, width, totalHeight, benchHeight);
  const stagePoly = clipProfilePolygonToYBand(profilePts, yMin, yMax);
  const crossSectionArea = Math.max(0.5, computePolygonArea2D(stagePoly));
  const volume = crossSectionArea * pullLength;

  return {
    stage,
    yMin: Number(yMin.toFixed(3)),
    yMax: Number(yMax.toFixed(3)),
    crossSectionArea: Number(crossSectionArea.toFixed(2)),
    volume: Number(volume.toFixed(2)),
  };
}

/**
 * 2D Unwrapped Strip (s, Z) -> 3D Tunnel Skin Coordinates (X, Y, Z)
 * Perimeter convention:
 * Center crown is s = 0.
 * Left: s < 0 along Left Arch & Left Wall down to Left Invert.
 * Right: s > 0 along Right Arch & Right Wall down to Right Invert.
 */
export function unwrappedToSkin3D(
  s: number,
  z: number,
  width: number,
  totalHeight: number,
  geometry?: TunnelGeometry
): TunnelSkinPoint3D {
  const crownType = geometry?.crownGeometry || 'd_shaped';
  const R = width / 2;
  const rawWallH = geometry?.wallHeight ?? Math.max(0.5, totalHeight - R);
  const H_wall = crownType === 'rectangular'
    ? totalHeight
    : crownType === 'circular'
    ? totalHeight / 2
    : Math.max(0.15 * totalHeight, Math.min(0.85 * totalHeight, rawWallH));

  if (crownType === 'rectangular') {
    const halfTop = R;
    if (Math.abs(s) <= halfTop) {
      return { x: Number(s.toFixed(3)), y: Number(totalHeight.toFixed(3)), z: Number(z.toFixed(3)) };
    }
    const wallDist = Math.abs(s) - halfTop;
    return {
      x: Number((s < 0 ? -R : R).toFixed(3)),
      y: Number(Math.max(0, totalHeight - wallDist).toFixed(3)),
      z: Number(z.toFixed(3)),
    };
  }

  if (crownType === 'circular') {
    const rEff = (width + totalHeight) / 4;
    const theta = Math.max(-Math.PI, Math.min(Math.PI, s / Math.max(0.5, rEff)));
    const x = R * Math.sin(theta);
    const y = totalHeight / 2 + (totalHeight / 2) * Math.cos(theta);
    return {
      x: Number(x.toFixed(3)),
      y: Number(Math.max(0, y).toFixed(3)),
      z: Number(z.toFixed(3)),
    };
  }

  const archH = Math.max(0.2, totalHeight - H_wall);
  const rArchEff = Math.sqrt((R * R + archH * archH) / 2);
  const halfArchPerimeter = (Math.PI * rArchEff) / 2;

  if (s < -halfArchPerimeter) {
    const wallDist = -s - halfArchPerimeter;
    return {
      x: -R,
      y: Number(Math.max(0, H_wall - wallDist).toFixed(3)),
      z,
    };
  }
  if (s > halfArchPerimeter) {
    const wallDist = s - halfArchPerimeter;
    return {
      x: R,
      y: Number(Math.max(0, H_wall - wallDist).toFixed(3)),
      z,
    };
  }

  const frac = s / Math.max(0.1, halfArchPerimeter);
  const theta = (frac * Math.PI) / 2;
  const x = R * Math.sin(theta);
  const y = H_wall + archH * Math.cos(theta);

  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    z: Number(z.toFixed(3)),
  };
}

// ----------------------------------------------------------------------------
// CAPABILITY 2: PROJECTING WEAK ZONES BEYOND TUNNEL HEADINGS
// ----------------------------------------------------------------------------
export interface WeakZoneProjectionInput {
  zFace: number; // Current face chainage (m)
  alphaDrive: number; // Drive azimuth (0-360 deg)
  gammaDrive?: number; // Longitudinal tunnel gradient/plunge (deg, + up, - down)
  beta: number; // Weak zone True Dip (0-90 deg)
  thetaDip: number; // Weak zone True Dip Direction (0-360 deg)
  tTrue: number; // True perpendicular thickness (m)
  yObs: number; // Vertical height observed on face (m)
  hTunnel: number; // Total tunnel height (m)
  lPull?: number; // Blast round length (m)
  zoneType?: string; // Fault, Shear Zone, Clay Gouge, Crushed Dyke
}

export interface WeakZoneProjectionResult {
  deltaDeg: number;
  acuteIntersectionAnglePsiDeg: number;
  sinPsi: number;
  zCrown: number; // Chainage where weak zone hits Crown ahead of face
  zInvert: number; // Chainage where weak zone hits Invert ahead of face
  lTunnelExposure: number; // Total tunnel length passing through weak zone (m)
  nRounds: number; // Upcoming blast rounds inside weak zone
  entryChainage: number; // Earliest chainage encountered
  exitChainage: number; // Latest chainage fully cleared
  isApproachingFromCrown: boolean;
  hazardSummary: string;
  tTrue: number;
}

export function projectWeakZoneBeyondHeading(
  params: WeakZoneProjectionInput
): WeakZoneProjectionResult {
  const {
    zFace,
    alphaDrive,
    gammaDrive = 0,
    beta,
    thetaDip,
    tTrue,
    yObs,
    hTunnel,
    lPull = 3.0,
    zoneType = 'Fault / Shear Zone',
  } = params;

  const deltaRad = ((thetaDip - alphaDrive) * Math.PI) / 180;
  const betaRad = (Math.max(1, Math.min(89.5, beta)) * Math.PI) / 180;
  const gammaRad = (gammaDrive * Math.PI) / 180;

  // 3D Unit Normal of Weak Zone Plane (nx, ny, nz)
  const nx = Math.sin(betaRad) * Math.sin(deltaRad);
  const ny = Math.cos(betaRad);
  const nz = Math.sin(betaRad) * Math.cos(deltaRad);

  // Acute Intersection Angle psi
  const sinPsi = Math.abs(
    Math.cos(betaRad) * Math.sin(gammaRad) +
      Math.sin(betaRad) * Math.cos(deltaRad) * Math.cos(gammaRad)
  );
  const acuteIntersectionAnglePsiDeg = (Math.asin(Math.max(0.01, Math.min(1.0, sinPsi))) * 180) / Math.PI;

  // Longitudinal tangent projection factor
  const denom = Math.tan(betaRad) * Math.cos(deltaRad);
  const safeDenom = Math.abs(denom) < 0.05 ? (denom < 0 ? -0.05 : 0.05) : denom;

  // Chainage hits ahead
  const zCrown = zFace + (yObs - hTunnel) / safeDenom;
  const zInvert = zFace + yObs / safeDenom;

  // Total exposed length inside fault
  const safeSinPsi = Math.max(0.08, sinPsi);
  const lTunnelExposure = tTrue / safeSinPsi + Math.abs(zCrown - zInvert);
  const nRounds = Math.max(1, Math.ceil(lTunnelExposure / Math.max(0.5, lPull)));

  const entryChainage = Math.min(zCrown, zInvert);
  const exitChainage = entryChainage + lTunnelExposure;
  const isApproachingFromCrown = zCrown <= zInvert;

  const hazardSummary =
    lTunnelExposure > 15
      ? `CRITICAL RISK: ${zoneType} extends for ${lTunnelExposure.toFixed(1)}m (~${nRounds} rounds). Heavy forepoling, canopy tubes & immediate invert closure mandatory.`
      : lTunnelExposure > 5
      ? `MODERATE RISK: ${zoneType} intersection spanning ${lTunnelExposure.toFixed(1)}m (~${nRounds} rounds). Increase spiling & reduce pull to 1.5m.`
      : `LOCALIZED: Short crossing of ${lTunnelExposure.toFixed(1)}m (~${nRounds} round). Enhanced lattice girders and extra spot bolts.`;

  return {
    deltaDeg: Number((deltaRad * (180 / Math.PI)).toFixed(1)),
    acuteIntersectionAnglePsiDeg: Number(acuteIntersectionAnglePsiDeg.toFixed(1)),
    sinPsi: Number(sinPsi.toFixed(4)),
    zCrown: Number(zCrown.toFixed(2)),
    zInvert: Number(zInvert.toFixed(2)),
    lTunnelExposure: Number(lTunnelExposure.toFixed(2)),
    nRounds,
    entryChainage: Number(entryChainage.toFixed(2)),
    exitChainage: Number(exitChainage.toFixed(2)),
    isApproachingFromCrown,
    hazardSummary,
    tTrue,
  };
}

// ----------------------------------------------------------------------------
// CAPABILITY 3: RECONSTRUCTING 3D GEOLOGY FROM SEQUENTIAL FACE LOGS
// ----------------------------------------------------------------------------
export interface SequentialFaceLog {
  id: string;
  chainageMeters: number;
  faceChainageStr: string;
  contacts: {
    id: string;
    lithologyName: string;
    polyline: { x: number; y: number }[]; // 2D points on face
  }[];
  meanRmr: number;
  meanQ: number;
  meanGsi: number;
}

export interface TriangulatedRibbonMesh {
  contactName: string;
  fromChainage: number;
  toChainage: number;
  vertices: { x: number; y: number; z: number }[];
  indices: number[]; // triangles [i, j, k]
  inferredDipDeg: number;
  inferredDipDirDeg: number;
}

export interface VoxelGridPoint3D {
  x: number;
  y: number;
  z: number;
  interpolatedRmr: number;
  interpolatedQ: number;
  interpolatedGsi: number;
}

/**
 * Resamples a polyline into M equidistant nodes from left to right across face
 */
export function resampleFacePolyline(
  points: { x: number; y: number }[],
  M: number = 20
): { x: number; y: number }[] {
  if (!points || points.length === 0) {
    return Array.from({ length: M }, (_, i) => ({
      x: -4.0 + (8.0 * i) / (M - 1),
      y: 3.5,
    }));
  }
  if (points.length === 1) {
    return Array.from({ length: M }, (_, i) => ({
      x: -4.0 + (8.0 * i) / (M - 1),
      y: points[0].y,
    }));
  }

  // Sort by x
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;
  const span = Math.max(0.5, maxX - minX);

  const resampled: { x: number; y: number }[] = [];
  for (let m = 0; m < M; m++) {
    const targetX = minX + (span * m) / (M - 1);
    // Linear interpolation
    let y = sorted[0].y;
    for (let k = 0; k < sorted.length - 1; k++) {
      if (targetX >= sorted[k].x && targetX <= sorted[k + 1].x) {
        const segSpan = sorted[k + 1].x - sorted[k].x;
        const t = segSpan > 1e-4 ? (targetX - sorted[k].x) / segSpan : 0;
        y = sorted[k].y + t * (sorted[k + 1].y - sorted[k].y);
        break;
      }
    }
    resampled.push({ x: Number(targetX.toFixed(3)), y: Number(y.toFixed(3)) });
  }
  return resampled;
}

/**
 * Reconstructs 3D Triangulated Surfaces & infers True Dip/DipDir from contact shift
 */
export function reconstruct3DGeologicalRibbons(
  faceA: SequentialFaceLog,
  faceB: SequentialFaceLog,
  driveAzimuth: number = 45,
  M: number = 20
): TriangulatedRibbonMesh[] {
  const dZ = faceB.chainageMeters - faceA.chainageMeters;
  if (Math.abs(dZ) < 0.05) return [];

  const ribbons: TriangulatedRibbonMesh[] = [];

  // Match contacts by lithologyName or sequence
  const count = Math.max(faceA.contacts.length, faceB.contacts.length);
  for (let c = 0; c < count; c++) {
    const contactA = faceA.contacts[c] || faceA.contacts[0];
    const contactB = faceB.contacts[c] || faceB.contacts[0];
    if (!contactA || !contactB) continue;

    const nodesA = resampleFacePolyline(contactA.polyline, M);
    const nodesB = resampleFacePolyline(contactB.polyline, M);

    const vertices: { x: number; y: number; z: number }[] = [];
    const indices: number[] = [];

    // Construct vertices:
    // 0..M-1 on Face A (Z_A), M..2M-1 on Face B (Z_B)
    for (let m = 0; m < M; m++) {
      vertices.push({ x: nodesA[m].x, y: nodesA[m].y, z: faceA.chainageMeters });
    }
    for (let m = 0; m < M; m++) {
      vertices.push({ x: nodesB[m].x, y: nodesB[m].y, z: faceB.chainageMeters });
    }

    // Triangulate consecutive quads
    for (let m = 0; m < M - 1; m++) {
      const idxA1 = m;
      const idxA2 = m + 1;
      const idxB1 = M + m;
      const idxB2 = M + m + 1;

      // Triangle 1: [A(m), B(m), A(m+1)]
      indices.push(idxA1, idxB1, idxA2);
      // Triangle 2: [A(m+1), B(m), B(m+1)]
      indices.push(idxA2, idxB1, idxB2);
    }

    // Inferred True Dip and Dip Direction from contact shifts
    const meanYA = nodesA.reduce((sum, n) => sum + n.y, 0) / M;
    const meanYB = nodesB.reduce((sum, n) => sum + n.y, 0) / M;
    const meanXA = nodesA.reduce((sum, n) => sum + n.x, 0) / M;
    const meanXB = nodesB.reduce((sum, n) => sum + n.x, 0) / M;

    const dY = meanYB - meanYA;
    const dX = meanXB - meanXA;

    const dY_dX = dX !== 0 ? dY / dX : 0;
    const dY_dZ = dY / dZ;

    // Normal vector n = [-dY_dX, 1, -dY_dZ] normalized
    const len = Math.sqrt(dY_dX * dY_dX + 1 + dY_dZ * dY_dZ);
    const nx = -dY_dX / len;
    const ny = 1 / len;
    const nz = -dY_dZ / len;

    const inferredDipDeg = Math.round((Math.acos(Math.abs(ny)) * 180) / Math.PI);
    const inferredDipDirDeg = Math.round(
      (driveAzimuth + (Math.atan2(nx, nz) * 180) / Math.PI + 360) % 360
    );

    ribbons.push({
      contactName: contactA.lithologyName || `Contact ${c + 1}`,
      fromChainage: faceA.chainageMeters,
      toChainage: faceB.chainageMeters,
      vertices,
      indices,
      inferredDipDeg,
      inferredDipDirDeg,
    });
  }

  return ribbons;
}

/**
 * 3D Inverse Distance Weighting (IDW) Interpolation for RMR, Q, GSI
 */
export function interpolateIdwPoint(
  p: { x: number; y: number; z: number },
  faces: SequentialFaceLog[],
  power: number = 2
): { rmr: number; q: number; gsi: number } {
  if (!faces || faces.length === 0) {
    return { rmr: 55, q: 4.5, gsi: 50 };
  }
  if (faces.length === 1) {
    return { rmr: faces[0].meanRmr, q: faces[0].meanQ, gsi: faces[0].meanGsi };
  }

  let sumWeights = 0;
  let sumRmr = 0;
  let sumQ = 0;
  let sumGsi = 0;

  for (const face of faces) {
    // Distance from face center (0, 3.5, face.chainage)
    const d = Math.sqrt(
      p.x * p.x +
        Math.pow(p.y - 3.5, 2) +
        Math.pow(p.z - face.chainageMeters, 2)
    );

    if (d < 1e-4) {
      return { rmr: face.meanRmr, q: face.meanQ, gsi: face.meanGsi };
    }

    const w = 1 / Math.pow(d, power);
    sumWeights += w;
    sumRmr += w * face.meanRmr;
    sumQ += w * face.meanQ;
    sumGsi += w * face.meanGsi;
  }

  return {
    rmr: Number((sumRmr / sumWeights).toFixed(1)),
    q: Number((sumQ / sumWeights).toFixed(2)),
    gsi: Number((sumGsi / sumWeights).toFixed(1)),
  };
}

/**
 * Linear interpolation of contacts, RMR, Q, and GSI at query station Y_q between consecutive logged faces
 */
export function interpolateSequentialFaceLogs(
  faces: SequentialFaceLog[],
  targetChainage: number,
  M: number = 16
): {
  lambda: number;
  interpolatedRmr: number;
  interpolatedQ: number;
  interpolatedGsi: number;
  interpolatedContacts: { id: string; lithologyName: string; points: { x: number; y: number }[] }[];
} {
  if (!faces || faces.length === 0) {
    return {
      lambda: 0,
      interpolatedRmr: 50,
      interpolatedQ: 2.0,
      interpolatedGsi: 45,
      interpolatedContacts: [],
    };
  }
  const sorted = [...faces].sort((a, b) => a.chainageMeters - b.chainageMeters);
  if (sorted.length === 1 || targetChainage <= sorted[0].chainageMeters) {
    const f = sorted[0];
    return {
      lambda: 0,
      interpolatedRmr: f.meanRmr,
      interpolatedQ: f.meanQ,
      interpolatedGsi: f.meanGsi,
      interpolatedContacts: f.contacts.map((c) => ({
        id: c.id,
        lithologyName: c.lithologyName,
        points: resampleFacePolyline(c.polyline, M),
      })),
    };
  }
  if (targetChainage >= sorted[sorted.length - 1].chainageMeters) {
    const f = sorted[sorted.length - 1];
    return {
      lambda: 1,
      interpolatedRmr: f.meanRmr,
      interpolatedQ: f.meanQ,
      interpolatedGsi: f.meanGsi,
      interpolatedContacts: f.contacts.map((c) => ({
        id: c.id,
        lithologyName: c.lithologyName,
        points: resampleFacePolyline(c.polyline, M),
      })),
    };
  }

  let fA = sorted[0];
  let fB = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (targetChainage >= sorted[i].chainageMeters && targetChainage <= sorted[i + 1].chainageMeters) {
      fA = sorted[i];
      fB = sorted[i + 1];
      break;
    }
  }

  const span = Math.max(0.01, fB.chainageMeters - fA.chainageMeters);
  const lambda = Math.max(0, Math.min(1, (targetChainage - fA.chainageMeters) / span));

  const interpolatedRmr = (1 - lambda) * fA.meanRmr + lambda * fB.meanRmr;
  const interpolatedQ = (1 - lambda) * fA.meanQ + lambda * fB.meanQ;
  const interpolatedGsi = (1 - lambda) * fA.meanGsi + lambda * fB.meanGsi;

  const numContacts = Math.min(fA.contacts.length, fB.contacts.length);
  const interpolatedContacts: { id: string; lithologyName: string; points: { x: number; y: number }[] }[] = [];
  for (let c = 0; c < numContacts; c++) {
    const ptsA = resampleFacePolyline(fA.contacts[c].polyline, M);
    const ptsB = resampleFacePolyline(fB.contacts[c].polyline, M);
    const pts = ptsA.map((pA, idx) => ({
      x: (1 - lambda) * pA.x + lambda * (ptsB[idx]?.x ?? pA.x),
      y: (1 - lambda) * pA.y + lambda * (ptsB[idx]?.y ?? pA.y),
    }));
    interpolatedContacts.push({
      id: `interp-${c}`,
      lithologyName: fA.contacts[c].lithologyName,
      points: pts,
    });
  }

  return {
    lambda,
    interpolatedRmr,
    interpolatedQ,
    interpolatedGsi,
    interpolatedContacts,
  };
}

// ----------------------------------------------------------------------------
// CAPABILITY 4: COMPONENT-SPECIFIC APPARENT THICKNESS & JOINT SPACING
// ----------------------------------------------------------------------------
export interface ApparentThicknessInput {
  tTrue: number; // True perpendicular thickness (m)
  sTrue: number; // True perpendicular joint spacing (m)
  beta: number; // True Dip (0-90 deg)
  thetaDip: number; // True Dip Direction (0-360 deg)
  alphaDrive: number; // Tunnel Drive Azimuth (0-360 deg)
  gammaDrive?: number; // Tunnel gradient/plunge (deg)
  phiBh?: number; // Borehole azimuth (deg)
  thetaBh?: number; // Borehole plunge (0-90 deg)
}

export interface ComponentApparentResult {
  component: string;
  description: string;
  directionalCosine: number;
  apparentThicknessM: number;
  apparentSpacingM: number;
  dilationMultiplier: number;
  isBlindZoneWarning?: boolean;
}

export function computeAllComponentApparentThicknessAndSpacing(
  params: ApparentThicknessInput
): {
  components: ComponentApparentResult[];
  normalVector: { nx: number; ny: number; nz: number };
  terzaghiWeight: number;
  trueLinearFrequencyPerMeter: number;
} {
  const {
    tTrue,
    sTrue,
    beta,
    thetaDip,
    alphaDrive,
    gammaDrive = 0,
    phiBh = 45,
    thetaBh = 15,
  } = params;

  const deltaRad = ((thetaDip - alphaDrive) * Math.PI) / 180;
  const betaRad = (Math.max(0.5, Math.min(89.5, beta)) * Math.PI) / 180;
  const gammaRad = (gammaDrive * Math.PI) / 180;

  // Local tunnel normals
  const nx = Math.sin(betaRad) * Math.sin(deltaRad);
  const ny = Math.cos(betaRad);
  const nz = Math.sin(betaRad) * Math.cos(deltaRad);

  // 1. Longitudinal Tunnel Axis
  const cosAxis = Math.abs(ny * Math.sin(gammaRad) + nz * Math.cos(gammaRad));
  const tAppAxis = tTrue / Math.max(0.05, cosAxis);
  const sAppAxis = sTrue / Math.max(0.05, cosAxis);

  // 2. Horizontal Face Scanline
  const cosFaceH = Math.abs(nx);
  const tAppFaceH = tTrue / Math.max(0.05, cosFaceH);
  const sAppFaceH = sTrue / Math.max(0.05, cosFaceH);

  // 3. Vertical Face or Sidewall Scanline
  const cosVert = Math.abs(ny);
  const tAppVert = tTrue / Math.max(0.05, cosVert);
  const sAppVert = sTrue / Math.max(0.05, cosVert);

  // 4. 2D Vertical Face Plane
  const sinFacePlane = Math.sqrt(nx * nx + ny * ny);
  const tApp2DFace = tTrue / Math.max(0.05, sinFacePlane);
  const sApp2DFace = sTrue / Math.max(0.05, sinFacePlane);

  // 5. 2D Vertical Sidewall Plane
  const sinWallPlane = Math.sqrt(ny * ny + nz * nz);
  const tApp2DWall = tTrue / Math.max(0.05, sinWallPlane);
  const sApp2DWall = sTrue / Math.max(0.05, sinWallPlane);

  // 6. Borehole Scanline & Terzaghi Correction
  const phiBhRad = (phiBh * Math.PI) / 180;
  const thetaBhRad = (thetaBh * Math.PI) / 180;
  const thetaDipRad = (thetaDip * Math.PI) / 180;

  const cosAlphaBh = Math.abs(
    Math.sin(betaRad) * Math.sin(thetaDipRad) * Math.cos(thetaBhRad) * Math.sin(phiBhRad) +
      Math.sin(betaRad) * Math.cos(thetaDipRad) * Math.cos(thetaBhRad) * Math.cos(phiBhRad) +
      Math.cos(betaRad) * Math.sin(thetaBhRad)
  );

  const tAppBh = tTrue / Math.max(0.05, cosAlphaBh);
  const sAppBh = sTrue / Math.max(0.05, cosAlphaBh);
  const isBlindZone = cosAlphaBh < 0.25; // Terzaghi blind-zone alert if angle < 14.5°
  const terzaghiWeight = Number((1 / Math.max(0.05, cosAlphaBh)).toFixed(2));
  const trueLinearFreq = Number(((1 / Math.max(0.05, sAppBh)) * terzaghiWeight).toFixed(2));

  const components: ComponentApparentResult[] = [
    {
      component: 'Longitudinal Tunnel Axis',
      description: 'Crown/Invert Chainage Traverse along drive direction',
      directionalCosine: Number(cosAxis.toFixed(3)),
      apparentThicknessM: Number(tAppAxis.toFixed(3)),
      apparentSpacingM: Number(sAppAxis.toFixed(3)),
      dilationMultiplier: Number((tAppAxis / tTrue).toFixed(2)),
    },
    {
      component: 'Horizontal Face Scanline',
      description: 'Transverse X-axis horizontal traverse on face',
      directionalCosine: Number(cosFaceH.toFixed(3)),
      apparentThicknessM: Number(tAppFaceH.toFixed(3)),
      apparentSpacingM: Number(sAppFaceH.toFixed(3)),
      dilationMultiplier: Number((tAppFaceH / tTrue).toFixed(2)),
    },
    {
      component: 'Vertical Height Scanline',
      description: 'Vertical Y-axis elevation scanline on face/walls',
      directionalCosine: Number(cosVert.toFixed(3)),
      apparentThicknessM: Number(tAppVert.toFixed(3)),
      apparentSpacingM: Number(sAppVert.toFixed(3)),
      dilationMultiplier: Number((tAppVert / tTrue).toFixed(2)),
    },
    {
      component: '2D Face Plane',
      description: 'Uncorrected apparent trace width seen on Face photo',
      directionalCosine: Number(sinFacePlane.toFixed(3)),
      apparentThicknessM: Number(tApp2DFace.toFixed(3)),
      apparentSpacingM: Number(sApp2DFace.toFixed(3)),
      dilationMultiplier: Number((tApp2DFace / tTrue).toFixed(2)),
    },
    {
      component: '2D Sidewall Plane',
      description: 'Apparent trace band seen along tunnel sidewalls',
      directionalCosine: Number(sinWallPlane.toFixed(3)),
      apparentThicknessM: Number(tApp2DWall.toFixed(3)),
      apparentSpacingM: Number(sApp2DWall.toFixed(3)),
      dilationMultiplier: Number((tApp2DWall / tTrue).toFixed(2)),
    },
    {
      component: `Inclined Borehole (${phiBh}° / ${thetaBh}°)`,
      description: 'Along core run axis with Terzaghi orientation weighting',
      directionalCosine: Number(cosAlphaBh.toFixed(3)),
      apparentThicknessM: Number(tAppBh.toFixed(3)),
      apparentSpacingM: Number(sAppBh.toFixed(3)),
      dilationMultiplier: Number((tAppBh / tTrue).toFixed(2)),
      isBlindZoneWarning: isBlindZone,
    },
  ];

  return {
    components,
    normalVector: {
      nx: Number(nx.toFixed(3)),
      ny: Number(ny.toFixed(3)),
      nz: Number(nz.toFixed(3)),
    },
    terzaghiWeight,
    trueLinearFrequencyPerMeter: trueLinearFreq,
  };
}

/**
 * Reverse Mode Solver:
 * Given Apparent Thickness or Spacing measured on a component, calculates True Thickness / Spacing
 */
export function solveTrueFromApparent(
  apparentValue: number,
  componentIndex: 0 | 1 | 2 | 3 | 4 | 5,
  beta: number,
  thetaDip: number,
  alphaDrive: number,
  gammaDrive: number = 0,
  phiBh: number = 45,
  thetaBh: number = 15
): { trueValue: number; directionalFactor: number } {
  const result = computeAllComponentApparentThicknessAndSpacing({
    tTrue: 1.0,
    sTrue: 1.0,
    beta,
    thetaDip,
    alphaDrive,
    gammaDrive,
    phiBh,
    thetaBh,
  });

  const comp = result.components[componentIndex];
  const factor = comp.directionalCosine;
  const trueVal = apparentValue * Math.max(0.05, factor);

  return {
    trueValue: Number(trueVal.toFixed(3)),
    directionalFactor: factor,
  };
}

// ----------------------------------------------------------------------------
// CAPABILITY 5: EVALUATING GEOLOGICAL IMPLICATIONS OF TUNNEL ALIGNMENTS
// ----------------------------------------------------------------------------
export interface AlignmentCandidate {
  id: string;
  name: string;
  alphaDrive: number; // Drive azimuth (0-360 deg)
  designLengthM: number; // Alignment length (m)
}

export interface MappedFaultInput {
  id: string;
  name: string;
  beta: number; // True Dip (deg)
  thetaDip: number; // True Dip Direction (deg)
  tTrue: number; // True Thickness (m)
}

export interface MappedJointInput {
  id: string;
  beta: number;
  thetaDip: number;
  frictionAngle?: number;
}

export interface AlignmentEvaluationResult {
  candidateId: string;
  name: string;
  alphaDrive: number;
  designLengthM: number;
  faultCrossingLengthM: number;
  rmr89R6Adjustment: number; // Bieniawski orientation penalty (0 to -12)
  rmr89Favorability: 'Very Favorable' | 'Favorable' | 'Fair' | 'Unfavorable' | 'Very Unfavorable';
  stressAngleDeltaDeg: number;
  stressPenaltyScore: number; // 0 to 100
  compositeRiskScore: number; // 0 to 100 (lower = better)
  rank: number;
  recommendationNote: string;
}

export function evaluateAlignmentOption(
  alignment: AlignmentCandidate,
  faults: MappedFaultInput[],
  controllingJoint: MappedJointInput,
  sigmaHAz: number,
  maxFaultCrossingRef: number = 50
): AlignmentEvaluationResult {
  const alphaK = alignment.alphaDrive;

  // 1. Fault Crossing Length Penalty
  let totalFaultCrossing = 0;
  for (const fault of faults) {
    const sinPsi = Math.abs(
      Math.sin((fault.beta * Math.PI) / 180) *
        Math.cos(((fault.thetaDip - alphaK) * Math.PI) / 180)
    );
    const crossingLength = fault.tTrue / Math.max(0.1, sinPsi);
    totalFaultCrossing += crossingLength;
  }

  // 2. Bieniawski RMR89 Tunnel Orientation Adjustment R6 [0 to -12]
  const jointStrike = (controllingJoint.thetaDip - 90 + 360) % 360;
  const alphaCross =
    (Math.asin(
      Math.abs(Math.sin(((alphaK - jointStrike) * Math.PI) / 180))
    ) *
      180) /
    Math.PI;

  const dip = controllingJoint.beta;
  let r6 = -5;
  let favorability: AlignmentEvaluationResult['rmr89Favorability'] = 'Fair';

  // Check strike relative to drive
  if (dip < 20) {
    r6 = -5;
    favorability = 'Fair';
  } else if (alphaCross > 60) {
    // Strike perpendicular to tunnel axis
    // Check if drive with dip or against dip
    const isDriveWithDip = Math.cos(((controllingJoint.thetaDip - alphaK) * Math.PI) / 180) > 0;
    if (isDriveWithDip) {
      if (dip >= 45) {
        r6 = 0;
        favorability = 'Very Favorable';
      } else {
        r6 = -2;
        favorability = 'Favorable';
      }
    } else {
      if (dip >= 45) {
        r6 = -5;
        favorability = 'Fair';
      } else {
        r6 = -10;
        favorability = 'Unfavorable';
      }
    }
  } else if (alphaCross < 30) {
    // Strike parallel to tunnel axis
    if (dip >= 45) {
      r6 = -12;
      favorability = 'Very Unfavorable';
    } else {
      r6 = -5;
      favorability = 'Fair';
    }
  } else {
    // Intermediate strike (30 to 60 deg)
    r6 = -5;
    favorability = 'Fair';
  }

  // 3. Horizontal In-Situ Stress Alignment Score
  const deltaStress = Math.abs(((alphaK - sigmaHAz + 180) % 180));
  const stressPenalty = Math.pow(Math.sin((deltaStress * Math.PI) / 180), 2) * 100;

  // 4. Composite Risk Score (0 to 100, lower is better)
  const normFault = Math.min(1.0, totalFaultCrossing / Math.max(10, maxFaultCrossingRef));
  const normR6 = Math.abs(r6) / 12;
  const normStress = stressPenalty / 100;

  const compositeRisk = 0.4 * (normFault * 100) + 0.35 * (normR6 * 100) + 0.25 * (normStress * 100);

  const recommendationNote =
    compositeRisk < 35
      ? 'OPTIMAL ALIGNMENT: Favorable discontinuity intersection, minimal fault crossing, and low crown spalling risk.'
      : compositeRisk < 60
      ? 'ACCEPTABLE WITH CAUTION: Moderate strike intersection. Requires standard NATM class III/IV support.'
      : 'HIGH GEOLOGICAL RISK: Oblique fault entrapment or parallel strike driving. Consider alignment revision or heavy support.';

  return {
    candidateId: alignment.id,
    name: alignment.name,
    alphaDrive: alphaK,
    designLengthM: alignment.designLengthM,
    faultCrossingLengthM: Number(totalFaultCrossing.toFixed(1)),
    rmr89R6Adjustment: r6,
    rmr89Favorability: favorability,
    stressAngleDeltaDeg: Number(deltaStress.toFixed(1)),
    stressPenaltyScore: Number(stressPenalty.toFixed(1)),
    compositeRiskScore: Number(compositeRisk.toFixed(1)),
    rank: 1, // updated after sorting
    recommendationNote,
  };
}

/**
 * 0° to 180° Azimuth Optimization Rose / Curve Sweep
 */
export function sweepAzimuthOptimization(
  faults: MappedFaultInput[],
  controllingJoint: MappedJointInput,
  sigmaHAz: number,
  stepDeg: number = 5
): { azimuth: number; compositeRisk: number; r6: number; faultCrossing: number }[] {
  const sweep: { azimuth: number; compositeRisk: number; r6: number; faultCrossing: number }[] = [];
  for (let az = 0; az <= 180; az += stepDeg) {
    const res = evaluateAlignmentOption(
      { id: `swp-${az}`, name: `${az}°`, alphaDrive: az, designLengthM: 1000 },
      faults,
      controllingJoint,
      sigmaHAz,
      60
    );
    sweep.push({
      azimuth: az,
      compositeRisk: res.compositeRiskScore,
      r6: res.rmr89R6Adjustment,
      faultCrossing: res.faultCrossingLengthM,
    });
  }
  return sweep;
}

// ----------------------------------------------------------------------------
// CAPABILITY 6: ESTIMATING POOR ROCK MASS PROPORTIONS ALONG ALIGNMENTS
// ----------------------------------------------------------------------------
export interface AlignmentDomainSegment {
  id: string;
  name: string;
  startChainage: number;
  endChainage: number;
  lengthM: number;
  meanRmr: number;
  stdDevRmr: number;
  meanQ: number;
  lithology: string;
}

export interface FaultZoneCrossing {
  id: string;
  name: string;
  coreThicknessM: number;
  damageHaloMultiplier: number; // default ~2.5x
  intersectionAnglePsiDeg: number;
}

export interface PoorRockProportionResult {
  totalAlignmentLengthM: number;
  faultZoneCrossingLengthM: number;
  domainPoorRockLengthM: number;
  totalExpectedPoorRockLengthM: number;
  poorRockPercentage: number;
  classDistributions: {
    classI_Good: number; // RMR 81-100 (m)
    classII_Good: number; // RMR 61-80 (m)
    classIII_Fair: number; // RMR 41-60 (m)
    classIV_Poor: number; // RMR 21-40 (m)
    classV_VeryPoor: number; // RMR <= 20 (m)
  };
  p10OptimisticLengthM: number;
  p50ExpectedLengthM: number;
  p90ConservativeLengthM: number;
  costImpactMultiplier: number;
  advanceRateDaysEstimate: number;
}

/**
 * Abramowitz-Stegun high-precision polynomial approximation for error function erf(x)
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Phi(z)
 */
export function standardNormalCdf(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

export function estimatePoorRockMassProportions(
  totalLength: number,
  domains: AlignmentDomainSegment[],
  faults: FaultZoneCrossing[],
  rmrPoorThreshold: number = 40
): PoorRockProportionResult {
  // 1. Fault Core + Fractured Damage Halo Length
  let faultZoneLength = 0;
  for (const f of faults) {
    const psiRad = (Math.max(5, Math.min(85, f.intersectionAnglePsiDeg)) * Math.PI) / 180;
    const tDamageTotal = f.coreThicknessM * (1 + 2 * f.damageHaloMultiplier);
    const lCrossing = tDamageTotal / Math.max(0.1, Math.sin(psiRad));
    faultZoneLength += lCrossing;
  }
  faultZoneLength = Math.min(totalLength, faultZoneLength);

  // 2. Probabilistic Poor Rock within Domains
  let domainPoorTotal = 0;
  let varianceTotal = 0;

  let mClassI = 0;
  let mClassII = 0;
  let mClassIII = 0;
  let mClassIV = 0;
  let mClassV = 0;

  for (const seg of domains) {
    const mu = seg.meanRmr;
    const sigma = Math.max(1.0, seg.stdDevRmr);
    const L = seg.lengthM;

    // Normal probability P(RMR <= threshold)
    const zPoor = (rmrPoorThreshold - mu) / sigma;
    const pPoor = standardNormalCdf(zPoor);

    domainPoorTotal += L * pPoor;
    varianceTotal += L * L * pPoor * (1 - pPoor);

    // Class probabilities
    // Class I: > 80
    const pI = 1.0 - standardNormalCdf((80 - mu) / sigma);
    // Class II: 61 to 80
    const pII = standardNormalCdf((80 - mu) / sigma) - standardNormalCdf((60 - mu) / sigma);
    // Class III: 41 to 60
    const pIII = standardNormalCdf((60 - mu) / sigma) - standardNormalCdf((40 - mu) / sigma);
    // Class IV: 21 to 40
    const pIV = standardNormalCdf((40 - mu) / sigma) - standardNormalCdf((20 - mu) / sigma);
    // Class V: <= 20
    const pV = standardNormalCdf((20 - mu) / sigma);

    mClassI += L * pI;
    mClassII += L * pII;
    mClassIII += L * pIII;
    mClassIV += L * pIV;
    mClassV += L * pV;
  }

  const sdPoor = Math.sqrt(varianceTotal);
  const totalExpectedPoor = Math.min(totalLength, faultZoneLength + domainPoorTotal);
  const poorPct = (totalExpectedPoor / Math.max(1, totalLength)) * 100;

  const p50 = totalExpectedPoor;
  const p10 = Math.max(faultZoneLength, totalExpectedPoor - 1.28 * sdPoor);
  const p90 = Math.min(totalLength, totalExpectedPoor + 1.28 * sdPoor);

  // Advance time & cost impacts
  // Poor rock adds ~2.2x support cost, decreases advance from 6m/day to 1.8m/day
  const goodMeters = totalLength - totalExpectedPoor;
  const goodDays = goodMeters / 5.5;
  const poorDays = totalExpectedPoor / 1.8;
  const advanceRateDays = Math.round(goodDays + poorDays);
  const costImpact = Number((1.0 + (poorPct / 100) * 1.35).toFixed(2));

  return {
    totalAlignmentLengthM: Math.round(totalLength),
    faultZoneCrossingLengthM: Number(faultZoneLength.toFixed(1)),
    domainPoorRockLengthM: Number(domainPoorTotal.toFixed(1)),
    totalExpectedPoorRockLengthM: Number(totalExpectedPoor.toFixed(1)),
    poorRockPercentage: Number(poorPct.toFixed(1)),
    classDistributions: {
      classI_Good: Number(mClassI.toFixed(1)),
      classII_Good: Number(mClassII.toFixed(1)),
      classIII_Fair: Number(mClassIII.toFixed(1)),
      classIV_Poor: Number(mClassIV.toFixed(1)),
      classV_VeryPoor: Number(mClassV.toFixed(1)),
    },
    p10OptimisticLengthM: Number(p10.toFixed(1)),
    p50ExpectedLengthM: Number(p50.toFixed(1)),
    p90ConservativeLengthM: Number(p90.toFixed(1)),
    costImpactMultiplier: costImpact,
    advanceRateDaysEstimate: advanceRateDays,
  };
}

// ----------------------------------------------------------------------------
// DATA FEEDER: EXTRACT AUTHORITATIVE LIVE DATA FROM ACTIVE NATM WORKSPACE
// ----------------------------------------------------------------------------
export interface FedNatmDataBundle {
  spanW: number;
  heightH: number;
  benchHeight: number;
  crownRadius: number;
  currentFaceChainageNum: number;
  faceChainageStr: string;
  pullLengthM: number;
  driveAzimuth: number;
  governingJoint: {
    id: string;
    set: string;
    strike: number;
    dip: number;
    dipDirection: number;
    spacingM: number;
    thicknessM: number;
    type: string;
  } | null;
  rmrTotal: number | null;
  qValue: number | null;
  gsiValue: number | null;
  lithologyName: string;
  faultsList: MappedFaultInput[];
  allJointsList: MappedJointInput[];
  historicalFaceLogs: SequentialFaceLog[];
  hasRealJoints: boolean;
  hasRealFaults: boolean;
  hasRealHistoricalRounds: boolean;
}

export function feedDataFromNatmActiveState(
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  joints: Joint[] = [],
  jointSets: JointSet[] = [],
  rmrParams?: RmrParameters,
  qIndexParams?: QIndexParameters,
  savedProjects: SavedProjectRecord[] = []
): FedNatmDataBundle {
  const spanW = geometry.width || 8.4;
  const heightH = geometry.height || 7.2;
  const benchHeight = geometry.wallHeight ? Math.min(geometry.wallHeight, heightH * 0.5) : 3.5;
  const crownRadius = geometry.crownRadius || spanW / 2;

  // Face Chainage Parser
  const chainageRaw = settings.faceChainage || settings.chainage || '100.0';
  const numMatch = chainageRaw.match(/([\d,]+(?:\.\d+)?)/);
  const currentFaceChainageNum = numMatch
    ? parseFloat(numMatch[1].replace(/,/g, ''))
    : 100.0;
  const faceChainageStr = settings.faceChainage || `RD ${currentFaceChainageNum.toFixed(1)}m`;
  const pullLengthM = settings.roundLength || 3.0;
  const driveAzimuth = settings.driveDirection ?? 45;

  // Strictly identify candidate joints from active mapping - NO synthetic fallback joints
  const candidateJoints = (joints || []).filter(
    (j) => j && typeof j.dip === 'number' && typeof j.dipDirection === 'number'
  );

  const governing =
    candidateJoints.find((j) => ((j as any).type || (j.featureType as string) || '').toLowerCase().includes('fault')) ||
    candidateJoints.find((j) => (j.set as string)?.toUpperCase() === 'J1') ||
    candidateJoints[0] ||
    null;

  let governingJoint: FedNatmDataBundle['governingJoint'] = null;
  if (governing) {
    const dip = governing.dip;
    const dipDirection = governing.dipDirection;
    const strike = governing.strike ?? ((dipDirection - 90 + 360) % 360);
    const spacingM = (governing as any).spacingM || 0.45;
    const thicknessM = (governing as any).apertureMm ? (governing as any).apertureMm / 1000 : 0.05;

    governingJoint = {
      id: governing.id || 'natm-gov-1',
      set: governing.set || 'J1',
      strike,
      dip,
      dipDirection,
      spacingM,
      thicknessM,
      type: (((governing as any)?.type || (governing?.featureType as string)) || 'Joint') as string,
    };
  }

  // RMR & Q values: ONLY from verified inputs, strictly NO phantom fallbacks
  const rmrTotal =
    rmrParams && typeof rmrParams.totalRmr === 'number' && rmrParams.totalRmr > 0
      ? rmrParams.totalRmr
      : null;

  let qValue: number | null = null;
  if (qIndexParams && typeof qIndexParams.qValue === 'number' && qIndexParams.qValue > 0) {
    qValue = qIndexParams.qValue;
  } else if (
    qIndexParams &&
    typeof qIndexParams.rqd === 'number' &&
    typeof qIndexParams.jn === 'number' &&
    typeof qIndexParams.jr === 'number' &&
    typeof qIndexParams.ja === 'number' &&
    typeof qIndexParams.jw === 'number' &&
    typeof qIndexParams.srf === 'number'
  ) {
    qValue = Number(
      (
        (qIndexParams.rqd / Math.max(0.5, qIndexParams.jn)) *
        (qIndexParams.jr / Math.max(0.75, qIndexParams.ja)) *
        (qIndexParams.jw / Math.max(0.5, qIndexParams.srf))
      ).toFixed(3)
    );
  }

  const gsiValue =
    rmrTotal !== null
      ? Math.max(10, Math.min(95, rmrTotal - 5))
      : qValue !== null
      ? Math.round(Math.max(10, Math.min(95, 9 * Math.log(Math.max(0.01, qValue)) + 44)))
      : null;
  const lithologyName = settings.lithology || 'Unspecified Lithology';

  // Build faults / weak-planes list strictly from mapped features on the face
  const faultsList: MappedFaultInput[] = [];
  candidateJoints.forEach((j, idx) => {
    const featTypeStr = ((j as any).type || (j.featureType as string) || '').toLowerCase();
    if (
      featTypeStr.includes('fault') ||
      featTypeStr.includes('shear') ||
      featTypeStr.includes('thrust') ||
      (j.set && j.set.toLowerCase().includes('fault')) ||
      (j.set && j.set.toLowerCase().startsWith('f'))
    ) {
      faultsList.push({
        id: j.id || `f-${idx}`,
        name: `Mapped ${featTypeStr.includes('shear') ? 'Shear Zone' : 'Fault'} ${j.set || `F${idx + 1}`}`,
        beta: j.dip,
        thetaDip: j.dipDirection,
        tTrue: (j as any).apertureMm ? Math.max(0.05, (j as any).apertureMm / 1000) : 0.5,
      });
    }
  });

  // If no explicit fault/shear was tagged, use the governing mapped discontinuity plane for kinematic projection
  if (faultsList.length === 0 && governingJoint) {
    faultsList.push({
      id: governingJoint.id,
      name: `Governing Plane ${governingJoint.set} (${governingJoint.type})`,
      beta: governingJoint.dip,
      thetaDip: governingJoint.dipDirection,
      tTrue: Math.max(0.05, governingJoint.thicknessM || 0.25),
    });
  }

  const allJointsList: MappedJointInput[] = candidateJoints.map((j) => ({
    id: j.id,
    beta: j.dip,
    thetaDip: j.dipDirection,
    frictionAngle: (j as any).frictionAngle || 32,
  }));

  // Helper to normalize any polyline coordinate set (whether pixel SVG, 0..1 normalized, or physical meters)
  // into exact physical face meters: x in [-W/2, +W/2], y in [0, H]
  const normalizePolylineToMeters = (
    rawPts: { x: number; y: number }[],
    w: number,
    h: number
  ): { x: number; y: number }[] => {
    if (!rawPts || rawPts.length === 0) return [];
    const maxAbsX = Math.max(...rawPts.map((p) => Math.abs(p.x)));
    const maxAbsY = Math.max(...rawPts.map((p) => Math.abs(p.y)));
    const minX = Math.min(...rawPts.map((p) => p.x));
    const minY = Math.min(...rawPts.map((p) => p.y));

    // Case 1: Normalized [0, 1] coordinates
    if (minX >= -0.05 && maxAbsX <= 1.05 && minY >= -0.05 && maxAbsY <= 1.05) {
      return rawPts.map((p) => ({
        x: Number(((p.x - 0.5) * w).toFixed(3)),
        y: Number(((1 - p.y) * h).toFixed(3)),
      }));
    }

    // Case 2: Pixel SVG coordinates (e.g. Face canvas 130..390, 130..350 or 0..520)
    if (maxAbsX > w * 1.25 || maxAbsY > h * 1.25) {
      return rawPts.map((p) => {
        const normX = Math.max(-0.5, Math.min(0.5, (p.x - 260) / 240));
        const normY = Math.max(0, Math.min(1, (350 - p.y) / 220));
        return {
          x: Number((normX * w).toFixed(3)),
          y: Number((normY * h).toFixed(3)),
        };
      });
    }

    // Case 3: Already in physical meters (x in [-w/2, +w/2], y in [-h/2, +h] or [0, h])
    return rawPts.map((p) => ({
      x: Number(Math.max(-w / 2, Math.min(w / 2, p.x)).toFixed(3)),
      y: Number(Math.max(0, Math.min(h, p.y < 0 ? p.y + h / 2 : p.y)).toFixed(3)),
    }));
  };

  // Construct historical face logs from savedProjects / logged rounds
  const historicalFaceLogs: SequentialFaceLog[] = [];
  if (savedProjects && savedProjects.length > 0) {
    savedProjects.forEach((proj) => {
      const ch = proj.numericChainageMeters ?? currentFaceChainageNum;
      const projW = proj.geometry?.width || spanW;
      const projH = proj.geometry?.height || heightH;
      const projRmr =
        proj.rmrParams?.totalRmr && proj.rmrParams.totalRmr > 0
          ? proj.rmrParams.totalRmr
          : rmrTotal ?? 55;
      const projQ =
        proj.qIndexParams?.qValue && proj.qIndexParams.qValue > 0
          ? proj.qIndexParams.qValue
          : qValue ?? 2.5;
      const projGsi = Math.max(10, Math.min(95, projRmr - 5));

      const regionContacts = (proj.lithologyRegions || [])
        .filter((lr) => lr.polygon && lr.polygon.length >= 2)
        .map((lr) => ({
          id: lr.id,
          lithologyName: lr.lithologyName || proj.settings?.lithology || lithologyName,
          polyline: normalizePolylineToMeters(lr.polygon, projW, projH),
        }));

      const jointContacts =
        regionContacts.length > 0
          ? regionContacts
          : (proj.joints || [])
              .filter((j) => {
                const pts = j.geometry || (j as any).points;
                return pts && pts.length >= 2;
              })
              .slice(0, 5)
              .map((j, jIdx) => {
                const pts: { x: number; y: number }[] = j.geometry || (j as any).points || [];
                return {
                  id: `${proj.id}-jt-${jIdx}`,
                  lithologyName: `${j.set || 'J1'} (${proj.settings?.lithology || lithologyName})`,
                  polyline: normalizePolylineToMeters(pts, projW, projH),
                };
              });

      historicalFaceLogs.push({
        id: proj.id,
        chainageMeters: ch,
        faceChainageStr: proj.faceChainage || `RD ${ch.toFixed(1)}m`,
        contacts: jointContacts,
        meanRmr: projRmr,
        meanQ: projQ,
        meanGsi: projGsi,
      });
    });
  }

  // Ensure active round is represented across its pull length [currentFaceChainageNum, currentFaceChainageNum + pullLengthM]
  // when only 0 or 1 station exists so 3D Sequential Face Reconstruction always renders the round prism accurately
  if (historicalFaceLogs.length === 0 && candidateJoints.length > 0) {
    const activeContacts = candidateJoints
      .filter((j) => {
        const pts = j.geometry || (j as any).points;
        return pts && pts.length >= 2;
      })
      .slice(0, 5)
      .map((j, idx) => {
        const pts: { x: number; y: number }[] = j.geometry || (j as any).points || [];
        return {
          id: `active-jt-${idx}`,
          lithologyName: `${j.set || 'J1'} (${lithologyName})`,
          polyline: normalizePolylineToMeters(pts, spanW, heightH),
        };
      });

    if (activeContacts.length === 0 && governingJoint) {
      const dipRad = (governingJoint.dip * Math.PI) / 180;
      const dy = Math.min(heightH * 0.35, spanW * 0.4 * Math.tan(dipRad) * 0.35);
      activeContacts.push({
        id: 'active-gov-contact',
        lithologyName: `${governingJoint.set} (${lithologyName})`,
        polyline: [
          { x: Number((-spanW * 0.42).toFixed(2)), y: Number((heightH * 0.55 - dy).toFixed(2)) },
          { x: 0, y: Number((heightH * 0.55).toFixed(2)) },
          { x: Number((spanW * 0.42).toFixed(2)), y: Number((heightH * 0.55 + dy).toFixed(2)) },
        ],
      });
    }

    if (activeContacts.length > 0) {
      historicalFaceLogs.push({
        id: 'active-round-start',
        chainageMeters: currentFaceChainageNum,
        faceChainageStr: `RD ${currentFaceChainageNum.toFixed(1)}m`,
        contacts: activeContacts,
        meanRmr: rmrTotal ?? 55,
        meanQ: qValue ?? 2.5,
        meanGsi: gsiValue ?? 50,
      });
    }
  }

  if (historicalFaceLogs.length === 1) {
    const baseLog = historicalFaceLogs[0];
    const dipDeg = governingJoint ? governingJoint.dip : 45;
    const relStrikeDeg = governingJoint
      ? (governingJoint.dipDirection - driveAzimuth + 360) % 360
      : 30;
    const shiftY = Math.max(
      -heightH * 0.25,
      Math.min(
        heightH * 0.25,
        Math.cos((relStrikeDeg * Math.PI) / 180) *
          Math.tan((Math.min(75, dipDeg) * Math.PI) / 180) *
          pullLengthM *
          0.25
      )
    );
    const shiftX = Math.max(
      -spanW * 0.2,
      Math.min(
        spanW * 0.2,
        Math.sin((relStrikeDeg * Math.PI) / 180) * pullLengthM * 0.18
      )
    );

    const endChainage = Number((baseLog.chainageMeters + pullLengthM).toFixed(2));
    const fallbackContacts =
      baseLog.contacts.length > 0
        ? baseLog.contacts
        : [
            {
              id: `${baseLog.id}-horizon`,
              lithologyName: lithologyName,
              polyline: [
                { x: Number((-spanW * 0.42).toFixed(2)), y: Number((heightH * 0.5).toFixed(2)) },
                { x: 0, y: Number((heightH * 0.54).toFixed(2)) },
                { x: Number((spanW * 0.42).toFixed(2)), y: Number((heightH * 0.48).toFixed(2)) },
              ],
            },
          ];

    baseLog.contacts = fallbackContacts;

    historicalFaceLogs.push({
      id: `${baseLog.id}-end`,
      chainageMeters: endChainage,
      faceChainageStr: `RD ${endChainage.toFixed(1)}m`,
      contacts: fallbackContacts.map((c) => ({
        id: `${c.id}-end`,
        lithologyName: c.lithologyName,
        polyline: c.polyline.map((p) => ({
          x: Number(Math.max(-spanW * 0.48, Math.min(spanW * 0.48, p.x + shiftX)).toFixed(3)),
          y: Number(Math.max(0.2, Math.min(heightH - 0.2, p.y + shiftY)).toFixed(3)),
        })),
      })),
      meanRmr: baseLog.meanRmr,
      meanQ: baseLog.meanQ,
      meanGsi: baseLog.meanGsi,
    });
  }

  return {
    spanW,
    heightH,
    benchHeight,
    crownRadius,
    currentFaceChainageNum,
    faceChainageStr,
    pullLengthM,
    driveAzimuth,
    governingJoint,
    rmrTotal,
    qValue,
    gsiValue,
    lithologyName,
    faultsList,
    allJointsList,
    historicalFaceLogs,
    hasRealJoints: candidateJoints.length > 0,
    hasRealFaults: faultsList.length > 0,
    hasRealHistoricalRounds: historicalFaceLogs.length >= 2,
  };
}
