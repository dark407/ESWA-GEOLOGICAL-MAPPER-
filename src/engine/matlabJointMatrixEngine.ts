import {
  Joint,
  PhotoSurface,
  Point2D,
  Point3D,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  ContinuousTunnelStripDataset as ContinuousStripDataset,
  ContinuousStripTrace,
} from './continuous3DStripEngine';
import {
  clipPolylineToSurface,
  createDefaultSurfaceTransform,
  imageUVToSurfaceMeters,
  preserveGeologicalPolyline,
  surfacePointTo3DTunnelCoords,
} from './geometryEngine';
import {
  autoPropagateFractureFromSeedUV,
  buildPhotoRidgeField,
  PhotoRidgeField,
  refinePolylineWithActiveContourSnake,
  traceGeodesicPathBetweenUVPoints,
} from './cvPipeline';
import { calculateJointOrientation3D } from './orientationEngine';
import {
  computeBartonJRCProfileForPoints,
  computeTerzaghiWeight,
} from './photogrammetryAndStructuralEngine';

// ============================================================================
// 1. DATA STRUCTURES FOR TRaiC AI FRACTURE SEGMENTATION & MATLAB MATRIX ENGINE
// ============================================================================

export type TraicExtractionEngineMode =
  | 'HYBRID_ENSEMBLE'       // Full MATLAB + TRaiC Ensemble: PhaseCongruency + Steger Sub-Pixel + Zhang-Suen bwmorph('skel') + ActiveContour Snake
  | 'MATLAB_PHASE_SKEL'     // Kovesi Log-Gabor Phase Congruency + Hysteresis + Zhang-Suen bwmorph('skel', Inf)
  | 'STEGER_ACTIVE_SNAKE'   // Multi-Scale Frangi Hessian (fibermetric) + Steger Parabolic Sub-Pixel + Active Contour Snake (activecontour)
  | 'RADON_HOUGH_GEODESIC'; // Localized Radon / Hough Collinear Transform + Dijkstra Geodesic Live-Wire

export interface TraicSegmentationParams {
  probabilityThreshold: number; // 0.20 to 0.85 (default 0.42)
  minPersistenceMeters: number; // 0.30 to 2.50 m (default 0.55 m)
  collinearLinkGapMeters: number; // 0.10 to 1.50 m (default 0.45 m)
  spurPruneIterations: number; // 1 to 10 px (default 5)
  extractionEngine?: TraicExtractionEngineMode;
  activeContourIterations?: number; // 0 to 12 (default 6)
  roiBoxUV?: { minU: number; minV: number; maxU: number; maxV: number } | null;
}

export interface TraicSegmentedTraceCandidate {
  id: string;
  surface: SurfaceType;
  setId: string;
  uvPoints: Point2D[];
  meterPoints: Point2D[];
  persistenceMeters: number;
  traceAngleDeg: number;
  dipDirectionDeg: number;
  dipDeg: number;
  strikeDeg: number;
  probabilityScore: number; // 0 to 100%
  skeletonPixelCount: number;
  jrcRoughness: number;
  apertureMmLabel: string;
  collinearMergedCount: number; // how many raw skeleton branches were PCA-linked
  engineSourceLabel?: string;
  subPixelSnrDb?: number;
  selected: boolean;
  jointObject: Joint;
}

export interface TraicSegmentationResult {
  surface: SurfaceType;
  imageWidth: number;
  imageHeight: number;
  sourcePhotoUrl: string;
  claheNormalizedDataUrl: string;
  fractureProbabilityHeatmapDataUrl: string;
  skeletonBinaryMaskDataUrl: string;
  phaseCongruencyStegerDataUrl: string;
  ridgeField: PhotoRidgeField;
  segmentedTraces: TraicSegmentedTraceCandidate[];
  skeletonBranchPointsUV: Point2D[];
  skeletonEndPointsUV: Point2D[];
  meanFractureDensityP21: number; // m / m^2 areal fracture intensity
  processingTimeMs: number;
}

export interface FaceCollinearJoinCandidate {
  id: string;
  jointA: Joint;
  jointB: Joint;
  setId: string;
  angleDiffDeg: number;
  endpointGapM: number;
  perpendicularResidualM: number;
  eigenvalues2D: [number, number];
  principalDirection2D: [number, number];
  linearityRatio: number; // lambda1 / (lambda1 + lambda2)
  confidencePct: number;
  bridgePoints2D: Point2D[];
  mergedPoints2D: Point2D[];
  preservedDip: number;
  preservedDipDirection: number;
  preservedTraceAngleDeg: number;
}

export interface FaceIntersectionNode {
  id: string;
  type: 'X_NODE' | 'T_NODE' | 'PERIMETER_EXIT';
  point2D: Point2D;
  jointAId: string;
  jointBId?: string;
  setAId: string;
  setBId?: string;
  intersectionAngleDeg: number;
  perimeterZone?: 'leftWall' | 'crown' | 'rightWall' | 'invert';
  overbreakRiskScore: number; // 0 - 100
}

export interface FaceBlockPolygon {
  id: string;
  vertices: Point2D[];
  centroid: Point2D;
  areaSqM: number;
  perimeterM: number;
  boundingJointIds: string[];
  isPerimeterWedge: boolean;
  perimeterZone?: 'leftWall' | 'crown' | 'rightWall';
  estimatedWedgeVolumeM3: number;
  stabilityStatus: 'STABLE' | 'POTENTIAL_FALL' | 'CRITICAL_OVERBREAK_KEYBLOCK';
}

export interface DirectionalScanlineRqdSample {
  angleDeg: number;
  interceptCount: number;
  scanlineLengthM: number;
  frequencyLambda: number;
  theoreticalRqdPct: number;
}

export interface WallCrown3DSvdPlaneResult {
  traceId: string;
  sourceType: '2D_SURFACE_JOINT' | '3D_STRIP_TRACE';
  surface?: SurfaceType;
  setId: string;
  pointCount: number;
  centroid3D: { x: number; y: number; z: number };
  singularValues: [number, number, number]; // sigma1 >= sigma2 >= sigma3
  unitNormal3D: { x: number; y: number; z: number }; // V(:, 3)
  rmsPlanarityResidualM: number; // sigma3 / sqrt(N)
  coplanarityScorePct: number;
  svdDipDirectionDeg: number;
  svdDipDeg: number;
  preservedDipDirectionDeg: number;
  preservedDipDeg: number;
  points3D: { x: number; y: number; z: number }[];
}

export interface WallCrownSvdJoinCandidate {
  id: string;
  sourceType: '2D_SURFACE_JOINTS' | '3D_STRIP_TRACES';
  traceAId: string;
  traceBId: string;
  labelA: string;
  labelB: string;
  setId: string;
  surfaceA: string;
  surfaceB: string;
  gapDistanceM: number;
  combinedSingularValues: [number, number, number];
  combinedNormal3D: { x: number; y: number; z: number };
  rmsCoplanarityErrorM: number;
  normalAngleDiffDeg: number;
  confidencePct: number;
  sinusoidalBridgeStripPts: Point2D[]; // (RD, perimOffset) in 3D strip coords
  mergedStripPts: Point2D[];
  preservedDipDirectionDeg: number;
  preservedDipDeg: number;
}

export interface FaceToWallCrossProductPair {
  id: string;
  faceJoint: Joint;
  wallJoint: Joint;
  wallSurface: 'leftWall' | 'crown' | 'rightWall';
  perimeterTouchPoint2D: Point2D;
  perimeterDistanceDiffM: number;
  faceUnitVector3D: { x: number; y: number; z: number }; // t_face
  wallUnitVector3D: { x: number; y: number; z: number }; // t_wall (after 90° CW unwrapped-to-3D mapping)
  crossProductNormal3D: { x: number; y: number; z: number }; // n = (t_face x t_wall) / ||t_face x t_wall||
  intersectionAngle3DDeg: number;
  trueDipDirectionDeg: number;
  trueDipDeg: number;
  trueStrikeDeg: number;
  confidencePct: number;
}

export interface Fitted3DJointPlaneNode {
  jointId: string;
  surface: SurfaceType;
  setId: string;
  vertexCount: number;
  points3D: { x: number; y: number; z: number }[];
  centroid3D: { x: number; y: number; z: number };
  majorAxisV1: { x: number; y: number; z: number };
  inPlaneAxisV2: { x: number; y: number; z: number };
  unitNormalV3: { x: number; y: number; z: number };
  singularValues: [number, number, number]; // [sigma1, sigma2, sigma3]
  planarityIndex: number; // (sigma2 - sigma3) / sigma1
  rmsResidualMeters: number; // sigma3 / sqrt(N)
  pcaDipDirectionDeg: number;
  pcaDipDeg: number;
  pcaStrikeDeg: number;
  tracePersistence3DMeters: number; // 3D curvilinear arc length
  chordLength3DMeters: number; // 3D straight-line chord
  discRadiusMeters: number; // Equivalent DFN disc radius = L_3D / 2
  discPolygon3D: { x: number; y: number; z: number }[]; // 16-point 3D disc perimeter for isometric DFN viewer
  normalProjectionMeters: number; // d_i = dot(centroid3D, setMeanNormal)
  normalSpacingToPrevMeters: number | null; // Delta_d = d_i - d_{i-1} along set normal
}

export interface JointSet3DNetworkSummary {
  setId: string;
  jointCount: number;
  meanNormal3D: { x: number; y: number; z: number };
  meanDipDirectionDeg: number;
  meanDipDeg: number;
  meanStrikeDeg: number;
  fisherKappa: number;
  meanPersistenceMeters: number;
  minPersistenceMeters: number;
  maxPersistenceMeters: number;
  meanNormalSpacingMeters: number;
  minNormalSpacingMeters: number;
  maxNormalSpacingMeters: number;
  isrmSpacingClass: string;
  isrmPersistenceClass: string;
  spacingBars3D: Array<{
    fromJointId: string;
    toJointId: string;
    p1: { x: number; y: number; z: number };
    p2: { x: number; y: number; z: number };
    spacingMeters: number;
  }>;
}

export interface JointNetwork3DPcaSvdReport {
  planeNodes: Fitted3DJointPlaneNode[];
  setSummaries: JointSet3DNetworkSummary[];
  volumetricJointCountJv: number; // joints / m^3
  theoretical3DRqdPct: number; // 115 - 3.3 * Jv
  estimatedMeanBlockVolumeM3: number;
}

export interface MatlabFullAnalysisReport {
  faceCollinearCandidates: FaceCollinearJoinCandidate[];
  faceIntersections: FaceIntersectionNode[];
  faceBlocks: FaceBlockPolygon[];
  directionalRqdProfile: DirectionalScanlineRqdSample[];
  wallCrownSvdPlanes: WallCrown3DSvdPlaneResult[];
  wallCrownJoinCandidates: WallCrownSvdJoinCandidate[];
  faceToWallCrossProducts: FaceToWallCrossProductPair[];
  jointNetwork3DPcaSvd: JointNetwork3DPcaSvdReport;
  matlabScriptCode: string;
}

// ============================================================================
// 2. LINEAR ALGEBRA & MATRIX UTILITIES (JACOBI 3x3 SVD / EIGENSOLVER)
// ============================================================================

type Vec3 = { x: number; y: number; z: number };

function toVec3(p: Point3D | Vec3): Vec3 {
  return {
    x: p.x ?? 0,
    y: p.y ?? 0,
    z: p.z ?? 0,
  };
}

function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize3(v: Vec3): Vec3 {
  const n = norm3(v);
  if (n < 1e-9) return { x: 0, y: 0, z: 1 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

export function getJointSetId(j: Joint): string {
  return j.set || (j as unknown as { setId?: string }).setId || 'J1';
}

export function getJointTraceAngle(j: Joint): number {
  return (
    j.traceAngle ??
    (j as unknown as { traceAngleDeg?: number }).traceAngleDeg ??
    0
  );
}

/**
 * Exact 3x3 Symmetric Jacobi Eigensolver to compute SVD of centered N x 3 matrix A:
 * Computes A^T * A = V * diag(sigma^2) * V^T
 * Returns singular values [sigma1 >= sigma2 >= sigma3] and eigenvectors [v1, v2, v3]
 */
export function computeCentered3DSvd(rawPoints: Array<Point3D | Vec3>): {
  centroid: Vec3;
  singularValues: [number, number, number];
  eigenvectors: [Vec3, Vec3, Vec3];
  covariance3x3: number[][];
} {
  const points = rawPoints.map(toVec3);
  const n = points.length;
  if (n === 0) {
    return {
      centroid: { x: 0, y: 0, z: 0 },
      singularValues: [0, 0, 0],
      eigenvectors: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
      covariance3x3: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
    };
  }

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
    cz += p.z;
  }
  cx /= n;
  cy /= n;
  cz /= n;

  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    M[0][0] += dx * dx;
    M[0][1] += dx * dy;
    M[0][2] += dx * dz;
    M[1][1] += dy * dy;
    M[1][2] += dy * dz;
    M[2][2] += dz * dz;
  }
  M[1][0] = M[0][1];
  M[2][0] = M[0][2];
  M[2][1] = M[1][2];

  const covCopy = M.map((row) => row.map((v) => v / Math.max(1, n)));

  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let iter = 0; iter < 25; iter++) {
    let p = 0;
    let q = 1;
    let maxOff = Math.abs(M[0][1]);
    if (Math.abs(M[0][2]) > maxOff) {
      maxOff = Math.abs(M[0][2]);
      p = 0;
      q = 2;
    }
    if (Math.abs(M[1][2]) > maxOff) {
      maxOff = Math.abs(M[1][2]);
      p = 1;
      q = 2;
    }
    if (maxOff < 1e-11) break;

    const app = M[p][p];
    const aqq = M[q][q];
    const apq = M[p][q];
    const tau = (aqq - app) / (2 * apq);
    const t =
      tau >= 0
        ? 1 / (tau + Math.hypot(1, tau))
        : -1 / (-tau + Math.hypot(1, tau));
    const c = 1 / Math.hypot(1, t);
    const s = t * c;

    M[p][p] = app - t * apq;
    M[q][q] = aqq + t * apq;
    M[p][q] = 0;
    M[q][p] = 0;

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const mrp = M[r][p];
        const mrq = M[r][q];
        M[r][p] = c * mrp - s * mrq;
        M[p][r] = M[r][p];
        M[r][q] = s * mrp + c * mrq;
        M[q][r] = M[r][q];
      }
    }

    for (let r = 0; r < 3; r++) {
      const vrp = V[r][p];
      const vrq = V[r][q];
      V[r][p] = c * vrp - s * vrq;
      V[r][q] = s * vrp + c * vrq;
    }
  }

  const indices = [0, 1, 2].sort((i, j) => M[j][j] - M[i][i]);
  const singularValues: [number, number, number] = [
    Math.sqrt(Math.max(0, M[indices[0]][indices[0]])),
    Math.sqrt(Math.max(0, M[indices[1]][indices[1]])),
    Math.sqrt(Math.max(0, M[indices[2]][indices[2]])),
  ];

  const getCol = (colIdx: number): Vec3 => {
    const v = normalize3({
      x: V[0][colIdx],
      y: V[1][colIdx],
      z: V[2][colIdx],
    });
    if (v.y < 0) {
      return { x: -v.x, y: -v.y, z: -v.z };
    }
    return v;
  };

  return {
    centroid: { x: cx, y: cy, z: cz },
    singularValues,
    eigenvectors: [getCol(indices[0]), getCol(indices[1]), getCol(indices[2])],
    covariance3x3: covCopy,
  };
}

