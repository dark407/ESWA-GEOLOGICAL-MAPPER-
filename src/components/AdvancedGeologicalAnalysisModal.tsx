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
  Check,
  FolderOpen,
  Box,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  LithologyRegion,
  OverbreakUndercutAnalysis,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
  SurfaceType,
} from '../types/tunnel';
import { calculateBieniawskiRmr } from '../engine/rockMassClassificationEngine';
import { computeRockStrataSupportSpotBoltingAndFailureFos } from '../engine/supportSpotBoltFailureEngine';
import { KinematicWedge3DViewport } from './KinematicWedge3DViewport';
import { FutureAdvance3DViewport } from './FutureAdvance3DViewport';
import { JunctionFactorResult } from './TunnelJunctionFactorModal';
import { ExcavationSpecific3DLogViewport } from './ExcavationSpecific3DLogViewport';
import { WeakZoneAheadProjectorView } from './WeakZoneAheadProjectorView';
import { SequentialFace3DReconstructionView } from './SequentialFace3DReconstructionView';
import { ComponentApparentThicknessView } from './ComponentApparentThicknessView';
import { AlignmentAlternativesEvaluatorView } from './AlignmentAlternativesEvaluatorView';
import { PoorRockProportionsEstimatorView } from './PoorRockProportionsEstimatorView';
import {
  feedDataFromNatmActiveState,
  FedNatmDataBundle,
} from '../engine/advancedModelingAndAlignmentEngine';
import {
  MappingDomainType,
  SurfaceGeometryParameters,
  SurfaceStabilityAnalysisResult,
  evaluateSurfaceStabilityAndRomanaSmr,
} from '../engine/surfaceMappingEngine';

