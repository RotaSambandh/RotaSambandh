import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getCandidateDashboard } from "@/lib/dal/dashboards";
import { getJobFeed } from "@/lib/dal/jobs";
import { JobCard } from "@/components/jobs/job-card";
import { Banner, EmptyState, PageHeader, Panel } from "@/components/ui";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CandidateHomePage() {
  let dashboard = {
    applications: 0,
    underReview: 0,
    interviews: 0,
    profileCompletion: 0,
  };
  let jobs: Awaited<ReturnType<typeof getJobFeed>> = [];

  try {
    const session = await getSessionUser();
    const [dash, feed] = await Promise.all([
      session
        ? getCandidateDashboard(session.uid)
        : Promise.resolve({
            applications: 0,
            underReview: 0,
            interviews: 0,
            savedJobs: 0,
            profileCompletion: 0,
            readModelVersion: 1,
          }),
      getJobFeed({ sort: "newest" }),
    ]);
    dashboard = {
      applications: dash.applications ?? 0,
      underReview: dash.underReview ?? 0,
      interviews: dash.interviews ?? 0,
      profileCompletion: dash.profileCompletion ?? 0,
    };
    jobs = feed;
  } catch {
    // Keep empty home if session/dashboard reads fail — never 500 the shell.
  }

  const recent = jobs.slice(0, 5);

  return (
    <main>
      <PageHeader
        title="Home"
        description="Your career activity at a glance."
        actions={
          <Link href="/jobs" className={cn(buttonClassName("secondary", "sm"))}>
            Browse jobs
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Applications", dashboard.applications],
          ["Under review", dashboard.underReview],
          ["Interviews", dashboard.interviews],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-b border-[var(--color-border)] pb-3">
            <dt className="text-overline text-[var(--color-muted)]">{label}</dt>
            <dd className="mt-1 text-title tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {dashboard.profileCompletion < 100 ? (
        <Banner
          tone="info"
          title={`Profile ${dashboard.profileCompletion}% complete`}
          className="mt-6"
          action={
            <Link href="/candidate/profile" className={cn(buttonClassName("secondary", "sm"))}>
              Complete profile
            </Link>
          }
        >
          A fuller profile helps employers recognize you.
        </Banner>
      ) : (
        <p className="mt-6 text-caption text-[var(--color-muted)]">
          Profile complete ·{" "}
          <Link
            href="/candidate/profile"
            className="font-semibold text-[var(--color-accent-strong)] hover:underline"
          >
            View profile
          </Link>
        </p>
      )}

      <Panel title="Latest opportunities" className="mt-8">
        {recent.length === 0 ? (
          <EmptyState
            title="No open opportunities yet"
            description="Published roles from verified companies will appear here."
            action={
              <Link href="/jobs" className={cn(buttonClassName("secondary"))}>
                Browse jobs
              </Link>
            }
          />
        ) : (
          <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
            {recent.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </Panel>
    </main>
  );
}
