#!/usr/bin/env node
/**
 * ESWA Geological Mapper — Permanent Google Drive File-ID Overwrite & Cloud Release Publisher
 *
 * 1. Overwrites existing User/Master .APK and .EXE files on Google Drive IN-PLACE using their
 *    permanent File IDs (`PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media`).
 *    Because the File IDs never change, your shared Google Drive links on LinkedIn and your website
 *    remain 100% identical forever.
 * 2. Broadcasts the newly built version to Firestore (`software_releases`) so all existing users
 *    immediately see the update notification badge on their Main Screen and can 1-click auto-update.
 */

import fs from 'node:fs';
import path from 'node:path';

function extractFileId(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (matchD?.[1]) return matchD[1];
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (matchId?.[1]) return matchId[1];
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
}

async function resolveGoogleAccessToken() {
  if (process.env.GDRIVE_ACCESS_TOKEN) {
    return process.env.GDRIVE_ACCESS_TOKEN.trim();
  }
  const clientId = (process.env.GDRIVE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GDRIVE_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GDRIVE_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) {
    return '';
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.warn(`[GoogleDriveSync] OAuth token refresh returned HTTP ${resp.status}: ${errText}`);
    return '';
  }
  const data = await resp.json();
  return data.access_token || '';
}

async function overwriteDriveFileInPlace(fileId, localFilePath, mimeType, accessToken) {
  const cleanId = extractFileId(fileId);
  if (!cleanId) return false;
  if (!fs.existsSync(localFilePath)) {
    console.warn(`[GoogleDriveSync] Skipping ${localFilePath} (file not found on disk).`);
    return false;
  }

  const fileBuffer = fs.readFileSync(localFilePath);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
    cleanId
  )}?uploadType=media&supportsAllDrives=true`;

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
      'Content-Length': String(fileBuffer.byteLength),
    },
    body: fileBuffer,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.warn(
      `[GoogleDriveSync] Failed to overwrite File ID ${cleanId} (${path.basename(localFilePath)}): HTTP ${resp.status} ${errText}`
    );
    return false;
  }

  console.log(
    `[GoogleDriveSync] ✓ Overwrote permanent Google Drive File ID ${cleanId} with ${path.basename(
      localFilePath
    )} (${(fileBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB) — Share URL unchanged!`
  );
  return true;
}

async function fetchSavedDriveFileIdsFromFirestore() {
  const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(firebaseConfigPath)) return {};
  try {
    const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const projectId = cfg.projectId;
    const databaseId = cfg.firestoreDatabaseId || '(default)';
    const apiKey = cfg.apiKey;
    if (!projectId || !apiKey) return {};
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/software_releases/GDRIVE_PERMANENT_FILE_IDS_CONFIG?key=${apiKey}`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return {};
    const docJson = await resp.json();
    const rawNotes = docJson?.fields?.releaseNotes?.stringValue || '';
    if (!rawNotes) return {};
    return JSON.parse(rawNotes);
  } catch {
    return {};
  }
}

async function archiveAnyAutomatedCiReleasesInFirestore() {
  const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(firebaseConfigPath)) return;

  try {
    const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const projectId = cfg.projectId;
    const databaseId = cfg.firestoreDatabaseId || '(default)';
    const apiKey = cfg.apiKey;
    if (!projectId || !apiKey) return;

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const qRes = await fetch(`${baseUrl}:runQuery?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId: 'software_releases' }] },
      }),
    });
    if (qRes.ok) {
      const rows = await qRes.json();
      for (const r of rows || []) {
        if (!r.document) continue;
        const docId = r.document.name.split('/').pop();
        const st = r.document.fields?.status?.stringValue;
        const sig = r.document.fields?.adminAuthSig?.stringValue;
        // Archive any automated CI release so ONLY Master Application broadcasts are active for live users
        if (
          docId &&
          st === 'PUBLISHED' &&
          (docId.startsWith('rel_ci_') || sig === 'ESWA-CI-AUTO-OTA')
        ) {
          await fetch(
            `${baseUrl}/software_releases/${encodeURIComponent(
              docId
            )}?updateMask.fieldPaths=status&key=${apiKey}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: { status: { stringValue: 'ARCHIVED' } },
              }),
            }
          ).catch(() => {});
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

async function main() {
  const cloudSavedIds = await fetchSavedDriveFileIdsFromFirestore();
  const userApkFileId = process.env.GDRIVE_USER_APK_FILE_ID || cloudSavedIds.userApkFileId || '';
  const userExeFileId = process.env.GDRIVE_USER_EXE_FILE_ID || cloudSavedIds.userExeFileId || '';

  // 1. Ensure automated CI builds never push popups to existing live users (Live users are controlled strictly via Master Application)
  await archiveAnyAutomatedCiReleasesInFirestore();

  // 2. If Google Drive credentials & permanent User File IDs are configured, overwrite in-place
  const accessToken = await resolveGoogleAccessToken();
  if (!accessToken) {
    console.log(
      '[GoogleDriveSync] No GDRIVE_ACCESS_TOKEN or GDRIVE_REFRESH_TOKEN secret configured; skipped Google Drive file overwrite.'
    );
    return;
  }

  const resolveExistingPath = (candidates) => {
    for (const rel of candidates) {
      const full = path.resolve(process.cwd(), rel);
      if (fs.existsSync(full)) return full;
    }
    return path.resolve(process.cwd(), candidates[0]);
  };

  const targets = [
    {
      fileId: userApkFileId,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
        'release/AKASH-TUNNEL-MAPPER-User-App.apk',
        'release-apk/ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
      ]),
      mimeType: 'application/vnd.android.package-archive',
    },
    {
      fileId: userExeFileId,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
        'release/AKASH-TUNNEL-MAPPER-User-Setup.exe',
        'release-user/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
      ]),
      mimeType: 'application/vnd.microsoft.portable-executable',
    },
  ];

  for (const t of targets) {
    if (t.fileId) {
      await overwriteDriveFileInPlace(t.fileId, t.localPath, t.mimeType, accessToken);
    }
  }
}

main().catch((err) => {
  console.warn('[GoogleDriveSync] Script finished with warning:', err);
});