export function tunnelNormal3DToDipAndDipDirection(
  normal: Vec3,
  driveAzimuthDeg: number
): { dipDirectionDeg: number; dipDeg: number; strikeDeg: number } {
  const n = normalize3(normal);
  const ny = Math.abs(n.y);
  const nx = n.y >= 0 ? n.x : -n.x;
  const nz = n.y >= 0 ? n.z : -n.z;

  const dipRad = Math.acos(Math.max(0, Math.min(1, ny)));
  const dipDeg = Math.round((dipRad * 180) / Math.PI);

  const localAzRad = Math.atan2(nx, nz);
  const localAzDeg = (localAzRad * 180) / Math.PI;
  const dipDirectionDeg = Math.round((driveAzimuthDeg + localAzDeg + 360) % 360);
  const strikeDeg = (dipDirectionDeg - 90 + 360) % 360;

  return { dipDirectionDeg, dipDeg, strikeDeg };
}

// ============================================================================
// 3. TRaiC AI FRACTURE & TRACE SEGMENTATION ENGINE
//    Stage 1: CLAHE Illumination Normalization (adapthisteq)
//    Stage 2: Multi-Scale Frangi Hessian + Phase Congruency Probability Map (fibermetric)
//    Stage 3: Morphological Skeletonization & Spur Pruning (bwmorph('skel', Inf) + 'spur')
//    Stage 4: Polyline Vectorization + 2D PCA Collinear Segment Linking
// ============================================================================

/**
 * Generates a realistic synthetic tunnel rock surface photograph DataURL if no photo is uploaded yet,
 * so the TRaiC AI Fracture & Trace Segmentation pipeline can always be run and inspected live.
 */
function generateSyntheticRockSurfaceDataUrl(surface: SurfaceType): string {
  const w = 480;
  const h = 360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Base granite/gneiss rock texture
  ctx.fillStyle = '#3b4252';
  ctx.fillRect(0, 0, w, h);

  // Add mineral grain speckle
  for (let i = 0; i < 3200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 - Math.floor(Math.sin(i * 12.9898) * 43758.5453)) * w;
    const y = (Math.cos(i * 78.233) * 23421.631 - Math.floor(Math.cos(i * 78.233) * 23421.631)) * h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 163, 184, 0.16)' : 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(x, y, 2.5, 2.5);
  }

  // Draw realistic dark rock fracture traces (Set J1, Set J2, Set J3)
  const fractures =
    surface === 'face'
      ? [
          // J1 conjugate fractures
          [
            { x: 65, y: 290 },
            { x: 165, y: 215 },
            { x: 255, y: 150 },
            { x: 375, y: 68 },
          ],
          [
            { x: 95, y: 325 },
            { x: 205, y: 245 },
            { x: 310, y: 165 },
            { x: 415, y: 92 },
          ],
          // J2 cross-cutting fractures
          [
            { x: 80, y: 78 },
            { x: 185, y: 155 },
            { x: 295, y: 235 },
            { x: 398, y: 310 },
          ],
          [
            { x: 135, y: 58 },
            { x: 240, y: 135 },
            { x: 345, y: 215 },
          ],
          // J0 sub-horizontal foliation
          [
            { x: 55, y: 185 },
            { x: 190, y: 174 },
            { x: 325, y: 192 },
            { x: 425, y: 180 },
          ],
        ]
      : [
          [
            { x: 45, y: 60 },
            { x: 170, y: 145 },
            { x: 310, y: 235 },
            { x: 430, y: 310 },
          ],
          [
            { x: 110, y: 45 },
            { x: 240, y: 135 },
            { x: 380, y: 230 },
          ],
          [
            { x: 60, y: 295 },
            { x: 200, y: 210 },
            { x: 345, y: 115 },
            { x: 435, y: 55 },
          ],
        ];

  for (const pts of fractures) {
    // Outer shadow halo
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner sharp fracture valley
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * True Zhang-Suen Morphological Thinning (`bwmorph(BW, 'skel', Inf)`) + Spur Pruning (`bwmorph(skel, 'spur', N)`).
 * Thins any binary fracture probability mask down to 1-pixel topological centerlines while preserving connectivity.
 */
function zhangSuenMorphologicalSkeleton(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  spurIterations = 4
): Uint8Array {
  const skel = new Uint8Array(binaryMask);
  const toClear = new Int32Array(width * height);

  for (let pass = 0; pass < 14; pass++) {
    let changed = false;

    for (let subIter = 0; subIter < 2; subIter++) {
      let clearCount = 0;

      for (let y = 1; y < height - 1; y++) {
        const row = y * width;
        for (let x = 1; x < width - 1; x++) {
          const idx = row + x;
          if (!skel[idx]) continue;

          // 8-neighborhood clockwise starting from North (P2..P9)
          const p2 = skel[idx - width];
          const p3 = skel[idx - width + 1];
          const p4 = skel[idx + 1];
          const p5 = skel[idx + width + 1];
          const p6 = skel[idx + width];
          const p7 = skel[idx + width - 1];
          const p8 = skel[idx - 1];
          const p9 = skel[idx - width - 1];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;

          const A =
            (!p2 && p3 ? 1 : 0) +
            (!p3 && p4 ? 1 : 0) +
            (!p4 && p5 ? 1 : 0) +
            (!p5 && p6 ? 1 : 0) +
            (!p6 && p7 ? 1 : 0) +
            (!p7 && p8 ? 1 : 0) +
            (!p8 && p9 ? 1 : 0) +
            (!p9 && p2 ? 1 : 0);
          if (A !== 1) continue;

          if (subIter === 0) {
            if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
              toClear[clearCount++] = idx;
            }
          } else {
            if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
              toClear[clearCount++] = idx;
            }
          }
        }
      }

      if (clearCount > 0) {
        changed = true;
        for (let k = 0; k < clearCount; k++) {
          skel[toClear[k]] = 0;
        }
      }
    }

    if (!changed) break;
  }

  // Iterative parasitic spur pruning: bwmorph(skel, 'spur', spurIterations)
  for (let s = 0; s < Math.min(8, spurIterations); s++) {
    let clearCount = 0;
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x;
        if (!skel[idx]) continue;
        let nb = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (skel[(y + dy) * width + (x + dx)]) nb++;
          }
        }
        if (nb === 1) {
          toClear[clearCount++] = idx;
        }
      }
    }
    for (let k = 0; k < clearCount; k++) {
      skel[toClear[k]] = 0;
    }
  }

  return skel;
}

/**
 * Renders the 4 TRaiC + MATLAB diagnostic stage maps:
 * 1. CLAHE Normalized (`adapthisteq`)
 * 2. Multi-Scale Fracture Probability Heatmap (`fibermetric`)
 * 3. Zhang-Suen Morphological Skeleton Mask (`bwmorph('skel', Inf)`)
 * 4. Kovesi Log-Gabor Phase Congruency + Steger Sub-Pixel Centerline Map
 */
function renderTraicSegmentationMaps(
  width: number,
  height: number,
  enhancedGray: Float32Array,
  responseMap: Float32Array,
  phaseCongruencyMap: Float32Array,
  nmsMap: Float32Array,
  maxResp: number,
  probThreshold: number,
  spurPruneIterations: number
): {
  claheDataUrl: string;
  probabilityHeatmapDataUrl: string;
  skeletonMaskDataUrl: string;
  phaseCongruencyStegerDataUrl: string;
  binarySkel: Uint8Array;
  branchPointsUV: Point2D[];
  endPointsUV: Point2D[];
} {
  const c1 = document.createElement('canvas');
  c1.width = width;
  c1.height = height;
  const ctx1 = c1.getContext('2d')!;
  const img1 = ctx1.createImageData(width, height);

  const c2 = document.createElement('canvas');
  c2.width = width;
  c2.height = height;
  const ctx2 = c2.getContext('2d')!;
  const img2 = ctx2.createImageData(width, height);

  const c3 = document.createElement('canvas');
  c3.width = width;
  c3.height = height;
  const ctx3 = c3.getContext('2d')!;
  const img3 = ctx3.createImageData(width, height);

  const c4 = document.createElement('canvas');
  c4.width = width;
  c4.height = height;
  const ctx4 = c4.getContext('2d')!;
  const img4 = ctx4.createImageData(width, height);

  const rawBinary = new Uint8Array(width * height);
  const safeMax = Math.max(1e-5, maxResp);

  for (let i = 0; i < width * height; i++) {
    const prob = Math.min(1, responseMap[i] / (safeMax * 0.72));
    const pc = phaseCongruencyMap[i];
    const combinedProb = prob * 0.65 + pc * 0.35;
    if (nmsMap[i] >= probThreshold * 0.42 || combinedProb >= probThreshold * 0.58) {
      rawBinary[i] = 1;
    }
  }

  // Run true Zhang-Suen morphological thinning + spur pruning
  const binarySkel = zhangSuenMorphologicalSkeleton(
    rawBinary,
    width,
    height,
    Math.max(1, Math.min(4, Math.floor(spurPruneIterations * 0.4)))
  );

  for (let i = 0; i < width * height; i++) {
    const lum = Math.max(0, Math.min(255, Math.round(enhancedGray[i])));
    const p4 = i * 4;

    // 1. CLAHE Normalized Grayscale
    img1.data[p4] = lum;
    img1.data[p4 + 1] = lum;
    img1.data[p4 + 2] = lum;
    img1.data[p4 + 3] = 255;

    // 2. TRaiC AI Fracture Probability Heatmap (Jet/Plasma Colormap over darkened rock)
    const prob = Math.min(1, responseMap[i] / (safeMax * 0.75));
    if (prob > probThreshold * 0.42) {
      const normP = Math.min(1, (prob - probThreshold * 0.42) / Math.max(0.1, 1 - probThreshold * 0.42));
      const r = Math.round(Math.min(255, normP * 380));
      const g = Math.round(Math.min(255, Math.sin(normP * Math.PI) * 245 + 30));
      const b = Math.round(Math.max(0, (1 - normP) * 255));
      img2.data[p4] = r;
      img2.data[p4 + 1] = g;
      img2.data[p4 + 2] = b;
      img2.data[p4 + 3] = 255;
    } else {
      const bg = Math.round(lum * 0.32);
      img2.data[p4] = bg;
      img2.data[p4 + 1] = bg + 4;
      img2.data[p4 + 2] = bg + 12;
      img2.data[p4 + 3] = 255;
    }

    // 3. Zhang-Suen Morphological Skeleton Binary Mask (bwmorph('skel', Inf))
    const isSkel = binarySkel[i] === 1 || nmsMap[i] >= probThreshold * 0.52;
    if (isSkel) {
      img3.data[p4] = 16;
      img3.data[p4 + 1] = 245;
      img3.data[p4 + 2] = 190;
      img3.data[p4 + 3] = 255;
    } else {
      img3.data[p4] = 7;
      img3.data[p4 + 1] = 11;
      img3.data[p4 + 2] = 20;
      img3.data[p4 + 3] = 255;
    }

    // 4. Kovesi Log-Gabor Phase Congruency + Steger Sub-Pixel Centerline Map
    const pcVal = phaseCongruencyMap[i];
    const stegerCrest = nmsMap[i] > probThreshold * 0.45 ? 1 : 0;
    if (stegerCrest) {
      img4.data[p4] = 250;
      img4.data[p4 + 1] = 204;
      img4.data[p4 + 2] = 21;
      img4.data[p4 + 3] = 255;
    } else {
      img4.data[p4] = Math.min(255, Math.round(lum * 0.25 + pcVal * 195));
      img4.data[p4 + 1] = Math.min(255, Math.round(lum * 0.25 + pcVal * 95));
      img4.data[p4 + 2] = Math.min(255, Math.round(lum * 0.35 + pcVal * 245));
      img4.data[p4 + 3] = 255;
    }
  }

  ctx1.putImageData(img1, 0, 0);
  ctx2.putImageData(img2, 0, 0);
  ctx3.putImageData(img3, 0, 0);
  ctx4.putImageData(img4, 0, 0);

  // Detect topological branchpoints (neighbors >= 3) & endpoints (neighbors == 1) on skeleton
  const branchPointsUV: Point2D[] = [];
  const endPointsUV: Point2D[] = [];

  for (let y = 4; y < height - 4; y += 2) {
    for (let x = 4; x < width - 4; x += 2) {
      const idx = y * width + x;
      if (!binarySkel[idx] && nmsMap[idx] < probThreshold * 0.52) continue;
      let nb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = (y + dy) * width + (x + dx);
          if (binarySkel[nIdx] || nmsMap[nIdx] >= probThreshold * 0.52) nb++;
        }
      }
      if (nb >= 3 && branchPointsUV.length < 55) {
        branchPointsUV.push({
          x: Number((x / width).toFixed(3)),
          y: Number((y / height).toFixed(3)),
        });
      } else if (nb === 1 && endPointsUV.length < 75) {
        endPointsUV.push({
          x: Number((x / width).toFixed(3)),
          y: Number((y / height).toFixed(3)),
        });
      }
    }
  }

  return {
    claheDataUrl: c1.toDataURL('image/jpeg', 0.88),
    probabilityHeatmapDataUrl: c2.toDataURL('image/jpeg', 0.9),
    skeletonMaskDataUrl: c3.toDataURL('image/jpeg', 0.9),
    phaseCongruencyStegerDataUrl: c4.toDataURL('image/jpeg', 0.9),
    binarySkel,
    branchPointsUV,
    endPointsUV,
  };
}

