import { TunnelGeometry } from '../types/tunnel';
import { createTunnelGeometry } from './geometryEngine';

export type BlastCalcSupportTier =
  | 'none'
  | 'shotcrete_only'
  | 'mesh_shotcrete_no_bolts'
  | 'lg_or_rib_shotcrete'
  | 'partial_bolts_shotcrete'
  | 'full_natm_support';

export type BlastCalcShotcreteMix = 'plain' | 'steel_fiber' | 'synthetic_fiber';
export type BlastCalcMeshSpec =
  | 'none'
  | 'welded_6mm_150'
  | 'welded_8mm_150'
  | 'heavy_chainlink';

export type BlastCalcArchFrameType =
  | 'none'
  | 'lattice_girder'
  | 'steel_rib_ismb'
  | 'th_yielding_rib';

export type BlastCalcArchSectionProfile =
  | 'LG_70_22_32'
  | 'LG_95_25_32'
  | 'LG_115_26_36'
  | 'ISMB_150'
  | 'HB_160'
  | 'ISMB_200'
  | 'HEB_200'
  | 'TH_21'
  | 'TH_29'
  | 'TH_36';

export type BlastCalcArchFootSupport =
  | 'standard_baseplate'
  | 'elephant_foot'
  | 'invert_strut_closed';

export type BlastCalcBoltType =
  | 'sn_grouted_rebar'
  | 'swellex_friction'
  | 'self_drilling_ibo'
  | 'split_set'
  | 'cable_bolt';

export type BlastCalcForepolingType =
  | 'none'
  | 'rebar_spiling'
  | 'pipe_umbrella';

export type BlastCalcFaceSupportType =
  | 'none'
  | 'face_shotcrete_50mm'
  | 'face_fiberglass_bolts';

export type BlastCalcInvertSupportType =
  | 'none'
  | 'temporary_invert_strut'
  | 'closed_invert_arch';

export type BlastReadinessVerdict =
  | 'ALLOWED'
  | 'ALLOWED_WITH_MIN_SUPPORT'
  | 'ALLOWED_REDUCED_PULL'
  | 'STRICTLY_NOT_ALLOWED';

export interface BlastCalcInput {
  id?: string;
  scenarioLabel: string;
  chainageLabel: string;
  geologistName: string;

  // Step 1: Tunnel Shape & Stress Regime
  geometry: TunnelGeometry;
  overburdenM: number;
  unitWeightKnM3: number;
  k0Ratio: number;
  esr: number;

  // Step 2: Pull Progress & Rock Mass Quality
  currentPullM: number;
  exposedLengthM: number; // Axial length behind face that lacks full bolted support
  requiredNextPullM: number;
  delayHoursBeforeFullSupport: number;

  rockTypeName: string;
  rqdPct: number;
  ucsMpa: number;
  mi: number;
  blastDisturbanceD: number;

  qInputMode: 'direct' | 'detailed';
  qDirect: number;
  jn: number;
  jr: number;
  ja: number;
  jw: number;
  srf: number;

  rmrInputMode: 'direct' | 'detailed';
  rmrDirect: number;
  rmrSpacingRating: number; // 5..20
  rmrCondRating: number; // 0..30
  rmrWaterRating: number; // 0..15
  rmrOrientAdj: number; // -12..0

  gsiOverride: number | null;
  governingJointDipDeg: number;
  wedgeHeightM: number;

  // Step 3: Current Installed Support Condition
  supportTier: BlastCalcSupportTier;
  shotcreteThicknessMm: number;
  shotcreteMix: BlastCalcShotcreteMix;
  shotcreteAgeHours: number;
  wiremeshSpec: BlastCalcMeshSpec;

  // Bolt system
  boltType?: BlastCalcBoltType;
  boltLengthM: number;
  boltSpacingM: number;
  boltCapacityKn: number;
  boltsPerRing: number;

  // LG / Steel Rib / TH-Profile Arch System
  hasLatticeGirder: boolean; // Kept for backward compatibility
  archFrameType?: BlastCalcArchFrameType;
  archSectionProfile?: BlastCalcArchSectionProfile;
  archSpacingM?: number;
  archFootSupport?: BlastCalcArchFootSupport;

  // Auxiliary Ground Control (Forepoling, Face Support, Invert, Drainage)
  forepolingType?: BlastCalcForepolingType;
  forepolingLengthM?: number;
  forepolingSpacingCm?: number;
  faceSupportType?: BlastCalcFaceSupportType;
  invertSupport?: BlastCalcInvertSupportType;
  drainageReliefHoles?: boolean;
}

export interface StandUpCurvePoint {
  spanM: number;
  unsupportedHours: number;
  supportedHours: number;
}

export interface ConditionalPullRow {
  pullM: number;
  combinedExposedM: number;
  activeSpanM: number;
  fos: number;
  unsupportedStandUpHrs: number;
  supportedStandUpHrs: number;
  feasibleAsIs: boolean;
  statusLabel: 'SAFE AS-IS' | 'NEEDS UPGRADE' | 'PROHIBITED';
  requiredUpgradeText: string;
}

export interface MinimumSupportPrescription {
  actionSummary: string;
  shotcreteMm: number;
  shotcreteMixLabel: string;
  waitCureHours: number;
  wiremeshRequired: boolean;
  meshSpecLabel: string;
  boltsRequired: boolean;
  boltLengthM: number;
  boltSpacingM: number;
  boltsPerRing: number;
  forepolingRequired: boolean;
  latticeGirderRequired: boolean;
  recommendedArchLabel?: string;
}

export interface BlastCalculationStep {
  stepNumber: number;
  title: string;
  methodStandard: string;
  formula: string;
  substituted: string;
  resultValue: string;
  interpretation: string;
}

export interface BlastSafetyCheckRow {
  checkName: string;
  computedValue: string;
  acceptanceCriterion: string;
  marginText: string;
  status: 'PASS' | 'CAUTION' | 'FAIL';
}

export interface BlastCalcResult {
  computedAt: string;

  // Cross-section & stress summary
  tunnelAreaM2: number;
  equivalentRadiusM: number;
  inSituVerticalStressMpa: number;
  inSituHorizontalStressMpa: number;

  // Rock Mass Classification
  qIndex: number;
  qEffectiveBlastAdjusted: number;
  qNormalizedQc: number;
  rmr89: number;
  rmrCrossCheckFromQ: number;
  rmrDiscrepancyWarning: string | null;
  gsi: number;
  rockClassLabel: string;
  rmrBreakdown: {
    ucsRating: number;
    rqdRating: number;
    spacingRating: number;
    conditionRating: number;
    groundwaterRating: number;
    orientationAdj: number;
  };

  // Hoek-Brown, Mohr-Coulomb Equivalent & Convergence-Confinement (CCM/GRC + LDP)
  mb: number;
  s: number;
  a: number;
  cohesionMpa: number;
  frictionAngleDeg: number;
  sigmaCmMpa: number;
  ermGpa: number;
  squeezingRatio: number;
  squeezingClass: string;
  criticalSupportPressurePcrMpa: number;
  plasticRadiusM: number;
  plasticThicknessM: number;
  unsupportedRadialDispMm: number;
  postBlastTunnelStrainPct: number;
  strainSeverityClass: string;
  crownSupportDemandKpa: number;
  postBlastSupportDemandKpa: number;

  // Barton Q-ESR & Critical Span
  maxUnsupportedSpanDmaxM: number;
  currentActiveSpanM: number;
  postBlastActiveSpanM: number;
  postBlastTotalExposedM: number;
  bartonRecommendedBoltSpacingM: number;
  bartonRecommendedShotcreteMm: number;

  // Early-Age Support & Detailed Multi-Component Capacity Breakdown
  earlyAgeShotcreteMpa: number;
  earlyAgeShotcreteBondMpa: number;
  blastDynamicPpvMmSec: number;
  blastDynamicPeelStressMpa: number;
  shotcreteBlastBondFos: number;

  installedShotcreteCapacityKpa: number;
  installedMeshFactor: number;
  installedBoltCapacityKpa: number;
  installedGirderCapacityKpa: number; // Combined LG / Rib / TH Arch capacity
  installedArchLabel: string;
  installedForepolingCapacityKpa: number;
  installedFaceInvertCapacityKpa: number;
  totalInstalledCapacityKpa: number;

  wedgeGravityDemandKpa: number;
  wedgeGravityFos: number;
  currentFos: number;
  postBlastFos: number;

  // Dual Stand-Up Time (Without Support vs Installed Support)
  unsupportedStandUpCurrentHrs: number;
  unsupportedStandUpPostBlastHrs: number;
  supportedStandUpCurrentHrs: number;
  supportedStandUpPostBlastHrs: number;
  remainingSafeWindowHrs: number;
  standUpCurvePoints: StandUpCurvePoint[];

  // Decision Verdict, Step-by-Step Math & Audit
  verdict: BlastReadinessVerdict;
  verdictTitle: string;
  verdictSubtitle: string;
  governingFailureMode: string;
  maxSafeNextPullM: number;
  requiredNextPullFeasibleAsIs: boolean;
  minimumSupportForRequiredPull: MinimumSupportPrescription;
  conditionalPullMatrix: ConditionalPullRow[];
  safetyChecks: BlastSafetyCheckRow[];
  calculationSteps: BlastCalculationStep[];
  engineeringWarnings: string[];
}

export interface BlastCalcHistoryRecord {
  id: string;
  savedAt: string;
  input: BlastCalcInput;
  result: BlastCalcResult;
}

export interface BlastCalcSavedShape {
  id: string;
  name: string;
  savedAt: string;
  geometry: TunnelGeometry;
  overburdenM?: number;
  unitWeightKnM3?: number;
  k0Ratio?: number;
  esr?: number;
}

const HISTORY_STORAGE_KEY = 'eswa_blast_standup_history_v1';
const LAST_SHAPE_STORAGE_KEY = 'eswa_blast_calc_last_shape_v1';
const SAVED_SHAPES_STORAGE_KEY = 'eswa_blast_calc_saved_shapes_v1';

// ============================================================================
// TUNNEL SHAPE MEMORY & SAVED SHAPES VAULT (ISOLATED FROM NATM PROJECT FLOW)
// ============================================================================
export interface RememberedShapePayload {
  geometry: TunnelGeometry;
  savedAt: string;
  overburdenM?: number;
  unitWeightKnM3?: number;
  k0Ratio?: number;
  esr?: number;
}

