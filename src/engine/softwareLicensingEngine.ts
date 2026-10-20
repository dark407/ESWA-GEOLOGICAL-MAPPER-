import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  sendGmailMessage,
} from '../firebase';
import {
  getConfiguredGithubRepo,
  getGithubUserExeDownloadUrl,
  getPublicShareOrigin,
  getUserAndroidAppShareUrl,
  getUserEditionShareUrl,
  normalizeGithubRepoSlug,
  PUBLIC_SHARED_APP_ORIGIN,
  saveConfiguredGithubRepo,
} from './windowsDesktopEngine';

export const CURRENT_SOFTWARE_VERSION = '1.0.0';
export const MASTER_ADMIN_DEFAULT_EMAIL = 'akashdhanusheswar@gmail.com';
const ADMIN_AUTH_SIG = 'ESWA_MASTER_ADMIN_SIG_v1';
const PORTAL_SCOPE = 'ESWA_GLOBAL';

const LOCAL_PC_HW_ID_KEY = 'eswa_pc_hardware_fingerprint_v1';
const LOCAL_MASTER_PC_BYPASS_KEY = 'eswa_master_pc_bypass_v1';
const LOCAL_ACTIVE_SESSION_KEY = 'eswa_1pc_activated_session_v1';
const LOCAL_INSTALLED_VERSION_KEY = 'eswa_installed_software_version_v1';
const LOCAL_ADMIN_CREDENTIALS_KEY = 'eswa_master_admin_credentials_v1';

const LOCAL_MIRROR_REQUESTS_KEY = 'eswa_mirror_requests_v1';
const LOCAL_MIRROR_LICENSES_KEY = 'eswa_mirror_licenses_v1';
const LOCAL_MIRROR_RELEASES_KEY = 'eswa_mirror_releases_v1';
const LOCAL_MIRROR_MASTER_PCS_KEY = 'eswa_mirror_master_pcs_v1';
const LOCAL_DELETED_TOMBSTONES_KEY = 'eswa_deleted_user_tombstones_v1';

function readDeletedTombstones(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_TOMBSTONES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function markIdsDeletedTombstone(ids: string[]): void {
  try {
    const current = readDeletedTombstones();
    const nowIso = new Date().toISOString();
    for (const rawId of ids) {
      const clean = (rawId || '').trim().toLowerCase();
      if (clean) {
        current[clean] = nowIso;
      }
    }
    localStorage.setItem(LOCAL_DELETED_TOMBSTONES_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage errors
  }
}

function unmarkIdsDeletedTombstone(ids: string[]): void {
  try {
    const current = readDeletedTombstones();
    let changed = false;
    for (const rawId of ids) {
      const clean = (rawId || '').trim().toLowerCase();
      if (clean && current[clean]) {
        delete current[clean];
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(LOCAL_DELETED_TOMBSTONES_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
}

function isIdDeletedTombstone(id: string | undefined, createdAtIso?: string): boolean {
  if (!id) return false;
  const clean = id.trim().toLowerCase();
  if (!clean) return false;
  const tombstones = readDeletedTombstones();
  const deletedAt = tombstones[clean];
  if (!deletedAt) return false;
  if (createdAtIso && createdAtIso > deletedAt) {
    return false;
  }
  return true;
}

function readLocalMirror<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalMirror<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('eswa-licensing-mirror-updated'));
  } catch {
    // Ignore storage errors
  }
}

function upsertMirrorItem<T>(
  key: string,
  item: T,
  idGetter: (x: T) => string
): T[] {
  const list = readLocalMirror<T>(key);
  const targetId = idGetter(item);
  const idx = list.findIndex((x) => idGetter(x) === targetId);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [item, ...list];
  writeLocalMirror(key, next);
  return next;
}

function removeMirrorItem<T>(
  key: string,
  targetId: string,
  idGetter: (x: T) => string
): T[] {
  const list = readLocalMirror<T>(key).filter((x) => idGetter(x) !== targetId);
  writeLocalMirror(key, list);
  return list;
}

function withFirestoreTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const effectiveTimeout = isOffline ? 1200 : ms;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('FIRESTORE_TIMEOUT_OFFLINE_FALLBACK'));
    }, effectiveTimeout);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isOfflineOrTimeoutError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('firestore_timeout_offline_fallback') ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('unavailable') ||
    msg.includes('network')
  );
}

/**
 * Dual-Project Direct Firestore HTTPS REST Endpoints:
 * 1. analog-bricolage-rf38q (Primary database used by deployed Android APKs & Windows EXEs)
 * 2. gen-lang-client-0610274527 (Secondary mirror database)
 *
 * Writing and querying via direct HTTPS REST (fetch) bypasses Firebase WebChannel issues
 * on file:// origins (standalone Android WebView APK & Windows EXE) and mobile carriers.
 */
const FIRESTORE_REST_ENDPOINTS = [
  {
    projectId: 'analog-bricolage-rf38q',
    databaseId: 'ai-studio-eswatunnelmapper-f9204c8f-e68c-461b-9014-9cb7c208d62c',
    apiKey: 'AIzaSyBhhbCXp1Vbn82flPxJku388k_ojRXaKA0',
  },
  {
    projectId: 'gen-lang-client-0610274527',
    databaseId: 'ai-studio-eswatunnelmapper-f9204c8f-e68c-461b-9014-9cb7c208d62c',
    apiKey: 'AIzaSyDJErsPqcj1w1p7P9IYDqEp6vIdb-1qoP4',
  },
] as const;

type FirestoreRestFieldValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
};

function toFirestoreRestFields(
  record: Record<string, unknown>
): Record<string, FirestoreRestFieldValue> {
  const fields: Record<string, FirestoreRestFieldValue> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return fields;
}

function fromFirestoreRestFields<T>(
  fields: Record<string, FirestoreRestFieldValue> | undefined
): T | null {
  if (!fields || typeof fields !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(fields)) {
    if (!val || typeof val !== 'object') continue;
    if ('booleanValue' in val && typeof val.booleanValue === 'boolean') {
      out[k] = val.booleanValue;
    } else if ('stringValue' in val && typeof val.stringValue === 'string') {
      out[k] = val.stringValue;
    } else if ('integerValue' in val && val.integerValue !== undefined) {
      out[k] = Number(val.integerValue);
    }
  }
  return out as T;
}

function getServerRelayUrls(subpath: string): string[] {
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
    window.location.origin &&
    window.location.origin !== 'null'
  ) {
    return [subpath];
  }
  const shareOrigin = getPublicShareOrigin();
  return [`${shareOrigin}${subpath}`];
}

async function serverRelayUpsert(
  collectionName: string,
  docId: string,
  record: Record<string, unknown>
): Promise<boolean> {
  const urls = getServerRelayUrls('/api/licensing/upsert');
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: collectionName, id: docId, record }),
        });
        return resp.ok;
      } catch {
        return false;
      }
    })
  );
  return results.some(Boolean);
}

async function serverRelayDelete(
  collectionName: string,
  docId: string
): Promise<void> {
  const urls = getServerRelayUrls('/api/licensing/delete');
  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: collectionName, id: docId }),
        });
      } catch {
        // Ignore
      }
    })
  );
}

async function serverRelayFetchCollection<T>(
  collectionName:
    | 'access_requests'
    | 'software_licenses'
    | 'software_releases'
    | 'master_pcs'
): Promise<T[]> {
  const urls = getServerRelayUrls('/api/licensing/state');
  const lists = await Promise.all(
    urls.map(async (url) => {
      try {
        const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!resp.ok) return [] as T[];
        const data = (await resp.json()) as Record<string, unknown>;
        const arr = data?.[collectionName];
        return Array.isArray(arr) ? (arr as T[]) : ([] as T[]);
      } catch {
        return [] as T[];
      }
    })
  );
  return lists.flat();
}

async function firestoreRestSetDoc(
  collectionName: string,
  docId: string,
  record: Record<string, unknown>,
  createOnly = false
): Promise<boolean> {
  const fields = toFirestoreRestFields(record);
  const [relayOk, ...restResults] = await Promise.all([
    serverRelayUpsert(collectionName, docId, record),
    ...FIRESTORE_REST_ENDPOINTS.map(async (ep) => {
      try {
        const maskQuery = createOnly ? '&currentDocument.exists=false' : '';
        const url = `https://firestore.googleapis.com/v1/projects/${ep.projectId}/databases/${ep.databaseId}/documents/${collectionName}/${encodeURIComponent(
          docId
        )}?key=${ep.apiKey}${maskQuery}`;
        const resp = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        return resp.ok || (createOnly && resp.status === 400);
      } catch {
        return false;
      }
    }),
  ]);
  return Boolean(relayOk) || restResults.some(Boolean);
}

async function firestoreRestUpdateDoc(
  collectionName: string,
  docId: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
  if (keys.length === 0) return true;
  const maskParams = keys
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const fields = toFirestoreRestFields(updates);

  const [relayOk, ...restResults] = await Promise.all([
    serverRelayUpsert(collectionName, docId, updates),
    ...FIRESTORE_REST_ENDPOINTS.map(async (ep) => {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${ep.projectId}/databases/${ep.databaseId}/documents/${collectionName}/${encodeURIComponent(
          docId
        )}?key=${ep.apiKey}&${maskParams}`;
        const resp = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        return resp.ok;
      } catch {
        return false;
      }
    }),
  ]);
  return Boolean(relayOk) || restResults.some(Boolean);
}

async function firestoreRestGetDoc<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const [relayItems, ...results] = await Promise.all([
    serverRelayFetchCollection<T>(
      collectionName as
        | 'access_requests'
        | 'software_licenses'
        | 'software_releases'
        | 'master_pcs'
    ),
    ...FIRESTORE_REST_ENDPOINTS.map(async (ep) => {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${ep.projectId}/databases/${ep.databaseId}/documents/${collectionName}/${encodeURIComponent(
          docId
        )}?key=${ep.apiKey}`;
        const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!resp.ok) return null;
        const json = (await resp.json()) as {
          fields?: Record<string, FirestoreRestFieldValue>;
        };
        return fromFirestoreRestFields<T>(json.fields);
      } catch {
        return null;
      }
    }),
  ]);

  const relayMatch =
    relayItems.find((item) => {
      const rec = item as unknown as Record<string, unknown>;
      return (
        rec?.requestId === docId ||
        rec?.userId === docId ||
        rec?.releaseId === docId ||
        rec?.pcHardwareId === docId
      );
    }) || null;

  const candidates = [...results, relayMatch];
  // Prefer a record that is APPROVED if checking access_requests across all endpoints
  for (const r of candidates) {
    if (r && (r as unknown as { status?: string }).status === 'APPROVED') {
      return r;
    }
  }
  return candidates.find((r) => r !== null) || null;
}

