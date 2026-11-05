import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  db,
  firestoreCloudPermissionDenied,
  getAccessToken,
  getApiBase,
  getSavedGmailAppPassword,
  markFirestoreCloudPermissionDenied,
  saveGmailAppPassword,
  sendGmailMessage,
} from '../firebase';

export interface UserFeedbackItem {
  id: string;
  userName: string;
  userEmail?: string;
  deviceId?: string;
  industryMode?: string;
  message: string;
  photoUrl?: string; // Base64 data URL or cloud image URL
  createdAt: string;
  status: 'new' | 'reviewed' | 'resolved';
}

const LOCAL_FEEDBACK_QUEUE_KEY = 'eswa_offline_feedback_queue_v1';
const FEEDBACK_COLLECTION = 'eswa_user_feedback';

export function getOfflineFeedbackQueue(): UserFeedbackItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineFeedbackQueue(items: UserFeedbackItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_FEEDBACK_QUEUE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('eswa-feedback-queue-updated'));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Submit feedback from the user application
 */
export async function submitUserFeedback(data: {
  userName: string;
  userEmail?: string;
  deviceId?: string;
  industryMode?: string;
  message: string;
  photoUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  const feedbackItem: UserFeedbackItem = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userName: data.userName.trim() || 'Field Geologist',
    userEmail: data.userEmail?.trim() || '',
    deviceId: data.deviceId || 'UNKNOWN_DEVICE',
    industryMode: data.industryMode || 'NATM',
    message: data.message.trim(),
    photoUrl: data.photoUrl || '',
    createdAt: new Date().toISOString(),
    status: 'new',
  };

  const queue = getOfflineFeedbackQueue();
  queue.unshift(feedbackItem);
  saveOfflineFeedbackQueue(queue);

  if (!firestoreCloudPermissionDenied) {
    try {
      const docRef = doc(db, FEEDBACK_COLLECTION, feedbackItem.id);
      await setDoc(docRef, feedbackItem);
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }
  return { success: true, message: 'Thank you! Your feedback has been sent to ESWA Master.' };
}

/**
 * Subscribe to all user feedback for the Master Admin Portal
 */
export function subscribeToAllFeedback(callback: (items: UserFeedbackItem[]) => void): () => void {
  const emitLocal = () => {
    callback(getOfflineFeedbackQueue());
  };
  emitLocal();

  const onLocalUpdate = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('eswa-feedback-queue-updated', onLocalUpdate);
    window.addEventListener('storage', onLocalUpdate);
  }

  let unsubFirestore = () => {};
  if (!firestoreCloudPermissionDenied) {
    try {
      const colRef = collection(db, FEEDBACK_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const items: UserFeedbackItem[] = [];
          snapshot.forEach((d) => {
            items.push(d.data() as UserFeedbackItem);
          });
          if (items.length > 0) {
            callback(items);
          } else {
            emitLocal();
          }
        },
        () => {
          markFirestoreCloudPermissionDenied();
          emitLocal();
        }
      );
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('eswa-feedback-queue-updated', onLocalUpdate);
      window.removeEventListener('storage', onLocalUpdate);
    }
    try {
      unsubFirestore();
    } catch {
      // Ignore
    }
  };
}

/**
 * Update feedback item status
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'new' | 'reviewed' | 'resolved'
): Promise<void> {
  const queue = getOfflineFeedbackQueue().map((item) =>
    item.id === feedbackId ? { ...item, status } : item
  );
  saveOfflineFeedbackQueue(queue);
  if (!firestoreCloudPermissionDenied) {
    try {
      const docRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
      await updateDoc(docRef, { status });
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }
}

/**
 * Delete feedback item
 */
