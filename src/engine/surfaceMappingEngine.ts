import { JointSet, SurfaceType, TunnelGeometry } from '../types/tunnel';
import { createTunnelGeometry } from './geometryEngine';
import type { FieldPanelId } from './fieldMappingEngine';

export type MappingDomainType = 'TUNNEL' | 'BENCH' | 'TRENCH' | 'SLOPE' | 'ROCK_SURFACE';
export type SurfaceMappingSubType = 'BENCH' | 'TRENCH' | 'SLOPE' | 'ROCK_SURFACE';

export interface SurfaceGeometryParameters {
  subType: SurfaceMappingSubType;
  // Common Surface Parameters
  faceStrikeDeg: number;
  faceDipDirectionDeg: number;
  faceDipAngleDeg: number;
  exposureLengthMeters: number;
  frictionAngleDeg: number;
  excavationMethod: 'NATURAL_SLOPE' | 'PRESPLITTING' | 'SMOOTH_BLASTING' | 'NORMAL_BLASTING' | 'MECHANICAL';

  // Bench Mapping Specific
  benchHeightMeters: number;
  bermWidthMeters: number;
  crestElevationRl: number;
  toeElevationRl: number;
  benchNumberLabel: string;

  // Trench Mapping Specific
  trenchDepthMeters: number;
  trenchWidthMeters: number;
  overburdenThicknessMeters: number;
  groundwaterDepthMeters: number;
  trenchIdLabel?: string;
  trenchShoringType?: string;
  trenchShoringRequired?: boolean;
  trenchSafeStandupHours?: number;
  trenchInvertCondition?: string;
  trenchWaterInflowRate?: string;
  trenchLengthM?: number;
  trenchWidthM?: number;
  trenchDepthM?: number;

  // Slope Mapping Specific
  slopeHeightMeters: number;
  overallSlopeAngleDeg: number;
  numberOfBenches: number;
  slopeCondition: 'DRY' | 'DAMP' | 'WET' | 'SEEPAGE';
  slopeIdLabel?: string;
  slopeAngleDeg?: number;
  slopeFaceAngleDeg?: number;
  slopeDipDirDeg?: number;
  slopeHeightM?: number;

  // Rock Surface Mapping Specific
  rockSurfaceLayout?: 'SINGLE_PANEL' | 'MULTI_PANEL';
  rockSurfaceLayoutMode?: 'SINGLE_PANEL' | 'MULTI_PANEL';
  rockSurfaceSinglePanelOnly?: boolean;
  rockSurfaceIdLabel?: string;
  rockExposureWidthMeters?: number;
  rockExposureHeightMeters?: number;
  exposureLengthM?: number;
  exposureHeightM?: number;
  outcropDipDeg?: number;
  outcropDipDirDeg?: number;
}

export interface SurfacePanelLabelMap {
  domainTitle: string;
  domainSubtitle: string;
  stationPrefix: string;
  directionLabel: string;
  roundLengthLabel: string;
  face: {
    shortLabel: string;
    fullLabel: string;
    badge: string;
    description: string;
    subtitle?: string;
  };
  crown: {
    shortLabel: string;
    fullLabel: string;
    badge: string;
    description: string;
    subtitle?: string;
  };
  leftWall: {
    shortLabel: string;
    fullLabel: string;
    badge: string;
    description: string;
    subtitle?: string;
  };
  rightWall: {
    shortLabel: string;
    fullLabel: string;
    badge: string;
    description: string;
    subtitle?: string;
  };
  shaftSn?: {
    shortLabel: string;
    fullLabel: string;
    badge: string;
    description: string;
    subtitle?: string;
  };
}

export interface KinematicSetCheckResult {
  setId: string;
  dip: number;
  dipDirection: number;
  planarRisk: 'CRITICAL' | 'MODERATE' | 'LOW';
  topplingRisk: 'CRITICAL' | 'MODERATE' | 'LOW';
  f1: number;
  f2: number;
  f3: number;
  f4: number;
  smrScore: number;
  smrClass: 'I' | 'II' | 'III' | 'IV' | 'V';
  smrStability: string;
  governingMode: 'PLANAR' | 'TOPPLING' | 'FAVORABLE';
}

export interface WedgeIntersectionCheckResult {
  pairLabel: string;
  plungeDeg: number;
  trendDeg: number;
  wedgeRisk: 'CRITICAL' | 'MODERATE' | 'LOW';
}

export interface SurfaceStabilityAnalysisResult {
  subType: SurfaceMappingSubType;
  rmrBasic: number;
  governingSmrScore: number;
  governingSmrClass: 'I' | 'II' | 'III' | 'IV' | 'V';
  stabilityLabel?: string;
  stabilityDescription: string;
  failureProbabilityPct: number;
  recommendedSupportText: string;
  bermCatchCapacityStatus: string;
  setChecks: KinematicSetCheckResult[];
  wedgeChecks: WedgeIntersectionCheckResult[];
}

const SURFACE_PARAMS_STORAGE_KEY = 'eswa_surface_mapping_params_v1';
const SURFACE_RESUME_STORAGE_KEY = 'eswa_surface_mapping_resume_v1';

export interface SurfaceMappingResumeState {
  subType: SurfaceMappingSubType;
  workflowMode?: 'FIELD' | 'PHOTOGRAMMETRY' | 'field_mapping' | 'photo_mapping';
  stageOrScreen?: string;
  stage?: string;
  activePanel?: string;
  stageLabel?: string;
  activeProjectId?: string;
  activeLocationId?: string;
  activeRoundId?: string;
  projectName?: string;
  locationName?: string;
  locationLabel?: string;
  stationLabel?: string;
  updatedAt: string;
}

