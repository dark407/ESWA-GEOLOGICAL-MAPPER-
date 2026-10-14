import {
  GsiCalculationResult,
  Joint,
  JointSet,
  Point2D,
  QIndexParameters,
  RmrCalculationResult,
  RockMassClassificationMethodId,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { ValidatedQSystemResult } from './rockMassClassificationEngine';

// ============================================================================
// 1. LOWER-HEMISPHERE EQUAL-AREA (SCHMIDT) STEREONET & KINEMATIC WEDGE ENGINE
// ============================================================================

export interface StereonetPlaneProjection {
  id: string;
  label: string;
  color: string;
  dipDeg: number;
  dipDirectionDeg: number;
  strikeDeg: number;
  polePoint: Point2D; // Normalized [-1, 1] on unit Schmidt net (x = East, y = North)
  greatCirclePoints: Point2D[]; // Sampled great circle arc in [-1, 1]
  perimeterContinuitySummary: string;
}

export interface KinematicWedgeIntersection {
  id: string;
  setALabel: string;
  setBLabel: string;
  trendDeg: number; // 0..360
  plungeDeg: number; // 0..90
  schmidtPoint: Point2D; // [-1, 1]
  kinematicMode: 'CROWN_FALLING_KEYBLOCK' | 'WALL_SLIDING_WEDGE' | 'STABLE_WEDGE';
  riskLevel: 'CRITICAL' | 'MODERATE' | 'LOW';
  factorOfSafetyEstimate: number;
  engineeringNote: string;
}

/**
 * Projects a lower-hemisphere line with (trendDeg 0..360 clockwise from North, plungeDeg 0..90 down)
 * onto unit Schmidt Equal-Area net [-1, 1] where +Y is North (Up) and +X is East (Right).
 */
export function trendPlungeToSchmidtXY(trendDeg: number, plungeDeg: number): Point2D {
  const clampedPlunge = Math.max(0, Math.min(90, plungeDeg));
  const zenithRad = ((90 - clampedPlunge) * Math.PI) / 180;
  // Equal-area Schmidt radius on unit circle: r = sqrt(2) * sin(zenith / 2) / sin(45 deg) = sqrt(2) * sin((90 - plunge)/2)
  const r = Math.SQRT2 * Math.sin(zenithRad / 2);
  const trendRad = (trendDeg * Math.PI) / 180;
  return {
    x: Number((r * Math.sin(trendRad)).toFixed(4)),
    y: Number((r * Math.cos(trendRad)).toFixed(4)),
  };
}

/**
 * Computes the Equal-Area Schmidt pole and great circle trace for a geological plane (dip, dipDirection).
 */
export function computeStereonetPlaneProjection(
  id: string,
  label: string,
  color: string,
  dipDeg: number,
  dipDirectionDeg: number,
  driveAzimuthDeg: number
): StereonetPlaneProjection {
  const safeDip = Math.max(0, Math.min(89.9, dipDeg));
  const safeDipDir = ((dipDirectionDeg % 360) + 360) % 360;
  const strikeDeg = (safeDipDir - 90 + 360) % 360;

  // Pole to plane has trend = (dipDirection + 180) mod 360, plunge = 90 - dip
  const poleTrend = (safeDipDir + 180) % 360;
  const polePlunge = 90 - safeDip;
  const polePoint = trendPlungeToSchmidtXY(poleTrend, polePlunge);

  // Sample great circle rake from 0 deg (strike) to 180 deg (opposite strike)
  const dipRad = (safeDip * Math.PI) / 180;
  const greatCirclePoints: Point2D[] = [];
  const numSteps = 36;

  for (let i = 0; i <= numSteps; i++) {
    const beta = (i / numSteps) * Math.PI; // angle in horizontal plane from strike (0..pi)
    // Apparent dip tan(alpha) = tan(dip) * sin(beta)
    const plungeRad = Math.atan(Math.tan(dipRad) * Math.sin(beta));
    const plungeDeg = (plungeRad * 180) / Math.PI;
    const trendDeg = (strikeDeg + (beta * 180) / Math.PI) % 360;
    greatCirclePoints.push(trendPlungeToSchmidtXY(trendDeg, plungeDeg));
  }

  // Relative angle between plane dip direction and tunnel drive direction
  const relAngle = Math.abs((((safeDipDir - driveAzimuthDeg) % 360) + 540) % 360 - 180);
  let perimeterContinuitySummary = '';
  if (safeDip < 25) {
    perimeterContinuitySummary =
      'Sub-horizontal trace across Face & both Sidewalls; potential flat roof slabbing in Crown.';
  } else if (relAngle <= 35 || relAngle >= 145) {
    perimeterContinuitySummary = `Strikes sub-perpendicular to Drive (${driveAzimuthDeg.toFixed(
      0
    )}°): traces continuously from Left Wall → Crown → Right Wall.`;
  } else {
    perimeterContinuitySummary = `Strikes sub-parallel to Drive (${driveAzimuthDeg.toFixed(
      0
    )}°): extends longitudinally along Crown/Wall over multiple rounds.`;
  }

  return {
    id,
    label,
    color,
    dipDeg: safeDip,
    dipDirectionDeg: safeDipDir,
    strikeDeg,
    polePoint,
    greatCirclePoints,
    perimeterContinuitySummary,
  };
}

/**
 * Computes pairwise wedge intersections and kinematic stability relative to tunnel drive azimuth.
 */
export function evaluateKinematicWedges(
  planes: StereonetPlaneProjection[],
  driveAzimuthDeg: number,
  frictionAngleDeg = 32
): KinematicWedgeIntersection[] {
  const results: KinematicWedgeIntersection[] = [];
  if (planes.length < 2) return results;

  // Convert plane (dip, dipDir) into inward/downward normal vector in ENU (East, North, Up)
  const planeNormal = (dipDeg: number, dipDirDeg: number) => {
    const d = (dipDeg * Math.PI) / 180;
    const az = (dipDirDeg * Math.PI) / 180;
    return {
      nx: Math.sin(d) * Math.sin(az),
      ny: Math.sin(d) * Math.cos(az),
      nz: -Math.cos(d),
    };
  };

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const A = planes[i];
      const B = planes[j];
      const nA = planeNormal(A.dipDeg, A.dipDirectionDeg);
      const nB = planeNormal(B.dipDeg, B.dipDirectionDeg);

      // Line of intersection L = nA x nB
      let lx = nA.ny * nB.nz - nA.nz * nB.ny;
      let ly = nA.nz * nB.nx - nA.nx * nB.nz;
      let lz = nA.nx * nB.ny - nA.ny * nB.nx;

      const mag = Math.hypot(lx, ly, lz);
      if (mag < 1e-4) continue;
      lx /= mag;
      ly /= mag;
      lz /= mag;

      // Ensure vector points downward (lz <= 0) for lower-hemisphere projection
      if (lz > 0) {
        lx = -lx;
        ly = -ly;
        lz = -lz;
      }

      const plungeRad = Math.asin(Math.min(1, Math.max(0, -lz)));
      const plungeDeg = Number(((plungeRad * 180) / Math.PI).toFixed(1));
      const trendDeg = Number((((Math.atan2(lx, ly) * 180) / Math.PI + 360) % 360).toFixed(1));
      const schmidtPoint = trendPlungeToSchmidtXY(trendDeg, plungeDeg);

      // Evaluate kinematic wedge mode
      const relToDrive = Math.abs((((trendDeg - driveAzimuthDeg) % 360) + 540) % 360 - 180);
      let kinematicMode: KinematicWedgeIntersection['kinematicMode'] = 'STABLE_WEDGE';
      let riskLevel: KinematicWedgeIntersection['riskLevel'] = 'LOW';
      let factorOfSafetyEstimate = 2.1;
      let engineeringNote = 'Wedge line of intersection is kinematically clamped or low plunge.';

      if (plungeDeg >= 55 && A.dipDeg >= 45 && B.dipDeg >= 45) {
        kinematicMode = 'CROWN_FALLING_KEYBLOCK';
        riskLevel = 'CRITICAL';
        factorOfSafetyEstimate = Number(Math.max(0.65, 1.4 - plungeDeg / 90).toFixed(2));
        engineeringNote = `Steep intersection (${plungeDeg}° plunge) forms potential gravity keyblock in Crown — spot rockbolts required across ${A.label} × ${B.label}.`;
      } else if (plungeDeg > frictionAngleDeg && plungeDeg < 75) {
        const tanPhi = Math.tan((frictionAngleDeg * Math.PI) / 180);
        const tanPlunge = Math.tan((plungeDeg * Math.PI) / 180);
        factorOfSafetyEstimate = Number(
          Math.max(0.75, Math.min(2.5, (tanPhi / Math.max(0.1, tanPlunge)) * 1.25)).toFixed(2)
        );
        kinematicMode = 'WALL_SLIDING_WEDGE';
        riskLevel = factorOfSafetyEstimate < 1.15 ? 'CRITICAL' : 'MODERATE';
        const wallSide = relToDrive > 45 && relToDrive < 135 ? 'Sidewall' : 'Face / Haunch';
        engineeringNote = `Daylighting sliding wedge (${plungeDeg}° > φ=${frictionAngleDeg}°) on ${wallSide} (FS ≈ ${factorOfSafetyEstimate}).`;
      }

      results.push({
        id: `${A.id}-${B.id}`,
        setALabel: A.label,
        setBLabel: B.label,
        trendDeg,
        plungeDeg,
        schmidtPoint,
        kinematicMode,
        riskLevel,
        factorOfSafetyEstimate,
        engineeringNote,
      });
    }
  }

  return results;
}

