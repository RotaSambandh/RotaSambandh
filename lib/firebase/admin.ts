import {
  cert,
  getApps,
  initializeApp,
  type App,
  applicationDefault,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { firebasePublicConfig } from "@/lib/firebase/public-config";

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

/** Netlify UI often wraps secrets in quotes or stores literal `\n`. */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId =
    process.env.FIREBASE_PROJECT_ID || firebasePublicConfig.projectId || undefined;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL || firebasePublicConfig.databaseURL || undefined;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // Prefer explicit service-account env vars. Do not fall through to ADC when a
  // stale GOOGLE_APPLICATION_CREDENTIALS path is set (common in local shells).
  if (clientEmail && privateKey && projectId) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL,
      projectId,
    });
  }

  // Local gcloud / emulator only — never rely on this on Netlify.
  if (process.env.NODE_ENV !== "production" || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({
      credential: applicationDefault(),
      databaseURL,
      projectId,
    });
  }

  throw new AdminConfigError(
    "Firebase Admin is not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (and optionally FIREBASE_PROJECT_ID) in Netlify environment variables, then redeploy.",
  );
}

export function getAdminApp(): App {
  return initAdmin();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminRtdb() {
  return getDatabase(getAdminApp());
}
