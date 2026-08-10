import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";
import { countPublishedJobs } from "./employer";

/** Public company card under `businesses/{id}` — verified businesses only. */
export async function projectPublicBusiness(
  businessId: string,
  data: Record<string, unknown>,
  openJobsCount?: number,
) {
  const db = getDatabase();
  const verified = data.status === "verified";
  if (!verified) {
    await db.ref(`businesses/${businessId}`).remove();
    return;
  }

  const count =
    openJobsCount ??
    (typeof data.openJobsCount === "number"
      ? data.openJobsCount
      : await countPublishedJobs(businessId));

  // Preserve openJobs children by updating fields at the root (not full replace of subtree).
  // Using update with explicit nulls for removed optional fields is awkward; set the root
  // fields via update paths so openJobs/{jobId} nodes are not wiped.
  const root: Record<string, unknown> = {
    id: data.id ?? businessId,
    name: data.name ?? "",
    slug: data.slug ?? "",
    logoUrl: data.logoUrl ?? null,
    coverUrl: data.coverUrl ?? null,
    description: data.description ?? null,
    website: data.website ?? null,
    industry: data.industry ?? null,
    companySize: data.companySize ?? null,
    location: data.location ?? null,
    rotaryContactName: data.rotaryContactName ?? null,
    rotaryContactClub: data.rotaryContactClub ?? null,
    verified: true,
    openJobsCount: count,
    readModelVersion: READ_MODEL_VERSION,
  };

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(root)) {
    updates[`businesses/${businessId}/${key}`] = value;
  }
  await db.ref().update(updates);
}

export async function removePublicBusiness(businessId: string) {
  await getDatabase().ref(`businesses/${businessId}`).remove();
}
