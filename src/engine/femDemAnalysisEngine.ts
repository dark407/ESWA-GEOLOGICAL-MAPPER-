import {
  computeFaceTunnelOutlineDetails,
  computeFieldQValue,
  computeFieldRmrValue,
  createDefaultSupportSystem,
  FIELD_JOINT_SET_IDS,
  FIELD_LITHOLOGY_CATALOG,
  FieldExcavationRound,
  FieldJointSetId,
  FieldProjectItem,
  FieldSupportSystemConfig,
  FieldTunnelLocationItem,
  MappingDomainType,
} from './fieldMappingEngine';
import { SurfaceGeometryParameters } from './surfaceMappingEngine';

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
    rockFamily: 'Granite / Granodiorite',
    keywords: ['granite', 'granodiorite', 'pegmatite', 'aplite', 'felsic'],
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
    defaultJrc: 10,
    colorHex: '#fca5a5',
    sourceCitation: 'Hoek & Brown (1997); ISRM (1981); Goodman (1989) Table 3.1',
  },
  {
    rockFamily: 'Basalt / Dolerite / Andesite',
    keywords: ['basalt', 'dolerite', 'diabase', 'andesite', 'trap', 'volcanic'],
    unitWeightKnM3: 28.5,
    unitWeightRange: '27.5 – 30.0 kN/m³',
    ucsMpa: 150,
    ucsRange: '110 – 260 MPa',
    eiGpa: 60,
    eiRange: '45 – 85 GPa',
    poissonRatio: 0.24,
    poissonRange: '0.20 – 0.28',
    mi: 25,
    miRange: '22 – 28',
    basicFrictionDeg: 35,
    frictionRange: '33° – 38°',
    defaultJrc: 9,
    colorHex: '#64748b',
    sourceCitation: 'Hoek & Diederichs (2006); Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Diorite / Gabbro',
    keywords: ['diorite', 'gabbro', 'norite', 'peridotite', 'mafic'],
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
    colorHex: '#475569',
    sourceCitation: 'Marinos & Hoek (2000); ISRM Suggested Methods',
  },
  {
    rockFamily: 'Quartzite',
    keywords: ['quartzite', 'chert', 'siliceous', 'quartz vein', 'quartz'],
    unitWeightKnM3: 26.8,
    unitWeightRange: '26.0 – 27.5 kN/m³',
    ucsMpa: 165,
    ucsRange: '120 – 280 MPa',
    eiGpa: 65,
    eiRange: '50 – 85 GPa',
    poissonRatio: 0.18,
    poissonRange: '0.14 – 0.22',
    mi: 20,
    miRange: '17 – 23',
    basicFrictionDeg: 32,
    frictionRange: '28° – 35°',
    defaultJrc: 8,
    colorHex: '#fde047',
    sourceCitation: 'Hoek (2007) Practical Rock Engineering; Deere (1968)',
  },
  {
    rockFamily: 'Gneiss / Migmatite',
    keywords: ['gneiss', 'migmatite', 'granulite', 'amphibolite'],
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
    rockFamily: 'Schist (Mica / Chlorite / Quartz-Mica)',
    keywords: ['schist', 'mica', 'chlorite', 'talc'],
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
    rockFamily: 'Phyllite / Slate',
    keywords: ['phyllite', 'slate', 'argillite', 'foliated'],
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
    rockFamily: 'Limestone / Dolomite / Marble',
    keywords: ['limestone', 'dolomite', 'marble', 'carbonate', 'chalk', 'calcarenite'],
    unitWeightKnM3: 26.6,
    unitWeightRange: '25.2 – 28.0 kN/m³',
    ucsMpa: 85,
    ucsRange: '50 – 140 MPa',
    eiGpa: 38,
    eiRange: '24 – 58 GPa',
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
    rockFamily: 'Sandstone / Greywacke / Conglomerate',
    keywords: ['sandstone', 'greywacke', 'arkose', 'conglomerate', 'breccia', 'gritstone'],
    unitWeightKnM3: 24.8,
    unitWeightRange: '23.0 – 26.5 kN/m³',
    ucsMpa: 72,
    ucsRange: '35 – 130 MPa',
    eiGpa: 26,
    eiRange: '14 – 42 GPa',
    poissonRatio: 0.22,
    poissonRange: '0.18 – 0.27',
    mi: 17,
    miRange: '15 – 19',
    basicFrictionDeg: 31,
    frictionRange: '28° – 34°',
    defaultJrc: 11,
    colorHex: '#fcd34d',
    sourceCitation: 'Hoek (2007); Barton & Choubey (1977)',
  },
  {
    rockFamily: 'Siltstone / Mudstone / Shale',
    keywords: ['siltstone', 'mudstone', 'shale', 'claystone', 'marl', 'coal'],
    unitWeightKnM3: 24.2,
    unitWeightRange: '22.0 – 25.8 kN/m³',
    ucsMpa: 32,
    ucsRange: '10 – 65 MPa',
    eiGpa: 11,
    eiRange: '4 – 22 GPa',
    poissonRatio: 0.29,
    poissonRange: '0.25 – 0.35',
    mi: 6,
    miRange: '4 – 9',
    basicFrictionDeg: 24,
    frictionRange: '20° – 27°',
    defaultJrc: 5,
    colorHex: '#cbd5e1',
    sourceCitation: 'Marinos & Hoek (2001) Flysch & Weak Rocks; ISRM (1981)',
  },
  {
    rockFamily: 'Fault Gouge / Sheared / Crushed Zone',
    keywords: ['fault', 'shear', 'gouge', 'mylonite', 'crushed', 'weathered soil'],
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
    basicFrictionDeg: 19,
    frictionRange: '14° – 24°',
    defaultJrc: 3,
    colorHex: '#fda4af',
    sourceCitation: 'Barton (2002) Q-System Shear Zones; Hoek et al. (1998)',
  },
];

// Weathering reduction multipliers according to ISRM (1981) grades WI to WVI
const WEATHERING_MODIFIERS: Record<
  string,
  { label: string; ucsFactor: number; modulusFactor: number; unitWeightDelta: number; frictionDeltaDeg: number }
