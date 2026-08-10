import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getCandidateDashboard } from "@/lib/dal/dashboards";
import { getJobFeed } from "@/lib/dal/jobs";
import { JobCard } from "@/components/jobs/job-card";

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

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Home</h1>
      <p className="mt-2 text-[var(--color-muted)]">Your career activity at a glance.</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Applications", dashboard.applications],
          ["Under review", dashboard.underReview],
          ["Interviews", dashboard.interviews],
        ].map(([label, value]) => (
          <div key={String(label)} className="border-b border-[var(--color-border)] pb-3">
            <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 text-sm text-[var(--color-muted)]">
        Profile completion: {dashboard.profileCompletion}% ·{" "}
        <Link href="/candidate/profile" className="font-semibold text-[var(--color-accent-strong)]">
          Complete profile
        </Link>
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Latest opportunities</h2>
        <div className="mt-4">
          {jobs.slice(0, 5).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>
    </main>
  );
}
