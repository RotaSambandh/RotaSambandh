"use client";

import Link from "next/link";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import { Banner } from "@/components/ui";

/** Persistent honesty banner while company awaits staff verification. */
export function EmployerPendingBanner() {
  const { business } = useActiveBusiness();
  if (!business || business.status !== "verification_pending") return null;

  return (
    <div className="border-b border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-4 py-3 sm:px-6">
      <Banner tone="warning" title="Verification in progress">
        <p className="text-sm">
          You can draft jobs and manage your company profile. Public listings appear only after
          staff verify your business <strong>and</strong> approve each job for review.{" "}
          <Link href="/employer/company" className="font-semibold underline">
            View company status
          </Link>
        </p>
        <ul className="mt-2 list-inside list-disc text-sm">
          <li>Draft jobs — available</li>
          <li>Invite team — available</li>
          <li>Public listing — after verification + job review</li>
        </ul>
      </Banner>
    </div>
  );
}
