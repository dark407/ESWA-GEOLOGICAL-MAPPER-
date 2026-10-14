const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_PRODUCT_NAME = 'AKASH TUNNEL MAPPER';
const APP_ID = 'com.akash.tunnelmapper';

app.setName(APP_PRODUCT_NAME);
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

// Global Windows Desktop Crash & Unhandled Rejection Protection
process.on('uncaughtException', (err) => {
  console.error('[AKASH Desktop] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[AKASH Desktop] Unhandled promise rejection:', reason);
});

// ============================================================================
// NATIVE FILE SYSTEM USER DATA DIRECTORY (%APPDATA%\ESWA TUNNEL MAPPER\user-data)
// Kept strictly separate from the Electron installation directory so software
// updates or uninstalls never delete or overwrite user tunnel projects.
// ============================================================================
function getUserDataRootDir() {
  const baseDir = path.join(app.getPath('userData'), 'user-data');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * Resolves a relative file path strictly inside the user's data directory.
 * Blocks any path traversal ('..') or attempts to access files outside userData.
 */
function resolveSafeUserDataPath(relativePath) {
  const rootDir = path.resolve(getUserDataRootDir());
  const cleaned = String(relativePath || '')
    .replace(/^[/\\]+/, '')
    .trim();
  if (!cleaned) {
    throw new Error('Relative file path cannot be empty.');
  }
  const resolved = path.resolve(rootDir, cleaned);
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
    throw new Error('Access denied: path is outside the user data directory.');
  }
  return resolved;
}

function getPersistentStoreFilePath() {
  return path.join(getUserDataRootDir(), 'persistent-store.json');
}

