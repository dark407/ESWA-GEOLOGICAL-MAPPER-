import { deleteDoc, doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  firestoreCloudPermissionDenied,
  getApiBase,
  handleFirestoreError,
  OperationType,
} from '../firebase';

export type EngineeringModuleName =
  | 'projects'
  | 'core_logs'
  | 'monitoring'
  | 'blast_assessments';

export interface EngineeringSyncStatus {
  state: 'local_only' | 'syncing' | 'synced' | 'offline_queued';
  lastSyncedAtIso: string | null;
  cloudConnected: boolean;
  serverMirrorConnected: boolean;
  lastError?: string | null;
}

interface PendingSyncItem {
  module: EngineeringModuleName;
  id: string;
  action: 'upsert' | 'delete';
  record?: Record<string, unknown>;
  updatedAtIso: string;
}

const PENDING_SYNC_QUEUE_KEY = 'eswa_engineering_pending_sync_v1';
const SYNC_STATUS_EVENT = 'eswa-engineering-sync-status-updated';

let currentSyncStatus: EngineeringSyncStatus = {
  state: 'local_only',
  lastSyncedAtIso: null,
  cloudConnected: false,
  serverMirrorConnected: false,
  lastError: null,
};

const listeners = new Set<(status: EngineeringSyncStatus) => void>();

function notifySyncStatus(partial: Partial<EngineeringSyncStatus>): void {
  currentSyncStatus = {
    ...currentSyncStatus,
    ...partial,
    cloudConnected: Boolean(auth.currentUser && !firestoreCloudPermissionDenied),
  };
  listeners.forEach((cb) => {
    try {
      cb(currentSyncStatus);
    } catch {
      // Ignore subscriber errors
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SYNC_STATUS_EVENT, { detail: currentSyncStatus })
    );
  }
}

export function getEngineeringSyncStatus(): EngineeringSyncStatus {
  return {
    ...currentSyncStatus,
    cloudConnected: Boolean(auth.currentUser && !firestoreCloudPermissionDenied),
  };
}

export function subscribeEngineeringSyncStatus(
  cb: (status: EngineeringSyncStatus) => void
): () => void {
  listeners.add(cb);
  cb(getEngineeringSyncStatus());
  return () => {
    listeners.delete(cb);
  };
}

export function sanitizeFirestoreDocId(rawId: string): string {
  const clean = String(rawId || 'item')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return clean || `doc_${Date.now()}`;
}

function getWorkstationOwnerScope(): string {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  try {
    const hwId = localStorage.getItem('eswa_pc_hardware_fingerprint_v1') || '';
    if (hwId.trim()) return sanitizeFirestoreDocId(hwId);
  } catch {
    // Ignore storage read errors
  }
  return 'local_workstation';
}

function loadPendingQueue(): PendingSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSyncItem[]) : [];
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingSyncItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(PENDING_SYNC_QUEUE_KEY);
    } else {
      localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-120)));
    }
  } catch {
    // Ignore storage errors
  }
}

function enqueuePendingSync(item: PendingSyncItem): void {
  const existing = loadPendingQueue().filter(
    (q) => !(q.module === item.module && q.id === item.id)
  );
  savePendingQueue([...existing, item]);
}

async function ensureUserWorkspaceParentDoc(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user || !user.uid || firestoreCloudPermissionDenied) return null;
  if (!user.emailVerified) return null;
  const uid = user.uid;
  const docRef = doc(db, 'user_workspaces', uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        uid,
        email: (user.email || 'user@gmail.com').slice(0, 160),
        displayName: (user.displayName || user.email || 'ESWA Geologist').slice(0, 160),
        updatedAtIso: new Date().toISOString(),
        payloadJson: '{}',
      });
    }
    return uid;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, `user_workspaces/${uid}`);
    } catch {
      // Structured error logged/marked
    }
    return null;
  }
}

