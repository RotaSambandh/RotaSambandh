"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DesktopSideNav, MobileNav } from "@/components/layout/mobile-nav";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { RequireAuth } from "@/components/auth/require-auth";
import { CandidateOnboardingGate } from "@/components/auth/candidate-onboarding-gate";
import { EmployerOnboardingGate } from "@/components/auth/employer-onboarding-gate";
import { Suspense } from "react";
import { isAdminAuthPath, isEmployerAuthPath } from "@/lib/auth/portal";
import { usePushRegistration } from "@/lib/push/use-push-registration";
import { NotificationPermissionBanner } from "@/components/notifications/notification-permission-banner";

function PushRegistrationHost() {
  usePushRegistration();
  return null;
}

export function RoleShell({
  role,
  children,
  dense = true,
}: {
  role: "candidate" | "employer" | "admin";
  children: ReactNode;
  dense?: boolean;
}) {
  const pathname = usePathname();
  const publicAuth =
    (role === "employer" && isEmployerAuthPath(pathname)) ||
    (role === "admin" && isAdminAuthPath(pathname)) ||
    (role === "candidate" && pathname.startsWith("/candidate/onboarding"));

  if (publicAuth) {
    return <>{children}</>;
  }

  const body = (
    <div className={`flex min-h-screen flex-col bg-[var(--color-surface)] ${dense ? "text-sm" : ""}`}>
      <PushRegistrationHost />
      <NotificationPermissionBanner />
      <div className="flex min-h-0 flex-1">
        <DesktopSideNav role={role} />
        <div className="min-w-0 flex-1 pb-36 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
          <SidebarAccount role={role} variant="mobile" />
          <MobileNav role={role} />
        </div>
      </div>
    </div>
  );

  let gated = body;
  if (role === "candidate") {
    gated = <CandidateOnboardingGate>{body}</CandidateOnboardingGate>;
  } else if (role === "employer") {
    gated = <EmployerOnboardingGate>{body}</EmployerOnboardingGate>;
  }

  return (
    <Suspense fallback={null}>
      <RequireAuth portal={role}>{gated}</RequireAuth>
    </Suspense>
  );
}
