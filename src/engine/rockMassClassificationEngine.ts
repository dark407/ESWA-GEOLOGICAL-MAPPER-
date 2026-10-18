import {
  GsiCalculationResult,
  GsiParameters,
  Joint,
  JointSet,
  LaubscherMrmrParameters,
  MathewsStabilityParameters,
  ParameterInputStatus,
  QIndexParameters,
  QSystemParamKey,
  RmrCalculationResult,
  RmrMethodologyVersion,
  RmrParamKey,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  StationClassificationStorageRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  autoEstimateQIndexFromMappedJoints,
  calculateBartonQSystem,
} from './photoWarpEngine';

export interface ClassificationMethodDescriptor {
  id: RockMassClassificationMethodId;
  shortLabel: string;
  fullName: string;
  referenceStandard: string;
  description: string;
}

/**
 * Modular Registry of Rock Mass Classification Methods.
 * Additional methods can be registered here without modifying the core mapping workspace.
 */
export const CLASSIFICATION_METHODS_REGISTRY: ClassificationMethodDescriptor[] = [
  {
    id: 'RMR',
    shortLabel: 'RMR (Bieniawski)',
    fullName: 'Rock Mass Rating (Bieniawski RMR89 / RMR76)',
    referenceStandard: 'Bieniawski (1989 / 1976) Geomechanics Classification',
    description:
      'Evaluates 5 basic rock mass parameters (UCS/Point Load, RQD, Spacing, Condition, Groundwater) + Tunnel Orientation Adjustment.',
  },
  {
    id: 'Q_SYSTEM',
    shortLabel: 'Q-System (Barton NGI)',
    fullName: 'NGI Tunnelling Quality Index (Q-System)',
    referenceStandard: 'Barton, Lien & Lunde (1974) / NGI (2015)',
    description:
      'Evaluates Q = (RQD / Jn) × (Jr / Ja) × (Jw / SRF) for underground excavation stability and support categories.',
  },
  {
    id: 'BOTH_RMR_AND_Q',
    shortLabel: 'Both (RMR + Q-System)',
    fullName: 'Dual Classification: Bieniawski RMR + Barton Q-System',
    referenceStandard: 'Bieniawski (1989) & Barton NGI (2015)',
    description:
      'Calculates and stores both RMR and Q-System independently for the same station/RD without mixing their parameters.',
  },
  {
    id: 'GSI',
    shortLabel: 'GSI (Hoek & Marinos)',
    fullName: 'Geological Strength Index (GSI) & Hoek-Brown Constants',
    referenceStandard: 'Hoek & Brown (1997, 2019) / Marinos & Hoek (2000)',
    description:
      'Evaluates rock mass structure interlocking and discontinuity surface condition to derive GSI and Generalized Hoek-Brown parameters.',
  },
  {
    id: 'LAUBSCHER_MRMR',
    shortLabel: 'Laubscher MRMR',
    fullName: 'Mining Rock Mass Rating (Laubscher MRMR)',
    referenceStandard: 'Laubscher (1990 / 2000) Underground Mining Classification',
    description:
      'Adjusts base RMR for weathering, joint orientation relative to stope, mining-induced stress, and blasting damage.',
  },
  {
    id: 'MATHEWS_STABILITY',
    shortLabel: "Mathews Potvin N'",
    fullName: 'Mathews / Potvin Stability Graph Open Stope Method',
    referenceStandard: 'Mathews (1981) / Potvin (1988) / Nickson (1992)',
    description:
      "Calculates Modified Stability Number N' = Q' × A × B × C vs Hydraulic Radius HR for underground stope spans.",
  },
];

// ============================================================================
// BIENIAWSKI RMR OPTIONS & TABLES (RMR89 & RMR76)
// ============================================================================

export interface RmrOptionItem {
  label: string;
  valueLabel: string;
   representativeNum: number;
  rating89: number;
  rating76: number;
}

export const RMR_STRENGTH_OPTIONS: RmrOptionItem[] = [
  {
    label: '> 250 MPa (Point Load > 10 MPa) — Extremely Strong (R6)',
    valueLabel: 'UCS > 250 MPa (Is50 > 10 MPa)',
    representativeNum: 260,
    rating89: 15,
    rating76: 15,
  },
  {
    label: '100 – 250 MPa (Point Load 4–10 MPa) — Very Strong (R5)',
    valueLabel: 'UCS 100–250 MPa (Is50 4–10 MPa)',
    representativeNum: 150,
    rating89: 12,
    rating76: 12,
  },
  {
    label: '50 – 100 MPa (Point Load 2–4 MPa) — Strong (R4)',
    valueLabel: 'UCS 50–100 MPa (Is50 2–4 MPa)',
    representativeNum: 75,
    rating89: 7,
    rating76: 7,
  },
  {
    label: '25 – 50 MPa (Point Load 1–2 MPa) — Medium Strong (R3)',
    valueLabel: 'UCS 25–50 MPa (Is50 1–2 MPa)',
    representativeNum: 37,
    rating89: 4,
    rating76: 4,
  },
  {
    label: '5 – 25 MPa — Weak Rock (R2)',
    valueLabel: 'UCS 5–25 MPa',
    representativeNum: 15,
    rating89: 2,
    rating76: 2,
  },
  {
    label: '1 – 5 MPa — Very Weak Rock (R1)',
    valueLabel: 'UCS 1–5 MPa',
    representativeNum: 3,
    rating89: 1,
    rating76: 1,
  },
  {
    label: '< 1 MPa — Extremely Weak (R0)',
    valueLabel: 'UCS < 1 MPa',
    representativeNum: 0.5,
    rating89: 0,
    rating76: 0,
  },
];

export const RMR_RQD_OPTIONS: RmrOptionItem[] = [
  {
    label: '90% – 100% (Excellent Rock Quality)',
    valueLabel: '90–100%',
    representativeNum: 95,
    rating89: 20,
    rating76: 20,
  },
  {
    label: '75% – 90% (Good Rock Quality)',
    valueLabel: '75–90%',
    representativeNum: 82,
    rating89: 17,
    rating76: 17,
  },
  {
    label: '50% – 75% (Fair Rock Quality)',
    valueLabel: '50–75%',
    representativeNum: 65,
    rating89: 13,
    rating76: 13,
  },
  {
    label: '25% – 50% (Poor Rock Quality)',
    valueLabel: '25–50%',
    representativeNum: 38,
    rating89: 8,
    rating76: 8,
  },
  {
    label: '< 25% (Very Poor Rock Quality)',
    valueLabel: '< 25%',
    representativeNum: 15,
    rating89: 3,
    rating76: 3,
  },
];

export const RMR_SPACING_OPTIONS: RmrOptionItem[] = [
  {
    label: '> 2.0 m (Very Wide Spacing)',
    valueLabel: '> 2.0 m',
    representativeNum: 2.5,
    rating89: 20,
    rating76: 30,
  },
  {
    label: '0.6 – 2.0 m (Wide Spacing)',
    valueLabel: '0.6 – 2.0 m',
    representativeNum: 1.0,
    rating89: 15,
    rating76: 25,
  },
  {
    label: '0.2 – 0.6 m / 200–600 mm (Moderate Spacing)',
    valueLabel: '0.2 – 0.6 m (200–600 mm)',
    representativeNum: 0.35,
    rating89: 10,
    rating76: 20,
  },
  {
    label: '0.06 – 0.2 m / 60–200 mm (Close Spacing)',
    valueLabel: '0.06 – 0.2 m (60–200 mm)',
    representativeNum: 0.12,
    rating89: 8,
    rating76: 10,
  },
  {
    label: '< 0.06 m / < 60 mm (Very Close Spacing)',
    valueLabel: '< 0.06 m (< 60 mm)',
    representativeNum: 0.04,
    rating89: 5,
    rating76: 5,
  },
];

