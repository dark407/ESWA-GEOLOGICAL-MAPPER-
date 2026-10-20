// ============================================================================
// ESWA TBM MECHANIZED TUNNELING — CALCULATION & ALGORITHM ENGINE
// Formulas grounded in Barton Q_TBM, Bieniawski RMR89, Peck Settlement,
// Field Penetration Index (FPI), Specific Energy (SE), and Annulus Grouting
// ============================================================================

import {
  ChainageDirection,
  TbmDiscontinuityObservation,
  TbmOperatingTelemetry,
} from '../types/tbm';

export interface ChainageCalculationResult {
  isValid: boolean;
  advanceLengthMeters: number;
  directionDetected: ChainageDirection;
  flagWarning?: string;
  formattedInterval: string;
}

/**
 * Robust chainage interval calculation supporting both increasing & decreasing chains
 * E.g. RD 1423.50 to RD 1425.00 (+1.50m) or RD 1500.00 to RD 1498.50 (-1.50m)
 */
export function calculateChainageAdvance(
  startRd: number,
  endRd: number,
  expectedDirection: ChainageDirection = 'INCREASING'
): ChainageCalculationResult {
  if (!Number.isFinite(startRd) || !Number.isFinite(endRd)) {
    return {
      isValid: false,
      advanceLengthMeters: 0,
      directionDetected: expectedDirection,
      flagWarning: 'Chainage values must be valid numbers (e.g. 1423.50).',
      formattedInterval: 'Invalid Chainage',
    };
  }

  const delta = endRd - startRd;
  const advance = Math.abs(delta);
  const detectedDir: ChainageDirection = delta >= 0 ? 'INCREASING' : 'DECREASING';

  let flagWarning: string | undefined;

  if (advance <= 0) {
    flagWarning = 'End chainage equals start chainage (Zero advance recorded).';
  } else if (expectedDirection === 'INCREASING' && delta < 0) {
    flagWarning = `Warning: Location configured as INCREASING chainage, but end chainage (RD ${endRd.toFixed(2)}) is lower than start (RD ${startRd.toFixed(2)}).`;
  } else if (expectedDirection === 'DECREASING' && delta > 0) {
    flagWarning = `Warning: Location configured as DECREASING chainage, but end chainage (RD ${endRd.toFixed(2)}) is higher than start (RD ${startRd.toFixed(2)}).`;
  } else if (advance > 10) {
    flagWarning = `Notice: Advance length of ${advance.toFixed(2)}m is unusually large for a single TBM ring or shift stroke. Please verify.`;
  }

  return {
    isValid: advance > 0,
    advanceLengthMeters: Number(advance.toFixed(3)),
    directionDetected: detectedDir,
    flagWarning,
    formattedInterval: `RD ${startRd.toFixed(2)}m → RD ${endRd.toFixed(2)}m (Δ ${advance.toFixed(2)}m)`,
  };
}

/**
 * Barton Q-System Geotechnical Calculation
 * Q = (RQD / Jn) * (Jr / Ja) * (Jw / SRF)
 */
export function calculateBartonQ(params: {
  rqd: number;
  jn: number;
  jr: number;
  ja: number;
  jw: number;
  srf: number;
}): { qValue: number; qClass: string; badgeColor: string; description: string } {
  const rqd = Math.max(10, Math.min(100, params.rqd || 10));
  const jn = Math.max(0.5, params.jn || 1);
  const jr = Math.max(0.5, params.jr || 1);
  const ja = Math.max(0.5, params.ja || 1);
  const jw = Math.max(0.05, params.jw || 1);
  const srf = Math.max(0.5, params.srf || 1);

  const q = (rqd / jn) * (jr / ja) * (jw / srf);
  const cleanQ = Number(q.toFixed(3));

  if (cleanQ < 0.01) {
    return { qValue: cleanQ, qClass: 'Class Exceptionally Poor', badgeColor: 'bg-rose-950 text-rose-300 border-rose-700', description: 'Extremely crushed, squeezing or fault gouge ground' };
  } else if (cleanQ < 0.1) {
    return { qValue: cleanQ, qClass: 'Class Extremely Poor', badgeColor: 'bg-rose-900 text-rose-200 border-rose-600', description: 'Heavy support, prone to face collapse or high ravelling' };
  } else if (cleanQ < 1.0) {
    return { qValue: cleanQ, qClass: 'Class Very Poor', badgeColor: 'bg-amber-900 text-amber-200 border-amber-600', description: 'Weak rock mass with multiple close joint sets' };
  } else if (cleanQ < 4.0) {
    return { qValue: cleanQ, qClass: 'Class Poor', badgeColor: 'bg-amber-800 text-amber-100 border-amber-500', description: 'Blocky ground, systematic support required' };
  } else if (cleanQ < 10.0) {
    return { qValue: cleanQ, qClass: 'Class Fair', badgeColor: 'bg-blue-900 text-blue-200 border-blue-500', description: 'Moderate rock quality, favorable TBM boring' };
  } else if (cleanQ < 40.0) {
    return { qValue: cleanQ, qClass: 'Class Good', badgeColor: 'bg-emerald-900 text-emerald-200 border-emerald-500', description: 'Stable competent ground, high penetration rate potential' };
  } else if (cleanQ < 100.0) {
    return { qValue: cleanQ, qClass: 'Class Very Good', badgeColor: 'bg-emerald-800 text-emerald-100 border-emerald-400', description: 'Massive hard rock, minimal ground support needed' };
  } else {
    return { qValue: cleanQ, qClass: 'Class Extremely Good', badgeColor: 'bg-cyan-900 text-cyan-200 border-cyan-400', description: 'Near unjointed intact bedrock' };
  }
}

