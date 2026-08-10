"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  FileUpload,
  LoadingBlock,
  PageHeader,
  Panel,
  Stepper,
} from "@/components/ui";
import { getJobDetail } from "@/lib/dal/jobs-client";
import { isJobOpenForApplications } from "@/lib/dal/job-meta";
import { listJobQuestions } from "@/lib/dal/questions";
import { submitApplication } from "@/lib/dal/applications";
import { getUser, updateUserPhone } from "@/lib/dal/users";
import { trackEvent } from "@/lib/observability/analytics";
import { ALLOWED_RESUME_MIME, MAX_RESUME_BYTES } from "@/shared/constants";
import type { JobDetailReadModel, Question } from "@/shared/types";
import { isFirebaseConfigured } from "@/lib/firebase/client";

type Step = "confirm" | "resume" | "questions" | "submit";

interface ResumeForApplication {
  documentId: string;
  storageKey: string;
  fileName: string;
  fileSize: number;
}

export default function ApplyWizardPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("confirm");
  const [job, setJob] = useState<JobDetailReadModel | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resume, setResume] = useState<ResumeForApplication | null>(null);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    void getJobDetail(jobId).then(setJob);
    void listJobQuestions(jobId).then(setQuestions);
  }, [jobId]);

  useEffect(() => {
    if (!user) return;
    void getUser(user.uid).then((doc) => setPhone(doc?.phone ?? ""));
  }, [user]);

  const steps = useMemo(() => {
    const base: Array<{ id: Step; label: string }> = [
      { id: "confirm", label: "Contact" },
      { id: "resume", label: "Resume" },
    ];
    if (questions.length > 0) {
      base.push({ id: "questions", label: "Questions" });
    }
    base.push({ id: "submit", label: "Submit" });
    return base;
  }, [questions.length]);

  function afterResume() {
    setError(null);
    setStep(questions.length > 0 ? "questions" : "submit");
  }

  async function attachResume(file: File) {
    setError(null);
    if (!ALLOWED_RESUME_MIME.includes(file.type as (typeof ALLOWED_RESUME_MIME)[number])) {
      setError("Upload a PDF or DOCX resume.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError("Resume must be 2 MB or smaller.");
      return;
    }
    if (!user) {
      setError("Sign in to continue.");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError("Uploads are unavailable until Firebase is configured.");
      return;
    }

    setUploading(true);
    try {
      const authRes = await fetch("/api/uploads/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          contentLength: file.size,
          candidateId: user.uid,
        }),
      });
      if (!authRes.ok) {
        const err = (await authRes.json().catch(() => null)) as { error?: string } | null;
        setError(err?.error ?? "Could not start resume upload. Try again.");
        setResume(null);
        return;
      }
      const { uploadUrl, documentId, storageKey } = (await authRes.json()) as {
        uploadUrl: string;
        documentId: string;
        storageKey: string;
      };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) {
        setError("Resume upload to storage failed. Try again.");
        setResume(null);
        return;
      }
      const completeRes = await fetch("/api/uploads/resume/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          candidateId: user.uid,
          fileName: file.name,
          storageKey,
          mimeType: file.type,
          fileSize: file.size,
          isPrimary: false,
        }),
      });
      if (!completeRes.ok) {
        const err = (await completeRes.json().catch(() => null)) as { error?: string } | null;
        setError(err?.error ?? "Could not finalize resume upload. Try again.");
        setResume(null);
        return;
      }
      setResume({ documentId, storageKey, fileName: file.name, fileSize: file.size });
    } catch {
      setError("Resume upload failed. Try again.");
      setResume(null);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!job || !user) {
      setError("Sign in to submit your application");
      return;
    }
    if (!resume) {
      setError("Attach a resume for this application");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    for (const q of questions) {
      if (q.required && !answers[q.id]?.trim()) {
        setError(`Please answer: ${q.prompt}`);
        setStep("questions");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateUserPhone(user.uid, phone.trim());
      const id = await submitApplication({
        jobId: job.id,
        businessId: job.businessId,
        candidateId: user.uid,
        resumeDocumentId: resume.documentId,
        resumeStorageKey: resume.storageKey,
        resumeFileName: resume.fileName,
        candidateName: user.displayName ?? "Candidate",
        candidateEmail: user.email ?? "",
        candidatePhone: phone.trim(),
        answers: questions.map((q) => ({
          questionId: q.id,
          questionVersion: q.version,
          promptSnapshot: q.prompt,
          type: q.type,
          value: answers[q.id] ?? "",
        })),
      });
      trackEvent("application_submitted", { jobId: job.id, applicationId: id });
      router.push("/candidate/applications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!job) {
    return <LoadingBlock label="Loading application…" />;
  }

  const open = isJobOpenForApplications(job);

  if (!open) {
    const deadlineLabel = job.deadline
      ? new Date(job.deadline).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return (
      <main>
        <PageHeader title="Applications closed" description={job.title} />
        <Banner tone="warning" title="Deadline passed">
          {deadlineLabel
            ? `Applications closed on ${deadlineLabel}.`
            : "This opportunity is no longer accepting applications."}
        </Banner>
        <Link href="/jobs" className="mt-6 inline-block">
          <Button variant="secondary">Browse open roles</Button>
        </Link>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        breadcrumb={
          <Link href={`/jobs/${job.id}`} className="hover:text-[var(--color-accent-strong)]">
            {job.title}
          </Link>
        }
        title="Apply"
        description={`${job.company} · Contact, resume${
          questions.length ? ", a few questions" : ""
        }, then submit.`}
      />

      <Stepper steps={steps} current={step} />

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {step === "confirm" && (
          <Panel title="Confirm contact">
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              This employer will see your name, email, and phone on the application.
            </p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Name</dt>
                <dd className="font-medium">{user?.displayName ?? "Candidate"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Email</dt>
                <dd className="font-medium">{user?.email ?? "Not set"}</dd>
              </div>
              <div>
                <Label htmlFor="apply-phone">Phone</Label>
                <Input
                  id="apply-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number for this employer"
                  required
                  className="mt-1"
                />
              </div>
            </dl>
            <Button
              type="button"
              className="mt-4"
              disabled={!phone.trim()}
              onClick={() => {
                if (user && phone.trim()) {
                  void updateUserPhone(user.uid, phone.trim());
                }
                setStep("resume");
              }}
            >
              Continue
            </Button>
          </Panel>
        )}

        {step === "resume" && (
          <Panel title="Resume">
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              PDF or DOCX, max 2 MB. Keep portfolios as a link in your profile, not a giant PDF.
            </p>
            <FileUpload
              id="resume-file"
              label="PDF or DOCX · max 2 MB"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={uploading}
              hint="Each application keeps its own resume snapshot."
              onFile={(file) => void attachResume(file)}
            />
            {resume && (
              <Banner tone="success" title={`Attached: ${resume.fileName}`} className="mt-4">
                {Math.round(resume.fileSize / 1024)} KB
              </Banner>
            )}
            {error && (
              <Banner tone="danger" title="Upload issue" className="mt-4">
                {error}
              </Banner>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("confirm")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!resume || uploading}
                onClick={afterResume}
              >
                {uploading ? "Uploading…" : "Continue"}
              </Button>
            </div>
          </Panel>
        )}

        {step === "questions" && questions.length > 0 && (
          <Panel title="Employer questions">
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              These were set by the employer for this role.
            </p>
            {questions.map((q) => (
              <div key={q.id} className="mb-4">
                <Label htmlFor={q.id}>
                  {q.prompt}
                  {q.required ? " *" : ""}
                </Label>
                {q.type === "long_text" ? (
                  <Textarea
                    id={q.id}
                    required={q.required}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={q.id}
                    type={q.type === "number" ? "number" : q.type === "url" ? "url" : "text"}
                    required={q.required}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("resume")}>
                Back
              </Button>
              <Button type="button" onClick={() => setStep("submit")}>
                Continue
              </Button>
            </div>
          </Panel>
        )}

        {step === "submit" && (
          <Panel title="Submit application">
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-[var(--color-muted)]">Role:</span> {job.title}
              </li>
              <li>
                <span className="text-[var(--color-muted)]">Company:</span> {job.company}
              </li>
              <li>
                <span className="text-[var(--color-muted)]">Resume:</span>{" "}
                {resume?.fileName ?? "Not attached"}
              </li>
              <li>
                <span className="text-[var(--color-muted)]">Questions:</span>{" "}
                {questions.length === 0
                  ? "None for this role"
                  : `${Object.values(answers).filter((v) => v.trim()).length} of ${questions.length} answered`}
              </li>
            </ul>
            {error && (
              <Banner tone="danger" title="Submission failed" className="mt-4">
                {error}
              </Banner>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(questions.length > 0 ? "questions" : "resume")}
              >
                Back
              </Button>
              <Button type="submit" disabled={submitting || !resume}>
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            </div>
          </Panel>
        )}
      </form>
    </main>
  );
}
