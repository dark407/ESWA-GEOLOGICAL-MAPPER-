import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const RUNTIME_PUBLIC_ORIGIN =
  'https://ais-pre-5ptwqnfp5dwhotfkvwrapg-951690892189.asia-southeast1.run.app';

export function getApiBase(): string {
  if (typeof window === 'undefined') return RUNTIME_PUBLIC_ORIGIN;
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return '';
  }
  return RUNTIME_PUBLIC_ORIGIN;
}

const DEFAULT_FIRESTORE_DB_ID =
  'ai-studio-eswatunnelmapper-f9204c8f-e68c-461b-9014-9cb7c208d62c';
const resolvedDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  DEFAULT_FIRESTORE_DB_ID;

const app = initializeApp(firebaseConfig);

// Clean any stale legacy IndexedDB persistence from earlier SDK versions that cause
// TargetState internal assertion failures (ca9 / b815 with ve: -1).
if (typeof window !== 'undefined' && window.indexedDB) {
  try {
    const req = window.indexedDB.databases?.();
    if (req && typeof req.then === 'function') {
      req.then((dbs) => {
        dbs.forEach((dbInfo) => {
          if (
            dbInfo.name &&
            (dbInfo.name.includes('firestore') ||
              dbInfo.name.includes('firebase') ||
              dbInfo.name.includes('[DEFAULT]'))
          ) {
            try {
              window.indexedDB.deleteDatabase(dbInfo.name);
            } catch {
              // Ignore
            }
          }
        });
      }).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

// Memory local cache prevents multi-tab and iframe target corruption
// experimentalForceLongPolling guarantees stable connection through iframes and proxies
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    },
    resolvedDatabaseId
  );
  setLogLevel('silent');
} catch {
  dbInstance = getFirestore(app, resolvedDatabaseId);
}

export let firestoreCloudPermissionDenied = false;

export function markFirestoreCloudPermissionDenied(): void {
  // Never globally lock out Cloud Firestore; individual callers fall back gracefully per operation.
  firestoreCloudPermissionDenied = false;
}

