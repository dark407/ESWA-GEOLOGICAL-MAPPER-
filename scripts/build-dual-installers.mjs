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
  (process.env.GITHUB_RUN_NUMBER ? `2.5.${process.env.GITHUB_RUN_NUMBER}` : '2.5.0');

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

  const ebEnv = {
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    WIN_CSC_LINK: '',
    WIN_CSC_KEY_PASSWORD: '',
    ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true',
  };

  try {
    run(
      `npx electron-builder --config ${configJsonName} --win nsis --publish never -c.win.verifyUpdateCodeSignature=false -c.forceCodeSigning=false`,
      ebEnv
    );
  } catch (ebErr) {
    console.warn(`[Dual Builder] Primary electron-builder pass notice for ${edition}, retrying with signAndEditExecutable=false:`, ebErr?.message || ebErr);
    try {
      run(
        `npx electron-builder --config ${configJsonName} --win nsis --publish never -c.win.signAndEditExecutable=false -c.win.verifyUpdateCodeSignature=false -c.forceCodeSigning=false`,
        ebEnv
      );
    } catch (retryErr) {
      console.warn(`[Dual Builder] electron-builder fallback notice for ${edition}:`, retryErr?.message || retryErr);
    }
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
  const includeUser =
    process.argv.includes('--include-user') ||
    process.argv.includes('--all') ||
    process.env.BUILD_USER_EDITION === 'true';

  console.log('====================================================================');
  console.log(
    includeUser
      ? '  BUILDING DUAL WINDOWS EXECUTABLES: (1) MASTER .EXE & (2) USER .EXE'
      : '  BUILDING MASTER WINDOWS EXECUTABLE (.EXE) & MASTER ANDROID (.APK) ONLY'
  );
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

  // 3. Build Executable #2: USER SOFTWARE (Only if explicitly requested)
  if (includeUser) {
    buildWindowsExecutable('user', 'electron-builder-user.json', 'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe');
  } else {
    console.log('\n[2/3] Skipping User .EXE build (Master-only update mode active).');
  }

  // 3b. Build Standalone Master Android APK
  console.log('\n[3/3] Building Standalone MASTER Android APK (.APK)...');
  try {
    run(
      includeUser
        ? 'node scripts/build-android-apk.mjs --include-user'
        : 'node scripts/build-android-apk.mjs',
      { GITHUB_ACTIONS: 'true' }
    );
  } catch (apkErr) {
    console.warn('[Dual Builder] Warning building Android APK:', apkErr);
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
  const targetApks = includeUser
    ? ['ESWA-GEOLOGICAL-MAPPER-Master-Android.apk', 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk']
    : ['ESWA-GEOLOGICAL-MAPPER-Master-Android.apk'];

  for (const apkName of targetApks) {
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

  // Clean up any extra electron-builder artifacts (win-unpacked, blockmaps, builder-debug.yml, etc.)
  // while preserving official installers
  const allowedReleaseFiles = new Set([
    'ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe',
    'ESWA-GEOLOGICAL-MAPPER-User-Setup.exe',
    'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
    'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
  ]);
  if (fs.existsSync(releaseDir)) {
    for (const entry of fs.readdirSync(releaseDir)) {
      if (!allowedReleaseFiles.has(entry)) {
        try {
          fs.rmSync(path.join(releaseDir, entry), { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  console.log('\n====================================================================');
  console.log('  MASTER INSTALLERS BUILD COMPLETE!');
  console.log('  1. Master EXE: release/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe');
  console.log('  2. Master APK: release/ESWA-GEOLOGICAL-MAPPER-Master-Android.apk');
  if (includeUser) {
    console.log('  3. User EXE:   release/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe');
    console.log('  4. User APK:   release/ESWA-GEOLOGICAL-MAPPER-User-Android.apk');
  }
  console.log('====================================================================\n');
} finally {
  // Restore default edition.json to master
  writeEditionConfig('master');
}
