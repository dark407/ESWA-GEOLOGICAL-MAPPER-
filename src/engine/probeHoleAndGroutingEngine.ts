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

export interface MwdIntervalComputation {
  intervalId: string;
  midDepthMeters: number;
  fromMeters: number;
  toMeters: number;
  ropMetersPerMin: number;
  specificEnergyMjPerM3: number; // Drilling Specific Energy (MJ/m3)
  fractureIndex: number; // Normalized index (0-100)
  waterInflowLMin: number;
  estimatedRqdPct: number;
  isHazardZone: boolean;
  hazardReason: string;
}

export interface ProbeHoleLookAheadSummary {
  overallStatus: ProbeHoleSafetyStatus;
  safeAdvanceLengthMeters: number;
  maxWaterInflowLMin: number;
  totalWaterInflowLMin: number;
  averageRqdPct: number;
  averageSpecificEnergyMjM3: number;
  detectedHazardZones: Array<{
    holeId: string;
    fromMeters: number;
    toMeters: number;
    aheadOfFaceMeters: number;
    reason: string;
  }>;
  engineeringRecommendation: string;
}

// ============================================================================
// GROUTING & LUGEON / GIN ANALYSIS TYPES
// ============================================================================

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

const PROBE_HOLE_STORAGE_KEY = 'eswa_natm_probe_holes_v1';
const GROUT_RING_STORAGE_KEY = 'eswa_natm_grout_rings_v1';

// ============================================================================
// MWD DRILLING SPECIFIC ENERGY & LOOK-AHEAD CALCULATIONS
// ============================================================================

export function computeMwdProfileForHole(hole: ProbeHoleRecord): MwdIntervalComputation[] {
  const radiusM = Math.max(0.025, (hole.holeDiameterMm || 76) / 2000);
  const areaM2 = Math.PI * radiusM * radiusM;
  const inclinationRad = ((hole.dipAngleDeg || 0) * Math.PI) / 180;
  const cosInc = Math.max(0.5, Math.cos(inclinationRad));

  return hole.intervals.map((intv) => {
    const midDepth = (intv.fromMeters + intv.toMeters) * 0.5;
    const ropMMin = Math.max(0.05, intv.ropMetersPerMin || 0.5);
    // Teale (1965) Drilling Specific Energy: E = (F / A) + (2 * pi * N * T) / (A * ROP)
    // Calibrated for hydraulic percussion jumbo telemetry (bar -> kN / kNm)
    const thrustComponentMjM3 = (intv.feedPressureBar * 0.85) / (areaM2 * 1000);
    const torqueComponentMjM3 =
      (2 * Math.PI * 160 * (intv.rotationPressureBar * 0.042)) / (areaM2 * ropMMin * 1000);
    const rawDse = Math.max(12, Math.min(650, thrustComponentMjM3 + torqueComponentMjM3));
    const specificEnergyMjPerM3 = Number(rawDse.toFixed(1));

    // Higher ROP + Low Rotation Pressure = Fractured/Cavity zone
    const fractureIndex = Number(
      Math.max(
        0,
        Math.min(100, 100 - intv.estimatedRqdPct * 0.7 + (ropMMin > 1.8 ? 22 : 0))
      ).toFixed(0)
    );

    const reasons: string[] = [];
    if (intv.cavityOrFaultDetected) reasons.push('Cavity / Shear Fault Zone');
    if (intv.waterInflowLMin >= 25) reasons.push(`High Water Inflow (${intv.waterInflowLMin} L/min)`);
    if (ropMMin >= 2.2) reasons.push(`Sudden High ROP (${ropMMin.toFixed(2)} m/min)`);
    if (intv.estimatedRqdPct < 30) reasons.push(`Very Low RQD (${intv.estimatedRqdPct}%)`);
    if (intv.flushWaterColor === 'Total Water Loss') reasons.push('Total Drilling Flush Loss');

    return {
      intervalId: intv.id,
      midDepthMeters: Number((midDepth * cosInc).toFixed(2)),
      fromMeters: intv.fromMeters,
      toMeters: intv.toMeters,
      ropMetersPerMin: ropMMin,
      specificEnergyMjPerM3,
      fractureIndex,
      waterInflowLMin: intv.waterInflowLMin,
      estimatedRqdPct: intv.estimatedRqdPct,
      isHazardZone: reasons.length > 0,
      hazardReason: reasons.join(' · ') || 'Competent Rock Mass',
    };
  });
}

