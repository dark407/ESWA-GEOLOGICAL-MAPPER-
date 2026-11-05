export type ProbeHoleSafetyStatus = 'SAFE_COMPETENT' | 'CAUTION_FRACTURED' | 'HAZARD_HIGH_INFLOW_OR_CAVITY';

export interface ProbeRunInterval {
  id: string;
  fromMeters: number;
  toMeters: number;
  ropMetersPerMin: number; // Rate of penetration (m/min)
  feedPressureBar: number; // Thrust / feed pressure (bar)
  rotationPressureBar: number; // Torque / rotation pressure (bar)
  flushWaterColor: 'Clear' | 'Slightly Milky' | 'Muddy Brown' | 'Red/Ochre' | 'Black/Graphitic' | 'Total Water Loss';
  waterInflowLMin: number; // Water inflow from hole (L/min)
  waterPressureBar: number; // Static groundwater head pressure (bar)
  estimatedRqdPct: number; // Estimated RQD from drilling response (%)
  rockMassClass: 'Class I (Very Good)' | 'Class II (Good)' | 'Class III (Fair)' | 'Class IV (Poor)' | 'Class V (Shear/Fault)';
  cavityOrFaultDetected: boolean;
  geologicalRemarks: string;
}

export interface ProbeHoleRecord {
  id: string;
  holeId: string; // e.g. "PH-01 (Face Center)"
  projectName: string;
  tunnelName: string;
  faceChainage: string;
  date: string;
  loggedBy: string;
  positionLabel: 'Crown Arch' | 'Face Center' | 'Left Wall / Springline' | 'Right Wall / Springline' | 'Left Invert' | 'Right Invert';
  collarX: number; // meters from tunnel centerline (-width/2 to +width/2)
  collarY: number; // meters above tunnel invert (0 to height)
  holeDiameterMm: number; // e.g., 76 mm or 89 mm
  totalLengthMeters: number; // e.g., 25 m
  overlapLengthMeters: number; // e.g., 5 m mandatory overlap
  azimuthDeg: number; // relative to tunnel drive or true azimuth
  lookOutAngleDeg: number; // radial look-out angle (deg)
  dipAngleDeg: number; // upward (+) or downward (-) inclination
  intervals: ProbeRunInterval[];
  updatedAt: string;
}

export interface JumboRigCalibration {
  rotationalRpm: number; // e.g., 160 RPM
  percussionPressureBar: number; // e.g., 140 bar
  hydraulicThrustFactorKnPerBar: number; // e.g., 0.85 kN/bar
  hydraulicTorqueFactorNmPerBar: number; // e.g., 14.5 Nm/bar
  drifterEfficiency: number; // e.g., 0.72
}

export const DEFAULT_JUMBO_CALIBRATION: JumboRigCalibration = {
  rotationalRpm: 160,
  percussionPressureBar: 145,
  hydraulicThrustFactorKnPerBar: 0.85,
  hydraulicTorqueFactorNmPerBar: 14.5,
  drifterEfficiency: 0.72,
};

export interface Point3DTunnel {
  x: number; // Lateral offset from tunnel centerline (m, -Left / +Right)
  y: number; // Elevation above tunnel invert (m)
  z: number; // Distance ahead of tunnel face (m, +Ahead)
}

export interface MwdIntervalComputation {
  intervalId: string;
  midDepthMeters: number;
  fromMeters: number;
  toMeters: number;
  intervalLengthMeters: number;
  ropMetersPerMin: number;
  normalizedPenetrationRate: number; // ROP / sqrt(P_feed)
  feedPressureBar: number;
  rotationPressureBar: number;
  torqueToFeedRatio: number; // P_rot / P_feed
  thrustSpecificEnergyMjM3: number; // Axial component e_t (MJ/m3)
  rotationalSpecificEnergyMjM3: number; // Rotational component e_r (MJ/m3)
  percussiveSpecificEnergyMjM3: number; // Percussive component e_p (MJ/m3)
  specificEnergyMjPerM3: number; // Total Teale DSE (MJ/m3)
  estimatedUcsMpa: number; // Correlated Unconfined Compressive Strength (MPa)
  drillingHardnessIndex: number; // 0-100
  fractureIndex: number; // Schunnesson (1998) Fracturing & Alteration Index (0-100)
  waterInflowLMin: number;
  waterPressureBar: number;
  piezometricHeadMeters: number; // m H2O
  equivalentLugeon: number; // Lu
  hydraulicConductivityMPerSec: string; // Moye (1967) K (m/s)
  predictedTunnelInflowLMinPer10m: number; // Goodman (1965) scaled inflow (L/min per 10m)
  estimatedRqdPct: number;
  estimatedRmr89: number; // Bieniawski RMR89 (0-100)
  estimatedBartonQ: number; // Barton Q-system value (0.01 - 400)
  estimatedGsi: number; // Hoek-Brown GSI (10 - 95)
  predictedStandUpTimeHours: number;
  recommendedNatmSupportClass: string;
  flushWaterColor: ProbeRunInterval['flushWaterColor'];
  rockMassClass: ProbeRunInterval['rockMassClass'];
  startXYZ: Point3DTunnel;
  midXYZ: Point3DTunnel;
  endXYZ: Point3DTunnel;
  isHazardZone: boolean;
  hazardSeverity: 'NOMINAL' | 'MODERATE_FRACTURED' | 'CRITICAL_FAULT_OR_INFLOW';
  hazardReason: string;
}

export interface FaultPlaneIntersection3D {
  detected: boolean;
  planeEquation: { nx: number; ny: number; nz: number; d: number };
  apparentDipDeg: number; // Dip of fault plane in 3D space (deg)
  strikeRelToTunnelAxisDeg: number; // Angle between fault strike and tunnel drive (deg, 90 = perpendicular)
  dipDirectionLabel: string; // e.g., "Dipping Towards Face (Unfavorable)" or "Dipping With Drive (Favorable)"
  crownIntersectionAheadM: number; // +Z distance ahead of face at Crown
  centerIntersectionAheadM: number; // +Z distance ahead of face at Tunnel Center
  invertIntersectionAheadM: number; // +Z distance ahead of face at Invert
  estimatedTrueThicknessM: number; // True thickness of shear/fault zone (m)
  intersectedHolesCount: number;
}

export interface ProbeHoleLookAheadSummary {
  overallStatus: ProbeHoleSafetyStatus;
  safeAdvanceLengthMeters: number;
  maxReachAheadMeters: number;
  mandatoryOverlapMeters: number;
  maxWaterInflowLMin: number;
  totalWaterInflowLMin: number;
  predictedUnlinedTunnelInflowLMin: number;
  maxPiezometricHeadMeters: number;
  maxEquivalentLugeon: number;
  averageRqdPct: number;
  averageSpecificEnergyMjM3: number;
  averageUcsMpa: number;
  averageRmr89: number;
  minimumBartonQ: number;
  averageGsi: number;
  fanPerimeterCoveragePct: number;
  recommendedSupportClass: string;
  recommendedMaxRoundLengthM: number;
  preGroutingTriggerActive: boolean;
  faultPlane3D: FaultPlaneIntersection3D;
  detectedHazardZones: Array<{
    holeId: string;
    fromMeters: number;
    toMeters: number;
    aheadOfFaceMeters: number;
    LateralX: number;
    ElevationY: number;
    specificEnergyMjM3: number;
    waterInflowLMin: number;
    bartonQ: number;
    reason: string;
  }>;
  engineeringRecommendation: string;
}

export interface GroutRingRecord {
  id: string;
  ringId: string;
  projectName: string;
  tunnelName: string;
  chainage: string;
  date: string;
  engineerName: string;
  schemeType: GroutSchemeType;
  targetGinBarLitersPerM: number; // e.g. 1500 bar.L/m
  maxPressureLimitBar: number; // e.g. 25 bar
  maxVolumeLimitLitersPerM: number; // e.g. 200 L/m
  lookOutAngleDeg: number;
  overlapMeters: number;
  holes: GroutHoleLog[];
  lugeonTests: LugeonTestRecord[];
  updatedAt: string;
}

export type GroutSchemeType =
  | 'PRE_EXCAVATION_UMBRELLA'
  | 'RADIAL_CONSOLIDATION_RING'
  | 'WATER_CUTOFF_FAN'
  | 'CONTACT_BACKFILL_GROUTING';

