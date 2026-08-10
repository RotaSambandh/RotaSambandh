"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JobReviewPacket } from "@/components/admin/job-review-packet";
import { getAdminJob } from "@/lib/dal/admin";
import { getEmployerMetaRtdb } from "@/lib/dal/employer-rtdb";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { jobStatusLabel, jobStatusTone } from "@/lib/ui/status-labels";
import type { Job } from "@/shared/types";

export default function AdminJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const loaded = await getAdminJob(jobId);
      setJob(loaded);
      if (loaded) {
        const meta = await getEmployerMetaRtdb(loaded.businessId);
        setBusinessName(meta?.name?.trim() || "");
      }
      setLoading(false);
    })();
  }, [jobId]);

  if (loading) return <LoadingBlock label="Loading job..." />;

  if (!job) {
    return (
      <main>
        <EmptyState title="Job not found" description="This job may have been removed." />
        <Link
          href="/admin/jobs"
          className="mt-4 inline-block text-sm text-[var(--color-accent-strong)]"
        >
          Back to jobs
        </Link>
      </main>
    );
  }

  return (
    <main>
      <Link
        href="/admin/jobs"
        className="text-sm text-[var(--color-accent-strong)] hover:underline"
      >
        All jobs
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={job.title || "Untitled role"}
          description={businessName || "Employer job listing"}
        />
        <StatusPill label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
      </div>

      <Panel className="mt-6">
        <JobReviewPacket
          job={job}
          businessName={businessName}
          businessId={job.businessId}
          linkToJob={false}
          showIds={false}
        />
      </Panel>
    </main>
  );
}