export const RMR_CONDITION_OPTIONS: RmrOptionItem[] = [
  {
    label: 'Very rough surfaces, not continuous, no separation, unweathered wall rock',
    valueLabel: 'Very rough, tight, unweathered',
    representativeNum: 30,
    rating89: 30,
    rating76: 25,
  },
  {
    label: 'Slightly rough surfaces, separation < 1 mm, slightly weathered walls',
    valueLabel: 'Slightly rough, aperture < 1 mm, slightly weathered',
    representativeNum: 25,
    rating89: 25,
    rating76: 20,
  },
  {
    label: 'Slightly rough surfaces, separation < 1 mm, highly weathered walls',
    valueLabel: 'Slightly rough, aperture < 1 mm, highly weathered',
    representativeNum: 20,
    rating89: 20,
    rating76: 12,
  },
  {
    label: 'Slickensided surfaces OR Gouge < 5 mm thick OR Separation 1–5 mm continuous',
    valueLabel: 'Slickensided or gouge < 5 mm or separation 1–5 mm',
    representativeNum: 10,
    rating89: 10,
    rating76: 6,
  },
  {
    label: 'Soft gouge > 5 mm thick OR Separation > 5 mm continuous',
    valueLabel: 'Soft gouge > 5 mm or separation > 5 mm',
    representativeNum: 0,
    rating89: 0,
    rating76: 0,
  },
];

export const RMR_GROUNDWATER_OPTIONS: RmrOptionItem[] = [
  {
    label: 'Completely Dry (Inflow = None)',
    valueLabel: 'Completely Dry (0 L/min)',
    representativeNum: 0,
    rating89: 15,
    rating76: 10,
  },
  {
    label: 'Damp (Inflow < 10 L/min per 10m tunnel length)',
    valueLabel: 'Damp (< 10 L/min)',
    representativeNum: 5,
    rating89: 10,
    rating76: 7,
  },
  {
    label: 'Wet (Inflow 10 – 25 L/min per 10m tunnel length)',
    valueLabel: 'Wet (10–25 L/min)',
    representativeNum: 18,
    rating89: 7,
    rating76: 4,
  },
  {
    label: 'Dripping (Inflow 25 – 125 L/min per 10m tunnel length)',
    valueLabel: 'Dripping (25–125 L/min)',
    representativeNum: 60,
    rating89: 4,
    rating76: 2,
  },
  {
    label: 'Flowing (Inflow > 125 L/min per 10m tunnel length)',
    valueLabel: 'Flowing (> 125 L/min)',
    representativeNum: 150,
    rating89: 0,
    rating76: 0,
  },
];

export const RMR_ORIENTATION_ADJUSTMENT_OPTIONS: {
  favourability: RmrParameters['orientationFavourability'];
  adjustmentTunnel: number;
  description: string;
}[] = [
  {
    favourability: 'Very Favorable',
    adjustmentTunnel: 0,
    description: '0 — Drive with dip (45°–90°) or strike perpendicular to tunnel axis, very favorable',
  },
  {
    favourability: 'Favorable',
    adjustmentTunnel: -2,
    description: '-2 — Drive with dip (20°–45°), favorable wedge/arch geometry',
  },
  {
    favourability: 'Fair',
    adjustmentTunnel: -5,
    description: '-5 — Drive against dip (45°–90°) or low dip (0°–20°), fair stability',
  },
  {
    favourability: 'Unfavorable',
    adjustmentTunnel: -10,
    description: '-10 — Drive against dip (20°–45°) or strike parallel to tunnel axis (dip 20°–45°)',
  },
  {
    favourability: 'Very Unfavorable',
    adjustmentTunnel: -12,
    description: '-12 — Strike parallel to tunnel axis with steep dip (45°–90°), very unfavorable',
  },
];

// Detailed sub-parameter tables for Parameter A4 (Condition of Discontinuities in RMR89)
export const RMR_SUB_PERSISTENCE_OPTIONS = [
  { label: '< 1 m (Very low persistence)', rating: 6 },
  { label: '1 – 3 m (Low persistence)', rating: 4 },
  { label: '3 – 10 m (Medium persistence)', rating: 2 },
  { label: '10 – 20 m (High persistence)', rating: 1 },
  { label: '> 20 m (Very high persistence)', rating: 0 },
];

export const RMR_SUB_APERTURE_OPTIONS = [
  { label: 'None (Tight / closed)', rating: 6 },
  { label: '< 0.1 mm (Very tight)', rating: 5 },
  { label: '0.1 – 1.0 mm (Slightly open)', rating: 4 },
  { label: '1 – 5 mm (Moderately open)', rating: 1 },
  { label: '> 5 mm (Wide opening)', rating: 0 },
];

export const RMR_SUB_ROUGHNESS_OPTIONS = [
  { label: 'Very rough', rating: 6 },
  { label: 'Rough', rating: 5 },
  { label: 'Slightly rough', rating: 3 },
  { label: 'Smooth', rating: 1 },
  { label: 'Slickensided', rating: 0 },
];

export const RMR_SUB_INFILLING_OPTIONS = [
  { label: 'None (Clean walls)', rating: 6 },
  { label: 'Hard filling < 5 mm', rating: 4 },
  { label: 'Hard filling > 5 mm', rating: 2 },
  { label: 'Soft filling < 5 mm', rating: 2 },
  { label: 'Soft filling > 5 mm', rating: 0 },
];

export const RMR_SUB_WEATHERING_OPTIONS = [
  { label: 'Unweathered (W1)', rating: 6 },
  { label: 'Slightly weathered (W2)', rating: 5 },
  { label: 'Moderately weathered (W3)', rating: 3 },
  { label: 'Highly weathered (W4)', rating: 1 },
  { label: 'Decomposed / Completely weathered (W5)', rating: 0 },
];

/**
 * Computes RMR Rating 1 (Intact Rock Strength) from numeric UCS (MPa) or Point Load (MPa)
 */
export function computeRmrStrengthRating(
  valueMPa: number,
  inputType: 'UCS_MPA' | 'POINT_LOAD_MPA'
): number {
  const ucs = inputType === 'POINT_LOAD_MPA' ? valueMPa * 24 : valueMPa;
  if (ucs > 250) return 15;
  if (ucs >= 100) return 12;
  if (ucs >= 50) return 7;
  if (ucs >= 25) return 4;
  if (ucs >= 5) return 2;
  if (ucs >= 1) return 1;
  return 0;
}

/**
 * Computes RMR Rating 2 (RQD %)
 */
export function computeRmrRqdRating(rqdPercent: number): number {
  if (rqdPercent >= 90) return 20;
  if (rqdPercent >= 75) return 17;
  if (rqdPercent >= 50) return 13;
  if (rqdPercent >= 25) return 8;
  return 3;
}

