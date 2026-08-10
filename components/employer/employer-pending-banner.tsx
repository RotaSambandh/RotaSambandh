"use client";

import Link from "next/link";
import { useActiveBusiness } from "@/components/employer/active-business-provider";

/** Calm status panel while company awaits staff verification. */
export function EmployerPendingBanner() {
  const { business } = useActiveBusiness();
  if (!business || business.status !== "verification_pending") return null;

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">Verification in progress</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            You can draft jobs and manage your company profile. Public listings appear only after
            your business is verified and each job is approved.
          </p>
          <ul className="mt-2 space-y-0.5 text-sm text-[var(--color-muted)]">
            <li>Draft jobs: available</li>
            <li>Invite team: available</li>
            <li>Public listing: after verification and job review</li>
          </ul>
        </div>
        <Link
          href="/employer/company"
          className="shrink-0 text-sm font-medium text-[var(--color-accent-strong)] underline-offset-2 hover:underline"
        >
          View company status
        </Link>
      </div>
    </div>
  );
}