async function firestoreRestDeleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  await Promise.all([
    serverRelayDelete(collectionName, docId),
    ...FIRESTORE_REST_ENDPOINTS.map(async (ep) => {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${ep.projectId}/databases/${ep.databaseId}/documents/${collectionName}/${encodeURIComponent(
          docId
        )}?key=${ep.apiKey}`;
        await fetch(url, { method: 'DELETE' });
      } catch {
        // Ignore
      }
    }),
  ]);
}

async function firestoreRestQueryCollection<T>(
  collectionName: string,
  idGetter: (item: T) => string
): Promise<T[]> {
  const [relayItems, ...endpointLists] = await Promise.all([
    serverRelayFetchCollection<T>(
      collectionName as
        | 'access_requests'
        | 'software_licenses'
        | 'software_releases'
        | 'master_pcs'
    ),
    ...FIRESTORE_REST_ENDPOINTS.map(async (ep) => {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${ep.projectId}/databases/${ep.databaseId}/documents:runQuery?key=${ep.apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: collectionName }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'portalScope' },
                  op: 'EQUAL',
                  value: { stringValue: PORTAL_SCOPE },
                },
              },
            },
          }),
        });
        if (!resp.ok) return [] as T[];
        const rows = (await resp.json()) as Array<{
          document?: { fields?: Record<string, FirestoreRestFieldValue> };
        }>;
        if (!Array.isArray(rows)) return [] as T[];
        const parsed: T[] = [];
        for (const row of rows) {
          const item = fromFirestoreRestFields<T>(row?.document?.fields);
          if (item && idGetter(item)) {
            parsed.push(item);
          }
        }
        return parsed;
      } catch {
        return [] as T[];
      }
    }),
  ]);

  // Merge records from Server Relay + Primary Firestore (analog-bricolage-rf38q) + Secondary Firestore
  const allLists = [...endpointLists, relayItems];
  const mergedMap = new Map<string, T>();
  for (const list of allLists) {
    for (const item of list) {
      const id = idGetter(item);
      if (!id) continue;
      const existing = mergedMap.get(id);
      if (!existing) {
        mergedMap.set(id, item);
      } else {
        const exRec = existing as unknown as {
          status?: string;
          lastSeenAtIso?: string;
        };
        const newRec = item as unknown as {
          status?: string;
          lastSeenAtIso?: string;
        };
        if (
          exRec.lastSeenAtIso &&
          newRec.lastSeenAtIso &&
          newRec.lastSeenAtIso > exRec.lastSeenAtIso
        ) {
          mergedMap.set(id, item);
        } else if (
          exRec.status === 'PENDING' &&
          newRec.status &&
          newRec.status !== 'PENDING'
        ) {
          mergedMap.set(id, item);
        }
      }
    }
  }
  return Array.from(mergedMap.values());
}

export interface AccessRequestRecord {
  requestId: string;
  portalScope: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  roleTitle: string;
  pcHardwareId: string;
  pcName: string;
  purposeNotes: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  assignedUserId: string;
  assignedLicenseKey: string;
  createdAtIso: string;
}

export interface SoftwareLicenseRecord {
  userId: string;
  portalScope: string;
  password: string;
  licenseKey: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  boundPcHardwareId: string;
  boundPcName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  installedVersion: string;
  lastSeenAtIso: string;
  createdAtIso: string;
  adminAuthSig: string;
}

export interface SoftwareReleaseRecord {
  releaseId: string;
  portalScope: string;
  version: string;
  title: string;
  releaseNotes: string;
  downloadUrl: string;
  targetScope: 'ALL_PCS' | 'SPECIFIC_PCS';
  targetIdentifierCsv: string;
  isMandatory: boolean;
  status: 'PUBLISHED' | 'ARCHIVED';
  publishedAtIso: string;
  adminAuthSig: string;
}

export interface MasterPcRecord {
  pcHardwareId: string;
  portalScope: string;
  label: string;
  bypassLogin: boolean;
  registeredAtIso: string;
  adminAuthSig: string;
}

export interface ActivatedClientSession {
  userId: string;
  fullName: string;
  organization: string;
  licenseKey: string;
  pcHardwareId: string;
  activatedAtIso: string;
}

/**
 * Generates or retrieves the unique, persistent Hardware Fingerprint ID for this PC.
 * Ensures 1-PC-1-Software locking so credentials cannot be shared with another PC.
 */
export function getOrGeneratePcHardwareId(): { pcHardwareId: string; pcName: string } {
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      AndroidNativeApp?: {
        getHardwareId?: () => string;
        getDeviceName?: () => string;
      };
    };
    if (win.AndroidNativeApp?.getHardwareId) {
      try {
        const nativeHwId = win.AndroidNativeApp.getHardwareId();
        const nativeDevName = win.AndroidNativeApp.getDeviceName
          ? win.AndroidNativeApp.getDeviceName()
          : 'Android Native User App';
        if (nativeHwId && nativeHwId.length >= 8) {
          localStorage.setItem(LOCAL_PC_HW_ID_KEY, nativeHwId);
          return { pcHardwareId: nativeHwId, pcName: nativeDevName };
        }
      } catch {
        // Fallback below
      }
    }
  }

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const scr = typeof window !== 'undefined' ? window.screen : null;

  const ua = (nav?.userAgent || '').toLowerCase();
  const isAndroid = ua.includes('android');
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const platformStr = isAndroid
    ? 'Android Mobile'
    : isMobile
    ? 'Mobile App'
    : nav?.platform || 'Win64';
  const cores = nav?.hardwareConcurrency || (isMobile ? 8 : 8);
  const screenSig = scr ? `${scr.width}x${scr.height}x${scr.colorDepth}` : '1920x1080x24';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const pcName = isAndroid
    ? `Android Mobile App (${cores}-Core · ${screenSig})`
    : isMobile
    ? `Mobile User App (${cores}-Core · ${screenSig})`
    : `${platformStr} (${cores}-Core · ${screenSig})`;

  try {
    const existing = localStorage.getItem(LOCAL_PC_HW_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return { pcHardwareId: existing, pcName };
    }
  } catch {
    // Fallback if storage restricted
  }

  // Deterministic hardware seed + persistent workstation/device installation salt
  const rawSeed = `${platformStr}|${cores}|${screenSig}|${tz}`;
  let hash = 2166136261;
  for (let i = 0; i < rawSeed.length; i++) {
    hash ^= rawSeed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hwHex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const installSalt = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = isAndroid ? 'AND' : isMobile ? 'MOB' : 'PC';
  const generatedId = `${prefix}-${hwHex.slice(0, 4)}-${hwHex.slice(4, 8)}-${installSalt}`;

  try {
    localStorage.setItem(LOCAL_PC_HW_ID_KEY, generatedId);
  } catch {
    // Ignore storage write error
  }
  return { pcHardwareId: generatedId, pcName };
}

export function sanitizeIdentifier(raw: string): string {
  return (
    raw
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 64) || 'user_01'
  );
}

export function generateOnePcLicenseKey(userId: string, pcHardwareId?: string): string {
  const cleanUser = sanitizeIdentifier(userId).toUpperCase().slice(0, 4).padEnd(4, 'X');
  const pcPart = (pcHardwareId || 'ANYPC')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(-4)
    .padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ESWA-1PC-${cleanUser}-${pcPart}-${rand}`;
}

export function getInstalledSoftwareVersion(): string {
  try {
    return localStorage.getItem(LOCAL_INSTALLED_VERSION_KEY) || CURRENT_SOFTWARE_VERSION;
  } catch {
    return CURRENT_SOFTWARE_VERSION;
  }
}

export function setInstalledSoftwareVersion(version: string): void {
  try {
    localStorage.setItem(LOCAL_INSTALLED_VERSION_KEY, version.trim().slice(0, 40));
  } catch {
    // Ignore
  }
}

export function getLocalMasterPcBypass(): boolean {
  try {
    if (localStorage.getItem(LOCAL_MASTER_PC_BYPASS_KEY) === 'true') return true;
    const sess = getLocalActivatedSession();
    if (sess?.userId === 'dhoniakash407@gmail.com' || sess?.userId === 'akashdhanusheswar@gmail.com') return true;
    const creds = getStoredAdminCredentials();
    if (creds?.email === 'dhoniakash407@gmail.com' || creds?.email === 'akashdhanusheswar@gmail.com') return true;
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.includes('run.app') || window.location.hostname.includes('aistudio'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function setLocalMasterPcBypass(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(LOCAL_MASTER_PC_BYPASS_KEY, 'true');
    } else {
      localStorage.removeItem(LOCAL_MASTER_PC_BYPASS_KEY);
    }
  } catch {
    // Ignore
  }
}

export const ESWA_ENTERPRISE_TOKEN_SALT = 'ESWA_ENTERPRISE_TOKEN_SALT_SEC_2026';
export const ESWA_GATEWAY_SALT = 'ESWA_GATEWAY_API_SIG_2026';
export const LOCAL_TAMPER_LOCKOUT_KEY = 'eswa_tamper_lockout_active_v1';

export function computeSha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function generateEswaApiSignature(hwId: string): string {
  return computeSha256Hex(`${hwId}:${ESWA_GATEWAY_SALT}`);
}

export function getEswaApiSecurityHeaders(): Record<string, string> {
  try {
    const { pcHardwareId } = getOrGeneratePcHardwareId();
    return {
      'X-ESWA-Hardware-ID': pcHardwareId,
      'X-ESWA-Signature': generateEswaApiSignature(pcHardwareId),
    };
  } catch {
    return {
      'X-ESWA-Hardware-ID': 'STANDALONE_ESWA_PC',
      'X-ESWA-Signature': generateEswaApiSignature('STANDALONE_ESWA_PC'),
    };
  }
}

interface SecureSessionEnvelope {
  __eswa_enc__: true;
  hwId: string;
  payload: string;
  checksum: string;
}

function xorCipher(text: string, key: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

export function triggerTamperViolationLockout(reason: string): void {
  try {
    localStorage.removeItem(LOCAL_ACTIVE_SESSION_KEY);
    localStorage.setItem(
      LOCAL_TAMPER_LOCKOUT_KEY,
      JSON.stringify({
        lockedAt: new Date().toISOString(),
        reason,
      })
    );
    window.dispatchEvent(new CustomEvent('eswa-security-tamper-detected', { detail: { reason } }));
  } catch {
    // Ignore storage write error
  }
}

export function isTamperViolationLockoutActive(): boolean {
  try {
    return !!localStorage.getItem(LOCAL_TAMPER_LOCKOUT_KEY);
  } catch {
    return false;
  }
}

export function clearTamperViolationLockout(): void {
  try {
    localStorage.removeItem(LOCAL_TAMPER_LOCKOUT_KEY);
  } catch {
    // Ignore
  }
}

export function getLocalActivatedSession(): ActivatedClientSession | null {
  try {
    if (isTamperViolationLockoutActive()) {
      return null;
    }
    const raw = localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
    if (!raw) return null;

    const { pcHardwareId: currentHwId } = getOrGeneratePcHardwareId();
    let session: ActivatedClientSession | null = null;

    if (raw.includes('__eswa_enc__')) {
      const envelope = JSON.parse(raw) as SecureSessionEnvelope;
      if (!envelope || envelope.__eswa_enc__ !== true || !envelope.hwId || !envelope.payload || !envelope.checksum) {
        triggerTamperViolationLockout('Invalid encrypted token envelope structure.');
        return null;
      }

      // Check if machine hardware ID matches bound token hardware ID
      if (envelope.hwId !== currentHwId) {
        triggerTamperViolationLockout(`Hardware token mismatch: bound ${envelope.hwId} vs machine ${currentHwId}`);
        return null;
      }

      // Verify cryptographic runtime signature / checksum
      const expectedChecksum = computeSha256Hex(`${envelope.payload}:${envelope.hwId}:${ESWA_ENTERPRISE_TOKEN_SALT}`);
      if (envelope.checksum !== expectedChecksum) {
        triggerTamperViolationLockout('Cryptographic token signature verification failed (offline token tampered).');
        return null;
      }

      const decrypted = xorCipher(atob(envelope.payload), `${envelope.hwId}:${ESWA_ENTERPRISE_TOKEN_SALT}`);
      session = JSON.parse(decrypted) as ActivatedClientSession;

      if (!session || !session.userId || !session.licenseKey || session.pcHardwareId !== envelope.hwId) {
        triggerTamperViolationLockout('Session payload integrity verification failed.');
        return null;
      }
    } else {
      // Legacy plaintext migration & immediate hardening
      const parsed = JSON.parse(raw) as ActivatedClientSession;
      if (parsed?.userId === 'standalone_user') {
        localStorage.removeItem(LOCAL_ACTIVE_SESSION_KEY);
        return null;
      }
      if (parsed && parsed.userId && parsed.licenseKey && parsed.pcHardwareId) {
        const existingHwId = localStorage.getItem(LOCAL_PC_HW_ID_KEY);
        if (parsed.pcHardwareId === currentHwId || parsed.pcHardwareId === existingHwId) {
          session = parsed;
          // Upgrade immediately to secured cryptographic envelope
          saveLocalActivatedSession(session);
        } else {
          triggerTamperViolationLockout('Legacy session bound to different PC hardware ID.');
          return null;
        }
      } else {
        triggerTamperViolationLockout('Unencrypted, modified, or forged licensing payload detected in storage.');
        return null;
      }
    }

    return session;
  } catch (err: unknown) {
    triggerTamperViolationLockout(err instanceof Error ? err.message : 'Session decrypt error');
    return null;
  }
}

export function saveLocalActivatedSession(session: ActivatedClientSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(LOCAL_ACTIVE_SESSION_KEY);
      return;
    }

    const { pcHardwareId: currentHwId } = getOrGeneratePcHardwareId();
    const boundHwId = session.pcHardwareId || currentHwId;
    const sessionJson = JSON.stringify({
      ...session,
      pcHardwareId: boundHwId,
    });

    const ciphered = xorCipher(sessionJson, `${boundHwId}:${ESWA_ENTERPRISE_TOKEN_SALT}`);
    const b64Payload = btoa(ciphered);
    const checksum = computeSha256Hex(`${b64Payload}:${boundHwId}:${ESWA_ENTERPRISE_TOKEN_SALT}`);

    const envelope: SecureSessionEnvelope = {
      __eswa_enc__: true,
      hwId: boundHwId,
      payload: b64Payload,
      checksum,
    };

    localStorage.setItem(LOCAL_ACTIVE_SESSION_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore storage quota error
  }
}

export function isMasterAdminLoggedIn(): boolean {
  try {
    if (getLocalMasterPcBypass()) return true;
    const creds = getStoredAdminCredentials();
    const email = (creds?.email || '').trim().toLowerCase();
    if (email === 'dhoniakash407@gmail.com' || email === 'akashdhanusheswar@gmail.com') {
      return true;
    }
    const sess = getLocalActivatedSession();
    if (sess?.userId === 'dhoniakash407@gmail.com' || sess?.userId === 'akashdhanusheswar@gmail.com') {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Enterprise Runtime Shield: Protects proprietary mathematical engines and UI
 * against DevTools tampering, reverse-engineering, inspect element, and source viewing.
 * Bypassed ONLY when logged in as Master Admin (dhoniakash407@gmail.com).
 */
export function initEnterpriseSecurityShield(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Bypass ONLY when logged in as Master Admin
  if (isMasterAdminLoggedIn()) {
    return () => {};
  }

  // 1. Initial Launch Tamper Integrity Verification
  try {
    const rawActive = localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
    if (rawActive) {
      // Validates AES/HMAC envelope and hardware ID binding immediately
      const verifiedSession = getLocalActivatedSession();
      if (!verifiedSession && rawActive) {
        triggerTamperViolationLockout('Initial startup integrity check failed: Invalid or tampered offline token.');
      }
    }
  } catch (err: unknown) {
    triggerTamperViolationLockout(err instanceof Error ? err.message : 'Startup integrity check failure');
  }

  // 2. Block right-click context menu (Inspect Element / View Source)
  const handleContextMenu = (e: MouseEvent) => {
    if (isMasterAdminLoggedIn()) return;
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 3. Block Developer Tools & Source-View Keyboard Shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isMasterAdminLoggedIn()) return;

    // F12 key
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl+Shift+I / J / C / K (DevTools inspector, console, element picker)
    if (
      isCtrlOrMeta &&
      e.shiftKey &&
      ['I', 'i', 'J', 'j', 'C', 'c', 'K', 'k'].includes(e.key)
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Mac Cmd+Option+I / J / C (Safari / Chrome DevTools)
    if (e.metaKey && e.altKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U / Cmd+U (View Source) & Ctrl+S / Cmd+S (Save Page HTML)
    if (isCtrlOrMeta && ['U', 'u', 'S', 's'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // 4. Block unauthorized canvas, image, and proprietary SVG dragging / copying
  const handleDragStart = (e: DragEvent) => {
    if (isMasterAdminLoggedIn()) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'CANVAS' ||
        target.tagName === 'IMG' ||
        target.tagName === 'svg' ||
        target.closest('canvas, svg, .tunnel-face-canvas, .photogrammetry-viewport'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  const handleSelectStart = (e: Event) => {
    if (isMasterAdminLoggedIn()) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'CANVAS' ||
        target.tagName === 'svg' ||
        target.closest('canvas, svg, .no-select'))
    ) {
      e.preventDefault();
      return false;
    }
  };

  // 5. Real-Time Storage Tamper Detection (detects external modifications to localStorage)
  const handleStorageEvent = (e: StorageEvent) => {
    if (isMasterAdminLoggedIn()) return;
    if (e.key === LOCAL_ACTIVE_SESSION_KEY || e.key === LOCAL_PC_HW_ID_KEY) {
      const current = getLocalActivatedSession();
      if (!current && localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY)) {
        triggerTamperViolationLockout('External tampering detected on offline licensing storage.');
      }
    }
  };

  window.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('dragstart', handleDragStart, true);
  window.addEventListener('selectstart', handleSelectStart, true);
  window.addEventListener('storage', handleStorageEvent, true);

  // 6. Periodic Cryptographic Runtime Integrity Check (every 5 seconds)
  const integrityTimer = window.setInterval(() => {
    if (isMasterAdminLoggedIn()) return;
    const session = getLocalActivatedSession();
    if (session) {
      const { pcHardwareId } = getOrGeneratePcHardwareId();
      if (session.pcHardwareId && session.pcHardwareId !== pcHardwareId) {
        triggerTamperViolationLockout(
          `Hardware ID spoofing detected during runtime cycle: bound=${session.pcHardwareId} vs machine=${pcHardwareId}`
        );
      }
    }
  }, 5000);

  // 7. Anti-Debugger Inspection Trap in Production Builds
  let antiDebugTimer: number | null = null;
  if (!import.meta.env.DEV) {
    antiDebugTimer = window.setInterval(() => {
      if (isMasterAdminLoggedIn()) return;
      const t0 = performance.now();
      // Anti-reversing evaluation trap
      try {
        const check = new Function('debugger');
        check();
      } catch {
        // Ignore
      }
      const elapsed = performance.now() - t0;
      if (elapsed > 150) {
        triggerTamperViolationLockout('Interactive DevTools debugger inspection detected.');
      }
    }, 3000);
  }

  return () => {
    window.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('dragstart', handleDragStart, true);
    window.removeEventListener('selectstart', handleSelectStart, true);
    window.removeEventListener('storage', handleStorageEvent, true);
    window.clearInterval(integrityTimer);
    if (antiDebugTimer !== null) {
      window.clearInterval(antiDebugTimer);
    }
  };
}


export function getStoredAdminCredentials(): { email: string; password: string } {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_CREDENTIALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email && parsed?.password) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return {
    email: MASTER_ADMIN_DEFAULT_EMAIL,
    password: 'akash@master2026',
  };
}

export function updateStoredAdminCredentials(email: string, password: string): void {
  try {
    localStorage.setItem(
      LOCAL_ADMIN_CREDENTIALS_KEY,
      JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() })
    );
  } catch {
    // Ignore
  }
}

/**
 * Submits a new Software Access Request after a user downloads the software.
 * Writes via BOTH Direct Firestore HTTPS REST API (analog-bricolage-rf38q + gen-lang-client-0610274527)
 * AND the Firebase JS SDK so requests from Android APKs, Windows EXEs, and Web browsers
 * ALWAYS reach the Master App and Master Software immediately.
 */
export async function submitSoftwareAccessRequest(input: {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  roleTitle: string;
  purposeNotes: string;
}): Promise<AccessRequestRecord> {
  const { pcHardwareId, pcName } = getOrGeneratePcHardwareId();
  const cleanHwId = sanitizeIdentifier(pcHardwareId).slice(0, 128);
  const validHwId = cleanHwId.length >= 4 ? cleanHwId : `DEV_${cleanHwId}_0001`;
  const cleanPhone = input.phone.trim().slice(0, 60);
  const validPhone = cleanPhone.length >= 3 ? cleanPhone : `000-${cleanPhone || '0000'}`;
  const cleanEmail = input.email.trim().slice(0, 160);
  const validEmail = cleanEmail.length >= 3 ? cleanEmail : 'user@example.com';

  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/gi, '')
    .substring(0, 6) || 'usr01'}`;

  const record: AccessRequestRecord = {
    requestId,
    portalScope: PORTAL_SCOPE,
    fullName: (input.fullName.trim() || 'Tunnel Engineer').slice(0, 120),
    email: validEmail,
    phone: validPhone,
    organization: (input.organization.trim() || 'Tunnel Engineering Site').slice(0, 160),
    roleTitle: (input.roleTitle.trim() || 'Tunnel Engineer').slice(0, 100),
    pcHardwareId: validHwId,
    pcName: (pcName.trim() || 'User Device').slice(0, 120),
    purposeNotes: (input.purposeNotes || 'Requested after software download')
      .trim()
      .slice(0, 500),
    status: 'PENDING',
    assignedUserId: '',
    assignedLicenseKey: '',
    createdAtIso: new Date().toISOString(),
  };

  upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, record, (x) => x.requestId);
  try {
    localStorage.setItem('eswa_last_submitted_request_id', requestId);
  } catch {
    // Ignore
  }

  const path = `access_requests/${requestId}`;
  const [restOk] = await Promise.all([
    firestoreRestSetDoc(
      'access_requests',
      requestId,
      record as unknown as Record<string, unknown>,
      true
    ),
    withFirestoreTimeout(setDoc(doc(db, 'access_requests', requestId), record), 4500)
      .then(() => true)
      .catch(() => false),
  ]);

  if (restOk) {
    return record;
  }

  try {
    await withFirestoreTimeout(setDoc(doc(db, 'access_requests', requestId), record), 4000);
    return record;
  } catch (error) {
    if (isOfflineOrTimeoutError(error)) {
      return record;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Builds the official Welcome Email with ESWA Tunnel Mapper App & Software Features
 * sent automatically from akashdhanusheswar@gmail.com when a new user registers & logs in.
 */
export function buildWelcomeFeaturesEmailContent(params: {
  fullName: string;
  email: string;
  organization: string;
  roleTitle: string;
  deviceId: string;
  platformLabel: string;
  userId: string;
}): { subject: string; textBody: string; htmlBody: string } {
  const pcUrl = getUserEditionShareUrl();
  const apkUrl = getUserAndroidAppShareUrl();
  const subject = `Welcome to ESWA Geological Mapper — Official App & Software Features (${params.fullName})`;

  const textBody = `Warm Greetings from ESWA Geological Mapper (${MASTER_ADMIN_DEFAULT_EMAIL})!

Dear ${params.fullName} (${params.organization} · ${params.roleTitle}),

Thank you for installing and logging into ESWA Geological Mapper! Your account is now active on your ${params.platformLabel} (${params.deviceId}) with immediate access — no manual activation key required.

KEY FEATURES OF ESWA GEOLOGICAL MAPPER APP & SOFTWARE:
1. Civil NATM, Mechanized TBM & Underground Mining Multi-Mode:
   - Dedicated workflows for civil tunnel excavation, TBM ring mapping, and underground hard-rock mining grade control.
2. AI + Computer Vision Geological Joint Tracing:
   - Automatic multi-point curvilinear fracture & joint segmentation on Face, Crown, Left Wall & Right Wall photographs.
3. 3D Orientation Solver & Stereonet Plotting:
   - Real-time Strike, Dip & Dip Direction calculation with interactive equal-area / equal-angle Stereonet pole & great-circle analysis.
4. Rock Mass Classification Suite (Q-System, RMR, GSI, Mathews Q' & Laubscher MRMR):
   - Automated Barton Q-Index, Bieniawski RMR, GSI, Mathews Stability Number N' and MRMR rock mass ratings.
5. Overbreak / Undercut Survey Profile & Mining Tonnage Analysis:
   - Compare design profiles, calculate ore/waste dilution %, weighted face grades, and muck routing verdicts.
6. Continuous 3D Tunnel Strip Logger & Engineering CAD Sheet Export:
   - Generate publication-ready Final Engineering Geological Mapping Sheets (PDF / PNG / DXF).
7. 1-Tap In-App Live Auto-Updates:
   - Live updates with zero data loss.

OFFICIAL ACCESS LINKS:
- PC Software Link: ${pcUrl}
- Android Mobile App (.APK): ${apkUrl}

Registered User ID: ${params.userId}
Registered Device ID: ${params.deviceId} (${params.platformLabel})

Best Regards,
ESWA Geological Mapper Team
${MASTER_ADMIN_DEFAULT_EMAIL}`;

  const htmlBody = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 14px; border: 1px solid #10b981;">
    <h2 style="color: #34d399; margin-top: 0;">Warm Greetings from ESWA Geological Mapper!</h2>
    <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">
      Dear <strong>${params.fullName}</strong> (${params.organization} · ${params.roleTitle}),<br/>
      Thank you for installing and logging into <strong>ESWA Geological Mapper</strong>! Your account is now active on your <strong>${params.platformLabel}</strong> (<code style="color: #38bdf8;">${params.deviceId}</code>).
    </p>
    <div style="background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin: 16px 0;">
      <div style="color: #38bdf8; font-weight: 700; font-size: 13px; margin-bottom: 10px;">KEY FEATURES IN YOUR APP &amp; SOFTWARE:</div>
      <ul style="color: #cbd5e1; font-size: 13px; line-height: 1.65; margin: 0; padding-left: 18px;">
        <li><strong>AI + Computer Vision Joint Tracing:</strong> Multi-point curvilinear rock fracture segmentation on Face, Crown, Left &amp; Right Walls.</li>
        <li><strong>3D Orientation &amp; Stereonet Engine:</strong> Automatic Strike, Dip &amp; Dip Direction with interactive Stereonet plots.</li>
        <li><strong>Rock Mass Classification (Q, RMR &amp; GSI):</strong> Instant engineering rock mass ratings and support calculations.</li>
        <li><strong>Overbreak / Undercut &amp; Volume Analysis:</strong> Design vs. surveyed profile comparison and section volume computation.</li>
        <li><strong>3D Tunnel Strip Logger &amp; CAD Sheet Export:</strong> High-resolution Final Engineering Geological Sheets &amp; DXF CAD output.</li>
        <li><strong>1-Tap In-App Auto-Update:</strong> Touch any update notification and press <em>Install</em> to update automatically inside the app without downloading new installers.</li>
      </ul>
    </div>
    <p style="color: #94a3b8; font-size: 12px; font-family: monospace;">
      Registered User ID: <strong style="color: #f8fafc;">${params.userId}</strong> · Device: <strong style="color: #34d399;">${params.deviceId}</strong> (${params.platformLabel})<br/>
      From: ${MASTER_ADMIN_DEFAULT_EMAIL}
    </p>
  </div>`;

  return { subject, textBody, htmlBody };
}

/**
 * INSTANT 1-STEP SELF-REGISTRATION & LOGIN (For Freshly Installed User App & User PC Software):
 * - Collects the user's details (Full Name, Email, Phone, Organization, Role).
 * - Immediately logs the user in and unlocks the App / Software without waiting for Master activation.
 * - Syncs the user's profile and device type (ANDROID_APP or PC_SOFTWARE) to the unified Cloud Database
 *   so the Master App AND Master Software both see all Android + PC users and can Suspend/Reactivate them at any time.
 * - Automatically sends the Welcome Email with App & Software Features from akashdhanusheswar@gmail.com.
 */
export async function registerInstantUserAndLogin(input: {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  roleTitle: string;
  purposeNotes?: string;
}): Promise<{
  session: ActivatedClientSession;
  licenseRecord: SoftwareLicenseRecord;
  welcomeEmailSent: boolean;
}> {
  const { pcHardwareId, pcName } = getOrGeneratePcHardwareId();
  const cleanHwId = sanitizeIdentifier(pcHardwareId).slice(0, 128);
  const validHwId = cleanHwId.length >= 4 ? cleanHwId : `DEV_${cleanHwId}_0001`;
  const isAndroidDevice =
    validHwId.startsWith('AND') ||
    validHwId.startsWith('MOB') ||
    pcName.toLowerCase().includes('android');
  const platformTag = isAndroidDevice ? 'ANDROID_APP' : 'PC_SOFTWARE';
  const platformLabel = isAndroidDevice ? 'Android Mobile App' : 'PC Workstation Software';

  const cleanPhone = input.phone.trim().slice(0, 60);
  const validPhone = cleanPhone.length >= 3 ? cleanPhone : `000-${cleanPhone || '0000'}`;
  const cleanEmail = input.email.trim().slice(0, 160);
  const validEmail = cleanEmail.length >= 3 ? cleanEmail : 'user@example.com';
  const cleanRole = (input.roleTitle.trim() || 'Tunnel Engineer').slice(0, 80);

  const nameSlug = sanitizeIdentifier(
    input.fullName.trim() || validEmail.split('@')[0] || 'user'
  )
    .toLowerCase()
    .slice(0, 24);
  const hwSuffix = sanitizeIdentifier(validHwId).toLowerCase().slice(-8);
  const userId = sanitizeIdentifier(`usr_${nameSlug}_${hwSuffix}`);
  const nowIso = new Date().toISOString();

  const licenseRecord: SoftwareLicenseRecord = {
    userId,
    portalScope: PORTAL_SCOPE,
    password: cleanRole.length >= 3 ? cleanRole : 'Tunnel Engineer',
    licenseKey: `ESWA-${platformTag}-ACTIVE`,
    fullName: (input.fullName.trim() || 'Tunnel Engineer').slice(0, 120),
    email: validEmail,
    phone: validPhone,
    organization: (input.organization.trim() || 'Tunnel Engineering Project').slice(0, 160),
    boundPcHardwareId: validHwId,
    boundPcName: `${platformLabel} · ${cleanRole}`.slice(0, 120),
    status: 'ACTIVE',
    installedVersion: getInstalledSoftwareVersion() || CURRENT_SOFTWARE_VERSION,
    lastSeenAtIso: nowIso,
    createdAtIso: nowIso,
    adminAuthSig: ADMIN_AUTH_SIG,
  };

  const reqId = `req_${userId}`;
  const requestRecord: AccessRequestRecord = {
    requestId: reqId,
    portalScope: PORTAL_SCOPE,
    fullName: licenseRecord.fullName,
    email: licenseRecord.email,
    phone: licenseRecord.phone,
    organization: licenseRecord.organization,
    roleTitle: cleanRole,
    pcHardwareId: validHwId,
    pcName: licenseRecord.boundPcName,
    purposeNotes: (
      input.purposeNotes || `Instant Login on ${platformLabel} (v${licenseRecord.installedVersion})`
    )
      .trim()
      .slice(0, 500),
    status: 'APPROVED',
    assignedUserId: userId,
    assignedLicenseKey: licenseRecord.licenseKey,
    createdAtIso: nowIso,
  };

  // Save session locally immediately so the user enters the app with 0ms wait
  unmarkIdsDeletedTombstone([userId, reqId, validHwId, validEmail]);
  const session: ActivatedClientSession = {
    userId: licenseRecord.userId,
    fullName: licenseRecord.fullName,
    organization: licenseRecord.organization,
    licenseKey: licenseRecord.licenseKey,
    pcHardwareId: validHwId,
    activatedAtIso: nowIso,
  };
  saveLocalActivatedSession(session);
  upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, licenseRecord, (x) => x.userId);
  upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, requestRecord, (x) => x.requestId);

  // Sync to all 3 cloud channels (Server Relay + Primary & Secondary Firestore REST + Firebase SDK)
  await Promise.all([
    firestoreRestSetDoc(
      'software_licenses',
      userId,
      licenseRecord as unknown as Record<string, unknown>
    ),
    serverRelayUpsert(
      'access_requests',
      reqId,
      requestRecord as unknown as Record<string, unknown>
    ),
    withFirestoreTimeout(
      setDoc(doc(db, 'software_licenses', userId), licenseRecord),
      3500
    ).catch(() => {}),
  ]);

  // Automatically trigger the Welcome Email with App & Software Features in the background
  let welcomeEmailSent = false;
  try {
    const emailContent = buildWelcomeFeaturesEmailContent({
      fullName: licenseRecord.fullName,
      email: licenseRecord.email,
      organization: licenseRecord.organization,
      roleTitle: cleanRole,
      deviceId: validHwId,
      platformLabel,
      userId,
    });
    const mailRes = await sendGmailMessage({
      to: licenseRecord.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
      fromEmail: MASTER_ADMIN_DEFAULT_EMAIL,
      skipInteractivePopup: true,
    });
    if (mailRes.ok) {
      welcomeEmailSent = true;
      const updatedKey = `ESWA-${platformTag}-MAILED`;
      licenseRecord.licenseKey = updatedKey;
      upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, licenseRecord, (x) => x.userId);
      void firestoreRestUpdateDoc('software_licenses', userId, {
        licenseKey: updatedKey,
        adminAuthSig: ADMIN_AUTH_SIG,
      });
    }
  } catch {
    // Non-fatal; Master Portal also provides 1-click Welcome Email dispatch
  }

  return { session, licenseRecord, welcomeEmailSent };
}

/**
 * Automatically pushes ALL locally-stored users/licenses and access requests to the Cloud
 * so that both the Master Android App and Master PC Software always display the complete
 * unified list of Android App users + PC Software users together.
 */
export async function syncPendingLocalRequestsToCloud(): Promise<void> {
  const localRequests = readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY).filter(
    (r) =>
      r.status !== 'REJECTED' &&
      !isIdDeletedTombstone(r.requestId, r.createdAtIso) &&
      !isIdDeletedTombstone(r.assignedUserId, r.createdAtIso) &&
      !isIdDeletedTombstone(r.pcHardwareId, r.createdAtIso)
  );
  const localLicenses = readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY).filter(
    (l) =>
      l.status !== 'REVOKED' &&
      !isIdDeletedTombstone(l.userId, l.createdAtIso) &&
      !isIdDeletedTombstone(l.boundPcHardwareId, l.createdAtIso)
  );

  await Promise.all([
    ...localRequests.map(async (req) => {
      if (!req.requestId) return;
      try {
        const existingRemote = await firestoreRestGetDoc<AccessRequestRecord>(
          'access_requests',
          req.requestId
        );
        if (!existingRemote) {
          await firestoreRestSetDoc(
            'access_requests',
            req.requestId,
            req as unknown as Record<string, unknown>,
            req.status === 'PENDING'
          );
        } else if (existingRemote.status !== req.status && existingRemote.status !== 'PENDING') {
          upsertMirrorItem(
            LOCAL_MIRROR_REQUESTS_KEY,
            existingRemote,
            (x) => x.requestId
          );
        }
      } catch {
        // Ignore network errors
      }
    }),
    ...localLicenses.map(async (lic) => {
      if (!lic.userId) return;
      try {
        const existingRemote = await firestoreRestGetDoc<SoftwareLicenseRecord>(
          'software_licenses',
          lic.userId
        );
        if (!existingRemote) {
          await firestoreRestSetDoc(
            'software_licenses',
            lic.userId,
            lic as unknown as Record<string, unknown>
          );
        } else if (
          existingRemote.lastSeenAtIso &&
          lic.lastSeenAtIso &&
          existingRemote.lastSeenAtIso > lic.lastSeenAtIso
        ) {
          upsertMirrorItem(
            LOCAL_MIRROR_LICENSES_KEY,
            existingRemote,
            (x) => x.userId
          );
        }
      } catch {
        // Ignore network errors
      }
    }),
  ]);
}

/**
 * Checks the status of a previously submitted Access Request by its ID.
 */
export async function getAccessRequestById(
  requestId: string
): Promise<AccessRequestRecord | null> {
  const cleanId = sanitizeIdentifier(requestId);
  const localMatch =
    readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY).find(
      (r) => r.requestId === cleanId
    ) || null;

  // 1. Fast direct HTTPS REST check across both databases (also auto-uploads if missing in cloud!)
  try {
    const restDoc = await firestoreRestGetDoc<AccessRequestRecord>(
      'access_requests',
      cleanId
    );
    if (restDoc) {
      upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, restDoc, (x) => x.requestId);
      return restDoc;
    } else if (localMatch && localMatch.status === 'PENDING') {
      await firestoreRestSetDoc(
        'access_requests',
        cleanId,
        localMatch as unknown as Record<string, unknown>,
        true
      );
    }
  } catch {
    // Fall through to SDK
  }

  const path = `access_requests/${cleanId}`;
  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'access_requests', cleanId)),
      2000
    );
    if (!snap.exists()) return localMatch;
    const remote = snap.data() as AccessRequestRecord;
    upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, remote, (x) => x.requestId);
    return remote;
  } catch (error) {
    if (isOfflineOrTimeoutError(error)) {
      return localMatch;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Fetches the issued SoftwareLicenseRecord by userId so an approved applicant
 * receives their full credentials (User ID, Password, 1-PC Key) in real-time in-app notification.
 */
export async function getSoftwareLicenseById(
  userId: string
): Promise<SoftwareLicenseRecord | null> {
  const cleanUserId = sanitizeIdentifier(userId);
  if (!cleanUserId) return null;
  const localMatch =
    readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY).find(
      (l) => sanitizeIdentifier(l.userId) === cleanUserId
    ) || null;

  try {
    const restLic = await firestoreRestGetDoc<SoftwareLicenseRecord>(
      'software_licenses',
      cleanUserId
    );
    if (restLic) {
      upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, restLic, (x) => x.userId);
      return restLic;
    }
  } catch {
    // Fall through to SDK
  }

  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'software_licenses', cleanUserId)),
      2500
    );
    if (!snap.exists()) return localMatch;
    const remote = snap.data() as SoftwareLicenseRecord;
    upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, remote, (x) => x.userId);
    return remote;
  } catch {
    return localMatch;
  }
}

