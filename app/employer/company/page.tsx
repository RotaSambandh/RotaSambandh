"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useActiveBusiness } from "@/components/employer/active-business-provider";
import {
  inviteBusinessManager,
  listBusinessMembers,
  revokeBusinessMember,
  submitVerification,
  updateDraftBusiness,
} from "@/lib/dal/employer";
import {
  businessLiveSnapshot,
  createChangeRequest,
  listChangeRequestsForBusiness,
  proposedBusinessSlug,
} from "@/lib/dal/change-requests";
import { getEmployerVerificationRtdb } from "@/lib/dal/employer-rtdb";
import type {
  Business,
  BusinessMember,
  BusinessVerification,
  ChangeRequest,
} from "@/shared/types";
import { isCompanyAdmin, normalizeBusinessMemberRole } from "@/shared/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MenuSelect } from "@/components/ui/menu-select";
import { Banner, DiffView, FileUpload, LoadingBlock, PageHeader, Panel } from "@/components/ui";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { uploadBusinessLogo } from "@/lib/uploads/encode-logo";
import { sanitizeCompanyHtml } from "@/lib/sanitize/html";
import { isBusinessDeletionPending } from "@/lib/dal/business-guards";
import Link from "next/link";

const COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "500+", label: "500+" },
];

const AFFILIATION_OPTIONS = [
  { value: "rotarian", label: "Rotarian" },
  { value: "rotaractor", label: "Rotaractor" },
  { value: "rotary_club", label: "Rotary Club" },
  { value: "other", label: "Other" },
];

function humanizeAffiliationType(
  type: BusinessVerification["affiliationType"] | string,
): string {
  const match = AFFILIATION_OPTIONS.find((o) => o.value === type);
  return match?.label ?? String(type).replaceAll("_", " ");
}

function businessStatusBanner(
  business: Business,
  pendingCr: ChangeRequest | null,
  verification: BusinessVerification | null,
) {
  if (business.status === "deletion_pending") {
    return (
      <Banner tone="danger" title="Deletion pending">
        This company is hidden from the public board. An admin will restore it or permanently
        delete it. Editing, hiring, and team changes are blocked until then.
      </Banner>
    );
  }
  if (business.status === "suspended") {
    return (
      <Banner tone="danger" title="Suspended">
        Your company profile is suspended. Contact support before posting new opportunities.
      </Banner>
    );
  }
  if (verification?.status === "info_requested") {
    return (
      <Banner tone="warning" title="We need a bit more information">
        <p className="whitespace-pre-wrap font-medium text-[var(--color-ink)]">
          {verification.adminNote?.trim() ||
            "Please add more detail about your Rotary or Rotaract connection."}
        </p>
        <p className="mt-2 text-sm">
          Update your company profile and affiliation below, then resubmit for review.
        </p>
      </Banner>
    );
  }
  if (verification?.status === "rejected") {
    return (
      <Banner tone="danger" title="Verification was not approved">
        <p className="whitespace-pre-wrap font-medium text-[var(--color-ink)]">
          {verification.adminNote?.trim() ||
            "Update your details and submit verification again."}
        </p>
        <p className="mt-2 text-sm">
          Make the changes below, then resubmit when you are ready.
        </p>
      </Banner>
    );
  }
  if (pendingCr?.status === "pending_review") {
    return (
      <Banner tone="warning" title="Profile changes pending review">
        Your edits are with the review team. The live profile stays unchanged until they are
        approved.
      </Banner>
    );
  }
  if (pendingCr?.status === "info_requested") {
    return (
      <Banner tone="warning" title="More information needed on your profile edit">
        <p className="whitespace-pre-wrap font-medium text-[var(--color-ink)]">
          {pendingCr.adminNote?.trim() ||
            "Please update your changes and submit them again."}
        </p>
      </Banner>
    );
  }
  if (pendingCr?.status === "rejected") {
    return (
      <Banner tone="danger" title="Profile change was not approved">
        <p className="whitespace-pre-wrap font-medium text-[var(--color-ink)]">
          {pendingCr.adminNote?.trim() ||
            "Your last change request was not approved. Edit and submit again."}
        </p>
      </Banner>
    );
  }
  if (business.status === "verification_pending") {
    return (
      <Banner tone="warning" title="Verification under review">
        Your company is with the review team. You can still update company details while you
        wait. Any follow-up questions will show up here.
      </Banner>
    );
  }
  if (business.status === "verified") {
    return (
      <Banner tone="success" title="Verified and live">
        Your company is verified. Profile edits go through review before they appear publicly.
      </Banner>
    );
  }
  return null;
}

