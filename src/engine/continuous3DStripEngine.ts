import {
  GsiParameters,
  Joint,
  JointSet,
  LithologyRegion,
  OverbreakUndercutAnalysis,
  PhotoSurface,
  PlacedGeologicalSymbol,
  Point2D,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  SavedProjectRecord,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { calculateBartonQSystem } from './photoWarpEngine';
import { calculateBieniawskiRmr } from './rockMassClassificationEngine';
import {
  calculatePlaneSurfaceIntersections,
  constructJointPlane,
  deriveAnchorPointFromPoints,
  TunnelSpatialGeometry,
} from './joint3DInspectorEngine';
import {
  loadFieldMappingStore,
  computePhysicalMetricPoints,
  FieldProjectItem,
  FieldTunnelLocationItem,
  FieldExcavationRound,
  FieldJointTrace,
} from './fieldMappingEngine';
import { matchLithologyReference } from './femDemAnalysisEngine';

export type { Point2D };

export type StripRockTypeId =
  | 'Quartzite'
  | 'Phyllite'
  | 'Metasandstone'
  | 'Mica Schist'
  | 'Quartzitic Phyllite'
  | 'Phyllitic Quartzite'
  | 'Siltstone'
  | 'Shale'
  | 'Quartz veins'
  | 'Dolerite'
  | 'Qtz'
  | 'Ph'
  | 'QP'
  | 'Gr'
  | 'Gn'
  | 'Sch'
  | 'Ss'
  | 'Sl'
  | 'Ls'
  | 'Bas'
  | 'FaultGouge'
  | (string & {});

export type StripFillingThicknessId =
  | 'None'
  | 'Clay Coated'
  | 'Thin'
  | '2~5cm'
  | '5~10cm'
  | '>10cm'
  | (string & {});

export type StripStructureTypeId =
  | 'JS1 - Foliation'
  | 'JS2 - Main Joint'
  | 'JS3 - Main Joint'
  | 'Secondary Joint'
  | 'Shear Joint (5-30mm)'
  | 'Shear Zone'
  | 'Fault'
  | 'Major Fault'
  | 'Gouge/Clay Seam'
  | 'Vertical Joint'
  | 'Geological Boundary'
  | 'Lithological Boundary'
  | 'Bedding'
  | 'Bedding/Foliation'
  | 'Joint'
  | 'Foliation'
  | 'Joint Plane/Surface'
  | 'Fractured'
  | (string & {});

export type StripGroundwaterId =
  | 'Dry'
  | 'Moist/Damp'
  | 'Wet'
  | 'Dripping'
  | 'Flowing';

export interface ContinuousStripTrace {
  id: string;
  structureType: StripStructureTypeId;
  setId: string;
  /** Dip direction (0-360) and dip range label e.g. "205/70-75" or "065/45" */
  orientationLabel: string;
  dipDirectionDeg: number;
  dipDeg: number;
  fillingThickness: StripFillingThicknessId;
  /** Current active points (or AI-aligned points when AI align is committed) */
  points: Point2D[];
  /** Original raw photo-traced points before AI trend alignment (shows kinks/offsets across pulls) */
  rawPoints?: Point2D[];
  /** AI trend-aligned smooth points across pull boundaries */
  aiAlignedPoints?: Point2D[];
  /** Source unwrapped surface ('leftWall' | 'crown' | 'rightWall' | 'shaft_sn' | 'face') */
  sourceSurface?: 'leftWall' | 'crown' | 'rightWall' | 'shaft_sn' | 'face';
  /** Exact normalized (0..1, 0..1) image UV coordinates from the 2D unwrapped surface */
  uvPoints?: Point2D[];
  /** Metric (x, y) coordinates remembered by pull, height, and width */
  metricCoordinates?: {
    pullLengthM: number;
    wallHeightM: number;
    widthM: number;
    crownArcM: number;
    localPoints: { x: number; y: number }[];
  };
  colorHex?: string;
  roughness?: string;
  jrc?: number;
  jcsMpa?: number;
  infilling?: string;
  apertureMm?: string;
  waterCondition?: string;
  dipTickSide?: 'left' | 'right';
  faultSubType?: 'normal' | 'reverse' | 'strike_slip' | 'thrust';
  faultElementRole?: 'main_fault' | 'hanging_wall' | 'footwall';
  showHwFw?: boolean;
  flipHwFw?: boolean;
  foldSubType?: 'anticline' | 'syncline' | 'monocline';
  foldElementRole?: 'crest' | 'limb_left' | 'limb_right' | 'axis';
  showFoldCrest?: boolean;
  showFoldLimbs?: boolean;
  /** Custom label / text override for the trace on canvas (e.g. 'J1 - Main Joint', 'Fault Splay') */
  customLabel?: string;
  /** When true, hide the text / label on canvas (or deleted text) */
  hideLabel?: boolean;
  /** Custom notes or annotation text */
  customText?: string;
  /** Optional custom offset for text callout on canvas */
  labelOffset?: { dx: number; dy: number };
}

export interface ContinuousStripLithologyZone {
  id: string;
  rockType: StripRockTypeId;
  codeSymbol?: string; // e.g. 'Qtz', 'Ph', 'Mm', 'Ms', 'QP', 'PQ'
  label: string;
  polygon: Point2D[];
  isIntrusionBody?: boolean;
  isFracturedZone?: boolean;
}

export interface ContinuousStripWaterSymbol {
  id: string;
  condition: StripGroundwaterId;
  position: Point2D;
  label?: string;
}

export interface ContinuousPullRecord {
  id: string;
  fromRd: number;
  toRd: number;
  /** True field drive azimuth (0-360 deg N, supports 1° turns) */
  driveAzimuthDeg: number;
  /** Tunnel gradient in % e.g. 0.166 */
  gradientPct?: number;
  /** Opposite/reference wall azimuth */
  leftBoundaryAzimuthDeg: number;
  /** Convergence-Divergence max recorded (mm), e.g. "-2mm" */
  convergenceMm?: string;
  rockType: string;
  rockDescription?: string;
  rockClass: string;
  weatheringCondition: string;
  ucsRangeMpa: string;
  rmrValue?: number;
  rqdValue?: number;
  qValue?: number;
  gsiValue?: number;
  seepageCondition: string;
  structureDescription?: string;
  foliationCharacteristics?: string;
  overbreakVolumeM3?: number;
  excavationDefiningNo?: string;
  excavationDate?: string;
  supportClass?: string;
  shotcreteInstalled?: string;
  wireMeshInstalled?: string;
  rockBoltsInstalled?: string;
  steelRibsInstalled?: string;
  forepolingInstalled?: string;
  photoRollNo?: string;
  photoNegativeNo?: string;
  remarks?: string;
  supportDescription: string;
  status: 'MAPPED' | 'MISSING_GAP';
  linkedSavedProjectId?: string;
  linkedFieldRoundId?: string;
  dateMapped?: string;
  overburdenDepthM?: number;
  intactUcsMpa?: number;
  boltLengthM?: number;
  boltSpacingM?: number;
  shotcreteThicknessMm?: number;
  steelRibSpacingM?: number;
  supportPressureMpa?: number;
  excavationApproach?: string;
  benchHeightM?: number;
  shaftHalfSide?: 'left_half' | 'right_half';
  shaftCenterMedianStatus?: 'closed' | 'open';
  /** Exact unwrapped photos for Left Wall, Crown Arch, Right Wall, and 4th Shaft Quadrant at this pull */
  surfacePhotos?: {
    leftWall?: string;
    crown?: string;
    rightWall?: string;
    shaft_sn?: string;
  };
}

export interface SheetCustomizationConfig {
  logoPlacement: 'TITLE_BLOCK' | 'TOP_BANNER' | 'BOTH';
  clientLogoText: string;
  clientSubtitle: string;
  projectTitleLine1: string;
  projectTitleLine2: string;
  consultantName: string;
  contractorName: string;
  clientLogoUrl?: string;
  consultantLogoUrl?: string;
  contractorLogoUrl?: string;
  drawingScaleLabel: string;
  drawingNumber: string;
  compiledBy: string;
  drawnBy: string;
  checkedBy: string;
  approvedBy: string;
  showConvergenceRow: boolean;
  showRmrRqdGraph: boolean;
  showOverbreakRow: boolean;
  showSupportDetailsRows: boolean;
  showPhotoRecordsRow: boolean;
  showKeyPlan: boolean;
  autoAdaptRowHeights: boolean;
}

export interface TunnelIntersectionConfig {
  /** ID of the parent/main tunnel dataset that this branch/adit/slashing connects to */
  parentDatasetId: string;
  /** Chainage (m) on the parent tunnel where this branch tunnel intersects */
  parentJunctionRd: number;
  /** Which wall/boundary of the parent strip this tunnel attaches to */
  attachWall: 'RIGHT_WALL' | 'LEFT_WALL' | 'PARALLEL_SEAM';
  /** Own chainage (m) at the junction portal (usually 0) */
  ownJunctionRd: number;
  /** Portal collar width in meters along the parent tunnel wall */
  portalWidthM: number;
  /** Label shown at the intersection portal ring */
  junctionLabel?: string;
}

export interface ContinuousStripCustomAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color?: string;
}

export interface ContinuousTunnelStripDataset {
  id: string;
  excavationMode?: 'TUNNEL' | 'SHAFT';
  shaftSubMode?: 'FULL_CIRCLE' | 'HALF_CIRCLE_LEFT' | 'HALF_CIRCLE_RIGHT';
  shaftCenterMedianStatus?: 'closed' | 'open';
  shaftDiameterM?: number;
  shaftQuadrantArcLengthM?: number;
  excavationApproach?: 'full_face' | 'top_heading_and_benching' | 'top_heading' | 'benching' | 'half_face';
  benchHeightM?: number;
  projectName: string;
  tunnelLocationName: string;
  clientName: string;
  contractorName: string;
  geologistContractor: string;
  geologistClient: string;
  upperZoneLabel: string;
  lowerZoneLabel: string;
  upperZoneWidthM: number;
  lowerZoneWidthM: number;
  leftWallArcLengthM?: number;
  crownArcLengthM?: number;
  rightWallArcLengthM?: number;
  shaftSnArcLengthM?: number;
  leftWallHeightM?: number;
  crownWidthM?: number;
  rightWallHeightM?: number;
  tunnelDiameterWidthM?: number;
  tunnelArchHeightM?: number;
  overburdenDepthM?: number;
  viewFromRd: number;
  viewToRd: number;
  leftCornerAzimuthLabel: string;
  rightCornerAzimuthLabel: string;
  pulls: ContinuousPullRecord[];
  traces: ContinuousStripTrace[];
  lithologyZones: ContinuousStripLithologyZone[];
  waterSymbols: ContinuousStripWaterSymbol[];
  customAnnotations?: ContinuousStripCustomAnnotation[];
  narrativeBullets: string[];
  sheetConfig?: SheetCustomizationConfig;
  intersectionConfig?: TunnelIntersectionConfig;
  reviewStatus?: 'DRAFT' | 'SUBMITTED_FOR_REVIEW' | 'REVIEWED' | 'APPROVED';
  submittedAt?: string;
  reviewerDeviceId?: string;
  reviewerName?: string;
  reviewerNotes?: string;
  approvedAt?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'eswa_continuous_3d_strip_datasets_v20_fresh';

export function getDefaultSheetConfig(
  dataset?: Partial<ContinuousTunnelStripDataset>
): SheetCustomizationConfig {
  return {
    logoPlacement: 'TITLE_BLOCK',
    clientLogoText: dataset?.clientName || '',
    clientSubtitle: '',
    projectTitleLine1: dataset?.projectName || '',
    projectTitleLine2: '',
    consultantName: '',
    contractorName: dataset?.contractorName || '',
    drawingScaleLabel: '1:100',
    drawingNumber: '',
    compiledBy: '',
    drawnBy: '',
    checkedBy: '',
    approvedBy: '',
    showConvergenceRow: true,
    showRmrRqdGraph: true,
    showOverbreakRow: true,
    showSupportDetailsRows: true,
    showPhotoRecordsRow: true,
    showKeyPlan: true,
    autoAdaptRowHeights: true,
  };
}

/**
 * Clean blank default workspace dataset (No example or demo records)
 */
export function createFreshDefaultStripDataset(): ContinuousTunnelStripDataset {
  return {
    id: 'dataset-fresh-workspace',
    projectName: '',
    tunnelLocationName: '',
    clientName: '',
    contractorName: '',
    geologistContractor: '',
    geologistClient: '',
    upperZoneLabel: 'LEFT WALL TO CROWN (SPRING LINE)',
    lowerZoneLabel: 'CROWN TO RIGHT WALL (SPRING LINE)',
    upperZoneWidthM: 7.5,
    lowerZoneWidthM: 7.5,
    leftWallArcLengthM: 3.75,
    crownArcLengthM: 7.5,
    rightWallArcLengthM: 3.75,
    leftWallHeightM: 3.75,
    crownWidthM: 7.5,
    rightWallHeightM: 3.75,
    tunnelDiameterWidthM: 8.4,
    tunnelArchHeightM: 7.2,
    viewFromRd: 0,
    viewToRd: 3.5,
    leftCornerAzimuthLabel: '180°N',
    rightCornerAzimuthLabel: '000°N',
    pulls: [],
    traces: [],
    lithologyZones: [],
    waterSymbols: [],
    narrativeBullets: [],
    sheetConfig: getDefaultSheetConfig({
      projectName: '',
      tunnelLocationName: '',
    }),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pre-loaded Dataset 1: Power Tunnel Ch. 250m to 300m (Matches the user's uploaded PDF template)
 */
export function createPowerTunnelReferenceDataset(): ContinuousTunnelStripDataset {
  const pulls: ContinuousPullRecord[] = [
    {
      id: 'pt-250-255',
      fromRd: 250,
      toRd: 255,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '0 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO LIGHT YELLOW, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: '156.20 MPa (VERY STRONG)',
      rmrValue: 61,
      rqdValue: 74,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS FRACTURED & BLOCKY DUE TO CLOSELY SPACED JOINTS. SLABS ARE FORMED ON THE CROWN. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. SHEARED JOINTS ALONG JS1 WITH 0.5-2.5cm THICK CRUSHED ROCK AND CLAY ARE OBSERVED.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.2-1mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0,
      excavationDefiningNo: '2',
      excavationDate: '18/3/03',
      supportClass: '2/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '60/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '105',
      photoNegativeNo: '11-15',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 60/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-18',
    },
    {
      id: 'pt-255-260',
      fromRd: 255,
      toRd: 260,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '-1 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO LIGHT YELLOW, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: '156.20 MPa (VERY STRONG)',
      rmrValue: 61,
      rqdValue: 74,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS FRACTURED & BLOCKY DUE TO CLOSELY SPACED JOINTS. SLABS ARE FORMED ON THE CROWN. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. SHEARED JOINTS ALONG JS1 WITH 0.5-2.5cm THICK CRUSHED ROCK AND CLAY ARE OBSERVED.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.2-1mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0.448,
      excavationDefiningNo: '2',
      excavationDate: '18/3/03',
      supportClass: '2/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '60/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '105',
      photoNegativeNo: '29-30',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 60/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-18',
    },
    {
      id: 'pt-260-265',
      fromRd: 260,
      toRd: 265,
      driveAzimuthDeg: 161, // 1° smooth curve turn
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 341,
      convergenceMm: '-1 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO GREENISH GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: 'VERY STRONG (100-250 MPa)',
      rmrValue: 53,
      rqdValue: 61,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. JS1, JS2, JS3 & SECONDARY JOINTS ARE PROMINENT. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. TWO SHEARED ZONES ARE ALONG JS2 AND SECONDARY JOINTS WITH 2-10cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.2-1mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 1.009,
      excavationDefiningNo: '2',
      excavationDate: '18/3/03',
      supportClass: '2/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '60/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '',
      photoNegativeNo: '',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 60/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-19',
    },
    {
      id: 'pt-265-270',
      fromRd: 265,
      toRd: 270,
      driveAzimuthDeg: 161,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 341,
      convergenceMm: '-2 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO GREENISH GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: 'VERY STRONG (100-250 MPa)',
      rmrValue: 53,
      rqdValue: 61,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. JS1, JS2, JS3 & SECONDARY JOINTS ARE PROMINENT. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. TWO SHEARED ZONES ARE ALONG JS2 AND SECONDARY JOINTS WITH 2-10cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.2-1mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0.587,
      excavationDefiningNo: '2',
      excavationDate: '18/3/03',
      supportClass: '2/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '60/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '',
      photoNegativeNo: '',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 60/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-20',
    },
    {
      id: 'pt-270-275',
      fromRd: 270,
      toRd: 275,
      driveAzimuthDeg: 162, // Another 1° smooth turn
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 342,
      convergenceMm: '-2 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO GREENISH GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: 'VERY STRONG (100-250 MPa)',
      rmrValue: 51,
      rqdValue: 59,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. JS1, JS2, JS3 & SECONDARY JOINTS ARE PROMINENT. TWO SHEARED ZONES ARE ALONG JS2 AND SECONDARY JOINTS WITH 2-10cm THICK CRUSHED ROCK AND CLAY. ROCKMASS SHATTERED ALONG THE SHEARED ZONE.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0.552,
      excavationDefiningNo: '2',
      excavationDate: '18/3/03',
      supportClass: '2/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '60/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '106',
      photoNegativeNo: '12-14, 4-7',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 60/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-21',
    },
    {
      id: 'pt-275-280',
      fromRd: 275,
      toRd: 280,
      driveAzimuthDeg: 161,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 341,
      convergenceMm: '-1 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO GREENISH GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: 'VERY STRONG (100-250 MPa)',
      rmrValue: 58,
      rqdValue: 68,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. JS1, JS2, JS3 & SECONDARY JOINTS ARE PROMINENT. TWO SHEARED ZONES ARE ALONG JS2 AND SECONDARY JOINTS WITH 2-10cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 1.145,
      excavationDefiningNo: '2',
      excavationDate: '25/3/03',
      supportClass: '1/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '40/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '107',
      photoNegativeNo: '8, 9',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-25',
    },
    {
      id: 'pt-280-285',
      fromRd: 280,
      toRd: 285,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '0 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO GREENISH GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: 'VERY STRONG (100-250 MPa)',
      rmrValue: 58,
      rqdValue: 68,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. JS1, JS2, JS3 & SECONDARY JOINTS ARE PROMINENT.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0.073,
      excavationDefiningNo: '2',
      excavationDate: '25/3/03',
      supportClass: '1/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '40/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '108',
      photoNegativeNo: '30-33',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-25',
    },
    {
      id: 'pt-285-290',
      fromRd: 285,
      toRd: 290,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '0 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO LIGHT GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '151.70 MPa (VERY STRONG)',
      rmrValue: 60,
      rqdValue: 66,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. SHEARED PLANES ARE ALONG SECONDARY JOINTS WITH 0.5-1cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0,
      excavationDefiningNo: '2',
      excavationDate: '25/3/03',
      supportClass: '1/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '40/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '',
      photoNegativeNo: '',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-26',
    },
    {
      id: 'pt-290-295',
      fromRd: 290,
      toRd: 295,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '0 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO LIGHT GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '151.70 MPa (VERY STRONG)',
      rmrValue: 60,
      rqdValue: 66,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. SHEARED PLANES ARE ALONG SECONDARY JOINTS WITH 0.5-1cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0,
      excavationDefiningNo: '2',
      excavationDate: '25/3/03',
      supportClass: '1/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '40/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '109',
      photoNegativeNo: '1, 2',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-27',
    },
    {
      id: 'pt-295-300',
      fromRd: 295,
      toRd: 300,
      driveAzimuthDeg: 160,
      gradientPct: 0.166,
      leftBoundaryAzimuthDeg: 340,
      convergenceMm: '0 mm',
      rockType: 'Qtz - Quartzite',
      rockDescription:
        'REDDISH BROWN TO LIGHT GREY, MEDIUM GRAINED, VERY STRONG QUARTZITE.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '151.70 MPa (VERY STRONG)',
      rmrValue: 60,
      rqdValue: 66,
      seepageCondition: 'DRY',
      structureDescription:
        'ROCKMASS IS JOINTED & FRACTURED. SLABS ARE FORMED ON THE CROWN. IRON STAINS & CLAY ARE COMMONLY FOUND ON JS1 & JS2. SHEARED PLANES ARE ALONG SECONDARY JOINTS WITH 0.5-1cm THICK CRUSHED ROCK AND CLAY.',
      foliationCharacteristics:
        'FOLIATION JOINTS ARE VERY CLOSELY TO MEDIUM SPACED, CONTINUOUS, APERTURE 0.1-2mm, SLIGHTLY ROUGH TO SMOOTH WITH SILT AND CLAY FILLINGS.',
      overbreakVolumeM3: 0,
      excavationDefiningNo: '2',
      excavationDate: '25/3/03',
      supportClass: '1/3a',
      shotcreteInstalled: '10cm WET',
      wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
      rockBoltsInstalled: '40/3m',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      photoRollNo: '110',
      photoNegativeNo: '8-11',
      remarks: '',
      supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-28',
    },
  ];

  const lithologyZones: ContinuousStripLithologyZone[] = [
    {
      id: 'pt-lith-qtz-1',
      rockType: 'Quartzite',
      codeSymbol: 'Qtz',
      label: 'Qtz - Reddish Brown to Light Yellow Very Strong Quartzite',
      polygon: [
        { x: 250, y: 0 },
        { x: 263, y: 0 },
        { x: 261, y: 18 },
        { x: 250, y: 18 },
      ],
    },
    {
      id: 'pt-lith-qtz-2',
      rockType: 'Quartzite',
      codeSymbol: 'Qtz',
      label: 'Qtz - Reddish Brown to Greenish Grey Very Strong Quartzite',
      polygon: [
        { x: 263, y: 0 },
        { x: 287, y: 0 },
        { x: 285, y: 18 },
        { x: 261, y: 18 },
      ],
    },
    {
      id: 'pt-lith-qtz-3',
      rockType: 'Quartzite',
      codeSymbol: 'Qtz',
      label: 'Qtz - Reddish Brown to Light Grey Very Strong Quartzite',
      polygon: [
        { x: 287, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 18 },
        { x: 285, y: 18 },
      ],
    },
    {
      id: 'pt-vein-1',
      rockType: 'Quartz veins',
      codeSymbol: '+ + +',
      label: 'Quartz Vein Band (+ + +)',
      isIntrusionBody: true,
      polygon: [
        { x: 262.0, y: 0.4 },
        { x: 264.2, y: 0.4 },
        { x: 281.5, y: 8.6 },
        { x: 279.8, y: 9.4 },
      ],
    },
    {
      id: 'pt-fractured-1',
      rockType: 'Phyllitic Quartzite',
      codeSymbol: 'PQ',
      label: 'Fractured / Shattered Rockmass along Shear Zone',
      isFracturedZone: true,
      polygon: [
        { x: 273.0, y: 5.5 },
        { x: 282.5, y: 10.2 },
        { x: 281.0, y: 12.6 },
        { x: 271.5, y: 7.8 },
      ],
    },
  ];

  // Note: rawPoints represent unaligned photo-traced segments with seam kinks/offsets across 5m pulls;
  // aiAlignedPoints / points represent the AI Trend-Aligned continuous structural trajectories!
  const traces: ContinuousStripTrace[] = [
    {
      id: 'pt-shear-zone-main',
      structureType: 'Shear Zone',
      setId: 'SZ-1',
      orientationLabel: '055/45',
      dipDirectionDeg: 55,
      dipDeg: 45,
      fillingThickness: '5~10cm',
      rawPoints: [
        { x: 256.5, y: 0.2 },
        { x: 260.0, y: 2.3 },
        { x: 260.4, y: 1.5 }, // photo seam kink at Ch. 260
        { x: 265.0, y: 4.1 },
        { x: 270.0, y: 6.9 },
        { x: 270.5, y: 5.8 }, // photo seam kink at Ch. 270
        { x: 275.0, y: 8.4 },
        { x: 285.5, y: 12.4 },
      ],
      aiAlignedPoints: [
        { x: 256.5, y: 0.2 },
        { x: 260.0, y: 1.9 },
        { x: 265.0, y: 4.3 },
        { x: 270.0, y: 6.7 },
        { x: 275.0, y: 9.1 },
        { x: 285.5, y: 12.4 },
      ],
      points: [
        { x: 256.5, y: 0.2 },
        { x: 260.0, y: 1.9 },
        { x: 265.0, y: 4.3 },
        { x: 270.0, y: 6.7 },
        { x: 275.0, y: 9.1 },
        { x: 285.5, y: 12.4 },
      ],
    },
    {
      id: 'pt-js1-fol-1',
      structureType: 'JS1 - Foliation',
      setId: 'JS1',
      orientationLabel: '050/50',
      dipDirectionDeg: 50,
      dipDeg: 50,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 250.2, y: 14.5 },
        { x: 255.0, y: 8.8 },
        { x: 255.3, y: 9.9 }, // photo offset at Ch. 255
        { x: 260.0, y: 3.6 },
        { x: 263.2, y: 0.3 },
      ],
      aiAlignedPoints: [
        { x: 250.2, y: 14.5 },
        { x: 255.0, y: 9.1 },
        { x: 260.0, y: 3.7 },
        { x: 263.2, y: 0.3 },
      ],
      points: [
        { x: 250.2, y: 14.5 },
        { x: 255.0, y: 9.1 },
        { x: 260.0, y: 3.7 },
        { x: 263.2, y: 0.3 },
      ],
    },
    {
      id: 'pt-js1-fol-2',
      structureType: 'JS1 - Foliation',
      setId: 'JS1',
      orientationLabel: '052/48',
      dipDirectionDeg: 52,
      dipDeg: 48,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 256.0, y: 17.6 },
        { x: 260.0, y: 13.4 },
        { x: 265.0, y: 7.5 },
        { x: 265.4, y: 8.6 }, // photo offset at Ch. 265
        { x: 271.5, y: 1.4 },
      ],
      aiAlignedPoints: [
        { x: 256.0, y: 17.6 },
        { x: 260.0, y: 13.3 },
        { x: 265.0, y: 8.0 },
        { x: 271.5, y: 1.4 },
      ],
      points: [
        { x: 256.0, y: 17.6 },
        { x: 260.0, y: 13.3 },
        { x: 265.0, y: 8.0 },
        { x: 271.5, y: 1.4 },
      ],
    },
    {
      id: 'pt-js2-joint-1',
      structureType: 'JS2 - Main Joint',
      setId: 'JS2',
      orientationLabel: '235/68',
      dipDirectionDeg: 235,
      dipDeg: 68,
      fillingThickness: '2~5cm',
      rawPoints: [
        { x: 264.0, y: 17.8 },
        { x: 270.0, y: 12.1 },
        { x: 270.4, y: 13.3 }, // photo offset at Ch. 270
        { x: 275.0, y: 7.4 },
        { x: 281.8, y: 1.2 },
      ],
      aiAlignedPoints: [
        { x: 264.0, y: 17.8 },
        { x: 270.0, y: 12.2 },
        { x: 275.0, y: 7.5 },
        { x: 281.8, y: 1.2 },
      ],
      points: [
        { x: 264.0, y: 17.8 },
        { x: 270.0, y: 12.2 },
        { x: 275.0, y: 7.5 },
        { x: 281.8, y: 1.2 },
      ],
    },
    {
      id: 'pt-js3-joint-1',
      structureType: 'JS3 - Main Joint',
      setId: 'JS3',
      orientationLabel: '315/72',
      dipDirectionDeg: 315,
      dipDeg: 72,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 276.0, y: 0.4 },
        { x: 280.0, y: 3.5 },
        { x: 285.0, y: 6.9 },
        { x: 285.5, y: 5.8 }, // photo offset at Ch. 285
        { x: 292.0, y: 11.2 },
        { x: 298.8, y: 15.8 },
      ],
      aiAlignedPoints: [
        { x: 276.0, y: 0.4 },
        { x: 280.0, y: 3.1 },
        { x: 285.0, y: 6.5 },
        { x: 292.0, y: 11.2 },
        { x: 298.8, y: 15.8 },
      ],
      points: [
        { x: 276.0, y: 0.4 },
        { x: 280.0, y: 3.1 },
        { x: 285.0, y: 6.5 },
        { x: 292.0, y: 11.2 },
        { x: 298.8, y: 15.8 },
      ],
    },
    {
      id: 'pt-shear-joint-2',
      structureType: 'Shear Joint (5-30mm)',
      setId: 'SJ-2',
      orientationLabel: '140/65',
      dipDirectionDeg: 140,
      dipDeg: 65,
      fillingThickness: '2~5cm',
      rawPoints: [
        { x: 283.5, y: 17.5 },
        { x: 290.0, y: 11.8 },
        { x: 290.4, y: 12.9 }, // photo offset at Ch. 290
        { x: 295.0, y: 6.8 },
        { x: 299.6, y: 1.8 },
      ],
      aiAlignedPoints: [
        { x: 283.5, y: 17.5 },
        { x: 290.0, y: 11.2 },
        { x: 295.0, y: 6.3 },
        { x: 299.6, y: 1.8 },
      ],
      points: [
        { x: 283.5, y: 17.5 },
        { x: 290.0, y: 11.2 },
        { x: 295.0, y: 6.3 },
        { x: 299.6, y: 1.8 },
      ],
    },
    {
      id: 'pt-js1-fol-2-rw',
      structureType: 'JS1 - Foliation',
      setId: 'JS1',
      orientationLabel: '052/48',
      dipDirectionDeg: 52,
      dipDeg: 48,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 263.8, y: 9.4 },
        { x: 266.5, y: 6.2 },
        { x: 269.2, y: 3.1 },
      ],
      aiAlignedPoints: [
        { x: 263.8, y: 9.4 },
        { x: 266.5, y: 6.2 },
        { x: 269.2, y: 3.1 },
      ],
      points: [
        { x: 263.8, y: 9.4 },
        { x: 266.5, y: 6.2 },
        { x: 269.2, y: 3.1 },
      ],
    },
    {
      id: 'pt-js2-joint-1-lw',
      structureType: 'JS2 - Main Joint',
      setId: 'JS2',
      orientationLabel: '235/68',
      dipDirectionDeg: 235,
      dipDeg: 68,
      fillingThickness: '2~5cm',
      rawPoints: [
        { x: 277.8, y: 4.8 },
        { x: 280.1, y: 2.6 },
        { x: 282.4, y: 0.6 },
      ],
      aiAlignedPoints: [
        { x: 277.8, y: 4.8 },
        { x: 280.1, y: 2.6 },
        { x: 282.4, y: 0.6 },
      ],
      points: [
        { x: 277.8, y: 4.8 },
        { x: 280.1, y: 2.6 },
        { x: 282.4, y: 0.6 },
      ],
    },
  ];

  return {
    id: 'dataset-power-tunnel-250-300',
    projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
    tunnelLocationName: 'POWER TUNNEL (HRT)',
    clientName: 'Nepal Electricity Authority',
    contractorName: 'DYWIDAG — DRAGADOS — CWE JV',
    geologistContractor: '',
    geologistClient: '',
    upperZoneLabel: 'LEFT WALL TO CROWN (SPRING LINE)',
    lowerZoneLabel: 'CROWN TO RIGHT WALL (SPRING LINE)',
    upperZoneWidthM: 9.0,
    lowerZoneWidthM: 9.0,
    leftWallArcLengthM: 4.5,
    crownArcLengthM: 9.0,
    rightWallArcLengthM: 4.5,
    leftWallHeightM: 4.5,
    crownWidthM: 9.0,
    rightWallHeightM: 4.5,
    tunnelDiameterWidthM: 6.4,
    tunnelArchHeightM: 6.4,
    viewFromRd: 250,
    viewToRd: 300,
    leftCornerAzimuthLabel: '340°N',
    rightCornerAzimuthLabel: '160°N',
    pulls,
    traces,
    lithologyZones,
    waterSymbols: [],
    narrativeBullets: [
      'REPRESENTATIVE JOINTS ARE SHOWN IN THE MAP, THEIR NUMBERS BEING LIMITED BY THE SCALE OF MAP.',
      'INFORMATION FROM DAILY TUNNEL MAPPING/DOCUMENTATION (INCLUDING FACE MAPS) HAS BEEN USED AS THE BASIS FOR THIS DOCUMENT.',
      'STEEL RIBS USED IN POWER TUNNEL IS HEB-120. PROJECTION OF THE TUNNEL MAP IS DONE AS VIEWED FROM INSIDE THE TUNNEL.',
      '"-" REPRESENTS CONVERGENCE AND "+" REPRESENTS DIVERGENCE.',
    ],
    sheetConfig: getDefaultSheetConfig({
      projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
      tunnelLocationName: 'POWER TUNNEL (HRT)',
      clientName: 'Nepal Electricity Authority',
      contractorName: 'DYWIDAG — DRAGADOS — CWE JOINT VENTURE (CONTRACTORS)',
    }),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pre-loaded Dataset 2: Gandikota Pumped Storage Project — Powerhouse RHS Slashing (RD 0m to 30m)
 */
export function createAdaniRithwikReferenceDataset(): ContinuousTunnelStripDataset {
  const pulls: ContinuousPullRecord[] = [
    {
      id: 'pull-0-5',
      fromRd: 0,
      toRd: 5,
      driveAzimuthDeg: 70,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 250,
      convergenceMm: '0 mm',
      rockType: 'Siltstone',
      rockDescription: 'Medium grained, reddish brown and grey colored Siltstone.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 64,
      rqdValue: 78,
      overbreakVolumeM3: 0.35,
      excavationDefiningNo: '1',
      excavationDate: '21/09/26',
      supportClass: 'Class II',
      structureDescription:
        'Bedding planes 045/08-12 and sub-vertical joint sets J1 (224/70-75) & F1 (320/70-75) observed.',
      foliationCharacteristics:
        'Joints closely to moderately spaced, continuous, clay coated to 2-5cm filling.',
      status: 'MAPPED',
      dateMapped: '2026-09-21',
    },
    {
      id: 'pull-5-10',
      fromRd: 5,
      toRd: 10,
      driveAzimuthDeg: 70,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 250,
      convergenceMm: '-1 mm',
      rockType: 'Siltstone',
      rockDescription: 'Medium grained, reddish brown and grey colored Siltstone.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 62,
      rqdValue: 75,
      overbreakVolumeM3: 0.42,
      excavationDefiningNo: '1',
      excavationDate: '22/09/26',
      supportClass: 'Class II',
      structureDescription:
        'Bedding planes and C-shaped quartz vein shear body encountered on crown/upper slashing.',
      foliationCharacteristics:
        'Slightly rough to smooth planar surfaces with thin clay coating.',
      status: 'MAPPED',
      dateMapped: '2026-09-22',
    },
    {
      id: 'pull-10-15',
      fromRd: 10,
      toRd: 15,
      driveAzimuthDeg: 70,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 250,
      convergenceMm: '-1 mm',
      rockType: 'Siltstone',
      rockDescription: 'Medium grained, reddish brown and grey colored Siltstone.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 60,
      rqdValue: 72,
      overbreakVolumeM3: 0.51,
      excavationDefiningNo: '1',
      excavationDate: '23/09/26',
      supportClass: 'Class II',
      structureDescription:
        'Lithological transition contact at RD 14.2~15.0m between Siltstone and Dolerite/Quartzite.',
      foliationCharacteristics:
        'Continuous joint traces 203/70-75 and 314/70-75 extending across pull seam.',
      status: 'MAPPED',
      dateMapped: '2026-09-23',
    },
    {
      id: 'pull-15-20',
      fromRd: 15,
      toRd: 20,
      driveAzimuthDeg: 71,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 251,
      convergenceMm: '-1 mm',
      rockType: 'QUARTZITE / Dolerite',
      rockDescription: 'Very strong Quartzite with upper Dolerite intrusion.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W1-W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 65,
      rqdValue: 80,
      overbreakVolumeM3: 0.28,
      excavationDefiningNo: '2',
      excavationDate: '24/09/26',
      supportClass: 'Class II',
      structureDescription:
        '1° tunnel drive alignment turn to 071°N. Joint sets 350/70-75 and 203/70-75 prominent.',
      foliationCharacteristics: 'Tight to 2-5cm filled joints, slightly rough planar.',
      status: 'MAPPED',
      dateMapped: '2026-09-24',
    },
    {
      id: 'pull-20-25',
      fromRd: 20,
      toRd: 25,
      driveAzimuthDeg: 71,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 251,
      convergenceMm: '0 mm',
      rockType: 'QUARTZITE / Dolerite',
      rockDescription: 'Very strong Quartzite with upper Dolerite intrusion.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W1-W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 66,
      rqdValue: 82,
      overbreakVolumeM3: 0.19,
      excavationDefiningNo: '2',
      excavationDate: '25/09/26',
      supportClass: 'Class II',
      structureDescription: 'Joint sets 205/70-75 and 314/70-75 observed.',
      foliationCharacteristics: 'Moderately spaced, continuous.',
      status: 'MAPPED',
      dateMapped: '2026-09-25',
    },
    {
      id: 'pull-25-30',
      fromRd: 25,
      toRd: 30,
      driveAzimuthDeg: 70,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 250,
      convergenceMm: '0 mm',
      rockType: 'QUARTZITE / Dolerite',
      rockDescription: 'Very strong Quartzite with upper Dolerite intrusion.',
      rockClass: 'II',
      supportDescription: '150mm THK. SFRS, Wire mesh, 8/10m length 32mm Dia SN Rock bolts',
      shotcreteInstalled: '150mm SFRS',
      wireMeshInstalled: '1 Layer Wire Mesh',
      rockBoltsInstalled: '8/10m 32mm Dia SN Bolts',
      steelRibsInstalled: '-',
      forepolingInstalled: '-',
      seepageCondition: 'DRY TO WET',
      weatheringCondition: 'W1-W2 (SL~UN WEATHERED)',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 68,
      rqdValue: 84,
      overbreakVolumeM3: 0.15,
      excavationDefiningNo: '2',
      excavationDate: '26/09/26',
      supportClass: 'Class II',
      structureDescription: 'Massive to blocky Quartzite and Dolerite.',
      foliationCharacteristics: 'Tight, unweathered joints.',
      status: 'MAPPED',
      dateMapped: '2026-09-26',
    },
  ];

  const lithologyZones: ContinuousStripLithologyZone[] = [
    {
      id: 'lith-siltstone-zone',
      rockType: 'Siltstone',
      codeSymbol: 'Slt',
      label: 'Siltstone (RD 0.0~15.0m)',
      polygon: [
        { x: 0, y: 0 },
        { x: 15.2, y: 0 },
        { x: 13.8, y: 18 },
        { x: 0, y: 18 },
      ],
    },
    {
      id: 'lith-dolerite-upper',
      rockType: 'Dolerite',
      codeSymbol: 'Dol',
      label: 'Dolerite Intrusion (RD 15.0~30.0m)',
      polygon: [
        { x: 14.2, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 9.2 },
        { x: 19.5, y: 8.5 },
      ],
    },
    {
      id: 'lith-quartzite-lower',
      rockType: 'Quartzite',
      codeSymbol: 'Qtz',
      label: 'Quartzite (RD 14.0~30.0m)',
      polygon: [
        { x: 14.2, y: 8.5 },
        { x: 30, y: 9.2 },
        { x: 30, y: 18 },
        { x: 13.8, y: 18 },
      ],
    },
    {
      id: 'lith-c-intrusion',
      rockType: 'Quartz veins',
      codeSymbol: '+ + +',
      label: 'C-Shaped Shear / Quartz Vein Body',
      isIntrusionBody: true,
      polygon: [
        { x: 3.1, y: 3.1 },
        { x: 7.4, y: 2.3 },
        { x: 7.6, y: 3.5 },
        { x: 4.6, y: 4.3 },
        { x: 4.5, y: 6.2 },
        { x: 7.2, y: 6.7 },
        { x: 7.4, y: 8.1 },
        { x: 3.4, y: 7.5 },
        { x: 2.6, y: 5.2 },
      ],
    },
  ];

  const traces: ContinuousStripTrace[] = [
    {
      id: 'tr-bed-045',
      structureType: 'Bedding',
      setId: 'J0',
      orientationLabel: '045/08-12',
      dipDirectionDeg: 45,
      dipDeg: 10,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 0.0, y: 2.8 },
        { x: 5.0, y: 2.5 },
        { x: 5.3, y: 1.5 }, // photo kink
        { x: 10.0, y: 1.3 },
        { x: 15.5, y: 0.4 },
      ],
      aiAlignedPoints: [
        { x: 0.0, y: 2.8 },
        { x: 7.5, y: 1.6 },
        { x: 15.5, y: 0.4 },
      ],
      points: [
        { x: 0.0, y: 2.8 },
        { x: 7.5, y: 1.6 },
        { x: 15.5, y: 0.4 },
      ],
    },
    {
      id: 'tr-j-203',
      structureType: 'JS1 - Foliation',
      setId: 'JS1',
      orientationLabel: '203/70-75',
      dipDirectionDeg: 203,
      dipDeg: 73,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 8.2, y: 1.4 },
        { x: 15.0, y: 8.6 },
        { x: 15.3, y: 7.1 }, // photo offset at pull boundary RD 15m
        { x: 20.0, y: 12.6 },
        { x: 24.5, y: 16.5 },
      ],
      aiAlignedPoints: [
        { x: 8.2, y: 1.4 },
        { x: 15.0, y: 7.7 },
        { x: 20.0, y: 12.3 },
        { x: 24.5, y: 16.5 },
      ],
      points: [
        { x: 8.2, y: 1.4 },
        { x: 15.0, y: 7.7 },
        { x: 20.0, y: 12.3 },
        { x: 24.5, y: 16.5 },
      ],
    },
    {
      id: 'tr-j-314-a',
      structureType: 'JS2 - Main Joint',
      setId: 'JS2',
      orientationLabel: '314/70-75',
      dipDirectionDeg: 314,
      dipDeg: 73,
      fillingThickness: '2~5cm',
      rawPoints: [
        { x: 3.5, y: 17.4 },
        { x: 10.0, y: 14.8 },
        { x: 10.4, y: 13.5 }, // photo offset at RD 10m
        { x: 20.0, y: 9.9 },
        { x: 20.3, y: 8.8 }, // photo offset at RD 20m
        { x: 30.0, y: 4.5 },
      ],
      aiAlignedPoints: [
        { x: 3.5, y: 17.4 },
        { x: 10.0, y: 14.2 },
        { x: 20.0, y: 9.4 },
        { x: 30.0, y: 4.5 },
      ],
      points: [
        { x: 3.5, y: 17.4 },
        { x: 10.0, y: 14.2 },
        { x: 20.0, y: 9.4 },
        { x: 30.0, y: 4.5 },
      ],
    },
    {
      id: 'tr-j-320',
      structureType: 'Fault',
      setId: 'F1',
      orientationLabel: '320/70-75',
      dipDirectionDeg: 320,
      dipDeg: 74,
      fillingThickness: '>10cm',
      rawPoints: [
        { x: 0.2, y: 11.4 },
        { x: 5.0, y: 10.2 },
        { x: 5.3, y: 9.0 },
        { x: 18.0, y: 5.0 },
      ],
      aiAlignedPoints: [
        { x: 0.2, y: 11.4 },
        { x: 8.5, y: 8.4 },
        { x: 18.0, y: 5.0 },
      ],
      points: [
        { x: 0.2, y: 11.4 },
        { x: 8.5, y: 8.4 },
        { x: 18.0, y: 5.0 },
      ],
    },
  ];

  const waterSymbols: ContinuousStripWaterSymbol[] = [
    {
      id: 'ws-1',
      condition: 'Moist/Damp',
      position: { x: 11.5, y: 11.0 },
      label: 'Damp',
    },
    {
      id: 'ws-2',
      condition: 'Dripping',
      position: { x: 22.0, y: 12.8 },
      label: 'Dripping',
    },
  ];

  return {
    id: 'dataset-gandikota-rhs-slashing',
    projectName: 'Gandikota Pumped Storage Project (Civil & Hydro-Mechanical Works)',
    tunnelLocationName: 'POWERHOUSE RHS SLASHING',
    clientName: 'adani',
    contractorName: 'RITHWIK',
    geologistContractor: '',
    geologistClient: '',
    upperZoneLabel: 'CENTRAL GULLET',
    lowerZoneLabel: 'RHS SLASHING',
    upperZoneWidthM: 8.5,
    lowerZoneWidthM: 9.5,
    leftWallArcLengthM: 4.5,
    crownArcLengthM: 8.0,
    rightWallArcLengthM: 5.5,
    leftWallHeightM: 4.5,
    crownWidthM: 8.0,
    rightWallHeightM: 5.5,
    tunnelDiameterWidthM: 8.4,
    tunnelArchHeightM: 6.5,
    viewFromRd: 0,
    viewToRd: 30,
    leftCornerAzimuthLabel: '250°N',
    rightCornerAzimuthLabel: '070°N',
    pulls,
    traces,
    lithologyZones,
    waterSymbols,
    narrativeBullets: [
      'Rock type encountered in POWER HOUSE RHS SLASHING in the zone of RD 0.0 ~ 15.0m is mainly Siltstone, Medium grained, reddish brown and grey colored, and from 15.0m to 30.0m is Dolerite & Quartzite. Ground water condition is almost found as Dry to Damp.',
      'Other than Bedding planes, there are other joints observed during excavation of Powerhouse Tunnel, these are with directions 230°~245° with true dip 70°~75°, 160°~180° with true dip 70°~75°, 310~315°/70~75°, 340~350°/70~85°, and 260°/70~75°.',
      'Weathering condition is mostly Unweathered to slightly weathered and UCS is observed to be 100~200Mpa.',
    ],
    sheetConfig: getDefaultSheetConfig({
      projectName: 'Gandikota Pumped Storage Project (Civil & Hydro-Mechanical Works)',
      tunnelLocationName: 'POWERHOUSE RHS SLASHING',
      clientName: 'ADANI GREEN ENERGY',
      contractorName: 'RITHWIK PROJECTS PVT LTD (RPPL)',
    }),
    updatedAt: new Date().toISOString(),
  };
}