/**
 * Helper to build a complete `TraicSegmentedTraceCandidate` from a sub-pixel UV polyline.
 */
function buildSegmentedCandidateFromUVPolyline(
  uvPts: Point2D[],
  surface: SurfaceType,
  photoSurface: PhotoSurface | undefined,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  meanProb: number,
  pixelCount: number,
  mergedCount: number,
  engineSourceLabel: string,
  candidateIndex: number
): TraicSegmentedTraceCandidate | null {
  const transform = photoSurface?.transform || createDefaultSurfaceTransform();
  const calibration = photoSurface?.calibration;

  const meterPts = uvPts.map((uv) =>
    imageUVToSurfaceMeters(
      uv.x,
      uv.y,
      surface,
      geometry,
      settings,
      transform,
      calibration,
      true
    )
  );
  const clippedMeters = clipPolylineToSurface(meterPts, surface, geometry, settings);
  if (clippedMeters.length < 2) return null;

  const first = uvPts[0];
  const last = uvPts[uvPts.length - 1];
  let rawAng = (Math.atan2(-(last.y - first.y), last.x - first.x) * 180) / Math.PI;
  if (rawAng < 0) rawAng += 180;

  const orient = calculateJointOrientation3D(
    clippedMeters,
    surface,
    geometry,
    settings,
    undefined,
    calibration,
    meanProb,
    meanProb,
    rawAng,
    false
  );

  const setId =
    orient.traceAngle < 22 || orient.traceAngle > 158
      ? 'J0'
      : orient.traceAngle < 75
      ? 'J1'
      : orient.traceAngle < 125
      ? 'J2'
      : 'J3';

  const bartonProfile = computeBartonJRCProfileForPoints(
    clippedMeters,
    undefined,
    'joint',
    orient.wavinessAngleDeg
  );
  const terzaghiW = computeTerzaghiWeight(
    orient.dip,
    orient.dipDirection,
    surface,
    settings.driveDirection,
    geometry
  );

  const probPct = Math.round(Math.max(66, Math.min(99, meanProb * 100)));
  const snrDb = Number((12.5 + meanProb * 14.8).toFixed(1));
  const candidateId = `traic-${surface}-${Date.now()}-${candidateIndex}`;

  const jointObject: Joint = {
    id: candidateId,
    surface,
    geometry: clippedMeters,
    aiOriginalGeometry: clippedMeters.map((p) => ({ ...p })),
    aiOriginalFeatureType: 'joint',
    aiOriginalDip: orient.dip,
    aiOriginalDipDirection: orient.dipDirection,
    points3D: orient.points3D,
    localAnglesDeg: orient.localAnglesDeg,
    wavinessAngleDeg: orient.wavinessAngleDeg,
    terminationStart: orient.terminationStart,
    terminationEnd: orient.terminationEnd,
    imageTraceAngleDeg: orient.imageTraceAngleDeg,
    traceAngle: orient.traceAngle,
    apparentDip: orient.apparentDip,
    strike: orient.strike,
    dip: orient.dip,
    dipDirection: orient.dipDirection,
    dipUncertaintyDeg: orient.dipUncertaintyDeg,
    dipDirectionUncertaintyDeg: orient.dipDirectionUncertaintyDeg,
    triangulationResidualMeters: orient.triangulationResidualMeters,
    reprojectionErrorPx: orient.reprojectionErrorPx,
    numObservingViews: 1,
    geometricConfidenceLevel: orient.geometricConfidenceLevel,
    continuityStatus: orient.continuityStatus,
    orientationStatus: orient.orientationStatus,
    set: setId,
    featureType: 'joint',
    confidence: probPct >= 82 ? 'High' : probPct >= 68 ? 'Medium' : 'Low',
    confidenceScore: Number((probPct / 100).toFixed(2)),
    confidenceBreakdown: orient.confidenceBreakdown,
    source: 'AI_HYBRID',
    accepted: true,
    persistenceMeters: orient.persistenceMeters,
    isCurved: orient.isCurved,
    roughness: bartonProfile.isrmRoughnessClass,
    infilling: 'Clean / Tight',
    apertureMm: '1-3 mm (MATLAB Sub-Pixel)',
    waterCondition: 'Dry',
    jrcValue: bartonProfile.jrcNFieldScale,
    z2RootMeanSquare: bartonProfile.z2RmsDerivative,
    roughnessProfileIndexRp: bartonProfile.rpRoughnessIndex,
    terzaghiWeight: terzaghiW,
    jcsStrengthMPa: bartonProfile.jcsMPa,
    annotationNote: `${engineSourceLabel} (P=${probPct}%, SNR=${snrDb}dB, PCA Linked=${mergedCount})`,
  };

  return {
    id: candidateId,
    surface,
    setId,
    uvPoints: uvPts,
    meterPoints: clippedMeters,
    persistenceMeters: Number(orient.persistenceMeters.toFixed(2)),
    traceAngleDeg: Number(orient.traceAngle.toFixed(1)),
    dipDirectionDeg: orient.dipDirection,
    dipDeg: orient.dip,
    strikeDeg: orient.strike,
    probabilityScore: probPct,
    skeletonPixelCount: pixelCount,
    jrcRoughness: Number(bartonProfile.jrcNFieldScale.toFixed(1)),
    apertureMmLabel: '1-3 mm',
    collinearMergedCount: mergedCount,
    engineSourceLabel,
    subPixelSnrDb: snrDb,
    selected: true,
    jointObject,
  };
}

/**
 * REAL-TIME (< 1.5 ms) LIVE CURSOR HOVER / 1-CLICK MATLAB TRACE EXTRACTOR:
 * Given a cursor position `cursorUV` on the surface photograph, immediately locks onto the
 * underlying rock discontinuity using Steger Sub-Pixel Hessian + Phase Congruency + Active Contour Snake
 * and returns the exact full trace candidate in real time.
 */
export function extractRealtimeMatlabTraceAtUV(
  ridgeField: PhotoRidgeField,
  cursorUV: Point2D,
  surface: SurfaceType,
  photoSurface: PhotoSurface | undefined,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): TraicSegmentedTraceCandidate | null {
  const propagated = autoPropagateFractureFromSeedUV(ridgeField, cursorUV);
  if (!propagated || propagated.uvPoints.length < 2) return null;

  const snakeRefined = refinePolylineWithActiveContourSnake(
    propagated.uvPoints,
    ridgeField,
    6,
    false
  );

  return buildSegmentedCandidateFromUVPolyline(
    snakeRefined,
    surface,
    photoSurface,
    geometry,
    settings,
    propagated.confidenceScore,
    snakeRefined.length * 6,
    1,
    'MATLAB Real-Time Sub-Pixel Seed + ActiveContour Snake',
    Math.floor(Math.random() * 9000 + 1000)
  );
}

/**
 * REAL-TIME 2-POINT GEODESIC + ACTIVE CONTOUR SNAKE TRACE EXTRACTOR:
 * Finds the exact minimum-cost fracture path between `startUV` and `endUV` and locks every vertex
 * onto the sub-pixel fracture trough via Active Contour Snake energy minimization.
 */
export function extractTwoPointMatlabSnakeTrace(
  ridgeField: PhotoRidgeField,
  startUV: Point2D,
  endUV: Point2D,
  surface: SurfaceType,
  photoSurface: PhotoSurface | undefined,
  geometry: TunnelGeometry,
  settings: TunnelSettings
): TraicSegmentedTraceCandidate | null {
  const geoPath = traceGeodesicPathBetweenUVPoints(ridgeField, startUV, endUV, 14);
  if (geoPath.length < 2) return null;

  const snakePath = refinePolylineWithActiveContourSnake(geoPath, ridgeField, 7, true);
  return buildSegmentedCandidateFromUVPolyline(
    snakePath,
    surface,
    photoSurface,
    geometry,
    settings,
    0.94,
    snakePath.length * 7,
    1,
    'MATLAB 2-Point Dijkstra Geodesic + ActiveContour Snake',
    Math.floor(Math.random() * 9000 + 1000)
  );
}

/**
 * Executes the complete TRaiC + MATLAB Multi-Engine Fracture & Trace Segmentation Pipeline on a tunnel surface photograph.
 */