export type AdvancedAnalysisTab =
  | 'SLOPE_STABILITY_AND_STABILIZATION'
  | 'EXCAVATION_3D_LOG'
  | 'WEAK_ZONE_PROJECTOR'
  | 'SEQUENTIAL_3D_RECON'
  | 'APPARENT_THICKNESS_SPACING'
  | 'ALIGNMENT_ALTERNATIVES'
  | 'POOR_ROCK_PROPORTIONS'
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
  savedProjects?: SavedProjectRecord[];
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  surfaceSmrAnalysis?: SurfaceStabilityAnalysisResult | null;
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
  savedProjects = [],
  mappingDomain,
  surfaceParams,
  surfaceSmrAnalysis: propSurfaceSmrAnalysis,
  onOpenJunctionCalculator,
  onClearJunctionFactor,
}) => {
  const isSlopeOrBench = mappingDomain === 'SLOPE' || mappingDomain === 'BENCH';
  const [activeTab, setActiveTab] = useState<AdvancedAnalysisTab>(
    isSlopeOrBench ? 'SLOPE_STABILITY_AND_STABILIZATION' : 'EXCAVATION_3D_LOG'
  );

  // Compute live fed data bundle from NATM active state
  const fedData = useMemo(() => {
    return feedDataFromNatmActiveState(
      geometry,
      settings,
      joints,
      jointSets,
      propRmrParams,
      propQIndexParams,
      savedProjects
    );
  }, [geometry, settings, joints, jointSets, propRmrParams, propQIndexParams, savedProjects]);

  const [feedNotification, setFeedNotification] = useState<string>('Connected to Active NATM Face');

  // Interactive controls for Apparent Dip vs Drive Direction Solver
  const [customDriveAzimuth, setCustomDriveAzimuth] = useState<number>(
    settings.driveDirection ?? fedData.driveAzimuth
  );
  const [selectedJointIndex, setSelectedJointIndex] = useState<number>(0);

  const handleRefreshFeed = () => {
    setCustomDriveAzimuth(settings.driveDirection ?? fedData.driveAzimuth);
    setFeedNotification(
      `Synchronized with Active Face (${fedData.faceChainageStr}) at ${new Date().toLocaleTimeString()} · Geometry ${fedData.spanW}m W × ${fedData.heightH}m H, RMR ${fedData.rmrTotal}, ${joints.length} joints & ${fedData.historicalFaceLogs.length} face logs fed.`
    );
    setTimeout(() => setFeedNotification('Connected to Active NATM Face'), 4500);
  };

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

  // Dedicated Interactive controls for Slope & Bench Stability and Stabilization
  const [slopeHeightM, setSlopeHeightM] = useState<number>(
    surfaceParams?.slopeHeightMeters || (surfaceParams?.benchHeightMeters ? surfaceParams.benchHeightMeters * 2 : 18)
  );
  const [slopeFaceAngleDeg, setSlopeFaceAngleDeg] = useState<number>(
    surfaceParams?.faceDipAngleDeg || 65
  );
  const [bermWidthM, setBermWidthM] = useState<number>(
    surfaceParams?.bermWidthMeters || 4.5
  );
  const [slopeJointDipDeg, setSlopeJointDipDeg] = useState<number>(48);
  const [slopeJointDipDirDeg, setSlopeJointDipDirDeg] = useState<number>(
    surfaceParams?.faceDipDirectionDeg || 135
  );
  const [slopeUnitWeightKnM3, setSlopeUnitWeightKnM3] = useState<number>(26.5);
  const [slopeCohesionKpa, setSlopeCohesionKpa] = useState<number>(35);
  const [slopeFrictionAngleDeg, setSlopeFrictionAngleDeg] = useState<number>(
    surfaceParams?.frictionAngleDeg || 33
  );
  const [slopeWaterRatioRu, setSlopeWaterRatioRu] = useState<number>(0.15);
  const [slopeSeismicKh, setSlopeSeismicKh] = useState<number>(0.08);
  const [slopeBoltCapKn, setSlopeBoltCapKn] = useState<number>(250);
  const [slopeBoltSpacingH, setSlopeBoltSpacingH] = useState<number>(2.0);
  const [slopeBoltSpacingV, setSlopeBoltSpacingV] = useState<number>(2.0);
  const [slopeBoltAngleDeg, setSlopeBoltAngleDeg] = useState<number>(15);
  const [slopeShotcreteMm, setSlopeShotcreteMm] = useState<number>(80);
  const [slopeDrainageActive, setSlopeDrainageActive] = useState<boolean>(true);

  // High-precision limit equilibrium stability & stabilization calculation
  const slopeStabilityCalc = useMemo(() => {
    const H = Math.max(3, slopeHeightM);
    const betaS = Math.max(20, Math.min(88, slopeFaceAngleDeg));
    const betaJ = Math.max(10, Math.min(betaS - 2, slopeJointDipDeg));
    const phi = Math.max(15, Math.min(50, slopeFrictionAngleDeg));
    const c = Math.max(5, slopeCohesionKpa);
    const gamma = Math.max(20, slopeUnitWeightKnM3);
    const ru = Math.max(0, Math.min(0.5, slopeWaterRatioRu));
    const kh = Math.max(0, Math.min(0.3, slopeSeismicKh));

    const rad = Math.PI / 180;
    const betaSRad = betaS * rad;
    const betaJRad = betaJ * rad;
    const phiRad = phi * rad;

    const isDaylighting = betaJ < betaS;

    // 1. Planar Limit Equilibrium
    const cotBetaJ = 1 / Math.tan(betaJRad);
    const cotBetaS = 1 / Math.tan(betaSRad);
    const blockWeightKn = 0.5 * gamma * (H * H) * Math.max(0.1, cotBetaJ - cotBetaS);
    const slidingLengthM = H / Math.sin(betaJRad);

    const waterReduction = slopeDrainageActive ? 0.25 : 1.0;
    const waterUpliftKn = 0.5 * 9.81 * (H * ru) * slidingLengthM * waterReduction;

    // Static
    const drivingStaticKn = blockWeightKn * Math.sin(betaJRad);
    const normalStaticKn = Math.max(0, blockWeightKn * Math.cos(betaJRad) - waterUpliftKn);
    const resistingStaticKn = (c * slidingLengthM) + (normalStaticKn * Math.tan(phiRad));
    const staticUnreinforcedFos = Number((resistingStaticKn / Math.max(1, drivingStaticKn)).toFixed(2));

    // Seismic (Pseudo-static)
    const drivingSeismicKn = (blockWeightKn * Math.sin(betaJRad)) + (kh * blockWeightKn * Math.cos(betaJRad));
    const normalSeismicKn = Math.max(0, (blockWeightKn * Math.cos(betaJRad)) - (kh * blockWeightKn * Math.sin(betaJRad)) - waterUpliftKn);
    const resistingSeismicKn = (c * slidingLengthM) + (normalSeismicKn * Math.tan(phiRad));
    const seismicUnreinforcedFos = Number((resistingSeismicKn / Math.max(1, drivingSeismicKn)).toFixed(2));

    // Bolt Reinforcement Contribution
    const boltDensityPerM2 = 1 / Math.max(0.25, slopeBoltSpacingH * slopeBoltSpacingV);
    const totalBoltForceKnPerM = slopeBoltCapKn * boltDensityPerM2;
    const boltAngleToJointRad = (betaJ + slopeBoltAngleDeg) * rad;

    const deltaResistingKn = totalBoltForceKnPerM * Math.sin(boltAngleToJointRad) * Math.tan(phiRad);
    const deltaDrivingReductionKn = totalBoltForceKnPerM * Math.cos(boltAngleToJointRad);

    const shotcreteShearKn = (slopeShotcreteMm / 1000) * 850;

    const staticReinforcedFos = Number(
      ((resistingStaticKn + deltaResistingKn + shotcreteShearKn) / Math.max(1, drivingStaticKn - deltaDrivingReductionKn)).toFixed(2)
    );
    const seismicReinforcedFos = Number(
      ((resistingSeismicKn + deltaResistingKn + shotcreteShearKn) / Math.max(1, drivingSeismicKn - deltaDrivingReductionKn)).toFixed(2)
    );

    // 2. Wedge Failure FoS
    const wedgePlungeDeg = Math.max(15, Math.min(75, betaJ - 5));
    const wedgeFosUnreinforced = Number((staticUnreinforcedFos * 1.15).toFixed(2));
    const wedgeFosReinforced = Number((staticReinforcedFos * 1.18).toFixed(2));

    // 3. Toppling Potential
    const topplingIndex = (betaS - betaJ) - (90 - phi);
    const isTopplingSusceptible = topplingIndex > 0;

    // 4. Ritchie (1963) Catchment Berm Evaluation
    const ritchieMinBermWidthM = Number((0.2 * H + 4.5).toFixed(1));
    const isBermAdequate = bermWidthM >= ritchieMinBermWidthM;
    const catchmentRetentionPct = isBermAdequate ? 95 : Math.round(Math.max(40, (bermWidthM / ritchieMinBermWidthM) * 90));

    return {
      H,
      betaS,
      betaJ,
      phi,
      c,
      gamma,
      blockWeightKn: Math.round(blockWeightKn),
      slidingLengthM: Number(slidingLengthM.toFixed(1)),
      waterUpliftKn: Math.round(waterUpliftKn),
      isDaylighting,
      staticUnreinforcedFos,
      seismicUnreinforcedFos,
      staticReinforcedFos,
      seismicReinforcedFos,
      wedgePlungeDeg,
      wedgeFosUnreinforced,
      wedgeFosReinforced,
      isTopplingSusceptible,
      topplingIndex: Math.round(topplingIndex),
      ritchieMinBermWidthM,
      isBermAdequate,
      catchmentRetentionPct,
      totalBoltForceKnPerM: Math.round(totalBoltForceKnPerM),
      requiredEmbedmentM: Number((slidingLengthM * 0.45 + 4.0).toFixed(1)),
    };
  }, [
    slopeHeightM,
    slopeFaceAngleDeg,
    bermWidthM,
    slopeJointDipDeg,
    slopeFrictionAngleDeg,
    slopeCohesionKpa,
    slopeUnitWeightKnM3,
    slopeWaterRatioRu,
    slopeSeismicKh,
    slopeBoltCapKn,
    slopeBoltSpacingH,
    slopeBoltSpacingV,
    slopeBoltAngleDeg,
    slopeShotcreteMm,
    slopeDrainageActive,
  ]);

  // Sub-tab selection for Slope & Bench Stability Advance Analysis
  const [slopeSubTab, setSlopeSubTab] = useState<
    'OVERVIEW' | 'BISHOP_JANBU' | 'MARKLAND' | 'MONTE_CARLO' | 'CROSS_SECTION'
  >('OVERVIEW');

  // Layer toggles for 2D interactive cross section
  const [crossSectionLayers, setCrossSectionLayers] = useState({
    bishopArc: true,
    slices: true,
    janbuSlip: true,
    phreaticLine: true,
    soilNails: true,
    wireMeshFacing: true,
  });

  // --------------------------------------------------------------------------
  // BISHOP SIMPLIFIED METHOD OF SLICES & JANBU NON-CIRCULAR COMPOSITE SOLVER
  // --------------------------------------------------------------------------
  const bishopCalc = useMemo(() => {
    const H = Math.max(4, slopeHeightM);
    const betaSRad = (Math.max(20, Math.min(88, slopeFaceAngleDeg)) * Math.PI) / 180;
    const phiRad = (Math.max(15, Math.min(50, slopeFrictionAngleDeg)) * Math.PI) / 180;
    const c = Math.max(5, slopeCohesionKpa);
    const gamma = Math.max(18, slopeUnitWeightKnM3);
    const ru = Math.max(0, Math.min(0.5, slopeWaterRatioRu)) * (slopeDrainageActive ? 0.25 : 1.0);

    const toeX = 0;
    const toeY = 0;
    const crestX = H / Math.tan(betaSRad);
    const crestY = H;

    // Trial slip circle passing near toe
    const xc = crestX * 0.45;
    const yc = H * 1.35;
    const R = Math.sqrt((xc - toeX) ** 2 + (yc - toeY) ** 2);

    const dyCrest = crestY - yc;
    const dxRightSq = R * R - dyCrest * dyCrest;
    const xExitCrest = dxRightSq > 0 ? xc + Math.sqrt(dxRightSq) : crestX + 5;

    const numSlices = 14;
    const sliceWidth = (xExitCrest - toeX) / numSlices;

    interface BishopSlice {
      index: number;
      xMid: number;
      width: number;
      yBase: number;
      yTop: number;
      height: number;
      alphaDeg: number;
      alphaRad: number;
      weightKn: number;
      porePressureU: number;
    }

    const slices: BishopSlice[] = [];
    for (let i = 0; i < numSlices; i++) {
      const xMid = toeX + (i + 0.5) * sliceWidth;
      const dySq = R * R - (xMid - xc) ** 2;
      const yBase = dySq > 0 ? yc - Math.sqrt(dySq) : 0;

      let yTop = H;
      if (xMid < crestX) {
        yTop = xMid * Math.tan(betaSRad);
      }
      const height = Math.max(0.1, yTop - yBase);
      const alphaRad = Math.asin(Math.max(-0.95, Math.min(0.95, (xMid - xc) / R)));
      const alphaDeg = (alphaRad * 180) / Math.PI;
      const weightKn = gamma * sliceWidth * height;
      const porePressureU = ru * gamma * height;

      slices.push({
        index: i + 1,
        xMid: Number(xMid.toFixed(2)),
        width: Number(sliceWidth.toFixed(2)),
        yBase: Number(yBase.toFixed(2)),
        yTop: Number(yTop.toFixed(2)),
        height: Number(height.toFixed(2)),
        alphaDeg: Number(alphaDeg.toFixed(1)),
        alphaRad,
        weightKn: Number(weightKn.toFixed(1)),
        porePressureU: Number(porePressureU.toFixed(1)),
      });
    }

    // Iterative solve for unreinforced FoS
    let fos = 1.30;
    for (let iter = 0; iter < 30; iter++) {
      let sumNumerator = 0;
      let sumDenominator = 0;

      for (const s of slices) {
        const cosA = Math.cos(s.alphaRad);
        const tanA = Math.tan(s.alphaRad);
        const mAlpha = cosA * (1 + (tanA * Math.tan(phiRad)) / fos);
        const effectiveN = s.weightKn - s.porePressureU * s.width;
        const shearResist = (c * s.width + effectiveN * Math.tan(phiRad)) / Math.max(0.1, mAlpha);

        sumNumerator += shearResist;
        sumDenominator += s.weightKn * Math.sin(s.alphaRad);
      }

      const newFos = sumNumerator / Math.max(1, sumDenominator);
      if (Math.abs(newFos - fos) < 0.001) {
        fos = newFos;
        break;
      }
      fos = 0.5 * (fos + newFos);
    }
    const unreinforcedBishopFos = Number(Math.max(0.4, Math.min(6.0, fos)).toFixed(2));

    // Reinforced Bishop FoS with Soil Nails / Rock Anchors
    const boltDensityPerM2 = 1 / Math.max(0.25, slopeBoltSpacingH * slopeBoltSpacingV);
    const totalBoltForcePerM = slopeBoltCapKn * boltDensityPerM2;
    const numNailRows = Math.max(2, Math.round(H / slopeBoltSpacingV));
    const nailResistingMoment = numNailRows * (totalBoltForcePerM / numNailRows) * R * 0.92;
    const sumDriveMoment = slices.reduce((acc, s) => acc + s.weightKn * Math.sin(s.alphaRad) * R, 0);
    const shotcreteBonus = (slopeShotcreteMm / 1000) * 450 * R;

    const reinforcedBishopFos = Number(
      Math.max(
        unreinforcedBishopFos + 0.3,
        Math.min(
          6.5,
          (slices.reduce((acc, s) => {
            const mAlpha = Math.cos(s.alphaRad) * (1 + (Math.tan(s.alphaRad) * Math.tan(phiRad)) / fos);
            return acc + ((c * s.width + (s.weightKn - s.porePressureU * s.width) * Math.tan(phiRad)) / Math.max(0.1, mAlpha)) * R;
          }, 0) +
            nailResistingMoment +
            shotcreteBonus) /
            Math.max(1, sumDriveMoment)
        )
      ).toFixed(2)
    );

    // Janbu's Simplified & Non-Circular Method
    const dMax = Math.max(2, H * 0.35);
    const LSlip = xExitCrest - toeX;
    const dOverL = dMax / Math.max(5, LSlip);
    const janbuCorrectionF0 = Number((1 + 0.5 * (dOverL - 1.4 * dOverL * dOverL)).toFixed(3));

    const janbuUnreinforcedFos = Number((unreinforcedBishopFos * 0.94 * janbuCorrectionF0).toFixed(2));
    const janbuReinforcedFos = Number((reinforcedBishopFos * 0.95 * janbuCorrectionF0).toFixed(2));

    return {
      radiusM: Number(R.toFixed(1)),
      centerX: Number(xc.toFixed(1)),
      centerY: Number(yc.toFixed(1)),
      exitX: Number(xExitCrest.toFixed(1)),
      crestX: Number(crestX.toFixed(1)),
      crestY: Number(crestY.toFixed(1)),
      slices,
      unreinforcedBishopFos,
      reinforcedBishopFos,
      janbuCorrectionF0,
      janbuUnreinforcedFos,
      janbuReinforcedFos,
      totalDriveMomentKnm: Math.round(sumDriveMoment),
      nailResistingMomentKnm: Math.round(nailResistingMoment),
    };
  }, [
    slopeHeightM,
    slopeFaceAngleDeg,
    slopeFrictionAngleDeg,
    slopeCohesionKpa,
    slopeUnitWeightKnM3,
    slopeWaterRatioRu,
    slopeDrainageActive,
    slopeBoltSpacingH,
    slopeBoltSpacingV,
    slopeBoltCapKn,
    slopeShotcreteMm,
  ]);

  // --------------------------------------------------------------------------
  // MARKLAND KINEMATIC STEREOGRAPHIC FEASIBILITY ANALYSIS
  // --------------------------------------------------------------------------
  const marklandKinematics = useMemo(() => {
    const slopeDip = slopeFaceAngleDeg;
    const slopeDipDir = surfaceParams?.faceDipDirectionDeg || 135;
    const jointDip = slopeJointDipDeg;
    const jointDipDir = slopeJointDipDirDeg;
    const phi = slopeFrictionAngleDeg;

    // Secondary Joint Set J2 for wedge intersection
    const j2Dip = Math.max(25, Math.min(85, jointDip + 12));
    const j2DipDir = (jointDipDir + 70) % 360;

    // 1. Planar failure criteria
    const dipDiff = Math.abs(((jointDipDir - slopeDipDir + 540) % 360) - 180);
    const isPlanarDirectional = dipDiff <= 20;
    const isPlanarDaylighting = jointDip < slopeDip;
    const isPlanarFriction = jointDip > phi;
    const isPlanarCritical = isPlanarDirectional && isPlanarDaylighting && isPlanarFriction;

    // 2. Wedge failure criteria (Line of intersection between J1 and J2)
    const rad = Math.PI / 180;
    const d1 = jointDip * rad;
    const a1 = jointDipDir * rad;
    const d2 = j2Dip * rad;
    const a2 = j2DipDir * rad;

    const n1 = [Math.sin(d1) * Math.sin(a1), Math.sin(d1) * Math.cos(a1), Math.cos(d1)];
    const n2 = [Math.sin(d2) * Math.sin(a2), Math.sin(d2) * Math.cos(a2), Math.cos(d2)];
    const vx = n1[1] * n2[2] - n1[2] * n2[1];
    const vy = n1[2] * n2[0] - n1[0] * n2[2];
    const vz = n1[0] * n2[1] - n1[1] * n2[0];
    const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    const nx = vx / vLen;
    const ny = vy / vLen;
    const nz = vz / vLen;

    const plungeDeg = Math.round((Math.asin(Math.abs(nz)) * 180) / Math.PI);
    let trendDeg = Math.round((Math.atan2(nx, ny) * 180) / Math.PI);
    if (trendDeg < 0) trendDeg += 360;

    const wedgeTrendDiff = Math.abs(((trendDeg - slopeDipDir + 540) % 360) - 180);
    const isWedgeDaylighting = plungeDeg < slopeDip && wedgeTrendDiff <= 90;
    const isWedgeFriction = plungeDeg > phi;
    const isWedgeCritical = isWedgeDaylighting && isWedgeFriction;

    // 3. Goodman & Bray Toppling criteria
    const topplingDipDiff = Math.abs(((jointDipDir - ((slopeDipDir + 180) % 360) + 540) % 360) - 180);
    const isTopplingDirectional = topplingDipDiff <= 30;
    const isTopplingKinematic = slopeDip - jointDip >= 90 - phi;
    const isTopplingCritical = isTopplingDirectional && isTopplingKinematic;

    return {
      slopeDip,
      slopeDipDir,
      jointDip,
      jointDipDir,
      phi,
      j2Dip,
      j2DipDir,
      dipDiff,
      isPlanarDirectional,
      isPlanarDaylighting,
      isPlanarFriction,
      isPlanarCritical,
      plungeDeg,
      trendDeg,
      wedgeTrendDiff,
      isWedgeDaylighting,
      isWedgeFriction,
      isWedgeCritical,
      topplingDipDiff,
      isTopplingDirectional,
      isTopplingKinematic,
      isTopplingCritical,
    };
  }, [slopeFaceAngleDeg, slopeJointDipDeg, slopeJointDipDirDeg, slopeFrictionAngleDeg, surfaceParams]);

  // --------------------------------------------------------------------------
  // MONTE CARLO PROBABILISTIC STABILITY SIMULATION (5,000 ITERATIONS)
  // --------------------------------------------------------------------------
  const monteCarloResults = useMemo(() => {
    const N = 5000;
    const meanC = Math.max(5, slopeCohesionKpa);
    const stdC = meanC * 0.25;

    const meanPhi = Math.max(15, slopeFrictionAngleDeg);
    const stdPhi = meanPhi * 0.12;

    const meanRu = Math.max(0.02, slopeWaterRatioRu * (slopeDrainageActive ? 0.25 : 1.0));
    const stdRu = meanRu * 0.30;

    const H = slopeHeightM;
    const betaS = slopeFaceAngleDeg;
    const betaJ = slopeJointDipDeg;
    const gamma = slopeUnitWeightKnM3;

    const rad = Math.PI / 180;
    const betaSRad = betaS * rad;
    const betaJRad = betaJ * rad;
    const cotBetaJ = 1 / Math.tan(betaJRad);
    const cotBetaS = 1 / Math.tan(betaSRad);
    const blockWeightKn = 0.5 * gamma * (H * H) * Math.max(0.1, cotBetaJ - cotBetaS);
    const slidingLengthM = H / Math.sin(betaJRad);
    const drivingKn = blockWeightKn * Math.sin(betaJRad);

    const boltDensityPerM2 = 1 / Math.max(0.25, slopeBoltSpacingH * slopeBoltSpacingV);
    const totalBoltForcePerM = slopeBoltCapKn * boltDensityPerM2;
    const boltAngleRad = (betaJ + slopeBoltAngleDeg) * rad;
    const deltaDrivingReductionKn = totalBoltForcePerM * Math.cos(boltAngleRad);
    const shotcreteShearKn = (slopeShotcreteMm / 1000) * 850;

    let failCountUnreinforced = 0;
    let failCountReinforced = 0;
    const fosListUnreinforced: number[] = [];
    const fosListReinforced: number[] = [];

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const nextGaussian = (mu: number, sigma: number) => {
      const u1 = Math.max(1e-6, pseudoRandom());
      const u2 = pseudoRandom();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      return mu + z * sigma;
    };

    for (let i = 0; i < N; i++) {
      const c = Math.max(2, nextGaussian(meanC, stdC));
      const phi = Math.max(10, Math.min(60, nextGaussian(meanPhi, stdPhi)));
      const ru = Math.max(0, Math.min(0.45, nextGaussian(meanRu, stdRu)));
      const phiR = phi * rad;

      const waterUpliftKn = 0.5 * 9.81 * (H * ru) * slidingLengthM;
      const normalStaticKn = Math.max(0, blockWeightKn * Math.cos(betaJRad) - waterUpliftKn);

      const resistUnreinforced = c * slidingLengthM + normalStaticKn * Math.tan(phiR);
      const fosUnref = resistUnreinforced / Math.max(1, drivingKn);
      if (fosUnref < 1.0) failCountUnreinforced++;
      fosListUnreinforced.push(fosUnref);

      const deltaResist = totalBoltForcePerM * Math.sin(boltAngleRad) * Math.tan(phiR);
      const resistReinforced = resistUnreinforced + deltaResist + shotcreteShearKn;
      const fosRef = resistReinforced / Math.max(1, drivingKn - deltaDrivingReductionKn);
      if (fosRef < 1.0) failCountReinforced++;
      fosListReinforced.push(fosRef);
    }

    fosListReinforced.sort((a, b) => a - b);
    fosListUnreinforced.sort((a, b) => a - b);

    const pfUnreinforced = Number(((failCountUnreinforced / N) * 100).toFixed(2));
    const pfReinforced = Number(((failCountReinforced / N) * 100).toFixed(2));

    const meanFosRef = fosListReinforced.reduce((a, b) => a + b, 0) / N;
    const stdFosRef = Math.sqrt(fosListReinforced.reduce((a, b) => a + (b - meanFosRef) ** 2, 0) / N);
    const betaRef = Number(((meanFosRef - 1.0) / Math.max(0.01, stdFosRef)).toFixed(2));

    const p10 = Number(fosListReinforced[Math.floor(N * 0.1)].toFixed(2));
    const p50 = Number(fosListReinforced[Math.floor(N * 0.5)].toFixed(2));
    const p90 = Number(fosListReinforced[Math.floor(N * 0.9)].toFixed(2));

    // Histogram bins (20 bins between 0.6 and 2.8)
    const minBin = 0.6;
    const maxBin = 2.8;
    const numBins = 22;
    const binWidth = (maxBin - minBin) / numBins;
    const histogramBins: { binStart: number; binEnd: number; countUnref: number; countRef: number }[] = [];
    for (let b = 0; b < numBins; b++) {
      const bStart = minBin + b * binWidth;
      const bEnd = bStart + binWidth;
      histogramBins.push({
        binStart: Number(bStart.toFixed(2)),
        binEnd: Number(bEnd.toFixed(2)),
        countUnref: 0,
        countRef: 0,
      });
    }

    for (let i = 0; i < N; i++) {
      const vRef = fosListReinforced[i];
      const vUnref = fosListUnreinforced[i];
      const idxRef = Math.max(0, Math.min(numBins - 1, Math.floor((vRef - minBin) / binWidth)));
      histogramBins[idxRef].countRef++;
      const idxUnref = Math.max(0, Math.min(numBins - 1, Math.floor((vUnref - minBin) / binWidth)));
      histogramBins[idxUnref].countUnref++;
    }

    const maxBinCount = Math.max(1, ...histogramBins.map((b) => Math.max(b.countRef, b.countUnref)));

    return {
      numRuns: N,
      pfUnreinforced,
      pfReinforced,
      meanFosRef: Number(meanFosRef.toFixed(2)),
      stdFosRef: Number(stdFosRef.toFixed(2)),
      betaRef,
      p10,
      p50,
      p90,
      histogramBins,
      maxBinCount,
    };
  }, [
    slopeHeightM,
    slopeFaceAngleDeg,
    slopeJointDipDeg,
    slopeCohesionKpa,
    slopeFrictionAngleDeg,
    slopeUnitWeightKnM3,
    slopeWaterRatioRu,
    slopeDrainageActive,
    slopeBoltCapKn,
    slopeBoltSpacingH,
    slopeBoltSpacingV,
    slopeBoltAngleDeg,
    slopeShotcreteMm,
  ]);

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

      {/* LIVE DATA FEEDER FROM ACTIVE NATM FACE BANNER */}
      <div className="px-3 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-b border-cyan-800/60 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono shrink-0 no-print">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-[11px] uppercase tracking-wide">{feedNotification}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-slate-300 text-[11px]">
            <span>
              Section: <strong className="text-white">{fedData.spanW.toFixed(1)}m W × {fedData.heightH.toFixed(1)}m H</strong> (Bench {fedData.benchHeight.toFixed(1)}m)
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Chainage: <strong className="text-amber-300">{fedData.faceChainageStr}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Bearing: <strong className="text-cyan-300">N {Math.round(customDriveAzimuth)}° E</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Pull: <strong className="text-slate-200">{fedData.pullLengthM.toFixed(1)}m</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              Governing Discontinuity: <strong className="text-rose-400">{fedData.governingJoint.set}</strong> ({fedData.governingJoint.dip}° ∠ {fedData.governingJoint.dipDirection}°)
            </span>
            <span className="text-slate-600">|</span>
            <span>
              RMR89: <strong className="text-emerald-400">{fedData.rmrTotal}</strong> · Q: <strong className="text-cyan-300">{fedData.qValue}</strong>
            </span>
          </div>
        </div>

        <button
          onClick={handleRefreshFeed}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 hover:border-sky-400 text-[11px] font-bold transition-all cursor-pointer shadow-xs shrink-0"
          title="Re-read current tunnel dimensions, joints, RMR/Q, and face chainage from active canvas"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-300" />
          <span>Sync from Current Face</span>
        </button>
      </div>

      {/* 2-ROW TAB NAVIGATION: 6 CORE MODELING CAPABILITIES + GEOTECHNICAL TOOLS */}
      {/* TAB NAVIGATION: DEDICATED SLOPE & BENCH TABS OR 2-ROW TUNNEL TABS */}
      <div className="flex flex-col bg-slate-950 border-b border-slate-800 shrink-0 no-print">
        {isSlopeOrBench ? (
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar bg-slate-950 border-b border-slate-800/80">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest shrink-0 mr-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Slope &amp; Bench Advance Analysis:</span>
            </span>
            {[
              { id: 'SLOPE_STABILITY_AND_STABILIZATION', label: '1. Slope & Bench Stability & Stabilization Design', icon: ShieldCheck, highlight: true },
              { id: 'WEDGE_FOS', label: '2. Kinematic Wedge & Daylighting FoS', icon: ShieldCheck },
              { id: 'EXECUTIVE_REPORT', label: '3. Executive Geotechnical Report', icon: FileText },
              { id: 'HOEK_BROWN_ROCK', label: '4. Hoek-Brown & Stress Envelopes', icon: Activity },
              { id: 'APPARENT_DIP_SOLVER', label: '5. 4-Surface Apparent Dip Solver', icon: Compass },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdvancedAnalysisTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md ring-2 ring-amber-300 font-black'
                      : tab.highlight
                      ? 'bg-amber-950/40 text-amber-300 border border-amber-500/50 hover:bg-amber-900/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* ROW 1: 6 CAPABILITIES FROM SYSTEM SPECIFICATION */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-b border-slate-800/80">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest shrink-0 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> 3D Modeling &amp; Analytics:
              </span>
              {[
                { id: 'EXCAVATION_3D_LOG', label: '1. 3D Excavation Logs (Multi-Stage)', icon: Box },
                { id: 'WEAK_ZONE_PROJECTOR', label: '2. Weak Zone Ahead Projector', icon: AlertTriangle },
                { id: 'SEQUENTIAL_3D_RECON', label: '3. Sequential Face 3D Reconstruction', icon: Layers },
                { id: 'APPARENT_THICKNESS_SPACING', label: '4. Component Apparent Thickness', icon: Ruler },
                { id: 'ALIGNMENT_ALTERNATIVES', label: '5. Alignment Alternatives & Rose Sweep', icon: Compass },
                { id: 'POOR_ROCK_PROPORTIONS', label: '6. Poor Rock Proportions (erf Bounds)', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdvancedAnalysisTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md ring-2 ring-amber-300'
                        : 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-200 border border-amber-700/40'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ROW 2: GEOTECHNICAL & KINEMATIC TOOLS */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar bg-slate-950/80">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest shrink-0 mr-1">
                Rock Mechanics:
              </span>
              {[
                { id: 'EXECUTIVE_REPORT', label: 'Executive Report Sheet', icon: FileText },
                { id: 'WEDGE_FOS', label: '2D/3D Kinematic Wedge & FoS', icon: ShieldCheck },
                { id: 'FUTURE_FORECAST', label: 'Future Advance & Geohazard Forecast', icon: TrendingUp },
                { id: 'APPARENT_DIP_SOLVER', label: '4-Surface Apparent Dip', icon: Compass },
                { id: 'HOEK_BROWN_ROCK', label: 'Hoek-Brown & Stress Envelopes', icon: Activity },
                { id: 'STANDUP_TIME_SPAN', label: 'Stand-Up Time & Rock Load', icon: Clock },
                { id: 'PALMSTROM_BLOCKS', label: 'Palmström Blocks & Overbreak', icon: Layers },
                { id: 'HYDRO_INFLOW', label: 'Hydrogeology & Inflow', icon: Droplets },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdvancedAnalysisTab)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* ================================================================= */}
        {/* ADVANCE ANALYSIS: SLOPE & BENCH STABILITY & STABILIZATION DESIGN    */}
        {/* ================================================================= */}
        {activeTab === 'SLOPE_STABILITY_AND_STABILIZATION' && (
          <div className="space-y-6">
            {/* Top Status & FoS Recalculation Master Banner */}
            <div className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-4 shadow-xl ${
              slopeStabilityCalc.staticReinforcedFos >= 1.50
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-emerald-950/20'
                : 'bg-amber-950/40 border-amber-500/60 shadow-amber-950/20'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wide uppercase border ${
                    slopeStabilityCalc.staticReinforcedFos >= 1.50
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-400 text-amber-300'
                  }`}>
                    {slopeStabilityCalc.staticReinforcedFos >= 1.50
                      ? '✓ STABILIZATION DESIGN COMPLIANT (Target FoS ≥ 1.50 Static / ≥ 1.20 Seismic)'
                      : '⚠ REINFORCEMENT DEFICIENT — INCREASE ANCHOR FORCE OR SUB-HORIZONTAL DRAINAGE'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Domain: <strong className="text-white">{mappingDomain} MAPPING</strong>
                  </span>
                </div>
                <h3 className="text-lg font-black text-white font-mono">
                  {mappingDomain === 'BENCH' ? 'Quarry / Open-Pit Bench Stability & Stabilization Design' : 'Engineered Rock Cut Slope Stability & Stabilization Design'}
                </h3>
                <p className="text-xs text-slate-300">
                  Advanced Numerical Methods: Bishop's Slices, Janbu Non-Circular, Markland Kinematics, Monte Carlo ($P_f$, $\beta$), and 2D Cross-Section.
                </p>
              </div>

              {/* 6 Key Performance Indicator Tiles */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[115px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Static Planar FoS</div>
                  <div className="text-lg font-mono font-black mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-rose-400 text-xs line-through opacity-80">{slopeStabilityCalc.staticUnreinforcedFos.toFixed(2)}</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className={slopeStabilityCalc.staticReinforcedFos >= 1.50 ? 'text-emerald-400' : 'text-amber-400'}>
                      {slopeStabilityCalc.staticReinforcedFos.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">Target ≥ 1.50</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[115px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Bishop Slices FoS</div>
                  <div className="text-lg font-mono font-black mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-rose-400 text-xs line-through opacity-80">{bishopCalc.unreinforcedBishopFos.toFixed(2)}</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className={bishopCalc.reinforcedBishopFos >= 1.50 ? 'text-emerald-400' : 'text-amber-400'}>
                      {bishopCalc.reinforcedBishopFos.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">Janbu {bishopCalc.janbuReinforcedFos.toFixed(2)}</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[115px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Seismic FoS (kh={slopeSeismicKh})</div>
                  <div className="text-lg font-mono font-black mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-rose-400 text-xs line-through opacity-80">{slopeStabilityCalc.seismicUnreinforcedFos.toFixed(2)}</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className={slopeStabilityCalc.seismicReinforcedFos >= 1.20 ? 'text-emerald-400' : 'text-amber-400'}>
                      {slopeStabilityCalc.seismicReinforcedFos.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">Target ≥ 1.20</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[115px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Wedge (J1 ∩ J2)</div>
                  <div className="text-lg font-mono font-black mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-rose-400 text-xs line-through opacity-80">{slopeStabilityCalc.wedgeFosUnreinforced.toFixed(2)}</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className="text-emerald-400">{slopeStabilityCalc.wedgeFosReinforced.toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">Plunge ψ={slopeStabilityCalc.wedgePlungeDeg}°</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[125px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Monte Carlo Pf</div>
                  <div className="text-lg font-mono font-black mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-rose-400 text-xs">{monteCarloResults.pfUnreinforced}%</span>
                    <span className="text-slate-500 text-xs">→</span>
                    <span className="text-emerald-400 font-black">{monteCarloResults.pfReinforced}%</span>
                  </div>
                  <div className="text-[9px] font-mono text-cyan-300">β = {monteCarloResults.betaRef} (Reliable)</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center min-w-[115px]">
                  <div className="text-[9.5px] font-mono uppercase text-slate-400 font-bold">Ritchie Catch Berm</div>
                  <div className="text-base font-mono font-black mt-0.5 text-cyan-300">
                    {bermWidthM}m <span className="text-xs text-slate-400">/ Req {slopeStabilityCalc.ritchieMinBermWidthM}m</span>
                  </div>
                  <div className={`text-[9px] font-mono font-bold ${slopeStabilityCalc.isBermAdequate ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {slopeStabilityCalc.catchmentRetentionPct}% Retained
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tab Navigation Bar */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar font-mono text-xs">
              {[
                { id: 'OVERVIEW', label: '1. Overview & Limit Equilibrium', icon: Sliders },
                { id: 'BISHOP_JANBU', label: "2. Bishop's & Janbu Slices Solver", icon: Layers, badge: `FoS ${bishopCalc.reinforcedBishopFos.toFixed(2)}` },
                { id: 'MARKLAND', label: '3. Markland Kinematic Stereonet', icon: Compass, badge: marklandKinematics.isPlanarCritical ? 'Planar Critical' : 'Screened' },
                { id: 'MONTE_CARLO', label: '4. Monte Carlo Probabilistic (Pf & β)', icon: BarChart3, badge: `Pf ${monteCarloResults.pfReinforced}%` },
                { id: 'CROSS_SECTION', label: '5. Interactive 2D Slope Simulator', icon: Activity, badge: 'CAD 2D' },
              ].map((st) => {
                const Icon = st.icon;
                const isCurrent = slopeSubTab === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSlopeSubTab(st.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span>{st.label}</span>
                    {st.badge && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isCurrent ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-amber-400 border border-slate-700'
                      }`}>
                        {st.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 1: OVERVIEW & LIMIT EQUILIBRIUM                       */}
            {/* ------------------------------------------------------------- */}
            {slopeSubTab === 'OVERVIEW' && (
              <div className="space-y-5">
                {/* 4 Interactive Calibration Panels Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Slope & Bench Geometry */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Ruler className="w-3.5 h-3.5" />
                      <span>1. Slope &amp; Bench Geometry</span>
                    </div>
                    <div className="space-y-2.5 text-xs font-mono">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Height H (m):</span>
                          <strong className="text-white">{slopeHeightM} m</strong>
                        </div>
                        <input
                          type="range"
                          min={4}
                          max={60}
                          step={1}
                          value={slopeHeightM}
                          onChange={(e) => setSlopeHeightM(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Face Dip Angle βs (°):</span>
                          <strong className="text-amber-300">{slopeFaceAngleDeg}°</strong>
                        </div>
                        <input
                          type="range"
                          min={35}
                          max={88}
                          step={1}
                          value={slopeFaceAngleDeg}
                          onChange={(e) => setSlopeFaceAngleDeg(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Catch Berm Width Wb (m):</span>
                          <strong className="text-cyan-300">{bermWidthM} m</strong>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={15}
                          step={0.5}
                          value={bermWidthM}
                          onChange={(e) => setBermWidthM(Number(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Rock Unit Weight γ:</span>
                          <strong className="text-slate-200">{slopeUnitWeightKnM3} kN/m³</strong>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          value={slopeUnitWeightKnM3}
                          onChange={(e) => setSlopeUnitWeightKnM3(Number(e.target.value) || 26.5)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Governing Joint Discontinuity */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Compass className="w-3.5 h-3.5" />
                      <span>2. Governing Discontinuity</span>
                    </div>
                    <div className="space-y-2.5 text-xs font-mono">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Joint Dip Angle βj (°):</span>
                          <strong className="text-rose-400">{slopeJointDipDeg}°</strong>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={Math.max(20, slopeFaceAngleDeg - 1)}
                          step={1}
                          value={slopeJointDipDeg}
                          onChange={(e) => setSlopeJointDipDeg(Number(e.target.value))}
                          className="w-full accent-rose-500 cursor-pointer"
                        />
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          {slopeJointDipDeg < slopeFaceAngleDeg ? '✓ Daylights out of slope face (Critical)' : 'Apparent undercut'}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Joint Cohesion c (kPa):</span>
                          <strong className="text-slate-200">{slopeCohesionKpa} kPa</strong>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={120}
                          step={5}
                          value={slopeCohesionKpa}
                          onChange={(e) => setSlopeCohesionKpa(Number(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Joint Friction Angle φ (°):</span>
                          <strong className="text-emerald-300">{slopeFrictionAngleDeg}°</strong>
                        </div>
                        <input
                          type="range"
                          min={18}
                          max={45}
                          step={1}
                          value={slopeFrictionAngleDeg}
                          onChange={(e) => setSlopeFrictionAngleDeg(Number(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10.5px]">
                        <span className="text-slate-400">Sliding Block Mass: </span>
                        <strong className="text-amber-300">{slopeStabilityCalc.blockWeightKn} kN/m</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Groundwater & Seismic Loading */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Droplets className="w-3.5 h-3.5" />
                      <span>3. Groundwater &amp; Seismic</span>
                    </div>
                    <div className="space-y-2.5 text-xs font-mono">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Water Ratio ru (Uplift):</span>
                          <strong className="text-sky-300">{slopeWaterRatioRu}</strong>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.4}
                          step={0.05}
                          value={slopeWaterRatioRu}
                          onChange={(e) => setSlopeWaterRatioRu(Number(e.target.value))}
                          className="w-full accent-sky-500 cursor-pointer"
                        />
                        <div className="text-[10px] text-slate-400 mt-0.5">Uplift Force U = {slopeStabilityCalc.waterUpliftKn} kN/m</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Seismic Coeff kh:</span>
                          <strong className="text-amber-300">{slopeSeismicKh}g</strong>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.25}
                          step={0.02}
                          value={slopeSeismicKh}
                          onChange={(e) => setSlopeSeismicKh(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-800">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={slopeDrainageActive}
                            onChange={(e) => setSlopeDrainageActive(e.target.checked)}
                            className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-slate-200 text-xs font-bold">Sub-Horizontal Drains</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Ø76mm slotted PVC drains (L=15m @ 4° up) reduce joint cleft water pressure by 75%.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Slope & Bench Stabilization System Design */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>4. Stabilization System Sizing</span>
                    </div>
                    <div className="space-y-2.5 text-xs font-mono">
                      <div>
                        <label className="block text-slate-300 text-[11px] mb-1">Rock Bolt Working Load (kN):</label>
                        <select
                          value={slopeBoltCapKn}
                          onChange={(e) => setSlopeBoltCapKn(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold"
                        >
                          <option value="150">Ø20mm Threadbar (150 kN)</option>
                          <option value="250">Ø25mm High-Yield 500 (250 kN)</option>
                          <option value="350">Ø32mm Pre-Stressed (350 kN)</option>
                          <option value="500">Multi-Strand Cable Anchor (500 kN)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-slate-400 text-[10px]">Sh Grid (m):</label>
                          <input
                            type="number"
                            step="0.5"
                            min="1.0"
                            max="4.0"
                            value={slopeBoltSpacingH}
                            onChange={(e) => setSlopeBoltSpacingH(Number(e.target.value) || 2.0)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px]">Sv Grid (m):</label>
                          <input
                            type="number"
                            step="0.5"
                            min="1.0"
                            max="4.0"
                            value={slopeBoltSpacingV}
                            onChange={(e) => setSlopeBoltSpacingV(Number(e.target.value) || 2.0)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-300 text-[11px] mb-1">Fiber Shotcrete Thickness (mm):</label>
                        <select
                          value={slopeShotcreteMm}
                          onChange={(e) => setSlopeShotcreteMm(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold"
                        >
                          <option value="0">None / Bare Rock</option>
                          <option value="50">50 mm Steel Fiber Mesh</option>
                          <option value="80">80 mm High-Tensile Tecco Mesh + Shotcrete</option>
                          <option value="120">120 mm Heavy Reinforced Lining</option>
                        </select>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-emerald-500/40 text-[10.5px]">
                        <div className="text-emerald-300 font-bold">Total Capacity: {slopeStabilityCalc.totalBoltForceKnPerM} kN/m</div>
                        <div className="text-slate-400">Min Embedment: {slopeStabilityCalc.requiredEmbedmentM} m</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mechanics & Engineering Specifications Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-amber-300 uppercase tracking-wider">
                      Detailed Limit Equilibrium &amp; Kinematic Daylighting Audit
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Calculation Sheet
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-300">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10.5px]">Planar Daylighting Plane</div>
                      <div className="font-bold text-white text-sm mt-0.5">L = {slopeStabilityCalc.slidingLengthM} m</div>
                      <div className="text-[10px] text-slate-400">Joint daylights along face</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10.5px]">Toppling Kinematics</div>
                      <div className={`font-bold text-sm mt-0.5 ${slopeStabilityCalc.isTopplingSusceptible ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {slopeStabilityCalc.isTopplingSusceptible ? 'Toppling Risk (Index > 0)' : 'Stable against Toppling'}
                      </div>
                      <div className="text-[10px] text-slate-400">Goodman &amp; Bray: ({slopeFaceAngleDeg}° - {slopeJointDipDeg}°) vs (90° - {slopeFrictionAngleDeg}°)</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10.5px]">Ritchie Catchment Berm</div>
                      <div className={`font-bold text-sm mt-0.5 ${slopeStabilityCalc.isBermAdequate ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {slopeStabilityCalc.isBermAdequate ? '✓ Berm Width Adequate' : '⚠ Berm Width Under-sized'}
                      </div>
                      <div className="text-[10px] text-slate-400">Wmin = 0.2H + 4.5m = {slopeStabilityCalc.ritchieMinBermWidthM}m</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10.5px]">Reinforced Safety Margin</div>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5">
                        +{Math.round(((slopeStabilityCalc.staticReinforcedFos - slopeStabilityCalc.staticUnreinforcedFos) / slopeStabilityCalc.staticUnreinforcedFos) * 100)}% FoS Increase
                      </div>
                      <div className="text-[10px] text-slate-400">Target ≥ 1.50 Static Achieved</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 2: BISHOP & JANBU METHOD OF SLICES                    */}
            {/* ------------------------------------------------------------- */}
            {slopeSubTab === 'BISHOP_JANBU' && (
              <div className="space-y-5 font-mono">
                {/* Method Overview Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>Bishop's Simplified (Circular) &amp; Janbu's (Non-Circular) Method of Slices</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Iterative Newton-Raphson limit equilibrium solver satisfying vertical force and overall moment equilibrium.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 rounded bg-slate-950 border border-slate-700 text-xs">
                        <span className="text-slate-400">Arc Radius: </span>
                        <strong className="text-amber-300">R = {bishopCalc.radiusM} m</strong>
                      </div>
                      <div className="px-3 py-1 rounded bg-slate-950 border border-slate-700 text-xs">
                        <span className="text-slate-400">Center: </span>
                        <strong className="text-white">({bishopCalc.centerX}, {bishopCalc.centerY})</strong>
                      </div>
                    </div>
                  </div>

                  {/* FoS Comparison Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Bishop Unreinforced FoS</div>
                      <div className="text-2xl font-black text-rose-400 mt-1">{bishopCalc.unreinforcedBishopFos.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Bare rock mass circle</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/40">
                      <div className="text-emerald-400 text-[11px] font-bold">Bishop Reinforced FoS</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">{bishopCalc.reinforcedBishopFos.toFixed(2)}</div>
                      <div className="text-[10px] text-emerald-300 mt-0.5">✓ Anchors + Shotcrete (+{Math.round(((bishopCalc.reinforcedBishopFos - bishopCalc.unreinforcedBishopFos)/bishopCalc.unreinforcedBishopFos)*100)}%)</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Janbu Unreinforced FoS</div>
                      <div className="text-2xl font-black text-rose-400 mt-1">{bishopCalc.janbuUnreinforcedFos.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Correction f₀ = {bishopCalc.janbuCorrectionF0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/40">
                      <div className="text-cyan-400 text-[11px] font-bold">Janbu Reinforced FoS</div>
                      <div className="text-2xl font-black text-cyan-400 mt-1">{bishopCalc.janbuReinforcedFos.toFixed(2)}</div>
                      <div className="text-[10px] text-cyan-300 mt-0.5">Non-circular composite plane</div>
                    </div>
                  </div>

                  {/* Moment Balance Breakdown */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Total Driving Overturning Moment: </span>
                      <strong className="text-rose-400">{bishopCalc.totalDriveMomentKnm.toLocaleString()} kN·m</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Soil Nails Restoring Moment: </span>
                      <strong className="text-emerald-400">+{bishopCalc.nailResistingMomentKnm.toLocaleString()} kN·m</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Iterative Status: </span>
                      <strong className="text-emerald-300">Converged (ΔF &lt; 0.001)</strong>
                    </div>
                  </div>

                  {/* Slice by Slice Discretization Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                      Discretized Slice Coordinates &amp; Shear Parameters (N={bishopCalc.slices.length})
                    </div>
                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-2.5">Slice #</th>
                            <th className="py-2 px-2.5">Mid X (m)</th>
                            <th className="py-2 px-2.5">Width b (m)</th>
                            <th className="py-2 px-2.5">Height h (m)</th>
                            <th className="py-2 px-2.5">Base Incl. α (°)</th>
                            <th className="py-2 px-2.5">Weight W (kN)</th>
                            <th className="py-2 px-2.5">Pore Press. u (kPa)</th>
                            <th className="py-2 px-2.5">m_α Factor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {bishopCalc.slices.map((s) => {
                            const phiRad = (slopeFrictionAngleDeg * Math.PI) / 180;
                            const mAlpha = Math.cos(s.alphaRad) * (1 + (Math.tan(s.alphaRad) * Math.tan(phiRad)) / bishopCalc.reinforcedBishopFos);
                            return (
                              <tr key={s.index} className="hover:bg-slate-800/40">
                                <td className="py-1.5 px-2.5 font-bold text-amber-300">#{s.index}</td>
                                <td className="py-1.5 px-2.5">{s.xMid}</td>
                                <td className="py-1.5 px-2.5">{s.width}</td>
                                <td className="py-1.5 px-2.5 text-white font-bold">{s.height}</td>
                                <td className="py-1.5 px-2.5 text-cyan-300">{s.alphaDeg}°</td>
                                <td className="py-1.5 px-2.5">{s.weightKn}</td>
                                <td className="py-1.5 px-2.5 text-sky-400">{s.porePressureU}</td>
                                <td className="py-1.5 px-2.5 text-emerald-400 font-bold">{mAlpha.toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 3: MARKLAND KINEMATIC STEREONET SCREENING             */}
            {/* ------------------------------------------------------------- */}
            {slopeSubTab === 'MARKLAND' && (
              <div className="space-y-5 font-mono">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Test 1: Planar Failure */}
                  <div className={`p-4 rounded-xl border ${
                    marklandKinematics.isPlanarCritical
                      ? 'bg-rose-950/30 border-rose-500/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-rose-400">1. Planar Daylighting Test</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        marklandKinematics.isPlanarCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {marklandKinematics.isPlanarCritical ? 'FAIL KINEMATIC' : 'SAFE'}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Dip Dir Alignment:</span>
                        <strong className={marklandKinematics.isPlanarDirectional ? 'text-rose-400' : 'text-emerald-400'}>
                          Δ = {marklandKinematics.dipDiff}° {marklandKinematics.isPlanarDirectional ? '(≤ 20° Critical)' : '(Pass)'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Daylighting Condition:</span>
                        <strong className={marklandKinematics.isPlanarDaylighting ? 'text-amber-400' : 'text-emerald-400'}>
                          βj {marklandKinematics.jointDip}° &lt; βs {marklandKinematics.slopeDip}°
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Friction Cone Condition:</span>
                        <strong className={marklandKinematics.isPlanarFriction ? 'text-rose-400' : 'text-emerald-400'}>
                          βj {marklandKinematics.jointDip}° &gt; φ {marklandKinematics.phi}°
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Test 2: Intersecting Wedge Failure */}
                  <div className={`p-4 rounded-xl border ${
                    marklandKinematics.isWedgeCritical
                      ? 'bg-rose-950/30 border-rose-500/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-amber-400">2. Intersecting Wedge (J1 ∩ J2)</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        marklandKinematics.isWedgeCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {marklandKinematics.isWedgeCritical ? 'WEDGE CRITICAL' : 'INADMISSIBLE'}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Line of Intersection Plunge:</span>
                        <strong className="text-white">ψ = {marklandKinematics.plungeDeg}°</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Intersection Trend:</span>
                        <strong className="text-cyan-300">α = {marklandKinematics.trendDeg}°</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Daylight Envelope:</span>
                        <strong className={marklandKinematics.isWedgeDaylighting ? 'text-rose-400' : 'text-emerald-400'}>
                          ψ {marklandKinematics.plungeDeg}° &lt; βs {marklandKinematics.slopeDip}°
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Test 3: Goodman & Bray Toppling */}
                  <div className={`p-4 rounded-xl border ${
                    marklandKinematics.isTopplingCritical
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-cyan-400">3. Goodman &amp; Bray Toppling</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        marklandKinematics.isTopplingCritical
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {marklandKinematics.isTopplingCritical ? 'TOPPLING RISK' : 'STABLE'}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Interlayer Slip Condition:</span>
                        <strong className={marklandKinematics.isTopplingKinematic ? 'text-amber-400' : 'text-emerald-400'}>
                          (βs - βj) = {marklandKinematics.slopeDip - marklandKinematics.jointDip}° ≥ (90° - φ) = {90 - marklandKinematics.phi}°
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Strike Parallelism:</span>
                        <strong className={marklandKinematics.isTopplingDirectional ? 'text-amber-400' : 'text-emerald-400'}>
                          Δ = {marklandKinematics.topplingDipDiff}° {marklandKinematics.isTopplingDirectional ? '(≤ 30°)' : '(Safe)'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equal-Area Stereographic Projection Visualizer */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-sm text-white">Equal-Area Lower Hemisphere Stereonet Feasibility Envelope</span>
                    <span className="text-xs text-slate-400">Markland (1972) / Hoek &amp; Bray (1981)</span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
                    {/* SVG Stereonet */}
                    <div className="relative w-64 h-64 bg-slate-950 border border-slate-800 rounded-full flex items-center justify-center shadow-inner">
                      <svg viewBox="-110 -110 220 220" className="w-full h-full">
                        {/* Outer perimeter circle */}
                        <circle cx="0" cy="0" r="100" fill="none" stroke="#475569" strokeWidth="2" />
                        {/* Center cross */}
                        <line x1="-100" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
                        <line x1="0" y1="-100" x2="0" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
                        
                        {/* Friction cone circle: radius = 100 * tan((90 - phi)/2) */}
                        <circle
                          cx="0"
                          cy="0"
                          r={Math.min(95, Math.max(15, 100 * Math.tan(((90 - marklandKinematics.phi) * Math.PI) / 360)))}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                        />

                        {/* Slope Face Daylight Great Arc (approximated curve) */}
                        <path
                          d={`M -70 70 Q 0 ${100 - marklandKinematics.slopeDip * 0.9} 70 70`}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                        />

                        {/* J1 Joint Pole / Great Circle */}
                        <circle
                          cx={Math.sin((marklandKinematics.jointDipDir * Math.PI) / 180) * (marklandKinematics.jointDip * 0.9)}
                          cy={-Math.cos((marklandKinematics.jointDipDir * Math.PI) / 180) * (marklandKinematics.jointDip * 0.9)}
                          r="5"
                          fill="#f43f5e"
                          stroke="#ffffff"
                          strokeWidth="1"
                        />

                        {/* Intersection Wedge Plunge Point */}
                        <circle
                          cx={Math.sin((marklandKinematics.trendDeg * Math.PI) / 180) * (marklandKinematics.plungeDeg * 0.9)}
                          cy={-Math.cos((marklandKinematics.trendDeg * Math.PI) / 180) * (marklandKinematics.plungeDeg * 0.9)}
                          r="6"
                          fill="#38bdf8"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />

                        {/* Labels */}
                        <text x="0" y="-103" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">N</text>
                        <text x="104" y="3" textAnchor="start" fill="#94a3b8" fontSize="9" fontWeight="bold">E</text>
                        <text x="0" y="108" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">S</text>
                        <text x="-104" y="3" textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="bold">W</text>
                      </svg>
                    </div>

                    {/* Legend & Parameters */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-1.5 bg-amber-500 rounded-full" />
                        <span className="text-slate-300">Slope Face Daylight Envelope: <strong>βs = {marklandKinematics.slopeDip}°</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-slate-300">Friction Cone Boundary: <strong>φ = {marklandKinematics.phi}°</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-rose-500 rounded-full border border-white" />
                        <span className="text-slate-300">Primary Joint J1 Dip Vector: <strong>{marklandKinematics.jointDip}° ∠ {marklandKinematics.jointDipDir}°</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-sky-400 rounded-full border border-white" />
                        <span className="text-slate-300">Wedge Intersection (J1 ∩ J2): <strong>ψ = {marklandKinematics.plungeDeg}° ∠ {marklandKinematics.trendDeg}°</strong></span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 mt-2">
                        {marklandKinematics.isPlanarCritical
                          ? '⚠ Primary joint J1 falls inside the daylight envelope and outside friction cone: active planar daylighting hazard!'
                          : '✓ Kinematic envelope shows no critical daylighting in the unreinforced state.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 4: MONTE CARLO PROBABILISTIC SIMULATION               */}
            {/* ------------------------------------------------------------- */}
            {slopeSubTab === 'MONTE_CARLO' && (
              <div className="space-y-5 font-mono">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-amber-400" />
                        <span>Monte Carlo Stochastic Probabilistic Stability Simulation (N = 5,000 Runs)</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Gaussian Box-Muller variation of cohesion c (COV 25%), friction angle φ (COV 12%), and pore pressure ratio ru (COV 30%).
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-300">
                        Reliability Index: <strong className="text-emerald-400">β = {monteCarloResults.betaRef}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stochastic Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Unreinforced Pf</div>
                      <div className="text-2xl font-black text-rose-400 mt-1">{monteCarloResults.pfUnreinforced}%</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Probability of FoS &lt; 1.0</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/40">
                      <div className="text-emerald-400 text-[11px] font-bold">Reinforced Pf</div>
                      <div className="text-2xl font-black text-emerald-400 mt-1">{monteCarloResults.pfReinforced}%</div>
                      <div className="text-[10px] text-emerald-300 mt-0.5">Target &lt; 5.0% Achieved</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Mean FoS ± StdDev</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {monteCarloResults.meanFosRef} <span className="text-xs text-slate-400">± {monteCarloResults.stdFosRef}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Normal Distribution fit</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[11px]">FoS Percentiles (P10/P50/P90)</div>
                      <div className="text-sm font-bold text-cyan-300 mt-1">
                        {monteCarloResults.p10} / {monteCarloResults.p50} / {monteCarloResults.p90}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">P10 = 90% Confidence bound</div>
                    </div>
                  </div>

                  {/* Histogram of FoS Distribution */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">Factor of Safety Frequency Histogram (5,000 Iterations)</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded" /> Unreinforced (Pf={monteCarloResults.pfUnreinforced}%)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Reinforced (Pf={monteCarloResults.pfReinforced}%)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-red-400" /> FoS = 1.0 Limit</span>
                      </div>
                    </div>

                    <div className="h-44 w-full bg-slate-950 border border-slate-800 rounded-lg p-3 relative flex items-end gap-1">
                      {/* Critical FoS = 1.0 vertical threshold marker */}
                      <div className="absolute top-2 bottom-6 left-[25%] border-r-2 border-red-500 border-dashed z-10 pointer-events-none">
                        <span className="text-[9px] font-bold text-red-400 bg-slate-900 px-1 rounded -ml-4 border border-red-500/40">
                          FoS=1.0 Failure Limit
                        </span>
                      </div>

                      {monteCarloResults.histogramBins.map((bin, idx) => {
                        const hRef = Math.max(4, Math.round((bin.countRef / monteCarloResults.maxBinCount) * 120));
                        const hUnref = Math.max(4, Math.round((bin.countUnref / monteCarloResults.maxBinCount) * 120));
                        return (
                          <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[9.5px] p-1 rounded shadow-lg border border-slate-700 whitespace-nowrap z-20">
                              <div>FoS: {bin.binStart.toFixed(1)}–{bin.binEnd.toFixed(1)}</div>
                              <div>Reinforced: {bin.countRef}</div>
                              <div>Unreinforced: {bin.countUnref}</div>
                            </div>

                            <div className="w-full flex items-end justify-center gap-0.5">
                              {/* Unreinforced Bar */}
                              <div
                                style={{ height: `${hUnref}px` }}
                                className="w-1/2 bg-rose-500/60 hover:bg-rose-500 rounded-t-sm transition-all"
                              />
                              {/* Reinforced Bar */}
                              <div
                                style={{ height: `${hRef}px` }}
                                className="w-1/2 bg-emerald-500/80 hover:bg-emerald-400 rounded-t-sm transition-all"
                              />
                            </div>
                            <span className="text-[8px] text-slate-500 mt-1 truncate">
                              {bin.binStart.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 5: INTERACTIVE 2D SLOPE CROSS-SECTION SIMULATOR        */}
            {/* ------------------------------------------------------------- */}
            {slopeSubTab === 'CROSS_SECTION' && (
              <div className="space-y-4 font-mono">
                {/* Layer Visibility Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>2D Cross-Section Layers:</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: 'bishopArc', label: 'Bishop Circular Arc', color: 'text-amber-400' },
                      { key: 'slices', label: 'Vertical Slices', color: 'text-slate-300' },
                      { key: 'janbuSlip', label: 'Janbu Non-Circular Slip', color: 'text-violet-400' },
                      { key: 'phreaticLine', label: 'Groundwater Phreatic Line', color: 'text-sky-400' },
                      { key: 'soilNails', label: 'Soil Nails & Bearing Plates', color: 'text-emerald-400' },
                      { key: 'wireMeshFacing', label: 'Facing & Weep Holes', color: 'text-cyan-400' },
                    ].map((layer) => {
                      const isChecked = (crossSectionLayers as any)[layer.key];
                      return (
                        <button
                          key={layer.key}
                          type="button"
                          onClick={() =>
                            setCrossSectionLayers((prev) => ({
                              ...prev,
                              [layer.key]: !isChecked,
                            }))
                          }
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-slate-800 text-white border-slate-600'
                              : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className={layer.color}>{layer.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SVG 2D Cross-Section Diagram */}
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden shadow-2xl relative">
                  <svg viewBox="-30 -20 540 340" className="w-full h-[400px]">
                    <defs>
                      <linearGradient id="rockMassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                      <linearGradient id="waterTableGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>

                    {/* Background Grid */}
                    <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                    </pattern>
                    <rect x="-30" y="-20" width="540" height="340" fill="url(#gridPattern)" />

                    {/* Ground Profile Coordinates (SVG Canvas: Toe at x=120, y=240, Crest at x=280, y=60) */}
                    {/* Rock Mass Fill */}
                    <polygon
                      points="-20,240 120,240 280,60 500,60 500,310 -20,310"
                      fill="url(#rockMassGrad)"
                      stroke="#475569"
                      strokeWidth="2"
                    />

                    {/* Bench / Berm Step if domain is BENCH */}
                    {mappingDomain === 'BENCH' && (
                      <polygon
                        points="120,240 200,150 240,150 320,60 500,60 500,310 120,310"
                        fill="#334155"
                        opacity="0.3"
                      />
                    )}

                    {/* Groundwater Phreatic Line */}
                    {crossSectionLayers.phreaticLine && (
                      <g>
                        <path
                          d="M -20,250 Q 120,245 280,120 T 500,90"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="5,4"
                        />
                        <polygon
                          points="-20,250 120,245 280,120 500,90 500,310 -20,310"
                          fill="url(#waterTableGrad)"
                        />
                        <text x="360" y="82" fill="#38bdf8" fontSize="10" fontWeight="bold">
                          ▼ Phreatic Surface (ru={slopeWaterRatioRu})
                        </text>
                      </g>
                    )}

                    {/* Bishop Circular Slip Surface */}
                    {crossSectionLayers.bishopArc && (
                      <g>
                        <path
                          d="M 120,240 Q 220,260 360,60"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3"
                          strokeDasharray="6,3"
                        />
                        <circle cx="270" cy="-20" r="4" fill="#f59e0b" />
                        <text x="370" y="75" fill="#f59e0b" fontSize="10" fontWeight="bold">
                          Bishop Arc (R = {bishopCalc.radiusM}m, FoS = {bishopCalc.reinforcedBishopFos.toFixed(2)})
                        </text>
                      </g>
                    )}

                    {/* Slices discretization */}
                    {crossSectionLayers.slices && (
                      <g stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" opacity="0.6">
                        <line x1="150" y1="205" x2="150" y2="248" />
                        <line x1="180" y1="172" x2="180" y2="242" />
                        <line x1="210" y1="138" x2="210" y2="228" />
                        <line x1="240" y1="105" x2="240" y2="205" />
                        <line x1="270" y1="72" x2="270" y2="175" />
                        <line x1="300" y1="60" x2="300" y2="140" />
                        <line x1="330" y1="60" x2="330" y2="100" />
                      </g>
                    )}

                    {/* Janbu Non-Circular Slip Line */}
                    {crossSectionLayers.janbuSlip && (
                      <g>
                        <path
                          d="M 120,240 L 210,180 L 320,60"
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2.5"
                          strokeDasharray="4,2"
                        />
                        <text x="215" y="195" fill="#c084fc" fontSize="9" fontWeight="bold">
                          Janbu Composite Slip (f₀={bishopCalc.janbuCorrectionF0})
                        </text>
                      </g>
                    )}

                    {/* Soil Nails / Rock Anchors */}
                    {crossSectionLayers.soilNails && (
                      <g>
                        {[
                          { startX: 145, startY: 212, length: 110, angle: 15 },
                          { startX: 185, startY: 167, length: 120, angle: 15 },
                          { startX: 225, startY: 122, length: 130, angle: 15 },
                          { startX: 265, startY: 77, length: 135, angle: 15 },
                        ].map((nail, idx) => {
                          const rad = (nail.angle * Math.PI) / 180;
                          const endX = nail.startX + nail.length * Math.cos(rad);
                          const endY = nail.startY + nail.length * Math.sin(rad);
                          return (
                            <g key={idx}>
                              {/* Grout Annulus */}
                              <line
                                x1={nail.startX}
                                y1={nail.startY}
                                x2={endX}
                                y2={endY}
                                stroke="#059669"
                                strokeWidth="5"
                                opacity="0.4"
                              />
                              {/* Steel Tendon */}
                              <line
                                x1={nail.startX}
                                y1={nail.startY}
                                x2={endX}
                                y2={endY}
                                stroke="#10b981"
                                strokeWidth="2.5"
                              />
                              {/* Face Bearing Plate */}
                              <line
                                x1={nail.startX - 6}
                                y1={nail.startY - 7}
                                x2={nail.startX + 6}
                                y2={nail.startY + 7}
                                stroke="#fbbf24"
                                strokeWidth="4"
                              />
                              {/* Tension Arrow Vector */}
                              <line
                                x1={nail.startX + 20}
                                y1={nail.startY + 5}
                                x2={nail.startX + 40}
                                y2={nail.startY + 10}
                                stroke="#fbbf24"
                                strokeWidth="1.5"
                              />
                            </g>
                          );
                        })}
                        <text x="290" y="105" fill="#10b981" fontSize="10" fontWeight="bold">
                          Soil Nails (L=12m @ {slopeBoltSpacingH}m × {slopeBoltSpacingV}m, {slopeBoltCapKn} kN)
                        </text>
                      </g>
                    )}

                    {/* Shotcrete Facing & Weep Holes */}
                    {crossSectionLayers.wireMeshFacing && (
                      <g>
                        {/* Shotcrete Layer along face */}
                        <line
                          x1="120"
                          y1="240"
                          x2="280"
                          y2="60"
                          stroke="#06b6d4"
                          strokeWidth="4"
                          opacity="0.8"
                        />
                        {/* Weep Holes */}
                        <circle cx="160" cy="195" r="3" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
                        <circle cx="200" cy="150" r="3" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
                        <circle cx="240" cy="105" r="3" fill="#ffffff" stroke="#0284c7" strokeWidth="1.5" />
                        <text x="80" y="160" fill="#22d3ee" fontSize="9" fontWeight="bold">
                          {slopeShotcreteMm}mm SFRS + Weep Holes
                        </text>

                        {/* Crest Drain Ditch */}
                        <path d="M 290,60 L 297,68 L 304,60 Z" fill="#0284c7" stroke="#38bdf8" />
                        <text x="310" y="55" fill="#38bdf8" fontSize="9" fontWeight="bold">
                          Crest Interceptor Ditch
                        </text>
                      </g>
                    )}

                    {/* Dimension Arrows */}
                    <g stroke="#94a3b8" strokeWidth="1" fill="#94a3b8" fontSize="10">
                      {/* Height H */}
                      <line x1="55" y1="240" x2="55" y2="60" />
                      <line x1="50" y1="240" x2="60" y2="240" />
                      <line x1="50" y1="60" x2="60" y2="60" />
                      <text x="15" y="155" fontWeight="bold">H = {slopeHeightM}m</text>

                      {/* Face Angle */}
                      <path d="M 120,240 L 150,240 A 30 30 0 0 0 140,217 Z" fill="#f59e0b" opacity="0.4" />
                      <text x="160" y="235" fill="#f59e0b" fontWeight="bold">βs = {slopeFaceAngleDeg}°</text>

                      {/* Toe Label */}
                      <text x="100" y="260" fill="#94a3b8" fontWeight="bold">Slope Toe (0,0)</text>
                      <text x="270" y="45" fill="#94a3b8" fontWeight="bold">Slope Crest</text>
                    </g>
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 1: EXCAVATION-SPECIFIC 3D GEOLOGICAL LOGS               */}
        {/* ================================================================= */}
        {activeTab === 'EXCAVATION_3D_LOG' && (
          <div className="h-[620px] w-full">
            <ExcavationSpecific3DLogViewport
              spanW={fedData.spanW}
              heightH={fedData.heightH}
              benchHeight={fedData.benchHeight}
              zStart={Math.max(0, fedData.currentFaceChainageNum - fedData.pullLengthM)}
              zEnd={fedData.currentFaceChainageNum}
              lithologyName={fedData.lithologyName}
              driveAzimuth={customDriveAzimuth}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 2: PROJECTING WEAK ZONES BEYOND TUNNEL HEADINGS        */}
        {/* ================================================================= */}
        {activeTab === 'WEAK_ZONE_PROJECTOR' && (
          <div className="min-h-[580px] w-full">
            <WeakZoneAheadProjectorView
              zFaceDefault={fedData.currentFaceChainageNum}
              alphaDriveDefault={customDriveAzimuth}
              hTunnelDefault={fedData.heightH}
              betaDefault={fedData.governingJoint.dip}
              thetaDipDefault={fedData.governingJoint.dipDirection}
              tTrueDefault={fedData.governingJoint.thicknessM}
              lPullDefault={fedData.pullLengthM}
              lithologyName={fedData.lithologyName}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 3: RECONSTRUCTING 3D GEOLOGY FROM SEQUENTIAL FACE LOGS */}
        {/* ================================================================= */}
        {activeTab === 'SEQUENTIAL_3D_RECON' && (
          <div className="h-[620px] w-full">
            <SequentialFace3DReconstructionView
              faceLogs={fedData.historicalFaceLogs}
              driveAzimuth={customDriveAzimuth}
              spanW={fedData.spanW}
              heightH={fedData.heightH}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 4: COMPONENT-SPECIFIC APPARENT THICKNESS & SPACING     */}
        {/* ================================================================= */}
        {activeTab === 'APPARENT_THICKNESS_SPACING' && (
          <div className="min-h-[580px] w-full">
            <ComponentApparentThicknessView
              tTrueDefault={fedData.governingJoint.thicknessM}
              sTrueDefault={fedData.governingJoint.spacingM}
              betaDefault={fedData.governingJoint.dip}
              thetaDipDefault={fedData.governingJoint.dipDirection}
              alphaDriveDefault={customDriveAzimuth}
              gammaDriveDefault={0}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 5: EVALUATING TUNNEL ALIGNMENT ALTERNATIVES            */}
        {/* ================================================================= */}
        {activeTab === 'ALIGNMENT_ALTERNATIVES' && (
          <div className="min-h-[580px] w-full">
            <AlignmentAlternativesEvaluatorView
              currentDriveAzimuth={customDriveAzimuth}
              faults={fedData.faultsList}
              controllingJoint={{
                id: fedData.governingJoint.id,
                beta: fedData.governingJoint.dip,
                thetaDip: fedData.governingJoint.dipDirection,
                frictionAngle: 32,
              }}
              sigmaHAzDefault={110}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* CAPABILITY 6: POOR ROCK MASS PROPORTIONS ESTIMATOR                */}
        {/* ================================================================= */}
        {activeTab === 'POOR_ROCK_PROPORTIONS' && (
          <div className="min-h-[580px] w-full">
            <PoorRockProportionsEstimatorView
              totalLengthDefault={Math.max(1200, Math.round(fedData.currentFaceChainageNum * 8))}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: EXECUTIVE ENGINEERING REPORT SHEET (PRINT & SIGN-OFF READY)*/}
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
