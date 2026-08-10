"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { RichTextView } from "@/components/editor/rich-text-view";
import { getEmployerMetaRtdb, listEmployerMembersRtdb } from "@/lib/dal/employer-rtdb";
import { normalizeBusinessMemberRole } from "@/shared/rbac";
import type { Business, BusinessMember, BusinessVerification } from "@/shared/types";

function displayOrNotSet(value?: string | null) {
  const v = value?.trim();
  return v ? v : "Not set";
}

export function humanizeAffiliationType(
  type: BusinessVerification["affiliationType"] | string,
): string {
  switch (type) {
    case "rotarian":
      return "Rotarian";
    case "rotaractor":
      return "Rotaractor";
    case "rotary_club":
      return "Rotary club";
    case "other":
      return "Other";
    default:
      return String(type).replaceAll("_", " ");
  }
}

function memberLabel(member: BusinessMember): string {
  return (
    member.displayName?.trim() ||
    member.email?.trim() ||
    member.invitedEmail?.trim() ||
    "Team member"
  );
}

function memberEmail(member: BusinessMember): string | undefined {
  return member.email?.trim() || member.invitedEmail?.trim() || undefined;
}

function memberRoleLabel(member: BusinessMember): string {
  return normalizeBusinessMemberRole(member.role) === "company_admin"
    ? "Company admin"
    : "Manager";
}

function memberStatusLabel(member: BusinessMember): string {
  switch (member.status) {
    case "active":
      return "Active";
    case "invited":
      return "Invited";
    case "revoked":
      return "Revoked";
    default:
      return "Active";
  }
}

/**
 * Company packet for admin verification / detail review.
 * Pass `hideIdentityHeader` when the parent already shows company name / industry.
 */
export function CompanyVerificationReview({
  businessId,
  verification,
  showId = true,
  linkToDetail = true,
  hideIdentityHeader = false,
  showTeam = true,
}: {
  businessId: string;
  verification?: BusinessVerification | null;
  showId?: boolean;
  linkToDetail?: boolean;
  hideIdentityHeader?: boolean;
  showTeam?: boolean;
}) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [meta, team] = await Promise.all([
        getEmployerMetaRtdb(businessId),
        listEmployerMembersRtdb(businessId),
      ]);
      if (!cancelled) {
        setBusiness(meta);
        setMembers(team);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const companyName =
    verification?.businessName?.trim() || business?.name?.trim() || "Company profile";
  const affiliationType = verification?.affiliationType ?? undefined;
  const affiliationDetails = verification?.affiliationDetails?.trim() || undefined;
  const supportingInfo = verification?.supportingInfo?.trim() || undefined;
  const adminNote = verification?.adminNote?.trim() || undefined;

  const rotaryName =
    verification?.rotaryContactName || business?.rotaryContactName;
  const rotaryClub =
    verification?.rotaryContactClub || business?.rotaryContactClub;
  const rotaryEmail =
    verification?.rotaryContactEmail || business?.rotaryContactEmail;
  const rotaryPhone =
    verification?.rotaryContactPhone || business?.rotaryContactPhone;

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading company details…</p>;
  }

  const metaLine = [business?.industry, business?.location, business?.companySize]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      {!hideIdentityHeader ? (
        <div>
          {linkToDetail ? (
            <Link
              href={`/admin/businesses/${businessId}`}
              className="text-lg font-semibold text-[var(--color-accent-strong)] hover:underline"
            >
              {companyName}
            </Link>
          ) : (
            <p className="text-lg font-semibold text-[var(--color-ink)]">{companyName}</p>
          )}
          {metaLine ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{metaLine}</p>
          ) : null}
          {showId ? (
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
              Business id: {businessId}
            </p>
          ) : null}
        </div>
      ) : showId ? (
        <p className="font-mono text-xs text-[var(--color-muted)]">
          Business id: {businessId}
        </p>
      ) : null}

      {adminNote &&
      (verification?.status === "info_requested" ||
        verification?.status === "rejected") ? (
        <section className="rounded-lg border border-[var(--color-warning,#d97706)]/40 bg-[var(--color-warning,#d97706)]/8 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Earlier review note
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
            {adminNote}
          </p>
        </section>
      ) : null}

      {verification ? (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Affiliation claim
          </h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Approve only if the company looks legitimate and this Rotary / Rotaract claim is
            credible.
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-muted)]">Type</dt>
              <dd className="font-medium">
                {affiliationType
                  ? humanizeAffiliationType(affiliationType)
                  : "Not set"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-muted)]">Details from employer</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">
                {affiliationDetails || "Not set"}
              </dd>
            </div>
            {supportingInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-muted)]">Supporting info</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{supportingInfo}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Company profile
        </h3>
        <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Website</dt>
            <dd>
              {business?.website ? (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-accent-strong)] hover:underline"
                >
                  {business.website}
                </a>
              ) : (
                "Not set"
              )}
            </dd>
          </div>
          {hideIdentityHeader ? (
            <div>
              <dt className="text-[var(--color-muted)]">Company size</dt>
              <dd>{displayOrNotSet(business?.companySize)}</dd>
            </div>
          ) : !metaLine ? (
            <>
              <div>
                <dt className="text-[var(--color-muted)]">Industry</dt>
                <dd>{displayOrNotSet(business?.industry)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Location</dt>
                <dd>{displayOrNotSet(business?.location)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Company size</dt>
                <dd>{displayOrNotSet(business?.companySize)}</dd>
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-[var(--color-muted)]">Description</dt>
            <dd className="mt-1">
              {business?.description ? (
                <RichTextView html={business.description} />
              ) : (
                "Not set"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Rotary / Rotaract contact
        </h3>
        <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-muted)]">Name</dt>
            <dd>{displayOrNotSet(rotaryName)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Club</dt>
            <dd>{displayOrNotSet(rotaryClub)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Email</dt>
            <dd>{displayOrNotSet(rotaryEmail)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Phone</dt>
            <dd>{displayOrNotSet(rotaryPhone)}</dd>
          </div>
        </dl>
      </section>

      {showTeam ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Company team
          </h3>
          {members.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              No team members on file yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-white">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{memberLabel(member)}</p>
                    {memberEmail(member) ? (
                      <p className="text-[var(--color-muted)]">{memberEmail(member)}</p>
                    ) : (
                      <p className="text-[var(--color-muted)]">Email not set</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="neutral">{memberRoleLabel(member)}</Badge>
                    <Badge variant="neutral">{memberStatusLabel(member)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
