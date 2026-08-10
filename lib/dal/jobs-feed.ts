import { get, ref } from "firebase/database";
import { FEED_PAGE_SIZE, READ_MODEL_VERSION } from "@/shared/constants";
import type { JobFeedItem, JobSearchFilters } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";

export function filterJobFeedItems(
  items: JobFeedItem[],
  filters: JobSearchFilters = {},
): JobFeedItem[] {
  let result = items.filter((j) => isJobOpenForApplications(j));

  const q = filters.q?.trim();
  if (q) {
    const needle = q.toLowerCase();
    result = result.filter(
      (j) =>
        j.title.toLowerCase().includes(needle) ||
        j.company.toLowerCase().includes(needle) ||
        j.skills.some((s) => s.toLowerCase().includes(needle)) ||
        (j.location ?? "").toLowerCase().includes(needle),
    );
  }
  if (filters.type) result = result.filter((j) => j.type === filters.type);
  if (filters.workplace) {
    result = result.filter((j) => j.workplace === filters.workplace);
  }
  if (filters.location) {
    const loc = filters.location.toLowerCase();
    result = result.filter((j) => (j.location ?? "").toLowerCase().includes(loc));
  }
  if (filters.skill) {
    const skill = filters.skill.toLowerCase();
    result = result.filter((j) => j.skills.some((s) => s.toLowerCase().includes(skill)));
  }

  const sort = filters.sort ?? "newest";
  switch (sort) {
    case "deadline":
      result.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
      break;
    case "salary":
      result.sort((a, b) => (b.salary ?? "").localeCompare(a.salary ?? ""));
      break;
    case "relevance":
      break;
    case "newest":
      result.sort((a, b) => b.postedAt - a.postedAt);
      break;
    default: {
      const _exhaustive: never = sort;
      void _exhaustive;
      break;
    }
  }

  return result;
}

function mapFeedValue(val: Record<string, unknown>, limit?: number): JobFeedItem[] {
  const items = Object.entries(val)
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
    .sort((a, b) => b.postedAt - a.postedAt);
  if (limit != null) return items.slice(0, limit);
  return items;
}

/** Public candidate feed via client RTDB (`feeds/` is world-readable). */
export async function listJobFeedRtdb(
  channel = "latest",
  options?: { limit?: number },
): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(ref(getClientRtdb(), `feeds/${channel}`));
    if (!snap.exists()) return [];
    return mapFeedValue(
      snap.val() as Record<string, unknown>,
      options?.limit ?? FEED_PAGE_SIZE,
    );
  } catch {
    return [];
  }
}

/** Full channel for client-side pagination / load-more. */
export async function listJobFeedAllRtdb(channel = "latest"): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(ref(getClientRtdb(), `feeds/${channel}`));
    if (!snap.exists()) return [];
    return mapFeedValue(snap.val() as Record<string, unknown>);
  } catch {
    return [];
  }
}
