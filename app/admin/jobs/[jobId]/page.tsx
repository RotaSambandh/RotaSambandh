"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminJob } from "@/lib/dal/admin";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import type { Job, JobStatus } from "@/shared/types";

function statusBadge(status: JobStatus) {
  switch (status) {
    case "published":
      return <Badge variant="success">Published</Badge>;
    case "pending_review":
      return <Badge variant="warning">Pending review</Badge>;
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "closed":
    case "filled":
    case "expired":
      return <Badge variant="neutral">{status.replaceAll("_", " ")}</Badge>;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export default function AdminJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const next = await getAdminJob(jobId);
      if (!cancelled) {
        setJob(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loading) return <LoadingBlock label="Loading job…" />;
  if (!job) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <EmptyState title="Job not found" description="This job may have been removed." />
        <Link href="/admin/jobs" className="mt-4 inline-block text-sm text-[var(--color-accent-strong)]">
          ← Back to jobs
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/admin/jobs" className="text-sm text-[var(--color-accent-strong)] hover:underline">
        ← All jobs
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={job.title} description={`${JOB_TYPE_LABELS[job.type]} · ${WORKPLACE_LABELS[job.workplace]}`} />
        {statusBadge(job.status)}
      </div>

      <Panel className="mt-6 space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Business</dt>
            <dd>
              <Link
                href={`/admin/businesses/${job.businessId}`}
                className="font-medium text-[var(--color-accent-strong)] hover:underline"
              >
                {job.businessId}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Location</dt>
            <dd>{job.location || "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Skills</dt>
            <dd>{job.skills?.length ? job.skills.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Salary</dt>
            <dd>{job.salaryDisplay || "—"}</dd>
          </div>
        </dl>
        <div>
          <h3 className="text-sm font-semibold">Description</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{job.description}</p>
        </div>
        {job.requirements ? (
          <div>
            <h3 className="text-sm font-semibold">Requirements</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{job.requirements}</p>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
