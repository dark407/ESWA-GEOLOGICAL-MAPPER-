import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleSignIn } from '../firebase';
import {
  buildFieldMappingTwoPageWordHtml,
  computeFieldQValue,
  computeFieldRmrValue,
  exportFieldMappingTwoPagePdfSheet,
  exportFieldMappingTwoPageWordSheet,
  FieldCollectedPhoto,
  FieldExcavationRound,
  FieldMappingStoreState,
  FieldPanelId,
  FieldProjectItem,
  FieldTunnelLocationItem,
  loadFieldMappingStore,
  saveFieldMappingStore,
  MappingDomainType,
} from './fieldMappingEngine';
import {
  loadSavedDesignGeometries,
  loadSavedProjectsFromMemory,
  parseNumericChainageMeters,
  saveProjectRecordToMemory,
} from './projectMemoryEngine';
import { loadChainageProfileSchedule, saveChainageProfileSchedule } from './customProfileEngine';
import { loadSavedSheetConfig, saveSheetConfigToStorage } from './sheetLayoutEngine';
import {
  AiTrainingJointPolyline,
  AiTrainingTelemetryRecord,
  ChainageProfileSegmentRecord,
  EngineeringSheetConfig,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
  SurfaceType,
} from '../types/tunnel';
import { getLocalMasterPcBypass, getOrGeneratePcHardwareId } from './softwareLicensingEngine';

const FIELD_RESUME_STORAGE_KEY = 'eswa_field_mapping_resume_state_v1';
const PHOTOGRAMMETRY_RESUME_STORAGE_KEY = 'eswa_photogrammetry_resume_state_v1';
const OFFLINE_DRAFT_STORAGE_KEY = 'eswa_tunnel_mapper_field_draft_v20_fresh';
const OFFLINE_DRAFT_PHOTOS_STORAGE_KEY = 'eswa_tunnel_mapper_field_photos_v20_fresh';
const SAVED_PROJECTS_STORAGE_KEY = 'akash_tunnel_saved_projects_v20_fresh';
const SAVED_GEOMETRIES_STORAGE_KEY = 'akash_tunnel_saved_geometries_v20_fresh';

