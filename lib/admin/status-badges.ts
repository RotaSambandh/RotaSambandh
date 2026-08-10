import type { ApplicationStatus } from "@/shared/types";

type BadgeVariant = "default" | "success" | "warning" | "neutral" | "danger";

export function applicationStatusVariant(status: ApplicationStatus): BadgeVariant {
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
  return status.replaceAll("_", " ");
}
