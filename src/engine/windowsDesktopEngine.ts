import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * React hook for native Windows 10/11 (Edge/Chrome) & PWA Desktop installation.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

/**
 * React hook for tracking online/offline field connectivity status.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Generates a valid, native Windows PE32 GUI executable (Akash_Tunnel_Mapper_PC.exe).
 * When launched on Windows 10/11 (x86 or x64), it invokes ShellExecuteA from shell32.dll
 * to open Akash Tunnel Joint Tracer in a dedicated maximized native Windows application window
 * (msedge.exe --app=<URL> --start-maximized) with automatic default-browser fallback.
 */
export function buildWindowsDesktopExeBinary(appUrl: string): Uint8Array {
  const cleanUrl = (appUrl || 'http://localhost:3000').trim().slice(0, 220);
  const edgeArgs = `--app=${cleanUrl} --start-maximized`;

  // Total file size: 0x600 (1536 bytes):
  // 0x000..0x1FF: DOS + PE32 Headers (512 bytes)
  // 0x200..0x5FF: .text section (1024 bytes, mapped to RVA 0x1000, VA 0x00401000)
  const buf = new Uint8Array(0x600);
  const view = new DataView(buf.buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      buf[offset + i] = str.charCodeAt(i) & 0xff;
    }
    buf[offset + str.length] = 0;
  };

  // 1. IMAGE_DOS_HEADER (0x00..0x3F)
  view.setUint16(0x00, 0x5a4d, true); // 'MZ'
  view.setUint32(0x3c, 0x00000080, true); // e_lfanew -> 0x80

  // 2. PE Signature & IMAGE_FILE_HEADER (0x80..0x97)
  view.setUint32(0x80, 0x00004550, true); // 'PE\0\0'
  view.setUint16(0x84, 0x014c, true); // Machine: IMAGE_FILE_MACHINE_I386 (runs on all x86 & x64 Windows)
  view.setUint16(0x86, 1, true); // NumberOfSections: 1
  view.setUint32(0x88, 0x66f00000, true); // TimeDateStamp
  view.setUint32(0x8c, 0, true); // PointerToSymbolTable
  view.setUint32(0x90, 0, true); // NumberOfSymbols
  view.setUint16(0x94, 0x00e0, true); // SizeOfOptionalHeader (224 bytes)
  view.setUint16(0x96, 0x010f, true); // Characteristics: EXECUTABLE_IMAGE | 32BIT_MACHINE | RELOCS_STRIPPED

  // 3. IMAGE_OPTIONAL_HEADER32 (0x98..0x177)
  const opt = 0x98;
  view.setUint16(opt + 0x00, 0x010b, true); // Magic: PE32
  buf[opt + 0x02] = 14; // MajorLinkerVersion
  buf[opt + 0x03] = 0; // MinorLinkerVersion
  view.setUint32(opt + 0x04, 0x00000400, true); // SizeOfCode
  view.setUint32(opt + 0x08, 0x00000000, true); // SizeOfInitializedData
  view.setUint32(opt + 0x0c, 0x00000000, true); // SizeOfUninitializedData
  view.setUint32(opt + 0x10, 0x00001000, true); // AddressOfEntryPoint (RVA 0x1000)
  view.setUint32(opt + 0x14, 0x00001000, true); // BaseOfCode
  view.setUint32(opt + 0x18, 0x00001000, true); // BaseOfData
  view.setUint32(opt + 0x1c, 0x00400000, true); // ImageBase (0x00400000)
  view.setUint32(opt + 0x20, 0x00001000, true); // SectionAlignment
  view.setUint32(opt + 0x24, 0x00000200, true); // FileAlignment
  view.setUint16(opt + 0x28, 6, true); // MajorOperatingSystemVersion (Windows Vista/7/10/11)
  view.setUint16(opt + 0x2a, 0, true); // MinorOperatingSystemVersion
  view.setUint16(opt + 0x2c, 1, true); // MajorImageVersion
  view.setUint16(opt + 0x2e, 0, true); // MinorImageVersion
  view.setUint16(opt + 0x30, 6, true); // MajorSubsystemVersion
  view.setUint16(opt + 0x32, 0, true); // MinorSubsystemVersion
  view.setUint32(opt + 0x34, 0, true); // Win32VersionValue
  view.setUint32(opt + 0x38, 0x00002000, true); // SizeOfImage (0x2000)
  view.setUint32(opt + 0x3c, 0x00000200, true); // SizeOfHeaders (0x200)
  view.setUint32(opt + 0x40, 0, true); // CheckSum
  view.setUint16(opt + 0x44, 2, true); // Subsystem: IMAGE_SUBSYSTEM_WINDOWS_GUI (2)
  view.setUint16(opt + 0x46, 0, true); // DllCharacteristics
  view.setUint32(opt + 0x48, 0x00100000, true); // SizeOfStackReserve
  view.setUint32(opt + 0x4c, 0x00001000, true); // SizeOfStackCommit
  view.setUint32(opt + 0x50, 0x00100000, true); // SizeOfHeapReserve
  view.setUint32(opt + 0x54, 0x00001000, true); // SizeOfHeapCommit
  view.setUint32(opt + 0x58, 0, true); // LoaderFlags
  view.setUint32(opt + 0x5c, 16, true); // NumberOfRvaAndSizes

  // Data Directories start at opt + 0x60 = 0xF8
  // Directory 1: Import Directory (offset 0xF8 + 8 = 0x100)
  view.setUint32(0x100, 0x00001100, true); // Import Table RVA = 0x1100
  view.setUint32(0x104, 60, true); // Import Table Size = 60 bytes (3 descriptors)

  // Directory 12: IAT (offset 0xF8 + 96 = 0x158)
  view.setUint32(0x158, 0x00001160, true); // IAT RVA = 0x1160
  view.setUint32(0x15c, 16, true); // IAT Size = 16 bytes

  // 4. IMAGE_SECTION_HEADER (.text at 0x178..0x19F)
  writeAscii(0x178, '.text');
  view.setUint32(0x180, 0x00000400, true); // VirtualSize
  view.setUint32(0x184, 0x00001000, true); // VirtualAddress (RVA 0x1000)
  view.setUint32(0x188, 0x00000400, true); // SizeOfRawData (1024 bytes)
  view.setUint32(0x18c, 0x00000200, true); // PointerToRawData (File offset 0x200)
  view.setUint32(0x19c, 0xe0000020, true); // Characteristics: CODE | EXECUTE | READ | WRITE

  // 5. Machine Code at File Offset 0x200 (RVA 0x1000, VA 0x00401000)
  const code = [
    // ShellExecuteA(NULL, "open", "msedge.exe", "--app=<URL> --start-maximized", NULL, SW_SHOWNORMAL)
    0x6a, 0x01,                         // push 1 (SW_SHOWNORMAL)
    0x6a, 0x00,                         // push 0 (lpDirectory = NULL)
    0x68, 0xe0, 0x12, 0x40, 0x00,       // push 0x004012E0 (lpParameters = edgeArgs)
    0x68, 0xd0, 0x11, 0x40, 0x00,       // push 0x004011D0 (lpFile = "msedge.exe")
    0x68, 0xc8, 0x11, 0x40, 0x00,       // push 0x004011C8 (lpOperation = "open")
    0x6a, 0x00,                         // push 0 (hwnd = NULL)
    0xff, 0x15, 0x60, 0x11, 0x40, 0x00, // call dword ptr [0x00401160] (ShellExecuteA)
    0x83, 0xf8, 0x20,                   // cmp eax, 32
    0x7f, 0x18,                         // jg +24 bytes (to ExitProcess)
    // Fallback: ShellExecuteA(NULL, "open", "<URL>", NULL, NULL, SW_SHOWNORMAL)
    0x6a, 0x01,                         // push 1
    0x6a, 0x00,                         // push 0
    0x6a, 0x00,                         // push 0
    0x68, 0xe0, 0x11, 0x40, 0x00,       // push 0x004011E0 (lpFile = cleanUrl)
    0x68, 0xc8, 0x11, 0x40, 0x00,       // push 0x004011C8 (lpOperation = "open")
    0x6a, 0x00,                         // push 0
    0xff, 0x15, 0x60, 0x11, 0x40, 0x00, // call dword ptr [0x00401160] (ShellExecuteA)
    // ExitProcess(0)
    0x6a, 0x00,                         // push 0
    0xff, 0x15, 0x68, 0x11, 0x40, 0x00, // call dword ptr [0x00401168] (ExitProcess)
    0xc3,                               // ret
  ];
  for (let i = 0; i < code.length; i++) {
    buf[0x200 + i] = code[i];
  }

  // 6. Import Directory Table at File Offset 0x300 (RVA 0x1100)
  // Descriptor 0: shell32.dll
  view.setUint32(0x300, 0x00001140, true); // OriginalFirstThunk
  view.setUint32(0x304, 0, true); // TimeDateStamp
  view.setUint32(0x308, 0, true); // ForwarderChain
  view.setUint32(0x30c, 0x00001180, true); // Name RVA ("shell32.dll")
  view.setUint32(0x310, 0x00001160, true); // FirstThunk RVA (IAT)

  // Descriptor 1: kernel32.dll
  view.setUint32(0x314, 0x00001148, true); // OriginalFirstThunk
  view.setUint32(0x318, 0, true); // TimeDateStamp
  view.setUint32(0x31c, 0, true); // ForwarderChain
  view.setUint32(0x320, 0x00001190, true); // Name RVA ("kernel32.dll")
  view.setUint32(0x324, 0x00001168, true); // FirstThunk RVA (IAT)

  // OriginalFirstThunk (ILT) at File Offset 0x340 (RVA 0x1140)
  view.setUint32(0x340, 0x000011a0, true); // Hint/Name RVA for ShellExecuteA
  view.setUint32(0x344, 0, true);
  view.setUint32(0x348, 0x000011b4, true); // Hint/Name RVA for ExitProcess
  view.setUint32(0x34c, 0, true);

  // FirstThunk (IAT) at File Offset 0x360 (RVA 0x1160)
  view.setUint32(0x360, 0x000011a0, true); // ShellExecuteA
  view.setUint32(0x364, 0, true);
  view.setUint32(0x368, 0x000011b4, true); // ExitProcess
  view.setUint32(0x36c, 0, true);

  // DLL & Function Names at File Offset 0x380 (RVA 0x1180)
  writeAscii(0x380, 'shell32.dll');
  writeAscii(0x390, 'kernel32.dll');
  // 0x3A0 (RVA 0x11A0): Hint (0) + "ShellExecuteA"
  view.setUint16(0x3a0, 0, true);
  writeAscii(0x3a2, 'ShellExecuteA');
  // 0x3B4 (RVA 0x11B4): Hint (0) + "ExitProcess"
  view.setUint16(0x3b4, 0, true);
  writeAscii(0x3b6, 'ExitProcess');

  // Argument Strings
  writeAscii(0x3c8, 'open');        // RVA 0x11C8 -> VA 0x004011C8
  writeAscii(0x3d0, 'msedge.exe');  // RVA 0x11D0 -> VA 0x004011D0
  writeAscii(0x3e0, cleanUrl);      // RVA 0x11E0 -> VA 0x004011E0
  writeAscii(0x4e0, edgeArgs);      // RVA 0x12E0 -> VA 0x004012E0

  return buf;
}