/**
 * Computes RMR Rating 3 (Discontinuity Spacing in meters)
 */
export function computeRmrSpacingRating(
  spacingMeters: number,
  version: RmrMethodologyVersion
): number {
  if (spacingMeters > 2.0) return version === 'RMR89' ? 20 : 30;
  if (spacingMeters >= 0.6) return version === 'RMR89' ? 15 : 25;
  if (spacingMeters >= 0.2) return version === 'RMR89' ? 10 : 20;
  if (spacingMeters >= 0.06) return version === 'RMR89' ? 8 : 10;
  return 5;
}

/**
 * Creates default initial RMR Parameters for a project station.
 */
export function createDefaultRmrParameters(): RmrParameters {
  return {
    version: 'RMR89',
    strengthInputType: 'UCS_MPA',
    intactStrengthValueMPa: 75,
    intactStrengthDescription: 'UCS 50–100 MPa (Is50 2–4 MPa)',
    intactStrengthRating: 7,
    rqdPercent: 68,
    rqdDescription: '50–75% (Fair to Good)',
    rqdRating: 13,
    spacingMeters: 0.35,
    spacingDescription: '0.2 – 0.6 m (200–600 mm)',
    spacingRating: 10,
    conditionDescription: 'Slightly rough, aperture < 1 mm, slightly weathered',
    conditionRating: 25,
    conditionSubRatings: {
      useDetailedSubRatings: false,
      persistenceValue: '1 – 3 m (Low persistence)',
      persistenceRating: 4,
      apertureValue: '0.1 – 1.0 mm (Slightly open)',
      apertureRating: 4,
      roughnessValue: 'Rough',
      roughnessRating: 5,
      infillingValue: 'None (Clean walls)',
      infillingRating: 6,
      weatheringValue: 'Slightly weathered (W2)',
      weatheringRating: 5,
    },
    groundwaterInflowLPerMin10m: 5,
    groundwaterDescription: 'Damp (< 10 L/min)',
    groundwaterRating: 10,
    orientationFavourability: 'Fair',
    orientationAdjustmentRating: -5,
    paramStatus: {
      intactStrength: 'USER_ENTERED',
      rqd: 'USER_ENTERED',
      spacing: 'USER_ENTERED',
      condition: 'USER_ENTERED',
      groundwater: 'USER_ENTERED',
      orientationAdjustment: 'USER_ENTERED',
    },
    userConfirmed: true,
    confirmedAt: new Date().toISOString(),
  };
}

/**
 * Creates an empty/unfilled RMR parameter set where all fields are MISSING ("Required input not available")
 * so the user can test or enter from scratch without any pre-filled values.
 */
export function createBlankRmrParameters(version: RmrMethodologyVersion = 'RMR89'): RmrParameters {
  return {
    version,
    strengthInputType: 'UCS_MPA',
    intactStrengthValueMPa: null,
    intactStrengthDescription: 'Required input not available',
    intactStrengthRating: null,
    rqdPercent: null,
    rqdDescription: 'Required input not available',
    rqdRating: null,
    spacingMeters: null,
    spacingDescription: 'Required input not available',
    spacingRating: null,
    conditionDescription: 'Required input not available',
    conditionRating: null,
    conditionSubRatings: {
      useDetailedSubRatings: false,
      persistenceValue: '1 – 3 m (Low persistence)',
      persistenceRating: 4,
      apertureValue: '0.1 – 1.0 mm (Slightly open)',
      apertureRating: 4,
      roughnessValue: 'Rough',
      roughnessRating: 5,
      infillingValue: 'None (Clean walls)',
      infillingRating: 6,
      weatheringValue: 'Slightly weathered (W2)',
      weatheringRating: 5,
    },
    groundwaterInflowLPerMin10m: null,
    groundwaterDescription: 'Required input not available',
    groundwaterRating: null,
    orientationFavourability: 'Not Assessed',
    orientationAdjustmentRating: null,
    paramStatus: {
      intactStrength: 'MISSING',
      rqd: 'MISSING',
      spacing: 'MISSING',
      condition: 'MISSING',
      groundwater: 'MISSING',
      orientationAdjustment: 'MISSING',
    },
    userConfirmed: false,
  };
}

/**
 * Evaluates Bieniawski RMR (1989 or 1976).
 * Strictly enforces the "NO INVENTED VALUES" rule:
 * If any parameter is MISSING (or null), it reports "Required input not available" and does not fabricate a rating.
 */