function buildValidatedCloudDocument(
  module: EngineeringModuleName,
  id: string,
  uid: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const nowIso = String(payload.updatedAtIso || new Date().toISOString()).slice(0, 64);
  const rawJson = JSON.stringify(payload);
  const safeJson = rawJson.length <= 840000 ? rawJson : JSON.stringify({ id, truncated: true, updatedAtIso: nowIso });
  const rawMode = String(payload.industryMode || 'NATM').toUpperCase();
  const industryMode = rawMode === 'TBM' || rawMode === 'MINING' ? rawMode : 'NATM';

  if (module === 'projects') {
    return {
      id,
      uid,
      projectName: String(payload.projectName || payload.tunnelName || 'ESWA Tunnel Project').slice(0, 160) || 'ESWA Tunnel Project',
      locationName: String(payload.location || payload.locationName || '').slice(0, 160),
      industryMode,
      chainageLabel: String(payload.faceChainage || payload.chainage || '').slice(0, 120),
      updatedAtIso: nowIso,
      payloadJson: safeJson,
    };
  }
  if (module === 'core_logs') {
    return {
      id,
      uid,
      boreholeId: String(payload.boreholeId || payload.name || id).slice(0, 120) || id,
      projectName: String(payload.projectName || '').slice(0, 160),
      industryMode,
      updatedAtIso: nowIso,
      payloadJson: safeJson,
    };
  }
  if (module === 'monitoring') {
    const structType = payload.structureType === 'vertical_shaft' ? 'vertical_shaft' : 'tunnel';
    return {
      id,
      uid,
      project: String(payload.project || 'Default Project').slice(0, 160) || 'Default Project',
      location: String(payload.location || 'Default Location').slice(0, 160) || 'Default Location',
      structureType: structType,
      updatedAtIso: nowIso,
      payloadJson: safeJson,
    };
  }
  return {
    id,
    uid,
    projectName: String(payload.projectName || '').slice(0, 160),
    tunnelShape: String(payload.tunnelShape || '').slice(0, 80),
    verdict: String(payload.verdict || 'ANALYZED').slice(0, 64) || 'ANALYZED',
    updatedAtIso: nowIso,
    payloadJson: safeJson.slice(0, 445000),
  };
}

