/**
 * Offline / ops recovery — re-projects jobs, applications, notifications,
 * users, profiles, taxonomy, and admin queue mirrors into RTDB.
 *
 * Usage:
 *   cd functions && npm run build && npm run rebuild:readmodels
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { projectJob, type BusinessDoc, type JobDoc } from "../projections/jobs";
import {
  projectApplication,
  projectApplicationAnswers,
  type ApplicationDoc,
} from "../projections/applications";
import { projectCandidateProfile, projectUserSlice } from "../projections/users";
import {
  projectChangeRequest,
  projectEmployerMember,
  projectEmployerMeta,
} from "../projections/employer";
import {
  projectAdminQueueItem,
  projectTaxonomyDoc,
} from "../projections/admin-queues";
import { projectCandidateDocument } from "../projections/documents";
import { READ_MODEL_VERSION } from "../constants";

function init() {
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    "https://rotasambandh2-default-rtdb.asia-southeast1.firebasedatabase.app";
  const projectId = process.env.FIREBASE_PROJECT_ID || "rotasambandh2";

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
      databaseURL,
    });
    return;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL,
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    databaseURL,
  });
}

init();

async function main() {
  const fs = getFirestore();
  const rtdb = getDatabase();
  console.log("READ_MODEL_VERSION", READ_MODEL_VERSION);

  const jobs = await fs.collection("jobs").get();
  for (const doc of jobs.docs) {
    const job = { id: doc.id, ...doc.data() } as JobDoc;
    const bizSnap = await fs.doc(`businesses/${job.businessId}`).get();
    await projectJob(
      job,
      bizSnap.exists ? ({ id: bizSnap.id, ...bizSnap.data() } as BusinessDoc) : null,
    );
  }
  console.log(`Projected ${jobs.size} jobs`);

  const apps = await fs.collection("applications").get();
  for (const doc of apps.docs) {
    const app = { id: doc.id, ...doc.data() } as ApplicationDoc;
    await projectApplication(app);
    const answers = await fs
      .collection("applicationAnswers")
      .where("applicationId", "==", app.id)
      .limit(50)
      .get();
    await projectApplicationAnswers(
      app.id,
      app.businessId,
      answers.docs.map((d) => {
        const a = d.data();
        return {
          id: d.id,
          questionId: String(a.questionId ?? ""),
          questionVersion: Number(a.questionVersion ?? 1),
          promptSnapshot: String(a.promptSnapshot ?? ""),
          type: String(a.type ?? "short_text"),
          value: a.value ?? null,
        };
      }),
    );
  }
  console.log(`Projected ${apps.size} applications`);

  const notifications = await fs.collection("notifications").limit(5000).get();
  for (const doc of notifications.docs) {
    const n = doc.data();
    const uid = String(n.userId ?? "");
    if (!uid) continue;
    const mirror = {
      id: doc.id,
      userId: uid,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href ?? "",
      read: Boolean(n.read),
      createdAt: n.createdAt ?? Date.now(),
      updatedAt: n.updatedAt ?? Date.now(),
      readModelVersion: READ_MODEL_VERSION,
    };
    await rtdb.ref(`inbox/${uid}/notifications/${doc.id}`).set(mirror);
  }
  console.log(`Projected ${notifications.size} notifications`);

  const users = await fs.collection("users").get();
  for (const doc of users.docs) {
    await projectUserSlice(doc.id, doc.data() as Record<string, unknown>);
  }
  console.log(`Projected ${users.size} users`);

  const profiles = await fs.collection("candidateProfiles").get();
  for (const doc of profiles.docs) {
    await projectCandidateProfile(doc.id, doc.data() as Record<string, unknown>);
  }
  console.log(`Projected ${profiles.size} profiles`);

  const businesses = await fs.collection("businesses").get();
  for (const doc of businesses.docs) {
    await projectEmployerMeta(doc.id, { id: doc.id, ...doc.data() });
  }
  console.log(`Projected ${businesses.size} employer meta`);

  const members = await fs.collection("businessMembers").get();
  for (const doc of members.docs) {
    const m = doc.data();
    await projectEmployerMember({
      id: doc.id,
      businessId: String(m.businessId),
      userId: String(m.userId),
      role: String(m.role ?? "viewer"),
      status: String(m.status ?? "active"),
      invitedEmail: m.invitedEmail as string | undefined,
    });
    const status = String(m.status ?? "active");
    if (status === "active") {
      await rtdb.ref(`employerMembers/${m.businessId}/${m.userId}`).set(true);
      await rtdb.ref(`userEmployerMemberships/${m.userId}/${m.businessId}`).set(true);
    }
  }
  console.log(`Projected ${members.size} members`);

  const crs = await fs.collection("changeRequests").get();
  for (const doc of crs.docs) {
    const cr = doc.data();
    await projectChangeRequest({
      id: doc.id,
      businessId: cr.businessId as string | undefined,
      targetType: String(cr.targetType),
      targetId: String(cr.targetId),
      status: String(cr.status),
      submittedBy: cr.submittedBy as string | undefined,
      submittedAt: cr.submittedAt as number | undefined,
      adminNote: cr.adminNote as string | undefined,
    });
  }

  for (const kind of ["categories", "skills", "questions"] as const) {
    const snap = await fs.collection(kind).get();
    for (const doc of snap.docs) {
      await projectTaxonomyDoc(kind, doc.id, { ...doc.data() });
    }
    console.log(`Projected ${snap.size} ${kind}`);
  }

  const verifications = await fs.collection("businessVerifications").get();
  for (const doc of verifications.docs) {
    const v = doc.data();
    await projectAdminQueueItem("verifications", doc.id, {
      businessId: v.businessId,
      status: v.status,
      affiliationType: v.affiliationType,
      submittedBy: v.submittedBy,
      updatedAt: v.updatedAt ?? Date.now(),
    });
  }

  const reports = await fs.collection("reports").get();
  for (const doc of reports.docs) {
    const r = doc.data();
    await projectAdminQueueItem("reports", doc.id, {
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status ?? "open",
      createdAt: r.createdAt ?? Date.now(),
    });
  }

  const documents = await fs.collection("documents").get();
  for (const doc of documents.docs) {
    const d = doc.data();
    const candidateId = String(d.candidateId ?? "");
    if (!candidateId) continue;
    await projectCandidateDocument(candidateId, doc.id, {
      ...d,
      id: doc.id,
    });
  }
  console.log(`Projected ${documents.size} documents`);

  console.log("Rebuild complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
