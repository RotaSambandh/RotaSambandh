"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RichTextView } from "@/components/editor/rich-text-view";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { isNonEmptyHtml } from "@/lib/sanitize/html";
import type { Job, JobType, WorkplaceType } from "@/shared/types";

function displayOrNotSet(value?: string | null) {
  const v = value?.trim();
  return v ? v : "Not set";
}

/** Build a Job-like packet from a change-request proposed/live snapshot. */
export function jobFromSnapshot(
  snapshot: Record<string, unknown> | undefined,
  fallback?: Partial<Job> & { id?: string; businessId?: string },
): Partial<Job> {
  const s = snapshot ?? {};
  return {
    id: fallback?.id ?? "",
    businessId: fallback?.businessId ?? "",
    title: String(s.title ?? fallback?.title ?? ""),
    description: String(s.description ?? fallback?.description ?? ""),
    responsibilities: s.responsibilities
      ? String(s.responsibilities)
      : fallback?.responsibilities,
    requirements: s.requirements ? String(s.requirements) : fallback?.requirements,
    benefits: s.benefits ? String(s.benefits) : fallback?.benefits,
    skills: Array.isArray(s.skills)
      ? (s.skills as string[])
      : (fallback?.skills ?? []),
    type: (s.type as JobType) ?? fallback?.type ?? "full_time",
    workplace: (s.workplace as WorkplaceType) ?? fallback?.workplace ?? "remote",
    location: s.location != null ? String(s.location) : fallback?.location,
    salaryDisplay:
      s.salaryDisplay != null ? String(s.salaryDisplay) : fallback?.salaryDisplay,
    industry: s.industry != null ? String(s.industry) : fallback?.industry,
    deadline: s.deadline != null ? Number(s.deadline) : fallback?.deadline,
    status: fallback?.status ?? "pending_review",
    categoryIds: [],
    createdBy: "",
    slug: String(s.slug ?? ""),
    createdAt: fallback?.createdAt ?? 0,
    updatedAt: fallback?.updatedAt ?? 0,
  };
}

/**
 * Readable job packet for admin review (mirrors company verification review).
 */
export function JobReviewPacket({
  job,
  businessName,
  businessId,
  linkToJob = true,
  linkToBusiness = true,
  showIds = false,
}: {
  job: Partial<Job>;
  businessName?: string;
  businessId?: string;
  linkToJob?: boolean;
  linkToBusiness?: boolean;
  showIds?: boolean;
}) {
  const title = job.title?.trim() || "Untitled role";
  const bizId = businessId || job.businessId || "";
  const company = businessName?.trim() || "Company";
  const typeLabel = job.type ? JOB_TYPE_LABELS[job.type] ?? job.type : "Type not set";
  const workplaceLabel = job.workplace
    ? WORKPLACE_LABELS[job.workplace] ?? job.workplace
    : "Workplace not set";
  const meta = [typeLabel, workplaceLabel, job.location?.trim() || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <div>
        {linkToJob && job.id ? (
          <Link
            href={`/admin/jobs/${job.id}`}
            className="text-lg font-semibold text-[var(--color-accent-strong)] hover:underline"
          >
            {title}
          </Link>
        ) : (
          <p className="text-lg font-semibold text-[var(--color-ink)]">{title}</p>
        )}
        <p className="mt-1 text-sm text-[var(--color-muted)]">{meta}</p>
        {bizId ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Company:{" "}
            {linkToBusiness ? (
              <Link
                href={`/admin/businesses/${bizId}`}
                className="font-medium text-[var(--color-accent-strong)] hover:underline"
              >
                {company}
              </Link>
            ) : (
              <span className="font-medium text-[var(--color-ink)]">{company}</span>
            )}
          </p>
        ) : null}
        {showIds && job.id ? (
          <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">Job id: {job.id}</p>
        ) : null}
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Role details
        </h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Salary</dt>
            <dd>{displayOrNotSet(job.salaryDisplay)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Industry</dt>
            <dd>{displayOrNotSet(job.industry)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Deadline</dt>
            <dd>
              {job.deadline
                ? new Date(job.deadline).toLocaleDateString()
                : "Not set"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-muted)]">Keywords</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {job.skills && job.skills.length > 0 ? (
                job.skills.map((skill) => (
                  <Badge key={skill} variant="neutral">
                    {skill}
                  </Badge>
                ))
              ) : (
                <span>Not set</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Description
        </h3>
        <div className="mt-2 text-sm">
          {isNonEmptyHtml(job.description) ? (
            <RichTextView html={job.description!} />
          ) : (
            <p className="text-[var(--color-muted)]">Not set</p>
          )}
        </div>
      </section>

      {isNonEmptyHtml(job.responsibilities) ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Responsibilities
          </h3>
          <div className="mt-2 text-sm">
            <RichTextView html={job.responsibilities!} />
          </div>
        </section>
      ) : null}

      {isNonEmptyHtml(job.requirements) ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Requirements
          </h3>
          <div className="mt-2 text-sm">
            <RichTextView html={job.requirements!} />
          </div>
        </section>
      ) : null}

      {isNonEmptyHtml(job.benefits) ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Benefits
          </h3>
          <div className="mt-2 text-sm">
            <RichTextView html={job.benefits!} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
