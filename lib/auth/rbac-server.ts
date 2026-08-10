import type { SessionUser } from "@/lib/auth/session";
import { isPlatformAdmin, isPlatformStaff, isSuperAdmin } from "@/shared/rbac";
import type { UserRole } from "@/shared/types";

export function sessionRoles(user: SessionUser | null): UserRole[] {
  return user?.roles ?? [];
}

export function assertPlatformStaff(user: SessionUser | null): void {
  if (!isPlatformStaff(sessionRoles(user))) {
    throw new Error("Forbidden");
  }
}

export function assertPlatformAdmin(user: SessionUser | null): void {
  if (!isPlatformAdmin(sessionRoles(user))) {
    throw new Error("Forbidden");
  }
}

export function assertSuperAdmin(user: SessionUser | null): void {
  if (!isSuperAdmin(sessionRoles(user))) {
    throw new Error("Forbidden");
  }
}

export function canUsePrivilegedWrite(user: SessionUser | null): boolean {
  return isPlatformAdmin(sessionRoles(user));
}
