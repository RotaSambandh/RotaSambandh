"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { CompanyVerificationReview } from "@/components/admin/company-verification-review";
import { getAdminBusiness, getLatestVerificationForBusiness } from "@/lib/dal/admin";
import {
  listBusinessJobsRtdb,
  listEmployerMembersRtdb,
} from "@/lib/dal/employer-rtdb";
import { JOB_TYPE_LABELS } from "@/lib/dal/job-meta";
import { usePlatformAccess } from "@/hooks/use-platform-access";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  businessStatusLabel,
  businessStatusTone,
  jobStatusLabel,
  jobStatusTone,
} from "@/lib/ui/status-labels";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import type {
  Business,
  BusinessMember,
  BusinessVerification,
  Job,
} from "@/shared/types";

type ReviewDecision = "approved" | "rejected" | "info_requested";

export default function AdminBusinessDetailPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const { canWrite } = usePlatformAccess();
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [verification, setVerification] = useState<BusinessVerification | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const [biz, team, roles, latestVerification] = await Promise.all([
      getAdminBusiness(businessId),
      listEmployerMembersRtdb(businessId),
      listBusinessJobsRtdb(businessId),
      getLatestVerificationForBusiness(businessId),
    ]);
    setBusiness(biz);
    setMembers(team);
    setJobs(roles);
    setVerification(latestVerification);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function decide(decision: ReviewDecision) {
    if (!verification) return;
    if (decision !== "approved" && !note.trim()) {
      setError("Admin note is required to reject or request info.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(decision);
    try {
      await callPrivilegedAdmin({
        action: "review_verification",
        payload: {
          verificationId: verification.id,
          businessId,
          decision,
          adminNote: note.trim() || undefined,
        },
      });
      setMessage(
        decision === "approved"
          ? "Company verified."
          : decision === "rejected"
            ? "Verification rejected."
            : "Requested more information from the employer.",
      );
      try {
        await reload();
      } catch {
        // Mutation already succeeded; a refresh glitch should not look like a failed review.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading business…" />;
  if (!business) {
    return (
      <main>
        <EmptyState title="Business not found" description="This company may have been removed." />
        <Link
          href="/admin/businesses"
          className="mt-4 inline-block text-sm text-[var(--color-accent-strong)]"
        >
          Back to businesses
        </Link>
      </main>
    );
  }

  const owner =
    members.find(
      (m) => normalizeBusinessMemberRole(m.role) === "company_admin",
    ) ?? members.find((m) => m.userId === business.ownerId);

  const canDecideVerification =
    !!verification && verification.status === "pending" && canWrite;
  const showVerificationPanel =
    !!verification || business.status === "verification_pending";

  return (
    <main>
      <Link
        href="/admin/businesses"
        className="text-sm text-[var(--color-accent-strong)] hover:underline"
      >
        All businesses
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={business.name || "Company"}
          description={
            [business.industry, business.location].filter(Boolean).join(" · ") ||
            "Employer profile"
          }
        />
        <StatusPill
          label={businessStatusLabel(business.status)}
          tone={businessStatusTone(business.status)}
        />
      </div>

      {showVerificationPanel ? (
        <Panel
          className="mt-6 space-y-4"
          title="Verification review"
          tone={
            verification?.status === "pending" || business.status === "verification_pending"
              ? "attention"
              : "default"
          }
        >
          <CompanyVerificationReview
            businessId={businessId}
            verification={verification}
            linkToDetail={false}
            showId={false}
            hideIdentityHeader
          />
          {canDecideVerification ? (
            <>
              <div>
                <Label htmlFor="detail-ver-note">Admin note</Label>
                <Textarea
                  id="detail-ver-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Required when rejecting or asking for more info"
                  rows={3}
                  className="mt-1"
                />
              </div>
              {error ? (
                <Banner tone="danger" title="Could not submit review">
                  {error}
                </Banner>
              ) : null}
              {message ? (
                <Banner tone="success" title="Updated">
                  {message}
                </Banner>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!!busy} onClick={() => void decide("approved")}>
                  {busy === "approved" ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => void decide("info_requested")}
                >
                  {busy === "info_requested" ? "Sending…" : "Request info"}
                </Button>
                <Button
                  variant="danger"
                  disabled={!!busy}
                  onClick={() => void decide("rejected")}
                >
                  {busy === "rejected" ? "Rejecting…" : "Reject"}
                </Button>
              </div>
            </>
          ) : verification?.status === "pending" ? (
            <Banner tone="info" title="Coordinator view">
              Admins approve verification from this page or the businesses queue.
            </Banner>
          ) : verification ? (
            <Banner
              tone={
                verification.status === "approved"
                  ? "success"
                  : verification.status === "rejected"
                    ? "danger"
                    : "warning"
              }
              title={
                verification.status === "approved"
                  ? "Already approved"
                  : verification.status === "rejected"
                    ? "Rejected. Waiting for the employer to resubmit"
                    : "More info requested. Waiting on the employer"
              }
            >
              {verification.adminNote
                ? verification.adminNote
                : "The employer can see this status and any note on their Company page."}
            </Banner>
          ) : (
            <Banner tone="warning" title="Verification details missing">
              This company is marked as pending verification, but the review packet did not load.
              Ask the employer to resubmit, or refresh after a few minutes.
            </Banner>
          )}
        </Panel>
      ) : (
        <Panel className="mt-6 space-y-4" title="Company profile">
          <CompanyVerificationReview
            businessId={businessId}
            linkToDetail={false}
            showId={false}
            hideIdentityHeader
          />
          {owner ? (
            <p className="text-sm text-[var(--color-muted)]">
              Primary admin:{" "}
              <span className="font-medium text-[var(--color-ink)]">
                {owner.displayName || owner.email || "Team member"}
              </span>
              {owner.email ? ` · ${owner.email}` : ""}
            </p>
          ) : null}
        </Panel>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Jobs from this company
        </h2>
        {jobs.length === 0 ? (
          <EmptyState title="No jobs" description="Roles posted by this employer will list here." />
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            {jobs.map((job) => (
              <li key={job.id}>
                <ListRow
                  href={`/admin/jobs/${job.id}`}
                  title={job.title || "Untitled role"}
                  subtitle={JOB_TYPE_LABELS[job.type]}
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
      </section>
    </main>
  );
}
