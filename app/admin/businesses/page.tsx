"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { callPrivilegedAdmin } from "@/lib/admin/privileged-client";
import { changeRequestDiffRows } from "@/lib/admin/change-request-diff";
import { listPendingChangeRequests } from "@/lib/dal/change-requests";
import { listAllBusinesses, listPendingVerifications } from "@/lib/dal/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MenuSelect } from "@/components/ui/menu-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Banner,
  DiffView,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import type {
  Business,
  BusinessMember,
  BusinessStatus,
  BusinessVerification,
  ChangeRequest,
} from "@/shared/types";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import { listBusinessMembers } from "@/lib/dal/employer";
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

function statusBadge(status: BusinessStatus) {
  switch (status) {
    case "verified":
      return <Badge variant="success">Verified</Badge>;
    case "verification_pending":
      return <Badge variant="warning">Verification pending</Badge>;
    case "deletion_pending":
      return <Badge variant="danger">Deletion pending</Badge>;
    case "draft":
      return <Badge variant="neutral">Draft</Badge>;
    case "suspended":
      return <Badge variant="danger">Suspended</Badge>;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function BusinessTeamContext({ businessId }: { businessId: string }) {
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await listBusinessMembers(businessId);
      if (!cancelled) {
        setMembers(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading company team…</p>;
  }
  if (members.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No company team on file yet.</p>;
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Company team
      </p>
      <ul className="mt-2 space-y-2">
        {members.map((member) => (
          <li key={member.id} className="text-sm">
            <span className="font-medium">
              {member.displayName || member.email || member.userId}
            </span>
            {member.email && (
              <span className="text-[var(--color-muted)]"> · {member.email}</span>
            )}
            <span className="ml-2">
              <Badge variant="neutral">
                {normalizeBusinessMemberRole(member.role) === "company_admin"
                  ? "Company admin"
                  : "Manager"}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
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
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{displayName}</p>
        {statusBadge(business.status)}
        {business.purgeStatus === "failed" ? (
          <Badge variant="danger">Purge failed</Badge>
        ) : null}
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted)]">Requested</dt>
          <dd>
            {business.deletionRequestedAt
              ? new Date(business.deletionRequestedAt).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Prior status</dt>
          <dd>{business.statusBeforeDeletion?.replaceAll("_", " ") ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Business</dt>
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
      <BusinessTeamContext businessId={business.id} />
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
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
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
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{item.title ?? item.targetId}</p>
        <Badge variant="neutral">{item.action}</Badge>
        <Badge>{item.status.replaceAll("_", " ")}</Badge>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted)]">Business</dt>
          <dd>
            <Link
              href={`/admin/businesses/${item.businessId}`}
              className="font-medium text-[var(--color-accent-strong)] hover:underline"
            >
              Open business →
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Target ID</dt>
          <dd className="font-mono text-xs">{item.targetId}</dd>
        </div>
      </dl>
      <DiffView rows={changeRequestDiffRows(item)} />
      <BusinessTeamContext businessId={item.businessId} />
      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`note-${item.id}`}>Admin note</Label>
            <Textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for reject or request info"
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
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/businesses/${item.businessId}`}
          className="font-semibold text-[var(--color-accent-strong)] hover:underline"
        >
          {item.businessId}
        </Link>
        <Badge>{item.status}</Badge>
        <Badge variant="neutral">{item.affiliationType}</Badge>
      </div>
      <p className="text-sm text-[var(--color-muted)]">{item.affiliationDetails}</p>
      <BusinessTeamContext businessId={item.businessId} />
      {canWrite ? (
        <>
          <div>
            <Label htmlFor={`ver-note-${item.id}`}>Admin note</Label>
            <Textarea
              id={`ver-note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for reject or request info"
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
    if (statusFilter === "all") return businesses;
    return businesses.filter((b) => b.status === statusFilter);
  }, [businesses, statusFilter]);

  const pendingDeletions = useMemo(
    () =>
      businesses.filter(
        (b) => b.status === "deletion_pending" || b.purgeStatus === "failed",
      ),
    [businesses],
  );

  if (loading) return <LoadingBlock label="Loading businesses…" />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Businesses"
        description="Browse every employer on the network, open a company for detail, and clear verification, profile change, or deletion queues."
      />

      <section className="mb-12 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
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

      <section className="mb-12 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            All businesses ({filtered.length})
          </h2>
          <div className="w-full max-w-xs">
            <MenuSelect
              id="biz-status-filter"
              label="Filter by status"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | BusinessStatus)}
              options={STATUS_FILTERS}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No businesses yet"
            description="Employer sign-ups create company records here for review and oversight."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white">
            {filtered.map((biz) => (
              <li key={biz.id}>
                <Link
                  href={`/admin/businesses/${biz.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 transition hover:bg-[var(--color-surface)]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink)]">{biz.name}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {[biz.industry, biz.location, biz.companySize].filter(Boolean).join(" · ") ||
                        "No profile details yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusBadge(biz.status)}
                    <span className="text-xs text-[var(--color-accent-strong)]">Open →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
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

      <section className="mt-12 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Verification queue ({verifications.length})
        </h2>
        {verifications.length === 0 ? (
          <EmptyState
            title="No pending verifications"
            description="Rotary affiliation proofs waiting for admin review will show up here."
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
    </main>
  );
}