/**
 * Bieniawski RMR89 Geotechnical Calculation
 * RMR = UCS_score + RQD_score + Spacing_score + Condition_score + Water_score + Orientation_adj
 */
export function calculateRmr89(params: {
  strengthScore: number;
  rqdScore: number;
  spacingScore: number;
  conditionScore: number;
  waterScore: number;
  orientationAdjustment: number;
}): { rmrValue: number; rmrClass: string; badgeColor: string; description: string } {
  const sum =
    (params.strengthScore || 0) +
    (params.rqdScore || 0) +
    (params.spacingScore || 0) +
    (params.conditionScore || 0) +
    (params.waterScore || 0) +
    (params.orientationAdjustment || 0);

  const cleanRmr = Math.max(0, Math.min(100, Math.round(sum)));

  if (cleanRmr <= 20) {
    return { rmrValue: cleanRmr, rmrClass: 'Class V (Very Poor Rock)', badgeColor: 'bg-rose-950 text-rose-300 border-rose-700', description: 'Immediate face collapse hazard, heavy EPB/slurry counter-pressure needed' };
  } else if (cleanRmr <= 40) {
    return { rmrValue: cleanRmr, rmrClass: 'Class IV (Poor Rock)', badgeColor: 'bg-amber-900 text-amber-200 border-amber-600', description: 'Short stand-up time (<10 hrs), moderate ravelling' };
  } else if (cleanRmr <= 60) {
    return { rmrValue: cleanRmr, rmrClass: 'Class III (Fair Rock)', badgeColor: 'bg-yellow-900 text-yellow-200 border-yellow-500', description: 'Standard TBM boring, good ring erection cycle' };
  } else if (cleanRmr <= 80) {
    return { rmrValue: cleanRmr, rmrClass: 'Class II (Good Rock)', badgeColor: 'bg-emerald-900 text-emerald-200 border-emerald-500', description: 'Stable bore, high disc cutter life' };
  } else {
    return { rmrValue: cleanRmr, rmrClass: 'Class I (Very Good Rock)', badgeColor: 'bg-cyan-900 text-cyan-200 border-cyan-400', description: 'Excellent self-supporting rock mass' };
  }
}

/**
 * TBM Key Performance Indicators:
 * - Field Penetration Index (FPI): FPI = Thrust / (Penetration * CutterCount) [kN/cutter/mm]
 * - Penetration Rate (PR): PR = Penetration * RPM * 60 / 1000 [m/hr]
 * - Specific Energy (SE): SE = Power / ExcavationRate [MJ/m3]
 */