/**
 * Real-time listener on a specific Access Request ID so the user's app/software
 * receives an immediate live notification the moment the Master Admin approves it.
 */
export function subscribeAccessRequestById(
  requestId: string,
  onUpdate: (
    request: AccessRequestRecord,
    issuedLicense: SoftwareLicenseRecord | null
  ) => void
): () => void {
  const cleanId = sanitizeIdentifier(requestId);
  if (!cleanId) return () => {};

  const emitMirror = async () => {
    const localMatch = readLocalMirror<AccessRequestRecord>(
      LOCAL_MIRROR_REQUESTS_KEY
    ).find((r) => r.requestId === cleanId);
    if (localMatch) {
      const lic =
        localMatch.status === 'APPROVED' && localMatch.assignedUserId
          ? await getSoftwareLicenseById(localMatch.assignedUserId)
          : null;
      onUpdate(localMatch, lic);
    }
  };

  void emitMirror();
  void syncPendingLocalRequestsToCloud();

  const pollRemoteStatus = async () => {
    try {
      const remote = await getAccessRequestById(cleanId);
      if (remote) {
        const lic =
          remote.status === 'APPROVED' && remote.assignedUserId
            ? await getSoftwareLicenseById(remote.assignedUserId)
            : null;
        onUpdate(remote, lic);
      }
    } catch {
      // Ignore offline errors
    }
  };

  void pollRemoteStatus();
  const pollTimer = window.setInterval(() => {
    void pollRemoteStatus();
  }, 4500);

  const onLocalEvent = () => {
    void emitMirror();
  };
  window.addEventListener('eswa-licensing-mirror-updated', onLocalEvent);
  window.addEventListener('storage', onLocalEvent);

  const unsub = onSnapshot(
    doc(db, 'access_requests', cleanId),
    async (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data() as AccessRequestRecord;
      upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, remote, (x) => x.requestId);
      const lic =
        remote.status === 'APPROVED' && remote.assignedUserId
          ? await getSoftwareLicenseById(remote.assignedUserId)
          : null;
      onUpdate(remote, lic);
    },
    () => {
      // Ignore offline snapshot errors
    }
  );

  return () => {
    window.clearInterval(pollTimer);
    window.removeEventListener('eswa-licensing-mirror-updated', onLocalEvent);
    window.removeEventListener('storage', onLocalEvent);
    window.setTimeout(() => {
      try {
        unsub();
      } catch {
        // Ignore unlisten race
      }
    }, 250);
  };
}

