import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Compass,
  ShieldAlert,
  TrendingUp,
  Layers,
  Activity,
  Droplets,
  Clock,
  Box,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  Eye,
  FileText,
  Printer,
  Mountain,
  Wrench,
  Anchor,
  ChevronRight,
  Lock,
} from 'lucide-react';
import {
  TunnelGeometry,
  TunnelSettings,
  Joint,
  JointSet,
  LithologyRegion,
  QIndexParameters,
  RmrParameters,
  SavedProjectRecord,
} from '../types/tunnel';
import { KinematicWedge3DViewport } from './KinematicWedge3DViewport';
import { FutureAdvance3DViewport } from './FutureAdvance3DViewport';
import { ExcavationSpecific3DLogViewport } from './ExcavationSpecific3DLogViewport';
import { WeakZoneAheadProjectorView } from './WeakZoneAheadProjectorView';
import { SequentialFace3DReconstructionView } from './SequentialFace3DReconstructionView';
import { ComponentApparentThicknessView } from './ComponentApparentThicknessView';
import { AlignmentAlternativesEvaluatorView } from './AlignmentAlternativesEvaluatorView';
import { PoorRockProportionsEstimatorView } from './PoorRockProportionsEstimatorView';
import {
  ExcavationStageType,
  computeStageElevationBounds,
  feedDataFromNatmActiveState,
  AlignmentDomainSegment,
  FaultZoneCrossing,
  generateExactTunnelProfilePoints,
  clipProfilePolygonToYBand,
  getCrownArchYAtX,
} from '../engine/advancedModelingAndAlignmentEngine';
import {
  assessModuleDataReadiness,
  GeotechnicalActiveState,
  clampDiscontinuityDip,
  clampDiscontinuityDipDirection,
  clampDriveAzimuth,
  clampUcsMpa,
} from '../engine/rockMechanicsValidator';
import { DataRequirementLockView } from './DataRequirementLockView';

export interface AdvancedGeologicalAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullPage?: boolean;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  lithologyRegions?: LithologyRegion[];
  qIndexParams?: QIndexParameters;
  rmrParams?: RmrParameters;
  mappingDomain?: string | any;
  surfaceParams?: any;
  surfaceSmrAnalysis?: any;
  savedProjects?: SavedProjectRecord[];
  rockMassSummary?: any;
  overbreakAnalysis?: any;
  junctionFactorData?: any;
  activeExcavationApproach?: string;
  onOpenJunctionCalculator?: () => void;
  onClearJunctionFactor?: () => void;
}

type AdvancedAnalysisTab =
  | 'EXCAVATION_3D_LOG'
  | 'WEAK_ZONE_PROJECTOR'
  | 'SEQUENTIAL_3D_RECON'
  | 'FUTURE_FORECAST'
  | 'WEDGE_FOS'
  | 'APPARENT_DIP_SOLVER'
  | 'APPARENT_THICKNESS_SPACING'
  | 'PALMSTROM_BLOCKS'
  | 'HOEK_BROWN_ROCK'
  | 'STANDUP_TIME_SPAN'
  | 'HYDRO_INFLOW'
  | 'SLOPE_STABILITY_AND_STABILIZATION'
  | 'ALIGNMENT_ALTERNATIVES'
  | 'POOR_ROCK_PROPORTIONS'
  | 'EXECUTIVE_REPORT';

interface SidebarCategoryGroup {
  id: string;
  title: string;
  items: {
    id: AdvancedAnalysisTab;
    label: string;
    shortDesc: string;
    icon: React.FC<{ className?: string }>;
  }[];
}

const SIDEBAR_CATEGORIES: SidebarCategoryGroup[] = [
  {
    id: 'excavation_3d',
    title: '1. 3D Excavation & Ahead Projection',
    items: [
      {
        id: 'EXCAVATION_3D_LOG',
        label: '3D Stage Shell Log',
        shortDesc: 'Heading / Bench / Invert 3D CAD',
        icon: Layers,
      },
      {
        id: 'WEAK_ZONE_PROJECTOR',
        label: 'Weak Zone Projector',
        shortDesc: 'Crown & Invert Entry/Exit RD',
        icon: TrendingUp,
      },
      {
        id: 'FUTURE_FORECAST',
        label: 'Future Advance (+30m)',
        shortDesc: '3D Plane Sweep Ahead of Face',
        icon: Eye,
      },
      {
        id: 'SEQUENTIAL_3D_RECON',
        label: 'Sequential Face 3D',
        shortDesc: 'Multi-Round Ribbon Interpolation',
        icon: Box,
      },
    ],
  },
  {
    id: 'structural_kinematics',
    title: '2. Structural & Kinematics',
    items: [
      {
        id: 'WEDGE_FOS',
        label: '3D Wedge & Bolt FoS',
        shortDesc: 'Goodman-Shi Tetrahedral Block',
        icon: ShieldAlert,
      },
      {
        id: 'APPARENT_DIP_SOLVER',
        label: 'Apparent Dip & Stereo',
        shortDesc: '3D Wall/Face Trace & Stereonet',
        icon: Compass,
      },
      {
        id: 'APPARENT_THICKNESS_SPACING',
        label: 'Thickness & Spacing',
        shortDesc: 'Directional Cosines (x, y, z)',
        icon: Sliders,
      },
      {
        id: 'PALMSTROM_BLOCKS',
        label: 'Palmström Jv & Block Vb',
        shortDesc: '3D Block Sieve & RQD Correlation',
        icon: Box,
      },
    ],
  },
  {
    id: 'rock_mechanics',
    title: '3. Rock Mass & Support Mechanics',
    items: [
      {
        id: 'HOEK_BROWN_ROCK',
        label: 'Hoek-Brown (2002)',
        shortDesc: 'GSI, Erm & Failure Envelope',
        icon: Activity,
      },
      {
        id: 'STANDUP_TIME_SPAN',
        label: 'Stand-Up Time & Span',
        shortDesc: 'Bieniawski Unsupported Chart',
        icon: Clock,
      },
      {
        id: 'HYDRO_INFLOW',
        label: 'Hydro Inflow & Grout',
        shortDesc: 'Goodman L/min/100m & Pressure',
        icon: Droplets,
      },
      {
        id: 'SLOPE_STABILITY_AND_STABILIZATION',
        label: 'Portal Cut & Stabilization',
        shortDesc: 'Romana SMR & Anchor Design',
        icon: Mountain,
      },
    ],
  },
  {
    id: 'alignment_dossier',
    title: '4. Alignment & Executive Dossier',
    items: [
      {
        id: 'ALIGNMENT_ALTERNATIVES',
        label: 'Alignment Optimizer',
        shortDesc: '360° Polar Azimuth Hazard Sweep',
        icon: Compass,
      },
      {
        id: 'POOR_ROCK_PROPORTIONS',
        label: 'Class IV/V Rock Proportions',
        shortDesc: 'Gaussian CDF & Fault Halo Share',
        icon: Activity,
      },
      {
        id: 'EXECUTIVE_REPORT',
        label: 'Executive Geotech Dossier',
        shortDesc: 'Consolidated ISRM Summary Sheet',
        icon: FileText,
      },
    ],
  },
];

/**
 * Builds an exact SVG path string from TunnelGeometry.crossSectionPoints or standard dimensions.
 * Coordinates in crossSectionPoints have x in [-W/2, W/2] and y in [invert, H].
 * In SVG: x_svg = cx + x * scale, y_svg = baseY - y * scale.
 */
function buildSvgTunnelProfilePath(
  geometry: TunnelGeometry,
  spanW: number,
  heightH: number,
  wallH: number,
  cx: number,
  baseY: number,
  scale: number
): {
  pathD: string;
  rawPts: { x: number; y: number }[];
  pointsSvg: { x: number; y: number; rawX: number; rawY: number }[];
} {
  const rawPts = generateExactTunnelProfilePoints(geometry, spanW, heightH, wallH);

  const pointsSvg = rawPts.map((pt) => ({
    x: cx + pt.x * scale,
    y: baseY - pt.y * scale,
    rawX: pt.x,
    rawY: pt.y,
  }));

  const pathD =
    pointsSvg.length > 0
      ? pointsSvg.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
      : '';

  return { pathD, rawPts, pointsSvg };
}