const GITHUB_REPO_STORAGE_KEY = 'eswa_github_repo_slug_v1';

/**
 * Normalizes a GitHub repository input (e.g. "https://github.com/owner/repo" or "owner/repo")
 * into a clean "owner/repo" slug.
 */
export function normalizeGithubRepoSlug(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const withoutProtocol = trimmed
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = withoutProtocol.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return '';
}

/**
 * Returns the configured GitHub repository slug ("owner/repo") from build env or localStorage.
 */
export function getConfiguredGithubRepo(): string {
  try {
    const envRepo = (
      import.meta as unknown as { env?: Record<string, string> }
    ).env?.VITE_GITHUB_REPO;
    if (envRepo && normalizeGithubRepoSlug(envRepo)) {
      return normalizeGithubRepoSlug(envRepo);
    }
  } catch {
    // Ignore
  }
  if (typeof window !== 'undefined') {
    try {
      const win = window as unknown as {
        akashDesktop?: { githubRepo?: string };
        eswaDesktop?: { githubRepo?: string };
      };
      const desktopRepo = win.akashDesktop?.githubRepo || win.eswaDesktop?.githubRepo || '';
      if (desktopRepo && normalizeGithubRepoSlug(desktopRepo)) {
        return normalizeGithubRepoSlug(desktopRepo);
      }
      const params = new URLSearchParams(window.location.search);
      const queryRepo = params.get('repo') || '';
      if (queryRepo && normalizeGithubRepoSlug(queryRepo)) {
        return normalizeGithubRepoSlug(queryRepo);
      }
      const stored = localStorage.getItem(GITHUB_REPO_STORAGE_KEY);
      if (stored && normalizeGithubRepoSlug(stored)) {
        return normalizeGithubRepoSlug(stored);
      }
    } catch {
      // Ignore
    }
  }
  return '';
}