if (typeof window !== 'undefined') {
  // Global catch for Firestore internal SDK assertion failures (e.g. ca9 / b815) and background permission rejections
  window.addEventListener(
    'error',
    (event) => {
      const msg = event?.message || event?.error?.message || '';
      if (
        typeof msg === 'string' &&
        (msg.includes('FIRESTORE') ||
          msg.includes('ID: ca9') ||
          msg.includes('ID: b815') ||
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Missing or insufficient permissions') ||
          msg.includes('permission-denied') ||
          msg.includes('Unexpected state'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reasonMsg =
        event?.reason?.message ||
        (typeof event?.reason === 'string' ? event.reason : '');
      if (
        typeof reasonMsg === 'string' &&
        (reasonMsg.includes('FIRESTORE') ||
          reasonMsg.includes('ID: ca9') ||
          reasonMsg.includes('ID: b815') ||
          reasonMsg.includes('INTERNAL ASSERTION FAILED') ||
          reasonMsg.includes('Missing or insufficient permissions') ||
          reasonMsg.includes('permission-denied') ||
          reasonMsg.includes('Unexpected state'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    true
  );
}

export const db = dbInstance;
export const auth = getAuth(app);

export async function testConnection(): Promise<void> {
  if (firestoreCloudPermissionDenied) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('insufficient')
    ) {
      firestoreCloudPermissionDenied = true;
    }
  }
}

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
];

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isEmbeddedWebViewOrRestrictedOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  const win = window as unknown as {
    __ESWA_NATIVE_ANDROID_APK__?: boolean;
    __ESWA_NATIVE_DESKTOP__?: boolean;
    eswaDesktop?: unknown;
    akashDesktop?: unknown;
  };
  if (
    win.__ESWA_NATIVE_ANDROID_APK__ ||
    win.__ESWA_NATIVE_DESKTOP__ ||
    win.eswaDesktop ||
    win.akashDesktop
  ) {
    return true;
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  // Android WebView ('wv' or 'Version/x.x Chrome/...') blocks Google OAuth popups with 403 disallowed_useragent
  if (/; wv\)|Android.*Version\/[0-9.]+.*Chrome\//i.test(ua) || /Electron/i.test(ua)) {
    return true;
  }
  return false;
}

const GMAIL_APP_PASS_STORAGE_KEY = 'eswa_gmail_app_password_v1';

export function getSavedGmailAppPassword(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(GMAIL_APP_PASS_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveGmailAppPassword(appPassword: string): void {
  if (typeof window === 'undefined') return;
  const clean = appPassword.replace(/\s+/g, '').trim();
  try {
    if (clean) {
      localStorage.setItem(GMAIL_APP_PASS_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(GMAIL_APP_PASS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  const apiBase = getApiBase();
  fetch(`${apiBase}/api/email/save-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smtpAppPassword: clean }),
  }).catch(() => {});
}

// In-memory cache for Google OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGisUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedGisUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedGisUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    if (isEmbeddedWebViewOrRestrictedOrigin()) {
      return null;
    }

    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    cachedGisUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.warn('Google popup sign-in error:', error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch {
    // Ignore
  }
  cachedAccessToken = null;
  cachedGisUser = null;
};

function encodeBase64UrlUtf8(raw: string): string {
  const utf8Bytes = new TextEncoder().encode(raw);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds a direct Gmail Web Compose URL (mail.google.com) pre-filled with recipient, subject, and body.
 * Works on any browser where the owner is signed into Gmail without needing OAuth popups.
 */
export function buildGmailWebComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
  authUserEmail?: string;
}): string {
  const u = new URL('https://mail.google.com/mail/');
  u.searchParams.set('view', 'cm');
  u.searchParams.set('fs', '1');
  u.searchParams.set('to', params.to.trim());
  u.searchParams.set('su', params.subject);
  u.searchParams.set('body', params.body);
  if (params.authUserEmail) {
    u.searchParams.set('authuser', params.authUserEmail.trim());
  }
  return u.toString();
}

export function buildMailtoUrl(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  return `mailto:${encodeURIComponent(params.to.trim())}?subject=${encodeURIComponent(
    params.subject
  )}&body=${encodeURIComponent(params.body)}`;
}

export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  fromEmail?: string;
  smtpAppPassword?: string;
  skipInteractivePopup?: boolean;
}): Promise<{
  ok: boolean;
  messageId?: string;
  method?: string;
  error?: string;
  gmailComposeUrl?: string;
}> {
  const cleanTo = params.to.trim();
  if (!cleanTo || !cleanTo.includes('@')) {
    return { ok: false, error: 'Recipient email address is invalid.' };
  }

  const senderEmail =
    params.fromEmail ||
    cachedGisUser?.email ||
    auth.currentUser?.email ||
    'akashdhanusheswar@gmail.com';
  const gmailComposeUrl = buildGmailWebComposeUrl({
    to: cleanTo,
    subject: params.subject,
    body: params.textBody,
    authUserEmail: senderEmail,
  });

  // 1. Check if we have a saved Gmail App Password or server SMTP route (/api/email/send-notification)
  const savedAppPass = (params.smtpAppPassword || getSavedGmailAppPassword()).trim();
  let token = await getAccessToken();

  const apiBase = getApiBase();

  if (savedAppPass || token) {
    try {
      const srvResp = await fetch(`${apiBase}/api/email/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: cleanTo,
          subject: params.subject,
          textBody: params.textBody,
          htmlBody: params.htmlBody,
          fromEmail: senderEmail,
          smtpAppPassword: savedAppPass || undefined,
          accessToken: token || undefined,
        }),
      });
      if (srvResp.ok) {
        const srvData = (await srvResp.json()) as {
          ok?: boolean;
          messageId?: string;
          method?: string;
        };
        if (srvData.ok) {
          return {
            ok: true,
            messageId: srvData.messageId,
            method: srvData.method || 'SERVER_AUTO_MAIL',
            gmailComposeUrl,
          };
        }
      }
    } catch {
      // Fall through to direct client-side Gmail REST API
    }
  }

  // 2. If no token yet and interactive popup is allowed, try GIS OAuth token client
  if (!token && !params.skipInteractivePopup) {
    try {
      const signInRes = await googleSignIn();
      token = signInRes?.accessToken || null;
    } catch (err: unknown) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Google Sign-In required to send email via Gmail.',
        gmailComposeUrl,
      };
    }
  }

  if (!token) {
    return {
      ok: false,
      error: 'Gmail not connected yet.',
      gmailComposeUrl,
    };
  }

  const boundary = `eswa_mail_boundary_${Date.now()}`;
  const encodedSubject = `=?UTF-8?B?${btoa(
    Array.from(new TextEncoder().encode(params.subject), (b) =>
      String.fromCharCode(b)
    ).join('')
  )}?=`;

  const mimeLines = [
    `From: "ESWA Tunnel Mapper" <${senderEmail}>`,
    `To: ${cleanTo}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.textBody,
    '',
  ];

  if (params.htmlBody) {
    mimeLines.push(
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.htmlBody,
      ''
    );
  }

  mimeLines.push(`--${boundary}--`, '');

  const rawEncoded = encodeBase64UrlUtf8(mimeLines.join('\r\n'));

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEncoded }),
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      cachedAccessToken = null;
    }
    const errJson = await response.json().catch(() => ({}));
    const apiErrMsg =
      (errJson as { error?: { message?: string } })?.error?.message ||
      `Gmail API error (${response.status})`;
    return { ok: false, error: apiErrMsg, gmailComposeUrl };
  }

  const data = (await response.json()) as { id?: string };
  return { ok: true, messageId: data.id, method: 'GMAIL_REST_API', gmailComposeUrl };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  if (
    errMsg.toLowerCase().includes('permission') ||
    errMsg.toLowerCase().includes('insufficient')
  ) {
    firestoreCloudPermissionDenied = true;
  }
  throw new Error(JSON.stringify(errInfo));
}
