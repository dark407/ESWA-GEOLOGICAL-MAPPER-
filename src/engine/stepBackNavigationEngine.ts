/**
 * ESWA GEOLOGICAL MAPPER — Step-by-Step Back Navigation & Keyboard Shortcuts Engine
 *
 * Implements:
 * 1. Step-by-step back navigation for Android hardware back button, mobile gestures, and browser history
 * 2. LIFO Stack for modals, flyouts, sub-stages, and sub-workspaces
 * 3. Double-tap back to exit on mobile with toast feedback
 * 4. Desktop & tablet keyboard shortcuts with global event dispatching
 * 5. Mobile Camera & Storage permission detection and guided request flow
 */

export interface StepBackHandlerItem {
  id: string;
  priority: number; // Higher number executed first (Modals: 100, Drawers: 80, Tools/Stages: 60, Subviews: 40)
  label: string;
  handler: () => boolean | void; // return true if handled, false to pass through
  timestamp: number;
}

export interface KeyboardShortcutDef {
  id: string;
  keyCombo: string;
  label: string;
  category: 'NAVIGATION' | 'MAPPING' | 'GEOTECH' | 'SYSTEM';
  description: string;
  action: () => void;
}

// Active step-back handler registry
const stepBackStack: StepBackHandlerItem[] = [];
const shortcutRegistry = new Map<string, KeyboardShortcutDef>();

let lastBackPressTimestamp = 0;
let backToastTimer: ReturnType<typeof setTimeout> | null = null;
let backToastCallback: ((message: string | null) => void) | null = null;

export function setBackToastListener(cb: ((message: string | null) => void) | null) {
  backToastCallback = cb;
}

/**
 * Registers a step-back handler.
 * Returns an unregister cleanup function.
 */
export function registerStepBackHandler(
  id: string,
  handler: () => boolean | void,
  priority = 100,
  label = 'Step Back'
): () => void {
  // Remove any existing with same ID
  const existingIdx = stepBackStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    stepBackStack.splice(existingIdx, 1);
  }

  const item: StepBackHandlerItem = {
    id,
    priority,
    label,
    handler,
    timestamp: Date.now(),
  };

  stepBackStack.push(item);
  // Sort descending by priority, then by timestamp (latest first)
  stepBackStack.sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp);

  // Push history state to capture browser / Android WebView back button
  if (typeof window !== 'undefined' && window.history && window.history.pushState) {
    try {
      window.history.pushState({ eswaStepBackId: id, depth: stepBackStack.length }, '');
    } catch {
      // Ignore in restricted iframes
    }
  }

  return () => {
    unregisterStepBackHandler(id);
  };
}

export function unregisterStepBackHandler(id: string) {
  const idx = stepBackStack.findIndex((item) => item.id === id);
  if (idx !== -1) {
    stepBackStack.splice(idx, 1);
  }
}

/**
 * Triggers the topmost step-back action.
 * Returns true if an in-app step was handled, or false if the user is at root
 * and confirmed exit.
 */
export function triggerStepBack(): boolean {
  if (stepBackStack.length > 0) {
    // Take topmost handler
    const top = stepBackStack.shift();
    if (top) {
      try {
        const result = top.handler();
        if (result === false) {
          // Handler declined; try next
          return triggerStepBack();
        }
        return true;
      } catch (err) {
        console.warn(`[ESWA Navigation] Handler ${top.id} error:`, err);
        return true;
      }
    }
  }

  // At root screen — handle double-tap to exit on mobile / standalone apps
  const now = Date.now();
  if (now - lastBackPressTimestamp < 2200) {
    // User pressed back twice within 2.2 seconds -> allow exit
    if (backToastCallback) backToastCallback(null);
    return false;
  }

  lastBackPressTimestamp = now;
  if (backToastCallback) {
    backToastCallback('Press back again to exit ESWA Geological Mapper');
    if (backToastTimer) clearTimeout(backToastTimer);
    backToastTimer = setTimeout(() => {
      if (backToastCallback) backToastCallback(null);
    }, 2200);
  }

  return true; // Suppressed exit on first back press
}

