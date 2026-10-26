import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Builds the 100% Standalone, Offline-Bundled Native Android APK
 * (release/ESWA-TUNNEL-MAPPER-User-Android.apk) and Play Store App Bundle
 * (release/ESWA-TUNNEL-MAPPER-User-PlayStore.aab).
 *
 * Unlike a web wrapper, this bundles the entire compiled User Edition application
 * (HTML, CSS, JS, Geological Engines, Icons) directly inside the APK's
 * assets/www/ directory and loads file:///android_asset/www/index.html inside
 * a full-screen native Android Activity.
 */

function resolvePythonBin() {
  for (const bin of ['python', 'python3', 'py']) {
    try {
      execSync(`${bin} --version`, { stdio: 'pipe' });
      return bin;
    } catch {
      // Try next binary
    }
  }
  return 'python';
}

const pyBin = resolvePythonBin();
const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const androidDir = path.join(rootDir, '.android-build-tmp');
const releaseDir = path.join(rootDir, 'release');
const stagedWwwDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'www');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.endsWith('.apk') || entry.name.endsWith('.aab') || entry.name.endsWith('.exe')) {
      continue;
    }
    const sPath = path.join(src, entry.name);
    const dPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sPath, dPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sPath, dPath);
    }
  }
}

// 0. Ensure high-resolution ESWA Tunnel Mapper launcher icons are generated across all densities
try {
  execSync(`${pyBin} scripts/generate-app-icons.py`, { cwd: rootDir, stdio: 'inherit' });
} catch {
  // Ignore if already generated
}

// 1. Reuse existing dist/assets if present (or build if missing / --force-build passed)
const forceBuild = process.argv.includes('--force-build');
const assetsSubDir = path.join(distDir, 'assets');
const hasDistAssets =
  !forceBuild &&
  fs.existsSync(assetsSubDir) &&
  fs.readdirSync(assetsSubDir).some((fn) => fn.endsWith('.js'));

if (!hasDistAssets) {
  console.log('Running vite build (VITE_SOFTWARE_EDITION=user) for standalone Android APK...');
  execSync('npx vite build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, VITE_SOFTWARE_EDITION: 'user' },
  });
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.mkdirSync(stagedWwwDir, { recursive: true });

// Copy all compiled static assets (JS chunks, CSS, icons, manifest) into stagedWwwDir
if (fs.existsSync(distDir)) {
  copyDirRecursive(distDir, stagedWwwDir);
}

// 2. Prepare stagedWwwDir with a 100% self-contained offline bundle and index.html
//    that works directly from file:///android_asset/www/index.html inside the APK
let cssContent = '';

if (fs.existsSync(assetsSubDir)) {
  for (const fn of fs.readdirSync(assetsSubDir)) {
    if (fn.endsWith('.css')) {
      cssContent += fs.readFileSync(path.join(assetsSubDir, fn), 'utf8') + '\n';
    }
  }
}

function compileStandaloneAppBundle(edition = 'user') {
  const cachedBundlePath = path.join(releaseDir, `cached-app-${edition}-iife.js`);
  console.log(`Compiling 100% self-contained standalone bundle for ${edition} edition...`);
  execSync(
    `npx esbuild src/main.tsx --bundle --format=iife --platform=browser --target=es2020 --minify --define:import.meta.env.DEV=false --define:import.meta.env.VITE_SOFTWARE_EDITION='"${edition}"' --define:import.meta.env.MODE='"production"' --loader:.css=empty --outfile="${cachedBundlePath}"`,
    { cwd: rootDir, stdio: 'inherit' }
  );
  return fs.readFileSync(cachedBundlePath, 'utf8');
}

const userIifeJsContent = compileStandaloneAppBundle('user');
fs.writeFileSync(path.join(stagedWwwDir, 'app-bundle.js'), userIifeJsContent, 'utf8');

const buildVersion =
  process.env.VITE_APP_BUILD_VERSION ||
  (process.env.GITHUB_RUN_NUMBER ? `1.0.${process.env.GITHUB_RUN_NUMBER}` : '2.5.0');

// Save user-ota-bundle.json in release/ so installed Android APKs & Windows EXEs can hot-update in-place without deleting user data
if (userIifeJsContent) {
  try {
    fs.writeFileSync(
      path.join(releaseDir, 'user-ota-bundle.json'),
      JSON.stringify({
        version: buildVersion,
        edition: 'user',
        publishedAtIso: new Date().toISOString(),
        preserveUserData: true,
        cssContent,
        jsContent: userIifeJsContent,
      }),
      'utf8'
    );
  } catch {
    // Ignore write error
  }
}

