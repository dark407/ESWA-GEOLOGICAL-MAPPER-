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
  /** Source unwrapped surface ('leftWall' | 'crown' | 'rightWall' | 'face') */
  sourceSurface?: 'leftWall' | 'crown' | 'rightWall' | 'face';
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
  dateMapped?: string;
  /** Exact unwrapped photos for Left Wall, Crown Arch, and Right Wall at this pull */
  surfacePhotos?: {
    leftWall?: string;
    crown?: string;
    rightWall?: string;
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

export interface ContinuousTunnelStripDataset {
  id: string;
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
  leftWallHeightM?: number;
  crownWidthM?: number;
  rightWallHeightM?: number;
  tunnelDiameterWidthM?: number;
  tunnelArchHeightM?: number;
  viewFromRd: number;
  viewToRd: number;
  leftCornerAzimuthLabel: string;
  rightCornerAzimuthLabel: string;
  pulls: ContinuousPullRecord[];
  traces: ContinuousStripTrace[];
  lithologyZones: ContinuousStripLithologyZone[];
  waterSymbols: ContinuousStripWaterSymbol[];
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
    geologistContractor: 'B. R. Mahtee',
    geologistClient: 'Dr. Gunasekara (FJV)',
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
    geologistContractor: 'Geologist - RPPL',
    geologistClient: 'Geologist - ADANI',
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
  // Do NOT insert synthetic MISSING_GAP filler spaces — strictly return exact mapped pulls sorted by chainage.
  return rawPulls
    .filter((p) => p.status === 'MAPPED')
    .sort((a, b) => a.fromRd - b.fromRd);
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
