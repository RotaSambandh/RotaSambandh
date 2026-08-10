import "server-only";
import { getAdminRtdb } from "@/lib/firebase/admin";

/** Remove public / employer job projections (Admin SDK). */
export async function removeJobProjections(
  jobId: string,
  type?: string,
  workplace?: string,
  businessId?: string,
) {
  const updates: Record<string, null> = {
    [`jobs/${jobId}`]: null,
    [`feeds/latest/${jobId}`]: null,
  };
  if (type) updates[`feeds/${type}/${jobId}`] = null;
  if (workplace) updates[`feeds/${workplace}/${jobId}`] = null;
  if (businessId) updates[`employer/${businessId}/jobs/${jobId}`] = null;
  await getAdminRtdb().ref().update(updates);
}

export async function invalidateNetlifyCache(tags: string[]) {
  const siteId = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteId || !token || tags.length === 0) return;

  await fetch(`https://api.netlify.com/api/v1/purge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: siteId, cache_tags: tags }),
  }).catch(() => undefined);
}