export type GroutMixType =
  | 'OPC Cement (W:C 1.0:1)'
  | 'OPC Cement (W:C 0.8:1)'
  | 'OPC Cement (W:C 0.6:1 + Superplasticizer)'
  | 'Microfine Cement (W:C 1.0:1)'
  | 'Cement-Bentonite Suspension'
  | 'Two-Component Polyurethane (PU) Resin'
  | 'Colloidal Silica Gel';

export interface GroutHoleLog {
  id: string;
  holeNumber: string; // e.g. "GH-01"
  clockPosition: string; // e.g. "10:00 Left Haunch"
  angleAroundArchDeg: number; // -90 (Left Invert) to 0 (Crown) to +90 (Right Invert)
  lengthMeters: number;
  stageFromMeters: number;
  stageToMeters: number;
  mixType: GroutMixType;
  wcRatio: number; // e.g. 0.8
  initialPressureBar: number;
  finalGaugePressureBar: number;
  targetMaxPressureBar: number;
  groutVolumeLiters: number; // Total liters injected
  cementBagsConsumed: number; // 50kg bags equivalent
  injectionDurationMin: number;
  refusalAchieved: boolean;
  refusalCriterion: 'Target Pressure Reached' | 'Volume Limit (GIN) Reached' | 'Surface Leakage / Caulked' | 'In Progress';
  preGroutWaterInflowLMin: number;
  postGroutWaterInflowLMin: number;
  remarks: string;
}

export interface LugeonPressureStep {
  stepNumber: 1 | 2 | 3 | 4 | 5;
  stepLabel: 'Low (P1)' | 'Medium (P2)' | 'Peak (P3)' | 'Medium Return (P4)' | 'Low Return (P5)';
  effectivePressureBar: number;
  waterTakeLitersPerMin: number;
  testSectionLengthMeters: number;
}

export interface LugeonTestRecord {
  id: string;
  testHoleId: string;
  chainage: string;
  stageFromMeters: number;
  stageToMeters: number;
  staticWaterPressureBar: number;
  steps: LugeonPressureStep[];
}

const PROBE_HOLE_STORAGE_KEY = 'eswa_natm_probe_holes_v1';
const GROUT_RING_STORAGE_KEY = 'eswa_natm_grout_rings_v1';

// ============================================================================
// RIGOROUS MWD DRILLING SPECIFIC ENERGY, ROCK MECHANICS & 3D LOOK-AHEAD ENGINE
// ============================================================================

export function computeHole3DPointAtDepth(
  hole: ProbeHoleRecord,
  depthAlongHoleMeters: number
): Point3DTunnel {
  const safeDepth = Number(depthAlongHoleMeters) || 0;
  const dipRad = ((Number(hole?.dipAngleDeg) || 0) * Math.PI) / 180;
  const lookOutMagRad = ((Number(hole?.lookOutAngleDeg) || 0) * Math.PI) / 180;
  const collarX = Number(hole?.collarX) || 0;
  const collarY = Number(hole?.collarY) || 3.8;
  const posLabel = String(hole?.positionLabel || 'Face Center');
  // Determine lateral outward sign from collarX or positionLabel
  let lateralSign = 0;
  if (Math.abs(collarX) > 0.25) {
    lateralSign = collarX >= 0 ? 1 : -1;
  } else if (posLabel.includes('Left')) {
    lateralSign = -1;
  } else if (posLabel.includes('Right')) {
    lateralSign = 1;
  }
  const horizProj = safeDepth * Math.cos(dipRad);
  const x = Number(
    (collarX + lateralSign * horizProj * Math.sin(lookOutMagRad)).toFixed(2)
  );
  const y = Number(
    (collarY + safeDepth * Math.sin(dipRad)).toFixed(2)
  );
  const z = Number((horizProj * Math.cos(lookOutMagRad)).toFixed(2));
  return { x, y, z };
}

