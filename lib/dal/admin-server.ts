import "server-only";
import type {
  AdminAction,
  Job,
  ReportStatus,
} from "@/shared/types";
import { getAdminFirestore } from "@/lib/firebase/admin";

function tsNow() {
  return Date.now();
}

async function logAdminAction(input: Omit<AdminAction, "id" | "createdAt" | "updatedAt">) {
  const ts = tsNow();
  const ref = getAdminFirestore().collection("adminActions").doc();
  await ref.set({ ...input, id: ref.id, createdAt: ts, updatedAt: ts });
}

export async function reviewVerificationAdmin(input: {
  verificationId: string;
  businessId: string;
  adminId: string;
  decision: "approved" | "rejected" | "info_requested";
  adminNote?: string;
}) {
  const db = getAdminFirestore();
  const ts = tsNow();
  await db.collection("businessVerifications").doc(input.verificationId).update({
    status: input.decision,
    adminNote: input.adminNote ?? null,
    reviewedBy: input.adminId,
    reviewedAt: ts,
    updatedAt: ts,
  });

  if (input.decision === "approved") {
    await db.collection("businesses").doc(input.businessId).update({
      status: "verified",
      verifiedAt: ts,
      updatedAt: ts,
    });
  } else if (input.decision === "rejected") {
    await db.collection("businesses").doc(input.businessId).update({
      status: "draft",
      updatedAt: ts,
    });
  }

  await logAdminAction({
    adminId: input.adminId,
    action: `verification_${input.decision}`,
    targetType: "business",
    targetId: input.businessId,
    note: input.adminNote,
  });
}

export async function moderateJobAdmin(input: {
  jobId: string;
  adminId: string;
  decision: "published" | "rejected" | "closed";
  note?: string;
  featured?: boolean;
}) {
  const db = getAdminFirestore();
  const ts = tsNow();
  const patch: Partial<Job> & { updatedAt: number } = {
    status: input.decision === "rejected" ? "draft" : input.decision,
    updatedAt: ts,
    featured: input.featured,
  };
  if (input.decision === "published") patch.postedAt = ts;
  if (input.decision === "closed") patch.closedAt = ts;

  await db.collection("jobs").doc(input.jobId).update(patch);
  await logAdminAction({
    adminId: input.adminId,
    action: `job_${input.decision}`,
    targetType: "job",
    targetId: input.jobId,
    note: input.note,
  });
}

export async function setUserSuspendedAdmin(input: {
  userId: string;
  adminId: string;
  suspended: boolean;
}) {
  const db = getAdminFirestore();
  await db.collection("users").doc(input.userId).update({
    suspended: input.suspended,
    updatedAt: tsNow(),
  });
  await logAdminAction({
    adminId: input.adminId,
    action: input.suspended ? "user_suspend" : "user_restore",
    targetType: "user",
    targetId: input.userId,
  });
}

export async function resolveReportAdmin(input: {
  reportId: string;
  adminId: string;
  status: Extract<ReportStatus, "resolved" | "dismissed">;
}) {
  const db = getAdminFirestore();
  const ts = tsNow();
  await db.collection("reports").doc(input.reportId).update({
    status: input.status,
    resolvedBy: input.adminId,
    resolvedAt: ts,
    updatedAt: ts,
  });
}

const BUSINESS_CR_ALLOWLIST = [
  "name",
  "description",
  "website",
  "industry",
  "companySize",
  "location",
  "logoUrl",
  "coverUrl",
  "socialLinks",
  "rotaryContactName",
  "rotaryContactClub",
  "rotaryContactEmail",
  "rotaryContactPhone",
] as const;

const JOB_CR_ALLOWLIST = [
  "title",
  "description",
  "responsibilities",
  "requirements",
  "benefits",
  "skills",
  "type",
  "workplace",
  "location",
  "salaryDisplay",
  "salaryMin",
  "salaryMax",
  "experienceMin",
  "experienceMax",
  "industry",
  "deadline",
  "categoryIds",
] as const;

function pickAllowlisted(
  proposed: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(proposed, key) && proposed[key] !== undefined) {
      out[key] = proposed[key];
    }
  }
  return out;
}

export async function mergeChangeRequestAdmin(input: {
  changeRequestId: string;
  adminId: string;
  decision: "approved" | "rejected" | "info_requested";
  adminNote?: string;
  slugify: (value: string) => string;
}) {
  const db = getAdminFirestore();
  const ref = db.collection("changeRequests").doc(input.changeRequestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Change request not found");
  const cr = snap.data() as {
    id: string;
    targetType: "business" | "job";
    targetId: string;
    action: string;
    proposed: Record<string, unknown>;
  };
  const ts = tsNow();

  if (input.decision !== "approved") {
    if (!input.adminNote?.trim()) {
      throw new Error("Admin note required for reject or info request");
    }
    await ref.update({
      status: input.decision,
      adminNote: input.adminNote,
      reviewedBy: input.adminId,
      reviewedAt: ts,
      updatedAt: ts,
    });
    await db.collection("adminActions").add({
      adminId: input.adminId,
      action: `change_request_${input.decision}`,
      targetType: "changeRequest",
      targetId: cr.id,
      note: input.adminNote,
      createdAt: ts,
      updatedAt: ts,
    });
    return { ok: true };
  }

  if (cr.targetType === "business") {
    const proposed = pickAllowlisted(cr.proposed ?? {}, BUSINESS_CR_ALLOWLIST);
    const patch: Record<string, unknown> = { ...proposed, updatedAt: ts };
    if (typeof proposed.name === "string" && proposed.name) {
      patch.slug = input.slugify(proposed.name);
    }
    if (cr.action === "create") {
      patch.status = "verified";
      patch.verifiedAt = ts;
    }
    await db.collection("businesses").doc(cr.targetId).set(patch, { merge: true });
  }

  if (cr.targetType === "job") {
    const proposed = pickAllowlisted(cr.proposed ?? {}, JOB_CR_ALLOWLIST);
    const patch: Record<string, unknown> = { ...proposed, updatedAt: ts };
    if (typeof proposed.title === "string" && proposed.title) {
      patch.slug = input.slugify(proposed.title);
    }
    if (cr.action === "create" || cr.action === "update") {
      patch.status = "published";
      patch.postedAt = ts;
    }
    if (cr.action === "close") {
      patch.status = "closed";
      patch.closedAt = ts;
    }
    await db.collection("jobs").doc(cr.targetId).set(patch, { merge: true });
  }

  await ref.update({
    status: "approved",
    adminNote: input.adminNote ?? null,
    reviewedBy: input.adminId,
    reviewedAt: ts,
    updatedAt: ts,
  });

  await db.collection("adminActions").add({
    adminId: input.adminId,
    action: "change_request_approved",
    targetType: cr.targetType,
    targetId: cr.targetId,
    note: input.adminNote,
    createdAt: ts,
    updatedAt: ts,
  });

  return { ok: true };
}

/** Used by upload complete — Admin SDK write + size/key checks happen in the route. */
export async function createDocumentMetaAdmin(input: {
  id: string;
  candidateId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  kind: "resume" | "portfolio" | "certificate" | "other";
}) {
  const db = getAdminFirestore();
  const ts = tsNow();
  const meta = { ...input, createdAt: ts, updatedAt: ts };
  await db.collection("documents").doc(input.id).set(meta);
  if (input.isPrimary && input.kind === "resume") {
    await db
      .collection("candidateProfiles")
      .doc(input.candidateId)
      .set({ primaryResumeId: input.id, updatedAt: ts }, { merge: true })
      .catch(() => undefined);
  }
  return meta;
}