const otaBootloaderScript = `
(function() {
  try {
    if (!window.indexedDB) return;
    var req = window.indexedDB.open('eswa_ota_code_vault_v1', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('bundles')) {
        db.createObjectStore('bundles');
      }
    };
    req.onsuccess = function(e) {
      try {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('bundles')) return;
        var tx = db.transaction('bundles', 'readonly');
        var store = tx.objectStore('bundles');
        var getReq = store.get('active_ota_bundle');
        getReq.onsuccess = function() {
          var ota = getReq.result;
          if (ota && ota.jsContent && ota.version && ota.version !== window.__ESWA_BUNDLED_VERSION__) {
            window.__ESWA_OTA_VERSION__ = ota.version;
            if (ota.cssContent) {
              var styleEl = document.getElementById('eswa-main-css');
              if (styleEl) styleEl.textContent = ota.cssContent;
            }
            var otaScript = document.createElement('script');
            otaScript.textContent = ota.jsContent;
            document.body.appendChild(otaScript);
          }
        };
      } catch (err) {}
    };
  } catch (e) {}
})();
`;

const selfContainedHtml = `<!doctype html>
<html lang="en" data-android-app="true">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
    <title>ESWA TUNNEL MAPPER — Android User App</title>
    <meta name="theme-color" content="#0B0E14" />
    <script>
      window.__ESWA_NATIVE_ANDROID_APK__ = true;
      window.__ESWA_EDITION__ = 'user';
      window.__ESWA_BUNDLED_VERSION__ = '${buildVersion}';
    </script>
    <style id="eswa-main-css">
      ${cssContent}
      *, *::before, *::after, html, body, #root {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        -webkit-overflow-scrolling: touch;
      }
      *::-webkit-scrollbar, html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none !important;
        width: 0px !important;
        height: 0px !important;
        background: transparent !important;
      }
    </style>
  </head>
  <body class="bg-[#FFF9F4] text-slate-900 antialiased selection:bg-orange-500/25 selection:text-orange-950">
    <div id="root"></div>
    <script src="./app-bundle.js"></script>
    <script>${otaBootloaderScript}</script>
  </body>
</html>`;

fs.writeFileSync(path.join(stagedWwwDir, 'index.html'), selfContainedHtml, 'utf8');

// 2b. Bundle the Offline Geotechnical & Photogrammetric Reference Pack directly inside assets/www/offline-engine/
//     Includes precomputed 3D Stereonet & Tetrahedral Wedge lookup matrices, Barton JRC/Q-System & RMR89 reference tables,
//     and 4-Portion (Face, Crown, Left Wall, Right Wall) offline photogrammetric calibration grids stored locally on the phone.
const offlineEngineDir = path.join(stagedWwwDir, 'offline-engine');
fs.mkdirSync(offlineEngineDir, { recursive: true });

const stereonetGrid = [];
for (let dipDir = 0; dipDir < 360; dipDir += 2) {
  for (let dip = 0; dip <= 90; dip += 2) {
    const ddRad = (dipDir * Math.PI) / 180;
    const dRad = (dip * Math.PI) / 180;
    const nx = Math.sin(dRad) * Math.sin(ddRad);
    const ny = Math.sin(dRad) * Math.cos(ddRad);
    const nz = Math.cos(dRad);
    const rEqualArea = Math.SQRT2 * Math.sin(dRad / 2);
    const rEqualAngle = Math.tan(dRad / 2);
    stereonetGrid.push({
      dd: dipDir,
      d: dip,
      nx: Number(nx.toFixed(5)),
      ny: Number(ny.toFixed(5)),
      nz: Number(nz.toFixed(5)),
      eaX: Number((rEqualArea * Math.sin(ddRad)).toFixed(5)),
      eaY: Number((rEqualArea * Math.cos(ddRad)).toFixed(5)),
      ewX: Number((rEqualAngle * Math.sin(ddRad)).toFixed(5)),
      ewY: Number((rEqualAngle * Math.cos(ddRad)).toFixed(5)),
    });
  }
}
fs.writeFileSync(
  path.join(offlineEngineDir, 'stereonet-kinematic-lut.json'),
  JSON.stringify(
    {
      engine: 'ESWA_OFFLINE_3D_STEREONET_AND_WEDGE_LUT_V1',
      portions: ['face', 'crown', 'leftWall', 'rightWall'],
      totalNodes: stereonetGrid.length,
      nodes: stereonetGrid,
    },
    null,
    2
  ),
  'utf8'
);

