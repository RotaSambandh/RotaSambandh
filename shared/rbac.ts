import type { BusinessMember, BusinessMemberRole, UserRole } from "@/shared/types";

export const PLATFORM_WRITE_ROLES: UserRole[] = ["super_admin", "admin"];
export const PLATFORM_STAFF_ROLES: UserRole[] = ["super_admin", "admin", "coordinator"];

export function hasAnyRole(roles: UserRole[] | undefined, needed: UserRole[]): boolean {
  if (!roles?.length) return false;
  return needed.some((r) => roles.includes(r));
}

/** Super admin or admin — can mutate platform trust ops. */
export function isPlatformAdmin(roles: UserRole[] | undefined): boolean {
  return hasAnyRole(roles, PLATFORM_WRITE_ROLES);
}

export function isSuperAdmin(roles: UserRole[] | undefined): boolean {
  return Boolean(roles?.includes("super_admin"));
}

export function isCoordinator(roles: UserRole[] | undefined): boolean {
  return Boolean(roles?.includes("coordinator")) && !isPlatformAdmin(roles);
}

/** Anyone who may enter /admin (including read-only coordinators). */
export function isPlatformStaff(roles: UserRole[] | undefined): boolean {
  return hasAnyRole(roles, PLATFORM_STAFF_ROLES);
}

/** Legacy `admin` alone still counts as platform admin for backwards compatibility. */
export function normalizePlatformRoles(roles: UserRole[]): UserRole[] {
  return Array.from(new Set(roles));
}

export function normalizeBusinessMemberRole(
  role: BusinessMember["role"] | string | undefined,
): BusinessMemberRole {
  if (role === "company_admin" || role === "owner") return "company_admin";
  return "manager";
}

export function isCompanyAdmin(member: Pick<BusinessMember, "role"> | null | undefined): boolean {
  if (!member) return false;
  return normalizeBusinessMemberRole(member.role) === "company_admin";
}

export function canManageBusinessTeam(member: Pick<BusinessMember, "role"> | null | undefined): boolean {
  return isCompanyAdmin(member);
}
