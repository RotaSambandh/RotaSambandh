import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  invalidateNetlifyCache,
  projectJob,
  removeJobProjections,
  type BusinessDoc,
  type JobDoc,
} from "./projections/jobs";
import {
  bumpAdminCounters,
  bumpCandidateStats,
  bumpEmployerStats,
} from "./projections/dashboards";
import { createAndDeliverNotification, notifyBusinessMembers, notifyPlatformStaff } from "./notifications";
import { READ_MODEL_VERSION } from "./constants";

/** All functions run next to Firestore / RTDB (asia-southeast1). */
setGlobalOptions({ region: "asia-southeast1" });

initializeApp();

export const onJobWritten = onDocumentWritten("jobs/{jobId}", async (event) => {
  const after = event.data?.after?.data() as JobDoc | undefined;
  const before = event.data?.before?.data() as JobDoc | undefined;

  if (!after) {
    if (before) await removeJobProjections(before.id, before.type, before.workplace, before.businessId);
    return;
  }

  let business: BusinessDoc | null = null;
  const bizSnap = await getFirestore().doc(`businesses/${after.businessId}`).get();
  if (bizSnap.exists) business = { id: bizSnap.id, ...bizSnap.data() } as BusinessDoc;

  if (after.status !== "published") {
    await removeJobProjections(after.id, after.type, after.workplace, after.businessId);
  } else {
    await projectJob({ ...after, id: after.id ?? event.params.jobId }, business);
  }
  await invalidateNetlifyCache([
    `job:${after.id}`,
    `feed:latest`,
    `feed:${after.type}`,
    `business:${after.businessId}`,
  ]);

  if (before?.status !== "published" && after.status === "published") {
    await bumpAdminCounters({ activeJobs: 1, pendingJobs: before?.status === "pending_review" ? -1 : 0 });
    await bumpEmployerStats(after.businessId, { activeJobs: 1 });
  }
  if (before?.status === "published" && after.status !== "published") {
    await bumpAdminCounters({ activeJobs: -1 });
    await bumpEmployerStats(after.businessId, { activeJobs: -1 });
  }
  if (before?.status === "pending_review" && after.status === "draft") {
    await bumpAdminCounters({ pendingJobs: -1 });
  }
  if (before?.status !== "pending_review" && after.status === "pending_review") {
    await bumpAdminCounters({ pendingJobs: 1 });
  }
});

export const onApplicationCreated = onDocumentCreated("applications/{applicationId}", async (event) => {
  const app = event.data?.data();
  if (!app) return;

  await bumpEmployerStats(app.businessId, { applications: 1, newApplications: 1 });
  await bumpCandidateStats(app.candidateId, { applications: 1 });
  await bumpAdminCounters({ applications: 1 });

  await getDatabase().ref(`candidate/${app.candidateId}/applications/${app.id}`).set({
    id: app.id,
    jobId: app.jobId,
    status: app.status,
    submittedAt: app.submittedAt,
    readModelVersion: READ_MODEL_VERSION,
  });

  await getDatabase().ref(`employer/${app.businessId}/recentApplications/${app.id}`).set({
    id: app.id,
    jobId: app.jobId,
    candidateId: app.candidateId,
    status: app.status,
    submittedAt: app.submittedAt,
    readModelVersion: READ_MODEL_VERSION,
  });

  await createAndDeliverNotification({
    userId: app.candidateId,
    type: "application_submitted",
    title: "Application submitted",
    body: "Your application was received successfully.",
    href: "/candidate/applications",
    meta: { applicationId: app.id, jobId: app.jobId },
    channel: "candidate",
  });

  let jobTitle = "a role";
  try {
    const jobSnap = await getFirestore().doc(`jobs/${app.jobId}`).get();
    if (jobSnap.exists) jobTitle = String(jobSnap.data()?.title ?? jobTitle);
  } catch {
    /* ignore */
  }

  await notifyBusinessMembers({
    businessId: app.businessId,
    type: "application_received",
    title: "New application",
    body: `Someone applied for ${jobTitle}.`,
    href: `/employer/jobs/${app.jobId}`,
    meta: { applicationId: app.id, jobId: app.jobId },
    roles: ["company_admin", "manager"],
    dedupeKeyPrefix: `app-recv:${app.id}`,
  });
});

