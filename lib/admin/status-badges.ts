import type { ApplicationStatus } from "@/shared/types";
import {
  applicationStatusLabel,
  applicationStatusTone,
  type StatusTone,
} from "@/lib/ui/status-labels";

/** @deprecated Prefer applicationStatusTone from lib/ui/status-labels */
export function applicationStatusVariant(status: ApplicationStatus): StatusTone {
  return applicationStatusTone(status);
}

export { applicationStatusLabel };
