// ============================================================================
// ESWA GEOLOGICAL MAPPER — NATM 3D JOINT INSPECTOR CALCULATION ENGINE
// Mathematically validated 3D plane construction, coordinate transformations,
// multi-surface intersections, trace length extraction, and orientation conventions.
//
// TUNNEL-RELATIVE LOCAL COORDINATE SYSTEM (Standard Right-Handed):
// - X = longitudinal tunnel drive direction (0..pullLengthM), positive forward.
// - Y = transverse direction (0..widthM), positive to the right looking forward.
// - Z = vertical direction (0..heightM), positive upward.
//
// LOCAL HORIZONTAL DIRECTION CONVENTION (Clockwise from +X):
// - 000° = FORWARD (+X)
// - 090° = RIGHT (+Y)
// - 180° = BACKWARD (-X)
// - 270° = LEFT (-Y)
// ============================================================================

import { FieldPanelId, FieldPoint2D, FieldJointTrace } from './fieldMappingEngine';

export interface Vec3D {
  x: number; // Tunnel-relative X: Longitudinal drive axis (0..pullLengthM, positive forward)
  y: number; // Tunnel-relative Y: Transverse axis (0..widthM, positive to the right looking forward)
  z: number; // Tunnel-relative Z: Vertical elevation (0..heightM, positive upward)
}

export interface TunnelSpatialGeometry {
  widthM: number;
  heightM: number;
  wallHeightM: number;
  pullLengthM: number;
  driveAzimuthDeg?: number; // 0..360° from North
  currentChainageM?: number;
  tunnelShape?: 'd_shaped' | 'horseshoe' | 'circular' | 'rectangular' | 'freeform_custom';
  crossSectionPoints?: { x: number; y: number }[];
  customProfile?: any;
  hasLeftWall?: boolean;
  hasRightWall?: boolean;
  hasCrown?: boolean;
  hasInvert?: boolean;
  leftWallHeightM?: number;
  rightWallHeightM?: number;
}

export interface StrikeConventionResult {
  dipDirectionDeg: number;
  dipDeg: number;
  strikeRhrDeg: number;   // Right-Hand Rule: looking along strike, dips to the right = (dipDirection - 90) % 360
  strikeAltDeg: number;   // Alternate strike direction = (strikeRhr + 180) % 360
  strikePairLabel: string;// Dual strike axis presentation: e.g. "045° ↔ 225°"
  strikePair?: { strike1: number; strike2: number; label: string };
  directionLabel: string; // Tunnel-relative human direction: FORWARD, RIGHT, BACKWARD, LEFT, etc.
  isOrientationComplete?: boolean;
  dippingSide?: 'right' | 'left' | 'unspecified';
  explanation: string;
}

export interface PlaneEquation {
  a: number; // a*X + b*Y + c*Z + d = 0 in tunnel-relative local frame
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
  isOrientationComplete: boolean;
  incompleteNotice?: string;
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
  discrepancyWarning?: string;
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
  if (deg == null || isNaN(deg)) return 0;
  const norm = ((deg % 360) + 360) % 360;
  return Number(norm.toFixed(1));
}

