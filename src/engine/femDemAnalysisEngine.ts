import {
  computeFaceTunnelOutlineDetails,
  computeFieldQValue,
  computeFieldRmrValue,
  createDefaultSupportSystem,
  FIELD_EXTENDED_ROCK_SUGGESTION_DATABASE,
  FIELD_EXTENDED_VEIN_FOLIATION_SUGGESTIONS,
  FIELD_JOINT_SET_IDS,
  FIELD_LITHOLOGY_CATALOG,
  FIELD_VEIN_AND_FOLIATION_CATALOG,
  FieldExcavationRound,
  FieldJointSetId,
  FieldProjectItem,
  FieldSupportSystemConfig,
  FieldTunnelLocationItem,
  MappingDomainType,
  parseChainageStringToMeters,
  resolveRockDisplayInfo,
} from './fieldMappingEngine';
import { SurfaceGeometryParameters } from './surfaceMappingEngine';
import {
  computeVerticalShaftCircumferenceBreakdown,
  isVerticalShaftLocation,
  normalizeVerticalShaftCenterMedianStatus,
  normalizeVerticalShaftHalfSide,
} from './verticalShaftEngine';

export type FemDemAnalysisMode = 'fem' | 'dem' | 'combined';

export type ParameterProvenanceType =
  | 'SITE_TEST'
  | 'ESWA_RECORDED'
  | 'REFERENCE_ESTIMATED'
  | 'ENGINEER_OVERRIDE'
  | 'MISSING_INPUT';

export type FemDemParameterKey =
  | 'overburdenDepthM'
  | 'horizontalStressRatioK0'
  | 'unitWeightKnM3'
  | 'intactUcsMpa'
  | 'intactTensileMpa'
  | 'intactModulusEiGpa'
  | 'poissonRatio'
  | 'hoekBrownMi'
  | 'blastDamageFactorD'
  | 'rockMassModulusErmGpa'
  | 'rockMassCohesionMpa'
  | 'rockMassFrictionDeg'
  | 'rockMassStrengthScmMpa'
  | 'jointNormalStiffnessKnGpaM'
  | 'jointShearStiffnessKsGpaM'
  | 'jointFrictionAngleDeg'
  | 'jointCohesionKpa'
  | 'jointJrc'
  | 'jointJcsMpa'
  | 'poreWaterPressureKpa';

export interface FieldFemDemAnalysisConfig {
  mode: FemDemAnalysisMode;
  overburdenDepthM?: number;
  horizontalStressRatioK0?: number;
  blastDamageFactorD?: number;
  parameterOverrides: Partial<Record<FemDemParameterKey, number>>;
  siteTestParameters?: Partial<Record<FemDemParameterKey, number>>;
  includeInEswaReport?: boolean;
  engineerNotes?: string;
  lastUpdatedIso?: string;
}

export interface ResolvedGeotechParameter {
  key: FemDemParameterKey;
  symbol: string;
  label: string;
  category: 'stress_hydraulic' | 'intact_rock' | 'rock_mass_fem' | 'joint_dem';
  value: number;
  defaultReferenceValue: number;
  unit: string;
  applicableRange: string;
  provenance: ParameterProvenanceType;
  provenanceBadge: string;
  referenceSource: string;
  correlationFormula?: string;
  applicabilityAndLimitation: string;
  importanceIfMissing?: string;
}

export interface FemMeshNode2D {
  id: string;
  xSvg: number;
  ySvg: number;
  xMeters: number;
  yMeters: number;
  radiusNorm: number; // r / R_eq (>= 1.0)
  angleRad: number;
  ringIndex: number;
  sectorIndex: number;
}

export interface FemMeshElement2D {
  id: string;
  nodeIds: [string, string, string] | [string, string, string, string];
  pointsSvg: { x: number; y: number }[];
  centroidSvg: { x: number; y: number };
  radiusNorm: number;
  sectorAngleDeg: number;
  lithologyName: string;
  lithologyColor: string;
  // Before support state
  sigmaThetaBeforeMpa: number;
  sigmaRadialBeforeMpa: number;
  displacementBeforeMm: number;
  strainBeforePct: number;
  isYieldedBefore: boolean;
  localFosBefore: number;
  // After support state
  sigmaThetaAfterMpa: number;
  sigmaRadialAfterMpa: number;
  displacementAfterMm: number;
  strainAfterPct: number;
  isYieldedAfter: boolean;
  localFosAfter: number;
}

export interface DemJointPlane2D {
  id: string;
  setId: FieldJointSetId;
  label: string;
  panel: string;
  x1Svg: number;
  y1Svg: number;
  x2Svg: number;
  y2Svg: number;
  dipDirectionDeg: number;
  dipAmountDeg: number;
  lengthMeters: number;
  apertureMm: number;
  jrc: number;
  jcsMpa: number;
  frictionDeg: number;
  cohesionKpa: number;
  knGpaM: number;
  ksGpaM: number;
  normalStressMpa: number;
  shearStressMpa: number;
  shearStrengthBeforeMpa: number;
  shearStrengthAfterMpa: number;
  apertureChangeBeforeMm: number; // + opening, - closure
  apertureChangeAfterMm: number;
  shearSlipBeforeMm: number;
  shearSlipAfterMm: number;
  jointFosBefore: number;
  jointFosAfter: number;
  color: string;
}

export interface DemKeyBlock2D {
  id: string;
  label: string;
  locationZone: 'Crown Arch' | 'Left Sidewall' | 'Right Sidewall' | 'Shoulder Wedge' | 'Slope Batter';
  controllingSets: string[];
  polygonSvg: { x: number; y: number }[];
  centroidSvg: { x: number; y: number };
  moveVectorSvg: { dx: number; dy: number };
  apexDepthMeters: number;
  perimeterWidthMeters: number;
  areaM2: number;
  volumePerMeterM3: number;
  weightKnPerM: number;
  failureMode: 'Gravity Fall (Crown)' | 'Planar Sliding' | 'Wedge Sliding' | 'Flexural Toppling / Rotation';
  drivingForceKn: number;
  resistingForceBeforeKn: number;
  supportForceAddedKn: number;
  resistingForceAfterKn: number;
  fosBefore: number;
  fosAfter: number;
  dispBeforeMm: number;
  dispAfterMm: number;
  boltsIntersectingCount: number;
  anchorageBeyondPlasticZone: boolean;
  statusBefore: 'UNSTABLE' | 'MARGINALLY STABLE' | 'STABLE';
  statusAfter: 'UNSTABLE' | 'MARGINALLY STABLE' | 'STABLE';
}

export interface SupportContributionBreakdown {
  isSupportConfirmedInstalled: boolean;
  supportStatusMessage: string;
  activeSystemsSummary: string[];
  rockBoltsPressureMpa: number;
  rockBoltsStiffnessMpaPerM: number;
  spotBoltsPressureMpa: number;
  shotcretePressureMpa: number;
  shotcreteStiffnessMpaPerM: number;
  steelSetOrLatticePressureMpa: number;
  steelSetOrLatticeStiffnessMpaPerM: number;
  wireMeshRetentionKpa: number;
  forepolingOrCanopyPressureMpa: number;
  totalMaxSupportPressureMpa: number;
  totalEffectiveSupportPressureMpa: number;
  totalSupportStiffnessMpaPerM: number;
  boltLengthMeters: number;
  boltSpacingInPlaneM: number;
  boltSpacingLongitudinalM: number;
  shotcreteThicknessMm: number;
}

export interface GrcPoint {
  supportPressureMpa: number;
  radialDisplacementMm: number;
  plasticRadiusMeters: number;
}

export interface FemContinuumStateResult {
  internalSupportPressureMpa: number;
  plasticZoneRadiusMeters: number;
  plasticZoneDepthMeters: number;
  crownDisplacementMm: number;
  sidewallDisplacementMm: number;
  maxDisplacementMm: number;
  tunnelConvergencePct: number;
  maxTangentialStressMpa: number;
  maxShearStrainPct: number;
  yieldedElementsPct: number;
  continuumFactorOfSafety: number;
  stabilityStatus: 'STABLE (ELASTIC)' | 'CONTROLLED YIELDING' | 'HIGH DEFORMATION / INSTABILITY';
}

export interface LoggedLithologyShare {
  rockId: string;
  rockName: string;
  rockFamily: string;
  weightPct: number;
  ucsMpa: number;
  eiGpa: number;
  mi: number;
  unitWeightKnM3: number;
  basicFrictionDeg: number;
  defaultJrc: number;
  colorHex: string;
  isFaultOrShearZone?: boolean;
}

export interface LoggedGeologicalReferenceBasis {
  hasAnyLoggedGeology: boolean;
  lithologyShares: LoggedLithologyShare[];
  compositeFormulaLabel: string;
  loggedUcsSourceLabel: string;
  loggedWeatheringSourceLabel: string;
  loggedJointsSummaryLabel: string;
  loggedStructuresSummaryLabel: string;
  mappedJointTracesCount: number;
  mappedDipSurfacesCount: number;
  activeDiscontinuitySetsCount: number;
  mappedFaultOrShearCount: number;
  mappedFoldCount: number;
  avgJointSpacingM: number;
  avgJointPersistenceM: number;
  avgJointApertureMm: number;
  synthesizedRmr: number;
  synthesizedQ: number;
  synthesizedGsi: number;
  classificationSourceLabel: string;
}

export interface CompleteFemDemAnalysisResult {
  // Active Context
  projectName: string;
  locationName: string;
  chainageLabel: string;
  mappingDomain: MappingDomainType;
  excavationShapeLabel: string;
  spanWidthM: number;
  totalHeightM: number;
  equivalentRadiusM: number;
  dominantLithology: string;
  secondaryLithologies: string[];
  weatheringGrade: string;
  strengthGrade: string;
  qValue: number | null;
  qClass: string;
  rmrValue: number | null;
  rmrClass: string;
  gsiValue: number | null;
  groundwaterSummary: string;
  loggedReferenceBasis: LoggedGeologicalReferenceBasis;
  // Strict Engineering Prerequisites Gate
  prerequisites: {
    hasClassification: boolean;
    hasRmr: boolean;
    hasQ: boolean;
    hasGsi: boolean;
    hasRockStrengthOrLithology: boolean;
    hasMappedLithology: boolean;
    hasWeatheringAndStrength: boolean;
    hasOverburden: boolean;
    hasDiscontinuitiesForDem: boolean;
    isBeforeAnalysisReady: boolean;
    isAfterAnalysisReady: boolean;
    missingBeforeRequirements: string[];
    missingAfterRequirements: string[];
  };
  // Hoek-Brown & In-situ Derived
  inSituVerticalStressMpa: number;
  inSituHorizontalStressMpa: number;
  inSituHydrostaticStressMpa: number;
  criticalSupportPressureMpa: number;
  hoekBrownMb: number;
  hoekBrownS: number;
  hoekBrownA: number;
  // Resolved Parameters & Provenance
  parameters: ResolvedGeotechParameter[];
  estimatedParametersCount: number;
  overriddenParametersCount: number;
  missingParametersCount: number;
  // Support Breakdown
  supportBreakdown: SupportContributionBreakdown;
  // FEM Results
  femBefore: FemContinuumStateResult;
  femAfter: FemContinuumStateResult;
  grcCurve: GrcPoint[];
  meshNodes: FemMeshNode2D[];
  meshElements: FemMeshElement2D[];
  tunnelOutlineSvgPoints: { x: number; y: number }[];
  tunnelClosedPathD: string;
  tunnelSplY: number;
  plasticZonePolygonBeforeSvg: { x: number; y: number }[];
  plasticZonePolygonAfterSvg: { x: number; y: number }[];
  supportBoltVectorsSvg: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    zone: 'crown' | 'wall';
  }[];
  // DEM Results
  demJointPlanes: DemJointPlane2D[];
  demKeyBlocks: DemKeyBlock2D[];
  criticalBlockBefore: DemKeyBlock2D | null;
  criticalBlockAfter: DemKeyBlock2D | null;
  minBlockFosBefore: number;
  minBlockFosAfter: number;
  maxJointOpeningBeforeMm: number;
  maxJointOpeningAfterMm: number;
  maxJointSlipBeforeMm: number;
  maxJointSlipAfterMm: number;
  // Combined FEM + DEM Interaction
  combinedInteraction: {
    maxWedgeApexDepthM: number;
    plasticZoneDepthBeforeM: number;
    plasticZoneDepthAfterM: number;
    doesPlasticZoneEnvelopWedgesBefore: boolean;
    doesPlasticZoneEnvelopWedgesAfter: boolean;
    boltAnchorageMarginMeters: number;
    isBoltLengthAdequateForYieldAndWedge: boolean;
    combinedStabilityStatusBefore: 'CRITICAL INSTABILITY' | 'MARGINAL / YIELDING' | 'STABLE';
    combinedStabilityStatusAfter: 'CRITICAL INSTABILITY' | 'MARGINAL / YIELDING' | 'STABLE';
    engineeringSynthesis: string[];
  };
  methodologyAndLimitations: {
    title: string;
    formulaSummary: string;
    referenceCitation: string;
    limitationNote: string;
  }[];
}

interface LithologyReferenceEntry {
  rockFamily: string;
  keywords: string[];
  unitWeightKnM3: number;
  unitWeightRange: string;
  ucsMpa: number;
  ucsRange: string;
  eiGpa: number;
  eiRange: string;
  poissonRatio: number;
  poissonRange: string;
  mi: number;
  miRange: string;
  basicFrictionDeg: number;
  frictionRange: string;
  defaultJrc: number;
  colorHex: string;
  sourceCitation: string;
}

const LITHOLOGY_REFERENCE_CATALOG: LithologyReferenceEntry[] = [
  {
    rockFamily: 'Quartzite / Siliceous Chert',
    keywords: ['quartzite', 'qtz', 'chert', 'jasper', 'siliceous', 'chert_nodule_band'],
    unitWeightKnM3: 26.8,
    unitWeightRange: '26.0 – 27.6 kN/m³',
    ucsMpa: 165,
    ucsRange: '120 – 280 MPa',
    eiGpa: 65,
    eiRange: '50 – 85 GPa',
    poissonRatio: 0.18,
    poissonRange: '0.14 – 0.22',
    mi: 20,
    miRange: '17 – 23',
    basicFrictionDeg: 32,
    frictionRange: '29° – 35°',
    defaultJrc: 9,
    colorHex: '#fde047',
    sourceCitation: 'Hoek (2007) Practical Rock Engineering; Deere (1968) MR=394',
  },
  {
    rockFamily: 'Granite / Granodiorite / Pegmatite',
    keywords: ['granite', 'granodiorite', 'pegmatite', 'aplite', 'syenite', 'rhyolite', 'felsic', 'pegmatite_vein', 'aplite_vein'],
    unitWeightKnM3: 26.5,
    unitWeightRange: '25.5 – 27.5 kN/m³',
    ucsMpa: 135,
    ucsRange: '100 – 250 MPa',
    eiGpa: 52,
    eiRange: '40 – 70 GPa',
    poissonRatio: 0.22,
    poissonRange: '0.18 – 0.25',
    mi: 32,
    miRange: '29 – 35',
    basicFrictionDeg: 33,
    frictionRange: '31° – 35°',
    defaultJrc: 11,
    colorHex: '#fca5a5',
    sourceCitation: 'Hoek & Brown (1997); ISRM (1981); Goodman (1989) Table 3.1',
  },
  {
    rockFamily: 'Dolerite / Diabase / Mafic Dyke',
    keywords: ['dolerite', 'diabase', 'mafic_dyke_band', 'lamprophyre', 'dyke'],
    unitWeightKnM3: 29.0,
    unitWeightRange: '28.0 – 30.2 kN/m³',
    ucsMpa: 160,
    ucsRange: '115 – 260 MPa',
    eiGpa: 64,
    eiRange: '48 – 85 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 26,
    miRange: '22 – 29',
    basicFrictionDeg: 35,
    frictionRange: '33° – 38°',
    defaultJrc: 10,
    colorHex: '#818cf8',
    sourceCitation: 'Hoek & Diederichs (2006) MR=400; Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Basalt / Metabasalt / Andesite',
    keywords: ['basalt', 'amygdaloidal', 'vesicular', 'metabasalt', 'epidiorite', 'andesite', 'trap', 'volcanic'],
    unitWeightKnM3: 28.5,
    unitWeightRange: '27.2 – 30.0 kN/m³',
    ucsMpa: 148,
    ucsRange: '105 – 250 MPa',
    eiGpa: 58,
    eiRange: '42 – 80 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 25,
    miRange: '22 – 28',
    basicFrictionDeg: 35,
    frictionRange: '32° – 38°',
    defaultJrc: 10,
    colorHex: '#64748b',
    sourceCitation: 'Hoek & Diederichs (2006); Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Gabbro / Norite / Diorite',
    keywords: ['gabbro', 'norite', 'diorite', 'peridotite', 'mafic'],
    unitWeightKnM3: 28.8,
    unitWeightRange: '27.5 – 30.5 kN/m³',
    ucsMpa: 145,
    ucsRange: '100 – 240 MPa',
    eiGpa: 62,
    eiRange: '50 – 85 GPa',
    poissonRatio: 0.25,
    poissonRange: '0.22 – 0.28',
    mi: 27,
    miRange: '25 – 30',
    basicFrictionDeg: 34,
    frictionRange: '32° – 36°',
    defaultJrc: 9,
    colorHex: '#a78bfa',
    sourceCitation: 'Marinos & Hoek (2000); ISRM Suggested Methods',
  },
  {
    rockFamily: 'Charnockite / Granulite / Khondalite',
    keywords: ['charnockite', 'granulite', 'khondalite', 'hypersthene'],
    unitWeightKnM3: 27.6,
    unitWeightRange: '26.8 – 28.8 kN/m³',
    ucsMpa: 155,
    ucsRange: '110 – 250 MPa',
    eiGpa: 60,
    eiRange: '45 – 80 GPa',
    poissonRatio: 0.22,
    poissonRange: '0.18 – 0.26',
    mi: 29,
    miRange: '25 – 33',
    basicFrictionDeg: 33,
    frictionRange: '30° – 36°',
    defaultJrc: 10,
    colorHex: '#f472b6',
    sourceCitation: 'ISRM (1981) Peninsular Granulite Suite; Hoek & Brown (1997)',
  },
  {
    rockFamily: 'Amphibolite / Hornblende Gneiss',
    keywords: ['amphibolite', 'hornblende', 'nematoblastic'],
    unitWeightKnM3: 28.2,
    unitWeightRange: '27.0 – 29.5 kN/m³',
    ucsMpa: 130,
    ucsRange: '85 – 210 MPa',
    eiGpa: 54,
    eiRange: '38 – 72 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 26,
    miRange: '22 – 30',
    basicFrictionDeg: 32,
    frictionRange: '29° – 35°',
    defaultJrc: 9,
    colorHex: '#2dd4bf',
    sourceCitation: 'Hoek & Diederichs (2006) MR=415; Marinos & Hoek (2000)',
  },
  {
    rockFamily: 'Gneiss / Migmatite',
    keywords: ['gneiss', 'migmatite', 'augen', 'garnet_gneiss', 'gneissic_banding'],
    unitWeightKnM3: 27.2,
    unitWeightRange: '26.2 – 28.5 kN/m³',
    ucsMpa: 120,
    ucsRange: '80 – 200 MPa',
    eiGpa: 48,
    eiRange: '35 – 68 GPa',
    poissonRatio: 0.23,
    poissonRange: '0.19 – 0.27',
    mi: 28,
    miRange: '23 – 33',
    basicFrictionDeg: 31,
    frictionRange: '28° – 34°',
    defaultJrc: 9,
    colorHex: '#d8b4fe',
    sourceCitation: 'Hoek & Brown (1997); Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Quartz / Hydrothermal Vein Band',
    keywords: ['quartz_vein', 'tourmaline_vein', 'sulfide_vein', 'epidote_vein', 'boudin_quartz_band', 'barite', 'fluorite', 'zeolite'],
    unitWeightKnM3: 26.6,
    unitWeightRange: '25.8 – 27.8 kN/m³',
    ucsMpa: 140,
    ucsRange: '95 – 220 MPa',
    eiGpa: 55,
    eiRange: '40 – 75 GPa',
    poissonRatio: 0.19,
    poissonRange: '0.15 – 0.23',
    mi: 22,
    miRange: '18 – 25',
    basicFrictionDeg: 31,
    frictionRange: '28° – 34°',
    defaultJrc: 9,
    colorHex: '#f8fafc',
    sourceCitation: 'Hoek (2007); Barton & Choubey (1977) Crystalline Veins',
  },
  {
    rockFamily: 'Chlorite / Talc / Graphitic Schist',
    keywords: ['chlorite_schist', 'talc_schist', 'graphite_schist', 'chlorite_talc_seam', 'graphite_seam', 'talc', 'chlorite', 'graphite'],
    unitWeightKnM3: 26.0,
    unitWeightRange: '24.8 – 27.0 kN/m³',
    ucsMpa: 34,
    ucsRange: '15 – 60 MPa (sheared foliation)',
    eiGpa: 12,
    eiRange: '5 – 22 GPa',
    poissonRatio: 0.29,
    poissonRange: '0.25 – 0.34',
    mi: 9,
    miRange: '7 – 12',
    basicFrictionDeg: 22,
    frictionRange: '18° – 26°',
    defaultJrc: 5,
    colorHex: '#5eead4',
    sourceCitation: 'Marinos & Hoek (2001) Ophiolitic & Schistose Rocks; Barton (2002)',
  },
  {
    rockFamily: 'Mica Schist / Quartz-Mica Schist',
    keywords: ['schist', 'mica', 'qtz_mica_schist', 'foliation_s1', 'foliation_s2', 'crenulation_s3'],
    unitWeightKnM3: 26.4,
    unitWeightRange: '25.0 – 27.5 kN/m³',
    ucsMpa: 55,
    ucsRange: '25 – 95 MPa (anisotropic)',
    eiGpa: 22,
    eiRange: '10 – 38 GPa',
    poissonRatio: 0.27,
    poissonRange: '0.23 – 0.32',
    mi: 12,
    miRange: '9 – 15',
    basicFrictionDeg: 26,
    frictionRange: '22° – 30°',
    defaultJrc: 7,
    colorHex: '#86efac',
    sourceCitation: 'Marinos & Hoek (2001) Heterogeneous Rock Masses; Goodman (1989)',
  },
  {
    rockFamily: 'Slate / Argillite',
    keywords: ['slate', 'argillite', 'slaty_cleavage'],
    unitWeightKnM3: 26.5,
    unitWeightRange: '25.4 – 27.4 kN/m³',
    ucsMpa: 62,
    ucsRange: '30 – 105 MPa',
    eiGpa: 25,
    eiRange: '12 – 42 GPa',
    poissonRatio: 0.26,
    poissonRange: '0.22 – 0.30',
    mi: 9,
    miRange: '7 – 11',
    basicFrictionDeg: 26,
    frictionRange: '23° – 29°',
    defaultJrc: 6,
    colorHex: '#94a3b8',
    sourceCitation: 'Hoek, Marinos & Benissi (1998); Deere (1968)',
  },
  {
    rockFamily: 'Phyllite',
    keywords: ['phyllite', 'foliated'],
    unitWeightKnM3: 26.2,
    unitWeightRange: '25.0 – 27.2 kN/m³',
    ucsMpa: 42,
    ucsRange: '20 – 80 MPa',
    eiGpa: 16,
    eiRange: '8 – 30 GPa',
    poissonRatio: 0.28,
    poissonRange: '0.24 – 0.33',
    mi: 7,
    miRange: '5 – 10',
    basicFrictionDeg: 25,
    frictionRange: '21° – 28°',
    defaultJrc: 6,
    colorHex: '#6ee7b7',
    sourceCitation: 'Hoek, Marinos & Benissi (1998); Barton (1976)',
  },
  {
    rockFamily: 'Serpentinite / Ultramafic',
    keywords: ['serpentinite', 'serpentine', 'ophiolite'],
    unitWeightKnM3: 25.6,
    unitWeightRange: '24.4 – 26.8 kN/m³',
    ucsMpa: 38,
    ucsRange: '15 – 75 MPa',
    eiGpa: 14,
    eiRange: '6 – 28 GPa',
    poissonRatio: 0.30,
    poissonRange: '0.26 – 0.35',
    mi: 11,
    miRange: '8 – 14',
    basicFrictionDeg: 23,
    frictionRange: '19° – 27°',
    defaultJrc: 5,
    colorHex: '#bef264',
    sourceCitation: 'Marinos, Marinos & Hoek (2006) Ophiolitic Serpentinites',
  },
  {
    rockFamily: 'Marble / Calc-Silicate',
    keywords: ['marble', 'calc_gneiss', 'calc_silicate', 'skarn'],
    unitWeightKnM3: 27.0,
    unitWeightRange: '26.0 – 28.2 kN/m³',
    ucsMpa: 92,
    ucsRange: '55 – 150 MPa',
    eiGpa: 42,
    eiRange: '26 – 62 GPa',
    poissonRatio: 0.25,
    poissonRange: '0.21 – 0.29',
    mi: 9,
    miRange: '7 – 12',
    basicFrictionDeg: 32,
    frictionRange: '29° – 35°',
    defaultJrc: 9,
    colorHex: '#f5d0fe',
    sourceCitation: 'Hoek & Diederichs (2006) MR=456; Marinos & Hoek (2000)',
  },
  {
    rockFamily: 'Dolomite / Ankerite',
    keywords: ['dolomite', 'ankerite', 'siderite'],
    unitWeightKnM3: 27.2,
    unitWeightRange: '26.2 – 28.4 kN/m³',
    ucsMpa: 98,
    ucsRange: '60 – 160 MPa',
    eiGpa: 44,
    eiRange: '28 – 65 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 10,
    miRange: '8 – 13',
    basicFrictionDeg: 33,
    frictionRange: '30° – 36°',
    defaultJrc: 9,
    colorHex: '#93c5fd',
    sourceCitation: 'Hoek & Brown (1997); Deere & Miller (1966)',
  },
  {
    rockFamily: 'Limestone / Carbonate',
    keywords: ['limestone', 'calcite_vein', 'carbonate', 'chalk', 'calcarenite', 'marl', 'gypsum', 'anhydrite'],
    unitWeightKnM3: 26.4,
    unitWeightRange: '25.0 – 27.6 kN/m³',
    ucsMpa: 78,
    ucsRange: '45 – 135 MPa',
    eiGpa: 34,
    eiRange: '20 – 54 GPa',
    poissonRatio: 0.25,
    poissonRange: '0.21 – 0.29',
    mi: 10,
    miRange: '8 – 12',
    basicFrictionDeg: 32,
    frictionRange: '29° – 35°',
    defaultJrc: 9,
    colorHex: '#7dd3fc',
    sourceCitation: 'Hoek & Brown (1997); Deere & Miller (1966)',
  },
  {
    rockFamily: 'Sandstone / Greywacke / Arkose',
    keywords: ['sandstone', 'greywacke', 'metagreywacke', 'arkose', 'gritstone', 'bedding_s0'],
    unitWeightKnM3: 24.8,
    unitWeightRange: '23.2 – 26.5 kN/m³',
    ucsMpa: 74,
    ucsRange: '40 – 130 MPa',
    eiGpa: 27,
    eiRange: '15 – 44 GPa',
    poissonRatio: 0.22,
    poissonRange: '0.18 – 0.26',
    mi: 17,
    miRange: '15 – 19',
    basicFrictionDeg: 31,
    frictionRange: '28° – 34°',
    defaultJrc: 11,
    colorHex: '#fcd34d',
    sourceCitation: 'Hoek (2007); Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Conglomerate / Volcanic Tuff',
    keywords: ['conglomerate', 'tuff', 'agglomerate', 'boulder'],
    unitWeightKnM3: 25.0,
    unitWeightRange: '23.5 – 26.5 kN/m³',
    ucsMpa: 60,
    ucsRange: '30 – 110 MPa',
    eiGpa: 21,
    eiRange: '10 – 36 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 21,
    miRange: '18 – 24',
    basicFrictionDeg: 32,
    frictionRange: '28° – 35°',
    defaultJrc: 12,
    colorHex: '#fdba74',
    sourceCitation: 'Marinos & Hoek (2000) Molassic Conglomerates',
  },
  {
    rockFamily: 'Siltstone',
    keywords: ['siltstone', 'slts'],
    unitWeightKnM3: 24.6,
    unitWeightRange: '23.2 – 26.0 kN/m³',
    ucsMpa: 48,
    ucsRange: '25 – 85 MPa',
    eiGpa: 17,
    eiRange: '8 – 30 GPa',
    poissonRatio: 0.26,
    poissonRange: '0.22 – 0.30',
    mi: 9,
    miRange: '7 – 11',
    basicFrictionDeg: 27,
    frictionRange: '24° – 30°',
    defaultJrc: 7,
    colorHex: '#fde68a',
    sourceCitation: 'Marinos & Hoek (2001) Flysch Siltstones; ISRM (1981)',
  },
  {
    rockFamily: 'Shale / Mudstone / Claystone',
    keywords: ['shale', 'shale_vein', 'mudstone', 'claystone', 'coal', 'bentonite'],
    unitWeightKnM3: 23.8,
    unitWeightRange: '22.0 – 25.4 kN/m³',
    ucsMpa: 24,
    ucsRange: '8 – 45 MPa',
    eiGpa: 7.5,
    eiRange: '3 – 16 GPa',
    poissonRatio: 0.30,
    poissonRange: '0.26 – 0.35',
    mi: 6,
    miRange: '4 – 8',
    basicFrictionDeg: 22,
    frictionRange: '18° – 25°',
    defaultJrc: 4,
    colorHex: '#cbd5e1',
    sourceCitation: 'Marinos & Hoek (2001) Argillaceous Flysch & Weak Rocks; ISRM (1981)',
  },
  {
    rockFamily: 'Fault Gouge / Shear / Mylonite Zone',
    keywords: ['fault', 'shear', 'gouge', 'mylonite', 'cataclasite', 'breccia', 'crushed', 'weathered soil', 'shear_zone', 'clay_gouge_seam'],
    unitWeightKnM3: 21.5,
    unitWeightRange: '19.5 – 23.5 kN/m³',
    ucsMpa: 8,
    ucsRange: '1.5 – 20 MPa',
    eiGpa: 2.5,
    eiRange: '0.5 – 6.0 GPa',
    poissonRatio: 0.34,
    poissonRange: '0.30 – 0.38',
    mi: 5,
    miRange: '4 – 7',
    basicFrictionDeg: 18,
    frictionRange: '14° – 23°',
    defaultJrc: 3,
    colorHex: '#fda4af',
    sourceCitation: 'Barton (2002) Q-System Shear Zones; Hoek et al. (1998)',
  },
];

