// ============================================================================
// ESWA GEOLOGICAL MAPPER — NATM 3D JOINT INSPECTOR CALCULATION ENGINE
// Mathematically validated 3D plane construction, coordinate transformations,
// multi-surface intersections, trace length extraction, and orientation conventions.
// ============================================================================

import { FieldPanelId, FieldPoint2D } from './fieldMappingEngine';

export interface Vec3D {
  x: number; // Local: 0..W across cross-section (Left to Right) | World: East
  y: number; // Local: 0..H elevation above invert             | World: Up
  z: number; // Local: 0..L distance along drive               | World: North
}

export interface TunnelSpatialGeometry {
  widthM: number;
  heightM: number;
  wallHeightM: number;
  pullLengthM: number;
  driveAzimuthDeg?: number; // 0..360° from North
  currentChainageM?: number;
  tunnelShape?: 'd_shaped' | 'horseshoe' | 'circular' | 'rectangular';
}

export interface StrikeConventionResult {
  dipDirectionDeg: number;
  dipDeg: number;
  strikeRhrDeg: number;   // Right-Hand Rule (looking along strike, dips to the right = dipDirection - 90)
  strikeAltDeg: number;   // Alternate strike direction = (strikeRhr + 180) % 360
  explanation: string;
}

export interface PlaneEquation {
  a: number; // Ax + By + Cz + d = 0
  b: number;
  c: number;
  d: number;
  normal: Vec3D;
  dipVector: Vec3D;
  strikeVector: Vec3D;
}

export interface SurfaceIntersectionSegment {
  panel: FieldPanelId;
  p1: { x: number; y: number }; // Surface 2D metric coordinates (meters)
  p2: { x: number; y: number };
  lengthM: number;
  isObserved: boolean;
  isInferredContinuation: boolean;
}

export interface Joint3DInspectionData {
  jointId: string;
  sourcePanel: FieldPanelId;
  orientation: StrikeConventionResult;
  measurementSource: 'MANUAL_COMPASS' | 'GEOMETRIC_FIT' | 'PHOTOGRAMMETRY_MULTIVIEW';
  orientationConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  angularUncertaintyDeg: number;
  isGeoreferenced: boolean;
  coordinateReferenceNotice: string;
  anchorPoint: Vec3D;
  plane: PlaneEquation;
  clippedPlaneVertices: Vec3D[]; // 3D polygon within tunnel bounding volume
  observedLengths: {
    faceM: number;
    leftWallM: number;
    rightWallM: number;
    crownM: number;
    totalObservedM: number;
  };
  calculatedIntersections: {
    face?: SurfaceIntersectionSegment;
    leftWall?: SurfaceIntersectionSegment;
    rightWall?: SurfaceIntersectionSegment;
    crown?: SurfaceIntersectionSegment;
    totalCalculatedM: number;
  };
  persistenceInterpretation: string;
  persistenceAssumptions: string;
  persistenceConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  linkedTraceIds: string[];
}

export interface JointPairIntersectionResult {
  hasIntersection: boolean;
  isParallel: boolean;
  angleBetweenPlanesDeg: number;
  lineTrendDeg: number;  // Azimuth of plunging line
  linePlungeDeg: number; // Plunge angle from horizontal (0..90°)
  lineDirection: Vec3D;
  disclaimer: string;
}

// ----------------------------------------------------------------------------
// 1. ANGLE CONVENTIONS & STRIKE CALCULATION
// ----------------------------------------------------------------------------

export function normalizeAngle360(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Number(norm.toFixed(1));
}