export function computeMwdProfileForHole(
  hole: ProbeHoleRecord,
  rig: JumboRigCalibration = DEFAULT_JUMBO_CALIBRATION,
  tunnelWidthM = 8.5,
  tunnelHeightM = 8.5
): MwdIntervalComputation[] {
  if (!hole || !Array.isArray(hole.intervals)) return [];
  const radiusM = Math.max(0.019, (Number(hole.holeDiameterMm) || 76) / 2000);
  const areaM2 = Math.PI * radiusM * radiusM;
  const eqTunnelRadiusM = Math.max(2.0, Math.sqrt((tunnelWidthM * tunnelHeightM) / Math.PI));

  return hole.intervals.map((intv, idx) => {
    const fromM = Number(intv?.fromMeters) || idx * 6;
    const toM = Number(intv?.toMeters) || fromM + 6;
    const segLen = Math.max(0.25, toM - fromM);
    const midDepth = (fromM + toM) * 0.5;
    const ropMMin = Math.max(0.05, Number(intv?.ropMetersPerMin) || 0.5);
    const feedBar = Math.max(5, Number(intv?.feedPressureBar) || 50);
    const rotBar = Math.max(5, Number(intv?.rotationPressureBar) || 40);

    // 1. Teale (1965) & Schunnesson (1998) Mechanical Specific Energy Components (MJ/m3)
    // Axial Thrust Component: e_t = F_kN / (A_m2 * 1000)
    const thrustForceKn = feedBar * rig.hydraulicThrustFactorKnPerBar;
    const thrustSpecificEnergyMjM3 = Number(
      (thrustForceKn / (areaM2 * 1000)).toFixed(2)
    );

    // Rotational Torque Component: e_r = (2 * pi * N_rpm * T_kNm) / (A_m2 * ROP_m_min * 1000)
    const torqueKnm = (rotBar * rig.hydraulicTorqueFactorNmPerBar) / 1000;
    const rotationalSpecificEnergyMjM3 = Number(
      ((2 * Math.PI * rig.rotationalRpm * torqueKnm) / (areaM2 * ropMMin * 1000)).toFixed(1)
    );

    // Percussive Hydraulic Drifter Impact Component (calibrated to rock impedance / ROP)
    const percussiveSpecificEnergyMjM3 = Number(
      (
        ((rig.percussionPressureBar * rig.drifterEfficiency * 0.068) /
          (areaM2 * ropMMin * 1000)) *
        (feedBar / 65)
      ).toFixed(1)
    );

    const rawDse = Math.max(
      12,
      Math.min(
        750,
        thrustSpecificEnergyMjM3 +
          rotationalSpecificEnergyMjM3 +
          percussiveSpecificEnergyMjM3
      )
    );
    const specificEnergyMjPerM3 = Number(rawDse.toFixed(1));

    // 2. Normalized Penetration Rate & Torque/Feed Ratio
    const normalizedPenetrationRate = Number(
      (ropMMin / Math.sqrt(feedBar)).toFixed(3)
    );
    const torqueToFeedRatio = Number((rotBar / feedBar).toFixed(2));

    // 3. Correlated Unconfined Compressive Strength UCS_MWD (MPa) & Drilling Hardness Index (0-100)
    const rqdFactor = Math.pow(Math.max(10, intv.estimatedRqdPct) / 100, 0.35);
    const flushPenalty =
      intv.flushWaterColor === 'Total Water Loss'
        ? 0.55
        : intv.flushWaterColor === 'Muddy Brown' ||
          intv.flushWaterColor === 'Black/Graphitic'
        ? 0.68
        : intv.flushWaterColor === 'Red/Ochre'
        ? 0.78
        : intv.flushWaterColor === 'Slightly Milky'
        ? 0.92
        : 1.0;

    const estimatedUcsMpa = Number(
      Math.max(
        5,
        Math.min(260, specificEnergyMjPerM3 * 0.44 * rqdFactor * flushPenalty)
      ).toFixed(1)
    );
    const drillingHardnessIndex = Number(
      Math.max(5, Math.min(100, (estimatedUcsMpa / 200) * 100)).toFixed(0)
    );

    // 4. Schunnesson (1998) Fracturing & Alteration Index F_I (0-100)
    const ropSurgeTerm = Math.max(0, (ropMMin - 0.85) * 28);
    const rqdDeficitTerm = (100 - intv.estimatedRqdPct) * 0.58;
    const torqueAnomalyTerm =
      torqueToFeedRatio > 0.86 || torqueToFeedRatio < 0.68 ? 14 : 0;
    const flushAlterationTerm =
      intv.flushWaterColor === 'Total Water Loss'
        ? 22
        : intv.flushWaterColor === 'Muddy Brown' ||
          intv.flushWaterColor === 'Black/Graphitic'
        ? 18
        : intv.flushWaterColor === 'Red/Ochre'
        ? 12
        : intv.flushWaterColor === 'Slightly Milky'
        ? 5
        : 0;
    const fractureIndex = Number(
      Math.max(
        0,
        Math.min(
          100,
          rqdDeficitTerm + ropSurgeTerm + torqueAnomalyTerm + flushAlterationTerm
        )
      ).toFixed(0)
    );

    // 5. Synthesized Bieniawski RMR89, Barton Q-Value & Hoek-Brown GSI
    // R1: UCS Rating (0-15)
    const r1Ucs =
      estimatedUcsMpa >= 200
        ? 15
        : estimatedUcsMpa >= 100
        ? 12
        : estimatedUcsMpa >= 50
        ? 7
        : estimatedUcsMpa >= 25
        ? 4
        : 2;
    // R2: RQD Rating (3-20)
    const r2Rqd =
      intv.estimatedRqdPct >= 90
        ? 20
        : intv.estimatedRqdPct >= 75
        ? 17
        : intv.estimatedRqdPct >= 50
        ? 13
        : intv.estimatedRqdPct >= 25
        ? 8
        : 3;
    // R3: Spacing Rating (5-20)
    const r3Spacing = Math.round(5 + (intv.estimatedRqdPct / 100) * 14);
    // R4: Discontinuity Condition Rating (0-30) from flush return & cavity flag
    const r4Cond = intv.cavityOrFaultDetected
      ? 6
      : intv.flushWaterColor === 'Muddy Brown' ||
        intv.flushWaterColor === 'Black/Graphitic'
      ? 10
      : intv.flushWaterColor === 'Red/Ochre' ||
        intv.flushWaterColor === 'Total Water Loss'
      ? 14
      : intv.flushWaterColor === 'Slightly Milky'
      ? 22
      : 26;
    // R5: Groundwater Rating (0-15)
    const r5Gw =
      intv.waterInflowLMin > 125
        ? 0
        : intv.waterInflowLMin > 25
        ? 4
        : intv.waterInflowLMin > 10
        ? 7
        : intv.waterInflowLMin > 2
        ? 10
        : 15;

    const estimatedRmr89 = Math.max(
      8,
      Math.min(98, r1Ucs + r2Rqd + r3Spacing + r4Cond + r5Gw - 5)
    );
    const estimatedGsi = Math.max(10, Math.min(95, estimatedRmr89 - 5));

    // Barton Q = (RQD / Jn) * (Jr / Ja) * (Jw / SRF)
    const jn =
      intv.estimatedRqdPct >= 75
        ? 6
        : intv.estimatedRqdPct >= 50
        ? 9
        : intv.estimatedRqdPct >= 30
        ? 12
        : 15;
    const jr = intv.cavityOrFaultDetected ? 1.0 : intv.estimatedRqdPct >= 65 ? 2.0 : 1.5;
    const ja =
      intv.flushWaterColor === 'Muddy Brown' ||
      intv.flushWaterColor === 'Black/Graphitic'
        ? 6.0
        : intv.flushWaterColor === 'Red/Ochre' ||
          intv.flushWaterColor === 'Total Water Loss'
        ? 4.0
        : intv.flushWaterColor === 'Slightly Milky'
        ? 2.0
        : 1.0;
    const jw =
      intv.waterInflowLMin >= 40 || intv.waterPressureBar >= 3.5
        ? 0.33
        : intv.waterInflowLMin >= 15 || intv.waterPressureBar >= 1.5
        ? 0.5
        : intv.waterInflowLMin >= 5
        ? 0.66
        : 1.0;
    const srf = intv.cavityOrFaultDetected
      ? 7.5
      : intv.estimatedRqdPct < 35
      ? 5.0
      : intv.estimatedRqdPct < 60
      ? 2.5
      : 1.0;
    const rawQ =
      (Math.max(10, intv.estimatedRqdPct) / jn) * (jr / ja) * (jw / srf);
    const estimatedBartonQ = Number(Math.max(0.01, Math.min(400, rawQ)).toFixed(2));

    // Lauffer / Bieniawski Stand-up Time Estimate (hours) for active span
    const predictedStandUpTimeHours = Number(
      Math.max(
        0.5,
        Math.min(2400, Math.pow(10, (estimatedRmr89 - 22) / 18))
      ).toFixed(1)
    );

    const recommendedNatmSupportClass =
      estimatedRmr89 >= 81
        ? 'NATM Class I (Spot Bolts + 50mm Sealing Shotcrete)'
        : estimatedRmr89 >= 61
        ? 'NATM Class II (Systematic 3m Bolts + 75mm Fiber Shotcrete)'
        : estimatedRmr89 >= 41
        ? 'NATM Class III (4m Bolts + 150mm Mesh Shotcrete + Light Ribs)'
        : estimatedRmr89 >= 21
        ? 'NATM Class IV (Lattice Girders + Forepoling + 220mm Shotcrete)'
        : 'NATM Class V (Pipe Roof Umbrella + Pre-Grouting + Face Bolts + Invert Strut)';

    // 6. Moye (1967) & Goodman (1965) Hydrogeological Analysis
    const pBar = Math.max(0.2, intv.waterPressureBar || 0.5);
    const piezometricHeadMeters = Number((pBar * 10.197).toFixed(1));
    const equivalentLugeon = Number(
      ((10 * intv.waterInflowLMin) / (Math.max(1.0, pBar) * segLen)).toFixed(2)
    );

    const qM3PerSec = intv.waterInflowLMin / 60000;
    const kNumeric =
      qM3PerSec > 0
        ? (qM3PerSec * Math.log(Math.max(2, segLen / radiusM))) /
          (2 * Math.PI * segLen * Math.max(2.0, piezometricHeadMeters))
        : 0;
    const hydraulicConductivityMPerSec =
      kNumeric > 0 ? kNumeric.toExponential(2) : '1.00e-9';

    // Goodman (1965) Steady-State Tunnel Inflow per 10m Unlined Advance:
    // Q_tunnel = (2 * pi * K * H_w * L_advance) / ln(2 * H_w / R_eq)
    const denomLn = Math.max(
      0.85,
      Math.log(Math.max(2.4, (2 * Math.max(5, piezometricHeadMeters)) / eqTunnelRadiusM))
    );
    const qTunnelM3Sec =
      (2 * Math.PI * kNumeric * Math.max(5, piezometricHeadMeters) * 10) / denomLn;
    const predictedTunnelInflowLMinPer10m = Number(
      Math.max(intv.waterInflowLMin * 1.6, qTunnelM3Sec * 60000).toFixed(1)
    );

    // 7. 3D Coordinates along Borehole
    const startXYZ = computeHole3DPointAtDepth(hole, intv.fromMeters);
    const midXYZ = computeHole3DPointAtDepth(hole, midDepth);
    const endXYZ = computeHole3DPointAtDepth(hole, intv.toMeters);

    // 8. Multi-Parameter Anomaly & Hazard Classification
    const reasons: string[] = [];
    if (intv.cavityOrFaultDetected) reasons.push('Cavity / Shear Fault Zone');
    if (intv.waterInflowLMin >= 25)
      reasons.push(`High Water Inflow (${intv.waterInflowLMin} L/min)`);
    if (ropMMin >= 1.95)
      reasons.push(`Penetration Surge (${ropMMin.toFixed(2)} m/min)`);
    if (intv.estimatedRqdPct < 35)
      reasons.push(`Low RQD (${intv.estimatedRqdPct}%)`);
    if (intv.flushWaterColor === 'Total Water Loss')
      reasons.push('Total Drilling Flush Loss');
    if (
      intv.flushWaterColor === 'Muddy Brown' ||
      intv.flushWaterColor === 'Black/Graphitic'
    ) {
      reasons.push(`Clay/Fault Gouge Flush (${intv.flushWaterColor})`);
    }

    const isCritical =
      intv.cavityOrFaultDetected ||
      intv.waterInflowLMin >= 25 ||
      intv.estimatedRqdPct < 30 ||
      intv.flushWaterColor === 'Total Water Loss';
    const isModerate =
      !isCritical &&
      (reasons.length > 0 ||
        intv.estimatedRqdPct < 55 ||
        intv.waterInflowLMin >= 12 ||
        fractureIndex >= 55);

    const hazardSeverity: MwdIntervalComputation['hazardSeverity'] = isCritical
      ? 'CRITICAL_FAULT_OR_INFLOW'
      : isModerate
      ? 'MODERATE_FRACTURED'
      : 'NOMINAL';

    return {
      intervalId: intv.id,
      midDepthMeters: midXYZ.z,
      fromMeters: intv.fromMeters,
      toMeters: intv.toMeters,
      intervalLengthMeters: segLen,
      ropMetersPerMin: ropMMin,
      normalizedPenetrationRate,
      feedPressureBar: feedBar,
      rotationPressureBar: rotBar,
      torqueToFeedRatio,
      thrustSpecificEnergyMjM3,
      rotationalSpecificEnergyMjM3,
      percussiveSpecificEnergyMjM3,
      specificEnergyMjPerM3,
      estimatedUcsMpa,
      drillingHardnessIndex,
      fractureIndex,
      waterInflowLMin: intv.waterInflowLMin,
      waterPressureBar: pBar,
      piezometricHeadMeters,
      equivalentLugeon,
      hydraulicConductivityMPerSec,
      predictedTunnelInflowLMinPer10m,
      estimatedRqdPct: intv.estimatedRqdPct,
      estimatedRmr89,
      estimatedBartonQ,
      estimatedGsi,
      predictedStandUpTimeHours,
      recommendedNatmSupportClass,
      flushWaterColor: intv.flushWaterColor,
      rockMassClass: intv.rockMassClass,
      startXYZ,
      midXYZ,
      endXYZ,
      isHazardZone: isCritical || isModerate,
      hazardSeverity,
      hazardReason: reasons.join(' · ') || 'Competent Rock Mass',
    };
  });
}

