// ============================================================================
// ESWA UNDERGROUND MINING & EXPLORATION — ISOLATED STORAGE & BACKUP ENGINE
// Strictly isolated from NATM and TBM vaults (eswa_strict_vault_MINING)
// ============================================================================

import {
  MiningProjectItem,
  MiningLocationItem,
  MiningStopeItem,
  MiningDrillHoleRecord,
  MiningCoreRun,
  MiningAssayInterval,
} from '../types/mining';
import {
  loadHighCapacityCollection,
  saveHighCapacityCollection,
} from './fastAsyncStorageEngine';

export const MINING_VAULT_KEY = 'eswa_strict_vault_MINING';
export const MINING_PROJECTS_KEY = 'eswa_mining_projects_v2';
export const MINING_LOCATIONS_KEY = 'eswa_mining_locations_v2';
export const MINING_STOPES_KEY = 'eswa_mining_stopes_v2';
export const MINING_DRILLHOLES_KEY = 'eswa_mining_drillholes_v2';
export const MINING_ACTIVE_PROJECT_KEY = 'eswa_mining_active_project_id_v2';
export const MINING_ACTIVE_LOCATION_KEY = 'eswa_mining_active_location_id_v2';
export const MINING_ACTIVE_STOPE_KEY = 'eswa_mining_active_stope_id_v2';
export const MINING_ACTIVE_DRILLHOLE_KEY = 'eswa_mining_active_drillhole_id_v2';

// ---------------------------------------------------------------------------
// ACTIVE STATE IDS
// ---------------------------------------------------------------------------

export function getActiveMiningLocationId(): string | null {
  try {
    return localStorage.getItem(MINING_ACTIVE_LOCATION_KEY);
  } catch {
    return null;
  }
}

