/**
 * UNIVERSAL DATA ROUTER & STRICT MODE ISOLATION ENGINE
 *
 * 1. Enforces strict data & storage isolation between NATM, TBM, and MINING vaults.
 * 2. Automatically detects the target application mode of any imported JSON file
 *    (even if imported while the user is viewing a different application mode)
 *    and routes the data exclusively into the matching isolated vault (NATM, TBM, or MINING).
 * 3. Supports explicit Cross-Application Record Transfer ("Send to NATM / TBM / Mining")
 *    so records sent to another application mode reflect cleanly in that mode's vault.
 * 4. Computes kilometer-scale linear advance and high-capacity storage health metrics.
 */

import { IndustryMode } from '../types/tunnel';
import {
  loadMiningProjects,
  saveMiningProjects,
  loadMiningStopes,
  saveMiningStopes,
  loadMiningDrillHoles,
  saveMiningDrillHoles,
  createMiningStope,
} from './miningStorageEngine';
import {
  loadTbmProjects,
  saveTbmProjects,
  loadTbmLocations,
  saveTbmLocations,
  loadTbmExcavationRecords,
  saveTbmExcavationRecords,
  createTbmExcavationRecord,
} from './tbmStorageEngine';
import {
  loadFieldMappingStore,
  saveFieldMappingStore,
  createNewExcavationRound,
  FieldExcavationRound,
} from './fieldMappingEngine';
import { loadSavedProjectsFromMemory } from './projectMemoryEngine';
import { MiningProjectItem, MiningStopeItem, MiningDrillHoleRecord } from '../types/mining';
import { TbmProjectItem, TbmLocationItem, TbmExcavationRecord } from '../types/tbm';

export interface UniversalRouteResult {
  success: boolean;
  targetApplication: IndustryMode;
  itemsRoutedCount: number;
  message: string;
  summaryMessage: string;
}

/**
 * Inspects any parsed JSON object and determines whether it belongs to
 * MINING, TBM, or NATM.
 */
export function detectPayloadApplicationMode(parsed: any): IndustryMode | null {
  if (!parsed || typeof parsed !== 'object') return null;

  // Explicit header tags
  if (
    parsed.applicationDomain === 'MINING' ||
    parsed.applicationMode === 'MINING' ||
    parsed.industryMode === 'MINING' ||
    parsed.suite === 'ESWA_UNDERGROUND_MINING'
  ) {
    return 'MINING';
  }
  if (
    parsed.applicationDomain === 'TBM' ||
    parsed.applicationMode === 'TBM' ||
    parsed.industryMode === 'TBM' ||
    parsed.format === 'ESWA_TBM_BACKUP_V1'
  ) {
    return 'TBM';
  }
  if (
    parsed.applicationDomain === 'NATM' ||
    parsed.applicationMode === 'NATM' ||
    parsed.industryMode === 'NATM' ||
    parsed.packageType === 'ESWA_COMPLETE_APP_PACKAGE_V1' ||
    parsed.packageType === 'ESWA_FACE_MASTER_COMPLETION_ARCHIVE_V1'
  ) {
    return 'NATM';
  }

  // Structural detection for MINING
  if (
    Array.isArray(parsed.stopes) ||
    Array.isArray(parsed.drillHoles) ||
    typeof parsed.stopeOrDriftId === 'string' ||
    (typeof parsed.holeId === 'string' && Array.isArray(parsed.runs))
  ) {
    return 'MINING';
  }

  // Structural detection for TBM
  if (
    (Array.isArray(parsed.records) && parsed.records[0]?.chainageRecord?.ringNumber !== undefined) ||
    parsed.chainageRecord?.ringNumber !== undefined ||
    parsed.tbmType !== undefined
  ) {
    return 'TBM';
  }

  // Structural detection for NATM
  if (
    parsed.fieldMappingStore ||
    Array.isArray(parsed.photogrammetrySavedProjects) ||
    (Array.isArray(parsed.projects) && Array.isArray(parsed.rounds)) ||
    (parsed.geometry && parsed.settings) ||
    (parsed.chainageFrom !== undefined && parsed.qSystem !== undefined)
  ) {
    return 'NATM';
  }

  return null;
}