// ============================================================================
// 2. EMPIRICAL TUNNEL SUPPORT RECOMMENDATION ENGINE (BARTON Q & BIENIAWSKI RMR)
// ============================================================================

export interface EmpiricalSupportRecommendation {
  methodBasis: 'Q_SYSTEM' | 'RMR89';
  spanMeters: number;
  esr: number;
  equivalentDimensionDe: number;
  maxUnsupportedSpanMeters: number;
  supportCategoryLabel: string;
  crownBoltLengthMeters: number;
  wallBoltLengthMeters: number;
  boltSpacingMeters: string;
  shotcreteThicknessMm: string;
  steelRibsOrGirderSpec: string;
  excavationRoundLengthRec: string;
  standUpTimeEstimate: string;
  seepageInflowEstimateLpm: string;
}

export function calculateEmpiricalSupportDesign(
  qParams: QIndexParameters,
  qResult: ValidatedQSystemResult,
  rmrResult: RmrCalculationResult,
  geometry: TunnelGeometry,
  selectedMethod: RockMassClassificationMethodId
): EmpiricalSupportRecommendation {
  const span = Math.max(2.0, geometry.width || 8.4);
  const wallH = Math.max(2.0, geometry.height || 7.2);
  const esr = Math.max(0.5, qParams.esr || 1.0);
  const De = Number((span / esr).toFixed(2));
  const qVal = Math.max(0.001, qResult.qValue || 1.0);

  // Barton NGI bolt length equations: L_crown = 2 + 0.15 * B / ESR, L_wall = 2 + 0.15 * H / ESR
  const crownBoltLengthMeters = Number((2.0 + (0.15 * span) / esr).toFixed(2));
  const wallBoltLengthMeters = Number((2.0 + (0.15 * wallH) / esr).toFixed(2));
  const maxUnsupportedSpanMeters = Number((2.0 * esr * Math.pow(qVal, 0.4)).toFixed(2));

  // Seepage inflow estimate from Jw
  let seepageInflowEstimateLpm = '< 5 L/min (Dry to minor dampness)';
  if (qParams.jw <= 0.15) {
    seepageInflowEstimateLpm = '> 100 L/min (Exceptionally high inflow / pressure — drainage relief holes required)';
  } else if (qParams.jw <= 0.33) {
    seepageInflowEstimateLpm = '30 – 100 L/min (High inflow with joint filling outwash risk)';
  } else if (qParams.jw <= 0.5) {
    seepageInflowEstimateLpm = '15 – 30 L/min (Large inflow in unfilled joints)';
  } else if (qParams.jw <= 0.66) {
    seepageInflowEstimateLpm = '5 – 15 L/min (Medium dripping / local inflow)';
  }

  // If RMR is the primary method and is complete, compute RMR89 support table + Barton bolt length
  if (selectedMethod === 'RMR' && rmrResult.isComplete && rmrResult.finalRmr !== null) {
    const rmr = rmrResult.finalRmr;
    if (rmr >= 81) {
      return {
        methodBasis: 'RMR89',
        spanMeters: span,
        esr,
        equivalentDimensionDe: De,
        maxUnsupportedSpanMeters,
        supportCategoryLabel: 'RMR Class I — Very Good Rock (Spot Bolting Only)',
        crownBoltLengthMeters,
        wallBoltLengthMeters,
        boltSpacingMeters: 'Spot bolts only where required',
        shotcreteThicknessMm: 'None (or 50 mm local sealing)',
        steelRibsOrGirderSpec: 'None required',
        excavationRoundLengthRec: 'Full Face: 3.5 – 4.5 m advance',
        standUpTimeEstimate: '10+ years for 15 m span',
        seepageInflowEstimateLpm,
      };
    } else if (rmr >= 61) {
      return {
        methodBasis: 'RMR89',
        spanMeters: span,
        esr,
        equivalentDimensionDe: De,
        maxUnsupportedSpanMeters,
        supportCategoryLabel: 'RMR Class II — Good Rock (Systematic Bolting + Crown Shotcrete)',
        crownBoltLengthMeters,
        wallBoltLengthMeters,
        boltSpacingMeters: '2.0 m – 2.5 m c/c in Crown (with wire mesh)',
        shotcreteThicknessMm: '50 mm in Crown, None on Walls',
        steelRibsOrGirderSpec: 'None required',
        excavationRoundLengthRec: 'Full Face: 2.5 – 3.5 m advance',
        standUpTimeEstimate: '6 months for 8 m span',
        seepageInflowEstimateLpm,
      };
    } else if (rmr >= 41) {
      return {
        methodBasis: 'RMR89',
        spanMeters: span,
        esr,
        equivalentDimensionDe: De,
        maxUnsupportedSpanMeters,
        supportCategoryLabel: 'RMR Class III — Fair Rock (Pattern Bolts + SFRS Crown & Walls)',
        crownBoltLengthMeters,
        wallBoltLengthMeters,
        boltSpacingMeters: '1.5 m – 2.0 m c/c in Crown and Walls',
        shotcreteThicknessMm: '50 – 100 mm in Crown, 30 – 50 mm on Walls',
        steelRibsOrGirderSpec: 'None (or light ribs in fault zones)',
        excavationRoundLengthRec: 'Top Heading & Bench: 1.5 – 3.0 m advance',
        standUpTimeEstimate: '1 week for 5 m span',
        seepageInflowEstimateLpm,
      };
    } else if (rmr >= 21) {
      return {
        methodBasis: 'RMR89',
        spanMeters: span,
        esr,
        equivalentDimensionDe: De,
        maxUnsupportedSpanMeters,
        supportCategoryLabel: 'RMR Class IV — Poor Rock (Close Pattern Bolts + SFRS + Light Ribs)',
        crownBoltLengthMeters,
        wallBoltLengthMeters,
        boltSpacingMeters: '1.0 m – 1.5 m c/c in Crown and Walls with Mesh',
        shotcreteThicknessMm: '100 – 150 mm in Crown, 100 mm on Walls',
        steelRibsOrGirderSpec: 'Light to Medium Ribs / Lattice Girders @ 1.5 m c/c',
        excavationRoundLengthRec: 'Top Heading & Bench: 1.0 – 1.5 m advance (support install < 10m from face)',
        standUpTimeEstimate: '10 hours for 2.5 m span',
        seepageInflowEstimateLpm,
      };
    } else {
      return {
        methodBasis: 'RMR89',
        spanMeters: span,
        esr,
        equivalentDimensionDe: De,
        maxUnsupportedSpanMeters,
        supportCategoryLabel: 'RMR Class V — Very Poor Rock (Heavy Ribs + SFRS + Forepoling + Invert)',
        crownBoltLengthMeters,
        wallBoltLengthMeters,
        boltSpacingMeters: '1.0 m – 1.2 m c/c + Forepoling Pipe Canopy',
        shotcreteThicknessMm: '150 – 200 mm in Crown, 150 mm on Walls, 50 mm on Face',
        steelRibsOrGirderSpec: 'Heavy Steel Ribs / Lattice Girders @ 0.75 – 1.0 m c/c + Strut Invert',
        excavationRoundLengthRec: 'Multiple Drifts: 0.5 – 1.2 m advance with immediate face sealing',
        standUpTimeEstimate: '30 minutes for 1 m span',
        seepageInflowEstimateLpm,
      };
    }
  }

  // Default / Q-System Grimstad & Barton (1993) Support Chart Categories
  let supportCategoryLabel = 'Category 3 — Systematic Bolting + Unreinforced/Fiber Shotcrete';
  let boltSpacingMeters = '1.7 m – 2.1 m c/c';
  let shotcreteThicknessMm = '50 – 60 mm SFRS in Crown';
  let steelRibsOrGirderSpec = 'None required';
  let excavationRoundLengthRec = '3.0 – 4.0 m Full-Face Pull';
  let standUpTimeEstimate = 'Stable with systematic primary support';

  if (qVal >= 40) {
    supportCategoryLabel = 'Category 1 — Unsupported or Spot Bolting Only';
    boltSpacingMeters = 'Spot bolting on isolated kinematic wedges';
    shotcreteThicknessMm = 'None required';
    excavationRoundLengthRec = '4.0 – 4.5 m Full-Face Pull';
    standUpTimeEstimate = 'Long-term self-supporting span';
  } else if (qVal >= 10) {
    supportCategoryLabel = 'Category 2 — Systematic Bolting (Spot Shotcrete in Crown)';
    boltSpacingMeters = '2.0 m – 2.5 m c/c in Crown';
    shotcreteThicknessMm = '40 – 50 mm in Crown only';
    excavationRoundLengthRec = '3.5 – 4.0 m Full-Face Pull';
    standUpTimeEstimate = 'Several months to years';
  } else if (qVal >= 4) {
    supportCategoryLabel = 'Category 3 — Systematic Bolting + 50–60 mm SFRS';
    boltSpacingMeters = '1.7 m – 2.0 m c/c';
    shotcreteThicknessMm = '50 – 60 mm SFRS in Crown';
    excavationRoundLengthRec = '3.0 – 3.5 m Full-Face Pull';
    standUpTimeEstimate = 'Weeks to months';
  } else if (qVal >= 1) {
    supportCategoryLabel = 'Category 4/5 — Pattern Bolting + 60–100 mm SFRS';
    boltSpacingMeters = '1.5 m – 1.7 m c/c in Crown & Walls';
    shotcreteThicknessMm = '60 – 100 mm Fiber-Reinforced Shotcrete (SFRS)';
    excavationRoundLengthRec = '2.0 – 3.0 m Advance';
    standUpTimeEstimate = 'Days to weeks (bolt within 1 round of face)';
  } else if (qVal >= 0.1) {
    supportCategoryLabel = 'Category 6/7 — Dense Pattern Bolting + 120–150 mm SFRS + Ribs';
    boltSpacingMeters = '1.2 m – 1.5 m c/c';
    shotcreteThicknessMm = '120 – 150 mm SFRS in Crown & Walls';
    steelRibsOrGirderSpec = 'Reinforced Ribs of Sprayed Concrete (RRS) / Lattice Girders @ 1.5 m c/c';
    excavationRoundLengthRec = '1.2 – 2.0 m Advance (immediate flash-coat shotcrete)';
    standUpTimeEstimate = 'Hours (immediate support before mucking completion)';
  } else {
    supportCategoryLabel = 'Category 8/9 — Heavy RRS / Steel Ribs + 150–250 mm SFRS + Forepoling + Invert';
    boltSpacingMeters = '1.0 m – 1.2 m c/c + Spiling / Pipe Umbrella';
    shotcreteThicknessMm = '150 – 250 mm SFRS + Reinforced Invert Arch';
    steelRibsOrGirderSpec = 'Heavy Steel Sets / RRS @ 0.75 – 1.0 m c/c + Concrete Invert';
    excavationRoundLengthRec = '0.5 – 1.0 m Sequential Drift with Face Sealing';
    standUpTimeEstimate = 'Immediate (< 1 hr — forepoling required ahead of face)';
  }

  return {
    methodBasis: 'Q_SYSTEM',
    spanMeters: span,
    esr,
    equivalentDimensionDe: De,
    maxUnsupportedSpanMeters,
    supportCategoryLabel,
    crownBoltLengthMeters,
    wallBoltLengthMeters,
    boltSpacingMeters,
    shotcreteThicknessMm,
    steelRibsOrGirderSpec,
    excavationRoundLengthRec,
    standUpTimeEstimate,
    seepageInflowEstimateLpm,
  };
}

