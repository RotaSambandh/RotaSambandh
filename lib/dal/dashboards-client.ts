import { get, ref } from "firebase/database";
import type { EmployerDashboardProjection } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

const emptyEmployer: EmployerDashboardProjection = {
  activeJobs: 0,
  applications: 0,
  newApplications: 0,
  shortlisted: 0,
  interviews: 0,
  selected: 0,
  readModelVersion: 1,
};

/** Browser-side RTDB read (authenticated employer session). */
export async function getEmployerDashboard(
  businessId: string,
): Promise<EmployerDashboardProjection> {
  if (!isFirebaseConfigured()) return emptyEmployer;
  try {
    const snap = await get(ref(getClientRtdb(), `employer/${businessId}/dashboard`));
    if (!snap.exists()) return emptyEmployer;
    return snap.val() as EmployerDashboardProjection;
  } catch {
    return emptyEmployer;
  }
}
