"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import { ApplicantsPanel } from "@/components/employer/applicants-panel";
import { getEmployerJobById, updateDraftJob } from "@/lib/dal/employer";
import {
  createChangeRequest,
  jobLiveSnapshot,
  listChangeRequestsForBusiness,
} from "@/lib/dal/change-requests";
import {
  attachQuestionsToJob,
  createQuestion,
  listJobQuestions,
  listPlatformQuestions,
} from "@/lib/dal/questions";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import type { ChangeRequest, Job, JobStatus, JobType, Question, WorkplaceType } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MenuSelect } from "@/components/ui/menu-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Banner, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { assertNever } from "@/lib/utils";

function jobStatusBadge(status: JobStatus) {
  switch (status) {
    case "published":
      return <Badge variant="success">Published</Badge>;
    case "pending_review":
      return <Badge variant="warning">Pending review</Badge>;
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "closed":
    case "filled":
    case "expired":
      return <Badge variant="neutral">{status.replaceAll("_", " ")}</Badge>;
    default:
      return assertNever(status);
  }
}

function parseJobForm(fd: FormData) {
  const deadlineRaw = String(fd.get("deadline"));
  const deadline = deadlineRaw ? new Date(deadlineRaw).getTime() : undefined;
  return {
    title: String(fd.get("title")),
    description: String(fd.get("description")),
    responsibilities: String(fd.get("responsibilities")),
    requirements: String(fd.get("requirements")),
    benefits: String(fd.get("benefits")),
    skills: String(fd.get("skills"))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    type: String(fd.get("type")) as JobType,
    workplace: String(fd.get("workplace")) as WorkplaceType,
    location: String(fd.get("location")),
    salaryDisplay: String(fd.get("salary")),
    industry: String(fd.get("industry")),
    deadline: Number.isFinite(deadline) ? deadline : undefined,
  };
}

function deadlineInputValue(deadline?: number): string {
  if (!deadline) return "";
  return new Date(deadline).toISOString().slice(0, 10);
}

