"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import { createJob, listBusinessJobs } from "@/lib/dal/employer";
import { createChangeRequest, jobLiveSnapshot } from "@/lib/dal/change-requests";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";
import type { Job, JobStatus, JobType, WorkplaceType } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MenuSelect } from "@/components/ui/menu-select";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui";
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

  useEffect(() => {
    if (!user || bizLoading) return;
    void (async () => {
      setLoading(true);
      if (!business) {
        setJobs([]);
        setLoading(false);
        return;
      }
      const listed = await listBusinessJobs(business.id);
      setJobs(listed);
      setLoading(false);
    })();
  }, [user, business, bizLoading]);

  async function onCreateJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business) return;
    setSubmitting(true);
    setError(null);
    try {
      const fields = parseJobForm(new FormData(e.currentTarget));
      const job = await createJob({ businessId: business.id, createdBy: user.uid, ...fields });
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
      e.currentTarget.reset();
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
            ? `Opportunities for ${business.name}. Open a job to review applicants.`
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
              <form onSubmit={onCreateJob} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" required rows={4} />
                </div>
                <div>
                  <Label htmlFor="responsibilities">Responsibilities</Label>
                  <Textarea id="responsibilities" name="responsibilities" rows={3} />
                </div>
                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea id="requirements" name="requirements" rows={3} />
                </div>
                <div>
                  <Label htmlFor="benefits">Benefits</Label>
                  <Textarea id="benefits" name="benefits" rows={2} />
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
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" />
                  </div>
                  <div>
                    <Label htmlFor="salary">Salary display</Label>
                    <Input id="salary" name="salary" placeholder="₹15-20L" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" name="industry" />
                  </div>
                  <div>
                    <DatePicker id="deadline" name="deadline" label="Application deadline" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input id="skills" name="skills" placeholder="Product, Analytics" />
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
                  <Button type="submit" disabled={submitting} onClick={() => setSubmitMode("review")}>
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
            <ul className="divide-y divide-[var(--color-border)]">
              {jobs.map((job) => (
                <li key={job.id} className="py-4">
                  <Link
                    href={`/employer/jobs/${job.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 hover:opacity-90"
                  >
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{job.title}</p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {job.location ?? "Location flexible"} · {JOB_TYPE_LABELS[job.type]} · View
                        applicants
                      </p>
                    </div>
                    {jobStatusBadge(job.status)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {message && <p className="mt-4 text-sm text-[var(--color-success)]">{message}</p>}
      {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
    </main>
  );
}