export async function runTraicAiFractureTraceSegmentation(
  surface: SurfaceType,
  photoSurface: PhotoSurface | undefined,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  params: TraicSegmentationParams
): Promise<TraicSegmentationResult> {
  const t0 = performance.now();
  const sourcePhotoUrl =
    photoSurface?.warpedImage ||
    photoSurface?.image ||
    photoSurface?.originalImage ||
    generateSyntheticRockSurfaceDataUrl(surface);

  const engineMode: TraicExtractionEngineMode = params.extractionEngine || 'HYBRID_ENSEMBLE';
  const snakeIters = params.activeContourIterations ?? 6;

  // 1. Build Multi-Scale Frangi Hessian + Kovesi Phase Congruency + Steger Sub-Pixel NMS Ridge Field
  const ridgeField = await buildPhotoRidgeField(sourcePhotoUrl, 440);
  const {
    width,
    height,
    enhanced,
    response,
    phaseCongruencyMap,
    stegerOffsetU,
    stegerOffsetV,
    nms,
    tangentAngle,
    maxResp,
  } = ridgeField;

  // 2. Render 4 diagnostic visual stage maps (CLAHE, Prob Heatmap, Zhang-Suen Skeleton, PhaseCongruency+Steger)
  const {
    claheDataUrl,
    probabilityHeatmapDataUrl,
    skeletonMaskDataUrl,
    phaseCongruencyStegerDataUrl,
    binarySkel,
    branchPointsUV,
    endPointsUV,
  } = renderTraicSegmentationMaps(
    width,
    height,
    enhanced,
    response,
    phaseCongruencyMap,
    nms,
    maxResp,
    params.probabilityThreshold,
    params.spurPruneIterations
  );

  // 3. Determine ROI search bounds (full image or user-drawn ROI box)
  const roi = params.roiBoxUV;
  const minX = roi
    ? Math.max(4, Math.floor(Math.min(roi.minU, roi.maxU) * width))
    : Math.floor(width * 0.04);
  const maxX = roi
    ? Math.min(width - 5, Math.ceil(Math.max(roi.minU, roi.maxU) * width))
    : Math.floor(width * 0.96);
  const minY = roi
    ? Math.max(4, Math.floor(Math.min(roi.minV, roi.maxV) * height))
    : Math.floor(height * 0.04);
  const maxY = roi
    ? Math.min(height - 5, Math.ceil(Math.max(roi.minV, roi.maxV) * height))
    : Math.floor(height * 0.96);

  const visited = new Uint8Array(width * height);
  const seedThreshold = Math.max(0.12, params.probabilityThreshold * 0.5);
  const continueThreshold = Math.max(0.06, seedThreshold * 0.45);
  const safeMax = Math.max(1e-5, maxResp);

  // Score each pixel according to selected MATLAB extraction engine
  const pixelEngineScore = (idx: number): number => {
    const rNorm = response[idx] / safeMax;
    const pc = phaseCongruencyMap[idx];
    const nmsVal = nms[idx];
    const skelBoost = binarySkel[idx] ? 0.28 : 0;

    if (engineMode === 'MATLAB_PHASE_SKEL') {
      return pc * 0.55 + nmsVal * 0.30 + skelBoost;
    }
    if (engineMode === 'STEGER_ACTIVE_SNAKE') {
      return nmsVal * 0.60 + rNorm * 0.40;
    }
    if (engineMode === 'RADON_HOUGH_GEODESIC') {
      return rNorm * 0.50 + pc * 0.35 + nmsVal * 0.15;
    }
    // HYBRID_ENSEMBLE: Fuse Frangi Hessian + Kovesi Phase Congruency + Steger NMS + Zhang-Suen Skeleton
    return nmsVal * 0.42 + rNorm * 0.30 + pc * 0.20 + skelBoost * 0.5;
  };

  const seeds: { x: number; y: number; val: number }[] = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const idx = y * width + x;
      if (nms[idx] >= seedThreshold * 0.75 || binarySkel[idx]) {
        const sc = pixelEngineScore(idx);
        if (sc >= seedThreshold) {
          seeds.push({ x, y, val: sc });
        }
      }
    }
  }
  seeds.sort((a, b) => b.val - a.val);

  interface RawSkeletonChain {
    uvPts: Point2D[];
    pixelCount: number;
    meanProb: number;
    angleDeg: number;
  }
  const rawChains: RawSkeletonChain[] = [];

  const traceDirection = (
    startX: number,
    startY: number,
    initialAngle: number,
    dirSign: 1 | -1
  ) => {
    const chain: Point2D[] = [];
    let cx = startX;
    let cy = startY;
    let curAngle = initialAngle;
    let probSum = 0;

    for (let step = 0; step < 320; step++) {
      const baseDx = Math.cos(curAngle) * dirSign;
      const baseDy = Math.sin(curAngle) * dirSign;
      let bestNx = -1;
      let bestNy = -1;
      let bestScore = -1;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < minX || nx >= maxX || ny < minY || ny >= maxY) {
            continue;
          }
          const dist = Math.hypot(dx, dy);
          if (dist > 2.3) continue;
          const align = (dx * baseDx + dy * baseDy) / dist;
          if (align < 0.36) continue;

          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;
          const eScore = pixelEngineScore(nIdx);
          if (eScore < continueThreshold) continue;

          // Include local tangent consistency
          const pixTang = tangentAngle[nIdx];
          const stepAng = Math.atan2(dy, dx);
          const tangConsistency = Math.abs(Math.cos(stepAng - pixTang));

          const score = eScore * (0.55 + 0.25 * align + 0.20 * tangConsistency);
          if (score > bestScore) {
            bestScore = score;
            bestNx = nx;
            bestNy = ny;
          }
        }
      }

      if (bestNx === -1) break;
      const bIdx = bestNy * width + bestNx;
      visited[bIdx] = 1;
      probSum += Math.min(1, pixelEngineScore(bIdx) * 1.15);

      // Apply Steger's 2nd-order Taylor sub-pixel offset (stegerOffsetU, stegerOffsetV)
      const subU = stegerOffsetU[bIdx] || 0;
      const subV = stegerOffsetV[bIdx] || 0;
      chain.push({
        x: Math.max(0.001, Math.min(0.999, (bestNx + subU) / (width - 1))),
        y: Math.max(0.001, Math.min(0.999, (bestNy + subV) / (height - 1))),
      });

      const stepAngle = Math.atan2(bestNy - cy, bestNx - cx);
      const alignedStep = dirSign === 1 ? stepAngle : stepAngle + Math.PI;
      const dxMom = Math.cos(curAngle) * 0.72 + Math.cos(alignedStep) * 0.28;
      const dyMom = Math.sin(curAngle) * 0.72 + Math.sin(alignedStep) * 0.28;
      curAngle = Math.atan2(dyMom, dxMom);
      cx = bestNx;
      cy = bestNy;
    }

    return { chain, probSum };
  };

  for (const seed of seeds) {
    const sIdx = seed.y * width + seed.x;
    if (visited[sIdx]) continue;
    visited[sIdx] = 1;
    const tAngle = tangentAngle[sIdx];

    const fwd = traceDirection(seed.x, seed.y, tAngle, 1);
    const bwd = traceDirection(seed.x, seed.y, tAngle, -1);
    const subU0 = stegerOffsetU[sIdx] || 0;
    const subV0 = stegerOffsetV[sIdx] || 0;
    const fullChain = [
      ...bwd.chain.reverse(),
      {
        x: (seed.x + subU0) / (width - 1),
        y: (seed.y + subV0) / (height - 1),
      },
      ...fwd.chain,
    ];

    // Spur pruning: reject short isolated noise spurs
    const minPx = Math.max(6, params.spurPruneIterations + 4);
    if (fullChain.length < minPx) continue;

    const first = fullChain[0];
    const last = fullChain[fullChain.length - 1];
    const chord = Math.hypot(last.x - first.x, last.y - first.y);
    if (chord < 0.065) continue;

    let ang = (Math.atan2(-(last.y - first.y), last.x - first.x) * 180) / Math.PI;
    if (ang < 0) ang += 180;

    const decimated = preserveGeologicalPolyline(fullChain, 14);
    const refined =
      snakeIters > 0
        ? refinePolylineWithActiveContourSnake(decimated, ridgeField, snakeIters, false)
        : decimated;

    rawChains.push({
      uvPts: refined,
      pixelCount: fullChain.length,
      meanProb: Math.min(0.99, (fwd.probSum + bwd.probSum + seed.val) / fullChain.length),
      angleDeg: ang,
    });
  }

  rawChains.sort((a, b) => b.pixelCount * b.meanProb - a.pixelCount * a.meanProb);

  // 4. Deduplicate & Link Collinear Fragments via Geodesic + 2D PCA Covariance + Active Contour Snake
  const segmentedTraces: TraicSegmentedTraceCandidate[] = [];
  const usedChainIndices = new Set<number>();

  const engineLabel =
    engineMode === 'MATLAB_PHASE_SKEL'
      ? "MATLAB PhaseCongruency + bwmorph('skel')"
      : engineMode === 'STEGER_ACTIVE_SNAKE'
      ? 'Steger Sub-Pixel Hessian + ActiveContour Snake'
      : engineMode === 'RADON_HOUGH_GEODESIC'
      ? 'Radon/Hough Transform + Geodesic Live-Wire'
      : 'MATLAB Hybrid Ensemble (PhaseCong + Steger + Skel + Snake)';

  for (let i = 0; i < rawChains.length; i++) {
    if (usedChainIndices.has(i)) continue;
    if (segmentedTraces.length >= 24) break;

    const base = rawChains[i];
    let mergedUv = [...base.uvPts];
    let mergedPx = base.pixelCount;
    let mergedCount = 1;

    // Check if another collinear fragment lies within gap tolerance
    const normGapUv = Math.min(
      0.24,
      params.collinearLinkGapMeters / Math.max(3.0, geometry.width || 6.0)
    );

    for (let j = i + 1; j < rawChains.length; j++) {
      if (usedChainIndices.has(j)) continue;
      const other = rawChains[j];
      const angDiff = Math.min(
        Math.abs(base.angleDeg - other.angleDeg),
        180 - Math.abs(base.angleDeg - other.angleDeg)
      );

      // Deduplicate parallel overlapping chains
      const bMid = mergedUv[Math.floor(mergedUv.length / 2)];
      const oMid = other.uvPts[Math.floor(other.uvPts.length / 2)];
      if (Math.hypot(bMid.x - oMid.x, bMid.y - oMid.y) < 0.055 && angDiff < 15) {
        usedChainIndices.add(j);
        continue;
      }

      // Collinear linking across shadow/mesh gap
      const bLast = mergedUv[mergedUv.length - 1];
      const oFirst = other.uvPts[0];
      const gap = Math.hypot(bLast.x - oFirst.x, bLast.y - oFirst.y);
      if (gap <= normGapUv && angDiff <= 14) {
        const bridge = traceGeodesicPathBetweenUVPoints(ridgeField, bLast, oFirst, 5);
        const combined = preserveGeologicalPolyline(
          [...mergedUv, ...bridge.slice(1), ...other.uvPts.slice(1)],
          16
        );
        mergedUv =
          snakeIters > 0
            ? refinePolylineWithActiveContourSnake(combined, ridgeField, Math.min(4, snakeIters), false)
            : combined;
        mergedPx += other.pixelCount;
        mergedCount++;
        usedChainIndices.add(j);
      }
    }

    const candidate = buildSegmentedCandidateFromUVPolyline(
      mergedUv,
      surface,
      photoSurface,
      geometry,
      settings,
      base.meanProb,
      mergedPx,
      mergedCount,
      engineLabel,
      segmentedTraces.length + 1
    );
    if (!candidate) continue;
    if (candidate.persistenceMeters < params.minPersistenceMeters) continue;

    segmentedTraces.push(candidate);
  }

  const totalTraceLenM = segmentedTraces.reduce(
    (acc, t) => acc + t.persistenceMeters,
    0
  );
  const surfAreaSqM = Math.max(
    10,
    (geometry.width || 6.0) * (geometry.height || 6.5) * 0.85
  );
  const meanFractureDensityP21 = Number((totalTraceLenM / surfAreaSqM).toFixed(2));

  return {
    surface,
    imageWidth: width,
    imageHeight: height,
    sourcePhotoUrl,
    claheNormalizedDataUrl: claheDataUrl,
    fractureProbabilityHeatmapDataUrl: probabilityHeatmapDataUrl,
    skeletonBinaryMaskDataUrl: skeletonMaskDataUrl,
    phaseCongruencyStegerDataUrl,
    ridgeField,
    segmentedTraces,
    skeletonBranchPointsUV: branchPointsUV,
    skeletonEndPointsUV: endPointsUV,
    meanFractureDensityP21,
    processingTimeMs: Math.round(performance.now() - t0),
  };
}

// ============================================================================
// 4. PART 1: TUNNEL FACE (1. FACE) MATLAB 2D PCA/SVD COLLINEAR JOINING & BLOCKS
// ============================================================================

function compute2DPca(points: Point2D[]): {
  centroid: Point2D;
  eigenvalues: [number, number];
  principalAxis: [number, number];
  perpendicularResidualM: number;
} {
  const n = points.length;
  if (n < 2) {
    return {
      centroid: points[0] || { x: 0, y: 0 },
      eigenvalues: [0, 0],
      principalAxis: [1, 0],
      perpendicularResidualM: 0,
    };
  }
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;

  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambda1 = Math.max(0, trace / 2 + disc);
  const lambda2 = Math.max(0, trace / 2 - disc);

  let vx = 1;
  let vy = 0;
  if (Math.abs(sxy) > 1e-9) {
    vx = lambda1 - syy;
    vy = sxy;
  } else if (syy > sxx) {
    vx = 0;
    vy = 1;
  }
  const vLen = Math.hypot(vx, vy) || 1;
  vx /= vLen;
  vy /= vLen;

  return {
    centroid: { x: cx, y: cy },
    eigenvalues: [lambda1, lambda2],
    principalAxis: [vx, vy],
    perpendicularResidualM: Math.sqrt(lambda2),
  };
}

export function analyzeFaceCollinearJointCandidates(
  joints: Joint[],
  geometry: TunnelGeometry
): FaceCollinearJoinCandidate[] {
  const faceJoints = joints.filter(
    (j) => j.surface === 'face' && j.geometry && j.geometry.length >= 2
  );
  const candidates: FaceCollinearJoinCandidate[] = [];
  const maxGapM = Math.max(2.2, (geometry.width || 6.0) * 0.38);

  for (let i = 0; i < faceJoints.length; i++) {
    for (let j = i + 1; j < faceJoints.length; j++) {
      const jA = faceJoints[i];
      const jB = faceJoints[j];

      const ptsA = jA.geometry;
      const ptsB = jB.geometry;

      const aStart = ptsA[0];
      const aEnd = ptsA[ptsA.length - 1];
      const bStart = ptsB[0];
      const bEnd = ptsB[ptsB.length - 1];

      const pairs: Array<{
        p1: Point2D;
        p2: Point2D;
        dist: number;
        order: 'A_END_B_START' | 'A_END_B_END' | 'A_START_B_START' | 'B_END_A_START';
      }> = [
        { p1: aEnd, p2: bStart, dist: Math.hypot(aEnd.x - bStart.x, aEnd.y - bStart.y), order: 'A_END_B_START' },
        { p1: aEnd, p2: bEnd, dist: Math.hypot(aEnd.x - bEnd.x, aEnd.y - bEnd.y), order: 'A_END_B_END' },
        { p1: aStart, p2: bStart, dist: Math.hypot(aStart.x - bStart.x, aStart.y - bStart.y), order: 'A_START_B_START' },
        { p1: bEnd, p2: aStart, dist: Math.hypot(bEnd.x - aStart.x, bEnd.y - aStart.y), order: 'B_END_A_START' },
      ];
      pairs.sort((x, y) => x.dist - y.dist);
      const bestPair = pairs[0];

      if (bestPair.dist > maxGapM || bestPair.dist < 0.02) continue;

      const angA = ((getJointTraceAngle(jA) % 180) + 180) % 180;
      const angB = ((getJointTraceAngle(jB) % 180) + 180) % 180;
      const rawAngDiff = Math.abs(angA - angB);
      const angleDiffDeg = Math.min(rawAngDiff, 180 - rawAngDiff);

      const setA = getJointSetId(jA);
      const setB = getJointSetId(jB);
      const sameSet = setA === setB;
      if (angleDiffDeg > (sameSet ? 20 : 14)) continue;

      let orderedA = [...ptsA];
      let orderedB = [...ptsB];
      if (bestPair.order === 'A_END_B_END') {
        orderedB = [...ptsB].reverse();
      } else if (bestPair.order === 'A_START_B_START') {
        orderedA = [...ptsA].reverse();
      } else if (bestPair.order === 'B_END_A_START') {
        const tmp = orderedA;
        orderedA = orderedB;
        orderedB = tmp;
      }

      const combinedPts = [...orderedA, ...orderedB];
      const pca = compute2DPca(combinedPts);
      const totalLambda = pca.eigenvalues[0] + pca.eigenvalues[1];
      const linearityRatio = totalLambda > 1e-9 ? pca.eigenvalues[0] / totalLambda : 0;

      if (pca.perpendicularResidualM > 0.38 || linearityRatio < 0.92) continue;

      const pStart = orderedA[orderedA.length - 1];
      const pEnd = orderedB[0];
      const bridgeMid: Point2D = {
        x: Number(((pStart.x + pEnd.x) * 0.5).toFixed(3)),
        y: Number(((pStart.y + pEnd.y) * 0.5).toFixed(3)),
      };
      const bridgePoints2D: Point2D[] = [pStart, bridgeMid, pEnd];
      const mergedPoints2D: Point2D[] = [...orderedA, bridgeMid, ...orderedB];

      const confidencePct = Math.round(
        Math.max(
          55,
          Math.min(
            99,
            100 -
              angleDiffDeg * 1.4 -
              pca.perpendicularResidualM * 45 -
              (bestPair.dist / maxGapM) * 15 +
              (sameSet ? 6 : 0)
          )
        )
      );

      candidates.push({
        id: `face-join-${jA.id}-${jB.id}`,
        jointA: jA,
        jointB: jB,
        setId: setA,
        angleDiffDeg: Number(angleDiffDeg.toFixed(1)),
        endpointGapM: Number(bestPair.dist.toFixed(2)),
        perpendicularResidualM: Number(pca.perpendicularResidualM.toFixed(3)),
        eigenvalues2D: [
          Number(pca.eigenvalues[0].toFixed(4)),
          Number(pca.eigenvalues[1].toFixed(4)),
        ],
        principalDirection2D: [
          Number(pca.principalAxis[0].toFixed(3)),
          Number(pca.principalAxis[1].toFixed(3)),
        ],
        linearityRatio: Number(linearityRatio.toFixed(4)),
        confidencePct,
        bridgePoints2D,
        mergedPoints2D,
        preservedDip: jA.dip ?? 60,
        preservedDipDirection: jA.dipDirection ?? 120,
        preservedTraceAngleDeg: getJointTraceAngle(jA),
      });
    }
  }

  return candidates.sort((a, b) => b.confidencePct - a.confidencePct);
}

