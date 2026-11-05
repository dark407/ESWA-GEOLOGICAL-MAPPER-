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

import type { FieldPanelId, FieldPoint2D, FieldJointTrace } from './fieldMappingEngine';

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
  tunnelShape?:
    | 'd_shaped'
    | 'horseshoe'
    | 'modified_horseshoe'
    | 'circular'
    | 'rectangular'
    | 'freeform_custom'
    | 'open_slush_no_left'
    | 'open_slush_no_right'
    | 'open_slush_no_crown';
  crownRadiusM?: number;
  crossSectionPoints?: { x: number; y: number }[];
  customProfile?: any;
  hasLeftWall?: boolean;
  hasRightWall?: boolean;
  hasCrown?: boolean;
  hasInvert?: boolean;
  isClosed?: boolean;
  leftWallHeightM?: number;
  rightWallHeightM?: number;
  isVerticalShaft?: boolean;
  mappingDomain?: string;
  excavationApproach?: string;
  shaftHalfSide?: 'left_half' | 'right_half';
  shaftCenterMedianStatus?: 'closed' | 'open';
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
  curvedPoints?: { x: number; y: number }[]; // Multi-point curved intersection in panel metric space
  curvedPoints3D?: Vec3D[]; // Multi-point 3D intersection along the arched crown surface
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
  const relDd = normalizeAngle360(dd - drive);
  const strikeInfo = calculateStrikeFromDipDirection(dd, dip);
  const strike = strikeInfo.strikeRhrDeg;

  // 1. Excavation Face: Vertical wall perpendicular to Drive Axis
  // The face cross-line runs along azimuth (Drive + 90°)
  const faceLineAz = normalizeAngle360(drive + 90);
  let betaFace = Math.abs(strike - faceLineAz) % 180;
  if (betaFace > 90) betaFace = 180 - betaFace;

  const dipRad = degToRad(dip);
  const betaFaceRad = degToRad(betaFace);
  const appFaceDeg =
    dip >= 89.9
      ? betaFace < 0.5
        ? 0
        : 90
      : Number(radToDeg(Math.atan(Math.tan(dipRad) * Math.sin(betaFaceRad))).toFixed(1));

  const isFaceTrueDip = Math.abs(betaFace - 90) < 0.5;
  const isFaceHorizontal = betaFace < 0.5 || dip === 0;

  // Determine direction of dip across face (Left to Right looking at Face)
  // Local Y component in tunnel-relative frame: dy = sin(relDd)
  const dy = Math.sin(degToRad(relDd)) * (dip >= 89.9 ? 1 : Math.cos(dipRad));
  let faceDirLabel = 'Horizontal (0° trace)';
  if (!isFaceHorizontal) {
    if (dip >= 89.9 || Math.abs(dy) < 0.02) {
      faceDirLabel = `Vertical / Steep (${appFaceDeg}°)`;
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
  const appWallDeg =
    dip >= 89.9
      ? betaWall < 0.5
        ? 0
        : 90
      : Number(radToDeg(Math.atan(Math.tan(dipRad) * Math.sin(betaWallRad))).toFixed(1));

  const isWallTrueDip = Math.abs(betaWall - 90) < 0.5;
  const isWallHorizontal = betaWall < 0.5 || dip === 0;

  // Plunge along sidewall (Forward toward Face vs Backward toward Portal)
  // Local X component in tunnel-relative frame: dx = cos(relDd)
  const dx = Math.cos(degToRad(relDd)) * (dip >= 89.9 ? 1 : Math.cos(dipRad));
  let wallPlungeLabel = 'Horizontal trace (0°)';
  if (!isWallHorizontal) {
    if (dip >= 89.9 || Math.abs(dx) < 0.02) {
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
  const relStrike = normalizeAngle360(strike - drive);
  let crownAngleToAxis = Math.abs(relStrike - 0) % 180;
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
 * When driveAzimuthDeg is provided, geographic dipDirectionDeg is converted to
 * tunnel-relative horizontal azimuth: alpha = normalizeAngle360(dipDirectionDeg - driveAzimuthDeg).
 * At dip = 90° (vertical plane), normal n = (cos(alpha), sin(alpha), 0) points strictly
 * toward dipDirectionDeg with zero 180° flip.
 */
export function constructJointPlane(
  dipDirectionDeg: number,
  dipDeg: number,
  anchorPoint: Vec3D,
  driveAzimuthDeg?: number
): PlaneEquation {
  const dd = normalizeAngle360(dipDirectionDeg ?? 135);
  const drive = driveAzimuthDeg != null && !isNaN(driveAzimuthDeg) ? normalizeAngle360(driveAzimuthDeg) : 0;
  const relDd = normalizeAngle360(dd - drive);
  const dip = clampDip(dipDeg ?? 60);

  const alphaRad = degToRad(relDd);
  const deltaRad = degToRad(dip);
  const cosAlpha = Math.cos(alphaRad);
  const sinAlpha = Math.sin(alphaRad);
  // At dip = 90°, enforce exact cos(90°) = 0 and sin(90°) = 1 to avoid floating-point sign noise
  const cosDelta = dip >= 89.99 ? 0 : Math.cos(deltaRad);
  const sinDelta = dip >= 89.99 ? 1 : Math.sin(deltaRad);

  // Dip vector (downward):
  const dx = cosAlpha * cosDelta;
  const dy = sinAlpha * cosDelta;
  const dz = -sinDelta;

  // Strike vector (horizontal along alpha - 90°, Right-Hand Rule):
  const sx = sinAlpha;
  const sy = -cosAlpha;
  const sz = 0;

  // Upward plane normal n = (a, b, c):
  // For dip=0 (horizontal plane): n = (0, 0, 1) [pointing upward +Z]
  // For dip=90 (vertical plane): n = (cos alpha, sin alpha, 0) [pointing strictly toward dipDirection]
  const a = cosAlpha * sinDelta;
  const b = sinAlpha * sinDelta;
  const c = cosDelta;

  // Normalize normal vector:
  const len = Math.hypot(a, b, c) || 1;
  const na = a / len;
  const nb = b / len;
  const nc = Math.max(0, c / len);

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
  const isVertShaft = Boolean(geom.isVerticalShaft);
  const D = geom.widthM || 8.0;
  const R = D / 2;
  const pullL = geom.pullLengthM || 3.0;
  const quadrantArcM = Number(((Math.PI * D) / 4).toFixed(2));

  let panelW = geom.widthM;
  let panelH = geom.heightM;
  if (isVertShaft) {
    if (panel === 'face') {
      panelW = D;
      panelH = D;
    } else {
      panelW = quadrantArcM;
      panelH = pullL;
    }
  } else if (panel === 'crown') {
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

  if (isVertShaft) {
    if (panel === 'face') {
      // Shaft Bottom Face at Z = 0.02 (horizontally at the bottom of the bowl, Pull 0m)
      // Three.js maps: X_three = y (West-East 0..D), Y_three = z (Vertical 0..pullL), Z_three = x (North-South 0..D)
      const my = Math.max(0.05, Math.min(D - 0.05, uNorm * D));
      const mx = Math.max(0.05, Math.min(D - 0.05, vNorm * D));
      return {
        x: Number(mx.toFixed(3)),
        y: Number(my.toFixed(3)),
        z: 0.02,
      };
    }
    // 4 Quadrant Walls rising vertically around cylinder perimeter from Z = 0 (Pull 0m bottom) to Z = pullL (Pull 3m top rim)
    let startDeg = 0;
    if (panel === 'left_wall') startDeg = 0; // Q1: NE (0°–90°)
    else if (panel === 'crown') startDeg = 90; // Q2: ES (90°–180°)
    else if (panel === 'right_wall') startDeg = 180; // Q3: SW (180°–270°)
    else startDeg = 270; // Q4: WN (270°–360°)
    const deg = startDeg + uNorm * 90;
    const rad = (deg * Math.PI) / 180;
    const my = R + R * Math.sin(rad); // West (0) to East (D)
    const mx = R - R * Math.cos(rad); // North (0) to South (D)
    const mz = Math.max(0.02, Math.min(pullL, (1 - vNorm) * pullL)); // Pull 0m at bottom (vNorm=1) to pullL at top (vNorm=0)
    return {
      x: Number(mx.toFixed(3)),
      y: Number(my.toFixed(3)),
      z: Number(mz.toFixed(3)),
    };
  }

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
      // On Right Wall 2D canvas, Left (uNorm = 0) is Face (pullLengthM) and Right (uNorm = 1) is Portal (0m)
      const mx = (1 - uNorm) * geom.pullLengthM;
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

      const isFlatSurface =
        geom.tunnelShape === 'rectangular' ||
        Boolean(geom.mappingDomain && geom.mappingDomain !== 'TUNNEL');
      // Calculate true arched roof elevation at transverse position Y (my):
      const cx = geom.widthM / 2;
      const hw = geom.wallHeightM || (geom.heightM * 0.55);
      const archRise = Math.max(0.5, geom.heightM - hw);
      const dy = (my - cx) / Math.max(0.1, geom.widthM / 2);
      const clampedDy = Math.max(-1, Math.min(1, dy));
      const trueArchZ = isFlatSurface
        ? geom.heightM
        : hw + archRise * Math.sqrt(Math.max(0, 1 - clampedDy * clampedDy));

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

  let totalMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = pointToTunnel3DMetric(points[i], panel, geom);
    const p2 = pointToTunnel3DMetric(points[i + 1], panel, geom);
    totalMeters += Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
  }

  return Number(Math.max(0.05, totalMeters).toFixed(2));
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
 * Builds the exact physical cross-section profile in tunnel-relative metric coordinates:
 * - Y = transverse horizontal [0, widthM] (Left Wall at 0 to Right Wall at widthM)
 * - Z = vertical elevation [0, heightM] (Invert at 0 to Crown Apex at heightM)
 * Supports all configured tunnel shapes: 'd_shaped', 'horseshoe', 'modified_horseshoe',
 * 'circular', 'rectangular', 'freeform_custom', 'open_slush_*', asymmetric left/right wall heights,
 * and open/unclosed custom portions.
 */
export function buildTunnelCrossSectionProfileMetric(
  geom: TunnelSpatialGeometry
): {
  points: { y: number; z: number }[];
  isClosed: boolean;
  getRoofZAtY: (yVal: number) => number;
} {
  const w = Math.max(0.5, geom.widthM || 8.0);
  const h = Math.max(0.5, geom.heightM || 6.5);
  const baseHw = Math.max(0.2, Math.min(h * 0.92, geom.wallHeightM || h * 0.55));
  const leftHw = Math.max(0.2, Math.min(h * 0.95, geom.leftWallHeightM ?? baseHw));
  const rightHw = Math.max(0.2, Math.min(h * 0.95, geom.rightWallHeightM ?? baseHw));
  const shape = geom.tunnelShape || 'd_shaped';
  const hasLeftWall = geom.hasLeftWall !== false && shape !== 'open_slush_no_left';
  const hasRightWall = geom.hasRightWall !== false && shape !== 'open_slush_no_right';
  const hasCrown = geom.hasCrown !== false && shape !== 'open_slush_no_crown';
  const hasInvert = geom.hasInvert !== false;
  const isClosed =
    geom.isClosed !== undefined
      ? geom.isClosed
      : hasLeftWall && hasRightWall && hasCrown && hasInvert;

  const getRoofZAtY = (yVal: number): number => {
    const clampedY = Math.max(0, Math.min(w, yVal));
    if (shape === 'rectangular') {
      return h;
    }
    if (shape === 'circular') {
      const rx = w / 2;
      const ry = h / 2;
      const normDy = Math.max(-1, Math.min(1, (clampedY - rx) / Math.max(0.1, rx)));
      return ry + ry * Math.sqrt(Math.max(0, 1 - normDy * normDy));
    }
    const t = clampedY / Math.max(0.1, w);
    const localSpringZ = leftHw * (1 - t) + rightHw * t;
    const localRise = Math.max(0.1, h - localSpringZ);
    const normDy = Math.max(-1, Math.min(1, (clampedY - w / 2) / Math.max(0.1, w / 2)));
    return localSpringZ + localRise * Math.sqrt(Math.max(0, 1 - normDy * normDy));
  };

  // 1. Explicit custom cross-section points (already in metric or normalized space)
  if (geom.crossSectionPoints && geom.crossSectionPoints.length >= 2) {
    const rawPts = geom.crossSectionPoints;
    const minX = Math.min(...rawPts.map((p) => p.x));
    const maxX = Math.max(...rawPts.map((p) => p.x));
    const minY = Math.min(...rawPts.map((p) => p.y));
    const maxY = Math.max(...rawPts.map((p) => p.y));
    const spanX = Math.max(0.01, maxX - minX);
    const spanY = Math.max(0.01, maxY - minY);

    const mapped = rawPts.map((pt) => ({
      y: Number((((pt.x - minX) / spanX) * w).toFixed(3)),
      z: Number((((pt.y - minY) / spanY) * h).toFixed(3)),
    }));

    return {
      points: mapped,
      isClosed,
      getRoofZAtY: (yVal: number) => {
        const clampedY = Math.max(0, Math.min(w, yVal));
        let maxZ = getRoofZAtY(clampedY);
        for (let i = 0; i < mapped.length - 1; i++) {
          const p0 = mapped[i];
          const p1 = mapped[i + 1];
          const minSegY = Math.min(p0.y, p1.y);
          const maxSegY = Math.max(p0.y, p1.y);
          if (clampedY >= minSegY - 0.05 && clampedY <= maxSegY + 0.05) {
            const denom = p1.y - p0.y;
            const frac = Math.abs(denom) > 1e-4 ? Math.max(0, Math.min(1, (clampedY - p0.y) / denom)) : 0.5;
            const zAt = p0.z + frac * (p1.z - p0.z);
            if (zAt > h * 0.45) {
              maxZ = Math.max(zAt, h * 0.5);
            }
          }
        }
        return Math.min(h, maxZ);
      },
    };
  }

  // 2. Circular tunnel cross-section
  if (shape === 'circular') {
    const rx = w / 2;
    const ry = h / 2;
    const pts: { y: number; z: number }[] = [];
    const segments = 64;
    // Start from bottom-center (w/2, 0), go clockwise up Left Wall, over Crown, down Right Wall
    for (let i = 0; i < segments; i++) {
      const ang = -Math.PI / 2 - (i / segments) * Math.PI * 2;
      pts.push({
        y: Number((rx + rx * Math.cos(ang)).toFixed(3)),
        z: Number((ry + ry * Math.sin(ang)).toFixed(3)),
      });
    }
    return { points: pts, isClosed: true, getRoofZAtY };
  }

  // 3. Rectangular box cross-section (or Surface Mapping face)
  if (shape === 'rectangular' || (geom.mappingDomain && geom.mappingDomain !== 'TUNNEL')) {
    const isSurface = Boolean(geom.mappingDomain && geom.mappingDomain !== 'TUNNEL');
    const r = isSurface ? 0 : Math.min(0.25, w * 0.04, h * 0.04);
    const pts: { y: number; z: number }[] = isSurface
      ? [
          { y: 0, z: 0 },
          { y: 0, z: h },
          { y: w, z: h },
          { y: w, z: 0 },
        ]
      : [
          { y: 0, z: 0 },
          { y: 0, z: Number((h - r).toFixed(3)) },
          { y: Number(r.toFixed(3)), z: h },
          { y: Number((w - r).toFixed(3)), z: h },
          { y: w, z: Number((h - r).toFixed(3)) },
          { y: w, z: 0 },
        ];
    return { points: pts, isClosed, getRoofZAtY };
  }

  // 4. Horseshoe or Modified Horseshoe cross-section
  if (shape === 'horseshoe' || shape === 'modified_horseshoe') {
    const inset = shape === 'horseshoe' ? Math.min(0.45, w * 0.06) : Math.min(0.22, w * 0.03);
    const ctrlOffset = shape === 'horseshoe' ? Math.min(0.16, w * 0.015) : Math.min(0.08, w * 0.008);
    const pts: { y: number; z: number }[] = [];
    const wallSteps = 20;
    const archSteps = 44;

    if (hasLeftWall) {
      for (let i = 0; i <= wallSteps; i++) {
        const t = i / wallSteps;
        const mt = 1 - t;
        const py = mt * mt * inset + 2 * mt * t * (-ctrlOffset) + t * t * 0;
        const pz = mt * mt * 0 + 2 * mt * t * (leftHw * 0.5) + t * t * leftHw;
        pts.push({
          y: Number(Math.max(0, py).toFixed(3)),
          z: Number(pz.toFixed(3)),
        });
      }
    } else {
      pts.push({ y: 0, z: leftHw });
    }

    if (hasCrown) {
      for (let i = 1; i < archSteps; i++) {
        const t = i / archSteps;
        const py = t * w;
        const pz = getRoofZAtY(py);
        pts.push({ y: Number(py.toFixed(3)), z: Number(pz.toFixed(3)) });
      }
    }

    if (hasRightWall) {
      for (let i = 0; i <= wallSteps; i++) {
        const t = i / wallSteps;
        const mt = 1 - t;
        const py = mt * mt * w + 2 * mt * t * (w + ctrlOffset) + t * t * (w - inset);
        const pz = mt * mt * rightHw + 2 * mt * t * (rightHw * 0.5) + t * t * 0;
        pts.push({
          y: Number(Math.min(w, py).toFixed(3)),
          z: Number(pz.toFixed(3)),
        });
      }
    } else {
      pts.push({ y: w, z: rightHw });
    }

    return { points: pts, isClosed, getRoofZAtY };
  }

  // 5. Default D-Shaped ('d_shaped' and 'open_slush_*') with exact left/right wall heights and crown arch
  const pts: { y: number; z: number }[] = [];
  if (hasLeftWall) {
    pts.push({ y: 0, z: 0 }, { y: 0, z: leftHw });
  } else {
    pts.push({ y: 0, z: leftHw });
  }

  if (hasCrown) {
    const archSteps = 44;
    for (let i = 1; i < archSteps; i++) {
      const t = i / archSteps;
      const py = t * w;
      const pz = getRoofZAtY(py);
      pts.push({ y: Number(py.toFixed(3)), z: Number(pz.toFixed(3)) });
    }
  }

  if (hasRightWall) {
    pts.push({ y: w, z: rightHw }, { y: w, z: 0 });
  } else {
    pts.push({ y: w, z: rightHw });
  }

  return { points: pts, isClosed, getRoofZAtY };
}

/**
 * Normalizes cross-section points to tunnel local frame:
 * Y = transverse horizontal [0, widthM]
 * Z = vertical elevation [0, heightM]
 */
export function getCrossSectionVerticesInTunnelFrame(
  geom: TunnelSpatialGeometry
): { y: number; z: number }[] {
  return buildTunnelCrossSectionProfileMetric(geom).points;
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
  const profileMetric = buildTunnelCrossSectionProfileMetric(geom);

  // 1. FACE (X = pullLengthM)
  // Equation in (Y, Z): b * Y + c * Z + (a * pullLengthM + d) = 0
  const faceC = a * geom.pullLengthM + d;
  const customFacePoly = profileMetric.points;
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

  // 4. CROWN ARCH (Curved Vault Surface Z = Z_arch(Y), or flat Berm/Floor in Surface Mapping)
  let crownSeg: SurfaceIntersectionSegment | undefined;
  if (geom.hasCrown !== false) {
    const w = Math.max(0.5, geom.widthM || 8.0);
    const pullL = Math.max(0.5, geom.pullLengthM || 3.0);
    const h = Math.max(1.0, geom.heightM || 6.5);
    const isFlatSurface =
      geom.tunnelShape === 'rectangular' ||
      Boolean(geom.mappingDomain && geom.mappingDomain !== 'TUNNEL');
    const hw = isFlatSurface ? h : geom.wallHeightM || h * 0.55;
    const archRise = isFlatSurface ? 0 : Math.max(0.4, h - hw);

    // Sample across the crown arch and solve for plane intersection a*X + b*Y + c*Z_arch(Y) + d = 0
    const curvedPts2D: { x: number; y: number }[] = [];
    const curvedPts3D: Vec3D[] = [];
    const nSamples = 24;

    if (Math.abs(a) > 0.08) {
      // Parameterize by transverse width Y across [0, w]
      for (let i = 0; i <= nSamples; i++) {
        const yVal = (i / nSamples) * w;
        const zArch = profileMetric.getRoofZAtY(yVal);
        const xVal = (-b * yVal - c * zArch - d) / a;
        if (xVal >= -0.02 && xVal <= pullL + 0.02) {
          const cx = Math.max(0, Math.min(pullL, Number(xVal.toFixed(3))));
          const cy = Number(yVal.toFixed(3));
          const cz = Number(zArch.toFixed(3));
          curvedPts2D.push({ x: cx, y: cy });
          curvedPts3D.push({ x: cx, y: cy, z: cz });
        }
      }
    }

    // Fallback or near-longitudinal strike (|a| <= 0.08): clip at representative crown elevation and curve along arch
    if (curvedPts2D.length < 2) {
      const crownC = c * (hw + archRise * 0.82) + d;
      const crownClip = clipLineToRect(a, b, crownC, 0, pullL, 0, w);
      if (crownClip) {
        const p1 = crownClip.p1;
        const p2 = crownClip.p2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const chordLen = Math.hypot(dx, dy) || 1;
        // Normal in (X, Y) pointing toward dip direction
        const horizNormLen = Math.hypot(a, b) || 1;
        const dipDirX = (a * (c >= 0 ? 1 : -1)) / horizNormLen;
        const dipDirY = (b * (c >= 0 ? 1 : -1)) / horizNormLen;
        const cotDip = Math.min(1.6, Math.abs(c) / Math.max(0.15, horizNormLen));
        const maxSag = isFlatSurface
          ? 0
          : Math.min(pullL * 0.28, w * 0.22, archRise * 0.35 * cotDip * (chordLen / Math.max(w, pullL)));

        curvedPts2D.length = 0;
        curvedPts3D.length = 0;
        for (let i = 0; i <= nSamples; i++) {
          const t = i / nSamples;
          const archFactor = 4 * t * (1 - t); // 0 at ends, 1 at center
          const cx = Math.max(0, Math.min(pullL, p1.x + dx * t + dipDirX * maxSag * archFactor));
          const cy = Math.max(0, Math.min(w, p1.y + dy * t + dipDirY * maxSag * archFactor));
          const cz = profileMetric.getRoofZAtY(cy);
          curvedPts2D.push({ x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) });
          curvedPts3D.push({ x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)), z: Number(cz.toFixed(3)) });
        }
      }
    }

    if (curvedPts2D.length >= 2) {
      let arcLen = 0;
      for (let i = 0; i < curvedPts3D.length - 1; i++) {
        arcLen += Math.hypot(
          curvedPts3D[i + 1].x - curvedPts3D[i].x,
          curvedPts3D[i + 1].y - curvedPts3D[i].y,
          curvedPts3D[i + 1].z - curvedPts3D[i].z
        );
      }
      crownSeg = {
        panel: 'crown',
        p1: curvedPts2D[0],
        p2: curvedPts2D[curvedPts2D.length - 1],
        lengthM: Number(Math.max(0.05, arcLen).toFixed(2)),
        isObserved: sourcePanel === 'crown',
        isInferredContinuation: sourcePanel !== 'crown',
        curvedPoints: curvedPts2D,
        curvedPoints3D: curvedPts3D,
      };
      totalM += arcLen;
    }
  }

  return {
    face: faceSeg,
    leftWall: leftSeg,
    rightWall: rightSeg,
    crown: crownSeg,
    totalCalculatedM: Number(totalM.toFixed(2)),
  } as any;
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

  const customPoly = buildTunnelCrossSectionProfileMetric(geom).points;

  // The edges of the tunnel envelope in (X, Y, Z)
  const edges: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }][] = [];

  if (geom.isVerticalShaft) {
    // Upright Cylindrical Shaft Bowl: horizontal circle of diameter D in (x, y) centered at (R, R), vertical z from 0 (Bottom Face) to pullLengthM (Top Rim)
    const D = geom.widthM || 8.0;
    const R = D / 2;
    const pullL = geom.pullLengthM || 3.0;
    const nSeg = 36;
    for (let i = 0; i < nSeg; i++) {
      const a0 = (i / nSeg) * Math.PI * 2;
      const a1 = ((i + 1) / nSeg) * Math.PI * 2;
      const x0 = R - R * Math.cos(a0);
      const y0 = R + R * Math.sin(a0);
      const x1 = R - R * Math.cos(a1);
      const y1 = R + R * Math.sin(a1);
      // Bottom face perimeter at z = 0
      edges.push([
        { x: x0, y: y0, z: 0 },
        { x: x1, y: y1, z: 0 },
      ]);
      // Top rim perimeter at z = pullL
      edges.push([
        { x: x0, y: y0, z: pullL },
        { x: x1, y: y1, z: pullL },
      ]);
      // Vertical cylinder generator rail from z = 0 to z = pullL
      edges.push([
        { x: x0, y: y0, z: 0 },
        { x: x0, y: y0, z: pullL },
      ]);
    }
  } else if (customPoly.length >= 3) {
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
  const isVertShaft = Boolean(geom.isVerticalShaft);
  const D = geom.widthM || 8.0;
  const R = D / 2;
  const pullL = geom.pullLengthM || 3.0;
  const quadrantArcM = Number(((Math.PI * D) / 4).toFixed(2));

  let panelW = geom.widthM || 8.0;
  let panelH = geom.heightM || 6.5;
  if (isVertShaft) {
    if (panel === 'face') {
      panelW = D;
      panelH = D;
    } else {
      panelW = quadrantArcM;
      panelH = pullL;
    }
  } else if (panel === 'crown') {
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

  if (isVertShaft) {
    if (panel === 'face') {
      return {
        x: Number(Math.max(0.05, Math.min(D - 0.05, vNorm * D)).toFixed(3)),
        y: Number(Math.max(0.05, Math.min(D - 0.05, uNorm * D)).toFixed(3)),
        z: 0.02,
      };
    }
    let startDeg = 0;
    if (panel === 'left_wall') startDeg = 0;
    else if (panel === 'crown') startDeg = 90;
    else if (panel === 'right_wall') startDeg = 180;
    else startDeg = 270;
    const deg = startDeg + uNorm * 90;
    const rad = (deg * Math.PI) / 180;
    const my = R + R * Math.sin(rad);
    const mx = R - R * Math.cos(rad);
    const mz = Math.max(0.02, Math.min(pullL, (1 - vNorm) * pullL));
    return {
      x: Number(mx.toFixed(3)),
      y: Number(my.toFixed(3)),
      z: Number(mz.toFixed(3)),
    };
  }

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
        x: Math.max(0, Math.min(geom.pullLengthM || 3.0, (1 - uNorm) * (geom.pullLengthM || 3.0))),
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
  geom: TunnelSpatialGeometry,
  lockStrikeLineHinge: boolean = false,
  preferredDipDirectionDeg?: number
): TraceHingePlaneResult {
  const pFirst = points[0] || { x: 300, y: 300 };
  const pLast = points[points.length - 1] || { x: 700, y: 500 };

  const p1 = pointToTunnel3DMetric(pFirst, panel, geom);
  const p2 = pointToTunnel3DMetric(pLast, panel, geom);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const traceLen = Math.hypot(dx, dy, dz) || 1e-4;

  let ux = dx / traceLen;
  let uy = dy / traceLen;
  let uz = dz / traceLen;

  const midPoint: Vec3D = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  };

  let traceStartPt: Vec3D = p1;
  let traceEndPt: Vec3D = p2;

  const useStrikeLineHinge =
    (!geom.isVerticalShaft && panel === 'crown') ||
    (Boolean(geom.isVerticalShaft) && panel === 'face') ||
    lockStrikeLineHinge;

  // On vertical panels (Tunnel Face & Walls, or Vertical Shaft Quadrant Walls), canonicalize the trace hinge vector downward (uz <= 0)
  // so drawing a trace bottom-to-top vs top-to-bottom never flips the 3D plane 180°.
  if (!useStrikeLineHinge && uz > 0) {
    ux = -ux;
    uy = -uy;
    uz = -uz;
  }

  if (!geom.isVerticalShaft && panel === 'crown') {
    // On the 2D Crown canvas:
    // -Y (up canvas) is +X (tunnel drive direction), +X (right canvas) is +Y (right wall).
    // The mapped crown trace defines the horizontal STRIKE line hinge.
    const rawDx = pLast.x - pFirst.x;
    const rawDy = pLast.y - pFirst.y;
    const rawCanvasLen = Math.hypot(rawDx, rawDy);
    if (rawCanvasLen > 1e-4) {
      ux = -rawDy / rawCanvasLen;
      uy = rawDx / rawCanvasLen;
      uz = 0;
    } else {
      const horizMetricLen = Math.hypot(dx, dy) || 1;
      ux = dx / horizMetricLen;
      uy = dy / horizMetricLen;
      uz = 0;
    }

    // Recompute true arch roof elevation at midPoint.y so the horizontal strike axis is anchored on the crown arch:
    const w = geom.widthM || 8.0;
    const cx = w / 2;
    const hw = geom.wallHeightM || ((geom.heightM || 6.5) * 0.55);
    const archRise = Math.max(0.5, (geom.heightM || 6.5) - hw);
    const normDy = Math.max(-1, Math.min(1, (midPoint.y - cx) / Math.max(0.1, w / 2)));
    midPoint.z = Number((hw + archRise * Math.sqrt(Math.max(0, 1 - normDy * normDy))).toFixed(3));

    const halfLen = traceLen / 2;
    traceStartPt = {
      x: Number((midPoint.x - ux * halfLen).toFixed(3)),
      y: Number((midPoint.y - uy * halfLen).toFixed(3)),
      z: midPoint.z,
    };
    traceEndPt = {
      x: Number((midPoint.x + ux * halfLen).toFixed(3)),
      y: Number((midPoint.y + uy * halfLen).toFixed(3)),
      z: midPoint.z,
    };
  } else if (geom.isVerticalShaft && panel === 'face') {
    // Vertical Shaft Bottom Floor (Z = 0.02): p1 and p2 already lie on the horizontal shaft floor.
    const horizMetricLen = Math.hypot(dx, dy) || 1;
    ux = dx / horizMetricLen;
    uy = dy / horizMetricLen;
    uz = 0;
  } else if (lockStrikeLineHinge) {
    // Strike Line Hinge mode on Face/Wall: lock horizontal strike line from the 2D mapped trace
    const rawDx = pLast.x - pFirst.x;
    const rawDy = pLast.y - pFirst.y;
    const rawCanvasLen = Math.hypot(rawDx, rawDy);
    if (rawCanvasLen > 1e-4) {
      ux = -rawDy / rawCanvasLen;
      uy = rawDx / rawCanvasLen;
      uz = 0;
    } else {
      const horizMetricLen = Math.hypot(dx, dy) || 1;
      ux = dx / horizMetricLen;
      uy = dy / horizMetricLen;
      uz = 0;
    }
  }

  const hingeAxis: Vec3D = { x: ux, y: uy, z: uz };

  const dipAngle = Math.max(0, Math.min(90, hingeDipDeg ?? 60));
  const thetaRad = degToRad(dipAngle);
  const cosT = dipAngle === 90 ? 0 : Math.cos(thetaRad);
  const sinT = dipAngle === 90 ? 1 : Math.sin(thetaRad);

  let nx = 0;
  let ny = 0;
  let nz = 1;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let crownHorizDipX = 0;
  let crownHorizDipY = 0;

  if (!useStrikeLineHinge && !geom.isVerticalShaft && panel === 'face') {
    // Tunnel Face (X = pullM): Hinge vector is (0, uy, uz) with uy^2 + uz^2 = 1.
    const sgnUy = uy >= 0 ? 1 : -1;
    const sgnX = directionSide === 'heading' ? 1 : -1;
    nx = sgnX * sinT;
    ny = -uz * sgnUy * cosT;
    nz = Math.abs(uy) * cosT;

    let rawVx = ny * uz - nz * uy;
    let rawVy = nz * ux - nx * uz;
    let rawVz = nx * uy - ny * ux;
    if (rawVz > 1e-6) {
      rawVx = -rawVx;
      rawVy = -rawVy;
      rawVz = -rawVz;
    }
    const vLen = Math.hypot(rawVx, rawVy, rawVz) || 1;
    vx = rawVx / vLen;
    vy = rawVy / vLen;
    vz = rawVz / vLen;
  } else if (!useStrikeLineHinge && !geom.isVerticalShaft && (panel === 'left_wall' || panel === 'right_wall')) {
    // Tunnel Sidewall (Y = 0 or Y = widthM): Hinge vector is (ux, 0, uz) with ux^2 + uz^2 = 1.
    const sgnUx = ux >= 0 ? 1 : -1;
    const sgnY =
      panel === 'left_wall'
        ? directionSide === 'heading'
          ? 1
          : -1
        : directionSide === 'heading'
        ? -1
        : 1;
    nx = -uz * sgnUx * cosT;
    ny = sgnY * sinT;
    nz = Math.abs(ux) * cosT;

    let rawVx = ny * uz - nz * uy;
    let rawVy = nz * ux - nx * uz;
    let rawVz = nx * uy - ny * ux;
    if (rawVz > 1e-6) {
      rawVx = -rawVx;
      rawVy = -rawVy;
      rawVz = -rawVz;
    }
    const vLen = Math.hypot(rawVx, rawVy, rawVz) || 1;
    vx = rawVx / vLen;
    vy = rawVy / vLen;
    vz = rawVz / vLen;
  } else if (!useStrikeLineHinge && geom.isVerticalShaft && panel !== 'face') {
    // Vertical Shaft Quadrant Wall (`left_wall` Q1 NE, `crown` Q2 ES, `right_wall` Q3 SW, `shaft_sn` Q4 WN):
    // Hinge vector is u = (ux, uy, uz) on the cylindrical shaft wall.
    const h = Math.hypot(ux, uy);
    let e1x = 0;
    let e1y = 1;
    let e2x = 0;
    let e2y = 0;
    let e2z = 1;
    if (h > 1e-4) {
      e1x = -uy / h;
      e1y = ux / h;
      e2x = (-ux * uz) / h;
      e2y = (-uy * uz) / h;
      e2z = h;
    } else {
      const rCx = midPoint.x - (geom.widthM || 8.0) / 2;
      const rCy = midPoint.y - (geom.widthM || 8.0) / 2;
      const rLen = Math.hypot(rCx, rCy) || 1;
      e1x = rCx / rLen;
      e1y = rCy / rLen;
      e2x = -rCy / rLen;
      e2y = rCx / rLen;
      e2z = 0;
    }
    const sgnRad = directionSide === 'heading' ? 1 : -1;
    nx = sgnRad * sinT * e1x + cosT * e2x;
    ny = sgnRad * sinT * e1y + cosT * e2y;
    nz = cosT * e2z;

    let rawVx = ny * uz - nz * uy;
    let rawVy = nz * ux - nx * uz;
    let rawVz = nx * uy - ny * ux;
    if (rawVz > 1e-6) {
      rawVx = -rawVx;
      rawVy = -rawVy;
      rawVz = -rawVz;
    }
    const vLen = Math.hypot(rawVx, rawVy, rawVz) || 1;
    vx = rawVx / vLen;
    vy = rawVy / vLen;
    vz = rawVz / vLen;
  } else {
    // Tunnel Crown (ceiling arch), Vertical Shaft Bottom Face (`geom.isVerticalShaft && panel === 'face'`), or Strike Line Hinge Mode:
    // The mapped trace defines the fixed horizontal STRIKE line hinge (ux, uy, 0).
    const horizLen = Math.hypot(ux, uy);
    const sgnSide = directionSide === 'heading' ? 1 : -1;
    if (horizLen > 1e-4) {
      crownHorizDipX = (-uy / horizLen) * sgnSide;
      crownHorizDipY = (ux / horizLen) * sgnSide;
    } else {
      crownHorizDipX = 0;
      crownHorizDipY = sgnSide;
    }

    if (typeof preferredDipDirectionDeg === 'number' && !isNaN(preferredDipDirectionDeg)) {
      const prefDx = geom.isVerticalShaft
        ? -Math.cos(degToRad(normalizeAngle360(preferredDipDirectionDeg)))
        : Math.cos(degToRad(normalizeAngle360(preferredDipDirectionDeg - (geom?.driveAzimuthDeg || 0))));
      const prefDy = geom.isVerticalShaft
        ? Math.sin(degToRad(normalizeAngle360(preferredDipDirectionDeg)))
        : Math.sin(degToRad(normalizeAngle360(preferredDipDirectionDeg - (geom?.driveAzimuthDeg || 0))));
      if (crownHorizDipX * prefDx + crownHorizDipY * prefDy < -1e-4) {
        crownHorizDipX = -crownHorizDipX;
        crownHorizDipY = -crownHorizDipY;
      }
    }

    vx = crownHorizDipX * cosT;
    vy = crownHorizDipY * cosT;
    vz = -sinT;

    nx = crownHorizDipX * sinT;
    ny = crownHorizDipY * sinT;
    nz = cosT;
  }

  const nLen = Math.hypot(nx, ny, nz) || 1;
  let na = nx / nLen;
  let nb = ny / nLen;
  let nc = nz / nLen;

  // Ensure upward normal (nc >= 0), and at vertical dip (nc === 0) preserve preferredDipDirectionDeg hemisphere if provided:
  if (nc < -1e-7) {
    na = -na;
    nb = -nb;
    nc = -nc;
  } else if (Math.abs(nc) <= 1e-7) {
    nc = 0;
    if (typeof preferredDipDirectionDeg === 'number' && !isNaN(preferredDipDirectionDeg)) {
      const prefDx = geom.isVerticalShaft
        ? -Math.cos(degToRad(normalizeAngle360(preferredDipDirectionDeg)))
        : Math.cos(degToRad(normalizeAngle360(preferredDipDirectionDeg - (geom?.driveAzimuthDeg || 0))));
      const prefDy = geom.isVerticalShaft
        ? Math.sin(degToRad(normalizeAngle360(preferredDipDirectionDeg)))
        : Math.sin(degToRad(normalizeAngle360(preferredDipDirectionDeg - (geom?.driveAzimuthDeg || 0))));
      if (na * prefDx + nb * prefDy < -1e-4) {
        na = -na;
        nb = -nb;
      }
    }
  }

  const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);

  // Geological Dip Angle: angle between normal and vertical Z
  const safeNc = Math.min(1, Math.max(0, Math.abs(nc)));
  const derivedDipDeg = useStrikeLineHinge ? Math.round(dipAngle) : clampDip(radToDeg(Math.acos(safeNc)));

  // Dip direction azimuth:
  let gradX: number;
  let gradY: number;
  if (useStrikeLineHinge) {
    gradX = crownHorizDipX;
    gradY = crownHorizDipY;
  } else {
    gradX = na;
    gradY = nb;
  }
  let derivedDipDirectionDeg: number;
  if (geom.isVerticalShaft) {
    // In Vertical Shaft metric space: North (0°) is -X, East (90°) is +Y, South (180°) is +X, West (270°) is -Y
    let shaftAz = radToDeg(Math.atan2(gradY, -gradX));
    if (isNaN(shaftAz)) shaftAz = 0;
    derivedDipDirectionDeg = normalizeAngle360(shaftAz);
  } else {
    let relAz = radToDeg(Math.atan2(gradY, gradX));
    if (isNaN(relAz)) relAz = 0;
    if (relAz < 0) relAz += 360;
    derivedDipDirectionDeg = normalizeAngle360(relAz + (geom?.driveAzimuthDeg || 0));
  }

  // Keep Strike strictly consistent with Right-Hand Rule (DipDir - 90°)
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
    traceStartPoint: traceStartPt,
    traceEndPoint: traceEndPt,
    traceMidPoint: midPoint,
    traceLengthM: Number(traceLen.toFixed(2)),
    hingeDipDeg: dipAngle,
    derivedDipDeg,
    derivedDipDirectionDeg,
    strikeRhrDeg,
    directionSide,
  };
}

