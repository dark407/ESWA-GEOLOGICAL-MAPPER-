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

async function publishCloudAutoUpdateNotification(version, repoSlug) {
  const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(firebaseConfigPath)) return;

  try {
    const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const projectId = cfg.projectId;
    const databaseId = cfg.firestoreDatabaseId || '(default)';
    const apiKey = cfg.apiKey;
    if (!projectId || !apiKey) return;

    const releaseId = `rel_ci_${version.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const nowIso = new Date().toISOString();
    const downloadUrl = repoSlug
      ? `https://github.com/${repoSlug}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe`
      : 'GITHUB_USER_EXE';

    const firestoreDoc = {
      fields: {
        releaseId: { stringValue: releaseId },
        portalScope: { stringValue: 'ESWA_GLOBAL_PORTAL_V1' },
        version: { stringValue: version },
        title: { stringValue: `ESWA Geological Mapper v${version} Auto-Update` },
        releaseNotes: {
          stringValue:
            'Automatic CI/CD build pushed. Click "Update App & Software Automatically" to update in-place with zero data loss.',
        },
        downloadUrl: { stringValue: downloadUrl },
        targetScope: { stringValue: 'ALL_PCS' },
        targetIdentifierCsv: { stringValue: 'ALL' },
        isMandatory: { booleanValue: false },
        status: { stringValue: 'PUBLISHED' },
        publishedAtIso: { stringValue: nowIso },
        adminAuthSig: { stringValue: 'ESWA-CI-AUTO-OTA' },
      },
    };

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/software_releases/${encodeURIComponent(
      releaseId
    )}?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestoreDoc),
    });

    if (resp.ok) {
      console.log(
        `[GoogleDriveSync] ✓ Broadcasted live v${version} notification to all User Main Screens via Firestore!`
      );
    }
  } catch (err) {
    console.warn('[GoogleDriveSync] Non-fatal error broadcasting release to Firestore:', err);
  }
}

async function main() {
  const runNumber = process.env.GITHUB_RUN_NUMBER || '1';
  const version = process.env.ESWA_RELEASE_VERSION || `2.8.${runNumber}`;
  const repoSlug = process.env.GITHUB_REPOSITORY || '';

  // 1. Always broadcast the new version to User Main Screen Notification Toggles
  await publishCloudAutoUpdateNotification(version, repoSlug);

  // 2. If Google Drive credentials & permanent File IDs are configured, overwrite in-place
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
      fileId: process.env.GDRIVE_USER_APK_FILE_ID,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
        'release-apk/ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
      ]),
      mimeType: 'application/vnd.android.package-archive',
    },
    {
      fileId: process.env.GDRIVE_USER_EXE_FILE_ID,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
        'release-user/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
      ]),
      mimeType: 'application/vnd.microsoft.portable-executable',
    },
    {
      fileId: process.env.GDRIVE_MASTER_APK_FILE_ID,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
        'release-apk/ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
      ]),
      mimeType: 'application/vnd.android.package-archive',
    },
    {
      fileId: process.env.GDRIVE_MASTER_EXE_FILE_ID,
      localPath: resolveExistingPath([
        'release/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe',
        'release-master/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe',
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