export const AdvancedGeologicalAnalysisModal: React.FC<AdvancedGeologicalAnalysisModalProps> = ({
  isOpen,
  onClose,
  fullPage = false,
  geometry,
  settings,
  joints = [],
  jointSets = [],
  qIndexParams: propQIndexParams,
  rmrParams: propRmrParams,
  mappingDomain = 'tunnel',
  surfaceParams,
  surfaceSmrAnalysis,
  savedProjects = [],
  activeExcavationApproach,
}) => {
  const [activeTab, setActiveTab] = useState<AdvancedAnalysisTab>('EXCAVATION_3D_LOG');

  // Authoritative Live Data Bundle from Active Workspace
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

  const activeGeotechnicalState: GeotechnicalActiveState = useMemo(
    () => ({
      geometry,
      settings,
      joints,
      jointSets,
      rmrParams: propRmrParams,
      qIndexParams: propQIndexParams,
      savedProjects,
    }),
    [geometry, settings, joints, jointSets, propRmrParams, propQIndexParams, savedProjects]
  );

  // Per-module readiness map for sidebar badges and active gatekeeper
  const readinessByTab = useMemo(() => {
    const map = {} as Record<AdvancedAnalysisTab, ReturnType<typeof assessModuleDataReadiness>>;
    SIDEBAR_CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        map[item.id] = assessModuleDataReadiness(item.id, activeGeotechnicalState);
      });
    });
    return map;
  }, [activeGeotechnicalState]);

  const currentModuleReadiness = readinessByTab[activeTab];

  const mapApproachToStage = (app?: string): ExcavationStageType => {
    const norm = (app || '').toLowerCase();
    if (norm.includes('top') || norm.includes('heading')) return 'TOP_HEADING';
    if (norm.includes('bench')) return 'BENCH';
    if (norm.includes('invert')) return 'INVERT';
    return 'FULL_FACE';
  };

  // Interactive Solver Controls (initialized from live fedData)
  const [activeExcavationStage, setActiveExcavationStage] = useState<ExcavationStageType>(() =>
    mapApproachToStage(activeExcavationApproach)
  );
  const [customDriveAzimuth, setCustomDriveAzimuth] = useState<number>(fedData.driveAzimuth);
  const [customStrike, setCustomStrike] = useState<number>(fedData.governingJoint?.strike ?? 125);
  const [customDip, setCustomDip] = useState<number>(fedData.governingJoint?.dip ?? 60);
  const [customDipDirection, setCustomDipDirection] = useState<number>(fedData.governingJoint?.dipDirection ?? 215);

  useEffect(() => {
    if (activeExcavationApproach) {
      setActiveExcavationStage(mapApproachToStage(activeExcavationApproach));
    }
  }, [activeExcavationApproach]);

  // Wedge & Bolt Solver Controls
  const [frictionAngleDeg, setFrictionAngleDeg] = useState<number>(32);
  const [cohesionKpa, setCohesionKpa] = useState<number>(25);
  const [rockUnitWeight, setRockUnitWeight] = useState<number>(26.5);
  const [boltCapacityKn, setBoltCapacityKn] = useState<number>(150);
  const [boltSpacingM, setBoltSpacingM] = useState<number>(1.5);
  const [boltLengthM, setBoltLengthM] = useState<number>(4.0);

  // Hoek-Brown Solver Controls
  const [intactUcsMpa, setIntactUcsMpa] = useState<number>(75);
  const [hoekBrownMi, setHoekBrownMi] = useState<number>(17);
  const [disturbanceFactorD, setDisturbanceFactorD] = useState<number>(0.2);
  const [overburdenDepthM, setOverburdenDepthM] = useState<number>(180);

  // Hydrogeology Controls
  const [waterHeadM, setWaterHeadM] = useState<number>(95);
  const [groutReductionPct, setGroutReductionPct] = useState<number>(75);

  // Portal Cut & Stabilization Controls
  const [slopeAngleDeg, setSlopeAngleDeg] = useState<number>(surfaceParams?.slopeAngle ?? 65);
  const [slopeHeightM, setSlopeHeightM] = useState<number>(surfaceParams?.slopeHeight ?? 24);
  const [slopeDipDirDeg, setSlopeDipDirDeg] = useState<number>(surfaceParams?.slopeDipDirection ?? fedData.driveAzimuth);
  const [seismicKh, setSeismicKh] = useState<number>(0.12);
  const [porePressureRu, setPorePressureRu] = useState<number>(0.15);
  const [anchorTensionKnPerM, setAnchorTensionKnPerM] = useState<number>(180);

  // Sync solver states when live mapped data updates
  useEffect(() => {
    setCustomDriveAzimuth(fedData.driveAzimuth);
    if (fedData.governingJoint) {
      setCustomStrike(fedData.governingJoint.strike);
      setCustomDip(fedData.governingJoint.dip);
      setCustomDipDirection(fedData.governingJoint.dipDirection);
    }
  }, [
    fedData.driveAzimuth,
    fedData.governingJoint?.id,
    fedData.governingJoint?.strike,
    fedData.governingJoint?.dip,
    fedData.governingJoint?.dipDirection,
  ]);

  const spanW = fedData.spanW;
  const heightH = fedData.heightH;
  const wallH = geometry.wallHeight || fedData.benchHeight || heightH * 0.55;
  const pullLength = fedData.pullLengthM;
  const currentFaceChainageNum = fedData.currentFaceChainageNum;
  const shapeLabel = (geometry.crownGeometry || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  // Derived Validated Ratings
  const rmrVal = fedData.rmrTotal;
  const qVal = fedData.qValue;
  const gsiVal = fedData.gsiValue;
  const safeRmrForCalc = rmrVal ?? (qVal ? Math.round(9 * Math.log(Math.max(0.01, qVal)) + 44) : 55);
  const safeQForCalc = qVal ?? (rmrVal ? Number(Math.exp((rmrVal - 44) / 9).toFixed(2)) : 3.5);
  const safeGsiForCalc = gsiVal ?? Math.max(15, Math.min(90, safeRmrForCalc - 5));

  // --------------------------------------------------------------------------
  // 1. APPARENT DIP & FUTURE ADVANCE CALCULATIONS
  // --------------------------------------------------------------------------
  const apparentCalculations = useMemo(() => {
    const betaRad = ((customStrike - customDriveAzimuth) * Math.PI) / 180;
    const dipRad = (customDip * Math.PI) / 180;

    const sinBeta = Math.abs(Math.sin(betaRad));
    const cosBeta = Math.abs(Math.cos(betaRad));

    const tanAppWall = Math.tan(dipRad) * sinBeta;
    const apparentDipWallDeg = (Math.atan(tanAppWall) * 180) / Math.PI;

    const tanAppFace = Math.tan(dipRad) * cosBeta;
    const apparentDipFaceDeg = (Math.atan(tanAppFace) * 180) / Math.PI;

    const advanceRatePerVerticalMeter = tanAppWall > 0.01 ? 1 / tanAppWall : 99.9;
    const distanceCrownToInvert = heightH * advanceRatePerVerticalMeter;

    const forecastDistances = [3, 6, 9, 12, 15, 20, 25, 30];
    const forecastTable = forecastDistances.map((distAhead) => {
      const targetChainage = currentFaceChainageNum + distAhead;
      const elevationShift = distAhead * tanAppWall;
      const currentElevation = Math.max(0, heightH - ( elevationShift % (heightH * 1.4) ));

      let zoneLocation = 'Mid-Face / Springline';
      let riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
      if (currentElevation > heightH * 0.72) {
        zoneLocation = 'Crown / Arch Roof';
        riskLevel = customDip < 45 ? 'CRITICAL' : 'HIGH';
      } else if (currentElevation < heightH * 0.25) {
        zoneLocation = 'Invert / Footwall';
        riskLevel = 'LOW';
      }

      return {
        distAhead,
        targetChainage: targetChainage.toFixed(1),
        elevationAboveInvert: currentElevation.toFixed(2),
        zoneLocation,
        riskLevel,
      };
    });

    return {
      betaDeg: Math.abs((customStrike - customDriveAzimuth + 360) % 180),
      apparentDipWallDeg,
      apparentDipFaceDeg,
      advanceRatePerVerticalMeter,
      distanceCrownToInvert,
      forecastTable,
    };
  }, [customStrike, customDriveAzimuth, customDip, heightH, currentFaceChainageNum]);

  // --------------------------------------------------------------------------
  // 2. 3D TETRAHEDRAL WEDGE & ROCKBOLT FOS CALCULATIONS
  // --------------------------------------------------------------------------
  const wedgeAnalysis = useMemo(() => {
    const j1Dip = customDip;
    const j2Dip = jointSets[1]?.meanDip ?? Math.max(35, Math.min(82, 115 - j1Dip));
    const avgDipRad = (((j1Dip + j2Dip) / 2) * Math.PI) / 180;
    const effectiveSpan = spanW * 0.65;
    const apexHeightM = Math.min(heightH * 0.75, (effectiveSpan / 2) * Math.tan(avgDipRad) * 0.55);

    const baseAreaM2 = effectiveSpan * Math.min(pullLength * 1.35, effectiveSpan * 0.85);
    const wedgeVolumeM3 = (1 / 3) * baseAreaM2 * apexHeightM;
    const wedgeWeightKn = wedgeVolumeM3 * rockUnitWeight;

    const slipAngleRad = (Math.min(j1Dip, j2Dip) * Math.PI) / 180;
    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    const contactAreaM2 = Math.max(1.2, baseAreaM2 * 0.75);

    const drivingForceKn = Math.max(1, wedgeWeightKn * Math.sin(slipAngleRad));
    const normalForceKn = wedgeWeightKn * Math.cos(slipAngleRad);

    const resistingUnboltedKn = normalForceKn * Math.tan(phiRad) + cohesionKpa * contactAreaM2 * 0.35;
    const fosUnbolted =
      j1Dip + j2Dip > 125 && Math.abs(customStrike - customDriveAzimuth) < 30
        ? Math.min(0.92, resistingUnboltedKn / (wedgeWeightKn + 1))
        : resistingUnboltedKn / drivingForceKn;

    const numBoltsInWedge = Math.max(2, Math.floor(baseAreaM2 / (boltSpacingM * boltSpacingM)));
    const anchorageFactor =
      boltLengthM > apexHeightM + 0.5
        ? 1.0
        : Math.max(0.15, (boltLengthM - apexHeightM * 0.4) / Math.max(0.5, apexHeightM));
    const totalBoltForceKn = numBoltsInWedge * boltCapacityKn * anchorageFactor;

    const resistingBoltedKn =
      resistingUnboltedKn +
      totalBoltForceKn * (Math.cos(slipAngleRad) * Math.tan(phiRad) + Math.sin(slipAngleRad));
    const fosBolted = resistingBoltedKn / drivingForceKn;

    const requiredSupportPressureKpa = wedgeWeightKn / Math.max(1, baseAreaM2);
    const installedSupportPressureKpa = totalBoltForceKn / Math.max(1, baseAreaM2);

    const failureMode: 'ROOF_FALL' | 'SLIDING_J1' | 'SLIDING_J2' | 'STABLE' =
      fosBolted >= 1.5 ? 'STABLE' : j1Dip > 65 && j2Dip > 65 ? 'ROOF_FALL' : 'SLIDING_J1';

    return {
      apexHeightM,
      baseAreaM2,
      wedgeVolumeM3,
      wedgeWeightKn,
      drivingForceKn,
      resistingUnboltedKn,
      resistingBoltedKn,
      fosUnbolted,
      fosBolted,
      numBoltsInWedge,
      anchorageFactor,
      requiredSupportPressureKpa,
      installedSupportPressureKpa,
      failureMode,
    };
  }, [
    customDip,
    customStrike,
    customDriveAzimuth,
    jointSets,
    spanW,
    heightH,
    pullLength,
    rockUnitWeight,
    frictionAngleDeg,
    cohesionKpa,
    boltCapacityKn,
    boltSpacingM,
    boltLengthM,
  ]);

  // --------------------------------------------------------------------------
  // 3. HOEK-BROWN (2002) ROCK MASS MECHANICS
  // --------------------------------------------------------------------------
  const hoekBrownAnalysis = useMemo(() => {
    const gsi = safeGsiForCalc;
    const mb = hoekBrownMi * Math.exp((gsi - 100) / (28 - 14 * disturbanceFactorD));
    const s = Math.exp((gsi - 100) / (9 - 3 * disturbanceFactorD));
    const a = 0.5 + (1 / 6) * (Math.exp(-gsi / 15) - Math.exp(-20 / 3));

    const rockMassUcsMpa = intactUcsMpa * Math.pow(s, a);
    const globalStrengthSigmaCmMpa =
      intactUcsMpa *
      ((mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1)) /
      (2 * (1 + a) * (2 + a));

    const deformationModulusGpa =
      intactUcsMpa <= 100
        ? (1 - disturbanceFactorD / 2) * Math.sqrt(intactUcsMpa / 100) * Math.pow(10, (gsi - 10) / 40)
        : (1 - disturbanceFactorD / 2) * Math.pow(10, (gsi - 10) / 40);

    const inSituStressPoMpa = (rockUnitWeight * overburdenDepthM) / 1000;
    const sigma3MaxMpa = Math.max(0.5, 0.47 * globalStrengthSigmaCmMpa * Math.pow(globalStrengthSigmaCmMpa / Math.max(0.1, inSituStressPoMpa), -0.94));
    const s3n = sigma3MaxMpa / Math.max(1, intactUcsMpa);

    const sinPhi =
      (6 * a * mb * Math.pow(s + mb * s3n, a - 1)) /
      (2 * (1 + a) * (2 + a) + 6 * a * mb * Math.pow(s + mb * s3n, a - 1));
    const equivalentFrictionDeg = (Math.asin(Math.min(0.98, Math.max(0.05, sinPhi))) * 180) / Math.PI;

    const equivalentCohesionMpa =
      (intactUcsMpa * ((1 + 2 * a) * s + (1 - a) * mb * s3n) * Math.pow(s + mb * s3n, a - 1)) /
      ((1 + a) * (2 + a) * Math.sqrt(1 + (6 * a * mb * Math.pow(s + mb * s3n, a - 1)) / ((1 + a) * (2 + a))));

    const strengthToStressRatio = globalStrengthSigmaCmMpa / Math.max(0.1, inSituStressPoMpa);
    const squeezingStrainPct = 0.2 * Math.pow(strengthToStressRatio, -2);

    const envelopePoints = Array.from({ length: 20 }, (_, idx) => {
      const sig3 = (idx / 19) * (intactUcsMpa * 0.25);
      const sig1 = sig3 + intactUcsMpa * Math.pow(mb * (sig3 / intactUcsMpa) + s, a);
      return { sig3, sig1 };
    });

    return {
      gsi,
      mb,
      s,
      a,
      rockMassUcsMpa,
      globalStrengthSigmaCmMpa,
      deformationModulusGpa,
      equivalentFrictionDeg,
      equivalentCohesionKpa: equivalentCohesionMpa * 1000,
      inSituStressPoMpa,
      strengthToStressRatio,
      squeezingStrainPct,
      envelopePoints,
    };
  }, [safeGsiForCalc, hoekBrownMi, disturbanceFactorD, intactUcsMpa, rockUnitWeight, overburdenDepthM]);

  // --------------------------------------------------------------------------
  // 4. BIENIAWSKI STAND-UP TIME & PALMSTROM BLOCK VOLUMES
  // --------------------------------------------------------------------------
  const standupAndBlockAnalysis = useMemo(() => {
    const activeSpanM = Math.min(spanW, pullLength * 1.8);
    const logHours = 0.115 * safeRmrForCalc - 1.35 * Math.log10(Math.max(1, activeSpanM)) - 1.1;
    const standupHours = Math.max(0.1, Math.pow(10, logHours));
    const maxUnsupportedSpanM = Math.max(0.8, 0.18 * Math.pow(safeRmrForCalc, 1.15));

    const parseSp = (s?: string, fallback = 0.45) => {
      if (!s) return fallback;
      const m = s.match(/(\d+(?:\.\d+)?)/);
      return m ? Math.max(0.05, parseFloat(m[1])) : fallback;
    };
    const s1 = parseSp(jointSets[0]?.spacing, fedData.governingJoint?.spacingM ?? 0.45);
    const s2 = parseSp(jointSets[1]?.spacing, Math.min(1.5, s1 * 1.35));
    const s3 = parseSp(jointSets[2]?.spacing, Math.min(2.0, s1 * 1.75));

    const jvVolumetricCount = 1 / s1 + (jointSets.length >= 2 ? 1 / s2 : 0.6) + (jointSets.length >= 3 ? 1 / s3 : 0.4);
    const rqdPalmstrom1982 = Math.max(0, Math.min(100, 115 - 3.3 * jvVolumetricCount));
    const rqdPalmstrom2005 = Math.max(0, Math.min(100, 110 - 2.5 * jvVolumetricCount));

    const betaShapeFactor = 36;
    const blockVolumeM3 = betaShapeFactor * Math.pow(jvVolumetricCount, -3);
    const equivalentBlockDiaM = Math.cbrt(blockVolumeM3);

    let blockClass = 'Medium Blocky (0.01 - 0.2 m³)';
    if (blockVolumeM3 > 1.0) blockClass = 'Large / Massive Blocks (> 1.0 m³)';
    else if (blockVolumeM3 < 0.001) blockClass = 'Crushed / Sugar-Cube (< 0.001 m³)';
    else if (blockVolumeM3 < 0.01) blockClass = 'Small Tabular / Blocky (0.001 - 0.01 m³)';

    return {
      activeSpanM,
      standupHours,
      standupDays: standupHours / 24,
      maxUnsupportedSpanM,
      s1,
      s2,
      s3,
      jvVolumetricCount,
      rqdPalmstrom1982,
      rqdPalmstrom2005,
      blockVolumeM3,
      equivalentBlockDiaM,
      blockClass,
    };
  }, [spanW, pullLength, safeRmrForCalc, jointSets, fedData.governingJoint?.spacingM]);

  // --------------------------------------------------------------------------
  // 5. HYDROGEOLOGICAL INFLOW (GOODMAN / HEUER)
  // --------------------------------------------------------------------------
  const hydroAnalysis = useMemo(() => {
    const jw = propQIndexParams?.jw ?? 0.66;
    const baseK = jw < 0.35 ? 5e-5 : jw < 0.6 ? 8e-6 : jw < 0.9 ? 1.5e-6 : 2e-7;
    const eqRadiusM = (spanW + heightH) / 4;
    const headRatio = Math.max(2.1, (2 * waterHeadM) / eqRadiusM);

    const ungroutedInflowM3PerSecPerM = (2 * Math.PI * baseK * waterHeadM) / Math.log(headRatio);
    const ungroutedLitersPerMinPer100m = ungroutedInflowM3PerSecPerM * 1000 * 60 * 100;
    const groutedLitersPerMinPer100m = ungroutedLitersPerMinPer100m * (1 - groutReductionPct / 100);
    const hydrostaticPressureMpa = (waterHeadM * 9.81) / 1000;
    const suggestedGroutPressureMpa = Math.min(6.0, Math.max(1.0, hydrostaticPressureMpa * 2.2 + 0.5));

    return {
      baseK,
      eqRadiusM,
      ungroutedLitersPerMinPer100m,
      groutedLitersPerMinPer100m,
      hydrostaticPressureMpa,
      suggestedGroutPressureMpa,
    };
  }, [propQIndexParams?.jw, spanW, heightH, waterHeadM, groutReductionPct]);

  // --------------------------------------------------------------------------
  // 6. PORTAL CUT & EXCAVATION STABILIZATION (ROMANA SMR & LIMIT EQUILIBRIUM)
  // --------------------------------------------------------------------------
  const slopeAndStabilizationAnalysis = useMemo(() => {
    const alphaSlope = slopeDipDirDeg;
    const betaSlope = slopeAngleDeg;
    const alphaJoint = customDipDirection;
    const betaJoint = customDip;

    let deltaAlpha = Math.abs(alphaJoint - alphaSlope) % 360;
    if (deltaAlpha > 180) deltaAlpha = 360 - deltaAlpha;

    const f1Planar = Math.max(0.15, Math.min(1.0, Math.pow(1 - Math.sin((Math.max(0, deltaAlpha - 5) * Math.PI) / 180), 2)));
    const f2Planar = Math.max(0.15, Math.min(1.0, Math.pow(Math.tan((betaJoint * Math.PI) / 180), 1.2)));
    const diffPlanar = betaJoint - betaSlope;
    const f3Planar = diffPlanar > 10 ? 0 : diffPlanar > 0 ? -6 : diffPlanar === 0 ? -25 : diffPlanar > -10 ? -50 : -60;
    const f4Adjustment = surfaceParams?.excavationMethod === 'PRESPLITTING' ? 10 : surfaceParams?.excavationMethod === 'SMOOTH_BLASTING' ? 8 : 0;

    const computedSmr = Math.max(
      5,
      Math.min(100, surfaceSmrAnalysis?.governingSmr ?? Math.round(safeRmrForCalc + f1Planar * f2Planar * f3Planar + f4Adjustment))
    );

    const failureLengthM = betaJoint > 15 ? slopeHeightM / Math.sin((betaJoint * Math.PI) / 180) : slopeHeightM * 1.5;
    const wedgeAreaM2 = Math.max(
      2.0,
      0.5 *
        slopeHeightM *
        slopeHeightM *
        Math.abs(1 / Math.tan((Math.max(15, betaJoint) * Math.PI) / 180) - 1 / Math.tan((Math.max(20, betaSlope) * Math.PI) / 180))
    );
    const weightPerMeterKn = wedgeAreaM2 * rockUnitWeight;
    const seismicForceKn = weightPerMeterKn * seismicKh;
    const waterUpliftKn = porePressureRu * weightPerMeterKn * Math.cos((betaJoint * Math.PI) / 180);

    const drivingForceSlopeKn =
      weightPerMeterKn * Math.sin((betaJoint * Math.PI) / 180) + seismicForceKn * Math.cos((betaJoint * Math.PI) / 180);
    const normalForceSlopeKn = Math.max(
      0,
      weightPerMeterKn * Math.cos((betaJoint * Math.PI) / 180) -
        seismicForceKn * Math.sin((betaJoint * Math.PI) / 180) -
        waterUpliftKn
    );

    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    const resistingUnreinforcedKn = cohesionKpa * failureLengthM + normalForceSlopeKn * Math.tan(phiRad);
    const fosSlopeUnreinforced = resistingUnreinforcedKn / Math.max(1, drivingForceSlopeKn);

    const optAnchorInclinationRad = (15 * Math.PI) / 180;
    const thetaBoltNormalRad = ((betaJoint + 15) * Math.PI) / 180;
    const resistingReinforcedKn =
      resistingUnreinforcedKn +
      anchorTensionKnPerM * (Math.cos(thetaBoltNormalRad) * Math.tan(phiRad) + Math.sin(thetaBoltNormalRad));
    const fosSlopeReinforced = resistingReinforcedKn / Math.max(1, drivingForceSlopeKn);

    const targetFos = 1.5;
    const deficitKn = Math.max(0, targetFos * drivingForceSlopeKn - resistingUnreinforcedKn);
    const requiredTensionKnPerM =
      deficitKn / Math.max(0.2, Math.cos(thetaBoltNormalRad) * Math.tan(phiRad) + Math.sin(thetaBoltNormalRad));

    return {
      computedSmr,
      fosSlopeUnreinforced,
      fosSlopeReinforced,
      weightPerMeterKn,
      drivingForceSlopeKn,
      resistingReinforcedKn,
      requiredTensionKnPerM,
      failureLengthM,
      optAnchorDeg: (optAnchorInclinationRad * 180) / Math.PI,
    };
  }, [
    slopeDipDirDeg,
    slopeAngleDeg,
    customDipDirection,
    customDip,
    surfaceParams?.excavationMethod,
    surfaceSmrAnalysis?.governingSmr,
    safeRmrForCalc,
    slopeHeightM,
    rockUnitWeight,
    seismicKh,
    porePressureRu,
    frictionAngleDeg,
    cohesionKpa,
    anchorTensionKnPerM,
  ]);

  // Live Domains & Fault Crossings for POOR_ROCK_PROPORTIONS (strictly from mapped data)
  const livePoorRockInputs = useMemo(() => {
    const domains: AlignmentDomainSegment[] = [];
    if (fedData.historicalFaceLogs.length > 0) {
      const sorted = [...fedData.historicalFaceLogs].sort((a, b) => a.chainageMeters - b.chainageMeters);
      sorted.forEach((log, idx) => {
        const nextLog = sorted[idx + 1];
        const len = nextLog ? Math.max(pullLength, nextLog.chainageMeters - log.chainageMeters) : pullLength;
        domains.push({
          id: `dom-${log.id}`,
          name: `${log.faceChainageStr} (${fedData.lithologyName})`,
          startChainage: log.chainageMeters - pullLength,
          endChainage: log.chainageMeters,
          lengthM: len,
          meanRmr: log.meanRmr,
          stdDevRmr: 6.5,
          meanQ: log.meanQ,
          lithology: fedData.lithologyName,
        });
      });
    } else {
      domains.push({
        id: 'dom-active',
        name: `Active Round ${fedData.faceChainageStr} (${fedData.lithologyName})`,
        startChainage: Math.max(0, currentFaceChainageNum - pullLength),
        endChainage: currentFaceChainageNum,
        lengthM: Math.max(pullLength, 30),
        meanRmr: safeRmrForCalc,
        stdDevRmr: 7.5,
        meanQ: safeQForCalc,
        lithology: fedData.lithologyName,
      });
    }

    const totalLen = Math.max(
      30,
      domains.reduce((acc, d) => acc + d.lengthM, 0)
    );

    const faultCrossings: FaultZoneCrossing[] = fedData.faultsList.map((f) => {
      const strikeDeg = (f.thetaDip - 90 + 360) % 360;
      let psi = Math.abs(strikeDeg - customDriveAzimuth) % 180;
      if (psi > 90) psi = 180 - psi;
      return {
        id: f.id,
        name: f.name,
        coreThicknessM: Math.max(0.2, f.tTrue),
        damageHaloMultiplier: 2.0,
        intersectionAnglePsiDeg: Math.max(10, Math.round(psi)),
      };
    });

    return { totalLen, domains, faultCrossings };
  }, [
    fedData.historicalFaceLogs,
    fedData.faceChainageStr,
    fedData.lithologyName,
    fedData.faultsList,
    pullLength,
    currentFaceChainageNum,
    safeRmrForCalc,
    safeQForCalc,
    customDriveAzimuth,
  ]);

  // Mapped traces formatted for 3D Log Shell
  const mapped3DTraces = useMemo(
    () =>
      (joints || [])
        .filter((j) => j && typeof j.dip === 'number' && typeof j.dipDirection === 'number')
        .map((j) => ({
          id: j.id,
          set: j.set || 'J1',
          dip: j.dip,
          dipDirection: j.dipDirection,
          strike: j.strike,
          type: ((j as any).type || j.featureType || 'Joint') as string,
        })),
    [joints]
  );

  // Ready count across all 15 modules
  const readyCount = Object.values(readinessByTab).filter((r) => r.canCalculate).length;

  if (!isOpen) return null;

  return (
    <div
      className={
        fullPage
          ? 'w-full h-full bg-[#060a12] flex flex-col overflow-hidden text-slate-100'
          : 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden text-slate-100'
      }
    >
      <div
        className={
          fullPage
            ? 'w-full h-full flex flex-col overflow-hidden'
            : 'bg-[#060a12] border border-slate-800 rounded-xl w-full max-w-[1640px] h-[94vh] flex flex-col shadow-2xl overflow-hidden'
        }
      >
        {/* ==================== TOP COMPACT ENGINEERING TELEMETRY HEADER ==================== */}
        <header className="h-12 px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wide text-white truncate">
                  ADVANCE GEOTECHNICAL &amp; 3D KINEMATIC ANALYSIS
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-sky-300 shrink-0">
                  {shapeLabel} ({spanW.toFixed(2)}m × {heightH.toFixed(2)}m)
                </span>
              </div>
            </div>
          </div>

          {/* Live Ground-Truth Telemetry Readout Strip */}
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono tabular-nums">
            <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
              FACE: <strong className="text-white">{fedData.faceChainageStr}</strong> (Pull {pullLength.toFixed(1)}m)
            </div>
            <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
              AZIMUTH: <strong className="text-sky-300">{String(Math.round(customDriveAzimuth)).padStart(3, '0')}°</strong>
            </div>
            <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
              MAPPED PLANES: <strong className={mapped3DTraces.length > 0 ? 'text-emerald-400' : 'text-amber-400'}>{mapped3DTraces.length}</strong>
            </div>
            <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
              RMR₈₉: <strong className={rmrVal !== null ? 'text-emerald-400' : 'text-slate-500'}>{rmrVal !== null ? rmrVal : 'UNRATED'}</strong>
            </div>
            <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
              NGI Q: <strong className={qVal !== null ? 'text-sky-300' : 'text-slate-500'}>{qVal !== null ? qVal.toFixed(2) : 'UNRATED'}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono font-bold text-slate-200 flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" /> Print Dossier
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 border border-slate-700 text-[11px] font-mono font-bold text-slate-200 hover:text-rose-200 flex items-center gap-1 transition"
            >
              <X className="w-3.5 h-3.5" /> {fullPage ? 'Return to Face Canvas' : 'Close'}
            </button>
          </div>
        </header>

        {/* ==================== MAIN 2-COLUMN WORKSPACE: GROUPED SIDEBAR + CAD VIEWPORT ==================== */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT GROUPED CATEGORY SIDEBAR */}
          <aside className="w-full md:w-64 lg:w-72 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800/90 flex flex-col shrink-0 max-h-48 md:max-h-none overflow-y-auto">
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Analysis Modules ({readyCount}/15 Ready)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  readyCount === 15
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {readyCount === 15 ? 'ALL VERIFIED' : 'DATA GATED'}
              </span>
            </div>

            <div className="p-2 space-y-3 flex-1 overflow-y-auto">
              {SIDEBAR_CATEGORIES.map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    {cat.title}
                  </div>
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const readiness = readinessByTab[item.id];
                    const isReady = readiness?.canCalculate;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border transition flex items-center justify-between gap-2 ${
                          isActive
                            ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
                            : 'bg-slate-900/40 hover:bg-slate-900 border-transparent hover:border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-sky-400' : isReady ? 'text-slate-400' : 'text-amber-500/70'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{item.label}</div>
                            <div className="text-[10px] font-mono text-slate-500 truncate">{item.shortDesc}</div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            isReady
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isReady ? 'READY' : 'LOCKED'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT MAIN CAD WORKSPACE PANE */}
          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-4 bg-[#060a12]">
            {/* STRICT DATA-DRIVEN GATEKEEPER: NO INPUT = NO OUTPUT */}
            {!currentModuleReadiness.canCalculate ? (
              <div className="max-w-4xl mx-auto py-4">
                <DataRequirementLockView
                  readiness={currentModuleReadiness}
                  moduleTitle={currentModuleReadiness.moduleName}
                  onReturnToCanvas={onClose}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* ==================== 1. EXCAVATION STAGE 3D SHELL LOG ==================== */}
                {activeTab === 'EXCAVATION_3D_LOG' && (() => {
                  const stageBounds = computeStageElevationBounds(
                    activeExcavationStage,
                    spanW,
                    heightH,
                    fedData.benchHeight,
                    0,
                    pullLength,
                    geometry
                  );
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                      {/* Left 8 Cols: 3D CAD Shell */}
                      <div className="lg:col-span-8 flex flex-col min-h-[500px]">
                        <ExcavationSpecific3DLogViewport
                          spanW={spanW}
                          heightH={heightH}
                          benchHeight={fedData.benchHeight}
                          crownRadius={fedData.crownRadius}
                          pullLengthM={pullLength}
                          chainageStart={currentFaceChainageNum}
                          activeStage={activeExcavationStage}
                          geometry={geometry}
                          driveAzimuth={customDriveAzimuth}
                          governingStrike={customStrike}
                          governingDip={customDip}
                          governingSet={fedData.governingJoint?.set || 'J1'}
                          mappedTraces={mapped3DTraces}
                          onStageSelect={setActiveExcavationStage}
                        />
                      </div>

                      {/* Right 4 Cols: Stage Selector & True 2D CAD Profile Blueprint */}
                      <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                        <div className="space-y-3">
                          <div className="border-b border-slate-800 pb-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                              EXCAVATION SUB-PROFILE SELECTOR
                            </div>
                            <div className="text-xs font-mono text-slate-400 mt-0.5">
                              Filter 3D shell and 2D cross-section by active excavation horizon
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {(['FULL_FACE', 'TOP_HEADING', 'BENCH', 'INVERT'] as ExcavationStageType[]).map((st) => {
                              const b = computeStageElevationBounds(st, spanW, heightH, fedData.benchHeight, 0, pullLength, geometry);
                              const active = activeExcavationStage === st;
                              return (
                                <button
                                  key={st}
                                  onClick={() => setActiveExcavationStage(st)}
                                  className={`p-2 rounded border text-left transition ${
                                    active
                                      ? 'bg-sky-500/20 border-sky-500/60 text-white'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="text-[11px] font-mono font-bold text-sky-300">
                                    {st.replace('_', ' ')}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 tabular-nums mt-0.5">
                                    Y: {b.yMin.toFixed(1)}m → {b.yMax.toFixed(1)}m ({b.crossSectionArea.toFixed(1)}m²)
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Exact 2D CAD Tunnel Profile Cross-Section on White Background */}
                          <div className="bg-white border border-slate-300 rounded-lg p-2.5 shadow-2xs">
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-700 font-bold mb-1">
                              <span>2D CAD CROSS-SECTION ({shapeLabel})</span>
                              <span className="text-sky-700 tabular-nums">{spanW.toFixed(2)}m × {heightH.toFixed(2)}m</span>
                            </div>
                            <svg viewBox="0 0 320 240" className="w-full h-44 bg-white">
                              <rect width="320" height="240" fill="#ffffff" />
                              {(() => {
                                const scale = Math.min(200 / Math.max(1, spanW), 145 / Math.max(1, heightH));
                                const cx = 160;
                                const baseY = 195;
                                const { pathD, rawPts } = buildSvgTunnelProfilePath(geometry, spanW, heightH, wallH, cx, baseY, scale);
                                const clippedRawPts = clipProfilePolygonToYBand(rawPts, stageBounds.yMin, stageBounds.yMax);
                                const clippedPathD =
                                  clippedRawPts.length >= 3
                                    ? clippedRawPts
                                        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${(cx + pt.x * scale).toFixed(1)} ${(baseY - pt.y * scale).toFixed(1)}`)
                                        .join(' ') + ' Z'
                                    : pathD;
                                const zMinY = baseY - stageBounds.yMin * scale;
                                const zMaxY = baseY - stageBounds.yMax * scale;

                                return (
                                  <>
                                    {/* CAD Grid */}
                                    <line x1="25" y1={baseY} x2="295" y2={baseY} stroke="#94a3b8" strokeWidth="1.2" />
                                    <line x1={cx} y1="20" x2={cx} y2="215" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                                    {/* Full Tunnel Reference Outline */}
                                    <path d={pathD} fill="#f8fafc" stroke="#475569" strokeWidth="1.5" strokeDasharray="4,3" />
                                    {/* Active Stage Exact Clipped Polygon */}
                                    <path
                                      d={clippedPathD}
                                      fill="rgba(2, 132, 199, 0.22)"
                                      stroke="#0284c7"
                                      strokeWidth="2.5"
                                    />
                                    {/* Stage Elevation Cut Lines */}
                                    <line x1="35" y1={zMaxY} x2="285" y2={zMaxY} stroke="#059669" strokeWidth="1.2" strokeDasharray="3,3" />
                                    <line x1="35" y1={zMinY} x2="285" y2={zMinY} stroke="#d97706" strokeWidth="1.2" strokeDasharray="3,3" />
                                    <text x="38" y={Math.max(14, zMaxY - 4)} fill="#047857" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                      Y_max = {stageBounds.yMax.toFixed(2)}m
                                    </text>
                                    <text x="38" y={Math.min(232, zMinY + 11)} fill="#b45309" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                      Y_min = {stageBounds.yMin.toFixed(2)}m
                                    </text>
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        </div>

                        <div className="bg-slate-950/90 border border-slate-800 rounded p-2.5 space-y-1 text-[11px] font-mono tabular-nums">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Active Stage Area / Volume:</span>
                            <span className="text-emerald-400 font-bold">{stageBounds.crossSectionArea.toFixed(2)} m² / {stageBounds.volume.toFixed(1)} m³</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Active Stage Height:</span>
                            <span className="text-white font-bold">{(stageBounds.yMax - stageBounds.yMin).toFixed(2)} m</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Springline / Wall H:</span>
                            <span className="text-sky-300 font-bold">{wallH.toFixed(2)} m</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Mapped Planes Intersecting:</span>
                            <span className="text-emerald-400 font-bold">{mapped3DTraces.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== 2. WEAK ZONE AHEAD PROJECTOR ==================== */}
                {activeTab === 'WEAK_ZONE_PROJECTOR' && (
                  <WeakZoneAheadProjectorView
                    zFaceDefault={currentFaceChainageNum}
                    alphaDriveDefault={customDriveAzimuth}
                    hTunnelDefault={heightH}
                    betaDefault={fedData.faultsList[0]?.beta ?? customDip}
                    thetaDipDefault={fedData.faultsList[0]?.thetaDip ?? customDipDirection}
                    tTrueDefault={fedData.faultsList[0]?.tTrue ?? 1.0}
                    lPullDefault={pullLength}
                    lithologyName={fedData.faultsList[0]?.name || fedData.lithologyName}
                  />
                )}

                {/* ==================== 3. SEQUENTIAL FACE 3D RECONSTRUCTION ==================== */}
                {activeTab === 'SEQUENTIAL_3D_RECON' && (
                  <SequentialFace3DReconstructionView
                    spanW={spanW}
                    heightH={heightH}
                    tunnelWidth={spanW}
                    tunnelHeight={heightH}
                    geometry={geometry}
                    initialFaceLogs={fedData.historicalFaceLogs}
                  />
                )}

                {/* ==================== 4. FUTURE ADVANCE (+30m) 3D FORECAST ==================== */}
                {activeTab === 'FUTURE_FORECAST' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <div className="lg:col-span-8 flex flex-col min-h-[500px]">
                      <FutureAdvance3DViewport
                        spanW={spanW}
                        heightH={heightH}
                        benchHeight={wallH}
                        wallHeight={wallH}
                        geometry={geometry}
                        pullLengthM={pullLength}
                        pullLength={pullLength}
                        currentChainage={currentFaceChainageNum}
                        currentFaceChainage={currentFaceChainageNum}
                        driveAzimuth={customDriveAzimuth}
                        governingStrike={customStrike}
                        governingDip={customDip}
                        governingDipDirection={customDipDirection}
                        governingSet={fedData.governingJoint?.set || 'J1'}
                        governingType={fedData.governingJoint?.type || 'Discontinuity'}
                        apparentDipBetaApp={apparentCalculations.apparentDipWallDeg}
                        apparentDipDeg={apparentCalculations.apparentDipWallDeg}
                        advanceRatePerVerticalMeter={apparentCalculations.advanceRatePerVerticalMeter}
                      />
                    </div>

                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                            AHEAD-OF-FACE STATION SCHEDULE (+30m)
                          </div>
                          <div className="text-xs font-mono text-slate-300 mt-0.5 tabular-nums">
                            Governing Plane: <strong>{fedData.governingJoint?.set || 'J1'}</strong> (Strike {customStrike}° / Dip {customDip}°)
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-950/90 border border-slate-800 rounded p-2">
                            <div className="text-[9px] font-mono text-slate-500 uppercase">Apparent Wall Dip</div>
                            <div className="text-sm font-mono font-bold text-amber-400 tabular-nums mt-0.5">
                              {apparentCalculations.apparentDipWallDeg.toFixed(1)}°
                            </div>
                          </div>
                          <div className="bg-slate-950/90 border border-slate-800 rounded p-2">
                            <div className="text-[9px] font-mono text-slate-500 uppercase">Crown → Invert Span</div>
                            <div className="text-sm font-mono font-bold text-sky-400 tabular-nums mt-0.5">
                              {apparentCalculations.distanceCrownToInvert.toFixed(1)} m
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-800 rounded-lg">
                          <table className="w-full text-left border-collapse font-mono text-[11px] tabular-nums">
                            <thead>
                              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                                <th className="py-1.5 px-2">Advance</th>
                                <th className="py-1.5 px-2">Station</th>
                                <th className="py-1.5 px-2">Elev Z</th>
                                <th className="py-1.5 px-2">Position</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                              {apparentCalculations.forecastTable.map((row) => (
                                <tr key={row.distAhead} className="hover:bg-slate-800/40">
                                  <td className="py-1.5 px-2 font-bold text-sky-300">+{row.distAhead}m</td>
                                  <td className="py-1.5 px-2 text-slate-200">RD {row.targetChainage}m</td>
                                  <td className="py-1.5 px-2 text-emerald-400">{row.elevationAboveInvert}m</td>
                                  <td className="py-1.5 px-2 text-slate-300">{row.zoneLocation}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-slate-950/90 border border-slate-800 rounded p-2.5 text-[10px] font-mono text-slate-400">
                        tan(α_wall) = tan({customDip}°) · |sin({customStrike}° - {Math.round(customDriveAzimuth)}°)| ={' '}
                        <strong className="text-sky-300">
                          {Math.tan((apparentCalculations.apparentDipWallDeg * Math.PI) / 180).toFixed(3)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 5. 3D KINEMATIC WEDGE & BOLT FOS ==================== */}
                {activeTab === 'WEDGE_FOS' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left 8 Cols: 3D Kinematic Wedge */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                      <div className="min-h-[450px] flex-1 flex flex-col">
                        <KinematicWedge3DViewport
                          spanW={spanW}
                          heightH={heightH}
                          benchHeight={wallH}
                          wallHeight={wallH}
                          pullLengthM={pullLength}
                          geometry={geometry}
                          wedgeVolumeM3={wedgeAnalysis.wedgeVolumeM3}
                          wedgeWeightMN={wedgeAnalysis.wedgeWeightKn / 1000}
                          wedgeWeightKn={wedgeAnalysis.wedgeWeightKn}
                          apexHeightM={wedgeAnalysis.apexHeightM}
                          fosUnbolted={wedgeAnalysis.fosUnbolted}
                          fosBolted={wedgeAnalysis.fosBolted}
                          boltLengthM={boltLengthM}
                          boltSpacingM={boltSpacingM}
                          boltCapacityMN={boltCapacityKn / 1000}
                          governingStrike={customStrike}
                          governingDip={customDip}
                          governingDipDirection={customDipDirection}
                          driveAzimuth={customDriveAzimuth}
                          failureMode={wedgeAnalysis.failureMode}
                        />
                      </div>
                    </div>

                    {/* Right 4 Cols: Compact Engineering Inspector & 2D CAD Wedge Cross-Section */}
                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                              GOODMAN-SHI WEDGE EQUILIBRIUM
                            </div>
                            <div className="text-xs font-mono text-slate-300 tabular-nums">
                              FoS Unbolted: <strong className="text-rose-400">{wedgeAnalysis.fosUnbolted.toFixed(2)}</strong> → Bolted: <strong className="text-emerald-400">{wedgeAnalysis.fosBolted.toFixed(2)}</strong>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              wedgeAnalysis.fosBolted >= 1.5
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {wedgeAnalysis.fosBolted >= 1.5 ? 'STABLE' : 'REINFORCE'}
                          </span>
                        </div>

                        {/* 2D CAD Cross-Section with Exact Tunnel Profile & Crown Wedge on White Background */}
                        <div className="bg-white border border-slate-300 rounded-lg p-2 shadow-2xs">
                          <div className="flex justify-between text-[10px] font-mono text-slate-700 font-bold mb-1">
                            <span>2D CAD WEDGE &amp; BOLT ANCHORAGE</span>
                            <span className="text-sky-700 tabular-nums">Apex = {wedgeAnalysis.apexHeightM.toFixed(2)}m</span>
                          </div>
                          <svg viewBox="0 0 320 220" className="w-full h-40 bg-white">
                            <rect width="320" height="220" fill="#ffffff" />
                            {(() => {
                              const scale = Math.min(180 / Math.max(1, spanW), 105 / Math.max(1, heightH));
                              const cx = 160;
                              const baseY = 195;
                              const { pathD, pointsSvg } = buildSvgTunnelProfilePath(geometry, spanW, heightH, wallH, cx, baseY, scale);
                              const crownY = baseY - heightH * scale;
                              const apexY = Math.max(14, crownY - wedgeAnalysis.apexHeightM * scale);
                              const halfWedgeM = Math.min(spanW * 0.34, 65 / Math.max(1, scale));
                              const halfWedgePx = halfWedgeM * scale;
                              const archYAtWedgeBase = getCrownArchYAtX(geometry, halfWedgeM, spanW, heightH, wallH);
                              const crownEdgeY = baseY - archYAtWedgeBase * scale;

                              return (
                                <>
                                  <line x1="25" y1={baseY} x2="295" y2={baseY} stroke="#94a3b8" strokeWidth="1.2" />
                                  <path d={pathD} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
                                  {/* Tetrahedral Wedge Polygon */}
                                  <polygon
                                    points={`${cx - halfWedgePx},${crownEdgeY} ${cx},${apexY} ${cx + halfWedgePx},${crownEdgeY}`}
                                    fill={wedgeAnalysis.fosBolted < 1.5 ? 'rgba(220,38,38,0.22)' : 'rgba(5,150,105,0.22)'}
                                    stroke={wedgeAnalysis.fosBolted < 1.5 ? '#dc2626' : '#059669'}
                                    strokeWidth="2"
                                  />
                                  {/* Radial Pattern Bolts Normal to Crown */}
                                  {pointsSvg
                                    .filter((p) => p.rawY >= wallH * 0.8)
                                    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 5)) === 0)
                                    .map((pt, idx) => {
                                      const dx = pt.rawX;
                                      const dy = Math.max(0.3, pt.rawY - wallH * 0.65);
                                      const len = Math.hypot(dx, dy) || 1;
                                      const ux = dx / len;
                                      const uy = dy / len;
                                      const x2 = pt.x + ux * boltLengthM * scale;
                                      const y2 = pt.y - uy * boltLengthM * scale;
                                      return (
                                        <line
                                          key={idx}
                                          x1={pt.x}
                                          y1={pt.y}
                                          x2={x2}
                                          y2={y2}
                                          stroke="#0284c7"
                                          strokeWidth="2"
                                        />
                                      );
                                    })}
                                  <text x={cx + halfWedgePx + 6} y={Math.max(24, apexY + 12)} fill="#0f172a" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                    W = {wedgeAnalysis.wedgeWeightKn.toFixed(0)} kN
                                  </text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>

                        {/* Interactive Bolt & Joint Shear Controls */}
                        <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded p-2.5">
                          <div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-300">
                              <span>Bolt Length L_b</span>
                              <span className="text-sky-300 font-bold tabular-nums">{boltLengthM.toFixed(1)} m</span>
                            </div>
                            <input
                              type="range"
                              min={2.0}
                              max={8.0}
                              step={0.5}
                              value={boltLengthM}
                              onChange={(e) => setBoltLengthM(Number(e.target.value))}
                              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-300">
                              <span>Pattern Bolt Spacing S_b × S_l</span>
                              <span className="text-sky-300 font-bold tabular-nums">{boltSpacingM.toFixed(2)} m</span>
                            </div>
                            <input
                              type="range"
                              min={0.8}
                              max={2.5}
                              step={0.1}
                              value={boltSpacingM}
                              onChange={(e) => setBoltSpacingM(Number(e.target.value))}
                              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-300">
                              <span>Joint Friction Angle φ &amp; Cohesion c</span>
                              <span className="text-emerald-400 font-bold tabular-nums">{frictionAngleDeg}° / {cohesionKpa} kPa</span>
                            </div>
                            <input
                              type="range"
                              min={15}
                              max={50}
                              step={1}
                              value={frictionAngleDeg}
                              onChange={(e) => setFrictionAngleDeg(Number(e.target.value))}
                              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500 uppercase">Req. Support Press.</div>
                          <div className="font-bold text-amber-300">{wedgeAnalysis.requiredSupportPressureKpa.toFixed(1)} kPa</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500 uppercase">Installed Capacity</div>
                          <div className="font-bold text-cyan-300">{wedgeAnalysis.installedSupportPressureKpa.toFixed(1)} kPa</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 6. APPARENT DIP & STEREONET SOLVER ==================== */}
                {activeTab === 'APPARENT_DIP_SOLVER' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left 8 Cols: Dual CAD Stereonet & Unfolded Wall/Face Apparent Trace Diagram */}
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            EQUAL-ANGLE HEMISPHERE STEREONET &amp; APPARENT TRACE PROJECTION
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            True Strike {customStrike}° / Dip {customDip}° / DipDir {customDipDirection}° vs Tunnel Axis {Math.round(customDriveAzimuth)}°
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300">
                          β = {apparentCalculations.betaDeg.toFixed(1)}°
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center my-auto">
                        {/* Equal-Angle Stereonet SVG on White Engineering Canvas */}
                        <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center shadow-2xs">
                          <div className="text-[10px] font-mono text-slate-700 font-bold uppercase mb-1">
                            Lower Hemisphere Stereonet
                          </div>
                          <svg viewBox="0 0 260 260" className="w-56 h-56 bg-white">
                            <rect width="260" height="260" fill="#ffffff" />
                            <circle cx="130" cy="130" r="102" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.8" />
                            <circle cx="130" cy="130" r="68" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                            <circle cx="130" cy="130" r="34" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                            <line x1="130" y1="22" x2="130" y2="238" stroke="#cbd5e1" strokeWidth="1" />
                            <line x1="22" y1="130" x2="238" y2="130" stroke="#cbd5e1" strokeWidth="1" />
                            <text x="126" y="16" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">N</text>
                            <text x="242" y="133" fill="#334155" fontSize="9.5" fontFamily="monospace" fontWeight="bold">E</text>
                            <text x="126" y="252" fill="#334155" fontSize="9.5" fontFamily="monospace" fontWeight="bold">S</text>
                            <text x="10" y="133" fill="#334155" fontSize="9.5" fontFamily="monospace" fontWeight="bold">W</text>

                            {/* Tunnel Drive Axis Vector */}
                            {(() => {
                              const azRad = ((customDriveAzimuth - 90) * Math.PI) / 180;
                              const x1 = 130 - 102 * Math.cos(azRad);
                              const y1 = 130 - 102 * Math.sin(azRad);
                              const x2 = 130 + 102 * Math.cos(azRad);
                              const y2 = 130 + 102 * Math.sin(azRad);
                              return (
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0284c7" strokeWidth="2.2" strokeDasharray="5,3" />
                              );
                            })()}

                            {/* All Mapped Joint Poles */}
                            {mapped3DTraces.map((jt, idx) => {
                              const poleAzRad = (((jt.dipDirection + 180) % 360 - 90) * Math.PI) / 180;
                              const rPole = 102 * Math.tan(((jt.dip / 2) * Math.PI) / 180);
                              const px = 130 + rPole * Math.cos(poleAzRad);
                              const py = 130 + rPole * Math.sin(poleAzRad);
                              return (
                                <g key={jt.id || idx}>
                                  <circle cx={px} cy={py} r="4.5" fill="#d97706" stroke="#ffffff" strokeWidth="1.2" />
                                  <text x={px + 6} y={py + 3} fill="#0f172a" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                                    {jt.set}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Apparent Dip Vector Decomposition on Wall & Face on White Canvas */}
                        <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center shadow-2xs">
                          <div className="text-[10px] font-mono text-slate-700 font-bold uppercase mb-1">
                            Wall vs Face Apparent Trace Inclination
                          </div>
                          <svg viewBox="0 0 260 260" className="w-56 h-56 bg-white">
                            <rect width="260" height="260" fill="#ffffff" />
                            {/* Upper Box: Sidewall Profile */}
                            <rect x="20" y="18" width="220" height="96" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
                            <text x="28" y="33" fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold">
                              SIDEWALL TRACE (α_wall = {apparentCalculations.apparentDipWallDeg.toFixed(1)}°)
                            </text>
                            {(() => {
                              const rad = (apparentCalculations.apparentDipWallDeg * Math.PI) / 180;
                              const dx = 65 * Math.cos(rad);
                              const dy = 34 * Math.sin(rad);
                              return (
                                <line
                                  x1={130 - dx}
                                  y1={72 - dy}
                                  x2={130 + dx}
                                  y2={72 + dy}
                                  stroke="#059669"
                                  strokeWidth="2.8"
                                />
                              );
                            })()}

                            {/* Lower Box: Active Face Profile with Exact Fed Tunnel Shape */}
                            <rect x="20" y="130" width="220" height="114" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
                            <text x="28" y="144" fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold">
                              FACE TRACE (α_face = {apparentCalculations.apparentDipFaceDeg.toFixed(1)}°)
                            </text>
                            {(() => {
                              const scale = Math.min(110 / Math.max(1, spanW), 72 / Math.max(1, heightH));
                              const { pathD } = buildSvgTunnelProfilePath(geometry, spanW, heightH, wallH, 130, 232, scale);
                              const rad = (apparentCalculations.apparentDipFaceDeg * Math.PI) / 180;
                              const halfSpanPx = Math.min(48, spanW * 0.44 * scale);
                              const dx = halfSpanPx * Math.cos(rad);
                              const dy = halfSpanPx * Math.sin(rad);
                              const cyFace = 232 - heightH * 0.5 * scale;
                              return (
                                <>
                                  <path d={pathD} fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
                                  <line
                                    x1={130 - dx}
                                    y1={cyFace - dy}
                                    x2={130 + dx}
                                    y2={cyFace + dy}
                                    stroke="#d97706"
                                    strokeWidth="2.5"
                                  />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-[11px] font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2 tabular-nums mt-3">
                        <span>tan(α_wall) = tan(δ) · |sin(Strike - Azimuth)|</span>
                        <span className="text-emerald-400 font-bold">
                          α_wall = {apparentCalculations.apparentDipWallDeg.toFixed(2)}° | α_face = {apparentCalculations.apparentDipFaceDeg.toFixed(2)}°
                        </span>
                      </div>
                    </div>

                    {/* Right 4 Cols: Orientation Parameter Controls */}
                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                            ORIENTATION SOLVER CONTROLS
                          </div>
                          <div className="text-xs font-mono text-slate-400 mt-0.5">
                            Synced from active mapped discontinuity sets
                          </div>
                        </div>

                        <div className="space-y-3 bg-slate-950/90 border border-slate-800 rounded p-3">
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Tunnel Drive Azimuth</span>
                              <span className="text-sky-300 font-bold tabular-nums">{Math.round(customDriveAzimuth)}°</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={customDriveAzimuth}
                              onChange={(e) => setCustomDriveAzimuth(clampDriveAzimuth(e.target.value).value)}
                              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>True Dip Angle (δ)</span>
                              <span className="text-amber-300 font-bold tabular-nums">{customDip}°</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={90}
                              value={customDip}
                              onChange={(e) => setCustomDip(clampDiscontinuityDip(e.target.value).value)}
                              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Dip Direction (α_d)</span>
                              <span className="text-emerald-400 font-bold tabular-nums">{customDipDirection}°</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={customDipDirection}
                              onChange={(e) => {
                                const dd = clampDiscontinuityDipDirection(e.target.value).value;
                                setCustomDipDirection(dd);
                                setCustomStrike((dd - 90 + 360) % 360);
                              }}
                              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                        </div>

                        {/* Mapped Discontinuity Selector List */}
                        <div>
                          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1.5">
                            Select Mapped Discontinuity ({mapped3DTraces.length})
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                            {mapped3DTraces.map((jt, idx) => (
                              <button
                                key={jt.id || idx}
                                onClick={() => {
                                  setCustomDip(jt.dip);
                                  setCustomDipDirection(jt.dipDirection);
                                  setCustomStrike(jt.strike ?? ((jt.dipDirection - 90 + 360) % 360));
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-[11px] font-mono tabular-nums transition"
                              >
                                <span className="font-bold text-sky-300">
                                  {jt.set} ({jt.type})
                                </span>
                                <span className="text-slate-300">
                                  Dip {jt.dip}° / {String(jt.dipDirection).padStart(3, '0')}°
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 7. APPARENT THICKNESS & SPACING ==================== */}
                {activeTab === 'APPARENT_THICKNESS_SPACING' && (
                  <ComponentApparentThicknessView
                    alphaDriveDefault={customDriveAzimuth}
                    betaDefault={customDip}
                    thetaDipDefault={customDipDirection}
                    sTrueDefault={fedData.governingJoint?.spacingM ?? 0.45}
                    tTrueDefault={fedData.governingJoint?.thicknessM ?? 0.15}
                  />
                )}

                {/* ==================== 8. PALMSTROM Jv & 3D BLOCK VOLUME ==================== */}
                {activeTab === 'PALMSTROM_BLOCKS' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left 8 Cols: 2D Isometric CAD Block Polyhedron & Sieve Curve */}
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            PALMSTRÖM (1996/2005) 3D UNIT ROCK BLOCK &amp; VOLUMETRIC JOINT COUNT (Jv)
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            True Spacings: S₁ = {standupAndBlockAnalysis.s1.toFixed(2)}m | S₂ = {standupAndBlockAnalysis.s2.toFixed(2)}m | S₃ = {standupAndBlockAnalysis.s3.toFixed(2)}m
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 tabular-nums">
                          V_b = {standupAndBlockAnalysis.blockVolumeM3.toFixed(3)} m³
                        </span>
                      </div>

                      <div className="my-auto py-3 bg-white border border-slate-300 rounded-lg my-3">
                        <svg viewBox="0 0 560 250" className="w-full h-60 bg-white">
                          <rect width="560" height="250" fill="#ffffff" />
                          {(() => {
                            const maxS = Math.max(standupAndBlockAnalysis.s1, standupAndBlockAnalysis.s2, standupAndBlockAnalysis.s3, 0.3);
                            const wx = (standupAndBlockAnalysis.s1 / maxS) * 95;
                            const wy = (standupAndBlockAnalysis.s2 / maxS) * 75;
                            const wz = (standupAndBlockAnalysis.s3 / maxS) * 60;
                            const cx = 175;
                            const cy = 145;
                            return (
                              <g>
                                {/* Isometric 3D Unit Rock Block */}
                                <polygon
                                  points={`${cx - wx * 0.5},${cy - wy * 0.5} ${cx + wx * 0.5},${cy - wy * 0.5} ${cx + wx * 0.5},${cy + wy * 0.5} ${cx - wx * 0.5},${cy + wy * 0.5}`}
                                  fill="rgba(2,132,199,0.18)"
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                />
                                <polygon
                                  points={`${cx - wx * 0.5},${cy - wy * 0.5} ${cx - wx * 0.5 + wz * 0.6},${cy - wy * 0.5 - wz * 0.45} ${cx + wx * 0.5 + wz * 0.6},${cy - wy * 0.5 - wz * 0.45} ${cx + wx * 0.5},${cy - wy * 0.5}`}
                                  fill="rgba(14,165,233,0.28)"
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                />
                                <polygon
                                  points={`${cx + wx * 0.5},${cy - wy * 0.5} ${cx + wx * 0.5 + wz * 0.6},${cy - wy * 0.5 - wz * 0.45} ${cx + wx * 0.5 + wz * 0.6},${cy + wy * 0.5 - wz * 0.45} ${cx + wx * 0.5},${cy + wy * 0.5}`}
                                  fill="rgba(3,105,161,0.24)"
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                />
                                <text x={cx - 35} y={cy + wy * 0.5 + 18} fill="#0369a1" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  S₁ = {standupAndBlockAnalysis.s1.toFixed(2)}m
                                </text>
                                <text x={cx - wx * 0.5 - 68} y={cy} fill="#047857" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  S₂ = {standupAndBlockAnalysis.s2.toFixed(2)}m
                                </text>
                                <text x={cx + wx * 0.5 + wz * 0.6 + 8} y={cy - wy * 0.5 - wz * 0.2} fill="#b45309" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  S₃ = {standupAndBlockAnalysis.s3.toFixed(2)}m
                                </text>

                                {/* Right Side: Jv -> RQD Correlation Box */}
                                <rect x="330" y="38" width="205" height="175" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                                <text x="345" y="60" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  PALMSTRÖM RQD CORRELATIONS
                                </text>
                                <text x="345" y="88" fill="#1e293b" fontSize="11" fontFamily="monospace" fontWeight="bold">
                                  Jv = {standupAndBlockAnalysis.jvVolumetricCount.toFixed(2)} joints/m³
                                </text>
                                <text x="345" y="116" fill="#047857" fontSize="11" fontFamily="monospace" fontWeight="bold">
                                  RQD (1982) = {standupAndBlockAnalysis.rqdPalmstrom1982.toFixed(1)}%
                                </text>
                                <text x="345" y="142" fill="#0369a1" fontSize="11" fontFamily="monospace" fontWeight="bold">
                                  RQD (2005) = {standupAndBlockAnalysis.rqdPalmstrom2005.toFixed(1)}%
                                </text>
                                <text x="345" y="170" fill="#b45309" fontSize="11" fontFamily="monospace" fontWeight="bold">
                                  D_eq = {(standupAndBlockAnalysis.equivalentBlockDiaM * 100).toFixed(1)} cm
                                </text>
                                <text x="345" y="195" fill="#475569" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                  {standupAndBlockAnalysis.blockClass}
                                </text>
                              </g>
                            );
                          })()}
                        </svg>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-[11px] font-mono text-slate-400 flex items-center justify-between tabular-nums">
                        <span>J_v = 1/S₁ + 1/S₂ + 1/S₃ + N_r/5</span>
                        <span className="text-sky-300 font-bold">V_b = β · J_v⁻³ (β = 36)</span>
                      </div>
                    </div>

                    {/* Right 4 Cols: Palmström Numeric Inspector */}
                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                            BLOCK SIZE SUMMARY
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase">Volumetric Jv</div>
                            <div className="text-base font-bold text-white mt-0.5">
                              {standupAndBlockAnalysis.jvVolumetricCount.toFixed(2)} <span className="text-[10px] text-slate-400">j/m³</span>
                            </div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase">Block Volume Vb</div>
                            <div className="text-base font-bold text-emerald-400 mt-0.5">
                              {standupAndBlockAnalysis.blockVolumeM3.toFixed(3)} <span className="text-[10px] text-slate-400">m³</span>
                            </div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase">RQD (115 - 3.3Jv)</div>
                            <div className="text-base font-bold text-sky-400 mt-0.5">
                              {standupAndBlockAnalysis.rqdPalmstrom1982.toFixed(1)}%
                            </div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase">Eq. Block Dia</div>
                            <div className="text-base font-bold text-amber-400 mt-0.5">
                              {(standupAndBlockAnalysis.equivalentBlockDiaM * 100).toFixed(1)} cm
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-[11px] font-mono text-slate-300">
                        Block Classification: <strong className="text-emerald-400">{standupAndBlockAnalysis.blockClass}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 9. HOEK-BROWN (2002) ROCK MASS CRITERION ==================== */}
                {activeTab === 'HOEK_BROWN_ROCK' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left 8 Cols: Principal Stress Failure Envelope SVG on White Canvas */}
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            GENERALIZED HOEK-BROWN (2002) PRINCIPAL STRESS FAILURE ENVELOPE (σ₁ vs σ₃)
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            GSI = {hoekBrownAnalysis.gsi} | σ_ci = {intactUcsMpa} MPa | m_i = {hoekBrownMi} | D = {disturbanceFactorD}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 tabular-nums">
                          E_rm = {hoekBrownAnalysis.deformationModulusGpa.toFixed(2)} GPa
                        </span>
                      </div>

                      <div className="my-auto py-2 bg-white border border-slate-300 rounded-lg my-3">
                        <svg viewBox="0 0 560 260" className="w-full h-64 bg-white">
                          <rect width="560" height="260" fill="#ffffff" />
                          <rect x="55" y="20" width="465" height="200" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                          <line x1="55" y1="220" x2="520" y2="220" stroke="#0f172a" strokeWidth="1.5" />
                          <line x1="55" y1="20" x2="55" y2="220" stroke="#0f172a" strokeWidth="1.5" />
                          {(() => {
                            const pts = hoekBrownAnalysis.envelopePoints;
                            const maxSig3 = Math.max(1, pts[pts.length - 1]?.sig3 || 20);
                            const maxSig1 = Math.max(5, pts[pts.length - 1]?.sig1 || 100);
                            const polyPts = pts
                              .map((p) => {
                                const x = 55 + (p.sig3 / maxSig3) * 450;
                                const y = 220 - (p.sig1 / maxSig1) * 185;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ');
                            return (
                              <>
                                <polyline fill="none" stroke="#0284c7" strokeWidth="2.8" points={polyPts} />
                                <text x="200" y="245" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  Minor Principal Stress σ₃ (0 → {maxSig3.toFixed(1)} MPa)
                                </text>
                                <text x="68" y="38" fill="#0369a1" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  Major Principal Stress σ₁ (Max {maxSig1.toFixed(1)} MPa)
                                </text>
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px] tabular-nums">
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">m_b</div>
                          <div className="font-bold text-sky-300">{hoekBrownAnalysis.mb.toFixed(3)}</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">s</div>
                          <div className="font-bold text-emerald-400">{hoekBrownAnalysis.s.toFixed(4)}</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">a</div>
                          <div className="font-bold text-amber-300">{hoekBrownAnalysis.a.toFixed(3)}</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">σ_cm (Global)</div>
                          <div className="font-bold text-white">{hoekBrownAnalysis.globalStrengthSigmaCmMpa.toFixed(2)} MPa</div>
                        </div>
                      </div>
                    </div>

                    {/* Right 4 Cols: Intact Rock & Overburden Controls */}
                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                            HOEK-BROWN INPUT PARAMETERS
                          </div>
                        </div>

                        <div className="space-y-2.5 bg-slate-950/90 border border-slate-800 rounded p-3">
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Intact Rock UCS (σ_ci)</span>
                              <span className="text-sky-300 font-bold tabular-nums">{intactUcsMpa} MPa</span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={250}
                              step={5}
                              value={intactUcsMpa}
                              onChange={(e) => setIntactUcsMpa(clampUcsMpa(e.target.value).value ?? 75)}
                              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Hoek-Brown Constant (m_i)</span>
                              <span className="text-amber-300 font-bold tabular-nums">{hoekBrownMi}</span>
                            </div>
                            <input
                              type="range"
                              min={4}
                              max={35}
                              step={1}
                              value={hoekBrownMi}
                              onChange={(e) => setHoekBrownMi(Number(e.target.value))}
                              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Blast Disturbance Factor (D)</span>
                              <span className="text-emerald-400 font-bold tabular-nums">{disturbanceFactorD.toFixed(1)}</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={0.8}
                              step={0.1}
                              value={disturbanceFactorD}
                              onChange={(e) => setDisturbanceFactorD(Number(e.target.value))}
                              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Overburden Depth (H)</span>
                              <span className="text-purple-300 font-bold tabular-nums">{overburdenDepthM} m</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={800}
                              step={10}
                              value={overburdenDepthM}
                              onChange={(e) => setOverburdenDepthM(Number(e.target.value))}
                              className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                          <div className="bg-slate-950 border border-slate-800 rounded p-2">
                            <div className="text-[9px] text-slate-500">Eq. Friction φ'</div>
                            <div className="font-bold text-emerald-400">{hoekBrownAnalysis.equivalentFrictionDeg.toFixed(1)}°</div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2">
                            <div className="text-[9px] text-slate-500">Eq. Cohesion c'</div>
                            <div className="font-bold text-sky-300">{hoekBrownAnalysis.equivalentCohesionKpa.toFixed(0)} kPa</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 10. BIENIAWSKI STAND-UP TIME & ACTIVE SPAN ==================== */}
                {activeTab === 'STANDUP_TIME_SPAN' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            BIENIAWSKI (1989) UNSUPPORTED STAND-UP TIME vs ACTIVE SPAN CHART
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            Active Span S = {standupAndBlockAnalysis.activeSpanM.toFixed(2)}m | RMR₈₉ = {safeRmrForCalc}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 tabular-nums">
                          t_standup = {standupAndBlockAnalysis.standupHours.toFixed(1)} hrs
                        </span>
                      </div>

                      <div className="my-auto py-2 bg-white border border-slate-300 rounded-lg my-3">
                        <svg viewBox="0 0 560 250" className="w-full h-60 bg-white">
                          <rect width="560" height="250" fill="#ffffff" />
                          <rect x="60" y="20" width="460" height="195" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                          {/* Log-Log Standup Time Bands for RMR 20, 40, 60, 80 */}
                          <line x1="60" y1="215" x2="520" y2="215" stroke="#0f172a" strokeWidth="1.5" />
                          <line x1="60" y1="20" x2="60" y2="215" stroke="#0f172a" strokeWidth="1.5" />
                          {[20, 40, 60, 80].map((rmrCurve, idx) => {
                            const x1 = 60;
                            const y1 = 215 - (rmrCurve / 100) * 165;
                            const x2 = 475;
                            const y2 = Math.min(215, y1 + 65);
                            const colors = ['#dc2626', '#d97706', '#0284c7', '#059669'];
                            return (
                              <g key={rmrCurve}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors[idx]} strokeWidth="2" strokeDasharray="4,3" />
                                <text x={x2 + 6} y={y2 + 3} fill={colors[idx]} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                  RMR {rmrCurve}
                                </text>
                              </g>
                            );
                          })}
                          {/* Active Operating Point */}
                          {(() => {
                            const logT = Math.max(-1, Math.min(5, Math.log10(standupAndBlockAnalysis.standupHours)));
                            const px = 60 + ((logT + 1) / 6) * 415;
                            const py = 215 - Math.min(185, (standupAndBlockAnalysis.activeSpanM / 20) * 185);
                            return (
                              <g>
                                <circle cx={px} cy={py} r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                                <text x={Math.min(340, px + 10)} y={Math.max(32, py - 6)} fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  Active Face ({standupAndBlockAnalysis.standupHours.toFixed(1)}h, {standupAndBlockAnalysis.activeSpanM.toFixed(1)}m)
                                </text>
                              </g>
                            );
                          })()}
                          <text x="190" y="240" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            Stand-Up Time (Log Scale: 0.1 hr → 10⁵ hrs)
                          </text>
                        </svg>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5 font-mono tabular-nums">
                        <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold border-b border-slate-800 pb-2">
                          STAND-UP TIME READOUT
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                          <div className="text-[9px] text-slate-500 uppercase">Unsupported Stand-Up Time</div>
                          <div className="text-lg font-bold text-emerald-400 mt-0.5">
                            {standupAndBlockAnalysis.standupHours.toFixed(1)} hrs ({standupAndBlockAnalysis.standupDays.toFixed(2)} days)
                          </div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                          <div className="text-[9px] text-slate-500 uppercase">Active Unsupported Span</div>
                          <div className="text-base font-bold text-sky-300 mt-0.5">
                            {standupAndBlockAnalysis.activeSpanM.toFixed(2)} m
                          </div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                          <div className="text-[9px] text-slate-500 uppercase">Max Safe Unsupported Span</div>
                          <div className="text-base font-bold text-amber-300 mt-0.5">
                            {standupAndBlockAnalysis.maxUnsupportedSpanM.toFixed(2)} m
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 11. HYDROGEOLOGICAL INFLOW & GROUTING ==================== */}
                {activeTab === 'HYDRO_INFLOW' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left 8 Cols: Exact Tunnel Profile Hydrostatic Head & Pre-Grouting Ring SVG on White Canvas */}
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            GOODMAN-HEUER STEADY GROUNDWATER INFLOW &amp; GROUT RING ENVELOPE
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            Piezometric Head H_w = {waterHeadM}m | Permeability k = {hydroAnalysis.baseK.toExponential(1)} m/s
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 tabular-nums">
                          P_w = {hydroAnalysis.hydrostaticPressureMpa.toFixed(2)} MPa
                        </span>
                      </div>

                      <div className="my-auto py-2 bg-white border border-slate-300 rounded-lg my-3">
                        <svg viewBox="0 0 520 240" className="w-full h-60 bg-white">
                          <rect width="520" height="240" fill="#ffffff" />
                          {(() => {
                            const scale = Math.min(160 / Math.max(1, spanW), 110 / Math.max(1, heightH));
                            const cx = 260;
                            const baseY = 195;
                            const { pathD } = buildSvgTunnelProfilePath(geometry, spanW, heightH, wallH, cx, baseY, scale);
                            const groutScale = scale * 1.42;
                            const groutRing = buildSvgTunnelProfilePath(
                              geometry,
                              spanW,
                              heightH,
                              wallH,
                              cx,
                              baseY + (groutScale - scale) * (heightH * 0.45),
                              groutScale
                            );
                            return (
                              <>
                                {/* Water Table Line */}
                                <line x1="40" y1="24" x2="480" y2="24" stroke="#0284c7" strokeWidth="1.8" strokeDasharray="6,3" />
                                <text x="45" y="17" fill="#0369a1" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                                  PIEZOMETRIC HEAD H_w = {waterHeadM}m ({hydroAnalysis.hydrostaticPressureMpa.toFixed(2)} MPa)
                                </text>
                                {/* Pre-Injection Grouted Halo */}
                                <path
                                  d={groutRing.pathD}
                                  fill="rgba(2,132,199,0.12)"
                                  stroke="#0284c7"
                                  strokeWidth="1.8"
                                  strokeDasharray="4,3"
                                />
                                {/* Exact Tunnel Profile */}
                                <path d={pathD} fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                                <text x={cx - 85} y="226" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                                  Grouted Inflow: {hydroAnalysis.groutedLitersPerMinPer100m.toFixed(1)} L/min/100m
                                </text>
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>

                    {/* Right 4 Cols: Hydro Controls & Readout */}
                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="border-b border-slate-800 pb-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                            HYDROGEOLOGICAL CONTROLS
                          </div>
                        </div>

                        <div className="space-y-2.5 bg-slate-950 border border-slate-800 rounded p-3">
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Piezometric Head (H_w)</span>
                              <span className="text-sky-300 font-bold tabular-nums">{waterHeadM} m</span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={350}
                              step={5}
                              value={waterHeadM}
                              onChange={(e) => setWaterHeadM(Number(e.target.value))}
                              className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-300">
                              <span>Pre-Grouting Efficiency</span>
                              <span className="text-emerald-400 font-bold tabular-nums">{groutReductionPct}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={95}
                              step={5}
                              value={groutReductionPct}
                              onChange={(e) => setGroutReductionPct(Number(e.target.value))}
                              className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded mt-1"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                          <div className="bg-slate-950 border border-slate-800 rounded p-2">
                            <div className="text-[9px] text-slate-500">Ungrouted Inflow</div>
                            <div className="font-bold text-rose-400">{hydroAnalysis.ungroutedLitersPerMinPer100m.toFixed(1)} L/m</div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2">
                            <div className="text-[9px] text-slate-500">Grouted Residual</div>
                            <div className="font-bold text-emerald-400">{hydroAnalysis.groutedLitersPerMinPer100m.toFixed(1)} L/m</div>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded p-2 col-span-2">
                            <div className="text-[9px] text-slate-500">Recommended Injection Pressure</div>
                            <div className="font-bold text-sky-300">{hydroAnalysis.suggestedGroutPressureMpa.toFixed(2)} MPa</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 12. PORTAL CUT & STABILIZATION ==================== */}
                {activeTab === 'SLOPE_STABILITY_AND_STABILIZATION' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-xs font-mono font-bold text-white uppercase">
                            ROMANA SMR PORTAL CUT &amp; TENSIONED ROCK ANCHOR LIMIT EQUILIBRIUM
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            Cut Height H = {slopeHeightM}m | Slope Dip {slopeAngleDeg}° | Joint Dip {customDip}°
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 tabular-nums">
                          SMR = {slopeAndStabilizationAnalysis.computedSmr} | FoS = {slopeAndStabilizationAnalysis.fosSlopeReinforced.toFixed(2)}
                        </span>
                      </div>

                      <div className="my-auto py-2 bg-white border border-slate-300 rounded-lg my-3">
                        <svg viewBox="0 0 540 240" className="w-full h-60 bg-white">
                          <rect width="540" height="240" fill="#ffffff" />
                          {/* Portal Cut Slope & Daylight Failure Plane CAD Cross-Section */}
                          <line x1="40" y1="205" x2="500" y2="205" stroke="#475569" strokeWidth="1.5" />
                          <polygon
                            points="120,205 230,45 470,45 470,205"
                            fill="#f1f5f9"
                            stroke="#0f172a"
                            strokeWidth="2"
                          />
                          {/* Failure Plane */}
                          <line x1="120" y1="205" x2="345" y2="45" stroke="#dc2626" strokeWidth="2.4" strokeDasharray="5,3" />
                          {/* Tensioned Rock Anchors */}
                          {[85, 125, 165].map((yPos, idx) => {
                            const xStart = 120 + ((205 - yPos) / 160) * 110;
                            return (
                              <line
                                key={idx}
                                x1={xStart}
                                y1={yPos}
                                x2={xStart + 115}
                                y2={yPos + 28}
                                stroke="#0284c7"
                                strokeWidth="2.4"
                              />
                            );
                          })}
                          <text x="120" y="226" fill="#0f172a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            Unreinforced FoS = {slopeAndStabilizationAnalysis.fosSlopeUnreinforced.toFixed(2)} → Anchored FoS = {slopeAndStabilizationAnalysis.fosSlopeReinforced.toFixed(2)}
                          </text>
                        </svg>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5 bg-slate-950 border border-slate-800 rounded p-3">
                        <div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-300">
                            <span>Cut Slope Angle (β_s)</span>
                            <span className="text-sky-300 font-bold tabular-nums">{slopeAngleDeg}°</span>
                          </div>
                          <input
                            type="range"
                            min={35}
                            max={85}
                            value={slopeAngleDeg}
                            onChange={(e) => setSlopeAngleDeg(Number(e.target.value))}
                            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded mt-1"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] font-mono text-slate-300">
                            <span>Anchor Force T (kN/m)</span>
                            <span className="text-cyan-300 font-bold tabular-nums">{anchorTensionKnPerM} kN/m</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={600}
                            step={20}
                            value={anchorTensionKnPerM}
                            onChange={(e) => setAnchorTensionKnPerM(Number(e.target.value))}
                            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">Romana SMR</div>
                          <div className="font-bold text-emerald-400">{slopeAndStabilizationAnalysis.computedSmr}</div>
                        </div>
                        <div className="bg-slate-950 border border-slate-800 rounded p-2">
                          <div className="text-[9px] text-slate-500">Req. T for FoS 1.5</div>
                          <div className="font-bold text-amber-300">{slopeAndStabilizationAnalysis.requiredTensionKnPerM.toFixed(0)} kN/m</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== 13. ALIGNMENT ALTERNATIVES EVALUATOR ==================== */}
                {activeTab === 'ALIGNMENT_ALTERNATIVES' && (
                  <AlignmentAlternativesEvaluatorView
                    currentDriveAzimuth={customDriveAzimuth}
                    faults={fedData.faultsList}
                    controllingJoint={{
                      id: fedData.governingJoint?.id || 'j-gov',
                      beta: customDip,
                      thetaDip: customDipDirection,
                      frictionAngle: frictionAngleDeg,
                    }}
                  />
                )}

                {/* ==================== 14. POOR ROCK PROPORTIONS ESTIMATOR ==================== */}
                {activeTab === 'POOR_ROCK_PROPORTIONS' && (
                  <PoorRockProportionsEstimatorView
                    totalLengthDefault={livePoorRockInputs.totalLen}
                    initialDomains={livePoorRockInputs.domains}
                    initialFaults={livePoorRockInputs.faultCrossings}
                  />
                )}

                {/* ==================== 15. EXECUTIVE GEOTECHNICAL DOSSIER ==================== */}
                {activeTab === 'EXECUTIVE_REPORT' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 space-y-5 font-mono">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-sky-400 font-bold">
                          ISRM / NGI / BIENIAWSKI CONSOLIDATED ENGINEERING DOSSIER
                        </div>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          {settings.projectName || 'Underground Tunnel Project'} — {settings.tunnelName || 'Active Heading'} ({fedData.faceChainageStr})
                        </h3>
                      </div>
                      <div className="text-right text-xs text-slate-400 tabular-nums">
                        <div>Profile: <strong className="text-white">{shapeLabel} ({spanW.toFixed(2)}m × {heightH.toFixed(2)}m)</strong></div>
                        <div>Date: {settings.date} | Geologist: {settings.mappedBy}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase">Bieniawski RMR₈₉</div>
                        <div className="text-lg font-bold text-emerald-400 mt-0.5">
                          {rmrVal !== null ? rmrVal : `${safeRmrForCalc} (Eq)`}
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase">Barton NGI Q-Value</div>
                        <div className="text-lg font-bold text-sky-400 mt-0.5">
                          {qVal !== null ? qVal.toFixed(3) : `${safeQForCalc} (Eq)`}
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase">3D Wedge Bolted FoS</div>
                        <div className="text-lg font-bold text-amber-300 mt-0.5">
                          {wedgeAnalysis.fosBolted.toFixed(2)} ({wedgeAnalysis.wedgeWeightKn.toFixed(0)} kN)
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 uppercase">Rock Mass Modulus Erm</div>
                        <div className="text-lg font-bold text-purple-300 mt-0.5">
                          {hoekBrownAnalysis.deformationModulusGpa.toFixed(2)} GPa
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs tabular-nums">
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                        <div className="text-sky-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1.5">
                          Structural &amp; Kinematic Summary
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Governing Discontinuity:</span>
                          <span className="text-white font-bold">
                            {fedData.governingJoint
                              ? `${fedData.governingJoint.set} (Dip ${fedData.governingJoint.dip}° / ${fedData.governingJoint.dipDirection}°)`
                              : 'None'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Apparent Dip (Wall / Face):</span>
                          <span className="text-emerald-400 font-bold">
                            {apparentCalculations.apparentDipWallDeg.toFixed(1)}° / {apparentCalculations.apparentDipFaceDeg.toFixed(1)}°
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Palmström Volumetric Jv &amp; Vb:</span>
                          <span className="text-sky-300 font-bold">
                            {standupAndBlockAnalysis.jvVolumetricCount.toFixed(1)} j/m³ | {standupAndBlockAnalysis.blockVolumeM3.toFixed(3)} m³
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
                        <div className="text-sky-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1.5">
                          Support &amp; Hydrogeological Verification
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Unsupported Stand-Up Time:</span>
                          <span className="text-emerald-400 font-bold">{standupAndBlockAnalysis.standupHours.toFixed(1)} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pattern Rockbolting:</span>
                          <span className="text-cyan-300 font-bold">L = {boltLengthM.toFixed(1)}m @ {boltSpacingM.toFixed(2)}m c/c</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Grouted Residual Inflow:</span>
                          <span className="text-amber-300 font-bold">{hydroAnalysis.groutedLitersPerMinPer100m.toFixed(1)} L/min/100m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
