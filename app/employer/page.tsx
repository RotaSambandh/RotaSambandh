"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { getEmployerDashboard } from "@/lib/dal/dashboards-client";
import { listChangeRequestsForBusiness } from "@/lib/dal/change-requests";
import type { ChangeRequest, EmployerDashboardProjection } from "@/shared/types";

export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const { business, loading: bizLoading } = useActiveBusiness();
  const [dashboard, setDashboard] = useState<EmployerDashboardProjection | null>(null);
  const [pendingCrs, setPendingCrs] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || bizLoading) return;
    void (async () => {
      setLoading(true);
      if (!business) {
        setDashboard(null);
        setPendingCrs([]);
        setLoading(false);
        return;
      }
      const [dash, crs] = await Promise.all([
        getEmployerDashboard(business.id),
        listChangeRequestsForBusiness(business.id),
      ]);
      setDashboard(dash);
      setPendingCrs(crs.filter((cr) => cr.status === "pending_review"));
      setLoading(false);
    })();
  }, [user, business, bizLoading]);

  if (!user || bizLoading || loading) {
    return <LoadingBlock label="Loading dashboard…" />;
  }

  if (!business) {
    return (
      <main>
        <PageHeader
          title="Dashboard"
          description="Snapshot of hiring activity across your verified business."
        />
        <EmptyState
          title="No company profile yet"
          description="Create your business profile to post opportunities and review applicants."
          action={
            <Link href="/employer/company">
              <Button>Set up company</Button>
            </Link>
          }
        />
      </main>
    );
  }

  const stats = [
    ["Active jobs", dashboard?.activeJobs ?? 0],
    ["Applications", dashboard?.applications ?? 0],
    ["New applications", dashboard?.newApplications ?? 0],
    ["Shortlisted", dashboard?.shortlisted ?? 0],
    ["Interviews", dashboard?.interviews ?? 0],
    ["Selected", dashboard?.selected ?? 0],
  ] as const;

  return (
    <main>
      <PageHeader
        title="Dashboard"
        description={`Hiring snapshot for ${business.name}. Draft jobs anytime; public listings need verification and job review. Open a job to review its applicants.`}
        actions={
          <Link href="/employer/jobs">
            <Button>Go to jobs</Button>
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="border-b border-[var(--color-border)] pb-3">
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {pendingCrs.length > 0 && (
        <Panel title="Pending change requests" className="mt-8">
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            {pendingCrs.length} submission{pendingCrs.length === 1 ? "" : "s"} awaiting admin review.
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {pendingCrs.map((cr) => (
              <li key={cr.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  {cr.title ?? `${cr.action} ${cr.targetType}`} ·{" "}
                  <span className="text-[var(--color-muted)]">{cr.targetType}</span>
                </span>
                <Link
                  href="/employer/company"
                  className="font-semibold text-[var(--color-accent-strong)] hover:underline"
                >
                  View details
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-8 text-sm text-[var(--color-muted)]">
        Recruiter flow:{" "}
        <Link href="/employer/jobs" className="font-semibold text-[var(--color-accent-strong)]">
          Jobs
        </Link>{" "}
        → select an opportunity → manage applicants for that role.
      </p>
    </main>
  );
}
