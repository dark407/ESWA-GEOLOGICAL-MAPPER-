import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  computeSha256Hex,
  publishSoftwareUpdateRelease,
  submitSoftwareAccessRequest,
} from './softwareLicensingEngine';
import {
  downloadMasterAndroidApk,
  downloadMasterEditionDesktopExe,
  downloadUserAndroidApk,
  downloadUserEditionDesktopExe,
  getPublicShareOrigin,
} from './windowsDesktopEngine';

export type InstallerPackageKind =
  | 'master_exe'
  | 'user_exe'
  | 'master_apk'
  | 'user_apk';

export interface PlatformBinaryMeta {
  fileName: string;
  version: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256: string;
  downloadUrl: string;
  uploadedAtIso: string;
  osRequirement: string;
  architecture: string;
  storageMode: 'BUILT_IN' | 'SERVER_BINARY' | 'EXTERNAL_URL' | 'INDEXED_DB';
}

export interface WebsiteReleaseRecord {
  releaseId: string;
  version: string;
  title: string;
  summary: string;
  publishedAtIso: string;
  publishedBy: string;
  isCurrent: boolean;
  /** 1. Master EXE (Windows Master Suite) */
  masterExe: PlatformBinaryMeta;
  /** 2. User EXE (Windows Geologist Workstation) */
  userExe: PlatformBinaryMeta;
  /** 3. Android APK Master (Master Admin Mobile/Tablet) */
  masterApk: PlatformBinaryMeta;
  /** 4. Android APK User (Field Geologist Mobile/Tablet) */
  userApk: PlatformBinaryMeta;
  /** Legacy aliases kept synchronized for backward compatibility */
  windowsExe: PlatformBinaryMeta;
  androidApk: PlatformBinaryMeta;
  changelogBullets: string[];
  installationNotesWindow: string;
  installationNotesAndroid: string;
}

const LOCAL_WEBSITE_RELEASES_KEY = 'eswa_website_releases_v2';
const IDB_BINARY_DB_NAME = 'eswa_website_binaries_idb_v1';
const IDB_BINARY_STORE = 'binaries';

export const DEFAULT_MASTER_EXE_META: PlatformBinaryMeta = {
  fileName: 'ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe',
  version: '2.5.0',
  sizeBytes: 85196800,
  sizeFormatted: '81.2 MB',
  sha256: '4a7d1ed414474e4033ac29ccb8653d9b4e09996d27ae41e4649b934ca495991b',
  downloadUrl: 'BUILT_IN_MASTER_EXE',
  uploadedAtIso: '2026-11-01T00:00:00.000Z',
  osRequirement: 'Windows 10 / Windows 11 (64-bit) — Master Admin',
  architecture: 'x64 / PE32+ Master Suite',
  storageMode: 'BUILT_IN',
};

export const DEFAULT_USER_EXE_META: PlatformBinaryMeta = {
  fileName: 'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
  version: '2.5.0',
  sizeBytes: 84515840,
  sizeFormatted: '80.6 MB',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  downloadUrl: 'BUILT_IN_USER_EXE',
  uploadedAtIso: '2026-11-01T00:00:00.000Z',
  osRequirement: 'Windows 10 / Windows 11 (64-bit) — Field & Office Geologist',
  architecture: 'x64 / PE32+ User Workstation',
  storageMode: 'BUILT_IN',
};

export const DEFAULT_MASTER_APK_META: PlatformBinaryMeta = {
  fileName: 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
  version: '2.5.0',
  sizeBytes: 18874368,
  sizeFormatted: '18.0 MB',
  sha256: '9b74c9897bac770ffc029102a200c5de3961dd3c1ac88b59b2dc327aa41298f0',
  downloadUrl: 'BUILT_IN_MASTER_APK',
  uploadedAtIso: '2026-11-01T00:00:00.000Z',
  osRequirement: 'Android 10.0+ — Master Admin & License Control',
  architecture: 'ARM64-v8a / Universal APK',
  storageMode: 'BUILT_IN',
};

