"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { isEmployerBusinessOnboarded, listOwnedBusinesses } from "@/lib/dal/employer";
import { LoadingBlock } from "@/components/ui";

/** First-time employers must finish the company wizard before the portal. */
export function EmployerOnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (loading) return;
      if (!user) {
        if (!cancelled) setReady(true);
        return;
      }
      if (pathname.startsWith("/employer/onboarding") || pathname.startsWith("/employer/sign-")) {
        if (!cancelled) setReady(true);
        return;
      }
      const businesses = await listOwnedBusinesses(user.uid);
      if (cancelled) return;
      const hasCompleted = businesses.some(isEmployerBusinessOnboarded);
      if (!hasCompleted) {
        router.replace("/employer/onboarding");
        return;
      }
      setReady(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, loading, pathname, router]);

  if (loading || !ready) {
    return <LoadingBlock label="Preparing your workspace…" />;
  }
  return <>{children}</>;
}
