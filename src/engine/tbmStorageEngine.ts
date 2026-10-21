// ============================================================================
// ESWA TBM MECHANIZED TUNNELING — ISOLATED STORAGE & BACKUP ENGINE
// Strictly isolated from NATM and Mining vaults
// ============================================================================

import {
  TbmProjectItem,
  TbmLocationItem,
  TbmExcavationRecord,
  TbmMachineType,
  TbmGroundType,
  TbmGeologicalForecastRecord,
  TbmInstrumentReading,
} from '../types/tbm';
import { IndustryMode } from '../types/tunnel';

export const TBM_PROJECTS_KEY = 'eswa_tbm_projects_v2';
export const TBM_LOCATIONS_KEY = 'eswa_tbm_locations_v2';
export const TBM_RECORDS_KEY = 'eswa_tbm_excavation_records_v2';
export const TBM_FORECASTS_KEY = 'eswa_tbm_forecasts_v2';
export const TBM_INSTRUMENTS_KEY = 'eswa_tbm_instruments_v2';
export const TBM_ACTIVE_PROJECT_KEY = 'eswa_tbm_active_project_id_v2';
export const TBM_ACTIVE_LOCATION_KEY = 'eswa_tbm_active_location_id_v2';
export const TBM_ACTIVE_RECORD_KEY = 'eswa_tbm_active_record_id_v2';
export const DEFAULT_STARTUP_MODE_KEY = 'eswa_default_startup_industry_mode_v1';

// ---------------------------------------------------------------------------
// STARTUP DEFAULT MODE MANAGEMENT
// ---------------------------------------------------------------------------

export function getDefaultStartupMode(): IndustryMode {
  try {
    const saved = localStorage.getItem(DEFAULT_STARTUP_MODE_KEY);
    if (saved === 'TBM' || saved === 'NATM' || saved === 'MINING') {
      return saved as IndustryMode;
    }
  } catch {
    // ignore
  }
  return 'NATM';
}