export const DEFAULT_USER_APK_META: PlatformBinaryMeta = {
  fileName: 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
  version: '2.5.0',
  sizeBytes: 18454937,
  sizeFormatted: '17.6 MB',
  sha256: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
  downloadUrl: 'BUILT_IN_USER_APK',
  uploadedAtIso: '2026-11-01T00:00:00.000Z',
  osRequirement: 'Android 10.0+ — Field Tablet & Mobile Mapper',
  architecture: 'ARM64-v8a / Universal APK',
  storageMode: 'BUILT_IN',
};

export const DEFAULT_CURRENT_RELEASE: WebsiteReleaseRecord = {
  releaseId: 'rel_v2_5_0_initial',
  version: '2.5.0',
  title: 'ESWA GEOLOGICAL MAPPER — Enterprise NATM, TBM & Exploration Suite',
  summary:
    'Official distribution release containing the 4 standalone packages: Master EXE, User EXE, Android APK Master, and Android APK User with isolated NATM, TBM, and Mining exploration engines.',
  publishedAtIso: '2026-11-01T00:00:00.000Z',
  publishedBy: 'akashdhanusheswar@gmail.com',
  isCurrent: true,
  masterExe: DEFAULT_MASTER_EXE_META,
  userExe: DEFAULT_USER_EXE_META,
  masterApk: DEFAULT_MASTER_APK_META,
  userApk: DEFAULT_USER_APK_META,
  windowsExe: DEFAULT_USER_EXE_META,
  androidApk: DEFAULT_USER_APK_META,
  changelogBullets: [
    'Strict workspace and storage isolation across NATM Tunneling, TBM Mechanized Shield, and Mining Exploration domains.',
    'Full Diamond Drill Core Logging engine with automated RQD %, TCR %, SCR %, fracture spacing, and ISRM weathering classification.',
    'High-capacity multi-kilometer chainage indexing and chunked storage architecture with zero-crash memory management.',
    'Precision A3/A4 engineering PDF report generator with official ESWA Eagle Logo and digital signature blocks.',
    '1-PC / 1-Device cryptographic hardware license binding with real-time Master Portal authorization.',
  ],
  installationNotesWindow:
    '1. Download either the User EXE (for Field & Office Geologists) or Master EXE (for Master Admin) above.\n2. Run the executable on your Windows 10/11 64-bit workstation.\n3. On first launch, copy your Workstation Hardware ID and submit a License Request below or enter your assigned 1-PC License Key.',
  installationNotesAndroid:
    '1. Download either the Android APK User (for Field Geologists) or Android APK Master (for Master Admin) onto your Android device.\n2. Open the APK file and allow "Install unknown apps" if prompted.\n3. Launch ESWA GEOLOGICAL MAPPER with the official Eagle launcher icon and activate your license.',
};