// Weathering reduction multipliers according to ISRM (1981) grades WI to WVI
const WEATHERING_MODIFIERS: Record<
  string,
  { label: string; ucsFactor: number; modulusFactor: number; unitWeightDelta: number; frictionDeltaDeg: number; jcsRatio: number }
> = {
  WI: { label: 'WI (Fresh / Unweathered)', ucsFactor: 1.0, modulusFactor: 1.0, unitWeightDelta: 0.0, frictionDeltaDeg: 0, jcsRatio: 0.92 },
  WII: { label: 'WII (Slightly Weathered)', ucsFactor: 0.84, modulusFactor: 0.85, unitWeightDelta: -0.4, frictionDeltaDeg: -1.5, jcsRatio: 0.76 },
  WIII: { label: 'WIII (Moderately Weathered)', ucsFactor: 0.58, modulusFactor: 0.62, unitWeightDelta: -1.1, frictionDeltaDeg: -3.5, jcsRatio: 0.54 },
  WIV: { label: 'WIV (Highly Weathered)', ucsFactor: 0.32, modulusFactor: 0.38, unitWeightDelta: -2.0, frictionDeltaDeg: -6.0, jcsRatio: 0.35 },
  WV: { label: 'WV (Completely Weathered)', ucsFactor: 0.14, modulusFactor: 0.18, unitWeightDelta: -3.2, frictionDeltaDeg: -8.5, jcsRatio: 0.20 },
  WVI: { label: 'WVI (Residual Soil)', ucsFactor: 0.06, modulusFactor: 0.08, unitWeightDelta: -4.5, frictionDeltaDeg: -10.5, jcsRatio: 0.12 },
};

// ISRM Strength Index (S1 - S6) typical UCS bounds & midpoint
const ISRM_STRENGTH_UCS_MAP: Record<
  string,
  { minMpa: number; maxMpa: number; midMpa: number; range: string; label: string; rmrUcsRating: number }
> = {
  S1: { minMpa: 200, maxMpa: 300, midMpa: 225, range: '> 200 MPa (Extremely Strong)', label: 'S1 (>200 MPa)', rmrUcsRating: 15 },
  S2: { minMpa: 100, maxMpa: 200, midMpa: 145, range: '100 – 200 MPa (Very Strong)', label: 'S2 (100–200 MPa)', rmrUcsRating: 12 },
  S3: { minMpa: 50, maxMpa: 100, midMpa: 75, range: '50 – 100 MPa (Strong)', label: 'S3 (50–100 MPa)', rmrUcsRating: 7 },
  S4: { minMpa: 25, maxMpa: 50, midMpa: 37, range: '25 – 50 MPa (Medium Strong)', label: 'S4 (25–50 MPa)', rmrUcsRating: 4 },
  S5: { minMpa: 5, maxMpa: 25, midMpa: 15, range: '5 – 25 MPa (Weak)', label: 'S5 (5–25 MPa)', rmrUcsRating: 2 },
  S6: { minMpa: 1, maxMpa: 5, midMpa: 3.0, range: '1 – 5 MPa (Very Weak)', label: 'S6 (1–5 MPa)', rmrUcsRating: 1 },
};

export function createDefaultFemDemConfig(): FieldFemDemAnalysisConfig {
  return {
    mode: 'combined',
    parameterOverrides: {},
    siteTestParameters: {},
    includeInEswaReport: false,
    engineerNotes: '',
  };
}

export function matchLithologyReference(rockIdentifierOrName: string): LithologyReferenceEntry {
  const raw = (rockIdentifierOrName || '').trim();
  const displayInfo = resolveRockDisplayInfo(raw);
  const combinedSearch = `${raw} ${displayInfo.name} ${displayInfo.patternId}`.toLowerCase();
  for (const entry of LITHOLOGY_REFERENCE_CATALOG) {
    if (entry.keywords.some((kw) => combinedSearch.includes(kw))) {
      return entry;
    }
  }
  return LITHOLOGY_REFERENCE_CATALOG[0];
}

