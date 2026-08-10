import { get, ref } from "firebase/database";
import { READ_MODEL_VERSION } from "@/shared/constants";
import type { BusinessPublicReadModel } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

function mapBusiness(
  id: string,
  raw: Record<string, unknown>,
): BusinessPublicReadModel | null {
  if (Number(raw.readModelVersion ?? 0) !== READ_MODEL_VERSION) return null;
  if (raw.verified !== true) return null;
  return {
    id: String(raw.id ?? id),
    name: String(raw.name ?? "Company"),
    slug: String(raw.slug ?? ""),
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
    coverUrl: raw.coverUrl ? String(raw.coverUrl) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    website: raw.website ? String(raw.website) : undefined,
    industry: raw.industry ? String(raw.industry) : undefined,
    companySize: raw.companySize ? String(raw.companySize) : undefined,
    location: raw.location ? String(raw.location) : undefined,
    rotaryContactName: raw.rotaryContactName
      ? String(raw.rotaryContactName)
      : undefined,
    rotaryContactClub: raw.rotaryContactClub
      ? String(raw.rotaryContactClub)
      : undefined,
    verified: true,
    openJobsCount: Number(raw.openJobsCount ?? 0),
    readModelVersion: READ_MODEL_VERSION,
  };
}

/** Client list of verified public companies from RTDB. */
export async function listBusinessesPublicRtdb(): Promise<BusinessPublicReadModel[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await get(ref(getClientRtdb(), "businesses"));
    if (!snap.exists()) return [];
    const val = snap.val() as Record<string, Record<string, unknown>>;
    return Object.entries(val)
      .map(([id, raw]) => mapBusiness(id, raw))
      .filter((b): b is BusinessPublicReadModel => Boolean(b?.name))
      .sort((a, b) => {
        if (b.openJobsCount !== a.openJobsCount) {
          return b.openJobsCount - a.openJobsCount;
        }
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}