export function setDefaultStartupMode(mode: IndustryMode): void {
  try {
    localStorage.setItem(DEFAULT_STARTUP_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// PROJECTS CRUD
// ---------------------------------------------------------------------------

export function loadTbmProjects(): TbmProjectItem[] {
  try {
    const raw = localStorage.getItem(TBM_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialTbmData();
  return seeded.projects;
}

export function saveTbmProjects(projects: TbmProjectItem[]): void {
  try {
    localStorage.setItem(TBM_PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Storage quota warning while saving TBM projects', err);
  }
}

export function createTbmProject(partial: Partial<TbmProjectItem>): TbmProjectItem {
  const all = loadTbmProjects();
  const id = partial.id?.trim() || `PRJ-TBM-${String(all.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newProj: TbmProjectItem = {
    id,
    projectName: partial.projectName?.trim() || 'New TBM Tunnel Project',
    tunnelName: partial.tunnelName?.trim() || 'Main Shield Tunnel',
    client: partial.client?.trim() || '',
    contractor: partial.contractor?.trim() || '',
    consultant: partial.consultant?.trim() || '',
    projectLocation: partial.projectLocation?.trim() || '',
    tunnelAlignment: partial.tunnelAlignment?.trim() || 'Main Up-Line Alignment',
    startDate: partial.startDate || new Date().toISOString().slice(0, 10),
    description: partial.description?.trim() || '',
    responsibleGeologist: partial.responsibleGeologist?.trim() || 'Lead TBM Geologist',
    coordinateSystem: partial.coordinateSystem?.trim() || 'UTM Zone 43N / WGS84',
    units: partial.units || 'METRIC',
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newProj, ...all];
  saveTbmProjects(updated);
  setActiveTbmProjectId(newProj.id);
  return newProj;
}

export function updateTbmProject(id: string, updates: Partial<TbmProjectItem>): TbmProjectItem | null {
  const all = loadTbmProjects();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const updatedItem: TbmProjectItem = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updatedItem;
  saveTbmProjects(all);
  return updatedItem;
}

export function deleteTbmProject(id: string): void {
  const all = loadTbmProjects().filter((p) => p.id !== id);
  saveTbmProjects(all);

  // Also remove cascade locations and records
  const locs = loadTbmLocations().filter((l) => l.projectId !== id);
  saveTbmLocations(locs);

  const recs = loadTbmExcavationRecords().filter((r) => r.projectId !== id);
  saveTbmExcavationRecords(recs);
}

// ---------------------------------------------------------------------------
// LOCATIONS CRUD
// ---------------------------------------------------------------------------

export function loadTbmLocations(projectId?: string): TbmLocationItem[] {
  try {
    const raw = localStorage.getItem(TBM_LOCATIONS_KEY);
    if (raw) {
      const parsed: TbmLocationItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return projectId ? parsed.filter((l) => l.projectId === projectId) : parsed;
      }
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialTbmData();
  return projectId ? seeded.locations.filter((l) => l.projectId === projectId) : seeded.locations;
}

export function saveTbmLocations(locations: TbmLocationItem[]): void {
  try {
    localStorage.setItem(TBM_LOCATIONS_KEY, JSON.stringify(locations));
  } catch (err) {
    console.warn('Storage quota warning while saving TBM locations', err);
  }
}

export function createTbmLocation(partial: Partial<TbmLocationItem>): TbmLocationItem {
  const all = loadTbmLocations();
  const id = partial.id?.trim() || `LOC-TBM-${String(all.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newLoc: TbmLocationItem = {
    id,
    projectId: partial.projectId || getActiveTbmProjectId() || 'PRJ-TBM-001',
    locationName: partial.locationName?.trim() || 'Tunnel Heading Section',
    tunnelSection: partial.tunnelSection?.trim() || 'Main Drive Zone A',
    excavationDirection: partial.excavationDirection || 'INCREASING',
    startChainageRd: Number(partial.startChainageRd) || 1420.0,
    endChainageRd: partial.endChainageRd !== undefined ? Number(partial.endChainageRd) : 1550.0,
    chainageReference: partial.chainageReference || 'RD (Meters from Portal)',
    chainageUnits: 'm',
    alignmentReference: partial.alignmentReference || 'Alignment CL-01',
    startDate: partial.startDate || new Date().toISOString().slice(0, 10),
    description: partial.description || '',
    responsibleGeologist: partial.responsibleGeologist || 'Lead TBM Geologist',
    tbmType: partial.tbmType || 'EPB',
    groundType: partial.groundType || 'MIXED_GROUND',
    machineManufacturer: partial.machineManufacturer || 'Herrenknecht',
    machineModel: partial.machineModel || 'EPB Shield S-912',
    machineSerialId: partial.machineSerialId || 'TBM-HK-912',
    cutterheadDiameterM: Number(partial.cutterheadDiameterM) || 6.65,
    discCutterCount: Number(partial.discCutterCount) || 46,
    discCutterDiameterInches: 17,
    nominalOperatingThrustKn: 16000,
    nominalOperatingTorqueKnm: 2200,
    nominalMaxRpm: 4.5,
    dataSource: partial.dataSource || 'MANUAL_ENTRY',
    predictedGeology: partial.predictedGeology || [
      {
        id: 'PRED-1',
        startChainage: 1420.0,
        endChainage: 1475.0,
        lithology: 'Dense Columnar Basalt',
        groundType: 'HARD_ROCK',
        expectedQValue: 12.5,
        expectedRmr: 68,
        expectedUcsMpa: 85,
        hydrogeologyNotes: 'Minor seepage along cooling joints',
      },
      {
        id: 'PRED-2',
        startChainage: 1475.0,
        endChainage: 1510.0,
        lithology: 'Weathered Basalt & Clayey Fault Breccia',
        groundType: 'MIXED_GROUND',
        expectedQValue: 1.4,
        expectedRmr: 38,
        expectedUcsMpa: 28,
        hydrogeologyNotes: 'Moderate water ingress potential (15-30 L/min)',
        hazardsPredicted: ['Overbreak in crown', 'Cutterhead clogging in clay'],
      },
      {
        id: 'PRED-3',
        startChainage: 1510.0,
        endChainage: 1550.0,
        lithology: 'Amygdaloidal Basalt & Welded Tuff',
        groundType: 'HARD_ROCK',
        expectedQValue: 8.2,
        expectedRmr: 58,
        expectedUcsMpa: 65,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newLoc, ...all];
  saveTbmLocations(updated);
  setActiveTbmLocationId(newLoc.id);
  return newLoc;
}

export function updateTbmLocation(id: string, updates: Partial<TbmLocationItem>): TbmLocationItem | null {
  const all = loadTbmLocations();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return null;

  const updatedItem: TbmLocationItem = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updatedItem;
  saveTbmLocations(all);
  return updatedItem;
}

export function deleteTbmLocation(id: string): void {
  const all = loadTbmLocations().filter((l) => l.id !== id);
  saveTbmLocations(all);

  const recs = loadTbmExcavationRecords().filter((r) => r.locationId !== id);
  saveTbmExcavationRecords(recs);
}

// ---------------------------------------------------------------------------
// EXCAVATION RECORDS CRUD
// ---------------------------------------------------------------------------

export function loadTbmExcavationRecords(locationId?: string): TbmExcavationRecord[] {
  try {
    const raw = localStorage.getItem(TBM_RECORDS_KEY);
    if (raw) {
      const parsed: TbmExcavationRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return locationId ? parsed.filter((r) => r.locationId === locationId) : parsed;
      }
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialTbmData();
  return locationId ? seeded.records.filter((r) => r.locationId === locationId) : seeded.records;
}

export function saveTbmExcavationRecords(records: TbmExcavationRecord[]): void {
  try {
    localStorage.setItem(TBM_RECORDS_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Storage quota warning while saving TBM excavation records', err);
  }
}

export function createTbmExcavationRecord(partial: Partial<TbmExcavationRecord>): TbmExcavationRecord {
  const all = loadTbmExcavationRecords();
  const now = new Date().toISOString();
  const locId = partial.locationId || getActiveTbmLocationId() || 'LOC-TBM-001';
  const projId = partial.projectId || getActiveTbmProjectId() || 'PRJ-TBM-001';

  const startRd = partial.chainageRecord?.startChainage ?? 1420.0;
  const endRd = partial.chainageRecord?.endChainage ?? 1421.5;
  const advance = Math.abs(endRd - startRd);
  const ringNo = partial.chainageRecord?.ringNumber ?? (840 + all.length);

  const id = partial.id || `REC-RD_${startRd.toFixed(2)}-R${ringNo}`;

  const newRec: TbmExcavationRecord = {
    id,
    projectId: projId,
    locationId: locId,
    chainageRecord: {
      recordId: id,
      locationId: locId,
      projectId: projId,
      timestamp: partial.chainageRecord?.timestamp || now,
      startChainage: startRd,
      endChainage: endRd,
      advanceLengthMeters: Number(advance.toFixed(3)),
      ringNumber: ringNo,
      shift: partial.chainageRecord?.shift || 'DAY',
      shiftStartTime: partial.chainageRecord?.shiftStartTime || '08:00',
      shiftEndTime: partial.chainageRecord?.shiftEndTime || '16:00',
      stoppageDurationMinutes: partial.chainageRecord?.stoppageDurationMinutes || 25,
      stoppageReason: partial.chainageRecord?.stoppageReason || 'Disc cutter inspection & ring erection',
      geologistOrOperator: partial.chainageRecord?.geologistOrOperator || 'Senior TBM Geologist',
      generalObservations: partial.chainageRecord?.generalObservations || 'Smooth advance with minimal cutter vibration.',
    },
    geology: partial.geology || {
      mainLithology: 'Basalt (Massive)',
      color: 'Dark grey to charcoal',
      grainSize: 'FINE',
      textureFabric: 'Dense crystalline with sparse plagioclase phenocrysts',
      weatheringGrade: 'W2_SLIGHTLY',
      intactStrengthEstimatedMpa: 82,
      geologicalBoundariesDescription: 'Sharp contact with underlying vesicular basalt',
      unitThicknessMeters: 4.5,
      degreeOfFracturing: 'MODERATELY_FRACTURED',
      blockSizeBytes: 35,
      rockMassIntegrity: 'SOLID',
      instabilitiesNoted: 'Minor face spalling at 12:00 crown position',
      isSqueezingLikely: false,
      isSwellingLikely: false,
      discontinuities: [
        {
          id: 'DISC-1',
          setNumber: 1,
          type: 'JOINT',
          strikeDeg: 45,
          dipDeg: 78,
          dipDirectionDeg: 135,
          spacingCm: 45,
          persistenceMeters: 3.5,
          apertureMm: 1.0,
          roughness: 'ROUGH',
          infilling: 'CALCITE_QUARTZ',
          weathering: 'SLIGHTLY_WEATHERED',
          waterCondition: 'DAMP',
          isDirectObservation: true,
        },
      ],
    },
    muck: partial.muck || {
      sampleId: `MUCK-${ringNo}`,
      sampleChainageRd: startRd,
      timestamp: now,
      materialType: 'ROCK_CHIPS',
      dominantLithology: 'Basalt chips & rock flakes',
      muckColor: 'Dark grey',
      gradingDescription: 'WELL_GRADED_CHIPS',
      finesPercentEstimated: 22,
      coarsePercentEstimated: 78,
      fragmentShapeAngularity: 'ANGULAR',
      averageFragmentSizeMm: 38,
      maxFragmentSizeMm: 120,
      visibleFracturesInChips: true,
      faultGougeObserved: false,
      waterContentVisual: 'MOIST',
      samplingMethod: 'BELT_CONVEYOR',
      geologistInterpretation: 'Favorable rock chip cutting action without cutterhead clogging',
      confidence: 'HIGH',
      photoUrls: [],
    },
    telemetry: partial.telemetry || {
      timestamp: now,
      chainageRd: startRd,
      thrustForceKn: 13800,
      cutterheadTorqueKnm: 1750,
      cutterheadRpm: 4.2,
      penetrationPerRevMm: 4.6,
      penetrationRateMmMin: 19.3,
      excavationDurationMin: 45,
      cutterWearMm: 2.1,
      cuttersReplacedCount: 0,
      machineDowntimeHours: 0.5,
      alarmsTriggered: [],
      epbChamberPressureCenterBar: 1.85,
      foamExpansionRatio: 12,
      foamInjectionRateLMin: 450,
    },
    groundwater: partial.groundwater || {
      inflowRateLitersPerMin: 8.5,
      waterPressureBar: 1.2,
      ingressLocation: 'TAIL_SKIN_BRUSHES',
      turbidity: 'CLEAR',
      phEstimated: 7.4,
      dewateringPumpsActive: 1,
      preGroutingActionTaken: 'Routine bentonite grease injection in seal chamber #2',
      waterInrushRiskLevel: 'SAFE_DRY',
    },
    probeDrilling: partial.probeDrilling || {
      probeHoleId: `PB-01-${ringNo}`,
      drilledLengthMeters: 30.0,
      azimuthDeg: 45,
      inclinationDeg: 3,
      drillingSpeedMMin: 1.4,
      drillingFeedPressureBar: 65,
      flushingWaterReturn: 'FULL_RETURN',
      geologyLoggedAhead: 'Continuous sound basalt for next 25m, minor damp zone at 18m',
      cavityOrVoidDetected: false,
      waterOrGasEncountered: false,
      advanceRecommendation: 'PROCEED_NORMAL',
    },
    classification: partial.classification || {
      rqdPercent: 75,
      jn: 6,
      jr: 2.0,
      ja: 1.5,
      jw: 1.0,
      srf: 1.0,
      calculatedQ: 16.67,
      qClassLabel: 'Class Good',
      rmrStrengthScore: 10,
      rmrRqdScore: 17,
      rmrSpacingScore: 12,
      rmrConditionScore: 22,
      rmrWaterScore: 10,
      rmrOrientationAdjustment: -2,
      calculatedRmr: 69,
      rmrClassLabel: 'Class II (Good Rock)',
      gsiScore: 65,
      fieldPenetrationIndexKnCutterMm: 31.2,
      specificEnergyMJM3: 28.4,
    },
    supportLining: partial.supportLining || {
      ringNumber: ringNo,
      liningType: 'PRECAST_SEGMENT',
      ringTypeUniversal: 'UNIVERSAL_LEFT',
      keySegmentPositionClock: '2:00',
      annularGroutVolumeActualM3: 4.85,
      annularGroutVolumeTheoreticalM3: 4.45,
      groutRatioActualVsTheo: 1.09,
      groutInjectionPressureBar: 2.2,
      tailSealGreaseConsumptionKg: 18.5,
      ringRollMm: 4,
      ringPitchMm: 2,
      ringLeadMm: 6,
      liningDefectsObserved: 'Clean ring assembly, zero stepped joints or cracking',
    },
    instrumentation: partial.instrumentation || {
      timestamp: now,
      chainageRd: startRd,
      surfaceSettlementMonitoringPointId: `SP-${ringNo}`,
      distanceFromTunnelCenterlineM: 0,
      surfaceSettlementMeasuredMm: -4.2,
      theoreticalPeckSettlementMm: -5.1,
      tunnelDiameterConvergenceMm: 1.2,
      settlementThresholdExceeded: false,
    },
    hazards: partial.hazards || [],
    photos: partial.photos || [],
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newRec, ...all];
  saveTbmExcavationRecords(updated);
  setActiveTbmRecordId(newRec.id);
  return newRec;
}

export function updateTbmExcavationRecord(id: string, updates: Partial<TbmExcavationRecord>): TbmExcavationRecord | null {
  const all = loadTbmExcavationRecords();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const updatedItem: TbmExcavationRecord = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updatedItem;
  saveTbmExcavationRecords(all);
  return updatedItem;
}

export function deleteTbmExcavationRecord(id: string): void {
  const all = loadTbmExcavationRecords().filter((r) => r.id !== id);
  saveTbmExcavationRecords(all);
}

// ---------------------------------------------------------------------------
// ACTIVE WORKSPACE POINTERS
// ---------------------------------------------------------------------------

export function getActiveTbmProjectId(): string | null {
  try {
    return localStorage.getItem(TBM_ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveTbmProjectId(id: string): void {
  try {
    localStorage.setItem(TBM_ACTIVE_PROJECT_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveTbmLocationId(): string | null {
  try {
    return localStorage.getItem(TBM_ACTIVE_LOCATION_KEY);
  } catch {
    return null;
  }
}

export function setActiveTbmLocationId(id: string): void {
  try {
    localStorage.setItem(TBM_ACTIVE_LOCATION_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveTbmRecordId(): string | null {
  try {
    return localStorage.getItem(TBM_ACTIVE_RECORD_KEY);
  } catch {
    return null;
  }
}

export function setActiveTbmRecordId(id: string): void {
  try {
    localStorage.setItem(TBM_ACTIVE_RECORD_KEY, id);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// AHEAD-OF-FACE GEOLOGICAL FORECASTS CRUD
// ---------------------------------------------------------------------------

export function loadTbmForecasts(projectId?: string): TbmGeologicalForecastRecord[] {
  try {
    const raw = localStorage.getItem(TBM_FORECASTS_KEY);
    if (raw) {
      const parsed: TbmGeologicalForecastRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return projectId ? parsed.filter((f) => f.projectId === projectId) : parsed;
      }
    }
  } catch {
    // fallback
  }
  return [
    {
      id: 'FC-01',
      projectId: projectId || 'PRJ-TBM-001',
      locationId: 'LOC-TBM-01',
      forecastDate: new Date().toISOString().slice(0, 10),
      author: 'Dr. K. Sharma (Principal Engineering Geologist)',
      startChainageRd: 1435.5,
      endChainageRd: 1450.0,
      predictedLithology: 'Vesicular Basalt with Zeolite Infilling & Minor Brecciation',
      predictedFormations: 'Deccan Traps - Upper Wai Subgroup',
      expectedQValue: 4.5,
      expectedRmr: 52,
      predictedFaultsAndShears: 'Minor slickensided joint shear zone expected near RD 1442m',
      predictedWaterInflowRisk: 'MODERATE',
      supportingEvidence: 'Probe hole PB-01-848 drilling torque anomalies and regional seismic refraction',
      investigationLimitations: 'Forward probe hole drilled to 25m with partial water loss at 18m',
      confidence: 'HIGH',
      recommendedActions: 'Maintain EPB support pressure at 1.85 bar; inspect muck discharge for clay paste.',
      isEncounteredVerified: true,
      encounteredSummary: 'Encountered vesicular basalt with localized damp zones at RD 1438m. Q=4.8.',
      matchStatus: 'CONCORDANT',
    },
    {
      id: 'FC-02',
      projectId: projectId || 'PRJ-TBM-001',
      locationId: 'LOC-TBM-01',
      forecastDate: new Date().toISOString().slice(0, 10),
      author: 'Dr. K. Sharma (Principal Engineering Geologist)',
      startChainageRd: 1450.0,
      endChainageRd: 1475.0,
      predictedLithology: 'Competent Dense Porphyritic Basalt',
      predictedFormations: 'Deccan Traps - Mahabaleshwar Formation',
      expectedQValue: 12.5,
      expectedRmr: 68,
      predictedFaultsAndShears: 'Near horizontal cooling joints; minimal shear risk',
      predictedWaterInflowRisk: 'LOW',
      supportingEvidence: 'Deep borehole BH-TBM-10 core logs and RQD=88%',
      investigationLimitations: 'Projection based on 40m borehole spacing along alignment',
      confidence: 'HIGH',
      recommendedActions: 'Standard 4.5 RPM boring cycle; monitor disc cutter ring wear life.',
      isEncounteredVerified: false,
      encounteredSummary: 'Awaiting excavation progress past RD 1450.00m',
      matchStatus: 'UNVERIFIED',
    },
  ];
}

export function saveTbmForecasts(forecasts: TbmGeologicalForecastRecord[]): void {
  try {
    localStorage.setItem(TBM_FORECASTS_KEY, JSON.stringify(forecasts));
  } catch (err) {
    console.warn('Storage quota warning saving forecasts', err);
  }
}

export function createTbmForecast(partial: Partial<TbmGeologicalForecastRecord>): TbmGeologicalForecastRecord {
  const all = loadTbmForecasts();
  const id = partial.id?.trim() || `FC-${String(all.length + 1).padStart(2, '0')}`;
  const newForecast: TbmGeologicalForecastRecord = {
    id,
    projectId: partial.projectId || 'PRJ-TBM-001',
    locationId: partial.locationId || 'LOC-TBM-01',
    forecastDate: partial.forecastDate || new Date().toISOString().slice(0, 10),
    author: partial.author?.trim() || 'Lead TBM Geologist',
    startChainageRd: partial.startChainageRd || 1450.0,
    endChainageRd: partial.endChainageRd || 1475.0,
    predictedLithology: partial.predictedLithology?.trim() || 'Basalt (Massive)',
    predictedFormations: partial.predictedFormations?.trim() || 'Deccan Traps Formation',
    expectedQValue: partial.expectedQValue || 8.0,
    expectedRmr: partial.expectedRmr || 62,
    predictedFaultsAndShears: partial.predictedFaultsAndShears?.trim() || 'None significant predicted',
    predictedWaterInflowRisk: partial.predictedWaterInflowRisk || 'LOW',
    supportingEvidence: partial.supportingEvidence?.trim() || 'Alignment investigation boreholes',
    investigationLimitations: partial.investigationLimitations?.trim() || 'Borehole interval interpolation',
    confidence: partial.confidence || 'MODERATE',
    recommendedActions: partial.recommendedActions?.trim() || 'Normal TBM excavation with forward monitoring',
    isEncounteredVerified: false,
    matchStatus: 'UNVERIFIED',
  };

  const updated = [newForecast, ...all];
  saveTbmForecasts(updated);
  return newForecast;
}

export function updateTbmForecast(id: string, updates: Partial<TbmGeologicalForecastRecord>): TbmGeologicalForecastRecord | null {
  const all = loadTbmForecasts();
  const idx = all.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const updatedItem = { ...all[idx], ...updates };
  all[idx] = updatedItem;
  saveTbmForecasts(all);
  return updatedItem;
}

// ---------------------------------------------------------------------------
// GEOTECHNICAL INSTRUMENT READINGS CRUD
// ---------------------------------------------------------------------------

export function loadTbmInstrumentReadings(projectId?: string): TbmInstrumentReading[] {
  try {
    const raw = localStorage.getItem(TBM_INSTRUMENTS_KEY);
    if (raw) {
      const parsed: TbmInstrumentReading[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  const now = new Date().toISOString();
  return [
    { id: 'INST-01', instrumentId: 'SP-841', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1423.5, offsetFromCenterlineM: 0.0, baselineValue: 0.0, currentValue: -3.8, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Directly over tunnel centerline' },
    { id: 'INST-02', instrumentId: 'SP-842', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1425.0, offsetFromCenterlineM: 0.0, baselineValue: 0.0, currentValue: -4.2, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Transverse array center' },
    { id: 'INST-03', instrumentId: 'SP-843', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1426.5, offsetFromCenterlineM: 0.0, baselineValue: 0.0, currentValue: -4.5, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Maximum settlement location' },
    { id: 'INST-04', instrumentId: 'SP-844', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1428.0, offsetFromCenterlineM: 0.0, baselineValue: 0.0, currentValue: -3.9, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Over ring #845' },
    { id: 'INST-05', instrumentId: 'SP-845', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1429.5, offsetFromCenterlineM: 0.0, baselineValue: 0.0, currentValue: -2.8, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Active face vicinity' },
    { id: 'INST-06', instrumentId: 'SP-843-L5', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1426.5, offsetFromCenterlineM: -5.0, baselineValue: 0.0, currentValue: -2.9, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Transverse offset 5m West' },
    { id: 'INST-07', instrumentId: 'SP-843-R5', instrumentType: 'SURFACE_SETTLEMENT', chainageRd: 1426.5, offsetFromCenterlineM: 5.0, baselineValue: 0.0, currentValue: -2.7, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Transverse offset 5m East' },
    { id: 'INST-08', instrumentId: 'CP-01', instrumentType: 'CONVERGENCE_PIN', chainageRd: 1425.0, offsetFromCenterlineM: 3.3, baselineValue: 6650.0, currentValue: 6648.8, unit: 'mm', alertLevel: 'NORMAL', timestamp: now, notes: 'Horizontal diameter convergence: -1.2mm' },
    { id: 'INST-09', instrumentId: 'PZ-01', instrumentType: 'PIEZOMETER', chainageRd: 1426.5, offsetFromCenterlineM: 8.0, baselineValue: 125.0, currentValue: 118.5, unit: 'kPa', alertLevel: 'NORMAL', timestamp: now, notes: 'Pore water pressure stable' },
  ];
}

export function saveTbmInstrumentReadings(readings: TbmInstrumentReading[]): void {
  try {
    localStorage.setItem(TBM_INSTRUMENTS_KEY, JSON.stringify(readings));
  } catch (err) {
    console.warn('Storage quota warning saving instrument readings', err);
  }
}

export function createTbmInstrumentReading(partial: Partial<TbmInstrumentReading>): TbmInstrumentReading {
  const all = loadTbmInstrumentReadings();
  const id = partial.id || `INST-${String(all.length + 1).padStart(2, '0')}`;
  const newReading: TbmInstrumentReading = {
    id,
    instrumentId: partial.instrumentId?.trim() || `SP-${all.length + 1}`,
    instrumentType: partial.instrumentType || 'SURFACE_SETTLEMENT',
    chainageRd: partial.chainageRd || 1430.0,
    offsetFromCenterlineM: partial.offsetFromCenterlineM || 0.0,
    baselineValue: partial.baselineValue || 0.0,
    currentValue: partial.currentValue || 0.0,
    unit: partial.unit || 'mm',
    alertLevel: partial.alertLevel || 'NORMAL',
    timestamp: partial.timestamp || new Date().toISOString(),
    notes: partial.notes || '',
  };

  const updated = [newReading, ...all];
  saveTbmInstrumentReadings(updated);
  return newReading;
}

// ---------------------------------------------------------------------------
// SEED REALISTIC FIELD DATA FOR INSTANT TESTING
// ---------------------------------------------------------------------------

export function seedInitialTbmData(): {
  projects: TbmProjectItem[];
  locations: TbmLocationItem[];
  records: TbmExcavationRecord[];
} {
  const defaultProject: TbmProjectItem = {
    id: 'PRJ-TBM-001',
    projectName: 'Metro Line 3 Underground (Package UGC-04)',
    tunnelName: 'Dharavi to Dadar Uplink Tunnel',
    client: 'Mumbai Metro Rail Corporation Ltd (MMRCL)',
    contractor: 'Continental Engineering - Tata JV',
    consultant: 'AECOM - PADECO PMC',
    projectLocation: 'Mumbai, Maharashtra, India',
    tunnelAlignment: 'Chainage 14+200 to 16+800',
    startDate: '2025-03-01',
    description: 'Twin-tube EPB shield mechanized tunneling through Deccan Trap basalt, pyroclastic tuff, and breccia under densely populated urban fabric.',
    responsibleGeologist: 'Akash Dhoni (Chief TBM Geologist)',
    coordinateSystem: 'WGS84 / UTM Zone 43N',
    units: 'METRIC',
    createdAt: '2025-03-01T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const defaultLocation: TbmLocationItem = {
    id: 'LOC-TBM-001',
    projectId: 'PRJ-TBM-001',
    locationName: 'Uplink Shield Heading 01',
    tunnelSection: 'Drive RD 1420.00 to RD 1550.00',
    excavationDirection: 'INCREASING',
    startChainageRd: 1420.0,
    endChainageRd: 1550.0,
    chainageReference: 'RD (Chainage in meters from Launch Shaft 04)',
    chainageUnits: 'm',
    alignmentReference: 'Uplink Centerline Rev-3',
    startDate: '2025-03-05',
    description: 'EPB machine drive transitioning from fresh compact basalt into amygdaloidal weathered basalt with local fault breccia.',
    responsibleGeologist: 'Akash Dhoni',
    tbmType: 'EPB',
    groundType: 'MIXED_GROUND',
    machineManufacturer: 'Herrenknecht AG',
    machineModel: 'EPB Shield S-912',
    machineSerialId: 'HK-EPB-912-Ø6.65',
    cutterheadDiameterM: 6.65,
    discCutterCount: 46,
    discCutterDiameterInches: 17,
    nominalOperatingThrustKn: 16500,
    nominalOperatingTorqueKnm: 2400,
    nominalMaxRpm: 4.5,
    dataSource: 'MANUAL_ENTRY',
    predictedGeology: [
      {
        id: 'PRED-1',
        startChainage: 1420.0,
        endChainage: 1475.0,
        lithology: 'Dense Compact Basalt',
        groundType: 'HARD_ROCK',
        expectedQValue: 14.5,
        expectedRmr: 72,
        expectedUcsMpa: 88,
        hydrogeologyNotes: 'Dry to minor seepage in joints',
      },
      {
        id: 'PRED-2',
        startChainage: 1475.0,
        endChainage: 1515.0,
        lithology: 'Weathered Basalt & Shear Zone Breccia',
        groundType: 'MIXED_GROUND',
        expectedQValue: 1.8,
        expectedRmr: 42,
        expectedUcsMpa: 32,
        hydrogeologyNotes: 'Inflow potential up to 25 L/min; clayey fines',
        hazardsPredicted: ['Crown overbreak', 'Clogging of cutterhead openings'],
      },
      {
        id: 'PRED-3',
        startChainage: 1515.0,
        endChainage: 1550.0,
        lithology: 'Amygdaloidal Basalt & Welded Pyroclastic Tuff',
        groundType: 'HARD_ROCK',
        expectedQValue: 8.8,
        expectedRmr: 61,
        expectedUcsMpa: 68,
      },
    ],
    createdAt: '2025-03-05T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const ringTemplates = [
    { ring: 841, startRd: 1420.0, endRd: 1421.5, lith: 'Dense Columnar Basalt', q: 18.5, rmr: 74, fpi: 29.5, thrust: 13500, torque: 1600, key: '12:00' as const },
    { ring: 842, startRd: 1421.5, endRd: 1423.0, lith: 'Dense Columnar Basalt', q: 16.2, rmr: 72, fpi: 31.0, thrust: 14200, torque: 1720, key: '2:00' as const },
    { ring: 843, startRd: 1423.0, endRd: 1424.5, lith: 'Columnar Basalt (Slightly Fractured)', q: 12.0, rmr: 67, fpi: 33.4, thrust: 14800, torque: 1850, key: '4:00' as const },
    { ring: 844, startRd: 1424.5, endRd: 1426.0, lith: 'Basalt with Calcite Veins', q: 9.8, rmr: 64, fpi: 32.1, thrust: 14600, torque: 1800, key: '6:00' as const },
    { ring: 845, startRd: 1426.0, endRd: 1427.5, lith: 'Amygdaloidal Basalt with Zeolite Infill', q: 7.4, rmr: 59, fpi: 28.6, thrust: 13900, torque: 1740, key: '8:00' as const },
    { ring: 846, startRd: 1427.5, endRd: 1429.0, lith: 'Moderately Weathered Basalt', q: 4.8, rmr: 52, fpi: 24.2, thrust: 12800, torque: 1650, key: '10:00' as const },
    { ring: 847, startRd: 1429.0, endRd: 1430.5, lith: 'Fractured Basalt / Fault Margin', q: 2.6, rmr: 45, fpi: 20.8, thrust: 11900, torque: 1520, key: '12:00' as const },
    { ring: 848, startRd: 1430.5, endRd: 1432.0, lith: 'Clayey Fault Gouge & Breccia Zone', q: 0.85, rmr: 34, fpi: 15.4, thrust: 10500, torque: 2150, key: '2:00' as const },
  ];

  const defaultRecords: TbmExcavationRecord[] = ringTemplates.map((t, idx) => {
    const id = `REC-RD_${t.startRd.toFixed(2)}-R${t.ring}`;
    const advance = Number((t.endRd - t.startRd).toFixed(2));
    const now = new Date(Date.now() - (ringTemplates.length - idx) * 3600 * 1000 * 6).toISOString();

    return {
      id,
      projectId: 'PRJ-TBM-001',
      locationId: 'LOC-TBM-001',
      chainageRecord: {
        recordId: id,
        locationId: 'LOC-TBM-001',
        projectId: 'PRJ-TBM-001',
        timestamp: now,
        startChainage: t.startRd,
        endChainage: t.endRd,
        advanceLengthMeters: advance,
        ringNumber: t.ring,
        shift: idx % 2 === 0 ? 'DAY' : 'NIGHT',
        shiftStartTime: idx % 2 === 0 ? '08:00' : '20:00',
        shiftEndTime: idx % 2 === 0 ? '16:00' : '04:00',
        stoppageDurationMinutes: 20 + idx * 3,
        stoppageReason: 'Ring build, tail seal inspection & survey check',
        geologistOrOperator: 'Akash Dhoni',
        generalObservations: `Excavation of Ring #${t.ring} in ${t.lith}. FPI stable at ${t.fpi} kN/cutter/mm.`,
      },
      geology: {
        mainLithology: t.lith,
        color: t.q < 5 ? 'Brownish grey to clayey olive' : 'Dark charcoal grey',
        grainSize: 'FINE',
        textureFabric: 'Dense crystalline igneous basalt with cooling joints',
        weatheringGrade: t.q < 5 ? 'W4_HIGHLY' : 'W2_SLIGHTLY',
        intactStrengthEstimatedMpa: Math.round(t.rmr * 1.2),
        geologicalBoundariesDescription: 'Concordant basalt flows with thin flow breccia bands',
        unitThicknessMeters: 3.8,
        degreeOfFracturing: t.q < 5 ? 'CRUSHED' : 'MODERATELY_FRACTURED',
        blockSizeBytes: t.q < 5 ? 12 : 45,
        rockMassIntegrity: t.q < 5 ? 'BLOCKY_DISTURBED' : 'SOLID',
        instabilitiesNoted: t.q < 5 ? 'Overbreak tendency observed at crown 11:00-1:00' : 'None, stable bore perimeter',
        isSqueezingLikely: false,
        isSwellingLikely: t.q < 5,
        discontinuities: [
          {
            id: `DISC-${t.ring}-1`,
            setNumber: 1,
            type: 'JOINT',
            strikeDeg: 42,
            dipDeg: 76,
            dipDirectionDeg: 132,
            spacingCm: Math.round(t.q * 3),
            persistenceMeters: 3.2,
            apertureMm: t.q < 5 ? 3.5 : 0.8,
            roughness: 'ROUGH',
            infilling: t.q < 5 ? 'SOFT_CLAY' : 'CALCITE_QUARTZ',
            weathering: t.q < 5 ? 'MODERATELY_WEATHERED' : 'SLIGHTLY_WEATHERED',
            waterCondition: t.q < 5 ? 'WET' : 'DRY',
            isDirectObservation: true,
          },
        ],
      },
      muck: {
        sampleId: `MUCK-${t.ring}`,
        sampleChainageRd: t.startRd,
        timestamp: now,
        materialType: t.q < 5 ? 'MIXED_PASTE' : 'ROCK_CHIPS',
        dominantLithology: t.lith,
        muckColor: t.q < 5 ? 'Greyish brown muddy muck' : 'Clean dark basalt chips',
        gradingDescription: t.q < 5 ? 'CLAYEY_SLURRY' : 'WELL_GRADED_CHIPS',
        finesPercentEstimated: t.q < 5 ? 58 : 20,
        coarsePercentEstimated: t.q < 5 ? 42 : 80,
        fragmentShapeAngularity: 'ANGULAR',
        averageFragmentSizeMm: t.q < 5 ? 18 : 36,
        maxFragmentSizeMm: t.q < 5 ? 65 : 110,
        visibleFracturesInChips: true,
        faultGougeObserved: t.q < 5,
        waterContentVisual: t.q < 5 ? 'STICKY' : 'MOIST',
        samplingMethod: 'BELT_CONVEYOR',
        geologistInterpretation: t.q < 5 ? 'High fines and sticky clay present, increased EPB foam injection' : 'Excellent disc cutter chip indentation and clean muck flow',
        confidence: 'HIGH',
        photoUrls: [],
      },
      telemetry: {
        timestamp: now,
        chainageRd: t.startRd,
        thrustForceKn: t.thrust,
        cutterheadTorqueKnm: t.torque,
        cutterheadRpm: 4.2,
        penetrationPerRevMm: Number((advance * 1000 / (4.2 * 45)).toFixed(2)),
        penetrationRateMmMin: 21.0,
        excavationDurationMin: 45,
        cutterWearMm: Number((1.2 + idx * 0.2).toFixed(1)),
        cuttersReplacedCount: 0,
        machineDowntimeHours: 0.4,
        alarmsTriggered: [],
        epbChamberPressureCenterBar: t.q < 5 ? 2.15 : 1.75,
        foamExpansionRatio: 12,
        foamInjectionRateLMin: t.q < 5 ? 600 : 420,
      },
      groundwater: {
        inflowRateLitersPerMin: t.q < 5 ? 22.0 : 6.0,
        waterPressureBar: t.q < 5 ? 1.6 : 1.1,
        ingressLocation: 'TAIL_SKIN_BRUSHES',
        turbidity: t.q < 5 ? 'SLIGHTLY_SILTY' : 'CLEAR',
        phEstimated: 7.5,
        dewateringPumpsActive: 1,
        preGroutingActionTaken: 'Tail seal grease batch injected',
        waterInrushRiskLevel: t.q < 5 ? 'MODERATE_INFLOW' : 'SAFE_DRY',
      },
      probeDrilling: {
        probeHoleId: `PB-01-${t.ring}`,
        drilledLengthMeters: 25.0,
        azimuthDeg: 45,
        inclinationDeg: 2,
        drillingSpeedMMin: 1.6,
        drillingFeedPressureBar: 60,
        flushingWaterReturn: 'FULL_RETURN',
        geologyLoggedAhead: 'Uniform rock mass continuation ahead of face',
        cavityOrVoidDetected: false,
        waterOrGasEncountered: false,
        advanceRecommendation: 'PROCEED_NORMAL',
      },
      classification: {
        rqdPercent: Math.min(100, Math.round(t.rmr * 1.1)),
        jn: t.q < 5 ? 9 : 6,
        jr: t.q < 5 ? 1.5 : 2.0,
        ja: t.q < 5 ? 3.0 : 1.0,
        jw: 1.0,
        srf: t.q < 5 ? 2.5 : 1.0,
        calculatedQ: t.q,
        qClassLabel: t.q < 5 ? 'Class Poor' : 'Class Good',
        rmrStrengthScore: Math.round(t.rmr * 0.2),
        rmrRqdScore: Math.round(t.rmr * 0.25),
        rmrSpacingScore: Math.round(t.rmr * 0.2),
        rmrConditionScore: Math.round(t.rmr * 0.25),
        rmrWaterScore: 10,
        rmrOrientationAdjustment: -2,
        calculatedRmr: t.rmr,
        rmrClassLabel: t.rmr > 60 ? 'Class II (Good Rock)' : t.rmr > 40 ? 'Class III (Fair Rock)' : 'Class IV (Poor Rock)',
        gsiScore: t.rmr - 5,
        fieldPenetrationIndexKnCutterMm: t.fpi,
        specificEnergyMJM3: Number((t.fpi * 0.85).toFixed(1)),
      },
      supportLining: {
        ringNumber: t.ring,
        liningType: 'PRECAST_SEGMENT',
        ringTypeUniversal: 'UNIVERSAL_LEFT',
        keySegmentPositionClock: t.key,
        annularGroutVolumeActualM3: 4.65,
        annularGroutVolumeTheoreticalM3: 4.45,
        groutRatioActualVsTheo: 1.04,
        groutInjectionPressureBar: 2.1,
        tailSealGreaseConsumptionKg: 16.0,
        ringRollMm: 3,
        ringPitchMm: 2,
        ringLeadMm: 4,
        liningDefectsObserved: 'Zero segment cracks, gaskets fully compressed',
      },
      instrumentation: {
        timestamp: now,
        chainageRd: t.startRd,
        surfaceSettlementMonitoringPointId: `SP-${t.ring}`,
        distanceFromTunnelCenterlineM: 0,
        surfaceSettlementMeasuredMm: Number((-2.5 - (848 - t.ring) * 0.4).toFixed(1)),
        theoreticalPeckSettlementMm: -4.8,
        tunnelDiameterConvergenceMm: 1.1,
        settlementThresholdExceeded: false,
      },
      hazards: t.q < 5 ? [
        {
          hazardId: `HAZ-${t.ring}`,
          chainageRd: t.startRd,
          hazardCategory: 'FACE_COLLAPSE_INSTABILITY',
          severity: 'MEDIUM',
          impactOnTbm: 'High fine paste clogging cutterhead disc housings; increased cutterhead torque by 25%.',
          actionTaken: 'Increased bentonite foam injection to 600 L/min and lowered cutterhead rotation to 2.8 RPM.',
          dateReported: now,
          isResolved: true,
          photoUrls: [],
        },
      ] : [],
      photos: [],
      createdAt: now,
      updatedAt: now,
    };
  });

  saveTbmProjects([defaultProject]);
  saveTbmLocations([defaultLocation]);
  saveTbmExcavationRecords(defaultRecords);
  setActiveTbmProjectId(defaultProject.id);
  setActiveTbmLocationId(defaultLocation.id);
  setActiveTbmRecordId(defaultRecords[0].id);

  return {
    projects: [defaultProject],
    locations: [defaultLocation],
    records: defaultRecords,
  };
}