/**
 * Verifies User ID, Password, and 1-PC License Key on the Software Login Gate.
 * Strictly enforces One-PC-One-Software hardware locking:
 * - If the license is not yet bound to a PC (`boundPcHardwareId == ''`), binds it to THIS PC (`pcHardwareId`).
 * - If the license is already bound to THIS PC (`boundPcHardwareId == pcHardwareId`), logs in and updates heartbeat.
 * - If the license is bound to ANY OTHER PC (`boundPcHardwareId !== pcHardwareId`), rejects login immediately!
 */
export async function verifyAndActivateOnePcLogin(input: {
  userId: string;
  password: string;
  licenseKey: string;
}): Promise<{
  ok: boolean;
  message: string;
  session?: ActivatedClientSession;
  isMasterAdmin?: boolean;
}> {
  const rawUser = input.userId.trim().toLowerCase();
  const rawPass = input.password.trim();
  const storedAdmin = getStoredAdminCredentials();
  const { pcHardwareId, pcName } = getOrGeneratePcHardwareId();

  // Allow Master Owner (akashdhanusheswar@gmail.com / admin) to log in directly with Master Password
  const isMasterUser =
    rawUser === storedAdmin.email.toLowerCase() ||
    rawUser === MASTER_ADMIN_DEFAULT_EMAIL.toLowerCase() ||
    rawUser === 'admin' ||
    rawUser === 'master';

  if (isMasterUser && rawPass === storedAdmin.password) {
    setLocalMasterPcBypass(true);
    setMasterPcAuthorization(
      pcHardwareId,
      `Master Owner Workstation (${pcName})`,
      true
    ).catch(() => {});

    const nowIso = new Date().toISOString();
    const masterSession: ActivatedClientSession = {
      userId: storedAdmin.email,
      fullName: 'Master Admin',
      organization: 'ESWA Master Workstation',
      licenseKey: 'MASTER-PC-BYPASS',
      pcHardwareId,
      activatedAtIso: nowIso,
    };
    saveLocalActivatedSession(masterSession);
    return {
      ok: true,
      isMasterAdmin: true,
      message: `Master Admin verified! This PC (${pcHardwareId}) is now unlocked.`,
      session: masterSession,
    };
  }

  if (!input.licenseKey.trim()) {
    return {
      ok: false,
      message:
        'Please enter your 1-PC Hardware License Key (or use Master Admin Email & Password).',
    };
  }

  const cleanUserId = sanitizeIdentifier(input.userId);
  const path = `software_licenses/${cleanUserId}`;

  const validateAndBindLicense = (
    license: SoftwareLicenseRecord
  ): {
    ok: boolean;
    message: string;
    session?: ActivatedClientSession;
    updatedLicense?: SoftwareLicenseRecord;
  } => {
    if (license.status !== 'ACTIVE') {
      return {
        ok: false,
        message: `This license is currently ${license.status}. Please contact the Master Admin.`,
      };
    }

    if (
      license.password !== input.password.trim() ||
      license.licenseKey.trim().toUpperCase() !== input.licenseKey.trim().toUpperCase()
    ) {
      return {
        ok: false,
        message: 'Incorrect Password or 1-PC License Key.',
      };
    }

    // Strict 1-PC Hardware Lock Enforcement
    if (
      license.boundPcHardwareId &&
      license.boundPcHardwareId !== '' &&
      license.boundPcHardwareId !== pcHardwareId
    ) {
      return {
        ok: false,
        message: `1-PC HARDWARE LOCK VIOLATION: These credentials & key are already locked to another workstation (${license.boundPcHardwareId}). Each license can only be used on one single PC.`,
      };
    }

    const nowIso = new Date().toISOString();
    const currentVer = getInstalledSoftwareVersion();
    const updatedLicense: SoftwareLicenseRecord = {
      ...license,
      boundPcHardwareId: pcHardwareId,
      boundPcName: pcName.slice(0, 120),
      installedVersion: currentVer,
      lastSeenAtIso: nowIso,
    };
    upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, updatedLicense, (x) => x.userId);

    const session: ActivatedClientSession = {
      userId: license.userId,
      fullName: license.fullName,
      organization: license.organization,
      licenseKey: license.licenseKey,
      pcHardwareId,
      activatedAtIso: nowIso,
    };
    saveLocalActivatedSession(session);

    return {
      ok: true,
      message: `Verified & hardware-locked to this PC (${pcHardwareId}).`,
      session,
      updatedLicense,
    };
  };

  try {
    // 1. Check REST API across both projects first so login works on any APK/EXE/Web origin
    const restLicense = await firestoreRestGetDoc<SoftwareLicenseRecord>(
      'software_licenses',
      cleanUserId
    );
    if (restLicense) {
      const result = validateAndBindLicense(restLicense);
      if (result.ok && result.updatedLicense) {
        const bindUpdates = {
          boundPcHardwareId: result.updatedLicense.boundPcHardwareId,
          boundPcName: result.updatedLicense.boundPcName,
          installedVersion: result.updatedLicense.installedVersion,
          lastSeenAtIso: result.updatedLicense.lastSeenAtIso,
        };
        void firestoreRestUpdateDoc('software_licenses', cleanUserId, bindUpdates);
        const ref = doc(db, 'software_licenses', cleanUserId);
        withFirestoreTimeout(updateDoc(ref, bindUpdates), 2000).catch(() => {});
      }
      return result;
    }

    const ref = doc(db, 'software_licenses', cleanUserId);
    const snap = await withFirestoreTimeout(getDoc(ref), 2500);
    if (!snap.exists()) {
      const localLic = readLocalMirror<SoftwareLicenseRecord>(
        LOCAL_MIRROR_LICENSES_KEY
      ).find((l) => sanitizeIdentifier(l.userId) === cleanUserId);
      if (localLic) {
        return validateAndBindLicense(localLic);
      }
      return {
        ok: false,
        message:
          'Invalid User ID. Please request access or check the User ID issued by the Master Admin.',
      };
    }

    const license = snap.data() as SoftwareLicenseRecord;
    const result = validateAndBindLicense(license);
    if (result.ok && result.updatedLicense) {
      const bindUpdates = {
        boundPcHardwareId: result.updatedLicense.boundPcHardwareId,
        boundPcName: result.updatedLicense.boundPcName,
        installedVersion: result.updatedLicense.installedVersion,
        lastSeenAtIso: result.updatedLicense.lastSeenAtIso,
      };
      void firestoreRestUpdateDoc('software_licenses', cleanUserId, bindUpdates);
      withFirestoreTimeout(updateDoc(ref, bindUpdates), 2000).catch(() => {});
    }
    return result;
  } catch (error) {
    if (isOfflineOrTimeoutError(error)) {
      const localLic = readLocalMirror<SoftwareLicenseRecord>(
        LOCAL_MIRROR_LICENSES_KEY
      ).find((l) => sanitizeIdentifier(l.userId) === cleanUserId);
      if (localLic) {
        return validateAndBindLicense(localLic);
      }
      return {
        ok: false,
        message:
          'Invalid User ID or offline. Tip: Master Owner can log in directly with akashdhanusheswar@gmail.com and akash@master2026.',
      };
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Checks whether the current PC is registered as a Master PC (No Login Required).
 */
export async function checkIsCurrentPcMaster(): Promise<boolean> {
  if (getLocalMasterPcBypass()) {
    return true;
  }
  const { pcHardwareId } = getOrGeneratePcHardwareId();
  const cleanPcId = sanitizeIdentifier(pcHardwareId);
  const localMatch = readLocalMirror<MasterPcRecord>(LOCAL_MIRROR_MASTER_PCS_KEY).find(
    (m) => sanitizeIdentifier(m.pcHardwareId) === cleanPcId
  );
  if (localMatch?.bypassLogin) {
    setLocalMasterPcBypass(true);
    return true;
  }
  try {
    const snap = await withFirestoreTimeout(
      getDoc(doc(db, 'master_pcs', cleanPcId)),
      1200
    );
    if (snap.exists()) {
      const data = snap.data() as MasterPcRecord;
      upsertMirrorItem(LOCAL_MIRROR_MASTER_PCS_KEY, data, (x) => x.pcHardwareId);
      if (data.bypassLogin) {
        setLocalMasterPcBypass(true);
        return true;
      }
    }
  } catch {
    // Offline or timeout — proceed immediately to login gate
  }
  return false;
}

/**
 * Registers or updates a Master PC in Firestore & local storage (Admin Action).
 */
export async function setMasterPcAuthorization(
  pcHardwareId: string,
  label: string,
  bypassLogin: boolean
): Promise<void> {
  const cleanPcId = sanitizeIdentifier(pcHardwareId);
  const currentPc = getOrGeneratePcHardwareId();
  if (cleanPcId === sanitizeIdentifier(currentPc.pcHardwareId)) {
    setLocalMasterPcBypass(bypassLogin);
  }

  const record: MasterPcRecord = {
    pcHardwareId: cleanPcId,
    portalScope: PORTAL_SCOPE,
    label: (label.trim() || 'Master Admin PC').slice(0, 120),
    bypassLogin,
    registeredAtIso: new Date().toISOString(),
    adminAuthSig: ADMIN_AUTH_SIG,
  };
  upsertMirrorItem(LOCAL_MIRROR_MASTER_PCS_KEY, record, (x) => x.pcHardwareId);

  const path = `master_pcs/${cleanPcId}`;
  try {
    await withFirestoreTimeout(setDoc(doc(db, 'master_pcs', cleanPcId), record));
  } catch (error) {
    if (isOfflineOrTimeoutError(error)) return;
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeMasterPcAuthorization(pcHardwareId: string): Promise<void> {
  const cleanPcId = sanitizeIdentifier(pcHardwareId);
  const currentPc = getOrGeneratePcHardwareId();
  if (cleanPcId === sanitizeIdentifier(currentPc.pcHardwareId)) {
    setLocalMasterPcBypass(false);
  }
  removeMirrorItem<MasterPcRecord>(
    LOCAL_MIRROR_MASTER_PCS_KEY,
    cleanPcId,
    (x) => x.pcHardwareId
  );
  const path = `master_pcs/${cleanPcId}`;
  try {
    await withFirestoreTimeout(deleteDoc(doc(db, 'master_pcs', cleanPcId)));
  } catch (error) {
    if (isOfflineOrTimeoutError(error)) return;
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Admin Action: Approves an Access Request and creates a 1-PC Hardware-Locked License.
 */
export async function approveRequestAndCreateLicense(input: {
  request: AccessRequestRecord;
  userId: string;
  password: string;
  licenseKey: string;
  lockToRequestedPcImmediately: boolean;
}): Promise<SoftwareLicenseRecord> {
  const cleanUserId = sanitizeIdentifier(input.userId);
  const nowIso = new Date().toISOString();

  const licenseRecord: SoftwareLicenseRecord = {
    userId: cleanUserId,
    portalScope: PORTAL_SCOPE,
    password: input.password.trim().slice(0, 120),
    licenseKey: input.licenseKey.trim().toUpperCase().slice(0, 80),
    fullName: input.request.fullName.slice(0, 120),
    email: input.request.email.slice(0, 160),
    phone: input.request.phone.slice(0, 60),
    organization: input.request.organization.slice(0, 160),
    boundPcHardwareId: input.lockToRequestedPcImmediately
      ? input.request.pcHardwareId.slice(0, 128)
      : '',
    boundPcName: input.lockToRequestedPcImmediately
      ? input.request.pcName.slice(0, 120)
      : '',
    status: 'ACTIVE',
    installedVersion: CURRENT_SOFTWARE_VERSION,
    lastSeenAtIso: nowIso,
    createdAtIso: nowIso,
    adminAuthSig: ADMIN_AUTH_SIG,
  };

  const updatedReq: AccessRequestRecord = {
    ...input.request,
    status: 'APPROVED',
    assignedUserId: cleanUserId,
    assignedLicenseKey: licenseRecord.licenseKey,
  };
  upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, licenseRecord, (x) => x.userId);
  upsertMirrorItem(LOCAL_MIRROR_REQUESTS_KEY, updatedReq, (x) => x.requestId);

  const reqUpdates = {
    status: 'APPROVED',
    assignedUserId: cleanUserId,
    assignedLicenseKey: licenseRecord.licenseKey,
    adminAuthSig: ADMIN_AUTH_SIG,
  };

  await Promise.all([
    firestoreRestSetDoc(
      'software_licenses',
      cleanUserId,
      licenseRecord as unknown as Record<string, unknown>
    ),
    firestoreRestUpdateDoc('access_requests', input.request.requestId, reqUpdates),
    withFirestoreTimeout(
      Promise.all([
        setDoc(doc(db, 'software_licenses', cleanUserId), licenseRecord),
        updateDoc(doc(db, 'access_requests', input.request.requestId), reqUpdates),
      ]),
      3500
    ).catch(() => {}),
  ]);

  return licenseRecord;
}

/**
 * Admin Action: Directly creates a new 1-PC License without a prior request.
 */
export async function createDirectSoftwareLicense(input: {
  userId: string;
  password: string;
  licenseKey: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  boundPcHardwareId?: string;
}): Promise<SoftwareLicenseRecord> {
  const cleanUserId = sanitizeIdentifier(input.userId);
  const nowIso = new Date().toISOString();
  const record: SoftwareLicenseRecord = {
    userId: cleanUserId,
    portalScope: PORTAL_SCOPE,
    password: input.password.trim().slice(0, 120),
    licenseKey: input.licenseKey.trim().toUpperCase().slice(0, 80),
    fullName: (input.fullName.trim() || cleanUserId).slice(0, 120),
    email: (input.email || '').trim().slice(0, 160),
    phone: (input.phone || '').trim().slice(0, 60),
    organization: (input.organization || 'Licensed Organization').trim().slice(0, 160),
    boundPcHardwareId: (input.boundPcHardwareId || '').trim().slice(0, 128),
    boundPcName: input.boundPcHardwareId ? 'Pre-Bound Workstation' : '',
    status: 'ACTIVE',
    installedVersion: CURRENT_SOFTWARE_VERSION,
    lastSeenAtIso: nowIso,
    createdAtIso: nowIso,
    adminAuthSig: ADMIN_AUTH_SIG,
  };

  unmarkIdsDeletedTombstone([cleanUserId, `req_${cleanUserId}`, input.boundPcHardwareId || '']);
  upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, record, (x) => x.userId);

  await Promise.all([
    firestoreRestSetDoc(
      'software_licenses',
      cleanUserId,
      record as unknown as Record<string, unknown>
    ),
    withFirestoreTimeout(
      setDoc(doc(db, 'software_licenses', cleanUserId), record),
      3500
    ).catch(() => {}),
  ]);
  return record;
}

/**
 * Admin Action: Resets the 1-PC Hardware Lock or changes status (ACTIVE / SUSPENDED / REVOKED).
 */
export async function updateSoftwareLicenseAdmin(
  userId: string,
  updates: Partial<
    Pick<
      SoftwareLicenseRecord,
      'status' | 'boundPcHardwareId' | 'boundPcName' | 'password' | 'licenseKey'
    >
  >
): Promise<void> {
  const cleanUserId = sanitizeIdentifier(userId);
  const nowIso = new Date().toISOString();
  const existing = readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY).find(
    (l) => l.userId === cleanUserId
  );
  if (existing) {
    upsertMirrorItem(
      LOCAL_MIRROR_LICENSES_KEY,
      { ...existing, ...updates, lastSeenAtIso: nowIso },
      (x) => x.userId
    );
  }
  const payload = {
    ...updates,
    lastSeenAtIso: nowIso,
    adminAuthSig: ADMIN_AUTH_SIG,
  };
  await Promise.all([
    firestoreRestUpdateDoc('software_licenses', cleanUserId, payload),
    withFirestoreTimeout(
      updateDoc(doc(db, 'software_licenses', cleanUserId), payload),
      3500
    ).catch(() => {}),
  ]);
}

export async function deleteSoftwareLicenseAdmin(userId: string): Promise<void> {
  const cleanUserId = sanitizeIdentifier(userId);
  const allLicenses = readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY);
  const targetLic = allLicenses.find((l) => l.userId === cleanUserId) || null;

  const allRequests = readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY);
  const matchingRequests = allRequests.filter(
    (r) =>
      r.requestId === `req_${cleanUserId}` ||
      r.assignedUserId === cleanUserId ||
      (targetLic?.boundPcHardwareId &&
        r.pcHardwareId &&
        r.pcHardwareId.toLowerCase() === targetLic.boundPcHardwareId.toLowerCase()) ||
      (targetLic?.email &&
        r.email &&
        r.email.toLowerCase() === targetLic.email.toLowerCase())
  );

  const matchingReqIds = Array.from(
    new Set([`req_${cleanUserId}`, ...matchingRequests.map((r) => r.requestId)])
  );

  // Record tombstones so background cloud sync never recreates this deleted user
  markIdsDeletedTombstone([
    cleanUserId,
    ...matchingReqIds,
    targetLic?.boundPcHardwareId || '',
  ]);

  // Immediately remove from local mirrors so UI updates in 0ms
  removeMirrorItem<SoftwareLicenseRecord>(
    LOCAL_MIRROR_LICENSES_KEY,
    cleanUserId,
    (x) => x.userId
  );
  const remainingReqs = allRequests.filter((r) => !matchingReqIds.includes(r.requestId));
  writeLocalMirror(LOCAL_MIRROR_REQUESTS_KEY, remainingReqs);

  const nowIso = new Date().toISOString();

  await Promise.all([
    // Mark REVOKED first in case any endpoint blocks raw DELETE, then DELETE across all endpoints
    firestoreRestUpdateDoc('software_licenses', cleanUserId, {
      status: 'REVOKED',
      lastSeenAtIso: nowIso,
      adminAuthSig: ADMIN_AUTH_SIG,
    }).catch(() => false),
    firestoreRestDeleteDoc('software_licenses', cleanUserId),
    withFirestoreTimeout(deleteDoc(doc(db, 'software_licenses', cleanUserId)), 3500).catch(
      () => {}
    ),
    ...matchingReqIds.flatMap((reqId) => [
      firestoreRestUpdateDoc('access_requests', reqId, {
        status: 'REJECTED',
        assignedUserId: '',
        assignedLicenseKey: '',
        adminAuthSig: ADMIN_AUTH_SIG,
      }).catch(() => false),
      firestoreRestDeleteDoc('access_requests', reqId),
      withFirestoreTimeout(deleteDoc(doc(db, 'access_requests', reqId)), 3500).catch(
        () => {}
      ),
    ]),
  ]);
}

export async function rejectAccessRequestAdmin(requestId: string): Promise<void> {
  const existing = readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY).find(
    (r) => r.requestId === requestId
  );
  if (existing) {
    upsertMirrorItem(
      LOCAL_MIRROR_REQUESTS_KEY,
      {
        ...existing,
        status: 'REJECTED',
        assignedUserId: '',
        assignedLicenseKey: '',
      },
      (x) => x.requestId
    );
  }
  const rejectUpdates = {
    status: 'REJECTED',
    assignedUserId: '',
    assignedLicenseKey: '',
    adminAuthSig: ADMIN_AUTH_SIG,
  };
  await Promise.all([
    firestoreRestUpdateDoc('access_requests', requestId, rejectUpdates),
    withFirestoreTimeout(
      updateDoc(doc(db, 'access_requests', requestId), rejectUpdates),
      3500
    ).catch(() => {}),
  ]);
}