function solve3DFaultPlaneFromHazardZones(
  hazardPoints: Array<{
    holeId: string;
    midXYZ: Point3DTunnel;
    thicknessM: number;
  }>,
  tunnelHeightM: number
): FaultPlaneIntersection3D {
  if (hazardPoints.length === 0) {
    return {
      detected: false,
      planeEquation: { nx: 0, ny: 0, nz: 1, d: 20 },
      apparentDipDeg: 0,
      strikeRelToTunnelAxisDeg: 90,
      dipDirectionLabel: 'No Adverse Fault Plane Intersected',
      crownIntersectionAheadM: 24,
      centerIntersectionAheadM: 24,
      invertIntersectionAheadM: 24,
      estimatedTrueThicknessM: 0,
      intersectedHolesCount: 0,
    };
  }

  const avgThickness =
    hazardPoints.reduce((acc, p) => acc + p.thicknessM, 0) / hazardPoints.length;

  // Deduplicate by holeId (take first major hazard per hole)
  const uniqueByHole: typeof hazardPoints = [];
  const seenHoles = new Set<string>();
  for (const hp of hazardPoints) {
    if (!seenHoles.has(hp.holeId)) {
      seenHoles.add(hp.holeId);
      uniqueByHole.push(hp);
    }
  }

  if (uniqueByHole.length >= 3) {
    const p1 = uniqueByHole[0].midXYZ;
    const p2 = uniqueByHole[1].midXYZ;
    const p3 = uniqueByHole[2].midXYZ;

    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };

    // Cross product n = v1 x v2
    let nx = v1.y * v2.z - v1.z * v2.y;
    let ny = v1.z * v2.x - v1.x * v2.z;
    let nz = v1.x * v2.y - v1.y * v2.x;
    const norm = Math.hypot(nx, ny, nz);

    if (norm > 1e-3) {
      nx /= norm;
      ny /= norm;
      nz /= norm;
      if (nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const d = nx * p1.x + ny * p1.y + nz * p1.z;
      const safeNz = Math.abs(nz) > 0.15 ? nz : 0.45;
      const zAt = (x: number, y: number) =>
        Number(Math.max(1.0, Math.min(35.0, (d - nx * x - ny * y) / safeNz)).toFixed(1));

      const crownZ = zAt(0, tunnelHeightM);
      const centerZ = zAt(0, tunnelHeightM * 0.5);
      const invertZ = zAt(0, 0);

      // True dip of plane: angle with horizontal plane (normal vector is (0, 1, 0))
      const cosDip = Math.min(1, Math.abs(ny));
      const apparentDipDeg = Number(((Math.acos(cosDip) * 180) / Math.PI).toFixed(1));

      // Strike angle relative to tunnel axis (Z axis):
      const horizNorm = Math.hypot(nx, nz) || 1;
      const strikeRelToTunnelAxisDeg = Number(
        ((Math.acos(Math.min(1, Math.abs(nx) / horizNorm)) * 180) / Math.PI).toFixed(1)
      );

      const dipDirectionLabel =
        crownZ < invertZ
          ? 'Dipping Towards Tunnel Face (Unfavorable Overhang Wedge Risk)'
          : crownZ > invertZ
          ? 'Dipping Away From Face (Favorable Forward Dip)'
          : 'Sub-Vertical Fault Zone Cutting Across Tunnel Axis';

      return {
        detected: true,
        planeEquation: {
          nx: Number(nx.toFixed(3)),
          ny: Number(ny.toFixed(3)),
          nz: Number(nz.toFixed(3)),
          d: Number(d.toFixed(2)),
        },
        apparentDipDeg: Math.max(25, Math.min(89, apparentDipDeg)),
        strikeRelToTunnelAxisDeg: Math.max(15, Math.min(90, strikeRelToTunnelAxisDeg)),
        dipDirectionLabel,
        crownIntersectionAheadM: crownZ,
        centerIntersectionAheadM: centerZ,
        invertIntersectionAheadM: invertZ,
        estimatedTrueThicknessM: Number((avgThickness * Math.abs(safeNz)).toFixed(2)),
        intersectedHolesCount: uniqueByHole.length,
      };
    }
  }

  // Fallback for 1 or 2 holes intersecting hazard zone
  const avgZ =
    uniqueByHole.reduce((s, p) => s + p.midXYZ.z, 0) / uniqueByHole.length;
  const dzDy =
    uniqueByHole.length === 2 &&
    Math.abs(uniqueByHole[0].midXYZ.y - uniqueByHole[1].midXYZ.y) > 0.5
      ? (uniqueByHole[0].midXYZ.z - uniqueByHole[1].midXYZ.z) /
        (uniqueByHole[0].midXYZ.y - uniqueByHole[1].midXYZ.y)
      : -0.25;
  const clampedSlope = Math.max(-0.8, Math.min(0.8, dzDy));
  const centerZ = Number(avgZ.toFixed(1));
  const crownZ = Number(
    Math.max(1.5, avgZ + clampedSlope * (tunnelHeightM * 0.5)).toFixed(1)
  );
  const invertZ = Number(
    Math.max(1.5, avgZ - clampedSlope * (tunnelHeightM * 0.5)).toFixed(1)
  );
  const dipDeg = Number(
    (90 - (Math.atan(Math.abs(clampedSlope)) * 180) / Math.PI).toFixed(1)
  );

  return {
    detected: true,
    planeEquation: { nx: 0.18, ny: -clampedSlope, nz: 0.95, d: centerZ },
    apparentDipDeg: dipDeg,
    strikeRelToTunnelAxisDeg: 72.5,
    dipDirectionLabel:
      crownZ <= invertZ
        ? 'Steeply Dipping Towards Tunnel Face (Crown Intersected First)'
        : 'Steeply Dipping Away From Face (Invert Intersected First)',
    crownIntersectionAheadM: crownZ,
    centerIntersectionAheadM: centerZ,
    invertIntersectionAheadM: invertZ,
    estimatedTrueThicknessM: Number((avgThickness * 0.85).toFixed(2)),
    intersectedHolesCount: uniqueByHole.length,
  };
}