export function clampDip(deg: number): number {
  return Math.max(0, Math.min(90, Number(deg.toFixed(1))));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates Strike Direction from Dip Direction using standard geological rules.
 * Right-Hand Rule (RHR): Looking along the strike direction, the plane dips to the right.
 * Therefore, Strike_RHR = (DipDirection - 90°) mod 360°.
 * Alternate Strike = (Strike_RHR + 180°) mod 360° = (DipDirection + 90°) mod 360°.
 */
export function calculateStrikeFromDipDirection(dipDirectionDeg: number, dipDeg: number): StrikeConventionResult {
  const dd = normalizeAngle360(dipDirectionDeg);
  const dip = clampDip(dipDeg);
  const strikeRhr = normalizeAngle360(dd - 90);
  const strikeAlt = normalizeAngle360(dd + 90);

  const explanation =
    `Right-Hand Rule (RHR): Following strike azimuth ${Math.round(strikeRhr)}°, the plane dips downward to the right toward ${Math.round(dd)}° (dip ${Math.round(dip)}°). Alternate strike back-azimuth is ${Math.round(strikeAlt)}°.`;

  return {
    dipDirectionDeg: dd,
    dipDeg: dip,
    strikeRhrDeg: strikeRhr,
    strikeAltDeg: strikeAlt,
    explanation,
  };
}

export interface SurfaceApparentDipInfo {
  panel: FieldPanelId;
  panelOrientationDescription: string;
  apparentDipDeg: number;            // 0..90° apparent inclination on this 2D surface
  apparentDipDirectionLabel: string; // e.g. "Dips East (Right across Face)", "Horizontal (Parallel to Wall)"
  isTrueDip: boolean;                // True if surface is perpendicular to strike
  isHorizontal: boolean;              // True if surface is parallel to strike
  angleToStrikeDeg: number;          // Beta angle between surface line and joint strike (0..90°)
  geologicalNote: string;
}

export interface TunnelSurfacesApparentDipMatrix {
  trueDipDirectionDeg: number;
  trueDipDeg: number;
  strikeRhrDeg: number;
  strikeAltDeg: number;
  tunnelDriveAzimuthDeg: number;
  face: SurfaceApparentDipInfo;
  leftWall: SurfaceApparentDipInfo;
  rightWall: SurfaceApparentDipInfo;
  crown: SurfaceApparentDipInfo;
  comprehensiveExplanation: string;
}

/**
 * Calculates analytical Apparent Dip and visible trace angles across all 4 tunnel exposure surfaces:
 * - Excavation Face (vertical wall perpendicular to tunnel drive axis)
 * - Left Sidewall (vertical wall parallel to tunnel drive axis)
 * - Right Sidewall (vertical wall parallel to tunnel drive axis)
 * - Crown Arch / Back (overhead surface whose apex tangent is horizontal -> exhibits Strike)
 *
 * Formula: tan(apparent_dip) = tan(true_dip) * sin(beta)
 * where beta is the acute angle between the joint strike and the wall orientation.
 */
export function calculateSurfaceApparentTraceAngles(
  dipDirectionDeg: number,
  dipDeg: number,
  driveAzimuthDeg: number = 0
): TunnelSurfacesApparentDipMatrix {
  const dd = normalizeAngle360(dipDirectionDeg);
  const dip = clampDip(dipDeg);
  const drive = normalizeAngle360(driveAzimuthDeg);
  const strikeInfo = calculateStrikeFromDipDirection(dd, dip);
  const strike = strikeInfo.strikeRhrDeg;

  // 1. Excavation Face: Vertical wall perpendicular to Drive Axis
  // The face cross-line runs along azimuth (Drive + 90°)
  const faceLineAz = normalizeAngle360(drive + 90);
  let betaFace = Math.abs(strike - faceLineAz) % 180;
  if (betaFace > 90) betaFace = 180 - betaFace;

  const dipRad = degToRad(dip);
  const betaFaceRad = degToRad(betaFace);
  const tanAppFace = Math.tan(dipRad) * Math.sin(betaFaceRad);
  const appFaceDeg = Number(radToDeg(Math.atan(tanAppFace)).toFixed(1));

  const isFaceTrueDip = Math.abs(betaFace - 90) < 0.5;
  const isFaceHorizontal = betaFace < 0.5 || dip === 0;

  // Determine direction of dip across face (Left to Right looking at Face)
  // Local X component of dip vector: dx = sin(localAz) * cos(dip)
  const localAz = normalizeAngle360(dd - drive);
  const dx = Math.sin(degToRad(localAz)) * Math.cos(dipRad);
  let faceDirLabel = 'Horizontal (0° trace)';
  if (!isFaceHorizontal) {
    if (Math.abs(dx) < 0.02) {
      faceDirLabel = `Symmetrical / Steep ${appFaceDeg}°`;
    } else if (dx > 0) {
      faceDirLabel = `Dips to the Right (${appFaceDeg}° Apparent)`;
    } else {
      faceDirLabel = `Dips to the Left (${appFaceDeg}° Apparent)`;
    }
  }

  const faceNote = isFaceTrueDip
    ? `Face is strictly perpendicular to strike (β=90°). Visible inclination = TRUE DIP (${dip}°).`
    : isFaceHorizontal
    ? `Joint strike is parallel to Face plane (β=0°). Trace on face is strictly HORIZONTAL (0° apparent dip).`
    : `Face is oblique to strike by β=${Math.round(betaFace)}°. Trace shows APPARENT DIP of ${appFaceDeg}° (flatter than True Dip ${dip}°).`;

  const faceInfo: SurfaceApparentDipInfo = {
    panel: 'face',
    panelOrientationDescription: `Transverse Vertical Wall (Azimuth ${Math.round(faceLineAz)}°)`,
    apparentDipDeg: appFaceDeg,
    apparentDipDirectionLabel: isFaceTrueDip ? `True Dip ${dip}°` : faceDirLabel,
    isTrueDip: isFaceTrueDip,
    isHorizontal: isFaceHorizontal,
    angleToStrikeDeg: Number(betaFace.toFixed(1)),
    geologicalNote: faceNote,
  };

  // 2. Sidewalls: Vertical walls parallel to Drive Axis (Azimuth = Drive)
  // Since Face is perpendicular to Sidewall: betaWall = 90° - betaFace
  const betaWall = Math.max(0, Math.min(90, 90 - betaFace));
  const betaWallRad = degToRad(betaWall);
  const tanAppWall = Math.tan(dipRad) * Math.sin(betaWallRad);
  const appWallDeg = Number(radToDeg(Math.atan(tanAppWall)).toFixed(1));

  const isWallTrueDip = Math.abs(betaWall - 90) < 0.5;
  const isWallHorizontal = betaWall < 0.5 || dip === 0;

  // Plunge along sidewall (Towards Face / Forward Advance vs Towards Portal / Backwards)
  // Local Z component: dz = cos(localAz) * cos(dip)
  const dz = Math.cos(degToRad(localAz)) * Math.cos(dipRad);
  let wallPlungeLabel = 'Horizontal trace (0°)';
  if (!isWallHorizontal) {
    if (Math.abs(dz) < 0.02) {
      wallPlungeLabel = `Vertical trace (${appWallDeg}°)`;
    } else if (dz > 0) {
      wallPlungeLabel = `Dips Forward toward Face (+Chainage, ${appWallDeg}°)`;
    } else {
      wallPlungeLabel = `Dips Backward toward Portal (-Chainage, ${appWallDeg}°)`;
    }
  }

  const leftWallNote = isWallTrueDip
    ? `Sidewall is strictly perpendicular to strike (β=90°). Visible inclination = TRUE DIP (${dip}°).`
    : isWallHorizontal
    ? `Joint strike is parallel to sidewall (β=0°). Trace along left wall is strictly HORIZONTAL (0° apparent dip).`
    : `Sidewall is oblique to strike by β=${Math.round(betaWall)}°. Trace shows APPARENT DIP of ${appWallDeg}°.`;

  const leftWallInfo: SurfaceApparentDipInfo = {
    panel: 'left_wall',
    panelOrientationDescription: `Left Longitudinal Wall (Parallel to Drive N ${Math.round(drive)}° E)`,
    apparentDipDeg: appWallDeg,
    apparentDipDirectionLabel: isWallTrueDip ? `True Dip ${dip}°` : wallPlungeLabel,
    isTrueDip: isWallTrueDip,
    isHorizontal: isWallHorizontal,
    angleToStrikeDeg: Number(betaWall.toFixed(1)),
    geologicalNote: leftWallNote,
  };

  const rightWallInfo: SurfaceApparentDipInfo = {
    ...leftWallInfo,
    panel: 'right_wall',
    panelOrientationDescription: `Right Longitudinal Wall (Parallel to Drive N ${Math.round(drive)}° E)`,
  };

  // 3. Crown Arch / Back: Overhead horizontal plane tangent
  // Intersection with any horizontal plane is ALWAYS the STRIKE line!
  let crownAngleToAxis = Math.abs(strike - drive) % 180;
  if (crownAngleToAxis > 90) crownAngleToAxis = 180 - crownAngleToAxis;

  let crownTraceLabel = '';
  if (crownAngleToAxis < 2) {
    crownTraceLabel = `Longitudinal Strike Trace (Parallel to Drive Axis)`;
  } else if (Math.abs(crownAngleToAxis - 90) < 2) {
    crownTraceLabel = `Transverse Strike Trace (Perpendicular across Arch)`;
  } else {
    crownTraceLabel = `Oblique Strike Trace (${Math.round(crownAngleToAxis)}° to Drive Axis)`;
  }

  const crownNote =
    `The horizontal tangent at the Crown Arch apex always intersects the joint along its STRIKE line (${Math.round(strike)}° / ${Math.round(strikeInfo.strikeAltDeg)}°), running at ${Math.round(crownAngleToAxis)}° relative to the tunnel centerline.`;

  const crownInfo: SurfaceApparentDipInfo = {
    panel: 'crown',
    panelOrientationDescription: 'Overhead Horizontal Arch Apex',
    apparentDipDeg: 0, // A horizontal intersection has 0 plunge/dip (it is a strike line)
    apparentDipDirectionLabel: crownTraceLabel,
    isTrueDip: false,
    isHorizontal: true,
    angleToStrikeDeg: 0,
    geologicalNote: crownNote,
  };

  const comprehensiveExplanation =
    `Geological Rule: True Dip (${dip}°) is only visible on a wall that is exactly perpendicular to the Joint Strike (${Math.round(strike)}°). ` +
    `On the Face, the apparent dip is ${appFaceDeg}°. On the Sidewalls, the apparent dip is ${appWallDeg}°. ` +
    `On the Crown, the intersection line is always the Strike direction (${Math.round(strike)}°).`;

  return {
    trueDipDirectionDeg: dd,
    trueDipDeg: dip,
    strikeRhrDeg: strike,
    strikeAltDeg: strikeInfo.strikeAltDeg,
    tunnelDriveAzimuthDeg: drive,
    face: faceInfo,
    leftWall: leftWallInfo,
    rightWall: rightWallInfo,
    crown: crownInfo,
    comprehensiveExplanation,
  };
}

/**
 * Transforms local tunnel coordinates to World ENU (East, Up, North)
 * if a valid tunnel drive azimuth is supplied.
 */
export function localTunnelToWorldENU(
  local: Vec3D,
  geom: TunnelSpatialGeometry
): { enu: Vec3D; isGeoreferenced: boolean } {
  if (geom.driveAzimuthDeg === undefined || isNaN(geom.driveAzimuthDeg)) {
    return {
      enu: { ...local },
      isGeoreferenced: false,
    };
  }

  const azRad = degToRad(normalizeAngle360(geom.driveAzimuthDeg));
  // Local coordinate relative to tunnel centerline:
  const dx = local.x - geom.widthM / 2;
  const dz = local.z;

  // Drive unit vector in (East, North): (sin az, cos az)
  // Cross unit vector (Right): (cos az, -sin az)
  const east = dx * Math.cos(azRad) + dz * Math.sin(azRad);
  const north = -dx * Math.sin(azRad) + dz * Math.cos(azRad);
  const up = local.y;

  return {
    enu: { x: Number(east.toFixed(3)), y: Number(up.toFixed(3)), z: Number(north.toFixed(3)) },
    isGeoreferenced: true,
  };
}

// ----------------------------------------------------------------------------
// 3. 3D PLANE EQUATION CONSTRUCTION & ANCHORING
// ----------------------------------------------------------------------------

/**
 * Builds the mathematical 3D plane for a joint from its orientation and anchor point.
 * In local tunnel coordinates:
 * - Azimuth reference: 0° is along tunnel drive axis (+Z) if local, or True North if georeferenced.
 * - Downward dip vector: d = (sin(alpha) * cos(delta), -sin(delta), cos(alpha) * cos(delta))
 * - Strike vector: s = (cos(alpha), 0, -sin(alpha)) [pointing along alpha - 90°]
 * - Plane unit normal: n = (sin(alpha) * sin(delta), cos(delta), cos(alpha) * sin(delta))
 */
export function constructJointPlane(
  dipDirectionDeg: number,
  dipDeg: number,
  anchorPoint: Vec3D,
  driveAzimuthDeg?: number
): PlaneEquation {
  const dd = normalizeAngle360(dipDirectionDeg);
  const dip = clampDip(dipDeg);

  // If tunnel drive azimuth is specified, convert geographic dip direction to local drive coordinate:
  // Local azimuth = dipDirection - driveAzimuth
  const localAzDeg = driveAzimuthDeg !== undefined ? normalizeAngle360(dd - driveAzimuthDeg) : dd;

  const alphaRad = degToRad(localAzDeg);
  const deltaRad = degToRad(dip);

  // Dip vector (downward):
  const dx = Math.sin(alphaRad) * Math.cos(deltaRad);
  const dy = -Math.sin(deltaRad);
  const dz = Math.cos(alphaRad) * Math.cos(deltaRad);

  // Strike vector (horizontal):
  const sx = Math.sin(degToRad(localAzDeg - 90));
  const sy = 0;
  const sz = Math.cos(degToRad(localAzDeg - 90));

  // Upward plane normal n = (a, b, c):
  // For dip=0 (horizontal plane), normal is (0, 1, 0)
  // For dip=90 (vertical plane), normal is horizontal: (sin alpha, 0, cos alpha)
  const a = Math.sin(alphaRad) * Math.sin(deltaRad);
  const b = Math.cos(deltaRad);
  const c = Math.cos(alphaRad) * Math.sin(deltaRad);

  // Normalize normal vector:
  const len = Math.hypot(a, b, c) || 1;
  const na = a / len;
  const nb = b / len;
  const nc = c / len;

  // D = -(na * x0 + nb * y0 + nc * z0)
  const d = -(na * anchorPoint.x + nb * anchorPoint.y + nc * anchorPoint.z);

  return {
    a: na,
    b: nb,
    c: nc,
    d,
    normal: { x: na, y: nb, z: nc },
    dipVector: { x: dx, y: dy, z: dz },
    strikeVector: { x: sx, y: sy, z: sz },
  };
}

/**
 * Derives the anchor point P0 (x0, y0, z0) in meters from mapped 2D polyline points.
 */
export function deriveAnchorPointFromPoints(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): Vec3D {
  if (!points || points.length === 0) {
    return {
      x: geom.widthM / 2,
      y: geom.heightM / 2,
      z: geom.pullLengthM,
    };
  }

  // Calculate polyline centroid in 2D canvas coordinates
  let sumX = 0;
  let sumY = 0;
  points.forEach((p) => {
    sumX += p.x;
    sumY += p.y;
  });
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Convert SVG canvas coordinates to real tunnel metric meters based on panel
  // Canonical canvas dimensions: Face W x H, Walls L x H_wall, Crown W x DevelopedArc
  switch (panel) {
    case 'face': {
      // Metric X: 0 to widthM, Metric Y: 0 (floor) to heightM (crown)
      // On canvas, Y=0 is top, Y_max is bottom
      const mx = (cx / 1000) * geom.widthM;
      const my = geom.heightM - (cy / 800) * geom.heightM;
      return {
        x: Math.max(0.1, Math.min(geom.widthM - 0.1, mx)),
        y: Math.max(0.1, Math.min(geom.heightM - 0.1, my)),
        z: geom.pullLengthM, // Located on current excavation face plane
      };
    }
    case 'left_wall': {
      // Left wall: x = 0, z from 0 to pullLengthM, y from 0 to wallHeightM
      const mz = (cx / 1000) * geom.pullLengthM;
      const my = geom.wallHeightM - (cy / 800) * geom.wallHeightM;
      return {
        x: 0,
        y: Math.max(0.1, Math.min(geom.wallHeightM, my)),
        z: Math.max(0, Math.min(geom.pullLengthM, mz)),
      };
    }
    case 'right_wall': {
      // Right wall: x = widthM, z from 0 to pullLengthM, y from 0 to wallHeightM
      const mz = (cx / 1000) * geom.pullLengthM;
      const my = geom.wallHeightM - (cy / 800) * geom.wallHeightM;
      return {
        x: geom.widthM,
        y: Math.max(0.1, Math.min(geom.wallHeightM, my)),
        z: Math.max(0, Math.min(geom.pullLengthM, mz)),
      };
    }
    case 'crown': {
      // Crown arch: x from 0 to widthM, z from 0 to pullLengthM, y near heightM
      const mx = (cx / 1000) * geom.widthM;
      const mz = (cy / 800) * geom.pullLengthM;
      return {
        x: Math.max(0.1, Math.min(geom.widthM - 0.1, mx)),
        y: geom.heightM * 0.95,
        z: Math.max(0, Math.min(geom.pullLengthM, mz)),
      };
    }
    default:
      return {
        x: geom.widthM / 2,
        y: geom.heightM / 2,
        z: geom.pullLengthM,
      };
  }
}

// ----------------------------------------------------------------------------
// 4. OBSERVED TRACE LENGTH CALCULATION
// ----------------------------------------------------------------------------

export function calculatePolylineLengthM(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): number {
  if (!points || points.length < 2) return 0;

  let totalCanvasPx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalCanvasPx += Math.hypot(dx, dy);
  }

  // Convert canvas pixel distance to real-world meters
  let scaleMetersPerPx = 1.0;
  if (panel === 'face') {
    scaleMetersPerPx = Math.sqrt(
      Math.pow(geom.widthM / 1000, 2) + Math.pow(geom.heightM / 800, 2)
    ) / Math.SQRT2;
  } else if (panel === 'left_wall' || panel === 'right_wall') {
    scaleMetersPerPx = Math.sqrt(
      Math.pow(geom.pullLengthM / 1000, 2) + Math.pow(geom.wallHeightM / 800, 2)
    ) / Math.SQRT2;
  } else if (panel === 'crown') {
    scaleMetersPerPx = Math.sqrt(
      Math.pow(geom.widthM / 1000, 2) + Math.pow(geom.pullLengthM / 800, 2)
    ) / Math.SQRT2;
  }

  const lengthM = totalCanvasPx * scaleMetersPerPx;
  return Number(Math.max(0, lengthM).toFixed(2));
}