export default function EmployerJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const { businesses, business: activeBusiness, loading: bizLoading, setActiveBusiness } =
    useActiveBusiness();
  const [job, setJob] = useState<Job | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [platformQuestions, setPlatformQuestions] = useState<Question[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "review">("draft");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pendingJobCr = useMemo(
    () =>
      changeRequests.find(
        (cr) => cr.targetId === jobId && cr.status === "pending_review",
      ) ?? null,
    [changeRequests, jobId],
  );

  const isPublished = job?.status === "published";
  const isDraft = job?.status === "draft";
  const formLocked = Boolean(pendingJobCr);

  useEffect(() => {
    if (!user || bizLoading) return;
    void (async () => {
      setLoading(true);
      let loaded: Job | null = null;
      for (const b of businesses) {
        loaded = await getEmployerJobById(b.id, jobId);
        if (loaded) break;
      }
      if (!loaded) {
        setJob(null);
        setBusinessId(null);
        setLoading(false);
        return;
      }

      const ownsJob = businesses.some((b) => b.id === loaded!.businessId);
      if (!ownsJob) {
        setJob(null);
        setBusinessId(null);
        setLoading(false);
        return;
      }

      if (activeBusiness?.id !== loaded.businessId) {
        void setActiveBusiness(loaded.businessId);
      }

      setBusinessId(loaded.businessId);
      setJob(loaded);
      const [crs, jobQuestions, platform] = await Promise.all([
        listChangeRequestsForBusiness(loaded.businessId),
        listJobQuestions(jobId, loaded.businessId),
        listPlatformQuestions(),
      ]);
      setChangeRequests(crs);
      setQuestions(jobQuestions);
      setPlatformQuestions(platform);
      setSelectedPlatformIds(jobQuestions.map((q) => q.id));
      setLoading(false);
    })();
  }, [user, jobId, businesses, bizLoading, activeBusiness?.id, setActiveBusiness]);

  async function onSaveJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !job || !businessId) return;
    setSubmitting(true);
    setError(null);
    const fields = parseJobForm(new FormData(e.currentTarget));

    try {
      if (isDraft) {
        await updateDraftJob(job.id, fields);
        const updated: Job = { ...job, ...fields, updatedAt: Date.now() };
        setJob(updated);

        if (submitMode === "review") {
          await createChangeRequest({
            targetType: "job",
            targetId: job.id,
            businessId,
            action: "create",
            proposed: jobLiveSnapshot(updated),
            submittedBy: user.uid,
            title: updated.title,
            submit: true,
          });
          setJob({ ...updated, status: "pending_review" });
          setMessage("Submitted for admin review");
        } else {
          setMessage("Draft saved");
        }
      } else if (isPublished) {
        const proposed = jobLiveSnapshot({ ...job, ...fields });
        await createChangeRequest({
          targetType: "job",
          targetId: job.id,
          businessId,
          action: "update",
          proposed,
          liveSnapshot: jobLiveSnapshot(job),
          submittedBy: user.uid,
          title: `Update ${job.title}`,
          submit: true,
        });
        setChangeRequests(await listChangeRequestsForBusiness(businessId));
        setMessage("Changes submitted for admin review");
      }
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAddCustomQuestion() {
    if (!job || !customPrompt.trim()) return;
    const created = await createQuestion({
      scope: "job",
      type: "short_text",
      prompt: customPrompt.trim(),
      required: false,
      jobId: job.id,
      businessId: job.businessId,
    });
    setQuestions((prev) => [...prev, created]);
    setCustomPrompt("");
  }

  async function onSaveQuestions() {
    if (!job) return;
    const items = questions.map((q) => ({
      questionId: q.id,
      questionVersion: q.version,
      required: q.required,
    }));
    await attachQuestionsToJob(job.id, items);
    setMessage("Screening questions saved");
  }

  function togglePlatformQuestion(id: string) {
    setSelectedPlatformIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const selected = platformQuestions.filter((q) => next.includes(q.id));
      const custom = questions.filter((q) => q.scope === "job");
      setQuestions([...selected, ...custom]);
      return next;
    });
  }

  if (bizLoading || loading) {
    return <LoadingBlock label="Loading opportunity…" />;
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm text-[var(--color-muted)]">Opportunity not found.</p>
        <Link href="/employer/jobs" className="mt-4 inline-block text-[var(--color-accent-strong)]">
          ← All jobs
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        breadcrumb={
          <Link href="/employer/jobs" className="hover:underline">
            ← All jobs
          </Link>
        }
        title={job.title}
        description={[job.location, JOB_TYPE_LABELS[job.type], WORKPLACE_LABELS[job.workplace]]
          .filter(Boolean)
          .join(" · ")}
        actions={jobStatusBadge(job.status)}
      />

      {pendingJobCr && (
        <Banner tone="warning" title="Pending review" className="mb-6">
          Changes are with admin review. The live listing remains unchanged until approved.
        </Banner>
      )}

      {isPublished && !editing && (
        <Panel className="mb-6">
          {job.description && <p className="text-[var(--color-muted)]">{job.description}</p>}
          {job.responsibilities && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Responsibilities</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{job.responsibilities}</p>
            </div>
          )}
          {job.requirements && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Requirements</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{job.requirements}</p>
            </div>
          )}
          {job.benefits && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Benefits</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{job.benefits}</p>
            </div>
          )}
          {job.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <Badge key={skill} variant="neutral">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          {!formLocked && (
            <Button type="button" className="mt-4" variant="secondary" onClick={() => setEditing(true)}>
              Edit via change request
            </Button>
          )}
        </Panel>
      )}

      {(isDraft || editing) && (
        <Panel title={isDraft ? "Edit draft" : "Propose changes"} className="mb-6">
          <form onSubmit={onSaveJob} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={job.title} required disabled={formLocked} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={job.description}
                required
                disabled={formLocked}
              />
            </div>
            <div>
              <Label htmlFor="responsibilities">Responsibilities</Label>
              <Textarea
                id="responsibilities"
                name="responsibilities"
                rows={3}
                defaultValue={job.responsibilities ?? ""}
                disabled={formLocked}
              />
            </div>
            <div>
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea
                id="requirements"
                name="requirements"
                rows={3}
                defaultValue={job.requirements ?? ""}
                disabled={formLocked}
              />
            </div>
            <div>
              <Label htmlFor="benefits">Benefits</Label>
              <Textarea
                id="benefits"
                name="benefits"
                rows={2}
                defaultValue={job.benefits ?? ""}
                disabled={formLocked}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <MenuSelect
                  id="type"
                  name="type"
                  label="Type"
                  defaultValue={job.type}
                  disabled={formLocked}
                  options={Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
              <div>
                <MenuSelect
                  id="workplace"
                  name="workplace"
                  label="Workplace"
                  defaultValue={job.workplace}
                  disabled={formLocked}
                  options={Object.entries(WORKPLACE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={job.location ?? ""} disabled={formLocked} />
              </div>
              <div>
                <Label htmlFor="salary">Salary display</Label>
                <Input id="salary" name="salary" defaultValue={job.salaryDisplay ?? ""} disabled={formLocked} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" name="industry" defaultValue={job.industry ?? ""} disabled={formLocked} />
              </div>
              <div>
                <DatePicker
                  id="deadline"
                  name="deadline"
                  label="Application deadline"
                  defaultValue={deadlineInputValue(job.deadline)}
                  disabled={formLocked}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                name="skills"
                defaultValue={job.skills.join(", ")}
                disabled={formLocked}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={submitting || formLocked}
                  onClick={() => setSubmitMode("draft")}
                >
                  Save draft
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitting || formLocked}
                onClick={() => setSubmitMode("review")}
              >
                {isDraft ? "Submit for review" : "Submit changes for review"}
              </Button>
              {editing && (
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Panel>
      )}

      <Panel title="Screening questions" className="mb-6">
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          Choose platform questions or add custom prompts for applicants.
        </p>
        <ul className="space-y-2">
          {platformQuestions.map((q) => (
            <li key={q.id} className="flex items-start gap-2 text-sm">
              <input
                id={`pq-${q.id}`}
                type="checkbox"
                checked={selectedPlatformIds.includes(q.id)}
                onChange={() => togglePlatformQuestion(q.id)}
                className="mt-1"
              />
              <label htmlFor={`pq-${q.id}`}>
                {q.prompt}
                {q.required && <span className="text-[var(--color-muted)]"> (required)</span>}
              </label>
            </li>
          ))}
        </ul>
        {questions.filter((q) => q.scope === "job").length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-4 text-sm">
            {questions
              .filter((q) => q.scope === "job")
              .map((q) => (
                <li key={q.id} className="text-[var(--color-muted)]">
                  Custom: {q.prompt}
                </li>
              ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            placeholder="Custom question prompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="max-w-md"
          />
          <Button type="button" variant="secondary" onClick={() => void onAddCustomQuestion()}>
            Add custom
          </Button>
          <Button type="button" onClick={() => void onSaveQuestions()}>
            Save questions
          </Button>
        </div>
      </Panel>

      {message && <p className="mb-4 text-sm text-[var(--color-success)]">{message}</p>}
      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}

      <ApplicantsPanel jobId={jobId} />
    </main>
  );
}
