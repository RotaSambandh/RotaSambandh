"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { ListRow } from "@/components/ui/list-row";
import { listBusinessesPublicRtdb } from "@/lib/dal/businesses-list";
import type { BusinessPublicReadModel } from "@/shared/types";

export default function CompaniesDirectoryPage() {
  const [items, setItems] = useState<BusinessPublicReadModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await listBusinessesPublicRtdb();
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        (b.industry ?? "").toLowerCase().includes(needle) ||
        (b.location ?? "").toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <main>
      <PageHeader
        title="Companies"
        description="Verified Rotary-linked businesses hiring on RotaSambandh."
      />

      <div className="mb-5">
        <label htmlFor="company-q" className="mb-1 block text-overline text-[var(--color-muted)]">
          Search
        </label>
        <Input
          id="company-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, industry, location"
        />
      </div>

      {loading ? (
        <LoadingBlock label="Loading companies…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "No companies yet" : "No matches"}
          description={
            items.length === 0
              ? "Verified companies will appear here when they join the network."
              : "Try a different search."
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
          {filtered.map((biz) => (
            <li key={biz.id}>
              <ListRow
                href={`/companies/${biz.id}`}
                leading={<CompanyAvatar name={biz.name} logoUrl={biz.logoUrl} size={44} />}
                title={biz.name}
                subtitle={[biz.industry, biz.location, biz.companySize]
                  .filter(Boolean)
                  .join(" · ")}
                meta={
                  <span className="inline-flex items-center gap-1 text-caption text-[var(--color-muted)]">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    {biz.openJobsCount} open role{biz.openJobsCount === 1 ? "" : "s"}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