export type TracePivotEndpoint = 'start' | 'end';
export type DipHalfCircleSense = 'inwards' | 'outwards';

/**
 * Returns true when the given panel measures Strike in plan/horizontal view
 * (Tunnel Crown, Surface Mapping Berm/Crest/Trench Floor, or Vertical Shaft Bottom Face at Pull 0m),
 * and false when the panel measures Dip on a vertical/inclined wall or face
 * (Tunnel Face/Left Wall/Right Wall, Vertical Shaft 4 Quadrant Walls, Surface Face/Flank Walls).
 */
export function isStrikeMeasuredOnPanel(
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): boolean {
  if (geom.isVerticalShaft) {
    return panel === 'face';
  }
  return panel === 'crown';
}

/**
 * Rotates the mapped 2D joint trace points around the user-selected endpoint
 * ('start' = P1 Starting Point, 'end' = P2 Ending Point):
 * - On Dip-measured panels (Face / Walls / Shaft Quadrant Walls):
 *   Changing Dip Amount (0°–90°) with Dip Sense ('inwards' vs 'outwards') sweeps the trace
 *   across the full 180° half-circle around the selected endpoint while keeping the selected
 *   endpoint 100% fixed and preserving trace length.
 * - On Strike-measured panels (Crown / Surface Berm / Shaft Bottom Face — Vice Versa):
 *   Changing Strike / Dip Direction (0°–359°) rotates the Strike trace around the selected endpoint
 *   while keeping the selected endpoint fixed and preserving trace length.
 */
