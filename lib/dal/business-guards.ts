import type { Business } from "@/shared/types";

export function assertBusinessAcceptsMutations(business: Pick<Business, "status" | "name">): void {
  if (business.status === "deletion_pending") {
    throw new Error(
      `${business.name} is pending deletion. Wait for admin restore or permanent removal.`,
    );
  }
}

export function isBusinessDeletionPending(business: Pick<Business, "status"> | null | undefined): boolean {
  return business?.status === "deletion_pending";
}