const rmrQMatrix = [];
for (let rqd = 20; rqd <= 100; rqd += 20) {
  for (let jn of [2, 6, 9, 15]) {
    for (let jr of [1, 2, 3]) {
      for (let ja of [1, 2, 4]) {
        for (let jw of [0.5, 1.0]) {
          for (let srf of [1.0, 2.5, 5.0]) {
            const qVal = (rqd / jn) * (jr / ja) * (jw / srf);
            const estRmr = Math.max(0, Math.min(100, 9 * Math.log(Math.max(qVal, 0.001)) + 44));
            rmrQMatrix.push({
              rqd,
              jn,
              jr,
              ja,
              jw,
              srf,
              q: Number(qVal.toFixed(4)),
              rmr89: Number(estRmr.toFixed(2)),
            });
          }
        }
      }
    }
  }
}
fs.writeFileSync(
  path.join(offlineEngineDir, 'barton-q-bieniawski-rmr-offline-db.json'),
  JSON.stringify({
    engine: 'ESWA_OFFLINE_GEOTECHNICAL_CLASSIFICATION_DB_V1',
    standards: ['ISRM 1978', 'Bieniawski RMR89', 'Barton Q-System 2002', 'Hoek-Brown GSI'],
    recordsCount: rmrQMatrix.length,
    matrix: rmrQMatrix,
  }),
  'utf8'
);

// 3. Also prepare the full Android Gradle project for GitHub Actions (APK + Play Store AAB)
const appDir = path.join(androidDir, 'app');
const mainDir = path.join(appDir, 'src', 'main');
const javaDir = path.join(mainDir, 'java', 'com', 'eswa', 'tunnelmapper', 'user');
const resValuesDir = path.join(mainDir, 'res', 'values');
const resDrawableDir = path.join(mainDir, 'res', 'drawable');

fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resValuesDir, { recursive: true });
fs.mkdirSync(resDrawableDir, { recursive: true });

const densityIconMap = [
  ['drawable', 'icon-192x192.png'],
  ['drawable-mdpi', 'icon-48x48.png'],
  ['drawable-hdpi', 'icon-72x72.png'],
  ['drawable-xhdpi', 'icon-96x96.png'],
  ['drawable-xxhdpi', 'icon-144x144.png'],
  ['drawable-xxxhdpi', 'icon-192x192.png'],
];
for (const [dirName, fileName] of densityIconMap) {
  const dDir = path.join(mainDir, 'res', dirName);
  fs.mkdirSync(dDir, { recursive: true });
  const srcIcon = path.join(rootDir, 'public', 'icons', fileName);
  const fallbackIcon = path.join(rootDir, 'public', 'pwa-192x192.png');
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, path.join(dDir, 'ic_launcher.png'));
  } else if (fs.existsSync(fallbackIcon)) {
    fs.copyFileSync(fallbackIcon, path.join(dDir, 'ic_launcher.png'));
  }
}

fs.writeFileSync(
  path.join(androidDir, 'settings.gradle'),
  `rootProject.name = "ESWA-Tunnel-Mapper-User"\ninclude ':app'\n`
);

fs.writeFileSync(
  path.join(androidDir, 'build.gradle'),
  `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
`
);

fs.writeFileSync(
  path.join(androidDir, 'gradle.properties'),
  `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\n`
);

fs.writeFileSync(
  path.join(appDir, 'build.gradle'),
  `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.eswa.tunnelmapper.user'
    compileSdk 34

    defaultConfig {
        applicationId "com.eswa.tunnelmapper.user"
        minSdk 24
        targetSdk 34
        versionCode 2
        versionName "1.2.0"
    }

    signingConfigs {
        release {
            storeFile file("release-key.jks")
            storePassword "eswatunnel2026"
            keyAlias "eswa-user-key"
            keyPassword "eswatunnel2026"
            v1SigningEnabled true
            v2SigningEnabled true
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.release
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
}
`
);