export function evaluateProbeFanLookAhead(holes: ProbeHoleRecord[]): ProbeHoleLookAheadSummary {
  if (!holes || holes.length === 0) {
    return {
      overallStatus: 'SAFE_COMPETENT',
      safeAdvanceLengthMeters: 20,
      maxWaterInflowLMin: 0,
      totalWaterInflowLMin: 0,
      averageRqdPct: 75,
      averageSpecificEnergyMjM3: 180,
      detectedHazardZones: [],
      engineeringRecommendation: 'Add probe holes to evaluate ground and groundwater conditions ahead of the face.',
    };
  }

  let maxWater = 0;
  let totalWater = 0;
  let totalRqdWeighted = 0;
  let totalDseWeighted = 0;
  let totalLen = 0;
  let firstHazardDistanceAhead = Infinity;
  let maxHoleHorizontalReach = 0;
  const detectedHazardZones: ProbeHoleLookAheadSummary['detectedHazardZones'] = [];

  for (const hole of holes) {
    const cosInc = Math.max(0.5, Math.cos(((hole.dipAngleDeg || 0) * Math.PI) / 180));
    const holeReach = Math.max(0, hole.totalLengthMeters * cosInc - (hole.overlapLengthMeters || 4));
    if (holeReach > maxHoleHorizontalReach) {
      maxHoleHorizontalReach = holeReach;
    }

    const mwdList = computeMwdProfileForHole(hole);
    let holePeakWater = 0;
    for (let i = 0; i < hole.intervals.length; i++) {
      const intv = hole.intervals[i];
      const mwd = mwdList[i];
      const segLen = Math.max(0.5, intv.toMeters - intv.fromMeters);
      totalLen += segLen;
      totalRqdWeighted += intv.estimatedRqdPct * segLen;
      totalDseWeighted += mwd.specificEnergyMjPerM3 * segLen;

      if (intv.waterInflowLMin > holePeakWater) {
        holePeakWater = intv.waterInflowLMin;
      }
      if (intv.waterInflowLMin > maxWater) {
        maxWater = intv.waterInflowLMin;
      }

      if (mwd.isHazardZone) {
        const aheadM = Number((intv.fromMeters * cosInc).toFixed(1));
        if (aheadM < firstHazardDistanceAhead) {
          firstHazardDistanceAhead = aheadM;
        }
        detectedHazardZones.push({
          holeId: hole.holeId,
          fromMeters: intv.fromMeters,
          toMeters: intv.toMeters,
          aheadOfFaceMeters: aheadM,
          reason: mwd.hazardReason,
        });
      }
    }
    totalWater += holePeakWater;
  }

  const averageRqdPct = totalLen > 0 ? Number((totalRqdWeighted / totalLen).toFixed(1)) : 70;
  const averageSpecificEnergyMjM3 = totalLen > 0 ? Number((totalDseWeighted / totalLen).toFixed(1)) : 165;

  let overallStatus: ProbeHoleSafetyStatus = 'SAFE_COMPETENT';
  if (
    detectedHazardZones.some((z) => z.reason.includes('Cavity') || z.reason.includes('High Water')) ||
    totalWater >= 50 ||
    averageRqdPct < 35
  ) {
    overallStatus = 'HAZARD_HIGH_INFLOW_OR_CAVITY';
  } else if (detectedHazardZones.length > 0 || totalWater >= 15 || averageRqdPct < 55) {
    overallStatus = 'CAUTION_FRACTURED';
  }

  const safeAdvanceLengthMeters = Number(
    Math.max(
      1.5,
      Math.min(
        maxHoleHorizontalReach > 0 ? maxHoleHorizontalReach : 18,
        firstHazardDistanceAhead < Infinity ? Math.max(1.5, firstHazardDistanceAhead - 3.0) : maxHoleHorizontalReach || 18
      )
    ).toFixed(1)
  );

  let engineeringRecommendation =
    'Competent rock mass verified ahead of face. Proceed with standard NATM round length and maintain mandatory 5.0 m probe overlap.';
  if (overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY') {
    engineeringRecommendation = `CRITICAL LOOK-AHEAD ALERT: Hazard detected at +${
      firstHazardDistanceAhead < Infinity ? firstHazardDistanceAhead : 8.0
    } m ahead of face (${totalWater.toFixed(
      0
    )} L/min water inflow). Execute Pre-Excavation Umbrella Grouting & reduce round length to ≤ 1.5 m with forepoling before advancing past +${safeAdvanceLengthMeters} m.`;
  } else if (overallStatus === 'CAUTION_FRACTURED') {
    engineeringRecommendation = `CAUTION: Fractured / water-bearing zone detected ahead of face (Avg RQD ${averageRqdPct}%, Inflow ${totalWater.toFixed(
      0
    )} L/min). Install drainage relief holes or localized consolidation grouting; limit safe advance to ${safeAdvanceLengthMeters} m.`;
  }

  return {
    overallStatus,
    safeAdvanceLengthMeters,
    maxWaterInflowLMin: maxWater,
    totalWaterInflowLMin: Number(totalWater.toFixed(1)),
    averageRqdPct,
    averageSpecificEnergyMjM3,
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
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
