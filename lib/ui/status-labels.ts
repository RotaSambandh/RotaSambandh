import type {
  ApplicationStatus,
  BusinessStatus,
  ChangeRequestStatus,
  JobStatus,
} from "@/shared/types";

export type StatusTone = "default" | "success" | "warning" | "neutral" | "danger";

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function jobStatusTone(status: JobStatus | string): StatusTone {
  switch (status) {
    case "published":
      return "success";
    case "pending_review":
      return "warning";
    case "draft":
    case "closed":
    case "filled":
    case "expired":
      return "neutral";
    default:
      return "neutral";
  }
}

export function jobStatusLabel(status: JobStatus | string): string {
  switch (status) {
    case "pending_review":
      return "Pending review";
    case "published":
      return "Published";
    case "draft":
      return "Draft";
    case "closed":
      return "Closed";
    case "filled":
      return "Filled";
    case "expired":
      return "Expired";
    default:
      return humanize(String(status));
  }
}

export function businessStatusTone(status: BusinessStatus | string): StatusTone {
  switch (status) {
    case "verified":
      return "success";
    case "verification_pending":
      return "warning";
    case "suspended":
    case "deletion_pending":
      return "danger";
    case "draft":
      return "neutral";
    default:
      return "neutral";
  }
}

export function businessStatusLabel(status: BusinessStatus | string): string {
  switch (status) {
    case "verification_pending":
      return "Pending verification";
    case "deletion_pending":
      return "Pending deletion";
    case "verified":
      return "Verified";
    case "draft":
      return "Draft";
    case "suspended":
      return "Suspended";
    default:
      return humanize(String(status));
  }
}

export function changeRequestStatusTone(status: ChangeRequestStatus | string): StatusTone {
  switch (status) {
    case "approved":
      return "success";
    case "pending_review":
    case "info_requested":
      return "warning";
    case "rejected":
      return "danger";
    case "draft":
      return "neutral";
    default:
      return "neutral";
  }
}

export function changeRequestStatusLabel(status: ChangeRequestStatus | string): string {
  switch (status) {
    case "pending_review":
      return "Pending review";
    case "info_requested":
      return "Info requested";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "draft":
      return "Draft";
    default:
      return humanize(String(status));
  }
}

export function applicationStatusTone(status: ApplicationStatus): StatusTone {
  switch (status) {
    case "selected":
      return "success";
    case "shortlisted":
    case "interview":
      return "warning";
    case "rejected":
    case "withdrawn":
      return "danger";
    case "applied":
    case "under_review":
      return "neutral";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "under_review":
      return "Under review";
    case "applied":
      return "Applied";
    case "shortlisted":
      return "Shortlisted";
    case "interview":
      return "Interview";
    case "selected":
      return "Selected";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