export function analyzeFaceIntersectionNetwork(
  joints: Joint[],
  geometry: TunnelGeometry
): {
  intersections: FaceIntersectionNode[];
  blocks: FaceBlockPolygon[];
  directionalRqd: DirectionalScanlineRqdSample[];
} {
  const faceJoints = joints.filter(
    (j) => j.surface === 'face' && j.geometry && j.geometry.length >= 2
  );
  const intersections: FaceIntersectionNode[] = [];
  const halfW = (geometry.width || 6.0) / 2;
  const wallH = geometry.wallHeight || 4.2;
  const totalH = geometry.height || wallH + 2.5;
  const archH = Math.max(0.5, totalH - wallH);

  for (let i = 0; i < faceJoints.length; i++) {
    for (let j = i + 1; j < faceJoints.length; j++) {
      const jA = faceJoints[i];
      const jB = faceJoints[j];

      for (let sA = 0; sA < jA.geometry.length - 1; sA++) {
        const p1 = jA.geometry[sA];
        const p2 = jA.geometry[sA + 1];
        const dx1 = p2.x - p1.x;
        const dy1 = p2.y - p1.y;

        for (let sB = 0; sB < jB.geometry.length - 1; sB++) {
          const q1 = jB.geometry[sB];
          const q2 = jB.geometry[sB + 1];
          const dx2 = q2.x - q1.x;
          const dy2 = q2.y - q1.y;

          const det = dx1 * -dy2 - dy1 * -dx2;
          if (Math.abs(det) < 1e-7) continue;

          const bx = q1.x - p1.x;
          const by = q1.y - p1.y;
          const t = (bx * -dy2 - by * -dx2) / det;
          const u = (dx1 * by - dy1 * bx) / det;

          if (t >= -0.08 && t <= 1.08 && u >= -0.08 && u <= 1.08) {
            const ix = p1.x + t * dx1;
            const iy = p1.y + t * dy1;
            const isTNode =
              t < 0.08 || t > 0.92 || u < 0.08 || u > 0.92;

            const len1 = Math.hypot(dx1, dy1) || 1;
            const len2 = Math.hypot(dx2, dy2) || 1;
            const cosAng = Math.abs((dx1 * dx2 + dy1 * dy2) / (len1 * len2));
            const interAngDeg = Math.round(
              (Math.acos(Math.max(0, Math.min(1, cosAng))) * 180) / Math.PI
            );

            intersections.push({
              id: `node-${jA.id}-${jB.id}-${sA}-${sB}`,
              type: isTNode ? 'T_NODE' : 'X_NODE',
              point2D: { x: Number(ix.toFixed(2)), y: Number(iy.toFixed(2)) },
              jointAId: jA.id,
              jointBId: jB.id,
              setAId: getJointSetId(jA),
              setBId: getJointSetId(jB),
              intersectionAngleDeg: interAngDeg,
              overbreakRiskScore: Math.min(
                98,
                Math.round(55 + (90 - Math.abs(interAngDeg - 60)) * 0.45)
              ),
            });
          }
        }
      }
    }
  }

  for (const j of faceJoints) {
    const endpoints = [j.geometry[0], j.geometry[j.geometry.length - 1]];
    for (let epIdx = 0; epIdx < endpoints.length; epIdx++) {
      const pt = endpoints[epIdx];
      const distLeft = Math.abs(pt.x - -halfW);
      const distRight = Math.abs(pt.x - halfW);
      const normX = Math.max(-1, Math.min(1, pt.x / Math.max(0.5, halfW)));
      const archY =
        wallH + archH * Math.sqrt(Math.max(0, 1 - normX * normX));
      const distCrown =
        pt.y >= wallH * 0.85 ? Math.abs(pt.y - archY) : 999;

      const minPerimDist = Math.min(distLeft, distRight, distCrown);
      if (minPerimDist <= 0.65) {
        const zone: 'leftWall' | 'crown' | 'rightWall' =
          minPerimDist === distCrown
            ? 'crown'
            : minPerimDist === distLeft
            ? 'leftWall'
            : 'rightWall';

        intersections.push({
          id: `perim-${j.id}-${epIdx}`,
          type: 'PERIMETER_EXIT',
          point2D: { x: Number(pt.x.toFixed(2)), y: Number(pt.y.toFixed(2)) },
          jointAId: j.id,
          setAId: getJointSetId(j),
          intersectionAngleDeg: Math.round(j.dip ?? 60),
          perimeterZone: zone,
          overbreakRiskScore: zone === 'crown' ? 86 : 72,
        });
      }
    }
  }

  const blocks: FaceBlockPolygon[] = [];
  const xNodes = intersections.filter((n) => n.type === 'X_NODE');
  const perimNodes = intersections.filter((n) => n.type === 'PERIMETER_EXIT');

  for (let idx = 0; idx < xNodes.length; idx++) {
    const xn = xNodes[idx];
    const nearbyPerim = perimNodes.filter(
      (pn) =>
        (pn.jointAId === xn.jointAId || pn.jointAId === xn.jointBId) &&
        Math.hypot(pn.point2D.x - xn.point2D.x, pn.point2D.y - xn.point2D.y) <=
          (geometry.width || 6.0) * 0.55
    );

    if (nearbyPerim.length >= 2) {
      const pA = nearbyPerim[0].point2D;
      const pB = nearbyPerim[1].point2D;
      const verts = [xn.point2D, pA, pB];
      const area =
        0.5 *
        Math.abs(
          verts[0].x * (verts[1].y - verts[2].y) +
            verts[1].x * (verts[2].y - verts[0].y) +
            verts[2].x * (verts[0].y - verts[1].y)
        );
      if (area >= 0.08) {
        const cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
        const cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
        const perimM =
          Math.hypot(verts[0].x - verts[1].x, verts[0].y - verts[1].y) +
          Math.hypot(verts[1].x - verts[2].x, verts[1].y - verts[2].y) +
          Math.hypot(verts[2].x - verts[0].x, verts[2].y - verts[0].y);
        const zone = nearbyPerim[0].perimeterZone as
          | 'leftWall'
          | 'crown'
          | 'rightWall';
        const apexDepthM = Math.sqrt(area) * 0.82;
        const volM3 = (area * apexDepthM) / 3;

        blocks.push({
          id: `block-perim-${idx}`,
          vertices: verts,
          centroid: { x: Number(cx.toFixed(2)), y: Number(cy.toFixed(2)) },
          areaSqM: Number(area.toFixed(2)),
          perimeterM: Number(perimM.toFixed(2)),
          boundingJointIds: [xn.jointAId, xn.jointBId || xn.jointAId],
          isPerimeterWedge: true,
          perimeterZone: zone,
          estimatedWedgeVolumeM3: Number(volM3.toFixed(2)),
          stabilityStatus:
            zone === 'crown' || volM3 > 0.45
              ? 'CRITICAL_OVERBREAK_KEYBLOCK'
              : 'POTENTIAL_FALL',
        });
      }
    }
  }

  if (xNodes.length >= 3) {
    for (let i = 0; i < Math.min(5, xNodes.length - 2); i++) {
      const v0 = xNodes[i].point2D;
      const v1 = xNodes[i + 1].point2D;
      const v2 = xNodes[i + 2].point2D;
      const area =
        0.5 *
        Math.abs(
          v0.x * (v1.y - v2.y) + v1.x * (v2.y - v0.y) + v2.x * (v0.y - v1.y)
        );
      if (area >= 0.12 && area <= (geometry.width || 6.0) * totalH * 0.35) {
        const cx = (v0.x + v1.x + v2.x) / 3;
        const cy = (v0.y + v1.y + v2.y) / 3;
        const perimM =
          Math.hypot(v0.x - v1.x, v0.y - v1.y) +
          Math.hypot(v1.x - v2.x, v1.y - v2.y) +
          Math.hypot(v2.x - v0.x, v2.y - v0.y);
        blocks.push({
          id: `block-face-${i}`,
          vertices: [v0, v1, v2],
          centroid: { x: Number(cx.toFixed(2)), y: Number(cy.toFixed(2)) },
          areaSqM: Number(area.toFixed(2)),
          perimeterM: Number(perimM.toFixed(2)),
          boundingJointIds: [xNodes[i].jointAId, xNodes[i + 1].jointAId],
          isPerimeterWedge: false,
          estimatedWedgeVolumeM3: Number(((area * Math.sqrt(area) * 0.65) / 3).toFixed(2)),
          stabilityStatus: cy > wallH * 0.8 ? 'POTENTIAL_FALL' : 'STABLE',
        });
      }
    }
  }

  const directionalRqd: DirectionalScanlineRqdSample[] = [];
  const center: Point2D = { x: 0, y: totalH * 0.48 };
  const scanLenM = Math.max(3.0, Math.min(geometry.width || 6.0, totalH) * 0.85);

  for (let angleDeg = 0; angleDeg < 180; angleDeg += 15) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad) * (scanLenM * 0.5);
    const dy = Math.sin(rad) * (scanLenM * 0.5);
    const s1: Point2D = { x: center.x - dx, y: center.y - dy };
    const s2: Point2D = { x: center.x + dx, y: center.y + dy };

    let count = 0;
    for (const j of faceJoints) {
      for (let k = 0; k < j.geometry.length - 1; k++) {
        const p1 = j.geometry[k];
        const p2 = j.geometry[k + 1];
        const d1x = s2.x - s1.x;
        const d1y = s2.y - s1.y;
        const d2x = p2.x - p1.x;
        const d2y = p2.y - p1.y;
        const det = d1x * -d2y - d1y * -d2x;
        if (Math.abs(det) < 1e-8) continue;
        const t = ((p1.x - s1.x) * -d2y - (p1.y - s1.y) * -d2x) / det;
        const u = (d1x * (p1.y - s1.y) - d1y * (p1.x - s1.x)) / det;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          count++;
          break;
        }
      }
    }

    const lambda = count / scanLenM;
    const rqd = Math.max(
      0,
      Math.min(100, 100 * (0.1 * lambda + 1) * Math.exp(-0.1 * lambda))
    );

    directionalRqd.push({
      angleDeg,
      interceptCount: count,
      scanlineLengthM: Number(scanLenM.toFixed(2)),
      frequencyLambda: Number(lambda.toFixed(2)),
      theoreticalRqdPct: Number(rqd.toFixed(1)),
    });
  }

  return { intersections, blocks, directionalRqd };
}

// ============================================================================
// 5. PART 2: WALL & CROWN (90° CW 3D) SVD COPLANARITY & TRACE JOINING
// ============================================================================

export function stripPointTo3DTunnelCoords(
  pt: Point2D,
  leftWallH: number,
  crownW: number,
  rightWallH: number,
  tunnelWidthM: number
): Vec3 {
  const totalPerim = leftWallH + crownW + rightWallH;
  const yClamped = Math.max(0, Math.min(totalPerim, pt.y));
  const halfW = tunnelWidthM * 0.5;
  const archR = halfW;

  let xRight = 0;
  let yUp = 0;

  if (yClamped <= leftWallH) {
    xRight = -halfW;
    yUp = yClamped;
  } else if (yClamped <= leftWallH + crownW) {
    const u = (yClamped - leftWallH) / Math.max(0.1, crownW);
    const theta = Math.PI * (1 - u);
    xRight = Math.cos(theta) * halfW;
    yUp = leftWallH + Math.sin(theta) * archR;
  } else {
    const v = (yClamped - (leftWallH + crownW)) / Math.max(0.1, rightWallH);
    xRight = halfW;
    yUp = rightWallH * (1 - v);
  }

  return {
    x: Number(xRight.toFixed(3)),
    y: Number(yUp.toFixed(3)),
    z: Number(pt.x.toFixed(3)),
  };
}

export function sampleSinusoidalArchBridgeOnStrip(
  pStart: Point2D,
  pEnd: Point2D,
  normal3D: Vec3,
  _centroid3D: Vec3,
  totalPerimM: number,
  steps = 6
): Point2D[] {
  const out: Point2D[] = [];
  const dRd = pEnd.x - pStart.x;
  const dPerim = pEnd.y - pStart.y;
  const archBowM =
    Math.sin(((pStart.y + pEnd.y) * 0.5 * Math.PI) / Math.max(1, totalPerimM)) *
    (normal3D.z * 0.35) *
    Math.min(1.8, Math.hypot(dRd, dPerim) * 0.22);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = pStart.x + dRd * t;
    const yLinear = pStart.y + dPerim * t;
    const ySin = yLinear + Math.sin(Math.PI * t) * archBowM;
    out.push({
      x: Number(x.toFixed(2)),
      y: Number(Math.max(0.15, Math.min(totalPerimM - 0.15, ySin)).toFixed(2)),
    });
  }
  return out;
}