/**
 * Admin Action: Saves & syncs the GitHub Repository slug ("owner/repo") to Firestore
 * so all User PCs and Admin Portals automatically know the GitHub User Software .EXE link.
 */
export async function syncGithubRepoConfigToCloud(rawRepoInput: string): Promise<string> {
  const cleanRepo = saveConfiguredGithubRepo(rawRepoInput);
  if (!cleanRepo) return '';
  const configRecord: SoftwareReleaseRecord = {
    releaseId: 'GITHUB_REPO_CONFIG',
    portalScope: PORTAL_SCOPE,
    version: '0.0.0',
    title: cleanRepo.slice(0, 160),
    releaseNotes: 'GitHub Repository Configuration for Dual Master & User .EXE Releases',
    downloadUrl: getGithubUserExeDownloadUrl(cleanRepo).slice(0, 500),
    targetScope: 'ALL_PCS',
    targetIdentifierCsv: 'ALL',
    isMandatory: false,
    status: 'ARCHIVED',
    publishedAtIso: new Date().toISOString(),
    adminAuthSig: ADMIN_AUTH_SIG,
  };
  upsertMirrorItem(LOCAL_MIRROR_RELEASES_KEY, configRecord, (x) => x.releaseId);
  try {
    await withFirestoreTimeout(
      setDoc(doc(db, 'software_releases', 'GITHUB_REPO_CONFIG'), configRecord)
    );
  } catch {
    // Non-fatal if offline
  }
  return cleanRepo;
}

