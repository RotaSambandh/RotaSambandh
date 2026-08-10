"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminBusiness } from "@/lib/dal/admin";
import { listBusinessJobs, listBusinessMembers } from "@/lib/dal/employer";
import { JOB_TYPE_LABELS } from "@/lib/dal/job-meta";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { RichTextView } from "@/components/editor/rich-text-view";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import type { Business, BusinessMember, BusinessStatus, Job } from "@/shared/types";

function statusBadge(status: BusinessStatus) {
  switch (status) {
    case "verified":
      return <Badge variant="success">Verified</Badge>;
    case "verification_pending":
      return <Badge variant="warning">Verification pending</Badge>;
    case "deletion_pending":
      return <Badge variant="danger">Deletion pending</Badge>;
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "suspended":
      return <Badge variant="danger">Suspended</Badge>;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export default function AdminBusinessDetailPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [biz, team, roles] = await Promise.all([
        getAdminBusiness(businessId),
        listBusinessMembers(businessId),
        listBusinessJobs(businessId),
      ]);
      if (!cancelled) {
        setBusiness(biz);
        setMembers(team);
        setJobs(roles);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) return <LoadingBlock label="Loading business…" />;
  if (!business) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <EmptyState title="Business not found" description="This company may have been removed." />
        <Link
          href="/admin/businesses"
          className="mt-4 inline-block text-sm text-[var(--color-accent-strong)]"
        >
          ← Back to businesses
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/admin/businesses"
        className="text-sm text-[var(--color-accent-strong)] hover:underline"
      >
        ← All businesses
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={business.name}
          description={business.industry || business.location || "Employer profile"}
        />
        {statusBadge(business.status)}
      </div>

      <Panel className="mt-6 space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Website</dt>
            <dd>
              {business.website ? (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-accent-strong)] hover:underline"
                >
                  {business.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Company size</dt>
            <dd>{business.companySize || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Location</dt>
            <dd>{business.location || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Owner uid</dt>
            <dd className="font-mono text-xs">{business.ownerId}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Rotary / Rotaract contact</dt>
            <dd>{business.rotaryContactName || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Contact club</dt>
            <dd>{business.rotaryContactClub || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Contact email</dt>
            <dd>{business.rotaryContactEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Contact phone</dt>
            <dd>{business.rotaryContactPhone || "—"}</dd>
          </div>
        </dl>
        {business.description ? (
          <div className="text-sm text-[var(--color-muted)]">
            <RichTextView html={business.description} />
          </div>
        ) : null}
      </Panel>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Company team
        </h2>
        {members.length === 0 ? (
          <EmptyState title="No team members" description="Managers appear here after invite or signup." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">{member.displayName || member.email || member.userId}</p>
                  {member.email ? (
                    <p className="text-sm text-[var(--color-muted)]">{member.email}</p>
                  ) : null}
                </div>
                <Badge variant="neutral">
                  {normalizeBusinessMemberRole(member.role) === "company_admin"
                    ? "Company admin"
                    : "Manager"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Jobs from this company
        </h2>
        {jobs.length === 0 ? (
          <EmptyState title="No jobs" description="Roles posted by this employer will list here." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface)]"
                >
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-[var(--color-muted)]">{JOB_TYPE_LABELS[job.type]}</p>
                  </div>
                  <Badge variant="neutral">{job.status.replaceAll("_", " ")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