export function computeEndpointPivotedTracePoints(params: {
  points: FieldPoint2D[];
  panel: FieldPanelId;
  geom: TunnelSpatialGeometry;
  pivotEndpoint: TracePivotEndpoint | null;
  targetDipAmountDeg: number;
  targetDipDirectionDeg: number;
  initialDipDirectionDeg: number;
  isDipAmountEdited: boolean;
  isStrikeDirEdited: boolean;
  dipHalfCircleSense?: DipHalfCircleSense;
}): FieldPoint2D[] {
  const {
    points,
    panel,
    geom,
    pivotEndpoint,
    targetDipAmountDeg,
    targetDipDirectionDeg,
    initialDipDirectionDeg,
    isDipAmountEdited,
    isStrikeDirEdited,
    dipHalfCircleSense = 'inwards',
  } = params;

  if (!points || points.length < 2 || !pivotEndpoint) {
    return points;
  }

  const pStart = points[0];
  const pEnd = points[points.length - 1];
  const pivotPt = pivotEndpoint === 'start' ? pStart : pEnd;
  const otherPt = pivotEndpoint === 'start' ? pEnd : pStart;

  const vx = otherPt.x - pivotPt.x;
  const vy = otherPt.y - pivotPt.y;
  const chordLen = Math.hypot(vx, vy);
  if (chordLen < 1e-3) {
    return points;
  }

  const strikePanel = isStrikeMeasuredOnPanel(panel, geom);

  let rotRad = 0;
  if (!strikePanel) {
    if (!isDipAmountEdited && dipHalfCircleSense === 'inwards') {
      return points;
    }
    const clampedDip = clampDip(targetDipAmountDeg ?? 60);
    const dipRad = degToRad(clampedDip);
    const baseSx = Math.abs(vx) > 1e-3 ? (vx >= 0 ? 1 : -1) : 1;
    // Flip across the 90° vertical axis when switching between Inwards and Outwards on the 180° half-circle:
    const sx = dipHalfCircleSense === 'outwards' ? -baseSx : baseSx;
    const sy = Math.abs(vy) > 1e-3 ? (vy >= 0 ? 1 : -1) : pivotEndpoint === 'start' ? 1 : -1;
    const targetVx = sx * Math.cos(dipRad);
    const targetVy = sy * Math.sin(dipRad);
    const curAngle = Math.atan2(vy, vx);
    const targetAngle = Math.atan2(targetVy, targetVx);
    rotRad = targetAngle - curAngle;
  } else {
    if (!isStrikeDirEdited) {
      return points;
    }
    const deltaDeg = targetDipDirectionDeg - initialDipDirectionDeg;
    rotRad = degToRad(deltaDeg);
  }

  if (Math.abs(rotRad) < 1e-6) {
    return points;
  }

  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  return points.map((pt, idx) => {
    if (
      (pivotEndpoint === 'start' && idx === 0) ||
      (pivotEndpoint === 'end' && idx === points.length - 1)
    ) {
      return { x: pt.x, y: pt.y };
    }
    const rx = pt.x - pivotPt.x;
    const ry = pt.y - pivotPt.y;
    return {
      x: Number((pivotPt.x + rx * cosR - ry * sinR).toFixed(2)),
      y: Number((pivotPt.y + rx * sinR + ry * cosR).toFixed(2)),
    };
  });
}

