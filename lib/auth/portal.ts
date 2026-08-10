import type { UserRole } from "@/shared/types";

export type Portal = "candidate" | "employer" | "admin";

export function portalHome(portal: Portal): string {
  switch (portal) {
    case "candidate":
      return "/candidate";
    case "employer":
      return "/employer";
    case "admin":
      return "/admin";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

export function portalSignInPath(portal: Portal): string {
  switch (portal) {
    case "candidate":
      return "/auth/sign-in";
    case "employer":
      return "/employer/sign-in";
    case "admin":
      return "/admin/sign-in";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

export function portalSignUpPath(portal: "candidate" | "employer"): string {
  switch (portal) {
    case "candidate":
      return "/auth/sign-in";
    case "employer":
      return "/employer/sign-up";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

/** Map a protected path to the correct portal sign-in. */
export function signInPathForProtectedPath(pathname: string): string {
  if (pathname === "/employer" || pathname.startsWith("/employer/")) {
    if (pathname === "/employer/sign-in" || pathname === "/employer/sign-up") {
      return "/employer/sign-in";
    }
    return "/employer/sign-in";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "/admin/sign-in";
  }
  return "/auth/sign-in";
}

export function isEmployerAuthPath(pathname: string): boolean {
  return (
    pathname === "/employer/sign-in" ||
    pathname === "/employer/sign-up" ||
    pathname.startsWith("/employer/onboarding")
  );
}

export function isAdminAuthPath(pathname: string): boolean {
  return pathname === "/admin/sign-in";
}

export function canAccessPortal(roles: UserRole[], portal: Portal): boolean {
  switch (portal) {
    case "admin":
      return (
        roles.includes("super_admin") ||
        roles.includes("admin") ||
        roles.includes("coordinator")
      );
    case "employer":
      return roles.includes("employer");
    case "candidate":
      // Candidate portal is available to every signed-in account (multi-role friendly).
      return true;
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

/** Portals this account may open (for switcher UI). Candidate always included. */
export function accessiblePortals(roles: UserRole[]): Portal[] {
  const portals: Portal[] = ["candidate"];
  if (canAccessPortal(roles, "employer")) portals.push("employer");
  if (canAccessPortal(roles, "admin")) portals.push("admin");
  return portals;
}

export function portalLabel(portal: Portal): string {
  switch (portal) {
    case "candidate":
      return "Candidate";
    case "employer":
      return "Employer";
    case "admin":
      return "Admin";
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

export function homeForRoles(roles: UserRole[], preferred?: Portal): string {
  if (preferred === "admin" && canAccessPortal(roles, "admin")) return "/admin";
  if (preferred === "employer" && roles.includes("employer")) return "/employer";
  if (preferred === "candidate") return "/candidate";
  if (canAccessPortal(roles, "admin")) return "/admin";
  if (roles.includes("employer")) return "/employer";
  return "/candidate";
}
