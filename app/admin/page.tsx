import Link from "next/link";
import { getAdminDashboard } from "@/lib/dal/dashboards";
import { PageHeader, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const counters = await getAdminDashboard();
  const stats = [
    { label: "Registered users", value: counters.registeredUsers, attention: false },
    { label: "Businesses", value: counters.businesses, attention: false },
    { label: "Active jobs", value: counters.activeJobs, attention: false },
    { label: "Applications", value: counters.applications, attention: false },
    {
      label: "Pending businesses",
      value: counters.pendingBusinesses,
      attention: counters.pendingBusinesses > 0,
    },
    {
      label: "Pending jobs",
      value: counters.pendingJobs,
      attention: counters.pendingJobs > 0,
    },
    {
      label: "Pending deletions",
      value: counters.pendingBusinessDeletions ?? 0,
      attention: (counters.pendingBusinessDeletions ?? 0) > 0,
    },
    { label: "Placements", value: counters.placements, attention: false },
  ] as const;

  const queues = [
    {
      href: "/admin/businesses",
      title: "Business change requests",
      description: "Profile updates and verification queue",
      count: counters.pendingBusinesses,
    },
    {
      href: "/admin/businesses",
      title: "Company deletions",
      description: "Restore or permanently purge requested removals",
      count: counters.pendingBusinessDeletions ?? 0,
    },
    {
      href: "/admin/jobs",
      title: "Job change requests",
      description: "New roles, edits, and close requests",
      count: counters.pendingJobs,
    },
  ] as const;

  return (
    <main>
      <PageHeader
        title="Admin"
        description="Overview of network activity and open review queues."
      />

      <section className="mb-10">
        <h2 className="mb-4 text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Review queues
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <li key={`${queue.href}-${queue.title}`}>
              <Link href={queue.href} className="block h-full">
                <Panel
                  tone={queue.count > 0 ? "attention" : "default"}
                  className="h-full transition-colors hover:border-[var(--color-accent)]/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-[var(--color-ink)]">
                        {queue.title}
                      </p>
                      <p className="mt-1 text-caption text-[var(--color-muted)]">
                        {queue.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-display text-title font-semibold tabular-nums",
                        queue.count > 0
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-ink)]",
                      )}
                    >
                      {queue.count.toLocaleString()}
                    </span>
                  </div>
                </Panel>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Ecosystem metrics
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {stats.map(({ label, value, attention }) => (
            <div
              key={label}
              className={cn(
                "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3",
                attention &&
                  "border-[var(--color-warning)]/50 ring-1 ring-[var(--color-warning)]/20",
              )}
            >
              <dt className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {label}
              </dt>
              <dd
                className={cn(
                  "mt-1 font-display text-title font-semibold tabular-nums sm:text-display",
                  attention ? "text-[var(--color-warning)]" : "text-[var(--color-ink)]",
                )}
              >
                {value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
