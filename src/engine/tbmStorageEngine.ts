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
import {
  loadHighCapacityCollection,
  saveHighCapacityCollection,
} from './fastAsyncStorageEngine';

export const TBM_PROJECTS_KEY = 'eswa_tbm_projects_v2';
export const TBM_LOCATIONS_KEY = 'eswa_tbm_locations_v2';
export const TBM_RECORDS_KEY = 'eswa_tbm_excavation_records_v2';
export const TBM_FORECASTS_KEY = 'eswa_tbm_forecasts_v2';
export const TBM_INSTRUMENTS_KEY = 'eswa_tbm_instruments_v2';
export const TBM_ACTIVE_PROJECT_KEY = 'eswa_tbm_active_project_id_v2';
export const TBM_ACTIVE_LOCATION_KEY = 'eswa_tbm_active_location_id_v2';
export const TBM_ACTIVE_RECORD_KEY = 'eswa_tbm_active_record_id_v2';
export const DEFAULT_STARTUP_MODE_KEY = 'eswa_default_startup_industry_mode_v1';
export const TBM_STORAGE_INITIALIZED_KEY = 'eswa_tbm_storage_initialized_v2';

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

const LEGACY_TBM_NAMES = new Set([
  'Akash Dhoni (Chief TBM Geologist)',
  'Akash Dhoni',
  'Dr. K. Sharma',
  'Lead TBM Geologist',
  'Shift Team 1',
]);

function cleanLegacyTbmName(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  return LEGACY_TBM_NAMES.has(trimmed) ? '' : trimmed;
}

export function loadTbmProjects(): TbmProjectItem[] {
  const loaded = loadHighCapacityCollection<TbmProjectItem>(TBM_PROJECTS_KEY);
  if (Array.isArray(loaded)) {
    return loaded.map((p) => ({
      ...p,
      responsibleGeologist: cleanLegacyTbmName(p.responsibleGeologist),
    }));
  }
  return [];
}

export function saveTbmProjects(projects: TbmProjectItem[]): void {
  saveHighCapacityCollection(TBM_PROJECTS_KEY, projects);
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
    responsibleGeologist: cleanLegacyTbmName(partial.responsibleGeologist),
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
  const loaded = loadHighCapacityCollection<TbmLocationItem>(TBM_LOCATIONS_KEY);
  if (Array.isArray(loaded)) {
    const cleaned = loaded.map((l) => ({
      ...l,
      responsibleGeologist: cleanLegacyTbmName(l.responsibleGeologist),
    }));
    return projectId ? cleaned.filter((l) => l.projectId === projectId) : cleaned;
  }
  return [];
}

export function saveTbmLocations(locations: TbmLocationItem[]): void {
  saveHighCapacityCollection(TBM_LOCATIONS_KEY, locations);
}