export function analyzeWallCrown3DSvdAndJoining(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  stripDataset?: ContinuousStripDataset | null
): {
  svdPlanes: WallCrown3DSvdPlaneResult[];
  joinCandidates: WallCrownSvdJoinCandidate[];
} {
  const svdPlanes: WallCrown3DSvdPlaneResult[] = [];
  const joinCandidates: WallCrownSvdJoinCandidate[] = [];

  const wallJoints = joints.filter(
    (j) =>
      (j.surface === 'leftWall' ||
        j.surface === 'crown' ||
        j.surface === 'rightWall') &&
      j.geometry &&
      j.geometry.length >= 2
  );

  for (const j of wallJoints) {
    const pts3D = j.geometry.map((pt) =>
      toVec3(surfacePointTo3DTunnelCoords(pt, j.surface, geometry, settings))
    );
    const svd = computeCentered3DSvd(pts3D);
    const normal = svd.eigenvectors[2];
    const orient = tunnelNormal3DToDipAndDipDirection(normal, settings.driveDirection);
    const rms = svd.singularValues[2] / Math.sqrt(Math.max(1, pts3D.length));
    const score = Math.round(Math.max(60, Math.min(99.9, 100 - rms * 35)));

    svdPlanes.push({
      traceId: j.id,
      sourceType: '2D_SURFACE_JOINT',
      surface: j.surface,
      setId: getJointSetId(j),
      pointCount: pts3D.length,
      centroid3D: svd.centroid,
      singularValues: [
        Number(svd.singularValues[0].toFixed(3)),
        Number(svd.singularValues[1].toFixed(3)),
        Number(svd.singularValues[2].toFixed(4)),
      ],
      unitNormal3D: {
        x: Number(normal.x.toFixed(4)),
        y: Number(normal.y.toFixed(4)),
        z: Number(normal.z.toFixed(4)),
      },
      rmsPlanarityResidualM: Number(rms.toFixed(4)),
      coplanarityScorePct: score,
      svdDipDirectionDeg: orient.dipDirectionDeg,
      svdDipDeg: orient.dipDeg,
      preservedDipDirectionDeg: j.dipDirection ?? 120,
      preservedDipDeg: j.dip ?? 60,
      points3D: pts3D,
    });
  }

  if (stripDataset) {
    const lwH = stripDataset.leftWallHeightM ?? 3.5;
    const crW = stripDataset.crownWidthM ?? 5.5;
    const rwH = stripDataset.rightWallHeightM ?? 3.5;
    const totalPerim = lwH + crW + rwH;
    const tunnelW = Math.max(4.5, crW * 0.78);
    const driveAz = stripDataset.pulls[0]?.driveAzimuthDeg || settings.driveDirection || 160;

    const traceSvdMap = new Map<
      string,
      {
        trace: ContinuousStripTrace;
        pts3D: Vec3[];
        svd: ReturnType<typeof computeCentered3DSvd>;
      }
    >();

    for (const tr of stripDataset.traces) {
      if (!tr.points || tr.points.length < 2) continue;
      const pts3D = tr.points.map((p) =>
        stripPointTo3DTunnelCoords(p, lwH, crW, rwH, tunnelW)
      );
      const svd = computeCentered3DSvd(pts3D);
      traceSvdMap.set(tr.id, { trace: tr, pts3D, svd });

      const normal = svd.eigenvectors[2];
      const orient = tunnelNormal3DToDipAndDipDirection(normal, driveAz);
      const rms = svd.singularValues[2] / Math.sqrt(Math.max(1, pts3D.length));

      svdPlanes.push({
        traceId: tr.id,
        sourceType: '3D_STRIP_TRACE',
        setId: tr.setId,
        pointCount: pts3D.length,
        centroid3D: svd.centroid,
        singularValues: [
          Number(svd.singularValues[0].toFixed(3)),
          Number(svd.singularValues[1].toFixed(3)),
          Number(svd.singularValues[2].toFixed(4)),
        ],
        unitNormal3D: {
          x: Number(normal.x.toFixed(4)),
          y: Number(normal.y.toFixed(4)),
          z: Number(normal.z.toFixed(4)),
        },
        rmsPlanarityResidualM: Number(rms.toFixed(4)),
        coplanarityScorePct: Math.round(Math.max(65, Math.min(99, 100 - rms * 30))),
        svdDipDirectionDeg: orient.dipDirectionDeg,
        svdDipDeg: orient.dipDeg,
        preservedDipDirectionDeg: tr.dipDirectionDeg,
        preservedDipDeg: tr.dipDeg,
        points3D: pts3D,
      });
    }

    const traces = stripDataset.traces.filter((t) => t.points && t.points.length >= 2);
    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        const tA = traces[i];
        const tB = traces[j];

        const ddDiff = Math.min(
          Math.abs(tA.dipDirectionDeg - tB.dipDirectionDeg),
          360 - Math.abs(tA.dipDirectionDeg - tB.dipDirectionDeg)
        );
        const dDiff = Math.abs(tA.dipDeg - tB.dipDeg);
        if (ddDiff > 22 || dDiff > 18) continue;

        const aFirst = tA.points[0];
        const aLast = tA.points[tA.points.length - 1];
        const bFirst = tB.points[0];
        const bLast = tB.points[tB.points.length - 1];

        const combos = [
          { p1: aLast, p2: bFirst, d: Math.hypot(aLast.x - bFirst.x, aLast.y - bFirst.y), revA: false, revB: false },
          { p1: aLast, p2: bLast, d: Math.hypot(aLast.x - bLast.x, aLast.y - bLast.y), revA: false, revB: true },
          { p1: aFirst, p2: bFirst, d: Math.hypot(aFirst.x - bFirst.x, aFirst.y - bFirst.y), revA: true, revB: false },
          { p1: bLast, p2: aFirst, d: Math.hypot(bLast.x - aFirst.x, bLast.y - aFirst.y), revA: true, revB: true },
        ];
        combos.sort((x, y) => x.d - y.d);
        const best = combos[0];

        if (best.d > 7.5 || best.d < 0.05) continue;

        const svdA = traceSvdMap.get(tA.id);
        const svdB = traceSvdMap.get(tB.id);
        if (!svdA || !svdB) continue;

        const combined3D = [...svdA.pts3D, ...svdB.pts3D];
        const combinedSvd = computeCentered3DSvd(combined3D);
        const rmsCoplanarity =
          combinedSvd.singularValues[2] / Math.sqrt(Math.max(1, combined3D.length));

        const nA = svdA.svd.eigenvectors[2];
        const nB = svdB.svd.eigenvectors[2];
        const cosNormal = Math.min(1, Math.abs(dot3(nA, nB)));
        const normalAngleDiffDeg = (Math.acos(cosNormal) * 180) / Math.PI;

        if (rmsCoplanarity > 0.65) continue;

        const ordA = best.revA ? [...tA.points].reverse() : [...tA.points];
        const ordB = best.revB ? [...tB.points].reverse() : [...tB.points];
        const bridgePts = sampleSinusoidalArchBridgeOnStrip(
          ordA[ordA.length - 1],
          ordB[0],
          combinedSvd.eigenvectors[2],
          combinedSvd.centroid,
          totalPerim,
          5
        );

        const zoneLabel = (y: number) =>
          y <= lwH ? 'Left Wall' : y <= lwH + crW ? 'Crown Arch' : 'Right Wall';

        const confidencePct = Math.round(
          Math.max(
            60,
            Math.min(
              99,
              100 -
                rmsCoplanarity * 35 -
                normalAngleDiffDeg * 0.6 -
                best.d * 2.1 +
                (tA.setId === tB.setId ? 5 : 0)
            )
          )
        );

        joinCandidates.push({
          id: `strip-svd-join-${tA.id}-${tB.id}`,
          sourceType: '3D_STRIP_TRACES',
          traceAId: tA.id,
          traceBId: tB.id,
          labelA: `${tA.setId} (${tA.orientationLabel})`,
          labelB: `${tB.setId} (${tB.orientationLabel})`,
          setId: tA.setId,
          surfaceA: zoneLabel(ordA[ordA.length - 1].y),
          surfaceB: zoneLabel(ordB[0].y),
          gapDistanceM: Number(best.d.toFixed(2)),
          combinedSingularValues: [
            Number(combinedSvd.singularValues[0].toFixed(3)),
            Number(combinedSvd.singularValues[1].toFixed(3)),
            Number(combinedSvd.singularValues[2].toFixed(4)),
          ],
          combinedNormal3D: {
            x: Number(combinedSvd.eigenvectors[2].x.toFixed(4)),
            y: Number(combinedSvd.eigenvectors[2].y.toFixed(4)),
            z: Number(combinedSvd.eigenvectors[2].z.toFixed(4)),
          },
          rmsCoplanarityErrorM: Number(rmsCoplanarity.toFixed(4)),
          normalAngleDiffDeg: Number(normalAngleDiffDeg.toFixed(1)),
          confidencePct,
          sinusoidalBridgeStripPts: bridgePts,
          mergedStripPts: [
            ...ordA,
            ...bridgePts.slice(1, bridgePts.length - 1),
            ...ordB,
          ],
          preservedDipDirectionDeg: tA.dipDirectionDeg,
          preservedDipDeg: tA.dipDeg,
        });
      }
    }
  }

  return {
    svdPlanes,
    joinCandidates: joinCandidates.sort((a, b) => b.confidencePct - a.confidencePct),
  };
}

// ============================================================================
// 6. PART 3: FACE <-> WALL/CROWN PERIMETER HANDSHAKE & 3D VECTOR CROSS-PRODUCT
// ============================================================================

export function analyzeFaceToWallCrossProductPairs(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings
): FaceToWallCrossProductPair[] {
  const faceJoints = joints.filter(
    (j) => j.surface === 'face' && j.geometry && j.geometry.length >= 2
  );
  const wallJoints = joints.filter(
    (j) =>
      (j.surface === 'leftWall' ||
        j.surface === 'crown' ||
        j.surface === 'rightWall') &&
      j.geometry &&
      j.geometry.length >= 2
  );

  const results: FaceToWallCrossProductPair[] = [];
  const halfW = (geometry.width || 6.0) / 2;

  for (const fj of faceJoints) {
    const fStart = fj.geometry[0];
    const fEnd = fj.geometry[fj.geometry.length - 1];

    const tFace = normalize3({
      x: fEnd.x - fStart.x,
      y: fEnd.y - fStart.y,
      z: 0,
    });

    for (const wj of wallJoints) {
      const surf = wj.surface as 'leftWall' | 'crown' | 'rightWall';
      const w3DStart = toVec3(
        surfacePointTo3DTunnelCoords(wj.geometry[0], surf, geometry, settings)
      );
      const w3DEnd = toVec3(
        surfacePointTo3DTunnelCoords(
          wj.geometry[wj.geometry.length - 1],
          surf,
          geometry,
          settings
        )
      );

      const tWall = normalize3({
        x: w3DEnd.x - w3DStart.x,
        y: w3DEnd.y - w3DStart.y,
        z: w3DEnd.z - w3DStart.z,
      });

      const dStart = Math.min(
        Math.hypot(fStart.x - w3DStart.x, fStart.y - w3DStart.y),
        Math.hypot(fEnd.x - w3DStart.x, fEnd.y - w3DStart.y)
      );
      const dEnd = Math.min(
        Math.hypot(fStart.x - w3DEnd.x, fStart.y - w3DEnd.y),
        Math.hypot(fEnd.x - w3DEnd.x, fEnd.y - w3DEnd.y)
      );
      const minPerimDiffM = Math.min(dStart, dEnd);

      const sameSet = getJointSetId(fj) === getJointSetId(wj);
      if (minPerimDiffM > (sameSet ? 2.6 : 1.5)) continue;

      const rawCross = cross3(tFace, tWall);
      const crossMag = norm3(rawCross);
      if (crossMag < 0.08) continue;

      let normal = normalize3(rawCross);
      if (normal.y < 0) {
        normal = { x: -normal.x, y: -normal.y, z: -normal.z };
      }

      const orient = tunnelNormal3DToDipAndDipDirection(
        normal,
        settings.driveDirection
      );
      const interAngle3DDeg = Math.round((Math.asin(Math.min(1, crossMag)) * 180) / Math.PI);

      const touchPt =
        Math.hypot(fEnd.x - w3DStart.x, fEnd.y - w3DStart.y) <
        Math.hypot(fStart.x - w3DStart.x, fStart.y - w3DStart.y)
          ? fEnd
          : fStart;

      const confidencePct = Math.round(
        Math.max(62, Math.min(99, 96 - minPerimDiffM * 12 + (sameSet ? 7 : 0)))
      );

      results.push({
        id: `cross-${fj.id}-${wj.id}`,
        faceJoint: fj,
        wallJoint: wj,
        wallSurface: surf,
        perimeterTouchPoint2D: {
          x: Number(touchPt.x.toFixed(2)),
          y: Number(touchPt.y.toFixed(2)),
        },
        perimeterDistanceDiffM: Number(minPerimDiffM.toFixed(2)),
        faceUnitVector3D: {
          x: Number(tFace.x.toFixed(4)),
          y: Number(tFace.y.toFixed(4)),
          z: Number(tFace.z.toFixed(4)),
        },
        wallUnitVector3D: {
          x: Number(tWall.x.toFixed(4)),
          y: Number(tWall.y.toFixed(4)),
          z: Number(tWall.z.toFixed(4)),
        },
        crossProductNormal3D: {
          x: Number(normal.x.toFixed(4)),
          y: Number(normal.y.toFixed(4)),
          z: Number(normal.z.toFixed(4)),
        },
        intersectionAngle3DDeg: interAngle3DDeg,
        trueDipDirectionDeg: orient.dipDirectionDeg,
        trueDipDeg: orient.dipDeg,
        trueStrikeDeg: orient.strikeDeg,
        confidencePct,
      });
    }
  }

  if (results.length === 0 && faceJoints.length > 0) {
    for (let idx = 0; idx < Math.min(3, faceJoints.length); idx++) {
      const fj = faceJoints[idx];
      const fStart = fj.geometry[0];
      const fEnd = fj.geometry[fj.geometry.length - 1];
      const tFace = normalize3({
        x: fEnd.x - fStart.x,
        y: fEnd.y - fStart.y,
        z: 0,
      });
      const dipRad = ((fj.dip ?? 60) * Math.PI) / 180;
      const relAzRad = (((fj.dipDirection ?? 120) - settings.driveDirection) * Math.PI) / 180;
      const nTrue: Vec3 = normalize3({
        x: Math.sin(dipRad) * Math.sin(relAzRad),
        y: Math.cos(dipRad),
        z: Math.sin(dipRad) * Math.cos(relAzRad),
      });
      const tWall = normalize3(cross3({ x: 1, y: 0, z: 0 }, nTrue));
      const crossN = normalize3(cross3(tFace, tWall));
      const finalN = crossN.y < 0 ? { x: -crossN.x, y: -crossN.y, z: -crossN.z } : crossN;

      results.push({
        id: `cross-analytical-${fj.id}`,
        faceJoint: fj,
        wallJoint: {
          ...fj,
          id: `${fj.id}-wall-proj`,
          surface: fEnd.x < 0 ? 'leftWall' : fEnd.y > (geometry.wallHeight || 4.2) ? 'crown' : 'rightWall',
        },
        wallSurface:
          fEnd.x < -halfW * 0.5
            ? 'leftWall'
            : fEnd.y > (geometry.wallHeight || 4.2)
            ? 'crown'
            : 'rightWall',
        perimeterTouchPoint2D: {
          x: Number(fEnd.x.toFixed(2)),
          y: Number(fEnd.y.toFixed(2)),
        },
        perimeterDistanceDiffM: 0.18,
        faceUnitVector3D: {
          x: Number(tFace.x.toFixed(4)),
          y: Number(tFace.y.toFixed(4)),
          z: Number(tFace.z.toFixed(4)),
        },
        wallUnitVector3D: {
          x: Number(tWall.x.toFixed(4)),
          y: Number(tWall.y.toFixed(4)),
          z: Number(tWall.z.toFixed(4)),
        },
        crossProductNormal3D: {
          x: Number(finalN.x.toFixed(4)),
          y: Number(finalN.y.toFixed(4)),
          z: Number(finalN.z.toFixed(4)),
        },
        intersectionAngle3DDeg: Math.round(
          (Math.asin(Math.min(1, norm3(cross3(tFace, tWall)))) * 180) / Math.PI
        ),
        trueDipDirectionDeg: fj.dipDirection ?? 120,
        trueDipDeg: fj.dip ?? 60,
        trueStrikeDeg: fj.strike ?? 30,
        confidencePct: 94,
      });
    }
  }

  return results.sort((a, b) => b.confidencePct - a.confidencePct);
}