export function saveLastUsedShape(
  geometry: TunnelGeometry,
  stress?: { overburdenM: number; unitWeightKnM3: number; k0Ratio: number; esr: number }
): void {
  try {
    const payload: RememberedShapePayload = {
      geometry: JSON.parse(JSON.stringify(geometry)),
      savedAt: new Date().toISOString(),
      ...(stress || {}),
    };
    localStorage.setItem(LAST_SHAPE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadLastUsedShape(): RememberedShapePayload | null {
  try {
    const raw = localStorage.getItem(LAST_SHAPE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.geometry && typeof parsed.geometry.width === 'number') {
      return parsed as RememberedShapePayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadBlastCalcSavedShapes(): BlastCalcSavedShape[] {
  try {
    const raw = localStorage.getItem(SAVED_SHAPES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BlastCalcSavedShape[]) : [];
  } catch {
    return [];
  }
}

export function saveBlastCalcShapePreset(
  name: string,
  geometry: TunnelGeometry,
  stress?: { overburdenM: number; unitWeightKnM3: number; k0Ratio: number; esr: number }
): BlastCalcSavedShape[] {
  const existing = loadBlastCalcSavedShapes();
  const cleanName = name.trim() || `${geometry.crownGeometry.toUpperCase()} (${geometry.width.toFixed(1)}×${geometry.height.toFixed(1)}m)`;
  const record: BlastCalcSavedShape = {
    id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: cleanName,
    savedAt: new Date().toISOString(),
    geometry: JSON.parse(JSON.stringify(geometry)),
    ...(stress || {}),
  };
  const next = [record, ...existing.filter((s) => s.name !== cleanName)].slice(0, 25);
  try {
    localStorage.setItem(SAVED_SHAPES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function deleteBlastCalcShapePreset(id: string): BlastCalcSavedShape[] {
  const existing = loadBlastCalcSavedShapes();
  const next = existing.filter((r) => r.id !== id);
  try {
    localStorage.setItem(SAVED_SHAPES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function createDefaultBlastCalcInput(): BlastCalcInput {
  const defaultGeom = createTunnelGeometry(8.4, 7.2, 4.2, 'd_shaped', 4.2, 'manual');
  return {
    scenarioLabel: 'Heading Shift Blast Check',
    chainageLabel: 'CH 1+240.0m',
    geologistName: 'Shift Engineering Geologist',

    geometry: defaultGeom,
    overburdenM: 120,
    unitWeightKnM3: 26.5,
    k0Ratio: 1.0,
    esr: 1.0,

    currentPullM: 2.5,
    exposedLengthM: 2.5,
    requiredNextPullM: 2.5,
    delayHoursBeforeFullSupport: 12,

    rockTypeName: 'Quartzite / Schistose Gneiss',
    rqdPct: 58,
    ucsMpa: 65,
    mi: 17,
    blastDisturbanceD: 0.4,

    qInputMode: 'detailed',
    qDirect: 2.4,
    jn: 9,
    jr: 2.0,
    ja: 2.0,
    jw: 0.85,
    srf: 2.5,

    rmrInputMode: 'detailed',
    rmrDirect: 54,
    rmrSpacingRating: 10,
    rmrCondRating: 18,
    rmrWaterRating: 10,
    rmrOrientAdj: -5,

    gsiOverride: null,
    governingJointDipDeg: 62,
    wedgeHeightM: 1.6,

    supportTier: 'shotcrete_only',
    shotcreteThicknessMm: 50,
    shotcreteMix: 'steel_fiber',
    shotcreteAgeHours: 8,
    wiremeshSpec: 'none',

    boltType: 'sn_grouted_rebar',
    boltLengthM: 3.0,
    boltSpacingM: 1.8,
    boltCapacityKn: 160,
    boltsPerRing: 7,

    hasLatticeGirder: false,
    archFrameType: 'none',
    archSectionProfile: 'LG_95_25_32',
    archSpacingM: 1.2,
    archFootSupport: 'standard_baseplate',

    forepolingType: 'none',
    forepolingLengthM: 4.0,
    forepolingSpacingCm: 40,
    faceSupportType: 'none',
    invertSupport: 'none',
    drainageReliefHoles: false,
  };
}

export function createInitialBlastCalcInputWithLastShape(): {
  input: BlastCalcInput;
  restoredLastShapeAt: string | null;
} {
  const base = createDefaultBlastCalcInput();
  const remembered = loadLastUsedShape();
  if (!remembered) {
    return { input: base, restoredLastShapeAt: null };
  }
  return {
    input: {
      ...base,
      geometry: remembered.geometry,
      overburdenM: remembered.overburdenM ?? base.overburdenM,
      unitWeightKnM3: remembered.unitWeightKnM3 ?? base.unitWeightKnM3,
      k0Ratio: remembered.k0Ratio ?? base.k0Ratio,
      esr: remembered.esr ?? base.esr,
    },
    restoredLastShapeAt: remembered.savedAt,
  };
}

// Normalize legacy saved inputs seamlessly
function normalizeInputDefaults(raw: BlastCalcInput): Required<Omit<BlastCalcInput, 'id' | 'gsiOverride'>> & {
  id?: string;
  gsiOverride: number | null;
} {
  const archFrameType: BlastCalcArchFrameType =
    raw.archFrameType ??
    (raw.hasLatticeGirder || raw.supportTier === 'lg_or_rib_shotcrete'
      ? 'lattice_girder'
      : 'none');
  const archSectionProfile: BlastCalcArchSectionProfile =
    raw.archSectionProfile ??
    (archFrameType === 'steel_rib_ismb'
      ? 'ISMB_150'
      : archFrameType === 'th_yielding_rib'
      ? 'TH_29'
      : 'LG_95_25_32');

  return {
    ...raw,
    boltType: raw.boltType ?? 'sn_grouted_rebar',
    archFrameType,
    archSectionProfile,
    archSpacingM: raw.archSpacingM ?? 1.2,
    archFootSupport: raw.archFootSupport ?? 'standard_baseplate',
    forepolingType: raw.forepolingType ?? 'none',
    forepolingLengthM: raw.forepolingLengthM ?? 4.0,
    forepolingSpacingCm: raw.forepolingSpacingCm ?? 40,
    faceSupportType: raw.faceSupportType ?? 'none',
    invertSupport: raw.invertSupport ?? 'none',
    drainageReliefHoles: raw.drainageReliefHoles ?? false,
  };
}

export function computeTunnelCrossSectionAreaM2(geom: TunnelGeometry): number {
  if (typeof geom.designAreaSqMeters === 'number' && geom.designAreaSqMeters > 1.0) {
    return Number(geom.designAreaSqMeters.toFixed(2));
  }

  const w = Math.max(1.5, geom.width || 8.4);
  const h = Math.max(1.5, geom.height || 7.2);
  const wallH = Math.max(0, Math.min(h * 0.9, geom.wallHeight || h * 0.55));

  const pts = geom.crossSectionPoints;
  if (pts && pts.length >= 3) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    const absArea = Math.abs(area) * 0.5;
    if (absArea > 1.0) return Number(absArea.toFixed(2));
  }

  if (geom.crownGeometry === 'circular') {
    return Number((Math.PI * (w / 2) * (h / 2)).toFixed(2));
  }
  if (geom.crownGeometry === 'rectangular') {
    return Number((w * h).toFixed(2));
  }
  const archRise = Math.max(0.2, h - wallH);
  const rectArea = w * wallH;
  const archArea = (Math.PI * (w / 2) * archRise) / 2;
  const sideFlareFactor = geom.crownGeometry === 'horseshoe' ? 0.96 : 1.0;
  return Number(((rectArea + archArea) * sideFlareFactor).toFixed(2));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function ucsToRmrRating(ucsMpa: number): number {
  if (ucsMpa >= 250) return 15;
  if (ucsMpa >= 100) return 12 + ((ucsMpa - 100) / 150) * 3;
  if (ucsMpa >= 50) return 7 + ((ucsMpa - 50) / 50) * 5;
  if (ucsMpa >= 25) return 4 + ((ucsMpa - 25) / 25) * 3;
  if (ucsMpa >= 5) return 2 + ((ucsMpa - 5) / 20) * 2;
  if (ucsMpa >= 1) return 1;
  return 0;
}

function rqdToRmrRating(rqdPct: number): number {
  if (rqdPct >= 90) return 17 + ((rqdPct - 90) / 10) * 3;
  if (rqdPct >= 75) return 13 + ((rqdPct - 75) / 15) * 4;
  if (rqdPct >= 50) return 8 + ((rqdPct - 50) / 25) * 5;
  if (rqdPct >= 25) return 5 + ((rqdPct - 25) / 25) * 3;
  return 3 + (rqdPct / 25) * 2;
}

/**
 * Early-age shotcrete compressive strength gain (Widmann / CEB-FIP accelerated sprayed concrete curve)
 * Assumes f_cm28 = 34 MPa (plain) or 38 MPa (steel fiber).
 */
export function computeEarlyAgeShotcreteMpa(
  ageHours: number,
  mix: BlastCalcShotcreteMix
): number {
  const safeHours = Math.max(0.5, ageHours);
  const f28 = mix === 'steel_fiber' ? 38.0 : mix === 'synthetic_fiber' ? 36.5 : 34.0;
  const sCoeff = 0.21; // Rapid-hardening accelerator curve for NATM sprayed shotcrete
  const ageDays = Math.min(28, safeHours / 24);
  const ratio = Math.exp(sCoeff * (1 - Math.sqrt(28 / Math.max(0.02, ageDays))));
  return Number(clamp(f28 * ratio, 0.6, f28).toFixed(2));
}

export interface BartonSrfStressEstimate {
  srf: number;
  regimeLabel: string;
  sigmaCtoSigma1: number;
  sigmaThetaToSigmaCm: number;
}

/**
 * Barton / NGI (2002) stress-based SRF check directly coupled to overburden depth H,
 * unit weight γ, stress ratio K₀, intact UCS, and Hoek-Brown mass strength σ_cm.
 */
export function estimateBartonSrfFromStress(
  ucsMpa: number,
  verticalStressMpa: number,
  k0Ratio: number,
  sigmaCmMpa: number
): BartonSrfStressEstimate {
  const sigma1 = Math.max(0.05, Math.max(verticalStressMpa, verticalStressMpa * Math.max(0.25, k0Ratio)));
  const sigma3 = Math.max(0.02, Math.min(verticalStressMpa, verticalStressMpa * Math.max(0.25, k0Ratio)));
  const sigmaTheta = Math.max(0.05, 3 * sigma1 - sigma3);
  const sigmaCtoSigma1 = Number((Math.max(0.5, ucsMpa) / sigma1).toFixed(2));
  const sigmaThetaToSigmaCm = Number((sigmaTheta / Math.max(0.05, sigmaCmMpa)).toFixed(2));

  if (sigmaCmMpa < 15 && sigmaThetaToSigmaCm >= 5.0) {
    return {
      srf: 12.0,
      regimeLabel: 'Heavy Squeezing Ground (σ_θ/σ_cm ≥ 5)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  if (sigmaCmMpa < 20 && sigmaThetaToSigmaCm >= 2.0) {
    return {
      srf: 7.5,
      regimeLabel: 'Mild-Moderate Squeezing (σ_θ/σ_cm 2–5)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  if (sigmaCtoSigma1 > 200) {
    return {
      srf: 2.5,
      regimeLabel: 'Low Stress / Near Portal (σ_c/σ₁ > 200)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  if (sigmaCtoSigma1 >= 10) {
    return {
      srf: 1.0,
      regimeLabel: 'Medium Favourable Stress (σ_c/σ₁ 10–200)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  if (sigmaCtoSigma1 >= 5) {
    return {
      srf: 2.0,
      regimeLabel: 'Tight / Moderate Slabbing (σ_c/σ₁ 5–10)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  if (sigmaCtoSigma1 >= 2.5) {
    return {
      srf: 7.5,
      regimeLabel: 'Heavy Slabbing / Spalling (σ_c/σ₁ 2.5–5)',
      sigmaCtoSigma1,
      sigmaThetaToSigmaCm,
    };
  }
  return {
    srf: 15.0,
    regimeLabel: 'Extreme Rock Stress / Squeeze (σ_c/σ₁ < 2.5)',
    sigmaCtoSigma1,
    sigmaThetaToSigmaCm,
  };
}

function computeEffectiveActiveSpanM(
  tunnelWidthM: number,
  axialExposedM: number,
  forepolingType: BlastCalcForepolingType = 'none'
): number {
  const B = Math.max(1.5, tunnelWidthM);
  const L = Math.max(0.5, axialExposedM);
  const fpReduction =
    forepolingType === 'pipe_umbrella'
      ? 0.72
      : forepolingType === 'rebar_spiling'
      ? 0.85
      : 1.0;
  const effL = L * fpReduction;
  if (effL <= B) {
    return Number((0.42 * B + 0.58 * effL).toFixed(2));
  }
  const overhangFactor = 1 + 0.22 * Math.min(2.5, (effL - B) / B);
  return Number((B * overhangFactor).toFixed(2));
}

function computeBieniawskiUnsupportedHours(
  rmrEff: number,
  activeSpanM: number,
  dMaxM: number,
  squeezingRatio: number
): number {
  const S = Math.max(0.75, activeSpanM);
  // Exact Bieniawski (1989) stand-up chart calibration: log10(t_hrs) = 0.115*RMR - 1.75*log10(S) - 2.65
  const logHours = 0.115 * clamp(rmrEff, 6, 95) - 1.75 * Math.log10(S) - 2.65;
  let hours = Math.pow(10, logHours);

  if (S > dMaxM && dMaxM > 0) {
    const excessRatio = S / Math.max(0.35, dMaxM);
    hours = hours / Math.pow(excessRatio, 1.85);
  }
  if (squeezingRatio < 0.75) {
    hours = hours * Math.pow(Math.max(0.12, squeezingRatio / 0.75), 1.5);
  }
  return Number(clamp(hours, 0.02, 87600).toFixed(2));
}

// Structural steel profile properties for LG (Pantex 3-bar), Steel Ribs (ISMB/HEB), and TH Yielding Ribs
interface ArchSectionSpec {
  label: string;
  areaCm2: number;
  yieldMpa: number;
  compositeBoost: number;
}

const ARCH_PROFILE_SPECS: Record<BlastCalcArchSectionProfile, ArchSectionSpec> = {
  LG_70_22_32: { label: 'LG 70/22/32 (3-Bar Pantex)', areaCm2: 14.3, yieldMpa: 500, compositeBoost: 1.18 },
  LG_95_25_32: { label: 'LG 95/25/32 (3-Bar Heavy)', areaCm2: 17.9, yieldMpa: 500, compositeBoost: 1.24 },
  LG_115_26_36: { label: 'LG 115/26/36 (3-Bar Extra Heavy)', areaCm2: 20.8, yieldMpa: 500, compositeBoost: 1.28 },
  ISMB_150: { label: 'Steel Rib ISMB 150 (I-Beam)', areaCm2: 19.0, yieldMpa: 250, compositeBoost: 1.08 },
  HB_160: { label: 'Steel Rib H-Beam HEB 160', areaCm2: 54.3, yieldMpa: 355, compositeBoost: 1.14 },
  ISMB_200: { label: 'Steel Rib ISMB 200 (Heavy)', areaCm2: 32.3, yieldMpa: 250, compositeBoost: 1.10 },
  HEB_200: { label: 'Steel Rib HEB 200 (Extra Heavy)', areaCm2: 78.1, yieldMpa: 355, compositeBoost: 1.16 },
  TH_21: { label: 'Yielding Arch TH-21 Profile', areaCm2: 26.8, yieldMpa: 340, compositeBoost: 1.12 },
  TH_29: { label: 'Yielding Arch TH-29 Profile', areaCm2: 37.0, yieldMpa: 340, compositeBoost: 1.15 },
  TH_36: { label: 'Yielding Arch TH-36 Heavy', areaCm2: 45.9, yieldMpa: 340, compositeBoost: 1.18 },
};

interface SupportCapacityEval {
  earlyAgeShotcreteMpa: number;
  shotcreteCapacityKpa: number;
  meshFactor: number;
  boltCapacityKpa: number;
  girderCapacityKpa: number;
  archLabel: string;
  forepolingCapacityKpa: number;
  faceInvertCapacityKpa: number;
  totalCapacityKpa: number;
  rmrConfinementBoost: number;
  isBolted: boolean;
  hasStructuralArch: boolean;
  boltAnchorEfficiency: number;
  boltAnchorStatus: 'none' | 'anchored_elastic' | 'marginal_boundary' | 'floating_in_plastic';
}

function evaluateSupportCapacity(
  tier: BlastCalcSupportTier,
  shotcreteMm: number,
  mix: BlastCalcShotcreteMix,
  ageHours: number,
  meshSpec: BlastCalcMeshSpec,
  boltType: BlastCalcBoltType,
  boltLengthM: number,
  boltSpacingM: number,
  boltCapacityKn: number,
  boltsPerRing: number,
  archFrameType: BlastCalcArchFrameType,
  archSectionProfile: BlastCalcArchSectionProfile,
  archSpacingM: number,
  archFootSupport: BlastCalcArchFootSupport,
  forepolingType: BlastCalcForepolingType,
  forepolingLengthM: number,
  forepolingSpacingCm: number,
  faceSupportType: BlastCalcFaceSupportType,
  invertSupport: BlastCalcInvertSupportType,
  drainageReliefHoles: boolean,
  tunnelWidthM: number,
  eqRadiusM: number,
  plasticThicknessUnsupM: number,
  squeezingRatio: number
): SupportCapacityEval {
  if (tier === 'none') {
    const forepoleOnlyKpa =
      forepolingType === 'pipe_umbrella'
        ? 110
        : forepolingType === 'rebar_spiling'
        ? 55
        : 0;
    return {
      earlyAgeShotcreteMpa: 0,
      shotcreteCapacityKpa: 0,
      meshFactor: 1.0,
      boltCapacityKpa: 0,
      girderCapacityKpa: 0,
      archLabel: 'None',
      forepolingCapacityKpa: forepoleOnlyKpa,
      faceInvertCapacityKpa: 0,
      totalCapacityKpa: forepoleOnlyKpa,
      rmrConfinementBoost: forepoleOnlyKpa > 0 ? 4 : 0,
      isBolted: false,
      hasStructuralArch: false,
      boltAnchorEfficiency: 0,
      boltAnchorStatus: 'none',
    };
  }

  const effectiveMm = Math.max(20, shotcreteMm);
  const fcu = computeEarlyAgeShotcreteMpa(ageHours, mix);
  const meshMult =
    tier === 'shotcrete_only' || meshSpec === 'none'
      ? mix === 'steel_fiber'
        ? 1.32
        : mix === 'synthetic_fiber'
        ? 1.22
        : 1.0
      : meshSpec === 'welded_8mm_150'
      ? 1.78
      : meshSpec === 'welded_6mm_150'
      ? 1.56
      : 1.48;

  const isBolted =
    tier === 'partial_bolts_shotcrete' || tier === 'full_natm_support';
  const hasArch =
    archFrameType !== 'none' || tier === 'lg_or_rib_shotcrete';

  const archSpan = Math.max(2.0, tunnelWidthM);
  const tM = effectiveMm / 1000;
  const drainageMult = drainageReliefHoles ? 1.08 : 1.0;
  const rawShellKpa = ((fcu * 1000 * tM * 0.28) / archSpan) * meshMult * drainageMult;

  const shotcreteCapacityKpa = Number(
    (isBolted
      ? Math.min(980, rawShellKpa * 1.4)
      : hasArch
      ? Math.min(640, rawShellKpa * 1.28)
      : Math.min(tier === 'mesh_shotcrete_no_bolts' ? 210 : 115, rawShellKpa)
    ).toFixed(1)
  );

  // Rock Bolts with explicit plastic-zone anchorage embedment check
  let boltCapacityKpa = 0;
  let boltAnchorEfficiency = 0;
  let boltAnchorStatus: SupportCapacityEval['boltAnchorStatus'] = 'none';
  if (isBolted) {
    const safeSpacing = Math.max(0.75, boltSpacingM);
    const effectiveAreaM2 = safeSpacing * safeSpacing;
    if (plasticThicknessUnsupM <= 0.35) {
      boltAnchorEfficiency = 0.96;
      boltAnchorStatus = 'anchored_elastic';
    } else if (boltLengthM >= plasticThicknessUnsupM + 0.8) {
      boltAnchorEfficiency = 1.0;
      boltAnchorStatus = 'anchored_elastic';
    } else if (boltLengthM >= plasticThicknessUnsupM) {
      boltAnchorEfficiency =
        0.72 + 0.28 * ((boltLengthM - plasticThicknessUnsupM) / 0.8);
      boltAnchorStatus = 'marginal_boundary';
    } else {
      // Floating bolts inside yielding plastic zone cannot tie back into intact elastic core
      boltAnchorEfficiency = clamp(
        0.24 + 0.48 * (boltLengthM / Math.max(0.5, plasticThicknessUnsupM)),
        0.24,
        0.72
      );
      boltAnchorStatus = 'floating_in_plastic';
    }

    const boltTypeEfficiency =
      boltType === 'cable_bolt'
        ? 1.08
        : boltType === 'self_drilling_ibo'
        ? 1.0
        : boltType === 'sn_grouted_rebar'
        ? 0.94
        : boltType === 'swellex_friction'
        ? 0.90
        : 0.72;
    const densityFactor =
      tier === 'full_natm_support'
        ? clamp(boltsPerRing / 7, 0.75, 1.45)
        : clamp(boltsPerRing / 10, 0.35, 0.85);
    boltCapacityKpa = Number(
      (
        (boltCapacityKn / effectiveAreaM2) *
        boltAnchorEfficiency *
        boltTypeEfficiency *
        densityFactor *
        0.85
      ).toFixed(1)
    );
  }

  // Steel Arch / LG / Steel Rib / TH Yielding Rib capacity (Carranza-Torres & Fairhurst curved ring thrust)
  let girderCapacityKpa = 0;
  let archLabel = 'None';
  if (hasArch) {
    const effectiveProfile: BlastCalcArchSectionProfile =
      archFrameType === 'none' ? 'LG_95_25_32' : archSectionProfile;
    const spec = ARCH_PROFILE_SPECS[effectiveProfile];
    const safeArchSpacing = clamp(archSpacingM, 0.6, 2.5);
    const areaM2 = spec.areaCm2 * 1e-4;
    const sigmaKpa = spec.yieldMpa * 1000;
    const footMult =
      archFootSupport === 'invert_strut_closed'
        ? 1.15
        : archFootSupport === 'elephant_foot'
        ? squeezingRatio < 0.45
          ? 0.96
          : 1.02
        : squeezingRatio < 0.45
        ? 0.70 // Soft squeezing ground punches standard baseplates without elephant foot / closed invert
        : 0.86;
    const shotcreteCompositeMult =
      effectiveMm >= 100 && fcu >= 8 ? spec.compositeBoost : 0.94;
    const rawArchKpa =
      ((areaM2 * sigmaKpa) / (safeArchSpacing * Math.max(1.5, eqRadiusM))) *
      0.36 *
      footMult *
      shotcreteCompositeMult;
    girderCapacityKpa = Number(clamp(rawArchKpa, 45, 920).toFixed(1));
    archLabel = `${spec.label} @ ${safeArchSpacing.toFixed(2)}m c/c`;
  }

  // Forepoling / Pipe Umbrella Roof
  let forepolingCapacityKpa = 0;
  if (forepolingType === 'pipe_umbrella') {
    const spcFactor = clamp(40 / Math.max(20, forepolingSpacingCm), 0.65, 1.4);
    const lenFactor = clamp(forepolingLengthM / 9, 0.75, 1.25);
    forepolingCapacityKpa = Number((145 * spcFactor * lenFactor).toFixed(1));
  } else if (forepolingType === 'rebar_spiling') {
    const spcFactor = clamp(40 / Math.max(20, forepolingSpacingCm), 0.65, 1.4);
    forepolingCapacityKpa = Number((72 * spcFactor).toFixed(1));
  }

  // Face & Invert Auxiliary Ring Closure Support
  let faceInvertCapacityKpa = 0;
  if (faceSupportType === 'face_shotcrete_50mm') faceInvertCapacityKpa += 28;
  if (faceSupportType === 'face_fiberglass_bolts') faceInvertCapacityKpa += 60;
  if (invertSupport === 'temporary_invert_strut') faceInvertCapacityKpa += 70;
  if (invertSupport === 'closed_invert_arch') faceInvertCapacityKpa += 145;

  const totalCapacityKpa = Number(
    (
      shotcreteCapacityKpa +
      boltCapacityKpa +
      girderCapacityKpa +
      forepolingCapacityKpa +
      faceInvertCapacityKpa
    ).toFixed(1)
  );

  // Equivalent RMR confinement boost for Bieniawski stand-up curve (attenuated for weak-rock floating bolts)
  let rmrBoost = 0;
  if (tier === 'shotcrete_only') {
    rmrBoost = 3 + Math.min(4.5, (fcu / 18) * 3.5) + (mix === 'steel_fiber' ? 1.5 : 0);
  } else if (tier === 'mesh_shotcrete_no_bolts') {
    rmrBoost = 6.5 + Math.min(6, (fcu / 18) * 4.5) + (effectiveMm >= 100 ? 2.5 : 0);
  } else if (tier === 'lg_or_rib_shotcrete') {
    rmrBoost = 13 + Math.min(10, girderCapacityKpa / 32);
  } else if (tier === 'partial_bolts_shotcrete') {
    rmrBoost =
      (14 + Math.min(8.5, (boltCapacityKpa + girderCapacityKpa) / 32)) *
      (0.55 + 0.45 * boltAnchorEfficiency);
  } else if (tier === 'full_natm_support') {
    rmrBoost = 22 + Math.min(13, totalCapacityKpa / 55);
  }
  if (forepolingType !== 'none') rmrBoost += forepolingType === 'pipe_umbrella' ? 6 : 3.5;
  if (invertSupport !== 'none') rmrBoost += invertSupport === 'closed_invert_arch' ? 4.5 : 2;

  return {
    earlyAgeShotcreteMpa: fcu,
    shotcreteCapacityKpa,
    meshFactor: Number(meshMult.toFixed(2)),
    boltCapacityKpa,
    girderCapacityKpa,
    archLabel,
    forepolingCapacityKpa,
    faceInvertCapacityKpa,
    totalCapacityKpa,
    rmrConfinementBoost: Number(rmrBoost.toFixed(1)),
    isBolted,
    hasStructuralArch: hasArch,
    boltAnchorEfficiency: Number(boltAnchorEfficiency.toFixed(2)),
    boltAnchorStatus,
  };
}

interface CcmPlasticSolution {
  rpM: number;
  rpRatio: number;
  uMaxMm: number;
}

function solveDuncanFamaCcm(
  eqRadiusM: number,
  meanStressMpa: number,
  sigmaCmMpa: number,
  kp: number,
  pcrMpa: number,
  ermMpa: number,
  poisson: number,
  piMpa: number
): CcmPlasticSolution {
  const safeErm = Math.max(35, ermMpa);
  const effPi = Math.max(0, piMpa);
  if (pcrMpa <= 0 || effPi >= pcrMpa) {
    const uElMm =
      (((1 + poisson) * eqRadiusM * Math.max(0.005, meanStressMpa - effPi)) / safeErm) * 1000;
    return {
      rpM: eqRadiusM,
      rpRatio: 1.0,
      uMaxMm: Math.max(0.1, uElMm),
    };
  }
  const safeSigCm = Math.max(0.03, sigmaCmMpa);
  const kMinus1 = Math.max(0.15, kp - 1);
  const numer = 2 * (meanStressMpa * kMinus1 + safeSigCm);
  const denom = (1 + kp) * (kMinus1 * effPi + safeSigCm);
  const rpRatio = clamp(Math.pow(Math.max(1.0, numer / Math.max(0.01, denom)), 1 / kMinus1), 1.0, 4.8);
  const rpM = eqRadiusM * rpRatio;
  const uMaxMm =
    (((eqRadiusM * (1 + poisson)) / safeErm) *
      (2 * (1 - poisson) * (meanStressMpa - pcrMpa) * rpRatio * rpRatio -
        (1 - 2 * poisson) * Math.max(0, meanStressMpa - effPi))) *
    1000;
  return {
    rpM,
    rpRatio,
    uMaxMm: Math.max(0.2, uMaxMm),
  };
}

function computeVlachopoulosLdpRatio(
  distBehindFaceM: number,
  eqRadiusM: number,
  rpM: number,
  faceSupported: boolean
): number {
  const rStar = Math.max(1.0, rpM / Math.max(0.5, eqRadiusM));
  const u0OverUmax = (1 / 3) * Math.exp(-0.15 * rStar) * (faceSupported ? 0.78 : 1.0);
  const xEff = Math.max(0, distBehindFaceM);
  const uOverUmax = 1 - (1 - u0OverUmax) * Math.exp((-1.5 * xEff) / Math.max(eqRadiusM, rpM));
  return clamp(uOverUmax, u0OverUmax, 1.0);
}

function evaluateScenarioFoSAndStandUp(
  input: ReturnType<typeof normalizeInputDefaults>,
  qBlastEff: number,
  rmr89: number,
  dMaxM: number,
  squeezingRatio: number,
  crownDemandKpa: number,
  eqRadiusM: number,
  meanStressMpa: number,
  sigmaCmMpa: number,
  kp: number,
  pcrMpa: number,
  ermMpa: number,
  rpUnsupRatio: number,
  supEval: SupportCapacityEval,
  nextPullM: number,
  overrideTier?: BlastCalcSupportTier
): {
  activeSpanM: number;
  combinedExposedM: number;
  demandKpa: number;
  fos: number;
  unsupportedHrs: number;
  supportedHrs: number;
  dispMm: number;
  strainPct: number;
} {
  const combinedExposedM = Number((input.exposedLengthM + nextPullM).toFixed(2));
  const activeSpanM = computeEffectiveActiveSpanM(
    input.geometry.width,
    combinedExposedM,
    input.forepolingType
  );

  const width = Math.max(2.0, input.geometry.width);
  const overhangRatio = Math.max(1.0, combinedExposedM / Math.max(1.5, width * 0.85));
  const hasFrameOrBolts =
    (supEval.isBolted || supEval.hasStructuralArch) && overrideTier !== 'none';
  const overhangDemandMultiplier = hasFrameOrBolts
    ? 1.0 + 0.08 * Math.max(0, overhangRatio - 1)
    : 1.0 + 0.42 * Math.pow(Math.max(0, overhangRatio - 1), 1.18);

  const wedgeGravityKpa =
    input.unitWeightKnM3 *
    Math.max(0.4, input.wedgeHeightM) *
    (0.45 + 0.55 * Math.sin((clamp(input.governingJointDipDeg, 10, 90) * Math.PI) / 180));

  const demandKpa = Number(
    (
      Math.max(crownDemandKpa, wedgeGravityKpa * 0.85) *
      overhangDemandMultiplier
    ).toFixed(1)
  );

  // Weak-rock intrinsic arch resistance: decays sharply once plastic yield develops (P_cr > 0) or Q* < 1
  const baseRockRatio =
    qBlastEff >= 4
      ? 1.30 + 0.10 * Math.min(2.0, Math.log10(qBlastEff))
      : qBlastEff >= 1
      ? 0.68 + 0.20 * (qBlastEff - 1)
      : clamp(0.05 + 0.58 * Math.pow(Math.max(0.001, qBlastEff), 0.78), 0.04, 0.63);
  const plasticArchDecay =
    pcrMpa > 0 ? clamp(1 / Math.pow(Math.max(1.0, rpUnsupRatio), 0.72), 0.28, 1.0) : 1.0;
  const rockSelfCapKpa = demandKpa * baseRockRatio * plasticArchDecay;

  const dMaxFactor =
    activeSpanM > dMaxM
      ? hasFrameOrBolts
        ? 0.90
        : clamp(Math.pow(dMaxM / Math.max(0.5, activeSpanM), 1.15), 0.18, 0.92)
      : 1.0;

  const freshShotcreteBlastFactor =
    nextPullM > 0 && input.supportTier !== 'none' && overrideTier !== 'none'
      ? input.shotcreteAgeHours < 4
        ? supEval.hasStructuralArch || supEval.isBolted
          ? 0.76
          : 0.54
        : input.shotcreteAgeHours < 8
        ? supEval.hasStructuralArch || supEval.isBolted
          ? 0.90
          : 0.80
        : 1.0
      : 1.0;

  const effectiveTotalCapKpa =
    (rockSelfCapKpa * dMaxFactor + supEval.totalCapacityKpa) *
    freshShotcreteBlastFactor;

  const fos = Number(
    clamp(effectiveTotalCapKpa / Math.max(12, demandKpa), 0.12, 5.0).toFixed(2)
  );

  // CCM + Vlachopoulos-Diederichs (2009) LDP tunnel strain at distance combinedExposedM
  const ccmSup = solveDuncanFamaCcm(
    eqRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    pcrMpa,
    ermMpa,
    0.25,
    supEval.totalCapacityKpa / 1000
  );
  const faceSupported = input.faceSupportType !== 'none';
  const ldpFactor = computeVlachopoulosLdpRatio(
    combinedExposedM,
    eqRadiusM,
    ccmSup.rpM,
    faceSupported
  );
  const dispMm = Number((ccmSup.uMaxMm * ldpFactor).toFixed(1));
  const strainPct = Number(
    clamp((dispMm / (eqRadiusM * 1000)) * 100, 0.02, 15.0).toFixed(2)
  );

  const unsupportedHrs = computeBieniawskiUnsupportedHours(
    rmr89,
    activeSpanM,
    dMaxM,
    squeezingRatio
  );

  const capRatio = supEval.totalCapacityKpa / Math.max(15, demandKpa);
  let supportedHrs = unsupportedHrs;
  if (supEval.totalCapacityKpa > 0 && overrideTier !== 'none') {
    const highCreepOpenInvert =
      strainPct >= 2.5 && input.invertSupport === 'none' && (input.archFrameType ?? 'none') !== 'th_yielding_rib';
    if (
      (supEval.isBolted || supEval.hasStructuralArch) &&
      fos >= 1.3 &&
      capRatio >= 0.85 &&
      !highCreepOpenInvert &&
      supEval.boltAnchorStatus !== 'floating_in_plastic'
    ) {
      supportedHrs = Math.min(87600, Math.max(720, unsupportedHrs * 45));
    } else {
      supportedHrs = computeBieniawskiUnsupportedHours(
        Math.min(95, rmr89 + supEval.rmrConfinementBoost),
        activeSpanM,
        dMaxM * (1 + capRatio * 0.75),
        squeezingRatio * (1 + capRatio * 0.4)
      );
      if (highCreepOpenInvert) {
        supportedHrs = Math.min(supportedHrs, Math.max(2.0, 72 / Math.max(1.0, strainPct)));
      }
      if (fos < 1.0) {
        supportedHrs = Math.min(supportedHrs, Math.max(0.25, unsupportedHrs * 1.35));
      }
    }
  }

  return {
    activeSpanM,
    combinedExposedM,
    demandKpa,
    fos,
    unsupportedHrs: Number(unsupportedHrs.toFixed(2)),
    supportedHrs: Number(supportedHrs.toFixed(2)),
    dispMm,
    strainPct,
  };
}

export function runBlastReadinessAnalysis(rawInput: BlastCalcInput): BlastCalcResult {
  const input = normalizeInputDefaults(rawInput);

  const tunnelAreaM2 = computeTunnelCrossSectionAreaM2(input.geometry);
  const equivalentRadiusM = Number(Math.sqrt(tunnelAreaM2 / Math.PI).toFixed(2));
  const inSituVerticalStressMpa = Number(
    ((input.unitWeightKnM3 * Math.max(1, input.overburdenM)) / 1000).toFixed(2)
  );
  const inSituHorizontalStressMpa = Number(
    (inSituVerticalStressMpa * Math.max(0.25, input.k0Ratio)).toFixed(2)
  );

  // 1. Q-System
  const rawQ =
    input.qInputMode === 'detailed'
      ? (clamp(input.rqdPct, 10, 100) / Math.max(0.5, input.jn)) *
        (Math.max(0.5, input.jr) / Math.max(0.5, input.ja)) *
        (Math.max(0.05, input.jw) / Math.max(0.5, input.srf))
      : Math.max(0.001, input.qDirect);
  const qIndex = Number(clamp(rawQ, 0.001, 1000).toFixed(3));
  const blastKnockFactor = clamp(
    1 - Math.max(0, input.blastDisturbanceD - 0.35) * 0.35,
    0.55,
    1.0
  );
  const qEffectiveBlastAdjusted = Number((qIndex * blastKnockFactor).toFixed(3));
  const qNormalizedQc = Number(
    (qEffectiveBlastAdjusted * (Math.max(1, input.ucsMpa) / 100)).toFixed(3)
  );

  // 2. Bieniawski RMR89 + Exact Bieniawski Q Correlation
  const ucsRating = Number(ucsToRmrRating(input.ucsMpa).toFixed(1));
  const rqdRating = Number(rqdToRmrRating(input.rqdPct).toFixed(1));
  const computedRmr89 = clamp(
    ucsRating +
      rqdRating +
      input.rmrSpacingRating +
      input.rmrCondRating +
      input.rmrWaterRating +
      input.rmrOrientAdj,
    5,
    100
  );
  const rmr89 = Number(
    (input.rmrInputMode === 'detailed'
      ? computedRmr89
      : clamp(input.rmrDirect, 5, 100)
    ).toFixed(1)
  );
  // Bieniawski (1989): RMR = 9 * ln(Q) + 44
  const rmrCrossCheckFromQ = Number(
    clamp(9 * Math.log(Math.max(0.001, qIndex)) + 44, 5, 95).toFixed(1)
  );
  const rmrDiff = Math.abs(rmr89 - rmrCrossCheckFromQ);
  const rmrDiscrepancyWarning =
    rmrDiff > 15
      ? `Entered RMR (${rmr89}) differs from Barton Q correlation 9·ln(Q)+44 (${rmrCrossCheckFromQ}) by ${rmrDiff.toFixed(
          0
        )} pts. Governing safety check uses the conservative boundary.`
      : null;

  const effectiveRmrForSafety =
    rmrDiff > 15 ? Math.min(rmr89, rmrCrossCheckFromQ + 4) : rmr89;

  const rockClassLabel =
    rmr89 >= 81
      ? 'Class I — Very Good Rock'
      : rmr89 >= 61
      ? 'Class II — Good Rock'
      : rmr89 >= 41
      ? 'Class III — Fair Rock'
      : rmr89 >= 21
      ? 'Class IV — Poor Rock'
      : 'Class V — Very Poor Rock';

  // 3. Hoek-Brown (2002) & Hoek-Carter-Diederichs (2013) Weak-Rock GSI Safeguard
  const jRatio = input.jr / Math.max(0.5, input.ja);
  const gsiHcd =
    input.qInputMode === 'detailed'
      ? clamp((52 * jRatio) / (1 + jRatio) + 0.5 * input.rqdPct, 8, 92)
      : clamp(1.5 * input.rmrCondRating + 0.5 * input.rqdPct, 8, 92);
  let autoGsi = effectiveRmrForSafety - 5;
  let gsiMethodUsed = 'GSI = RMR89 - 5';
  if (effectiveRmrForSafety < 25) {
    autoGsi = gsiHcd;
    gsiMethodUsed = 'Hoek-Carter-Diederichs (2013) Weak-Rock GSI [RMR<25]';
  } else if (effectiveRmrForSafety < 32) {
    const t = (effectiveRmrForSafety - 25) / 7;
    autoGsi = (1 - t) * gsiHcd + t * (effectiveRmrForSafety - 5);
    gsiMethodUsed = 'Transitioned HCD (2013) / RMR-5 GSI';
  }
  const gsi = Number(
    clamp(input.gsiOverride !== null ? input.gsiOverride : autoGsi, 8, 95).toFixed(1)
  );

  const D = clamp(input.blastDisturbanceD, 0, 1);
  // Hoek (2002/2012): Blast disturbance D affects the near-excavation skin; far-field CCM uses attenuated D_far
  const dFar = Number((D * 0.25).toFixed(3));
  const preSupportGsiBonus =
    input.forepolingType === 'pipe_umbrella'
      ? 6.0
      : input.forepolingType === 'rebar_spiling'
      ? 3.0
      : 0;
  const gsiFarField = clamp(gsi + preSupportGsiBonus, 8, 95);

  const mb = Number(
    (input.mi * Math.exp((gsi - 100) / Math.max(4, 28 - 14 * D))).toFixed(4)
  );
  const s = Number(Math.exp((gsi - 100) / Math.max(2, 9 - 3 * D)).toFixed(6));
  const a = Number((0.5 + (Math.exp(-gsi / 15) - Math.exp(-20 / 3)) / 6).toFixed(4));

  // Far-field Hoek-Brown parameters for global CCM ground reaction curve (Hoek & Marinos 2000)
  const mbFar = input.mi * Math.exp((gsiFarField - 100) / Math.max(4, 28 - 14 * dFar));
  const sFar = Math.exp((gsiFarField - 100) / Math.max(2, 9 - 3 * dFar));
  const aFar = 0.5 + (Math.exp(-gsiFarField / 15) - Math.exp(-20 / 3)) / 6;

  const sigmaCmMpa = Number(
    (
      Math.max(0.8, input.ucsMpa) *
      ((mbFar + 4 * sFar - aFar * (mbFar - 8 * sFar)) *
        Math.pow(mbFar / 4 + sFar, aFar - 1)) /
      (2 * (1 + aFar) * (2 + aFar))
    ).toFixed(2)
  );
  const mrModulusRatio = clamp(150 + input.mi * 10, 180, 500);
  const eiMpa = Math.max(800, input.ucsMpa * mrModulusRatio);
  const ermGpa = Number(
    (
      (eiMpa *
        (0.02 + (1 - dFar / 2) / (1 + Math.exp((60 + 15 * dFar - gsiFarField) / 11)))) /
      1000
    ).toFixed(3)
  );
  const ermMpa = ermGpa * 1000;

  // Equivalent Mohr-Coulomb (c', phi') over tunnel confining stress range
  const meanStressMpa = (inSituVerticalStressMpa + inSituHorizontalStressMpa) / 2;
  const sig3MaxRatio = clamp(
    0.47 * Math.pow(Math.max(0.06, sigmaCmMpa / Math.max(0.05, meanStressMpa)), -0.94),
    0.04,
    0.35
  );
  const tempRad =
    1 +
    (6 * aFar * mbFar * Math.pow(sFar + mbFar * sig3MaxRatio, aFar - 1)) /
      ((1 + aFar) * (2 + aFar));
  const frictionAngleDeg = Number(
    clamp(
      (Math.asin(clamp((tempRad - 1) / (tempRad + 1), 0.05, 0.92)) * 180) / Math.PI,
      16,
      56
    ).toFixed(1)
  );
  const cohesionMpa = Number(
    clamp(
      (input.ucsMpa *
        ((1 + 2 * aFar) * sFar + (1 - aFar) * mbFar * sig3MaxRatio) *
        Math.pow(sFar + mbFar * sig3MaxRatio, aFar - 1)) /
        ((1 + aFar) * (2 + aFar) * Math.sqrt(tempRad)),
      0.025,
      12.0
    ).toFixed(3)
  );

  const squeezingRatio = Number(
    (sigmaCmMpa / Math.max(0.05, inSituVerticalStressMpa)).toFixed(2)
  );
  const squeezingClass =
    squeezingRatio >= 1.0
      ? 'No Squeezing (Elastic)'
      : squeezingRatio >= 0.45
      ? 'Minor Squeezing / Stress Slabbing'
      : squeezingRatio >= 0.25
      ? 'Moderate Squeezing Risk'
      : 'Severe / Heavy Squeezing Ground';

  // Analytical Duncan-Fama (1993) Critical Pressure P_cr & Unsupported Plastic Radius
  const phiRad = (frictionAngleDeg * Math.PI) / 180;
  const kp = (1 + Math.sin(phiRad)) / Math.max(0.08, 1 - Math.sin(phiRad));
  const criticalSupportPressurePcrMpa = Number(
    Math.max(0, (2 * meanStressMpa - sigmaCmMpa) / (1 + kp)).toFixed(3)
  );

  const ccmUnsupported = solveDuncanFamaCcm(
    equivalentRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    criticalSupportPressurePcrMpa,
    ermMpa,
    0.25,
    0
  );
  const plasticThicknessUnsupM = Math.max(0, ccmUnsupported.rpM - equivalentRadiusM);

  // 4. Evaluate Installed Support Capacity (two-pass pre-bolt CCM confinement for accurate weak-rock bolt embedment)
  const supEvalPass1 = evaluateSupportCapacity(
    input.supportTier,
    input.shotcreteThicknessMm,
    input.shotcreteMix,
    input.shotcreteAgeHours,
    input.wiremeshSpec,
    input.boltType,
    input.boltLengthM,
    input.boltSpacingM,
    input.boltCapacityKn,
    input.boltsPerRing,
    input.archFrameType,
    input.archSectionProfile,
    input.archSpacingM,
    input.archFootSupport,
    input.forepolingType,
    input.forepolingLengthM,
    input.forepolingSpacingCm,
    input.faceSupportType,
    input.invertSupport,
    input.drainageReliefHoles,
    input.geometry.width,
    equivalentRadiusM,
    plasticThicknessUnsupM,
    squeezingRatio
  );

  // When a structural arch (LG/Steel Rib/TH-Rib), Pipe Umbrella, or closed invert confines the crown,
  // actual plastic zone expansion around the bolts is governed by the confined pre-bolt/supported CCM radius.
  const preBoltConfinementMpa =
    (supEvalPass1.shotcreteCapacityKpa +
      supEvalPass1.girderCapacityKpa +
      supEvalPass1.forepolingCapacityKpa +
      supEvalPass1.faceInvertCapacityKpa) /
    1000;
  const ccmPreBolt = solveDuncanFamaCcm(
    equivalentRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    criticalSupportPressurePcrMpa,
    ermMpa,
    0.25,
    preBoltConfinementMpa
  );
  const effectivePlasticDepthForBoltsM =
    supEvalPass1.hasStructuralArch || input.forepolingType === 'pipe_umbrella'
      ? Math.max(0, ccmPreBolt.rpM - equivalentRadiusM)
      : plasticThicknessUnsupM;

  const supEval = evaluateSupportCapacity(
    input.supportTier,
    input.shotcreteThicknessMm,
    input.shotcreteMix,
    input.shotcreteAgeHours,
    input.wiremeshSpec,
    input.boltType,
    input.boltLengthM,
    input.boltSpacingM,
    input.boltCapacityKn,
    input.boltsPerRing,
    input.archFrameType,
    input.archSectionProfile,
    input.archSpacingM,
    input.archFootSupport,
    input.forepolingType,
    input.forepolingLengthM,
    input.forepolingSpacingCm,
    input.faceSupportType,
    input.invertSupport,
    input.drainageReliefHoles,
    input.geometry.width,
    equivalentRadiusM,
    effectivePlasticDepthForBoltsM,
    squeezingRatio
  );

  // Supported Plastic Radius under installed internal pressure P_i = totalCapacityKpa / 1000
  const ccmSupported = solveDuncanFamaCcm(
    equivalentRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    criticalSupportPressurePcrMpa,
    ermMpa,
    0.25,
    supEval.totalCapacityKpa / 1000
  );
  const plasticRadiusM = Number(ccmSupported.rpM.toFixed(2));
  const plasticThicknessM = Number(
    Math.max(0, plasticRadiusM - equivalentRadiusM).toFixed(2)
  );

  // Barton NGI Roof Demand (handles Jn < 9 vs Jn >= 9) + Plastic Loosening Dead-Load + Controlled-Yield CCM Pressure
  const effJrForDemand =
    input.qInputMode === 'detailed'
      ? input.jr
      : input.qDirect < 0.2
      ? 1.0
      : input.qDirect < 1.0
      ? 1.5
      : 2.0;
  const ngiRoofDemandKpa =
    input.qInputMode === 'detailed' && input.jn < 9
      ? ((200 * Math.sqrt(Math.max(0.5, input.jn))) / (3 * Math.max(0.5, effJrForDemand))) *
        Math.pow(Math.max(0.002, qEffectiveBlastAdjusted), -1 / 3)
      : (200 / Math.max(0.5, effJrForDemand)) *
        Math.pow(Math.max(0.002, qEffectiveBlastAdjusted), -1 / 3);

  const unalLoosenHeightM =
    input.geometry.width * ((100 - effectiveRmrForSafety) / 100);
  const plasticLoosenDeadLoadKpa =
    criticalSupportPressurePcrMpa > 0
      ? input.unitWeightKnM3 *
        Math.min(plasticThicknessUnsupM * 0.50, unalLoosenHeightM * 0.85) *
        (input.invertSupport === 'closed_invert_arch' ? 0.85 : 1.0)
      : 0;

  // Solve CCM minimum support pressure Pi to cap post-blast LDP heading strain at <= 3.0% (controlled NATM yield)
  let ccmStrainTargetDemandKpa = 0;
  const postLdpUnsup = computeVlachopoulosLdpRatio(
    input.exposedLengthM + input.requiredNextPullM,
    equivalentRadiusM,
    ccmUnsupported.rpM,
    input.faceSupportType !== 'none'
  );
  if (
    (ccmUnsupported.uMaxMm * postLdpUnsup) / (equivalentRadiusM * 1000) > 0.03 &&
    criticalSupportPressurePcrMpa > 0
  ) {
    let lo = 0;
    let hi = criticalSupportPressurePcrMpa;
    for (let iter = 0; iter < 18; iter++) {
      const mid = (lo + hi) / 2;
      const probe = solveDuncanFamaCcm(
        equivalentRadiusM,
        meanStressMpa,
        sigmaCmMpa,
        kp,
        criticalSupportPressurePcrMpa,
        ermMpa,
        0.25,
        mid
      );
      const ldpMid = computeVlachopoulosLdpRatio(
        input.exposedLengthM + input.requiredNextPullM,
        equivalentRadiusM,
        probe.rpM,
        input.faceSupportType !== 'none'
      );
      if ((probe.uMaxMm * ldpMid) / (equivalentRadiusM * 1000) > 0.03) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    ccmStrainTargetDemandKpa =
      hi *
      1000 *
      ((input.archFrameType ?? 'none') === 'th_yielding_rib' ? 0.65 : 0.78) *
      (input.invertSupport === 'closed_invert_arch' ? 0.85 : 1.0);
  }

  const crownSupportDemandKpa = Number(
    clamp(
      Math.max(ngiRoofDemandKpa, plasticLoosenDeadLoadKpa, ccmStrainTargetDemandKpa),
      18,
      2800
    ).toFixed(1)
  );

  // 5. Barton Critical Unsupported Span
  const maxUnsupportedSpanDmaxM = Number(
    (2.0 * Math.max(0.8, input.esr) * Math.pow(qEffectiveBlastAdjusted, 0.4)).toFixed(2)
  );
  const bartonRecommendedBoltSpacingM = Number(
    clamp(1.0 + 0.45 * Math.log10(Math.max(0.01, qIndex * 10)), 0.85, 2.8).toFixed(2)
  );
  const bartonRecommendedShotcreteMm =
    qIndex >= 10
      ? 0
      : qIndex >= 4
      ? 50
      : qIndex >= 1
      ? 80
      : qIndex >= 0.4
      ? 120
      : qIndex >= 0.1
      ? 160
      : 220;

  // Early-Age Shotcrete Blast Dynamic PPV & Peel Bond Check (Ansell 2004 / Holmberg-Persson)
  const computeShotcreteBondFos = (
    tier: BlastCalcSupportTier,
    ageHours: number,
    mix: BlastCalcShotcreteMix,
    hasBoltsOrArch: boolean,
    pullM: number
  ): { bondMpa: number; ppvMmSec: number; peelMpa: number; bondFos: number } => {
    const fcuAge = computeEarlyAgeShotcreteMpa(ageHours, mix);
    // Ansell / Bryne early-age adhesion tensile capacity (~0.24 * sqrt(fcu), clamped 0.12 - 1.45 MPa)
    const bondMpa = Number(clamp(0.24 * Math.sqrt(fcuAge), 0.12, 1.45).toFixed(2));
    const chargePerDelayKg = Math.max(
      5,
      tunnelAreaM2 * 0.12 * clamp(pullM / 2.5, 0.55, 1.5)
    );
    const distToShotcreteM = Math.max(1.2, input.exposedLengthM);
    const scaledDist = distToShotcreteM / Math.sqrt(chargePerDelayKg);
    const ppvMmSec = Number(
      clamp(700 * Math.pow(Math.max(0.25, scaledDist), -1.42), 15, 1800).toFixed(0)
    );
    const peelMpa = Number(
      clamp(
        (ppvMmSec / 1000) * 0.62 * (hasBoltsOrArch ? 0.55 : 1.0),
        0.03,
        1.8
      ).toFixed(2)
    );
    const bondFos =
      tier === 'none'
        ? 1.5
        : Number(clamp(bondMpa / Math.max(0.03, peelMpa), 0.2, 4.5).toFixed(2));
    return { bondMpa, ppvMmSec, peelMpa, bondFos };
  };

  const bondCheck = computeShotcreteBondFos(
    input.supportTier,
    input.shotcreteAgeHours,
    input.shotcreteMix,
    supEval.hasStructuralArch || supEval.isBolted,
    input.requiredNextPullM
  );
  const earlyAgeShotcreteBondMpa = bondCheck.bondMpa;
  const blastDynamicPpvMmSec = bondCheck.ppvMmSec;
  const blastDynamicPeelStressMpa = bondCheck.peelMpa;
  const shotcreteBlastBondFos = bondCheck.bondFos;

  // Current (before next blast) vs Post-Next-Blast Evaluation
  const currentState = evaluateScenarioFoSAndStandUp(
    input,
    qEffectiveBlastAdjusted,
    effectiveRmrForSafety,
    maxUnsupportedSpanDmaxM,
    squeezingRatio,
    crownSupportDemandKpa,
    equivalentRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    criticalSupportPressurePcrMpa,
    ermMpa,
    ccmUnsupported.rpRatio,
    supEval,
    0
  );

  const postBlastState = evaluateScenarioFoSAndStandUp(
    input,
    qEffectiveBlastAdjusted,
    effectiveRmrForSafety,
    maxUnsupportedSpanDmaxM,
    squeezingRatio,
    crownSupportDemandKpa,
    equivalentRadiusM,
    meanStressMpa,
    sigmaCmMpa,
    kp,
    criticalSupportPressurePcrMpa,
    ermMpa,
    ccmUnsupported.rpRatio,
    supEval,
    input.requiredNextPullM
  );

  const unsupportedRadialDispMm = postBlastState.dispMm;
  const postBlastTunnelStrainPct = postBlastState.strainPct;
  const strainSeverityClass =
    postBlastTunnelStrainPct < 1.0
      ? 'Class A · Few Support Problems (<1%)'
      : postBlastTunnelStrainPct < 2.5
      ? 'Class B · Minor Squeezing (1–2.5%)'
      : postBlastTunnelStrainPct < 5.0
      ? 'Class C · Severe Squeezing (2.5–5%)'
      : 'Class D · Extreme Squeeze (>5%)';

  // Wedge Gravity FoS (accounts for Q>=4 rock mass interlocking within Dmax & penalizes weak/floating bolts)
  const wedgeGravityDemandKpa = Number(
    (
      input.unitWeightKnM3 *
      Math.max(0.4, input.wedgeHeightM) *
      (0.5 + 0.5 * Math.sin((clamp(input.governingJointDipDeg, 10, 90) * Math.PI) / 180))
    ).toFixed(1)
  );
  const computeWedgeFos = (
    evalSup: SupportCapacityEval,
    bLen: number,
    activeSpanForWedge: number
  ): number => {
    const withinDmax = activeSpanForWedge <= maxUnsupportedSpanDmaxM * 1.05;
    const rockWedgeShare =
      qEffectiveBlastAdjusted >= 4.0 && withinDmax
        ? wedgeGravityDemandKpa * clamp(1.18 + 0.16 * Math.log10(qEffectiveBlastAdjusted), 1.18, 1.65)
        : qEffectiveBlastAdjusted >= 1.5
        ? wedgeGravityDemandKpa * (withinDmax ? 0.85 : 0.60)
        : qEffectiveBlastAdjusted >= 0.4
        ? wedgeGravityDemandKpa * 0.28
        : wedgeGravityDemandKpa * 0.10;
    const boltWedgeEff = evalSup.isBolted
      ? clamp((bLen - input.wedgeHeightM * 0.35) / Math.max(0.8, input.wedgeHeightM), 0.25, 1.0)
      : 0;
    const scWedgeEff = evalSup.isBolted || evalSup.hasStructuralArch ? 0.92 : 0.42;
    const resist =
      rockWedgeShare +
      evalSup.shotcreteCapacityKpa * scWedgeEff +
      evalSup.girderCapacityKpa * 1.0 +
      evalSup.forepolingCapacityKpa * 0.9 +
      evalSup.faceInvertCapacityKpa * 0.35 +
      evalSup.boltCapacityKpa * boltWedgeEff;
    return Number(clamp(resist / Math.max(8, wedgeGravityDemandKpa), 0.15, 4.5).toFixed(2));
  };
  const wedgeGravityFos = computeWedgeFos(
    supEval,
    input.boltLengthM,
    postBlastState.activeSpanM
  );

  const passesAllGates = (
    state: ReturnType<typeof evaluateScenarioFoSAndStandUp>,
    evalSup: SupportCapacityEval,
    wFos: number,
    bFos: number
  ): boolean => {
    const passesFos = state.fos >= 1.25;
    const passesWedge = wFos >= 1.25;
    const passesTime =
      state.supportedHrs >= Math.max(4, input.delayHoursBeforeFullSupport * 1.4);
    const passesBond =
      evalSup.hasStructuralArch ||
      evalSup.isBolted ||
      bFos >= 1.15;
    const passesSpanCap =
      evalSup.isBolted ||
      evalSup.hasStructuralArch ||
      (state.combinedExposedM <=
        Math.max(input.geometry.width * 1.08, maxUnsupportedSpanDmaxM * 1.45) &&
        !(input.supportTier === 'none' && qEffectiveBlastAdjusted < 2.0));
    const passesStrain =
      state.strainPct < 2.5 || (evalSup.hasStructuralArch && state.strainPct < 4.5);
    return passesFos && passesWedge && passesTime && passesBond && passesSpanCap && passesStrain;
  };

  // 6. Sweep Max Safe Next Pull right now under current support
  let maxSafeNextPullM = 0;
  for (let p = 0.5; p <= 4.5; p += 0.25) {
    const testRes = evaluateScenarioFoSAndStandUp(
      input,
      qEffectiveBlastAdjusted,
      effectiveRmrForSafety,
      maxUnsupportedSpanDmaxM,
      squeezingRatio,
      crownSupportDemandKpa,
      equivalentRadiusM,
      meanStressMpa,
      sigmaCmMpa,
      kp,
      criticalSupportPressurePcrMpa,
      ermMpa,
      ccmUnsupported.rpRatio,
      supEval,
      p
    );
    const testBond = computeShotcreteBondFos(
      input.supportTier,
      input.shotcreteAgeHours,
      input.shotcreteMix,
      supEval.hasStructuralArch || supEval.isBolted,
      p
    );
    const testWedgeFos = computeWedgeFos(supEval, input.boltLengthM, testRes.activeSpanM);
    if (passesAllGates(testRes, supEval, testWedgeFos, testBond.bondFos)) {
      maxSafeNextPullM = Number(p.toFixed(2));
    } else {
      break;
    }
  }

  // 7. Minimum Support Prescription for User's Required Next Pull
  const requiredNextPullFeasibleAsIs = passesAllGates(
    postBlastState,
    supEval,
    wedgeGravityFos,
    shotcreteBlastBondFos
  );

  const buildMinimumPrescriptionForPull = (targetPull: number): MinimumSupportPrescription => {
    const deepBoltLen = Number(
      clamp(Math.max(3.5, plasticThicknessUnsupM + 1.2, input.wedgeHeightM + 1.4), 3.0, 9.0).toFixed(1)
    );
    const heavierBoltLen = Number(
      clamp(Math.max(4.5, plasticThicknessUnsupM + 1.6, input.wedgeHeightM + 1.8), 3.5, 10.0).toFixed(1)
    );

    const candidates: {
      tier: BlastCalcSupportTier;
      scMm: number;
      mix: BlastCalcShotcreteMix;
      ageH: number;
      mesh: BlastCalcMeshSpec;
      bLen: number;
      bSpc: number;
      bCount: number;
      archType: BlastCalcArchFrameType;
      archProf: BlastCalcArchSectionProfile;
      archSpc: number;
      foot: BlastCalcArchFootSupport;
      forepole: BlastCalcForepolingType;
      invert: BlastCalcInvertSupportType;
      label: string;
    }[] = [
      {
        tier: 'shotcrete_only',
        scMm: 50,
        mix: 'steel_fiber',
        ageH: 12,
        mesh: 'none',
        bLen: 3.0,
        bSpc: 2.0,
        bCount: 0,
        archType: 'none',
        archProf: 'LG_70_22_32',
        archSpc: 1.5,
        foot: 'standard_baseplate',
        forepole: 'none',
        invert: 'none',
        label: 'Apply 50mm Steel-Fiber Shotcrete sealing layer (cure min 12h) before blast',
      },
      {
        tier: 'mesh_shotcrete_no_bolts',
        scMm: 100,
        mix: 'steel_fiber',
        ageH: 14,
        mesh: 'welded_6mm_150',
        bLen: 3.0,
        bSpc: 1.8,
        bCount: 0,
        archType: 'none',
        archProf: 'LG_70_22_32',
        archSpc: 1.4,
        foot: 'standard_baseplate',
        forepole: 'none',
        invert: 'none',
        label: 'Install Welded Wiremesh (Ø6mm) + 100mm Sfr Shotcrete (cure >=14h) before blast',
      },
      {
        tier: 'lg_or_rib_shotcrete',
        scMm: 120,
        mix: 'steel_fiber',
        ageH: 12,
        mesh: 'welded_6mm_150',
        bLen: 3.0,
        bSpc: 1.6,
        bCount: 0,
        archType: 'lattice_girder',
        archProf: 'LG_95_25_32',
        archSpc: 1.2,
        foot: 'elephant_foot',
        forepole: 'none',
        invert: 'none',
        label: 'Erect Pantex Lattice Girder (LG 95/25/32) @ 1.2m + Mesh + 120mm Sfr before blast',
      },
      {
        tier: 'partial_bolts_shotcrete',
        scMm: 120,
        mix: 'steel_fiber',
        ageH: 12,
        mesh: 'welded_6mm_150',
        bLen: deepBoltLen,
        bSpc: 1.5,
        bCount: Math.max(6, Math.round(input.geometry.width / 1.35)),
        archType: 'none',
        archProf: 'LG_95_25_32',
        archSpc: 1.2,
        foot: 'standard_baseplate',
        forepole: 'none',
        invert: 'none',
        label: `Install ${deepBoltLen}m Pattern Crown Bolts + Wiremesh + 120mm Sfr Shotcrete prior to blast`,
      },
      {
        tier: 'full_natm_support',
        scMm: 160,
        mix: 'steel_fiber',
        ageH: 14,
        mesh: 'welded_8mm_150',
        bLen: deepBoltLen,
        bSpc: 1.2,
        bCount: Math.max(8, Math.round(input.geometry.width / 1.0)),
        archType: 'lattice_girder',
        archProf: 'LG_115_26_36',
        archSpc: 1.0,
        foot: 'elephant_foot',
        forepole: qEffectiveBlastAdjusted < 0.25 ? 'rebar_spiling' : 'none',
        invert: squeezingRatio < 0.45 ? 'temporary_invert_strut' : 'none',
        label: `Full NATM Support: LG 115 @ 1.0m + ${deepBoltLen}m Bolts @ 1.2m + Ø8mm Mesh + 160mm Sfr${
          qEffectiveBlastAdjusted < 0.25 ? ' + Forepoling Spiles' : ''
        }`,
      },
      {
        tier: 'full_natm_support',
        scMm: 220,
        mix: 'steel_fiber',
        ageH: 18,
        mesh: 'welded_8mm_150',
        bLen: heavierBoltLen,
        bSpc: 1.0,
        bCount: Math.max(10, Math.round(input.geometry.width / 0.85)),
        archType: squeezingRatio < 0.35 ? 'th_yielding_rib' : 'steel_rib_ismb',
        archProf: squeezingRatio < 0.35 ? 'TH_29' : 'ISMB_200',
        archSpc: 0.8,
        foot: 'invert_strut_closed',
        forepole: 'pipe_umbrella',
        invert: 'closed_invert_arch',
        label: `Heavy Class IV/V Support: ${
          squeezingRatio < 0.35 ? 'Yielding TH-29 Ribs' : 'ISMB 200 Steel Ribs'
        } @ 0.8m + Pipe Umbrella + Closed Invert + ${heavierBoltLen}m IBO Bolts + 220mm Sfr`,
      },
      {
        tier: 'full_natm_support',
        scMm: 260,
        mix: 'steel_fiber',
        ageH: 24,
        mesh: 'welded_8mm_150',
        bLen: heavierBoltLen,
        bSpc: 0.9,
        bCount: Math.max(12, Math.round(input.geometry.width / 0.75)),
        archType: 'th_yielding_rib',
        archProf: 'TH_36',
        archSpc: 0.75,
        foot: 'invert_strut_closed',
        forepole: 'pipe_umbrella',
        invert: 'closed_invert_arch',
        label: `Extreme Squeezing Class V Support: TH-36 Heavy Yielding Ribs @ 0.75m + Closed Invert + Ø114mm Pipe Umbrella + ${heavierBoltLen}m Anchors + 260mm Sfr`,
      },
    ];

    for (const c of candidates) {
      const testSup = evaluateSupportCapacity(
        c.tier,
        c.scMm,
        c.mix,
        c.ageH,
        c.mesh,
        squeezingRatio < 0.4 ? 'self_drilling_ibo' : 'sn_grouted_rebar',
        c.bLen,
        c.bSpc,
        180,
        c.bCount,
        c.archType,
        c.archProf,
        c.archSpc,
        c.foot,
        c.forepole,
        4.5,
        35,
        squeezingRatio < 0.35 ? 'face_fiberglass_bolts' : 'none',
        c.invert,
        squeezingRatio < 0.5,
        input.geometry.width,
        equivalentRadiusM,
        plasticThicknessUnsupM,
        squeezingRatio
      );
      const testInput = {
        ...input,
        supportTier: c.tier,
        shotcreteAgeHours: c.ageH,
        forepolingType: c.forepole,
        archFrameType: c.archType,
        invertSupport: c.invert,
      };
      const testState = evaluateScenarioFoSAndStandUp(
        testInput,
        qEffectiveBlastAdjusted,
        effectiveRmrForSafety,
        maxUnsupportedSpanDmaxM,
        squeezingRatio,
        crownSupportDemandKpa,
        equivalentRadiusM,
        meanStressMpa,
        sigmaCmMpa,
        kp,
        criticalSupportPressurePcrMpa,
        ermMpa,
        ccmUnsupported.rpRatio,
        testSup,
        targetPull,
        c.tier
      );
      const testWedgeFos = computeWedgeFos(testSup, c.bLen, testState.activeSpanM);
      const testBond = computeShotcreteBondFos(
        c.tier,
        c.ageH,
        c.mix,
        testSup.hasStructuralArch || testSup.isBolted,
        targetPull
      );
      if (passesAllGates(testState, testSup, testWedgeFos, testBond.bondFos)) {
        return {
          actionSummary: c.label,
          shotcreteMm: c.scMm,
          shotcreteMixLabel: 'Steel-Fiber Shotcrete (35-38 MPa)',
          waitCureHours: c.ageH,
          wiremeshRequired: c.mesh !== 'none',
          meshSpecLabel:
            c.mesh === 'welded_8mm_150'
              ? 'Welded Mesh Ø8mm @ 150×150mm'
              : c.mesh === 'welded_6mm_150'
              ? 'Welded Mesh Ø6mm @ 150×150mm'
              : 'None (Fiber Sfr Only)',
          boltsRequired: c.bCount > 0,
          boltLengthM: Number(c.bLen.toFixed(1)),
          boltSpacingM: c.bSpc,
          boltsPerRing: c.bCount,
          forepolingRequired: c.forepole !== 'none',
          latticeGirderRequired: c.archType !== 'none',
          recommendedArchLabel:
            c.archType !== 'none'
              ? `${ARCH_PROFILE_SPECS[c.archProf].label} @ ${c.archSpc}m`
              : 'None',
        };
      }
    }

    const heavy = candidates[candidates.length - 1];
    return {
      actionSummary: heavy.label,
      shotcreteMm: heavy.scMm,
      shotcreteMixLabel: 'High-Ductility Fiber Shotcrete (40 MPa)',
      waitCureHours: heavy.ageH,
      wiremeshRequired: true,
      meshSpecLabel: 'Double Layer Ø8mm Welded Mesh',
      boltsRequired: true,
      boltLengthM: Number(heavy.bLen.toFixed(1)),
      boltSpacingM: heavy.bSpc,
      boltsPerRing: heavy.bCount,
      forepolingRequired: true,
      latticeGirderRequired: true,
      recommendedArchLabel: `${ARCH_PROFILE_SPECS[heavy.archProf].label} @ ${heavy.archSpc}m`,
    };
  };

  const minimumSupportForRequiredPull = requiredNextPullFeasibleAsIs
    ? {
        actionSummary: 'Current installed support is sufficient for the requested next blast pull.',
        shotcreteMm: input.shotcreteThicknessMm,
        shotcreteMixLabel:
          input.supportTier === 'none' ? 'Not Required' : input.shotcreteMix.replace('_', ' '),
        waitCureHours: 0,
        wiremeshRequired: input.wiremeshSpec !== 'none',
        meshSpecLabel: input.wiremeshSpec,
        boltsRequired: supEval.isBolted,
        boltLengthM: input.boltLengthM,
        boltSpacingM: input.boltSpacingM,
        boltsPerRing: input.boltsPerRing,
        forepolingRequired: input.forepolingType !== 'none',
        latticeGirderRequired: supEval.hasStructuralArch,
        recommendedArchLabel: supEval.archLabel,
      }
    : buildMinimumPrescriptionForPull(input.requiredNextPullM);

  // 8. Stand-Up Curve Data (Bieniawski Log-Log Chart)
  const standUpCurvePoints: StandUpCurvePoint[] = [1.0, 2.0, 3.0, 4.5, 6.5, 9.0, 12.0].map(
    (sp) => {
      const uHrs = computeBieniawskiUnsupportedHours(
        effectiveRmrForSafety,
        sp,
        maxUnsupportedSpanDmaxM,
        squeezingRatio
      );
      const sHrs =
        supEval.totalCapacityKpa > 0
          ? computeBieniawskiUnsupportedHours(
              Math.min(95, effectiveRmrForSafety + supEval.rmrConfinementBoost),
              sp,
              maxUnsupportedSpanDmaxM * 1.55,
              squeezingRatio * 1.25
            )
          : uHrs;
      return {
        spanM: sp,
        unsupportedHours: uHrs,
        supportedHours: Number(sHrs.toFixed(2)),
      };
    }
  );

  // 9. Conditional Pull Matrix (0.8m to 4.0m — includes 0.8m short advance for weak Class V rock)
  const conditionalPullMatrix: ConditionalPullRow[] = [0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(
    (p) => {
      const rowState = evaluateScenarioFoSAndStandUp(
        input,
        qEffectiveBlastAdjusted,
        effectiveRmrForSafety,
        maxUnsupportedSpanDmaxM,
        squeezingRatio,
        crownSupportDemandKpa,
        equivalentRadiusM,
        meanStressMpa,
        sigmaCmMpa,
        kp,
        criticalSupportPressurePcrMpa,
        ermMpa,
        ccmUnsupported.rpRatio,
        supEval,
        p
      );
      const rowBond = computeShotcreteBondFos(
        input.supportTier,
        input.shotcreteAgeHours,
        input.shotcreteMix,
        supEval.hasStructuralArch || supEval.isBolted,
        p
      );
      const rowWedgeFos = computeWedgeFos(supEval, input.boltLengthM, rowState.activeSpanM);
      const rowFeasible = passesAllGates(
        rowState,
        supEval,
        rowWedgeFos,
        rowBond.bondFos
      );
      const rx = rowFeasible ? null : buildMinimumPrescriptionForPull(p);
      const prohibited =
        ((qEffectiveBlastAdjusted < 0.08 && p >= 1.5) ||
          (qEffectiveBlastAdjusted < 0.25 && p >= 2.5)) &&
        !supEval.isBolted &&
        !supEval.hasStructuralArch;
      return {
        pullM: p,
        combinedExposedM: rowState.combinedExposedM,
        activeSpanM: rowState.activeSpanM,
        fos: rowState.fos,
        unsupportedStandUpHrs: rowState.unsupportedHrs,
        supportedStandUpHrs: rowState.supportedHrs,
        feasibleAsIs: rowFeasible,
        statusLabel: rowFeasible
          ? 'SAFE AS-IS'
          : prohibited
          ? 'PROHIBITED'
          : 'NEEDS UPGRADE',
        requiredUpgradeText: rowFeasible
          ? 'Proceed with current support'
          : rx?.actionSummary || 'Mandatory full support before blast',
      };
    }
  );

  // 10. Verdict Classification
  let verdict: BlastReadinessVerdict;
  let verdictTitle: string;
  let verdictSubtitle: string;

  const isWeakGround = effectiveRmrForSafety <= 40 || qEffectiveBlastAdjusted < 0.5;
  const fullClearThresholdFos = isWeakGround ? 1.35 : 1.3;

  if (
    requiredNextPullFeasibleAsIs &&
    postBlastState.fos >= fullClearThresholdFos &&
    wedgeGravityFos >= 1.3
  ) {
    verdict = 'ALLOWED';
    verdictTitle = 'NEXT BLAST ALLOWED';
    verdictSubtitle = `Requested ${input.requiredNextPullM.toFixed(
      2
    )}m blast round passes equilibrium, wedge, PPV bond, and stand-up gates (Post-Blast FoS ${postBlastState.fos.toFixed(
      2
    )}, Stand-Up ${postBlastState.supportedHrs.toFixed(1)} hrs).`;
  } else if (requiredNextPullFeasibleAsIs && postBlastState.fos >= 1.25) {
    verdict = 'ALLOWED_WITH_MIN_SUPPORT';
    verdictTitle = 'ALLOWED WITH CAUTION / MONITORING';
    verdictSubtitle = `Requested ${input.requiredNextPullM.toFixed(
      2
    )}m pull meets minimum gates (FoS ${postBlastState.fos.toFixed(
      2
    )}, Wedge FoS ${wedgeGravityFos.toFixed(2)}). Complete permanent bolting/arch within ${Math.max(
      2,
      Math.floor(postBlastState.supportedHrs * 0.65)
    )} hrs after blast.`;
  } else if (
    maxSafeNextPullM >= 0.8 &&
    !supEval.isBolted &&
    !supEval.hasStructuralArch &&
    qEffectiveBlastAdjusted >= 0.25
  ) {
    verdict = 'ALLOWED_REDUCED_PULL';
    verdictTitle = `ALLOWED ONLY AT REDUCED PULL (MAX ${maxSafeNextPullM.toFixed(2)}m) OR INSTALL UPGRADE`;
    verdictSubtitle = `Requested ${input.requiredNextPullM.toFixed(
      2
    )}m pull exceeds safe unbolted limit (FoS ${postBlastState.fos.toFixed(
      2
    )}, Bond FoS ${shotcreteBlastBondFos.toFixed(2)}). Restrict next blast to <= ${maxSafeNextPullM.toFixed(
      2
    )}m OR apply: ${minimumSupportForRequiredPull.actionSummary}.`;
  } else if (maxSafeNextPullM >= 0.8) {
    verdict = 'ALLOWED_REDUCED_PULL';
    verdictTitle = `REDUCE PULL TO <= ${maxSafeNextPullM.toFixed(2)}m OR ADD MINIMUM SUPPORT`;
    verdictSubtitle = `Full ${input.requiredNextPullM.toFixed(
      2
    )}m round fails weak-rock stability/PPV gates (FoS ${postBlastState.fos.toFixed(
      2
    )}, Wedge ${wedgeGravityFos.toFixed(2)}). Reduce round to <= ${maxSafeNextPullM.toFixed(
      2
    )}m or install upgrade before drilling.`;
  } else {
    verdict = 'STRICTLY_NOT_ALLOWED';
    verdictTitle = 'STRICTLY NOT ALLOWED — SUPPORT MANDATORY BEFORE NEXT BLAST';
    verdictSubtitle = `Even a short 0.5–0.8m advance fails Class IV/V stability gates (Post-Blast FoS ${postBlastState.fos.toFixed(
      2
    )}, Wedge FoS ${wedgeGravityFos.toFixed(2)}, Strain ${postBlastTunnelStrainPct}%). Mandatory action: ${
      minimumSupportForRequiredPull.actionSummary
    }.`;
  }

  let governingFailureMode = 'Stable Elastic Crown Arch';
  if (squeezingRatio < 0.45 || postBlastTunnelStrainPct >= 2.5) {
    governingFailureMode = 'Deep Plastic Crown Squeezing & High Stress Yield (CCM)';
  } else if (
    supEval.isBolted &&
    supEval.boltAnchorStatus === 'floating_in_plastic' &&
    postBlastState.fos < 1.3
  ) {
    governingFailureMode = 'Insufficient Bolt Embedment (Anchors Floating Inside Plastic Zone)';
  } else if (wedgeGravityFos < 1.25) {
    governingFailureMode = 'Crown Gravity Wedge Drop Along Discontinuity Plane';
  } else if (
    input.supportTier !== 'none' &&
    shotcreteBlastBondFos < 1.15 &&
    !supEval.isBolted &&
    !supEval.hasStructuralArch
  ) {
    governingFailureMode = 'Blast Vibration PPV Peeling of Early-Age Unbolted Shotcrete';
  } else if (
    !supEval.isBolted &&
    !supEval.hasStructuralArch &&
    input.supportTier !== 'none' &&
    postBlastState.combinedExposedM > input.geometry.width * 0.95
  ) {
    governingFailureMode = 'Unbolted Shotcrete Shell Delamination / Shear Punching';
  } else if (postBlastState.activeSpanM > maxUnsupportedSpanDmaxM) {
    governingFailureMode = 'Exceeds Barton Critical Self-Supporting Span (Crown Ravelling)';
  }

  // 11. 6-Point Engineering Safety Audit Matrix
  const safetyChecks: BlastSafetyCheckRow[] = [
    {
      checkName: 'Post-Blast Crown Equilibrium (CCM/NGI)',
      computedValue: `FoS = ${postBlastState.fos.toFixed(2)} (${supEval.totalCapacityKpa} vs ${postBlastState.demandKpa} kPa)`,
      acceptanceCriterion: `FoS >= 1.25 (Clear >= ${fullClearThresholdFos.toFixed(2)})`,
      marginText: `${postBlastState.fos >= 1.25 ? '+' : ''}${(postBlastState.fos - 1.25).toFixed(2)}`,
      status:
        postBlastState.fos >= fullClearThresholdFos
          ? 'PASS'
          : postBlastState.fos >= 1.15
          ? 'CAUTION'
          : 'FAIL',
    },
    {
      checkName: 'Gravity Crown Wedge Dead-Load',
      computedValue: `FoS = ${wedgeGravityFos.toFixed(2)} (${input.wedgeHeightM.toFixed(1)}m wedge)`,
      acceptanceCriterion: 'Wedge FoS >= 1.25',
      marginText: `${wedgeGravityFos >= 1.25 ? '+' : ''}${(wedgeGravityFos - 1.25).toFixed(2)}`,
      status: wedgeGravityFos >= 1.3 ? 'PASS' : wedgeGravityFos >= 1.1 ? 'CAUTION' : 'FAIL',
    },
    {
      checkName: 'Barton Critical Span vs Active Span',
      computedValue: `Span ${postBlastState.activeSpanM.toFixed(2)}m vs D_max ${maxUnsupportedSpanDmaxM}m`,
      acceptanceCriterion:
        supEval.isBolted || supEval.hasStructuralArch ? 'Pinned/Arch Supported' : 'Active Span <= D_max',
      marginText:
        supEval.isBolted || supEval.hasStructuralArch
          ? 'Arch / Bolt Pinned'
          : `${(maxUnsupportedSpanDmaxM - postBlastState.activeSpanM).toFixed(2)}m`,
      status:
        supEval.isBolted || supEval.hasStructuralArch || postBlastState.activeSpanM <= maxUnsupportedSpanDmaxM
          ? 'PASS'
          : postBlastState.activeSpanM <= maxUnsupportedSpanDmaxM * 1.2
          ? 'CAUTION'
          : 'FAIL',
    },
    {
      checkName: 'Bieniawski Stand-Up Time vs Delay',
      computedValue: `${formatHoursHuman(postBlastState.supportedHrs)} vs ${input.delayHoursBeforeFullSupport}h delay`,
      acceptanceCriterion: `>= ${(input.delayHoursBeforeFullSupport * 1.4).toFixed(1)} hrs (1.4× delay)`,
      marginText: `${(postBlastState.supportedHrs - input.delayHoursBeforeFullSupport).toFixed(1)} hrs`,
      status:
        postBlastState.supportedHrs >= input.delayHoursBeforeFullSupport * 1.5
          ? 'PASS'
          : postBlastState.supportedHrs >= input.delayHoursBeforeFullSupport
          ? 'CAUTION'
          : 'FAIL',
    },
    {
      checkName: 'Blast PPV Early Shotcrete Bond Integrity',
      computedValue:
        input.supportTier === 'none'
          ? 'N/A (Bare Rock)'
          : `Bond FoS ${shotcreteBlastBondFos.toFixed(2)} (PPV ~${blastDynamicPpvMmSec} mm/s)`,
      acceptanceCriterion: 'Bond FoS >= 1.15',
      marginText:
        input.supportTier === 'none'
          ? 'No Lining'
          : `${(shotcreteBlastBondFos - 1.15).toFixed(2)}`,
      status:
        input.supportTier === 'none' ||
        shotcreteBlastBondFos >= 1.2 ||
        supEval.isBolted ||
        supEval.hasStructuralArch
          ? 'PASS'
          : shotcreteBlastBondFos >= 0.95
          ? 'CAUTION'
          : 'FAIL',
    },
    {
      checkName: 'Duncan-Fama / Vlachopoulos LDP Strain',
      computedValue: `${postBlastTunnelStrainPct.toFixed(2)}% (${unsupportedRadialDispMm}mm disp.)`,
      acceptanceCriterion: 'Strain < 1.0% Elastic / < 2.5% Low Squeeze',
      marginText: strainSeverityClass.split('·')[0].trim(),
      status:
        postBlastTunnelStrainPct < 1.0
          ? 'PASS'
          : postBlastTunnelStrainPct < 2.5
          ? 'CAUTION'
          : 'FAIL',
    },
  ];

  const remainingSafeWindowHrs = Number(
    Math.max(0, postBlastState.supportedHrs - input.delayHoursBeforeFullSupport).toFixed(1)
  );

  // 12. Step-by-Step Formal Engineering Equations & Substituted Trace
  const calculationSteps: BlastCalculationStep[] = [
    {
      stepNumber: 1,
      title: 'Tunnel Geometry, Equivalent Radius & In-Situ Stress',
      methodStandard: 'Polygon Integration & Lithostatic Cover Stress',
      formula: 'R_eq = √(A_t / π) ;  P₀ = (γ · H) / 1000 ;  P_h = K₀ · P₀',
      substituted: `A_t = ${tunnelAreaM2} m² → R_eq = √(${tunnelAreaM2}/π) = ${equivalentRadiusM} m ;  P₀ = (${input.unitWeightKnM3} × ${input.overburdenM})/1000 = ${inSituVerticalStressMpa} MPa ;  P_h = ${input.k0Ratio} × ${inSituVerticalStressMpa} = ${inSituHorizontalStressMpa} MPa`,
      resultValue: `R_eq = ${equivalentRadiusM} m | P₀ = ${inSituVerticalStressMpa} MPa`,
      interpretation: `Design span B=${input.geometry.width.toFixed(2)}m, height H=${input.geometry.height.toFixed(2)}m.`,
    },
    {
      stepNumber: 2,
      title: 'Barton Q-Index, Blast Factor Q* & Critical Span D_max',
      methodStandard: 'Barton, Lien & Lunde (1974) / NGI (2015)',
      formula:
        input.qInputMode === 'detailed' && input.jn < 9
          ? 'Q = (RQD/J_n)·(J_r/J_a)·(J_w/SRF) ;  D_max = 2·ESR·(Q*)^0.4 ;  P_roof = (200√J_n / 3J_r)·(Q*)^(-1/3)'
          : 'Q = (RQD/J_n)·(J_r/J_a)·(J_w/SRF) ;  D_max = 2·ESR·(Q*)^0.4 ;  P_roof = (200/J_r)·(Q*)^(-1/3)',
      substituted: `Q = (${input.rqdPct}/${input.jn})·(${input.jr}/${input.ja})·(${input.jw}/${input.srf}) = ${qIndex} ;  Q* = ${qEffectiveBlastAdjusted} ;  D_max = 2 × ${input.esr.toFixed(2)} × (${qEffectiveBlastAdjusted})^0.4 = ${maxUnsupportedSpanDmaxM} m ;  P_NGI = ${ngiRoofDemandKpa.toFixed(1)} kPa`,
      resultValue: `Q = ${qIndex} | D_max = ${maxUnsupportedSpanDmaxM} m`,
      interpretation:
        postBlastState.activeSpanM > maxUnsupportedSpanDmaxM
          ? `Post-blast active span (${postBlastState.activeSpanM}m) exceeds Barton unsupported limit D_max (${maxUnsupportedSpanDmaxM}m).`
          : `Post-blast active span (${postBlastState.activeSpanM}m) remains within Barton D_max (${maxUnsupportedSpanDmaxM}m).`,
    },
    {
      stepNumber: 3,
      title: 'Bieniawski RMR89 & Weak-Rock GSI Validation',
      methodStandard: `Bieniawski (1989) & ${gsiMethodUsed}`,
      formula: 'RMR89 = R_UCS + R_RQD + R_sp + R_cond + R_w + Adj_orient ;  RMR_Q = 9·ln(Q) + 44',
      substituted: `RMR89 = ${ucsRating} + ${rqdRating} + ${input.rmrSpacingRating} + ${input.rmrCondRating} + ${input.rmrWaterRating} + (${input.rmrOrientAdj}) = ${rmr89} ;  RMR_Q = ${rmrCrossCheckFromQ} ;  GSI = ${gsi} (${gsiMethodUsed})`,
      resultValue: `RMR89 = ${rmr89} (${rockClassLabel}) | GSI = ${gsi}`,
      interpretation:
        rmrDiscrepancyWarning ||
        'RMR89, Barton Q-correlation, and weak-rock GSI safeguard are consistent.',
    },
    {
      stepNumber: 4,
      title: 'Hoek-Brown (2002), Analytical Duncan-Fama CCM & Vlachopoulos LDP',
      methodStandard: 'Hoek et al. (2002) + Duncan-Fama (1993) + Vlachopoulos-Diederichs (2009)',
      formula:
        'P_cr = (2P₀ - σ_cm)/(1+k_p) ;  R_p(P_i) = R_eq·[2(P₀(k_p-1)+σ_cm) / ((1+k_p)((k_p-1)P_i+σ_cm))]^(1/(k_p-1))',
      substituted: `σ_cm = ${sigmaCmMpa} MPa, E_rm = ${ermGpa} GPa, c'=${cohesionMpa} MPa, φ'=${frictionAngleDeg}° ;  P_cr = ${criticalSupportPressurePcrMpa} MPa ;  R_p(0)=${ccmUnsupported.rpM.toFixed(
        2
      )}m → R_p(P_i=${(supEval.totalCapacityKpa / 1000).toFixed(
        2
      )} MPa)=${plasticRadiusM}m ;  u_r = ${unsupportedRadialDispMm}mm (${postBlastTunnelStrainPct}%)`,
      resultValue: `σ_cm = ${sigmaCmMpa} MPa | R_p = ${plasticRadiusM}m | ε_t = ${postBlastTunnelStrainPct}%`,
      interpretation: `${squeezingClass} · ${strainSeverityClass}.`,
    },
    {
      stepNumber: 5,
      title: 'Early-Age Shotcrete, Bolt Anchorage & Multi-Component Capacity',
      methodStandard: 'Widmann / CEB-FIP Shotcrete + Plastic-Zone Anchor Check + Curved Arch',
      formula: 'f_cu(t) = f_28·exp[s(1 - √(28/t_d))] ;  P_total = P_sc(mesh) + P_bolt(η_anch) + P_arch + P_fp + P_aux',
      substituted: `f_cu(${input.shotcreteAgeHours}h) = ${supEval.earlyAgeShotcreteMpa} MPa ;  P_sc = ${supEval.shotcreteCapacityKpa} kPa, P_bolt = ${supEval.boltCapacityKpa} kPa (η_anch=${supEval.boltAnchorEfficiency}), P_arch(${supEval.archLabel}) = ${supEval.girderCapacityKpa} kPa, P_fp+aux = ${(supEval.forepolingCapacityKpa + supEval.faceInvertCapacityKpa).toFixed(1)} kPa`,
      resultValue: `P_cap = ${supEval.totalCapacityKpa} kPa vs Demand = ${postBlastState.demandKpa} kPa`,
      interpretation: `Post-Blast Equilibrium FoS = ${postBlastState.fos.toFixed(
        2
      )} | Crown Wedge Gravity FoS = ${wedgeGravityFos.toFixed(2)}.`,
    },
    {
      stepNumber: 6,
      title: 'Blast Vibration Shock Check & Dual Stand-Up Time Evaluation',
      methodStandard: 'Bieniawski (1989) Regression & USBM Dynamic Peel Bond',
      formula: 'log₁₀(t_unsup) = 0.115·RMR - 1.75·log₁₀(S_eff) - 2.65 ;  PPV = 750·(D/√W)^(-1.45)',
      substituted: `Post-Blast S_eff = ${postBlastState.activeSpanM}m ;  t_unsup = ${formatHoursHuman(
        postBlastState.unsupportedHrs
      )} vs t_sup = ${formatHoursHuman(
        postBlastState.supportedHrs
      )} ;  Est. PPV = ${blastDynamicPpvMmSec} mm/s (Bond FoS = ${shotcreteBlastBondFos})`,
      resultValue: `No Supp: ${formatHoursHuman(
        postBlastState.unsupportedHrs
      )} | Installed: ${formatHoursHuman(postBlastState.supportedHrs)}`,
      interpretation: `Net safe window above ${input.delayHoursBeforeFullSupport}h bolting delay = ${remainingSafeWindowHrs} hrs.`,
    },
  ];

  // Engineering Warnings
  const engineeringWarnings: string[] = [];
  if (rmrDiscrepancyWarning) engineeringWarnings.push(rmrDiscrepancyWarning);
  if (supEval.isBolted && supEval.boltAnchorStatus === 'floating_in_plastic') {
    engineeringWarnings.push(
      `WEAK-ROCK ANCHORAGE WARNING: ${input.boltLengthM.toFixed(
        1
      )}m bolts are shorter than the active plastic zone thickness (${effectivePlasticDepthForBoltsM.toFixed(
        1
      )}m) — bolts are floating inside yielded rock (η_anch=${supEval.boltAnchorEfficiency}). Increase bolt length to >= ${(
        effectivePlasticDepthForBoltsM + 1.0
      ).toFixed(1)}m or add Steel Ribs / LG + Forepoling.`
    );
  }
  if (
    supEval.hasStructuralArch &&
    squeezingRatio < 0.45 &&
    input.archFootSupport === 'standard_baseplate'
  ) {
    engineeringWarnings.push(
      `SOFT-FOOT BEARING RISK: Standard baseplate used on LG/Steel Rib in squeezing Class IV/V ground (σ_cm/P₀=${squeezingRatio}). Use enlarged elephant feet or closed invert strut to prevent arch foot punching.`
    );
  }
  if (input.supportTier !== 'none' && shotcreteBlastBondFos < 1.15) {
    engineeringWarnings.push(
      `Early-age shotcrete at ${input.shotcreteAgeHours.toFixed(
        1
      )} hrs (${supEval.earlyAgeShotcreteMpa} MPa) is vulnerable to blast PPV ~${blastDynamicPpvMmSec} mm/s (Bond FoS ${shotcreteBlastBondFos}) — allow more curing time or bolt/rib before blasting.`
    );
  }
  if (!supEval.isBolted && !supEval.hasStructuralArch && wedgeGravityFos < 1.25) {
    engineeringWarnings.push(
      `No rock bolts or LG/Steel Rib installed with ${input.wedgeHeightM.toFixed(
        1
      )}m crown wedge height (Wedge FoS ${wedgeGravityFos.toFixed(
        2
      )}) — shotcrete + mesh alone cannot anchor deep gravity wedges.`
    );
  }
  if (postBlastState.combinedExposedM > input.geometry.width) {
    engineeringWarnings.push(
      `Unbolted axial span after blast (${postBlastState.combinedExposedM.toFixed(
        1
      )}m) exceeds tunnel width (${input.geometry.width.toFixed(
        1
      )}m), sacrificing 3D face core confinement.`
    );
  }
  if (squeezingRatio < 0.45) {
    engineeringWarnings.push(
      `Hoek-Brown squeezing ratio σ_cm/P₀ = ${squeezingRatio} (LDP Tunnel Strain ${postBlastTunnelStrainPct}%, Plastic Zone R_p=${plasticRadiusM}m) indicates active squeezing — install heavy LG/TH-ribs, forepoling, and close invert promptly.`
    );
  }
  if (input.invertSupport === 'none' && postBlastTunnelStrainPct >= 2.0) {
    engineeringWarnings.push(
      `Open invert without strut in ${postBlastTunnelStrainPct}% strain ground risks footplate settlement and lining buckling.`
    );
  }
  if (input.qInputMode === 'detailed') {
    const srfFromOverburden = estimateBartonSrfFromStress(
      input.ucsMpa,
      inSituVerticalStressMpa,
      input.k0Ratio,
      sigmaCmMpa
    );
    if (srfFromOverburden.srf >= 7.5 && input.srf <= 2.5) {
      engineeringWarnings.push(
        `OVERBURDEN vs SRF MISMATCH: At cover H=${input.overburdenM}m (P₀=${inSituVerticalStressMpa} MPa, ${srfFromOverburden.regimeLabel}), Barton stress-based SRF ≈ ${srfFromOverburden.srf}, which is higher than entered SRF=${input.srf}. Click "Auto SRF" in Tab 2 to update Q.`
      );
    }
  }

  return {
    computedAt: new Date().toISOString(),
    tunnelAreaM2,
    equivalentRadiusM,
    inSituVerticalStressMpa,
    inSituHorizontalStressMpa,
    qIndex,
    qEffectiveBlastAdjusted,
    qNormalizedQc,
    rmr89,
    rmrCrossCheckFromQ,
    rmrDiscrepancyWarning,
    gsi,
    rockClassLabel,
    rmrBreakdown: {
      ucsRating,
      rqdRating,
      spacingRating: input.rmrSpacingRating,
      conditionRating: input.rmrCondRating,
      groundwaterRating: input.rmrWaterRating,
      orientationAdj: input.rmrOrientAdj,
    },
    mb,
    s,
    a,
    cohesionMpa,
    frictionAngleDeg,
    sigmaCmMpa,
    ermGpa,
    squeezingRatio,
    squeezingClass,
    criticalSupportPressurePcrMpa,
    plasticRadiusM,
    plasticThicknessM,
    unsupportedRadialDispMm,
    postBlastTunnelStrainPct,
    strainSeverityClass,
    crownSupportDemandKpa,
    postBlastSupportDemandKpa: postBlastState.demandKpa,
    maxUnsupportedSpanDmaxM,
    currentActiveSpanM: currentState.activeSpanM,
    postBlastActiveSpanM: postBlastState.activeSpanM,
    postBlastTotalExposedM: postBlastState.combinedExposedM,
    bartonRecommendedBoltSpacingM,
    bartonRecommendedShotcreteMm,
    earlyAgeShotcreteMpa: supEval.earlyAgeShotcreteMpa,
    earlyAgeShotcreteBondMpa,
    blastDynamicPpvMmSec,
    blastDynamicPeelStressMpa,
    shotcreteBlastBondFos,
    installedShotcreteCapacityKpa: supEval.shotcreteCapacityKpa,
    installedMeshFactor: supEval.meshFactor,
    installedBoltCapacityKpa: supEval.boltCapacityKpa,
    installedGirderCapacityKpa: supEval.girderCapacityKpa,
    installedArchLabel: supEval.archLabel,
    installedForepolingCapacityKpa: supEval.forepolingCapacityKpa,
    installedFaceInvertCapacityKpa: supEval.faceInvertCapacityKpa,
    totalInstalledCapacityKpa: supEval.totalCapacityKpa,
    wedgeGravityDemandKpa,
    wedgeGravityFos,
    currentFos: currentState.fos,
    postBlastFos: postBlastState.fos,
    unsupportedStandUpCurrentHrs: currentState.unsupportedHrs,
    unsupportedStandUpPostBlastHrs: postBlastState.unsupportedHrs,
    supportedStandUpCurrentHrs: currentState.supportedHrs,
    supportedStandUpPostBlastHrs: postBlastState.supportedHrs,
    remainingSafeWindowHrs,
    standUpCurvePoints,
    verdict,
    verdictTitle,
    verdictSubtitle,
    governingFailureMode,
    maxSafeNextPullM,
    requiredNextPullFeasibleAsIs,
    minimumSupportForRequiredPull,
    conditionalPullMatrix,
    safetyChecks,
    calculationSteps,
    engineeringWarnings,
  };
}

// ============================================================================
// STANDALONE HISTORY VAULT (LOCAL STORAGE — ISOLATED FROM NATM FLOW)
// ============================================================================
export function loadBlastCalcHistory(): BlastCalcHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BlastCalcHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveBlastCalcSnapshot(
  input: BlastCalcInput,
  result: BlastCalcResult
): BlastCalcHistoryRecord[] {
  const existing = loadBlastCalcHistory();
  const record: BlastCalcHistoryRecord = {
    id: `blast-calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    input: JSON.parse(JSON.stringify(input)),
    result: JSON.parse(JSON.stringify(result)),
  };
  const next = [record, ...existing].slice(0, 60);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
  return next;
}

export function deleteBlastCalcSnapshot(id: string): BlastCalcHistoryRecord[] {
  const existing = loadBlastCalcHistory();
  const next = existing.filter((r) => r.id !== id);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function clearBlastCalcHistory(): BlastCalcHistoryRecord[] {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
  return [];
}

// ============================================================================
// REPORT EXPORTS: DETAILED WORD (.DOC) & 2-PAGE BINARY A4 PDF CERTIFICATE
// ============================================================================
function formatHoursHuman(hrs: number): string {
  if (hrs >= 720) return `${(hrs / 24).toFixed(0)}+ days (Long-term stable)`;
  if (hrs >= 48) return `${hrs.toFixed(1)} hrs (${(hrs / 24).toFixed(1)} days)`;
  if (hrs >= 1) return `${hrs.toFixed(1)} hrs`;
  return `${Math.round(hrs * 60)} min`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function exportBlastReadinessWordDoc(
  rawInput: BlastCalcInput,
  result: BlastCalcResult
): void {
  const input = normalizeInputDefaults(rawInput);
  const safeName = (input.chainageLabel || input.scenarioLabel || 'Heading')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const verdictBg =
    result.verdict === 'ALLOWED'
      ? '#DCFCE7'
      : result.verdict === 'STRICTLY_NOT_ALLOWED'
      ? '#FEE2E2'
      : '#FEF3C7';
  const verdictFg =
    result.verdict === 'ALLOWED'
      ? '#166534'
      : result.verdict === 'STRICTLY_NOT_ALLOWED'
      ? '#991B1B'
      : '#92400E';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Next-Blast Clearance, Stand-Up Time & Calculation Report</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #0F172A; font-size: 10pt; margin: 24px; line-height: 1.35; }
  h1 { font-size: 14.5pt; margin: 0 0 4px 0; color: #0F172A; border-bottom: 2px solid #0284C7; padding-bottom: 6px; }
  h2 { font-size: 11pt; margin: 14px 0 6px 0; color: #0369A1; background: #F1F5F9; padding: 4px 8px; border-left: 3px solid #0284C7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
  th, td { border: 1px solid #CBD5E1; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #E2E8F0; font-weight: bold; }
  .verdict { background: ${verdictBg}; color: ${verdictFg}; border: 2px solid ${verdictFg}; padding: 10px 12px; margin: 10px 0; }
  .verdict-title { font-size: 12.5pt; font-weight: bold; margin: 0 0 4px 0; }
  .muted { color: #475569; font-size: 9pt; }
  .mono { font-family: Consolas, monospace; font-size: 8.5pt; }
</style>
</head>
<body>
  <h1>NEXT-BLAST CLEARANCE, STAND-UP TIME &amp; GEOTECHNICAL CALCULATION REPORT</h1>
  <p class="muted">Heading / Scenario: <b>${input.scenarioLabel}</b> | Chainage: <b>${input.chainageLabel}</b> | Engineering Geologist: <b>${input.geologistName}</b> | Report Date: ${new Date(result.computedAt).toLocaleString()}</p>

  <div class="verdict">
    <div class="verdict-title">${result.verdictTitle}</div>
    <div>${result.verdictSubtitle}</div>
    <div style="margin-top:4px;font-size:9.5pt;"><b>Governing Mechanism:</b> ${result.governingFailureMode} &nbsp;|&nbsp; <b>Max Safe Next Pull As-Is:</b> ${result.maxSafeNextPullM.toFixed(2)} m</div>
  </div>

  <h2>1. Tunnel Profile Geometry, Stress Regime &amp; Excavation Progress</h2>
  <table>
    <tr><th>Profile Shape</th><td>${input.geometry.profileName || input.geometry.crownGeometry.toUpperCase()}</td><th>Span × Height / Area</th><td>${input.geometry.width.toFixed(2)}m × ${input.geometry.height.toFixed(2)}m (Area ${result.tunnelAreaM2} m², R_eq=${result.equivalentRadiusM}m)</td></tr>
    <tr><th>Overburden Depth / γ</th><td>${input.overburdenM} m @ ${input.unitWeightKnM3} kN/m³</td><th>In-Situ Stresses P₀ / P_h</th><td>P₀ = ${result.inSituVerticalStressMpa} MPa | P_h = ${result.inSituHorizontalStressMpa} MPa (K₀=${input.k0Ratio})</td></tr>
    <tr><th>Current Pull / Unbolted Span</th><td>${input.currentPullM.toFixed(2)} m pull / ${input.exposedLengthM.toFixed(2)} m exposed</td><th>Target Next Pull &amp; Delay</th><td>${input.requiredNextPullM.toFixed(2)} m (Post-Blast Exposed: ${result.postBlastTotalExposedM.toFixed(2)} m | Delay ${input.delayHoursBeforeFullSupport}h)</td></tr>
  </table>

  <h2>2. Combined Geotechnical Mass Characterization (RMR89 + Barton Q-ESR + Hoek-Brown CCM)</h2>
  <table>
    <tr><th>Barton Q / Blast-Adj Q*</th><td>Q = ${result.qIndex} | Q* = ${result.qEffectiveBlastAdjusted} (D_max = ${result.maxUnsupportedSpanDmaxM} m)</td><th>Bieniawski RMR89 &amp; Class</th><td>${result.rmr89} (${result.rockClassLabel}) | Q-Corr=${result.rmrCrossCheckFromQ}</td></tr>
    <tr><th>Intact RQD / UCS / m_i</th><td>RQD ${input.rqdPct}% | UCS ${input.ucsMpa} MPa | m_i=${input.mi}</td><th>Hoek-Brown GSI / D</th><td>GSI ${result.gsi} | Blast Disturbance D=${input.blastDisturbanceD} (c'=${result.cohesionMpa} MPa, φ'=${result.frictionAngleDeg}°)</td></tr>
    <tr><th>Mass Strength σ_cm / E_rm</th><td>${result.sigmaCmMpa} MPa / ${result.ermGpa} GPa (P_cr=${result.criticalSupportPressurePcrMpa} MPa)</td><th>Plastic Zone &amp; LDP Strain</th><td>R_p=${result.plasticRadiusM} m | Radial u_r=${result.unsupportedRadialDispMm}mm (${result.postBlastTunnelStrainPct}% — ${result.squeezingClass})</td></tr>
  </table>

  <h2>3. Installed Support System Breakdown (Shotcrete, Mesh, Bolts, LG/Steel Rib &amp; Auxiliary)</h2>
  <table>
    <tr><th>Support Tier</th><td>${input.supportTier.replace(/_/g, ' ').toUpperCase()}</td><th>Early-Age Shotcrete</th><td>${input.shotcreteThicknessMm} mm (${input.shotcreteMix}) @ ${input.shotcreteAgeHours}h = ${result.earlyAgeShotcreteMpa} MPa → <b>${result.installedShotcreteCapacityKpa} kPa</b></td></tr>
    <tr><th>Wiremesh</th><td>${input.wiremeshSpec} (Mult ×${result.installedMeshFactor})</td><th>Rock Bolts</th><td>${input.boltsPerRing} × ${input.boltLengthM}m @ ${input.boltSpacingM}m (${input.boltType.replace(/_/g, ' ')}) → <b>${result.installedBoltCapacityKpa} kPa</b></td></tr>
    <tr><th>LG / Steel Rib Arch</th><td>${result.installedArchLabel} (Foot: ${input.archFootSupport.replace(/_/g, ' ')}) → <b>${result.installedGirderCapacityKpa} kPa</b></td><th>Forepoling &amp; Face/Invert</th><td>Forepole: ${input.forepolingType} (<b>${result.installedForepolingCapacityKpa} kPa</b>) | Invert/Face: ${input.invertSupport}/${input.faceSupportType} (<b>${result.installedFaceInvertCapacityKpa} kPa</b>)</td></tr>
    <tr><th>Total Support Capacity</th><td><b>${result.totalInstalledCapacityKpa} kPa</b> vs Post-Blast Demand <b>${result.postBlastSupportDemandKpa} kPa</b></td><th>Dual Stand-Up Time</th><td><b>NO Support:</b> ${formatHoursHuman(result.unsupportedStandUpPostBlastHrs)} | <b>WITH Support:</b> ${formatHoursHuman(result.supportedStandUpPostBlastHrs)}</td></tr>
  </table>

  <h2>4. Six-Point Engineering Safety Audit Matrix</h2>
  <table>
    <tr><th>Verification Check</th><th>Calculated Result</th><th>Acceptance Criterion</th><th>Margin</th><th>Status</th></tr>
    ${result.safetyChecks
      .map(
        (c) =>
          `<tr><td>${c.checkName}</td><td class="mono">${c.computedValue}</td><td>${c.acceptanceCriterion}</td><td class="mono">${c.marginText}</td><td><b>${c.status}</b></td></tr>`
      )
      .join('')}
  </table>

  <h2>5. Step-by-Step Geotechnical Formulas &amp; Substituted Calculations</h2>
  <table>
    <tr><th>Step</th><th>Method &amp; Standard</th><th>Governing Equation &amp; Substituted Computation</th><th>Calculated Output</th></tr>
    ${result.calculationSteps
      .map(
        (st) =>
          `<tr><td><b>#${st.stepNumber}</b><br/>${st.title}</td><td>${st.methodStandard}</td><td class="mono"><b>Eq:</b> ${st.formula}<br/><b>Calc:</b> ${st.substituted}</td><td class="mono"><b>${st.resultValue}</b><br/>${st.interpretation}</td></tr>`
      )
      .join('')}
  </table>

  <h2>6. Conditional Next-Blast Pull &amp; Minimum Support Schedule</h2>
  <p><b>Prescription for ${input.requiredNextPullM.toFixed(2)}m Target Pull:</b> ${result.minimumSupportForRequiredPull.actionSummary}</p>
  <table>
    <tr><th>Pull</th><th>Exposed</th><th>FoS</th><th>Stand-Up (No Supp / Installed)</th><th>Status</th><th>Minimum Required Action</th></tr>
    ${result.conditionalPullMatrix
      .map(
        (r) =>
          `<tr><td>${r.pullM.toFixed(1)}m</td><td>${r.combinedExposedM.toFixed(1)}m</td><td>${r.fos.toFixed(2)}</td><td>${formatHoursHuman(r.unsupportedStandUpHrs)} / ${formatHoursHuman(r.supportedStandUpHrs)}</td><td><b>${r.statusLabel}</b></td><td>${r.requiredUpgradeText}</td></tr>`
      )
      .join('')}
  </table>

  ${
    result.engineeringWarnings.length > 0
      ? `<h2>7. Critical Geotechnical Advisories</h2><ul>${result.engineeringWarnings
          .map((w) => `<li>${w}</li>`)
          .join('')}</ul>`
      : ''
  }

  <table style="margin-top:16px;">
    <tr><th style="width:33%;">Shift Engineering Geologist</th><th style="width:33%;">Tunnel / Shift In-Charge</th><th style="width:34%;">Blast Authorization Decision</th></tr>
    <tr><td style="height:40px;vertical-align:bottom;">${input.geologistName} / Sign: __________</td><td style="vertical-align:bottom;">Name / Sign: __________</td><td style="vertical-align:bottom;">[ ] CLEARED &nbsp; [ ] HOLD FOR SUPPORT</td></tr>
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  triggerDownload(blob, `Blast_Clearance_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.doc`);
}

function buildMultiPagePdfFromJpegs(
  pages: { jpegBytes: Uint8Array; widthPx: number; heightPx: number }[]
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cur = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    cur += b.byteLength;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    cur += b.byteLength;
  };
  const startObj = (id: number) => {
    offsets[id] = cur;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => pushStr('\nendobj\n');

  const pagePtW = 595.28; // ISO A4 Portrait
  const pagePtH = 841.89;

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);
  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  endObj();

  pages.forEach((pg, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    const scale = Math.min(pagePtW / pg.widthPx, pagePtH / pg.heightPx);
    const drawW = pg.widthPx * scale;
    const drawH = pg.heightPx * scale;
    const drawX = (pagePtW - drawW) / 2;
    const drawY = (pagePtH - drawH) / 2;
    const contentStr = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im1 Do\nQ\n`;
    const contentBytes = encoder.encode(contentStr);

    startObj(pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pagePtW.toFixed(2)} ${pagePtH.toFixed(
        2
      )}] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    endObj();

    startObj(contentId);
    pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('\nendstream');
    endObj();

    startObj(imageId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pg.widthPx} /Height ${pg.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(pg.jpegBytes);
    pushStr('\nendstream');
    endObj();
  });

  const totalObjs = 2 + pages.length * 3;
  const xref = cur;
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= totalObjs; i++) {
    pushStr(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const b64 = dataUrl.split(',')[1] || '';
  const rawBin = atob(b64);
  const bytes = new Uint8Array(rawBin.length);
  for (let i = 0; i < rawBin.length; i++) {
    bytes[i] = rawBin.charCodeAt(i);
  }
  return bytes;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  yStart: number,
  maxW: number,
  lineH: number
): number {
  const words = text.split(' ');
  let line = '';
  let y = yStart;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineH;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

export async function exportBlastReadinessPdfCertificate(
  rawInput: BlastCalcInput,
  result: BlastCalcResult
): Promise<void> {
  const input = normalizeInputDefaults(rawInput);
  const W = 1654; // 200 DPI ISO A4 Portrait
  const H = 2339;

  const makePageCanvas = (pageNum: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(60, 48, W - 120, 108);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 31px sans-serif';
    ctx.fillText('NEXT-BLAST CLEARANCE & GEOTECHNICAL CALCULATION REPORT', 92, 100);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '19px monospace';
    ctx.fillText(
      `${input.scenarioLabel}  |  ${input.chainageLabel}  |  Geologist: ${input.geologistName}  |  Page ${pageNum} of 2`,
      92,
      136
    );
    return { canvas, ctx };
  };

  // ==================== PAGE 1: VERDICT, GEOMETRY, SUPPORT BREAKDOWN & MATRIX ====================
  const p1 = makePageCanvas(1);
  if (!p1) return;
  const ctx1 = p1.ctx;

  const vBg =
    result.verdict === 'ALLOWED'
      ? '#ECFDF5'
      : result.verdict === 'STRICTLY_NOT_ALLOWED'
      ? '#FEF2F2'
      : '#FFFBEB';
  const vBorder =
    result.verdict === 'ALLOWED'
      ? '#059669'
      : result.verdict === 'STRICTLY_NOT_ALLOWED'
      ? '#DC2626'
      : '#D97706';
  ctx1.fillStyle = vBg;
  ctx1.fillRect(60, 178, W - 120, 142);
  ctx1.strokeStyle = vBorder;
  ctx1.lineWidth = 4;
  ctx1.strokeRect(60, 178, W - 120, 142);
  ctx1.fillStyle = vBorder;
  ctx1.font = 'bold 30px sans-serif';
  ctx1.fillText(result.verdictTitle, 88, 224);
  ctx1.fillStyle = '#1E293B';
  ctx1.font = '20px sans-serif';
  drawWrappedText(ctx1, result.verdictSubtitle, 88, 260, W - 180, 27);

  const drawKvTable1 = (title: string, yStart: number, rows: [string, string, string, string][]): number => {
    ctx1.fillStyle = '#0369A1';
    ctx1.font = 'bold 23px sans-serif';
    ctx1.fillText(title, 60, yStart);
    let y = yStart + 14;
    ctx1.font = '18px monospace';
    for (const [k1, v1, k2, v2] of rows) {
      ctx1.fillStyle = '#F8FAFC';
      ctx1.fillRect(60, y, W - 120, 42);
      ctx1.strokeStyle = '#CBD5E1';
      ctx1.lineWidth = 1.5;
      ctx1.strokeRect(60, y, W - 120, 42);
      ctx1.beginPath();
      ctx1.moveTo(W / 2, y);
      ctx1.lineTo(W / 2, y + 42);
      ctx1.stroke();
      ctx1.fillStyle = '#475569';
      ctx1.fillText(`${k1}:`, 76, y + 27);
      ctx1.fillStyle = '#0F172A';
      ctx1.fillText(v1.slice(0, 38), 335, y + 27);
      ctx1.fillStyle = '#475569';
      ctx1.fillText(`${k2}:`, W / 2 + 16, y + 27);
      ctx1.fillStyle = '#0F172A';
      ctx1.fillText(v2.slice(0, 38), W / 2 + 285, y + 27);
      y += 42;
    }
    return y + 34;
  };

  let y1 = 365;
  y1 = drawKvTable1('1. EXCAVATION PROFILE, STRESS & COMBINED MASS CLASSIFICATION', y1, [
    ['Profile & Size', `${input.geometry.crownGeometry.toUpperCase()} (${input.geometry.width.toFixed(2)}x${input.geometry.height.toFixed(2)}m)`, 'Area / Cover P0', `${result.tunnelAreaM2}m² / ${input.overburdenM}m (${result.inSituVerticalStressMpa}MPa)`],
    ['Barton Q / Q*', `Q=${result.qIndex} | Q*=${result.qEffectiveBlastAdjusted} | Dmax=${result.maxUnsupportedSpanDmaxM}m`, 'Bieniawski RMR89', `${result.rmr89} (${result.rockClassLabel.slice(0, 20)})`],
    ['RQD / UCS / GSI', `${input.rqdPct}% / ${input.ucsMpa} MPa / GSI ${result.gsi}`, 'Hoek-Brown σcm/Erm', `${result.sigmaCmMpa} MPa / ${result.ermGpa} GPa (Strain ${result.postBlastTunnelStrainPct}%)`],
    ['Current / Next Pull', `${input.currentPullM.toFixed(2)}m / Req ${input.requiredNextPullM.toFixed(2)}m`, 'Unbolted Exposed', `${input.exposedLengthM.toFixed(2)}m -> Post ${result.postBlastTotalExposedM.toFixed(2)}m`],
  ]);

  y1 = drawKvTable1('2. SUPPORT CAPACITY BREAKDOWN (SHOTCRETE, MESH, BOLTS, LG/RIB & AUX)', y1, [
    ['Support Tier', input.supportTier.replace(/_/g, ' ').toUpperCase(), 'Shotcrete + Mesh', `${input.shotcreteThicknessMm}mm @ ${input.shotcreteAgeHours}h (${result.earlyAgeShotcreteMpa}MPa) = ${result.installedShotcreteCapacityKpa} kPa`],
    ['Rock Bolts Cap', `${result.installedBoltCapacityKpa} kPa (${input.boltsPerRing}x${input.boltLengthM}m @ ${input.boltSpacingM}m)`, 'LG / Steel Rib Cap', `${result.installedGirderCapacityKpa} kPa (${result.installedArchLabel.slice(0, 22)})`],
    ['Forepoling & Aux', `Forepole ${result.installedForepolingCapacityKpa} kPa | Aux ${result.installedFaceInvertCapacityKpa} kPa`, 'Total Cap / Demand', `${result.totalInstalledCapacityKpa} kPa vs ${result.postBlastSupportDemandKpa} kPa (FoS ${result.postBlastFos})`],
    ['Stand-Up NO Supp', `${formatHoursHuman(result.unsupportedStandUpPostBlastHrs)}`, 'Stand-Up WITH Supp', `${formatHoursHuman(result.supportedStandUpPostBlastHrs)} (SafePull ${result.maxSafeNextPullM.toFixed(2)}m)`],
  ]);

  // Safety Checks Table on Page 1
  ctx1.fillStyle = '#0369A1';
  ctx1.font = 'bold 23px sans-serif';
  ctx1.fillText('3. SIX-POINT ENGINEERING SAFETY AUDIT MATRIX', 60, y1);
  y1 += 16;
  const sCols = [60, 560, 1080, 1410, W - 60];
  ctx1.fillStyle = '#E2E8F0';
  ctx1.fillRect(60, y1, W - 120, 40);
  ctx1.strokeStyle = '#94A3B8';
  ctx1.strokeRect(60, y1, W - 120, 40);
  ctx1.fillStyle = '#0F172A';
  ctx1.font = 'bold 17px monospace';
  ctx1.fillText('Verification Check', sCols[0] + 12, y1 + 26);
  ctx1.fillText('Calculated Value', sCols[1] + 12, y1 + 26);
  ctx1.fillText('Criterion', sCols[2] + 12, y1 + 26);
  ctx1.fillText('Status', sCols[3] + 12, y1 + 26);
  y1 += 40;

  ctx1.font = '16px monospace';
  for (const ck of result.safetyChecks) {
    ctx1.fillStyle = ck.status === 'PASS' ? '#F0FDF4' : ck.status === 'FAIL' ? '#FEF2F2' : '#FFFBEB';
    ctx1.fillRect(60, y1, W - 120, 40);
    ctx1.strokeStyle = '#CBD5E1';
    ctx1.strokeRect(60, y1, W - 120, 40);
    ctx1.fillStyle = '#0F172A';
    ctx1.fillText(ck.checkName.slice(0, 40), sCols[0] + 12, y1 + 26);
    ctx1.fillText(ck.computedValue.slice(0, 42), sCols[1] + 12, y1 + 26);
    ctx1.fillText(ck.acceptanceCriterion.slice(0, 28), sCols[2] + 12, y1 + 26);
    ctx1.fillStyle = ck.status === 'PASS' ? '#166534' : ck.status === 'FAIL' ? '#991B1B' : '#92400E';
    ctx1.fillText(ck.status, sCols[3] + 12, y1 + 26);
    y1 += 40;
  }

  // Conditional Pull Table on Page 1
  y1 += 34;
  ctx1.fillStyle = '#0369A1';
  ctx1.font = 'bold 23px sans-serif';
  ctx1.fillText('4. CONDITIONAL NEXT-BLAST PULL & MINIMUM SUPPORT SCHEDULE', 60, y1);
  y1 += 16;
  const cols = [60, 180, 320, 440, 680, 860, W - 60];
  ctx1.fillStyle = '#E2E8F0';
  ctx1.fillRect(60, y1, W - 120, 40);
  ctx1.strokeStyle = '#94A3B8';
  ctx1.strokeRect(60, y1, W - 120, 40);
  ctx1.fillStyle = '#0F172A';
  ctx1.font = 'bold 17px monospace';
  ctx1.fillText('Pull', cols[0] + 12, y1 + 26);
  ctx1.fillText('Exposed', cols[1] + 12, y1 + 26);
  ctx1.fillText('FoS', cols[2] + 12, y1 + 26);
  ctx1.fillText('Stand-Up (No/Sup)', cols[3] + 12, y1 + 26);
  ctx1.fillText('Status', cols[4] + 12, y1 + 26);
  ctx1.fillText('Minimum Support Action', cols[5] + 12, y1 + 26);
  y1 += 40;

  ctx1.font = '16px monospace';
  for (const row of result.conditionalPullMatrix) {
    ctx1.fillStyle = row.feasibleAsIs ? '#F0FDF4' : '#FFFFFF';
    ctx1.fillRect(60, y1, W - 120, 42);
    ctx1.strokeStyle = '#CBD5E1';
    ctx1.strokeRect(60, y1, W - 120, 42);
    ctx1.fillStyle = '#0F172A';
    ctx1.fillText(`${row.pullM.toFixed(1)}m`, cols[0] + 12, y1 + 27);
    ctx1.fillText(`${row.combinedExposedM.toFixed(1)}m`, cols[1] + 12, y1 + 27);
    ctx1.fillText(`${row.fos.toFixed(2)}`, cols[2] + 12, y1 + 27);
    ctx1.fillText(`${row.unsupportedStandUpHrs.toFixed(1)}h / ${row.supportedStandUpHrs.toFixed(1)}h`, cols[3] + 12, y1 + 27);
    ctx1.fillStyle = row.statusLabel === 'SAFE AS-IS' ? '#166534' : row.statusLabel === 'PROHIBITED' ? '#991B1B' : '#92400E';
    ctx1.fillText(row.statusLabel, cols[4] + 12, y1 + 27);
    ctx1.fillStyle = '#334155';
    ctx1.fillText(row.requiredUpgradeText.slice(0, 62), cols[5] + 12, y1 + 27);
    y1 += 42;
  }

  // ==================== PAGE 2: STEP-BY-STEP CALCULATIONS & SIGN-OFF ====================
  const p2 = makePageCanvas(2);
  if (!p2) return;
  const ctx2 = p2.ctx;

  ctx2.fillStyle = '#0369A1';
  ctx2.font = 'bold 25px sans-serif';
  ctx2.fillText('5. STEP-BY-STEP GEOTECHNICAL FORMULAS & SUBSTITUTED CALCULATIONS', 60, 205);

  let y2 = 230;
  for (const st of result.calculationSteps) {
    const boxH = 215;
    ctx2.fillStyle = '#F8FAFC';
    ctx2.fillRect(60, y2, W - 120, boxH);
    ctx2.strokeStyle = '#CBD5E1';
    ctx2.lineWidth = 2;
    ctx2.strokeRect(60, y2, W - 120, boxH);

    ctx2.fillStyle = '#E2E8F0';
    ctx2.fillRect(60, y2, W - 120, 40);
    ctx2.fillStyle = '#0F172A';
    ctx2.font = 'bold 19px sans-serif';
    ctx2.fillText(`STEP ${st.stepNumber}: ${st.title} (${st.methodStandard})`, 78, y2 + 27);

    ctx2.fillStyle = '#0369A1';
    ctx2.font = 'bold 17px monospace';
    ctx2.fillText(`Equation: ${st.formula}`, 78, y2 + 68);

    ctx2.fillStyle = '#1E293B';
    ctx2.font = '16px monospace';
    const nextY = drawWrappedText(ctx2, `Calc: ${st.substituted}`, 78, y2 + 98, W - 160, 24);

    ctx2.fillStyle = '#065F46';
    ctx2.font = 'bold 17px monospace';
    ctx2.fillText(`Result: ${st.resultValue}`, 78, Math.max(nextY + 4, y2 + 158));

    ctx2.fillStyle = '#475569';
    ctx2.font = '16px sans-serif';
    ctx2.fillText(st.interpretation.slice(0, 125), 78, y2 + 195);

    y2 += boxH + 18;
  }

  // Advisories + Sign-Off on Page 2
  y2 += 12;
  ctx2.fillStyle = '#0F172A';
  ctx2.font = 'bold 21px sans-serif';
  ctx2.fillText('6. PRESCRIPTION, CRITICAL ADVISORIES & SHIFT AUTHORIZATION', 60, y2);
  y2 += 30;
  ctx2.font = '18px sans-serif';
  ctx2.fillStyle = '#1E293B';
  y2 = drawWrappedText(
    ctx2,
    `Target ${input.requiredNextPullM.toFixed(2)}m Action: ${result.minimumSupportForRequiredPull.actionSummary}`,
    60,
    y2,
    W - 120,
    25
  );
  for (const w of result.engineeringWarnings.slice(0, 3)) {
    ctx2.fillStyle = '#B45309';
    ctx2.fillText(`• ${w.slice(0, 120)}`, 60, y2);
    y2 += 26;
  }

  ctx2.strokeStyle = '#475569';
  ctx2.lineWidth = 2;
  ctx2.strokeRect(60, H - 155, W - 120, 100);
  ctx2.fillStyle = '#0F172A';
  ctx2.font = '19px monospace';
  ctx2.fillText(
    `Geologist: ${input.geologistName}     Sign: _____________________     Date: ${new Date().toLocaleDateString()}`,
    88,
    H - 105
  );
  ctx2.fillText(
    `Shift In-Charge: _____________________   Authorization: [ ] CLEARED  [ ] HOLD FOR SUPPORT`,
    88,
    H - 70
  );

  const pdfBlob = buildMultiPagePdfFromJpegs([
    { jpegBytes: canvasToJpegBytes(p1.canvas), widthPx: W, heightPx: H },
    { jpegBytes: canvasToJpegBytes(p2.canvas), widthPx: W, heightPx: H },
  ]);
  const safeName = (input.chainageLabel || 'Heading').replace(/[^a-zA-Z0-9_-]+/g, '_');
  triggerDownload(pdfBlob, `Blast_Clearance_Certificate_${safeName}.pdf`);
}