function crStatusBadge(status: ChangeRequest["status"]) {
  switch (status) {
    case "pending_review":
      return <Badge variant="warning">Pending review</Badge>;
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "rejected":
      return <Badge variant="danger">Rejected</Badge>;
    case "info_requested":
      return <Badge variant="warning">Changes requested</Badge>;
    default:
      return <Badge variant="neutral">{status.replaceAll("_", " ")}</Badge>;
  }
}

export default function EmployerCompanyPage() {
  const { user } = useAuth();
  const {
    business,
    businesses,
    loading: bizLoading,
    refreshBusinesses,
  } = useActiveBusiness();
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [verification, setVerification] = useState<BusinessVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    setDescriptionHtml(business?.description ?? "");
    setLogoUrl(business?.logoUrl);
  }, [business?.id, business?.description, business?.logoUrl]);

  const myMembership = useMemo(
    () => members.find((m) => m.userId === user?.uid) ?? null,
    [members, user?.uid],
  );
  const canManageTeam = isCompanyAdmin(myMembership);

  const pendingBusinessCr = useMemo(
    () =>
      changeRequests.find(
        (cr) =>
          cr.targetType === "business" &&
          (cr.status === "pending_review" || cr.status === "info_requested"),
      ) ?? null,
    [changeRequests],
  );

  const latestRejectedCr = useMemo(
    () =>
      changeRequests.find(
        (cr) => cr.targetType === "business" && cr.status === "rejected",
      ) ?? null,
    [changeRequests],
  );

  const bannerCr = pendingBusinessCr ?? latestRejectedCr;

  useEffect(() => {
    if (!user || bizLoading) return;
    void (async () => {
      setLoading(true);
      if (business) {
        const [crs, team, ver] = await Promise.all([
          listChangeRequestsForBusiness(business.id),
          listBusinessMembers(business.id),
          getEmployerVerificationRtdb(business.id),
        ]);
        setChangeRequests(crs);
        setMembers(team);
        setVerification(ver);
      } else {
        setChangeRequests([]);
        setMembers([]);
        setVerification(null);
      }
      setLoading(false);
    })();
  }, [user, business, bizLoading]);

  async function refresh(b: Business) {
    const [crs, team, ver] = await Promise.all([
      listChangeRequestsForBusiness(b.id),
      listBusinessMembers(b.id),
      getEmployerVerificationRtdb(b.id),
    ]);
    setChangeRequests(crs);
    setMembers(team);
    setVerification(ver);
  }

  async function onInviteManager(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business || !canManageTeam) return;
    const form = e.currentTarget;
    setTeamBusy(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(form);
    try {
      await inviteBusinessManager({
        businessId: business.id,
        email: String(fd.get("email")),
        displayName: String(fd.get("displayName") || "") || undefined,
        invitedBy: user.uid,
        role: "manager",
      });
      await refresh(business);
      setMessage("Manager invited. They need an employer account with that email.");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onRevokeMember(memberUserId: string) {
    if (!business || !canManageTeam || memberUserId === user?.uid) return;
    setTeamBusy(true);
    setError(null);
    try {
      await revokeBusinessMember(business.id, memberUserId);
      await refresh(business);
      setMessage("Team member removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await submitVerification({
        businessId: business.id,
        submittedBy: user.uid,
        affiliationType: String(fd.get("affiliationType")) as
          | "rotarian"
          | "rotaractor"
          | "rotary_club"
          | "other",
        affiliationDetails: String(fd.get("details")),
        supportingInfo: String(fd.get("supporting")),
      });
      await refreshBusinesses();
      await refresh(business);
      setMessage("Verification submitted for admin review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification submit failed");
    }
  }

  async function onDraftUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const patch = {
      name: String(fd.get("name")),
      description: sanitizeCompanyHtml(descriptionHtml),
      website: String(fd.get("website")),
      industry: String(fd.get("industry")),
      companySize: String(fd.get("companySize")),
      location: String(fd.get("location")),
      logoUrl: logoUrl || undefined,
      rotaryContactName: String(fd.get("rotaryContactName") ?? "").trim() || undefined,
      rotaryContactClub: String(fd.get("rotaryContactClub") ?? "").trim() || undefined,
      rotaryContactEmail: String(fd.get("rotaryContactEmail") ?? "").trim() || undefined,
      rotaryContactPhone: String(fd.get("rotaryContactPhone") ?? "").trim() || undefined,
    };
    try {
      await updateDraftBusiness(business.id, patch);
      await refreshBusinesses();
      setMessage("Company details saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function onProfileUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !business) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const proposed = {
      name,
      description: sanitizeCompanyHtml(descriptionHtml),
      website: String(fd.get("website")),
      industry: String(fd.get("industry")),
      companySize: String(fd.get("companySize")),
      location: String(fd.get("location")),
      logoUrl: logoUrl || "",
      rotaryContactName: String(fd.get("rotaryContactName") ?? "").trim(),
      rotaryContactClub: String(fd.get("rotaryContactClub") ?? "").trim(),
      rotaryContactEmail: String(fd.get("rotaryContactEmail") ?? "").trim(),
      rotaryContactPhone: String(fd.get("rotaryContactPhone") ?? "").trim(),
      slug: proposedBusinessSlug(name),
    };
    try {
      await createChangeRequest({
        targetType: "business",
        targetId: business.id,
        businessId: business.id,
        action: "update",
        proposed,
        liveSnapshot: businessLiveSnapshot(business),
        submittedBy: user.uid,
        title: `Update ${business.name}`,
        submit: true,
      });
      setMessage("Profile changes submitted for admin review");
      await refresh(business);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit changes");
    }
  }

  async function onRequestDeletion() {
    if (!user || !business) return;
    setError(null);
    setMessage(null);
    setDeleteBusy(true);
    try {
      const res = await fetch("/api/employer/business/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          confirmName: deleteConfirmName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not request deletion");
      setDeleteConfirmName("");
      setMessage("Deletion requested. An admin will restore or permanently remove this company.");
      await refreshBusinesses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request deletion");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!user || bizLoading || loading) {
    return <LoadingBlock label="Loading company…" />;
  }

  const canEditViaCr =
    business?.status === "verified" || business?.status === "suspended";
  const deletionPending = isBusinessDeletionPending(business);
  const formLocked = Boolean(pendingBusinessCr) || deletionPending;
  const showVerificationForm =
    !!business &&
    !deletionPending &&
    (business.status === "draft" || verification?.status === "info_requested");
  const showSubmittedVerification =
    !!verification &&
    verification.status === "pending" &&
    business?.status === "verification_pending";

  if (!business) {
    return (
      <main>
        <PageHeader
          title="Company"
          description="Finish company onboarding to manage your business profile."
        />
        <Panel title="Set up your company">
          <p className="text-sm text-[var(--color-muted)]">
            Company creation uses a short stepped wizard. Logo is optional; everything else is
            required.
          </p>
          <div className="mt-4">
            <Link href="/employer/onboarding">
              <Button>Continue company setup</Button>
            </Link>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Company"
        description={`Profile and verification for ${business.name}.`}
      />

      <div className="space-y-6">
          {businessStatusBanner(business, bannerCr, verification)}

          <div className="flex flex-wrap items-center gap-2">
            <CompanyAvatar name={business.name} logoUrl={business.logoUrl} size={40} />
            <h2 className="text-2xl font-semibold">{business.name}</h2>
            <Badge
              variant={
                business.status === "verified"
                  ? "success"
                  : business.status === "verification_pending" ||
                      business.status === "deletion_pending"
                    ? "warning"
                    : business.status === "suspended"
                      ? "danger"
                      : "neutral"
              }
            >
              {business.status.replaceAll("_", " ")}
            </Badge>
          </div>

          {canEditViaCr && !deletionPending ? (
            <Panel title="Edit profile">
              <form onSubmit={onProfileUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="name">Company name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={business.name}
                    required
                    disabled={formLocked}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <RichTextEditor
                    value={descriptionHtml}
                    onChange={setDescriptionHtml}
                    className={formLocked ? "pointer-events-none opacity-60" : undefined}
                  />
                </div>
                <div className="flex items-start gap-4">
                  <CompanyAvatar name={business.name} logoUrl={logoUrl} size={56} />
                  <div className="min-w-0 flex-1">
                    <FileUpload
                      id="logo-cr"
                      label="Company logo (optional)"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={formLocked}
                      onFile={(file) => {
                        void (async () => {
                          try {
                            const { publicUrl } = await uploadBusinessLogo({
                              businessId: business.id,
                              file,
                            });
                            setLogoUrl(publicUrl);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Logo upload failed");
                          }
                        })();
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rotaryContactName">Rotary / Rotaract contact</Label>
                    <Input
                      id="rotaryContactName"
                      name="rotaryContactName"
                      defaultValue={business.rotaryContactName ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rotaryContactClub">Club name</Label>
                    <Input
                      id="rotaryContactClub"
                      name="rotaryContactClub"
                      defaultValue={business.rotaryContactClub ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rotaryContactEmail">Contact email</Label>
                    <Input
                      id="rotaryContactEmail"
                      name="rotaryContactEmail"
                      type="email"
                      defaultValue={business.rotaryContactEmail ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rotaryContactPhone">Contact phone</Label>
                    <Input
                      id="rotaryContactPhone"
                      name="rotaryContactPhone"
                      type="tel"
                      defaultValue={business.rotaryContactPhone ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      defaultValue={business.website ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      name="industry"
                      defaultValue={business.industry ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <MenuSelect
                      id="companySize"
                      name="companySize"
                      label="Company size"
                      defaultValue={business.companySize ?? "1-10"}
                      disabled={formLocked}
                      options={COMPANY_SIZE_OPTIONS}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      defaultValue={business.location ?? ""}
                      disabled={formLocked}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={formLocked}>
                  Submit changes for review
                </Button>
              </form>
            </Panel>
          ) : deletionPending ? null : (
            <>
              {(business.status === "draft" || business.status === "verification_pending") && (
                <Panel title="Company details">
                  <form onSubmit={onDraftUpdate} className="space-y-4">
                    <div>
                      <Label htmlFor="draft-name">Company name</Label>
                      <Input id="draft-name" name="name" defaultValue={business.name} required />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
                    </div>
                    <div className="flex items-start gap-4">
                      <CompanyAvatar name={business.name} logoUrl={logoUrl} size={56} />
                      <div className="min-w-0 flex-1">
                        <FileUpload
                          id="logo-draft"
                          label="Company logo (optional)"
                          accept="image/png,image/jpeg,image/webp"
                          onFile={(file) => {
                            void (async () => {
                              try {
                                const { publicUrl } = await uploadBusinessLogo({
                                  businessId: business.id,
                                  file,
                                });
                                setLogoUrl(publicUrl);
                                await updateDraftBusiness(business.id, { logoUrl: publicUrl });
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Logo upload failed");
                              }
                            })();
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="draft-rotaryContactName">Rotary / Rotaract contact</Label>
                        <Input
                          id="draft-rotaryContactName"
                          name="rotaryContactName"
                          defaultValue={business.rotaryContactName ?? ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="draft-rotaryContactClub">Club name</Label>
                        <Input
                          id="draft-rotaryContactClub"
                          name="rotaryContactClub"
                          defaultValue={business.rotaryContactClub ?? ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="draft-rotaryContactEmail">Contact email</Label>
                        <Input
                          id="draft-rotaryContactEmail"
                          name="rotaryContactEmail"
                          type="email"
                          defaultValue={business.rotaryContactEmail ?? ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="draft-rotaryContactPhone">Contact phone</Label>
                        <Input
                          id="draft-rotaryContactPhone"
                          name="rotaryContactPhone"
                          type="tel"
                          defaultValue={business.rotaryContactPhone ?? ""}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="draft-website">Website</Label>
                        <Input
                          id="draft-website"
                          name="website"
                          type="url"
                          defaultValue={business.website ?? ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="draft-industry">Industry</Label>
                        <Input
                          id="draft-industry"
                          name="industry"
                          defaultValue={business.industry ?? ""}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <MenuSelect
                          id="draft-size"
                          name="companySize"
                          label="Company size"
                          defaultValue={business.companySize ?? "1-10"}
                          options={COMPANY_SIZE_OPTIONS}
                        />
                      </div>
                      <div>
                        <Label htmlFor="draft-location">Location</Label>
                        <Input
                          id="draft-location"
                          name="location"
                          defaultValue={business.location ?? ""}
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="secondary">
                      Save details
                    </Button>
                  </form>
                </Panel>
              )}
              {showSubmittedVerification ? (
                <Panel title="Submitted affiliation">
                  <p className="mb-3 text-sm text-[var(--color-muted)]">
                    This is what the review team is looking at. Follow-up questions will appear at
                    the top of this page.
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--color-muted)]">Affiliation</dt>
                      <dd className="font-medium">
                        {humanizeAffiliationType(verification.affiliationType)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--color-muted)]">Details</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap">
                        {verification.affiliationDetails || "Not set"}
                      </dd>
                    </div>
                    {verification.supportingInfo ? (
                      <div className="sm:col-span-2">
                        <dt className="text-[var(--color-muted)]">Supporting info</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap">
                          {verification.supportingInfo}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </Panel>
              ) : null}
              {showVerificationForm ? (
                <Panel
                  title={
                    verification?.status === "info_requested" ||
                    verification?.status === "rejected"
                      ? "Update and resubmit verification"
                      : "Submit verification"
                  }
                >
                  <form onSubmit={onVerify} className="space-y-4">
                    <div>
                      <MenuSelect
                        id="affiliationType"
                        name="affiliationType"
                        label="Affiliation"
                        defaultValue={verification?.affiliationType ?? "rotaractor"}
                        options={AFFILIATION_OPTIONS}
                      />
                    </div>
                    <div>
                      <Label htmlFor="details">Affiliation details</Label>
                      <Textarea
                        id="details"
                        name="details"
                        required
                        rows={3}
                        defaultValue={verification?.affiliationDetails ?? ""}
                        placeholder="Club name, membership, or how your business connects to Rotary"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supporting">Supporting information</Label>
                      <Textarea
                        id="supporting"
                        name="supporting"
                        rows={3}
                        defaultValue={verification?.supportingInfo ?? ""}
                        placeholder="Optional: anything that helps confirm your connection"
                      />
                    </div>
                    <Button type="submit">
                      {verification?.status === "info_requested" ||
                      verification?.status === "rejected"
                        ? "Resubmit for review"
                        : "Submit for review"}
                    </Button>
                  </form>
                </Panel>
              ) : null}
            </>
          )}

          <Panel title="Team">
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              {deletionPending
                ? "Team management is paused while deletion is pending."
                : "Company admins own the business. Managers (recruiters) can help run hiring for this company."}
            </p>
            <ul className="divide-y divide-[var(--color-border)]">
              {members.map((member) => {
                const roleLabel =
                  normalizeBusinessMemberRole(member.role) === "company_admin"
                    ? "Company admin"
                    : "Manager";
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        {member.displayName ||
                          member.email ||
                          member.invitedEmail ||
                          "Team member"}
                      </p>
                      {(member.email || member.invitedEmail) && (
                        <p className="text-sm text-[var(--color-muted)]">
                          {member.email || member.invitedEmail}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="neutral">{roleLabel}</Badge>
                        <Badge
                          variant={
                            member.status === "active"
                              ? "success"
                              : member.status === "invited"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {member.status === "active"
                            ? "Active"
                            : member.status === "invited"
                              ? "Invited"
                              : member.status === "revoked"
                                ? "Revoked"
                                : "Unknown"}
                        </Badge>
                      </div>
                    </div>
                    {canManageTeam &&
                      !deletionPending &&
                      normalizeBusinessMemberRole(member.role) !== "company_admin" &&
                      member.userId !== user?.uid && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={teamBusy}
                          onClick={() => void onRevokeMember(member.userId)}
                        >
                          Remove
                        </Button>
                      )}
                  </li>
                );
              })}
              {members.length === 0 && (
                <li className="py-2 text-sm text-[var(--color-muted)]">No team members yet.</li>
              )}
            </ul>
            {canManageTeam && !deletionPending && (
              <form
                onSubmit={onInviteManager}
                className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-4"
              >
                <p className="text-sm font-medium">Invite a manager</p>
                <div>
                  <Label htmlFor="manager-email">Email</Label>
                  <Input id="manager-email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="manager-name">Display name (optional)</Label>
                  <Input id="manager-name" name="displayName" />
                </div>
                <Button type="submit" disabled={teamBusy}>
                  {teamBusy ? "Inviting…" : "Invite manager"}
                </Button>
              </form>
            )}
          </Panel>

          {changeRequests.length > 0 && (
            <Panel title="Change requests">
              <ul className="divide-y divide-[var(--color-border)]">
                {changeRequests.map((cr) => (
                  <li key={cr.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {cr.title ?? `${cr.action} ${cr.targetType}`}
                      </p>
                      {crStatusBadge(cr.status)}
                    </div>
                    {cr.adminNote && (
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{cr.adminNote}</p>
                    )}
                    {cr.liveSnapshot && cr.status === "pending_review" && (
                      <div className="mt-4">
                        <DiffView
                          rows={Object.keys(cr.proposed).map((field) => ({
                            field,
                            before: String(cr.liveSnapshot?.[field] ?? ""),
                            after: String(cr.proposed[field] ?? ""),
                          }))}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {canManageTeam && !deletionPending ? (
            <Panel title="Danger zone">
              <p className="text-sm text-[var(--color-muted)]">
                Request deletion to hide this company from the public board. An admin must restore
                or permanently delete it. Candidates keep application history stubs after a
                permanent purge.
              </p>
              <div className="mt-4 max-w-md space-y-3">
                <div>
                  <Label htmlFor="delete-confirm-name">
                    Type <span className="font-semibold text-[var(--color-ink)]">{business.name}</span>{" "}
                    to confirm
                  </Label>
                  <Input
                    id="delete-confirm-name"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  disabled={
                    deleteBusy ||
                    deleteConfirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()
                  }
                  onClick={() => void onRequestDeletion()}
                >
                  {deleteBusy ? "Requesting…" : "Request company deletion"}
                </Button>
              </div>
            </Panel>
          ) : null}

          <p className="pt-2 text-xs text-[var(--color-muted)]">
            Need a separate hiring entity?{" "}
            <Link
              href="/employer/onboarding?new=1"
              className="underline decoration-[var(--color-border)] underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Add another company
            </Link>
            {businesses.length > 1 ? " · Switch companies from your account menu." : null}
          </p>
        </div>

      {message && <p className="mt-4 text-sm text-[var(--color-success)]">{message}</p>}
      {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
    </main>
  );
}
