"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import {
  ScreeningQuestionsEditor,
  emptyScreeningDrafts,
  type ScreeningDraft,
} from "@/components/employer/screening-questions-editor";
import { createJob } from "@/lib/dal/employer";
import { listBusinessJobsRtdb } from "@/lib/dal/employer-rtdb";
import { createChangeRequest, jobLiveSnapshot } from "@/lib/dal/change-requests";
import { persistJobScreeningDrafts } from "@/lib/dal/questions";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import type { Job, JobType, WorkplaceType } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState, LoadingBlock, PageHeader, Panel, Banner } from "@/components/ui";
import { ListRow } from "@/components/ui/list-row";
import { StatusPill } from "@/components/ui/status-pill";
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

export default function EmployerJobsPage() {
  const { user } = useAuth();
  const { business, loading: bizLoading } = useActiveBusiness();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "review">("draft");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  const [screeningDrafts, setScreeningDrafts] =
    useState<ScreeningDraft[]>(emptyScreeningDrafts);

  useEffect(() => {
    if (!user || bizLoading) return;
    void (async () => {
      setLoading(true);
      if (!business) {
        setJobs([]);
        setLoading(false);
        return;
      }
      const listed = await listBusinessJobsRtdb(business.id);
      setJobs(listed);
      setLoading(false);
    })();
  }, [user, business, bizLoading]);

  async function onCreateJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business) return;
    const form = e.currentTarget;
    setSubmitting(true);
    setError(null);
    try {
      const fields = parseJobForm(new FormData(form), {
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
      const job = await createJob({
        businessId: business.id,
        createdBy: user.uid,
        ...fields,
      });
      await persistJobScreeningDrafts(job.id, business.id, screeningDrafts);
      if (submitMode === "review") {
        await createChangeRequest({
          targetType: "job",
          targetId: job.id,
          businessId: business.id,
          action: "create",
          proposed: jobLiveSnapshot(job),
          submittedBy: user.uid,
          title: job.title,
          submit: true,
        });
        setJobs((prev) => [{ ...job, status: "pending_review" }, ...prev]);
        setMessage("Opportunity submitted for admin review");
      } else {
        setJobs((prev) => [job, ...prev]);
        setMessage("Draft saved");
      }
      setShowForm(false);
      setDescription("");
      setResponsibilities("");
      setRequirements("");
      setBenefits("");
      setScreeningDrafts(emptyScreeningDrafts());
      form.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : submitMode === "review"
            ? "Failed to submit for review"
            : "Failed to save draft",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user || bizLoading || loading) {
    return <LoadingBlock label="Loading jobs…" />;
  }

  return (
    <main>
      <PageHeader
        title="Jobs"
        description={
          business
            ? `Opportunities for ${business.name}. Open a job to review applicants and their answers.`
            : "Open a job to review its applicants and move candidates through your pipeline."
        }
        actions={
          business ? (
            <Button type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close form" : "Post opportunity"}
            </Button>
          ) : undefined
        }
      />

      {!business ? (
        <EmptyState
          title="Set up your company first"
          description="Create and verify your business profile before posting opportunities."
          action={
            <Link href="/employer/company">
              <Button>Go to company</Button>
            </Link>
          }
        />
      ) : (
        <>
          {showForm && (
            <Panel title="Post opportunity" className="mb-8">
              <form onSubmit={onCreateJob} className="space-y-5">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    placeholder="e.g. Product analyst"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    What the role is. This is the main text candidates read.
                  </p>
                  <div className="mt-1">
                    <RichTextEditor value={description} onChange={setDescription} />
                  </div>
                </div>
                <div>
                  <Label>Responsibilities (optional)</Label>
                  <div className="mt-1">
                    <RichTextEditor
                      value={responsibilities}
                      onChange={setResponsibilities}
                    />
                  </div>
                </div>
                <div>
                  <Label>Requirements (optional)</Label>
                  <div className="mt-1">
                    <RichTextEditor value={requirements} onChange={setRequirements} />
                  </div>
                </div>
                <div>
                  <Label>Benefits (optional)</Label>
                  <div className="mt-1">
                    <RichTextEditor value={benefits} onChange={setBenefits} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <MenuSelect
                      id="type"
                      name="type"
                      label="Type"
                      defaultValue="full_time"
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
                      defaultValue="hybrid"
                      options={Object.entries(WORKPLACE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="location">Location (optional)</Label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="Bengaluru / Remote"
                    />
                  </div>
                  <div>
                    <Label htmlFor="salary">Salary display (optional)</Label>
                    <Input id="salary" name="salary" placeholder="₹15-20L" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="industry">Industry (optional)</Label>
                    <Input id="industry" name="industry" />
                  </div>
                  <div>
                    <DatePicker
                      id="deadline"
                      name="deadline"
                      label="Application deadline (optional)"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="skills">Keywords (optional)</Label>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Free tags for the listing (comma-separated). Not a fixed skill taxonomy.
                  </p>
                  <Input
                    id="skills"
                    name="skills"
                    className="mt-1"
                    placeholder="Analytics, Excel, Customer research"
                  />
                </div>

                <div className="border-t border-[var(--color-border)] pt-5">
                  <ScreeningQuestionsEditor
                    value={screeningDrafts}
                    onChange={setScreeningDrafts}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => setSubmitMode("draft")}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    onClick={() => setSubmitMode("review")}
                  >
                    Submit for review
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          {jobs.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Post your first opportunity to start receiving applications from Rotaractors."
              action={
                <Button type="button" onClick={() => setShowForm(true)}>
                  Post opportunity
                </Button>
              }
            />
          ) : (
            <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
              {jobs.map((job) => (
                <li key={job.id}>
                  <ListRow
                    href={`/employer/jobs/${job.id}`}
                    emphasize={job.status === "pending_review"}
                    title={job.title || "Untitled role"}
                    subtitle={[
                      JOB_TYPE_LABELS[job.type],
                      WORKPLACE_LABELS[job.workplace],
                      job.location?.trim() || null,
                      job.salaryDisplay?.trim() || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    meta={
                      job.status === "pending_review" ? (
                        <span className="text-caption text-[var(--color-warning-ink)]">
                          Waiting for review
                        </span>
                      ) : job.status === "published" ? (
                        <span className="text-caption text-[var(--color-muted)]">
                          Manage applicants
                        </span>
                      ) : job.status === "draft" ? (
                        <span className="text-caption text-[var(--color-muted)]">
                          Finish or submit for review
                        </span>
                      ) : null
                    }
                    trailing={
                      <StatusPill
                        label={jobStatusLabel(job.status)}
                        tone={jobStatusTone(job.status)}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {message && <Banner tone="success" title={message} className="mt-4" />}
      {error && <Banner tone="danger" title={error} className="mt-4" />}
    </main>
  );
}
