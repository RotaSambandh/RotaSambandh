"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { changeRequestDiffRows } from "@/lib/admin/change-request-diff";
import { listPendingChangeRequests } from "@/lib/dal/change-requests";
import { listAllBusinesses, listPendingVerifications } from "@/lib/dal/admin";
import { getEmployerMetaRtdb } from "@/lib/dal/employer-rtdb";
import { CompanyVerificationReview } from "@/components/admin/company-verification-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { MenuSelect } from "@/components/ui/menu-select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  DiffView,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  businessStatusLabel,
  businessStatusTone,
  changeRequestStatusLabel,
  changeRequestStatusTone,
} from "@/lib/ui/status-labels";
import type {
  Business,
  BusinessStatus,
  BusinessVerification,
  ChangeRequest,
} from "@/shared/types";
import { usePlatformAccess } from "@/hooks/use-platform-access";

type ReviewDecision = "approved" | "rejected" | "info_requested";

const STATUS_FILTERS: Array<{ value: "all" | BusinessStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "verified", label: "Verified" },
  { value: "verification_pending", label: "Verification pending" },
  { value: "deletion_pending", label: "Deletion pending" },
  { value: "draft", label: "Draft" },
  { value: "suspended", label: "Suspended" },
];

function actionLabel(action: ChangeRequest["action"]): string {
  switch (action) {
    case "create":
      return "New company";
    case "update":
      return "Profile update";
    case "close":
      return "Close";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function DeletionTeamContext({ businessId }: { businessId: string }) {
  return (
    <CompanyVerificationReview
      businessId={businessId}
      showId={false}
      linkToDetail
    />
  );
}

function DeletionReviewCard({
  business,
  onDone,
}: {
  business: Business;
  onDone: () => void;
}) {
  const { canWrite } = usePlatformAccess();
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState<"restore" | "purge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayName = business.deletionCompanyNameSnapshot ?? business.name;

  async function restore() {
    setError(null);
    setBusy("restore");
    try {
      await callPrivilegedAdmin({
        action: "restore_business_deletion",
        payload: { businessId: business.id },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    setError(null);
    setBusy("purge");
    try {
      await callPrivilegedAdmin({
        action: "purge_business",
        payload: { businessId: business.id, confirmName },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permanent delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="space-y-4" tone="attention" title={displayName || "Company deletion"}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={businessStatusLabel(business.status)}
          tone={businessStatusTone(business.status)}
        />
        {business.purgeStatus === "failed" ? (
          <StatusPill label="Purge failed" tone="danger" />
        ) : null}
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted)]">Requested</dt>
          <dd>
            {business.deletionRequestedAt
              ? new Date(business.deletionRequestedAt).toLocaleString()
              : "Not set"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Prior status</dt>
          <dd>
            {business.statusBeforeDeletion
              ? businessStatusLabel(business.statusBeforeDeletion)
              : "Not set"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Company</dt>
          <dd>
            <Link
              href={`/admin/businesses/${business.id}`}
              className="font-medium text-[var(--color-accent-strong)] hover:underline"
            >
              Open detail →
            </Link>
          </dd>
        </div>
      </dl>
      {business.purgeError ? (
        <Banner tone="danger" title="Last purge error">
          {business.purgeError}
        </Banner>
      ) : null}
      <DeletionTeamContext businessId={business.id} />
      {canWrite ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!!busy}
              onClick={() => void restore()}
            >
              {busy === "restore" ? "Restoring…" : "Restore company"}
            </Button>
          </div>
          <div className="max-w-md space-y-2 border-t border-[var(--color-border)] pt-4">
            <Label htmlFor={`purge-${business.id}`}>
              Type <span className="font-semibold text-[var(--color-ink)]">{displayName}</span> to
              permanently delete
            </Label>
            <Input
              id={`purge-${business.id}`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="danger"
              disabled={
                !!busy ||
                confirmName.trim().toLowerCase() !== displayName.trim().toLowerCase()
              }
              onClick={() => void purge()}
            >
              {busy === "purge" ? "Deleting…" : "Permanent delete"}
            </Button>
            <p className="text-xs text-[var(--color-muted)]">
              Removes company data and employer access. Candidates keep application stubs.
            </p>
          </div>
          {error ? (
            <Banner tone="danger" title="Could not update deletion">
              {error}
            </Banner>
          ) : null}
        </>
      ) : (
        <Banner tone="info" title="Coordinator view">
          Only admins can restore or permanently delete companies.
        </Banner>
      )}
    </Panel>
  );
}

function ChangeRequestReviewCard({
  item,
  onDone,
}: {
  item: ChangeRequest;
  onDone: (id: string) => void;
}) {
  const { canWrite } = usePlatformAccess();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    void getEmployerMetaRtdb(item.businessId).then((meta) => {
      setBusinessName(meta?.name?.trim() || "");
    });
  }, [item.businessId]);

  async function decide(decision: ReviewDecision) {
    if (decision !== "approved" && !note.trim()) {
      setError("Admin note is required to reject or request info.");
      return;
    }
    setError(null);
    setBusy(decision);
    try {
      await callPrivilegedAdmin({
        action: "review_change_request",
        payload: {
          changeRequestId: item.id,
          decision,
          adminNote: note.trim() || undefined,
        },
      });
      onDone(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      className="space-y-4"
      tone="attention"
      title={item.title?.trim() || businessName || "Company change request"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={actionLabel(item.action)} tone="neutral" />
        <StatusPill
          label={changeRequestStatusLabel(item.status)}
          tone={changeRequestStatusTone(item.status)}
        />
      </div>
      <p className="text-sm text-[var(--color-muted)]">
        <Link
          href={`/admin/businesses/${item.businessId}`}
          className="font-medium text-[var(--color-accent-strong)] hover:underline"
        >
          {businessName || "Open company"}
        </Link>
      </p>
      <CompanyVerificationReview businessId={item.businessId} showId={false} />
      <DiffView rows={changeRequestDiffRows(item)} />
      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`note-${item.id}`}>Admin note</Label>
            <Textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required when rejecting or asking for more info"
              rows={3}
              className="mt-1"
            />
          </div>
          {error && (
            <Banner tone="danger" title="Could not submit review">
              {error}
            </Banner>
          )}
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
            <Button variant="danger" disabled={!!busy} onClick={() => void decide("rejected")}>
              {busy === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </>
      ) : (
        <Banner tone="info" title="Coordinator view">
          You can review the diff and coordinate with the business. Approvals are limited to
          admins.
        </Banner>
      )}
    </Panel>
  );
}

function VerificationReviewCard({
  item,
  onDone,
}: {
  item: BusinessVerification;
  onDone: (id: string) => void;
}) {
  const { canWrite } = usePlatformAccess();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: ReviewDecision) {
    if (decision !== "approved" && !note.trim()) {
      setError("Admin note is required to reject or request info.");
      return;
    }
    setError(null);
    setBusy(decision);
    try {
      await callPrivilegedAdmin({
        action: "review_verification",
        payload: {
          verificationId: item.id,
          businessId: item.businessId,
          decision,
          adminNote: note.trim() || undefined,
        },
      });
      onDone(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="space-y-4" title="Verification review" tone="attention">
      <StatusPill label="Pending verification" tone="warning" />
      <CompanyVerificationReview businessId={item.businessId} verification={item} />
      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`ver-note-${item.id}`}>Admin note</Label>
            <Textarea
              id={`ver-note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required when rejecting or asking for more info"
              rows={3}
              className="mt-1"
            />
          </div>
          {error && (
            <Banner tone="danger" title="Could not submit review">
              {error}
            </Banner>
          )}
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
            <Button variant="danger" disabled={!!busy} onClick={() => void decide("rejected")}>
              {busy === "rejected" ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        </>
      ) : (
        <Banner tone="info" title="Coordinator view">
          Coordinate with this business on affiliation proof. Admins approve verification.
        </Banner>
      )}
    </Panel>
  );
}

export default function AdminBusinessesPage() {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [verifications, setVerifications] = useState<BusinessVerification[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | BusinessStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [crs, vers, all] = await Promise.all([
      listPendingChangeRequests(),
      listPendingVerifications(),
      listAllBusinesses(),
    ]);
    setChangeRequests(crs.filter((c) => c.targetType === "business"));
    setVerifications(vers);
    setBusinesses(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return businesses.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        b.name,
        b.industry,
        b.location,
        b.companySize,
        businessStatusLabel(b.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [businesses, statusFilter, search]);

  const pendingDeletions = useMemo(
    () =>
      businesses.filter(
        (b) => b.status === "deletion_pending" || b.purgeStatus === "failed",
      ),
    [businesses],
  );

  if (loading) return <LoadingBlock label="Loading businesses…" />;

  return (
    <main>
      <PageHeader
        title="Businesses"
        description="Review verification first, then profile changes and deletions. Open any company for the full profile and team."
      />

      <section className="mb-12 space-y-4">
        <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Verification queue ({verifications.length})
        </h2>
        {verifications.length === 0 ? (
          <EmptyState
            title="No pending verifications"
            description="When an employer submits Rotary affiliation for review, the full company packet appears here."
          />
        ) : (
          <ul className="space-y-4">
            {verifications.map((item) => (
              <li key={item.id}>
                <VerificationReviewCard
                  item={item}
                  onDone={(id) => setVerifications((prev) => prev.filter((v) => v.id !== id))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12 space-y-4">
        <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Pending profile changes ({changeRequests.length})
        </h2>
        {changeRequests.length === 0 ? (
          <EmptyState
            title="No pending business changes"
            description="Employer profile updates and new business proposals appear here for review."
          />
        ) : (
          <ul className="space-y-4">
            {changeRequests.map((item) => (
              <li key={item.id}>
                <ChangeRequestReviewCard
                  item={item}
                  onDone={(id) => setChangeRequests((prev) => prev.filter((c) => c.id !== id))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12 space-y-4">
        <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Pending deletions ({pendingDeletions.length})
        </h2>
        {pendingDeletions.length === 0 ? (
          <EmptyState
            title="No deletion requests"
            description="When a company admin requests removal, restore or permanent delete appears here."
          />
        ) : (
          <ul className="space-y-4">
            {pendingDeletions.map((biz) => (
              <li key={biz.id}>
                <DeletionReviewCard
                  business={biz}
                  onDone={() => void load()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-overline font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            All businesses ({filtered.length})
          </h2>
          <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="biz-search">Search</Label>
              <Input
                id="biz-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, industry, location…"
                className="mt-1"
              />
            </div>
            <div className="w-full sm:w-48">
              <MenuSelect
                id="biz-status-filter"
                label="Status"
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "all" | BusinessStatus)}
                options={STATUS_FILTERS}
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={businesses.length === 0 ? "No businesses yet" : "No businesses match"}
            description={
              businesses.length === 0
                ? "Employer sign-ups create company records here for review and oversight."
                : "Try a different search or clear the status filter."
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            {filtered.map((biz) => (
              <li key={biz.id}>
                <ListRow
                  href={`/admin/businesses/${biz.id}`}
                  title={biz.name || "Unnamed company"}
                  subtitle={
                    [biz.industry, biz.location, biz.companySize].filter(Boolean).join(" · ") ||
                    "Open for website, team, and affiliation details"
                  }
                  trailing={
                    <StatusPill
                      label={businessStatusLabel(biz.status)}
                      tone={businessStatusTone(biz.status)}
                    />
                  }
                  emphasize={
                    biz.status === "verification_pending" ||
                    biz.status === "deletion_pending"
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