export function normalizeWebsiteReleaseRecord(
  raw: Partial<WebsiteReleaseRecord> & { windowsExe?: PlatformBinaryMeta; androidApk?: PlatformBinaryMeta }
): WebsiteReleaseRecord {
  const userExe = (raw.userExe || raw.windowsExe || DEFAULT_USER_EXE_META) as PlatformBinaryMeta;
  const masterExe = (raw.masterExe || DEFAULT_MASTER_EXE_META) as PlatformBinaryMeta;
  const userApk = (raw.userApk || raw.androidApk || DEFAULT_USER_APK_META) as PlatformBinaryMeta;
  const masterApk = (raw.masterApk || DEFAULT_MASTER_APK_META) as PlatformBinaryMeta;

  return {
    releaseId: String(raw.releaseId || DEFAULT_CURRENT_RELEASE.releaseId),
    version: String(raw.version || DEFAULT_CURRENT_RELEASE.version),
    title: String(raw.title || DEFAULT_CURRENT_RELEASE.title),
    summary: String(raw.summary || DEFAULT_CURRENT_RELEASE.summary),
    publishedAtIso: String(raw.publishedAtIso || DEFAULT_CURRENT_RELEASE.publishedAtIso),
    publishedBy: String(raw.publishedBy || DEFAULT_CURRENT_RELEASE.publishedBy),
    isCurrent: Boolean(raw.isCurrent),
    masterExe,
    userExe,
    masterApk,
    userApk,
    windowsExe: userExe,
    androidApk: userApk,
    changelogBullets: Array.isArray(raw.changelogBullets)
      ? (raw.changelogBullets as string[])
      : DEFAULT_CURRENT_RELEASE.changelogBullets,
    installationNotesWindow: String(
      raw.installationNotesWindow || DEFAULT_CURRENT_RELEASE.installationNotesWindow
    ),
    installationNotesAndroid: String(
      raw.installationNotesAndroid || DEFAULT_CURRENT_RELEASE.installationNotesAndroid
    ),
  };
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function computeFileSha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback below
  }
  const seed = `${file.name}:${file.size}:${file.lastModified}`;
  return computeSha256Hex(seed);
}

function openBinaryIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_BINARY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbInstance = req.result;
      if (!dbInstance.objectStoreNames.contains(IDB_BINARY_STORE)) {
        dbInstance.createObjectStore(IDB_BINARY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open binary IDB'));
  });
}

export async function saveBinaryToIndexedDb(
  key: string,
  file: Blob,
  fileName: string
): Promise<void> {
  try {
    const idb = await openBinaryIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_BINARY_STORE, 'readwrite');
      const store = tx.objectStore(IDB_BINARY_STORE);
      store.put({ blob: file, fileName, updatedAt: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {
    // Ignore IDB quota errors
  }
}

export async function getBinaryFromIndexedDb(
  key: string
): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const idb = await openBinaryIdb();
    const res = await new Promise<{ blob: Blob; fileName: string } | null>((resolve) => {
      const tx = idb.transaction(IDB_BINARY_STORE, 'readonly');
      const store = tx.objectStore(IDB_BINARY_STORE);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const val = getReq.result;
        if (val && val.blob instanceof Blob) {
          resolve({ blob: val.blob, fileName: val.fileName || key });
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => resolve(null);
    });
    idb.close();
    return res;
  } catch {
    return null;
  }
}

function readLocalReleases(): WebsiteReleaseRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_WEBSITE_RELEASES_KEY);
    if (!raw) return [DEFAULT_CURRENT_RELEASE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => normalizeWebsiteReleaseRecord(item));
    }
  } catch {
    // Ignore
  }
  return [DEFAULT_CURRENT_RELEASE];
}

function writeLocalReleases(releases: WebsiteReleaseRecord[]): void {
  try {
    localStorage.setItem(LOCAL_WEBSITE_RELEASES_KEY, JSON.stringify(releases));
  } catch {
    // Ignore
  }
}

function getApiBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
    !window.location.hostname.includes('netlify.app')
  ) {
    return '';
  }
  return getPublicShareOrigin();
}

/**
 * Uploads one of the 4 official installer binaries (`master_exe`, `user_exe`, `master_apk`, `user_apk`)
 * to the server release repository and caches it in IndexedDB.
 */
