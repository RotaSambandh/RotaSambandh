import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import {
  firebasePublicConfig,
  hasFirebasePublicConfig,
} from "@/lib/firebase/public-config";

export function isFirebaseConfigured(): boolean {
  return hasFirebasePublicConfig();
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let rtdb: Database | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Fill lib/firebase/public-config.ts from the Firebase console.",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp({ ...firebasePublicConfig });
  }
  return app;
}

/**
 * Prefer localStorage persistence for Auth.
 * Default IndexedDB persistence breaks signInWithPopup in @firebase/auth 1.13.4:
 * when the Google popup takes focus, a visibilitychange handler closes the DB
 * and sign-in fails with "Database is closing/hidden".
 */
export function getClientAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      // HMR / already initialized in this runtime
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

export function getClientFirestore(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getClientRtdb(): Database {
  if (!rtdb) rtdb = getDatabase(getFirebaseApp());
  return rtdb;
}

export async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  return getMessaging(getFirebaseApp());
}