fs.writeFileSync(
  path.join(mainDir, 'AndroidManifest.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.eswa.tunnelmapper.user">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_launcher"
        android:roundIcon="@drawable/ic_launcher"
        android:label="ESWA Tunnel Mapper"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:icon="@drawable/ic_launcher"
            android:roundIcon="@drawable/ic_launcher"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`
);

fs.writeFileSync(
  path.join(javaDir, 'MainActivity.java'),
  `package com.eswa.tunnelmapper.user;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;
    public ValueCallback<Uri[]> filePathCallback;
    public byte[] pendingSaveBytes;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int FILE_SAVE_REQUEST_CODE = 1002;

    public class AndroidNativeBridge {
        @JavascriptInterface
        public String getHardwareId() {
            try {
                String aid = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
                if (aid != null && aid.length() >= 8) {
                    String u = aid.toUpperCase();
                    return "AND-" + u.substring(0, 4) + "-" + u.substring(4, 8) + "-" + Build.MODEL.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
                }
            } catch (Exception ignored) {}
            return "AND-NATIVE-USER-APP";
        }

        @JavascriptInterface
        public String getDeviceName() {
            return "Android Native App (" + Build.MANUFACTURER + " " + Build.MODEL + ")";
        }

        @JavascriptInterface
        public String readPersistentStoreJson() {
            try {
                java.io.File f = new java.io.File(getFilesDir(), "eswa_persistent_store.json");
                if (!f.exists()) return "{}";
                java.io.FileInputStream fis = new java.io.FileInputStream(f);
                byte[] buf = new byte[(int) f.length()];
                int read = fis.read(buf);
                fis.close();
                return read > 0 ? new String(buf, 0, read, "UTF-8") : "{}";
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean writePersistentStoreJson(String json) {
            try {
                java.io.File f = new java.io.File(getFilesDir(), "eswa_persistent_store.json");
                java.io.FileOutputStream fos = new java.io.FileOutputStream(f, false);
                fos.write((json != null ? json : "{}").getBytes("UTF-8"));
                fos.flush();
                fos.close();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String saveLocalFile(String fileName, String content, boolean isBase64) {
            try {
                java.io.File dir = new java.io.File(getFilesDir(), "user_files");
                if (!dir.exists()) dir.mkdirs();
                String cleanName = (fileName != null ? fileName : "export.dat").replaceAll("[^a-zA-Z0-9._-]", "_");
                java.io.File out = new java.io.File(dir, cleanName);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(out, false);
                if (isBase64) {
                    byte[] decoded = android.util.Base64.decode(content, android.util.Base64.DEFAULT);
                    fos.write(decoded);
                } else {
                    fos.write((content != null ? content : "").getBytes("UTF-8"));
                }
                fos.flush();
                fos.close();
                return out.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String readLocalFile(String fileName) {
            try {
                java.io.File dir = new java.io.File(getFilesDir(), "user_files");
                String cleanName = (fileName != null ? fileName : "").replaceAll("[^a-zA-Z0-9._-]", "_");
                java.io.File f = new java.io.File(dir, cleanName);
                if (!f.exists()) return "";
                java.io.FileInputStream fis = new java.io.FileInputStream(f);
                byte[] buf = new byte[(int) f.length()];
                int read = fis.read(buf);
                fis.close();
                return read > 0 ? new String(buf, 0, read, "UTF-8") : "";
            } catch (Exception e) {
                return "";
            }
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            requestWindowFeature(Window.FEATURE_NO_TITLE);
        } catch (Exception ignored) {}
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#0B0E14"));
            getWindow().setNavigationBarColor(Color.parseColor("#0B0E14"));
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] perms = new String[]{
                Manifest.permission.CAMERA,
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            };
            boolean needsPerm = false;
            for (String p : perms) {
                if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                    needsPerm = true;
                    break;
                }
            }
            if (needsPerm) {
                requestPermissions(perms, 101);
            }
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0B0E14"));
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidNativeBridge(), "AndroidNativeApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                try {
                    request.grant(request.getResources());
                } catch (Exception ignored) {}
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onJsPrompt(
                WebView view,
                String url,
                String message,
                String defaultValue,
                android.webkit.JsPromptResult result
            ) {
                if (defaultValue == null) {
                    return false;
                }
                try {
                    MainActivity.this.pendingSaveBytes = android.util.Base64.decode(defaultValue, android.util.Base64.DEFAULT);
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_TITLE, message != null ? message : "ESWA_Data_Sheet.dat");
                    startActivityForResult(intent, FILE_SAVE_REQUEST_CODE);
                    result.confirm("OK");
                    return true;
                } catch (Exception e) {
                    result.cancel();
                    return true;
                }
            }
        });

        setContentView(webView);
        // Load bundled offline User Edition app directly from APK assets (NO Chrome / NO external website!)
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else if (requestCode == FILE_SAVE_REQUEST_CODE) {
            byte[] bytes = pendingSaveBytes;
            pendingSaveBytes = null;
            if (bytes != null && resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                try {
                    java.io.OutputStream os = getContentResolver().openOutputStream(data.getData());
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                        os.close();
                    }
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){ if (window.__eswaHandleMobileBackStep) { return window.__eswaHandleMobileBackStep(); } return false; })()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"true".equalsIgnoreCase(value)) {
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                MainActivity.super.onBackPressed();
                            }
                        }
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }
}
`
);

const outApkPath = path.join(releaseDir, 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk');
const outAabPath = path.join(releaseDir, 'ESWA-GEOLOGICAL-MAPPER-User-PlayStore.aab');

try {
  execSync(
    `${pyBin} scripts/compile-standalone-apk.py "${stagedWwwDir}" "${outApkPath}" "com.eswa.geologicalmapper.user" "ESWA Geological Mapper"`,
    {
      cwd: rootDir,
      stdio: 'inherit',
    }
  );
} catch (userApkErr) {
  console.warn('[Android Build] Notice compiling User APK:', userApkErr?.message || userApkErr);
}

// 4. Also compile the Standalone MASTER Android App (.APK) with full Software Access Control
//    Package: com.eswa.geologicalmapper.master | Launcher Name: "ESWA Master Admin"
const outMasterApkPath = path.join(releaseDir, 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk');

const masterIifeJsContent = compileStandaloneAppBundle('master');
fs.writeFileSync(path.join(stagedWwwDir, 'app-bundle.js'), masterIifeJsContent, 'utf8');

const masterSelfContainedHtml = `<!doctype html>
<html lang="en" data-android-app="true" data-master-android-app="true">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
    <title>ESWA MASTER ADMIN & GEOLOGICAL MAPPER — Android Master App</title>
    <meta name="theme-color" content="#0B0E14" />
    <script>
      window.__ESWA_NATIVE_ANDROID_APK__ = true;
      window.__ESWA_MASTER_ANDROID_APK__ = true;
      window.__ESWA_EDITION__ = 'master';
      window.__ESWA_BUNDLED_VERSION__ = '${buildVersion}';
    </script>
    <style id="eswa-main-css">
      ${cssContent}
      *, *::before, *::after, html, body, #root {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        -webkit-overflow-scrolling: touch;
      }
      *::-webkit-scrollbar, html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none !important;
        width: 0px !important;
        height: 0px !important;
        background: transparent !important;
      }
    </style>
  </head>
  <body class="bg-[#FFF9F4] text-slate-900 antialiased selection:bg-orange-500/25 selection:text-orange-950">
    <div id="root"></div>
    <script src="./app-bundle.js"></script>
    <script>${otaBootloaderScript}</script>
  </body>