export function clampDip(deg: number): number {
  if (deg == null || isNaN(deg)) return 45;
  return Math.max(0, Math.min(90, Number(deg.toFixed(1))));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Returns the human-readable direction label in the tunnel-relative coordinate system:
 * - 000° = FORWARD (+X)
 * - 090° = RIGHT (+Y)
 * - 180° = BACKWARD (-X)
 * - 270° = LEFT (-Y)
 */
export function getTunnelRelativeDirectionLabel(deg: number): string {
  const norm = normalizeAngle360(deg);
  if (norm >= 337.5 || norm < 22.5) return 'FORWARD';
  if (norm >= 22.5 && norm < 67.5) return 'FORWARD-RIGHT';
  if (norm >= 67.5 && norm < 112.5) return 'RIGHT';
  if (norm >= 112.5 && norm < 157.5) return 'BACKWARD-RIGHT';
  if (norm >= 157.5 && norm < 202.5) return 'BACKWARD';
  if (norm >= 202.5 && norm < 247.5) return 'BACKWARD-LEFT';
  if (norm >= 247.5 && norm < 292.5) return 'LEFT';
  return 'FORWARD-LEFT';
}

/**
 * Formats the two opposite strike directions into the standard dual-arrow presentation:
 * Example: 045° ↔ 225°
 * The two values represent the same strike axis in opposite directions and differ by exactly 180°.
 */
export function getCrownStrikePair(strikeDeg: number): { strike1: number; strike2: number; label: string } {
  const s1 = normalizeAngle360(strikeDeg);
  const s2 = normalizeAngle360(strikeDeg + 180);
  const lower = Math.min(s1, s2);
  const higher = Math.max(s1, s2);
  const str1 = Math.round(lower).toString().padStart(3, '0');
  const str2 = Math.round(higher).toString().padStart(3, '0');
  return {
    strike1: lower,
    strike2: higher,
    label: `${str1}° ↔ ${str2}°`,
  };
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
  const strikePair = getCrownStrikePair(strikeRhr);
  const dirLabel = getTunnelRelativeDirectionLabel(dd);

  const explanation =
    `Tunnel-Relative Orientation: Dips toward ${Math.round(dd)}° (${dirLabel}) at ${Math.round(dip)}°. Strike axis: ${strikePair.label}. (RHR strike azimuth: ${Math.round(strikeRhr)}°, opposite strike: ${Math.round(strikeAlt)}°).`;

  return {
    dipDirectionDeg: dd,
    dipDeg: dip,
    strikeRhrDeg: strikeRhr,
    strikeAltDeg: strikeAlt,
    strikePairLabel: strikePair.label,
    strikePair,
    directionLabel: dirLabel,
    isOrientationComplete: true,
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
  strikePairLabel: string;
  tunnelDriveAzimuthDeg: number;
  face: SurfaceApparentDipInfo;
  leftWall: SurfaceApparentDipInfo;
  rightWall: SurfaceApparentDipInfo;
  crown: SurfaceApparentDipInfo;
  comprehensiveExplanation: string;
}

/**
 * Calculates analytical Apparent Dip and visible trace angles across all 4 tunnel exposure surfaces:
 * - Excavation Face (vertical wall at X = pullLengthM perpendicular to tunnel drive axis X)
 * - Left Sidewall (vertical wall at Y = 0 parallel to tunnel drive axis X)
 * - Right Sidewall (vertical wall at Y = widthM parallel to tunnel drive axis X)
 * - Crown Arch / Back (overhead surface at Z = heightM)
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
  // Local Y component of dip vector: dy = sin(alpha) * cos(dip)
  const dy = Math.sin(degToRad(dd)) * Math.cos(dipRad);
  let faceDirLabel = 'Horizontal (0° trace)';
  if (!isFaceHorizontal) {
    if (Math.abs(dy) < 0.02) {
      faceDirLabel = `Symmetrical / Steep ${appFaceDeg}°`;
    } else if (dy > 0) {
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
    panelOrientationDescription: `Transverse Vertical Wall (Perpendicular to Drive)`,
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

  // Plunge along sidewall (Forward toward Face vs Backward toward Portal)
  // Local X component: dx = cos(alpha) * cos(dip)
  const dx = Math.cos(degToRad(dd)) * Math.cos(dipRad);
  let wallPlungeLabel = 'Horizontal trace (0°)';
  if (!isWallHorizontal) {
    if (Math.abs(dx) < 0.02) {
      wallPlungeLabel = `Vertical trace (${appWallDeg}°)`;
    } else if (dx > 0) {
      wallPlungeLabel = `Dips Forward toward Face (+X, ${appWallDeg}°)`;
    } else {
      wallPlungeLabel = `Dips Backward toward Portal (-X, ${appWallDeg}°)`;
    }
  }

  const leftWallNote = isWallTrueDip
    ? `Sidewall is strictly perpendicular to strike (β=90°). Visible inclination = TRUE DIP (${dip}°).`
    : isWallHorizontal
    ? `Joint strike is parallel to sidewall (β=0°). Trace along left wall is strictly HORIZONTAL (0° apparent dip).`
    : `Sidewall is oblique to strike by β=${Math.round(betaWall)}°. Trace shows APPARENT DIP of ${appWallDeg}°.`;

  const leftWallInfo: SurfaceApparentDipInfo = {
    panel: 'left_wall',
    panelOrientationDescription: `Left Longitudinal Wall (Parallel to Drive Axis +X)`,
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
    panelOrientationDescription: `Right Longitudinal Wall (Parallel to Drive Axis +X)`,
  };

  // 3. Crown Arch / Back: Overhead horizontal plane tangent
  // Intersection with any horizontal plane is ALWAYS the STRIKE line!
  let crownAngleToAxis = Math.abs(strike - 0) % 180;
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
    `The horizontal tangent at the Crown Arch apex always intersects the joint along its STRIKE axis (${strikeInfo.strikePairLabel}), running at ${Math.round(crownAngleToAxis)}° relative to the tunnel centerline.`;

  const crownInfo: SurfaceApparentDipInfo = {
    panel: 'crown',
    panelOrientationDescription: 'Overhead Horizontal Arch Apex',
    apparentDipDeg: 0,
    apparentDipDirectionLabel: crownTraceLabel,
    isTrueDip: false,
    isHorizontal: true,
    angleToStrikeDeg: 0,
    geologicalNote: crownNote,
  };

  const comprehensiveExplanation =
    `Tunnel-Relative Geological Rule: True Dip (${dip}°) is visible on a surface perpendicular to the Joint Strike (${strikeInfo.strikePairLabel}). ` +
    `Face shows ${appFaceDeg}° apparent dip (${faceInfo.apparentDipDirectionLabel}). ` +
    `Walls show ${appWallDeg}° apparent dip (${leftWallInfo.apparentDipDirectionLabel}). ` +
    `Crown exhibits the dual Strike axis (${strikeInfo.strikePairLabel}).`;

  return {
    trueDipDirectionDeg: dd,
    trueDipDeg: dip,
    strikeRhrDeg: strike,
    strikeAltDeg: strikeInfo.strikeAltDeg,
    strikePairLabel: strikeInfo.strikePairLabel,
    tunnelDriveAzimuthDeg: drive,
    face: faceInfo,
    leftWall: leftWallInfo,
    rightWall: rightWallInfo,
    crown: crownInfo,
    comprehensiveExplanation,
  };
}

// ----------------------------------------------------------------------------
// 2. 3D PLANE EQUATION CONSTRUCTION & ANCHORING
// ----------------------------------------------------------------------------

/**
 * Builds the mathematical 3D plane for a joint from its orientation and anchor point.
 * In the tunnel-relative Cartesian coordinate system:
 * - X = Longitudinal drive axis (0..pullLengthM, positive forward)
 * - Y = Transverse axis (0..widthM, positive to the right looking forward)
 * - Z = Vertical axis (0..heightM, positive upward)
 *
 * Local horizontal azimuth alpha is measured clockwise from +X:
 * - 000° = FORWARD (+X)
 * - 090° = RIGHT (+Y)
 * - 180° = BACKWARD (-X)
 * - 270° = LEFT (-Y)
 *
 * Downward dip vector:
 * v_dip = (cos(alpha) * cos(dip), sin(alpha) * cos(dip), -sin(dip))
 *
 * Strike vectors:
 * s1 = (sin(alpha), -cos(alpha), 0) [pointing along alpha - 90°]
 * s2 = (-sin(alpha), cos(alpha), 0) = -s1 [pointing along alpha + 90°]
 *
 * Upward unit normal vector:
 * n = (cos(alpha) * sin(dip), sin(alpha) * sin(dip), cos(dip))
 *
 * Plane Equation: a*X + b*Y + c*Z + d = 0, where d = -n . p0
 */
export function constructJointPlane(
  dipDirectionDeg: number,
  dipDeg: number,
  anchorPoint: Vec3D,
  _driveAzimuthDeg?: number
): PlaneEquation {
  const dd = normalizeAngle360(dipDirectionDeg ?? 135);
  const dip = clampDip(dipDeg ?? 60);

  const alphaRad = degToRad(dd);
  const deltaRad = degToRad(dip);

  // Dip vector (downward):
  const dx = Math.cos(alphaRad) * Math.cos(deltaRad);
  const dy = Math.sin(alphaRad) * Math.cos(deltaRad);
  const dz = -Math.sin(deltaRad);

  // Strike vector (horizontal along alpha - 90°):
  const sx = Math.sin(alphaRad);
  const sy = -Math.cos(alphaRad);
  const sz = 0;

  // Upward plane normal n = (a, b, c):
  // For dip=0 (horizontal plane): n = (0, 0, 1) [pointing upward +Z]
  // For dip=90 (vertical plane): n = (cos alpha, sin alpha, 0)
  const a = Math.cos(alphaRad) * Math.sin(deltaRad);
  const b = Math.sin(alphaRad) * Math.sin(deltaRad);
  const c = Math.cos(deltaRad);

  // Normalize normal vector:
  const len = Math.hypot(a, b, c) || 1;
  const na = a / len;
  const nb = b / len;
  const nc = c / len;

  const ax = anchorPoint?.x != null && !isNaN(anchorPoint.x) ? anchorPoint.x : 3.0;
  const ay = anchorPoint?.y != null && !isNaN(anchorPoint.y) ? anchorPoint.y : 4.25;
  const az = anchorPoint?.z != null && !isNaN(anchorPoint.z) ? anchorPoint.z : 3.75;

  // Plane constant d = -(na * x0 + nb * y0 + nc * z0)
  const d = -(na * ax + nb * ay + nc * az);

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
 * Derives the anchor point P0 (x0, y0, z0) in meters from mapped 2D polyline points
 * in the tunnel-relative local frame:
 * - Face: X = pullLengthM, Y in [0, widthM], Z in [0, heightM]
 * - Left Wall: Y = 0, X in [0, pullLengthM], Z in [0, wallHeightM]
 * - Right Wall: Y = widthM, X in [0, pullLengthM], Z in [0, wallHeightM]
 * - Crown: Z = heightM * 0.95, X in [0, pullLengthM], Y in [0, widthM]
 */
export function deriveAnchorPointFromPoints(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): Vec3D {
  if (!points || points.length === 0) {
    return {
      x: geom.pullLengthM,
      y: geom.widthM / 2,
      z: geom.heightM / 2,
    };
  }

  // Calculate polyline centroid in 2D canvas coordinates (0..1000, 0..800)
  let sumX = 0;
  let sumY = 0;
  points.forEach((p) => {
    sumX += p.x;
    sumY += p.y;
  });
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Determine true canvas box to convert points into exact physical coordinates
  let panelW = geom.widthM;
  let panelH = geom.heightM;
  if (panel === 'crown') {
    panelW = geom.widthM;
    panelH = geom.pullLengthM;
  } else if (panel === 'left_wall' || panel === 'right_wall') {
    panelW = geom.pullLengthM;
    panelH = geom.wallHeightM;
  }
  const maxBoxW = 845;
  const maxBoxH = 810;
  const pxPerMeter = Math.min(maxBoxW / Math.max(0.5, panelW), maxBoxH / Math.max(0.5, panelH));
  const boxW = panelW * pxPerMeter;
  const boxH = panelH * pxPerMeter;
  const boxX = 500 - boxW / 2;
  const boxY = 495 - boxH / 2;

  // Normalized coordinate in panel box
  const uNorm =
    cx >= boxX - 40 && cx <= boxX + boxW + 40
      ? Math.max(0, Math.min(1, (cx - boxX) / Math.max(1, boxW)))
      : Math.max(0, Math.min(1, cx / 1000));
  const vNorm =
    cy >= boxY - 40 && cy <= boxY + boxH + 40
      ? Math.max(0, Math.min(1, (cy - boxY) / Math.max(1, boxH)))
      : Math.max(0, Math.min(1, cy / 800));

  switch (panel) {
    case 'face': {
      // Metric Y: 0 to widthM (Left Wall to Right Wall)
      // Metric Z: 0 (floor) to heightM (crown apex)
      const my = uNorm * geom.widthM;
      const mz = (1 - vNorm) * geom.heightM;
      return {
        x: geom.pullLengthM, // Face is located at X = pullLengthM
        y: Math.max(0.05, Math.min(geom.widthM - 0.05, my)),
        z: Math.max(0.05, Math.min(geom.heightM - 0.05, mz)),
      };
    }
    case 'left_wall': {
      // Left wall: Y = 0
      // Metric X: 0 to pullLengthM (along drive)
      // Metric Z: 0 to wallHeightM (elevation from floor)
      const mx = uNorm * geom.pullLengthM;
      const mz = (1 - vNorm) * geom.wallHeightM;
      return {
        x: Math.max(0, Math.min(geom.pullLengthM, mx)),
        y: 0,
        z: Math.max(0.05, Math.min(geom.wallHeightM, mz)),
      };
    }
    case 'right_wall': {
      // Right wall: Y = widthM
      // Metric X: 0 to pullLengthM (along drive)
      // Metric Z: 0 to wallHeightM (elevation from floor)
      const mx = uNorm * geom.pullLengthM;
      const mz = (1 - vNorm) * geom.wallHeightM;
      return {
        x: Math.max(0, Math.min(geom.pullLengthM, mx)),
        y: geom.widthM,
        z: Math.max(0.05, Math.min(geom.wallHeightM, mz)),
      };
    }
    case 'crown': {
      // Crown arch: X from 0 to pullLengthM, Y from 0 to widthM (Left to Right)
      // The mapped trace on the crown ceiling defines the Strike cut point on the actual arch surface
      const my = Math.max(0.05, Math.min(geom.widthM - 0.05, uNorm * geom.widthM));
      const mx = Math.max(0, Math.min(geom.pullLengthM, (1 - vNorm) * geom.pullLengthM));

      // Calculate true arched roof elevation at transverse position Y (my):
      const cx = geom.widthM / 2;
      const hw = geom.wallHeightM || (geom.heightM * 0.55);
      const archRise = Math.max(0.5, geom.heightM - hw);
      const dy = (my - cx) / Math.max(0.1, geom.widthM / 2);
      const clampedDy = Math.max(-1, Math.min(1, dy));
      const trueArchZ = hw + archRise * Math.sqrt(Math.max(0, 1 - clampedDy * clampedDy));

      return {
        x: Number(mx.toFixed(3)),
        y: Number(my.toFixed(3)),
        z: Number(trueArchZ.toFixed(3)),
      };
    }
    default:
      return {
        x: geom.pullLengthM,
        y: geom.widthM / 2,
        z: geom.heightM / 2,
      };
  }
}

// ----------------------------------------------------------------------------
// 3. OBSERVED TRACE LENGTH CALCULATION
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
// 4. SURFACE INTERSECTION LINE SOLVER
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
 * Normalizes cross-section points to tunnel local frame:
 * Y = transverse horizontal [0, widthM]
 * Z = vertical elevation [0, heightM]
 */
export function getCrossSectionVerticesInTunnelFrame(
  geom: TunnelSpatialGeometry
): { y: number; z: number }[] {
  if (!geom.crossSectionPoints || geom.crossSectionPoints.length < 3) return [];
  const rawPts = geom.crossSectionPoints;
  const minX = Math.min(...rawPts.map((p) => p.x));
  const maxX = Math.max(...rawPts.map((p) => p.x));
  const minY = Math.min(...rawPts.map((p) => p.y));
  const maxY = Math.max(...rawPts.map((p) => p.y));
  const spanX = Math.max(0.01, maxX - minX);
  const spanY = Math.max(0.01, maxY - minY);

  return rawPts.map((pt) => ({
    y: Number((((pt.x - minX) / spanX) * geom.widthM).toFixed(3)),
    z: Number((((pt.y - minY) / spanY) * geom.heightM).toFixed(3)),
  }));
}

/**
 * Clips an infinite line A*Y + B*Z + C = 0 to an arbitrary polygon in (Y, Z) frame.
 */
export function clipLineToPolygon(
  A: number,
  B: number,
  C: number,
  poly: { y: number; z: number }[]
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const eps = 1e-6;
  const pts: { x: number; y: number }[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % n];

    const v0 = A * p0.y + B * p0.z + C;
    const v1 = A * p1.y + B * p1.z + C;

    if (Math.abs(v0) < eps) {
      pts.push({ x: p0.y, y: p0.z });
    }
    if ((v0 > eps && v1 < -eps) || (v0 < -eps && v1 > eps)) {
      const t = v0 / (v0 - v1);
      const interY = p0.y + t * (p1.y - p0.y);
      const interZ = p0.z + t * (p1.z - p0.z);
      pts.push({ x: interY, y: interZ });
    }
  }

  const unique: { x: number; y: number }[] = [];
  pts.forEach((p) => {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1e-3)) {
      unique.push(p);
    }
  });

  if (unique.length < 2) return null;
  unique.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  return { p1: unique[0], p2: unique[unique.length - 1] };
}

