"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import {
  listApplicationAnswersRtdb,
  listEmployerApplicationsRtdb,
  toApplication,
} from "@/lib/dal/applications-rtdb";
import { updateApplicationStatus } from "@/lib/dal/applications";
import type { Application, ApplicationAnswer, ApplicationStatus } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Panel, Banner } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { assertNever } from "@/lib/utils";

const NEXT_STATUS: Record<ApplicationStatus, ApplicationStatus | null> = {
  applied: "under_review",
  under_review: "shortlisted",
  shortlisted: "interview",
  interview: "selected",
  selected: null,
  rejected: null,
  withdrawn: null,
};

function statusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "applied":
      return "Applied";
    case "under_review":
      return "Under review";
    case "shortlisted":
      return "Shortlisted";
    case "interview":
      return "Interview";
    case "selected":
      return "Selected";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    default:
      return assertNever(status);
  }
}

interface CandidateInfo {
  displayName: string;
  phone?: string;
  email?: string;
}

interface EnrichedApplication extends Application {
  candidate: CandidateInfo;
  answers: ApplicationAnswer[];
}

function formatAnswerValue(value: ApplicationAnswer["value"]): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function ApplicantsPanel({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const [items, setItems] = useState<EnrichedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!business) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const apps = await listEmployerApplicationsRtdb(business.id, jobId);
    const enriched = await Promise.all(
      apps.map(async (model) => {
        const app = toApplication(model);
        const answers = await listApplicationAnswersRtdb(
          business.id,
          model.id,
        );
        return {
          ...app,
          candidate: {
            displayName: model.candidateName || model.candidateId,
            phone: model.candidatePhone || undefined,
            email: model.candidateEmail || undefined,
          },
          answers,
        };
      }),
    );
    setItems(enriched);
    setLoading(false);
  }, [business, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(app: Application, toStatus: ApplicationStatus) {
    if (!user) return;
    const note = notes[app.id]?.trim() || undefined;
    await updateApplicationStatus({
      applicationId: app.id,
      actorId: user.uid,
      toStatus,
      note,
    });
    setItems((prev) =>
      prev.map((a) =>
        a.id === app.id
          ? { ...a, status: toStatus, statusUpdatedAt: Date.now() }
          : a,
      ),
    );
  }

  async function openResume(app: Application) {
    setResumeError(null);
    const res = await fetch("/api/uploads/resume/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey: app.resumeStorageKey,
        applicationId: app.id,
      }),
    });
    if (!res.ok) {
      setResumeError("Resume download requires configured storage and authorization.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function exportCsv() {
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch(`/api/employer/jobs/${jobId}/export`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `applicants-${jobId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <Panel title="Applicants">
        <p className="text-sm text-[var(--color-muted)]">Loading applicants…</p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Applicants"
      toolbar={
        items.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        ) : null
      }
    >
      <p className="mb-4 text-caption text-[var(--color-muted)]">
        Manage this opportunity&apos;s pipeline. Export includes contact details,
        screening answers, status notes, and resume download links.
      </p>
      {resumeError ? (
        <Banner tone="danger" title={resumeError} className="mb-4" />
      ) : null}
      {exportError ? (
        <Banner tone="danger" title={exportError} className="mb-4" />
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No applicants yet"
          description="Applications will appear here once candidates apply to this opportunity."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((app) => {
            const next = NEXT_STATUS[app.status];
            return (
              <li key={app.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{app.candidate.displayName}</p>
                    {(app.candidate.phone || app.candidate.email) && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {[app.candidate.email, app.candidate.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Applied {new Date(app.submittedAt).toLocaleDateString()} ·{" "}
                      {app.resumeFileName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.status === "selected"
                        ? "success"
                        : app.status === "rejected" ||
                            app.status === "withdrawn"
                          ? "danger"
                          : app.status === "applied" ||
                              app.status === "under_review"
                            ? "warning"
                            : "default"
                    }
                  >
                    {statusLabel(app.status)}
                  </Badge>
                </div>

                {app.answers.length > 0 && (
                  <dl className="mt-3 space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
                    {app.answers.map((answer) => (
                      <div key={answer.id}>
                        <dt className="font-medium text-[var(--color-ink)]">
                          {answer.promptSnapshot}
                        </dt>
                        <dd className="text-[var(--color-muted)]">
                          {formatAnswerValue(answer.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-3">
                  <Label htmlFor={`note-${app.id}`} className="text-xs">
                    Note (optional)
                  </Label>
                  <Textarea
                    id={`note-${app.id}`}
                    rows={2}
                    value={notes[app.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [app.id]: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void openResume(app)}
                  >
                    Resume
                  </Button>
                  {next ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void move(app, next)}
                    >
                      Move to {statusLabel(next)}
                    </Button>
                  ) : null}
                  {app.status !== "rejected" &&
                  app.status !== "withdrawn" &&
                  app.status !== "selected" ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => void move(app, "rejected")}
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