export function calculateBieniawskiRmr(params: RmrParameters): RmrCalculationResult {
  const safeParams = params || createBlankRmrParameters();
  const subRatings = safeParams.conditionSubRatings;
  const useDetailed = Boolean(subRatings?.useDetailedSubRatings);
  const detailedSum = useDetailed && subRatings
    ? (subRatings.persistenceRating ?? 4) +
      (subRatings.apertureRating ?? 4) +
      (subRatings.roughnessRating ?? 5) +
      (subRatings.infillingRating ?? 6) +
      (subRatings.weatheringRating ?? 5)
    : safeParams.conditionRating;

  const paramMeta: { key: RmrParamKey; label: string; rating: number | null }[] = [
    {
      key: 'intactStrength',
      label: '1. Intact Rock Strength (UCS / Point Load)',
      rating: safeParams.intactStrengthRating,
    },
    {
      key: 'rqd',
      label: '2. Rock Quality Designation (RQD)',
      rating: safeParams.rqdRating,
    },
    {
      key: 'spacing',
      label: '3. Spacing of Discontinuities',
      rating: safeParams.spacingRating,
    },
    {
      key: 'condition',
      label: '4. Condition of Discontinuities',
      rating: detailedSum,
    },
    {
      key: 'groundwater',
      label: '5. Groundwater Conditions',
      rating: safeParams.groundwaterRating,
    },
    {
      key: 'orientationAdjustment',
      label: '6. Discontinuity Orientation Adjustment',
      rating: safeParams.orientationAdjustmentRating,
    },
  ];

  const missingParamLabels: string[] = [];
  const unconfirmedParamLabels: string[] = [];

  for (const item of paramMeta) {
    const status = safeParams.paramStatus?.[item.key] || 'USER_ENTERED';
    if (status === 'MISSING' || item.rating === null || item.rating === undefined) {
      missingParamLabels.push(item.label);
    } else if (status === 'AI_SUGGESTED_UNCONFIRMED') {
      unconfirmedParamLabels.push(item.label);
    }
  }

  const r1 =
    safeParams.paramStatus?.intactStrength === 'MISSING' ? null : safeParams.intactStrengthRating;
  const r2 = safeParams.paramStatus?.rqd === 'MISSING' ? null : safeParams.rqdRating;
  const r3 = safeParams.paramStatus?.spacing === 'MISSING' ? null : safeParams.spacingRating;
  const r4 =
    safeParams.paramStatus?.condition === 'MISSING'
      ? null
      : detailedSum;
  const r5 = safeParams.paramStatus?.groundwater === 'MISSING' ? null : safeParams.groundwaterRating;
  const rAdj =
    safeParams.paramStatus?.orientationAdjustment === 'MISSING'
      ? null
      : safeParams.orientationAdjustmentRating;

  const isComplete = missingParamLabels.length === 0;
  const hasUnconfirmedSuggestions = unconfirmedParamLabels.length > 0;

  if (
    !isComplete ||
    r1 === null ||
    r2 === null ||
    r3 === null ||
    r4 === null ||
    r5 === null ||
    rAdj === null
  ) {
    return {
      version: params.version,
      isComplete: false,
      hasUnconfirmedSuggestions,
      missingParamLabels,
      unconfirmedParamLabels,
      r1StrengthRating: r1,
      r2RqdRating: r2,
      r3SpacingRating: r3,
      r4ConditionRating: r4,
      r5GroundwaterRating: r5,
      basicRmr:
        r1 !== null && r2 !== null && r3 !== null && r4 !== null && r5 !== null
          ? r1 + r2 + r3 + r4 + r5
          : null,
      orientationAdjustment: rAdj,
      finalRmr: null,
      rockMassClassNumber: 'INCOMPLETE',
      rockMassClassLabel: 'Required input not available',
      rockQualityDescription: 'Enter or confirm missing parameters to calculate RMR',
      colorHex: '#64748B',
      averageStandUpTime: 'Required input not available',
      cohesionKPa: 'Required input not available',
      frictionAngleDeg: 'Required input not available',
      deformationModulusGPa: null,
      recommendedSupportGuidelines:
        'Required input not available — complete all 6 RMR parameters.',
      calculationSummaryFormula: `Missing: ${missingParamLabels.join(', ')}`,
    };
  }

  const basicRmr = Math.max(0, Math.min(100, r1 + r2 + r3 + r4 + r5));
  const finalRmr = Math.max(0, Math.min(100, basicRmr + rAdj));

  let rockMassClassNumber: RmrCalculationResult['rockMassClassNumber'] = 'III';
  let rockMassClassLabel = 'CLASS III — FAIR ROCK';
  let rockQualityDescription = 'Fair rock';
  let colorHex = '#D97706';
  let averageStandUpTime = '1 week for 5 m span';
  let cohesionKPa = '200 – 300 kPa';
  let frictionAngleDeg = '25° – 35°';
  let recommendedSupportGuidelines =
    'Systematic bolts 4 m long, spaced 1.5–2 m in crown and walls with wire mesh in crown; Shotcrete 50–100 mm in crown and 30 mm in sides.';

  if (finalRmr >= 81) {
    rockMassClassNumber = 'I';
    rockMassClassLabel = 'CLASS I — VERY GOOD ROCK';
    rockQualityDescription = 'Very good rock';
    colorHex = '#059669';
    averageStandUpTime = '20 years for 15 m span';
    cohesionKPa = '> 400 kPa';
    frictionAngleDeg = '> 45°';
    recommendedSupportGuidelines =
      'Generally no support required except for occasional spot bolting.';
  } else if (finalRmr >= 61) {
    rockMassClassNumber = 'II';
    rockMassClassLabel = 'CLASS II — GOOD ROCK';
    rockQualityDescription = 'Good rock';
    colorHex = '#10B981';
    averageStandUpTime = '1 year for 10 m span';
    cohesionKPa = '300 – 400 kPa';
    frictionAngleDeg = '35° – 45°';
    recommendedSupportGuidelines =
      'Locally bolts in crown 3 m long, spaced 2.5 m with occasional wire mesh; 50 mm shotcrete in crown where required.';
  } else if (finalRmr >= 41) {
    rockMassClassNumber = 'III';
    rockMassClassLabel = 'CLASS III — FAIR ROCK';
    rockQualityDescription = 'Fair rock';
    colorHex = '#D97706';
    averageStandUpTime = '1 week for 5 m span';
    cohesionKPa = '200 – 300 kPa';
    frictionAngleDeg = '25° – 35°';
    recommendedSupportGuidelines =
      'Systematic bolts 4 m long, spaced 1.5–2 m in crown & walls with mesh; Shotcrete 50–100 mm in crown and 30 mm on walls.';
  } else if (finalRmr >= 21) {
    rockMassClassNumber = 'IV';
    rockMassClassLabel = 'CLASS IV — POOR ROCK';
    rockQualityDescription = 'Poor rock';
    colorHex = '#EA580C';
    averageStandUpTime = '10 hours for 2.5 m span';
    cohesionKPa = '100 – 200 kPa';
    frictionAngleDeg = '15° – 25°';
    recommendedSupportGuidelines =
      'Systematic bolts 4–5 m long, spaced 1–1.5 m in crown & walls with wire mesh; Shotcrete 100–150 mm in crown & 100 mm in sides; Light to medium ribs spaced 1.5 m where required.';
  } else {
    rockMassClassNumber = 'V';
    rockMassClassLabel = 'CLASS V — VERY POOR ROCK';
    rockQualityDescription = 'Very poor rock';
    colorHex = '#DC2626';
    averageStandUpTime = '30 minutes for 1 m span';
    cohesionKPa = '< 100 kPa';
    frictionAngleDeg = '< 15°';
    recommendedSupportGuidelines =
      'Systematic bolts 5–6 m long, spaced 1–1.5 m in crown & walls with mesh; Shotcrete 150–200 mm in crown, 150 mm sides & 50 mm on face; Medium to heavy ribs spaced 0.75 m with steel lagging and forepoling; Close invert.';
  }

  // Bieniawski (1978) / Serafim & Pereira (1983) In-situ Rock Mass Deformation Modulus Em (GPa)
  const deformationModulusGPa = Number(
    (
      finalRmr > 50
        ? 2 * finalRmr - 100
        : Math.pow(10, (finalRmr - 10) / 40)
    ).toFixed(2)
  );

  const calculationSummaryFormula = `${params.version} = (R1:${r1} + R2:${r2} + R3:${r3} + R4:${r4} + R5:${r5}) [Basic=${basicRmr}] + Adj(${rAdj}) = ${finalRmr}`;

  return {
    version: params.version,
    isComplete: true,
    hasUnconfirmedSuggestions,
    missingParamLabels: [],
    unconfirmedParamLabels,
    r1StrengthRating: r1,
    r2RqdRating: r2,
    r3SpacingRating: r3,
    r4ConditionRating: r4,
    r5GroundwaterRating: r5,
    basicRmr,
    orientationAdjustment: rAdj,
    finalRmr,
    rockMassClassNumber,
    rockMassClassLabel,
    rockQualityDescription,
    colorHex,
    averageStandUpTime,
    cohesionKPa,
    frictionAngleDeg,
    deformationModulusGPa,
    recommendedSupportGuidelines,
    calculationSummaryFormula,
  };
}

/**
 * Generates AI / Geometry-assisted RMR parameter suggestions from actual mapped joints & rock mass summary.
 * NEVER invents missing data:
 * - Only parameters that can be derived from mapped joints or entered rock mass summary are suggested,
 *   and EVERY suggested parameter is marked 'AI_SUGGESTED_UNCONFIRMED' so the user MUST confirm it before use.
 */
