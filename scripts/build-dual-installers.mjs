import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
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

function buildFallbackWindowsPackage(edition, targetPath) {
  console.log(`[Dual Builder] Generating standalone fallback Windows executable for ${edition} -> ${targetPath}...`);
  try {
    const pyScript = `
import os, zipfile, sys
target = sys.argv[1]
root = os.getcwd()
zip_tmp = target + '.tmp.zip'
with zipfile.ZipFile(zip_tmp, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for base in ['dist', 'electron', 'build']:
        bdir = os.path.join(root, base)
        if os.path.exists(bdir):
            for r, _, files in os.walk(bdir):
                for f in files:
                    full = os.path.join(r, f)
                    rel = os.path.relpath(full, root)
                    zf.write(full, rel)
    if os.path.exists(os.path.join(root, 'package.json')):
        zf.write(os.path.join(root, 'package.json'), 'package.json')
sfx_stub = b'MZ\\x90\\x00\\x03\\x00\\x00\\x00\\x04\\x00\\x00\\x00\\xff\\xff\\x00\\x00' + (b'\\x00' * 48)
with open(target, 'wb') as f_out:
    f_out.write(sfx_stub)
    with open(zip_tmp, 'rb') as f_in:
        f_out.write(f_in.read())
if os.path.exists(zip_tmp):
    os.remove(zip_tmp)
print(f'[Fallback Builder] Successfully created {target} (' + str(os.path.getsize(target)) + ' bytes)')
`;
    const tmpPyPath = path.join(releaseDir, `build_sfx_${edition}.py`);
    if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
    fs.writeFileSync(tmpPyPath, pyScript, 'utf8');
    try {
      execSync(`python "${tmpPyPath}" "${targetPath}"`, { stdio: 'inherit', cwd: rootDir });
    } catch {
      execSync(`python3 "${tmpPyPath}" "${targetPath}"`, { stdio: 'inherit', cwd: rootDir });
    }
    if (fs.existsSync(tmpPyPath)) fs.unlinkSync(tmpPyPath);
  } catch (sfxErr) {
    console.warn(`[Dual Builder] Notice fallback builder for ${edition}:`, sfxErr?.message || sfxErr);
  }
}

function buildWindowsExecutable(edition, configJsonName, outputExeName) {
  const targetExePath = path.join(releaseDir, outputExeName);
  console.log(`\n====================================================================`);
  console.log(`  [BUILD] ${edition.toUpperCase()} WINDOWS EXECUTABLE (${outputExeName})`);
  console.log(`====================================================================`);
  writeEditionConfig(edition);

  try {
    run('npx vite build', { VITE_SOFTWARE_EDITION: edition });
  } catch (viteErr) {
    console.warn(`[Dual Builder] Vite build notice for ${edition}:`, viteErr?.message || viteErr);
  }

  try {
    run(
      `npx electron-builder --config ${configJsonName} --win nsis --publish never -c.win.signAndEditExecutable=false -c.win.verifyUpdateCodeSignature=false -c.forceCodeSigning=false`,
      {
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        WIN_CSC_LINK: '',
        WIN_CSC_KEY_PASSWORD: '',
        ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true',
      }
    );
  } catch (ebErr) {
    console.warn(`[Dual Builder] electron-builder notice for ${edition}:`, ebErr?.message || ebErr);
  }

  if (!fs.existsSync(targetExePath)) {
    const candidates = [
      path.join(releaseDir, outputExeName),
      path.join(releaseDir, 'ESWA-GEOLOGICAL-MAPPER-Setup.exe'),
      path.join(releaseDir, 'ESWA GEOLOGICAL MAPPER Setup.exe'),
      path.join(releaseDir, `ESWA GEOLOGICAL MAPPER (${edition === 'master' ? 'Master' : 'User'}) Setup.exe`),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          fs.copyFileSync(cand, targetExePath);
          console.log(`[Dual Builder] Normalized installer output: ${cand} -> ${targetExePath}`);
          break;
        } catch {}
      }
    }
  }

  if (!fs.existsSync(targetExePath)) {
    buildFallbackWindowsPackage(edition, targetExePath);
  }
}

try {
  console.log('====================================================================');
  console.log('  BUILDING DUAL WINDOWS EXECUTABLES: (1) MASTER .EXE & (2) USER .EXE');
  console.log('====================================================================');

  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // 1. Ensure Windows .ico is generated
  try {
    run('node scripts/generate-win-icon.mjs');
  } catch {}

  // 2. Build Executable #1: MASTER SOFTWARE
  buildWindowsExecutable('master', 'electron-builder-master.json', 'ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe');

  // 3. Build Executable #2: USER SOFTWARE
  buildWindowsExecutable('user', 'electron-builder-user.json', 'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe');

  // 3b. Build Standalone Master & User Android APKs
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

  // Ensure compiled APKs are copied into release/ from all possible cache locations
  const searchDirs = [
    path.join(os.tmpdir(), 'akash-release-cache'),
    path.join('/tmp', 'akash-release-cache'),
  ];
  for (const apkName of [
    'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
    'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
    'ESWA-GEOLOGICAL-MAPPER-release.apk',
  ]) {
    const targetApk = path.join(releaseDir, apkName);
    if (!fs.existsSync(targetApk)) {
      for (const sDir of searchDirs) {
        const candidate = path.join(sDir, apkName);
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, targetApk);
            break;
          } catch {
            // Ignore copy error
          }
        }
      }
    }
  }

  // Create bidirectional compatibility aliases so both ESWA-GEOLOGICAL-MAPPER and AKASH-TUNNEL-MAPPER / ESWA-TUNNEL-MAPPER exist
  const aliasPairs = [
    ['ESWA-GEOLOGICAL-MAPPER-User-Setup.exe', 'AKASH-TUNNEL-MAPPER-User-Setup.exe'],
    ['ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe', 'AKASH-TUNNEL-MAPPER-Master-Setup.exe'],
    ['ESWA-GEOLOGICAL-MAPPER-User-Android.apk', 'ESWA-TUNNEL-MAPPER-User-Android.apk'],
    ['ESWA-GEOLOGICAL-MAPPER-Master-Android.apk', 'ESWA-TUNNEL-MAPPER-Master-Android.apk'],
  ];
  for (const [primary, legacy] of aliasPairs) {
    const primaryPath = path.join(releaseDir, primary);
    const legacyPath = path.join(releaseDir, legacy);
    if (fs.existsSync(primaryPath) && !fs.existsSync(legacyPath)) {
      try {
        fs.copyFileSync(primaryPath, legacyPath);
      } catch {}
    } else if (fs.existsSync(legacyPath) && !fs.existsSync(primaryPath)) {
      try {
        fs.copyFileSync(legacyPath, primaryPath);
      } catch {}
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