> = {
  WI: { label: 'WI (Fresh / Unweathered)', ucsFactor: 1.0, modulusFactor: 1.0, unitWeightDelta: 0.0, frictionDeltaDeg: 0 },
  WII: { label: 'WII (Slightly Weathered)', ucsFactor: 0.84, modulusFactor: 0.85, unitWeightDelta: -0.4, frictionDeltaDeg: -1.5 },
  WIII: { label: 'WIII (Moderately Weathered)', ucsFactor: 0.58, modulusFactor: 0.62, unitWeightDelta: -1.1, frictionDeltaDeg: -3.5 },
  WIV: { label: 'WIV (Highly Weathered)', ucsFactor: 0.32, modulusFactor: 0.38, unitWeightDelta: -2.0, frictionDeltaDeg: -6.0 },
  WV: { label: 'WV (Completely Weathered)', ucsFactor: 0.14, modulusFactor: 0.18, unitWeightDelta: -3.2, frictionDeltaDeg: -8.5 },
  WVI: { label: 'WVI (Residual Soil)', ucsFactor: 0.06, modulusFactor: 0.08, unitWeightDelta: -4.5, frictionDeltaDeg: -10.5 },
};

// ISRM Strength Index (S1 - S6) typical UCS midpoint & range
const ISRM_STRENGTH_UCS_MAP: Record<string, { midMpa: number; range: string; label: string }> = {
  S1: { midMpa: 210, range: '> 200 MPa (Extremely Strong)', label: 'S1 (>200 MPa)' },
  S2: { midMpa: 135, range: '100 – 200 MPa (Very Strong)', label: 'S2 (100–200 MPa)' },
  S3: { midMpa: 72, range: '50 – 100 MPa (Strong)', label: 'S3 (50–100 MPa)' },
  S4: { midMpa: 36, range: '25 – 50 MPa (Medium Strong)', label: 'S4 (25–50 MPa)' },
  S5: { midMpa: 14, range: '5 – 25 MPa (Weak)', label: 'S5 (5–25 MPa)' },
  S6: { midMpa: 3.5, range: '1 – 5 MPa (Very Weak)', label: 'S6 (1–5 MPa)' },
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

function matchLithologyReference(rockName: string): LithologyReferenceEntry {
  const lower = (rockName || '').toLowerCase();
  for (const entry of LITHOLOGY_REFERENCE_CATALOG) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry;
    }
  }
  return LITHOLOGY_REFERENCE_CATALOG[0]; // Default to Granite/Crystalline with clear label
}