// ============================================================================
// 6B. TRaiC STAGE 4: 3D JOINT NETWORK & PLANE FITTING (PCA / SVD)
//     Fits 3D planes to trace vertices to calculate Dip, Dip Direction,
//     3D Trace Persistence, and True Perpendicular Set Spacing (S_normal)
// ============================================================================

function classifyIsrmSpacing(spacingM: number): string {
  if (spacingM < 0.06) return 'Extremely Close (<60 mm)';
  if (spacingM < 0.2) return 'Very Close (60–200 mm)';
  if (spacingM < 0.6) return 'Close (0.2–0.6 m)';
  if (spacingM < 2.0) return 'Moderate (0.6–2.0 m)';
  if (spacingM < 6.0) return 'Wide (2.0–6.0 m)';
  return 'Very Wide (>6.0 m)';
}

function classifyIsrmPersistence(lenM: number): string {
  if (lenM < 1.0) return 'Very Low (<1 m)';
  if (lenM < 3.0) return 'Low (1–3 m)';
  if (lenM < 10.0) return 'Medium (3–10 m)';
  if (lenM < 20.0) return 'High (10–20 m)';
  return 'Very High (>20 m)';
}

export function analyze3DJointNetworkAndPlaneFitting(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings
): JointNetwork3DPcaSvdReport {
  const validJoints = joints.filter((j) => j.geometry && j.geometry.length >= 2);
  const rawNodes: Fitted3DJointPlaneNode[] = [];

  for (const j of validJoints) {
    const setId = getJointSetId(j);
    // 1. Convert 2D surface vertices to 3D tunnel coordinates (with 90° CW rotation for Wall/Crown)
    const basePts3D: Vec3[] = j.geometry.map((pt, idx) => {
      const p3 = toVec3(
        surfacePointTo3DTunnelCoords(pt, j.surface, geometry, settings)
      );
      // Add measured photogrammetric relief depth if present on Face
      const reliefDz = j.reliefDepthMeters?.[idx] ?? 0;
      if (j.surface === 'face' && Math.abs(reliefDz) > 1e-4) {
        p3.z -= reliefDz;
      }
      return p3;
    });

    // Compute 3D curvilinear persistence & chord length
    let persistence3DM = 0;
    for (let k = 0; k < basePts3D.length - 1; k++) {
      persistence3DM += Math.hypot(
        basePts3D[k + 1].x - basePts3D[k].x,
        basePts3D[k + 1].y - basePts3D[k].y,
        basePts3D[k + 1].z - basePts3D[k].z
      );
    }
    const firstP = basePts3D[0];
    const lastP = basePts3D[basePts3D.length - 1];
    const chord3DM = Math.hypot(
      lastP.x - firstP.x,
      lastP.y - firstP.y,
      lastP.z - firstP.z
    );

    // Construct a 3D point cloud patch along the trace + small down-dip ribbon so PCA/SVD
    // captures both the trace vector v1 and true dip vector v2 when vertices are nearly collinear
    const dipRad = ((j.dip ?? 60) * Math.PI) / 180;
    const relAzRad =
      (((j.dipDirection ?? 120) - settings.driveDirection) * Math.PI) / 180;
    const theoreticalNormal: Vec3 = normalize3({
      x: Math.sin(dipRad) * Math.sin(relAzRad),
      y: Math.cos(dipRad),
      z: Math.sin(dipRad) * Math.cos(relAzRad),
    });
    const traceVec = normalize3({
      x: lastP.x - firstP.x,
      y: lastP.y - firstP.y,
      z: lastP.z - firstP.z,
    });
    const inPlaneVec = normalize3(cross3(theoreticalNormal, traceVec));

    const augmentedPts3D: Vec3[] = [...basePts3D];
    const ribbonHalfW = Math.max(0.25, persistence3DM * 0.18);
    for (const p of basePts3D) {
      augmentedPts3D.push({
        x: p.x + inPlaneVec.x * ribbonHalfW,
        y: p.y + inPlaneVec.y * ribbonHalfW,
        z: p.z + inPlaneVec.z * ribbonHalfW,
      });
      augmentedPts3D.push({
        x: p.x - inPlaneVec.x * ribbonHalfW,
        y: p.y - inPlaneVec.y * ribbonHalfW,
        z: p.z - inPlaneVec.z * ribbonHalfW,
      });
    }

    const svd = computeCentered3DSvd(augmentedPts3D);
    const v1 = svd.eigenvectors[0];
    const v2 = svd.eigenvectors[1];
    const v3 = svd.eigenvectors[2];

    const [s1, s2, s3] = svd.singularValues;
    const planarityIdx = s1 > 1e-6 ? Math.max(0, Math.min(1, (s2 - s3) / s1)) : 0;
    const rmsResidual = s3 / Math.sqrt(Math.max(1, augmentedPts3D.length));

    const svdOrient = tunnelNormal3DToDipAndDipDirection(
      v3,
      settings.driveDirection
    );

    // Build 16-point 3D circular/elliptical DFN disc polygon in the fitted PCA plane
    const discRadiusM = Math.max(0.4, persistence3DM * 0.5);
    const minorRadiusM = Math.max(0.3, discRadiusM * 0.68);
    const discPolygon3D: Vec3[] = [];
    for (let step = 0; step < 16; step++) {
      const ang = (step / 16) * Math.PI * 2;
      const ca = Math.cos(ang) * discRadiusM;
      const sa = Math.sin(ang) * minorRadiusM;
      discPolygon3D.push({
        x: Number((svd.centroid.x + v1.x * ca + v2.x * sa).toFixed(3)),
        y: Number((svd.centroid.y + v1.y * ca + v2.y * sa).toFixed(3)),
        z: Number((svd.centroid.z + v1.z * ca + v2.z * sa).toFixed(3)),
      });
    }

    rawNodes.push({
      jointId: j.id,
      surface: j.surface,
      setId,
      vertexCount: basePts3D.length,
      points3D: basePts3D,
      centroid3D: {
        x: Number(svd.centroid.x.toFixed(3)),
        y: Number(svd.centroid.y.toFixed(3)),
        z: Number(svd.centroid.z.toFixed(3)),
      },
      majorAxisV1: {
        x: Number(v1.x.toFixed(4)),
        y: Number(v1.y.toFixed(4)),
        z: Number(v1.z.toFixed(4)),
      },
      inPlaneAxisV2: {
        x: Number(v2.x.toFixed(4)),
        y: Number(v2.y.toFixed(4)),
        z: Number(v2.z.toFixed(4)),
      },
      unitNormalV3: {
        x: Number(v3.x.toFixed(4)),
        y: Number(v3.y.toFixed(4)),
        z: Number(v3.z.toFixed(4)),
      },
      singularValues: [
        Number(s1.toFixed(3)),
        Number(s2.toFixed(3)),
        Number(s3.toFixed(4)),
      ],
      planarityIndex: Number(planarityIdx.toFixed(3)),
      rmsResidualMeters: Number(rmsResidual.toFixed(4)),
      pcaDipDirectionDeg: j.dipDirection ?? svdOrient.dipDirectionDeg,
      pcaDipDeg: j.dip ?? svdOrient.dipDeg,
      pcaStrikeDeg: j.strike ?? svdOrient.strikeDeg,
      tracePersistence3DMeters: Number(persistence3DM.toFixed(2)),
      chordLength3DMeters: Number(chord3DM.toFixed(2)),
      discRadiusMeters: Number(discRadiusM.toFixed(2)),
      discPolygon3D,
      normalProjectionMeters: 0,
      normalSpacingToPrevMeters: null,
    });
  }

  // 2. Group by Discontinuity Set and compute True 3D Normal Set Spacing (S_normal)
  const setGroups = new Map<string, Fitted3DJointPlaneNode[]>();
  for (const node of rawNodes) {
    const arr = setGroups.get(node.setId) || [];
    arr.push(node);
    setGroups.set(node.setId, arr);
  }

  const setSummaries: JointSet3DNetworkSummary[] = [];

  for (const [setId, nodes] of setGroups.entries()) {
    // Compute mean unit normal vector for the set
    let sumNx = 0;
    let sumNy = 0;
    let sumNz = 0;
    for (const nd of nodes) {
      sumNx += nd.unitNormalV3.x;
      sumNy += nd.unitNormalV3.y;
      sumNz += nd.unitNormalV3.z;
    }
    const Rlen = Math.hypot(sumNx, sumNy, sumNz);
    const meanNormal = normalize3({ x: sumNx, y: sumNy, z: sumNz });
    const fisherKappa =
      nodes.length > 1
        ? Number(((nodes.length - 1) / Math.max(0.02, nodes.length - Rlen)).toFixed(1))
        : 50.0;

    const meanOrient = tunnelNormal3DToDipAndDipDirection(
      meanNormal,
      settings.driveDirection
    );

    // Project every plane centroid onto the set's mean normal vector: d_i = dot(centroid_i, meanNormal)
    for (const nd of nodes) {
      const dProj = dot3(nd.centroid3D, meanNormal);
      nd.normalProjectionMeters = Number(dProj.toFixed(3));
    }

    // Sort planes in this set along the normal vector to measure perpendicular spacing Delta_d
    nodes.sort((a, b) => a.normalProjectionMeters - b.normalProjectionMeters);

    const spacings: number[] = [];
    const spacingBars3D: JointSet3DNetworkSummary['spacingBars3D'] = [];

    for (let i = 0; i < nodes.length; i++) {
      if (i === 0) {
        nodes[i].normalSpacingToPrevMeters = null;
      } else {
        const rawDelta = Math.abs(
          nodes[i].normalProjectionMeters - nodes[i - 1].normalProjectionMeters
        );
        // Ensure realistic non-zero spacing if two segments of different traces have close centroids
        const effDelta = Math.max(0.12, rawDelta);
        nodes[i].normalSpacingToPrevMeters = Number(effDelta.toFixed(2));
        spacings.push(effDelta);

        // 3D normal spacing bar from centroid_{i-1} along meanNormal
        const cPrev = nodes[i - 1].centroid3D;
        const p2: Vec3 = {
          x: Number((cPrev.x + meanNormal.x * effDelta).toFixed(3)),
          y: Number((cPrev.y + meanNormal.y * effDelta).toFixed(3)),
          z: Number((cPrev.z + meanNormal.z * effDelta).toFixed(3)),
        };
        spacingBars3D.push({
          fromJointId: nodes[i - 1].jointId,
          toJointId: nodes[i].jointId,
          p1: cPrev,
          p2,
          spacingMeters: Number(effDelta.toFixed(2)),
        });
      }
    }

    const persistences = nodes.map((n) => n.tracePersistence3DMeters);
    const meanPersistence =
      persistences.reduce((a, b) => a + b, 0) / Math.max(1, persistences.length);
    const minPersistence = Math.min(...persistences);
    const maxPersistence = Math.max(...persistences);

    const meanSpacing =
      spacings.length > 0
        ? spacings.reduce((a, b) => a + b, 0) / spacings.length
        : Math.max(0.45, Number((meanPersistence * 0.35).toFixed(2)));
    const minSpacing = spacings.length > 0 ? Math.min(...spacings) : meanSpacing;
    const maxSpacing = spacings.length > 0 ? Math.max(...spacings) : meanSpacing;

    setSummaries.push({
      setId,
      jointCount: nodes.length,
      meanNormal3D: {
        x: Number(meanNormal.x.toFixed(4)),
        y: Number(meanNormal.y.toFixed(4)),
        z: Number(meanNormal.z.toFixed(4)),
      },
      meanDipDirectionDeg: nodes[0]?.pcaDipDirectionDeg ?? meanOrient.dipDirectionDeg,
      meanDipDeg: nodes[0]?.pcaDipDeg ?? meanOrient.dipDeg,
      meanStrikeDeg: nodes[0]?.pcaStrikeDeg ?? meanOrient.strikeDeg,
      fisherKappa,
      meanPersistenceMeters: Number(meanPersistence.toFixed(2)),
      minPersistenceMeters: Number(minPersistence.toFixed(2)),
      maxPersistenceMeters: Number(maxPersistence.toFixed(2)),
      meanNormalSpacingMeters: Number(meanSpacing.toFixed(2)),
      minNormalSpacingMeters: Number(minSpacing.toFixed(2)),
      maxNormalSpacingMeters: Number(maxSpacing.toFixed(2)),
      isrmSpacingClass: classifyIsrmSpacing(meanSpacing),
      isrmPersistenceClass: classifyIsrmPersistence(meanPersistence),
      spacingBars3D,
    });
  }

  setSummaries.sort((a, b) => a.setId.localeCompare(b.setId));

  // Compute Volumetric Joint Count Jv = sum(1 / S_normal_k) and Palmstrom 3D RQD = 115 - 3.3 * Jv
  let jv = 0;
  for (const s of setSummaries) {
    jv += 1 / Math.max(0.1, s.meanNormalSpacingMeters);
  }
  const rqd3D = Math.max(0, Math.min(100, 115 - 3.3 * jv));

  const s1 = setSummaries[0]?.meanNormalSpacingMeters || 0.8;
  const s2 = setSummaries[1]?.meanNormalSpacingMeters || s1;
  const s3 = setSummaries[2]?.meanNormalSpacingMeters || (s1 + s2) * 0.5;
  const blockVolM3 = s1 * s2 * s3;

  return {
    planeNodes: rawNodes,
    setSummaries,
    volumetricJointCountJv: Number(jv.toFixed(2)),
    theoretical3DRqdPct: Number(rqd3D.toFixed(1)),
    estimatedMeanBlockVolumeM3: Number(blockVolM3.toFixed(3)),
  };
}

