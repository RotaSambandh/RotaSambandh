import "server-only";
import type {
  CandidateDashboardProjection,
  EmployerDashboardProjection,
  SystemCounters,
} from "@/shared/types";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/client";

const emptyCandidate: CandidateDashboardProjection = {
  applications: 0,
  underReview: 0,
  interviews: 0,
  savedJobs: 0,
  profileCompletion: 0,
  readModelVersion: 1,
};

const emptyEmployer: EmployerDashboardProjection = {
  activeJobs: 0,
  applications: 0,
  newApplications: 0,
  shortlisted: 0,
  interviews: 0,
  selected: 0,
  readModelVersion: 1,
};

const emptyAdmin: SystemCounters = {
  registeredUsers: 0,
  businesses: 0,
  activeJobs: 0,
  applications: 0,
  pendingBusinesses: 0,
  pendingJobs: 0,
  pendingBusinessDeletions: 0,
  placements: 0,
  updatedAt: 0,
  readModelVersion: 1,
};

export async function getCandidateDashboard(
  candidateId: string,
): Promise<CandidateDashboardProjection> {
  if (!isFirebaseConfigured()) return emptyCandidate;
  try {
    const snap = await getAdminRtdb().ref(`candidate/${candidateId}/dashboard`).get();
    if (!snap.exists()) return emptyCandidate;
    return snap.val() as CandidateDashboardProjection;
  } catch {
    return emptyCandidate;
  }
}

export async function getEmployerDashboard(
  businessId: string,
): Promise<EmployerDashboardProjection> {
  if (!isFirebaseConfigured()) return emptyEmployer;
  try {
    const snap = await getAdminRtdb().ref(`employer/${businessId}/dashboard`).get();
    if (!snap.exists()) return emptyEmployer;
    return snap.val() as EmployerDashboardProjection;
  } catch {
    return emptyEmployer;
  }
}

export async function getAdminDashboard(): Promise<SystemCounters> {
  if (!isFirebaseConfigured()) return emptyAdmin;
  try {
    const snap = await getAdminRtdb().ref(`admin/dashboard`).get();
    if (!snap.exists()) return emptyAdmin;
    return snap.val() as SystemCounters;
  } catch {
    return emptyAdmin;
  }
}