/**
 * Calculates mathematical plane intersections with all active tunnel surfaces:
 * In tunnel-relative local frame:
 * 1. Face: X = pullLengthM, plane becomes b*Y + c*Z + (a*pullLengthM + d) = 0
 * 2. Left Wall: Y = 0, plane becomes a*X + c*Z + d = 0 (only if hasLeftWall)
 * 3. Right Wall: Y = widthM, plane becomes a*X + c*Z + (b*widthM + d) = 0 (only if hasRightWall)
 * 4. Crown Arch: Z = heightM, plane becomes a*X + b*Y + (c*heightM + d) = 0 (only if hasCrown)
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

  // 1. FACE (X = pullLengthM)
  // Equation in (Y, Z): b * Y + c * Z + (a * pullLengthM + d) = 0
  const faceC = a * geom.pullLengthM + d;
  const customFacePoly = getCrossSectionVerticesInTunnelFrame(geom);
  const faceClip =
    customFacePoly.length >= 3
      ? clipLineToPolygon(b, c, faceC, customFacePoly)
      : clipLineToRect(b, c, faceC, 0, geom.widthM, 0, geom.heightM);

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

  // 2. LEFT WALL (Y = 0)
  let leftSeg: SurfaceIntersectionSegment | undefined;
  if (geom.hasLeftWall !== false) {
    const leftH = geom.leftWallHeightM || geom.wallHeightM;
    const leftClip = clipLineToRect(a, c, d, 0, geom.pullLengthM, 0, leftH);
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
  }

  // 3. RIGHT WALL (Y = widthM)
  let rightSeg: SurfaceIntersectionSegment | undefined;
  if (geom.hasRightWall !== false) {
    const rightH = geom.rightWallHeightM || geom.wallHeightM;
    const rightC = b * geom.widthM + d;
    const rightClip = clipLineToRect(a, c, rightC, 0, geom.pullLengthM, 0, rightH);
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
  }

  // 4. CROWN ARCH (Z = heightM)
  let crownSeg: SurfaceIntersectionSegment | undefined;
  if (geom.hasCrown !== false) {
    const crownC = c * geom.heightM + d;
    const crownClip = clipLineToRect(a, b, crownC, 0, geom.pullLengthM, 0, geom.widthM);
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
// 5. 3D PLANE CLIPPING TO TUNNEL BOUNDING BOX & CUSTOM PROFILE
// ----------------------------------------------------------------------------

/**
 * Clips the infinite plane a*X + b*Y + c*Z + d = 0 to the tunnel envelope:
 * Supports both standard bounding box and exact custom polygon prism extrusion.
 * Returns an ordered 3D polygon array of vertices for Three.js rendering.
 */