async function mirrorToExpressServer(
  action: 'upsert' | 'delete',
  module: EngineeringModuleName,
  id: string,
  record?: Record<string, unknown>
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const ownerScope = getWorkstationOwnerScope();
    const apiBase = getApiBase();
    const resp = await fetch(`${apiBase}/api/engineering/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ESWA-User-UID': ownerScope,
      },
      body: JSON.stringify({
        ownerScope,
        module,
        id,
        record,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function syncEngineeringModuleRecord(
  module: EngineeringModuleName,
  rawId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const id = sanitizeFirestoreDocId(rawId);
  const updatedAtIso = new Date().toISOString();
  notifySyncStatus({ state: 'syncing' });

  const srvOk = await mirrorToExpressServer('upsert', module, id, payload);

  const uid = await ensureUserWorkspaceParentDoc();
  let cloudOk = false;
  if (uid && !firestoreCloudPermissionDenied) {
    const path = `user_workspaces/${uid}/${module}/${id}`;
    try {
      const cloudDoc = buildValidatedCloudDocument(module, id, uid, payload);
      await setDoc(doc(db, 'user_workspaces', uid, module, id), cloudDoc);
      cloudOk = true;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch {
        // Structured error logged cleanly
      }
    }
  }

  if (!srvOk && !cloudOk) {
    enqueuePendingSync({
      module,
      id,
      action: 'upsert',
      record: payload,
      updatedAtIso,
    });
    notifySyncStatus({
      state: 'offline_queued',
      serverMirrorConnected: srvOk,
    });
    return;
  }

  notifySyncStatus({
    state: cloudOk || srvOk ? 'synced' : 'local_only',
    lastSyncedAtIso: updatedAtIso,
    serverMirrorConnected: srvOk,
    lastError: null,
  });
}

export async function deleteEngineeringModuleRecord(
  module: EngineeringModuleName,
  rawId: string
): Promise<void> {
  const id = sanitizeFirestoreDocId(rawId);
  const srvOk = await mirrorToExpressServer('delete', module, id);
  const user = auth.currentUser;
  if (user && user.uid && user.emailVerified && !firestoreCloudPermissionDenied) {
    const path = `user_workspaces/${user.uid}/${module}/${id}`;
    try {
      await deleteDoc(doc(db, 'user_workspaces', user.uid, module, id));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch {
        // Logged cleanly
      }
    }
  }
  if (!srvOk && typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueuePendingSync({
      module,
      id,
      action: 'delete',
      updatedAtIso: new Date().toISOString(),
    });
  }
}

export async function flushPendingEngineeringQueue(): Promise<number> {
  const queue = loadPendingQueue();
  if (queue.length === 0) return 0;
  let flushed = 0;
  const remaining: PendingSyncItem[] = [];
  for (const item of queue) {
    if (item.action === 'delete') {
      const ok = await mirrorToExpressServer('delete', item.module, item.id);
      if (ok) flushed++;
      else remaining.push(item);
    } else if (item.record) {
      const ok = await mirrorToExpressServer('upsert', item.module, item.id, item.record);
      if (ok) flushed++;
      else remaining.push(item);
    }
  }
  savePendingQueue(remaining);
  if (flushed > 0) {
    notifySyncStatus({
      state: 'synced',
      lastSyncedAtIso: new Date().toISOString(),
      serverMirrorConnected: true,
    });
  }
  return flushed;
}

export async function pullEngineeringModulesFromServerAndCloud(): Promise<{
  projects: Record<string, unknown>[];
  core_logs: Record<string, unknown>[];
  monitoring: Record<string, unknown>[];
  blast_assessments: Record<string, unknown>[];
}> {
  const result: {
    projects: Record<string, unknown>[];
    core_logs: Record<string, unknown>[];
    monitoring: Record<string, unknown>[];
    blast_assessments: Record<string, unknown>[];
  } = {
    projects: [],
    core_logs: [],
    monitoring: [],
    blast_assessments: [],
  };

  try {
    const ownerScope = getWorkstationOwnerScope();
    const apiBase = getApiBase();
    const resp = await fetch(
      `${apiBase}/api/engineering/state?ownerScope=${encodeURIComponent(ownerScope)}`
    );
    if (resp.ok) {
      const json = (await resp.json()) as {
        ok?: boolean;
        modules?: Partial<typeof result>;
      };
      if (json.ok && json.modules) {
        if (Array.isArray(json.modules.projects)) result.projects = json.modules.projects;
        if (Array.isArray(json.modules.core_logs)) result.core_logs = json.modules.core_logs;
        if (Array.isArray(json.modules.monitoring)) result.monitoring = json.modules.monitoring;
        if (Array.isArray(json.modules.blast_assessments)) {
          result.blast_assessments = json.modules.blast_assessments;
        }
        notifySyncStatus({ serverMirrorConnected: true });
      }
    }
  } catch {
    // Offline fallback cleanly
  }

  const user = auth.currentUser;
  if (user && user.uid && user.emailVerified && !firestoreCloudPermissionDenied) {
    const modules: EngineeringModuleName[] = [
      'projects',
      'core_logs',
      'monitoring',
      'blast_assessments',
    ];
    for (const mod of modules) {
      try {
        const snap = await getDocs(collection(db, 'user_workspaces', user.uid, mod));
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.payloadJson && typeof data.payloadJson === 'string') {
            try {
              const parsed = JSON.parse(data.payloadJson);
              if (parsed && typeof parsed === 'object') {
                result[mod].push(parsed as Record<string, unknown>);
              }
            } catch {
              // Ignore malformed doc
            }
          }
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.LIST, `user_workspaces/${user.uid}/${mod}`);
        } catch {
          // Structured error logged
        }
      }
    }
  }

  return result;
}
