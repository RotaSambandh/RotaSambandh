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

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  // Project + RTDB URL are public; only the service-account key is secret.
  const projectId =
    process.env.FIREBASE_PROJECT_ID || firebasePublicConfig.projectId || undefined;
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL || firebasePublicConfig.databaseURL || undefined;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey && projectId) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL,
      projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    databaseURL,
    projectId,
  });
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
