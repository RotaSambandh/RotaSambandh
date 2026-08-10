"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeCandidateApplicationsRtdb } from "@/lib/dal/applications-rtdb";
import {
  applicationStatusLabel,
  applicationStatusVariant,
} from "@/lib/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { Banner, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import type { ApplicationStatus } from "@/shared/types";

type ApplicationRow = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  submittedAt: number;
  title: string;
  companyLabel: string;
  companyRemoved?: boolean;
};

function ApplicationsPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get("submitted") === "1";
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeCandidateApplicationsRtdb(uid, (list) => {
      setItems(
        list.map((app) => ({
          id: app.id,
          jobId: app.jobId,
          status: app.status,
          submittedAt: app.submittedAt,
          title: app.jobTitle,
          companyLabel: app.companyRemoved
            ? `${app.companyName} (removed)`
            : app.companyName,
          companyRemoved: app.companyRemoved,
        })),
      );
      setLoading(false);
    });
  }, [user]);

  if (loading) return <LoadingBlock label="Loading applications…" />;

  const syncing = justSubmitted && items.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Applications"
        description="Track status updates in real time when available."
      />

      {syncing ? (
        <Banner tone="success" title="Application submitted">
          Syncing your application into this list…
        </Banner>
      ) : null}

      {items.length === 0 && !syncing ? (
        <EmptyState
          title="No applications yet"
          description="When you apply to a role, it will appear here with live status updates."
          action={
            <Link
              href="/jobs"
              className="text-sm font-medium text-[var(--color-accent-strong)]"
            >
              Browse opportunities
            </Link>
          }
        />
      ) : items.length === 0 ? (
        <LoadingBlock label="Waiting for sync…" />
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="border border-[var(--color-border)] bg-white px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {item.companyLabel}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Submitted {new Date(item.submittedAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={applicationStatusVariant(item.status)}>
                  {applicationStatusLabel(item.status)}
                </Badge>
              </div>
              {item.companyRemoved ? (
                <Banner
                  className="mt-3"
                  tone="warning"
                  title="Company left the network"
                >
                  Your application history is preserved.
                </Banner>
              ) : null}
              <Link
                href={`/jobs/${item.jobId}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--color-accent-strong)]"
              >
                View role
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading applications…" />}>
      <ApplicationsPageInner />
    </Suspense>
  );
}
