"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import { ApplicantsPanel } from "@/components/employer/applicants-panel";
import {
  ScreeningQuestionsEditor,
  draftsFromQuestions,
  type ScreeningDraft,
} from "@/components/employer/screening-questions-editor";
import { getEmployerJobById, updateDraftJob } from "@/lib/dal/employer";
import {
  createChangeRequest,
  jobLiveSnapshot,
  listChangeRequestsForBusiness,
} from "@/lib/dal/change-requests";
import { listJobQuestions, persistJobScreeningDrafts } from "@/lib/dal/questions";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import type { ChangeRequest, Job, JobType, WorkplaceType } from "@/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Banner, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { StatusPill } from "@/components/ui/status-pill";
import { JobPostingBody } from "@/components/jobs/job-posting-body";
import { JobMetaRow } from "@/components/jobs/job-meta-row";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { isNonEmptyHtml, sanitizeCompanyHtml } from "@/lib/sanitize/html";
import { jobStatusLabel, jobStatusTone } from "@/lib/ui/status-labels";

function parseJobForm(
  fd: FormData,
  rich: {
    description: string;
    responsibilities: string;
    requirements: string;
    benefits: string;
  },
) {
  const deadlineRaw = String(fd.get("deadline"));
  const deadline = deadlineRaw ? new Date(deadlineRaw).getTime() : undefined;
  return {
    title: String(fd.get("title")),
    description: sanitizeCompanyHtml(rich.description),
    responsibilities: sanitizeCompanyHtml(rich.responsibilities),
    requirements: sanitizeCompanyHtml(rich.requirements),
    benefits: sanitizeCompanyHtml(rich.benefits),
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
  const [screeningDrafts, setScreeningDrafts] = useState<ScreeningDraft[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "review">("draft");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");

  const pendingJobCr = useMemo(
    () =>
      changeRequests.find(
        (cr) => cr.targetId === jobId && cr.status === "pending_review",
      ) ?? null,
    [changeRequests, jobId],
  );

  const isPublished = job?.status === "published";
  const isDraft = job?.status === "draft";
  const isPendingReview = job?.status === "pending_review";
  const showEditForm = isDraft || editing;
  const showReadOnlyPacket = Boolean(job) && !showEditForm;
  const formLocked = Boolean(pendingJobCr);
  const canClose = isPublished && !formLocked;

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
      setDescription(loaded.description ?? "");
      setResponsibilities(loaded.responsibilities ?? "");
      setRequirements(loaded.requirements ?? "");
      setBenefits(loaded.benefits ?? "");
      const [crs, jobQuestions] = await Promise.all([
        listChangeRequestsForBusiness(loaded.businessId),
        listJobQuestions(jobId, loaded.businessId),
      ]);
      setChangeRequests(crs);
      setScreeningDrafts(draftsFromQuestions(jobQuestions));
      setLoading(false);
    })();
  }, [user, jobId, businesses, bizLoading, activeBusiness?.id, setActiveBusiness]);

  async function onSaveJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !job || !businessId) return;
    setSubmitting(true);
    setError(null);
    const fields = parseJobForm(new FormData(e.currentTarget), {
      description,
      responsibilities,
      requirements,
      benefits,
    });
    if (!isNonEmptyHtml(fields.description)) {
      setError("A job description is required.");
      setSubmitting(false);
      return;
    }

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

  async function onCloseJob() {
    if (!user || !job || !businessId || !canClose) return;
    const ok = window.confirm(
      "Close this opportunity? Candidates will no longer see it as open. Admin will confirm the close.",
    );
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await createChangeRequest({
        targetType: "job",
        targetId: job.id,
        businessId,
        action: "close",
        proposed: { status: "closed" },
        liveSnapshot: jobLiveSnapshot(job),
        submittedBy: user.uid,
        title: `Close ${job.title}`,
        submit: true,
      });
      setChangeRequests(await listChangeRequestsForBusiness(businessId));
      setMessage("Close request submitted for admin review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close job");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveQuestions() {
    if (!job) return;
    setSavingQuestions(true);
    setError(null);
    try {
      const saved = await persistJobScreeningDrafts(
        job.id,
        job.businessId,
        screeningDrafts,
      );
      setScreeningDrafts(draftsFromQuestions(saved));
      setMessage(
        saved.length
          ? `Saved ${saved.length} screening question${saved.length === 1 ? "" : "s"}`
          : "Screening questions cleared",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setSavingQuestions(false);
    }
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
    <main>
      <PageHeader
        breadcrumb={
          <Link href="/employer/jobs" className="hover:underline">
            All jobs
          </Link>
        }
        title={job.title}
        description={[job.location, JOB_TYPE_LABELS[job.type], WORKPLACE_LABELS[job.workplace]]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <StatusPill label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
        }
      />

      {isPendingReview && (
        <Banner tone="warning" title="Waiting for review" className="mb-6">
          This posting is with staff for review. You can still read the full packet below.
        </Banner>
      )}

      {pendingJobCr && !isPendingReview && (
        <Banner tone="warning" title="Pending change request" className="mb-6">
          Changes are with admin review. The live listing remains unchanged until approved.
        </Banner>
      )}

      {job.status === "closed" || job.status === "filled" || job.status === "expired" ? (
        <Banner tone="info" title={`This role is ${jobStatusLabel(job.status).toLowerCase()}`} className="mb-6">
          The posting below is read-only.
        </Banner>
      ) : null}

      {showReadOnlyPacket && (
        <Panel className="mb-6" title="Job packet">
          <JobMetaRow
            type={job.type}
            workplace={job.workplace}
            location={job.location}
            salary={job.salaryDisplay}
            postedAt={job.postedAt}
            deadline={job.deadline}
            featured={job.featured}
          />
          <div className="mt-5">
            <JobPostingBody
              description={job.description}
              responsibilities={job.responsibilities}
              requirements={job.requirements}
              benefits={job.benefits}
            />
          </div>
          {job.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <Badge key={skill} variant="neutral">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {isPublished && !formLocked && (
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                Propose changes
              </Button>
            )}
            {canClose && (
              <Button
                type="button"
                variant="danger"
                disabled={submitting}
                onClick={() => void onCloseJob()}
              >
                Close job
              </Button>
            )}
          </div>
        </Panel>
      )}

      {showEditForm && (
        <Panel title={isDraft ? "Edit draft" : "Propose changes"} className="mb-6">
          <form onSubmit={onSaveJob} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={job.title} required disabled={formLocked} />
            </div>
            <div>
              <Label>Description</Label>
              <div className="mt-1">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  disabled={formLocked}
                />
              </div>
            </div>
            <div>
              <Label>Responsibilities</Label>
              <div className="mt-1">
                <RichTextEditor
                  value={responsibilities}
                  onChange={setResponsibilities}
                  disabled={formLocked}
                />
              </div>
            </div>
            <div>
              <Label>Requirements</Label>
              <div className="mt-1">
                <RichTextEditor
                  value={requirements}
                  onChange={setRequirements}
                  disabled={formLocked}
                />
              </div>
            </div>
            <div>
              <Label>Benefits</Label>
              <div className="mt-1">
                <RichTextEditor value={benefits} onChange={setBenefits} disabled={formLocked} />
              </div>
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
              <Label htmlFor="skills">Keywords (optional)</Label>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Free tags for the listing (comma-separated).
              </p>
              <Input
                id="skills"
                name="skills"
                className="mt-1"
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
        <ScreeningQuestionsEditor
          value={screeningDrafts}
          onChange={setScreeningDrafts}
          disabled={formLocked}
        />
        <div className="mt-4">
          <Button
            type="button"
            disabled={savingQuestions || formLocked}
            onClick={() => void onSaveQuestions()}
          >
            {savingQuestions ? "Saving…" : "Save questions"}
          </Button>
        </div>
      </Panel>

      {message && (
        <Banner tone="success" title={message} className="mb-4" />
      )}
      {error && <Banner tone="danger" title={error} className="mb-4" />}

      <ApplicantsPanel jobId={jobId} />
    </main>
  );
}