/**
 * Constructs a 3D discontinuity plane anchored at the active (endpoint-pivoted) 2D trace on any panel
 * (`face`, `left_wall`, `right_wall`, `crown`, or `shaft_sn`) in Tunnel Mode, Vertical Shaft Mode, and Surface Mapping:
 * - On Dip-measured panels: Dip Amount pivots the trace around the selected Starting/Ending point,
 *   and Dip Direction rotates the 3D plane hinge-based around that tilted trace line.
 * - On Strike-measured panels (Vice Versa): Strike/Dip Direction pivots the Strike trace around the selected
 *   Starting/Ending point, and Dip Amount tilts the 3D plane hinge-based around that Strike trace line.
 */
export function constructTraceAnchoredPlaneFromOrientation(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  dipDirectionDeg: number,
  dipDeg: number,
  geom: TunnelSpatialGeometry,
  directionSide: 'heading' | 'collar' = 'heading',
  _overrideHingeDipAmount: boolean = false
): TraceHingePlaneResult {
  const pFirst = points[0] || { x: 300, y: 300 };
  const pLast = points[points.length - 1] || { x: 700, y: 500 };

  const p1 = pointToTunnel3DMetric(pFirst, panel, geom);
  const p2 = pointToTunnel3DMetric(pLast, panel, geom);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  const traceLen = Math.hypot(dx, dy, dz) || 1e-4;

  let ux = dx / traceLen;
  let uy = dy / traceLen;
  let uz = dz / traceLen;

  const isHorizontalTracePanel = isStrikeMeasuredOnPanel(panel, geom);

  // Canonicalize vertical panel trace vector downward (uz <= 0) so drawing bottom-to-top vs top-to-bottom
  // always gives the exact same down-dip hinge orientation:
  if (!isHorizontalTracePanel && uz > 0) {
    ux = -ux;
    uy = -uy;
    uz = -uz;
  }

  const midPoint: Vec3D = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  };

  let traceStartPt: Vec3D = p1;
  let traceEndPt: Vec3D = p2;

  const safeDipDir = normalizeAngle360(dipDirectionDeg ?? 135);
  const safeDip = clampDip(dipDeg ?? 60);
  const drive =
    geom.driveAzimuthDeg != null && !isNaN(geom.driveAzimuthDeg)
      ? normalizeAngle360(geom.driveAzimuthDeg)
      : 0;
  const relDd = geom.isVerticalShaft
    ? safeDipDir
    : normalizeAngle360(safeDipDir - drive);
  const alphaRad = degToRad(relDd);
  const cosA = Math.cos(alphaRad);
  const sinA = Math.sin(alphaRad);

  if (!geom.isVerticalShaft && panel === 'crown') {
    const horizMetricLen = Math.hypot(dx, dy) || 1;
    ux = dx / horizMetricLen;
    uy = dy / horizMetricLen;
    uz = 0;

    const w = geom.widthM || 8.0;
    const cx = w / 2;
    const hw = geom.wallHeightM || (geom.heightM || 6.5) * 0.55;
    const archRise = Math.max(0.5, (geom.heightM || 6.5) - hw);
    const normDy = Math.max(-1, Math.min(1, (midPoint.y - cx) / Math.max(0.1, w / 2)));
    midPoint.z = Number((hw + archRise * Math.sqrt(Math.max(0, 1 - normDy * normDy))).toFixed(3));

    traceStartPt = {
      x: Number(p1.x.toFixed(3)),
      y: Number(p1.y.toFixed(3)),
      z: midPoint.z,
    };
    traceEndPt = {
      x: Number(p2.x.toFixed(3)),
      y: Number(p2.y.toFixed(3)),
      z: midPoint.z,
    };
  } else if (geom.isVerticalShaft && panel === 'face') {
    const horizMetricLen = Math.hypot(dx, dy) || 1;
    ux = dx / horizMetricLen;
    uy = dy / horizMetricLen;
    uz = 0;
  }

  const hingeAxis: Vec3D = { x: ux, y: uy, z: uz };

  // CASE 1: Tunnel / Surface Face (!geom.isVerticalShaft && panel === 'face')
  if (!geom.isVerticalShaft && panel === 'face') {
    const sY = uy >= 0 ? 1 : -1;
    const absUy = Math.abs(uy);
    const absUz = Math.abs(uz);

    const dirSign = directionSide === 'collar' ? -1 : 1;
    const c1 = dirSign * cosA;
    const sinSign = Math.abs(sinA) > 1e-5 ? (sinA >= 0 ? 1 : -1) : 1;
    const c2 = sY * sinSign * Math.max(0.42, Math.abs(sinA));

    const rawNx = c1;
    const rawNy = c2 * sY * absUz;
    const rawNz = c2 * absUy;

    let vx = -c2;
    let vy = c1 * sY * absUz;
    let vz = c1 * absUy;

    if (Math.abs(vz) > 1e-5) {
      if (vz > 0) {
        vx = -vx;
        vy = -vy;
        vz = -vz;
      }
    } else if (vx * cosA + vy * sinA < 0) {
      vx = -vx;
      vy = -vy;
      vz = -vz;
    }

    const nLen = Math.hypot(rawNx, rawNy, rawNz) || 1;
    let na = rawNx / nLen;
    let nb = rawNy / nLen;
    let nc = rawNz / nLen;

    if (nc < -1e-7) {
      na = -na;
      nb = -nb;
      nc = -nc;
    } else if (Math.abs(nc) <= 1e-7) {
      nc = 0;
      if (na * cosA + nb * sinA < -1e-4) {
        na = -na;
        nb = -nb;
      }
    }

    const vLen = Math.hypot(vx, vy, vz) || 1;
    const inPlaneDipVector: Vec3D = {
      x: vx / vLen,
      y: vy / vLen,
      z: vz / vLen,
    };

    const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);
    const strikeRhrDeg = normalizeAngle360(safeDipDir - 90);

    return {
      panel,
      a: na,
      b: nb,
      c: nc,
      d,
      normal: { x: na, y: nb, z: nc },
      dipVector: inPlaneDipVector,
      strikeVector: hingeAxis,
      hingeAxis,
      traceStartPoint: traceStartPt,
      traceEndPoint: traceEndPt,
      traceMidPoint: midPoint,
      traceLengthM: Number(traceLen.toFixed(2)),
      hingeDipDeg: safeDip,
      derivedDipDeg: safeDip,
      derivedDipDirectionDeg: safeDipDir,
      strikeRhrDeg,
      directionSide,
    };
  }

  // CASE 2: Tunnel / Surface Sidewalls (!geom.isVerticalShaft && (panel === 'left_wall' || panel === 'right_wall'))
  if (!geom.isVerticalShaft && (panel === 'left_wall' || panel === 'right_wall')) {
    const sX = ux >= 0 ? 1 : -1;
    const absUx = Math.abs(ux);
    const absUz = Math.abs(uz);

    const dirSign = directionSide === 'collar' ? -1 : 1;
    const c1 = dirSign * sinA;
    const cosSign = Math.abs(cosA) > 1e-5 ? (cosA >= 0 ? 1 : -1) : 1;
    const c2 = sX * cosSign * Math.max(0.42, Math.abs(cosA));

    const rawNx = c2 * sX * absUz;
    const rawNy = c1;
    const rawNz = c2 * absUx;

    let vx = c1 * sX * absUz;
    let vy = -c2;
    let vz = c1 * absUx;

    if (Math.abs(vz) > 1e-5) {
      if (vz > 0) {
        vx = -vx;
        vy = -vy;
        vz = -vz;
      }
    } else if (vx * cosA + vy * sinA < 0) {
      vx = -vx;
      vy = -vy;
      vz = -vz;
    }

    const nLen = Math.hypot(rawNx, rawNy, rawNz) || 1;
    let na = rawNx / nLen;
    let nb = rawNy / nLen;
    let nc = rawNz / nLen;

    if (nc < -1e-7) {
      na = -na;
      nb = -nb;
      nc = -nc;
    } else if (Math.abs(nc) <= 1e-7) {
      nc = 0;
      if (na * cosA + nb * sinA < -1e-4) {
        na = -na;
        nb = -nb;
      }
    }

    const vLen = Math.hypot(vx, vy, vz) || 1;
    const inPlaneDipVector: Vec3D = {
      x: vx / vLen,
      y: vy / vLen,
      z: vz / vLen,
    };

    const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);
    const strikeRhrDeg = normalizeAngle360(safeDipDir - 90);

    return {
      panel,
      a: na,
      b: nb,
      c: nc,
      d,
      normal: { x: na, y: nb, z: nc },
      dipVector: inPlaneDipVector,
      strikeVector: hingeAxis,
      hingeAxis,
      traceStartPoint: traceStartPt,
      traceEndPoint: traceEndPt,
      traceMidPoint: midPoint,
      traceLengthM: Number(traceLen.toFixed(2)),
      hingeDipDeg: safeDip,
      derivedDipDeg: safeDip,
      derivedDipDirectionDeg: safeDipDir,
      strikeRhrDeg,
      directionSide,
    };
  }

  // CASE 3: Vertical Shaft Quadrant Walls (geom.isVerticalShaft && panel !== 'face')
  // Strictly hinge the 3D plane on the cylindrical shaft wall trace vector u = (ux, uy, uz).
  if (geom.isVerticalShaft && panel !== 'face') {
    const h = Math.hypot(ux, uy);
    let e1x = 0;
    let e1y = 1;
    let e2x = 0;
    let e2y = 0;
    let e2z = 1;
    if (h > 1e-4) {
      // e1 is horizontal radial normal to the trace's horizontal tangent; e2 = u x e1 is in-wall orthogonal to u
      e1x = -uy / h;
      e1y = ux / h;
      e2x = (-ux * uz) / h;
      e2y = (-uy * uz) / h;
      e2z = h;
    } else {
      const rCx = midPoint.x - (geom.widthM || 8.0) / 2;
      const rCy = midPoint.y - (geom.widthM || 8.0) / 2;
      const rLen = Math.hypot(rCx, rCy) || 1;
      e1x = rCx / rLen;
      e1y = rCy / rLen;
      e2x = -rCy / rLen;
      e2y = rCx / rLen;
      e2z = 0;
    }

    // In Vertical Shaft metric coordinates: North (0°) is -X, East (90°) is +Y
    const targetHx = -cosA;
    const targetHy = sinA;
    const proj1 = targetHx * e1x + targetHy * e1y;
    const proj2 = targetHx * e2x + targetHy * e2y;
    const phi = Math.atan2(proj2, proj1);
    const dirSign = directionSide === 'collar' ? -1 : 1;
    const c1 = dirSign * Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const sinPhiSign = Math.abs(sinPhi) > 1e-5 ? (sinPhi >= 0 ? 1 : -1) : 1;
    const c2 = sinPhiSign * Math.max(0.42, Math.abs(sinPhi));

    const rawNx = c1 * e1x + c2 * e2x;
    const rawNy = c1 * e1y + c2 * e2y;
    const rawNz = c2 * e2z;

    let vx = -c2 * e1x + c1 * e2x;
    let vy = -c2 * e1y + c1 * e2y;
    let vz = c1 * e2z;

    if (Math.abs(vz) > 1e-5) {
      if (vz > 0) {
        vx = -vx;
        vy = -vy;
        vz = -vz;
      }
    } else if (vx * targetHx + vy * targetHy < 0) {
      vx = -vx;
      vy = -vy;
      vz = -vz;
    }

    const nLen = Math.hypot(rawNx, rawNy, rawNz) || 1;
    let na = rawNx / nLen;
    let nb = rawNy / nLen;
    let nc = rawNz / nLen;

    if (nc < -1e-7) {
      na = -na;
      nb = -nb;
      nc = -nc;
    } else if (Math.abs(nc) <= 1e-7) {
      nc = 0;
      if (na * targetHx + nb * targetHy < -1e-4) {
        na = -na;
        nb = -nb;
      }
    }

    const vLen = Math.hypot(vx, vy, vz) || 1;
    const inPlaneDipVector: Vec3D = {
      x: vx / vLen,
      y: vy / vLen,
      z: vz / vLen,
    };

    const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);
    const strikeRhrDeg = normalizeAngle360(safeDipDir - 90);

    return {
      panel,
      a: na,
      b: nb,
      c: nc,
      d,
      normal: { x: na, y: nb, z: nc },
      dipVector: inPlaneDipVector,
      strikeVector: hingeAxis,
      hingeAxis,
      traceStartPoint: traceStartPt,
      traceEndPoint: traceEndPt,
      traceMidPoint: midPoint,
      traceLengthM: Number(traceLen.toFixed(2)),
      hingeDipDeg: safeDip,
      derivedDipDeg: safeDip,
      derivedDipDirectionDeg: safeDipDir,
      strikeRhrDeg,
      directionSide,
    };
  }

  // CASE 4: Horizontal Strike-Measured Panels — Vertical Shaft Bottom Face (geom.isVerticalShaft && panel === 'face')
  // and Tunnel Crown / Surface Berm (!geom.isVerticalShaft && panel === 'crown').
  // Here the trace u = (ux, uy, 0) is the Strike trace (already pivoted around Starting/Ending point when Strike/Dip Direction changes),
  // and Dip Amount (safeDip 0°..90°) tilts the 3D plane purely around the Strike trace hinge u!
  const horizLen = Math.hypot(ux, uy) || 1;
  const hUx = ux / horizLen;
  const hUy = uy / horizLen;
  // e1 = (-hUy, hUx, 0) is horizontal in-floor/in-crown perpendicular to trace u; e2 = (0, 0, 1) is vertical (+Z)
  let e1x = -hUy;
  let e1y = hUx;

  // Align e1 with the user's selected Dip Direction (and directionSide if flipped):
  const targetDipDirX = geom.isVerticalShaft ? -cosA : cosA;
  const targetDipDirY = sinA;
  if (e1x * targetDipDirX + e1y * targetDipDirY < 0) {
    e1x = -e1x;
    e1y = -e1y;
  }
  if (directionSide === 'collar') {
    e1x = -e1x;
    e1y = -e1y;
  }

  // Tilt the 3D plane around the Strike trace hinge u by exact Dip Amount (0°..90°):
  const phiRad = degToRad(safeDip);
  const sinPhi = Math.sin(phiRad);
  const cosPhi = Math.cos(phiRad);

  // Upward normal n and in-plane dip vector v in span(e1, e2), strictly orthogonal to hingeAxis = (hUx, hUy, 0):
  let na = sinPhi * e1x;
  let nb = sinPhi * e1y;
  let nc = cosPhi;

  let vx = cosPhi * e1x;
  let vy = cosPhi * e1y;
  let vz = -sinPhi;

  if (nc < -1e-7) {
    na = -na;
    nb = -nb;
    nc = -nc;
  }
  if (vz > 1e-6) {
    vx = -vx;
    vy = -vy;
    vz = -vz;
  }

  const nLen = Math.hypot(na, nb, nc) || 1;
  na /= nLen;
  nb /= nLen;
  nc /= nLen;

  const vLen = Math.hypot(vx, vy, vz) || 1;
  const inPlaneDipVector: Vec3D = {
    x: vx / vLen,
    y: vy / vLen,
    z: vz / vLen,
  };

  const d = -(na * midPoint.x + nb * midPoint.y + nc * midPoint.z);
  const strikeRhrDeg = normalizeAngle360(safeDipDir - 90);

  return {
    panel,
    a: na,
    b: nb,
    c: nc,
    d,
    normal: { x: na, y: nb, z: nc },
    dipVector: inPlaneDipVector,
    strikeVector: hingeAxis,
    hingeAxis,
    traceStartPoint: traceStartPt,
    traceEndPoint: traceEndPt,
    traceMidPoint: midPoint,
    traceLengthM: Number(traceLen.toFixed(2)),
    hingeDipDeg: safeDip,
    derivedDipDeg: safeDip,
    derivedDipDirectionDeg: safeDipDir,
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

/**
 * Converts a 3D tunnel metric point back into 2D canvas coordinates (1000x800 SVG space) for the given panel.
 */
export function tunnel3DMetricToCanvasPoint(
  pt3D: Vec3D,
  panel: FieldPanelId,
  geom: TunnelSpatialGeometry
): FieldPoint2D {
  const isVertShaft = Boolean(geom.isVerticalShaft);
  const D = geom.widthM || 8.0;
  const pullL = geom.pullLengthM || 3.0;
  const quadrantArcM = Number(((Math.PI * D) / 4).toFixed(2));

  let panelW = geom.widthM || 8.0;
  let panelH = geom.heightM || 6.5;
  if (isVertShaft) {
    if (panel === 'face') {
      panelW = D;
      panelH = D;
    } else {
      panelW = quadrantArcM;
      panelH = pullL;
    }
  } else if (panel === 'crown') {
    panelW = geom.widthM || 8.0;
    panelH = geom.pullLengthM || 3.0;
  } else if (panel === 'left_wall' || panel === 'right_wall') {
    panelW = geom.pullLengthM || 3.0;
    panelH = geom.wallHeightM || 4.0;
  }

  const maxBoxW = 845;
  const maxBoxH = 810;
  const pxPerMeter = Math.min(maxBoxW / Math.max(0.5, panelW), maxBoxH / Math.max(0.5, panelH));
  const boxW = panelW * pxPerMeter;
  const boxH = panelH * pxPerMeter;
  const boxX = 500 - boxW / 2;
  const boxY = 495 - boxH / 2;

  let uNorm = 0.5;
  let vNorm = 0.5;

  if (panel === 'crown' && !isVertShaft) {
    uNorm = Math.max(0.02, Math.min(0.98, pt3D.y / Math.max(0.5, geom.widthM || 8.0)));
    vNorm = Math.max(0.02, Math.min(0.98, 1 - pt3D.x / Math.max(0.5, geom.pullLengthM || 3.0)));
  } else if (panel === 'face' && !isVertShaft) {
    uNorm = Math.max(0.02, Math.min(0.98, pt3D.y / Math.max(0.5, geom.widthM || 8.0)));
    vNorm = Math.max(0.02, Math.min(0.98, 1 - pt3D.z / Math.max(0.5, geom.heightM || 6.5)));
  } else if (panel === 'left_wall' && !isVertShaft) {
    uNorm = Math.max(0.02, Math.min(0.98, pt3D.x / Math.max(0.5, geom.pullLengthM || 3.0)));
    vNorm = Math.max(0.02, Math.min(0.98, 1 - pt3D.z / Math.max(0.5, geom.wallHeightM || 4.0)));
  } else if (panel === 'right_wall' && !isVertShaft) {
    uNorm = Math.max(0.02, Math.min(0.98, 1 - pt3D.x / Math.max(0.5, geom.pullLengthM || 3.0)));
    vNorm = Math.max(0.02, Math.min(0.98, 1 - pt3D.z / Math.max(0.5, geom.wallHeightM || 4.0)));
  }

  return {
    x: Number((boxX + uNorm * boxW).toFixed(1)),
    y: Number((boxY + vNorm * boxH).toFixed(1)),
  };
}

/**
 * Constructs a 3D discontinuity plane and curved crown arch intersection trace for Crown mapping.
 * Endpoints of the trace remain strictly pinned to the active (endpoint-pivoted) chord endpoints P1 and P2,
 * while the interior of the trace curves along the crown vault according to Dip Amount.
 */
export function constructCurvedCrownPlaneAndTrace(
  points: FieldPoint2D[],
  dipDirectionDeg: number,
  dipDeg: number,
  geom: TunnelSpatialGeometry
): {
  plane: PlaneEquation;
  anchor3D: Vec3D;
  drawnCurve3D: Vec3D[];
  editedCurve3D: Vec3D[];
  editedCanvasPoints: FieldPoint2D[];
  planeCoverPolygon3D: Vec3D[];
} {
  const w = Math.max(0.5, geom.widthM || 8.0);
  const pullL = Math.max(0.5, geom.pullLengthM || 3.0);
  const h = Math.max(1.0, geom.heightM || 6.5);
  const hw = geom.wallHeightM || h * 0.55;
  const archRise = Math.max(0.4, h - hw);

  const safePts =
    points && points.length >= 2
      ? points
      : [
          { x: 350, y: 495 },
          { x: 650, y: 495 },
        ];

  const drawnCurve3D = safePts.map((pt) => pointToTunnel3DMetric(pt, 'crown', geom));

  const first3D = drawnCurve3D[0];
  const last3D = drawnCurve3D[drawnCurve3D.length - 1];
  const midX = (first3D.x + last3D.x) / 2;
  const midY = (first3D.y + last3D.y) / 2;
  const normDy0 = Math.max(-1, Math.min(1, (midY - w / 2) / (w / 2)));
  const archZ0 = hw + archRise * Math.sqrt(Math.max(0, 1 - normDy0 * normDy0));
  const anchor3D: Vec3D = {
    x: Number(midX.toFixed(3)),
    y: Number(midY.toFixed(3)),
    z: Number(archZ0.toFixed(3)),
  };

  let chordLenM = Math.hypot(last3D.x - first3D.x, last3D.y - first3D.y);
  if (chordLenM < 0.2) {
    chordLenM = Math.min(w * 0.65, pullL * 0.75);
  }

  const plane = constructJointPlane(
    dipDirectionDeg,
    dipDeg,
    anchor3D,
    geom.driveAzimuthDeg || 0
  );

  // Horizontal dip-direction unit vector in tunnel (X, Y)
  const relDipRad = degToRad(normalizeAngle360(dipDirectionDeg - (geom.driveAzimuthDeg || 0)));
  const dipDirX = Math.cos(relDipRad);
  const dipDirY = Math.sin(relDipRad);

  // As a plane with dip angle delta cuts the arched crown roof Z_arch(Y),
  // any drop in roof height shifts the interior of the trace in the dip direction by cot(delta) * dZ,
  // while keeping the endpoints tau = ±1 strictly pinned at first3D (P1) and last3D (P2).
  const clampedDip = Math.max(5, Math.min(90, dipDeg));
  const cotDip = Math.cos(degToRad(clampedDip)) / Math.max(0.08, Math.sin(degToRad(clampedDip)));

  const nSamples = 20;
  const editedCurve3D: Vec3D[] = [];
  const editedCanvasPoints: FieldPoint2D[] = [];

  for (let i = 0; i <= nSamples; i++) {
    const t = i / nSamples; // 0..1
    const tau = (t - 0.5) * 2; // -1..+1

    // Interpolate directly between first3D (P1) and last3D (P2) so endpoints stay 100% pinned:
    const baseX = first3D.x + t * (last3D.x - first3D.x);
    const baseY = first3D.y + t * (last3D.y - first3D.y);

    const normDyBase = Math.max(-1, Math.min(1, (baseY - w / 2) / (w / 2)));
    const zAtBase = hw + archRise * Math.sqrt(Math.max(0, 1 - normDyBase * normDyBase));
    const transDrop = Math.max(0, archZ0 - zAtBase);
    const vaultDrop = archRise * 0.28 * (1 - tau * tau);

    // Zero at tau = -1 (P1) and tau = +1 (P2), maximum at midpoint tau = 0:
    const archCurveOffset = (vaultDrop + transDrop * 0.45 * (1 - tau * tau)) * Math.min(1.4, cotDip * 0.65);

    const cx = Math.max(0.04, Math.min(pullL - 0.04, baseX + dipDirX * archCurveOffset));
    const cy = Math.max(0.06, Math.min(w - 0.06, baseY + dipDirY * archCurveOffset));
    const normDy = Math.max(-1, Math.min(1, (cy - w / 2) / (w / 2)));
    const cz = hw + archRise * Math.sqrt(Math.max(0, 1 - normDy * normDy));

    const pt3: Vec3D = {
      x: Number(cx.toFixed(3)),
      y: Number(cy.toFixed(3)),
      z: Number(cz.toFixed(3)),
    };
    editedCurve3D.push(pt3);
    if (i === 0) {
      editedCanvasPoints.push({ x: safePts[0].x, y: safePts[0].y });
    } else if (i === nSamples) {
      editedCanvasPoints.push({ x: safePts[safePts.length - 1].x, y: safePts[safePts.length - 1].y });
    } else {
      editedCanvasPoints.push(tunnel3DMetricToCanvasPoint(pt3, 'crown', geom));
    }
  }

  // Build a 3D plane polygon that covers the entire curved trace on the crown and cuts through the curve into the tunnel
  const coverDepthM = Math.min(h * 0.65, Math.max(1.8, chordLenM * 0.65));
  const upperBand3D: Vec3D[] = editedCurve3D.map((p) => ({
    x: Number(Math.max(0, Math.min(pullL, p.x - plane.dipVector.x * 0.35)).toFixed(3)),
    y: Number(Math.max(0, Math.min(w, p.y - plane.dipVector.y * 0.35)).toFixed(3)),
    z: Number(Math.min(h + 0.25, p.z - plane.dipVector.z * 0.35).toFixed(3)),
  }));
  const lowerBand3D: Vec3D[] = [...editedCurve3D].reverse().map((p) => ({
    x: Number(Math.max(0, Math.min(pullL, p.x + plane.dipVector.x * coverDepthM)).toFixed(3)),
    y: Number(Math.max(0, Math.min(w, p.y + plane.dipVector.y * coverDepthM)).toFixed(3)),
    z: Number(Math.max(0.05, p.z + plane.dipVector.z * coverDepthM).toFixed(3)),
  }));

  return {
    plane,
    anchor3D,
    drawnCurve3D,
    editedCurve3D,
    editedCanvasPoints,
    planeCoverPolygon3D: [...upperBand3D, ...lowerBand3D],
  };
}

/**
 * Re-computes and aligns the 2D canvas trace polyline points to match the edited 3D Joint Inspection
 * Dip Direction and Dip Amount when the user selects "Change Trace Alignment on Canvas".
 */
export function recomputeAlignedCanvasTracePoints(
  points: FieldPoint2D[],
  panel: FieldPanelId,
  dipDirectionDeg: number,
  dipDeg: number,
  geom: TunnelSpatialGeometry
): FieldPoint2D[] {
  if (!points || points.length < 2) return points;

  if (panel === 'crown' && !geom.isVerticalShaft) {
    const res = constructCurvedCrownPlaneAndTrace(points, dipDirectionDeg, dipDeg, geom);
    return res.editedCanvasPoints;
  }

  // For Face, Left Wall, Right Wall (or Vertical Shaft):
  // Calculate the plane equation anchored at the trace midpoint, then align the 2D trace along the plane's intersection with the panel
  const anchor3D = deriveAnchorPointFromPoints(points, panel, geom);
  const plane = constructJointPlane(
    dipDirectionDeg,
    dipDeg,
    anchor3D,
    geom.driveAzimuthDeg || 0
  );

  // Determine the target 2D canvas direction vector (dxCanvas, dyCanvas) on this panel
  let targetDx = 1;
  let targetDy = 0;

  if (panel === 'face') {
    // Face plane is X = pullLengthM: b*Y + c*Z + const = 0 => tangent in (Y, Z) is (c, -b)
    // On canvas: +X is +Y_tunnel, +Y_canvas is -Z_tunnel => canvas tangent is (c, b)
    const len = Math.hypot(plane.c, plane.b);
    if (len > 1e-4) {
      targetDx = plane.c / len;
      targetDy = plane.b / len;
    }
  } else if (panel === 'left_wall') {
    // Left wall plane is Y = 0: a*X + c*Z + const = 0 => tangent in (X, Z) is (c, -a)
    // On Left Wall canvas: +X_canvas is +X_tunnel, +Y_canvas is -Z_tunnel => canvas tangent is (c, a)
    const len = Math.hypot(plane.c, plane.a);
    if (len > 1e-4) {
      targetDx = plane.c / len;
      targetDy = plane.a / len;
    }
  } else if (panel === 'right_wall') {
    // Right wall plane is Y = widthM: a*X + c*Z + const = 0 => tangent in (X, Z) is (c, -a)
    // On Right Wall canvas: +X_canvas is -X_tunnel (Left=Face, Right=Portal), +Y_canvas is -Z_tunnel => canvas tangent is (-c, a)
    const len = Math.hypot(plane.c, plane.a);
    if (len > 1e-4) {
      targetDx = -plane.c / len;
      targetDy = plane.a / len;
    }
  }

  // Rotate existing points around their 2D centroid so the chord aligns with (targetDx, targetDy)
  // while preserving the trace's length and any subtle drawn curvature
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const pFirst = points[0];
  const pLast = points[points.length - 1];
  const curDx = pLast.x - pFirst.x;
  const curDy = pLast.y - pFirst.y;
  const curLen = Math.hypot(curDx, curDy);

  if (curLen < 2) return points;

  const curAngle = Math.atan2(curDy, curDx);
  let targetAngle = Math.atan2(targetDy, targetDx);
  // Pick the direction along the line that requires the smallest rotation (< 90°) from the drawn trace
  const diff = Math.atan2(Math.sin(targetAngle - curAngle), Math.cos(targetAngle - curAngle));
  if (Math.abs(diff) > Math.PI / 2) {
    targetAngle += Math.PI;
  }
  const rotRad = targetAngle - curAngle;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  return points.map((pt) => {
    const rx = pt.x - cx;
    const ry = pt.y - cy;
    return {
      x: Number((cx + rx * cosR - ry * sinR).toFixed(1)),
      y: Number((cy + rx * sinR + ry * cosR).toFixed(1)),
    };
  });
}