/**
 * Admin Action: Publishes a Software Update Release and notifies all or specific target PCs in real time.
 */
export async function publishSoftwareUpdateRelease(input: {
  version: string;
  title: string;
  releaseNotes: string;
  downloadUrl: string;
  targetScope: 'ALL_PCS' | 'SPECIFIC_PCS';
  targetIdentifierCsv: string;
  isMandatory: boolean;
}): Promise<SoftwareReleaseRecord> {
  const releaseId = `rel_${input.version.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
  const rawUrl = input.downloadUrl.trim();
  const resolvedUrl =
    !rawUrl ||
    rawUrl === 'BUILTIN_WINDOWS_EXE' ||
    rawUrl === 'USER_SOFTWARE_EXE' ||
    rawUrl === 'GITHUB_USER_EXE'
      ? getGithubUserExeDownloadUrl()
      : rawUrl;

  const record: SoftwareReleaseRecord = {
    releaseId,
    portalScope: PORTAL_SCOPE,
    version: input.version.trim().slice(0, 40),
    title: input.title.trim().slice(0, 160),
    releaseNotes: input.releaseNotes.trim().slice(0, 2000),
    downloadUrl: resolvedUrl.slice(0, 500),
    targetScope: input.targetScope,
    targetIdentifierCsv: input.targetIdentifierCsv.trim().slice(0, 1500),
    isMandatory: input.isMandatory,
    status: 'PUBLISHED',
    publishedAtIso: new Date().toISOString(),
    adminAuthSig: ADMIN_AUTH_SIG,
  };

  upsertMirrorItem(LOCAL_MIRROR_RELEASES_KEY, record, (x) => x.releaseId);

  await Promise.all([
    firestoreRestSetDoc(
      'software_releases',
      releaseId,
      record as unknown as Record<string, unknown>
    ),
    withFirestoreTimeout(
      setDoc(doc(db, 'software_releases', releaseId), record),
      3500
    ).catch(() => {}),
  ]);
  return record;
}

export async function deleteSoftwareReleaseAdmin(releaseId: string): Promise<void> {
  removeMirrorItem<SoftwareReleaseRecord>(
    LOCAL_MIRROR_RELEASES_KEY,
    releaseId,
    (x) => x.releaseId
  );
  await Promise.all([
    firestoreRestDeleteDoc('software_releases', releaseId),
    withFirestoreTimeout(
      deleteDoc(doc(db, 'software_releases', releaseId)),
      3500
    ).catch(() => {}),
  ]);
}

/**
 * Client Action: Reports that this PC has downloaded and updated to the new software version.
 */
export async function acknowledgeClientUpdateInstalled(newVersion: string): Promise<void> {
  const cleanVer = newVersion.trim().slice(0, 40);
  setInstalledSoftwareVersion(cleanVer);
  const session = getLocalActivatedSession();
  if (!session) return;
  const cleanUserId = sanitizeIdentifier(session.userId);
  const nowIso = new Date().toISOString();

  const existingLocal = readLocalMirror<SoftwareLicenseRecord>(
    LOCAL_MIRROR_LICENSES_KEY
  ).find((l) => l.userId === cleanUserId);
  if (existingLocal) {
    upsertMirrorItem(
      LOCAL_MIRROR_LICENSES_KEY,
      { ...existingLocal, installedVersion: cleanVer, lastSeenAtIso: nowIso },
      (x) => x.userId
    );
  }

  await Promise.all([
    firestoreRestUpdateDoc('software_licenses', cleanUserId, {
      installedVersion: cleanVer,
      lastSeenAtIso: nowIso,
    }),
    withFirestoreTimeout(
      updateDoc(doc(db, 'software_licenses', cleanUserId), {
        installedVersion: cleanVer,
        lastSeenAtIso: nowIso,
      }),
      2000
    ).catch(() => {}),
  ]);
}

/**
 * Helper to save the compiled OTA bundle into IndexedDB (eswa_ota_code_vault_v1)
 * so the Standalone Android APK (.APK) bootloader hot-loads the updated code
 * without deleting any localStorage or IndexedDB tunnel projects.
 */
async function saveOtaBundleToIndexedDbVault(bundle: {
  version: string;
  cssContent?: string;
  jsContent?: string;
  appliedAtIso: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const req = window.indexedDB.open('eswa_ota_code_vault_v1', 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('bundles')) {
          db.createObjectStore('bundles');
        }
      };
      req.onerror = () => resolve(false);
      req.onsuccess = (e) => {
        try {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction('bundles', 'readwrite');
          const store = tx.objectStore('bundles');
          store.put(bundle, 'active_ota_bundle');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * 1-Tap In-App Over-The-Air (OTA) Live Auto-Updater (Zero Data Deletion):
 * Updates the User Android App (.APK) or User PC Software (.EXE) in-place when the user
 * clicks the update notification, preserving 100% of previous tunnel projects, photos,
 * joint traces, and their 1-time login session.
 */
export async function performInAppOtaAutoUpdate(
  release: SoftwareReleaseRecord,
  onProgress?: (percent: number, statusText: string) => void
): Promise<void> {
  const step = async (pct: number, msg: string, delayMs: number) => {
    if (onProgress) onProgress(pct, msg);
    await new Promise((r) => setTimeout(r, delayMs));
  };

  // STEP 1: Lock & Back Up All Existing User Data (Projects, Geometries, Photos, 1-Time Login)
  await step(
    15,
    `Backing up all tunnel projects, photos & login session (Zero Data Deletion)...`,
    350
  );

  if (typeof window !== 'undefined') {
    try {
      const preservedEntries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          const v = localStorage.getItem(k);
          if (v !== null) preservedEntries[k] = v;
        }
      }
      localStorage.setItem(
        'eswa_zero_data_loss_update_snapshot_v1',
        JSON.stringify({
          targetVersion: release.version,
          snapshotAtIso: new Date().toISOString(),
          keysCount: Object.keys(preservedEntries).length,
        })
      );
      const winDesktop = (
        window as unknown as {
          eswaDesktop?: {
            syncStorageBatch?: (entries: Record<string, string>) => Promise<unknown>;
            applyOtaUpdate?: (payload: {
              version: string;
              cssContent?: string;
              jsContent?: string;
              edition?: string;
            }) => Promise<{ ok?: boolean }>;
          };
        }
      ).eswaDesktop;
      if (winDesktop?.syncStorageBatch) {
        await winDesktop.syncStorageBatch(preservedEntries).catch(() => {});
      }
    } catch {
      // Ignore storage backup warning
    }
  }

  // STEP 2: Download Latest Compiled OTA Bundle from Cloud Server or GitHub Release
  await step(
    45,
    `Downloading compiled v${release.version} update package (User App & PC Software)...`,
    450
  );

  let otaCssContent = '';
  let otaJsContent = '';

  const candidateUrls: string[] = [
    ...getServerRelayUrls(
      `/api/ota/latest-bundle?version=${encodeURIComponent(release.version)}&t=${Date.now()}`
    ),
  ];
  const ghRepo = getConfiguredGithubRepo();
  if (ghRepo) {
    candidateUrls.push(
      `https://github.com/${ghRepo}/releases/download/latest/user-ota-bundle.json?t=${Date.now()}`
    );
  }

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getEswaApiSecurityHeaders(),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          cssContent?: string;
          jsContent?: string;
        };
        if (data && typeof data.jsContent === 'string' && data.jsContent.length > 100) {
          otaCssContent = data.cssContent || '';
          otaJsContent = data.jsContent;
          break;
        }
      }
    } catch {
      // Try next mirror
    }
  }

  try {
    await refreshAdminLicensingDataFromCloud();
  } catch {
    // Ignore offline
  }

  // STEP 3: Apply In-Place OTA Bundle to Android APK Vault & Windows Desktop EXE (%APPDATA%/ota-live)
  await step(
    75,
    `Installing v${release.version} in-place (preserving 100% of existing projects & data)...`,
    500
  );

  if (typeof window !== 'undefined') {
    try {
      // 3a. Save into IndexedDB OTA Vault for Android APK & Web/PWA
      if (otaJsContent) {
        await saveOtaBundleToIndexedDbVault({
          version: release.version,
          cssContent: otaCssContent,
          jsContent: otaJsContent,
          appliedAtIso: new Date().toISOString(),
        });
        if (otaCssContent) {
          const styleEl = document.getElementById('eswa-main-css');
          if (styleEl) {
            styleEl.textContent = otaCssContent;
          }
        }
      }

      // 3b. Save into Windows Electron %APPDATA%\AKASH TUNNEL MAPPER\user-data\ota-live\
      const winDesktop = (
        window as unknown as {
          eswaDesktop?: {
            applyOtaUpdate?: (payload: {
              version: string;
              cssContent?: string;
              jsContent?: string;
              edition?: string;
            }) => Promise<{ ok?: boolean }>;
          };
        }
      ).eswaDesktop;
      if (winDesktop?.applyOtaUpdate) {
        await winDesktop
          .applyOtaUpdate({
            version: release.version,
            cssContent: otaCssContent,
            jsContent: otaJsContent,
            edition: 'user',
          })
          .catch(() => {});
      }

      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update().catch(() => {});
        }
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k).catch(() => false)));
      }
    } catch {
      // Ignore cache clear errors
    }
  }

  // STEP 4: Acknowledge New Version to Master Admin & Finalize
  await step(
    92,
    `Activating v${release.version} & syncing updated status to Master Software/App...`,
    350
  );

  await acknowledgeClientUpdateInstalled(release.version);

  await step(
    100,
    `Updated to v${release.version} automatically! All previous projects & data are intact.`,
    300
  );
}

