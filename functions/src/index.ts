import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
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
import {
  projectApplication,
  projectApplicationAnswers,
  removeApplicationProjections,
  type ApplicationDoc,
} from "./projections/applications";
import {
  countPublishedJobs,
  projectChangeRequest,
  projectEmployerMember,
  projectEmployerMeta,
  projectEmployerVerification,
} from "./projections/employer";
import { projectCandidateProfile, projectUserSlice, syncCandidateDashboardCompletion } from "./projections/users";
import {
  projectAdminQueueItem,
  projectJobQuestions,
  projectTaxonomyDoc,
} from "./projections/admin-queues";
import { projectCandidateDocument } from "./projections/documents";
import {
  createAndDeliverNotification,
  notifyBusinessMembers,
  notifyPlatformStaff,
} from "./notifications";
import { READ_MODEL_VERSION } from "./constants";

/** All functions run next to Firestore / RTDB (asia-southeast1). */
setGlobalOptions({ region: "asia-southeast1" });

initializeApp();

export const onJobWritten = onDocumentWritten("jobs/{jobId}", async (event) => {
  const after = event.data?.after?.data() as JobDoc | undefined;
  const before = event.data?.before?.data() as JobDoc | undefined;
  const jobId = event.params.jobId;

  if (!after) {
    if (before) {
      await removeJobProjections(
        before.id ?? jobId,
        before.type,
        before.workplace,
        before.businessId,
      );
      await projectAdminQueueItem("jobs", jobId, null);
    }
    return;
  }

  const job = { ...after, id: after.id ?? jobId };
  let business: BusinessDoc | null = null;
  const bizSnap = await getFirestore().doc(`businesses/${job.businessId}`).get();
  if (bizSnap.exists) business = { id: bizSnap.id, ...bizSnap.data() } as BusinessDoc;

  await projectJob(job, business);

  await projectAdminQueueItem("jobs", jobId, {
    title: job.title,
    businessId: job.businessId,
    status: job.status,
    type: job.type,
    workplace: job.workplace,
    updatedAt: Date.now(),
  });

  await invalidateNetlifyCache([
    `job:${job.id}`,
    `feed:latest`,
    `feed:${job.type}`,
    `business:${job.businessId}`,
  ]);

  if (before?.status !== "published" && job.status === "published") {
    await bumpAdminCounters({
      activeJobs: 1,
      pendingJobs: before?.status === "pending_review" ? -1 : 0,
    });
    await bumpEmployerStats(job.businessId, { activeJobs: 1 });
  }
  if (before?.status === "published" && job.status !== "published") {
    await bumpAdminCounters({ activeJobs: -1 });
    await bumpEmployerStats(job.businessId, { activeJobs: -1 });
  }
  if (before?.status === "pending_review" && job.status === "draft") {
    await bumpAdminCounters({ pendingJobs: -1 });
  }
  if (before?.status !== "pending_review" && job.status === "pending_review") {
    await bumpAdminCounters({ pendingJobs: 1 });
  }

  if (business) {
    const openJobsCount = await countPublishedJobs(job.businessId);
    if (business.status === "verified") {
      await getDatabase().ref(`businesses/${job.businessId}/openJobsCount`).set(openJobsCount);
    }
    await projectEmployerMeta(
      job.businessId,
      { ...business, id: business.id },
      { openJobsCount },
    );
  }
});