function computePolygonAreaSvg(pts: { x: number; y: number }[]): number {
  if (!pts || pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(sum) * 0.5;
}

function computePolylineLengthSvg(pts: { x: number; y: number }[]): number {
  if (!pts || pts.length < 2) return 40;
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return Math.max(25, len);
}

/**
 * Extracts area-weighted lithologies from all painted strokes, alternating lithology bands,
 * channel sample intervals, and structural fault/shear bands in the round.
 */
function extractAreaWeightedLithologies(round: FieldExcavationRound): {
  dominant: string;
  secondary: string[];
  shares: LoggedLithologyShare[];
  hasMappedLithology: boolean;
  compositeEntry: LithologyReferenceEntry;
  mappedFaultOrShearCount: number;
  mappedFoldCount: number;
} {
  const areaByRockName: Record<
    string,
    { rockId: string; rockName: string; areaWeight: number; isFaultOrShear?: boolean }
  > = {};

  const addRockWeight = (rawIdOrName: string, weight: number, isFaultOrShear = false) => {
    if (!rawIdOrName || weight <= 0) return;
    const resolved = resolveRockDisplayInfo(rawIdOrName);
    const cleanName = resolved.name || rawIdOrName;
    const key = cleanName.toLowerCase();
    if (!areaByRockName[key]) {
      areaByRockName[key] = {
        rockId: rawIdOrName,
        rockName: cleanName,
        areaWeight: 0,
        isFaultOrShear,
      };
    }
    areaByRockName[key].areaWeight += weight;
  };

  const visibleStrokes = (round?.lithologyStrokes || []).filter(
    (s) => s.mode !== 'lithology_erase'
  );

  for (const stroke of visibleStrokes) {
    let strokeArea = 1200;
    if (stroke.isClosed && stroke.polygon && stroke.polygon.length >= 3) {
      strokeArea = Math.max(800, computePolygonAreaSvg(stroke.polygon));
    } else if (stroke.points && stroke.points.length >= 2) {
      const pathLen = computePolylineLengthSvg(stroke.points);
      const widthPx =
        stroke.mode === 'vein_band' || stroke.mode === 'foliation_plane'
          ? stroke.bandThicknessPx || (stroke.brushRadius || 16) * 1.6
          : (stroke.brushRadius || 28) * 2.2;
      strokeArea = Math.max(600, pathLen * widthPx);
    }

    const altList =
      stroke.alternatingRockNames && stroke.alternatingRockNames.length >= 2
        ? stroke.alternatingRockNames
        : stroke.alternatingRockIds && stroke.alternatingRockIds.length >= 2
        ? stroke.alternatingRockIds
        : stroke.alternateRockTypes && stroke.alternateRockTypes.length >= 2
        ? stroke.alternateRockTypes
        : null;

    if (altList && altList.length > 0) {
      const eachWeight = strokeArea / altList.length;
      for (const item of altList) {
        addRockWeight(item, eachWeight);
      }
    } else {
      const primaryId = stroke.rockName || stroke.rockType;
      const isShearStroke =
        (stroke.rockType || '').toLowerCase().includes('shear') ||
        (stroke.rockName || '').toLowerCase().includes('shear') ||
        (stroke.rockName || '').toLowerCase().includes('gouge');
      addRockWeight(primaryId, strokeArea, isShearStroke);
    }
  }

  // Alternating lithology band configuration
  if (round?.alternateLithologyConfig?.enabled) {
    const cfg = round.alternateLithologyConfig;
    if (cfg.baseRockType) {
      addRockWeight(cfg.baseRockType, 18000);
    }
    if (Array.isArray(cfg.bands) && cfg.bands.length > 0) {
      for (const b of cfg.bands) {
        if (b.enabled === false) continue;
        const bWeight = Math.max(2500, (b.thicknessPx || 32) * 220);
        addRockWeight(b.rockName || b.rockType, bWeight);
      }
    } else if (Array.isArray(cfg.rockTypes) && cfg.rockTypes.length > 0) {
      for (const rt of cfg.rockTypes) {
        addRockWeight(rt, 12000 / cfg.rockTypes.length);
      }
    }
  }

  // Legacy or continuous-strip rockType field on round
  if (Object.keys(areaByRockName).length === 0 && round?.rockType) {
    addRockWeight(round.rockType, 20000);
  }

  // Channel sample intervals if mine geology was logged
  if (Object.keys(areaByRockName).length === 0 && Array.isArray(round?.channelSampleLines)) {
    for (const line of round.channelSampleLines) {
      for (const iv of line.intervals || []) {
        if (iv.rockOrVeinUnit) {
          addRockWeight(iv.rockOrVeinUnit, Math.max(1000, (iv.widthMeters || 1) * 5000));
        }
      }
    }
  }

  // Structural features: Faults, Thrust Faults, Shear Zones
  const structList = round?.structuralFeatures || [];
  let mappedFaultOrShearCount = 0;
  let mappedFoldCount = 0;
  let faultShearAreaTotal = 0;

  for (const sf of structList) {
    if (
      sf.featureType === 'fault' ||
      sf.featureType === 'thrust_fault' ||
      sf.featureType === 'shear_zone'
    ) {
      mappedFaultOrShearCount++;
      const len = computePolylineLengthSvg(sf.points || []);
      const widthPx = sf.strokeWidthPx || (sf.thicknessCm ? sf.thicknessCm * 1.5 : 22);
      faultShearAreaTotal += Math.max(900, len * widthPx);
    } else if (sf.featureType === 'fold_axis') {
      mappedFoldCount++;
    }
  }

  // If faults/shears are mapped on the canvas, blend a proportional Fault/Shear Gouge share (capped at 22% of continuum area)
  const hostAreaTotal = Object.values(areaByRockName).reduce((acc, v) => acc + v.areaWeight, 0);
  if (mappedFaultOrShearCount > 0) {
    const cappedFaultWeight =
      hostAreaTotal > 0
        ? Math.min(hostAreaTotal * 0.28, Math.max(hostAreaTotal * 0.08 * mappedFaultOrShearCount, faultShearAreaTotal))
        : 5000 * mappedFaultOrShearCount;
    addRockWeight('Fault Gouge / Shear Zone', cappedFaultWeight, true);
  }

  const entries = Object.values(areaByRockName).sort((a, b) => b.areaWeight - a.areaWeight);
  const totalWeight = entries.reduce((acc, e) => acc + e.areaWeight, 0);

  if (entries.length === 0 || totalWeight <= 0) {
    const defaultRef = LITHOLOGY_REFERENCE_CATALOG[0];
    return {
      dominant: 'Not Mapped',
      secondary: [],
      shares: [],
      hasMappedLithology: false,
      compositeEntry: defaultRef,
      mappedFaultOrShearCount,
      mappedFoldCount,
    };
  }

  const shares: LoggedLithologyShare[] = entries.map((e) => {
    const ref = matchLithologyReference(e.rockId || e.rockName);
    const weightPct = Number(((e.areaWeight / totalWeight) * 100).toFixed(1));
    return {
      rockId: e.rockId,
      rockName: e.rockName,
      rockFamily: ref.rockFamily,
      weightPct,
      ucsMpa: ref.ucsMpa,
      eiGpa: ref.eiGpa,
      mi: ref.mi,
      unitWeightKnM3: ref.unitWeightKnM3,
      basicFrictionDeg: ref.basicFrictionDeg,
      defaultJrc: ref.defaultJrc,
      colorHex: ref.colorHex,
      isFaultOrShearZone: e.isFaultOrShear,
    };
  });

  // Area-weighted composite properties across all logged lithologies & structural zones
  let wUnitWeight = 0;
  let wUcs = 0;
  let wEi = 0;
  let wPoisson = 0;
  let wMi = 0;
  let wFriction = 0;
  let wJrc = 0;

  for (const sh of shares) {
    const w = sh.weightPct / 100;
    const ref = matchLithologyReference(sh.rockId || sh.rockName);
    wUnitWeight += w * ref.unitWeightKnM3;
    wUcs += w * ref.ucsMpa;
    wEi += w * ref.eiGpa;
    wPoisson += w * ref.poissonRatio;
    wMi += w * ref.mi;
    wFriction += w * ref.basicFrictionDeg;
    wJrc += w * ref.defaultJrc;
  }

  const domRef = matchLithologyReference(shares[0].rockId || shares[0].rockName);
  const compositeFamilyLabel =
    shares.length === 1
      ? `${shares[0].rockName} (${domRef.rockFamily})`
      : shares
          .slice(0, 3)
          .map((s) => `${s.rockName} ${Math.round(s.weightPct)}%`)
          .join(' + ');

  const compositeEntry: LithologyReferenceEntry = {
    rockFamily: compositeFamilyLabel,
    keywords: domRef.keywords,
    unitWeightKnM3: Number(wUnitWeight.toFixed(2)),
    unitWeightRange: domRef.unitWeightRange,
    ucsMpa: Number(wUcs.toFixed(1)),
    ucsRange: domRef.ucsRange,
    eiGpa: Number(wEi.toFixed(1)),
    eiRange: domRef.eiRange,
    poissonRatio: Number(wPoisson.toFixed(2)),
    poissonRange: domRef.poissonRange,
    mi: Number(wMi.toFixed(1)),
    miRange: domRef.miRange,
    basicFrictionDeg: Number(wFriction.toFixed(1)),
    frictionRange: domRef.frictionRange,
    defaultJrc: Number(wJrc.toFixed(1)),
    colorHex: domRef.colorHex,
    sourceCitation:
      shares.length > 1
        ? `Area-Weighted Composite (${ compositeFamilyLabel }) — Marinos & Hoek (2001); Hoek & Diederichs (2006)`
        : domRef.sourceCitation,
  };

  return {
    dominant: shares[0].rockName,
    secondary: shares.slice(1, 5).map((s) => s.rockName),
    shares,
    hasMappedLithology: true,
    compositeEntry,
    mappedFaultOrShearCount,
    mappedFoldCount,
  };
}

function parseSpacingStringToMeters(spacingStr?: string, customStr?: string): number | null {
  if (customStr && !isNaN(parseFloat(customStr)) && parseFloat(customStr) > 0) {
    const val = parseFloat(customStr);
    return val > 10 ? val / 100 : val; // handle cm vs m
  }
  const s = (spacingStr || '').toLowerCase();
  if (!s) return null;
  if (s.includes('< 6') || s.includes('extremely close')) return 0.045;
  if (s.includes('6 - 20') || s.includes('very close')) return 0.13;
  if (s.includes('20 - 60') || s.includes('close')) return 0.38;
  if (s.includes('60 - 200') || s.includes('moderate')) return 1.15;
  if (s.includes('> 200') || s.includes('wide')) return 2.3;
  const numMatch = s.match(/(\d+(\.\d+)?)/);
  if (numMatch) {
    const v = parseFloat(numMatch[1]);
    return v > 10 ? v / 100 : v;
  }
  return null;
}

function parsePersistenceStringToMeters(persStr?: string, customStr?: string): number | null {
  if (customStr && !isNaN(parseFloat(customStr)) && parseFloat(customStr) > 0) {
    return parseFloat(customStr);
  }
  const p = (persStr || '').toLowerCase();
  if (!p) return null;
  if (p.includes('< 1') || p.includes('very low')) return 0.75;
  if (p.includes('1 - 3') || p.includes('low')) return 2.0;
  if (p.includes('3 - 10') || p.includes('medium')) return 6.0;
  if (p.includes('10 - 20') || p.includes('high')) return 14.0;
  if (p.includes('> 20') || p.includes('very high')) return 22.0;
  return null;
}

function parseApertureStringToMm(apStr?: string, customStr?: string): number | null {
  if (customStr && !isNaN(parseFloat(customStr)) && parseFloat(customStr) >= 0) {
    return parseFloat(customStr);
  }
  const a = (apStr || '').toLowerCase();
  if (!a) return null;
  if (a.includes('< 0.1') || a.includes('tight') || a.includes('none')) return 0.08;
  if (a.includes('0.1 - 1') || a.includes('0.1-1')) return 0.45;
  if (a.includes('1.0 - 5') || a.includes('1-5')) return 2.4;
  if (a.includes('> 5') || a.includes('open')) return 6.5;
  return null;
}

function parseRoughnessStringToJrc(roughStr?: string): number | null {
  const r = (roughStr || '').toLowerCase();
  if (!r) return null;
  if (r.includes('rough') && r.includes('stepped')) return 16.5;
  if (r.includes('rough') && r.includes('undulating')) return 13.5;
  if (r.includes('smooth') && r.includes('stepped')) return 11.0;
  if (r.includes('rough') && r.includes('planar')) return 9.0;
  if (r.includes('smooth') && r.includes('undulating')) return 7.0;
  if (r.includes('slickensided') && r.includes('stepped')) return 5.5;
  if (r.includes('smooth') && r.includes('planar')) return 4.0;
  if (r.includes('slickensided') && r.includes('undulating')) return 3.0;
  if (r.includes('slickensided') && r.includes('planar')) return 1.8;
  if (r.includes('very rough')) return 17.0;
  if (r.includes('rough')) return 12.0;
  if (r.includes('slightly rough')) return 8.5;
  if (r.includes('smooth')) return 5.0;
  if (r.includes('slickensided')) return 2.2;
  return null;
}

function parseInfillingModifier(infillingStr?: string): {
  cohesionKpa: number;
  frictionDeltaDeg: number;
  jaEquivalent: number;
  rmrInfillSubRating: number;
  label: string;
} | null {
  const inf = (infillingStr || '').toLowerCase();
  if (!inf) return null;
  if (inf.includes('quartz') || inf.includes('calcite') || inf.includes('healed')) {
    return { cohesionKpa: 72, frictionDeltaDeg: 1.5, jaEquivalent: 0.75, rmrInfillSubRating: 6, label: 'Quartz/Calcite Healed' };
  }
  if (inf.includes('none') || inf.includes('tight') || inf.includes('clean')) {
    return { cohesionKpa: 48, frictionDeltaDeg: 0.0, jaEquivalent: 1.0, rmrInfillSubRating: 6, label: 'Clean / Tight Unfilled' };
  }
  if (inf.includes('staining') || inf.includes('stained')) {
    return { cohesionKpa: 38, frictionDeltaDeg: -0.8, jaEquivalent: 1.5, rmrInfillSubRating: 5, label: 'Surface Staining' };
  }
  if (inf.includes('non-softening') && inf.includes('< 5')) {
    return { cohesionKpa: 28, frictionDeltaDeg: -2.0, jaEquivalent: 2.0, rmrInfillSubRating: 4, label: 'Hard Non-Softening <5mm' };
  }
  if (inf.includes('non-softening') && inf.includes('> 5')) {
    return { cohesionKpa: 20, frictionDeltaDeg: -3.8, jaEquivalent: 3.0, rmrInfillSubRating: 2, label: 'Hard Non-Softening >5mm' };
  }
  if (inf.includes('soft clay') && inf.includes('< 5')) {
    return { cohesionKpa: 14, frictionDeltaDeg: -5.5, jaEquivalent: 4.0, rmrInfillSubRating: 2, label: 'Soft Clay <5mm' };
  }
  if (inf.includes('soft clay') && inf.includes('> 5')) {
    return { cohesionKpa: 9, frictionDeltaDeg: -8.0, jaEquivalent: 6.0, rmrInfillSubRating: 0, label: 'Soft Clay >5mm' };
  }
  if (inf.includes('swelling') || inf.includes('gouge')) {
    return { cohesionKpa: 5, frictionDeltaDeg: -10.5, jaEquivalent: 8.0, rmrInfillSubRating: 0, label: 'Swelling Clay / Gouge' };
  }
  return null;
}

function parseOverburdenFromRound(
  round: FieldExcavationRound,
  mappingDomain: MappingDomainType,
  heightM: number,
  isVertShaft: boolean,
  hasAnyLoggedGeology: boolean
): {
  valueM: number;
  provenance: ParameterProvenanceType;
  sourceLabel: string;
} {
  if (round.femDemAnalysis?.overburdenDepthM && round.femDemAnalysis.overburdenDepthM > 0) {
    return {
      valueM: round.femDemAnalysis.overburdenDepthM,
      provenance: 'ENGINEER_OVERRIDE',
      sourceLabel: 'Engineer Override in FEM/DEM Workspace',
    };
  }
  const customCover =
    round.customTemplateFields?.['Rock_Cover_m'] ||
    round.customTemplateFields?.['Overburden_m'] ||
    round.customTemplateFields?.['Depth_m'];
  if (customCover && !isNaN(parseFloat(customCover)) && parseFloat(customCover) > 0) {
    return {
      valueM: parseFloat(customCover),
      provenance: 'ESWA_RECORDED',
      sourceLabel: `Recorded in ESWA Template Field (${customCover} m)`,
    };
  }
  if (round.mineHeadingMeta?.mineLevel) {
    const match = round.mineHeadingMeta.mineLevel.match(/(\d+(\.\d+)?)/);
    if (match && parseFloat(match[1]) > 5) {
      return {
        valueM: parseFloat(match[1]),
        provenance: 'ESWA_RECORDED',
        sourceLabel: `Recorded in ESWA Mine Level (${round.mineHeadingMeta.mineLevel})`,
      };
    }
  }
  if (mappingDomain !== 'TUNNEL') {
    return {
      valueM: Math.max(4, Number(heightM.toFixed(1))),
      provenance: 'ESWA_RECORDED',
      sourceLabel: `Recorded ${mappingDomain} Slope / Bench Height (${heightM.toFixed(1)} m)`,
    };
  }
  if (isVertShaft) {
    const chDepth = Math.max(
      parseChainageStringToMeters(round.chainageTo, 0),
      parseChainageStringToMeters(round.chainageFrom, 0)
    );
    if (chDepth >= 8) {
      return {
        valueM: Number(chDepth.toFixed(1)),
        provenance: 'ESWA_RECORDED',
        sourceLabel: `Derived from Vertical Shaft Logged Sinking Depth (${chDepth.toFixed(1)} m)`,
      };
    }
  }
  // Derive reference tunnel overburden from Q-system SRF and logged chainage when geology is logged
  const srf = round.qSystem?.srf && Number(round.qSystem.srf) > 0 ? Number(round.qSystem.srf) : null;
  const chMeters = parseChainageStringToMeters(round.chainageTo || round.chainageFrom, 120);
  const chainageDerivedCover = Math.max(35, Math.min(380, Math.round(45 + (chMeters % 600) * 0.22)));
  const estDepth =
    srf !== null
      ? srf >= 5
        ? 240
        : srf >= 2.5
        ? 145
        : Math.max(65, chainageDerivedCover)
      : chainageDerivedCover;

  return {
    valueM: estDepth,
    provenance: hasAnyLoggedGeology ? 'REFERENCE_ESTIMATED' : 'MISSING_INPUT',
    sourceLabel:
      srf !== null
        ? `Derived from Logged Q-System SRF (${srf}) & Tunnel Station CH ${round.chainageTo || round.chainageFrom}m`
        : `Logged Station Reference Cover (CH ${round.chainageTo || round.chainageFrom}m; editable in cover bar)`,
  };
}

export function runCompleteFemDemAnalysis(
  project: FieldProjectItem,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  mappingDomain: MappingDomainType = 'TUNNEL',
  surfaceParams?: SurfaceGeometryParameters
): CompleteFemDemAnalysisResult {
  const cfg = round.femDemAnalysis || createDefaultFemDemConfig();
  const overrides = cfg.parameterOverrides || {};
  const siteTests = cfg.siteTestParameters || {};

  // 1. Geometry & Dimensions
  const isVertShaft =
    mappingDomain === 'TUNNEL' &&
    (isVerticalShaftLocation(location) || round.undergroundSubMode === 'vertical_shaft');
  const shaftBreakdown = isVertShaft
    ? computeVerticalShaftCircumferenceBreakdown(location, round)
    : null;
  const isShaftHalfFace =
    isVertShaft &&
    (round.excavationApproach === 'Half Face' ||
      (round.excavationApproach || '').startsWith('Half Face'));
  const shaftHalfSide =
    round.excavationApproach === 'Half Face — 3rd & 4th Quad (SW–WN)'
      ? 'left_half'
      : round.excavationApproach === 'Half Face — 1st & 2nd Quad (NE–ES)'
      ? 'right_half'
      : normalizeVerticalShaftHalfSide(round.shaftHalfSide);
  const shaftMedianStatus = normalizeVerticalShaftCenterMedianStatus(
    round.shaftCenterMedianStatus ||
      (round as { shaftMedianDivisionCondition?: string }).shaftMedianDivisionCondition
  );

  const spanWidthM =
    mappingDomain !== 'TUNNEL' && surfaceParams?.trenchWidthM
      ? Math.max(2.0, Number(surfaceParams.trenchWidthM || location.widthM || 8.5))
      : Math.max(2.0, Number(location.widthM || 8.5));
  const totalHeightM = isVertShaft
    ? spanWidthM
    : mappingDomain !== 'TUNNEL' && surfaceParams?.slopeHeightM
    ? Math.max(2.0, Number(surfaceParams.slopeHeightM || location.heightM || 12.0))
    : Math.max(2.0, Number(location.heightM || 7.5));
  const crossSectionAreaM2 = isVertShaft
    ? isShaftHalfFace && shaftMedianStatus === 'closed'
      ? (Math.PI * Math.pow(spanWidthM / 2, 2)) / 2
      : Math.PI * Math.pow(spanWidthM / 2, 2)
    : mappingDomain === 'TUNNEL'
    ? Math.PI * (spanWidthM / 2) * (totalHeightM / 2) * 0.86
    : spanWidthM * totalHeightM;
  const medianOpenSpanFactor =
    isShaftHalfFace && shaftMedianStatus === 'open' ? 1.12 : 1.0;
  const equivalentRadiusM = Number(
    (Math.sqrt(crossSectionAreaM2 / Math.PI) * medianOpenSpanFactor).toFixed(2)
  );

  // 2. Area-Weighted Logged Lithology & Structural Zones
  const lithoInfo = extractAreaWeightedLithologies(round);
  const refLitho = lithoInfo.compositeEntry;

  // 3. Weathering Resolution from Logged Round or Logged Discontinuity Sets / Q-System Ja
  const explicitWeatheringKey =
    round?.weatheringIndex && WEATHERING_MODIFIERS[round.weatheringIndex]
      ? round.weatheringIndex
      : null;

  const setWeatheringGrades: string[] = [];
  for (const setId of FIELD_JOINT_SET_IDS) {
    const wText = (round?.discontinuitySets?.[setId]?.weathering || '').toUpperCase();
    if (wText.startsWith('WVI')) setWeatheringGrades.push('WVI');
    else if (wText.startsWith('WV')) setWeatheringGrades.push('WV');
    else if (wText.startsWith('WIV')) setWeatheringGrades.push('WIV');
    else if (wText.startsWith('WIII')) setWeatheringGrades.push('WIII');
    else if (wText.startsWith('WII')) setWeatheringGrades.push('WII');
    else if (wText.startsWith('WI')) setWeatheringGrades.push('WI');
  }
  const inferredWeatheringFromJa =
    round?.qSystem?.ja !== null && round?.qSystem?.ja !== undefined && Number(round.qSystem.ja) > 0
      ? Number(round.qSystem.ja) <= 1.0
        ? 'WI'
        : Number(round.qSystem.ja) <= 2.0
        ? 'WII'
        : Number(round.qSystem.ja) <= 4.0
        ? 'WIII'
        : 'WIV'
      : null;

  const resolvedWeatheringKey =
    explicitWeatheringKey ||
    setWeatheringGrades[0] ||
    inferredWeatheringFromJa ||
    (lithoInfo.mappedFaultOrShearCount > 0 ? 'WIII' : 'WII');
  const wMod = WEATHERING_MODIFIERS[resolvedWeatheringKey] || WEATHERING_MODIFIERS.WII;
  const loggedWeatheringSourceLabel = explicitWeatheringKey
    ? `Logged ISRM Weathering Index (${wMod.label})`
    : setWeatheringGrades.length > 0
    ? `Derived from Logged Joint Set Weathering (${wMod.label})`
    : inferredWeatheringFromJa
    ? `Derived from Logged Q-System Ja=${round.qSystem.ja} (${wMod.label})`
    : `Logged Lithology Reference Baseline (${wMod.label})`;

  // 4. Aggregate All Logged Joint Traces, 3D Dip Surfaces, Discontinuity Sets & Fault/Shear Features
  const mappedTraces = round?.jointTraces || [];
  const mappedDipSurfaces = round?.dipPlaneSurfaces || [];
  const activeSetIds = FIELD_JOINT_SET_IDS.filter((setId) => {
    const st = round?.discontinuitySets?.[setId];
    return (
      mappedTraces.some((j) => j.setId === setId) ||
      mappedDipSurfaces.some((d) => d.setId === setId) ||
      Boolean(
        st &&
          (st.enabled ||
            st.manualOrientationOverride ||
            st.spacing ||
            st.roughness ||
            st.infilling ||
            st.aperture ||
            st.persistence)
      )
    );
  });
  const effectiveSetIds: FieldJointSetId[] =
    activeSetIds.length > 0 ? activeSetIds : ['J1', 'J2'];

  const loggedSpacingsM: number[] = [];
  const loggedPersistencesM: number[] = [];
  const loggedAperturesMm: number[] = [];
  const loggedJrcs: number[] = [];
  const loggedInfillMods: NonNullable<ReturnType<typeof parseInfillingModifier>>[] = [];

  for (const setId of effectiveSetIds) {
    const st = round?.discontinuitySets?.[setId];
    if (!st) continue;
    const sp = parseSpacingStringToMeters(st.spacing, st.spacingCustom);
    if (sp !== null) loggedSpacingsM.push(sp);
    const pe = parsePersistenceStringToMeters(st.persistence, st.persistenceCustom);
    if (pe !== null) loggedPersistencesM.push(pe);
    const ap = parseApertureStringToMm(st.aperture, st.apertureCustom);
    if (ap !== null) loggedAperturesMm.push(ap);
    const jrcVal = parseRoughnessStringToJrc(st.roughness);
    if (jrcVal !== null) loggedJrcs.push(jrcVal);
    const infMod = parseInfillingModifier(st.infilling);
    if (infMod !== null) loggedInfillMods.push(infMod);
  }

  // Also include actual metric trace lengths from mapped 2D/3D joint traces and dip surfaces
  for (const jt of mappedTraces) {
    if (jt.traceLengthM && jt.traceLengthM > 0.2) {
      loggedPersistencesM.push(jt.traceLengthM);
    } else if (jt.points && jt.points.length >= 2) {
      const pLenSvg = computePolylineLengthSvg(jt.points);
      const estLenM = Math.max(0.8, Math.min(18.0, (pLenSvg / 360) * spanWidthM));
      loggedPersistencesM.push(estLenM);
    }
  }
  for (const ds of mappedDipSurfaces) {
    if (ds.points && ds.points.length >= 2) {
      const pLenSvg = computePolylineLengthSvg(ds.points);
      const estLenM = Math.max(1.0, Math.min(16.0, (pLenSvg / 360) * spanWidthM));
      loggedPersistencesM.push(estLenM);
    }
  }

  // Compute mean joint spacing from logged sets OR directly from mapped trace density across the face/perimeter
  const totalMappedDiscontinuities =
    mappedTraces.length + mappedDipSurfaces.length + lithoInfo.mappedFaultOrShearCount;
  const traceDerivedSpacingM =
    totalMappedDiscontinuities > 0
      ? Number(
          Math.max(
            0.12,
            Math.min(
              1.8,
              (spanWidthM * 0.85) /
                Math.max(1.5, totalMappedDiscontinuities / Math.max(1, activeSetIds.length || 2))
            )
          ).toFixed(2)
        )
      : 0.65;

  const avgSpacingM = Number(
    (loggedSpacingsM.length > 0
      ? loggedSpacingsM.reduce((a, b) => a + b, 0) / loggedSpacingsM.length
      : traceDerivedSpacingM
    ).toFixed(2)
  );

  const avgPersistenceM = Number(
    (loggedPersistencesM.length > 0
      ? loggedPersistencesM.reduce((a, b) => a + b, 0) / loggedPersistencesM.length
      : 3.2
    ).toFixed(2)
  );

  const avgApertureMm = Number(
    (loggedAperturesMm.length > 0
      ? loggedAperturesMm.reduce((a, b) => a + b, 0) / loggedAperturesMm.length
      : lithoInfo.mappedFaultOrShearCount > 0
      ? 2.2
      : 0.45
    ).toFixed(2)
  );

  // 5. Strict Logged-Data Priority for Intact UCS (sigma_ci) — NEVER blend with unlogged S3 (72 MPa)
  const hasLoggedStrengthIndex = Boolean(
    round?.strengthIndex && ISRM_STRENGTH_UCS_MAP[round.strengthIndex]
  );
  const loggedSInfo = hasLoggedStrengthIndex
    ? ISRM_STRENGTH_UCS_MAP[round.strengthIndex]
    : null;

  const rawRmrUcsRating = round?.rmrSystem?.ucsRating;
  const hasLoggedRmrUcs =
    rawRmrUcsRating !== null &&
    rawRmrUcsRating !== undefined &&
    Number(rawRmrUcsRating) > 0;
  const rmrLoggedUcsMpa = hasLoggedRmrUcs
    ? Number(rawRmrUcsRating) >= 15
      ? 220
      : Number(rawRmrUcsRating) >= 12
      ? 145
      : Number(rawRmrUcsRating) >= 7
      ? 75
      : Number(rawRmrUcsRating) >= 4
      ? 37
      : Number(rawRmrUcsRating) >= 2
      ? 15
      : 3.5
    : null;

  const lithoWeatheredUcsMpa = Number((refLitho.ucsMpa * wMod.ucsFactor).toFixed(1));

  let derivedIntactUcsMpa = lithoWeatheredUcsMpa;
  let loggedUcsSourceLabel = '';
  let ucsProvenance: ParameterProvenanceType = 'REFERENCE_ESTIMATED';

  if (hasLoggedStrengthIndex && loggedSInfo) {
    ucsProvenance = 'ESWA_RECORDED';
    if (lithoInfo.hasMappedLithology) {
      // Constrain the logged lithology's weathered UCS within or calibrated to the logged ISRM S-band
      const clampedLithoToBand = Math.max(
        loggedSInfo.minMpa,
        Math.min(loggedSInfo.maxMpa, lithoWeatheredUcsMpa)
      );
      derivedIntactUcsMpa =
        rmrLoggedUcsMpa !== null
          ? Number(
              (
                clampedLithoToBand * 0.5 +
                loggedSInfo.midMpa * 0.3 +
                rmrLoggedUcsMpa * 0.2
              ).toFixed(1)
            )
          : Number((clampedLithoToBand * 0.6 + loggedSInfo.midMpa * 0.4).toFixed(1));
      loggedUcsSourceLabel = `Logged Strength ${loggedSInfo.label}${
        rmrLoggedUcsMpa !== null ? ` + RMR UCS Rating (${rawRmrUcsRating})` : ''
      } calibrated with Area-Weighted Lithology (${refLitho.rockFamily}, ${wMod.label})`;
    } else {
      derivedIntactUcsMpa =
        rmrLoggedUcsMpa !== null
          ? Number(((loggedSInfo.midMpa * 0.65 + rmrLoggedUcsMpa * 0.35) * wMod.ucsFactor).toFixed(1))
          : Number((loggedSInfo.midMpa * wMod.ucsFactor).toFixed(1));
      loggedUcsSourceLabel = `Logged ISRM Strength ${loggedSInfo.label}${
        rmrLoggedUcsMpa !== null ? ` & RMR UCS Rating (${rawRmrUcsRating})` : ''
      } adjusted for ${wMod.label}`;
    }
  } else if (rmrLoggedUcsMpa !== null) {
    ucsProvenance = 'ESWA_RECORDED';
    derivedIntactUcsMpa = lithoInfo.hasMappedLithology
      ? Number((rmrLoggedUcsMpa * 0.55 + lithoWeatheredUcsMpa * 0.45).toFixed(1))
      : rmrLoggedUcsMpa;
    loggedUcsSourceLabel = lithoInfo.hasMappedLithology
      ? `Logged RMR89 UCS Rating (${rawRmrUcsRating} → ${rmrLoggedUcsMpa} MPa) + Area-Weighted Lithology (${refLitho.rockFamily}, ${wMod.label})`
      : `Logged RMR89 UCS Rating (${rawRmrUcsRating} → ${rmrLoggedUcsMpa} MPa)`;
  } else if (lithoInfo.hasMappedLithology) {
    ucsProvenance = 'ESWA_RECORDED';
    derivedIntactUcsMpa = Math.max(2.0, lithoWeatheredUcsMpa);
    loggedUcsSourceLabel = `Area-Weighted Logged Lithology (${refLitho.rockFamily}: ${refLitho.ucsMpa} MPa × ${wMod.ucsFactor} for ${wMod.label})`;
  } else {
    ucsProvenance = 'REFERENCE_ESTIMATED';
    derivedIntactUcsMpa = Math.max(2.0, lithoWeatheredUcsMpa);
    loggedUcsSourceLabel = `Reference Baseline (${refLitho.rockFamily}, ${wMod.label})`;
  }

  // Infer display strength grade from derivedIntactUcsMpa if round.strengthIndex was not manually clicked
  const inferredStrengthKey =
    round?.strengthIndex && ISRM_STRENGTH_UCS_MAP[round.strengthIndex]
      ? round.strengthIndex
      : derivedIntactUcsMpa >= 200
      ? 'S1'
      : derivedIntactUcsMpa >= 100
      ? 'S2'
      : derivedIntactUcsMpa >= 50
      ? 'S3'
      : derivedIntactUcsMpa >= 25
      ? 'S4'
      : derivedIntactUcsMpa >= 5
      ? 'S5'
      : 'S6';
  const sInfo = ISRM_STRENGTH_UCS_MAP[inferredStrengthKey] || ISRM_STRENGTH_UCS_MAP.S3;

  // 6. Synthesize RMR89, Q-System & GSI from Logged Lithology, UCS, Joint Traces/Sets & Water Marks when not manually entered
  const qRes = computeFieldQValue(round?.qSystem);
  const rmrRes = computeFieldRmrValue(round?.rmrSystem);
  const hasQ = qRes.qValue !== null;
  const hasRmr = rmrRes.totalRmr !== null;
  const hasGsi =
    round?.gsiValue !== null &&
    round?.gsiValue !== undefined &&
    Number(round.gsiValue) > 0;

  // Volumetric joint count Jv (joints/m³) & Palmström (1982) RQD = 115 - 3.3 Jv
  const numActiveSets = Math.max(1, activeSetIds.length || (mappedTraces.length > 0 ? 2 : 1));
  const jvVolumetric = Math.max(1.5, Math.min(32, numActiveSets / Math.max(0.08, avgSpacingM)));
  const synthesizedRqd =
    round?.qSystem?.rqd && Number(round.qSystem.rqd) > 0
      ? Number(round.qSystem.rqd)
      : Math.round(Math.max(10, Math.min(98, 115 - 3.3 * jvVolumetric - lithoInfo.mappedFaultOrShearCount * 12)));

  const synthRmrUcsRating =
    hasLoggedRmrUcs
      ? Number(rawRmrUcsRating)
      : derivedIntactUcsMpa >= 200
      ? 15
      : derivedIntactUcsMpa >= 100
      ? 12
      : derivedIntactUcsMpa >= 50
      ? 7
      : derivedIntactUcsMpa >= 25
      ? 4
      : derivedIntactUcsMpa >= 5
      ? 2
      : 1;
  const synthRmrRqdRating =
    round?.rmrSystem?.rqdRating && Number(round.rmrSystem.rqdRating) > 0
      ? Number(round.rmrSystem.rqdRating)
      : synthesizedRqd >= 90
      ? 20
      : synthesizedRqd >= 75
      ? 17
      : synthesizedRqd >= 50
      ? 13
      : synthesizedRqd >= 25
      ? 8
      : 3;
  const synthRmrSpacingRating =
    round?.rmrSystem?.spacingRating && Number(round.rmrSystem.spacingRating) > 0
      ? Number(round.rmrSystem.spacingRating)
      : avgSpacingM >= 2.0
      ? 20
      : avgSpacingM >= 0.6
      ? 15
      : avgSpacingM >= 0.2
      ? 10
      : avgSpacingM >= 0.06
      ? 8
      : 5;

  const meanLoggedJrcPre =
    loggedJrcs.length > 0
      ? loggedJrcs.reduce((a, b) => a + b, 0) / loggedJrcs.length
      : refLitho.defaultJrc;
  const meanInfillMod = loggedInfillMods[0] || null;
  const synthRmrConditionRating =
    round?.rmrSystem?.conditionRating && Number(round.rmrSystem.conditionRating) > 0
      ? Number(round.rmrSystem.conditionRating)
      : Math.max(
          4,
          Math.min(
            30,
            Math.round(
              (avgPersistenceM < 1 ? 6 : avgPersistenceM <= 3 ? 4 : avgPersistenceM <= 10 ? 2 : 1) +
                (avgApertureMm <= 0.1 ? 6 : avgApertureMm <= 1.0 ? 4 : avgApertureMm <= 5.0 ? 1 : 0) +
                (meanLoggedJrcPre >= 14 ? 6 : meanLoggedJrcPre >= 10 ? 5 : meanLoggedJrcPre >= 6 ? 3 : 1) +
                (meanInfillMod ? meanInfillMod.rmrInfillSubRating : 5) +
                (resolvedWeatheringKey === 'WI'
                  ? 6
                  : resolvedWeatheringKey === 'WII'
                  ? 5
                  : resolvedWeatheringKey === 'WIII'
                  ? 3
                  : 1) -
                lithoInfo.mappedFaultOrShearCount * 4
            )
          )
        );

  const waterMarksCount = (round.waterMarks || []).length;
  const hasFlowingWater =
    (round.waterMarks || []).some(
      (w) =>
        w.condition.toLowerCase().includes('flowing') ||
        w.condition.toLowerCase().includes('pressure')
    ) ||
    effectiveSetIds.some((id) =>
      (round?.discontinuitySets?.[id]?.groundwater || '').toLowerCase().includes('flowing')
    );
  const hasDrippingWater =
    (round.waterMarks || []).some(
      (w) =>
        w.condition.toLowerCase().includes('dripping') ||
        w.condition.toLowerCase().includes('wet')
    ) ||
    effectiveSetIds.some((id) => {
      const gw = (round?.discontinuitySets?.[id]?.groundwater || '').toLowerCase();
      return gw.includes('dripping') || gw.includes('wet');
    });

  const synthRmrWaterRating =
    round?.rmrSystem?.waterRating !== null &&
    round?.rmrSystem?.waterRating !== undefined &&
    Number(round.rmrSystem.waterRating) > 0
      ? Number(round.rmrSystem.waterRating)
      : hasFlowingWater
      ? 4
      : hasDrippingWater
      ? 7
      : waterMarksCount > 0
      ? 10
      : 15;
  const synthRmrOrientAdj =
    round?.rmrSystem?.orientationAdj !== null &&
    round?.rmrSystem?.orientationAdj !== undefined
      ? Number(round.rmrSystem.orientationAdj)
      : lithoInfo.mappedFaultOrShearCount > 0
      ? -10
      : -5;

  const synthesizedRmr = Math.max(
    12,
    Math.min(
      95,
      Math.round(
        synthRmrUcsRating +
          synthRmrRqdRating +
          synthRmrSpacingRating +
          synthRmrConditionRating +
          synthRmrWaterRating +
          synthRmrOrientAdj
      )
    )
  );

  // Synthesize Q-value from logged joint sets, roughness, infilling, water, and faults
  const synthJn =
    round?.qSystem?.jn && Number(round.qSystem.jn) > 0
      ? Number(round.qSystem.jn)
      : activeSetIds.length >= 4
      ? 15
      : activeSetIds.length === 3
      ? 9
      : activeSetIds.length === 2
      ? 6
      : 4;
  const synthJr =
    round?.qSystem?.jr && Number(round.qSystem.jr) > 0
      ? Number(round.qSystem.jr)
      : meanLoggedJrcPre >= 14
      ? 3.0
      : meanLoggedJrcPre >= 9
      ? 2.0
      : meanLoggedJrcPre >= 6
      ? 1.5
      : 1.0;
  const synthJa =
    round?.qSystem?.ja && Number(round.qSystem.ja) > 0
      ? Number(round.qSystem.ja)
      : meanInfillMod
      ? meanInfillMod.jaEquivalent
      : resolvedWeatheringKey === 'WI'
      ? 1.0
      : resolvedWeatheringKey === 'WII'
      ? 2.0
      : resolvedWeatheringKey === 'WIII'
      ? 3.0
      : 4.0;
  const synthJw =
    round?.qSystem?.jw && Number(round.qSystem.jw) > 0
      ? Number(round.qSystem.jw)
      : hasFlowingWater
      ? 0.33
      : hasDrippingWater
      ? 0.66
      : 1.0;
  const synthSrf =
    round?.qSystem?.srf && Number(round.qSystem.srf) > 0
      ? Number(round.qSystem.srf)
      : lithoInfo.mappedFaultOrShearCount >= 2
      ? 5.0
      : lithoInfo.mappedFaultOrShearCount === 1
      ? 2.5
      : 1.0;

  const synthesizedQ = Number(
    Math.max(
      0.01,
      Math.min(400, (synthesizedRqd / synthJn) * (synthJr / synthJa) * (synthJw / synthSrf))
    ).toFixed(2)
  );

  const synthesizedGsi = Math.max(
    12,
    Math.min(
      90,
      Math.round(
        hasGsi
          ? Number(round.gsiValue)
          : hasRmr
          ? Math.max(15, rmrRes.totalRmr! - 5)
          : hasQ
          ? Math.max(15, 9 * Math.log(qRes.qValue!) + 39)
          : Math.max(15, synthesizedRmr - 5)
      )
    )
  );

  const safeQValue = hasQ ? qRes.qValue! : synthesizedQ;
  const safeRmrValue = hasRmr ? rmrRes.totalRmr! : synthesizedRmr;
  const gsiVal = synthesizedGsi;

  const hasAnyLoggedGeology =
    lithoInfo.hasMappedLithology ||
    hasLoggedStrengthIndex ||
    Boolean(explicitWeatheringKey) ||
    totalMappedDiscontinuities > 0 ||
    activeSetIds.length > 0 ||
    hasQ ||
    hasRmr ||
    hasGsi;

  const classificationSourceLabel =
    hasRmr || hasQ || hasGsi
      ? `Recorded in Stage 7 (${[
          hasRmr ? `RMR89=${rmrRes.totalRmr}` : null,
          hasQ ? `Q=${qRes.qValue}` : null,
          hasGsi ? `GSI=${round.gsiValue}` : null,
        ]
          .filter(Boolean)
          .join(', ')})`
      : `Synthesized from Logged Lithology & Joint Features (RMR89=${synthesizedRmr}, Q=${synthesizedQ}, GSI=${synthesizedGsi})`;

  // Helper to resolve parameter with 4-tier provenance
  const resolveParam = (
    key: FemDemParameterKey,
    symbol: string,
    label: string,
    category: ResolvedGeotechParameter['category'],
    baseValue: number,
    unit: string,
    applicableRange: string,
    baseProvenance: ParameterProvenanceType,
    referenceSource: string,
    applicabilityAndLimitation: string,
    correlationFormula?: string,
    importanceIfMissing?: string
  ): ResolvedGeotechParameter => {
    let finalVal = baseValue;
    let finalProv = baseProvenance;

    if (siteTests[key] !== undefined && !isNaN(Number(siteTests[key]))) {
      finalVal = Number(siteTests[key]);
      finalProv = 'SITE_TEST';
    }
    if (overrides[key] !== undefined && !isNaN(Number(overrides[key]))) {
      finalVal = Number(overrides[key]);
      finalProv = 'ENGINEER_OVERRIDE';
    }

    const badgeMap: Record<ParameterProvenanceType, string> = {
      SITE_TEST: 'SITE LAB / FIELD TEST',
      ESWA_RECORDED: 'LOGGED GEOLOGY DERIVED',
      REFERENCE_ESTIMATED: 'LOGGED LITHOLOGY / JOINT REF',
      ENGINEER_OVERRIDE: 'ENGINEER OVERRIDE',
      MISSING_INPUT: 'MISSING / REQUIRES INPUT',
    };

    return {
      key,
      symbol,
      label,
      category,
      value: Number(finalVal.toFixed(3)),
      defaultReferenceValue: Number(baseValue.toFixed(3)),
      unit,
      applicableRange,
      provenance: finalProv,
      provenanceBadge: badgeMap[finalProv],
      referenceSource,
      correlationFormula,
      applicabilityAndLimitation,
      importanceIfMissing,
    };
  };

  // 7. Resolve All 20 Geotechnical Parameters Directly from Logged Data
  const overburdenInfo = parseOverburdenFromRound(
    round,
    mappingDomain,
    totalHeightM,
    isVertShaft,
    hasAnyLoggedGeology
  );
  const pOverburden = resolveParam(
    'overburdenDepthM',
    'H',
    mappingDomain === 'TUNNEL'
      ? isVertShaft
        ? 'Shaft Depth / Overburden Horizon'
        : 'Overburden Depth / Rock Cover'
      : 'Excavation Slope / Bench Height',
    'stress_hydraulic',
    overburdenInfo.valueM,
    'm',
    mappingDomain === 'TUNNEL' ? '15 – 1200 m' : '3 – 150 m',
    overburdenInfo.provenance,
    overburdenInfo.sourceLabel,
    'Controls vertical in-situ stress σv = γ·H. Essential for stress-induced yielding and plastic radius calculation.',
    'σv = γ · H',
    'Overburden depth is not explicitly stored in standard face mapping; verify actual cover from longitudinal geological profile.'
  );

  const pUnitWeight = resolveParam(
    'unitWeightKnM3',
    'γ',
    `Rock Mass Unit Weight (${lithoInfo.dominant}, ${resolvedWeatheringKey})`,
    'intact_rock',
    Math.max(18.5, Number((refLitho.unitWeightKnM3 + wMod.unitWeightDelta).toFixed(2))),
    'kN/m³',
    refLitho.unitWeightRange,
    lithoInfo.hasMappedLithology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `${refLitho.sourceCitation} — adjusted for ${loggedWeatheringSourceLabel}`,
    `Area-weighted unit weight for ${refLitho.rockFamily} adjusted by ${wMod.unitWeightDelta.toFixed(1)} kN/m³ for ${resolvedWeatheringKey}.`
  );

  const pIntactUcs = resolveParam(
    'intactUcsMpa',
    'σ_ci',
    `Intact Uniaxial Compressive Strength (${inferredStrengthKey} • ${lithoInfo.dominant})`,
    'intact_rock',
    derivedIntactUcsMpa,
    'MPa',
    `${sInfo.range} | Litho Ref: ${refLitho.ucsRange}`,
    ucsProvenance,
    loggedUcsSourceLabel,
    'Derived strictly from logged Strength Index / RMR UCS / Area-Weighted Mapped Lithology & Weathering without generic S3 averaging.'
  );

  const pMi = resolveParam(
    'hoekBrownMi',
    'm_i',
    `Hoek–Brown Intact Constant (${refLitho.rockFamily})`,
    'intact_rock',
    refLitho.mi,
    'dimensionless',
    refLitho.miRange,
    lithoInfo.hasMappedLithology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    refLitho.sourceCitation,
    `Area-weighted Hoek–Brown frictional constant m_i for ${refLitho.rockFamily}.`
  );

  const baseTensileMpa = Number((pIntactUcs.value / Math.max(5.0, pMi.value)).toFixed(2));
  const pTensile = resolveParam(
    'intactTensileMpa',
    'σ_t',
    'Intact Brazilian Tensile Strength',
    'intact_rock',
    baseTensileMpa,
    'MPa',
    '0.3 – 25.0 MPa',
    lithoInfo.hasMappedLithology || hasLoggedStrengthIndex ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Hoek & Brown (1997) Relationship σt = σci / mi (${pIntactUcs.value} / ${pMi.value})`,
    'Derived directly from logged intact UCS and area-weighted lithology Hoek–Brown constant mi.',
    'σ_t = σ_ci / m_i'
  );

  // Intact Young's Modulus Ei scaled by logged lithology Modulus Ratio MR = (Ei_ref * 1000) / UCS_ref and logged UCS
  const weightedModulusRatioMr = Math.max(
    220,
    Math.min(550, (refLitho.eiGpa * 1000) / Math.max(5, refLitho.ucsMpa))
  );
  const baseEiGpa = Number(
    Math.max(
      0.8,
      ((pIntactUcs.value * weightedModulusRatioMr) / 1000) *
        (hasLoggedStrengthIndex || hasLoggedRmrUcs ? 1.0 : wMod.modulusFactor / Math.max(0.1, wMod.ucsFactor))
    ).toFixed(1)
  );
  const pIntactEi = resolveParam(
    'intactModulusEiGpa',
    'E_i',
    `Intact Rock Young's Modulus (MR=${Math.round(weightedModulusRatioMr)})`,
    'intact_rock',
    baseEiGpa,
    'GPa',
    refLitho.eiRange,
    lithoInfo.hasMappedLithology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `${refLitho.sourceCitation} — Deere (1968) & Hoek–Diederichs (2006) E_i = MR · σ_ci`,
    `Computed from logged UCS (${pIntactUcs.value} MPa) and area-weighted lithology Modulus Ratio MR=${Math.round(weightedModulusRatioMr)}.`,
    'E_i = MR · σ_ci'
  );

  const pPoisson = resolveParam(
    'poissonRatio',
    'ν',
    `Rock Mass Poisson's Ratio (${lithoInfo.dominant})`,
    'intact_rock',
    refLitho.poissonRatio,
    'dimensionless',
    refLitho.poissonRange,
    lithoInfo.hasMappedLithology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    refLitho.sourceCitation,
    'Area-weighted elastic lateral strain ratio from logged lithology.'
  );

  // Blast damage factor D from ESWA excavation mode & overbreak survey
  const modeLower = (round.modeOfExcavation || '').toLowerCase();
  const defaultBlastD =
    modeLower.includes('tbm') || modeLower.includes('roadheader') || modeLower.includes('mechanical')
      ? 0.0
      : modeLower.includes('controlled') || modeLower.includes('smooth')
      ? 0.2
      : mappingDomain !== 'TUNNEL'
      ? 0.5
      : 0.35;

  const pBlastD = resolveParam(
    'blastDamageFactorD',
    'D',
    `Excavation Disturbance Factor (${round.modeOfExcavation || 'Drill & Blast'})`,
    'rock_mass_fem',
    cfg.blastDamageFactorD ?? defaultBlastD,
    '0.0 – 1.0',
    '0.0 (TBM/Mechanical) – 0.8 (Poor Blasting / Slope)',
    'ESWA_RECORDED',
    `Hoek, Carranza-Torres & Corkum (2002) — derived from ESWA Excavation Mode: ${round.modeOfExcavation || 'Drill & Blast'}`,
    'D applies to the blast-disturbed zone surrounding the excavation or slope boundary.',
    'Hoek-Brown (2002) Disturbance Factor D'
  );

  // Generalized Hoek-Brown (2002) & Hoek-Diederichs (2006) Rock Mass Properties from Logged GSI, Ei, UCS, mi
  const D = Math.max(0, Math.min(0.85, pBlastD.value));
  const mb = pMi.value * Math.exp((gsiVal - 100) / (28 - 14 * D));
  const s = Math.exp((gsiVal - 100) / (9 - 3 * D));
  const a = 0.5 + (1 / 6) * (Math.exp(-gsiVal / 15) - Math.exp(-20 / 3));

  const ermHoekDiederichsGpa =
    pIntactEi.value * (0.02 + (1 - D / 2) / (1 + Math.exp((60 + 15 * D - gsiVal) / 11)));

  const pErm = resolveParam(
    'rockMassModulusErmGpa',
    'E_rm',
    'Rock Mass Deformation Modulus',
    'rock_mass_fem',
    Number(Math.max(0.2, ermHoekDiederichsGpa).toFixed(2)),
    'GPa',
    '0.2 – 65.0 GPa',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Hoek & Diederichs (2006) from Logged GSI=${gsiVal}, Ei=${pIntactEi.value} GPa, D=${D}`,
    'Empirical rock mass deformation modulus derived from logged lithology Ei and logged/synthesized GSI.',
    'E_rm = E_i · [0.02 + (1 - D/2) / (1 + exp((60 + 15D - GSI)/11))]'
  );

  // Sheorey (1994) thermo-elastic crustal stress ratio K0 = 0.25 + 7 * Eh * (0.001 + 1 / H) + tectonic fault adjustment
  const sheoreyK0 =
    0.25 +
    7 * Math.max(1.5, pErm.value) * (0.001 + 1 / Math.max(25, pOverburden.value)) +
    (lithoInfo.mappedFaultOrShearCount > 0 || lithoInfo.mappedFoldCount > 0 ? 0.12 : 0);
  const defaultK0 = Number(Math.max(0.55, Math.min(2.2, sheoreyK0)).toFixed(2));

  const pK0 = resolveParam(
    'horizontalStressRatioK0',
    'K₀',
    'In-Situ Horizontal-to-Vertical Stress Ratio',
    'stress_hydraulic',
    cfg.horizontalStressRatioK0 ?? defaultK0,
    'ratio',
    '0.50 – 2.50',
    cfg.horizontalStressRatioK0 !== undefined
      ? 'ENGINEER_OVERRIDE'
      : hasAnyLoggedGeology
      ? 'ESWA_RECORDED'
      : 'REFERENCE_ESTIMATED',
    `Sheorey (1994) Crustal Stress Model from E_rm=${pErm.value.toFixed(1)} GPa & H=${pOverburden.value}m${
      lithoInfo.mappedFaultOrShearCount > 0 ? ' (+Tectonic Fault/Fold Factor)' : ''
    }`,
    'Derived from rock mass stiffness Erm and overburden depth H via Sheorey (1994) thermo-elastic equation.',
    'K₀ = 0.25 + 7·E_rm·(0.001 + 1/H)'
  );

  // Pore water pressure derived from ESWA water marks, discontinuity set groundwater, Q-system Jw & RMR water rating
  let basePoreWaterKpa = 0;
  if (hasFlowingWater || synthJw <= 0.33) {
    basePoreWaterKpa = Math.min(600, Number((pOverburden.value * 9.81 * 0.35).toFixed(1)));
  } else if (hasDrippingWater || synthJw <= 0.66 || waterMarksCount > 0) {
    basePoreWaterKpa = Math.min(250, Number((pOverburden.value * 9.81 * 0.15).toFixed(1)));
  } else if (synthRmrWaterRating < 15) {
    basePoreWaterKpa = 35;
  }

  const pPoreWater = resolveParam(
    'poreWaterPressureKpa',
    'u_w',
    'Joint / Rock Mass Pore Water Pressure',
    'stress_hydraulic',
    basePoreWaterKpa,
    'kPa',
    '0 – 1500 kPa',
    'ESWA_RECORDED',
    `Derived from Logged Water Marks (${waterMarksCount}), Joint Set Groundwater, Q Jw=${synthJw}, RMR Water=${synthRmrWaterRating}`,
    'Reduces effective normal stress (σn\' = σn - uw) along discontinuity planes and increases support demand.',
    "σ'n = σn - u_w"
  );

  // Equivalent Mohr-Coulomb (Hoek et al. 2002) for tunnel/shaft/slope confining stress sigma3_max
  const sigmaV_Mpa = (pUnitWeight.value * pOverburden.value) / 1000;
  const sigmaH_Mpa = sigmaV_Mpa * pK0.value;
  const sigmaHMinShaftMpa = sigmaH_Mpa * (pK0.value >= 1.0 ? 0.85 : 0.92);
  const p0_Mpa = Number(
    (isVertShaft
      ? (sigmaH_Mpa + sigmaHMinShaftMpa) / 2
      : (sigmaV_Mpa + sigmaH_Mpa) / 2
    ).toFixed(3)
  );

  const sigmaCmGlobalMpa =
    pIntactUcs.value *
    ((mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1)) /
    (2 * (1 + a) * (2 + a));
  const sigma3MaxMpa =
    mappingDomain !== 'TUNNEL'
      ? Math.max(0.05, 0.72 * sigmaCmGlobalMpa * Math.pow(sigmaCmGlobalMpa / Math.max(0.05, pUnitWeight.value * totalHeightM * 0.001), -0.91))
      : Math.max(0.15, 0.47 * sigmaCmGlobalMpa * Math.pow(sigmaCmGlobalMpa / Math.max(0.2, p0_Mpa), -0.94));
  const sigma3n = sigma3MaxMpa / Math.max(1.0, pIntactUcs.value);

  const sinPhi =
    (6 * a * mb * Math.pow(s + mb * sigma3n, a - 1)) /
    (2 * (1 + a) * (2 + a) + 6 * a * mb * Math.pow(s + mb * sigma3n, a - 1));
  const phiRmDeg = Number(
    Math.max(12, Math.min(62, (Math.asin(Math.min(0.92, sinPhi)) * 180) / Math.PI)).toFixed(2)
  );

  const cohesionRmMpa = Number(
    (
      (pIntactUcs.value *
        ((1 + 2 * a) * s + (1 - a) * mb * sigma3n) *
        Math.pow(s + mb * sigma3n, a - 1)) /
      ((1 + a) *
        (2 + a) *
        Math.sqrt(1 + (6 * a * mb * Math.pow(s + mb * sigma3n, a - 1)) / ((1 + a) * (2 + a))))
    ).toFixed(3)
  );

  const pCohesionRm = resolveParam(
    'rockMassCohesionMpa',
    'c_rm',
    'Equivalent Rock Mass Cohesion',
    'rock_mass_fem',
    Math.max(0.03, cohesionRmMpa),
    'MPa',
    '0.03 – 12.0 MPa',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Fit from Logged GSI=${gsiVal}, σci=${pIntactUcs.value} MPa, mi=${pMi.value}`,
    'Stress-dependent Hoek–Brown equivalent Mohr–Coulomb cohesion for the logged lithology and stress state.',
    'Hoek, Carranza-Torres & Corkum (2002) Eq. 4'
  );

  const pFrictionRm = resolveParam(
    'rockMassFrictionDeg',
    'φ_rm',
    'Equivalent Rock Mass Friction Angle',
    'rock_mass_fem',
    phiRmDeg,
    '°',
    '14° – 58°',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Fit from Logged GSI=${gsiVal}, mi=${pMi.value}, D=${D}`,
    'Continuum equivalent internal friction angle derived from logged lithology and rock mass structure.',
    'Hoek, Carranza-Torres & Corkum (2002) Eq. 5'
  );

  const pScm = resolveParam(
    'rockMassStrengthScmMpa',
    'σ_cm',
    'Global Rock Mass Uniaxial Strength',
    'rock_mass_fem',
    Number(Math.max(0.15, sigmaCmGlobalMpa).toFixed(2)),
    'MPa',
    '0.15 – 85.0 MPa',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Global Strength from GSI=${gsiVal}, σci=${pIntactUcs.value} MPa`,
    'Overall rock mass compressive capacity derived from logged UCS, lithology mi, and GSI.',
    'Hoek et al. (2002) Eq. 9'
  );

  // 8. Discontinuity / Joint Parameters Derived Strictly from Logged Discontinuity Sets, Traces & Fault/Shear Features
  const hasExplicitSetRoughness = loggedJrcs.length > 0;
  const hasExplicitQJr = Boolean(round?.qSystem?.jr && Number(round.qSystem.jr) > 0);
  const jrDerivedJrc =
    synthJr >= 3.0 ? 14.5 : synthJr >= 2.0 ? 10.5 : synthJr >= 1.5 ? 8.0 : 4.5;

  const baseJrc0 = hasExplicitSetRoughness
    ? loggedJrcs.reduce((acc, v) => acc + v, 0) / loggedJrcs.length
    : hasExplicitQJr
    ? jrDerivedJrc * 0.65 + refLitho.defaultJrc * 0.35
    : refLitho.defaultJrc;

  // Barton & Bandis (1982) scale effect for trace persistence L_n and fault/shear reduction
  const scaleFactorJrc = Math.pow(
    Math.max(1.0, Math.min(12.0, avgPersistenceM / 0.2)),
    -0.012 * baseJrc0
  );
  const faultJrcPenalty = lithoInfo.mappedFaultOrShearCount > 0 ? 0.82 : 1.0;
  const derivedJrc = Number(
    Math.max(1.5, Math.min(19.0, baseJrc0 * scaleFactorJrc * faultJrcPenalty)).toFixed(1)
  );

  // JCS derived from logged Intact UCS, logged joint wall weathering ratio, and fault/shear alteration
  const faultJcsPenalty = lithoInfo.mappedFaultOrShearCount > 0 ? 0.78 : 1.0;
  const derivedJcsMpa = Number(
    Math.max(2.0, pIntactUcs.value * wMod.jcsRatio * faultJcsPenalty).toFixed(1)
  );

  // Barton & Choubey (1977) residual friction angle phi_r = (phi_b - 20) + 20 * (JCS / sigma_ci) + infilling / Jr-Ja adjustment
  const bartonChoubeyPhiR =
    refLitho.basicFrictionDeg -
    20 +
    20 * Math.min(1.0, derivedJcsMpa / Math.max(2.0, pIntactUcs.value));
  const infillFrictionDelta =
    loggedInfillMods.length > 0
      ? loggedInfillMods.reduce((acc, m) => acc + m.frictionDeltaDeg, 0) / loggedInfillMods.length
      : 0;
  const qJointFrictionDeg = (Math.atan(synthJr / Math.max(0.75, synthJa)) * 180) / Math.PI;
  const rawJointFriction =
    hasExplicitQJr || Boolean(round?.qSystem?.ja && Number(round.qSystem.ja) > 0)
      ? (bartonChoubeyPhiR + infillFrictionDelta) * 0.65 + qJointFrictionDeg * 0.35
      : bartonChoubeyPhiR + infillFrictionDelta;
  const faultFrictionPenaltyDeg = lithoInfo.mappedFaultOrShearCount > 0 ? -2.5 : 0;
  const derivedJointFrictionDeg = Number(
    Math.max(13.0, Math.min(44.0, rawJointFriction + faultFrictionPenaltyDeg)).toFixed(1)
  );

  // Joint apparent cohesion c_j from logged infilling, aperture, roughness, and fault/shear presence
  const baseInfillCohesionKpa =
    loggedInfillMods.length > 0
      ? loggedInfillMods.reduce((acc, m) => acc + m.cohesionKpa, 0) / loggedInfillMods.length
      : avgApertureMm <= 0.15
      ? 45
      : avgApertureMm <= 1.0
      ? 32
      : avgApertureMm <= 5.0
      ? 18
      : 8;
  const jrcCohesionFactor = 0.75 + (derivedJrc / 20) * 0.5;
  const faultCohesionFactor = lithoInfo.mappedFaultOrShearCount > 0 ? 0.68 : 1.0;
  const baseJointCohesionKpa = Number(
    Math.max(4, Math.min(120, baseInfillCohesionKpa * jrcCohesionFactor * faultCohesionFactor)).toFixed(1)
  );

  const firstSet = round.discontinuitySets?.[effectiveSetIds[0]];
  const pJointJrc = resolveParam(
    'jointJrc',
    'JRC',
    'Joint Roughness Coefficient (Barton)',
    'joint_dem',
    derivedJrc,
    '0 – 20',
    '2 (Slickensided) – 18 (Rough Stepped)',
    hasExplicitSetRoughness || hasExplicitQJr || lithoInfo.hasMappedLithology
      ? 'ESWA_RECORDED'
      : 'REFERENCE_ESTIMATED',
    `Derived from Logged Joint Roughness (${firstSet?.roughness || `${refLitho.rockFamily} JRC₀=${refLitho.defaultJrc}`}), Persistence L=${avgPersistenceM}m & Jr=${synthJr}`,
    'Barton & Choubey (1977) & Barton–Bandis (1982) scale-corrected roughness index from logged discontinuity sets and traces.',
    'JRC_n = JRC_0 · (L_n / L_0)^(-0.02·JRC_0)'
  );

  const pJointJcs = resolveParam(
    'jointJcsMpa',
    'JCS',
    'Joint Wall Compressive Strength',
    'joint_dem',
    derivedJcsMpa,
    'MPa',
    '2 – 220 MPa',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Barton & Choubey (1977) Wall Strength from Logged σci=${pIntactUcs.value} MPa & Joint Wall Weathering ${resolvedWeatheringKey} (JCS/σci=${wMod.jcsRatio})`,
    'Derived directly from logged intact UCS and joint wall weathering factor.',
    'τ = σ\'n · tan[φ_r + JRC · log10(JCS / σ\'n)]'
  );

  const pJointFriction = resolveParam(
    'jointFrictionAngleDeg',
    'φ_j',
    'Discontinuity Residual / Basic Friction Angle',
    'joint_dem',
    derivedJointFrictionDeg,
    '°',
    refLitho.frictionRange,
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Barton–Choubey (1977) φ_r from ${refLitho.rockFamily} (φ_b=${refLitho.basicFrictionDeg}°), Infilling (${
      meanInfillMod?.label || firstSet?.infilling || 'Clean'
    }), Jr/Ja=${synthJr}/${synthJa}`,
    'Controls block sliding resistance along mapped joint traces, 3D dip surfaces, and fault planes in DEM analysis.',
    'φ_r = (φ_b - 20°) + 20°·(JCS / σ_ci) + Δφ_infill'
  );

  const pJointCohesion = resolveParam(
    'jointCohesionKpa',
    'c_j',
    'Discontinuity Apparent Cohesion / Interlock',
    'joint_dem',
    baseJointCohesionKpa,
    'kPa',
    '0 – 150 kPa',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Derived from Logged Joint Infilling (${meanInfillMod?.label || firstSet?.infilling || 'Tight/Clean'}), Aperture (${avgApertureMm}mm) & JRC=${pJointJrc.value}`,
    'Apparent cohesion from surface asperity interlock and infilling cementation across mapped joint sets.'
  );

  // Bandis, Lumsden & Barton (1983) Hyperbolic Joint Normal & Shear Stiffness from Logged JRC, JCS, Aperture e0, Spacing s, and Erm
  const bandisKni = Math.max(
    1.5,
    -7.15 + 1.75 * pJointJrc.value + 0.02 * (pJointJcs.value / Math.max(0.06, avgApertureMm))
  );
  const continuumCompatibleKn =
    (pErm.value * pIntactEi.value) /
    (Math.max(0.4, pIntactEi.value - pErm.value * 0.85) * Math.max(0.12, avgSpacingM));
  const baseKnGpaM = Number(
    Math.max(1.2, Math.min(60.0, bandisKni * 0.45 + continuumCompatibleKn * 0.55)).toFixed(2)
  );
  const shearStiffRatio = Math.max(
    0.18,
    Math.min(0.42, 0.22 + 0.008 * pJointJrc.value - (lithoInfo.mappedFaultOrShearCount > 0 ? 0.05 : 0))
  );
  const baseKsGpaM = Number(Math.max(0.4, baseKnGpaM * shearStiffRatio).toFixed(2));

  const pJointKn = resolveParam(
    'jointNormalStiffnessKnGpaM',
    'k_n',
    'Joint Normal Stiffness (Bandis Hyperbolic)',
    'joint_dem',
    baseKnGpaM,
    'GPa/m',
    '1.2 – 60.0 GPa/m',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Bandis, Lumsden & Barton (1983) from Logged JRC=${pJointJrc.value}, JCS=${pJointJcs.value} MPa, e₀=${avgApertureMm}mm, s=${avgSpacingM}m, Erm=${pErm.value} GPa`,
    'Controls joint normal closure and relaxation opening around the excavation perimeter.',
    'k_ni = -7.15 + 1.75·JRC + 0.02·(JCS / e_0)'
  );

  const pJointKs = resolveParam(
    'jointShearStiffnessKsGpaM',
    'k_s',
    'Joint Shear Stiffness (Barton–Bandis)',
    'joint_dem',
    baseKsGpaM,
    'GPa/m',
    '0.4 – 25.0 GPa/m',
    hasAnyLoggedGeology ? 'ESWA_RECORDED' : 'REFERENCE_ESTIMATED',
    `Bandis et al. (1983) from k_n=${pJointKn.value} GPa/m, JRC=${pJointJrc.value}, Persistence L=${avgPersistenceM}m`,
    'Governs elastic shear slip along mapped discontinuities prior to peak shear mobilization.'
  );

  const parameters: ResolvedGeotechParameter[] = [
    pOverburden,
    pK0,
    pPoreWater,
    pUnitWeight,
    pIntactUcs,
    pTensile,
    pIntactEi,
    pPoisson,
    pMi,
    pBlastD,
    pErm,
    pCohesionRm,
    pFrictionRm,
    pScm,
    pJointJrc,
    pJointJcs,
    pJointFriction,
    pJointCohesion,
    pJointKn,
    pJointKs,
  ];

  const loggedReferenceBasis: LoggedGeologicalReferenceBasis = {
    hasAnyLoggedGeology,
    lithologyShares: lithoInfo.shares,
    compositeFormulaLabel:
      lithoInfo.shares.length > 0
        ? lithoInfo.shares
            .map((s) => `${s.rockName} (${s.weightPct}%, UCS ${s.ucsMpa} MPa, mi ${s.mi})`)
            .join(' + ')
        : 'No Lithology Strokes Mapped Yet (Using Baseline Reference)',
    loggedUcsSourceLabel,
    loggedWeatheringSourceLabel,
    loggedJointsSummaryLabel: `${mappedTraces.length} Joint Trace(s), ${mappedDipSurfaces.length} 3D Dip Surface(s), ${activeSetIds.length} Active Set(s) (Mean Spacing s=${avgSpacingM}m, L=${avgPersistenceM}m, e₀=${avgApertureMm}mm)`,
    loggedStructuresSummaryLabel:
      lithoInfo.mappedFaultOrShearCount > 0 || lithoInfo.mappedFoldCount > 0
        ? `${lithoInfo.mappedFaultOrShearCount} Fault/Shear Zone(s), ${lithoInfo.mappedFoldCount} Fold Axis Trace(s) Integrated`
        : 'No Major Fault / Shear Zone Traces Mapped',
    mappedJointTracesCount: mappedTraces.length,
    mappedDipSurfacesCount: mappedDipSurfaces.length,
    activeDiscontinuitySetsCount: activeSetIds.length,
    mappedFaultOrShearCount: lithoInfo.mappedFaultOrShearCount,
    mappedFoldCount: lithoInfo.mappedFoldCount,
    avgJointSpacingM: avgSpacingM,
    avgJointPersistenceM: avgPersistenceM,
    avgJointApertureMm: avgApertureMm,
    synthesizedRmr,
    synthesizedQ,
    synthesizedGsi,
    classificationSourceLabel,
  };

  // 5. Evaluate Actual Installed ESWA Support System (Hoek & Brown 1997 / Brady & Brown 2004 Support Stiffness)
  const sup: FieldSupportSystemConfig = round.supportSystem || createDefaultSupportSystem();
  const activeSystemsSummary: string[] = [];

  let rockBoltsPressureMpa = 0;
  let rockBoltsStiffnessMpaPerM = 0;
  const boltLenM = Math.max(1.5, Number(sup.rockBoltLengthM || sup.soilNailLengthM || 4.0));
  const boltSpInM = Math.max(0.5, Number(sup.rockBoltInPlaneSpacingM || sup.soilNailSpacingM || 1.5));
  const boltSpLongM = Math.max(0.5, Number(sup.rockBoltLongitudinalSpacingM || sup.soilNailSpacingM || 1.5));

  if (sup.rockBoltsEnabled || sup.soilNailsEnabled) {
    // 25mm rebar ultimate tensile capacity T_bf ≈ 0.245 MN
    const boltCapacityMn = 0.245;
    rockBoltsPressureMpa = boltCapacityMn / (boltSpInM * boltSpLongM);
    // Bolt stiffness K_sb = (E_s * A_s) / (L_b * s_c * s_l * R_eq)
    const steelAreaM2 = Math.PI * Math.pow(0.0125, 2); // 25mm dia
    const steelModulusMpa = 200000;
    rockBoltsStiffnessMpaPerM =
      (steelModulusMpa * steelAreaM2) / (boltLenM * boltSpInM * boltSpLongM);
    activeSystemsSummary.push(
      sup.soilNailsEnabled
        ? `Soil Nails ${sup.soilNailType || 'Ø25mm'} L=${boltLenM}m @ ${boltSpInM}×${boltSpLongM}m`
        : `Systematic Bolts (${sup.rockBoltType || 'Ø25mm Grouted'}) L=${boltLenM}m @ ${boltSpInM}×${boltSpLongM}m`
    );
  }

  let spotBoltsPressureMpa = 0;
  const spotBoltsList = sup.spotBolts || [];
  const spotBoltsCount = spotBoltsList.length;
  if (sup.spotBoltsEnabled && spotBoltsCount > 0) {
    const totalSpotTensileKn = spotBoltsList.reduce((acc, sb) => {
      const d = sb.diameterMm || 25;
      const fy = sb.gradeMpa || 500;
      const cap = sb.tensileCapacityKn || (Math.PI * Math.pow(d / 1000, 2) / 4) * (fy * 1000);
      return acc + cap;
    }, 0);
    const tunnelPerimM = isVertShaft
      ? Math.PI * spanWidthM
      : spanWidthM * 2 + totalHeightM;
    const pullLenM = Math.max(1.0, round.pullLengthMeters || 3.0);
    const addedPressureMpa = totalSpotTensileKn / Math.max(1, tunnelPerimM * pullLenM * 1000);
    spotBoltsPressureMpa = Number(Math.min(0.12, Math.max(0.015 * spotBoltsCount, addedPressureMpa)).toFixed(3));
    activeSystemsSummary.push(
      isVertShaft
        ? `${spotBoltsCount} Radial Shaft Spot Bolt(s) (${Math.round(totalSpotTensileKn)} kN cap)`
        : `${spotBoltsCount} Targeted Spot Bolt(s) (${Math.round(totalSpotTensileKn)} kN cap)`
    );
  }

  let shotcretePressureMpa = 0;
  let shotcreteStiffnessMpaPerM = 0;
  const shotcreteThickMm = Number(
    sup.shotcreteCrownThicknessMm || sup.shotcreteThicknessMm || 0
  );
  if (sup.shotcreteEnabled && shotcreteThickMm > 0) {
    const tcM = shotcreteThickMm / 1000;
    const fckShotcreteMpa = sup.shotcreteType === 'Plain' ? 25 : 35; // SFRS vs Plain
    const ecShotcreteMpa = 26000;
    const nuC = 0.2;
    const r2_tc2 = Math.pow(equivalentRadiusM, 2) - Math.pow(Math.max(0.5, equivalentRadiusM - tcM), 2);
    // Closed 360° circular shaft ring develops full hoop arch compression (+18% ring efficiency vs open-invert arch)
    const closedRingFactor = isVertShaft && (!isShaftHalfFace || shaftMedianStatus === 'closed') ? 1.18 : 1.0;
    shotcretePressureMpa =
      0.5 * fckShotcreteMpa * (1 - Math.pow(Math.max(0.5, equivalentRadiusM - tcM), 2) / Math.pow(equivalentRadiusM, 2)) * closedRingFactor;
    shotcreteStiffnessMpaPerM =
      ((ecShotcreteMpa * r2_tc2) /
        ((1 + nuC) * ((1 - 2 * nuC) * Math.pow(equivalentRadiusM, 2) + Math.pow(equivalentRadiusM - tcM, 2)) * equivalentRadiusM)) *
      closedRingFactor;
    activeSystemsSummary.push(
      isVertShaft
        ? `${sup.shotcreteType || 'SFRS'} Circular Shaft Ring ${shotcreteThickMm}mm`
        : `${sup.shotcreteType || 'SFRS'} Shotcrete ${shotcreteThickMm}mm (${sup.shotcreteScope === 'crown_only' ? 'Crown' : 'Crown+Wall'})`
    );
  }

  let steelSetOrLatticePressureMpa = 0;
  let steelSetOrLatticeStiffnessMpaPerM = 0;
  if (sup.latticeGirderEnabled) {
    const lgSpM = Math.max(0.4, Number(sup.latticeGirderSpacingM || 1.2));
    steelSetOrLatticePressureMpa += (isVertShaft ? 0.25 : 0.22) / lgSpM;
    steelSetOrLatticeStiffnessMpaPerM += (isVertShaft ? 110 : 95) / lgSpM;
    activeSystemsSummary.push(
      isVertShaft
        ? `Circular Lattice Girder Ring (${sup.latticeGirderSpec || '3-Bar LG'}) @ ${lgSpM}m c/c`
        : `Lattice Girder (${sup.latticeGirderSpec || '3-Bar LG'}) @ ${lgSpM}m c/c`
    );
  }
  if (sup.ismbEnabled) {
    const ismbSpM = Math.max(0.4, Number(sup.ismbSpacingM || 1.0));
    steelSetOrLatticePressureMpa += (isVertShaft ? 0.44 : 0.38) / ismbSpM;
    steelSetOrLatticeStiffnessMpaPerM += (isVertShaft ? 190 : 165) / ismbSpM;
    activeSystemsSummary.push(
      isVertShaft
        ? `Circular Steel Curb Ring (${sup.ismbSpec || 'ISMB 150'}) @ ${ismbSpM}m c/c`
        : `Steel Rib (${sup.ismbSpec || 'ISMB 150'}) @ ${ismbSpM}m c/c`
    );
  }

  let wireMeshRetentionKpa = 0;
  if (sup.wireMeshEnabled) {
    wireMeshRetentionKpa = 35;
    activeSystemsSummary.push(
      isVertShaft
        ? `360° Shaft Wall Wire Mesh (${sup.wireMeshType || 'Welded 100×100×6mm'})`
        : `Wire Mesh (${sup.wireMeshType || 'Welded 100×100×6mm'})`
    );
  }

  let forepolingOrCanopyPressureMpa = 0;
  if (sup.protectionSupportEnabled) {
    if (sup.pipeRoofingEnabled) {
      forepolingOrCanopyPressureMpa += 0.18;
      activeSystemsSummary.push(`Pipe Roofing Ø${sup.pipeRoofingDiameterMm || 114}mm Canopy`);
    } else if (sup.forepolingEnabled !== false) {
      forepolingOrCanopyPressureMpa += 0.10;
      activeSystemsSummary.push(`Forepoling Ø${sup.forepolingDiameterMm || 32}mm Spiles`);
    }
    if (sup.groutingEnabled) {
      forepolingOrCanopyPressureMpa += 0.08;
      activeSystemsSummary.push(`Consolidation Grouting (${sup.groutingPressureBar || 15} bar)`);
    }
  }

  const totalMaxSupportPressureMpa = Number(
    (
      rockBoltsPressureMpa +
      spotBoltsPressureMpa +
      shotcretePressureMpa +
      steelSetOrLatticePressureMpa +
      wireMeshRetentionKpa / 1000 +
      forepolingOrCanopyPressureMpa
    ).toFixed(3)
  );

  const totalSupportStiffnessMpaPerM = Number(
    (rockBoltsStiffnessMpaPerM + shotcreteStiffnessMpaPerM + steelSetOrLatticeStiffnessMpaPerM).toFixed(1)
  );

  const isSupportConfirmedInstalled = activeSystemsSummary.length > 0;

  // 6. Closed-Form Elastoplastic Continuum Solver (Duncan Fama 1993 / Carranza-Torres 2004)
  const phiRad = (pFrictionRm.value * Math.PI) / 180;
  const kCoeff = (1 + Math.sin(phiRad)) / (1 - Math.sin(phiRad));
  const sigmaCmMC = (2 * pCohesionRm.value * Math.cos(phiRad)) / (1 - Math.sin(phiRad));
  const sigmaCmEffective = Math.max(0.2, (sigmaCmMC + pScm.value) / 2);

  // Effective field stress including pore water pressure effect
  const effectiveP0Mpa = Math.max(0.15, p0_Mpa + pPoreWater.value / 1000);
  const pCrMpa = Math.max(
    0,
    (2 * effectiveP0Mpa - sigmaCmEffective) / (1 + kCoeff)
  );

  const evaluateContinuumAtSupportPressure = (piMpa: number): FemContinuumStateResult => {
    const ermMpa = pErm.value * 1000;
    const nu = pPoisson.value;
    let rpM = equivalentRadiusM;

    // Half-Face Vertical Shaft confinement / relaxation modifiers:
    // - Median CLOSED: unexcavated rock half provides lateral buttressing across 0°N–180°S (dispFactor = 0.84, stressCornerFactor = 1.06)
    // - Median OPEN: opposite half already excavated without rock wall (dispFactor = 1.14, stressCornerFactor = 1.16)
    const shaftHalfDispMod =
      isVertShaft && isShaftHalfFace
        ? shaftMedianStatus === 'closed'
          ? 0.84
          : 1.14
        : 1.0;
    const shaftHalfStressMod =
      isVertShaft && isShaftHalfFace
        ? shaftMedianStatus === 'closed'
          ? 1.06
          : 1.16
        : 1.0;

    const effectiveP0ForYield = effectiveP0Mpa * (isVertShaft && isShaftHalfFace && shaftMedianStatus === 'open' ? 1.08 : 1.0);

    if (piMpa < pCrMpa && kCoeff > 1.01) {
      const num = 2 * (effectiveP0ForYield * (kCoeff - 1) + sigmaCmEffective);
      const den = (kCoeff + 1) * ((kCoeff - 1) * Math.max(0.005, piMpa) + sigmaCmEffective);
      const ratio = Math.pow(Math.max(1.0, num / Math.max(0.01, den)), 1 / (kCoeff - 1));
      rpM = Math.min(equivalentRadiusM * 3.8, equivalentRadiusM * ratio);
    }

    const plasticDepthM = Math.max(0, rpM - equivalentRadiusM);
    // Radial displacement at boundary (Duncan Fama 1993 elastoplastic radial convergence)
    const elasticDispM =
      ((1 + nu) / ermMpa) * (effectiveP0ForYield - piMpa) * equivalentRadiusM * shaftHalfDispMod;
    const radialDispM =
      rpM > equivalentRadiusM * 1.005
        ? ((1 + nu) / ermMpa) *
          (sigmaCmEffective / 2 + ((kCoeff - 1) / (kCoeff + 1)) * (effectiveP0ForYield - pCrMpa)) *
          equivalentRadiusM *
          Math.pow(rpM / equivalentRadiusM, 2) *
          shaftHalfDispMod
        : Math.max(0.0002, elasticDispM);

    // Anisotropy adjustment for crown (N-S in shaft) vs sidewall (E-W in shaft) using K0
    const k0 = pK0.value;
    const crownFactor = isVertShaft
      ? Math.max(0.85, Math.min(1.3, 0.92 + 0.12 * Math.abs(1 - k0)))
      : Math.max(0.75, Math.min(1.45, 0.65 + 0.35 * k0));
    const wallFactor = isVertShaft
      ? Math.max(0.85, Math.min(1.35, (1.06 + 0.14 * Math.abs(1 - k0)) * (isShaftHalfFace ? 1.05 : 1.0)))
      : Math.max(0.75, Math.min(1.45, 1.35 - 0.35 * k0));

    const crownDispMm = Number((radialDispM * 1000 * crownFactor).toFixed(2));
    const wallDispMm = Number((radialDispM * 1000 * wallFactor).toFixed(2));
    const maxDispMm = Number(Math.max(crownDispMm, wallDispMm).toFixed(2));
    const convergencePct = Number((((maxDispMm * 2) / (spanWidthM * 1000)) * 100).toFixed(3));

    // Max tangential stress at elastic-plastic interface or boundary
    const maxSigmaThetaMpa = Number(
      ((rpM > equivalentRadiusM
        ? 2 * effectiveP0ForYield - pCrMpa
        : effectiveP0ForYield * (1 + k0) + 2 * effectiveP0ForYield * Math.abs(1 - k0) - piMpa) *
        shaftHalfStressMod
      ).toFixed(2)
    );

    const maxStrainPct = Number(((maxDispMm / (equivalentRadiusM * 1000)) * 100).toFixed(3));
    const yieldedAreaRatio =
      rpM > equivalentRadiusM
        ? Math.min(85, ((Math.pow(rpM, 2) - Math.pow(equivalentRadiusM, 2)) / Math.pow(equivalentRadiusM * 2.4, 2)) * 100)
        : 0;

    // Continuum Factor of Safety (Strength-to-Stress & Strain Criterion, Hoek 2001)
    const strengthToStressFos =
      (sigmaCmEffective + kCoeff * piMpa * 2.2) / Math.max(0.15, maxSigmaThetaMpa * 0.72);
    const strainPenalty = maxStrainPct > 1.0 ? 0.82 : maxStrainPct > 0.5 ? 0.92 : 1.0;
    const fos = Number(Math.max(0.45, Math.min(4.5, strengthToStressFos * strainPenalty)).toFixed(2));

    const stabilityStatus: FemContinuumStateResult['stabilityStatus'] =
      fos >= 1.5 && maxStrainPct < 0.5
        ? 'STABLE (ELASTIC)'
        : fos >= 1.05 && maxStrainPct < 1.5
        ? 'CONTROLLED YIELDING'
        : 'HIGH DEFORMATION / INSTABILITY';

    return {
      internalSupportPressureMpa: Number(piMpa.toFixed(3)),
      plasticZoneRadiusMeters: Number(rpM.toFixed(2)),
      plasticZoneDepthMeters: Number(plasticDepthM.toFixed(2)),
      crownDisplacementMm: crownDispMm,
      sidewallDisplacementMm: wallDispMm,
      maxDisplacementMm: maxDispMm,
      tunnelConvergencePct: convergencePct,
      maxTangentialStressMpa: maxSigmaThetaMpa,
      maxShearStrainPct: maxStrainPct,
      yieldedElementsPct: Number(yieldedAreaRatio.toFixed(1)),
      continuumFactorOfSafety: fos,
      stabilityStatus,
    };
  };

  // Before Support: pi = 0
  const femBefore = evaluateContinuumAtSupportPressure(0);

  // Ground Reaction Curve (GRC) 20 points from pi = p0 down to 0
  const grcCurve: GrcPoint[] = [];
  for (let i = 0; i <= 20; i++) {
    const pVal = effectiveP0Mpa * (1 - i / 20);
    const st = evaluateContinuumAtSupportPressure(pVal);
    grcCurve.push({
      supportPressureMpa: Number(pVal.toFixed(3)),
      radialDisplacementMm: st.maxDisplacementMm,
      plasticRadiusMeters: st.plasticZoneRadiusMeters,
    });
  }

  // Equilibrium internal support pressure after support installation
  // Support installed after initial pre-relaxation u0 ≈ 30% of elastic displacement
  const effectiveSupportPressureMpa = isSupportConfirmedInstalled
    ? Math.min(
        totalMaxSupportPressureMpa,
        Math.max(
          totalMaxSupportPressureMpa * 0.58,
          Math.min(effectiveP0Mpa * 0.65, totalMaxSupportPressureMpa * 0.85)
        )
      )
    : 0;

  const femAfter = evaluateContinuumAtSupportPressure(effectiveSupportPressureMpa);

  const supportBreakdown: SupportContributionBreakdown = {
    isSupportConfirmedInstalled,
    supportStatusMessage: isSupportConfirmedInstalled
      ? `Installed Support Verified from ESWA Round (${sup.supportClass || 'Prescribed Class'}): ${activeSystemsSummary.length} active system(s)`
      : 'No Installed Support Confirmed in Current ESWA Face Record — After-Support state equals Unsupported state until support is enabled.',
    activeSystemsSummary,
    rockBoltsPressureMpa: Number(rockBoltsPressureMpa.toFixed(3)),
    rockBoltsStiffnessMpaPerM: Number(rockBoltsStiffnessMpaPerM.toFixed(1)),
    spotBoltsPressureMpa: Number(spotBoltsPressureMpa.toFixed(3)),
    shotcretePressureMpa: Number(shotcretePressureMpa.toFixed(3)),
    shotcreteStiffnessMpaPerM: Number(shotcreteStiffnessMpaPerM.toFixed(1)),
    steelSetOrLatticePressureMpa: Number(steelSetOrLatticePressureMpa.toFixed(3)),
    steelSetOrLatticeStiffnessMpaPerM: Number(steelSetOrLatticeStiffnessMpaPerM.toFixed(1)),
    wireMeshRetentionKpa: Number(wireMeshRetentionKpa.toFixed(1)),
    forepolingOrCanopyPressureMpa: Number(forepolingOrCanopyPressureMpa.toFixed(3)),
    totalMaxSupportPressureMpa,
    totalEffectiveSupportPressureMpa: Number(effectiveSupportPressureMpa.toFixed(3)),
    totalSupportStiffnessMpaPerM,
    boltLengthMeters: boltLenM,
    boltSpacingInPlaneM: boltSpInM,
    boltSpacingLongitudinalM: boltSpLongM,
    shotcreteThicknessMm: shotcreteThickMm,
  };

  // 7. Generate 2D Boundary-Fitted TRIANGULAR Finite Element Mesh around the Exact Fed ESWA Tunnel / Circular Vertical Shaft Profile
  const svgW = 560;
  const svgH = 440;
  const cx = svgW / 2;
  const cy = svgH * 0.54;
  const boxW = 184;
  const boxH = isVertShaft
    ? boxW
    : Math.round(boxW * Math.min(1.25, Math.max(0.72, totalHeightM / spanWidthM)));
  const boxX = cx - boxW / 2;
  const boxY = cy - boxH / 2;

  // Obtain exact fed tunnel outline from ESWA fieldMappingEngine (or Circular Vertical Shaft Plan Ring)
  const faceOutlineDetails = computeFaceTunnelOutlineDetails(
    isVertShaft ? { ...location, shape: 'circular', heightM: spanWidthM } : location,
    boxX,
    boxY,
    boxW,
    boxH
  );
  const rShaftSvg = boxW / 2;
  const tunnelClosedPathD = isVertShaft
    ? `M ${(cx - rShaftSvg).toFixed(1)} ${cy.toFixed(1)} A ${rShaftSvg} ${rShaftSvg} 0 1 1 ${(cx + rShaftSvg).toFixed(1)} ${cy.toFixed(1)} A ${rShaftSvg} ${rShaftSvg} 0 1 1 ${(cx - rShaftSvg).toFixed(1)} ${cy.toFixed(1)} Z`
    : faceOutlineDetails.closedFillPathD;
  const tunnelSplY = isVertShaft ? cy : faceOutlineDetails.springY;

  // Build dense closed perimeter polyline following the exact fed tunnel shape or 360° Circular Vertical Shaft:
  const rawPerimeterLoop: { x: number; y: number }[] = [];
  const pushDenseSegment = (pts: { x: number; y: number }[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(1, Math.ceil(dist / 3.5));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        rawPerimeterLoop.push({
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
        });
      }
    }
  };

  if (isVertShaft) {
    // True 360° circular shaft perimeter starting from 0° North (-π/2 in SVG) clockwise
    for (let s = 0; s < 144; s++) {
      const theta = -Math.PI / 2 + (s / 144) * 2 * Math.PI;
      rawPerimeterLoop.push({
        x: cx + rShaftSvg * Math.cos(theta),
        y: cy + rShaftSvg * Math.sin(theta),
      });
    }
  } else if (
    faceOutlineDetails.leftWallPoly.length > 0 ||
    faceOutlineDetails.crownPoly.length > 0
  ) {
    if (faceOutlineDetails.leftWallPoly.length >= 2) {
      pushDenseSegment(faceOutlineDetails.leftWallPoly);
    }
    if (faceOutlineDetails.crownPoly.length >= 2) {
      pushDenseSegment(faceOutlineDetails.crownPoly);
    }
    if (faceOutlineDetails.rightWallPoly.length >= 2) {
      pushDenseSegment(faceOutlineDetails.rightWallPoly.slice().reverse());
    }
    if (faceOutlineDetails.invertPoly.length >= 2) {
      pushDenseSegment(faceOutlineDetails.invertPoly.slice().reverse());
    } else if (rawPerimeterLoop.length > 1) {
      pushDenseSegment([
        rawPerimeterLoop[rawPerimeterLoop.length - 1],
        rawPerimeterLoop[0],
      ]);
    }
  }

  // Fallback if custom open shape had too few points
  if (rawPerimeterLoop.length < 12) {
    for (let s = 0; s < 72; s++) {
      const theta = -Math.PI + (s / 72) * 2 * Math.PI;
      rawPerimeterLoop.push({
        x: cx + (boxW / 2) * Math.cos(theta),
        y: cy + (boxH / 2) * Math.sin(theta),
      });
    }
  }

  // Compute cumulative arc length around the closed tunnel perimeter
  const cumArc: number[] = [0];
  for (let i = 1; i < rawPerimeterLoop.length; i++) {
    const d = Math.hypot(
      rawPerimeterLoop[i].x - rawPerimeterLoop[i - 1].x,
      rawPerimeterLoop[i].y - rawPerimeterLoop[i - 1].y
    );
    cumArc.push(cumArc[i - 1] + d);
  }
  const closingSeg = Math.hypot(
    rawPerimeterLoop[0].x - rawPerimeterLoop[rawPerimeterLoop.length - 1].x,
    rawPerimeterLoop[0].y - rawPerimeterLoop[rawPerimeterLoop.length - 1].y
  );
  const totalPerimArc = Math.max(1, cumArc[cumArc.length - 1] + closingSeg);

  const samplePerimeterAtFraction = (uFrac: number): { x: number; y: number; angleRad: number } => {
    const normU = ((uFrac % 1) + 1) % 1;
    const targetArc = normU * totalPerimArc;
    for (let i = 0; i < cumArc.length - 1; i++) {
      if (targetArc >= cumArc[i] && targetArc <= cumArc[i + 1]) {
        const segLen = Math.max(1e-5, cumArc[i + 1] - cumArc[i]);
        const t = (targetArc - cumArc[i]) / segLen;
        const px =
          rawPerimeterLoop[i].x +
          (rawPerimeterLoop[i + 1].x - rawPerimeterLoop[i].x) * t;
        const py =
          rawPerimeterLoop[i].y +
          (rawPerimeterLoop[i + 1].y - rawPerimeterLoop[i].y) * t;
        return { x: px, y: py, angleRad: Math.atan2(py - cy, px - cx) };
      }
    }
    const lastPt = rawPerimeterLoop[rawPerimeterLoop.length - 1];
    const firstPt = rawPerimeterLoop[0];
    const remArc = Math.max(1e-5, totalPerimArc - cumArc[cumArc.length - 1]);
    const t = Math.max(0, Math.min(1, (targetArc - cumArc[cumArc.length - 1]) / remArc));
    const px = lastPt.x + (firstPt.x - lastPt.x) * t;
    const py = lastPt.y + (firstPt.y - lastPt.y) * t;
    return { x: px, y: py, angleRad: Math.atan2(py - cy, px - cx) };
  };

  // Sample 36 boundary vertices evenly along the exact fed tunnel outline
  const nSectors = 36;
  const nRings = 6; // 6 concentric staggered rings -> 2 * 36 * 6 = 432 Triangular Finite Elements
  const ringRadiiNorm = [1.0, 1.13, 1.29, 1.48, 1.72, 2.02, 2.38];

  const boundarySamplePts: { x: number; y: number; angleRad: number }[] = [];
  for (let s = 0; s < nSectors; s++) {
    boundarySamplePts.push(samplePerimeterAtFraction(s / nSectors));
  }

  const tunnelOutlineSvgPoints: { x: number; y: number }[] = rawPerimeterLoop
    .filter((_, idx) => idx % 2 === 0)
    .map((pt) => ({
      x: Number(pt.x.toFixed(1)),
      y: Number(pt.y.toFixed(1)),
    }));

  // Helper to expand any perimeter fraction uFrac outward to normalized radius rNorm
  // At rNorm = 1.0, point lies 100% on the exact fed tunnel boundary.
  // As rNorm increases into the rock mass, blends smoothly with radial expansion so corners never self-intersect.
  const projectRingPoint = (uFrac: number, rNorm: number) => {
    const bPt = samplePerimeterAtFraction(uFrac);
    const dx0 = bPt.x - cx;
    const dy0 = bPt.y - cy;
    const dist0 = Math.max(1, Math.hypot(dx0, dy0));
    const ux = dx0 / dist0;
    const uy = dy0 / dist0;
    const radialStepPx = (rNorm - 1.0) * ((boxW + boxH) * 0.27);
    // Slight smoothing of sharp invert corners in outer rings
    const smoothBlend = Math.min(0.45, Math.max(0, (rNorm - 1.0) * 0.28));
    const targetX =
      cx +
      dx0 * (1 - smoothBlend) * rNorm +
      (dx0 + ux * radialStepPx) * smoothBlend;
    const targetY =
      cy +
      dy0 * (1 - smoothBlend) * rNorm +
      (dy0 + uy * radialStepPx) * smoothBlend;
    return {
      xSvg: Number(targetX.toFixed(1)),
      ySvg: Number(targetY.toFixed(1)),
      angleRad: bPt.angleRad,
    };
  };

  const meshNodes: FemMeshNode2D[] = [];
  const nodeGrid: FemMeshNode2D[][] = [];

  for (let rIdx = 0; rIdx <= nRings; rIdx++) {
    const rNorm = ringRadiiNorm[rIdx];
    const rowNodes: FemMeshNode2D[] = [];
    // Stagger odd rings by +0.5 sector for genuine equilateral/Delaunay 3-node triangulation
    const staggerShift = rIdx === 0 ? 0 : (rIdx % 2) * 0.5;
    for (let sIdx = 0; sIdx < nSectors; sIdx++) {
      const uFrac = (sIdx + staggerShift) / nSectors;
      const proj =
        rIdx === 0
          ? {
              xSvg: Number(boundarySamplePts[sIdx].x.toFixed(1)),
              ySvg: Number(boundarySamplePts[sIdx].y.toFixed(1)),
              angleRad: boundarySamplePts[sIdx].angleRad,
            }
          : projectRingPoint(uFrac, rNorm);
      const xMeters = Number((((proj.xSvg - cx) / (boxW / 2)) * (spanWidthM / 2)).toFixed(2));
      const yMeters = Number((((cy - proj.ySvg) / (boxH / 2)) * (totalHeightM / 2)).toFixed(2));
      const node: FemMeshNode2D = {
        id: `nd-${rIdx}-${sIdx}`,
        xSvg: proj.xSvg,
        ySvg: proj.ySvg,
        xMeters,
        yMeters,
        radiusNorm: rNorm,
        angleRad: proj.angleRad,
        ringIndex: rIdx,
        sectorIndex: sIdx,
      };
      meshNodes.push(node);
      rowNodes.push(node);
    }
    nodeGrid.push(rowNodes);
  }

  // Assign lithology zones from cumulative area-weighted logged shares and compute 3-node CST Triangular Finite Elements
  const cumulativeLithoShares: {
    cumMax: number;
    lithologyName: string;
    colorHex: string;
  }[] = [];
  let runningPct = 0;
  for (const sh of lithoInfo.shares) {
    runningPct += sh.weightPct;
    cumulativeLithoShares.push({
      cumMax: runningPct / 100,
      lithologyName: sh.rockName,
      colorHex: sh.colorHex,
    });
  }
  const meshElements: FemMeshElement2D[] = [];

  const rpBeforeNorm = femBefore.plasticZoneRadiusMeters / Math.max(0.5, equivalentRadiusM);
  const rpAfterNorm = femAfter.plasticZoneRadiusMeters / Math.max(0.5, equivalentRadiusM);

  // Boundary-fitted Plastic Yield Zone contours (following the exact fed tunnel shape!)
  const plasticZonePolygonBeforeSvg = Array.from({ length: 48 }, (_, i) => {
    const p = projectRingPoint(i / 48, Math.max(1.02, rpBeforeNorm));
    return { x: p.xSvg, y: p.ySvg };
  });
  const plasticZonePolygonAfterSvg = Array.from({ length: 48 }, (_, i) => {
    const p = projectRingPoint(i / 48, Math.max(1.01, rpAfterNorm));
    return { x: p.xSvg, y: p.ySvg };
  });

  // Compute boundary-fitted Rock Bolt vectors along the fed tunnel or 360° radial around Circular Vertical Shaft
  const boltScalePx = boxW / Math.max(1, spanWidthM);
  const boltLenPx = Math.min(92, Math.max(24, boltLenM * boltScalePx));
  const supportBoltVectorsSvg: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    zone: 'crown' | 'wall';
  }[] = [];

  if (isVertShaft) {
    const stepS = Math.max(2, Math.round(nSectors / Math.max(8, Math.min(20, Math.round((Math.PI * spanWidthM) / boltSpInM)))));
    for (let sIdx = 0; sIdx < nSectors; sIdx += stepS) {
      const bPt = boundarySamplePts[sIdx];
      const dx = bPt.x - cx;
      const dy = bPt.y - cy;
      // In Half-Face Shaft mode with active scope only, skip unexcavated half
      if (isShaftHalfFace && sup.rockBoltScope === 'crown_only') {
        if (shaftHalfSide === 'right_half' && dx < -2) continue;
        if (shaftHalfSide === 'left_half' && dx > 2) continue;
      }
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / d;
      const ny = dy / d;
      supportBoltVectorsSvg.push({
        x1: Number(bPt.x.toFixed(1)),
        y1: Number(bPt.y.toFixed(1)),
        x2: Number((bPt.x + nx * boltLenPx).toFixed(1)),
        y2: Number((bPt.y + ny * boltLenPx).toFixed(1)),
        zone: dy <= 0 ? 'crown' : 'wall',
      });
    }
  } else {
    for (let sIdx = 0; sIdx < nSectors; sIdx += 3) {
      const bPt = boundarySamplePts[sIdx];
      // Skip flat bottom invert bolts unless circular
      if (location?.shape !== 'circular' && bPt.y > cy + boxH * 0.42) {
        continue;
      }
      const isCrownBolt = bPt.y <= tunnelSplY + 4;
      if (sup.rockBoltScope === 'crown_only' && !isCrownBolt) {
        continue;
      }
      const dx = bPt.x - cx;
      const dy = bPt.y - cy;
      // Outward normal into rock mass: horizontal on vertical walls, radial on crown arch
      let nx = 0;
      let ny = -1;
      if (isCrownBolt) {
        const d = Math.max(1, Math.hypot(dx, dy));
        nx = dx / d;
        ny = dy / d;
      } else {
        nx = dx < 0 ? -1 : 1;
        ny = 0;
      }
      supportBoltVectorsSvg.push({
        x1: Number(bPt.x.toFixed(1)),
        y1: Number(bPt.y.toFixed(1)),
        x2: Number((bPt.x + nx * boltLenPx).toFixed(1)),
        y2: Number((bPt.y + ny * boltLenPx).toFixed(1)),
        zone: isCrownBolt ? 'crown' : 'wall',
      });
    }
  }

  const buildTriangularElement = (
    id: string,
    na: FemMeshNode2D,
    nb: FemMeshNode2D,
    nc: FemMeshNode2D
  ): FemMeshElement2D => {
    const pointsSvg = [
      { x: na.xSvg, y: na.ySvg },
      { x: nb.xSvg, y: nb.ySvg },
      { x: nc.xSvg, y: nc.ySvg },
    ];
    const centroidSvg = {
      x: Number(((na.xSvg + nb.xSvg + nc.xSvg) / 3).toFixed(1)),
      y: Number(((na.ySvg + nb.ySvg + nc.ySvg) / 3).toFixed(1)),
    };
    const elemRNorm = (na.radiusNorm + nb.radiusNorm + nc.radiusNorm) / 3;
    const angleRad = Math.atan2(centroidSvg.y - cy, centroidSvg.x - cx);
    const angleDeg = Math.round(((angleRad * 180) / Math.PI + 360) % 360);

    const verticalBandFrac = Math.max(0, Math.min(0.999, (centroidSvg.y - 60) / 320));
    const matchedShare =
      cumulativeLithoShares.find((sh) => verticalBandFrac <= sh.cumMax) ||
      cumulativeLithoShares[cumulativeLithoShares.length - 1];
    const elemLitho = matchedShare ? matchedShare.lithologyName : lithoInfo.dominant;
    const elemLithoRef = matchLithologyReference(elemLitho);

    const inActiveShaftHalf =
      !isVertShaft ||
      !isShaftHalfFace ||
      (shaftHalfSide === 'right_half' ? centroidSvg.x >= cx - 2 : centroidSvg.x <= cx + 2);
    const shaftHalfLocalFactor =
      isVertShaft && isShaftHalfFace
        ? inActiveShaftHalf
          ? shaftMedianStatus === 'open'
            ? 1.12
            : 1.02
          : shaftMedianStatus === 'closed'
          ? 0.58
          : 0.95
        : 1.0;

    const directionalFactor =
      (1 + 0.25 * (1 - pK0.value) * Math.cos(2 * angleRad)) * shaftHalfLocalFactor;

    const isYieldedBefore =
      elemRNorm <= rpBeforeNorm * (0.96 + 0.08 * directionalFactor);
    const isYieldedAfter =
      elemRNorm <= rpAfterNorm * (0.96 + 0.08 * directionalFactor);

    const sigmaRadialBeforeMpa = Number(
      (effectiveP0Mpa * (1 - 1 / Math.pow(elemRNorm, 2))).toFixed(2)
    );
    const sigmaRadialAfterMpa = Number(
      (
        effectiveP0Mpa * (1 - 1 / Math.pow(elemRNorm, 2)) +
        effectiveSupportPressureMpa / Math.pow(elemRNorm, 2)
      ).toFixed(2)
    );

    const sigmaThetaBeforeMpa = Number(
      (
        (isYieldedBefore
          ? sigmaCmEffective + kCoeff * sigmaRadialBeforeMpa
          : effectiveP0Mpa * (1 + 1 / Math.pow(elemRNorm, 2))) * directionalFactor
      ).toFixed(2)
    );
    const sigmaThetaAfterMpa = Number(
      (
        (isYieldedAfter
          ? sigmaCmEffective + kCoeff * sigmaRadialAfterMpa
          : effectiveP0Mpa * (1 + 1 / Math.pow(elemRNorm, 2)) -
            effectiveSupportPressureMpa / Math.pow(elemRNorm, 2)) * directionalFactor
      ).toFixed(2)
    );

    const dispBeforeMm = Number(
      ((femBefore.maxDisplacementMm / Math.pow(elemRNorm, 1.15)) * directionalFactor).toFixed(2)
    );
    const dispAfterMm = Number(
      ((femAfter.maxDisplacementMm / Math.pow(elemRNorm, 1.25)) * directionalFactor).toFixed(2)
    );

    const strainBeforePct = Number(
      ((femBefore.maxShearStrainPct / Math.pow(elemRNorm, 1.3)) * directionalFactor).toFixed(3)
    );
    const strainAfterPct = Number(
      ((femAfter.maxShearStrainPct / Math.pow(elemRNorm, 1.4)) * directionalFactor).toFixed(3)
    );

    const localFosBefore = Number(
      Math.max(
        0.55,
        Math.min(
          4.0,
          (sigmaCmEffective + kCoeff * sigmaRadialBeforeMpa) /
            Math.max(0.2, sigmaThetaBeforeMpa * 0.78)
        )
      ).toFixed(2)
    );
    const localFosAfter = Number(
      Math.max(
        0.65,
        Math.min(
          4.5,
          (sigmaCmEffective +
            kCoeff * (sigmaRadialAfterMpa + effectiveSupportPressureMpa * 0.8)) /
            Math.max(0.2, sigmaThetaAfterMpa * 0.74)
        )
      ).toFixed(2)
    );

    return {
      id,
      nodeIds: [na.id, nb.id, nc.id],
      pointsSvg,
      centroidSvg,
      radiusNorm: Number(elemRNorm.toFixed(2)),
      sectorAngleDeg: angleDeg,
      lithologyName: elemLitho,
      lithologyColor: matchedShare?.colorHex || elemLithoRef.colorHex,
      sigmaThetaBeforeMpa,
      sigmaRadialBeforeMpa,
      displacementBeforeMm: dispBeforeMm,
      strainBeforePct,
      isYieldedBefore,
      localFosBefore,
      sigmaThetaAfterMpa,
      sigmaRadialAfterMpa,
      displacementAfterMm: dispAfterMm,
      strainAfterPct,
      isYieldedAfter,
      localFosAfter,
    };
  };

  for (let rIdx = 0; rIdx < nRings; rIdx++) {
    for (let sIdx = 0; sIdx < nSectors; sIdx++) {
      const nextS = (sIdx + 1) % nSectors;
      const n00 = nodeGrid[rIdx][sIdx];
      const n01 = nodeGrid[rIdx][nextS];
      const n10 = nodeGrid[rIdx + 1][sIdx];
      const n11 = nodeGrid[rIdx + 1][nextS];

      if (rIdx % 2 === 0) {
        meshElements.push(
          buildTriangularElement(`tri-${rIdx}-${sIdx}-a`, n00, n10, n01)
        );
        meshElements.push(
          buildTriangularElement(`tri-${rIdx}-${sIdx}-b`, n01, n10, n11)
        );
      } else {
        meshElements.push(
          buildTriangularElement(`tri-${rIdx}-${sIdx}-a`, n00, n10, n11)
        );
        meshElements.push(
          buildTriangularElement(`tri-${rIdx}-${sIdx}-b`, n00, n11, n01)
        );
      }
    }
  }

  // 8. DEM Discontinuum Joint Network & Key-Block Limit-Equilibrium Solver
  const setColors: Record<string, string> = {
    J1: '#ef4444',
    J2: '#38bdf8',
    J3: '#10b981',
    J4: '#f59e0b',
    'J-Random': '#c084fc',
  };

  const demJointPlanes: DemJointPlane2D[] = [];

  // Map actual traced joints from ESWA round + 3D dip surfaces + structural faults/shears
  const tracedJoints = round.jointTraces || [];
  tracedJoints.slice(0, 18).forEach((jt, idx) => {
    if (!jt.points || jt.points.length < 2) return;
    const pStart = jt.points[0];
    const pEnd = jt.points[jt.points.length - 1];
    const setRec = round.discontinuitySets?.[jt.setId];
    const dipDeg = jt.dipAmount || (setRec ? (setRec.dipAmountFrom + setRec.dipAmountTo) / 2 : 65);
    const dipDirDeg = jt.dipDirection || (setRec ? (setRec.dipDirectionFrom + setRec.dipDirectionTo) / 2 : 135);

    const angleRad = ((dipDeg * (idx % 2 === 0 ? 1 : -1)) * Math.PI) / 180;
    const anchorAngle = -Math.PI * 0.85 + (idx / Math.max(1, tracedJoints.length)) * Math.PI * 1.7;
    const midR = (boxW / 2) * (1.12 + (idx % 3) * 0.22);
    const mx = cx + midR * Math.cos(anchorAngle);
    const my = cy + midR * Math.sin(anchorAngle);
    const halfLenPx = 42 + Math.min(35, (jt.points.length || 3) * 4);

    const x1Svg = Number((mx - halfLenPx * Math.cos(angleRad)).toFixed(1));
    const y1Svg = Number((my - halfLenPx * Math.sin(angleRad)).toFixed(1));
    const x2Svg = Number((mx + halfLenPx * Math.cos(angleRad)).toFixed(1));
    const y2Svg = Number((my + halfLenPx * Math.sin(angleRad)).toFixed(1));

    const lengthM = Number(
      (
        jt.traceLengthM && jt.traceLengthM > 0.2
          ? jt.traceLengthM
          : Math.max(1.2, Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) / 38)
      ).toFixed(2)
    );

    const sigmaNormalMpa = Math.max(0.12, effectiveP0Mpa * (0.45 + 0.35 * Math.pow(Math.cos(angleRad), 2)) - pPoreWater.value / 1000);
    const tauDrivingMpa = Math.max(0.05, effectiveP0Mpa * 0.38 * Math.abs(Math.sin(2 * angleRad)));

    const jrcLogTerm = pJointJrc.value * Math.log10(Math.max(1.05, pJointJcs.value / sigmaNormalMpa));
    const peakFrictionBeforeRad =
      ((Math.min(70, pJointFriction.value + jrcLogTerm)) * Math.PI) / 180;
    const shearStrengthBeforeMpa =
      sigmaNormalMpa * Math.tan(peakFrictionBeforeRad) + pJointCohesion.value / 1000;

    const addedNormalClampingMpa = effectiveSupportPressureMpa * 1.65;
    const sigmaNormalAfterMpa = sigmaNormalMpa + addedNormalClampingMpa;
    const shearStrengthAfterMpa =
      sigmaNormalAfterMpa * Math.tan(peakFrictionBeforeRad) +
      pJointCohesion.value / 1000 +
      (sup.rockBoltsEnabled || sup.soilNailsEnabled ? 0.14 : 0);

    const jointFosBefore = Number(
      Math.max(0.45, Math.min(4.0, shearStrengthBeforeMpa / Math.max(0.05, tauDrivingMpa))).toFixed(2)
    );
    const jointFosAfter = Number(
      Math.max(jointFosBefore, Math.min(4.5, shearStrengthAfterMpa / Math.max(0.05, tauDrivingMpa * 0.78))).toFixed(2)
    );

    const apertureChangeBeforeMm = Number(
      ((femBefore.maxDisplacementMm * 0.18) / Math.max(1, pJointKn.value / 8)).toFixed(2)
    );
    const apertureChangeAfterMm = Number(
      ((femAfter.maxDisplacementMm * 0.11) / Math.max(1, pJointKn.value / 8)).toFixed(2)
    );

    const shearSlipBeforeMm = Number(
      ((tauDrivingMpa / Math.max(0.5, pJointKs.value)) * (jointFosBefore < 1.0 ? 2.4 : 1.0)).toFixed(2)
    );
    const shearSlipAfterMm = Number(
      ((tauDrivingMpa * 0.65) / Math.max(0.5, pJointKs.value)).toFixed(2)
    );

    demJointPlanes.push({
      id: jt.id || `dem-j-${idx}`,
      setId: (jt.setId === 'unassigned' ? 'J-Random' : jt.setId) as FieldJointSetId,
      label: `${jt.setId} (${Math.round(dipDirDeg)}°/${Math.round(dipDeg)}°)`,
      panel: jt.panel,
      x1Svg,
      y1Svg,
      x2Svg,
      y2Svg,
      dipDirectionDeg: Math.round(dipDirDeg),
      dipAmountDeg: Math.round(dipDeg),
      lengthMeters: lengthM,
      apertureMm: avgApertureMm,
      jrc: pJointJrc.value,
      jcsMpa: pJointJcs.value,
      frictionDeg: pJointFriction.value,
      cohesionKpa: pJointCohesion.value,
      knGpaM: pJointKn.value,
      ksGpaM: pJointKs.value,
      normalStressMpa: Number(sigmaNormalMpa.toFixed(2)),
      shearStressMpa: Number(tauDrivingMpa.toFixed(2)),
      shearStrengthBeforeMpa: Number(shearStrengthBeforeMpa.toFixed(2)),
      shearStrengthAfterMpa: Number(shearStrengthAfterMpa.toFixed(2)),
      apertureChangeBeforeMm,
      apertureChangeAfterMm,
      shearSlipBeforeMm,
      shearSlipAfterMm,
      jointFosBefore,
      jointFosAfter,
      color: setColors[jt.setId] || '#38bdf8',
    });
  });

  // Also include mapped 3D Dip Surfaces and Fault / Shear Structural Features in DEM Joint Network
  (round.dipPlaneSurfaces || []).slice(0, 6).forEach((ds, idx) => {
    const dipDeg = ds.dipAmount || 62;
    const dipDirDeg = ds.dipDirection || 140;
    const angleRad = ((dipDeg * (idx % 2 === 0 ? 1 : -1)) * Math.PI) / 180;
    const anchorAngle = -Math.PI * 0.72 + (idx / 6) * Math.PI * 1.44;
    const midR = (boxW / 2) * (1.16 + (idx % 2) * 0.24);
    const mx = cx + midR * Math.cos(anchorAngle);
    const my = cy + midR * Math.sin(anchorAngle);
    const halfLenPx = 46;
    const setId: FieldJointSetId =
      ds.setId === 'unassigned' ? 'J-Random' : (ds.setId as FieldJointSetId);
    demJointPlanes.push({
      id: ds.id || `dem-ds-${idx}`,
      setId,
      label: `${setId} 3D Plane (${Math.round(dipDirDeg)}°/${Math.round(dipDeg)}°)`,
      panel: ds.panel,
      x1Svg: Number((mx - halfLenPx * Math.cos(angleRad)).toFixed(1)),
      y1Svg: Number((my - halfLenPx * Math.sin(angleRad)).toFixed(1)),
      x2Svg: Number((mx + halfLenPx * Math.cos(angleRad)).toFixed(1)),
      y2Svg: Number((my + halfLenPx * Math.sin(angleRad)).toFixed(1)),
      dipDirectionDeg: Math.round(dipDirDeg),
      dipAmountDeg: Math.round(dipDeg),
      lengthMeters: avgPersistenceM,
      apertureMm: avgApertureMm,
      jrc: pJointJrc.value,
      jcsMpa: pJointJcs.value,
      frictionDeg: pJointFriction.value,
      cohesionKpa: pJointCohesion.value,
      knGpaM: pJointKn.value,
      ksGpaM: pJointKs.value,
      normalStressMpa: Number((effectiveP0Mpa * 0.52).toFixed(2)),
      shearStressMpa: Number((effectiveP0Mpa * 0.34).toFixed(2)),
      shearStrengthBeforeMpa: Number((effectiveP0Mpa * 0.44).toFixed(2)),
      shearStrengthAfterMpa: Number((effectiveP0Mpa * 0.62 + effectiveSupportPressureMpa).toFixed(2)),
      apertureChangeBeforeMm: Number((femBefore.maxDisplacementMm * 0.16).toFixed(2)),
      apertureChangeAfterMm: Number((femAfter.maxDisplacementMm * 0.09).toFixed(2)),
      shearSlipBeforeMm: Number((femBefore.maxDisplacementMm * 0.21).toFixed(2)),
      shearSlipAfterMm: Number((femAfter.maxDisplacementMm * 0.11).toFixed(2)),
      jointFosBefore: 1.18,
      jointFosAfter: isSupportConfirmedInstalled ? 1.76 : 1.18,
      color: setColors[setId] || '#38bdf8',
    });
  });

  (round.structuralFeatures || [])
    .filter(
      (sf) =>
        sf.featureType === 'fault' ||
        sf.featureType === 'thrust_fault' ||
        sf.featureType === 'shear_zone'
    )
    .slice(0, 4)
    .forEach((sf, idx) => {
      const dipDeg = sf.dipAmount || 68;
      const dipDirDeg = sf.dipDirection || 165;
      const angleRad = ((dipDeg * (idx % 2 === 0 ? 1 : -1)) * Math.PI) / 180;
      const anchorAngle = -Math.PI * 0.55 + idx * 0.55;
      const midR = (boxW / 2) * 1.22;
      const mx = cx + midR * Math.cos(anchorAngle);
      const my = cy + midR * Math.sin(anchorAngle);
      const halfLenPx = 56;
      demJointPlanes.push({
        id: sf.id || `dem-sf-${idx}`,
        setId: 'J-Random',
        label: `${sf.featureType.replace('_', ' ').toUpperCase()} (${Math.round(dipDirDeg)}°/${Math.round(dipDeg)}°)`,
        panel: sf.panel,
        x1Svg: Number((mx - halfLenPx * Math.cos(angleRad)).toFixed(1)),
        y1Svg: Number((my - halfLenPx * Math.sin(angleRad)).toFixed(1)),
        x2Svg: Number((mx + halfLenPx * Math.cos(angleRad)).toFixed(1)),
        y2Svg: Number((my + halfLenPx * Math.sin(angleRad)).toFixed(1)),
        dipDirectionDeg: Math.round(dipDirDeg),
        dipAmountDeg: Math.round(dipDeg),
        lengthMeters: Math.max(4.5, avgPersistenceM * 1.4),
        apertureMm: Math.max(2.5, avgApertureMm * 2),
        jrc: Math.max(2, Number((pJointJrc.value * 0.65).toFixed(1))),
        jcsMpa: Math.max(5, Number((pJointJcs.value * 0.6).toFixed(1))),
        frictionDeg: Math.max(16, Number((pJointFriction.value - 5).toFixed(1))),
        cohesionKpa: Math.max(8, Number((pJointCohesion.value * 0.55).toFixed(0))),
        knGpaM: pJointKn.value,
        ksGpaM: pJointKs.value,
        normalStressMpa: Number((effectiveP0Mpa * 0.48).toFixed(2)),
        shearStressMpa: Number((effectiveP0Mpa * 0.39).toFixed(2)),
        shearStrengthBeforeMpa: Number((effectiveP0Mpa * 0.36).toFixed(2)),
        shearStrengthAfterMpa: Number((effectiveP0Mpa * 0.56 + effectiveSupportPressureMpa).toFixed(2)),
        apertureChangeBeforeMm: Number((femBefore.maxDisplacementMm * 0.24).toFixed(2)),
        apertureChangeAfterMm: Number((femAfter.maxDisplacementMm * 0.13).toFixed(2)),
        shearSlipBeforeMm: Number((femBefore.maxDisplacementMm * 0.32).toFixed(2)),
        shearSlipAfterMm: Number((femAfter.maxDisplacementMm * 0.15).toFixed(2)),
        jointFosBefore: 0.94,
        jointFosAfter: isSupportConfirmedInstalled ? 1.54 : 0.94,
        color: '#e11d48',
      });
    });

  // Ensure conjugate set planes are represented around the perimeter if fewer than 6 traces were drawn
  if (demJointPlanes.length < 6) {
    effectiveSetIds.forEach((setId, sIdx) => {
      const setRec = round.discontinuitySets?.[setId];
      const dipDeg = setRec ? (setRec.dipAmountFrom + setRec.dipAmountTo) / 2 : sIdx === 0 ? 64 : 58;
      const dipDirDeg = setRec ? (setRec.dipDirectionFrom + setRec.dipDirectionTo) / 2 : sIdx === 0 ? 130 : 245;
      for (let k = 0; k < 4; k++) {
        const sectorAng = -Math.PI * 0.8 + ((sIdx * 4 + k) / 8) * Math.PI * 1.6;
        const rad = (boxW / 2) * (1.18 + (k % 2) * 0.28);
        const mx = cx + rad * Math.cos(sectorAng);
        const my = cy + rad * Math.sin(sectorAng);
        const planeAng = ((sIdx % 2 === 0 ? dipDeg : -dipDeg) * Math.PI) / 180;
        const halfLen = 48;
        demJointPlanes.push({
          id: `synth-${setId}-${k}`,
          setId,
          label: `${setId} (${Math.round(dipDirDeg)}°/${Math.round(dipDeg)}°)`,
          panel: k < 2 ? 'crown' : 'left_wall',
          x1Svg: Number((mx - halfLen * Math.cos(planeAng)).toFixed(1)),
          y1Svg: Number((my - halfLen * Math.sin(planeAng)).toFixed(1)),
          x2Svg: Number((mx + halfLen * Math.cos(planeAng)).toFixed(1)),
          y2Svg: Number((my + halfLen * Math.sin(planeAng)).toFixed(1)),
          dipDirectionDeg: Math.round(dipDirDeg),
          dipAmountDeg: Math.round(dipDeg),
          lengthMeters: avgPersistenceM,
          apertureMm: avgApertureMm,
          jrc: pJointJrc.value,
          jcsMpa: pJointJcs.value,
          frictionDeg: pJointFriction.value,
          cohesionKpa: pJointCohesion.value,
          knGpaM: pJointKn.value,
          ksGpaM: pJointKs.value,
          normalStressMpa: Number((effectiveP0Mpa * 0.55).toFixed(2)),
          shearStressMpa: Number((effectiveP0Mpa * 0.32).toFixed(2)),
          shearStrengthBeforeMpa: Number((effectiveP0Mpa * 0.42).toFixed(2)),
          shearStrengthAfterMpa: Number((effectiveP0Mpa * 0.58 + effectiveSupportPressureMpa).toFixed(2)),
          apertureChangeBeforeMm: Number((femBefore.maxDisplacementMm * 0.15).toFixed(2)),
          apertureChangeAfterMm: Number((femAfter.maxDisplacementMm * 0.08).toFixed(2)),
          shearSlipBeforeMm: Number((femBefore.maxDisplacementMm * 0.22).toFixed(2)),
          shearSlipAfterMm: Number((femAfter.maxDisplacementMm * 0.11).toFixed(2)),
          jointFosBefore: 1.24,
          jointFosAfter: isSupportConfirmedInstalled ? 1.82 : 1.24,
          color: setColors[setId] || '#f59e0b',
        });
      }
    });
  }

  // 9. Goodman & Shi (1985) Key-Block & Kinematic Wedge Evaluation around Excavation Boundary
  const set1 = effectiveSetIds[0] || 'J1';
  const set2 = effectiveSetIds[1] || 'J2';
  const set3 = effectiveSetIds[2] || set1;

  const set1Dip = round.discontinuitySets?.[set1]
    ? (round.discontinuitySets[set1].dipAmountFrom + round.discontinuitySets[set1].dipAmountTo) / 2
    : 65;
  const set2Dip = round.discontinuitySets?.[set2]
    ? (round.discontinuitySets[set2].dipAmountFrom + round.discontinuitySets[set2].dipAmountTo) / 2
    : 58;

  const crownApexDepthM = Number(
    Math.max(1.1, Math.min(spanWidthM * 0.42, (spanWidthM * 0.28) * Math.tan(((90 - (set1Dip + set2Dip) / 2) * Math.PI) / 180 + 0.35))).toFixed(2)
  );
  const leftWedgeDepthM = Number(
    Math.max(0.9, Math.min(totalHeightM * 0.36, totalHeightM * 0.24)).toFixed(2)
  );
  const rightWedgeDepthM = Number(
    Math.max(0.85, Math.min(totalHeightM * 0.34, totalHeightM * 0.22)).toFixed(2)
  );

  const scalePxPerM = boxW / spanWidthM;

  const buildKeyBlock = (
    id: string,
    label: string,
    zone: DemKeyBlock2D['locationZone'],
    sets: string[],
    polySvg: { x: number; y: number }[],
    moveVec: { dx: number; dy: number },
    apexDepthM: number,
    perimWidthM: number,
    failureMode: DemKeyBlock2D['failureMode'],
    slidingAngleDeg: number
  ): DemKeyBlock2D => {
    const areaM2 = Number((0.5 * perimWidthM * apexDepthM).toFixed(2));
    const weightKnPerM = Number((areaM2 * pUnitWeight.value).toFixed(1));
    const slideRad = (slidingAngleDeg * Math.PI) / 180;
    const jointPhiRad = (pJointFriction.value * Math.PI) / 180;
    const waterUpliftKn = (pPoreWater.value * perimWidthM * 0.45);

    const drivingForceKn = Number(
      (
        failureMode === 'Gravity Fall (Crown)'
          ? weightKnPerM + waterUpliftKn * 0.5
          : Math.max(15, weightKnPerM * Math.sin(slideRad) + waterUpliftKn * 0.35)
      ).toFixed(1)
    );

    // Before Support Resisting Force (Joint cohesion along two planes + lateral clamping friction)
    const jointPlaneLengthM = 2 * Math.hypot(perimWidthM / 2, apexDepthM);
    const lateralClampingKn =
      failureMode === 'Gravity Fall (Crown)'
        ? Math.max(12, sigmaH_Mpa * 1000 * apexDepthM * 0.08 * Math.tan(jointPhiRad))
        : Math.max(18, (weightKnPerM * Math.cos(slideRad) - waterUpliftKn) * Math.tan(jointPhiRad));

    const cohesionResistKn = pJointCohesion.value * jointPlaneLengthM * 0.85;
    // Relaxation penalty if continuum plastic zone envelops block before support
    const yieldRelaxationFactorBefore =
      femBefore.plasticZoneDepthMeters > apexDepthM * 0.85 ? 0.76 : 1.0;

    const resistingForceBeforeKn = Number(
      ((lateralClampingKn + cohesionResistKn) * yieldRelaxationFactorBefore).toFixed(1)
    );

    // Support Force Added from ESWA Installed Support
    const boltsIntersecting =
      sup.rockBoltsEnabled || sup.soilNailsEnabled
        ? Math.max(1, Math.round(perimWidthM / boltSpInM))
        : 0;
    const effectiveAnchorageFactor =
      boltLenM > apexDepthM + 0.5
        ? 1.0
        : boltLenM > apexDepthM
        ? 0.65
        : 0.25;

    let spotBoltBlockResistKn = 0;
    if (sup.spotBoltsEnabled && spotBoltsCount > 0) {
      for (const sb of spotBoltsList) {
        const pinsThisBlock = isVertShaft
          ? (id === 'KB-NE' && (sb.panel === 'left_wall' || (sb.azimuthDeg !== undefined && sb.azimuthDeg >= 0 && sb.azimuthDeg < 90))) ||
            (id === 'KB-ES' && (sb.panel === 'crown' || (sb.azimuthDeg !== undefined && sb.azimuthDeg >= 90 && sb.azimuthDeg < 180))) ||
            (id === 'KB-SW' && (sb.panel === 'right_wall' || (sb.azimuthDeg !== undefined && sb.azimuthDeg >= 180 && sb.azimuthDeg < 270))) ||
            (id === 'KB-WN' && (sb.panel === 'shaft_sn' || (sb.azimuthDeg !== undefined && sb.azimuthDeg >= 270 && sb.azimuthDeg <= 360))) ||
            (id === 'KB-MEDIAN' && String(sb.panel) === 'center_median')
          : (zone === 'Crown Arch' && (sb.panel === 'crown' || (sb.yMeters ?? 0) > totalHeightM * 0.75)) ||
            (zone === 'Left Sidewall' && (sb.panel === 'left_wall' || (sb.xMeters ?? 0) < -spanWidthM * 0.25)) ||
            (zone === 'Right Sidewall' && (sb.panel === 'right_wall' || (sb.xMeters ?? 0) > spanWidthM * 0.25)) ||
            (zone === 'Shoulder Wedge' && (sb.panel === 'crown' || sb.panel === 'left_wall' || sb.panel === 'right_wall')) ||
            (zone === 'Slope Batter');

        if (pinsThisBlock) {
          const d = sb.diameterMm || 25;
          const fy = sb.gradeMpa || 500;
          const nominalCapKn = sb.tensileCapacityKn || (Math.PI * Math.pow(d / 1000, 2) / 4) * (fy * 1000);
          const sbLen = sb.lengthM || 4.0;
          const sbAnchorage =
            sbLen > apexDepthM + 0.5 ? 1.0 : sbLen > apexDepthM ? Math.max(0.4, (sbLen - apexDepthM) / 0.5) : 0.25;
          spotBoltBlockResistKn += nominalCapKn * sbAnchorage;
        }
      }
      if (spotBoltBlockResistKn === 0 && spotBoltsCount > 0 && !isVertShaft) {
        spotBoltBlockResistKn = 45 * Math.min(2, spotBoltsCount);
      }
    }

    const boltForceKn =
      boltsIntersecting * (165 / boltSpLongM) * effectiveAnchorageFactor + spotBoltBlockResistKn;

    // Shotcrete punching shear perimeter resistance
    const shotcreteShearKn =
      sup.shotcreteEnabled && shotcreteThickMm > 0
        ? (shotcreteThickMm / 1000) * 1800 * 0.45 // ~800 kN/m of thickness
        : 0;

    const ribSupportKn =
      (sup.latticeGirderEnabled ? 95 : 0) + (sup.ismbEnabled ? 155 : 0);

    const supportForceAddedKn = isSupportConfirmedInstalled
      ? Number((boltForceKn + shotcreteShearKn + ribSupportKn).toFixed(1))
      : 0;

    const resistingForceAfterKn = Number(
      (resistingForceBeforeKn / yieldRelaxationFactorBefore + supportForceAddedKn).toFixed(1)
    );

    const fosBefore = Number(
      Math.max(0.35, Math.min(3.8, resistingForceBeforeKn / Math.max(10, drivingForceKn))).toFixed(2)
    );
    const fosAfter = Number(
      Math.max(fosBefore, Math.min(4.8, resistingForceAfterKn / Math.max(10, drivingForceKn))).toFixed(2)
    );

    const dispBeforeMm = Number(
      (femBefore.maxDisplacementMm * (fosBefore < 1.0 ? 1.65 : fosBefore < 1.3 ? 1.25 : 0.9)).toFixed(2)
    );
    const dispAfterMm = Number(
      (femAfter.maxDisplacementMm * (fosAfter >= 1.5 ? 0.65 : 0.85)).toFixed(2)
    );

    const classifyBlock = (fos: number): DemKeyBlock2D['statusBefore'] =>
      fos < 1.05 ? 'UNSTABLE' : fos < 1.45 ? 'MARGINALLY STABLE' : 'STABLE';

    const centroidSvg = {
      x: Number((polySvg.reduce((acc, p) => acc + p.x, 0) / polySvg.length).toFixed(1)),
      y: Number((polySvg.reduce((acc, p) => acc + p.y, 0) / polySvg.length).toFixed(1)),
    };

    return {
      id,
      label,
      locationZone: zone,
      controllingSets: sets,
      polygonSvg: polySvg,
      centroidSvg,
      moveVectorSvg: moveVec,
      apexDepthMeters: apexDepthM,
      perimeterWidthMeters: perimWidthM,
      areaM2,
      volumePerMeterM3: areaM2,
      weightKnPerM,
      failureMode,
      drivingForceKn,
      resistingForceBeforeKn,
      supportForceAddedKn,
      resistingForceAfterKn,
      fosBefore,
      fosAfter,
      dispBeforeMm,
      dispAfterMm,
      boltsIntersectingCount: boltsIntersecting,
      anchorageBeyondPlasticZone:
        isSupportConfirmedInstalled &&
        boltLenM >= Math.max(apexDepthM + 0.5, femAfter.plasticZoneDepthMeters + 0.5),
      statusBefore: classifyBlock(fosBefore),
      statusAfter: classifyBlock(fosAfter),
    };
  };

  const crownTopY = cy - boxH / 2;
  const crownWedgeHalfW = (spanWidthM * 0.34 * scalePxPerM) / 2;
  const crownWedgeApexY = crownTopY - crownApexDepthM * scalePxPerM;

  const leftWallX = cx - boxW / 2;
  const leftWedgeApexX = leftWallX - leftWedgeDepthM * scalePxPerM;

  const rightWallX = cx + boxW / 2;
  const rightWedgeApexX = rightWallX + rightWedgeDepthM * scalePxPerM;

  const demKeyBlocks: DemKeyBlock2D[] = isVertShaft
    ? (() => {
        const rPx = boxW / 2;
        const quadArcM = shaftBreakdown
          ? shaftBreakdown.quadrantArcLengthM
          : Number(((Math.PI * spanWidthM) / 4).toFixed(2));
        const qBlocks: DemKeyBlock2D[] = [];

        // Q1: NORTH-EAST (0°–90°) — active in Full Face or Right Half
        if (!isShaftHalfFace || shaftHalfSide === 'right_half') {
          const a0 = (-75 * Math.PI) / 180;
          const aMid = (-45 * Math.PI) / 180;
          const a1 = (-15 * Math.PI) / 180;
          const rApex = rPx + crownApexDepthM * scalePxPerM;
          qBlocks.push(
            buildKeyBlock(
              'KB-NE',
              'KB-1 NE (0°–90°) Quadrant Wedge',
              'Right Sidewall',
              [set1, set2],
              [
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a0)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a0)).toFixed(1)),
                },
                {
                  x: Number((cx + rApex * Math.cos(aMid)).toFixed(1)),
                  y: Number((cy + rApex * Math.sin(aMid)).toFixed(1)),
                },
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a1)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a1)).toFixed(1)),
                },
              ],
              { dx: -18, dy: 18 },
              crownApexDepthM,
              Number((quadArcM * 0.65).toFixed(2)),
              'Wedge Sliding',
              set1Dip
            )
          );
        }

        // Q2: EAST-SOUTH (90°–180°) — active in Full Face or Right Half
        if (!isShaftHalfFace || shaftHalfSide === 'right_half') {
          const a0 = (15 * Math.PI) / 180;
          const aMid = (45 * Math.PI) / 180;
          const a1 = (75 * Math.PI) / 180;
          const rApex = rPx + rightWedgeDepthM * scalePxPerM;
          qBlocks.push(
            buildKeyBlock(
              'KB-ES',
              'KB-2 ES (90°–180°) Quadrant Wedge',
              'Right Sidewall',
              [set2, set3],
              [
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a0)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a0)).toFixed(1)),
                },
                {
                  x: Number((cx + rApex * Math.cos(aMid)).toFixed(1)),
                  y: Number((cy + rApex * Math.sin(aMid)).toFixed(1)),
                },
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a1)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a1)).toFixed(1)),
                },
              ],
              { dx: -18, dy: -18 },
              rightWedgeDepthM,
              Number((quadArcM * 0.62).toFixed(2)),
              'Wedge Sliding',
              set2Dip
            )
          );
        }

        // Q3: SOUTH-WEST (180°–270°) — active in Full Face or Left Half
        if (!isShaftHalfFace || shaftHalfSide === 'left_half') {
          const a0 = (105 * Math.PI) / 180;
          const aMid = (135 * Math.PI) / 180;
          const a1 = (165 * Math.PI) / 180;
          const rApex = rPx + leftWedgeDepthM * scalePxPerM;
          qBlocks.push(
            buildKeyBlock(
              'KB-SW',
              'KB-3 SW (180°–270°) Quadrant Wedge',
              'Left Sidewall',
              [set1, set3],
              [
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a0)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a0)).toFixed(1)),
                },
                {
                  x: Number((cx + rApex * Math.cos(aMid)).toFixed(1)),
                  y: Number((cy + rApex * Math.sin(aMid)).toFixed(1)),
                },
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a1)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a1)).toFixed(1)),
                },
              ],
              { dx: 18, dy: -18 },
              leftWedgeDepthM,
              Number((quadArcM * 0.62).toFixed(2)),
              'Planar Sliding',
              set1Dip
            )
          );
        }

        // Q4: WEST-NORTH (270°–360°) — active in Full Face or Left Half
        if (!isShaftHalfFace || shaftHalfSide === 'left_half') {
          const a0 = (195 * Math.PI) / 180;
          const aMid = (225 * Math.PI) / 180;
          const a1 = (255 * Math.PI) / 180;
          const rApex = rPx + leftWedgeDepthM * scalePxPerM;
          qBlocks.push(
            buildKeyBlock(
              'KB-WN',
              'KB-4 WN (270°–360°) Quadrant Wedge',
              'Left Sidewall',
              [set1, set2],
              [
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a0)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a0)).toFixed(1)),
                },
                {
                  x: Number((cx + rApex * Math.cos(aMid)).toFixed(1)),
                  y: Number((cy + rApex * Math.sin(aMid)).toFixed(1)),
                },
                {
                  x: Number((cx + (rPx - 3) * Math.cos(a1)).toFixed(1)),
                  y: Number((cy + (rPx - 3) * Math.sin(a1)).toFixed(1)),
                },
              ],
              { dx: 18, dy: 18 },
              leftWedgeDepthM,
              Number((quadArcM * 0.65).toFixed(2)),
              'Wedge Sliding',
              set2Dip
            )
          );
        }

        // When Half Face + Center Median is CLOSED (unexcavated rock half), include Center Median Rock Wall Block
        if (isShaftHalfFace && shaftMedianStatus === 'closed') {
          const medDir = shaftHalfSide === 'left_half' ? 1 : -1; // into unexcavated half
          const medApexX = cx + medDir * (leftWedgeDepthM * 0.85 * scalePxPerM);
          qBlocks.push(
            buildKeyBlock(
              'KB-MEDIAN',
              'KB-MED Center Median Rock Wall Block (0°–180°)',
              shaftHalfSide === 'left_half' ? 'Right Sidewall' : 'Left Sidewall',
              [set1, set2],
              [
                { x: Number(cx.toFixed(1)), y: Number((cy - boxH * 0.24).toFixed(1)) },
                { x: Number(medApexX.toFixed(1)), y: Number(cy.toFixed(1)) },
                { x: Number(cx.toFixed(1)), y: Number((cy + boxH * 0.24).toFixed(1)) },
              ],
              { dx: -medDir * 22, dy: 0 },
              Number((leftWedgeDepthM * 0.85).toFixed(2)),
              Number((spanWidthM * 0.48).toFixed(2)),
              'Planar Sliding',
              set1Dip
            )
          );
        }

        return qBlocks;
      })()
    : [
        buildKeyBlock(
          'KB-CROWN',
          mappingDomain === 'TUNNEL' ? 'KB-1 Crown Arch Wedge' : 'KB-1 Upper Crest Wedge',
          mappingDomain === 'TUNNEL' ? 'Crown Arch' : 'Slope Batter',
          [set1, set2],
          [
            { x: Number((cx - crownWedgeHalfW).toFixed(1)), y: Number((crownTopY + 6).toFixed(1)) },
            { x: Number(cx.toFixed(1)), y: Number(crownWedgeApexY.toFixed(1)) },
            { x: Number((cx + crownWedgeHalfW).toFixed(1)), y: Number((crownTopY + 6).toFixed(1)) },
          ],
          { dx: 0, dy: 24 },
          crownApexDepthM,
          Number((spanWidthM * 0.34).toFixed(2)),
          mappingDomain === 'TUNNEL' ? 'Gravity Fall (Crown)' : 'Wedge Sliding',
          68
        ),
        buildKeyBlock(
          'KB-LEFT',
          mappingDomain === 'TUNNEL' ? 'KB-2 Left Sidewall Wedge' : 'KB-2 Mid-Batter Planar Block',
          'Left Sidewall',
          [set1, set3],
          [
            { x: Number((leftWallX + 4).toFixed(1)), y: Number((cy - boxH * 0.22).toFixed(1)) },
            { x: Number(leftWedgeApexX.toFixed(1)), y: Number((cy - boxH * 0.04).toFixed(1)) },
            { x: Number((leftWallX + 4).toFixed(1)), y: Number((cy + boxH * 0.22).toFixed(1)) },
          ],
          { dx: 22, dy: 10 },
          leftWedgeDepthM,
          Number((totalHeightM * 0.42).toFixed(2)),
          'Planar Sliding',
          set1Dip
        ),
        buildKeyBlock(
          'KB-RIGHT',
          mappingDomain === 'TUNNEL' ? 'KB-3 Right Haunch / Wall Block' : 'KB-3 Toe Release Block',
          'Right Sidewall',
          [set2, set3],
          [
            { x: Number((rightWallX - 4).toFixed(1)), y: Number((cy - boxH * 0.24).toFixed(1)) },
            { x: Number(rightWedgeApexX.toFixed(1)), y: Number((cy - boxH * 0.02).toFixed(1)) },
            { x: Number((rightWallX - 4).toFixed(1)), y: Number((cy + boxH * 0.20).toFixed(1)) },
          ],
          { dx: -22, dy: 10 },
          rightWedgeDepthM,
          Number((totalHeightM * 0.38).toFixed(2)),
          'Wedge Sliding',
          set2Dip
        ),
      ];

  const sortedBlocksBefore = [...demKeyBlocks].sort((a, b) => a.fosBefore - b.fosBefore);
  const sortedBlocksAfter = [...demKeyBlocks].sort((a, b) => a.fosAfter - b.fosAfter);
  const criticalBlockBefore = sortedBlocksBefore[0] || null;
  const criticalBlockAfter = sortedBlocksAfter[0] || null;

  const minBlockFosBefore = criticalBlockBefore ? criticalBlockBefore.fosBefore : 1.5;
  const minBlockFosAfter = criticalBlockAfter ? criticalBlockAfter.fosAfter : 1.8;

  const maxJointOpeningBeforeMm = Number(
    Math.max(...demJointPlanes.map((j) => j.apertureChangeBeforeMm), 0.15).toFixed(2)
  );
  const maxJointOpeningAfterMm = Number(
    Math.max(...demJointPlanes.map((j) => j.apertureChangeAfterMm), 0.08).toFixed(2)
  );
  const maxJointSlipBeforeMm = Number(
    Math.max(...demJointPlanes.map((j) => j.shearSlipBeforeMm), 0.2).toFixed(2)
  );
  const maxJointSlipAfterMm = Number(
    Math.max(...demJointPlanes.map((j) => j.shearSlipAfterMm), 0.1).toFixed(2)
  );

  // 10. Coupled FEM + DEM Interaction Assessment
  const maxWedgeApexDepthM = Math.max(...demKeyBlocks.map((b) => b.apexDepthMeters), 1.0);
  const doesPlasticZoneEnvelopWedgesBefore =
    femBefore.plasticZoneDepthMeters >= maxWedgeApexDepthM * 0.85;
  const doesPlasticZoneEnvelopWedgesAfter =
    femAfter.plasticZoneDepthMeters >= maxWedgeApexDepthM * 0.85;

  const governingDepthAfterM = Math.max(femAfter.plasticZoneDepthMeters, maxWedgeApexDepthM);
  const boltAnchorageMarginMeters = isSupportConfirmedInstalled
    ? Number((boltLenM - governingDepthAfterM).toFixed(2))
    : Number((-governingDepthAfterM).toFixed(2));
  const isBoltLengthAdequateForYieldAndWedge =
    isSupportConfirmedInstalled && boltAnchorageMarginMeters >= 0.5;

  const combinedStabilityStatusBefore =
    femBefore.continuumFactorOfSafety < 1.05 || minBlockFosBefore < 1.05
      ? 'CRITICAL INSTABILITY'
      : femBefore.continuumFactorOfSafety < 1.4 || minBlockFosBefore < 1.4
      ? 'MARGINAL / YIELDING'
      : 'STABLE';

  const combinedStabilityStatusAfter =
    femAfter.continuumFactorOfSafety < 1.05 || minBlockFosAfter < 1.05
      ? 'CRITICAL INSTABILITY'
      : femAfter.continuumFactorOfSafety < 1.4 || minBlockFosAfter < 1.4
      ? 'MARGINAL / YIELDING'
      : 'STABLE';

  const engineeringSynthesis: string[] = [
    `Logged Geological Reference Basis: ${loggedReferenceBasis.lithologyShares
      .map((s) => `${s.rockName} (${s.weightPct}%)`)
      .join(' + ')} | UCS Basis: ${loggedReferenceBasis.loggedUcsSourceLabel} (σ_ci = ${pIntactUcs.value} MPa, E_i = ${pIntactEi.value} GPa, m_i = ${pMi.value}) | Joint & Fault Basis: ${loggedReferenceBasis.loggedJointsSummaryLabel}.`,
    ...(isVertShaft && shaftBreakdown
      ? [
          `Vertical Shaft 4-Quadrant Geometry (ØD = ${shaftBreakdown.diameterM.toFixed(2)} m, C = πD = ${shaftBreakdown.circumferenceM.toFixed(2)} m, Quadrant Arc = ${shaftBreakdown.quadrantArcLengthM.toFixed(2)} m): ${
            isShaftHalfFace
              ? `Half-Face Excavation (${shaftHalfSide === 'left_half' ? 'Left Half 180°–360° [SW + WN]' : 'Right Half 0°–180° [NE + ES]'}) with Center Median ${shaftMedianStatus.toUpperCase()} (${shaftMedianStatus === 'closed' ? 'Opposite Half Unexcavated Rock Wall' : 'Opposite Half Excavated Free Span'}).`
              : 'Full-Face Circular Excavation across all 4 quadrants: NE (0°–90°), ES (90°–180°), SW (180°–270°), WN (270°–360°).'
          }`,
        ]
      : []),
    `Continuum FEM (Hoek–Brown / Duncan Fama): Unsupported excavation develops a plastic yield zone of ${femBefore.plasticZoneDepthMeters.toFixed(2)} m (R_p = ${femBefore.plasticZoneRadiusMeters.toFixed(2)} m) with maximum radial displacement u_max = ${femBefore.maxDisplacementMm.toFixed(2)} mm and FoS_FEM = ${femBefore.continuumFactorOfSafety.toFixed(2)}.`,
    `Discontinuum DEM (Goodman & Shi / Barton–Bandis): Mapped joint sets (${effectiveSetIds.join(', ')}) form ${demKeyBlocks.length} perimeter blocks; critical block is ${criticalBlockBefore?.label || 'Crown Wedge'} (apex ${maxWedgeApexDepthM.toFixed(2)} m, W = ${criticalBlockBefore?.weightKnPerM.toFixed(0)} kN/m) with unsupported FoS_DEM = ${minBlockFosBefore.toFixed(2)}.`,
    isSupportConfirmedInstalled
      ? `After-Support Coupled Effect: Installed ESWA support (${activeSystemsSummary.join(' + ')}) supplies p_i = ${effectiveSupportPressureMpa.toFixed(3)} MPa, reducing plastic depth to ${femAfter.plasticZoneDepthMeters.toFixed(2)} m (-${Math.round(((femBefore.maxDisplacementMm - femAfter.maxDisplacementMm) / Math.max(0.1, femBefore.maxDisplacementMm)) * 100)}% displacement reduction) and raising critical block FoS_DEM from ${minBlockFosBefore.toFixed(2)} to ${minBlockFosAfter.toFixed(2)}.`
      : `WARNING — No Installed Support Confirmed in Current Face Record: Enable rock bolts, shotcrete, or ribs in Stage 8 (Support System) to evaluate reinforced After-Support performance.`,
    isSupportConfirmedInstalled
      ? isBoltLengthAdequateForYieldAndWedge
        ? `Bolt Anchorage Verification: Bolt length L = ${boltLenM.toFixed(1)} m provides +${boltAnchorageMarginMeters.toFixed(2)} m anchorage beyond the combined plastic/wedge envelope (${governingDepthAfterM.toFixed(2)} m) — ADEQUATE.`
        : `Bolt Anchorage Alert: Bolt length L = ${boltLenM.toFixed(1)} m has insufficient anchorage margin (${boltAnchorageMarginMeters.toFixed(2)} m) beyond the governing plastic/wedge depth (${governingDepthAfterM.toFixed(2)} m); consider lengthening bolts to ≥ ${(governingDepthAfterM + 1.0).toFixed(1)} m.`
      : `Recommended Minimum Bolt Length: ≥ ${(governingDepthAfterM + 1.0).toFixed(1)} m to anchor at least 1.0 m into elastic rock beyond the ${governingDepthAfterM.toFixed(2)} m yield/wedge envelope.`,
  ];

  const methodologyAndLimitations = [
    {
      title: '1. Area-Weighted Logged Lithology & Intact Rock Synthesis',
      formulaSummary:
        'Intact UCS (σ_ci), Modulus Ratio (MR), Hoek–Brown m_i, unit weight (γ), and Poisson ratio (ν) are computed using strict priority from logged strength/UCS ratings and area-weighted mapped lithology strokes, alternating bands, channel samples, and structural fault/shear zones — never diluted by unlogged median defaults.',
      referenceCitation: 'Hoek & Brown (1997); Marinos & Hoek (2001); ISRM (1981)',
      limitationNote:
        'When multiple lithologies are mapped on the face or bench, continuum properties are weighted by mapped polygon/stroke area fraction and assigned across the 3-node CST triangular mesh.',
    },
    {
      title: '2. Continuum Elastoplastic Solution (FEM Representation)',
      formulaSummary:
        'Generalized Hoek–Brown (2002) & Duncan Fama (1993) / Carranza-Torres & Fairhurst (2000) closed-form elastoplastic convergence-confinement solution mapped onto a 2D boundary-fitted mesh with Kirsch directional stress factors.',
      referenceCitation: 'Hoek, Carranza-Torres & Corkum (2002); Hoek & Diederichs (2006)',
      limitationNote:
        'Assumes equivalent isotropic continuum behavior within each lithology sector. Valid for preliminary design and convergence-confinement verification; does not replace full 3D nonlinear time-dependent creep FEA.',
    },
    {
      title: '3. Discontinuum Block & Joint Mechanics (DEM Representation)',
      formulaSummary:
        'Goodman & Shi (1985) 2D kinematic key-block limit-equilibrium combined with Barton–Choubey (1977) nonlinear joint shear strength (JRC, JCS, φ_r) and Bandis et al. (1983) normal/shear joint stiffness (K_n, K_s) derived directly from logged joint sets, trace lengths, apertures, infilling, and fault/shear features.',
      referenceCitation: 'Goodman & Shi (1985); Barton & Choubey (1977); Bandis et al. (1983)',
      limitationNote:
        'Evaluates plane-strain perimeter wedges and joint slip from mapped ESWA traces, 3D dip surfaces, and fault/shear zones.',
    },
  ];

  // Evaluate engineering prerequisites with Logged-Data Reference Synthesis support
  const hasClassification = hasRmr || hasQ || hasGsi || hasAnyLoggedGeology;
  const hasMappedLithology = lithoInfo.hasMappedLithology;
  const hasWeatheringAndStrength = Boolean(
    round?.weatheringIndex || round?.strengthIndex || hasAnyLoggedGeology
  );
  const hasUcsInput =
    hasLoggedStrengthIndex ||
    hasLoggedRmrUcs ||
    lithoInfo.hasMappedLithology ||
    hasAnyLoggedGeology ||
    overrides.intactUcsMpa !== undefined ||
    siteTests.intactUcsMpa !== undefined;
  const hasRockStrengthOrLithology =
    (hasMappedLithology || Boolean(round?.weatheringIndex) || hasAnyLoggedGeology) &&
    hasUcsInput;
  const hasOverburden =
    overburdenInfo.provenance !== 'MISSING_INPUT' ||
    overrides.overburdenDepthM !== undefined ||
    siteTests.overburdenDepthM !== undefined;
  const hasDiscontinuitiesForDem =
    mappedTraces.length > 0 ||
    mappedDipSurfaces.length > 0 ||
    lithoInfo.mappedFaultOrShearCount > 0 ||
    activeSetIds.length > 0;

  const missingBeforeRequirements: string[] = [];
  if (!hasClassification) {
    missingBeforeRequirements.push(
      'Rock Mass Classification or Geological Logging Missing: Map lithology/joints on the Canvas OR complete RMR89, Q-System, or GSI in Stage 7.'
    );
  }
  if (!hasMappedLithology && !round?.weatheringIndex && !hasAnyLoggedGeology) {
    missingBeforeRequirements.push(
      'Lithology / Weathering Missing: Map rock lithology on the Face Canvas OR select ISRM Weathering Grade (WI–WVI) in Stage 6.'
    );
  }
  if (!hasUcsInput) {
    missingBeforeRequirements.push(
      'Intact Rock Strength (UCS / S1–S6) Missing: Map rock lithology, select ISRM Strength Index (S1–S6) in Stage 6, or enter Intact UCS σ_ci (MPa).'
    );
  }
  if (!hasOverburden) {
    missingBeforeRequirements.push(
      'In-Situ Overburden Depth H (m) Not Entered: Enter the tunnel rock cover / overburden depth H (m) in the quick-input bar or click "Apply Logged Reference Values".'
    );
  }

  const isBeforeAnalysisReady =
    hasClassification && hasRockStrengthOrLithology && hasOverburden;

  const missingAfterRequirements: string[] = [...missingBeforeRequirements];
  if (!isSupportConfirmedInstalled) {
    missingAfterRequirements.push(
      'No Support System Configured: Enable at least one support system (Systematic Rock Bolts, Shotcrete, Wire Mesh, Lattice Girder, or ISMB Steel Ribs) in Stage 8 (Support System) before running After-Support FEM / DEM analysis.'
    );
  }
  const isAfterAnalysisReady = isBeforeAnalysisReady && isSupportConfirmedInstalled;

  return {
    projectName: project?.projectName || 'ESWA Project',
    locationName: location?.name || 'Heading 1',
    chainageLabel: `RD ${round?.chainageFrom || '0.00'}m – ${round?.chainageTo || '3.00'}m`,
    mappingDomain,
    excavationShapeLabel: isVertShaft
      ? isShaftHalfFace
        ? `CIRCULAR VERTICAL SHAFT Ø${spanWidthM}m (HALF-FACE ${
            shaftHalfSide === 'left_half' ? 'SW–WN 180°–360°' : 'NE–ES 0°–180°'
          } • MEDIAN ${shaftMedianStatus.toUpperCase()})`
        : `CIRCULAR VERTICAL SHAFT Ø${spanWidthM}m (FULL-FACE 360° RING)`
      : (location?.shape || 'd_shaped').replace(/_/g, ' ').toUpperCase(),
    spanWidthM,
    totalHeightM,
    equivalentRadiusM,
    dominantLithology: lithoInfo.dominant,
    secondaryLithologies: lithoInfo.secondary,
    loggedReferenceBasis,
    weatheringGrade: wMod.label,
    strengthGrade: sInfo.label,
    qValue: safeQValue,
    qClass:
      qRes.rockClass ||
      (safeQValue >= 40
        ? 'Very Good'
        : safeQValue >= 10
        ? 'Good'
        : safeQValue >= 4
        ? 'Fair'
        : safeQValue >= 1
        ? 'Poor'
        : 'Very Poor'),
    rmrValue: safeRmrValue,
    rmrClass:
      rmrRes.rmrClass ||
      (safeRmrValue >= 81
        ? 'Class I — Very Good Rock'
        : safeRmrValue >= 61
        ? 'Class II — Good Rock'
        : safeRmrValue >= 41
        ? 'Class III — Fair Rock'
        : safeRmrValue >= 21
        ? 'Class IV — Poor Rock'
        : 'Class V — Very Poor Rock'),
    gsiValue: gsiVal,
    groundwaterSummary:
      basePoreWaterKpa > 150
        ? `High Seepage / Flowing Water (uw = ${basePoreWaterKpa.toFixed(0)} kPa)`
        : basePoreWaterKpa > 20
        ? `Damp to Dripping Seepage (uw = ${basePoreWaterKpa.toFixed(0)} kPa)`
        : 'Predominantly Dry to Slightly Damp (uw ≈ 0 kPa)',
    prerequisites: {
      hasClassification,
      hasRmr,
      hasQ,
      hasGsi,
      hasRockStrengthOrLithology,
      hasMappedLithology,
      hasWeatheringAndStrength,
      hasOverburden,
      hasDiscontinuitiesForDem,
      isBeforeAnalysisReady,
      isAfterAnalysisReady,
      missingBeforeRequirements,
      missingAfterRequirements,
    },
    inSituVerticalStressMpa: Number(sigmaV_Mpa.toFixed(2)),
    inSituHorizontalStressMpa: Number(sigmaH_Mpa.toFixed(2)),
    inSituHydrostaticStressMpa: p0_Mpa,
    criticalSupportPressureMpa: Number(pCrMpa.toFixed(3)),
    hoekBrownMb: Number(mb.toFixed(3)),
    hoekBrownS: Number(s.toFixed(5)),
    hoekBrownA: Number(a.toFixed(3)),
    parameters,
    estimatedParametersCount: parameters.filter((p) => p.provenance === 'REFERENCE_ESTIMATED').length,
    overriddenParametersCount: parameters.filter((p) => p.provenance === 'ENGINEER_OVERRIDE').length,
    missingParametersCount: parameters.filter((p) => p.provenance === 'MISSING_INPUT').length,
    supportBreakdown,
    femBefore,
    femAfter,
    grcCurve,
    meshNodes,
    meshElements,
    tunnelOutlineSvgPoints,
    tunnelClosedPathD,
    tunnelSplY,
    plasticZonePolygonBeforeSvg,
    plasticZonePolygonAfterSvg,
    supportBoltVectorsSvg,
    demJointPlanes,
    demKeyBlocks,
    criticalBlockBefore,
    criticalBlockAfter,
    minBlockFosBefore,
    minBlockFosAfter,
    maxJointOpeningBeforeMm,
    maxJointOpeningAfterMm,
    maxJointSlipBeforeMm,
    maxJointSlipAfterMm,
    combinedInteraction: {
      maxWedgeApexDepthM,
      plasticZoneDepthBeforeM: femBefore.plasticZoneDepthMeters,
      plasticZoneDepthAfterM: femAfter.plasticZoneDepthMeters,
      doesPlasticZoneEnvelopWedgesBefore,
      doesPlasticZoneEnvelopWedgesAfter,
      boltAnchorageMarginMeters,
      isBoltLengthAdequateForYieldAndWedge,
      combinedStabilityStatusBefore,
      combinedStabilityStatusAfter,
      engineeringSynthesis,
    },
    methodologyAndLimitations,
  };
}