/**
 * Saves the GitHub repository slug ("owner/repo") locally and notifies listeners.
 */
export function saveConfiguredGithubRepo(rawInput: string): string {
  const clean = normalizeGithubRepoSlug(rawInput);
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(GITHUB_REPO_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(GITHUB_REPO_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('eswa-github-repo-updated', { detail: clean }));
    } catch {
      // Ignore
    }
  }
  return clean;
}

export const PUBLIC_SHARED_APP_ORIGIN =
  'https://ais-pre-a4hhtle4c5nnrzjnsyntzb-386382408800.asia-southeast1.run.app';

export function getPublicShareOrigin(): string {
  if (typeof window === 'undefined') return PUBLIC_SHARED_APP_ORIGIN;
  const origin = (window.location.origin || '').trim();
  if (
    !origin ||
    origin === 'null' ||
    origin.startsWith('file:') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return PUBLIC_SHARED_APP_ORIGIN;
  }
  if (origin.startsWith('https://ais-dev-')) {
    return origin.replace('https://ais-dev-', 'https://ais-pre-');
  }
  return origin;
}

/**
 * Returns the direct GitHub Releases download URL for the Normal User Software (.EXE):
 * https://github.com/<owner>/<repo>/releases/download/latest/AKASH-TUNNEL-MAPPER-User-Setup.exe
 */
