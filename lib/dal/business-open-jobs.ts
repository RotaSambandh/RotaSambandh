import { get, ref } from "firebase/database";
import { READ_MODEL_VERSION } from "@/shared/constants";
import type { JobFeedItem } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";

function mapOpenJobs(val: Record<string, unknown>): JobFeedItem[] {
  return Object.entries(val)
    .map(([id, raw]) => {
      const j = raw as Record<string, unknown>;
      return {
        id: String(j.id ?? id),
        title: String(j.title ?? ""),
        company: String(j.company ?? "Company"),
        companyLogo: j.companyLogo ? String(j.companyLogo) : undefined,
        businessId: String(j.businessId ?? ""),
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

/** Business-scoped open jobs from RTDB (`businesses/{id}/openJobs`). */
export async function listBusinessOpenJobsRtdb(
  businessId: string,
): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured() || !businessId) return [];
  try {
    const snap = await get(ref(getClientRtdb(), `businesses/${businessId}/openJobs`));
    if (!snap.exists()) return [];
    return mapOpenJobs(snap.val() as Record<string, unknown>);
  } catch {
    return [];
  }
}