/**
 * Merges or replaces Mining data strictly inside the Isolated Mining Vault.
 */
export function routeToIsolatedMiningVault(
  parsed: any,
  mode: 'merge' | 'replace' = 'merge'
): UniversalRouteResult {
  const currentProjects = mode === 'replace' ? [] : loadMiningProjects();
  const currentStopes = mode === 'replace' ? [] : loadMiningStopes();
  const currentHoles = mode === 'replace' ? [] : loadMiningDrillHoles();

  const projMap = new Map<string, MiningProjectItem>(currentProjects.map((p) => [p.id, p]));
  const stopeMap = new Map<string, MiningStopeItem>(currentStopes.map((s) => [s.id, s]));
  const holeMap = new Map<string, MiningDrillHoleRecord>(currentHoles.map((h) => [h.id, h]));

  let count = 0;

  if (Array.isArray(parsed.projects)) {
    for (const p of parsed.projects) {
      if (p && p.id) {
        projMap.set(p.id, p);
        count++;
      }
    }
  }
  if (Array.isArray(parsed.stopes)) {
    for (const s of parsed.stopes) {
      if (s && s.id) {
        stopeMap.set(s.id, s);
        count++;
      }
    }
  }
  if (Array.isArray(parsed.drillHoles)) {
    for (const h of parsed.drillHoles) {
      if (h && h.id) {
        holeMap.set(h.id, h);
        count++;
      }
    }
  }

  // Single Stope JSON
  if (typeof parsed.stopeOrDriftId === 'string') {
    const id = parsed.id || `STP-${Date.now().toString(36).toUpperCase()}`;
    stopeMap.set(id, { ...parsed, id });
    count++;
  }

  // Single Exploration Drillhole JSON
  if (typeof parsed.holeId === 'string' && Array.isArray(parsed.runs)) {
    const id = parsed.id || `DH-${Date.now().toString(36).toUpperCase()}`;
    holeMap.set(id, { ...parsed, id });
    count++;
  }

  saveMiningProjects(Array.from(projMap.values()));
  saveMiningStopes(Array.from(stopeMap.values()));
  saveMiningDrillHoles(Array.from(holeMap.values()));

  const msg = `Routed ${count} item(s) into Isolated MINING Vault (${stopeMap.size} Stopes, ${holeMap.size} Core Holes).`;
  return {
    success: true,
    targetApplication: 'MINING',
    itemsRoutedCount: count,
    message: msg,
    summaryMessage: msg,
  };
}

/**
 * Merges or replaces TBM data strictly inside the Isolated TBM Vault.
 */
export function routeToIsolatedTbmVault(
  parsed: any,
  mode: 'merge' | 'replace' = 'merge'
): UniversalRouteResult {
  const currentProjects = mode === 'replace' ? [] : loadTbmProjects();
  const currentLocations = mode === 'replace' ? [] : loadTbmLocations();
  const currentRecords = mode === 'replace' ? [] : loadTbmExcavationRecords();

  const projMap = new Map<string, TbmProjectItem>(currentProjects.map((p) => [p.id, p]));
  const locMap = new Map<string, TbmLocationItem>(currentLocations.map((l) => [l.id, l]));
  const recMap = new Map<string, TbmExcavationRecord>(currentRecords.map((r) => [r.id, r]));

  let count = 0;

  if (Array.isArray(parsed.projects)) {
    for (const p of parsed.projects) {
      if (p && p.id) {
        projMap.set(p.id, p);
        count++;
      }
    }
  }
  if (Array.isArray(parsed.locations)) {
    for (const l of parsed.locations) {
      if (l && l.id) {
        locMap.set(l.id, l);
        count++;
      }
    }
  }
  if (Array.isArray(parsed.records)) {
    for (const r of parsed.records) {
      if (r && r.id) {
        recMap.set(r.id, r);
        count++;
      }
    }
  }

  // Single TBM Ring Record JSON
  if (parsed.chainageRecord?.ringNumber !== undefined) {
    const id = parsed.id || `REC-R${parsed.chainageRecord.ringNumber}-${Date.now().toString(36)}`;
    recMap.set(id, { ...parsed, id });
    count++;
  }

  saveTbmProjects(Array.from(projMap.values()));
  saveTbmLocations(Array.from(locMap.values()));
  saveTbmExcavationRecords(Array.from(recMap.values()));

  const msg = `Routed ${count} item(s) into Isolated TBM Vault (${recMap.size} Ring Records, ${projMap.size} Projects).`;
  return {
    success: true,
    targetApplication: 'TBM',
    itemsRoutedCount: count,
    message: msg,
    summaryMessage: msg,
  };
}