export function clipPlaneToTunnelBox(
  plane: PlaneEquation,
  geom: TunnelSpatialGeometry
): Vec3D[] {
  const { a, b, c, d } = plane;
  const eps = 1e-6;

  const customPoly = getCrossSectionVerticesInTunnelFrame(geom);

  // The edges of the tunnel envelope in (X, Y, Z)
  const edges: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][] = [];

  if (customPoly.length >= 3) {
    const n = customPoly.length;
    for (let i = 0; i < n; i++) {
      const p0 = customPoly[i];
      const p1 = customPoly[(i + 1) % n];

      // Cross section perimeter at portal entrance (X = 0)
      edges.push([
        { x: 0, y: p0.y, z: p0.z },
        { x: 0, y: p1.y, z: p1.z },
      ]);

      // Cross section perimeter at excavation face (X = pullLengthM)
      edges.push([
        { x: geom.pullLengthM, y: p0.y, z: p0.z },
        { x: geom.pullLengthM, y: p1.y, z: p1.z },
      ]);

      // Longitudinal generator rail parallel to X
      edges.push([
        { x: 0, y: p0.y, z: p0.z },
        { x: geom.pullLengthM, y: p0.y, z: p0.z },
      ]);
    }
  } else {
    const xMin = 0, xMax = geom.pullLengthM;
    const yMin = 0, yMax = geom.widthM;
    const zMin = 0, zMax = geom.heightM;

    // 4 edges parallel to X (longitudinal)
    edges.push(
      [{ x: xMin, y: yMin, z: zMin }, { x: xMax, y: yMin, z: zMin }],
      [{ x: xMin, y: yMax, z: zMin }, { x: xMax, y: yMax, z: zMin }],
      [{ x: xMin, y: yMin, z: zMax }, { x: xMax, y: yMin, z: zMax }],
      [{ x: xMin, y: yMax, z: zMax }, { x: xMax, y: yMax, z: zMax }]
    );
    // 4 edges parallel to Y (transverse)
    edges.push(
      [{ x: xMin, y: yMin, z: zMin }, { x: xMin, y: yMax, z: zMin }],
      [{ x: xMax, y: yMin, z: zMin }, { x: xMax, y: yMax, z: zMin }],
      [{ x: xMin, y: yMin, z: zMax }, { x: xMin, y: yMax, z: zMax }],
      [{ x: xMax, y: yMin, z: zMax }, { x: xMax, y: yMax, z: zMax }]
    );
    // 4 edges parallel to Z (vertical)
    edges.push(
      [{ x: xMin, y: yMin, z: zMin }, { x: xMin, y: yMin, z: zMax }],
      [{ x: xMax, y: yMin, z: zMin }, { x: xMax, y: yMin, z: zMax }],
      [{ x: xMin, y: yMax, z: zMin }, { x: xMin, y: yMax, z: zMax }],
      [{ x: xMax, y: yMax, z: zMin }, { x: xMax, y: yMax, z: zMax }]
    );
  }

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
// 6. TWO-PLANE INTERSECTION LINE (Trend & Plunge)
// ----------------------------------------------------------------------------