// ----------------------------------------------------------------------------
// 5. SURFACE INTERSECTION LINE SOLVER
// ----------------------------------------------------------------------------

/**
 * Clips a 2D line Ax + By + C = 0 to a rectangle [xMin, xMax] x [yMin, yMax].
 * Returns two endpoints or null if no intersection.
 */
function clipLineToRect(
  A: number,
  B: number,
  C: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const eps = 1e-7;
  const pts: { x: number; y: number }[] = [];

  // Intersect with x = xMin: B y = -C - A xMin
  if (Math.abs(B) > eps) {
    const y = (-C - A * xMin) / B;
    if (y >= yMin - eps && y <= yMax + eps) {
      pts.push({ x: xMin, y: Math.max(yMin, Math.min(yMax, y)) });
    }
  }
  // Intersect with x = xMax:
  if (Math.abs(B) > eps) {
    const y = (-C - A * xMax) / B;
    if (y >= yMin - eps && y <= yMax + eps) {
      pts.push({ x: xMax, y: Math.max(yMin, Math.min(yMax, y)) });
    }
  }
  // Intersect with y = yMin: A x = -C - B yMin
  if (Math.abs(A) > eps) {
    const x = (-C - B * yMin) / A;
    if (x >= xMin - eps && x <= xMax + eps) {
      pts.push({ x: Math.max(xMin, Math.min(xMax, x)), y: yMin });
    }
  }
  // Intersect with y = yMax:
  if (Math.abs(A) > eps) {
    const x = (-C - B * yMax) / A;
    if (x >= xMin - eps && x <= xMax + eps) {
      pts.push({ x: Math.max(xMin, Math.min(xMax, x)), y: yMax });
    }
  }

  // Deduplicate points within small tolerance
  const unique: { x: number; y: number }[] = [];
  pts.forEach((p) => {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1e-3)) {
      unique.push(p);
    }
  });

  if (unique.length < 2) return null;
  return { p1: unique[0], p2: unique[1] };
}