export const createGandikotaReferenceDataset = createAdaniRithwikReferenceDataset;

/**
 * AI Structural Trend & Seam Alignment Engine:
 * - Preserves `rawPoints` (from photo-based round mapping)
 * - Stitches disconnected trace segments belonging to the same Set & Orientation across pull seams
 * - Smooths photo-perspective kinks along the dominant strike/dip trajectory (`aiAlignedPoints`)
 */
export function runAiTrendAlignmentOnDataset(
  dataset: ContinuousTunnelStripDataset
): {
  updatedDataset: ContinuousTunnelStripDataset;
  alignedCount: number;
  stitchedSeamsCount: number;
} {
  let alignedCount = 0;
  let stitchedSeamsCount = 0;

  // Step 1: Ensure every trace preserves its rawPoints before alignment
  const workingTraces: ContinuousStripTrace[] = dataset.traces.map((tr) => {
    const raw = tr.rawPoints && tr.rawPoints.length >= 2 ? tr.rawPoints : tr.points;
    return {
      ...tr,
      rawPoints: raw.map((p) => ({ ...p })),
    };
  });

  // Step 2: Check for collinear segments across pull seams with matching setId & similar dipDirection
  const mergedTraces: ContinuousStripTrace[] = [];
  const consumedIds = new Set<string>();

  for (let i = 0; i < workingTraces.length; i++) {
    const tA = workingTraces[i];
    if (consumedIds.has(tA.id)) continue;

    let combinedRaw = [...(tA.rawPoints || tA.points)];

    for (let j = i + 1; j < workingTraces.length; j++) {
      const tB = workingTraces[j];
      if (consumedIds.has(tB.id)) continue;
      if (tB.setId !== tA.setId) continue;

      const ptsB = [...(tB.rawPoints || tB.points)];
      const endA = combinedRaw[combinedRaw.length - 1];
      const startB = ptsB[0];
      const rdGap = Math.abs(startB.x - endA.x);
      const perimGap = Math.abs(startB.y - endA.y);

      if (rdGap <= 1.8 && perimGap <= 2.2) {
        // Stitch across pull seam!
        combinedRaw = [...combinedRaw, ...ptsB];
        consumedIds.add(tB.id);
        stitchedSeamsCount++;
      }
    }

    // Step 3: Compute AI pattern-guided smooth curved trajectory (preserving exact 90° CW rotated angle & endpoints)
    const n = combinedRaw.length;
    if (n >= 2) {
      const first = combinedRaw[0];
      const last = combinedRaw[n - 1];
      const totalDx = last.x - first.x;
      const totalDy = last.y - first.y;
      const chordLen = Math.hypot(totalDx, totalDy);
      const perpNx = chordLen > 1e-4 ? -totalDy / chordLen : 0;
      const perpNy = chordLen > 1e-4 ? totalDx / chordLen : 1;

      // Estimate pattern curvature from same-set traces or 3D dip/dipDirection
      const dipRad = ((tA.dipDeg || 65) * Math.PI) / 180;
      const dipDirRad = ((tA.dipDirectionDeg || 180) * Math.PI) / 180;
      const archBowAmplitudeM =
        Math.sin(dipDirRad) * Math.cos(dipRad) * Math.min(0.65, Math.max(0.12, chordLen * 0.05));

      let baseControlPts: Point2D[] = [];
      if (n === 2) {
        // Synthesize smooth intermediate pattern control points along the exact 90° CW rotated chord
        for (let s = 0; s <= 4; s++) {
          const frac = s / 4;
          const archCurve = Math.sin(frac * Math.PI) * archBowAmplitudeM;
          baseControlPts.push({
            x: Number((first.x + frac * totalDx + perpNx * archCurve).toFixed(3)),
            y: Number((first.y + frac * totalDy + perpNy * archCurve).toFixed(3)),
          });
        }
      } else {
        const alignedPts: Point2D[] = combinedRaw.map((pt, idx) => {
          if (idx === 0 || idx === n - 1) {
            return { x: Number(pt.x.toFixed(3)), y: Number(pt.y.toFixed(3)) };
          }
          const frac = idx / Math.max(1, n - 1);
          const archCurve = Math.sin(frac * Math.PI) * (archBowAmplitudeM * 0.35);
          const trendX = first.x + frac * totalDx + perpNx * archCurve;
          const trendY = first.y + frac * totalDy + perpNy * archCurve;
          // Blend 35% smooth structural pattern curve + 65% exact 90° CW rotated local geometry
          return {
            x: Number((trendX * 0.35 + pt.x * 0.65).toFixed(3)),
            y: Number((trendY * 0.35 + pt.y * 0.65).toFixed(3)),
          };
        });

        // Remove only near-duplicate points (< 0.12m apart) while keeping all real vertices
        baseControlPts = [alignedPts[0]];
        for (let k = 1; k < alignedPts.length - 1; k++) {
          const prev = baseControlPts[baseControlPts.length - 1];
          if (Math.hypot(alignedPts[k].x - prev.x, alignedPts[k].y - prev.y) >= 0.12) {
            baseControlPts.push(alignedPts[k]);
          }
        }
        baseControlPts.push(alignedPts[alignedPts.length - 1]);
      }

      alignedCount++;
      mergedTraces.push({
        ...tA,
        rawPoints: combinedRaw,
        aiAlignedPoints: baseControlPts,
        points: baseControlPts,
      });
    } else {
      mergedTraces.push(tA);
    }
  }

  return {
    updatedDataset: {
      ...dataset,
      traces: mergedTraces,
      updatedAt: new Date().toISOString(),
    },
    alignedCount,
    stitchedSeamsCount,
  };
}

/**
 * Resolves the authoritative color for any joint trace or geological feature in 3D Strip Logging,
 * matching the Joint Set Palette (J0, J1/JS1, J2/JS2, J3/JS3, J4/JS4, J5/JS5, F1/Fault/Shear)
 * so that trace lines and on-trace values always share the exact same color.
 */
export function resolveStripTraceColor(
  targetOrSetId?:
    | string
    | {
        setId?: string;
        structureType?: string;
        customColor?: string;
        color?: string;
      }
    | null,
  structureType?: string,
  customColor?: string
): string {
  let resolvedSetId = '';
  let resolvedStruct = '';
  let resolvedColor = '';

  if (targetOrSetId && typeof targetOrSetId === 'object') {
    resolvedSetId =
      typeof targetOrSetId.setId === 'string'
        ? targetOrSetId.setId
        : String(targetOrSetId.setId || '');
    resolvedStruct =
      typeof targetOrSetId.structureType === 'string'
        ? targetOrSetId.structureType
        : String(targetOrSetId.structureType || '');
    resolvedColor =
      typeof targetOrSetId.customColor === 'string'
        ? targetOrSetId.customColor
        : typeof targetOrSetId.color === 'string'
          ? targetOrSetId.color
          : '';
  } else {
    resolvedSetId =
      typeof targetOrSetId === 'string'
        ? targetOrSetId
        : targetOrSetId != null
          ? String(targetOrSetId)
          : '';
    resolvedStruct =
      typeof structureType === 'string'
        ? structureType
        : structureType != null
          ? String(structureType)
          : '';
    resolvedColor =
      typeof customColor === 'string'
        ? customColor
        : customColor != null
          ? String(customColor)
          : '';
  }

  if (resolvedColor && resolvedColor.trim().startsWith('#')) {
    return resolvedColor.trim();
  }
  const normSet = resolvedSetId.trim().toUpperCase();
  const normStruct = resolvedStruct.trim().toLowerCase();

  if (normSet.startsWith('J0') || normStruct.includes('bedding')) return '#0284C7';
  if (normSet.startsWith('J1') || normSet.startsWith('JS1')) return '#DC2626';
  if (normSet.startsWith('J2') || normSet.startsWith('JS2')) return '#16A34A';
  if (normSet.startsWith('J3') || normSet.startsWith('JS3')) return '#D97706';
  if (normSet.startsWith('J4') || normSet.startsWith('JS4')) return '#7C3AED';
  if (normSet.startsWith('J5') || normSet.startsWith('JS5')) return '#0D9488';
  if (
    normSet.startsWith('F1') ||
    normSet.startsWith('SZ') ||
    normSet.startsWith('SJ') ||
    normStruct.includes('fault') ||
    normStruct.includes('shear')
  ) {
    return '#E11D48';
  }
  if (normStruct.includes('foliation')) return '#0284C7';
  if (normStruct.includes('gouge') || normStruct.includes('clay')) return '#D97706';
  if (normStruct.includes('litholog') || normStruct.includes('boundary')) return '#7C3AED';
  return '#DC2626';
}

/**
 * AI Pattern-Guided Smooth Curve Evaluator for 3D Strip Traces:
 * Uses the trace's own control points PLUS learned curvature pattern from previous/neighboring
 * traces of the same joint set (`setId`) and 3D cylindrical projection geometry (`dipDirectionDeg`, `dipDeg`)
 * so traces render as smooth, organic geological curves rather than brittle straight segments.
 */
export function buildAiPatternSmoothCurvePoints(
  trace: ContinuousStripTrace,
  allTraces: ContinuousStripTrace[],
  totalPerimM: number,
  useAiAligned = true
): Point2D[] {
  const basePts =
    useAiAligned && trace.aiAlignedPoints && trace.aiAlignedPoints.length >= 2
      ? trace.aiAlignedPoints
      : trace.points && trace.points.length >= 2
      ? trace.points
      : trace.rawPoints || [];

  if (basePts.length < 2) return basePts;

  let controlPts = basePts.map((p) => ({ x: p.x, y: p.y }));

  // If the trace only has 2 points (or collinear points), infer natural curvature from:
  // 1) Previous/neighboring traces of the same Joint Set (pattern memory), and
  // 2) Unfolded cylindrical intersection of a dipping plane across Crown/Walls
  const p0 = controlPts[0];
  const pEnd = controlPts[controlPts.length - 1];
  const dx = pEnd.x - p0.x;
  const dy = pEnd.y - p0.y;
  const chordLen = Math.hypot(dx, dy);

  // Measure average mid-chord sag/camber from other traces in the same joint set
  let patternSagRatio = 0;
  let patternCount = 0;
  for (const other of allTraces) {
    if (other.id === trace.id) continue;
    const sameSet =
      (other.setId && trace.setId && other.setId === trace.setId) ||
      (Math.abs((other.dipDirectionDeg ?? 0) - (trace.dipDirectionDeg ?? 0)) <= 10 &&
        Math.abs((other.dipDeg ?? 0) - (trace.dipDeg ?? 0)) <= 10);
    if (!sameSet) continue;
    const oPts = other.points || [];
    if (oPts.length >= 3) {
      const oStart = oPts[0];
      const oLast = oPts[oPts.length - 1];
      const oMid = oPts[Math.floor(oPts.length / 2)];
      const oLen = Math.hypot(oLast.x - oStart.x, oLast.y - oStart.y);
      if (oLen > 0.5) {
        const linY = (oStart.y + oLast.y) * 0.5;
        patternSagRatio += (oMid.y - linY) / oLen;
        patternCount++;
      }
    }
  }

  const meanPatternSag =
    patternCount > 0 ? Math.max(-0.18, Math.min(0.18, patternSagRatio / patternCount)) : 0;

  if (controlPts.length === 2 && chordLen > 0.4) {
    const dipRad = ((trace.dipDeg || 65) * Math.PI) / 180;
    const dipDirRad = ((trace.dipDirectionDeg || 180) * Math.PI) / 180;
    // Cylindrical unwrap sinusoidal bow when crossing tunnel arch
    const defaultSag = Math.sin(dipDirRad) * Math.cos(dipRad) * 0.085;
    const effectiveSag = patternCount > 0 ? meanPatternSag * 0.7 + defaultSag * 0.3 : defaultSag;
    const nx = -dy / chordLen;
    const ny = dx / chordLen;
    const mid1: Point2D = {
      x: p0.x + dx * 0.33 + nx * chordLen * effectiveSag * 0.86,
      y: Math.max(0.15, Math.min(totalPerimM - 0.15, p0.y + dy * 0.33 + ny * chordLen * effectiveSag * 0.86)),
    };
    const mid2: Point2D = {
      x: p0.x + dx * 0.67 + nx * chordLen * effectiveSag * 0.86,
      y: Math.max(0.15, Math.min(totalPerimM - 0.15, p0.y + dy * 0.67 + ny * chordLen * effectiveSag * 0.86)),
    };
    controlPts = [p0, mid1, mid2, pEnd];
  } else if (controlPts.length >= 3) {
    // Gently relax any sharp brittle vertex angles using a 1-pass Chaikin/Laplacian blend
    const relaxed: Point2D[] = [controlPts[0]];
    for (let i = 1; i < controlPts.length - 1; i++) {
      const prev = controlPts[i - 1];
      const curr = controlPts[i];
      const next = controlPts[i + 1];
      relaxed.push({
        x: prev.x * 0.22 + curr.x * 0.56 + next.x * 0.22,
        y: Math.max(
          0.1,
          Math.min(totalPerimM - 0.1, prev.y * 0.22 + curr.y * 0.56 + next.y * 0.22)
        ),
      });
    }
    relaxed.push(controlPts[controlPts.length - 1]);
    controlPts = relaxed;
  }

  // Evaluate smooth Catmull-Rom spline across controlPts
  const dense: Point2D[] = [];
  const subdivisions = 8;
  for (let i = 0; i < controlPts.length - 1; i++) {
    const pA = controlPts[Math.max(0, i - 1)];
    const pB = controlPts[i];
    const pC = controlPts[i + 1];
    const pD = controlPts[Math.min(controlPts.length - 1, i + 2)];
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * pB.x +
          (-pA.x + pC.x) * t +
          (2 * pA.x - 5 * pB.x + 4 * pC.x - pD.x) * t2 +
          (-pA.x + 3 * pB.x - 3 * pC.x + pD.x) * t3);
      const y =
        0.5 *
        (2 * pB.y +
          (-pA.y + pC.y) * t +
          (2 * pA.y - 5 * pB.y + 4 * pC.y - pD.y) * t2 +
          (-pA.y + 3 * pB.y - 3 * pC.y + pD.y) * t3);
      dense.push({
        x,
        y: Math.max(0.08, Math.min(totalPerimM - 0.08, y)),
      });
    }
  }
  dense.push(controlPts[controlPts.length - 1]);
  return dense;
}

