"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { changeRequestDiffRows } from "@/lib/admin/change-request-diff";
import {
  JobReviewPacket,
  jobFromSnapshot,
} from "@/components/admin/job-review-packet";
import { listPendingChangeRequests } from "@/lib/dal/change-requests";
import { listAllJobs } from "@/lib/dal/admin";
import { getEmployerJobRtdb, getEmployerMetaRtdb } from "@/lib/dal/employer-rtdb";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { MenuSelect } from "@/components/ui/menu-select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  DiffView,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import { jobStatusLabel, jobStatusTone } from "@/lib/ui/status-labels";
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

function actionLabel(action: ChangeRequest["action"]): string {
  switch (action) {
    case "create":
      return "New job";
    case "update":
      return "Job update";
    case "close":
      return "Close job";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function JobChangeRequestReviewCard({
  item,
  businessName,
  onDone,
}: {
  item: ChangeRequest;
  businessName?: string;
  onDone: (id: string) => void;
}) {
  const { canWrite } = usePlatformAccess();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveJob, setLiveJob] = useState<Job | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const job = await getEmployerJobRtdb(item.businessId, item.targetId);
      if (!cancelled) setLiveJob(job);
    })();
    return () => {
      cancelled = true;
    };
  }, [item.businessId, item.targetId]);

  async function decide(decision: ReviewDecision) {
    if (decision !== "approved" && !note.trim()) {
      setError("A note is required to reject or ask for more information.");
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

  const proposedJob = jobFromSnapshot(item.proposed, {
    id: item.targetId,
    businessId: item.businessId,
    ...(liveJob ?? {}),
  });
  const packetJob =
    item.action === "create" || Object.keys(item.proposed ?? {}).length > 0
      ? proposedJob
      : liveJob ?? proposedJob;
  const diffRows =
    item.action === "update" || item.action === "close"
      ? changeRequestDiffRows(item)
      : [];

  return (
    <Panel className="space-y-4" title="Job review" tone="attention">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Pending review" tone="warning" />
        <StatusPill label={actionLabel(item.action)} tone="neutral" />
      </div>

      <JobReviewPacket
        job={packetJob}
        businessName={businessName}
        businessId={item.businessId}
        showIds={false}
      />

      {diffRows.length > 0 ? (
        <div>
          <h3 className="mb-2 text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            What changed
          </h3>
          <DiffView rows={diffRows} />
        </div>
      ) : null}

      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`note-${item.id}`}>Review note</Label>
            <Textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required when rejecting or asking for more info"
              rows={3}
              className="mt-1"
            />
          </div>
          {error ? (
            <Banner tone="danger" title="Could not submit review">
              {error}
            </Banner>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => void decide("approved")}>
              {busy === "approved" ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => void decide("info_requested")}
            >
              {busy === "info_requested" ? "Sending..." : "Request info"}
            </Button>
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={() => void decide("rejected")}
            >
              {busy === "rejected" ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </>
      ) : (
        <Banner tone="info" title="Coordinator view">
          Review the role details and coordinate with the employer. Admins publish.
        </Banner>
      )}
    </Panel>
  );
}

export default function AdminJobsPage() {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | JobStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [crs, allJobs] = await Promise.all([
      listPendingChangeRequests(),
      listAllJobs(),
    ]);
    const jobCrs = crs.filter((c) => c.targetType === "job");
    setChangeRequests(jobCrs);
    setJobs(allJobs);
    const ids = Array.from(
      new Set([
        ...jobCrs.map((c) => c.businessId),
        ...allJobs.map((j) => j.businessId),
      ]),
    );
    const entries = await Promise.all(
      ids.map(async (id) => {
        const meta = await getEmployerMetaRtdb(id);
        return [id, meta?.name?.trim() || ""] as const;
      }),
    );
    const map: Record<string, string> = {};
    for (const [id, name] of entries) {
      if (name) map[id] = name;
    }
    setBusinessNames(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (!q) return true;
      const company = businessNames[j.businessId] ?? "";
      const haystack = [
        j.title,
        company,
        j.location,
        j.industry,
        JOB_TYPE_LABELS[j.type],
        WORKPLACE_LABELS[j.workplace],
        jobStatusLabel(j.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [jobs, statusFilter, search, businessNames]);

  if (loading) return <LoadingBlock label="Loading jobs..." />;

  return (
    <main>
      <PageHeader
        title="Jobs"
        description="Review new roles and edits waiting for approval, then browse the full job directory."
      />

      <section className="mb-12 space-y-4">
        <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Pending review ({changeRequests.length})
        </h2>
        {changeRequests.length === 0 ? (
          <EmptyState
            title="No jobs waiting for review"
            description="When employers submit a new role or an edit, the full listing appears here."
          />
        ) : (
          <ul className="space-y-4">
            {changeRequests.map((item) => (
              <li key={item.id}>
                <JobChangeRequestReviewCard
                  item={item}
                  businessName={businessNames[item.businessId]}
                  onDone={(id) =>
                    setChangeRequests((prev) => prev.filter((c) => c.id !== id))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            All jobs ({filteredJobs.length})
          </h2>
          <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="job-search">Search</Label>
              <Input
                id="job-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, company, location…"
                className="mt-1"
              />
            </div>
            <div className="w-full sm:w-48">
              <MenuSelect
                id="job-status-filter"
                label="Status"
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "all" | JobStatus)}
                options={STATUS_FILTERS}
              />
            </div>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <EmptyState
            title={jobs.length === 0 ? "No jobs yet" : "No jobs match"}
            description={
              jobs.length === 0
                ? "When employers publish or submit roles, they will appear in this directory."
                : "Try a different search or clear the status filter."
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            {filteredJobs.map((job) => (
              <li key={job.id}>
                <ListRow
                  href={`/admin/jobs/${job.id}`}
                  title={job.title || "Untitled role"}
                  subtitle={[
                    businessNames[job.businessId] || "Company",
                    JOB_TYPE_LABELS[job.type],
                    WORKPLACE_LABELS[job.workplace],
                    job.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    <StatusPill
                      label={jobStatusLabel(job.status)}
                      tone={jobStatusTone(job.status)}
                    />
                  }
                  emphasize={job.status === "pending_review"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
