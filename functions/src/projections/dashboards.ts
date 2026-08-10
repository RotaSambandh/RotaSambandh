import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";

export async function bumpEmployerStats(
  businessId: string,
  deltas: Partial<
    Record<
      "applications" | "newApplications" | "shortlisted" | "interviews" | "selected" | "activeJobs",
      number
    >
  >,
) {
  const dashRef = getDatabase().ref(`employer/${businessId}/dashboard`);
  await dashRef.transaction((current) => {
    const c = (current ?? {
      activeJobs: 0,
      applications: 0,
      newApplications: 0,
      shortlisted: 0,
      interviews: 0,
      selected: 0,
    }) as Record<string, number>;
    return {
      activeJobs: (c.activeJobs ?? 0) + (deltas.activeJobs ?? 0),
      applications: (c.applications ?? 0) + (deltas.applications ?? 0),
      newApplications: (c.newApplications ?? 0) + (deltas.newApplications ?? 0),
      shortlisted: (c.shortlisted ?? 0) + (deltas.shortlisted ?? 0),
      interviews: (c.interviews ?? 0) + (deltas.interviews ?? 0),
      selected: (c.selected ?? 0) + (deltas.selected ?? 0),
      readModelVersion: READ_MODEL_VERSION,
    };
  });
}

export async function bumpCandidateStats(
  candidateId: string,
  deltas: Partial<
    Record<"applications" | "underReview" | "interviews" | "savedJobs" | "profileCompletion", number>
  >,
) {
  const dashRef = getDatabase().ref(`candidate/${candidateId}/dashboard`);
  await dashRef.transaction((current) => {
    const c = (current ?? {
      applications: 0,
      underReview: 0,
      interviews: 0,
      savedJobs: 0,
      profileCompletion: 0,
    }) as Record<string, number>;
    return {
      applications: (c.applications ?? 0) + (deltas.applications ?? 0),
      underReview: (c.underReview ?? 0) + (deltas.underReview ?? 0),
      interviews: (c.interviews ?? 0) + (deltas.interviews ?? 0),
      savedJobs: (c.savedJobs ?? 0) + (deltas.savedJobs ?? 0),
      profileCompletion: deltas.profileCompletion ?? c.profileCompletion ?? 0,
      readModelVersion: READ_MODEL_VERSION,
    };
  });
}

export async function bumpAdminCounters(
  deltas: Partial<
    Record<
      | "registeredUsers"
      | "businesses"
      | "activeJobs"
      | "applications"
      | "pendingBusinesses"
      | "pendingJobs"
      | "pendingBusinessDeletions"
      | "placements",
      number
    >
  >,
) {
  const db = getDatabase();
  const ref = db.ref("admin/dashboard");
  const result = await ref.transaction((current) => {
    const c = (current ?? {
      registeredUsers: 0,
      businesses: 0,
      activeJobs: 0,
      applications: 0,
      pendingBusinesses: 0,
      pendingJobs: 0,
      pendingBusinessDeletions: 0,
      placements: 0,
    }) as Record<string, number>;
    return {
      registeredUsers: (c.registeredUsers ?? 0) + (deltas.registeredUsers ?? 0),
      businesses: (c.businesses ?? 0) + (deltas.businesses ?? 0),
      activeJobs: (c.activeJobs ?? 0) + (deltas.activeJobs ?? 0),
      applications: (c.applications ?? 0) + (deltas.applications ?? 0),
      pendingBusinesses: (c.pendingBusinesses ?? 0) + (deltas.pendingBusinesses ?? 0),
      pendingJobs: (c.pendingJobs ?? 0) + (deltas.pendingJobs ?? 0),
      pendingBusinessDeletions:
        (c.pendingBusinessDeletions ?? 0) + (deltas.pendingBusinessDeletions ?? 0),
      placements: (c.placements ?? 0) + (deltas.placements ?? 0),
      updatedAt: Date.now(),
      readModelVersion: READ_MODEL_VERSION,
    };
  });

  const next = result.snapshot.val();
  if (next) await db.ref("system/counters").set(next);
}