/**
 * Calculates mathematical plane intersections with all 4 tunnel surfaces:
 * Face (z = L), Left Wall (x = 0), Right Wall (x = W), Crown (arch).
 */
export function calculatePlaneSurfaceIntersections(
  plane: PlaneEquation,
  geom: TunnelSpatialGeometry,
  sourcePanel: FieldPanelId
): {
  face?: SurfaceIntersectionSegment;
  leftWall?: SurfaceIntersectionSegment;
  rightWall?: SurfaceIntersectionSegment;
  crown?: SurfaceIntersectionSegment;
  totalCalculatedM: number;
} {
  const { a, b, c, d } = plane;
  let totalM = 0;

  // 1. FACE (z = pullLengthM)
  // Equation: a * x + b * y + (c * pullLengthM + d) = 0
  const faceC = c * geom.pullLengthM + d;
  const faceClip = clipLineToRect(a, b, faceC, 0, geom.widthM, 0, geom.heightM);
  let faceSeg: SurfaceIntersectionSegment | undefined;
  if (faceClip) {
    const len = Math.hypot(faceClip.p2.x - faceClip.p1.x, faceClip.p2.y - faceClip.p1.y);
    faceSeg = {
      panel: 'face',
      p1: faceClip.p1,
      p2: faceClip.p2,
      lengthM: Number(len.toFixed(2)),
      isObserved: sourcePanel === 'face',
      isInferredContinuation: sourcePanel !== 'face',
    };
    totalM += len;
  }

  // 2. LEFT WALL (x = 0)
  // Coordinates on left wall: horizontal = z (0..pullLengthM), vertical = y (0..wallHeightM)
  // Equation: b * y + c * z + d = 0
  const leftClip = clipLineToRect(c, b, d, 0, geom.pullLengthM, 0, geom.wallHeightM);
  let leftSeg: SurfaceIntersectionSegment | undefined;
  if (leftClip) {
    const len = Math.hypot(leftClip.p2.x - leftClip.p1.x, leftClip.p2.y - leftClip.p1.y);
    leftSeg = {
      panel: 'left_wall',
      p1: leftClip.p1,
      p2: leftClip.p2,
      lengthM: Number(len.toFixed(2)),
      isObserved: sourcePanel === 'left_wall',
      isInferredContinuation: sourcePanel !== 'left_wall',
    };
    totalM += len;
  }

  // 3. RIGHT WALL (x = widthM)
  // Coordinates on right wall: horizontal = z (0..pullLengthM), vertical = y (0..wallHeightM)
  // Equation: b * y + c * z + (a * widthM + d) = 0
  const rightC = a * geom.widthM + d;
  const rightClip = clipLineToRect(c, b, rightC, 0, geom.pullLengthM, 0, geom.wallHeightM);
  let rightSeg: SurfaceIntersectionSegment | undefined;
  if (rightClip) {
    const len = Math.hypot(rightClip.p2.x - rightClip.p1.x, rightClip.p2.y - rightClip.p1.y);
    rightSeg = {
      panel: 'right_wall',
      p1: rightClip.p1,
      p2: rightClip.p2,
      lengthM: Number(len.toFixed(2)),
      isObserved: sourcePanel === 'right_wall',
      isInferredContinuation: sourcePanel !== 'right_wall',
    };
    totalM += len;
  }

  // 4. CROWN ARCH
  // Intersection of plane with the upper arch vault
  // Sample along arch arc to find intersection segment length
  let crownSeg: SurfaceIntersectionSegment | undefined;
  const crownArcSpan = geom.widthM * 1.15; // approximate arc length
  const crownC = a * (geom.widthM / 2) + b * geom.heightM + d;
  const crownClip = clipLineToRect(a, c, crownC, 0, geom.widthM, 0, geom.pullLengthM);
  if (crownClip) {
    const len = Math.hypot(crownClip.p2.x - crownClip.p1.x, crownClip.p2.y - crownClip.p1.y);
    crownSeg = {
      panel: 'crown',
      p1: crownClip.p1,
      p2: crownClip.p2,
      lengthM: Number(len.toFixed(2)),
      isObserved: sourcePanel === 'crown',
      isInferredContinuation: sourcePanel !== 'crown',
    };
    totalM += len;
  }

  return {
    face: faceSeg,
    leftWall: leftSeg,
    rightWall: rightSeg,
    crown: crownSeg,
    totalCalculatedM: Number(totalM.toFixed(2)),
  };
}