export function setActiveMiningLocationId(id: string): void {
  try {
    localStorage.setItem(MINING_ACTIVE_LOCATION_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveMiningProjectId(): string | null {
  try {
    return localStorage.getItem(MINING_ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveMiningProjectId(id: string): void {
  try {
    localStorage.setItem(MINING_ACTIVE_PROJECT_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveMiningStopeId(): string | null {
  try {
    return localStorage.getItem(MINING_ACTIVE_STOPE_KEY);
  } catch {
    return null;
  }
}

export function setActiveMiningStopeId(id: string): void {
  try {
    localStorage.setItem(MINING_ACTIVE_STOPE_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveMiningDrillHoleId(): string | null {
  try {
    return localStorage.getItem(MINING_ACTIVE_DRILLHOLE_KEY);
  } catch {
    return null;
  }
}

export function setActiveMiningDrillHoleId(id: string): void {
  try {
    localStorage.setItem(MINING_ACTIVE_DRILLHOLE_KEY, id);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// PROJECTS CRUD
// ---------------------------------------------------------------------------

export function loadMiningProjects(): MiningProjectItem[] {
  const loaded = loadHighCapacityCollection<MiningProjectItem>(MINING_PROJECTS_KEY);
  return Array.isArray(loaded) ? loaded : [];
}

export function saveMiningProjects(projects: MiningProjectItem[]): void {
  saveHighCapacityCollection(MINING_PROJECTS_KEY, projects);
}

export function createMiningProject(partial: Partial<MiningProjectItem>): MiningProjectItem {
  const all = loadMiningProjects();
  const id = partial.id?.trim() || `PRJ-MIN-${String(all.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newProj: MiningProjectItem = {
    id,
    projectName: partial.projectName?.trim() || 'New Underground Mining Project',
    mineName: partial.mineName?.trim() || 'Main Deep Mine Site',
    miningCompany: partial.miningCompany?.trim() || 'National Mining & Exploration Ltd',
    mineSiteLocation: partial.mineSiteLocation?.trim() || 'Kolar Gold Belt, Southern Block',
    primaryCommodity: partial.primaryCommodity || 'Gold (Au)',
    secondaryCommodity: partial.secondaryCommodity || 'Copper (Cu)',
    gradeUnits: partial.gradeUnits || 'g/t',
    mineCoordinateSystem: partial.mineCoordinateSystem || 'Mine Grid Local RL (Datum 1000m)',
    mineDatumLevelMrl: partial.mineDatumLevelMrl || 1000,
    responsibleGeologist: partial.responsibleGeologist?.trim() || 'Chief Mine Geologist',
    activeMiningMethod: partial.activeMiningMethod || 'SUBLEVEL_OPEN_STOPING',
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newProj, ...all];
  saveMiningProjects(updated);
  setActiveMiningProjectId(newProj.id);
  return newProj;
}

export function updateMiningProject(id: string, updates: Partial<MiningProjectItem>): MiningProjectItem | null {
  const all = loadMiningProjects();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;

  const updatedItem: MiningProjectItem = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updatedItem;
  saveMiningProjects(all);
  return updatedItem;
}

export function deleteMiningProject(id: string): void {
  const all = loadMiningProjects();
  const filtered = all.filter((p) => p.id !== id);
  saveMiningProjects(filtered);
  if (getActiveMiningProjectId() === id) {
    if (filtered.length > 0) setActiveMiningProjectId(filtered[0].id);
    else localStorage.removeItem(MINING_ACTIVE_PROJECT_KEY);
  }
}

// ---------------------------------------------------------------------------
// LOCATIONS & HEADINGS (CROSS-SECTION SHAPE & SIZE) CRUD
// ---------------------------------------------------------------------------

export function loadMiningLocations(): MiningLocationItem[] {
  const loaded = loadHighCapacityCollection<MiningLocationItem>(MINING_LOCATIONS_KEY);
  return Array.isArray(loaded) ? loaded : [];
}

export function saveMiningLocations(locations: MiningLocationItem[]): void {
  saveHighCapacityCollection(MINING_LOCATIONS_KEY, locations);
}

export function createMiningLocation(partial: Partial<MiningLocationItem>): MiningLocationItem {
  const all = loadMiningLocations();
  const id = partial.id?.trim() || `LOC-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newLoc: MiningLocationItem = {
    id,
    projectId: partial.projectId || getActiveMiningProjectId() || 'PRJ-MIN-001',
    locationName: partial.locationName?.trim() || 'HW-DRV-06',
    mineLevel: partial.mineLevel?.trim() || 'Level 620 mRL',
    levelElevationMrl: partial.levelElevationMrl ?? 620,
    excavationType: partial.excavationType || 'ORE_DRIVE',
    miningMethod: partial.miningMethod || 'SUBLEVEL_OPEN_STOPING',
    oreBodyName: partial.oreBodyName?.trim() || 'Champion Quartz Lode',
    targetCutoffGrade: partial.targetCutoffGrade ?? 2.50,
    stopeShape: partial.stopeShape || 'd_arch',
    stopeWidthM: partial.stopeWidthM ?? 4.8,
    stopeHeightM: partial.stopeHeightM ?? 4.2,
    wallHeightM: partial.wallHeightM ?? 2.8,
    crownRadiusM: partial.crownRadiusM ?? 2.4,
    headingDriveAzimuthDeg: partial.headingDriveAzimuthDeg ?? 45,
    customProfilePoints: partial.customProfilePoints,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newLoc, ...all];
  saveMiningLocations(updated);
  setActiveMiningLocationId(newLoc.id);
  return newLoc;
}

export function updateMiningLocation(id: string, updates: Partial<MiningLocationItem>): MiningLocationItem | null {
  const all = loadMiningLocations();
  const idx = all.findIndex((l) => l.id === id);
  if (idx < 0) return null;

  const updatedItem: MiningLocationItem = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updatedItem;
  saveMiningLocations(all);
  return updatedItem;
}

export function deleteMiningLocation(id: string): void {
  const all = loadMiningLocations();
  const filtered = all.filter((l) => l.id !== id);
  saveMiningLocations(filtered);
  if (getActiveMiningLocationId() === id) {
    if (filtered.length > 0) setActiveMiningLocationId(filtered[0].id);
    else localStorage.removeItem(MINING_ACTIVE_LOCATION_KEY);
  }
}

// ---------------------------------------------------------------------------
// FACES & BLAST ROUNDS CRUD
// ---------------------------------------------------------------------------

export function loadMiningStopes(): MiningStopeItem[] {
  const loaded = loadHighCapacityCollection<MiningStopeItem>(MINING_STOPES_KEY);
  return Array.isArray(loaded) ? loaded : [];
}

export function saveMiningStopes(stopes: MiningStopeItem[]): void {
  saveHighCapacityCollection(MINING_STOPES_KEY, stopes);
}

export function createMiningStope(partial: Partial<MiningStopeItem>): MiningStopeItem {
  const all = loadMiningStopes();
  const id = partial.id?.trim() || `STP-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newStope: MiningStopeItem = {
    id,
    projectId: partial.projectId || getActiveMiningProjectId() || 'PRJ-MIN-001',
    locationId: partial.locationId,
    stopeOrDriftId: partial.stopeOrDriftId?.trim() || 'HW-DRV-05',
    mineLevel: partial.mineLevel?.trim() || 'Level 620 mRL',
    levelElevationMrl: partial.levelElevationMrl ?? 620,
    excavationType: partial.excavationType || 'ORE_DRIVE',
    miningMethod: partial.miningMethod || 'SUBLEVEL_OPEN_STOPING',
    oreBodyName: partial.oreBodyName?.trim() || 'Champion Quartz Lode',
    targetCutoffGrade: partial.targetCutoffGrade ?? 2.50,
    faceName: partial.faceName,
    chainageFromM: partial.chainageFromM,
    chainageToM: partial.chainageToM,
    currentHeadingRdChainage: partial.currentHeadingRdChainage?.trim() || 'Cut #15',
    blastPullMeters: partial.blastPullMeters ?? 3.2,
    stopeWidthM: partial.stopeWidthM ?? 4.8,
    stopeHeightM: partial.stopeHeightM ?? 4.5,
    stopeShape: partial.stopeShape || 'd_arch',
    wallHeightM: partial.wallHeightM,
    crownRadiusM: partial.crownRadiusM,
    headingDriveAzimuthDeg: partial.headingDriveAzimuthDeg,
    faceInclinationDeg: partial.faceInclinationDeg,
    customProfilePoints: partial.customProfilePoints,
    mappingMode: partial.mappingMode,
    dxfRawData: partial.dxfRawData,
    hangingwallDipDeg: partial.hangingwallDipDeg ?? 72,
    footwallDipDeg: partial.footwallDipDeg ?? 68,
    oreSpecificGravity: partial.oreSpecificGravity ?? 3.35,
    wasteSpecificGravity: partial.wasteSpecificGravity ?? 2.72,
    veins: partial.veins || [],
    channelSamples: partial.channelSamples || [],
    features: partial.features || [],
    surfaces: partial.surfaces,
    activeSurfaceType: partial.activeSurfaceType,
    mrmr: partial.mrmr,
    mathews: partial.mathews,
    facePhotoUrl: partial.facePhotoUrl,
    muckDestinationVerdict: partial.muckDestinationVerdict || 'AWAITING_INPUT',
    dilutedGradeCalculated: partial.dilutedGradeCalculated ?? 0,
    dilutionPercentCalculated: partial.dilutionPercentCalculated ?? 0,
    responsibleGeologist: partial.responsibleGeologist || 'Lead Mine Geologist',
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newStope, ...all];
  saveMiningStopes(updated);
  setActiveMiningStopeId(newStope.id);
  return newStope;
}

export function updateMiningStope(id: string, updates: Partial<MiningStopeItem>): MiningStopeItem | null {
  const all = loadMiningStopes();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return null;

  const updatedItem: MiningStopeItem = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updatedItem;
  saveMiningStopes(all);
  return updatedItem;
}

export function deleteMiningStope(id: string): void {
  const all = loadMiningStopes();
  const filtered = all.filter((s) => s.id !== id);
  saveMiningStopes(filtered);
  if (getActiveMiningStopeId() === id) {
    if (filtered.length > 0) setActiveMiningStopeId(filtered[0].id);
    else localStorage.removeItem(MINING_ACTIVE_STOPE_KEY);
  }
}

// ---------------------------------------------------------------------------
// EXPLORATION & PRODUCTION DRILL HOLES CRUD
// ---------------------------------------------------------------------------

export function loadMiningDrillHoles(): MiningDrillHoleRecord[] {
  const loaded = loadHighCapacityCollection<MiningDrillHoleRecord>(MINING_DRILLHOLES_KEY);
  return Array.isArray(loaded) ? loaded : [];
}

export function saveMiningDrillHoles(holes: MiningDrillHoleRecord[]): void {
  saveHighCapacityCollection(MINING_DRILLHOLES_KEY, holes);
}

export function createMiningDrillHole(partial: Partial<MiningDrillHoleRecord>): MiningDrillHoleRecord {
  const all = loadMiningDrillHoles();
  const id = partial.id?.trim() || `DH-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newHole: MiningDrillHoleRecord = {
    id,
    projectId: partial.projectId || getActiveMiningProjectId() || 'PRJ-MIN-001',
    holeId: partial.holeId?.trim() || `DDH-KD-${String(all.length + 1).padStart(3, '0')}`,
    holeType: partial.holeType || 'DIAMOND_CORE_DDH',
    collarEasting: partial.collarEasting ?? 0,
    collarNorthing: partial.collarNorthing ?? 0,
    collarElevationMrl: partial.collarElevationMrl ?? 620.0,
    collarDipDeg: partial.collarDipDeg ?? -60,
    collarAzimuthDeg: partial.collarAzimuthDeg ?? 90,
    totalDrilledDepthM: partial.totalDrilledDepthM ?? 0,
    coreDiameter: partial.coreDiameter || 'HQ',
    drillingMethod: partial.drillingMethod || 'Wireline Triple-Tube Diamond Core',
    drillingContractor: partial.drillingContractor || '',
    explorationConsultant: partial.explorationConsultant || '',
    miningCompany: partial.miningCompany || '',
    drillingRigModel: partial.drillingRigModel || '',
    startDate: partial.startDate || new Date().toISOString().slice(0, 10),
    completionDate: partial.completionDate || new Date().toISOString().slice(0, 10),
    loggedBy: partial.loggedBy || '',
    purpose: partial.purpose || 'EXPLORATION',
    targetOreZone: partial.targetOreZone || '',
    cutOffGrade: partial.cutOffGrade ?? 1.5,
    primaryGradeUnit: partial.primaryGradeUnit || 'g/t Au',
    runs: partial.runs || [],
    assayIntervals: partial.assayIntervals || [],
    coreBoxPhotos: partial.coreBoxPhotos || [],
    signOff: partial.signOff || {
      contractorRepName: '',
      contractorDesignation: 'Drilling Supervisor',
      contractorCompany: partial.drillingContractor || '',
      contractorDate: new Date().toISOString().slice(0, 10),
      consultantRepName: partial.loggedBy || '',
      consultantDesignation: 'Senior Exploration Geologist',
      consultantCompany: partial.explorationConsultant || '',
      consultantDate: new Date().toISOString().slice(0, 10),
      clientRepName: '',
      clientDesignation: 'Chief Mine Geologist (Competent Person)',
      clientCompany: partial.miningCompany || '',
      clientDate: new Date().toISOString().slice(0, 10),
      remarks: '',
    },
    overallRecoveryPercent: partial.overallRecoveryPercent ?? 0,
    overallRqdPercent: partial.overallRqdPercent ?? 0,
    significantInterceptsSummary: partial.significantInterceptsSummary || 'Awaiting User Input',
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newHole, ...all];
  saveMiningDrillHoles(updated);
  setActiveMiningDrillHoleId(newHole.id);
  return newHole;
}

export function updateMiningDrillHole(id: string, updates: Partial<MiningDrillHoleRecord>): MiningDrillHoleRecord | null {
  const all = loadMiningDrillHoles();
  const idx = all.findIndex((h) => h.id === id);
  if (idx < 0) return null;

  const updatedItem: MiningDrillHoleRecord = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updatedItem;
  saveMiningDrillHoles(all);
  return updatedItem;
}

export function deleteMiningDrillHole(id: string): void {
  const all = loadMiningDrillHoles();
  const filtered = all.filter((h) => h.id !== id);
  saveMiningDrillHoles(filtered);
  if (getActiveMiningDrillHoleId() === id) {
    if (filtered.length > 0) setActiveMiningDrillHoleId(filtered[0].id);
    else localStorage.removeItem(MINING_ACTIVE_DRILLHOLE_KEY);
  }
}

// ---------------------------------------------------------------------------
// SEED INITIAL MINING DATASET (Clean Zero Pre-Fed Data Slate)
// ---------------------------------------------------------------------------

export function seedInitialMiningData(): {
  projects: MiningProjectItem[];
  stopes: MiningStopeItem[];
  drillHoles: MiningDrillHoleRecord[];
} {
  const projects: MiningProjectItem[] = [];
  const stopes: MiningStopeItem[] = [];
  const drillHoles: MiningDrillHoleRecord[] = [];

  saveMiningProjects(projects);
  saveMiningLocations([]);
  saveMiningStopes(stopes);
  saveMiningDrillHoles(drillHoles);

  try {
    localStorage.removeItem(MINING_ACTIVE_PROJECT_KEY);
    localStorage.removeItem(MINING_ACTIVE_LOCATION_KEY);
    localStorage.removeItem(MINING_ACTIVE_STOPE_KEY);
    localStorage.removeItem(MINING_ACTIVE_DRILLHOLE_KEY);
    localStorage.removeItem(MINING_VAULT_KEY);
  } catch {}

  return { projects, stopes, drillHoles };
}

// ---------------------------------------------------------------------------
// VAULT EXPORT & IMPORT
// ---------------------------------------------------------------------------

export function exportMiningVaultToJson(): string {
  const projects = loadMiningProjects();
  const stopes = loadMiningStopes();
  const drillHoles = loadMiningDrillHoles();

  const vaultData = {
    suite: 'ESWA_UNDERGROUND_MINING',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    projects,
    stopes,
    drillHoles,
  };

  return JSON.stringify(vaultData, null, 2);
}

export function importMiningVaultFromJson(jsonString: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'Invalid JSON file format.' };
    }

    if (Array.isArray(parsed.projects)) saveMiningProjects(parsed.projects);
    if (Array.isArray(parsed.stopes)) saveMiningStopes(parsed.stopes);
    if (Array.isArray(parsed.drillHoles)) saveMiningDrillHoles(parsed.drillHoles);

    return {
      success: true,
      message: `Mining vault restored: ${parsed.projects?.length || 0} projects, ${parsed.stopes?.length || 0} stopes, ${parsed.drillHoles?.length || 0} drill holes.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error parsing Mining JSON.' };
  }
}

// ---------------------------------------------------------------------------
// CORE RUNS VALIDATION & QA/QC
// ---------------------------------------------------------------------------

export interface CoreRunValidationIssue {
  runNumber: number;
  field: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export function validateCoreRuns(runs: MiningCoreRun[]): CoreRunValidationIssue[] {
  const issues: CoreRunValidationIssue[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (r.toDepthM <= r.fromDepthM) {
      issues.push({
        runNumber: r.runNumber,
        field: 'depth',
        severity: 'ERROR',
        message: `Run #${r.runNumber}: toDepth (${r.toDepthM}m) must be strictly greater than fromDepth (${r.fromDepthM}m).`,
      });
    }
    const drilled = Number((r.toDepthM - r.fromDepthM).toFixed(2));
    if (r.recoveredLengthM > drilled * 1.05) {
      issues.push({
        runNumber: r.runNumber,
        field: 'recovery',
        severity: 'WARNING',
        message: `Run #${r.runNumber}: Recovered core (${r.recoveredLengthM}m) exceeds drilled length (${drilled}m) by >5% (core expansion / block leftover).`,
      });
    }
    if (r.solidCoreLengthRqdM > r.recoveredLengthM + 0.05) {
      issues.push({
        runNumber: r.runNumber,
        field: 'rqd',
        severity: 'ERROR',
        message: `Run #${r.runNumber}: Solid RQD stick length (${r.solidCoreLengthRqdM}m) cannot exceed total recovered core (${r.recoveredLengthM}m).`,
      });
    }
    if (i > 0) {
      const prev = runs[i - 1];
      if (Math.abs(r.fromDepthM - prev.toDepthM) > 0.05) {
        if (r.fromDepthM < prev.toDepthM) {
          issues.push({
            runNumber: r.runNumber,
            field: 'depth',
            severity: 'ERROR',
            message: `Depth overlap: Run #${r.runNumber} starts at ${r.fromDepthM}m which is before Run #${prev.runNumber} ends at ${prev.toDepthM}m.`,
          });
        } else {
          issues.push({
            runNumber: r.runNumber,
            field: 'depth',
            severity: 'WARNING',
            message: `Depth gap detected: Run #${prev.runNumber} ends at ${prev.toDepthM}m, but Run #${r.runNumber} starts at ${r.fromDepthM}m (${(r.fromDepthM - prev.toDepthM).toFixed(2)}m unlogged gap).`,
          });
        }
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// DEMO FIXTURE HELPERS
// ---------------------------------------------------------------------------

export function isDemoMiningProject(id: string): boolean {
  return id === 'PRJ-MIN-001';
}

export function isDemoMiningStope(id: string): boolean {
  return id === 'STP-620-HW-04';
}

export function isDemoMiningDrillHole(id: string): boolean {
  return id === 'DH-KD-042';
}

export function clearAllMiningDemoData(): void {
  saveMiningProjects([]);
  saveMiningLocations([]);
  saveMiningStopes([]);
  saveMiningDrillHoles([]);
  try {
    localStorage.removeItem(MINING_ACTIVE_PROJECT_KEY);
    localStorage.removeItem(MINING_ACTIVE_LOCATION_KEY);
    localStorage.removeItem(MINING_ACTIVE_STOPE_KEY);
    localStorage.removeItem(MINING_ACTIVE_DRILLHOLE_KEY);
    localStorage.removeItem(MINING_VAULT_KEY);
  } catch {}
}