export function suggestRmrFromMappedTraces(
  joints: Joint[],
  jointSets: JointSet[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  rockMassSummary: RockMassSummaryTable,
  currentRmr: RmrParameters
): RmrParameters {
  const next: RmrParameters = {
    ...currentRmr,
    paramStatus: { ...currentRmr.paramStatus },
    conditionSubRatings: { ...currentRmr.conditionSubRatings },
    userConfirmed: false,
  };

  // 1. Intact Rock Strength from rockMassSummary.strengthGrade if available
  const strengthStr = (rockMassSummary.strengthGrade || '').toUpperCase();
  if (strengthStr.includes('100–250') || strengthStr.includes('R5')) {
    next.intactStrengthValueMPa = 150;
    next.intactStrengthDescription = 'UCS 100–250 MPa (Suggested from Rock Mass Log)';
    next.intactStrengthRating = 12;
    next.paramStatus.intactStrength = 'AI_SUGGESTED_UNCONFIRMED';
  } else if (strengthStr.includes('50–100') || strengthStr.includes('R4')) {
    next.intactStrengthValueMPa = 75;
    next.intactStrengthDescription = 'UCS 50–100 MPa (Suggested from Rock Mass Log)';
    next.intactStrengthRating = 7;
    next.paramStatus.intactStrength = 'AI_SUGGESTED_UNCONFIRMED';
  } else if (strengthStr.includes('25–50') || strengthStr.includes('R3')) {
    next.intactStrengthValueMPa = 37;
    next.intactStrengthDescription = 'UCS 25–50 MPa (Suggested from Rock Mass Log)';
    next.intactStrengthRating = 4;
    next.paramStatus.intactStrength = 'AI_SUGGESTED_UNCONFIRMED';
  } else if (strengthStr.includes('5–25') || strengthStr.includes('R2')) {
    next.intactStrengthValueMPa = 15;
    next.intactStrengthDescription = 'UCS 5–25 MPa (Suggested from Rock Mass Log)';
    next.intactStrengthRating = 2;
    next.paramStatus.intactStrength = 'AI_SUGGESTED_UNCONFIRMED';
  }

  // 2 & 3. RQD & Spacing from mapped joints (ONLY if joints are actually mapped on canvas!)
  if (joints.length > 0) {
    const faceArea = Math.max(12, geometry.designAreaSqMeters || geometry.width * geometry.height * 0.85);
    const totalTraceLen = joints.reduce((acc, j) => acc + (j.persistenceMeters || 1.8), 0);
    const arealIntensityP21 = totalTraceLen / faceArea;
    const jv = Math.max(3, Math.min(35, Math.round(arealIntensityP21 * 8.5 + joints.length * 0.65)));
    const estimatedRqd = Math.max(10, Math.min(100, Math.round((115 - 3.3 * jv) / 5) * 5));

    next.rqdPercent = estimatedRqd;
    next.rqdRating = computeRmrRqdRating(estimatedRqd);
    next.rqdDescription = `${estimatedRqd}% (Suggested from Jv ≈ ${jv} jts/m³)`;
    next.paramStatus.rqd = 'AI_SUGGESTED_UNCONFIRMED';

    // Estimate mean spacing from areal intensity or joint set spacing
    const estSpacingM = Number(Math.max(0.05, Math.min(2.2, 1 / Math.max(0.5, arealIntensityP21 * 2.1))).toFixed(2));
    next.spacingMeters = estSpacingM;
    next.spacingRating = computeRmrSpacingRating(estSpacingM, next.version);
    next.spacingDescription = `${estSpacingM.toFixed(2)} m (Suggested from ${joints.length} mapped traces)`;
    next.paramStatus.spacing = 'AI_SUGGESTED_UNCONFIRMED';

    // 4. Condition of discontinuities from mapped joint roughness/infilling/aperture
    const hasFaultOrClay = joints.some(
      (j) =>
        j.featureType === 'fault' ||
        j.featureType === 'shear_zone' ||
        (j.infilling || '').toLowerCase().includes('clay')
    );
    const hasSmooth = joints.some((j) => (j.roughness || '').toLowerCase().includes('smooth'));
    if (hasFaultOrClay) {
      next.conditionRating = next.version === 'RMR89' ? 10 : 6;
      next.conditionDescription = 'Slickensided or gouge < 5 mm (Suggested from mapped fault/clay traces)';
    } else if (hasSmooth) {
      next.conditionRating = next.version === 'RMR89' ? 20 : 12;
      next.conditionDescription = 'Slightly rough to smooth surfaces (Suggested from mapped traces)';
    } else {
      next.conditionRating = next.version === 'RMR89' ? 25 : 20;
      next.conditionDescription = 'Slightly rough, separation < 1 mm (Suggested from mapped traces)';
    }
    next.paramStatus.condition = 'AI_SUGGESTED_UNCONFIRMED';

    // 5. Groundwater from mapped joint water conditions
    const hasFlowing = joints.some((j) => j.waterCondition === 'Flowing');
    const hasDripping = joints.some((j) => j.waterCondition === 'Dripping');
    const hasWet = joints.some((j) => j.waterCondition === 'Wet');
    const hasDamp = joints.some((j) => j.waterCondition === 'Damp');

    if (hasFlowing) {
      next.groundwaterInflowLPerMin10m = 150;
      next.groundwaterDescription = 'Flowing (> 125 L/min) — Suggested from mapped traces';
      next.groundwaterRating = 0;
    } else if (hasDripping) {
      next.groundwaterInflowLPerMin10m = 45;
      next.groundwaterDescription = 'Dripping (25–125 L/min) — Suggested from mapped traces';
      next.groundwaterRating = next.version === 'RMR89' ? 4 : 2;
    } else if (hasWet) {
      next.groundwaterInflowLPerMin10m = 15;
      next.groundwaterDescription = 'Wet (10–25 L/min) — Suggested from mapped traces';
      next.groundwaterRating = next.version === 'RMR89' ? 7 : 4;
    } else if (hasDamp) {
      next.groundwaterInflowLPerMin10m = 5;
      next.groundwaterDescription = 'Damp (< 10 L/min) — Suggested from mapped traces';
      next.groundwaterRating = next.version === 'RMR89' ? 10 : 7;
    } else {
      next.groundwaterInflowLPerMin10m = 0;
      next.groundwaterDescription = 'Completely Dry — Suggested from mapped traces';
      next.groundwaterRating = next.version === 'RMR89' ? 15 : 10;
    }
    next.paramStatus.groundwater = 'AI_SUGGESTED_UNCONFIRMED';

    // 6. Orientation adjustment from primary joint set strike vs tunnel drive direction
    const driveAz = settings.driveDirection || 0;
    const primarySet = jointSets[0];
    if (primarySet && primarySet.avgDip !== null && primarySet.avgDipDirection !== null) {
      const relAngle = Math.abs(((primarySet.avgDipDirection - driveAz + 540) % 360) - 180);
      const dip = primarySet.avgDip;
      if (relAngle > 60 && relAngle < 120 && dip >= 45) {
        // Strike roughly parallel to tunnel axis with steep dip
        next.orientationFavourability = 'Very Unfavorable';
        next.orientationAdjustmentRating = -12;
      } else if (relAngle <= 45 && dip >= 45) {
        // Drive with steep dip
        next.orientationFavourability = 'Very Favorable';
        next.orientationAdjustmentRating = 0;
      } else if (relAngle >= 135 && dip >= 20 && dip <= 45) {
        // Drive against moderate dip
        next.orientationFavourability = 'Unfavorable';
        next.orientationAdjustmentRating = -10;
      } else {
        next.orientationFavourability = 'Fair';
        next.orientationAdjustmentRating = -5;
      }
      next.paramStatus.orientationAdjustment = 'AI_SUGGESTED_UNCONFIRMED';
    }
  } else {
    // No mapped joints: do NOT invent RQD, Spacing, Condition, or Orientation!
    if (next.paramStatus.rqd !== 'USER_ENTERED' && next.paramStatus.rqd !== 'USER_CONFIRMED') {
      next.paramStatus.rqd = 'MISSING';
      next.rqdPercent = null;
      next.rqdRating = null;
      next.rqdDescription = 'Required input not available (No mapped traces)';
    }
    if (next.paramStatus.spacing !== 'USER_ENTERED' && next.paramStatus.spacing !== 'USER_CONFIRMED') {
      next.paramStatus.spacing = 'MISSING';
      next.spacingMeters = null;
      next.spacingRating = null;
      next.spacingDescription = 'Required input not available (No mapped traces)';
    }
  }

  return next;
}

// ============================================================================
// BARTON Q-SYSTEM VALIDATION & SUGGESTION WRAPPER
// ============================================================================

export type ValidatedQSystemResult = ReturnType<typeof calculateBartonQSystem> & {
  isComplete: boolean;
  hasUnconfirmedSuggestions: boolean;
  missingParamLabels: string[];
  unconfirmedParamLabels: string[];
  calculationSummaryFormula: string;
};

export function createDefaultQParamStatus(): Record<QSystemParamKey, ParameterInputStatus> {
  return {
    rqd: 'USER_ENTERED',
    jn: 'USER_ENTERED',
    jr: 'USER_ENTERED',
    ja: 'USER_ENTERED',
    jw: 'USER_ENTERED',
    srf: 'USER_ENTERED',
  };
}

export function createBlankQParamStatus(): Record<QSystemParamKey, ParameterInputStatus> {
  return {
    rqd: 'MISSING',
    jn: 'MISSING',
    jr: 'MISSING',
    ja: 'MISSING',
    jw: 'MISSING',
    srf: 'MISSING',
  };
}

export function evaluateQSystemWithValidation(
  qParams: QIndexParameters,
  spanWidthMeters: number,
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>
): ValidatedQSystemResult {
  const baseResult = calculateBartonQSystem(qParams, spanWidthMeters);

  const paramLabels: { key: QSystemParamKey; label: string }[] = [
    { key: 'rqd', label: '1. RQD (%)' },
    { key: 'jn', label: '2. Joint Set Number (Jn)' },
    { key: 'jr', label: '3. Joint Roughness Number (Jr)' },
    { key: 'ja', label: '4. Joint Alteration Number (Ja)' },
    { key: 'jw', label: '5. Joint Water Reduction Factor (Jw)' },
    { key: 'srf', label: '6. Stress Reduction Factor (SRF)' },
  ];

  const missingParamLabels: string[] = [];
  const unconfirmedParamLabels: string[] = [];

  for (const item of paramLabels) {
    const st = qParamStatus?.[item.key] || 'USER_ENTERED';
    if (st === 'MISSING') {
      missingParamLabels.push(item.label);
    } else if (st === 'AI_SUGGESTED_UNCONFIRMED') {
      unconfirmedParamLabels.push(item.label);
    }
  }

  const isComplete = missingParamLabels.length === 0;
  const hasUnconfirmedSuggestions = unconfirmedParamLabels.length > 0;

  const calculationSummaryFormula = isComplete
    ? `Q = (RQD/Jn) × (Jr/Ja) × (Jw/SRF) = (${qParams.rqd}/${baseResult.effectiveJn}) × (${qParams.jr}/${qParams.ja}) × (${qParams.jw}/${qParams.srf}) = ${baseResult.qValue.toFixed(3)}`
    : `Required input not available — Missing: ${missingParamLabels.join(', ')}`;

  return {
    ...baseResult,
    isComplete,
    hasUnconfirmedSuggestions,
    missingParamLabels,
    unconfirmedParamLabels,
    calculationSummaryFormula,
  };
}

export function suggestQSystemWithConfirmation(
  joints: Joint[],
  jointSets: JointSet[],
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  currentQ: QIndexParameters,
  currentStatus: Record<QSystemParamKey, ParameterInputStatus>
): {
  nextParams: QIndexParameters;
  nextStatus: Record<QSystemParamKey, ParameterInputStatus>;
} {
  if (joints.length === 0) {
    // Do NOT invent values when no joints are mapped!
    return {
      nextParams: currentQ,
      nextStatus: { ...currentStatus },
    };
  }

  const suggested = autoEstimateQIndexFromMappedJoints(
    joints,
    jointSets,
    geometry,
    settings,
    currentQ
  );

  return {
    nextParams: {
      ...suggested,
      userConfirmed: false,
    },
    nextStatus: {
      rqd: 'AI_SUGGESTED_UNCONFIRMED',
      jn: 'AI_SUGGESTED_UNCONFIRMED',
      jr: 'AI_SUGGESTED_UNCONFIRMED',
      ja: 'AI_SUGGESTED_UNCONFIRMED',
      jw: 'AI_SUGGESTED_UNCONFIRMED',
      srf: 'AI_SUGGESTED_UNCONFIRMED',
    },
  };
}

// ============================================================================
// HOEK & MARINOS GSI CALCULATOR (OTHER SUPPORTED METHOD)
// ============================================================================

export const GSI_STRUCTURE_OPTIONS: {
  id: GsiParameters['structureCategory'];
  label: string;
  rating: number;
}[] = [
  {
    id: 'INTACT_OR_MASSIVE',
    label: 'Intact or Massive — intact rock specimens or massive in-situ rock with few widely spaced discontinuities',
    rating: 80,
  },
  {
    id: 'BLOCKY',
    label: 'Blocky — well interlocked undisturbed rock mass consisting of cubical blocks formed by 3 intersecting discontinuity sets',
    rating: 65,
  },
  {
    id: 'VERY_BLOCKY',
    label: 'Very Blocky — interlocked, partially disturbed mass with multi-faceted angular blocks formed by 4 or more joint sets',
    rating: 50,
  },
  {
    id: 'BLOCKY_DISTURBED_SEAMY',
    label: 'Blocky / Disturbed / Seamy — folded with angular blocks formed by many intersecting discontinuity sets',
    rating: 35,
  },
  {
    id: 'DISINTEGRATED',
    label: 'Disintegrated — poorly interlocked, heavily broken rock mass with mixture of angular and rounded rock pieces',
    rating: 22,
  },
  {
    id: 'LAMINATED_SHEARED',
    label: 'Laminated / Sheared — lack of blockiness due to close spacing of weak schistosity or shear planes',
    rating: 12,
  },
];

export const GSI_SURFACE_CONDITION_OPTIONS: {
  id: GsiParameters['surfaceConditionCategory'];
  label: string;
  rating: number;
}[] = [
  {
    id: 'VERY_GOOD',
    label: 'Very Good — very rough, fresh unweathered surfaces',
    rating: 80,
  },
  {
    id: 'GOOD',
    label: 'Good — rough, slightly weathered, iron-stained surfaces',
    rating: 65,
  },
  {
    id: 'FAIR',
    label: 'Fair — smooth, moderately weathered and altered surfaces',
    rating: 50,
  },
  {
    id: 'POOR',
    label: 'Poor — slickensided, highly weathered surfaces with compact coatings or fillings',
    rating: 30,
  },
  {
    id: 'VERY_POOR',
    label: 'Very Poor — slickensided, highly weathered surfaces with soft clay coatings or fillings',
    rating: 15,
  },
];

export function createDefaultGsiParameters(): GsiParameters {
  return {
    structureCategory: 'BLOCKY',
    structureRating: 65,
    surfaceConditionCategory: 'GOOD',
    surfaceConditionRating: 65,
    disturbanceFactorD: 0.0,
    intactUcsMPa: 75,
    miHoekBrownConstant: 17,
    paramStatus: {
      structure: 'USER_ENTERED',
      surfaceCondition: 'USER_ENTERED',
      intactUcs: 'USER_ENTERED',
    },
    userConfirmed: true,
    confirmedAt: new Date().toISOString(),
  };
}

export function calculateHoekGsi(params: GsiParameters): GsiCalculationResult {
  const missingParamLabels: string[] = [];
  const unconfirmedParamLabels: string[] = [];

  if (
    params.paramStatus.structure === 'MISSING' ||
    params.structureCategory === 'MISSING' ||
    params.structureRating === null
  ) {
    missingParamLabels.push('1. Rock Mass Structure Interlocking');
  } else if (params.paramStatus.structure === 'AI_SUGGESTED_UNCONFIRMED') {
    unconfirmedParamLabels.push('1. Rock Mass Structure Interlocking');
  }

  if (
    params.paramStatus.surfaceCondition === 'MISSING' ||
    params.surfaceConditionCategory === 'MISSING' ||
    params.surfaceConditionRating === null
  ) {
    missingParamLabels.push('2. Discontinuity Surface Condition');
  } else if (params.paramStatus.surfaceCondition === 'AI_SUGGESTED_UNCONFIRMED') {
    unconfirmedParamLabels.push('2. Discontinuity Surface Condition');
  }

  if (params.paramStatus.intactUcs === 'MISSING' || params.intactUcsMPa === null) {
    missingParamLabels.push('3. Intact Rock UCS (MPa)');
  } else if (params.paramStatus.intactUcs === 'AI_SUGGESTED_UNCONFIRMED') {
    unconfirmedParamLabels.push('3. Intact Rock UCS (MPa)');
  }

  const isComplete = missingParamLabels.length === 0;
  const hasUnconfirmedSuggestions = unconfirmedParamLabels.length > 0;

  if (
    !isComplete ||
    params.structureRating === null ||
    params.surfaceConditionRating === null
  ) {
    return {
      isComplete: false,
      hasUnconfirmedSuggestions,
      missingParamLabels,
      unconfirmedParamLabels,
      gsiValue: null,
      gsiRangeLabel: 'Required input not available',
      rockMassClassLabel: 'Required input not available',
      colorHex: '#64748B',
      mbReducedConstant: null,
      sConstant: null,
      aConstant: null,
      deformationModulusGPa: null,
      recommendedSupportGuidelines: 'Required input not available — select Structure & Surface Condition.',
      calculationSummaryFormula: `Missing: ${missingParamLabels.join(', ')}`,
    };
  }

  const gsiValue = Math.max(
    5,
    Math.min(95, Math.round(0.5 * params.structureRating + 0.5 * params.surfaceConditionRating))
  );
  const gsiRangeLabel = `${Math.max(5, gsiValue - 3)} – ${Math.min(95, gsiValue + 3)}`;

  const D = Math.max(0, Math.min(0.8, params.disturbanceFactorD ?? 0));
  const mi = Math.max(4, params.miHoekBrownConstant ?? 15);
  const ucs = Math.max(1, params.intactUcsMPa ?? 75);

  const mbReducedConstant = Number((mi * Math.exp((gsiValue - 100) / (28 - 14 * D))).toFixed(3));
  const sConstant = Number(Math.exp((gsiValue - 100) / (9 - 3 * D)).toFixed(5));
  const aConstant = Number((0.5 + (1 / 6) * (Math.exp(-gsiValue / 15) - Math.exp(-20 / 3))).toFixed(3));

  // Simplified Hoek & Diederichs (2006) rock mass modulus Em (GPa)
  const deformationModulusGPa = Number(
    (
      (1 - D / 2) *
      Math.sqrt(Math.min(ucs, 100) / 100) *
      10 *
      Math.pow(10, (gsiValue - 10) / 40)
    ).toFixed(2)
  );

  let rockMassClassLabel = 'FAIR TO GOOD BLOCKY ROCK MASS';
  let colorHex = '#10B981';
  let recommendedSupportGuidelines =
    'Pattern rock bolting L=3.5–4.0m with fiber-reinforced shotcrete 50–100mm.';

  if (gsiValue >= 75) {
    rockMassClassLabel = 'VERY GOOD INTACT / BLOCKY ROCK MASS';
    colorHex = '#059669';
    recommendedSupportGuidelines = 'Spot bolting only on localized structural wedges.';
  } else if (gsiValue >= 55) {
    rockMassClassLabel = 'GOOD INTERLOCKED BLOCKY ROCK MASS';
    colorHex = '#10B981';
    recommendedSupportGuidelines = 'Systematic rock bolts L=3.5m @ 2.0m c/c + 50mm SFRS in crown.';
  } else if (gsiValue >= 35) {
    rockMassClassLabel = 'FAIR VERY BLOCKY / DISTURBED ROCK MASS';
    colorHex = '#D97706';
    recommendedSupportGuidelines = 'Systematic rock bolts L=4.0m @ 1.5m c/c + 100mm SFRS in crown & walls.';
  } else {
    rockMassClassLabel = 'POOR DISINTEGRATED / SHEARED ROCK MASS';
    colorHex = '#DC2626';
    recommendedSupportGuidelines =
      'Lattice girders / steel ribs + 150–200mm SFRS + forepoling canopy + invert closure.';
  }

  const calculationSummaryFormula = `GSI = ${gsiValue} (Range ${gsiRangeLabel}) | mb=${mbReducedConstant}, s=${sConstant}, a=${aConstant}, Em=${deformationModulusGPa} GPa`;

  return {
    isComplete: true,
    hasUnconfirmedSuggestions,
    missingParamLabels: [],
    unconfirmedParamLabels,
    gsiValue,
    gsiRangeLabel,
    rockMassClassLabel,
    colorHex,
    mbReducedConstant,
    sConstant,
    aConstant,
    deformationModulusGPa,
    recommendedSupportGuidelines,
    calculationSummaryFormula,
  };
}

// ============================================================================
// STATION CLASSIFICATION STORAGE (LOCAL STORAGE + PROJECT MEMORY)
// ============================================================================

const STATION_CLASSIFICATIONS_STORAGE_KEY = 'eswa_tunnel_station_classifications_v20_fresh';

export function buildStationClassificationKey(
  tunnelName: string,
  location: string,
  chainageRd: string
): string {
  return `${(tunnelName || '').trim().toLowerCase()}|${(location || '').trim().toLowerCase()}|${(
    chainageRd || ''
  )
    .trim()
    .toLowerCase()}`;
}

export function loadAllStationClassificationRecords(): Record<
  string,
  StationClassificationStorageRecord
> {
  try {
    const raw = localStorage.getItem(STATION_CLASSIFICATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

export function saveStationClassificationRecord(
  record: StationClassificationStorageRecord
): Record<string, StationClassificationStorageRecord> {
  const all = loadAllStationClassificationRecords();
  const key = buildStationClassificationKey(record.tunnel, record.location, record.chainageRd);
  const next = {
    ...all,
    [key]: {
      ...record,
      dateVersion: new Date().toISOString(),
    },
  };
  try {
    localStorage.setItem(STATION_CLASSIFICATIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
  return next;
}

// ============================================================================
// LAUBSCHER MRMR (MINING ROCK MASS RATING) CALCULATOR
// ============================================================================

export function calculateLaubscherMrmr(
  params?: Partial<LaubscherMrmrParameters>
): LaubscherMrmrParameters {
  const baseRmr = Math.max(0, Math.min(100, params?.baseRmr ?? 65));
  const weatheringFactor = Math.max(0.6, Math.min(1.0, params?.weatheringFactor ?? 0.95));
  const jointOrientationFactor = Math.max(0.6, Math.min(1.0, params?.jointOrientationFactor ?? 0.90));
  const miningInducedStressFactor = Math.max(0.5, Math.min(1.3, params?.miningInducedStressFactor ?? 0.85));
  const blastingDamageFactor = Math.max(0.7, Math.min(1.0, params?.blastingDamageFactor ?? 0.90));

  const totalMrmr = Math.round(
    baseRmr *
      weatheringFactor *
      jointOrientationFactor *
      miningInducedStressFactor *
      blastingDamageFactor
  );

  let rockClass: LaubscherMrmrParameters['rockClass'] = 'CLASS_3';
  let rockClassDescription = 'Fair Rock (Class 3)';

  if (totalMrmr >= 81) {
    rockClass = 'CLASS_1';
    rockClassDescription = 'Very Good Rock (Class 1) — Generally unsupported or spot bolts';
  } else if (totalMrmr >= 61) {
    rockClass = 'CLASS_2';
    rockClassDescription = 'Good Rock (Class 2) — Light pattern bolting (2.0m - 2.5m)';
  } else if (totalMrmr >= 41) {
    rockClass = 'CLASS_3';
    rockClassDescription = 'Fair Rock (Class 3) — Pattern bolting (1.5m - 2.0m) + mesh / shotcrete';
  } else if (totalMrmr >= 21) {
    rockClass = 'CLASS_4';
    rockClassDescription = 'Poor Rock (Class 4) — Heavy pattern bolting (1.0m - 1.2m) + mesh + 50-100mm shotcrete';
  } else {
    rockClass = 'CLASS_5';
    rockClassDescription = 'Very Poor Rock (Class 5) — Heavy spiling/forepoling + steel sets + fiber-reinforced shotcrete';
  }

  return {
    baseRmr,
    weatheringFactor,
    jointOrientationFactor,
    miningInducedStressFactor,
    blastingDamageFactor,
    totalMrmr,
    rockClass,
    rockClassDescription,
  };
}

// ============================================================================
// MATHEWS / POTVIN STABILITY GRAPH CALCULATOR (OPEN STOPE DESIGN)
// ============================================================================

export function calculateMathewsStability(
  params?: Partial<MathewsStabilityParameters>
): MathewsStabilityParameters {
  const rqd = Math.max(5, Math.min(100, params?.rqd ?? 75));
  const jn = Math.max(1, Math.min(15, params?.jn ?? 6));
  const jr = Math.max(0.5, Math.min(4, params?.jr ?? 2));
  const ja = Math.max(0.5, Math.min(8, params?.ja ?? 2));

  // Modified Barton Q' = (RQD / Jn) * (Jr / Ja)
  const modifiedQPrime = Number(((rqd / jn) * (jr / ja)).toFixed(2));

  // Factor A: Rock Stress Factor
  const sigmaC_MPa = Math.max(5, params?.sigmaC_MPa ?? 90);
  const inducedStress_sigma1_MPa = Math.max(1, params?.inducedStress_sigma1_MPa ?? 30);
  const stressRatio = sigmaC_MPa / inducedStress_sigma1_MPa;

  let stressFactorA = 1.0;
  if (stressRatio < 2.0) {
    stressFactorA = 0.1;
  } else if (stressRatio <= 10.0) {
    stressFactorA = Number(Math.max(0.1, Math.min(1.0, 0.1125 * stressRatio - 0.125)).toFixed(2));
  } else {
    stressFactorA = 1.0;
  }

  // Factor B: Joint Orientation Factor
  const jointOrientationAngleThetaDeg = Math.max(0, Math.min(90, params?.jointOrientationAngleThetaDeg ?? 45));
  const jointOrientationFactorB = Number(
    Math.max(0.2, Math.min(1.0, 0.2 + 0.8 * (jointOrientationAngleThetaDeg / 90))).toFixed(2)
  );

  // Factor C: Gravity Adjustment Factor
  const stopeDipAngleDeg = Math.max(0, Math.min(90, params?.stopeDipAngleDeg ?? 65));
  const dipRad = (stopeDipAngleDeg * Math.PI) / 180;
  const gravityFactorC = Number(Math.max(2.0, Math.min(8.0, 8 - 6 * Math.cos(dipRad))).toFixed(2));

  // Modified Stability Number N' = Q' * A * B * C
  const modifiedStabilityNumberNPrime = Number(
    (modifiedQPrime * stressFactorA * jointOrientationFactorB * gravityFactorC).toFixed(2)
  );

  // Stope Geometry & Hydraulic Radius (HR = Area / Perimeter)
  const stopeSurfaceAreaSqM = Math.max(1, params?.stopeSurfaceAreaSqM ?? 120);
  const stopeSurfacePerimeterMeters = Math.max(1, params?.stopeSurfacePerimeterMeters ?? 46);
  const hydraulicRadiusMeters = Number(
    (stopeSurfaceAreaSqM / stopeSurfacePerimeterMeters).toFixed(2)
  );

  // Stability Zone Classification (Potvin 1988 empirical boundaries)
  // Stable curve: N' >= 0.5 * (HR ^ 1.3)
  // Caved curve:  N' <= 0.12 * (HR ^ 1.3)
  const stableThreshold = 0.5 * Math.pow(Math.max(0.5, hydraulicRadiusMeters), 1.3);
  const cavedThreshold = 0.12 * Math.pow(Math.max(0.5, hydraulicRadiusMeters), 1.3);

  let stabilityZone: MathewsStabilityParameters['stabilityZone'] = 'STABLE';
  if (modifiedStabilityNumberNPrime >= stableThreshold) {
    stabilityZone = 'STABLE';
  } else if (modifiedStabilityNumberNPrime <= cavedThreshold) {
    stabilityZone = 'CAVED_POTENTIALLY_UNSTABLE';
  } else {
    stabilityZone = 'TRANSITION';
  }

  return {
    rqd,
    jn,
    jr,
    ja,
    modifiedQPrime,
    sigmaC_MPa,
    inducedStress_sigma1_MPa,
    stressFactorA,
    jointOrientationAngleThetaDeg,
    jointOrientationFactorB,
    stopeDipAngleDeg,
    gravityFactorC,
    modifiedStabilityNumberNPrime,
    stopeSurfaceAreaSqM,
    stopeSurfacePerimeterMeters,
    hydraulicRadiusMeters,
    stabilityZone,
  };
}
