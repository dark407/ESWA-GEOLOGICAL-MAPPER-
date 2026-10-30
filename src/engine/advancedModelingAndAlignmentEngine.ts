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
 * Stage Elevation Bounds & Area:
 * Full Face: Y in [0, H_total]
 * Top Heading: Y in [H_bench, H_total]
 * Bench: Y in [0, H_bench]
 * Invert: Y in [-H_invert, 0] or lower concave arch
 */
export function computeStageElevationBounds(
  stage: ExcavationStage,
  width: number,
  totalHeight: number,
  benchHeight: number,
  zStart: number,
  zEnd: number
): ExcavationStageBounds {
  const pullLength = Math.max(0.1, zEnd - zStart);
  const R = width / 2;
  const H_wall = Math.max(0.5, totalHeight - R);
  const H_bench = Math.min(Math.max(1.0, benchHeight), totalHeight - 1.0);

  // Approximate D-shaped / horseshoe cross section area
  // Arch area = pi * R^2 / 2; Wall area = 2 * R * H_wall
  const totalArea = 0.5 * Math.PI * R * R + 2 * R * H_wall;

  let yMin = 0;
  let yMax = totalHeight;
  let crossSectionArea = totalArea;

  if (stage === 'TOP_HEADING') {
    yMin = H_bench;
    yMax = totalHeight;
    // Top heading area = arch area + (H_wall - H_bench) * 2 * R
    const lowerWall = Math.max(0, H_wall - H_bench);
    crossSectionArea = 0.5 * Math.PI * R * R + 2 * R * lowerWall;
  } else if (stage === 'BENCH') {
    yMin = 0;
    yMax = H_bench;
    crossSectionArea = 2 * R * H_bench;
  } else if (stage === 'INVERT') {
    yMin = 0;
    yMax = Math.min(1.5, H_bench * 0.3);
    crossSectionArea = 2 * R * yMax * 0.7;
  }

  const volume = crossSectionArea * pullLength;

  return {
    stage,
    yMin,
    yMax,
    crossSectionArea: Number(crossSectionArea.toFixed(2)),
    volume: Number(volume.toFixed(2)),
  };
}

/**
 * 2D Unwrapped Strip (s, Z) -> 3D Tunnel Skin Coordinates (X, Y, Z)
 * Perimeter convention:
 * Center crown is s = 0.
 * Left: s in [-pi*R/2 - H_wall, 0]
 * Right: s in [0, pi*R/2 + H_wall]
 */
export function unwrappedToSkin3D(
  s: number,
  z: number,
  width: number,
  totalHeight: number
): TunnelSkinPoint3D {
  const R = width / 2;
  const H_wall = Math.max(0.5, totalHeight - R);
  const halfArchPerimeter = (Math.PI * R) / 2;

  // Left Wall: s < -halfArchPerimeter
  if (s < -halfArchPerimeter) {
    const wallDist = -s - halfArchPerimeter; // distance down the left wall from springline
    return {
      x: -R,
      y: Math.max(0, H_wall - wallDist),
      z,
    };
  }

  // Right Wall: s > halfArchPerimeter
  if (s > halfArchPerimeter) {
    const wallDist = s - halfArchPerimeter; // distance down the right wall from springline
    return {
      x: R,
      y: Math.max(0, H_wall - wallDist),
      z,
    };
  }

  // Crown Arch: s in [-halfArchPerimeter, +halfArchPerimeter]
  const thetaArch = s / R; // radians from crown center (s=0 => theta=0 => top crown)
  return {
    x: R * Math.sin(thetaArch),
    y: H_wall + R * Math.cos(thetaArch),
    z,
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

  // Construct historical face logs STRICTLY from real savedProjects / logged rounds
  const historicalFaceLogs: SequentialFaceLog[] = [];
  if (savedProjects && savedProjects.length > 0) {
    savedProjects.forEach((proj) => {
      const ch = proj.numericChainageMeters ?? 100;
      const projRmr = proj.rmrParams?.totalRmr && proj.rmrParams.totalRmr > 0 ? proj.rmrParams.totalRmr : (rmrTotal ?? 50);
      const projQ = proj.qIndexParams?.qValue && proj.qIndexParams.qValue > 0 ? proj.qIndexParams.qValue : (qValue ?? 2.0);
      const projGsi = Math.max(10, Math.min(95, projRmr - 5));

      const regionContacts = (proj.lithologyRegions || [])
        .filter((lr) => lr.polygon && lr.polygon.length >= 2)
        .map((lr) => ({
          id: lr.id,
          lithologyName: lr.lithologyName || proj.settings?.lithology || lithologyName,
          polyline: lr.polygon.map((p) => ({ x: p.x, y: p.y })),
        }));

      const jointContacts =
        regionContacts.length > 0
          ? regionContacts
          : (proj.joints || [])
              .filter((j) => {
                const pts = j.geometry || (j as any).points;
                return pts && pts.length >= 2;
              })
              .slice(0, 4)
              .map((j, jIdx) => {
                const pts: { x: number; y: number }[] = j.geometry || (j as any).points || [];
                return {
                  id: `${proj.id}-jt-${jIdx}`,
                  lithologyName: `${j.set || 'J1'} (${proj.settings?.lithology || lithologyName})`,
                  polyline: pts.map((p) => ({
                    x: (p.x - 0.5) * (proj.geometry?.width || spanW),
                    y: (0.5 - p.y) * (proj.geometry?.height || heightH),
                  })),
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
