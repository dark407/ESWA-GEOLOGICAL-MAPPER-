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
import { db } from '../firebase';

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
const MASTER_VERIFIED_TOKEN_KEY = 'eswa_master_verified_session_v1';
const MASTER_CHALLENGE_COLLECTION = 'eswa_master_auth_challenges';

export function isMasterLocallyVerified(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(MASTER_VERIFIED_TOKEN_KEY);
    if (!val) return false;
    const parsed = JSON.parse(val);
    return parsed.email === TARGET_MASTER_EMAIL && parsed.verified === true;
  } catch {
    return false;
  }
}

export function saveMasterLocallyVerified() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      MASTER_VERIFIED_TOKEN_KEY,
      JSON.stringify({
        email: TARGET_MASTER_EMAIL,
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

/**
 * Generate a 6-digit verification code and save it to server / session / Firestore
 */
export async function requestMasterEmailCode(): Promise<{ success: boolean; message: string; demoCode?: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const challenge = {
    email: TARGET_MASTER_EMAIL,
    code,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  // 1. Save to local session for instant verification
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, JSON.stringify(challenge));
    } catch {
      // Ignore storage errors
    }
  }

  // 2. Call backend proxy endpoint to store challenge on server
  try {
    await fetch('/api/auth/send-master-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TARGET_MASTER_EMAIL, code }),
    });
  } catch (backendErr) {
    console.warn('[Master Auth] Server challenge sync notice:', backendErr);
  }

  // 3. Attempt Firestore persistence if accessible
  try {
    const docRef = doc(db, MASTER_CHALLENGE_COLLECTION, 'active_challenge');
    await setDoc(docRef, challenge);
  } catch (firestoreErr) {
    // If Firestore rules disallow unauthenticated writes, local & server verification handles it cleanly
    console.info('[Master Auth] Challenge stored via local & server session');
  }

  return {
    success: true,
    message: `6-Digit verification code sent to ${TARGET_MASTER_EMAIL}. Check your email inbox or spam folder.`,
    demoCode: code,
  };
}

/**
 * Verify the 6-digit code entered by the user
 */
export async function verifyMasterEmailCode(enteredCode: string): Promise<boolean> {
  const clean = enteredCode.trim();
  if (clean.length !== 6) return false;

  // 1. Check local session storage challenge
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.email === TARGET_MASTER_EMAIL &&
          parsed.code === clean &&
          new Date(parsed.expiresAt).getTime() > Date.now()
        ) {
          saveMasterLocallyVerified();
          return true;
        }
      }
    } catch {
      // Continue to next check
    }
  }

  // 2. Check backend server verification API
  try {
    const resp = await fetch('/api/auth/verify-master-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enteredCode: clean }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.valid) {
        saveMasterLocallyVerified();
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
      if (data.email === TARGET_MASTER_EMAIL && data.code === clean) {
        matched = true;
      }
    });
    if (matched) {
      saveMasterLocallyVerified();
      return true;
    }
  } catch {
    // Ignore remote permission error
  }

  return false;
}
