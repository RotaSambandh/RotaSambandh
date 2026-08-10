import type { ApplicationReadModel } from "@/lib/dal/applications-rtdb";
import type { ApplicationStatus } from "@/shared/types";

export type JobApplicantStats = {
  total: number;
  /** Status still `applied` — not yet reviewed. */
  new: number;
  underReview: number;
  shortlisted: number;
  interview: number;
  selected: number;
  rejected: number;
  withdrawn: number;
};

export function emptyJobApplicantStats(): JobApplicantStats {
  return {
    total: 0,
    new: 0,
    underReview: 0,
    shortlisted: 0,
    interview: 0,
    selected: 0,
    rejected: 0,
    withdrawn: 0,
  };
}

function bump(stats: JobApplicantStats, status: ApplicationStatus) {
  stats.total += 1;
  switch (status) {
    case "applied":
      stats.new += 1;
      break;
    case "under_review":
      stats.underReview += 1;
      break;
    case "shortlisted":
      stats.shortlisted += 1;
      break;
    case "interview":
      stats.interview += 1;
      break;
    case "selected":
      stats.selected += 1;
      break;
    case "rejected":
      stats.rejected += 1;
      break;
    case "withdrawn":
      stats.withdrawn += 1;
      break;
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      break;
    }
  }
}

/** Aggregate employer application read models by jobId. */
export function statsByJobId(
  applications: ApplicationReadModel[],
): Record<string, JobApplicantStats> {
  const out: Record<string, JobApplicantStats> = {};
  for (const app of applications) {
    const stats = out[app.jobId] ?? emptyJobApplicantStats();
    bump(stats, app.status);
    out[app.jobId] = stats;
  }
  return out;
}

/** Compact caption for a job list row. */
export function formatJobApplicantStats(stats: JobApplicantStats | undefined): string {
  if (!stats || stats.total === 0) return "No applicants yet";
  const parts = [`${stats.total} applicant${stats.total === 1 ? "" : "s"}`];
  if (stats.new > 0) parts.push(`${stats.new} new`);
  if (stats.underReview > 0) parts.push(`${stats.underReview} under review`);
  if (stats.shortlisted > 0) parts.push(`${stats.shortlisted} shortlisted`);
  if (stats.interview > 0) parts.push(`${stats.interview} interview`);
  if (stats.selected > 0) parts.push(`${stats.selected} selected`);
  if (stats.rejected > 0) parts.push(`${stats.rejected} rejected`);
  return parts.join(" · ");
}
