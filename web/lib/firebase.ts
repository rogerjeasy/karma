import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import { useEffect, useState } from "react";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey);

let _app:  FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!isConfigured) {
    throw new Error("Firebase is not configured — NEXT_PUBLIC_FIREBASE_* env vars are missing.");
  }
  if (!_app)  _app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  if (!_auth) _auth = getAuth(_app);
  return _auth;
}

// ── Google sign-in ────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // Try popup first; fall back to redirect if popups are blocked.
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user") {
      // Redirect flow: page navigates away; call checkGoogleRedirect() on return.
      await signInWithRedirect(auth, provider);
      // signInWithRedirect never resolves — the page reloads.
      throw new Error("Redirecting…");
    }
    throw err;
  }
}

/** Call on login page mount to complete a pending redirect sign-in. */
export async function checkGoogleRedirect(): Promise<User | null> {
  const auth = getFirebaseAuth();
  const result: UserCredential | null = await getRedirectResult(auth);
  return result?.user ?? null;
}

// ── Email / Password ──────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Send a verification email — best practice, non-blocking
  await sendEmailVerification(result.user).catch(() => {});
  return result.user;
}

// ── ID token (for API Bearer auth) ───────────────────────────────────────────

export async function getIdToken(): Promise<string | null> {
  if (!isConfigured) return null;
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// ── Sign-out ──────────────────────────────────────────────────────────────────

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

// ── Auth state hook ───────────────────────────────────────────────────────────

export function useAuth(): { user: User | null; loading: boolean } {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}

// ── Error → human-readable message ───────────────────────────────────────────

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "auth/unauthorized-domain":
      return "This domain is not authorised in Firebase. Add it to Firebase Console → Authentication → Settings → Authorised domains.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return `Sign-in failed${code ? ` (${code})` : ""}. Please try again.`;
  }
}
