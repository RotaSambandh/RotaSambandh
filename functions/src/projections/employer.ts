import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { READ_MODEL_VERSION } from "../constants";
import type { BusinessDoc, JobDoc } from "./jobs";

/** Employer workspace job — all statuses (full fields for edit UI; not public feeds). */
export async function projectEmployerJob(job: JobDoc, business?: BusinessDoc | null) {
  const db = getDatabase();
  await db.ref(`employer/${job.businessId}/jobs/${job.id}`).set({
    id: job.id,
    title: job.title,
    description: job.description ?? "",
    responsibilities: job.responsibilities ?? "",
    requirements: job.requirements ?? "",
    benefits: job.benefits ?? "",
    skills: job.skills ?? [],
    status: job.status,
    type: job.type,
    workplace: job.workplace,
    location: job.location ?? "",
    salaryDisplay: job.salaryDisplay ?? "",
    industry: job.industry ?? "",
    postedAt: job.postedAt ?? Date.now(),
    deadline: job.deadline ?? null,
    featured: job.featured ?? false,
    company: business?.name ?? "",
    companyLogo: business?.logoUrl ?? "",
    readModelVersion: READ_MODEL_VERSION,
  });
}

export async function removeEmployerJob(businessId: string, jobId: string) {
  await getDatabase().ref(`employer/${businessId}/jobs/${jobId}`).remove();
}

export async function projectEmployerMeta(
  businessId: string,
  data: Record<string, unknown>,
  extras?: { openJobsCount?: number },
) {
  await getDatabase()
    .ref(`employer/${businessId}/meta`)
    .set({
      id: businessId,
      name: data.name ?? "",
      slug: data.slug ?? "",
      logoUrl: data.logoUrl ?? "",
      coverUrl: data.coverUrl ?? "",
      description: data.description ?? "",
      website: data.website ?? "",
      industry: data.industry ?? "",
      companySize: data.companySize ?? "",
      location: data.location ?? "",
      status: data.status ?? "draft",
      ownerId: data.ownerId ?? "",
      rotaryContactName: data.rotaryContactName ?? "",
      rotaryContactClub: data.rotaryContactClub ?? "",
      rotaryContactEmail: data.rotaryContactEmail ?? "",
      rotaryContactPhone: data.rotaryContactPhone ?? "",
      openJobsCount:
        extras?.openJobsCount ??
        (typeof data.openJobsCount === "number" ? data.openJobsCount : 0),
      readModelVersion: READ_MODEL_VERSION,
      updatedAt: data.updatedAt ?? Date.now(),
    });
}

export async function projectEmployerMember(member: {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  status: string;
  email?: string;
  displayName?: string;
  invitedEmail?: string;
}) {
  const db = getDatabase();
  const path = `employer/${member.businessId}/members/${member.userId}`;
  if (member.status === "active" || member.status === "invited") {
    const email = member.email || member.invitedEmail || "";
    await db.ref(path).set({
      id: member.id,
      businessId: member.businessId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      email,
      displayName: member.displayName ?? "",
      invitedEmail: member.invitedEmail ?? email,
      readModelVersion: READ_MODEL_VERSION,
    });
  } else {
    await db.ref(path).remove();
  }
}

/** Latest verification feedback mirror for the employer company page. */
export async function projectEmployerVerification(
  businessId: string,
  data: Record<string, unknown> | null,
) {
  const ref = getDatabase().ref(`employer/${businessId}/verification`);
  if (!data) {
    await ref.remove();
    return;
  }
  await ref.set({
    id: data.id ?? "",
    status: data.status ?? "pending",
    affiliationType: data.affiliationType ?? "",
    affiliationDetails: data.affiliationDetails ?? "",
    supportingInfo: data.supportingInfo ?? "",
    adminNote: data.adminNote ?? "",
    reviewedAt: data.reviewedAt ?? null,
    updatedAt: data.updatedAt ?? Date.now(),
    readModelVersion: READ_MODEL_VERSION,
  });
}

export async function projectChangeRequest(cr: {
  id: string;
  businessId?: string;
  targetType: string;
  targetId: string;
  status: string;
  action?: string;
  submittedBy?: string;
  submittedAt?: number;
  adminNote?: string;
  title?: string;
  proposed?: Record<string, unknown>;
  liveSnapshot?: Record<string, unknown>;
}) {
  const db = getDatabase();
  const payload = {
    id: cr.id,
    businessId: cr.businessId ?? "",
    targetType: cr.targetType,
    targetId: cr.targetId,
    status: cr.status,
    action: cr.action ?? "update",
    submittedBy: cr.submittedBy ?? "",
    submittedAt: cr.submittedAt ?? Date.now(),
    adminNote: cr.adminNote ?? "",
    title: cr.title ?? "",
    proposed: cr.proposed ?? {},
    liveSnapshot: cr.liveSnapshot ?? {},
    readModelVersion: READ_MODEL_VERSION,
  };
  // Admin queue = open work only; employer mirror keeps history.
  const updates: Record<string, unknown> = {
    [`admin/queues/changeRequests/${cr.id}`]:
      cr.status === "pending_review" ? payload : null,
  };
  if (cr.businessId) {
    updates[`employer/${cr.businessId}/changeRequests/${cr.id}`] = payload;
  }
  await db.ref().update(updates);
}

export async function countPublishedJobs(businessId: string): Promise<number> {
  const snap = await getFirestore()
    .collection("jobs")
    .where("businessId", "==", businessId)
    .where("status", "==", "published")
    .get();
  return snap.size;
}