export function createDefaultSurfaceGeometryParameters(
  subType: SurfaceMappingSubType = 'BENCH'
): SurfaceGeometryParameters {
  if (subType === 'TRENCH') {
    return {
      subType: 'TRENCH',
      faceStrikeDeg: 90,
      faceDipDirectionDeg: 180,
      faceDipAngleDeg: 85,
      exposureLengthMeters: 10.0,
      frictionAngleDeg: 32,
      excavationMethod: 'MECHANICAL',
      benchHeightMeters: 3.0,
      bermWidthMeters: 2.0,
      crestElevationRl: 210.0,
      toeElevationRl: 207.5,
      benchNumberLabel: 'Trench T-01',
      trenchDepthMeters: 2.5,
      trenchWidthMeters: 2.0,
      overburdenThicknessMeters: 0.65,
      groundwaterDepthMeters: 2.1,
      slopeHeightMeters: 2.5,
      overallSlopeAngleDeg: 85,
      numberOfBenches: 1,
      slopeCondition: 'DAMP',
      rockSurfaceLayout: 'MULTI_PANEL',
      rockExposureWidthMeters: 10.0,
      rockExposureHeightMeters: 2.5,
    };
  }
  if (subType === 'SLOPE') {
    return {
      subType: 'SLOPE',
      faceStrikeDeg: 45,
      faceDipDirectionDeg: 135,
      faceDipAngleDeg: 62,
      exposureLengthMeters: 25.0,
      frictionAngleDeg: 34,
      excavationMethod: 'PRESPLITTING',
      benchHeightMeters: 12.0,
      bermWidthMeters: 4.5,
      crestElevationRl: 348.0,
      toeElevationRl: 324.0,
      benchNumberLabel: 'Cut Slope CS-01',
      trenchDepthMeters: 3.0,
      trenchWidthMeters: 4.0,
      overburdenThicknessMeters: 1.2,
      groundwaterDepthMeters: 8.5,
      slopeHeightMeters: 24.0,
      overallSlopeAngleDeg: 55,
      numberOfBenches: 2,
      slopeCondition: 'DRY',
      rockSurfaceLayout: 'MULTI_PANEL',
      rockExposureWidthMeters: 25.0,
      rockExposureHeightMeters: 24.0,
    };
  }
  if (subType === 'ROCK_SURFACE') {
    return {
      subType: 'ROCK_SURFACE',
      faceStrikeDeg: 60,
      faceDipDirectionDeg: 150,
      faceDipAngleDeg: 78,
      exposureLengthMeters: 12.0,
      frictionAngleDeg: 35,
      excavationMethod: 'NATURAL_SLOPE',
      benchHeightMeters: 8.0,
      bermWidthMeters: 3.0,
      crestElevationRl: 258.0,
      toeElevationRl: 250.0,
      benchNumberLabel: 'Rock Surface RS-01',
      trenchDepthMeters: 2.5,
      trenchWidthMeters: 2.0,
      overburdenThicknessMeters: 0.3,
      groundwaterDepthMeters: 5.0,
      slopeHeightMeters: 8.0,
      overallSlopeAngleDeg: 78,
      numberOfBenches: 1,
      slopeCondition: 'DRY',
      rockSurfaceLayout: 'SINGLE_PANEL',
      rockExposureWidthMeters: 12.0,
      rockExposureHeightMeters: 8.0,
    };
  }
  return {
    subType: 'BENCH',
    faceStrikeDeg: 30,
    faceDipDirectionDeg: 120,
    faceDipAngleDeg: 75,
    exposureLengthMeters: 15.0,
    frictionAngleDeg: 35,
    excavationMethod: 'SMOOTH_BLASTING',
    benchHeightMeters: 10.0,
    bermWidthMeters: 5.5,
    crestElevationRl: 280.0,
    toeElevationRl: 270.0,
    benchNumberLabel: 'Bench RL 270–280m',
    trenchDepthMeters: 2.5,
    trenchWidthMeters: 2.0,
    overburdenThicknessMeters: 0.5,
    groundwaterDepthMeters: 6.0,
    slopeHeightMeters: 10.0,
    overallSlopeAngleDeg: 75,
    numberOfBenches: 1,
    slopeCondition: 'DRY',
    rockSurfaceLayout: 'MULTI_PANEL',
    rockExposureWidthMeters: 15.0,
    rockExposureHeightMeters: 10.0,
  };
}

export function getSurfaceParamsStorageKey(subType: SurfaceMappingSubType = 'BENCH'): string {
  return `eswa_surface_params_${subType.toLowerCase()}_v2`;
}

export function getSurfaceResumeStorageKey(subType: SurfaceMappingSubType = 'BENCH'): string {
  return `eswa_surface_resume_${subType.toLowerCase()}_v2`;
}

