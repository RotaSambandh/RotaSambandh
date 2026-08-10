import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, FEED_PAGE_SIZE, READ_MODEL_VERSION } from "@/shared/constants";
import type { JobDetailReadModel, JobFeedItem, JobSearchFilters } from "@/shared/types";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";

export {
  isJobOpenForApplications,
  JOB_TYPE_LABELS,
  WORKPLACE_LABELS,
} from "@/lib/dal/job-meta";

function filterJobs(items: JobFeedItem[], filters: JobSearchFilters = {}): JobFeedItem[] {
  // Hard rule: past-deadline jobs never appear in candidate feeds
  let result = items.filter((j) => isJobOpenForApplications(j));

  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.skills.some((s) => s.toLowerCase().includes(q)) ||
        (j.location ?? "").toLowerCase().includes(q),
    );
  }
  if (filters.type) result = result.filter((j) => j.type === filters.type);
  if (filters.workplace) result = result.filter((j) => j.workplace === filters.workplace);
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

async function fetchFeedFromRtdb(channel: string): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getAdminRtdb()
      .ref(`feeds/${channel}`)
      .orderByChild("postedAt")
      .limitToLast(FEED_PAGE_SIZE)
      .get();
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, JobFeedItem>;
    return Object.values(val)
      .filter((j) => j.readModelVersion === READ_MODEL_VERSION)
      .sort((a, b) => b.postedAt - a.postedAt);
  } catch {
    return [];
  }
}

export async function getJobFeed(
  filters: JobSearchFilters = {},
  channel = "latest",
): Promise<JobFeedItem[]> {
  const cached = unstable_cache(
    async () => fetchFeedFromRtdb(channel),
    [`job-feed-${channel}-v3`],
    { revalidate: 60, tags: [CACHE_TAGS.feed(channel)] },
  );
  const items = await cached();
  return filterJobs(items, filters).slice(0, FEED_PAGE_SIZE);
}

export async function getJobDetail(jobId: string): Promise<JobDetailReadModel | null> {
  const cached = unstable_cache(
    async () => {
      if (!isFirebaseConfigured()) return null;
      try {
        const snap = await getAdminRtdb().ref(`jobs/${jobId}`).get();
        if (!snap.exists()) return null;
        return snap.val() as JobDetailReadModel;
      } catch {
        return null;
      }
    },
    [`job-detail-${jobId}-v2`],
    { revalidate: 60, tags: [CACHE_TAGS.job(jobId)] },
  );
  return cached();
}
