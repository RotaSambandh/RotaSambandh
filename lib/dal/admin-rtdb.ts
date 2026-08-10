import { get, ref } from "firebase/database";
import type {
  Business,
  BusinessVerification,
  Category,
  Job,
  JobStatus,
  Question,
  Report,
  Skill,
  UserDoc,
  UserRole,
} from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import type { ChangeRequest } from "@/shared/types";

function jobStub(partial: Partial<Job> & Pick<Job, "id" | "businessId" | "title" | "status">): Job {
  return {
    description: "",
    skills: [],
    categoryIds: [],
    createdBy: "",
    type: "full_time",
    workplace: "remote",
    slug: "",
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

async function listQueue<T>(
  path: string,
  map: (id: string, raw: Record<string, unknown>) => T,
): Promise<T[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(ref(getClientRtdb(), path));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.entries(val).map(([id, raw]) => map(id, raw));
  } catch {
    return [];
  }
}

export async function listPendingVerificationsRtdb(): Promise<
  BusinessVerification[]
> {
  const all = await listQueue("admin/queues/verifications", (id, v) => ({
    id,
    businessId: String(v.businessId ?? ""),
    submittedBy: String(v.submittedBy ?? ""),
    affiliationType: v.affiliationType as BusinessVerification["affiliationType"],
    affiliationDetails: "",
    status: v.status as BusinessVerification["status"],
    createdAt: Number(v.updatedAt ?? 0),
    updatedAt: Number(v.updatedAt ?? 0),
  }));
  return all.filter((v) => v.status === "pending");
}

export async function listPendingJobsRtdb(): Promise<Job[]> {
  const all = await listQueue("admin/queues/jobs", (id, j) =>
    jobStub({
      id,
      businessId: String(j.businessId ?? ""),
      title: String(j.title ?? ""),
      status: (j.status as JobStatus) ?? "pending_review",
      type: (j.type as Job["type"]) ?? "full_time",
      workplace: (j.workplace as Job["workplace"]) ?? "remote",
      createdAt: Number(j.updatedAt ?? 0),
      updatedAt: Number(j.updatedAt ?? 0),
    }),
  );
  return all.filter((j) => j.status === "pending_review");
}

export async function listAdminQueueJobsRtdb(): Promise<Job[]> {
  return listQueue("admin/queues/jobs", (id, j) =>
    jobStub({
      id,
      businessId: String(j.businessId ?? ""),
      title: String(j.title ?? ""),
      status: (j.status as JobStatus) ?? "draft",
      type: (j.type as Job["type"]) ?? "full_time",
      workplace: (j.workplace as Job["workplace"]) ?? "remote",
      createdAt: Number(j.updatedAt ?? 0),
      updatedAt: Number(j.updatedAt ?? 0),
    }),
  );
}

export async function listAdminQueueBusinessesRtdb(): Promise<Business[]> {
  return listQueue("admin/queues/businesses", (id, b) => ({
    id,
    name: String(b.name ?? ""),
    slug: "",
    status: b.status as Business["status"],
    ownerId: String(b.ownerId ?? ""),
    createdAt: Number(b.updatedAt ?? 0),
    updatedAt: Number(b.updatedAt ?? 0),
  }));
}

export async function listReportsRtdb(): Promise<Report[]> {
  return listQueue("admin/queues/reports", (id, r) => ({
    id,
    targetType: r.targetType as Report["targetType"],
    targetId: String(r.targetId ?? ""),
    reason: r.reason as Report["reason"],
    status: (r.status as Report["status"]) ?? "open",
    reporterId: "",
    createdAt: Number(r.createdAt ?? 0),
    updatedAt: Number(r.createdAt ?? 0),
  }));
}

export async function listPendingChangeRequestsRtdb(): Promise<ChangeRequest[]> {
  const all = await listQueue("admin/queues/changeRequests", (id, c) => ({
    id,
    businessId: String(c.businessId ?? ""),
    targetType: c.targetType as ChangeRequest["targetType"],
    targetId: String(c.targetId ?? ""),
    action: "update" as ChangeRequest["action"],
    proposed: {},
    status: c.status as ChangeRequest["status"],
    submittedBy: String(c.submittedBy ?? ""),
    adminNote: c.adminNote ? String(c.adminNote) : undefined,
    createdAt: Number(c.submittedAt ?? 0),
    updatedAt: Number(c.submittedAt ?? 0),
  }));
  return all.filter((c) => c.status === "pending_review");
}

export async function listStaffUsersRtdb(): Promise<UserDoc[]> {
  return listQueue("admin/queues/users", (id, u) => ({
    uid: id,
    email: String(u.email ?? ""),
    displayName: String(u.displayName ?? ""),
    roles: (u.roles as UserRole[]) ?? [],
    createdAt: Number(u.updatedAt ?? 0),
    updatedAt: Number(u.updatedAt ?? 0),
  }));
}

export async function listCategoriesRtdb(): Promise<Category[]> {
  return listQueue("system/taxonomy/categories", (id, c) => ({
    id,
    name: String(c.name ?? ""),
    slug: String(c.slug ?? id),
    active: c.active !== false,
    createdAt: Number(c.createdAt ?? 0),
    updatedAt: Number(c.updatedAt ?? 0),
  })).then((list) => list.filter((c) => c.active));
}

export async function listSkillsRtdb(): Promise<Skill[]> {
  return listQueue("system/taxonomy/skills", (id, s) => ({
    id,
    name: String(s.name ?? ""),
    slug: String(s.slug ?? id),
    active: s.active !== false,
    createdAt: Number(s.createdAt ?? 0),
    updatedAt: Number(s.updatedAt ?? 0),
  })).then((list) => list.filter((s) => s.active));
}

export async function listQuestionsRtdb(): Promise<Question[]> {
  return listQueue("system/taxonomy/questions", (id, q) => ({
    id,
    scope: (q.scope as Question["scope"]) ?? "platform",
    businessId: q.businessId ? String(q.businessId) : undefined,
    jobId: q.jobId ? String(q.jobId) : undefined,
    prompt: String(q.prompt ?? ""),
    type: q.type as Question["type"],
    options: q.options as Question["options"],
    required: Boolean(q.required),
    active: q.active !== false,
    version: Number(q.version ?? 1),
    platformKey: q.platformKey ? String(q.platformKey) : undefined,
    createdAt: Number(q.createdAt ?? 0),
    updatedAt: Number(q.updatedAt ?? 0),
  }));
}

export async function getQuestionRtdb(id: string): Promise<Question | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await get(
      ref(getClientRtdb(), `system/taxonomy/questions/${id}`),
    );
    if (!snap.exists()) return null;
    const q = snap.val() as Record<string, unknown>;
    return {
      id,
      scope: (q.scope as Question["scope"]) ?? "platform",
      businessId: q.businessId ? String(q.businessId) : undefined,
      jobId: q.jobId ? String(q.jobId) : undefined,
      prompt: String(q.prompt ?? ""),
      type: q.type as Question["type"],
      options: q.options as Question["options"],
      required: Boolean(q.required),
      active: q.active !== false,
      version: Number(q.version ?? 1),
      platformKey: q.platformKey ? String(q.platformKey) : undefined,
      createdAt: Number(q.createdAt ?? 0),
      updatedAt: Number(q.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}