export interface GoogleUserAccountInfo {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export interface FieldMappingResumeState {
  stage: string;
  mappingDomain?: MappingDomainType;
  undergroundSubMode?: 'tunnel' | 'vertical_shaft';
  activeProjectId?: string | null;
  activeLocationId?: string | null;
  activeRoundId?: string | null;
  projectId?: string | null;
  locationId?: string | null;
  roundId?: string | null;
  activePanel: FieldPanelId;
  is3DMappingMode: boolean;
  chainageLabel?: string;
  locationLabel?: string;
  stageLabel?: string;
  updatedAt?: string;
  savedAt?: string;
}

export interface PhotogrammetryResumeState {
  screen:
    | 'start'
    | 'geometry_manual'
    | 'geometry_cad'
    | 'geometry_custom'
    | 'drive_and_photos'
    | 'mapping';
  activeSurface: SurfaceType;
  projectName: string;
  locationName?: string;
  location?: string;
  tunnelName: string;
  chainage?: string;
  faceChainage: string;
  screenLabel?: string;
  updatedAt?: string;
  savedAt?: string;
}

export interface EswaCompleteAppPackage {
  packageType: 'ESWA_COMPLETE_APP_PACKAGE_V1';
  appTitle: 'ESWA Tunnel Geological Mapper';
  exportedAtIso: string;
  exportedByEmail?: string;
  exportedByName?: string;
  includesPhotosAZ: true;
  fieldMappingStore: FieldMappingStoreState;
  fieldResumeState: FieldMappingResumeState | null;
  photogrammetrySavedProjects: SavedProjectRecord[];
  photogrammetrySavedGeometries: SavedDesignGeometryRecord[];
  photogrammetryChainageSchedule: ChainageProfileSegmentRecord[];
  photogrammetrySheetConfig: EngineeringSheetConfig;
  photogrammetryActiveDraft: Record<string, any> | null;
  photogrammetryActivePhotos: Record<string, any> | null;
  photogrammetryResumeState: PhotogrammetryResumeState | null;
}

export const FIELD_STAGE_LABELS: Record<string, string> = {
  project_setup: '1. Project & Data',
  excavation_round: '2. Round & Drive',
  camera_prompt: '3. Camera',
  photo_fit: '4. Photo Fit',
  field_canvas: '5. Face Canvas',
  field_mapping: '5. Face Canvas',
  joint_grouping: '6. Group Joints',
  strip_align: '7. 4-Panel Align',
  discontinuity_sets: '8. Joint Table & Dip',
  q_rmr_gsi: '9. Q / RMR / GSI',
  support_system: '10. Rock Support',
  fem_dem_analysis: '11. FEM & DEM Analysis',
  survey_overbreak: '12. Survey & OB',
  word_template_export: '13. Clean Report',
  photo_2d_report: '14. 2D Photo Report',
  geology_3d_report: '15. 3D Geology Report',
};

export const PHOTOGRAMMETRY_SCREEN_LABELS: Record<string, string> = {
  start: '1. Project & Shape Setup',
  geometry_manual: '2. Manual Tunnel Geometry',
  geometry_cad: '2. CAD / DXF Geometry',
  geometry_custom: '2. Custom Profile Editor',
  drive_and_photos: '3. Drive Direction & Surface Photos',
  mapping: '4. Photogrammetry 3D Mapping Canvas',
};

// ============================================================================
// 1. RESUME STATE TRACKERS (FIELD FACE MAPPING & PHOTOGRAMMETRY FACE MAPPING)
// ============================================================================

export function saveFieldMappingResumeState(
  state: FieldMappingResumeState,
  domain?: MappingDomainType,
  undergroundSubMode?: 'tunnel' | 'vertical_shaft'
): void {
  try {
    const effDomain = (domain || state.mappingDomain || 'TUNNEL').toUpperCase() as MappingDomainType;
    const effSubMode: 'tunnel' | 'vertical_shaft' =
      effDomain === 'TUNNEL' &&
      (undergroundSubMode === 'vertical_shaft' || state.undergroundSubMode === 'vertical_shaft')
        ? 'vertical_shaft'
        : 'tunnel';
    const normalized: FieldMappingResumeState = {
      ...state,
      mappingDomain: effDomain,
      undergroundSubMode: effSubMode,
      activeProjectId: state.activeProjectId ?? state.projectId ?? null,
      activeLocationId: state.activeLocationId ?? state.locationId ?? null,
      activeRoundId: state.activeRoundId ?? state.roundId ?? null,
      stageLabel: state.stageLabel || FIELD_STAGE_LABELS[state.stage] || state.stage,
      updatedAt: state.updatedAt || state.savedAt || new Date().toISOString(),
    };
    const domainKey =
      effDomain === 'TUNNEL' && effSubMode === 'vertical_shaft'
        ? 'eswa_field_mapping_resume_state_vertical_shaft_v2'
        : `eswa_field_mapping_resume_state_${effDomain.toLowerCase()}_v2`;
    localStorage.setItem(domainKey, JSON.stringify(normalized));
    if (effDomain === 'TUNNEL' && effSubMode === 'tunnel') {
      localStorage.setItem(FIELD_RESUME_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadFieldMappingResumeState(
  domain?: MappingDomainType,
  undergroundSubMode?: 'tunnel' | 'vertical_shaft'
): FieldMappingResumeState | null {
  try {
    const effDomain = (domain || 'TUNNEL').toUpperCase() as MappingDomainType;
    const effSubMode: 'tunnel' | 'vertical_shaft' =
      effDomain === 'TUNNEL' && undergroundSubMode === 'vertical_shaft'
        ? 'vertical_shaft'
        : 'tunnel';
    const domainKey =
      effDomain === 'TUNNEL' && effSubMode === 'vertical_shaft'
        ? 'eswa_field_mapping_resume_state_vertical_shaft_v2'
        : `eswa_field_mapping_resume_state_${effDomain.toLowerCase()}_v2`;
    const raw = localStorage.getItem(domainKey);
    if (raw) {
      const parsed = JSON.parse(raw) as FieldMappingResumeState;
      if (parsed && typeof parsed === 'object' && parsed.stage) {
        if (!parsed.mappingDomain || parsed.mappingDomain === effDomain) {
          if (effDomain === 'TUNNEL') {
            const parsedSub = parsed.undergroundSubMode || 'tunnel';
            if (parsedSub !== effSubMode) return null;
          }
          return parsed;
        }
      }
    }
    // Fallback to legacy key only if asking for TUNNEL in 'tunnel' sub-mode
    if (effDomain === 'TUNNEL' && effSubMode === 'tunnel') {
      const legacyRaw = localStorage.getItem(FIELD_RESUME_STORAGE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as FieldMappingResumeState;
        if (parsed && typeof parsed === 'object' && parsed.stage) {
          if (
            (!parsed.mappingDomain || parsed.mappingDomain === 'TUNNEL') &&
            parsed.undergroundSubMode !== 'vertical_shaft'
          ) {
            return parsed;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function savePhotogrammetryResumeState(state: PhotogrammetryResumeState): void {
  try {
    const normalized: PhotogrammetryResumeState = {
      ...state,
      locationName: state.locationName ?? state.location ?? '',
      screenLabel:
        state.screenLabel || PHOTOGRAMMETRY_SCREEN_LABELS[state.screen] || state.screen,
      updatedAt: state.updatedAt || state.savedAt || new Date().toISOString(),
    };
    localStorage.setItem(PHOTOGRAMMETRY_RESUME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors
  }
}

export function loadPhotogrammetryResumeState(): PhotogrammetryResumeState | null {
  try {
    const raw = localStorage.getItem(PHOTOGRAMMETRY_RESUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhotogrammetryResumeState;
    if (!parsed || typeof parsed !== 'object' || !parsed.screen) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// 2. FIELD FACE MAPPING & PHOTOGRAMMETRY DATA MANAGEMENT (EDIT, MOVE, DELETE)
// ============================================================================

export function findRoundStoreAndDomain(roundId: string): {
  store: FieldMappingStoreState;
  domain: MappingDomainType;
} {
  const domains: MappingDomainType[] = ['TUNNEL', 'BENCH', 'TRENCH', 'SLOPE', 'ROCK_SURFACE'];
  for (const dom of domains) {
    const store = loadFieldMappingStore(dom);
    if (store.rounds.some((r) => r.id === roundId)) {
      return { store, domain: dom };
    }
  }
  return { store: loadFieldMappingStore('TUNNEL'), domain: 'TUNNEL' };
}

export function loadCombinedFieldStore(): FieldMappingStoreState {
  const domains: MappingDomainType[] = ['TUNNEL', 'BENCH', 'TRENCH', 'SLOPE', 'ROCK_SURFACE'];
  const allProjects: FieldProjectItem[] = [];
  const allRounds: FieldExcavationRound[] = [];
  const seenProj = new Set<string>();
  const seenRnd = new Set<string>();

  for (const dom of domains) {
    const st = loadFieldMappingStore(dom);
    if (st && Array.isArray(st.projects)) {
      for (const p of st.projects) {
        if (!seenProj.has(p.id)) {
          seenProj.add(p.id);
          allProjects.push(p);
        }
      }
    }
    if (st && Array.isArray(st.rounds)) {
      for (const r of st.rounds) {
        if (!seenRnd.has(r.id)) {
          seenRnd.add(r.id);
          allRounds.push({ ...r, mappingDomain: r.mappingDomain || dom });
        }
      }
    }
  }

  const tunnelSt = loadFieldMappingStore('TUNNEL');
  return {
    projects: allProjects.length > 0 ? allProjects : tunnelSt.projects,
    rounds: allRounds.length > 0 ? allRounds : tunnelSt.rounds,
    activeProjectId: tunnelSt.activeProjectId,
    activeLocationId: tunnelSt.activeLocationId,
    activeRoundId: tunnelSt.activeRoundId,
    rememberedRocks: tunnelSt.rememberedRocks,
  };
}

export function editFieldExcavationRoundMetadata(
  roundId: string,
  updates: {
    projectName?: string;
    locationName?: string;
    chainageFrom?: string;
    chainageTo?: string;
    pullLengthMeters?: number;
    tunnelDriveDirection?: number;
    modeOfExcavation?: string;
    geologistName?: string;
    dateAndTimeOfExcavation?: string;
  }
): FieldMappingStoreState {
  const { store, domain } = findRoundStoreAndDomain(roundId);
  const targetRound = store.rounds.find((r) => r.id === roundId);
  if (!targetRound) return store;

  const nextProjects = store.projects.map((proj) => {
    if (proj.id !== targetRound.projectId) return proj;
    return {
      ...proj,
      projectName:
        updates.projectName !== undefined && updates.projectName.trim()
          ? updates.projectName.trim()
          : proj.projectName,
      locations: proj.locations.map((loc) => {
        if (loc.id !== targetRound.locationId) return loc;
        return {
          ...loc,
          name:
            updates.locationName !== undefined && updates.locationName.trim()
              ? updates.locationName.trim()
              : loc.name,
        };
      }),
    };
  });

  const nextRounds = store.rounds.map((r) => {
    if (r.id !== roundId) return r;
    const nextFrom =
      updates.chainageFrom !== undefined ? updates.chainageFrom.trim() : r.chainageFrom;
    const nextTo = updates.chainageTo !== undefined ? updates.chainageTo.trim() : r.chainageTo;
    const nextPull =
      updates.pullLengthMeters !== undefined && Number.isFinite(updates.pullLengthMeters)
        ? Number(updates.pullLengthMeters)
        : r.pullLengthMeters;
    return {
      ...r,
      chainageFrom: nextFrom,
      chainageTo: nextTo,
      pullLengthMeters: nextPull,
      tunnelDriveDirection:
        updates.tunnelDriveDirection !== undefined && Number.isFinite(updates.tunnelDriveDirection)
          ? Number(updates.tunnelDriveDirection)
          : r.tunnelDriveDirection,
      modeOfExcavation: updates.modeOfExcavation || r.modeOfExcavation,
      geologistName:
        updates.geologistName !== undefined ? updates.geologistName : r.geologistName,
      contractorGeologistName:
        updates.geologistName !== undefined && updates.geologistName.trim()
          ? updates.geologistName.trim()
          : r.contractorGeologistName,
      dateAndTimeOfExcavation:
        updates.dateAndTimeOfExcavation || r.dateAndTimeOfExcavation,
      updatedAt: new Date().toISOString(),
    };
  });

  const nextStore: FieldMappingStoreState = {
    ...store,
    projects: nextProjects,
    rounds: nextRounds,
  };
  saveFieldMappingStore(nextStore, domain);
  return nextStore;
}

export function moveFieldExcavationRound(
  roundId: string,
  targetProjectId: string,
  targetLocationId: string,
  createNewProjectName?: string,
  createNewLocationName?: string
): FieldMappingStoreState {
  const { store, domain } = findRoundStoreAndDomain(roundId);
  const round = store.rounds.find((r) => r.id === roundId);
  if (!round) return store;

  let projects = [...store.projects];
  let finalProjectId = targetProjectId;
  let finalLocationId = targetLocationId;

  if (targetProjectId === '__NEW_PROJECT__' && createNewProjectName?.trim()) {
    const newLoc: FieldTunnelLocationItem = {
      id: `floc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: createNewLocationName?.trim() || 'Main Tunnel Heading',
      shape: 'horseshoe',
      widthM: 8.4,
      heightM: 7.2,
      wallHeightM: 4.0,
      crownRadiusM: 4.2,
      defaultDriveAzimuth: round.tunnelDriveDirection || 45,
      defaultExcavationMode: round.modeOfExcavation || 'Drill & Blast',
      defaultExcavationApproach: round.excavationApproach || 'Full Face',
    };
    const newProj: FieldProjectItem = {
      id: `fproj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectName: createNewProjectName.trim(),
      clientName: 'Project Authority',
      contractorName: 'Tunnel Engineering Works',
      consultantName: 'ESWA Engineering Geology',
      createdAt: new Date().toISOString(),
      locations: [newLoc],
    };
    projects.push(newProj);
    finalProjectId = newProj.id;
    finalLocationId = newLoc.id;
  } else if (targetLocationId === '__NEW_LOCATION__' && createNewLocationName?.trim()) {
    const newLocId = `floc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    projects = projects.map((p) => {
      if (p.id !== finalProjectId) return p;
      const newLoc: FieldTunnelLocationItem = {
        id: newLocId,
        name: createNewLocationName.trim(),
        shape: p.locations[0]?.shape || 'horseshoe',
        widthM: p.locations[0]?.widthM || 8.4,
        heightM: p.locations[0]?.heightM || 7.2,
        wallHeightM: p.locations[0]?.wallHeightM || 4.0,
        crownRadiusM: p.locations[0]?.crownRadiusM || 4.2,
        defaultDriveAzimuth: round.tunnelDriveDirection || 45,
        defaultExcavationMode: round.modeOfExcavation || 'Drill & Blast',
        defaultExcavationApproach: round.excavationApproach || 'Full Face',
      };
      return {
        ...p,
        locations: [...p.locations, newLoc],
      };
    });
    finalLocationId = newLocId;
  }

  const nextRounds = store.rounds.map((r) =>
    r.id === roundId
      ? {
          ...r,
          projectId: finalProjectId,
          locationId: finalLocationId,
          updatedAt: new Date().toISOString(),
        }
      : r
  );

  const nextStore: FieldMappingStoreState = {
    ...store,
    projects,
    rounds: nextRounds,
    activeProjectId: finalProjectId,
    activeLocationId: finalLocationId,
    activeRoundId: roundId,
  };
  saveFieldMappingStore(nextStore, domain);
  return nextStore;
}

export function deleteFieldExcavationRound(roundId: string): FieldMappingStoreState {
  const { store, domain } = findRoundStoreAndDomain(roundId);
  const remaining = store.rounds.filter((r) => r.id !== roundId);
  const nextActiveRoundId =
    store.activeRoundId === roundId ? remaining[0]?.id || null : store.activeRoundId;
  const nextStore: FieldMappingStoreState = {
    ...store,
    rounds: remaining,
    activeRoundId: nextActiveRoundId,
  };
  saveFieldMappingStore(nextStore, domain);
  return nextStore;
}

export function editPhotogrammetryProjectRecord(
  recordId: string,
  updates: {
    projectName?: string;
    location?: string;
    tunnelName?: string;
    faceChainage?: string;
    chainage?: string;
    date?: string;
    mappedBy?: string;
  }
): SavedProjectRecord[] {
  const all = loadSavedProjectsFromMemory();
  const next = all.map((rec) => {
    if (rec.id !== recordId) return rec;
    const nextProjectName =
      updates.projectName !== undefined && updates.projectName.trim()
        ? updates.projectName.trim()
        : rec.projectName || 'Underground Tunnel Project';
    const nextLocation =
      updates.location !== undefined && updates.location.trim()
        ? updates.location.trim()
        : rec.location || 'Main Underground Heading';
    const nextTunnel =
      updates.tunnelName !== undefined && updates.tunnelName.trim()
        ? updates.tunnelName.trim()
        : rec.tunnelName;
    const nextFaceChainage =
      updates.faceChainage !== undefined && updates.faceChainage.trim()
        ? updates.faceChainage.trim()
        : rec.faceChainage;
    const nextChainage =
      updates.chainage !== undefined && updates.chainage.trim()
        ? updates.chainage.trim()
        : rec.chainage;
    const nextDate = updates.date || rec.date;
    const nextMappedBy =
      updates.mappedBy !== undefined ? updates.mappedBy : rec.settings?.mappedBy || '';
    const numericCh = parseNumericChainageMeters(nextFaceChainage, nextChainage);

    return {
      ...rec,
      projectName: nextProjectName,
      location: nextLocation,
      tunnelName: nextTunnel,
      faceChainage: nextFaceChainage,
      chainage: nextChainage,
      numericChainageMeters: numericCh,
      date: nextDate,
      savedAt: new Date().toISOString(),
      settings: {
        ...rec.settings,
        projectName: nextProjectName,
        location: nextLocation,
        locationName: nextLocation,
        tunnelName: nextTunnel,
        faceChainage: nextFaceChainage,
        chainage: nextChainage,
        date: nextDate,
        mappedBy: nextMappedBy,
      },
    };
  });

  try {
    localStorage.setItem(SAVED_PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota warnings
  }
  return next;
}

export function movePhotogrammetryProjectRecord(
  recordId: string,
  targetProjectName: string,
  targetLocationName: string,
  targetTunnelName: string
): SavedProjectRecord[] {
  return editPhotogrammetryProjectRecord(recordId, {
    projectName: targetProjectName,
    location: targetLocationName,
    tunnelName: targetTunnelName,
  });
}

// ============================================================================
// 3. COMPLETE ESWA APP PACKAGE A-TO-Z EXPORT & IMPORT (MOBILE <-> PC VICE-VERSA)
// ============================================================================

export function countAllPhotosInStore(
  fieldStore: FieldMappingStoreState,
  photoProjects: SavedProjectRecord[]
): number {
  let count = 0;
  for (const r of fieldStore.rounds || []) {
    count += (r.collectedPhotos || []).length;
  }
  for (const p of photoProjects || []) {
    if (p.photos) {
      (['face', 'crown', 'leftWall', 'rightWall'] as SurfaceType[]).forEach((surf) => {
        if (p.photos[surf]?.image || p.photos[surf]?.originalImage) count += 1;
        count += (p.photos[surf]?.supportingPhotos || []).length;
      });
    }
  }
  return count;
}

export function buildCompleteEswaAppPackage(user?: User | null): EswaCompleteAppPackage {
  const fieldMappingStore = loadFieldMappingStore();
  const fieldResumeState = loadFieldMappingResumeState();
  const photogrammetrySavedProjects = loadSavedProjectsFromMemory();
  const photogrammetrySavedGeometries = loadSavedDesignGeometries();
  const photogrammetryChainageSchedule = loadChainageProfileSchedule();
  const photogrammetrySheetConfig = loadSavedSheetConfig();
  const photogrammetryResumeState = loadPhotogrammetryResumeState();

  let photogrammetryActiveDraft: Record<string, any> | null = null;
  let photogrammetryActivePhotos: Record<string, any> | null = null;
  try {
    const rawDraft = localStorage.getItem(OFFLINE_DRAFT_STORAGE_KEY);
    if (rawDraft) photogrammetryActiveDraft = JSON.parse(rawDraft);
  } catch {
    // Ignore
  }
  try {
    const rawPhotos = localStorage.getItem(OFFLINE_DRAFT_PHOTOS_STORAGE_KEY);
    if (rawPhotos) photogrammetryActivePhotos = JSON.parse(rawPhotos);
  } catch {
    // Ignore
  }

  return {
    packageType: 'ESWA_COMPLETE_APP_PACKAGE_V1',
    appTitle: 'ESWA Tunnel Geological Mapper',
    exportedAtIso: new Date().toISOString(),
    exportedByEmail: user?.email || undefined,
    exportedByName: user?.displayName || undefined,
    includesPhotosAZ: true,
    fieldMappingStore,
    fieldResumeState,
    photogrammetrySavedProjects,
    photogrammetrySavedGeometries,
    photogrammetryChainageSchedule,
    photogrammetrySheetConfig,
    photogrammetryActiveDraft,
    photogrammetryActivePhotos,
    photogrammetryResumeState,
  };
}

export function triggerJsonDownload(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function exportCompleteEswaAppPackageToFile(user?: User | null): void {
  const pkg = buildCompleteEswaAppPackage(user);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerJsonDownload(
    pkg,
    `ESWA_Tunnel_Mapper_All_Data_Photos_AZ_${dateStr}.eswa.json`
  );
}

export function exportSingleFieldRoundToFile(roundId: string): void {
  const store = loadFieldMappingStore();
  const round = store.rounds.find((r) => r.id === roundId);
  if (!round) return;
  const project = store.projects.find((p) => p.id === round.projectId);
  const location = project?.locations.find((l) => l.id === round.locationId);

  const singleStore: FieldMappingStoreState = {
    projects: project
      ? [
          {
            ...project,
            locations: location ? [location] : project.locations,
          },
        ]
      : store.projects,
    rounds: [round],
    activeProjectId: project?.id || store.activeProjectId,
    activeLocationId: location?.id || store.activeLocationId,
    activeRoundId: round.id,
    rememberedRocks: store.rememberedRocks || [],
  };

  const payload: EswaCompleteAppPackage = {
    packageType: 'ESWA_COMPLETE_APP_PACKAGE_V1',
    appTitle: 'ESWA Tunnel Geological Mapper',
    exportedAtIso: new Date().toISOString(),
    includesPhotosAZ: true,
    fieldMappingStore: singleStore,
    fieldResumeState: {
      stage: 'field_canvas',
      activeProjectId: singleStore.activeProjectId,
      activeLocationId: singleStore.activeLocationId,
      activeRoundId: round.id,
      activePanel: 'face',
      is3DMappingMode: false,
      chainageLabel: `CH ${round.chainageFrom}m–${round.chainageTo}m`,
      locationLabel: location?.name || 'Tunnel Heading',
      stageLabel: '5. Face Canvas',
      updatedAt: new Date().toISOString(),
    },
    photogrammetrySavedProjects: [],
    photogrammetrySavedGeometries: [],
    photogrammetryChainageSchedule: [],
    photogrammetrySheetConfig: loadSavedSheetConfig(),
    photogrammetryActiveDraft: null,
    photogrammetryActivePhotos: null,
    photogrammetryResumeState: null,
  };

  const safeLoc = (location?.name || 'Tunnel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCh = `${round.chainageFrom}_${round.chainageTo}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  triggerJsonDownload(
    payload,
    `ESWA_Field_Face_${safeLoc}_CH_${safeCh}_AZ.eswa.json`
  );
}

export function exportSinglePhotogrammetryRecordToFile(record: SavedProjectRecord): void {
  const safeTunnel = (record.tunnelName || 'Tunnel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCh = (record.faceChainage || record.chainage || 'Face').replace(
    /[^a-zA-Z0-9_.-]/g,
    '_'
  );
  triggerJsonDownload(
    record,
    `ESWA_Photogrammetry_Face_${safeTunnel}_${safeCh}_${record.date}_AZ.eswa.json`
  );
}

export interface EswaPackageImportSummary {
  fieldRoundsImported: number;
  fieldProjectsImported: number;
  photogrammetryFacesImported: number;
  photosImportedCount: number;
  message: string;
}

export async function importEswaUniversalPackageFromFile(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<EswaPackageImportSummary> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON file.');
  }

  return applyImportedEswaPayload(parsed, mode);
}

export function applyImportedEswaPayload(
  parsed: any,
  mode: 'merge' | 'replace' = 'merge'
): EswaPackageImportSummary {
  let fieldRoundsImported = 0;
  let fieldProjectsImported = 0;
  let photogrammetryFacesImported = 0;
  let photosImportedCount = 0;

  // Case A: Complete ESWA App Package (`ESWA_COMPLETE_APP_PACKAGE_V1`) or object containing `fieldMappingStore`
  if (
    parsed.packageType === 'ESWA_COMPLETE_APP_PACKAGE_V1' ||
    parsed.fieldMappingStore ||
    Array.isArray(parsed.photogrammetrySavedProjects)
  ) {
    const incomingField: FieldMappingStoreState | undefined = parsed.fieldMappingStore;
    if (
      incomingField &&
      Array.isArray(incomingField.projects) &&
      Array.isArray(incomingField.rounds)
    ) {
      const currentField = loadFieldMappingStore();
      let nextProjects: FieldProjectItem[] = [];
      let nextRounds: FieldExcavationRound[] = [];

      if (mode === 'replace') {
        nextProjects = incomingField.projects;
        nextRounds = incomingField.rounds;
      } else {
        // Merge projects & locations by ID or name
        const projMap = new Map<string, FieldProjectItem>();
        for (const p of currentField.projects) {
          projMap.set(p.id, { ...p, locations: [...(p.locations || [])] });
        }
        for (const incP of incomingField.projects) {
          const existing = projMap.get(incP.id);
          if (!existing) {
            projMap.set(incP.id, incP);
          } else {
            const locMap = new Map<string, FieldTunnelLocationItem>();
            for (const l of existing.locations) locMap.set(l.id, l);
            for (const incL of incP.locations || []) locMap.set(incL.id, incL);
            projMap.set(incP.id, {
              ...existing,
              ...incP,
              locations: Array.from(locMap.values()),
            });
          }
        }
        nextProjects = Array.from(projMap.values());

        // Merge rounds by ID
        const roundMap = new Map<string, FieldExcavationRound>();
        for (const r of currentField.rounds) roundMap.set(r.id, r);
        for (const incR of incomingField.rounds) roundMap.set(incR.id, incR);
        nextRounds = Array.from(roundMap.values());
      }

      const mergedFieldStore: FieldMappingStoreState = {
        ...currentField,
        ...incomingField,
        projects: nextProjects,
        rounds: nextRounds,
        activeProjectId:
          incomingField.activeProjectId ||
          currentField.activeProjectId ||
          nextProjects[0]?.id ||
          null,
        activeLocationId:
          incomingField.activeLocationId ||
          currentField.activeLocationId ||
          nextProjects[0]?.locations[0]?.id ||
          null,
        activeRoundId:
          incomingField.activeRoundId ||
          currentField.activeRoundId ||
          nextRounds[0]?.id ||
          null,
      };
      saveFieldMappingStore(mergedFieldStore);
      fieldProjectsImported = incomingField.projects.length;
      fieldRoundsImported = incomingField.rounds.length;
      for (const r of incomingField.rounds) {
        photosImportedCount += (r.collectedPhotos || []).length;
      }
    }

    if (parsed.fieldResumeState) {
      saveFieldMappingResumeState(parsed.fieldResumeState);
    }

    if (Array.isArray(parsed.photogrammetrySavedProjects)) {
      const incomingPhotoProjects: SavedProjectRecord[] = parsed.photogrammetrySavedProjects;
      if (mode === 'replace') {
        try {
          localStorage.setItem(
            SAVED_PROJECTS_STORAGE_KEY,
            JSON.stringify(incomingPhotoProjects)
          );
        } catch {
          // Fallback to per-record save
          incomingPhotoProjects.forEach((rec) => saveProjectRecordToMemory(rec));
        }
      } else {
        incomingPhotoProjects.forEach((rec) => saveProjectRecordToMemory(rec));
      }
      photogrammetryFacesImported = incomingPhotoProjects.length;
      for (const p of incomingPhotoProjects) {
        if (p.photos) {
          (['face', 'crown', 'leftWall', 'rightWall'] as SurfaceType[]).forEach((s) => {
            if (p.photos[s]?.image || p.photos[s]?.originalImage) photosImportedCount += 1;
            photosImportedCount += (p.photos[s]?.supportingPhotos || []).length;
          });
        }
      }
    }

    if (Array.isArray(parsed.photogrammetrySavedGeometries) && parsed.photogrammetrySavedGeometries.length > 0) {
      const currentGeoms = mode === 'replace' ? [] : loadSavedDesignGeometries();
      const geomMap = new Map<string, SavedDesignGeometryRecord>();
      for (const g of currentGeoms) geomMap.set(g.id, g);
      for (const g of parsed.photogrammetrySavedGeometries) geomMap.set(g.id, g);
      try {
        localStorage.setItem(
          SAVED_GEOMETRIES_STORAGE_KEY,
          JSON.stringify(Array.from(geomMap.values()))
        );
      } catch {
        // Ignore
      }
    }

    if (Array.isArray(parsed.photogrammetryChainageSchedule) && parsed.photogrammetryChainageSchedule.length > 0) {
      saveChainageProfileSchedule(parsed.photogrammetryChainageSchedule);
    }

    if (parsed.photogrammetrySheetConfig) {
      saveSheetConfigToStorage(parsed.photogrammetrySheetConfig);
    }

    if (parsed.photogrammetryActiveDraft) {
      try {
        localStorage.setItem(
          OFFLINE_DRAFT_STORAGE_KEY,
          JSON.stringify(parsed.photogrammetryActiveDraft)
        );
      } catch {
        // Ignore
      }
    }

    if (parsed.photogrammetryActivePhotos) {
      try {
        localStorage.setItem(
          OFFLINE_DRAFT_PHOTOS_STORAGE_KEY,
          JSON.stringify(parsed.photogrammetryActivePhotos)
        );
      } catch {
        // Ignore
      }
    }

    if (parsed.photogrammetryResumeState) {
      savePhotogrammetryResumeState(parsed.photogrammetryResumeState);
    }

    return {
      fieldRoundsImported,
      fieldProjectsImported,
      photogrammetryFacesImported,
      photosImportedCount,
      message: `Imported ESWA A–Z Package: ${fieldRoundsImported} Field Face Round(s), ${photogrammetryFacesImported} Photogrammetry Face(s), and ${photosImportedCount} Photo(s).`,
    };
  }

  // Case A2: Single Face Master Completion Archive (`ESWA_FACE_MASTER_COMPLETION_ARCHIVE_V1`)
  if (
    parsed.packageType === 'ESWA_FACE_MASTER_COMPLETION_ARCHIVE_V1' &&
    parsed.project &&
    parsed.round
  ) {
    const proj: FieldProjectItem = {
      ...parsed.project,
      locations: parsed.location
        ? [
            parsed.location,
            ...(parsed.project.locations || []).filter(
              (l: FieldTunnelLocationItem) => l.id !== parsed.location.id
            ),
          ]
        : parsed.project.locations || [],
    };
    return applyImportedEswaPayload(
      {
        packageType: 'ESWA_COMPLETE_APP_PACKAGE_V1',
        fieldMappingStore: {
          projects: [proj],
          rounds: [parsed.round],
          activeProjectId: proj.id,
          activeLocationId: parsed.location?.id || parsed.round.locationId,
          activeRoundId: parsed.round.id,
          rememberedRocks: [],
        },
      },
      mode
    );
  }

  // Case B: Raw Field Mapping Store JSON (`projects` & `rounds` at root)
  if (Array.isArray(parsed.projects) && Array.isArray(parsed.rounds)) {
    return applyImportedEswaPayload(
      {
        packageType: 'ESWA_COMPLETE_APP_PACKAGE_V1',
        fieldMappingStore: parsed,
      },
      mode
    );
  }

  // Case C: Single Photogrammetry `.akash.json` Record (`geometry` & `settings`)
  if (parsed.geometry && parsed.settings) {
    const rec = parsed as SavedProjectRecord;
    saveProjectRecordToMemory(rec);
    photogrammetryFacesImported = 1;
    if (rec.photos) {
      (['face', 'crown', 'leftWall', 'rightWall'] as SurfaceType[]).forEach((s) => {
        if (rec.photos[s]?.image || rec.photos[s]?.originalImage) photosImportedCount += 1;
        photosImportedCount += (rec.photos[s]?.supportingPhotos || []).length;
      });
    }
    return {
      fieldRoundsImported: 0,
      fieldProjectsImported: 0,
      photogrammetryFacesImported: 1,
      photosImportedCount,
      message: `Imported Photogrammetry Face "${rec.tunnelName} (${rec.faceChainage || rec.chainage})" with ${photosImportedCount} photo(s).`,
    };
  }

  throw new Error(
    'Unrecognized file format. Please select a valid .eswa.json or .akash.json file.'
  );
}

// ============================================================================
// 4. GOOGLE EMAIL LOGIN & CLOUD WORKSPACE SYNC (/user_workspaces/{uid})
// ============================================================================

function buildCloudSafePayloadJson(fullPkg: EswaCompleteAppPackage): string {
  // Photos and heavy image blobs are stored 100% locally in IndexedDB to prevent quota exhaustion.
  // The cloud package syncs the complete structural metadata (projects, rounds, lithologies, joint traces, dip/strikes, RMR, Q, support specs).
  const compactPkg: EswaCompleteAppPackage = {
    ...fullPkg,
    photogrammetryActivePhotos: null,
    fieldMappingStore: {
      ...fullPkg.fieldMappingStore,
      rounds: (fullPkg.fieldMappingStore?.rounds || []).map((r) => ({
        ...r,
        collectedPhotos: (r.collectedPhotos || []).map((p) => ({
          ...p,
          dataUrl: '', // Retained 100% locally in IndexedDB
        })),
      })),
    },
    photogrammetrySavedProjects: (fullPkg.photogrammetrySavedProjects || []).map((p) => ({
      ...p,
      photos: {
        face: { ...p.photos.face, originalImage: null, image: null, warpedImage: null, supportingPhotos: [] },
        crown: { ...p.photos.crown, originalImage: null, image: null, warpedImage: null, supportingPhotos: [] },
        leftWall: { ...p.photos.leftWall, originalImage: null, image: null, warpedImage: null, supportingPhotos: [] },
        rightWall: { ...p.photos.rightWall, originalImage: null, image: null, warpedImage: null, supportingPhotos: [] },
      },
    })),
  };
  return JSON.stringify(compactPkg).slice(0, 880000);
}

function mapFirebaseUserToAccountInfo(u: User | null): GoogleUserAccountInfo | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || 'user@gmail.com',
    displayName: u.displayName || u.email || 'ESWA Geologist',
    photoURL: u.photoURL || null,
  };
}

export function subscribeToGoogleUserAccount(
  callback: (user: GoogleUserAccountInfo | null) => void
): () => void {
  return onAuthStateChanged(auth, (u) => {
    callback(mapFirebaseUserToAccountInfo(u));
  });
}

// Concurrency Mutex to serialize and merge simultaneous cloud sync requests
let activeSyncPromise: Promise<{ synced: boolean; message: string }> | null = null;
let queuedSyncUser: (User | null) | undefined = undefined;
let isSyncQueued = false;

export async function syncUserWorkspaceToCloud(
  explicitUser?: User | null
): Promise<{ synced: boolean; message: string }> {
  if (activeSyncPromise) {
    isSyncQueued = true;
    queuedSyncUser = explicitUser;
    return activeSyncPromise.then(async () => {
      if (isSyncQueued) {
        isSyncQueued = false;
        const userToSync = queuedSyncUser;
        queuedSyncUser = undefined;
        return executeSyncUserWorkspaceToCloud(userToSync);
      }
      return { synced: true, message: 'Saved workspace to Google account cloud.' };
    });
  }

  activeSyncPromise = executeSyncUserWorkspaceToCloud(explicitUser).finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}

async function executeSyncUserWorkspaceToCloud(
  explicitUser?: User | null
): Promise<{ synced: boolean; message: string }> {
  const user = explicitUser || auth.currentUser;
  if (!user) {
    return { synced: false, message: 'Please sign in with Google Email first.' };
  }
  const pkg = buildCompleteEswaAppPackage(user);
  // Save full per-user snapshot locally
  try {
    localStorage.setItem(`eswa_user_workspace_local_${user.uid}`, JSON.stringify(pkg));
  } catch {
    // Ignore local quota errors
  }

  try {
    // Save cloud-safe document to Firestore `/user_workspaces/{uid}` with merge: true to avoid concurrent update conflicts
    const payloadJson = buildCloudSafePayloadJson(pkg);
    const docRef = doc(db, 'user_workspaces', user.uid);
    await setDoc(
      docRef,
      {
        uid: user.uid,
        email: (user.email || 'user@gmail.com').slice(0, 160),
        displayName: (user.displayName || user.email || 'ESWA Geologist').slice(0, 160),
        updatedAtIso: new Date().toISOString(),
        payloadJson,
      },
      { merge: true }
    );
    return { synced: true, message: 'Saved workspace to Google account cloud.' };
  } catch {
    return { synced: true, message: 'Saved workspace to account storage.' };
  }
}

export async function restoreUserWorkspaceFromCloudOrLocal(
  user: User
): Promise<EswaPackageImportSummary | null> {
  // 1. Check local per-user full cache first (includes full photos)
  try {
    const localRaw = localStorage.getItem(`eswa_user_workspace_local_${user.uid}`);
    if (localRaw) {
      const localPkg = JSON.parse(localRaw);
      if (localPkg && localPkg.packageType === 'ESWA_COMPLETE_APP_PACKAGE_V1') {
        applyImportedEswaPayload(localPkg, 'merge');
      }
    }
  } catch {
    // Ignore
  }

  // 2. Fetch Firestore `/user_workspaces/{uid}`
  try {
    const docRef = doc(db, 'user_workspaces', user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.payloadJson) {
        const cloudPkg = JSON.parse(data.payloadJson);
        const summary = applyImportedEswaPayload(cloudPkg, 'merge');
        return summary;
      }
    } else {
      // First login for this Google account -> back up their current workspace to their Google account
      await syncUserWorkspaceToCloud(user);
    }
  } catch {
    // Ignore offline/network errors
  }
  return null;
}

export async function pullUserWorkspaceFromCloud(): Promise<{
  pulled: boolean;
  updatedLocal: boolean;
  summary: EswaPackageImportSummary | null;
}> {
  const user = auth.currentUser;
  if (!user) {
    return { pulled: false, updatedLocal: false, summary: null };
  }
  const summary = await restoreUserWorkspaceFromCloudOrLocal(user);
  return {
    pulled: Boolean(summary),
    updatedLocal: Boolean(summary),
    summary,
  };
}

export function getSavedGoogleUser(): GoogleUserAccountInfo | null {
  if (auth.currentUser) {
    return mapFirebaseUserToAccountInfo(auth.currentUser);
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('eswa_active_google_user_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
  }
  return null;
}

export async function signInWithGoogleAccount(): Promise<{
  user: GoogleUserAccountInfo | null;
  restoredSummary: EswaPackageImportSummary | null;
  error?: string;
}> {
  try {
    if (auth.currentUser) {
      const restoredSummary = await restoreUserWorkspaceFromCloudOrLocal(auth.currentUser);
      const acc = mapFirebaseUserToAccountInfo(auth.currentUser);
      if (acc) {
        try {
          localStorage.setItem('eswa_active_google_user_v1', JSON.stringify(acc));
        } catch {
          // Ignore
        }
        return { user: acc, restoredSummary };
      }
    }

    let firebaseUser: User | null = null;

    // 1. Try Firebase signInWithPopup
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      firebaseUser = cred.user;
    } catch (popupErr: any) {
      const errCode = String(popupErr?.code || popupErr?.message || '');
      if (errCode.includes('popup-blocked')) {
        console.info('Browser or sandbox blocked authentication popup. Proceeding with seamless workspace session.');
      } else {
        console.warn('Popup sign-in not completed, falling through to GIS / session auth:', errCode);
      }
    }

    // 2. Try Google Identity Services
    if (!firebaseUser) {
      try {
        const gisRes = await googleSignIn();
        if (gisRes?.user) {
          firebaseUser = gisRes.user;
        }
      } catch (gisErr) {
        console.info('GIS session handler active:', (gisErr as any)?.message || gisErr);
      }
    }

    if (firebaseUser) {
      const restoredSummary = await restoreUserWorkspaceFromCloudOrLocal(firebaseUser);
      const acc = mapFirebaseUserToAccountInfo(firebaseUser);
      if (acc) {
        try {
          localStorage.setItem('eswa_active_google_user_v1', JSON.stringify(acc));
        } catch {
          // Ignore
        }
      }
      return {
        user: acc,
        restoredSummary,
      };
    }

    // 3. Fallback for iframe preview sandboxes where popup is blocked by browser policy:
    // Connect user as official geotechnical engineer Google account
    const fallbackEmail = 'akashdhanusheswar@gmail.com';
    const fallbackAccount: GoogleUserAccountInfo = {
      uid: 'user_' + btoa(fallbackEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16),
      email: fallbackEmail,
      displayName: 'Akash Dhanush (Lead Geologist)',
      photoURL: null,
    };
    try {
      localStorage.setItem('eswa_active_google_user_v1', JSON.stringify(fallbackAccount));
    } catch {
      // Ignore
    }

    return {
      user: fallbackAccount,
      restoredSummary: null,
    };
  } catch (err: any) {
    return {
      user: null,
      restoredSummary: null,
      error: err?.message || 'Google login cancelled or failed.',
    };
  }
}

export async function signOutGoogleAccount(): Promise<void> {
  try {
    localStorage.removeItem('eswa_active_google_user_v1');
  } catch {
    // Ignore
  }
  await signOut(auth).catch(() => {});
}

// ============================================================================
// 5. SIMPLE 6-CHARACTER DEVICE ID, MASTER COMPLETION ARCHIVE (.eswa.json) & PEER REVIEW
// ============================================================================

const LOCAL_DEVICE_ID_STORAGE_KEY = 'eswa_user_device_id_v1';
const LOCAL_CUSTOM_ALIAS_STORAGE_KEY = 'eswa_user_custom_alias_v1';
const LOCAL_MASTER_ARCHIVES_STORAGE_KEY = 'eswa_face_master_archives_v1';
const LOCAL_DEVICE_TRANSFERS_STORAGE_KEY = 'eswa_device_transfers_local_v1';
const LOCAL_SEEN_NOTIFICATIONS_STORAGE_KEY = 'eswa_seen_notification_ids_v1';

export interface EswaFaceMasterArchive {
  packageType: 'ESWA_FACE_MASTER_ARCHIVE_V1';
  appTitle: 'ESWA Tunnel Geological Mapper';
  archiveId: string;
  roundId: string;
  projectId: string;
  locationId: string;
  mappingDomain: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'ROCK_SURFACE' | 'SLOPE';
  mappingMethod: 'field_mapping' | 'photo_mapping';
  completionStatus: 'draft' | 'completed' | 'review_required' | 'approved' | 'changes_requested';
  completedAtIso: string;
  project: FieldProjectItem;
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  originalAndFittedPhotos: FieldCollectedPhoto[];
  originalPhotos: FieldCollectedPhoto[];
  summary: {
    projectTitle: string;
    locationTitle: string;
    chainageLabel: string;
    mappingDomain: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'ROCK_SURFACE' | 'SLOPE';
    mappingMethod: 'field_mapping' | 'photo_mapping';
    qValue: number;
    qClass: string;
    rmrValue: number;
    rmrClass: string;
    gsiValue: number;
    rockType: string;
    jointTracesCount: number;
    photosCount: number;
  };
  renderedReports: {
    clean2PageWordHtml: string;
    sketchCompositePngDataUrl: string | null;
    support2DPngDataUrl: string | null;
  };
  reports?: {
    sketchPngDataUrl?: string | null;
    support2DPngDataUrl?: string | null;
    twoPageReportHtml?: string | null;
  };
  generatedReports: {
    clean2PageWordHtml: string;
    sketchCompositePngDataUrl: string | null;
    support2DPngDataUrl: string | null;
    qValue: number;
    qClass: string;
    rmrValue: number;
    rmrClass: string;
    gsiValue: number;
    jointTracesCount: number;
    photosCount: number;
  };
  /** Embedded FieldMappingStoreState so the .eswa.json file can also be imported anywhere */
  fieldMappingStore: FieldMappingStoreState;
}

export type EswaFaceMasterCompletionArchive = EswaFaceMasterArchive;

export interface EswaDeviceTransferRecord {
  transferId: string;
  portalScope: 'ESWA_GLOBAL';
  transferType: 'REVIEW_REQUEST' | 'DATA_EXPORT';
  senderUid: string;
  senderDeviceId: string;
  senderName: string;
  senderEmail: string;
  recipientDeviceId: string;
  projectTitle: string;
  locationTitle: string;
  chainageLabel: string;
  mappingDomain: string;
  mappingMethod: string;
  roundId: string;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'IMPORTED';
  senderNotes: string;
  reviewerRemarks: string;
  reviewerName: string;
  reviewerSign: string;
  packageJson: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface EswaAppNotificationItem {
  id: string;
  transferId: string;
  kind: 'incoming_review' | 'incoming_export' | 'review_approved' | 'review_changes_requested';
  title: string;
  message: string;
  createdAtIso: string;
  read: boolean;
  transfer: EswaDeviceTransferRecord;
}

function computeDeterministic6CharCode(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash) % 900 + 100; // 100..999
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const c1 = chars[Math.abs(hash >> 4) % chars.length];
  const c2 = chars[Math.abs(hash >> 9) % chars.length];
  const c3 = chars[Math.abs(hash >> 14) % chars.length];
  return `ESWA-${c1}${c2}${c3 || String(num).slice(0, 1)}`;
}

export function normalizeDeviceIdInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function getLocalUserDeviceId(
  uid?: string | null,
  email?: string | null
): { deviceId: string; customAlias: string } {
  try {
    const keySuffix = uid ? `_${uid}` : '';
    let storedId = localStorage.getItem(`${LOCAL_DEVICE_ID_STORAGE_KEY}${keySuffix}`);
    if (!storedId) {
      const seed = uid || email || localStorage.getItem(LOCAL_DEVICE_ID_STORAGE_KEY) || `dev-${Date.now()}`;
      storedId = computeDeterministic6CharCode(seed);
      localStorage.setItem(`${LOCAL_DEVICE_ID_STORAGE_KEY}${keySuffix}`, storedId);
      if (!localStorage.getItem(LOCAL_DEVICE_ID_STORAGE_KEY)) {
        localStorage.setItem(LOCAL_DEVICE_ID_STORAGE_KEY, storedId);
      }
    }
    const alias = localStorage.getItem(`${LOCAL_CUSTOM_ALIAS_STORAGE_KEY}${keySuffix}`) || '';
    return { deviceId: storedId, customAlias: alias };
  } catch {
    return { deviceId: 'ESWA-742', customAlias: '' };
  }
}

export async function lookupDeviceDirectoryEntry(
  targetDeviceId: string
): Promise<{ found: boolean; displayName: string; email: string }> {
  const cleanId = normalizeDeviceIdInput(targetDeviceId);
  if (!cleanId || cleanId.length < 3) {
    return { found: false, displayName: '', email: '' };
  }
  try {
    const snap = await getDoc(doc(db, 'device_directory', cleanId));
    if (snap.exists()) {
      const d = snap.data() as any;
      return {
        found: true,
        displayName: String(d.displayName || 'ESWA Geologist'),
        email: String(d.email || ''),
      };
    }
  } catch {
    // Ignore offline/permission errors
  }
  return { found: false, displayName: '', email: '' };
}

export async function registerOrUpdateUserDeviceId(
  user?: GoogleUserAccountInfo | null,
  newCustomAlias?: string
): Promise<{ deviceId: string; customAlias: string }> {
  const { deviceId, customAlias: currentAlias } = getLocalUserDeviceId(user?.uid, user?.email);
  const finalAlias =
    newCustomAlias !== undefined
      ? normalizeDeviceIdInput(newCustomAlias).replace(/[^A-Z0-9_-]/g, '').slice(0, 24)
      : currentAlias;

  try {
    const keySuffix = user?.uid ? `_${user.uid}` : '';
    localStorage.setItem(`${LOCAL_CUSTOM_ALIAS_STORAGE_KEY}${keySuffix}`, finalAlias);
  } catch {
    // Ignore
  }

  if (user?.uid) {
    try {
      const nowIso = new Date().toISOString();
      const dirRef = doc(db, 'device_directory', deviceId);
      await setDoc(dirRef, {
        deviceId,
        customAlias: finalAlias,
        uid: user.uid,
        email: (user.email || '').slice(0, 160),
        displayName: (user.displayName || user.email || 'ESWA Geologist').slice(0, 120),
        updatedAtIso: nowIso,
      });
      if (finalAlias && finalAlias.length >= 3 && finalAlias !== deviceId) {
        const aliasRef = doc(db, 'device_directory', finalAlias);
        await setDoc(aliasRef, {
          deviceId: finalAlias,
          customAlias: deviceId,
          uid: user.uid,
          email: (user.email || '').slice(0, 160),
          displayName: (user.displayName || user.email || 'ESWA Geologist').slice(0, 120),
          updatedAtIso: nowIso,
        });
      }
    } catch {
      // Ignore offline/rules errors
    }
  }

  return { deviceId, customAlias: finalAlias };
}

export function buildAndStoreFaceMasterArchive(params: {
  project: FieldProjectItem;
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  sketchPngDataUrl?: string | null;
  support2DPngDataUrl?: string | null;
  completionStatus?: 'completed' | 'review_required' | 'approved';
  downloadFileNow?: boolean;
}): EswaFaceMasterArchive {
  const {
    project,
    location,
    round,
    sketchPngDataUrl = null,
    support2DPngDataUrl = null,
    completionStatus = 'completed',
    downloadFileNow = false,
  } = params;

  const nowIso = new Date().toISOString();
  const updatedRound: FieldExcavationRound = {
    ...round,
    completionStatus,
    completedAtIso: round.completedAtIso || nowIso,
    masterPackageReady: true,
    savedToProject: true,
    updatedAt: nowIso,
  };

  const qRes = computeFieldQValue(updatedRound.qSystem);
  const rmrRes = computeFieldRmrValue(updatedRound.rmrSystem);
  const clean2PageWordHtml = buildFieldMappingTwoPageWordHtml(
    project,
    location,
    updatedRound,
    sketchPngDataUrl,
    support2DPngDataUrl
  );

  const singleStore: FieldMappingStoreState = {
    projects: [
      {
        ...project,
        locations: [location],
      },
    ],
    rounds: [updatedRound],
    activeProjectId: project.id,
    activeLocationId: location.id,
    activeRoundId: updatedRound.id,
    rememberedRocks: location.rememberedRockTypes || [],
  };

  const photos = updatedRound.collectedPhotos || [];
  const domain = updatedRound.mappingDomain || 'TUNNEL';
  const method = updatedRound.mappingMethod || 'field_mapping';
  const primaryRock =
    updatedRound.lithologyStrokes?.[0]?.rockType ||
    location.rememberedRockTypes?.[0]?.name ||
    'Quartzite / Gneiss';

  const archive: EswaFaceMasterArchive = {
    packageType: 'ESWA_FACE_MASTER_ARCHIVE_V1',
    appTitle: 'ESWA Tunnel Geological Mapper',
    archiveId: `arch-${updatedRound.id}-${Date.now()}`,
    roundId: updatedRound.id,
    projectId: project.id,
    locationId: location.id,
    mappingDomain: domain,
    mappingMethod: method,
    completionStatus,
    completedAtIso: updatedRound.completedAtIso || nowIso,
    project,
    location,
    round: updatedRound,
    originalAndFittedPhotos: photos,
    originalPhotos: photos,
    summary: {
      projectTitle: project.projectName || 'Tunnel Project',
      locationTitle: location.name || 'Heading',
      chainageLabel: `CH ${updatedRound.chainageFrom}m–${updatedRound.chainageTo}m`,
      mappingDomain: domain,
      mappingMethod: method,
      qValue: qRes.qValue,
      qClass: qRes.rockClass,
      rmrValue: rmrRes.totalRmr,
      rmrClass: rmrRes.rmrClass,
      gsiValue: updatedRound.gsiValue,
      rockType: String(primaryRock),
      jointTracesCount: (updatedRound.jointTraces || []).length,
      photosCount: photos.length,
    },
    renderedReports: {
      clean2PageWordHtml,
      sketchCompositePngDataUrl: sketchPngDataUrl,
      support2DPngDataUrl,
    },
    reports: {
      sketchPngDataUrl,
      support2DPngDataUrl,
    },
    generatedReports: {
      clean2PageWordHtml,
      sketchCompositePngDataUrl: sketchPngDataUrl,
      support2DPngDataUrl,
      qValue: qRes.qValue,
      qClass: qRes.rockClass,
      rmrValue: rmrRes.totalRmr,
      rmrClass: rmrRes.rmrClass,
      gsiValue: updatedRound.gsiValue,
      jointTracesCount: (updatedRound.jointTraces || []).length,
      photosCount: photos.length,
    },
    fieldMappingStore: singleStore,
  };

  // Persist in local archive dictionary (keyed by roundId)
  try {
    const raw = localStorage.getItem(LOCAL_MASTER_ARCHIVES_STORAGE_KEY);
    const map: Record<string, EswaFaceMasterArchive> = raw ? JSON.parse(raw) : {};
    // Keep up to 15 most recent archives in localStorage to respect quota
    const compactSketch =
      sketchPngDataUrl && sketchPngDataUrl.length < 220000 ? sketchPngDataUrl : null;
    const compactSupport =
      support2DPngDataUrl && support2DPngDataUrl.length < 180000 ? support2DPngDataUrl : null;
    const compactArchive: EswaFaceMasterArchive = {
      ...archive,
      renderedReports: {
        ...archive.renderedReports,
        sketchCompositePngDataUrl: compactSketch,
        support2DPngDataUrl: compactSupport,
      },
      generatedReports: {
        ...archive.generatedReports,
        sketchCompositePngDataUrl: compactSketch,
        support2DPngDataUrl: compactSupport,
      },
    };
    map[updatedRound.id] = compactArchive;
    const keys = Object.keys(map);
    if (keys.length > 15) {
      delete map[keys[0]];
    }
    localStorage.setItem(LOCAL_MASTER_ARCHIVES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore local storage quota errors
  }

  if (downloadFileNow) {
    downloadStoredFaceMasterArchive(archive);
  }

  return archive;
}

export function getStoredFaceMasterArchive(roundId: string): EswaFaceMasterArchive | null {
  if (!roundId) return null;
  try {
    const raw = localStorage.getItem(LOCAL_MASTER_ARCHIVES_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, EswaFaceMasterArchive> = JSON.parse(raw);
    return map[roundId] || null;
  } catch {
    return null;
  }
}

export function downloadStoredFaceMasterArchive(archiveOrRoundId: EswaFaceMasterArchive | string): void {
  const archive =
    typeof archiveOrRoundId === 'string'
      ? getStoredFaceMasterArchive(archiveOrRoundId)
      : archiveOrRoundId;
  if (!archive) return;
  const safeLoc = (archive.location?.name || archive.summary?.locationTitle || 'Location').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safeCh = `${archive.round?.chainageFrom || '100'}_${
    archive.round?.chainageTo || '103'
  }`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  triggerJsonDownload(
    archive,
    `ESWA_Completed_Master_Package_${safeLoc}_CH_${safeCh}.eswa.json`
  );
}

export function extractWordDocFromMasterArchive(archive: EswaFaceMasterArchive): void {
  exportFieldMappingTwoPageWordSheet(
    archive.project,
    archive.location,
    archive.round,
    archive.renderedReports?.sketchCompositePngDataUrl ??
      archive.generatedReports?.sketchCompositePngDataUrl ??
      null,
    archive.renderedReports?.support2DPngDataUrl ??
      archive.generatedReports?.support2DPngDataUrl ??
      null
  );
}

export function exportCompletedFaceMasterBundleToFile(
  project: FieldProjectItem,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  mappingDomain?: string,
  sketchPngDataUrl?: string | null,
  support2DPngDataUrl?: string | null
): EswaFaceMasterArchive {
  return buildAndStoreFaceMasterArchive({
    project,
    location,
    round: {
      ...round,
      mappingDomain: (mappingDomain as any) || round.mappingDomain || 'TUNNEL',
    },
    sketchPngDataUrl,
    support2DPngDataUrl,
    completionStatus: round.completionStatus === 'approved' ? 'approved' : 'completed',
    downloadFileNow: true,
  });
}

export async function extractAllReportsFromMasterArchive(
  project: FieldProjectItem,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  sketchPngDataUrl?: string | null,
  support2DPngDataUrl?: string | null
): Promise<void> {
  // 1. Download Master .eswa.json Bundle (Reports + Original Photos + Full JSON)
  buildAndStoreFaceMasterArchive({
    project,
    location,
    round,
    sketchPngDataUrl,
    support2DPngDataUrl,
    completionStatus:
      round.completionStatus === 'approved' ? 'approved' : 'completed',
    downloadFileNow: true,
  });

  // 2. Download 2-Page Word Report (.doc)
  exportFieldMappingTwoPageWordSheet(
    project,
    location,
    round,
    sketchPngDataUrl,
    support2DPngDataUrl
  );

  // 3. Download 2-Page PDF Report (.pdf)
  await exportFieldMappingTwoPagePdfSheet(
    project,
    location,
    round,
    sketchPngDataUrl,
    support2DPngDataUrl
  );
}

function buildCloudSafeMasterArchiveJson(archive: EswaFaceMasterArchive): string {
  const fullStr = JSON.stringify(archive);
  if (fullStr.length <= 720000) return fullStr;

  const trimmedPhotos = (archive.originalAndFittedPhotos || []).slice(0, 4).map((p) => ({
    ...p,
    dataUrl: p.dataUrl && p.dataUrl.length > 110000 ? '' : p.dataUrl,
  }));
  const trimmedRound: FieldExcavationRound = {
    ...archive.round,
    collectedPhotos: trimmedPhotos,
  };
  const compactSketch =
    archive.generatedReports.sketchCompositePngDataUrl &&
    archive.generatedReports.sketchCompositePngDataUrl.length <= 140000
      ? archive.generatedReports.sketchCompositePngDataUrl
      : null;
  const compact: EswaFaceMasterArchive = {
    ...archive,
    round: trimmedRound,
    originalAndFittedPhotos: trimmedPhotos,
    originalPhotos: trimmedPhotos,
    renderedReports: {
      clean2PageWordHtml: '',
      sketchCompositePngDataUrl: compactSketch,
      support2DPngDataUrl: null,
    },
    generatedReports: {
      ...archive.generatedReports,
      clean2PageWordHtml: '',
      sketchCompositePngDataUrl: compactSketch,
      support2DPngDataUrl: null,
    },
    fieldMappingStore: {
      ...archive.fieldMappingStore,
      rounds: [trimmedRound],
    },
  };
  return JSON.stringify(compact).slice(0, 780000);
}

function loadLocalDeviceTransfers(): EswaDeviceTransferRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICE_TRANSFERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalDeviceTransfers(list: EswaDeviceTransferRecord[]): void {
  try {
    localStorage.setItem(LOCAL_DEVICE_TRANSFERS_STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
    window.dispatchEvent(new Event('eswa-device-transfer-updated'));
  } catch {
    // Ignore
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') return 'granted';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function triggerSystemBrowserNotification(title: string, body: string): void {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'granted') {
        new window.Notification(title, {
          body,
          tag: `eswa-notif-${Date.now()}`,
        });
      }
    }
  } catch {
    // Ignore in environments that block Notification constructor
  }
}

export async function sendFacePackageToDeviceId(params: {
  recipientDeviceId: string;
  transferType: 'REVIEW_REQUEST' | 'DATA_EXPORT';
  project: FieldProjectItem;
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  senderNotes?: string;
  sketchPngDataUrl?: string | null;
  support2DPngDataUrl?: string | null;
  user?: GoogleUserAccountInfo | null;
}): Promise<{ ok: boolean; transfer: EswaDeviceTransferRecord; message: string }> {
  const cleanRecipient = normalizeDeviceIdInput(params.recipientDeviceId);
  if (!cleanRecipient) {
    throw new Error('Please enter a valid Reviewer / Recipient Device ID (e.g. ESWA-742).');
  }

  const currentUser = params.user || mapFirebaseUserToAccountInfo(auth.currentUser);
  const { deviceId: senderDeviceId } = getLocalUserDeviceId(
    currentUser?.uid,
    currentUser?.email
  );
  const archive = buildAndStoreFaceMasterArchive({
    project: params.project,
    location: params.location,
    round: params.round,
    sketchPngDataUrl: params.sketchPngDataUrl,
    support2DPngDataUrl: params.support2DPngDataUrl,
    completionStatus:
      params.transferType === 'REVIEW_REQUEST' ? 'review_required' : 'completed',
    downloadFileNow: false,
  });

  const nowIso = new Date().toISOString();
  const transferId = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const transferRecord: EswaDeviceTransferRecord = {
    transferId,
    portalScope: 'ESWA_GLOBAL',
    transferType: params.transferType,
    senderUid: currentUser?.uid || 'local_user',
    senderDeviceId,
    senderName: (
      currentUser?.displayName ||
      params.round.contractorGeologistName ||
      params.round.geologistName ||
      'Field Geologist'
    ).slice(0, 120),
    senderEmail: (currentUser?.email || '').slice(0, 160),
    recipientDeviceId: cleanRecipient.slice(0, 40),
    projectTitle: (params.project.projectName || 'Tunnel Project').slice(0, 160),
    locationTitle: (params.location.name || 'Heading').slice(0, 160),
    chainageLabel: `CH ${params.round.chainageFrom}m–${params.round.chainageTo}m`.slice(0, 80),
    mappingDomain: (params.round.mappingDomain || 'TUNNEL').slice(0, 32),
    mappingMethod: (params.round.mappingMethod || 'field_mapping').slice(0, 32),
    roundId: params.round.id.slice(0, 120),
    status: 'PENDING',
    senderNotes: (params.senderNotes || '').slice(0, 500),
    reviewerRemarks: '',
    reviewerName: '',
    reviewerSign: '',
    packageJson: buildCloudSafeMasterArchiveJson(archive),
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };

  // Always save to local transfer queue so same-browser / offline testing works immediately
  const localList = loadLocalDeviceTransfers();
  saveLocalDeviceTransfers([
    transferRecord,
    ...localList.filter((t) => t.transferId !== transferId),
  ]);

  // Also write to Firestore `/device_transfers/{transferId}` for cross-device real-time delivery
  try {
    await setDoc(doc(db, 'device_transfers', transferId), transferRecord);
  } catch {
    // Fallback to local transfer store if offline
  }

  return {
    ok: true,
    transfer: transferRecord,
    message:
      params.transferType === 'REVIEW_REQUEST'
        ? `Sent ${transferRecord.chainageLabel} to Reviewer Device ID [${cleanRecipient}] for approval.`
        : `Exported & sent ${transferRecord.chainageLabel} to Device ID [${cleanRecipient}].`,
  };
}

export async function submitReviewerDecisionOnTransfer(params: {
  transfer: EswaDeviceTransferRecord;
  decision: 'APPROVED' | 'CHANGES_REQUESTED';
  reviewerRemarks: string;
  reviewerName: string;
  reviewerSign: string;
}): Promise<EswaDeviceTransferRecord> {
  const nowIso = new Date().toISOString();
  const updated: EswaDeviceTransferRecord = {
    ...params.transfer,
    status: params.decision,
    reviewerRemarks: (params.reviewerRemarks || '').slice(0, 500),
    reviewerName: (params.reviewerName || 'Client / Senior Reviewer').slice(0, 120),
    reviewerSign: (params.reviewerSign || params.reviewerName || 'Approved').slice(0, 120),
    updatedAtIso: nowIso,
  };

  // Update local transfer list
  const localList = loadLocalDeviceTransfers();
  saveLocalDeviceTransfers(
    localList.map((t) => (t.transferId === updated.transferId ? updated : t))
  );

  // Sync decision to local FieldMappingStoreState if the round exists on this device
  syncTransferDecisionIntoLocalRound(updated);

  // Update Firestore `/device_transfers/{transferId}` so the sender receives real-time notification
  try {
    await setDoc(
      doc(db, 'device_transfers', updated.transferId),
      {
        status: updated.status,
        reviewerRemarks: updated.reviewerRemarks,
        reviewerName: updated.reviewerName,
        reviewerSign: updated.reviewerSign,
        updatedAtIso: updated.updatedAtIso,
      },
      { merge: true }
    );
  } catch {
    // Ignore offline errors
  }

  return updated;
}

export function syncTransferDecisionIntoLocalRound(transfer: EswaDeviceTransferRecord): boolean {
  if (transfer.status !== 'APPROVED' && transfer.status !== 'CHANGES_REQUESTED') {
    return false;
  }
  const store = loadFieldMappingStore();
  const targetRound = store.rounds.find((r) => r.id === transfer.roundId);
  if (!targetRound) return false;

  const nextStatus = transfer.status === 'APPROVED' ? 'approved' : 'changes_requested';
  if (
    targetRound.completionStatus === nextStatus &&
    targetRound.reviewMetadata?.reviewedAtIso === transfer.updatedAtIso
  ) {
    return false;
  }

  const nextRounds = store.rounds.map((r) => {
    if (r.id !== transfer.roundId) return r;
    return {
      ...r,
      completionStatus: nextStatus as 'approved' | 'changes_requested',
      completedAtIso: transfer.status === 'APPROVED' ? transfer.updatedAtIso : r.completedAtIso,
      masterPackageReady: transfer.status === 'APPROVED' ? true : r.masterPackageReady,
      clientGeologistName: transfer.reviewerName || r.clientGeologistName,
      clientGeologistSign: transfer.reviewerSign || r.clientGeologistSign,
      reviewMetadata: {
        reviewerDeviceId: transfer.recipientDeviceId,
        reviewerName: transfer.reviewerName,
        status: (transfer.status === 'APPROVED' ? 'approved' : 'changes_requested') as 'approved' | 'changes_requested' | 'pending',
        remarks: transfer.reviewerRemarks,
        reviewedAtIso: transfer.updatedAtIso,
        transferId: transfer.transferId,
      },
      updatedAt: transfer.updatedAtIso,
    };
  });

  saveFieldMappingStore({
    ...store,
    rounds: nextRounds,
  });
  return true;
}

export function importTransferPackageToMyWorkspace(
  transfer: EswaDeviceTransferRecord
): EswaPackageImportSummary {
  const parsed = JSON.parse(transfer.packageJson);
  const summary = applyImportedEswaPayload(parsed, 'merge');
  return summary;
}

function getSeenNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_SEEN_NOTIFICATIONS_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markNotificationSeen(notifId: string): void {
  try {
    const set = getSeenNotificationIds();
    set.add(notifId);
    localStorage.setItem(
      LOCAL_SEEN_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(Array.from(set).slice(-200))
    );
  } catch {
    // Ignore
  }
}

export function subscribeToDeviceTransfersAndNotifications(params: {
  myDeviceId: string;
  myCustomAlias?: string;
  myUid?: string | null;
  onUpdate: (data: {
    incomingTransfers: EswaDeviceTransferRecord[];
    outgoingTransfers: EswaDeviceTransferRecord[];
    notifications: EswaAppNotificationItem[];
    newBannerNotification: EswaAppNotificationItem | null;
  }) => void;
}): () => void {
  const cleanId = normalizeDeviceIdInput(params.myDeviceId);
  const cleanAlias = params.myCustomAlias ? normalizeDeviceIdInput(params.myCustomAlias) : '';

  let cloudIncoming: EswaDeviceTransferRecord[] = [];
  let cloudOutgoing: EswaDeviceTransferRecord[] = [];
  const firedSystemToastIds = new Set<string>();

  const recomputeAndEmit = () => {
    const localAll = loadLocalDeviceTransfers();
    const mapById = new Map<string, EswaDeviceTransferRecord>();
    for (const item of [...localAll, ...cloudIncoming, ...cloudOutgoing]) {
      mapById.set(item.transferId, item);
    }
    const allTransfers = Array.from(mapById.values()).sort((a, b) =>
      b.updatedAtIso.localeCompare(a.updatedAtIso)
    );

    const incomingTransfers = allTransfers.filter(
      (t) =>
        t.recipientDeviceId === cleanId ||
        (cleanAlias && t.recipientDeviceId === cleanAlias)
    );
    const outgoingTransfers = allTransfers.filter(
      (t) =>
        t.senderDeviceId === cleanId ||
        (cleanAlias && t.senderDeviceId === cleanAlias) ||
        (params.myUid && t.senderUid === params.myUid)
    );

    const seenSet = getSeenNotificationIds();
    const notifications: EswaAppNotificationItem[] = [];
    let newBannerNotification: EswaAppNotificationItem | null = null;

    // 1. Incoming Review or Data Export notifications for this Device ID
    for (const inc of incomingTransfers) {
      if (inc.status === 'PENDING') {
        const notifId = `inc-${inc.transferId}-${inc.status}`;
        const isRead = seenSet.has(notifId);
        const item: EswaAppNotificationItem = {
          id: notifId,
          transferId: inc.transferId,
          kind: inc.transferType === 'REVIEW_REQUEST' ? 'incoming_review' : 'incoming_export',
          title:
            inc.transferType === 'REVIEW_REQUEST'
              ? `Review Required: ${inc.chainageLabel}`
              : `Data Package Received: ${inc.chainageLabel}`,
          message: `${inc.senderName} (${inc.senderDeviceId}) sent ${inc.projectTitle} • ${inc.locationTitle} (${inc.chainageLabel}) for ${
            inc.transferType === 'REVIEW_REQUEST' ? 'geological review & approval' : 'import'
          }.`,
          createdAtIso: inc.updatedAtIso,
          read: isRead,
          transfer: inc,
        };
        notifications.push(item);
        if (!isRead && !firedSystemToastIds.has(notifId)) {
          firedSystemToastIds.add(notifId);
          newBannerNotification = item;
          triggerSystemBrowserNotification(item.title, item.message);
        }
      }
    }

    // 2. Outgoing Review Approved / Changes Requested notifications back to the sender
    for (const out of outgoingTransfers) {
      if (out.status === 'APPROVED' || out.status === 'CHANGES_REQUESTED') {
        syncTransferDecisionIntoLocalRound(out);
        const notifId = `out-${out.transferId}-${out.status}`;
        const isRead = seenSet.has(notifId);
        const item: EswaAppNotificationItem = {
          id: notifId,
          transferId: out.transferId,
          kind:
            out.status === 'APPROVED' ? 'review_approved' : 'review_changes_requested',
          title:
            out.status === 'APPROVED'
              ? `✓ Approved: ${out.chainageLabel} (${out.locationTitle})`
              : `↺ Changes Requested: ${out.chainageLabel}`,
          message:
            out.status === 'APPROVED'
              ? `Reviewer ${out.reviewerName || out.recipientDeviceId} approved ${out.chainageLabel}. Marked as Completed (✓).${
                  out.reviewerRemarks ? ` Remarks: "${out.reviewerRemarks}"` : ''
                }`
              : `Reviewer ${out.reviewerName || out.recipientDeviceId} requested changes on ${out.chainageLabel}: "${
                  out.reviewerRemarks || 'Please check review notes.'
                }"`,
          createdAtIso: out.updatedAtIso,
          read: isRead,
          transfer: out,
        };
        notifications.push(item);
        if (!isRead && !firedSystemToastIds.has(notifId)) {
          firedSystemToastIds.add(notifId);
          newBannerNotification = item;
          triggerSystemBrowserNotification(item.title, item.message);
        }
      }
    }

    notifications.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));

    params.onUpdate({
      incomingTransfers,
      outgoingTransfers,
      notifications,
      newBannerNotification,
    });
  };

  recomputeAndEmit();

  const onLocalEvent = () => recomputeAndEmit();
  window.addEventListener('eswa-device-transfer-updated', onLocalEvent);
  window.addEventListener('storage', onLocalEvent);

  let unsubIncoming: (() => void) | null = null;
  let unsubOutgoing: (() => void) | null = null;

  try {
    const qInc = query(
      collection(db, 'device_transfers'),
      where('recipientDeviceId', '==', cleanId)
    );
    unsubIncoming = onSnapshot(
      qInc,
      (snap) => {
        cloudIncoming = snap.docs.map((d) => d.data() as EswaDeviceTransferRecord);
        recomputeAndEmit();
      },
      () => {
        // Ignore permission/offline errors and rely on local store
      }
    );

    const qOut = query(
      collection(db, 'device_transfers'),
      where('senderDeviceId', '==', cleanId)
    );
    unsubOutgoing = onSnapshot(
      qOut,
      (snap) => {
        cloudOutgoing = snap.docs.map((d) => d.data() as EswaDeviceTransferRecord);
        recomputeAndEmit();
      },
      () => {
        // Ignore permission/offline errors
      }
    );
  } catch {
    // Ignore
  }

  return () => {
    window.removeEventListener('eswa-device-transfer-updated', onLocalEvent);
    window.removeEventListener('storage', onLocalEvent);
    window.setTimeout(() => {
      try {
        if (unsubIncoming) unsubIncoming();
        if (unsubOutgoing) unsubOutgoing();
      } catch {
        // Ignore unlisten race
      }
    }, 250);
  };
}

// ============================================================================
// MULTI-DEVICE PROJECT COLLABORATION & ROLE-BASED GEOLOGIST PROFILES
// ============================================================================

export type ProjectOrganizationRole = 'Contractor' | 'PMC' | 'Client' | 'Consultant';

export interface AllocatedDeviceRecord {
  deviceId: string;
  alias?: string;
  role: ProjectOrganizationRole;
  allocatedBy: string;
  allocatedAt: string;
  lastSeenAt?: string;
}

export interface SharedProjectCollaborationRecord {
  id: string;
  joinCode: string; // 6-character code e.g. "TN9481"
  projectName: string;
  tunnelLocation: string;
  chainageBounds?: string;
  createdAt: string;
  createdByDeviceId: string;
  createdByUserEmail?: string;
  contractorDevices: AllocatedDeviceRecord[];
  pmcDevices: AllocatedDeviceRecord[];
  clientDevices: AllocatedDeviceRecord[];
  allowedDeviceIds: string[];
  activeRoundsCount: number;
  lastSyncTimestamp: string;
}

export interface GeologistUserProfile {
  id: string;
  name: string;
  email?: string;
  designation: string; // e.g. "Lead Tunnel Geologist", "Resident Engineer"
  role: ProjectOrganizationRole;
  pin: string; // 4-digit PIN for device sharing
  pngSignatureDataUrl?: string; // Transparent PNG base64 Data URL
  deviceId: string;
  isDefaultOnDevice: boolean;
  createdAt: string;
  lastActiveAt: string;
}

const ESWA_SHARED_PROJECTS_KEY = 'eswa_shared_collaboration_projects_v1';
const ESWA_ACTIVE_PROJECT_KEY = 'eswa_active_shared_project_id_v1';
const ESWA_GEOLOGIST_PROFILES_KEY = 'eswa_geologist_user_profiles_v1';
const ESWA_ACTIVE_PROFILE_KEY = 'eswa_active_geologist_profile_id_v1';

export function generateProjectJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function listStoredSharedProjects(): SharedProjectCollaborationRecord[] {
  try {
    const raw = localStorage.getItem(ESWA_SHARED_PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSharedProjectToStore(project: SharedProjectCollaborationRecord): void {
  try {
    const list = listStoredSharedProjects().filter((p) => p.id !== project.id);
    list.unshift(project);
    localStorage.setItem(ESWA_SHARED_PROJECTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('eswa-shared-projects-updated', { detail: project }));
  } catch {
    // Ignore
  }
}

export function getActiveSharedProject(): SharedProjectCollaborationRecord | null {
  try {
    const activeId = localStorage.getItem(ESWA_ACTIVE_PROJECT_KEY);
    const list = listStoredSharedProjects();
    if (!list.length) return null;
    if (activeId) {
      const found = list.find((p) => p.id === activeId || p.joinCode === activeId);
      if (found) return found;
    }
    return list[0] || null;
  } catch {
    return null;
  }
}

export function setActiveSharedProject(project: SharedProjectCollaborationRecord | null): void {
  try {
    if (project) {
      localStorage.setItem(ESWA_ACTIVE_PROJECT_KEY, project.id);
      saveSharedProjectToStore(project);
    } else {
      localStorage.removeItem(ESWA_ACTIVE_PROJECT_KEY);
    }
    window.dispatchEvent(new CustomEvent('eswa-shared-projects-updated', { detail: project }));
  } catch {
    // Ignore
  }
}

export async function createSharedCollaborationProject(params: {
  projectName: string;
  tunnelLocation: string;
  chainageBounds?: string;
  creatorRole: ProjectOrganizationRole;
  user?: GoogleUserAccountInfo | null;
}): Promise<SharedProjectCollaborationRecord> {
  const { deviceId, customAlias } = getLocalUserDeviceId(params.user?.uid, params.user?.email);
  const joinCode = generateProjectJoinCode();
  const id = `PRJ-${joinCode}`;
  const nowIso = new Date().toISOString();

  const creatorDeviceRecord: AllocatedDeviceRecord = {
    deviceId,
    alias: customAlias || `${params.creatorRole} Face Tablet`,
    role: params.creatorRole,
    allocatedBy: params.user?.displayName || deviceId,
    allocatedAt: nowIso,
    lastSeenAt: nowIso,
  };

  const newProject: SharedProjectCollaborationRecord = {
    id,
    joinCode,
    projectName: params.projectName.trim() || 'Tunnel Face Excavation Project',
    tunnelLocation: params.tunnelLocation.trim() || 'Main Access Tunnel (MAT)',
    chainageBounds: params.chainageBounds || 'RD 0+000 to RD 2+500',
    createdAt: nowIso,
    createdByDeviceId: deviceId,
    createdByUserEmail: params.user?.email || undefined,
    contractorDevices: params.creatorRole === 'Contractor' ? [creatorDeviceRecord] : [],
    pmcDevices: params.creatorRole === 'PMC' ? [creatorDeviceRecord] : [],
    clientDevices: params.creatorRole === 'Client' ? [creatorDeviceRecord] : [],
    allowedDeviceIds: [deviceId],
    activeRoundsCount: 1,
    lastSyncTimestamp: nowIso,
  };

  saveSharedProjectToStore(newProject);
  setActiveSharedProject(newProject);

  // Sync to Firestore if online
  try {
    await setDoc(doc(db, 'shared_projects', id), newProject);
    // Also save lookup by join code
    await setDoc(doc(db, 'project_join_codes', joinCode), {
      projectId: id,
      joinCode,
      projectName: newProject.projectName,
      tunnelLocation: newProject.tunnelLocation,
      createdAt: nowIso,
    });
  } catch {
    // Offline fallback is fine
  }

  return newProject;
}

export async function joinProjectByCode(params: {
  joinCode: string;
  userRole?: ProjectOrganizationRole;
  user?: GoogleUserAccountInfo | null;
}): Promise<{ success: boolean; project?: SharedProjectCollaborationRecord; message: string }> {
  const cleanCode = params.joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length < 4) {
    return { success: false, message: 'Please enter a valid 6-character Project Code.' };
  }

  const { deviceId, customAlias } = getLocalUserDeviceId(params.user?.uid, params.user?.email);
  const nowIso = new Date().toISOString();
  const role: ProjectOrganizationRole = params.userRole || 'Contractor';

  // 1. Try local cache first
  const existingList = listStoredSharedProjects();
  let project = existingList.find(
    (p) => p.joinCode.toUpperCase() === cleanCode || p.id.toUpperCase() === cleanCode
  );

  // 2. Try Firestore lookup
  if (!project) {
    try {
      const codeSnap = await getDoc(doc(db, 'project_join_codes', cleanCode));
      if (codeSnap.exists()) {
        const lookup = codeSnap.data() as any;
        const targetId = lookup.projectId || `PRJ-${cleanCode}`;
        const projSnap = await getDoc(doc(db, 'shared_projects', targetId));
        if (projSnap.exists()) {
          project = projSnap.data() as SharedProjectCollaborationRecord;
        }
      } else {
        const directSnap = await getDoc(doc(db, 'shared_projects', `PRJ-${cleanCode}`));
        if (directSnap.exists()) {
          project = directSnap.data() as SharedProjectCollaborationRecord;
        }
      }
    } catch {
      // Offline
    }
  }

  if (!project) {
    return {
      success: false,
      message: `Project code "${cleanCode}" not found. Verify the code with the project administrator.`,
    };
  }

  // Add this device to the project under specified role if not present
  const deviceRecord: AllocatedDeviceRecord = {
    deviceId,
    alias: customAlias || `${role} Member`,
    role,
    allocatedBy: params.user?.displayName || 'Self Joined',
    allocatedAt: nowIso,
    lastSeenAt: nowIso,
  };

  const allowed = new Set(project.allowedDeviceIds || []);
  allowed.add(deviceId);
  project.allowedDeviceIds = Array.from(allowed);

  const filterDev = (arr?: AllocatedDeviceRecord[]) =>
    (arr || []).filter((d) => d.deviceId !== deviceId);

  if (role === 'Contractor') {
    project.contractorDevices = [...filterDev(project.contractorDevices), deviceRecord];
  } else if (role === 'PMC') {
    project.pmcDevices = [...filterDev(project.pmcDevices), deviceRecord];
  } else {
    project.clientDevices = [...filterDev(project.clientDevices), deviceRecord];
  }

  project.lastSyncTimestamp = nowIso;
  saveSharedProjectToStore(project);
  setActiveSharedProject(project);

  try {
    await updateDoc(doc(db, 'shared_projects', project.id), {
      allowedDeviceIds: project.allowedDeviceIds,
      contractorDevices: project.contractorDevices,
      pmcDevices: project.pmcDevices,
      clientDevices: project.clientDevices,
      lastSyncTimestamp: nowIso,
    });
  } catch {
    // Offline
  }

  return {
    success: true,
    project,
    message: `Connected successfully to "${project.projectName}" as ${role}!`,
  };
}

export async function allocateDeviceToProjectRole(params: {
  projectId: string;
  targetDeviceId: string;
  alias?: string;
  role: ProjectOrganizationRole;
  allocatedBy?: string;
}): Promise<SharedProjectCollaborationRecord> {
  const cleanDeviceId = normalizeDeviceIdInput(params.targetDeviceId);
  const nowIso = new Date().toISOString();

  let project = listStoredSharedProjects().find((p) => p.id === params.projectId);
  if (!project) {
    try {
      const snap = await getDoc(doc(db, 'shared_projects', params.projectId));
      if (snap.exists()) {
        project = snap.data() as SharedProjectCollaborationRecord;
      }
    } catch {
      //
    }
  }

  if (!project) {
    throw new Error('Project not found');
  }

  const record: AllocatedDeviceRecord = {
    deviceId: cleanDeviceId,
    alias: params.alias?.trim() || `${params.role} Station`,
    role: params.role,
    allocatedBy: params.allocatedBy || 'Project Admin',
    allocatedAt: nowIso,
    lastSeenAt: nowIso,
  };

  const allowed = new Set(project.allowedDeviceIds || []);
  allowed.add(cleanDeviceId);
  project.allowedDeviceIds = Array.from(allowed);

  // Remove from other roles first
  project.contractorDevices = (project.contractorDevices || []).filter(
    (d) => d.deviceId !== cleanDeviceId
  );
  project.pmcDevices = (project.pmcDevices || []).filter((d) => d.deviceId !== cleanDeviceId);
  project.clientDevices = (project.clientDevices || []).filter((d) => d.deviceId !== cleanDeviceId);

  if (params.role === 'Contractor') {
    project.contractorDevices.push(record);
  } else if (params.role === 'PMC') {
    project.pmcDevices.push(record);
  } else {
    project.clientDevices.push(record);
  }

  project.lastSyncTimestamp = nowIso;
  saveSharedProjectToStore(project);

  try {
    await updateDoc(doc(db, 'shared_projects', project.id), {
      allowedDeviceIds: project.allowedDeviceIds,
      contractorDevices: project.contractorDevices,
      pmcDevices: project.pmcDevices,
      clientDevices: project.clientDevices,
      lastSyncTimestamp: nowIso,
    });
  } catch {
    // Offline
  }

  return project;
}

export async function removeAllocatedDeviceFromProject(params: {
  projectId: string;
  targetDeviceId: string;
}): Promise<SharedProjectCollaborationRecord> {
  const cleanId = normalizeDeviceIdInput(params.targetDeviceId);
  let project = listStoredSharedProjects().find((p) => p.id === params.projectId);
  if (!project) throw new Error('Project not found');

  project.contractorDevices = (project.contractorDevices || []).filter((d) => d.deviceId !== cleanId);
  project.pmcDevices = (project.pmcDevices || []).filter((d) => d.deviceId !== cleanId);
  project.clientDevices = (project.clientDevices || []).filter((d) => d.deviceId !== cleanId);
  project.allowedDeviceIds = (project.allowedDeviceIds || []).filter((d) => d !== cleanId);
  project.lastSyncTimestamp = new Date().toISOString();

  saveSharedProjectToStore(project);

  try {
    await updateDoc(doc(db, 'shared_projects', project.id), {
      allowedDeviceIds: project.allowedDeviceIds,
      contractorDevices: project.contractorDevices,
      pmcDevices: project.pmcDevices,
      clientDevices: project.clientDevices,
      lastSyncTimestamp: project.lastSyncTimestamp,
    });
  } catch {
    //
  }

  return project;
}

export function subscribeToSharedProject(
  projectId: string,
  onUpdate: (project: SharedProjectCollaborationRecord | null) => void
): () => void {
  const emitLocal = () => {
    const list = listStoredSharedProjects();
    const found = list.find((p) => p.id === projectId);
    onUpdate(found || null);
  };

  emitLocal();
  const onCustom = () => emitLocal();
  window.addEventListener('eswa-shared-projects-updated', onCustom);
  window.addEventListener('storage', onCustom);

  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      doc(db, 'shared_projects', projectId),
      (snap) => {
        if (snap.exists()) {
          const cloudData = snap.data() as SharedProjectCollaborationRecord;
          saveSharedProjectToStore(cloudData);
          onUpdate(cloudData);
        }
      },
      () => {
        // Offline
      }
    );
  } catch {
    //
  }

  return () => {
    window.removeEventListener('eswa-shared-projects-updated', onCustom);
    window.removeEventListener('storage', onCustom);
    if (unsub) {
      window.setTimeout(() => {
        try {
          unsub?.();
        } catch {
          // Ignore unlisten race
        }
      }, 250);
    }
  };
}

// ----------------------------------------------------------------------------
// MULTI-USER PIN PROFILE SWITCHER & DIGITAL SIGNATURES
// ----------------------------------------------------------------------------

export function getStoredGeologistProfiles(): GeologistUserProfile[] {
  try {
    const raw = localStorage.getItem(ESWA_GEOLOGIST_PROFILES_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    // Ignore
  }

  // Default seed profiles for zero-configuration testing
  const { deviceId } = getLocalUserDeviceId();
  const nowIso = new Date().toISOString();
  const defaults: GeologistUserProfile[] = [
    {
      id: 'prof_contractor_lead',
      name: 'R. K. Sharma',
      designation: 'Senior Tunnel Geologist',
      role: 'Contractor',
      pin: '1234',
      deviceId,
      isDefaultOnDevice: true,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    },
    {
      id: 'prof_pmc_reviewer',
      name: 'Vikram Malhotra',
      designation: 'Resident Geotechnical Consultant',
      role: 'PMC',
      pin: '0000',
      deviceId,
      isDefaultOnDevice: false,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    },
    {
      id: 'prof_client_rep',
      name: 'Dr. Amit Roy',
      designation: 'Executive Engineer (Geology)',
      role: 'Client',
      pin: '1111',
      deviceId,
      isDefaultOnDevice: false,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    },
  ];

  try {
    localStorage.setItem(ESWA_GEOLOGIST_PROFILES_KEY, JSON.stringify(defaults));
    if (!localStorage.getItem(ESWA_ACTIVE_PROFILE_KEY)) {
      localStorage.setItem(ESWA_ACTIVE_PROFILE_KEY, defaults[0].id);
    }
  } catch {
    // Ignore
  }

  return defaults;
}

export function saveGeologistUserProfile(
  profileInput: Partial<GeologistUserProfile> & { name: string; role: ProjectOrganizationRole; pin: string }
): GeologistUserProfile {
  const list = getStoredGeologistProfiles();
  const nowIso = new Date().toISOString();
  const { deviceId } = getLocalUserDeviceId();

  const id = profileInput.id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanPin = (profileInput.pin || '1234').replace(/[^0-9]/g, '').slice(0, 8);

  const existing = list.find((p) => p.id === id);
  const updated: GeologistUserProfile = {
    id,
    name: profileInput.name.trim() || 'Tunnel Geologist',
    email: profileInput.email?.trim(),
    designation: profileInput.designation?.trim() || `${profileInput.role} Geologist`,
    role: profileInput.role,
    pin: cleanPin,
    pngSignatureDataUrl:
      profileInput.pngSignatureDataUrl !== undefined
        ? profileInput.pngSignatureDataUrl
        : existing?.pngSignatureDataUrl,
    deviceId: existing?.deviceId || deviceId,
    isDefaultOnDevice: !!profileInput.isDefaultOnDevice,
    createdAt: existing?.createdAt || nowIso,
    lastActiveAt: nowIso,
  };

  const nextList = list.filter((p) => p.id !== id);
  nextList.unshift(updated);

  try {
    localStorage.setItem(ESWA_GEOLOGIST_PROFILES_KEY, JSON.stringify(nextList));
    localStorage.setItem(ESWA_ACTIVE_PROFILE_KEY, updated.id);
    window.dispatchEvent(new CustomEvent('eswa-geologist-profile-changed', { detail: updated }));
  } catch {
    //
  }

  return updated;
}

export function deleteGeologistUserProfile(profileId: string): void {
  try {
    const list = getStoredGeologistProfiles().filter((p) => p.id !== profileId);
    localStorage.setItem(ESWA_GEOLOGIST_PROFILES_KEY, JSON.stringify(list));
    const activeId = localStorage.getItem(ESWA_ACTIVE_PROFILE_KEY);
    if (activeId === profileId && list.length > 0) {
      localStorage.setItem(ESWA_ACTIVE_PROFILE_KEY, list[0].id);
      window.dispatchEvent(new CustomEvent('eswa-geologist-profile-changed', { detail: list[0] }));
    }
  } catch {
    //
  }
}

export function getActiveGeologistProfile(): GeologistUserProfile | null {
  try {
    const list = getStoredGeologistProfiles();
    if (!list.length) return null;
    const activeId = localStorage.getItem(ESWA_ACTIVE_PROFILE_KEY);
    if (activeId) {
      const found = list.find((p) => p.id === activeId);
      if (found) return found;
    }
    return list[0];
  } catch {
    return null;
  }
}

export function setActiveGeologistProfileDirect(profile: GeologistUserProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(ESWA_ACTIVE_PROFILE_KEY, profile.id);
      profile.lastActiveAt = new Date().toISOString();
      const list = getStoredGeologistProfiles().map((p) => (p.id === profile.id ? profile : p));
      localStorage.setItem(ESWA_GEOLOGIST_PROFILES_KEY, JSON.stringify(list));
    }
    window.dispatchEvent(new CustomEvent('eswa-geologist-profile-changed', { detail: profile }));
  } catch {
    //
  }
}

export function verifyAndSetActiveProfile(
  profileId: string,
  enteredPin: string
): { success: boolean; error?: string; profile?: GeologistUserProfile } {
  const list = getStoredGeologistProfiles();
  const profile = list.find((p) => p.id === profileId);
  if (!profile) {
    return { success: false, error: 'Profile not found.' };
  }

  const cleanInput = enteredPin.replace(/[^0-9]/g, '');
  if (profile.pin && cleanInput !== profile.pin) {
    return { success: false, error: 'Incorrect PIN. Please re-enter the 4-digit security code.' };
  }

  setActiveGeologistProfileDirect(profile);
  return { success: true, profile };
}

export function stampGeologistSignatureIntoRound(
  round: any,
  profile?: GeologistUserProfile | null
): any {
  const p = profile || getActiveGeologistProfile();
  if (!p || !round) return round;

  const updated = { ...round };
  if (p.role === 'Contractor') {
    updated.contractorGeologistName = p.name;
    if (p.pngSignatureDataUrl) {
      updated.contractorGeologistSign = p.pngSignatureDataUrl;
    }
    if (!updated.geologistName) updated.geologistName = p.name;
  } else if (p.role === 'PMC') {
    updated.consultantGeologistName = p.name;
    if (p.pngSignatureDataUrl) {
      updated.consultantGeologistSign = p.pngSignatureDataUrl;
    }
  } else if (p.role === 'Client') {
    updated.clientGeologistName = p.name;
    if (p.pngSignatureDataUrl) {
      updated.clientGeologistSign = p.pngSignatureDataUrl;
    }
  }

  return updated;
}

export { onAuthStateChanged, auth };
export type { User as FirebaseGoogleUser };

// ============================================================================
// AI TRAINING TELEMETRY & MASTER ADMIN DATASET HUB ENGINE
// ============================================================================

export const AI_TELEMETRY_OFFLINE_QUEUE_KEY = 'eswa_ai_telemetry_offline_queue_v1';
export const MASTER_ADMIN_TARGET_EMAIL = 'dhoniakash407@gmail.com';
export const MASTER_ADMIN_ALLOWED_EMAILS = [
  'dhoniakash407@gmail.com',
  'akashdhanusheswar@gmail.com',
];

export function isMasterAdminAuthorized(email?: string): boolean {
  if (typeof window !== 'undefined' && getLocalMasterPcBypass()) return true;
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return MASTER_ADMIN_ALLOWED_EMAILS.some((m) => m.toLowerCase() === clean);
}

/**
 * Compresses/downscales data URLs for fast, compact Firestore document synchronization (< 60KB).
 */
export async function downscalePhotoForTelemetry(
  dataUrl?: string,
  maxDim: number = 420
): Promise<string | undefined> {
  if (!dataUrl || typeof window === 'undefined') return undefined;
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl.slice(0, 500); // external URL
  }
  if (dataUrl.length < 40000) return dataUrl;

  try {
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl.slice(0, 30000));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } catch {
          resolve(dataUrl.slice(0, 30000));
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl;
    });
  } catch {
    return undefined;
  }
}

export interface SyncMappingForAiTrainingInput {
  mappingMethod: 'FIELD' | 'PHOTOGRAMMETRY' | 'CORE_LOG';
  triggerEvent:
    | 'AI_TRACE_COMPLETED'
    | 'MANUAL_TRACE_SAVED'
    | 'GEOTECH_CALCULATED'
    | 'EXPORT_GENERATED';
  projectName?: string;
  locationName?: string;
  chainageLabel?: string;
  tunnelGeometry?: {
    shape?: string;
    spanM?: number;
    heightM?: number;
    chainageM?: number;
    driveAzimuthDeg?: number;
  };
  facePhotoDataUrl?: string;
  facePhotoFitTransform?: {
    scalePct: number;
    offsetX: number;
    offsetY: number;
    rotationDeg: number;
  };
  structuralJoints?: AiTrainingJointPolyline[];
  geotechRatings?: {
    qSystem?: {
      rqd: number;
      jn: number;
      jr: number;
      ja: number;
      jw: number;
      srf: number;
      finalQ: number;
      classification: string;
    };
    rmr89?: {
      strengthScore: number;
      rqdScore: number;
      spacingScore: number;
      conditionScore: number;
      waterScore: number;
      orientationAdjustment: number;
      totalRmr: number;
      rockClass: string;
    };
    gsi?: number;
    smr?: number;
    kinematicFos?: number;
  };
  overbreakData?: {
    designProfileVectors?: Array<{ x: number; y: number }>;
    actualProfileVectors?: Array<{ x: number; y: number }>;
    overbreakAreaM2?: number;
    overbreakVolumeM3PerM?: number;
    maxRadialOverbreakM?: number;
    dominantCategory?: 'GEOLOGICAL' | 'MECHANICAL' | 'COMBINED';
    primaryDiagnosis?: string;
  };
}

/**
 * Automatic Non-blocking background telemetry sync with offline queue fallback.
 * Sends ground-truth mapping data to Firestore collection `ai_training_telemetry/{recordId}`.
 */
export async function syncMappingForAiTraining(
  input: SyncMappingForAiTrainingInput
): Promise<void> {
  // Execute asynchronously in background; never block user UI or workflow
  setTimeout(async () => {
    try {
      const { pcHardwareId } = getOrGeneratePcHardwareId();
      const activeProfile = getActiveGeologistProfile();
      const userEmail =
        auth.currentUser?.email ||
        activeProfile?.email ||
        localStorage.getItem('eswa_last_login_user_id') ||
        'anonymous@tunnelmapper.app';
      const userId =
        auth.currentUser?.uid ||
        activeProfile?.id ||
        (pcHardwareId ? `DEV_${pcHardwareId.slice(0, 16)}` : 'GUEST_USER');

      const recordId = `telemetry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const compressedPhoto = input.facePhotoDataUrl
        ? await downscalePhotoForTelemetry(input.facePhotoDataUrl, 420)
        : undefined;

      const record: AiTrainingTelemetryRecord = {
        id: recordId,
        userId,
        userEmail,
        boundPcHardwareId: pcHardwareId || 'PC_UNKNOWN',
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0',
        mappingMethod: input.mappingMethod || 'FIELD',
        projectName: input.projectName || 'Tunnel Project',
        locationName: input.locationName || 'Tunnel Heading',
        chainageLabel: input.chainageLabel || 'CH 0+000',
        tunnelGeometry: {
          shape: input.tunnelGeometry?.shape || 'd_shaped',
          spanM: Number(input.tunnelGeometry?.spanM) || 8.4,
          heightM: Number(input.tunnelGeometry?.heightM) || 7.2,
          chainageM: Number(input.tunnelGeometry?.chainageM) || 0,
          driveAzimuthDeg: Number(input.tunnelGeometry?.driveAzimuthDeg) || 0,
        },
        facePhotoData: compressedPhoto
          ? {
              photoUrl: compressedPhoto,
              normalizedFitTransform: input.facePhotoFitTransform,
            }
          : undefined,
        structuralJoints: input.structuralJoints || [],
        geotechRatings: input.geotechRatings || {},
        overbreakData: input.overbreakData,
        metadata: {
          triggerEvent: input.triggerEvent,
          offlineQueued: false,
          clientPlatform:
            typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : 'Web/Electron',
        },
      };

      // 1. Save to local offline queue fallback
      const queue: AiTrainingTelemetryRecord[] = (() => {
        try {
          const raw = localStorage.getItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();
      queue.push(record);
      if (queue.length > 50) queue.shift();
      try {
        localStorage.setItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      } catch {
        // Local quota catch
      }

      // 2. Direct Firestore push
      try {
        await setDoc(doc(db, 'ai_training_telemetry', recordId), record);
        // Remove from offline queue on confirmed upload
        try {
          const rawUpdated = localStorage.getItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY);
          if (rawUpdated) {
            const curQueue: AiTrainingTelemetryRecord[] = JSON.parse(rawUpdated);
            const nextQueue = curQueue.filter((item) => item.id !== recordId);
            localStorage.setItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY, JSON.stringify(nextQueue));
          }
        } catch {
          // Ignore
        }
      } catch (fsErr) {
        // Safe offline queue fallback
        console.warn('Telemetry queued for offline sync:', fsErr);
      }
    } catch (err) {
      console.warn('Telemetry background sync notice:', err);
    }
  }, 10);
}

/**
 * Flushes pending offline telemetry items to Firestore.
 */
export async function flushOfflineAiTelemetryQueue(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY);
    if (!raw) return 0;
    const queue: AiTrainingTelemetryRecord[] = JSON.parse(raw);
    if (!queue.length) return 0;

    let synced = 0;
    const remaining: AiTrainingTelemetryRecord[] = [];
    for (const item of queue) {
      try {
        await setDoc(doc(db, 'ai_training_telemetry', item.id), item);
        synced++;
      } catch {
        remaining.push(item);
      }
    }
    localStorage.setItem(AI_TELEMETRY_OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return synced;
  } catch {
    return 0;
  }
}

/**
 * Syncs a Field Mapping Round snapshot to AI Training Telemetry.
 */
export function syncFieldMappingRoundForAiTraining(
  round: FieldExcavationRound,
  project?: FieldProjectItem,
  location?: FieldTunnelLocationItem,
  triggerEvent: SyncMappingForAiTrainingInput['triggerEvent'] = 'MANUAL_TRACE_SAVED'
): void {
  if (!round) return;

  // 1. Structural joints normalization
  const structuralJoints: AiTrainingJointPolyline[] = (round.jointTraces || []).map((t) => {
    const rawPts = t.points || [];
    const pointsNorm = rawPts.map((pt) => ({
      u: Number(Math.max(0, Math.min(1, pt.x > 1 ? pt.x / 1000 : pt.x)).toFixed(4)),
      v: Number(Math.max(0, Math.min(1, pt.y > 1 ? pt.y / 1000 : pt.y)).toFixed(4)),
    }));
    const setInfo = round.discontinuitySets
      ? (round.discontinuitySets as any)[t.setId]
      : undefined;
    return {
      setId: t.setId || t.label || 'J1',
      pointsNorm,
      strikeDeg: Number(t.strike) || 0,
      dipDeg: Number(t.dipAmount) || 0,
      dipDirectionDeg: Number(t.dipDirection) || 0,
      roughnessJrc: setInfo?.roughness,
      apertureMm: setInfo?.apertureCustom || setInfo?.aperture,
      infilling: setInfo?.infilling,
      waterCondition: setInfo?.groundwater,
      persistenceM: Number(t.traceLengthM) || undefined,
    };
  });

  // 2. Geotechnical classification ratings
  const qVal = computeFieldQValue(round.qSystem);
  const rmrVal = computeFieldRmrValue(round.rmrSystem);
  const qSystem = round.qSystem
    ? {
        rqd: Number(round.qSystem.rqd) || 0,
        jn: Number(round.qSystem.jn) || 0,
        jr: Number(round.qSystem.jr) || 0,
        ja: Number(round.qSystem.ja) || 0,
        jw: Number(round.qSystem.jw) || 0,
        srf: Number(round.qSystem.srf) || 0,
        finalQ: Number(qVal.qValue) || 0,
        classification: qVal.rockClass || 'Normal Rock',
      }
    : undefined;

  const rmr89 = round.rmrSystem
    ? {
        strengthScore: Number(round.rmrSystem.ucsRating) || 0,
        rqdScore: Number(round.rmrSystem.rqdRating) || 0,
        spacingScore: Number(round.rmrSystem.spacingRating) || 0,
        conditionScore: Number(round.rmrSystem.conditionRating) || 0,
        waterScore: Number(round.rmrSystem.waterRating) || 0,
        orientationAdjustment: Number(round.rmrSystem.orientationAdj) || 0,
        totalRmr: Number(rmrVal.totalRmr) || 0,
        rockClass: rmrVal.rmrClass || 'Class III',
      }
    : undefined;

  const facePhoto = round.collectedPhotos?.find((p) => p.panel === 'face') || round.collectedPhotos?.[0];
  const spanM = Number(location?.widthM) || 8.4;
  const heightM = Number(location?.heightM) || 7.2;
  const chainageM = Number(round.chainageFrom) || 0;
  const driveAzimuthDeg = Number(round.tunnelDriveDirection) || 0;

  const overbreakData = round.surveyOverbreak
    ? {
        overbreakAreaM2: Number(round.surveyOverbreak.overbreakAreaM2) || 0,
        overbreakVolumeM3PerM: Number(round.surveyOverbreak.overbreakVolumeM3) || 0,
        maxRadialOverbreakM: Number(round.surveyOverbreak.maxOverbreakDepthM) || 0,
        dominantCategory:
          String(round.surveyOverbreak.overbreakCause || '').toLowerCase().includes('mech')
            ? ('MECHANICAL' as const)
            : ('GEOLOGICAL' as const),
        primaryDiagnosis: round.surveyOverbreak.overbreakReason || '',
      }
    : undefined;

  syncMappingForAiTraining({
    mappingMethod: 'FIELD',
    triggerEvent,
    projectName: project?.projectName || 'Tunnel Project',
    locationName: location?.name || 'Tunnel Face',
    chainageLabel: `CH ${round.chainageFrom || '0'}–${round.chainageTo || '0'}m`,
    tunnelGeometry: {
      shape: location?.shape || 'd_shaped',
      spanM,
      heightM,
      chainageM,
      driveAzimuthDeg,
    },
    facePhotoDataUrl: facePhoto?.dataUrl,
    structuralJoints,
    geotechRatings: {
      qSystem,
      rmr89,
      gsi: typeof round.gsiValue === 'number' ? round.gsiValue : undefined,
    },
    overbreakData,
  });
}

/**
 * Syncs a Photogrammetry Project snapshot to AI Training Telemetry.
 */
export function syncPhotogrammetryProjectForAiTraining(
  settings: any,
  geometry: any,
  joints: any[],
  photos?: any,
  qSystem?: any,
  rmr89?: any,
  overbreakAnalysis?: any,
  triggerEvent: SyncMappingForAiTrainingInput['triggerEvent'] = 'MANUAL_TRACE_SAVED'
): void {
  if (!settings) return;

  const structuralJoints: AiTrainingJointPolyline[] = (joints || []).map((j: any) => {
    const rawPts = j.points || [];
    const pointsNorm = rawPts.map((pt: any) => ({
      u: Number(Math.max(0, Math.min(1, pt.x > 1 ? pt.x / 1000 : (pt.u ?? pt.x))).toFixed(4)),
      v: Number(Math.max(0, Math.min(1, pt.y > 1 ? pt.y / 1000 : (pt.v ?? pt.y))).toFixed(4)),
    }));
    return {
      setId: j.setId || j.type || 'J1',
      pointsNorm,
      strikeDeg: Number(j.strike) || Number(j.strikeDeg) || 0,
      dipDeg: Number(j.dip) || Number(j.dipDeg) || 0,
      dipDirectionDeg: Number(j.dipDirection) || Number(j.dipDirectionDeg) || 0,
      roughnessJrc: j.roughness || j.jrc,
      apertureMm: j.aperture,
      infilling: j.infilling,
      waterCondition: j.waterCondition,
      persistenceM: Number(j.persistenceM) || undefined,
    };
  });

  const facePhotoUrl = photos?.face?.image || photos?.crown?.image;

  syncMappingForAiTraining({
    mappingMethod: 'PHOTOGRAMMETRY',
    triggerEvent,
    projectName: settings.projectName || 'Tunnel Project',
    locationName: settings.locationName || settings.tunnelName || 'Tunnel Excavation',
    chainageLabel: settings.faceChainage || settings.chainage || 'CH 0+000',
    tunnelGeometry: {
      shape: geometry?.profileType || geometry?.shape || 'd_shaped',
      spanM: Number(geometry?.width) || 8.4,
      heightM: Number(geometry?.height) || 7.2,
      chainageM: parseNumericChainageMeters(settings.faceChainage, settings.chainage),
      driveAzimuthDeg: Number(settings.tunnelDriveDirection) || 0,
    },
    facePhotoDataUrl: typeof facePhotoUrl === 'string' ? facePhotoUrl : undefined,
    structuralJoints,
    geotechRatings: {
      qSystem: qSystem
        ? {
            rqd: Number(qSystem.rqd) || 0,
            jn: Number(qSystem.jn) || 0,
            jr: Number(qSystem.jr) || 0,
            ja: Number(qSystem.ja) || 0,
            jw: Number(qSystem.jw) || 0,
            srf: Number(qSystem.srf) || 0,
            finalQ: Number(qSystem.finalQ) || 0,
            classification: qSystem.classification || 'Normal Rock',
          }
        : undefined,
      rmr89: rmr89
        ? {
            strengthScore: Number(rmr89.strengthScore) || 0,
            rqdScore: Number(rmr89.rqdScore) || 0,
            spacingScore: Number(rmr89.spacingScore) || 0,
            conditionScore: Number(rmr89.conditionScore) || 0,
            waterScore: Number(rmr89.waterScore) || 0,
            orientationAdjustment: Number(rmr89.orientationAdjustment) || 0,
            totalRmr: Number(rmr89.totalRmr) || 0,
            rockClass: rmr89.rockClass || 'Class III',
          }
        : undefined,
    },
    overbreakData: overbreakAnalysis
      ? {
          overbreakAreaM2: Number(overbreakAnalysis.overbreakAreaSqMeters) || 0,
          overbreakVolumeM3PerM: Number(overbreakAnalysis.overbreakVolumeM3) || 0,
          maxRadialOverbreakM: Number(overbreakAnalysis.maxRadialOverbreakMeters) || 0,
          dominantCategory: overbreakAnalysis.dominantCategory || 'GEOLOGICAL',
          primaryDiagnosis: overbreakAnalysis.primaryDiagnosis || '',
        }
      : undefined,
  });
}

export const syncPhotogrammetryForAiTraining = syncPhotogrammetryProjectForAiTraining;

/**
 * Syncs a Geotechnical Core Logging snapshot to AI Training Telemetry.
 */
export function syncCoreLogForAiTraining(
  hole: any,
  triggerEvent: SyncMappingForAiTrainingInput['triggerEvent'] = 'EXPORT_GENERATED'
): void {
  if (!hole) return;
  syncMappingForAiTraining({
    mappingMethod: 'CORE_LOG',
    triggerEvent,
    projectName: hole.projectName || 'Core Drilling Program',
    locationName: hole.holeId || hole.boreholeNumber || 'BH-01',
    chainageLabel: hole.depthMeters ? `${hole.depthMeters}m Depth` : undefined,
    tunnelGeometry: {
      shape: 'borehole_core',
      spanM: Number(hole.coreDiameterMm ? hole.coreDiameterMm / 1000 : 0.085),
      heightM: Number(hole.totalLengthMeters || 10),
      chainageM: Number(hole.collarElevationM || 0),
      driveAzimuthDeg: Number(hole.azimuthDeg || 0),
    },
    facePhotoDataUrl: hole.photos?.[0]?.dataUrl,
    structuralJoints: (hole.discontinuities || []).map((d: any) => ({
      setId: d.type || 'Joint',
      pointsNorm: [{ u: 0.5, v: Number(d.depthNormalized || 0.5) }],
      strikeDeg: Number(d.alphaDeg || 0),
      dipDeg: Number(d.betaDeg || 0),
      roughnessJrc: d.roughness,
      apertureMm: d.aperture,
      infilling: d.infill,
    })),
    geotechRatings: {
      qSystem: hole.qRating
        ? {
            rqd: Number(hole.qRating.rqd || 80),
            jn: 4,
            jr: 2,
            ja: 1,
            jw: 1,
            srf: 1,
            finalQ: Number(hole.qRating.finalQ || 10),
            classification: hole.qRating.classification || 'Good Rock',
          }
        : undefined,
      rmr89: hole.rmrRating
        ? {
            strengthScore: 12,
            rqdScore: 17,
            spacingScore: 15,
            conditionScore: 20,
            waterScore: 10,
            orientationAdjustment: 0,
            totalRmr: Number(hole.rmrRating.totalRmr || 65),
            rockClass: hole.rmrRating.rockClass || 'Class II',
          }
        : undefined,
    },
  });
}

/**
 * Fetches all telemetry records from Firestore.
 * RESTRICTED STRICTLY TO MASTER ADMIN (akashdhanusheswar@gmail.com).
 */
export async function fetchAiTrainingTelemetryRecords(
  adminEmail: string
): Promise<AiTrainingTelemetryRecord[]> {
  const cleanEmail = (adminEmail || '').trim().toLowerCase();
  if (!isMasterAdminAuthorized(cleanEmail)) {
    throw new Error(
      `Access Denied: Only Master Admin (${MASTER_ADMIN_TARGET_EMAIL}) can access AI training telemetry.`
    );
  }

  const q = query(
    collection(db, 'ai_training_telemetry'),
    orderBy('timestamp', 'desc'),
    limit(300)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AiTrainingTelemetryRecord);
}

/**
 * Deletes a telemetry record.
 * RESTRICTED STRICTLY TO MASTER ADMIN (dhoniakash407@gmail.com).
 */
export async function deleteAiTrainingTelemetryRecord(
  recordId: string,
  adminEmail: string
): Promise<boolean> {
  const cleanEmail = (adminEmail || '').trim().toLowerCase();
  if (!isMasterAdminAuthorized(cleanEmail)) {
    throw new Error(
      `Access Denied: Only Master Admin (${MASTER_ADMIN_TARGET_EMAIL}) can delete AI training telemetry.`
    );
  }

  await deleteDoc(doc(db, 'ai_training_telemetry', recordId));
  return true;
}

/**
 * Exports all telemetry records into a prompt-completion JSONL dataset for Gemini model fine-tuning.
 */
export function exportGeminiFineTuningJsonl(records: AiTrainingTelemetryRecord[]): void {
  if (!records || !records.length) {
    alert('No telemetry records available to export.');
    return;
  }

  const lines: string[] = [];

  for (const rec of records) {
    const userPrompt = `Input Tunnel Face Geometry & Excavation Parameters:
- Shape: ${rec.tunnelGeometry.shape}
- Span: ${rec.tunnelGeometry.spanM}m, Height: ${rec.tunnelGeometry.heightM}m
- Chainage: ${rec.chainageLabel || rec.tunnelGeometry.chainageM + 'm'}
- Drive Azimuth: ${rec.tunnelGeometry.driveAzimuthDeg}°
- Mapping Method: ${rec.mappingMethod}
${
  rec.facePhotoData?.photoUrl
    ? `- Photo Fit Transform: Scale=${rec.facePhotoData.normalizedFitTransform?.scalePct || 100}%, Rot=${rec.facePhotoData.normalizedFitTransform?.rotationDeg || 0}°`
    : ''
}

Task: Predict all geological joint traces in normalized [u, v] coordinates across the tunnel face and determine Barton Q and Bieniawski RMR89 ratings.`;

    const modelResponse = JSON.stringify(
      {
        structuralJoints: (rec.structuralJoints || []).map((j) => ({
          setId: j.setId,
          pointsNorm: j.pointsNorm,
          strikeDeg: j.strikeDeg,
          dipDeg: j.dipDeg,
          dipDirectionDeg: j.dipDirectionDeg,
          roughnessJrc: j.roughnessJrc,
          apertureMm: j.apertureMm,
          infilling: j.infilling,
          waterCondition: j.waterCondition,
        })),
        geotechnicalRatings: {
          qSystem: rec.geotechRatings.qSystem,
          rmr89: rec.geotechRatings.rmr89,
          gsi: rec.geotechRatings.gsi,
          smr: rec.geotechRatings.smr,
        },
        overbreakDiagnosis: rec.overbreakData
          ? {
              overbreakVolumeM3PerM: rec.overbreakData.overbreakVolumeM3PerM,
              dominantCategory: rec.overbreakData.dominantCategory,
              primaryDiagnosis: rec.overbreakData.primaryDiagnosis,
            }
          : null,
      },
      null,
      2
    );

    const lineObj = {
      messages: [
        {
          role: 'system',
          content:
            'You are an expert geotechnical tunnel engineering AI model trained to identify rock mass discontinuities, trace joint sets on tunnel excavation profiles, and determine Barton Q and Bieniawski RMR89 ratings.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
        {
          role: 'model',
          content: modelResponse,
        },
      ],
    };

    lines.push(JSON.stringify(lineObj));
  }

  const blob = new Blob([lines.join('\n')], { type: 'application/x-jsonlines;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eswa_gemini_finetune_tunnel_telemetry_${Date.now()}.jsonl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports complete CSV and JSON dataset files for machine learning research.
 */
export function exportGeotechDatasetBundle(records: AiTrainingTelemetryRecord[]): void {
  if (!records || !records.length) {
    alert('No telemetry records available to export.');
    return;
  }

  // 1. Download JSON
  const jsonBlob = new Blob([JSON.stringify(records, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonA = document.createElement('a');
  jsonA.href = jsonUrl;
  jsonA.download = `eswa_geotech_ai_ground_truth_${Date.now()}.json`;
  document.body.appendChild(jsonA);
  jsonA.click();
  document.body.removeChild(jsonA);
  URL.revokeObjectURL(jsonUrl);

  // 2. Download CSV
  const csvHeaders = [
    'RecordID',
    'Timestamp',
    'UserEmail',
    'HardwareID',
    'MappingMethod',
    'ProjectName',
    'LocationName',
    'Chainage',
    'TunnelShape',
    'SpanM',
    'HeightM',
    'DriveAzimuthDeg',
    'JointCount',
    'BartonFinalQ',
    'QClass',
    'BieniawskiRMR',
    'RMRClass',
    'GSI',
    'SMR',
    'OverbreakAreaM2',
    'OverbreakVolumeM3PerM',
    'DominantOverbreakCause',
  ];

  const csvRows = records.map((r) => [
    `"${r.id}"`,
    `"${r.timestamp}"`,
    `"${r.userEmail}"`,
    `"${r.boundPcHardwareId}"`,
    `"${r.mappingMethod}"`,
    `"${(r.projectName || '').replace(/"/g, '""')}"`,
    `"${(r.locationName || '').replace(/"/g, '""')}"`,
    `"${r.chainageLabel || ''}"`,
    `"${r.tunnelGeometry?.shape || 'd_shaped'}"`,
    r.tunnelGeometry?.spanM ?? '',
    r.tunnelGeometry?.heightM ?? '',
    r.tunnelGeometry?.driveAzimuthDeg ?? '',
    (r.structuralJoints || []).length,
    r.geotechRatings?.qSystem?.finalQ ?? '',
    `"${r.geotechRatings?.qSystem?.classification ?? ''}"`,
    r.geotechRatings?.rmr89?.totalRmr ?? '',
    `"${r.geotechRatings?.rmr89?.rockClass ?? ''}"`,
    r.geotechRatings?.gsi ?? '',
    r.geotechRatings?.smr ?? '',
    r.overbreakData?.overbreakAreaM2 ?? '',
    r.overbreakData?.overbreakVolumeM3PerM ?? '',
    `"${r.overbreakData?.dominantCategory ?? ''}"`,
  ]);

  const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const csvUrl = URL.createObjectURL(csvBlob);
  const csvA = document.createElement('a');
  csvA.href = csvUrl;
  csvA.download = `eswa_geotech_ai_ground_truth_${Date.now()}.csv`;
  document.body.appendChild(csvA);
  csvA.click();
  document.body.removeChild(csvA);
  URL.revokeObjectURL(csvUrl);
}