export function evaluateProbeFanLookAhead(
  holes: ProbeHoleRecord[],
  rig: JumboRigCalibration = DEFAULT_JUMBO_CALIBRATION,
  tunnelWidthM = 8.5,
  tunnelHeightM = 8.5
): ProbeHoleLookAheadSummary {
  if (!holes || holes.length === 0) {
    return {
      overallStatus: 'SAFE_COMPETENT',
      safeAdvanceLengthMeters: 20,
      maxReachAheadMeters: 24,
      mandatoryOverlapMeters: 5,
      maxWaterInflowLMin: 0,
      totalWaterInflowLMin: 0,
      predictedUnlinedTunnelInflowLMin: 0,
      maxPiezometricHeadMeters: 0,
      maxEquivalentLugeon: 0,
      averageRqdPct: 75,
      averageSpecificEnergyMjM3: 180,
      averageUcsMpa: 75,
      averageRmr89: 68,
      minimumBartonQ: 8.5,
      averageGsi: 63,
      fanPerimeterCoveragePct: 0,
      recommendedSupportClass: 'NATM Class II (Systematic 3m Bolts + 75mm Shotcrete)',
      recommendedMaxRoundLengthM: 3.0,
      preGroutingTriggerActive: false,
      faultPlane3D: solve3DFaultPlaneFromHazardZones([], tunnelHeightM),
      detectedHazardZones: [],
      engineeringRecommendation:
        'Add probe holes to evaluate ground and groundwater conditions ahead of the face.',
    };
  }

  let maxWater = 0;
  let totalWater = 0;
  let maxHeadM = 0;
  let maxLu = 0;
  let maxPredictedTunnelInflow = 0;
  let totalRqdWeighted = 0;
  let totalDseWeighted = 0;
  let totalUcsWeighted = 0;
  let totalRmrWeighted = 0;
  let totalGsiWeighted = 0;
  let minBartonQ = 400;
  let totalLen = 0;
  let firstHazardDistanceAhead = Infinity;
  let maxHoleHorizontalReach = 0;
  let maxOverlap = 5.0;

  const detectedHazardZones: ProbeHoleLookAheadSummary['detectedHazardZones'] = [];
  const hazardPlaneInputs: Array<{
    holeId: string;
    midXYZ: Point3DTunnel;
    thicknessM: number;
  }> = [];

  for (const hole of holes) {
    const cosInc = Math.max(0.5, Math.cos(((hole.dipAngleDeg || 0) * Math.PI) / 180));
    const overlap = hole.overlapLengthMeters || 5.0;
    if (overlap > maxOverlap) maxOverlap = overlap;
    const holeReach = Math.max(0, hole.totalLengthMeters * cosInc - overlap);
    if (holeReach > maxHoleHorizontalReach) {
      maxHoleHorizontalReach = holeReach;
    }

    const mwdList = computeMwdProfileForHole(hole, rig, tunnelWidthM, tunnelHeightM);
    let holePeakWater = 0;

    for (let i = 0; i < hole.intervals.length; i++) {
      const intv = hole.intervals[i];
      const mwd = mwdList[i];
      const segLen = Math.max(0.5, intv.toMeters - intv.fromMeters);
      totalLen += segLen;
      totalRqdWeighted += intv.estimatedRqdPct * segLen;
      totalDseWeighted += mwd.specificEnergyMjPerM3 * segLen;
      totalUcsWeighted += mwd.estimatedUcsMpa * segLen;
      totalRmrWeighted += mwd.estimatedRmr89 * segLen;
      totalGsiWeighted += mwd.estimatedGsi * segLen;

      if (mwd.estimatedBartonQ < minBartonQ) {
        minBartonQ = mwd.estimatedBartonQ;
      }
      if (mwd.piezometricHeadMeters > maxHeadM) {
        maxHeadM = mwd.piezometricHeadMeters;
      }
      if (mwd.equivalentLugeon > maxLu) {
        maxLu = mwd.equivalentLugeon;
      }
      if (mwd.predictedTunnelInflowLMinPer10m > maxPredictedTunnelInflow) {
        maxPredictedTunnelInflow = mwd.predictedTunnelInflowLMinPer10m;
      }
      if (intv.waterInflowLMin > holePeakWater) {
        holePeakWater = intv.waterInflowLMin;
      }
      if (intv.waterInflowLMin > maxWater) {
        maxWater = intv.waterInflowLMin;
      }

      if (mwd.isHazardZone) {
        const aheadM = mwd.startXYZ.z;
        if (aheadM < firstHazardDistanceAhead) {
          firstHazardDistanceAhead = aheadM;
        }
        detectedHazardZones.push({
          holeId: hole.holeId,
          fromMeters: intv.fromMeters,
          toMeters: intv.toMeters,
          aheadOfFaceMeters: aheadM,
          LateralX: mwd.midXYZ.x,
          ElevationY: mwd.midXYZ.y,
          specificEnergyMjM3: mwd.specificEnergyMjPerM3,
          waterInflowLMin: intv.waterInflowLMin,
          bartonQ: mwd.estimatedBartonQ,
          reason: mwd.hazardReason,
        });
        hazardPlaneInputs.push({
          holeId: hole.id,
          midXYZ: mwd.midXYZ,
          thicknessM: segLen,
        });
      }
    }
    totalWater += holePeakWater;
  }

  const averageRqdPct = totalLen > 0 ? Number((totalRqdWeighted / totalLen).toFixed(1)) : 70;
  const averageSpecificEnergyMjM3 =
    totalLen > 0 ? Number((totalDseWeighted / totalLen).toFixed(1)) : 165;
  const averageUcsMpa = totalLen > 0 ? Number((totalUcsWeighted / totalLen).toFixed(1)) : 65;
  const averageRmr89 = totalLen > 0 ? Math.round(totalRmrWeighted / totalLen) : 60;
  const averageGsi = totalLen > 0 ? Math.round(totalGsiWeighted / totalLen) : 55;
  const minimumBartonQ = Number((minBartonQ === 400 ? 6.5 : minBartonQ).toFixed(2));

  // Estimate fan perimeter look-ahead coverage (%) based on number of distinct sectors covered
  const sectors = new Set<string>();
  for (const h of holes) {
    sectors.add(h.positionLabel);
    if (h.collarY > tunnelHeightM * 0.65) sectors.add('CROWN_SECTOR');
    if (h.collarX < -1.0) sectors.add('LEFT_WALL_SECTOR');
    if (h.collarX > 1.0) sectors.add('RIGHT_WALL_SECTOR');
  }
  const fanPerimeterCoveragePct = Math.min(
    100,
    Math.round(Math.min(4, holes.length) * 18 + sectors.size * 7)
  );

  let overallStatus: ProbeHoleSafetyStatus = 'SAFE_COMPETENT';
  if (
    detectedHazardZones.some(
      (z) =>
        z.reason.includes('Cavity') ||
        z.reason.includes('High Water') ||
        z.reason.includes('Total Drilling Flush Loss')
    ) ||
    totalWater >= 45 ||
    averageRqdPct < 35 ||
    minimumBartonQ < 0.4
  ) {
    overallStatus = 'HAZARD_HIGH_INFLOW_OR_CAVITY';
  } else if (
    detectedHazardZones.length > 0 ||
    totalWater >= 15 ||
    averageRqdPct < 55 ||
    minimumBartonQ < 2.0
  ) {
    overallStatus = 'CAUTION_FRACTURED';
  }

  const safeAdvanceLengthMeters = Number(
    Math.max(
      1.5,
      Math.min(
        maxHoleHorizontalReach > 0 ? maxHoleHorizontalReach : 18,
        firstHazardDistanceAhead < Infinity
          ? Math.max(1.5, firstHazardDistanceAhead - 3.0)
          : maxHoleHorizontalReach || 18
      )
    ).toFixed(1)
  );

  const preGroutingTriggerActive =
    maxWater >= 15 || totalWater >= 35 || maxLu >= 10 || overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY';

  const recommendedSupportClass =
    overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
      ? 'NATM Class V (Pipe Roof Umbrella + Pre-Excavation Grouting + Multi-Stage Face Bolting)'
      : overallStatus === 'CAUTION_FRACTURED'
      ? 'NATM Class IV (Lattice Girders + Forepoling Spiles + 200mm Fiber Shotcrete)'
      : averageRmr89 >= 65
      ? 'NATM Class II (Systematic Rock Bolts + 75mm Fiber Shotcrete)'
      : 'NATM Class III (Systematic 4m Bolts + 150mm Mesh Shotcrete)';

  const recommendedMaxRoundLengthM =
    overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
      ? 1.2
      : overallStatus === 'CAUTION_FRACTURED'
      ? 1.8
      : 3.0;

  const faultPlane3D = solve3DFaultPlaneFromHazardZones(hazardPlaneInputs, tunnelHeightM);

  let engineeringRecommendation =
    'Competent rock mass verified ahead of face. Proceed with standard NATM round length and maintain mandatory 5.0 m probe overlap.';
  if (overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY') {
    engineeringRecommendation = `CRITICAL LOOK-AHEAD ALERT: Shear/water-bearing structure intersected at +${
      firstHazardDistanceAhead < Infinity ? firstHazardDistanceAhead : 8.0
    } m ahead of face (Crown +${faultPlane3D.crownIntersectionAheadM}m, Center +${
      faultPlane3D.centerIntersectionAheadM
    }m, Fan Inflow ${totalWater.toFixed(
      0
    )} L/min, Q_min=${minimumBartonQ}). Halt full-face advance at +${safeAdvanceLengthMeters} m, execute Pre-Excavation Umbrella Grouting (Lu_max=${maxLu} Lu), and upgrade to ${recommendedSupportClass} with ≤ ${recommendedMaxRoundLengthM} m round length.`;
  } else if (overallStatus === 'CAUTION_FRACTURED') {
    engineeringRecommendation = `CAUTION: Fractured / water-bearing zone detected ahead of face (Mean RQD ${averageRqdPct}%, RMR89=${averageRmr89}, Q_min=${minimumBartonQ}, Inflow ${totalWater.toFixed(
      0
    )} L/min). Install drainage relief holes or localized consolidation grouting; limit safe advance to +${safeAdvanceLengthMeters} m (Max Round ${recommendedMaxRoundLengthM} m).`;
  }

  return {
    overallStatus,
    safeAdvanceLengthMeters,
    maxReachAheadMeters: Number((maxHoleHorizontalReach + maxOverlap).toFixed(1)),
    mandatoryOverlapMeters: maxOverlap,
    maxWaterInflowLMin: maxWater,
    totalWaterInflowLMin: Number(totalWater.toFixed(1)),
    predictedUnlinedTunnelInflowLMin: Number(maxPredictedTunnelInflow.toFixed(1)),
    maxPiezometricHeadMeters: maxHeadM,
    maxEquivalentLugeon: maxLu,
    averageRqdPct,
    averageSpecificEnergyMjM3,
    averageUcsMpa,
    averageRmr89,
    minimumBartonQ,
    averageGsi,
    fanPerimeterCoveragePct,
    recommendedSupportClass,
    recommendedMaxRoundLengthM,
    preGroutingTriggerActive,
    faultPlane3D,
    detectedHazardZones,
    engineeringRecommendation,
  };
}

