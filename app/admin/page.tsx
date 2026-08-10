import Link from "next/link";
import { getAdminDashboard } from "@/lib/dal/dashboards";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const counters = await getAdminDashboard();
  const stats = [
    ["Registered users", counters.registeredUsers],
    ["Businesses", counters.businesses],
    ["Active jobs", counters.activeJobs],
    ["Applications", counters.applications],
    ["Pending businesses", counters.pendingBusinesses],
    ["Pending jobs", counters.pendingJobs],
    ["Pending deletions", counters.pendingBusinessDeletions ?? 0],
    ["Placements", counters.placements],
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Admin"
        description="Overview of network activity and open review queues."
      />

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Review queues
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <li key={queue.href}>
              <Link href={queue.href} className="block h-full">
                <Panel className="h-full transition-colors hover:border-[var(--color-accent)]/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{queue.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{queue.description}</p>
                    </div>
                    <span className="font-display text-2xl font-semibold tabular-nums">
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Ecosystem metrics
        </h2>
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="border-b border-[var(--color-border)] pb-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold">
                {value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
