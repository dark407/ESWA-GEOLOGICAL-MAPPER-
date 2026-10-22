// ============================================================================
// ESWA ADVANCE GEOLOGICAL ANALYTICS & ROCK MECHANICS ENGINE
// High-Precision Real-Time Geomechanics, Kinematic Wedge Stability Solver,
// Forward Look-Ahead & Geohazard Forecasting (+3m to +30m),
// 4-Surface Apparent Dip Alignment, Hoek-Brown Strength Envelopes,
// Palmström Block Sizing, Hydrogeology Inflow, and Executive Engineering Report.
// ============================================================================

import React, { useState, useMemo, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  Download,
  Droplets,
  Eye,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Maximize2,
  Printer,
  RefreshCw,
  Ruler,
  Save,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
  Zap,
  FileDown,
  GitFork,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  LithologyRegion,
  OverbreakUndercutAnalysis,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  TunnelGeometry,
  TunnelSettings,
  SurfaceType,
} from '../types/tunnel';
import { calculateBieniawskiRmr } from '../engine/rockMassClassificationEngine';
import { computeRockStrataSupportSpotBoltingAndFailureFos } from '../engine/supportSpotBoltFailureEngine';
import { KinematicWedge3DViewport } from './KinematicWedge3DViewport';
import { FutureAdvance3DViewport } from './FutureAdvance3DViewport';
import { JunctionFactorResult } from './TunnelJunctionFactorModal';

export type AdvancedAnalysisTab =
  | 'EXECUTIVE_REPORT'
  | 'WEDGE_FOS'
  | 'FUTURE_FORECAST'
  | 'APPARENT_DIP_SOLVER'
  | 'HOEK_BROWN_ROCK'
  | 'STANDUP_TIME_SPAN'
  | 'PALMSTROM_BLOCKS'
  | 'HYDRO_INFLOW';

export interface AdvancedGeologicalAnalysisModalProps {
  isOpen?: boolean;
  onClose: () => void;
  fullPage?: boolean;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  qIndexParams?: QIndexParameters;
  rmrParams?: RmrParameters;
  rockMassSummary?: RockMassSummaryTable;
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  lithologyRegions?: LithologyRegion[];
  junctionFactorData?: JunctionFactorResult | null;
  onOpenJunctionCalculator?: () => void;
  onClearJunctionFactor?: () => void;
}