// ============================================================================
// LUGEON WATER PRESSURE TEST & GIN REFUSAL CALCULATIONS
// ============================================================================

export function calculateLugeonStepValue(step: LugeonPressureStep): number {
  const len = Math.max(0.5, step.testSectionLengthMeters || 5.0);
  const pEff = Math.max(0.5, step.effectivePressureBar || 1.0);
  // Lugeon formula: Lu = (10 bar * Q (L/min)) / (P_eff (bar) * L (m))
  const lu = (10 * step.waterTakeLitersPerMin) / (pEff * len);
  return Number(lu.toFixed(2));
}

export function diagnoseLugeonFlowRegime(steps: LugeonPressureStep[]): {
  representativeLugeon: number;
  permeabilityCmPerSec: string;
  flowRegime: 'Laminar Flow' | 'Turbulent Flow' | 'Joint Dilation (Hydrojacking)' | 'Infilling Washout' | 'Void Filling';
  groutingActionRequired: string;
} {
  if (!steps || steps.length === 0) {
    return {
      representativeLugeon: 0,
      permeabilityCmPerSec: '0.0e-5',
      flowRegime: 'Laminar Flow',
      groutingActionRequired: 'No Lugeon steps recorded',
    };
  }

  const luValues = steps.map(calculateLugeonStepValue);
  const l1 = luValues[0] ?? 0;
  const l2 = luValues[1] ?? l1;
  const l3 = luValues[2] ?? l2;
  const l4 = luValues[3] ?? l2;
  const l5 = luValues[4] ?? l1;

  let flowRegime: 'Laminar Flow' | 'Turbulent Flow' | 'Joint Dilation (Hydrojacking)' | 'Infilling Washout' | 'Void Filling' =
    'Laminar Flow';

  const maxDiff = Math.max(...luValues) - Math.min(...luValues);
  if (maxDiff <= Math.max(1.2, l3 * 0.15)) {
    flowRegime = 'Laminar Flow';
  } else if (l3 < l2 * 0.85 && l3 < l1 * 0.85) {
    flowRegime = 'Turbulent Flow';
  } else if (l3 > l2 * 1.25 && Math.abs(l4 - l2) <= l2 * 0.25) {
    flowRegime = 'Joint Dilation (Hydrojacking)';
  } else if (l5 > l1 * 1.25 && l4 > l2 * 1.15) {
    flowRegime = 'Infilling Washout';
  } else if (l5 < l1 * 0.75 && l4 < l2 * 0.85) {
    flowRegime = 'Void Filling';
  }

  const repLu = Number(l3.toFixed(2));
  // 1 Lugeon ≈ 1.3 × 10^-5 cm/s
  const kVal = (repLu * 1.3e-5).toExponential(2);

  let groutingActionRequired = 'Impervious (< 1 Lu): Grouting not required.';
  if (repLu >= 25) {
    groutingActionRequired =
      'High Permeability (≥ 25 Lu): Mandatory pre-excavation OPC + accelerator consolidation grouting (W:C 0.6:1 to 0.8:1).';
  } else if (repLu >= 5) {
    groutingActionRequired =
      'Moderate Permeability (5–25 Lu): Systematic consolidation grouting recommended (OPC W:C 0.8:1 or Microfine).';
  } else if (repLu >= 1) {
    groutingActionRequired =
      'Low Tightness (1–5 Lu): Localized microfine cement or chemical seepage cutoff grouting if dry tunnel lining required.';
  }

  return {
    representativeLugeon: repLu,
    permeabilityCmPerSec: kVal,
    flowRegime,
    groutingActionRequired,
  };
}

export function evaluateGinPointStatus(
  pressureBar: number,
  volumeLitersPerMeter: number,
  targetGinBarLPerM: number,
  maxPressureBar: number,
  maxVolumeLPerM: number
): {
  currentGinProduct: number;
  ginUtilizationPct: number;
  status: 'WITHIN_ENVELOPE' | 'REFUSAL_ENVELOPE_REACHED' | 'EXCEEDED_HYDROJACKING_RISK';
  message: string;
} {
  const currentGinProduct = Number((pressureBar * volumeLitersPerMeter).toFixed(0));
  const envelopeLimitP = Math.min(maxPressureBar, targetGinBarLPerM / Math.max(1, volumeLitersPerMeter));
  const ginUtilizationPct = Number(
    Math.min(150, Math.max((pressureBar / Math.max(1, envelopeLimitP)) * 100, (volumeLitersPerMeter / Math.max(1, maxVolumeLPerM)) * 100)).toFixed(1)
  );

  if (pressureBar > maxPressureBar * 1.05 || currentGinProduct > targetGinBarLPerM * 1.08) {
    return {
      currentGinProduct,
      ginUtilizationPct,
      status: 'EXCEEDED_HYDROJACKING_RISK',
      message: 'EXCEEDS GIN ENVELOPE: Stop injection or thicken mix immediately to prevent rock hydrojacking.',
    };
  }
  if (
    ginUtilizationPct >= 92 ||
    pressureBar >= maxPressureBar * 0.95 ||
    volumeLitersPerMeter >= maxVolumeLPerM * 0.95
  ) {
    return {
      currentGinProduct,
      ginUtilizationPct,
      status: 'REFUSAL_ENVELOPE_REACHED',
      message: 'OPTIMAL GIN REFUSAL: Target GIN / Pressure / Volume boundary reached.',
    };
  }
  return {
    currentGinProduct,
    ginUtilizationPct,
    status: 'WITHIN_ENVELOPE',
    message: 'Within safe Lombardi GIN grouting envelope.',
  };
}

