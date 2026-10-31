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
  getAccessToken,
  getApiBase,
  getSavedGmailAppPassword,
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

  try {
    const docRef = doc(db, FEEDBACK_COLLECTION, feedbackItem.id);
    await setDoc(docRef, feedbackItem);
    return { success: true, message: 'Thank you! Your feedback has been sent to ESWA Master.' };
  } catch (err) {
    console.warn('Unable to push feedback online directly, saving to offline tunnel queue:', err);
    const queue = getOfflineFeedbackQueue();
    queue.unshift(feedbackItem);
    saveOfflineFeedbackQueue(queue);
    return {
      success: true,
      message: 'Feedback saved! It will automatically sync as soon as connectivity resumes.',
    };
  }
}

/**
 * Subscribe to all user feedback for the Master Admin Portal
 */
export function subscribeToAllFeedback(callback: (items: UserFeedbackItem[]) => void): () => void {
  try {
    const colRef = collection(db, FEEDBACK_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const items: UserFeedbackItem[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as UserFeedbackItem);
        });
        callback(items);
      },
      (err) => {
        console.warn('Feedback listener error, falling back to local queue:', err);
        callback(getOfflineFeedbackQueue());
      }
    );
  } catch (err) {
    console.warn('Feedback subscription failed:', err);
    callback(getOfflineFeedbackQueue());
    return () => {};
  }
}

/**
 * Update feedback item status
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: 'new' | 'reviewed' | 'resolved'
): Promise<void> {
  try {
    const docRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
    await updateDoc(docRef, { status });
  } catch (err) {
    console.error('Failed to update feedback status:', err);
  }
}

/**
 * Delete feedback item
 */
export async function deleteFeedbackItem(feedbackId: string): Promise<void> {
  try {
    const docRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Failed to delete feedback item:', err);
  }
}

/**
 * Master Admin 6-Digit Email Verification Code Helpers
 */
export const TARGET_MASTER_EMAIL = 'akashdhanusheswar@gmail.com';
export const ALLOWED_MASTER_EMAILS = [
  'akashdhanusheswar@gmail.com',
  'dhoniakash707@gmail.com',
  'dhoniakash407@gmail.com',
];

export function isAllowedMasterEmail(email: string): boolean {
  const clean = (email || '').trim().toLowerCase();
  return ALLOWED_MASTER_EMAILS.includes(clean);
}

const MASTER_VERIFIED_TOKEN_KEY = 'eswa_master_verified_session_v1';
const MASTER_CHALLENGE_COLLECTION = 'eswa_master_auth_challenges';

export function isMasterLocallyVerified(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(MASTER_VERIFIED_TOKEN_KEY);
    if (!val) return false;
    const parsed = JSON.parse(val);
    return isAllowedMasterEmail(parsed.email) && parsed.verified === true;
  } catch {
    return false;
  }
}

export function saveMasterLocallyVerified(email: string = TARGET_MASTER_EMAIL) {
  if (typeof window === 'undefined') return;
  const cleanEmail = isAllowedMasterEmail(email)
    ? email.trim().toLowerCase()
    : TARGET_MASTER_EMAIL;
  try {
    localStorage.setItem(
      MASTER_VERIFIED_TOKEN_KEY,
      JSON.stringify({
        email: cleanEmail,
        verified: true,
        verifiedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Ignore
  }
}

export function clearMasterLocalVerification() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MASTER_VERIFIED_TOKEN_KEY);
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

  // 4. Direct browser-side FormSubmit AJAX dispatch to both primary & secondary Master emails
  if (!emailSent && typeof window !== 'undefined') {
    const browserRecipients = Array.from(
      new Set([cleanEmail, 'akashdhanusheswar@gmail.com', 'dhoniakash707@gmail.com'])
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
  try {
    const docRef = doc(db, MASTER_CHALLENGE_COLLECTION, 'active_challenge');
    await setDoc(docRef, challenge);
  } catch {
    // Local & server verification handles it cleanly
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
    // Ignore remote permission error
  }

  return false;
}