export function loadSavedSurfaceGeometryParameters(
  subType: SurfaceMappingSubType = 'BENCH'
): SurfaceGeometryParameters {
  const targetKey = getSurfaceParamsStorageKey(subType);
  try {
    const raw = localStorage.getItem(targetKey);
    if (raw) {
      const parsed = JSON.parse(raw) as SurfaceGeometryParameters;
      if (parsed && typeof parsed === 'object') {
        return {
          ...createDefaultSurfaceGeometryParameters(subType),
          ...parsed,
          subType,
        };
      }
    }
    // Backward-compatibility migration: check legacy single key
    const legacyRaw = localStorage.getItem(SURFACE_PARAMS_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw) as SurfaceGeometryParameters;
      if (legacyParsed && legacyParsed.subType === subType) {
        const migrated: SurfaceGeometryParameters = {
          ...createDefaultSurfaceGeometryParameters(subType),
          ...legacyParsed,
          subType,
        };
        try {
          localStorage.setItem(targetKey, JSON.stringify(migrated));
        } catch {
          // Ignore
        }
        return migrated;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return createDefaultSurfaceGeometryParameters(subType);
}

export function saveSurfaceGeometryParameters(params: SurfaceGeometryParameters): void {
  const targetKey = getSurfaceParamsStorageKey(params.subType || 'BENCH');
  try {
    localStorage.setItem(targetKey, JSON.stringify(params));
  } catch {
    // Ignore storage write errors
  }
}

export function saveSurfaceMappingResumeState(state: SurfaceMappingResumeState): void {
  const targetKey = getSurfaceResumeStorageKey(state.subType || 'BENCH');
  try {
    localStorage.setItem(targetKey, JSON.stringify(state));
    // Also store to legacy pointer so global status indicator can read most recent
    localStorage.setItem(SURFACE_RESUME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

export function loadSurfaceMappingResumeState(subType?: SurfaceMappingSubType): SurfaceMappingResumeState | null {
  try {
    if (subType) {
      const key = getSurfaceResumeStorageKey(subType);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as SurfaceMappingResumeState;
        if (parsed && parsed.subType === subType) return parsed;
      }
    }
    const rawGlobal = localStorage.getItem(SURFACE_RESUME_STORAGE_KEY);
    if (!rawGlobal) return null;
    const parsedGlobal = JSON.parse(rawGlobal) as SurfaceMappingResumeState;
    if (!parsedGlobal || !parsedGlobal.subType) return null;
    if (subType && parsedGlobal.subType !== subType) return null;
    return parsedGlobal;
  } catch {
    return null;
  }
}

export function getSurfacePanelLabelMap(
  domain: MappingDomainType,
  isVerticalShaft = false
): SurfacePanelLabelMap {
  if (domain === 'TUNNEL' && isVerticalShaft) {
    return {
      domainTitle: 'Vertical Shaft Face & Quadrant Mapping',
      domainSubtitle: 'Circular Shaft Bottom Face + 4 Quadrant Wall Panels (NORTH-EAST, EAST-SOUTH, SOUTH-WEST, WEST-NORTH)',
      stationPrefix: 'Shaft Depth EL / RD',
      directionLabel: 'Shaft Reference Azimuth (°)',
      roundLengthLabel: 'Sinking Lift / Pull Depth (m)',
      face: {
        shortLabel: 'Face',
        fullLabel: '1. SHAFT FACE (Bottom Heading)',
        badge: 'FACE',
        description: 'Circular shaft sinking bottom face cross-section',
        subtitle: 'Circular shaft sinking bottom face cross-section',
      },
      leftWall: {
        shortLabel: 'NE (0°–90°)',
        fullLabel: '2. NORTH-EAST (0°–90°)',
        badge: 'NE 0°–90°',
        description: 'North-East circular shaft quadrant wall strip (0°–90°, πD/4)',
        subtitle: 'North-East circular shaft quadrant wall strip (0°–90°, πD/4)',
      },
      crown: {
        shortLabel: 'ES (90°–180°)',
        fullLabel: '3. EAST-SOUTH (90°–180°)',
        badge: 'ES 90°–180°',
        description: 'East-South circular shaft quadrant wall strip (90°–180°, πD/4)',
        subtitle: 'East-South circular shaft quadrant wall strip (90°–180°, πD/4)',
      },
      rightWall: {
        shortLabel: 'SW (180°–270°)',
        fullLabel: '4. SOUTH-WEST (180°–270°)',
        badge: 'SW 180°–270°',
        description: 'South-West circular shaft quadrant wall strip (180°–270°, πD/4)',
        subtitle: 'South-West circular shaft quadrant wall strip (180°–270°, πD/4)',
      },
      shaftSn: {
        shortLabel: 'WN (270°–360°)',
        fullLabel: '5. WEST-NORTH (270°–360°)',
        badge: 'WN 270°–360°',
        description: 'West-North circular shaft quadrant wall strip (270°–360°, πD/4)',
        subtitle: 'West-North circular shaft quadrant wall strip (270°–360°, πD/4)',
      },
    };
  }
  if (domain === 'BENCH') {
    return {
      domainTitle: 'Bench Mapping',
      domainSubtitle: 'Quarry / Open-Pit Bench Crest, Face, Berm & Toe Mapping',
      stationPrefix: 'Bench Station',
      directionLabel: 'Bench Face Dip Direction (°)',
      roundLengthLabel: 'Bench Exposure Length (m)',
      face: {
        shortLabel: 'Bench Face',
        fullLabel: '1. BENCH FACE (Batter)',
        badge: 'BENCH FACE',
        description: 'Main excavated bench batter face between crest and toe',
        subtitle: 'Main excavated bench batter face between crest and toe',
      },
      crown: {
        shortLabel: 'Upper Berm / Crest',
        fullLabel: '2. UPPER BERM / CREST',
        badge: 'UPPER BERM',
        description: 'Horizontal catch berm and crest trace above bench face',
        subtitle: 'Horizontal catch berm and crest trace above bench face',
      },
      leftWall: {
        shortLabel: 'Toe / Floor Cut',
        fullLabel: '3. BENCH TOE & FLOOR CUT',
        badge: 'TOE FLOOR',
        description: 'Bench toe line and sub-grade working floor cut',
        subtitle: 'Bench toe line and sub-grade working floor cut',
      },
      rightWall: {
        shortLabel: 'Side Flank Cut',
        fullLabel: '4. BENCH SIDE FLANK CUT',
        badge: 'SIDE FLANK',
        description: 'Lateral bench exposure / abutment boundary flank cut',
        subtitle: 'Lateral bench exposure / abutment boundary flank cut',
      },
    };
  }

  if (domain === 'TRENCH') {
    return {
      domainTitle: 'Trench Mapping',
      domainSubtitle: 'Foundation / Fault / Exploration Trench Left Wall, Floor, Right Wall & End Cross-Section',
      stationPrefix: 'Trench Station',
      directionLabel: 'Trench Axis Bearing (°)',
      roundLengthLabel: 'Trench Segment Length (m)',
      face: {
        shortLabel: 'End Cross-Section',
        fullLabel: '1. TRENCH END FACE (Cross-Section)',
        badge: 'END FACE',
        description: 'Vertical cross-section face at end of trench advance',
        subtitle: 'Vertical cross-section face at end of trench advance',
      },
      crown: {
        shortLabel: 'Trench Floor',
        fullLabel: '2. TRENCH FLOOR (Center Invert)',
        badge: 'TRENCH FLOOR',
        description: 'Horizontal trench floor connecting Left & Right Trench Walls',
        subtitle: 'Horizontal trench floor connecting Left & Right Trench Walls',
      },
      leftWall: {
        shortLabel: 'Left Trench Wall',
        fullLabel: '3. LEFT TRENCH WALL',
        badge: 'LEFT TRENCH WALL',
        description: 'Vertical left sidewall trench exposure',
        subtitle: 'Vertical left sidewall trench exposure',
      },
      rightWall: {
        shortLabel: 'Right Trench Wall',
        fullLabel: '4. RIGHT TRENCH WALL',
        badge: 'RIGHT TRENCH WALL',
        description: 'Vertical right sidewall trench exposure',
        subtitle: 'Vertical right sidewall trench exposure',
      },
    };
  }

  if (domain === 'SLOPE') {
    return {
      domainTitle: 'Slope Mapping',
      domainSubtitle: 'Rock Slope Face, Crest, Flanks, Romana SMR & Kinematic Stability',
      stationPrefix: 'Slope Sector',
      directionLabel: 'Slope Dip Direction / Aspect (°)',
      roundLengthLabel: 'Slope Sector Width (m)',
      face: {
        shortLabel: 'Main Slope Face',
        fullLabel: '1. MAIN SLOPE FACE',
        badge: 'SLOPE FACE',
        description: 'Primary cut or natural rock slope exposure',
        subtitle: 'Primary cut or natural rock slope exposure',
      },
      crown: {
        shortLabel: 'Upper Crest Zone',
        fullLabel: '2. UPPER CREST & TENSION ZONE',
        badge: 'SLOPE CREST',
        description: 'Upper crest, tension crack zone, and overburden',
        subtitle: 'Upper crest, tension crack zone, and overburden',
      },
      leftWall: {
        shortLabel: 'Slope Toe & Ditch',
        fullLabel: '3. SLOPE TOE & CATCH DITCH',
        badge: 'TOE DITCH',
        description: 'Slope toe break-line and rockfall catchment ditch',
        subtitle: 'Slope toe break-line and rockfall catchment ditch',
      },
      rightWall: {
        shortLabel: 'Lateral Flank Cut',
        fullLabel: '4. LATERAL FLANK / ABUTMENT',
        badge: 'SLOPE FLANK',
        description: 'Lateral cut, gully or side abutment boundary exposure',
        subtitle: 'Lateral cut, gully or side abutment boundary exposure',
      },
    };
  }

  if (domain === 'ROCK_SURFACE') {
    return {
      domainTitle: 'Rock Surface Mapping',
      domainSubtitle: 'Exposed Outcrop, Foundation Bedrock, Joint Trace & Scanline Mapping',
      stationPrefix: 'Exposure Station',
      directionLabel: 'Rock Surface Dip Direction (°)',
      roundLengthLabel: 'Exposure Width / Span (m)',
      face: {
        shortLabel: 'Rock Exposure Face',
        fullLabel: '1. ROCK EXPOSURE FACE (Scanline)',
        badge: 'ROCK SURFACE',
        description: 'Primary exposed rock outcrop or foundation bedrock face',
        subtitle: 'Primary exposed rock outcrop or foundation bedrock face',
      },
      crown: {
        shortLabel: 'Upper Crest Trace',
        fullLabel: '2. UPPER CREST / CONTACT TRACE',
        badge: 'UPPER CREST',
        description: 'Upper contact trace and horizontal ledge surface',
        subtitle: 'Upper contact trace and horizontal ledge surface',
      },
      leftWall: {
        shortLabel: 'Left Exposure Flank',
        fullLabel: '3. LEFT EXPOSURE FLANK',
        badge: 'LEFT FLANK',
        description: 'Left lateral rock outcrop exposure',
        subtitle: 'Left lateral rock outcrop exposure',
      },
      rightWall: {
        shortLabel: 'Right Exposure Flank',
        fullLabel: '4. RIGHT EXPOSURE FLANK',
        badge: 'RIGHT FLANK',
        description: 'Right lateral rock outcrop exposure',
        subtitle: 'Right lateral rock outcrop exposure',
      },
    };
  }

  return {
    domainTitle: 'Underground Tunnel Face Mapping',
    domainSubtitle: 'Tunnel Face, Crown Arch, Left Wall & Right Wall',
    stationPrefix: 'Chainage RD',
    directionLabel: 'Tunnel Drive Direction (°)',
    roundLengthLabel: 'Pull / Round Length (m)',
    face: {
      shortLabel: 'Tunnel Face',
      fullLabel: '1. TUNNEL FACE',
      badge: 'FACE',
      description: 'Excavation heading face cross-section',
      subtitle: 'Excavation heading face cross-section',
    },
    crown: {
      shortLabel: 'Crown / Roof',
      fullLabel: '2. CROWN / ROOF ARCH',
      badge: 'CROWN',
      description: 'Developed tunnel roof arch strip',
      subtitle: 'Developed tunnel roof arch strip',
    },
    leftWall: {
      shortLabel: 'LEFT WALL',
      fullLabel: '3. LEFT WALL',
      badge: 'LEFT WALL',
      description: 'Developed left tunnel wall strip',
      subtitle: 'Developed left tunnel wall strip',
    },
    rightWall: {
      shortLabel: 'RIGHT WALL',
      fullLabel: '4. RIGHT WALL',
      badge: 'RIGHT WALL',
      description: 'Developed right tunnel wall strip',
      subtitle: 'Developed right tunnel wall strip',
    },
  };
}

export interface DomainExcavationOption {
  value: SurfaceGeometryParameters['excavationMethod'];
  label: string;
  f4Bonus: number;
}

export function getDomainExcavationMethodOptions(domain: MappingDomainType): DomainExcavationOption[] {
  if (domain === 'BENCH') {
    return [
      { value: 'SMOOTH_BLASTING', label: 'Smooth Blasting / Perimeter Trim (F4 = +8)', f4Bonus: 8 },
      { value: 'PRESPLITTING', label: 'Presplitting Line (F4 = +10)', f4Bonus: 10 },
      { value: 'NORMAL_BLASTING', label: 'Production Bench Blasting (F4 = -8)', f4Bonus: -8 },
      { value: 'MECHANICAL', label: 'Mechanical Ripping / Hydraulic Breaker (F4 = 0)', f4Bonus: 0 },
      { value: 'NATURAL_SLOPE', label: 'Natural Quarry / Bench Face (F4 = +15)', f4Bonus: 15 },
    ];
  }
  if (domain === 'TRENCH') {
    return [
      { value: 'MECHANICAL', label: 'Hydraulic Excavator / Trench Box (F4 = 0)', f4Bonus: 0 },
      { value: 'NATURAL_SLOPE', label: 'Hand-Cleaned Geotech Trench (F4 = +15)', f4Bonus: 15 },
      { value: 'SMOOTH_BLASTING', label: 'Controlled Rock Saw / Trim (F4 = +8)', f4Bonus: 8 },
      { value: 'PRESPLITTING', label: 'Presplit Trench Trenching (F4 = +10)', f4Bonus: 10 },
      { value: 'NORMAL_BLASTING', label: 'Bulk Trench Blasting (F4 = -8)', f4Bonus: -8 },
    ];
  }
  if (domain === 'SLOPE') {
    return [
      { value: 'PRESPLITTING', label: 'Presplitting Cut Slope (F4 = +10)', f4Bonus: 10 },
      { value: 'SMOOTH_BLASTING', label: 'Smooth Wall Blasting & Trim (F4 = +8)', f4Bonus: 8 },
      { value: 'MECHANICAL', label: 'Mechanical Scaled Rock Cut (F4 = 0)', f4Bonus: 0 },
      { value: 'NATURAL_SLOPE', label: 'Natural Unexcavated Slope (F4 = +15)', f4Bonus: 15 },
      { value: 'NORMAL_BLASTING', label: 'Standard Production Slope Blasting (F4 = -8)', f4Bonus: -8 },
    ];
  }
  if (domain === 'ROCK_SURFACE') {
    return [
      { value: 'NATURAL_SLOPE', label: 'Natural Weathered Outcrop (F4 = +15)', f4Bonus: 15 },
      { value: 'MECHANICAL', label: 'Cleaned / Scraped Bedrock Surface (F4 = 0)', f4Bonus: 0 },
      { value: 'PRESPLITTING', label: 'Pre-split Rock Surface (F4 = +10)', f4Bonus: 10 },
      { value: 'SMOOTH_BLASTING', label: 'Smooth Surface Cut (F4 = +8)', f4Bonus: 8 },
      { value: 'NORMAL_BLASTING', label: 'Blasted Bedrock Foundation (F4 = -8)', f4Bonus: -8 },
    ];
  }
  return [
    { value: 'NORMAL_BLASTING', label: 'Drill & Blast (Full Face)', f4Bonus: -8 },
    { value: 'SMOOTH_BLASTING', label: 'Controlled Drill & Blast', f4Bonus: 8 },
    { value: 'MECHANICAL', label: 'Roadheader / Mechanical', f4Bonus: 0 },
    { value: 'PRESPLITTING', label: 'Pre-split / TBM Heading', f4Bonus: 10 },
    { value: 'NATURAL_SLOPE', label: 'NATM / Hydraulic Breaker', f4Bonus: 15 },
  ];
}

export function getSurfacePanelBadgeForFieldPanel(
  domain: MappingDomainType,
  panel: FieldPanelId | SurfaceType
): { shortLabel: string; fullLabel: string; badge: string } {
  const map = getSurfacePanelLabelMap(domain);
  const key: SurfaceType =
    panel === 'left_wall'
      ? 'leftWall'
      : panel === 'right_wall'
      ? 'rightWall'
      : (panel as SurfaceType);
  return map[key] || map.face;
}

/**
 * Converts Surface Geometry Parameters (Bench, Trench, Slope, or Rock Surface) into a compatible
 * TunnelGeometry object so all 2D/3D canvases, photo rectifiers, and CAD/PDF exports work seamlessly.
 */
export function buildCompatibleGeometryFromSurfaceParams(
  params: SurfaceGeometryParameters
): TunnelGeometry {
  if (params.subType === 'TRENCH') {
    const w = Math.max(0.8, Number(params.trenchWidthMeters) || 2.0);
    const d = Math.max(0.8, Number(params.trenchDepthMeters) || 2.5);
    const geom = createTunnelGeometry(w, d, d, 'flat_roof');
    return {
      ...geom,
      leftWallHeight: d,
      rightWallHeight: d,
      profileType: 'rectangular',
      source: 'manual',
      hasCrown: true,
      hasLeftWall: true,
      hasRightWall: true,
    };
  }

  if (params.subType === 'SLOPE') {
    const w = Math.max(4.0, Number(params.exposureLengthMeters) || 20.0);
    const h = Math.max(2.0, Number(params.slopeHeightMeters) || 18.0);
    const geom = createTunnelGeometry(w, h, h, 'flat_roof');
    return {
      ...geom,
      leftWallHeight: h,
      rightWallHeight: h,
      profileType: 'rectangular',
      source: 'manual',
      hasCrown: true,
      hasLeftWall: true,
      hasRightWall: true,
    };
  }

  if (params.subType === 'ROCK_SURFACE') {
    const w = Math.max(2.0, Number(params.rockExposureWidthMeters || params.exposureLengthMeters) || 12.0);
    const h = Math.max(1.5, Number(params.rockExposureHeightMeters || params.benchHeightMeters) || 8.0);
    const isSingle = params.rockSurfaceLayout === 'SINGLE_PANEL';
    const geom = createTunnelGeometry(w, h, h, 'flat_roof');
    return {
      ...geom,
      leftWallHeight: h,
      rightWallHeight: h,
      profileType: 'rectangular',
      source: 'manual',
      hasCrown: !isSingle,
      hasLeftWall: !isSingle,
      hasRightWall: !isSingle,
    };
  }

  // BENCH MAPPING
  const w = Math.max(3.0, Number(params.exposureLengthMeters) || 15.0);
  const h = Math.max(1.5, Number(params.benchHeightMeters) || 10.0);
  const wallH = Number((h * 0.9).toFixed(2));
  const geom = createTunnelGeometry(w, h, wallH, 'flat_roof');
  return {
    ...geom,
    leftWallHeight: wallH,
    rightWallHeight: Number((params.bermWidthMeters || 5.0).toFixed(2)),
    profileType: 'rectangular',
    source: 'manual',
    hasCrown: true,
    hasLeftWall: true,
    hasRightWall: true,
  };
}

function angularDifferenceDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

/**
 * Computes Romana (1985) Slope Mass Rating (SMR) & Kinematic Daylighting Check
 * for Bench, Trench Wall, and Rock Slope mapping.
 * SMR = RMR_basic + (F1 * F2 * F3) + F4
 */
export function evaluateSurfaceStabilityAndRomanaSmr(
  params: SurfaceGeometryParameters,
  rmrOrJointSets:
    | number
    | Array<{
        id: string;
        meanDip?: number | null;
        meanDipDirection?: number | null;
        avgDip?: number | null;
        avgDipDirection?: number | null;
      }>,
  jointSetsOrRmr?:
    | Array<{
        id: string;
        meanDip?: number | null;
        meanDipDirection?: number | null;
        avgDip?: number | null;
        avgDipDirection?: number | null;
      }>
    | number
): SurfaceStabilityAnalysisResult {
  const rmrBasicInput =
    typeof rmrOrJointSets === 'number'
      ? rmrOrJointSets
      : typeof jointSetsOrRmr === 'number'
      ? jointSetsOrRmr
      : 62;
  const rawJointSets = Array.isArray(rmrOrJointSets)
    ? rmrOrJointSets
    : Array.isArray(jointSetsOrRmr)
    ? jointSetsOrRmr
    : [];
  const jointSets: Array<{ id: string; meanDip: number; meanDipDirection: number }> =
    rawJointSets.length > 0
      ? rawJointSets.map((s) => ({
          id: s.id,
          meanDip: Number(s.meanDip ?? s.avgDip ?? 58),
          meanDipDirection: Number(
            s.meanDipDirection ?? s.avgDipDirection ?? params.faceDipDirectionDeg ?? 120
          ),
        }))
      : [
          {
            id: 'J1',
            meanDip: 58,
            meanDipDirection: params.faceDipDirectionDeg || 120,
          },
          {
            id: 'J2',
            meanDip: 66,
            meanDipDirection: ((params.faceDipDirectionDeg || 120) + 75) % 360,
          },
        ];

  const rmrBasic = Math.max(10, Math.min(100, Number(rmrBasicInput) || 62));
  const alphaS = ((params.faceDipDirectionDeg % 360) + 360) % 360;
  const betaS =
    params.subType === 'SLOPE'
      ? Math.max(15, Math.min(90, params.overallSlopeAngleDeg || params.faceDipAngleDeg))
      : Math.max(15, Math.min(90, params.faceDipAngleDeg));
  const phi = Math.max(15, Math.min(55, params.frictionAngleDeg || 33));

  const f4Map: Record<SurfaceGeometryParameters['excavationMethod'], number> = {
    NATURAL_SLOPE: 15,
    PRESPLITTING: 10,
    SMOOTH_BLASTING: 8,
    MECHANICAL: 0,
    NORMAL_BLASTING: -8,
  };
  const f4 = f4Map[params.excavationMethod] ?? 0;

  const setChecks: KinematicSetCheckResult[] = jointSets.map((js) => {
    const alphaJ = (((Number(js.meanDipDirection) || 0) % 360) + 360) % 360;
    const betaJ = Math.max(0, Math.min(90, Number(js.meanDip) || 0));

    const diffPlanar = angularDifferenceDeg(alphaJ, alphaS);
    const diffToppling = angularDifferenceDeg(alphaJ, (alphaS + 180) % 360);

    // Planar kinematic check: |alphaJ - alphaS| <= 20 deg, phi < betaJ <= betaS
    let planarRisk: 'CRITICAL' | 'MODERATE' | 'LOW' = 'LOW';
    if (diffPlanar <= 20 && betaJ > phi && betaJ <= betaS + 2) {
      planarRisk = 'CRITICAL';
    } else if (diffPlanar <= 35 && betaJ > phi - 5 && betaJ <= betaS + 8) {
      planarRisk = 'MODERATE';
    }

    // Toppling kinematic check: |alphaJ - (alphaS + 180)| <= 30 deg, (90 - betaJ) + phi < betaS
    let topplingRisk: 'CRITICAL' | 'MODERATE' | 'LOW' = 'LOW';
    if (diffToppling <= 25 && 90 - betaJ + phi <= betaS) {
      topplingRisk = 'CRITICAL';
    } else if (diffToppling <= 35 && 90 - betaJ + phi - 8 <= betaS) {
      topplingRisk = 'MODERATE';
    }

    const isTopplingGov =
      topplingRisk === 'CRITICAL' ||
      (topplingRisk === 'MODERATE' && planarRisk === 'LOW') ||
      diffToppling < diffPlanar;

    const A = isTopplingGov ? diffToppling : diffPlanar;
    // Romana F1 = (1 - sin(A))^2, bounded [0.15, 1.0]
    const f1Raw = Math.pow(1 - Math.sin((Math.min(90, A) * Math.PI) / 180), 2);
    const f1 = Number(Math.max(0.15, Math.min(1.0, f1Raw)).toFixed(2));

    // Romana F2 = tan^2(betaJ) for planar, or 1.0 for toppling
    const f2Raw = isTopplingGov ? 1.0 : Math.pow(Math.tan((betaJ * Math.PI) / 180), 2);
    const f2 = Number(Math.max(0.15, Math.min(1.0, f2Raw)).toFixed(2));

    // Romana F3: relationship between betaJ and betaS
    let f3 = -6;
    if (!isTopplingGov) {
      const diffDip = betaJ - betaS;
      if (diffDip > 10) f3 = 0;
      else if (diffDip > 0) f3 = -6;
      else if (diffDip === 0) f3 = -25;
      else if (diffDip >= -10) f3 = -50;
      else f3 = -60;
    } else {
      const sumDip = betaJ + betaS;
      if (sumDip < 110) f3 = 0;
      else if (sumDip <= 120) f3 = -6;
      else f3 = -25;
    }

    const adjustment = f1 * f2 * f3 + f4;
    const smrScore = Math.round(Math.max(5, Math.min(100, rmrBasic + adjustment)));
    const smrClass: 'I' | 'II' | 'III' | 'IV' | 'V' =
      smrScore >= 81
        ? 'I'
        : smrScore >= 61
        ? 'II'
        : smrScore >= 41
        ? 'III'
        : smrScore >= 21
        ? 'IV'
        : 'V';

    const smrStability =
      smrClass === 'I'
        ? 'Completely Stable'
        : smrClass === 'II'
        ? 'Stable (Minor Block Fall)'
        : smrClass === 'III'
        ? 'Partially Stable (Systematic Support)'
        : smrClass === 'IV'
        ? 'Unstable (Planar / Big Wedge Risk)'
        : 'Completely Unstable (Re-excavation Required)';

    const governingMode: 'PLANAR' | 'TOPPLING' | 'FAVORABLE' =
      planarRisk !== 'LOW'
        ? 'PLANAR'
        : topplingRisk !== 'LOW'
        ? 'TOPPLING'
        : 'FAVORABLE';

    return {
      setId: js.id,
      dip: Math.round(betaJ),
      dipDirection: Math.round(alphaJ),
      planarRisk,
      topplingRisk,
      f1,
      f2,
      f3,
      f4,
      smrScore,
      smrClass,
      smrStability,
      governingMode,
    };
  });

  // Pairwise Wedge Intersection Check
  const wedgeChecks: WedgeIntersectionCheckResult[] = [];
  for (let i = 0; i < jointSets.length; i++) {
    for (let j = i + 1; j < jointSets.length; j++) {
      const s1 = jointSets[i];
      const s2 = jointSets[j];
      const d1 = (s1.meanDip * Math.PI) / 180;
      const dd1 = (s1.meanDipDirection * Math.PI) / 180;
      const d2 = (s2.meanDip * Math.PI) / 180;
      const dd2 = (s2.meanDipDirection * Math.PI) / 180;

      // Pole normals (nx, ny, nz)
      const n1x = Math.sin(d1) * Math.sin(dd1);
      const n1y = Math.sin(d1) * Math.cos(dd1);
      const n1z = Math.cos(d1);

      const n2x = Math.sin(d2) * Math.sin(dd2);
      const n2y = Math.sin(d2) * Math.cos(dd2);
      const n2z = Math.cos(d2);

      // Line of intersection = n1 x n2
      let ix = n1y * n2z - n1z * n2y;
      let iy = n1z * n2x - n1x * n2z;
      let iz = n1x * n2y - n1y * n2x;
      const mag = Math.hypot(ix, iy, iz) || 1;
      ix /= mag;
      iy /= mag;
      iz /= mag;
      if (iz < 0) {
        ix = -ix;
        iy = -iy;
        iz = -iz;
      }

      const plungeDeg = Math.round((Math.asin(Math.min(1, Math.abs(iz))) * 180) / Math.PI);
      const trendDeg = Math.round(((Math.atan2(ix, iy) * 180) / Math.PI + 360) % 360);
      const diffTrend = angularDifferenceDeg(trendDeg, alphaS);

      let wedgeRisk: 'CRITICAL' | 'MODERATE' | 'LOW' = 'LOW';
      if (diffTrend <= 35 && plungeDeg > phi && plungeDeg <= betaS) {
        wedgeRisk = 'CRITICAL';
      } else if (diffTrend <= 50 && plungeDeg > phi - 5 && plungeDeg <= betaS + 5) {
        wedgeRisk = 'MODERATE';
      }

      wedgeChecks.push({
        pairLabel: `${s1.id} ∩ ${s2.id}`,
        plungeDeg,
        trendDeg,
        wedgeRisk,
      });
    }
  }

  const worstCheck =
    setChecks.length > 0
      ? [...setChecks].sort((a, b) => a.smrScore - b.smrScore)[0]
      : null;

  const governingSmrScore = worstCheck ? worstCheck.smrScore : Math.min(100, rmrBasic + f4);
  const governingSmrClass: 'I' | 'II' | 'III' | 'IV' | 'V' =
    governingSmrScore >= 81
      ? 'I'
      : governingSmrScore >= 61
      ? 'II'
      : governingSmrScore >= 41
      ? 'III'
      : governingSmrScore >= 21
      ? 'IV'
      : 'V';

  const stabilityDescription =
    governingSmrClass === 'I'
      ? 'Class I (SMR 81–100): Completely Stable — Scaling only; no systematic reinforcement required.'
      : governingSmrClass === 'II'
      ? 'Class II (SMR 61–80): Stable — Occasional spot bolting (L=3–4m) and toe ditch protection.'
      : governingSmrClass === 'III'
      ? 'Class III (SMR 41–60): Partially Stable — Systematic rock bolting (3m×3m), wire mesh & sub-horizontal weepholes.'
      : governingSmrClass === 'IV'
      ? 'Class IV (SMR 21–40): Unstable — Pattern rock bolts/anchors, reinforced shotcrete (100–150mm), toe drainage.'
      : 'Class V (SMR <20): Completely Unstable — Flatten slope angle, gravity retaining wall / buttress & cable anchors.';

  const failureProbabilityPct =
    governingSmrClass === 'I'
      ? 0
      : governingSmrClass === 'II'
      ? 20
      : governingSmrClass === 'III'
      ? 40
      : governingSmrClass === 'IV'
      ? 60
      : 90;

  // Ritchie Criterion check for Bench Berm Width: Recommended W_berm >= 0.2 * H_bench + 2.0m
  const reqBerm = Number((0.2 * (params.benchHeightMeters || 10) + 2.0).toFixed(1));
  const bermCatchCapacityStatus =
    params.subType === 'TRENCH'
      ? `Trench Depth ${params.trenchDepthMeters}m (${
          params.trenchDepthMeters > 1.5
            ? 'Trench shoring / battering required per safety code'
            : 'Shallow trench (<1.5m) — inspect walls'
        })`
      : (params.bermWidthMeters || 0) >= reqBerm
      ? `Adequate Berm Width (${params.bermWidthMeters}m ≥ ${reqBerm}m Ritchie minimum for ${params.benchHeightMeters}m bench)`
      : `Narrow Berm Warning (${params.bermWidthMeters}m < ${reqBerm}m Ritchie minimum for ${params.benchHeightMeters}m bench)`;

  const recommendedSupportText =
    params.subType === 'TRENCH'
      ? params.trenchDepthMeters > 1.8
        ? 'Install hydraulic trench box / timber shoring, log unrolled Left Wall + Floor + Right Wall immediately, dewater seepage.'
        : 'Scale loose trench crest soil/overburden, maintain ≥0.6m spoil setback from trench edge.'
      : stabilityDescription;

  return {
    subType: params.subType,
    rmrBasic,
    governingSmrScore,
    governingSmrClass,
    stabilityDescription,
    failureProbabilityPct,
    recommendedSupportText,
    bermCatchCapacityStatus,
    setChecks,
    wedgeChecks,
  };
}

export interface SurfaceSegmentItem {
  index: number;
  label: string;
  stationFromM: number;
  stationToM: number;
  spanM: number;
  pctFrom: number;
  pctTo: number;
}

export function computeSurfaceSegments(
  totalSpanMeters: number,
  segmentSpanMeters: number
): SurfaceSegmentItem[] {
  const total = Math.max(0.5, totalSpanMeters || 10);
  const step = Math.max(0.5, Math.min(total, segmentSpanMeters || 2.0));
  const count = Math.max(1, Math.ceil(total / step));
  const segments: SurfaceSegmentItem[] = [];

  for (let i = 0; i < count; i++) {
    const fromM = Number((i * step).toFixed(2));
    const toM = Number((Math.min(total, (i + 1) * step)).toFixed(2));
    segments.push({
      index: i,
      label: `${fromM.toFixed(1)}m → ${toM.toFixed(1)}m`,
      stationFromM: fromM,
      stationToM: toM,
      spanM: Number((toM - fromM).toFixed(2)),
      pctFrom: fromM / total,
      pctTo: toM / total,
    });
  }
  return segments;
}

export function computeSegmentCanvasViewBox(
  activeSegmentIndex: number,
  totalSegments: number,
  targetBox: { x: number; y: number; w: number; h: number },
  segmentSpanMeters: number,
  totalSpanMeters: number
): { zoom: number; panX: number; panY: number } {
  const total = Math.max(0.5, totalSpanMeters || 10);
  const step = Math.max(0.5, Math.min(total, segmentSpanMeters || 2.0));
  const segIndex = Math.max(0, Math.min(totalSegments - 1, activeSegmentIndex));

  const fromM = segIndex * step;
  const toM = Math.min(total, (segIndex + 1) * step);
  const segSpanM = Math.max(0.2, toM - fromM);

  const pxPerM = targetBox.w / total;
  const segSvgX = targetBox.x + fromM * pxPerM;
  const segSvgW = segSpanM * pxPerM;
  const segSvgCenterX = segSvgX + segSvgW / 2;
  const segSvgCenterY = targetBox.y + targetBox.h / 2;

  const targetCanvasW = 750;
  const zoom = Math.max(1.0, Math.min(12.0, Number((targetCanvasW / Math.max(10, segSvgW)).toFixed(2))));

  const panX = Number((segSvgCenterX - 500).toFixed(1));
  const panY = Number((segSvgCenterY - 500).toFixed(1));

  return { zoom, panX, panY };
}