/**
 * Smooth Ribbon Warping Engine:
 * Converts any (rd, perimOffset) coordinate into a smooth, non-collapsing curved ribbon SVG coordinate
 * when the tunnel drive direction changes across pulls.
 * Enforces:
 * 1) Shortest signed angular unwrap across 0°/360°
 * 2) Strict minimum radius of curvature (R >= stripHeightPx * 1.15) so inner walls NEVER pinch, cross, or collapse
 * 3) Smooth end-tapering so the start and end of the tunnel strip remain clean and orthogonal
 */
export interface SmoothRibbonSample {
  rd: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  azimuthDeg: number;
  deltaDeg: number;
}

export function buildSmoothRibbonTransform(
  pulls: ContinuousPullRecord[],
  viewStartRd: number,
  viewEndRd: number,
  totalPerimM: number,
  startX: number,
  centerY: number,
  pxPerRdM: number,
  stripHeightPx: number,
  angularExaggeration = 1.0
) {
  const stepM = 0.25;
  const spanM = Math.max(1, viewEndRd - viewStartRd);
  const numSteps = Math.ceil(spanM / stepM) + 1;
  const sortedPulls = [...pulls].sort((a, b) => a.fromRd - b.fromRd);
  const baseAz = sortedPulls[0]?.driveAzimuthDeg ?? 160;

  // Build continuous unwrapped azimuth profile per pull so crossing 0°/360° never causes a 360° spin
  const unwrappedPullAz: { fromRd: number; toRd: number; unwrappedAz: number; rawAz: number }[] = [];
  let prevUnwrapped = baseAz;
  for (const p of sortedPulls) {
    const rawAz = typeof p.driveAzimuthDeg === 'number' && Number.isFinite(p.driveAzimuthDeg)
      ? p.driveAzimuthDeg
      : baseAz;
    const signedDiff = ((rawAz - prevUnwrapped + 540) % 360) - 180;
    const nextUnwrapped = prevUnwrapped + signedDiff;
    unwrappedPullAz.push({
      fromRd: p.fromRd,
      toRd: p.toRd,
      unwrappedAz: nextUnwrapped,
      rawAz,
    });
    prevUnwrapped = nextUnwrapped;
  }

  const getUnwrappedAzAtRd = (rd: number): number => {
    for (const p of unwrappedPullAz) {
      if (rd >= p.fromRd && rd <= p.toRd) return p.unwrappedAz;
    }
    if (unwrappedPullAz.length === 0) return baseAz;
    if (rd < unwrappedPullAz[0].fromRd) return unwrappedPullAz[0].unwrappedAz;
    return unwrappedPullAz[unwrappedPullAz.length - 1].unwrappedAz;
  };

  // Wide cosine-bell smoothing window so drive direction changes curve gently
  const windowRadiusM = Math.max(3.5, Math.min(8.0, spanM * 0.18));
  const getSmoothAzAtRd = (rd: number): number => {
    const kernelSteps = 13;
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < kernelSteps; i++) {
      const frac = (i / (kernelSteps - 1)) * 2 - 1; // -1 .. +1
      const sampleRd = Math.max(viewStartRd, Math.min(viewEndRd, rd + frac * windowRadiusM));
      const w = 0.5 * (1 + Math.cos(frac * Math.PI)); // Raised cosine Hann window
      weightedSum += getUnwrappedAzAtRd(sampleRd) * w;
      weightTotal += w;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : getUnwrappedAzAtRd(rd);
  };

  const samples: SmoothRibbonSample[] = [];
  let curX = startX;
  let curY = centerY;
  let currentAngleRad = 0;

  // CRITICAL ANTI-COLLAPSE CONSTRAINT:
  // For a ribbon of height `stripHeightPx`, the half-width is `stripHeightPx / 2`.
  // To guarantee the inner wall NEVER folds, pinches, or self-intersects, the centerline
  // radius of curvature R = dS / |dTheta| MUST be strictly greater than `stripHeightPx * 1.15`.
  const minSafeRadiusPx = Math.max(120, stripHeightPx * 1.15);
  const maxVisualBendRad = (24 * Math.PI) / 180; // Never rotate ribbon > ±24° on 2D sheet

  for (let i = 0; i < numSteps; i++) {
    const rd = Math.min(viewEndRd, viewStartRd + i * stepM);
    const smoothAz = getSmoothAzAtRd(rd);
    const rawDeltaDeg = smoothAz - baseAz;

    // Soft-saturate target visual angle so small turns (1°–10°) are clearly visible
    // while large turns (30°–90°) never fold the 2D strip back onto itself
    const scaledDeg = rawDeltaDeg * Math.max(0.5, Math.min(1.8, angularExaggeration));
    const targetAngleRad =
      maxVisualBendRad * Math.tanh(scaledDeg / 28);

    if (i === 0) {
      currentAngleRad = 0;
    } else {
      const prevRd = Math.min(viewEndRd, viewStartRd + (i - 1) * stepM);
      const dS = Math.max(0.5, (rd - prevRd) * pxPerRdM);
      const maxStepRad = dS / minSafeRadiusPx;
      const diffRad = targetAngleRad - currentAngleRad;
      const clampedStepRad = Math.max(-maxStepRad, Math.min(maxStepRad, diffRad));
      currentAngleRad += clampedStepRad;
    }

    const tx = Math.cos(currentAngleRad);
    const ty = Math.sin(currentAngleRad);
    const nx = -Math.sin(currentAngleRad);
    const ny = Math.cos(currentAngleRad);

    samples.push({
      rd,
      cx: curX,
      cy: curY,
      tx,
      ty,
      nx,
      ny,
      azimuthDeg: ((smoothAz % 360) + 360) % 360,
      deltaDeg: rawDeltaDeg,
    });

    if (i < numSteps - 1) {
      const nextRd = Math.min(viewEndRd, viewStartRd + (i + 1) * stepM);
      const dRd = nextRd - rd;
      curX += tx * dRd * pxPerRdM;
      curY += ty * dRd * pxPerRdM;
    }
  }

  const getSampleAtRd = (rd: number): SmoothRibbonSample => {
    const clamped = Math.max(viewStartRd, Math.min(viewEndRd, rd));
    const idxFloat = (clamped - viewStartRd) / stepM;
    const i0 = Math.max(0, Math.min(samples.length - 1, Math.floor(idxFloat)));
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = idxFloat - i0;
    const s0 = samples[i0];
    const s1 = samples[i1];
    if (!s0) {
      return {
        rd: clamped,
        cx: startX,
        cy: centerY,
        tx: 1,
        ty: 0,
        nx: 0,
        ny: 1,
        azimuthDeg: baseAz,
        deltaDeg: 0,
      };
    }
    if (i0 === i1) return s0;
    return {
      rd: clamped,
      cx: s0.cx + (s1.cx - s0.cx) * frac,
      cy: s0.cy + (s1.cy - s0.cy) * frac,
      tx: s0.tx + (s1.tx - s0.tx) * frac,
      ty: s0.ty + (s1.ty - s0.ty) * frac,
      nx: s0.nx + (s1.nx - s0.nx) * frac,
      ny: s0.ny + (s1.ny - s0.ny) * frac,
      azimuthDeg: s0.azimuthDeg + (s1.azimuthDeg - s0.azimuthDeg) * frac,
      deltaDeg: s0.deltaDeg + (s1.deltaDeg - s0.deltaDeg) * frac,
    };
  };

  const mapRdPerimToSvg = (rd: number, perimM: number): Point2D => {
    const s = getSampleAtRd(rd);
    const normPerim = perimM / Math.max(1, totalPerimM) - 0.5; // -0.5 (top) to +0.5 (bottom)
    const offsetPx = normPerim * stripHeightPx;
    return {
      x: s.cx + s.nx * offsetPx,
      y: s.cy + s.ny * offsetPx,
    };
  };

  return {
    samples,
    baseAz,
    getSampleAtRd,
    mapRdPerimToSvg,
  };
}

export function seedSampleContinuousStripDatasets(): ContinuousTunnelStripDataset[] {
  const sampleDatasets = [
    createPowerTunnelReferenceDataset(),
    createAdaniRithwikReferenceDataset(),
  ];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleDatasets));
  } catch {
    // ignore storage quota errors
  }
  return sampleDatasets;
}

export function loadAllContinuousStripDatasets(): ContinuousTunnelStripDataset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [createFreshDefaultStripDataset()];
    }
    const parsed = JSON.parse(raw) as ContinuousTunnelStripDataset[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createFreshDefaultStripDataset()];
    }
    return parsed;
  } catch {
    return [createFreshDefaultStripDataset()];
  }
}

export function saveAllContinuousStripDatasets(
  datasets: ContinuousTunnelStripDataset[]
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
  } catch {
    // ignore storage quota errors
  }
}

export function parsePullIntervalFromRecord(
  chainageStr: string,
  faceChainageStr: string,
  roundLengthM: number
): { fromRd: number; toRd: number } {
  const pull = Math.max(0.5, Number((roundLengthM || 3.5).toFixed(2)));

  // 1. Check if faceChainageStr itself was typed as a range e.g. "10 - 15"
  const faceRangeMatch = (faceChainageStr || '').match(
    /(\d+(?:\.\d+)?)\s*m?\s*[-–~to]+\s*(\d+(?:\.\d+)?)/i
  );
  if (faceRangeMatch) {
    const a = parseFloat(faceRangeMatch[1]);
    const b = parseFloat(faceRangeMatch[2]);
    if (!isNaN(a) && !isNaN(b) && Math.abs(b - a) > 0.05) {
      return {
        fromRd: Number(Math.min(a, b).toFixed(2)),
        toRd: Number(Math.max(a, b).toFixed(2)),
      };
    }
  }

  // 2. Check if chainageStr has a custom range (not the untouched default "RD 0.00m - 3.50m" when faceChainage or pull changed)
  const rangeMatch = (chainageStr || '').match(
    /(\d+(?:\.\d+)?)\s*m?\s*[-–~to]+\s*(\d+(?:\.\d+)?)/i
  );
  const faceNumMatch = (faceChainageStr || '').match(/(\d+(?:\.\d+)?)/);
  const faceM = faceNumMatch ? parseFloat(faceNumMatch[1]) : null;

  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b) && Math.abs(b - a) > 0.05) {
      const minR = Math.min(a, b);
      const maxR = Math.max(a, b);
      const isDefaultUntouchedRange = Math.abs(minR - 0) < 0.01 && Math.abs(maxR - 3.5) < 0.01;
      const faceChanged = faceM !== null && Math.abs(faceM - 0) > 0.01 && Math.abs(faceM - 3.5) > 0.01;
      const pullChanged = Math.abs(pull - 3.5) > 0.01;

      if (!isDefaultUntouchedRange && !faceChanged) {
        if (pullChanged && Math.abs(maxR - minR - 3.5) < 0.01) {
          return {
            fromRd: Number(minR.toFixed(2)),
            toRd: Number((minR + pull).toFixed(2)),
          };
        }
        return {
          fromRd: Number(minR.toFixed(2)),
          toRd: Number(maxR.toFixed(2)),
        };
      }
    }
  }

  // 3. Compute directly from Face RD (faceM) and Pull (pull)
  const effectiveRd = faceM !== null && !isNaN(faceM) ? faceM : 0;
  if (effectiveRd <= 0.001) {
    return {
      fromRd: 0,
      toRd: Number(pull.toFixed(2)),
    };
  }
  if (effectiveRd >= pull) {
    const start = Number((effectiveRd - pull).toFixed(2));
    return {
      fromRd: start,
      toRd: Number(effectiveRd.toFixed(2)),
    };
  }
  return {
    fromRd: Number(effectiveRd.toFixed(2)),
    toRd: Number((effectiveRd + pull).toFixed(2)),
  };
}

export interface LiveActiveStripSessionInput {
  settings?: TunnelSettings;
  geometry?: TunnelGeometry;
  joints?: Joint[];
  jointSets?: JointSet[];
  lithologyRegions?: LithologyRegion[];
  placedSymbols?: PlacedGeologicalSymbol[];
  rmrParams?: RmrParameters;
  qIndexParams?: QIndexParameters;
  gsiParams?: GsiParameters;
  rockMassSummary?: RockMassSummaryTable;
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  photos?: Record<SurfaceType, PhotoSurface>;
}

function mapRawRockToStripRockType(rawRock: string): {
  rockType: StripRockTypeId;
  codeSymbol: string;
} {
  const s = (rawRock || '').toLowerCase();
  if (s.includes('vein')) return { rockType: 'Quartz veins', codeSymbol: '+ + +' };
  if (s.includes('dolerite') || s.includes('dyke') || s.includes('basalt') || s.includes('gabbro'))
    return { rockType: 'Dolerite', codeSymbol: 'Dol' };
  if (s.includes('quartzitic') && s.includes('phyllite'))
    return { rockType: 'Quartzitic Phyllite', codeSymbol: 'QP' };
  if (s.includes('phyllitic') && s.includes('quartzite'))
    return { rockType: 'Phyllitic Quartzite', codeSymbol: 'PQ' };
  if (s.includes('phyllite') || s.includes('slate'))
    return { rockType: 'Phyllite', codeSymbol: 'Ph' };
  if (s.includes('schist') || s.includes('gneiss'))
    return { rockType: 'Mica Schist', codeSymbol: 'Ms' };
  if (s.includes('siltstone')) return { rockType: 'Siltstone', codeSymbol: 'Slt' };
  if (s.includes('shale') || s.includes('clay')) return { rockType: 'Shale', codeSymbol: 'Sh' };
  if (s.includes('sandstone') || s.includes('metasandstone'))
    return { rockType: 'Metasandstone', codeSymbol: 'Mss' };
  return { rockType: 'Quartzite', codeSymbol: 'Qtz' };
}

function mapInfillingToFillingThickness(infilling?: string, apertureMm?: string): StripFillingThicknessId {
  const s = `${infilling || ''} ${apertureMm || ''}`.toLowerCase();
  if (s.includes('>10') || s.includes('10cm') || s.includes('gouge') || s.includes('thick'))
    return '>10cm';
  if (s.includes('5-10') || s.includes('5~10') || s.includes('> 5 mm')) return '5~10cm';
  if (s.includes('2-5') || s.includes('2~5') || s.includes('1-5') || s.includes('1–5'))
    return '2~5cm';
  if (s.includes('none') || s.includes('clean') || s.includes('tight')) return 'None';
  return 'Clay Coated';
}

/**
 * Rotates normalized 2D unwrapped surface coordinates (u2d in [0, 1] left-to-right, v2d in [0, 1] top-to-bottom)
 * 90 degrees clockwise around the center (0.5, 0.5) to map from the horizontal 2D unwrapped view
 * onto the vertical 3D unwrapped strip, while keeping trace and dip angles identical.
 *
 * Mathematical 90° clockwise rotation in screen/image space (+u right, +v down):
 *   u3d = 1 - v2d   (maps 2D bottom-to-top axis onto 3D left-to-right chainage axis)
 *   v3d = u2d       (maps 2D left-to-right axis onto 3D top-to-bottom perimeter axis)
 */
export function rotateUnwrapped2DTo3DClockwise90(
  u2d: number,
  v2d: number
): { u3d: number; v3d: number } {
  const clampedU = Math.max(0, Math.min(1, u2d));
  const clampedV = Math.max(0, Math.min(1, v2d));
  return {
    u3d: Math.max(0, Math.min(1, 1 - clampedV)),
    v3d: clampedU,
  };
}

/**
 * Unwraps a 2D point from any of the 4 mapping surfaces ('leftWall', 'crown', 'rightWall', 'face')
 * into authoritative 3D continuous strip coordinates by rotating the 2D unwrapped trace 90° clockwise:
 * - x = Chainage RD (m) within [interval.fromRd, interval.toRd]
 * - y = Unfolded Perimeter Offset (m) within [0, totalPerimM]
 *       where [0 .. leftWallArc] = Left Wall (Floor to Left Springline),
 *             [leftWallArc .. leftWallArc + crownArc] = Crown Arch (Left to Right Springline),
 *             [leftWallArc + crownArc .. totalPerimM] = Right Wall (Right Springline to Floor).
 */
export function mapUnwrappedSurfacePointTo3DStrip(
  pt: Point2D,
  surface: SurfaceType,
  interval: { fromRd: number; toRd: number },
  roundLen: number,
  geom: TunnelGeometry | undefined,
  leftWallArc: number,
  crownArc: number,
  rightWallArc: number,
  totalPerimM: number,
  _jointDipDir?: number,
  _jointDip?: number,
  _driveAzimuth = 0,
  _vertexFrac = 0.5
): Point2D {
  const pullSpan = Math.max(0.5, interval.toRd - interval.fromRd);
  const safeRound = Math.max(0.5, roundLen || pullSpan);
  const width = Math.max(1.5, geom?.width || 8.4);
  const height = Math.max(1.5, geom?.height || 7.2);
  const wallH = Math.max(0.5, geom?.wallHeight || height * 0.58);

  // Exact canvas box matching computePanelCanvasGeometry (845x810 area centered at 500, 495)
  let panelW = width;
  let panelH = height;
  if (surface === 'crown') {
    panelW = Math.max(0.5, crownArc || width);
    panelH = safeRound;
  } else if (surface === 'leftWall' || surface === 'rightWall') {
    panelW = safeRound;
    panelH = Math.max(0.5, surface === 'leftWall' ? leftWallArc : rightWallArc);
  }
  const maxBoxW = 845;
  const maxBoxH = 810;
  const pxPerMeter = Math.min(maxBoxW / Math.max(0.5, panelW), maxBoxH / Math.max(0.5, panelH));
  const boxW = panelW * pxPerMeter;
  const boxH = panelH * pxPerMeter;
  const boxX = 500 - boxW / 2;
  const boxY = 495 - boxH / 2;

  // Determine whether input point is already in physical metric coordinates [meters]
  // or in canonical SVG canvas coordinates [0..1000]
  const isDirectMetric = pt.x <= panelW * 1.15 && pt.y <= panelH * 1.15 && pt.x >= 0 && pt.y >= 0;

  if (isDirectMetric) {
    if (surface === 'leftWall') {
      const pullX = Math.max(0, Math.min(pullSpan, pt.x));
      const normH = Math.max(0, Math.min(1, pt.y / Math.max(0.1, leftWallArc)));
      const rdX = interval.fromRd + pullX;
      const perimY = normH * leftWallArc;
      return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
    }
    if (surface === 'crown') {
      const u = Math.max(0, Math.min(1, pt.x / Math.max(0.1, crownArc)));
      const pullX = Math.max(0, Math.min(pullSpan, pt.y));
      const rdX = interval.fromRd + pullX;
      const perimY = leftWallArc + u * crownArc;
      return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
    }
    if (surface === 'rightWall') {
      const pullX = Math.max(0, Math.min(pullSpan, pt.x));
      const normH = Math.max(0, Math.min(1, pt.y / Math.max(0.1, rightWallArc)));
      const rdX = interval.fromRd + pullX;
      const perimY = leftWallArc + crownArc + (1 - normH) * rightWallArc;
      return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
    }
    // face surface in metric coordinates (pt.x = cross-chainage [0..width], pt.y = height above invert floor [0..height])
    const faceX = Math.max(0, Math.min(width, pt.x));
    const faceZ = Math.max(0, Math.min(height, pt.y));

    let perimY = totalPerimM * 0.5;
    if (faceZ >= wallH) {
      // Crown Arch portion of the face
      const normArch = Math.max(0, Math.min(1, faceX / Math.max(0.1, width)));
      perimY = leftWallArc + normArch * crownArc;
    } else if (faceX < width * 0.5) {
      // Left Wall portion of the face
      const normWall = Math.max(0.01, Math.min(1, faceZ / Math.max(0.1, wallH)));
      perimY = normWall * leftWallArc;
    } else {
      // Right Wall portion of the face
      const normWall = Math.max(0.01, Math.min(1, faceZ / Math.max(0.1, wallH)));
      perimY = leftWallArc + crownArc + (1 - normWall) * rightWallArc;
    }
    return {
      x: Number(interval.toRd.toFixed(3)),
      y: Number(Math.max(0.05, Math.min(totalPerimM - 0.05, perimY)).toFixed(3)),
    };
  }

  // Normalized (u, v) in panel box from canvas pixels
  const u =
    pt.x >= boxX - 40 && pt.x <= boxX + boxW + 40
      ? Math.max(0, Math.min(1, (pt.x - boxX) / Math.max(1, boxW)))
      : pt.x > Math.max(15, safeRound * 1.5)
      ? Math.max(0, Math.min(1, pt.x / 1000))
      : Math.max(0, Math.min(1, pt.x / Math.max(0.1, panelW)));

  const v =
    pt.y >= boxY - 40 && pt.y <= boxY + boxH + 40
      ? Math.max(0, Math.min(1, (pt.y - boxY) / Math.max(1, boxH)))
      : pt.y > Math.max(15, panelH * 1.5)
      ? Math.max(0, Math.min(1, pt.y / 800))
      : Math.max(0, Math.min(1, pt.y / Math.max(0.1, panelH)));

  if (surface === 'leftWall') {
    // u is fraction along pull (0 = start of pull, 1 = face)
    // v is fraction from springline (0) down to invert floor (1)
    const pullX = u * pullSpan;
    const normH = 1 - v; // 0 at invert floor, 1 at springline
    const rdX = interval.fromRd + pullX;
    const perimY = normH * leftWallArc;
    return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
  }

  if (surface === 'crown') {
    // u is fraction across crown arch (0 = Left Springline, 1 = Right Springline)
    // v is fraction along pull (0 = face at top, 1 = start of pull at bottom)
    const pullX = (1 - v) * pullSpan;
    const rdX = interval.fromRd + pullX;
    const perimY = leftWallArc + u * crownArc;
    return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
  }

  if (surface === 'rightWall') {
    // Canvas u: 0 = Face advance (pullSpan), 1 = start of pull (0m)
    // Canvas v: 0 = right springline, 1 = invert floor
    const pullX = (1 - u) * pullSpan;
    const rdX = interval.fromRd + pullX;
    const perimY = leftWallArc + crownArc + v * rightWallArc;
    return { x: Number(rdX.toFixed(3)), y: Number(perimY.toFixed(3)) };
  }

  // 'face' surface from canvas coordinates:
  // u is fraction across width (0 = Left Wall, 1 = Right Wall)
  // v is fraction from crown apex (0) down to floor (1)
  const faceX = u * width;
  const faceZ = (1 - v) * height;

  let perimY = totalPerimM * 0.5;
  if (faceZ >= wallH) {
    // Point is on Crown Arch portion of the face
    const normArch = Math.max(0, Math.min(1, u));
    perimY = leftWallArc + normArch * crownArc;
  } else if (faceX < width * 0.5) {
    // Point is on Left Wall portion of the face
    const normWall = Math.max(0.01, Math.min(1, faceZ / wallH));
    perimY = normWall * leftWallArc;
  } else {
    // Point is on Right Wall portion of the face
    const normWall = Math.max(0.01, Math.min(1, faceZ / wallH));
    perimY = leftWallArc + crownArc + (1 - normWall) * rightWallArc;
  }

  // The face trace is at the actual excavation face chainage (interval.toRd)
  const rdX = interval.toRd;

  return {
    x: Number(rdX.toFixed(3)),
    y: Number(Math.max(0.05, Math.min(totalPerimM - 0.05, perimY)).toFixed(3)),
  };
}