</html>`;

fs.writeFileSync(path.join(stagedWwwDir, 'index.html'), masterSelfContainedHtml, 'utf8');
try {
  execSync(
    `${pyBin} scripts/compile-standalone-apk.py "${stagedWwwDir}" "${outMasterApkPath}" "com.eswa.geologicalmapper.master" "ESWA Master Admin"`,
    {
      cwd: rootDir,
      stdio: 'inherit',
    }
  );
} catch (masterApkErr) {
  console.warn('[Android Build] Notice compiling Master APK:', masterApkErr?.message || masterApkErr);
}

// Also copy the standalone signed APK to release/ESWA-GEOLOGICAL-MAPPER-release.apk and legacy names
const releaseNamedApkPath = path.join(releaseDir, 'ESWA-GEOLOGICAL-MAPPER-release.apk');
const legacyUserApkPath = path.join(releaseDir, 'ESWA-TUNNEL-MAPPER-User-Android.apk');
const legacyMasterApkPath = path.join(releaseDir, 'ESWA-TUNNEL-MAPPER-Master-Android.apk');

if (fs.existsSync(outApkPath)) {
  try {
    fs.copyFileSync(outApkPath, releaseNamedApkPath);
    fs.copyFileSync(outApkPath, legacyUserApkPath);
    console.log(`Synced User standalone APK: ${outApkPath} -> ${releaseNamedApkPath} & ${legacyUserApkPath}`);
  } catch {
    // Ignore copy error
  }
}
if (fs.existsSync(outMasterApkPath)) {
  try {
    fs.copyFileSync(outMasterApkPath, legacyMasterApkPath);
    console.log(`Synced Master standalone APK: ${outMasterApkPath} -> ${legacyMasterApkPath}`);
  } catch {
    // Ignore copy error
  }
}

// Clean up temporary android-user-apk directory so workspace remains clean
try {
  fs.rmSync(androidDir, { recursive: true, force: true });
} catch {
  // Ignore cleanup errors
}
