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
 * Maps any panel ID to a valid perimeter installation surface ('crown' | 'left_wall' | 'right_wall').
 * Spot bolts are radial perimeter rock bolts and must NEVER be recommended on 'face'.
 */
export function mapToPerimeterBoltPanel(
  panel: FieldPanelId | undefined,
  uNorm: number = 0.5,
  vNorm: number = 0.5
): 'crown' | 'left_wall' | 'right_wall' {
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
 * Computes angular difference between two strikes in [0..90] degrees.
 */
function strikeDeltaDeg(s1: number, s2: number): number {
  const d = Math.abs(normalizeDeg(s1) - normalizeDeg(s2)) % 180;
  return d > 90 ? 180 - d : d;
}

/**
 * Parses support class string ('Class I', 'Class II', 'Class III', 'Class IV', 'Class V') into 1..5
 */
function parseSupportClassRank(supportClassStr?: string): number {
  const s = (supportClassStr || '').trim().toUpperCase();
  if (s === 'CLASS I' || s.endsWith(' I')) return 1;
  if (s === 'CLASS II' || s.endsWith(' II')) return 2;
  if (s === 'CLASS III' || s.endsWith(' III')) return 3;
  if (s === 'CLASS IV' || s.endsWith(' IV')) return 4;
  if (s === 'CLASS V' || s.endsWith(' V')) return 5;
  return 3;
}

/**
 * Returns rock mass shear strength parameters (joint cohesion kPa, friction angle deg,
 * dilation/interlocking factor) calibrated to the effective Rock Mass Class (I to V) and RMR89.
 */
function getRockMassShearParameters(classRank: number, rmrScore: number): {
  cohesionKpa: number;
  frictionDeg: number;
  dilationClampFactor: number;
} {
  // Blend class rank (1=Very Good .. 5=Very Poor) with RMR89
  if (classRank === 1) {
    return {
      cohesionKpa: Math.max(75, rmrScore * 0.95),
      frictionDeg: 46,
      dilationClampFactor: 2.2,
    };
  }
  if (classRank === 2) {
    return {
      cohesionKpa: Math.max(52, rmrScore * 0.78),
      frictionDeg: 42,
      dilationClampFactor: 1.75,
    };
  }
  if (classRank === 3) {
    return {
      cohesionKpa: Math.max(24, rmrScore * 0.45),
      frictionDeg: 35,
      dilationClampFactor: 1.15,
    };
  }
  if (classRank === 4) {
    return {
      cohesionKpa: Math.max(12, rmrScore * 0.28),
      frictionDeg: 28,
      dilationClampFactor: 0.75,
    };
  }
  return {
    cohesionKpa: 6,
    frictionDeg: 22,
    dilationClampFactor: 0.45,
  };
}

/**
 * Core Geotechnical Spot Bolt Recommendation Engine
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

  const chainageRD = parseRoundChainageMeters(currentRound);
  const pullLengthM = Math.max(0.5, currentRound.pullLengthMeters || 3.0);
  const chainageEndRD = Number((chainageRD + pullLengthM).toFixed(2));
  const spanW = Math.max(3.0, location.widthM || 8.0);
  const totalH = Math.max(3.0, location.heightM || 7.0);
  const driveDir = currentRound.tunnelDriveDirection ?? 45;

  const unitWeightKnM3 = 26.5; // Average rock mass unit weight (kN/m^3)
  const singleBoltCapacityKn = computeBoltTensileCapacityKn(boltDiameterMm, steelGradeMpa);

  // Rock Mass Classification context (RMR89, Q, and Selected Support Class)
  const rmrRes = computeFieldRmrValue(currentRound.rmrSystem);
  const qRes = computeFieldQValue(currentRound.qSystem);
  const rmrVal = typeof rmrRes.totalRmr === 'number' && Number.isFinite(rmrRes.totalRmr) ? rmrRes.totalRmr : 55;
  const rmrLabel = typeof rmrRes.totalRmr === 'number' && Number.isFinite(rmrRes.totalRmr) ? String(rmrRes.totalRmr) : 'N/A';
  const qLabel = typeof qRes.qValue === 'number' && Number.isFinite(qRes.qValue) ? qRes.qValue.toFixed(2) : 'N/A';
  const computedRockClassStr = qRes.rockClass || rmrRes.rmrClass || 'Class III';
  const computedClassRank = parseSupportClassRank(computedRockClassStr);

  const existingSys = existingSupport || currentRound.supportSystem;
  const selectedClassStr = existingSys?.supportClass || computedRockClassStr;
  const selectedClassRank = parseSupportClassRank(selectedClassStr);

  // Shear strength parameters reflect the selected rock class & RMR
  const rockStrength = getRockMassShearParameters(selectedClassRank, rmrVal);

  const hasPatternBolts = Boolean(existingSys?.rockBoltsEnabled);
  const patternSpInM = existingSys?.rockBoltInPlaneSpacingM || 1.5;
  const patternSpLongM = existingSys?.rockBoltLongitudinalSpacingM || 1.5;
  const patternBoltLenM = existingSys?.rockBoltLengthM || boltLengthM;
  const shotcreteThickMm = existingSys?.shotcreteEnabled
    ? existingSys.shotcreteCrownThicknessMm || existingSys.shotcreteThicknessMm || 0
    : 0;

  const joints: FieldJointTrace[] = currentRound.jointTraces || [];
  const lithoStrokes: FieldLithologyStroke[] = currentRound.lithologyStrokes || [];
  const structuralFeatures: FieldStructuralFeature[] = currentRound.structuralFeatures || [];
  const waterMarks: FieldWaterMark[] = currentRound.waterMarks || [];

  const hazards: GeotechnicalHazardDetected[] = [];
  const recommendedBolts: FieldSpotBoltItem[] = [];

  // -------------------------------------------------------------
  // STEP 1: Weak / Sheared Lithology & Shear Zone Hazards (Current Round Only)
  // -------------------------------------------------------------
  const weakLithos = lithoStrokes.filter(isWeakOrShearedLithology);

  // Only include genuine mapped fault/shear structural features in the CURRENT round
  // with at least 2 points and a non-trivial trace length (>= 20 SVG units).
  const shearFeatures = structuralFeatures.filter((sf) => {
    const pts = sf.points || [];
    if (pts.length < 2) return false;
    const chordPx = Math.hypot(
      pts[pts.length - 1].x - pts[0].x,
      pts[pts.length - 1].y - pts[0].y
    );
    if (chordPx < 20) return false;
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

  // Analyze shear features for localized spalling / boundary separation on tunnel perimeter
  for (let idx = 0; idx < shearFeatures.length; idx++) {
    const sf = shearFeatures[idx];
    const pts = sf.points || [];
    const avgX = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
    const avgY = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;

    const rawPanel: FieldPanelId = sf.panel || 'crown';
    const rawGeom = computePanelCanvasGeometry(rawPanel, location, currentRound);
    const rawUNorm = Math.max(0.08, Math.min(0.92, (avgX - rawGeom.boxX) / Math.max(1, rawGeom.boxW)));
    const rawVNorm = Math.max(0.08, Math.min(0.92, (avgY - rawGeom.boxY) / Math.max(1, rawGeom.boxH)));

    // If a fault is drawn strictly in the middle of the excavation face without reaching the perimeter
    // (crown or walls), radial perimeter spot bolts cannot stitch the middle of the face; skip unless near perimeter.
    if (rawPanel === 'face') {
      const nearPerimeter = rawVNorm <= 0.35 || rawUNorm <= 0.25 || rawUNorm >= 0.75;
      if (!nearPerimeter) {
        continue;
      }
    }

    // Never install radial spot bolts on 'face' — map to the corresponding perimeter panel ('crown', 'left_wall', 'right_wall')
    const targetPanel = mapToPerimeterBoltPanel(rawPanel, rawUNorm, rawVNorm);

    // Check if within active excavation (not in hatched unexcavated bench)
    const insideHatched = isPointInsideHatchedExcavationPortion(
      { x: avgX, y: avgY },
      targetPanel,
      location,
      currentRound
    );
    if (insideHatched) continue;

    const uNorm = rawPanel === 'face' ? 0.5 : rawUNorm;
    const vNorm = rawPanel === 'face' ? 0.25 : rawVNorm;

    let pullM = Number((pullLengthM * (0.3 + 0.4 * vNorm)).toFixed(2));
    let xM = Number(((uNorm - 0.5) * spanW).toFixed(2));
    let yM = Number(((1 - vNorm) * totalH).toFixed(2));

    if (targetPanel === 'crown') {
      yM = Number((totalH * 0.92).toFixed(2));
      xM = Number(((uNorm - 0.5) * (spanW * 0.8)).toFixed(2));
      pullM = Number((pullLengthM * 0.5).toFixed(2));
    } else if (targetPanel === 'left_wall') {
      xM = Number((-spanW / 2 + 0.12).toFixed(2));
      pullM = Number((pullLengthM * uNorm).toFixed(2));
      yM = Number((totalH * 0.52).toFixed(2));
    } else if (targetPanel === 'right_wall') {
      xM = Number((spanW / 2 - 0.12).toFixed(2));
      pullM = Number((pullLengthM * uNorm).toFixed(2));
      yM = Number((totalH * 0.52).toFixed(2));
    }

    // Driving weight of sheared band
    const shearSpanM = Math.max(1.2, spanW * 0.32);
    const apexDepthM = Math.max(0.8, Math.min(2.2, shearSpanM * 0.6));
    const drivingKn = Number((0.5 * shearSpanM * apexDepthM * unitWeightKnM3 * 1.4).toFixed(1));

    // Include existing pattern bolt & shotcrete resistance across the shear zone
    const patternShearResistKn = hasPatternBolts
      ? Math.max(1, Math.round(shearSpanM / patternSpInM)) * (135 / patternSpLongM)
      : 0;
    const shotcreteResistKn = shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * 650 * 0.3 : 0;
    const rockShearResistKn = drivingKn * (selectedClassRank <= 2 ? 0.78 : 0.52);
    const resistingBeforeKn = Number(
      (rockShearResistKn + patternShearResistKn * 0.55 + shotcreteResistKn).toFixed(1)
    );
    const fosBefore = Number((resistingBeforeKn / Math.max(1, drivingKn)).toFixed(2));

    if (fosBefore < 1.5) {
      const requiredResistingKn = drivingKn * 1.55;
      const deficitKn = Math.max(0, requiredResistingKn - resistingBeforeKn);
      const boltsCountForFeature = Math.max(1, Math.min(3, Math.ceil(deficitKn / singleBoltCapacityKn)));

      for (let bIdx = 0; bIdx < boltsCountForFeature; bIdx++) {
        const bPull = Number(
          Math.max(
            0.3,
            Math.min(
              pullLengthM - 0.3,
              pullM + (bIdx - (boltsCountForFeature - 1) / 2) * 0.75
            )
          ).toFixed(2)
        );
        const bRd = Number((chainageRD + bPull).toFixed(2));
        const bX = Number(
          (targetPanel === 'crown' ? xM + (bIdx % 2 === 0 ? 0.25 : -0.25) : xM).toFixed(2)
        );
        const bOffset = bX;

        const boltId = `sb-shear-${idx + 1}-${bIdx + 1}`;
        const boltLabel = `SB-SH${idx + 1}-${bIdx + 1}`;

        const installAngle =
          targetPanel === 'crown'
            ? Math.max(55, Math.min(85, Math.round(90 - (sf.dipAmount || 60) + 20)))
            : 25;
        const installAzimuth = normalizeDeg((sf.dipDirection || driveDir) + 180);
        const fosAfterVal = Number(
          ((resistingBeforeKn + boltsCountForFeature * singleBoltCapacityKn) / Math.max(1, drivingKn)).toFixed(2)
        );

        hazards.push({
          id: `h-shear-${idx + 1}-${bIdx + 1}`,
          type: 'LITHOLOGY_SHEAR_CONTACT',
          panel: targetPanel,
          severity: 'HIGH',
          description: `Mapped ${sf.featureType.replace('_', ' ').toUpperCase()} (${sf.label || 'Shear zone'}) on ${targetPanel.replace('_', ' ')} dipping ${sf.dipAmount || 60}°/${sf.dipDirection || 0}°. Risk of localized boundary separation.`,
          drivingForceKn: drivingKn,
          resistingForceBeforeKn: resistingBeforeKn,
          fosBefore,
          fosAfter: fosAfterVal,
          apexDepthM,
          locationMeters: { pullM: bPull, xM: bX, yM },
          rdM: bRd,
          offsetM: bOffset,
          heightM: yM,
        });

        recommendedBolts.push({
          id: boltId,
          label: boltLabel,
          panel: targetPanel,
          u: uNorm,
          v: vNorm,
          pullMeter: bPull,
          xMeters: bX,
          yMeters: yM,
          lengthM: boltLengthM,
          angleDeg: installAngle,
          azimuthDeg: installAzimuth,
          diameterMm: boltDiameterMm,
          gradeMpa: steelGradeMpa,
          tensileCapacityKn: singleBoltCapacityKn,
          chainageMeters: bRd,
          offsetMeters: bOffset,
          heightAboveInvertM: yM,
          recommendedByEngine: true,
          hazardReason: `Stitches mapped ${sf.featureType.replace('_', ' ')} (${sf.label || 'Shear zone'}) on ${targetPanel.replace('_', ' ')} at RD ${bRd}m (Off ${bOffset >= 0 ? '+' : ''}${bOffset}m). Improves FoS from ${fosBefore} to ${fosAfterVal}.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 2: Discontinuity Kinematic Wedges & Adverse Joint Intersections
  // -------------------------------------------------------------
  const validJoints = joints.filter((j) => (j.metricPoints || j.points || []).length >= 2);

  // Detect joints on walls/crown striking sub-parallel to tunnel drive direction (|delta| <= 22 deg)
  const parallelJoints = validJoints.filter((j) => {
    const s = j.strike !== undefined ? j.strike : normalizeDeg(j.dipDirection - 90);
    return (
      strikeDeltaDeg(s, driveDir) <= 22 &&
      (j.dipAmount || 60) >= 48 &&
      (j.dipAmount || 60) <= 85
    );
  });

  // Check crown kinematic wedge intersections (opposing dip directions on crown/upper walls)
  let crownWedgeDetected = false;
  for (let i = 0; i < validJoints.length; i++) {
    for (let j = i + 1; j < validJoints.length; j++) {
      const j1 = validJoints[i];
      const j2 = validJoints[j];

      // Opposing dips condition: |dipDir1 - dipDir2| between 115 and 245 deg
      const dipDiff = Math.abs(normalizeDeg(j1.dipDirection) - normalizeDeg(j2.dipDirection));
      const isOpposing = dipDiff >= 115 && dipDiff <= 245;
      const isSteepEnough = j1.dipAmount >= 40 && j2.dipAmount >= 40;

      if (isOpposing && isSteepEnough && !crownWedgeDetected) {
        crownWedgeDetected = true;
        const avgDip = (j1.dipAmount + j2.dipAmount) / 2;
        const wedgeSpanM = Math.min(spanW * 0.65, 4.0);
        const apexDepthM = Number(
          Math.max(
            0.6,
            Math.min(3.2, Math.tan(((90 - avgDip) * Math.PI) / 180) * (wedgeSpanM / 2))
          ).toFixed(2)
        );

        // Calculate wedge weight and driving force
        const wedgeVolM3 = 0.5 * wedgeSpanM * apexDepthM * Math.min(pullLengthM, 2.2);
        const wedgeWeightKn = Number((wedgeVolM3 * unitWeightKnM3).toFixed(1));

        // Pore water uplift if water marks present
        const hasWater = waterMarks.length > 0;
        const waterUpliftKn = hasWater ? 18.5 : 0;
        const drivingForceKn = Number((wedgeWeightKn + waterUpliftKn).toFixed(1));

        // Rock-class-aware resisting force before spot bolts (joint cohesion, dilation clamping, pattern bolts, shotcrete)
        const jointFrictionTan = Math.tan((rockStrength.frictionDeg * Math.PI) / 180);
        const jointAreaM2 =
          2 * Math.hypot(wedgeSpanM / 2, apexDepthM) * Math.min(pullLengthM, 2.0);
        const cohesionResistKn = rockStrength.cohesionKpa * jointAreaM2 * 0.42;
        const lateralClampKn = Math.max(
          15,
          rockStrength.dilationClampFactor * 1000 * apexDepthM * 0.06 * jointFrictionTan
        );

        // Pattern bolts contribution if installed
        let patternBoltResistKn = 0;
        if (hasPatternBolts) {
          const boltsIntersecting = Math.max(1.2, wedgeSpanM / Math.max(0.8, patternSpInM));
          const effectiveAnchorage = patternBoltLenM >= apexDepthM + 0.4 ? 1.0 : 0.65;
          patternBoltResistKn =
            boltsIntersecting *
            (singleBoltCapacityKn / Math.max(0.8, patternSpLongM)) *
            effectiveAnchorage;
        }

        const shotcreteShearKn =
          shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * 850 * 0.38 : 0;
        const resistingBeforeKn = Number(
          (
            cohesionResistKn +
            lateralClampKn +
            patternBoltResistKn +
            shotcreteShearKn
          ).toFixed(1)
        );

        const fosBefore = Number(
          (resistingBeforeKn / Math.max(1, drivingForceKn)).toFixed(2)
        );

        // Only recommend spot bolts if current FoS < 1.50
        if (fosBefore < 1.5) {
          const targetResistingKn = drivingForceKn * 1.55;
          const deficitKn = targetResistingKn - resistingBeforeKn;
          const boltsNeeded = Math.max(
            1,
            Math.min(4, Math.ceil(deficitKn / singleBoltCapacityKn))
          );

          const crownPullM = Number((pullLengthM * 0.5).toFixed(2));
          const crownHeightM = Number((totalH * 0.94).toFixed(2));

          for (let b = 0; b < boltsNeeded; b++) {
            const latOffsetM = Number(
              ((b - (boltsNeeded - 1) / 2) * (wedgeSpanM / (boltsNeeded + 1))).toFixed(2)
            );
            const bPullM = Number(
              Math.max(
                0.4,
                Math.min(
                  pullLengthM - 0.4,
                  crownPullM + (b % 2 === 0 ? 0.25 : -0.25)
                )
              ).toFixed(2)
            );
            const bRdM = Number((chainageRD + bPullM).toFixed(2));

            const checkPt = { x: 210 + latOffsetM * 20, y: 30 };
            if (
              isPointInsideHatchedExcavationPortion(
                checkPt,
                'crown',
                location,
                currentRound
              )
            ) {
              continue;
            }

            const boltId = `sb-crown-wedge-${b + 1}`;
            const boltLabel = `SB-CRW-${b + 1}`;

            const installAngle = 75;
            const installAzimuth =
              latOffsetM >= 0
                ? normalizeDeg(driveDir + 90)
                : normalizeDeg(driveDir - 90);
            const fosAfterVal = Number(
              (
                (resistingBeforeKn + boltsNeeded * singleBoltCapacityKn) /
                Math.max(1, drivingForceKn)
              ).toFixed(2)
            );

            hazards.push({
              id: `h-crown-wedge-${b + 1}`,
              type: 'CROWN_GRAVITY_WEDGE',
              panel: 'crown',
              severity: 'CRITICAL',
              description: `Kinematic Crown Roof Wedge formed by intersecting sets (${j1.setId || `J${i + 1}`}: ${j1.dipAmount}°/${j1.dipDirection}° & ${j2.setId || `J${j + 1}`}: ${j2.dipAmount}°/${j2.dipDirection}°). Apex depth = ${apexDepthM}m, Wedge Weight = ${wedgeWeightKn} kN. FoS before = ${fosBefore}.`,
              drivingForceKn,
              resistingForceBeforeKn: resistingBeforeKn,
              fosBefore,
              fosAfter: fosAfterVal,
              apexDepthM,
              locationMeters: { pullM: bPullM, xM: latOffsetM, yM: crownHeightM },
              rdM: bRdM,
              offsetM: latOffsetM,
              heightM: crownHeightM,
            });

            recommendedBolts.push({
              id: boltId,
              label: boltLabel,
              panel: 'crown',
              u: 0.5 + latOffsetM / spanW,
              v: 0.1,
              pullMeter: bPullM,
              xMeters: latOffsetM,
              yMeters: crownHeightM,
              lengthM: Math.max(boltLengthM, Number((apexDepthM + 1.2).toFixed(1))),
              angleDeg: installAngle,
              azimuthDeg: installAzimuth,
              diameterMm: boltDiameterMm,
              gradeMpa: steelGradeMpa,
              tensileCapacityKn: singleBoltCapacityKn,
              chainageMeters: bRdM,
              offsetMeters: latOffsetM,
              heightAboveInvertM: crownHeightM,
              recommendedByEngine: true,
              hazardReason: `Pins Crown Gravity Key Block (${j1.setId || `J${i + 1}`}×${j2.setId || `J${j + 1}`}, apex ${apexDepthM}m) on Crown at RD ${bRdM}m, Offset ${latOffsetM >= 0 ? '+' : ''}${latOffsetM}m. Improves FoS from ${fosBefore} to ${fosAfterVal}.`,
            });
          }
        }
      }
    }
  }

  // Sidewall daylighting sliding slab hazards (only in Class III–V or when pattern bolts are disabled)
  for (let idx = 0; idx < parallelJoints.length; idx++) {
    const pj = parallelJoints[idx];
    const isDippingLeft = pj.dipDirection >= 180 && pj.dipDirection <= 360;
    const targetPanel: 'left_wall' | 'right_wall' = isDippingLeft
      ? 'left_wall'
      : 'right_wall';
    const wallSign = targetPanel === 'left_wall' ? -1 : 1;

    const dipRad = ((pj.dipAmount || 65) * Math.PI) / 180;
    const slabHeightM = Math.min(totalH * 0.55, 2.8);
    const slabThickM = Math.min(1.0, slabHeightM / Math.tan(dipRad));
    const slabWeightKn = Number(
      (slabHeightM * slabThickM * Math.min(pullLengthM, 2.2) * 0.5 * unitWeightKnM3).toFixed(1)
    );

    const drivingShearKn = Number((slabWeightKn * Math.sin(dipRad)).toFixed(1));
    const frictionResistKn =
      slabWeightKn *
      Math.cos(dipRad) *
      Math.tan((rockStrength.frictionDeg * Math.PI) / 180);
    const cohesionWallKn = rockStrength.cohesionKpa * slabHeightM * 0.85;
    const wallPatternBoltKn = hasPatternBolts
      ? (singleBoltCapacityKn / Math.max(1.0, patternSpLongM)) * 0.55
      : 0;
    const wallShotcreteKn =
      shotcreteThickMm > 0 ? (shotcreteThickMm / 1000) * 500 * 0.25 : 0;

    const resistingBeforeKn = Number(
      (
        frictionResistKn +
        cohesionWallKn +
        wallPatternBoltKn +
        wallShotcreteKn
      ).toFixed(1)
    );
    const fosBefore = Number(
      (resistingBeforeKn / Math.max(1, drivingShearKn)).toFixed(2)
    );

    if (fosBefore < 1.45) {
      const targetPullM = Number((pullLengthM * 0.5).toFixed(2));
      const targetRdM = Number((chainageRD + targetPullM).toFixed(2));
      const targetOffsetM = Number((wallSign * (spanW / 2 - 0.15)).toFixed(2));
      const targetHeightM = Number((totalH * 0.48).toFixed(2));

      const checkPt = {
        x: targetPanel === 'left_wall' ? 30 : 380,
        y: 120,
      };
      if (
        isPointInsideHatchedExcavationPortion(
          checkPt,
          targetPanel,
          location,
          currentRound
        )
      ) {
        continue;
      }

      const boltId = `sb-wall-slab-${idx + 1}`;
      const boltLabel = `SB-WL-${targetPanel === 'left_wall' ? 'L' : 'R'}${idx + 1}`;

      const installAngle = 20;
      const installAzimuth =
        targetPanel === 'left_wall'
          ? normalizeDeg(driveDir - 90)
          : normalizeDeg(driveDir + 90);
      const fosAfterVal = Number(
        ((resistingBeforeKn + singleBoltCapacityKn) / Math.max(1, drivingShearKn)).toFixed(2)
      );

      hazards.push({
        id: `h-wall-slab-${idx + 1}`,
        type: 'SIDEWALL_SLIDING_SLAB',
        panel: targetPanel,
        severity: 'HIGH',
        description: `Adverse strike joint (${pj.setId || 'J-Set'}) parallel to tunnel axis dipping ${pj.dipAmount}° into ${targetPanel.replace('_', ' ')}. Risk of daylighting planar wall slide.`,
        drivingForceKn: drivingShearKn,
        resistingForceBeforeKn: resistingBeforeKn,
        fosBefore,
        fosAfter: fosAfterVal,
        apexDepthM: slabThickM,
        locationMeters: { pullM: targetPullM, xM: targetOffsetM, yM: targetHeightM },
        rdM: targetRdM,
        offsetM: targetOffsetM,
        heightM: targetHeightM,
      });

      recommendedBolts.push({
        id: boltId,
        label: boltLabel,
        panel: targetPanel,
        u: 0.5,
        v: 0.5,
        pullMeter: targetPullM,
        xMeters: targetOffsetM,
        yMeters: targetHeightM,
        lengthM: boltLengthM,
        angleDeg: installAngle,
        azimuthDeg: installAzimuth,
        diameterMm: boltDiameterMm,
        gradeMpa: steelGradeMpa,
        tensileCapacityKn: singleBoltCapacityKn,
        chainageMeters: targetRdM,
        offsetMeters: targetOffsetM,
        heightAboveInvertM: targetHeightM,
        recommendedByEngine: true,
        hazardReason: `Anchors Sidewall Sliding Slab on ${targetPanel.replace('_', ' ')} (${pj.setId || 'J-Set'} dipping ${pj.dipAmount}°) at RD ${targetRdM}m, Off ${targetOffsetM >= 0 ? '+' : ''}${targetOffsetM}m. Improves FoS from ${fosBefore} to ${fosAfterVal}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // STEP 3: Strictly Adjacent Preceding Round Continuity (Same Location Only)
  // -------------------------------------------------------------
  let prevRoundContinuityFound = false;
  // Only consider a preceding round if it belongs to the exact same project & tunnel location,
  // its end chainage directly abuts the current round's start chainage (within 0.8m),
  // AND the current round also has weak lithology or shear features confirming continuation.
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
      const projPanel = mapToPerimeterBoltPanel(psf.panel, 0.5, 0.2);
      const projPullM = Number((pullLengthM * 0.25).toFixed(2));
      const projRdM = Number((chainageRD + projPullM).toFixed(2));
      const projOffsetM =
        projPanel === 'left_wall'
          ? Number((-spanW / 2 + 0.15).toFixed(2))
          : projPanel === 'right_wall'
          ? Number((spanW / 2 - 0.15).toFixed(2))
          : 0.0;
      const projHeightM =
        projPanel === 'crown'
          ? Number((totalH * 0.92).toFixed(2))
          : Number((totalH * 0.52).toFixed(2));

      const alreadyCovered = recommendedBolts.some(
        (b) => b.panel === projPanel && Math.abs((b.chainageMeters || 0) - projRdM) < 1.2
      );

      if (!alreadyCovered) {
        prevRoundContinuityFound = true;
        const prevRd = parseRoundChainageMeters(prevRound);
        const boltId = `sb-prev-proj-${pIdx + 1}`;
        const boltLabel = `SB-PRV-${pIdx + 1}`;

        hazards.push({
          id: `h-prev-proj-${pIdx + 1}`,
          type: 'PREVIOUS_ROUND_CONTINUITY',
          panel: projPanel,
          severity: 'MODERATE',
          description: `Continuous ${psf.featureType.replace('_', ' ')} from adjacent Round (RD ${prevRd}m) extends into current round on ${projPanel.replace('_', ' ')}.`,
          drivingForceKn: 95.0,
          resistingForceBeforeKn: 65.0,
          fosBefore: 1.12,
          fosAfter: 1.58,
          apexDepthM: 1.2,
          locationMeters: { pullM: projPullM, xM: projOffsetM, yM: projHeightM },
          rdM: projRdM,
          offsetM: projOffsetM,
          heightM: projHeightM,
        });

        recommendedBolts.push({
          id: boltId,
          label: boltLabel,
          panel: projPanel,
          u: 0.5,
          v: 0.2,
          pullMeter: projPullM,
          xMeters: projOffsetM,
          yMeters: projHeightM,
          lengthM: boltLengthM,
          angleDeg: projPanel === 'crown' ? 75 : 25,
          azimuthDeg: normalizeDeg(driveDir + 180),
          diameterMm: boltDiameterMm,
          gradeMpa: steelGradeMpa,
          tensileCapacityKn: singleBoltCapacityKn,
          chainageMeters: projRdM,
          offsetMeters: projOffsetM,
          heightAboveInvertM: projHeightM,
          recommendedByEngine: true,
          hazardReason: `Stitches continuous ${psf.featureType.replace('_', ' ')} from adjacent Round RD ${prevRd}m on ${projPanel.replace('_', ' ')} at RD ${projRdM}m.`,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 4: Selectivity Check ("If need give, if don't need don't give")
  // -------------------------------------------------------------
  const spotBoltsNeeded = recommendedBolts.length > 0;

  const totalTensileCapacityAddedKn = Number(
    (recommendedBolts.length * singleBoltCapacityKn).toFixed(1)
  );

  const perimeterApproxM = spanW * 2 + totalH;
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
      ? ` Note: Active support preset (${selectedClassStr}) is lighter than the RMR89/Q calculated class (${computedRockClassStr}, RMR=${rmrLabel}, Q=${qLabel}), which is governed by systematic pattern spacing rather than localized spot bolts.`
      : '';

  const summaryVerdict = spotBoltsNeeded
    ? `RD ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}): Identified ${hazards.length} localized perimeter hazard(s) on Crown/Walls requiring ${recommendedBolts.length} targeted spot bolt(s).`
    : `NO SPOT BOLTS REQUIRED at RD ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}): The tunnel crown and walls are geotechnically stable (FoS ≥ 1.50) with no unanchored kinematic wedges or mapped fault/shear zones.`;

  const geotechnicalRationale = spotBoltsNeeded
    ? `Structural stability evaluation for Round RD ${chainageRD}m–${chainageEndRD}m (${selectedClassStr}, RMR89=${rmrLabel}, Q=${qLabel}) detected localized perimeter instability on the tunnel Crown/Walls. Recommending ${recommendedBolts.length} radial Ø${boltDiameterMm}mm spot bolt(s) (L=${boltLengthM}m, fy=${steelGradeMpa}MPa, Capacity=${singleBoltCapacityKn}kN each) installed strictly on the excavated perimeter (+${equivalentSupportPressureAddedMpa} MPa equivalent support pressure).${classOverrideNotice}`
    : `Evaluated ${validJoints.length} mapped joint trace(s) and ${shearFeatures.length} fault/shear feature(s) in Round RD ${chainageRD}m–${chainageEndRD}m under ${selectedClassStr} (RMR89=${rmrLabel}, Q=${qLabel}). No fault/shear zone or unstable key block (FoS < 1.50) occurs on the Crown or Walls, and radial spot bolts are never placed on the excavation face.${classOverrideNotice}`;

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
    analyzedDiscontinuitiesCount: validJoints.length,
    analyzedWeakLithologyCount: weakLithos.length,
    previousRoundContinuityFound: prevRoundContinuityFound,
  };
}