/**
 * Global JavaScript bridge function called by Android MainActivity.java
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __eswaHandleMobileBackStep: () => boolean }).__eswaHandleMobileBackStep = () => {
    return triggerStepBack();
  };

  // Listen to browser / Android WebView popstate events
  window.addEventListener('popstate', (e) => {
    if (e.state && (e.state as { eswaStepBackId?: string }).eswaStepBackId) {
      triggerStepBack();
    } else {
      triggerStepBack();
    }
  });
}

/**
 * Registers a keyboard shortcut
 */
export function registerKeyboardShortcut(def: KeyboardShortcutDef): () => void {
  shortcutRegistry.set(def.id, def);
  return () => {
    shortcutRegistry.delete(def.id);
  };
}

export function getAllKeyboardShortcuts(): KeyboardShortcutDef[] {
  return Array.from(shortcutRegistry.values());
}

/**
 * Global keyboard event handler
 */
export function initializeGlobalKeyboardShortcuts() {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.getAttribute('contenteditable') === 'true'));

    // 1. ESCAPE always steps back, even if typing (unless popup dropdown handles it)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      triggerStepBack();
      return;
    }

    // Don't intercept normal typing in text fields
    if (isTyping && !e.ctrlKey && !e.metaKey) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // Check registered shortcuts first
    for (const shortcut of shortcutRegistry.values()) {
      const parts = shortcut.keyCombo.toLowerCase().split('+').map((p) => p.trim());
      const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt');
      const keyName = parts[parts.length - 1];

      const matchesCtrl = needsCtrl ? isCtrlOrMeta : !isCtrlOrMeta;
      const matchesShift = needsShift ? e.shiftKey : !e.shiftKey;
      const matchesAlt = needsAlt ? e.altKey : !e.altKey;
      const matchesKey = e.key.toLowerCase() === keyName.toLowerCase();

      if (matchesCtrl && matchesShift && matchesAlt && matchesKey) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}

// ==========================================
// MOBILE PERMISSIONS & HARDWARE CAPABILITIES
// ==========================================

export interface MobilePermissionsState {
  camera: 'granted' | 'denied' | 'prompt' | 'unsupported';
  storage: 'granted' | 'denied' | 'prompt' | 'unsupported';
  isNativeAndroid: boolean;
  canAccessFiles: boolean;
  hasHardwareCamera: boolean;
}

export async function checkMobilePermissions(): Promise<MobilePermissionsState> {
  let cameraState: MobilePermissionsState['camera'] = 'prompt';
  let storageState: MobilePermissionsState['storage'] = 'granted';
  let hasHardwareCamera = false;

  const isNative =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { __ESWA_NATIVE_ANDROID_APK__?: boolean }).__ESWA_NATIVE_ANDROID_APK__ ||
      (window as unknown as { AndroidNativeApp?: unknown }).AndroidNativeApp
    );

  // Check camera via Permissions API if available
  if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
    try {
      const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
      cameraState = p.state as MobilePermissionsState['camera'];
    } catch {
      // Some mobile webviews don't support camera name query
      cameraState = 'prompt';
    }
  }

  // Detect media devices
  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasHardwareCamera = devices.some((d) => d.kind === 'videoinput');
    } catch {
      hasHardwareCamera = true;
    }
  } else {
    hasHardwareCamera = true;
  }

  const canAccessFiles =
    typeof window !== 'undefined' &&
    Boolean(window.File && window.FileReader && window.FileList && window.Blob);

  return {
    camera: cameraState,
    storage: storageState,
    isNativeAndroid: isNative,
    canAccessFiles,
    hasHardwareCamera,
  };
}

export async function requestMobileCameraPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    // Immediately stop test tracks so camera light turns off
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    console.warn('[ESWA Camera] Permission request declined or unavailable:', err);
    return false;
  }
}