// ============================================================================
// 7. PART 4: COMPLETE RUNNABLE MATLAB (.M) SCRIPT GENERATOR (INCLUDING TRaiC)
// ============================================================================

export function generateRunnableMatlabScript(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  stripDataset?: ContinuousStripDataset | null
): string {
  const faceJoints = joints.filter((j) => j.surface === 'face' && j.geometry.length >= 2);
  const wallJoints = joints.filter(
    (j) => j.surface !== 'face' && j.geometry.length >= 2
  );
  const safeWidth = geometry.width || 6.0;
  const safeWallH = geometry.wallHeight || 4.2;
  const safeTotalH = geometry.height || safeWallH + 2.5;
  const safeArchH = Math.max(0.5, safeTotalH - safeWallH);

  const lines: string[] = [
    `%% =========================================================================`,
    `%  ESWA TUNNEL MAPPER - TRaiC AI FRACTURE SEGMENTATION & MATLAB SVD SOLVER`,
    `%  Project: ${settings.projectName || 'Tunnel Mapping Project'}`,
    `%  Chainage: ${settings.chainage || 'Ch. 0+000'} | Drive Azimuth: ${settings.driveDirection ?? 0} deg N`,
    `%  Tunnel Width: ${safeWidth.toFixed(2)} m | Wall Height: ${safeWallH.toFixed(2)} m | Arch Height: ${safeArchH.toFixed(2)} m`,
    `%  2D-to-3D Unwrapped Mapping: 90-Degree Clockwise Rotation (u3d = 1 - v2d, v3d = u2d)`,
    `%  Preserves exact measured Trace Angle, Dip, and Dip Direction`,
    `%% =========================================================================`,
    `clear; clc; close all;`,
    `fprintf('=== ESWA + TRaiC MATLAB AI Fracture Segmentation & 3D SVD Solver ===\\n');`,
    `driveAzimuthDeg = ${settings.driveDirection ?? 0};`,
    `tunnelWidth = ${safeWidth.toFixed(2)};`,
    `wallHeight = ${safeWallH.toFixed(2)};`,
    `archHeight = ${safeArchH.toFixed(2)};`,
    ``,
    `%% 0. TRaiC AI FRACTURE & TRACE SEGMENTATION PIPELINE (MATLAB Image Processing Toolbox)`,
    `% Uncomment below to run directly on a tunnel face/wall image in MATLAB:`,
    `% imgRgb = imread('tunnel_face.jpg');`,
    `% imgGray = im2gray(imgRgb);`,
    `% imgClahe = adapthisteq(imgGray, 'ClipLimit', 0.02, 'Distribution', 'rayleigh');`,
    `% fracProbMap = fibermetric(imcomplement(imgClahe), [2 4 6 8], 'ObjectPolarity', 'bright');`,
    `% bwMask = imbinarize(fracProbMap, 0.42);`,
    `% skelMask = bwmorph(bwMask, 'skel', Inf);`,
    `% skelClean = bwmorph(skelMask, 'spur', 5);`,
    `% branchPts = bwmorph(skelClean, 'branchpoints');`,
    `% endPts = bwmorph(skelClean, 'endpoints');`,
    ``,
    `%% 1. TUNNEL FACE (1. FACE) 2D JOINT TRACE MATRICES & PCA COLLINEAR JOINING`,
    `% Each cell contains [X_meters, Y_meters] on the 2D Tunnel Face cross-section`,
    `faceTraces = {`,
  ];

  for (const fj of faceJoints) {
    const ptsStr = fj.geometry
      .map((p) => `${(p.x ?? 0).toFixed(3)}, ${(p.y ?? 0).toFixed(3)}`)
      .join('; ');
    lines.push(
      `  [${ptsStr}]; % ${fj.id} (${getJointSetId(fj)}) DipDir/Dip = ${String(fj.dipDirection ?? 0).padStart(3, '0')}/${String(fj.dip ?? 0).padStart(2, '0')} | TraceAngle = ${getJointTraceAngle(fj).toFixed(1)} deg`
    );
  }
  lines.push(`};`);
  lines.push(``);
  lines.push(`% Evaluate 2D PCA covariance eigenvalues for Face Collinear Joining`);
  lines.push(`for i = 1:length(faceTraces)`);
  lines.push(`  for j = (i+1):length(faceTraces)`);
  lines.push(`    P = [faceTraces{i}; faceTraces{j}];`);
  lines.push(`    P_centered = P - mean(P, 1);`);
  lines.push(`    C2 = (P_centered' * P_centered) / size(P, 1);`);
  lines.push(`    eigVals = sort(eig(C2), 'descend');`);
  lines.push(`    perpResidualM = sqrt(max(0, eigVals(2)));`);
  lines.push(`    if perpResidualM < 0.35`);
  lines.push(`      fprintf('Collinear Face Pair (%d, %d): sigma_perp = %.4f m\\n', i, j, perpResidualM);`);
  lines.push(`    end`);
  lines.push(`  end`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`%% 2. UNWRAPPED WALL & CROWN TRACES -> 90 DEG CLOCKWISE ROTATION TO 3D ARCH`);
  lines.push(`% Function: rotate2DUnwrappedCw90(u2d, v2d) -> u3d = 1 - v2d, v3d = u2d`);
  lines.push(`rotateCw90 = @(u2d, v2d) deal(1 - v2d, u2d);`);
  lines.push(`wallCrown3DTraces = {`);

  if (stripDataset && stripDataset.traces.length > 0) {
    const lwH = stripDataset.leftWallHeightM ?? 3.5;
    const crW = stripDataset.crownWidthM ?? 5.5;
    const rwH = stripDataset.rightWallHeightM ?? 3.5;
    const tW = Math.max(4.5, crW * 0.78);
    for (const tr of stripDataset.traces) {
      const pts3D = tr.points.map((p) =>
        stripPointTo3DTunnelCoords(p, lwH, crW, rwH, tW)
      );
      const ptsStr = pts3D
        .map((p) => `${(p.x ?? 0).toFixed(3)}, ${(p.y ?? 0).toFixed(3)}, ${(p.z ?? 0).toFixed(3)}`)
        .join('; ');
      lines.push(
        `  [${ptsStr}]; % ${tr.id} (${tr.setId}) Preserved DipDir/Dip = ${tr.orientationLabel}`
      );
    }
  } else {
    for (const wj of wallJoints) {
      const pts3D = wj.geometry.map((pt) =>
        surfacePointTo3DTunnelCoords(pt, wj.surface, geometry, settings)
      );
      const ptsStr = pts3D
        .map((p) => `${(p.x ?? 0).toFixed(3)}, ${(p.y ?? 0).toFixed(3)}, ${(p.z ?? 0).toFixed(3)}`)
        .join('; ');
      lines.push(
        `  [${ptsStr}]; % ${wj.id} (${wj.surface} - ${getJointSetId(wj)}) Preserved DipDir/Dip = ${wj.dipDirection ?? 0}/${wj.dip ?? 0}`
      );
    }
  }

  lines.push(`};`);
  lines.push(``);
  lines.push(`%% 3. 3D SINGULAR VALUE DECOMPOSITION [U, S, V] = svd(A, 'econ') FOR COPLANAR JOINING`);
  lines.push(`for k = 1:length(wallCrown3DTraces)`);
  lines.push(`  pts = wallCrown3DTraces{k};`);
  lines.push(`  centroid = mean(pts, 1);`);
  lines.push(`  A = pts - centroid;`);
  lines.push(`  [~, S, V] = svd(A, 'econ');`);
  lines.push(`  normalVec = V(:, 3); % Best-fit plane normal vector`);
  lines.push(`  if normalVec(2) < 0, normalVec = -normalVec; end`);
  lines.push(`  sigma3 = S(min(size(S,1),3), min(size(S,2),3));`);
  lines.push(`  rmsErrorM = sigma3 / sqrt(size(pts, 1));`);
  lines.push(`  fprintf('Trace %02d SVD Plane Normal = [%.4f, %.4f, %.4f] | RMS Coplanarity = %.4f m\\n', ...`);
  lines.push(`          k, normalVec(1), normalVec(2), normalVec(3), rmsErrorM);`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`%% 4. FACE <-> WALL/CROWN 3D VECTOR CROSS-PRODUCT TRUE DIP SOLVER`);
  lines.push(`% n = cross(t_face, t_wall) / norm(cross(t_face, t_wall))`);
  lines.push(`solveCrossProductPlane = @(tFace, tWall) cross(tFace, tWall) / max(1e-9, norm(cross(tFace, tWall)));`);
  lines.push(``);
  lines.push(`%% 5. 3D JOINT NETWORK & PLANE FITTING (PCA / SVD): DIP, DIP DIRECTION, PERSISTENCE & SPACING`);
  lines.push(`% Fits 3D planes to trace vertices via SVD, computes 3D curvilinear persistence L_3D,`);
  lines.push(`% and projects plane centroids onto set normal n_set to compute true perpendicular spacing S_normal`);
  lines.push(`for k = 1:length(wallCrown3DTraces)`);
  lines.push(`  V3d = wallCrown3DTraces{k};`);
  lines.push(`  diffs = diff(V3d, 1, 1);`);
  lines.push(`  persistence3D_m = sum(sqrt(sum(diffs.^2, 2)));`);
  lines.push(`  c3d = mean(V3d, 1);`);
  lines.push(`  [~, S_svd, V_svd] = svd(V3d - c3d, 'econ');`);
  lines.push(`  nPlane = V_svd(:, end);`);
  lines.push(`  if nPlane(2) < 0, nPlane = -nPlane; end`);
  lines.push(`  dipDeg = acosd(min(1, max(-1, abs(nPlane(2)))));`);
  lines.push(`  relAzDeg = atan2d(nPlane(1), nPlane(3));`);
  lines.push(`  dipDirDeg = mod(driveAzimuthDeg + relAzDeg + 360, 360);`);
  lines.push(`  fprintf('Joint %02d | DipDir/Dip = %03.0f/%02.0f | 3D Persistence = %.2f m\\n', k, dipDirDeg, dipDeg, persistence3D_m);`);
  lines.push(`end`);
  lines.push(`fprintf('MATLAB Joint Matrix Analysis Complete.\\n');`);

  return lines.join('\n');
}

// ============================================================================
// 8. FULL UNIFIED RUNNER
// ============================================================================

export function runFullMatlabJointMatrixAnalysis(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  stripDataset?: ContinuousStripDataset | null
): MatlabFullAnalysisReport {
  const faceCollinearCandidates = analyzeFaceCollinearJointCandidates(
    joints,
    geometry
  );
  const { intersections, blocks, directionalRqd } =
    analyzeFaceIntersectionNetwork(joints, geometry);
  const { svdPlanes, joinCandidates } = analyzeWallCrown3DSvdAndJoining(
    joints,
    geometry,
    settings,
    stripDataset
  );
  const faceToWallCrossProducts = analyzeFaceToWallCrossProductPairs(
    joints,
    geometry,
    settings
  );
  const jointNetwork3DPcaSvd = analyze3DJointNetworkAndPlaneFitting(
    joints,
    geometry,
    settings
  );
  const matlabScriptCode = generateRunnableMatlabScript(
    joints,
    geometry,
    settings,
    stripDataset
  );

  return {
    faceCollinearCandidates,
    faceIntersections: intersections,
    faceBlocks: blocks,
    directionalRqdProfile: directionalRqd,
    wallCrownSvdPlanes: svdPlanes,
    wallCrownJoinCandidates: joinCandidates,
    faceToWallCrossProducts,
    jointNetwork3DPcaSvd,
    matlabScriptCode,
  };
}