export const onApplicationCreated = onDocumentCreated(
  "applications/{applicationId}",
  async (event) => {
    const raw = event.data?.data();
    if (!raw) return;
    const app: ApplicationDoc = {
      ...(raw as ApplicationDoc),
      id: (raw as ApplicationDoc).id ?? event.params.applicationId,
    };

    await bumpEmployerStats(app.businessId, { applications: 1, newApplications: 1 });
    await bumpCandidateStats(app.candidateId, { applications: 1 });
    await bumpAdminCounters({ applications: 1 });

    const model = await projectApplication(app);

    const answersSnap = await getFirestore()
      .collection("applicationAnswers")
      .where("applicationId", "==", app.id)
      .limit(50)
      .get();
    await projectApplicationAnswers(
      app.id,
      app.businessId,
      answersSnap.docs.map((d) => {
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

    await createAndDeliverNotification({
      userId: app.candidateId,
      type: "application_submitted",
      title: "Application submitted",
      body: "Your application was received successfully.",
      href: "/candidate/applications",
      meta: { applicationId: app.id, jobId: app.jobId },
      channel: "candidate",
    });

    await notifyBusinessMembers({
      businessId: app.businessId,
      type: "application_received",
      title: "New application",
      body: `Someone applied for ${model.jobTitle}.`,
      href: `/employer/jobs/${app.jobId}`,
      meta: { applicationId: app.id, jobId: app.jobId },
      roles: ["company_admin", "manager"],
      dedupeKeyPrefix: `app-recv:${app.id}`,
    });
  },
);

export const onApplicationUpdated = onDocumentUpdated(
  "applications/{applicationId}",
  async (event) => {
    const before = event.data?.before.data();
    const afterRaw = event.data?.after.data();
    if (!before || !afterRaw) return;
    const after: ApplicationDoc = {
      ...(afterRaw as ApplicationDoc),
      id: (afterRaw as ApplicationDoc).id ?? event.params.applicationId,
    };

    await projectApplication(after);

    if (before.status === after.status) return;

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
  },
);

export const onApplicationDeleted = onDocumentWritten(
  "applications/{applicationId}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after && before) {
      await removeApplicationProjections({
        id: (before as ApplicationDoc).id ?? event.params.applicationId,
        candidateId: String((before as ApplicationDoc).candidateId),
        businessId: String((before as ApplicationDoc).businessId),
      });
    }
  },
);

export const onNotificationWritten = onDocumentWritten(
  "notifications/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const id = event.params.id;
    const db = getDatabase();
    if (!after) {
      const before = event.data?.before?.data();
      const uid = before?.userId as string | undefined;
      if (uid) {
        await db.ref().update({
          [`inbox/${uid}/notifications/${id}`]: null,
          [`candidate/${uid}/notifications/${id}`]: null,
        });
      }
      return;
    }
    const uid = String(after.userId);
    const mirror = {
      id,
      userId: uid,
      type: after.type,
      title: after.title,
      body: after.body,
      href: after.href ?? "",
      read: Boolean(after.read),
      createdAt: after.createdAt ?? Date.now(),
      updatedAt: after.updatedAt ?? Date.now(),
      readModelVersion: READ_MODEL_VERSION,
    };
    await db.ref(`inbox/${uid}/notifications/${id}`).set(mirror);
    // Keep candidate mirror in sync when present / for candidate channel items
    const candidateRef = db.ref(`candidate/${uid}/notifications/${id}`);
    const existing = await candidateRef.get();
    if (existing.exists() || String(after.audience ?? "") === "candidate") {
      await candidateRef.set(mirror);
    }
  },
);

export const onBusinessWritten = onDocumentWritten(
  "businesses/{businessId}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const businessId = event.params.businessId;
    if (!after) {
      await getDatabase().ref(`businesses/${businessId}`).remove();
      await getDatabase().ref(`employer/${businessId}/meta`).remove();
      await projectAdminQueueItem("businesses", businessId, null);
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
    const openJobsCount = verified ? await countPublishedJobs(businessId) : 0;

    await projectEmployerMeta(
      businessId,
      { ...after, id: after.id ?? businessId },
      { openJobsCount },
    );

    await projectAdminQueueItem("businesses", businessId, {
      name: after.name,
      status: after.status,
      ownerId: after.ownerId,
      industry: after.industry ?? "",
      location: after.location ?? "",
      companySize: after.companySize ?? "",
      website: after.website ?? "",
      updatedAt: after.updatedAt ?? Date.now(),
    });

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
        openJobsCount,
        readModelVersion: READ_MODEL_VERSION,
      });
    }

    // branding / queue digest paths continue below

    const brandingChanged =
      before?.logoUrl !== after.logoUrl ||
      before?.name !== after.name ||
      before?.description !== after.description;
    if (verified && brandingChanged) {
      const jobsSnap = await getFirestore()
        .collection("jobs")
        .where("businessId", "==", businessId)
        .get();
      const business: BusinessDoc = {
        id: after.id ?? businessId,
        ...after,
      } as BusinessDoc;
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
  },
);