export const onApplicationUpdated = onDocumentUpdated("applications/{applicationId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  await getDatabase().ref(`candidate/${after.candidateId}/applications/${after.id}`).update({
    status: after.status,
    statusUpdatedAt: after.statusUpdatedAt,
    readModelVersion: READ_MODEL_VERSION,
  });

  if (after.status === "shortlisted") {
    await bumpEmployerStats(after.businessId, { shortlisted: 1, newApplications: -1 });
  }
  if (after.status === "interview") {
    await bumpEmployerStats(after.businessId, { interviews: 1 });
    await bumpCandidateStats(after.candidateId, { interviews: 1, underReview: -1 });
  }
  if (after.status === "under_review") {
    await bumpCandidateStats(after.candidateId, { underReview: 1 });
  }
  if (after.status === "selected") {
    await bumpEmployerStats(after.businessId, { selected: 1 });
    await bumpAdminCounters({ placements: 1 });
  }

  const status = String(after.status);
  const type =
    status === "interview" ? "interview_update" : "application_status_changed";
  const title =
    status === "selected"
      ? "You were selected"
      : status === "rejected"
        ? "Application update"
        : status === "interview"
          ? "Interview update"
          : status === "shortlisted"
            ? "You've been shortlisted"
            : "Application update";

  await createAndDeliverNotification({
    userId: after.candidateId,
    type,
    title,
    body: `Your application status is now ${status.replaceAll("_", " ")}.`,
    href: "/candidate/applications",
    meta: { applicationId: after.id, status },
    channel: "candidate",
    dedupeKey: `app-status:${after.id}:${status}`,
  });

  if (status === "withdrawn") {
    await notifyBusinessMembers({
      businessId: after.businessId,
      type: "application_status_changed",
      title: "Candidate withdrew",
      body: "A candidate withdrew an application.",
      href: `/employer/jobs/${after.jobId}`,
      meta: { applicationId: after.id },
      roles: ["company_admin", "manager"],
      dedupeKeyPrefix: `app-withdraw:${after.id}`,
    });
  }
});

export const onBusinessWritten = onDocumentWritten("businesses/{businessId}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  const businessId = event.params.businessId;
  if (!after) {
    await getDatabase().ref(`businesses/${businessId}`).remove();
    if (before) {
      await bumpAdminCounters({ businesses: -1 });
      if (before.status === "deletion_pending") {
        await bumpAdminCounters({ pendingBusinessDeletions: -1 });
      }
      if (before.status === "verification_pending") {
        await bumpAdminCounters({ pendingBusinesses: -1 });
      }
    }
    return;
  }

  const verified = after.status === "verified";
  if (!verified) {
    await getDatabase().ref(`businesses/${businessId}`).remove();
  } else {
    await getDatabase().ref(`businesses/${businessId}`).set({
      id: after.id ?? businessId,
      name: after.name,
      slug: after.slug,
      logoUrl: after.logoUrl,
      coverUrl: after.coverUrl,
      description: after.description,
      website: after.website,
      industry: after.industry,
      companySize: after.companySize,
      location: after.location,
      rotaryContactName: after.rotaryContactName,
      rotaryContactClub: after.rotaryContactClub,
      verified: true,
      openJobsCount: 0,
      readModelVersion: READ_MODEL_VERSION,
    });
  }

  // Keep feed companyLogo / company name in sync when branding changes.
  const brandingChanged =
    before?.logoUrl !== after.logoUrl ||
    before?.name !== after.name ||
    before?.description !== after.description;
  if (verified && brandingChanged) {
    const jobsSnap = await getFirestore()
      .collection("jobs")
      .where("businessId", "==", businessId)
      .where("status", "==", "published")
      .get();
    const business: BusinessDoc = { id: after.id ?? businessId, ...after } as BusinessDoc;
    for (const jobDoc of jobsSnap.docs) {
      const job = { id: jobDoc.id, ...jobDoc.data() } as JobDoc;
      await projectJob(job, business);
    }
    await invalidateNetlifyCache([`business:${businessId}`, "feed:latest"]);
  }

  if (before?.status !== "verification_pending" && after.status === "verification_pending") {
    await bumpAdminCounters({ pendingBusinesses: 1 });
  }
  if (before?.status === "verification_pending" && after.status !== "verification_pending") {
    await bumpAdminCounters({ pendingBusinesses: -1 });
  }
  if (before?.status !== "deletion_pending" && after.status === "deletion_pending") {
    await bumpAdminCounters({ pendingBusinessDeletions: 1 });
    await notifyPlatformStaff({
      type: "business_deletion",
      title: "Company deletion requested",
      body: `${after.name} asked to leave the network.`,
      href: "/admin/businesses",
      dedupeKeyPrefix: `biz-del-req:${businessId}`,
    });
    await notifyBusinessMembers({
      businessId,
      type: "business_deletion",
      title: "Company deletion pending",
      body: `${after.name} is hidden pending admin restore or permanent delete.`,
      href: "/employer/company",
      roles: ["company_admin"],
      excludeUserId: after.deletionRequestedBy,
      dedupeKeyPrefix: `biz-del-peer:${businessId}`,
    });
    // Batch candidates with applications
    const appsSnap = await getFirestore()
      .collection("applications")
      .where("businessId", "==", businessId)
      .limit(400)
      .get();
    const candidateIds = Array.from(
      new Set(appsSnap.docs.map((d) => d.data().candidateId as string).filter(Boolean)),
    );
    await Promise.all(
      candidateIds.map((candidateId) =>
        createAndDeliverNotification({
          userId: candidateId,
          type: "business_deletion",
          title: "Employer requested removal",
          body: `${after.name} asked to leave RotaSambandh. Your application stays on file.`,
          href: "/candidate/applications",
          channel: "candidate",
          dedupeKey: `biz-del-cand:${businessId}:${candidateId}`,
          skipPush: true,
        }),
      ),
    );
  }
  if (before?.status === "deletion_pending" && after.status !== "deletion_pending") {
    await bumpAdminCounters({ pendingBusinessDeletions: -1 });
  }
  if (!before && after) {
    await bumpAdminCounters({ businesses: 1 });
  }
  if (before?.status !== "verified" && after.status === "verified") {
    await notifyBusinessMembers({
      businessId,
      type: "business_verification",
      title: "Business verified",
      body: `${after.name} is now a verified Rotary ecosystem business.`,
      href: "/employer/company",
      roles: ["company_admin"],
      meta: { decision: "approved" },
      dedupeKeyPrefix: `biz-verified:${businessId}`,
    });
  }
});