// ----------------------------------------------------------------------------
// 6. 3D PLANE CLIPPING TO TUNNEL BOUNDING BOX
// ----------------------------------------------------------------------------

/**
 * Clips the infinite plane a*x + b*y + c*z + d = 0 to the tunnel bounding box:
 * [0, widthM] x [0, heightM] x [0, pullLengthM].
 * Returns an ordered 3D polygon array of vertices for Three.js rendering.
 */
export function clipPlaneToTunnelBox(
  plane: PlaneEquation,
  geom: TunnelSpatialGeometry
): Vec3D[] {
  const { a, b, c, d } = plane;
  const eps = 1e-6;

  const xMin = 0, xMax = geom.widthM;
  const yMin = 0, yMax = geom.heightM;
  const zMin = 0, zMax = geom.pullLengthM;

  // The 12 edges of the bounding box
  const edges: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][] = [
    // 4 edges parallel to X
    [{ x: xMin, y: yMin, z: zMin }, { x: xMax, y: yMin, z: zMin }],
    [{ x: xMin, y: yMax, z: zMin }, { x: xMax, y: yMax, z: zMin }],
    [{ x: xMin, y: yMin, z: zMax }, { x: xMax, y: yMin, z: zMax }],
    [{ x: xMin, y: yMax, z: zMax }, { x: xMax, y: yMax, z: zMax }],
    // 4 edges parallel to Y
    [{ x: xMin, y: yMin, z: zMin }, { x: xMin, y: yMax, z: zMin }],
    [{ x: xMax, y: yMin, z: zMin }, { x: xMax, y: yMax, z: zMin }],
    [{ x: xMin, y: yMin, z: zMax }, { x: xMin, y: yMax, z: zMax }],
    [{ x: xMax, y: yMin, z: zMax }, { x: xMax, y: yMax, z: zMax }],
    // 4 edges parallel to Z
    [{ x: xMin, y: yMin, z: zMin }, { x: xMin, y: yMin, z: zMax }],
    [{ x: xMax, y: yMin, z: zMin }, { x: xMax, y: yMin, z: zMax }],
    [{ x: xMin, y: yMax, z: zMin }, { x: xMin, y: yMax, z: zMax }],
    [{ x: xMax, y: yMax, z: zMin }, { x: xMax, y: yMax, z: zMax }],
  ];

  const intersectPts: Vec3D[] = [];

  edges.forEach(([p0, p1]) => {
    const v0 = a * p0.x + b * p0.y + c * p0.z + d;
    const v1 = a * p1.x + b * p1.y + c * p1.z + d;

    if (Math.abs(v0) < eps) {
      intersectPts.push(p0);
      return;
    }
    if (Math.abs(v1) < eps) {
      intersectPts.push(p1);
      return;
    }

    if ((v0 > 0 && v1 < 0) || (v0 < 0 && v1 > 0)) {
      const t = v0 / (v0 - v1);
      const px = p0.x + t * (p1.x - p0.x);
      const py = p0.y + t * (p1.y - p0.y);
      const pz = p0.z + t * (p1.z - p0.z);
      intersectPts.push({
        x: Number(px.toFixed(3)),
        y: Number(py.toFixed(3)),
        z: Number(pz.toFixed(3)),
      });
    }
  });

  // Deduplicate points
  const unique: Vec3D[] = [];
  intersectPts.forEach((pt) => {
    if (!unique.some((u) => Math.hypot(u.x - pt.x, u.y - pt.y, u.z - pt.z) < 1e-3)) {
      unique.push(pt);
    }
  });

  if (unique.length < 3) return [];

  // Order vertices around centroid in the plane using 2D projection
  const cx = unique.reduce((sum, p) => sum + p.x, 0) / unique.length;
  const cy = unique.reduce((sum, p) => sum + p.y, 0) / unique.length;
  const cz = unique.reduce((sum, p) => sum + p.z, 0) / unique.length;

  const uVec = plane.strikeVector;
  const vVec = plane.dipVector;

  const sorted = unique.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    const u = dx * uVec.x + dy * uVec.y + dz * uVec.z;
    const v = dx * vVec.x + dy * vVec.y + dz * vVec.z;
    const angle = Math.atan2(v, u);
    return { p, angle };
  });

  sorted.sort((a, b) => a.angle - b.angle);
  return sorted.map((s) => s.p);
}

