import { get, ref } from "firebase/database";
import type { JobDetailReadModel } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

/** Browser-side job detail read (candidate apply/saved flows). */
export async function getJobDetail(jobId: string): Promise<JobDetailReadModel | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await get(ref(getClientRtdb(), `jobs/${jobId}`));
    if (!snap.exists()) return null;
    return snap.val() as JobDetailReadModel;
  } catch {
    return null;
  }
}