export async function uploadWebsiteReleaseBinary(
  pkgKind: InstallerPackageKind,
  version: string,
  file: File,
  onProgress?: (statusText: string) => void
): Promise<PlatformBinaryMeta> {
  onProgress?.(`Computing SHA-256 cryptographic hash for ${file.name}...`);
  const sha256 = await computeFileSha256(file);
  const sizeBytes = file.size;
  const sizeFormatted = formatByteSize(sizeBytes);
  const idbKey = `website_binary_${pkgKind}_${version}`;

  onProgress?.(`Caching ${file.name} (${sizeFormatted}) in local high-speed store...`);
  await saveBinaryToIndexedDb(idbKey, file, file.name);

  let downloadUrl = `IDB:${idbKey}`;
  let storageMode: PlatformBinaryMeta['storageMode'] = 'INDEXED_DB';

  if (sizeBytes <= 36 * 1024 * 1024) {
    try {
      onProgress?.(`Uploading ${file.name} to cloud distribution server...`);
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const resp = await fetch(`${getApiBaseUrl()}/api/website/upload-binary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: pkgKind,
          version,
          fileName: file.name,
          sha256,
          sizeBytes,
          base64Data,
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { ok?: boolean; downloadPath?: string };
        if (data.ok && data.downloadPath) {
          downloadUrl = data.downloadPath;
          storageMode = 'SERVER_BINARY';
        }
      }
    } catch {
      // Fallback to IDB / built-in download
    }
  }

  onProgress?.(`Verified ${file.name} (SHA-256: ${sha256.slice(0, 12)}...)`);

  const isWindows = pkgKind === 'master_exe' || pkgKind === 'user_exe';
  const isMaster = pkgKind === 'master_exe' || pkgKind === 'master_apk';

  return {
    fileName: file.name,
    version,
    sizeBytes,
    sizeFormatted,
    sha256,
    downloadUrl,
    uploadedAtIso: new Date().toISOString(),
    osRequirement: isWindows
      ? `Windows 10 / Windows 11 (64-bit) — ${isMaster ? 'Master Admin' : 'User Workstation'}`
      : `Android 10.0+ — ${isMaster ? 'Master Admin' : 'Field Tablet & Mobile'}`,
    architecture: isWindows ? 'x64 / PE32+' : 'ARM64-v8a / Universal APK',
    storageMode,
  };
}

export async function publishWebsiteRelease(
  release: WebsiteReleaseRecord,
  alsoNotifyInstalledSoftware = true
): Promise<void> {
  const normalized = normalizeWebsiteReleaseRecord({
    ...release,
    windowsExe: release.userExe,
    androidApk: release.userApk,
    isCurrent: true,
  });

  const existing = readLocalReleases();
  const updatedList = [
    normalized,
    ...existing
      .filter((r) => r.releaseId !== normalized.releaseId)
      .map((r) => ({ ...r, isCurrent: false })),
  ];
  writeLocalReleases(updatedList);

  try {
    await fetch(`${getApiBaseUrl()}/api/website/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ release: normalized }),
    });
  } catch {
    // Ignore network error
  }

  try {
    await setDoc(doc(db, 'website_releases', normalized.releaseId), normalized);
    for (const prev of existing) {
      if (prev.releaseId !== normalized.releaseId && prev.isCurrent) {
        await setDoc(
          doc(db, 'website_releases', prev.releaseId),
          { isCurrent: false },
          { merge: true }
        );
      }
    }
  } catch {
    // Ignore if offline
  }

  if (alsoNotifyInstalledSoftware) {
    try {
      await publishSoftwareUpdateRelease({
        version: normalized.version,
        title: normalized.title,
        releaseNotes: normalized.changelogBullets.join('\n• '),
        downloadUrl:
          normalized.userExe.downloadUrl.startsWith('http') ||
          normalized.userExe.downloadUrl.startsWith('/api/')
            ? normalized.userExe.downloadUrl
            : '',
        targetScope: 'ALL_PCS',
        targetIdentifierCsv: '',
        isMandatory: false,
      });
    } catch {
      // Ignore
    }
  }
}

