"use client";

import { useCallback, useEffect, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { listOpenReports } from "@/lib/dal/admin";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import type { Report } from "@/shared/types";

export default function AdminReportsPage() {
  const { canWrite } = usePlatformAccess();
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"resolved" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listOpenReports();
    setReports(list);
    setSelected(list[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(status: "resolved" | "dismissed") {
    if (!selected || !canWrite) return;
    setError(null);
    setBusy(status);
    try {
      await callPrivilegedAdmin({
        action: "resolve_report",
        payload: {
          reportId: selected.id,
          status,
        },
      });
      const remaining = reports.filter((r) => r.id !== selected.id);
      setReports(remaining);
      setSelected(remaining[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve report");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading reports…" />;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Reports"
        description="Review community reports for fake jobs, spam, misrepresentation, and misconduct."
      />

      {!canWrite && (
        <Banner tone="warning" title="Coordinator view">
          You can review open reports. Resolve and dismiss require admin access.
        </Banner>
      )}

      {reports.length === 0 ? (
        <EmptyState
          className={!canWrite ? "mt-6" : undefined}
          title="No open reports"
          description="When users flag content, reports appear here for triage."
        />
      ) : (
        <div className={`grid gap-6 lg:grid-cols-2 ${!canWrite ? "mt-6" : ""}`}>
          <Panel title={`Open (${reports.length})`}>
            <ul className="divide-y divide-[var(--color-border)]">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(report)}
                    className={`w-full px-1 py-3 text-left transition-colors hover:bg-[var(--color-surface)] ${
                      selected?.id === report.id ? "bg-[var(--color-accent-soft)]/40" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">{report.reason.replaceAll("_", " ")}</Badge>
                      <span className="text-xs text-[var(--color-muted)]">
                        {report.targetType}:{report.targetId}
                      </span>
                    </div>
                    {report.details && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
                        {report.details}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Preview">
            {!selected ? (
              <EmptyState title="Select a report" description="Choose a report to review details." />
            ) : (
              <div className="space-y-4">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-[var(--color-muted)]">Reason</dt>
                    <dd className="mt-1">
                      <Badge variant="warning">{selected.reason.replaceAll("_", " ")}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-muted)]">Target</dt>
                    <dd className="font-mono text-xs">
                      {selected.targetType}:{selected.targetId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-muted)]">Reporter</dt>
                    <dd className="font-mono text-xs">{selected.reporterId}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-muted)]">Submitted</dt>
                    <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                  </div>
                  {selected.details && (
                    <div>
                      <dt className="text-[var(--color-muted)]">Details</dt>
                      <dd className="mt-1 leading-relaxed">{selected.details}</dd>
                    </div>
                  )}
                </dl>
                {error && (
                  <Banner tone="danger" title="Action failed">
                    {error}
                  </Banner>
                )}
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!!busy} onClick={() => void resolve("resolved")}>
                      {busy === "resolved" ? "Resolving…" : "Resolve"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!!busy}
                      onClick={() => void resolve("dismissed")}
                    >
                      {busy === "dismissed" ? "Dismissing…" : "Dismiss"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
