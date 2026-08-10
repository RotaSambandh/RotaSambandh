"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canApplyToJobs,
  getCandidateProfile,
  getUser,
} from "@/lib/dal/users";
import { LoadingBlock } from "@/components/ui";

/**
 * Soft-gate: browsing jobs/companies/home is allowed without a full profile.
 * Apply requires club + district + phone (see canApplyToJobs).
 */
export function CandidateOnboardingGate({ children }: { children: ReactNode }) {
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
      if (pathname.startsWith("/candidate/onboarding")) {
        if (!cancelled) setReady(true);
        return;
      }

      const needsApplyGate =
        pathname.startsWith("/candidate/apply") || pathname.includes("/apply/");

      if (!needsApplyGate) {
        if (!cancelled) setReady(true);
        return;
      }

      const [profile, userDoc] = await Promise.all([
        getCandidateProfile(user.uid),
        getUser(user.uid),
      ]);
      if (cancelled) return;
      if (!canApplyToJobs(profile, userDoc)) {
        const next = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
        router.replace(
          `/candidate/onboarding?next=${encodeURIComponent(next || "/candidate")}`,
        );
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
