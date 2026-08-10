"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listCandidateApplications } from "@/lib/dal/applications";
import { getJobById } from "@/lib/dal/employer";
import {
  applicationStatusLabel,
  applicationStatusVariant,
} from "@/lib/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { Banner, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { getDoc, doc } from "firebase/firestore";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import type { Application, Business } from "@/shared/types";

type ApplicationRow = Application & {
  title: string;
  companyLabel: string;
  deletionPending?: boolean;
};

async function loadBusiness(businessId: string): Promise<Business | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "businesses", businessId));
  return snap.exists() ? (snap.data() as Business) : null;
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = user?.uid ?? "demo_candidate";
    void (async () => {
      const list = await listCandidateApplications(uid);
      const rows = await Promise.all(
        list.map(async (app) => {
          if (app.companyRemoved) {
            return {
              ...app,
              title: app.jobTitleSnapshot ?? "Role",
              companyLabel: app.companyNameSnapshot ?? "Company removed",
            };
          }
          const [job, business] = await Promise.all([
            getJobById(app.jobId),
            loadBusiness(app.businessId),
          ]);
          return {
            ...app,
            title: job?.title ?? app.jobTitleSnapshot ?? "Opportunity",
            companyLabel: business?.name ?? app.companyNameSnapshot ?? "Company",
            deletionPending: business?.status === "deletion_pending",
          };
        }),
      );
      setItems(rows);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingBlock label="Loading applications…" />;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Applications"
        description="Track status updates in real time when available."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="When you apply to a role, it will appear here with live status updates."
          action={
            <Link
              href="/jobs"
              className="text-sm font-semibold text-[var(--color-accent-strong)] hover:underline"
            >
              Browse opportunities
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] bg-white">
          {items.map((app) => (
            <li key={app.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {app.companyRemoved ? (
                    <p className="font-semibold text-[var(--color-ink)]">{app.title}</p>
                  ) : (
                    <Link
                      href={`/jobs/${app.jobId}`}
                      className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]"
                    >
                      {app.title}
                    </Link>
                  )}
                  <p className="text-sm text-[var(--color-muted)]">
                    {app.companyLabel} · Submitted{" "}
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={applicationStatusVariant(app.status)}>
                  {applicationStatusLabel(app.status)}
                </Badge>
              </div>
              {app.companyRemoved ? (
                <Banner tone="info" title="Company removed">
                  This employer is no longer on RotaSambandh. Your application record is kept for
                  your history.
                </Banner>
              ) : null}
              {app.deletionPending && !app.companyRemoved ? (
                <Banner tone="warning" title="Company requested removal">
                  This employer asked to leave the network. Your application is still on file until
                  an admin restores or permanently removes the company.
                </Banner>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