export interface NormalizedTransferRecord {
  title: string;
  chainageFromM: number;
  chainageToM: number;
  widthM?: number;
  heightM?: number;
  lithology?: string;
  rqdPercent?: number;
  qValue?: number;
  rmrValue?: number;
  geologist?: string;
  notes?: string;
}

function normalizeAnyRecordToTransfer(raw: any): NormalizedTransferRecord {
  if (!raw || typeof raw !== 'object') {
    return { title: 'TRANSFERRED-01', chainageFromM: 0, chainageToM: 3.0 };
  }
  // Already normalized
  if (typeof raw.title === 'string' && typeof raw.chainageFromM === 'number') {
    return raw as NormalizedTransferRecord;
  }
  // TbmExcavationRecord
  if (raw.chainageRecord && typeof raw.chainageRecord.startChainage === 'number') {
    return {
      title: `TBM-RING-${raw.chainageRecord.ringNumber || 1}`,
      chainageFromM: Number(raw.chainageRecord.startChainage) || 0,
      chainageToM: Number(raw.chainageRecord.endChainage) || 1.5,
      lithology: raw.geology?.mainLithology || '',
      rqdPercent: raw.classification?.rqd || 0,
      qValue: raw.classification?.calculatedQ || 0,
      rmrValue: raw.classification?.calculatedRmr || 0,
      geologist: raw.chainageRecord?.geologistOrOperator || '',
      notes: raw.chainageRecord?.generalObservations || '',
    };
  }
  // FieldExcavationRound (NATM)
  if (raw.chainageFrom !== undefined && raw.chainageTo !== undefined) {
    const fromM = parseFloat(String(raw.chainageFrom)) || 0;
    const toM = parseFloat(String(raw.chainageTo)) || fromM + (Number(raw.pullLengthMeters) || 3);
    return {
      title: `NATM-CH-${raw.chainageFrom}-${raw.chainageTo}`,
      chainageFromM: fromM,
      chainageToM: toM,
      rqdPercent: raw.qSystem?.rqd || 0,
      geologist: raw.geologistName || raw.contractorGeologistName || '',
      notes: raw.geologicalDescription || '',
    };
  }
  // MiningStopeItem
  if (raw.stopeOrDriftId !== undefined) {
    return {
      title: String(raw.stopeOrDriftId || 'MINING-DRV'),
      chainageFromM: Number(raw.chainageFromM) || 0,
      chainageToM: Number(raw.chainageToM) || 3.5,
      widthM: Number(raw.stopeWidthM) || 4.8,
      heightM: Number(raw.stopeHeightM) || 4.5,
      rqdPercent: Number(raw.rockMassClassification?.rqdPercent) || 0,
      qValue: Number(raw.rockMassClassification?.qSystemValue) || 0,
      rmrValue: Number(raw.rockMassClassification?.rmr89Total) || 0,
      geologist: raw.responsibleGeologist || '',
      notes: raw.geologistRemarks || '',
    };
  }
  return {
    title: String(raw.id || 'RECORD-01'),
    chainageFromM: 0,
    chainageToM: 3.0,
  };
}

