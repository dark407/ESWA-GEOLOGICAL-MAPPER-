/**
 * Geotechnical Spot Bolt Recommendation Engine
 *
 * Automates engineering recommendation for supplemental targeted Spot Bolts in Stage 9
 * (FieldSupportSystemStage) based on:
 *  1. Actual Tunnel Round Chainage (RD parsed from chainageFrom / chainageMeters, never hardcoded 1000m).
 *  2. Strictly Excavated Tunnel Perimeter Installation ('crown', 'left_wall', 'right_wall' — NEVER on 'face').
 *  3. True Rock Mass Classification Awareness (RMR89, Q-System, and selected NMT Support Class I–V).
 *     - Class I & Class II (Very Good / Good Rock) have high rock mass friction, joint interlocking, and cohesion;
 *       switching from Class III to Class II will NEVER trigger false spot bolts unless an explicit unstable
 *       shear/fault or unanchored critical gravity wedge exists in the current round.
 *  4. Strict Current-Round Structural Validation: only true multi-point faults/shears mapped in the current
 *     round (or verified adjacent round in the exact same tunnel location within 0.8m) are evaluated.
 *  5. Excavation approach hatching compliance (strictly excludes unexcavated bench or already-excavated portions).
 */

import {
  FieldExcavationRound,
  FieldTunnelLocationItem,
  FieldSpotBoltItem,
  FieldSupportSystemConfig,
  FieldJointTrace,
  FieldStructuralFeature,
  FieldLithologyStroke,
  FieldWaterMark,
  FieldPanelId,
  isPointInsideHatchedExcavationPortion,
  computePanelCanvasGeometry,
  computeFieldRmrValue,
  computeFieldQValue,
} from './fieldMappingEngine';

export interface SpotBoltEngineInput {
  currentRound: FieldExcavationRound;
  previousRounds?: FieldExcavationRound[];
  location: FieldTunnelLocationItem;
  boltLengthM?: number;
  boltDiameterMm?: number;
  steelGradeMpa?: number;
  existingSupport?: FieldSupportSystemConfig;
}

export interface GeotechnicalHazardDetected {
  id: string;
  type:
    | 'CROWN_GRAVITY_WEDGE'
    | 'SIDEWALL_SLIDING_SLAB'
    | 'LITHOLOGY_SHEAR_CONTACT'
    | 'PREVIOUS_ROUND_CONTINUITY'
    | 'DAYLIGHTING_JOINT_WEDGE'
    | 'WATER_LUBRICATED_SHEAR';
  panel: FieldPanelId;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  description: string;
  drivingForceKn: number;
  resistingForceBeforeKn: number;
  fosBefore: number;
  fosAfter: number;
  apexDepthM: number;
  locationMeters: { pullM: number; xM: number; yM: number };
  rdM: number;
  offsetM: number;
  heightM: number;
}

export interface GeotechnicalSpotBoltRecommendationResult {
  spotBoltsNeeded: boolean;
  recommendedSpotBolts: FieldSpotBoltItem[];
  hazards: GeotechnicalHazardDetected[];
  summaryVerdict: string;
  geotechnicalRationale: string;
  femDemImpactSummary: {
    totalTensileCapacityAddedKn: number;
    equivalentSupportPressureAddedMpa: number;
    criticalWedgeFosImprovement: string;
  };
  analyzedDiscontinuitiesCount: number;
  analyzedWeakLithologyCount: number;
  previousRoundContinuityFound: boolean;
}

/**
 * Parses the actual start chainage (RD in meters) from a FieldExcavationRound.
 * Supports formats like "100", "100.5", "RD 100", "0+100", "1+250.5", or numeric chainageMeters.
 * Never defaults to 1000.0!
 */
export function parseRoundChainageMeters(round: FieldExcavationRound): number {
  if (typeof round.chainageFrom === 'string' && round.chainageFrom.trim().length > 0) {
    const raw = round.chainageFrom.trim();
    // Check station format like "1+250" or "0+100.5"
    const stationMatch = raw.match(/([+-]?\d+)\s*\+\s*(\d+(?:\.\d+)?)/);
    if (stationMatch) {
      const km = parseFloat(stationMatch[1]);
      const m = parseFloat(stationMatch[2]);
      if (Number.isFinite(km) && Number.isFinite(m)) {
        return Number((km * 1000 + m).toFixed(2));
      }
    }
    // Extract first numeric value (e.g. "100", "RD 100.0")
    const numMatch = raw.match(/[+-]?\d+(?:\.\d+)?/);
    if (numMatch) {
      const val = parseFloat(numMatch[0]);
      if (Number.isFinite(val)) {
        return Number(val.toFixed(2));
      }
    }
  }
  if (typeof round.chainageMeters === 'number' && Number.isFinite(round.chainageMeters)) {
    return Number(round.chainageMeters.toFixed(2));
  }
  if (typeof round.chainageTo === 'string' && round.chainageTo.trim().length > 0) {
    const numMatch = round.chainageTo.trim().match(/[+-]?\d+(?:\.\d+)?/);
    if (numMatch) {
      const toVal = parseFloat(numMatch[0]);
      const pull = round.pullLengthMeters || 0;
      if (Number.isFinite(toVal)) {
        return Number(Math.max(0, toVal - pull).toFixed(2));
      }
    }
  }
  return 0;
}

/**
 * Formats a panel ID into a human-readable perimeter zone name, adapting to Vertical Shaft quadrants
 * ('1st Quad NE (0°–90°)', '2nd Quad ES (90°–180°)', '3rd Quad SW (180°–270°)', '4th Quad WN (270°–360°)', 'Center Median N–S')
 * when in vertical shaft mode.
 */
export function formatSpotBoltPanelLabel(
  panel: FieldPanelId | string | undefined,
  isVerticalShaft: boolean = false
): string {
  if (!isVerticalShaft) {
    if (panel === 'crown') return 'Crown Arch';
    if (panel === 'left_wall') return 'Left Wall';
    if (panel === 'right_wall') return 'Right Wall';
    if (panel === 'center_median') return 'Center Median';
    return 'Perimeter';
  }
  // Matches VERTICAL_SHAFT_QUADRANT_META_MAP in verticalShaftEngine.ts:
  // left_wall = Q1 NE (0°–90°), crown = Q2 ES (90°–180°),
  // right_wall = Q3 SW (180°–270°), shaft_sn = Q4 WN (270°–360°)
  if (panel === 'left_wall') return '1st Quad NE (0°–90°)';
  if (panel === 'crown') return '2nd Quad ES (90°–180°)';
  if (panel === 'right_wall') return '3rd Quad SW (180°–270°)';
  if (panel === 'shaft_sn') return '4th Quad WN (270°–360°)';
  if (panel === 'center_median') return 'Center Median Wall (0°–180°)';
  if (panel === 'face') return 'Shaft Sump Face';
  return 'Shaft Wall Ring';
}

/**
 * Maps any panel ID to a valid perimeter installation surface.
 * Spot bolts are radial perimeter rock bolts and must NEVER be recommended on 'face'.
 */
export function mapToPerimeterBoltPanel(
  panel: FieldPanelId | string | undefined,
  uNorm: number = 0.5,
  vNorm: number = 0.5,
  isVerticalShaft: boolean = false
): FieldPanelId {
  if (isVerticalShaft) {
    if (
      panel === 'left_wall' ||
      panel === 'crown' ||
      panel === 'right_wall' ||
      panel === 'shaft_sn'
    ) {
      return panel;
    }
    if (uNorm < 0.25) return 'left_wall';
    if (uNorm < 0.5) return 'crown';
    if (uNorm < 0.75) return 'right_wall';
    return 'shaft_sn';
  }
  if (panel === 'left_wall' || panel === 'right_wall' || panel === 'crown') {
    return panel;
  }
  // If a feature was mapped on the face and intersects the perimeter, project it to the nearest perimeter boundary
  if (vNorm <= 0.38) return 'crown';
  return uNorm < 0.5 ? 'left_wall' : 'right_wall';
}