export function getGithubUserExeDownloadUrl(customRepo?: string): string {
  const repo = normalizeGithubRepoSlug(customRepo || '') || getConfiguredGithubRepo();
  if (repo) {
    return `https://github.com/${repo}/releases/download/latest/AKASH-TUNNEL-MAPPER-User-Setup.exe`;
  }
  return `${getPublicShareOrigin()}/?edition=user&download=user-exe`;
}

/**
 * Returns the direct GitHub Releases download URL for the Master Software (.EXE):
 * https://github.com/<owner>/<repo>/releases/download/latest/AKASH-TUNNEL-MAPPER-Master-Setup.exe
 */
export function getGithubMasterExeDownloadUrl(customRepo?: string): string {
  const repo = normalizeGithubRepoSlug(customRepo || '') || getConfiguredGithubRepo();
  if (repo) {
    return `https://github.com/${repo}/releases/download/latest/AKASH-TUNNEL-MAPPER-Master-Setup.exe`;
  }
  return getPublicShareOrigin();
}

/**
 * Returns true if the current browser/device is an Android smartphone/tablet, iOS device,
 * or running inside the standalone native Android APK.
 */
export function isAndroidOrMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const win = window as unknown as {
      __ESWA_NATIVE_ANDROID_APK__?: boolean;
      AndroidNativeApp?: unknown;
    };
    if (win.__ESWA_NATIVE_ANDROID_APK__ || win.AndroidNativeApp) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform')?.toLowerCase() === 'android') {
      return true;
    }
    const ua = (window.navigator.userAgent || '').toLowerCase();
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
      return true;
    }
    if (window.innerWidth < 768 && (window.navigator.maxTouchPoints || 0) > 0) {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Returns the shareable URL for the Normal User Software Edition (?edition=user).
 */
export function getUserEditionShareUrl(): string {
  return `${getPublicShareOrigin()}/?edition=user`;
}

/**
 * Returns the direct shareable download URL for the standalone User Desktop EXE (AKASH-TUNNEL-MAPPER-User-Setup.exe).
 */
export function getUserDesktopExeShareUrl(): string {
  return `${getPublicShareOrigin()}/?edition=user&download=user-exe`;
}

/**
 * Returns the direct shareable download URL for the standalone User Android APK (ESWA-TUNNEL-MAPPER-User-Android.apk).
 */
export function getUserAndroidAppShareUrl(_customRepo?: string): string {
  return `${getPublicShareOrigin()}/?edition=user&download=user-apk`;
}

/**
 * Returns the direct download URL for the User Android App (.APK):
 */
export function getGithubUserAndroidApkDownloadUrl(_customRepo?: string): string {
  return getUserAndroidAppShareUrl();
}

export function isRunningInsideNativeAndroidApk(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    __ESWA_NATIVE_ANDROID_APK__?: boolean;
    AndroidNativeApp?: unknown;
  };
  return Boolean(win.__ESWA_NATIVE_ANDROID_APK__ || win.AndroidNativeApp);
}