// ============================================================================
// DEFAULT SAMPLE DATASETS & LOCAL STORAGE PERSISTENCE
// ============================================================================

export function buildSampleProbeHoles(
  projectName = 'Himalayan Hydro Headrace Tunnel',
  tunnelName = 'Headrace Tunnel (HRT-01)',
  faceChainage = 'CH 12+450.50 m'
): ProbeHoleRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'ph-sample-1',
      holeId: 'PH-01 (Crown Arch Look-Ahead)',
      projectName,
      tunnelName,
      faceChainage,
      date: today,
      loggedBy: 'Senior Tunnel Geologist',
      positionLabel: 'Crown Arch',
      collarX: 0.0,
      collarY: 7.4,
      holeDiameterMm: 76,
      totalLengthMeters: 24.0,
      overlapLengthMeters: 5.0,
      azimuthDeg: 42,
      lookOutAngleDeg: 6,
      dipAngleDeg: 8,
      updatedAt: new Date().toISOString(),
      intervals: [
        {
          id: 'int-1',
          fromMeters: 0,
          toMeters: 6,
          ropMetersPerMin: 0.85,
          feedPressureBar: 68,
          rotationPressureBar: 54,
          flushWaterColor: 'Clear',
          waterInflowLMin: 4,
          waterPressureBar: 0.5,
          estimatedRqdPct: 82,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Fresh blocky quartzite, tight rough joints.',
        },
        {
          id: 'int-2',
          fromMeters: 6,
          toMeters: 12,
          ropMetersPerMin: 0.95,
          feedPressureBar: 64,
          rotationPressureBar: 50,
          flushWaterColor: 'Slightly Milky',
          waterInflowLMin: 8,
          waterPressureBar: 1.0,
          estimatedRqdPct: 74,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Slightly foliated quartzitic phyllite, minor seepage.',
        },
        {
          id: 'int-3',
          fromMeters: 12,
          toMeters: 18,
          ropMetersPerMin: 2.35,
          feedPressureBar: 42,
          rotationPressureBar: 32,
          flushWaterColor: 'Muddy Brown',
          waterInflowLMin: 42,
          waterPressureBar: 3.2,
          estimatedRqdPct: 26,
          rockMassClass: 'Class IV (Poor)',
          cavityOrFaultDetected: true,
          geologicalRemarks: 'Shear zone with clay gouge & water-bearing fractured quartz vein at 14.5–17.0 m.',
        },
        {
          id: 'int-4',
          fromMeters: 18,
          toMeters: 24,
          ropMetersPerMin: 1.15,
          feedPressureBar: 60,
          rotationPressureBar: 48,
          flushWaterColor: 'Slightly Milky',
          waterInflowLMin: 14,
          waterPressureBar: 1.8,
          estimatedRqdPct: 65,
          rockMassClass: 'Class III (Fair)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Recovery into moderately jointed quartzite past shear contact.',
        },
      ],
    },
    {
      id: 'ph-sample-2',
      holeId: 'PH-02 (Left Haunch Look-Ahead)',
      projectName,
      tunnelName,
      faceChainage,
      date: today,
      loggedBy: 'Senior Tunnel Geologist',
      positionLabel: 'Left Wall / Springline',
      collarX: -3.2,
      collarY: 4.5,
      holeDiameterMm: 76,
      totalLengthMeters: 24.0,
      overlapLengthMeters: 5.0,
      azimuthDeg: 36,
      lookOutAngleDeg: 7,
      dipAngleDeg: 3,
      updatedAt: new Date().toISOString(),
      intervals: [
        {
          id: 'int-2-1',
          fromMeters: 0,
          toMeters: 10,
          ropMetersPerMin: 0.88,
          feedPressureBar: 66,
          rotationPressureBar: 52,
          flushWaterColor: 'Clear',
          waterInflowLMin: 3,
          waterPressureBar: 0.4,
          estimatedRqdPct: 80,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Competent quartzite.',
        },
        {
          id: 'int-2-2',
          fromMeters: 10,
          toMeters: 16,
          ropMetersPerMin: 1.95,
          feedPressureBar: 46,
          rotationPressureBar: 36,
          flushWaterColor: 'Muddy Brown',
          waterInflowLMin: 28,
          waterPressureBar: 2.6,
          estimatedRqdPct: 34,
          rockMassClass: 'Class IV (Poor)',
          cavityOrFaultDetected: true,
          geologicalRemarks: 'Sub-parallel shear seam intersected earlier on Left Haunch (11.5–15.2 m).',
        },
        {
          id: 'int-2-3',
          fromMeters: 16,
          toMeters: 24,
          ropMetersPerMin: 1.05,
          feedPressureBar: 62,
          rotationPressureBar: 49,
          flushWaterColor: 'Clear',
          waterInflowLMin: 9,
          waterPressureBar: 1.2,
          estimatedRqdPct: 72,
          rockMassClass: 'Class III (Fair)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Moderately jointed rock beyond fault plane.',
        },
      ],
    },
    {
      id: 'ph-sample-3',
      holeId: 'PH-03 (Right Haunch Look-Ahead)',
      projectName,
      tunnelName,
      faceChainage,
      date: today,
      loggedBy: 'Senior Tunnel Geologist',
      positionLabel: 'Right Wall / Springline',
      collarX: 3.2,
      collarY: 4.5,
      holeDiameterMm: 76,
      totalLengthMeters: 24.0,
      overlapLengthMeters: 5.0,
      azimuthDeg: 48,
      lookOutAngleDeg: 7,
      dipAngleDeg: 3,
      updatedAt: new Date().toISOString(),
      intervals: [
        {
          id: 'int-3-1',
          fromMeters: 0,
          toMeters: 14,
          ropMetersPerMin: 0.82,
          feedPressureBar: 70,
          rotationPressureBar: 55,
          flushWaterColor: 'Clear',
          waterInflowLMin: 5,
          waterPressureBar: 0.6,
          estimatedRqdPct: 84,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Hard massive quartzite up to 14 m.',
        },
        {
          id: 'int-3-2',
          fromMeters: 14,
          toMeters: 20,
          ropMetersPerMin: 1.75,
          feedPressureBar: 49,
          rotationPressureBar: 38,
          flushWaterColor: 'Red/Ochre',
          waterInflowLMin: 19,
          waterPressureBar: 2.1,
          estimatedRqdPct: 42,
          rockMassClass: 'Class IV (Poor)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Iron-stained fractured zone with moderate water ingress.',
        },
        {
          id: 'int-3-3',
          fromMeters: 20,
          toMeters: 24,
          ropMetersPerMin: 0.92,
          feedPressureBar: 65,
          rotationPressureBar: 51,
          flushWaterColor: 'Clear',
          waterInflowLMin: 6,
          waterPressureBar: 0.9,
          estimatedRqdPct: 76,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Competent rock mass restored.',
        },
      ],
    },
  ];
}