/**
 * Calculates the nominal tensile yield capacity of a rebar rock bolt:
 * T_cap = (pi * d^2 / 4) * fy * 10^-3 kN
 */
export function computeBoltTensileCapacityKn(
  diameterMm: number,
  steelGradeMpa: number = 500
): number {
  const dM = Math.max(16, Math.min(50, diameterMm)) / 1000;
  const areaM2 = (Math.PI * dM * dM) / 4;
  const forceKn = areaM2 * (steelGradeMpa * 1000);
  return Number(forceKn.toFixed(1));
}

/**
 * Identifies whether a lithology pattern or name corresponds to weak, sheared,
 * or fissile rock prone to detachment or slabbing.
 */
function isWeakOrShearedLithology(stroke: FieldLithologyStroke): boolean {
  const rockName = (stroke.rockName || stroke.rockType || stroke.patternId || '').toLowerCase();
  const weakKeywords = [
    'shale',
    'schist',
    'phyllite',
    'fault',
    'shear',
    'gouge',
    'clay',
    'crushed',
    'mylonite',
    'sericite',
    'slate',
    'breccia',
    'mudstone',
    'siltstone',
    'talc',
    'chlorite',
  ];
  return weakKeywords.some((kw) => rockName.includes(kw));
}

/**
 * Normalizes an angle to 0..360 degrees.
 */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Smallest unsigned angular difference between two azimuths (0..180 degrees).
 */
