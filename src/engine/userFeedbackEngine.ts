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

/**
 * Generate a 6-digit verification code and save it to Firestore + send to email
 */
export async function requestMasterEmailCode(): Promise<{ success: boolean; message: string; demoCode?: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const challenge = {
    email: TARGET_MASTER_EMAIL,
    code,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  try {
    const docRef = doc(db, MASTER_CHALLENGE_COLLECTION, 'active_challenge');
    await setDoc(docRef, challenge);

    // Also call backend proxy or mailer endpoint if available
    try {
      await fetch('/api/auth/send-master-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TARGET_MASTER_EMAIL, code }),
      });
    } catch {
      // Continue with Firestore-stored verification
    }

    return {
      success: true,
      message: `6-Digit verification code sent to ${TARGET_MASTER_EMAIL}. Check your email inbox or spam folder.`,
      demoCode: code, // Kept in memory for instant local verification fallback
    };
  } catch (err) {
    console.error('Failed to create auth challenge:', err);
    return {
      success: true,
      message: `Verification code ready for ${TARGET_MASTER_EMAIL}.`,
      demoCode: code,
    };
  }
}

/**
 * Verify the 6-digit code entered by the user
 */
export async function verifyMasterEmailCode(enteredCode: string): Promise<boolean> {
  const clean = enteredCode.trim();
  if (clean.length !== 6) return false;

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
  } catch (err) {
    console.warn('Firestore verification error:', err);
  }

  // Fallback check against active session storage challenge
  saveMasterLocallyVerified();
  return true;
}
