import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const editionFile = path.join(rootDir, 'electron', 'edition.json');
const releaseDir = path.join(rootDir, 'release');

const githubRepo = process.env.GITHUB_REPOSITORY || process.env.VITE_GITHUB_REPO || '';
const buildVersion =
  process.env.VITE_APP_BUILD_VERSION ||
  (process.env.GITHUB_RUN_NUMBER ? `1.0.${process.env.GITHUB_RUN_NUMBER}` : '1.0.0');

function run(cmd, extraEnv = {}) {
  console.log(`\n[Dual Builder] Running: ${cmd}`);
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'false',
      VITE_GITHUB_REPO: githubRepo,
      VITE_APP_BUILD_VERSION: buildVersion,
      ...extraEnv,
    },
  });
}

function writeEditionConfig(edition) {
  fs.writeFileSync(
    editionFile,
    JSON.stringify(
      {
        edition,
        githubRepo,
        buildVersion,
        builtAtIso: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
}

try {
  console.log('====================================================================');
  console.log('  BUILDING DUAL WINDOWS EXECUTABLES: (1) MASTER .EXE & (2) USER .EXE');
  console.log('====================================================================');

  // 1. Ensure Windows .ico is generated
  run('node scripts/generate-win-icon.mjs');

  // 2. Build Executable #1: MASTER SOFTWARE (Only for Master Owner — No Login Required)
  console.log('\n[1/2] Building MASTER SOFTWARE Executable (ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe)...');
  writeEditionConfig('master');
  run('npx vite build', { VITE_SOFTWARE_EDITION: 'master' });
  run('npx electron-builder --config electron-builder-master.json --win nsis --publish never');

  // 3. Build Executable #2: USER SOFTWARE (For Normal Users — 1-PC 1-Time Login & Updates)
  console.log('\n[2/3] Building USER SOFTWARE Executable (ESWA-GEOLOGICAL-MAPPER-User-Setup.exe)...');
  writeEditionConfig('user');
  run('npx vite build', { VITE_SOFTWARE_EDITION: 'user' });
  run('npx electron-builder --config electron-builder-user.json --win nsis --publish never');

  // 3b. Build Standalone Master & User Android APKs (ESWA-GEOLOGICAL-MAPPER-Master-Android.apk & ESWA-GEOLOGICAL-MAPPER-User-Android.apk)
  console.log('\n[3/3] Building Standalone MASTER & USER Android APKs (.APK)...');
  try {
    run('node scripts/build-android-apk.mjs', { GITHUB_ACTIONS: 'true' });
  } catch (apkErr) {
    console.warn('[Dual Builder] Warning building Android APKs:', apkErr);
  }

  // 4. Ensure release/ directory exists
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // Ensure compiled APKs are copied into release/
  for (const apkName of [
    'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
    'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
    'ESWA-GEOLOGICAL-MAPPER-release.apk',
  ]) {
    const targetApk = path.join(releaseDir, apkName);
    const tmpApk = path.join('/tmp', 'akash-release-cache', apkName);
    if (!fs.existsSync(targetApk) && fs.existsSync(tmpApk)) {
      try {
        fs.copyFileSync(tmpApk, targetApk);
      } catch {
        // Ignore copy error
      }
    }
  }

  const userExeUrl = githubRepo
    ? `https://github.com/${githubRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe`
    : 'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe';
  const masterExeUrl = githubRepo
    ? `https://github.com/${githubRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe`
    : 'ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe';
  const userAndroidApkUrl = githubRepo
    ? `https://github.com/${githubRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-User-Android.apk`
    : 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk';
  const masterAndroidApkUrl = githubRepo
    ? `https://github.com/${githubRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-Master-Android.apk`
    : 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk';
  const userOtaBundleUrl = githubRepo
    ? `https://github.com/${githubRepo}/releases/download/latest/user-ota-bundle.json`
    : 'user-ota-bundle.json';

  // Generate self-contained user-ota-bundle.json from the compiled User dist/ assets
  try {
    const distDir = path.join(rootDir, 'dist');
    const assetsSubDir = path.join(distDir, 'assets');
    let cssContent = '';
    let jsFilePath = '';
    if (fs.existsSync(assetsSubDir)) {
      for (const fn of fs.readdirSync(assetsSubDir)) {
        if (fn.endsWith('.css')) {
          cssContent += fs.readFileSync(path.join(assetsSubDir, fn), 'utf8') + '\n';
        } else if (fn.endsWith('.js') && !jsFilePath) {
          jsFilePath = path.join(assetsSubDir, fn);
        }
      }
    }
    let iifeJsContent = '';
    if (jsFilePath) {
      const iifeOutPath = path.join(releaseDir, 'temp-ota-iife.js');
      try {
        execSync(
          `npx esbuild "${jsFilePath}" --bundle --format=iife --platform=browser --target=es2020 --minify --outfile="${iifeOutPath}"`,
          { cwd: rootDir, stdio: 'pipe' }
        );
        iifeJsContent = fs.readFileSync(iifeOutPath, 'utf8');
        fs.rmSync(iifeOutPath, { force: true });
      } catch {
        iifeJsContent = fs.readFileSync(jsFilePath, 'utf8');
      }
    }
    if (iifeJsContent) {
      fs.writeFileSync(
        path.join(releaseDir, 'user-ota-bundle.json'),
        JSON.stringify({
          version: buildVersion,
          edition: 'user',
          publishedAtIso: new Date().toISOString(),
          preserveUserData: true,
          cssContent,
          jsContent: iifeJsContent,
        }),
        'utf8'
      );
    }
  } catch (otaErr) {
    console.warn('[Dual Builder] Warning generating user-ota-bundle.json:', otaErr);
  }

  fs.writeFileSync(
    path.join(releaseDir, 'latest-release.json'),
    JSON.stringify(
      {
        version: buildVersion,
        githubRepo,
        publishedAtIso: new Date().toISOString(),
        userSoftwareExe: 'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
        masterSoftwareExe: 'ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe',
        userAndroidApk: 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
        masterAndroidApk: 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
        userOtaBundle: 'user-ota-bundle.json',
        userDownloadUrl: userExeUrl,
        masterDownloadUrl: masterExeUrl,
        userAndroidDownloadUrl: userAndroidApkUrl,
        masterAndroidDownloadUrl: masterAndroidApkUrl,
        userOtaBundleUrl,
        preserveUserDataOnUpdate: true,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n====================================================================');
  console.log('  DUAL WINDOWS .EXE + OTA BUNDLE BUILD COMPLETE!');
  console.log('  1. Master Software: release/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe');
  console.log('  2. User Software:   release/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe');
  console.log('  3. OTA Live Bundle: release/user-ota-bundle.json');
  console.log('====================================================================\n');
} finally {
  // Restore default edition.json to master
  writeEditionConfig('master');
}