/**
 * Converts and transfers a record from one application mode to another
 * so that if a user sends data to another application mode (NATM ↔ TBM ↔ MINING),
 * it immediately reflects in that target application's isolated vault.
 * Supports both:
 *   transferRecordToApplicationMode(targetMode, sourceData)
 *   transferRecordToApplicationMode(sourceMode, targetMode, rawRecord)
 */
export function transferRecordToApplicationMode(
  arg1: IndustryMode,
  arg2: IndustryMode | NormalizedTransferRecord | any,
  arg3?: any
): UniversalRouteResult {
  const targetMode: IndustryMode =
    arg3 !== undefined && (arg2 === 'NATM' || arg2 === 'TBM' || arg2 === 'MINING')
      ? arg2
      : arg1;
  const rawPayload = arg3 !== undefined ? arg3 : arg2;
  const sourceData = normalizeAnyRecordToTransfer(rawPayload);

  const pull = Math.max(0.5, Number((sourceData.chainageToM - sourceData.chainageFromM).toFixed(2)));

  if (targetMode === 'MINING') {
    const created = createMiningStope({
      stopeOrDriftId: sourceData.title || 'TRANSFERRED-DRV-01',
      faceName: `RD ${sourceData.chainageFromM.toFixed(1)}m - ${sourceData.chainageToM.toFixed(1)}m`,
      currentHeadingRdChainage: `RD ${sourceData.chainageFromM.toFixed(1)}m - ${sourceData.chainageToM.toFixed(1)}m`,
      chainageFromM: sourceData.chainageFromM,
      chainageToM: sourceData.chainageToM,
      blastPullMeters: pull,
      stopeWidthM: sourceData.widthM || 4.8,
      stopeHeightM: sourceData.heightM || 4.5,
      responsibleGeologist: sourceData.geologist || 'Transferred from Tunnel Suite',
    });
    const msg = `Sent "${created.stopeOrDriftId} (${created.currentHeadingRdChainage})" to Isolated MINING Vault.`;
    return {
      success: true,
      targetApplication: 'MINING',
      itemsRoutedCount: 1,
      message: msg,
      summaryMessage: msg,
    };
  }

  if (targetMode === 'TBM') {
    const recs = loadTbmExcavationRecords();
    const created = createTbmExcavationRecord({
      chainageRecord: {
        recordId: `REC-TR-${Date.now().toString(36).toUpperCase()}`,
        locationId: '',
        projectId: '',
        timestamp: new Date().toISOString(),
        startChainage: sourceData.chainageFromM,
        endChainage: sourceData.chainageToM,
        advanceLengthMeters: pull,
        ringNumber: recs.length + 1,
        shift: 'DAY',
        shiftStartTime: '08:00',
        shiftEndTime: '16:00',
        stoppageDurationMinutes: 0,
        stoppageReason: '',
        geologistOrOperator: sourceData.geologist || '',
        generalObservations: sourceData.notes || `Transferred record (${sourceData.title})`,
      },
    });
    const msg = `Sent Ring #${created.chainageRecord.ringNumber} (RD ${sourceData.chainageFromM.toFixed(1)}–${sourceData.chainageToM.toFixed(1)}m) to Isolated TBM Vault.`;
    return {
      success: true,
      targetApplication: 'TBM',
      itemsRoutedCount: 1,
      message: msg,
      summaryMessage: msg,
    };
  }

  // Target = NATM
  const store = loadFieldMappingStore('TUNNEL');
  const activeProj = store.projects[0];
  const activeLoc = activeProj?.locations[0];
  const baseRound = createNewExcavationRound(
    activeProj || {
      id: 'proj-1',
      projectName: 'Transferred Tunnel Project',
      clientName: '',
      contractorName: '',
      consultantName: '',
      createdAt: new Date().toISOString(),
      locations: [],
    },
    activeLoc || ({
      id: 'loc-1',
      name: 'Main Heading',
      shape: 'horseshoe',
      widthM: sourceData.widthM || 8.0,
      heightM: sourceData.heightM || 7.0,
      wallHeightM: 4.0,
      archHeightM: 3.0,
    } as any),
    null,
    'TUNNEL'
  );

  const newRound: FieldExcavationRound = {
    ...baseRound,
    id: `rnd-tr-${Date.now()}`,
    chainageFrom: String(sourceData.chainageFromM),
    chainageTo: String(sourceData.chainageToM),
    pullLengthMeters: pull,
    geologistName: sourceData.geologist || '',
    geologicalDescription: sourceData.notes || '',
    qSystem: {
      rqd: sourceData.rqdPercent ?? 0,
      jn: 0,
      jr: 0,
      ja: 0,
      jw: 0,
      srf: 0,
    },
  };

  const nextStore = {
    ...store,
    rounds: [newRound, ...store.rounds],
    activeRoundId: newRound.id,
  };
  saveFieldMappingStore(nextStore, 'TUNNEL');

  const msg = `Sent CH ${newRound.chainageFrom}–${newRound.chainageTo}m to Isolated NATM Field Vault.`;
  return {
    success: true,
    targetApplication: 'NATM',
    itemsRoutedCount: 1,
    message: msg,
    summaryMessage: msg,
  };
}

