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
  try {
    const raw = localStorage.getItem(MINING_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialMiningData();
  return seeded.projects;
}

export function saveMiningProjects(projects: MiningProjectItem[]): void {
  try {
    localStorage.setItem(MINING_PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Storage quota warning saving Mining projects', err);
  }
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
  try {
    const raw = localStorage.getItem(MINING_LOCATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }

  // Derive initial locations from stopes or seed
  const seeded = seedInitialMiningData();
  const initLocs: MiningLocationItem[] = seeded.stopes.map((s, idx) => ({
    id: `LOC-${s.stopeOrDriftId.replace(/[^a-zA-Z0-9]/g, '_')}-${idx}`,
    projectId: s.projectId,
    locationName: s.stopeOrDriftId,
    mineLevel: s.mineLevel,
    levelElevationMrl: s.levelElevationMrl,
    excavationType: s.excavationType,
    miningMethod: s.miningMethod,
    oreBodyName: s.oreBodyName,
    targetCutoffGrade: s.targetCutoffGrade,
    stopeShape: s.stopeShape || 'd_arch',
    stopeWidthM: s.stopeWidthM,
    stopeHeightM: s.stopeHeightM,
    wallHeightM: s.wallHeightM || s.stopeHeightM * 0.65,
    crownRadiusM: s.crownRadiusM || s.stopeWidthM / 2,
    headingDriveAzimuthDeg: s.headingDriveAzimuthDeg || 45,
    customProfilePoints: s.customProfilePoints,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  saveMiningLocations(initLocs);
  return initLocs;
}

export function saveMiningLocations(locations: MiningLocationItem[]): void {
  try {
    localStorage.setItem(MINING_LOCATIONS_KEY, JSON.stringify(locations));
  } catch (err) {
    console.warn('Storage quota warning saving Mining locations', err);
  }
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
  try {
    const raw = localStorage.getItem(MINING_STOPES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialMiningData();
  return seeded.stopes;
}

export function saveMiningStopes(stopes: MiningStopeItem[]): void {
  try {
    localStorage.setItem(MINING_STOPES_KEY, JSON.stringify(stopes));
  } catch (err) {
    console.warn('Storage quota warning saving Mining stopes', err);
  }
}

export function createMiningStope(partial: Partial<MiningStopeItem>): MiningStopeItem {
  const all = loadMiningStopes();
  const id = partial.id?.trim() || `STP-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newStope: MiningStopeItem = {
    id,
    projectId: partial.projectId || getActiveMiningProjectId() || 'PRJ-MIN-001',
    stopeOrDriftId: partial.stopeOrDriftId?.trim() || 'HW-DRV-05',
    mineLevel: partial.mineLevel?.trim() || 'Level 620 mRL',
    levelElevationMrl: partial.levelElevationMrl ?? 620,
    excavationType: partial.excavationType || 'ORE_DRIVE',
    miningMethod: partial.miningMethod || 'SUBLEVEL_OPEN_STOPING',
    oreBodyName: partial.oreBodyName?.trim() || 'Champion Quartz Lode',
    targetCutoffGrade: partial.targetCutoffGrade ?? 2.50,
    currentHeadingRdChainage: partial.currentHeadingRdChainage?.trim() || 'Cut #15',
    blastPullMeters: partial.blastPullMeters ?? 3.2,
    stopeWidthM: partial.stopeWidthM ?? 4.8,
    stopeHeightM: partial.stopeHeightM ?? 4.5,
    hangingwallDipDeg: partial.hangingwallDipDeg ?? 72,
    footwallDipDeg: partial.footwallDipDeg ?? 68,
    oreSpecificGravity: partial.oreSpecificGravity ?? 3.35,
    wasteSpecificGravity: partial.wasteSpecificGravity ?? 2.72,
    veins: partial.veins || [],
    channelSamples: partial.channelSamples || [],
    mrmr: partial.mrmr,
    mathews: partial.mathews,
    facePhotoUrl: partial.facePhotoUrl,
    muckDestinationVerdict: partial.muckDestinationVerdict || 'MILL',
    dilutedGradeCalculated: partial.dilutedGradeCalculated ?? 4.85,
    dilutionPercentCalculated: partial.dilutionPercentCalculated ?? 12.5,
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
  try {
    const raw = localStorage.getItem(MINING_DRILLHOLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  const seeded = seedInitialMiningData();
  return seeded.drillHoles;
}

export function saveMiningDrillHoles(holes: MiningDrillHoleRecord[]): void {
  try {
    localStorage.setItem(MINING_DRILLHOLES_KEY, JSON.stringify(holes));
  } catch (err) {
    console.warn('Storage quota warning saving Mining drill holes', err);
  }
}

export function createMiningDrillHole(partial: Partial<MiningDrillHoleRecord>): MiningDrillHoleRecord {
  const all = loadMiningDrillHoles();
  const id = partial.id?.trim() || `DH-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newHole: MiningDrillHoleRecord = {
    id,
    projectId: partial.projectId || getActiveMiningProjectId() || 'PRJ-MIN-001',
    holeId: partial.holeId?.trim() || `DDH-KD-${String(all.length + 43).padStart(3, '0')}`,
    holeType: partial.holeType || 'DIAMOND_CORE_DDH',
    collarEasting: partial.collarEasting ?? 48250.0,
    collarNorthing: partial.collarNorthing ?? 12500.0,
    collarElevationMrl: partial.collarElevationMrl ?? 620.0,
    collarDipDeg: partial.collarDipDeg ?? -60,
    collarAzimuthDeg: partial.collarAzimuthDeg ?? 90,
    totalDrilledDepthM: partial.totalDrilledDepthM ?? 120.0,
    coreDiameter: partial.coreDiameter || 'HQ',
    drillingContractor: partial.drillingContractor || 'Major Drilling Inc.',
    drillingRigModel: partial.drillingRigModel || 'Sandvik DE130 Underground Rig',
    startDate: partial.startDate || new Date().toISOString().slice(0, 10),
    completionDate: partial.completionDate,
    loggedBy: partial.loggedBy || 'Senior Exploration Geologist',
    purpose: partial.purpose || 'RESOURCE_INFILL',
    targetOreZone: partial.targetOreZone || 'Champion Main Lode Hangingwall Extension',
    runs: partial.runs || [],
    assayIntervals: partial.assayIntervals || [],
    overallRecoveryPercent: partial.overallRecoveryPercent ?? 96.5,
    overallRqdPercent: partial.overallRqdPercent ?? 84.0,
    significantInterceptsSummary: partial.significantInterceptsSummary || '8.5m @ 5.84 g/t Au from 42.0m',
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
// SEED INITIAL MINING DATASET (Kolar Deep Gold-Copper Mine)
// ---------------------------------------------------------------------------

export function seedInitialMiningData(): {
  projects: MiningProjectItem[];
  stopes: MiningStopeItem[];
  drillHoles: MiningDrillHoleRecord[];
} {
  const initialProject: MiningProjectItem = {
    id: 'PRJ-MIN-001',
    projectName: 'Kolar Deep Underground Gold-Copper Mine',
    mineName: 'Kolar Gold Field Lode System',
    miningCompany: 'Bharat Gold & Copper Mines Corp.',
    mineSiteLocation: 'Ooregum-Champion Shaft Complex, Level 620 mRL',
    primaryCommodity: 'Gold (Au)',
    secondaryCommodity: 'Copper (Cu) & Silver (Ag)',
    gradeUnits: 'g/t',
    mineCoordinateSystem: 'Mine Grid Local RL (Datum 1000m)',
    mineDatumLevelMrl: 1000,
    responsibleGeologist: 'Dr. V. Raghavan (Chief Mine Geologist)',
    activeMiningMethod: 'SUBLEVEL_OPEN_STOPING',
    createdAt: '2025-02-15T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const initialStope: MiningStopeItem = {
    id: 'STP-620-HW-04',
    projectId: 'PRJ-MIN-001',
    stopeOrDriftId: 'HW-DRV-04',
    mineLevel: 'Level 620 mRL',
    levelElevationMrl: 620,
    excavationType: 'ORE_DRIVE',
    miningMethod: 'SUBLEVEL_OPEN_STOPING',
    oreBodyName: 'Champion Quartz-Sulfide Lode',
    targetCutoffGrade: 2.50,
    currentHeadingRdChainage: 'Cut #14 (RD 84.5m)',
    blastPullMeters: 3.2,
    stopeWidthM: 4.8,
    stopeHeightM: 4.2,
    hangingwallDipDeg: 72,
    footwallDipDeg: 68,
    oreSpecificGravity: 3.35,
    wasteSpecificGravity: 2.72,
    veins: [],
    channelSamples: [],
    features: [],
    muckDestinationVerdict: 'MILL',
    dilutedGradeCalculated: 4.92,
    dilutionPercentCalculated: 14.2,
    responsibleGeologist: 'Dr. V. Raghavan',
    createdAt: '2025-02-18T10:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const initialDrillHoleRuns: MiningCoreRun[] = [
    {
      runNumber: 1,
      fromDepthM: 0.0,
      toDepthM: 3.0,
      drilledLengthM: 3.0,
      recoveredLengthM: 2.85,
      coreRecoveryPercent: 95.0,
      solidCoreLengthRqdM: 2.30,
      rqdPercent: 76.7,
      fracturesPerMeter: 5,
      pointLoadIs50Mpa: 4.8,
      lithology: 'Weathered Hangingwall Amphibolite',
      alteration: 'Weak Chlorite Alteration',
      mineralization: 'Trace fine pyrite (<1%)',
      veinDensityPerM: 1,
      structureType: 'FOLIATION',
      structureDipToCoreAxisDeg: 62,
      weatheringGrade: 'SLIGHT',
      geologistNotes: 'Collar run, sound recovery, blocky core',
    },
    {
      runNumber: 2,
      fromDepthM: 3.0,
      toDepthM: 6.0,
      drilledLengthM: 3.0,
      recoveredLengthM: 2.95,
      coreRecoveryPercent: 98.3,
      solidCoreLengthRqdM: 2.65,
      rqdPercent: 88.3,
      fracturesPerMeter: 3,
      pointLoadIs50Mpa: 6.5,
      lithology: 'Massive Fine-Grained Metabasalt',
      alteration: 'Silicified Margin + Epidote',
      mineralization: 'Disseminated Pyrite & Pyrrhotite (2-3%)',
      veinDensityPerM: 3,
      structureType: 'JOINT',
      structureDipToCoreAxisDeg: 45,
      weatheringGrade: 'FRESH',
      geologistNotes: 'Hard competent basalt with calcite healing',
    },
    {
      runNumber: 3,
      fromDepthM: 6.0,
      toDepthM: 9.5,
      drilledLengthM: 3.5,
      recoveredLengthM: 3.5,
      coreRecoveryPercent: 100.0,
      solidCoreLengthRqdM: 3.25,
      rqdPercent: 92.9,
      fracturesPerMeter: 2,
      pointLoadIs50Mpa: 8.2,
      lithology: 'Smoky Ribbon Quartz Lode with Sulfide Bands',
      alteration: 'Intense Silicification + Sericitic Halo',
      mineralization: 'Massive Arsenopyrite, Galena, Sphalerite & Native Gold',
      veinDensityPerM: 8,
      structureType: 'VEIN',
      structureDipToCoreAxisDeg: 72,
      weatheringGrade: 'FRESH',
      geologistNotes: 'Major Ore Intercept: Visible gold clusters in ribbon laminations',
    },
    {
      runNumber: 4,
      fromDepthM: 9.5,
      toDepthM: 13.0,
      drilledLengthM: 3.5,
      recoveredLengthM: 3.42,
      coreRecoveryPercent: 97.7,
      solidCoreLengthRqdM: 2.95,
      rqdPercent: 84.3,
      fracturesPerMeter: 4,
      pointLoadIs50Mpa: 5.9,
      lithology: 'Silicified Footwall Amphibolite Schist',
      alteration: 'Chlorite-Biotite Alteration',
      mineralization: 'Disseminated Chalcopyrite (1-2%)',
      veinDensityPerM: 2,
      structureType: 'SHEAR',
      structureDipToCoreAxisDeg: 68,
      weatheringGrade: 'FRESH',
      geologistNotes: 'Footwall contact sharp at 9.8m',
    },
  ];

  const initialAssays: MiningAssayInterval[] = [
    {
      sampleId: 'ASSAY-KD042-01',
      fromDepthM: 0.0,
      toDepthM: 3.0,
      intervalLengthM: 3.0,
      primaryAssayGrade: 0.45,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.12,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.74,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'SGS India On-Site Lab',
    },
    {
      sampleId: 'ASSAY-KD042-02',
      fromDepthM: 3.0,
      toDepthM: 6.0,
      intervalLengthM: 3.0,
      primaryAssayGrade: 1.25,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.35,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.82,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'SGS India On-Site Lab',
    },
    {
      sampleId: 'ASSAY-KD042-03',
      fromDepthM: 6.0,
      toDepthM: 9.5,
      intervalLengthM: 3.5,
      primaryAssayGrade: 9.65,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 1.85,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 3.45,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'SGS India On-Site Lab',
      certificateNumber: 'SGS-KGF-2025-0428',
    },
    {
      sampleId: 'ASSAY-KD042-STD',
      fromDepthM: 9.5,
      toDepthM: 9.5,
      intervalLengthM: 0.0,
      primaryAssayGrade: 5.02,
      primaryGradeUnit: 'g/t',
      specificGravityEstimated: 3.0,
      qaqcCategory: 'CRM_STANDARD',
      qaqcPass: true,
      assayLaboratory: 'OREAS-624 Certified Reference Material (Expected 5.05 g/t)',
    },
    {
      sampleId: 'ASSAY-KD042-04',
      fromDepthM: 9.5,
      toDepthM: 13.0,
      intervalLengthM: 3.5,
      primaryAssayGrade: 2.10,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.42,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.88,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'SGS India On-Site Lab',
    },
  ];

  const initialDrillHole: MiningDrillHoleRecord = {
    id: 'DH-KD-042',
    projectId: 'PRJ-MIN-001',
    holeId: 'DDH-KD-042',
    holeType: 'DIAMOND_CORE_DDH',
    collarEasting: 48250.0,
    collarNorthing: 12500.0,
    collarElevationMrl: 620.0,
    collarDipDeg: -60,
    collarAzimuthDeg: 90,
    totalDrilledDepthM: 120.0,
    coreDiameter: 'HQ',
    drillingContractor: 'Major Drilling International',
    drillingRigModel: 'Sandvik DE130 Underground Electro-Hydraulic Rig',
    startDate: '2025-02-10',
    completionDate: '2025-02-14',
    loggedBy: 'Dr. V. Raghavan & Exploration Team',
    purpose: 'RESOURCE_INFILL',
    targetOreZone: 'Champion Main Lode Hangingwall Extension',
    runs: initialDrillHoleRuns,
    assayIntervals: initialAssays,
    overallRecoveryPercent: 97.8,
    overallRqdPercent: 85.6,
    significantInterceptsSummary: '3.50m @ 9.65 g/t Au (and 1.85% Cu) from 6.0m to 9.5m',
    createdAt: '2025-02-10T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const projects = [initialProject];
  const stopes = [initialStope];
  const drillHoles = [initialDrillHole];

  saveMiningProjects(projects);
  saveMiningStopes(stopes);
  saveMiningDrillHoles(drillHoles);
  setActiveMiningProjectId(initialProject.id);
  setActiveMiningStopeId(initialStope.id);
  setActiveMiningDrillHoleId(initialDrillHole.id);

  // Sync with strict vault
  try {
    localStorage.setItem(
      MINING_VAULT_KEY,
      JSON.stringify({
        industryMode: 'MINING',
        projects,
        stopes,
        drillHoles,
        timestamp: new Date().toISOString(),
      })
    );
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
  const blankProject = createMiningProject({
    id: `PRJ-MIN-USER-${Date.now().toString(36).toUpperCase()}`,
    projectName: 'New Underground Mine Exploration Project',
    mineName: 'Mine Site #1',
    miningCompany: 'Operational Mining Corp.',
    mineSiteLocation: 'Underground Level 1',
    primaryCommodity: 'Gold (Au)',
    gradeUnits: 'g/t',
    mineCoordinateSystem: 'Local Mine Grid RL',
    mineDatumLevelMrl: 1000,
    responsibleGeologist: 'Mine Geologist',
    activeMiningMethod: 'SUBLEVEL_OPEN_STOPING',
  });
  saveMiningProjects([blankProject]);
  setActiveMiningProjectId(blankProject.id);

  const blankStope = createMiningStope({
    id: `STP-USER-${Date.now().toString(36).toUpperCase()}`,
    projectId: blankProject.id,
    stopeOrDriftId: 'DRV-01',
    mineLevel: 'Level 100 mRL',
    levelElevationMrl: 100,
    excavationType: 'ORE_DRIVE',
    miningMethod: 'SUBLEVEL_OPEN_STOPING',
    oreBodyName: 'Main Mineralized Zone',
    targetCutoffGrade: 2.00,
    currentHeadingRdChainage: 'Heading 01',
    blastPullMeters: 3.0,
    stopeWidthM: 4.5,
    stopeHeightM: 4.0,
    hangingwallDipDeg: 70,
    footwallDipDeg: 65,
    oreSpecificGravity: 3.0,
    wasteSpecificGravity: 2.7,
    veins: [],
    channelSamples: [],
    features: [],
  });
  saveMiningStopes([blankStope]);
  setActiveMiningStopeId(blankStope.id);

  const blankHole = createMiningDrillHole({
    id: `DH-USER-${Date.now().toString(36).toUpperCase()}`,
    projectId: blankProject.id,
    holeId: 'DDH-001',
    holeType: 'DIAMOND_CORE_DDH',
    collarEasting: 1000.0,
    collarNorthing: 1000.0,
    collarElevationMrl: 100.0,
    collarDipDeg: -60,
    collarAzimuthDeg: 90,
    totalDrilledDepthM: 50.0,
    coreDiameter: 'HQ',
    drillingContractor: 'Site Drilling',
    drillingRigModel: 'Underground Diamond Rig',
    loggedBy: 'Mine Geologist',
    purpose: 'EXPLORATION',
    targetOreZone: 'Target 1',
    runs: [],
    assayIntervals: [],
    overallRecoveryPercent: 0,
    overallRqdPercent: 0,
    significantInterceptsSummary: 'No runs recorded yet',
  });
  saveMiningDrillHoles([blankHole]);
  setActiveMiningDrillHoleId(blankHole.id);
}
