import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, READ_MODEL_VERSION } from "@/shared/constants";
import type { BusinessPublicReadModel } from "@/shared/types";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getJobFeed } from "@/lib/dal/jobs";

export async function getBusinessPublic(
  businessId: string,
): Promise<BusinessPublicReadModel | null> {
  const cached = unstable_cache(
    async () => {
      if (!isFirebaseConfigured()) return null;
      try {
        const snap = await getAdminRtdb().ref(`businesses/${businessId}`).get();
        if (!snap.exists()) return null;
        const data = snap.val() as BusinessPublicReadModel;
        if (data.readModelVersion !== READ_MODEL_VERSION) return null;
        return data;
      } catch {
        return null;
      }
    },
    [`business-${businessId}-v3`],
    { revalidate: 120, tags: [CACHE_TAGS.business(businessId)] },
  );
  return cached();
}

export async function getBusinessBySlug(slug: string) {
  if (!isFirebaseConfigured()) return null;
  return (await getBusinessPublic(slug)) ?? null;
}

export async function getBusinessOpenJobs(businessId: string) {
  const feed = await getJobFeed();
  return feed.filter((j) => j.businessId === businessId);
}
