import { JobCard } from "@/components/jobs/job-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuSelect } from "@/components/ui/menu-select";
import { getJobFeed } from "@/lib/dal/jobs";
import type { JobType, WorkplaceType } from "@/shared/types";

export const revalidate = 60;

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "full_time", label: "Full-time" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

const WORKPLACE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on_site", label: "On-site" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const type = typeof params.type === "string" ? (params.type as JobType) : undefined;
  const workplace =
    typeof params.workplace === "string" ? (params.workplace as WorkplaceType) : undefined;

  const jobs = await getJobFeed({ q, type, workplace, sort: "newest" });

  return (
    <main>
      <PageHeader
        title="Opportunities"
        description="Verified roles from Rotary-linked businesses. Use filters to narrow the list."
      />

      <form
        className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end"
        action="/jobs"
        method="get"
      >
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Title, skill, company"
            className="rounded-lg bg-white shadow-sm"
          />
        </div>
        <MenuSelect
          className="sm:w-44"
          id="type"
          name="type"
          label="Type"
          defaultValue={type ?? ""}
          options={TYPE_OPTIONS}
        />
        <MenuSelect
          className="sm:w-44"
          id="workplace"
          name="workplace"
          label="Workplace"
          defaultValue={workplace ?? ""}
          options={WORKPLACE_OPTIONS}
        />
        <Button type="submit" className="min-h-[42px] rounded-lg px-5">
          Search
        </Button>
      </form>

      <div className="mt-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {jobs.length} result{jobs.length === 1 ? "" : "s"}
        </p>
        {jobs.length === 0 ? (
          <EmptyState
            title="No opportunities match"
            description="Try different filters or check back when new roles are published."
          />
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </main>
  );
}