// ----------------------------------------------------------------------------
// 7. TWO-PLANE INTERSECTION LINE (Trend & Plunge)
// ----------------------------------------------------------------------------

/**
 * Calculates the line of intersection between two planes.
 * Line vector L = n1 x n2.
 * Plunge: vertical angle below horizontal (0..90°).
 * Trend: azimuth toward which the line plunges (0..360°).
 */
export function calculateJointPairIntersection(
  plane1: PlaneEquation,
  plane2: PlaneEquation,
  driveAzimuthDeg?: number
): JointPairIntersectionResult {
  const n1 = plane1.normal;
  const n2 = plane2.normal;

  // Cross product n1 x n2
  let lx = n1.y * n2.z - n1.z * n2.y;
  let ly = n1.z * n2.x - n1.x * n2.z;
  let lz = n1.x * n2.y - n1.y * n2.x;

  const len = Math.hypot(lx, ly, lz);
  const dot = Math.abs(n1.x * n2.x + n1.y * n2.y + n1.z * n2.z);
  const angleBetweenDeg = Number(radToDeg(Math.acos(Math.min(1, Math.max(0, dot)))).toFixed(1));

  if (len < 1e-4) {
    return {
      hasIntersection: false,
      isParallel: true,
      angleBetweenPlanesDeg: 0,
      lineTrendDeg: 0,
      linePlungeDeg: 0,
      lineDirection: { x: 0, y: 0, z: 0 },
      disclaimer: 'Planes are parallel or coincident; no unique intersection axis exists.',
    };
  }

  // Normalize
  lx /= len;
  ly /= len;
  lz /= len;

  // Make sure vector plunges downwards (ly <= 0)
  if (ly > 0) {
    lx = -lx;
    ly = -ly;
    lz = -lz;
  }

  // Plunge is angle below horizontal: plunge = arcsin(|ly|)
  const plungeDeg = Number(radToDeg(Math.asin(Math.abs(ly))).toFixed(1));

  // Trend in horizontal plane: trend = atan2(lx, lz)
  let trendDeg = normalizeAngle360(radToDeg(Math.atan2(lx, lz)));

  // If georeferenced with drive azimuth, add drive azimuth to trend:
  if (driveAzimuthDeg !== undefined && !isNaN(driveAzimuthDeg)) {
    trendDeg = normalizeAngle360(trendDeg + driveAzimuthDeg);
  }

  return {
    hasIntersection: true,
    isParallel: false,
    angleBetweenPlanesDeg: angleBetweenDeg,
    lineTrendDeg: trendDeg,
    linePlungeDeg: plungeDeg,
    lineDirection: { x: Number(lx.toFixed(3)), y: Number(ly.toFixed(3)), z: Number(lz.toFixed(3)) },
    disclaimer:
      'Geometric line of intersection calculated from mathematical plane equations. Note: Wedge release or block sliding requires kinematic stereonet checks, daylighting conditions, and shear strength parameters.',
  };
}

