/**
 * FAST ASYNC STORAGE ENGINE
 * High-performance, non-blocking storage architecture for ESWA Geological Mapper.
 * 
 * 1. Offloads heavy Base64 photographs (face, crown, walls, core boxes) to IndexedDB.
 * 2. Strips multi-megabyte image payloads from synchronous localStorage JSON writes.
 * 3. Debounces background state saves (2000ms) and executes them on requestIdleCallback
 *    so the main UI thread NEVER blocks during typing, backspacing, or drawing.
 */

// IndexedDB Configuration
const DB_NAME = 'eswa_geotech_async_storage_v1';
const DB_VERSION = 1;
const PHOTO_STORE = 'photo_blobs';
const STATE_STORE = 'async_state';

let dbInstancePromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not available in this environment'));
  }
  if (!dbInstancePromise) {
    dbInstancePromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(PHOTO_STORE)) {
            db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STATE_STORE)) {
            db.createObjectStore(STATE_STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbInstancePromise;
}

/**
 * Save heavy base64 photo blob asynchronously into IndexedDB (zero main-thread blocking)
 */
export async function savePhotoBlobAsync(id: string, base64Data: string): Promise<void> {
  if (!id || !base64Data) return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.put({ id, data: base64Data, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to separate localStorage key if IndexedDB fails
    try {
      localStorage.setItem(`eswa_photo_blob_${id}`, base64Data);
    } catch {
      // Storage quota fallback
    }
  }
}

/**
 * Retrieve heavy photo blob asynchronously
 */
export async function getPhotoBlobAsync(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDb();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      return localStorage.getItem(`eswa_photo_blob_${id}`);
    } catch {
      return null;
    }
  }
}

/**
 * Delete photo blob asynchronously
 */
export async function deletePhotoBlobAsync(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    try {
      localStorage.removeItem(`eswa_photo_blob_${id}`);
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// IDLE-THREAD DEBOUNCED SAVER
// ============================================================================

type SaveTask = {
  key: string;
  getData: () => any;
  timer: ReturnType<typeof setTimeout> | null;
  idleHandle: number | null;
  useLocalStorage: boolean;
};

const pendingSaveTasks = new Map<string, SaveTask>();

/**
 * Cross-browser RequestIdleCallback helper with graceful timeout fallback
 */
function runWhenIdle(callback: () => void, timeoutMs = 1500): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, { timeout: timeoutMs });
  }
  return (setTimeout(callback, 50) as unknown) as number;
}

function cancelIdle(handle: number | null) {
  if (handle === null) return;
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Schedules a background state save with a 2000ms debounce.
 * When the debounce finishes, the serialization and disk write are dispatched
 * inside requestIdleCallback so the browser's main UI frame rate stays at 60/120fps.
 */
export function scheduleIdleSave(
  key: string,
  dataOrProducer: any | (() => any),
  debounceMs: number = 2000,
  useLocalStorage: boolean = true
): void {
  const getData = typeof dataOrProducer === 'function' ? dataOrProducer : () => dataOrProducer;

  const existing = pendingSaveTasks.get(key);
  if (existing) {
    if (existing.timer) clearTimeout(existing.timer);
    if (existing.idleHandle) cancelIdle(existing.idleHandle);
  }

  const task: SaveTask = {
    key,
    getData,
    timer: null,
    idleHandle: null,
    useLocalStorage,
  };

  task.timer = setTimeout(() => {
    task.idleHandle = runWhenIdle(() => {
      executeTaskSave(key);
    });
  }, debounceMs);

  pendingSaveTasks.set(key, task);
}

function executeTaskSave(key: string) {
  const task = pendingSaveTasks.get(key);
  if (!task) return;
  pendingSaveTasks.delete(key);

  try {
    const data = task.getData();
    if (data === undefined) return;

    const serialized = typeof data === 'string' ? data : JSON.stringify(data);

    // Save to localStorage if requested
    if (task.useLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, serialized);
      } catch (quotaErr) {
        // Fallback: save to IndexedDB state store if localStorage quota exceeded
        saveToIndexedDbStateStore(key, serialized);
      }
    } else {
      saveToIndexedDbStateStore(key, serialized);
    }
  } catch (err) {
    // Non-blocking log
  }
}

async function saveToIndexedDbStateStore(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STATE_STORE, 'readwrite');
    tx.objectStore(STATE_STORE).put({ key, value, updatedAt: Date.now() });
  } catch {
    // Ignore
  }
}

/**
 * Flush all pending idle saves immediately (e.g. before navigating or closing page)
 */
export function flushIdleSaves(targetKey?: string): void {
  if (targetKey) {
    executeTaskSave(targetKey);
  } else {
    const keys = Array.from(pendingSaveTasks.keys());
    for (const k of keys) {
      executeTaskSave(k);
    }
  }
}

// Auto-flush on page hide / beforeunload
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushIdleSaves());
  window.addEventListener('beforeunload', () => flushIdleSaves());
}

/**
 * Strips heavy Base64 photographs from an object before JSON serialization
 * Returns a lightweight clone and saves photos asynchronously into IndexedDB.
 */
export function separatePhotosFromPayload<T extends Record<string, any>>(
  payload: T,
  domainPrefix: string = 'face'
): { lightweight: T; photoKeys: string[] } {
  if (!payload || typeof payload !== 'object') {
    return { lightweight: payload, photoKeys: [] };
  }

  const lightweight = { ...payload } as any;
  const photoKeys: string[] = [];

  // Check if photos map exists
  if (lightweight.photos && typeof lightweight.photos === 'object') {
    const clonedPhotos: Record<string, any> = {};
    for (const [surface, surfObj] of Object.entries(lightweight.photos)) {
      if (surfObj && typeof surfObj === 'object') {
        const s = { ...(surfObj as any) };
        // If image has base64 data, store in IndexedDB and replace with reference
        if (typeof s.image === 'string' && s.image.length > 500) {
          const blobId = `${domainPrefix}_${surface}_img_${s.fileName || 'active'}`;
          savePhotoBlobAsync(blobId, s.image);
          photoKeys.push(blobId);
          s.imageBlobId = blobId;
          // Keep lightweight thumbnail/marker if needed or truncate
          s.image = s.image.slice(0, 300) + '...[IDB]';
        }
        if (typeof s.originalImage === 'string' && s.originalImage.length > 500) {
          const blobId = `${domainPrefix}_${surface}_orig_${s.fileName || 'active'}`;
          savePhotoBlobAsync(blobId, s.originalImage);
          photoKeys.push(blobId);
          s.originalImageBlobId = blobId;
          s.originalImage = null;
        }
        if (typeof s.warpedImage === 'string' && s.warpedImage.length > 500) {
          s.warpedImage = null; // Recomputable
        }
        clonedPhotos[surface] = s;
      } else {
        clonedPhotos[surface] = surfObj;
      }
    }
    lightweight.photos = clonedPhotos;
  }

  return { lightweight, photoKeys };
}