// ============================================================================
// 3. LONGITUDINAL CHAINAGE STRIP BUILDER (MULTI-STATION LOG)
// ============================================================================

export interface LongitudinalStationPoint {
  id: string;
  chainageMeters: number;
  chainageLabel: string;
  qValue: number | null;
  rmrValue: number | null;
  rqdValue: number;
  supportClassShort: string;
  isCurrentStation: boolean;
}

export function buildLongitudinalChainageStrip(
  savedProjects: SavedProjectRecord[],
  currentSettings: TunnelSettings,
  currentQ: ValidatedQSystemResult,
  currentRmr: RmrCalculationResult
): LongitudinalStationPoint[] {
  const parseCh = (raw: string): number => {
    const cleaned = raw.replace(/,/g, '').replace(/\+/g, '');
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 132;
  };

  const currentChMeters = parseCh(currentSettings.faceChainage || currentSettings.chainage || '132');
  const points: LongitudinalStationPoint[] = [];

  for (const rec of savedProjects) {
    if (rec.tunnelName.trim().toLowerCase() !== currentSettings.tunnelName.trim().toLowerCase()) {
      continue;
    }
    const qVal = rec.qIndexParams
      ? Number(
          (
            (rec.qIndexParams.rqd / Math.max(0.5, rec.qIndexParams.jn)) *
            (rec.qIndexParams.jr / Math.max(0.5, rec.qIndexParams.ja)) *
            (rec.qIndexParams.jw / Math.max(0.5, rec.qIndexParams.srf))
          ).toFixed(2)
        )
      : null;
    const rmrVal = rec.rmrParams?.intactStrengthRating
      ? (rec.rmrParams.intactStrengthRating || 0) +
        (rec.rmrParams.rqdRating || 0) +
        (rec.rmrParams.spacingRating || 0) +
        (rec.rmrParams.conditionRating || 0) +
        (rec.rmrParams.groundwaterRating || 0) +
        (rec.rmrParams.orientationAdjustmentRating || 0)
      : null;
    const rqdVal = rec.qIndexParams?.rqd ?? 70;
    const chNum = rec.numericChainageMeters || parseCh(rec.faceChainage);
    points.push({
      id: rec.id,
      chainageMeters: chNum,
      chainageLabel: rec.faceChainage || `RD ${chNum}m`,
      qValue: qVal,
      rmrValue: rmrVal,
      rqdValue: rqdVal,
      supportClassShort: 'Mapped',
      isCurrentStation: false,
    });
  }

  // Always include current station
  const existingIdx = points.findIndex((p) => Math.abs(p.chainageMeters - currentChMeters) < 0.05);
  const currentEntry: LongitudinalStationPoint = {
    id: 'current-station',
    chainageMeters: currentChMeters,
    chainageLabel: currentSettings.faceChainage || `RD ${currentChMeters.toFixed(1)}m`,
    qValue: currentQ.isComplete && currentQ.qValue !== null ? Number(currentQ.qValue.toFixed(2)) : null,
    rmrValue: currentRmr.isComplete ? currentRmr.finalRmr : null,
    rqdValue: 75,
    supportClassShort: currentRmr.isComplete
      ? currentRmr.rockMassClassLabel
      : currentQ.isComplete
      ? currentQ.rockMassClass
      : 'Active',
    isCurrentStation: true,
  };

  if (existingIdx >= 0) {
    points[existingIdx] = currentEntry;
  } else {
    points.push(currentEntry);
  }

  return points.sort((a, b) => a.chainageMeters - b.chainageMeters);
}