export function calculateTbmKpi(
  telemetry: Partial<TbmOperatingTelemetry>,
  cutterheadDiameterM: number = 6.4,
  cutterCount: number = 44
): {
  fpi: number;
  penetrationRateMH: number;
  specificEnergyMJM3: number;
  fpiStatus: 'NORMAL' | 'EASY_BORING' | 'HARD_ABRASIVE' | 'HIGH_WEAR_RISK';
} {
  const thrustKn = telemetry.thrustForceKn || 12000;
  const torqueKnm = telemetry.cutterheadTorqueKnm || 1500;
  const rpm = telemetry.cutterheadRpm || 4.5;
  const penMm = Math.max(0.1, telemetry.penetrationPerRevMm || 4.0);
  const cutters = Math.max(1, cutterCount || 44);
  const diam = Math.max(2.0, cutterheadDiameterM || 6.4);

  // FPI = Thrust / (Cutters * Penetration) [kN / (cutter · mm)]
  const fpi = thrustKn / (cutters * penMm);

  // Penetration Rate = (penMm mm/rev) * (rpm rev/min) * 60 min/h / 1000 mm/m = m/h
  const pr = (penMm * rpm * 60) / 1000;

  // Excavation Rate = PR (m/s) * Area (m2)
  const tunnelArea = (Math.PI / 4) * diam * diam;
  const prMps = pr / 3600;
  const qM3s = prMps * tunnelArea;

  // Machine Power = Torque * Omega + Thrust * Velocity
  // Omega = 2 * PI * (RPM / 60) rad/s
  const omega = (2 * Math.PI * rpm) / 60;
  const rotPowerKw = torqueKnm * omega; // kNm * rad/s = kW
  const thrustPowerKw = thrustKn * prMps; // kN * m/s = kW
  const totalPowerKw = rotPowerKw + thrustPowerKw;

  // Specific Energy = Power (kW) / Q (m3/s) = kJ/m3 = / 1000 -> MJ/m3
  const specificEnergy = qM3s > 0 ? (totalPowerKw / qM3s) / 1000 : 0;

  let fpiStatus: 'NORMAL' | 'EASY_BORING' | 'HARD_ABRASIVE' | 'HIGH_WEAR_RISK' = 'NORMAL';
  if (fpi > 45) {
    fpiStatus = 'HIGH_WEAR_RISK';
  } else if (fpi > 32) {
    fpiStatus = 'HARD_ABRASIVE';
  } else if (fpi < 12) {
    fpiStatus = 'EASY_BORING';
  }

  return {
    fpi: Number(fpi.toFixed(2)),
    penetrationRateMH: Number(pr.toFixed(2)),
    specificEnergyMJM3: Number(specificEnergy.toFixed(2)),
    fpiStatus,
  };
}

/**
 * Peck's Empirical Settlement Trough Formula
 * S(x) = S_max * exp(-x^2 / (2 * i^2))
 * where:
 *   S_max = Maximum settlement at centerline (x = 0)
 *   i = Trough width parameter = K * z_0 (where z_0 is depth to tunnel axis)
 *   K = Trough width factor (typically 0.4 - 0.5 for clays, 0.25 - 0.35 for sands)
 */
export function calculatePeckSettlement(params: {
  depthToAxisM: number;
  troughWidthFactorK: number;
  groundLossRatioVsPercent: number; // Volume loss V_s in %, typically 0.5% - 2.0%
  tunnelDiameterM: number;
  distanceFromCenterlineM: number;
}): {
  sMaxMm: number;
  troughWidthIM: number;
  settlementAtXMm: number;
} {
  const z0 = Math.max(5, params.depthToAxisM || 18);
  const K = Math.max(0.2, Math.min(0.7, params.troughWidthFactorK || 0.45));
  const D = Math.max(2, params.tunnelDiameterM || 6.4);
  const vsPct = Math.max(0.1, params.groundLossRatioVsPercent || 1.0);
  const x = Math.abs(params.distanceFromCenterlineM || 0);

  // i = K * z0
  const i = K * z0;

  // Area of tunnel = PI * D^2 / 4
  const tunnelArea = (Math.PI / 4) * D * D;
  // Volume loss per meter V_s = Area * (vsPct / 100)
  const vs = tunnelArea * (vsPct / 100);

  // S_max = V_s / (sqrt(2 * PI) * i) * 1000 (mm)
  const sMaxMm = (vs / (Math.sqrt(2 * Math.PI) * i)) * 1000;

  // S(x) = S_max * exp(-x^2 / (2 * i^2))
  const sxMm = sMaxMm * Math.exp(-(x * x) / (2 * i * i));

  return {
    sMaxMm: Number(sMaxMm.toFixed(2)),
    troughWidthIM: Number(i.toFixed(2)),
    settlementAtXMm: Number(sxMm.toFixed(2)),
  };
}

/**
 * Theoretical Annular Tail Void Grout Volume
 * V_theo = (PI / 4) * (D_cutterhead^2 - D_lining_ext^2) * RingWidth * OvercutFactor
 */
export function calculateAnnularGroutVolume(params: {
  cutterheadDiameterM: number;
  liningOuterDiameterM: number;
  ringWidthM: number;
  overcutFactor?: number; // e.g. 1.05 to 1.15 for overcutters/conical shield
}): {
  theoreticalVolumeM3: number;
  annulusGapMm: number;
} {
  const dc = Math.max(2.0, params.cutterheadDiameterM || 6.4);
  const dl = Math.max(1.8, params.liningOuterDiameterM || 6.2);
  const lw = Math.max(0.5, params.ringWidthM || 1.5);
  const overcut = Math.max(1.0, params.overcutFactor || 1.05);

  const gapMm = ((dc - dl) / 2) * 1000;
  const area = (Math.PI / 4) * (dc * dc - dl * dl);
  const vol = area * lw * overcut;

  return {
    theoreticalVolumeM3: Number(vol.toFixed(2)),
    annulusGapMm: Number(gapMm.toFixed(1)),
  };
}
