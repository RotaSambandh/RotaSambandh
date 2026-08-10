import type { JobType, WorkplaceType } from "@/shared/types";

/** True if applications are still accepted (no deadline or deadline not passed). */
export function isJobOpenForApplications(job: { deadline?: number | null }): boolean {
  if (job.deadline == null) return true;
  return job.deadline >= Date.now();
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  fellowship: "Fellowship",
  contract: "Contract",
  freelance: "Freelance",
};

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On-site",
};