/**
 * Returns the direct shareable download URL for the standalone Master Android APK (ESWA-TUNNEL-MAPPER-Master-Android.apk).
 */
export function getMasterAndroidAppShareUrl(_customRepo?: string): string {
  return `${getPublicShareOrigin()}/?edition=master&download=master-apk`;
}

/**
 * Returns the direct download URL for the Master Android App (.APK):
 */
export function getGithubMasterAndroidApkDownloadUrl(_customRepo?: string): string {
  return getMasterAndroidAppShareUrl();
}

const DEV_CLOUD_APP_ORIGIN =
  'https://ais-dev-a4hhtle4c5nnrzjnsyntzb-386382408800.asia-southeast1.run.app';

function getCandidateServerBases(): string[] {
  if (typeof window === 'undefined') return [''];
  const origin = (window.location.origin || '').trim();
  const isHttp = origin.startsWith('http://') || origin.startsWith('https://');
  const candidates: string[] = [];
  if (isHttp) {
    candidates.push('');
    candidates.push(origin);
  }
  if (!candidates.includes(DEV_CLOUD_APP_ORIGIN)) {
    candidates.push(DEV_CLOUD_APP_ORIGIN);
  }
  if (!candidates.includes(PUBLIC_SHARED_APP_ORIGIN)) {
    candidates.push(PUBLIC_SHARED_APP_ORIGIN);
  }
  return candidates;
}

const cachedApkBlobUrls: Record<'master' | 'user', { blobUrl: string; sizeMb: string } | null> = {
  master: null,
  user: null,
};

const inFlightApkPromises: Record<
  'master' | 'user',
  Promise<{ blobUrl: string; sizeMb: string } | null> | null
> = {
  master: null,
  user: null,
};

const cachedExeBlobUrls: Record<'master' | 'user', { blobUrl: string; sizeMb: string } | null> = {
  master: null,
  user: null,
};

const inFlightExePromises: Record<
  'master' | 'user',
  Promise<{ blobUrl: string; sizeMb: string } | null> | null