function derivePullReportDetailsFromRecord(
  rec: SavedProjectRecord,
  pullSpan: number,
  liveOverbreak?: OverbreakUndercutAnalysis
) {
  const rmrParams = rec.rmrParams;
  const qParams = rec.qIndexParams;
  const gsiParams = rec.gsiParams;
  const summary = rec.rockMassSummary;
  const joints = rec.joints || [];

  // 1. Calculate RMR Value & Rock Class
  let rmrValue: number | undefined;
  let rmrClassNum: string | undefined;
  if (rmrParams) {
    const rmrCalc = calculateBieniawskiRmr(rmrParams);
    if (rmrCalc.finalRmr !== null) {
      rmrValue = rmrCalc.finalRmr;
      rmrClassNum = rmrCalc.rockMassClassNumber;
    } else {
      // Sum available sub-ratings even if some parameter is still unconfirmed
      const r1 = rmrParams.intactStrengthRating ?? 12;
      const r2 = rmrParams.rqdRating ?? 15;
      const r3 = rmrParams.spacingRating ?? 10;
      const r4 = rmrParams.conditionSubRatings?.useDetailedSubRatings
        ? (rmrParams.conditionSubRatings.persistenceRating || 0) +
          (rmrParams.conditionSubRatings.apertureRating || 0) +
          (rmrParams.conditionSubRatings.roughnessRating || 0) +
          (rmrParams.conditionSubRatings.infillingRating || 0) +
          (rmrParams.conditionSubRatings.weatheringRating || 0)
        : (rmrParams.conditionRating ?? 20);
      const r5 = rmrParams.groundwaterRating ?? 12;
      const rAdj = rmrParams.orientationAdjustmentRating ?? -2;
      const hasAnyRmr =
        rmrParams.intactStrengthRating !== null ||
        rmrParams.rqdRating !== null ||
        rmrParams.spacingRating !== null ||
        rmrParams.conditionRating !== null ||
        rmrParams.groundwaterRating !== null;
      if (hasAnyRmr) {
        rmrValue = Math.max(5, Math.min(100, Math.round(r1 + r2 + r3 + r4 + r5 + rAdj)));
      }
    }
  }

  // 2. Calculate Q-System & RQD
  let qValue: number | undefined;
  let rqdValue: number | undefined = rmrParams?.rqdPercent ?? qParams?.rqd;
  if (qParams && qParams.rqd > 0) {
    const qCalc = calculateBartonQSystem(qParams, rec.geometry?.width || 8.4);
    qValue = Number(qCalc.qValue.toFixed(2));
    if (rqdValue === undefined || rqdValue === null) {
      rqdValue = Math.round(qParams.rqd);
    }
    if (rmrValue === undefined && qValue > 0) {
      // Bieniawski (1976) correlation RMR = 9 ln(Q) + 44
      rmrValue = Math.max(15, Math.min(95, Math.round(9 * Math.log(qValue) + 44)));
    }
  }
  if (rqdValue === undefined && joints.length > 0) {
    const faceArea = Math.max(12, rec.geometry?.designAreaSqMeters || 45);
    const totalLen = joints.reduce((acc, j) => acc + (j.persistenceMeters || 2.0), 0);
    const jv = Math.max(3, Math.min(32, Math.round((totalLen / faceArea) * 8.5 + joints.length * 0.6)));
    rqdValue = Math.max(15, Math.min(98, Math.round(115 - 3.3 * jv)));
  }
  if (rmrValue === undefined && rqdValue !== undefined) {
    rmrValue = Math.max(25, Math.min(88, Math.round(rqdValue * 0.78 + 6)));
  }

  if (!rmrClassNum && rmrValue !== undefined) {
    rmrClassNum =
      rmrValue >= 81
        ? 'I'
        : rmrValue >= 61
        ? 'II'
        : rmrValue >= 41
        ? 'III'
        : rmrValue >= 21
        ? 'IV'
        : 'V';
  }

  // 3. GSI Value
  let gsiValue: number | undefined;
  if (gsiParams?.structureRating && gsiParams?.surfaceConditionRating) {
    gsiValue = Math.round((gsiParams.structureRating + gsiParams.surfaceConditionRating) * 0.5);
  } else if (rmrValue !== undefined) {
    gsiValue = Math.max(10, rmrValue - 5);
  }

  // 4. Weathering Condition
  const weatheringCondition =
    summary?.weatheringGrade?.trim() ||
    rmrParams?.conditionSubRatings?.weatheringValue?.trim() ||
    (rmrValue !== undefined && rmrValue >= 65
      ? 'W1 - W2 (Fresh to Slightly Weathered)'
      : rmrValue !== undefined && rmrValue >= 45
      ? 'W2 (Slightly Weathered)'
      : rmrValue !== undefined
      ? 'W3 (Moderately Weathered)'
      : 'W2 (Slightly Weathered)');

  // 5. Intact Rock Strength (UCS MPa)
  const ucsRangeMpa =
    summary?.strengthGrade?.trim() ||
    (rmrParams?.intactStrengthValueMPa
      ? `${rmrParams.intactStrengthValueMPa} MPa (${rmrParams.intactStrengthDescription || 'Strong Rock'})`
      : gsiParams?.intactUcsMPa
      ? `${gsiParams.intactUcsMPa} MPa`
      : '100–200 MPa (Very Strong)');

  // 6. Groundwater / Seepage Condition
  const wetJointCond = joints.find(
    (j) => j.waterCondition && j.waterCondition !== 'Dry'
  )?.waterCondition;
  const seepageCondition =
    summary?.groundwaterCondition?.trim() ||
    rmrParams?.groundwaterDescription?.trim() ||
    qParams?.jwDescription?.trim() ||
    wetJointCond?.toUpperCase() ||
    'DRY';

  // 7. Structure & Foliation Characteristics from Mapped Joints + Summary
  const setGroups = new Map<string, Joint[]>();
  for (const j of joints) {
    const sId = j.set || 'J1';
    const arr = setGroups.get(sId) || [];
    arr.push(j);
    setGroups.set(sId, arr);
  }
  const setSummaries: string[] = [];
  setGroups.forEach((jList, sId) => {
    const meanDipDir = Math.round(
      jList.reduce((a, b) => a + b.dipDirection, 0) / Math.max(1, jList.length)
    );
    const meanDip = Math.round(
      jList.reduce((a, b) => a + b.dip, 0) / Math.max(1, jList.length)
    );
    setSummaries.push(
      `${sId} (${String(meanDipDir).padStart(3, '0')}/${String(meanDip).padStart(2, '0')}°, n=${jList.length})`
    );
  });

  const mappedSurfaces = Array.from(new Set(joints.map((j) => j.surface)));
  const autoStructureText =
    joints.length > 0
      ? `Mapped ${joints.length} discontinuities across ${mappedSurfaces.join(', ')}: ${setSummaries.join(', ')}. ${
          rmrParams?.conditionDescription || ''
        }`.trim()
      : '';

  const structureDescription =
    summary?.geologistRemarks?.trim() && autoStructureText
      ? `${summary.geologistRemarks.trim()} | ${autoStructureText}`
      : summary?.geologistRemarks?.trim() ||
        autoStructureText ||
        'Blocky & jointed rock mass; systematic joint sets observed across tunnel perimeter.';

  const sampleJoint = joints[0];
  const autoFoliationText = sampleJoint
    ? `Spacing: ${
        rmrParams?.spacingDescription || summary?.foliationBeddingSpacing || '0.2–0.6m (Moderately Spaced)'
      }; Roughness: ${sampleJoint.roughness || 'Slightly rough'}; Aperture: ${
        sampleJoint.apertureMm || '0.5–2.0mm'
      }; Infilling: ${sampleJoint.infilling || 'Clay/Quartz coated'}.`
    : '';

  const foliationCharacteristics =
    summary?.foliationBeddingSpacing?.trim() && !autoFoliationText
      ? summary.foliationBeddingSpacing.trim()
      : autoFoliationText ||
        rmrParams?.conditionDescription?.trim() ||
        'Joints closely to moderately spaced, continuous, slightly rough planar to undulating.';

  // 8. Overbreak Volume (m³)
  const overbreakVolumeM3 = Number(
    (
      rec.quantitySummary?.overbreakVolumeM3 ??
      liveOverbreak?.overbreakVolumeCubicMeters ??
      (rec.quantitySummary?.overbreakAreaSqM
        ? rec.quantitySummary.overbreakAreaSqM * pullSpan
        : liveOverbreak?.overbreakAreaSqMeters
        ? liveOverbreak.overbreakAreaSqMeters * pullSpan
        : 0)
    ).toFixed(3)
  );

  // 9. Support Class & Installed Support Breakdown (Shotcrete, Mesh, Bolts, Steel Ribs, Forepoling)
  const rockClass = summary?.rockUnit?.trim() || rmrClassNum || 'II';
  const supportClass =
    rmrClassNum === 'I'
      ? 'Class I (Spot Bolting)'
      : rmrClassNum === 'II'
      ? 'Class II (2/3a)'
      : rmrClassNum === 'III'
      ? 'Class III (3b)'
      : rmrClassNum === 'IV'
      ? 'Class IV (Heavy SFRS + Ribs)'
      : rmrClassNum === 'V'
      ? 'Class V (Ribs + Forepoling)'
      : `Class ${rockClass}`;

  const rawSupport = summary?.installedSupport?.trim() || '';
  const shotcreteMatch = rawSupport.match(/(\d+\s*(?:mm|cm)\s*(?:SFRS|Wet|Shotcrete)?)/i);
  const boltMatch = rawSupport.match(/(L\s*=\s*\d+(?:\.\d+)?\s*m[^,;]*|\d+\/\d+m[^,;]*)/i);
  const ribMatch = rawSupport.match(/((?:ISMB|HEB|TH)\s*\d+[^,;]*)/i);
  const forepoleMatch = rawSupport.match(/(Forepol[^,;]*)/i);

  const shotcreteInstalled = shotcreteMatch
    ? shotcreteMatch[1]
    : rmrValue !== undefined && rmrValue < 45
    ? '150mm SFRS'
    : '100mm SFRS / WET';
  const wireMeshInstalled =
    rawSupport.toLowerCase().includes('mesh') || (rmrValue !== undefined && rmrValue <= 65)
      ? '1 Layer Weld Mesh'
      : '1 Layer';
  const rockBoltsInstalled = boltMatch
    ? boltMatch[1]
    : rmrValue !== undefined && rmrValue < 45
    ? 'L=4.0m @ 1.2m c/c SN Bolts'
    : 'L=3.5m @ 1.5m c/c SN Bolts';
  const steelRibsInstalled = ribMatch
    ? ribMatch[1]
    : rmrValue !== undefined && rmrValue < 35
    ? 'ISMB 150 @ 1.0m c/c'
    : '-';
  const forepolingInstalled = forepoleMatch
    ? forepoleMatch[1]
    : rmrValue !== undefined && rmrValue < 25
    ? 'Ø32mm SDA L=4.0m'
    : '-';

  const supportDescription =
    rawSupport ||
    `${shotcreteInstalled}, ${wireMeshInstalled}, ${rockBoltsInstalled}${
      steelRibsInstalled !== '-' ? `, ${steelRibsInstalled}` : ''
    }`;

  // 10. Photo Roll / Negative Record Summary from uploaded surface photos
  const uploadedSurfaces = (['face', 'crown', 'leftWall', 'rightWall'] as SurfaceType[]).filter(
    (s) => Boolean(rec.photos?.[s]?.image)
  );
  const photoRollNo = uploadedSurfaces.length > 0 ? `DIG-${uploadedSurfaces.length}S` : '';
  const photoNegativeNo =
    uploadedSurfaces.length > 0
      ? uploadedSurfaces
          .map((s) => (s === 'face' ? 'F' : s === 'crown' ? 'C' : s === 'leftWall' ? 'LW' : 'RW'))
          .join('+')
      : '';

  return {
    rmrValue,
    rqdValue,
    qValue,
    gsiValue,
    rockClass,
    supportClass,
    weatheringCondition,
    ucsRangeMpa,
    seepageCondition,
    structureDescription,
    foliationCharacteristics,
    overbreakVolumeM3,
    shotcreteInstalled,
    wireMeshInstalled,
    rockBoltsInstalled,
    steelRibsInstalled,
    forepolingInstalled,
    supportDescription,
    photoRollNo,
    photoNegativeNo,
  };
}

