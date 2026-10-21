// ============================================================================
// ESWA TBM MECHANIZED TUNNELING SUITE — TYPES & SCHEMAS
// Strict chainage-based, site-grade data model for TBM engineering geology
// ============================================================================

export type TbmMachineType =
  | 'HARD_ROCK_OPEN_GRIPPER'
  | 'SINGLE_SHIELD'
  | 'DOUBLE_SHIELD'
  | 'EPB'
  | 'SLURRY_SHIELD'
  | 'OTHER_CUSTOM';

export type TbmGroundType =
  | 'HARD_ROCK'
  | 'SOFT_GROUND_SOIL'
  | 'MIXED_GROUND'
  | 'UNCERTAIN_VARIABLE';

export type ChainageDirection = 'INCREASING' | 'DECREASING';

export type TbmShiftType = 'DAY' | 'NIGHT' | 'SWING';

export type GeologicalHazardSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TbmProjectItem {
  id: string; // e.g. "PRJ-TBM-001"
  projectName: string;
  tunnelName: string;
  client: string;
  contractor: string;
  consultant: string;
  projectLocation: string;
  tunnelAlignment: string;
  startDate: string;
  description: string;
  responsibleGeologist: string;
  coordinateSystem: string;
  units: 'METRIC' | 'IMPERIAL';
  geologicalBaselineRef?: string;
  tunnelDiameterM?: number;
  tunnelProfile?: 'CIRCULAR' | 'HORSESHOE' | 'D_SHAPED' | 'RECTANGULAR';
  tunnelElevationCrownMrl?: number;
  tunnelElevationInvertMrl?: number;
  expectedOverburdenM?: { min: number; max: number };
  expectedSupportSystem?: string;
  monitoringThresholds?: {
    warningSettlementMm: number;
    alertSettlementMm: number;
    maxInflowLMin: number;
    maxDiscWearMm?: number;
  };
  designChainageStart?: number;
  designChainageEnd?: number;
  anticipatedFormations?: {
    name: string;
    startChainage: number;
    endChainage: number;
    lithology: string;
    expectedQRange?: string;
  }[];
  anticipatedFaultsShears?: {
    name: string;
    chainage: number;
    widthM: number;
    description: string;
  }[];
  anticipatedGroundwater?: {
    waterTableMrl?: number;
    maxInflowRiskLMin?: number;
    notes?: string;
  };
  baselineRockMass?: {
    expectedQMin: number;
    expectedQMax: number;
    expectedRmrMin: number;
    expectedRmrMax: number;
    ucsMinMpa: number;
    ucsMaxMpa: number;
  };
  expectedSupportLining?: {
    type: string;
    segmentThicknessMm: number;
    groutSpec: string;
  };
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface TbmGeologicalForecastRecord {
  id: string;
  projectId: string;
  locationId: string;
  revision?: string; // e.g. "Rev A", "Rev 01"
  forecastDate: string;
  author: string;
  startChainageRd: number;
  endChainageRd: number;
  predictedLithology: string;
  predictedFormations: string;
  expectedQValue: number;
  expectedRmr: number;
  predictedFaultsAndShears: string;
  predictedWaterInflowRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  supportingEvidence: string;
  investigationLimitations: string;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  recommendedActions: string;
  uncertaintyNotes?: string;
  additionalInvestigationRecommended?: string;
  isEncounteredVerified?: boolean;
  encounteredSummary?: string;
  matchStatus?: 'CONCORDANT' | 'PARTIAL_MATCH' | 'DISCORDANT' | 'UNVERIFIED';
  discrepancyNotes?: string;
  verificationDate?: string;
  verifiedBy?: string;
  positionalVarianceM?: number;
  qVariance?: number;
}

export interface TbmInstrumentReading {
  id: string;
  instrumentId: string;
  instrumentType: 'SURFACE_SETTLEMENT' | 'CONVERGENCE_PIN' | 'PIEZOMETER' | 'INCLINOMETER' | 'SEGMENT_JOINT';
  chainageRd: number;
  offsetFromCenterlineM: number;
  baselineValue: number;
  currentValue: number;
  unit: string;
  alertLevel: 'NORMAL' | 'WARNING' | 'ACTION_LEVEL';
  timestamp: string;
  notes?: string;
}

export interface PredictedGeologyUnit {
  id: string;
  startChainage: number;
  endChainage: number;
  lithology: string;
  groundType: TbmGroundType;
  expectedQValue?: number;
  expectedRmr?: number;
  expectedUcsMpa?: number;
  hydrogeologyNotes?: string;
  hazardsPredicted?: string[];
}

export interface TbmLocationItem {
  id: string;
  projectId: string;
  locationName: string;
  tunnelSection: string;
  excavationDirection: ChainageDirection;
  startChainageRd: number; // e.g. 1423.50
  endChainageRd?: number;   // e.g. 1500.00
  chainageReference: string; // e.g. "RD (Chainage in meters from North Portal)"
  chainageUnits: 'm' | 'km' | 'ft';
  alignmentReference: string;
  startDate: string;
  description: string;
  responsibleGeologist: string;
  // TBM & Ground configuration assigned to this location
  tbmType: TbmMachineType;
  groundType: TbmGroundType;
  machineManufacturer: string;
  machineModel: string;
  machineSerialId: string;
  cutterheadDiameterM: number;
  discCutterCount: number;
  discCutterDiameterInches: number; // e.g. 17" or 19"
  nominalOperatingThrustKn: number;
  nominalOperatingTorqueKnm: number;
  nominalMaxRpm: number;
  dataSource: 'MANUAL_ENTRY' | 'IMPORTED_LOG' | 'CONNECTED_SYSTEM';
  predictedGeology: PredictedGeologyUnit[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 11 DATA COLLECTION SECTIONS (Inside Excavation Interval Record)
// ---------------------------------------------------------------------------

export interface TbmExcavationChainageRecord {
  recordId: string;
  locationId: string;
  projectId: string;
  timestamp: string;
  startChainage: number; // RD e.g. 1423.50
  endChainage: number;   // RD e.g. 1425.00
  advanceLengthMeters: number; // calculated: |end - start|
  ringNumber: number; // e.g. 842
  shift: TbmShiftType;
  shiftStartTime: string;
  shiftEndTime: string;
  stoppageDurationMinutes: number;
  stoppageReason: string;
  geologistOrOperator: string;
  generalObservations: string;
  plannedAdvanceMeters?: number;
  surveyedChainage?: number;
  operatingMode?: string;
  reviewStatus?: 'DRAFT' | 'REVIEWED' | 'APPROVED';
  reviewedBy?: string;
  approvedBy?: string;
}

export interface TbmDiscontinuityObservation {
  id: string;
  setNumber: number;
  type: 'JOINT' | 'BEDDING' | 'FOLIATION' | 'FAULT' | 'SHEAR_ZONE' | 'VEIN';
  strikeDeg: number;
  dipDeg: number;
  dipDirectionDeg: number;
  spacingCm: number;
  persistenceMeters?: number;
  apertureMm: number;
  roughness: 'VERY_ROUGH' | 'ROUGH' | 'SLIGHTLY_ROUGH' | 'SMOOTH' | 'SLICKENSIDED';
  infilling: 'NONE' | 'HARD_NON_SOFTENING' | 'SOFT_CLAY' | 'THICK_CLAY_GOUGE' | 'CALCITE_QUARTZ';
  weathering: 'UNWEATHERED' | 'SLIGHTLY_WEATHERED' | 'MODERATELY_WEATHERED' | 'HIGHLY_WEATHERED' | 'DECOMPOSED';
  waterCondition: 'DRY' | 'DAMP' | 'WET' | 'DRIPPING' | 'FLOWING';
  isDirectObservation: boolean;
  notes?: string;
}

export interface TbmGeologicalObservation {
  mainLithology: string; // e.g. "Basalt", "Sandstone", "Silty Clay"
  secondaryLithology?: string;
  formationName?: string;
  geologicalDomain?: string;
  color: string;
  grainSize: 'FINE' | 'MEDIUM' | 'COARSE' | 'VERY_COARSE' | 'APHANITIC';
  textureFabric: string;
  weatheringGrade: 'W1_FRESH' | 'W2_SLIGHTLY' | 'W3_MODERATELY' | 'W4_HIGHLY' | 'W5_COMPLETELY';
  intactStrengthEstimatedMpa: number; // UCS
  geologicalBoundariesDescription: string;
  unitThicknessMeters: number;
  discontinuities: TbmDiscontinuityObservation[];
  degreeOfFracturing: 'MASSIVE' | 'MODERATELY_FRACTURED' | 'HIGHLY_FRACTURED' | 'CRUSHED';
  blockSizeBytes: number; // average block diameter in cm
  rockMassIntegrity: 'SOLID' | 'INTERLOCKED' | 'BLOCKY_DISTURBED' | 'DISINTEGRATED';
  instabilitiesNoted: string; // ravelling, loose blocks, overbreak, squeezing
  isSqueezingLikely: boolean;
  isSwellingLikely: boolean;
  directVsIndirectObservation?: 'DIRECT_FACE' | 'INDIRECT_MUCK_TELEMETRY' | 'PROBE_HOLE_INFERRED';
  geologistConfidence?: 'HIGH' | 'MODERATE' | 'LOW';
  evidenceSource?: string;
}

export interface TbmMuckInspectionRecord {
  sampleId: string;
  sampleChainageRd: number;
  timestamp: string;
  materialType: 'ROCK_CHIPS' | 'SOIL_FINES' | 'SAND_GRAVEL' | 'MIXED_PASTE';
  dominantLithology: string;
  muckColor: string;
  gradingDescription: 'UNIFORM_FINE' | 'WELL_GRADED_CHIPS' | 'BLOCKY_SLABS' | 'CLAYEY_SLURRY';
  finesPercentEstimated: number; // 0-100%
  coarsePercentEstimated: number; // 0-100%
  fragmentShapeAngularity: 'ANGULAR' | 'SUB_ANGULAR' | 'SUB_ROUNDED' | 'ROUNDED' | 'FLAT_ELONGATED';
  averageFragmentSizeMm: number;
  maxFragmentSizeMm: number;
  visibleFracturesInChips: boolean;
  faultGougeObserved: boolean;
  waterContentVisual: 'DRY' | 'MOIST' | 'STICKY' | 'SATURATED_SLURRY';
  samplingMethod: 'BELT_CONVEYOR' | 'HOPPER' | 'MUCK_CAR' | 'SEPARATION_PLANT';
  geologistInterpretation: string;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  photoUrls: string[];
}

export interface TbmOperatingTelemetry {
  timestamp: string;
  chainageRd: number;
  thrustForceKn: number;
  cutterheadTorqueKnm: number;
  cutterheadRpm: number;
  penetrationPerRevMm: number;
  penetrationRateMmMin: number;
  excavationDurationMin: number;
  cutterWearMm: number;
  cuttersReplacedCount: number;
  machineDowntimeHours: number;
  alarmsTriggered: string[];
  // EPB Specific Parameters
  epbChamberPressureTopBar?: number;
  epbChamberPressureCenterBar?: number;
  epbChamberPressureBottomBar?: number;
  screwConveyorSpeedRpm?: number;
  screwConveyorTorqueKnm?: number;
  foamExpansionRatio?: number;
  foamInjectionRateLMin?: number;
  polymerConcentrationPercent?: number;
  excavatedWeightTonnesActual?: number;
  excavatedWeightTonnesTheoretical?: number;
  // Slurry Shield Specific Parameters
  slurryFacePressureBar?: number;
  slurrySupplyPressureBar?: number;
  slurryReturnPressureBar?: number;
  slurryFlowRateM3H?: number;
  slurryDensitySupplyGcm3?: number;
  slurryDensityReturnGcm3?: number;
  separationPlantDensityDelta?: number;
  // Shield / Gripper Parameters
  gripperPressureBar?: number;
  shieldJackPressureBar?: number;
  articulationAngleDeg?: number;
}

export interface TbmGroundwaterRecord {
  inflowRateLitersPerMin: number;
  waterPressureBar: number;
  ingressLocation: 'FACE_CUTTERHEAD' | 'SHIELD_BODY' | 'TAIL_SKIN_BRUSHES' | 'INVERT' | 'SEGMENT_JOINTS';
  turbidity: 'CLEAR' | 'SLIGHTLY_SILTY' | 'MUDDY' | 'HEAVILY_SEDIMENTED';
  phEstimated: number;
  electricalConductivityUsCm?: number;
  dewateringPumpsActive: number;
  preGroutingActionTaken: string;
  waterInrushRiskLevel: 'SAFE_DRY' | 'MANAGEABLE_SEEPAGE' | 'MODERATE_INFLOW' | 'HIGH_INRUSH_ALERT';
}

export interface TbmProbeDrillingRecord {
  probeHoleId: string;
  drilledLengthMeters: number;
  azimuthDeg: number;
  inclinationDeg: number;
  drillingMethod?: 'PERCUSSIVE_MWD' | 'ROTARY_DIAMOND_CORE' | 'TSP_SEISMIC' | 'GROUND_RADAR';
  boreholeDiameterMm?: number;
  equipmentUsed?: string;
  drillingSpeedMMin: number;
  drillingFeedPressureBar: number;
  rotationRpm?: number;
  torqueKnm?: number;
  flushingPressureBar?: number;
  flushingWaterReturn: 'FULL_RETURN' | 'PARTIAL_LOSS' | 'TOTAL_LOSS';
  cuttingsDescription?: string;
  geologyLoggedAhead: string;
  cavityOrVoidDetected: boolean;
  voidLengthMeters?: number;
  waterOrGasEncountered: boolean;
  waterInflowLMin?: number;
  tspReflectionZoneMetersAhead?: number;
  advanceRecommendation: 'PROCEED_NORMAL' | 'PROCEED_CAUTIOUS_LOW_THRUST' | 'PRE_EXCAVATION_GROUT_REQUIRED' | 'STOP_AND_PROBE_AGAIN';
  dataConfidence?: 'HIGH' | 'MODERATE' | 'LOW';
  loggedBy?: string;
}

export interface TbmRockMassClassificationRecord {
  // Q-System (Barton)
  rqdPercent: number;
  jn: number;
  jr: number;
  ja: number;
  jw: number;
  srf: number;
  calculatedQ: number;
  qClassLabel: string;
  // RMR89 (Bieniawski)
  rmrStrengthScore: number;
  rmrRqdScore: number;
  rmrSpacingScore: number;
  rmrConditionScore: number;
  rmrWaterScore: number;
  rmrOrientationAdjustment: number;
  calculatedRmr: number;
  rmrClassLabel: string;
  // GSI (Hoek)
  gsiScore: number;
  // TBM specific indices
  qtbmIndex?: number;
  fieldPenetrationIndexKnCutterMm?: number; // FPI
  specificEnergyMJM3?: number;             // SE
  epbSoilClass?: 'COHESIVE_CLAY' | 'COHESIONLESS_SAND' | 'GRAVEL_COBBLES' | 'SILT_SAND_MIX';
  missingParameters?: string[];
  isClassificationValidated?: boolean;
}

export interface TbmSupportAndLiningRecord {
  ringNumber: number;
  liningType: 'PRECAST_SEGMENT' | 'ROCKBOLTS_AND_SHOTCRETE' | 'STEEL_RIBS' | 'CANOPY_PIPE_SHED';
  // Segmental details
  ringTypeUniversal: 'UNIVERSAL_LEFT' | 'UNIVERSAL_RIGHT' | 'STANDARD_TAPERED' | 'SPECIAL_INCLINED';
  keySegmentPositionClock: '12:00' | '1:00' | '2:00' | '3:00' | '4:00' | '5:00' | '6:00' | '7:00' | '8:00' | '9:00' | '10:00' | '11:00';
  annularGroutVolumeActualM3: number;
  annularGroutVolumeTheoreticalM3: number;
  groutRatioActualVsTheo: number;
  groutInjectionPressureBar: number;
  tailSealGreaseConsumptionKg: number;
  ringRollMm: number;
  ringPitchMm: number;
  ringLeadMm: number;
  liningDefectsObserved: string; // cracking, chipping, gasket extrusion, water leakage
  // Open TBM Support (where applicable)
  rockboltsCountRound?: number;
  rockboltLengthM?: number;
  shotcreteThicknessMm?: number;
  steelRibsSpacingM?: number;
}

export interface TbmInstrumentationRecord {
  timestamp: string;
  chainageRd: number;
  surfaceSettlementMonitoringPointId: string;
  distanceFromTunnelCenterlineM: number;
  surfaceSettlementMeasuredMm: number;
  theoreticalPeckSettlementMm: number;
  tunnelDiameterConvergenceMm: number;
  piezometerPorePressureKpa?: number;
  inclinometerLateralDeflectionMm?: number;
  settlementThresholdExceeded: boolean;
}

export interface TbmGeologicalHazardRecord {
  hazardId: string;
  chainageRd: number;
  hazardCategory:
    | 'CHIMNEY_OVERBREAK_CAVITY'
    | 'SQUEEZING_GROUND'
    | 'SWELLING_ROCK'
    | 'HIGH_PRESSURE_WATER_INRUSH'
    | 'EXPLOSIVE_TOXIC_GAS'
    | 'FACE_COLLAPSE_INSTABILITY'
    | 'CUTTERHEAD_CLOGGING_BALLING'
    | 'SHIELD_JAMMING'
    | 'HARD_ABRASIVE_BOULDER'
    | 'KARST_VOID';
  severity: GeologicalHazardSeverity;
  status: 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'CLOSED';
  impactOnTbm: string;
  actionTaken: string;
  responsiblePerson?: string;
  dateReported: string;
  isResolved: boolean;
  photoUrls: string[];
  approvalHistory?: {
    status: string;
    by: string;
    date: string;
    notes?: string;
  }[];
}

export interface TbmPhotoAttachment {
  id: string;
  chainageRd: number;
  timestamp: string;
  category: 'CUTTERHEAD_FACE' | 'MUCK_CONVEYOR' | 'PROBE_CORES' | 'SEGMENT_DEFECT' | 'GEOLOGICAL_HAZARD';
  title: string;
  dataUrl: string;
  notes: string;
}

// Full Excavation & Ring Record
export interface TbmExcavationRecord {
  id: string; // e.g. "REC-RD-1423.50-R842"
  projectId: string;
  locationId: string;
  chainageRecord: TbmExcavationChainageRecord;
  geology: TbmGeologicalObservation;
  muck: TbmMuckInspectionRecord;
  telemetry: TbmOperatingTelemetry;
  groundwater: TbmGroundwaterRecord;
  probeDrilling?: TbmProbeDrillingRecord;
  classification: TbmRockMassClassificationRecord;
  supportLining: TbmSupportAndLiningRecord;
  instrumentation?: TbmInstrumentationRecord;
  hazards: TbmGeologicalHazardRecord[];
  photos: TbmPhotoAttachment[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 16 PROFESSIONAL TBM REPORTS METADATA & FILTERS
// ---------------------------------------------------------------------------

export type TbmReportType =
  | 'SHIFT_GEOTECHNICAL_LOG'
  | 'DAILY_TBM_GEOLOGICAL_SUMMARY'
  | 'RING_BY_RING_EXCAVATION_RECORD'
  | 'MUCK_INSPECTION_LITHOLOGY_LOG'
  | 'PROBE_DRILLING_AHEAD_LOG'
  | 'LONGITUDINAL_GEOTECHNICAL_PROFILE'
  | 'TBM_PERFORMANCE_VS_GROUND_REPORT'
  | 'DISCONTINUITY_STRUCTURAL_ANALYSIS'
  | 'ROCK_MASS_CLASSIFICATION_SUPPORT'
  | 'FACE_CROWN_STABILITY_ASSESSMENT'
  | 'GROUNDWATER_INFLOW_REGISTER'
  | 'SETTLEMENT_GROUND_MOVEMENT_REPORT'
  | 'GEOLOGICAL_HAZARD_INCIDENT_REPORT'
  | 'PREDICTED_VS_ENCOUNTERED_GEOLOGY'
  | 'WEEKLY_MONTHLY_EXECUTIVE_SUMMARY'
  | 'AS_BUILT_GEOLOGICAL_DOCUMENTATION';

export interface TbmReportFilter {
  projectId: string;
  locationId?: string;
  startChainageRd?: number;
  endChainageRd?: number;
  startRingNumber?: number;
  endRingNumber?: number;
  startDate?: string;
  endDate?: string;
  reportType: TbmReportType;
}
