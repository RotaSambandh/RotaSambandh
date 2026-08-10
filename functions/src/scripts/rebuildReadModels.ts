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
  projectEmployerVerification,
} from "../projections/employer";
import { projectPublicBusiness } from "../projections/businesses";
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

  // Clear admin CR queue so terminal CRs do not linger; re-seed pending only below.
  await rtdb.ref("admin/queues/changeRequests").remove();

  const businesses = await fs.collection("businesses").get();
  for (const doc of businesses.docs) {
    const data = { id: doc.id, ...doc.data() } as Record<string, unknown>;
    const verified = data.status === "verified";
    const openJobsCount = verified
      ? (
          await fs
            .collection("jobs")
            .where("businessId", "==", doc.id)
            .where("status", "==", "published")
            .get()
        ).size
      : 0;
    await projectEmployerMeta(doc.id, data, { openJobsCount });
    await projectPublicBusiness(doc.id, data, openJobsCount);
  }
  console.log(`Projected ${businesses.size} businesses (public + employer meta)`);

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
  console.log(`Projected ${profiles.size} profiles (+ dashboard completion)`);

  const members = await fs.collection("businessMembers").get();
  for (const doc of members.docs) {
    const m = doc.data();
    let email = (m.email as string | undefined) || undefined;
    let displayName = (m.displayName as string | undefined) || undefined;
    const invitedEmail =
      (m.invitedEmail as string | undefined) ?? email;
    const userId = String(m.userId ?? "");
    if (userId && (!email || !displayName)) {
      const userSnap = await fs.doc(`users/${userId}`).get();
      const u = userSnap.data() ?? {};
      if (!email && u.email) email = String(u.email);
      if (!displayName && u.displayName) displayName = String(u.displayName);
    }
    await projectEmployerMember({
      id: doc.id,
      businessId: String(m.businessId),
      userId,
      role: String(m.role ?? "viewer"),
      status: String(m.status ?? "active"),
      email,
      displayName,
      invitedEmail: invitedEmail ?? email,
    });
    const status = String(m.status ?? "active");
    if (status === "active") {
      await rtdb.ref(`employerMembers/${m.businessId}/${m.userId}`).set(true);
      await rtdb.ref(`userEmployerMemberships/${m.userId}/${m.businessId}`).set(true);
    }
  }
  console.log(`Projected ${members.size} members`);

  const crs = await fs.collection("changeRequests").get();
  let pendingJobCrs = 0;
  let pendingBusinessCrs = 0;
  for (const doc of crs.docs) {
    const cr = doc.data();
    const status = String(cr.status);
    const targetType = String(cr.targetType);
    if (status === "pending_review" && targetType === "job") {
      pendingJobCrs += 1;
    }
    if (status === "pending_review" && targetType === "business") {
      pendingBusinessCrs += 1;
    }
    await projectChangeRequest({
      id: doc.id,
      businessId: cr.businessId as string | undefined,
      targetType,
      targetId: String(cr.targetId),
      status,
      action: cr.action ? String(cr.action) : undefined,
      submittedBy: cr.submittedBy as string | undefined,
      submittedAt: (cr.updatedAt ?? cr.createdAt ?? cr.submittedAt) as
        | number
        | undefined,
      adminNote: cr.adminNote as string | undefined,
      title: cr.title as string | undefined,
      proposed: (cr.proposed as Record<string, unknown> | undefined) ?? {},
      liveSnapshot: (cr.liveSnapshot as Record<string, unknown> | undefined) ?? {},
    });
  }
  console.log(
    `Projected ${crs.size} change requests (${pendingJobCrs} pending job CRs, ${pendingBusinessCrs} pending business CRs)`,
  );

  let pendingVerificationBusinesses = 0;
  let pendingDeletionBusinesses = 0;
  for (const doc of businesses.docs) {
    const status = String(doc.data().status ?? "");
    if (status === "verification_pending") pendingVerificationBusinesses += 1;
    if (status === "deletion_pending") pendingDeletionBusinesses += 1;
  }
  // Same formula as live bumps: verification_pending businesses + pending business CRs.
  const pendingBusinesses = pendingVerificationBusinesses + pendingBusinessCrs;

  await rtdb.ref("admin/dashboard").update({
    pendingJobs: pendingJobCrs,
    pendingBusinesses,
    pendingBusinessDeletions: pendingDeletionBusinesses,
    updatedAt: Date.now(),
  });
  await rtdb.ref("system/counters").update({
    pendingJobs: pendingJobCrs,
    pendingBusinesses,
    pendingBusinessDeletions: pendingDeletionBusinesses,
    updatedAt: Date.now(),
  });
  console.log(
    `Recomputed counters: pendingJobs=${pendingJobCrs}, pendingBusinesses=${pendingBusinesses} (${pendingVerificationBusinesses} verification + ${pendingBusinessCrs} CRs), pendingDeletions=${pendingDeletionBusinesses}`,
  );

  for (const kind of ["categories", "skills", "questions"] as const) {
    const snap = await fs.collection(kind).get();
    for (const doc of snap.docs) {
      await projectTaxonomyDoc(kind, doc.id, { ...doc.data() });
    }
    console.log(`Projected ${snap.size} ${kind}`);
  }

  const verifications = await fs.collection("businessVerifications").get();
  const latestByBusiness = new Map<
    string,
    { id: string; data: Record<string, unknown>; updatedAt: number }
  >();
  for (const doc of verifications.docs) {
    const v = doc.data() as Record<string, unknown>;
    const businessId = String(v.businessId ?? "");
    let businessName = "";
    let rotaryContactName = "";
    let rotaryContactClub = "";
    let rotaryContactEmail = "";
    let rotaryContactPhone = "";
    if (businessId) {
      const bizSnap = await fs.doc(`businesses/${businessId}`).get();
      const biz = bizSnap.data() ?? {};
      businessName = String(biz.name ?? "");
      rotaryContactName = String(biz.rotaryContactName ?? "");
      rotaryContactClub = String(biz.rotaryContactClub ?? "");
      rotaryContactEmail = String(biz.rotaryContactEmail ?? "");
      rotaryContactPhone = String(biz.rotaryContactPhone ?? "");
    }
    await projectAdminQueueItem("verifications", doc.id, {
      businessId,
      businessName,
      status: v.status,
      affiliationType: v.affiliationType,
      affiliationDetails: v.affiliationDetails ?? "",
      supportingInfo: v.supportingInfo ?? "",
      adminNote: v.adminNote ?? "",
      submittedBy: v.submittedBy,
      rotaryContactName,
      rotaryContactClub,
      rotaryContactEmail,
      rotaryContactPhone,
      reviewedAt: v.reviewedAt ?? null,
      updatedAt: v.updatedAt ?? Date.now(),
    });
    if (businessId) {
      const updatedAt = Number(v.updatedAt ?? 0);
      const prev = latestByBusiness.get(businessId);
      if (!prev || updatedAt >= prev.updatedAt) {
        latestByBusiness.set(businessId, { id: doc.id, data: v, updatedAt });
      }
    }
  }
  for (const [businessId, latest] of latestByBusiness) {
    const v = latest.data;
    await projectEmployerVerification(businessId, {
      id: latest.id,
      status: v.status,
      affiliationType: v.affiliationType,
      affiliationDetails: v.affiliationDetails ?? "",
      supportingInfo: v.supportingInfo ?? "",
      adminNote: v.adminNote ?? "",
      reviewedAt: v.reviewedAt ?? null,
      updatedAt: latest.updatedAt || Date.now(),
    });
  }
  console.log(`Projected ${verifications.size} verifications`);

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
