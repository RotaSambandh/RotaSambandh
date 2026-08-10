"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { isCoordinator, isPlatformAdmin, isPlatformStaff, isSuperAdmin } from "@/shared/rbac";

export function usePlatformAccess() {
  const { roles } = useAuth();
  return {
    roles,
    isStaff: isPlatformStaff(roles),
    canWrite: isPlatformAdmin(roles),
    isSuperAdmin: isSuperAdmin(roles),
    isCoordinator: isCoordinator(roles),
  };
}
