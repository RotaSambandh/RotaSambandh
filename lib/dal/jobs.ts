import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, FEED_PAGE_SIZE } from "@/shared/constants";
import type { JobDetailReadModel, JobFeedItem, JobSearchFilters } from "@/shared/types";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { filterJobFeedItems } from "@/lib/dal/jobs-feed";
import { READ_MODEL_VERSION } from "@/shared/constants";

export {
  isJobOpenForApplications,
  JOB_TYPE_LABELS,
  WORKPLACE_LABELS,
} from "@/lib/dal/job-meta";

async function fetchFeedFromRtdb(channel: string): Promise<JobFeedItem[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    // Plain get: avoids orderByChild index requirements and silent empty feeds.
    const snap = await getAdminRtdb().ref(`feeds/${channel}`).get();
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, JobFeedItem>;
    return Object.values(val)
      .filter((j) => j && j.readModelVersion === READ_MODEL_VERSION)
      .sort((a, b) => b.postedAt - a.postedAt)
      .slice(0, FEED_PAGE_SIZE);
  } catch (err) {
    console.error("[getJobFeed] RTDB feed read failed", channel, err);
    return [];
  }
}

export async function getJobFeed(
  filters: JobSearchFilters = {},
  channel = "latest",
): Promise<JobFeedItem[]> {
  const cached = unstable_cache(
    async () => fetchFeedFromRtdb(channel),
    [`job-feed-${channel}-v4`],
    { revalidate: 60, tags: [CACHE_TAGS.feed(channel)] },
  );
  const items = await cached();
  return filterJobFeedItems(items, filters).slice(0, FEED_PAGE_SIZE);
}

export async function getJobDetail(jobId: string): Promise<JobDetailReadModel | null> {
  const cached = unstable_cache(
    async () => {
      if (!isFirebaseConfigured()) return null;
      try {
        const snap = await getAdminRtdb().ref(`jobs/${jobId}`).get();
        if (!snap.exists()) return null;
        return snap.val() as JobDetailReadModel;
      } catch (err) {
        console.error("[getJobDetail] RTDB read failed", jobId, err);
        return null;
      }
    },
    [`job-detail-${jobId}-v2`],
    { revalidate: 60, tags: [CACHE_TAGS.job(jobId)] },
  );
  return cached();
}