export function buildSampleGroutRing(
  projectName = 'Himalayan Hydro Headrace Tunnel',
  tunnelName = 'Headrace Tunnel (HRT-01)',
  chainage = 'CH 12+450.50 m'
): GroutRingRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: 'grout-ring-sample-1',
    ringId: 'GR-UMBRELLA-01 (CH 12+450.50)',
    projectName,
    tunnelName,
    chainage,
    date: today,
    engineerName: 'Senior Geotechnical Engineer',
    schemeType: 'PRE_EXCAVATION_UMBRELLA',
    targetGinBarLitersPerM: 1800,
    maxPressureLimitBar: 25,
    maxVolumeLimitLitersPerM: 180,
    lookOutAngleDeg: 7,
    overlapMeters: 5.0,
    updatedAt: new Date().toISOString(),
    holes: [
      {
        id: 'gh-1',
        holeNumber: 'GH-01',
        clockPosition: '09:30 Left Springline',
        angleAroundArchDeg: -70,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'OPC Cement (W:C 0.8:1)',
        wcRatio: 0.8,
        initialPressureBar: 6,
        finalGaugePressureBar: 22,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 1380,
        cementBagsConsumed: 21.5,
        injectionDurationMin: 38,
        refusalAchieved: true,
        refusalCriterion: 'Target Pressure Reached',
        preGroutWaterInflowLMin: 28,
        postGroutWaterInflowLMin: 1.5,
        remarks: 'High take in fractured shear seam at 11–15 m; sealed tightly.',
      },
      {
        id: 'gh-2',
        holeNumber: 'GH-02',
        clockPosition: '10:30 Left Haunch',
        angleAroundArchDeg: -42,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'OPC Cement (W:C 0.8:1)',
        wcRatio: 0.8,
        initialPressureBar: 5,
        finalGaugePressureBar: 19,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 1690,
        cementBagsConsumed: 26.4,
        injectionDurationMin: 46,
        refusalAchieved: true,
        refusalCriterion: 'Volume Limit (GIN) Reached',
        preGroutWaterInflowLMin: 36,
        postGroutWaterInflowLMin: 2.0,
        remarks: 'Reached GIN hyperbolic envelope (P*V = 1784 bar.L/m).',
      },
      {
        id: 'gh-3',
        holeNumber: 'GH-03',
        clockPosition: '11:30 Left Crown',
        angleAroundArchDeg: -15,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'OPC Cement (W:C 0.6:1 + Superplasticizer)',
        wcRatio: 0.6,
        initialPressureBar: 7,
        finalGaugePressureBar: 24,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 1290,
        cementBagsConsumed: 23.2,
        injectionDurationMin: 34,
        refusalAchieved: true,
        refusalCriterion: 'Target Pressure Reached',
        preGroutWaterInflowLMin: 42,
        postGroutWaterInflowLMin: 1.2,
        remarks: 'Thickened to 0.6:1 W:C for crown shear zone; full pressure refusal achieved.',
      },
      {
        id: 'gh-4',
        holeNumber: 'GH-04',
        clockPosition: '12:00 Crown Center',
        angleAroundArchDeg: 0,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'OPC Cement (W:C 0.8:1)',
        wcRatio: 0.8,
        initialPressureBar: 8,
        finalGaugePressureBar: 24.5,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 1120,
        cementBagsConsumed: 17.5,
        injectionDurationMin: 29,
        refusalAchieved: true,
        refusalCriterion: 'Target Pressure Reached',
        preGroutWaterInflowLMin: 24,
        postGroutWaterInflowLMin: 0.8,
        remarks: 'Interconnected with GH-03; rapid pressure build-up.',
      },
      {
        id: 'gh-5',
        holeNumber: 'GH-05',
        clockPosition: '01:00 Right Crown',
        angleAroundArchDeg: 25,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'OPC Cement (W:C 0.8:1)',
        wcRatio: 0.8,
        initialPressureBar: 7,
        finalGaugePressureBar: 23,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 980,
        cementBagsConsumed: 15.3,
        injectionDurationMin: 26,
        refusalAchieved: true,
        refusalCriterion: 'Target Pressure Reached',
        preGroutWaterInflowLMin: 19,
        postGroutWaterInflowLMin: 0.5,
        remarks: 'Steady pressure rise to 23 bar refusal.',
      },
      {
        id: 'gh-6',
        holeNumber: 'GH-06',
        clockPosition: '02:30 Right Haunch',
        angleAroundArchDeg: 60,
        lengthMeters: 18,
        stageFromMeters: 0,
        stageToMeters: 18,
        mixType: 'Microfine Cement (W:C 1.0:1)',
        wcRatio: 1.0,
        initialPressureBar: 9,
        finalGaugePressureBar: 25,
        targetMaxPressureBar: 25,
        groutVolumeLiters: 640,
        cementBagsConsumed: 8.5,
        injectionDurationMin: 22,
        refusalAchieved: true,
        refusalCriterion: 'Target Pressure Reached',
        preGroutWaterInflowLMin: 9,
        postGroutWaterInflowLMin: 0.2,
        remarks: 'Tight joints on right haunch sealed with microfine suspension.',
      },
    ],
    lugeonTests: [
      {
        id: 'lu-test-1',
        testHoleId: 'GH-03 (Pre-Grouting Check)',
        chainage,
        stageFromMeters: 10,
        stageToMeters: 18,
        staticWaterPressureBar: 2.5,
        steps: [
          {
            stepNumber: 1,
            stepLabel: 'Low (P1)',
            effectivePressureBar: 4.0,
            waterTakeLitersPerMin: 56,
            testSectionLengthMeters: 8.0,
          },
          {
            stepNumber: 2,
            stepLabel: 'Medium (P2)',
            effectivePressureBar: 7.0,
            waterTakeLitersPerMin: 95,
            testSectionLengthMeters: 8.0,
          },
          {
            stepNumber: 3,
            stepLabel: 'Peak (P3)',
            effectivePressureBar: 10.0,
            waterTakeLitersPerMin: 138,
            testSectionLengthMeters: 8.0,
          },
          {
            stepNumber: 4,
            stepLabel: 'Medium Return (P4)',
            effectivePressureBar: 7.0,
            waterTakeLitersPerMin: 92,
            testSectionLengthMeters: 8.0,
          },
          {
            stepNumber: 5,
            stepLabel: 'Low Return (P5)',
            effectivePressureBar: 4.0,
            waterTakeLitersPerMin: 53,
            testSectionLengthMeters: 8.0,
          },
        ],
      },
    ],
  };
}

export function loadSavedProbeHoles(): ProbeHoleRecord[] {
  try {
    const raw = localStorage.getItem(PROBE_HOLE_STORAGE_KEY);
    if (!raw) return buildSampleProbeHoles();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sample = buildSampleProbeHoles()[0];
      return parsed
        .filter((h) => h && typeof h === 'object')
        .map((h, i) => ({
          ...sample,
          ...h,
          id: String(h.id || `ph-saved-${i + 1}`),
          holeId: String(h.holeId || `PH-0${i + 1}`),
          positionLabel: h.positionLabel || 'Crown Arch',
          collarX: Number.isFinite(Number(h.collarX)) ? Number(h.collarX) : 0,
          collarY: Number.isFinite(Number(h.collarY)) ? Number(h.collarY) : 5.0,
          holeDiameterMm: Number(h.holeDiameterMm) || 76,
          totalLengthMeters: Number(h.totalLengthMeters) || 24,
          overlapLengthMeters: Number(h.overlapLengthMeters) || 5,
          azimuthDeg: Number(h.azimuthDeg) || 42,
          lookOutAngleDeg: Number(h.lookOutAngleDeg) || 6,
          dipAngleDeg: Number(h.dipAngleDeg) || 6,
          intervals:
            Array.isArray(h.intervals) && h.intervals.length > 0
              ? h.intervals.map((intv: Partial<ProbeRunInterval>, idx: number) => ({
                  id: String(intv?.id || `int-${i}-${idx}`),
                  fromMeters: Number(intv?.fromMeters) || idx * 6,
                  toMeters: Number(intv?.toMeters) || (idx + 1) * 6,
                  ropMetersPerMin: Number(intv?.ropMetersPerMin) || 0.9,
                  feedPressureBar: Number(intv?.feedPressureBar) || 65,
                  rotationPressureBar: Number(intv?.rotationPressureBar) || 50,
                  flushWaterColor: intv?.flushWaterColor || 'Clear',
                  waterInflowLMin: Number(intv?.waterInflowLMin) || 0,
                  waterPressureBar: Number(intv?.waterPressureBar) || 0.5,
                  estimatedRqdPct: Number(intv?.estimatedRqdPct) || 75,
                  rockMassClass: intv?.rockMassClass || 'Class II (Good)',
                  cavityOrFaultDetected: Boolean(intv?.cavityOrFaultDetected),
                  geologicalRemarks: String(intv?.geologicalRemarks || ''),
                }))
              : sample.intervals,
        }));
    }
    return buildSampleProbeHoles();
  } catch {
    return buildSampleProbeHoles();
  }
}

export function saveProbeHolesToStorage(holes: ProbeHoleRecord[]): void {
  try {
    localStorage.setItem(PROBE_HOLE_STORAGE_KEY, JSON.stringify(holes));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedGroutRings(): GroutRingRecord[] {
  try {
    const raw = localStorage.getItem(GROUT_RING_STORAGE_KEY);
    if (!raw) return [buildSampleGroutRing()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [buildSampleGroutRing()];
  } catch {
    return [buildSampleGroutRing()];
  }
}

export function saveGroutRingsToStorage(rings: GroutRingRecord[]): void {
  try {
    localStorage.setItem(GROUT_RING_STORAGE_KEY, JSON.stringify(rings));
  } catch {
    // Ignore storage quota errors
  }
}