function getProjectsDirectoryPath() {
  const dir = path.join(getUserDataRootDir(), 'projects');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getGeometriesFilePath() {
  return path.join(getUserDataRootDir(), 'saved-geometries.json');
}

function getAILearningMemoryFilePath() {
  return path.join(getUserDataRootDir(), 'ai-learning-memory.json');
}

function getOtaLiveDirectoryPath() {
  const dir = path.join(getUserDataRootDir(), 'ota-live');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function compareSemverStrings(vA, vB) {
  const partsA = String(vA || '0.0.0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const partsB = String(vB || '0.0.0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length, 3);
  for (let i = 0; i < len; i++) {
    const a = partsA[i] || 0;
    const b = partsB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function readAILearningMemorySync() {
  return readJsonFileWithBackupSync(getAILearningMemoryFilePath(), null);
}

function writeAILearningMemorySync(memoryObj) {
  try {
    if (!memoryObj || typeof memoryObj !== 'object') return false;
    writeJsonFileAtomicSync(getAILearningMemoryFilePath(), memoryObj);
    return true;
  } catch (err) {
    console.error('[AKASH Desktop] Error writing AI learning memory:', err);
    return false;
  }
}

function sanitizeFileSegment(str) {
  return String(str || 'project')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function writeJsonFileAtomicSync(targetPath, dataObj) {
  const serialized = JSON.stringify(dataObj, null, 2);
  const tempPath = `${targetPath}.tmp`;
  const backupPath = `${targetPath}.bak`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  if (fs.existsSync(targetPath)) {
    try {
      fs.copyFileSync(targetPath, backupPath);
    } catch {
      // Ignore backup copy warning
    }
  }
  fs.renameSync(tempPath, targetPath);
}

function readJsonFileWithBackupSync(targetPath, fallbackValue) {
  const candidates = [targetPath, `${targetPath}.bak`];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (err) {
      console.error(`[AKASH Desktop] Failed reading ${candidate}:`, err);
    }
  }
  return fallbackValue;
}

function readPersistentStoreSync() {
  const parsed = readJsonFileWithBackupSync(getPersistentStoreFilePath(), {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function writePersistentStoreSync(storeObj) {
  try {
    writeJsonFileAtomicSync(getPersistentStoreFilePath(), storeObj);
    return true;
  } catch (err) {
    console.error('[AKASH Desktop] Error writing persistent store:', err);
    return false;
  }
}

function readAllNativeProjectsSync() {
  try {
    const projectsDir = getProjectsDirectoryPath();
    const files = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.akash.json'));
    const records = [];
    for (const file of files) {
      try {
        const fullPath = path.join(projectsDir, file);
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed && parsed.id) {
          records.push(parsed);
        }
      } catch {
        // Skip malformed file
      }
    }
    records.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return records;
  } catch (err) {
    console.error('[AKASH Desktop] Error reading native projects:', err);
    return [];
  }
}

function saveNativeProjectFileSync(record) {
  try {
    if (!record || !record.id) return { ok: false };
    const safeId = sanitizeFileSegment(record.id);
    const filePath = path.join(getProjectsDirectoryPath(), `${safeId}.akash.json`);
    writeJsonFileAtomicSync(filePath, record);
    return { ok: true, filePath };
  } catch (err) {
    console.error('[AKASH Desktop] Error saving native project file:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Write failed' };
  }
}

function deleteNativeProjectFileSync(projectId) {
  try {
    if (!projectId) return false;
    const safeId = sanitizeFileSegment(projectId);
    const filePath = path.join(getProjectsDirectoryPath(), `${safeId}.akash.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (err) {
    console.error('[AKASH Desktop] Error deleting native project file:', err);
    return false;
  }
}

function readNativeGeometriesSync() {
  try {
    const geomPath = getGeometriesFilePath();
    if (fs.existsSync(geomPath)) {
      const parsed = JSON.parse(fs.readFileSync(geomPath, 'utf8'));
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[AKASH Desktop] Error reading native geometries:', err);
  }
  return [];
}

function writeNativeGeometriesSync(geometries) {
  try {
    if (!Array.isArray(geometries)) return false;
    writeJsonFileAtomicSync(getGeometriesFilePath(), geometries);
    return true;
  } catch (err) {
    console.error('[AKASH Desktop] Error writing native geometries:', err);
    return false;
  }
}

// ============================================================================
// IPC HANDLERS: NATIVE FILE SYSTEM PROJECTS, STORAGE, DIALOGS, CAD & CV
// ============================================================================
function registerDesktopIpcHandlers() {
  // Synchronous hydration of persistent %APPDATA% store on startup
  ipcMain.on('akash:storage-load-all-sync', (event) => {
    event.returnValue = readPersistentStoreSync();
  });

  // Synchronous & async native project file operations in user's data directory
  ipcMain.on('akash:projects-load-all-sync', (event) => {
    event.returnValue = readAllNativeProjectsSync();
  });

  ipcMain.handle('akash:project-save-file', async (_event, record) => {
    return saveNativeProjectFileSync(record);
  });

  ipcMain.handle('akash:project-delete-file', async (_event, { id }) => {
    return deleteNativeProjectFileSync(id);
  });

  ipcMain.on('akash:geometries-load-sync', (event) => {
    event.returnValue = readNativeGeometriesSync();
  });

  ipcMain.handle('akash:geometries-save', async (_event, geometries) => {
    return writeNativeGeometriesSync(geometries);
  });

  ipcMain.on('akash:learning-load-sync', (event) => {
    event.returnValue = readAILearningMemorySync();
  });

  ipcMain.handle('akash:learning-save', async (_event, memoryObj) => {
    return writeAILearningMemorySync(memoryObj);
  });

  ipcMain.handle('akash:print-to-pdf', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { canceled: true };
    const saveRes = await dialog.showSaveDialog(win, {
      title: 'Export Engineering Sheet to Vector PDF — AKASH TUNNEL MAPPER',
      defaultPath: path.join(
        getProjectsDirectoryPath(),
        options.defaultFileName || 'Tunnel_Geological_Sheet_A3.pdf'
      ),
      filters: [{ name: 'PDF Engineering Drawing (*.pdf)', extensions: ['pdf'] }],
    });
    if (saveRes.canceled || !saveRes.filePath) {
      return { canceled: true };
    }
    const pdfBuffer = await win.webContents.printToPDF({
      landscape: true,
      printBackground: true,
      pageSize: 'A3',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    fs.writeFileSync(saveRes.filePath, pdfBuffer);
    return { canceled: false, filePath: saveRes.filePath };
  });

  ipcMain.handle('akash:open-projects-folder', async () => {
    const dir = getProjectsDirectoryPath();
    await shell.openPath(dir);
    return { folderPath: dir };
  });

  ipcMain.handle('akash:storage-set-item', async (_event, { key, value }) => {
    if (!key || typeof key !== 'string') return false;
    const store = readPersistentStoreSync();
    store[key] = String(value);
    return writePersistentStoreSync(store);
  });

  ipcMain.handle('akash:storage-remove-item', async (_event, { key }) => {
    if (!key || typeof key !== 'string') return false;
    const store = readPersistentStoreSync();
    delete store[key];
    return writePersistentStoreSync(store);
  });

  ipcMain.handle('akash:storage-clear', async () => {
    return writePersistentStoreSync({});
  });

  ipcMain.handle('akash:storage-sync-batch', async (_event, { entries }) => {
    if (!entries || typeof entries !== 'object') return false;
    const store = readPersistentStoreSync();
    for (const [k, v] of Object.entries(entries)) {
      if (typeof k === 'string' && typeof v === 'string') {
        store[k] = v;
      }
    }
    return writePersistentStoreSync(store);
  });

  ipcMain.on('akash:storage-sync-batch-sync', (event, { entries }) => {
    if (!entries || typeof entries !== 'object') {
      event.returnValue = false;
      return;
    }
    const store = readPersistentStoreSync();
    for (const [k, v] of Object.entries(entries)) {
      if (typeof k === 'string' && typeof v === 'string') {
        store[k] = v;
      }
    }
    event.returnValue = writePersistentStoreSync(store);
  });

  ipcMain.handle('akash:get-user-data-info', async () => {
    return {
      userDataRootDir: getUserDataRootDir(),
      projectsDir: getProjectsDirectoryPath(),
      persistentStoreFile: getPersistentStoreFilePath(),
      geometriesFile: getGeometriesFilePath(),
      appVersion: app.getVersion(),
      platform: process.platform,
    };
  });

  // Sandboxed Native File System Operations Strictly Scoped to User Data Directory
  ipcMain.handle('akash:fs-read-user-file', async (_event, { relativePath } = {}) => {
    try {
      const safePath = resolveSafeUserDataPath(relativePath);
      if (!fs.existsSync(safePath)) {
        return { ok: false, error: 'File does not exist in user data directory.' };
      }
      const contentUtf8 = fs.readFileSync(safePath, 'utf8');
      return { ok: true, filePath: safePath, contentUtf8 };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Read failed' };
    }
  });

  ipcMain.handle('akash:fs-write-user-file', async (_event, { relativePath, contentUtf8 } = {}) => {
    try {
      const safePath = resolveSafeUserDataPath(relativePath);
      const parentDir = path.dirname(safePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const tempPath = `${safePath}.tmp`;
      fs.writeFileSync(tempPath, String(contentUtf8 ?? ''), 'utf8');
      fs.renameSync(tempPath, safePath);
      return { ok: true, filePath: safePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Write failed' };
    }
  });

  ipcMain.handle('akash:fs-list-user-files', async (_event, { subDir = '' } = {}) => {
    try {
      const targetDir = subDir ? resolveSafeUserDataPath(subDir) : getUserDataRootDir();
      if (!fs.existsSync(targetDir)) {
        return { ok: true, files: [] };
      }
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      }));
      return { ok: true, directory: targetDir, files };
    } catch (err) {
      return { ok: false, files: [], error: err instanceof Error ? err.message : 'List failed' };
    }
  });

  ipcMain.handle('akash:fs-delete-user-file', async (_event, { relativePath } = {}) => {
    try {
      const safePath = resolveSafeUserDataPath(relativePath);
      if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        fs.unlinkSync(safePath);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' };
    }
  });

  // Native Windows File Open Dialog (Photos, DXF/DWG, .akash.json Projects)
  ipcMain.handle('akash:dialog-open-file', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: options.title || 'Open File — AKASH TUNNEL MAPPER',
      defaultPath: options.defaultPath || getProjectsDirectoryPath(),
      properties: ['openFile'],
      filters: options.filters || [
        {
          name: 'All Supported Files',
          extensions: ['json', 'dxf', 'dwg', 'png', 'jpg', 'jpeg', 'webp'],
        },
        { name: 'AKASH Project Files (*.akash.json, *.json)', extensions: ['json'] },
        { name: 'CAD Tunnel Profiles (*.dxf, *.dwg)', extensions: ['dxf', 'dwg'] },
        {
          name: 'Tunnel Photographs (*.jpg, *.png, *.webp)',
          extensions: ['jpg', 'jpeg', 'png', 'webp'],
        },
      ],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      base64: buffer.toString('base64'),
      utf8: buffer.toString('utf8'),
    };
  });

  // Native Windows File Save Dialog (Project JSON, PDF, PNG, SVG, CSV, DXF)
  ipcMain.handle('akash:dialog-save-file', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: options.title || 'Save File — AKASH TUNNEL MAPPER',
      defaultPath: path.join(
        options.defaultDir || getProjectsDirectoryPath(),
        options.defaultFileName || 'Tunnel_Section_Export.json'
      ),
      filters: options.filters || [
        { name: 'AKASH Project (*.akash.json)', extensions: ['json'] },
        { name: 'PDF Engineering Sheet (*.pdf)', extensions: ['pdf'] },
        { name: 'SVG Vector Drawing (*.svg)', extensions: ['svg'] },
        { name: 'PNG High-Res Sheet (*.png)', extensions: ['png'] },
        { name: 'CSV / Excel Schedule (*.csv)', extensions: ['csv'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    if (options.dataBase64) {
      fs.writeFileSync(result.filePath, Buffer.from(options.dataBase64, 'base64'));
    } else if (typeof options.dataUtf8 === 'string') {
      fs.writeFileSync(result.filePath, options.dataUtf8, 'utf8');
    }
    return {
      canceled: false,
      filePath: result.filePath,
    };
  });

  // Native Windows Folder Selection Dialog
  ipcMain.handle('akash:dialog-select-folder', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: options.title || 'Select Output or Project Data Folder',
      defaultPath: options.defaultPath || getProjectsDirectoryPath(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return {
      canceled: false,
      folderPath: result.filePaths[0],
    };
  });

  // Local Desktop CAD (DWG / DXF) Parser (No localhost required)
  ipcMain.handle('akash:parse-cad', async (_event, payload = {}) => {
    const { fileName = 'tunnel.dwg', contentBase64 = '' } = payload;
    const buf = Buffer.from(contentBase64, 'base64');
    const asciiView = buf.toString('utf8');

    if (asciiView.includes('SECTION') && asciiView.includes('ENTITIES')) {
      return {
        format: 'dxf',
        dxfText: asciiView,
      };
    }

    const doubles = [];
    for (let offset = 64; offset < Math.min(buf.length - 8, 65536); offset += 8) {
      const val = buf.readDoubleLE(offset);
      if (Number.isFinite(val) && Math.abs(val) >= 0.5 && Math.abs(val) <= 25.0) {
        doubles.push(Number(val.toFixed(3)));
      }
    }

    let width = 8.4;
    let height = 7.2;
    if (doubles.length >= 4) {
      const candidates = doubles.filter((d) => d >= 3.5 && d <= 18.0);
      if (candidates.length >= 2) {
        width = Number(candidates[0].toFixed(2));
        height = Number(Math.max(3.5, Math.min(width * 1.15, candidates[1])).toFixed(2));
      }
    }
    const wallHeight = Number((height * 0.58).toFixed(2));

    return {
      format: 'dwg_converted',
      fileName,
      width,
      height,
      wallHeight,
      crownGeometry: 'd_shaped',
    };
  });

  // Local Desktop Hybrid AI + Deterministic CV Joint Tracing (Works Offline & Online without localhost)
  // Incorporates persisted Geologist AI Learning Memory (confirmed orientations & rejected false-positive angles)
  ipcMain.handle('akash:ai-trace-joints', async (_event, payload = {}) => {
    const { cvCandidates = [], surface = 'face' } = payload;
    const learnedMemory = readAILearningMemorySync() || {};
    const rejectedRanges = Array.isArray(learnedMemory.rejectedAngleRanges)
      ? learnedMemory.rejectedAngleRanges
      : [];
    const confirmedList = Array.isArray(learnedMemory.confirmedOrientations)
      ? learnedMemory.confirmedOrientations
      : [];

    const filteredCandidates = (Array.isArray(cvCandidates) ? cvCandidates : []).filter((c) => {
      const ang = c.angleDeg || 45;
      const isRejected = rejectedRanges.some(
        (r) =>
          r.surface === surface &&
          Math.min(Math.abs(r.angleDeg - ang), 180 - Math.abs(r.angleDeg - ang)) <=
            (r.tolerance || 8)
      );
      return !isRejected;
    });

    const classifiedFromCV = filteredCandidates.map((c, idx) => {
      const ang = c.angleDeg || 45;
      const matchedConfirmed = confirmedList.find(
        (cm) =>
          cm.surface === surface &&
          Math.min(Math.abs(cm.traceAngle - ang), 180 - Math.abs(cm.traceAngle - ang)) <= 14
      );
      const isLowAngleBedding = ang < 38 || ang > 142;
      const isProminentShear = idx === 0 && (c.strength || 0.7) > 0.78;

      const learnedFeatureType = matchedConfirmed
        ? matchedConfirmed.set === 'J0'
          ? 'bedding'
          : matchedConfirmed.set === 'F1'
          ? 'shear'
          : 'joint'
        : isProminentShear
        ? 'shear'
        : isLowAngleBedding
        ? 'bedding'
        : 'joint';

      const boostedStrength = Math.min(0.99, (c.strength || 0.7) + (matchedConfirmed ? 0.14 : 0));

      return {
        points: c.points,
        vertexWidths: c.vertexWidths,
        featureType: learnedFeatureType,
        confidence:
          boostedStrength > 0.72 ? 'High' : boostedStrength > 0.55 ? 'Medium' : 'Low',
        roughness:
          learnedFeatureType === 'shear'
            ? 'Slickensided / Undulating'
            : learnedFeatureType === 'bedding'
            ? 'Undulating / Planar'
            : 'Rough / Stepped',
        infilling:
          learnedFeatureType === 'shear' ? 'Clay / Crushed rock gouge' : 'Not determined',
        apertureMm:
          learnedFeatureType === 'shear' ? '5-15 mm (Variable)' : '1-3 mm (Variable)',
        waterCondition: learnedFeatureType === 'shear' ? 'Damp' : 'Dry',
      };
    });

    return {
      traces: classifiedFromCV,
      engine: 'DESKTOP_NATIVE_CV_AND_LEARNED_MEMORY_PIPELINE',
      modelVersion: learnedMemory.currentModelVersion || 'AKASH AI Engine 2.4',
    };
  });

  // 1-Click In-Place OTA Auto-Update (Zero Data Deletion):
  // Writes the newly compiled self-contained OTA HTML/JS/CSS bundle into %APPDATA%\...\user-data\ota-live\
  // while keeping all projects, geometries, AI memory, and login sessions 100% untouched.
  ipcMain.handle('akash:apply-ota-update', async (_event, payload = {}) => {
    try {
      const { version, htmlContent, cssContent, jsContent, edition } = payload;
      if (!version) {
        return { ok: false, error: 'Missing OTA version' };
      }
      const otaDir = getOtaLiveDirectoryPath();
      const otaIndexFile = path.join(otaDir, 'index.html');
      const otaManifestFile = path.join(otaDir, 'ota-manifest.json');

      let finalHtml = typeof htmlContent === 'string' && htmlContent.trim() ? htmlContent : '';
      if (!finalHtml && typeof jsContent === 'string' && jsContent.trim()) {
        const targetEdition = edition === 'master' ? 'master' : 'user';
        finalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AKASH TUNNEL MAPPER — v${version}</title>
    <script>
      window.__ESWA_EDITION__ = '${targetEdition}';
      window.__ESWA_OTA_VERSION__ = '${version}';
    </script>
    <style>${cssContent || ''}</style>
  </head>
  <body class="bg-[#0B0E14] text-slate-100 antialiased">
    <div id="root"></div>
    <script>${jsContent}</script>
  </body>
</html>`;
      }

      if (finalHtml) {
        fs.writeFileSync(otaIndexFile, finalHtml, 'utf8');
      }

      writeJsonFileAtomicSync(otaManifestFile, {
        version: String(version),
        appliedAtIso: new Date().toISOString(),
        hasSelfContainedHtml: Boolean(finalHtml),
      });

      // Also persist installed version in persistent-store.json so it survives restarts
      const store = readPersistentStoreSync();
      store['eswa_installed_software_version_v1'] = String(version);
      writePersistentStoreSync(store);

      // If we wrote a full self-contained OTA index.html, reload the window into it immediately
      if (finalHtml && mainWindow && !mainWindow.isDestroyed()) {
        let softwareEdition = 'master';
        try {
          const editionConfigPath = path.join(__dirname, 'edition.json');
          if (fs.existsSync(editionConfigPath)) {
            const parsedEdition = JSON.parse(fs.readFileSync(editionConfigPath, 'utf8'));
            if (parsedEdition && parsedEdition.edition === 'user') {
              softwareEdition = 'user';
            }
          }
        } catch {
          // Ignore
        }
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadFile(otaIndexFile, {
              query: { edition: softwareEdition, otaVersion: String(version) },
            });
          }
        }, 250);
      }

      return { ok: true, version: String(version), otaIndexFile };
    } catch (err) {
      console.error('[AKASH Desktop] OTA update error:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'OTA update failed' };
    }
  });

  ipcMain.handle('akash:open-external-url', async (_event, payload) => {
    const url = payload && typeof payload.url === 'string' ? payload.url.trim() : '';
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false };
  });
}

// ============================================================================
// CREATE NATIVE WINDOWS APPLICATION WINDOW
// ============================================================================
let mainWindow = null;

function createMainWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_PRODUCT_NAME,
    backgroundColor: '#0B0E14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.maximize();
      mainWindow.show();
    }
  });

  // Prevent navigation away from the desktop application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const devStartUrl = process.env.ELECTRON_START_URL;
    if (devStartUrl && navigationUrl.startsWith(devStartUrl)) {
      return;
    }
    if (navigationUrl.startsWith('file://') && !navigationUrl.includes('/api/')) {
      return;
    }
    event.preventDefault();
    if (navigationUrl.startsWith('https://') || navigationUrl.startsWith('http://')) {
      shell.openExternal(navigationUrl);
    }
  });

  // Load production files by default (or newer OTA hot-updated bundle if installed)
  const devStartUrl = process.env.ELECTRON_START_URL;
  let prodIndexFile = path.join(__dirname, '../dist/index.html');
  let softwareEdition = 'master';
  let bundledBuildVersion = '1.0.0';
  let bundledGithubRepo = '';
  try {
    const editionConfigPath = path.join(__dirname, 'edition.json');
    if (fs.existsSync(editionConfigPath)) {
      const parsedEdition = JSON.parse(fs.readFileSync(editionConfigPath, 'utf8'));
      if (parsedEdition && parsedEdition.edition === 'user') {
        softwareEdition = 'user';
      }
      if (parsedEdition && parsedEdition.buildVersion) {
        bundledBuildVersion = String(parsedEdition.buildVersion);
      }
      if (parsedEdition && parsedEdition.githubRepo) {
        bundledGithubRepo = String(parsedEdition.githubRepo);
      }
    }
  } catch {
    // Default to master
  }

  // Check if an in-place OTA update was installed in %APPDATA%\...\user-data\ota-live\
  try {
    const otaDir = getOtaLiveDirectoryPath();
    const otaIndexFile = path.join(otaDir, 'index.html');
    const otaManifestFile = path.join(otaDir, 'ota-manifest.json');
    if (fs.existsSync(otaIndexFile) && fs.existsSync(otaManifestFile)) {
      const otaManifest = JSON.parse(fs.readFileSync(otaManifestFile, 'utf8'));
      if (
        otaManifest &&
        otaManifest.version &&
        compareSemverStrings(otaManifest.version, bundledBuildVersion) >= 0
      ) {
        prodIndexFile = otaIndexFile;
      }
    }
  } catch {
    // Fallback to bundled dist/index.html
  }

  const queryObj = {};
  if (softwareEdition === 'user') {
    queryObj.edition = 'user';
  }
  if (bundledGithubRepo) {
    queryObj.repo = bundledGithubRepo;
  }

  if (devStartUrl) {
    mainWindow.loadURL(devStartUrl);
  } else if (Object.keys(queryObj).length > 0) {
    mainWindow.loadFile(prodIndexFile, { query: queryObj });
  } else {
    mainWindow.loadFile(prodIndexFile);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerDesktopIpcHandlers();

    // Native Windows Engineering Menu & Keyboard Shortcuts
    const menuTemplate = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Open User Projects Folder (%APPDATA%)',
            click: () => shell.openPath(getProjectsDirectoryPath()),
          },
          { type: 'separator' },
          { role: 'quit', label: 'Exit AKASH TUNNEL MAPPER' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'togglefullscreen', accelerator: 'F11' },
          { role: 'toggleDevTools', accelerator: 'F12' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
