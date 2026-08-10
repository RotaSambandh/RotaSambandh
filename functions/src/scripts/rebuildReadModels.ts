/**
 * Offline / ops recovery only - not a deployed Cloud Function.
 *
 * Re-projects all published jobs into RTDB after a projection bug fix or
 * READ_MODEL_VERSION bump. Day-to-day sync is handled by onJobWritten.
 *
 * Usage (with GOOGLE_APPLICATION_CREDENTIALS or gcloud auth):
 *   cd functions && npm run build && npm run rebuild:readmodels
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { projectJob, type BusinessDoc, type JobDoc } from "../projections/jobs";

function init() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && existsSync(keyPath)) {
    const json = JSON.parse(readFileSync(resolve(keyPath), "utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

init();

async function main() {
  const fs = getFirestore();
  const jobs = await fs.collection("jobs").where("status", "==", "published").get();
  for (const doc of jobs.docs) {
    const job = { id: doc.id, ...doc.data() } as JobDoc;
    const bizSnap = await fs.doc(`businesses/${job.businessId}`).get();
    await projectJob(
      job,
      bizSnap.exists ? ({ id: bizSnap.id, ...bizSnap.data() } as BusinessDoc) : null,
    );
    console.log("Projected", job.id);
  }
  console.log(`Rebuilt ${jobs.size} jobs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
