import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobFeedItem } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import { CompanyAvatar } from "@/components/brand/company-avatar";

export function JobCard({ job }: { job: JobFeedItem }) {
  return (
    <article className="border-b border-[var(--color-border)] py-5 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CompanyAvatar name={job.company} logoUrl={job.companyLogo} size={44} />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              <Link href={`/jobs/${job.id}`} className="hover:text-[var(--color-accent-strong)]">
                {job.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              <Link href={`/companies/${job.businessId}`} className="hover:underline">
                {job.company}
              </Link>
            </p>
          </div>
        </div>
        {job.salary && <p className="text-sm font-semibold text-[var(--color-ink)]">{job.salary}</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {job.location}
          </span>
        )}
        <Badge>{JOB_TYPE_LABELS[job.type]}</Badge>
        <Badge variant="neutral">{WORKPLACE_LABELS[job.workplace]}</Badge>
        {job.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="rounded-md border border-[var(--color-border)] px-2 py-0.5">
            {skill}
          </span>
        ))}
      </div>
    </article>
  );
}