export function createTbmLocation(partial: Partial<TbmLocationItem>): TbmLocationItem {
  const all = loadTbmLocations();
  const id = partial.id?.trim() || `LOC-TBM-${String(all.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newLoc: TbmLocationItem = {
    id,
    projectId: partial.projectId || getActiveTbmProjectId() || '',
    locationName: partial.locationName?.trim() || 'Tunnel Heading Section',
    tunnelSection: partial.tunnelSection?.trim() || 'Main Drive',
    excavationDirection: partial.excavationDirection || 'INCREASING',
    startChainageRd: Number(partial.startChainageRd) || 0.0,
    endChainageRd: partial.endChainageRd !== undefined ? Number(partial.endChainageRd) : 100.0,
    chainageReference: partial.chainageReference || 'RD (Meters from Portal)',
    chainageUnits: 'm',
    alignmentReference: partial.alignmentReference || 'Alignment CL-01',
    startDate: partial.startDate || new Date().toISOString().slice(0, 10),
    description: partial.description || '',
    responsibleGeologist: partial.responsibleGeologist || '',
    tbmType: partial.tbmType || 'EPB',
    groundType: partial.groundType || 'MIXED_GROUND',
    machineManufacturer: partial.machineManufacturer || '',
    machineModel: partial.machineModel || '',
    machineSerialId: partial.machineSerialId || '',
    cutterheadDiameterM: Number(partial.cutterheadDiameterM) || 6.4,
    discCutterCount: Number(partial.discCutterCount) || 44,
    discCutterDiameterInches: 17,
    nominalOperatingThrustKn: 16000,
    nominalOperatingTorqueKnm: 2200,
    nominalMaxRpm: 4.5,
    dataSource: partial.dataSource || 'MANUAL_ENTRY',
    predictedGeology: partial.predictedGeology || [],
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
  const loaded = loadHighCapacityCollection<TbmExcavationRecord>(TBM_RECORDS_KEY);
  if (Array.isArray(loaded)) {
    const cleaned = loaded.map((r) => ({
      ...r,
      chainageRecord: r.chainageRecord
        ? {
            ...r.chainageRecord,
            geologistOrOperator: cleanLegacyTbmName(r.chainageRecord.geologistOrOperator),
          }
        : r.chainageRecord,
    }));
    return locationId ? cleaned.filter((r) => r.locationId === locationId) : cleaned;
  }
  return [];
}

export function saveTbmExcavationRecords(records: TbmExcavationRecord[]): void {
  saveHighCapacityCollection(TBM_RECORDS_KEY, records);
}

export function clearAllTbmData(): void {
  try {
    saveHighCapacityCollection(TBM_RECORDS_KEY, []);
    saveHighCapacityCollection(TBM_LOCATIONS_KEY, []);
    saveHighCapacityCollection(TBM_PROJECTS_KEY, []);
    saveHighCapacityCollection(TBM_FORECASTS_KEY, []);
    saveHighCapacityCollection(TBM_INSTRUMENTS_KEY, []);
    localStorage.removeItem(TBM_ACTIVE_PROJECT_KEY);
    localStorage.removeItem(TBM_ACTIVE_LOCATION_KEY);
    localStorage.removeItem(TBM_ACTIVE_RECORD_KEY);
    localStorage.setItem(TBM_STORAGE_INITIALIZED_KEY, 'true');
  } catch (err) {
    console.warn('Error clearing TBM storage', err);
  }
}

export function createTbmExcavationRecord(partial: Partial<TbmExcavationRecord>): TbmExcavationRecord {
  const all = loadTbmExcavationRecords();
  const now = new Date().toISOString();
  const locId = partial.locationId || getActiveTbmLocationId() || '';
  const projId = partial.projectId || getActiveTbmProjectId() || '';

  const startRd = partial.chainageRecord?.startChainage ?? 0.0;
  const endRd = partial.chainageRecord?.endChainage ?? (startRd + 1.5);
  const advance = Math.abs(endRd - startRd);
  const ringNo = partial.chainageRecord?.ringNumber ?? (all.length + 1);

  const id = partial.id || `REC-RD_${startRd.toFixed(2)}-R${ringNo}`;

  // Clean template for manual user entry — ZERO auto-fed mock values
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
      stoppageDurationMinutes: partial.chainageRecord?.stoppageDurationMinutes || 0,
      stoppageReason: partial.chainageRecord?.stoppageReason || '',
      geologistOrOperator: partial.chainageRecord?.geologistOrOperator || '',
      generalObservations: partial.chainageRecord?.generalObservations || '',
    },
    geology: partial.geology || {
      mainLithology: '',
      color: '',
      grainSize: 'FINE',
      textureFabric: '',
      weatheringGrade: 'W1_FRESH',
      intactStrengthEstimatedMpa: 0,
      geologicalBoundariesDescription: '',
      unitThicknessMeters: 0,
      degreeOfFracturing: 'MODERATELY_FRACTURED',
      blockSizeBytes: 0,
      rockMassIntegrity: 'SOLID',
      instabilitiesNoted: '',
      isSqueezingLikely: false,
      isSwellingLikely: false,
      discontinuities: [],
    },
    muck: partial.muck || {
      sampleId: `MUCK-${ringNo}`,
      sampleChainageRd: startRd,
      timestamp: now,
      materialType: 'ROCK_CHIPS',
      dominantLithology: '',
      muckColor: '',
      gradingDescription: 'WELL_GRADED_CHIPS',
      finesPercentEstimated: 0,
      coarsePercentEstimated: 0,
      fragmentShapeAngularity: 'ANGULAR',
      averageFragmentSizeMm: 0,
      maxFragmentSizeMm: 0,
      visibleFracturesInChips: false,
      faultGougeObserved: false,
      waterContentVisual: 'DRY',
      samplingMethod: 'BELT_CONVEYOR',
      geologistInterpretation: '',
      confidence: 'HIGH',
      photoUrls: [],
    },
    telemetry: partial.telemetry || {
      timestamp: now,
      chainageRd: startRd,
      thrustForceKn: 0,
      cutterheadTorqueKnm: 0,
      cutterheadRpm: 0,
      penetrationPerRevMm: 0,
      penetrationRateMmMin: 0,
      excavationDurationMin: 0,
      cutterWearMm: 0,
      cuttersReplacedCount: 0,
      machineDowntimeHours: 0,
      alarmsTriggered: [],
      epbChamberPressureCenterBar: 0,
      foamExpansionRatio: 0,
      foamInjectionRateLMin: 0,
    },
    groundwater: partial.groundwater || {
      inflowRateLitersPerMin: 0,
      waterPressureBar: 0,
      ingressLocation: 'FACE_CUTTERHEAD',
      turbidity: 'CLEAR',
      phEstimated: 7.0,
      dewateringPumpsActive: 0,
      preGroutingActionTaken: '',
      waterInrushRiskLevel: 'SAFE_DRY',
    },
    probeDrilling: partial.probeDrilling || {
      probeHoleId: '',
      drilledLengthMeters: 0,
      azimuthDeg: 0,
      inclinationDeg: 0,
      drillingSpeedMMin: 0,
      drillingFeedPressureBar: 0,
      flushingWaterReturn: 'FULL_RETURN',
      geologyLoggedAhead: '',
      cavityOrVoidDetected: false,
      waterOrGasEncountered: false,
      advanceRecommendation: 'PROCEED_NORMAL',
    },
    classification: partial.classification || {
      rqdPercent: 0,
      jn: 1,
      jr: 1.0,
      ja: 1.0,
      jw: 1.0,
      srf: 1.0,
      calculatedQ: 0,
      qClassLabel: 'Pending Input',
      rmrStrengthScore: 0,
      rmrRqdScore: 0,
      rmrSpacingScore: 0,
      rmrConditionScore: 0,
      rmrWaterScore: 0,
      rmrOrientationAdjustment: 0,
      calculatedRmr: 0,
      rmrClassLabel: 'Pending Input',
      gsiScore: 0,
      fieldPenetrationIndexKnCutterMm: 0,
      specificEnergyMJM3: 0,
    },
    supportLining: partial.supportLining || {
      ringNumber: ringNo,
      liningType: 'PRECAST_SEGMENT',
      ringTypeUniversal: 'UNIVERSAL_LEFT',
      keySegmentPositionClock: '12:00',
      annularGroutVolumeActualM3: 0,
      annularGroutVolumeTheoreticalM3: 0,
      groutRatioActualVsTheo: 1.0,
      groutInjectionPressureBar: 0,
      tailSealGreaseConsumptionKg: 0,
      ringRollMm: 0,
      ringPitchMm: 0,
      ringLeadMm: 0,
      liningDefectsObserved: '',
    },
    instrumentation: partial.instrumentation || {
      timestamp: now,
      chainageRd: startRd,
      surfaceSettlementMonitoringPointId: `SP-${ringNo}`,
      distanceFromTunnelCenterlineM: 0,
      surfaceSettlementMeasuredMm: 0,
      theoreticalPeckSettlementMm: 0,
      tunnelDiameterConvergenceMm: 0,
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
  const parsed = loadHighCapacityCollection<TbmGeologicalForecastRecord>(TBM_FORECASTS_KEY);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return projectId ? parsed.filter((f) => f.projectId === projectId) : parsed;
  }
  return [];
}

export function saveTbmForecasts(forecasts: TbmGeologicalForecastRecord[]): void {
  saveHighCapacityCollection(TBM_FORECASTS_KEY, forecasts);
}

export function createTbmForecast(partial: Partial<TbmGeologicalForecastRecord>): TbmGeologicalForecastRecord {
  const all = loadTbmForecasts();
  const id = partial.id?.trim() || `FC-${String(all.length + 1).padStart(2, '0')}`;
  const newForecast: TbmGeologicalForecastRecord = {
    id,
    projectId: partial.projectId || 'PRJ-TBM-001',
    locationId: partial.locationId || 'LOC-TBM-01',
    forecastDate: partial.forecastDate || new Date().toISOString().slice(0, 10),
    author: cleanLegacyTbmName(partial.author),
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

export function loadTbmInstrumentReadings(_projectId?: string): TbmInstrumentReading[] {
  const parsed = loadHighCapacityCollection<TbmInstrumentReading>(TBM_INSTRUMENTS_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveTbmInstrumentReadings(readings: TbmInstrumentReading[]): void {
  saveHighCapacityCollection(TBM_INSTRUMENTS_KEY, readings);
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
  saveTbmProjects([]);
  saveTbmLocations([]);
  saveTbmExcavationRecords([]);
  try {
    localStorage.removeItem(TBM_ACTIVE_PROJECT_KEY);
    localStorage.removeItem(TBM_ACTIVE_LOCATION_KEY);
    localStorage.removeItem(TBM_ACTIVE_RECORD_KEY);
  } catch {
    // ignore storage errors
  }

  return {
    projects: [],
    locations: [],
    records: [],
  };
}