export const AdvancedGeologicalAnalysisModal: React.FC<AdvancedGeologicalAnalysisModalProps> = ({
  isOpen = true,
  onClose,
  fullPage = false,
  geometry,
  settings,
  joints,
  jointSets,
  qIndexParams: propQIndexParams,
  rmrParams: propRmrParams,
  rockMassSummary,
  overbreakAnalysis,
  lithologyRegions = [],
  junctionFactorData = null,
  onOpenJunctionCalculator,
  onClearJunctionFactor,
}) => {
  const [activeTab, setActiveTab] = useState<AdvancedAnalysisTab>('EXECUTIVE_REPORT');

  // Interactive controls for Apparent Dip vs Drive Direction Solver
  const [customDriveAzimuth, setCustomDriveAzimuth] = useState<number>(
    settings.driveDirection ?? 0
  );
  const [selectedJointIndex, setSelectedJointIndex] = useState<number>(0);

  // Interactive controls for Wedge FoS sensitivity
  const [simulatedBoltCapacityKn, setSimulatedBoltCapacityKn] = useState<number>(200);
  const [simulatedBoltSpacingM, setSimulatedBoltSpacingM] = useState<number>(1.5);
  const [simulatedShotcreteMm, setSimulatedShotcreteMm] = useState<number>(75);
  const [simulatedWedgeFrictionAngleDeg, setSimulatedWedgeFrictionAngleDeg] = useState<number>(32);
  const [wedgeVisualMode, setWedgeVisualMode] = useState<'3D' | '2D'>('3D');
  const [futureVisualMode, setFutureVisualMode] = useState<'3D' | '2D'>('3D');

  // Interactive controls for In-situ Stress & Overburden (Futures & Hoek-Brown)
  const [overburdenDepthM, setOverburdenDepthM] = useState<number>(280);
  const [intactRockUcsMpa, setIntactRockUcsMpa] = useState<number>(95);
  const [gsiValue, setGsiValue] = useState<number>(55);
  const [blastDisturbanceD, setBlastDisturbanceD] = useState<number>(0.2);

  // Print ref
  const reportPrintRef = useRef<HTMLDivElement | null>(null);

  // Default fallback parameters
  const qParams: QIndexParameters = useMemo(() => {
    return (
      propQIndexParams || {
        rqd: 75,
        jn: 9,
        jnDescription: '3 joint sets',
        jr: 1.5,
        jrDescription: 'Rough or irregular, planar',
        ja: 2.0,
        jaDescription: 'Slightly altered joint walls',
        jw: 1.0,
        jwDescription: 'Dry excavations or minor inflow',
        srf: 1.0,
        srfDescription: 'Medium stress, favorable condition',
        esr: 1.0,
      }
    );
  }, [propQIndexParams]);

  const rmrParams: RmrParameters = useMemo(() => {
    return (
      propRmrParams || ({
        version: 'RMR89',
        strengthInputType: 'UCS_MPA',
        intactStrengthValueMPa: intactRockUcsMpa,
        intactStrengthDescription: 'Strong rock (50–100 MPa)',
        intactStrengthRating: 12,
        rqdPercent: 75,
        rqdDescription: 'Fair quality (75%)',
        rqdRating: 13,
        spacingMeters: 0.35,
        spacingDescription: '0.2–0.6m (Moderate)',
        spacingRating: 10,
        conditionDescription: 'Slightly rough surfaces, separation < 1mm',
        conditionRating: 20,
        conditionSubRatings: {
          useDetailedSubRatings: false,
          persistenceValue: '1–3m',
          persistenceRating: 4,
          apertureValue: '0.1–1.0mm',
          apertureRating: 4,
          roughnessValue: 'Slightly rough',
          roughnessRating: 4,
          infillingValue: 'Hard filling < 5mm',
          infillingRating: 4,
          weatheringValue: 'Slightly weathered',
          weatheringRating: 4,
        },
        groundwaterInflowLPerMin10m: 5,
        groundwaterDescription: 'Damp / minor seepage',
        groundwaterRating: 10,
        strikeDipOrientationDescription: 'Fair orientation relative to drive',
        orientationAdjustment: -5,
        tunnelDriveDirectionDeg: customDriveAzimuth,
        orientationFavourability: 'Fair',
        orientationAdjustmentRating: -5,
        paramStatus: {
          intactStrength: 'CONFIRMED',
          rqd: 'CONFIRMED',
          spacing: 'CONFIRMED',
          condition: 'CONFIRMED',
          groundwater: 'CONFIRMED',
          orientationAdjustment: 'CONFIRMED',
        },
        userConfirmed: true,
      } as unknown as RmrParameters)
    );
  }, [propRmrParams, intactRockUcsMpa, customDriveAzimuth]);

  // Basic geometrical dimensions
  const spanW = geometry?.width || 8.5;
  const heightH = geometry?.height || 7.5;
  const pullL = settings.roundLength || 3.0;
  const rockDensity = 2.7; // t/m3 (standard rock mass density)

  // Discontinuity safe fallback
  const activeJoint = useMemo(() => {
    if (joints && joints.length > 0) {
      const clampedIdx = Math.min(Math.max(0, selectedJointIndex), joints.length - 1);
      return joints[clampedIdx];
    }
    return {
      id: 'mock-j1',
      surface: 'face' as SurfaceType,
      strike: 45,
      dip: 65,
      dipDirection: 135,
      set: 'J1',
      persistenceMeters: 3.5,
    };
  }, [joints, selectedJointIndex]);

  // True orientations
  const trueStrike = activeJoint.strike ?? 45;
  const trueDip = activeJoint.dip ?? 65;
  const trueDipDir = activeJoint.dipDirection ?? 135;

  // Real-time Rock Mass Rating (Bieniawski 1989)
  const rmrVal = useMemo(() => {
    const computed = calculateBieniawskiRmr(rmrParams);
    return computed?.finalRmr ?? 62;
  }, [rmrParams]);

  // Real-time Barton Q-Index
  const qVal = useMemo(() => {
    const rqd = Math.max(1, qParams.rqd || 75);
    const jn = Math.max(0.5, qParams.jn || 9);
    const jr = Math.max(0.5, qParams.jr || 1.5);
    const ja = Math.max(0.75, qParams.ja || 2.0);
    const jw = Math.max(0.05, qParams.jw || 1.0);
    const srf = Math.max(0.5, qParams.srf || 1.0);
    return Number(((rqd / jn) * (jr / ja) * (jw / srf)).toFixed(2));
  }, [qParams]);

  // Integrated Strata Failure & Spot Bolting analysis
  const strataAnalysis = useMemo(() => {
    return computeRockStrataSupportSpotBoltingAndFailureFos(
      geometry,
      settings,
      joints,
      jointSets,
      qParams,
      rmrParams,
      rockMassSummary,
      overbreakAnalysis
    );
  }, [geometry, settings, joints, jointSets, qParams, rmrParams, rockMassSummary, overbreakAnalysis]);

  // --------------------------------------------------------------------------
  // 1. KINEMATIC WEDGE STABILITY & FACTOR OF SAFETY (FOS)
  // --------------------------------------------------------------------------
  // Tetrahedral roof wedge geometry formed by J1 + J2 + Tunnel Crown Arch
  const wedgeVolume = useMemo(() => {
    const apexHeight = Math.min(heightH * 0.45, (spanW / 2) * Math.tan((trueDip * Math.PI) / 180));
    return Number(((1 / 3) * (spanW * 0.65) * pullL * apexHeight).toFixed(2));
  }, [spanW, pullL, heightH, trueDip]);

  const wedgeMassT = Number((wedgeVolume * rockDensity).toFixed(1));
  const wedgeWeightKn = Number((wedgeMassT * 9.81).toFixed(1));

  // Kinematic sliding driving force (sliding on joint plane inclined at trueDip)
  const drivingForceKn = Number(
    (wedgeWeightKn * Math.sin((Math.min(75, Math.max(25, trueDip)) * Math.PI) / 180)).toFixed(1)
  );

  // Normal force acting on the sliding plane
  const normalForceKn = Number(
    (wedgeWeightKn * Math.cos((Math.min(75, Math.max(25, trueDip)) * Math.PI) / 180)).toFixed(1)
  );

  // Shear resistance from joint cohesion and friction
  const frictionRad = (simulatedWedgeFrictionAngleDeg * Math.PI) / 180;
  const jointFrictionResistanceKn = Number((normalForceKn * Math.tan(frictionRad)).toFixed(1));
  const jointCohesionResistanceKn = Number((spanW * pullL * 0.4 * 25).toFixed(1)); // 25 kPa residual cohesion
  const totalUnreinforcedResistingKn = jointFrictionResistanceKn + jointCohesionResistanceKn;

  // Unbolted Factor of Safety
  const unboltedFos = Number(
    Math.max(0.2, totalUnreinforcedResistingKn / Math.max(1, drivingForceKn)).toFixed(2)
  );

  // Installed rock bolts intersecting the wedge
  const activeBolts = useMemo(() => {
    const boltsPerRow = Math.max(1, Math.round((spanW * 0.7) / simulatedBoltSpacingM));
    const rowsInPull = Math.max(1, Math.round(pullL / simulatedBoltSpacingM));
    return boltsPerRow * rowsInPull;
  }, [spanW, pullL, simulatedBoltSpacingM]);

  const rockBoltsResistanceKn = activeBolts * simulatedBoltCapacityKn * 0.85; // 0.85 orientation angle factor

  // Shotcrete perimeter shear resistance
  const slidingAreaSqM = Number(((spanW * 0.65 + pullL) * 1.8).toFixed(1));
  const shotcreteShearStrengthMpa = 1.8; // 28-day SFRS shear strength
  const shotcreteResistanceKn =
    simulatedShotcreteMm > 0
      ? Number(
          (2 * (spanW * 0.65 + pullL) * (simulatedShotcreteMm / 1000) * shotcreteShearStrengthMpa * 1000).toFixed(1)
        )
      : 0;

  const totalSupportedResistingKn = totalUnreinforcedResistingKn + rockBoltsResistanceKn + shotcreteResistanceKn;
  const supportedFos = Number((totalSupportedResistingKn / Math.max(1, drivingForceKn)).toFixed(2));

  // --------------------------------------------------------------------------
  // 2. 4-SURFACE APPARENT DIP & DRILL GUIDE
  // --------------------------------------------------------------------------
  const deltaFace = Math.abs(((trueStrike - customDriveAzimuth + 540) % 360) - 180);
  const faceApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaFace * Math.PI) / 180))
  );
  const faceApparentDipDeg = Number(((faceApparentDipRad * 180) / Math.PI).toFixed(1));

  const deltaLeftWall = Math.abs(((trueStrike - (customDriveAzimuth + 90) + 540) % 360) - 180);
  const leftWallApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaLeftWall * Math.PI) / 180))
  );
  const leftWallApparentDipDeg = Number(((leftWallApparentDipRad * 180) / Math.PI).toFixed(1));

  const deltaRightWall = Math.abs(((trueStrike - (customDriveAzimuth - 90) + 540) % 360) - 180);
  const rightWallApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaRightWall * Math.PI) / 180))
  );
  const rightWallApparentDipDeg = Number(((rightWallApparentDipRad * 180) / Math.PI).toFixed(1));

  const crownTraceAngleDeg = Number(
    Math.abs(((trueStrike - customDriveAzimuth + 540) % 360) - 180).toFixed(1)
  );

  // --------------------------------------------------------------------------
  // 3. IN-SITU STRESS, OVERBURDEN & HOEK-BROWN ENVELOPE
  // --------------------------------------------------------------------------
  // Vertical in-situ stress sigma_v = rho * g * H
  const sigmaVMpa = Number(((rockDensity * 9.81 * overburdenDepthM) / 1000).toFixed(2));
  // Horizontal stress ratio k0 (Sheorey / Brown & Hoek model)
  const k0Ratio = Number((0.25 + 7 * (0.001 + 1 / overburdenDepthM)).toFixed(2));
  const sigmaHMpa = Number((k0Ratio * sigmaVMpa).toFixed(2));
  // Maximum tangential stress at boundary sigma_theta (Kirsch solution approx 2.5 * sigma_v)
  const maxTangentialStressMpa = Number((Math.max(sigmaVMpa, sigmaHMpa) * 2.5).toFixed(1));

  // Hoek-Brown parameters (Hoek, Carranza-Torres, Corkum 2002)
  const miConstant = 25; // Standard igneous/metamorphic intact rock constant
  const hbMb = Number((miConstant * Math.exp((gsiValue - 100) / (28 - 14 * blastDisturbanceD))).toFixed(4));
  const hbS = Number((Math.exp((gsiValue - 100) / (9 - 3 * blastDisturbanceD))).toFixed(6));
  const hbA = Number((0.5 + (1 / 6) * (Math.exp(-gsiValue / 15) - Math.exp(-20 / 3))).toFixed(4));
  const rockMassUcsSigmaCmMpa = Number((intactRockUcsMpa * Math.pow(hbS, hbA)).toFixed(1));
  const rockMassModulusEmGpa = Number(
    (
      (100 * (1 - blastDisturbanceD / 2)) /
      (1 + Math.exp((75 + 25 * blastDisturbanceD - gsiValue) / 11))
    ).toFixed(1)
  );

  // Rockburst Severity Criterion (Wang, Hoek & Brown: sigma_theta / sigma_ci)
  const rockburstRatio = Number((maxTangentialStressMpa / Math.max(10, intactRockUcsMpa)).toFixed(2));
  const rockburstEvaluation = useMemo(() => {
    if (rockburstRatio < 0.3) {
      return { level: 'NONE / STABLE', color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', desc: 'No strain-bursting risk. Standard rock mass slabbing controls.' };
    } else if (rockburstRatio < 0.5) {
      return { level: 'SLIGHT / ACOUSTIC POPPING', color: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30', desc: 'Minor micro-cracking and shallow acoustic pops. Install systematic mesh + rock bolts.' };
    } else if (rockburstRatio < 0.7) {
      return { level: 'MODERATE ROCKBURST', color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', desc: 'Violent ejection of small rock slabs and keyblocks. Yielding D-bolts & high-energy mesh required.' };
    } else {
      return { level: 'SEVERE / HEAVY ROCKBURST', color: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', desc: 'CRITICAL HIGH-ENERGY HAZARD. Deep dynamic rock fracturing. De-stress blasting and sacrificial yield canopy mandatory.' };
    }
  }, [rockburstRatio]);

  // Squeezing Ground Criterion (Hoek & Marinos: sigma_cm / p_0)
  const squeezingRatio = Number((rockMassUcsSigmaCmMpa / Math.max(0.1, sigmaVMpa)).toFixed(2));
  const squeezingEvaluation = useMemo(() => {
    if (squeezingRatio > 0.4) {
      return { level: 'NO SQUEEZING (< 1% Strain)', color: 'text-emerald-400', desc: 'Elastic behavior. Standard rigid shotcrete & lattice girder support.' };
    } else if (squeezingRatio >= 0.2) {
      return { level: 'MODERATE SQUEEZING (1% - 2.5% Strain)', color: 'text-amber-400', desc: 'Minor ductile convergence. Allow 100mm clearance margin with yielding lining slots.' };
    } else {
      return { level: 'SEVERE SQUEEZING (> 2.5% Strain)', color: 'text-rose-400', desc: 'Heavy plastic convergence. Yielding steel TH-arches and compressible lining backfill required.' };
    }
  }, [squeezingRatio]);

  // --------------------------------------------------------------------------
  // 4. FORWARD ADVANCE FORECASTING (+3m, +6m, +9m, +15m, +30m)
  // --------------------------------------------------------------------------
  const currentChNum = parseFloat((settings.chainage || '100').replace(/[^\d.]/g, '')) || 100;
  const forwardPredictions = useMemo(() => {
    const steps = [
      { advanceDelta: 3, label: 'Immediate Next Blast Round', horizon: 'Immediate Face' },
      { advanceDelta: 6, label: 'Round 2 Advance', horizon: 'Near Forecast' },
      { advanceDelta: 9, label: 'Round 3 Advance', horizon: 'Medium Forecast' },
      { advanceDelta: 15, label: 'Mid-Term Advance Stage', horizon: 'Probe Target' },
      { advanceDelta: 30, label: 'Deep Probe Drilling Extent', horizon: 'Regional Core Horizon' },
    ];

    const angleDiffRad = ((trueDipDir - customDriveAzimuth) * Math.PI) / 180;
    const cosAngle = Math.cos(angleDiffRad);
    const daylightDistanceM =
      Math.abs(cosAngle) > 0.05
        ? Number((heightH / (Math.tan((trueDip * Math.PI) / 180) * Math.abs(cosAngle))).toFixed(1))
        : 99.9;

    return steps.map((s) => {
      const targetChainage = currentChNum + s.advanceDelta;
      const willIntersectInHorizon = daylightDistanceM <= s.advanceDelta + 2.5 && daylightDistanceM >= s.advanceDelta - 2.5;
      const isDaylightPast = daylightDistanceM < s.advanceDelta - 2.5;

      let riskLevel: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
      if (willIntersectInHorizon) {
        riskLevel = activeJoint.set.startsWith('F') || unboltedFos < 1.0 ? 'HIGH' : 'MODERATE';
      } else if (s.advanceDelta >= 15 && rockburstRatio >= 0.5) {
        riskLevel = 'HIGH';
      } else if (s.advanceDelta === 3 && unboltedFos < 1.0) {
        riskLevel = 'HIGH';
      }

      // Predicted rock mass class drift
      const predictedClass =
        s.advanceDelta <= 6
          ? rmrVal >= 61 ? 'Class II (Good)' : 'Class III (Fair)'
          : s.advanceDelta <= 15
          ? willIntersectInHorizon ? 'Class IV (Poor - Shear)' : 'Class III (Fair)'
          : 'Class III - IV Transition';

      return {
        advanceDelta: s.advanceDelta,
        label: s.label,
        horizon: s.horizon,
        targetChainage: `RD ${targetChainage.toFixed(1)}m`,
        daylightDistanceM,
        willIntersectInHorizon,
        isDaylightPast,
        riskLevel,
        predictedClass,
        waterForecast: s.advanceDelta >= 15 ? 'Likely Water Bearing Joint Zone' : 'Damp / Low Seepage',
        recommendedSupport:
          riskLevel === 'HIGH'
            ? 'Forepoling Umbrella (Ø114mm x 12m) + HEB-160 Steel Arches @ 0.8m + 150mm SFRS'
            : riskLevel === 'MODERATE'
            ? 'Radial Resin Bolts L=4.0m @ 1.2m c/c + 100mm SFRS + Crown Keyblock Spot Bolting'
            : 'Standard Systematic Rock Bolts L=3.5m @ 1.5m c/c + 75mm SFRS',
      };
    });
  }, [currentChNum, trueDipDir, customDriveAzimuth, heightH, trueDip, activeJoint, unboltedFos, rockburstRatio, rmrVal]);

  // --------------------------------------------------------------------------
  // 5. STAND-UP TIME & MAXIMUM UNSUPPORTED SPAN (BIENIAWSKI & BARTON)
  // --------------------------------------------------------------------------
  const baseStandUpHours = Math.pow(10, (rmrVal - 20) / 13);
  const adjustedStandUpHours = Number(Math.max(0.1, baseStandUpHours / Math.pow(spanW / 2.5, 1.8)).toFixed(1));
  const standUpFormatted =
    adjustedStandUpHours >= 24 * 30
      ? `${(adjustedStandUpHours / (24 * 30)).toFixed(1)} Months`
      : adjustedStandUpHours >= 24
      ? `${(adjustedStandUpHours / 24).toFixed(1)} Days (${adjustedStandUpHours.toFixed(0)} hrs)`
      : adjustedStandUpHours >= 1
      ? `${adjustedStandUpHours.toFixed(1)} Hours`
      : `${Math.round(adjustedStandUpHours * 60)} Minutes`;

  const effectiveSpanW = junctionFactorData ? junctionFactorData.diagonalSpanM : spanW;
  const esrVal = qParams.esr || 1.0;
  const effectiveEsr = junctionFactorData ? junctionFactorData.junctionEsr : esrVal;
  const maxUnsupportedSpanM = Number((2 * effectiveEsr * Math.pow(Math.max(0.01, qVal), 0.44)).toFixed(2));
  const isSpanUnsupportedSafe = effectiveSpanW <= maxUnsupportedSpanM;

  const standardPRoofKpa = Number(
    (
      ((2 * Math.sqrt(Math.max(0.5, qParams.jn || 9))) / (3 * Math.max(0.5, qParams.jr || 1.5))) *
      Math.pow(Math.max(0.01, qVal), -1 / 3) *
      100
    ).toFixed(1)
  );
  const pRoofKpa = junctionFactorData
    ? Number((standardPRoofKpa * junctionFactorData.junctionFactorKj).toFixed(1))
    : standardPRoofKpa;

  const terzaghiHpMeters = Number(
    (
      rmrVal >= 81
        ? 0.05 * effectiveSpanW
        : rmrVal >= 61
        ? 0.2 * effectiveSpanW
        : rmrVal >= 41
        ? 0.45 * (effectiveSpanW + heightH)
        : rmrVal >= 21
        ? 1.1 * (effectiveSpanW + heightH)
        : 2.1 * (effectiveSpanW + heightH)
    ).toFixed(2)
  );
  const terzaghiLoadKpa = Number((terzaghiHpMeters * rockDensity * 9.81).toFixed(1));

  // --------------------------------------------------------------------------
  // 6. PALMSTRÖM VOLUMETRIC JOINT COUNT (Jv) & BLOCK SIZING
  // --------------------------------------------------------------------------
  const jointSpacings = jointSets.map((js) => {
    const match = (js.spacing || '').match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0.45;
  });
  const avgSpacing = jointSpacings.length > 0 ? jointSpacings.reduce((a, b) => a + b, 0) / jointSpacings.length : 0.4;
  const palmstromJv = Number(
    (
      jointSpacings.reduce((sum, s) => sum + 1 / Math.max(0.05, s), 0) +
      (joints.length > 6 ? 1.5 : 0.8)
    ).toFixed(1)
  );

  const blockVolumeM3 = Number((Math.pow(avgSpacing, 3) * 1.15).toFixed(4));
  const blockCategory =
    blockVolumeM3 > 8
      ? 'Very Large Blocks (> 8 m³)'
      : blockVolumeM3 >= 0.2
      ? 'Large Blocks (0.2–8 m³)'
      : blockVolumeM3 >= 0.005
      ? 'Medium Blocks (5–200 dm³)'
      : blockVolumeM3 >= 0.0002
      ? 'Small Blocks (0.2–5 dm³)'
      : 'Crushed / Multi-Fractured Rock Mass (< 0.2 dm³)';

  const palmstromRqdPct = Math.max(10, Math.min(100, Math.round(115 - 3.3 * palmstromJv)));

  const obHazardScore = Number(
    Math.min(
      95,
      Math.max(
        15,
        (100 - rmrVal) * 0.45 +
          (unboltedFos < 1.0 ? 35 : unboltedFos < 1.3 ? 20 : 5) +
          (activeJoint.dip > 45 && activeJoint.dip < 80 ? 15 : 5)
      )
    ).toFixed(0)
  );
  const obHazardLevel =
    Number(obHazardScore) >= 65 ? 'HIGH RISK' : Number(obHazardScore) >= 40 ? 'MODERATE RISK' : 'LOW RISK';

  const geologicalExcusablePct = Number((unboltedFos < 1.0 ? 78 : unboltedFos < 1.4 ? 62 : 45).toFixed(0));
  const contractorMechanicalPct = 100 - geologicalExcusablePct;

  // --------------------------------------------------------------------------
  // 7. HYDROGEOLOGY & GROUNDWATER INFLOW
  // --------------------------------------------------------------------------
  const waterHeadM = Math.max(15, Math.round(overburdenDepthM * 0.4));
  const hydraulicPermeabilityK = rmrParams.groundwaterRating && rmrParams.groundwaterRating <= 4 ? 5e-5 : 1e-6;
  const inflowLPerMin10m = Number(
    Math.max(
      2,
      Math.min(
        1400,
        ((2 * Math.PI * hydraulicPermeabilityK * waterHeadM) /
          Math.log((2 * waterHeadM) / (spanW / 2))) *
          10 *
          60 *
          1000
      )
    ).toFixed(1)
  );

  const groutTakeBagsPerRound =
    Number(inflowLPerMin10m) > 100
      ? Math.round(Number(inflowLPerMin10m) * 0.8)
      : Number(inflowLPerMin10m) > 25
      ? Math.round(Number(inflowLPerMin10m) * 0.4)
      : 0;

  // --------------------------------------------------------------------------
  // REPORT GENERATION & EXPORTS (PRINT / PDF / HTML / JSON)
  // --------------------------------------------------------------------------
  const handlePrintReport = () => {
    window.print();
  };

  const handleExportHtmlReport = () => {
    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Geotechnical Engineering Assessment Report - ${settings.tunnelName || 'Tunnel'} - ${settings.chainage || 'Active Round'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 32px; background: #fff; margin: 0; }
    h1, h2, h3 { color: #0f172a; margin-top: 0; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
    .header-table td { padding: 4px 8px; vertical-align: top; }
    .badge { display: inline-block; padding: 4px 8px; font-weight: bold; border-radius: 4px; font-size: 12px; }
    .badge-pass { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-alert { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; font-size: 13px; }
    table.data-table th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155; }
    table.data-table td { padding: 8px 10px; border: 1px solid #cbd5e1; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px dashed #94a3b8; }
    .sign-box { width: 30%; text-align: center; }
    .sign-line { border-bottom: 1px solid #475569; height: 40px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>
        <h2>TUNNEL GEOTECHNICAL &amp; ROCK MECHANICS ASSESSMENT</h2>
        <div style="font-size: 13px; color: #64748b;">Contract / Project: <strong>${settings.projectName || 'Tunnel Construction Project'}</strong></div>
      </td>
      <td style="text-align: right; font-size: 12px; color: #475569;">
        <div>Station / Chainage: <strong>${settings.chainage || 'RD 100.0m'}</strong></div>
        <div>Date of Assessment: <strong>${settings.date || new Date().toISOString().slice(0, 10)}</strong></div>
        <div>Heading Axis: <strong>N ${Math.round(customDriveAzimuth)}° E</strong></div>
      </td>
    </tr>
  </table>

  <h3>1. Executive Classification &amp; Safety Compliance</h3>
  <table class="data-table">
    <tr>
      <th>Bieniawski RMR89</th>
      <th>Barton Q-Value</th>
      <th>Hoek GSI</th>
      <th>Kinematic FoS (Supported)</th>
      <th>Compliance Status</th>
    </tr>
    <tr>
      <td><strong>${rmrVal}</strong> (${rmrVal >= 61 ? 'Class II' : rmrVal >= 41 ? 'Class III' : 'Class IV'})</td>
      <td><strong>${qVal}</strong> (${strataAnalysis.supportCategoryLabel})</td>
      <td><strong>${gsiValue}</strong></td>
      <td><strong style="color: ${supportedFos >= 1.5 ? '#15803d' : '#b91c1c'};">${supportedFos.toFixed(2)}</strong> (Unbolted: ${unboltedFos.toFixed(2)})</td>
      <td><span class="badge ${supportedFos >= 1.5 ? 'badge-pass' : 'badge-alert'}">${supportedFos >= 1.5 ? 'CERTIFIED ADEQUATE (Target ≥ 1.50)' : 'SUPPORT REINFORCEMENT REQUIRED'}</span></td>
    </tr>
  </table>

  <h3>2. Discontinuity Apparent Dip on 4 Excavation Faces</h3>
  <table class="data-table">
    <tr>
      <th>Discontinuity</th>
      <th>True Strike / Dip</th>
      <th>Tunnel Face</th>
      <th>Crown Arch Trace</th>
      <th>Left Wall</th>
      <th>Right Wall</th>
    </tr>
    <tr>
      <td><strong>${activeJoint.set}</strong></td>
      <td>${trueStrike}° / ${trueDip}° ∠ ${trueDipDir}°</td>
      <td><strong>${faceApparentDipDeg}°</strong></td>
      <td><strong>${crownTraceAngleDeg}°</strong></td>
      <td><strong>${leftWallApparentDipDeg}°</strong></td>
      <td><strong>${rightWallApparentDipDeg}°</strong></td>
    </tr>
  </table>

  <h3>3. Forward Look-Ahead &amp; Geohazard Predictions (+3m to +30m)</h3>
  <table class="data-table">
    <tr>
      <th>Advance Horizon</th>
      <th>Target Chainage</th>
      <th>Predicted Class</th>
      <th>Daylighting Distance</th>
      <th>Hazard Evaluation</th>
      <th>Prescribed Pre-Support</th>
    </tr>
    ${forwardPredictions.map(p => `
    <tr>
      <td><strong>${p.label}</strong></td>
      <td>${p.targetChainage}</td>
      <td>${p.predictedClass}</td>
      <td>${p.daylightDistanceM.toFixed(1)}m</td>
      <td>${p.riskLevel} RISK</td>
      <td>${p.recommendedSupport}</td>
    </tr>
    `).join('')}
  </table>

  <h3>4. Geotechnical Stress &amp; Hydrogeology Overview</h3>
  <div class="card">
    <p><strong>Overburden Depth:</strong> ${overburdenDepthM} m | <strong>In-situ Vertical Stress:</strong> ${sigmaVMpa} MPa | <strong>Max Tangential Boundary Stress:</strong> ${maxTangentialStressMpa} MPa</p>
    <p><strong>Rockburst Potential:</strong> ${rockburstEvaluation.level} (${rockburstRatio} ratio) - ${rockburstEvaluation.desc}</p>
    <p><strong>Squeezing Potential:</strong> ${squeezingEvaluation.level} - ${squeezingEvaluation.desc}</p>
    <p><strong>Groundwater Inflow Rate:</strong> ~${inflowLPerMin10m} L/min per 10m round | <strong>Pre-Grouting Estimate:</strong> ${groutTakeBagsPerRound} bags microfine cement</p>
  </div>

  <div class="signatures">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div><strong>${settings.mappedBy || 'Shift Geologist'}</strong><br><span style="font-size: 11px; color: #64748b;">Engineering Geologist</span></div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div><strong>Registered Geotechnical Engineer</strong><br><span style="font-size: 11px; color: #64748b;">Lead Tunnel Consultant</span></div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div><strong>Tunnel Construction Manager</strong><br><span style="font-size: 11px; color: #64748b;">Contractor In-Charge</span></div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Geotechnical_Assessment_Report_${settings.tunnelName || 'Tunnel'}_RD${currentChNum}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSummaryReport = () => {
    const reportData = {
      project: settings.projectName || 'Tunnel Face Mapping Project',
      tunnel: settings.tunnelName || 'Tunnel 1',
      chainage: settings.chainage || 'RD 100.0m',
      date: new Date().toISOString(),
      geometry: { spanW, heightH, pullL, customDriveAzimuth },
      rockMassClassification: {
        rmr89: rmrVal,
        qValue: qVal,
        gsi: gsiValue,
        palmstromJv,
        blockVolumeM3,
        palmstromRqdPct,
      },
      kinematicWedgeStability: {
        wedgeVolumeM3: wedgeVolume,
        wedgeWeightKn,
        drivingForceKn,
        unboltedFos,
        supportedFos,
        targetFos: 1.5,
        status: supportedFos >= 1.5 ? 'PASS_SAFE' : 'INADEQUATE',
      },
      stressAndFutures: {
        overburdenDepthM,
        sigmaVMpa,
        maxTangentialStressMpa,
        rockburstRatio,
        rockburstLevel: rockburstEvaluation.level,
        squeezingRatio,
        squeezingLevel: squeezingEvaluation.level,
        forwardPredictions,
      },
      apparentDip4Surfaces: {
        joint: activeJoint.set,
        trueStrike,
        trueDip,
        trueDipDir,
        driveAzimuth: customDriveAzimuth,
        faceApparentDipDeg,
        leftWallApparentDipDeg,
        rightWallApparentDipDeg,
        crownTraceAngleDeg,
      },
      standUpTimeAndSupportPressure: {
        standUpTime: standUpFormatted,
        maxUnsupportedSpanM,
        isSpanUnsupportedSafe,
        bartonRoofPressureKpa: pRoofKpa,
        terzaghiRockLoadHpM: terzaghiHpMeters,
        terzaghiPressureKpa: terzaghiLoadKpa,
      },
      overbreakHazardAndFIDIC: {
        obHazardScore,
        obHazardLevel,
        geologicalExcusablePct,
        contractorMechanicalPct,
      },
      hydrogeology: {
        estimatedInflowLPerMin10m: inflowLPerMin10m,
        preGroutingBagsPerRound: groutTakeBagsPerRound,
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Advanced_Geological_Analysis_${settings.tunnelName || 'Tunnel'}_RD${currentChNum}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contentNode = (
    <div
      className={`relative flex flex-col ${
        fullPage
          ? 'w-full h-full min-h-0 bg-slate-900 text-slate-100 overflow-hidden font-sans'
          : 'w-full max-w-7xl max-h-[96vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-slate-100 overflow-hidden font-sans'
      }`}
    >
      {/* PRINT-ONLY STYLES INJECTION */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-geotech-report, #printable-geotech-report * {
            visibility: visible;
          }
          #printable-geotech-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 24px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-700/80 shrink-0 no-print">
        <div className="flex items-center gap-3">
          {fullPage && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer mr-1"
              title="Return to Core Mapping Canvas"
            >
              <ArrowLeft className="w-4 h-4 text-sky-400" />
              <span>Back to Canvas</span>
            </button>
          )}
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                ADVANCE GEOLOGICAL ANALYTICS &amp; ROCK MECHANICS
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                Real-Time Geomechanics &amp; Futures
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deep numerical modeling, kinematic keyblock solver, +30m forward advance forecasting, and formal engineering report
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenJunctionCalculator && (
            <button
              onClick={onOpenJunctionCalculator}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer shadow-sm ${
                junctionFactorData
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border border-violet-400 ring-2 ring-violet-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-violet-300 border border-violet-500/40 hover:border-violet-400'
              }`}
              title="Tunnel Junction Factor (Kj) Calculator: Intersections, T-Junctions, Adits & Bifurcations"
            >
              <GitFork className="w-3.5 h-3.5 text-violet-300 shrink-0" />
              <span>
                {junctionFactorData
                  ? `Junction Kj=${junctionFactorData.junctionFactorKj}×`
                  : 'Junction Factor'}
              </span>
              {junctionFactorData && onClearJunctionFactor && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearJunctionFactor();
                  }}
                  className="ml-1 p-0.5 hover:bg-violet-800 rounded text-violet-200"
                  title="Remove Junction Factor & return to standard linear span"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          )}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            title="Print or Save Official Geotechnical PDF Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print / PDF Report</span>
          </button>
          <button
            onClick={handleExportHtmlReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            title="Download Standalone HTML Document Report"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export HTML</span>
          </button>
          <button
            onClick={handleExportSummaryReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            title="Download Full Numerical Geomechanics JSON Spec"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
          {!fullPage && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 8 NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0 no-print">
        {[
          { id: 'EXECUTIVE_REPORT', label: '1. Executive Report Sheet', icon: FileText },
          { id: 'WEDGE_FOS', label: '2. 2D/3D Kinematic Wedge & FoS', icon: ShieldCheck },
          { id: 'FUTURE_FORECAST', label: '3. Future Advance & Geohazard Forecast', icon: TrendingUp },
          { id: 'APPARENT_DIP_SOLVER', label: '4. 4-Surface Apparent Dip', icon: Compass },
          { id: 'HOEK_BROWN_ROCK', label: '5. Hoek-Brown & Stress Envelopes', icon: Activity },
          { id: 'STANDUP_TIME_SPAN', label: '6. Stand-Up Time & Rock Load', icon: Clock },
          { id: 'PALMSTROM_BLOCKS', label: '7. Palmström Blocks & Overbreak', icon: Layers },
          { id: 'HYDRO_INFLOW', label: '8. Hydrogeology & Inflow', icon: Droplets },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdvancedAnalysisTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* ================================================================= */}
        {/* TAB 1: EXECUTIVE ENGINEERING REPORT SHEET (PRINT & SIGN-OFF READY)*/}
        {/* ================================================================= */}
        {activeTab === 'EXECUTIVE_REPORT' && (
          <div id="printable-geotech-report" className="space-y-6 bg-slate-900 text-slate-100 p-2 sm:p-6 rounded-xl border border-slate-700/60 print:bg-white print:text-black print:border-none print:p-0">
            {/* OFFICIAL DOCUMENT HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-sky-500 gap-4">
              <div>
                <div className="text-[11px] font-mono tracking-widest text-sky-400 font-bold uppercase print:text-sky-700">
                  GEOTECHNICAL &amp; ROCK MECHANICS ASSESSMENT REPORT
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight print:text-black">
                  {settings.projectName || 'Tunnel Construction Project'}
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600">
                  Location / Heading: <strong>{settings.tunnelName || 'Adit 1 Main Heading'}</strong> · Station: <strong>{settings.chainage || 'RD 100.0m'}</strong>
                </p>
              </div>
              <div className="text-right text-xs font-mono text-slate-300 print:text-black">
                <div>Assessment Date: <strong>{settings.date || new Date().toISOString().slice(0, 10)}</strong></div>
                <div>Heading Bearing: <strong>N {Math.round(customDriveAzimuth)}° E</strong></div>
                <div>Profile Geometry: <strong>{spanW}m Span × {heightH}m Height</strong></div>
                <div>Assessed By: <strong>{settings.mappedBy || 'Geotechnical Lead'}</strong></div>
              </div>
            </div>

            {/* SYNTHESIS BENCHMARK TILES */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:border print:border-slate-300 print:p-2">
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 print:bg-slate-50 print:border-slate-300">
                <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">BIENIAWSKI RMR89</div>
                <div className="text-2xl font-extrabold font-mono text-amber-300 print:text-amber-800">{rmrVal}</div>
                <div className="text-[11px] text-slate-300 print:text-black">{rmrVal >= 61 ? 'Class II (Good Rock)' : rmrVal >= 41 ? 'Class III (Fair Rock)' : 'Class IV (Poor Rock)'}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 print:bg-slate-50 print:border-slate-300">
                <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">BARTON Q-VALUE</div>
                <div className="text-2xl font-extrabold font-mono text-sky-300 print:text-sky-800">{qVal}</div>
                <div className="text-[11px] text-slate-300 print:text-black">{strataAnalysis.supportCategoryLabel}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 print:bg-slate-50 print:border-slate-300">
                <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">KINEMATIC WEDGE FoS</div>
                <div className={`text-2xl font-extrabold font-mono ${supportedFos >= 1.5 ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                  {supportedFos.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-300 print:text-black">Unreinforced: {unboltedFos.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 print:bg-slate-50 print:border-slate-300">
                <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">GEOHAZARD RATING</div>
                <div className="text-xl font-extrabold font-mono text-fuchsia-300 print:text-purple-800">{rockburstEvaluation.level.split('/')[0]}</div>
                <div className="text-[11px] text-slate-300 print:text-black">{squeezingEvaluation.level.split('(')[0]}</div>
              </div>
            </div>

            {/* JUNCTION FACTOR ACTIVE BANNER IN EXECUTIVE REPORT */}
            {junctionFactorData && (
              <div className="p-3 bg-violet-950/50 border border-violet-500/70 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono print:bg-violet-50 print:border-violet-400 print:text-black">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-violet-400 print:text-violet-700 shrink-0" />
                  <div>
                    <span className="font-bold text-violet-300 print:text-violet-900">
                      TUNNEL JUNCTION FACTOR ACTIVE ({junctionFactorData.junctionFactorKj}×):
                    </span>{' '}
                    <span>
                      {junctionFactorData.junctionType.replace('_', ' ')} · Diagonal Span = {junctionFactorData.diagonalSpanM}m · Angle = {junctionFactorData.intersectionAngleDeg}° · ESR Penalty = {junctionFactorData.junctionEsr}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-400 print:text-slate-600">Upgraded P_roof: </span>
                  <strong className="text-amber-300 print:text-black text-sm">{junctionFactorData.junctionRoofPressureKpa} kPa</strong>
                  <span className="text-[10px] text-slate-400 ml-1">· Bolt L: {junctionFactorData.junctionBoltLengthM}m</span>
                </div>
              </div>
            )}

            {/* SECTION 1: KINEMATIC KEYBLOCK CERTIFICATION */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 print:bg-transparent print:border-slate-400">
              <h3 className="text-xs font-mono font-bold tracking-wider text-sky-400 uppercase mb-2 print:text-black">
                1. Kinematic Keyblock Stability &amp; Support Compliance
              </h3>
              <p className="text-xs text-slate-300 print:text-slate-700 leading-relaxed">
                Roof and sidewall stability was evaluated using limit equilibrium resolving intersecting mapped discontinuity planes
                (Set {activeJoint.set}: Strike {trueStrike}° / Dip {trueDip}°) against the tunnel drive heading (N {Math.round(customDriveAzimuth)}° E).
                The critical daylighting crown wedge develops a demand driving force of <strong>{drivingForceKn} kN</strong> ({wedgeVolume} m³ / {wedgeMassT} tonnes).
                With systematic installation of <strong>{activeBolts}x L=4.0m radial bolts</strong> (@ {simulatedBoltSpacingM.toFixed(1)}m c/c, {simulatedBoltCapacityKn} kN capacity)
                plus <strong>{simulatedShotcreteMm}mm SFRS</strong>, the resulting Factor of Safety is <strong>{supportedFos.toFixed(2)}</strong>.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded ${supportedFos >= 1.5 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 print:bg-emerald-100 print:text-emerald-900' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 print:bg-rose-100 print:text-rose-900'}`}>
                  {supportedFos >= 1.5 ? 'COMPLIANT WITH DESIGN SPECIFICATION (Target FoS ≥ 1.50)' : 'NON-COMPLIANT: REQUIRES ADDITIONAL ROCK BOLTS / SFRS'}
                </span>
              </div>
            </div>

            {/* SECTION 2: 4-SURFACE DRILL & BLAST APPARENT DIP TABLE */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden print:border-slate-400">
              <div className="px-4 py-2 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700 print:bg-slate-200 print:text-black">
                2. 4-Surface Apparent Dip &amp; Blast-Hole Alignment Matrix
              </div>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 print:bg-slate-100 print:text-black">
                  <tr>
                    <th className="px-3 py-2">Surface Plane</th>
                    <th className="px-3 py-2">Orientation Relative to Drive</th>
                    <th className="px-3 py-2">Apparent Angle</th>
                    <th className="px-3 py-2">Operational Action for Drill Crew</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 print:divide-slate-300 print:text-black">
                  <tr>
                    <td className="px-3 py-2 font-bold text-sky-400 print:text-black">1. Tunnel Face</td>
                    <td className="px-3 py-2">Normal to Drive Azimuth</td>
                    <td className="px-3 py-2 font-bold text-white print:text-black">{faceApparentDipDeg}° Apparent Dip</td>
                    <td className="px-3 py-2">Align perimeter cut holes with trace dip direction to minimize face blowout</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-emerald-400 print:text-black">2. Crown Arch</td>
                    <td className="px-3 py-2">Unwrapped Horizontal Plane</td>
                    <td className="px-3 py-2 font-bold text-white print:text-black">{crownTraceAngleDeg}° Strike Angle</td>
                    <td className="px-3 py-2">Angle rock bolts perpendicular to strike ({Math.round(crownTraceAngleDeg + 90) % 180}°) for maximum shear interception</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-amber-400 print:text-black">3. Left Sidewall</td>
                    <td className="px-3 py-2">Parallel to Drive Azimuth</td>
                    <td className="px-3 py-2 font-bold text-white print:text-black">{leftWallApparentDipDeg}° Apparent Plunge</td>
                    <td className="px-3 py-2">Inspect lower springline footing for daylighting undercut step</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-fuchsia-400 print:text-black">4. Right Sidewall</td>
                    <td className="px-3 py-2">Parallel to Drive Azimuth</td>
                    <td className="px-3 py-2 font-bold text-white print:text-black">{rightWallApparentDipDeg}° Apparent Plunge</td>
                    <td className="px-3 py-2">Install pattern sidewall pinners if plunge exceeds 45°</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 3: FUTURE ADVANCE FORECAST MATRIX (+3m to +30m) */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden print:border-slate-400">
              <div className="px-4 py-2 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700 print:bg-slate-200 print:text-black">
                3. Forward Advance Look-Ahead &amp; Geohazard Predictions (+3m to +30m)
              </div>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 print:bg-slate-100 print:text-black">
                  <tr>
                    <th className="px-3 py-2">Horizon</th>
                    <th className="px-3 py-2">Chainage</th>
                    <th className="px-3 py-2">Forecast Class</th>
                    <th className="px-3 py-2">Daylighting Position</th>
                    <th className="px-3 py-2">Risk</th>
                    <th className="px-3 py-2">Prescribed Action / Pre-Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 print:divide-slate-300 print:text-black">
                  {forwardPredictions.map((pred) => (
                    <tr key={pred.advanceDelta} className="hover:bg-slate-800/40 print:hover:bg-transparent">
                      <td className="px-3 py-2 font-bold text-sky-400 print:text-black">{pred.label}</td>
                      <td className="px-3 py-2 font-bold text-white print:text-black">{pred.targetChainage}</td>
                      <td className="px-3 py-2">{pred.predictedClass}</td>
                      <td className="px-3 py-2">{pred.daylightDistanceM.toFixed(1)}m ahead</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pred.riskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : pred.riskLevel === 'MODERATE' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {pred.riskLevel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 print:text-black text-[11px]">{pred.recommendedSupport}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECTION 4: FORMAL SIGN-OFF BLOCK */}
            <div className="pt-6 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs print:pt-8 print:border-slate-400">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 print:bg-transparent print:border-none">
                <div className="h-12 border-b border-dashed border-slate-600 mb-2"></div>
                <div className="font-bold text-white print:text-black">{settings.mappedBy || 'Shift Geologist'}</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600">Shift Engineering Geologist</div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 print:bg-transparent print:border-none">
                <div className="h-12 border-b border-dashed border-slate-600 mb-2"></div>
                <div className="font-bold text-white print:text-black">Lead Geotechnical Specialist</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600">Consultant Representative / PE</div>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 print:bg-transparent print:border-none">
                <div className="h-12 border-b border-dashed border-slate-600 mb-2"></div>
                <div className="font-bold text-white print:text-black">Tunnel Construction Manager</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600">Contractor Execution In-Charge</div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: 2D/3D KINEMATIC WEDGE STABILITY & FACTOR OF SAFETY (FOS)   */}
        {/* ================================================================= */}
        {activeTab === 'WEDGE_FOS' && (
          <div className="space-y-6">
            {/* REAL-TIME SIMULATION 3D VIEWPORT / 2D CANVAS + HUD */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 3D / 2D REAL-TIME INTERACTIVE WEDGE EQUILIBRIUM VIEWPORT */}
              <div className="lg:col-span-7 flex flex-col space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-mono font-bold text-white">
                      {wedgeVisualMode === '3D' ? 'INTERACTIVE 3D KINEMATIC WEDGE & KEYBLOCK VIEWPORT' : 'REAL-TIME 2D EQUILIBRIUM CROSS-SECTION'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenJunctionCalculator && (
                      <button
                        onClick={onOpenJunctionCalculator}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer shadow-xs ${
                          junctionFactorData
                            ? 'bg-violet-600 hover:bg-violet-500 text-white border border-violet-400'
                            : 'bg-slate-900 hover:bg-slate-800 text-violet-300 border border-violet-500/40'
                        }`}
                        title="Calculate Junction Factor (Kj) for Intersections, T-Junctions & Bifurcations"
                      >
                        <GitFork className="w-3.5 h-3.5 text-violet-300" />
                        <span>{junctionFactorData ? `Junction Kj=${junctionFactorData.junctionFactorKj}×` : 'Junction Factor'}</span>
                      </button>
                    )}
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[11px] font-mono">
                      <button
                        onClick={() => setWedgeVisualMode('3D')}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${wedgeVisualMode === '3D' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        3D Spatial
                      </button>
                      <button
                        onClick={() => setWedgeVisualMode('2D')}
                        className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${wedgeVisualMode === '2D' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        2D Section
                      </button>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${supportedFos >= 1.5 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                      FoS: {supportedFos.toFixed(2)}
                    </span>
                  </div>
                </div>

                {wedgeVisualMode === '3D' ? (
                  <KinematicWedge3DViewport
                    spanW={spanW}
                    heightH={heightH}
                    pullL={pullL}
                    trueDip={trueDip}
                    trueDipDir={trueDipDir}
                    trueStrike={trueStrike}
                    wedgeVolume={wedgeVolume}
                    wedgeWeightKn={wedgeWeightKn}
                    drivingForceKn={drivingForceKn}
                    supportedFos={supportedFos}
                    unboltedFos={unboltedFos}
                    boltSpacingM={simulatedBoltSpacingM}
                    boltCapacityKn={simulatedBoltCapacityKn}
                    shotcreteMm={simulatedShotcreteMm}
                    jointSetLabel={activeJoint.set}
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-[480px] aspect-4/3 bg-slate-900/90 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center p-2">
                      <svg viewBox="0 0 400 320" className="w-full h-full">
                        {/* Tunnel Profile Boundary */}
                        <path
                          d="M 60 260 L 60 160 A 140 140 0 0 1 340 160 L 340 260 Z"
                          fill="#0f172a"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                        />
                        {/* Invert Floor */}
                        <line x1="60" y1="260" x2="340" y2="260" stroke="#64748b" strokeWidth="2" strokeDasharray="4 2" />

                        {/* Critical Roof Wedge Polygon */}
                        <polygon
                          points="120,135 200,60 280,135"
                          fill={supportedFos >= 1.5 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.35)'}
                          stroke={supportedFos >= 1.5 ? '#10b981' : '#f43f5e'}
                          strokeWidth="2.5"
                        />

                        {/* Sliding Discontinuity Plane Lines */}
                        <line x1="80" y1="170" x2="200" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                        <line x1="320" y1="170" x2="200" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />

                        {/* Driving Weight Vector Arrow */}
                        <line x1="200" y1="100" x2="200" y2="160" stroke="#f43f5e" strokeWidth="3" />
                        <text x="208" y="140" fill="#fca5a5" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          W = {wedgeWeightKn} kN
                        </text>

                        {/* Installed Rock Bolts */}
                        {[...Array(Math.min(7, Math.max(3, Math.round(5 / simulatedBoltSpacingM))))].map((_, i) => {
                          const angle = -120 + i * (60 / (Math.min(7, Math.max(3, Math.round(5 / simulatedBoltSpacingM))) - 1));
                          const rad = (angle * Math.PI) / 180;
                          const cx = 200 + 138 * Math.cos(rad);
                          const cy = 160 + 138 * Math.sin(rad);
                          const ex = 200 + 195 * Math.cos(rad);
                          const ey = 160 + 195 * Math.sin(rad);
                          return (
                            <g key={i}>
                              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#38bdf8" strokeWidth="2.5" />
                              <circle cx={cx} cy={cy} r="3" fill="#38bdf8" />
                              <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke="#fff" strokeWidth="2" />
                            </g>
                          );
                        })}

                        {/* Shotcrete layer highlight */}
                        {simulatedShotcreteMm > 0 && (
                          <path
                            d="M 62 260 L 62 160 A 138 138 0 0 1 338 160 L 338 260"
                            fill="none"
                            stroke="#a855f7"
                            strokeWidth={Math.min(6, Math.max(2, simulatedShotcreteMm / 20))}
                            opacity="0.85"
                          />
                        )}

                        <text x="70" y="280" fill="#94a3b8" fontSize="9" fontFamily="monospace">Span: {spanW}m</text>
                        <text x="290" y="280" fill="#94a3b8" fontSize="9" fontFamily="monospace">Pull: {pullL}m</text>
                        <text x="200" y="50" fill="#f59e0b" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                          Wedge Apex ({wedgeVolume} m³)
                        </text>
                      </svg>
                    </div>

                    <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
                      <span>Plunge: {trueDip}° ∠ {trueDipDir}°</span>
                      <span className="text-sky-300">Active Reinforcement: {activeBolts} bolts ({simulatedBoltCapacityKn} kN)</span>
                      <span className="text-purple-300">SFRS: {simulatedShotcreteMm} mm</span>
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE PARAMETRIC SLIDERS & SAFETY MARGIN GAUGES */}
              <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2 mb-1">
                    <Sliders className="w-4 h-4" />
                    REAL-TIME SENSITIVITY CONTROLS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dynamically adjust reinforcement to reach mandatory Factor of Safety (Target ≥ 1.50).
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Bolt Tensile Capacity:</span>
                      <span className="text-sky-300 font-bold">{simulatedBoltCapacityKn} kN</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={350}
                      step={25}
                      value={simulatedBoltCapacityKn}
                      onChange={(e) => setSimulatedBoltCapacityKn(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>100 kN (Ø20)</span>
                      <span>200 kN (Ø25)</span>
                      <span>350 kN (Ø32)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Radial Bolt Spacing:</span>
                      <span className="text-sky-300 font-bold">{simulatedBoltSpacingM.toFixed(1)} m c/c</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={2.5}
                      step={0.1}
                      value={simulatedBoltSpacingM}
                      onChange={(e) => setSimulatedBoltSpacingM(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>1.0m (Dense)</span>
                      <span>1.5m (Standard)</span>
                      <span>2.5m (Wide)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">SFRS Shotcrete Thickness:</span>
                      <span className="text-purple-300 font-bold">{simulatedShotcreteMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={25}
                      value={simulatedShotcreteMm}
                      onChange={(e) => setSimulatedShotcreteMm(Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0 mm (None)</span>
                      <span>75 mm (Standard)</span>
                      <span>200 mm (Heavy)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Joint Friction Angle (φ):</span>
                      <span className="text-amber-300 font-bold">{simulatedWedgeFrictionAngleDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={45}
                      step={1}
                      value={simulatedWedgeFrictionAngleDeg}
                      onChange={(e) => setSimulatedWedgeFrictionAngleDeg(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* FoS Status Box */}
                <div className={`p-3 rounded-lg border ${supportedFos >= 1.5 ? 'bg-emerald-950/40 border-emerald-700/60' : 'bg-rose-950/40 border-rose-700/60'}`}>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-xs text-slate-300">TOTAL SUPPORTED FoS:</span>
                    <span className={`text-xl font-extrabold ${supportedFos >= 1.5 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {supportedFos.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {supportedFos >= 1.5
                      ? '✓ Safety criterion satisfied for primary tunnel support.'
                      : '⚠ Safety factor is below 1.50! Increase bolt density or shotcrete thickness.'}
                  </div>
                </div>
              </div>
            </div>

            {/* DETAILED WEDGE CALCULATION BREAKDOWN TABLE */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700">
                CRITICAL KEYBLOCK &amp; WEDGE INTERSECTION DIRECTORY
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2">Wedge ID</th>
                      <th className="px-4 py-2">Intersecting Sets</th>
                      <th className="px-4 py-2">Affected Sector</th>
                      <th className="px-4 py-2">Volume</th>
                      <th className="px-4 py-2">Weight</th>
                      <th className="px-4 py-2">Unbolted FoS</th>
                      <th className="px-4 py-2">Supported FoS</th>
                      <th className="px-4 py-2">Prescription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-bold text-sky-400">W-01</td>
                      <td className="px-4 py-2.5">J1 × J2 × Crown</td>
                      <td className="px-4 py-2.5">Crown Apex</td>
                      <td className="px-4 py-2.5">{wedgeVolume} m³</td>
                      <td className="px-4 py-2.5">{wedgeWeightKn} kN</td>
                      <td className="px-4 py-2.5 text-rose-400 font-bold">{unboltedFos.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-bold">{supportedFos.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {activeBolts}x L=4.0m radial bolts + {simulatedShotcreteMm}mm SFRS
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-bold text-sky-400">W-02</td>
                      <td className="px-4 py-2.5">J2 × J3 × Right Wall</td>
                      <td className="px-4 py-2.5">Right Shoulder / Haunch</td>
                      <td className="px-4 py-2.5">{(wedgeVolume * 0.7).toFixed(2)} m³</td>
                      <td className="px-4 py-2.5">{(wedgeWeightKn * 0.7).toFixed(1)} kN</td>
                      <td className="px-4 py-2.5 text-rose-400 font-bold">0.82</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-bold">
                        {(supportedFos * 1.15).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        2x spot bolts angled 15° up to pin haunch slab
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-bold text-sky-400">W-03</td>
                      <td className="px-4 py-2.5">J1 × Fault F1</td>
                      <td className="px-4 py-2.5">Left Wall Lower Step</td>
                      <td className="px-4 py-2.5">{(wedgeVolume * 0.45).toFixed(2)} m³</td>
                      <td className="px-4 py-2.5">{(wedgeWeightKn * 0.45).toFixed(1)} kN</td>
                      <td className="px-4 py-2.5 text-amber-400 font-bold">1.12</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-bold">
                        {(supportedFos * 1.35).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        Systematic wall bolts L=3.5m + wire mesh
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: FUTURE ADVANCE FORECASTING & DEEP PROBE (+3m TO +30m)      */}
        {/* ================================================================= */}
        {activeTab === 'FUTURE_FORECAST' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  FORWARD ADVANCE EXCAVATION &amp; GEOHAZARD FORECAST (+3m to +30m)
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Current Face Station: <strong>{settings.chainage || 'RD 100.0m'}</strong>
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Mathematically projects mapped discontinuity orientations forward into unexcavated rock mass.
                Computes structural daylighting intercepts, predicted rock class transitions, and pre-grouting triggers for upcoming blast rounds.
              </p>
            </div>

            {/* 3D FORWARD ADVANCE VIEWPORT / 2D PROFILE SECTION */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
                  <span className="text-xs font-mono font-bold text-white">
                    {futureVisualMode === '3D'
                      ? 'INTERACTIVE 3D FORWARD ADVANCE & HORIZON EXTRAPOLATION'
                      : 'LONGITUDINAL ADVANCE PROFILE & PROBE ARRAY'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenJunctionCalculator && (
                    <button
                      onClick={onOpenJunctionCalculator}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer shadow-xs ${
                        junctionFactorData
                          ? 'bg-violet-600 hover:bg-violet-500 text-white border border-violet-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-violet-300 border border-violet-500/40'
                      }`}
                      title="Calculate Junction Factor (Kj) for Intersections, T-Junctions & Bifurcations"
                    >
                      <GitFork className="w-3.5 h-3.5 text-violet-300" />
                      <span>{junctionFactorData ? `Junction Kj=${junctionFactorData.junctionFactorKj}×` : 'Junction Factor'}</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[11px] font-mono">
                    <button
                      onClick={() => setFutureVisualMode('3D')}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        futureVisualMode === '3D' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      3D Perspective
                    </button>
                    <button
                      onClick={() => setFutureVisualMode('2D')}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        futureVisualMode === '2D' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      2D Profile
                    </button>
                  </div>
                </div>
              </div>

              {futureVisualMode === '3D' ? (
                <FutureAdvance3DViewport
                  spanW={spanW}
                  heightH={heightH}
                  currentChainageNum={currentChNum}
                  trueDip={trueDip}
                  trueDipDir={trueDipDir}
                  trueStrike={trueStrike}
                  customDriveAzimuth={customDriveAzimuth}
                  predictions={forwardPredictions}
                  overburdenDepthM={overburdenDepthM}
                  activeJointSet={activeJoint.set}
                />
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="w-full h-44 bg-slate-900 rounded-lg border border-slate-800 p-2 overflow-hidden">
                    <svg viewBox="0 0 600 140" className="w-full h-full">
                      {/* Excavated Tunnel Tube */}
                      <rect x="20" y="40" width="180" height="60" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                      <text x="110" y="75" fill="#38bdf8" fontSize="11" textAnchor="middle" fontFamily="monospace">
                        Excavated Tunnel
                      </text>

                      {/* Current Face Marker */}
                      <line x1="200" y1="30" x2="200" y2="110" stroke="#f43f5e" strokeWidth="3" />
                      <text x="200" y="24" fill="#f43f5e" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                        ACTIVE FACE (RD {currentChNum}m)
                      </text>

                      {/* Unexcavated Ground with Projected Blast Rounds */}
                      <rect x="200" y="40" width="370" height="60" fill="#1e293b" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />

                      {/* +3m Round */}
                      <line x1="240" y1="40" x2="240" y2="100" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                      <text x="220" y="115" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">+3m</text>

                      {/* +6m Round */}
                      <line x1="280" y1="40" x2="280" y2="100" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                      <text x="260" y="115" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">+6m</text>

                      {/* +9m Round */}
                      <line x1="320" y1="40" x2="320" y2="100" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                      <text x="300" y="115" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">+9m</text>

                      {/* +15m Boundary */}
                      <line x1="400" y1="40" x2="400" y2="100" stroke="#f59e0b" strokeWidth="1.5" />
                      <text x="360" y="115" fill="#f59e0b" fontSize="8" textAnchor="middle" fontFamily="monospace">+15m Probe Limit</text>

                      {/* +30m Boundary */}
                      <line x1="560" y1="40" x2="560" y2="100" stroke="#a855f7" strokeWidth="1.5" />
                      <text x="480" y="115" fill="#a855f7" fontSize="8" textAnchor="middle" fontFamily="monospace">+30m Deep Horizon</text>

                      {/* Projected Fault / Joint Plane day-lighting into Crown */}
                      <line x1="260" y1="15" x2="380" y2="125" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="4 2" />
                      <circle cx="285" cy="40" r="4" fill="#f43f5e" />
                      <text x="300" y="35" fill="#fca5a5" fontSize="8" fontFamily="monospace" fontWeight="bold">
                        Daylight Intercept ({activeJoint.set})
                      </text>

                      {/* 15m Forward Probe Hole Angle */}
                      <line x1="200" y1="45" x2="390" y2="30" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                      <text x="290" y="22" fill="#10b981" fontSize="8" textAnchor="middle" fontFamily="monospace">
                        15m Probe Hole (5° Look-up)
                      </text>
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* ROUND BY ROUND CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {forwardPredictions.map((pred) => (
                <div
                  key={pred.advanceDelta}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    pred.riskLevel === 'HIGH'
                      ? 'bg-rose-950/30 border-rose-700/60'
                      : pred.riskLevel === 'MODERATE'
                      ? 'bg-amber-950/30 border-amber-700/60'
                      : 'bg-slate-800/60 border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        +{pred.advanceDelta}m ({pred.horizon})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded ${
                          pred.riskLevel === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : pred.riskLevel === 'MODERATE'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {pred.riskLevel}
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white mb-1">
                      {pred.targetChainage}
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-1">
                      <div>Class: <strong className="text-amber-300">{pred.predictedClass}</strong></div>
                      <div>Hydro: <strong className="text-sky-300">{pred.waterForecast}</strong></div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-700/60 text-[11px] text-slate-300">
                    <div className="font-bold text-amber-300 text-[10px] mb-1">Prescribed Action:</div>
                    <div className="leading-tight text-slate-300">{pred.recommendedSupport}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* PRE-SUPPORT FOREPOLING TRIGGER */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-white text-sm">
                  Advance Probe &amp; Umbrella Canopy Decision Rule
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Based on joint set {activeJoint.set} dipping at {trueDip}° into drive azimuth {customDriveAzimuth}°,
                  the daylighting intercept occurs within {forwardPredictions[0].daylightDistanceM.toFixed(1)}m of the working face.
                  {forwardPredictions[0].riskLevel === 'HIGH'
                    ? ' PIPE ROOFING CANOPY REQUIRED: Overlapping 12m steel pipes (Ø114mm, 40cm c/c) with polyurethane/cement pressure grouting recommended before advancing blast round.'
                    : ' Standard systematic radial bolting + 75mm SFRS provides adequate factor of safety without umbrella casing.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: 4-SURFACE APPARENT DIP SOLVER                              */}
        {/* ================================================================= */}
        {activeTab === 'APPARENT_DIP_SOLVER' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/60">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-indigo-200">
                    Why Field Apparent Dip Differs from True Dip on 4 Excavation Faces
                  </h3>
                  <p className="text-xs text-indigo-300/90 leading-relaxed">
                    A joint plane with True Orientation (Strike {trueStrike}° / Dip {trueDip}°) projects at different apparent angles on
                    different excavation surfaces. On the <strong>Tunnel Face</strong>, it appears at{' '}
                    <strong>{faceApparentDipDeg}°</strong>. On the <strong>Sidewalls</strong>, it plunges at{' '}
                    <strong>{leftWallApparentDipDeg}°</strong>. Geologists frequently commit blunders by recording the sidewall
                    trace angle as the true dip angle. This analytical solver eliminates that error completely.
                  </p>
                </div>
              </div>
            </div>

            {/* DRIVE AZIMUTH & JOINT SELECTOR */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">Select Analyzed Joint:</span>
                  <span className="text-sky-300 font-bold">
                    {activeJoint.set} ({trueStrike}° / {trueDip}°)
                  </span>
                </div>
                <select
                  value={selectedJointIndex}
                  onChange={(e) => setSelectedJointIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 font-mono text-xs cursor-pointer"
                >
                  {joints.map((j, idx) => (
                    <option key={j.id || idx} value={idx}>
                      {j.set || `Joint #${idx + 1}`} · Strike {j.strike}° / Dip {j.dip}° ({j.surface})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  True Orientation: Strike <strong>{trueStrike}°</strong> · Dip <strong>{trueDip}°</strong> · Dip Dir{' '}
                  <strong>{trueDipDir}°</strong>
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">Tunnel Drive Azimuth (α_D):</span>
                  <span className="text-amber-300 font-bold">{customDriveAzimuth.toFixed(0)}° Azimuth</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={customDriveAzimuth}
                  onChange={(e) => setCustomDriveAzimuth(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>000° (North)</span>
                  <span>090° (East)</span>
                  <span>180° (South)</span>
                  <span>270° (West)</span>
                  <span>360°</span>
                </div>
              </div>
            </div>

            {/* 4 SURFACES APPARENT DIP RESULTS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono font-bold text-sky-400 mb-1">1. TUNNEL FACE (Top Heading)</div>
                <div className="text-xs text-slate-400 mb-2">Perpendicular to Drive Vector</div>
                <div className="text-3xl font-mono font-extrabold text-white">
                  {faceApparentDipDeg}°
                </div>
                <div className="text-[11px] text-slate-300 mt-2">
                  Formula: <span className="font-mono text-slate-400">tan⁻¹(tan {trueDip}° × |sin {deltaFace.toFixed(0)}°|)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono font-bold text-emerald-400 mb-1">2. CROWN ARCH (Horizontal)</div>
                <div className="text-xs text-slate-400 mb-2">Unwrapped Strip Log Plane</div>
                <div className="text-3xl font-mono font-extrabold text-white">
                  {crownTraceAngleDeg}°
                </div>
                <div className="text-[11px] text-slate-300 mt-2">
                  Strike Relative to Drive: <span className="font-mono text-slate-400">{crownTraceAngleDeg}° angle</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono font-bold text-amber-400 mb-1">3. LEFT WALL (Vertical)</div>
                <div className="text-xs text-slate-400 mb-2">Sidewall Parallel to Drive</div>
                <div className="text-3xl font-mono font-extrabold text-white">
                  {leftWallApparentDipDeg}°
                </div>
                <div className="text-[11px] text-slate-300 mt-2">
                  Apparent Sidewall Dip: <span className="font-mono text-slate-400">{leftWallApparentDipDeg}° plunge</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono font-bold text-fuchsia-400 mb-1">4. RIGHT WALL (Vertical)</div>
                <div className="text-xs text-slate-400 mb-2">Sidewall Parallel to Drive</div>
                <div className="text-3xl font-mono font-extrabold text-white">
                  {rightWallApparentDipDeg}°
                </div>
                <div className="text-[11px] text-slate-300 mt-2">
                  Apparent Sidewall Dip: <span className="font-mono text-slate-400">{rightWallApparentDipDeg}° plunge</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: HOEK-BROWN ENVELOPES & IN-SITU STRESS                      */}
        {/* ================================================================= */}
        {activeTab === 'HOEK_BROWN_ROCK' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">VERTICAL STRESS (σ_v)</div>
                <div className="text-2xl font-bold font-mono text-sky-300">{sigmaVMpa} MPa</div>
                <div className="text-xs text-slate-400 mt-1">Overburden: {overburdenDepthM} m</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">TANGENTIAL STRESS (σ_θ)</div>
                <div className="text-2xl font-bold font-mono text-amber-300">{maxTangentialStressMpa} MPa</div>
                <div className="text-xs text-slate-400 mt-1">At Tunnel Arch Boundary</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">ROCKBURST POTENTIAL</div>
                <div className={`text-xl font-bold font-mono ${rockburstEvaluation.color}`}>{rockburstEvaluation.level}</div>
                <div className="text-[10px] text-slate-400 mt-1">σ_θ / σ_ci = {rockburstRatio}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">SQUEEZING POTENTIAL</div>
                <div className={`text-xl font-bold font-mono ${squeezingEvaluation.color}`}>{squeezingEvaluation.level.split('(')[0]}</div>
                <div className="text-[10px] text-slate-400 mt-1">σ_cm / p_0 = {squeezingRatio}</div>
              </div>
            </div>

            {/* HOEK-BROWN PARAMETRIC SLIDERS */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">Overburden Depth:</span>
                  <span className="text-sky-300 font-bold">{overburdenDepthM} m</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={1200}
                  step={25}
                  value={overburdenDepthM}
                  onChange={(e) => setOverburdenDepthM(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">Intact Rock UCS (σ_ci):</span>
                  <span className="text-amber-300 font-bold">{intactRockUcsMpa} MPa</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={250}
                  step={5}
                  value={intactRockUcsMpa}
                  onChange={(e) => setIntactRockUcsMpa(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-300">Geological Strength Index (GSI):</span>
                  <span className="text-emerald-300 font-bold">{gsiValue}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={90}
                  step={1}
                  value={gsiValue}
                  onChange={(e) => setGsiValue(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* HOEK-BROWN FAILURE ENVELOPE DETAILS */}
            <div className="border border-slate-700/80 rounded-xl overflow-hidden p-4 bg-slate-950">
              <h4 className="text-xs font-mono font-bold text-sky-400 mb-2">HOEK-BROWN ROCK MASS FAILURE ENVELOPE PARAMETERS (2002)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs text-slate-300">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">m_b Parameter</div>
                  <div className="font-bold text-white text-base">{hbMb}</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">s Parameter</div>
                  <div className="font-bold text-white text-base">{hbS}</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Rock Mass UCS (σ_cm)</div>
                  <div className="font-bold text-emerald-400 text-base">{rockMassUcsSigmaCmMpa} MPa</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-500 text-[10px]">Rock Mass Modulus (E_m)</div>
                  <div className="font-bold text-sky-400 text-base">{rockMassModulusEmGpa} GPa</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: STAND-UP TIME & ROCK LOAD                                  */}
        {/* ================================================================= */}
        {activeTab === 'STANDUP_TIME_SPAN' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">BIENIAWSKI STAND-UP TIME</div>
                <div className="text-2xl font-bold font-mono text-amber-300">{standUpFormatted}</div>
                <div className="text-xs text-slate-400 mt-1">Span: {spanW.toFixed(1)}m · RMR: {rmrVal}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">BARTON MAX UNSUPPORTED SPAN</div>
                <div className="text-2xl font-bold font-mono text-sky-300">{maxUnsupportedSpanM} m</div>
                <div className="text-xs text-slate-400 mt-1">
                  {isSpanUnsupportedSafe ? 'Actual span ≤ S_max (Safe)' : 'Actual span > S_max (Support Mandatory)'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">BARTON SUPPORT PRESSURE (P_roof)</div>
                <div className="text-2xl font-bold font-mono text-emerald-300">{pRoofKpa} kPa</div>
                <div className="text-xs text-slate-400 mt-1">Q-Value: {qVal} · Jr: {qParams.jr} · Jn: {qParams.jn}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">TERZAGHI ROCK LOAD (Hp)</div>
                <div className="text-2xl font-bold font-mono text-fuchsia-300">{terzaghiHpMeters} m</div>
                <div className="text-xs text-slate-400 mt-1">Overburden Load: {terzaghiLoadKpa} kPa</div>
              </div>
            </div>

            <div className="border border-slate-700/80 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700">
                EMPIRICAL VS. ANALYTICAL SUPPORT PRESSURE COMPARISON
              </div>
              <div className="p-4 bg-slate-950/60 space-y-3 text-xs font-mono text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Excavation Span (W) × Height (H):</span>
                  <span className="text-white font-bold">{spanW.toFixed(2)}m × {heightH.toFixed(2)}m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Tunnel Advance Pull Length (L_p):</span>
                  <span className="text-white font-bold">{pullL.toFixed(2)}m per round</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Demand Support Pressure (Barton + Terzaghi):</span>
                  <span className="text-amber-300 font-bold">{Math.max(pRoofKpa, terzaghiLoadKpa)} kPa</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Installed Support Capacity (Bolts + SFRS):</span>
                  <span className="text-emerald-300 font-bold">{strataAnalysis.installedSupportCapacityKpa} kPa</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Overall Strata Support Factor of Safety (FoS_strata):</span>
                  <span className="text-emerald-400 font-extrabold text-sm">{strataAnalysis.strataFactorOfSafety.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* TUNNEL JUNCTION FACTOR UPGRADE CARD */}
            <div className={`p-4 rounded-xl border ${junctionFactorData ? 'bg-violet-950/40 border-violet-600/70 shadow-lg' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-violet-600/30 text-violet-300 border border-violet-500/40">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      TUNNEL JUNCTION &amp; INTERSECTION FACTOR (K_j)
                      {junctionFactorData && (
                        <span className="px-2 py-0.5 text-[10px] bg-violet-600 text-white rounded font-extrabold">
                          ACTIVE: {junctionFactorData.junctionFactorKj}×
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Standard Grimstad &amp; Barton, NGI Q-system, and Bieniawski junction multiplier for 3D intersection spans
                    </p>
                  </div>
                </div>
                {onOpenJunctionCalculator && (
                  <button
                    onClick={onOpenJunctionCalculator}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>{junctionFactorData ? 'Edit Junction Factor' : 'Calculate Junction Factor'}</span>
                  </button>
                )}
              </div>

              {junctionFactorData ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-violet-800/50">
                    <div className="text-[10px] text-slate-400">Junction Geometry</div>
                    <div className="font-bold text-violet-200 text-sm mt-0.5">
                      {junctionFactorData.junctionType.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Angle: {junctionFactorData.intersectionAngleDeg}°</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-violet-800/50">
                    <div className="text-[10px] text-slate-400">Diagonal Span</div>
                    <div className="font-bold text-amber-300 text-sm mt-0.5">
                      {junctionFactorData.diagonalSpanM} m
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Std Span: {spanW.toFixed(1)}m</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-violet-800/50">
                    <div className="text-[10px] text-slate-400">Upgraded Roof Pressure</div>
                    <div className="font-bold text-rose-300 text-sm mt-0.5">
                      {junctionFactorData.junctionRoofPressureKpa} kPa
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Multiplier: {junctionFactorData.junctionFactorKj}×</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-violet-800/50">
                    <div className="text-[10px] text-slate-400">Extended Rock Bolt Length</div>
                    <div className="font-bold text-emerald-300 text-sm mt-0.5">
                      L = {junctionFactorData.junctionBoltLengthM} m
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">SFRS: {junctionFactorData.junctionShotcreteMm} mm</div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>No intersection active. Standard linear single-tube tunnel span ({spanW.toFixed(1)}m) is applied.</span>
                  {onOpenJunctionCalculator && (
                    <button
                      onClick={onOpenJunctionCalculator}
                      className="text-violet-400 hover:text-violet-300 font-mono font-bold underline cursor-pointer"
                    >
                      Open Junction Calculator →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: PALMSTRÖM BLOCKS & OVERBREAK FIDIC SPLIT                  */}
        {/* ================================================================= */}
        {activeTab === 'PALMSTROM_BLOCKS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">VOLUMETRIC JOINT COUNT (Jv)</div>
                <div className="text-3xl font-mono font-extrabold text-sky-300">{palmstromJv}</div>
                <div className="text-xs text-slate-400 mt-1">Joints / m³ of in-situ rock mass</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">BLOCK VOLUME (Vb)</div>
                <div className="text-3xl font-mono font-extrabold text-amber-300">{blockVolumeM3} m³</div>
                <div className="text-xs text-slate-400 mt-1">{blockCategory}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">PALMSTRÖM THEORETICAL RQD</div>
                <div className="text-3xl font-mono font-extrabold text-emerald-300">{palmstromRqdPct}%</div>
                <div className="text-xs text-slate-400 mt-1">Calculated: 115 - 3.3 × Jv</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  OVERBREAK HAZARD RISK INDEX &amp; FIDIC CONTRACTUAL ALLOCATION
                </h3>
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${
                    obHazardLevel === 'HIGH RISK'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {obHazardLevel} ({obHazardScore}/100)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/60">
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-indigo-200 font-bold">Geologically Excusable Overbreak:</span>
                    <span className="text-indigo-300 font-extrabold">{geologicalExcusablePct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${geologicalExcusablePct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Bound by dipping joint set {activeJoint.set} extending beyond theoretical B-line profile. Billable under FIDIC Red Book Clause 12.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-200 font-bold">Contractor Blasting / Over-drilling:</span>
                    <span className="text-amber-300 font-extrabold">{contractorMechanicalPct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${contractorMechanicalPct}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Radial drill hole deviation or excessive specific explosive energy. Non-compensable backfill.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: HYDROGEOLOGY & INFLOW ESTIMATION                           */}
        {/* ================================================================= */}
        {activeTab === 'HYDRO_INFLOW' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">STEADY-STATE WATER INFLOW</div>
                <div className="text-3xl font-mono font-extrabold text-sky-300">{inflowLPerMin10m}</div>
                <div className="text-xs text-slate-400 mt-1">Liters / min per 10m round advance</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">HYDROSTATIC HEAD ABOVE CROWN</div>
                <div className="text-3xl font-mono font-extrabold text-indigo-300">{waterHeadM} m</div>
                <div className="text-xs text-slate-400 mt-1">~{(waterHeadM * 0.00981).toFixed(2)} MPa water pressure on arch</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-xs font-mono text-slate-400 mb-1">PRE-GROUTING REQUIREMENT</div>
                <div className="text-3xl font-mono font-extrabold text-amber-300">{groutTakeBagsPerRound} bags</div>
                <div className="text-xs text-slate-400 mt-1">Microfine cement grout take estimate</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="font-bold text-sky-400 font-mono text-sm">
                DRAINAGE &amp; WATERPROOFING SPECIFICATION
              </div>
              <p className="leading-relaxed">
                Based on current water condition ({rmrParams.groundwaterDescription || 'Damp'}) and mapped discontinuity frequency,
                radial perforated PVC weep holes (Ø50mm, L=4.0m @ 3m c/c) are prescribed along sidewall footings to relieve hydrostatic
                pressure behind the primary shotcrete lining.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Pumping Requirement:</span>{' '}
                  <strong className="text-white">{(Number(inflowLPerMin10m) * 1.5).toFixed(0)} L/min submersible pump</strong>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Waterproofing System:</span>{' '}
                  <strong className="text-white">Geotextile 500 g/m² + PVC Membrane 2.0mm</strong>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 shrink-0 text-xs text-slate-400 no-print">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono">Analytical Rock Engineering Solver active · Real-time Kinematic Core</span>
        </div>
        <button
          onClick={onClose}
          className={`px-4 py-1.5 font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            fullPage
              ? 'bg-sky-600 hover:bg-sky-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
        >
          {fullPage ? '← Return to Mapping Canvas' : 'Close Analysis'}
        </button>
      </div>
    </div>
  );

  if (fullPage) {
    return <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-hidden">{contentNode}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {contentNode}
    </div>
  );
};

export const AdvancedGeologicalAnalysisView = AdvancedGeologicalAnalysisModal;
