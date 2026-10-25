// ============================================================================
// ESWA UNDERGROUND MINING & EXPLORATION SUITE — TYPES & SCHEMAS
// Hardrock Stope Mapping, Vein Grade Control & Exploration Core Logging
// ============================================================================

import {
  MiningExcavationType,
  MiningMethodType,
  MineralizedVeinRecord,
  FaceChannelSampleRecord,
  LaubscherMrmrParameters,
  MathewsStabilityParameters,
} from './tunnel';

export type MiningCommodity =
  | 'Gold (Au)'
  | 'Copper (Cu)'
  | 'Silver (Ag)'
  | 'Zinc (Zn)'
  | 'Lead (Pb)'
  | 'Nickel (Ni)'
  | 'Iron Ore (Fe)'
  | 'Platinum Group (PGM)'
  | 'Lithium (Li)'
  | 'Polymetallic Complex';

export interface MiningProjectItem {
  id: string; // e.g. "PRJ-MIN-001"
  projectName: string;
  mineName: string;
  miningCompany: string;
  mineSiteLocation: string;
  primaryCommodity: MiningCommodity;
  secondaryCommodity?: string;
  gradeUnits: 'g/t' | '%' | 'ppm' | 'oz/t';
  mineCoordinateSystem: string;
  mineDatumLevelMrl: number; // e.g. 1000mRL
  responsibleGeologist: string;
  activeMiningMethod: MiningMethodType;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

// ----------------------------------------------------------------------------
// UNDERGROUND SURFACES & GEOLOGICAL VECTOR FEATURES
// ----------------------------------------------------------------------------

export type MiningSurfaceType =
  | 'DEVELOPMENT_FACE'
  | 'LEFT_WALL'
  | 'RIGHT_WALL'
  | 'BACKS_CROWN'
  | 'STOPE_SURFACE'
  | 'PLAN_VIEW'
  | 'SECTION_3D';

export type MiningGeologicalFeatureType =
  | 'LITH_CONTACT'
  | 'ORE_BOUNDARY'
  | 'VEIN'
  | 'FAULT'
  | 'JOINT'
  | 'SHEAR'
  | 'FOLIATION'
  | 'ALTERATION_HALO'
  | 'BRECCIA'
  | 'DYKE'
  | 'GOUGE'
  | 'CHANNEL_CUT';

export interface MiningGeologicalPoint {
  x: number; // Local metric coordinates (meters from bottom-left corner of surface)
  y: number;
}

export interface MiningGeologicalFeature {
  id: string;
  surfaceType: MiningSurfaceType;
  featureType: MiningGeologicalFeatureType;
  geometryType: 'POLYLINE' | 'POLYGON' | 'POINT';
  points: MiningGeologicalPoint[];
  name: string;
  colorHex: string;
  strokeWidth?: number;
  fillOpacity?: number;
  dipDeg?: number;
  dipDirectionDeg?: number;
  strikeDeg?: number;
  trueThicknessM?: number;
  apparentThicknessM?: number;
  lithologyCode?: string;
  mineralogyNotes?: string;
  roughness?: string;
  infill?: string;
  waterInflow?: 'DRY' | 'DAMP' | 'DRIPPING' | 'FLOWING';
  visible: boolean;
  author?: string;
  createdAt?: string;
}

export interface MiningPhotoCalibration {
  imageUrl: string;
  scalePixelsPerMeter: number;
  originX: number; // canvas pixel offset
  originY: number;
  opacity: number;
  rotationDeg: number;
  widthM: number;
  heightM: number;
  isCalibrated: boolean;
  calibrationPoints?: { px: number; py: number; mx: number; my: number }[];
}

export interface MiningSurfaceRecord {
  surfaceType: MiningSurfaceType;
  features: MiningGeologicalFeature[];
  photo?: MiningPhotoCalibration;
  mappingNotes?: string;
  mappedBy?: string;
  surveyDate?: string;
}

export type MiningStopeShape =
  | 'd_arch'
  | 'horseshoe'
  | 'rectangular_flat'
  | 'shanty'
  | 'gothic_arch'
  | 'custom_parametric'
  | 'dxf_import';

export interface MiningLocationItem {
  id: string; // e.g. "LOC-HW-DRV-04"
  projectId: string;
  locationName: string; // e.g. "HW-DRV-04"
  mineLevel: string; // e.g. "Level 620 mRL"
  levelElevationMrl: number;
  excavationType: MiningExcavationType;
  miningMethod: MiningMethodType;
  oreBodyName: string;
  targetCutoffGrade: number;
  stopeShape: MiningStopeShape;
  stopeWidthM: number;
  stopeHeightM: number;
  wallHeightM: number;
  crownRadiusM?: number;
  headingDriveAzimuthDeg: number;
  customProfilePoints?: MiningGeologicalPoint[];
  createdAt: string;
  updatedAt: string;
}

export interface MiningStopeItem {
  id: string; // e.g. "STP-620-HW-04"
  projectId: string;
  locationId?: string;
  stopeOrDriftId: string; // e.g. "HW-DRV-04"
  mineLevel: string; // e.g. "Level 620 mRL"
  levelElevationMrl: number;
  excavationType: MiningExcavationType;
  miningMethod: MiningMethodType;
  oreBodyName: string;
  targetCutoffGrade: number; // e.g. 2.50 g/t
  faceName?: string; // e.g. "Cut #15" or "Face CH 125.4m"
  chainageFromM?: number; // e.g. 122.2m
  chainageToM?: number; // e.g. 125.4m
  currentHeadingRdChainage: string; // e.g. "Cut #14" or "CH 125.4m"
  blastPullMeters: number;
  stopeWidthM: number;
  stopeHeightM: number;
  stopeShape?: MiningStopeShape;
  wallHeightM?: number;
  crownRadiusM?: number;
  headingDriveAzimuthDeg?: number;
  faceInclinationDeg?: number;
  customProfilePoints?: MiningGeologicalPoint[];
  mappingMode?: 'FIELD_SKETCH' | 'PHOTOGRAMMETRY';
  dxfRawData?: string;
  hangingwallDipDeg: number;
  footwallDipDeg: number;
  oreSpecificGravity: number;
  wasteSpecificGravity: number;
  // Geological and grade control mapping data
  veins: MineralizedVeinRecord[];
  channelSamples: FaceChannelSampleRecord[];
  features?: MiningGeologicalFeature[];
  surfaces?: Partial<Record<MiningSurfaceType, MiningSurfaceRecord>>;
  activeSurfaceType?: MiningSurfaceType;
  mrmr?: LaubscherMrmrParameters;
  mathews?: MathewsStabilityParameters;
  facePhotoUrl?: string;
  muckDestinationVerdict?: 'MILL' | 'LOW_GRADE_STOCKPILE' | 'WASTE_DUMP';
  dilutedGradeCalculated?: number;
  dilutionPercentCalculated?: number;
  responsibleGeologist: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// EXPLORATION & PRODUCTION CORE LOGGING SCHEMAS
// ----------------------------------------------------------------------------

export interface MiningCoreRun {
  runNumber: number;
  fromDepthM: number;
  toDepthM: number;
  drilledLengthM: number;
  recoveredLengthM: number;
  coreRecoveryPercent: number; // e.g. 96.5% (TCR)
  solidCoreLengthRqdM: number;
  rqdPercent: number; // e.g. 82%
  fracturesPerMeter: number;
  pointLoadIs50Mpa: number; // Point Load Index
  lithology: string; // e.g. "Basalt / Quartz Vein / Sulfides"
  alteration: string; // e.g. "Moderate Silicification + Chlorite"
  mineralization: string; // e.g. "Disseminated Pyrite (3-5%) + Galena"
  veinDensityPerM: number;
  structureType: 'BEDDING' | 'JOINT' | 'FAULT' | 'SHEAR' | 'VEIN' | 'FOLIATION';
  structureDipToCoreAxisDeg: number; // Alpha angle
  weatheringGrade: 'FRESH' | 'SLIGHT' | 'MODERATE' | 'HIGH';
  coreBoxPhotoUrl?: string;
  geologistNotes?: string;
}

export interface CoreStructureObservation {
  id: string;
  depthM: number;
  structureType: 'BEDDING' | 'FOLIATION' | 'JOINT' | 'SHEAR' | 'FAULT' | 'VEIN' | 'BRECCIA';
  alphaDeg: number; // angle to core axis (0-90°)
  betaDeg: number; // circumference angle from BOH orientation line (0-360°)
  calculatedTrueDipDeg: number;
  calculatedTrueDipDirDeg: number;
  roughness: 'Rough Undulating' | 'Smooth Planar' | 'Slickensided' | 'Stepped';
  infill: string; // e.g. "Quartz / Pyrite", "Clay Gouge", "Calcite"
  apertureMm: number;
  notes?: string;
}

export interface DrillHoleSurveyStation {
  depthM: number;
  dipDeg: number; // e.g. -60° (negative down)
  azimuthDeg: number; // e.g. 090° (True North or Mine Grid)
  calculatedEastingM?: number;
  calculatedNorthingM?: number;
  calculatedElevationMrl?: number;
  surveyMethod?: 'REFLEX_GYRO' | 'CAMTEQ' | 'MAGNETIC_SINGLE_SHOT' | 'COLLAR_DESIGN';
}

export interface RcChipInterval {
  fromDepthM: number;
  toDepthM: number;
  sampleWeightKg: number;
  moistureCondition: 'DRY' | 'MOIST' | 'WET';
  lithologyCode: string;
  primaryRockName: string;
  alterationStyle: string;
  visualSulfidePercent: number;
  sampleQuality: 'HIGH_INTEGRITY' | 'POSSIBLE_CYCLONE_LOSS' | 'WET_CONTAMINATION_RISK';
}

export interface MiningAssayInterval {
  sampleId: string; // e.g. "KD-ASSAY-1042"
  fromDepthM: number;
  toDepthM: number;
  intervalLengthM: number;
  primaryAssayGrade: number; // e.g. 5.84 g/t Au
  primaryGradeUnit: string;
  secondaryAssayGrade?: number; // e.g. 1.25 % Cu
  secondaryGradeUnit?: string;
  specificGravityEstimated: number;
  qaqcCategory: 'NORMAL_SAMPLE' | 'CRM_STANDARD' | 'COARSE_BLANK' | 'PULP_DUPLICATE';
  qaqcPass: boolean;
  assayLaboratory: string;
  certificateNumber?: string;
}

export interface MiningDrillHoleRecord {
  id: string; // e.g. "DH-KD-042"
  projectId: string;
  holeId: string; // e.g. "DDH-KD-042"
  holeType: 'DIAMOND_CORE_DDH' | 'REVERSE_CIRCULATION_RC' | 'UNDERGROUND_PROD_HOLE';
  collarEasting: number;
  collarNorthing: number;
  collarElevationMrl: number;
  collarDipDeg: number; // e.g. -60°
  collarAzimuthDeg: number; // e.g. 090°
  totalDrilledDepthM: number; // e.g. 150.0m
  coreDiameter: 'PQ' | 'HQ' | 'NQ' | 'BQ' | 'RC_CHIPS';
  drillingContractor: string;
  drillingRigModel: string;
  startDate: string;
  completionDate?: string;
  loggedBy: string;
  purpose: 'EXPLORATION' | 'RESOURCE_INFILL' | 'GRADE_CONTROL' | 'GEOTECHNICAL_STABILITY';
  targetOreZone: string;
  runs: MiningCoreRun[];
  assayIntervals: MiningAssayInterval[];
  surveyStations?: DrillHoleSurveyStation[];
  structuralObservations?: CoreStructureObservation[];
  rcChipIntervals?: RcChipInterval[];
  overallRecoveryPercent: number;
  overallRqdPercent: number;
  significantInterceptsSummary: string; // e.g. "12.5m @ 5.4 g/t Au from 48.0m"
  createdAt: string;
  updatedAt: string;
}