> = {
  master: null,
  user: null,
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function getCachedAndroidApkBlobUrl(
  edition: 'master' | 'user'
): { blobUrl: string; sizeMb: string } | null {
  return cachedApkBlobUrls[edition];
}

export function getCachedWindowsExeBlobUrl(
  edition: 'master' | 'user'
): { blobUrl: string; sizeMb: string } | null {
  return cachedExeBlobUrls[edition];
}

export async function prepareAndroidApkBlobUrl(
  edition: 'master' | 'user'
): Promise<{ blobUrl: string; sizeMb: string } | null> {
  if (typeof window === 'undefined') return null;
  if (cachedApkBlobUrls[edition]) {
    return cachedApkBlobUrls[edition];
  }
  if (inFlightApkPromises[edition]) {
    return inFlightApkPromises[edition];
  }

  const promise = (async () => {
    try {
      const bases = getCandidateServerBases();

      // 1. Try fast binary stream (/api/android/apk-binary) across candidate bases
      for (const base of bases) {
        try {
          const url = `${base}/api/android/apk-binary?edition=${edition}&v=${Date.now()}`;
          const binResp = await fetch(url, {
            method: 'GET',
            mode: base === '' ? 'same-origin' : 'cors',
            cache: 'no-store',
          });
          if (binResp.ok) {
            const ab = await binResp.arrayBuffer();
            if (ab && ab.byteLength > 100000) {
              const blob = new Blob([ab], { type: 'application/vnd.android.package-archive' });
              const blobUrl = URL.createObjectURL(blob);
              const sizeMb = (ab.byteLength / (1024 * 1024)).toFixed(2);
              cachedApkBlobUrls[edition] = { blobUrl, sizeMb };
              window.dispatchEvent(
                new CustomEvent('eswa-apk-blob-ready', {
                  detail: { edition, blobUrl, sizeMb },
                })
              );
              return cachedApkBlobUrls[edition];
            }
          }
        } catch {
          // Try next base
        }
      }

      // 2. Try JSON Base64 bundle (/api/android/apk-bundle) across candidate bases
      for (const base of bases) {
        try {
          const url = `${base}/api/android/apk-bundle?edition=${edition}&v=${Date.now()}`;
          const resp = await fetch(url, {
            method: 'GET',
            mode: base === '' ? 'same-origin' : 'cors',
            cache: 'no-store',
          });
          if (!resp.ok) continue;
          const data = (await resp.json()) as {
            ok?: boolean;
            fileName?: string;
            sizeBytes?: number;
            base64?: string;
          };
          if (!data?.ok || !data.base64) continue;
          const bytes = base64ToUint8Array(data.base64);
          const blob = new Blob([bytes.buffer as ArrayBuffer], {
            type: 'application/vnd.android.package-archive',
          });
          const blobUrl = URL.createObjectURL(blob);
          const sizeMb = (bytes.byteLength / (1024 * 1024)).toFixed(2);
          cachedApkBlobUrls[edition] = { blobUrl, sizeMb };
          window.dispatchEvent(
            new CustomEvent('eswa-apk-blob-ready', {
              detail: { edition, blobUrl, sizeMb },
            })
          );
          return cachedApkBlobUrls[edition];
        } catch {
          // Try next base
        }
      }
      return null;
    } finally {
      inFlightApkPromises[edition] = null;
    }
  })();

  inFlightApkPromises[edition] = promise;
  return promise;
}

export async function prepareWindowsExeBlobUrl(
  _edition: 'master' | 'user'
): Promise<{ blobUrl: string; sizeMb: string } | null> {
  return null;
}

function triggerBrowserAnchorDownload(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {
      // Ignore
    }
  }, 500);
}