/**
 * Computes multi-kilometer scale telemetry for the specified isolated mode.
 */
export function getIsolatedVaultTelemetry(mode: IndustryMode): {
  mode: IndustryMode;
  totalLinearMeters: number;
  totalLinearKilometers: number;
  recordCount: number;
  projectCount: number;
  secondaryCount: number;
  capacityLabel: string;
} {
  if (mode === 'TBM') {
    const projects = loadTbmProjects();
    const locations = loadTbmLocations();
    const records = loadTbmExcavationRecords();
    const totalLinearMeters = records.reduce(
      (acc, r) =>
        acc +
        Math.max(
          0,
          Math.abs((r.chainageRecord?.endChainage || 0) - (r.chainageRecord?.startChainage || 0))
        ),
      0
    );
    return {
      mode: 'TBM',
      totalLinearMeters,
      totalLinearKilometers: totalLinearMeters / 1000,
      recordCount: records.length,
      projectCount: projects.length,
      secondaryCount: locations.length,
      capacityLabel: 'IndexedDB Multi-Kilometer Vault Active (Zero-Crash)',
    };
  }

  if (mode === 'MINING') {
    const projects = loadMiningProjects();
    const stopes = loadMiningStopes();
    const holes = loadMiningDrillHoles();
    const stopeMeters = stopes.reduce((acc, s) => acc + (s.blastPullMeters || 0), 0);
    const holeMeters = holes.reduce(
      (acc, h) =>
        acc +
        (h.runs || []).reduce((rAcc, r) => rAcc + Math.max(0, r.toDepthM - r.fromDepthM), 0),
      0
    );
    const totalLinearMeters = stopeMeters + holeMeters;
    return {
      mode: 'MINING',
      totalLinearMeters,
      totalLinearKilometers: totalLinearMeters / 1000,
      recordCount: stopes.length,
      projectCount: projects.length,
      secondaryCount: holes.length,
      capacityLabel: 'IndexedDB Multi-Kilometer Vault Active (Zero-Crash)',
    };
  }

  // NATM
  const fieldStore = loadFieldMappingStore('TUNNEL');
  const photoProjs = loadSavedProjectsFromMemory();
  const fieldMeters = (fieldStore.rounds || []).reduce(
    (acc, r) => acc + (Number(r.pullLengthMeters) || 0),
    0
  );
  const photoMeters = photoProjs.reduce(
    (acc, p) => acc + (Number(p.settings?.roundLength) || 0),
    0
  );
  const totalLinearMeters = fieldMeters + photoMeters;
  return {
    mode: 'NATM',
    totalLinearMeters,
    totalLinearKilometers: totalLinearMeters / 1000,
    recordCount: (fieldStore.rounds?.length || 0) + photoProjs.length,
    projectCount: fieldStore.projects?.length || 0,
    secondaryCount: photoProjs.length,
    capacityLabel: 'IndexedDB Multi-Kilometer Vault Active (Zero-Crash)',
  };
}