export const onBusinessMemberWritten = onDocumentWritten(
  "businessMembers/{memberId}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const db = getDatabase();
    if (after) {
      const status = (after.status as string | undefined) ?? "active";
      const path = `employerMembers/${after.businessId}/${after.userId}`;
      const reverse = `userEmployerMemberships/${after.userId}/${after.businessId}`;
      if (status === "active") {
        await db.ref(path).set(true);
        await db.ref(reverse).set(true);
      } else {
        await db.ref(path).remove();
        await db.ref(reverse).remove();
      }
      let email = (after.email as string | undefined) ?? undefined;
      let displayName = (after.displayName as string | undefined) ?? undefined;
      const userId = String(after.userId ?? "");
      if (userId && (!email || !displayName)) {
        try {
          const userSnap = await getFirestore().doc(`users/${userId}`).get();
          const u = userSnap.data() ?? {};
          if (!email && u.email) email = String(u.email);
          if (!displayName && u.displayName) displayName = String(u.displayName);
        } catch {
          /* ignore */
        }
      }
      await projectEmployerMember({
        id: (after.id as string) ?? event.params.memberId,
        businessId: String(after.businessId),
        userId,
        role: String(after.role ?? "viewer"),
        status,
        email,
        displayName,
        invitedEmail:
          (after.invitedEmail as string | undefined) ?? email ?? undefined,
      });
      return;
    }
    if (before) {
      await db.ref(`employerMembers/${before.businessId}/${before.userId}`).remove();
      await db.ref(`userEmployerMemberships/${before.userId}/${before.businessId}`).remove();
      await getDatabase()
        .ref(`employer/${before.businessId}/members/${before.userId}`)
        .remove();
    }
  },
);

export const onChangeRequestWritten = onDocumentWritten(
  "changeRequests/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const id = event.params.id;

    if (after) {
      await projectChangeRequest({
        id,
        businessId: after.businessId as string | undefined,
        targetType: String(after.targetType),
        targetId: String(after.targetId),
        status: String(after.status),
        action: after.action ? String(after.action) : undefined,
        submittedBy: after.submittedBy as string | undefined,
        submittedAt: (after.updatedAt ?? after.createdAt ?? after.submittedAt) as
          | number
          | undefined,
        adminNote: after.adminNote as string | undefined,
        title: after.title as string | undefined,
        proposed: (after.proposed as Record<string, unknown> | undefined) ?? {},
        liveSnapshot:
          (after.liveSnapshot as Record<string, unknown> | undefined) ?? {},
      });
    } else {
      await getDatabase().ref(`admin/queues/changeRequests/${id}`).remove();
      if (before?.businessId) {
        await getDatabase()
          .ref(`employer/${before.businessId}/changeRequests/${id}`)
          .remove();
      }
    }

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
          dedupeKey: `cr-ok:${id}`,
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
          dedupeKey: `cr-rej:${id}`,
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
          dedupeKey: `cr-info:${id}`,
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
    const id = event.params.id;
    if (!after) {
      await projectAdminQueueItem("verifications", id, null);
      return;
    }

    const businessId = String(after.businessId ?? "");
    let businessName = "";
    let rotaryContactName = "";
    let rotaryContactClub = "";
    let rotaryContactEmail = "";
    let rotaryContactPhone = "";
    if (businessId) {
      try {
        const bizSnap = await getFirestore().doc(`businesses/${businessId}`).get();
        const biz = bizSnap.data() ?? {};
        businessName = String(biz.name ?? "");
        rotaryContactName = String(biz.rotaryContactName ?? "");
        rotaryContactClub = String(biz.rotaryContactClub ?? "");
        rotaryContactEmail = String(biz.rotaryContactEmail ?? "");
        rotaryContactPhone = String(biz.rotaryContactPhone ?? "");
      } catch {
        /* ignore */
      }
    }

    await projectAdminQueueItem("verifications", id, {
      businessId,
      businessName,
      status: after.status,
      affiliationType: after.affiliationType,
      affiliationDetails: after.affiliationDetails ?? "",
      supportingInfo: after.supportingInfo ?? "",
      adminNote: after.adminNote ?? "",
      submittedBy: after.submittedBy,
      rotaryContactName,
      rotaryContactClub,
      rotaryContactEmail,
      rotaryContactPhone,
      reviewedAt: after.reviewedAt ?? null,
      updatedAt: after.updatedAt ?? Date.now(),
    });

    if (businessId) {
      await projectEmployerVerification(businessId, {
        id,
        status: after.status,
        affiliationType: after.affiliationType,
        affiliationDetails: after.affiliationDetails ?? "",
        supportingInfo: after.supportingInfo ?? "",
        adminNote: after.adminNote ?? "",
        reviewedAt: after.reviewedAt ?? null,
        updatedAt: after.updatedAt ?? Date.now(),
      });
    }

    if (before?.status !== "pending" && after.status === "pending") {
      await notifyPlatformStaff({
        type: "admin_queue_digest",
        title: "New verification pending",
        body: "A business submitted Rotary affiliation for review.",
        href: "/admin/businesses",
        dedupeKeyPrefix: `ver-pend:${id}`,
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
          dedupeKeyPrefix: `ver-dec:${id}:${decision}`,
        });
      }
    }
  },
);

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

  await projectUserSlice(uid, after as Record<string, unknown> | undefined);

  // Phone changes affect candidate profile completion %.
  if (after) {
    const profileSnap = await getFirestore().doc(`candidateProfiles/${uid}`).get();
    if (profileSnap.exists) {
      await syncCandidateDashboardCompletion(
        uid,
        profileSnap.data() as Record<string, unknown>,
        String(after.phone ?? ""),
      );
    }
  }

  if (after) {
    await projectAdminQueueItem("users", uid, {
      email: after.email,
      displayName: after.displayName,
      roles,
      updatedAt: after.updatedAt ?? Date.now(),
    });
  } else {
    await projectAdminQueueItem("users", uid, null);
  }

  const beforeRoles = beforeRoleList.slice().sort().join(",");
  const afterRoles = roles.slice().sort().join(",");
  if (after && beforeRoles !== afterRoles) {
    await getAuth().setCustomUserClaims(uid, { roles });
  }
});