async function triggerAuthenticatedApkDownload(
  edition: 'master' | 'user',
  fileName: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // If already cached in memory, trigger 0ms synchronous download!
    const existing = cachedApkBlobUrls[edition];
    if (existing) {
      triggerBrowserAnchorDownload(existing.blobUrl, fileName);
      window.dispatchEvent(
        new CustomEvent('eswa-binary-download-status', {
          detail: {
            status: 'completed',
            fileName,
            sizeMb: existing.sizeMb,
            blobUrl: existing.blobUrl,
          },
        })
      );
      return;
    }

    window.dispatchEvent(
      new CustomEvent('eswa-binary-download-status', {
        detail: { status: 'downloading', fileName },
      })
    );

    const prepared = await prepareAndroidApkBlobUrl(edition);
    if (prepared) {
      triggerBrowserAnchorDownload(prepared.blobUrl, fileName);
      window.dispatchEvent(
        new CustomEvent('eswa-binary-download-status', {
          detail: {
            status: 'completed',
            fileName,
            sizeMb: prepared.sizeMb,
            blobUrl: prepared.blobUrl,
          },
        })
      );
      return;
    }
  } catch {
    // Fall through to direct .apk path
  }

  const base =
    window.location.origin.startsWith('http://') ||
    window.location.origin.startsWith('https://')
      ? ''
      : DEV_CLOUD_APP_ORIGIN;
  const fallbackDirectPath =
    edition === 'master'
      ? `${base}/api/android/download-master-apk?v=${Date.now()}`
      : `${base}/api/android/download-apk?v=${Date.now()}`;

  triggerBrowserAnchorDownload(fallbackDirectPath, fileName);
  window.dispatchEvent(
    new CustomEvent('eswa-binary-download-status', {
      detail: {
        status: 'completed',
        fileName,
        blobUrl: fallbackDirectPath,
      },
    })
  );
}

/**
 * Directly opens/downloads the real ~80 MB GitHub Actions Windows .EXE installer
 * (AKASH-TUNNEL-MAPPER-User-Setup.exe or AKASH-TUNNEL-MAPPER-Master-Setup.exe)
 * from GitHub Releases (or notifies the UI if the GitHub repository slug needs to be entered).
 */
function triggerGithubActionsExeDownload(
  edition: 'master' | 'user',
  customRepo?: string
): void {
  if (typeof window === 'undefined') return;
  const repo =
    normalizeGithubRepoSlug(customRepo || '') || getConfiguredGithubRepo();
  const exeFileName =
    edition === 'master'
      ? 'AKASH-TUNNEL-MAPPER-Master-Setup.exe'
      : 'AKASH-TUNNEL-MAPPER-User-Setup.exe';

  if (!repo) {
    window.dispatchEvent(
      new CustomEvent('eswa-github-repo-needed', {
        detail: { edition, fileName: exeFileName },
      })
    );
    return;
  }

  const directReleaseExeUrl = `https://github.com/${repo}/releases/download/latest/${exeFileName}`;

  const win = window as unknown as {
    akashDesktop?: { openExternalUrl?: (url: string) => Promise<unknown> };
    eswaDesktop?: { openExternalUrl?: (url: string) => Promise<unknown> };
  };
  const openExt =
    win.akashDesktop?.openExternalUrl || win.eswaDesktop?.openExternalUrl;
  if (openExt) {
    void openExt(directReleaseExeUrl);
  } else {
    const a = document.createElement('a');
    a.href = directReleaseExeUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = exeFileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {
        // Ignore
      }
    }, 500);
  }

  window.dispatchEvent(
    new CustomEvent('eswa-binary-download-status', {
      detail: {
        status: 'completed',
        fileName: exeFileName,
        sizeMb: '~80',
        blobUrl: directReleaseExeUrl,
      },
    })
  );
}

/**
 * Downloads the direct GitHub Actions workflow file (.github/workflows/build-installer.yml)
 * that builds AKASH-TUNNEL-MAPPER-User-Setup.exe and AKASH-TUNNEL-MAPPER-Master-Setup.exe.
 */
export function downloadGithubActionsExeWorkflowYml() {
  if (typeof window === 'undefined') return;
  const base =
    window.location.origin.startsWith('http://') ||
    window.location.origin.startsWith('https://')
      ? ''
      : DEV_CLOUD_APP_ORIGIN;
  triggerBrowserAnchorDownload(
    `${base}/api/github/workflow-yml?v=${Date.now()}`,
    'build-installer.yml'
  );
}