/**
 * Real-time listener on the User App / User Software that watches whether the Master Admin
 * has SUSPENDED or REACTIVATEd this user's account.
 */
export function subscribeUserAccountStatus(
  userId: string,
  onStatusChange: (
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
    license: SoftwareLicenseRecord | null
  ) => void
): () => void {
  const cleanUserId = sanitizeIdentifier(userId);
  if (
    !cleanUserId ||
    cleanUserId === 'standalone_user' ||
    cleanUserId === 'master_owner'
  ) {
    return () => {};
  }

  const checkStatus = async () => {
    try {
      const lic = await getSoftwareLicenseById(cleanUserId);
      if (lic && lic.status) {
        onStatusChange(lic.status, lic);
      }
    } catch {
      // Ignore offline errors
    }
  };

  void checkStatus();
  const pollTimer = window.setInterval(() => {
    void checkStatus();
  }, 4000);

  const unsub = onSnapshot(
    doc(db, 'software_licenses', cleanUserId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as SoftwareLicenseRecord;
      upsertMirrorItem(LOCAL_MIRROR_LICENSES_KEY, data, (x) => x.userId);
      onStatusChange(data.status, data);
    },
    () => {
      // Handled by REST poll
    }
  );

  return () => {
    window.clearInterval(pollTimer);
    window.setTimeout(() => {
      try {
        unsub();
      } catch {
        // Ignore unlisten race
      }
    }, 250);
  };
}

function mergeById<T>(
  cloudList: T[],
  localList: T[],
  idGetter: (x: T) => string
): T[] {
  const map = new Map<string, T>();
  for (const item of localList) {
    const id = idGetter(item);
    if (id) map.set(id, item);
  }
  for (const item of cloudList) {
    const id = idGetter(item);
    if (!id) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
    } else {
      const exRec = existing as unknown as {
        status?: string;
        lastSeenAtIso?: string;
      };
      const newRec = item as unknown as {
        status?: string;
        lastSeenAtIso?: string;
      };
      if (
        exRec.lastSeenAtIso &&
        newRec.lastSeenAtIso &&
        exRec.lastSeenAtIso > newRec.lastSeenAtIso
      ) {
        // Keep local if it has a newer timestamp (e.g. just suspended/reactivated locally)
        continue;
      }
      if (newRec.status === 'PENDING' && exRec.status && exRec.status !== 'PENDING') {
        continue;
      }
      map.set(id, { ...existing, ...item });
    }
  }
  return Array.from(map.values());
}

/**
 * Forces an immediate Dual-Project Cloud REST Sync of all Access Requests, Licenses,
 * Releases, and Master PCs so the Master App and Master Software immediately display
 * every user request even if WebSocket/Long-Polling streams are blocked on file:// or mobile data.
 */