export const onCandidateProfileWritten = onDocumentWritten(
  "candidateProfiles/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after?.data();
    await projectCandidateProfile(uid, after as Record<string, unknown> | undefined);
  },
);

export const onCategoryWritten = onDocumentWritten(
  "categories/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    await projectTaxonomyDoc(
      "categories",
      event.params.id,
      after ? ({ ...after } as Record<string, unknown>) : null,
    );
  },
);

export const onSkillWritten = onDocumentWritten("skills/{id}", async (event) => {
  const after = event.data?.after?.data();
  await projectTaxonomyDoc(
    "skills",
    event.params.id,
    after ? ({ ...after } as Record<string, unknown>) : null,
  );
});

export const onQuestionWritten = onDocumentWritten(
  "questions/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    await projectTaxonomyDoc(
      "questions",
      event.params.id,
      after ? ({ ...after } as Record<string, unknown>) : null,
    );
  },
);

export const onJobQuestionWritten = onDocumentWritten(
  "jobQuestions/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const jobId = String(after?.jobId ?? before?.jobId ?? "");
    if (!jobId) return;
    const jobSnap = await getFirestore().doc(`jobs/${jobId}`).get();
    const businessId = String(jobSnap.data()?.businessId ?? "");
    if (!businessId) return;
    const linksSnap = await getFirestore()
      .collection("jobQuestions")
      .where("jobId", "==", jobId)
      .get();
    await projectJobQuestions(
      jobId,
      businessId,
      linksSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          questionId: String(data.questionId),
          sortOrder: Number(data.sortOrder ?? 0),
          required: Boolean(data.required),
        };
      }),
    );
  },
);

export const onDocumentMetaWritten = onDocumentWritten(
  "documents/{id}",
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const id = event.params.id;
    const candidateId = String(
      after?.candidateId ?? before?.candidateId ?? "",
    );
    if (!candidateId) return;
    await projectCandidateDocument(
      candidateId,
      id,
      after ? ({ ...after, id } as Record<string, unknown>) : null,
    );
  },
);