export const onBusinessMemberWritten = onDocumentWritten(
  "businessMembers/{memberId}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const db = getDatabase();
    // Only active memberships grant employer RTDB workspace access (multi-company safe).
    if (after) {
      const status = (after.status as string | undefined) ?? "active";
      const path = `employerMembers/${after.businessId}/${after.userId}`;
      if (status === "active") {
        await db.ref(path).set(true);
      } else {
        await db.ref(path).remove();
      }
      return;
    }
    if (before) {
      await db.ref(`employerMembers/${before.businessId}/${before.userId}`).remove();
    }
  },
);

export const onChangeRequestWritten = onDocumentWritten(
  "changeRequests/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (before?.status !== "pending_review" && after?.status === "pending_review") {
      await bumpAdminCounters({
        pendingJobs: after.targetType === "job" ? 1 : 0,
        pendingBusinesses: after.targetType === "business" ? 1 : 0,
      });
    }
    if (before?.status === "pending_review" && after && after.status !== "pending_review") {
      await bumpAdminCounters({
        pendingJobs: before.targetType === "job" ? -1 : 0,
        pendingBusinesses: before.targetType === "business" ? -1 : 0,
      });
      if (after.status === "approved" && after.submittedBy) {
        await createAndDeliverNotification({
          userId: after.submittedBy,
          type: after.targetType === "job" ? "job_approved" : "business_verification",
          title: "Changes approved",
          body: "Your submitted changes are now live.",
          href: after.targetType === "job" ? "/employer/jobs" : "/employer/company",
          channel: "employer",
          dedupeKey: `cr-ok:${event.params.id}`,
        });
      }
      if (after.status === "rejected" && after.submittedBy) {
        await createAndDeliverNotification({
          userId: after.submittedBy,
          type: after.targetType === "job" ? "job_rejected" : "change_request_update",
          title: "Changes need attention",
          body: after.adminNote || "Your submission was rejected. Please revise and resubmit.",
          href: after.targetType === "job" ? "/employer/jobs" : "/employer/company",
          channel: "employer",
          meta: { decision: "rejected" },
          dedupeKey: `cr-rej:${event.params.id}`,
        });
      }
      if (after.status === "info_requested" && after.submittedBy) {
        await createAndDeliverNotification({
          userId: after.submittedBy,
          type: "change_request_update",
          title: "More information requested",
          body: after.adminNote || "An admin asked for more details on your submission.",
          href: after.targetType === "job" ? "/employer/jobs" : "/employer/company",
          channel: "employer",
          meta: { decision: "info_requested" },
          dedupeKey: `cr-info:${event.params.id}`,
        });
      }
    }

    if (before?.status !== "pending_review" && after?.status === "pending_review") {
      await refreshAdminQueueDigest();
    }
  },
);