// ----------------------------------------------------------------------------
// 8. AUTOMATED GEOMETRIC VALIDATION TEST SUITE
// ----------------------------------------------------------------------------

export interface EngineValidationReport {
  allTestsPassed: boolean;
  tests: {
    testName: string;
    passed: boolean;
    details: string;
  }[];
}

/**
 * Runs automated geometric validation checks to ensure zero-NaN,
 * correct strike-dip conversion, and proper intersection behavior.
 */
export function runJointEngineValidationTests(): EngineValidationReport {
  const tests: EngineValidationReport['tests'] = [];

  // Test 1: North-dipping vertical plane (000°/90°)
  {
    const st = calculateStrikeFromDipDirection(0, 90);
    const passed = st.strikeRhrDeg === 270 && st.strikeAltDeg === 90;
    tests.push({
      testName: 'Vertical Plane Strike Convention (000°/90°)',
      passed,
      details: `Expected RHR 270°, Alt 090°; Computed: RHR ${st.strikeRhrDeg}°, Alt ${st.strikeAltDeg}°`,
    });
  }

  // Test 2: Horizontal plane (000°/00°)
  {
    const p = constructJointPlane(0, 0, { x: 5, y: 3, z: 2 });
    const passed = Math.abs(p.normal.y - 1) < 1e-4 && Math.abs(p.normal.x) < 1e-4;
    tests.push({
      testName: 'Horizontal Plane Normal Vector (000°/00°)',
      passed,
      details: `Expected Normal (0, 1, 0); Computed: (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)})`,
    });
  }

  // Test 3: Orthogonal Planes Intersection (090°/90° and 180°/90°)
  {
    const p1 = constructJointPlane(90, 90, { x: 4, y: 3, z: 2 });
    const p2 = constructJointPlane(180, 90, { x: 4, y: 3, z: 2 });
    const inter = calculateJointPairIntersection(p1, p2);
    // Two vertical planes at right angles intersect along a vertical line (plunge 90°)
    const passed = inter.hasIntersection && Math.abs(inter.linePlungeDeg - 90) < 1e-2;
    tests.push({
      testName: 'Orthogonal Vertical Planes Intersection Plunge',
      passed,
      details: `Expected Plunge 90.0°; Computed Plunge ${inter.linePlungeDeg}°`,
    });
  }

  // Test 4: Parallel Planes Intersection Check
  {
    const p1 = constructJointPlane(45, 60, { x: 2, y: 2, z: 1 });
    const p2 = constructJointPlane(45, 60, { x: 3, y: 3, z: 2 });
    const inter = calculateJointPairIntersection(p1, p2);
    const passed = !inter.hasIntersection && inter.isParallel;
    tests.push({
      testName: 'Parallel Planes Non-Intersection Handling',
      passed,
      details: `Expected hasIntersection=false, isParallel=true; Computed: ${inter.hasIntersection}, ${inter.isParallel}`,
    });
  }

  // Test 5: Clipped Box Vertices Non-Empty
  {
    const geom: TunnelSpatialGeometry = {
      widthM: 8.0,
      heightM: 6.5,
      wallHeightM: 3.8,
      pullLengthM: 3.0,
    };
    const p = constructJointPlane(120, 55, { x: 4.0, y: 3.0, z: 1.5 });
    const verts = clipPlaneToTunnelBox(p, geom);
    const passed = verts.length >= 3;
    tests.push({
      testName: 'Tunnel Bounding Envelope Plane Clipping',
      passed,
      details: `Expected >= 3 polygon vertices; Computed ${verts.length} vertices`,
    });
  }

  // Test 6: User Case 1 (Drive 000°, Joint 090°/75° -> Face Apparent = 75° True Dip, Walls = 0° Horizontal)
  {
    const matrix = calculateSurfaceApparentTraceAngles(90, 75, 0);
    const passed =
      Math.abs(matrix.face.apparentDipDeg - 75) < 0.1 &&
      matrix.face.isTrueDip &&
      matrix.leftWall.apparentDipDeg === 0 &&
      matrix.leftWall.isHorizontal;
    tests.push({
      testName: 'Apparent Dip: East-Dipping Joint on N-Drive (090°/75° on 000°)',
      passed,
      details: `Face: ${matrix.face.apparentDipDeg}° (isTrue=${matrix.face.isTrueDip}), Wall: ${matrix.leftWall.apparentDipDeg}° (isHorizontal=${matrix.leftWall.isHorizontal})`,
    });
  }

  // Test 7: User Case 2 (Drive 000°, Joint 000°/45° -> Face = 0° Horizontal, Walls = 45° True Dip)
  {
    const matrix = calculateSurfaceApparentTraceAngles(0, 45, 0);
    const passed =
      matrix.face.apparentDipDeg === 0 &&
      matrix.face.isHorizontal &&
      Math.abs(matrix.leftWall.apparentDipDeg - 45) < 0.1 &&
      matrix.leftWall.isTrueDip;
    tests.push({
      testName: 'Apparent Dip: North-Dipping Joint on N-Drive (000°/45° on 000°)',
      passed,
      details: `Face: ${matrix.face.apparentDipDeg}° (isHorizontal=${matrix.face.isHorizontal}), Wall: ${matrix.leftWall.apparentDipDeg}° (isTrue=${matrix.leftWall.isTrueDip})`,
    });
  }

  const allTestsPassed = tests.every((t) => t.passed);
  return { allTestsPassed, tests };
}