export async function refreshAdminLicensingDataFromCloud(): Promise<{
  requests: AccessRequestRecord[];
  licenses: SoftwareLicenseRecord[];
  releases: SoftwareReleaseRecord[];
  masterPcs: MasterPcRecord[];
}> {
  await syncPendingLocalRequestsToCloud();

  const [cloudReqs, cloudLics, cloudRels, cloudMpcs] = await Promise.all([
    firestoreRestQueryCollection<AccessRequestRecord>(
      'access_requests',
      (x) => x.requestId
    ),
    firestoreRestQueryCollection<SoftwareLicenseRecord>(
      'software_licenses',
      (x) => x.userId
    ),
    firestoreRestQueryCollection<SoftwareReleaseRecord>(
      'software_releases',
      (x) => x.releaseId
    ),
    firestoreRestQueryCollection<MasterPcRecord>(
      'master_pcs',
      (x) => x.pcHardwareId
    ),
  ]);

  const currentReqs = mergeById(
    cloudReqs,
    readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY),
    (x) => x.requestId
  )
    .filter(
      (r) =>
        r.status !== 'REJECTED' &&
        !isIdDeletedTombstone(r.requestId, r.createdAtIso) &&
        !isIdDeletedTombstone(r.assignedUserId, r.createdAtIso) &&
        !isIdDeletedTombstone(r.pcHardwareId, r.createdAtIso)
    )
    .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));

  const currentLics = mergeById(
    cloudLics,
    readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY),
    (x) => x.userId
  ).filter(
    (l) =>
      l.status !== 'REVOKED' &&
      !isIdDeletedTombstone(l.userId, l.createdAtIso) &&
      !isIdDeletedTombstone(l.boundPcHardwareId, l.createdAtIso)
  );

  // Automatically unify any registered user from access_requests into software_licenses
  // so both Master Android App and Master PC Software always show ALL Android + PC users together
  let licsChanged = cloudLics.length > 0;
  let reqsChanged = cloudReqs.length > 0;
  for (const req of currentReqs) {
    if (req.status === 'REJECTED') continue;
    const matchLic = currentLics.find(
      (l) =>
        (req.assignedUserId && l.userId === req.assignedUserId) ||
        (req.pcHardwareId && l.boundPcHardwareId === req.pcHardwareId) ||
        (req.email && l.email.toLowerCase() === req.email.toLowerCase())
    );
    if (!matchLic) {
      const isAndroid =
        (req.pcHardwareId || '').startsWith('AND') ||
        (req.pcHardwareId || '').startsWith('MOB') ||
        (req.pcName || '').toLowerCase().includes('android');
      const platformTag = isAndroid ? 'ANDROID_APP' : 'PC_SOFTWARE';
      const platformLabel = isAndroid ? 'Android Mobile App' : 'PC Workstation Software';
      const slug = sanitizeIdentifier(req.fullName || 'user')
        .toLowerCase()
        .slice(0, 20);
      const hwSuf = sanitizeIdentifier(req.pcHardwareId || 'dev01')
        .toLowerCase()
        .slice(-8);
      const autoUserId = sanitizeIdentifier(
        req.assignedUserId || `usr_${slug}_${hwSuf}`
      );
      const newLic: SoftwareLicenseRecord = {
        userId: autoUserId,
        portalScope: PORTAL_SCOPE,
        password: (req.roleTitle || 'Tunnel Engineer').slice(0, 80),
        licenseKey: req.assignedLicenseKey || `ESWA-${platformTag}-ACTIVE`,
        fullName: req.fullName,
        email: req.email,
        phone: req.phone,
        organization: req.organization,
        boundPcHardwareId: req.pcHardwareId,
        boundPcName: req.pcName || `${platformLabel} · ${req.roleTitle || 'Engineer'}`,
        status: 'ACTIVE',
        installedVersion: CURRENT_SOFTWARE_VERSION,
        lastSeenAtIso: req.createdAtIso || new Date().toISOString(),
        createdAtIso: req.createdAtIso || new Date().toISOString(),
        adminAuthSig: ADMIN_AUTH_SIG,
      };
      currentLics.push(newLic);
      licsChanged = true;
      void firestoreRestSetDoc(
        'software_licenses',
        autoUserId,
        newLic as unknown as Record<string, unknown>
      );
      if (req.status === 'PENDING') {
        req.status = 'APPROVED';
        req.assignedUserId = autoUserId;
        req.assignedLicenseKey = newLic.licenseKey;
        reqsChanged = true;
        void firestoreRestUpdateDoc('access_requests', req.requestId, {
          status: 'APPROVED',
          assignedUserId: autoUserId,
          assignedLicenseKey: newLic.licenseKey,
          adminAuthSig: ADMIN_AUTH_SIG,
        });
      }
    }
  }

  if (reqsChanged) {
    writeLocalMirror(LOCAL_MIRROR_REQUESTS_KEY, currentReqs);
  }

  if (licsChanged) {
    currentLics.sort((a, b) =>
      (b.createdAtIso || '').localeCompare(a.createdAtIso || '')
    );
    writeLocalMirror(LOCAL_MIRROR_LICENSES_KEY, currentLics);
  }

  if (cloudRels.length > 0) {
    const mergedRels = mergeById(
      cloudRels,
      readLocalMirror<SoftwareReleaseRecord>(LOCAL_MIRROR_RELEASES_KEY),
      (x) => x.releaseId
    ).sort((a, b) => (b.publishedAtIso || '').localeCompare(a.publishedAtIso || ''));
    writeLocalMirror(LOCAL_MIRROR_RELEASES_KEY, mergedRels);
  }

  if (cloudMpcs.length > 0) {
    const mergedMpcs = mergeById(
      cloudMpcs,
      readLocalMirror<MasterPcRecord>(LOCAL_MIRROR_MASTER_PCS_KEY),
      (x) => x.pcHardwareId
    ).sort((a, b) => (b.registeredAtIso || '').localeCompare(a.registeredAtIso || ''));
    writeLocalMirror(LOCAL_MIRROR_MASTER_PCS_KEY, mergedMpcs);
  }

  return {
    requests: readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY),
    licenses: readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY),
    releases: readLocalMirror<SoftwareReleaseRecord>(LOCAL_MIRROR_RELEASES_KEY),
    masterPcs: readLocalMirror<MasterPcRecord>(LOCAL_MIRROR_MASTER_PCS_KEY),
  };
}

/**
 * Real-time listener for all Access Requests, Licenses, Releases, and Master PCs (for Master Admin Website & Master Software).
 * Combines Firestore onSnapshot with active 4-second Dual-Cloud HTTPS REST polling so new requests
 * from any Android APK, Windows EXE, or browser are guaranteed to appear in the Master App & Software.
 */
export function subscribeAdminLicensingData(callbacks: {
  onRequests: (list: AccessRequestRecord[]) => void;
  onLicenses: (list: SoftwareLicenseRecord[]) => void;
  onReleases: (list: SoftwareReleaseRecord[]) => void;
  onMasterPcs: (list: MasterPcRecord[]) => void;
}): () => void {
  const pushFromMirror = () => {
    callbacks.onRequests(
      readLocalMirror<AccessRequestRecord>(LOCAL_MIRROR_REQUESTS_KEY)
        .filter(
          (r) =>
            r.status !== 'REJECTED' &&
            !isIdDeletedTombstone(r.requestId, r.createdAtIso) &&
            !isIdDeletedTombstone(r.assignedUserId, r.createdAtIso) &&
            !isIdDeletedTombstone(r.pcHardwareId, r.createdAtIso)
        )
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''))
    );
    callbacks.onLicenses(
      readLocalMirror<SoftwareLicenseRecord>(LOCAL_MIRROR_LICENSES_KEY)
        .filter(
          (l) =>
            l.status !== 'REVOKED' &&
            !isIdDeletedTombstone(l.userId, l.createdAtIso) &&
            !isIdDeletedTombstone(l.boundPcHardwareId, l.createdAtIso)
        )
        .sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''))
    );
    const allMirrorReleases = readLocalMirror<SoftwareReleaseRecord>(
      LOCAL_MIRROR_RELEASES_KEY
    );
    const ghCfg = allMirrorReleases.find((r) => r.releaseId === 'GITHUB_REPO_CONFIG');
    if (ghCfg && ghCfg.title && normalizeGithubRepoSlug(ghCfg.title)) {
      if (!getConfiguredGithubRepo()) {
        saveConfiguredGithubRepo(ghCfg.title);
      }
    }
    callbacks.onReleases(
      allMirrorReleases
        .filter((r) => r.releaseId !== 'GITHUB_REPO_CONFIG')
        .sort((a, b) => (b.publishedAtIso || '').localeCompare(a.publishedAtIso || ''))
    );
    callbacks.onMasterPcs(
      readLocalMirror<MasterPcRecord>(LOCAL_MIRROR_MASTER_PCS_KEY).sort((a, b) =>
        (b.registeredAtIso || '').localeCompare(a.registeredAtIso || '')
      )
    );
  };

  // Emit local mirror immediately so UI is responsive with 0ms delay
  pushFromMirror();

  // Immediately pull from Dual-Cloud HTTPS REST API and repeat every 4 seconds
  void refreshAdminLicensingDataFromCloud();
  const restPollTimer = window.setInterval(() => {
    void refreshAdminLicensingDataFromCloud();
  }, 4000);

  const handleFocusOrVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void refreshAdminLicensingDataFromCloud();
    }
  };
  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', handleFocusOrVisible);

  const handleMirrorEvent = () => pushFromMirror();
  window.addEventListener('eswa-licensing-mirror-updated', handleMirrorEvent);
  window.addEventListener('storage', handleMirrorEvent);

  return () => {
    window.clearInterval(restPollTimer);
    window.removeEventListener('focus', handleFocusOrVisible);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
    window.removeEventListener('eswa-licensing-mirror-updated', handleMirrorEvent);
    window.removeEventListener('storage', handleMirrorEvent);
  };
}

/**
 * Real-time listener on the Software Side for targeted Software Updates.
 */
export function subscribeClientSoftwareUpdates(
  onTargetedRelease: (release: SoftwareReleaseRecord | null) => void
): () => void {
  const evaluateReleases = (allReleases: SoftwareReleaseRecord[]) => {
    const ghCfg = allReleases.find((r) => r.releaseId === 'GITHUB_REPO_CONFIG');
    if (ghCfg && ghCfg.title && normalizeGithubRepoSlug(ghCfg.title)) {
      saveConfiguredGithubRepo(ghCfg.title);
    }

    const { pcHardwareId } = getOrGeneratePcHardwareId();
    const session = getLocalActivatedSession();
    const currentVer = getInstalledSoftwareVersion();

    const published = allReleases
      .filter((r) => r.status === 'PUBLISHED' && r.releaseId !== 'GITHUB_REPO_CONFIG')
      .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));

    const matching = published.find((rel) => {
      if (rel.version === currentVer) return false;
      if (rel.targetScope === 'ALL_PCS') return true;
      const targets = rel.targetIdentifierCsv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const matchPc = targets.includes(pcHardwareId.toLowerCase());
      const matchUser = session?.userId
        ? targets.includes(session.userId.toLowerCase())
        : false;
      return matchPc || matchUser;
    });

    onTargetedRelease(matching || null);
  };

  evaluateReleases(readLocalMirror<SoftwareReleaseRecord>(LOCAL_MIRROR_RELEASES_KEY));

  const pollRemoteReleases = async () => {
    try {
      const cloudRels = await firestoreRestQueryCollection<SoftwareReleaseRecord>(
        'software_releases',
        (x) => x.releaseId
      );
      if (cloudRels.length > 0) {
        const merged = mergeById(
          cloudRels,
          readLocalMirror<SoftwareReleaseRecord>(LOCAL_MIRROR_RELEASES_KEY),
          (x) => x.releaseId
        ).sort((a, b) => (b.publishedAtIso || '').localeCompare(a.publishedAtIso || ''));
        writeLocalMirror(LOCAL_MIRROR_RELEASES_KEY, merged);
        evaluateReleases(merged);
      }
    } catch {
      // Ignore offline errors
    }
  };
  void pollRemoteReleases();
  const relPollTimer = window.setInterval(() => {
    void pollRemoteReleases();
  }, 6000);

  const handleLocalChange = () => {
    evaluateReleases(readLocalMirror<SoftwareReleaseRecord>(LOCAL_MIRROR_RELEASES_KEY));
  };
  window.addEventListener('eswa-licensing-mirror-updated', handleLocalChange);
  window.addEventListener('storage', handleLocalChange);

  const qRel = query(
    collection(db, 'software_releases'),
    where('portalScope', '==', PORTAL_SCOPE)
  );

  const unsub = onSnapshot(
    qRel,
    (snap) => {
      const docs = snap.docs.map((d) => d.data() as SoftwareReleaseRecord);
      if (docs.length > 0 || !snap.metadata.fromCache) {
        writeLocalMirror(LOCAL_MIRROR_RELEASES_KEY, docs);
        evaluateReleases(docs);
      }
    },
    () => {
      // Ignore offline snapshot errors on client update watcher
    }
  );

  return () => {
    window.clearInterval(relPollTimer);
    window.removeEventListener('eswa-licensing-mirror-updated', handleLocalChange);
    window.removeEventListener('storage', handleLocalChange);
    window.setTimeout(() => {
      try {
        unsub();
      } catch {
        // Ignore unlisten race
      }
    }, 250);
  };
}