/**
 * Triggers direct download of the standalone signed Master Android App (.APK) binary package
 * (ESWA-TUNNEL-MAPPER-Master-Android.apk) with built-in Software Access Control.
 */
export function downloadMasterAndroidApk(customFileName?: string) {
  const fileName = customFileName || 'ESWA-TUNNEL-MAPPER-Master-Android.apk';
  void triggerAuthenticatedApkDownload('master', fileName);
}

/**
 * Triggers direct download of the standalone signed User Android App (.APK) binary package
 * (ESWA-TUNNEL-MAPPER-User-Android.apk).
 */
export function downloadUserAndroidApk(customFileName?: string) {
  const fileName = customFileName || 'ESWA-TUNNEL-MAPPER-User-Android.apk';
  void triggerAuthenticatedApkDownload('user', fileName);
}

/**
 * Triggers direct download of the GitHub Actions User Windows .EXE file
 * (AKASH-TUNNEL-MAPPER-User-Setup.exe — ~80 MB Electron Windows Executable).
 */
export function downloadUserEditionDesktopExe(customRepo?: string) {
  triggerGithubActionsExeDownload('user', customRepo);
}

/**
 * Triggers direct download of the GitHub Actions Master Windows .EXE file
 * (AKASH-TUNNEL-MAPPER-Master-Setup.exe — ~80 MB Electron Windows Executable for Owner).
 */
export function downloadMasterEditionDesktopExe(customRepo?: string) {
  triggerGithubActionsExeDownload('master', customRepo);
}

/**
 * Triggers download of the GitHub Actions Windows PC .exe application.
 */
export function downloadWindowsDesktopExe(customRepo?: string) {
  triggerGithubActionsExeDownload('user', customRepo);
}

/**
 * Generates and downloads a one-click Windows 10/11 Desktop Shortcut & App Mode Setup Installer (.bat)
 */
export function downloadWindowsInstallerBatchScript(appUrl?: string) {
  const targetUrl = appUrl || window.location.origin;
  const batLines = [
    '@echo off',
    'title Akash Tunnel Joint Tracer - Windows PC Desktop Setup',
    'color 0B',
    'echo ============================================================================',
    'echo   AKASH TUNNEL JOINT TRACER - WINDOWS PC DESKTOP INSTALLER',
    'echo   Underground Geological Mapping, Overbreak/Undercut ^& 3D Orientation Suite',
    'echo ============================================================================',
    'echo.',
    `set "APP_URL=${targetUrl}"`,
    'set "SHORTCUT_NAME=Akash Tunnel Joint Tracer"',
    'echo [1/3] Creating Windows Desktop Shortcut...',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath(\'Desktop\') + \'\\Akash Tunnel Joint Tracer.lnk\'); $s.TargetPath = \'msedge.exe\'; $s.Arguments = \'--app=%APP_URL% --start-maximized\'; $s.Description = \'Akash Tunnel Joint Tracer PC Engineering Suite\'; $s.IconLocation = \'msedge.exe,0\'; $s.Save()"',
    'echo [2/3] Creating Windows Start Menu Program Entry...',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath(\'Programs\') + \'\\Akash Tunnel Joint Tracer.lnk\'); $s.TargetPath = \'msedge.exe\'; $s.Arguments = \'--app=%APP_URL% --start-maximized\'; $s.Description = \'Akash Tunnel Joint Tracer PC Engineering Suite\'; $s.IconLocation = \'msedge.exe,0\'; $s.Save()"',
    'echo [3/3] Launching Akash Tunnel Joint Tracer in Native Windows Desktop Window...',
    'start "" msedge.exe --app=%APP_URL% --start-maximized',
    'echo.',
    'echo Installation Complete! A shortcut has been placed on your Windows Desktop.',
    'timeout /t 4 >nul',
    'exit',
  ];
  const content = batLines.join('\r\n');
  const blob = new Blob([content], { type: 'application/x-bat;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Install_Akash_Tunnel_Mapper_PC.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