export async function deleteFeedbackItem(feedbackId: string): Promise<void> {
  const queue = getOfflineFeedbackQueue().filter((item) => item.id !== feedbackId);
  saveOfflineFeedbackQueue(queue);
  if (!firestoreCloudPermissionDenied) {
    try {
      const docRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
      await deleteDoc(docRef);
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }
}

/**
 * Master Admin Direct Gmail + Fixed Password Authentication Helpers (No OTP)
 */
export const TARGET_MASTER_EMAIL = 'akashdhanusheswar@gmail.com';
export const MASTER_FIXED_PASSWORD = 'Akash11052003';
export const ALLOWED_MASTER_EMAILS = [
  'akashdhanusheswar@gmail.com',
  'dhoniakash707@gmail.com',
  'dhoniakash407@gmail.com',
];

export function isAllowedMasterEmail(email: string): boolean {
  const clean = (email || '').trim().toLowerCase();
  return ALLOWED_MASTER_EMAILS.includes(clean);
}

export function verifyMasterFixedCredentials(
  emailInput: string,
  passwordInput: string
): boolean {
  const cleanEmail = (emailInput || '').trim().toLowerCase();
  const cleanPass = (passwordInput || '').trim();
  if (!isAllowedMasterEmail(cleanEmail)) {
    return false;
  }
  if (cleanPass !== MASTER_FIXED_PASSWORD) {
    return false;
  }
  saveMasterLocallyVerified(cleanEmail);
  return true;
}

const LEGACY_OTP_VERIFIED_KEY = 'eswa_master_verified_session_v1';
const MASTER_VERIFIED_TOKEN_KEY = 'eswa_master_fixed_pass_verified_v4';
const MASTER_CHALLENGE_COLLECTION = 'eswa_master_auth_challenges';

function getTodayDateKey(): string {
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isMasterLocallyVerified(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(LEGACY_OTP_VERIFIED_KEY);
    const val =
      localStorage.getItem(MASTER_VERIFIED_TOKEN_KEY) ||
      sessionStorage.getItem(MASTER_VERIFIED_TOKEN_KEY);
    if (!val) return false;
    const parsed = JSON.parse(val);
    if (
      !isAllowedMasterEmail(parsed.email) ||
      parsed.verified !== true ||
      parsed.authMethod !== 'FIXED_PASSWORD_NO_OTP'
    ) {
      return false;
    }
    const todayKey = getTodayDateKey();
    if (parsed.verifiedDateKey === todayKey) {
      return true;
    }
    if (parsed.verifiedAt) {
      const elapsedMs = Date.now() - new Date(parsed.verifiedAt).getTime();
      if (elapsedMs >= 0 && elapsedMs < 24 * 60 * 60 * 1000 && parsed.verifiedDateKey === todayKey) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function saveMasterLocallyVerified(email: string = TARGET_MASTER_EMAIL) {
  if (typeof window === 'undefined') return;
  const cleanEmail = isAllowedMasterEmail(email)
    ? email.trim().toLowerCase()
    : TARGET_MASTER_EMAIL;
  const payload = JSON.stringify({
    email: cleanEmail,
    verified: true,
    authMethod: 'FIXED_PASSWORD_NO_OTP',
    verifiedAt: new Date().toISOString(),
    verifiedDateKey: getTodayDateKey(),
  });
  try {
    localStorage.removeItem(LEGACY_OTP_VERIFIED_KEY);
    localStorage.setItem(MASTER_VERIFIED_TOKEN_KEY, payload);
    sessionStorage.setItem(MASTER_VERIFIED_TOKEN_KEY, payload);
  } catch {
    // Ignore
  }
}

export function clearMasterLocalVerification() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_OTP_VERIFIED_KEY);
    localStorage.removeItem(MASTER_VERIFIED_TOKEN_KEY);
    sessionStorage.removeItem(MASTER_VERIFIED_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

const ACTIVE_CHALLENGE_STORAGE_KEY = 'eswa_active_master_challenge_v1';

export function getActiveMasterChallengeCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      sessionStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY) ||
      localStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.code && new Date(parsed.expiresAt).getTime() > Date.now()) {
      return String(parsed.code);
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Generate a 6-digit verification code, save it to server / session / Firestore,
 * and dispatch it across all email channels (Gmail OAuth REST API, Gmail SMTP, Server Relay, and FormSubmit AJAX).
 */
export async function requestMasterEmailCode(
  requestedEmail: string = TARGET_MASTER_EMAIL,
  options?: {
    smtpAppPassword?: string;
    useGoogleOAuthPopup?: boolean;
    existingCode?: string;
  }
): Promise<{
  success: boolean;
  emailSent: boolean;
  method?: string;
  message: string;
  demoCode: string;
}> {
  const cleanEmail = isAllowedMasterEmail(requestedEmail)
    ? requestedEmail.trim().toLowerCase()
    : TARGET_MASTER_EMAIL;

  const code =
    options?.existingCode && /^\d{6}$/.test(options.existingCode)
      ? options.existingCode
      : Math.floor(100000 + Math.random() * 900000).toString();

  const challenge = {
    email: cleanEmail,
    code,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  if (options?.smtpAppPassword && options.smtpAppPassword.trim()) {
    saveGmailAppPassword(options.smtpAppPassword.trim());
  }

  // 1. Save to local & session storage for instant verification
  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(challenge);
      sessionStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, serialized);
      localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, serialized);
    } catch {
      // Ignore storage errors
    }
  }

  const subject = `ESWA Software Access Control — Master Login Code: ${code}`;
  const textBody = [
    'ESWA GEOLOGICAL MAPPER — SOFTWARE ACCESS CONTROL',
    '',
    `Your 6-Digit Master Verification Code is: ${code}`,
    '',
    `Requested Master Account: ${cleanEmail}`,
    'Valid for: 15 minutes',
    '',
    'Enter this 6-digit code in the ESWA Software Access Control window to unlock Master Owner access on this device.',
  ].join('\n');

  const htmlBody = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #f59e0b;">
    <h2 style="color: #fbbf24; margin-top: 0; font-size: 18px;">ESWA Software Access Control</h2>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
      Use the following 6-digit verification code to complete Master Owner login on your device:
    </p>
    <div style="background: #020617; border: 2px solid #f59e0b; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Master Verification Code</div>
      <div style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 0.35em; color: #fbbf24;">${code}</div>
    </div>
    <p style="color: #94a3b8; font-size: 12px; font-family: monospace; margin-bottom: 0;">
      Master Account: ${cleanEmail} · Expires in 15 minutes.
    </p>
  </div>`;

  let emailSent = false;
  let deliveryMethod = '';

  const savedSmtpPass = (options?.smtpAppPassword || getSavedGmailAppPassword()).trim();
  const cachedToken = await getAccessToken().catch(() => null);
  const apiBase = getApiBase();

  // 2. If user clicked "Connect Gmail & Send Code" (or has token/SMTP configured), use sendGmailMessage
  try {
    const gmailRes = await sendGmailMessage({
      to: cleanEmail,
      subject,
      textBody,
      htmlBody,
      fromEmail: cleanEmail,
      smtpAppPassword: savedSmtpPass || undefined,
      skipInteractivePopup: !options?.useGoogleOAuthPopup,
    });
    if (gmailRes.ok) {
      emailSent = true;
      deliveryMethod = gmailRes.method || 'GMAIL_DIRECT';
    }
  } catch {
    // Continue to backend & FormSubmit channels
  }

  // 3. Call backend proxy endpoint to store challenge & dispatch email from server
  try {
    const freshToken = await getAccessToken().catch(() => cachedToken);
    const srvResp = await fetch(`${apiBase}/api/auth/send-master-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        code,
        smtpAppPassword: savedSmtpPass || undefined,
        accessToken: freshToken || undefined,
      }),
    });
    if (srvResp.ok) {
      const srvData = (await srvResp.json().catch(() => ({}))) as {
        emailDelivered?: boolean;
        method?: string;
      };
      if (srvData.emailDelivered) {
        emailSent = true;
        if (!deliveryMethod) {
          deliveryMethod = srvData.method || 'SERVER_SMTP_RELAY';
        }
      }
    }
  } catch (backendErr) {
    console.warn('[Master Auth] Server challenge sync notice:', backendErr);
  }

  // 4. Direct browser-side FormSubmit AJAX dispatch to all Master emails
  if (!emailSent && typeof window !== 'undefined') {
    const browserRecipients = Array.from(
      new Set([
        cleanEmail,
        'akashdhanusheswar@gmail.com',
        'dhoniakash707@gmail.com',
        'dhoniakash407@gmail.com',
      ])
    );
    await Promise.all(
      browserRecipients.map(async (recipient) => {
        try {
          const resp = await fetch(
            `https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                _subject: subject,
                _template: 'box',
                _captcha: 'false',
                app: 'ESWA Software Access Control',
                master_account: cleanEmail,
                verification_code: code,
                message: textBody,
              }),
            }
          );
          if (resp.ok) {
            const data = (await resp.json().catch(() => ({}))) as {
              success?: string | boolean;
            };
            if (data.success === true || data.success === 'true') {
              emailSent = true;
              if (!deliveryMethod) deliveryMethod = 'BROWSER_EMAIL_RELAY';
            }
          }
        } catch {
          // Ignore browser relay error
        }
      })
    );
  }

  // 5. Trigger desktop/mobile OS system notification if permitted
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        new Notification('ESWA Master Verification Code', {
          body: `Your 6-digit Master Login Code is: ${code}`,
        });
      }
    } catch {
      // Ignore notification error
    }
  }

  // 6. Attempt Firestore persistence if accessible
  if (!firestoreCloudPermissionDenied) {
    try {
      const docRef = doc(db, MASTER_CHALLENGE_COLLECTION, 'active_challenge');
      await setDoc(docRef, challenge);
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }

  return {
    success: true,
    emailSent,
    method: deliveryMethod || 'INSTANT_MASTER_CHALLENGE',
    message: emailSent
      ? `6-Digit verification code (${code}) sent to ${cleanEmail} via ${deliveryMethod}. You can also use the instant backup code below.`
      : `6-Digit Master Verification Code generated for ${cleanEmail}. If email delivery is delayed or filtered, use the instant backup code below or connect Gmail.`,
    demoCode: code,
  };
}

/**
 * Verify the 6-digit code entered by the user
 */
export async function verifyMasterEmailCode(
  enteredCode: string,
  enteredEmail: string = TARGET_MASTER_EMAIL
): Promise<boolean> {
  const clean = enteredCode.trim();
  if (clean.length !== 6) return false;
  const cleanEmail = isAllowedMasterEmail(enteredEmail)
    ? enteredEmail.trim().toLowerCase()
    : TARGET_MASTER_EMAIL;

  // 1. Check local & session storage challenge
  if (typeof window !== 'undefined') {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const raw = store.getItem(ACTIVE_CHALLENGE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed.code === clean &&
            new Date(parsed.expiresAt).getTime() > Date.now()
          ) {
            saveMasterLocallyVerified(cleanEmail);
            return true;
          }
        }
      } catch {
        // Continue to next check
      }
    }
  }

  // 2. Check backend server verification API
  try {
    const apiBase = getApiBase();
    const resp = await fetch(`${apiBase}/api/auth/verify-master-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enteredCode: clean }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.valid) {
        saveMasterLocallyVerified(cleanEmail);
        return true;
      }
    }
  } catch {
    // Continue to Firestore check
  }

  // 3. Check Firestore collection if accessible
  if (!firestoreCloudPermissionDenied) {
    try {
      const snapshot = await getDocs(collection(db, MASTER_CHALLENGE_COLLECTION));
      let matched = false;
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.code === clean) {
          matched = true;
        }
      });
      if (matched) {
        saveMasterLocallyVerified(cleanEmail);
        return true;
      }
    } catch {
      markFirestoreCloudPermissionDenied();
    }
  }

  return false;
}