export function syncSavedProjectsIntoStripDatasets(
  existingDatasets: ContinuousTunnelStripDataset[],
  savedProjects: SavedProjectRecord[],
  activeSettings?: TunnelSettings,
  activeGeometry?: TunnelGeometry,
  activeJoints?: Joint[],
  activeLithology?: LithologyRegion[],
  activeSymbols?: PlacedGeologicalSymbol[],
  liveSessionExtra?: LiveActiveStripSessionInput
): ContinuousTunnelStripDataset[] {
  let list =
    existingDatasets.length > 0
      ? [...existingDatasets]
      : [createFreshDefaultStripDataset()];

  // Build a combined list of records: all savedProjects PLUS the live active Face/Unwrapped Log session
  // so that everything mapped in the active workspace automatically feeds into 3D logging immediately!
  const allRecords: SavedProjectRecord[] = [...savedProjects];

  const effSettings = liveSessionExtra?.settings || activeSettings;
  const effGeometry = liveSessionExtra?.geometry || activeGeometry;
  // Include all mapped discontinuities across Face, Crown, and Walls
  const effJoints = (liveSessionExtra?.joints || activeJoints || []);
  const effLithology = (liveSessionExtra?.lithologyRegions || activeLithology || []);
  const effSymbols = (liveSessionExtra?.placedSymbols || activeSymbols || []);
  const effRmr = liveSessionExtra?.rmrParams;
  const effQ = liveSessionExtra?.qIndexParams;
  const effGsi = liveSessionExtra?.gsiParams;
  const effSummary = liveSessionExtra?.rockMassSummary;
  const effOverbreak = liveSessionExtra?.overbreakAnalysis;
  const effPhotos = liveSessionExtra?.photos;

  const hasLiveWallCrownPhotos = Boolean(
    effPhotos?.leftWall?.warpedImage ||
      effPhotos?.leftWall?.image ||
      effPhotos?.crown?.warpedImage ||
      effPhotos?.crown?.image ||
      effPhotos?.rightWall?.warpedImage ||
      effPhotos?.rightWall?.image
  );

  const hasLiveContent =
    effJoints.length > 0 ||
    effLithology.length > 0 ||
    effSymbols.length > 0 ||
    hasLiveWallCrownPhotos ||
    Boolean(effSummary?.rockType?.trim()) ||
    Boolean(effSummary?.weatheringGrade?.trim()) ||
    Boolean(effRmr?.intactStrengthRating !== null && effRmr?.intactStrengthRating !== undefined) ||
    Boolean(effQ?.rqd);

  // Always sync the active Face Mapping pull & RD session into 3D so the merged 3-surface strip (Left Wall, Crown, Right Wall) is immediately visible for the current Pull & RD
  if (effSettings && effGeometry) {
    const liveProjName = (effSettings.projectName || 'New Tunnel Project').trim();
    const liveLocName = (effSettings.locationName || effSettings.tunnelName || 'Main Tunnel Heading').trim();
    const liveInterval = parsePullIntervalFromRecord(
      effSettings.chainage || '',
      effSettings.faceChainage || '',
      effSettings.roundLength || 3.5
    );

    const matchingSavedIdx = allRecords.findIndex((r) => {
      const rProj = (r.projectName || r.settings?.projectName || 'Underground Project').trim();
      const rLoc = (r.tunnelName || r.location || 'Main Tunnel').trim();
      if (
        rProj.toLowerCase() !== liveProjName.toLowerCase() ||
        rLoc.toLowerCase() !== liveLocName.toLowerCase()
      ) {
        return false;
      }
      const rInt = parsePullIntervalFromRecord(
        r.chainage,
        r.faceChainage,
        r.settings?.roundLength || 3.5
      );
      return Math.abs(rInt.fromRd - liveInterval.fromRd) < 0.2 && Math.abs(rInt.toRd - liveInterval.toRd) < 0.2;
    });

    const synthesizedLiveRecord: SavedProjectRecord = {
      id: matchingSavedIdx >= 0 ? allRecords[matchingSavedIdx].id : `live-${liveInterval.fromRd}-${liveInterval.toRd}`,
      projectName: liveProjName,
      tunnelName: liveLocName,
      location: liveLocName,
      chainage: effSettings.chainage || `RD ${liveInterval.fromRd}m - ${liveInterval.toRd}m`,
      faceChainage: effSettings.faceChainage || `RD ${liveInterval.toRd}m`,
      numericChainageMeters: liveInterval.toRd,
      date: effSettings.date || new Date().toISOString().slice(0, 10),
      savedAt: new Date().toISOString(),
      mappingMode: 'tunnel_3d',
      geometry: effGeometry,
      settings: effSettings,
      photos: (effPhotos || {}) as Record<SurfaceType, PhotoSurface>,
      joints: effJoints,
      customJointSetOverrides: {},
      qIndexParams: effQ || {
        rqd: 75,
        jn: 6,
        jnDescription: 'Two joint sets plus random',
        jr: 2,
        jrDescription: 'Smooth, undulating',
        ja: 2,
        jaDescription: 'Slightly altered joint walls',
        jw: 1,
        jwDescription: 'Dry excavations or minor inflow',
        srf: 1,
        srfDescription: 'Medium stress, favorable stress condition',
        excavationCategory: 'Permanent mine openings / water tunnels (ESR = 1.6)',
        esr: 1.0,
      },
      rmrParams: effRmr,
      gsiParams: effGsi,
      rockMassSummary: effSummary || {
        rockType: effSettings.lithology || 'Quartzite',
        rockUnit: 'Class II',
        weatheringGrade: 'W2 (Slightly Weathered)',
        strengthGrade: '100–200 MPa (Very Strong)',
        foliationBeddingSpacing: '0.2–0.6 m (Moderately Spaced)',
        groundwaterCondition: 'Dry to Damp',
        overbreakCondition: 'Minor structural overbreak',
        installedSupport: '100mm SFRS + 1 Layer Wire Mesh + L=3.5m SN Rock Bolts',
        geologistRemarks: '',
      },
      lithologyRegions: effLithology,
      controlPoints: [],
      surveyProfile: {
        surface: 'face',
        orderedControlPointIds: [],
        isClosed: true,
        visible: true,
        locked: false,
        pullIntervalMeters: effSettings.roundLength || 3.5,
        useValidPullInterval: true,
        zoneReasonOverrides: {},
        overallOverbreakCategory: 'GEOLOGICAL',
        overallOverbreakReason: '',
        overallUndercutCategory: 'MECHANICAL_EXCAVATION',
        overallUndercutReason: '',
      },
      placedSymbols: effSymbols,
      quantitySummary: {
        designAreaSqM: effOverbreak?.designAreaSqMeters || effGeometry.designAreaSqMeters || 45,
        surveyedAreaSqM: effOverbreak?.surveyedAreaSqMeters || effGeometry.designAreaSqMeters || 45,
        overbreakAreaSqM: effOverbreak?.overbreakAreaSqMeters || 0,
        undercutAreaSqM: effOverbreak?.undercutAreaSqMeters || 0,
        overbreakPct: effOverbreak?.overbreakPercentage || 0,
        undercutPct: effOverbreak?.undercutPercentage || 0,
        maxOverbreakM: effOverbreak?.maxRadialOverbreakMeters || 0,
        maxUndercutM: effOverbreak?.maxRadialUndercutMeters || 0,
        pullIntervalM: effSettings.roundLength || 3.5,
        overbreakVolumeM3: effOverbreak?.overbreakVolumeCubicMeters ?? null,
        undercutVolumeM3: effOverbreak?.undercutVolumeCubicMeters ?? null,
      },
    };

    if (matchingSavedIdx >= 0) {
      allRecords[matchingSavedIdx] = synthesizedLiveRecord;
    } else {
      allRecords.push(synthesizedLiveRecord);
    }
  }

  // If only the blank default workspace exists and the user entered a project/location name in setup, sync those names
  if (
    list.length === 1 &&
    list[0].id === 'dataset-fresh-workspace' &&
    list[0].pulls.length === 0 &&
    list[0].traces.length === 0
  ) {
    const activeProj = effSettings?.projectName?.trim();
    const activeLoc =
      effSettings?.locationName?.trim() || effSettings?.tunnelName?.trim();
    if (activeProj || activeLoc) {
      list[0] = {
        ...list[0],
        projectName: activeProj || list[0].projectName,
        tunnelLocationName: activeLoc || list[0].tunnelLocationName,
        tunnelDiameterWidthM: effGeometry?.width || list[0].tunnelDiameterWidthM,
        tunnelArchHeightM: effGeometry?.height || list[0].tunnelArchHeightM,
      };
    }
  }

  const groups = new Map<string, SavedProjectRecord[]>();
  for (const rec of allRecords) {
    const pName = (rec.projectName || rec.settings?.projectName || 'Underground Project').trim();
    const tName = (rec.tunnelName || rec.location || 'Main Tunnel').trim();
    const key = `${pName}:::${tName}`;
    const arr = groups.get(key) || [];
    arr.push(rec);
    groups.set(key, arr);
  }

  groups.forEach((records, key) => {
    const [projectName, tunnelLocationName] = key.split(':::');
    let dataset = list.find(
      (d) =>
        d.projectName.trim().toLowerCase() === projectName.toLowerCase() &&
        d.tunnelLocationName.trim().toLowerCase() === tunnelLocationName.toLowerCase()
    );

    const firstGeom = records[0]?.geometry || effGeometry;
    const leftWallArc = Number((firstGeom?.leftWallArcLength || firstGeom?.wallHeight || 4.2).toFixed(2));
    const rightWallArc = Number((firstGeom?.rightWallArcLength || firstGeom?.wallHeight || 4.2).toFixed(2));
    const crownArc = Number((firstGeom?.crownArcLength || 6.0).toFixed(2));
    const upperW = Number((leftWallArc + crownArc * 0.5).toFixed(1));
    const lowerW = Number((rightWallArc + crownArc * 0.5).toFixed(1));
    const totalPerimM = Number((upperW + lowerW).toFixed(2));

    if (!dataset) {
      const driveDeg = Math.round(records[0]?.settings?.driveDirection ?? 0);
      const oppDeg = (driveDeg + 180) % 360;
      dataset = {
        id: `ds-${projectName.replace(/\s+/g, '_')}-${tunnelLocationName.replace(/\s+/g, '_')}`,
        projectName,
        tunnelLocationName,
        clientName: records[0]?.settings?.sheetConfig?.clientName || '',
        contractorName: records[0]?.settings?.sheetConfig?.contractorName || '',
        geologistContractor: records[0]?.settings?.mappedBy || '',
        geologistClient: '',
        upperZoneLabel: 'LEFT WALL TO CROWN (SPRING LINE)',
        lowerZoneLabel: 'CROWN TO RIGHT WALL (SPRING LINE)',
        upperZoneWidthM: upperW,
        lowerZoneWidthM: lowerW,
        leftWallArcLengthM: leftWallArc,
        crownArcLengthM: crownArc,
        rightWallArcLengthM: rightWallArc,
        leftWallHeightM: leftWallArc,
        crownWidthM: crownArc,
        rightWallHeightM: rightWallArc,
        tunnelDiameterWidthM: firstGeom?.width || 8.4,
        tunnelArchHeightM: firstGeom?.height || 7.2,
        viewFromRd: 0,
        viewToRd: 30,
        leftCornerAzimuthLabel: `${String(oppDeg).padStart(3, '0')}°N`,
        rightCornerAzimuthLabel: `${String(driveDeg).padStart(3, '0')}°N`,
        pulls: [],
        traces: [],
        lithologyZones: [],
        waterSymbols: [],
        narrativeBullets: [],
        sheetConfig: getDefaultSheetConfig({
          projectName,
          tunnelLocationName,
        }),
        updatedAt: new Date().toISOString(),
      };
      list.push(dataset);
    } else {
      dataset.upperZoneWidthM = upperW;
      dataset.lowerZoneWidthM = lowerW;
      dataset.leftWallArcLengthM = leftWallArc;
      dataset.crownArcLengthM = crownArc;
      dataset.rightWallArcLengthM = rightWallArc;
      dataset.leftWallHeightM = leftWallArc;
      dataset.crownWidthM = crownArc;
      dataset.rightWallHeightM = rightWallArc;
      dataset.tunnelDiameterWidthM = firstGeom?.width || dataset.tunnelDiameterWidthM;
      dataset.tunnelArchHeightM = firstGeom?.height || dataset.tunnelArchHeightM;
    }

    // Purge all previous auto-synced items before re-populating strictly from Wall & Crown surfaces (leftWall, crown, rightWall).
    // This ensures any previously synced Face traces from older sessions are completely removed from 3D mapping.
    dataset.traces = dataset.traces.filter((t) => !t.id.startsWith('sync-'));
    dataset.lithologyZones = dataset.lithologyZones.filter((l) => !l.id.startsWith('sync-'));
    dataset.waterSymbols = dataset.waterSymbols.filter((w) => !w.id.startsWith('sync-'));

    for (const rec of records) {
      const roundLen = Math.max(1.0, rec.settings?.roundLength || 3.5);
      const interval = parsePullIntervalFromRecord(
        rec.chainage,
        rec.faceChainage,
        roundLen
      );
      const pullSpan = Math.max(1, interval.toRd - interval.fromRd);
      const existingPullIdx = dataset.pulls.findIndex(
        (p) => Math.abs(p.fromRd - interval.fromRd) < 0.2 && Math.abs(p.toRd - interval.toRd) < 0.2
      );
      const driveAz = Number((rec.settings?.driveDirection ?? 0).toFixed(1));
      const oppAz = Number(((driveAz + 180) % 360).toFixed(1));

      const derived = derivePullReportDetailsFromRecord(
        rec,
        pullSpan,
        rec.id.startsWith('live-') ? effOverbreak : undefined
      );

      const primaryRockName =
        rec.lithologyRegions?.[0]?.lithologyName?.trim() ||
        rec.rockMassSummary?.rockType?.trim() ||
        rec.settings?.lithology?.trim() ||
        'Quartzite';
      const mappedRockMeta = mapRawRockToStripRockType(primaryRockName);

      const pullObj: ContinuousPullRecord = {
        id:
          existingPullIdx >= 0
            ? dataset.pulls[existingPullIdx].id
            : `pull-${interval.fromRd}-${interval.toRd}`,
        fromRd: interval.fromRd,
        toRd: interval.toRd,
        driveAzimuthDeg: driveAz,
        gradientPct: existingPullIdx >= 0 ? dataset.pulls[existingPullIdx].gradientPct ?? 0.15 : 0.15,
        leftBoundaryAzimuthDeg: oppAz,
        convergenceMm: existingPullIdx >= 0 ? dataset.pulls[existingPullIdx].convergenceMm || '0 mm' : '0 mm',
        rockType: `${mappedRockMeta.codeSymbol} - ${primaryRockName}`,
        rockDescription:
          rec.lithologyRegions?.[0]?.description?.trim() ||
          rec.rockMassSummary?.geologistRemarks?.trim() ||
          `${primaryRockName}, ${derived.weatheringCondition}, ${derived.ucsRangeMpa}`,
        rockClass: derived.rockClass,
        supportDescription: derived.supportDescription,
        shotcreteInstalled: derived.shotcreteInstalled,
        wireMeshInstalled: derived.wireMeshInstalled,
        rockBoltsInstalled: derived.rockBoltsInstalled,
        steelRibsInstalled: derived.steelRibsInstalled,
        forepolingInstalled: derived.forepolingInstalled,
        seepageCondition: derived.seepageCondition,
        weatheringCondition: derived.weatheringCondition,
        ucsRangeMpa: derived.ucsRangeMpa,
        rmrValue: derived.rmrValue,
        rqdValue: derived.rqdValue,
        qValue: derived.qValue,
        gsiValue: derived.gsiValue,
        overbreakVolumeM3: derived.overbreakVolumeM3,
        excavationDefiningNo: existingPullIdx >= 0 ? dataset.pulls[existingPullIdx].excavationDefiningNo || '1' : '1',
        excavationDate: rec.date,
        supportClass: derived.supportClass,
        structureDescription: derived.structureDescription,
        foliationCharacteristics: derived.foliationCharacteristics,
        photoRollNo: derived.photoRollNo,
        photoNegativeNo: derived.photoNegativeNo,
        remarks: rec.rockMassSummary?.overbreakCondition || '',
        status: 'MAPPED',
        linkedSavedProjectId: rec.id,
        dateMapped: rec.date,
        surfacePhotos: {
          leftWall: rec.photos?.leftWall?.warpedImage || rec.photos?.leftWall?.image || undefined,
          crown: rec.photos?.crown?.warpedImage || rec.photos?.crown?.image || undefined,
          rightWall: rec.photos?.rightWall?.warpedImage || rec.photos?.rightWall?.image || undefined,
        },
      };

      if (existingPullIdx >= 0) {
        dataset.pulls[existingPullIdx] = {
          ...dataset.pulls[existingPullIdx],
          ...pullObj,
          status: 'MAPPED',
        };
      } else {
        dataset.pulls.push(pullObj);
      }

      // Remove previous auto-synced traces/lithology/water for this record ID so updates in Face/Unwrapped Log refresh cleanly
      const recPrefix = `sync-${rec.id}-`;
      dataset.traces = dataset.traces.filter((t) => !t.id.startsWith(recPrefix));
      dataset.lithologyZones = dataset.lithologyZones.filter(
        (l) => !l.id.startsWith(recPrefix) && !l.id.endsWith('-lith-base')
      );
      dataset.waterSymbols = dataset.waterSymbols.filter((w) => !w.id.startsWith(recPrefix));

      const recGeom = rec.geometry || firstGeom;
      const recLeftWallArc = Number((recGeom?.leftWallArcLength || recGeom?.wallHeight || 4.2).toFixed(2));
      const recRightWallArc = Number((recGeom?.rightWallArcLength || recGeom?.wallHeight || 4.2).toFixed(2));
      const recCrownArc = Number((recGeom?.crownArcLength || 6.0).toFixed(2));
      const recTotalPerim = Number((recLeftWallArc + recCrownArc + recRightWallArc).toFixed(2));

      // 1. Sync ONLY Unwrapped Wall & Crown Joint Traces (leftWall, crown, rightWall) — NEVER Face ('face') traces!
      // Preserve exact points and exact locations as traced on the unwrapped image (no sorting or auto-bending until AI Learn is clicked).
      const structMap: Record<string, StripStructureTypeId> = {
        bedding: 'Bedding',
        shale_band: 'Bedding',
        fault: 'Fault',
        shear: 'Shear Zone',
        shear_zone: 'Shear Zone',
        clay_band: 'Gouge/Clay Seam',
        seam: 'Gouge/Clay Seam',
        foliation: 'JS1 - Foliation',
        lineation: 'JS1 - Foliation',
        fracture: 'Fractured',
        lithological_contact: 'Lithological Boundary',
        dolerite: 'Geological Boundary',
        vein: 'Geological Boundary',
        joint: 'JS2 - Main Joint',
      };

      const allJoints = rec.joints || [];

      for (const j of allJoints) {
        if (!j.geometry || j.geometry.length < 2) continue;
        const setLabel = j.set || 'J1';
        let structureType: StripStructureTypeId =
          structMap[j.featureType || 'joint'] || 'JS2 - Main Joint';
        if (j.featureType === 'joint') {
          if (setLabel === 'J1' || setLabel === 'JS1') structureType = 'JS1 - Foliation';
          else if (setLabel === 'J2' || setLabel === 'JS2') structureType = 'JS2 - Main Joint';
          else if (setLabel === 'J3' || setLabel === 'JS3') structureType = 'JS3 - Main Joint';
          else structureType = 'Secondary Joint';
        }

        const safeRound = Math.max(0.5, roundLen);
        const spatialGeom: TunnelSpatialGeometry = {
          widthM: recGeom?.width || 8.4,
          heightM: recGeom?.height || 7.2,
          wallHeightM: recGeom?.wallHeight || 4.2,
          pullLengthM: safeRound,
          driveAzimuthDeg: driveAz,
        };

        if (j.surface === 'face') {
          if (!(j as any).allow3DPlaneProjection) {
            // Do not auto-project Face joints onto Left Wall, Crown, or Right Wall on the Strip Log unless 3D Plane Preview is enabled
            return;
          }
          // 1. Add Face trace at the Excavation Face chainage (RD = interval.toRd) using metric (x, y) profile coordinates
          const exactFaceMappedPts: Point2D[] = j.geometry.map((pt, idx) => {
            const vFrac = idx / Math.max(1, j.geometry.length - 1);
            return mapUnwrappedSurfacePointTo3DStrip(
              pt,
              'face',
              interval,
              roundLen,
              recGeom,
              recLeftWallArc,
              recCrownArc,
              recRightWallArc,
              recTotalPerim,
              j.dipDirection,
              j.dip,
              driveAz,
              vFrac
            );
          });

          const faceTraceId = `${recPrefix}tr-face-${j.id}`;
          const faceTraceObj: ContinuousStripTrace = {
            id: faceTraceId,
            structureType,
            setId: setLabel,
            orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(
              Math.round(j.dip)
            ).padStart(2, '0')}`,
            dipDirectionDeg: Math.round(j.dipDirection),
            dipDeg: Math.round(j.dip),
            fillingThickness: mapInfillingToFillingThickness(j.infilling, j.apertureMm),
            sourceSurface: 'face',
            rawPoints: exactFaceMappedPts,
            points: exactFaceMappedPts,
            metricCoordinates: {
              pullLengthM: roundLen,
              wallHeightM: spatialGeom.wallHeightM,
              widthM: spatialGeom.widthM,
              crownArcM: recCrownArc,
              localPoints: j.geometry.map((p) => ({ x: p.x, y: p.y })),
            },
          };
          dataset.traces.push(faceTraceObj);

          // 2. Compute 3D Planar Intersections with Left Wall, Crown, and Right Wall within the pull [0, roundLen]
          // so the face trace accurately intersects and continues across the strip log without any arbitrary guessing!
          if (typeof j.dipDirection === 'number' && typeof j.dip === 'number') {
            const anchor = deriveAnchorPointFromPoints(j.geometry, 'face', spatialGeom);
            const plane = constructJointPlane(j.dipDirection, j.dip, anchor, driveAz);
            const inter = calculatePlaneSurfaceIntersections(plane, spatialGeom, 'face');

            // Left Wall Projected Continuation:
            if (inter.leftWall && inter.leftWall.lengthM > 0.05) {
              const p1 = inter.leftWall.p1;
              const p2 = inter.leftWall.p2;
              const pts: Point2D[] = [
                {
                  x: Number((interval.fromRd + (p1.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number(((p1.y / spatialGeom.wallHeightM) * recLeftWallArc).toFixed(2)),
                },
                {
                  x: Number((interval.fromRd + (p2.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number(((p2.y / spatialGeom.wallHeightM) * recLeftWallArc).toFixed(2)),
                },
              ];
              dataset.traces.push({
                id: `${recPrefix}tr-proj-lw-${j.id}`,
                structureType,
                setId: setLabel,
                orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(
                  Math.round(j.dip)
                ).padStart(2, '0')}`,
                dipDirectionDeg: Math.round(j.dipDirection),
                dipDeg: Math.round(j.dip),
                fillingThickness: mapInfillingToFillingThickness(j.infilling, j.apertureMm),
                sourceSurface: 'leftWall',
                rawPoints: pts,
                points: pts,
                metricCoordinates: {
                  pullLengthM: roundLen,
                  wallHeightM: spatialGeom.wallHeightM,
                  widthM: spatialGeom.widthM,
                  crownArcM: recCrownArc,
                  localPoints: [p1, p2],
                },
              });
            }

            // Crown Projected Continuation:
            if (inter.crown && inter.crown.lengthM > 0.05) {
              const p1 = inter.crown.p1;
              const p2 = inter.crown.p2;
              const pts: Point2D[] = [
                {
                  x: Number((interval.fromRd + (p1.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number((recLeftWallArc + (p1.y / spatialGeom.widthM) * recCrownArc).toFixed(2)),
                },
                {
                  x: Number((interval.fromRd + (p2.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number((recLeftWallArc + (p2.y / spatialGeom.widthM) * recCrownArc).toFixed(2)),
                },
              ];
              dataset.traces.push({
                id: `${recPrefix}tr-proj-cr-${j.id}`,
                structureType,
                setId: setLabel,
                orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(
                  Math.round(j.dip)
                ).padStart(2, '0')}`,
                dipDirectionDeg: Math.round(j.dipDirection),
                dipDeg: Math.round(j.dip),
                fillingThickness: mapInfillingToFillingThickness(j.infilling, j.apertureMm),
                sourceSurface: 'crown',
                rawPoints: pts,
                points: pts,
                metricCoordinates: {
                  pullLengthM: roundLen,
                  wallHeightM: spatialGeom.wallHeightM,
                  widthM: spatialGeom.widthM,
                  crownArcM: recCrownArc,
                  localPoints: [p1, p2],
                },
              });
            }

            // Right Wall Projected Continuation:
            if (inter.rightWall && inter.rightWall.lengthM > 0.05) {
              const p1 = inter.rightWall.p1;
              const p2 = inter.rightWall.p2;
              const pts: Point2D[] = [
                {
                  x: Number((interval.fromRd + (p1.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number((recLeftWallArc + recCrownArc + (1 - p1.y / spatialGeom.wallHeightM) * recRightWallArc).toFixed(2)),
                },
                {
                  x: Number((interval.fromRd + (p2.x / safeRound) * pullSpan).toFixed(2)),
                  y: Number((recLeftWallArc + recCrownArc + (1 - p2.y / spatialGeom.wallHeightM) * recRightWallArc).toFixed(2)),
                },
              ];
              dataset.traces.push({
                id: `${recPrefix}tr-proj-rw-${j.id}`,
                structureType,
                setId: setLabel,
                orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(
                  Math.round(j.dip)
                ).padStart(2, '0')}`,
                dipDirectionDeg: Math.round(j.dipDirection),
                dipDeg: Math.round(j.dip),
                fillingThickness: mapInfillingToFillingThickness(j.infilling, j.apertureMm),
                sourceSurface: 'rightWall',
                rawPoints: pts,
                points: pts,
                metricCoordinates: {
                  pullLengthM: roundLen,
                  wallHeightM: spatialGeom.wallHeightM,
                  widthM: spatialGeom.widthM,
                  crownArcM: recCrownArc,
                  localPoints: [p1, p2],
                },
              });
            }
          }
        } else {
          // Left Wall, Crown, or Right Wall:
          // Remembered by exact (x, y) coordinates using pull, height, and length
          const traceId = `${recPrefix}tr-${j.id}`;
          const uvPts: Point2D[] = j.geometry.map((pt) => {
            if (j.surface === 'leftWall') {
              const u2d = Math.max(0, Math.min(1, pt.x / safeRound));
              const v2d = Math.max(0, Math.min(1, 1 - pt.y / Math.max(0.5, recLeftWallArc)));
              const { u3d, v3d } = rotateUnwrapped2DTo3DClockwise90(u2d, v2d);
              return { x: u3d, y: v3d };
            }
            if (j.surface === 'crown') {
              const u2d =
                pt.x < 0
                  ? Math.max(0, Math.min(1, (pt.x + recCrownArc * 0.5) / Math.max(0.5, recCrownArc)))
                  : Math.max(0, Math.min(1, pt.x / Math.max(0.5, recCrownArc)));
              const v2d = Math.max(0, Math.min(1, 1 - pt.y / safeRound));
              const { u3d, v3d } = rotateUnwrapped2DTo3DClockwise90(u2d, v2d);
              return { x: u3d, y: v3d };
            }
            const u2d = Math.max(0, Math.min(1, pt.x / safeRound));
            const v2d = Math.max(0, Math.min(1, 1 - pt.y / Math.max(0.5, recRightWallArc)));
            const { u3d, v3d } = rotateUnwrapped2DTo3DClockwise90(u2d, v2d);
            return { x: u3d, y: v3d };
          });
          const exactMappedPts: Point2D[] = j.geometry.map((pt, idx) => {
            const vFrac = idx / Math.max(1, j.geometry.length - 1);
            return mapUnwrappedSurfacePointTo3DStrip(
              pt,
              j.surface,
              interval,
              roundLen,
              recGeom,
              recLeftWallArc,
              recCrownArc,
              recRightWallArc,
              recTotalPerim,
              j.dipDirection,
              j.dip,
              driveAz,
              vFrac
            );
          });

          const rawTraceObj: ContinuousStripTrace = {
            id: traceId,
            structureType,
            setId: setLabel,
            orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(
              Math.round(j.dip)
            ).padStart(2, '0')}`,
            dipDirectionDeg: Math.round(j.dipDirection),
            dipDeg: Math.round(j.dip),
            fillingThickness: mapInfillingToFillingThickness(j.infilling, j.apertureMm),
            sourceSurface: j.surface as 'leftWall' | 'crown' | 'rightWall',
            uvPoints: uvPts,
            rawPoints: exactMappedPts,
            points: exactMappedPts,
            metricCoordinates: {
              pullLengthM: roundLen,
              wallHeightM: spatialGeom.wallHeightM,
              widthM: spatialGeom.widthM,
              crownArcM: recCrownArc,
              localPoints: j.geometry.map((p) => ({ x: p.x, y: p.y })),
            },
          };

          dataset.traces.push(rawTraceObj);

          // If joint has wet/dripping/flowing groundwater condition, also place a water symbol at its midpoint
          if (
            j.waterCondition &&
            j.waterCondition !== 'Dry'
          ) {
            const midPt = exactMappedPts[Math.floor(exactMappedPts.length / 2)];
            if (midPt) {
              const condMap: Record<string, StripGroundwaterId> = {
                Damp: 'Moist/Damp',
                Moist: 'Moist/Damp',
                Wet: 'Wet',
                Dripping: 'Dripping',
                Flowing: 'Flowing',
              };
              dataset.waterSymbols.push({
                id: `${recPrefix}jw-${j.id}`,
                condition: condMap[j.waterCondition] || 'Wet',
                position: { x: midPt.x, y: midPt.y },
                label: j.waterCondition,
              });
            }
          }
        }
      }

      // 2. Sync ONLY Unwrapped Wall & Crown Lithology Regions (leftWall, crown, rightWall) — NEVER Face ('face')
      // Do NOT fill empty space with synthetic base lithology polygons! Only show exact user-traced polygons.
      const wallCrownLithology = (rec.lithologyRegions || []).filter(
        (lr) => lr.surface === 'leftWall' || lr.surface === 'crown' || lr.surface === 'rightWall'
      );
      if (wallCrownLithology.length > 0) {
        for (const lr of wallCrownLithology) {
          const polyPts = lr.polygon || lr.polygonPoints || [];
          if (polyPts.length < 3) continue;
          const rockMeta = mapRawRockToStripRockType(
            `${lr.lithologyName} ${lr.patternType || ''}`
          );
          const mappedPoly = polyPts.map((pt, idx) =>
            mapUnwrappedSurfacePointTo3DStrip(
              pt,
              lr.surface,
              interval,
              roundLen,
              recGeom,
              recLeftWallArc,
              recCrownArc,
              recRightWallArc,
              recTotalPerim,
              undefined,
              undefined,
              driveAz,
              idx / Math.max(1, polyPts.length - 1)
            )
          );
          const patLower = (lr.patternType || '').toLowerCase();
          dataset.lithologyZones.push({
            id: `${recPrefix}lith-${lr.id}`,
            rockType: rockMeta.rockType,
            codeSymbol: rockMeta.codeSymbol,
            label: `${rockMeta.codeSymbol} - ${lr.lithologyName} (RD ${interval.fromRd}–${interval.toRd}m)`,
            polygon: mappedPoly,
            isIntrusionBody:
              rockMeta.rockType === 'Quartz veins' ||
              rockMeta.rockType === 'Dolerite' ||
              patLower.includes('vein') ||
              patLower.includes('dolerite'),
            isFracturedZone:
              patLower.includes('fractured') ||
              patLower.includes('shear') ||
              patLower.includes('breccia') ||
              patLower.includes('fault'),
          });
        }
      }

      // 3. Sync ONLY Wall & Crown Placed Geological Symbols (leftWall, crown, rightWall) — NEVER Face ('face')
      const wallCrownSymbols = (rec.placedSymbols || []).filter(
        (sym) => sym.surface === 'leftWall' || sym.surface === 'crown' || sym.surface === 'rightWall'
      );
      for (const sym of wallCrownSymbols) {
        if (sym.visible === false) continue;
        const stripPt = mapUnwrappedSurfacePointTo3DStrip(
          sym.point,
          sym.surface,
          interval,
          roundLen,
          recGeom,
          recLeftWallArc,
          recCrownArc,
          recRightWallArc,
          recTotalPerim,
          sym.dipDirectionDeg,
          sym.dipDeg,
          driveAz,
          0.5
        );
        if (sym.symbolType === 'water_seepage' || sym.symbolType === 'water_flow') {
          dataset.waterSymbols.push({
            id: `${recPrefix}sym-${sym.id}`,
            condition: sym.symbolType === 'water_flow' ? 'Flowing' : 'Dripping',
            position: stripPt,
            label: sym.label || (sym.symbolType === 'water_flow' ? 'Flowing' : 'Seepage'),
          });
        }
      }
    }

    dataset.pulls = normalizePullsWithMissingGaps(dataset.pulls);
    if (dataset.pulls.length > 0) {
      const mappedPulls = dataset.pulls.filter((p) => p.status === 'MAPPED');
      const minP = Math.min(...dataset.pulls.map((p) => p.fromRd));
      const maxP = Math.max(...dataset.pulls.map((p) => p.toRd));
      dataset.viewFromRd = minP;
      dataset.viewToRd = Math.max(minP + 0.5, maxP);

      // Auto-populate engineering report narrative bullets from the synced pulls if empty
      if (!dataset.narrativeBullets || dataset.narrativeBullets.length === 0) {
        const uniqueRocks = Array.from(new Set(mappedPulls.map((p) => p.rockType))).join(', ');
        const uniqueWeath = Array.from(new Set(mappedPulls.map((p) => p.weatheringCondition))).join(', ');
        const avgRmr = Math.round(
          mappedPulls.reduce((a, b) => a + (b.rmrValue ?? 60), 0) / Math.max(1, mappedPulls.length)
        );
        const avgRqd = Math.round(
          mappedPulls.reduce((a, b) => a + (b.rqdValue ?? 75), 0) / Math.max(1, mappedPulls.length)
        );
        dataset.narrativeBullets = [
          `UNWRAPPED & FACE LOG AUTO-SYNCED: ${mappedPulls.length} excavation pull(s) from Ch. ${minP.toFixed(1)}m to ${maxP.toFixed(1)}m in ${dataset.tunnelLocationName}.`,
          `ROCK TYPE & WEATHERING: Encountered lithology is ${uniqueRocks} with weathering condition ${uniqueWeath}.`,
          `ROCK MASS CLASSIFICATION: Mean RMR = ${avgRmr} and Mean RQD = ${avgRqd}% across mapped pulls.`,
          `PROJECTION CONVENTION: Unfolded perimeter map displays Left Wall (0–${leftWallArc}m), Crown Arch (${leftWallArc}–${(leftWallArc + crownArc).toFixed(1)}m), and Right Wall (${(leftWallArc + crownArc).toFixed(1)}–${totalPerimM}m).`,
        ];
      }
    }
  });

  if (list.length > 1) {
    list = list.filter(
      (d) => !(d.id === 'dataset-fresh-workspace' && d.pulls.length === 0 && d.traces.length === 0)
    );
  }

  return list;
}

export function normalizePullsWithMissingGaps(
  rawPulls: ContinuousPullRecord[]
): ContinuousPullRecord[] {
  // Preserve explicit MISSING_GAP records when already constructed for a range, or sort mapped pulls
  const validPulls = rawPulls.filter(
    (p) => p.status === 'MAPPED' || p.status === 'MISSING_GAP'
  );
  return validPulls.sort((a, b) => a.fromRd - b.fromRd);
}

/**
 * Builds an ordered list of pulls across [viewFromRd, viewToRd], inserting explicit
 * `status: 'MISSING_GAP'` records wherever an unlogged chainage or depth interval exists.
 * Never fills unlogged intervals with synthetic rock data.
 */
export function buildPullsWithMissingGapsInRange(
  mappedPullsInput: ContinuousPullRecord[],
  viewFromRd: number,
  viewToRd: number
): ContinuousPullRecord[] {
  const startRd = Math.min(viewFromRd, viewToRd);
  const endRd = Math.max(viewFromRd, viewToRd);
  const mapped = mappedPullsInput
    .filter((p) => p.status === 'MAPPED' && p.toRd > startRd + 0.01 && p.fromRd < endRd - 0.01)
    .map((p) => ({
      ...p,
      fromRd: Math.max(startRd, Math.min(p.fromRd, p.toRd)),
      toRd: Math.min(endRd, Math.max(p.fromRd, p.toRd)),
    }))
    .filter((p) => p.toRd - p.fromRd >= 0.05)
    .sort((a, b) => a.fromRd - b.fromRd);

  if (mapped.length === 0) {
    if (endRd - startRd >= 0.1) {
      return [
        {
          id: `gap-${startRd.toFixed(1)}-${endRd.toFixed(1)}`,
          fromRd: Number(startRd.toFixed(2)),
          toRd: Number(endRd.toFixed(2)),
          driveAzimuthDeg: 0,
          leftBoundaryAzimuthDeg: 270,
          rockType: 'UNLOGGED GAP',
          rockClass: '-',
          weatheringCondition: '-',
          ucsRangeMpa: '-',
          seepageCondition: '-',
          supportDescription: 'Unlogged Interval — No Data',
          status: 'MISSING_GAP',
        },
      ];
    }
    return [];
  }

  const result: ContinuousPullRecord[] = [];
  let cursor = startRd;
  const GAP_TOLERANCE_M = 0.08;

  for (let i = 0; i < mapped.length; i++) {
    const pull = mapped[i];
    if (pull.fromRd - cursor > GAP_TOLERANCE_M) {
      result.push({
        id: `gap-${cursor.toFixed(2)}-${pull.fromRd.toFixed(2)}`,
        fromRd: Number(cursor.toFixed(2)),
        toRd: Number(pull.fromRd.toFixed(2)),
        driveAzimuthDeg: pull.driveAzimuthDeg,
        leftBoundaryAzimuthDeg: pull.leftBoundaryAzimuthDeg,
        rockType: 'UNLOGGED GAP',
        rockClass: '-',
        weatheringCondition: '-',
        ucsRangeMpa: '-',
        seepageCondition: '-',
        supportDescription: 'Unlogged Interval — No Data',
        status: 'MISSING_GAP',
      });
    }
    result.push(pull);
    cursor = Math.max(cursor, pull.toRd);
  }

  if (endRd - cursor > GAP_TOLERANCE_M) {
    const lastMapped = mapped[mapped.length - 1];
    result.push({
      id: `gap-${cursor.toFixed(2)}-${endRd.toFixed(2)}`,
      fromRd: Number(cursor.toFixed(2)),
      toRd: Number(endRd.toFixed(2)),
      driveAzimuthDeg: lastMapped?.driveAzimuthDeg ?? 0,
      leftBoundaryAzimuthDeg: lastMapped?.leftBoundaryAzimuthDeg ?? 270,
      rockType: 'UNLOGGED GAP',
      rockClass: '-',
      weatheringCondition: '-',
      ucsRangeMpa: '-',
      seepageCondition: '-',
      supportDescription: 'Unlogged Interval — No Data',
      status: 'MISSING_GAP',
    });
  }

  return result;
}

/**
 * Extends / expands a joint trace along its strike/dip tangent across pulls or to full pull boundaries.
 */
export function extendStripTraceAcrossPull(
  trace: ContinuousStripTrace,
  direction: 'start' | 'end' | 'both' | 'full_span',
  distanceM: number,
  totalPerimeterM: number,
  minRd?: number,
  maxRd?: number
): ContinuousStripTrace {
  const pts = [...(trace.points || [])];
  if (pts.length < 2) return trace;

  const clampY = (y: number) => Math.max(0.05, Math.min(totalPerimeterM - 0.05, y));
  const clampX = (x: number) => {
    let val = x;
    if (minRd !== undefined) val = Math.max(minRd, val);
    if (maxRd !== undefined) val = Math.min(maxRd, val);
    return Number(val.toFixed(3));
  };

  if (direction === 'full_span' && minRd !== undefined && maxRd !== undefined) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const slope = Math.abs(dx) > 0.05 ? dy / dx : 0;
    const startPt: Point2D = {
      x: Number(minRd.toFixed(3)),
      y: Number(clampY(first.y + slope * (minRd - first.x)).toFixed(3)),
    };
    const endPt: Point2D = {
      x: Number(maxRd.toFixed(3)),
      y: Number(clampY(last.y + slope * (maxRd - last.x)).toFixed(3)),
    };
    const newPts = [startPt, ...pts.slice(1, -1), endPt];
    return { ...trace, points: newPts };
  }

  if (direction === 'start' || direction === 'both') {
    const p0 = pts[0];
    const p1 = pts[1];
    const vx = p0.x - p1.x;
    const vy = p0.y - p1.y;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;
    pts[0] = {
      x: clampX(p0.x + ux * distanceM),
      y: Number(clampY(p0.y + uy * distanceM).toFixed(3)),
    };
  }

  if (direction === 'end' || direction === 'both') {
    const n = pts.length;
    const pLast = pts[n - 1];
    const pPrev = pts[n - 2];
    const vx = pLast.x - pPrev.x;
    const vy = pLast.y - pPrev.y;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;
    pts[n - 1] = {
      x: clampX(pLast.x + ux * distanceM),
      y: Number(clampY(pLast.y + uy * distanceM).toFixed(3)),
    };
  }

  return { ...trace, points: pts };
}

export interface UnifiedContinuousRoundItem {
  id: string;
  roundNumber: number;
  fromRd: number;
  toRd: number;
  pullLengthM: number;
  date: string;
  excavationMode: 'TUNNEL' | 'SHAFT';
  excavationMethod: string;
  rockType: string;
  rockClass: string;
  qValue: number;
  rmrValue: number;
  gsiValue: number;
  rqdPct: number;
  intactUcsMpa: number;
  overburdenDepthM: number;
  traceCount: number;
  supportSummary: string;
  boltLengthM: number;
  boltSpacingM: number;
  shotcreteThicknessMm: number;
  steelRibSpacingM: number;
  shaftHalfSide?: 'left_half' | 'right_half';
  shaftCenterMedianStatus?: 'closed' | 'open';
  sourceType: 'FIELD_STORE' | 'SAVED_PROJECT';
  fieldRound?: FieldExcavationRound;
  savedRecord?: SavedProjectRecord;
}

export interface UnifiedContinuousLocationItem {
  id: string;
  name: string;
  excavationMode: 'TUNNEL' | 'SHAFT';
  diameterWidthM: number;
  heightM: number;
  driveAzimuthDeg: number;
  overburdenDepthM: number;
  excavationApproach?: 'full_face' | 'top_heading_and_benching' | 'top_heading' | 'benching' | 'half_face';
  benchHeightM?: number;
  shaftHalfSide?: 'left_half' | 'right_half';
  shaftCenterMedianStatus?: 'closed' | 'open';
  rounds: UnifiedContinuousRoundItem[];
  fieldLocation?: FieldTunnelLocationItem;
}

export interface UnifiedContinuousProjectItem {
  id: string;
  projectName: string;
  clientName: string;
  contractorName: string;
  excavationMode: 'TUNNEL' | 'SHAFT';
  locations: UnifiedContinuousLocationItem[];
}

/**
 * Discovers and merges all logged Tunnel and Vertical Shaft projects, locations, and rounds
 * from both Underground Face Mapping (`loadFieldMappingStore`) and `savedProjects`.
 */
export function getUnifiedContinuousProjectsAndLocations(
  excavationMode: 'TUNNEL' | 'SHAFT',
  savedProjects: SavedProjectRecord[] = []
): UnifiedContinuousProjectItem[] {
  const subMode = excavationMode === 'SHAFT' ? 'vertical_shaft' : 'tunnel';
  const fieldStore = loadFieldMappingStore('TUNNEL', subMode);
  const projectMap = new Map<string, UnifiedContinuousProjectItem>();

  // 1. Load from Field Mapping Store (Underground Face Mapping)
  for (const fp of fieldStore.projects || []) {
    const matchingLocs = (fp.locations || []).filter((loc) =>
      excavationMode === 'SHAFT'
        ? loc.undergroundSubMode === 'vertical_shaft' || fp.undergroundSubMode === 'vertical_shaft'
        : loc.undergroundSubMode !== 'vertical_shaft'
    );
    if (matchingLocs.length === 0 && (fp.locations || []).length > 0) continue;

    const projName = (fp.projectName || 'Underground Project').trim();
    const projKey = projName.toLowerCase();
    let projEntry = projectMap.get(projKey);
    if (!projEntry) {
      projEntry = {
        id: fp.id,
        projectName: projName,
        clientName: fp.clientName || 'Project Client',
        contractorName: fp.contractorName || 'Engineering Contractor',
        excavationMode,
        locations: [],
      };
      projectMap.set(projKey, projEntry);
    }

    for (const loc of matchingLocs) {
      const locRounds = (fieldStore.rounds || []).filter(
        (r) => r.locationId === loc.id || (r.projectId === fp.id && (fp.locations || []).length === 1)
      );
      const rounds: UnifiedContinuousRoundItem[] = locRounds
        .map((r, idx) => {
          const parsedInterval = parsePullIntervalFromRecord(
            r.chainageFrom || '',
            r.chainageTo || '',
            r.pullLengthMeters || 2.5
          );
          const fromRd = Math.min(parsedInterval.fromRd, parsedInterval.toRd);
          const toRd = Math.max(parsedInterval.fromRd, parsedInterval.toRd);
          const pullLen = Math.max(0.2, toRd - fromRd || r.pullLengthMeters || 2.0);

          const qSys = r.qSystem || { rqd: 65, jn: 9, jr: 1.5, ja: 2, jw: 1, srf: 2.5 };
          const qValRaw =
            (Math.max(10, qSys.rqd) / Math.max(0.5, qSys.jn)) *
            (Math.max(0.5, qSys.jr) / Math.max(0.75, qSys.ja)) *
            (Math.max(0.1, qSys.jw) / Math.max(0.5, qSys.srf));
          const rmrSys = r.rmrSystem || {
            ucsRating: 7,
            rqdRating: 13,
            spacingRating: 10,
            conditionRating: 20,
            waterRating: 10,
            orientationAdj: -5,
          };
          const rmrVal =
            r.rmrTotal ||
            Math.max(
              15,
              Math.min(
                100,
                (rmrSys.ucsRating || 7) +
                  (rmrSys.rqdRating || 13) +
                  (rmrSys.spacingRating || 10) +
                  (rmrSys.conditionRating || 20) +
                  (rmrSys.waterRating || 10) +
                  (rmrSys.orientationAdj || -5)
              )
            );
          const gsiVal = r.gsiValue || Math.max(20, rmrVal - 5);
          const rqdPct = qSys.rqd || 65;
          const ucsMpa =
            r.strengthIndex === 'S1'
              ? 180
              : r.strengthIndex === 'S2'
              ? 125
              : r.strengthIndex === 'S3'
              ? 75
              : r.strengthIndex === 'S4'
              ? 40
              : 22;
          const overburdenDepthM = r.femDemAnalysis?.overburdenDepthM || 110;
          const sup = r.supportSystem;
          const boltLengthM = sup?.rockBoltLengthM || 4.0;
          const boltSpacingM = sup?.rockBoltInPlaneSpacingM || sup?.rockBoltSpacingInPlaneM || 1.5;
          const shotcreteThicknessMm =
            sup?.shotcreteCrownThicknessMm || sup?.shotcreteThicknessMm || 150;
          const steelRibSpacingM = sup?.ismbEnabled
            ? sup.ismbSpacingM || 1.2
            : sup?.latticeGirderEnabled
            ? sup.latticeGirderSpacingM || 1.2
            : sup?.steelRibSpacingM || 0;
          const primaryLitho =
            r.lithologyStrokes?.[0]?.rockName ||
            r.lithologyStrokes?.[0]?.rockType ||
            r.rockType ||
            'Quartzitic Phyllite / Gneiss';

          return {
            id: r.id,
            roundNumber: r.roundNumber || idx + 1,
            fromRd: Number(fromRd.toFixed(2)),
            toRd: Number((toRd > fromRd ? toRd : fromRd + pullLen).toFixed(2)),
            pullLengthM: Number(pullLen.toFixed(2)),
            date: (r.dateAndTimeOfExcavation || r.createdAt || new Date().toISOString()).slice(0, 10),
            excavationMode,
            excavationMethod: r.modeOfExcavation || 'Drill & Blast',
            rockType: primaryLitho,
            rockClass:
              r.rmrRockClass ||
              (rmrVal >= 61 ? 'Class II (Good)' : rmrVal >= 41 ? 'Class III (Fair)' : 'Class IV (Poor)'),
            qValue: Number(qValRaw.toFixed(2)),
            rmrValue: Math.round(rmrVal),
            gsiValue: Math.round(gsiVal),
            rqdPct: Math.round(rqdPct),
            intactUcsMpa: Number(ucsMpa.toFixed(1)),
            overburdenDepthM: Number(overburdenDepthM.toFixed(1)),
            traceCount: (r.jointTraces || []).filter((tr) => tr.panel !== 'face').length,
            supportSummary: `Bolts L=${boltLengthM}m @ ${boltSpacingM}m | Shotcrete ${shotcreteThicknessMm}mm${steelRibSpacingM ? ` | Ribs @ ${steelRibSpacingM}m` : ''}`,
            boltLengthM,
            boltSpacingM,
            shotcreteThicknessMm,
            steelRibSpacingM,
            shaftHalfSide: r.shaftHalfSide,
            shaftCenterMedianStatus: r.shaftCenterMedianStatus,
            sourceType: 'FIELD_STORE' as const,
            fieldRound: r,
          };
        })
        .sort((a, b) => a.fromRd - b.fromRd);

      const firstRound = locRounds[0];
      const approachRaw = (firstRound?.excavationApproach || loc.defaultExcavationApproach || 'full_face').toLowerCase();
      const normalizedApproach: UnifiedContinuousLocationItem['excavationApproach'] =
        approachRaw.includes('half')
          ? 'half_face'
          : approachRaw.includes('top') && approachRaw.includes('bench')
          ? 'top_heading_and_benching'
          : approachRaw.includes('top')
          ? 'top_heading'
          : approachRaw.includes('bench')
          ? 'benching'
          : 'full_face';

      projEntry.locations.push({
        id: loc.id,
        name: loc.name.trim(),
        excavationMode,
        diameterWidthM: loc.widthM || 8.0,
        heightM: loc.wallHeightM || loc.heightM || 6.0,
        driveAzimuthDeg: loc.defaultDriveAzimuth || loc.directionDeg || 0,
        overburdenDepthM: firstRound?.femDemAnalysis?.overburdenDepthM || 110,
        excavationApproach: normalizedApproach,
        benchHeightM: firstRound?.benchHeightMeters,
        shaftHalfSide: firstRound?.shaftHalfSide,
        shaftCenterMedianStatus: firstRound?.shaftCenterMedianStatus,
        rounds,
        fieldLocation: loc,
      });
    }
  }

  // 2. Also merge SavedProjects (for Tunnel or Shaft records saved via SavedProjectRecord)
  for (const rec of savedProjects || []) {
    const locNameStr = rec.location || rec.settings?.tunnelName || 'Main Heading';
    const isRecShaft = locNameStr.toLowerCase().includes('shaft');
    if (excavationMode === 'SHAFT' && !isRecShaft) continue;
    if (excavationMode === 'TUNNEL' && isRecShaft) continue;

    const pName = (rec.projectName || rec.settings?.projectName || 'Default Project').trim();
    const lName = locNameStr.trim();
    const projKey = pName.toLowerCase();

    let projEntry = projectMap.get(projKey);
    if (!projEntry) {
      projEntry = {
        id: `proj-saved-${projKey}`,
        projectName: pName,
        clientName: 'Project Client',
        contractorName: 'Contractor',
        excavationMode,
        locations: [],
      };
      projectMap.set(projKey, projEntry);
    }

    let locEntry = projEntry.locations.find(
      (l) => l.name.toLowerCase() === lName.toLowerCase()
    );
    if (!locEntry) {
      locEntry = {
        id: `loc-saved-${projKey}-${lName.toLowerCase()}`,
        name: lName,
        excavationMode,
        diameterWidthM: rec.geometry?.width || 8.0,
        heightM: rec.geometry?.wallHeight || 5.0,
        driveAzimuthDeg: rec.settings?.driveDirection ?? 45,
        overburdenDepthM: 110,
        rounds: [],
      };
      projEntry.locations.push(locEntry);
    }

    const roundLen = Math.max(1.0, rec.settings?.roundLength || 3.5);
    const interval = parsePullIntervalFromRecord(
      rec.chainage || '',
      rec.faceChainage || '',
      roundLen
    );
    // Avoid duplicating a round that already exists at the exact same interval from FieldStore
    const duplicate = locEntry.rounds.some(
      (existing) =>
        Math.abs(existing.fromRd - interval.fromRd) < 0.05 &&
        Math.abs(existing.toRd - interval.toRd) < 0.05
    );
    if (!duplicate) {
      const pullSpan = Math.max(0.5, interval.toRd - interval.fromRd);
      const derived = derivePullReportDetailsFromRecord(rec, pullSpan);
      const qVal = derived.qValue ?? 4.5;
      const rmrVal = derived.rmrValue ?? 58;
      const gsiVal = derived.gsiValue ?? Math.max(20, rmrVal - 5);
      const rqdVal = derived.rqdValue ?? 70;
      const ucsVal = rec.rmrParams?.intactStrengthValueMPa ?? 75;

      locEntry.rounds.push({
        id: rec.id,
        roundNumber: locEntry.rounds.length + 1,
        fromRd: Number(interval.fromRd.toFixed(2)),
        toRd: Number(interval.toRd.toFixed(2)),
        pullLengthM: Number(pullSpan.toFixed(2)),
        date: rec.date || new Date().toISOString().slice(0, 10),
        excavationMode,
        excavationMethod: 'Drill & Blast',
        rockType:
          rec.lithologyRegions?.[0]?.lithologyName ||
          rec.rockMassSummary?.rockType ||
          rec.settings?.lithology ||
          'Quartzite',
        rockClass: derived.rockClass || 'III',
        qValue: Number(qVal.toFixed(2)),
        rmrValue: Math.round(rmrVal),
        gsiValue: Math.round(gsiVal),
        rqdPct: Math.round(rqdVal),
        intactUcsMpa: Number(ucsVal.toFixed(1)),
        overburdenDepthM: 110,
        traceCount: (rec.joints || []).filter((j) => j.surface !== 'face').length,
        supportSummary: derived.supportDescription || 'Systematic Rock Bolts + Shotcrete',
        boltLengthM: 4.0,
        boltSpacingM: 1.5,
        shotcreteThicknessMm: 150,
        steelRibSpacingM: 0,
        sourceType: 'SAVED_PROJECT',
        savedRecord: rec,
      });
      locEntry.rounds.sort((a, b) => a.fromRd - b.fromRd);
    }
  }

  return Array.from(projectMap.values());
}

function mapRockNameToStripCode(rawRockName?: string): {
  rockType: StripRockTypeId;
  codeSymbol: string;
} {
  const name = (rawRockName || 'Quartzite').trim();
  const lower = name.toLowerCase();
  if (lower.includes('phyllitic quartzite') || lower === 'pq') {
    return { rockType: 'Phyllitic Quartzite', codeSymbol: 'PQ' };
  }
  if (lower.includes('quartzitic phyllite') || lower === 'qp') {
    return { rockType: 'Quartzitic Phyllite', codeSymbol: 'QP' };
  }
  if (lower.includes('quartzite') || lower.includes('qtz')) {
    return { rockType: 'Quartzite', codeSymbol: 'Qtz' };
  }
  if (lower.includes('phyllite') || lower === 'ph') {
    return { rockType: 'Phyllite', codeSymbol: 'Ph' };
  }
  if (lower.includes('schist') || lower === 'sch') {
    return { rockType: 'Mica Schist', codeSymbol: 'Sch' };
  }
  if (lower.includes('granite') || lower === 'gr') {
    return { rockType: 'Gr', codeSymbol: 'Gr' };
  }
  if (lower.includes('gneiss') || lower === 'gn') {
    return { rockType: 'Gn', codeSymbol: 'Gn' };
  }
  if (lower.includes('basalt') || lower === 'bas') {
    return { rockType: 'Bas', codeSymbol: 'Bas' };
  }
  if (lower.includes('dolerite')) {
    return { rockType: 'Dolerite', codeSymbol: 'Dol' };
  }
  if (lower.includes('sandstone') || lower === 'ss') {
    return { rockType: 'Metasandstone', codeSymbol: 'Ss' };
  }
  if (lower.includes('siltstone') || lower === 'sl') {
    return { rockType: 'Siltstone', codeSymbol: 'Sl' };
  }
  if (lower.includes('shale')) {
    return { rockType: 'Shale', codeSymbol: 'Sh' };
  }
  if (lower.includes('limestone') || lower === 'ls') {
    return { rockType: 'Ls', codeSymbol: 'Ls' };
  }
  if (lower.includes('fault') || lower.includes('gouge') || lower.includes('shear')) {
    return { rockType: 'FaultGouge', codeSymbol: 'FG' };
  }
  return {
    rockType: (name as StripRockTypeId) || 'Quartzite',
    codeSymbol: name.slice(0, 3).toUpperCase() || 'RK',
  };
}

/**
 * Compiles a complete ContinuousTunnelStripDataset for either Tunnel (3-zone unfolded arch)
 * or Vertical Shaft (4-quadrant unfolded cylinder: 1. NE 0-90, 2. ES 90-180, 3. SW 180-270, 4. WN 270-360),
 * syncing all mapped rounds inside [viewFromRd, viewToRd] and preserving unlogged gaps at true spatial scale.
 */
export function compileContinuousDatasetFromFieldAndSavedRecords(params: {
  excavationMode: 'TUNNEL' | 'SHAFT';
  projectItem: UnifiedContinuousProjectItem;
  locationItem: UnifiedContinuousLocationItem;
  fromRd: number;
  toRd: number;
  existingDataset?: ContinuousTunnelStripDataset;
}): ContinuousTunnelStripDataset {
  const { excavationMode, projectItem, locationItem, existingDataset } = params;
  const viewFromRd = Math.min(params.fromRd, params.toRd);
  const viewToRd = Math.max(viewFromRd + 0.5, Math.max(params.fromRd, params.toRd));

  const isShaft = excavationMode === 'SHAFT';
  const spanDiameterM = locationItem.diameterWidthM || 8.0;
  const wallHeightM = locationItem.heightM || 6.0;
  const driveAz = locationItem.driveAzimuthDeg || 0;

  // Compute perimeter unfolding geometry
  const shaftQuadArcM = Number(((Math.PI * spanDiameterM) / 4).toFixed(2));
  const shaftTotalPerimM = Number((shaftQuadArcM * 4).toFixed(2));

  const leftWallArcM = isShaft ? shaftQuadArcM : Number(wallHeightM.toFixed(2));
  const crownArcM = isShaft
    ? shaftQuadArcM
    : Number((spanDiameterM * 1.15).toFixed(2));
  const rightWallArcM = isShaft ? shaftQuadArcM : Number(wallHeightM.toFixed(2));
  const shaftSnArcM = isShaft ? shaftQuadArcM : 0;

  const upperZoneWidthM = isShaft
    ? Number((shaftQuadArcM * 2).toFixed(2))
    : Number((leftWallArcM + crownArcM).toFixed(2));
  const lowerZoneWidthM = isShaft
    ? Number((shaftQuadArcM * 2).toFixed(2))
    : rightWallArcM;
  const totalPerimM = Number((upperZoneWidthM + lowerZoneWidthM).toFixed(2));

  const shaftSubMode: 'FULL_CIRCLE' | 'HALF_CIRCLE_LEFT' | 'HALF_CIRCLE_RIGHT' =
    isShaft && locationItem.excavationApproach === 'half_face'
      ? locationItem.shaftHalfSide === 'right_half'
        ? 'HALF_CIRCLE_RIGHT'
        : 'HALF_CIRCLE_LEFT'
      : 'FULL_CIRCLE';

  const mappedPulls: ContinuousPullRecord[] = [];
  const traces: ContinuousStripTrace[] = [];
  const lithologyZones: ContinuousStripLithologyZone[] = [];
  const waterSymbols: ContinuousStripWaterSymbol[] = [];

  // Filter rounds that overlap [viewFromRd, viewToRd]
  const activeRounds = (locationItem.rounds || []).filter(
    (r) => r.toRd > viewFromRd + 0.01 && r.fromRd < viewToRd - 0.01
  );

  for (const rItem of activeRounds) {
    const clipFromRd = Math.max(viewFromRd, rItem.fromRd);
    const clipToRd = Math.min(viewToRd, rItem.toRd);
    const roundLen = Math.max(0.2, clipToRd - clipFromRd);

    mappedPulls.push({
      id: `pull-${rItem.id}`,
      fromRd: Number(clipFromRd.toFixed(2)),
      toRd: Number(clipToRd.toFixed(2)),
      driveAzimuthDeg: driveAz,
      gradientPct: isShaft ? -100 : 0.2,
      leftBoundaryAzimuthDeg: isShaft ? 0 : (driveAz + 270) % 360,
      convergenceMm: rItem.rmrValue >= 60 ? '-2mm' : rItem.rmrValue >= 40 ? '-5mm' : '-11mm',
      rockType: rItem.rockType,
      rockDescription: `${rItem.rockType} (${rItem.excavationMethod})`,
      rockClass: rItem.rockClass,
      weatheringCondition:
        rItem.fieldRound?.weatheringIndex ||
        (rItem.rmrValue >= 60 ? 'Fresh to Slightly Weathered' : 'Moderately Weathered'),
      ucsRangeMpa: `${Math.max(10, Math.round(rItem.intactUcsMpa - 15))}–${Math.round(rItem.intactUcsMpa + 15)} MPa`,
      rmrValue: rItem.rmrValue,
      rqdValue: rItem.rqdPct,
      qValue: rItem.qValue,
      gsiValue: rItem.gsiValue,
      seepageCondition: rItem.fieldRound?.waterMarks?.[0]?.condition || 'Damp / Minor Seepage',
      structureDescription: `${rItem.traceCount} mapped structural trace(s)`,
      foliationCharacteristics: isShaft ? 'Vertical Shaft Wall Mapping' : 'Unwrapped Arch & Wall Mapping',
      overbreakVolumeM3: Number(
        (
          rItem.fieldRound?.surveyOverbreak?.overbreakVolumeM3 ??
          roundLen * (rItem.rmrValue < 45 ? 2.4 : 1.1)
        ).toFixed(1)
      ),
      excavationDefiningNo: `RD-${rItem.roundNumber}`,
      excavationDate: rItem.date,
      supportClass: rItem.rockClass,
      shotcreteInstalled: `${rItem.shotcreteThicknessMm}mm SFRS`,
      wireMeshInstalled: 'Weldmesh 100x100x6mm',
      rockBoltsInstalled: `L=${rItem.boltLengthM}m @ ${rItem.boltSpacingM}m c/c`,
      steelRibsInstalled: rItem.steelRibSpacingM > 0 ? `ISMB @ ${rItem.steelRibSpacingM}m` : 'None',
      forepolingInstalled: rItem.qValue < 1.0 ? 'Forepoling 32mm SDA' : 'None',
      remarks: rItem.fieldRound?.remarks || rItem.fieldRound?.geologicalDescription || '',
      supportDescription: rItem.supportSummary,
      status: 'MAPPED',
      linkedFieldRoundId: rItem.fieldRound?.id,
      linkedSavedProjectId: rItem.savedRecord?.id,
      dateMapped: rItem.date,
      overburdenDepthM: rItem.overburdenDepthM || locationItem.overburdenDepthM || 110,
      intactUcsMpa: rItem.intactUcsMpa,
      boltLengthM: rItem.boltLengthM,
      boltSpacingM: rItem.boltSpacingM,
      shotcreteThicknessMm: rItem.shotcreteThicknessMm,
      steelRibSpacingM: rItem.steelRibSpacingM,
      excavationApproach: locationItem.excavationApproach,
      benchHeightM: locationItem.benchHeightM,
      shaftHalfSide: locationItem.shaftHalfSide,
      shaftCenterMedianStatus: locationItem.shaftCenterMedianStatus,
    });

    // Add background lithology polygon for this mapped pull
    const rockMeta = mapRockNameToStripCode(rItem.rockType);
    lithologyZones.push({
      id: `lith-pull-${rItem.id}`,
      rockType: rockMeta.rockType,
      codeSymbol: rockMeta.codeSymbol,
      label: `${rockMeta.codeSymbol} - ${rItem.rockType} (${isShaft ? 'Depth' : 'RD'} ${clipFromRd.toFixed(1)}–${clipToRd.toFixed(1)}m)`,
      polygon: [
        { x: clipFromRd, y: 0 },
        { x: clipToRd, y: 0 },
        { x: clipToRd, y: totalPerimM },
        { x: clipFromRd, y: totalPerimM },
      ],
    });

    // Populate groundwater seepage symbol for this mapped pull
    const pullSeepageStr = rItem.fieldRound?.waterMarks?.[0]?.condition || 'Damp / Minor Seepage';
    const seepLower = pullSeepageStr.toLowerCase();
    const mappedWaterCond: StripGroundwaterId = seepLower.includes('flow')
      ? 'Flowing'
      : seepLower.includes('drip')
      ? 'Dripping'
      : seepLower.includes('wet')
      ? 'Wet'
      : seepLower.includes('damp') || seepLower.includes('moist')
      ? 'Moist/Damp'
      : 'Dry';
    waterSymbols.push({
      id: `water-pull-${rItem.id}`,
      condition: mappedWaterCond,
      position: {
        x: Number(((clipFromRd + clipToRd) / 2).toFixed(2)),
        y: Number((isShaft ? shaftQuadArcM * 1.45 : leftWallArcM + crownArcM * 0.5).toFixed(2)),
      },
      label: `${mappedWaterCond} (${pullSeepageStr})`,
    });

    // Unfold FieldExcavationRound traces, lithology strokes, structural features, dip planes & water marks
    if (rItem.fieldRound && locationItem.fieldLocation) {
      const fRound = rItem.fieldRound;
      const fLoc = locationItem.fieldLocation;

      // Helper to map a panel point (normalized [0..1] or metric) into unfolded strip (xChainage, yPerim)
      const mapPanelMetricPointToStrip = (
        mp: { x: number; y: number },
        panel: 'face' | 'left_wall' | 'crown' | 'right_wall' | 'shaft_sn'
      ): Point2D => {
        if (panel === 'face') {
          // Project face trace across the round chainage interval and crown/wall arc
          const normX = Math.max(0, Math.min(1, mp.x / Math.max(0.5, spanDiameterM)));
          const normY = Math.max(0, Math.min(1, mp.y / Math.max(0.5, wallHeightM)));
          const xChainage = clipFromRd + normY * roundLen;
          const yPerim = isShaft
            ? normX * shaftTotalPerimM
            : leftWallArcM + normX * crownArcM;
          return {
            x: Number(Math.max(clipFromRd, Math.min(clipToRd, xChainage)).toFixed(3)),
            y: Number(Math.max(0.05, Math.min(totalPerimM - 0.05, yPerim)).toFixed(3)),
          };
        }
        const localPullX = panel === 'crown' && !isShaft ? mp.y : mp.x;
        const localPerimY = panel === 'crown' && !isShaft ? mp.x : mp.y;

        const xChainage = Math.max(
          clipFromRd,
          Math.min(clipToRd, clipFromRd + Math.max(0, Math.min(roundLen, localPullX)))
        );
        let yPerim = 0;
        if (isShaft) {
          const localY = Math.max(0, Math.min(shaftQuadArcM, localPerimY));
          if (panel === 'left_wall') yPerim = localY;
          else if (panel === 'crown') yPerim = shaftQuadArcM + localY;
          else if (panel === 'right_wall') yPerim = shaftQuadArcM * 2 + localY;
          else if (panel === 'shaft_sn') yPerim = shaftQuadArcM * 3 + localY;
        } else {
          if (panel === 'left_wall') {
            yPerim = Math.max(0, Math.min(leftWallArcM, localPerimY));
          } else if (panel === 'crown') {
            yPerim = leftWallArcM + Math.max(0, Math.min(crownArcM, localPerimY));
          } else if (panel === 'right_wall') {
            yPerim = leftWallArcM + crownArcM + Math.max(0, Math.min(rightWallArcM, localPerimY));
          }
        }
        return {
          x: Number(xChainage.toFixed(3)),
          y: Number(Math.max(0.05, Math.min(totalPerimM - 0.05, yPerim)).toFixed(3)),
        };
      };

      const nonFaceTraces = (fRound.jointTraces || []).filter((tr) => tr.panel !== 'face');
      const panelTraces =
        nonFaceTraces.length > 0 ? nonFaceTraces : fRound.jointTraces || [];

      for (const tr of panelTraces) {
        if (!tr.points || tr.points.length < 2) continue;
        const metricPts =
          tr.metricPoints && tr.metricPoints.length === tr.points.length
            ? tr.metricPoints
            : computePhysicalMetricPoints(tr.points, tr.panel, fLoc, fRound);
        const stripPts: Point2D[] = metricPts.map((mp) =>
          mapPanelMetricPointToStrip(mp, tr.panel)
        );

        const setKey = tr.setId && tr.setId !== 'unassigned' ? tr.setId : 'J1';
        const setRec = (fRound.discontinuitySets as any)?.[setKey];

        const structType: StripStructureTypeId =
          setKey === 'J-Bedding'
            ? 'JS1 - Foliation'
            : setKey === 'J2'
            ? 'JS2 - Main Joint'
            : setKey === 'J3'
            ? 'JS3 - Main Joint'
            : 'Joint';

        const sourceSurf: ContinuousStripTrace['sourceSurface'] =
          tr.panel === 'left_wall'
            ? 'leftWall'
            : tr.panel === 'crown' || tr.panel === 'face'
            ? 'crown'
            : tr.panel === 'right_wall'
            ? 'rightWall'
            : 'shaft_sn';

        const dipDir = Math.round(tr.dipDirection || 120);
        const dipAng = Math.round(tr.dipAmount || 60);

        traces.push({
          id: `tr-${fRound.id}-${tr.id}`,
          structureType: structType,
          setId: setKey,
          orientationLabel: `${String(dipDir).padStart(3, '0')}/${String(dipAng).padStart(2, '0')}`,
          dipDirectionDeg: dipDir,
          dipDeg: dipAng,
          dipTickSide: dipDir >= 180 ? 'left' : 'right',
          fillingThickness: 'Thin',
          points: stripPts,
          rawPoints: stripPts.map((p) => ({ ...p })),
          sourceSurface: sourceSurf,
          colorHex: setKey === 'J1' ? '#2563eb' : setKey === 'J2' ? '#ea580c' : '#9333ea',
          roughness: setRec?.roughness || 'Rough / Irregular',
          jrc: 12,
          jcsMpa: Number((rItem.intactUcsMpa * 0.75).toFixed(1)),
          infilling: setRec?.infilling || 'Clean / Tight',
          apertureMm: setRec?.aperture || '1.0mm',
          waterCondition: setRec?.groundwater || 'Dry',
          customLabel: tr.label || setKey,
        });
      }

      // Unfold user-drawn structuralFeatures (faults, shears, folds, dykes, contact boundaries)
      for (const sf of fRound.structuralFeatures || []) {
        if (!sf.points || sf.points.length < 2) continue;
        const metricPts = computePhysicalMetricPoints(sf.points, sf.panel, fLoc, fRound);
        const stripPts = metricPts.map((mp) => mapPanelMetricPointToStrip(mp, sf.panel));
        const dipDir = Math.round(sf.dipDirection || 135);
        const dipAng = Math.round(sf.dipAmount || 65);
        const structType: StripStructureTypeId =
          sf.featureType === 'fault' || sf.featureType === 'thrust_fault'
            ? 'Main Fault'
            : sf.featureType === 'shear_zone'
            ? 'Shear'
            : sf.featureType === 'fold_axis'
            ? 'JS1 - Foliation'
            : 'Lithological Contact';
        traces.push({
          id: `tr-sf-${fRound.id}-${sf.id}`,
          structureType: structType,
          setId:
            sf.featureType === 'fault' ||
            sf.featureType === 'thrust_fault' ||
            sf.featureType === 'shear_zone'
              ? 'Shear/Fault'
              : 'J1',
          orientationLabel: `${String(dipDir).padStart(3, '0')}/${String(dipAng).padStart(2, '0')}`,
          dipDirectionDeg: dipDir,
          dipDeg: dipAng,
          dipTickSide: dipDir >= 180 ? 'left' : 'right',
          fillingThickness: sf.thicknessCm && sf.thicknessCm >= 5 ? 'Thick' : 'Thin',
          points: stripPts,
          rawPoints: stripPts.map((p) => ({ ...p })),
          sourceSurface:
            sf.panel === 'left_wall'
              ? 'leftWall'
              : sf.panel === 'right_wall'
              ? 'rightWall'
              : sf.panel === 'shaft_sn'
              ? 'shaft_sn'
              : 'crown',
          colorHex:
            sf.featureType === 'fault' || sf.featureType === 'thrust_fault'
              ? '#dc2626'
              : '#d97706',
          roughness: 'Slickensided / Planar',
          jrc: 6,
          jcsMpa: Number((rItem.intactUcsMpa * 0.5).toFixed(1)),
          infilling: 'Clay / Gouge',
          apertureMm: `${Math.max(1, (sf.thicknessCm || 2) * 10)}mm`,
          customLabel: sf.label || sf.featureType.toUpperCase(),
        });
      }

      // Unfold user-drawn dipPlaneSurfaces
      for (const dp of fRound.dipPlaneSurfaces || []) {
        const dpPts = dp.outlinePolygon && dp.outlinePolygon.length >= 2 ? dp.outlinePolygon : dp.points;
        if (!dpPts || dpPts.length < 2) continue;
        const metricPts = computePhysicalMetricPoints(dpPts, dp.panel, fLoc, fRound);
        const stripPts = metricPts.map((mp) => mapPanelMetricPointToStrip(mp, dp.panel));
        const dipDir = Math.round(dp.dipDirection || 110);
        const dipAng = Math.round(dp.dipAmount || 55);
        traces.push({
          id: `tr-dp-${fRound.id}-${dp.id}`,
          structureType: 'JS2 - Main Joint',
          setId: dp.setId && dp.setId !== 'unassigned' ? dp.setId : 'J1',
          orientationLabel: `${String(dipDir).padStart(3, '0')}/${String(dipAng).padStart(2, '0')}`,
          dipDirectionDeg: dipDir,
          dipDeg: dipAng,
          dipTickSide: dipDir >= 180 ? 'left' : 'right',
          fillingThickness: 'Thin',
          points: stripPts,
          rawPoints: stripPts.map((p) => ({ ...p })),
          sourceSurface:
            dp.panel === 'left_wall'
              ? 'leftWall'
              : dp.panel === 'right_wall'
              ? 'rightWall'
              : dp.panel === 'shaft_sn'
              ? 'shaft_sn'
              : 'crown',
          colorHex: '#0284c7',
          roughness: 'Rough',
          jrc: 12,
          jcsMpa: Number((rItem.intactUcsMpa * 0.75).toFixed(1)),
          infilling: 'Clean',
          apertureMm: '1.0mm',
          customLabel: dp.label || `${dp.setId} Plane`,
        });
      }

      // Unfold user-drawn lithologyStrokes (region_fill polygons/brushes, vein_band, foliation_plane)
      for (const ls of fRound.lithologyStrokes || []) {
        if (ls.mode === 'lithology_erase') continue;
        const lsPts = ls.polygon && ls.polygon.length >= 3 ? ls.polygon : ls.points;
        if (!lsPts || lsPts.length < 2) continue;
        const metricPts = computePhysicalMetricPoints(lsPts, ls.panel, fLoc, fRound);
        const stripPts = metricPts.map((mp) => mapPanelMetricPointToStrip(mp, ls.panel));
        const rockLabel = ls.rockName || ls.rockType || rItem.rockType;
        const lMeta = mapRockNameToStripCode(rockLabel);

        if (ls.mode === 'vein_band' || ls.mode === 'foliation_plane') {
          traces.push({
            id: `tr-lith-${fRound.id}-${ls.id}`,
            structureType:
              ls.mode === 'vein_band' ? 'Lithological Contact' : 'JS1 - Foliation',
            setId: ls.mode === 'vein_band' ? 'Vein' : 'Foliation',
            orientationLabel: ls.foliationDipAmount
              ? `${String(Math.round(ls.foliationDipDirection || 90)).padStart(3, '0')}/${String(Math.round(ls.foliationDipAmount)).padStart(2, '0')}`
              : '090/60',
            dipDirectionDeg: Math.round(ls.foliationDipDirection || 90),
            dipDeg: Math.round(ls.foliationDipAmount || 60),
            dipTickSide: 'right',
            fillingThickness: ls.mode === 'vein_band' ? 'Thick' : 'Thin',
            points: stripPts,
            rawPoints: stripPts.map((p) => ({ ...p })),
            sourceSurface:
              ls.panel === 'left_wall'
                ? 'leftWall'
                : ls.panel === 'right_wall'
                ? 'rightWall'
                : ls.panel === 'shaft_sn'
                ? 'shaft_sn'
                : 'crown',
            colorHex: ls.customColor || ls.color || ls.fillColor || '#10b981',
            roughness: 'Planar',
            jrc: 8,
            jcsMpa: Number((rItem.intactUcsMpa * 0.8).toFixed(1)),
            infilling: rockLabel || 'Quartz Vein',
            apertureMm: `${Math.max(2, Math.round((ls.bandThicknessPx || 12) * 2))}mm`,
            customLabel: rockLabel || (ls.mode === 'vein_band' ? 'Vein Band' : 'Foliation'),
          });
        } else if (stripPts.length >= 3) {
          lithologyZones.push({
            id: `lith-stroke-${fRound.id}-${ls.id}`,
            rockType: lMeta.rockType,
            codeSymbol: ls.rockCode || lMeta.codeSymbol,
            label: `${ls.rockCode || lMeta.codeSymbol} - ${rockLabel}`,
            polygon: stripPts,
          });
        }
      }

      // Unfold user-drawn waterMarks at exact physical coordinates
      for (const wm of fRound.waterMarks || []) {
        if (!wm.points || wm.points.length === 0) continue;
        const [metricPt] = computePhysicalMetricPoints([wm.points[0]], wm.panel, fLoc, fRound);
        if (!metricPt) continue;
        const stripPos = mapPanelMetricPointToStrip(metricPt, wm.panel);
        const condLower = (wm.condition || '').toLowerCase();
        const wCond: StripGroundwaterId =
          condLower.includes('flow') || condLower.includes('pressure')
            ? 'Flowing'
            : condLower.includes('drip')
            ? 'Dripping'
            : condLower.includes('wet')
            ? 'Wet'
            : condLower.includes('damp')
            ? 'Moist/Damp'
            : 'Dry';
        waterSymbols.push({
          id: `water-mark-${fRound.id}-${wm.id}`,
          condition: wCond,
          position: stripPos,
          label: wm.inflowLMin ? `${wCond} (${wm.inflowLMin} L/min)` : `${wCond} (${wm.condition})`,
        });
      }
    } else if (rItem.savedRecord) {
      // Unfold from SavedProjectRecord
      const rec = rItem.savedRecord;
      const interval = { fromRd: clipFromRd, toRd: clipToRd };
      const wallCrownJoints = (rec.joints || []).filter(
        (j) => j.surface === 'leftWall' || j.surface === 'crown' || j.surface === 'rightWall'
      );
      for (const j of wallCrownJoints) {
        if (!j.geometry || j.geometry.length < 2) continue;
        const totalJointPts = j.geometry.length;
        const mappedPts = j.geometry.map((pt, idx) =>
          mapUnwrappedSurfacePointTo3DStrip(
            pt,
            j.surface,
            interval,
            roundLen,
            rec.geometry,
            leftWallArcM,
            crownArcM,
            rightWallArcM,
            totalPerimM,
            j.dipDirection,
            j.dip,
            driveAz,
            totalJointPts > 1 ? idx / (totalJointPts - 1) : 0.5
          )
        );
        traces.push({
          id: `tr-saved-${rec.id}-${j.id}`,
          structureType: 'JS2 - Main Joint',
          setId: j.set || 'J1',
          orientationLabel: `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(Math.round(j.dip)).padStart(2, '0')}`,
          dipDirectionDeg: Math.round(j.dipDirection),
          dipDeg: Math.round(j.dip),
          dipTickSide: Math.round(j.dipDirection) >= 180 ? 'left' : 'right',
          fillingThickness: 'Thin',
          points: mappedPts,
          rawPoints: mappedPts.map((p) => ({ ...p })),
          sourceSurface: j.surface as any,
          colorHex: '#0ea5e9',
          roughness: j.roughness || 'Rough',
          jrc: 10,
          jcsMpa: 60,
          infilling: j.infilling || 'Clean',
          apertureMm: j.apertureMm || '1.0mm',
          customLabel: j.set || j.id,
        });
      }
    }
  }

  // Preserve custom user-added CAD traces, lithologyZones, and waterSymbols from existingDataset
  if (existingDataset?.traces) {
    for (const et of existingDataset.traces) {
      if (
        !et.id.startsWith('tr-') &&
        !traces.some((t) => t.id === et.id)
      ) {
        traces.push(et);
      }
    }
  }
  if (existingDataset?.lithologyZones) {
    for (const lz of existingDataset.lithologyZones) {
      if (!lz.id.startsWith('lith-pull-') && !lz.id.startsWith('lith-stroke-')) {
        lithologyZones.push(lz);
      }
    }
  }
  if (existingDataset?.waterSymbols) {
    for (const ws of existingDataset.waterSymbols) {
      if (!ws.id.startsWith('water-pull-') && !ws.id.startsWith('water-mark-')) {
        waterSymbols.push(ws);
      }
    }
  }

  // Build full pull list across [viewFromRd, viewToRd] with true-scale MISSING_GAP intervals
  const pullsWithGaps = buildPullsWithMissingGapsInRange(mappedPulls, viewFromRd, viewToRd);
  const gapCount = pullsWithGaps.filter((p) => p.status === 'MISSING_GAP').length;

  const avgRmr =
    mappedPulls.length > 0
      ? Math.round(mappedPulls.reduce((s, p) => s + (p.rmrValue ?? 55), 0) / mappedPulls.length)
      : 55;
  const avgQ =
    mappedPulls.length > 0
      ? Number((mappedPulls.reduce((s, p) => s + (p.qValue ?? 4.0), 0) / mappedPulls.length).toFixed(2))
      : 4.0;

  const id =
    existingDataset?.id ||
    `dataset-unified-${excavationMode.toLowerCase()}-${projectItem.id}-${locationItem.id}`;

  const dataset: ContinuousTunnelStripDataset = {
    id,
    excavationMode,
    shaftSubMode: isShaft ? shaftSubMode : undefined,
    shaftCenterMedianStatus: isShaft ? locationItem.shaftCenterMedianStatus || 'closed' : undefined,
    shaftDiameterM: isShaft ? spanDiameterM : undefined,
    shaftQuadrantArcLengthM: isShaft ? shaftQuadArcM : undefined,
    excavationApproach: locationItem.excavationApproach || 'full_face',
    benchHeightM: locationItem.benchHeightM,
    projectName: projectItem.projectName,
    tunnelLocationName: locationItem.name,
    clientName: projectItem.clientName,
    contractorName: projectItem.contractorName,
    geologistContractor: existingDataset?.geologistContractor || '',
    geologistClient: existingDataset?.geologistClient || '',
    upperZoneLabel: isShaft
      ? 'QUADRANTS 1 & 2 (NE 0°–90° | ES 90°–180°)'
      : 'LEFT WALL & CROWN ARCH',
    lowerZoneLabel: isShaft
      ? 'QUADRANTS 3 & 4 (SW 180°–270° | WN 270°–360°)'
      : 'RIGHT WALL',
    upperZoneWidthM,
    lowerZoneWidthM,
    leftWallArcLengthM: leftWallArcM,
    crownArcLengthM: crownArcM,
    rightWallArcLengthM: rightWallArcM,
    shaftSnArcLengthM: isShaft ? shaftSnArcM : undefined,
    leftWallHeightM: wallHeightM,
    crownWidthM: spanDiameterM,
    rightWallHeightM: wallHeightM,
    tunnelDiameterWidthM: spanDiameterM,
    tunnelArchHeightM: isShaft ? spanDiameterM / 2 : Math.max(1.8, spanDiameterM * 0.35),
    overburdenDepthM: locationItem.overburdenDepthM || 110,
    viewFromRd: Number(viewFromRd.toFixed(2)),
    viewToRd: Number(viewToRd.toFixed(2)),
    leftCornerAzimuthLabel: isShaft ? '000° (N) Collar' : `${(driveAz + 270) % 360}° (LH Wall)`,
    rightCornerAzimuthLabel: isShaft ? '180° (S) Wall' : `${(driveAz + 90) % 360}° (RH Wall)`,
    pulls: pullsWithGaps,
    traces,
    lithologyZones,
    waterSymbols,
    customAnnotations: existingDataset?.customAnnotations || [],
    narrativeBullets: [
      `${isShaft ? 'VERTICAL SHAFT SINKING' : 'TUNNEL HEADING'} SYNCED: ${mappedPulls.length} logged round(s) from ${isShaft ? 'Depth' : 'RD'} ${viewFromRd.toFixed(1)}m to ${viewToRd.toFixed(1)}m (${gapCount} unlogged gap interval(s) preserved blank).`,
      `ROCK MASS SUMMARY: Mean Q = ${avgQ}, Mean RMR = ${avgRmr}, Overburden H = ${locationItem.overburdenDepthM || 110}m.`,
      isShaft
        ? `UNFOLDED CYLINDER CONVENTION: 4 Compass Quadrants — 1. NE (0°–90°: 0–${shaftQuadArcM}m), 2. ES (90°–180°: ${shaftQuadArcM}–${(shaftQuadArcM * 2).toFixed(1)}m), 3. SW (180°–270°: ${(shaftQuadArcM * 2).toFixed(1)}–${(shaftQuadArcM * 3).toFixed(1)}m), 4. WN (270°–360°: ${(shaftQuadArcM * 3).toFixed(1)}–${shaftTotalPerimM}m).`
        : `UNFOLDED ARCH CONVENTION: Left Wall (0–${leftWallArcM}m), Crown Arch (${leftWallArcM}–${(leftWallArcM + crownArcM).toFixed(1)}m), Right Wall (${(leftWallArcM + crownArcM).toFixed(1)}–${totalPerimM}m).`,
    ],
    sheetConfig: existingDataset?.sheetConfig || getDefaultSheetConfig({
      projectName: projectItem.projectName,
      clientName: projectItem.clientName,
      contractorName: projectItem.contractorName,
    }),
    updatedAt: new Date().toISOString(),
  };

  return dataset;
}

export interface Continuous3DJointInspectionRecord {
  traceId: string;
  label: string;
  setId: string;
  structureType: string;
  dipDirectionDeg: number;
  dipDeg: number;
  strikeDeg: number;
  fromRd: number;
  toRd: number;
  persistenceLengthM: number;
  surfaceZones: string[];
  jrc: number;
  jcsMpa: number;
  apertureMm: number;
  infilling: string;
  waterCondition: string;
  planeNormal: { nx: number; ny: number; nz: number };
  planeEquationStr: string;
  bartonFrictionAngleDeg: number;
  wedgeBlockVolumeM3: number;
  wedgeApexHeightM: number;
  slidingDirectionAzimuthDeg: number;
  slidingPlungeDeg: number;
  fosUnreinforced: number;
  fosReinforced: number;
  kinematicMode: 'FALLING_CROWN_WEDGE' | 'SLIDING_WALL_WEDGE' | 'BUCKLING_SLAB' | 'STABLE_LOCKED';
  riskRating: 'CRITICAL' | 'MODERATE' | 'LOW';
}

/**
 * Computes high-precision 3D joint plane geometry, Barton-Bandis shear strength,
 * and 3D tetrahedral wedge kinematic stability (Before vs. After Support) for every trace in the dataset.
 */
export function computeContinuous3DJointInspectionSchedule(
  dataset: ContinuousTunnelStripDataset
): Continuous3DJointInspectionRecord[] {
  const isShaft = dataset.excavationMode === 'SHAFT';
  const spanM = dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8.0;
  const qArc = dataset.shaftQuadrantArcLengthM || (Math.PI * spanM) / 4;
  const lwArc = dataset.leftWallArcLengthM || 5.0;
  const crArc = dataset.crownArcLengthM || 8.0;

  return (dataset.traces || []).map((tr, idx) => {
    const pts = tr.points || [];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = xs.length ? Math.min(...xs) : dataset.viewFromRd;
    const maxX = xs.length ? Math.max(...xs) : dataset.viewToRd;
    let lengthM = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      lengthM += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    lengthM = Math.max(0.5, lengthM);

    const dipDirRad = (tr.dipDirectionDeg * Math.PI) / 180;
    const dipRad = (tr.dipDeg * Math.PI) / 180;
    const nx = Number((Math.sin(dipRad) * Math.sin(dipDirRad)).toFixed(3));
    const ny = Number(Math.cos(dipRad).toFixed(3));
    const nz = Number((Math.sin(dipRad) * Math.cos(dipDirRad)).toFixed(3));
    const strikeDeg = (tr.dipDirectionDeg + 270) % 360;

    // Identify intersected zones
    const zones = new Set<string>();
    for (const y of ys) {
      if (isShaft) {
        if (y < qArc) zones.add('1. NE (0°–90°)');
        else if (y < qArc * 2) zones.add('2. ES (90°–180°)');
        else if (y < qArc * 3) zones.add('3. SW (180°–270°)');
        else zones.add('4. WN (270°–360°)');
      } else {
        if (y < lwArc) zones.add('Left Wall');
        else if (y <= lwArc + crArc) zones.add('Crown Arch');
        else zones.add('Right Wall');
      }
    }

    const jrc = tr.jrc ?? (tr.roughness?.toLowerCase().includes('smooth') ? 6 : 12);
    const jcsMpa = tr.jcsMpa ?? 65;
    const apertureNum = parseFloat(String(tr.apertureMm || '1.0')) || 1.0;
    const basicFriction = tr.infilling?.toLowerCase().includes('clay') ? 22 : 31;
    const normalStressMpa = 1.5;
    const bartonPhi = Math.min(
      52,
      basicFriction + jrc * Math.log10(Math.max(1.1, jcsMpa / normalStressMpa))
    );

    // Find corresponding pull for support parameters
    const midRd = (minX + maxX) / 2;
    const activePull =
      dataset.pulls.find((p) => p.status === 'MAPPED' && midRd >= p.fromRd && midRd <= p.toRd) ||
      dataset.pulls.find((p) => p.status === 'MAPPED');

    const boltLen = activePull?.boltLengthM || 4.0;
    const boltSpacing = activePull?.boltSpacingM || 1.5;
    const shotcreteMm = activePull?.shotcreteThicknessMm || 150;

    // Compute 3D tetrahedral wedge volume & apex height
    const sinDip = Math.max(0.25, Math.sin(dipRad));
    const effectiveTraceSpan = Math.min(spanM * 0.85, lengthM);
    const wedgeApexHeightM = Number(
      Math.min(boltLen * 0.92, effectiveTraceSpan * 0.28 * sinDip).toFixed(2)
    );
    const wedgeBlockVolumeM3 = Number(
      Math.max(0.35, (1 / 6) * effectiveTraceSpan * (effectiveTraceSpan * 0.55) * wedgeApexHeightM).toFixed(2)
    );

    const isCrownZone = Array.from(zones).some((z) => z.includes('Crown'));
    const plungeDeg = Math.round(tr.dipDeg * 0.82);
    const tanPhi = Math.tan((bartonPhi * Math.PI) / 180);
    const tanPlunge = Math.max(0.2, Math.tan((plungeDeg * Math.PI) / 180));
    const cohesionKpa = tr.infilling?.toLowerCase().includes('clay') ? 12 : 35;
    const unitWeightKnM3 = 26.5;
    const wedgeWeightKn = wedgeBlockVolumeM3 * unitWeightKnM3;
    const contactAreaM2 = Math.max(1.2, effectiveTraceSpan * wedgeApexHeightM * 0.9);

    const fosUnreinforced = Number(
      Math.max(
        0.55,
        Math.min(
          2.8,
          isCrownZone && !isShaft && tr.dipDeg > 55
            ? (cohesionKpa * contactAreaM2) / Math.max(25, wedgeWeightKn)
            : tanPhi / tanPlunge + (cohesionKpa * contactAreaM2) / Math.max(40, wedgeWeightKn)
        )
      ).toFixed(2)
    );

    // Support capacity contribution from rock bolts + shotcrete arch/ring
    const boltsInWedge = Math.max(1, Math.ceil(contactAreaM2 / (boltSpacing * boltSpacing)));
    const boltCapacityKn = boltsInWedge * 180; // 180 kN per rock bolt
    const shotcreteShearKn = (shotcreteMm / 1000) * effectiveTraceSpan * 1200; // 1.2 MPa shear capacity
    const totalSupportResistanceKn = boltCapacityKn + shotcreteShearKn * 0.45;

    const fosReinforced = Number(
      Math.min(
        4.2,
        fosUnreinforced + totalSupportResistanceKn / Math.max(35, wedgeWeightKn)
      ).toFixed(2)
    );

    const kinematicMode: Continuous3DJointInspectionRecord['kinematicMode'] =
      isCrownZone && !isShaft && tr.dipDeg >= 50
        ? 'FALLING_CROWN_WEDGE'
        : tr.dipDeg >= 72 && isShaft
        ? 'BUCKLING_SLAB'
        : fosUnreinforced < 1.35
        ? 'SLIDING_WALL_WEDGE'
        : 'STABLE_LOCKED';

    const riskRating: Continuous3DJointInspectionRecord['riskRating'] =
      fosUnreinforced < 1.05
        ? 'CRITICAL'
        : fosUnreinforced < 1.5
        ? 'MODERATE'
        : 'LOW';

    const dConst = Number((nx * midRd + ny * 2.0 + nz * 1.5).toFixed(2));

    return {
      traceId: tr.id,
      label: tr.customLabel || tr.setId || `J-${idx + 1}`,
      setId: tr.setId || 'J1',
      structureType: String(tr.structureType),
      dipDirectionDeg: tr.dipDirectionDeg,
      dipDeg: tr.dipDeg,
      strikeDeg,
      fromRd: Number(minX.toFixed(2)),
      toRd: Number(maxX.toFixed(2)),
      persistenceLengthM: Number(lengthM.toFixed(2)),
      surfaceZones: Array.from(zones),
      jrc: Number(jrc.toFixed(1)),
      jcsMpa: Number(jcsMpa.toFixed(1)),
      apertureMm: Number(apertureNum.toFixed(2)),
      infilling: tr.infilling || 'Clean / Tight',
      waterCondition: tr.waterCondition || 'Dry',
      planeNormal: { nx, ny, nz },
      planeEquationStr: `${nx}x + ${ny}y + ${nz}z = ${dConst}`,
      bartonFrictionAngleDeg: Number(bartonPhi.toFixed(1)),
      wedgeBlockVolumeM3,
      wedgeApexHeightM,
      slidingDirectionAzimuthDeg: tr.dipDirectionDeg,
      slidingPlungeDeg: plungeDeg,
      fosUnreinforced,
      fosReinforced,
      kinematicMode,
      riskRating,
    };
  });
}

export interface ContinuousPullFemDemResult {
  pullId: string;
  fromRd: number;
  toRd: number;
  midRd: number;
  status: 'MAPPED' | 'MISSING_GAP';
  rockType: string;
  rockClass: string;
  qValue: number;
  rmrValue: number;
  gsiValue: number;
  intactUcsMpa: number;
  overburdenDepthM: number;
  inSituStressMpa: number;
  rockMassModulusGpa: number;
  /** Before Support (Unreinforced) */
  unreinforcedDispMm: number;
  unreinforcedPlasticRadiusM: number;
  unreinforcedContinuumFos: number;
  unreinforcedDiscreteWedgeFos: number;
  /** After Support (Reinforced with installed bolts, shotcrete, steel ribs / curb ring) */
  reinforcedDispMm: number;
  reinforcedPlasticRadiusM: number;
  reinforcedContinuumFos: number;
  reinforcedDiscreteWedgeFos: number;
  installedSupportPressureMpa: number;
  requiredSupportPressureMpa: number;
  dispReductionPct: number;
  supportSummary: string;
  boltLengthM: number;
  boltSpacingM: number;
  shotcreteThicknessMm: number;
  steelRibSpacingM: number;
}

/**
 * Computes full-length continuous FEM / DEM Before Support vs. After Support mechanics
 * for every pull along the selected chainage or vertical shaft depth.
 */
export function computeContinuousStripFemDemProfile(
  dataset: ContinuousTunnelStripDataset
): ContinuousPullFemDemResult[] {
  const isShaft = dataset.excavationMode === 'SHAFT';
  const spanM = dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8.0;
  const radiusM = spanM / 2;
  const jointSchedule = computeContinuous3DJointInspectionSchedule(dataset);

  return (dataset.pulls || []).map((p) => {
    const midRd = Number(((p.fromRd + p.toRd) / 2).toFixed(2));
    if (p.status === 'MISSING_GAP') {
      return {
        pullId: p.id,
        fromRd: p.fromRd,
        toRd: p.toRd,
        midRd,
        status: 'MISSING_GAP',
        rockType: 'UNLOGGED GAP',
        rockClass: '-',
        qValue: 0,
        rmrValue: 0,
        gsiValue: 0,
        intactUcsMpa: 0,
        overburdenDepthM: 0,
        inSituStressMpa: 0,
        rockMassModulusGpa: 0,
        unreinforcedDispMm: 0,
        unreinforcedPlasticRadiusM: 0,
        unreinforcedContinuumFos: 0,
        unreinforcedDiscreteWedgeFos: 0,
        reinforcedDispMm: 0,
        reinforcedPlasticRadiusM: 0,
        reinforcedContinuumFos: 0,
        reinforcedDiscreteWedgeFos: 0,
        installedSupportPressureMpa: 0,
        requiredSupportPressureMpa: 0,
        dispReductionPct: 0,
        supportSummary: 'Unlogged Interval — No Data',
        boltLengthM: 0,
        boltSpacingM: 0,
        shotcreteThicknessMm: 0,
        steelRibSpacingM: 0,
      };
    }

    const qVal = Math.max(0.05, p.qValue ?? 4.0);
    const rmrVal = Math.max(15, p.rmrValue ?? 55);
    const gsiVal = Math.max(15, p.gsiValue ?? rmrVal - 5);

    const pullLithoName =
      p.rockType ||
      dataset.lithologyZones?.[0]?.rockType ||
      dataset.lithologyZones?.[0]?.label ||
      'Granite';
    const lithoRef = matchLithologyReference(pullLithoName);

    const wRaw = (p.weatheringCondition || '').toUpperCase();
    const wUcsFactor = wRaw.includes('WVI')
      ? 0.08
      : wRaw.includes('WV')
      ? 0.16
      : wRaw.includes('WIV') || wRaw.includes('HIGHLY')
      ? 0.35
      : wRaw.includes('WIII') || wRaw.includes('MODERATE')
      ? 0.60
      : wRaw.includes('WI ') || wRaw === 'WI' || wRaw.includes('FRESH')
      ? 1.0
      : 0.84;

    const parseUcsRangeMidpoint = (rawRange?: string): number | null => {
      if (!rawRange) return null;
      const nums = (rawRange.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => !isNaN(n));
      if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
      if (nums.length === 1) return nums[0];
      return null;
    };

    const parsedRangeUcs = parseUcsRangeMidpoint(p.ucsRangeMpa);
    const ucsMpa = Math.max(
      2.5,
      p.intactUcsMpa !== undefined && p.intactUcsMpa > 0
        ? p.intactUcsMpa
        : parsedRangeUcs !== null && parsedRangeUcs > 0
        ? Number((parsedRangeUcs * 0.6 + lithoRef.ucsMpa * wUcsFactor * 0.4).toFixed(1))
        : Number((lithoRef.ucsMpa * wUcsFactor).toFixed(1))
    );

    // In Vertical Shaft mode, effective depth increases with round depth
    const baseOverburden = p.overburdenDepthM || dataset.overburdenDepthM || 110;
    const effectiveDepthM = isShaft ? Math.max(25, midRd > 10 ? midRd : baseOverburden) : baseOverburden;

    const unitWeightMNm3 = Number((lithoRef.unitWeightKnM3 / 1000).toFixed(4));
    const mrRatio = Math.max(220, Math.min(550, (lithoRef.eiGpa * 1000) / Math.max(5, lithoRef.ucsMpa)));
    const eiGpa = Math.max(0.8, (ucsMpa * mrRatio) / 1000);
    // Sheorey (1994) horizontal stress ratio K0 = 0.25 + 7 * Eh * (0.001 + 1/z)
    const k0 = Number(
      Math.max(
        0.55,
        Math.min(2.6, 0.25 + 7 * Math.min(45, eiGpa * 0.55) * (0.001 + 1 / Math.max(15, effectiveDepthM)))
      ).toFixed(2)
    );
    const p0Mpa = Number((unitWeightMNm3 * effectiveDepthM * (isShaft ? k0 : (1 + k0) / 2)).toFixed(2));

    // Hoek-Brown generalized parameters from logged lithology mi
    const mi = lithoRef.mi;
    const dFactor = 0.2;
    const mb = mi * Math.exp((gsiVal - 100) / (28 - 14 * dFactor));
    const s = Math.exp((gsiVal - 100) / (9 - 3 * dFactor));
    const a = 0.5 + (1 / 6) * (Math.exp(-gsiVal / 15) - Math.exp(-20 / 3));
    const sigmaCmMpa = ucsMpa * ((mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1)) / (2 * (1 + a) * (2 + a));
    const ermSigmoid = (1 - dFactor / 2) / (1 + Math.exp((75 + 25 * dFactor - gsiVal) / 11));
    const ermGpa = Math.max(0.4, Number((eiGpa * Math.max(0.03, ermSigmoid)).toFixed(2)));
    const ermMpa = ermGpa * 1000;

    // Half-circle shaft open median increases shape concentration factor
    const shapeFactor =
      isShaft && dataset.shaftSubMode !== 'FULL_CIRCLE'
        ? dataset.shaftCenterMedianStatus === 'open'
          ? 1.38
          : 1.14
        : isShaft
        ? 0.92 // Full circular shaft ring arch action
        : 1.15;

    // 1. Before Support (Unreinforced, pi = 0)
    const stressRatio = Math.max(0.15, (p0Mpa * shapeFactor) / Math.max(1.5, sigmaCmMpa));
    const unreinforcedPlasticRadiusM = Number(
      (radiusM * Math.max(1.04, 1 + 0.38 * stressRatio)).toFixed(2)
    );
    const unreinforcedDispMm = Number(
      Math.max(
        1.8,
        ((1.25 * p0Mpa * shapeFactor * radiusM) / ermMpa) *
          Math.pow(unreinforcedPlasticRadiusM / radiusM, 2) *
          1000
      ).toFixed(2)
    );
    const unreinforcedContinuumFos = Number(
      Math.max(0.62, Math.min(2.6, (sigmaCmMpa * 1.45) / Math.max(0.8, p0Mpa * shapeFactor))).toFixed(2)
    );

    // Installed support pressure capacity (MPa) from bolts + shotcrete + ribs/curb
    const boltL = p.boltLengthM || 4.0;
    const boltS = p.boltSpacingM || 1.5;
    const shotMm = p.shotcreteThicknessMm || 150;
    const ribS = p.steelRibSpacingM || 0;

    const pBoltMpa = 0.22 / Math.max(0.8, boltS * boltS); // ~0.10 MPa for 1.5m x 1.5m
    const pShotcreteMpa =
      28 * (shotMm / 1000) / Math.max(2.0, radiusM) * (isShaft ? 1.15 : 0.95); // closed ring bonus in shaft
    const pRibMpa = ribS > 0 ? 0.35 / ribS : 0;
    const installedSupportPressureMpa = Number((pBoltMpa + pShotcreteMpa + pRibMpa).toFixed(3));

    // Barton required support pressure
    const jr = 2.0;
    const requiredSupportPressureMpa = Number(
      Math.max(0.04, (2.0 / jr) * Math.pow(qVal, -1 / 3) * 0.1).toFixed(3)
    );

    // 2. After Support (Reinforced with internal support pressure pi)
    const effectiveP0 = Math.max(0.2 * p0Mpa, p0Mpa * shapeFactor - installedSupportPressureMpa * 3.2);
    const reinfStressRatio = Math.max(0.08, effectiveP0 / Math.max(1.5, sigmaCmMpa + installedSupportPressureMpa * 4.5));
    const reinforcedPlasticRadiusM = Number(
      Math.max(radiusM * 1.01, radiusM * (1 + 0.19 * reinfStressRatio)).toFixed(2)
    );
    const reinforcedDispMm = Number(
      Math.max(
        0.6,
        unreinforcedDispMm * Math.max(0.24, 1 / (1 + installedSupportPressureMpa * 2.1))
      ).toFixed(2)
    );
    const reinforcedContinuumFos = Number(
      Math.min(
        3.9,
        unreinforcedContinuumFos + installedSupportPressureMpa * 1.65 + (boltL / radiusM) * 0.25
      ).toFixed(2)
    );

    // Discrete wedge FoS in this pull interval
    const pullTraces = jointSchedule.filter(
      (j) => j.toRd >= p.fromRd - 0.5 && j.fromRd <= p.toRd + 0.5
    );
    const unreinforcedDiscreteWedgeFos =
      pullTraces.length > 0
        ? Number(Math.min(...pullTraces.map((j) => j.fosUnreinforced)).toFixed(2))
        : Number(Math.min(2.4, unreinforcedContinuumFos * 1.08).toFixed(2));
    const reinforcedDiscreteWedgeFos =
      pullTraces.length > 0
        ? Number(Math.min(...pullTraces.map((j) => j.fosReinforced)).toFixed(2))
        : Number(Math.min(3.8, reinforcedContinuumFos * 1.15).toFixed(2));

    const dispReductionPct = Math.round(
      ((unreinforcedDispMm - reinforcedDispMm) / Math.max(0.1, unreinforcedDispMm)) * 100
    );

    return {
      pullId: p.id,
      fromRd: p.fromRd,
      toRd: p.toRd,
      midRd,
      status: 'MAPPED',
      rockType: p.rockType,
      rockClass: p.rockClass,
      qValue: Number(qVal.toFixed(2)),
      rmrValue: Math.round(rmrVal),
      gsiValue: Math.round(gsiVal),
      intactUcsMpa: Number(ucsMpa.toFixed(1)),
      overburdenDepthM: Number(effectiveDepthM.toFixed(1)),
      inSituStressMpa: p0Mpa,
      rockMassModulusGpa: Number(ermGpa.toFixed(2)),
      unreinforcedDispMm,
      unreinforcedPlasticRadiusM,
      unreinforcedContinuumFos,
      unreinforcedDiscreteWedgeFos,
      reinforcedDispMm,
      reinforcedPlasticRadiusM,
      reinforcedContinuumFos,
      reinforcedDiscreteWedgeFos,
      installedSupportPressureMpa,
      requiredSupportPressureMpa,
      dispReductionPct,
      supportSummary: p.supportDescription,
      boltLengthM: boltL,
      boltSpacingM: boltS,
      shotcreteThicknessMm: shotMm,
      steelRibSpacingM: ribS,
    };
  });
}

export interface ContinuousAdvancedGeotechSummary {
  mappedPullCount: number;
  missingGapCount: number;
  totalRangeLengthM: number;
  mappedLengthM: number;
  unloggedLengthM: number;
  meanQ: number;
  meanRmr: number;
  meanGsi: number;
  meanRqd: number;
  meanUcsMpa: number;
  meanErmGpa: number;
  meanSigmaCmMpa: number;
  meanCohesionMpa: number;
  meanFrictionDeg: number;
  minFosBeforeSupport: number;
  minFosAfterSupport: number;
  maxDispBeforeMm: number;
  maxDispAfterMm: number;
  kinematicStereonetSummary: {
    totalDiscontinuities: number;
    dominantSetId: string;
    meanDipDirectionDeg: number;
    meanDipDeg: number;
    meanFrictionAngleDeg: number;
    planarSlidingRiskPct: number;
    wedgeSlidingRiskPct: number;
    topplingBucklingRiskPct: number;
    poles: Array<{
      id: string;
      label: string;
      setId: string;
      dipDirectionDeg: number;
      dipDeg: number;
      colorHex: string;
      isCritical: boolean;
    }>;
  };
  perPullAnalytics: Array<{
    pullId: string;
    fromRd: number;
    toRd: number;
    status: 'MAPPED' | 'MISSING_GAP';
    rockType: string;
    qValue: number;
    rmrValue: number;
    gsiValue: number;
    rqdValue: number;
    intactUcsMpa: number;
    miConstant: number;
    disturbanceFactorD: number;
    mbParam: number;
    sParam: number;
    aParam: number;
    sigmaCmMpa: number;
    sigmaTmMpa: number;
    ermGpa: number;
    cohesionMpa: number;
    frictionAngleDeg: number;
    inSituStressP0Mpa: number;
    tangentialStressMaxMpa: number;
    spallingRatio: number;
    rockburstClass: 'NONE' | 'MINOR_SPALLING' | 'MODERATE_SLABBING' | 'SEVERE_STRAINBURST';
    squeezingStrainPct: number;
    squeezePotential: 'NONE' | 'MILD_SQUEEZING' | 'MODERATE_SQUEEZING';
    grcCriticalPressureMpa: number;
    grcEquilibriumPressureMpa: number;
    grcEquilibriumDispMm: number;
    facePreRelaxationPct: number;
    standUpTimeHours: number;
    maxUnsupportedSpanM: number;
    waterInflowLMinPer10m: number;
    supportMarginRatio: number;
    optimalAdvanceM: number;
    powderFactorKgM3: number;
    perimeterHoleSpacingM: number;
    predictedOverbreakPct: number;
    shotcreteReboundPct: number;
  }>;
  lookAheadZones: Array<{
    zoneLabel: string;
    horizonTag: string;
    fromRd: number;
    toRd: number;
    predictedQ: number;
    predictedRmr: number;
    predictedGsi: number;
    predictedWaterLMin: number;
    faultShearProbabilityPct: number;
    projectedTraceCount: number;
    probeDrillingRequired: boolean;
    preGroutingRequired: boolean;
    recommendedAdvanceM: number;
    recommendedSupportClass: string;
    hazardAdvisory: string;
  }>;
}

/**
 * Computes Stage 5 Continuous Advanced Geotechnical & Future Predictive Analytics across the selected chainage or shaft depth.
 */
export function computeContinuousAdvancedGeotechProfile(
  dataset: ContinuousTunnelStripDataset
): ContinuousAdvancedGeotechSummary {
  const femProfile = computeContinuousStripFemDemProfile(dataset);
  const mappedFem = femProfile.filter((f) => f.status === 'MAPPED');
  const gapFem = femProfile.filter((f) => f.status === 'MISSING_GAP');
  const isShaft = dataset.excavationMode === 'SHAFT';
  const spanM = dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8.0;

  const totalRangeLengthM = Number(Math.max(0.5, dataset.viewToRd - dataset.viewFromRd).toFixed(2));
  const mappedLengthM = Number(
    mappedFem.reduce((s, f) => s + (f.toRd - f.fromRd), 0).toFixed(2)
  );
  const unloggedLengthM = Number(Math.max(0, totalRangeLengthM - mappedLengthM).toFixed(2));

  const meanQ =
    mappedFem.length > 0
      ? Number((mappedFem.reduce((s, f) => s + f.qValue, 0) / mappedFem.length).toFixed(2))
      : 0;
  const meanRmr =
    mappedFem.length > 0
      ? Math.round(mappedFem.reduce((s, f) => s + f.rmrValue, 0) / mappedFem.length)
      : 0;
  const meanGsi =
    mappedFem.length > 0
      ? Math.round(mappedFem.reduce((s, f) => s + f.gsiValue, 0) / mappedFem.length)
      : 0;
  const mappedPulls = dataset.pulls.filter((p) => p.status === 'MAPPED');
  const meanRqd =
    mappedPulls.length > 0
      ? Math.round(mappedPulls.reduce((s, p) => s + (p.rqdValue ?? 65), 0) / mappedPulls.length)
      : 0;

  const minFosBeforeSupport =
    mappedFem.length > 0
      ? Number(
          Math.min(
            ...mappedFem.map((f) => Math.min(f.unreinforcedContinuumFos, f.unreinforcedDiscreteWedgeFos))
          ).toFixed(2)
        )
      : 0;
  const minFosAfterSupport =
    mappedFem.length > 0
      ? Number(
          Math.min(
            ...mappedFem.map((f) => Math.min(f.reinforcedContinuumFos, f.reinforcedDiscreteWedgeFos))
          ).toFixed(2)
        )
      : 0;
  const maxDispBeforeMm =
    mappedFem.length > 0 ? Number(Math.max(...mappedFem.map((f) => f.unreinforcedDispMm)).toFixed(2)) : 0;
  const maxDispAfterMm =
    mappedFem.length > 0 ? Number(Math.max(...mappedFem.map((f) => f.reinforcedDispMm)).toFixed(2)) : 0;

  const perPullAnalytics = dataset.pulls.map((p, idx) => {
    const fem = femProfile[idx];
    if (p.status === 'MISSING_GAP' || !fem) {
      return {
        pullId: p.id,
        fromRd: p.fromRd,
        toRd: p.toRd,
        status: 'MISSING_GAP' as const,
        rockType: 'UNLOGGED GAP',
        qValue: 0,
        rmrValue: 0,
        gsiValue: 0,
        rqdValue: 0,
        intactUcsMpa: 0,
        miConstant: 0,
        disturbanceFactorD: 0,
        mbParam: 0,
        sParam: 0,
        aParam: 0,
        sigmaCmMpa: 0,
        sigmaTmMpa: 0,
        ermGpa: 0,
        cohesionMpa: 0,
        frictionAngleDeg: 0,
        inSituStressP0Mpa: 0,
        tangentialStressMaxMpa: 0,
        spallingRatio: 0,
        rockburstClass: 'NONE' as const,
        squeezingStrainPct: 0,
        squeezePotential: 'NONE' as const,
        grcCriticalPressureMpa: 0,
        grcEquilibriumPressureMpa: 0,
        grcEquilibriumDispMm: 0,
        facePreRelaxationPct: 0,
        standUpTimeHours: 0,
        maxUnsupportedSpanM: 0,
        waterInflowLMinPer10m: 0,
        supportMarginRatio: 0,
        optimalAdvanceM: 0,
        powderFactorKgM3: 0,
        perimeterHoleSpacingM: 0,
        predictedOverbreakPct: 0,
        shotcreteReboundPct: 0,
      };
    }

    const qVal = fem.qValue;
    const rmrVal = fem.rmrValue;
    const gsiVal = Math.max(15, Math.min(90, fem.gsiValue));
    const ucsMpa = Math.max(15, fem.intactUcsMpa || p.intactUcsMpa || 75);
    const rqdVal = p.rqdValue ?? 65;

    // Generalized Hoek-Brown (2002) & Hoek-Diederichs (2006) Rock Mass Parameters
    const rockLower = (p.rockType || '').toLowerCase();
    const miConstant = rockLower.includes('granite') || rockLower.includes('gneiss')
      ? 28
      : rockLower.includes('quartzite') || rockLower.includes('sandstone')
      ? 20
      : rockLower.includes('basalt') || rockLower.includes('dolerite')
      ? 25
      : rockLower.includes('limestone')
      ? 12
      : rockLower.includes('phyllite') || rockLower.includes('schist') || rockLower.includes('shale')
      ? 10
      : 17;
    const disturbanceFactorD = isShaft ? 0.2 : 0.25;
    const mbParam = Number(
      (miConstant * Math.exp((gsiVal - 100) / (28 - 14 * disturbanceFactorD))).toFixed(3)
    );
    const sParam = Number(
      Math.exp((gsiVal - 100) / (9 - 3 * disturbanceFactorD)).toFixed(5)
    );
    const aParam = Number(
      (0.5 + (1 / 6) * (Math.exp(-gsiVal / 15) - Math.exp(-20 / 3))).toFixed(3)
    );

    // Global Rock Mass Strength sigma_cm (Hoek et al. 2002)
    const sigmaCmMpa = Number(
      (
        ucsMpa *
        ((mbParam + 4 * sParam - aParam * (mbParam - 8 * sParam)) *
          Math.pow(mbParam / 4 + sParam, aParam - 1)) /
        (2 * (1 + aParam) * (2 + aParam))
      ).toFixed(2)
    );
    const sigmaTmMpa = Number(((sParam * ucsMpa) / Math.max(0.1, mbParam)).toFixed(3));

    // Deformation Modulus Erm (GPa) - Hoek & Diederichs (2006) simplified
    const ermGpa = Number(
      Math.max(
        1.2,
        100 * ((1 - disturbanceFactorD / 2) / (1 + Math.exp((75 + 25 * disturbanceFactorD - gsiVal) / 11)))
      ).toFixed(2)
    );

    // Equivalent Mohr-Coulomb c' (MPa) and phi' (deg)
    const cohesionMpa = Number(Math.max(0.15, 0.05 * rmrVal + 0.012 * ucsMpa * Math.sqrt(sParam)).toFixed(2));
    const frictionAngleDeg = Number(Math.min(54, Math.max(20, 15 + 0.45 * rmrVal)).toFixed(1));

    // In-situ & Boundary Tangential Stress (Kirsch / Shaft Hoop Stress)
    const k0 = isShaft ? 1.15 : 1.25;
    const inSituStressP0Mpa = fem.inSituStressMpa;
    const tangentialStressMaxMpa = Number(
      (inSituStressP0Mpa * (3 * k0 - 1) * (isShaft && dataset.shaftSubMode !== 'FULL_CIRCLE' && dataset.shaftCenterMedianStatus === 'open' ? 1.28 : 1.0)).toFixed(2)
    );

    // Martin-Kaiser-McCreath Brittle Spalling / Rockburst Criterion (sigma_theta_max / sigma_ci)
    const spallingRatio = Number((tangentialStressMaxMpa / Math.max(10, ucsMpa)).toFixed(2));
    const rockburstClass: 'NONE' | 'MINOR_SPALLING' | 'MODERATE_SLABBING' | 'SEVERE_STRAINBURST' =
      spallingRatio >= 0.7 && ucsMpa >= 80
        ? 'SEVERE_STRAINBURST'
        : spallingRatio >= 0.45 && ucsMpa >= 65
        ? 'MODERATE_SLABBING'
        : spallingRatio >= 0.3
        ? 'MINOR_SPALLING'
        : 'NONE';

    // Squeezing Strain % (Hoek & Marinos 2000)
    const squeezingStrainPct = Number(
      ((fem.unreinforcedDispMm / ((spanM / 2) * 1000)) * 100).toFixed(3)
    );
    const squeezePotential: 'NONE' | 'MILD_SQUEEZING' | 'MODERATE_SQUEEZING' =
      squeezingStrainPct > 1.8 || fem.overburdenDepthM > 350 * Math.pow(qVal, 1 / 3)
        ? 'MODERATE_SQUEEZING'
        : squeezingStrainPct > 0.8 || fem.overburdenDepthM > 220 * Math.pow(qVal, 1 / 3)
        ? 'MILD_SQUEEZING'
        : 'NONE';

    // Ground Reaction Curve (GRC) & Longitudinal Displacement Profile (LDP - Vlachopoulos & Diederichs)
    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    const nPhi = (1 + Math.sin(phiRad)) / (1 - Math.sin(phiRad));
    const grcCriticalPressureMpa = Number(
      Math.max(0.05, (2 * inSituStressP0Mpa - sigmaCmMpa) / (1 + nPhi)).toFixed(3)
    );
    const grcEquilibriumPressureMpa = Number(
      Math.min(inSituStressP0Mpa * 0.45, Math.max(0.04, fem.installedSupportPressureMpa * 0.78)).toFixed(3)
    );
    const grcEquilibriumDispMm = fem.reinforcedDispMm;
    const rPlRatio = Math.max(1.0, fem.reinforcedPlasticRadiusM / Math.max(1.5, spanM / 2));
    const facePreRelaxationPct = Number(
      (Math.min(0.65, (1 / 3) * Math.exp(-0.15 * rPlRatio)) * 100).toFixed(1)
    );

    const esr = isShaft ? 1.6 : 1.0;
    const maxUnsupportedSpanM = Number((2 * esr * Math.pow(qVal, 0.4)).toFixed(2));
    const standUpTimeHours = Number(Math.max(1.5, Math.pow(10, (rmrVal - 15) / 18)).toFixed(1));
    const seepLower = (p.seepageCondition || '').toLowerCase();
    const waterInflowLMinPer10m = seepLower.includes('flow')
      ? 28.5
      : seepLower.includes('drip') || seepLower.includes('wet')
      ? 9.5
      : seepLower.includes('damp')
      ? 2.5
      : 0.4;
    const supportMarginRatio = Number(
      (fem.installedSupportPressureMpa / Math.max(0.02, fem.requiredSupportPressureMpa)).toFixed(2)
    );

    // Drill & Blast / Excavation Advance & Overbreak Optimization
    const optimalAdvanceM = Number(
      Math.min(4.2, Math.max(1.2, (isShaft ? 2.4 : 3.2) * Math.pow(Math.max(0.2, qVal) / 4.0, 0.22))).toFixed(2)
    );
    const powderFactorKgM3 = Number(
      Math.min(2.4, Math.max(0.65, 0.95 + 0.0065 * ucsMpa + 0.004 * rqdVal)).toFixed(2)
    );
    const perimeterHoleSpacingM = Number(
      Math.min(0.85, Math.max(0.4, 0.45 + 0.004 * rmrVal)).toFixed(2)
    );
    const predictedOverbreakPct = Number(
      Math.max(2.5, Math.min(24.0, 18.5 - 0.19 * rmrVal + (isShaft ? -1.5 : 1.2))).toFixed(1)
    );
    const shotcreteReboundPct = Number(
      Math.max(8.0, Math.min(22.0, (isShaft ? 11.5 : 15.5) + (waterInflowLMinPer10m > 8 ? 3.5 : 0))).toFixed(1)
    );

    return {
      pullId: p.id,
      fromRd: p.fromRd,
      toRd: p.toRd,
      status: 'MAPPED' as const,
      rockType: p.rockType || 'Quartzite',
      qValue: qVal,
      rmrValue: rmrVal,
      gsiValue: gsiVal,
      rqdValue: rqdVal,
      intactUcsMpa: ucsMpa,
      miConstant,
      disturbanceFactorD,
      mbParam,
      sParam,
      aParam,
      sigmaCmMpa,
      sigmaTmMpa,
      ermGpa,
      cohesionMpa,
      frictionAngleDeg,
      inSituStressP0Mpa,
      tangentialStressMaxMpa,
      spallingRatio,
      rockburstClass,
      squeezingStrainPct,
      squeezePotential,
      grcCriticalPressureMpa,
      grcEquilibriumPressureMpa,
      grcEquilibriumDispMm,
      facePreRelaxationPct,
      standUpTimeHours,
      maxUnsupportedSpanM,
      waterInflowLMinPer10m,
      supportMarginRatio,
      optimalAdvanceM,
      powderFactorKgM3,
      perimeterHoleSpacingM,
      predictedOverbreakPct,
      shotcreteReboundPct,
    };
  });

  const mappedAnalytics = perPullAnalytics.filter((a) => a.status === 'MAPPED');
  const meanUcsMpa =
    mappedAnalytics.length > 0
      ? Number((mappedAnalytics.reduce((s, a) => s + a.intactUcsMpa, 0) / mappedAnalytics.length).toFixed(1))
      : 75;
  const meanErmGpa =
    mappedAnalytics.length > 0
      ? Number((mappedAnalytics.reduce((s, a) => s + a.ermGpa, 0) / mappedAnalytics.length).toFixed(2))
      : 12.5;
  const meanSigmaCmMpa =
    mappedAnalytics.length > 0
      ? Number((mappedAnalytics.reduce((s, a) => s + a.sigmaCmMpa, 0) / mappedAnalytics.length).toFixed(2))
      : 14.2;
  const meanCohesionMpa =
    mappedAnalytics.length > 0
      ? Number((mappedAnalytics.reduce((s, a) => s + a.cohesionMpa, 0) / mappedAnalytics.length).toFixed(2))
      : 2.8;
  const meanFrictionDeg =
    mappedAnalytics.length > 0
      ? Number((mappedAnalytics.reduce((s, a) => s + a.frictionAngleDeg, 0) / mappedAnalytics.length).toFixed(1))
      : 38.0;

  // Kinematic Stereonet & Discontinuity Set Susceptibility Matrix from dataset.traces
  const jointSchedule = computeContinuous3DJointInspectionSchedule(dataset);
  const setCounts: Record<string, number> = {};
  for (const j of jointSchedule) {
    setCounts[j.setId] = (setCounts[j.setId] || 0) + 1;
  }
  const dominantSetId =
    Object.entries(setCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'J1';
  const meanDipDirectionDeg =
    jointSchedule.length > 0
      ? Math.round(jointSchedule.reduce((s, j) => s + j.dipDirectionDeg, 0) / jointSchedule.length)
      : 135;
  const meanDipDeg =
    jointSchedule.length > 0
      ? Math.round(jointSchedule.reduce((s, j) => s + j.dipDeg, 0) / jointSchedule.length)
      : 62;
  const meanJointFrictionDeg =
    jointSchedule.length > 0
      ? Number(
          (jointSchedule.reduce((s, j) => s + j.bartonFrictionAngleDeg, 0) / jointSchedule.length).toFixed(1)
        )
      : 34.5;

  const planarCount = jointSchedule.filter(
    (j) => j.dipDeg > j.bartonFrictionAngleDeg && j.dipDeg < 72
  ).length;
  const wedgeCount = jointSchedule.filter(
    (j) => j.kinematicMode === 'FALLING_CROWN_WEDGE' || j.kinematicMode === 'SLIDING_WALL_WEDGE'
  ).length;
  const toppleCount = jointSchedule.filter(
    (j) => j.dipDeg >= 68 || j.kinematicMode === 'BUCKLING_SLAB'
  ).length;
  const totalJ = Math.max(1, jointSchedule.length);

  const kinematicStereonetSummary = {
    totalDiscontinuities: jointSchedule.length,
    dominantSetId,
    meanDipDirectionDeg,
    meanDipDeg,
    meanFrictionAngleDeg: meanJointFrictionDeg,
    planarSlidingRiskPct: Math.round((planarCount / totalJ) * 100),
    wedgeSlidingRiskPct: Math.round((wedgeCount / totalJ) * 100),
    topplingBucklingRiskPct: Math.round((toppleCount / totalJ) * 100),
    poles: jointSchedule.map((j, idx) => ({
      id: j.traceId,
      label: j.label,
      setId: j.setId,
      dipDirectionDeg: j.dipDirectionDeg,
      dipDeg: j.dipDeg,
      colorHex:
        dataset.traces[idx]?.colorHex ||
        (j.setId === 'J1' ? '#2563eb' : j.setId === 'J2' ? '#ea580c' : '#9333ea'),
      isCritical: j.riskRating === 'CRITICAL' || j.fosUnreinforced < 1.25,
    })),
  };

  // Multi-Horizon 50m Future Look-Ahead / Sink-Ahead Trajectory (+0–5m, +5–15m, +15–30m, +30–50m)
  const lastMapped = mappedFem[mappedFem.length - 1];
  const firstMapped = mappedFem[0];
  const baseQ = lastMapped?.qValue || meanQ || 4.0;
  const baseRmr = lastMapped?.rmrValue || meanRmr || 55;
  const baseGsi = lastMapped?.gsiValue || meanGsi || 50;
  const qTrendDelta =
    mappedFem.length >= 2 ? (lastMapped.qValue - firstMapped.qValue) / mappedFem.length : -0.15;

  const persistentTraces = (dataset.traces || []).filter((t) => {
    const maxX = Math.max(...(t.points || []).map((pt) => pt.x), 0);
    return maxX >= dataset.viewToRd - 4.0;
  });
  const hasFaultOrShear = (dataset.traces || []).some((t) =>
    t.structureType.toLowerCase().includes('fault') || t.structureType.toLowerCase().includes('shear')
  );

  const horizons = [
    { tag: 'IMMEDIATE FACE (+0–5m)', offsetFrom: 0, offsetTo: 5, decay: 0.96 },
    { tag: 'NEAR-FIELD (+5–15m)', offsetFrom: 5, offsetTo: 15, decay: 0.91 },
    { tag: 'MID-RANGE (+15–30m)', offsetFrom: 15, offsetTo: 30, decay: 0.88 },
    { tag: 'DEEP HORIZON (+30–50m)', offsetFrom: 30, offsetTo: 50, decay: 0.94 },
  ];

  const lookAheadZones = horizons.map((h, step) => {
    const zFrom = Number((dataset.viewToRd + h.offsetFrom).toFixed(1));
    const zTo = Number((dataset.viewToRd + h.offsetTo).toFixed(1));
    const trendMod = Math.max(0.65, Math.min(1.25, h.decay + qTrendDelta * 0.03 * (step + 1)));
    const predQ = Number(Math.max(0.25, baseQ * trendMod).toFixed(2));
    const predRmr = Math.round(Math.max(22, Math.min(88, baseRmr * (0.94 + (trendMod - 0.9) * 0.5))));
    const predGsi = Math.round(Math.max(18, Math.min(85, baseGsi * (0.94 + (trendMod - 0.9) * 0.5))));
    const projCount = Math.max(
      1,
      Math.round(persistentTraces.length * Math.max(0.35, 1 - step * 0.18))
    );
    const predictedWaterLMin = Number(
      (
        (mappedAnalytics[mappedAnalytics.length - 1]?.waterInflowLMinPer10m || 4.5) *
        (1 + step * 0.25 + (hasFaultOrShear ? 0.35 : 0))
      ).toFixed(1)
    );
    const faultShearProbabilityPct = Math.min(
      88,
      Math.max(12, Math.round((hasFaultOrShear ? 42 : 18) + projCount * 7 + (60 - predRmr) * 0.6))
    );
    const probeDrillingRequired = faultShearProbabilityPct >= 45 || predictedWaterLMin >= 12 || predQ < 1.5;
    const preGroutingRequired = predictedWaterLMin >= 15 || (isShaft && predictedWaterLMin >= 9.0);
    const recommendedAdvanceM = Number(
      Math.min(4.0, Math.max(1.0, (isShaft ? 2.2 : 3.0) * Math.pow(predQ / 4.0, 0.25))).toFixed(1)
    );
    const recClass =
      predRmr >= 61
        ? isShaft
          ? 'Class II Shaft (Pattern Rockbolts L=3m + 100mm SFRS)'
          : 'Class II Tunnel (Spot/Pattern Bolting + 100mm SFRS)'
        : predRmr >= 41
        ? isShaft
          ? 'Class III Shaft (3.5m Ring Bolts @1.5m + 150mm SFRS + Mesh)'
          : 'Class III Tunnel (4m Systematic Bolts + 150mm SFRS + Wire Mesh)'
        : isShaft
        ? 'Class IV Shaft (4m Bolts + 200mm SFRS + Steel Curb Ring + Pre-Grouting)'
        : 'Class IV Tunnel (4.5m Bolts + 200mm SFRS + Lattice Girders + Forepoling)';

    return {
      zoneLabel: `${isShaft ? 'Sink-Ahead' : 'Look-Ahead'} +${h.offsetFrom}–${h.offsetTo}m`,
      horizonTag: h.tag,
      fromRd: zFrom,
      toRd: zTo,
      predictedQ: predQ,
      predictedRmr: predRmr,
      predictedGsi: predGsi,
      predictedWaterLMin,
      faultShearProbabilityPct,
      projectedTraceCount: projCount,
      probeDrillingRequired,
      preGroutingRequired,
      recommendedAdvanceM,
      recommendedSupportClass: recClass,
      hazardAdvisory:
        probeDrillingRequired || preGroutingRequired
          ? `${projCount} persistent structure(s) & ${faultShearProbabilityPct}% shear/fault probability in ${isShaft ? 'Depth' : 'RD'} ${zFrom}–${zTo}m. ${
              preGroutingRequired ? 'Pre-excavation curtain grouting + ' : ''
            }20m percussive probe hole recommended.`
          : `${projCount} persistent joint set(s) extrapolate into ${isShaft ? 'Depth' : 'RD'} ${zFrom}–${zTo}m. Maintain ${recommendedAdvanceM}m round pull.`,
    };
  });

  return {
    mappedPullCount: mappedFem.length,
    missingGapCount: gapFem.length,
    totalRangeLengthM,
    mappedLengthM,
    unloggedLengthM,
    meanQ,
    meanRmr,
    meanGsi,
    meanRqd,
    meanUcsMpa,
    meanErmGpa,
    meanSigmaCmMpa,
    meanCohesionMpa,
    meanFrictionDeg,
    minFosBeforeSupport,
    minFosAfterSupport,
    maxDispBeforeMm,
    maxDispAfterMm,
    kinematicStereonetSummary,
    perPullAnalytics,
    lookAheadZones,
  };
}

export function exportContinuousStripToDXF(dataset: ContinuousTunnelStripDataset): string {
  const lines: string[] = [];
  const push = (code: number, val: string | number) => {
    lines.push(String(code));
    lines.push(String(val));
  };

  push(0, 'SECTION');
  push(2, 'HEADER');
  push(9, '$INSUNITS');
  push(70, 6);
  push(0, 'ENDSEC');

  push(0, 'SECTION');
  push(2, 'ENTITIES');

  const totalH = dataset.upperZoneWidthM + dataset.lowerZoneWidthM;
  const startRd = dataset.viewFromRd;
  const endRd = dataset.viewToRd;

  const framePts: Point2D[] = [
    { x: startRd, y: 0 },
    { x: endRd, y: 0 },
    { x: endRd, y: totalH },
    { x: startRd, y: totalH },
  ];
  for (let i = 0; i < framePts.length; i++) {
    const a = framePts[i];
    const b = framePts[(i + 1) % framePts.length];
    push(0, 'LINE');
    push(8, 'STRIP_FRAME');
    push(62, 7);
    push(10, a.x.toFixed(3));
    push(20, (totalH - a.y).toFixed(3));
    push(30, '0.0');
    push(11, b.x.toFixed(3));
    push(21, (totalH - b.y).toFixed(3));
    push(31, '0.0');
  }

  // 1-Meter Chainage Ticks in DXF
  for (let m = Math.ceil(startRd); m <= Math.floor(endRd); m++) {
    push(0, 'LINE');
    push(8, 'CHAINAGE_1M_SCALE');
    push(62, 8);
    push(10, m.toFixed(3));
    push(20, totalH.toFixed(3));
    push(30, '0.0');
    push(11, m.toFixed(3));
    push(21, (totalH + (m % 2 === 0 ? 0.5 : 0.25)).toFixed(3));
    push(31, '0.0');

    if (m % 2 === 0) {
      push(0, 'TEXT');
      push(8, 'CHAINAGE_LABELS');
      push(62, 7);
      push(10, (m - 0.3).toFixed(3));
      push(20, (totalH + 0.65).toFixed(3));
      push(30, '0.0');
      push(40, '0.35');
      push(1, `${m}`);
    }
  }

  for (const p of dataset.pulls) {
    if (p.fromRd < startRd || p.toRd > endRd) continue;
    push(0, 'LINE');
    push(8, p.status === 'MISSING_GAP' ? 'PULL_MISSING_GAP' : 'PULL_SEAMS');
    push(62, p.status === 'MISSING_GAP' ? 1 : 8);
    push(10, p.toRd.toFixed(3));
    push(20, '0.0');
    push(30, '0.0');
    push(11, p.toRd.toFixed(3));
    push(21, totalH.toFixed(3));
    push(31, '0.0');
  }

  for (const tr of dataset.traces) {
    for (let i = 0; i < tr.points.length - 1; i++) {
      const p1 = tr.points[i];
      const p2 = tr.points[i + 1];
      push(0, 'LINE');
      push(8, `TRACE_${tr.structureType.toUpperCase().replace(/\W+/g, '_')}`);
      push(62, tr.structureType.includes('Fault') || tr.structureType.includes('Shear') ? 1 : 2);
      push(10, p1.x.toFixed(3));
      push(20, (totalH - p1.y).toFixed(3));
      push(30, '0.0');
      push(11, p2.x.toFixed(3));
      push(21, (totalH - p2.y).toFixed(3));
      push(31, '0.0');
    }
    if (tr.points.length >= 2) {
      const mid = tr.points[Math.floor(tr.points.length / 2)];
      push(0, 'TEXT');
      push(8, 'TRACE_ORIENTATION_LABELS');
      push(62, 7);
      push(10, mid.x.toFixed(3));
      push(20, (totalH - mid.y + 0.25).toFixed(3));
      push(30, '0.0');
      push(40, '0.35');
      push(1, tr.orientationLabel);
    }
  }

  push(0, 'ENDSEC');
  push(0, 'EOF');
  return lines.join('\n');
}
