"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { changeRequestDiffRows } from "@/lib/admin/change-request-diff";
import { listPendingChangeRequests } from "@/lib/dal/change-requests";
import { listAllJobs } from "@/lib/dal/admin";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  DiffView,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import type { ChangeRequest, Job, JobStatus } from "@/shared/types";
import { usePlatformAccess } from "@/hooks/use-platform-access";

type ReviewDecision = "approved" | "rejected" | "info_requested";

const STATUS_FILTERS: Array<{ value: "all" | JobStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "pending_review", label: "Pending review" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
  { value: "expired", label: "Expired" },
];

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

function ChangeRequestReviewCard({
  item,
  onDone,
}: {
  item: ChangeRequest;
  onDone: (id: string) => void;
}) {
  const { canWrite } = usePlatformAccess();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: ReviewDecision) {
    if (decision !== "approved" && !note.trim()) {
      setError("Admin note is required to reject or request info.");
      return;
    }
    setError(null);
    setBusy(decision);
    try {
      await callPrivilegedAdmin({
        action: "review_change_request",
        payload: {
          changeRequestId: item.id,
          decision,
          adminNote: note.trim() || undefined,
        },
      });
      onDone(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{item.title ?? item.targetId}</p>
        <Badge variant="neutral">{item.action}</Badge>
        <Badge>{item.status.replaceAll("_", " ")}</Badge>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted)]">Business</dt>
          <dd>
            <Link
              href={`/admin/businesses/${item.businessId}`}
              className="font-medium text-[var(--color-accent-strong)] hover:underline"
            >
              {item.businessId}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Job</dt>
          <dd>
            <Link
              href={`/admin/jobs/${item.targetId}`}
              className="font-medium text-[var(--color-accent-strong)] hover:underline"
            >
              {item.targetId}
            </Link>
          </dd>
        </div>
      </dl>
      <DiffView rows={changeRequestDiffRows(item)} />
      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`note-${item.id}`}>Admin note</Label>
            <Textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for reject or request info"
              rows={3}
              className="mt-1"
            />
          </div>
          {error && (
            <Banner tone="danger" title="Could not submit review">
              {error}
            </Banner>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => void decide("approved")}>
              {busy === "approved" ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => void decide("info_requested")}
            >
              {busy === "info_requested" ? "Sending…" : "Request info"}
            </Button>
            <Button variant="danger" disabled={!!busy} onClick={() => void decide("rejected")}>
              {busy === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </>
      ) : (
        <Banner tone="info" title="Coordinator view">
          Review the proposed job changes and follow up with the employer. Admins publish.
        </Banner>
      )}
    </Panel>
  );
}

export default function AdminJobsPage() {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [crs, allJobs] = await Promise.all([listPendingChangeRequests(), listAllJobs()]);
    setChangeRequests(crs.filter((c) => c.targetType === "job"));
    setJobs(allJobs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  if (loading) return <LoadingBlock label="Loading jobs…" />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Jobs"
        description="Browse every job on the network, then review employer change proposals waiting for approval."
      />

      <section className="mb-12 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            All jobs ({filteredJobs.length})
          </h2>
          <div className="w-full max-w-xs">
            <MenuSelect
              id="job-status-filter"
              label="Filter by status"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | JobStatus)}
              options={STATUS_FILTERS}
            />
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            description="When employers publish or submit roles, they will appear in this directory."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
            {filteredJobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 transition hover:bg-[var(--color-surface)]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink)]">{job.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {JOB_TYPE_LABELS[job.type]} · {WORKPLACE_LABELS[job.workplace]}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                      {job.businessId}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusBadge(job.status)}
                    <span className="text-xs text-[var(--color-accent-strong)]">View details →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Pending change proposals ({changeRequests.length})
        </h2>
        {changeRequests.length === 0 ? (
          <EmptyState
            title="No pending job changes"
            description="New roles, edits, and close requests from employers appear here."
          />
        ) : (
          <ul className="space-y-4">
            {changeRequests.map((item) => (
              <li key={item.id}>
                <ChangeRequestReviewCard
                  item={item}
                  onDone={(id) => setChangeRequests((prev) => prev.filter((c) => c.id !== id))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