export const onBusinessVerificationWritten = onDocumentWritten(
  "businessVerifications/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after) return;

    if (before?.status !== "pending" && after.status === "pending") {
      await notifyPlatformStaff({
        type: "admin_queue_digest",
        title: "New verification pending",
        body: "A business submitted Rotary affiliation for review.",
        href: "/admin/businesses",
        dedupeKeyPrefix: `ver-pend:${event.params.id}`,
      });
      await refreshAdminQueueDigest();
    }

    if (before?.status === "pending" && after.status !== "pending" && after.businessId) {
      const decision = String(after.status);
      if (decision === "approved" || decision === "rejected" || decision === "info_requested") {
        const title =
          decision === "approved"
            ? "Verification approved"
            : decision === "rejected"
              ? "Verification rejected"
              : "Verification needs more info";
        const body =
          decision === "approved"
            ? "Your business verification was approved."
            : after.adminNote ||
              (decision === "rejected"
                ? "Your verification was rejected. Update details and resubmit."
                : "An admin requested more information for verification.");
        await notifyBusinessMembers({
          businessId: after.businessId,
          type: "business_verification",
          title,
          body,
          href: "/employer/company",
          roles: ["company_admin"],
          meta: { decision },
          dedupeKeyPrefix: `ver-dec:${event.params.id}:${decision}`,
        });
      }
    }
  },
);

export const onReportCreated = onDocumentCreated("reports/{id}", async (event) => {
  const report = event.data?.data();
  if (!report) return;
  await refreshAdminQueueDigest();
  await notifyPlatformStaff({
    type: "admin_queue_digest",
    title: "New report",
    body: `A ${String(report.targetType)} was reported (${String(report.reason).replaceAll("_", " ")}).`,
    href: "/admin/reports",
    dedupeKeyPrefix: `report:${event.params.id}`,
  });
});

async function refreshAdminQueueDigest() {
  const countersSnap = await getDatabase().ref("admin/dashboard").get();
  const c = (countersSnap.val() ?? {}) as Record<string, number>;
  const body = [
    `${c.pendingBusinesses ?? 0} businesses`,
    `${c.pendingJobs ?? 0} jobs`,
    `${c.pendingBusinessDeletions ?? 0} deletions`,
  ].join(" · ");
  await notifyPlatformStaff({
    type: "admin_queue_digest",
    title: "Review queue",
    body: `Pending: ${body}. Open Admin to clear the queues.`,
    href: "/admin",
    dedupeKeyPrefix: `queue-digest:${new Date().toISOString().slice(0, 13)}`,
  });
}

export const onUserCreated = onDocumentCreated("users/{uid}", async () => {
  await bumpAdminCounters({ registeredUsers: 1 });
});

function isPlatformStaffRole(roles: string[]): boolean {
  return (
    roles.includes("super_admin") || roles.includes("admin") || roles.includes("coordinator")
  );
}

export const onUserWritten = onDocumentWritten("users/{uid}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  const uid = event.params.uid;
  const db = getDatabase();
  const roles = (after?.roles as string[] | undefined) ?? [];
  const beforeRoleList = (before?.roles as string[] | undefined) ?? [];
  const wasStaff = isPlatformStaffRole(beforeRoleList);
  const isStaff = isPlatformStaffRole(roles);
  if (isStaff) {
    await db.ref(`admins/${uid}`).set(true);
  } else if (wasStaff && !isStaff) {
    await db.ref(`admins/${uid}`).remove();
  }

  const beforeRoles = beforeRoleList.slice().sort().join(",");
  const afterRoles = roles.slice().sort().join(",");
  if (after && beforeRoles !== afterRoles) {
    await getAuth().setCustomUserClaims(uid, { roles });
  }
});

// savedJobs feature removed from the app — no projection writes.