// ============================================================================
// 4. ONE-CLICK AUTOCAD .DXF EXPORTER FOR MAPPED GEOLOGICAL ENGINEERING SHEET
// ============================================================================

export function exportMappedGeologicalSheetToDXF(
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  joints: Joint[],
  jointSets: JointSet[],
  qResult: ValidatedQSystemResult,
  rmrResult: RmrCalculationResult,
  gsiResult: GsiCalculationResult,
  selectedMethod: RockMassClassificationMethodId,
  surveyOverlayPoints?: Point2D[]
): void {
  const lines: string[] = [];

  const pushPair = (code: number, val: string | number) => {
    lines.push(String(code));
    lines.push(String(val));
  };

  // DXF Header + Entities Section
  pushPair(0, 'SECTION');
  pushPair(2, 'HEADER');
  pushPair(9, '$INSUNITS');
  pushPair(70, 6); // 6 = Meters
  pushPair(0, 'ENDSEC');

  pushPair(0, 'SECTION');
  pushPair(2, 'ENTITIES');

  // 1. Design Tunnel Cross-Section Profile (Layer: TUNNEL_DESIGN_PROFILE, Color: 4 Cyan)
  const pts = geometry.crossSectionPoints || [];
  if (pts.length >= 2) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      pushPair(0, 'LINE');
      pushPair(8, 'TUNNEL_DESIGN_PROFILE');
      pushPair(62, 4); // Cyan
      pushPair(10, a.x.toFixed(4));
      pushPair(20, a.y.toFixed(4));
      pushPair(30, '0.0');
      pushPair(11, b.x.toFixed(4));
      pushPair(21, b.y.toFixed(4));
      pushPair(31, '0.0');
    }
  }

  // 2. Surveyed Overbreak / Underbreak Overlay Polygon (Layer: SURVEY_SCANNER_PROFILE, Color: 1 Red)
  if (surveyOverlayPoints && surveyOverlayPoints.length >= 2) {
    for (let i = 0; i < surveyOverlayPoints.length; i++) {
      const a = surveyOverlayPoints[i];
      const b = surveyOverlayPoints[(i + 1) % surveyOverlayPoints.length];
      pushPair(0, 'LINE');
      pushPair(8, 'SURVEY_SCANNER_PROFILE');
      pushPair(62, 1); // Red
      pushPair(10, a.x.toFixed(4));
      pushPair(20, a.y.toFixed(4));
      pushPair(30, '0.0');
      pushPair(11, b.x.toFixed(4));
      pushPair(21, b.y.toFixed(4));
      pushPair(31, '0.0');
    }
  }

  // 3. Centerline & Invert Datum Axes (Layer: TUNNEL_AXES, Color: 8 Gray)
  pushPair(0, 'LINE');
  pushPair(8, 'TUNNEL_AXES');
  pushPair(62, 8);
  pushPair(10, '0.0');
  pushPair(20, '-0.5');
  pushPair(30, '0.0');
  pushPair(11, '0.0');
  pushPair(21, (geometry.height + 0.8).toFixed(3));
  pushPair(31, '0.0');

  pushPair(0, 'LINE');
  pushPair(8, 'TUNNEL_AXES');
  pushPair(62, 8);
  pushPair(10, (-geometry.width / 2 - 1.0).toFixed(3));
  pushPair(20, '0.0');
  pushPair(30, '0.0');
  pushPair(11, (geometry.width / 2 + 1.0).toFixed(3));
  pushPair(21, '0.0');
  pushPair(31, '0.0');

  // 4. Mapped Face Joint Traces & Strike/Dip Annotations (Layer: MAPPED_JOINTS_<SET>)
  const faceJoints = joints.filter((j) => j.surface === 'face' && j.geometry.length >= 2);
  for (const j of faceJoints) {
    const layerName = `MAPPED_JOINTS_${j.set || 'J1'}`;
    const aciColor = j.set === 'J1' ? 1 : j.set === 'J2' ? 5 : j.set === 'J3' ? 3 : 2;
    for (let k = 0; k < j.geometry.length - 1; k++) {
      const p1 = j.geometry[k];
      const p2 = j.geometry[k + 1];
      pushPair(0, 'LINE');
      pushPair(8, layerName);
      pushPair(62, aciColor);
      pushPair(10, p1.x.toFixed(4));
      pushPair(20, p1.y.toFixed(4));
      pushPair(30, '0.0');
      pushPair(11, p2.x.toFixed(4));
      pushPair(21, p2.y.toFixed(4));
      pushPair(31, '0.0');
    }
    const mid = j.geometry[Math.floor(j.geometry.length / 2)];
    pushPair(0, 'TEXT');
    pushPair(8, layerName);
    pushPair(62, aciColor);
    pushPair(10, mid.x.toFixed(3));
    pushPair(20, (mid.y + 0.12).toFixed(3));
    pushPair(30, '0.0');
    pushPair(40, '0.18'); // text height 0.18m
    pushPair(1, `${j.id} (${j.dip}/${j.dipDirection})`);
  }

  // 5. Title Block & Rock Mass Classification Summary Text (Layer: ENGINEERING_TITLE_BLOCK)
  const textX = -geometry.width / 2;
  let textY = -1.2;
  const addTextLine = (txt: string, height = 0.22) => {
    pushPair(0, 'TEXT');
    pushPair(8, 'ENGINEERING_TITLE_BLOCK');
    pushPair(62, 7);
    pushPair(10, textX.toFixed(3));
    pushPair(20, textY.toFixed(3));
    pushPair(30, '0.0');
    pushPair(40, height.toFixed(2));
    pushPair(1, txt);
    textY -= height * 1.65;
  };

  addTextLine(
    `TUNNEL: ${settings.tunnelName} | CHAINAGE: ${settings.faceChainage} | DRIVE: ${settings.driveDirection.toFixed(1)} deg`,
    0.26
  );
  addTextLine(
    `PROFILE: ${geometry.width.toFixed(2)}m W x ${geometry.height.toFixed(2)}m H | AREA: ${(
      geometry.designAreaSqMeters || 0
    ).toFixed(2)} m2`,
    0.2
  );
  addTextLine(`ROCK MASS CLASSIFICATION METHOD: ${selectedMethod}`, 0.22);

  if (selectedMethod === 'RMR' || selectedMethod === 'BOTH_RMR_AND_Q') {
    addTextLine(
      `RMR (${rmrResult.version}): ${
        rmrResult.finalRmr !== null ? rmrResult.finalRmr : 'N/A'
      } — ${rmrResult.rockMassClassLabel}`,
      0.2
    );
  }
  if (selectedMethod === 'Q_SYSTEM' || selectedMethod === 'BOTH_RMR_AND_Q') {
    addTextLine(
      `Q-SYSTEM: Q = ${
        qResult.isComplete ? qResult.qValue.toFixed(3) : 'N/A'
      } — ${qResult.rockMassClass}`,
      0.2
    );
  }
  if (selectedMethod === 'GSI') {
    addTextLine(
      `GSI: ${gsiResult.gsiValue !== null ? gsiResult.gsiValue : 'N/A'} — ${
        gsiResult.rockMassClassLabel
      }`,
      0.2
    );
  }

  for (const js of jointSets) {
    addTextLine(
      `SET ${js.id}: Strike ${js.avgStrike} deg / Dip ${js.avgDip} deg / DipDir ${js.avgDipDirection} deg / Spacing ${js.spacing}`,
      0.18
    );
  }

  pushPair(0, 'ENDSEC');
  pushPair(0, 'EOF');

  const dxfContent = lines.join('\r\n');
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(
    /\s+/g,
    '_'
  )}_Geological_Sheet.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