export function calculateJointPairIntersection(
  plane1: PlaneEquation,
  plane2: PlaneEquation,
  driveAzimuthDeg?: number
): JointPairIntersectionResult {
  const n1 = plane1.normal;
  const n2 = plane2.normal;

  // Cross product n1 x n2 in (X, Y, Z)
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

  // Make sure vector plunges downwards (lz <= 0)
  if (lz > 0) {
    lx = -lx;
    ly = -ly;
    lz = -lz;
  }

  // Plunge is vertical angle below horizontal: plunge = arcsin(|lz|)
  const plungeDeg = Number(radToDeg(Math.asin(Math.abs(lz))).toFixed(1));

  // Trend in local horizontal (X, Y) plane measured clockwise from +X:
  // lx is forward (+X), ly is right (+Y) -> trend = atan2(ly, lx)
  let trendDeg = normalizeAngle360(radToDeg(Math.atan2(ly, lx)));

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
// 7. DISCREPANCY CHECKER FOR LINKED OBSERVATIONS
// ----------------------------------------------------------------------------

export function checkTraceDiscrepancy(
  sourceOrientation: StrikeConventionResult,
  targetObservedTraceAngleDeg: number,
  targetPanel: FieldPanelId
): { hasDiscrepancy: boolean; warning?: string } {
  if (targetPanel === 'crown') {
    // Target is crown: compare observed strike angle with source strike axis
    const obsStrike = normalizeAngle360(targetObservedTraceAngleDeg);
    const sourceS1 = sourceOrientation.strikeRhrDeg;
    const sourceS2 = sourceOrientation.strikeAltDeg;
    const diff1 = Math.min(Math.abs(obsStrike - sourceS1), 360 - Math.abs(obsStrike - sourceS1));
    const diff2 = Math.min(Math.abs(obsStrike - sourceS2), 360 - Math.abs(obsStrike - sourceS2));
    const minDiff = Math.min(diff1, diff2);

    if (minDiff > 15) {
      return {
        hasDiscrepancy: true,
        warning: `Discrepancy Warning: Observed Crown strike (${Math.round(obsStrike)}°) differs by ${Math.round(minDiff)}° from the projected plane strike (${sourceOrientation.strikePairLabel}). Review orientation source before linking.`,
      };
    }
  }
  return { hasDiscrepancy: false };
}

// ----------------------------------------------------------------------------
// 8. AUTOMATED GEOMETRIC VALIDATION TEST SUITE (Section 13)
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
 * Runs the comprehensive automated verification test suite to ensure mathematical consistency,
 * correct unit vectors, orthogonal strike/dip/normal, proper 180° strike separation,
 * and robust surface intersections.
 */
export function runJointEngineValidationTests(): EngineValidationReport {
  const tests: EngineValidationReport['tests'] = [];

  // Test 1: 000°/00° Horizontal Plane
  {
    const p = constructJointPlane(0, 0, { x: 2, y: 4, z: 3 });
    const passed =
      Math.abs(p.normal.z - 1) < 1e-4 &&
      Math.abs(p.normal.x) < 1e-4 &&
      Math.abs(p.normal.y) < 1e-4;
    tests.push({
      testName: '000°/00° Horizontal Plane Normal Vector',
      passed,
      details: `Expected Normal (0, 0, 1); Computed: (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)})`,
    });
  }

  // Test 2: 000°/90° Vertical Plane (Dips Forward along +X)
  {
    const st = calculateStrikeFromDipDirection(0, 90);
    const p = constructJointPlane(0, 90, { x: 2, y: 4, z: 3 });
    const strikeDiff = Math.abs((st.strikeAltDeg - st.strikeRhrDeg + 360) % 360 - 180);
    const passed =
      Math.abs(p.normal.x - 1) < 1e-4 &&
      Math.abs(p.normal.y) < 1e-4 &&
      Math.abs(p.normal.z) < 1e-4 &&
      st.strikeRhrDeg === 270 &&
      st.strikeAltDeg === 90 &&
      strikeDiff < 1e-3;
    tests.push({
      testName: '000°/90° Forward Vertical Plane (Strike & Normal)',
      passed,
      details: `Expected Normal (1, 0, 0), Strike 270° & 090°; Computed Normal: (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)}), RHR: ${st.strikeRhrDeg}°, Alt: ${st.strikeAltDeg}°`,
    });
  }

  // Test 3: 090°/90° Vertical Plane (Dips Right along +Y)
  {
    const st = calculateStrikeFromDipDirection(90, 90);
    const p = constructJointPlane(90, 90, { x: 2, y: 4, z: 3 });
    const passed =
      Math.abs(p.normal.y - 1) < 1e-4 &&
      Math.abs(p.normal.x) < 1e-4 &&
      st.strikeRhrDeg === 0 &&
      st.strikeAltDeg === 180;
    tests.push({
      testName: '090°/90° Right Vertical Plane (Strike & Normal)',
      passed,
      details: `Expected Normal (0, 1, 0), Strike 000° & 180°; Computed: Normal (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)}), Strike ${st.strikeRhrDeg}° & ${st.strikeAltDeg}°`,
    });
  }

  // Test 4: 180°/90° Vertical Plane (Dips Backward along -X)
  {
    const st = calculateStrikeFromDipDirection(180, 90);
    const p = constructJointPlane(180, 90, { x: 2, y: 4, z: 3 });
    const passed =
      Math.abs(p.normal.x - (-1)) < 1e-4 &&
      st.strikeRhrDeg === 90 &&
      st.strikeAltDeg === 270;
    tests.push({
      testName: '180°/90° Backward Vertical Plane (Strike & Normal)',
      passed,
      details: `Expected Normal (-1, 0, 0), Strike 090° & 270°; Computed: Normal (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)}), Strike ${st.strikeRhrDeg}° & ${st.strikeAltDeg}°`,
    });
  }

  // Test 5: 270°/90° Vertical Plane (Dips Left along -Y)
  {
    const st = calculateStrikeFromDipDirection(270, 90);
    const p = constructJointPlane(270, 90, { x: 2, y: 4, z: 3 });
    const passed =
      Math.abs(p.normal.y - (-1)) < 1e-4 &&
      st.strikeRhrDeg === 180 &&
      st.strikeAltDeg === 0;
    tests.push({
      testName: '270°/90° Left Vertical Plane (Strike & Normal)',
      passed,
      details: `Expected Normal (0, -1, 0), Strike 180° & 000°; Computed: Normal (${p.normal.x.toFixed(2)}, ${p.normal.y.toFixed(2)}, ${p.normal.z.toFixed(2)}), Strike ${st.strikeRhrDeg}° & ${st.strikeAltDeg}°`,
    });
  }

  // Test 6: Oblique Plane 045°/60° (Unit Length & Orthogonality)
  {
    const p = constructJointPlane(45, 60, { x: 1.5, y: 4.0, z: 2.0 });
    const normLen = Math.hypot(p.normal.x, p.normal.y, p.normal.z);
    const dipLen = Math.hypot(p.dipVector.x, p.dipVector.y, p.dipVector.z);
    const strikeLen = Math.hypot(p.strikeVector.x, p.strikeVector.y, p.strikeVector.z);
    const dotNormDip = p.normal.x * p.dipVector.x + p.normal.y * p.dipVector.y + p.normal.z * p.dipVector.z;
    const dotNormStrike = p.normal.x * p.strikeVector.x + p.normal.y * p.strikeVector.y + p.normal.z * p.strikeVector.z;
    const passed =
      Math.abs(normLen - 1) < 1e-4 &&
      Math.abs(dipLen - 1) < 1e-4 &&
      Math.abs(strikeLen - 1) < 1e-4 &&
      Math.abs(dotNormDip) < 1e-4 &&
      Math.abs(dotNormStrike) < 1e-4;
    tests.push({
      testName: 'Oblique Plane 045°/60° Vectors (Unit Length & Orthogonality)',
      passed,
      details: `|n|=${normLen.toFixed(4)}, |v_dip|=${dipLen.toFixed(4)}, n·v_dip=${dotNormDip.toFixed(5)}, n·s=${dotNormStrike.toFixed(5)}`,
    });
  }

  // Test 7: Strike Values Differ by Exactly 180° Modulo 360°
  {
    const angles = [12, 45, 90, 137, 210, 270, 315, 359];
    const all180 = angles.every((a) => {
      const res = calculateStrikeFromDipDirection(a, 45);
      const diff = Math.abs((res.strikeAltDeg - res.strikeRhrDeg + 360) % 360);
      return Math.abs(diff - 180) < 1e-3;
    });
    tests.push({
      testName: 'Strike Values Exactly 180° Modulo 360° Invariant',
      passed: all180,
      details: `Tested across 8 azimuth angles [${angles.join(', ')}°]: all exactly 180° apart.`,
    });
  }

  // Test 8: Crown Strike Pair Formatting (e.g. 045° ↔ 225°)
  {
    const pair = getCrownStrikePair(45);
    const passed = pair.strike1 === 45 && pair.strike2 === 225 && pair.label === '045° ↔ 225°';
    tests.push({
      testName: 'Crown Strike Pair Dual-Arrow Format (045° ↔ 225°)',
      passed,
      details: `Expected '045° ↔ 225°'; Computed: '${pair.label}'`,
    });
  }

  // Test 9: Apparent Dip Matches Analytical Solutions
  {
    // East-dipping joint 090°/75° on tunnel drive 000°:
    // Face is perpendicular to strike (β=90°) -> Face Apparent = True Dip = 75°
    // Sidewalls are parallel to strike (β=0°) -> Sidewall Apparent = 0°
    const matrix = calculateSurfaceApparentTraceAngles(90, 75, 0);
    const passed =
      Math.abs(matrix.face.apparentDipDeg - 75) < 0.1 &&
      matrix.face.isTrueDip &&
      matrix.leftWall.apparentDipDeg === 0 &&
      matrix.leftWall.isHorizontal;
    tests.push({
      testName: 'Analytical Apparent Dip (090°/75° on 000° Drive)',
      passed,
      details: `Face apparent: ${matrix.face.apparentDipDeg}° (true=75°), Sidewall apparent: ${matrix.leftWall.apparentDipDeg}° (horiz=0°)`,
    });
  }

  // Test 10: Discrepancy Warning Triggers on Conflicting Observation
  {
    const sourceOri = calculateStrikeFromDipDirection(45, 60); // Strike is 315° ↔ 135°
    const discCheck = checkTraceDiscrepancy(sourceOri, 200, 'crown'); // 200° is 65° off strike
    const passed = discCheck.hasDiscrepancy && typeof discCheck.warning === 'string';
    tests.push({
      testName: 'Discrepancy Warning Detection on Conflicting Observations',
      passed,
      details: `Discrepancy triggered: ${discCheck.hasDiscrepancy}; Message: ${discCheck.warning?.slice(0, 75)}...`,
    });
  }

  // Test 11: Tunnel Bounding Envelope Plane Clipping Produces Valid Polygon
  {
    const geom: TunnelSpatialGeometry = {
      widthM: 8.0,
      heightM: 6.5,
      wallHeightM: 3.8,
      pullLengthM: 3.0,
    };
    const p = constructJointPlane(120, 55, { x: 1.5, y: 4.0, z: 3.0 });
    const verts = clipPlaneToTunnelBox(p, geom);
    const passed = verts.length >= 3;
    tests.push({
      testName: 'Tunnel Bounding Envelope 3D Plane Clipping',
      passed,
      details: `Computed ${verts.length} ordered 3D vertices within tunnel envelope.`,
    });
  }

  // Test 12: Multi-Surface Intersections Non-NaN & Valid Segments
  {
    const geom: TunnelSpatialGeometry = {
      widthM: 8.0,
      heightM: 6.5,
      wallHeightM: 3.8,
      pullLengthM: 3.0,
    };
    const p = constructJointPlane(60, 50, { x: 1.5, y: 4.0, z: 3.0 });
    const inters = calculatePlaneSurfaceIntersections(p, geom, 'face');
    const passed = inters.totalCalculatedM > 0 && !isNaN(inters.totalCalculatedM);
    tests.push({
      testName: 'Multi-Surface Mathematical Intersection Solver',
      passed,
      details: `Total calculated intersection extent: ${inters.totalCalculatedM}m across surfaces.`,
    });
  }

  const allTestsPassed = tests.every((t) => t.passed);
  return { allTestsPassed, tests };
}

// ----------------------------------------------------------------------------
// 6. TRACE HINGE-AXIS ROTATION & FRACTURE INTENSITY / OCCUPIED AREA SOLVER
// ----------------------------------------------------------------------------

export interface JointFractureIntensityAndAreaResult {
  traceLengthM: number;
  activeTraceLengthM: number;
  expectedDiameterM: number;
  equivalentBaecherDiscDiameterM: number;
  occupiedAreaM2: number;
  faceAreaM2: number;
  p21TraceIntensityM_M2: number;
  p21TraceLengthIntensity: number;
  excavationVolumeM3: number;
  tunnelExcavationVolumeM3: number;
  p32VolumetricIntensityM2_M3: number;
  p32VolumetricAreaIntensity: number;
  palmstromJv: number;
  estimatedRqd: number;
  palmstromRqdPct: number;
  allFaceTracesCount: number;
  totalFaceTracesLengthM: number;
  totalOccupiedAreaM2: number;
}

/**
 * Calculates 2D Fracture Trace Length Intensity (P21, ISRM / Dershowitz 1984),
 * Discontinuity Disc Occupied Area (Warburton 1980 / Baecher Disc Model),
 * Volumetric Fracture Intensity (P32, Dershowitz & Herda 1992),
 * and Palmström (1995) Volumetric Joint Count (Jv) and empirical RQD.
 */
export function calculateJointFractureIntensityAndArea(
  activeJointPoints: FieldPoint2D[],
  allJoints: FieldJointTrace[],
  geom: TunnelSpatialGeometry,
  activePanel: FieldPanelId = 'face'
): JointFractureIntensityAndAreaResult {
  const w = Math.max(1, geom.widthM || 8.0);
  const h = Math.max(1, geom.heightM || 6.5);
  const pullM = Math.max(0.5, geom.pullLengthM || 3.0);

  // Surface exposure area for current panel
  let exposureAreaM2 = Number((w * h * 0.88).toFixed(2));
  if (activePanel === 'left_wall' || activePanel === 'right_wall') {
    exposureAreaM2 = Number(((geom.wallHeightM || 3.8) * pullM).toFixed(2));
  } else if (activePanel === 'crown') {
    // Arch perimeter * pullM
    const archPerimM = w * 1.35;
    exposureAreaM2 = Number((archPerimM * pullM).toFixed(2));
  }

  const excavationVolumeM3 = Number(((w * h * 0.88) * pullM).toFixed(2));

  // Compute active joint trace length
  const activeLengthM = calculatePolylineLengthM(activeJointPoints, activePanel, geom);
  // Warburton (1980) & Baecher Disc Model: E[D] = (4 / pi) * L_trace
  const activeExpectedDiameterM = Number(((4 / Math.PI) * activeLengthM).toFixed(2));
  // Disc area: A = (pi/4) * D^2 = (4 / pi) * L_trace^2
  const activeOccupiedAreaM2 = Number(((4 / Math.PI) * activeLengthM * activeLengthM).toFixed(2));

  // Traces on active panel
  const panelTraces = allJoints.filter((j) => (j.panel || 'face') === activePanel && j.points.length >= 2);
  let totalPanelLengthM = 0;
  let totalOccupiedAreaM2 = 0;

  panelTraces.forEach((t) => {
    const lM = calculatePolylineLengthM(t.points, activePanel, geom);
    totalPanelLengthM += lM;
    totalOccupiedAreaM2 += (4 / Math.PI) * lM * lM;
  });

  if (panelTraces.length === 0 && activeLengthM > 0) {
    totalPanelLengthM = activeLengthM;
    totalOccupiedAreaM2 = activeOccupiedAreaM2;
  }

  // P21: Trace length per unit area of panel surface (m/m2)
  const p21TraceIntensityM_M2 = Number(
    (totalPanelLengthM / Math.max(0.1, exposureAreaM2)).toFixed(3)
  );

  // P32: Fracture area per unit volume of rock mass (m2/m3)
  const p32VolumetricIntensityM2_M3 = Number(
    (totalOccupiedAreaM2 / Math.max(0.1, excavationVolumeM3)).toFixed(3)
  );

  // Palmström (1995) Volumetric Joint Count Jv = 1.15 * P21
  const palmstromJv = Number((1.15 * p21TraceIntensityM_M2).toFixed(2));
  const estimatedRqd = Math.max(10, Math.min(100, Math.round(115 - 3.3 * palmstromJv)));

  return {
    traceLengthM: Number(activeLengthM.toFixed(2)),
    activeTraceLengthM: Number(activeLengthM.toFixed(2)),
    expectedDiameterM: activeExpectedDiameterM,
    equivalentBaecherDiscDiameterM: activeExpectedDiameterM,
    occupiedAreaM2: activeOccupiedAreaM2,
    faceAreaM2: exposureAreaM2,
    p21TraceIntensityM_M2,
    p21TraceLengthIntensity: p21TraceIntensityM_M2,
    excavationVolumeM3,
    tunnelExcavationVolumeM3: excavationVolumeM3,
    p32VolumetricIntensityM2_M3,
    p32VolumetricAreaIntensity: p32VolumetricIntensityM2_M3,
    palmstromJv,
    estimatedRqd,
    palmstromRqdPct: estimatedRqd,
    allFaceTracesCount: Math.max(panelTraces.length, activeLengthM > 0 ? 1 : 0),
    totalFaceTracesLengthM: Number(totalPanelLengthM.toFixed(2)),
    totalOccupiedAreaM2: Number(totalOccupiedAreaM2.toFixed(2)),
  };
}

export interface FaceTraceHingePlaneResult extends PlaneEquation {
  panel?: FieldPanelId;
  hingeAxis: Vec3D;
  traceStartPoint: Vec3D;
  traceEndPoint: Vec3D;
  traceMidPoint: Vec3D;
  traceLengthM: number;
  hingeDipDeg: number;
  derivedDipDeg: number;
  derivedDipDirectionDeg: number;
  strikeRhrDeg: number;
  directionSide: 'heading' | 'collar';
}

export type TraceHingePlaneResult = FaceTraceHingePlaneResult;

/**
 * Converts 2D canvas point on any tunnel panel to 3D metric coordinates.
 */
export function pointToTunnel3DMetric(
  pt: FieldPoint2D,
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): Vec3D {
  let panelW = geom.widthM || 8.0;
  let panelH = geom.heightM || 6.5;
  if (panel === 'crown') {
    panelW = geom.widthM || 8.0;
    panelH = geom.pullLengthM || 3.0;
  } else if (panel === 'left_wall' || panel === 'right_wall') {
    panelW = geom.pullLengthM || 3.0;
    panelH = geom.wallHeightM || 3.8;
  }
  const maxBoxW = 845;
  const maxBoxH = 810;
  const pxPerMeter = Math.min(maxBoxW / Math.max(0.5, panelW), maxBoxH / Math.max(0.5, panelH));
  const boxW = panelW * pxPerMeter;
  const boxH = panelH * pxPerMeter;
  const boxX = 500 - boxW / 2;
  const boxY = 495 - boxH / 2;

  const uNorm = Math.max(0, Math.min(1, (pt.x - boxX) / Math.max(1, boxW)));
  const vNorm = Math.max(0, Math.min(1, (pt.y - boxY) / Math.max(1, boxH)));

  switch (panel) {
    case 'face': {
      return {
        x: geom.pullLengthM || 3.0,
        y: Math.max(0.05, Math.min((geom.widthM || 8.0) - 0.05, uNorm * (geom.widthM || 8.0))),
        z: Math.max(0.05, Math.min((geom.heightM || 6.5) - 0.05, (1 - vNorm) * (geom.heightM || 6.5))),
      };
    }
    case 'left_wall': {
      return {
        x: Math.max(0, Math.min(geom.pullLengthM || 3.0, uNorm * (geom.pullLengthM || 3.0))),
        y: 0,
        z: Math.max(0.05, Math.min(geom.wallHeightM || 3.8, (1 - vNorm) * (geom.wallHeightM || 3.8))),
      };
    }
    case 'right_wall': {
      return {
        x: Math.max(0, Math.min(geom.pullLengthM || 3.0, uNorm * (geom.pullLengthM || 3.0))),
        y: geom.widthM || 8.0,
        z: Math.max(0.05, Math.min(geom.wallHeightM || 3.8, (1 - vNorm) * (geom.wallHeightM || 3.8))),
      };
    }
    case 'crown': {
      const w = geom.widthM || 8.0;
      const pull = geom.pullLengthM || 3.0;
      const my = Math.max(0.05, Math.min(w - 0.05, uNorm * w));
      const mx = Math.max(0, Math.min(pull, (1 - vNorm) * pull));
      const cx = w / 2;
      const hw = geom.wallHeightM || ((geom.heightM || 6.5) * 0.55);
      const archRise = Math.max(0.5, (geom.heightM || 6.5) - hw);
      const dy = (my - cx) / Math.max(0.1, w / 2);
      const clampedDy = Math.max(-1, Math.min(1, dy));
      const trueArchZ = hw + archRise * Math.sqrt(Math.max(0, 1 - clampedDy * clampedDy));
      return {
        x: Number(mx.toFixed(3)),
        y: Number(my.toFixed(3)),
        z: Number(trueArchZ.toFixed(3)),
      };
    }
    default:
      return {
        x: geom.pullLengthM || 3.0,
        y: (geom.widthM || 8.0) / 2,
        z: (geom.heightM || 6.5) / 2,
      };
  }
}

/**
 * Constructs a 3D discontinuity plane strictly passing through the 2D traced line
 * on any mapped panel (face, left_wall, right_wall, or crown).
 * - For Face: The traced line acts as the stationary hinge on the advance face.
 * - For Walls: The traced line acts as the stationary hinge on the sidewall, pivoting into rock mass or tunnel.
 * - For Crown: Tilts based directly on chosen dip amount around the crown trace axis.
 */
export function constructPlaneFromTraceHinge(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  hingeDipDeg: number,
  directionSide: 'heading' | 'collar' = 'heading',
  geom: TunnelSpatialGeometry
): TraceHingePlaneResult {
  const pFirst = points[0] || { x: 300, y: 300 };
  const pLast = points[points.length - 1] || { x: 700, y: 500 };

  const p1 = pointToTunnel3DMetric(pFirst, panel, geom);
  const p2 = pointToTunnel3DMetric(pLast, panel, geom);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const traceLen = Math.hypot(dx, dy, dz) || 1e-4;

  const ux = dx / traceLen;
  const uy = dy / traceLen;
  const uz = dz / traceLen;
  const hingeAxis: Vec3D = { x: ux, y: uy, z: uz };

  const midPoint: Vec3D = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  };

  const dipAngle = Math.max(0.5, Math.min(89.5, hingeDipDeg));
  const thetaRad = degToRad(dipAngle);
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  let nx = 0;
  let ny = 0;
  let nz = 1;
  let vx = 0;
  let vy = 0;
  let vz = 0;

  if (panel === 'face') {
    // Face (X = pullM): Hinge vector (0, uy, uz)
    const wy = -uz;
    const wz = uy;
    const sgnX = directionSide === 'heading' ? 1 : -1;
    vx = sgnX * sinT;
    vy = wy * cosT;
    vz = wz * cosT;

    // Normal = hingeAxis x v
    nx = uy * vz - uz * vy;
    ny = uz * vx;
    nz = -uy * vx;
  } else if (panel === 'left_wall') {
    // Left Wall (Y = 0): Hinge vector (ux, 0, uz)
    const wx = -uz;
    const wz = ux;
    // directionSide: 'heading' -> dips into rock mass (+Y away from tunnel)
    // 'collar' -> dips into tunnel cavity (-Y)
    const sgnY = directionSide === 'heading' ? 1 : -1;
    vx = wx * cosT;
    vy = sgnY * sinT;
    vz = wz * cosT;

    // Normal = hingeAxis x v
    nx = -uz * vy;
    ny = uz * vx - ux * vz;
    nz = ux * vy;
  } else if (panel === 'right_wall') {
    // Right Wall (Y = widthM): Hinge vector (ux, 0, uz)
    const wx = -uz;
    const wz = ux;
    // directionSide: 'heading' -> dips into rock mass (-Y away from tunnel)
    // 'collar' -> dips into tunnel cavity (+Y)
    const sgnY = directionSide === 'heading' ? -1 : 1;
    vx = wx * cosT;
    vy = sgnY * sinT;
    vz = wz * cosT;

    // Normal = hingeAxis x v
    nx = -uz * vy;
    ny = uz * vx - ux * vz;
    nz = ux * vy;
  } else {
    // Crown (ceiling arch):
    // The user selects the dip amount directly. The plane tilts around the crown trace axis by dipAngle.
    // Build an orthonormal basis perpendicular to hingeAxis:
    const horizLen = Math.hypot(ux, uy);
    let e1: Vec3D;
    let e2: Vec3D;
    if (horizLen > 1e-4) {
      // e1 is horizontal and orthogonal to hingeAxis
      e1 = { x: uy / horizLen, y: -ux / horizLen, z: 0 };
      // e2 = hingeAxis x e1
      e2 = {
        x: (uy * 0 - uz * -ux / horizLen),
        y: (uz * uy / horizLen - ux * 0),
        z: (ux * -ux / horizLen - uy * uy / horizLen),
      };
    } else {
      e1 = { x: 1, y: 0, z: 0 };
      e2 = { x: 0, y: 1, z: 0 };
    }

    // Dip angle determines tilt relative to horizontal.
    // directionSide: 'heading' tilts towards heading (+X), 'collar' tilts backwards towards collar (-X)
    const sgnSide = directionSide === 'heading' ? 1 : -1;
    const normAngle = thetaRad * sgnSide;

    // Construct unit normal orthogonal to hingeAxis:
    nx = e1.x * Math.cos(normAngle) + e2.x * Math.sin(normAngle);
    ny = e1.y * Math.cos(normAngle) + e2.y * Math.sin(normAngle);
    nz = e1.z * Math.cos(normAngle) + e2.z * Math.sin(normAngle);

    // v vector = normal x hingeAxis
    vx = ny * uz - nz * uy;
    vy = nz * ux - nx * uz;
    vz = nx * uy - ny * ux;
  }

  const nLen = Math.hypot(nx, ny, nz) || 1;
  const na = nx / nLen;
  const nb = ny / nLen;
  const nc = nz / nLen;

  const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);

  // Geological Dip Angle: angle between normal and vertical Z
  const safeNc = Math.min(1, Math.max(-1, Math.abs(nc)));
  const derivedDipDeg = clampDip(radToDeg(Math.acos(safeNc)));

  // Dip direction azimuth in tunnel-relative coordinates:
  const signZ = nc >= 0 ? 1 : -1;
  const gradX = -na * signZ;
  const gradY = -nb * signZ;
  let relAz = radToDeg(Math.atan2(gradY, gradX));
  if (isNaN(relAz)) relAz = 0;
  if (relAz < 0) relAz += 360;
  const derivedDipDirectionDeg = normalizeAngle360(relAz + (geom?.driveAzimuthDeg || 0));
  const strikeRhrDeg = normalizeAngle360(derivedDipDirectionDeg - 90);

  return {
    panel,
    a: na,
    b: nb,
    c: nc,
    d,
    normal: { x: na, y: nb, z: nc },
    dipVector: { x: vx, y: vy, z: vz },
    strikeVector: hingeAxis,
    hingeAxis,
    traceStartPoint: p1,
    traceEndPoint: p2,
    traceMidPoint: midPoint,
    traceLengthM: Number(traceLen.toFixed(2)),
    hingeDipDeg: dipAngle,
    derivedDipDeg,
    derivedDipDirectionDeg,
    strikeRhrDeg,
    directionSide,
  };
}

/**
 * Backwards-compatible wrapper for face traces.
 */
export function constructPlaneFromFaceTraceHinge(
  points: FieldPoint2D[],
  hingeDipDeg: number,
  directionSide: 'heading' | 'collar' = 'heading',
  geom: TunnelSpatialGeometry
): FaceTraceHingePlaneResult {
  return constructPlaneFromTraceHinge(points, 'face', hingeDipDeg, directionSide, geom);
}