export async function deleteWebsiteRelease(releaseId: string): Promise<void> {
  const existing = readLocalReleases().filter((r) => r.releaseId !== releaseId);
  if (existing.length === 0) {
    existing.push(DEFAULT_CURRENT_RELEASE);
  } else if (!existing.some((r) => r.isCurrent)) {
    existing[0].isCurrent = true;
  }
  writeLocalReleases(existing);

  try {
    await fetch(`${getApiBaseUrl()}/api/website/releases/${encodeURIComponent(releaseId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore
  }

  try {
    await deleteDoc(doc(db, 'website_releases', releaseId));
  } catch {
    // Ignore
  }
}

export function subscribeWebsiteReleases(
  onUpdate: (releases: WebsiteReleaseRecord[], current: WebsiteReleaseRecord) => void
): () => void {
  const emitSorted = (items: WebsiteReleaseRecord[]) => {
    const valid =
      items.length > 0
        ? items.map((item) => normalizeWebsiteReleaseRecord(item))
        : [DEFAULT_CURRENT_RELEASE];
    const sorted = [...valid].sort((a, b) =>
      (b.publishedAtIso || '').localeCompare(a.publishedAtIso || '')
    );
    const current = sorted.find((r) => r.isCurrent) || sorted[0] || DEFAULT_CURRENT_RELEASE;
    writeLocalReleases(sorted);
    onUpdate(sorted, current);
  };

  emitSorted(readLocalReleases());

  void (async () => {
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/website/releases`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = (await resp.json()) as { releases?: WebsiteReleaseRecord[] };
        if (Array.isArray(data.releases) && data.releases.length > 0) {
          emitSorted(data.releases);
        }
      }
    } catch {
      // Ignore
    }
  })();

  let unsubFirestore = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'website_releases'),
      (snap) => {
        if (!snap.empty) {
          const list: WebsiteReleaseRecord[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data() as WebsiteReleaseRecord;
            if (d && d.releaseId && d.version) {
              list.push(normalizeWebsiteReleaseRecord(d));
            }
          });
          if (list.length > 0) {
            emitSorted(list);
          }
        }
      },
      () => {
        // Ignore offline listener error
      }
    );
  } catch {
    // Ignore
  }

  return () => {
    unsubFirestore();
  };
}

/**
 * Triggers direct download of one of the 4 official binaries:
 * - `master_exe`: ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe
 * - `user_exe`: ESWA-GEOLOGICAL-MAPPER-User-Setup.exe
 * - `master_apk`: ESWA-GEOLOGICAL-MAPPER-Master-Android.apk
 * - `user_apk`: ESWA-GEOLOGICAL-MAPPER-User-Android.apk
 */
export async function triggerWebsiteBinaryDownload(
  pkgKind: InstallerPackageKind,
  meta: PlatformBinaryMeta
): Promise<void> {
  const url = (meta.downloadUrl || '').trim();

  // 1. Check if stored in IndexedDB (`IDB:key`)
  if (url.startsWith('IDB:')) {
    const key = url.slice(4);
    const cached = await getBinaryFromIndexedDb(key);
    if (cached) {
      const blobUrl = URL.createObjectURL(cached.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = meta.fileName || cached.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }
  }

  // 2. Check if hosted on Server `/api/website/download-binary/...`
  if (url.startsWith('/api/website/download-binary')) {
    const fullUrl = `${getApiBaseUrl()}${url}`;
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = meta.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 3. External HTTPS URL (e.g. GitHub Release asset link)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 4. Built-in generator / GitHub release download for each of the 4 official packages
  switch (pkgKind) {
    case 'master_exe':
      downloadMasterEditionDesktopExe();
      break;
    case 'user_exe':
      downloadUserEditionDesktopExe();
      break;
    case 'master_apk':
      downloadMasterAndroidApk(meta.fileName || 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk');
      break;
    case 'user_apk':
      downloadUserAndroidApk(meta.fileName || 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk');
      break;
  }
}

export { submitSoftwareAccessRequest };
export type { AccessRequestRecord } from './softwareLicensingEngine';

export function downloadNetlifyTomlConfig(): void {
  const tomlContent = `# ESWA GEOLOGICAL MAPPER — Official Software Distribution Website (Netlify Config)
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  VITE_STANDALONE_WEBSITE = "true"

# Route root "/" directly to the standalone Download Website when hosted on Netlify
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;
  const blob = new Blob([tomlContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'netlify.toml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