export function exportStandaloneFemDemWordReport(
  result: CompleteFemDemAnalysisResult,
  round: FieldExcavationRound
): void {
  const dateStr = round.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10);
  const paramRowsHtml = result.parameters
    .map(
      (p) => `
      <tr>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-weight:bold;">${p.label} (${p.symbol})</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-family:monospace;font-weight:bold;text-align:right;">${p.value} ${p.unit}</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-family:monospace;">${p.applicableRange}</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-weight:bold;color:${
          p.provenance === 'REFERENCE_ESTIMATED'
            ? '#b45309'
            : p.provenance === 'MISSING_INPUT'
            ? '#be123c'
            : p.provenance === 'ENGINEER_OVERRIDE'
            ? '#6d28d9'
            : '#047857'
        };">${p.provenanceBadge}</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-size:9pt;">${p.referenceSource}</td>
      </tr>`
    )
    .join('');

  const blockRowsHtml = result.demKeyBlocks
    .map(
      (b) => `
      <tr>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-weight:bold;">${b.label}</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;">${b.controllingSets.join(' × ')} (${b.failureMode})</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-family:monospace;text-align:right;">${b.apexDepthMeters.toFixed(2)} m / ${b.weightKnPerM.toFixed(0)} kN/m</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-family:monospace;font-weight:bold;text-align:right;color:${b.fosBefore < 1.1 ? '#be123c' : '#b45309'};">${b.fosBefore.toFixed(2)} (${b.statusBefore})</td>
        <td style="border:1px solid #1e293b;padding:4px 6px;font-family:monospace;font-weight:bold;text-align:right;color:${b.fosAfter >= 1.5 ? '#047857' : '#b45309'};">${b.fosAfter.toFixed(2)} (${b.statusAfter})</td>
      </tr>`
    )
    .join('');

  const lithoSharesHtml = result.loggedReferenceBasis.lithologyShares
    .map((s) => `${s.rockName} (${s.weightPct}% — ${s.rockFamily})`)
    .join(' + ');

  const html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>ESWA Standalone FEM & DEM Geotechnical Analysis Report — ${result.chainageLabel}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 18mm; }
      h1 { font-size: 14pt; text-transform: uppercase; margin-bottom: 4px; color: #0f172a; }
      h2 { font-size: 11pt; text-transform: uppercase; background: #f1f5f9; padding: 4px 8px; border-left: 4px solid #0284c7; margin-top: 14px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt; }
      th { background: #e2e8f0; border: 1px solid #1e293b; padding: 5px 6px; text-align: left; font-weight: bold; }
      td { border: 1px solid #1e293b; padding: 4px 6px; }
    </style>
  </head>
  <body>
    <h1>ESWA GEOLOGICAL MAPPER — STANDALONE FEM &amp; DEM ANALYSIS REPORT</h1>
    <p style="margin-top:0;color:#475569;font-size:9.5pt;">
      <strong>Project:</strong> ${result.projectName} &nbsp;|&nbsp;
      <strong>Location:</strong> ${result.locationName} &nbsp;|&nbsp;
      <strong>Chainage:</strong> ${result.chainageLabel} &nbsp;|&nbsp;
      <strong>Date:</strong> ${dateStr}
    </p>

    <h2>1. Excavation Geometry, Logged Geological Reference Basis &amp; Classifications</h2>
    <table>
      <tr>
        <th>Excavation Profile &amp; Dimensions</th>
        <td>${result.excavationShapeLabel} (${result.spanWidthM.toFixed(2)}m Span × ${result.totalHeightM.toFixed(2)}m Height; R_eq = ${result.equivalentRadiusM.toFixed(2)}m)</td>
        <th>Area-Weighted Logged Lithology</th>
        <td>${lithoSharesHtml} (${result.weatheringGrade}, ${result.strengthGrade})</td>
      </tr>
      <tr>
        <th>Intact UCS &amp; Joint Reference Basis</th>
        <td colspan="3"><strong>UCS Basis:</strong> ${result.loggedReferenceBasis.loggedUcsSourceLabel} &nbsp;|&nbsp; <strong>Joints &amp; Structural Basis:</strong> ${result.loggedReferenceBasis.loggedJointsSummaryLabel} (${result.loggedReferenceBasis.loggedStructuresSummaryLabel})</td>
      </tr>
      <tr>
        <th>ESWA Classifications (${result.loggedReferenceBasis.classificationSourceLabel})</th>
        <td>Q = ${result.qValue} (${result.qClass}) &nbsp;|&nbsp; RMR89 = ${result.rmrValue} (${result.rmrClass}) &nbsp;|&nbsp; GSI = ${result.gsiValue}</td>
        <th>In-Situ Stress &amp; Groundwater</th>
        <td>σv = ${result.inSituVerticalStressMpa} MPa, σh = ${result.inSituHorizontalStressMpa} MPa (p0 = ${result.inSituHydrostaticStressMpa} MPa) | ${result.groundwaterSummary}</td>
      </tr>
    </table>

    <h2>2. Before-Support vs. After-Support Numerical Comparison (FEM + DEM)</h2>
    <table>
      <thead>
        <tr>
          <th>Engineering Response Metric</th>
          <th>Unit</th>
          <th>BEFORE SUPPORT (Unreinforced)</th>
          <th>AFTER SUPPORT (ESWA Installed Support)</th>
          <th>Net Engineering Change</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Internal Support Pressure (p_i)</strong></td>
          <td>MPa</td>
          <td>0.000</td>
          <td><strong>${result.femAfter.internalSupportPressureMpa.toFixed(3)}</strong></td>
          <td>+${result.femAfter.internalSupportPressureMpa.toFixed(3)} MPa confining pressure</td>
        </tr>
        <tr>
          <td><strong>Plastic Yield Zone Depth (R_p - R_eq)</strong></td>
          <td>m</td>
          <td>${result.femBefore.plasticZoneDepthMeters.toFixed(2)} m (R_p = ${result.femBefore.plasticZoneRadiusMeters.toFixed(2)}m)</td>
          <td><strong>${result.femAfter.plasticZoneDepthMeters.toFixed(2)} m (R_p = ${result.femAfter.plasticZoneRadiusMeters.toFixed(2)}m)</strong></td>
          <td>-${(result.femBefore.plasticZoneDepthMeters - result.femAfter.plasticZoneDepthMeters).toFixed(2)} m yield reduction</td>
        </tr>
        <tr>
          <td><strong>Max Radial Boundary Displacement (u_max)</strong></td>
          <td>mm</td>
          <td>${result.femBefore.maxDisplacementMm.toFixed(2)} mm</td>
          <td><strong>${result.femAfter.maxDisplacementMm.toFixed(2)} mm</strong></td>
          <td>-${(result.femBefore.maxDisplacementMm - result.femAfter.maxDisplacementMm).toFixed(2)} mm convergence reduction</td>
        </tr>
        <tr>
          <td><strong>Max Tangential Stress (σ_θ,max)</strong></td>
          <td>MPa</td>
          <td>${result.femBefore.maxTangentialStressMpa.toFixed(2)} MPa</td>
          <td><strong>${result.femAfter.maxTangentialStressMpa.toFixed(2)} MPa</strong></td>
          <td>Stress redistribution around arch</td>
        </tr>
        <tr>
          <td><strong>FEM Continuum Factor of Safety (FoS_FEM)</strong></td>
          <td>ratio</td>
          <td>${result.femBefore.continuumFactorOfSafety.toFixed(2)} (${result.femBefore.stabilityStatus})</td>
          <td><strong>${result.femAfter.continuumFactorOfSafety.toFixed(2)} (${result.femAfter.stabilityStatus})</strong></td>
          <td>+${(result.femAfter.continuumFactorOfSafety - result.femBefore.continuumFactorOfSafety).toFixed(2)}</td>
        </tr>
        <tr>
          <td><strong>DEM Critical Key-Block Factor of Safety (FoS_DEM)</strong></td>
          <td>ratio</td>
          <td>${result.minBlockFosBefore.toFixed(2)}</td>
          <td><strong>${result.minBlockFosAfter.toFixed(2)}</strong></td>
          <td>+${(result.minBlockFosAfter - result.minBlockFosBefore).toFixed(2)}</td>
        </tr>
        <tr>
          <td><strong>Max Joint Opening / Shear Slip (DEM)</strong></td>
          <td>mm</td>
          <td>Open: ${result.maxJointOpeningBeforeMm} mm | Slip: ${result.maxJointSlipBeforeMm} mm</td>
          <td><strong>Open: ${result.maxJointOpeningAfterMm} mm | Slip: ${result.maxJointSlipAfterMm} mm</strong></td>
          <td>Joint interlock clamped</td>
        </tr>
      </tbody>
    </table>

    <h2>3. DEM Discrete Key-Block &amp; Wedge Limit-Equilibrium Assessment</h2>
    <table>
      <thead>
        <tr>
          <th>Key Block / Wedge ID</th>
          <th>Controlling Joint Sets &amp; Mode</th>
          <th>Apex Depth / Weight</th>
          <th>FoS (Before Support)</th>
          <th>FoS (After ESWA Support)</th>
        </tr>
      </thead>
      <tbody>
        ${blockRowsHtml}
      </tbody>
    </table>

    <h2>4. Installed ESWA Support System &amp; Coupled Synthesis</h2>
    <p><strong>Support Status:</strong> ${result.supportBreakdown.supportStatusMessage}</p>
    <p><strong>Active Support Elements:</strong> ${result.supportBreakdown.activeSystemsSummary.join(' • ') || 'None'}</p>
    <ul>
      ${result.combinedInteraction.engineeringSynthesis.map((s) => `<li>${s}</li>`).join('')}
    </ul>

    <h2>5. Material Properties, Logged-Data Reference Sources &amp; Parameter Provenance</h2>
    <p style="font-size:9pt;color:#475569;">
      Reference values are dynamically synthesized from the round's area-weighted logged lithologies (${lithoSharesHtml}), UCS/strength ratings, and mapped discontinuity sets/traces/faults.
    </p>
    <table>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Used Value</th>
          <th>Applicable Range</th>
          <th>Data Provenance</th>
          <th>Reference Source &amp; Correlation</th>
        </tr>
      </thead>
      <tbody>
        ${paramRowsHtml}
      </tbody>
    </table>

    <h2>6. Calculation Methods, Empirical Correlations &amp; Limitations</h2>
    <ul>
      ${result.methodologyAndLimitations
        .map(
          (m) =>
            `<li><strong>${m.title}:</strong> ${m.formulaSummary} <em>(${m.referenceCitation})</em> — ${m.limitationNote}</li>`
        )
        .join('')}
    </ul>
  </body>
  </html>`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanChain = result.chainageLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `ESWA_FEM_DEM_Analysis_${cleanChain}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
