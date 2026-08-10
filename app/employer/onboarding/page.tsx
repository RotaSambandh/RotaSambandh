"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MenuSelect } from "@/components/ui/menu-select";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { FileUpload, LoadingBlock } from "@/components/ui";
import { useAuth } from "@/components/auth/auth-provider";
import {
  createBusiness,
  isEmployerBusinessOnboarded,
  submitVerification,
  updateDraftBusiness,
} from "@/lib/dal/employer";
import { listOwnedBusinessesRtdb } from "@/lib/dal/employer-rtdb";
import { uploadBusinessLogo } from "@/lib/uploads/encode-logo";
import { isNonEmptyHtml, sanitizeCompanyHtml } from "@/lib/sanitize/html";
import type { Business, BusinessVerification } from "@/shared/types";

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "brand", label: "Brand" },
  { id: "affiliation", label: "Affiliation" },
  { id: "done", label: "Done" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const SIZE_OPTIONS = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "500+", label: "500+" },
];

const AFFILIATION_OPTIONS: Array<{ value: BusinessVerification["affiliationType"]; label: string }> = [
  { value: "rotaractor", label: "Rotaractor" },
  { value: "rotarian", label: "Rotarian" },
  { value: "rotary_club", label: "Rotary club" },
  { value: "other", label: "Other" },
];

export default function EmployerOnboardingPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading…" />}>
      <EmployerOnboardingForm />
    </Suspense>
  );
}

function EmployerOnboardingForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceNew = searchParams.get("new") === "1";
  const [step, setStep] = useState<StepId>("basics");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [companySize, setCompanySize] = useState("1-10");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [affiliationType, setAffiliationType] =
    useState<BusinessVerification["affiliationType"]>("rotaractor");
  const [affiliationDetails, setAffiliationDetails] = useState("");
  const [rotaryContactName, setRotaryContactName] = useState("");
  const [rotaryContactClub, setRotaryContactClub] = useState("");
  const [rotaryContactEmail, setRotaryContactEmail] = useState("");
  const [rotaryContactPhone, setRotaryContactPhone] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/employer/sign-up");
      return;
    }
    void listOwnedBusinessesRtdb(user.uid).then((list) => {
      if (forceNew) {
        setBusiness(null);
        setStep("basics");
        return;
      }
      if (list.length > 0 && list.every(isEmployerBusinessOnboarded)) {
        router.replace("/employer");
        return;
      }
      const draft = list.find((b) => b.status === "draft" || b.status === "verification_pending");
      if (draft) {
        setBusiness(draft);
        setName(draft.name);
        setIndustry(draft.industry ?? "");
        setLocation(draft.location ?? "");
        setCompanySize(draft.companySize ?? "1-10");
        setWebsite(draft.website ?? "");
        setDescription(draft.description ?? "");
        setLogoUrl(draft.logoUrl);
        setRotaryContactName(draft.rotaryContactName ?? "");
        setRotaryContactClub(draft.rotaryContactClub ?? "");
        setRotaryContactEmail(draft.rotaryContactEmail ?? "");
        setRotaryContactPhone(draft.rotaryContactPhone ?? "");
        if (draft.status === "verification_pending") setStep("done");
        else if (draft.description && isNonEmptyHtml(draft.description)) setStep("affiliation");
        else if (draft.name) setStep("brand");
      }
    });
  }, [user, loading, router, forceNew]);

  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.id === step), [step]);

  function goBack() {
    if (stepIndex <= 0 || step === "done") return;
    setStep(STEPS[stepIndex - 1]!.id);
    setError(null);
  }

  async function goContinue() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      if (step === "basics") {
        if (!name.trim() || !industry.trim() || !location.trim() || !website.trim()) {
          setError("Company name, industry, location, and website are required.");
          return;
        }
        if (business) {
          await updateDraftBusiness(business.id, {
            name: name.trim(),
            industry: industry.trim(),
            location: location.trim(),
            companySize,
            website: website.trim(),
          });
          setBusiness({ ...business, name: name.trim() });
        } else {
          const created = await createBusiness({
            ownerId: user.uid,
            name: name.trim(),
            industry: industry.trim(),
            location: location.trim(),
            companySize,
            website: website.trim(),
          });
          setBusiness(created);
        }
        setStep("brand");
        return;
      }

      if (step === "brand") {
        if (!business) {
          setError("Create company basics first.");
          return;
        }
        const clean = sanitizeCompanyHtml(description);
        if (!isNonEmptyHtml(clean)) {
          setError("A company description is required.");
          return;
        }
        await updateDraftBusiness(business.id, {
          description: clean,
          logoUrl: logoUrl || undefined,
        });
        setDescription(clean);
        setStep("affiliation");
        return;
      }

      if (step === "affiliation") {
        if (!business) {
          setError("Create company basics first.");
          return;
        }
        if (
          !affiliationDetails.trim() ||
          !rotaryContactName.trim() ||
          !rotaryContactClub.trim() ||
          !rotaryContactEmail.trim() ||
          !rotaryContactPhone.trim()
        ) {
          setError("Complete affiliation details and Rotary / Rotaract contact fields.");
          return;
        }
        await updateDraftBusiness(business.id, {
          rotaryContactName: rotaryContactName.trim(),
          rotaryContactClub: rotaryContactClub.trim(),
          rotaryContactEmail: rotaryContactEmail.trim(),
          rotaryContactPhone: rotaryContactPhone.trim(),
        });
        await submitVerification({
          businessId: business.id,
          submittedBy: user.uid,
          affiliationType,
          affiliationDetails: affiliationDetails.trim(),
        });
        setStep("done");
        return;
      }

      if (step === "done") {
        router.push("/employer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onLogoFile(file: File) {
    if (!business) {
      setError("Save company basics before uploading a logo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { publicUrl } = await uploadBusinessLogo({ businessId: business.id, file });
      setLogoUrl(publicUrl);
      await updateDraftBusiness(business.id, { logoUrl: publicUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <LoadingBlock label="Loading…" />;
  }

  return (
    <OnboardingShell
      title={
        step === "basics"
          ? "Company basics"
          : step === "brand"
            ? "Story and brand"
            : step === "affiliation"
              ? "Rotary affiliation"
              : "Submitted for review"
      }
      description={
        step === "basics"
          ? "Tell candidates who you are. You can add another company later from Company settings."
          : step === "brand"
            ? "A clear description builds trust. Logo is optional — we will use initials until you upload one."
            : step === "affiliation"
              ? "The person registering may be a recruiter. Enter the Rotary / Rotaract Contact separately for admin verification."
              : "An admin will review your affiliation. You can manage the company from the employer dashboard while you wait."
      }
      steps={[...STEPS]}
      current={step}
      onBack={step === "basics" || step === "done" ? undefined : goBack}
      onContinue={() => void goContinue()}
      continueLabel={step === "done" ? "Go to dashboard" : busy ? "Saving…" : "Continue"}
      continueDisabled={busy}
    >
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {step === "basics" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Company name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
          <MenuSelect
            id="size"
            label="Company size"
            value={companySize}
            onValueChange={setCompanySize}
            options={SIZE_OPTIONS}
          />
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              required
            />
          </div>
        </div>
      ) : null}

      {step === "brand" ? (
        <div className="space-y-4">
          <div>
            <Label>Company description</Label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div className="flex items-center gap-4">
            <CompanyAvatar name={name || "Company"} logoUrl={logoUrl} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--color-muted)]">
                Logo optional — you can add or change it later from Company settings.
              </p>
              <div className="mt-2">
                <FileUpload
                  id="logo"
                  label="Upload logo (PNG or JPEG)"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy || !business}
                  onFile={(file) => void onLogoFile(file)}
                  hint="We convert to WebP for the job board."
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === "affiliation" ? (
        <div className="space-y-3">
          <MenuSelect
            id="affiliationType"
            label="Affiliation type"
            value={affiliationType}
            onValueChange={(v) => setAffiliationType(v as BusinessVerification["affiliationType"])}
            options={AFFILIATION_OPTIONS}
          />
          <div>
            <Label htmlFor="details">Affiliation details</Label>
            <Textarea
              id="details"
              rows={3}
              value={affiliationDetails}
              onChange={(e) => setAffiliationDetails(e.target.value)}
              placeholder="How this business connects to Rotary / Rotaract"
              required
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Rotary / Rotaract Contact
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            Not necessarily the person signed in. Used for admin verification follow-up.
          </p>
          <div>
            <Label htmlFor="rcName">Contact name</Label>
            <Input
              id="rcName"
              value={rotaryContactName}
              onChange={(e) => setRotaryContactName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="rcClub">Club name</Label>
            <Input
              id="rcClub"
              value={rotaryContactClub}
              onChange={(e) => setRotaryContactClub(e.target.value)}
              placeholder="Rotary or Rotaract club"
              required
            />
          </div>
          <div>
            <Label htmlFor="rcEmail">Contact email</Label>
            <Input
              id="rcEmail"
              type="email"
              value={rotaryContactEmail}
              onChange={(e) => setRotaryContactEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="rcPhone">Contact phone</Label>
            <Input
              id="rcPhone"
              type="tel"
              value={rotaryContactPhone}
              onChange={(e) => setRotaryContactPhone(e.target.value)}
              required
            />
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="text-sm text-[var(--color-muted)]">
          Your company is pending admin review. Verified businesses can post roles with a trust
          badge.
        </p>
      ) : null}
    </OnboardingShell>
  );
}
