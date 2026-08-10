"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { JobCard } from "@/components/jobs/job-card";
import { EmptyState, LoadingBlock } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuSelect } from "@/components/ui/menu-select";
import { FEED_PAGE_SIZE } from "@/shared/constants";
import { filterJobFeedItems, listJobFeedAllRtdb } from "@/lib/dal/jobs-feed";
import type { JobFeedItem, JobType, WorkplaceType } from "@/shared/types";

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

function cleanParam(value: string | null): string {
  return value?.trim() ?? "";
}

export function JobsBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [allJobs, setAllJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  const [q, setQ] = useState(() => cleanParam(searchParams.get("q")));
  const [type, setType] = useState(() => cleanParam(searchParams.get("type")));
  const [workplace, setWorkplace] = useState(() =>
    cleanParam(searchParams.get("workplace")),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const items = await listJobFeedAllRtdb("latest");
        if (!cancelled) setAllJobs(items);
      } catch {
        if (!cancelled) {
          setAllJobs([]);
          setLoadError("Could not load opportunities. Refresh and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobs = useMemo(
    () =>
      filterJobFeedItems(allJobs, {
        q: q || undefined,
        type: (type || undefined) as JobType | undefined,
        workplace: (workplace || undefined) as WorkplaceType | undefined,
        sort: "newest",
      }),
    [allJobs, q, type, workplace],
  );

  const visibleJobs = jobs.slice(0, visibleCount);
  const hasMore = jobs.length > visibleCount;

  function syncUrl(next: { q: string; type: string; workplace: string }) {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.type) params.set("type", next.type);
    if (next.workplace) params.set("workplace", next.workplace);
    const qs = params.toString();
    setVisibleCount(FEED_PAGE_SIZE);
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    syncUrl({ q, type, workplace });
  }

  function onTypeChange(value: string) {
    setType(value);
    syncUrl({ q, type: value, workplace });
  }

  function onWorkplaceChange(value: string) {
    setWorkplace(value);
    syncUrl({ q, type, workplace: value });
  }

  return (
    <div>
      <form
        className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={onSearch}
      >
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="q"
            className="mb-1 block text-overline text-[var(--color-muted)]"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, skill, company"
          />
        </div>
        <MenuSelect
          className="sm:w-44"
          id="type"
          name="type"
          label="Type"
          value={type}
          onValueChange={onTypeChange}
          options={TYPE_OPTIONS}
        />
        <MenuSelect
          className="sm:w-44"
          id="workplace"
          name="workplace"
          label="Workplace"
          value={workplace}
          onValueChange={onWorkplaceChange}
          options={WORKPLACE_OPTIONS}
        />
        <Button type="submit" className="min-h-[42px] px-5" disabled={pending}>
          Search
        </Button>
      </form>

      <div className="mt-8">
        {loading ? (
          <LoadingBlock label="Loading opportunities..." />
        ) : loadError ? (
          <EmptyState title="Could not load opportunities" description={loadError} />
        ) : (
          <>
            <p className="mb-4 text-overline text-[var(--color-muted)]">
              {jobs.length} result{jobs.length === 1 ? "" : "s"}
            </p>
            {jobs.length === 0 ? (
              <EmptyState
                title={
                  allJobs.length === 0
                    ? "No open opportunities yet"
                    : "No opportunities match"
                }
                description={
                  allJobs.length === 0
                    ? "Published roles from verified companies will appear here."
                    : "Try clearing filters or searching with different words."
                }
              />
            ) : (
              <>
                <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                  {visibleJobs.map((job) => (
                    <li key={job.id}>
                      <JobCard job={job} />
                    </li>
                  ))}
                </ul>
                {hasMore ? (
                  <div className="mt-4 flex justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setVisibleCount((n) => n + FEED_PAGE_SIZE)}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
