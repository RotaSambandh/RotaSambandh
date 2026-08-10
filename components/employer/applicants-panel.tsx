"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import {
  listApplicationAnswers,
  listJobApplicationsPage,
  updateApplicationStatus,
} from "@/lib/dal/applications";
import { getCandidateProfile, getUser } from "@/lib/dal/users";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { Application, ApplicationAnswer, ApplicationStatus } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Panel } from "@/components/ui";
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
  headline?: string;
  club?: string;
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

async function loadCandidate(app: Application): Promise<CandidateInfo> {
  if (app.candidateName || app.candidateEmail || app.candidatePhone) {
    return {
      displayName: app.candidateName ?? app.candidateId,
      phone: app.candidatePhone,
      email: app.candidateEmail,
    };
  }
  // Legacy applications without snapshots — best-effort (may be denied by rules).
  if (isFirebaseConfigured()) {
    const [userDoc, profile] = await Promise.all([
      getUser(app.candidateId),
      getCandidateProfile(app.candidateId),
    ]);
    return {
      displayName: userDoc?.displayName ?? app.candidateId,
      headline: profile?.headline,
      club: profile?.rotaractClub,
      phone: userDoc?.phone,
      email: userDoc?.email,
    };
  }
  return {
    displayName: app.candidateId,
  };
}

export function ApplicantsPanel({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<EnrichedApplication[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const enrichApplications = useCallback(async (apps: Application[]): Promise<EnrichedApplication[]> => {
    return Promise.all(
      apps.map(async (app) => {
        const [candidate, answers] = await Promise.all([
          loadCandidate(app),
          listApplicationAnswers(app.id),
        ]);
        return { ...app, candidate, answers };
      }),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const page = await listJobApplicationsPage({ jobId });
      const apps = page.items;
      setItems(await enrichApplications(apps));
      setCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
      setLoading(false);
    })();
  }, [jobId, enrichApplications]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await listJobApplicationsPage({ jobId, cursor });
    const enriched = await enrichApplications(page.items);
    setItems((prev) => [...prev, ...enriched]);
    setCursor(page.nextCursor);
    setHasMore(Boolean(page.nextCursor));
    setLoadingMore(false);
  }

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
        a.id === app.id ? { ...a, status: toStatus, statusUpdatedAt: Date.now() } : a,
      ),
    );
  }

  async function openResume(app: Application) {
    const res = await fetch("/api/uploads/resume/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey: app.resumeStorageKey,
        applicationId: app.id,
      }),
    });
    if (!res.ok) {
      alert("Resume download requires configured storage and authorization");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <Panel title="Applicants">
        <p className="text-sm text-[var(--color-muted)]">Loading applicants…</p>
      </Panel>
    );
  }

  return (
    <Panel title="Applicants">
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Manage this opportunity&apos;s pipeline. Shown 20 at a time.
      </p>

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
                    {app.candidate.headline && (
                      <p className="text-sm text-[var(--color-muted)]">{app.candidate.headline}</p>
                    )}
                    {app.candidate.club && (
                      <p className="text-xs text-[var(--color-muted)]">{app.candidate.club}</p>
                    )}
                    {(app.candidate.phone || app.candidate.email) && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {[app.candidate.email, app.candidate.phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Applied {new Date(app.submittedAt).toLocaleDateString()} · {app.resumeFileName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.status === "selected"
                        ? "success"
                        : app.status === "rejected" || app.status === "withdrawn"
                          ? "danger"
                          : app.status === "applied" || app.status === "under_review"
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
                        <dt className="font-medium text-[var(--color-ink)]">{answer.promptSnapshot}</dt>
                        <dd className="text-[var(--color-muted)]">{formatAnswerValue(answer.value)}</dd>
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
                    className="mt-1 max-w-lg text-sm"
                    placeholder="Add context for this status change…"
                    value={notes[app.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => void openResume(app)}>
                    View resume
                  </Button>
                  {next && (
                    <Button type="button" onClick={() => void move(app, next)}>
                      Move to {statusLabel(next)}
                    </Button>
                  )}
                  {app.status !== "rejected" && app.status !== "selected" && (
                    <Button type="button" variant="danger" onClick={() => void move(app, "rejected")}>
                      Reject
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4">
          <Button type="button" variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </Panel>
  );
}
