"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import type { Portal } from "@/lib/auth/portal";
import { canAccessPortal, portalHome, portalSignInPath } from "@/lib/auth/portal";
import { isPlatformStaff } from "@/shared/rbac";

export function RequireAuth({
  children,
  portal = "candidate",
}: {
  children: ReactNode;
  /** Portal this surface belongs to (controls sign-in URL and role gate). */
  portal?: Portal;
}) {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const qs = searchParams.toString();
      const next = `${pathname}${qs ? `?${qs}` : ""}`;
      const signIn = portalSignInPath(portal);
      router.replace(`${signIn}?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!canAccessPortal(roles, portal)) {
      router.replace(
        portalHome(
          isPlatformStaff(roles) ? "admin" : roles.includes("employer") ? "employer" : "candidate",
        ),
      );
    }
  }, [loading, user, roles, router, pathname, searchParams, portal]);

  // Session already known (e.g. warm AuthProvider) — render chrome without a full-page gate.
  if (user && canAccessPortal(roles, portal)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
        Checking your session…
      </main>
    );
  }

  if (!user) return null;
  if (!canAccessPortal(roles, portal)) return null;
  return <>{children}</>;
}