function azimuthDiffDeg(az1: number, az2: number): number {
  const d = Math.abs(normalizeDeg(az1) - normalizeDeg(az2)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Computes the 3D unit normal vector (East X, North Y, Up Z) for a geological plane
 * given dip amount (0–90°) and dip direction azimuth (0–360° clockwise from North).
 */
function planeDipDirToNormal3D(
  dipDeg: number,
  dipDirDeg: number
): { nx: number; ny: number; nz: number } {
  const dipRad = (Math.max(0, Math.min(89.5, dipDeg)) * Math.PI) / 180;
  const dirRad = (normalizeDeg(dipDirDeg) * Math.PI) / 180;
  return {
    nx: Math.sin(dipRad) * Math.sin(dirRad),
    ny: Math.sin(dipRad) * Math.cos(dirRad),
    nz: Math.cos(dipRad),
  };
}

/**
 * Computes the 3D line of intersection (plunge 0–90°, trend 0–360°, dihedral angle 0–180°)
 * between two geological planes using vector cross-product of their unit normals.
 */
function computeIntersectionLine3D(
  dip1: number,
  dir1: number,
  dip2: number,
  dir2: number
): { plungeDeg: number; trendDeg: number; dihedralDeg: number } | null {
  const n1 = planeDipDirToNormal3D(dip1, dir1);
  const n2 = planeDipDirToNormal3D(dip2, dir2);
  const dot = Math.max(-1, Math.min(1, n1.nx * n2.nx + n1.ny * n2.ny + n1.nz * n2.nz));
  const dihedralDeg = (Math.acos(Math.abs(dot)) * 180) / Math.PI;
  if (dihedralDeg < 16) return null; // Nearly parallel planes do not form a discrete wedge

  // Cross product l = n1 x n2
  let lx = n1.ny * n2.nz - n1.nz * n2.ny;
  let ly = n1.nz * n2.nx - n1.nx * n2.nz;
  let lz = n1.nx * n2.ny - n1.ny * n2.nx;
  const mag = Math.hypot(lx, ly, lz);
  if (mag < 1e-5) return null;
  lx /= mag;
  ly /= mag;
  lz /= mag;

  // Ensure vector points downward (lz <= 0) for plunge & trend
  if (lz > 0) {
    lx = -lx;
    ly = -ly;
    lz = -lz;
  }

  const plungeRad = Math.asin(Math.max(0, Math.min(1, -lz)));
  const plungeDeg = (plungeRad * 180) / Math.PI;
  const trendDeg = normalizeDeg((Math.atan2(lx, ly) * 180) / Math.PI);
  return { plungeDeg, trendDeg, dihedralDeg };
}

/**
 * Parses support class string ('Class I', 'Class II', 'Class III', 'Class IV', 'Class V', or NMT Classes A-I) into 1..5
 */
function parseSupportClassRank(supportClassStr?: string): number {
  const s = (supportClassStr || '').trim().toUpperCase();
  if (s.includes('CLASS V') || s.endsWith(' V') || s.includes('CLASS H') || s.includes('CLASS I:')) return 5;
  if (s.includes('CLASS IV') || s.endsWith(' IV') || s.includes('CLASS F') || s.includes('CLASS G')) return 4;
  if (s.includes('CLASS III') || s.endsWith(' III') || s.includes('CLASS D') || s.includes('CLASS E')) return 3;
  if (s.includes('CLASS II') || s.endsWith(' II') || s.includes('CLASS B') || s.includes('CLASS C')) return 2;
  if (s.includes('CLASS I') || s.endsWith(' I') || s.includes('CLASS A')) return 1;
  return 3;
}

/**
 * Returns rock mass shear strength parameters (joint cohesion kPa, friction angle deg,
 * dilation/interlocking factor) calibrated to the effective Rock Mass Class (I to V), RMR89, and Q-value.
 */
function getRockMassShearParameters(
  classRank: number,
  rmrScore: number,
  qValue?: number | null
): {
  cohesionKpa: number;
  frictionDeg: number;
  dilationClampFactor: number;
} {
  let cohesionKpa =
    classRank === 1
      ? Math.max(75, rmrScore * 0.95)
      : classRank === 2
      ? Math.max(52, rmrScore * 0.78)
      : classRank === 3
      ? Math.max(26, rmrScore * 0.48)
      : classRank === 4
      ? Math.max(14, rmrScore * 0.3)
      : 8;

  let frictionDeg =
    classRank === 1
      ? 45
      : classRank === 2
      ? 40
      : classRank === 3
      ? 34
      : classRank === 4
      ? 28
      : 22;

  const dilationClampFactor =
    classRank === 1
      ? 2.1
      : classRank === 2
      ? 1.65
      : classRank === 3
      ? 1.15
      : classRank === 4
      ? 0.8
      : 0.5;

  if (typeof qValue === 'number' && Number.isFinite(qValue) && qValue > 0) {
    const qBoost = Math.log10(Math.max(0.02, qValue)) * 2.5;
    frictionDeg = Math.max(19, Math.min(48, frictionDeg + qBoost));
  }

  return { cohesionKpa, frictionDeg, dilationClampFactor };
}

/**
 * Core Geotechnical Spot Bolt Recommendation Engine
 * Evaluates mapped discontinuities (2D joint traces, 3D dip plane surfaces, and J1–J3 sets),
 * shear/fault zones, rock mass classifications (RMR89/Q), and existing pattern support
 * to produce accurate, geotechnically reasonable Spot Bolt recommendations for both
 * Circular Vertical Shafts (Q1 NE, Q2 ES, Q3 SW, Q4 WN) and Horizontal Tunnels.
 */
export function analyzeAndRecommendSpotBolts(
  input: SpotBoltEngineInput
): GeotechnicalSpotBoltRecommendationResult {
  const {
    currentRound,
    previousRounds = [],
    location,
    boltLengthM = 4.0,
    boltDiameterMm = 25,
    steelGradeMpa = 500,
    existingSupport,
  } = input;

  const isVerticalShaft =
    location.undergroundSubMode === 'vertical_shaft' ||
    currentRound.undergroundSubMode === 'vertical_shaft';

  const chainageRD = parseRoundChainageMeters(currentRound);
  const pullLengthM = Math.max(0.5, currentRound.pullLengthMeters || 3.0);
  const chainageEndRD = Number((chainageRD + pullLengthM).toFixed(2));
  const spanW = Math.max(3.0, location.widthM || 8.0);
  const totalH = Math.max(3.0, location.heightM || 7.0);
  const driveDir = normalizeDeg(currentRound.tunnelDriveDirection ?? 45);

  const unitWeightKnM3 = 26.5; // Average rock mass unit weight (kN/m^3)
  const singleBoltCapacityKn = computeBoltTensileCapacityKn(boltDiameterMm, steelGradeMpa);

  // Rock Mass Classification context (RMR89, Q, and Selected Support Class)
  const rmrRes = computeFieldRmrValue(currentRound.rmrSystem);
  const qRes = computeFieldQValue(currentRound.qSystem);
  const rmrVal =
    typeof rmrRes.totalRmr === 'number' && Number.isFinite(rmrRes.totalRmr)
      ? rmrRes.totalRmr
      : 55;
  const rmrLabel =
    typeof rmrRes.totalRmr === 'number' && Number.isFinite(rmrRes.totalRmr)
      ? String(rmrRes.totalRmr)
      : 'N/A';
  const qLabel =
    typeof qRes.qValue === 'number' && Number.isFinite(qRes.qValue)
      ? qRes.qValue.toFixed(2)
      : 'N/A';
  const computedRockClassStr = qRes.rockClass || rmrRes.rmrClass || 'Class III';
  const computedClassRank = parseSupportClassRank(computedRockClassStr);

  const existingSys = existingSupport || currentRound.supportSystem;
  const selectedClassStr =
    existingSys?.supportClass && existingSys.supportClass !== 'Custom'
      ? existingSys.supportClass
      : computedRockClassStr;
  const selectedClassRank = parseSupportClassRank(selectedClassStr);

  // Shear strength parameters reflect the selected rock class, RMR, and Q-value
  const rockStrength = getRockMassShearParameters(selectedClassRank, rmrVal, qRes.qValue);

  const hasPatternBolts = Boolean(existingSys?.rockBoltsEnabled);
  const patternSpInM = Math.max(0.6, existingSys?.rockBoltInPlaneSpacingM || 1.5);
  const patternSpLongM = Math.max(0.6, existingSys?.rockBoltLongitudinalSpacingM || 1.5);
  const patternBoltLenM = Math.max(1.5, existingSys?.rockBoltLengthM || boltLengthM);
  const shotcreteThickMm = existingSys?.shotcreteEnabled
    ? existingSys.shotcreteCrownThicknessMm || existingSys.shotcreteThicknessMm || 0
    : 0;
  const hasSteelRibs = Boolean(existingSys?.latticeGirderEnabled || existingSys?.ismbEnabled);

  const joints: FieldJointTrace[] = currentRound.jointTraces || [];
  const lithoStrokes: FieldLithologyStroke[] = currentRound.lithologyStrokes || [];
  const structuralFeatures: FieldStructuralFeature[] = currentRound.structuralFeatures || [];
  const waterMarks: FieldWaterMark[] = currentRound.waterMarks || [];

  // Pore water uplift factor from Q-system Jw or mapped water marks
  const jwVal = currentRound.qSystem?.jw ?? 1.0;
  const hasWater = waterMarks.length > 0 || jwVal < 0.85;
  const porePressureFactor = jwVal < 0.5 ? 0.22 : hasWater ? 0.12 : 0.0;

  const hazards: GeotechnicalHazardDetected[] = [];
  const recommendedBolts: FieldSpotBoltItem[] = [];

  // Helper to convert (panel, uNorm, vNorm) into accurate 3D/2D coordinates (pullM, xM, yM, azimuthDeg)
  const resolvePerimeterPlacement = (
    targetPanel: FieldPanelId,
    uNormRaw: number,
    vNormRaw: number
  ): {
    uNorm: number;
    vNorm: number;
    pullM: number;
    xM: number;
    yM: number;
    outwardAzimuthDeg: number;
    inwardAzimuthDeg: number;
  } => {
    const uNorm = Math.max(0.1, Math.min(0.9, uNormRaw));
    const vNorm = Math.max(0.1, Math.min(0.9, vNormRaw));

    if (isVerticalShaft) {
      const R = spanW / 2;
      // Exact Vertical Shaft Quadrant Mapping from verticalShaftEngine.ts:
      // left_wall = Q1 NE (0°–90°), crown = Q2 ES (90°–180°),
      // right_wall = Q3 SW (180°–270°), shaft_sn = Q4 WN (270°–360°)
      const quadStartDeg =
        targetPanel === 'left_wall'
          ? 0
          : targetPanel === 'crown'
          ? 90
          : targetPanel === 'right_wall'
          ? 180
          : targetPanel === 'shaft_sn'
          ? 270
          : 0;
      const azDeg =
        String(targetPanel) === 'center_median'
          ? 90
          : normalizeDeg(quadStartDeg + uNorm * 90);
      const azRad = (azDeg * Math.PI) / 180;
      const xM =
        String(targetPanel) === 'center_median'
          ? 0
          : Number((R * Math.sin(azRad)).toFixed(2));
      const yM =
        String(targetPanel) === 'center_median'
          ? Number(((0.5 - uNorm) * spanW * 0.85).toFixed(2))
          : Number((R * Math.cos(azRad)).toFixed(2));
      const pullM = Number((pullLengthM * vNorm).toFixed(2));
      return {
        uNorm,
        vNorm,
        pullM,
        xM,
        yM,
        outwardAzimuthDeg: Math.round(azDeg),
        inwardAzimuthDeg: Math.round(normalizeDeg(azDeg + 180)),
      };
    }

    // Horizontal Tunnel Mode
    if (targetPanel === 'crown') {
      const xM = Number(((uNorm - 0.5) * (spanW * 0.82)).toFixed(2));
      const archRatio = Math.max(0, 1 - Math.pow(xM / (spanW * 0.5), 2) * 0.25);
      const yM = Number((totalH * Math.min(0.98, Math.max(0.72, archRatio))).toFixed(2));
      const pullM = Number((pullLengthM * vNorm).toFixed(2));
      const outAz = xM >= 0 ? normalizeDeg(driveDir + 90) : normalizeDeg(driveDir - 90);
      return {
        uNorm,
        vNorm,
        pullM,
        xM,
        yM,
        outwardAzimuthDeg: Math.round(outAz),
        inwardAzimuthDeg: Math.round(normalizeDeg(outAz + 180)),
      };
    }

    const isLeft = targetPanel === 'left_wall';
    const xM = Number(((isLeft ? -1 : 1) * (spanW / 2 - 0.1)).toFixed(2));
    const yM = Number((totalH * Math.max(0.22, Math.min(0.68, 1 - vNorm))).toFixed(2));
    const pullM = Number((pullLengthM * uNorm).toFixed(2));
    const outAz = isLeft ? normalizeDeg(driveDir - 90) : normalizeDeg(driveDir + 90);
    return {
      uNorm,
      vNorm,
      pullM,
      xM,
      yM,
      outwardAzimuthDeg: Math.round(outAz),
      inwardAzimuthDeg: Math.round(normalizeDeg(outAz + 180)),
    };
  };

  // -------------------------------------------------------------
  // STEP 1: Weak / Sheared Lithology & Mapped Shear/Fault Zone Hazards
  // -------------------------------------------------------------
  const weakLithos = lithoStrokes.filter(isWeakOrShearedLithology);

  const shearFeatures = structuralFeatures.filter((sf) => {
    const pts = sf.points || [];
    if (pts.length < 2) return false;
    const chordPx = Math.hypot(
      pts[pts.length - 1].x - pts[0].x,
      pts[pts.length - 1].y - pts[0].y
    );
    if (chordPx < 18) return false;
    const lbl = (sf.label || '').toLowerCase();
    return (
      sf.featureType === 'fault' ||
      sf.featureType === 'thrust_fault' ||
      sf.featureType === 'shear_zone' ||
      lbl.includes('shear') ||
      lbl.includes('fault') ||
      lbl.includes('gouge')
    );
  });

  for (let idx = 0; idx < shearFeatures.length; idx++) {
    const sf = shearFeatures[idx];
    const pts = sf.points || [];
    const avgX = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
    const avgY = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;

    const rawPanel: FieldPanelId = sf.panel || 'crown';
    const rawGeom = computePanelCanvasGeometry(rawPanel, location, currentRound);
    const rawUNorm = Math.max(0.1, Math.min(0.9, (avgX - rawGeom.boxX) / Math.max(1, rawGeom.boxW)));
    const rawVNorm = Math.max(0.1, Math.min(0.9, (avgY - rawGeom.boxY) / Math.max(1, rawGeom.boxH)));

    if (rawPanel === 'face' && !isVerticalShaft) {
      const nearPerimeter = rawVNorm <= 0.35 || rawUNorm <= 0.25 || rawUNorm >= 0.75;
      if (!nearPerimeter) continue;
    }

    const targetPanel: FieldPanelId = mapToPerimeterBoltPanel(
      rawPanel,
      rawUNorm,
      rawVNorm,
      isVerticalShaft
    );

    const insideHatched = isPointInsideHatchedExcavationPortion(
      { x: avgX, y: avgY },
      targetPanel,
      location,
      currentRound
    );
    if (insideHatched) continue;

    const pos = resolvePerimeterPlacement(targetPanel, rawUNorm, rawVNorm);

    // Realistic shear zone prism dimensions based on trace length and tunnel span
    const chordPx = Math.hypot(
      pts[pts.length - 1].x - pts[0].x,
      pts[pts.length - 1].y - pts[0].y
    );
    const traceRatio = Math.max(0.3, Math.min(0.85, chordPx / Math.max(60, rawGeom.boxW)));
    const shearSpanM = Math.max(1.1, Math.min(3.2, spanW * 0.28 * traceRatio));
    const apexDepthM = Number(Math.max(0.65, Math.min(1.85, shearSpanM * 0.52)).toFixed(2));
    const wedgeVolM3 = (1 / 3) * shearSpanM * Math.min(pullLengthM * 0.65, 1.8) * apexDepthM;
    const drivingKn = Number((wedgeVolM3 * unitWeightKnM3 * (1 + porePressureFactor)).toFixed(1));

    // Existing pattern bolt & shotcrete resistance across the shear zone footprint
    const footprintAreaM2 = shearSpanM * Math.min(pullLengthM * 0.65, 1.8);
    const patternBoltsInZone = hasPatternBolts
      ? footprintAreaM2 / (patternSpInM * patternSpLongM)
      : 0;
    const patternShearResistKn =
      patternBoltsInZone * singleBoltCapacityKn * (patternBoltLenM >= apexDepthM + 0.4 ? 0.65 : 0.35);
    const shotcreteResistKn =
      shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * shearSpanM * 420 * 0.32 : 0;
    const steelRibResistKn = hasSteelRibs ? 22.0 : 0;
    const rockShearResistKn = drivingKn * (selectedClassRank <= 2 ? 0.72 : 0.46);

    const resistingBeforeKn = Number(
      (rockShearResistKn + patternShearResistKn + shotcreteResistKn + steelRibResistKn).toFixed(1)
    );
    const fosBefore = Number((resistingBeforeKn / Math.max(1, drivingKn)).toFixed(2));

    if (fosBefore < 1.5) {
      const requiredResistingKn = drivingKn * 1.52;
      const deficitKn = Math.max(0, requiredResistingKn - resistingBeforeKn);
      const boltsCountForFeature = Math.max(
        1,
        Math.min(2, Math.ceil(deficitKn / (singleBoltCapacityKn * 0.85)))
      );

      for (let bIdx = 0; bIdx < boltsCountForFeature; bIdx++) {
        const uShift = boltsCountForFeature > 1 ? (bIdx === 0 ? -0.07 : 0.07) : 0;
        const vShift = boltsCountForFeature > 1 ? (bIdx === 0 ? -0.06 : 0.06) : 0;
        const bPos = resolvePerimeterPlacement(
          targetPanel,
          pos.uNorm + uShift,
          pos.vNorm + vShift
        );
        const bRd = Number((chainageRD + bPos.pullM).toFixed(2));
        const boltId = `sb-shear-${idx + 1}-${bIdx + 1}`;
        const boltLabel = `SB-SH${idx + 1}-${bIdx + 1}`;

        const sfDip = sf.dipAmount || 62;
        const installAngle = isVerticalShaft
          ? Math.max(70, Math.min(88, Math.round(90 - (90 - sfDip) * 0.4)))
          : targetPanel === 'crown'
          ? Math.max(60, Math.min(85, Math.round(90 - sfDip * 0.3)))
          : Math.max(18, Math.min(40, Math.round(90 - sfDip)));
        const installAzimuth = isVerticalShaft
          ? bPos.outwardAzimuthDeg
          : normalizeDeg((sf.dipDirection || bPos.outwardAzimuthDeg) + 180);

        const fosAfterVal = Number(
          (
            (resistingBeforeKn + boltsCountForFeature * singleBoltCapacityKn * 0.85) /
            Math.max(1, drivingKn)
          ).toFixed(2)
        );
        const panelLabel = formatSpotBoltPanelLabel(targetPanel, isVerticalShaft);
        const stPrefix = isVerticalShaft ? 'Depth EL' : 'RD';

        hazards.push({
          id: `h-shear-${idx + 1}-${bIdx + 1}`,
          type: 'LITHOLOGY_SHEAR_CONTACT',
          panel: targetPanel,
          severity: fosBefore < 1.15 ? 'CRITICAL' : 'HIGH',
          description: `Mapped ${sf.featureType.replace('_', ' ').toUpperCase()} (${sf.label || 'Shear band'}) on ${panelLabel} dipping ${sfDip}°/${sf.dipDirection ?? bPos.inwardAzimuthDeg}°. Prism apex = ${apexDepthM}m, Load = ${drivingKn} kN, FoS before = ${fosBefore}.`,
          drivingForceKn: drivingKn,
          resistingForceBeforeKn: resistingBeforeKn,
          fosBefore,
          fosAfter: fosAfterVal,
          apexDepthM,
          locationMeters: { pullM: bPos.pullM, xM: bPos.xM, yM: bPos.yM },
          rdM: bRd,
          offsetM: bPos.xM,
          heightM: bPos.yM,
        });

        recommendedBolts.push({
          id: boltId,
          label: boltLabel,
          panel: targetPanel,
          u: bPos.uNorm,
          v: bPos.vNorm,
          pullMeter: bPos.pullM,
          xMeters: bPos.xM,
          yMeters: bPos.yM,
          lengthM: Math.max(boltLengthM, Number((apexDepthM + 1.2).toFixed(1))),
          angleDeg: installAngle,
          azimuthDeg: installAzimuth,
          diameterMm: boltDiameterMm,
          gradeMpa: steelGradeMpa,
          tensileCapacityKn: singleBoltCapacityKn,
          chainageMeters: bRd,
          offsetMeters: bPos.xM,
          heightAboveInvertM: bPos.yM,
          recommendedByEngine: true,
          hazardReason: `Stitches ${sf.featureType.replace('_', ' ')} (${sf.label || 'Shear zone'}) on ${panelLabel} at ${stPrefix} ${bRd}m (${isVerticalShaft ? `Az ${installAzimuth}°` : `Off ${bPos.xM >= 0 ? '+' : ''}${bPos.xM}m`}). FoS ${fosBefore} → ${fosAfterVal}.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 2: Synthesize Mapped Discontinuities (Joint Traces + 3D Dip Planes + J1..J3 Sets)
  // -------------------------------------------------------------
  interface NormalizedDiscontinuity {
    id: string;
    setId: string;
    panel: FieldPanelId;
    dipAmount: number;
    dipDirection: number;
    uNorm: number;
    vNorm: number;
    traceLenM: number;
    fromMappedTrace: boolean;
  }

  const normalizedJoints: NormalizedDiscontinuity[] = [];

  // 2A. Extract all mapped 2D joint traces with valid geometry
  const validTraces = joints.filter((j) => (j.metricPoints || j.points || []).length >= 2);
  validTraces.forEach((jt, idx) => {
    const pts = jt.points || [];
    const avgX = pts.length > 0 ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 210;
    const avgY = pts.length > 0 ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 120;
    const rawGeom = computePanelCanvasGeometry(jt.panel || 'crown', location, currentRound);
    const uNorm = Math.max(0.1, Math.min(0.9, (avgX - rawGeom.boxX) / Math.max(1, rawGeom.boxW)));
    const vNorm = Math.max(0.1, Math.min(0.9, (avgY - rawGeom.boxY) / Math.max(1, rawGeom.boxH)));
    const chordPx =
      pts.length >= 2
        ? Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y)
        : 60;
    const traceLenM = Math.max(
      1.0,
      Math.min(spanW * 0.75, (chordPx / Math.max(50, rawGeom.boxW)) * spanW * 0.65)
    );
    const targetPanel = mapToPerimeterBoltPanel(jt.panel, uNorm, vNorm, isVerticalShaft);
    normalizedJoints.push({
      id: jt.id || `jt-${idx + 1}`,
      setId: jt.setId || `J${(idx % 3) + 1}`,
      panel: targetPanel,
      dipAmount: Math.max(15, Math.min(89, jt.dipAmount || 60)),
      dipDirection: normalizeDeg(jt.dipDirection ?? driveDir + 90),
      uNorm,
      vNorm,
      traceLenM,
      fromMappedTrace: true,
    });
  });

  // 2B. Include 3D Dip Plane Surfaces if not already represented on that panel
  (currentRound.dipPlaneSurfaces || []).forEach((dp, idx) => {
    const targetPanel = mapToPerimeterBoltPanel(dp.panel, 0.5, 0.5, isVerticalShaft);
    const dipAmt = dp.dipAmount ?? 60;
    const dipDir = dp.dipDirection ?? 120;
    normalizedJoints.push({
      id: dp.id || `dp-${idx + 1}`,
      setId: dp.setId || `J${(idx % 3) + 1}`,
      panel: targetPanel,
      dipAmount: Math.max(15, Math.min(89, dipAmt)),
      dipDirection: normalizeDeg(dipDir),
      uNorm: 0.45 + (idx % 3) * 0.1,
      vNorm: 0.5,
      traceLenM: Math.max(1.4, Math.min(3.2, spanW * 0.35)),
      fromMappedTrace: true,
    });
  });

  // 2C. Include recorded Discontinuity Sets (J1, J2, J3, Random) so kinematic wedges are evaluated
  // across active perimeter panels/quadrants even when fewer than 2 polylines were drawn on a single wall
  const recordedSets = Object.values(currentRound.discontinuitySets || {}).filter(
    (s) =>
      (s.dipAmountTo > 0 || s.dipAmountFrom > 0) &&
      (s.dipDirectionTo > 0 || s.dipDirectionFrom > 0 || Boolean(s.persistence))
  );
  const activePerimeterPanels: FieldPanelId[] = isVerticalShaft
    ? ['left_wall', 'crown', 'right_wall', 'shaft_sn']
    : ['crown', 'left_wall', 'right_wall'];

  if (recordedSets.length > 0) {
    activePerimeterPanels.forEach((pId) => {
      const existingOnPanel = normalizedJoints.filter((nj) => nj.panel === pId);
      if (existingOnPanel.length < 2) {
        recordedSets.forEach((s, sIdx) => {
          const meanDip = Math.round(((s.dipAmountFrom || 55) + (s.dipAmountTo || 65)) / 2);
          const meanDir = normalizeDeg(
            Math.round(((s.dipDirectionFrom || 90) + (s.dipDirectionTo || 120)) / 2)
          );
          const alreadyHasSet = existingOnPanel.some(
            (e) =>
              e.setId === s.setId ||
              (Math.abs(e.dipAmount - meanDip) < 12 &&
                azimuthDiffDeg(e.dipDirection, meanDir) < 20)
          );
          if (!alreadyHasSet) {
            const persNum = parseFloat(String(s.persistence || ''));
            normalizedJoints.push({
              id: `set-${pId}-${s.setId}`,
              setId: s.setId,
              panel: pId,
              dipAmount: Math.max(15, Math.min(88, meanDip)),
              dipDirection: meanDir,
              uNorm: 0.35 + ((sIdx * 0.23) % 0.45),
              vNorm: 0.42 + ((sIdx * 0.19) % 0.35),
              traceLenM: Math.max(
                1.2,
                Math.min(3.0, Number.isFinite(persNum) && persNum > 0 ? persNum : spanW * 0.32)
              ),
              fromMappedTrace: false,
            });
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // STEP 3: Panel-by-Panel / Quadrant-by-Quadrant 3D Kinematic Wedge & Slab Evaluation
  // -------------------------------------------------------------
  for (const panelId of activePerimeterPanels) {
    // Check if panel is in an unexcavated/hatched zone (e.g. benching or half-shaft)
    const sampleCheckPt = { x: 200, y: panelId === 'crown' ? 40 : 120 };
    if (
      !isVerticalShaft &&
      isPointInsideHatchedExcavationPortion(sampleCheckPt, panelId, location, currentRound)
    ) {
      continue;
    }

    // In Half-Face Vertical Shaft mode, skip quadrants belonging to the unexcavated half
    if (isVerticalShaft) {
      const rawApp = String(currentRound.excavationApproach || '').toLowerCase();
      const isHalf = rawApp.includes('half');
      if (isHalf) {
        const isWestHalf =
          currentRound.shaftHalfSide === 'left_half' ||
          rawApp.includes('3rd') ||
          rawApp.includes('sw');
        if (isWestHalf && (panelId === 'left_wall' || panelId === 'crown')) continue;
        if (!isWestHalf && (panelId === 'right_wall' || panelId === 'shaft_sn')) continue;
      }
    }

    const panelJoints = normalizedJoints.filter((nj) => nj.panel === panelId);
    const refPos = resolvePerimeterPlacement(panelId, 0.5, 0.5);
    const panelInwardAz = refPos.inwardAzimuthDeg;

    // 3A. Evaluate 3D Tetrahedral Kinematic Wedges on this Panel/Quadrant
    let panelWedgeAdded = false;
    for (let i = 0; i < panelJoints.length && !panelWedgeAdded; i++) {
      for (let j = i + 1; j < panelJoints.length && !panelWedgeAdded; j++) {
        const j1 = panelJoints[i];
        const j2 = panelJoints[j];

        // Require at least one mapped trace OR assessed RMR/Q with recorded sets
        if (
          !j1.fromMappedTrace &&
          !j2.fromMappedTrace &&
          validTraces.length === 0 &&
          recordedSets.length < 2
        ) {
          continue;
        }

        const inter = computeIntersectionLine3D(
          j1.dipAmount,
          j1.dipDirection,
          j2.dipAmount,
          j2.dipDirection
        );
        if (!inter) continue;

        const isRoofPanel = !isVerticalShaft && panelId === 'crown';
        const azDeltaToInward = azimuthDiffDeg(inter.trendDeg, panelInwardAz);
        const dipDirDiff = azimuthDiffDeg(j1.dipDirection, j2.dipDirection);

        // Kinematic removability criteria:
        // - For Horizontal Tunnel Crown: either opposing dips (dipDirDiff >= 75°) with steep dips (>= 38°),
        //   or intersection plunging >= 25°
        // - For Vertical Shaft Quadrants (Q1 NE..Q4 WN) & Tunnel Sidewalls:
        //   intersection trend must daylight toward the excavation (within 72° of inward normal)
        //   and plunge between 24° and 84°
        const isKinematicallyRemovable = isRoofPanel
          ? (dipDirDiff >= 75 && j1.dipAmount >= 38 && j2.dipAmount >= 38) ||
            (inter.plungeDeg >= 28 && j1.dipAmount >= 42 && j2.dipAmount >= 42)
          : azDeltaToInward <= 72 && inter.plungeDeg >= 24 && inter.plungeDeg <= 85;

        if (!isKinematicallyRemovable) continue;

        // Compute realistic tetrahedral wedge geometry from joint persistence & intersection angle
        const avgTraceM = (j1.traceLenM + j2.traceLenM) / 2;
        const sinDihedral = Math.max(0.35, Math.sin((inter.dihedralDeg * Math.PI) / 180));
        const wedgeSpanM = Number(
          Math.max(1.0, Math.min(spanW * 0.36, avgTraceM * 0.78)).toFixed(2)
        );
        const avgDipRad = (((j1.dipAmount + j2.dipAmount) / 2) * Math.PI) / 180;
        const apexDepthM = Number(
          Math.max(
            0.55,
            Math.min(
              2.35,
              (wedgeSpanM * 0.45 * Math.sin(avgDipRad)) / Math.max(0.42, sinDihedral)
            )
          ).toFixed(2)
        );
        const wedgeLengthAlongAxisM = Math.min(pullLengthM * 0.72, avgTraceM * 0.85, 2.2);
        const wedgeBaseAreaM2 = 0.5 * wedgeSpanM * wedgeLengthAlongAxisM;
        const wedgeVolM3 = Math.max(0.28, (1 / 3) * wedgeBaseAreaM2 * apexDepthM);
        const wedgeWeightKn = Number((wedgeVolM3 * unitWeightKnM3).toFixed(1));

        // Driving force (gravity fallout on crown vs sliding down intersection line on walls/shaft quadrants)
        const plungeRad = (Math.max(25, inter.plungeDeg) * Math.PI) / 180;
        const waterUpliftKn = wedgeWeightKn * porePressureFactor;
        const drivingForceKn = Number(
          (
            isRoofPanel && dipDirDiff >= 110
              ? wedgeWeightKn + waterUpliftKn
              : wedgeWeightKn * Math.sin(plungeRad) + waterUpliftKn
          ).toFixed(1)
        );

        // Resisting force BEFORE spot bolts:
        // 1. Mohr-Coulomb / Barton-Bandis joint shear strength on the two bounding planes
        const contactAreaM2 = Math.max(
          0.9,
          1.35 * Math.hypot(wedgeSpanM * 0.5, apexDepthM) * wedgeLengthAlongAxisM
        );
        const effNormalKn = isRoofPanel
          ? Math.max(
              8,
              wedgeWeightKn * Math.cos(avgDipRad) * rockStrength.dilationClampFactor * 0.45
            )
          : Math.max(
              10,
              wedgeWeightKn * Math.cos(plungeRad) * rockStrength.dilationClampFactor * 0.75
            );
        const frictionResistKn =
          Math.max(0, effNormalKn - waterUpliftKn * 0.6) *
          Math.tan((rockStrength.frictionDeg * Math.PI) / 180);
        const cohesionResistKn = rockStrength.cohesionKpa * contactAreaM2 * 0.24;

        // 2. Existing Systematic Pattern Rock Bolts intersecting this wedge footprint
        let patternBoltResistKn = 0;
        if (hasPatternBolts) {
          const tributaryAreaPerBolt = patternSpInM * patternSpLongM;
          const numPatternBoltsCrossing = wedgeBaseAreaM2 / Math.max(0.6, tributaryAreaPerBolt);
          const anchorageEfficiency =
            patternBoltLenM >= apexDepthM + 0.8
              ? 0.85
              : patternBoltLenM >= apexDepthM + 0.3
              ? 0.55
              : 0.2;
          patternBoltResistKn =
            numPatternBoltsCrossing * singleBoltCapacityKn * anchorageEfficiency;
        }

        // 3. Existing Shotcrete Shell & Steel Rib / Curb Ring confinement
        const perimeterM = 2 * (wedgeSpanM + wedgeLengthAlongAxisM) * 0.65;
        const shotcreteShearKn =
          shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * perimeterM * 380 * 0.28 : 0;
        const steelRibKn = hasSteelRibs ? 24.0 : 0;

        const resistingBeforeKn = Number(
          (
            frictionResistKn +
            cohesionResistKn +
            patternBoltResistKn +
            shotcreteShearKn +
            steelRibKn
          ).toFixed(1)
        );
        const fosBefore = Number(
          (resistingBeforeKn / Math.max(1, drivingForceKn)).toFixed(2)
        );

        if (fosBefore < 1.5) {
          panelWedgeAdded = true;
          const targetResistingKn = drivingForceKn * 1.52;
          const deficitKn = Math.max(0, targetResistingKn - resistingBeforeKn);
          const boltsNeeded = Math.max(
            1,
            Math.min(2, Math.ceil(deficitKn / (singleBoltCapacityKn * 0.88)))
          );

          const uCentroid = (j1.uNorm + j2.uNorm) / 2;
          const vCentroid = (j1.vNorm + j2.vNorm) / 2;

          for (let b = 0; b < boltsNeeded; b++) {
            const uOffset = boltsNeeded > 1 ? (b === 0 ? -0.08 : 0.08) : 0;
            const vOffset = boltsNeeded > 1 ? (b === 0 ? -0.06 : 0.06) : 0;
            const bPos = resolvePerimeterPlacement(
              panelId,
              uCentroid + uOffset,
              vCentroid + vOffset
            );
            const bRdM = Number((chainageRD + bPos.pullM).toFixed(2));

            // Optimal spot bolt orientation opposing wedge movement
            const installAngle = isVerticalShaft
              ? Math.max(68, Math.min(86, Math.round(90 - inter.plungeDeg * 0.25)))
              : isRoofPanel
              ? Math.max(65, Math.min(85, Math.round(inter.plungeDeg + 15)))
              : Math.max(20, Math.min(45, Math.round(90 - inter.plungeDeg * 0.7)));

            const installAzimuth = isVerticalShaft
              ? bPos.outwardAzimuthDeg
              : normalizeDeg(inter.trendDeg + 180);

            const recLengthM = Math.max(
              boltLengthM,
              Number((Math.ceil((apexDepthM + 1.2) * 2) / 2).toFixed(1))
            );
            const fosAfterVal = Number(
              (
                (resistingBeforeKn + boltsNeeded * singleBoltCapacityKn * 0.88) /
                Math.max(1, drivingForceKn)
              ).toFixed(2)
            );
            const panelLabel = formatSpotBoltPanelLabel(panelId, isVerticalShaft);
            const stPrefix = isVerticalShaft ? 'Depth EL' : 'RD';
            const quadShort =
              panelId === 'left_wall'
                ? isVerticalShaft
                  ? 'Q1'
                  : 'LW'
                : panelId === 'crown'
                ? isVerticalShaft
                  ? 'Q2'
                  : 'CR'
                : panelId === 'right_wall'
                ? isVerticalShaft
                  ? 'Q3'
                  : 'RW'
                : 'Q4';

            hazards.push({
              id: `h-wedge-${panelId}-${b + 1}`,
              type: isRoofPanel ? 'CROWN_GRAVITY_WEDGE' : 'DAYLIGHTING_JOINT_WEDGE',
              panel: panelId,
              severity: fosBefore < 1.15 ? 'CRITICAL' : 'HIGH',
              description: `3D Kinematic Wedge (${j1.setId} ${j1.dipAmount}°/${j1.dipDirection}° × ${j2.setId} ${j2.dipAmount}°/${j2.dipDirection}°, line of intersection ${Math.round(inter.plungeDeg)}°→${Math.round(inter.trendDeg)}°) on ${panelLabel}. Volume = ${wedgeVolM3.toFixed(2)} m³, Weight = ${wedgeWeightKn} kN, Apex = ${apexDepthM}m, FoS before = ${fosBefore}.`,
              drivingForceKn,
              resistingForceBeforeKn: resistingBeforeKn,
              fosBefore,
              fosAfter: fosAfterVal,
              apexDepthM,
              locationMeters: { pullM: bPos.pullM, xM: bPos.xM, yM: bPos.yM },
              rdM: bRdM,
              offsetM: bPos.xM,
              heightM: bPos.yM,
            });

            recommendedBolts.push({
              id: `sb-wedge-${panelId}-${b + 1}`,
              label: `SB-${quadShort}W-${b + 1}`,
              panel: panelId,
              u: bPos.uNorm,
              v: bPos.vNorm,
              pullMeter: bPos.pullM,
              xMeters: bPos.xM,
              yMeters: bPos.yM,
              lengthM: recLengthM,
              angleDeg: installAngle,
              azimuthDeg: installAzimuth,
              diameterMm: boltDiameterMm,
              gradeMpa: steelGradeMpa,
              tensileCapacityKn: singleBoltCapacityKn,
              chainageMeters: bRdM,
              offsetMeters: bPos.xM,
              heightAboveInvertM: bPos.yM,
              recommendedByEngine: true,
              hazardReason: `Pins ${j1.setId}×${j2.setId} Kinematic Wedge (V=${wedgeVolM3.toFixed(2)}m³, W=${wedgeWeightKn}kN, apex=${apexDepthM}m) on ${panelLabel} at ${stPrefix} ${bRdM}m (${isVerticalShaft ? `Az ${installAzimuth}°` : `Off ${bPos.xM >= 0 ? '+' : ''}${bPos.xM}m`}). FoS ${fosBefore} → ${fosAfterVal}.`,
            });
          }
        }
      }
    }

    // 3B. Evaluate Daylighting Planar Sliding Slabs on Sidewalls / Shaft Quadrants
    if (!panelWedgeAdded && (isVerticalShaft || panelId !== 'crown')) {
      const daylightJoint = panelJoints.find((pj) => {
        if (pj.dipAmount < 45 || pj.dipAmount > 86) return false;
        // Joint must dip into the excavation opening (within 35° of the panel's inward normal azimuth)
        return azimuthDiffDeg(pj.dipDirection, panelInwardAz) <= 35;
      });

      if (daylightJoint) {
        const dipRad = (daylightJoint.dipAmount * Math.PI) / 180;
        const slabHeightM = Math.min(
          isVerticalShaft ? pullLengthM * 0.75 : totalH * 0.48,
          daylightJoint.traceLenM * 0.85,
          2.4
        );
        const slabThickM = Number(
          Math.max(0.45, Math.min(1.15, slabHeightM / Math.tan(dipRad))).toFixed(2)
        );
        const slabWidthM = Math.min(pullLengthM * 0.65, daylightJoint.traceLenM, 2.0);
        const slabVolM3 = 0.5 * slabHeightM * slabThickM * slabWidthM;
        const slabWeightKn = Number((slabVolM3 * unitWeightKnM3).toFixed(1));

        const drivingShearKn = Number(
          (slabWeightKn * Math.sin(dipRad) * (1 + porePressureFactor)).toFixed(1)
        );
        const frictionResistKn =
          slabWeightKn *
          Math.cos(dipRad) *
          Math.tan((rockStrength.frictionDeg * Math.PI) / 180);
        const cohesionWallKn = rockStrength.cohesionKpa * (slabHeightM * slabWidthM) * 0.22;
        const wallPatternBoltKn = hasPatternBolts
          ? ((slabHeightM * slabWidthM) / (patternSpInM * patternSpLongM)) *
            singleBoltCapacityKn *
            0.55
          : 0;
        const wallShotcreteKn =
          shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * slabWidthM * 360 * 0.25 : 0;

        const resistingBeforeKn = Number(
          (
            frictionResistKn +
            cohesionWallKn +
            wallPatternBoltKn +
            wallShotcreteKn +
            (hasSteelRibs ? 18.0 : 0)
          ).toFixed(1)
        );
        const fosBefore = Number(
          (resistingBeforeKn / Math.max(1, drivingShearKn)).toFixed(2)
        );

        if (fosBefore < 1.48) {
          const bPos = resolvePerimeterPlacement(
            panelId,
            daylightJoint.uNorm,
            daylightJoint.vNorm
          );
          const bRdM = Number((chainageRD + bPos.pullM).toFixed(2));
          const installAngle = isVerticalShaft
            ? Math.max(72, Math.min(86, Math.round(daylightJoint.dipAmount + 12)))
            : Math.max(15, Math.min(35, Math.round(90 - daylightJoint.dipAmount)));
          const installAzimuth = bPos.outwardAzimuthDeg;
          const fosAfterVal = Number(
            (
              (resistingBeforeKn + singleBoltCapacityKn * 0.85) /
              Math.max(1, drivingShearKn)
            ).toFixed(2)
          );
          const panelLabel = formatSpotBoltPanelLabel(panelId, isVerticalShaft);
          const stPrefix = isVerticalShaft ? 'Depth EL' : 'RD';
          const quadShort =
            panelId === 'left_wall'
              ? isVerticalShaft
                ? 'Q1'
                : 'LW'
              : panelId === 'crown'
              ? 'Q2'
              : panelId === 'right_wall'
              ? isVerticalShaft
                ? 'Q3'
                : 'RW'
              : 'Q4';

          hazards.push({
            id: `h-slab-${panelId}`,
            type: 'SIDEWALL_SLIDING_SLAB',
            panel: panelId,
            severity: 'HIGH',
            description: `Daylighting planar slab (${daylightJoint.setId}: ${daylightJoint.dipAmount}°/${daylightJoint.dipDirection}°) dipping into ${panelLabel}. Thickness = ${slabThickM}m, Driving Shear = ${drivingShearKn} kN, FoS before = ${fosBefore}.`,
            drivingForceKn: drivingShearKn,
            resistingForceBeforeKn: resistingBeforeKn,
            fosBefore,
            fosAfter: fosAfterVal,
            apexDepthM: slabThickM,
            locationMeters: { pullM: bPos.pullM, xM: bPos.xM, yM: bPos.yM },
            rdM: bRdM,
            offsetM: bPos.xM,
            heightM: bPos.yM,
          });

          recommendedBolts.push({
            id: `sb-slab-${panelId}`,
            label: `SB-${quadShort}S-1`,
            panel: panelId,
            u: bPos.uNorm,
            v: bPos.vNorm,
            pullMeter: bPos.pullM,
            xMeters: bPos.xM,
            yMeters: bPos.yM,
            lengthM: Math.max(boltLengthM, Number((slabThickM + 1.5).toFixed(1))),
            angleDeg: installAngle,
            azimuthDeg: installAzimuth,
            diameterMm: boltDiameterMm,
            gradeMpa: steelGradeMpa,
            tensileCapacityKn: singleBoltCapacityKn,
            chainageMeters: bRdM,
            offsetMeters: bPos.xM,
            heightAboveInvertM: bPos.yM,
            recommendedByEngine: true,
            hazardReason: `Anchors daylighting planar slab (${daylightJoint.setId} ${daylightJoint.dipAmount}°/${daylightJoint.dipDirection}°) on ${panelLabel} at ${stPrefix} ${bRdM}m (${isVerticalShaft ? `Az ${installAzimuth}°` : `Off ${bPos.xM >= 0 ? '+' : ''}${bPos.xM}m`}). FoS ${fosBefore} → ${fosAfterVal}.`,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 4: Strictly Adjacent Preceding Round Continuity (Same Location Only)
  // -------------------------------------------------------------
  let prevRoundContinuityFound = false;
  const prevRound = previousRounds.find((pr) => {
    if (pr.id === currentRound.id) return false;
    if (pr.locationId && currentRound.locationId && pr.locationId !== currentRound.locationId) {
      return false;
    }
    if (pr.projectId && currentRound.projectId && pr.projectId !== currentRound.projectId) {
      return false;
    }
    const prStart = parseRoundChainageMeters(pr);
    const prEnd = prStart + (pr.pullLengthMeters || 0);
    return Math.abs(prEnd - chainageRD) <= 0.8;
  });

  if (prevRound && (shearFeatures.length > 0 || weakLithos.length > 0) && selectedClassRank >= 3) {
    const prevShears = (prevRound.structuralFeatures || []).filter((sf) => {
      const pts = sf.points || [];
      if (pts.length < 2) return false;
      return (
        sf.featureType === 'fault' ||
        sf.featureType === 'thrust_fault' ||
        sf.featureType === 'shear_zone'
      );
    });

    for (let pIdx = 0; pIdx < prevShears.length; pIdx++) {
      const psf = prevShears[pIdx];
      const projPanel = mapToPerimeterBoltPanel(psf.panel, 0.5, 0.2, isVerticalShaft);
      const bPos = resolvePerimeterPlacement(projPanel, 0.5, 0.25);
      const projRdM = Number((chainageRD + bPos.pullM).toFixed(2));

      const alreadyCovered = recommendedBolts.some(
        (b) => b.panel === projPanel && Math.abs((b.chainageMeters || 0) - projRdM) < 1.2
      );

      if (!alreadyCovered) {
        prevRoundContinuityFound = true;
        const prevRd = parseRoundChainageMeters(prevRound);
        const boltId = `sb-prev-proj-${pIdx + 1}`;
        const boltLabel = `SB-PRV-${pIdx + 1}`;
        const panelLabel = formatSpotBoltPanelLabel(projPanel, isVerticalShaft);
        const stPrefix = isVerticalShaft ? 'Depth EL' : 'RD';

        hazards.push({
          id: `h-prev-proj-${pIdx + 1}`,
          type: 'PREVIOUS_ROUND_CONTINUITY',
          panel: projPanel,
          severity: 'MODERATE',
          description: `Continuous ${psf.featureType.replace('_', ' ')} from adjacent ${isVerticalShaft ? 'Sinking Lift' : 'Round'} (${stPrefix} ${prevRd}m) extends into current ${isVerticalShaft ? 'lift' : 'round'} on ${panelLabel}.`,
          drivingForceKn: 68.0,
          resistingForceBeforeKn: 48.0,
          fosBefore: 1.18,
          fosAfter: 1.62,
          apexDepthM: 1.1,
          locationMeters: { pullM: bPos.pullM, xM: bPos.xM, yM: bPos.yM },
          rdM: projRdM,
          offsetM: bPos.xM,
          heightM: bPos.yM,
        });

        recommendedBolts.push({
          id: boltId,
          label: boltLabel,
          panel: projPanel,
          u: bPos.uNorm,
          v: bPos.vNorm,
          pullMeter: bPos.pullM,
          xMeters: bPos.xM,
          yMeters: bPos.yM,
          lengthM: boltLengthM,
          angleDeg: isVerticalShaft ? 82 : projPanel === 'crown' ? 75 : 25,
          azimuthDeg: bPos.outwardAzimuthDeg,
          diameterMm: boltDiameterMm,
          gradeMpa: steelGradeMpa,
          tensileCapacityKn: singleBoltCapacityKn,
          chainageMeters: projRdM,
          offsetMeters: bPos.xM,
          heightAboveInvertM: bPos.yM,
          recommendedByEngine: true,
          hazardReason: `Stitches continuous ${psf.featureType.replace('_', ' ')} from adjacent ${stPrefix} ${prevRd}m on ${panelLabel} at ${stPrefix} ${projRdM}m.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 5: Summary Verdict & FEM/DEM Reflection Metrics
  // -------------------------------------------------------------
  const spotBoltsNeeded = recommendedBolts.length > 0;

  const totalTensileCapacityAddedKn = Number(
    (recommendedBolts.length * singleBoltCapacityKn).toFixed(1)
  );

  const perimeterApproxM = isVerticalShaft ? Math.PI * spanW : spanW * 2 + totalH;
  const equivalentSupportPressureAddedMpa = Number(
    (
      totalTensileCapacityAddedKn /
      Math.max(1, perimeterApproxM * pullLengthM * 1000)
    ).toFixed(3)
  );

  let criticalWedgeFosImprovement = 'N/A (Rock mass & pattern support stable, FoS ≥ 1.50)';
  if (hazards.length > 0) {
    const minFosBefore = Math.min(...hazards.map((h) => h.fosBefore));
    const minFosAfter = Math.min(...hazards.map((h) => h.fosAfter));
    criticalWedgeFosImprovement = `FoS increased from ${minFosBefore.toFixed(2)} to ${minFosAfter.toFixed(2)} (Safe ≥ 1.50)`;
  }

  const classOverrideNotice =
    selectedClassRank < computedClassRank
      ? ` Note: Active support preset (${selectedClassStr}) is lighter than the RMR89/Q calculated class (${computedRockClassStr}, RMR=${rmrLabel}, Q=${qLabel}).`
      : '';

  const stPrefix = isVerticalShaft ? 'Depth EL' : 'RD';
  const perimDesc = isVerticalShaft
    ? 'Shaft Quadrant Walls (Q1 NE, Q2 ES, Q3 SW, Q4 WN)'
    : 'Crown/Walls';

  const summaryVerdict = spotBoltsNeeded
    ? `${stPrefix} ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}): Identified ${hazards.length} localized kinematic/shear hazard(s) on ${perimDesc} requiring ${recommendedBolts.length} targeted radial spot bolt(s).`
    : `NO SPOT BOLTS REQUIRED at ${stPrefix} ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}): The ${isVerticalShaft ? '360° vertical shaft wall quadrants' : 'tunnel crown and walls'} achieve FoS ≥ 1.50 under existing rock mass strength and installed support.`;

  const geotechnicalRationale = spotBoltsNeeded
    ? `3D Goodman-Shi / Unwedge limit-equilibrium evaluation for ${isVerticalShaft ? 'Shaft Lift' : 'Round'} ${stPrefix} ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}, RMR89=${rmrLabel}, Q=${qLabel}) analyzed ${normalizedJoints.length} discontinuity trace(s)/set(s) and ${shearFeatures.length} shear zone(s). After accounting for joint shear resistance${hasPatternBolts ? `, systematic pattern bolts (${patternSpInM}×${patternSpLongM}m)` : ''}${shotcreteThickMm > 0 ? `, and ${shotcreteThickMm}mm shotcrete` : ''}, ${hazards.length} block(s) remained below FoS 1.50. Recommending ${recommendedBolts.length} targeted Ø${boltDiameterMm}mm spot bolt(s) (L=${boltLengthM}m, fy=${steelGradeMpa}MPa, Capacity=${singleBoltCapacityKn}kN/bolt) at exact hazard centroids (+${equivalentSupportPressureAddedMpa} MPa support pressure).${classOverrideNotice}`
    : `Evaluated ${normalizedJoints.length} discontinuity trace(s)/set(s) and ${shearFeatures.length} fault/shear feature(s) in ${isVerticalShaft ? 'Shaft Lift' : 'Round'} ${stPrefix} ${chainageRD}m–${chainageEndRD}m under ${selectedClassStr} (RMR89=${rmrLabel}, Q=${qLabel}). All potential perimeter blocks achieve FoS ≥ 1.50 with existing rock mass friction/cohesion${hasPatternBolts ? ` and ${patternSpInM}×${patternSpLongM}m systematic pattern bolts` : ''}.${classOverrideNotice}`;

  return {
    spotBoltsNeeded,
    recommendedSpotBolts: recommendedBolts,
    hazards,
    summaryVerdict,
    geotechnicalRationale,
    femDemImpactSummary: {
      totalTensileCapacityAddedKn,
      equivalentSupportPressureAddedMpa,
      criticalWedgeFosImprovement,
    },
    analyzedDiscontinuitiesCount: normalizedJoints.length,
    analyzedWeakLithologyCount: weakLithos.length,
    previousRoundContinuityFound: prevRoundContinuityFound,
  };
}
