/**
 * Pre-seed the first platform super admin.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=you@example.com node --env-file=.env.local scripts/seed-super-admin.mjs
 *
 * Or set SUPER_ADMIN_EMAIL in .env.local and:
 *   npm run seed:super-admin
 *
 * Requires FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and project id
 * (FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

function loadPublicConfig() {
  const path = resolve(process.cwd(), "lib/firebase/public-config.ts");
  if (!existsSync(path)) return {};
  const src = readFileSync(path, "utf8");
  const projectId = src.match(/projectId:\s*"([^"]*)"/)?.[1];
  const databaseURL = src.match(/databaseURL:\s*"([^"]*)"/)?.[1];
  return { projectId, databaseURL };
}

const publicConfig = loadPublicConfig();
const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Set SUPER_ADMIN_EMAIL to the account that should become super admin.");
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_PROJECT_ID || publicConfig.projectId || undefined;
const databaseURL =
  process.env.FIREBASE_DATABASE_URL || publicConfig.databaseURL || undefined;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!clientEmail || !privateKey || !projectId) {
  console.error(
    "Missing Firebase Admin credentials. Need FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and project id.",
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
    projectId,
  });
}

const auth = getAuth();
const db = getFirestore();
const rtdb = getDatabase();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(
      `No Auth user for ${email}. Create the account first (sign up once), then re-run this script.`,
    );
    process.exit(1);
  }

  const uid = user.uid;
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : {};
  const roles = Array.from(
    new Set([...(existing.roles || []), "super_admin", "candidate"]),
  );

  const now = Date.now();
  await ref.set(
    {
      uid,
      email,
      displayName: existing.displayName || user.displayName || email,
      roles,
      suspended: false,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    },
    { merge: true },
  );

  await auth.setCustomUserClaims(uid, { roles });
  await rtdb.ref(`admins/${uid}`).set(true);

  console.log(`Seeded super_admin for ${email} (${uid}).`);
  console.log("Ask them to sign out and back in so claims refresh.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