function extractDominantLithologies(round: FieldExcavationRound): {
  dominant: string;
  secondary: string[];
} {
  const counts: Record<string, number> = {};
  for (const stroke of round?.lithologyStrokes || []) {
    const name = stroke.rockName || stroke.rockType || 'Granite';
    counts[name] = (counts[name] || 0) + (stroke.points?.length || 1);
    if (stroke.alternateRockTypes && stroke.alternateRockTypes.length > 0) {
      for (const alt of stroke.alternateRockTypes) {
        counts[alt] = (counts[alt] || 0) + 2;
      }
    }
  }
  if (round?.alternateLithologyConfig?.enabled && round.alternateLithologyConfig.rockTypes?.length) {
    for (const rName of round.alternateLithologyConfig.rockTypes) {
      counts[rName] = (counts[rName] || 0) + 5;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { dominant: 'Not Mapped', secondary: [] };
  }
  return {
    dominant: sorted[0][0],
    secondary: sorted.slice(1, 4).map((s) => s[0]),
  };
}

function parseOverburdenFromRound(round: FieldExcavationRound, mappingDomain: MappingDomainType, heightM: number): {
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
      sourceLabel: `Recorded ${mappingDomain} Height / Depth (${heightM.toFixed(1)} m)`,
    };
  }
  // Estimate from Q-system SRF or default moderate tunnel cover, flagged clearly as Missing / Reference
  const srf = round.qSystem?.srf ?? 1.0;
  const estDepth = srf >= 5 ? 240 : srf >= 2.5 ? 140 : 85;
  return {
    valueM: estDepth,
    provenance: 'MISSING_INPUT',
    sourceLabel: 'Overburden depth not recorded in Face Round; using reference tunnel cover (editable)',
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
  const spanWidthM = Math.max(2.0, Number(location.widthM || 8.5));
  const totalHeightM = Math.max(2.0, Number(location.heightM || 7.5));
  const crossSectionAreaM2 =
    mappingDomain === 'TUNNEL'
      ? Math.PI * (spanWidthM / 2) * (totalHeightM / 2) * 0.86
      : spanWidthM * totalHeightM;
  const equivalentRadiusM = Number(Math.sqrt(crossSectionAreaM2 / Math.PI).toFixed(2));

  // 2. Lithology, Weathering, Classifications
  const lithoInfo = extractDominantLithologies(round);
  const refLitho = matchLithologyReference(
    lithoInfo.dominant === 'Not Mapped' ? 'Granite' : lithoInfo.dominant
  );
  const weatheringKey = round.weatheringIndex || 'WII';
  const wMod = WEATHERING_MODIFIERS[weatheringKey] || WEATHERING_MODIFIERS.WII;
  const strengthKey = round.strengthIndex || 'S3';
  const sInfo = ISRM_STRENGTH_UCS_MAP[strengthKey] || ISRM_STRENGTH_UCS_MAP.S3;

  const qRes = computeFieldQValue(round?.qSystem);
  const rmrRes = computeFieldRmrValue(round?.rmrSystem);
  const hasQ = qRes.qValue !== null;
  const hasRmr = rmrRes.totalRmr !== null;
  const hasGsi =
    round?.gsiValue !== null &&
    round?.gsiValue !== undefined &&
    Number(round.gsiValue) > 0;

  const safeQValue = qRes.qValue ?? (hasRmr ? Number(Math.exp((rmrRes.totalRmr! - 44) / 9).toFixed(2)) : 4.5);
  const safeRmrValue =
    rmrRes.totalRmr ??
    (hasGsi
      ? Math.min(100, Number(round.gsiValue) + 5)
      : hasQ
      ? Math.max(10, Math.min(100, Math.round(9 * Math.log(qRes.qValue!) + 44)))
      : 55);
  const gsiVal = Math.max(
    10,
    Math.min(
      95,
      Number(
        hasGsi
          ? round.gsiValue
          : hasRmr
          ? Math.max(15, rmrRes.totalRmr! - 5)
          : hasQ
          ? Math.max(15, Math.round(9 * Math.log(qRes.qValue!) + 39))
          : 50
      )
    )
  );

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
      ESWA_RECORDED: 'RECORDED IN ESWA',
      REFERENCE_ESTIMATED: 'ESTIMATED / COMMON REFERENCE VALUE',
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

  // 3. Resolve All Geotechnical Parameters
  const overburdenInfo = parseOverburdenFromRound(round, mappingDomain, totalHeightM);
  const pOverburden = resolveParam(
    'overburdenDepthM',
    'H',
    mappingDomain === 'TUNNEL' ? 'Overburden Depth / Rock Cover' : 'Excavation Slope / Bench Height',
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
    `Rock Mass Unit Weight (${lithoInfo.dominant}, ${weatheringKey})`,
    'intact_rock',
    Math.max(18.5, refLitho.unitWeightKnM3 + wMod.unitWeightDelta),
    'kN/m³',
    refLitho.unitWeightRange,
    'REFERENCE_ESTIMATED',
    `${refLitho.sourceCitation} — adjusted for ${wMod.label}`,
    `Reference unit weight for ${refLitho.rockFamily} reduced by ${Math.abs(wMod.unitWeightDelta).toFixed(1)} kN/m³ for ${weatheringKey} weathering.`
  );

  const defaultK0 = pOverburden.value < 60 ? 1.35 : pOverburden.value < 200 ? 1.15 : 0.85;
  const pK0 = resolveParam(
    'horizontalStressRatioK0',
    'K₀',
    'In-Situ Horizontal-to-Vertical Stress Ratio',
    'stress_hydraulic',
    cfg.horizontalStressRatioK0 ?? defaultK0,
    'ratio',
    '0.50 – 2.50',
    cfg.horizontalStressRatioK0 !== undefined ? 'ENGINEER_OVERRIDE' : 'REFERENCE_ESTIMATED',
    'Brown & Hoek (1978) World Stress Map Trends; Sheorey (1994)',
    'Assumes regional tectonic/gravity stress ratio K₀ = σh / σv. Replace with hydro-fracturing or overcoring data if available.',
    'σh = K₀ · σv'
  );

  // Pore water pressure derived from ESWA water marks & Q-system Jw / RMR water rating
  const waterMarksCount = (round.waterMarks || []).length;
  const hasFlowingWater = (round.waterMarks || []).some((w) =>
    w.condition.toLowerCase().includes('flowing') || w.condition.toLowerCase().includes('pressure')
  );
  const hasDrippingWater = (round.waterMarks || []).some((w) =>
    w.condition.toLowerCase().includes('dripping') || w.condition.toLowerCase().includes('wet')
  );
  const jw = round.qSystem?.jw ?? 1.0;
  let basePoreWaterKpa = 0;
  if (hasFlowingWater || jw <= 0.33) {
    basePoreWaterKpa = Math.min(600, pOverburden.value * 9.81 * 0.35);
  } else if (hasDrippingWater || jw <= 0.66 || waterMarksCount > 0) {
    basePoreWaterKpa = Math.min(250, pOverburden.value * 9.81 * 0.15);
  } else if ((round.rmrSystem?.waterRating ?? 15) < 15) {
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
    `Derived from ESWA Mapped Water Marks (${waterMarksCount} marks), Q-System Jw=${jw}, RMR Water Rating=${round.rmrSystem?.waterRating ?? 15}`,
    'Reduces effective normal stress (σn\' = σn - uw) along discontinuity planes and increases tunnel lining/bolt demand.',
    "σ'n = σn - u_w"
  );

  // Intact UCS: Blend ESWA Strength Index (S1-S6) + RMR UCS rating with Lithology/Weathering reference
  const rmrUcsRating = round.rmrSystem?.ucsRating ?? 7;
  const rmrEstimatedUcs =
    rmrUcsRating >= 15
      ? 220
      : rmrUcsRating >= 12
      ? 145
      : rmrUcsRating >= 7
      ? 75
      : rmrUcsRating >= 4
      ? 35
      : rmrUcsRating >= 2
      ? 15
      : 4;
  const blendedUcsMpa = Math.max(
    2.0,
    Number(((sInfo.midMpa * 0.55 + refLitho.ucsMpa * wMod.ucsFactor * 0.25 + rmrEstimatedUcs * 0.2)).toFixed(1))
  );

  const pIntactUcs = resolveParam(
    'intactUcsMpa',
    'σ_ci',
    `Intact Uniaxial Compressive Strength (${strengthKey})`,
    'intact_rock',
    blendedUcsMpa,
    'MPa',
    `${sInfo.range} | Ref: ${refLitho.ucsRange}`,
    'ESWA_RECORDED',
    `ESWA Field Strength Index ${sInfo.label} & RMR UCS Rating (${rmrUcsRating}), calibrated to ${refLitho.rockFamily} (${wMod.label})`,
    'Field hammer/point-load index estimate. Laboratory uniaxial compression testing (ASTM D7012 / ISRM) is recommended for final design.'
  );

  const pMi = resolveParam(
    'hoekBrownMi',
    'm_i',
    `Hoek–Brown Intact Rock Constant (${refLitho.rockFamily})`,
    'intact_rock',
    refLitho.mi,
    'dimensionless',
    refLitho.miRange,
    'REFERENCE_ESTIMATED',
    refLitho.sourceCitation,
    `Published Hoek–Brown frictional constant m_i for ${refLitho.rockFamily}. Triaxial cell testing required for site-specific m_i.`
  );

  const baseTensileMpa = Number((pIntactUcs.value / Math.max(6, pMi.value)).toFixed(2));
  const pTensile = resolveParam(
    'intactTensileMpa',
    'σ_t',
    'Intact Brazilian Tensile Strength',
    'intact_rock',
    baseTensileMpa,
    'MPa',
    '0.5 – 25.0 MPa',
    'REFERENCE_ESTIMATED',
    'Hoek & Brown (1997) Relationship σt ≈ σci / mi',
    'Estimated from intact UCS and Hoek–Brown constant mi. Controls tensile spalling at tunnel crown under low confinement.',
    'σ_t = σ_ci / m_i'
  );

  const baseEiGpa = Number(Math.max(1.0, refLitho.eiGpa * wMod.modulusFactor).toFixed(1));
  const pIntactEi = resolveParam(
    'intactModulusEiGpa',
    'E_i',
    `Intact Rock Young's Modulus (${lithoInfo.dominant})`,
    'intact_rock',
    baseEiGpa,
    'GPa',
    refLitho.eiRange,
    'REFERENCE_ESTIMATED',
    `${refLitho.sourceCitation} (Deere 1968 Modulus Ratio MR)`,
    `Intact rock deformation modulus prior to jointing reduction, scaled by weathering factor (${wMod.modulusFactor.toFixed(2)} for ${weatheringKey}).`
  );

  const pPoisson = resolveParam(
    'poissonRatio',
    'ν',
    "Rock Mass Poisson's Ratio",
    'intact_rock',
    refLitho.poissonRatio,
    'dimensionless',
    refLitho.poissonRange,
    'REFERENCE_ESTIMATED',
    refLitho.sourceCitation,
    'Elastic lateral strain ratio used in plane-strain Kirsch & Duncan Fama radial displacement equations.'
  );

  // Blast damage factor D from ESWA excavation mode
  const modeLower = (round.modeOfExcavation || '').toLowerCase();
  const defaultBlastD =
    modeLower.includes('tbm') || modeLower.includes('roadheader') || modeLower.includes('mechanical')
      ? 0.0
      : modeLower.includes('controlled') || modeLower.includes('smooth')
      ? 0.2
      : 0.35;

  const pBlastD = resolveParam(
    'blastDamageFactorD',
    'D',
    `Excavation Disturbance Factor (${round.modeOfExcavation || 'Drill & Blast'})`,
    'rock_mass_fem',
    cfg.blastDamageFactorD ?? defaultBlastD,
    '0.0 – 1.0',
    '0.0 (TBM/Mechanical) – 0.8 (Poor Blasting)',
    'ESWA_RECORDED',
    `Hoek, Carranza-Torres & Corkum (2002) Guidelines — derived from ESWA Mode: ${round.modeOfExcavation || 'Drill & Blast'}`,
    'D applies only to the blast-disturbed zone immediately surrounding the excavation boundary (typically 1.5–2.5m).',
    'Hoek-Brown (2002) Disturbance Factor D'
  );

  // Generalized Hoek-Brown (2002) & Hoek-Diederichs (2006) Rock Mass Properties
  const D = Math.max(0, Math.min(0.85, pBlastD.value));
  const mb = pMi.value * Math.exp((gsiVal - 100) / (28 - 14 * D));
  const s = Math.exp((gsiVal - 100) / (9 - 3 * D));
  const a = 0.5 + (1 / 6) * (Math.exp(-gsiVal / 15) - Math.exp(-20 / 3));

  // Simplified Hoek & Diederichs (2006) empirical rock mass modulus Erm
  const ermHoekDiederichsGpa =
    pIntactEi.value * (0.02 + (1 - D / 2) / (1 + Math.exp((60 + 15 * D - gsiVal) / 11)));

  const pErm = resolveParam(
    'rockMassModulusErmGpa',
    'E_rm',
    'Rock Mass Deformation Modulus',
    'rock_mass_fem',
    Math.max(0.25, ermHoekDiederichsGpa),
    'GPa',
    '0.5 – 65.0 GPa',
    'REFERENCE_ESTIMATED',
    `Hoek & Diederichs (2006) Empirical Correlation from ESWA GSI=${gsiVal}, Ei=${pIntactEi.value} GPa, D=${D}`,
    'Classification-derived rock mass modulus. Valid for isotropic/jointed continuum; may overestimate stiffness in highly foliated rock.',
    'E_rm = E_i · [0.02 + (1 - D/2) / (1 + exp((60 + 15D - GSI)/11))]'
  );

  // Equivalent Mohr-Coulomb (Hoek et al. 2002) for tunnel confining stress sigma3_max
  const sigmaV_Mpa = (pUnitWeight.value * pOverburden.value) / 1000;
  const sigmaH_Mpa = sigmaV_Mpa * pK0.value;
  const p0_Mpa = Number(((sigmaV_Mpa + sigmaH_Mpa) / 2).toFixed(3));

  const sigmaCmGlobalMpa =
    pIntactUcs.value *
    ((mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1)) /
    (2 * (1 + a) * (2 + a));
  const sigma3MaxMpa = Math.max(
    0.15,
    0.47 * sigmaCmGlobalMpa * Math.pow(sigmaCmGlobalMpa / Math.max(0.2, p0_Mpa), -0.94)
  );
  const sigma3n = sigma3MaxMpa / Math.max(1.0, pIntactUcs.value);

  const sinPhi =
    (6 * a * mb * Math.pow(s + mb * sigma3n, a - 1)) /
    (2 * (1 + a) * (2 + a) + 6 * a * mb * Math.pow(s + mb * sigma3n, a - 1));
  const phiRmDeg = Math.max(12, Math.min(62, (Math.asin(Math.min(0.92, sinPhi)) * 180) / Math.PI));

  const cohesionRmMpa =
    (pIntactUcs.value *
      ((1 + 2 * a) * s + (1 - a) * mb * sigma3n) *
      Math.pow(s + mb * sigma3n, a - 1)) /
    ((1 + a) * (2 + a) * Math.sqrt(1 + (6 * a * mb * Math.pow(s + mb * sigma3n, a - 1)) / ((1 + a) * (2 + a))));

  const pCohesionRm = resolveParam(
    'rockMassCohesionMpa',
    'c_rm',
    'Equivalent Rock Mass Cohesion',
    'rock_mass_fem',
    Math.max(0.05, cohesionRmMpa),
    'MPa',
    '0.05 – 12.0 MPa',
    'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Equivalent Mohr–Coulomb Fit (GSI=${gsiVal}, σci=${pIntactUcs.value} MPa)`,
    'Stress-dependent tangent/secant fit over 0 < σ3 < σ3max. Do not extrapolate outside the current overburden stress range.',
    'Hoek, Carranza-Torres & Corkum (2002) Eq. 4'
  );

  const pFrictionRm = resolveParam(
    'rockMassFrictionDeg',
    'φ_rm',
    'Equivalent Rock Mass Friction Angle',
    'rock_mass_fem',
    phiRmDeg,
    '°',
    '15° – 58°',
    'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Equivalent Mohr–Coulomb Fit (GSI=${gsiVal}, mi=${pMi.value})`,
    'Continuum equivalent internal friction angle for elastoplastic yield zone evaluation.',
    'Hoek, Carranza-Torres & Corkum (2002) Eq. 5'
  );

  const pScm = resolveParam(
    'rockMassStrengthScmMpa',
    'σ_cm',
    'Global Rock Mass Uniaxial Strength',
    'rock_mass_fem',
    Math.max(0.2, sigmaCmGlobalMpa),
    'MPa',
    '0.2 – 85.0 MPa',
    'REFERENCE_ESTIMATED',
    `Generalized Hoek–Brown (2002) Global Strength from GSI=${gsiVal}, σci=${pIntactUcs.value} MPa`,
    'Represents overall rock mass compressive capacity for pillar and tunnel wall squeezing evaluation (σcm / p0).',
    'Hoek et al. (2002) Eq. 9'
  );

  // 4. Discontinuity / Joint Parameters from ESWA Sets + Barton-Bandis
  const activeSetIds = FIELD_JOINT_SET_IDS.filter(
    (setId) =>
      (round?.jointTraces || []).some((j) => j.setId === setId) ||
      (round?.dipPlaneSurfaces || []).some((d) => d.setId === setId) ||
      round?.discontinuitySets?.[setId]?.manualOrientationOverride
  );
  const effectiveSetIds: FieldJointSetId[] = activeSetIds.length > 0 ? activeSetIds : ['J1', 'J2'];

  const jrVal = round.qSystem?.jr ?? 1.5;
  const jaVal = round.qSystem?.ja ?? 2.0;
  // Barton (1987) correlation between Jr and JRC
  const derivedJrc = Math.max(2, Math.min(18, jrVal >= 3 ? 14 : jrVal >= 2 ? 10 : jrVal >= 1.5 ? 8 : 5));
  const derivedJcsMpa = Math.max(5, Number((pIntactUcs.value * wMod.ucsFactor * 0.78).toFixed(1)));
  // Barton (2002) frictional mobilization tan^-1(Jr/Ja) bounded with basic friction
  const qJointFrictionDeg = (Math.atan(jrVal / Math.max(0.75, jaVal)) * 180) / Math.PI;
  const derivedJointFrictionDeg = Math.max(
    16,
    Math.min(44, Number(((refLitho.basicFrictionDeg + wMod.frictionDeltaDeg) * 0.65 + qJointFrictionDeg * 0.35).toFixed(1)))
  );

  // Joint infilling cohesion from ESWA set records
  const firstSet = round.discontinuitySets?.[effectiveSetIds[0]];
  const infillingText = (firstSet?.infilling || '').toLowerCase();
  const apertureText = (firstSet?.aperture || '').toLowerCase();
  const baseJointCohesionKpa = infillingText.includes('soft') || infillingText.includes('clay')
    ? 15
    : infillingText.includes('none') || infillingText.includes('tight')
    ? 45
    : 28;

  const pJointJrc = resolveParam(
    'jointJrc',
    'JRC',
    'Joint Roughness Coefficient (Barton)',
    'joint_dem',
    derivedJrc,
    '0 – 20',
    '2 (Slickensided) – 18 (Rough Undulating)',
    'ESWA_RECORDED',
    `Derived from ESWA Discontinuity Roughness (${firstSet?.roughness || 'Slightly rough'}) & Q-System Jr=${jrVal}`,
    'Barton & Choubey (1977) roughness profile index. Scale effect reduces JRCn on long joint planes (>1m).',
    'Barton & Bandis (1982) JRC_n = JRC_0 · (L_n / L_0)^(-0.02·JRC_0)'
  );

  const pJointJcs = resolveParam(
    'jointJcsMpa',
    'JCS',
    'Joint Wall Compressive Strength',
    'joint_dem',
    derivedJcsMpa,
    'MPa',
    '5 – 180 MPa',
    'REFERENCE_ESTIMATED',
    `Barton & Choubey (1977) Schmidt Hammer Wall Correlation from σci=${pIntactUcs.value} MPa & Weathering ${weatheringKey}`,
    'Weathering on joint walls reduces JCS below intact rock UCS (JCS ≈ 0.35–0.85 σci).',
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
    'ESWA_RECORDED',
    `Derived from ESWA Q-System (Jr=${jrVal}, Ja=${jaVal}), Infilling (${firstSet?.infilling || 'Clean'}) & ${refLitho.rockFamily} Reference`,
    'Controls block sliding resistance along mapped joint traces in DEM limit-equilibrium analysis.'
  );

  const pJointCohesion = resolveParam(
    'jointCohesionKpa',
    'c_j',
    'Discontinuity Apparent Cohesion / Interlock',
    'joint_dem',
    baseJointCohesionKpa,
    'kPa',
    '0 – 150 kPa',
    'REFERENCE_ESTIMATED',
    `Barton & Bandis (1990) & ESWA Joint Condition (${firstSet?.infilling || 'None'}, Aperture: ${firstSet?.aperture || '0.1-1.0mm'})`,
    'Apparent cohesion from surface asperity interlock and cementation; reduces to zero upon large shear displacement.'
  );

  // Bandis et al. (1983) Joint Normal & Shear Stiffness
  const avgSpacingM = firstSet?.spacing?.includes('>2')
    ? 2.2
    : firstSet?.spacing?.includes('0.6')
    ? 1.0
    : firstSet?.spacing?.includes('0.2')
    ? 0.38
    : 0.55;
  const avgApertureMm = apertureText.includes('>5')
    ? 6.0
    : apertureText.includes('1-5')
    ? 2.2
    : apertureText.includes('0.1-1')
    ? 0.45
    : 0.2;

  const baseKnGpaM = Number(Math.max(1.5, Math.min(45, (pErm.value / Math.max(0.15, avgSpacingM)) * 1.4)).toFixed(2));
  const baseKsGpaM = Number(Math.max(0.5, baseKnGpaM * 0.32).toFixed(2));

  const pJointKn = resolveParam(
    'jointNormalStiffnessKnGpaM',
    'k_n',
    'Joint Normal Stiffness (Bandis Hyperbolic)',
    'joint_dem',
    baseKnGpaM,
    'GPa/m',
    '2.0 – 50.0 GPa/m',
    'REFERENCE_ESTIMATED',
    `Bandis, Lumsden & Barton (1983) from Erm=${pErm.value.toFixed(1)} GPa, Spacing=${avgSpacingM}m, Aperture=${avgApertureMm}mm`,
    'Controls joint closure under compression and normal relaxation opening near the excavation boundary.',
    'k_n = k_ni / (1 - ΔV_j / V_m)²'
  );

  const pJointKs = resolveParam(
    'jointShearStiffnessKsGpaM',
    'k_s',
    'Joint Shear Stiffness (Barton–Bandis)',
    'joint_dem',
    baseKsGpaM,
    'GPa/m',
    '0.5 – 20.0 GPa/m',
    'REFERENCE_ESTIMATED',
    'Bandis et al. (1983); Itasca UDEC Reference Manual (ks ≈ 0.25–0.40 kn)',
    'Governs elastic shear slip along discontinuities prior to peak shear mobilization.'
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
    const tunnelPerimM = spanWidthM * 2 + totalHeightM;
    const pullLenM = Math.max(1.0, round.pullLengthMeters || 3.0);
    const addedPressureMpa = totalSpotTensileKn / Math.max(1, tunnelPerimM * pullLenM * 1000);
    spotBoltsPressureMpa = Number(Math.min(0.12, Math.max(0.015 * spotBoltsCount, addedPressureMpa)).toFixed(3));
    activeSystemsSummary.push(`${spotBoltsCount} Targeted Spot Bolt(s) (${Math.round(totalSpotTensileKn)} kN cap)`);
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
    shotcretePressureMpa =
      0.5 * fckShotcreteMpa * (1 - Math.pow(Math.max(0.5, equivalentRadiusM - tcM), 2) / Math.pow(equivalentRadiusM, 2));
    shotcreteStiffnessMpaPerM =
      (ecShotcreteMpa * r2_tc2) /
      ((1 + nuC) * ((1 - 2 * nuC) * Math.pow(equivalentRadiusM, 2) + Math.pow(equivalentRadiusM - tcM, 2)) * equivalentRadiusM);
    activeSystemsSummary.push(
      `${sup.shotcreteType || 'SFRS'} Shotcrete ${shotcreteThickMm}mm (${sup.shotcreteScope === 'crown_only' ? 'Crown' : 'Crown+Wall'})`
    );
  }

  let steelSetOrLatticePressureMpa = 0;
  let steelSetOrLatticeStiffnessMpaPerM = 0;
  if (sup.latticeGirderEnabled) {
    const lgSpM = Math.max(0.4, Number(sup.latticeGirderSpacingM || 1.2));
    steelSetOrLatticePressureMpa += 0.22 / lgSpM;
    steelSetOrLatticeStiffnessMpaPerM += 95 / lgSpM;
    activeSystemsSummary.push(`Lattice Girder (${sup.latticeGirderSpec || '3-Bar LG'}) @ ${lgSpM}m c/c`);
  }
  if (sup.ismbEnabled) {
    const ismbSpM = Math.max(0.4, Number(sup.ismbSpacingM || 1.0));
    steelSetOrLatticePressureMpa += 0.38 / ismbSpM;
    steelSetOrLatticeStiffnessMpaPerM += 165 / ismbSpM;
    activeSystemsSummary.push(`Steel Rib (${sup.ismbSpec || 'ISMB 150'}) @ ${ismbSpM}m c/c`);
  }

  let wireMeshRetentionKpa = 0;
  if (sup.wireMeshEnabled) {
    wireMeshRetentionKpa = 35;
    activeSystemsSummary.push(`Wire Mesh (${sup.wireMeshType || 'Welded 100×100×6mm'})`);
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

    if (piMpa < pCrMpa && kCoeff > 1.01) {
      const num = 2 * (effectiveP0Mpa * (kCoeff - 1) + sigmaCmEffective);
      const den = (kCoeff + 1) * ((kCoeff - 1) * Math.max(0.005, piMpa) + sigmaCmEffective);
      const ratio = Math.pow(Math.max(1.0, num / Math.max(0.01, den)), 1 / (kCoeff - 1));
      rpM = Math.min(equivalentRadiusM * 3.8, equivalentRadiusM * ratio);
    }

    const plasticDepthM = Math.max(0, rpM - equivalentRadiusM);
    // Radial displacement at boundary (Duncan Fama 1993 elastoplastic radial convergence)
    const elasticDispM =
      ((1 + nu) / ermMpa) * (effectiveP0Mpa - piMpa) * equivalentRadiusM;
    const radialDispM =
      rpM > equivalentRadiusM * 1.005
        ? ((1 + nu) / ermMpa) *
          (sigmaCmEffective / 2 + ((kCoeff - 1) / (kCoeff + 1)) * (effectiveP0Mpa - pCrMpa)) *
          equivalentRadiusM *
          Math.pow(rpM / equivalentRadiusM, 2)
        : Math.max(0.0002, elasticDispM);

    // Anisotropy adjustment for crown vs sidewall using K0
    const k0 = pK0.value;
    const crownFactor = Math.max(0.75, Math.min(1.45, 0.65 + 0.35 * k0));
    const wallFactor = Math.max(0.75, Math.min(1.45, 1.35 - 0.35 * k0));

    const crownDispMm = Number((radialDispM * 1000 * crownFactor).toFixed(2));
    const wallDispMm = Number((radialDispM * 1000 * wallFactor).toFixed(2));
    const maxDispMm = Number(Math.max(crownDispMm, wallDispMm).toFixed(2));
    const convergencePct = Number((((maxDispMm * 2) / (spanWidthM * 1000)) * 100).toFixed(3));

    // Max tangential stress at elastic-plastic interface or boundary
    const maxSigmaThetaMpa = Number(
      (rpM > equivalentRadiusM
        ? 2 * effectiveP0Mpa - pCrMpa
        : effectiveP0Mpa * (1 + k0) + 2 * effectiveP0Mpa * Math.abs(1 - k0) - piMpa
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

  // 7. Generate 2D Boundary-Fitted TRIANGULAR Finite Element Mesh around the Exact Fed ESWA Tunnel Profile
  const svgW = 560;
  const svgH = 440;
  const cx = svgW / 2;
  const cy = svgH * 0.54;
  const boxW = 184;
  const boxH = Math.round(boxW * Math.min(1.25, Math.max(0.72, totalHeightM / spanWidthM)));
  const boxX = cx - boxW / 2;
  const boxY = cy - boxH / 2;

  // Obtain exact fed tunnel outline from ESWA fieldMappingEngine
  const faceOutlineDetails = computeFaceTunnelOutlineDetails(
    location,
    boxX,
    boxY,
    boxW,
    boxH
  );
  const tunnelClosedPathD = faceOutlineDetails.closedFillPathD;
  const tunnelSplY = faceOutlineDetails.springY;

  // Build dense closed perimeter polyline following the exact fed tunnel shape:
  // Left Wall (bottom->SPL) -> Crown Arch (left SPL->right SPL) -> Right Wall (SPL->bottom) -> Invert (right->left)
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

  if (
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

  // Assign lithology zones and compute 3-node CST Triangular Finite Elements
  const allLithoNames = [lithoInfo.dominant, ...lithoInfo.secondary];
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

  // Compute boundary-fitted Rock Bolt vectors along the fed tunnel Left Wall, Crown Arch, and Right Wall
  const boltScalePx = boxW / Math.max(1, spanWidthM);
  const boltLenPx = Math.min(92, Math.max(24, boltLenM * boltScalePx));
  const supportBoltVectorsSvg: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    zone: 'crown' | 'wall';
  }[] = [];

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

    const lithoIdx =
      allLithoNames.length > 1
        ? Math.floor(((centroidSvg.y - 60) / 320) * allLithoNames.length) %
          allLithoNames.length
        : 0;
    const elemLitho = allLithoNames[Math.max(0, lithoIdx)] || lithoInfo.dominant;
    const elemLithoRef = matchLithologyReference(elemLitho);

    const directionalFactor =
      1 + 0.25 * (1 - pK0.value) * Math.cos(2 * angleRad);

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
      lithologyColor: elemLithoRef.colorHex,
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

  // Map actual traced joints from ESWA round + synthesize representative joint set planes in the surrounding rock mass
  const tracedJoints = round.jointTraces || [];
  tracedJoints.slice(0, 18).forEach((jt, idx) => {
    if (!jt.points || jt.points.length < 2) return;
    const pStart = jt.points[0];
    const pEnd = jt.points[jt.points.length - 1];
    const setRec = round.discontinuitySets?.[jt.setId];
    const dipDeg = jt.dipAmount || (setRec ? (setRec.dipAmountFrom + setRec.dipAmountTo) / 2 : 65);
    const dipDirDeg = jt.dipDirection || (setRec ? (setRec.dipDirectionFrom + setRec.dipDirectionTo) / 2 : 135);

    // Map trace into surrounding cross-section coordinates
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
      Math.max(1.2, Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) / 38).toFixed(2)
    );

    const sigmaNormalMpa = Math.max(0.12, effectiveP0Mpa * (0.45 + 0.35 * Math.pow(Math.cos(angleRad), 2)) - pPoreWater.value / 1000);
    const tauDrivingMpa = Math.max(0.05, effectiveP0Mpa * 0.38 * Math.abs(Math.sin(2 * angleRad)));

    // Barton-Choubey peak shear strength
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
          lengthMeters: 2.8,
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
        const pinsThisBlock =
          (zone === 'Crown Arch' && (sb.panel === 'crown' || (sb.yMeters ?? 0) > totalHeightM * 0.75)) ||
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
      if (spotBoltBlockResistKn === 0 && spotBoltsCount > 0) {
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

  const demKeyBlocks: DemKeyBlock2D[] = [
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
      title: '1. Continuum Elastoplastic Solution (FEM Representation)',
      formulaSummary:
        'Generalized Hoek–Brown (2002) & Duncan Fama (1993) / Carranza-Torres & Fairhurst (2000) closed-form elastoplastic convergence-confinement solution mapped onto a 2D boundary-fitted mesh with Kirsch directional stress factors.',
      referenceCitation: 'Hoek, Carranza-Torres & Corkum (2002); Hoek & Diederichs (2006)',
      limitationNote:
        'Assumes equivalent isotropic continuum behavior within each lithology sector. Valid for preliminary design and convergence-confinement verification; does not replace full 3D nonlinear time-dependent creep FEA.',
    },
    {
      title: '2. Discontinuum Block & Joint Mechanics (DEM Representation)',
      formulaSummary:
        'Goodman & Shi (1985) 2D kinematic key-block limit-equilibrium combined with Barton–Choubey (1977) nonlinear joint shear strength and Bandis et al. (1983) hyperbolic normal/shear joint stiffness.',
      referenceCitation: 'Goodman & Shi (1985); Barton & Choubey (1977); Bandis et al. (1983)',
      limitationNote:
        'Evaluates plane-strain perimeter wedges and joint slip from mapped ESWA traces and sets. Assumes rigid-block limit equilibrium with elastic joint compliance prior to detachment.',
    },
    {
      title: '3. Empirical Classification Correlations (RMR, Q, GSI)',
      formulaSummary:
        'GSI, RMR89, and Q-system ratings recorded in ESWA are used ONLY with documented empirical transformations (Hoek & Diederichs 2006 for Erm; Barton 2002 for Jr/Ja joint friction) and are never treated as direct substitutes for laboratory test data.',
      referenceCitation: 'Bieniawski (1989); Barton (2002); Marinos & Hoek (2000)',
      limitationNote:
        'All literature-derived parameters are explicitly badged as ESTIMATED / COMMON REFERENCE VALUE and should be calibrated with site laboratory UCS/triaxial testing and convergence monitoring.',
    },
  ];

  // Evaluate strict engineering prerequisites
  const hasClassification = hasRmr || hasQ || hasGsi;
  const hasMappedLithology =
    lithoInfo.dominant !== 'Not Mapped' ||
    Boolean(round?.alternateLithologyConfig?.enabled);
  const hasWeatheringAndStrength = Boolean(round?.weatheringIndex && round?.strengthIndex);
  const hasUcsInput =
    Boolean(round?.strengthIndex) ||
    (round?.rmrSystem?.ucsRating !== null && round?.rmrSystem?.ucsRating !== undefined) ||
    overrides.intactUcsMpa !== undefined ||
    siteTests.intactUcsMpa !== undefined;
  const hasRockStrengthOrLithology =
    (hasMappedLithology || Boolean(round?.weatheringIndex)) && hasUcsInput;
  const hasOverburden =
    overburdenInfo.provenance !== 'MISSING_INPUT' ||
    overrides.overburdenDepthM !== undefined ||
    siteTests.overburdenDepthM !== undefined;
  const hasDiscontinuitiesForDem =
    (round?.jointTraces || []).length > 0 ||
    (round?.dipPlaneSurfaces || []).length > 0 ||
    Object.values(round?.discontinuitySets || {}).some(
      (st) => st.enabled && (st.dipAmountFrom > 0 || st.dipAmountTo > 0 || Boolean(st.spacing))
    );

  const missingBeforeRequirements: string[] = [];
  if (!hasClassification) {
    missingBeforeRequirements.push(
      'Rock Mass Classification Not Assessed: Complete Bieniawski RMR89 (all 6 parameters), Barton Q-System (all 6 parameters), or Hoek–Marinos GSI Sheet in Stage 7 (Q / RMR / GSI).'
    );
  }
  if (!hasMappedLithology && !round?.weatheringIndex) {
    missingBeforeRequirements.push(
      'Lithology / Weathering Missing: Map rock lithology on the Face Canvas OR select ISRM Weathering Grade (WI–WVI) in Stage 6 (Discontinuity Sets).'
    );
  }
  if (!hasUcsInput) {
    missingBeforeRequirements.push(
      'Intact Rock Strength (UCS / S1–S6) Missing: Select ISRM Rock Strength Index (S1–S6) in Stage 6, select RMR89 UCS Rating in Stage 7, or enter Intact UCS σ_ci (MPa) in the parameter bar.'
    );
  }
  if (!hasOverburden) {
    missingBeforeRequirements.push(
      'In-Situ Overburden Depth H (m) Not Entered: Enter the tunnel rock cover / overburden depth H (m) in the quick-input bar above to compute vertical in-situ stress (σ_v = γ·H).'
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
    excavationShapeLabel: (location?.shape || 'd_shaped').replace(/_/g, ' ').toUpperCase(),
    spanWidthM,
    totalHeightM,
    equivalentRadiusM,
    dominantLithology: lithoInfo.dominant,
    secondaryLithologies: lithoInfo.secondary,
    weatheringGrade: round.weatheringIndex ? wMod.label : 'Not Selected',
    strengthGrade: round.strengthIndex ? sInfo.label : 'Not Selected',
    qValue: qRes.qValue,
    qClass: qRes.rockClass || 'Not Assessed',
    rmrValue: rmrRes.totalRmr,
    rmrClass: rmrRes.rmrClass || 'Not Assessed',
    gsiValue: hasGsi ? Number(round.gsiValue) : hasClassification ? gsiVal : null,
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

    <h2>1. Excavation Geometry, Geological Model &amp; Rock Mass Classifications</h2>
    <table>
      <tr>
        <th>Excavation Profile &amp; Dimensions</th>
        <td>${result.excavationShapeLabel} (${result.spanWidthM.toFixed(2)}m Span × ${result.totalHeightM.toFixed(2)}m Height; R_eq = ${result.equivalentRadiusM.toFixed(2)}m)</td>
        <th>Dominant Lithology &amp; Weathering</th>
        <td>${result.dominantLithology} (${result.weatheringGrade}, ${result.strengthGrade})</td>
      </tr>
      <tr>
        <th>Recorded ESWA Classifications</th>
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
          <td>-${(result.femBefore.maxDisplacementMm - result.femAfter.maxDisplacementMm).toFixed(2)} mmconvergence reduction</td>
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

    <h2>5. Material Properties, Reference Sources &amp; Parameter Provenance</h2>
    <p style="font-size:9pt;color:#475569;">
      Values badged as <strong>ESTIMATED / COMMON REFERENCE VALUE</strong> are derived from published geotechnical engineering references for the mapped lithology and weathering grade and are not site laboratory measurements.
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
