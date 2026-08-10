import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, READ_MODEL_VERSION } from "@/shared/constants";
import type { BusinessPublicReadModel, JobFeedItem } from "@/shared/types";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";

export async function getBusinessPublic(
  businessId: string,
): Promise<BusinessPublicReadModel | null> {
  const cached = unstable_cache(
    async () => {
      if (!isFirebaseConfigured()) return null;
      try {
        const snap = await getAdminRtdb().ref(`businesses/${businessId}`).get();
        if (!snap.exists()) return null;
        const data = snap.val() as BusinessPublicReadModel & {
          openJobs?: Record<string, unknown>;
        };
        if (data.readModelVersion !== READ_MODEL_VERSION) return null;
        const { openJobs: _openJobs, ...business } = data;
        void _openJobs;
        return business as BusinessPublicReadModel;
      } catch {
        return null;
      }
    },
    [`business-${businessId}-v4`],
    { revalidate: 120, tags: [CACHE_TAGS.business(businessId)] },
  );
  return cached();
}

export async function getBusinessBySlug(slug: string) {
  if (!isFirebaseConfigured()) return null;
  return (await getBusinessPublic(slug)) ?? null;
}

function mapOpenJobs(val: Record<string, unknown>, businessId: string): JobFeedItem[] {
  return Object.entries(val)
    .map(([id, raw]) => {
      const j = raw as Record<string, unknown>;
      return {
        id: String(j.id ?? id),
        title: String(j.title ?? ""),
        company: String(j.company ?? "Company"),
        companyLogo: j.companyLogo ? String(j.companyLogo) : undefined,
        businessId: String(j.businessId ?? businessId),
        location: j.location ? String(j.location) : undefined,
        workplace: j.workplace as JobFeedItem["workplace"],
        type: j.type as JobFeedItem["type"],
        salary: j.salary ? String(j.salary) : undefined,
        skills: Array.isArray(j.skills) ? (j.skills as string[]) : [],
        postedAt: Number(j.postedAt ?? 0),
        deadline: j.deadline != null ? Number(j.deadline) : undefined,
        featured: Boolean(j.featured),
        readModelVersion: Number(j.readModelVersion ?? 0),
      } satisfies JobFeedItem;
    })
    .filter((j) => j.readModelVersion === READ_MODEL_VERSION)
    .filter((j) => isJobOpenForApplications(j))
    .sort((a, b) => b.postedAt - a.postedAt);
}

/** Prefer business-scoped openJobs projection; empty if missing. */
export async function getBusinessOpenJobs(businessId: string): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getAdminRtdb().ref(`businesses/${businessId}/openJobs`).get();
    if (!snap.exists()) return [];
    return mapOpenJobs(snap.val() as Record<string, unknown>, businessId);
  } catch {
    return [];
  }
}
