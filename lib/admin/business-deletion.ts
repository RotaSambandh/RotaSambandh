import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminRtdb } from "@/lib/firebase/admin";
import { deleteBusinessLogoPrefix } from "@/lib/r2/client";
import { invalidateNetlifyCache, removeJobProjections } from "@/lib/admin/projections-cleanup";
import { deliverNotification, deliverToPlatformStaff } from "@/lib/notifications/deliver";
import type {
  Application,
  Business,
  BusinessStatusBeforeDeletion,
  Job,
  JobStatus,
} from "@/shared/types";

function assertConfirmName(expected: string, confirmName: string) {
  if (expected.trim().toLowerCase() !== confirmName.trim().toLowerCase()) {
    throw new Error("Company name confirmation does not match");
  }
}

async function deleteQueryDocs(
  collectionName: string,
  field: string,
  value: string,
): Promise<number> {
  const db = getAdminFirestore();
  let total = 0;
  // Paginate in chunks to avoid huge memory spikes.
  for (;;) {
    const snap = await db.collection(collectionName).where(field, "==", value).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

async function deleteByApplicationIds(
  collectionName: string,
  applicationIds: string[],
): Promise<void> {
  const db = getAdminFirestore();
  for (const applicationId of applicationIds) {
    for (;;) {
      const snap = await db
        .collection(collectionName)
        .where("applicationId", "==", applicationId)
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
      if (snap.size < 400) break;
    }
  }
}

/** Soft-delete: company_admin requested removal; admin can restore or purge. */
export async function requestBusinessDeletion(input: {
  businessId: string;
  requestedBy: string;
  confirmName: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("businesses").doc(input.businessId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Business not found");
  const business = snap.data() as Business;
  if (business.status === "deletion_pending") {
    throw new Error("Deletion already requested for this company");
  }
  assertConfirmName(business.name, input.confirmName);

  const ts = Date.now();
  const statusBeforeDeletion = business.status as BusinessStatusBeforeDeletion;

  await ref.update({
    status: "deletion_pending",
    statusBeforeDeletion,
    deletionRequestedAt: ts,
    deletionRequestedBy: input.requestedBy,
    deletionCompanyNameSnapshot: business.name,
    purgeStatus: FieldValue.delete(),
    purgeError: FieldValue.delete(),
    updatedAt: ts,
  });

  const jobsSnap = await db.collection("jobs").where("businessId", "==", input.businessId).get();
  const closable = jobsSnap.docs.filter((jobDoc) => {
    const job = jobDoc.data() as Job;
    return job.status === "published" || job.status === "pending_review";
  });

  for (let i = 0; i < closable.length; i += 400) {
    const chunk = closable.slice(i, i + 400);
    const batch = db.batch();
    for (const jobDoc of chunk) {
      const job = jobDoc.data() as Job;
      batch.update(jobDoc.ref, {
        statusBeforeDeletion: job.status,
        status: "closed" satisfies JobStatus,
        closedAt: ts,
        updatedAt: ts,
      });
    }
    await batch.commit();
  }

  await db.collection("adminActions").add({
    adminId: input.requestedBy,
    action: "business_deletion_requested",
    targetType: "business",
    targetId: input.businessId,
    note: `Requested deletion of ${business.name}`,
    createdAt: ts,
    updatedAt: ts,
  });

  await deliverToPlatformStaff({
    type: "business_deletion",
    title: "Company deletion requested",
    body: `${business.name} asked to leave the network. Restore or permanently delete in Admin → Businesses.`,
    href: "/admin/businesses",
    dedupeKeyPrefix: `biz-del-req:${input.businessId}`,
  });

  // Other company admins (not the requester)
  const members = await db
    .collection("businessMembers")
    .where("businessId", "==", input.businessId)
    .limit(40)
    .get();
  for (const doc of members.docs) {
    const m = doc.data() as { userId?: string; role?: string; status?: string };
    if (!m.userId || m.userId === input.requestedBy) continue;
    if (m.status === "revoked") continue;
    const isAdmin = m.role === "company_admin" || m.role === "owner";
    if (!isAdmin) continue;
    await deliverNotification({
      userId: m.userId,
      type: "business_deletion",
      title: "Company deletion requested",
      body: `${business.name} was marked for removal. An admin will restore or permanently delete it.`,
      href: "/employer/company",
      dedupeKey: `biz-del-peer:${input.businessId}:${m.userId}`,
    });
  }
}

export async function restoreBusinessDeletion(input: {
  businessId: string;
  adminId: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection("businesses").doc(input.businessId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Business not found");
  const business = snap.data() as Business;
  if (business.status !== "deletion_pending") {
    throw new Error("Business is not pending deletion");
  }

  const ts = Date.now();
  const restoreStatus = business.statusBeforeDeletion ?? "draft";

  await ref.update({
    status: restoreStatus,
    statusBeforeDeletion: FieldValue.delete(),
    deletionRequestedAt: FieldValue.delete(),
    deletionRequestedBy: FieldValue.delete(),
    deletionCompanyNameSnapshot: FieldValue.delete(),
    purgeStatus: FieldValue.delete(),
    purgeError: FieldValue.delete(),
    updatedAt: ts,
  });

  const jobsSnap = await db.collection("jobs").where("businessId", "==", input.businessId).get();
  const restorable = jobsSnap.docs.filter((d) => Boolean((d.data() as Job).statusBeforeDeletion));
  for (let i = 0; i < restorable.length; i += 400) {
    const chunk = restorable.slice(i, i + 400);
    const batch = db.batch();
    for (const jobDoc of chunk) {
      const job = jobDoc.data() as Job;
      batch.update(jobDoc.ref, {
        status: job.statusBeforeDeletion,
        statusBeforeDeletion: FieldValue.delete(),
        closedAt:
          job.statusBeforeDeletion === "published" ? FieldValue.delete() : (job.closedAt ?? null),
        updatedAt: ts,
      });
    }
    await batch.commit();
  }

  await db.collection("adminActions").add({
    adminId: input.adminId,
    action: "business_deletion_restored",
    targetType: "business",
    targetId: input.businessId,
    note: `Restored ${business.deletionCompanyNameSnapshot ?? business.name}`,
    createdAt: ts,
    updatedAt: ts,
  });

  // Notify requester if present.
  const notifyUid = business.deletionRequestedBy ?? business.ownerId;
  if (notifyUid) {
    await deliverNotification({
      userId: notifyUid,
      type: "business_deletion",
      title: "Company deletion cancelled",
      body: `${business.deletionCompanyNameSnapshot ?? business.name} has been restored by an admin.`,
      href: "/employer/company",
      dedupeKey: `biz-del-restore:${input.businessId}:${notifyUid}:${ts}`,
    });
  }

  // Batch one note per candidate with apps at this business
  const appsSnap = await db
    .collection("applications")
    .where("businessId", "==", input.businessId)
    .limit(500)
    .get();
  const candidateIds = Array.from(
    new Set(appsSnap.docs.map((d) => (d.data() as Application).candidateId).filter(Boolean)),
  );
  const companyName = business.deletionCompanyNameSnapshot ?? business.name;
  await Promise.all(
    candidateIds.map((candidateId) =>
      deliverNotification({
        userId: candidateId,
        type: "business_deletion",
        title: "Employer restored",
        body: `${companyName} is active on RotaSambandh again. Your applications remain on file.`,
        href: "/candidate/applications",
        dedupeKey: `biz-del-restore-cand:${input.businessId}:${candidateId}`,
        skipPush: true,
      }),
    ),
  );
}

/**
 * Permanent purge. Idempotent enough to retry after `purgeStatus: failed`.
 * Leaves candidate application stubs; deletes employer/company graph.
 */
export async function purgeBusiness(input: {
  businessId: string;
  adminId: string;
  confirmName: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const rtdb = getAdminRtdb();
  const ref = db.collection("businesses").doc(input.businessId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Business not found");
  const business = snap.data() as Business;

  if (business.status !== "deletion_pending" && business.purgeStatus !== "failed") {
    throw new Error("Business must be pending deletion before permanent purge");
  }

  const expectedName = business.deletionCompanyNameSnapshot ?? business.name;
  assertConfirmName(expectedName, input.confirmName);

  const ts = Date.now();
  const businessId = input.businessId;
  const companyName = expectedName;

  await ref.update({
    purgeStatus: "running",
    purgeError: FieldValue.delete(),
    updatedAt: ts,
  });

  try {
    const jobsSnap = await db.collection("jobs").where("businessId", "==", businessId).get();
    const jobs = jobsSnap.docs.map((d) => ({ ...(d.data() as Job), id: d.id }));
    const jobTitleById = new Map(jobs.map((j) => [j.id, j.title]));

    const appsSnap = await db.collection("applications").where("businessId", "==", businessId).get();
    const applications = appsSnap.docs.map((d) => ({ ...(d.data() as Application), id: d.id }));
    const applicationIds = applications.map((a) => a.id);

    await deleteByApplicationIds("applicationAnswers", applicationIds);
    await deleteByApplicationIds("applicationEvents", applicationIds);

    // One tray item per candidate before stubs are written.
    const candidateIds = Array.from(new Set(applications.map((a) => a.candidateId)));
    await Promise.all(
      candidateIds.map((candidateId) =>
        deliverNotification({
          userId: candidateId,
          type: "business_deletion",
          title: "Company removed",
          body: `${companyName} is no longer on RotaSambandh. Your application record is kept for your history.`,
          href: "/candidate/applications",
          dedupeKey: `biz-purge-cand:${businessId}:${candidateId}`,
        }),
      ),
    );

    // Rewrite applications to candidate stubs.
    for (let i = 0; i < applications.length; i += 400) {
      const chunk = applications.slice(i, i + 400);
      const batch = db.batch();
      for (const app of chunk) {
        batch.set(db.collection("applications").doc(app.id), {
          id: app.id,
          jobId: app.jobId,
          businessId: businessId,
          candidateId: app.candidateId,
          status: app.status,
          resumeDocumentId: "",
          resumeStorageKey: "",
          resumeFileName: "",
          submittedAt: app.submittedAt,
          statusUpdatedAt: app.statusUpdatedAt,
          companyRemoved: true,
          companyNameSnapshot: companyName,
          jobTitleSnapshot: jobTitleById.get(app.jobId) ?? app.jobTitleSnapshot ?? "Role",
          createdAt: app.createdAt,
          updatedAt: ts,
        } satisfies Application);
      }
      await batch.commit();
    }

    // Candidate RTDB stubs; employer recent apps go away with employer tree.
    for (const app of applications) {
      await rtdb.ref(`candidate/${app.candidateId}/applications/${app.id}`).update({
        companyRemoved: true,
        companyNameSnapshot: companyName,
        jobTitleSnapshot: jobTitleById.get(app.jobId) ?? "Role",
        status: app.status,
        submittedAt: app.submittedAt,
      });
    }

    // jobQuestions for each job
    for (const job of jobs) {
      const jq = await db.collection("jobQuestions").where("jobId", "==", job.id).get();
      if (!jq.empty) {
        const batch = db.batch();
        for (const d of jq.docs) batch.delete(d.ref);
        await batch.commit();
      }
      await removeJobProjections(job.id, job.type, job.workplace, businessId);
    }

    // Employer / job scoped questions
    await deleteQueryDocs("questions", "businessId", businessId);

    // Delete jobs
    for (let i = 0; i < jobsSnap.docs.length; i += 400) {
      const chunk = jobsSnap.docs.slice(i, i + 400);
      const batch = db.batch();
      for (const d of chunk) batch.delete(d.ref);
      await batch.commit();
    }

    await deleteQueryDocs("businessMembers", "businessId", businessId);
    await deleteQueryDocs("businessVerifications", "businessId", businessId);
    await deleteQueryDocs("changeRequests", "businessId", businessId);

    // Close open reports targeting this business
    const reports = await db
      .collection("reports")
      .where("targetType", "==", "business")
      .where("targetId", "==", businessId)
      .get();
    if (!reports.empty) {
      const batch = db.batch();
      for (const d of reports.docs) {
        batch.update(d.ref, { status: "resolved", updatedAt: ts });
      }
      await batch.commit();
    }

    // Clear activeBusinessId for users pointing here
    const membersSnap = await db
      .collection("users")
      .where("activeBusinessId", "==", businessId)
      .limit(400)
      .get();
    if (!membersSnap.empty) {
      const batch = db.batch();
      for (const d of membersSnap.docs) {
        batch.update(d.ref, {
          activeBusinessId: FieldValue.delete(),
          updatedAt: ts,
        });
      }
      await batch.commit();
    }

    await deleteBusinessLogoPrefix(businessId);
    await rtdb.ref(`employer/${businessId}`).remove();
    await rtdb.ref(`employerMembers/${businessId}`).remove();
    await rtdb.ref(`businesses/${businessId}`).remove();

    await db.collection("adminActions").add({
      adminId: input.adminId,
      action: "business_purged",
      targetType: "business",
      targetId: businessId,
      note: `Permanently deleted ${companyName}`,
      createdAt: ts,
      updatedAt: ts,
    });

    await ref.delete();

    await invalidateNetlifyCache([`business:${businessId}`, "feed:latest"]);

    const notifyUid = business.deletionRequestedBy ?? business.ownerId;
    if (notifyUid) {
      await deliverNotification({
        userId: notifyUid,
        type: "business_deletion",
        title: "Company permanently deleted",
        body: `${companyName} has been permanently removed. Candidate application history stubs remain.`,
        href: "/employer",
        dedupeKey: `biz-purge-owner:${businessId}:${notifyUid}`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purge failed";
    await ref.set(
      {
        purgeStatus: "failed",
        purgeError: message,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    await deliverToPlatformStaff({
      type: "business_deletion",
      title: "Company purge failed",
      body: `${companyName}: ${message}. Retry permanent delete from Admin → Businesses.`,
      href: "/admin/businesses",
      dedupeKeyPrefix: `biz-purge-fail:${businessId}`,
    });
    throw err;
  }
}
