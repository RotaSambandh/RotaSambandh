import { Badge } from "@/components/ui/badge";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import type { JobType, WorkplaceType } from "@/shared/types";

function formatRelative(ts?: number | null): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDeadline(ts?: number | null): string | null {
  if (!ts) return null;
  return `Apply by ${new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function JobMetaRow({
  type,
  workplace,
  location,
  salary,
  postedAt,
  deadline,
  featured,
  className,
}: {
  type?: JobType | string | null;
  workplace?: WorkplaceType | string | null;
  location?: string | null;
  salary?: string | null;
  postedAt?: number | null;
  deadline?: number | null;
  featured?: boolean;
  className?: string;
}) {
  const typeLabel = type
    ? (JOB_TYPE_LABELS[type as JobType] ?? String(type).replaceAll("_", " "))
    : null;
  const workplaceLabel = workplace
    ? (WORKPLACE_LABELS[workplace as WorkplaceType] ??
      String(workplace).replaceAll("_", " "))
    : null;
  const posted = formatRelative(postedAt);
  const applyBy = formatDeadline(deadline);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {featured ? <Badge variant="success">Featured</Badge> : null}
      {typeLabel ? <Badge>{typeLabel}</Badge> : null}
      {workplaceLabel ? <Badge variant="neutral">{workplaceLabel}</Badge> : null}
      {location ? <Badge variant="neutral">{location}</Badge> : null}
      {salary ? <Badge variant="neutral">{salary}</Badge> : null}
      {posted ? (
        <span className="text-caption text-[var(--color-muted)]">Posted {posted}</span>
      ) : null}
      {applyBy ? (
        <span className="text-caption text-[var(--color-muted)]">{applyBy}</span>
      ) : null}
    </div>
  );
}

export { formatRelative, formatDeadline };
