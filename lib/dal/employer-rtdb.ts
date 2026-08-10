import { get, ref } from "firebase/database";
import type {
  Business,
  BusinessMember,
  BusinessStatus,
  ChangeRequest,
  Job,
  JobStatus,
  JobType,
  WorkplaceType,
} from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

export async function listBusinessJobsRtdb(businessId: string): Promise<Job[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(ref(getClientRtdb(), `employer/${businessId}/jobs`));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val)
      .map((j) => ({
        id: String(j.id),
        businessId,
        title: String(j.title ?? ""),
        description: String(j.description ?? ""),
        responsibilities: j.responsibilities
          ? String(j.responsibilities)
          : undefined,
        requirements: j.requirements ? String(j.requirements) : undefined,
        benefits: j.benefits ? String(j.benefits) : undefined,
        skills: Array.isArray(j.skills) ? (j.skills as string[]) : [],
        categoryIds: [],
        createdBy: "",
        status: (j.status as JobStatus) ?? "draft",
        type: (j.type as JobType) ?? "full_time",
        workplace: (j.workplace as WorkplaceType) ?? "remote",
        location: String(j.location ?? ""),
        salaryDisplay: j.salaryDisplay ? String(j.salaryDisplay) : undefined,
        industry: j.industry ? String(j.industry) : undefined,
        postedAt: Number(j.postedAt ?? 0) || undefined,
        deadline: j.deadline ? Number(j.deadline) : undefined,
        featured: Boolean(j.featured),
        slug: "",
        createdAt: Number(j.postedAt ?? 0),
        updatedAt: Number(j.postedAt ?? 0),
      }))
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

export async function getEmployerJobRtdb(
  businessId: string,
  jobId: string,
): Promise<Job | null> {
  const jobs = await listBusinessJobsRtdb(businessId);
  return jobs.find((j) => j.id === jobId) ?? null;
}

export async function getEmployerMetaRtdb(
  businessId: string,
): Promise<Business | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await get(ref(getClientRtdb(), `employer/${businessId}/meta`));
    if (!snap.exists()) return null;
    const m = snap.val() as Record<string, unknown>;
    return {
      id: String(m.id ?? businessId),
      name: String(m.name ?? ""),
      slug: String(m.slug ?? ""),
      logoUrl: m.logoUrl ? String(m.logoUrl) : undefined,
      coverUrl: m.coverUrl ? String(m.coverUrl) : undefined,
      description: m.description ? String(m.description) : undefined,
      website: m.website ? String(m.website) : undefined,
      industry: m.industry ? String(m.industry) : undefined,
      companySize: m.companySize ? String(m.companySize) : undefined,
      location: m.location ? String(m.location) : undefined,
      status: (m.status as BusinessStatus) ?? "draft",
      ownerId: String(m.ownerId ?? ""),
      rotaryContactName: m.rotaryContactName
        ? String(m.rotaryContactName)
        : undefined,
      rotaryContactClub: m.rotaryContactClub
        ? String(m.rotaryContactClub)
        : undefined,
      rotaryContactEmail: m.rotaryContactEmail
        ? String(m.rotaryContactEmail)
        : undefined,
      rotaryContactPhone: m.rotaryContactPhone
        ? String(m.rotaryContactPhone)
        : undefined,
      createdAt: Number(m.updatedAt ?? 0),
      updatedAt: Number(m.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}

/** Discover businesses the user can access via reverse membership index. */
export async function listOwnedBusinessesRtdb(
  userId: string,
): Promise<Business[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const mine = await get(
      ref(getClientRtdb(), `userEmployerMemberships/${userId}`),
    );
    if (!mine.exists()) return [];
    const bizIds = Object.keys(mine.val() as Record<string, boolean>);
    const businesses: Business[] = [];
    for (const id of bizIds) {
      const meta = await getEmployerMetaRtdb(id);
      if (meta) businesses.push(meta);
    }
    businesses.sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
    return businesses;
  } catch {
    return [];
  }
}

export async function resolveActiveBusinessRtdb(
  userId: string,
  preferredId?: string | null,
): Promise<{ businesses: Business[]; business: Business | null }> {
  const businesses = await listOwnedBusinessesRtdb(userId);
  if (businesses.length === 0) return { businesses, business: null };

  let preferred = preferredId ?? null;
  if (!preferred) {
    try {
      const userSnap = await get(ref(getClientRtdb(), `users/${userId}`));
      preferred =
        (userSnap.val()?.activeBusinessId as string | undefined) || null;
    } catch {
      preferred = null;
    }
  }
  const match = preferred
    ? businesses.find((b) => b.id === preferred)
    : undefined;
  return { businesses, business: match ?? businesses[0] ?? null };
}

export async function listEmployerMembersRtdb(
  businessId: string,
): Promise<BusinessMember[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(
      ref(getClientRtdb(), `employer/${businessId}/members`),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val).map((m) => ({
      id: String(m.id ?? `${businessId}_${m.userId}`),
      businessId,
      userId: String(m.userId ?? ""),
      role: m.role as BusinessMember["role"],
      status: m.status as BusinessMember["status"],
      invitedEmail: m.invitedEmail ? String(m.invitedEmail) : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}

export async function listChangeRequestsForBusinessRtdb(
  businessId: string,
): Promise<ChangeRequest[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(
      ref(getClientRtdb(), `employer/${businessId}/changeRequests`),
    );
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.values(val)
      .map(
        (c) =>
          ({
            id: String(c.id),
            businessId,
            targetType: c.targetType as ChangeRequest["targetType"],
            targetId: String(c.targetId ?? ""),
            action: "update" as ChangeRequest["action"],
            proposed: {},
            status: c.status as ChangeRequest["status"],
            submittedBy: String(c.submittedBy ?? ""),
            adminNote: c.adminNote ? String(c.adminNote) : undefined,
            createdAt: Number(c.submittedAt ?? 0),
            updatedAt: Number(c.submittedAt ?? 0),
          }) satisfies ChangeRequest,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}
